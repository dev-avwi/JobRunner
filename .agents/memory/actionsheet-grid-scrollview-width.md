---
name: ActionSheet grid even-width inside AppBottomSheet
description: Why percentage widths bunch/collapse in the grid ActionSheet and the reliable pixel-width fix
---

The grid-layout ActionSheet (`mobile/src/components/ui/ActionSheet.tsx`) renders its
items inside `AppBottomSheet`'s ScrollView **even though ActionSheet passes
`scrollable={false}`** — AppBottomSheet uses the ScrollView whenever
`useAutoHeight` is true (`scrollable || useAutoHeight`), and `useAutoHeight`
defaults true when no `snapPoints` are given.

**Rule:** percentage `width` (e.g. `'33.333%'`) on flex children is unreliable
inside a vertical ScrollView content container — items bunch left or collapse to
content width (labels run together). Same reason FloatingActionButton's Quick
Create note says `flex:1 + flexWrap` was unreliable, but Quick Create's parent is
a plain View (non-scroll) so its plain `width:'25%'` works there.

**Fix that works:** measure the grid container with `onLayout` → `gridWidth`
state, then set each item width in PIXELS = `Math.floor(gridWidth / perRow)`,
`perRow = Math.min(count, 4)`. Keep a percentage fallback only for the one frame
before measurement. The grid container itself fills width fine (alignSelf stretch
/ width 100% resolves against the ScrollView), so onLayout reports the true px.

**Why:** percentage widths need a parent with a definite resolved width; a
vertical ScrollView's content container doesn't reliably provide one for cross-axis
percentages.

**How to apply:** any even-width horizontal row inside AppBottomSheet (or any RN
ScrollView) should use measured pixel widths, not `%`. Don't "fix" by tweaking the
percentage value.
