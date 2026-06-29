---
name: Subcontractor subscription gating (mobile)
description: Which plans a subcontractor can subscribe to and where, on the mobile subscription screen
---

A standalone subcontractor (accountType 'subcontractor', owner of their OWN workspace so isOwner stays true) may subscribe to **Pro only**. Team and Business are hidden for any subcontractor context (they have no team to manage). The account stays a subcontractor — buying Pro only sets tier='pro'; accountType is unchanged, so it's effectively a "subcontractor Pro".

**Why:** Team/Business plans are about managing employees, which a subcontractor doesn't do. A standalone subcontractor still runs their own jobs, so Pro is allowed for their own workspace. Product decision by the owner (Ayden), 2026-06.

**How to apply (mobile/app/more/subscription.tsx):**
- Gate uses `useUserRole()` flags `isSubcontractor` and `isStandaloneSubcontractor`.
- Team card + Business card: hidden when `isSubcontractor` (covers own-workspace AND host-workspace contexts).
- Whole compare-plans/upgrade section: also hidden when `isSubcontractor && !isStandaloneSubcontractor` (a subcontractor viewing INSIDE a host business they joined shouldn't upgrade anything there — that business owns its plan). The Subscription menu entry is already owner-gated in navigation-config, so host-workspace reach is normally blocked anyway; this is defense-in-depth.
- Subcontractor already on a paid tier: section hidden when `isSubcontractor && currentTier !== 'free'` so no empty "Available Upgrades" section.

**Enforcement is client/UI only.** No server-side rejection of Team/Business for subcontractor accounts was added — the IAP product buttons are simply unreachable, and a subcontractor paying for a plan they can't use is not a security exploit. If a hard guard is ever wanted, add it in the IAP verify-purchase path (see apple-iap-addons.md) without breaking legit owner upgrades.
