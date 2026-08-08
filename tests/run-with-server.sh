#!/usr/bin/env bash
# Generic test orchestrator: ensures the app server is up (starting it if
# necessary), runs the given tests/*.test.ts files with tsx, and tears the
# server down again if this script started it.
#
# Usage: bash tests/run-with-server.sh tests/sheet-sync.test.ts [more tests...]
set -u
if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <test-file> [more test files...]"
  exit 2
fi

BASE_URL="${BASE_URL:-http://localhost:5000}"
STARTED_PID=""

is_up() { curl -sf --max-time 3 "$BASE_URL/api/health" >/dev/null 2>&1; }

if ! is_up; then
  echo "Server not running at $BASE_URL — starting dev server..."
  npm run dev >/tmp/test-run-server.log 2>&1 &
  STARTED_PID=$!
  for i in $(seq 1 45); do
    is_up && break
    sleep 2
  done
  if ! is_up; then
    echo "Server failed to become healthy at $BASE_URL (see /tmp/test-run-server.log)"
    [ -n "$STARTED_PID" ] && kill "$STARTED_PID" 2>/dev/null
    exit 1
  fi
fi

RC=0
for TEST in "$@"; do
  echo ""
  echo "=== Running $TEST ==="
  BASE_URL="$BASE_URL" npx tsx "$TEST"
  T_RC=$?
  if [ "$T_RC" -ne 0 ]; then
    echo "FAILED: $TEST (exit $T_RC)"
    RC=1
  fi
done

if [ -n "$STARTED_PID" ]; then
  kill "$STARTED_PID" 2>/dev/null
  wait "$STARTED_PID" 2>/dev/null
fi
exit $RC
