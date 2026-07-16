---
name: Mobile bottom-nav padding
description: Root layout already reserves tab-bar space; per-screen bottomNavHeight padding double-pads
---
Rule: mobile/app/_layout.tsx wraps all phone screens with `paddingBottom: bottomNavHeight` (content view, ~L841), so screens NEVER sit under the BottomNav. Do not add getBottomNavHeight padding inside individual screens' footers/containers — it stacks on top of the layout's reservation and creates a huge empty strip above the tab bar.
**Why:** Tap to Pay setup got this padding added, removed, re-added, and removed again across three user complaints (overlap vs too-long gap).
**How to apply:** For bottom-anchored buttons on phone screens use a normal spacing.lg/xl paddingBottom only. Only overlay elements (FAB) need bottomOffset.
