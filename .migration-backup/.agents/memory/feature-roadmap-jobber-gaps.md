---
name: Feature roadmap — Jobber gap analysis
description: Candidate features to build (from a Jobber vs JobRunner comparison), with feasibility on the current stack. Captured at user request; wishlist, not committed work.
---

User (Ayden) asked to remember these as buildable candidates (2026-06-07), sourced from a Jobber feature comparison. Not yet scheduled — confirm scope before building any.

## Gaps to potentially build (Jobber has, JobRunner doesn't yet)
1. **Website builder** — auto-generated multi-page business site: SEO, custom domain, Google reviews pulled in, request/booking forms, AI chat embed. Maps to the existing "Custom Website" addon (nav id `custom-website`). Highest-priority gap per the analysis.
2. **Marketing suite** — competitor review analysis (compare rating/review volume vs up to ~10 local competitors), email campaigns, referral program, insights dashboard. Competitor data can use the existing `GOOGLE_MAPS_API_KEY` (Places); email builds on SendGrid.
3. **AI business advisor (Copilot-style)** — embedded AI that recommends automations, drafts quotes, flags high-value jobs, handles routine tasks. Extends the existing Role-Aware AI Assistant + AI suggestions, distinct from the voice AI Receptionist.
4. **Job costing** — labour + materials + expenses vs revenue, per job and per crew, with margin view. Mostly aggregation on existing expenses/time-tracking/invoice data. Second-priority gap per the analysis.
5. **Geofenced auto time start/stop ("Location Timers")** — timer auto-starts on job arrival, stops on leave. Wire existing background GPS + geofence notifications to the timer.
6. **Embedded supplier catalogue** — search a supplier's product catalogue inside a quote (Jobber uses Home Depot). Not AU-relevant now; concept only.

## Already have (don't rebuild — JobRunner's edge over Jobber)
WHS/SWMS compliance (AU), subcontractor ecosystem, Stripe Tap to Pay, Vapi voice AI Receptionist, two-way Twilio SMS, live GPS dispatch board.

## Stated priority
Website builder + job costing first — biggest gaps paying tradies notice. Rest is catch-up, later.
