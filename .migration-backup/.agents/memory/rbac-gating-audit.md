---
name: RBAC gating audit conventions
description: How to gate requireAuth-only mutation endpoints and the template-permission gotcha; IDOR-by-id storage pattern
---

# Gating ongoing audit — conventions that hold for this app

Owner always passes every permission gate (OWNER role = all PERMISSIONS) and the demo
account (demo@jobrunner.com.au) IS an owner, so adding `createPermissionMiddleware(...)`,
`ownerOnly()`, or `requirePaidTier()` after `requireAuth` NEVER breaks the demo. Verify a
fix by confirming demo returns non-403/402 (400/404/500 from an empty body is fine).

## Template-permission gotcha (got this wrong once)
For template/preset *creation* endpoints (quote-templates, custom-forms, message-templates),
use `createPermissionMiddleware(PERMISSIONS.MANAGE_TEMPLATES)` — NOT `ownerOrManagerOnly()`.
**Why:** `ownerOrManagerOnly()` checks `isOwner || MANAGE_TEAM`, and Managers HAVE
`MANAGE_TEAM` but the role matrix deliberately withholds `MANAGE_TEMPLATES` from them. Using
`ownerOrManagerOnly()` silently grants managers a power the permission model denies.
`MANAGE_TEMPLATES` = Owner + Admin only. (Earlier message-templates round used
ownerOrManagerOnly — that was the same mismatch; prefer the explicit permission.)

## ownerOnly() is safe for onboarding endpoints
`getUserContext().isOwner` is `true` for any user with NO team_membership row, so a
brand-new owner mid-onboarding passes `ownerOnly()`. Workers always have a membership →
isOwner false. So gating `/api/onboarding/complete` + `/clear-demo-data` with `ownerOnly()`
both blocks workers AND prevents a worker from creating a spurious business_settings row
(the owner-self-membership misclassification path).

## Business-shared resources must key on effectiveUserId end-to-end
For resources owned by the business (templates, presets, catalog, etc.) where team
members share the owner's data, list/create/update/delete must ALL resolve identity the
same way: `getUserContext(req.userId).effectiveUserId` (or `req.userContext.effectiveUserId`
if a permission middleware already ran). **Why:** `getUserContext` honors
`users.activeBusinessId` (workspace switching), but `storage.getTeamMembershipByMemberId()`
just returns the FIRST membership. If a GET/list uses raw `req.userId` (which internally
falls back to first-membership) while a mutation's ownership check uses `effectiveUserId`,
a multi-business member can SEE a row in the list but get a false 404 editing it. Fix the
list to pass `effectiveUserId` too. Rows are created under `effectiveUserId`, so members
never own copies under their own raw id — passing effectiveUserId loses nothing.

## Accepted quotes must be locked from edits (parallels invoice lock)
PATCH /api/invoices/:id blocks edits when `lockedAt || status==='paid'`. PATCH /api/quotes/:id
historically had NO equivalent guard, so a WRITE_QUOTES staffer could alter line items/totals
AFTER a client digitally accepted (accept flow sets `status='accepted'` + `acceptedAt`),
undermining the signed agreement. Fix: `storage.claimQuoteForEdit(id,userId)` does one atomic
conditional UPDATE (`where status<>'accepted' and acceptedAt is null`); 0 rows → 403 (accepted)
or 404 (not found). Handler calls it FIRST. **Why atomic claim not just a read:** a read-then-write
check is TOCTOU-racy. **Known residual (deliberately not fixed):** the later line-item
delete/recreate + totals writes in that handler are separate non-transactional writes, so a
portal-accept landing mid-edit can still interleave. Full fix = wrap handler in a tx with
`SELECT ... FOR UPDATE`, but that refactors a 150-line financial editor + shared storage methods
(updateQuote/createQuoteLineItem use module-level db) — higher risk to 57 prod users than the
rare same-quote accept-vs-edit race it closes. Both actors are authorized; it's an ordering
question, not a breach. Architect will FAIL anything short of the tx — that's an accepted
tradeoff for a low-risk pass, not an oversight. If quote editing ever needs hard concurrency
correctness, do the tx refactor as its own scoped task.

