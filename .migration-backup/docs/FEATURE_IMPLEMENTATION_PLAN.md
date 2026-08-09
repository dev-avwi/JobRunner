# JobRunner Feature Implementation Plan
## Closing ALL Competitor Gaps

This document outlines detailed implementation plans for every gap identified in the competitor analysis. The goal is to make JobRunner "near damn perfect" for Australian tradespeople.

---

## HIGH PRIORITY FEATURES

### 1. Weather Widget
**Source:** GoTradie Dashboard
**Benefit:** Critical for outdoor trades (roofing, building, landscaping, painting) to plan work days

#### Implementation Plan

**Database Changes:**
```typescript
// Add to shared/schema.ts
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  weatherLocation: varchar("weather_location", { length: 255 }), // e.g. "Cairns, QLD"
  weatherEnabled: boolean("weather_enabled").default(true),
  showWeatherOnDashboard: boolean("show_weather_on_dashboard").default(true),
});
```

**API Integration:**
- Use Open-Meteo API (free, no API key required)
- Endpoint: `https://api.open-meteo.com/v1/forecast`
- Cache weather data for 30 minutes to reduce API calls

**Frontend Components:**
```
client/src/components/WeatherWidget.tsx
- Displays current temp, conditions, 3-day forecast
- Rain probability warning for outdoor trades
- "Good working conditions" / "Rain expected" indicators
```

**UI Placement:**
- Dashboard header (next to greeting)
- Job detail view (for outdoor job types)
- Calendar day view

**Trade-Specific Logic:**
- Show rain warnings prominently for: Roofing, Building, Painting, Landscaping
- Show UV index for: Roofing, Concreting
- Show wind speed for: Crane work, scaffolding

**Effort:** Low (2-3 hours)
**Files to modify:** 
- `shared/schema.ts` - user preferences
- `server/routes.ts` - weather proxy endpoint
- `client/src/components/TradieDashboard.tsx` - add widget
- `client/src/components/WeatherWidget.tsx` - new component

---

### 2. Service Reminders - "Next Service Due" Field
**Source:** Tradify Service Reminders
**Benefit:** Recurring maintenance tracking (HVAC servicing, safety checks, annual inspections)

#### Implementation Plan

**Database Changes:**
```typescript
// Add to jobs table in shared/schema.ts
nextServiceDue: timestamp("next_service_due"),
serviceInterval: varchar("service_interval", { length: 50 }), // "3 months", "6 months", "12 months"
serviceReminderDays: integer("service_reminder_days").default(14), // Days before to remind
isRecurringService: boolean("is_recurring_service").default(false),
lastServiceDate: timestamp("last_service_date"),
```

