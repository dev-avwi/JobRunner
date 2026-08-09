---
name: Mass-assignment on scoped storage updates
description: Why PATCH routes that scope WHERE by (id,userId) still need req.body field-stripping, and the fix pattern.
---

A storage method like `updateX(id, userId, updates)` whose WHERE clause is `(id AND userId)` is NOT safe just because it's ownership-scoped. The `updates`/`Partial` object is spread into the SET clause, so a raw `req.body` lets a caller inject server-controlled columns:
- `id` → re-keys the row to an attacker-chosen primary key (corruption).
- `userId` / `businessOwnerId` → reassigns the caller's OWN row to another account.
- `createdAt` / `updatedAt` → timestamp spoofing.
Cross-tenant write is still blocked by the WHERE, but self-corruption + reassignment + workflow-field bypass are real.

Same applies to create routes shaped `createX({ ...req.body, userId })`: `userId` is safe (later key wins, overrides body), but `id`/`createdAt`/`updatedAt` are injectable.

**Fix pattern (matches existing codebase style):**
```
const patchData = { ...req.body };
delete patchData.id; delete patchData.userId; delete patchData.businessOwnerId; delete patchData.createdAt; delete patchData.updatedAt;
await storage.updateX(id, userId, patchData);
```
Do NOT strip business-editable workflow fields (status, amount, etc.) — those are legitimately PATCH-able by the owner. Only strip identity/ownership/timestamp columns.

**Why:** drizzle update does `.set({ ...updates, updatedAt: new Date() })` — anything in `updates` lands in SET.
**How to apply:** during route audits, for every `app.patch`/`app.post` that passes `req.body` (or `{...req.body, ...}`) into a storage create/update, confirm it either parses through an insert schema that `.omit()`s those fields, or strips them inline. Routes that build a controlled literal (e.g. `{ status: 'submitted', submittedAt: new Date() }`) are already safe — not a gap.

**Audit false-positive notes (this app):** explorer subagents heavily over-report. Confirmed-safe-despite-flags: quote-templates & style-presets GET/PATCH/DELETE (all have `userId !==` ownership checks); Xero local-preview uses `req.userId` (more restrictive, not IDOR); invoice mark-paid & payment-installments/:id/pay are owner manual cash/cheque reconciliation, ownership-scoped (intended, not payment-bypass); PayPal webhook & Apple notifications handlers are log-only stubs with zero side effects (no signature verify needed). Always verify before counting/fixing.
