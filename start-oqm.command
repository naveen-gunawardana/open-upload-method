#!/bin/sh
# Double-click (macOS) or run (Linux) to open the OQM interface. Needs Python 3.10+ and FFmpeg on PATH.
cd "$(dirname "$0")/program" || exit 1
exec python3 -m oqm ui "$@"