## IDOR-by-id storage footgun
Several storage methods take only an `id` with no owner predicate (e.g. `getStylePreset(id)`,
`deleteStylePreset(id)`, `getQuoteTemplate(id)`). GET/PATCH/DELETE-by-id handlers that call
them leak/mutate across businesses. **Fix at the route layer** (don't change storage
signatures — other callers): fetch first, then
`if (!row || row.userId !== req.userId) return res.status(404)`. Use 404 (not 403) so you
don't leak existence. Match the existing per-resource scoping field (some handlers use
`req.user.id`, some `req.userId`, some `effectiveUserId` — mirror the sibling list/POST
handler for that resource rather than introducing a new one).

## Cross-business write-association IDOR on create endpoints
Create handlers (POST /api/quotes, /api/invoices, /api/jobs) accept foreign-key ids
(clientId/jobId/quoteId) in the body and set the new row's own userId=effectiveUserId, but
historically did NOT verify the *referenced* FK belongs to the caller. So an authenticated user
could attach their quote/job/invoice to ANOTHER business's clientId/jobId/quoteId.
**Fix at route layer, before the create:** if the FK is present, fetch via the owner-scoped
getter (getClient(id,uid)/getJob(id,uid)/getQuote(id,uid) all filter id+userId) and 404 if it
returns undefined. Gate each check with `if (data.fk)` since jobId/quoteId are optional
(clientId is notNull on all three). **Why 404 not 403:** don't leak existence of other
businesses' records. **Offline-sync safe:** mobile sync_queue is FIFO by created_at with
local->server id remapping (offline-storage.ts updateLocalIdWithServerId rewrites queued
payloads), so a client always syncs before the quote/job that references it — no false 404.
FIXED (route-layer FK ownership guards, 404 on foreign id): inventory items POST (categoryId
via getInventoryCategories membership), inventory items/:id/transactions POST (itemId via
getInventoryItem — was creating txn BEFORE the ownership fetch; architect caught it),
equipment POST (categoryId via getEquipmentCategories), equipment/:id/maintenance POST
(equipmentId path via getEquipmentById), purchase-orders POST (supplierId via getSupplier +
each item.inventoryItemId via getInventoryItem, validated BEFORE PO create to avoid partial PO),
team-groups/:id/members POST (teamMemberId via getTeamMembers membership). Note: no singular
getInventoryCategory/getEquipmentCategory getter exists — verify category FKs via the LIST
getter + `.some(c=>c.id===fk)`. Categories per business are few, so membership check is cheap.
FIXED: job-equipment assign POST /api/jobs/:id/equipment (equipmentId via getEquipmentById
before addJobEquipment; previously only the jobId was checked). jobs/:id/assign is already
correctly guarded (canAssignJobTo + getTeamMembers).

## KNOWN follow-up (logic bug, NOT yet fixed — risky, touches prod data)
job_equipment.user_id is written inconsistently: POST /api/jobs/:id/equipment inserts
userId = String(req.user.id) (the ACTOR), but PATCH /api/jobs/:jobId/equipment/:assignmentId
and the conflict-check filter by effectiveUserId (the OWNER), and DELETE/removeJobEquipment
filters by the passed userId (actor again). For a TEAM MEMBER (req.user.id != effectiveUserId)
this means owner can't PATCH a member-created assignment and vice-versa. Fix needs a canonical
meaning for the column + a backfill migration — do NOT flip insert semantics blindly (strands
existing rows). Flagged by architect; left for a dedicated, user-gated change.

## Destructive-endpoint IDOR sweep — CLEAN
Audited 40+ DELETE/PATCH/PUT-by-:id handlers across routes.ts + routes/*.ts. All scope
mutations to the caller's business (storage call takes effectiveUserId, or a pre-fetch
ownership check returns 404). Two explorer "weak spots" verified FALSE POSITIVE:
deleteSavedFilter(id,userId) WHERE id AND userId; updateJobRequestByClient(id,clientId)
WHERE id AND clientId AND status='pending' (intended client-portal self-edit). Rule
confirmed: destructive storage methods consistently put the owner column in the WHERE.
