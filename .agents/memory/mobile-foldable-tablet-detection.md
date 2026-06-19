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

**Rule 3 — threshold is 600 (`TABLET_MIN_DIMENSION`), was 744→672→600.** Unfolding
must flip to sidebar. KEY DEDUCTION when "sidebar never shows on unfold": even the OLD
layout code would have shown the sidebar at >=threshold, so if BOTH old and new
unfolded screenshots show bottom-nav, the device's unfolded min-dimension is BELOW the
threshold (misclassified as a phone) — lower the threshold, don't chase the layout
code. 672 still left some narrower foldable inner displays (Z Fold ~600-700pt after
status/nav-bar inset, esp. in landscape where min-dim is the height) on phone nav; 600
captures them while staying clear of the largest phones (min-dim ~430-480). iPad
short-circuits via `Platform.isPad`; iPad sidebar is orientation-gated (landscape only)
in `useShouldUseSidebar`. `WIDE_CONTENT_THRESHOLD` was lowered to match (600).

**Rule 4 — the "linking configured in multiple places" error on fold is a NATIVE fix
that needs a full rebuild.** Android recreates the Activity on fold/unfold unless
`android:configChanges` (screenLayout/screenSize/smallestScreenSize + the usual set) is
declared on MainActivity. It's added via a managed config plugin
(`mobile/plugins/withAndroidFoldableConfigChanges.js`, registered in `app.json`
plugins) so it only takes effect after `expo prebuild` + a new native dev build/APK —
it is INERT in Expo Go and in any build made before the plugin. So if the user STILL
sees that error + a full-app reload on fold, the running build is stale: the answer is
"rebuild", not more code. JS layout/threshold changes reach the device via Metro
reload; the configChanges does not.

**Rule 5 — if UNFOLDED still reports COVER dimensions (e.g. 443x970, min 443),
the activity is being letterbox-SCALED, not resized — add `resizeableActivity=true`.**
A temp `__DEV__` badge printing `useWindowDimensions` proved that on the foldable
emulator the UNFOLDED view still reports the small cover-display size (443 wide), so no
threshold (even 443) is correct — a 443-wide surface IS a phone. The OS was scaling the
cover surface up to fill the inner display (looks "wide" but app still sees 443).
Fix: the same `withAndroidFoldableConfigChanges.js` plugin now also sets
`android:resizeableActivity="true"` on MainActivity so the OS hands over the REAL
inner-display size on unfold. Like configChanges, this is a NATIVE manifest change —
INERT until `expo prebuild` + native rebuild. Confirmation that the running build is
stale: the "linking configured in multiple places" error CANNOT fire if configChanges
is active (it only appears on Activity remount), so seeing it = the plugin isn't in the
build yet = rebuild needed before judging any foldable behavior.

**Why:** prior session fixed fold-back (Rule 1) and the remount/linking error (Rule 4,
JS layout kept the navigator mounted + native configChanges), but the unfolded display
was still under 672 so the sidebar never appeared; 600 + fresh dims fixes detection,
the linking error only clears once the native configChanges build ships, AND the
unfolded surface only reports its true inner-display size once resizeableActivity ships
in that same native rebuild (Rule 5).
