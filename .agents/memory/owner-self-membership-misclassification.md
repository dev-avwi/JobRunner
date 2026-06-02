---
name: Owner misclassified as non-owner (self team-membership + dup settings)
description: Why an owner intermittently gets 403 on owner-only routes and how owner detection must stay deterministic.
---
A business owner can be wrongly resolved as a NON-owner (isOwner=false) when ALL of:
- users.active_business_id is null, AND
- a self team_members row exists (member_id === business_owner_id, accepted), AND
- getBusinessSettings returns an empty/placeholder-name row.

getUserContext (server/permissions.ts): when active_business_id is null it reads getBusinessSettings; if businessName is empty/"Worker Profile" it falls back to getTeamMembershipByMemberId, finds the self-membership, and marks isOwner=false → ownerOnly() 403s every owner-only route (saves, team, billing). Because getBusinessSettings cached for 60s and used to do .limit(1) with NO order, with duplicate business_settings rows the chosen row (and thus owner status) was NONDETERMINISTIC → intermittent "saves/team functions break".

**Rule 1:** getBusinessSettings MUST order deterministically — prefer a real businessName (not '' and not 'Worker Profile') via CASE, then updatedAt/createdAt desc — never bare limit(1).
**Rule 2:** In getUserContext, a membership whose businessOwnerId === userId is a SELF row; treat that user as the owner (clear teamMembership), never as their own employee.
**Why:** prod owners accumulated duplicate business_settings (legacy onboarding PATCH-then-POST) + a self team_members row; this combo silently locked them out.
**How to apply:** any new owner/permission resolution path must not rely on an unordered settings lookup, and must guard self-memberships. Duplicate business_settings rows still exist in prod data (read-only) — dedupe is a separate user-gated cleanup; a unique constraint on business_settings.user_id would prevent recurrence.
