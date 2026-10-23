"""Local web UI for OQM: `oqm ui`.

Standard library only. Binds to 127.0.0.1, keeps every file in one workspace
folder, and runs one FFmpeg job at a time in a background thread.
"""

import json
import os
import shutil
import subprocess
import sys
import threading
import uuid
import webbrowser
from dataclasses import asdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse

from . import __version__, export, ff, patches, verify

UI_DIR = Path(__file__).parent / "ui"
CHUNK = 1 << 20


class App:
    ACTIONS = {"export", "patch"}

    def __init__(self, workspace):
        self.ws = Path(workspace).expanduser().resolve()
        self.ws.mkdir(parents=True, exist_ok=True)
        self.jobs = {}
        self.run_lock = threading.Lock()  # FFmpeg jobs are heavy: run them one at a time
        try:
            ff.require()
            self.ffmpeg_error = None
        except ff.FFmpegError as e:
            self.ffmpeg_error = str(e)

    # --- workspace files ----------------------------------------------------

    def path(self, rel):
        """Resolve a workspace-relative path, refusing anything outside the workspace."""
        p = (self.ws / unquote(rel)).resolve()
        if p == self.ws or self.ws not in p.parents:
            raise ValueError(f"not a workspace file: {rel}")
        return p

    def src(self, rel):
        p = self.path(rel)
        if not p.is_file():
            raise ValueError(f"file not found in workspace: {rel or '(none selected)'}")
        return p

    def rel(self, p):
        return Path(p).resolve().relative_to(self.ws).as_posix()

    def files(self):
        out = []
        for p in self.ws.rglob("*"):
            rel = self.rel(p)
            if p.is_file() and not any(part.startswith(".") for part in Path(rel).parts):
                st = p.stat()
                out.append({"name": rel, "size": st.st_size, "mtime": st.st_mtime})
        return sorted(out, key=lambda f: -f["mtime"])

    def unique_path(self, name):
        name = Path(name).name.lstrip(".") or "upload.mp4"
        p, n = self.ws / name, 1
        while p.exists():
            p = self.ws / f"{Path(name).stem} ({n}){Path(name).suffix}"
            n += 1
        return p

    def state(self):
        return {
            "version": __version__,
            "workspace": str(self.ws),
            "ffmpeg_error": self.ffmpeg_error,
            "files": self.files(),
            "catalog": [asdict(p) for p in patches.CATALOG],
            "profiles": {k: sorted(v) for k, v in patches.PROFILES.items()},
            "busy": any(j["status"] in ("queued", "running") for j in self.jobs.values()),
        }

    # --- jobs ---------------------------------------------------------------

    def submit(self, action, params):
        if action not in self.ACTIONS:
            raise ValueError(f"unknown action: {action}")
        job = {"id": uuid.uuid4().hex[:10], "action": action, "status": "queued", "result": None, "error": None}
        self.jobs[job["id"]] = job
        threading.Thread(target=self._run, args=(job, params), daemon=True).start()
        return job["id"]

    def _run(self, job, params):
        with self.run_lock:
            job["status"] = "running"
            try:
                job["result"] = getattr(self, f"do_{job['action']}")(params)
                job["status"] = "done"
            except Exception as e:  # surfaced to the UI verbatim
                job["error"] = str(e)
                job["status"] = "error"

    def do_export(self, p):
        src = self.src(p["input"])
        out = self.unique_path(f"{src.stem}_master.mp4")
        info = export.export(src, out, codec=p.get("codec", "h264"), crf=int(p.get("crf", 17)),
                             kbps=int(p["kbps"]) if p.get("kbps") else None,
                             fps=float(p["fps"]) if p.get("fps") else None, fit=p.get("fit") or None)
        return {"output": self.rel(out), **info}

    def do_patch(self, p):
        src = self.src(p["input"])
        tag = {"minimal": "C", "reference": "B", "none": "control", "structure": "D"}.get(p.get("profile"), "oqm")
        out = self.unique_path(f"{src.stem}_{tag}.mp4")
        opts = patches.PatchOptions(enabled=set(p.get("patches", [])) | {"faststart"},
                                    inflate=int(p.get("inflate", 10)),
                                    dummy_size=int(p["dummy_size"]) if p.get("dummy_size") else None,
                                    encoder_tag=p.get("encoder_tag", "Lavf59.27.100"),
                                    trailing_bytes=int(p.get("trailing_bytes", 184_100)))
        report = patches.patch_file(src, out, opts)
        checks = verify.verify(src, out)
        return {"output": self.rel(out), "applied": report.applied, "skipped": report.skipped,
                "notes": report.notes, "checks": [asdict(c) for c in checks],
                "ok": all(c.ok or c.warn for c in checks)}

    def open_folder(self, rel=None):
        target = self.path(rel) if rel else self.ws
        if target.is_file():
            target = target.parent
        if sys.platform == "win32":
            os.startfile(target)
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(target)])
        else:
            subprocess.Popen(["xdg-open", str(target)])


