# The Open Quality Method, v1

## Principles

1. **Encode once.** Every lossy encode costs detail. Your master is the last encode *you* control, so make it a good one, and never let a patch tool re-encode behind your back.
2. **Patch only the container.** An MP4 is compressed picture/audio data (`mdat`) plus an index describing it (`moov`). OQM changes the index and nothing else.
3. **Prove it locally.** Every patched file is hashed against the master before you upload it.
4. **One variable at a time.** Every patch is a separate toggle, so tests can show which one matters.
5. **Judge by what viewers receive.** The only evidence that counts is the copy TikTok actually serves, measured against your master.

---

## Stage 1: Export

`oqm export IN OUT`

| Setting | Value | Why |
|---|---|---|
| Codec | H.264 High @ 4.2 (or H.265 `hvc1` with `--codec h265`) | Universally decodable; 4.2 covers 1080p60. |
| Quality | CRF 17, preset slow | Visually transparent for most edits; size scales with complexity. |
| Pixel format | yuv420p, 8-bit | What phones decode in hardware. 10-bit sources get converted here, once, on purpose. |
| Colour tags | BT.709 primaries / transfer / matrix, TV range | Untagged files are a common cause of washed-out or shifted colour on phones. |
| Keyframes | every 2 s (`-g = 2 x fps`) | Seekable and streamable if TikTok passes the file through. |
| Frame rate | Source rate, or `--fps N` for constant frame rate | `--fps` duplicates or drops frames. It **does not** interpolate. |
| Size | Source size, or `--fit 1080x1920` (Lanczos scale + pad) | Don't make TikTok resize for you. |
| Audio | AAC-LC 320 kbps, 48 kHz | Headroom before any server-side audio encode. |
| Layout | `+faststart`, metadata stripped | Index first, nothing identifying. |

**Tips that matter more than any patch:**
- Export from your editor at the highest quality it offers (ProRes / DNxHR / lossless intermediate), then run `oqm export` on that. Don't feed it an already-crushed H.264.
- Upscaling AI tools (Topaz etc.) change the source. They aren't an upload method. If you use them, do it *before* export and say so in your test notes.
- Sharpening and grain survive compression badly. Fine noise is the first thing an encoder smears.

---

## Stage 2: Patch

`oqm patch master.mp4 [--profile reference|minimal|none]`

First, the file is stream-copied (`ffmpeg -c copy`) into a clean single-`mdat` MP4: first video stream plus first audio stream. Then the enabled patches run. Chunk offsets are recomputed, so every index entry still points at the same bytes.

### Profiles

| Profile | Patches | Use |
|---|---|---|
| `none` | faststart | Control arm. Same bitstream, normal file. |
| `minimal` (default, "C") | faststart, decoy-audio | The decoy alone. Got full 1080p60 passthrough in the first A/B round, with the fewest changes. |
| `reference` ("B") | all eight | Full replication of the public reference method, without its bugs or branding. |

### Patch catalog

| ID | Exact change | Side effects |
|---|---|---|
| `faststart` | Order boxes as `ftyp`, `moov`, `mdat`. Always applied. | None. |
| `strip-free` | Remove top-level `free` / `skip` boxes. | None. |
| `zero-times` | Set creation and modification times in every `tkhd` and `mdhd` to 0 (1904-01-01). | Hides when you exported. |
| `mvhd-unknown-duration` | Rewrite `mvhd` as version 1, keeping every other field, with duration `0xFFFFFFFFFFFFFFFF`. | Players fall back to track durations. |
| `video-elst-plus-one` | Add 1 tick to the video edit list's segment duration. | Declared playback about 1 ms longer. |
| `decoy-audio` | See below. | Container duration grows slightly; decoy track won't decode cleanly. |
| `clean-metadata` | Replace `moov/udta` with one `meta/ilst` holding `©too` = encoder tag (default `Lavf59.27.100`, the string the reference method uses). | Removes your editor's tags. |
| `trailing-pad` | Append 184,100 bytes after `mdat`, starting with a malformed box `00000004 'VOID'` followed by repeated `00000004`. | File is about 180 KB larger; parsers stop at the bad box. |

### The decoy audio track (the core claimed trigger)

1. Deep-copy the audio `trak`, then drop its `edts` and `tref`.
2. Give it a new track ID (max + 1) and update `mvhd.next_track_ID`.
3. Inflate its sample tables. With N real samples and inflation factor k (default 10):
   - `stsz`: N real sizes, then `N x (k-1)` dummy sizes of *d* bytes (d = 8 for H.264 video, 16 for HEVC)
   - `stts`: original entries, then one entry: `(N x (k-1)) samples x delta 1`
   - `stsc`: original entries, then one entry: a new chunk holding all dummy samples
   - `stco`/`co64`: original offsets, then one new chunk pointing at the **first real audio chunk**
4. Nothing is added to `mdat`. The dummy samples point at bytes that already exist, and their reads are clamped to stay inside `mdat`.

Result on a 4 s, 60 fps test card: primary audio declares 189 samples, decoy declares 1,890. Video and primary audio hash identically to the master.

**Why it's supposed to work:** the claim from tool authors is that TikTok's ingest sees the structural mismatch and skips transcoding, while phone players ignore the second audio track. The structure is verifiable. The server-side behaviour is not, which is why Stage 3 exists.

---

## Stage 3: Verify and measure

### 3a. Verify (automatic after `patch`)

| Check | Fails when |
|---|---|
| video bitstream identical | Compressed video packets differ (SHA-256) |
| decoded frames identical | Decoded pixels differ |
| frame count / frame rate unchanged | Decoded frame count or average fps changed |
| primary audio identical | First audio track's packets differ |
| video duration within 1 frame | The video track got longer or shorter |
| video + primary audio decode clean | FFmpeg reports decode errors on the streams viewers hear and see |
| container duration (**warn**) | Expected with `decoy-audio`: dummy ticks extend the file's longest track |
| decoy track decodes (**warn**) | Expected: dummy samples aren't real AAC |

### 3b. Measure

`oqm measure master.mp4 served.mp4`

- **Served codec / resolution / bitrate**: did TikTok keep your file or make its own?
- **Declared vs unique fps**: unique fps counts frames that actually differ (`mpdecimate`). A "60 fps" upload that's really duplicated 30 fps shows ~30.
- **SSIM / PSNR / VMAF**: both clips are aligned to the lower frame rate and the master's resolution.
- **Passthrough likely**: SSIM above 0.995, same width, same frame rate.

How to get the served copy: download it from a *different* account or device, or screen-record at native resolution (screen recordings add their own compression, so treat those numbers as a lower bound). One downloaded file may be only one of several renditions TikTok serves.

---

## Known limitations of v1

- Only the first video stream and first audio stream are kept.
- Fragmented MP4 (`moof`) input isn't supported. Export to a normal MP4 first.
- `measure` assumes the served copy starts where your master starts. Trimmed or offset copies score lower than they should.
- No browser-side request patching (see LANDSCAPE.md for why).