**New Table:**
```typescript
export const serviceReminders = pgTable("service_reminders", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id),
  clientId: integer("client_id").references(() => clients.id),
  userId: integer("user_id").references(() => users.id),
  serviceType: varchar("service_type", { length: 100 }), // "Annual AC Service", "Fire Safety Check"
  nextDueDate: timestamp("next_due_date").notNull(),
  intervalMonths: integer("interval_months"), // 3, 6, 12
  reminderSentAt: timestamp("reminder_sent_at"),
  status: varchar("status", { length: 20 }).default("pending"), // pending, sent, completed, cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**API Endpoints:**
```
GET /api/service-reminders - List all upcoming service reminders
POST /api/service-reminders - Create new service reminder
PATCH /api/service-reminders/:id - Update reminder
DELETE /api/service-reminders/:id - Cancel reminder
POST /api/service-reminders/:id/complete - Mark as completed (creates new job)
GET /api/service-reminders/upcoming - Get reminders due in next 30 days
```

**Automation:**
- Daily cron job checks for reminders due within `reminderDays`
- Auto-send email/SMS to client: "Your [service type] is due on [date]"
- Dashboard widget showing upcoming services

**Frontend Components:**
```
client/src/components/ServiceReminders.tsx
- List view of all service reminders
- Quick create from completed job
- Calendar integration showing service due dates
```

**Job Completion Enhancement:**
- When completing a recurring service job, prompt: "Schedule next service?"
- Auto-calculate next date based on interval
- Pre-fill service reminder with job details

**Effort:** Medium (4-6 hours)
**Files to modify:**
- `shared/schema.ts` - new table + job fields
- `server/routes.ts` - CRUD endpoints
- `server/automationService.ts` - reminder automation
- `client/src/components/JobCompletion.tsx` - add next service prompt
- `client/src/components/ServiceReminders.tsx` - new component
- `client/src/components/TradieDashboard.tsx` - add widget

---

### 3. Billable/Non-Billable Time Toggle
**Source:** Tradify Timesheets
**Benefit:** Distinguish between client-billable work and admin/travel/training time

#### Implementation Plan

**Database Changes:**
```typescript
// Add to timeEntries table in shared/schema.ts
isBillable: boolean("is_billable").default(true),
timeCategory: varchar("time_category", { length: 50 }).default("work"), 
// Categories: "work", "travel", "admin", "training", "meeting", "break"
```

**API Changes:**
- Update time entry create/update endpoints to accept `isBillable` and `timeCategory`
- Add aggregation endpoint: `GET /api/time-entries/summary?userId=X&startDate=Y&endDate=Z`
  - Returns: { totalHours, billableHours, nonBillableHours, byCategory: {} }

**Frontend Changes:**

**TimeTracking.tsx Enhancement:**
```
- Add toggle switch: "Billable" (green) / "Non-Billable" (grey)
- Add category dropdown for non-billable: Travel, Admin, Training, Meeting
- Color-coded entries in list view:
  - Green border = Billable
  - Grey border = Non-Billable
