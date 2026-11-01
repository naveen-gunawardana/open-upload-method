# PyInstaller recipe for the OQM desktop app. Build with: pyinstaller oqm.spec
# Expects ffmpeg and ffprobe in ./bin (fetched by build_app.py).
import sys

exe_ext = ".exe" if sys.platform == "win32" else ""
a = Analysis(
    ["app.py"],
    datas=[("oqm/ui/index.html", "oqm/ui")],
    binaries=[(f"bin/ffmpeg{exe_ext}", "bin"), (f"bin/ffprobe{exe_ext}", "bin")],
)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name="OQM", console=True)
coll = COLLECT(exe, a.binaries, a.datas, name="OQM")
if sys.platform == "darwin":
    app = BUNDLE(coll, name="OQM.app", bundle_identifier="com.openqualitymethod.oqm")
