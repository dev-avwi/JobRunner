---
name: Android foldable tablet/sidebar detection
description: Folding back from inner to cover display didn't revert sidebar->phone layout; screen dim is stale on Android foldables
---

The app picks sidebar (tablet) vs bottom-nav (phone) layout from `isTablet()` in
`mobile/src/lib/device.ts`, driven reactively by `useIsTablet`/`useShouldUseSidebar`
(both subscribe to `Dimensions` 'change').

**Rule:** On Android, decide tablet/foldable layout from `Dimensions.get('window')`
min-dimension ONLY — never `Math.max(screen, window)`.

**Why:** On Android foldables (Z Fold, Pixel Fold) `Dimensions.get('screen')` keeps
reporting the larger physical *inner* display even after you fold back to the small
outer/cover display. A `Math.max(min(screen), min(window))` check stays above the
threshold, so the app gets stuck in sidebar/tablet layout and never reverts to phone
nav when folded. `window` tracks the currently active display, so it shrinks on fold-back.

**How to apply:** Keep the `Math.max(screen, window)` logic ONLY for iOS non-iPad
(split-view/zoom reliability); iPad returns true early. TABLET_MIN_DIMENSION is 744.
The reactive hooks already re-run on dimension change, so no extra wiring needed.
