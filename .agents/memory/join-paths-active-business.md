---
name: Join paths must set activeBusinessId
description: Every team-join path must set users.activeBusinessId or the joiner is masked as owner of their own business
---

When a user joins another business, the join path MUST set
`users.activeBusinessId = <joined businessOwnerId>`.

**Why:** role resolution (`getUserContext`, `/api/team/my-role`, `/api/auth/me`
isOwner) keys off `activeBusinessId`. If it's null, a user who has their own
auto-created business falls back to owner-mode of THAT business, so a
freshly-signed-up joiner is wrongly shown as "Owner" instead of their joined
role (e.g. Subcontractor).

**How to apply:** the invite-code redeem path already does this. The other three
join paths historically did NOT and had to be fixed: `/api/auth/accept-invite`,
`/api/team/invite/accept-passwordless/:token`, `/api/team/invite/accept/:token`.
Any NEW membership-creating route must do the same right after the
updateTeamMember/createTeamMember 'accepted' write.
