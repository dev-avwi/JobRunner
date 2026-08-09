---
name: On-My-Way / portal ETA depends on live GPS flowing
description: Why the tracking ETA shows a static "20 min" and what must be true for a real, live road ETA
---

The whole real/live ETA machine already exists server-side and only fails when the worker's GPS never reaches the server.

**Server is NOT the problem.** `/api/jobs/:id/on-my-way` (server/routes/jobs.ts) computes a real OSRM road ETA when it receives `latitude/longitude` (body, else fresh tradie_status fallback); with no coords it falls back to a hardcoded `estimatedMinutes = 20`. The portal endpoint `/api/public/job-portal/:token/location` (server/routes.ts) recomputes road ETA every poll from the freshest live location it can find — WS travel-location, then assignment `location_pings`, then `tradie_status` (by assignment user, job.assignedTo, or portal owner) — but ONLY when both a live worker location AND job geocode exist. `/api/team-locations` updates `tradie_status` for any user and bridges into the portal (workerTravelLocation + pings) for en_route assignments.

**The real failure: GPS never flows.** Confirmed in prod (job had lat/lng set, but `worker_eta_minutes=20`, `ping_count=0`, no assignment). Two mobile gaps caused it:
1. The main On-My-Way handlers used `Location.getForegroundPermissionsAsync()` (CHECK only, never REQUEST) → if permission not already granted, coords were null → server defaulted to 20. The home quick-action sent no coords at all.
2. Continuous sharing (`locationTracking.startJobTracking` → POST `/api/team-locations`) only started at `job.status==='in_progress'` and only for subcontractors → during the EN ROUTE drive nothing kept location flowing, and owners running their own jobs never shared.

**Fix pattern:** `locationTracking.getFreshCoordsForEta()` (requests foreground perm + fresh fix) used by ALL on-my-way call sites; plus an effect that runs `startJobTracking` while `workerStatus==='on_my_way'` (owner + subbie) and stops on arrival, so the portal recomputes a counting-down ETA. Without continuous location during travel, the ETA is real but static — it won't count down.

**Why:** a real-time ETA needs the worker's *moving* position continuously posted; one initial fix gives a real number but a frozen one.
**How to apply:** any new "notify client / share location" flow must REQUEST permission (not check) and ensure location keeps posting during the relevant phase; never assume the static fallback number is a server bug.
