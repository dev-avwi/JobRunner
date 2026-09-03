# Sensitive Data & PII Audit — September 2026

Scope: Australian Privacy Act obligations and general best practice for the
JobRunner platform (API server, web frontend, mobile app).

---

## 1. API Response Audit

**Checked:** All `/api` routes that return user/worker/client objects were
reviewed for unnecessary exposure of passwords, tokens, raw bank details, and
TFN-equivalent identifiers.

**Finding — `sanitizeUserResponse` strips auth tokens correctly.**
`artifacts/api-server/src/auth.ts` strips `password`, `emailVerificationToken`,
`emailVerificationExpiresAt`, `passwordResetToken`, `passwordResetExpiresAt`,
and `appleReceiptData` before returning a user object. No passwords or raw auth
tokens reach the client.

**Finding — Manager payment-details endpoint returned full financial identifiers.**
`GET /api/business/subcontractor-invoices/:id/payment-details` previously
spread the complete `workerPaymentDetails` row to authenticated managers,
including full BSB, account number, account name, and payId. Since payId can
itself be an email address, phone number, or ABN, the raw spread exposed PII
through this field as well.

**Fix applied:** The endpoint now returns an explicit allow-list of fields only:
- `bankBsb` → last 4 digits (`****7890`)
- `bankAccountNumber` → last 4 digits
- `bankAccountName` → first 2 chars + `***` (e.g. `Jo***`)
- `payId` → last 4 chars (masks email/phone/numeric formats uniformly)
- `abn` → unmasked (semi-public business identifier needed for remittance)
- `hasBankTransfer` / `hasPayId` → boolean presence flags only

**Finding — Owner payment-settings exposes own bank details.**
`GET /api/payment-settings` (owner-only) returns the business's own BSB and
account number. Intentional — the owner configures their own bank details —
and adequately protected by `requireAuth + ownerOnly()`. No change applied.

**Finding — Public token-based document routes bypass session auth.**
Routes at `/api/public/document/:type/:token`, `/api/public/project-documents`,
and `/api/public/proof-pack` use a signed URL token instead of a session
cookie. Token entropy and expiry tracked as task #1145.

---

## 2. Server Log Audit

Two separate logging layers exist in this codebase; both required changes.

### 2a. Pino structured logger (`artifacts/api-server/src/lib/logger.ts`)

**Finding — Pino wildcard redact paths are shallow.**
`pino`/`fast-redact` `*.field` wildcards match exactly **one level deep**.
Root-level fields (`{ email }`) and two-level fields (`{ data: { user: { email } } }`)
both leaked with the previous config.

**Fix applied:**
- `buildRedactPaths()` now emits each PII field at three explicit depths:
  root (`email`), one level (`*.email`), two levels (`*.*.email`).
- Fields covered: `password`, `passwordHash`, `emailVerificationToken`,
  `passwordResetToken`, `email`, `phone`, `phoneNormalized`, `bankBsb`,
  `bankAccountNumber`, `bankAccountName`, `abn`, `tfn`, `payId`,
  `appleReceiptData`, `stripeCustomerId`, `stripePaymentIntentId`.
- `buildRedactPaths` is exported so tests verify the paths directly.

**Finding — Request logger middleware logged response bodies.**
`artifacts/api-server/src/index.ts` captured every JSON response and appended
it (truncated at 80 chars) to the info log line, potentially writing partial
names, email addresses, or financial amounts to logs.

**Fix applied:** Response body capture removed. Middleware now logs only
`METHOD /path STATUS in Xms`.

### 2b. Custom persistence logger (`artifacts/api-server/src/logger.ts`)

**Finding — All sinks (DB, stdout, alert email) received raw error objects.**
`persist()` stored `Error.message` and `Error.stack` unmodified in the
`errorLogs` table. `warn`/`error`/`fatal` called `console.warn/error(entry.error)`
directly. `sendAlertEmail` interpolated raw `error.message` and `error.stack`
into HTML. Provider errors from Stripe, Twilio, SendGrid, etc. embed recipient
addresses and request payloads in their message strings, so all three sinks
were leaking PII.

**Finding — `lifecycleEmailService.ts` interpolated `user.email` in messages.**
Lines 333 and 336 passed the full email address into the custom logger's
`message` string, persisting it to the DB and emitting it to stdout.

**Fixes applied:**

1. **`sanitizeError(error)`** — new exported helper. Runs `sanitizeMessage` on
   `Error.message` and each stack frame (truncated to 8 lines), producing a
   safe `{ name, message, stack }` object. Non-Error values become
   `{ raw: sanitizeMessage(String(error)) }`. Returns `undefined` for null.
   Applied in `persist()`, `sendAlertEmail()`, and the new `consoleError()`
   method that replaces direct `console.warn/error(entry.error)` calls.

