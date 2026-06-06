---
name: id-only storage write IDOR sweep
description: How to audit storage update/delete methods whose WHERE is scoped by id only, and where the real ownership check lives in this codebase.
---

# id-only storage writes are a recurring IDOR surface

Many `storage.update*/delete*` methods in `server/storage.ts` scope their WHERE by primary id only (`.where(eq(table.id, id))`) and take **no** userId/businessOwnerId argument. That is NOT automatically a vuln — ownership in this codebase is enforced in one of three places, and the audit is to confirm at least one exists per call site:

1. **In-method pre-check** — the method itself does `const existing = await this.getX(id, userId); if (!existing) return false/undefined;` before the id-only write (e.g. deleteJobVariation, deleteJobMaterial, deleteServiceReminder, deleteRebate, jobNotes delete). Safe.
2. **Route-level ownership** — the route fetches the owned set/parent and 404s if the id isn't in it (e.g. PATCH /api/worker-requests/:id/status does getWorkerRequests(ownerId)+find; JSA step routes now do getJsaStep→getJsaDocument(jsaId, req.userId)). Safe.
3. **Token/admin gating** — magic-link/token flows where the token IS the auth (updateSubcontractorTokenStatus), or admin-only routes (updateNumberPortRequest). Safe.

**The bug pattern:** an id-only storage write whose route has *neither* an in-method pre-check *nor* a route-level ownership lookup — only a generic `requireAuth`/permission middleware that checks the caller has the permission in THEIR business, not that the target row is theirs. JSA steps (`/api/whs/jsa/steps/:stepId` PATCH/DELETE) were exactly this: any user with WRITE_JOBS could edit/delete another tenant's step by guessing the id.

**Audit recipe:**
- `rg -n '\.where\(eq\([a-zA-Z]+\.id, id\)\)\.returning\(\)' server/storage.ts` to list id-only writes.
- Read each method body (the WHERE line alone lies — the pre-check is the lines above it).
- For methods with no userId param, grep the route caller and confirm route-level ownership or token/admin gating.

**Fix shape (matches sibling routes):** resolve the row → resolve its owning parent scoped by `req.userId` (JSA model scopes everything by the document's `userId` via plain `req.userId`, not effectiveUserId) → 404 if not owned. Leaving the storage method id-only is acceptable once every call site verifies ownership first.

**Also strip mass-assignment on raw-body updates:** handlers that do `const updates = { ...req.body }` then a blind `.set({ ...updates })` must `delete` server-controlled fields (id, userId/businessOwnerId, jobId/parentId, createdAt, updatedAt, and any server-set review/status metadata) before the storage call.

**Create-child-from-body-parentId is its own write-IDOR class.** A POST that takes a parent id from `req.body` (jobId/clientId/invoiceId/conversationId) and calls `storage.createX({ parentId, userId: req.userId, ... })` with NO parent-ownership check lets any authed user attach a child row to ANOTHER tenant's parent. Example fixed: POST /api/job-checkins created a check-in (GPS+notes) on any job by id. Fix = `getJob(jobId, getUserContext(userId).effectiveUserId)` (or getClient/getInvoice equivalent) → 404 before create. Audit: `rg 'const \{[^}]*\b(jobId|clientId|invoiceId|conversationId)\b[^}]*\} = req\.body'` then confirm a parent-ownership fetch precedes the create. Most core create routes (quotes/invoices/defects/AI-quote) already do this; the check-in POST didn't.
