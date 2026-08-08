---
name: PressableRow percentage layout collapse (iOS)
description: Why percentage width/maxWidth on the shared mobile PressableRow collapses elements on iOS, and how to work around it per call-site.
---

# PressableRow percentage layout collapse (iOS)

On iOS, `mobile/src/components/ui/PressableRow.tsx` renders an outer `Pressable` whose
style is `outerLayoutStyle` (a subset of layout keys: flex/width/height/min/max/margin/
position/alignSelf/zIndex) AND an inner `Animated.View` that re-applies the FULL `style`.
So any **percentage** `width`/`maxWidth` is applied twice and compounds:
- `width: '14.28%'` → outer 14.28% of parent, inner 14.28% of that ≈ **2%** → element ~7px.
- `maxWidth: '75%'` → nests to ~56% (worse when an inner child also has its own `maxWidth`).

This has caused at least three real bugs: calendar **month** day-cells collapsing + clipping
the day number, team-chat bubbles wrapping text per-character ("Wo rkin g?"), and the
quotes/receipts KPI stat cards + documents grid cards collapsing so the **list/section below
visually overlaps them** (a "TouchableOpacity → PressableRow" sweep re-introduced this on
percentage-width cards). Note the symptom isn't always a too-narrow element — when the
collapsed card is in a `flexWrap` row with `flex:1`, the reserved box shrinks and following
content paints on top of it (vertical overlap), which looks like a totally different bug.
The Android branch is a single `Pressable` (no inner view) so it is unaffected.
`flex: 1` and fixed-px sizes do NOT visibly break (same value applied twice ≈ same result);
only **percentages** compound, and margins technically double too.

**Why we don't fix the shared component:** PressableRow is used across ~92 screens and the
correct split (layout on outer only, inner fills) is hard to get right for every case
(fixed / flex / content-driven / percentage) and risky to validate on device.

**How to apply — per call-site workarounds (preferred):**
- Need a percentage **width** with a tap? Use a plain `TouchableOpacity` (single View), not
  PressableRow. (Calendar month cells now do this.)
- Need a percentage **maxWidth** wrapper (e.g. chat bubble)? Put the `maxWidth` on a plain
  `<View>` (optionally `flexShrink: 1`) that is a direct child of a definite-width row, and
  make the inner pressable element a PressableRow carrying ONLY non-percentage visual style
  (padding/bg/radius). Never stack two percentage maxWidths in the chain.
- If you ever DO harden PressableRow itself, do it behind a guarded refactor + broad test pass.

## UPDATE 2026-08-08 — root cause fixed in the component
PressableRow (iOS branch) now strips the extracted layout keys (margins, width/height,
alignSelf, position, flex) from the inner Animated.View style and gives the inner view
width/height 100% when the outer has sizing. Margins and % widths are applied ONCE, on the
outer Pressable only. Symptom fixed: tappable cards with marginHorizontal rendered narrower
than sibling plain-View cards (double margin). Per-call-site pixel-width workarounds remain
valid. New call sites can use % widths/margins normally.
