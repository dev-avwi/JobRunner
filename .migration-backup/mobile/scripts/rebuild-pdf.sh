#!/usr/bin/env bash
#
# One-shot clean rebuild that guarantees the PDF picker (expo-document-picker)
# native module gets compiled into the iOS app.
#
# Run it from anywhere on your Mac:
#   bash ~/Documents/GitHub/JobRunner/mobile/scripts/rebuild-pdf.sh
#
# It stops with a clear message the moment a step fails, so you know exactly
# what to send back.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")"
REPO_DIR="$(dirname "$MOBILE_DIR")"

line() { printf '\n========================================\n%s\n========================================\n' "$1"; }
fail() { printf '\n\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\nFAILED: %s\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n' "$1"; exit 1; }

line "STEP 1/6 — get the latest code from GitHub"
cd "$REPO_DIR" || fail "could not enter repo folder $REPO_DIR"
git fetch origin || fail "git fetch failed (no internet? not a git repo?)"
echo ">> This resets your local copy to match GitHub exactly (discards local edits)."
git reset --hard origin/main || fail "git reset failed"

line "STEP 2/6 — wipe old install + old native project"
cd "$MOBILE_DIR" || fail "could not enter mobile folder"
rm -rf node_modules ios
echo ">> removed node_modules and ios/"

line "STEP 3/6 — install packages"
npm install || fail "npm install failed — send me the red error text above"

line "CHECK 1 — is the PDF package installed?"
if [ -d node_modules/expo-document-picker ]; then
  echo ">> PASS: expo-document-picker is installed"
else
  fail "expo-document-picker is NOT in node_modules. npm install did not add it. Send me the STEP 3 output."
fi

line "STEP 4/6 — regenerate the native iOS project (this is the step that adds the PDF module)"
npx expo prebuild --clean || fail "expo prebuild failed — send me the error above"

line "CHECK 2 — did the PDF native module get linked into the build?"
if grep -iq documentpicker ios/Podfile.lock 2>/dev/null; then
  echo ">> PASS: ExpoDocumentPicker is in the native build"
else
  fail "ExpoDocumentPicker is NOT in ios/Podfile.lock. The module won't exist no matter how many times you rebuild. Send me this message."
fi

line "STEP 5/6 — build and install the app onto your phone"
echo ">> This takes a few minutes and needs your phone plugged in / paired."
npx expo run:ios -d || fail "expo run:ios failed — send me the last ~30 lines above"

line "STEP 6/6 — DONE"
echo ">> Both checks passed and the app rebuilt. The PDF picker will now work."
echo ">> Open Files, tap Add, choose Attach File (PDF)."
