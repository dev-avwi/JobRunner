#!/usr/bin/env bash
# Mobile TypeScript check.
# Runs `tsc --noEmit` and compares the resulting error SET (not just count)
# against the committed baseline at scripts/typecheck-baseline.txt. Exits
# non-zero if any error not in the baseline appears (regression). Pre-existing
# type drift is tolerated; see scripts/typecheck-baseline.txt for the
# catalogued set.
#
# Usage:
#   ./scripts/typecheck.sh           # check against baseline
#   ./scripts/typecheck.sh --update  # rewrite baseline (after fixing errors)
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BASELINE="$SCRIPT_DIR/typecheck-baseline.txt"
OUT="$(mktemp)"
CUR="$(mktemp)"
trap 'rm -f "$OUT" "$CUR"' EXIT

cd "$MOBILE_DIR"
npx tsc --noEmit > "$OUT" 2>&1 || true

grep "error TS" "$OUT" | sort -u > "$CUR"
CURRENT=$(wc -l < "$CUR" | tr -d ' ')
BASE=$(grep -c "error TS" "$BASELINE" 2>/dev/null || echo 0)

if [ "${1:-}" = "--update" ]; then
  cp "$CUR" "$BASELINE"
  echo "Baseline updated: $CURRENT errors recorded."
  exit 0
fi

echo "TypeScript errors: $CURRENT (baseline $BASE)"

# Set-based diff: any error in current that isn't in baseline is a regression.
NEW=$(comm -23 "$CUR" <(sort -u "$BASELINE"))
if [ -n "$NEW" ]; then
  NEW_COUNT=$(printf "%s\n" "$NEW" | wc -l | tr -d ' ')
  echo
  echo "REGRESSION: $NEW_COUNT new TypeScript error(s) introduced." >&2
  printf "%s\n" "$NEW" | head -50 >&2
  exit 1
fi

# Helpful nudge if errors were fixed.
FIXED=$(comm -13 "$CUR" <(sort -u "$BASELINE") | wc -l | tr -d ' ')
if [ "$FIXED" -gt 0 ]; then
  echo "Improved by $FIXED error(s). Run with --update to record the new baseline."
fi

exit 0
