"""Stage 3a: prove a patched file is the same video, locally, before uploading."""

from dataclasses import dataclass

from . import ff


@dataclass
class Check:
    name: str
    ok: bool
    detail: str
    warn: bool = False  # known, expected side effect - not a reason to stop


def _streams(info, kind):
    return [s for s in info["streams"] if s["codec_type"] == kind]


def verify(src, out):
    a, b = ff.probe(src, count_frames=True), ff.probe(out, count_frames=True)
    checks = []

    va, vb = ff.stream_hash(src, "v:0"), ff.stream_hash(out, "v:0")
    checks.append(Check("video bitstream identical", va is not None and va == vb,
                        "packet SHA-256 match" if va == vb else f"{(va or '?')[:12]} != {(vb or '?')[:12]}"))

    da, db = ff.decoded_hash(src), ff.decoded_hash(out)
    checks.append(Check("decoded frames identical", da is not None and da == db,
                        "pixel SHA-256 match" if da == db else "decoded pixels differ"))

    sa, sb = _streams(a, "video")[0], _streams(b, "video")[0]
    fa, fb = sa.get("nb_read_frames"), sb.get("nb_read_frames")
    checks.append(Check("frame count unchanged", fa == fb, f"{fa} -> {fb}"))

    ra, rb = ff.fraction(sa.get("avg_frame_rate")), ff.fraction(sb.get("avg_frame_rate"))
    checks.append(Check("frame rate unchanged", abs(ra - rb) < 0.01, f"{ra:.3f} -> {rb:.3f} fps"))

    if _streams(a, "audio"):
        ha, hb = ff.stream_hash(src, "a:0"), ff.stream_hash(out, "a:0")
        checks.append(Check("primary audio identical", ha == hb, "packet SHA-256 match" if ha == hb else "audio differs"))

    has_decoy = len(_streams(b, "audio")) > len(_streams(a, "audio"))
    dur_a, dur_b = float(a["format"].get("duration", 0)), float(b["format"].get("duration", 0))
    frame = 1 / ra if ra else 0.05
    vdur_a, vdur_b = float(sa.get("duration", 0)), float(sb.get("duration", 0))
    checks.append(Check("video duration within 1 frame", abs(vdur_a - vdur_b) <= frame + 1e-3,
                        f"{vdur_a:.3f}s -> {vdur_b:.3f}s"))
    if abs(dur_a - dur_b) > frame + 1e-3:
        checks.append(Check("container duration", False, f"{dur_a:.3f}s -> {dur_b:.3f}s"
                            + (" (decoy track's dummy samples extend it)" if has_decoy else ""), warn=has_decoy))

    primary = ["v:0"] + (["a:0"] if _streams(a, "audio") else [])
    errors = "\n".join(e for e in (ff.decode_errors(out, spec) for spec in primary) if e)
    checks.append(Check("video + primary audio decode clean", not errors,
                        "clean" if not errors else errors.splitlines()[0][:120]))
    if has_decoy:
        decoy = ff.decode_errors(out, "a:1")
        checks.append(Check("decoy track decodes", not decoy,
                            "clean" if not decoy else "errors (expected: dummy samples are not real audio)", warn=True))

    tracks = f"{len(_streams(a, 'video'))}v/{len(_streams(a, 'audio'))}a -> {len(_streams(b, 'video'))}v/{len(_streams(b, 'audio'))}a"
    checks.append(Check("track layout", True, tracks))
    return checks


def print_checks(checks):
    for c in checks:
        tag = "PASS" if c.ok else ("WARN" if c.warn else "FAIL")
        print(f"  [{tag}] {c.name:<34} {c.detail}")
    hard = [c for c in checks if not c.ok and not c.warn]
    print(f"\n  {'OK: safe to upload' if not hard else f'{len(hard)} check(s) failed - read before uploading'}")
    return not hard
