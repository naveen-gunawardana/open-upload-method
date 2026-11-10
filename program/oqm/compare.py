"""Build three local variants from exactly one encoded SDR source. Never uploads."""
import csv
import json
from pathlib import Path

from . import ff, mp4, patches, silent_tail, verify


def build(src, directory):
    info = ff.probe(src)
    video = next(s for s in info["streams"] if s["codec_type"] == "video")
    if video.get("color_transfer") in {"smpte2084", "arib-std-b67"} or video.get("color_primaries") == "bt2020":
        raise ValueError("Use an SDR master. HDR belongs in a separate experiment.")
    audio = [s for s in info["streams"] if s["codec_type"] == "audio"]
    if not audio or audio[0].get("codec_name") != "aac" or audio[0].get("profile") != "LC" or audio[0].get("channels") != 2:
        raise ValueError("The three-arm comparison needs AAC-LC stereo audio. Export one clean master first.")
    out = Path(directory)
    out.mkdir(parents=True, exist_ok=True)
    names = ["A_clean.mp4", "B_current.mp4", "C_silent_tail.mp4"]
    if any((out / n).exists() for n in [*names, "manifest.json", "retention.csv"]):
        raise ValueError("Choose a fresh comparison directory; existing results will not be overwritten.")
    clean = out / names[0]
    ff.ffmpeg("-v", "error", "-i", str(src), "-map", "0:v:0", "-map", "0:a:0?", "-c", "copy",
              "-movflags", "+faststart", str(clean))
    source_checks = verify.verify(src, clean)
    if any(not c.ok and not c.warn for c in source_checks):
        raise ValueError("Clean MP4 failed source-integrity checks; comparison stopped.")
    _, boxes = mp4.read_file(clean)
    patched, _ = patches.patch_boxes(boxes, patches.PatchOptions(enabled=patches.PROFILES["reference"]))
    (out / names[1]).write_bytes(patched)
    silent_tail.patch(clean, out / names[2])
    results = []
    for name in names:
        path = out / name
        checks = verify.verify(clean, path, silent_tail=name == names[2])
        metadata = ff.probe(path)
        v = next(s for s in metadata["streams"] if s["codec_type"] == "video")
        results.append({"file": name, "local_pass": all(c.ok or c.warn for c in checks),
                        "checks": [vars(c) for c in checks], "video_sha256": ff.stream_hash(path, "v:0"),
                        "resolution": [v["width"], v["height"]],
                        "fps": ff.fraction(v.get("avg_frame_rate"))})
    manifest = {"source": str(Path(src).resolve()), "reencoded": False,
                "comparison_reference": names[0], "source_integrity_checks": [vars(c) for c in source_checks],
                "scope": "Local integrity only. No TikTok upload, compression or retention result.",
                "stage": "Start with 1080p60 SDR; test 4K, 120 fps and HDR in separate rounds.",
                "results": results}
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    with (out / "retention.csv").open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["file", "post_url", "uploaded_at_utc", "checkpoint", "observed_at_utc", "device_account",
                         "rendition_id", "width", "height", "fps_reported", "fps_decoded", "video_bps", "notes"])
        for name in names:
            for checkpoint in ["after_processing", "24h", "72h", "7d"]:
                for context in ["desktop", "second_phone_account"]:
                    writer.writerow([name, "", "", checkpoint, "", context, "", "", "", "", "", "", "pending"])
    return all(r["local_pass"] for r in results), manifest
