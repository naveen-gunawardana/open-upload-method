"""Fetch static ffmpeg/ffprobe into ./bin and build the OQM app with PyInstaller.

    pip install pyinstaller static-ffmpeg
    python build_app.py
"""

import shutil
import subprocess
import sys
from pathlib import Path

import static_ffmpeg.run

root = Path(__file__).parent
bin_dir = root / "bin"
bin_dir.mkdir(exist_ok=True)
ffmpeg, ffprobe = static_ffmpeg.run.get_or_fetch_platform_executables_else_raise()
for src in (ffmpeg, ffprobe):
    shutil.copy2(src, bin_dir / Path(src).name)
subprocess.run([sys.executable, "-m", "PyInstaller", "--noconfirm", "oqm.spec"], cwd=root, check=True)
