---
name: Read-IDOR on id-only storage getters
description: GET/POST routes that fetch a single record via an id-only storage getter and return/use it without a tenant ownership check leak cross-tenant data.
---

# Read-IDOR via id-only single-record getters

Several `storage.getX(id)` methods in `server/storage.ts` take ONLY an id (no userId)
and return a single row unscoped. Safe usage = the caller first verified ownership of a
parent (e.g. `getClientById(quote.clientId)` after the quote was owner-verified). The
bug = a route reads such a record straight from `req.params` and returns/uses it with no
ownership check.

**Rule:** any route that fetches a record by an id-only getter and exposes or acts on it
must verify tenancy before responding. The proven key on this codebase is
`getUserContext(req.userId).effectiveUserId` (normalizes team-member → owner). Use 404 for
not-found/not-owned (avoid leaking existence).

**Footgun — `req.businessOwnerId` is NEVER set** by any middleware. The common idiom
`const businessOwnerId = req.businessOwnerId || req.userId` silently collapses to the
caller's own id. That works for an OWNER (own id == business owner) but 403s legitimate
TEAM MEMBERS, and is NOT a correct tenancy key. Always resolve `effectiveUserId` via
`getUserContext` instead.

**Confirmed-clean sibling pattern (SMS):** `/api/sms/conversations/:id/messages`,
`/client-insights`, PATCH conversation all do
`if (conversation.businessOwnerId !== effectiveUserId) return 403`. Match that.

**Found+fixed examples:** `GET /api/sms/conversations/:id` (returned a whole conversation
with no check), `POST /api/sms/messages/:messageId/create-job` (read another tenant's
message/conversation and spun a job from it), `GET /api/assignments/:assignmentId/location`
+ `/location-history` (leaked live worker GPS by guessing assignment id — fixed via a shared
guard: assigned worker `assignment.userId === req.userId` OR owning business
`getJob(assignment.jobId, effectiveUserId)`).

**How to apply:** when sweeping, grep `async get[A-Za-z]+\(id: string\): Promise<X | undefined>`
in storage.ts, then check each route caller: is the result returned/used after an ownership
check, or fetched directly from params? Intentional public getters: `getJobPublic`,
`getReceiptById` (token), `getUser`/`getUserById` (internal).
