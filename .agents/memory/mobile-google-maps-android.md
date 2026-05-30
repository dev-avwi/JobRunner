---
name: Mobile Android Google Maps setup
description: Why react-native-maps crashes with "API key not found" and how the key/project binding + rebuild requirement actually work
---

# Android Maps "API key not found" (IllegalStateException)

react-native-maps on Android needs a Maps key in the native AndroidManifest. For this Expo
managed app the key lives at `app.json` → `expo.android.config.googleMaps.apiKey`.

**Key facts that cost a long debugging session:**
- The Maps key **only lands in the build during `expo prebuild`** (which regenerates the native
  `android/` dir from app.json). A JS reload / Metro resync does NOT apply an app.json native
  change. The running dev build keeps crashing until a **fresh native build** (`npx expo run:android`
  or `eas build`).
- **Enabling "Maps SDK for Android" must happen on the GCP project that owns the key**, not just
  any project. The app's `google-services.json` belongs to Firebase project **jobrunner-8fe9d**
  (under org avwebinnovation.com). Enabling Maps SDK on a *different* project (e.g. white-rigging…)
  does nothing. Either enable it on jobrunner-8fe9d, or mint a key in a project you control and
  put that in app.json.
- Maps also won't render on an emulator **without a Google Play system image** (Play Store icon),
  even with a valid key.

**Why:** app.json native config is build-time only; Google keys are project-scoped.
**How to apply:** if maps fail on Android — confirm (1) key in app.json, (2) Maps SDK for Android
enabled on the *key's* project, (3) a fresh prebuild+rebuild, (4) Play-enabled emulator/device.

## User's local mobile build workflow (Ayden, MacBook)
Managed Expo, no committed `mobile/android/`. Builds locally via:
`cd mobile && npx expo run:android` (NOT eas). Needed one-time env setup on his Mac:
`JAVA_HOME` → Android Studio's JBR, `ANDROID_HOME` → ~/Library/Android/sdk + `android/local.properties`.
Repo path on his machine: `~/Documents/GitHub/JobRunner/mobile`.

## Emulator-only console errors (NOT real bugs)
- `[IAP] Billing is unavailable` (iap.ts) — IAP needs real Play Store; always fails on emulator.
- `[OfflineStorage] Full sync failed → NativeDatabase.prepareAsync rejected → NullPointerException`
  — expo-sqlite offline DB fails to open on some emulator images; caught, app falls back to server
  data. Both were downgraded console.error→console.warn (DEV-guarded) so they stop popping the red
  LogBox overlay during testing. Pattern: gracefully-handled fallbacks should warn, not error.
