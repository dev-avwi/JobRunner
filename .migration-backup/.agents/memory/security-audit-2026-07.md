---
name: Security audit findings (2026-07)
description: What the full security sweep found, what was fixed, and what remains by design.
---

# Security audit — July 2026

## SQL injection
- Entire codebase uses Drizzle parameterized queries; `db.execute(sql\`...\`)` template usages are bound, safe.
- The ONE `sql.raw` string-interpolation spot (admin PATCH /api/admin/users/:userId) was replaced with `db.update(users).set(...).where(eq(...))`. It was not exploitable (tier allowlist + boolean coercion) but was fragile.
- Raw `pool.query(...)` calls in storage.ts are startup DDL (CREATE TABLE IF NOT EXISTS) with no user input — safe by design (we avoid drizzle-kit push).

## Scanners
- HoundDog: 9 "critical" all false positives — console.logs print booleans (`!!token`), and "password to Sentry" flags on AuthService call args (Sentry doesn't capture args; beforeSend scrubs).
- SAST scan: fails with infra CANCEL repeatedly (3x) — platform issue, don't loop retries.
- Dependency audit tool: `v.severity` is an OBJECT `{level, type, vector}` — filter on `v.severity.level`, not `v.severity`. Package name at `v.package.name`.

## Dependencies
- Patched (2026-07-12): axios 1.16.0, multer 2.2.0, ws 8.21.0, express-rate-limit 8.2.2, lodash 4.18.1 (4.18.0 is a deprecated bad release — never pin it), vite 5.4.21.
- Deliberately NOT bumped (major/risky): nodemailer 7→8/9 (email is business-critical), drizzle-orm 0.39→0.45 (DB layer). Remaining highs are transitive (undici, tar, node-forge, xmldom, etc.) — need upstream updates or npm overrides (package.json edit = ask user first).

**How to apply:** rerun `runDependencyAudit()` and group by `severity.level`; only chase direct deps with same-major fixes.

## Follow-up sweep (user's 5 questions, 2026-07-12)
- Client bundle exposes only VITE_SENTRY_DSN (public by design). `.env` gitignored + untracked; server keys all env-based.
- Google Maps Android key ships committed in mobile/app.json + google-services.json — normal for Maps SDK but MUST stay restricted (Android package + SHA-1) in Google Cloud Console; can't verify restriction from here.
- Rate limits: global generalApiLimiter 100/min/IP on all /api (skips health/metrics/assets) + dedicated limiters (login/register/verify/reset/payment/message/public portals) + per-user heavy-endpoint limiters (pdf/ai/vision/message).
- Dev workspace DB is Replit helium dev DB (demo data only) — staging never touches prod Neon; dev URL public-but-unguessable while workspace runs, canonical URL maps to mockup-sandbox port.
- Privacy/ToS pages (April 2026): APPs, NDB, overseas disclosure, Fair Work retention, AI + call-recording disclosure; ToS 29 sections incl. ACL. Substantive, not boilerplate.
