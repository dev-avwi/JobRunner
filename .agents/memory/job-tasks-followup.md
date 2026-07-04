---
name: Follow-up tasks (task-to-form linking)
description: Ownership/auth rules for the customizable Job Card follow-up-task feature (web + mobile)
---

Follow-up tasks are spawned server-side by owner-defined form task rules (evaluated on every form submission) and can also be added manually.

- **Task mutation routes (POST/PATCH/DELETE /api/tasks) are strict `ownerOnly`; the read (GET /api/jobs/:jobId/tasks) is `requireAuth`.**
  **Why:** owner controls everything; workers only view. A manager/admin is NOT the owner and will 403 on the mutations.
  **How to apply:** gate the task UI's interactive controls (add input, toggle checkbox, delete) on the STRICT owner signal on both platforms — web `useUserRole().isOwner`, mobile `roleInfo?.isOwner || isSoloOwner` (NOT `isOwnerOrManager`). Non-owners get a read-only list, hidden entirely when empty; owners always see the card so they can add manually.

- **There are three form-submission POST paths that must each carry the taskRules hook AND cross-tenant guards:** the canonical `/api/form-submissions` (server/routes.ts), the job-scoped `/api/jobs/:jobId/form-submissions` (server/routes/jobs.ts), and the one in server/routes/custom-forms.ts.
  **Why:** the job-scoped route originally spread `req.body` straight into createFormSubmission with no form/job ownership check (cross-business write / integrity IDOR) and never normalized the mobile `data` key.
  **How to apply:** any new submission path must validate form + job belong to `getUserContext(userId).effectiveUserId`, strip server-controlled fields (id/submittedBy/submittedAt/reviewedBy/reviewedAt/status/customerUserId), and normalize mobile's `data` → DB column `submissionData` before insert.
