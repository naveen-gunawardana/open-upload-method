@echo off
rem Double-click to open the OQM interface. Needs Python 3.10+ and FFmpeg on PATH.
cd /d "%~dp0"
where python >nul 2>nul || (echo Python not found. Install it from https://www.python.org/downloads/ ^(tick "Add to PATH"^). & pause & exit /b 1)
python -m oqm ui %*
if errorlevel 1 pause
