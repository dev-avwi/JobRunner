# JobRunner — Demo Presentation Guide

## Login Credentials
- **Email:** demo@jobrunner.com.au
- **Password:** demo123

---

## THE 30-SECOND PITCH (Start here)

"JobRunner is an all-in-one job management platform built specifically for Australian tradies. It replaces 5-6 separate apps — your job board, invoicing software, quoting tool, team scheduler, expense tracker, and client comms — with one connected system. And it works just as well on a phone standing on a roof as it does on a laptop in the office."

---

## WHAT MAKES JOBRUNNER DIFFERENT

### 1. Built for Tradies, Not Adapted for Them
Most competitors (ServiceM8, Fergus, Tradify, simPRO) were built as generic field service tools and retrofitted for trades. JobRunner is purpose-built with Australian trade language, GST handling, SWMS compliance, and trade-specific calculators (concrete, paint, tile, roofing).

### 2. True Mobile-First — Not Just a Dumbed-Down App
The mobile app has full feature parity with the web dashboard. Tradies on-site can do everything their office admin can — create jobs, send quotes, collect payments, track expenses, run the AI assistant. Most competitors give you a limited mobile view.

### 3. AI That Actually Does Things
The AI assistant isn't just a chatbot. It can:
- Create jobs, send emails, and mark work complete through voice/text commands
- Scan receipts and auto-categorise expenses
- Detect safety hazards in job site photos
- Generate smart payment chasing messages
- Write professional quotes from rough notes

