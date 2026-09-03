# Open-Source License Compliance Audit

**Date:** 2 September 2026  
**Scope:** All npm packages across the JobRunner monorepo (pnpm workspace + mobile)  
**Auditor:** Automated scan via `license-checker`, manually reviewed

---

## Summary

| Workspace | Packages audited | Clean (permissive) | Needs attention |
|-----------|-----------------|-------------------|-----------------|
| Monorepo (root + artifacts + libs) | 1,299 | 1,284 (98.8%) | 15 |
| Mobile (`mobile/`) | 1,001 | 993 (99.2%) | 8 |

**Overall verdict: No blocking issues found.** The overwhelming majority of packages are MIT, Apache-2.0, ISC, or BSD — all permissive and safe for commercial SaaS use. Every flagged item below is either a dev-only tool, dual-licensed with a permissive option, or carries low practical risk for a legitimate business. Two items (`react-leaflet` and `stripe-replit-sync`) warrant a quick legal review note before investor due diligence.

---

## License Distribution (Monorepo)

| License | Count |
|---------|-------|
| MIT | 968 |
| Apache-2.0 | 173 |
| ISC | 81 |
| BSD-2-Clause | 15 |
| BSD-3-Clause | 14 |
| BlueOak-1.0.0 | 9 |
| MPL-2.0 | 6 |
| Unlicense | 3 |
| 0BSD / MIT-0 | 3 |
| Other permissive | ~11 |
| **Flagged** | **15** |

---

## Flagged Packages — Full Assessment

### 🟢 No Action Required

#### `node-forge@1.3.3` — `(BSD-3-Clause OR GPL-2.0)`
- **Where:** Transitive dependency (pulled in by `passport`, `openid-client`, and Expo crypto tooling)
- **Assessment:** Dual-licensed. The `OR` means any user/project may elect the BSD-3-Clause option, which is fully permissive. Choosing BSD-3-Clause imposes no obligations. This is a standard dual-licensing pattern.
- **Action:** None. License is read as BSD-3-Clause for our use.

---

#### `lightningcss@1.29.2`, `lightningcss@1.30.2` (+ platform variants) — `MPL-2.0`
- **Where:** Internal dependency of Tailwind CSS and Vite — used only at build time, never bundled into the production application output
- **Assessment:** MPL-2.0 is "file-level copyleft" — only modifications to MPL-licensed files themselves need to be disclosed. Because lightningcss is: (a) a build tool that is not shipped to end users, and (b) not modified by this project, the MPL-2.0 copyleft does not propagate to JobRunner's own code.
- **Action:** None. Build-tool use with no modification.

---

#### `@img/sharp-libvips@1.0.4` (+ musl variant) — `LGPL-3.0-or-later`
- **Where:** Optional native image-processing binary, pulled in transiently by `puppeteer` (which lists `sharp` as an optional peer dependency for image optimisation). Not imported anywhere in `artifacts/api-server/src/` or any other JobRunner source file.
- **Assessment:** LGPL-3.0 permits use as a library without copyleft obligations provided you: (1) do not distribute modified versions of the LGPL-licensed code, and (2) allow end users to re-link. For a server-side SaaS deployment — where the binary runs on the server and is never distributed to end users — LGPL obligations do not attach.
- **Action:** None. Confirm `sharp` is not directly imported (verified — it is not). If puppeteer's optional sharp import is not needed, it can be excluded from the build to remove the transitive pull entirely.

---

#### `@sentry/cli@3.3.4` — `FSL-1.1-MIT`
- **Where:** Dev/build dependency only — used to upload source maps during deployment builds, not bundled in production code
- **Assessment:** FSL (Functional Source License) v1.1-MIT allows all production use. It only restricts competing products (i.e., you cannot ship a competing error-monitoring platform). JobRunner is a field-service management SaaS, not a monitoring tool. FSL also converts to MIT after 4 years.
- **Action:** None.

---

