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
---
name: AppBottomSheet clipped to header on Android foldable
description: ActionSheet/QuickActionSheet menus show only their header (rows clipped) on Android foldables; native Modal window goes stale on fold/unfold
---

`AppBottomSheet` (mobile/src/components/ui/AppBottomSheet.tsx) is the native-Modal
sheet behind ActionSheet, QuickActionSheet, and all `<AppBottomSheet>` callers.

**Symptom:** On Android foldables, a sheet opens showing ONLY its header/title +
close X; the body rows are gone (e.g. "Job Actions" menu with Duplicate/Delete/
Cancel shows none). iOS is unaffected (ActionSheet uses native ActionSheetIOS).

**Cause:** three compounding issues — (1) window size read once via
`Dimensions.get('window')`, which goes stale on foldables after fold/unfold;
(2) the native RN `<Modal>` dialog window can keep a stale too-short size on
foldables, so the bottom-anchored sheet's rows overflow below the visible window
and the sheet's `overflow:'hidden'` clips them to just the header; (3) the
autoHeight + `scrollable={false}` body was a plain `View` that hard-clips when
vertical space is squeezed.

**Fix / rules:**
- Use `useWindowDimensions()` (reactive), never `Dimensions.get('window')`, for
  sheet height/maxHeight — same foldable-staleness rule as isTablet().
- Put `key={`${screenWidth}x${screenHeight}`}` on the `<Modal>` so it remounts
  and the native dialog re-measures on fold/unfold.
- Route ONLY `scrollable===false && autoHeight` (short menus: ActionSheet /
  QuickActionSheet) into a `ScrollView` capped with an explicit reactive
  `maxHeight` (`menuScrollMaxHeight = maxSheetHeight - header/footer allowance`)
  so rows size to content when short and scroll (stay reachable) when too tall.
  Do NOT use `flexShrink:1` here: a ScrollView's flex-basis does NOT measure to
  its content height on iOS, so flexShrink compresses the rows even with plenty
  of room (squished menu — every short ActionSheet was half-height). Keep
  fixed-height `snapPoints` callers (`scrollable===false && !autoHeight`) on the
  `flex:1` View — they nest their own scroll/lists, so don't convert them
  (nested-VirtualizedList).

**How to apply:** any new sheet-content rendering branch must preserve this
scrollable/autoHeight/snapPoints split, and any sizing must come from the
reactive hook, or foldables regress.

**Related top-safe-area rule (status bar overlap):** the sheet is bottom-anchored
inside a `statusBarTranslucent` `overFullScreen` Modal, so its top edge is at
`screenHeight - sheetHeight`. A flat `screenHeight * 0.92` cap leaves an 8% top
gap that exceeds the status bar on tall phones but is SHORTER than it on a short
display (Android foldable UNFOLDED) → 90%/92% snapPoint sheets (Add Item, Create
Tax Invoice, Edit Item, etc.) push their header title up into the status bar.
Fix = cap `maxSheetHeight = Math.max(0, Math.min(screenHeight*0.92, screenHeight
- insets.top - spacing.sm))`. `Math.min` keeps phones at 92% (the new term only
bites on short screens); `Math.max(0,...)` guards extreme multi-window. Both
fixed (`fixedSheetHeight` clamps to it) and autoHeight (`maxHeight`) paths use it,
so this one cap fixes every `<AppBottomSheet>` caller at once — fix here, not per
screen.
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
