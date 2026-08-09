# JobRunner — Full System Brief & Design Plan
### Prepared for: Ayden / AV Web Innovation
### Date: March 2026

---

## 1. PRODUCT OVERVIEW

**JobRunner** is an all-in-one business operating system for Australian tradies, combining:

- Job management web + mobile app (BUILT)
- AI Receptionist that answers calls and creates jobs automatically (TO BUILD)
- Custom website builder connected to the entire system (TO BUILD)
- Tiered subscription billing with team seat management (TO BUILD)

**Target Market:** Australian tradies and small service businesses — plumbers, electricians, builders, HVAC, landscapers, pest control, pool maintenance, cleaners, and similar.

**Core Value Proposition:** One system that handles everything — website, phone calls, job management, invoicing, team management — so tradies never miss a job and never waste time on admin.

---

## 2. WHAT ALREADY EXISTS (BUILT)

| Feature | Status |
|---|---|
| Job management (create, schedule, track, complete) | Done |
| Quoting and invoicing | Done |
| Team management with admin/worker roles | Done |
| GPS tracking and timesheets | Done |
| WHS safety hub | Done |
| Customer database | Done |
| Stripe payments integration | Done |
| Twilio SMS notifications | Done |
| SendGrid email | Done |
| Mobile app (iOS + Android via Expo) | Done |
| Web app | Done |
| Demo system for onboarding | Done |

---

## 3. PRICING STRUCTURE

### 3.1 Plan Tiers

| Plan | Monthly Price | Target Customer |
|---|---|---|
| **Solo** | $39/month | Single tradie, no team |
| **Solo + AI** | $99/month | Single tradie who misses calls |
| **Team** | $49/month + $29/seat | Tradie with workers, no AI |
| **Team + AI** | $149/month + $29/seat | Tradie with workers who misses calls |
| **Full Bundle** | $300/month + $29/seat | Tradie who wants the complete system including website |

### 3.2 What Each Plan Includes

**Solo — $39/month**
- JobRunner app (web + mobile)
- 1 user only
- Job management, scheduling, quoting, invoicing
- Customer database
- One-way SMS notifications via "JobRunner" alphanumeric sender (invoices, reminders, quotes)
- Email notifications via SendGrid
- Chat Hub visible but LOCKED (upgrade prompt shown)

**Solo + AI — $99/month**
- Everything in Solo
- Dedicated Australian phone number for the business
- AI receptionist answers all calls 24/7
- Auto-creates jobs from call data
- Call transcripts and recordings saved to each job
- Push notification to owner on every call
- Emergency call detection and direct transfer to owner's mobile
- After-hours call handling with after-hours tag
- Chat Hub UNLOCKED — two-way customer messaging via dedicated number
- Lead inbox dashboard

**Team — $49/month + $29/seat**
- Everything in Solo
- Add team members (admin or worker roles)
- GPS tracking of team
- Timesheets and time tracking
- WHS safety management
- Team scheduling and job assignment
- Chat Hub visible but LOCKED (upgrade prompt shown)

**Team + AI — $149/month + $29/seat**
- Everything in Team + Solo + AI combined
- Dedicated business number + AI receptionist + Chat Hub
- All AI features available for the full team

**Full Bundle — $300/month + $29/seat**
- Everything in Team + AI
- Custom branded website (hosted and maintained)
- Website connected to AI receptionist number
- Website contact form creates leads in JobRunner
- Emergency routing and priority support
- Custom domain support

### 3.3 Seat Pricing Rules

- Solo and Solo + AI: NO seats available (1 user only). Must upgrade to Team/Team + AI to add workers.
- Team, Team + AI, Full Bundle: $29/month per additional seat
- The account owner is always included in the plan price (not counted as a seat)
- Each seat = one team member (admin or worker role)

### 3.4 Upgrade Path

```
Solo ($39) 
  → "I keep missing calls" 
    → Solo + AI ($99)
      → "I hired someone"
        → Team + AI ($149 + seats)
          → "I need a website too"
            → Full Bundle ($300 + seats)

Solo ($39)
  → "I hired someone"
    → Team ($49 + seats)
      → "I'm losing jobs to missed calls"
        → Team + AI ($149 + seats)
          → "I need a website too"
            → Full Bundle ($300 + seats)
```

Every step has a natural trigger. No one pays for features they don't need.

