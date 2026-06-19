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
  QuickActionSheet) into a `ScrollView` with `flexShrink:1` so rows stay
  reachable instead of hard-clipping. Keep fixed-height `snapPoints` callers
  (`scrollable===false && !autoHeight`) on the `flex:1` View — they nest their
  own scroll/lists, so don't convert them (nested-VirtualizedList).

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
