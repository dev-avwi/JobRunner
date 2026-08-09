---
name: Forcing one route to a fixed theme over ThemeProvider
description: How to lock a single route/flow (e.g. web onboarding) to the light brand theme despite the global ThemeProvider.
---

Forcing a single route (e.g. the web onboarding flow in `client/src/components/SimpleOnboarding.tsx`) to always render light, regardless of the user's saved dark/light preference.

**Why it's hard:** `client/src/components/ThemeProvider.tsx` does NOT only toggle a `.dark` class. When theme is dark it writes dark-computed CSS variables (`--card`, `--muted`, `--border`, `--primary`, `--accent`, etc.) *inline onto `document.documentElement`*. So removing the `.dark` class alone leaves the stale inline dark vars in effect. It also re-runs its apply effect whenever theme/brand changes (e.g. when business settings load mid-flow), so a one-shot flip on mount gets clobbered.

**How to apply (robust pattern):**
1. Keep a constant of canonical light HSL var values (space-separated `H S% L%`, no `hsl()` wrapper — matches index.css convention).
2. In a mount effect: snapshot `root.getAttribute('class')` and `root.getAttribute('style')`.
3. Define `forceLight()` that removes `dark` / adds `light` class AND `setProperty` each light var — but only when the current value differs (this no-op guard is what prevents an infinite MutationObserver loop, since unchanged attrs emit no mutations).
4. Call `forceLight()` once, then attach a `MutationObserver` on `root` filtered to `['class','style']` so any ThemeProvider re-write is immediately re-corrected.
5. On unmount: `observer.disconnect()` and restore the snapshot class/style.

**Why root-level (not just wrapper divs):** setting the vars on a descendant wrapper only covers in-tree content. Portaled UI (shadcn Select/Popover menus) renders outside the wrapper and inherits from `documentElement`, so the vars must be re-asserted at the root for those to render light too.