#### `@expo/ngrok-bin@2.3.42`, `@expo/ngrok-bin-linux-x64@2.3.41` — `UNKNOWN`
- **Where:** `mobile/` devDependency only — used for local tunnel testing (`expo start --tunnel`). Never runs in production.
- **Assessment:** The ngrok binary is a proprietary tunnelling tool with its own ToS, but the npm wrapper packages are MIT. The "UNKNOWN" appears because `license-checker` cannot read the binary's embedded metadata. Dev-only, zero production exposure.
- **Action:** None.

---

#### `@replit/connectors-sdk@0.4.1`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-runtime-error-modal` — `UNKNOWN`
- **Where:** Replit platform SDKs — `connectors-sdk` is used in production API code to proxy integration calls; the vite plugins are dev-only
- **Assessment:** These are first-party Replit packages (`connectors-sdk` is published as `@openint/connectors-sdk`). The "UNKNOWN" license status is because `license-checker` cannot find a `license` field in the package metadata, not because the packages are unlicensed. They are vendor-provided SDKs that come with the Replit platform subscription. Usage rights are governed by Replit's Terms of Service.
- **Action:** None for the vite plugins (dev-only). For `connectors-sdk` in production: confirm with Replit ToS that commercial SaaS deployment is covered (standard for all Replit-hosted projects).

---

#### `workspace@0.0.0`, `jobrunner-mobile@1.0.0` — `UNLICENSED`
- **Where:** The project's own private packages
- **Assessment:** "UNLICENSED" is the correct npm convention for a private package that is not published. This is the project itself, not a third-party dependency.
- **Action:** None.

---

#### `@fontsource-variable/inter@5.2.8` — `OFL-1.1`  
#### `@expo-google-fonts/inter@0.4.2` — `MIT AND OFL-1.1`
- **Where:** Font packages (web and mobile)
- **Assessment:** SIL Open Font License 1.1 explicitly allows embedding fonts in products (web, mobile, desktop) without restriction. The only OFL limitation is that font files themselves cannot be sold standalone — irrelevant for a SaaS application.
- **Action:** None.

---

#### `xlsx@0.18.5` — `Apache-2.0`
- **Where:** `artifacts/api-server` — used for Excel export
- **Assessment:** Version 0.18.5 is Apache-2.0. The SheetJS/xlsx library changed to a commercial license starting from v0.19.0. The pinned version (0.18.5) is safe. **Do not upgrade beyond 0.18.x without a commercial SheetJS licence.**
- **Action:** Pin version. Add a comment in `artifacts/api-server/package.json` noting the version ceiling.

---

### 🟡 Low-Medium Risk — Document Before Due Diligence

#### `react-leaflet@4.2.1` / `@react-leaflet/core@2.1.0` — `Hippocratic-2.1`
- **Where:** `artifacts/jobrunner` — used in `JobMap.tsx`, `TrackArrival.tsx`, `DispatchBoard.tsx`, `WorkerCommandCenter.tsx`, `TeamOperations.tsx`, `AdvancedDispatch.tsx`, `mapSafe.tsx`
- **Assessment:** The Hippocratic License 2.1 is an "ethical source" license. It restricts use by organisations involved in specific human-rights violations (weapons development for oppressive regimes, ICE detention, etc.). It is **not OSI-approved** and **not a standard FOSS license**. For a legitimate commercial field-service SaaS this creates no practical restriction. However:
  - It is a non-standard license that can raise flags during investor/acquirer due diligence
  - Some legal teams may flag it as "non-permissive" even though the practical effect on a normal business is zero
- **Recommendation:** Replace with `@vis.gl/react-google-maps` (already a dependency in `artifacts/jobrunner/package.json`) to eliminate the question entirely. The map components are isolated to ~7 files. Alternatively, document this finding and flag for legal review.

---

