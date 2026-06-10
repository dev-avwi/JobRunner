---
name: Mobile foldable layout reactivity
description: Why sidebar/phone layout only toggled once on Android fold/unfold and the fix
---

On Android foldables (Z Fold, Pixel Fold) the app would switch between phone
(bottom tabs, portrait/cover display) and tablet (sidebar, unfolded inner display)
the FIRST time, then stop reacting on subsequent fold/unfold cycles.

**Cause:** the responsive hooks in `mobile/src/lib/device.ts` (useIsTablet,
useOrientation, useShouldUseSidebar, useContentWidth) each set up their own
`Dimensions.addEventListener('change')` subscription, and `_layout.tsx` had a
DUPLICATE local useIsTablet. The manual listeners drifted/went stale across repeated
posture changes.

**Fix:** derive all of them from React Native's built-in `useWindowDimensions()`
(the documented reactive API) and delete the duplicate hook so device.ts is the one
source of truth. The pure `isTablet(dims)` / `getOrientation()` functions stay for
imperative/initial reads.

**Why:** useWindowDimensions re-renders on every dimension change reliably; hand-rolled
Dimensions subscriptions are the usual culprit when "responsive layout updates once
then stops" on foldables/split-view.

**How to apply:** any new responsive layout value on mobile must come from
useWindowDimensions(), never a fresh Dimensions.addEventListener. Sidebar policy:
iPad = landscape only (width>height); non-iPad tablet/unfolded foldable = always
(isTablet min-dimension >= 672).
