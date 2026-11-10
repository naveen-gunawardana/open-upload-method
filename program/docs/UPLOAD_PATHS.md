# TikTok upload paths: what each one does (research notes, Nov 2026)

Status labels: **observed** = we saw it ourselves; **public code** = read in a public repo; **vendor claim** = a tool's own
page, not independently tested; **unverified** = single third-party source.

Caveat on every measurement below: the accounts used for testing were uploaded to heavily and served a single 540p
rendition no matter what was posted. Results from those accounts say nothing about whether a method works on a healthy
account. Re-test any candidate on a rested account with a handful of uploads.

## 1. TikTok Studio (web, tiktok.com/tiktokstudio/upload)

The path the desktop tools drive. Flow (observed in the browser, matches the public `makiisthenes/TiktokAutoUploader` client):

1. `GET /api/v1/video/upload/auth/` returns temporary storage credentials and an upload host.
2. `GET /top/v1?Action=ApplyUploadInner` returns the store URI, upload id and video id (`Vid`).
3. Multipart `PUT` to the storage host (`...?partNumber=N&uploadID=...&phase=transfer`), then `phase=finish`.
4. `POST /top/v1?Action=CommitUploadInner` (public client sends `Functions: [{"name":"GetMeta"}]`).
5. `POST /api/v1/web/project/create/?creation_id=...&type=1`.
6. `POST /tiktok/web/project/post/v1/`, signed with the page's `X-Bogus` / `_signature` scripts.

Observed publish body for a plain upload: `post_common_info.post_type = 3`, `feature_common_info_list[0].vedit_common_info.draft = ""`,
`single_post_req_list[0].is_long_video = 0`, `cloud_edit_is_use_video_canvas = false`, plus caption, cover and privacy.
No quality field. The editor fields Kuronai's extension deletes (`draft` content, `canvas_config`, `vedit_segment_info`,
`vedit_project`, `edit_common_info`) are already absent. Setting `is_long_video = 1` and stripping the cover project and
`cloud_edit_video_*` fields changed nothing we could measure.

Every browser-based tool (Kuronai, WizardFTB, the Selenium and requests-based uploaders) ends in this same pipeline.

## 2. TikTok mobile app

- The publish screen has an explicit **HD upload** control. In the decompiled app (public repo `akitaonrails/tiktok_analysis`,
  v46) it is an `HD_UPLOAD` entry stored on the publish edit model, and the app logs `click_high_quality_upload_control`
  with `on`/`off`. So on mobile the choice is a first-class client setting. The web request has no equivalent field.
- Mobile endpoints named in a public client stub (`molkex/tiktok-private-api`): `/aweme/v1/upload/authkey/`,
  `/aweme/v1/upload/video/`, then `/aweme/v1/create/aweme/`. The stub does not ship the signing or upload code.
- Several guides say mobile re-encodes 60 fps to 30 fps before sending and that the toggle resets between posts. Unverified.
- **The app can re-encode on the phone before uploading, with server-set limits.** In the decompiled v46 app
  (`akitaonrails/tiktok_analysis`) the settings read through `SettingsManager` include:
  `high_quality_bitrate_of_recode_threshold` (default 10,000,000 bps) and `bitrate_of_recode_threshold` (default
  10,000,000 bps), consumed by a "recode" API that decides whether a file gets recoded on the device;
  `enable_high_quality_video` (default false, with a separate `showHDButton` gate for the toggle);
  `high_quality_compile_video_size_index` (default 99); and `high_quality_ve_synthesis_settings` (a server-supplied
  string). These are read through a `bytebench` package (`ResolutionByteBenchStrategy`, `RecodeByteBenchStrategy`,
  `ExternalSettingByteBenchStrategy`), which looks like ByteDance's device-benchmark system, so the limits probably also
  vary by phone capability tier (use the same phone for every comparison). Defaults can be overridden by the server per
  account or experiment. Hypothesis to test: a file above ~10 Mbps
  gets recoded by the phone before it is even uploaded, and a file under it goes up untouched. Our usual exports
  (CRF 17, 20-40 Mbps) would be on the wrong side of that line on mobile, though web uploads don't go through it.

