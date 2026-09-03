# Input Validation & Injection Audit — Summary

**Date:** 2026-09-02  
**Scope:** All API entry points in `artifacts/api-server/src/`

---

## 1. Route Input Audit

### What was checked
All POST / PUT / PATCH routes in `legacyRoutes.ts` and the sub-route files under `routes/` were scanned for Zod validation before use of `req.body` fields.

### Gaps found and fixed

| Route | File | Gap | Fix applied |
|---|---|---|---|
| `PUT /api/sms/templates/:id` | legacyRoutes.ts ~37159 | No Zod validation — `name`, `category`, `body`, `isDefault` used directly from `req.body` | Added Zod schema with length limits (`name` ≤ 255, `body` ≤ 1600 chars — 10 SMS segments, `category` ≤ 100) |
| `POST /api/portal/job-requests` | legacyRoutes.ts ~1943 | Only a presence check on `title`; no type or length validation on any field | Added Zod schema: `title` ≤ 255, `description`/`clientNotes` ≤ 5000, `urgency` enum, UUIDs for IDs |
| `PATCH /api/portal/job-requests/:id` | legacyRoutes.ts ~2032 | No validation; all fields destructured directly from `req.body` | Added Zod partial schema matching the POST constraints |
| `POST /api/direct-messages/:recipientId` | legacyRoutes.ts ~36578 | No length limit on `content`; no type/format check on `attachmentUrl` | Added schema: `content` ≤ 5000 chars, `attachmentUrl` must be a valid `https://` URL ≤ 2048 chars, `attachmentType` enum |
| `POST /api/swms` | legacyRoutes.ts ~46707 | Only a presence check on `title`; no length limits on any text field; no URL validation for `attachmentUrl` | Added Zod schema: `title` ≤ 255, text fields ≤ 5000, `hazards` array ≤ 100 items, `attachmentUrl` HTTPS URL only, `status` enum |

### Confirmed safe (no changes needed)

- **`POST /api/sms/templates` (create):** Already uses `insertSmsTemplateSchema.parse(req.body)`.
- **All routes using shared schema imports** (e.g. `insertJobSchema`, `insertClientSchema`, `insertQuoteSchema`, etc.): These go through Drizzle-generated Zod schemas before reaching storage — confirmed throughout the file.
- **Sub-routes** (`routes/expenses.ts`, `routes/jobs.ts`, `routes/equipment.ts`, `routes/inventory.ts`, etc.): All confirmed to use schema validation before DB writes.

---

## 2. URL / Redirect Validation

### What was checked
All `fetch()` calls, OAuth redirect URLs, and any route that stores or forwards a URL.

### Findings
- **No user-supplied URLs are used directly in `fetch()` calls.** All outbound fetch targets are either hardcoded constants (e.g. Stripe, Vapi, SendGrid base URLs), signed object-storage URLs constructed server-side, or URLs read from the server's own DB records (not echoed from `req.body`).
- **OAuth redirect URIs** (Google, Xero auth flows) are constructed server-side from `process.env.APP_DOMAIN` or `REPLIT_DOMAINS` — not from request parameters.
- **Twilio webhook URL** is configured programmatically from `APP_DOMAIN` env var, not from user input.
- **`attachmentUrl` fields** in DM and SWMS routes previously accepted arbitrary strings. **Fixed:** both routes now require a valid `https://` URL, blocking `javascript:`, `data:`, and `http://` URIs.

---

## 3. Rich-Text / HTML Sanitisation

### What was checked
All fields that accept free-text content (notes, descriptions, messages, template bodies).

### Findings
- **No HTML sanitisation is applied before DB storage.** The codebase consistently treats these as plain-text fields — there is no rich-text/WYSIWYG editor on the server path.
- **Frontend rendering** (React): these fields are rendered via React's `{expression}` interpolation, which escapes HTML by default. No `dangerouslySetInnerHTML` usages involving user-submitted text were found in the web client.
- **SMS / push notifications** that include user text (e.g. job title, client name): sent as plain text through Twilio/Firebase — no HTML rendering.
- **PDF generation** uses Puppeteer/Chromium. Template variables are populated server-side via parameterised string substitution — user text is not injected as raw HTML into template structures.
- **Verdict:** The attack surface for stored XSS is low given React's default escaping, but length limits applied in this task reduce the blast radius of oversized payloads reaching the renderer.

