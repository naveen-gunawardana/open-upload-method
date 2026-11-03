"""Anonymous usage counts: one small event per finished patch.

Sent: a random install id, app version, operating system, codec, pass/fail, and the input size in MB.
Never sent: file names, paths, or anything from the video. Turn it off in the app (More options),
or set OQM_NO_TELEMETRY=1.
"""

import json
import os
import sys
import threading
import urllib.request
import uuid
from pathlib import Path

from . import __version__

URL = os.environ.get("OQM_TELEMETRY_URL", "https://www.openqualitymethod.com/api/patch-event")
CONFIG = Path.home() / ".oqm" / "config.json"


def _load():
    try:
        return json.loads(CONFIG.read_text())
    except (OSError, ValueError):
        return {}


def _save(cfg):
    try:
        CONFIG.parent.mkdir(parents=True, exist_ok=True)
        CONFIG.write_text(json.dumps(cfg))
    except OSError:
        pass


def enabled():
    return os.environ.get("OQM_NO_TELEMETRY") != "1" and bool(_load().get("share_usage", True))


def set_enabled(on):
    cfg = _load()
    cfg["share_usage"] = bool(on)
    _save(cfg)


def _install_id():
    cfg = _load()
    if not cfg.get("install_id"):
        cfg["install_id"] = uuid.uuid4().hex
        _save(cfg)
    return cfg["install_id"]


def report(ok, codec, size_bytes):
    """Fire and forget: never slows down or breaks a patch if the network is down."""
    if not enabled():
        return
    event = {
        "install_id": _install_id(), "app_version": __version__, "os": sys.platform if sys.platform in ("darwin", "win32") else "linux",
        "codec": codec if codec in ("h264", "h265") else "h264", "ok": bool(ok), "size_mb": int(size_bytes // 1_000_000),
    }

    def send():
        try:
            req = urllib.request.Request(URL, json.dumps(event).encode(), {"Content-Type": "application/json", "User-Agent": f"oqm/{__version__}"})
            urllib.request.urlopen(req, timeout=4).read()
        except Exception:
            pass

    threading.Thread(target=send, daemon=True).start()