## 3. Official Content Posting API (developers.tiktok.com)

- `POST /v2/post/publish/video/init/` with `source_info.source` = `FILE_UPLOAD` or `PULL_FROM_URL`, then chunked `PUT`.
- Accepts MP4/MOV/WebM, H.264/H.265/VP8/VP9, 23-60 fps, 360-4096 px, up to 4 GB. The docs say nothing about re-encoding.
- Unaudited apps can only post privately (the docs say the account must be private).
- Test script ready: `program/tools/tiktok_api_test.py` (needs a user access token; never run).
- Third-party schedulers (Buffer-style tools) use this API or the upload-to-inbox mode. One vendor claims "native 1080p".

## 4. Ads paths (not tested)

Official ad specs: minimum 540x960, 720x1280 and up unrestricted, 500 MB. One third-party guide says Spark Ads accept any
resolution and that 4K is converted to 1080p. Unverified.

## 5. CapCut and other ByteDance tools (not tested)

A vendor guide says CapCut's share button applies the active export settings, so it matches a manual export. Unverified.

## 6. Container and encoder "methods" (what the public tools actually change)

| Method | Mechanism | Evidence |
|---|---|---|
| buwryme mvhd (current default) | `mvhd` to v1, duration all-ones, `©cmt` tag, no re-encode | public code; maintainers hot-swapped methods Oct 19-23 |
| buwryme legacy / CompressBase | duplicate audio track with fake samples | public code |
| silent-method (Nov 2) | fake 8-byte samples in the real video track, last frame duration 1, `btrt`/`pasp`, interleaving | public code |
| tiktok-prep (Nov 2) | H.264 Main re-encode, ByteDance-style `evc0` SEI, `©too` JSON, fake samples inside the real audio track, no edit lists | public code; author reports 4K/120 preserved Oct 18 and reach loss for the video-inflation variant |
| 120fps-method | `mvhd`/`mdhd` timescale inflation (frame rate only) | public code |
| Kuronai extension | request-field deletion (no-op on current Studio) plus a closed "Enhanced Method" | public config; core closed |
| Haze, Zilem, RTX Fury | container rewrite, closed | vendor claims; Zilem says TikTok patched its server engines |

What we tested on a throttled account: our full patch, `mvhd` only, the silent-method rewrite, the tiktok-prep style recipe
(1080p and 4K), request-field edits and `is_long_video`. All matched their unpatched control.

## 7. What the web page can and can't tell us (measurement caveat)

Every number in these notes comes from `bitrateInfo` in the video page's embedded JSON. The same page embeds the account's
playback A/B parameters, and the web player's bitrate selector is configured with `bitrateRange: [200000, 1500000]` and
`bitrateUpper: 2000000` (`ttplayer_bitrate_select`, `selector: "buffer-info"`). Every rendition we read back (1.6-2.3 Mbps)
sits inside that band. So the web view may only expose renditions that fit a desktop-browser budget, and it can't show
what the phone app is served. The app also pulls `/aweme/v1/settings/` and `/aweme/v1/abtest/param/` at runtime
(public decompiled `akitaonrails/tiktok_analysis`), so per-account server flags could explain why one account serves 720p
and another 540p for the same file. Treat "web shows 540p" as "web shows 540p", not "viewers see 540p".

## 8. How to tell a method works from the outside (Nov 7 finding)

Every video page's `itemStruct.video` has a `videoQuality` field. Posts that TikTok re-encoded say `normal`. Posts it streams
untouched say `original`, and their `bitrateInfo` has a gear named `original_1080_0` at the uploaded bitrate. Sampled on
Nov 7 from TikTok search results for "upload method":

