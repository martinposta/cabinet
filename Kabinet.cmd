@echo off
rem Double-click on Windows to start the Kabinet admin; it opens in your browser.
rem The Windows twin of Kabinet.command. Must stay CRLF (.gitattributes).
setlocal
cd /d "%~dp0"
if "%PORT%"=="" set PORT=4322
set URL=http://localhost:%PORT%

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js neni nainstalovany. Stahni ho z https://nodejs.org ^(verze LTS^) a spust tohle znovu.
  pause
  exit /b 1
)

rem Already running (another window): just open it instead of failing on a busy port.
curl -s -o nul --max-time 2 "%URL%/api/state" >nul 2>nul
if not errorlevel 1 (
  echo Kabinet uz bezi, oteviram %URL%
  start "" "%URL%"
  exit /b 0
)

rem Dependencies: missing, or copied over from a Mac. sharp (the image library) is built for one system,
rem so a node_modules from macOS does not load here - then it is reinstalled for Windows.
node -e "require('sharp')" >nul 2>nul
if errorlevel 1 (
  echo Instaluji zavislosti pro Windows...
  if exist node_modules rmdir /s /q node_modules
  call npm ci
  if errorlevel 1 (
    echo.
    echo Instalace selhala.
    pause
    exit /b 1
  )
)

call npm run admin
if errorlevel 1 (
  echo.
  echo Admin skoncil s chybou, zprava je vyse.
  pause
)
endlocal
