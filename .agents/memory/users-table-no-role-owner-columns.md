---
name: users table has no role / businessOwnerId columns
description: Gating that reads user.role or user.businessOwnerId off the users row is silently broken — both are always undefined.
---

The `users` table (shared/schema.ts) has **no `role` column and no `businessOwnerId` column**. Any route that does `const user = await storage.getUser(id)` and then reads `user.role` or `user.businessOwnerId` gets `undefined`.

**Why this is dangerous (fail-open):** a check like `const isOwner = !user.businessOwnerId || user.businessOwnerId === userId` evaluates to `true` for EVERYONE, so owner/manager-only gates pass for every authenticated team member (including staff/subcontractors). Mirror checks like `user.role === 'manager'` / `'staff_tradie'` / `'office_admin'` are always `false`, so role-based restrictions never fire and per-user scoping collapses to the caller's own id (`user.businessOwnerId || userId` → always `userId`), siloing business data per-user instead of sharing it across the business.

**How to apply:** the real RBAC source of truth is `getUserContext(req.userId)` → `{ isOwner, effectiveUserId, permissions, roleName }`. Team-member role lives in `user_roles` via `team_members.roleId`, NOT on the user row.
- Business scoping key = `userContext.effectiveUserId` (owner's id for team members; own id for owners).
- Owner/manager mutation gate = `userContext.isOwner || userContext.permissions.includes(PERMISSIONS.MANAGE_TEAM)`.
- "See everything" read gate = `userContext.isOwner || userContext.permissions.includes(PERMISSIONS.VIEW_ALL)`; non-VIEW_ALL members should be holder/own-scoped.
- Holder-scoped queries must also filter by the effective `businessOwnerId` to stay tenant-correct under multi-business workspace switching.
