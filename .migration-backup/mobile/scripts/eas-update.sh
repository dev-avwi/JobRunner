#!/usr/bin/env bash
# OTA update preflight for the JobRunner mobile app.
#
# Refuses to ship an EAS Update unless EXPO_PUBLIC_API_URL is set to a real
# production host. This guards against the failure mode where an OTA bundle
# is published from a shell that has no API URL configured — the bundle then
# runs against the dev fallback (`http://localhost:5000`) on real devices and
# every API call fails.
#
# Usage:
#   ./mobile/scripts/eas-update.sh production "Fixes login redirect"
#   ./mobile/scripts/eas-update.sh preview    "QA build for Sarah"
set -euo pipefail

CHANNEL="${1:-}"
MESSAGE="${2:-}"

if [[ -z "$CHANNEL" ]]; then
  echo "[eas-update] usage: $0 <channel> [message]" >&2
  exit 2
fi

if [[ -z "${EXPO_PUBLIC_API_URL:-}" ]]; then
  echo "[eas-update] REFUSING TO PUBLISH: EXPO_PUBLIC_API_URL is not set." >&2
  echo "[eas-update] export EXPO_PUBLIC_API_URL=https://jobrunner.com.au and retry." >&2
  exit 1
fi

# Reject obvious non-prod hosts (mirrors mobile/src/lib/api.ts assertProdHostAllowed).
case "$EXPO_PUBLIC_API_URL" in
  *localhost*|*127.0.0.1*|*10.0.2.2*|*.replit.dev*|*.repl.co*|http://*)
    echo "[eas-update] REFUSING TO PUBLISH: EXPO_PUBLIC_API_URL=\"$EXPO_PUBLIC_API_URL\" is not a valid production host." >&2
    exit 1
    ;;
esac

echo "[eas-update] API URL OK: $EXPO_PUBLIC_API_URL"
echo "[eas-update] channel=$CHANNEL"

cd "$(dirname "$0")/.."

CMD=(eas update --channel "$CHANNEL")
if [[ -n "$MESSAGE" ]]; then
  CMD+=(--message "$MESSAGE")
fi

echo "[eas-update] running: ${CMD[*]}"
exec "${CMD[@]}"
