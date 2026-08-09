---
name: business_settings write schema must omit server-controlled fields
description: Why /api/business-settings POST+PATCH use a strict omit schema, not the raw insert schema
---
`createInsertSchema(businessSettings)` only omits id/userId/createdAt/updatedAt, but the
business_settings table holds server-controlled billing columns: subscriptionStatus,
subscriptionPausedAt/CanceledAt, stripeCustomerId, stripeSubscriptionId,
stripeConnectAccountId/OnboardingStatus/TosAcceptedAt, connectChargesEnabled,
connectPayoutsEnabled, platformFeePercent, seatCount, trialStartDate/EndDate/Converted,
onboardingCompleted.

**Rule:** the user-facing write path (POST/PATCH /api/business-settings, both ownerOnly)
must parse with `businessSettingsWriteSchema = insertBusinessSettingsSchema.omit({...all of those})`,
NOT the raw insert schema. Zod strips unknown keys, so only real columns are the risk.

**Why:** without the omit a free-tier owner could PATCH `{subscriptionStatus:'active', seatCount:100,
platformFeePercent:'0'}` and self-upgrade / cut platform fees without paying.

**How to apply:** those fields are ONLY written server-side via webhooks.ts, billingService.ts,
subscriptionService.ts, appleIapWebhook.ts and the dedicated onboarding-complete route (all call
storage.updateBusinessSettings directly), so omitting them from the HTTP schema breaks nothing.
If you add a new sensitive column to business_settings, add it to the omit list too.
