"""Entry point for the packaged OQM app: the interface in its own window, no browser or terminal."""

import sys
import threading
from pathlib import Path

import webview

from oqm import __version__, server


def main():
    httpd, url = server.start(Path.home() / "OQM-workspace", port=0)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    webview.settings["ALLOW_DOWNLOADS"] = True
    webview.create_window(f"OQM {__version__}", url, width=1180, height=820, min_size=(760, 560), background_color="#05171a")
    webview.start()  # returns when the window is closed
    httpd.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
