#!/bin/bash
# Double-click (macOS) to start the Kabinet admin; it opens in your browser.
# Must stay LF and executable (.gitattributes keeps the line endings).
cd "$(dirname "$0")" || exit 1
PORT="${PORT:-4322}"
URL="http://localhost:$PORT"

pause() { echo; read -r -p "Stiskni Enter pro zavreni..."; }

# Already running (another Terminal window): just open it instead of failing on a busy port.
if curl -s -o /dev/null --max-time 2 "$URL/api/state"; then
  echo "Kabinet uz bezi, oteviram $URL"
  [ -z "$NO_OPEN" ] && open "$URL"
  exit 0
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js neni nainstalovany. Stahni ho z https://nodejs.org"
  pause; exit 1
fi

# First run, or the dependencies changed since the last install (package-lock.json is newer).
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "Instaluji zavislosti..."
  if ! npm install; then
    echo; echo "Instalace selhala."
    pause; exit 1
  fi
fi

npm run admin
STATUS=$?
# Ctrl+C (130) and closing the window (143) are normal stops, nothing to read.
if [ $STATUS -ne 0 ] && [ $STATUS -ne 130 ] && [ $STATUS -ne 143 ]; then
  echo; echo "Admin skoncil s chybou ($STATUS), zprava je vyse."
  pause
fi
exit $STATUS
