---
name: Mobile live-location needs an immediate first ping
description: Why enabling team location sharing must force one send immediately, not rely on the OS background task.
---

Live team-location sharing (mobile `location-tracking.ts` → `startTracking`) registers the OS background task via `expo-location` `startLocationUpdatesAsync` with `distanceInterval: 50` + `pausesUpdatesAutomatically: true`. That task only delivers a location after ~50m of movement and is paused while stationary.

**Rule:** when a worker turns sharing ON, force one immediate `getCurrentPositionAsync` + POST `/api/team-locations` right after the task registers (both the background-started path AND the foreground_only fallback). Without it, a worker who enables sharing while standing still (testing at home, or sitting on a job site) never sends a ping, so they never appear on the owner Team map.

**Why:** symptom is "I turned on location but nothing shows on the map." Production check confirmed it: `location_tracking` had zero real rows in 24h while demo `tradie_status` rows still updated (those are seeded directly, not real device pings — a demo business owner id, with one demo pin override in the POST handler).

**How to apply:** the immediate send must still route through `sendLocationToServer()` so the subcontractor active-job privacy gate is preserved (subcontractor with no `_activeJobContext` early-returns and sends nothing). Reset `_stationaryCount` before the forced send so stale skip state doesn't suppress it.

**Owner-map filters worth remembering** (`GET /api/map/team-locations`): worker must be in `getTeamMembers(effectiveUserId)` with a `memberId`; subcontractors are dropped unless they have an `in_progress` job; coords must pass `isValidCoordinate`; >15min stale → `isActive:false` (greyed, not removed). The owner's OWN location never shows (they aren't in their own team-members list). The POST receiver only UPDATEs `tradie_status` if a row already exists, but always inserts a `location_tracking` history row, and the map falls back to that history — so a missing tradie_status row alone does not hide a worker.
