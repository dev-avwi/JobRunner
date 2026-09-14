# JobRunner Competitive Audit
**Date:** September 2026  
**Compared against:** Jobber, ServiceM8 (primary), Tradify, ServiceTitan (reference)

---

## 1. Executive Summary

JobRunner is genuinely competitive — and in several areas ahead — of Jobber and ServiceM8 for **project-based trade contractors** (builders, plumbers, electricians doing multi-phase jobs). The gap is in **solo / service-call workflows**, **client-facing self-service**, and **marketing automation** where Jobber is stronger. ServiceM8 leads on **asset management** and **AI-assisted quoting**. Neither competitor has JobRunner's depth in **phase project management**, **progress claims**, **SWMS compliance**, or **subcontractor management**.

**Bottom line:** Stop trying to be everything. Own the project-contractor niche, fix the client portal, add asset tracking, and build AI quoting. That combination is not available anywhere else.

---

## 2. JobRunner Feature Ratings

| Area | Rating | Notes |
|---|---|---|
| **Job management** | A | Service calls + project phases, both well handled |
| **Phase/task workflow** | A | Best in class — no competitor has this depth |
| **Quoting** | B+ | Good, but no AI assist or online self-quoting |
| **Invoicing** | A- | Solid; Xero sync works; progress claims unique |
| **Progress claims & variations** | A | Unique differentiator — competitors don't have this |
| **Time tracking** | B+ | Timer + manual; phase-linked. Missing: payroll export |
| **Scheduling / dispatch** | B | Calendar + team view; missing route optimization |
| **Client CRM** | B | Client records work; missing property-level history & full timeline |
| **Client portal** | C+ | Invoice/quote view only; clients can't book or message |
| **Payments** | B+ | Stripe Terminal + Apple IAP; good. Missing: PayTo (AU) |
| **SWMS / compliance** | A | Best in class; competitors have basic checklists only |
| **Subcontractor management** | A- | Invite codes, role gating, separate portal — strong |
| **Materials & POs** | B+ | Good; missing: supplier pricebook / catalogue |
| **Photos & docs** | B | Works; missing: annotation tools beyond basic, video trimming |
| **Communication (SMS/chat)** | B | Twilio SMS + in-app chat; missing: client-initiated threads |
| **Notifications** | B+ | Push + SMS solid; missing: email campaigns |
| **Reporting & analytics** | C+ | Revenue chart; missing: team KPIs, job profitability reports |
| **Online booking** | D | Not available — significant gap vs both competitors |
| **Asset management** | D | Not available — ServiceM8 unique strength |
| **Route optimization** | D | Not available — Jobber unique strength |
| **AI features** | C | AI receptionist exists; no AI quoting / description writing |
| **Mobile app (iOS)** | B+ | Well-structured; some screens cluttered (being improved) |
| **Web app** | B | Functional; UI polish varies across sections |
| **Integrations** | B | Xero, Google Sheets, Stripe, Twilio; missing: MYOB, QuickBooks |
| **DLP / retention** | A | Unique — competitors don't have this |
| **Staff licences / compliance expiry** | B+ | Solid tracking; missing: reminder escalation |

---

## 3. Feature Gap Matrix

### Jobber has — we don't

| Feature | Jobber Detail | JobRunner Status | Priority |
|---|---|---|---|
| **Route optimization** | Plan daily/weekly routes, re-optimize on changes, GPS-tracked | Map pin only — no routing | High |
| **Client Hub (self-serve portal)** | Branded portal: view history, approve quotes, pay invoices, request new work, message the business | Invoice/quote view only | High |
| **Online self-booking** | Embeddable booking widget; control availability windows & buffer time | None | High |
| **Two-way client messaging in portal** | Client sends a message; team responds in Jobber; full thread | One-way (SMS out only) | Medium |
| **Automated review requests** | Post-job trigger sends Google/Facebook review request via email/SMS | None | Medium |
| **Win-back & follow-up campaigns** | Email sequences to dormant clients, quote follow-ups | One-off SMS automation only | Medium |
| **"Find a Time" scheduling** | Suggests optimal slot based on team calendar + location | No suggestion engine | Medium |
| **Vehicle management** | Track which vehicle each team member uses, associate to jobs | None | Low |
| **Franchise / multi-location** | Separate brand instances under one account | Not relevant for target market | Low |
| **QuickBooks integration** | Native sync (Jobber targets North America heavily) | Xero only | Medium (AU market = Xero/MYOB) |
| **MYOB integration** | Native sync | None | High (AU) |
| **Reporting dashboard** | Revenue by job type, team utilisation, conversion rate, avg job value | Revenue chart only | High |

