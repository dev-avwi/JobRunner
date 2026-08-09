---
name: Worker multi-worker job visibility
description: Why a worker assigned to a multi-worker job sees 0 assigned, and the rule for worker job-visibility filters.
---

# Worker visibility must consult job_assignments, not just jobs.assignedTo

A job has a single legacy `jobs.assignedTo` column (holds ONE assignee — the lead) AND a
`job_assignments` join table (one active row per assigned worker, `is_active`, `is_primary`,
`user_id`, `team_member_id`). On a multi-worker job, `jobs.assignedTo` can only point at one
worker, so every OTHER assigned worker is invisible if a filter checks `assignedTo` alone.

**Symptom seen:** worker dashboard shows 0 MY JOBS / 0 ASSIGNED even though the job detail
lists them under "Assigned Team". The worker stored in `jobs.assignedTo` (could even be a
*secondary* assignment, since that column drifts) saw the job; the lead/other workers did not.

**Rule:** any worker (non-view_all) job-visibility filter must match
`assignedTo === teamMemberId || assignedTo === userId || <active job_assignments row>`.
Use `storage.getAssignedJobIdsForUser(userId, teamMemberId)` (active rows, matches user_id OR
team_member_id) to build a Set and OR `assignedIds.has(job.id)` into the filter. For single-job
access checks fall back to `storage.getJobAssignmentForUser(jobId, userId)`.

**Why:** mobile dashboard stats (`fetchStats`) read `/api/jobs`; that and the sibling list
endpoints (`/api/jobs/today`, `/my-jobs`, `/today/reorder`, `/today/route`, `/map-data`,
`/site-photos`, single-job GET) all had the legacy-only filter. `assignedTeamMembers` array
referenced in some filters is NOT populated by `getJobs`, so that branch is dead.

**How to apply:** when adding ANY new endpoint that returns/limits jobs for a worker, reuse the
`getWorkerAssignedJobIds(userContext)` helper in `server/routes/jobs.ts`. Safe because
`getJobs(effectiveUserId)` is already business-scoped, so the assigned-id set only intersects
in-scope jobs (no cross-business leak).

Note: devices hit the PUBLISHED backend — this server fix only takes effect after a deploy.
