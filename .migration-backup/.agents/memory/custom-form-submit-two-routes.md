---
name: Custom-form submit has two server routes
description: Form submission and form access logic must be changed in BOTH the web route and the mobile route, which live in different files.
---

Custom form submissions go through TWO different server endpoints:
- `POST /api/form-submissions` in `server/routes.ts` — used by the web client.
- `POST /api/custom-forms/:formId/submit` in `server/routes/custom-forms.ts` — used by the mobile `form-fill` screen.

**Why:** they were written at different times and never unified. A change to one (e.g. how a form is looked up, or who is recorded as the submitter) silently leaves the other on the old behaviour, so the same feature works on web but not mobile (or vice versa).

**How to apply:** any change to custom-form access scope or submission attribution must be applied to both routes. Two gotchas that already bit:
- Form lookup: both must fall back from the shared/owner pool (`effectiveUserId`) to the caller's own personal form (`req.userId`) so a worker can submit a template they created themselves.
- `submittedBy` must be the actual actor (`req.userId`), NOT `effectiveUserId` — the mobile route was writing the owner id, destroying audit attribution for worker submissions.

Related model: custom-form templates are owner-scoped shared pool (`userId=ownerId`) UNION the caller's own personal templates (`userId=workerId`); see `getCustomFormsVisibleTo` in storage.ts. Owner/manager (MANAGE_TEMPLATES) manage the shared pool; a member edits/deletes only their own.
