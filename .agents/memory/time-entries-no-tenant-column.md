---
name: time_entries has no business-owner column
description: Business-wide active-timer / time-entry queries must verify job ownership per non-self entry or they leak across businesses.
---

`time_entries` has NO business-owner / workspace column. A worker can be a member of multiple businesses, and one user can have an active timer (endTime IS NULL) on a job belonging to ANOTHER workspace.

**Rule:** any business-wide query that gathers time entries by `userId IN (owner + team memberIds)` MUST, for every entry that is NOT the caller's own, require the linked `jobId` to resolve via `storage.getJob(jobId, effectiveUserId)` (the per-business getter). Drop entries whose job isn't owned by this business. Self entries (`entry.userId === callerUserId`) are always safe to include.

**Why:** without the job-ownership check, querying by userId alone returns the multi-membership worker's timers from OTHER businesses → cross-tenant presence/status/elapsed leak (IDOR). job ownership is the only available tenant key for time entries.

**How to apply:** kicks in for endpoints like `/api/time-entries/active/team` (who's-clocked-in dashboards) and any future "team time entries" aggregate. The per-job endpoints (`job-team-timers/:jobId`, `job-all/:jobId`) are already safe because they getJob(jobId, effectiveUserId) up front and 404 if not owned. Entries with no jobId from non-self users should be dropped (can't verify tenant).
