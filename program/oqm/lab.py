"""Lab mode (OQM_LAB=1): build the same clip several different ways so they can be A/B tested on TikTok.

Not part of the shipped app flow. Each variant changes one thing relative to the "current" recipe.
"""

from dataclasses import asdict

from . import export, patches, verify

FULL = set(patches.PROFILES["reference"])

VARIANTS = [
    dict(id="current", title="1. Current recipe", reencode=True, enc={}, patches=FULL,
         desc="Clean H.264 re-encode (CRF 17) + full patch set. What the app does today."),
    dict(id="noreencode", title="2. No re-encode", reencode=False, enc={}, patches=FULL,
         desc="Your original file's video and audio are kept as they are; only the container is patched."),
    dict(id="nobframes", title="3. No B-frames, long keyframe gap", reencode=True, enc=dict(no_bframes=True, long_gop=True),
         patches=FULL, desc="Re-encode like the public reference tool does (no B-frames, keyframes ~never) + full patch set."),
    dict(id="videodecoy", title="4. Full patch + video decoy", reencode=True, enc={}, patches=FULL | {"decoy-video"},
         desc="Current recipe plus a hidden decoy VIDEO track (the NoBlur idea). Experimental."),
    dict(id="baseline", title="5. Constrained Baseline encode", reencode=True, enc=dict(baseline=True, long_gop=True),
         patches=FULL, desc="Baseline-profile H.264 (CompressBase-style) + full patch set. Lower efficiency, so a bigger file."),
    dict(id="control", title="6. Control: no patch", reencode=True, enc={}, patches={"faststart"},
         desc="Same re-encode as #1, container left normal. If this behaves like the others, the patch isn't doing anything."),
]
BY_ID = {v["id"]: v for v in VARIANTS}


def run(app, p, job):
    v = BY_ID[p["variant"]]
    src = app.src(p["input"])
    out = app.unique_path(f"{src.stem}_lab-{v['id']}.mp4")
    tmp = app.ws / f".{out.stem}.intermediate.mp4"
    base, info, done = src, None, False
    try:
        if v["reencode"]:
            job["stage"] = f"{v['title']}: re-encoding"
            info = export.export(src, tmp, codec="h264", crf=17, **v["enc"])
            base = tmp
        job["stage"] = f"{v['title']}: patching and checking"
        report = patches.patch_file(base, out, patches.PatchOptions(enabled=set(v["patches"])))
        checks = verify.verify(base, out)
        done = True
    finally:
        tmp.unlink(missing_ok=True)
    return {"variant": v["id"], "title": v["title"], "output": app.rel(out), "size": out.stat().st_size,
            "export": info, "applied": report.applied, "skipped": report.skipped, "notes": report.notes,
            "checks": [asdict(c) for c in checks], "ok": done and all(c.ok or c.warn for c in checks)}
