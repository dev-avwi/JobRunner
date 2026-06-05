---
name: Client job portal live-location sources
description: Why the /p/:token tracking portal dot didn't move while the worker WAS sharing location, and how the two location systems are wired.
---

# Client job portal live-location sources

The customer tracking portal (`/p/:token`, `client/src/pages/JobPortal.tsx`) reads the worker's position from **two** sources only:
1. in-memory `workerTravelLocations` (set by `updateWorkerTravelLocation()` in `server/websocket.ts`), and
2. per-assignment rows in `location_pings`.

The **continuous** location the mobile app shares (`POST /api/team-locations`) does NOT write either of those — it only writes `createLocationTracking` (breadcrumb) + `upsertTradieStatus` (owner team map). The portal's "fast path" writer `/api/jobs/:id/travel-location` is **never called by mobile**.

**Result of the gap:** the portal only ever saw the single initial "On My Way" ping, so the dot never moved even though the app was actively sharing location.

**Fix pattern:** bridge inside the `POST /api/team-locations` handler — for each of the worker's `en_route` active assignments (`storage.getEnRouteAssignmentsForUser`), mirror the live coords into BOTH portal sources: `updateWorkerTravelLocation(jobId,...)` (same-process fast path) AND `storage.createLocationPing({assignmentId,userId,...})` (durable, survives autoscale multi-instance + feeds `/crew-locations`). Bridge is gated on `assignmentStatus='en_route'` so it only runs during an active trip.

**Why server-side bridge (not a mobile change):** the deployed app already POSTs `/api/team-locations` whenever sharing is on, so this works with NO mobile rebuild.

**Gotcha:** `location_pings.userId` is `NOT NULL`. Any `createLocationPing` insert that omits `userId` fails silently inside its try/catch — the On My Way initial ping had this bug. Always pass `userId`.

**ETA fallback:** the On My Way SMS ETA was static "approximately 20 minutes" whenever the one-time GPS read failed. Fallback: use `storage.getTradieStatus(userId)` current lat/long if `lastLocationUpdate`/`lastSeenAt` is `<15 min` old, then route via OSRM as normal.

**Real-ETA gotcha — customMessage overrides server ETA:** `/api/jobs/:id/on-my-way` builds `baseMessage = customMessage || <server-built-with-real-ETA>`. So whenever the mobile app sends ANY `customMessage`, the server's real-ETA sentence is NEVER used. The mobile preview used to hardcode "ETA approximately 15-20 minutes" → customer always got the fake number even though the server could compute a real one. Fix pattern: mobile gets a fresh GPS fix (point-of-use `locationTracking.requestForegroundPermission()` + `getCurrentLocation()`), then calls `POST /api/jobs/:id/eta-message` with `{type, latitude, longitude, previewOnly:true}` to get a REAL-ETA preview string; on send it posts that as `customMessage` PLUS lat/long. `eta-message` `previewOnly` flag (added) computes the ETA but SKIPS side effects (portal token / en_route flip / location ping) — those happen only on the real `/on-my-way` send. `/on-my-way` strips any `Track arrival:`/`Track your job:`/`[link will be added]` lines from customMessage and appends exactly one canonical real link.

**Scale note:** the bridge runs on every team-location POST; mobile already throttles sends (~30s, pauses when stationary), so DB churn is negligible at this app's scale — throttling was considered and deliberately skipped. Add a per-assignment min-interval only if write pressure ever shows up.

**Read-side fallback (most robust — added because the bridge isn't enough):** the bridge only writes `location_pings` for `en_route` assignments, but in practice prod had `location_pings` EMPTY and ZERO en_route assignments (workers tap "On My Way" on jobs they aren't even assigned to → `myAssignment` null → no en_route, no ping; in-memory map also dies on autoscale). So BOTH portal READ endpoints (`/crew-locations` and `/location`) now fall back directly to the assigned worker's `tradie_status` live coords (the same feed the in-app "sharing ON" indicator uses), gated on `isEnRoute || job.workerStatus==='on_my_way'`, fresh `<10min` (stale flag `>5min`), with `Number.isFinite` + lat/long range validation. This shows the worker whenever they're actively sharing, independent of the en_route/ping pipeline.

**Solo-tradie / no-assignment gap (the read-side fallback above was STILL not enough):** that fallback mapped job→userId only via ACTIVE ASSIGNMENTS. A solo tradie / owner running their OWN job has NO assignment row at all, so there was no userId to look up → map stayed empty even though `job.workerStatus='on_my_way'`. Worse, `/on-my-way` only persisted the fresh GPS as a `location_ping` *when an assignment existed*, so for solo jobs the coords were used for ETA then discarded. Fix (two halves): (1) `/on-my-way` now ALWAYS `upsertTradieStatus({userId:req.userId, businessOwnerId:effectiveUserId, currentLat/Lng:String(...), activityStatus:'driving', currentJobId, lastLocationUpdate/lastSeenAt:now})` whenever lat/long present — independent of any assignment; (2) both portal read endpoints build a candidate userId list `[...activeAssignment.userIds, job.assignedTo, portalToken.userId]` (deduped) instead of only assignment users. `/crew-locations` injects a synthetic worker (`assignmentId:'synthetic:'+uid`, status 'en_route', name from user or businessName) when no assignment surfaced a location AND `workerStatus==='on_my_way'`. **Key insight: the customer portal must be able to resolve the "who is heading there" userId WITHOUT an assignment — fall back to job.assignedTo then the job owner (portalToken.userId).**

**Security gotcha found same round:** `/location` was NOT checking `revokedAt`/`expiresAt` (only `/crew-locations` was) → live worker coords leaked after a link was revoked/expired. Both now reject with 410.

These are SERVER-ONLY changes → require a publish to affect jobrunner.com.au.
