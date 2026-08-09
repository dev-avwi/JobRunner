---
name: SDS Manager integration approach
description: How to integrate JobRunner with SDS Manager (sdsmanager.com) for chemical/SDS management instead of rebuilding it.
---

# SDS Manager integration — integrate, don't rebuild

**Decision/direction (set 2026-06-01):** JobRunner will NOT rebuild an SDS/chemical
database. The trial customer (flooring on vessels) already pays for SDS Manager
because it has the Australian-standards SDS library. JobRunner should lean on that.

**Why:** SDS Manager maintains a millions-strong, AU-GHS-compliant SDS database
(`sdsmanager.com/au`) reviewed/updated on the legal 5-year cycle. Replicating that
is a never-ending content + compliance burden we can't win on.

**What SDS Manager exposes (verified via web research 2026-06-01):**
- **SDS Parser API** — POST an SDS PDF, get back JSON/XML of all 16 sections
  (hazards, PPE, etc.); can also search their DB. `sdsmanager.com/us/sds-parser-api/`
- **SDS Library Export API (JSON sync)** — sync a customer's own library from
  `inventory.sdsmanager.com`.
- **QR poster access** — admin creates a read-only "QR login user"; employees scan
  a printed poster / link to view the library. No per-user accounts needed.
- **Offline app** (iOS/Android) for on-site SDS access.
- Partner-integration precedent: their **SafetyCulture** integration is the model to
  copy — JobRunner plays the same "host app that surfaces SDS Manager data" role.

**Proposed layering (simplest first):**
1. Link layer (ship first): business connects their SDS Manager account; JobRunner
   shows their SDS library + QR link on each job/site. Workers/subbies tap through.
2. Smart layer (optional): on SDS PDF upload to a job, call the Parser API to
   auto-fill hazards + required PPE into the existing SWMS/PPE safety section.
3. Register layer (later): JSON-sync the library so the chemical register sits next
   to SWMS/JSA with per-site filtering.

**Leeway for businesses:** those on SDS Manager connect and it flows through; those
not on it can still upload SDS PDFs manually to a job (basic register), with SDS
Manager offered as the upgrade for the full AU database.

**Blocker before building:** needs a partner/API key from SDS Manager (a business
step, like their SafetyCulture deal) — not just code. Confirm partner API access &
terms before committing engineering.
