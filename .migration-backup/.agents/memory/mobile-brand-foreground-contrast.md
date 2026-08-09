---
name: Mobile brand button text turns dark (contrast picker)
description: Why a brand-blue button's text renders dark instead of white, and the fix
---

Symptom: after a user sets a custom brand colour, solid brand-coloured buttons (e.g. home-screen "Start Route" banner, "Go" button) render with DARK/black text instead of white, looking broken. Default theme is fine (default primary is dark navy `#1f2733` with white text); the bug only appears with a brand colour set.

Root cause: `mobile/src/lib/theme.tsx`. The brand palette text colour is computed by `generateBrandPalette` -> `getSafeForegroundColor(primaryHex)`, consumed as `colors.primaryForeground`. The old picker chose whichever of white/black had the strictly higher WCAG contrast (`whiteContrast > blackContrast ? white : dark`). For bright/light brand colours (tailwind blue-500 `#3B82F6`: white cr 3.68 vs black cr ~5.7) **black wins the max-contrast test**, so the picker flips to dark text — mathematically "max contrast" but conventionally wrong for a solid brand button.

Fix: bias toward white — return white when white contrast ≥ 3.0 (WCAG AA for large/bold text & UI components, which bold button labels are), else dark `#1f2733`. Dark is then only chosen for genuinely light backgrounds (yellow/cyan/pale blue) where white < 3.0 is unreadable. Also lowered `MIN_TEXT_CONTRAST` (used by `getVisibleButtonColors` -> `mobile/src/components/ui/Button.tsx`) from 4.5 to 3.0 so a vivid brand blue is KEPT with white text instead of falling back to the generic `FALLBACK_BUTTON` (#2563EB).

**Why 3.0 not 4.5:** at 4.5 the reusable Button discards any brand colour whose white-text contrast is 3.0–4.5 and substitutes a generic blue, so the user's actual brand colour silently disappeared. Known tradeoff (architect-flagged): Button sm sizes can be 12–14px, which aren't strictly "large text", so a global 3.0 bar is a deliberate design choice, not WCAG-AA-normal-perfect. Left as-is per the user's "keep it basic" preference; if stricter a11y is wanted later, split the bar by label size (3.0 for large CTAs, 4.5 for 12–14px).

Verified picks: `#3B82F6`/`#2563EB`/`#1E90FF` -> white; `#60A5FA`/`#FBBF24`/`#06B6D4`/`#22C55E`/`#F97316`/`#84CC16`/`#ffffff` -> dark.
