# OQM: Open Quality Method

A free tool for preparing and comparing TikTok uploads. Container patches preserve local video packets; they do not guarantee TikTok will retain resolution, frame rate or bitrate. It runs in your browser: your video is processed on your own computer and never uploaded anywhere.

## How to use it

1. Open the OQM website
2. Click **Patch video →** to open the patcher, choose a video and settings, then click **Start →**. Dropping a file on the home screen opens the patcher with that file selected, ready to start
3. Click **Download** when it's done, and upload that file to TikTok the same as always

The panel that opens has presets and an **Advanced** section with every option: re-encode on/off, codec, quality or bitrate, size, frame rate, keyframe spacing, audio bitrate, each container patch on its own, and the decoy and padding settings. **Make local comparison (3)** prepares one encoded source, then builds clean MP4, current OQM and experimental silent-tail from it without further video encoding. Silent-tail with re-encode enabled is the website default. Original OQM remains selectable; saved custom settings are still remembered. Silent-tail requires AAC-LC stereo and intentionally adds a short silent tail and a second audio track.

Free and open source. OQM is MIT licensed; the optional ProRes decoder is MPL-2.0 (see `website/public/licenses/prores-notices.txt`).

Light mode is the default. The corner sun/moon button switches to the night theme and remembers your choice on this device. Cards, forms and converter controls follow the selected theme. Background animation is capped at 30 fps and pauses during video conversions, in hidden tabs and for reduced-motion preferences. The lighter scene uses fewer terrain vertices, clouds and particles, with no full-screen postprocessing or card backdrop blur.

The preset dropdown includes **1080p — high quality** (H.264, target 20 Mbps) and **4K — experimental** (H.264, target 60 Mbps). Both re-encode SDR input with AAC audio and two-second keyframe spacing, cap higher frame rates at 60 fps, and preserve lower source frame rates. They limit the shorter edge to 1080 or 2160 pixels without upscaling smaller inputs. Both use the current OQM patches; silent-tail remains a separate option. A 4K output requires a sufficiently large source and a browser/device capable of encoding it. TikTok may still reduce resolution, bitrate or frame rate.

## Privacy

Your video never leaves your computer. When a conversion finishes, the site adds one to the public "videos converted" counter. Only that tick, a salted hash of your IP (for rate limiting) and your country are stored, never anything about the video.

Successful desktop patch reports also contribute to the shared counter, including past reports. Failed desktop patches are excluded. The desktop app's existing anonymous usage setting is respected; disabled or undelivered reports cannot be counted. The public total preserves the existing download/web counter and adds successful desktop reports, so it includes historical downloads. Patch success means local file verification passed, not that TikTok retained quality.

## Code

- `website/src/lib/oqm/patch.ts`: the container patches (a port of `program/oqm/patches.py`; tested for byte-identical output on FFmpeg exports)
- `website/src/lib/oqm/pipeline.ts`: browser re-encode (WebCodecs via Mediabunny), patch and checks
- `program/`: the original Python tool and desktop app, still usable from the command line

For development, run `npm install` in `website/`, then `npm run dev`. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `REVIEW_SALT` in `website/.env.local` to enable the public counter and reviews. The counter uses the existing `download_stats` and `download_events` tables, keeping the previous download total. Conversion itself works without these services.

Checks: `cd website && npm test && npm run lint && npm run build`, and `cd program && python3 -m unittest discover -s tests -v`. The patch tests need FFmpeg and Python 3 on your path.

## Local comparison before uploading

From `program/`, run `python3 -m oqm compare /absolute/path/to/1080p60-SDR-master.mp4 --out /absolute/path/to/fresh-comparison-directory`. This performs no encoding or uploads. It writes three MP4s, a local integrity manifest and `retention.csv` with pending checkpoints after processing, at 24h, 72h and 7d for desktop and a second phone/account. Start with 1080p60 SDR, then 4K; test 120 fps and HDR separately. Local packet hashes, decoded video hashes and decode checks cannot establish a TikTok bypass. See [the test protocol](program/docs/SILENT_TAIL_TESTING.md) and [third-party notices](THIRD_PARTY_NOTICES.md).

ProRes MOV inputs load the official Mediabunny/TurboRes software decoder on demand and are processed locally. Use re-encode (Current OQM or a resolution preset) to produce H.264/AAC MP4; silent-tail and no-re-encode modes still require compatible encoded input. Other MOV codecs depend on browser support. HDR/wide-gamut re-encoding remains blocked pending explicit colour conversion.

Website conversion analytics are separate from the public counter and never change encode/patch settings. `website/supabase/conversion_analytics.sql` creates the server-only table. Events record start, success/check failure, error/cancel and first download click per run, with allowlisted settings, input container/size, output dimensions/FPS/bitrate/duration, elapsed time, coarse browser/OS/country and a salted network hash. No file contents, filenames, raw errors, raw IP addresses or persistent browser identifiers are sent. Analytics reports are best effort; missing finish events may mean the page closed, and a download click does not prove the file was saved or uploaded to TikTok. Existing desktop telemetry remains unchanged. Run `node --env-file=<server-env> website/scripts/analytics-report.mjs <ISO-start-timestamp>` from the repository root to get aggregate results; historical settings cannot be recovered.

SEO: the homepage is the canonical URL, including for `/convert` (the same app with its patcher panel selected). `/robots.txt` advertises `/sitemap.xml`; the sitemap lists only the canonical homepage. Search/social metadata and factual WebSite/WebApplication JSON-LD are rendered on the server. `/opengraph-image` provides the social preview. `/llms.txt` is a public Markdown reference, not a Google ranking mechanism, and is excluded from indexing as a separate search result. No hidden keyword text or fabricated review ratings are used. API routes and the local font lab are excluded from indexing. Run `node website/scripts/seo-check.mjs <base-url>` against a production build or the live deployment. In Google Search Console, submit `https://www.openqualitymethod.com/sitemap.xml`, inspect the canonical homepage, and request indexing if appropriate; registration alone does not establish indexing or ranking.