### 3.5 Cost Per Customer (Your Margins)

| Plan | Your Cost/month | Customer Pays | Profit |
|---|---|---|---|
| Solo | ~$2 | $39 | ~$37 |
| Solo + AI | ~$18-22 | $99 | ~$77-81 |
| Team (3 workers) | ~$3 | $136 | ~$133 |
| Team + AI (3 workers) | ~$25-30 | $236 | ~$206-211 |
| Full Bundle (3 workers) | ~$30-35 | $387 | ~$352-357 |

Costs include: Twilio number (~$2/mo), call minutes (~$5-15/mo), AI voice API (~$5-15/mo), hosting (negligible).

### 3.6 Revenue Projections

| Scenario | Customers | Avg Revenue | Monthly Total | Annual |
|---|---|---|---|---|
| Early stage | 20 mixed | ~$100/avg | $2,000/mo | $24,000/yr |
| Growing | 50 mixed | ~$130/avg | $6,500/mo | $78,000/yr |
| Established | 100 mixed | ~$160/avg | $16,000/mo | $192,000/yr |
| Scaling | 200 mixed | ~$180/avg | $36,000/mo | $432,000/yr |

### 3.7 Communication Architecture

| SMS/Call Type | Sent Via | Direction | Available On |
|---|---|---|---|
| Platform notifications (invoice sent, quote link, reminders) | "JobRunner" alphanumeric sender | One-way (no reply) | ALL plans |
| AI receptionist calls | Dedicated business Twilio number | Inbound | Solo + AI, Team + AI, Full Bundle |
| Job approval SMS to customer | Dedicated business number | One-way | Solo + AI, Team + AI, Full Bundle |
| Chat Hub (owner <-> customer messaging) | Dedicated business number | Two-way | Solo + AI, Team + AI, Full Bundle |
| After-hours auto-reply | Dedicated business number | One-way | Solo + AI, Team + AI, Full Bundle |
| Email notifications (invoices, quotes, welcome) | SendGrid | One-way | ALL plans (unchanged) |

The "JobRunner" alphanumeric sender ID must be re-registered with Twilio for Australian compliance.

### 3.8 Feature Gating by Plan

**Chat Hub:**
- Solo / Team users: Chat Hub is VISIBLE but LOCKED. Shows upgrade prompt: "Unlock two-way customer messaging with a dedicated business number. Upgrade to Solo + AI or Team + AI."
- Solo + AI / Team + AI / Full Bundle: Chat Hub fully functional via dedicated number.

**AI Receptionist:**
- Only available on plans with "AI" in the name (Solo + AI, Team + AI, Full Bundle).

**Team Features (GPS, timesheets, WHS, team scheduling):**
- Only available on Team, Team + AI, Full Bundle.

**Website Builder:**
- Only available on Full Bundle.

---

## 4. AI RECEPTIONIST — TECHNICAL DESIGN

### 4.1 How It Works (End-to-End Flow)

```
Customer finds tradie's website or Google listing
  → Calls the dedicated phone number
    → Twilio receives the call
      → Routes to Vapi (or Retell AI) voice agent
        → AI answers: "Hi, thanks for calling [Business Name]..."
          → AI collects: name, suburb, problem, urgency
            → Call ends → webhook fires to JobRunner backend
              → Job auto-created in tradie's account
                → Push notification sent to owner's phone
                  → Owner reviews in app → taps "Accept" or "Call Back"
                    → Customer receives SMS confirmation from same number
```

### 4.2 The Four Call Scenarios

**Scenario 1 — Standard Intake (80% of calls)**
- Customer calls → AI greets with business name → collects info → job created → owner notified
- Owner never touched the phone but captured the job

**Scenario 2 — Live Transfer**
- Customer calls → AI starts intake → owner sees live call notification in app → taps "Join Call" → AI says "Let me connect you now" → call transferred
- Feels like a real receptionist

**Scenario 3 — Emergency**
- Customer says "flooding" or "no power" → AI detects emergency keywords → immediately attempts to call owner's mobile → job created with URGENT flag
- Owner gets call + push notification simultaneously

**Scenario 4 — After Hours**
- Call comes in outside business hours → AI answers normally → job created with "after-hours" tag → owner sees it first thing in the morning

### 4.3 Technology Stack