### ServiceM8 has — we don't

| Feature | ServiceM8 Detail | JobRunner Status | Priority |
|---|---|---|---|
| **Asset management** | QR-code labels per asset; scan to view history; form inspections against asset; map location | None | High |
| **AI quoting** | Draft quote description + materials list from job notes in seconds | AI receptionist only | High |
| **AI invoice generation** | Auto-draft invoice description from job completion notes | None | High |
| **Intelligent online booking** | Questionnaire-driven pricing; client answers questions → auto-quote → book slot | None | High |
| **Staff leave management** | Mark staff unavailable (leave/holiday) in dispatch board | No formal leave system | Medium |
| **Smart scheduling suggestions** | AI suggests best available staff based on skills, proximity, calendar | None | Medium |
| **PayTo (Australia)** | Bank-to-bank instant payment (lower fees than card) | Stripe only | Medium |
| **Multi-trade franchise** | Multiple business units under one account | Single workspace | Low |
| **Configurable booking questionnaires** | Custom Q&A flows that set a price | None | High |

### Neither has — JobRunner does

| Feature | Our Advantage |
|---|---|
| **Phase-based project management** | Full phase lifecycle with team assignment, status, tasks, time tracking per phase |
| **Progress claims (variations)** | Approve, track, and claim variations mid-project against the original quote |
| **Retention & DLP tracking** | Contractual retention amounts, defects liability period tracking with release prompts |
| **SWMS digital safety documents** | Full SWMS creation, template library, worker signature collection on mobile |
| **Induction form gating** | Block time tracking / site access until safety induction is signed |
| **Subcontractor invite system** | Role-scoped invite codes, separate portal view, limited job visibility |
| **Cross-job phase blocking** | Prevent marking a phase complete until dependent cross-job work is done |
| **AI receptionist / voice** | VAPI-powered inbound call handling for missed calls |
| **Dedicated business number** | Twilio number routes calls through AI receptionist |
| **Apple IAP subscriptions** | Native App Store billing (competitors are web-only subscription) |

---

## 4. Where We Can Beat Both — Priority Opportunities

### 🔴 Critical gaps (fix these to compete properly)

**1. Client portal — upgrade to a proper self-serve hub**  
Both Jobber and ServiceM8 let clients log in and see their job history, approve quotes, and pay. Ours is invoice/quote view only. A proper portal where clients can: request new work, see active job progress with phase status, message the team, download SWMS/documents, and approve variations online would be a major retention driver.  
*Effort: Large. Value: Very high.*

**2. Online booking / instant quoting**  
ServiceM8's smart booking form is genuinely impressive — clients answer questions, get an instant price, pick a time, and book. Neither Jobber nor ServiceM8 have the phase-based project context we do, so we could build something smarter: "Book a service call" for simple jobs, "Start a project quote" for complex ones. Even a basic "request a callback" flow with business-hours awareness is a start.  
*Effort: Medium-Large. Value: High.*

**3. MYOB integration**  
Xero is strong in Australia but MYOB has a huge SMB base. Missing it costs us deals.  
*Effort: Medium. Value: High (AU market).*

**4. Revenue / profitability reporting**  
We have a revenue chart. Both competitors have detailed dashboards: avg job value, revenue by job type, team utilisation, conversion rate (quotes accepted vs sent), job profitability (revenue minus labour minus materials). This is what owners actually want to see.  
*Effort: Medium. Value: High.*

### 🟡 High-value additions (differentiation plays)

