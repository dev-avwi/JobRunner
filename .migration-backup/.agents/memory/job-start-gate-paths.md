---
name: Job start gate must cover all status-write paths
description: Any server-side rule that gates a job transition to in_progress must be applied to every status-mutation route, not just the dedicated status endpoint.
---

A WHS/compliance gate on starting a job (transition to `in_progress`) is only safe if it runs on EVERY route that can write job status, not just `PATCH /api/jobs/:id/status`.

**Why:** the dedicated status endpoint is not the only writer. `PATCH /api/jobs/:id` (full update accepting `data.status`) and `PATCH /api/jobs/bulk-status` both set status to `in_progress` independently. Gating only the status endpoint left two trivially-bypassable paths (architect caught it; verified live both bypassed before the fix).

**How to apply:** put the rule in one shared guard (e.g. `checkJobStartGate({job,newStatus,businessSettings,effectiveUserId,fallbackUserId})` returning `{status,body}|null`) and call it from all three handlers in `server/routes/jobs.ts`. For compliance/assignee-specific checks, resolve `job.assignedTo` to a canonical user id with `resolveAssigneeUserId(assignedTo, businessOwnerId)` first — `assignedTo` may be a team-member record id, not a user id, so matching it raw against doc `holderUserId` gives false negatives. If any new job-status writer is added (mobile/offline sync etc.), it must call the same guard.

**The same "all three writers" rule applies to COMPLETION (transition to `done`), not just start.** Two distinct completion preconditions must both run on every writer: (1) the authorization gate (only owner/manager/primary-assignee may complete — `isPrimaryAssignee`), and (2) the time-entry precondition (all timers stopped, no negative durations, no overlaps — `getJobCompletionErrors`). The bulk-status path historically had the auth gate but silently skipped the timer-stop validation that `PATCH /api/jobs/:id` and `/:id/status` enforced inline, so bulk-complete could finish a job with running timers. Both are now centralized as module-level helpers; any new done-writer must call both.
