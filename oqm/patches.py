"""The OQM container patches.

Every patch is a separate, named, toggleable step so A/B tests can isolate
which change (if any) affects what TikTok serves. No patch here touches the
compressed video or primary audio data - `oqm verify` proves that per file.
"""

import struct
from dataclasses import dataclass, field
from pathlib import Path

from . import ff, mp4
from .mp4 import Box, full_box, u32, u64


@dataclass(frozen=True)
class PatchInfo:
    id: str
    summary: str
    seen_in: str
    evidence: str


CATALOG = [
    PatchInfo("faststart", "Rewrite layout as ftyp -> moov -> mdat (index before media data). Always applied.",
              "Every public patcher; standard FFmpeg +faststart.", "Standard streaming practice. Harmless."),
    PatchInfo("strip-free", "Drop top-level free/skip padding boxes.",
              "buwryme/tiktok-lossless-upload.", "Cosmetic. No known effect on processing."),
    PatchInfo("zero-times", "Zero creation/modification timestamps in tkhd and mdhd.",
              "buwryme/tiktok-lossless-upload.", "Unverified effect. Also removes when-you-exported info."),
    PatchInfo("mvhd-unknown-duration", "Upgrade mvhd to version 1 and set its duration to all-ones (\"unknown\").",
              "buwryme/tiktok-lossless-upload.", "Unverified effect. Forces readers to derive duration from tracks."),
    PatchInfo("video-elst-plus-one", "Lengthen the video edit list segment by one movie-timescale tick.",
              "buwryme/tiktok-lossless-upload.", "Unverified effect. ~1 ms longer declared playback."),
    PatchInfo("decoy-audio", "Clone the audio track and inflate the clone's sample tables with tiny dummy samples. "
              "Keeps the real track's edit list on the clone (the public reference drops it, which silently "
              "extends the container's declared duration past the real video - this was the cause of the "
              "looping/playback-stutter reports; fixed here, verified duration-identical in tests).",
              "buwryme, CompressBase-style implementations, NoBlur (video-track variant).",
              "The core claimed trigger. Mechanism inspectable; TikTok-side effect unverified."),
    PatchInfo("clean-metadata", "Replace moov/udta with a single minimal tag set (encoder string only, no branding).",
              "Most patchers rewrite metadata (often adding their own branding).", "Unverified effect."),
    PatchInfo("trailing-pad", "Append padding after mdat that starts with a malformed 'VOID' box.",
              "buwryme/tiktok-lossless-upload (184,100 bytes).", "Unverified effect. Parsers stop reading at it."),
]
PATCH_IDS = [p.id for p in CATALOG]

PROFILES = {
    # Control arm for A/B tests: same bitstream, standard layout, nothing else.
    "none": {"faststart"},
    # Only the decoy track. Arm C: full passthrough in the first A/B round, so it's the default.
    "minimal": {"faststart", "decoy-audio"},
    # Full replication of the public reference method (copy mode), minus its bugs and branding.
    "reference": set(PATCH_IDS),
    # Arm D: everything except the decoy. Isolates whether the decoy itself is doing the work.
    "structure": set(PATCH_IDS) - {"decoy-audio"},
}

DUMMY_SIZE_BY_CODEC = {b"avc1": 8, b"avc3": 8, b"hvc1": 16, b"hev1": 16, b"vp09": 4, b"av01": 4, b"mp4v": 8}


@dataclass
class PatchOptions:
    enabled: set = field(default_factory=lambda: set(PROFILES["minimal"]))
    inflate: int = 10                 # clone sample count = original * inflate
    dummy_size: int | None = None     # bytes per dummy sample; None = pick by video codec
    encoder_tag: str = "Lavf59.27.100"
    trailing_bytes: int = 184_100


@dataclass
class PatchReport:
    applied: list = field(default_factory=list)
    skipped: list = field(default_factory=list)
    notes: list = field(default_factory=list)


def remux(src, dst):
    """Stream-copy the first video + first audio stream into a clean MP4. No re-encode."""
    ff.ffmpeg("-v", "error", "-i", str(src), "-map", "0:v:0", "-map", "0:a:0?", "-c", "copy",
              "-map_metadata", "0", "-movflags", "+faststart", str(dst))