| Account | Posted | videoQuality | Served |
|---|---|---|---|
| @1lucasfx (LucaFX method) | Oct 12 | original | `original_1080_0` 13.4 Mbps, 1920x1080 |
| @blood.method | Sep 8 | original | `original_1080_0` 19.2 Mbps, 1440x1080 |
| @ryu60fps | Oct 29 | original | (no bitrateInfo exposed) |
| @erayaep0 (Erayaep method) | Oct 31 | original | 2560x1440 and 1778x1000 (no bitrateInfo exposed) |
| @nmjjang_sugoi | Oct 31 | original | 1440x1080, but first gear `adapt_540_1` |
| @tikhazed (Haze) | Oct 18-21 | normal | `normal_720_0` |
| @wizardftb1 | Jun | normal | `normal_720_0` |
| @immike.__ (TikQuick) | May | normal | `normal_540_0` |
| @hidzz.kyy | Oct 28-31 | normal | 720p |
| @nova1kai (Haze method) | Oct 27 | normal | `normal_720_0` |

So some methods still get TikTok to keep the original file, weeks after posting. Haze's own demo posts don't. Our test
posts were always `normal`. This field lets anyone check a method without trusting its marketing: run it, wait an hour,
read `videoQuality`. (Fetching pages quickly triggers an Akamai "Access Denied" block for a while; space checks out.)

