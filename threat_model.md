# Threat Model

## Project Overview

JobRunner is a public, multi-tenant job-management application for trades businesses. The production backend is a Node.js/TypeScript Express service using PostgreSQL/Drizzle and session cookies, with a React/Vite web client and a React Native mobile client. It integrates with payment, accounting, communications, calendar, AI, and object-storage providers. Production deployments are public autoscale sites at jobrunner.org, jobrunner.com.au, and TradieTrack.replit.app.

## Assets

- **Accounts and sessions** — passwords, session cookies, OAuth identities, password-reset and invitation tokens; compromise permits impersonation and access to a business workspace.
- **Business and customer data** — clients, jobs, quotes, invoices, expenses, messages, locations, documents, photos, forms, and financial reports; these contain PII and commercially sensitive records and must remain tenant-scoped.
- **Credentials and integration authority** — database/session secrets and provider access/refresh tokens, API keys, webhook secrets, and payment identifiers; exposure can authorize external actions or data access.
- **Billing and entitlements** — subscriptions, payments, credits, IAP receipts, plan and feature state; tampering can cause financial loss or privilege escalation.
- **Uploaded and generated content** — photos, attachments, PDFs, exports, and signed object URLs; unauthorized access or unsafe rendering can disclose data or enable code execution/XSS.

## Trust Boundaries

- **Public client to API** — browsers, mobile apps, public portal visitors, webhook providers, and OAuth redirects supply untrusted headers, cookies, tokens, bodies, URLs, and files. Server-side authentication and authorization are mandatory.
- **API to PostgreSQL** — handlers and storage code query shared multi-tenant tables. Every read and write must prove the caller's membership/ownership and scope object IDs to that business.
- **API to external providers** — Stripe/PayPal/Apple, Google, Xero/QuickBooks, Twilio/SendGrid, AI, email, geocoding, and object storage receive server credentials and return untrusted data. Webhooks require authentic signatures and replay protection; outbound URLs require safe destinations.
- **Authenticated roles and tenants** — workers, subcontractors, members, managers, owners, and platform administrators have different capabilities. UI checks do not enforce this boundary.
- **API/file storage to client rendering** — uploaded names, provider responses, templates, messages, and generated documents may reach HTML, URLs, downloads, or native views and must not become active content.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/legacyRoutes.ts`, `artifacts/api-server/src/routes/*.ts`, `artifacts/api-server/src/websocket.ts`; web client `artifacts/jobrunner/src`; mobile client `mobile/src`.
- **Highest-risk areas:** authorization helpers/storage queries, public job portal and share routes, upload/object-storage/PDF services, auth/OAuth/password reset/invites, payment/billing/IAP and accounting integrations, webhook handlers, WebSocket ticket/room authorization.
- **Surface classes:** public health/auth/OAuth/webhook/portal endpoints; authenticated business APIs; owner/manager/admin/platform-admin actions; provider callbacks and background schedulers.
- **Usually non-production:** `.migration-backup/**`, `artifacts/mockup-sandbox/**`, generated `dist/**`, tests, and development-only demo paths unless the server explicitly serves or imports them in production.

## Threat Categories

### Spoofing

The API must establish a trusted session or verified provider identity before returning private data or changing state. Password reset and invite tokens must be high-entropy, single-use, expiring, and bound to the intended account/context. OAuth callbacks must validate state, issuer, redirect, and identity claims. Webhooks must use provider signature verification and replay protection before side effects.

### Tampering

All object IDs, tenant/business scopes, roles, prices, plan state, payment amounts, and integration targets supplied by clients are untrusted. Each handler must enforce object-level and function-level authorization server-side and calculate financial/entitlement decisions from trusted server state. Provider callback data must be authenticated before persistence.

### Information Disclosure

Business and customer records, credentials, tokens, files, locations, financials, and generated documents must be scoped to the authenticated business and role. Public portal/share tokens must grant only the intended narrow resource and must not be reusable as broad API credentials. Responses and logs must exclude secrets, raw tokens, passwords, and unnecessary PII.

### Denial of Service

Public endpoints, webhooks, login/reset flows, file uploads, PDF/AI/geocoding work, and portal operations require bounded body/file sizes, concurrency, rate limits, and external request timeouts. Authentication failures and expensive operations must not permit unbounded resource consumption.

### Elevation of Privilege

Roles and permissions must be checked on the server at every sensitive read/write/export/invite/billing/admin action. Queries must scope raw IDs to the caller's business and membership. Uploads and generated content must not allow path traversal, arbitrary file reads, unsafe file execution, or stored XSS. WebSocket subscriptions and signed URLs must enforce the same tenant/object policy as HTTP.

### Repudiation

Sensitive account, role, billing, payment, integration, data-export, and deletion operations should record the authenticated actor, target scope, and outcome in server-controlled audit records. Webhook processing should retain authenticated event identifiers and reject duplicates without relying on client-supplied identity alone.