def patch_file(src, dst, opts=None, workdir=None):
    """Remux src (copy mode) then apply the enabled patches, writing dst."""
    opts = opts or PatchOptions()
    unknown = opts.enabled - set(PATCH_IDS)
    if unknown:
        raise ValueError(f"unknown patch id(s): {', '.join(sorted(unknown))}")
    dst = Path(dst)
    tmp = Path(workdir or dst.parent) / f".{dst.stem}.remux.mp4"
    try:
        remux(src, tmp)
        _, top = mp4.read_file(tmp)
        out, report = patch_boxes(top, opts)
    finally:
        tmp.unlink(missing_ok=True)
    dst.write_bytes(out)
    return report


def patch_boxes(top, opts):
    report = PatchReport()
    on = opts.enabled
    if "strip-free" in on:
        top = [b for b in top if b.type not in (b"free", b"skip")]
    ftyp = next((b for b in top if b.type == b"ftyp"), None)
    moov = next((b for b in top if b.type == b"moov"), None)
    mdats = [b for b in top if b.type == b"mdat"]
    if moov is None or len(mdats) != 1:
        raise ValueError("expected exactly one moov and one mdat after remux")
    mdat = mdats[0]
    old_payload_offset = mdat.offset + mdat.header_size

    traks = moov.find_all(b"trak")
    video = next((t for t in traks if mp4.handler_type(t) == b"vide"), None)
    audio = next((t for t in traks if mp4.handler_type(t) == b"soun"), None)
    if video is None:
        raise ValueError("no video track found")

    def mark(pid, ok=True, why=""):
        if pid in on:
            (report.applied if ok else report.skipped).append(pid if ok else f"{pid} ({why})")

    if "zero-times" in on:
        for t in traks:
            _zero_times(t.find(b"tkhd"))
            _zero_times(t.find(b"mdia", b"mdhd"))
        mark("zero-times")

    if "video-elst-plus-one" in on:
        elst = video.find(b"edts", b"elst")
        if elst is not None and u32(elst.payload, 4) > 0:
            p = bytearray(elst.payload)
            if p[0] == 0:
                struct.pack_into(">I", p, 8, u32(p, 8) + 1)
            else:
                struct.pack_into(">Q", p, 8, u64(p, 8) + 1)
            elst.payload = p
            mark("video-elst-plus-one")
        else:
            mark("video-elst-plus-one", False, "video track has no edit list")

    if "decoy-audio" in on:
        if audio is None:
            mark("decoy-audio", False, "source has no audio track - add a (silent) audio track and retry")
        else:
            dummy = opts.dummy_size or DUMMY_SIZE_BY_CODEC.get(mp4.sample_entry_type(video), 8)
            clone, note = _build_decoy(audio, opts.inflate, dummy, len(mdat.payload), old_payload_offset)
            new_id = max(mp4.track_id(t) for t in traks) + 1
            mp4.set_track_id(clone, new_id)
            moov.children.insert(moov.children.index(audio) + 1, clone)
            _set_next_track_id(moov.find(b"mvhd"), new_id + 1)
            report.notes.append(note)
            mark("decoy-audio")

    if "mvhd-unknown-duration" in on:
        mvhd = moov.find(b"mvhd")
        mvhd.payload = _mvhd_v1_unknown_duration(bytes(mvhd.payload))
        mark("mvhd-unknown-duration")

    if "clean-metadata" in on:
        moov.children = [c for c in moov.children if c.type != b"udta"]
        moov.children.append(_minimal_udta(opts.encoder_tag))
        mark("clean-metadata")

    # Layout: ftyp, moov, mdat. Shift chunk offsets so they point at the same bytes.
    head = (ftyp.serialize() if ftyp else b"")
    moov_len = len(moov.serialize())
    mdat_header = 16 if len(mdat.payload) + 8 > 0xFFFFFFFF else 8
    delta = len(head) + moov_len + mdat_header - old_payload_offset
    if delta:
        mp4.shift_chunk_offsets(moov, delta)
    out = bytearray(head)
    out += moov.serialize()
    out += Box(b"mdat", payload=mdat.payload).serialize()
    report.applied.append("faststart")

    if "trailing-pad" in on:
        out += _trailing_pad(opts.trailing_bytes)
        mark("trailing-pad")
    if "strip-free" in on:
        mark("strip-free")
    return bytes(out), report


# --- individual patch helpers ---------------------------------------------

def _zero_times(box):
    if box is None:
        return
    p = bytearray(box.payload)
    if p[0] == 0:
        struct.pack_into(">II", p, 4, 0, 0)
    else:
        struct.pack_into(">QQ", p, 4, 0, 0)
    box.payload = p


def _set_next_track_id(mvhd, value):
    p = bytearray(mvhd.payload)
    struct.pack_into(">I", p, len(p) - 4, value)
    mvhd.payload = p


