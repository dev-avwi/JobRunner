---
name: Readiness-gate deadlock
description: A readiness flag gating deferred UI must be set fail-safe (finally), not only on the success path.
---
When deferring UI (e.g. the mobile WhatYouMissedPopup) behind a store flag like `dashboardReady`, set that flag in a `finally` block after the dashboard's initial `Promise.all([...])` load attempt — NOT only after a successful resolve.

**Why:** if `setInitialLoadComplete(true)` / `setDashboardReady(true)` runs only on the success path, any single rejected fetch leaves the flag false forever and the gated UI is permanently suppressed for that session. The dashboard shell still renders, so the deferred UI must not depend on every fetch succeeding.

**How to apply:** wrap the owner-dashboard `refreshData` Promise.all in try/finally and flip the ready flag in finally. Subbie dashboard already flips `setIsLoading(false)` in finally (safe). Reset the flag to false on logout so a re-login re-gates correctly.
