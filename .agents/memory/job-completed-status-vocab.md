---
name: Job completed status is 'done' not 'completed'
description: Canonical finished-job status value, and where filtering on the wrong value silently fails
---
The canonical job lifecycle status is `pending → scheduled → in_progress → done → invoiced`. A finished job has `status === 'done'` (UI labels `done` as "Completed"). There is NO `'completed'` job status anywhere in the codebase.

**Why:** Any server filter written as `j.status === 'completed'` (or `!== 'completed'`) silently matches zero rows — counts/lists come back empty/0 with no error. This caused the subcontractor dashboard `jobsCompletedMonth` to always show 0, and is an easy trap because "completed" is the natural English word.

**How to apply:** When counting/filtering finished jobs, use `'done'` (and usually also `'invoiced'`, since invoiced jobs were completed first). `completedAt` is set alongside `status:'done'` on the mark-complete path, so date-bounded "completed this month" filters can rely on it. Subcontractor dashboard + unbilled-work both key off the `jobAssignments` (isActive) table for which jobs belong to a subcontractor.
