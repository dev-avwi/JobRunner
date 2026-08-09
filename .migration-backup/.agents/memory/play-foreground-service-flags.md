---
name: Play Console foreground-service permission flags
description: Where Android foreground-service permission flags come from and how to remove an unused mobile dep without npm install
---

Google Play "undeclared foreground service permissions" flags come from library manifests merged into the AAB, even for packages the app never imports (expo-audio shipped FOREGROUND_SERVICE_MEDIA_PLAYBACK + a mediaPlayback service while only expo-av was actually used). `blockedPermissions` in app.json strips the permission but the form can still appear for older builds already in a track.

**Why:** Play requires a declaration + demo video per flagged permission; a video for a feature that doesn't really run in background gets rejected. Removing the dep is the honest fix.

**How to apply:** Confirm zero imports (`grep -rn '<pkg>' mobile/src mobile/app ...`), then remove the dep by editing BOTH `mobile/package.json` and `mobile/package-lock.json` via a node JSON script (delete `packages[""].dependencies[pkg]` and `packages["node_modules/<pkg>"]`). Never run npm install in mobile here (firewall); lockfile surgery is safe for a leaf dep with no dependents. FOREGROUND_SERVICE_LOCATION is legit (expo-location background tracking/geofencing) — declare with team-map demo video.
