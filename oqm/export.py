"""Stage 1: one clean, high-quality master export.

This is the only stage that encodes. Whatever TikTok does next, it starts
from this file, so it should be the best encode you will make.
"""

from . import ff


def export(src, dst, codec="h264", crf=17, fps=None, fit=None, audio_bitrate="320k"):
    info = ff.probe(src)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    out_fps = fps or ff.fraction(v.get("avg_frame_rate") or v.get("r_frame_rate")) or 30
    gop = max(1, round(out_fps * 2))  # keyframe every ~2 s: seekable, streamable

    filters = []
    if fit:
        w, h = fit.lower().split("x")
        filters.append(f"scale={w}:{h}:force_original_aspect_ratio=decrease:flags=lanczos,"
                       f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1")
    if fps:
        filters.append(f"fps={fps}")  # constant frame rate; duplicates/drops frames, does NOT interpolate

    if codec == "h264":
        vargs = ["-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-profile:v", "high",
                 "-level:v", "4.2", "-pix_fmt", "yuv420p", "-g", str(gop), "-keyint_min", str(gop)]
    elif codec == "h265":
        vargs = ["-c:v", "libx265", "-preset", "slow", "-crf", str(crf), "-pix_fmt", "yuv420p",
                 "-tag:v", "hvc1", "-x265-params", f"log-level=error:keyint={gop}:min-keyint={gop}"]
    else:
        raise ValueError("codec must be h264 or h265")

    args = ["-v", "error", "-i", str(src), "-map", "0:v:0", "-map", "0:a:0?"]
    if filters:
        args += ["-vf", ",".join(filters)]
    if fps:
        args += ["-fps_mode", "cfr"]
    args += vargs
    # Tag BT.709 explicitly - untagged files are a common cause of washed-out colour on phones.
    args += ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"]
    args += ["-c:a", "aac", "-b:a", audio_bitrate, "-ar", "48000",
             "-movflags", "+faststart", "-map_metadata", "-1", str(dst)]
    ff.ffmpeg(*args)
    return {"codec": codec, "crf": crf, "fps": out_fps, "gop": gop, "fit": fit}
