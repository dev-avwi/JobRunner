---
name: Sidebar icon alignment (mobile)
description: How the left edges of profile logo, menu icons, and logout icon line up in mobile/src/components/SidebarNav.tsx
---

The three icon columns in `mobile/src/components/SidebarNav.tsx` live in different
containers with different padding, so "align logout with the menu icons and profile"
only works if every icon's LEFT EDGE resolves to the same x. Compute it, don't eyeball:

- Menu item icon: `section` paddingHorizontal 12 + `navItemRow` paddingHorizontal 14 = **26px**.
- Profile logo: `headerSection` paddingHorizontal 12 + `headerRow` paddingLeft → set paddingLeft 14 ⇒ **26px**.
- Logout icon: `footer` paddingHorizontal 12 + `logoutButton` paddingLeft → set paddingLeft 14 ⇒ **26px**.

**Why:** this alignment churned 4+ commits (paddingLeft 40→28→23→28) because only the
logout offset was tweaked while the profile (40px) and menu (26px) sat at different x.
Tweaking one against a moving target never converges.

**How to apply:** if asked to realign any of these, make all three left edges equal the
menu-icon value (12 + row padding). Currently headerRow.paddingLeft = logoutButton.paddingLeft = 14.
