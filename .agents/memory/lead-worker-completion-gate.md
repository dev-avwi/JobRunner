---
name: Lead-worker job completion gate (mobile + sync)
description: Only the lead/primary assignee (or owner) may mark a multi-worker job done; server rejects others with NOT_LEAD_WORKER. Mobile lead detection must wait for assignments to load.
---

Server is the source of truth: only the lead (primary assignment OR legacy
`jobs.assignedTo`) or owner/manager may set a job to `done`. Non-lead assignees
get a `NOT_LEAD_WORKER` rejection and should "Clock Off" their own timer instead.
This is correct behaviour, not a bug.

**Mobile gotchas (job/[id].tsx):**
- The lead test uses a legacy fallback `(!hasPrimaryAssignment && job.assignedTo
  === user.id)`. `jobAssignments` loads async, so before it loads the array is
  empty → `hasPrimaryAssignment` is false → a SECONDARY worker whose
  `assignedTo` matches is wrongly treated as lead and offered "Complete Job".
- Fix: gate the legacy fallback on an `assignmentsLoaded` flag. Set it `true` in
  a `finally` (even on fetch failure — don't permanently block a legit legacy
  single-assignee; the server still safely rejects bad completions). Reset it to
  `false` when the job `id` changes.

**Offline sync (offline-storage.ts syncItem):** a queued job update rejected
with `code: 'NOT_LEAD_WORKER'` (body carried in `response.data`) is permanent —
retrying just spams `console.error` and re-fails. Treat it as a drop: scope it
to `type==='job' && action==='update'`, log a warn, and `return true` so the
queue removes it; local cached status reconciles on the next job fetch.

**Per-worker completion + lead reassignment (multi-worker jobs):**
- `job_assignments.completedAt` (nullable timestamp) records each worker's own
  part. Worker hits `POST /api/jobs/:id/complete-my-part` (membership-scoped via
  getJobAssignmentForUser, NOT a business gate): sets completedAt idempotently
  AND stops that worker's running non-break time entry (clock off). Job STAYS
  open after all parts done — it does NOT auto-transition to `done`.
- **Notify-the-lead-once contract:** the "all workers done, ready to finish"
  notification must be gated on THREE conditions together — `allComplete &&
  totalCount > 1 && justCompleted`, where `justCompleted` is true only on the
  call that actually flipped this worker incomplete→complete. Without
  justCompleted, repeat calls re-notify (spam); without totalCount>1 a solo
  assignee triggers it. Recipients = lead (isPrimary OR jobs.assignedTo) + owner
  + managers/admins (resolve via getTeamMembers→getUserRole, member id is
  `teamMembers.memberId`, NOT `userId` — that column doesn't exist).
- **make-lead authz (`POST /api/jobs/:jobId/assignments/:assignmentId/make-lead`):**
  do NOT gate with `createPermissionMiddleware(ASSIGN_JOBS)` alone — that skips
  business-ownership scoping (cross-business IDOR: getJobPublic returns any
  job). Verify `getUserContext(req.userId).effectiveUserId === job.userId`
  first, THEN allow if owner OR hasPermission(ASSIGN_JOBS) OR current lead.
  Requirement is owner/manager/lead may reassign the lead.
