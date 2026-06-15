---
name: Logout owner-menu flash (mobile More page)
description: Why the full owner menu briefly flashes while signing out, and how to suppress it.
---
On the mobile More page (profile.tsx), tapping Sign Out briefly flashes the FULL owner menu before the redirect.

**Why:** `logout()` clears the per-user role cache (`roleCache`) before the screen unmounts, but `userId` and `businessSettings` linger for one render. `useUserRole`'s `getCurrentRole()` then hits the `!cache → isBusinessOwner(businessSettings, userId)` branch and returns `'owner'`/`'solo_owner'` (NOT 'loading'), so `isLoading` is false and `isStandaloneSubcontractor` is false → the menu renders the full owner kit (including items normally hidden for a standalone subbie).

**How to apply:** the `isRoleLoading` skeleton gate does NOT catch this (role isn't 'loading'). Add the local `signingOut` state into the gate: `const showSkeleton = isRoleLoading || signingOut;` and use `showSkeleton` for every menu/quick-action/category render branch. handleLogout sets `signingOut=true` before `await logout()`, so the skeleton stays up through the transition.
