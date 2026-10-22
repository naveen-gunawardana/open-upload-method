# The upload-method landscape (research behind v1)

This is a snapshot, not an endorsement. Claims below are the providers' own unless marked as verified.

## What "upload method" means

The label covers three different things, often sold together:

| Type | What it really is | Evidence |
|---|---|---|
| Export / settings guides | Render, HandBrake, sometimes Topaz settings | Real settings; no proof of any compression bypass. At least one seller says results aren't guaranteed. |
| Ads Manager methods | Uploading through TikTok's ad tools | The tools are real. TikTok's documentation doesn't say they give better organic quality. |
| Patchers / "injection" | MP4 structure changes, sometimes plus browser request changes | Real, inspectable changes. Whether TikTok skips processing because of them is unverified and changes over time. |

## Known tools (as publicly described)

| Tool | Disclosed approach | Free vs paid |
|---|---|---|
| Kuronai | File patch, optional "Encode Video", browser extension that rewrites upload request fields, "Enhanced" mobile workflow | Paid; Enhanced is undisclosed |
| Editing News / Editing Enhancer | Standard / HQ / Enhanced, "proprietary" processing | Free: 3 uploads/week, 50 MB. Public repo has no extension code. |
| Kryp | Edit-list and metadata patching, upload injection, separate interpolation | Free with watermark/key limits |
| Kay x Kaz | Local browser patching, algorithm undisclosed | 3 full-quality patches per 30 days free; paid = unlimited (same patch) |
| CompressBase | Local processing, selectable methods; a third-party re-implementation uses Constrained Baseline H.264 plus a dual-AAC inflated decoy | Advertises 5 free uses per device per day |
| buwryme/tiktok-lossless-upload | Open source: re-encode (default) + decoy audio + timing/metadata patches | Free, MIT |
| NoBlur family | Open source: inflate the **video** sample table with dummy entries | Free |
| WizardFTB | Open source extension: hooks `fetch` / `XMLHttpRequest` / `JSON.stringify`, plus a local MP4 patch | Free; **adds its creator's promo to your captions** |

What payment buys: more uses, support, updates, convenience. No paid tool has published a controlled comparison showing a better patch than the free ones.

## The browser layer (not in OQM v1)

Kuronai's public extension config rewrites the web upload request:

| Field | Change |
|---|---|
| `draft`, `canvas_config`, `vedit_segment_info`, `vedit_project`, `edit_common_info` | removed |
| `cloud_edit_is_use_video_canvas` | `false` |
| `post_type` | `3` |
| `vedit_common_info`, `feature_common_info_list` | nested clean-up |

Our reading: these strip the web editor's "re-render this" instructions so the server doesn't run its editing pipeline. TikTok doesn't document these fields. `post_type = 3` is not a known "max quality" switch. v1 leaves this out because it's fragile, breaks with site updates, and carries the most account risk. If test data shows file patches alone don't work, a v2 could add it as an opt-in, inspectable extension.

## What we found reading the reference patcher's code

Reading `buwryme/tiktok-lossless-upload` (copy-mode path) line by line, and testing it:

1. **The default isn't lossless.** The command line re-encodes first (x264 CRF 18, no B-frames, GOP 9999). Only the Python API with `re_encode=False` keeps your bitstream. OQM never re-encodes in the patch stage.
2. **The `mvhd` rebuild writes the matrix at the wrong offsets** (44/60/76 instead of 48/64/80). The result is a non-identity transform matrix in the movie header. Most players ignore `mvhd`'s matrix, which is probably why nobody noticed. OQM keeps every field and only changes version and duration.
3. **"Zero mp4a samplerate" is a no-op.** It writes zeros to bytes 28-31 of the `mp4a` entry. Those are `pre_defined` + `reserved`, which are already zero. The real sample rate lives at 32-35. OQM leaves it out instead of copying dead code.
4. **Branding.** Defaults inject `Patched by Buwryy` comments and a `name` box. OQM writes only a neutral encoder tag.
5. **Correction (superseded):** we first attributed the duration drift (3.000 → 3.021 s) to the decoy's dummy `stts` ticks and shipped it as a labeled, accepted side effect. That diagnosis was wrong. Isolated testing (toggling the dummy-tick duration to zero changed nothing; keeping the clone's edit list fixed it outright) showed the real cause: `_build_decoy` dropped the audio track's `edts` (edit list) when cloning it. AAC encoders pad with priming samples that a normal track's edit list trims back out; the clone, lacking that edit list, reports its raw untrimmed duration, which becomes the container's reported (and likely played/looped-from) duration once a second audio track exists. The ~21 ms drift is fixed-size per clip (one AAC frame), not proportional to `inflate`, which is why toggling inflate never moved the number. OQM now keeps the clone's edit list; `oqm verify`'s "container duration" check should no longer warn with `decoy-audio` on, and this is covered by a regression test.

## Firsthand reports worth knowing

- Reddit (Sept-Oct): improved uploads via CompressBase, a visible duplicate audio track, playback issues, and later zero-view uploads. These are anecdotes. Zero views alone doesn't prove a shadowban.
- Kuronai has described older methods as relying on server-side vulnerabilities. It has reported videos becoming unavailable or stuck on private, and its private-first vs public-first advice differs between methods.
- Rixa's developer documented methods breaking, sound problems, zero-duration files, and some users still getting compressed or 30 fps results.

Takeaway: these are moving targets. Any method, OQM included, should be re-tested regularly.
