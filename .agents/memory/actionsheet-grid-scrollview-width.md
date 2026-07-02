---
name: ActionSheet grid even-width inside AppBottomSheet
description: Why the grid ActionSheet cards bunched left, and the real fix (flexWrap defeats flex-grow in Yoga)
---

The grid-layout ActionSheet (`mobile/src/components/ui/ActionSheet.tsx`) shows 3–4
icon cards (Take Photo / Choose Photo / Attach File …) that must spread evenly
across the full sheet width. For a long time they bunched to the left with empty
space on the right.

**Real root cause (proven on-device 2026-07):** `styles.grid` had
`flexWrap: 'wrap'`. **Yoga does NOT distribute flex-grow across a wrapping row.**
So with `flexWrap:'wrap'`, the `flex:1` cards stayed at content width and packed to
the left (flex-start), leaving the empty gap — even though the grid CONTAINER was
already the full content width.

**How it was proven:** a throwaway on-screen readout (`onLayout` on both a stretch
wrapper and the grid, printed as red text in the sheet) returned
`win=420 inner=388 box=388 grid=388` — ALL equal. i.e. the container was `windowWidth
- spacing.lg*2` exactly, the stretch wrapper filled it, and the grid rendered at the
full 388. The container was never narrow; only the children failed to fill it. That
killed every earlier "the ScrollView shrinks the content box" theory.

**Fix that works:**
- `styles.grid`: `flexDirection:'row'`, `alignItems:'flex-start'`,
  `columnGap: spacing.sm`. **No `flexWrap`. No `alignSelf:'stretch'`.**
- keep the explicit container width `{ width: gridInnerWidth }` where
  `gridInnerWidth = Math.max(0, windowWidth - spacing.lg*2)` (definite width so the
  flex children have something to distribute across);
- each card is a `Pressable` with `{ flex: 1, minWidth: 0 }` → equal columns filling
  the row;
- label `maxWidth: gridInnerWidth/perRow` + `textAlign:'center'` + `numberOfLines={2}`
  so it centers under its icon within its column.

**Rule / how to apply:** for an even-width single row inside AppBottomSheet, use
`flex:1` children in a `flexDirection:'row'` container that has a definite width, and
**never add `flexWrap`** — we only ever render ≤4 cards so wrap is unnecessary and it
silently defeats flex-grow. The sheet is always full window width (`kbWrapper`
`{flex:1, justifyContent:'flex-end'}` default `alignItems:'stretch'`, `styles.sheet`
`{width:'100%'}`, no maxWidth/margin, inside a full-screen `overFullScreen` Modal), so
`windowWidth - spacing.lg*2` is the exact content box on every device — do NOT re-add
a measuring probe "for tablets/foldables". If ActionSheet ever passes a custom
`contentPadding`, update the subtraction to match.

**Sync caveat:** fixes only reach the user's device after they push Replit→GitHub,
`git pull`, AND restart Metro with `npx expo start -c` (cache clear mandatory).
Stale Metro bundles produced several different-looking "still broken" screenshots
that were all old code; confirm the device is on the right commit before re-debugging.
