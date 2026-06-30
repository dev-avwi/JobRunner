---
name: Geofence auto clock-in/out needs coords on the event
description: Why the mobile geofence background task must attach lat/lng or server auto-clock silently never fires
---

The server `/api/geofence-events` route gates BOTH auto clock-in (enter) and auto clock-out (exit) on a `coordinatesValid` flag, which it derives from `parseFloat(latitude/longitude)` on the request body. If those are missing it becomes `NaN` → `coordinatesValid=false` → the OS-fired geofence event is accepted (alert/notification/SMS still happen) but the timer is NEVER started/stopped.

**Why this bites:** the OS geofence callback (`TaskManager.defineTask(GEOFENCE_TASK_NAME ...)`) only hands you `eventType` + `region` (identifier/action). It does NOT include the device position. So a naive event carries no coords and the whole auto-clock feature looks dead while everything else (alerts, push, owner SMS) works — easy to misdiagnose as a server bug.

**How to apply:** the mobile geofence task must populate `latitude/longitude/accuracy` on the event before `handleGeofenceEvent`. Prefer `Location.getLastKnownPositionAsync({maxAge:60000})` (fast, cached), fall back to the `region` centre coords (= job site, always present and within radius, always valid AU bounds). The offline replay path (`offline-storage.ts` queueGeofenceEvent → sync) already forwards lat/lng/accuracy + idempotencyKey, so once the live task sends coords both paths align. `GeofenceEvent` interface must declare these as optional fields. Also dedupe `addJobGeofence` by `identifier` before pushing (toggle-on after a startup sync can otherwise stack duplicate regions toward the iOS ~20 region cap).
