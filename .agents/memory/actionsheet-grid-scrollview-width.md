---
name: ActionSheet grid even-width inside AppBottomSheet
description: Why self-measured/percentage widths collapse in the grid ActionSheet and the deterministic window-width fix
---

The grid-layout ActionSheet (`mobile/src/components/ui/ActionSheet.tsx`) renders its
items inside `AppBottomSheet`'s ScrollView **even though ActionSheet passes
`scrollable={false}`** — AppBottomSheet uses the ScrollView whenever
`useAutoHeight` is true (`scrollable || useAutoHeight`), and `useAutoHeight`
defaults true when no `snapPoints` are given.

**Rule:** inside AppBottomSheet's auto-height vertical ScrollView content
container, do NOT size the grid by self-measurement. Both of these FAILED there:
- percentage `width` (e.g. `'33.333%'`) on flex children → columns bunch left /
  collapse to content width (labels run together);
- `onLayout` + `width:'100%'`/`alignSelf:'stretch'` on the grid container →
  the container itself collapses to a *fraction* of the real width, so the
  measured `gridWidth` is too small, columns come out narrow, and labels overflow.
  (An earlier revision of this note wrongly claimed the container "fills width
  fine and onLayout reports the true px" — it does not.)

**Fix that works (deterministic, no self-measurement):** compute widths from the
screen via `useWindowDimensions().width` minus the sheet's known horizontal
padding. AppBottomSheet's default `contentPadding = spacing.lg` is applied as
`paddingHorizontal` on each side and ActionSheet does NOT override it, so:
- container width = `Math.max(0, windowWidth - spacing.lg*2)` (pin the grid
  container too, so fixed-width items can't sum wider than it and wrap to rows);
- item width   = `Math.max(0, Math.floor((windowWidth - spacing.lg*2)/perRow))`,
  `perRow = Math.min(count, 4)`.
Keep `gridLabel` `alignSelf:'stretch' + textAlign:'center' + numberOfLines={2}` so
each label fills and centers within its now-correct column instead of overflowing.

**Why:** percentage and `100%` widths need a parent with a definite *resolved*
width; AppBottomSheet's auto-height ScrollView content container doesn't reliably
provide one for cross-axis sizing. Window width is always definite.

**How to apply:** any even-width horizontal row inside AppBottomSheet should derive
its widths from `useWindowDimensions()` minus the sheet `contentPadding`, not from
`%` or `onLayout`. If ActionSheet ever passes a custom `contentPadding`, update the
subtraction to match. (FloatingActionButton's Quick Create uses plain `width:'25%'`
and works only because its parent is a plain non-scroll View.)

**Sync caveat:** fixes only reach the user's device after they push Replit→GitHub,
`git pull`, AND restart Metro with `npx expo start -c` (cache clear mandatory).
Stale Metro bundles made several different-looking "still broken" screenshots that
were all old code; confirm the device is on the right commit before re-debugging.
