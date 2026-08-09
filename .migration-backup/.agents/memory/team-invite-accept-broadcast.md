---
name: Team invite accept must broadcast team_member_changed
description: Owner's Team page stays "Pending" after a member accepts unless the accept path broadcasts a realtime event.
---

# Invite-accept paths must broadcast `team_member_changed`

Any server path that flips `team_members.inviteStatus` to `'accepted'` must also call
`broadcastTeamMemberChange(businessOwnerId, 'accepted', memberId)` (dynamic import of
`./websocket`, wrapped in try/catch so it never blocks the accept).

**Why:** the accept happens in the *joiner's* session. The *owner's* Team page only
refetches `['/api/team/members']` when it receives a `team_member_changed` websocket
event (handled in `client/src/hooks/use-realtime-updates.ts`). Without the broadcast the
owner sees a stale "Pending" badge until a manual refresh — looks like the accept failed.

**How to apply:** there are 4 accept paths in `server/routes.ts` — `/api/auth/accept-invite`,
`/api/team/invite/accept-passwordless/:token`, the invite-code redeem flow, and
`/api/team/invite/accept/:token`. If you add a new accept/join path, add the broadcast too.

**Multi-business gotcha (NOT a bug):** the same email can have separate invites under two
different business owners. Accepting one (matched by token) does not touch the other —
so one row can be `accepted` while another stays `pending`. That is correct data, not a
routing failure. Invite accept matches by TOKEN, not by email.
