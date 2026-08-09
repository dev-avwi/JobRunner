---
name: users.role is vestigial (medical-template leftover)
description: The users.role DB column is dead data with a 'patient' default; not the access-control source. Don't panic when you see weird role values.
---

# `users.role` is vestigial dead data

The `users.role` column exists in the Postgres DB with a column default of
`'patient'::text` (a leftover from a medical/healthcare template the schema was
once based on). In prod the values are mostly `patient` (~52 of ~58 users),
plus a few `worker` and one `practitioner`.

**It is NOT defined in `shared/schema.ts`'s `users` pgTable.** Drizzle only
selects mapped columns, so `storage.getUser()` returns objects WITHOUT `role`.
Every `user.role === '...'` comparison in `server/routes.ts` therefore compares
against `undefined` and is effectively always false. The value in the DB is
invisible to the app.

**Why it doesn't break anything:** access control derives owner status from
business_settings (a real own-business name → `isOwner: true`, all permissions)
and team-member status from `team_members.roleId` + permissions
(`getUserContext` in `server/permissions.ts`). It never trusts `users.role`.

**How to apply:** Seeing `role: 'patient'` (or other medical terms) on a tradie
account is expected and harmless — do not treat it as the bug. New signups still
inherit the `'patient'` DB default because `createUser` doesn't set role. The
runbook (replit.md) lists `users.role` as a column `drizzle-kit push` wants to
drop; that drop would be safe data-wise but is gated/deferred, not auto-run.

Also note: a single owner can have **multiple `business_settings` rows** (legacy
onboarding created extras; ~8 owners in prod, some with 3). `getBusinessSettings`
handles this deterministically: prefers a row with a real (non-empty,
non-"Worker Profile") name, then most recently updated/created.
