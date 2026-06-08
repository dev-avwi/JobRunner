---
name: Mobile role label & nav gating gotchas
description: Why dashboard vs profile show different roles, and why Reports/simple-mode features get mislabeled as a paid-plan upsell.
---

## Owner detection must stay consistent: store.fetchRoleInfo vs useUserRole hook
Both `mobile/src/lib/store.ts` `fetchRoleInfo` and the `useUserRole` hook resolve role from the same `GET /api/team/my-role`, but they classify ownership differently and **both write the store's `roleInfo`**, so they can disagree depending on which ran last / which screen is mounted.

- The dashboard (`app/(tabs)/index.tsx`) reads store `roleInfo` via `isOwner()` (and `roleInfo?.roleName`).
- The profile screen uses the `useUserRole` hook.

**The bug:** the hook treats `roleName` containing "owner" as owner; the store historically only checked `data.isOwner===true || data.role==='owner'`. Server `/api/team/my-role` returns `isOwner:true` for true owners (no team membership), but a self/other team_members row can return a `roleName` like "Owner" with no `isOwner`/`role` field → store said NOT owner → dashboard showed "Team member" while profile showed "Owner".

**Fix / rule:** keep the two in sync. Store owner-detection now also does `String(data.roleName||'').toLowerCase().includes('owner')`. `isOwner()` feeds the dashboard role badge, `canViewMap`, and owner-only team-fetch gating, so any owner-detection change must go through the store value.

**Why:** two sources of truth for the same role, written from two code paths, drift silently. Prefer backend `isOwner`/`roleId` as authoritative; `roleName.includes('owner')` is a fallback that can false-positive on custom role labels containing "owner".

## simple_mode defaults TRUE → `hideInSimpleMode` features get a wrong "Team plan" upsell
`business_settings.simple_mode` is TRUE on most accounts (confirmed on both demo (team tier) and a fresh free solo owner in prod). `filterNavItems` (only consumed by `app/(tabs)/profile.tsx` More menu) turns a `hideInSimpleMode` item into a **locked card with badge "Team" and reason "Available on the Team plan. Upgrade in Subscription settings."** That mislabels a simple-mode UI-density choice as a paywall — even for a user who already has the Team plan.

Reports was the ONLY item carrying both `requiresProPlan` (Pro badge) AND `hideInSimpleMode` (Team badge). Fix: dropped `hideInSimpleMode` so `requiresProPlan` governs (pro/team/business/beta unlock; free shows the correct "Pro" lock).

**How to apply:** if a feature should be hidden in simple mode, don't combine it with a paid-plan gate that produces a misleading upsell; and remember simple mode is on by default, so anything `hideInSimpleMode` is effectively hidden for nearly everyone.
