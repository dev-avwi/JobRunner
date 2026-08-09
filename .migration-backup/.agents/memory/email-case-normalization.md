---
name: Email case-normalization / duplicate accounts
description: Why two accounts could share one email, and the normalize-on-write + case-insensitive-on-read rule that prevents it.
---

# Duplicate accounts from email case mismatch

The prod `users` unique index (`users_email_unique`) is on `(email)` and is
**case-sensitive** — it does NOT enforce `lower(email)` uniqueness. So
`Ayden@x.com` and `ayden@x.com` are two allowed rows.

**Why duplicates happened:** the email/password register path wrote the email
verbatim (mixed case) while OAuth paths lowercased it, and `getUserByEmail`
matched with case-sensitive `eq()`. Register as `Ayden@x.com` (stored
mixed-case) → later "Sign in with Google" lowercases to `ayden@x.com` → the
existing-user check misses the mixed-case row → a second account is created and
the case-sensitive index permits both. The same miss also broke LOGIN for any
mixed-case row.

**Rule (the fix):**
- **Read** all email lookups case-insensitively: `WHERE lower(email) = lower(trim(input))`. When legacy dups may exist, add `.orderBy(asc(createdAt)).limit(1)` so resolution is deterministic (oldest wins).
- **Write** every email path lowercased+trimmed: `createUser`, `updateUser`, `upsertUser`, plus passwordless `verifyLoginCodeAndCreateUser` and the login-code helpers, and `getPendingTeamMembersByEmail`.

**How to apply:** any new auth/lookup path that touches `users.email` (or
`teamMembers.email`, `loginCodes.email`) must normalize both sides. Don't rely
on the DB index for uniqueness — it's case-sensitive.

**Deliberately NOT done (user-gated, destructive):**
- Creating a `LOWER(email)` unique index — would fail if dups already exist, and this DB isn't safe for `db:push` (see db-add-table-no-push.md).
- Auto-merging existing duplicate rows — destructive; leave for explicit user decision.

`findEmailConflict` (server/auth.ts) already lowercases for its teamMembers
check and relies on `getUserByEmail` for the user check — so the storage-layer
fix flows through it automatically.
