@echo off
setlocal EnableExtensions
rem OQM launcher (Windows).
rem   Double-click it          - opens the app in your browser.
rem   Drag videos onto it      - patches them on the spot (C or B), saved next to the originals.
cd /d "%~dp0"
chcp 65001 >nul
for /f %%e in ('echo prompt $E^| cmd') do set "E=%%e"
title OQM

echo.
echo %E%[38;5;213m    ██████   ██████  ███    ███%E%[0m
echo %E%[38;5;177m   ██    ██ ██    ██ ████  ████%E%[0m
echo %E%[38;5;141m   ██    ██ ██    ██ ██ ████ ██%E%[0m
echo %E%[38;5;105m   ██    ██ ██ ▄▄ ██ ██  ██  ██%E%[0m
echo %E%[38;5;69m    ██████   ██████  ██      ██%E%[0m
echo %E%[38;5;69m                ▀▀%E%[0m
echo %E%[90m   open quality method · free · runs on your PC%E%[0m
echo.

where python >nul 2>nul || goto :nopython
where ffmpeg >nul 2>nul || goto :noffmpeg
if "%~1"=="" goto :ui

rem ---- drag-and-drop mode -------------------------------------------------
echo   %E%[1mWhich method?%E%[0m
echo     %E%[92m[C]%E%[0m Decoy only   %E%[90m- recommended, fewest changes%E%[0m
echo     %E%[96m[B]%E%[0m Full method  %E%[90m- all 8 patches, try if C stops working%E%[0m
echo.
choice /c CB /n /m "  Press C or B: "
if errorlevel 2 (set "P=reference" & set "T=B") else (set "P=minimal" & set "T=C")
set /a OK=0, BAD=0

:next
if "%~1"=="" goto :done
echo.
echo %E%[90m  ─────────────────────────────────────────────%E%[0m
python -m oqm patch "%~1" --profile %P% -o "%~dpn1_%T%.mp4"
if errorlevel 1 (set /a BAD+=1 & echo   %E%[91m✗ failed, file not saved%E%[0m) else (set /a OK+=1 & echo   %E%[92m✓ ready to upload%E%[0m)
shift
goto :next

:done
echo.
echo %E%[90m  ─────────────────────────────────────────────%E%[0m
echo   %E%[1m%OK% done, %BAD% failed.%E%[0m Patched files end in %E%[1m_%T%.mp4%E%[0m, next to the originals.
echo.
pause
exit /b

rem ---- app mode -----------------------------------------------------------
:ui
echo   Opening OQM in your browser. %E%[90mKeep this window open; close it to quit.%E%[0m
echo   %E%[90mTip: drag videos onto this .bat to patch them without the app.%E%[0m
echo.
python -m oqm ui
if errorlevel 1 pause
exit /b

rem ---- missing tools --------------------------------------------------------
:nopython
echo   %E%[91mPython not found.%E%[0m Install it from https://www.python.org/downloads/
echo   and tick "Add python.exe to PATH" in the installer. Then open OQM again.
echo.
pause
exit /b 1

:noffmpeg
echo   %E%[91mFFmpeg not found.%E%[0m OQM needs it to read and check videos.
where winget >nul 2>nul || goto :noffmpeg_manual
choice /c YN /m "  Install it now with winget"
if errorlevel 2 goto :noffmpeg_manual
winget install --id Gyan.FFmpeg -e
echo.
echo   %E%[92mDone.%E%[0m Close this window and open OQM again.
pause
exit /b

:noffmpeg_manual
echo   Get it from https://www.gyan.dev/ffmpeg/builds/ and add its bin folder to PATH.
echo.
pause
exit /b 1
