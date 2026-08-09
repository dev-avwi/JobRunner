---
name: Completion modal mode paths
description: Job completion modal (mobile) — worker vs owner mode must be decided on every open path; silent store failure pattern.
---
The mobile job completion modal has two modes: 'owner' (Complete Job → PATCH status done, server allows only owner/manager/lead — else 403 NOT_LEAD_WORKER) and 'worker' (Mark My Part Complete → complete-my-part route).

**Rule:** every code path that opens the modal must set completionMode using the same decision as the main CTA (has active jobAssignments row for user + doesn't own job → worker), and must wait for assignmentsLoaded before deciding.
**Why:** the geofence "Are you finished at the job?" prompt navigated with ?action=complete and opened the modal without setting mode → worker got owner flow → server 403 → jobs-store updateJobStatus reverts silently and returns false → button "did nothing".
**How to apply:** new entry points (notifications, deep links, action bars) must reuse the mode decision; any caller of store.updateJobStatus must handle a false return by toasting useJobsStore.getState().error.
