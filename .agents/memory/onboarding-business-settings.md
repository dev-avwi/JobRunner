---
name: Onboarding business-settings + template seeding
description: Non-obvious server rules the web/mobile onboarding flow must respect when saving business settings and trade.
---

# Onboarding: business-settings save + trade template seeding

**Rule:** Trade-specific business templates are seeded ONLY by `POST /api/business-settings` when the body carries a non-empty `tradeType`. `PATCH /api/business-settings` updates `tradeType` (on the user record) but does NOT seed templates.

**Why:** The POST handler calls `storage.seedBusinessTemplatesForUser(userId, tradeType)`; the PATCH handler does not. So if onboarding collects the business details and creates the row *before* a trade is chosen, the trade-specific templates never get seeded.

**How to apply:**
- In the web onboarding (`SimpleOnboarding.tsx`) the trade step must come before the first row create, and the create must include `tradeType`, so seeding fires. Owner step order is `role → trade → business → done` for this reason.
- `storage.createBusinessSettings` is a plain INSERT (unique `userId`) — it throws on a duplicate row. A row may already exist (created at registration in some auth flows, or by the trade step's auto-save). So the business save must be idempotent: PATCH first, and only POST on an explicit `404`. Never blindly POST.

**Profile update during worker/subbie invite redeem:** use `PATCH /api/profile/me` (accepts firstName/lastName/phone). There is no `/api/user/profile`. Keep the profile update non-blocking (`.catch`) — the invite redeem already succeeded, so a name-update failure must not error the user out of a team they've joined.
