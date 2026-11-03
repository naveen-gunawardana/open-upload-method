"""Entry point for the packaged OQM app: the interface in its own window, no browser or terminal."""

import shutil
import sys
import threading
from pathlib import Path

import webview

from oqm import __version__, server

window = None


class Api:
    """Called from the page as window.pywebview.api.*"""

    def save_file(self, rel):
        """Ask where to save a copy of a workspace file, then copy it there."""
        src = server.Handler.app.path(rel)
        kind = getattr(getattr(webview, "FileDialog", None), "SAVE", None) or webview.SAVE_DIALOG
        dest = window.create_file_dialog(kind, directory=str(Path.home() / "Downloads"), save_filename=src.name)
        if not dest:
            return None  # cancelled
        dest = dest if isinstance(dest, str) else dest[0]
        shutil.copyfile(src, dest)
        return str(dest)


def bring_to_front():
    """Unsigned apps can open behind other windows on macOS; ask to be put on top."""
    if sys.platform != "darwin":
        return
    try:
        from AppKit import NSApplication
        from PyObjCTools import AppHelper
        AppHelper.callAfter(lambda: NSApplication.sharedApplication().activateIgnoringOtherApps_(True))
    except Exception:
        pass


def main():
    global window
    httpd, url = server.start(Path.home() / "OQM-workspace", port=0)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    webview.settings["ALLOW_DOWNLOADS"] = True
    window = webview.create_window(f"OQM {__version__}", url, js_api=Api(), width=1020, height=860,
                                   min_size=(520, 560), background_color="#2aa0ff")
    webview.start(bring_to_front)  # returns when the window is closed
    httpd.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
