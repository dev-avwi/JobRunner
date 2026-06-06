---
name: Paid-tier gate must be owner-context aware
description: Why requireProSubscription is the wrong gate for team-aware paid features; use requirePaidTier()
---

# Paid gating on a team app: resolve to the OWNER, not the logged-in member

`requireProSubscription` (server/routes/middleware.ts) checks `req.user.subscriptionTier`
only. `requireAuth` sets `req.user` to the logged-in member's own user row (it only swaps
in demo-data id, it does NOT resolve the business owner). So a worker/manager invited to a
PAID business — whose own user row is `free`/null — gets a **403** even though the business
pays. This is a latent app-wide quirk: most existing AI endpoints still use
`requireProSubscription`.

**Rule:** for any feature that should be unlocked for the whole team when the BUSINESS owner
has a paid plan, gate with `requirePaidTier('pro'|'team'|'business')`, NOT
`requireProSubscription`.

**Why:** `requirePaidTier` resolves `userContext.effectiveUserId` → the owner, reads the
owner's tier, AND downgrades lapsed subscriptions (past_due/canceled/unpaid/paused) to free.
It returns **402** (`SUBSCRIPTION_LIMIT`, triggers the client upgrade flow) vs
`requireProSubscription`'s plain 403. This matches the rest of the team model
(`requirePaidTierForSms`, `ownerOrManagerOnly`'s `ownerSubscriptionValid`).

**How to apply:** pattern is `requireAuth, <perUserLimiter>, requirePaidTier(), ...`. The
limiter comes BEFORE the tier gate. `requirePaidTier()` default minTier is `'pro'`.

**Verify after change:** demo (owner, team tier) must return non-402/403 on the endpoint
(404/400/500 from empty body is fine — it passed the gate).
