---
name: Expo preview validation
description: Reliable validation path for this mobile Expo project when the browser preview is blocked by native-only modules
---

For this project, the browser root can fail during Expo Router static rendering because some screens import native-only modules such as `react-native-maps`. That does not necessarily indicate a native bundle problem.

**Why:** The actual mobile development client uses the Expo virtual Metro entry and platform-specific resolution, while the web root traverses native-only imports.

**How to apply:** Validate mobile changes with the Expo virtual entry using `platform=android` or `platform=ios`, and treat a web-root failure as a separate compatibility issue unless the native bundle also fails.