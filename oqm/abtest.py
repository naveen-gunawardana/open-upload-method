"""Build a controlled A/B upload kit from one master file."""

import csv
import hashlib
from pathlib import Path

from . import patches, verify

VARIANTS = [
    ("A_control", "none", "Same bitstream, normal layout. The baseline every other arm is judged against."),
    ("B_reference", "reference", "Full public reference method (copy mode), unbranded."),
    ("C_decoy_only", "minimal", "Only the decoy audio track. Tests the claimed trigger in isolation."),
    ("D_structure_only", "structure", "Every patch except the decoy track. Tests whether the decoy matters."),
]

COLUMNS = ["variant", "file", "sha256", "patches", "upload_date", "account", "upload_route",
           "posted_public_or_private_first", "post_url", "served_resolution", "served_fps",
           "served_unique_fps", "ssim", "psnr_db", "vmaf", "views_24h", "playback_issues",
           "loops_normally", "guideline_flag", "flag_reason", "appeal_result", "notes"]


def build(master, out_dir, log=print):
    """Write the four variants + RESULTS.csv. Returns (all_verified, rows)."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = Path(master).stem
    rows, all_ok = [], True
    for name, profile, why in VARIANTS:
        dst = out_dir / f"{stem}_{name}.mp4"
        report = patches.patch_file(master, dst, patches.PatchOptions(enabled=set(patches.PROFILES[profile])))
        checks = verify.verify(master, dst)
        ok = all(c.ok or c.warn for c in checks)
        all_ok &= ok
        log(f"  {name:<18} {'verified' if ok else 'VERIFY FAILED'}  [{', '.join(report.applied)}]")
        rows.append({"variant": name, "file": dst.name, "sha256": hashlib.sha256(dst.read_bytes()).hexdigest()[:16],
                     "patches": " ".join(report.applied), "notes": why, "verified": ok})
    with open(out_dir / "RESULTS.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, "") for c in COLUMNS})
    return all_ok, rows