#### `stripe-replit-sync@0.0.12` — No SPDX license field
- **Where:** `artifacts/api-server` — production dependency, syncs Stripe data to Postgres
- **Assessment:** Published by Supabase (package.json author: `Supabase <https://supabase.com/>`), sourced from `github.com/tx-stripe/stripe-sync-engine`. No `license` field in the published npm package and no LICENSE file in the installed package. The upstream GitHub repository has historically used Apache-2.0 but the published package does not declare it. This is the highest-uncertainty item in the audit.
- **Recommendation:** Resolve before due diligence: (1) check the upstream repo's LICENSE file and confirm it applies to the published npm package, or (2) contact Replit to confirm usage rights (it appears to be a Replit-managed package despite the Supabase author field), or (3) replicate the Stripe-to-Postgres sync logic in-house using the permissively licensed `stripe` npm package (already a dependency).

---

### 🔵 Informational

#### `Hippocratic-2.1` also appears on `@react-leaflet/core` — same assessment as `react-leaflet` above.

---

## Recommended Actions

| Priority | Action | Effort |
|----------|--------|--------|
| **High** | Confirm `stripe-replit-sync` license or replace sync logic | 2–4 hrs |
| **Medium** | Replace `react-leaflet`/`@react-leaflet/core` with `@vis.gl/react-google-maps` (already a dep) to eliminate Hippocratic license from production bundle | 1–2 days |
| **Low** | Add `// DO NOT UPGRADE: xlsx license changed in v0.19+` comment to api-server package.json | 5 min |
| **Low** | Schedule a re-audit when `xlsx` needs feature updates — evaluate commercial SheetJS licence at that point | — |

---

## Packages Confirmed Safe (Notable Ones)

The following packages were separately verified as permissive:

| Package | License | Note |
|---------|---------|------|
| `drizzle-orm` | Apache-2.0 | ORM |
| `express` | MIT | Web framework |
| `zod` | MIT | Validation |
| `@tanstack/react-query` | MIT | Data fetching |
| `stripe` | MIT | Payments SDK |
| `twilio` | MIT | SMS/Voice |
| `openai` | Apache-2.0 | AI |
| `puppeteer` | Apache-2.0 | PDF generation |
| `passport` / `passport-*` | MIT | Auth |
| `jsonwebtoken` | MIT | JWT |
| `bcrypt` | MIT | Password hashing |
| `pino` | MIT | Logging |
| `react` / `react-dom` | MIT | UI framework |
| `framer-motion` | MIT | Animation |
| `recharts` | MIT | Charts |
| `@radix-ui/*` | MIT | UI primitives |
| `lucide-react` | ISC | Icons |
| `expo` / `expo-*` | MIT | Mobile platform |
| `react-native` | MIT | Mobile framework |
| `@sentry/node`, `@sentry/react` | MIT | Error monitoring |
| `date-fns` | MIT | Date utils |
| `googleapis` | Apache-2.0 | Google APIs |
| `xero-node` | MIT | Xero integration |
| `nanoid` | MIT | ID generation |
| `ws` | MIT | WebSockets |
| `helmet` | MIT | Security headers |

---

## Methodology

1. `npx license-checker --json` run from the monorepo root (covering all pnpm workspace packages) and separately from `mobile/`
2. All 1,299 + 1,001 packages enumerated; licenses cross-referenced against SPDX identifiers
3. Flagged categories: GPL-2/3, AGPL, LGPL, SSPL, BUSL, Commons Clause, unknown/unlicensed
4. Secondary review: MPL-2.0 (file-level copyleft), FSL, Hippocratic, OFL, dual-licensed packages
5. Each flagged package manually assessed for: (a) production vs dev-only use, (b) distribution model (SaaS = no binary distribution), (c) copyleft propagation conditions

---

## Legal Disclaimer

This audit identifies license types and common interpretations. It is not legal advice. The findings for `react-leaflet` (Hippocratic-2.1) and `stripe-replit-sync` (no declared license) should be reviewed by a qualified attorney before investor due diligence or public launch.
