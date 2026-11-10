"""Pinned experimental silent-tail reference. No network or encoder calls.

Extracted from buwryme/tiktok-lossless-upload commit
348c179f21eef1202d22faabf704b80d78f216ca (2026-11-10).
Upstream license follows. Keep this implementation isolated from legacy patches.

MIT License

Copyright (c) 2026 miles

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""

import math
import re
import struct
from dataclasses import dataclass, field
from typing import Optional

_SLSR_CONTAINERS = {b"moov", b"trak", b"mdia", b"minf", b"stbl", b"edts", b"dinf"}
_SLSR_AAC_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350]
_SLSR_SILENT_FRAME = bytes([33, 16, 4, 96, 140, 28])


def _slsr_u32(data, off):
    return struct.unpack_from(">I", data, off)[0]


def _slsr_u64(data, off):
    return struct.unpack_from(">Q", data, off)[0]


def _slsr_p32(value):
    return struct.pack(">I", value & 0xFFFFFFFF)


def _slsr_p64(value):
    return struct.pack(">Q", value)


def _slsr_fourcc(value):
    if isinstance(value, (bytes, bytearray)):
        return bytes(value[:4])
    return str(value).encode("latin-1")[:4].ljust(4, b" ")


def _slsr_box(name, payload):
    return _slsr_p32(len(payload) + 8) + _slsr_fourcc(name) + payload


def _slsr_p32s(*values):
    return b"".join(_slsr_p32(v) for v in values)


@dataclass
class _SlSrBox:
    name: bytes
    data: bytes
    raw: Optional[bytes] = None
    children: Optional[list] = field(default=None)

    def __deepcopy__(self, memo):
        return _SlSrBox(
            self.name,
            self.data,
            self.raw,
            None if self.children is None else [c.__deepcopy__(memo) for c in self.children],
        )


def _slsr_read_header(data, available):
    assert len(data) >= 8
    size = _slsr_u32(data, 0)
    header = 16 if size == 1 else 8
    assert len(data) >= header
    total = _slsr_u64(data, 8) if size == 1 else (size or available)
    assert isinstance(total, int) and total >= header and total <= available
    return _slsr_fourcc(data[4:8]), header, total, size == 0


def _slsr_parse_boxes(data, depth=0):
    assert depth < 16
    result = []
    pos = 0
    while pos < len(data):
        name, header, size, _zero = _slsr_read_header(data[pos:], len(data) - pos)
        raw = data[pos:pos + size]
        payload = raw[header:]
        result.append(_SlSrBox(name, payload, raw, _slsr_parse_boxes(payload, depth + 1) if name in _SLSR_CONTAINERS else None))
        pos += size
    return result


def _slsr_serialize_box(item):
    if item.children is not None:
        return _slsr_box(item.name, b"".join(_slsr_serialize_box(c) for c in item.children))
    if item.raw is not None:
        return item.raw
    return _slsr_box(item.name, item.data)


def _slsr_child(item, name):
    for c in item.children or []:
        if c.name == name:
            return c
    raise AssertionError("missing MP4 box: " + name.decode("latin-1"))


def _slsr_find_child(item, name):
    for c in item.children or []:
        if c.name == name:
            return c
    return None


def _slsr_set_data(item, data):
    item.data = bytes(data)
    item.raw = None


def _slsr_write_int(item, offset, width, value):
    assert value >= 0 and (width == 8 or value < 0xFFFFFFFF)
    data = bytearray(item.data)
    data[offset:offset + width] = _slsr_p64(value) if width == 8 else _slsr_p32(value)
    _slsr_set_data(item, data)


def _slsr_read_int(data, offset, width):
    return _slsr_u64(data, offset) if width == 8 else _slsr_u32(data, offset)


def _slsr_descriptor(data, start):
    assert start < len(data)
    tag = data[start]
    pos = start + 1
    length = 0
    for _ in range(4):
        assert pos < len(data)
        value = data[pos]
        pos += 1
        length = length * 128 + (value & 0x7F)
        if not value & 0x80:
            assert pos + length <= len(data)
            return tag, pos, pos + length
    raise AssertionError("invalid descriptor")


def _slsr_descriptor_bytes(tag, payload):
    length = len(payload)
    return bytes([tag, 0x80 | (length >> 21), 0x80 | ((length >> 14) & 0x7F),
                  0x80 | ((length >> 7) & 0x7F), length & 0x7F]) + payload


def _slsr_patch_audio_description(stsd):
    data = stsd.data
    assert len(data) >= 44 and _slsr_u32(data, 0) == 0 and _slsr_u32(data, 4) == 1
    sample = data[8:]
    assert _slsr_fourcc(sample[4:8]) == b"mp4a" and _slsr_u32(sample, 0) == len(sample)
    assert sample[16] == 0 and sample[17] == 0 and sample[24] == 0 and sample[25] == 2
    entries = _slsr_parse_boxes(sample[36:])
    esds = next((e for e in entries if e.name == b"esds"), None)
    assert esds is not None and not any(e.name in (b"sinf", b"wave") for e in entries)
    esds_data = esds.data
    assert len(esds_data) >= 4 and _slsr_u32(esds_data, 0) == 0
    decoder = _slsr_descriptor(esds_data, 4)
    assert decoder[0] == 3 and decoder[2] - decoder[1] >= 3 and esds_data[decoder[1] + 2] == 0

    rate_index = -1
    rebuilt = []
    pos = decoder[1] + 3
    while pos < decoder[2]:
        item = _slsr_descriptor(esds_data[:decoder[2]], pos)
        if item[0] != 4:
            rebuilt.append(esds_data[pos:item[2]])
        else:
            assert item[2] - item[1] >= 13 and esds_data[item[1]] == 64
            nested = []
            nested_pos = item[1] + 13
            while nested_pos < item[2]:
                sub = _slsr_descriptor(esds_data[:item[2]], nested_pos)
                if sub[0] != 5:
                    nested.append(esds_data[nested_pos:sub[2]])
                else:
                    config = esds_data[sub[1]:sub[2]]
                    assert rate_index < 0 and len(config) >= 2
                    assert config[0] >> 3 == 2 and (config[1] & 127) == 16
                    rate_index = ((config[0] & 7) << 1) | (config[1] >> 7)
                    bits = "".join(format(b, "08b") for b in config[2:])
                    assert rate_index < len(_SLSR_AAC_RATES)
                    assert "1" not in bits or re.fullmatch(r"01010110111001010*", bits)
                    table = format(rate_index, "04b")
                    config_bits = ("00010" + table + "0000000000001" + table
                                   + "00000001000000000000000010000")
                    padded = config_bits.ljust(math.ceil(len(config_bits) / 8) * 8, "0") + "00000000"
                    nested.append(_slsr_descriptor_bytes(
                        5, bytes(int(padded[i:i + 8], 2) for i in range(0, len(padded), 8))
                    ))
                nested_pos = sub[2]
            rebuilt.append(_slsr_descriptor_bytes(
                4, esds_data[item[1]:item[1] + 13] + b"".join(nested)
            ))
        pos = item[2]

    assert rate_index >= 0
    _slsr_set_data(esds, esds_data[:4] + _slsr_descriptor_bytes(
        3, esds_data[decoder[1]:decoder[1] + 3] + b"".join(rebuilt)
    ) + esds_data[decoder[2]:])
    replacement = _slsr_box(b"mp4a", sample[8:36] + b"".join(_slsr_serialize_box(e) for e in entries))
    return _SLSR_AAC_RATES[rate_index], _slsr_p32s(0, 2) + sample + replacement


def _slsr_table_count(item, stride):
    assert len(item.data) >= 8 and _slsr_u32(item.data, 0) == 0
    count = _slsr_u32(item.data, 4)
    assert len(item.data) == 8 + count * stride and count <= 5_000_000
    return count


def _slsr_header_fields(item):
    assert item.data[0] in (0, 1)
    version1 = item.data[0] == 1
    is_tkhd = item.name == b"tkhd"
    offset = (28 if version1 else 20) if is_tkhd else (24 if version1 else 16)
    width = 8 if version1 else 4
    return {
        "offset": offset,
        "width": width,
        "duration": _slsr_read_int(item.data, offset, width),
        "scale": 0 if is_tkhd else _slsr_u32(item.data, offset - 4),
    }


def _slsr_extend_edit(item, audio_duration, audio_scale, movie_scale, sample_rate, duration, tail):
    edts = _slsr_find_child(item, b"edts")
    if edts is None:
        assert abs(duration - round(audio_duration * movie_scale / audio_scale)) <= 1
        return tail
    elst = _slsr_child(edts, b"elst")
    data = elst.data
    assert data[0] in (0, 1)
    width = 8 if data[0] == 1 else 4
    count = _slsr_u32(data, 4)
    stride = 2 * width + 4
    assert count in (1, 2) and len(data) == 8 + count * stride
    offset = 8 + (count - 1) * stride
    segment = _slsr_read_int(data, offset, width)
    media_time = _slsr_read_int(data, offset + width, width)
    assert media_time >= 0 and _slsr_u32(data, offset + 2 * width) == 65536
    if count == 2:
        assert all(b == 255 for b in data[8 + width:8 + 2 * width])
        assert _slsr_u32(data, 8 + 2 * width) == 65536
    assert abs(duration - segment - (_slsr_read_int(data, 8, width) if count == 2 else 0)) <= 1
    difference = (audio_duration - media_time) * movie_scale - segment * audio_scale
    assert abs(difference) <= math.ceil(2048 * audio_scale / sample_rate) * movie_scale
    extra = tail + max(0, math.ceil(difference / audio_scale))
    _slsr_write_int(elst, offset, width, segment + extra)
    return extra


def patch_bytes_slsr(data):
    tops = []
    pos = 0
    while pos < len(data):
        name, header, size, zero = _slsr_read_header(data[pos:pos + 16], len(data) - pos)
        assert len(tops) < 10000 and name not in (b"moof", b"sidx", b"mfra", b"ssix")
        tops.append({"name": name, "at": pos, "size": size, "width": header, "zero": zero})
        pos += size

    moovs = [b for b in tops if b["name"] == b"moov"]
    mdats = [b for b in tops if b["name"] == b"mdat"]
    assert len(moovs) == 1 and mdats and moovs[0]["width"] == 8 and moovs[0]["size"] <= 32 * 1024 * 1024
    moov = moovs[0]
    root = _slsr_parse_boxes(data[moov["at"]:moov["at"] + moov["size"]])[0]
    tracks = [b for b in root.children if b.name == b"trak"]
    audio_tracks = []
    for track in tracks:
        hdlr = _slsr_child(_slsr_child(track, b"mdia"), b"hdlr")
        if hdlr.data[8:12] == b"soun":
            audio_tracks.append(track)
    assert len(audio_tracks) == 1
    audio = audio_tracks[0]
    media = _slsr_child(audio, b"mdia")
    minf = _slsr_child(media, b"minf")
    dref = _slsr_child(_slsr_child(minf, b"dinf"), b"dref").data
    refs = _slsr_parse_boxes(dref[8:])
    assert _slsr_u32(dref, 0) == 0 and _slsr_u32(dref, 4) == len(refs) and refs
    assert all(ref.name == b"url " and _slsr_u32(ref.data, 0) == 1 for ref in refs)

    stbl = _slsr_child(minf, b"stbl")
    allowed = {b"stsd", b"stsz", b"stsc", b"stts", b"stco", b"co64", b"sbgp", b"sgpd",
               b"subs", b"free", b"skip", b"ctts", b"stss", b"stps", b"sdtp", b"stdp"}
    assert all(c.name in allowed for c in stbl.children)
    stsd = _slsr_child(stbl, b"stsd")
    sample_rate, patched_stsd = _slsr_patch_audio_description(stsd)

    stsz = _slsr_child(stbl, b"stsz")
    assert len(stsz.data) >= 12 and _slsr_u32(stsz.data, 0) == 0
    uniform = _slsr_u32(stsz.data, 4)
    sample_count = _slsr_u32(stsz.data, 8)
    assert sample_count > 0 and sample_count <= 5_000_000
    assert len(stsz.data) == 12 + (0 if uniform else 4 * sample_count)

    def sample_size(index):
        return uniform or _slsr_u32(stsz.data, 12 + 4 * index)

    stsc = _slsr_child(stbl, b"stsc")
    runs = _slsr_table_count(stsc, 12)
    if _slsr_find_child(stbl, b"stco") is not None:
        assert _slsr_find_child(stbl, b"co64") is None
        offsets = _slsr_find_child(stbl, b"stco")
    else:
        offsets = _slsr_child(stbl, b"co64")
    offset_width = 4 if offsets.name == b"stco" else 8
    chunks = _slsr_table_count(offsets, offset_width)
    assert runs > 0 and chunks > 0

    def first_chunk(index):
        return _slsr_u32(stsc.data, 8 + 12 * index)

    assert first_chunk(0) == 1
    for index in range(runs):
        assert first_chunk(index) <= chunks
        assert index == 0 or first_chunk(index) > first_chunk(index - 1)
        assert _slsr_u32(stsc.data, 12 + 12 * index) > 0
        assert _slsr_u32(stsc.data, 16 + 12 * index) == 1

    run = 0
    sampled = 0
    for index in range(chunks):
        if run + 1 < runs and first_chunk(run + 1) == index + 1:
            run += 1
        per_chunk = _slsr_u32(stsc.data, 12 + 12 * run)
        assert sampled + per_chunk <= sample_count
        chunk_bytes = 0
        for _ in range(per_chunk):
            size = sample_size(sampled)
            sampled += 1
            assert size > 0
            chunk_bytes += size
        offset = _slsr_read_int(offsets.data, 8 + index * offset_width, offset_width)
        assert any(offset >= m["at"] + m["width"] and offset + chunk_bytes <= m["at"] + m["size"]
                   for m in mdats)
    assert sampled == sample_count

    stts = _slsr_child(stbl, b"stts")
    timing_count = _slsr_table_count(stts, 8)
    audio_duration = 0
    timed_samples = 0
    timing = []
    for index in range(timing_count):
        count = _slsr_u32(stts.data, 8 + 8 * index)
        delta = _slsr_u32(stts.data, 12 + 8 * index)
        assert count > 0 and delta > 0
        timing.append([count, delta])
        timed_samples += count
        audio_duration += count * delta
    assert timed_samples == sample_count

    mdhd = _slsr_child(media, b"mdhd")
    mvhd = _slsr_child(root, b"mvhd")
    tkhd = _slsr_child(audio, b"tkhd")
    audio_header = _slsr_header_fields(mdhd)
    movie_header = _slsr_header_fields(mvhd)
    track_header = _slsr_header_fields(tkhd)
    assert audio_header["scale"] and movie_header["scale"] and audio_header["duration"] > 0
    assert abs(audio_header["duration"] - audio_duration) <= math.ceil(
        2048 * audio_header["scale"] / sample_rate)
    assert tkhd.data[3] & 1 and track_header["duration"] > 0

    tail_frames = max(10, math.ceil(0.35 * sample_rate / 1024))
    for item in stbl.children:
        payload = item.data
        if item.name == b"sbgp":
            header = 12 if payload[0] == 1 else 8
            assert payload[0] in (0, 1) and len(payload) >= header + 4
            groups = _slsr_u32(payload, header)
            assert len(payload) == header + 4 + groups * 8
            covered = sum(_slsr_u32(payload, header + 4 + 8 * g) for g in range(groups))
            assert covered <= sample_count
            extra = sample_count - covered + tail_frames
            if groups and _slsr_u32(payload, len(payload) - 4) == 0:
                at = len(payload) - 8
                _slsr_write_int(item, at, 4, _slsr_u32(payload, at) + extra)
            else:
                _slsr_set_data(item, payload[:header] + _slsr_p32(groups + 1) + payload[header + 4:]
                         + _slsr_p32s(extra, 0))
        elif item.name == b"ctts":
            count = _slsr_table_count(item, 8)
            covered = 0
            for index in range(count):
                covered += _slsr_u32(payload, 8 + 8 * index)
                assert _slsr_u32(payload, 12 + 8 * index) == 0
            assert covered == sample_count
            _slsr_set_data(item, _slsr_p32s(0, count + 1) + payload[8:] + _slsr_p32s(tail_frames, 0))
        elif item.name in (b"stss", b"stps"):
            count = _slsr_table_count(item, 4)
            previous = 0
            for index in range(count):
                value = _slsr_u32(payload, 8 + 4 * index)
                assert value > previous and value <= sample_count
                previous = value
            _slsr_set_data(item, _slsr_p32s(0, count + tail_frames) + payload[8:]
                     + _slsr_p32s(*[sample_count + i + 1 for i in range(tail_frames)]))
        elif item.name in (b"sdtp", b"stdp"):
            stride = 1 if item.name == b"sdtp" else 2
            assert len(payload) == 4 + stride * sample_count
            _slsr_set_data(item, payload + bytes(stride * tail_frames))

    tail_extra = tail_frames - 8
    audio_tail = math.floor(tail_frames * 1024 * audio_header["scale"] / sample_rate)
    movie_tail = round(audio_tail * movie_header["scale"] / audio_header["scale"])
    assert movie_tail > 0
    edit_extra = _slsr_extend_edit(audio, audio_duration, audio_header["scale"], movie_header["scale"],
                             sample_rate, track_header["duration"], movie_tail)
    _slsr_write_int(tkhd, track_header["offset"], track_header["width"],
              track_header["duration"] + edit_extra)
    _slsr_write_int(mdhd, audio_header["offset"], audio_header["width"],
              audio_header["duration"] + audio_tail)

    for index in range(tail_frames):
        delta = (math.floor((index + 1) * 1024 * audio_header["scale"] / sample_rate)
                 - math.floor(index * 1024 * audio_header["scale"] / sample_rate))
        assert 0 < delta <= 0xFFFFFFFF
        if timing[-1][1] == delta:
            timing[-1][0] += 1
        else:
            timing.append([1, delta])
    new_stts = bytearray(8 + len(timing) * 8)
    struct.pack_into(">I", new_stts, 4, len(timing))
    for index, (count, delta) in enumerate(timing):
        struct.pack_into(">II", new_stts, 8 + index * 8, count, delta)
    _slsr_set_data(stts, new_stts)

    new_stsz = bytearray(12 + 4 * (sample_count + tail_frames))
    struct.pack_into(">I", new_stsz, 8, sample_count + tail_frames)
    for index in range(sample_count + tail_frames):
        struct.pack_into(">I", new_stsz, 12 + 4 * index,
                         sample_size(index) if index < sample_count else len(_SLSR_SILENT_FRAME))
    _slsr_set_data(stsz, new_stsz)

    old_offset_width = offset_width
    first_offset = len(data) + 8
    second_offset = first_offset + tail_extra * len(_SLSR_SILENT_FRAME)
    offset_width = 8 if old_offset_width == 8 or second_offset > 0xFFFFFFFF else 4
    new_offsets = bytearray(8 + (chunks + 2) * offset_width)
    struct.pack_into(">I", new_offsets, 4, chunks + 2)
    for index in range(chunks + 2):
        if index < chunks:
            value = _slsr_read_int(offsets.data, 8 + index * old_offset_width, old_offset_width)
        else:
            value = first_offset if index == chunks else second_offset
        if offset_width == 8:
            struct.pack_into(">Q", new_offsets, 8 + index * 8, value)
        else:
            struct.pack_into(">I", new_offsets, 8 + index * 4, value)
    offsets.name = b"co64" if offset_width == 8 else b"stco"
    _slsr_set_data(offsets, new_offsets)

    stsc_payload = stsc.data[8:]

    def rebuilt_stsc(description):
        return (_slsr_p32s(0, runs + 2) + stsc_payload
                + _slsr_p32s(chunks + 1, tail_extra, 1, chunks + 2, 8, description))

    _slsr_set_data(stsc, rebuilt_stsc(1))
    clone = audio.__deepcopy__({})
    _slsr_set_data(stsc, rebuilt_stsc(2))
    _slsr_set_data(stsd, patched_stsd)

    def track_id(item):
        tkhd_box = _slsr_child(item, b"tkhd")
        return _slsr_u32(tkhd_box.data, 20 if tkhd_box.data[0] == 1 else 12)

    ids = [track_id(track) for track in tracks]
    assert all(ids) and len(set(ids)) == len(ids)
    next_id = max(ids) + 1
    clone_tkhd = _slsr_child(clone, b"tkhd")
    _slsr_write_int(clone_tkhd, 20 if clone_tkhd.data[0] == 1 else 12, 4, next_id)
    next_offset = 108 if mvhd.data[0] == 1 else 96
    previous_next = _slsr_u32(mvhd.data, next_offset)
    _slsr_write_int(mvhd, next_offset, 4, max(next_id + 1, 0 if previous_next == 0xFFFFFFFF else previous_next))
    if (movie_header["duration"] > 0
            and not (movie_header["width"] == 4 and movie_header["duration"] == 0xFFFFFFFF)):
        longest = movie_header["duration"]
        for track in tracks:
            fields = _slsr_header_fields(_slsr_child(track, b"tkhd"))
            if fields["duration"] > 0 and not (
                    fields["width"] == 4 and fields["duration"] == 0xFFFFFFFF):
                longest = max(longest, fields["duration"])
        _slsr_write_int(mvhd, movie_header["offset"], movie_header["width"], longest)

    root.children.insert(root.children.index(audio) + 1, clone)
    silent = _SLSR_SILENT_FRAME * tail_frames
    output = []
    for item in tops:
        if item is moov:
            output.append(_slsr_p32(item["size"]) + b"free" + data[item["at"] + 8:item["at"] + item["size"]])
        elif item["zero"]:
            assert item["size"] <= 0xFFFFFFFF
            output.append(_slsr_p32(item["size"]) + data[item["at"] + 4:item["at"] + item["size"]])
        else:
            output.append(data[item["at"]:item["at"] + item["size"]])
    output.append(_slsr_box(b"mdat", silent))
    output.append(_slsr_serialize_box(root))
    return b"".join(output)
