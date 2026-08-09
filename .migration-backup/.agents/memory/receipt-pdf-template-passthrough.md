---
name: Receipt PDF template passthrough
description: Why receipts render with the wrong (default) template unless the business blob carries documentTemplate fields
---

Receipts have NO per-document template column (unlike invoices/quotes, which copy
`documentTemplate` + `documentTemplateSettings` at creation). `generatePaymentReceiptPDF`
picks the style purely from the `business` object passed in, via
`getTemplateFromBusinessSettings(business)`.

**The trap:** `PaymentReceiptData.business` is a hand-written structural subset. If a
receipt render call site builds a narrowed business literal (businessName/abn/logo/
brandColor only) it silently drops `documentTemplate`/`documentTemplateSettings`, so the
receipt falls back to the DEFAULT template and looks nothing like the owner's invoices.

**Rule:** any call site that builds the `business` blob for `generatePaymentReceiptPDF`
must include `documentTemplate` and `documentTemplateSettings` (both live on
BusinessSettings; `resolveBusinessLogoForPdf<T>` preserves them). Passing the full
resolved settings object works automatically; a narrowed literal does not.

**How to apply:** receipt render endpoints in server/routes.ts are `/api/receipts/:id/pdf`,
`/api/receipts/:id/image`, `/api/receipts/:id/send-email`, and public
`/api/public/receipt/:token/pdf`. The three authed ones narrowed the blob and needed the
two fields added; the public one already passed full settings.