class Handler(BaseHTTPRequestHandler):
    app: "App | None" = None
    server_version = "oqm"

    def log_message(self, format, *args):
        pass

    def _send(self, code, body, ctype="application/json; charset=utf-8", extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _json(self, obj, code=200):
        self._send(code, json.dumps(obj).encode("utf-8"))

    def _body_json(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def do_GET(self):
        url = urlparse(self.path)
        path = url.path
        try:
            if path in ("/", "/index.html"):
                self._send(200, (UI_DIR / "index.html").read_bytes(), "text/html; charset=utf-8")
            elif path == "/api/state":
                self._json(self.app.state())
            elif path.startswith("/api/jobs/"):
                job = self.app.jobs.get(path.rsplit("/", 1)[-1])
                self._json(job) if job else self._json({"error": "no such job"}, 404)
            elif path.startswith("/files/"):
                self._serve_file(self.app.path(path[len("/files/"):]))
            else:
                self._json({"error": "not found"}, 404)
        except (ValueError, OSError) as e:
            self._json({"error": str(e)}, 400)

    def _serve_file(self, p):
        if not p.is_file():
            return self._json({"error": "not found"}, 404)
        self.send_response(200)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Content-Length", str(p.stat().st_size))
        self.send_header("Content-Disposition", f"attachment; filename*=UTF-8''{quote(p.name)}")
        self.end_headers()
        with open(p, "rb") as f:
            shutil.copyfileobj(f, self.wfile, CHUNK)

    def do_POST(self):
        # Custom header forces a CORS preflight, so other websites can't drive this server.
        if self.headers.get("X-OQM") != "1":
            return self._json({"error": "forbidden"}, 403)
        url = urlparse(self.path)
        try:
            if url.path == "/api/upload":
                name = parse_qs(url.query).get("name", ["upload.mp4"])[0]
                dst = self.app.unique_path(name)
                remaining = int(self.headers.get("Content-Length") or 0)
                with open(dst, "wb") as f:
                    while remaining > 0:
                        chunk = self.rfile.read(min(CHUNK, remaining))
                        if not chunk:
                            break
                        f.write(chunk)
                        remaining -= len(chunk)
                if remaining:
                    dst.unlink(missing_ok=True)
                    return self._json({"error": "upload interrupted"}, 400)
                self._json({"name": self.app.rel(dst)})
            elif url.path == "/api/run":
                body = self._body_json()
                self._json({"job": self.app.submit(body.get("action"), body.get("params") or {})})
            elif url.path == "/api/delete":
                p = self.app.path(self._body_json()["name"])
                p.unlink()
                if p.parent != self.app.ws and not any(p.parent.iterdir()):
                    p.parent.rmdir()
                self._json({"ok": True})
            elif url.path == "/api/open":
                self.app.open_folder(self._body_json().get("name"))
                self._json({"ok": True})
            else:
                self._json({"error": "not found"}, 404)
        except (ValueError, KeyError, OSError) as e:
            self._json({"error": str(e)}, 400)


def serve(workspace, port=8765, open_browser=True):
    Handler.app = App(workspace)
    try:
        httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    except OSError:
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)  # port busy: take any free one
    url = f"http://127.0.0.1:{httpd.server_address[1]}/"
    print(f"  OQM UI running at {url}\n  workspace: {Handler.app.ws}\n  press Ctrl+C to stop")
    if open_browser:
        threading.Timer(0.5, webbrowser.open, args=(url,)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  stopped")
    finally:
        httpd.server_close()