2. **`sanitizeMessage(msg)`** — also applied to the alert email's `safeMessage`
   field so the subject line cannot leak PII even when callers interpolate it.

3. **`sanitizeMetadata(value)`** — recursive helper (up to 5 levels) strips
   PII field names from metadata objects before DB insert. Applied in `persist()`.

4. **`lifecycleEmailService.ts`** — replaced `user.email` with `user.id` in
   both log calls. `sanitizeMessage` provides defense-in-depth if other callers
   make the same mistake.

---

## 3. Object Storage Access Audit

**Finding — Private bucket used correctly.**
`ObjectStorageService` writes to `PRIVATE_OBJECT_DIR` for compliance documents
and job photos. Public paths cover only business logos and public assets.

**Finding — Authenticated download enforced.**
The `/objects/*` route applies `*.private/*` default-deny, business-ownership
checks, and short-lived signed URL minting for compliance files. The mobile
signing endpoint applies `requireAuth + canAccessComplianceFile`. No
unauthenticated access to private compliance documents was found.

---

## 4. Client-Side Storage Audit

### Web (localStorage)

| Key | Contents | Risk |
|-----|----------|------|
| `jobrunner_session_token` | Opaque bearer token | Medium — XSS theft grants session access. Primary auth is `httpOnly` cookie; this is iOS/Safari fallback only. |
| `jobrunner_offline_queue` | Queued API request bodies | Low-medium — job/invoice data queued offline; replayed on reconnect. No PII field values observed in queue format. |
| `jobrunner_active_timer` | Timer start time and job ID | Low — timestamps and opaque IDs only. |
| Portal/subcontractor tokens | Short-lived access tokens | Medium — same XSS risk; short-lived by design. |
| UI preferences | Theme, trade type, dismissed banners | Low — no PII. |

No passwords, financial amounts, or health/compliance document content found.

### Mobile (AsyncStorage)

| Key | Contents | Risk |
|-----|----------|------|
| `onboarding:owner-draft:v1` | `businessName`, `abn`, `phone`, `ownerName` | Low-medium — business PII on user's own device. Cleared by `clearOnboardingDraft()` on completion. |
| `notification_preferences` | Toggle settings | Low — no PII. |
| `@jobrunner/global_geofence_settings` | Radius / enabled flags | Low — no PII. |
| `jobrunner_dismissed_notifications` | Dismissed notification IDs | Low — opaque IDs. |
| Weather/UI dismissal flags | Boolean preferences | Low — no PII. |

No bank details, health records, or compliance document content found.

**Recommendation:** Confirm `clearOnboardingDraft()` fires on logout and account
deletion — tracked as task #1146.

---

## 5. Test Coverage

`artifacts/api-server/src/__tests__/piiRedaction.test.ts` — **35 tests, all passing.**

| Suite | What is tested |
|-------|----------------|
| `sanitizeMetadata` | All 16 PII fields at root / 1 level / 2 levels deep; non-PII scalars preserved; null/undefined safe |
| `sanitizeMessage` | Email (basic, +tag, subdomain), AU phone (04xx, +61), no-PII passthrough, multiple items |
| `sanitizeError` | Email/phone in `Error.message`; PII in stack frames; stack truncation to ≤8 lines; non-Error values; null/undefined; preserves `error.name` |
| pino structural | Root, 1-level, 2-level PII fields not present in captured log output |

---

## Summary of Changes

| File | Change |
|------|--------|
| `artifacts/api-server/src/lib/logger.ts` | `buildRedactPaths()` covers root + 1 + 2 levels for 16 PII fields; exported for testing |
| `artifacts/api-server/src/index.ts` | Removed response body capture from request logger middleware |
| `artifacts/api-server/src/logger.ts` | Added `sanitizeError` (error message/stack scrubber), `sanitizeMessage` (regex redactor), `sanitizeMetadata` (recursive field scrubber); applied to all sinks: `persist()`, `sendAlertEmail()`, `consoleError()`; all three helpers exported for testing |
| `artifacts/api-server/src/lifecycleEmailService.ts` | Replaced `user.email` in log messages with `user.id` |
| `artifacts/api-server/src/legacyRoutes.ts` | Manager payment-details endpoint returns explicit allow-list with masked BSB, account number, account name, payId; no raw financial data |
| `artifacts/api-server/src/__tests__/piiRedaction.test.ts` | New: 35 unit tests covering both logging layers and pino structural redaction |

---

## Out of Scope (per task brief)

- Full GDPR implementation (not required for AU market pre-launch)
- Encryption-at-rest of the Neon database
- Legal privacy policy wording
