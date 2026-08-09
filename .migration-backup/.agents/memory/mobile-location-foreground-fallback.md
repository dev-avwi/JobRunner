---
name: Mobile location tracking foreground fallback
description: Why the worker map send must fall back to a foreground one-shot for ANY background-start failure, not a specific error string.
---

# Worker never appears on team map → foreground fallback must be unconditional

In `mobile/src/lib/location-tracking.ts` `startTracking()`, the background tracker
(`Location.startLocationUpdatesAsync`) can throw for several reasons. The catch
block MUST always attempt the one-shot foreground fallback
(`getCurrentLocation()` → `sendLocationToServer()`), and only rethrow if even that
yields no location.

**Why:** iOS users who grant **"While Using"** (not **"Always"**) cause
`startLocationUpdatesAsync` to throw an error whose message does NOT contain
`"UIBackgroundModes"`/`"Background location"`. An earlier version gated the
fallback on those exact strings, so a "While Using" grant silently sent nothing —
`bgError` was rethrown, status went to `error`, and the worker never appeared on
the owner's team map. Proven by production logs: the worker phone was
authenticated on prod (GET /api/auth/me 200, push token registered) yet there
were ZERO `POST /api/team-locations` and the `location_tracking` table was empty.

**How to apply:** Treat any background-start failure as "background unavailable,
fall back to foreground." Continuous tracking still needs "Always", but a single
immediate ping is enough to put the worker on the map. Pair with
`sendImmediateLocation()` in the success path so both paths POST at least once on
(re)start.

**Delivery note:** This is mobile code. It only reaches the phone after the commit
is pushed to GitHub (Replit Git pane — the agent cannot push, no GitHub auth) →
Mac `git pull` → Metro reload (dev build on Metro) OR `eas update` + a FULL app
restart (a plain reload does NOT fetch a freshly published OTA on a dev client).