| Component | Service | Purpose | Cost |
|---|---|---|---|
| Phone numbers | Twilio | Provision dedicated AU numbers, handle call routing | ~$2/mo per number + per-minute rates |
| Voice AI agent | Vapi or Retell AI | Runs the actual voice conversation, collects structured data | ~$0.05-0.10/min |
| Backend webhook | JobRunner API | Receives call data, creates jobs, sends notifications | Already built |
| SMS confirmations | Twilio | Sends confirmations from the same dedicated number | Already integrated |
| Push notifications | Expo Push | Notifies owner on mobile | Already built |

### 4.4 AI Call Script (Plumber Example)

```
AI: "Hi, thanks for calling [Business Name]. I'm the virtual assistant.
     How can I help you today?"

Customer: [describes problem]

AI: "I can help get that sorted. Can I grab your name?"

Customer: [gives name]

AI: "And what suburb are you in?"

Customer: [gives suburb]

AI: "Is this something urgent that needs attention today,
     or are you happy to book in for another time?"

Customer: [responds]

AI: "Great, I've got all the details. [Owner name] will review this
     and get back to you shortly. Is this the best number to reach you on?"

Customer: [confirms]

AI: "Perfect. Thanks for calling [Business Name]. You'll hear back soon."
```

4 questions. Under 90 seconds. Job created.

### 4.5 What the Business Owner Configures (Settings UI)

Inside their JobRunner account settings:

- Business name (used in greeting)
- Greeting style (professional / casual / custom script)
- Services they offer (so AI only books relevant work)
- Suburbs they service
- Emergency keywords (flooding, no power, gas leak, etc.)
- Business hours (defines when after-hours mode activates)
- Transfer preference: AI screens first, or ring owner immediately
- Owner's mobile number (for emergency transfers)

### 4.6 Phone Number Management

- When a business subscribes to Team + AI or Full Bundle, system auto-provisions a Twilio AU number via API
- Number is displayed in their dashboard with instructions: "Put this number on your website, Google listing, business cards, and van"
- If they cancel, number is released after 30-day grace period
- All SMS from JobRunner for that business routes through their dedicated number (not the shared platform number)

---

## 5. WEBSITE BUILDER — TECHNICAL DESIGN

### 5.1 Concept

A simple, template-based website builder inside JobRunner. Not competing with Wix or Squarespace — just giving tradies a professional one-page (or few-page) site connected to their system.

### 5.2 What the Website Includes

- Hero section with business name, tagline, and call-to-action button
- Phone number prominently displayed (connects to AI receptionist)
- Services list
- Service area / suburbs
- About section
- Photo gallery (upload their own job photos)
- Contact form (submissions create leads in JobRunner)
- Google reviews integration (optional)
- Mobile responsive
- Fast loading
- SEO basics (title, meta description, structured data for local business)

### 5.3 What the Owner Configures

Inside JobRunner website settings:

- Business name and tagline
- Logo upload
- Services offered (pulled from their JobRunner account)
- Suburbs serviced
- About text
- Photos (from their completed jobs)
- Color scheme (pick from presets or custom brand color)
- Contact form fields
- Google Reviews link (optional)
- Custom domain or hosted on jobrunner.com.au/sites/[business-slug]

### 5.4 Templates

Start with 3 templates:

1. **Clean & Professional** — white background, minimal, suits most tradies
2. **Bold & Trade** — darker theme, strong colors, good for builders/construction
3. **Friendly & Local** — warm tones, approachable, good for home services

Each template is the same underlying code with different color schemes and layout emphasis. Not 3 separate codebases.

### 5.5 How It Connects

```
Website phone number → AI Receptionist → JobRunner
Website contact form → JobRunner leads inbox
Website "Request a Quote" → JobRunner quote request
```

Everything feeds back into the one system.

### 5.6 Hosting

- Hosted on your infrastructure
- Default URL: jobrunner.com.au/sites/[business-slug] (e.g., jobrunner.com.au/sites/daves-plumbing)
- Custom domain support: business points their domain DNS to your server
- SSL/HTTPS included via Let's Encrypt or Cloudflare

---

## 6. BILLING SYSTEM — TECHNICAL DESIGN

### 6.1 How Payments Work

- Stripe handles all subscription billing (already integrated)
- Customer enters card once during signup
- Charged automatically on the same date each month
- Failed payments: Stripe retries automatically (3 attempts over ~2 weeks)
- After all retries fail: account downgraded to Solo features only (not locked out)

