---
name: Team-capable tiers + standalone-subbie block
description: Which subscription tiers may have team members/subcontractors, and how subbie standalone signup is blocked. Authoritative gate vs the misleading TIER_LIMITS table.
---

**Only Team, Business (and beta) tiers are team-capable. Free AND Pro are single-user.**
The authoritative gate is `ownerHasTeamCapability(owner, businessSettings)` in `server/permissions.ts` — `teamCapableTiers = {team, business, beta}`. A Free/Pro owner cannot generate invite codes, and redeem/accept reject with `code:'team_plan_required'`.

**Footgun:** `TIER_LIMITS` in `shared/schema.ts` lists Pro = 1 seat, which makes it LOOK like Pro can have a worker. It cannot — `ownerHasTeamCapability` (not TIER_LIMITS) decides who may invite/redeem, and it excludes Pro. Don't trust the seat table for "can this plan have a team"; trust `ownerHasTeamCapability`. (The explore subagent was misled by TIER_LIMITS and reported Pro=1 seat as if Pro allowed members — it doesn't.)

**Per-business membership = multi-business resilience, already built.** Each business a sub joins is its own `team_members` row gated by that owner's live subscription via `ownerSubscriptionValid` in `getUserContext`. So a sub working for A+B keeps working for B if A cancels; each paying business consumes one of its OWN seats. Seat cap → `checkTeamSeatLimit` blocks adding more until owner upgrades. None of this needed new code.

**Standalone subbie signup is blocked on BOTH clients (subbie must redeem an invite to finish onboarding):**
- Web `SimpleOnboarding.tsx`: already invite-only (subbie uses `handleWorkerRedeem`, requires `inviteValidation.valid`); no standalone accountType write.
- Mobile `mobile/app/(onboarding)/setup.tsx`: WAS the gap — the "Connect to a business" step had a "Skip for now" button (`handleSubConnect(true)`) that finished onboarding as a standalone `accountType:'subcontractor'`. Now `handleSubConnect()` requires a valid invite + successful `/api/team/invite-code/redeem` before advancing; skip button removed; Connect&Continue disabled until a valid code.

**Why force-quit mid-flow is safe:** `handleSubDetailsNext` writes `accountType:'subcontractor'` BEFORE connect, but `completeOnboardingTracked` only runs at the privacy step AFTER a successful redeem. So `onboardingCompleted` stays false until they join, and the server onboarding guard blocks app use until then (invite validate/redeem stay onboarding-exempt). The early accountType write is just a label; the redeemed membership overrides it.

**Grandfathered standalone subbies:** existing prod accounts with `onboardingCompleted=true` are NOT migrated by this change — it only blocks NEW standalone creation. Fully forbidding existing ones is a separate migration/enforcement decision, not yet done.
