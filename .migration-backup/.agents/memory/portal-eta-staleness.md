---
name: Client portal ETA staleness
description: Why the public job-portal ETA showed a stale "X min away" and how ETA freshness is decoupled from the live worker dot
---

The public client tracking portal (`/p/:token`) showed a stale ETA (e.g. "10 min away" while the worker was at the door) even though the live worker dot moved correctly.

**Root cause:** the live worker *dot* and the *ETA number* are fed by different mechanisms.
- The dot is resolved by `GET /api/public/job-portal/:token/location` from a chain of fresh sources (websocket travel location → `location_pings` → `tradie_status`), so it stays current.
- The ETA was just the stored `job.workerEtaMinutes` (or `job_assignments.eta_minutes`). That stored value is ONLY refreshed by the mobile-only `POST /api/jobs/:id/travel-location`, which does not fire on every position update. The portal recomputed via OSRM *only when there was no stored value* (`if (!computedEta ...)`), so once "On My Way" stored an ETA it was shown forever.

**Fix:** in the portal location endpoint, when the resolved live location is non-stale (<5min) and job coords exist, recompute the ETA from the live location every poll: ≤0.3km ⇒ 1 min (skip routing); else OSRM `calculateRouteETA`; else straight-line (speed or 40km/h). Cache the OSRM result per job 30s / until the worker moves >0.4km (`portalEtaCache` Map) so the 10s poll doesn't hammer OSRM. `calculateRouteETA` also got a 2.5s AbortController timeout.

**Why it matters / how to apply:** any client-facing "live" number must be driven by the same fresh source as the thing it sits next to. Don't trust a stored field that only one writer (a mobile endpoint) updates. The portal is public and polls every ~10s, so any external call (OSRM) added there MUST be cached/throttled.

**Known remaining inconsistency (intentional, not written back):** the owner/mobile surfaces still read the stored `workerEtaMinutes`, so their ETA can lag the portal's live one. No DB write-back was added on the public endpoint to avoid public-triggered writes.
