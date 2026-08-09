---
name: Mobile button text on colors.primary
description: Why white-on-white buttons happen in the mobile app and the correct text-color contract for primary-surface buttons.
---

Hand-rolled mobile buttons must use `colors.primaryForeground` (NOT literal `colors.white`) for any text/icon rendered on a `backgroundColor: colors.primary` surface.

**Why:** `colors.primary` is theme-inverted — light mode = dark navy `#1f2733`, dark mode = near-white `#eef2f5`, custom brand = the user's chosen color. `colors.primaryForeground` is computed (getSafeForegroundColor) to always contrast with primary. Literal `colors.white` (#ffffff) renders white-on-white in dark mode and on light brand colors, so the button "looks broken." In a light + blue-brand theme the bug is INVISIBLE (primary=blue, white text fine), which is why a user can report it while a specific screenshot looks like it should work — and why the shared `Button` component (variants default/brand in `mobile/src/components/ui/Button.tsx`) is already safe.

**How to apply:**
- Change `colors.white` -> `colors.primaryForeground` ONLY when the text/icon sits on an element whose bg is exactly `colors.primary`. Trace StyleSheet pairs (`fooButton`/`fooButtonText`) to JSX before changing.
- LEAVE `colors.white` on fixed/branded backgrounds: destructive/success/warning/status colors, hardcoded hex, translucent `rgba(255,255,255,...)` overlays, images/dark overlays, role/avatar/category colors.
- Watch DISABLED states: a button may swap its bg to `colors.muted` when disabled while the label/icon was switched to `primaryForeground` (dark) -> low contrast on muted. Make such colors state-aware: `cond ? colors.primaryForeground : colors.mutedForeground`. (This bit the ai-assistant send button.)
- If one shared text style is used on BOTH a primary and a non-primary colored surface, split it via an inline override rather than a blanket change.
- Verify with `bash mobile/scripts/typecheck.sh` (must stay at baseline).
- Mobile edits only reach the device after the user `git pull`s + reloads Metro/rebuilds — a still-broken screenshot after a fix is often a stale build, not a bad fix.
