"""Thin wrappers around the ffmpeg / ffprobe executables."""

import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path


class FFmpegError(RuntimeError):
    pass


def _find(name):
    """The FFmpeg bundled inside the packaged app if there is one, else whatever is on PATH."""
    exe = name + (".exe" if os.name == "nt" else "")
    bundled = Path(getattr(sys, "_MEIPASS", "")) / "bin" / exe
    if getattr(sys, "_MEIPASS", None) and bundled.is_file():
        return str(bundled)
    return shutil.which(name)


def require():
    for exe in ("ffmpeg", "ffprobe"):
        if not _find(exe):
            raise FFmpegError(f"{exe} not found on PATH. Install FFmpeg first: https://ffmpeg.org/download.html")


def run(args, check=True):
    proc = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if check and proc.returncode != 0:
        raise FFmpegError(f"{' '.join(args[:3])} ... failed:\n{proc.stderr[-1500:]}")
    return proc


def ffmpeg(*args, check=True):
    return run([_find("ffmpeg") or "ffmpeg", "-hide_banner", "-nostdin", "-y", *args], check=check)


def probe(path, count_frames=False):
    args = [_find("ffprobe") or "ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json"]
    if count_frames:
        args.append("-count_frames")
    return json.loads(run([*args, str(path)]).stdout)


def fraction(s):
    try:
        num, den = s.split("/")
        return float(num) / float(den) if float(den) else 0.0
    except (ValueError, AttributeError):
        return 0.0


def stream_hash(path, spec):
    """SHA-256 of a stream's compressed packets (no decoding). None if absent."""
    proc = ffmpeg("-v", "error", "-i", str(path), "-map", f"0:{spec}", "-c", "copy",
                  "-f", "hash", "-hash", "sha256", "-", check=False)
    m = re.search(r"SHA256=([0-9a-f]+)", proc.stdout)
    return m.group(1) if m else None


def decoded_hash(path, spec="v:0"):
    """SHA-256 of decoded frames - catches changes the packet hash would hide."""
    proc = ffmpeg("-v", "error", "-i", str(path), "-map", f"0:{spec}", "-f", "hash", "-hash", "sha256", "-", check=False)
    m = re.search(r"SHA256=([0-9a-f]+)", proc.stdout)
    return m.group(1) if m else None


def decode_errors(path, spec=None):
    """Full decode of one stream (or all); returns ffmpeg's error output (empty = clean)."""
    proc = ffmpeg("-v", "error", "-i", str(path), "-map", f"0:{spec}" if spec else "0", "-f", "null", "-", check=False)
    return proc.stderr.strip()


def has_filter(name):
    return re.search(rf"\s{re.escape(name)}\s", run([_find("ffmpeg") or "ffmpeg", "-hide_banner", "-filters"]).stdout) is not None
