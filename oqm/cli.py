"""oqm - Open Quality Method command line."""

import argparse
import json
import sys
from pathlib import Path

from . import __version__, abtest, export, ff, measure, mp4, patches, testcard, verify


def cmd_export(a):
    info = export.export(a.input, a.output, codec=a.codec, crf=a.crf, fps=a.fps, fit=a.fit)
    print(f"  master written: {a.output}  ({info['codec']} crf {info['crf']}, {info['fps']:g} fps, keyframe every {info['gop']} frames)")


def cmd_patch(a):
    enabled = set(patches.PROFILES[a.profile])
    enabled |= set(a.enable or [])
    enabled -= set(a.disable or [])
    out = a.output or str(Path(a.input).with_name(f"{Path(a.input).stem}_oqm.mp4"))
    opts = patches.PatchOptions(enabled=enabled, inflate=a.inflate, dummy_size=a.dummy_size,
                                encoder_tag=a.encoder_tag, trailing_bytes=a.trailing_bytes)
    report = patches.patch_file(a.input, out, opts)
    print(f"  patched: {out}")
    print(f"  applied: {', '.join(report.applied)}")
    for s in report.skipped:
        print(f"  skipped: {s}")
    for n in report.notes:
        print(f"  note:    {n}")
    if not a.no_verify:
        print()
        return 0 if verify.print_checks(verify.verify(a.input, out)) else 1


def cmd_verify(a):
    return 0 if verify.print_checks(verify.verify(a.original, a.patched)) else 1


def cmd_measure(a):
    r = measure.measure(a.master, a.served, vmaf=not a.no_vmaf)
    if a.json:
        print(json.dumps(r, indent=2))
    else:
        measure.print_measure(r)


def cmd_abtest(a):
    out = a.out or str(Path(a.input).with_name(f"{Path(a.input).stem}_abtest"))
    ok, _ = abtest.build(a.input, out)
    print(f"\n  kit: {out}\n  next: upload each variant (see docs/TEST-PROTOCOL.md), then fill RESULTS.csv")
    return 0 if ok else 1


def cmd_inspect(a):
    _, top = mp4.read_file(a.input)
    print("\n".join(mp4.tree(top)))
    info = ff.probe(a.input, count_frames=True)
    print()
    for s in info["streams"]:
        line = f"  #{s['index']} {s['codec_type']:<6} {s.get('codec_name', '?')}"
        if s["codec_type"] == "video":
            line += (f" {s['width']}x{s['height']} {s.get('pix_fmt')} avg {ff.fraction(s.get('avg_frame_rate')):.3f} fps"
                     f" declared {s.get('nb_frames')} / decoded {s.get('nb_read_frames')} frames")
        else:
            line += f" {s.get('sample_rate')} Hz declared {s.get('nb_frames')} / decoded {s.get('nb_read_frames')} packets"
        print(line)


def cmd_patches(_):
    for p in patches.CATALOG:
        profiles = [n for n, ids in patches.PROFILES.items() if p.id in ids]
        print(f"  {p.id}\n    what:     {p.summary}\n    seen in:  {p.seen_in}\n"
              f"    evidence: {p.evidence}\n    profiles: {', '.join(profiles)}\n")


def cmd_testcard(a):
    testcard.make(a.output, fps=a.fps, seconds=a.seconds)
    print(f"  test card written: {a.output}")


def cmd_ui(a):
    from . import server
    server.serve(a.workspace, port=a.port, open_browser=not a.no_browser)


def main(argv=None):
    p = argparse.ArgumentParser(prog="oqm", description="Open Quality Method - export, patch, verify, measure.")
    p.add_argument("--version", action="version", version=f"oqm {__version__}")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("export", help="Stage 1: make one clean master encode")
    s.add_argument("input"); s.add_argument("output")
    s.add_argument("--codec", choices=["h264", "h265"], default="h264")
    s.add_argument("--crf", type=int, default=17)
    s.add_argument("--fps", type=float, help="force constant frame rate (no interpolation)")
    s.add_argument("--fit", help="scale+pad to WxH, e.g. 1080x1920")
    s.set_defaults(fn=cmd_export)

    s = sub.add_parser("patch", help="Stage 2: container patch, never re-encodes")
    s.add_argument("input"); s.add_argument("-o", "--output")
    s.add_argument("--profile", choices=list(patches.PROFILES), default="reference")
    s.add_argument("--enable", nargs="+", choices=patches.PATCH_IDS, metavar="PATCH")
    s.add_argument("--disable", nargs="+", choices=patches.PATCH_IDS, metavar="PATCH")
    s.add_argument("--inflate", type=int, default=10, help="decoy sample multiplier (default 10)")
    s.add_argument("--dummy-size", type=int, help="bytes per decoy sample (default: by video codec)")
    s.add_argument("--encoder-tag", default="Lavf59.27.100")
    s.add_argument("--trailing-bytes", type=int, default=184_100)
    s.add_argument("--no-verify", action="store_true")
    s.set_defaults(fn=cmd_patch)

    s = sub.add_parser("verify", help="Stage 3a: prove the patched file is the same video")
    s.add_argument("original"); s.add_argument("patched")
    s.set_defaults(fn=cmd_verify)

    s = sub.add_parser("measure", help="Stage 3b: score what TikTok served vs your master")
    s.add_argument("master"); s.add_argument("served")
    s.add_argument("--no-vmaf", action="store_true"); s.add_argument("--json", action="store_true")
    s.set_defaults(fn=cmd_measure)

    s = sub.add_parser("abtest", help="Build a 4-arm A/B upload kit + results sheet")
    s.add_argument("input"); s.add_argument("--out")
    s.set_defaults(fn=cmd_abtest)

    s = sub.add_parser("inspect", help="Show box tree and declared-vs-decoded counts")
    s.add_argument("input")
    s.set_defaults(fn=cmd_inspect)

    s = sub.add_parser("patches", help="List every patch, where it comes from, and its evidence level")
    s.set_defaults(fn=cmd_patches)

    s = sub.add_parser("testcard", help="Generate a measurement clip (detail, motion, gradients)")
    s.add_argument("output"); s.add_argument("--fps", type=int, default=60); s.add_argument("--seconds", type=int, default=10)
    s.set_defaults(fn=cmd_testcard)

    s = sub.add_parser("ui", help="Open the local web interface")
    s.add_argument("--workspace", default=str(Path.home() / "OQM-workspace"), help="folder for all files (default ~/OQM-workspace)")
    s.add_argument("--port", type=int, default=8765)
    s.add_argument("--no-browser", action="store_true")
    s.set_defaults(fn=cmd_ui)

    a = p.parse_args(argv)
    if a.cmd == "ui":
        return a.fn(a) or 0  # the UI reports a missing FFmpeg itself
    try:
        ff.require()
        return a.fn(a) or 0
    except (ff.FFmpegError, ValueError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
