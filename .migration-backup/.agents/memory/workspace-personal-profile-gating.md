---
name: Personal profile workspace gating
description: Who is allowed to see the "Personal profile" workspace in the workspace switcher
---

# Personal profile workspace visibility

The "Personal profile" (own-business / `isOwnBusiness`) entry returned by
`GET /api/auth/my-businesses` is shown ONLY when at least one is true:
- the user has a real own business name (`hasRealOwnBusiness`), OR
- their own `business_settings.accountType === 'subcontractor'`, OR
- they have no team memberships at all (pure owner — must always have a workspace).

A pure team member / worker (joined a business, no real own business, not a
subcontractor) does NOT get a Personal profile workspace.

**Why:** product decision — only owners and subcontractors should operate a
personal workspace; a plain worker's own profile is empty/meaningless and
confused users.

**How to apply:** gate it server-side in the my-businesses endpoint. Do NOT
rewrite the returned `activeBusinessId` to fake an active card when personal is
hidden — that desyncs displayed-active from the real stored context and the
switcher disables the active card (`disabled={isActive}`), trapping the user.
Return the real stored active; if it isn't in the visible list, the switcher
already leaves all cards tappable so the user can perform a real switch.

`accountType` defaults to `'business'`, so it does NOT distinguish a worker from
an owner — use the memberships + real-own-business signals above, not accountType
alone (except for the explicit subcontractor case).
