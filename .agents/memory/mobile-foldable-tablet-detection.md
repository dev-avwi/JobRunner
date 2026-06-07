---
name: Android foldable tablet/sidebar detection
description: Fold/unfold must flip phone bottom-nav <-> tablet sidebar; both directions are dimension-threshold + stale-read sensitive on Android foldables
---

The app picks sidebar (tablet) vs bottom-nav (phone) layout from `isTablet()` in
`mobile/src/lib/device.ts`, driven reactively by `useIsTablet`/`useShouldUseSidebar`
(both subscribe to `Dimensions` 'change'). NOTE: `mobile/app/_layout.tsx` defines its
OWN local `useIsTablet()` too — keep both in sync.

**Rule 1 — use live `window`, not `screen`, on Android.** Decide tablet/foldable
layout from `Dimensions.get('window')` (or the event payload) min-dimension ONLY —
never `Math.max(screen, window)`. `screen` keeps reporting the larger physical *inner*
display even after folding back to the cover display, so a screen-based check stays
stuck in sidebar on fold-back. `window` tracks the active display and shrinks on fold.

**Rule 2 — pass the event's fresh `window` payload into detection.** `isTablet()`
takes an optional `windowDims`; the hooks pass the `change` event's `window` instead of
re-reading global `Dimensions.get('window')`. Android emits intermediate change events
while the posture settles, so a global re-read can be stale and miss the transition.

**Rule 3 — threshold is 672 (`TABLET_MIN_DIMENSION`), NOT 744.** Unfolding back to the
wide inner display must revert to sidebar. The trap: in LANDSCAPE the `window`
min-dimension is the *height*, shaved by the status/nav bars to ~700pt on an unfolded
foldable — so the old 744 left it on phone nav and it never reverted on unfold. 672
clears that (~700) while staying well above the largest phones (min-dim ~430-480) and
still capturing iPad mini (744). iPad short-circuits via `Platform.isPad` (true early);
iPad sidebar is still orientation-gated (landscape only) in `useShouldUseSidebar`.

**Why:** prior session fixed fold-back (Rule 1) but the window-only switch made the
unfolded landscape min-dim fall just under 744, regressing unfold->sidebar. 672 + fresh
dims fixes both directions.
