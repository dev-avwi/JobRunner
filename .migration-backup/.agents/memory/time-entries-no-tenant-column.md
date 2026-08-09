---
name: time_entries has no business-owner column
description: Business-wide active-timer / time-entry queries must verify job ownership per non-self entry or they leak across businesses.
---

`time_entries` has NO business-owner / workspace column. Per the domain model, only SUBCONTRACTORS can belong to multiple businesses (workers and managers are single-business — they make a separate account to join another). So a subcontractor can have an active timer (endTime IS NULL) on a job belonging to ANOTHER workspace.

**Rule:** any business-wide query that gathers time entries by `userId IN (owner + team memberIds)` MUST, for every entry that is NOT the caller's own, require the linked `jobId` to resolve via `storage.getJob(jobId, effectiveUserId)` (the per-business getter). Drop entries whose job isn't owned by this business. Self entries (`entry.userId === callerUserId`) are always safe to include.

**Why:** without the job-ownership check, querying by userId alone returns the multi-membership worker's timers from OTHER businesses → cross-tenant presence/status/elapsed leak (IDOR). job ownership is the only available tenant key for time entries.

**How to apply:** kicks in for endpoints like `/api/time-entries/active/team` (who's-clocked-in dashboards) and any future "team time entries" aggregate. The per-job endpoints (`job-team-timers/:jobId`, `job-all/:jobId`) are already safe because they getJob(jobId, effectiveUserId) up front and 404 if not owned. Entries with no jobId from non-self users should be dropped (can't verify tenant).

**Owner/manager EDITING a worker's entry (PATCH /api/time-entries/:id):** same rule. The entry is stored user-scoped (`getTimeEntry(id, userId)`), so cross-user edit needs the unscoped `getTimeEntryAny(id)` + an authz gate. Gate = (isOwner || MANAGE_TEAM) AND tenant check; for the tenant check, if the entry has a jobId you MUST require `getJob(entry.jobId, effectiveUserId)` — a bare `getTeamMemberByOwnerAndMemberId` membership check is NOT enough (multi-business worker → manager in biz A could edit their biz-B entry). Membership fallback only for job-less manual entries. The final `updateTimeEntry` must be scoped to `existingEntry.userId` (the entry owner), NOT the requester, or the cross-user write silently no-ops.

**Footgun — TWO duplicate edit endpoints:** there is both `app.put("/api/time-entries/:id")` AND `app.patch("/api/time-entries/:id")` in server/routes.ts, with near-identical handler bodies (same validate-job / existingEntry / editSource / createTimeEntryEdit / updateTimeEntry sequence). Mobile + web edit via PATCH; PUT is legacy self-only. Any auth/behaviour change to one is policy-drift risk — check the other. (When editing one, anchor old_string on the `app.patch(`/`app.put(` route line for uniqueness — the inner blocks are byte-identical and will multi-match.)
