---
name: Autopilot / automations engine is real (not a stub)
description: Where automation triggers actually execute, and that custom automations run too
---

The Autopilot feature (mobile `mobile/app/more/autopilot.tsx`) is backed by a real,
working engine — do not assume it's a stub.

- **Event-driven triggers** fire inline from business logic: `processStatusChangeAutomation`
  (job status in `server/routes/jobs.ts`; quote accept/decline in `server/routes.ts`) and
  `processPaymentReceivedAutomation` (Stripe webhook in `server/webhookHandlers.ts`; manual
  record in `server/emailRoutes.ts`).
- **Time-based triggers** (`no_response`, `time_delay`) run from a background poller in
  `server/reminderScheduler.ts` every ~30 min (`processTimeBasedAutomations()`).
- Action execution: `executeAutomationActions` in `server/automationService.ts` runs the
  stored `actions` array — supports send_email, send_sms, create_job, create_invoice,
  notification, update_status. **Custom user-built automations execute the same way as
  templates** (templates are just blueprints copied into the user's `automations` row).
- 11 system templates defined in `server/automationTemplates.ts`.
- Custom-automation create/edit is gated by `requirePaidTier()`.

**Why:** spent a session re-confirming this is functional; the 4-step custom builder UI
looks elaborate but it's genuinely wired through to real sends/DB writes.
