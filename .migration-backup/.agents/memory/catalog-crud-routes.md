---
name: Catalog (price-book) item CRUD routes
description: The /api/catalog feature was create-only; edit/delete needed wiring, and the whole feature is per-user scoped, not per-business.
---

The line-item catalog ("items" / price book, table `lineItemCatalog`) is scoped by the ACTING user's id (`req.userId`), NOT the business owner's effectiveUserId: GET uses `getLineItemCatalog(req.userId)`, POST writes `userId: req.userId`, and PATCH/DELETE guard on `existing.userId === req.userId`. Consequence: team members each see/edit only the items they created; managers can't edit the owner's items and vice-versa. Left as-is deliberately (matching GET/POST); switching to shared business scope would need all four routes to use effectiveUserId + a backfill.

**Bug that bit us:** editing/deleting a catalog item failed for everyone because the web manager (`client/src/pages/TemplatesHub.tsx`) called `PATCH/DELETE /api/catalog/:id` but the server only had GET + POST. The storage methods (`updateLineItemCatalogItem`, `deleteLineItemCatalogItem`) already existed but were never wired to routes. Symptom looked like a permissions/"old account" problem but was a missing endpoint.

**How to apply:** id-only storage getters (`getLineItemCatalogItem(id)`) have no tenant scoping, so any new catalog write route MUST fetch-then-check `existing.userId === req.userId` (404 on mismatch) to avoid IDOR. Validate PATCH bodies with `insertLineItemCatalogSchema.partial()` — it already omits id/userId/timestamps so ownership can't be reassigned. Both write routes gate on `createPermissionMiddleware(PERMISSIONS.MANAGE_CATALOG)` (owner + admin + manager have it). Mobile only GETs the catalog for line-item selection; there is no mobile item manager.
