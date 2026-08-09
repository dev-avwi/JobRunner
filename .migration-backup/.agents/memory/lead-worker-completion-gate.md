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

**Mobile completion-CTA classification (job/[id].tsx) — owner vs worker:**
The mobile UX no longer treats the lead/primary assignee as a job-closer. Only
the real business OWNER closes the whole job; EVERY assigned worker — including
the lead AND a standalone subcontractor (whose own global role may be "owner")
assigned to someone else's job — gets the "Mark My Part Complete" worker flow.
- `ownsThisJob = user && job.userId === user.id` is the highest-priority,
  immediate manager signal (server scopes the job GET to the owner's id, so
  `job.userId` is the owner's id; it equals `user.id` ONLY for the true owner).
- Role fallback `(isOwnerOrManager || isSoloOwner) && assignmentsLoaded &&
  !hasMyActiveAssignment` MUST be gated on `assignmentsLoaded`, else an
  owner-role standalone sub is briefly shown the owner "Complete Job" flow before
  their assignment row loads (same race class as the legacy lead fallback).
- Don't gate `ownsThisJob` on assignmentsLoaded — that regresses owner UX
  (owner would wait for assignments to load before seeing Complete Job).
- Worker "Mark My Part Complete" opens the SAME rich completion modal as the
  owner (a `completionMode: 'owner'|'worker'` flag switches title + footer
  button + handler); the modal is the confirmation, so handleCompleteMyPart has
  NO separate confirm() dialog. Owner modal adds a multi-worker "Team" section
  (per-assignment name, lead tag, done/pending, non-break time).

**Offline sync (offline-storage.ts syncItem):** a queued job update rejected
with `code: 'NOT_LEAD_WORKER'` (body carried in `response.data`) is permanent —
retrying just spams `console.error` and re-fails. Treat it as a drop: scope it
to `type==='job' && action==='update'`, log a warn, and `return true` so the
queue removes it; local cached status reconciles on the next job fetch.
- **A job-missing 404 is ALSO a permanent drop.** A standalone subcontractor's
  effectiveUserId is their OWN business, but generic job PATCH/DELETE scope the
  row to the job owner's id, so a queued update/delete for another business's job
  404s "Job not found" forever → endless error spam + a stuck "tap to sync"
  badge. Drop it (subs complete their part via `/complete-my-part`, never the
  generic scoped PATCH, so nothing legitimate is lost). The mobile api client
  surfaces only the error MESSAGE, not the HTTP status — match the EXACT message
  (`/job not found/i`), never a bare `/not found/` substring, or you risk
  dropping legitimately-retryable items.

**Cross-business assigned sub can't LOAD the job ("Failed to load job / Job
not found").** GET /api/jobs/:id scopes `storage.getJob(id, effectiveUserId)` to
the requester's ACTIVE workspace, so a subcontractor assigned to a job owned by
ANOTHER business 404s before the staff-tradie assignment check ever runs (they
show on the assigned team but can't open it). Fix pattern: on a null scoped
lookup, fall back to `getJobAssignmentForUser(id, req.userId)` (real logged-in
user, NOT effectiveUserId) → if active assignment, serve via `getJobPublic(id)`
(unscoped) and set a `crossBusinessAssigned` flag that SKIPS the later
teamMemberId-gated narrowing (assignment already proven). `getJobPublic` must
only ever be called behind an explicit assignment/ownership check. This is the
read-side twin of the offline "Job not found" drop above.

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
