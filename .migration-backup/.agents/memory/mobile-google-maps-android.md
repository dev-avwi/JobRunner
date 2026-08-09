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

## Blank tiles + only the "Google" watermark (key NOT authorized)
Different from "API key not found" (which throws). Here the MapView mounts, the Google
logo shows, but tiles never paint. Means the key is wired but Google is rejecting auth at
runtime. Worked-before-now-blank on Android = one of: (1) billing disabled / free credit
expired on the key's GCP project, (2) Maps SDK for Android disabled, (3) key application
restrictions (SHA-1/package) don't match a freshly-signed build. Logcat prints the exact
reason. Quick triage: temporarily set key restrictions to None; confirm app health by
running iOS (Apple Maps, no key — see provider line: iOS=undefined, Android=PROVIDER_GOOGLE).
**iOS is immune** to all of this because it uses Apple Maps, not Google.

**Confirmed cause for this app (billing ON / SDK enabled, still blank): SHA-1 lock.**
The single key (`AIzaSy…IleHeU`, project jobrunner-8fe9d, in BOTH app.json and
google-services.json) has Application restrictions = Android apps, locked to package
`com.jobrunner.app` + ONE release SHA-1 fingerprint. A debug/emulator build (`expo run:android`,
signed with `~/.android/debug.keystore`) has a DIFFERENT SHA-1 → Google rejects → blank tiles.
Fix: add BOTH the debug-keystore SHA-1 (keytool on the user's Mac) AND the EAS/Play release SHA-1
(`eas credentials` or Play App Signing) to the key's Android restrictions; wait ~5 min. Pay-as-you-go
billing and an enabled Maps SDK do NOT override this lock.

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