### 6.2 Stripe Setup Required

Create in Stripe dashboard (or via API):

| Product | Price | Type |
|---|---|---|
| Solo Plan | $39/month | Recurring |
| Solo + AI Plan | $99/month | Recurring |
| Team Plan | $49/month | Recurring |
| Team + AI Plan | $149/month | Recurring |
| Full Bundle | $300/month | Recurring |
| Team Seat | $29/month | Recurring (metered/quantity-based) |

Seats are added as a quantity on the subscription. When owner adds a team member, Stripe subscription quantity increases. When they remove one, it decreases. Prorated automatically.

### 6.3 In-App Billing UI

New section in JobRunner settings: **"Plan & Billing"**

Shows:
- Current plan
- Number of seats
- Next billing date
- Payment method on file
- Invoice history
- Upgrade / downgrade buttons
- Cancel subscription button

### 6.4 Free Trial

- 14-day free trial on any plan (no credit card required to start)
- Full access during trial
- At day 10: reminder notification — "Your trial ends in 4 days"
- At day 14: prompted to enter payment or downgraded to limited free tier
- Limited free tier: can view data but can't create new jobs. Encourages conversion without locking them out of their data.

### 6.5 Cancellation Flow

When a business cancels:

1. Immediate: subscription set to cancel at end of billing period (not instant)
2. They keep full access until the paid period ends
3. AI receptionist: calls still answered until end of period, then number is held for 30 days
4. Website: stays live for 30 days after cancellation, then taken down
5. Data: never deleted. If they resubscribe, everything is still there
6. 30 days after final billing period: dedicated phone number released back to pool

---

## 7. BUILD ORDER (WHAT TO DO AND WHEN)

### Phase 1 — Subscription Billing (1-2 weeks)
- Create Stripe products and prices for all 5 tiers + seat add-on
- Build Plan & Billing settings page in web app
- Implement upgrade/downgrade/cancel flows
- Wire seat quantity changes to Stripe when team members added/removed
- Add free trial logic (14 days)
- Implement feature gating: lock Chat Hub for Solo/Team users with upgrade prompt
- Test payment flows end to end

### Phase 2 — AI Receptionist Core (2-3 weeks)
- Sign up for Vapi (or Retell AI) account
- Build Twilio number provisioning: API call to buy AU number when business subscribes to AI tier
- Create the voice agent call script in Vapi
- Build webhook endpoint on JobRunner backend: receives call data, creates job
- Wire push notification to owner when AI creates a job
- Build basic AI receptionist settings UI (business name, services, hours, suburbs)
- Test full flow: call → AI answers → job appears in app

### Phase 3 — AI Receptionist Advanced (1-2 weeks)
- Client auto-lookup: check if caller's phone number already exists as a client before creating a new record (link to existing client or create new)
- Emergency keyword detection and owner transfer
- After-hours mode
- Call recordings saved to job record
- Call transcript saved to job record
- Lead inbox dashboard (new section in JobRunner)
- SMS confirmation to customer from dedicated number after job approved

### Phase 4 — Website Builder (SEPARATE PROJECT)
- Website builder will be built as a separate Replit project
- Connects to JobRunner via API: pulls business info, pushes leads/contact form submissions
- Call Now button on website dials the dedicated Twilio number (already connected to AI receptionist here)
- JobRunner only needs to expose: GET /api/public/business/:id and POST /api/public/leads
- No website builder code lives in this project

### Phase 5 — Polish and Launch (1-2 weeks)
- End-to-end testing of all 5 plan tiers
- Test upgrade/downgrade paths
- Test cancellation and data retention
- Prepare marketing: demo video, landing page on jobrunner.com.au
- Beta launch: sign up 5-10 local Cairns tradies for free trial
- Collect feedback, iterate

**Total estimated build time: 5-8 weeks (without website builder)**

---

## 8. CUSTOMER ACQUISITION STRATEGY

### Phase 1 — Direct Outreach (Start Immediately)
- Search Google Maps for tradies in Cairns
- Message on Facebook tradie groups
- Offer: "Free 2-week trial, I'll set everything up for you"
- Goal: 10 beta users

### Phase 2 — Content Marketing (Ongoing)
- TikTok / Instagram short videos showing:
  - Call comes in → AI answers → job appears in app
  - Website live in 5 minutes
  - "How many calls did you miss this week?"