### 4. Real-Time Team Operations
Live GPS tracking, team presence board (who's on-site, on break, travelling), dispatch board, and instant team chat — all in one place. Competitors typically charge extra modules for this.

### 5. Integrated Payments — Not Just Invoicing
Stripe-powered payment links, Tap to Pay on mobile, QR code payments, and a smart Payment Chaser that uses AI to write follow-up messages for overdue invoices. Plus full Xero/MYOB/QuickBooks sync.

---

## PRESENTATION FLOW (Recommended Order)

### ACT 1: "The Office View" (Web App — 5 mins)

**1. Dashboard (Start here)**
- Show the daily overview — jobs for today, revenue snapshot, recent activity feed
- Point out the weather widget (tradies care about weather)
- Highlight the notification bell — "What You Missed" feature

**2. Work Hub**
- Show active jobs with status filters (Pending, Scheduled, In Progress, Done)
- Click into a job to show the full detail view:
  - GPS check-in/out, photos, notes, client info
  - Digital signatures, SWMS documents
  - Linked quotes, invoices, expenses
- "Everything about this job is in one place"

**3. Documents Hub (Quotes & Invoices)**
- Show professional quote creation with templates
- Show one-click invoice generation from a completed job
- Highlight the "Send via SMS or Email" options

**4. Payment Hub**
- Show the financial overview — what's been paid, what's overdue
- Demonstrate the Smart Payment Chaser — AI-generated follow-up messages
- Show Stripe payment links and collection tools

### ACT 2: "The Automation Engine" (Web App — 3 mins)

**5. Autopilot**
- Show automated workflows:
  - "Send quote follow-up after 3 days"
  - "Remind client 24hrs before scheduled job"
  - "Request review after payment received"
  - "Send overdue invoice reminder"
- "Set it and forget it — the system chases your money for you"

**6. AI Assistant**
- Open the AI chat
- Type something like: "What jobs need my attention today?"
- Show how it can take actions, not just answer questions
- "This is like having a virtual office manager"

### ACT 3: "The Field View" (Mobile App — 5 mins)

**7. Mobile Dashboard**
- Show the clean mobile dashboard with today's jobs
- Weather widget, quick actions, time tracking

**8. Job Detail (Mobile)**
- Open a job on mobile — show it has ALL the same features as web
- GPS check-in, photo upload, notes, signatures
- "Your tradie on-site has the same power as the admin in the office"

**9. Mobile Payments**
- Show Collect Payment screen — Tap to Pay, QR code options
- Show expense scanning — take a photo of a receipt, AI extracts the data

**10. Team Operations (Mobile)**
- Show the team map with live locations
- Show the dispatch board
- Show team chat and direct messages

### ACT 4: "The Back Office" (Web App — 3 mins)

**11. Team Management**
- Show roles and permissions (Owner, Manager, Staff, Subcontractor)
- Show team groups/crews
- Show timesheet management and payroll reports

**12. Insights & Reports**
- Show business health metrics
- Profitability reports
- "Data that helps tradies actually understand if they're making money"

**13. Integrations**
- Show connected services: Stripe, Xero/MYOB/QuickBooks, Google Calendar, Twilio SMS
- "Everything talks to everything — no double entry"

---

## KILLER FEATURES TO HIGHLIGHT

| Feature | Why It Matters |
|---|---|
| Smart Payment Chaser | AI writes personalised follow-up messages for overdue invoices — tradies hate chasing money |
| SWMS & Compliance | Digital Safe Work Method Statements — legally required on Aussie job sites |
| Trade Calculators | Concrete, paint, tile, roofing calculators built right in |
| Receipt Scanning | Take a photo, AI extracts vendor/amount/category — no more shoebox of receipts |
| Client Portal | Clients can view quotes, approve work, track progress, and pay online |
| Service Reminders | Automated recurring maintenance reminders — drives repeat business |
| GPS Geofencing | Auto clock-in when tradies arrive on site, auto clock-out when they leave |
| Voice Notes | Record voice memos on jobs — faster than typing on site |
| Tap to Pay | Accept card payments on the spot with just a phone |
| Multi-option Quotes | Send quotes with Good/Better/Best options — increases average job value |

---

## COMPETITIVE COMPARISON

| Feature | JobRunner | ServiceM8 | Tradify | Fergus | simPRO |
|---|---|---|---|---|---|
| Full mobile parity | Yes | Partial | Partial | Limited | Limited |
| AI Assistant | Yes | No | No | No | No |
| Built-in payments | Stripe | Stripe | Manual | Manual | Manual |
| Smart Payment Chaser | AI-powered | No | No | No | No |
| SWMS/Compliance | Built-in | Add-on | No | Limited | Add-on |
| Trade Calculators | Built-in | No | No | No | No |
| Receipt AI Scanning | Yes | No | No | No | No |
| Team GPS Tracking | Real-time | Basic | No | Limited | Add-on |
| Accounting Sync | Xero/MYOB/QBO | Xero | Xero | Xero | Xero/MYOB/QBO |
| SMS Notifications | Twilio built-in | Yes | No | Limited | Yes |
| Google Calendar Sync | Yes | No | No | No | No |
| Client Portal | Yes | Yes | No | Limited | Yes |
| Autopilot/Automations | Yes | Limited | No | No | Limited |

---

## TECHNICAL HIGHLIGHTS (For the Developer)

- **Stack:** React + Express + PostgreSQL (web), React Native/Expo (mobile)
- **Payments:** Stripe Connect + Terminal (Tap to Pay)
- **Comms:** Twilio SMS + SendGrid Email + Gmail/Outlook direct send
- **AI:** OpenAI GPT-4o-mini with function calling (actions, not just chat)
- **Maps:** Google Maps API with geocoding + OSRM routing
- **Accounting:** Xero, MYOB, QuickBooks full two-way sync
- **Auth:** Session-based with Google OAuth option
- **Real-time:** WebSocket for live team tracking and presence
- **Storage:** Cloud object storage for photos and documents
- **Scheduling:** Background job schedulers for automations, reminders, billing

---

## DEMO TIPS

1. **Start with the problem:** "Tradies juggle 5-6 apps and still lose track of jobs and money"
2. **Show, don't tell:** Click through real screens rather than describing features
3. **Use the AI:** It's the wow factor — type a natural question and show the response
4. **End on payments:** "The whole point is getting paid faster" — show the Payment Chaser
5. **Mobile last:** Save the mobile demo for the end — "everything you just saw? It all works in their pocket too"
6. **Keep it to 15 mins:** You can always go deeper if they ask questions

---

## QUESTIONS TO EXPECT (AND ANSWERS)

**"How is this different from ServiceM8?"**
ServiceM8 is solid but hasn't innovated much. JobRunner has AI built into the core — payment chasing, receipt scanning, hazard detection, smart suggestions. Plus full mobile parity, not a cut-down app.

**"What about pricing?"**
Currently in Beta with limited spots. Pricing will be competitive with Tradify/ServiceM8 ($30-50/user/month range) but with significantly more features included — no add-on modules.

**"Can it handle large teams?"**
Yes — roles and permissions, team groups/crews, dispatch board, GPS tracking, timesheet management, and payroll reports are all built in.

**"What about offline?"**
The app is designed to work in areas with poor connectivity — critical for tradies on remote sites.

**"Data migration?"**
Xero/MYOB/QuickBooks sync pulls in existing clients and invoice history. CSV import for job data is on the roadmap.
