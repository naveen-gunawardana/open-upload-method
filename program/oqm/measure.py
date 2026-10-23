"""Stage 3b: measure what TikTok actually served, against your master.

Feed it the file you uploaded and a copy of the published video (screen-record
or download from a second account/device). Numbers beat promo sliders.
"""

import re

from . import ff


def _video(info):
    return next(s for s in info["streams"] if s["codec_type"] == "video")


def unique_fps(path):
    """Frames per second that actually differ from the previous one.

    A "60 fps" file built from duplicated 30 fps frames reports ~30 here.
    """
    proc = ff.ffmpeg("-v", "info", "-i", str(path), "-map", "0:v:0", "-vf", "mpdecimate,showinfo",
                     "-f", "null", "-", check=False)
    kept = len(re.findall(r"\] n:\s*\d+", proc.stderr))
    dur = float(ff.probe(path)["format"].get("duration", 0)) or 1
    return kept / dur


def _compare(master, served, fps, w, h, filt):
    graph = (f"[0:v]fps={fps},scale={w}:{h}:flags=bicubic,setpts=PTS-STARTPTS,format=yuv420p[d];"
             f"[1:v]fps={fps},scale={w}:{h}:flags=bicubic,setpts=PTS-STARTPTS,format=yuv420p[r];[d][r]{filt}")
    return ff.ffmpeg("-v", "info", "-i", str(served), "-i", str(master), "-lavfi", graph,
                     "-f", "null", "-", check=False).stderr


def measure(master, served, vmaf=True):
    mi, si = ff.probe(master), ff.probe(served)
    mv, sv = _video(mi), _video(si)
    m_fps, s_fps = ff.fraction(mv.get("avg_frame_rate")), ff.fraction(sv.get("avg_frame_rate"))
    cmp_fps = min(m_fps, s_fps) or 30
    w, h = mv["width"], mv["height"]

    r = {
        "served_codec": sv.get("codec_name"),
        "served_resolution": f"{sv['width']}x{sv['height']}",
        "served_fps": round(s_fps, 3),
        "served_unique_fps": round(unique_fps(served), 2),
        "served_video_kbps": round(int(sv.get("bit_rate") or si["format"].get("bit_rate") or 0) / 1000),
        "master_fps": round(m_fps, 3),
        "master_unique_fps": round(unique_fps(master), 2),
        "master_video_kbps": round(int(mv.get("bit_rate") or mi["format"].get("bit_rate") or 0) / 1000),
    }
    m = re.search(r"SSIM .*All:([\d.]+)", _compare(master, served, cmp_fps, w, h, "ssim"))
    r["ssim"] = float(m.group(1)) if m else None
    m = re.search(r"PSNR .*average:([\d.]+|inf)", _compare(master, served, cmp_fps, w, h, "psnr"))
    r["psnr_db"] = float(m.group(1)) if m else None
    if vmaf and ff.has_filter("libvmaf"):
        m = re.search(r"VMAF score:\s*([\d.]+)", _compare(master, served, cmp_fps, w, h, "libvmaf"))
        r["vmaf"] = float(m.group(1)) if m else None
    r["passthrough_likely"] = bool(r["ssim"] and r["ssim"] > 0.995 and sv["width"] == w and abs(s_fps - m_fps) < 0.5)
    return r


def print_measure(r):
    rows = [
        ("Served codec / res", f"{r['served_codec']}  {r['served_resolution']}"),
        ("Frame rate (declared)", f"{r['master_fps']} -> {r['served_fps']}"),
        ("Frame rate (unique)", f"{r['master_unique_fps']} -> {r['served_unique_fps']}"),
        ("Video bitrate kbps", f"{r['master_video_kbps']} -> {r['served_video_kbps']}"),
        ("SSIM (1.0 = identical)", r["ssim"]),
        ("PSNR dB (higher = closer)", r["psnr_db"]),
        ("VMAF (0-100)", r.get("vmaf", "n/a")),
        ("Looks like passthrough?", "yes" if r["passthrough_likely"] else "no - TikTok re-encoded it"),
    ]
    for k, v in rows:
        print(f"  {k:<28} {v}")
    print("\n  Alignment matters: trim nothing, and compare the same clip. Offsets lower every score.")
