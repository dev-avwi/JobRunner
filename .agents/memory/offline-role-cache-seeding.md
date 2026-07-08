---
name: Offline cold-start role seeding
description: Why role-gated mobile UI (More menu, sidebar, dashboard) went blank when launching the app offline, and the seeding pattern that fixes it.
---
useUserRole derives everything from the in-memory roleCache Map (role-cache.ts). The fetch effect returns early when offline. So a cold app launch with no internet = empty cache + no fetch → role stays 'loading' → any screen gating render on isRoleLoading (More menu profile.tsx skeleton) stays blank forever for non-owners (owners survive via user.isOwner pre-fetch guess).

**Fix pattern:** an offline-only effect in use-user-role seeds roleCache from useAuthStore.roleInfo (persisted in SQLite cached_auth, restored by checkAuth on cold start), with `timestamp: 0` so it's readable immediately but treated stale and refetched the moment connectivity returns.
**Why timestamp 0:** getCurrentRole reads cache regardless of staleness (stale-while-revalidate), while the online fetch effect refetches stale entries — so no 5-min window of stale permissions after reconnect.
**Gotchas:** derive role via getRoleFromTeamInfo + owner→solo_owner teamSize mapping (match the 404-owner branch); include isOwner in seeded teamMemberInfo or isStandaloneSubcontractor breaks. No security change: roleInfo only ever written from server my-role responses; logout clears cached_auth + roleCache.