- This content is visual and demonstrates immediate value

### Phase 3 — Google Ads (Once Revenue Covers It)
- Target: "tradie app Australia", "plumber business software", "AI receptionist for business"
- Start small: $10-20/day
- Scale what converts

### Phase 4 — Word of Mouth
- Once tradies use it, they talk about it
- Add referral incentive: "Refer a mate, both get a free month"

---

## 9. COMPETITIVE LANDSCAPE

| Competitor | What They Do | What They're Missing |
|---|---|---|
| ServiceM8 | Job management | No AI receptionist, no website builder |
| Tradify | Job management + quoting | No AI receptionist, no website builder |
| Fergus | Job management | No AI receptionist, no website builder |
| Smith.ai | AI receptionist | No job management, no website |
| Air AI | AI voice agent | No job management, no website |
| Squarespace/Wix | Website builder | No job management, no AI receptionist |

**JobRunner's position:** The only platform that combines all three into one integrated system.

---

## 10. TWILIO PHONE NUMBER ARCHITECTURE

### 10.1 Three-Tier Communication System

| Purpose | Sent Via | Direction | Available On |
|---|---|---|---|
| **Platform notifications** (invoice sent, quote link, reminders) | "JobRunner" alphanumeric sender | One-way (no reply) | ALL plans |
| **AI receptionist calls** | Dedicated business Twilio number | Inbound | Solo + AI, Team + AI, Full Bundle |
| **Chat Hub** (owner <-> customer messaging) | Dedicated business number | Two-way | Solo + AI, Team + AI, Full Bundle |
| **Job approval SMS to customer** | Dedicated business number | One-way | Solo + AI, Team + AI, Full Bundle |
| **After-hours auto-reply** | Dedicated business number | One-way | Solo + AI, Team + AI, Full Bundle |
| **Email notifications** (invoices, quotes, welcome) | SendGrid | One-way | ALL plans (unchanged) |

- The "JobRunner" alphanumeric sender ID must be re-registered with Twilio for Australian compliance (tightened rules since original setup).
- SendGrid stays completely unchanged. Same setup, same templates. Only new templates added for AI-specific emails.
- Dedicated numbers are provisioned automatically via Twilio API when a business upgrades to any AI plan.
- Cost: ~$2/month per dedicated number.

### 10.2 Dedicated Number Flow

```
Business upgrades to Solo + AI / Team + AI / Full Bundle
  → Backend calls Twilio API to buy an AU number
    → Number saved to that business's account record
      → Twilio configured: voice webhook → Vapi, SMS webhook → JobRunner
        → Owner told: "Your business number is 07 XXXX XXXX.
           Put it on your website, Google, cards, and van."
```

### 10.3 SMS Routing Rules

| Message Type | Sent From |
|---|---|
| Generic platform notifications (invoice reminders, quote links) | Shared platform number |
| Job approval confirmation to customer who called AI | Business's dedicated number |
| Chat hub messages between owner and customer | Business's dedicated number |
| After-hours auto-reply | Business's dedicated number |

This means the customer only ever sees one number for that business. Clean and professional.

### 10.4 Number Lifecycle on Cancellation

1. Business cancels AI plan → number stays active until end of billing period
2. 30-day grace period after billing ends (in case they resubscribe)
3. After 30 days → number released back to Twilio pool
4. If they resubscribe within 30 days → same number restored

---

## 11. CLIENT DATA ISOLATION & LEGAL PROTECTIONS

### 11.1 Data Scoping

All client records are scoped per business account. If the same person (same phone number) calls two different businesses on JobRunner, they exist as two completely separate client records. No crossover, no data sharing between businesses. This is the same architecture used by Shopify, Xero, and every major multi-tenant SaaS.

### 11.2 Conflict Scenarios & Solutions

**Scenario 1 — Same customer calls two different businesses**
Already solved. Client records are per business account. No crossover.

**Scenario 2 — Wrong number / spam call**
- Only create a client record AFTER the AI collects minimum info (name + issue)
- If the caller hangs up before providing info, no record created
- Owner can reject/delete any AI-created job and the unverified client record is auto-cleaned

**Scenario 3 — Customer disputes what AI said or promised**
This is the biggest legal risk. Solutions:
- AI NEVER confirms specific times, prices, or commitments
- Every call ends with: "Someone from the team will confirm the details with you shortly"
- All call recordings and transcripts stored permanently as evidence
- Terms of service clearly state: "AI assistant collects information only. All job details are confirmed by the business owner."

