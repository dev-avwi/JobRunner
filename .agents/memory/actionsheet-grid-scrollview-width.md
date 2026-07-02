---
name: ActionSheet grid even-width inside AppBottomSheet
description: How to make grid ActionSheet cards spread evenly full-width; flex/% collapse there, use explicit pixel widths
---

Grid-layout ActionSheet cards (`mobile/src/components/ui/ActionSheet.tsx`, e.g. the
Upload Document sheet) must spread evenly across the full sheet width. They kept
bunching to the left.

**Rule:** inside `AppBottomSheet`'s auto-height ScrollView content container, DO NOT
size the row children with `flex:1` (flex-basis 0%) or percentage widths — both fail
to distribute and pack the cards to `flex-start`. Removing `flexWrap` does not fix it.
Use deterministic pixel widths + `justifyContent:'space-between'` instead:
- container: explicit `width = windowWidth - contentPadding*2`;
- each card: explicit `width = containerWidth / columns` (NOT flex, NOT %);
- grid style: `flexDirection:'row'`, `justifyContent:'space-between'`, no flexWrap.

**Why:** the sheet is always full window width (full-screen Modal, `sheet` width
100% no maxWidth, default `contentPadding = spacing.lg`), so `windowWidth -
spacing.lg*2` IS the content box — verified on-device that a stretch child gets that
exact width. The failure is flex-basis-0 not resolving in that container, not the box
being narrow. So don't add a measuring probe "for tablets/foldables"; if ActionSheet
passes a custom `contentPadding`, update the subtraction to match.

**How to apply:** any even-width single row inside AppBottomSheet → explicit pixel
widths from `useWindowDimensions()` minus sheet padding, spread with
`space-between`. Never reach for `flex:1`/`%` there.

**Icon+label centering:** center the icon and the label with the SAME full-width
mechanism, or they drift apart (offset grows with label length). Both the icon
wrapper and the label get `alignSelf:'stretch'` + center (icon: `alignItems:'center'`;
label: `textAlign:'center'`). A bare 60px chip left to the parent's `alignItems`
resolves its center against a different reference than a stretched label.

**Equal columns need `minWidth:0` on each card:** even with explicit `width =
containerWidth/columns`, a card whose label has a wide min-content ("Attach File
(PDF)") grows PAST its assigned width, because RN flex items default to
`minWidth:auto` (= min-content) and won't shrink below it. Unequal card widths + 
`space-between` then space the icon CENTERS unevenly (the middle icon drifts toward
the shorter neighbour) — reads as "alignment feels off". Fix = add `minWidth:0` to
the card style so every cell honors its width and long labels wrap (numberOfLines:2)
inside the cell instead of stretching it. Tradeoff: long labels wrap to 2 lines on
narrow phones — acceptable; if single-line is required, shorten the copy, don't
weaken the equal-width constraint.

**Sync caveat:** fixes reach the user's device only after push→GitHub, `git pull`, and
Metro restart with `npx expo start -c` (cache clear). Confirm the device is on the
right commit before re-debugging — stale bundles look like "still broken".
