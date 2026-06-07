---
name: SMS conversation access-control sweep
description: Gating a conversation resource means ALL its sub-routes (read AND write, incl. the one with no check), not just the main GET.
---

When restricting access to an SMS conversation so workers only reach jobs they're
assigned to, the gate must be applied to **every** `/api/sms/conversations/:id*`
endpoint, not just the obvious `GET :id`:

- `GET :id`, `GET :id/messages`, `GET :id/client-insights`, `POST :id/read`,
  `DELETE :id`, `PATCH :id` all need: (1) `businessOwnerId === effectiveUserId`
  ownership check, then (2) a worker-assignment check.
- The shared gate `workerCanAccessConversation(userId, userContext, conversation)`:
  owner / `VIEW_ALL` / `MANAGE_TEAM` pass for any conversation; a plain worker
  passes only if `conversation.jobId` is in `getJobsByAssignee(userId)`.

**Why:** A first pass that only fixed the top read routes left
`GET :id/client-insights` (a parallel read surface exposing client financial/job
data) and `DELETE :id` exposed. `DELETE :id` historically had **no ownership
check at all** — a cross-tenant IDOR (any authed user could delete any business's
conversation by id). Sub-routes added later silently miss the gate the main route
got.

**How to apply:** Whenever you gate a resource, enumerate ALL its routes with
`rg -n '<resource path>/:id' server/routes.ts` and confirm each one carries both
checks — especially write routes (`DELETE`/`PATCH`) and secondary read surfaces
like `/insights`, `/messages`. Don't trust that a route already had any check.
