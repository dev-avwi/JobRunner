#!/usr/bin/env bash
# Orchestrates the Insights period contract tests: ensures the app server is
# up (starting it if necessary), runs the test suite, and tears the server
# down again if this script started it.
set -u
BASE_URL="${BASE_URL:-http://localhost:5000}"
STARTED_PID=""

is_up() { curl -sf --max-time 3 "$BASE_URL/api/health" >/dev/null 2>&1; }

if ! is_up; then
  echo "Server not running at $BASE_URL — starting dev server..."
  npm run dev >/tmp/insights-test-server.log 2>&1 &
  STARTED_PID=$!
  for i in $(seq 1 45); do
    is_up && break
    sleep 2
  done
  if ! is_up; then
    echo "Server failed to become healthy at $BASE_URL (see /tmp/insights-test-server.log)"
    [ -n "$STARTED_PID" ] && kill "$STARTED_PID" 2>/dev/null
    exit 1
  fi
fi

BASE_URL="$BASE_URL" npx tsx tests/insights-period.test.ts
RC=$?

if [ -n "$STARTED_PID" ]; then
  kill "$STARTED_PID" 2>/dev/null
  wait "$STARTED_PID" 2>/dev/null
fi
exit $RC
