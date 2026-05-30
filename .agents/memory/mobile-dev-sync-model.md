---
name: Mobile dev sync model (Replit ↔ user's Mac)
description: Why mobile code edits don't appear on the user's device until they git pull; how the Replit workspace, GitHub, and the local Mac Metro server relate.
---

The user (Ayden) runs the Expo/Metro dev server **on their own MacBook**, against a **local clone** of the repo (Metro serves at the Mac's LAN IP, e.g. `http://192.168.50.31:8081`; the dev-client phone/emulator connects to that).

The Replit Agent workspace is a **separate** checkout. Agent edits + checkpoints are git commits on `main`, and Replit auto-pushes `main` to GitHub `origin` (`github.com/dev-avwi/JobRunner`). So after an agent edit, `HEAD == origin/main` here, but the **Mac still has old code**.

**Consequence:** any JS/code change the agent makes will NOT appear on the device — no matter how many times the user reloads Metro — until they `git pull` on the Mac and let Metro re-bundle. Symptom: a screen looks byte-for-byte identical across multiple agent "fixes" (classic: the Sign Out dialog never changing).

**The fix the user must run on their Mac** (in the repo root): `git pull` → then in Metro press `r` (or shake → Reload). For native/app.json changes they also need `expo prebuild` + `expo run:android`; JS-only changes just need pull + reload.

**Exceptions that DON'T need a pull:** changes outside the bundled JS — e.g. Google Maps API key/restriction changes in the GCP console (server-side, took effect without any pull; that's why "maps works now" while code fixes didn't).

**Why:** without this model you waste turns re-editing/re-styling a component that is actually correct on `origin/main`; the real blocker is the Mac never pulled. Always confirm the user has pulled before assuming a code fix failed.

**How to apply:** when the user reports a mobile change "still broken" and the screenshot is identical to before your edits, suspect stale local code first. Verify `git log origin/main` here has your commit, then tell them to `git pull` + reload on the Mac before debugging further.

**Stale dev-client trap (proven 2026-05-30):** pull + `expo start -c` + reconnect did NOT update the dialog because the **installed dev-client APK had old JS baked in / wasn't picking up the fresh bundle**. The tell: a component looks identical even across a Platform-level behavior change (Android dialog went from native `Alert.alert` to a themed in-app `Modal`, yet the device still rendered the native-alert layout). When pull+reload provably can't be the cause, the fix is a **full native rebuild** (`expo run:android`), which recompiles the current on-disk code. After a fresh dev build is installed + connected to Metro, later JS-only changes hot-reload normally again.

**User's Mac build env (Aydens-MBP, confirmed 2026-05-30) — `expo run:android` needs all three or it fails in sequence:**
- Repo is at `~/Documents/GitHub/JobRunner` (GitHub Desktop default), NOT `~/Documents/JobRunner`. Build runs from `…/JobRunner/mobile`.
- `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"` (no standalone JRE installed → "Unable to locate a Java Runtime" without it).
- `ANDROID_HOME=~/Library/Android/sdk` + `echo "sdk.dir=$ANDROID_HOME" > android/local.properties` (else gradle "SDK location not found"). Both exported into `~/.zshrc` now.
- First build is slow (10–20 min): downloads gradle, NDK 27.x, build-tools 35. Subsequent builds fast.

**Harmless dev-only noise:** `[OfflineStorage] Failed to clear cached auth data: … NativeDatabase.prepareAsync rejected / NullPointerException` on the emulator is **caught** (try/catch in `clearCachedAuthData`, logged only under `__DEV__`) and does NOT block logout. Don't chase it as a sign-out bug.
