# JobRunner Feature Implementation Plan

**Created:** December 2024  
**Status:** Active Development

---

## Overview

This document outlines the technical implementation plan for all priority features identified for JobRunner. Each feature includes architecture, database schema, API endpoints, UI components, and implementation notes.

---

## Priority 1: Critical (Before Major Launch)

### 1A. Xero Integration

**Goal:** Sync invoices, payments, and contacts between JobRunner and Xero accounting software.

**Architecture:**
- OAuth2 flow for Xero connection
- Background sync worker for delta syncing
- Webhook listener for real-time updates from Xero
- Conflict resolution for simultaneous edits

**Database Schema Changes:**
```typescript
// New tables in shared/schema.ts
export const xeroConnections = pgTable('xero_connections', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  tenantId: varchar("tenant_id").notNull(), // Xero organization ID
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  scope: varchar("scope"),
  connectedAt: timestamp("connected_at").defaultNow(),
  lastSyncAt: timestamp("last_sync_at"),
  status: varchar("status").default('active') // active, disconnected, error
});

export const xeroSyncState = pgTable('xero_sync_state', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  entityType: varchar("entity_type").notNull(), // contacts, invoices, payments
  lastSyncCursor: varchar("last_sync_cursor"),
  lastSyncAt: timestamp("last_sync_at"),
  syncDirection: varchar("sync_direction").default('bidirectional')
});

// External ID mappings
export const externalAccountingIds = pgTable('external_accounting_ids', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  localEntityType: varchar("local_entity_type").notNull(), // client, invoice, payment
  localEntityId: varchar("local_entity_id").notNull(),
  provider: varchar("provider").notNull(), // xero, myob
  externalId: varchar("external_id").notNull(),
  syncStatus: varchar("sync_status").default('synced'), // synced, pending, error
  lastSyncAt: timestamp("last_sync_at")
});
```

**API Endpoints:**
```
POST /api/integrations/xero/connect - Initiate OAuth flow
GET /api/integrations/xero/callback - OAuth callback
POST /api/integrations/xero/disconnect - Disconnect Xero
GET /api/integrations/xero/status - Get connection status
POST /api/integrations/xero/sync - Trigger manual sync
GET /api/integrations/xero/sync-log - Get sync history
```

**UI Components:**
- XeroConnectButton: OAuth connection button
- XeroStatusBadge: Shows sync status
- XeroSyncSettings: Configure sync preferences
- ConflictResolutionModal: Handle sync conflicts

**Implementation Complexity:** HIGH (3-4 weeks)

**Dependencies:**
- Xero OAuth2 credentials (user needs Xero account)
- xero-node NPM package

---

### 1B. MYOB Integration

**Goal:** Sync invoices and contacts with MYOB AccountRight.

**Architecture:**
- Similar to Xero with OAuth2 flow
- Separate sync worker module
- Shared accounting sync framework

**Database Schema Changes:**
```typescript
export const myobConnections = pgTable('myob_connections', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  companyFileUri: varchar("company_file_uri").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  connectedAt: timestamp("connected_at").defaultNow(),
  lastSyncAt: timestamp("last_sync_at"),
  status: varchar("status").default('active')
});
```

**API Endpoints:**
```
POST /api/integrations/myob/connect
GET /api/integrations/myob/callback
POST /api/integrations/myob/disconnect
GET /api/integrations/myob/status
POST /api/integrations/myob/sync
```

**Implementation Complexity:** HIGH (3-4 weeks)

**Dependencies:**
- MYOB API credentials
- Shared accounting sync framework from Xero

---

### 1C. Stripe AU Platform Config

**Goal:** Ensure Stripe Connect works fully in Australia with all capabilities.

**Current Issues:**
1. Tap to Pay hooks are absent in mobile
2. Connect onboarding doesn't persist AU-specific capabilities
3. Payouts/charges state isn't surfaced to block flows

**Required Fixes:**

**1. Add Stripe capability polling:**
```typescript
// server/stripe.ts
export async function getStripeAccountCapabilities(accountId: string) {
  const account = await stripe.accounts.retrieve(accountId);
  return {
    cardPayments: account.capabilities?.card_payments,
    transfers: account.capabilities?.transfers,
    tapToPay: account.capabilities?.card_issuing,
    payoutsEnabled: account.payouts_enabled,
    chargesEnabled: account.charges_enabled,
    country: account.country,
    defaultCurrency: account.default_currency
  };
}
```

**2. Add capability checks in UI:**
```typescript
// New component: StripeCapabilityCheck.tsx
- Show checklist of required capabilities
- Block payment collection if not ready
- Guide user through completing setup
```

