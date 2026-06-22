---
name: Mobile team map status source + endpoint decoy
description: Why the team Map showed wrong worker availability, and which endpoint actually feeds it
---

The mobile team Map (`mobile/app/(tabs)/map.tsx`) colors/labels each worker marker
from `activityStatus`, which is **location-derived** (online/driving/working/offline
from `tradie_status.activityStatus`). It did NOT reflect the worker's *chosen*
availability (Available/Busy/Unavailable) that the dashboard pill writes via
`POST /api/worker/state` into `worker_states.state` — the same source Team Operations
reads. Net effect: a worker who set Busy showed green/Online on the map while Team
Operations correctly showed Busy.

**Endpoint decoy:** there are TWO near-identical server handlers. The map fetches
`GET /api/team/locations` (the canonical one). There is also `GET /api/map/team-locations`
that is NOT consumed by the map. When fixing map data, edit `/api/team/locations`.

**Fix pattern:** in `/api/team/locations`, fetch `storage.getWorkerState(memberId,
effectiveUserId)` and let an explicit `busy`/`unavailable` override the location-derived
`activityStatus` (and return `workerState` too). On mobile, add `busy`/`unavailable` to
`ACTIVITY_CONFIG` + the `activityStatus` union, bake the override into `activityStatus`
in the transform, and make dedup-by-name keep the highest-priority status (so an explicit
Busy beats a duplicate Online self-membership row).

**Why:** owner self-membership creates duplicate rows for one person (one Available, one
Busy); first-occurrence dedup kept the wrong one. Priority-rank dedup fixes it.

**Deeper root cause (the override alone wasn't enough):** the map resolved the business
owner differently than the write/read of worker_states, so it queried the WRONG owner key
and found no busy row. Worker-state WRITE (`POST /api/worker/state`) and Team Operations
READ (`GET /api/team/worker-states`) both use
`getTeamMembershipByMemberId(req.userId).businessOwnerId || req.userId`. The map was using
`getUserContext().effectiveUserId`. For self-membership/owner accounts those two DIFFER, so
`getWorkerState(memberId, effectiveUserId)` missed the row and the worker stayed green.
**Fix:** in `/api/team/locations` resolve `wsBusinessOwnerId` the IDENTICAL way, then
prefetch `getWorkerStatesByBusiness(wsBusinessOwnerId)` once into a `Map` keyed by userId
(also kills the per-member N+1 getWorkerState). Lesson: any two endpoints that must agree on
a worker's status MUST resolve businessOwnerId the same way — prefer one shared helper.

**Deploy note:** this is a SERVER change; the user's device hits the published backend, so
the map won't update until the app is REPUBLISHED (the mobile-side override/config was
already shipped). Classic stale-prod symptom — see mobile-prod-stale-deploy.md.