```

**Dashboard Enhancement:**
```
- Show billable vs non-billable split in daily/weekly summary
- Pie chart: "This week: 32h billable, 8h non-billable"
```

**Timesheet Report Enhancement:**
```
- Filter by billable/non-billable
- Summary row showing totals for each
- Export includes billable column
```

**Effort:** Low (2-3 hours)
**Files to modify:**
- `shared/schema.ts` - add fields
- `server/routes.ts` - update endpoints
- `client/src/components/TimeTracking.tsx` - add toggle + category
- `client/src/components/TradieDashboard.tsx` - update summary

---

## MEDIUM PRIORITY FEATURES

### 4. Trade Calculators Module
**Source:** TradieCalc App
**Benefit:** Built-in trade calculations that link directly to quotes - unique differentiator

#### Implementation Plan

**New Module Structure:**
```
client/src/components/calculators/
├── CalculatorHub.tsx          # Main calculator selection
├── CalculatorResult.tsx       # Shared result display component
├── BalusterSpacingCalc.tsx    # Deck/stair rail spacing
├── ConcreteVolumeCalc.tsx     # Concrete quantities
├── PipeFlowCalc.tsx           # Plumbing flow rates
├── CableSizingCalc.tsx        # Electrical cable sizing
├── TileQuantityCalc.tsx       # Tiling material calculator
├── RoofPitchCalc.tsx          # Roofing calculations
├── BTUCalculatorCalc.tsx      # HVAC sizing
├── SquareCheckCalc.tsx        # Check 90-degree corners
└── StairCalc.tsx              # Stair rise/run calculations
```

**Database:**
```typescript
export const calculationHistory = pgTable("calculation_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  calculatorType: varchar("calculator_type", { length: 50 }),
  inputs: jsonb("inputs"), // Store input values
  results: jsonb("results"), // Store calculated results
  jobId: integer("job_id").references(() => jobs.id), // Optional link to job
  quoteId: integer("quote_id").references(() => quotes.id), // Optional link to quote
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**Calculator Specifications:**

**Baluster Spacing Calculator:**
- Inputs: Railing Length (mm), Baluster Width (mm), Max Gap (typically 100mm for AU code)
- Outputs: Number of Balusters, Actual Spacing, Visual Layout
- Add to Quote: "X balusters @ $Y each"

**Concrete Volume Calculator:**
- Inputs: Length, Width, Depth, Shape (rectangular, circular)
- Outputs: Cubic metres, Number of bags (20kg), Recommended mix
- Add to Quote: "X m³ concrete @ $Y per m³"

**Pipe Flow Calculator:**
- Inputs: Pipe diameter, Length, Flow rate required
- Outputs: Pressure drop, Recommended pipe size
- Trade: Plumbing

**Cable Sizing Calculator:**
- Inputs: Load (amps), Distance, Voltage drop allowed
- Outputs: Recommended cable size, Actual voltage drop
- Trade: Electrical

**Tile Quantity Calculator:**
- Inputs: Room dimensions, Tile size, Wastage %
- Outputs: Number of tiles, Boxes needed, Grout quantity
- Add to Quote: "X boxes tiles @ $Y"

**BTU/kW Calculator:**
- Inputs: Room size, Insulation level, Windows, Climate zone
- Outputs: Required BTU, Recommended AC size
- Trade: HVAC

**Integration with Quotes:**
- "Add to Quote" button on each calculator result
- Pre-fills line item with calculated quantity and description
- Links calculation history to quote for reference

**Effort:** High (8-12 hours for full module)
**Phase 1 (4 hours):** Hub + Concrete + Baluster + Tile calculators
**Phase 2 (4 hours):** Electrical + Plumbing calculators
**Phase 3 (4 hours):** HVAC + Stair + Square check

---

### 5. Custom Team Groups
**Source:** GoTradie "The Plumblords" groups
**Benefit:** Organize crew into custom named groups for different projects/sites

#### Implementation Plan

**Database:**
```typescript
export const teamGroups = pgTable("team_groups", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id), // Owner
  name: varchar("name", { length: 100 }).notNull(), // "The Plumblords", "Site A Crew"
  description: text("description"),
  color: varchar("color", { length: 20 }), // Hex color for UI
  icon: varchar("icon", { length: 50 }), // Lucide icon name
  createdAt: timestamp("created_at").defaultNow(),
});

export const teamGroupMembers = pgTable("team_group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => teamGroups.id),
  teamMemberId: integer("team_member_id").references(() => teamMembers.id),
  addedAt: timestamp("added_at").defaultNow(),
});
```

**API Endpoints:**
```
GET /api/team-groups - List all groups
POST /api/team-groups - Create group
PATCH /api/team-groups/:id - Update group
DELETE /api/team-groups/:id - Delete group
POST /api/team-groups/:id/members - Add member
DELETE /api/team-groups/:id/members/:memberId - Remove member
```

**Frontend Components:**
```
client/src/components/TeamGroups.tsx
- Create/edit group modal
- Drag-and-drop member assignment
- Group chat integration
```

**Chat Hub Integration:**
- Groups appear in conversation list
- Group messages go to all members
- @mention group to notify all

**Job Assignment Integration:**
- Assign job to entire group
- All group members get notification

**Effort:** Medium (4-5 hours)

---

### 6. Rebate/Credit Tracking
**Source:** Tradify Rebate Record
**Benefit:** Track manufacturer rebates, government incentives (solar, HVAC, energy efficiency)

#### Implementation Plan

**Database:**
```typescript
export const rebates = pgTable("rebates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  jobId: integer("job_id").references(() => jobs.id),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  clientId: integer("client_id").references(() => clients.id),
  rebateType: varchar("rebate_type", { length: 50 }), // "manufacturer", "government", "energy"
  rebateName: varchar("rebate_name", { length: 200 }), // "Daikin Cashback", "QLD Solar Rebate"
  amount: integer("amount").notNull(), // Amount in cents
  status: varchar("status", { length: 20 }).default("pending"), 
  // pending, submitted, approved, paid, rejected
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  referenceNumber: varchar("reference_number", { length: 100 }),
  notes: text("notes"),
  documentUrls: text("document_urls").array(), // Supporting documents
  createdAt: timestamp("created_at").defaultNow(),
});
```

**API Endpoints:**
```
GET /api/rebates - List all rebates
POST /api/rebates - Create rebate record
PATCH /api/rebates/:id - Update rebate
DELETE /api/rebates/:id - Delete rebate
GET /api/rebates/summary - Total pending/approved/paid
```

**Frontend Components:**
```
client/src/components/RebateTracking.tsx
- List view with status filters
- Create rebate from job/invoice
- Upload supporting documents
- Dashboard widget showing pending rebates
```

**Job Detail Integration:**
- "Rebates" tab on job detail
- Quick-add rebate with job context pre-filled

**Invoice Integration:**
- Show associated rebates on invoice
- Option to apply rebate as credit to client

**Trade-Specific Templates:**
- HVAC: Manufacturer rebates, government energy incentives
- Solar: STC/LGC certificates, state rebates
- Electrical: Energy efficiency rebates
- Plumbing: Hot water rebates

**Effort:** Medium (3-4 hours)

---

## LOW PRIORITY FEATURES

### 7. QuickBooks Integration
**Source:** Tradify multi-platform accounting
**Benefit:** Support tradies using QuickBooks instead of Xero/MYOB

#### Implementation Plan

**Integration Scope:**
- OAuth 2.0 authentication with QuickBooks
- Customer sync (bidirectional)
- Invoice sync TO QuickBooks
- Payment sync FROM QuickBooks
- Chart of accounts mapping

**API Structure:**
```
/api/integrations/quickbooks/connect - OAuth flow
/api/integrations/quickbooks/disconnect
/api/integrations/quickbooks/sync-customers
/api/integrations/quickbooks/sync-invoices
/api/integrations/quickbooks/sync-payments
/api/integrations/quickbooks/full-sync
```

**Search for Replit QuickBooks integration first**

**Effort:** High (8-10 hours)
**Priority:** Only if user demand exists

---

### 8. Site Photos in Chat Headers
**Source:** GoTradie worksite organization
**Benefit:** Visual context for job-based conversations

#### Implementation Plan

**Database Changes:**
```typescript
// Add to jobs table
headerPhotoUrl: varchar("header_photo_url", { length: 500 }),
```

**Frontend Changes:**
- Chat Hub: Show job header photo as conversation thumbnail
- Job Chat: Display header photo at top of conversation
- Auto-select first job photo as header, or allow manual selection

**Effort:** Low (1-2 hours)

---

### 9. Team Activity Feed
**Source:** GoTradie "Dave is now on the team"
**Benefit:** Keep everyone informed of team changes, job completions, milestones

#### Implementation Plan

**Database:**
```typescript
export const teamActivity = pgTable("team_activity", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id), // Owner account
  actorId: integer("actor_id").references(() => users.id), // Who did it
  activityType: varchar("activity_type", { length: 50 }),
  // Types: "member_joined", "member_left", "job_completed", "quote_accepted", 
  // "invoice_paid", "milestone_reached"
  entityType: varchar("entity_type", { length: 50 }), // "team_member", "job", "quote", "invoice"
  entityId: integer("entity_id"),
  message: text("message"), // "Dave joined the team"
  createdAt: timestamp("created_at").defaultNow(),
});
```

**Frontend Component:**
```
client/src/components/TeamActivityFeed.tsx
- Real-time feed of team activities
- Filterable by activity type
- Integration with notifications
```

**Effort:** Medium (3-4 hours)

---

### 10. Shareable Job Invite Links
**Source:** GoTradie "Magic invite link"
**Benefit:** Easily invite subcontractors to collaborate on specific jobs

#### Implementation Plan

**Database:**
```typescript
export const jobInviteLinks = pgTable("job_invite_links", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id),
  createdBy: integer("created_by").references(() => users.id),
  token: varchar("token", { length: 64 }).unique(), // Random secure token
  permissions: varchar("permissions", { length: 50 }).default("view"), 
  // "view", "collaborate", "full_access"
  expiresAt: timestamp("expires_at"),
  maxUses: integer("max_uses"),
  useCount: integer("use_count").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**API Endpoints:**
```
POST /api/jobs/:jobId/invite-link - Create invite link
GET /api/jobs/invite/:token - Validate and accept invite
DELETE /api/jobs/:jobId/invite-link/:id - Revoke link
```

**Frontend:**
- "Share" button on job detail
- Generate link with QR code
- Copy to clipboard / Share via SMS
- Manage active links

**Effort:** Medium (3-4 hours)

---

### 11. AI Visualization for Renovations
**Source:** Tradie AI "Modernise my bathroom"
**Benefit:** Show customers potential renovation outcomes for upselling

#### Implementation Plan

**Integration:**
- Use DALL-E or similar image generation API
- Input: Before photo + style preference
- Output: AI-generated "after" visualization

**Limitations:**
- High API cost per generation
- Results vary in quality
- Best as "inspiration" not commitment

**UI Flow:**
1. Upload before photo
2. Select style: "Modern", "Traditional", "Minimalist"
3. Select scope: "Bathroom", "Kitchen", "Living Room"
4. Generate visualization
5. Save to job gallery with "AI Concept" label

**Effort:** Medium (4-5 hours)
**Note:** Consider as premium feature due to API costs

---

## IMPLEMENTATION PRIORITY ORDER

### Phase 1: Quick Wins (Week 1)
1. ✅ Weather Widget (2-3 hours)
2. ✅ Billable/Non-Billable Toggle (2-3 hours)
3. ✅ Site Photos in Chat Headers (1-2 hours)

### Phase 2: Service Enhancement (Week 2)
4. ✅ Service Reminders System (4-6 hours)
5. ✅ Rebate/Credit Tracking (3-4 hours)

### Phase 3: Team Features (Week 3)
6. ✅ Custom Team Groups (4-5 hours)
7. ✅ Team Activity Feed (3-4 hours)
8. ✅ Shareable Job Invite Links (3-4 hours)

### Phase 4: Trade Calculators (Week 4-5)
9. ✅ Calculator Hub + Core Calculators (8-12 hours)

### Phase 5: Advanced (As Needed)
10. ⏳ QuickBooks Integration (if demand)
11. ⏳ AI Visualization (premium feature)

---

## TOTAL EFFORT ESTIMATE

| Priority | Feature | Hours |
|----------|---------|-------|
| HIGH | Weather Widget | 2-3 |
| HIGH | Service Reminders | 4-6 |
| HIGH | Billable/Non-Billable | 2-3 |
| MEDIUM | Trade Calculators | 8-12 |
| MEDIUM | Custom Team Groups | 4-5 |
| MEDIUM | Rebate Tracking | 3-4 |
| LOW | QuickBooks | 8-10 |
| LOW | Site Photos Chat | 1-2 |
| LOW | Team Activity Feed | 3-4 |
| LOW | Shareable Invite Links | 3-4 |
| LOW | AI Visualization | 4-5 |

**Total: 43-58 hours** to achieve 100% feature parity + differentiation

---

## SUCCESS METRICS

After implementation, JobRunner will have:
- ✅ 100% feature parity with Tradify
- ✅ 100% feature parity with GoTradie (team features)
- ✅ Unique Trade Calculators module (competitive advantage)
- ✅ Job Scope Checklist (existing advantage)
- ✅ Variation Tracking (existing advantage)

**Positioning confirmation:** "Built for how jobs actually run - not how paperwork pretends they do."
