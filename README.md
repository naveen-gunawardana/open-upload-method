# Open Quality Method (OQM) v1

A free, open, **testable** upload-quality workflow for TikTok editors.

Paid "upload methods" sell three things bundled together: export settings, an MP4 file patch, and sometimes an upload-request tweak. They rarely say which part does the work, and they back their claims with promo sliders. OQM unbundles them, does each one in the open, and gives you the tools to measure whether any of it works on *your* account.

> **Honest status:** OQM reproduces the publicly documented patch techniques. It proves locally that your video and audio are bit-for-bit unchanged. It **cannot** promise that TikTok will skip re-encoding. Nobody can, because that happens on TikTok's servers and changes without notice. That's why measuring is built into the method.

## The method in 3 stages

```
 1. EXPORT   one clean master encode          oqm export
 2. PATCH    container-only changes, no re-encode    oqm patch   (+ oqm verify, automatic)
 3. MEASURE  compare what TikTok served to your master    oqm measure / oqm abtest
```

| Stage | Touches pixels? | What it does |
|---|---|---|
| Export | **Yes, once** | H.264 High (or H.265), CRF 17, BT.709 colour tags, keyframe every 2 s, AAC 320k, faststart. Optional constant frame rate and 1080x1920 fit. |
| Patch | **Never** | Stream-copies your master, then edits only the MP4 structure: decoy audio track, timing boxes, metadata, padding. Each change is a separate toggle. |
| Verify | No | Hashes the compressed video, decoded pixels and primary audio before and after. If anything real changed, it fails. |
| Measure | No | SSIM / PSNR / VMAF, served resolution, bitrate, and **unique** frame rate of TikTok's delivered copy vs your master. |

## Install

Requirements: Python 3.10+, FFmpeg (`ffmpeg` and `ffprobe` on PATH). No other dependencies.

```bash
git clone <this repo> && cd open-quality-method
pip install -e .        # gives you the `oqm` command
# or run without installing: python -m oqm ...
```

## Quick start

```bash
oqm export edit.mov master.mp4 --fps 60 --fit 1080x1920   # stage 1
oqm patch master.mp4                                        # stage 2 -> master_oqm.mp4, auto-verified
# upload master_oqm.mp4, then grab the published copy from another account/device
oqm measure master.mp4 tiktok_copy.mp4                      # stage 3
```

For a real answer rather than one lucky upload, build an A/B kit:

```bash
oqm abtest master.mp4
```

This writes four variants (control, full method, decoy-only, structure-only) and a `RESULTS.csv` to fill in. See [docs/TEST-PROTOCOL.md](docs/TEST-PROTOCOL.md).

## All commands

| Command | Purpose |
|---|---|
| `oqm export IN OUT [--codec h264\|h265] [--crf 17] [--fps 60] [--fit 1080x1920]` | Make the master |
| `oqm patch IN [-o OUT] [--profile reference\|minimal\|none] [--enable/--disable PATCH...]` | Container patch + verify |
| `oqm verify ORIGINAL PATCHED` | Prove nothing real changed |
| `oqm measure MASTER SERVED [--json]` | Score TikTok's delivered copy |
| `oqm abtest IN [--out DIR]` | Four-arm test kit + results sheet |
| `oqm inspect FILE` | Box tree, declared vs decoded frame counts |
| `oqm patches` | Every patch, where it comes from, and how much evidence backs it |
| `oqm testcard OUT [--fps 60]` | Synthetic clip that makes compression easy to see |

## What's in the box

- [docs/METHOD.md](docs/METHOD.md): the full method, with each patch explained down to the byte.
- [docs/TEST-PROTOCOL.md](docs/TEST-PROTOCOL.md): how to run a fair upload test.
- [docs/LANDSCAPE.md](docs/LANDSCAPE.md): what the paid and free methods actually do, and what we found reading their code.
- [CONTRIBUTING.md](CONTRIBUTING.md): how to submit results so v2 is built on data.

## What v1 deliberately does not do

- **No browser upload-request rewriting** (the Kuronai/WizardFTB-style extension layer). It means intercepting TikTok's own web requests, it breaks whenever their site changes, and it's the riskiest part for your account. It's documented in LANDSCAPE.md so you understand it. It's left out until there's evidence it's worth the risk.
- **No frame interpolation.** Fake-smooth 60 fps is a creative choice, not a quality fix. `measure` reports *unique* fps so duplicated or padded frames can't pass as real ones.
- **No branding, no watermark, no promo injection.** Some tools quietly add their name to your metadata or captions. OQM writes one neutral encoder tag, or nothing if you disable `clean-metadata`.

## Risks

These patches make deliberately unusual files. Firsthand reports on other tools include uploads stuck on private, sound problems, and zero-view posts. None of these is proven to be caused by patching, but none is ruled out either. **Test on a secondary account first.** OQM is not affiliated with TikTok. Using it may conflict with TikTok's terms, and that call is yours.

## Credits

The patch techniques were documented by public open-source work, notably [buwryme/tiktok-lossless-upload](https://github.com/buwryme/tiktok-lossless-upload) (MIT) and the NoBlur family of patchers. OQM is an independent implementation. It differs in a few places where we found bugs (see LANDSCAPE.md).

License: MIT.
