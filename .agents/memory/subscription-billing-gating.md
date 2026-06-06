---
name: Subscription & billing route gating
description: Owner-gate + tier-whitelist rules for /api/subscription/* and /api/billing/* mutations
---

# Subscription & billing access control

All subscription/billing **lifecycle mutation** routes must be `ownerOnly()` (after `requireAuth`), not bare `requireAuth`. This covers both the `/api/subscription/*` family (cancel, manage, reactivate, pause, unpause, upgrade-to-team, upgrade-to-business, downgrade-to-pro) and the legacy `/api/billing/*` family (cancel, resume, portal). Several of these (reactivate/pause/unpause, billing cancel/resume/portal) were originally only `requireAuth` — a non-owner team member could mutate the owner's plan.

**Why:** subscription is a business/owner-level resource; team members share the owner's plan and must never start/stop/pause it. Gate is inconsistent route-by-route, so when adding any new subscription/billing mutation, copy the sibling's `ownerOnly()`.

**How to apply:** `app.post("/api/subscription/X", requireAuth, ownerOnly(), handler)`. Checkout/create-checkout endpoints are intentionally left `requireAuth` only (a fresh signup is the sole owner of their own business and may need to initiate a plan before role state settles; the real plan change happens via Stripe webhook).

## Trial tier escalation
`startTrial(userId, tier)` in server/subscriptionService.ts sets `user.subscriptionTier = trialTier` directly. `subscriptionTier` enum is `free/pro/team/business/trial`. The route `POST /api/subscription/trial` passes `req.body.tier` straight in — the `'pro'|'team'` is only a compile-time type, so a client could send `tier:'business'` and get full business access free.

**Rule:** whitelist client-supplied tier at the trusted boundary (the service): `const requestedTier = tier === 'pro' || tier === 'team' ? tier : undefined;` then fall back to intendedTier/'pro'. Never let a client-supplied plan/tier value flow into a tier write unchecked.
