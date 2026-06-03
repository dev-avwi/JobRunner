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

**Scale note:** the bridge runs on every team-location POST; mobile already throttles sends (~30s, pauses when stationary), so DB churn is negligible at this app's scale — throttling was considered and deliberately skipped. Add a per-assignment min-interval only if write pressure ever shows up.

These are SERVER-ONLY changes → require a publish to affect jobrunner.com.au.
