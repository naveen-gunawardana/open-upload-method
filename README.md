# OQM: Open Quality Method

A free tool that stops TikTok from crushing the quality of your video uploads. It runs in your browser: your video is processed on your own computer and never uploaded anywhere.

## How to use it

1. Open the OQM website
2. Drag your video onto the page (or click and choose it). It starts converting straight away
3. Click **Download** when it's done, and upload that file to TikTok the same as always

The panel that opens has presets and an **Advanced** section with every option: re-encode on/off, codec, quality or bitrate, size, frame rate, keyframe spacing, audio bitrate, each container patch on its own, and the decoy and padding settings. **Make A/B test set** builds one file per preset so you can post them side by side and compare.

Free, open source, MIT license.

## Privacy

Your video never leaves your computer. When a conversion finishes, the site adds one to the public "videos converted" counter. Only that tick, a salted hash of your IP (for rate limiting) and your country are stored, never anything about the video.

## Code

- `website/src/lib/oqm/patch.ts`: the container patches (a port of `program/oqm/patches.py`; tested for byte-identical output on FFmpeg exports)
- `website/src/lib/oqm/pipeline.ts`: browser re-encode (WebCodecs via Mediabunny), patch and checks
- `program/`: the original Python tool and desktop app, still usable from the command line

For development, run `npm install` in `website/`, then `npm run dev`. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `REVIEW_SALT` in `website/.env.local` to enable the public counter and reviews. The counter uses the existing `download_stats` and `download_events` tables, keeping the previous download total. Conversion itself works without these services.

Checks: `cd website && npm test && npm run lint && npm run build`, and `cd program && python3 -m unittest discover -s tests -v`. The patch tests need FFmpeg and Python 3 on your path.
