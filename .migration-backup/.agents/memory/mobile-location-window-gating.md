---
name: Mobile owner tracking-window gating
description: Non-obvious wiring rules for the owner-set, team-wide GPS tracking-hours window on mobile (scheduler boot, override lifecycle, overnight days).
---

# Owner tracking-window gating (mobile)

Owner sets work days + start/end on `business_settings`; mobile must actually STOP
background GPS outside that window, with a clocked-in / subcontractor override, and
adapt cadence. The location-store holds the window + a 60s scheduler that calls
`applyTrackingSchedule()` (also re-run on AppState foreground).

## Boot wiring — must use the STORE initializer, not the hook
`useLocationTracking().initialize()` (the `useServices` hook) only flips local hook
state. It does NOT set the store's `permissionGranted`, register the store
location/geofence/status callbacks, or start the 60s scheduler. App boot
(`mobile/app/_layout.tsx`) MUST call `useLocationStore.getState().initializeTracking()`.
**Why:** `applyTrackingSchedule()` early-returns on `!permissionGranted`, so if only the
hook init runs, the owner window never engages until the user opens App Settings.
**How to apply:** any new boot/auth path that "starts location" goes through the store
initializer, not the bare hook.

## Single-slot callbacks
`locationTracking.onLocation/onGeofence/onStatus` are single-slot (assignment, not
append) — the last registrant wins. The store winning over the hook is acceptable: the
hook's `currentLocation` is read at one site that has a `getCurrentLocation()` fallback.
Don't "fix" this by registering in both places expecting both to fire.

## Override lifecycle (keep GPS alive outside hours)
Override triggers = clocked-in timer OR subcontractor `_activeJobContext`. There is NO
mobile "on my way" worker self-state (`en_route` is a dispatch/job status, not a GPS
trigger). Set the override on EVERY timer state transition AND on hydrate:
`startTimer` (online + offline + empty-body re-fetch fallback), `stopTimer`, and
`fetchActiveTimer` (true if active timer found, false on definitive 404, **leave
untouched on transient network error** so a blip doesn't drop GPS for a clocked-in
worker). Missing any one path leaves a worker clocked-in with override=false → GPS
pauses outside owner hours.

## Overnight window day-boundary
For overnight windows (`end <= start`, e.g. 22:00–06:00) the evening portion
(`mins >= start`) belongs to TODAY's shift → check `days.includes(today)`; the
early-morning portion (`mins < end`) belongs to the PREVIOUS day's shift → check
`days.includes(prevDay)`. Checking `today` for the whole overnight span is wrong.

## Persistence note
The 4 fields live on the `businessSettings` Drizzle table (mirror of raw-ALTER DB cols).
`team_members` ALSO has its own pre-existing `workHoursStart/End/workDays` (per-worker
GPS-privacy feature) — do NOT confuse the two; `trackingHoursEnabled` belongs ONLY on
`businessSettings`.