def _mvhd_v1_unknown_duration(p):
    """Keep every field (rate, volume, matrix, next_track_id); only widen + blank duration.

    The public reference rebuilds mvhd from scratch and writes the matrix at the
    wrong offsets (yielding a non-identity transform). We do not replicate that.
    """
    if p[0] == 0:
        creation, modification, timescale = struct.unpack_from(">III", p, 4)
        rest = p[20:]
    else:
        creation, modification = struct.unpack_from(">QQ", p, 4)
        timescale = u32(p, 20)
        rest = p[32:]
    head = struct.pack(">IQQIQ", 1 << 24, creation, modification, timescale, 0xFFFFFFFFFFFFFFFF)
    return head + rest


def _build_decoy(audio, inflate, dummy_size, mdat_len, mdat_payload_offset):
    """Clone the audio trak and append (inflate-1) x N dummy samples to its tables.

    Dummy samples live in one extra chunk that points at the first real audio
    chunk, so they reference existing bytes (no data is added to mdat).

    Keeps the real track's edit list (`edts`), if any. The public reference
    method drops it on the clone; that's what caused the "duration drift"
    seen in testing (an encoder's priming/padding samples are declared in the
    raw sample table but trimmed from presentation by the edit list - drop
    the edit list on the clone and its implied duration reverts to the
    untrimmed, longer value, which becomes the container's reported max-track
    duration once a second audio track exists). Keeping it costs nothing: the
    dummy samples are appended after the edit list's segment, so real
    playback duration is unaffected either way.
    """
    clone = audio.copy()
    clone.children = [c for c in clone.children if c.type != b"tref"]
    stbl = clone.find(b"mdia", b"minf", b"stbl")
    stsz, stts, stsc = stbl.find(b"stsz"), stbl.find(b"stts"), stbl.find(b"stsc")
    co = stbl.find(b"stco") or stbl.find(b"co64")

    uniform, count = u32(stsz.payload, 4), u32(stsz.payload, 8)
    sizes = [uniform] * count if uniform else list(struct.unpack_from(f">{count}I", stsz.payload, 12))
    extra = count * max(inflate - 1, 0)

    wide = co.type == b"co64"
    n_chunks = u32(co.payload, 4)
    offsets = list(struct.unpack_from(f">{n_chunks}{'Q' if wide else 'I'}", co.payload, 8))
    first = offsets[0]
    # Keep dummy reads inside mdat.
    room = mdat_payload_offset + mdat_len - first
    if extra * dummy_size > room:
        extra = room // dummy_size

    stsc_n = u32(stsc.payload, 4)
    stsc_entries = [struct.unpack_from(">III", stsc.payload, 8 + 12 * i) for i in range(stsc_n)]
    desc_index = stsc_entries[-1][2] if stsc_entries else 1

    stsz.payload = struct.pack(">III", 0, 0, count + extra) + struct.pack(f">{count + extra}I", *sizes, *([dummy_size] * extra))
    stts_n = u32(stts.payload, 4)
    stts.payload = struct.pack(">II", 0, stts_n + 1) + bytes(stts.payload[8:]) + struct.pack(">II", extra, 1)
    stsc.payload = struct.pack(">II", 0, stsc_n + 1) + bytes(stsc.payload[8:]) + struct.pack(">III", n_chunks + 1, extra, desc_index)
    fmt = ">Q" if wide else ">I"
    co.payload = struct.pack(">II", 0, n_chunks + 1) + bytes(co.payload[8:]) + struct.pack(fmt, first)

    hdlr = clone.find(b"mdia", b"hdlr")
    hdlr.payload = bytes(hdlr.payload[:24]) + b"SoundHandler\x00"
    return clone, f"decoy-audio: clone declares {count + extra} samples ({count} real + {extra} x {dummy_size} B dummy)"


def _minimal_udta(encoder):
    hdlr = full_box(b"hdlr", 0, 0, b"\x00" * 4 + b"mdir" + b"appl" + b"\x00" * 8 + b"\x00").serialize()
    items = b""
    if encoder:
        data = Box(b"data", payload=struct.pack(">II", 1, 0) + encoder.encode("utf-8")).serialize()
        items = Box(b"\xa9too", payload=data).serialize()
    ilst = Box(b"ilst", payload=items).serialize()
    meta = full_box(b"meta", 0, 0, hdlr + ilst)
    return Box(b"udta", children=[meta])


def _trailing_pad(size):
    void = b"\x00\x00\x00\x04VOID"
    return void + b"\x00\x00\x00\x04" * max(0, (size - len(void)) // 4)