**3. Add Tap to Pay support for mobile:**
```typescript
// mobile/src/services/TapToPay.ts
- Use Stripe Terminal SDK
- Reader discovery for AU terminals
- Payment processing through Terminal API
```

**Database Schema Changes:**
```typescript
// Extend business_settings
tapToPayEnabled: boolean("tap_to_pay_enabled").default(false),
tapToPayDeviceIds: text("tap_to_pay_device_ids").array(),
stripeCapabilities: jsonb("stripe_capabilities"),
lastCapabilityCheck: timestamp("last_capability_check")
```

**Implementation Complexity:** MEDIUM-HIGH (2 weeks)

---

## Priority 2: High (First Quarter Post-Launch)

### 2A. Photo Markup/Annotation Tool

**Goal:** Allow tradies to draw on job photos to highlight areas.

**Architecture:**
- Canvas-based annotation using Fabric.js
- Store annotations as vector JSON
- Render annotations on photo display
- Mobile support with touch drawing

**Database Schema Changes:**
```typescript
export const photoAnnotations = pgTable('photo_annotations', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  photoId: varchar("photo_id").notNull(), // References job photo
  userId: varchar("user_id").notNull(),
  annotationData: jsonb("annotation_data").notNull(), // Fabric.js JSON
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
});
```

**UI Components:**
- PhotoAnnotationEditor: Canvas overlay for drawing
- AnnotationToolbar: Brush size, color, undo/redo
- AnnotationViewer: Display annotated photos

**NPM Packages Required:**
- fabric (Fabric.js for canvas manipulation)

**Implementation Complexity:** MEDIUM (1-2 weeks)

---

### 2B. Video Capture Capability

**Goal:** Record videos for job documentation.

**Architecture:**
- Web: MediaRecorder API
- Mobile: Expo Camera video capture
- Chunked upload to object storage
- Background transcoding (optional)

**Database Schema Changes:**
```typescript
export const mediaAssets = pgTable('media_assets', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  jobId: varchar("job_id").references(() => jobs.id),
  type: varchar("type").notNull(), // image, video
  url: varchar("url").notNull(),
  thumbnailUrl: varchar("thumbnail_url"),
  duration: integer("duration"), // seconds for video
  fileSize: integer("file_size"), // bytes
  status: varchar("status").default('ready'), // uploading, processing, ready, error
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow()
});
```

**API Endpoints:**
```
POST /api/jobs/:id/media/upload - Initiate upload
POST /api/jobs/:id/media/upload/complete - Finalize chunked upload
GET /api/jobs/:id/media - List media for job
DELETE /api/jobs/:id/media/:mediaId - Delete media
```

**Implementation Complexity:** MEDIUM (1-2 weeks)

---

### 2C. Route Optimization

**Goal:** Optimize the order of job visits for efficiency.

**Architecture:**
- Use Google Maps Directions API with optimizeWaypoints
- Cache optimized routes
- Display optimized order in dispatch board
- Mobile map update with turn-by-turn

**Database Schema Changes:**
```typescript
export const optimizedRoutes = pgTable('optimized_routes', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  date: date("date").notNull(),
  startLocation: jsonb("start_location"), // {lat, lng, address}
  endLocation: jsonb("end_location"),
  jobIds: text("job_ids").array(),
  optimizedOrder: jsonb("optimized_order"), // Array of job IDs in order
  totalDistance: real("total_distance"), // km
  totalDuration: integer("total_duration"), // minutes
  polyline: text("polyline"), // Encoded polyline for map display
  createdAt: timestamp("created_at").defaultNow()
});
```

**API Endpoints:**
```
POST /api/routes/optimize - Calculate optimized route for given jobs
GET /api/routes/:date - Get optimized route for a date
PUT /api/routes/:id - Update route (manual reorder)
```

**Environment Variables Required:**
- GOOGLE_MAPS_API_KEY (existing)

**Implementation Complexity:** MEDIUM-HIGH (2 weeks)

---

### 2D. Recurring Invoice Templates

**Goal:** Auto-generate invoices on a schedule for maintenance contracts.

**Architecture:**
- Cron worker to generate invoices from templates
- Template builder using existing invoice form
- Schedule options: weekly, monthly, quarterly, yearly

**Database Schema Changes:**
```typescript
export const recurringInvoices = pgTable('recurring_invoices', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  clientId: varchar("client_id").references(() => clients.id),
  templateData: jsonb("template_data").notNull(), // Invoice template JSON
  frequency: varchar("frequency").notNull(), // weekly, monthly, quarterly, yearly
  dayOfMonth: integer("day_of_month"), // 1-31
  dayOfWeek: integer("day_of_week"), // 0-6
  nextRunAt: timestamp("next_run_at").notNull(),
  lastRunAt: timestamp("last_run_at"),
  status: varchar("status").default('active'), // active, paused, cancelled
  autoSend: boolean("auto_send").default(false),
  createdAt: timestamp("created_at").defaultNow()
});
```

