"""Stage 1: one clean, high-quality master export.

This is the only stage that encodes. Whatever TikTok does next, it starts
from this file, so it should be the best encode you will make.
"""

import sys
from pathlib import Path

from . import ff

_VARGS = {
    "h264": ["-c:v", "libx264", "-preset", "slow", "-profile:v", "high",
             "-pix_fmt", "yuv420p"],
    "h265": ["-c:v", "libx265", "-preset", "slow", "-pix_fmt", "yuv420p", "-tag:v", "hvc1"],
}
_NULL = "NUL" if sys.platform == "win32" else "/dev/null"


def export(src, dst, codec="h264", crf=17, kbps=None, fps=None, fit=None, audio_bitrate="320k",
           no_bframes=False, long_gop=False, baseline=False):
    """kbps set: two-pass, target that exact average video bitrate. kbps unset: single-pass CRF."""
    if codec not in _VARGS:
        raise ValueError("codec must be h264 or h265")
    info = ff.probe(src)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    if v.get("color_transfer") in {"smpte2084", "arib-std-b67"} or v.get("color_primaries") == "bt2020":
        raise ValueError("HDR/wide-gamut export needs an explicit colour conversion. Use an SDR master or stream-copy; HDR testing is separate.")
    out_fps = fps or ff.fraction(v.get("avg_frame_rate") or v.get("r_frame_rate")) or 30
    gop = max(1, round(out_fps * 2))  # keyframe every ~2 s: seekable, streamable

    filters = []
    if fit:
        w, h = fit.lower().split("x")
        filters.append(f"scale={w}:{h}:force_original_aspect_ratio=decrease:flags=lanczos,"
                       f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1")
    if fps:
        filters.append(f"fps={fps}")  # constant frame rate; duplicates/drops frames, does NOT interpolate

    vargs = list(_VARGS[codec])
    if long_gop:
        gop = 9999
    if codec == "h265":
        vargs += ["-x265-params", f"log-level=error:keyint={gop}:min-keyint={gop}" + (":bframes=0" if no_bframes else "")]
    else:
        if baseline:  # Constrained Baseline: no B-frames, no CABAC; level left to the encoder
            i = vargs.index("-profile:v"); vargs[i + 1] = "baseline"
        vargs += ["-g", str(gop), "-keyint_min", str(min(gop, round(out_fps * 2)))]
        if no_bframes:
            vargs += ["-bf", "0"]

    args = ["-v", "error", "-i", str(src), "-map", "0:v:0", "-map", "0:a:0?"]
    if filters:
        args += ["-vf", ",".join(filters)]
    if fps:
        args += ["-fps_mode", "cfr"]
    # Tag BT.709 explicitly - untagged files are a common cause of washed-out colour on phones.
    color = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"]
    audio = ["-c:a", "aac", "-b:a", audio_bitrate, "-ar", "48000", "-movflags", "+faststart", "-map_metadata", "-1"]

    if kbps:
        rate = ["-b:v", f"{kbps}k", "-maxrate", f"{round(kbps * 1.5)}k", "-bufsize", f"{kbps * 2}k"]
        passlog = str(Path(dst).with_suffix("")) + ".oqmpass"
        try:
            ff.ffmpeg(*args, *vargs, *rate, "-pass", "1", "-passlogfile", passlog, "-an", "-f", "null", _NULL)
            ff.ffmpeg(*args, *vargs, *rate, "-pass", "2", "-passlogfile", passlog, *color, *audio, str(dst))
        finally:
            for ext in (".log", ".log.mbtree"):
                Path(passlog + ext).unlink(missing_ok=True)
    else:
        ff.ffmpeg(*args, *vargs, "-crf", str(crf), *color, *audio, str(dst))
    return {"codec": codec, "crf": None if kbps else crf, "kbps": kbps, "fps": out_fps, "gop": gop, "fit": fit}