**Scenario 4 — Privacy / data deletion request**
- Owner can delete any client record from their account
- Must comply with Australian Privacy Act — if a customer requests deletion, their data must be removed from that business's records
- Build a simple "Delete Client & All Data" function that cascades (removes jobs, chat history, call recordings for that client)

### 11.3 Required Legal Documents (Before Launch)

| Document | Purpose |
|---|---|
| **Terms of Service** | Covers platform use, AI limitations, liability |
| **Privacy Policy** | How customer data is collected, stored, used (Australian Privacy Act compliant) |
| **AI Disclosure** | Statement that calls may be answered by an AI assistant. Required in Australia. |
| **Data Processing Agreement** | You process data on behalf of businesses. Standard SaaS DPA template. |

These are template documents you can get from legal template services (about $100–300) and customise. Not expensive.

### 11.4 Call Recording Compliance (Australia)

- In most Australian states, only ONE party needs to consent to recording (the business, as account holder, provides consent)
- However, best practice: AI should say at the start "This call may be recorded for quality purposes"
- All recordings stored securely, accessible only to the business owner
- Retention: keep for 12 months minimum, auto-delete after 24 months unless business opts to keep longer

---

## 12. AI RECEPTIONIST → JOB → CHAT FLOW (DETAILED)

### 12.1 The Complete Automated Flow

```
Customer calls business dedicated number
  → Twilio receives call → routes to Vapi
    → AI answers: "Hi, thanks for calling [Business Name]..."
      → AI collects: name, phone (automatic), suburb, issue, urgency
        → Call ends → webhook fires to JobRunner backend
          → Backend checks: does this phone number already exist as a client?
            → YES: link new job to existing client
            → NO: create new client record, then create job
              → Job created with status: "pending_approval"
                → Push notification to owner: "New job from AI — Sarah, Mooroobool, blocked drain"
                  → Owner opens app → reviews job card → taps "Approve"
                    → Three things happen simultaneously:
                      1. Job status: pending → approved
                      2. SMS to customer (from dedicated number):
                         "Hi Sarah, [Business Name] has confirmed your job."
                      3. Chat hub thread auto-created between owner and customer
                    → Owner can now message or call customer directly from Chat Hub
```

### 12.2 AI-Created Job Card (What Auto-Populates)

| Field | Source | Example |
|---|---|---|
| Client name | AI collected | Sarah Mitchell |
| Client phone | Twilio (automatic) | 0412 345 678 |
| Suburb | AI collected | Mooroobool |
| Issue description | AI collected from conversation | "Blocked drain in kitchen, water backing up" |
| Urgency | AI assessed | Normal / Urgent / Emergency |
| Source | Auto-tagged | "AI Receptionist" |
| Call recording | Vapi/Retell | Audio file attached to job |
| Call transcript | Vapi/Retell | Full text transcript attached |
| Status | Auto-set | Pending Approval |
| Created at | Auto-set | Timestamp of call |
| Business hours flag | Auto-set | "During hours" or "After hours" |

### 12.3 Client Portal Connection

When AI creates a client record, that client can immediately access their portal:
- Portal link included in the approval SMS: "Track your job at jobrunner.com.au/portal"
- Client logs in with their phone number (account already exists from the AI call)
- Their job is already there — no signup needed, no friction
- They can see job status, message the tradie, view quotes/invoices

---

## 13. RISK ASSESSMENT & LEGAL

| Risk | Likelihood | Mitigation |
|---|---|---|
| AI voice sounds robotic | Medium | Test extensively, use premium voice models, keep script short |
| Tradies don't trust AI answering their phone | Medium | Offer "AI screens, then transfers" mode. Let them listen to demo calls |
| Competitors copy the model | Low-Medium | First mover advantage + integration depth is hard to replicate quickly |
| Vapi/Retell pricing increases | Low | Both have competitors, can switch. Keep integration layer abstracted |
| Twilio outage affects calls | Low | Twilio has 99.95% uptime SLA. Can add fallback to owner's mobile |
| Tradies churn after trying | Medium | Focus on onboarding quality. If the first call works well, they stay |

---

## 14. KEY DECISIONS TO MAKE

