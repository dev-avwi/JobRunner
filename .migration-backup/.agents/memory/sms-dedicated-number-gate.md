---
name: SMS dedicated-number gate
description: Rules for surfacing the "business needs its own number" SMS block across server + clients
---

Business SMS never uses the shared platform number. When the business has no dedicated number, SMS routes return **402 `{ code: 'DEDICATED_NUMBER_REQUIRED' }`** and clients show a "get your business number" prompt (mobile helper in `smsGate.ts`, web helper in `dedicatedNumber.ts`) instead of a raw error toast.

**Why:** raw 402/500 toasts confused users; the prompt funnels them to the number-purchase screen.

**How to apply:**
- New SMS send paths must return the same 402 shape and use the shared client helpers — don't invent new toasts/alerts.
- **Ordering matters:** if a route both mutates state AND sends an SMS, check the dedicated number BEFORE any writes (pre-flight 402), or complete the write and surface the SMS failure as non-blocking `smsFailed`/`smsErrorCode` fields on a 200. Never persist a status change and then 402 — clients treat it as a failed action and retries duplicate state/events.
- Detection quirks: mobile `api.post` puts the error body on `response.data`; web `apiRequest` throws `Error("402: <json>")` so detection is substring-based.