---

## 4. Webhook Input Handling

### Stripe webhook (`POST /api/stripe/webhook/:uuid`)
- Raw body required by Stripe SDK; signature verified via `stripe.webhooks.constructEvent()` before any field access.
- UUID path param is validated against the server-issued `webhookUuid` — unknown UUIDs are rejected.
- **Status: secure.**

### Vapi webhook (`POST /api/vapi/webhook`)
- Signature verified via `verifyVapiWebhook()` using `timingSafeEqual` against `VAPI_WEBHOOK_SECRET`.
- Fails closed if `VAPI_WEBHOOK_SECRET` or `VAPI_PRIVATE_KEY` are not configured.
- Parsed event data is routed through a typed `switch` in `processWebhookEvent()` — caller-supplied fields (name, phone, address) are stored as plain text in leads; never executed or evaluated.
- Deduplication via SHA-256 of raw body prevents replay attacks.
- **Status: secure.**

### Twilio SMS inbound (`POST /api/sms/webhook/incoming`)
- Signature verified via `validateTwilioWebhook` middleware, which calls Twilio's `validateRequest()` helper with HMAC-SHA1.
- Fails closed in production when `TWILIO_AUTH_TOKEN` is absent.
- SMS `Body` is passed as a plain string to `handleIncomingSms()` — it is stored and displayed, never executed.
- Media URLs (`MediaUrl0`...) from Twilio are Twilio-hosted S3 URLs — not caller-controlled; limited to 10 entries.
- **Status: secure.**

### Twilio SMS status callback (`POST /api/sms/webhook/status`)
- Same `validateTwilioWebhook` middleware as inbound.
- Only `MessageSid` and `MessageStatus` are acted on — both validated via DB lookup before any state change.
- **Status: secure.**

### SendGrid event webhook (`POST /api/webhooks/sendgrid`)
- Signature verified via `verifySendGridWebhook()` before payload parse.
- **Status: secure.**

### SendGrid inbound parse (`POST /api/webhooks/sendgrid/inbound`)
- Basic Auth verified before multer body parsing (unauthenticated callers never trigger memory allocation).
- Fails closed in production when `SENDGRID_INBOUND_BASIC_AUTH` is absent.
- **Status: secure.**

### Xero webhook (`POST /api/webhooks/xero`)
- HMAC signature verified before response or payload processing.
- **Status: secure.**

### QuickBooks webhook (`POST /api/webhooks/quickbooks`)
- HMAC signature verified before response or payload processing.
- **Status: secure.**

### Apple IAP notifications (`POST /api/iap/apple-notifications`)
- JWS signature verified against Apple's certificate chain before any field access.
- **Status: secure.**

---

## 5. SQL / Shell Injection

### SQL
- All database queries use Drizzle ORM's parameterised query builders (`eq()`, `and()`, `inArray()`, etc.).
- No raw string interpolation into SQL was found. `db.execute(sql\`...\`)` calls use Drizzle's tagged template literal which parameterises values.
- **Status: secure.**

### Shell commands
- Three `spawn()` sites found: `ffmpeg` (fixed args + signed storage URL), `process.execPath` (smoke script, no user input), and a spreadsheet isolation worker (fixed path).
- No `exec()` or `execFile()` with user-controlled arguments found.
- **Status: secure.**

---

## Fixes Applied

All code changes were made in `artifacts/api-server/src/legacyRoutes.ts`:
1. `PUT /api/sms/templates/:id` — added inline Zod validation schema
2. `POST /api/portal/job-requests` — replaced manual presence check with full Zod schema
3. `PATCH /api/portal/job-requests/:id` — added Zod validation
4. `POST /api/direct-messages/:recipientId` — added Zod validation with HTTPS URL enforcement on `attachmentUrl`
5. `POST /api/swms` — added Zod validation with HTTPS URL enforcement on `attachmentUrl`
