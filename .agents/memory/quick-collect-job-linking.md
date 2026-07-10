---
name: Quick Collect job linking + paid detection
description: Linking a no-invoice Quick Collect payment to its job, and flagging already-paid jobs, in mobile collect-payment.tsx
---

# Quick Collect job linking (collect-payment.tsx)

A no-invoice job collected via Quick Collect has NO `selectedInvoice`, so the tap
handlers passed `jobId: undefined` → the payment (and its receipt) was unlinked and
the job could be silently re-charged.

Fix pattern: hold the chosen job in a `quickCollectJobId` state and thread it as
`jobId: selectedInvoice?.jobId || quickCollectJobId || undefined` into
`terminal.collectPayment(...)` (which forwards jobId to
`/api/stripe/create-terminal-payment-intent` → terminal payment row → direct receipt).

**Lifecycle rule:** `quickCollectJobId` must be SET when a job is picked and CLEARED
on EVERY other exit of the collect flow, or a later unrelated tap mis-links to the
stale job. Clear points: select-invoice handler, generic custom-amount handler, BOTH
modal close handlers (custom-amount + invoice-picker `onDismiss`), and both tap
handlers' `finally`.
**Why:** the flow fans out across several modals; a missed clear path is a data-integrity bug (payment attributed to the wrong job).

**AppBottomSheet gotcha:** `onDismiss` fires ONLY on user dismissal (backdrop tap /
Android back), NOT on programmatic `setVisible(false)`. So wiring a clear into the
picker's `onDismiss` is safe — it won't wipe the id right after a selection that
closed the sheet programmatically.

## Paid detection ("Paid" badge + confirm-before-recharge)
Scoped to the Collect Payment screen ONLY — do NOT mutate job workflow status
(user wants in-progress → paid → finished independent). `paidJobIds` = union of a
session set (added on tap success) + recent receipts carrying a `jobId`
(`/api/receipts?limit=50`; session set covers the just-paid case, receipts survive
reload). Tapping a paid job shows `useConfirmDialog` "Collect again?" instead of
charging immediately.

## Payment history readability
`GET /api/terminal/payments` enriches each row with `clientName` + `invoiceNumber`
(if invoiceId) or `jobTitle` (if jobId), fetched by unique id in bounded batches
(size 8) to avoid N+1. clientIds come from the owner-scoped invoice/job, so the
unscoped `getClientById` introduces no IDOR here.
