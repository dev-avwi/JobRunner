---
name: Invite acceptance vs cross-business email conflict
description: Why accepting a team invite to create a new account can wrongly fail with a generic "Failed to create account" 400, and the trusted-invite rule that fixes it.
---

# Invite acceptance must bypass cross-business identity conflicts

When a logged-out invitee accepts a team invite and creates a brand-new account,
the signup runs through `AuthService.register` → `findEmailConflict`. That conflict
check fails CLOSED against ANY identity sharing the email: existing user, **client
record**, or **pending/accepted team_member rows under OTHER businesses**. So if the
invitee's email is also (e.g.) a client of another business, or has a second pending
invite elsewhere, register returns `success:false` and the accept route returns HTTP
400 with the generic client message "Failed to create account. Please try again."

**Why:** `findEmailConflict` was designed for PUBLIC self-serve signup to stop email
squatting / orphan accounts under another workspace. But invite acceptance is
different: receiving the invite link at that inbox is itself proof of email ownership
(same proof already used to pre-verify the email). The same person can legitimately
be another business's client AND a worker in their own business.

**How to apply:** A registration is "trusted" only when the supplied `inviteToken`
resolves to a still-`pending` team_member whose email exactly matches the email being
registered. In that case `findEmailConflict` returns null right AFTER the existing-USER
check — so a real existing user account still blocks (they must log in), but
cross-business client/other-invite rows do NOT block. Self-serve signup (no token, or
non-matching token) keeps the full fail-closed behavior. The trust flag can't be
spoofed without a valid pending invite token matching the email.

**Debugging tip:** the Express logger truncates response bodies in deployment logs
(`:: {"success":…`), so you won't see the exact error string. Go straight to the
production DB (read-only) and enumerate ALL identities for the email across `users`,
`team_members` (note: column is `member_id`, not `user_id`), and `clients` — the
duplicate that's blocking is usually under a different `business_owner_id`.
