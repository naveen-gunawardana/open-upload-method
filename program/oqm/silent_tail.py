"""Opt-in silent-tail wrapper and explicit checks for its intentional audio change."""
import hashlib
import json
import itertools
import math
import struct
from pathlib import Path

from . import ff, mp4
from ._silent_tail_reference import patch_bytes_slsr


def patch(src, dst):
    if not __debug__:
        raise ValueError("Silent-tail requires Python assertions enabled (do not use -O).")
    try:
        result = patch_bytes_slsr(Path(src).read_bytes())
    except (AssertionError, struct.error, IndexError, KeyError, OverflowError) as e:
        raise ValueError("Silent-tail requires a clean, unfragmented MP4 with one video and one AAC-LC stereo track.") from e
    Path(dst).write_bytes(result)


def _packets(path):
    return json.loads(ff.run([ff._find("ffprobe") or "ffprobe", "-v", "error", "-select_streams", "a:0",
                              "-show_packets", "-show_data_hash", "sha256", "-show_entries",
                              "packet=data_hash,size", "-of", "json", str(path)]).stdout)["packets"]


def audio_tail_check(src, out):
    a, b = _packets(src), _packets(out)
    tail = b[len(a):]
    silent_hash = "SHA256:" + hashlib.sha256(bytes([33, 16, 4, 96, 140, 28])).hexdigest()
    audio = next(s for s in ff.probe(src)["streams"] if s["codec_type"] == "audio")
    rate = int(audio["sample_rate"])
    count = max(10, math.ceil(0.35 * rate / 1024))
    def timing(path):
        _, boxes = mp4.read_file(path)
        root = next(b for b in boxes if b.type == b"moov")
        track = next(t for t in root.find_all(b"trak") if mp4.handler_type(t) == b"soun")
        header = track.find(b"mdia", b"mdhd").payload
        scale = mp4.u32(header, 20 if header[0] == 1 else 12)
        data = track.find(b"mdia", b"minf", b"stbl", b"stts").payload
        return scale, itertools.chain.from_iterable(itertools.repeat(mp4.u32(data, at + 4), mp4.u32(data, at))
                                                    for at in range(8, len(data), 8))
    scale, original = timing(src)
    out_scale, actual = timing(out)
    expected = itertools.chain(original, (math.floor((i + 1) * 1024 * scale / rate) - math.floor(i * 1024 * scale / rate)
                                          for i in range(count)))
    timing_ok = scale == out_scale and all(x == y for x, y in itertools.zip_longest(expected, actual))
    ok = bool(a and b[:len(a)] == a and len(tail) == count and timing_ok and
              all(p.get("data_hash") == silent_hash and int(p.get("size", 0)) == 6 for p in tail))
    return ok, f"{len(a)} original packets; {len(tail)} appended AAC silence packets (intentional audio change)"