**5. Asset management with QR codes**  
This is ServiceM8's strongest unique feature and there's no reason we can't build it. A tradie who services AC units, fire suppression systems, or commercial kitchens needs to track each unit's service history. QR code stickers → scan → see full history + attach inspection form. This opens up the maintenance contractor segment completely.  
*Effort: Large. Value: Very high (new segment).*

**6. AI quoting / description writing**  
We have OpenAI already integrated. ServiceM8 uses AI to draft quote and invoice descriptions from job notes. We could do this better: "describe what was done on site" → AI drafts the invoice line items, materials, and description. Could also pre-populate quote sections from the job type and historical data.  
*Effort: Small-Medium. Value: High (easy win given we already have the API).*

**7. Route optimization**  
Jobber's route optimizer is a selling point for service-call businesses. For our market (project-based), it matters less — but for service call jobs it's still useful. Could start with a simple "sort by proximity" on the jobs list/map.  
*Effort: Medium. Value: Medium.*

**8. Automated post-job review requests**  
After marking a job complete + invoiced, trigger an SMS/email: "Hi [client], thanks for choosing [business]. We'd love your feedback — [Google review link]". Jobber has this; it's a small feature with outsized trust-building value for the tradie.  
*Effort: Small. Value: High (it runs itself).*

**9. Supplier pricebook / catalogue**  
Materials are currently added free-text. A pricebook lets the owner set up a catalogue of materials with standard cost/sell prices, which workers can search and add to a job. Both competitors have this to varying degrees.  
*Effort: Medium. Value: High.*

**10. Staff leave / unavailability**  
When scheduling phases and jobs, not knowing who's on leave causes double-booking. A simple "mark as unavailable" for a date range (leave, sick day, RDO) that blocks them from new assignments.  
*Effort: Small. Value: Medium.*

### 🟢 Polish / UX gaps (do better than competitors)

**11. Job profitability at-a-glance**  
Show a margin % on each job card for owners. Labour cost (hours × rate) + materials cost vs quoted amount. Jobber shows this in reports; we could show it inline on the job.

**12. Phase Gantt / timeline view**  
Neither Jobber nor ServiceM8 have a proper Gantt for multi-phase projects. A horizontal timeline of phases with scheduled dates would be genuinely unique for builders and project managers.

**13. Client-facing progress updates**  
Push a "your job is X% complete" SMS to clients when a phase is marked done. Proactive without requiring them to log in. Neither competitor does this automatically.

**14. Better photo organisation**  
Before/after grouping, photo annotation with markup (arrows, text), and automatic organisation by phase. Currently photos go into a flat list.

**15. Bulk invoice / payment export**  
Accountants want a CSV or PDF of all invoices for a date range. Currently everything routes through Xero but not all customers have Xero.

---

## 5. Competitive Positioning Summary

| Contractor type | Best fit today | What to fix |
|---|---|---|
| **Project builder / renovator** | JobRunner wins clearly | Client portal, reporting |
| **Plumber / electrician (service calls)** | Jobber or SM8 edge on UX simplicity | Online booking, route opt |
| **HVAC / maintenance** | ServiceM8 wins (asset tracking) | Asset management is the gap |
| **Subcontractor-heavy site** | JobRunner wins (subcontractor portal) | Keep improving |
| **Solo tradie** | Tradify / SM8 (simpler) | Simplified solo mode? |

---

## 6. Recommended Build Priority Order

1. **AI quoting / description assist** — small effort, immediate value, uses existing OpenAI
2. **Post-job review request automation** — tiny effort, big trust ROI
3. **Reporting dashboard** — owners ask for this constantly
4. **MYOB integration** — unlocks a large AU customer segment
5. **Client portal v2** — quote approval, job progress, messaging, document download
6. **Supplier pricebook** — reduces friction on material entry
7. **Staff leave / unavailability** — scheduling integrity
8. **Asset management + QR codes** — opens maintenance segment
9. **Online booking / instant quoting** — biggest new revenue channel
10. **Route optimization** — nice-to-have for service-call workflows