**API Endpoints:**
```
POST /api/recurring-invoices - Create recurring invoice template
GET /api/recurring-invoices - List all recurring invoices
PUT /api/recurring-invoices/:id - Update recurring invoice
DELETE /api/recurring-invoices/:id - Cancel recurring invoice
POST /api/recurring-invoices/:id/run-now - Generate invoice immediately
```

**Implementation Complexity:** MEDIUM (1-2 weeks)

---

## Priority 3: Medium (Future Roadmap)

### 3A. Siri Shortcuts for iOS

**Goal:** Allow voice commands for common actions.

**Available Shortcuts:**
- "Start a job" - Clock in to current job
- "Log travel time" - Start travel tracking
- "Create a quick invoice" - Generate invoice from template

**Implementation:**
- Use Expo Siri Shortcuts plugin
- Define intent handlers in React Native
- Register shortcuts in iOS settings

**Complexity:** MEDIUM (1 week)

---

### 3B. PayPal Payment Option

**Goal:** Accept PayPal payments in addition to Stripe.

**Architecture:**
- PayPal Checkout SDK integration
- Server-side order creation and capture
- Webhook handling for payment status

**Database Schema Changes:**
```typescript
export const paypalTransactions = pgTable('paypal_transactions', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").references(() => invoices.id),
  paypalOrderId: varchar("paypal_order_id").notNull(),
  status: varchar("status").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  currency: varchar("currency").default('AUD'),
  capturedAt: timestamp("captured_at"),
  createdAt: timestamp("created_at").defaultNow()
});
```

**Complexity:** MEDIUM (1-2 weeks)

---

### 3C. Two-Factor Authentication

**Goal:** Add 2FA for enhanced security.

**Options:**
- TOTP (authenticator apps)
- SMS OTP (using existing Twilio)
- Email OTP

**Database Schema Changes:**
```typescript
export const userMfaSettings = pgTable('user_mfa_settings', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id),
  totpSecret: text("totp_secret"), // Encrypted
  backupCodes: text("backup_codes").array(), // Hashed
  preferredMethod: varchar("preferred_method").default('totp'),
  enabledAt: timestamp("enabled_at"),
  lastVerifiedAt: timestamp("last_verified_at")
});
```

**Complexity:** MEDIUM (1-2 weeks)

---

### 3D. Bulk Job Operations

**Goal:** Select and update multiple jobs at once.

**Features:**
- Multi-select in jobs list
- Bulk status update
- Bulk assign to staff
- Bulk archive/delete

**API Endpoints:**
```
POST /api/jobs/bulk-update - Update multiple jobs
POST /api/jobs/bulk-archive - Archive multiple jobs
POST /api/jobs/bulk-delete - Delete multiple jobs
```

**Complexity:** MEDIUM (1 week)

---

## ServiceM8 Mobile Feature Comparison

| Feature | ServiceM8 | JobRunner | Gap Analysis |
|---------|-----------|-------------|--------------|
| Job cards | Yes | Yes | Parity |
| Photo capture | Yes | Yes | Parity |
| Video capture | Yes | No | Need to implement |
| Photo markup | Yes | No | Need to implement |
| Voice notes | Yes | Partial | Need recording UI |
| Offline mode | Yes | Yes | JobRunner superior |
| Siri shortcuts | Yes | No | Need to implement |
| LiDAR room scan | Yes | No | Not planned (hardware) |
| Apple Watch | Yes | No | Not planned |
| Push notifications | Yes | Yes | Parity |
| GPS tracking | Yes | Yes | Parity |
| Tap to Pay | Yes | Partial | Need Terminal integration |
| QR code payments | No | Yes | JobRunner advantage |

---

## Implementation Timeline

**Week 1-2:** Stripe AU Config fixes + Demo payment bug fix
**Week 3-4:** Photo markup + Video capture
**Week 5-6:** Route optimization + Recurring invoices
**Week 7-10:** Xero integration
**Week 11-14:** MYOB integration
**Week 15+:** Priority 3 features

---

## Testing Requirements

Each feature requires:
1. Unit tests for business logic
2. API endpoint tests
3. E2E tests for user flows
4. Mobile testing for cross-platform features
5. Performance testing for sync operations

---

*This document will be updated as features are implemented.*
