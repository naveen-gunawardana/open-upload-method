# OQM: Open Quality Method

A free tool to stop TikTok from crushing the quality of your edits. It runs on your PC and doesn't upload anything.

![OQM](docs/ui.png)

## What it does

OQM adds a hidden extra audio track to your MP4 (the "decoy"). Your picture and sound don't change at all, and OQM checks that before it saves.

In our first test, TikTok served the patched files **exactly as uploaded, at 1080p 60 fps**. The same video without the patch came back at 576p 30 fps.

| Upload | What TikTok served |
|---|---|
| **C: decoy only** | 1080p · 60 fps · 11.5 Mbps, untouched |
| **B: full method** (decoy + 7 other patches) | 1080p · 60 fps · 11.5 Mbps, untouched |
| D: the 7 other patches, no decoy | 576p · 30 fps · 1.5 Mbps, re-encoded |

**Use C.** It gets the same result as B with far fewer changes to your file. Keep B as a backup if C ever stops working.

## Setup (once)

1. Install **Python**: https://www.python.org/downloads/ (tick **"Add python.exe to PATH"**)
2. Install **FFmpeg**: open a terminal and run `winget install Gyan.FFmpeg` (the launcher can do this for you)
3. Download this repo: green **Code** button → **Download ZIP** → unzip

## Use it

**Fastest:** drag your video onto **`Start OQM.bat`** and press **C**. A file ending in `_C.mp4` appears next to it. Upload that one.

**The app:** double-click **`Start OQM.bat`** and it opens in your browser. Drop your video in, go to the **Patch** tab, pick **C** or **B**, and hit **Patch + verify**.

On Mac, double-click `start-oqm.command` instead.

## Tips

- Export from your editor at high quality first (e.g. 1080x1920, 60 fps, high bitrate). OQM can't add quality that isn't there. The **Export** tab can make a clean master for you.
- Test on a second account first.
- Check the upload on your phone: sound, seeking and looping.

## Heads up

This is one test. TikTok can change how it processes uploads at any time, so nothing here is guaranteed. The patch makes an unusual file on purpose. It's not affiliated with TikTok, and using it might go against their terms, so that's your call.

## More

- [How it works](docs/METHOD.md), byte by byte
- [Run your own A/B test](docs/TEST-PROTOCOL.md) (the **A/B kit** tab builds all four versions)
- [What the paid methods actually do](docs/LANDSCAPE.md)
- Command line: `python -m oqm --help`

Based on public work by [buwryme/tiktok-lossless-upload](https://github.com/buwryme/tiktok-lossless-upload) and others. MIT license.
