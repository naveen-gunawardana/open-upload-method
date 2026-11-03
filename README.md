# OQM: Open Quality Method

A free tool that stops TikTok from crushing the quality of your video uploads. It runs on your own computer — nothing gets uploaded anywhere else.

## How to use it

1. Install **Python**: https://www.python.org/downloads/ (tick **"Add python.exe to PATH"** during setup)
2. Install **FFmpeg**: open a terminal and run `winget install Gyan.FFmpeg` (Mac: `brew install ffmpeg`) — the launcher can also do this for you on Windows
3. Download this repo (green **Code** button → **Download ZIP**, or grab the release zip) and unzip it
4. Double-click **`Start OQM.bat`** (Windows) or **`start-oqm.command`** (Mac)
5. It opens in your browser. Drop your video in, set a bitrate (or leave it blank for quality mode) and your frame rate/size, then hit **Make it**
6. Upload the file it gives you to TikTok, same as always


That's it. Free, open source, MIT license.

## Privacy

OQM runs on your computer and your videos never leave it. The desktop app does count how many videos get patched: after each patch it sends a random install ID, the app version, your operating system, the codec, whether the checks passed, and the input size in MB. It never sends file names, paths, or anything from the video. Turn it off under **More options → Share anonymous usage counts**, or set `OQM_NO_TELEMETRY=1`. The code is in `program/oqm/telemetry.py`.