Extensions read (packages from Google's update server, read only):
- **Kryp FPS Method 1.0.3**: uploads the file to its own Cloudflare Worker (`/patch_video`) behind a login; comments say
  "elst + iTunes metadata". Also downloads request "clean rules" and inject code from its server at runtime and appends
  "Upload Method -> @kryp.aep" to every caption. The core is server-side, so it can't be read.
- **FLOWTIK 120 FPS 2.7**: 120 fps mode runs a WebAssembly patch ("frame injection"); other modes run
  `ffmpeg -itsscale N -c copy` plus metadata tags. Frame-rate only.

### What the "original" accounts actually use (read Nov 7)

- **TikQuick 2.3.1** (Chrome extension `odoegeoijbmafbbddbmklbccnefgfngl`, by mikedev_; also powers Ryu's and LucaFX's
  tools). Three layers:
  1. Local pre-check: re-encode with ffmpeg.wasm if over 1440p, 120 fps or 40 Mbps, or over a size budget by duration
     (31 MB <20 s, 51 MB <60 s, 91 MB <120 s, else 121 MB).
  2. Server patch (`/api/v2/patch?selectmethod=...`, needs login). "Instant" v2 sends only the file header; the server
     returns a new `ftyp`+`moov` and one ghost sample. Output = new header + original `mdat` untouched + ghost sample
     appended after `mdat`. The published v20 engine (copied in Ryu's site, `1dleryu.vercel.app/engine.js`) does:
     `mvhd` to v1 with duration all-ones, `©too` encoder tag in the video track's `udta`, handler names reset, moov `udta`
     removed, chunk offsets shifted. Server is now on `ps_version v24`.
  3. Request layer: clears the `ttwid` cookie before upload, the same Kuronai request rules (no-ops today), and a caption
     watermark.
- **TikQuick's live method config** (`api.tikqcapi.site/api/extension/methods.json`, updated ~Nov 6):
  Orion: "upload as Everyone or Friends Only instead of Only Me". Luna: "risky", needs 30/60 fps H.264.
  Alfa (default): "This will give you 720P 60FPS. Upload as Only Me, then after 30s change to Everyone or Friends Only."
  Footnote: "Orion and Luna do not work for most people. Please try Alfa."
- **Blood Method** (bloodmethod.xyz, "Partner by CompressBase"): Discord-gated in-browser patcher, same Alpha / Standard /
  Beta choices and the same "720P 60FPS, Only Me then Everyone after 30s" note. Max 1080p input on the free tier.
- **Ryu (1dleryu.vercel.app)**: TikQuick v20 engine locally, then optional publish through Zernio's posting API
  (presign, PUT, publish) instead of Studio.
- **Erayaep**: tool at erayaep-upload-method.onrender.com is suspended.

Takeaways: (1) visibility at publish time is part of every working recipe, and every OQM test was Only Me;
(2) the tool makers themselves now promise 720p60 by default, with 1080p+ "not working for most people";
(3) the file patches are variants of what we already have (`mvhd` unknown duration, `©too`, a ghost sample after `mdat`).

### Visibility test (Nov 8, test account @svana165)

Current OQM patch, 1920x1080 H.264 CRF 18, 5-6 s clips, posted from Studio with High-quality uploads on:
- A, posted as Everyone: `normal`, `normal_720_0` 1.48 Mbps (same at 0 and 5 min).
- B, posted as Only Me, switched to Everyone after 30 s: `normal`, `normal_720_0` 1.83 Mbps + `adapt_lower_720_1`.

Neither got `original`. Both were set back to Only Me afterwards.

- C, a Python port of TikQuick's published v20 engine (`mvhd` unknown duration, `©too` TikQuick tag in the video
  track's `udta`, handler names reset), posted as Only Me: `normal`, `normal_540_0` 2.27 Mbps at 1024x576.

 Both reached 720p, where recent Only Me tests on this account got 540p, which fits either a
partly rested account or public posts getting a better ladder. Visibility alone doesn't produce `original` with our patch.

## 9. Files TikTok actually kept (downloaded `original` renditions, Nov 8)

TikTok serves `original` posts with the uploaded bytes, so downloading the served file shows the exact patch.
Control: 13 ordinary videos from search ("edit aftereffects", "cat") were all `normal`.

| Post | Date | What the file is |
|---|---|---|
| @blood.method | Sep 8 | TikQuick v19: second (decoy) audio track with 10x 8-byte ghost samples (13,220 declared / 1,322 real), ghost bytes appended after `mdat` as `00000004 00000000` junk, both audio tracks share track ID 3, no `edts`, mvhd normal duration, odd mvhd timescale 384000 |
| @1lucasfx | Oct 12 | ~10,700 ghost samples inside the video track (12,593 declared / 1,889 real), `edts` kept, one audio track, tags ©art/©cmt/©cpy/©too |
| @ryu60fps | Oct 29 | TikQuick v20: mvhd v1 unknown duration, ©too in video `udta`, one extra audio sample (2,392 / 2,391, last duration 640) inside `mdat`, `edts` kept, faststart |
| @erayaep0 | Oct 31 | Mediabunny (in-browser WebCodecs) encode, 2560x1440 60 fps 12.9 Mbps, `moov` at END, mvhd v1 unknown duration, no `edts`, video timescale 60, no ghost samples |
| @erayaep0 | Oct 31 | Re-upload of a TikTok-downloaded HEVC file with TikTok's own `vid:` comment tag; kept as `original` but only 0.5 Mbps |

Replica tests on @svana165 (Only Me):
- `tq_v20` (TikQuick v20 port without the audio ghost sample): `normal_540_0`.
- `eray_rep` (exact Erayaep structure, 2560x1440 60 fps 12 Mbps, moov last, mvhd unknown, no edts, timescale 60):
  `normal_540_0` 2.25 Mbps within 20 s of posting.

Every upload from @svana165 lands on a single `normal_540_0` / `normal_720_0` gear, while ordinary creators' videos
carry an `adapt_lowest_1080_1` gear too. The account itself looks capped, so it can no longer tell a working recipe from a
broken one. Further tests need a healthy account.

## Open questions worth a clean test

1. Does a mobile upload with HD on differ from the same file posted from Studio, on a rested account?
2. Does the official API (private post) serve a different rendition ladder?
3. Does any of the container recipes beat a plain control on a rested account? Use at most four uploads per round.
