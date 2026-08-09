# JobRunner Complete Feature Audit
**Platform:** Web App (React) + Mobile App (React Native/Expo)
**Entity:** LinkUp2Care Pty Ltd | ABN 34 692 409 448
**Target Market:** Australian tradespeople (electricians, plumbers, builders, HVAC, etc.)
**Demo:** demo@jobrunner.com.au / demo123 (Mike's Plumbing Services)

---

## TABLE OF CONTENTS
1. [Architecture Overview](#1-architecture-overview)
2. [Authentication & Onboarding](#2-authentication--onboarding)
3. [Dashboard](#3-dashboard)
4. [Job Management](#4-job-management)
5. [Client Management (CRM)](#5-client-management-crm)
6. [Leads Pipeline](#6-leads-pipeline)
7. [Quotes System](#7-quotes-system)
8. [Invoices & Billing](#8-invoices--billing)
9. [Payments (Stripe)](#9-payments-stripe)
10. [Time Tracking & Payroll](#10-time-tracking--payroll)
11. [GPS & Location Tracking](#11-gps--location-tracking)
12. [Team Management](#12-team-management)
13. [Communication (SMS, Chat, Email)](#13-communication-sms-chat-email)
14. [AI Receptionist (Vapi)](#14-ai-receptionist-vapi)
15. [Scheduling & Calendar](#15-scheduling--calendar)
16. [WHS (Work Health Safety)](#16-whs-work-health-safety)
17. [Inventory & Equipment](#17-inventory--equipment)
18. [Expenses & Receipt Scanning](#18-expenses--receipt-scanning)
19. [Automations & Autopilot](#19-automations--autopilot)
20. [Reports & Insights](#20-reports--insights)
21. [Client-Facing Portals](#21-client-facing-portals)
22. [Integrations](#22-integrations)
23. [Settings & Configuration](#23-settings--configuration)
24. [Subscription & Billing](#24-subscription--billing)
25. [Mobile-Specific Features](#25-mobile-specific-features)
26. [Admin Panel](#26-admin-panel)
27. [Feature Interconnection Map](#27-feature-interconnection-map)
28. [Competitive Advantages](#28-competitive-advantages)
29. [Honest Assessment & Gaps](#29-honest-assessment--gaps)

---

## 1. ARCHITECTURE OVERVIEW

### Tech Stack
- **Frontend (Web):** React + Vite, TailwindCSS, shadcn/ui, Wouter routing, TanStack Query
- **Frontend (Mobile):** React Native + Expo (Expo Router), NativeWind, Expo Location
- **Backend:** Node.js + Express, PostgreSQL (Drizzle ORM), WebSockets
- **External Services:** Stripe (payments), Twilio (SMS/Voice), Vapi.ai (AI voice), SendGrid (email), OpenAI (AI features), Xero/MYOB/QuickBooks (accounting)

### Data Model
- 158 database tables covering users, businesses, jobs, clients, quotes, invoices, time entries, locations, team members, forms, equipment, inventory, leads, automations, AI calls, and more.
- Multi-tenant architecture: every table has a `userId` or `businessOwnerId` foreign key for data isolation.
- Job-centric design: quotes, invoices, time entries, expenses, assignments, and forms all link back to a `jobId`.

### File Structure
```
server/routes.ts     ~48,000 lines  (all API endpoints)
shared/schema.ts     ~4,800 lines   (all database tables & types)
client/src/pages/    ~50 page components
client/src/components/ ~80 shared components
mobile/app/          ~40 screens (Expo Router)
mobile/src/lib/      ~15 service modules
```

---

## 2. AUTHENTICATION & ONBOARDING

### Authentication Methods
| Method | Web | Mobile | How It Works |
|--------|-----|--------|-------------|
| Email + Password | Yes | Yes | Standard bcrypt hash, session-based |
| Google OAuth | Yes | Yes | OAuth 2.0 flow via Google Cloud |
| Apple Sign-In | No | Yes | Apple ID integration (iOS only) |
| Xero Sign-In | Yes | No | OAuth for accounting-linked login |
| Passwordless Code | Yes | Yes | 6-digit OTP sent via email |
| Invite Code | Yes | Yes | 6-char alphanumeric code to join a team |

### Onboarding Flow (Owner)
**Step-by-step:**
1. **Role Selection** - Owner, Worker, or Subcontractor
2. **Trade Type** - Electrical, Plumbing, Building, HVAC, Painting, Landscaping, etc.
3. **Business Details** - Business name, ABN, phone, email, address
4. **GST Registration** - Toggle + default hourly rate
5. **Stripe Connect** - One-tap setup for accepting payments
6. **Data Import** - CSV import or migrate from Tradify/ServiceM8
7. **Team Invites** (Team plan) - Invite members by email
8. **Demo Data** - Option to seed sample clients, jobs, quotes
9. **Immersive Walkthrough** - "Life of a Job" tour through 7 stages

### Onboarding Flow (Worker/Subcontractor)
1. Register account
2. Enter invite code from their boss
3. See assigned jobs immediately

### Why It's Better
- Competitors (Tradify, ServiceM8) have no immersive onboarding. JobRunner walks users through the entire job lifecycle before they even create their first real job.
- CSV import from competitor platforms makes switching painless.
- Demo data lets users explore without risk.

---

## 3. DASHBOARD

### Owner/Manager Dashboard
**Web Display:** Full-width layout with KPI cards at top, widgets below
**Mobile Display:** Scrollable card-based layout optimized for one-handed use

**KPI Cards (top row):**
| Metric | Description |
|--------|-------------|
| Total Revenue | Sum of all paid invoices |
| Pending Revenue | Unpaid invoices outstanding |
| Jobs Today | Count of jobs scheduled for today |
| Active Workers | Team members currently clocked in |

**Widgets:**
- **Today's Schedule** - List of today's jobs with times, client names, addresses, status
- **Recent Activity Feed** - Real-time log of actions (job created, invoice paid, quote accepted)
- **What You Missed** - Notification summary panel (new leads, overdue invoices, team alerts)
- **Quick Actions** - One-tap buttons: New Job, New Quote, New Invoice, Add Client
- **Weather Widget** (mobile) - Local weather for outdoor trades
- **Active Timer** (mobile) - If a timer is running, shows elapsed time with job name

### Worker Dashboard
- Simplified view: today's assigned jobs, active timer, recent notifications
- No financial data visible (respects role permissions)

### Subcontractor Dashboard
- Only sees jobs assigned to them
- Accept/decline buttons on pending assignments
- Submit photos and notes

### How It Interconnects
- Dashboard pulls from `/api/dashboard/stats` which aggregates data from jobs, invoices, quotes, time_entries, and team_presence tables
- Clicking any KPI navigates to the relevant detail page
- Activity feed is real-time via WebSocket connection

---

## 4. JOB MANAGEMENT

### Job Lifecycle
```
Lead → Pending → Scheduled → In Progress → Done → Invoiced → Archived
                                                  ↗
                                    Cancelled ←──┘
```

### Creating a Job
**Web:** `/jobs/new` - Full form with sections
**Mobile:** Modal form or from client/lead conversion

**Fields:**
- Title, Description (supports rich formatting)
- Client (searchable dropdown, or create new inline)
- Address (Google Places autocomplete with lat/lng)
- Scheduled date/time (start + end)
- Priority (Low, Medium, High, Urgent)
- Assigned team member(s)
- Estimated value
- Checklists (multiple task items)
- Photos (before/during/after categories)
- Custom form attachments (SWMS, JSA)
- Tags and categories
- Geofence radius (default 100m)
- Recurring pattern (if applicable)

### Job Detail View (`JobDetailView.tsx`)
**Sections displayed:**
1. **Header** - Status badge, client name, address with map link, priority indicator
2. **Status Controls** - Buttons to advance: Start Job → Mark Complete → Create Invoice
3. **Assignment Panel** - Assigned workers with avatars, add/remove team members
4. **Time Tracking Panel** - Per-worker breakdown: initials, hours, rate, cost. "Job Complete — Get Paid" card shows labour summary
5. **Checklist** - Interactive checkboxes, progress percentage
6. **Photos** - Grid gallery with before/during/after tabs, upload button
7. **Job Chat** - Real-time messaging for everyone assigned to this job
8. **Documents** - Linked quotes, invoices, SWMS with status badges
9. **Expenses** - Costs linked to this job
10. **Variations** - Change orders with approval workflow
11. **Activity Log** - Timeline of all status changes, messages, photos
12. **Client Portal Toggle** - Enable/disable the client-facing live view

### Job Actions
| Action | What Happens | Interconnections |
|--------|-------------|------------------|
| Start Job | Creates time entry, updates status, notifies client if portal enabled | Time Tracking, Notifications |
| On My Way | Sends SMS to client with ETA, starts live tracking | SMS, GPS, Client Portal |
| Mark Complete | Stops all timers, prompts for invoice creation | Time Tracking, Invoicing |
| Create Invoice | Pre-fills invoice from job + time tracking data | Invoices |
| Send to Calendar | Creates Google Calendar event | Google Calendar integration |
| Archive | Hides from active list but preserves all data | Jobs list filtering |

### Job Assignments
- Multiple workers can be assigned to one job
- Each assignment tracks: status (pending/accepted/declined), hourly rate override, travel start time, arrival time, primary flag
- Workers receive push notification + email when assigned
- Accept/decline flow for team members

### Recurring Jobs
**Configuration:**
- Pattern: Daily, Weekly, Fortnightly, Monthly, Quarterly, Yearly
- Auto-generation: System creates the next job instance based on schedule
- Template preservation: each generated job copies the template's checklist, assignment, and details
- Managed via `/recurring-jobs` page with a list of all templates

### How It Interconnects
- Jobs link to: Clients, Quotes, Invoices, Time Entries, Expenses, Team Assignments, GPS Check-ins, Photos, Chat Messages, SWMS Documents, Custom Forms, Calendar Events
- Job status changes trigger automations (send SMS, create invoice, notify client)
- Job completion feeds into profitability reports

---

## 5. CLIENT MANAGEMENT (CRM)

### Client List (`ClientsList.tsx`)
- Searchable, sortable table/card view
- Columns: Name, Phone, Email, Jobs count, Revenue total, Last job date
- Bulk actions: Export CSV, Send bulk SMS

### Client Detail View (`ClientDetailView.tsx`)
**Sections:**
1. **Contact Info** - Name, email, phone, address, ABN, notes
2. **Job History** - All jobs for this client with status filters
3. **Financial Summary** - Total invoiced, paid, outstanding balance
4. **Documents** - All quotes and invoices sent to this client
5. **Communication Log** - SMS and email history
6. **Notes** - Internal notes about the client

### Client Creation
- Standalone form at `/clients/new`
- Inline creation during job/quote/invoice creation
- Auto-created when converting a lead

### Client Data Fields
- Name, Email, Phone, Address (with geocoding)
- ABN (for business clients)
- Notes, Tags
- Xero Contact ID (for accounting sync)
- Communication preferences

### How It Interconnects
- Clients are referenced by: Jobs, Quotes, Invoices, Leads, SMS Conversations
- Client address auto-fills into job address
- Client phone enables two-way SMS via the Chat system
- Client portal access is token-based (no login required for the client)

---

## 6. LEADS PIPELINE

### Lead Sources
| Source | How Leads Arrive |
|--------|-----------------|
| AI Receptionist | Vapi captures caller details during phone calls |
| Phone Call | Manual entry by the tradie |
| Email | Manual entry |
| Website | Manual entry |
| Referral | Manual entry |

### Lead Statuses
```
New → Contacted → Quoted → Won
                          → Lost
```

### Leads Page (`Leads.tsx`)
**Layout:**
1. **KPI Cards (top)** - New count, Contacted count, Quoted count, Won count, Pipeline value ($)
2. **Search & Filter** - Text search + status filter (click KPI card to filter)
3. **Overdue Alert Banner** - Shows count of leads with past-due follow-ups
4. **Lead Cards** - Each card shows:
   - Source icon (phone/email/AI bot/etc.)
   - Lead name + status badge
   - Description (2-line clamp)
   - Clickable phone (tel: link) and email (mailto: link)
   - Estimated value in trade color
   - Follow-up date (with overdue/today highlighting)
   - Time ago created
   - **Footer actions:** Quick next-status button (e.g., "Contacted"), Convert button
   - Dropdown menu: Edit, Convert, Move to any status, Delete

### Lead Conversion
**Dialog shows:**
1. Lead summary card (name, phone, email, source, value)
2. Options:
   - Book an inspection first (creates inspection job)
   - Create a job (default)
   - Create a quote
3. On conversion: creates Client record, marks lead as "Won", optionally creates Job/Quote/Inspection

### Spam Protection
- Same phone number limited to 1 lead per hour (rate-limited in `vapiService.ts`)
- Duplicate callers within 1 hour are linked to existing lead instead of creating new one

### Smart Sorting
- Overdue follow-ups surface first
- Then by pipeline stage (New → Contacted → Quoted → Won → Lost)
- Then by newest first within each stage

### How It Interconnects
- AI Receptionist calls auto-create leads
- Lead conversion creates Clients, Jobs, and/or Quotes
- Leads feed into pipeline value metrics in Reports
- SMS notifications sent to owner when new AI lead arrives

---

## 7. QUOTES SYSTEM

### Live Quote Editor (`LiveQuoteEditor.tsx`)
**Split-screen layout:** Editor on left, live PDF preview on right (desktop). Stacked on mobile.

**Editor Fields:**
- Client selector (or create new)
- Quote number (auto-generated with configurable prefix, e.g., Q-001)
- Title and description
- Line items: description, quantity, unit price, GST toggle per item
- Discount (percentage or fixed amount)
- Deposit required (percentage or fixed)
- Validity period (days)
- Terms and conditions (customizable templates)
- Notes section
- Template selection (Professional, Modern, Minimal)
- Accent color override

### Multi-Option Quotes
- Create multiple tiers within one quote (e.g., "Basic $500" vs "Premium $1,200")
- Mark one option as "Recommended" (highlighted with star in portal)
- Client selects their preferred option in the portal
- Selected option updates the quote total

### Quote Lifecycle
```
Draft → Sent → Viewed → Accepted (with signature) → Converted to Invoice
                      → Declined
                      → Expired
```

### Sending Quotes
- **Email:** Branded HTML email with "View Quote" button linking to portal
- **SMS:** Short link sent via Twilio (e.g., `/q/abc123`)
- **PDF Download:** ATO-compliant PDF generated via Puppeteer

### Quote Acceptance Portal
- Client views professional branded quote
- Reviews line items and total
- Signs with finger/stylus on `SignaturePad`
- If deposit required, prompted to pay via Stripe
- Acceptance triggers notification to owner + automation rules

### AI Quote Generation
- Owner describes job in plain text (e.g., "Install 3 downlights in kitchen")
- OpenAI generates line items with quantities and prices
- Owner reviews and adjusts before sending

### Catalog Integration
- Pre-defined services and materials can be added from a catalog
- Catalog items have set prices that auto-populate

### How It Interconnects
- Quotes link to: Jobs, Clients, Invoices
- Accepted quote can auto-create a Job (via automation)
- Quote can be converted to Invoice with one click
- Quote acceptance triggers SMS/email notifications
- Quote data feeds into Reports (conversion rate, pipeline value)

---

## 8. INVOICES & BILLING

### Live Invoice Editor (`LiveInvoiceEditor.tsx`)
Same split-screen live-preview design as quotes.

**Fields:**
- Client, invoice number (auto-incrementing with prefix)
- Due date (configurable default: 7, 14, 30 days)
- Line items with GST
- Payment terms
- Bank details (pre-filled from business settings)
- "Pay Now" button toggle (enables online Stripe payment)
- Time tracking data import (auto-calculates labour from job timers)
- Deposit/progress payment tracking

### Invoice Creation Paths
| Source | How It's Created |
|--------|-----------------|
| From Job | "Create Invoice" button on job detail. Pre-fills labour + materials |
| From Quote | "Convert to Invoice" on accepted quote. Copies all line items |
| From Time Tracking | "Create Invoice from Time Tracking" on completed job |
| Standalone | New invoice from scratch at `/invoices/new` |
| Recurring | Auto-generated from recurring invoice template |

### Invoice Lifecycle
```
Draft → Sent → Viewed → Paid (full) → Receipt generated
                       → Partially Paid (deposit/progress)
                       → Overdue (past due date)
```

### Payment Methods Tracked
- Online (Stripe) - automatically marked paid via webhook
- Bank Transfer - manually marked as paid
- Cash - manually marked as paid
- Card (in-person) - via Stripe Terminal/Tap-to-Pay

### Deposit & Progress Invoices
- First invoice can require a deposit (% or fixed)
- Progress invoices track partial payments
- System shows remaining balance and payment history

### Recurring Invoices
- Templates with patterns: Weekly, Fortnightly, Monthly, Quarterly, Yearly
- Auto-generates new draft invoice on schedule
- Copies all line items and updates dates

### PDF Generation
- Server-side rendering via Puppeteer
- ATO-compliant format:
  - "Tax Invoice" label (if GST registered)
  - ABN displayed
  - GST breakdown per line item
  - Business logo and branding
  - Payment instructions
- Optional: includes before/after photos and GPS-verified labour summary

### How It Interconnects
- Invoices link to: Jobs, Quotes, Clients, Receipts, Payments, Expenses
- Payment received triggers: receipt generation, status update, automation rules
- Overdue invoices appear in Action Center
- Invoice data feeds into Reports, Profitability, and Cashflow metrics

---

## 9. PAYMENTS (STRIPE)

### Stripe Connect (Merchant Onboarding)
**Flow:**
1. Owner clicks "Connect Stripe" in Settings or Onboarding
2. Server creates Express Connect account (country: AU)
3. Owner completes Stripe's hosted identity verification
4. Once `charges_enabled`, business can accept payments
5. Platform takes 2.5% fee (min $0.50) per transaction

### Payment Collection Methods
| Method | How It Works | Where |
|--------|-------------|-------|
| Online Invoice Payment | Stripe Checkout session, client pays via link | Client Portal `/portal/invoice/:token` |
| Quick Collect | One-tap payment collection on job completion | Job Detail View |
| Tap-to-Pay | Phone becomes payment terminal (Stripe Terminal SDK) | Mobile app `/collect-payment` |
| QR Code / Scan & Pay | Generate QR code, client scans to pay | Payment Hub |
| Deposit on Quote | Client pays deposit when accepting quote | Quote Portal |

### Payment Hub (`PaymentHub.tsx`)
**Sections:**
1. **Balance Overview** - Available balance, pending payouts
2. **Outstanding Invoices** - List with one-tap reminder sending
3. **Payment Chaser** - AI-powered smart reminders for overdue invoices
4. **Transaction History** - All payments with status and amounts
5. **Payout Schedule** - When Stripe will deposit funds

### Payment Flow (End-to-End)
```
Owner creates Invoice ($1,000)
  → Sends to client via email/SMS with payment link
  → Client clicks link → Stripe Checkout page
  → Client pays $1,000
  → Stripe processing fee deducted (~$17)
  → JobRunner platform fee deducted ($25, 2.5%)
  → Owner receives ~$958 in next payout
  → Invoice auto-marked as "Paid"
  → Receipt auto-generated
  → Client receives receipt email
  → Automation rules trigger (e.g., send review request)
```

---

## 10. TIME TRACKING & PAYROLL

### Timer System
**Web:** Timer button on job detail view
**Mobile:** Prominent timer widget on dashboard + job screens

**Features:**
- Start/stop timer per job per worker
- GPS coordinates captured at clock-in and clock-out
- Automatic break detection
- Time categories: Work, Travel, Admin
- Billable/non-billable toggle
- Manual time entry (with edit audit log)
- Multiple timers possible (only one active at a time per worker)

### Time Tracking Page (`TimeTrackingPage.tsx`)
**Sections:**
1. **Active Timers** - Currently running timers across the team
2. **Timesheet View** - Daily/weekly breakdown by worker
3. **Job Breakdown** - Time allocated per job
4. **Manual Entry** - Add time entries after the fact
5. **Export** - CSV export for payroll

### Time Entry Fields
- Worker, Job, Start time, End time, Duration
- Category (work/travel/admin), Billable flag
- Clock-in GPS coordinates, Clock-out GPS coordinates
- Notes, Edit history

### Audit Trail
- Every time entry edit is logged in `time_edit_audit_log`
- Shows: who edited, what changed, old vs new values, timestamp
- Accessible at `/audit-log` for owners/managers

### Stale Timer Detection
- Background scheduler runs every 30 minutes
- Detects timers running > 12 hours without activity
- Sends notification to owner about potential forgotten timers

### Time → Invoice Flow
- Job detail shows per-worker labour breakdown
- "Create Invoice from Time Tracking" button auto-fills invoice line items
- Each worker's hours × rate = cost line item
- Total labour cost calculated and displayed before invoice creation

### How It Interconnects
- Time entries link to: Jobs, Workers, Invoices
- Time data feeds into: Payroll Reports, Profitability Reports, Job Costing
- GPS data from timers feeds into: Location Tracking, Geofence verification
- Active timer shown on: Dashboard widget, Job detail, Map markers

---

## 11. GPS & LOCATION TRACKING

### Architecture
- **Mobile:** `expo-location` background task updates every 30 seconds or 50m movement
- **Server:** WebSocket broadcast to all team members in same business
- **Web:** Real-time map updates without page refresh

### Features
| Feature | Description |
|---------|-------------|
| Live Team Map | Real-time markers showing all team members on a map |
| Activity Detection | Stationary, Walking, Driving (derived from GPS speed) |
| Speed Display | Shows km/h badge on driving workers |
| Battery Monitoring | Low battery indicator (<30%) on map markers |
| Heading Arrows | Directional indicator for moving workers |
| Job Proximity | Shows which workers are closest to a job site |

### Geofencing
- Circular regions (configurable radius, default 100m) around job addresses
- Auto-registered when jobs are scheduled or in progress
- **On Enter:** Triggers "Arrived at Job" notification to owner
- **On Exit:** Triggers "Left Job Site" notification to owner
- Can auto-start/stop timers (via Autopilot settings)

### Privacy Controls
| Control | Who Sets It | What It Does |
|---------|------------|-------------|
| GPS Opt-Out | Worker (mobile settings) | Completely disables all tracking |
| Location Access | Owner (per team member) | Owner can disable tracking for specific workers |
| After Hours Ghost Mode | Owner (per team member) | Hides location outside work hours |
| Work Hours Config | Owner (per team member) | Set start/end time + work days |
| Active Timer Override | Automatic | Ghost mode disabled if worker has running timer (emergency callout) |
| Subcontractor Scope | Automatic | Subs only tracked during active job assignments |

### Running Late Detection
- System compares current time vs scheduled job start
- If no check-in (manual or geofence) detected, flags as potentially late
- Notifies owner via push notification

### ETA & Routing
- Uses OSRM (Open Source Routing Machine) for ETA calculations
- Shows estimated drive time from current location to next job
- Powers the "Track Arrival" client page

### How It Interconnects
- Location data feeds into: Team Map, Dispatch Board, Client Portal (live tracking), Running Late alerts
- Geofence events trigger: Notifications, Timer automation, Activity logs
- GPS coordinates attached to: Time entries (clock-in/out), Job check-ins, Photos

---

## 12. TEAM MANAGEMENT

### Team Operations (`TeamOperations.tsx`)
**Tabs:**
1. **Team Members** - List of all members with status, role, contact info
2. **Live Map** - Real-time GPS positions of the team
3. **Dispatch Board** - Drag-and-drop job assignment interface
4. **Roles & Permissions** - RBAC configuration

### Roles & Permissions System
| Role | Default Permissions |
|------|-------------------|
| Owner | Everything |
| Manager | All operations, team management, reports |
| Office Admin | Clients, quotes, invoices, scheduling (no GPS) |
| Worker | View assigned jobs, time tracking, photos, chat |
| Subcontractor | View assigned jobs only, submit photos/notes |

**Granular Permissions (30+):**
- View/Create/Edit/Delete for: Jobs, Quotes, Invoices, Clients
- Time Tracking, GPS Check-in, Team Chat, Send SMS
- View Reports, Manage Team, Manage Settings
- Custom permission sets per team member

### Team Member Invite Flow
1. Owner enters email + role + hourly rate
2. System sends invite email with unique link
3. Worker clicks link → registers account → auto-joins team
4. OR: Worker enters 6-character invite code during registration

### Team Member Card (in Team Management)
Each member shows:
- Name, email, role, hourly rate
- Status (Active, Pending invite, Declined)
- Start date
- Location Access toggle
- After Hours Privacy toggle (with work hours config when enabled)
- Quick actions: Edit permissions, Remove, Resend invite

### Work Hours & Ghost Mode (per member)
- Configurable start time (default 07:00) and end time (default 17:00)
- Day selector (Sun-Sat, default Mon-Fri)
- When enabled, location hidden outside work hours
- Active timer on any job overrides ghost mode (emergency callout support)

### Team Groups / Crews
- Create named groups (e.g., "North Team", "Electrical Crew")
- Assign team members to groups
- Filter map and dispatch by group
- Assign groups to jobs

### Team Presence
- Real-time status: Online, On Job, Driving, Idle, Offline
- Last seen timestamp
- Current job name (if on a job)
- Battery level indicator

### How It Interconnects
- Team members link to: Job Assignments, Time Entries, Location Data, Chat, Permissions
- Role permissions control: what pages are visible, what actions are available, what data is shown
- Team data feeds into: Payroll Reports, Dispatch Board, GPS Map

---

## 13. COMMUNICATION (SMS, CHAT, EMAIL)

### Two-Way SMS (Twilio)
**How it works:**
1. Business has a dedicated Australian mobile number (purchased through JobRunner)
2. Owner sends SMS to client from job detail, chat, or invoice reminder
3. Client replies to that number
4. Smart routing matches reply to correct business + client + job
5. Reply appears in Chat Hub and triggers push notification

**Smart Routing Logic:**
- Matches `From` number to known client phone
- If client has multiple active jobs, sends disambiguation menu via SMS
- Handles multi-business scenarios (shared platform number)

**Automated SMS Keyword Detection:**
- Client replies "YES" or "ACCEPT" to quote SMS → auto-accepts quote
- System detects intent and triggers appropriate status change

**Quick Action SMS Templates:**
- "On my way" - includes ETA
- "Running late" - includes revised ETA
- "Job finished" - includes summary

### Team Chat (WebSocket)
**Chat Types:**
| Type | Description |
|------|-------------|
| Job Chat | Everyone assigned to a job can message. Photos shareable. |
| Team Chat | Broadcast channel for the whole business |
| Direct Messages | 1:1 between any two team members |
| Client SMS | Two-way SMS thread with a client |

**Real-time features:**
- Typing indicators
- Read receipts
- File/photo sharing
- @mentions
- Push notifications for new messages

### ChatHub (`ChatHub.tsx`)
**Tabs:**
1. **Jobs** - Chat threads organized by job
2. **Team** - Team-wide broadcast + DMs
3. **Enquiries** - Unassigned SMS from unknown numbers

### Communications Hub (`CommunicationsHub.tsx`)
- Audit trail of all outbound/inbound communications
- Filters: Email, SMS, type, date range
- Delivery status tracking (sent, delivered, failed, bounced)
- Message history per client

### Email
- **SendGrid** for transactional emails (quotes, invoices, reminders)
- Branded HTML templates with business logo and colors
- Fallback to connected Gmail/Outlook for deliverability
- Email tracking (sent, opened)

### How It Interconnects
- SMS threads link to: Clients, Jobs
- Chat messages link to: Jobs, Team Members
- Communication logs feed into: Client history, Audit trail
- Automated SMS triggered by: Job status changes, Quote/Invoice sending, Automation rules

---

## 14. AI RECEPTIONIST (VAPI)

### Overview
AI-powered virtual assistant that answers business phone calls 24/7 using natural Australian voices.

### Configuration Page (`AIReceptionist.tsx`)
**Settings:**
- Master enable/disable toggle
- Voice selection: Jess (female), Harry (male), Chris (male) — all Australian accents via ElevenLabs
- Custom greeting message
- Business hours (start/end time, active days, timezone)
- Mode selection:
  - **After Hours Only** - AI answers when business is closed
  - **Always On (Transfer)** - AI answers all calls, transfers to available team member
  - **Always On (Message)** - AI answers all calls, always takes a message
  - **Selective** - AI answers, transfers only if caller is a known client
- Transfer numbers with priority ordering
- SMS notifications toggle (sends summary after each call)
- Knowledge Bank (FAQs, services, pricing info injected into AI context)

### Call Handling Flow
```
Phone rings → Vapi AI answers
  → AI identifies caller intent
  → AI checks if caller is existing client (lookup_client tool)
  → AI captures details (capture_lead tool):
     - Name, phone, email, job type, address, urgency
  → If transfer mode:
     → Check business hours (isWithinBusinessHours)
     → Find available team member (transfer_call tool)
     → Transfer or take message
  → Call ends → end-of-call report webhook
  → System creates/updates Lead
  → SMS notification sent to owner
  → In-app notification created
  → Call logged with transcript, recording, cost
```

### AI Tools (Function Calling)
| Tool | What It Does |
|------|-------------|
| capture_lead | Saves caller details as a new lead |
| check_availability | Checks team/business hour availability |
| lookup_client | Searches existing clients by phone/name |
| create_booking | Creates a tentative booking (saved as lead) |
| transfer_call | Forwards call to an available human |

### Call Logs Page (`AIReceptionistCalls.tsx`)
- List of all AI calls with: duration, cost, recording player, summary, outcome
- Outcome categories: Message Taken, Transferred, Booked, Missed
- Click to view full transcript
- "View Lead" button links to the lead created from that call

### Spam Protection
- Same phone number rate-limited to 1 lead per hour
- Duplicate callers linked to existing lead
- Applied in both `handleCaptureLead` and `handleEndOfCallReport`

### How It Interconnects
- AI calls create: Leads (with "ai_receptionist" source)
- Leads can be converted to: Clients + Jobs
- Call data feeds into: Call logs, Activity feed, SMS notifications
- Business hours config shared with: Automation scheduling

---

## 15. SCHEDULING & CALENDAR

### Schedule Page (`SchedulePage.tsx`)
**Views:**
- **Day View** - Hourly timeline showing jobs and team assignments
- **Week View** - 7-day overview
- **Agenda View** - List of upcoming jobs sorted by date
- **Team View** - Side-by-side columns per team member

### Dispatch Board (`DispatchBoard.tsx`)
- Split view: unassigned jobs on left, team members on right
- Drag-and-drop job assignment
- Shows each worker's current load and availability
- Color-coded by job priority
- Real-time status updates via WebSocket

### Google Calendar Sync
- Two-way sync: JobRunner jobs appear in Google Calendar
- Calendar events created when job is scheduled
- Updates propagated when job times change
- Requires Google OAuth connection

### How It Interconnects
- Schedule pulls from: Jobs (by scheduledAt), Assignments, Team availability
- Dispatch uses: Team presence (online/offline), GPS locations (proximity)
- Calendar sync links to: Google Calendar integration

---

## 16. WHS (WORK HEALTH SAFETY)

### WHS Hub (`WhsHub.tsx`)
**Tabs:**
1. **Overview** - Safety dashboard with compliance percentage, open incidents, active SWMS count
2. **SWMS** - Safe Work Method Statements
3. **Incidents** - Incident/hazard reporting
4. **Training** - Worker qualifications and license tracking
5. **Compliance** - PPE checklists, emergency plans

### SWMS (Safe Work Method Statements)
- **Builder:** Step-by-step creator with trade-specific templates
- **Templates:** Working at Heights, Electrical, Excavation, Confined Spaces, Hot Work, etc.
- **Risk Matrix:** Likelihood × Consequence = Risk Level (Low/Medium/High/Extreme)
- **AI Hazard Scan:** Upload job photos → GPT-4o Vision analyzes and suggests hazards + controls
- **Sign-off:** Digital signatures required from all workers before work starts
- **PDF Export:** Professional document for principal contractors

### Incident Reports
- Types: Near Miss, Injury, Property Damage, Environmental
- Severity: Minor, Moderate, Serious, Critical
- Capture: Description, location (GPS), photos, witnesses, treatment details
- Regulatory flags for "Notifiable Incidents" (SafeWork Australia)

### Training & Compliance
- Track: licenses, certifications, white cards, electrical licenses
- Expiry monitoring with alerts before renewal deadline
- Document upload for verification
- Per-worker compliance dashboard

### Safety Templates (`safetyTemplates.ts`)
Pre-built forms for:
- Toolbox Talks (attendance + topics)
- Site Inspections (housekeeping, electrical, height safety)
- Equipment Pre-starts (excavators, forklifts, vehicles)
- PPE Daily Checklists
- Emergency Plans

### How It Interconnects
- SWMS link to: Jobs (attached to specific jobs)
- Incident reports link to: Jobs, Workers, Locations
- Compliance data feeds into: WHS Hub dashboard metrics
- Sign-off data linked to: Worker profiles, Job documentation

---

## 17. INVENTORY & EQUIPMENT

### Inventory Management (`InventoryPage.tsx`)
**Sections:**
1. **Stock & Materials** - Consumable items with SKU, cost price, sell price, stock levels
2. **Categories** - Group items for organization
3. **Low Stock Alerts** - Items below reorder threshold
4. **Purchase Orders** - Track supplier orders (pending/approved/sent/received)
5. **Stock Adjustments** - Manual updates with transaction history

### Equipment Tracking
- **Asset Lifecycle:** Available → In Use → Maintenance → Retired/Sold
- **Maintenance Records:** Service history, costs, technician notes
- **Job Assignment:** Track which equipment is deployed to which job
- **Utilization Dashboard:** Available vs deployed vs maintenance
- **Safety Integration:** Daily pre-start inspection checklists

### How It Interconnects
- Inventory items can be added to: Quote line items, Invoice line items
- Equipment links to: Jobs (assignment), Safety forms (pre-start checks)
- Low stock alerts appear in: Action Center, Notifications

---

## 18. EXPENSES & RECEIPT SCANNING

### Expense Tracking (`ExpenseTracking.tsx`)
- Create expense entries linked to specific jobs
- Categories: Materials, Fuel, Subcontractor, Tools, Travel, Other
- Fields: Amount, vendor, date, description, receipt photo, billable flag
- Monthly spending trends
- Job costing: expenses roll up into profitability calculations

### AI Receipt Scanning
**Flow:**
1. Upload or photograph receipt
2. Image sent to OpenAI GPT-4o Vision
3. AI extracts: vendor, date, line items, subtotal, GST, total
4. Pre-fills expense form with extracted data
5. User reviews and saves
6. Australian GST automatically calculated (10%) if not explicitly detected

### How It Interconnects
- Expenses link to: Jobs (job costing), Categories
- Billable expenses can be included in: Invoices
- Expense data feeds into: Profitability Reports, Job P&L

---

## 19. AUTOMATIONS & AUTOPILOT

### Automation Rules (`Automations.tsx`)
**Trigger-Action architecture:**

**Triggers:**
| Trigger | Description |
|---------|-------------|
| status_change | When a job/quote/invoice changes status |
| time_delay | After X days from an event (positive = overdue, negative = upcoming) |
| no_response | Quote not responded to within X days |
| payment_received | Invoice payment detected |

**Actions:**
| Action | Description |
|--------|-------------|
| send_email | Automated email to client |
| send_sms | Automated SMS to client |
| create_job | Auto-create job (e.g., when quote accepted) |
| create_invoice | Auto-create invoice (e.g., when job completed) |
| update_status | Advance entity status |
| notification | Internal alert to owner |

**Example Rules:**
- "When quote is accepted → Create a job + Send confirmation SMS"
- "3 days after invoice sent → Send payment reminder email"
- "When job completed → Send review request SMS with Google link"

### Autopilot (`Autopilot.tsx`)
Simplified toggle-based interface for high-impact automations:
| Toggle | What It Does |
|--------|-------------|
| Quote Follow-ups | Auto-remind after 3 days |
| Invoice Reminders | Auto-chase overdue invoices |
| Job Reminders | SMS 24h before scheduled job |
| GPS Auto Check-in | Start/stop timers on geofence |
| Photo Requirements | Prompt for before/after photos |
| En-Route Notifications | SMS client when worker starts driving |
| Review Requests | Google Review link after payment |
| Daily Summary Email | Morning digest of today's schedule + overdue items |

### Service Reminders (`ServiceReminders.tsx`)
- Track maintenance cycles (e.g., "Annual AC Service for Smith residence")
- When completed, auto-schedule next occurrence
- SMS/email reminder sent before next service date
- Intervals: Monthly, Quarterly, 6-Monthly, Yearly, Custom

### Email Lifecycle
- Internal onboarding nurture sequence for new users
- Day 3: "Add your first client"
- Day 7: "Send your first quote"
- Day 14: "Upgrade to Pro"
- Engagement-based triggers

### How It Interconnects
- Automations trigger from: Job/Quote/Invoice status changes, Timer events, Geofence events
- Automations create: Emails, SMS, Jobs, Invoices, Notifications
- Service reminders link to: Clients, Jobs
- Autopilot settings affect: GPS behavior, Photo prompts, Communication

---

## 20. REPORTS & INSIGHTS

### Reports Page (`Reports.tsx`)
**KPIs:**
- Total Revenue, Pending Revenue, Overdue Amount, GST Collected
- Total Jobs, Completed vs In-Progress
- Quote conversion rate (accepted/total)
- Invoice metrics (paid/unpaid/overdue counts)

**Charts:**
- Monthly Revenue (bar chart) - Revenue vs GST vs invoices paid
- Job Status Distribution (pie chart)
- Stripe payments/payouts breakdown

### Profitability Report (`ProfitabilityReport.tsx`)
**KPIs:**
- Net Profit = Revenue - (Labour + Materials + Subcontractors + Expenses)
- Average Margin (percentage)
- Job Performance breakdown (profitable/tight/loss)

**Charts:**
- 12-month Profit Trend (area chart) - Revenue, Costs, Profit overlaid
- Margin badges: Green (>15%), Amber (5-15%), Red (<5%)
- Per-job breakdown with expandable cost details

### Payroll Reports (`PayrollReports.tsx`)
- Total hours & gross pay per worker
- Billable vs non-billable utilization rate
- Receivables aging buckets (1-30, 31-60, 61-90, 90+ days)
- Worker efficiency comparison

### Insights Page (`Insights.tsx`)
**"Business Health" with 4 tabs:**
1. **Profit** - Gross margin gauge, cost breakdown, revenue trends
2. **Cashflow** - Cash collected today, current month vs last month comparison
3. **Efficiency** - Quote-to-job conversion, average job duration
4. **Growth** - New clients, revenue growth rate

### Action Center (`ActionCenter.tsx`)
**Operational task hub:**
- **Fix Now** - Overdue invoices, uninvoiced completed jobs, unanswered quotes
- **This Week** - Upcoming deadlines, expiring quotes, scheduled follow-ups
- **Suggestions** - Revenue leak detection (e.g., "5 completed jobs worth $4,200 have no invoice")
- Batch actions: "Create X Invoices", "Send X Reminders"

### How It Interconnects
- Reports pull from: Invoices, Jobs, Time Entries, Expenses, Quotes
- Action Center surfaces items from: all financial entities
- Insights compute from: all historical data with time comparisons

---

## 21. CLIENT-FACING PORTALS

### Client Portal (`/portal/:type/:token`)
- **Quote View:** Professional branded view, line items, sign + accept, deposit payment
- **Invoice View:** Line items, payment status, "Pay Now" button (Stripe)
- **Receipt View:** Payment confirmation with PDF download
- No login required (token-based access)
- Short links: `/q/:token`, `/i/:token`

### Job Portal (`/job-portal/:token` or `/p/:token`)
- Live job status timeline (Scheduled → En Route → Arrived → Working → Done)
- Real-time tradesperson location on map (when en route)
- Photo gallery showing work progress
- Direct messaging to tradesperson
- Linked documents (quotes, invoices)

### Track Arrival (`/track/:token`)
- "Uber-style" live tracking when tradesperson is on the way
- Map with real-time position updates (10-second polling)
- ETA display
- Branded with business colors/logo

### Subcontractor Web View (`/s/:token`)
- For external subs without full JobRunner accounts
- OTP verification (SMS code to sub's phone)
- View assigned jobs, accept/decline
- Update status (En Route, Arrived, Working, Done)
- Upload photos and notes
- GPS tracking while on job

### How It Interconnects
- Portals read from: Quotes, Invoices, Jobs, Location data
- Client actions in portal trigger: Status updates, Notifications, Payment processing
- Subcontractor actions trigger: Notifications to owner, Status updates

---

## 22. INTEGRATIONS

### Connected Services
| Service | Purpose | Status |
|---------|---------|--------|
| Stripe Connect | Accept payments, payouts | Fully implemented |
| Stripe Terminal | Tap-to-pay card reading | Backend ready, frontend stub |
| Twilio | SMS/MMS/Voice | Fully implemented |
| Vapi.ai | AI voice assistant | Fully implemented |
| SendGrid | Transactional email | Fully implemented |
| OpenAI | AI features (quotes, receipts, safety, chat) | Fully implemented |
| Google OAuth | Sign in with Google | Fully implemented |
| Google Calendar | Two-way calendar sync | Fully implemented |
| Apple Sign-In | iOS authentication | Fully implemented |
| Xero | Accounting sync (invoices, contacts) | Fully implemented |
| MYOB | Accounting sync | Planned/stub |
| QuickBooks | Accounting sync | Planned/stub |
| Google Maps | Geocoding, autocomplete | Fully implemented |
| OSRM | Route planning, ETA | Fully implemented |

### Integrations Page (`Integrations.tsx`)
- Status indicators for each connected service
- One-click connect/disconnect
- Sync status and last sync time for accounting tools

---

## 23. SETTINGS & CONFIGURATION

### Settings Tabs
| Tab | Available To | What It Controls |
|-----|-------------|-----------------|
| My Account | Everyone | Profile, avatar, theme color, password |
| Business Profile | Owner/Manager | Business name, ABN, logo, brand colors, address |
| Documents | Owner/Manager | Quote/Invoice prefixes, payment terms, T&C templates |
| Communication | Owner/Manager | SMS mode, business hours, notification preferences |
| Compliance | Owner | License numbers, insurance, regulatory registrations |
| Billing | Owner | Subscription plan, payment method, usage stats |
| Integrations | Owner | Xero, Stripe, Google Calendar connections |
| Team | Owner | Member management, roles, permissions |
| GPS Privacy | Worker | GPS opt-out toggle (mobile only) |

### Australian-Specific Configuration
- ABN validation
- GST toggle (10% rate)
- State regulators: QBCC (QLD), VBA (VIC), Fair Trading (NSW/SA/WA/TAS/NT/ACT)
- Australian phone number formatting
- AUD currency formatting

---

## 24. SUBSCRIPTION & BILLING

### Tiers
| Feature | Free | Pro ($39/mo) | Team ($49/mo + $29/seat) |
|---------|------|-------------|------------------------|
| Jobs per month | 25 | Unlimited | Unlimited |
| Clients | 50 | Unlimited | Unlimited |
| Team members | 0 | 0 | Unlimited (per seat) |
| Quotes & Invoices | Unlimited | Unlimited | Unlimited |
| Online payments | Yes | Yes | Yes |
| AI features | Basic | Full | Full |
| GPS tracking | No | No | Full |
| Team chat | No | No | Full |
| Automations | No | Full | Full |
| Reports | Basic | Full | Full |

### Add-ons
| Add-on | Price | Description |
|--------|-------|-------------|
| AI Receptionist | $60/mo | AI phone answering with dedicated number |
| Dedicated Number | $5/mo | Own Australian mobile number for SMS |
| Custom Website | Custom | Managed website for the business |

### Trial System
- 30-day free trial of Pro/Team features
- No credit card required to start
- Automatic downgrade to Free after trial expires
- Granular feature gating based on tier

---

## 25. MOBILE-SPECIFIC FEATURES

### Navigation
- **Bottom Tabs:** Dashboard, Work (Jobs), Chat, More
- **"More" Hub:** Grid of all features organized by category
- **Tablet Mode:** Sidebar navigation for iPads

### Mobile-Only Features
| Feature | Description |
|---------|-------------|
| Background GPS Tracking | Location updates every 30s in background |
| Geofence Auto Check-in | Automatic job arrival detection |
| Camera Integration | Photo capture for jobs, receipts, safety |
| Push Notifications | Real-time alerts for all events |
| Offline Support | Queue actions when offline, sync when reconnected |
| Weather Widget | Local weather on dashboard |
| Tap-to-Pay | Phone as payment terminal (pending Apple approval) |
| Biometric Auth | Face ID / fingerprint login |
| Deep Linking | Open specific jobs/invoices from notifications/emails |

### Mobile Onboarding
- Role-based setup (Owner vs Worker vs Subcontractor)
- Worker: enters invite code → immediately sees assigned jobs
- Owner: full business setup wizard

---

## 26. ADMIN PANEL

### Admin Dashboard (`/admin`)
**For platform administrators only:**
- Total users, businesses, jobs, invoices across the platform
- Revenue metrics (MRR, churn rate)
- User management (search, suspend, impersonate)
- Beta account management
- System health monitoring
- Demo data management

### Admin Actions
- Grandfather beta accounts (set lifetime free access)
- Toggle IS_BETA flag
- View platform-wide analytics
- Manage subscription overrides

---

## 27. FEATURE INTERCONNECTION MAP

### The "Life of a Job" Flow
```
LEAD CAPTURE
  AI Receptionist call → Lead created (ai_receptionist source)
  Manual entry → Lead created (phone/email/referral source)
      ↓
LEAD CONVERSION
  Owner reviews lead → Clicks "Convert"
  → Client record created
  → Job created (or Quote or Inspection)
  → Lead marked as "Won"
      ↓
JOB SCHEDULING
  Job assigned to worker(s)
  Scheduled date/time set
  Google Calendar event created
  Geofence registered around job address
  24h reminder SMS sent to client (automation)
      ↓
EN ROUTE
  Worker taps "On My Way"
  GPS tracking begins (or was already running)
  Client receives SMS with tracking link
  Client sees live location on Track Arrival page
      ↓
ON SITE
  Geofence triggers "Arrived" notification
  Timer auto-starts (if Autopilot enabled)
  Worker completes SWMS sign-off
  Before photos uploaded
      ↓
WORKING
  Timer running, GPS tracking active
  Job chat for coordination
  Checklist items completed
  Variations/change orders submitted if needed
      ↓
JOB COMPLETE
  Worker marks job as done
  Timer stops, hours calculated
  After photos uploaded
  Owner reviews time tracking summary
  "Create Invoice" button available
      ↓
INVOICING
  Invoice auto-filled from time tracking + materials
  Sent via email + SMS with payment link
  Client views in portal
      ↓
PAYMENT
  Client pays via Stripe Checkout
  Invoice marked as "Paid" automatically
  Receipt generated and emailed
  Platform fee deducted
  Tradie receives payout
      ↓
POST-JOB
  Review request SMS sent (automation)
  Service reminder scheduled if recurring
  Profitability calculated for reports
  Activity logged in client history
```

### Data Flow Diagram
```
              ┌─────────┐
              │  LEADS   │
              └────┬─────┘
                   │ convert
              ┌────▼─────┐
              │ CLIENTS  │
              └────┬─────┘
                   │
              ┌────▼─────┐         ┌──────────┐
              │   JOBS   │◄────────│ RECURRING │
              └──┬──┬──┬─┘         └──────────┘
                 │  │  │
    ┌────────────┘  │  └────────────┐
    ▼               ▼               ▼
┌────────┐    ┌──────────┐    ┌──────────┐
│ QUOTES │    │   TIME   │    │ EXPENSES │
└───┬────┘    │ TRACKING │    └────┬─────┘
    │         └────┬─────┘         │
    │              │               │
    ▼              ▼               ▼
┌────────────────────────────────────┐
│           INVOICES                  │
└──────────────┬─────────────────────┘
               │
               ▼
┌──────────────────────┐
│     PAYMENTS         │
│  (Stripe Connect)    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   RECEIPTS +         │
│   REPORTS +          │
│   PROFITABILITY      │
└──────────────────────┘
```

---

## 28. COMPETITIVE ADVANTAGES

### vs Tradify ($49/mo)
| Feature | JobRunner | Tradify |
|---------|----------|--------|
| AI Receptionist | Yes (Vapi.ai, Australian voices) | No |
| Live GPS Team Tracking | Yes (Life360-style) | No |
| Two-Way SMS with Clients | Yes (Twilio, smart routing) | Basic SMS |
| AI Receipt Scanning | Yes (GPT-4o Vision) | No |
| AI Quote Generation | Yes | No |
| Client Job Portal (live tracking) | Yes (Uber-style) | No |
| Multi-Option Quotes | Yes | No |
| WHS/Safety Module | Yes (SWMS, JSA, AI hazard scan) | No |
| Geofence Auto Check-in | Yes | No |
| After Hours Ghost Mode | Yes | No |
| Subcontractor Portal (OTP) | Yes | No |
| Action Center (revenue leaks) | Yes | No |
| Built-in Team Chat | Yes (WebSocket real-time) | No |
| Price (Solo) | $39/mo | $49/mo |

### vs ServiceM8 ($29-$379/mo)
| Feature | JobRunner | ServiceM8 |
|---------|----------|-----------|
| AI Receptionist | Yes | No |
| AI Receipt Scanning | Yes | No |
| Multi-Option Quotes | Yes | No |
| Live Client Tracking | Yes | No |
| WHS/Safety Module | Full suite | Basic forms |
| Real-time Team Chat | Yes | No |
| Subcontractor OTP Portal | Yes | Basic |
| Profitability Reports | Yes | Basic |
| Price (Solo) | $39/mo | $29-$149/mo |

### vs Fergus ($59-$149/mo)
| Feature | JobRunner | Fergus |
|---------|----------|--------|
| AI Receptionist | Yes | No |
| GPS Team Tracking | Life360-style with privacy controls | Basic |
| AI Features | 5+ AI tools | No |
| Mobile-First Design | Yes | Desktop-first |
| Price (Team 5) | $195/mo | $295/mo |

### Unique to JobRunner
1. **AI Receptionist** - No competitor has AI phone answering with Australian voices
2. **Client Live Tracking** - Uber-style "watch your tradie arrive" experience
3. **AI Hazard Scan** - Upload job photo, AI identifies safety risks
4. **Revenue Leak Detection** - Action Center surfaces uninvoiced work
5. **Smart SMS Routing** - Automatic client/job matching for two-way SMS
6. **After Hours Ghost Mode** - GPS privacy with emergency override
7. **Integrated Safety Suite** - SWMS + JSA + Incidents + Training in one platform
8. **Subcontractor OTP Portal** - External subs can update jobs without an account

---

## 29. HONEST ASSESSMENT & GAPS

### Strengths
1. **Feature density is exceptional.** More features than any single competitor at a lower price point.
2. **AI integration is genuinely useful,** not gimmicky. Receipt scanning, quote generation, hazard detection, and AI receptionist all solve real pain points.
3. **Mobile-first done right.** The mobile app has feature parity with web for field operations.
4. **Australian-specific.** ABN, GST, QBCC, SafeWork compliance built-in from the start.
5. **Privacy-conscious GPS.** Ghost mode, opt-out, and work hours controls are ahead of the market.
6. **End-to-end flow is complete.** Lead → Job → Quote → Invoice → Payment → Receipt → Review is fully automated.

### Areas That Need Attention

**Architecture:**
- `server/routes.ts` is ~48,000 lines in a single file. This is a maintenance risk. Should be split into domain-specific route files.
- `IS_BETA = true` bypasses all subscription checks. Must be set to `false` before charging customers.
- Vapi webhook lacks signature verification when `VAPI_WEBHOOK_SECRET` is not set.

**Feature Completeness:**
- **Tap-to-Pay** is stubbed out on mobile pending Apple production approval. Backend is ready.
- **MYOB and QuickBooks** integrations are planned but not implemented.
- **Offline mode** on mobile is limited. Some actions queue, but full offline-first architecture is not in place.
- **Search** is basic text matching. No fuzzy search or full-text search engine.

**Design & UX:**
- Some pages are information-dense and could benefit from progressive disclosure on mobile.
- Settings page has many tabs that can overwhelm new users.
- The "More" hub on mobile is a grid of icons that may not be immediately discoverable for new features.

**Testing:**
- No automated test suite exists. All testing is manual.
- No CI/CD pipeline defined.

**Documentation:**
- No user-facing help docs or knowledge base.
- No API documentation for potential third-party integrations.

**Scalability:**
- Single-server architecture. No horizontal scaling strategy defined.
- Background schedulers (10+) all run in the main process.
- WebSocket connections are in-memory (no Redis pub/sub for multi-server).

### What Should Be Prioritized
1. Set `IS_BETA = false` and run grandfather script before accepting paying customers
2. Add Vapi webhook signature verification
3. Split `routes.ts` into domain modules (won't change functionality but prevents maintenance nightmares)
4. Complete Tap-to-Pay mobile implementation when Apple approval arrives
5. Add user-facing help documentation
6. Implement basic automated testing

---

*Generated from full codebase audit. All features verified against source code. Last updated: April 2026.*