1. **Vapi vs Retell AI** — Both do the same thing. Vapi has slightly better developer docs. Retell has slightly better voice quality. Recommend trying both on a test number and picking whichever sounds more natural.

2. **Website hosting approach** — Host on your own server (simpler, cheaper) vs Vercel/Cloudflare Pages (faster, more scalable). Recommend starting on your own server, migrate later if needed.

3. **Free tier vs trial only** — Do you offer a permanently free tier with limited features, or just a 14-day trial? Recommend 14-day trial with a degraded "view only" mode after expiry. Keeps the door open without giving away too much.

4. **ABN / Business registration** — Before accepting real payments, you'll need an ABN. This doesn't block building, but it blocks launching commercially.

---

## 15. WORKER VS OWNER PERMISSIONS

### 15.1 Feature Access by Role

| Feature | Owner/Admin | Worker |
|---|---|---|
| Job details, photos, notes, job chat | Yes | Yes (assigned jobs only) |
| SWMS (sign/view for their job) | Yes | Yes |
| PPE check before starting work | Yes | Yes |
| View own timesheets | Yes | Yes |
| Clock in/out | Yes | Yes |
| Proof Pack, Client Portal | Yes | No |
| Profitability, Job Costing, Expenses | Yes | No |
| Variations, Subcontractors | Yes | No |
| Chat Hub (customer messaging) | Yes | No |
| Billing & Plan management | Yes | No |
| WHS Safety overview (compliance) | Yes | Limited view (own records only) |
| Team management, GPS tracking | Yes | No |
| AI Receptionist settings | Yes | No |
| Website builder settings | Yes | No |

### 15.2 Mobile App Worker Experience

Workers only see:
- **Today tab**: Their assigned jobs for the day
- **Jobs tab**: All jobs they're assigned to
- **Timesheets tab**: Their own time entries
- **More tab**: Their profile, notifications, limited WHS (own training/tickets)

Workers do NOT see:
- Dashboard with revenue/profit numbers
- Client database
- Quoting/invoicing
- Team management
- Business settings
- Chat Hub
- AI receptionist settings

---

## 16. WHS SAFETY ARCHITECTURE

### 16.1 Where Safety Data Lives

Safety features exist at TWO levels in JobRunner:

**Job Level (inside each job view):**
- SWMS creation and signing — specific to THAT job
- PPE checklist — filled out before starting THAT job
- Incident report — if something happened on THAT job
- Hazard report — identified during THAT job
- Site-specific safety notes

**Business Level (WHS Safety page):**
- Aggregated compliance dashboard — pulls from ALL jobs
- Training records and ticket expiry tracking
- Emergency contacts and procedures
- Safety statistics (incidents over time, completion rates)

### 16.2 WHS Safety Page Tabs (Simplified to 5)

| Tab | What It Shows | NOT For |
|---|---|---|
| **Overview** | Compliance status cards, quick-action PPE checklist, safety score | Not a mini-list of everything |
| **Incidents & Hazards** | All incidents and hazard reports merged into one timeline | Not for creating new ones (that's done inside jobs) |
| **SWMS & JSA** | All SWMS documents and JSA records merged into one list | Not for creating new ones (that's done inside jobs) |
| **Training** | Worker certifications, tickets, expiry dates, renewal reminders | Active management area |
| **Emergency** | Emergency contacts, evacuation procedures, first aid info | Active management area |

### 16.3 Key Principle

The WHS Safety page is a READ-ONLY compliance dashboard that answers: "Are we covered? What's missing? Who has expired tickets?"

It does NOT duplicate creation forms that already live inside individual job views. SWMS creation happens when starting a job. Incident reporting happens during a job. PPE checklists happen before a job. The WHS page just aggregates all of that data into one view for the owner.

---

## 17. SUMMARY

**What you're building:**
A complete business operating system for Australian tradies — website, AI phone answering, job management, invoicing, team management — all in one platform.

**Why it works:**
No competitor offers all three pieces integrated. Each piece alone is valuable. Together, they create a system tradies can't easily leave.

**Technical difficulty:**
Moderate. 70% of the system is already built. The AI receptionist is a new integration (Twilio + Vapi) but not complex. The website builder is template-based, not a full CMS.

**Time to build:**
7-12 weeks for all features. Can launch with just billing + AI receptionist in 4-5 weeks.

**Revenue potential:**
100 customers at ~$160/month average = $16,000/month = $192,000/year.
