import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, json, jsonb, index, unique, uniqueIndex, real, doublePrecision, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - Managed by connect-pg-simple for express-session
// Must match the exact structure created by connect-pg-simple
export const session = pgTable(
  "session",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Subscription tier limits
export const TIER_LIMITS = {
  free: {
    jobsPerMonth: 25,
    invoicesPerMonth: 25,
    quotesPerMonth: -1, // unlimited quotes - key sales tool
    clients: 50,
    teamMembers: 0,
    photoStorage: 100, // MB
    templates: 5,
    features: ['basic_jobs', 'basic_invoices', 'unlimited_quotes', 'email_send'],
    restrictions: [
      'no_ai_assistant',
      'no_team_members', 
      'no_recurring_invoices',
      'no_sms',
      'no_tap_to_pay',
      'no_gps_tracking',
      'no_custom_branding',
      'no_xero_myob',
      'no_reports',
    ],
  },
  pro: {
    jobsPerMonth: -1, // unlimited
    invoicesPerMonth: -1,
    quotesPerMonth: -1,
    clients: -1,
    teamMembers: 1, // Pro is single user only
    photoStorage: -1,
    templates: -1,
    features: ['unlimited_jobs', 'unlimited_invoices', 'recurring', 'reports', 'photo_attachments', 'auto_reminders', 'branding', 'ai_assistant'],
  },
  team: {
    jobsPerMonth: -1, // unlimited
    invoicesPerMonth: -1,
    quotesPerMonth: -1,
    clients: -1,
    teamMembers: 5, // up to 5 workers
    photoStorage: -1,
    templates: -1,
    features: ['unlimited_jobs', 'unlimited_invoices', 'recurring', 'reports', 'photo_attachments', 'auto_reminders', 'team_management', 'branding', 'ai_assistant', 'live_tracking', 'team_chat'],
  },
  business: {
    jobsPerMonth: -1, // unlimited
    invoicesPerMonth: -1,
    quotesPerMonth: -1,
    clients: -1,
    teamMembers: 15, // up to 15 workers
    photoStorage: -1,
    templates: -1,
    features: ['unlimited_jobs', 'unlimited_invoices', 'recurring', 'reports', 'photo_attachments', 'auto_reminders', 'team_management', 'branding', 'ai_assistant', 'live_tracking', 'team_chat'],
  },
  trial: {
    durationDays: 7,
  },
} as const;

// Pricing lives in ./pricing (kept dependency-free so the web frontend
// can import it via @shared/pricing without pulling the entire drizzle schema).
export * from './pricing';

// Worker permission capabilities live in ./permissions (kept dependency-free so the
// web frontend can import them without pulling the entire drizzle schema).
export * from './permissions';


// User storage table - Updated for Replit Auth compatibility
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`), // Keep existing UUID structure
  email: varchar("email").unique(), // Replit Auth provides email (can be null)
  username: text("username").unique(), // Keep for existing users, new users get this from email or generated
  password: text("password"), // Keep for backwards compatibility but make nullable
  googleId: varchar("google_id").unique(), // For Google OAuth linkage
  appleId: varchar("apple_id").unique(), // For Apple Sign In linkage
  xeroId: varchar("xero_id").unique(), // For Xero Sign In linkage
  phone: varchar("phone", { length: 32 }), // Display-formatted phone (e.g. "0400 000 000")
  phoneNormalized: varchar("phone_normalized", { length: 20 }), // E.164 normalized for lookup (e.g. "+61400000000")
  firstName: varchar("first_name"), // From Replit Auth claims
  lastName: varchar("last_name"), // From Replit Auth claims
  profileImageUrl: varchar("profile_image_url"), // From Replit Auth claims
  themeColor: varchar("theme_color"), // Custom color for map markers and theme (hex format e.g. #FF5733)
  tradeType: text("trade_type"), // 'plumbing', 'electrical', etc.
  isActive: boolean("is_active").default(true),
  emailVerified: boolean("email_verified").default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpiresAt: timestamp("email_verification_expires_at"),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiresAt: timestamp("password_reset_expires_at"),
  subscriptionTier: text("subscription_tier").default('free'), // free, pro, team, business, trial
  subscriptionSource: text("subscription_source"), // 'stripe', 'apple', 'beta'
  appleProductId: text("apple_product_id"), // Apple IAP product ID if subscribed via Apple
  appleReceiptData: text("apple_receipt_data"), // Latest Apple receipt for server-side validation
  appleOriginalTransactionId: text("apple_original_transaction_id"), // Stable Apple transaction ID for webhook lookups
  // Usage tracking
  jobsCreatedThisMonth: integer("jobs_created_this_month").default(0),
  invoicesCreatedThisMonth: integer("invoices_created_this_month").default(0),
  quotesCreatedThisMonth: integer("quotes_created_this_month").default(0),
  usageResetDate: timestamp("usage_reset_date").defaultNow(),
  // Trial tracking
  trialStartedAt: timestamp("trial_started_at"),
  trialEndsAt: timestamp("trial_ends_at"),
  trialStatus: text("trial_status"), // active, expired, converted
  intendedTier: text("intended_tier"), // 'free', 'pro', 'team' - set during registration
  // Legacy field kept for compatibility
  subscriptionResetDate: timestamp("subscription_reset_date").defaultNow(),
  // Platform admin flag - for admin@avwebinnovation.com to access platform dashboard
  isPlatformAdmin: boolean("is_platform_admin").default(false),
  // Beta program fields
  betaUser: boolean("beta_user").default(false), // Signed up during beta
  betaLifetimeAccess: boolean("beta_lifetime_access").default(false), // First 10 users get lifetime free
  testimonialConsent: boolean("testimonial_consent").default(false), // Agreed to provide testimonial
  testimonialConsentAt: timestamp("testimonial_consent_at"), // When they agreed
  betaCohortNumber: integer("beta_cohort_number"), // Which early adopter they are (1-10)
  // Onboarding demo data
  hasDemoData: boolean("has_demo_data").default(false), // Whether demo data has been seeded for this user
  demoDataIds: jsonb("demo_data_ids"), // Stores IDs of demo records: { clients: [], jobs: [], quotes: [], invoices: [] }
  activeBusinessId: varchar("active_business_id"), // For multi-business subcontractors: which business they're currently viewing
  // Subcontractor compliance details. These follow the subcontractor's account,
  // so a business sees the same current documentation on profiles, assignments,
  // and invoices.
  licenseType: text("license_type"),
  licenseNumber: text("license_number"),
  licenseExpiry: date("license_expiry"),
  insurancePolicyNumber: text("insurance_policy_number"),
  insuranceExpiry: date("insurance_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lifecycleEmailsSent: jsonb("lifecycle_emails_sent").default({}),
  lastLifecycleEmailAt: timestamp("last_lifecycle_email_at"),
});

// Replit Auth user upsert type
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type SafeUser = Omit<User, 'password' | 'emailVerificationToken' | 'passwordResetToken'>; // Safe user for API responses

// Legacy schemas for backwards compatibility
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  username: true,
  password: true,
  firstName: true,
  lastName: true,
  tradeType: true,
  intendedTier: true,
}).extend({
  password: z.string().min(8, "Password must be at least 8 characters").regex(/[A-Z]/, "Password must include an uppercase letter").regex(/[^A-Za-z0-9]/, "Password must include a special character").optional(),
  email: z.string().email("Invalid email address").optional(),
  firstName: z.string().trim().min(1, "First name is required").max(100, "First name is too long"),
  lastName: z.string().trim().min(1, "Last name is required").max(100, "Last name is too long"),
  intendedTier: z.enum(['free', 'pro', 'team']).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginSchema>;

// Login Codes for passwordless email authentication
export const loginCodes = pgTable("login_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  code: varchar("code", { length: 6 }).notNull(), // 6-digit code
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Records each user's acceptance of the Terms of Service + Privacy Policy at
// signup. Kept as an append-only audit trail (one row per acceptance) so a
// dispute can be proven: who agreed, when, to which version, on which platform.
export const termsAcceptances = pgTable("terms_acceptance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  termsVersion: varchar("terms_version").notNull(),
  platform: varchar("platform").notNull(), // 'web' | 'mobile'
  ipAddress: varchar("ip_address"),
  acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
});
export const insertTermsAcceptanceSchema = createInsertSchema(termsAcceptances).omit({
  id: true,
  acceptedAt: true,
});
export type InsertTermsAcceptance = z.infer<typeof insertTermsAcceptanceSchema>;
export type TermsAcceptance = typeof termsAcceptances.$inferSelect;

export type LoginCode = typeof loginCodes.$inferSelect;
export type InsertLoginCode = typeof loginCodes.$inferInsert;

// Schemas for login code endpoints
export const requestLoginCodeSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const verifyLoginCodeSchema = z.object({
  email: z.string().email("Invalid email address"),
  code: z.string().length(6, "Code must be 6 digits"),
});

export type RequestLoginCode = z.infer<typeof requestLoginCodeSchema>;
export type VerifyLoginCode = z.infer<typeof verifyLoginCodeSchema>;

// Daily active-user tracking — one row per user per (local) day. Captured
// server-side by activity-tracking middleware so it covers BOTH the web app
// and the mobile app with no client SDK. Powers signup cohort + week-1
// (Day-7) retention reporting in the admin dashboard. activityDate is stored
// as a calendar date in the business timezone (Australia/Sydney).
export const userActivity = pgTable("user_activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  activityDate: date("activity_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("uq_user_activity_user_date").on(table.userId, table.activityDate),
  index("idx_user_activity_user").on(table.userId),
  index("idx_user_activity_date").on(table.activityDate),
]);

export type UserActivity = typeof userActivity.$inferSelect;
export type InsertUserActivity = typeof userActivity.$inferInsert;

// Business Settings
export const businessSettings = pgTable("business_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  businessName: text("business_name").notNull(),
  abn: text("abn"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  logoUrl: text("logo_url"),
  detectedColors: json("detected_colors").default([]),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  accentColor: text("accent_color"),
  customThemeEnabled: boolean("custom_theme_enabled").default(false),
  gstEnabled: boolean("gst_enabled").default(false),
  defaultHourlyRate: decimal("default_hourly_rate", { precision: 10, scale: 2 }).default('100.00'),
  timeRoundingMinutes: integer("time_rounding_minutes").default(5),
  minimumCalloutHours: decimal("minimum_callout_hours", { precision: 10, scale: 2 }).default('0'),
  includeLocationProofOnInvoices: boolean("include_location_proof_on_invoices").default(true),
  // When true, break time entries are counted as billable on client invoices.
  // Default false = breaks are not billed (current behaviour). Billing-only; does
  // not change what workers are paid.
  billBreaks: boolean("bill_breaks").default(false),
  calloutFee: decimal("callout_fee", { precision: 10, scale: 2 }).default('80.00'),
  quoteValidityDays: integer("quote_validity_days").default(30),
  invoicePrefix: text("invoice_prefix").default('TT-'),
  quotePrefix: text("quote_prefix").default('QT-'),
  // Optional simple sequential numbering. When set, new invoice/quote numbers are
  // generated as `${prefix}${paddedNumber}` (e.g. INV-0042) instead of the
  // year-based format, and the counter auto-increments from here.
  invoiceNextNumber: integer("invoice_next_number"),
  quoteNextNumber: integer("quote_next_number"),
  // Job numbering — auto-generated when jobPrefix is set (e.g., "GEM" → GEM1001, GEM1002)
  jobPrefix: text("job_prefix"),
  jobNextNumber: integer("job_next_number"),
  paymentInstructions: text("payment_instructions"),
  brandColor: text("brand_color").default('#2563EB'),
  // Team/Business Size Settings
  teamSize: text("team_size").default('solo'), // 'solo', 'small' (2-5), 'medium' (6-20), 'large' (20+)
  // 'business' (default) or 'subcontractor'. A standalone subcontractor is a
  // person who signed up choosing "I'm a subcontractor" without joining any
  // business. They still own their own solo account, but are labelled and shown
  // the subcontractor experience. Only used when the account has NO accepted
  // team membership (an actual team membership role always takes precedence).
  accountType: text("account_type").default('business'),
  numberOfEmployees: integer("number_of_employees").default(1),
  // Australian Compliance Fields
  licenseNumber: text("license_number"),
  regulatorRegistration: text("regulator_registration"), // QBCC, VBA, etc.
  insuranceDetails: text("insurance_details"), // Public liability insurance details
  insurancePolicyNumber: text("insurance_policy_number"),
  insuranceProvider: text("insurance_provider"),
  insuranceAmount: text("insurance_amount"),
  bankDetails: text("bank_details"), // Bank account details for payments
  warrantyPeriod: text("warranty_period").default('12 months'),
  lateFeeRate: text("late_fee_rate").default('1.5% per month'),
  // Legal Document Terms
  quoteTerms: text("quote_terms"), // Default terms for quotes
  invoiceTerms: text("invoice_terms"), // Default terms for invoices
  defaultPaymentTermsDays: integer("default_payment_terms_days").default(14), // Net 14 by default
  // Stripe Connect Express for customer payments to tradie's bank
  stripeConnectAccountId: text("stripe_connect_account_id"),
  stripeConnectOnboardingStatus: text("stripe_connect_onboarding_status").default('not_started'), // not_started, pending, submitted, verified, rejected
  stripeConnectTosAcceptedAt: timestamp("stripe_connect_tos_accepted_at"),
  connectChargesEnabled: boolean("connect_charges_enabled").default(false),
  connectPayoutsEnabled: boolean("connect_payouts_enabled").default(false),
  platformFeePercent: decimal("platform_fee_percent", { precision: 5, scale: 2 }).default('2.50'), // 2.5% platform fee
  // Automated reminder settings
  autoRemindersEnabled: boolean("auto_reminders_enabled").default(true),
  reminderDays: json("reminder_days").default([7, 14, 30]), // Days after due date to send reminders
  reminderTone: text("reminder_tone").default('friendly'), // friendly, professional, firm
  // JobRunner Subscription Billing (tradie paying us $49.99/month)
  stripeCustomerId: text("stripe_customer_id"), // Platform customer ID for subscription billing
  stripeSubscriptionId: text("stripe_subscription_id"), // Active subscription ID
  subscriptionStatus: text("subscription_status").default('none'), // none, active, trialing, past_due, canceled, paused
  subscriptionPausedAt: timestamp("subscription_paused_at"), // When subscription was paused
  subscriptionCanceledAt: timestamp("subscription_canceled_at"), // When subscription was canceled (for 12-month data retention)
  dataRetentionExpiresAt: timestamp("data_retention_expires_at"), // 12 months after cancellation - data eligible for deletion
  currentPeriodEnd: timestamp("current_period_end"), // When current billing period ends
  seatCount: integer("seat_count").default(0), // Number of additional team seats purchased (for Team plan)
  // Payment method info (for display and reminders)
  paymentMethodLast4: text("payment_method_last4"), // Last 4 digits of saved card
  paymentMethodBrand: text("payment_method_brand"), // Card brand (visa, mastercard, etc.)
  defaultPaymentMethodId: text("default_payment_method_id"), // Stripe payment method ID
  // Billing reminder tracking
  nextBillingDate: timestamp("next_billing_date"), // Next charge date (for reminder scheduling)
  lastBillingReminderSentAt: timestamp("last_billing_reminder_sent_at"), // Prevent duplicate reminders
  billingReminderDays: json("billing_reminder_days").default([3, 1]), // Days before billing to send reminders
  billingRemindersEnabled: boolean("billing_reminders_enabled").default(true), // User can disable reminders
  // Trial tracking (at business level)
  trialStartDate: timestamp("trial_start_date"), // When trial started
  trialEndDate: timestamp("trial_end_date"), // When trial ends (30 days after start)
  trialConverted: boolean("trial_converted").default(false), // Did trial convert to paid?
  // Digital Signature Settings
  defaultSignature: text("default_signature"), // Base64 encoded signature image for quotes/invoices
  signatureName: text("signature_name"), // Name displayed under signature
  includeSignatureOnQuotes: boolean("include_signature_on_quotes").default(false),
  includeSignatureOnInvoices: boolean("include_signature_on_invoices").default(false),
  // Document Template Settings
  documentTemplate: text("document_template").default('professional'), // modern, professional, minimal
  documentTemplateSettings: json("document_template_settings"), // Custom overrides for template
  // Theme/Appearance Settings - synced across web and mobile
  themeMode: text("theme_mode").default('system'), // 'light', 'dark', 'system' - synced across all devices
  // SMS Configuration
  smsMode: text("sms_mode").default('standard'), // 'standard' (shared number) or 'ai_receptionist' (dedicated number with AI)
  geofenceSmsAlerts: boolean("geofence_sms_alerts").default(false), // Send SMS to owner on worker arrival/departure
  dedicatedPhoneNumber: text("dedicated_phone_number"), // Dedicated Twilio number for AI Receptionist (E.164 format)
  archivedPhoneNumber: text("archived_phone_number"), // Archived dedicated number (kept on Twilio, can be re-acquired)
  // Sender attribution for outbound SMS sent by team members
  // 'off'         = no prefix; client sees one shared identity
  // 'name_prefix' = prepend "From [WorkerName]: " when a team member sends from the shared business number
  // 'per_worker'  = (future) each worker sends from their own dedicated number
  smsSenderAttribution: text("sms_sender_attribution").default('off'),
  // Vapi AI Receptionist Configuration
  vapiAssistantId: text("vapi_assistant_id"), // Vapi assistant ID for this business
  vapiPhoneNumberId: text("vapi_phone_number_id"), // Vapi phone number ID
  aiReceptionistMode: text("ai_receptionist_mode").default('off'), // off, after_hours, always_on_transfer, always_on_message, selective
  aiReceptionistVoice: text("ai_receptionist_voice").default('Jess'), // Jess, Harry, Chris (Australian voices)
  aiReceptionistGreeting: text("ai_receptionist_greeting"), // Custom greeting message
  aiReceptionistTransferNumbers: json("ai_receptionist_transfer_numbers").default([]), // Array of {name, phone, priority} for call transfer
  aiReceptionistBusinessHours: json("ai_receptionist_business_hours"), // {start: "08:00", end: "17:00", timezone: "Australia/Brisbane", days: [1,2,3,4,5]}
  aiReceptionistEnabled: boolean("ai_receptionist_enabled").default(false), // Master toggle
  twilioPhoneNumber: text("twilio_phone_number"), // User's own Twilio phone number (E.164 format) - legacy
  twilioSenderId: text("twilio_sender_id"), // Alphanumeric sender ID (11 chars max, e.g., "JobRunner") - legacy
  twilioAccountSid: text("twilio_account_sid"), // User's own Twilio account SID
  twilioAuthToken: text("twilio_auth_token"), // User's own Twilio auth token (encrypted at rest)
  // Onboarding tracking
  onboardingCompleted: boolean("onboarding_completed").default(false),
  hasSeenWalkthrough: boolean("has_seen_walkthrough").default(false), // Track if user has seen the intro walkthrough
  onboardingLevel: integer("onboarding_level").default(0), // Learning Roadmap progress (0-4 like ServiceM8)
  // AI Features Settings
  aiEnabled: boolean("ai_enabled").default(true), // Enable/disable all AI features
  aiPhotoAnalysisEnabled: boolean("ai_photo_analysis_enabled").default(true), // Enable AI photo analysis
  aiSuggestionsEnabled: boolean("ai_suggestions_enabled").default(true), // Enable AI suggestions
  // Email Sending Preference
  emailSendingMode: text("email_sending_mode").default('manual'), // 'manual' (Gmail draft) or 'automatic' (SendGrid)
  // Google Calendar Integration (per-user OAuth)
  googleCalendarConnected: boolean("google_calendar_connected").default(false),
  googleCalendarAccessToken: text("google_calendar_access_token"),
  googleCalendarRefreshToken: text("google_calendar_refresh_token"),
  googleCalendarTokenExpiry: timestamp("google_calendar_token_expiry"),
  googleCalendarEmail: text("google_calendar_email"),
  // Business locale / scheduling timezone (used for Google Calendar event tz, etc.)
  timezone: text("timezone").default('Australia/Sydney'),
  // Xero Integration Settings (configurable account codes)
  xeroSalesAccountCode: text("xero_sales_account_code").default('200'), // Default sales revenue account
  xeroBankAccountCode: text("xero_bank_account_code").default('090'), // Default bank account for payments
  xeroExpenseAccountCode: text("xero_expense_account_code").default('400'), // Default expense account
  xeroTaxType: text("xero_tax_type").default('OUTPUT'), // GST on sales (Australia)
  // QuickBooks Online — default ItemRef to use when pushing invoice/quote line items.
  // Shape: { value: string, name: string }. Falls back to {value:"1", name:"Services"} (legacy hardcode).
  quickbooksDefaultItemRef: json("quickbooks_default_item_ref"),
  // ─── Round 2 mapping by upstream ID (Task #91) ───
  // Xero: optional Account UUID (preferred over xeroSalesAccountCode when set), TaxRate TaxType code, Item Code
  xeroSalesAccountId: text("xero_sales_account_id"),
  xeroTaxRateId: text("xero_tax_rate_id"), // e.g. "OUTPUT", "OUTPUT2", "BASEXCLUDED" — overrides xeroTaxType when set
  xeroDefaultItemCode: text("xero_default_item_code"),
  xeroActiveTenantId: text("xero_active_tenant_id"), // multi-tenant selector — currently-selected Xero org
  xeroLastWebhookAt: timestamp("xero_last_webhook_at"),
  // QuickBooks Online: Account Id (Income), TaxCodeRef value, Item Id (preferred over quickbooksDefaultItemRef when set)
  qboSalesAccountId: text("qbo_sales_account_id"),
  qboTaxRateId: text("qbo_tax_rate_id"),
  qboDefaultItemId: text("qbo_default_item_id"),
  qboLastWebhookAt: timestamp("qbo_last_webhook_at"),
  // MYOB AccountRight: Income Account Uid, TaxCode Uid, Item Uid
  myobIncomeAccountId: text("myob_income_account_id"),
  myobTaxCodeId: text("myob_tax_code_id"),
  myobDefaultItemId: text("myob_default_item_id"),
  // Outlook/Microsoft 365 Integration
  outlookConnected: boolean("outlook_connected").default(false),
  outlookAccessToken: text("outlook_access_token"),
  outlookRefreshToken: text("outlook_refresh_token"),
  outlookTokenExpiry: timestamp("outlook_token_expiry"),
  outlookEmail: text("outlook_email"),
  // Structured Bank Account Details (for bank transfer payments)
  bankBsb: text("bank_bsb"), // Australian BSB (6 digits)
  bankAccountNumber: text("bank_account_number"), // Account number
  bankAccountName: text("bank_account_name"), // Account holder name (e.g., "Mike's Plumbing Pty Ltd")
  // Payment Method Preferences
  acceptCardPayments: boolean("accept_card_payments").default(true), // Accept Stripe card payments
  acceptBankTransfer: boolean("accept_bank_transfer").default(true), // Accept manual bank transfers
  acceptBecsDebit: boolean("accept_becs_debit").default(false), // Accept BECS Direct Debit (Australia)
  acceptPayTo: boolean("accept_payto").default(false), // Accept PayTo real-time payments (Australia)
  // Card Surcharge Settings (fee pass-through to reduce costs)
  enableCardSurcharge: boolean("enable_card_surcharge").default(false), // Pass card fees to customer
  cardSurchargePercent: decimal("card_surcharge_percent", { precision: 4, scale: 2 }).default('1.95'), // Default 1.95%
  cardSurchargeFixedCents: integer("card_surcharge_fixed_cents").default(30), // Fixed fee component (30 cents)
  surchargeDisclaimer: text("surcharge_disclaimer"), // Custom disclaimer text for invoices
  // Early Payment Discount (incentivize bank transfer over card)
  enableEarlyPaymentDiscount: boolean("enable_early_payment_discount").default(false),
  earlyPaymentDiscountPercent: decimal("early_payment_discount_percent", { precision: 4, scale: 2 }).default('2.00'), // 2% discount
  earlyPaymentDiscountDays: integer("early_payment_discount_days").default(7), // If paid within 7 days
  // Default Payment Method for invoices
  defaultPaymentMethod: text("default_payment_method").default('card'), // 'card', 'bank_transfer', 'becs', 'payto'
  googleReviewUrl: text("google_review_url"),
  bookingSlug: text("booking_slug"),
  bookingPageEnabled: boolean("booking_page_enabled").default(false),
  bookingPageServices: json("booking_page_services").default([]),
  bookingPageDescription: text("booking_page_description"),
  emailOnQuoteAccepted: boolean("email_on_quote_accepted").default(false),
  emailOnInvoicePaid: boolean("email_on_invoice_paid").default(false),
  requireTake5BeforeStart: boolean("require_take5_before_start").default(false), // Block starting a job until a pre-start/Take 5 safety form is submitted
  blockJobStartOnExpiredCompliance: boolean("block_job_start_on_expired_compliance").default(false), // Block starting a job when the worker/business has an expired licence/cert
  requirePoReconciliation: boolean("require_po_reconciliation").default(false), // Block marking a job done until all POs are Fully Received or Cancelled
  simpleMode: boolean("simple_mode").default(true),
  scheduleStartHour: integer("schedule_start_hour").default(6),
  scheduleEndHour: integer("schedule_end_hour").default(20),
  // Owner-set, team-wide location tracking window. When trackingHoursEnabled is
  // true, each worker's phone STOPS background GPS outside this window / on
  // non-work days (battery saver) — unless they are clocked in or on the way to
  // a job, which overrides the window. Columns added via raw ALTER on the live
  // DB; mirrored here so Drizzle select/update map them.
  trackingHoursEnabled: boolean("tracking_hours_enabled").default(false),
  workHoursStart: text("work_hours_start").default('07:00'),
  workHoursEnd: text("work_hours_end").default('17:00'),
  workDays: json("work_days").$type<number[]>().default([1, 2, 3, 4, 5]),
  // ─── One-way spreadsheet sync (Sheet Sync) ───
  // JobRunner is the source of truth; data is pushed OUT on a schedule only.
  // Columns added via raw ALTER on the live DB (drizzle push is not used).
  sheetSyncEnabled: boolean("sheet_sync_enabled").default(false),
  sheetSyncTarget: text("sheet_sync_target").default('google_sheets'), // 'google_sheets' | 'excel_email'
  sheetSyncFrequency: text("sheet_sync_frequency").default('daily'), // 'daily' | 'weekly'
  sheetSyncDataTypes: json("sheet_sync_data_types").$type<string[]>().default(['clients', 'jobs', 'invoices', 'payments']),
  googleSheetsConnected: boolean("google_sheets_connected").default(false),
  googleSheetsAccessToken: text("google_sheets_access_token"),
  googleSheetsRefreshToken: text("google_sheets_refresh_token"),
  googleSheetsTokenExpiry: timestamp("google_sheets_token_expiry"),
  googleSheetsEmail: text("google_sheets_email"),
  sheetSyncSpreadsheetId: text("sheet_sync_spreadsheet_id"),
  sheetSyncSpreadsheetUrl: text("sheet_sync_spreadsheet_url"),
  sheetSyncLastRunAt: timestamp("sheet_sync_last_run_at"),
  sheetSyncLastStatus: text("sheet_sync_last_status"), // 'success' | 'error'
  sheetSyncLastError: text("sheet_sync_last_error"),
  sheetSyncRecipients: json("sheet_sync_recipients").$type<string[]>().default([]),
  // ─── Default Markup Percentages (Task #388: Markup Engine) ───
  // Applied when a PO/expense/material is added to a job and no per-line override is set.
  // Per-line markupPercent on jobMaterials takes priority; these are business-wide defaults.
  defaultMaterialMarkupPct: decimal("default_material_markup_pct", { precision: 5, scale: 2 }).default('20.00'),
  defaultEquipmentMarkupPct: decimal("default_equipment_markup_pct", { precision: 5, scale: 2 }).default('15.00'),
  defaultSubcontractorMarkupPct: decimal("default_subcontractor_markup_pct", { precision: 5, scale: 2 }).default('10.00'),
  // Travel allowance rate (per km) applied to Driving/Travel time entries for payroll export
  travelRatePerKm: decimal("travel_rate_per_km", { precision: 10, scale: 4 }).default('0.0000'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_business_settings_user_id").on(table.userId),
]);

// Integration Settings
export const integrationSettings = pgTable("integration_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeEnabled: boolean("stripe_enabled").default(false),
  emailEnabled: boolean("email_enabled").default(false),
  autoSendInvoices: boolean("auto_send_invoices").default(false),
  autoGeneratePaymentLinks: boolean("auto_generate_payment_links").default(false),
  emailTemplate: text("email_template"),
  paymentTerms: text("payment_terms").default('Net 30'),
  // Notification preferences - Push notifications
  notifyQuoteResponses: boolean("notify_quote_responses").default(true),
  notifyPaymentConfirmations: boolean("notify_payment_confirmations").default(true),
  notifyOverdueInvoices: boolean("notify_overdue_invoices").default(true),
  notifyWeeklySummary: boolean("notify_weekly_summary").default(false),
  notifyJobAssigned: boolean("notify_job_assigned").default(true),
  notifyJobUpdates: boolean("notify_job_updates").default(true),
  notifyJobReminders: boolean("notify_job_reminders").default(true),
  notifyTeamMessages: boolean("notify_team_messages").default(true),
  notifyTeamLocations: boolean("notify_team_locations").default(true),
  notifyDailySummary: boolean("notify_daily_summary").default(false),
  smartRunningLateEnabled: boolean("smart_running_late_enabled").default(true),
  pushNotificationsEnabled: boolean("push_notifications_enabled").default(true),
  // Google Calendar Integration
  googleCalendarConnected: boolean("google_calendar_connected").default(false),
  googleCalendarAccessToken: text("google_calendar_access_token"),
  googleCalendarRefreshToken: text("google_calendar_refresh_token"),
  googleCalendarTokenExpiry: timestamp("google_calendar_token_expiry"),
  googleCalendarEmail: text("google_calendar_email"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_integration_settings_user_id").on(table.userId),
]);

// Notifications
// Notification priority levels for Smart Notifications Hub
export const NOTIFICATION_PRIORITIES = ['urgent', 'important', 'info'] as const;
export type NotificationPriority = typeof NOTIFICATION_PRIORITIES[number];

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text("type").notNull(), // job_reminder, overdue_invoice, payment_received, quote_accepted, etc.
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedId: varchar("related_id"), // jobId, invoiceId, quoteId, etc.
  relatedType: text("related_type"), // 'job', 'invoice', 'quote', etc.
  read: boolean("read").default(false),
  dismissed: boolean("dismissed").default(false),
  priority: text("priority").default('info'), // urgent (money events), important (job events), info (other)
  actionUrl: text("action_url"), // Deep link to relevant page
  actionLabel: text("action_label"), // e.g. "View Quote", "Create Invoice"
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_notifications_user_id").on(table.userId),
]);

export type Notification = typeof notifications.$inferSelect;
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// Push Notification Tokens (for mobile app)
export const pushTokens = pgTable("push_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text("token").notNull(), // Expo push token
  platform: text("platform").notNull(), // 'ios' or 'android'
  deviceId: text("device_id"), // Unique device identifier
  isActive: boolean("is_active").default(true),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_push_tokens_user_id").on(table.userId),
]);

export type PushToken = typeof pushTokens.$inferSelect;
export const insertPushTokenSchema = createInsertSchema(pushTokens).omit({ id: true, createdAt: true, lastUsedAt: true });
export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;

// Activity Logs - tracks all user activities for dashboard feed
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text("type").notNull(), // job_created, job_started, job_completed, quote_created, quote_sent, quote_accepted, invoice_created, invoice_sent, invoice_paid, etc.
  title: text("title").notNull(),
  description: text("description"),
  // Entity references for navigation
  entityType: text("entity_type"), // 'job', 'quote', 'invoice', 'client'
  entityId: varchar("entity_id"), // ID of the related entity
  // Metadata for additional context
  metadata: jsonb("metadata").default({}), // Can store client name, amounts, etc.
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_activity_logs_user_id").on(table.userId),
]);

export type ActivityLog = typeof activityLogs.$inferSelect;
export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, createdAt: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

// Team Presence - Track real-time status of team members
export const teamPresence = pgTable("team_presence", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar("status", { length: 50 }).default('offline'), // online, offline, busy, on_job, break
  statusMessage: varchar("status_message", { length: 255 }),
  currentJobId: varchar("current_job_id").references(() => jobs.id),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  lastLocationLat: real("last_location_lat"),
  lastLocationLng: real("last_location_lng"),
  lastLocationUpdatedAt: timestamp("last_location_updated_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_team_presence_user_id").on(table.userId),
  index("idx_team_presence_business_owner_id").on(table.businessOwnerId),
  index("idx_team_presence_current_job_id").on(table.currentJobId),
]);

export type TeamPresence = typeof teamPresence.$inferSelect;
export const insertTeamPresenceSchema = createInsertSchema(teamPresence).omit({ id: true, updatedAt: true });
export type InsertTeamPresence = z.infer<typeof insertTeamPresenceSchema>;

// Activity Feed - Track team/business activity
export const activityFeed = pgTable("activity_feed", {
  id: varchar("id").primaryKey(),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  actorUserId: varchar("actor_user_id").references(() => users.id),
  actorName: varchar("actor_name", { length: 255 }),
  teamMemberId: varchar("team_member_id").references(() => teamMembers.id), // If team member action
  activityType: varchar("activity_type", { length: 100 }).notNull(), // team_join, job_completed, check_in, check_out, message_sent, quote_sent, invoice_paid, client_added, milestone, etc.
  entityType: varchar("entity_type", { length: 50 }), // job, quote, invoice, client, team_member
  entityId: varchar("entity_id"),
  entityTitle: varchar("entity_title", { length: 255 }),
  description: text("description"),
  metadata: jsonb("metadata"), // Additional context data
  isImportant: boolean("is_important").default(false), // For highlighting key events
  isRead: boolean("is_read").default(false), // Mark as read functionality
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_activity_feed_business_owner_id").on(table.businessOwnerId),
  index("idx_activity_feed_actor_user_id").on(table.actorUserId),
  index("idx_activity_feed_team_member_id").on(table.teamMemberId),
]);

export type ActivityFeed = typeof activityFeed.$inferSelect;
export const insertActivityFeedSchema = createInsertSchema(activityFeed).omit({ id: true, createdAt: true });
export type InsertActivityFeed = z.infer<typeof insertActivityFeedSchema>;

// Clients
// Import runs — one row per data import (CSV/smart import). Keeps the original
// file in object storage and lets the owner review + undo the whole import.
export const importRuns = pgTable("import_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  fileName: text("file_name").notNull(),
  filePath: text("file_path"), // /objects/imports/... path of the retained original upload
  fileSize: integer("file_size"),
  source: text("source").notNull().default('csv'), // 'csv' | 'smart'
  platform: text("platform"), // 'generic' | 'tradify' | 'servicem8' | null
  type: text("type").notNull().default('unknown'), // clients|catalog|jobs|quotes|invoices
  status: text("status").notNull().default('pending'), // pending|completed|undone
  recordsImported: integer("records_imported").notNull().default(0),
  recordsMerged: integer("records_merged").notNull().default(0),
  recordsSkipped: integer("records_skipped").notNull().default(0),
  recordsRemoved: integer("records_removed").notNull().default(0),
  completedAt: timestamp("completed_at"),
  undoneAt: timestamp("undone_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_import_runs_user_id").on(table.userId),
]);

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  notes: text("notes"),
  savedSignatureData: text("saved_signature_data"),
  savedSignatureDate: timestamp("saved_signature_date"),
  tags: text("tags").array().default(sql`'{}'::text[]`),
  clientType: text("client_type"),
  referralSource: text("referral_source"),
  xeroContactId: varchar("xero_contact_id"),
  xeroSyncedAt: timestamp("xero_synced_at"),
  // Task #115: marks rows created by the "Try with sample data" onboarding toggle.
  isSample: boolean("is_sample").default(false).notNull(),
  // Import traceability: which import created this row (null = created in-app)
  importRunId: varchar("import_run_id"),
  importRowNumber: integer("import_row_number"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_clients_user_id").on(table.userId),
]);

// Jobs
export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description"),
  address: text("address"),
  // Geocoded coordinates for map display
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  status: text("status").notNull().default('pending'), // pending, scheduled, in_progress, done, invoiced, cancelled
  cancellationReason: text("cancellation_reason"), // Reason for cancellation if status is cancelled
  scheduledAt: timestamp("scheduled_at"),
  scheduledTime: text("scheduled_time"), // Time of day in HH:MM format
  scheduleOrder: integer("schedule_order"), // Manual ordering for "Today's Schedule" drag-to-reorder (nulls fall back to scheduledAt sort)
  estimatedDuration: integer("estimated_duration").default(60), // Duration in minutes
  assignedTo: text("assigned_to"),
  notes: text("notes"),
  photos: jsonb("photos").default([]),
  templateId: varchar("template_id"),
  // Recurring job settings
  isRecurring: boolean("is_recurring").default(false),
  recurrencePattern: text("recurrence_pattern"), // weekly, fortnightly, monthly, quarterly, yearly
  recurrenceInterval: integer("recurrence_interval").default(1), // e.g., every 2 weeks
  recurrenceEndDate: timestamp("recurrence_end_date"), // When to stop recurring
  parentJobId: varchar("parent_job_id"), // Links to original recurring job
  nextRecurrenceDate: timestamp("next_recurrence_date"), // When to create next occurrence
  // Stage timestamps for tracking when each phase was reached
  startedAt: timestamp("started_at"), // When job moved to in_progress
  completedAt: timestamp("completed_at"), // When job moved to done
  invoicedAt: timestamp("invoiced_at"), // When job moved to invoiced
  // Geofence settings for automatic time tracking
  geofenceEnabled: boolean("geofence_enabled").default(false),
  geofenceRadius: integer("geofence_radius").default(100), // Radius in meters (default 100m)
  geofenceAutoClockIn: boolean("geofence_auto_clock_in").default(false), // Auto-start timer on entry
  geofenceAutoClockOut: boolean("geofence_auto_clock_out").default(false), // Auto-stop timer on exit
  // Google Calendar integration
  calendarEventId: text("calendar_event_id"), // Google Calendar event ID for synced jobs
  archivedAt: timestamp("archived_at"), // When the job was archived
  // Xero integration tracking
  isXeroImport: boolean("is_xero_import").default(false), // Whether job was imported from Xero
  xeroJobId: varchar("xero_job_id"), // Xero project/job ID
  xeroContactId: varchar("xero_contact_id"), // Xero contact ID for client mapping
  xeroQuoteId: varchar("xero_quote_id"), // Xero quote ID if associated
  xeroSyncedAt: timestamp("xero_synced_at"), // When job was last synced with Xero
  // Trade-specific custom fields (stored as JSON object keyed by field ID)
  customFields: jsonb("custom_fields").default({}),
  workerStatus: text("worker_status"),
  workerStatusUpdatedAt: timestamp("worker_status_updated_at"),
  workerEta: text("worker_eta"),
  workerEtaMinutes: integer("worker_eta_minutes"),
  portalEnabled: boolean("portal_enabled").default(false),
  requiresInspection: boolean("requires_inspection").default(false),
  inspectionCompletedAt: timestamp("inspection_completed_at"),
  inspectionNotes: text("inspection_notes"),
  leadSource: text("lead_source"),
  leadId: varchar("lead_id"),
  version: integer("version").notNull().default(1),
  // Task #115: marks rows created by the "Try with sample data" onboarding toggle.
  isSample: boolean("is_sample").default(false).notNull(),
  // Import traceability: which import created this row (null = created in-app)
  importRunId: varchar("import_run_id"),
  importRowNumber: integer("import_row_number"),
  // ─── Per-job Markup Overrides (Task #388: Markup Engine) ───
  // When set, these override the business-level defaults for this specific job.
  // null = use business default. Priority: per-line > per-job > business default > 20%.
  materialMarkupPct: decimal("material_markup_pct", { precision: 5, scale: 2 }),
  equipmentMarkupPct: decimal("equipment_markup_pct", { precision: 5, scale: 2 }),
  subcontractorMarkupPct: decimal("subcontractor_markup_pct", { precision: 5, scale: 2 }),
  // Optional budget for the job (used in budget vs actual tracking)
  budgetedCost: decimal("budgeted_cost", { precision: 10, scale: 2 }),
  // Job type: 'service' (simple call-out) or 'project' (multi-phase, tracked spend).
  // Controls which tabs appear in job detail (phases, claims, POs only show for projects).
  // Null or 'service' = simple service call (default behaviour).
  jobType: text("job_type").default('service'), // 'service' | 'project'
  // Default retention rate used when new progress claims are created for this job.
  retentionPercent: decimal("retention_percent", { precision: 5, scale: 2 }).notNull().default('0.00'),
  // Auto-generated job number (e.g., GEM1001). Set when businessSettings.jobPrefix is configured.
  jobNumber: text("job_number"),
  // Stable client request identifier used to recover setup work after a mobile
  // process interruption between project creation and document upload.
  creationRequestId: varchar("creation_request_id", { length: 100 }),
  // Retention / holdback ledger fields (for project-type jobs with progress claims)
  // practicalCompletionDate: the date the project reached practical completion (PC)
  // defectsLiabilityMonths: DLP period in months after PC; retention is due at PC + DLP
  practicalCompletionDate: date("practical_completion_date"),
  defectsLiabilityMonths: integer("defects_liability_months").default(12),
  // Set when the automated retention-due email has been sent (prevents duplicate sends).
  retentionDueSentAt: timestamp("retention_due_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_jobs_user_id").on(table.userId),
  index("idx_jobs_client_id").on(table.clientId),
  uniqueIndex("uq_jobs_user_creation_request_id")
    .on(table.userId, table.creationRequestId)
    .where(sql`${table.creationRequestId} IS NOT NULL`),
]);

export const jobPhases = pgTable("job_phases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  phaseCode: text("phase_code").notNull(), // Short code e.g. P01, FOUND, FRAME
  name: text("name").notNull(),            // Human name e.g. "Site Preparation"
  description: text("description"),
  scheduledStart: timestamp("scheduled_start"),
  scheduledEnd: timestamp("scheduled_end"),
  bookedHours: decimal("booked_hours", { precision: 10, scale: 2 }),
  budgetedHours: decimal("budgeted_hours", { precision: 10, scale: 2 }),
  budgetedCost: decimal("budgeted_cost", { precision: 12, scale: 2 }),
  status: text("status").notNull().default('not_started'), // not_started | in_progress | complete | invoiced
  sortOrder: integer("sort_order").default(0),
  notes: text("notes"),
  // Worker assigned to own this phase (single-select from the job's assigned workers)
  assignedUserId: varchar("assigned_user_id").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_job_phases_job_id").on(table.jobId),
  index("idx_job_phases_user_id").on(table.userId),
  index("idx_job_phases_assigned_user_id").on(table.assignedUserId),
]);

// A phase can have a lead assignee (job_phases.assigned_user_id, retained for
// compatibility) plus any number of additional team members. Keep this
// normalized so phase membership is queryable and duplicate-safe.
export const jobPhaseAssignments = pgTable("job_phase_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phaseId: varchar("phase_id").notNull().references(() => jobPhases.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  isLead: boolean("is_lead").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("uq_job_phase_assignments_phase_user").on(table.phaseId, table.userId),
  index("idx_job_phase_assignments_phase_id").on(table.phaseId),
  index("idx_job_phase_assignments_user_id").on(table.userId),
]);
export const serviceReminders = pgTable("service_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  serviceType: varchar("service_type", { length: 100 }).notNull(),
  nextDueDate: timestamp("next_due_date").notNull(),
  intervalMonths: integer("interval_months"),
  reminderDays: integer("reminder_days").default(14),
  reminderSentAt: timestamp("reminder_sent_at"),
  status: varchar("status", { length: 20 }).default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_service_reminders_job_id").on(table.jobId),
  index("idx_service_reminders_client_id").on(table.clientId),
  index("idx_service_reminders_user_id").on(table.userId),
]);

export type ServiceReminder = typeof serviceReminders.$inferSelect;
export const insertServiceReminderSchema = createInsertSchema(serviceReminders).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertServiceReminder = z.infer<typeof insertServiceReminderSchema>;

// Job Checklist Items
export const checklistItems = pgTable("checklist_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  text: text("text").notNull(),
  isCompleted: boolean("is_completed").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_checklist_items_job_id").on(table.jobId),
]);

// Job Check-ins for location tracking
export const jobCheckins = pgTable("job_checkins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text("type").notNull().default('checkin'), // checkin, checkout
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  accuracy: decimal("accuracy", { precision: 10, scale: 2 }), // GPS accuracy in meters
  address: text("address"), // Reverse geocoded address
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_job_checkins_job_id").on(table.jobId),
  index("idx_job_checkins_user_id").on(table.userId),
]);

export type JobCheckin = typeof jobCheckins.$inferSelect;
export const insertJobCheckinSchema = createInsertSchema(jobCheckins).omit({ id: true, createdAt: true });
export type InsertJobCheckin = z.infer<typeof insertJobCheckinSchema>;

// Quotes
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  number: text("number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default('draft'), // draft, sent, accepted, declined
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default('0.00'),
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).notNull().default('0.00'),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default('0.00'),
  validUntil: timestamp("valid_until"),
  sentAt: timestamp("sent_at"),
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
  // Client acceptance tracking
  acceptanceToken: varchar("acceptance_token").unique(), // Secure token for public quote acceptance
  acceptedBy: text("accepted_by"), // Name of person who accepted
  acceptanceIp: text("acceptance_ip"), // IP address for audit trail
  acceptanceSignatureData: text("acceptance_signature_data"), // Base64 signature image from client
  declineReason: text("decline_reason"), // Optional reason if declined
  notes: text("notes"),
  photos: jsonb("photos").default([]),
  templateId: varchar("template_id"),
  familyKey: varchar("family_key"),
  // Deposit payment tracking
  depositRequired: boolean("deposit_required").default(false), // Whether deposit is required
  depositPercent: decimal("deposit_percent", { precision: 5, scale: 2 }), // Deposit percentage (e.g., 20.00 for 20%)
  depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }), // Calculated deposit amount
  depositPaid: boolean("deposit_paid").default(false), // Whether deposit has been paid
  depositPaidAt: timestamp("deposit_paid_at"), // When deposit was paid
  depositPaymentIntentId: varchar("deposit_payment_intent_id"), // Stripe payment intent ID
  archivedAt: timestamp("archived_at"), // When the quote was archived
  // Multi-option interactive quotes
  isMultiOption: boolean("is_multi_option").default(false), // Whether quote has multiple options for client to choose
  selectedOptionId: varchar("selected_option_id"), // Which option the client selected (if multi-option)
  // Xero integration tracking
  isXeroImport: boolean("is_xero_import").default(false), // Whether quote was imported from Xero
  xeroQuoteId: varchar("xero_quote_id"), // Xero quote ID
  xeroContactId: varchar("xero_contact_id"), // Xero contact ID for client mapping
  xeroSyncedAt: timestamp("xero_synced_at"), // When quote was last synced with Xero
  // Trade-specific custom fields (stored as JSON object keyed by field ID)
  customFields: jsonb("custom_fields").default({}),
  // Document-level template settings (locked at creation time - won't change if business template changes later)
  documentTemplate: text("document_template"), // modern, professional, minimal - copied from business settings at creation
  documentTemplateSettings: json("document_template_settings"), // Custom overrides for template - copied from business settings at creation
  // Task #115: marks rows created by the "Try with sample data" onboarding toggle.
  isSample: boolean("is_sample").default(false).notNull(),
  // Import traceability: which import created this row (null = created in-app)
  importRunId: varchar("import_run_id"),
  importRowNumber: integer("import_row_number"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_quotes_user_id").on(table.userId),
  index("idx_quotes_client_id").on(table.clientId),
  index("idx_quotes_job_id").on(table.jobId),
]);

// Quote Options (for multi-option interactive quotes)
export const quoteOptions = pgTable("quote_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  name: text("name").notNull(), // e.g., "Option A: Basic", "Option B: Premium", "Option C: Complete"
  description: text("description"), // Optional description explaining this option
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default('0.00'),
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).notNull().default('0.00'),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default('0.00'),
  isRecommended: boolean("is_recommended").default(false), // Mark one as recommended
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_quote_options_quote_id").on(table.quoteId),
]);

export type QuoteOption = typeof quoteOptions.$inferSelect;
export const insertQuoteOptionSchema = createInsertSchema(quoteOptions).omit({ id: true, createdAt: true });
export type InsertQuoteOption = z.infer<typeof insertQuoteOptionSchema>;

// Quote Line Items
export const quoteLineItems = pgTable("quote_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  optionId: varchar("option_id").references(() => quoteOptions.id, { onDelete: 'cascade' }), // For multi-option quotes
  itemCode: text("item_code"), // Optional item/service code (e.g. NDIS support item number)
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default('1.00'),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull().default('0.00'),
  cost: decimal("cost", { precision: 10, scale: 2 }), // Optional cost per unit for profit margin calculation
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default('0.00'),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_quote_line_items_quote_id").on(table.quoteId),
  index("idx_quote_line_items_option_id").on(table.optionId),
]);

// Quote Version History
export const quoteVersions = pgTable("quote_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  versionNumber: integer("version_number").notNull(),
  editedBy: varchar("edited_by"),
  changeNote: text("change_note"),
  snapshot: jsonb("snapshot").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_quote_versions_quote_id").on(table.quoteId),
]);

export type QuoteVersion = typeof quoteVersions.$inferSelect;
export type InsertQuoteVersion = typeof quoteVersions.$inferInsert;

// Invoices
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  quoteId: varchar("quote_id").references(() => quotes.id, { onDelete: 'set null' }),
  number: text("number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default('draft'), // draft, sent, paid, overdue
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default('0.00'),
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).notNull().default('0.00'),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default('0.00'),
  dueDate: timestamp("due_date"),
  sentAt: timestamp("sent_at"),
  paidAt: timestamp("paid_at"),
  receiptSentAt: timestamp("receipt_sent_at"), // When payment receipt email was sent
  // Payment tracking
  paymentReference: text("payment_reference"), // Reference number for payment
  paymentMethod: text("payment_method"), // bank_transfer, cash, card, stripe
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeInvoiceId: text("stripe_invoice_id"),
  allowOnlinePayment: boolean("allow_online_payment").default(false), // Enable card payment via Stripe Connect
  paymentToken: text("payment_token").unique(), // Secure token for public payment URL
  stripePaymentLink: text("stripe_payment_link"), // Pre-generated Stripe checkout session URL
  notes: text("notes"),
  photos: jsonb("photos").default([]),
  templateId: varchar("template_id"),
  familyKey: varchar("family_key"),
  // Recurring invoice settings
  isRecurring: boolean("is_recurring").default(false),
  recurrencePattern: text("recurrence_pattern"), // weekly, fortnightly, monthly, quarterly, yearly
  recurrenceInterval: integer("recurrence_interval").default(1),
  recurrenceEndDate: timestamp("recurrence_end_date"),
  parentInvoiceId: varchar("parent_invoice_id"), // Links to original recurring invoice
  nextRecurrenceDate: timestamp("next_recurrence_date"),
  archivedAt: timestamp("archived_at"), // When the invoice was archived
  // Xero integration tracking
  isXeroImport: boolean("is_xero_import").default(false), // Whether invoice was imported from Xero
  xeroInvoiceId: varchar("xero_invoice_id"), // Xero invoice ID to prevent duplicate pushes
  xeroContactId: varchar("xero_contact_id"), // Xero contact ID for client mapping
  xeroSyncedAt: timestamp("xero_synced_at"), // When invoice was last synced to Xero
  // QuickBooks integration tracking
  quickbooksInvoiceId: varchar("quickbooks_invoice_id"), // QuickBooks invoice ID to prevent duplicate pushes
  quickbooksSyncedAt: timestamp("quickbooks_synced_at"), // When invoice was last synced to QuickBooks
  // Trade-specific custom fields (stored as JSON object keyed by field ID)
  customFields: jsonb("custom_fields").default({}),
  // Document-level template settings (locked at creation time - won't change if business template changes later)
  documentTemplate: text("document_template"), // modern, professional, minimal - copied from business settings at creation
  documentTemplateSettings: json("document_template_settings"), // Custom overrides for template - copied from business settings at creation
  lockedAt: timestamp("locked_at"),
  lockedReason: text("locked_reason"),
  calculationHash: text("calculation_hash"),
  retentionPercent: decimal("retention_percent", { precision: 5, scale: 2 }),
  retentionAmount: decimal("retention_amount", { precision: 10, scale: 2 }),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).default('0.00'),
  paymentMilestones: jsonb("payment_milestones"),
  depositRequired: boolean("deposit_required").default(false),
  depositPercent: decimal("deposit_percent", { precision: 5, scale: 2 }),
  depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }),
  depositPaid: boolean("deposit_paid").default(false),
  depositPaidAt: timestamp("deposit_paid_at"),
  // Task #115: marks rows created by the "Try with sample data" onboarding toggle.
  isSample: boolean("is_sample").default(false).notNull(),
  // Import traceability: which import created this row (null = created in-app)
  importRunId: varchar("import_run_id"),
  importRowNumber: integer("import_row_number"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_invoices_user_id").on(table.userId),
  index("idx_invoices_client_id").on(table.clientId),
  index("idx_invoices_job_id").on(table.jobId),
  index("idx_invoices_quote_id").on(table.quoteId),
]);

// Invoice Line Items
export const invoiceLineItems = pgTable("invoice_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  itemCode: text("item_code"), // Optional item/service code (e.g. NDIS support item number)
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default('1.00'),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull().default('0.00'),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default('0.00'),
  sortOrder: integer("sort_order").default(0),
  sourceType: text("source_type"),
  sourceId: varchar("source_id"),
  rateSnapshot: decimal("rate_snapshot", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_invoice_line_items_invoice_id").on(table.invoiceId),
]);

// Payment Requests - for phone-to-phone payments (like ServiceM8's Scan & Pay)
export const paymentRequests = pgTable("payment_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: 'set null' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: 'set null' }),
  // Optional link to a subcontractor invoice (subbie -> business owner card payment)
  subcontractorInvoiceId: varchar("subcontractor_invoice_id"),
  // Payment details
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).notNull().default('0.00'),
  description: text("description").notNull(),
  reference: text("reference"), // Custom reference for tradie
  // Secure token for public access (QR code / link)
  token: text("token").notNull().unique(),
  // Status: pending, paid, expired, cancelled
  status: text("status").notNull().default('pending'),
  // Stripe payment tracking
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeClientSecret: text("stripe_client_secret"),
  // Payment completion
  paidAt: timestamp("paid_at"),
  paymentMethod: text("payment_method"), // card, apple_pay, google_pay
  // Expiry and metadata
  expiresAt: timestamp("expires_at"), // Optional expiry time
  qrCodeUrl: text("qr_code_url"), // Generated QR code data URL
  notificationsSent: jsonb("notifications_sent").default([]), // Track SMS/email sent
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_payment_requests_user_id").on(table.userId),
  index("idx_payment_requests_invoice_id").on(table.invoiceId),
  index("idx_payment_requests_job_id").on(table.jobId),
  index("idx_payment_requests_client_id").on(table.clientId),
]);

// Payment Receipts - professional receipts stored and linked to jobs
export const receipts = pgTable("receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: 'set null' }),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: 'set null' }),
  paymentRequestId: varchar("payment_request_id").references(() => paymentRequests.id, { onDelete: 'set null' }),
  // Receipt identification
  receiptNumber: text("receipt_number").notNull().unique(), // Format: REC-0001
  // Payment details
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).default('0.00'),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default('0.00'),
  description: text("description"),
  paymentMethod: text("payment_method"), // card, tap_to_pay, bank_transfer, cash, qr_code
  paymentReference: text("payment_reference"), // External payment ID (Stripe, etc.)
  // Timestamps
  paidAt: timestamp("paid_at").notNull(),
  // PDF and signature
  pdfUrl: text("pdf_url"), // Stored PDF URL
  signatureUrl: text("signature_url"), // On-site signature capture
  // Delivery tracking
  emailSentAt: timestamp("email_sent_at"),
  smsSentAt: timestamp("sms_sent_at"),
  recipientEmail: text("recipient_email"),
  recipientPhone: text("recipient_phone"),
  // Public access token for SMS links
  viewToken: text("view_token").unique(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_receipts_user_id").on(table.userId),
  index("idx_receipts_job_id").on(table.jobId),
  index("idx_receipts_invoice_id").on(table.invoiceId),
  index("idx_receipts_client_id").on(table.clientId),
  index("idx_receipts_payment_request_id").on(table.paymentRequestId),
]);

export const insertReceiptSchema = createInsertSchema(receipts).omit({ id: true, createdAt: true });
export type InsertReceipt = z.infer<typeof insertReceiptSchema>;
export type Receipt = typeof receipts.$inferSelect;

// Rebates / Credits (manufacturer rebates, government incentives, etc.)
export const rebates = pgTable("rebates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: 'set null' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: 'set null' }),
  rebateType: varchar("rebate_type", { length: 50 }).notNull(), // manufacturer, government, other
  name: varchar("name", { length: 255 }).notNull(), // "Daikin Cashback", "Solar Rebate VIC"
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending"), // pending, submitted, approved, received, rejected
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  receivedAt: timestamp("received_at"),
  expiryDate: timestamp("expiry_date"),
  referenceNumber: varchar("reference_number", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_rebates_user_id").on(table.userId),
  index("idx_rebates_client_id").on(table.clientId),
  index("idx_rebates_job_id").on(table.jobId),
  index("idx_rebates_invoice_id").on(table.invoiceId),
]);

export const insertRebateSchema = createInsertSchema(rebates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRebate = z.infer<typeof insertRebateSchema>;
export type Rebate = typeof rebates.$inferSelect;

// Document Templates  
export const documentTemplates = pgTable("document_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text("type").notNull(), // 'job', 'quote', 'invoice'
  familyKey: varchar("family_key").notNull(), // Links quote and invoice templates
  name: text("name").notNull(),
  tradeType: text("trade_type").notNull(), // 'plumbing', 'electrical', etc.
  rateCardId: varchar("rate_card_id"),
  styling: json("styling").default({}), // { logoUrl?, brandColor? }
  sections: json("sections").default({}), // { showHeader, showLineItems, showTotals, showTerms, showSignature }
  defaults: json("defaults").default({}), // { title, description, terms, depositPct?, dueTermDays?, gstEnabled? }
  defaultLineItems: json("default_line_items").default([]), // [{ catalogItemId? | inline { description, qty, unitPrice }}]
  isDefault: boolean("is_default").default(false), // System-provided default template
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_document_templates_user_id").on(table.userId),
]);

// Line Item Catalog
export const lineItemCatalog = pgTable("line_item_catalog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  tradeType: text("trade_type").notNull(),
  itemCode: text("item_code"), // Optional item/service code (e.g. NDIS support item number)
  name: text("name").notNull(),
  description: text("description").notNull(),
  unit: text("unit").notNull(), // 'hour', 'item', 'm', 'sqm'
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull().default('0.00'),
  defaultQty: decimal("default_qty", { precision: 10, scale: 2 }).default('1.00'),
  tags: json("tags").default([]), // string[]
  // Import traceability: which import created this row (null = created in-app)
  importRunId: varchar("import_run_id"),
  importRowNumber: integer("import_row_number"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_line_item_catalog_user_id").on(table.userId),
]);

// Rate Cards
export const rateCards = pgTable("rate_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  tradeType: text("trade_type").notNull(),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).notNull().default('100.00'),
  calloutFee: decimal("callout_fee", { precision: 10, scale: 2 }).notNull().default('80.00'),
  materialMarkupPct: decimal("material_markup_pct", { precision: 5, scale: 2 }).default('20.00'),
  afterHoursMultiplier: decimal("after_hours_multiplier", { precision: 3, scale: 2 }).default('1.50'),
  gstEnabled: boolean("gst_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_rate_cards_user_id").on(table.userId),
]);

export const quoteTemplates = pgTable("quote_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  tradeType: text("trade_type").default('general'),
  jobType: text("job_type"),
  items: jsonb("items").notNull().default('[]'),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_quote_templates_user_id").on(table.userId),
]);

// Style Presets for Document Templates
export const stylePresets = pgTable("style_presets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  isDefault: boolean("is_default").default(false),
  // Branding
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default('#1e40af'), // Blue
  accentColor: text("accent_color").default('#059669'), // Green
  // Typography
  fontFamily: text("font_family").default('Inter'),
  headerFontSize: text("header_font_size").default('24px'),
  bodyFontSize: text("body_font_size").default('14px'),
  // Layout Options - maps to document template IDs: 'professional', 'modern', 'minimal'
  headerLayout: text("header_layout").default('professional'),
  footerLayout: text("footer_layout").default('standard'),
  showLogo: boolean("show_logo").default(true),
  showBusinessDetails: boolean("show_business_details").default(true),
  showBankDetails: boolean("show_bank_details").default(true),
  // Spacing & Borders
  tableBorders: boolean("table_borders").default(true),
  alternateRowColors: boolean("alternate_row_colors").default(true),
  compactMode: boolean("compact_mode").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_style_presets_user_id").on(table.userId),
]);

export const insertStylePresetSchema = createInsertSchema(stylePresets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStylePreset = z.infer<typeof insertStylePresetSchema>;
export type StylePreset = typeof stylePresets.$inferSelect;

// Zod schemas for inserts
export const insertBusinessSettingsSchema = createInsertSchema(businessSettings).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Drizzle-zod infers a loose record type for the json() column, which doesn't
  // match the typed number[] Drizzle expects on insert/update. Pin it so the
  // storage layer's typed .set()/.values() accept the owner's work-day list.
  workDays: z.array(z.number()).optional().nullable(),
  // Same drizzle-zod json inference quirk for the sheet sync data-type list.
  sheetSyncDataTypes: z.array(z.string()).optional().nullable(),
  sheetSyncRecipients: z.array(z.string()).optional().nullable(),
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Validate email format when a real value is provided; allow empty/null so
  // clients without an email still save.
  email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  retentionPercent: z.coerce.string().optional().nullable().refine(
    (value) => value === null || value === undefined || (Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100),
    { message: "Retention percent must be between 0 and 100" },
  ),
});

export const insertChecklistItemSchema = createInsertSchema(checklistItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateChecklistItemSchema = insertChecklistItemSchema.omit({
  jobId: true, // Prevent jobId changes via updates
});
export type InsertChecklistItem = z.infer<typeof insertChecklistItemSchema>;
export type UpdateChecklistItem = z.infer<typeof updateChecklistItemSchema>;
export type ChecklistItem = typeof checklistItems.$inferSelect;

export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  number: z.string().optional(), // Auto-generate if not provided
  status: z.string().optional(), // Default to 'draft' if not provided
  // Coerce date fields to handle both Date objects and ISO strings from frontend
  validUntil: z.coerce.date().optional(),
  // Coerce decimal fields to handle both string and number inputs from frontend
  subtotal: z.coerce.string().optional(),
  gstAmount: z.coerce.string().optional(),
  total: z.coerce.string().optional(),
  // Use preprocess for nullable decimal fields to bypass coercion for null values
  depositPercent: z.preprocess(
    (v) => (v === null || v === undefined ? null : v),
    z.coerce.string().nullable()
  ).optional(),
  depositAmount: z.preprocess(
    (v) => (v === null || v === undefined ? null : v),
    z.coerce.string().nullable()
  ).optional(),
});

export const updateQuoteSchema = insertQuoteSchema.partial().extend({
  sentAt: z.coerce.date().optional(),
  acceptedAt: z.coerce.date().optional(),
  rejectedAt: z.coerce.date().optional(),
});

export const insertQuoteLineItemSchema = createInsertSchema(quoteLineItems).omit({
  id: true,
  createdAt: true,
}).extend({
  // Coerce decimal fields to handle both string and number inputs from frontend
  quantity: z.coerce.string().optional(),
  unitPrice: z.coerce.string().optional(),
  total: z.coerce.string().optional(),
  // Cost is nullable - use preprocess to handle null values
  cost: z.preprocess(
    (v) => (v === null || v === undefined ? null : v),
    z.coerce.string().nullable()
  ).optional(),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  number: z.string().optional(), // Auto-generate if not provided
  // Coerce date fields to handle both Date objects and ISO strings from frontend
  dueDate: z.coerce.date().optional(),
  // Coerce decimal fields to handle both string and number inputs from frontend
  subtotal: z.coerce.string().optional(),
  gstAmount: z.coerce.string().optional(),
  total: z.coerce.string().optional(),
  // Use preprocess for nullable decimal fields to bypass coercion for null values
  amountPaid: z.preprocess(
    (v) => (v === null || v === undefined ? null : v),
    z.coerce.string().nullable()
  ).optional(),
  depositRequired: z.boolean().optional(),
  depositPercent: z.preprocess(
    (v) => (v === null || v === undefined ? null : v),
    z.coerce.string().nullable()
  ).optional(),
  depositAmount: z.preprocess(
    (v) => (v === null || v === undefined ? null : v),
    z.coerce.string().nullable()
  ).optional(),
  depositPaid: z.boolean().optional(),
  depositPaidAt: z.coerce.date().optional().nullable(),
});

export const updateInvoiceSchema = insertInvoiceSchema.partial().extend({
  sentAt: z.coerce.date().optional(),
  paidAt: z.coerce.date().optional(),
});

export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems).omit({
  id: true,
  createdAt: true,
}).extend({
  // Coerce decimal fields to handle both string and number inputs from frontend
  quantity: z.coerce.string().optional(),
  unitPrice: z.coerce.string().optional(),
  total: z.coerce.string().optional(),
});

// Payment Request schemas
export const insertPaymentRequestSchema = createInsertSchema(paymentRequests).omit({
  id: true,
  userId: true,
  token: true, // Generated server-side
  createdAt: true,
  updatedAt: true,
});

export const updatePaymentRequestSchema = insertPaymentRequestSchema.partial().extend({
  status: z.enum(['pending', 'paid', 'expired', 'cancelled']).optional(),
  paidAt: z.coerce.date().optional(),
});

// Types
export type InsertBusinessSettings = z.infer<typeof insertBusinessSettingsSchema>;
export type BusinessSettings = typeof businessSettings.$inferSelect;

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;
export type ImportRun = typeof importRuns.$inferSelect;
export type InsertImportRun = typeof importRuns.$inferInsert;

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

export type InsertQuoteLineItem = z.infer<typeof insertQuoteLineItemSchema>;
export type QuoteLineItem = typeof quoteLineItems.$inferSelect;

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

export type InsertInvoiceLineItem = z.infer<typeof insertInvoiceLineItemSchema>;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;

export type InsertPaymentRequest = z.infer<typeof insertPaymentRequestSchema>;
export type PaymentRequest = typeof paymentRequests.$inferSelect;

// Template system schemas
export const insertDocumentTemplateSchema = createInsertSchema(documentTemplates).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLineItemCatalogSchema = createInsertSchema(lineItemCatalog).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const priceListItems = pgTable("price_list_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull().default('0.00'),
  category: text("category").default('General'),
  unit: text("unit").default('each'), // each, hour, m², m, kg, l, day, week, etc.
  itemType: text("item_type").notNull().default('service'), // service, material, equipment
  tradeType: text("trade_type"), // plumbing, electrical, general, etc.
  defaultQuantity: decimal("default_quantity", { precision: 10, scale: 2 }).default('1.00'),
  gstIncluded: boolean("gst_included").default(true),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_price_list_items_user_id").on(table.userId),
  index("idx_price_list_items_item_type").on(table.itemType),
]);
export const insertRateCardSchema = createInsertSchema(rateCards).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

// Template system types
export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;

export type InsertLineItemCatalog = z.infer<typeof insertLineItemCatalogSchema>;
export type LineItemCatalog = typeof lineItemCatalog.$inferSelect;

export type InsertRateCard = z.infer<typeof insertRateCardSchema>;
export type RateCard = typeof rateCards.$inferSelect;

export const insertQuoteTemplateSchema = createInsertSchema(quoteTemplates).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertQuoteTemplate = z.infer<typeof insertQuoteTemplateSchema>;
export type QuoteTemplate = typeof quoteTemplates.$inferSelect;

// Template Analysis Jobs - for AI-powered template extraction from PDFs
export const templateAnalysisJobs = pgTable("template_analysis_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  templateType: text("template_type").notNull(), // 'quote' | 'invoice'
  originalFileName: text("original_file_name").notNull(),
  originalFileKey: text("original_file_key").notNull(), // Object storage key
  status: text("status").notNull().default('pending'), // 'pending' | 'processing' | 'completed' | 'failed'
  analysisResult: jsonb("analysis_result"), // GPT analysis output
  error: text("error"),
  createdTemplateId: varchar("created_template_id").references(() => documentTemplates.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_template_analysis_jobs_user_id").on(table.userId),
  index("idx_template_analysis_jobs_created_template_id").on(table.createdTemplateId),
]);

export const insertTemplateAnalysisJobSchema = createInsertSchema(templateAnalysisJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTemplateAnalysisJob = z.infer<typeof insertTemplateAnalysisJobSchema>;
export type TemplateAnalysisJob = typeof templateAnalysisJobs.$inferSelect;

export const insertIntegrationSettingsSchema = createInsertSchema(integrationSettings).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertIntegrationSettings = z.infer<typeof insertIntegrationSettingsSchema>;
export type IntegrationSettings = typeof integrationSettings.$inferSelect;

// ===== ADVANCED FEATURES SCHEMAS =====

// Inventory Management
export const inventoryCategories = pgTable("inventory_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_inventory_categories_user_id").on(table.userId),
]);

export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  categoryId: varchar("category_id").references(() => inventoryCategories.id, { onDelete: 'set null' }),
  name: text("name").notNull(),
  description: text("description"),
  sku: text("sku"),
  barcode: text("barcode"),
  unit: text("unit").default('each'), // each, box, m, kg, etc.
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
  sellPrice: decimal("sell_price", { precision: 10, scale: 2 }),
  currentStock: integer("current_stock").default(0),
  minimumStock: integer("minimum_stock").default(0),
  maximumStock: integer("maximum_stock"),
  reorderLevel: integer("reorder_level").default(0),
  reorderQuantity: integer("reorder_quantity"),
  supplierId: varchar("supplier_id").references(() => suppliers.id, { onDelete: 'restrict' }),
  location: text("location"), // warehouse location/bin
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_inventory_items_user_id").on(table.userId),
  index("idx_inventory_items_category_id").on(table.categoryId),
]);

export const inventoryTransactions = pgTable("inventory_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  itemId: varchar("item_id").notNull().references(() => inventoryItems.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'cascade' }),
  type: text("type").notNull(), // 'in', 'out', 'adjustment'
  quantity: integer("quantity").notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  reference: text("reference"), // PO number, job reference, etc.
  notes: text("notes"),
  transactionDate: timestamp("transaction_date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_inventory_transactions_user_id").on(table.userId),
  index("idx_inventory_transactions_item_id").on(table.itemId),
  index("idx_inventory_transactions_job_id").on(table.jobId),
]);

// Time Tracking
// Time entry categories for billable/non-billable tracking
export const TIME_ENTRY_CATEGORIES = {
  work: 'work',           // Client-billable work (default)
  travel: 'travel',       // Travel time to/from job sites
  admin: 'admin',         // Paperwork, phone calls, emails
  training: 'training',   // Courses, certifications, learning
  meeting: 'meeting',     // Team meetings, client meetings
  materials: 'materials', // Picking up materials/supplies
} as const;

export type TimeEntryCategory = typeof TIME_ENTRY_CATEGORIES[keyof typeof TIME_ENTRY_CATEGORIES];

export const timeEntries = pgTable("time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'cascade' }),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  duration: integer("duration"), // in minutes
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  description: text("description"),
  isBreak: boolean("is_break").default(false),
  isOvertime: boolean("is_overtime").default(false),
  // Billable/Non-Billable time tracking (competitor feature from Tradify)
  isBillable: boolean("is_billable").default(true),
  timeCategory: text("time_category").default('work'), // work, travel, admin, training, meeting, materials
  approved: boolean("approved").default(false),
  approvedBy: varchar("approved_by").references(() => users.id),
  // Origin tracking for geofence-triggered entries
  origin: text("origin").default('manual'), // manual, geofence
  geofenceEventId: varchar("geofence_event_id"), // Link to triggering geofence event
  // Auto-save heartbeat tracking - last time the timer was confirmed active
  lastHeartbeat: timestamp("last_heartbeat"),
  // Device clock offset tracking - for legal defensibility of time tracking
  // Stores the offset in seconds between device clock and server time
  // Positive means device is ahead, negative means behind
  // Allows reconstruction of actual time even if device clock was wrong
  deviceTimeOffset: integer("device_time_offset"),
  clockInLatitude: decimal("clock_in_latitude", { precision: 10, scale: 7 }),
  clockInLongitude: decimal("clock_in_longitude", { precision: 10, scale: 7 }),
  clockInAddress: text("clock_in_address"),
  clockOutLatitude: decimal("clock_out_latitude", { precision: 10, scale: 7 }),
  clockOutLongitude: decimal("clock_out_longitude", { precision: 10, scale: 7 }),
  clockOutAddress: text("clock_out_address"),
  isDisputed: boolean("is_disputed").default(false),
  disputeReason: text("dispute_reason"),
  disputedAt: timestamp("disputed_at"),
  disputeResolvedAt: timestamp("dispute_resolved_at"),
  disputeResolution: text("dispute_resolution"),
  // Driving/travel distance tracking — populated when timeCategory = 'travel'
  distanceKm: decimal("distance_km", { precision: 10, scale: 2 }),
  // Optional phase tag — when set, overrides date-window attribution in the profitability breakdown
  phaseId: varchar("phase_id").references(() => jobPhases.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_time_entries_user_id").on(table.userId),
  index("idx_time_entries_job_id").on(table.jobId),
  index("idx_time_entries_approved_by").on(table.approvedBy),
]);

export const timesheets = pgTable("timesheets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  weekStarting: timestamp("week_starting").notNull(),
  totalHours: decimal("total_hours", { precision: 10, scale: 2 }).default('0.00'),
  regularHours: decimal("regular_hours", { precision: 10, scale: 2 }).default('0.00'),
  overtimeHours: decimal("overtime_hours", { precision: 10, scale: 2 }).default('0.00'),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default('0.00'),
  status: text("status").default('draft'), // draft, submitted, approved, paid
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_timesheets_user_id").on(table.userId),
  index("idx_timesheets_approved_by").on(table.approvedBy),
]);

// Time Entry Edit Audit Trail
export const timeEntryEdits = pgTable("time_entry_edits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timeEntryId: varchar("time_entry_id").notNull().references(() => timeEntries.id, { onDelete: 'cascade' }),
  editedBy: varchar("edited_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  editedAt: timestamp("edited_at").defaultNow(),
  editReason: text("edit_reason"),
  fieldChanged: text("field_changed").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  editSource: text("edit_source").default('manual'),
}, (table) => [
  index("idx_time_entry_edits_time_entry_id").on(table.timeEntryId),
  index("idx_time_entry_edits_edited_by").on(table.editedBy),
]);

// Invoice Edit Audit Trail - financial-grade versioning
export const invoiceEdits = pgTable("invoice_edits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  editedBy: varchar("edited_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  editedAt: timestamp("edited_at").defaultNow(),
  editReason: text("edit_reason"),
  fieldChanged: text("field_changed").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  editSource: text("edit_source").default('manual'),
}, (table) => [
  index("idx_invoice_edits_invoice_id").on(table.invoiceId),
  index("idx_invoice_edits_edited_by").on(table.editedBy),
]);

export const insertTimeEntryEditSchema = createInsertSchema(timeEntryEdits).omit({ id: true, editedAt: true });
export type InsertTimeEntryEdit = z.infer<typeof insertTimeEntryEditSchema>;
export type TimeEntryEdit = typeof timeEntryEdits.$inferSelect;

export const timeEntryDisputeEvents = pgTable("time_entry_dispute_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timeEntryId: varchar("time_entry_id").notNull().references(() => timeEntries.id, { onDelete: 'cascade' }),
  action: text("action").notNull(),
  actorId: varchar("actor_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_time_entry_dispute_events_time_entry_id").on(table.timeEntryId),
  index("idx_time_entry_dispute_events_actor_id").on(table.actorId),
]);

export const insertTimeEntryDisputeEventSchema = createInsertSchema(timeEntryDisputeEvents).omit({ id: true, createdAt: true });
export type InsertTimeEntryDisputeEvent = z.infer<typeof insertTimeEntryDisputeEventSchema>;
export type TimeEntryDisputeEvent = typeof timeEntryDisputeEvents.$inferSelect;

export const insertInvoiceEditSchema = createInsertSchema(invoiceEdits).omit({ id: true, editedAt: true });
export type InsertInvoiceEdit = z.infer<typeof insertInvoiceEditSchema>;
export type InvoiceEdit = typeof invoiceEdits.$inferSelect;

// Expense Tracking
export const expenseCategories = pgTable("expense_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_expense_categories_user_id").on(table.userId),
]);

export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'cascade' }),
  categoryId: varchar("category_id").notNull().references(() => expenseCategories.id, { onDelete: 'cascade' }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).default('0.00'),
  description: text("description").notNull(),
  vendor: text("vendor"),
  receiptUrl: text("receipt_url"),
  receiptNumber: text("receipt_number"),
  expenseDate: timestamp("expense_date").notNull(),
  isBillable: boolean("is_billable").default(true),
  isRecurring: boolean("is_recurring").default(false),
  recurringFrequency: text("recurring_frequency"), // monthly, quarterly, yearly
  status: text("status").default('pending'), // pending, approved, rejected, reimbursed
  approvedBy: varchar("approved_by").references(() => users.id),
  rejectionReason: text("rejection_reason"),
  submittedByUserId: varchar("submitted_by_user_id").references(() => users.id),
  phaseId: varchar("phase_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_expenses_user_id").on(table.userId),
  index("idx_expenses_job_id").on(table.jobId),
  index("idx_expenses_category_id").on(table.categoryId),
  index("idx_expenses_approved_by").on(table.approvedBy),
  index("idx_expenses_phase_id").on(table.phaseId),
]);

// Team Management
export const userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  permissions: json("permissions").default([]), // ['read_jobs', 'write_jobs', 'manage_team', etc.]
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const teamMembers = pgTable("team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  memberId: varchar("member_id").references(() => users.id, { onDelete: 'cascade' }), // Nullable for pending invites
  roleId: varchar("role_id").notNull().references(() => userRoles.id, { onDelete: 'cascade' }),
  // Invite functionality
  email: text("email").notNull(), // Email for invites (before user account exists)
  firstName: text("first_name"), // For display before account exists
  lastName: text("last_name"), // For display before account exists
  phone: text("phone"), // Phone number for direct calls
  inviteStatus: text("invite_status").notNull().default('pending'), // 'pending', 'accepted', 'declined'
  inviteToken: text("invite_token"), // Token for accepting invite
  inviteSentAt: timestamp("invite_sent_at"),
  inviteAcceptedAt: timestamp("invite_accepted_at"),
  // Custom permissions override - allows per-user permission customization by owner
  customPermissions: json("custom_permissions"), // null = use role defaults, [] = custom list
  useCustomPermissions: boolean("use_custom_permissions").default(false), // Whether to use custom or role permissions
  // Location tracking control
  allowLocationSharing: boolean("allow_location_sharing").default(true),
  locationEnabledByOwner: boolean("location_enabled_by_owner").default(true),
  // Work hours GPS privacy — location only shared during these hours (unless active timer overrides)
  workHoursStart: text("work_hours_start").default('07:00'),
  workHoursEnd: text("work_hours_end").default('17:00'),
  workDays: json("work_days").$type<number[]>().default([1, 2, 3, 4, 5]),
  afterHoursGhostMode: boolean("after_hours_ghost_mode").default(false),
  whsRole: text("whs_role").default('none'),
  aiReceptionistAvailability: boolean("ai_receptionist_availability").default(true),
  availabilityStatus: text("availability_status").default('available'), // available, busy, unavailable - for subcontractor dashboard
  // Employment details
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_team_members_business_owner_id").on(table.businessOwnerId),
  index("idx_team_members_member_id").on(table.memberId),
  index("idx_team_members_role_id").on(table.roleId),
]);

export const inviteCodes = pgTable("invite_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  code: varchar("code", { length: 8 }).notNull().unique("invite_codes_code_key"),
  roleType: text("role_type").notNull().default('worker'),
  roleId: varchar("role_id").references(() => userRoles.id, { onDelete: 'set null' }),
  maxUses: integer("max_uses").notNull().default(10),
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_invite_codes_business_owner_id").on(table.businessOwnerId),
  index("idx_invite_codes_role_id").on(table.roleId),
]);

export const insertInviteCodeSchema = createInsertSchema(inviteCodes).omit({
  id: true,
  createdAt: true,
  usedCount: true,
});
export type InsertInviteCode = z.infer<typeof insertInviteCodeSchema>;
export type InviteCode = typeof inviteCodes.$inferSelect;

export const jobAssignments = pgTable("job_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  teamMemberId: varchar("team_member_id").references(() => teamMembers.id, { onDelete: 'set null' }),
  hourlyRateOverride: decimal("hourly_rate_override", { precision: 10, scale: 2 }),
  displayName: text("display_name"),
  hideNameOnInvoice: boolean("hide_name_on_invoice").default(false),
  isActive: boolean("is_active").default(true),
  assignedAt: timestamp("assigned_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  assignmentStatus: text("assignment_status").default('assigned'),
  workerDisplayNameSnapshot: text("worker_display_name_snapshot"),
  workerPhoneSnapshot: text("worker_phone_snapshot"),
  showWorkerPhoneToClient: boolean("show_worker_phone_to_client").default(false),
  showWorkerNameToClient: boolean("show_worker_name_to_client").default(true),
  lastSmsSentAt: timestamp("last_sms_sent_at"),
  travelStartedAt: timestamp("travel_started_at"),
  arrivedAt: timestamp("arrived_at"),
  etaMinutes: integer("eta_minutes"),
  etaUpdatedAt: timestamp("eta_updated_at"),
  acceptedAt: timestamp("accepted_at"),
  acceptedByName: text("accepted_by_name"),
  acceptanceSignatureData: text("acceptance_signature_data"),
  confidentialityAgreed: boolean("confidentiality_agreed").default(false),
  acceptanceIpAddress: text("acceptance_ip_address"),
  acceptanceUserAgent: text("acceptance_user_agent"),
  isPrimary: boolean("is_primary").default(false),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_job_assignments_job_id").on(table.jobId),
  index("idx_job_assignments_user_id").on(table.userId),
  index("idx_job_assignments_team_member_id").on(table.teamMemberId),
]);

export const insertJobAssignmentSchema = createInsertSchema(jobAssignments).omit({ id: true, createdAt: true, lastSmsSentAt: true, travelStartedAt: true, arrivedAt: true, etaUpdatedAt: true, acceptedAt: true, acceptanceSignatureData: true, acceptanceIpAddress: true, acceptanceUserAgent: true, completedAt: true });
export type InsertJobAssignment = z.infer<typeof insertJobAssignmentSchema>;
export type JobAssignment = typeof jobAssignments.$inferSelect;

export const staffSchedules = pgTable("staff_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'cascade' }),
  scheduledDate: timestamp("scheduled_date").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: text("status").default('scheduled'), // scheduled, in_progress, completed, cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_staff_schedules_user_id").on(table.userId),
  index("idx_staff_schedules_job_id").on(table.jobId),
]);

// Team Member Skills & Certifications - track qualifications with expiry dates
export const teamMemberSkills = pgTable("team_member_skills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: 'cascade' }),
  skillName: text("skill_name").notNull(), // e.g., "Electrical License", "White Card", "First Aid"
  skillType: text("skill_type").notNull().default('certification'), // 'certification', 'license', 'training', 'skill'
  licenseNumber: text("license_number"), // For licenses/certifications
  issueDate: timestamp("issue_date"),
  expiryDate: timestamp("expiry_date"), // null = no expiry
  isVerified: boolean("is_verified").default(false), // Owner has verified the documentation
  documentUrl: text("document_url"), // Uploaded proof document
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_team_member_skills_team_member_id").on(table.teamMemberId),
]);

// Team Member Availability - weekly work schedule preferences
export const teamMemberAvailability = pgTable("team_member_availability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: 'cascade' }),
  dayOfWeek: integer("day_of_week").notNull(), // 0 = Sunday, 1 = Monday, etc.
  isAvailable: boolean("is_available").default(true),
  startTime: text("start_time").default('08:00'), // HH:MM format
  endTime: text("end_time").default('17:00'), // HH:MM format
  notes: text("notes"), // e.g., "school pickup at 3pm"
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_team_member_availability_team_member_id").on(table.teamMemberId),
]);

// Team Member Time Off - leave requests and holidays
export const teamMemberTimeOff = pgTable("team_member_time_off", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: 'cascade' }),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  reason: text("reason").notNull(), // 'annual_leave', 'sick_leave', 'personal', 'public_holiday', 'other'
  status: text("status").default('pending'), // 'pending', 'approved', 'rejected'
  notes: text("notes"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  approverComment: text("approver_comment"), // Optional comment from manager when approving/declining
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_team_member_time_off_team_member_id").on(table.teamMemberId),
  index("idx_team_member_time_off_approved_by").on(table.approvedBy),
]);

// Team Member Emergency Contacts
export const teamMemberEmergencyContacts = pgTable("team_member_emergency_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  relationship: text("relationship").notNull(), // e.g. 'spouse', 'parent', 'sibling', 'friend'
  phone: text("phone").notNull(),
  secondaryPhone: text("secondary_phone"),
  isPrimary: boolean("is_primary").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_team_member_emergency_contacts_member_id").on(table.teamMemberId),
]);

export type TeamMemberEmergencyContact = typeof teamMemberEmergencyContacts.$inferSelect;
export type InsertTeamMemberEmergencyContact = typeof teamMemberEmergencyContacts.$inferInsert;

// Team Member Leave Balances — manually set by admin, updated when leave is approved
export const teamMemberLeaveBalances = pgTable("team_member_leave_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: 'cascade' }),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  year: integer("year").notNull(), // Calendar year (e.g. 2025)
  leaveType: text("leave_type").notNull(), // 'annual_leave', 'sick_leave', 'personal', 'other'
  accrued: decimal("accrued", { precision: 5, scale: 1 }).default('0'), // Days accrued (manually set)
  taken: decimal("taken", { precision: 5, scale: 1 }).default('0'), // Days taken (auto-updated on approve)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_team_member_leave_balances_member_id").on(table.teamMemberId),
  index("idx_team_member_leave_balances_owner_id").on(table.businessOwnerId),
  unique("uq_leave_balance_member_year_type").on(table.teamMemberId, table.year, table.leaveType),
]);

export type TeamMemberLeaveBalance = typeof teamMemberLeaveBalances.$inferSelect;
export type InsertTeamMemberLeaveBalance = typeof teamMemberLeaveBalances.$inferInsert;

// Permission Requests - team members can request additional permissions from owner/manager
export const permissionRequests = pgTable("permission_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: 'cascade' }),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  requestedPermissions: json("requested_permissions").notNull().$type<string[]>(), // Array of permission IDs
  reason: text("reason"), // Optional reason for the request
  status: text("status").notNull().default('pending'), // 'pending', 'approved', 'rejected'
  respondedBy: varchar("responded_by").references(() => users.id),
  respondedAt: timestamp("responded_at"),
  responseNote: text("response_note"), // Optional note from owner/manager
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_permission_requests_team_member_id").on(table.teamMemberId),
  index("idx_permission_requests_business_owner_id").on(table.businessOwnerId),
  index("idx_permission_requests_responded_by").on(table.respondedBy),
]);

// Job Assignment Requests - team members can request to be assigned to available jobs
export const jobAssignmentRequests = pgTable("job_assignment_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: 'cascade' }),
  requesterId: varchar("requester_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // The user who made the request
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  reason: text("reason"), // Optional reason/note for the request
  status: text("status").notNull().default('pending'), // 'pending', 'approved', 'rejected'
  respondedBy: varchar("responded_by").references(() => users.id),
  respondedAt: timestamp("responded_at"),
  responseNote: text("response_note"), // Optional note from owner/manager
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_job_assignment_requests_job_id").on(table.jobId),
  index("idx_job_assignment_requests_team_member_id").on(table.teamMemberId),
  index("idx_job_assignment_requests_requester_id").on(table.requesterId),
  index("idx_job_assignment_requests_business_owner_id").on(table.businessOwnerId),
  index("idx_job_assignment_requests_responded_by").on(table.respondedBy),
]);

// Team Member Performance Metrics - track productivity and ratings
export const teamMemberMetrics = pgTable("team_member_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: 'cascade' }),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  jobsCompleted: integer("jobs_completed").default(0),
  jobsOnTime: integer("jobs_on_time").default(0), // Completed before deadline
  totalHoursWorked: decimal("total_hours_worked", { precision: 10, scale: 2 }).default('0'),
  averageJobDuration: decimal("average_job_duration", { precision: 10, scale: 2 }), // hours
  customerRatingSum: decimal("customer_rating_sum", { precision: 10, scale: 2 }).default('0'),
  customerRatingCount: integer("customer_rating_count").default(0),
  callbackRate: decimal("callback_rate", { precision: 5, scale: 2 }), // % of jobs requiring callback
  revenueGenerated: decimal("revenue_generated", { precision: 12, scale: 2 }).default('0'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_team_member_metrics_team_member_id").on(table.teamMemberId),
]);

// GPS Tracking - Life360-style location with battery and activity
export const locationTracking = pgTable("location_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'cascade' }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  accuracy: decimal("accuracy", { precision: 10, scale: 2 }),
  address: text("address"),
  speed: decimal("speed", { precision: 10, scale: 2 }), // km/h
  heading: decimal("heading", { precision: 10, scale: 2 }), // degrees 0-360
  altitude: decimal("altitude", { precision: 10, scale: 2 }),
  // Life360-style additions
  batteryLevel: integer("battery_level"), // 0-100 percentage
  isCharging: boolean("is_charging").default(false),
  activityType: text("activity_type").default('stationary'), // stationary, walking, driving, working
  timestamp: timestamp("timestamp").notNull(),
  trackingType: text("tracking_type").default('automatic'), // automatic, manual, job_site
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_location_tracking_user_id").on(table.userId),
  index("idx_location_tracking_job_id").on(table.jobId),
]);

// Geofence Alerts - triggered when tradies enter/leave job sites
export const geofenceAlerts = pgTable("geofence_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  alertType: text("alert_type").notNull(), // 'arrival', 'departure'
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  address: text("address"),
  distanceFromSite: decimal("distance_from_site", { precision: 10, scale: 2 }), // meters
  isRead: boolean("is_read").default(false),
  dwellSeconds: integer("dwell_seconds"), // For 'departure' alerts: seconds spent on site since the matching arrival.
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_geofence_alerts_user_id").on(table.userId),
  index("idx_geofence_alerts_job_id").on(table.jobId),
  index("idx_geofence_alerts_business_owner_id").on(table.businessOwnerId),
]);

// GPS Signal Loss Logging - tracks when team members lose/regain GPS signal
export const gpsSignalLogs = pgTable("gps_signal_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  eventType: text("event_type").notNull(), // 'signal_lost', 'signal_regained'
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  accuracy: decimal("accuracy", { precision: 10, scale: 2 }),
  address: text("address"),
  batteryLevel: integer("battery_level"),
  isCharging: boolean("is_charging").default(false),
  durationSeconds: integer("duration_seconds"), // how long signal was lost (only on regained events)
  metadata: json("metadata"), // extra device info
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_gps_signal_logs_user_id").on(table.userId),
  index("idx_gps_signal_logs_business_owner_id").on(table.businessOwnerId),
  index("idx_gps_signal_logs_job_id").on(table.jobId),
]);

export type GpsSignalLog = typeof gpsSignalLogs.$inferSelect;
export const insertGpsSignalLogSchema = createInsertSchema(gpsSignalLogs).omit({ id: true, createdAt: true });
export type InsertGpsSignalLog = z.infer<typeof insertGpsSignalLogSchema>;

// Tradie Status - current activity and presence
export const tradieStatus = pgTable("tradie_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Current location
  currentLatitude: decimal("current_latitude", { precision: 10, scale: 7 }),
  currentLongitude: decimal("current_longitude", { precision: 10, scale: 7 }),
  currentAddress: text("current_address"),
  // Activity
  activityStatus: text("activity_status").default('offline'), // online, driving, working, break, offline
  currentJobId: varchar("current_job_id").references(() => jobs.id, { onDelete: 'set null' }),
  // Device info
  batteryLevel: integer("battery_level"),
  isCharging: boolean("is_charging").default(false),
  speed: decimal("speed", { precision: 10, scale: 2 }), // km/h
  heading: decimal("heading", { precision: 10, scale: 2 }), // degrees
  // Timestamps
  lastSeenAt: timestamp("last_seen_at"),
  lastLocationUpdate: timestamp("last_location_update"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_tradie_status_business_owner_id").on(table.businessOwnerId),
  index("idx_tradie_status_current_job_id").on(table.currentJobId),
]);

export const routes = pgTable("routes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  jobIds: json("job_ids").default([]), // Array of job IDs for this route
  startAddress: text("start_address"),
  endAddress: text("end_address"),
  waypoints: json("waypoints").default([]), // Array of addresses
  distance: decimal("distance", { precision: 10, scale: 2 }), // in kilometers
  estimatedDuration: integer("estimated_duration"), // in minutes
  actualDuration: integer("actual_duration"), // in minutes
  optimizedOrder: json("optimized_order").default([]), // Optimized job order
  routeDate: timestamp("route_date"),
  status: text("status").default('saved'), // saved, planned, in_progress, completed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_routes_user_id").on(table.userId),
]);

// Route schemas
export const insertRouteSchema = createInsertSchema(routes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Route = typeof routes.$inferSelect;
export type InsertRoute = z.infer<typeof insertRouteSchema>;

// Customer Portal
export const customerUsers = pgTable("customer_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  email: text("email").notNull(),
  passwordHash: text("password_hash"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  emailVerified: boolean("email_verified").default(false),
  verificationToken: text("verification_token"),
  resetToken: text("reset_token"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_customer_users_client_id").on(table.clientId),
  index("idx_customer_users_business_owner_id").on(table.businessOwnerId),
]);

export const customerSessions = pgTable("customer_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerUserId: varchar("customer_user_id").notNull().references(() => customerUsers.id, { onDelete: 'cascade' }),
  sessionToken: text("session_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_customer_sessions_customer_user_id").on(table.customerUserId),
]);

// Equipment Management
export const equipmentCategories = pgTable("equipment_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_equipment_categories_user_id").on(table.userId),
]);

export const equipment = pgTable("equipment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  categoryId: varchar("category_id").references(() => equipmentCategories.id, { onDelete: 'set null' }),
  name: text("name").notNull(),
  description: text("description"),
  model: text("model"),
  serialNumber: text("serial_number"),
  manufacturer: text("manufacturer"),
  purchaseDate: timestamp("purchase_date"),
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
  currentValue: decimal("current_value", { precision: 10, scale: 2 }),
  warrantyExpiresAt: timestamp("warranty_expires_at"),
  warrantyProvider: text("warranty_provider"),
  location: text("location"),
  status: text("status").default('active'), // active, maintenance, retired, sold
  assignedTo: varchar("assigned_to").references(() => users.id),
  photos: json("photos").default([]),
  documents: json("documents").default([]),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_equipment_user_id").on(table.userId),
  index("idx_equipment_category_id").on(table.categoryId),
  index("idx_equipment_assigned_to").on(table.assignedTo),
]);

export const equipmentMaintenance = pgTable("equipment_maintenance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  equipmentId: varchar("equipment_id").notNull().references(() => equipment.id, { onDelete: 'cascade' }),
  type: text("type").notNull(), // 'scheduled', 'repair', 'inspection'
  title: text("title").notNull(),
  description: text("description"),
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  vendor: text("vendor"),
  performedBy: varchar("performed_by").references(() => users.id),
  status: text("status").default('scheduled'), // scheduled, in_progress, completed, cancelled
  nextDueDate: timestamp("next_due_date"),
  photos: json("photos").default([]),
  documents: json("documents").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_equipment_maintenance_user_id").on(table.userId),
  index("idx_equipment_maintenance_equipment_id").on(table.equipmentId),
  index("idx_equipment_maintenance_performed_by").on(table.performedBy),
]);

// Client Assets - Equipment/systems installed at customer locations (Mrs Smith's AC unit)
export const clientAssets = pgTable("client_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  name: text("name").notNull(), // e.g., "Split System AC - Living Room"
  assetType: text("asset_type").notNull(), // 'hvac', 'hot_water', 'electrical', 'plumbing', 'solar', 'appliance', 'other'
  manufacturer: text("manufacturer"),
  model: text("model"),
  serialNumber: text("serial_number"),
  installDate: timestamp("install_date"),
  installedBy: text("installed_by"), // Could be this tradie or another
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
  warrantyExpiresAt: timestamp("warranty_expires_at"),
  warrantyProvider: text("warranty_provider"),
  warrantyNotes: text("warranty_notes"),
  location: text("location"), // Where in the property: "Kitchen", "Garage", "Unit 2"
  notes: text("notes"),
  specifications: json("specifications").default({}), // Flexible specs: capacity, kW rating, etc.
  photos: json("photos").default([]),
  documents: json("documents").default([]), // Manuals, warranty docs
  lastServiceDate: timestamp("last_service_date"),
  nextServiceDue: timestamp("next_service_due"),
  serviceIntervalMonths: integer("service_interval_months"), // e.g., 12 for annual service
  status: text("status").default('active'), // active, decommissioned, replaced
  replacedByAssetId: varchar("replaced_by_asset_id"), // Links to new asset if replaced
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_client_assets_user_id").on(table.userId),
  index("idx_client_assets_client_id").on(table.clientId),
]);

// Client Asset Service History - Track all work done on a client's asset
export const clientAssetServices = pgTable("client_asset_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  assetId: varchar("asset_id").notNull().references(() => clientAssets.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }), // Link to job if applicable
  serviceType: text("service_type").notNull(), // 'installation', 'maintenance', 'repair', 'inspection', 'replacement'
  title: text("title").notNull(),
  description: text("description"),
  serviceDate: timestamp("service_date").notNull(),
  performedBy: varchar("performed_by").references(() => users.id),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  laborHours: decimal("labor_hours", { precision: 5, scale: 2 }),
  partsUsed: json("parts_used").default([]), // [{ name, partNumber, quantity, cost }]
  findings: text("findings"), // What was found during inspection
  recommendations: text("recommendations"), // Suggested future work
  photos: json("photos").default([]),
  documents: json("documents").default([]),
  nextServiceDue: timestamp("next_service_due"), // Updates asset's next service date
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_client_asset_services_user_id").on(table.userId),
  index("idx_client_asset_services_asset_id").on(table.assetId),
  index("idx_client_asset_services_job_id").on(table.jobId),
  index("idx_client_asset_services_performed_by").on(table.performedBy),
]);

// Recurring Jobs & Contracts
export const recurringContracts = pgTable("recurring_contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description"),
  contractValue: decimal("contract_value", { precision: 10, scale: 2 }),
  frequency: text("frequency").notNull(), // 'weekly', 'monthly', 'quarterly', 'yearly'
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  nextJobDate: timestamp("next_job_date").notNull(),
  autoCreateJobs: boolean("auto_create_jobs").default(true),
  autoSendInvoices: boolean("auto_send_invoices").default(false),
  jobTemplate: json("job_template").default({}),
  invoiceTemplate: json("invoice_template").default({}),
  status: text("status").default('active'), // active, paused, completed, cancelled
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_recurring_contracts_user_id").on(table.userId),
  index("idx_recurring_contracts_client_id").on(table.clientId),
]);

export const recurringSchedules = pgTable("recurring_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => recurringContracts.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'cascade' }),
  scheduledDate: timestamp("scheduled_date").notNull(),
  completedDate: timestamp("completed_date"),
  status: text("status").default('scheduled'), // scheduled, completed, skipped, cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_recurring_schedules_contract_id").on(table.contractId),
  index("idx_recurring_schedules_job_id").on(table.jobId),
]);

// Digital Forms & Signatures
export const customForms = pgTable("custom_forms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  formType: text("form_type").default('general'), // 'general', 'safety', 'compliance', 'inspection'
  tradeType: text("trade_type").default('general'), // Trade-specific forms (plumbing, electrical, etc.)
  fields: json("fields").default([]), // Form field definitions
  settings: json("settings").default({}), // Form settings and styling
  requiresSignature: boolean("requires_signature").default(false),
  isJobCard: boolean("is_job_card").default(false), // Treat this form as a Job Card (first-class tab on the job)
  blockJobCompletion: boolean("block_job_completion").default(false), // Job cannot be marked done until this job card's required fields are submitted
  taskRules: json("task_rules").default([]), // [{ fieldId, operator, value, taskTitle, assignTo }] — spawn follow-up tasks on submit
  isDefault: boolean("is_default").default(false), // System-provided default form
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_custom_forms_user_id").on(table.userId),
]);

export const formSubmissions = pgTable("form_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formId: varchar("form_id").notNull().references(() => customForms.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'cascade' }),
  submittedBy: varchar("submitted_by").references(() => users.id),
  customerUserId: varchar("customer_user_id").references(() => customerUsers.id),
  submissionData: json("submission_data").default({}), // Form responses
  submittedAt: timestamp("submitted_at").defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  status: text("status").default('submitted'), // submitted, reviewed, approved, rejected
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_form_submissions_form_id").on(table.formId),
  index("idx_form_submissions_job_id").on(table.jobId),
  index("idx_form_submissions_submitted_by").on(table.submittedBy),
  index("idx_form_submissions_customer_user_id").on(table.customerUserId),
  index("idx_form_submissions_reviewed_by").on(table.reviewedBy),
]);

// Version history for form submissions (job card edits) — a snapshot of the
// previous submissionData is written here every time a submission is edited.
export const formSubmissionVersions = pgTable("form_submission_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull().references(() => formSubmissions.id, { onDelete: 'cascade' }),
  versionNumber: integer("version_number").notNull().default(1),
  submissionData: json("submission_data").default({}),
  editedBy: varchar("edited_by").references(() => users.id),
  editedAt: timestamp("edited_at").defaultNow(),
}, (table) => [
  index("idx_form_submission_versions_submission_id").on(table.submissionId),
]);

// Follow-up Tasks — spawned when a form/job-card answer matches a task rule
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // owner (business) scope
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default('open'), // open, done
  assignedTo: varchar("assigned_to").references(() => users.id, { onDelete: 'set null' }),
  dueAt: timestamp("due_at"),
  source: text("source").default('manual'), // manual, form_rule
  sourceFormId: varchar("source_form_id").references(() => customForms.id, { onDelete: 'set null' }),
  sourceSubmissionId: varchar("source_submission_id").references(() => formSubmissions.id, { onDelete: 'set null' }),
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by").references(() => users.id, { onDelete: 'set null' }),
  // Cost tracking fields
  estimatedHours: decimal("estimated_hours", { precision: 8, scale: 2 }),
  actualHours: decimal("actual_hours", { precision: 8, scale: 2 }),
  estimatedMaterialCost: decimal("estimated_material_cost", { precision: 10, scale: 2 }),
  actualMaterialCost: decimal("actual_material_cost", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_tasks_user_id").on(table.userId),
  index("idx_tasks_job_id").on(table.jobId),
  index("idx_tasks_assigned_to").on(table.assignedTo),
]);

export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true, completedAt: true, completedBy: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export const taskTimeEntries = pgTable("task_time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  timeEntryId: varchar("time_entry_id").notNull().references(() => timeEntries.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("uq_task_time_entries").on(table.taskId, table.timeEntryId),
  index("idx_task_time_entries_task_id").on(table.taskId),
]);
export const digitalSignatures = pgTable("digital_signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formSubmissionId: varchar("form_submission_id").references(() => formSubmissions.id, { onDelete: 'cascade' }),
  assignmentId: varchar("assignment_id").references(() => jobAssignments.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'cascade' }),
  quoteId: varchar("quote_id").references(() => quotes.id, { onDelete: 'cascade' }),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: 'set null' }),
  signerName: text("signer_name").notNull(),
  signerEmail: text("signer_email"),
  signerRole: text("signer_role").default('client'), // 'client', 'worker', 'owner'
  signatureData: text("signature_data").notNull(), // Base64 signature image
  signedAt: timestamp("signed_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  documentType: text("document_type").notNull(), // 'quote', 'invoice', 'form', 'contract', 'job_completion'
  isValid: boolean("is_valid").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_digital_signatures_form_submission_id").on(table.formSubmissionId),
  index("idx_digital_signatures_assignment_id").on(table.assignmentId),
  index("idx_digital_signatures_job_id").on(table.jobId),
  index("idx_digital_signatures_quote_id").on(table.quoteId),
  index("idx_digital_signatures_invoice_id").on(table.invoiceId),
  index("idx_digital_signatures_client_id").on(table.clientId),
]);

// Marketing Automation
export const emailCampaigns = pgTable("email_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  templateType: text("template_type").default('custom'), // 'custom', 'follow_up', 'maintenance', 'review'
  targetAudience: text("target_audience").default('all_clients'), // 'all_clients', 'recent_jobs', 'overdue_invoices'
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  status: text("status").default('draft'), // 'draft', 'scheduled', 'sending', 'sent', 'cancelled'
  recipientCount: integer("recipient_count").default(0),
  openCount: integer("open_count").default(0),
  clickCount: integer("click_count").default(0),
  bounceCount: integer("bounce_count").default(0),
  unsubscribeCount: integer("unsubscribe_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_email_campaigns_user_id").on(table.userId),
]);

export const customerSurveys = pgTable("customer_surveys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  surveyType: text("survey_type").default('satisfaction'), // 'satisfaction', 'follow_up', 'feedback'
  questions: json("questions").default([]),
  responses: json("responses").default({}),
  overallRating: integer("overall_rating"), // 1-5 stars
  completedAt: timestamp("completed_at"),
  sentAt: timestamp("sent_at"),
  remindersSent: integer("reminders_sent").default(0),
  lastReminderAt: timestamp("last_reminder_at"),
  status: text("status").default('pending'), // 'pending', 'completed', 'expired'
  publicReviewPosted: boolean("public_review_posted").default(false),
  reviewPlatform: text("review_platform"), // 'google', 'facebook', 'custom'
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_customer_surveys_user_id").on(table.userId),
  index("idx_customer_surveys_job_id").on(table.jobId),
  index("idx_customer_surveys_client_id").on(table.clientId),
]);

// Supplier Management
export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  abn: text("abn"),
  accountNumber: text("account_number"),
  paymentTerms: text("payment_terms").default('Net 30'),
  discountRate: decimal("discount_rate", { precision: 5, scale: 2 }),
  creditLimit: decimal("credit_limit", { precision: 10, scale: 2 }),
  notes: text("notes"),
  rating: integer("rating"), // 1-5 stars
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_suppliers_user_id").on(table.userId),
]);

export const purchaseOrders = pgTable("purchase_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  supplierId: varchar("supplier_id").notNull().references(() => suppliers.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'cascade' }),
  poNumber: text("po_number").notNull(),
  orderDate: timestamp("order_date").defaultNow(),
  requiredDate: timestamp("required_date"),
  deliveryDate: timestamp("delivery_date"),
  status: text("status").default('pending'), // 'pending', 'approved', 'sent', 'received', 'cancelled'
  sentAt: timestamp("sent_at"), // When PO was emailed to supplier
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default('0.00'),
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).default('0.00'),
  total: decimal("total", { precision: 10, scale: 2 }).default('0.00'),
  terms: text("terms"),
  notes: text("notes"),
  receiptUrl: text("receipt_url"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  // Optional phase tag — when set, overrides date-window attribution in the profitability breakdown
  phaseId: varchar("phase_id").references(() => jobPhases.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_purchase_orders_user_id").on(table.userId),
  index("idx_purchase_orders_supplier_id").on(table.supplierId),
  index("idx_purchase_orders_job_id").on(table.jobId),
  index("idx_purchase_orders_approved_by").on(table.approvedBy),
]);

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  poId: varchar("po_id").notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  inventoryItemId: varchar("inventory_item_id").references(() => inventoryItems.id, { onDelete: 'cascade' }),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  // unitCost = what we actually paid per unit (buy price)
  // unitPrice = what we charge the client per unit (sell price, cost + markup)
  // markupPercent = markup applied: (unitPrice - unitCost) / unitCost * 100
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }), // nullable — legacy rows won't have it
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  markupPercent: decimal("markup_percent", { precision: 5, scale: 2 }), // nullable — optional override
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
  receivedQuantity: integer("received_quantity").default(0),
  status: text("status").default('pending'), // 'pending', 'partial', 'received', 'cancelled'
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_purchase_order_items_po_id").on(table.poId),
  index("idx_purchase_order_items_inventory_item_id").on(table.inventoryItemId),
]);

// Advanced Reporting
export const reportConfigurations = pgTable("report_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  reportType: text("report_type").notNull(), // 'profit_loss', 'cash_flow', 'job_profitability', 'time_summary'
  filters: json("filters").default({}),
  groupBy: text("group_by"), // 'client', 'job_type', 'month', 'team_member'
  dateRange: json("date_range").default({}),
  chartType: text("chart_type").default('table'), // 'table', 'bar', 'line', 'pie'
  isScheduled: boolean("is_scheduled").default(false),
  scheduleFrequency: text("schedule_frequency"), // 'daily', 'weekly', 'monthly'
  emailRecipients: json("email_recipients").default([]),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_report_configurations_user_id").on(table.userId),
]);

export const savedReports = pgTable("saved_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  configId: varchar("config_id").notNull().references(() => reportConfigurations.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  reportData: json("report_data").default({}),
  generatedAt: timestamp("generated_at").defaultNow(),
  fileUrl: text("file_url"), // PDF/Excel export URL
  parameters: json("parameters").default({}),
  isAutoGenerated: boolean("is_auto_generated").default(false),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_saved_reports_config_id").on(table.configId),
  index("idx_saved_reports_user_id").on(table.userId),
]);

// ===== ZOD SCHEMAS AND TYPES FOR ADVANCED FEATURES =====

// Time Tracking Schemas
export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  isDisputed: true,
  disputeReason: true,
  disputedAt: true,
  disputeResolvedAt: true,
  disputeResolution: true,
}).extend({
  startTime: z.preprocess(
    (val) => val ? new Date(val as string | number | Date) : undefined,
    z.date().optional()
  ), // Allow backend to set current time, accept string/Date
  endTime: z.preprocess(
    (val) => val ? new Date(val as string | number | Date) : undefined,
    z.date().optional()
  ), // Allow string/Date for end time
  hourlyRate: z.string().optional(), // Accept as string (decimal)
});

export const insertTimesheetSchema = createInsertSchema(timesheets).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

// Expense Tracking Schemas
export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertExpenseSchema = createInsertSchema(expenses, {
  expenseDate: z.coerce.date(),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  approvedBy: true,
  rejectionReason: true,
  submittedByUserId: true,
});

// Inventory Management Schemas  
export const insertInventoryCategorySchema = createInsertSchema(inventoryCategories).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInventoryTransactionSchema = createInsertSchema(inventoryTransactions).omit({
  id: true,
  userId: true,
  createdAt: true,
});

// Team Management Schemas
export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  createdAt: true,
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStaffScheduleSchema = createInsertSchema(staffSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Advanced Team Management Schemas
export const insertTeamMemberSkillSchema = createInsertSchema(teamMemberSkills).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeamMemberAvailabilitySchema = createInsertSchema(teamMemberAvailability).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeamMemberTimeOffSchema = createInsertSchema(teamMemberTimeOff).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeamMemberMetricsSchema = createInsertSchema(teamMemberMetrics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPermissionRequestSchema = createInsertSchema(permissionRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJobAssignmentRequestSchema = createInsertSchema(jobAssignmentRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// GPS Tracking Schemas
export const insertLocationTrackingSchema = createInsertSchema(locationTracking).omit({
  id: true,
  createdAt: true,
});

export const insertGeofenceAlertSchema = createInsertSchema(geofenceAlerts).omit({
  id: true,
  createdAt: true,
});

export const insertTradieStatusSchema = createInsertSchema(tradieStatus).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Customer Portal Schemas
export const insertCustomerUserSchema = createInsertSchema(customerUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Equipment Management Schemas
export const insertEquipmentCategorySchema = createInsertSchema(equipmentCategories).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertEquipmentSchema = createInsertSchema(equipment).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEquipmentMaintenanceSchema = createInsertSchema(equipmentMaintenance).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

// Client Assets Schemas
export const insertClientAssetSchema = createInsertSchema(clientAssets).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientAssetServiceSchema = createInsertSchema(clientAssetServices).omit({
  id: true,
  userId: true,
  createdAt: true,
});

// Recurring Jobs Schemas
export const insertRecurringContractSchema = createInsertSchema(recurringContracts).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRecurringScheduleSchema = createInsertSchema(recurringSchedules).omit({
  id: true,
  createdAt: true,
});

// Digital Forms Schemas
export const insertCustomFormSchema = createInsertSchema(customForms).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFormSubmissionSchema = createInsertSchema(formSubmissions).omit({
  id: true,
  createdAt: true,
});

export const insertFormSubmissionVersionSchema = createInsertSchema(formSubmissionVersions).omit({
  id: true,
  editedAt: true,
});
export type InsertFormSubmissionVersion = z.infer<typeof insertFormSubmissionVersionSchema>;
export type FormSubmissionVersion = typeof formSubmissionVersions.$inferSelect;

export const insertDigitalSignatureSchema = createInsertSchema(digitalSignatures).omit({
  id: true,
  createdAt: true,
});

// Marketing Automation Schemas
export const insertEmailCampaignSchema = createInsertSchema(emailCampaigns).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerSurveySchema = createInsertSchema(customerSurveys).omit({
  id: true,
  userId: true,
  createdAt: true,
});

// Supplier Management Schemas
export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({
  id: true,
  createdAt: true,
});

// Advanced Reporting Schemas
export const insertReportConfigurationSchema = createInsertSchema(reportConfigurations).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSavedReportSchema = createInsertSchema(savedReports).omit({
  id: true,
  createdAt: true,
});

// ===== TYPES FOR ADVANCED FEATURES =====

// Time Tracking Types
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type TimeEntry = typeof timeEntries.$inferSelect;

export type InsertTimesheet = z.infer<typeof insertTimesheetSchema>;
export type Timesheet = typeof timesheets.$inferSelect;

// Expense Tracking Types
export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

// Inventory Management Types
export type InsertInventoryCategory = z.infer<typeof insertInventoryCategorySchema>;
export type InventoryCategory = typeof inventoryCategories.$inferSelect;

export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;

export type InsertInventoryTransaction = z.infer<typeof insertInventoryTransactionSchema>;
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;

// Team Management Types
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRoles.$inferSelect;

export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;

export type InsertStaffSchedule = z.infer<typeof insertStaffScheduleSchema>;
export type StaffSchedule = typeof staffSchedules.$inferSelect;

// Advanced Team Management Types
export type InsertTeamMemberSkill = z.infer<typeof insertTeamMemberSkillSchema>;
export type TeamMemberSkill = typeof teamMemberSkills.$inferSelect;

export type InsertTeamMemberAvailability = z.infer<typeof insertTeamMemberAvailabilitySchema>;
export type TeamMemberAvailability = typeof teamMemberAvailability.$inferSelect;

export type InsertTeamMemberTimeOff = z.infer<typeof insertTeamMemberTimeOffSchema>;
export type TeamMemberTimeOff = typeof teamMemberTimeOff.$inferSelect;

export type InsertTeamMemberMetrics = z.infer<typeof insertTeamMemberMetricsSchema>;
export type TeamMemberMetrics = typeof teamMemberMetrics.$inferSelect;

export type InsertPermissionRequest = z.infer<typeof insertPermissionRequestSchema>;
export type PermissionRequest = typeof permissionRequests.$inferSelect;

export type InsertJobAssignmentRequest = z.infer<typeof insertJobAssignmentRequestSchema>;
export type JobAssignmentRequest = typeof jobAssignmentRequests.$inferSelect;

// GPS Tracking Types
export type InsertLocationTracking = z.infer<typeof insertLocationTrackingSchema>;
export type LocationTracking = typeof locationTracking.$inferSelect;

export type InsertGeofenceAlert = z.infer<typeof insertGeofenceAlertSchema>;
export type GeofenceAlert = typeof geofenceAlerts.$inferSelect;

export type InsertTradieStatus = z.infer<typeof insertTradieStatusSchema>;
export type TradieStatus = typeof tradieStatus.$inferSelect;

// Customer Portal Types
export type InsertCustomerUser = z.infer<typeof insertCustomerUserSchema>;
export type CustomerUser = typeof customerUsers.$inferSelect;

// Equipment Management Types
export type InsertEquipmentCategory = z.infer<typeof insertEquipmentCategorySchema>;
export type EquipmentCategory = typeof equipmentCategories.$inferSelect;

export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Equipment = typeof equipment.$inferSelect;

export type InsertEquipmentMaintenance = z.infer<typeof insertEquipmentMaintenanceSchema>;
export type EquipmentMaintenance = typeof equipmentMaintenance.$inferSelect;

// Client Assets Types
export type InsertClientAsset = z.infer<typeof insertClientAssetSchema>;
export type ClientAsset = typeof clientAssets.$inferSelect;

export type InsertClientAssetService = z.infer<typeof insertClientAssetServiceSchema>;
export type ClientAssetService = typeof clientAssetServices.$inferSelect;

// Recurring Jobs Types
export type InsertRecurringContract = z.infer<typeof insertRecurringContractSchema>;
export type RecurringContract = typeof recurringContracts.$inferSelect;

export type InsertRecurringSchedule = z.infer<typeof insertRecurringScheduleSchema>;
export type RecurringSchedule = typeof recurringSchedules.$inferSelect;

// Digital Forms Types
export type InsertCustomForm = z.infer<typeof insertCustomFormSchema>;
export type CustomForm = typeof customForms.$inferSelect;

export type InsertFormSubmission = z.infer<typeof insertFormSubmissionSchema>;
export type FormSubmission = typeof formSubmissions.$inferSelect;

export type InsertDigitalSignature = z.infer<typeof insertDigitalSignatureSchema>;
export type DigitalSignature = typeof digitalSignatures.$inferSelect;

// Marketing Automation Types
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;
export type EmailCampaign = typeof emailCampaigns.$inferSelect;

export type InsertCustomerSurvey = z.infer<typeof insertCustomerSurveySchema>;
export type CustomerSurvey = typeof customerSurveys.$inferSelect;

// Supplier Management Types
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;

export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;

export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;

// Advanced Reporting Types
export type InsertReportConfiguration = z.infer<typeof insertReportConfigurationSchema>;
export type ReportConfiguration = typeof reportConfigurations.$inferSelect;

export type InsertSavedReport = z.infer<typeof insertSavedReportSchema>;
export type SavedReport = typeof savedReports.$inferSelect;

// Email Integration - Allows tradies to connect their own email accounts
export const emailIntegrations = pgTable("email_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text("provider").notNull(), // 'gmail', 'outlook', 'smtp'
  status: text("status").default('pending'), // 'pending', 'connected', 'error', 'disconnected'
  // For OAuth providers (Gmail, Outlook)
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  // For SMTP
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpUser: text("smtp_user"),
  smtpPassword: text("smtp_password"), // Encrypted
  smtpSecure: boolean("smtp_secure").default(true),
  // Email address used for sending
  emailAddress: text("email_address"),
  displayName: text("display_name"),
  // Tracking
  lastUsedAt: timestamp("last_used_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_email_integrations_user_id").on(table.userId),
]);

export const insertEmailIntegrationSchema = createInsertSchema(emailIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEmailIntegration = z.infer<typeof insertEmailIntegrationSchema>;
export type EmailIntegration = typeof emailIntegrations.$inferSelect;

// Email delivery logs - Track sent emails
export const emailDeliveryLogs = pgTable("email_delivery_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }),
  emailIntegrationId: varchar("email_integration_id").references(() => emailIntegrations.id, { onDelete: 'set null' }),
  recipientEmail: text("recipient_email").notNull(),
  subject: text("subject").notNull(),
  type: text("type"), // 'quote', 'invoice', 'receipt', 'reminder', 'system'
  relatedId: varchar("related_id"), // quote_id or invoice_id
  status: text("status").default('pending'), // 'pending', 'sent', 'delivered', 'failed', 'opened'
  sentVia: text("sent_via"), // 'gmail', 'outlook', 'smtp', 'sendgrid'
  messageId: text("message_id"), // Provider's message ID
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  bouncedAt: timestamp("bounced_at"),
  bounceReason: text("bounce_reason"),
  lastEventType: text("last_event_type"), // Most recent SendGrid event ('delivered', 'open', 'click', 'bounce', 'dropped', 'spamreport', 'unsubscribe')
  lastEventAt: timestamp("last_event_at"),
  openCount: integer("open_count").default(0),
  clickCount: integer("click_count").default(0),
  // Retry / dead-letter fields used by retryScheduler.processFailedEmailMessages
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(5),
  nextRetryAt: timestamp("next_retry_at"),
  permanentlyFailed: boolean("permanently_failed").default(false),
  payloadJson: jsonb("payload_json"), // Snapshot of {to, html, text, attachments} for retries
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_email_delivery_logs_user_id").on(table.userId),
  index("idx_email_delivery_logs_email_integration_id").on(table.emailIntegrationId),
]);

export const insertEmailDeliveryLogSchema = createInsertSchema(emailDeliveryLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertEmailDeliveryLog = z.infer<typeof insertEmailDeliveryLogSchema>;
export type EmailDeliveryLog = typeof emailDeliveryLogs.$inferSelect;

// Job Photos - Proper table for photo attachments with metadata
export const jobPhotos = pgTable("job_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'cascade' }),
  objectStorageKey: text("object_storage_key").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  category: text("category").default('general'),
  caption: text("caption"),
  takenAt: timestamp("taken_at"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  address: text("address"),
  tags: text("tags").array().default([]),
  aiSuggestedCategory: text("ai_suggested_category"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_job_photos_user_id").on(table.userId),
  index("idx_job_photos_job_id").on(table.jobId),
  index("idx_job_photos_uploaded_by").on(table.uploadedBy),
]);

export const insertJobPhotoSchema = createInsertSchema(jobPhotos).omit({
  id: true,
  createdAt: true,
});
export type InsertJobPhoto = z.infer<typeof insertJobPhotoSchema>;
export type JobPhoto = typeof jobPhotos.$inferSelect;

// Voice Notes - Audio recordings attached to jobs
export const voiceNotes = pgTable("voice_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  objectStorageKey: text("object_storage_key").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type").default('audio/webm'),
  duration: integer("duration"), // Duration in seconds
  title: text("title"), // Optional title/label for the note
  transcription: text("transcription"), // AI transcription of the audio
  summary: text("summary"), // AI key-point summary of the transcription
  detectedActions: jsonb("detected_actions"), // AI-detected action items from transcription
  recordedBy: varchar("recorded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_voice_notes_user_id").on(table.userId),
  index("idx_voice_notes_job_id").on(table.jobId),
  index("idx_voice_notes_recorded_by").on(table.recordedBy),
]);

export const insertVoiceNoteSchema = createInsertSchema(voiceNotes).omit({
  id: true,
  createdAt: true,
});
export type InsertVoiceNote = z.infer<typeof insertVoiceNoteSchema>;
export type VoiceNote = typeof voiceNotes.$inferSelect;

// Job Notes - Timestamped notes attached to jobs ("notes tied to the moment")
export const jobNotes = pgTable("job_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  createdBy: varchar("created_by").references(() => users.id), // Team member who created the note
  createdByName: text("created_by_name"), // Denormalized for quick display
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_job_notes_user_id").on(table.userId),
  index("idx_job_notes_job_id").on(table.jobId),
  index("idx_job_notes_created_by").on(table.createdBy),
]);

export const insertJobNoteSchema = createInsertSchema(jobNotes).omit({
  id: true,
  createdAt: true,
});
export type InsertJobNote = z.infer<typeof insertJobNoteSchema>;
export type JobNote = typeof jobNotes.$inferSelect;

// Job Variations / Change Orders - Track scope changes with approvals
export const jobVariations = pgTable("job_variations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  number: text("number").notNull(), // e.g., "V001", "V002"
  title: text("title").notNull(),
  description: text("description"),
  reason: text("reason"), // Why the change is needed
  additionalAmount: decimal("additional_amount", { precision: 10, scale: 2 }).notNull().default('0.00'), // Can be negative for credits
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).notNull().default('0.00'),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull().default('0.00'),
  status: text("status").notNull().default('draft'), // draft, sent, approved, rejected
  photos: jsonb("photos").default([]), // Array of photo URLs with timestamps
  createdBy: varchar("created_by").references(() => users.id),
  createdByName: text("created_by_name"),
  sentAt: timestamp("sent_at"),
  approvedAt: timestamp("approved_at"),
  approvedByName: text("approved_by_name"), // Client name who approved
  approvedBySignature: text("approved_by_signature"), // Base64 signature data
  approvalMethod: text("approval_method"), // email, verbal, signed
  approvalContact: text("approval_contact"), // Contact name / email for approval record
  phaseId: varchar("phase_id"), // Optional link to job phase
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  notes: text("notes"), // Additional notes from client or tradie
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_job_variations_user_id").on(table.userId),
  index("idx_job_variations_job_id").on(table.jobId),
  index("idx_job_variations_created_by").on(table.createdBy),
]);

export const insertJobVariationSchema = createInsertSchema(jobVariations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertJobVariation = z.infer<typeof insertJobVariationSchema>;
export type JobVariation = typeof jobVariations.$inferSelect;

// Job Documents - External PDF files (quotes/invoices from other sources)
export const jobDocuments = pgTable("job_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  documentType: text("document_type").notNull().default('other'), // 'quote', 'invoice', 'other'
  fileName: text("file_name").notNull(),
  objectStorageKey: text("object_storage_key").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_job_documents_user_id").on(table.userId),
  index("idx_job_documents_job_id").on(table.jobId),
  index("idx_job_documents_uploaded_by").on(table.uploadedBy),
]);

export const insertJobDocumentSchema = createInsertSchema(jobDocuments).omit({
  id: true,
  createdAt: true,
});
export type InsertJobDocument = z.infer<typeof insertJobDocumentSchema>;
export type JobDocument = typeof jobDocuments.$inferSelect;

// Invoice Reminder Logs - Track sent reminders to avoid duplicates
export const invoiceReminderLogs = pgTable("invoice_reminder_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  reminderType: text("reminder_type").notNull(), // 7day, 14day, 30day, manual
  daysPastDue: integer("days_past_due"),
  sentVia: text("sent_via"), // email, sms, both
  emailSent: boolean("email_sent").default(false),
  smsSent: boolean("sms_sent").default(false),
  response: text("response"), // Any client response or action taken
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_invoice_reminder_logs_invoice_id").on(table.invoiceId),
  index("idx_invoice_reminder_logs_user_id").on(table.userId),
]);

export const insertInvoiceReminderLogSchema = createInsertSchema(invoiceReminderLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertInvoiceReminderLog = z.infer<typeof insertInvoiceReminderLogSchema>;
export type InvoiceReminderLog = typeof invoiceReminderLogs.$inferSelect;

// Stripe Connect Payouts - Track payouts to tradies
export const stripePayouts = pgTable("stripe_payouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: 'set null' }),
  stripePayoutId: text("stripe_payout_id").unique(),
  stripeTransferId: text("stripe_transfer_id"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // Amount paid to tradie
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull(), // Platform's cut
  currency: text("currency").default('aud'),
  status: text("status").default('pending'), // pending, in_transit, paid, failed, canceled
  failureMessage: text("failure_message"),
  arrivalDate: timestamp("arrival_date"), // Expected arrival in bank
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_stripe_payouts_user_id").on(table.userId),
  index("idx_stripe_payouts_invoice_id").on(table.invoiceId),
]);

export const insertStripePayoutSchema = createInsertSchema(stripePayouts).omit({
  id: true,
  createdAt: true,
});
export type InsertStripePayout = z.infer<typeof insertStripePayoutSchema>;
export type StripePayout = typeof stripePayouts.$inferSelect;

// Job Chat Messages - Communication for specific jobs
export const jobChat = pgTable("job_chat", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  message: text("message").notNull(),
  messageType: text("message_type").default('text'), // text, image, file, status_update
  attachmentUrl: text("attachment_url"), // URL for image/file attachments
  attachmentName: text("attachment_name"), // Original filename
  isSystemMessage: boolean("is_system_message").default(false), // For automated status updates
  readBy: jsonb("read_by").default([]), // Array of user IDs who have read this message
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_job_chat_job_id").on(table.jobId),
  index("idx_job_chat_user_id").on(table.userId),
]);

export const insertJobChatSchema = createInsertSchema(jobChat).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertJobChat = z.infer<typeof insertJobChatSchema>;
export type JobChat = typeof jobChat.$inferSelect;

// Team Chat Messages - General team communication
export const teamChat = pgTable("team_chat", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  message: text("message").notNull(),
  messageType: text("message_type").default('text'), // text, image, file, announcement
  attachmentUrl: text("attachment_url"), // URL for image/file attachments
  attachmentName: text("attachment_name"), // Original filename
  isAnnouncement: boolean("is_announcement").default(false), // For important team announcements
  isPinned: boolean("is_pinned").default(false), // Pinned messages stay at top
  readBy: jsonb("read_by").default([]), // Array of user IDs who have read this message
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_team_chat_business_owner_id").on(table.businessOwnerId),
  index("idx_team_chat_sender_id").on(table.senderId),
]);

export const insertTeamChatSchema = createInsertSchema(teamChat).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTeamChat = z.infer<typeof insertTeamChatSchema>;
export type TeamChat = typeof teamChat.$inferSelect;

// Direct Messages - Private conversations between team members
export const directMessages = pgTable("direct_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  recipientId: varchar("recipient_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  attachmentUrl: text("attachment_url"),
  attachmentType: text("attachment_type"), // image, file, etc.
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_direct_messages_sender_id").on(table.senderId),
  index("idx_direct_messages_recipient_id").on(table.recipientId),
]);

export const insertDirectMessageSchema = createInsertSchema(directMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;
export type DirectMessage = typeof directMessages.$inferSelect;

// SMS Conversations - Two-way SMS with clients via Twilio
export const smsConversations = pgTable("sms_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: 'set null' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  clientPhone: varchar("client_phone", { length: 20 }).notNull(),
  clientName: varchar("client_name", { length: 255 }),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  unreadCount: integer("unread_count").default(0),
  isArchived: boolean("is_archived").default(false),
  deletedAt: timestamp("deleted_at"),
  routingState: text("routing_state").default('resolved'),
  pendingOptions: jsonb("pending_options").default([]),
  lastRoutingPromptAt: timestamp("last_routing_prompt_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_sms_conversations_business_owner_id").on(table.businessOwnerId),
  index("idx_sms_conversations_client_id").on(table.clientId),
  index("idx_sms_conversations_job_id").on(table.jobId),
]);

export const insertSmsConversationSchema = createInsertSchema(smsConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSmsConversation = z.infer<typeof insertSmsConversationSchema>;
export type SmsConversation = typeof smsConversations.$inferSelect;

// SMS Messages - Individual messages within conversations
export const smsMessages = pgTable("sms_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => smsConversations.id, { onDelete: 'cascade' }),
  direction: text("direction").notNull(), // 'inbound' or 'outbound'
  body: text("body").notNull(),
  senderUserId: varchar("sender_user_id").references(() => users.id, { onDelete: 'set null' }),
  status: text("status").default('pending'), // pending, sent, delivered, failed
  twilioSid: varchar("twilio_sid", { length: 50 }),
  errorMessage: text("error_message"),
  isQuickAction: boolean("is_quick_action").default(false),
  quickActionType: text("quick_action_type"), // on_my_way, job_finished, etc.
  // MMS support - array of media URLs (max 10 per Twilio MMS, each up to 5MB)
  mediaUrls: jsonb("media_urls").default([]), // Array of media attachment URLs
  // AI Intent Detection - for "Create Job from SMS" feature
  isJobRequest: boolean("is_job_request").default(false),
  intentConfidence: text("intent_confidence"), // 'high', 'medium', 'low'
  intentType: text("intent_type"), // 'quote_request', 'job_request', 'enquiry', 'followup', 'other'
  suggestedJobTitle: varchar("suggested_job_title", { length: 100 }),
  suggestedDescription: text("suggested_description"),
  jobCreatedFromSms: varchar("job_created_from_sms").references(() => jobs.id, { onDelete: 'set null' }),
  readAt: timestamp("read_at"),
  retryCount: integer("retry_count").default(0),
  nextRetryAt: timestamp("next_retry_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_sms_messages_conversation_id").on(table.conversationId),
  index("idx_sms_messages_sender_user_id").on(table.senderUserId),
  index("idx_sms_messages_job_created_from_sms").on(table.jobCreatedFromSms),
]);

export const insertSmsMessageSchema = createInsertSchema(smsMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertSmsMessage = z.infer<typeof insertSmsMessageSchema>;
export type SmsMessage = typeof smsMessages.$inferSelect;

// Automation Rules - ServiceM8-style workflow automation
export const automations = pgTable("automations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  trigger: jsonb("trigger").notNull(), // { type, entityType, fromStatus, toStatus, delayDays }
  actions: jsonb("actions").notNull().default([]), // [{ type, template, message, newStatus }]
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_automations_user_id").on(table.userId),
]);

export const insertAutomationSchema = createInsertSchema(automations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type Automation = typeof automations.$inferSelect;

// Automation Logs - Track processed automations to prevent duplicates
export const automationLogs = pgTable("automation_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  automationId: varchar("automation_id").notNull().references(() => automations.id, { onDelete: 'cascade' }),
  entityType: text("entity_type").notNull(), // job, quote, invoice
  entityId: varchar("entity_id").notNull(),
  processedAt: timestamp("processed_at").defaultNow(),
  result: text("result"), // success, error
  errorMessage: text("error_message"),
}, (table) => [
  unique("uniqueAutomationEntity").on(table.automationId, table.entityType, table.entityId),
  index("idx_automation_logs_automation_id").on(table.automationId),
]);

export const insertAutomationLogSchema = createInsertSchema(automationLogs).omit({
  id: true,
  processedAt: true,
});
export type InsertAutomationLog = z.infer<typeof insertAutomationLogSchema>;
export type AutomationLog = typeof automationLogs.$inferSelect;

// SMS Templates - Reusable message templates with merge fields
export const smsTemplates = pgTable("sms_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 100 }).notNull(),
  category: text("category").default('general'), // general, booking, quote, invoice, reminder, arrival
  body: text("body").notNull(), // Template with merge fields like {client_name}, {job_title}
  isDefault: boolean("is_default").default(false),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_sms_templates_user_id").on(table.userId),
]);

export const insertSmsTemplateSchema = createInsertSchema(smsTemplates).omit({
  id: true,
  usageCount: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSmsTemplate = z.infer<typeof insertSmsTemplateSchema>;
export type SmsTemplate = typeof smsTemplates.$inferSelect;

// Message Templates - Unified email/SMS templates with merge fields
export const messageTemplates = pgTable("message_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  channel: varchar("channel", { length: 10 }).notNull(), // 'email' or 'sms'
  category: varchar("category", { length: 50 }).notNull(), // 'quote_follow_up', 'payment_reminder', 'job_booking', etc.
  name: varchar("name", { length: 100 }).notNull(),
  subject: text("subject"), // Only for email templates
  body: text("body").notNull(), // Template with merge fields like {client_name}, {job_title}
  isDefault: boolean("is_default").default(false), // System default templates
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMessageTemplateSchema = createInsertSchema(messageTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateMessageTemplateSchema = insertMessageTemplateSchema.partial().omit({
  userId: true,
  isDefault: true,
});

export type InsertMessageTemplate = z.infer<typeof insertMessageTemplateSchema>;
export type MessageTemplate = typeof messageTemplates.$inferSelect;

// Quick Replies - canned SMS responses for the Chat Hub composer
export const quickReplies = pgTable("quick_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  label: varchar("label", { length: 60 }).notNull(),
  body: text("body").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_quick_replies_user_id").on(table.userId),
]);

export const insertQuickReplySchema = createInsertSchema(quickReplies).omit({
  id: true,
  createdAt: true,
}).extend({
  label: z.string().min(1, "Label is required").max(60, "Label must be 60 characters or fewer"),
  body: z.string().min(1, "Message is required").max(1000, "Message is too long"),
});

export const updateQuickReplySchema = insertQuickReplySchema.partial().omit({
  userId: true,
});

export type InsertQuickReply = z.infer<typeof insertQuickReplySchema>;
export type QuickReply = typeof quickReplies.$inferSelect;

export const DEFAULT_QUICK_REPLIES: { label: string; body: string }[] = [
  { label: "On my way", body: "G'day! Just letting you know I'm on my way now. See you soon." },
  { label: "Running late", body: "Apologies, running about 15 minutes late. Will be there as soon as I can." },
  { label: "Job done", body: "Just finished — invoice on its way." },
  { label: "Booking confirmed", body: "Booking confirmed for [date]. See you then!" },
  { label: "Reschedule", body: "Need to reschedule, what suits?" },
  { label: "Thanks for payment", body: "Thanks for the payment — much appreciated!" },
];

// Template purposes - defines when a template is triggered
// Multiple templates can be active per family, but only one per purpose
export const BUSINESS_TEMPLATE_PURPOSES = [
  // Email purposes
  'quote_sent',
  'invoice_sent',
  'payment_reminder',
  'job_confirmation',
  'job_completed',
  'quote_accepted',
  'quote_declined',
  // SMS purposes
  'sms_quote_sent',
  'sms_invoice_sent',
  'sms_payment_reminder',
  'sms_job_confirmation',
  'sms_job_completed',
  // Document purposes (general/single use per family)
  'general',
] as const;
export type BusinessTemplatePurpose = typeof BUSINESS_TEMPLATE_PURPOSES[number];

// Trade types supported for template filtering
export const TRADE_TYPES = [
  'general',
  'plumbing',
  'electrical',
  'carpentry',
  'painting',
  'roofing',
  'landscaping',
  'hvac',
  'building',
  'cleaning',
  'pest_control',
  'security',
  'flooring',
  'tiling',
  'fencing',
  'concreting',
  'demolition',
  'renovation',
  'handyman',
  'other',
] as const;
export type TradeType = typeof TRADE_TYPES[number];

// Business Templates - Unified template system for Templates Hub
// Supports multiple template families: terms_conditions, warranty, email, sms, safety_form, checklist, payment_notice
export const businessTemplates = pgTable("business_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  family: text("family").notNull(), // 'terms_conditions', 'warranty', 'email', 'sms', 'safety_form', 'checklist', 'payment_notice'
  purpose: text("purpose").default('general'), // When this template is used (quote_sent, invoice_sent, etc.)
  tradeType: text("trade_type").default('general').notNull(), // Trade-specific templates: 'plumbing', 'electrical', etc. 'general' = all trades
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false), // System-provided default template
  isActive: boolean("is_active").default(true), // Currently selected for use
  subject: text("subject"), // For email templates
  content: text("content").notNull(), // Main template content (plain text or structured)
  contentHtml: text("content_html"), // HTML version for rich templates
  sections: jsonb("sections").default([]), // For multi-section templates (safety forms, checklists)
  mergeFields: text("merge_fields").array().default([]), // Available merge fields
  metadata: jsonb("metadata").default({}), // { validityDays, depositPercent, warrantyMonths, etc. }
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_business_templates_user_id").on(table.userId),
]);

export const insertBusinessTemplateSchema = createInsertSchema(businessTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateBusinessTemplateSchema = insertBusinessTemplateSchema.partial().omit({
  userId: true,
});

export type InsertBusinessTemplate = z.infer<typeof insertBusinessTemplateSchema>;
export type BusinessTemplate = typeof businessTemplates.$inferSelect;

// Template family type for validation
export const BUSINESS_TEMPLATE_FAMILIES = [
  'terms_conditions',
  'warranty',
  'email',
  'sms',
  'safety_form',
  'checklist',
  'payment_notice',
] as const;
export type BusinessTemplateFamily = typeof BUSINESS_TEMPLATE_FAMILIES[number];

// Purpose-family mapping: defines which purposes are valid for each template family
// This prevents misassignment (e.g., quote email template used for invoice)
export const FAMILY_PURPOSE_MAP: Record<BusinessTemplateFamily, readonly BusinessTemplatePurpose[]> = {
  email: ['quote_sent', 'invoice_sent', 'payment_reminder', 'job_confirmation', 'job_completed', 'quote_accepted', 'quote_declined'],
  sms: ['sms_quote_sent', 'sms_invoice_sent', 'sms_payment_reminder', 'sms_job_confirmation', 'sms_job_completed'],
  terms_conditions: ['general'],
  warranty: ['general'],
  safety_form: ['general'],
  checklist: ['general'],
  payment_notice: ['general'],
} as const;

// Helper function to validate purpose is valid for a given family
export function isValidPurposeForFamily(family: BusinessTemplateFamily, purpose: BusinessTemplatePurpose): boolean {
  const validPurposes = FAMILY_PURPOSE_MAP[family];
  return validPurposes?.includes(purpose) ?? false;
}

// Get valid purposes for a family
export function getValidPurposesForFamily(family: BusinessTemplateFamily): readonly BusinessTemplatePurpose[] {
  return FAMILY_PURPOSE_MAP[family] ?? ['general'];
}

// Human-readable purpose labels
export const PURPOSE_LABELS: Record<BusinessTemplatePurpose, string> = {
  quote_sent: 'Quote Sent',
  invoice_sent: 'Invoice Sent',
  payment_reminder: 'Payment Reminder',
  job_confirmation: 'Job Confirmation',
  job_completed: 'Job Completed',
  quote_accepted: 'Quote Accepted',
  quote_declined: 'Quote Declined',
  sms_quote_sent: 'Quote Sent (SMS)',
  sms_invoice_sent: 'Invoice Sent (SMS)',
  sms_payment_reminder: 'Payment Reminder (SMS)',
  sms_job_confirmation: 'Job Confirmation (SMS)',
  sms_job_completed: 'Job Completed (SMS)',
  general: 'General',
};

// SMS Booking Links - Unique links for clients to confirm/reschedule bookings
export const smsBookingLinks = pgTable("sms_booking_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar("token", { length: 64 }).notNull().unique(), // Secure random token for URL
  status: text("status").default('pending'), // pending, confirmed, rescheduled, expired, cancelled
  clientResponse: text("client_response"), // confirmed, reschedule_requested, cancelled
  clientNotes: text("client_notes"),
  expiresAt: timestamp("expires_at").notNull(),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_sms_booking_links_job_id").on(table.jobId),
  index("idx_sms_booking_links_business_owner_id").on(table.businessOwnerId),
]);

export const insertSmsBookingLinkSchema = createInsertSchema(smsBookingLinks).omit({
  id: true,
  status: true,
  respondedAt: true,
  createdAt: true,
});
export type InsertSmsBookingLink = z.infer<typeof insertSmsBookingLinkSchema>;
export type SmsBookingLink = typeof smsBookingLinks.$inferSelect;

// SMS Tracking Links - Live arrival tracking for clients
export const smsTrackingLinks = pgTable("sms_tracking_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  teamMemberId: varchar("team_member_id").references(() => users.id, { onDelete: 'set null' }),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  isActive: boolean("is_active").default(true),
  lastLocationLat: decimal("last_location_lat", { precision: 10, scale: 7 }),
  lastLocationLng: decimal("last_location_lng", { precision: 10, scale: 7 }),
  lastLocationAt: timestamp("last_location_at"),
  estimatedArrival: timestamp("estimated_arrival"),
  expiresAt: timestamp("expires_at").notNull(),
  viewCount: integer("view_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_sms_tracking_links_job_id").on(table.jobId),
  index("idx_sms_tracking_links_team_member_id").on(table.teamMemberId),
  index("idx_sms_tracking_links_business_owner_id").on(table.businessOwnerId),
]);

export const insertSmsTrackingLinkSchema = createInsertSchema(smsTrackingLinks).omit({
  id: true,
  isActive: true,
  lastLocationLat: true,
  lastLocationLng: true,
  lastLocationAt: true,
  viewCount: true,
  createdAt: true,
});
export type InsertSmsTrackingLink = z.infer<typeof insertSmsTrackingLinkSchema>;
export type SmsTrackingLink = typeof smsTrackingLinks.$inferSelect;

// SMS Automation Rules - Automated SMS sending rules
export const smsAutomationRules = pgTable("sms_automation_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 100 }).notNull(),
  isActive: boolean("is_active").default(true),
  triggerType: text("trigger_type").notNull(), // quote_sent, invoice_sent, invoice_overdue, job_scheduled, job_day_before, quote_follow_up
  delayMinutes: integer("delay_minutes").default(0), // Delay before sending (0 = immediate)
  templateId: varchar("template_id").references(() => smsTemplates.id, { onDelete: 'set null' }),
  customMessage: text("custom_message"), // If no template, use this message
  conditions: jsonb("conditions").default({}), // Additional conditions like { minAmount: 100, jobStatus: 'scheduled' }
  lastTriggeredAt: timestamp("last_triggered_at"),
  triggerCount: integer("trigger_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_sms_automation_rules_user_id").on(table.userId),
  index("idx_sms_automation_rules_template_id").on(table.templateId),
]);

export const insertSmsAutomationRuleSchema = createInsertSchema(smsAutomationRules).omit({
  id: true,
  lastTriggeredAt: true,
  triggerCount: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSmsAutomationRule = z.infer<typeof insertSmsAutomationRuleSchema>;
export type SmsAutomationRule = typeof smsAutomationRules.$inferSelect;

// SMS Automation Log - Track sent automated messages
export const smsAutomationLogs = pgTable("sms_automation_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleId: varchar("rule_id").notNull().references(() => smsAutomationRules.id, { onDelete: 'cascade' }),
  entityType: text("entity_type").notNull(), // job, quote, invoice
  entityId: varchar("entity_id").notNull(),
  messageId: varchar("message_id").references(() => smsMessages.id, { onDelete: 'set null' }),
  status: text("status").default('sent'), // sent, failed, skipped
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("uniqueRuleEntity").on(table.ruleId, table.entityType, table.entityId),
  index("idx_sms_automation_logs_rule_id").on(table.ruleId),
  index("idx_sms_automation_logs_message_id").on(table.messageId),
]);

export const insertSmsAutomationLogSchema = createInsertSchema(smsAutomationLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertSmsAutomationLog = z.infer<typeof insertSmsAutomationLogSchema>;
export type SmsAutomationLog = typeof smsAutomationLogs.$inferSelect;

// ========================
// Xero Integration Tables
// ========================

// Xero Connections - OAuth tokens and connection info
export const xeroConnections = pgTable("xero_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  tenantId: varchar("tenant_id").notNull(),
  tenantName: varchar("tenant_name"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at").notNull(),
  scope: varchar("scope"),
  connectedAt: timestamp("connected_at").defaultNow(),
  lastSyncAt: timestamp("last_sync_at"),
  status: varchar("status").default('active'),
}, (table) => [
  index("idx_xero_connections_user_id").on(table.userId),
]);

export const insertXeroConnectionSchema = createInsertSchema(xeroConnections).omit({
  id: true,
  connectedAt: true,
  lastSyncAt: true,
});
export type InsertXeroConnection = z.infer<typeof insertXeroConnectionSchema>;
export type XeroConnection = typeof xeroConnections.$inferSelect;

// Xero Sync State - Track sync progress per entity type
export const xeroSyncState = pgTable("xero_sync_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  entityType: varchar("entity_type").notNull(),
  lastSyncCursor: varchar("last_sync_cursor"),
  lastSyncAt: timestamp("last_sync_at"),
  syncDirection: varchar("sync_direction").default('bidirectional'),
  outcome: varchar("outcome"),
  recordsProcessed: integer("records_processed").default(0),
  recordsFailed: integer("records_failed").default(0),
  durationMs: integer("duration_ms"),
  errorDetails: text("error_details"),
  startedAt: timestamp("started_at"),
}, (table) => [
  index("idx_xero_sync_state_user_id").on(table.userId),
]);

export const insertXeroSyncStateSchema = createInsertSchema(xeroSyncState).omit({
  id: true,
});
export type InsertXeroSyncState = z.infer<typeof insertXeroSyncStateSchema>;
export type XeroSyncState = typeof xeroSyncState.$inferSelect;

// External Accounting IDs - Map local entities to Xero entities
export const externalAccountingIds = pgTable("external_accounting_ids", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  localEntityType: varchar("local_entity_type").notNull(),
  localEntityId: varchar("local_entity_id").notNull(),
  provider: varchar("provider").notNull(),
  externalId: varchar("external_id").notNull(),
  syncStatus: varchar("sync_status").default('synced'),
  lastSyncAt: timestamp("last_sync_at"),
}, (table) => ({
  uniqueLocalEntity: unique().on(table.localEntityType, table.localEntityId, table.provider),
}));

export const insertExternalAccountingIdSchema = createInsertSchema(externalAccountingIds).omit({
  id: true,
});
export type InsertExternalAccountingId = z.infer<typeof insertExternalAccountingIdSchema>;
export type ExternalAccountingId = typeof externalAccountingIds.$inferSelect;

// ========================
// MYOB Integration Tables
// ========================

// MYOB Connections - OAuth tokens and connection info for MYOB AccountRight
export const myobConnections = pgTable("myob_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  businessId: varchar("business_id").notNull(), // Company File GUID from callback
  companyName: varchar("company_name"),
  accessToken: text("access_token").notNull(), // Encrypted
  refreshToken: text("refresh_token").notNull(), // Encrypted
  tokenExpiresAt: timestamp("token_expires_at").notNull(),
  cfUsername: text("cf_username"), // Company File username (encrypted)
  cfPassword: text("cf_password"), // Company File password (encrypted)
  scope: varchar("scope"),
  connectedAt: timestamp("connected_at").defaultNow(),
  lastSyncAt: timestamp("last_sync_at"),
  status: varchar("status").default('active'),
}, (table) => [
  index("idx_myob_connections_user_id").on(table.userId),
]);

export const insertMyobConnectionSchema = createInsertSchema(myobConnections).omit({
  id: true,
  connectedAt: true,
  lastSyncAt: true,
});
export type InsertMyobConnection = z.infer<typeof insertMyobConnectionSchema>;
export type MyobConnection = typeof myobConnections.$inferSelect;

// ========================
// QuickBooks Integration Tables
// ========================

// QuickBooks Connections - OAuth tokens and connection info for QuickBooks Online
export const quickbooksConnections = pgTable("quickbooks_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  realmId: varchar("realm_id").notNull(), // QuickBooks company ID
  companyName: varchar("company_name"),
  accessToken: text("access_token").notNull(), // Encrypted
  refreshToken: text("refresh_token").notNull(), // Encrypted
  tokenExpiresAt: timestamp("token_expires_at").notNull(),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"), // QB refresh tokens also expire
  scope: varchar("scope"),
  connectedAt: timestamp("connected_at").defaultNow(),
  lastSyncAt: timestamp("last_sync_at"),
  status: varchar("status").default('active'),
}, (table) => [
  index("idx_quickbooks_connections_user_id").on(table.userId),
]);

export const insertQuickbooksConnectionSchema = createInsertSchema(quickbooksConnections).omit({
  id: true,
  connectedAt: true,
  lastSyncAt: true,
});
export type InsertQuickbooksConnection = z.infer<typeof insertQuickbooksConnectionSchema>;
export type QuickbooksConnection = typeof quickbooksConnections.$inferSelect;

// Australian WHS safety form templates live in ./safety-forms (dependency-free,
// imported by the web frontend via @shared/safety-forms).
export * from './safety-forms';

// Job Reminders - Automated SMS/email notifications before job starts
export const jobReminders = pgTable("job_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text("type").notNull().default('sms'), // sms, email, both
  sendAt: timestamp("send_at").notNull(), // When to send the reminder
  hoursBeforeJob: integer("hours_before_job").notNull().default(24), // 24h, 1h, etc.
  status: text("status").notNull().default('pending'), // pending, sent, failed, cancelled
  sentAt: timestamp("sent_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_job_reminders_job_id").on(table.jobId),
  index("idx_job_reminders_user_id").on(table.userId),
]);

export const insertJobReminderSchema = createInsertSchema(jobReminders).omit({ id: true, createdAt: true });
export type InsertJobReminder = z.infer<typeof insertJobReminderSchema>;
export type JobReminder = typeof jobReminders.$inferSelect;

// Job Photo Requirements - Require photos at specific stages
export const jobPhotoRequirements = pgTable("job_photo_requirements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  stage: text("stage").notNull(), // before_start, during, after_completion
  description: text("description").notNull(),
  isRequired: boolean("is_required").default(true),
  isFulfilled: boolean("is_fulfilled").default(false),
  fulfilledAt: timestamp("fulfilled_at"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_job_photo_requirements_job_id").on(table.jobId),
]);

export const insertJobPhotoRequirementSchema = createInsertSchema(jobPhotoRequirements).omit({ id: true, createdAt: true });
export type InsertJobPhotoRequirement = z.infer<typeof insertJobPhotoRequirementSchema>;
export type JobPhotoRequirement = typeof jobPhotoRequirements.$inferSelect;

// Defect Tracking - Track warranty work and defects
export const defects = pgTable("defects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: 'set null' }),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull().default('medium'), // low, medium, high, critical
  status: text("status").notNull().default('reported'), // reported, acknowledged, in_progress, resolved, closed
  reportedBy: text("reported_by"), // Client name or staff member
  reportedAt: timestamp("reported_at").defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  photos: jsonb("photos").default([]),
  resolutionNotes: text("resolution_notes"),
  warrantyClaimId: varchar("warranty_claim_id"), // Link to warranty if applicable
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_defects_job_id").on(table.jobId),
  index("idx_defects_user_id").on(table.userId),
  index("idx_defects_client_id").on(table.clientId),
]);

export const insertDefectSchema = createInsertSchema(defects).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDefect = z.infer<typeof insertDefectSchema>;
export type Defect = typeof defects.$inferSelect;

// Timesheet Approvals - Workflow for crew timesheets
export const timesheetApprovals = pgTable("timesheet_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timeEntryId: varchar("time_entry_id").notNull().references(() => timeEntries.id, { onDelete: 'cascade' }),
  submittedBy: varchar("submitted_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  approvedBy: varchar("approved_by").references(() => users.id, { onDelete: 'set null' }),
  status: text("status").notNull().default('pending'), // pending, approved, rejected, revision_requested
  submittedAt: timestamp("submitted_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_timesheet_approvals_time_entry_id").on(table.timeEntryId),
  index("idx_timesheet_approvals_submitted_by").on(table.submittedBy),
  index("idx_timesheet_approvals_approved_by").on(table.approvedBy),
]);

export const insertTimesheetApprovalSchema = createInsertSchema(timesheetApprovals).omit({ id: true, createdAt: true });
export type InsertTimesheetApproval = z.infer<typeof insertTimesheetApprovalSchema>;
export type TimesheetApproval = typeof timesheetApprovals.$inferSelect;

// Job Materials - Track materials/parts for each job
export const jobMaterials = pgTable("job_materials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).default('1'),
  unit: text("unit").default('each'),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).default('0'),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).default('0'),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).default('0'),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).default('0'),
  supplier: text("supplier"),
  trackingNumber: text("tracking_number"),
  trackingCarrier: text("tracking_carrier"),
  trackingUrl: text("tracking_url"),
  status: text("status").default('needed'),
  notes: text("notes"),
  markupPercent: decimal("markup_percent", { precision: 5, scale: 2 }),
  receiptPhotoUrl: text("receipt_photo_url"),
  // Optional phase tag — when set, overrides date-window attribution in the profitability breakdown
  phaseId: varchar("phase_id").references(() => jobPhases.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_job_materials_job_id").on(table.jobId),
  index("idx_job_materials_user_id").on(table.userId),
]);

export const insertJobMaterialSchema = createInsertSchema(jobMaterials).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJobMaterial = z.infer<typeof insertJobMaterialSchema>;
export type JobMaterial = typeof jobMaterials.$inferSelect;

// Job Equipment Assignments - Track equipment assigned to jobs
export const jobEquipment = pgTable("job_equipment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  equipmentId: varchar("equipment_id").notNull().references(() => equipment.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  notes: text("notes"),
  hoursUsed: decimal("hours_used", { precision: 8, scale: 2 }),
  kmTravelled: decimal("km_travelled", { precision: 10, scale: 2 }),
  capacityUsed: text("capacity_used"),
  capacityAvailable: text("capacity_available"),
  postJobNotes: text("post_job_notes"),
  wasOversized: boolean("was_oversized").default(false),
  completedAt: timestamp("completed_at"),
  assignedAt: timestamp("assigned_at").defaultNow(),
}, (table) => [
  index("idx_job_equipment_job_id").on(table.jobId),
  index("idx_job_equipment_equipment_id").on(table.equipmentId),
  index("idx_job_equipment_user_id").on(table.userId),
]);

export const insertJobEquipmentSchema = createInsertSchema(jobEquipment).omit({ id: true, assignedAt: true });
export type InsertJobEquipment = z.infer<typeof insertJobEquipmentSchema>;
export type JobEquipment = typeof jobEquipment.$inferSelect;

// Automation Settings - Configure automatic behaviors
export const automationSettings = pgTable("automation_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  // Job Reminders
  jobReminderEnabled: boolean("job_reminder_enabled").default(false),
  jobReminderHoursBefore: integer("job_reminder_hours_before").default(24),
  jobReminderType: text("job_reminder_type").default('sms'), // sms, email, both
  // Quote Reminders
  quoteFollowUpEnabled: boolean("quote_follow_up_enabled").default(false),
  quoteFollowUpDays: integer("quote_follow_up_days").default(3),
  quoteFollowUpType: text("quote_follow_up_type").default('email'),
  // Invoice Reminders
  invoiceReminderEnabled: boolean("invoice_reminder_enabled").default(false),
  invoiceReminderDaysBeforeDue: integer("invoice_reminder_days_before_due").default(3),
  invoiceOverdueReminderDays: integer("invoice_overdue_reminder_days").default(7),
  invoiceReminderType: text("invoice_reminder_type").default('email'),
  // Message Templates
  quoteFollowUpMessage: text("quote_follow_up_message"),
  jobReminderMessage: text("job_reminder_message"),
  invoiceReminderMessage: text("invoice_reminder_message"),
  reviewRequestMessage: text("review_request_message"),
  // Auto-invoice on complete
  autoInvoiceOnComplete: boolean("auto_invoice_on_complete").default(false),
  // Auto-review request
  autoReviewRequest: boolean("auto_review_request").default(false),
  autoReviewRequestType: text("auto_review_request_type").default('email'), // sms, email, both
  // Photo Requirements
  requirePhotoBeforeStart: boolean("require_photo_before_start").default(false),
  requirePhotoAfterComplete: boolean("require_photo_after_complete").default(false),
  photoRequirementsEnabled: boolean("photo_requirements_enabled").default(false),
  // GPS Check-in
  autoCheckInOnArrival: boolean("auto_check_in_on_arrival").default(false),
  autoCheckOutOnDeparture: boolean("auto_check_out_on_departure").default(false),
  gpsAutoCheckInEnabled: boolean("gps_auto_check_in_enabled").default(false),
  technicianEnRouteEnabled: boolean("technician_en_route_enabled").default(false),
  technicianEnRouteChannel: text("technician_en_route_channel").default('sms'),
  // Daily Summary Email
  dailySummaryEnabled: boolean("daily_summary_enabled").default(false),
  dailySummaryTime: text("daily_summary_time").default('18:00'), // HH:mm format
  dailySummaryLastSent: timestamp("daily_summary_last_sent"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAutomationSettingsSchema = createInsertSchema(automationSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAutomationSettings = z.infer<typeof insertAutomationSettingsSchema>;
export type AutomationSettings = typeof automationSettings.$inferSelect;

// ========================
// Stripe Terminal - Tap to Pay
// ========================

// Terminal Locations - Required for Stripe Terminal
export const terminalLocations = pgTable("terminal_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeLocationId: varchar("stripe_location_id").notNull().unique(), // Stripe's location ID
  displayName: text("display_name").notNull(),
  address: jsonb("address"), // { line1, city, state, postal_code, country }
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_terminal_locations_user_id").on(table.userId),
]);

export const insertTerminalLocationSchema = createInsertSchema(terminalLocations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTerminalLocation = z.infer<typeof insertTerminalLocationSchema>;
export type TerminalLocation = typeof terminalLocations.$inferSelect;

// Terminal Payments - Track in-person tap-to-pay transactions
export const terminalPayments = pgTable("terminal_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripePaymentIntentId: varchar("stripe_payment_intent_id").unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default('aud'),
  status: text("status").notNull().default('pending'), // pending, processing, succeeded, failed, cancelled
  description: text("description"),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: 'set null' }),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: 'set null' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  locationId: varchar("location_id").references(() => terminalLocations.id, { onDelete: 'set null' }),
  paymentMethod: text("payment_method"), // card_present, interac_present
  cardBrand: varchar("card_brand"), // visa, mastercard, amex, etc.
  cardLast4: varchar("card_last_4"),
  receiptUrl: text("receipt_url"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_terminal_payments_user_id").on(table.userId),
  index("idx_terminal_payments_client_id").on(table.clientId),
  index("idx_terminal_payments_invoice_id").on(table.invoiceId),
  index("idx_terminal_payments_job_id").on(table.jobId),
  index("idx_terminal_payments_location_id").on(table.locationId),
]);

export const insertTerminalPaymentSchema = createInsertSchema(terminalPayments).omit({ id: true, createdAt: true });
export type InsertTerminalPayment = z.infer<typeof insertTerminalPaymentSchema>;
export type TerminalPayment = typeof terminalPayments.$inferSelect;

// Tap to Pay Terms & Conditions Acceptance - Required by Apple (3.5, 3.8, 3.8.1)
export const tapToPayTermsAcceptance = pgTable("tap_to_pay_terms_acceptance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  acceptedAt: timestamp("accepted_at").notNull().defaultNow(),
  acceptedByUserId: varchar("accepted_by_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  acceptedByName: text("accepted_by_name"),
  acceptedByEmail: text("accepted_by_email"),
  termsVersion: text("terms_version").default('1.0'),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  tutorialCompleted: boolean("tutorial_completed").default(false),
  tutorialCompletedAt: timestamp("tutorial_completed_at"),
  splashShown: boolean("splash_shown").default(false),
  splashShownAt: timestamp("splash_shown_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_tap_to_pay_terms_acceptance_accepted_by_user_id").on(table.acceptedByUserId),
]);

export const insertTapToPayTermsAcceptanceSchema = createInsertSchema(tapToPayTermsAcceptance).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTapToPayTermsAcceptance = z.infer<typeof insertTapToPayTermsAcceptanceSchema>;
export type TapToPayTermsAcceptance = typeof tapToPayTermsAcceptance.$inferSelect;

// ========================
// CRM / Lead Pipeline
// ========================

export const LEAD_SOURCES = ['phone', 'email', 'website', 'referral', 'booking_page', 'ai_receptionist', 'other'] as const;
export type LeadSource = typeof LEAD_SOURCES[number];

export const LEAD_STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'] as const;
export type LeadStatus = typeof LEAD_STATUSES[number];

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: 'set null' }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  source: text("source").default('other'), // phone, email, website, referral, other
  status: text("status").default('new'), // new, contacted, quoted, won, lost
  description: text("description"),
  estimatedValue: decimal("estimated_value", { precision: 10, scale: 2 }),
  notes: text("notes"),
  followUpDate: timestamp("follow_up_date"),
  wonLostReason: text("won_lost_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_leads_user_id").on(table.userId),
  index("idx_leads_client_id").on(table.clientId),
]);

export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;


// ========================
// Payment Scheduling (Installment Plans)
// ========================

export const INSTALLMENT_STATUSES = ['pending', 'due', 'paid', 'overdue', 'cancelled'] as const;
export type InstallmentStatus = typeof INSTALLMENT_STATUSES[number];

// Payment Schedule - Links an invoice to an installment plan
export const paymentSchedules = pgTable("payment_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  numberOfInstallments: integer("number_of_installments").notNull(),
  frequency: text("frequency").default('monthly'), // weekly, fortnightly, monthly
  startDate: timestamp("start_date").notNull(),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_payment_schedules_user_id").on(table.userId),
  index("idx_payment_schedules_invoice_id").on(table.invoiceId),
  index("idx_payment_schedules_client_id").on(table.clientId),
]);

export const insertPaymentScheduleSchema = createInsertSchema(paymentSchedules).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPaymentSchedule = z.infer<typeof insertPaymentScheduleSchema>;
export type PaymentSchedule = typeof paymentSchedules.$inferSelect;

// Payment Installments - Individual installments within a schedule
export const paymentInstallments = pgTable("payment_installments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scheduleId: varchar("schedule_id").notNull().references(() => paymentSchedules.id, { onDelete: 'cascade' }),
  installmentNumber: integer("installment_number").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: text("status").default('pending'), // pending, due, paid, overdue, cancelled
  paidAt: timestamp("paid_at"),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }),
  paymentMethod: text("payment_method"), // stripe, cash, bank_transfer
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  reminderSentAt: timestamp("reminder_sent_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_payment_installments_schedule_id").on(table.scheduleId),
]);

export const insertPaymentInstallmentSchema = createInsertSchema(paymentInstallments).omit({ id: true, createdAt: true });
export type InsertPaymentInstallment = z.infer<typeof insertPaymentInstallmentSchema>;
export type PaymentInstallment = typeof paymentInstallments.$inferSelect;

// Team Groups - Custom named crew groups for organizing team members
export const teamGroups = pgTable("team_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 20 }).default("#3b82f6"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_team_groups_user_id").on(table.userId),
]);

export const insertTeamGroupSchema = createInsertSchema(teamGroups).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTeamGroup = z.infer<typeof insertTeamGroupSchema>;
export type TeamGroup = typeof teamGroups.$inferSelect;

// Team Group Members - Junction table for team members in groups
export const teamGroupMembers = pgTable("team_group_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => teamGroups.id, { onDelete: 'cascade' }),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: 'cascade' }),
  role: varchar("role", { length: 20 }).default("member"),
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => [
  index("idx_team_group_members_group_id").on(table.groupId),
  index("idx_team_group_members_team_member_id").on(table.teamMemberId),
]);

export const insertTeamGroupMemberSchema = createInsertSchema(teamGroupMembers).omit({ id: true, joinedAt: true });
export type InsertTeamGroupMember = z.infer<typeof insertTeamGroupMemberSchema>;
export type TeamGroupMember = typeof teamGroupMembers.$inferSelect;

// ========================
// Job Invites (Shareable magic links for subcontractors)
// ========================

export const JOB_INVITE_ROLES = ['subcontractor', 'viewer'] as const;
export type JobInviteRole = typeof JOB_INVITE_ROLES[number];

export const JOB_INVITE_STATUSES = ['pending', 'accepted', 'expired', 'revoked'] as const;
export type JobInviteStatus = typeof JOB_INVITE_STATUSES[number];

export const JOB_INVITE_PERMISSIONS = ['view_job', 'add_notes', 'add_photos', 'update_status', 'view_client'] as const;
export type JobInvitePermission = typeof JOB_INVITE_PERMISSIONS[number];

export const jobInvites = pgTable("job_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  inviteCode: varchar("invite_code", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 255 }),
  role: varchar("role", { length: 50 }).default("subcontractor"),
  permissions: jsonb("permissions").default(['view_job', 'add_notes']),
  expiresAt: timestamp("expires_at"),
  usedAt: timestamp("used_at"),
  usedBy: varchar("used_by").references(() => users.id),
  status: varchar("status", { length: 20 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_job_invites_job_id").on(table.jobId),
  index("idx_job_invites_user_id").on(table.userId),
  index("idx_job_invites_used_by").on(table.usedBy),
]);

export const insertJobInviteSchema = createInsertSchema(jobInvites).omit({ id: true, createdAt: true, usedAt: true, usedBy: true });
export type InsertJobInvite = z.infer<typeof insertJobInviteSchema>;
export type JobInvite = typeof jobInvites.$inferSelect;

// Client Portal Verification Codes - OTP codes for client portal access
export const portalVerificationCodes = pgTable("portal_verification_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phone: varchar("phone", { length: 20 }).notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").default(false),
  attempts: integer("attempts").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPortalVerificationCodeSchema = createInsertSchema(portalVerificationCodes).omit({ id: true, createdAt: true });
export type InsertPortalVerificationCode = z.infer<typeof insertPortalVerificationCodeSchema>;
export type PortalVerificationCode = typeof portalVerificationCodes.$inferSelect;

// Client Portal Sessions - Authenticated portal sessions
export const portalSessions = pgTable("portal_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phone: varchar("phone", { length: 20 }).notNull(),
  sessionToken: varchar("session_token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  // Populated by auto-auth (document bearer token) to bound the session to the
  // issuing business only. NULL on phone-OTP sessions (phone-global scope).
  userId: varchar("user_id"),
});

export const insertPortalSessionSchema = createInsertSchema(portalSessions).omit({ id: true, createdAt: true });
export type InsertPortalSession = z.infer<typeof insertPortalSessionSchema>;
export type PortalSession = typeof portalSessions.$inferSelect;

// Job Portal Tokens - Per-job tracking links for clients (Uber-style portal)
export const jobPortalTokens = pgTable("job_portal_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  assignmentId: varchar("assignment_id").references(() => jobAssignments.id, { onDelete: 'set null' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  lastAccessedAt: timestamp("last_accessed_at"),
  accessCount: integer("access_count").default(0),
  createdBy: varchar("created_by").notNull(),
  showTimeline: boolean("show_timeline").default(true),
  showPhotos: boolean("show_photos").default(true),
  showChecklist: boolean("show_checklist").default(true),
  showActivityFeed: boolean("show_activity_feed").default(true),
  showFinancialsOnPortal: boolean("show_financials_on_portal").default(false),
  showProgrammeOnPortal: boolean("show_programme_on_portal").default(false),
  clientMessage: text("client_message"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_job_portal_tokens_job_id").on(table.jobId),
  index("idx_job_portal_tokens_assignment_id").on(table.assignmentId),
  index("idx_job_portal_tokens_user_id").on(table.userId),
]);

export const insertJobPortalTokenSchema = createInsertSchema(jobPortalTokens).omit({ id: true, createdAt: true, accessCount: true, lastAccessedAt: true });
export type InsertJobPortalToken = z.infer<typeof insertJobPortalTokenSchema>;
export type JobPortalToken = typeof jobPortalTokens.$inferSelect;

// SMS Notification Log - Anti-spam tracking
export const smsNotificationLog = pgTable("sms_notification_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  assignmentId: varchar("assignment_id").references(() => jobAssignments.id, { onDelete: 'set null' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientPhone: varchar("client_phone").notNull(),
  notificationType: text("notification_type").notNull(),
  smsMessageId: varchar("sms_message_id").references(() => smsMessages.id, { onDelete: 'set null' }),
  portalTokenId: varchar("portal_token_id").references(() => jobPortalTokens.id, { onDelete: 'set null' }),
  etaMinutes: integer("eta_minutes"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_sms_notification_log_job_id").on(table.jobId),
  index("idx_sms_notification_log_assignment_id").on(table.assignmentId),
  index("idx_sms_notification_log_user_id").on(table.userId),
  index("idx_sms_notification_log_sms_message_id").on(table.smsMessageId),
  index("idx_sms_notification_log_portal_token_id").on(table.portalTokenId),
]);

export const insertSmsNotificationLogSchema = createInsertSchema(smsNotificationLog).omit({ id: true, createdAt: true, sentAt: true });
export type InsertSmsNotificationLog = z.infer<typeof insertSmsNotificationLogSchema>;
export type SmsNotificationLog = typeof smsNotificationLog.$inferSelect;

// Assignment Events - Audit logging
export const assignmentEvents = pgTable("assignment_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull().references(() => jobAssignments.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  actorUserId: varchar("actor_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventType: text("event_type").notNull(),
  eventData: jsonb("event_data").default({}),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_assignment_events_assignment_id").on(table.assignmentId),
  index("idx_assignment_events_job_id").on(table.jobId),
  index("idx_assignment_events_actor_user_id").on(table.actorUserId),
]);

export const insertAssignmentEventSchema = createInsertSchema(assignmentEvents).omit({ id: true, createdAt: true });
export type InsertAssignmentEvent = z.infer<typeof insertAssignmentEventSchema>;
export type AssignmentEvent = typeof assignmentEvents.$inferSelect;

export const locationPings = pgTable("location_pings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull().references(() => jobAssignments.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  accuracyMeters: doublePrecision("accuracy_meters"),
  recordedAt: timestamp("recorded_at").defaultNow(),
}, (table) => [
  index("idx_location_pings_assignment_id").on(table.assignmentId),
  index("idx_location_pings_user_id").on(table.userId),
]);

export const insertLocationPingSchema = createInsertSchema(locationPings).omit({ id: true, recordedAt: true });
export type InsertLocationPing = z.infer<typeof insertLocationPingSchema>;
export type LocationPing = typeof locationPings.$inferSelect;

// Subcontractor Secure Tokens - Web-only access for subcontractors
export const subcontractorTokens = pgTable("subcontractor_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  inviteId: varchar("invite_id").references(() => jobInvites.id, { onDelete: 'set null' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  contactPhone: varchar("contact_phone", { length: 20 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactName: varchar("contact_name", { length: 255 }),
  permissions: jsonb("permissions").default(['view_job', 'add_notes', 'add_photos', 'update_status']),
  status: varchar("status", { length: 20 }).default("pending"),
  acceptedAt: timestamp("accepted_at"),
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
  lastAccessedAt: timestamp("last_accessed_at"),
  etaMinutes: integer("eta_minutes"),
  hourlyRate: varchar("hourly_rate", { length: 20 }),
  // Wrong-number / verification hardening
  requireCode: boolean("require_code").default(false),
  codeHash: varchar("code_hash", { length: 255 }),
  codeAttempts: integer("code_attempts").default(0),
  codeIssuedAt: timestamp("code_issued_at"),
  nameConfirmedAt: timestamp("name_confirmed_at"),
  lastOpenedFromCity: varchar("last_opened_from_city", { length: 120 }),
  lastOpenedFromIp: varchar("last_opened_from_ip", { length: 64 }),
  openCount: integer("open_count").default(0),
  revokedReason: varchar("revoked_reason", { length: 40 }),
  recipientUserId: varchar("recipient_user_id").references(() => users.id, { onDelete: 'set null' }), // Linked sub user (set after they save an account, OR pre-set if phone matches existing user)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_subcontractor_tokens_job_id").on(table.jobId),
  index("idx_subcontractor_tokens_invite_id").on(table.inviteId),
  index("idx_subcontractor_tokens_user_id").on(table.userId),
  index("idx_subcontractor_tokens_recipient_user_id").on(table.recipientUserId),
]);

export const insertSubcontractorTokenSchema = createInsertSchema(subcontractorTokens).omit({ id: true, createdAt: true, lastAccessedAt: true, acceptedAt: true, revokedAt: true, codeHash: true, codeAttempts: true, codeIssuedAt: true, nameConfirmedAt: true, lastOpenedFromCity: true, lastOpenedFromIp: true, openCount: true, revokedReason: true, recipientUserId: true });
export type InsertSubcontractorToken = z.infer<typeof insertSubcontractorTokenSchema>;
export type SubcontractorToken = typeof subcontractorTokens.$inferSelect;

// Subcontractor Sessions - OTP-verified sessions for web subbies
export const subcontractorSessions = pgTable("subcontractor_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenId: varchar("token_id").notNull().references(() => subcontractorTokens.id, { onDelete: 'cascade' }),
  sessionToken: varchar("session_token", { length: 64 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_subcontractor_sessions_token_id").on(table.tokenId),
]);

export const insertSubcontractorSessionSchema = createInsertSchema(subcontractorSessions).omit({ id: true, createdAt: true });
export type InsertSubcontractorSession = z.infer<typeof insertSubcontractorSessionSchema>;
export type SubcontractorSession = typeof subcontractorSessions.$inferSelect;

// Subcontractor Events - Audit logging for subcontractor web actions
export const subcontractorEvents = pgTable("subcontractor_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenId: varchar("token_id").notNull().references(() => subcontractorTokens.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  eventType: text("event_type").notNull(),
  eventData: jsonb("event_data").default({}),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_subcontractor_events_token_id").on(table.tokenId),
  index("idx_subcontractor_events_job_id").on(table.jobId),
]);

export const insertSubcontractorEventSchema = createInsertSchema(subcontractorEvents).omit({ id: true, createdAt: true });
export type InsertSubcontractorEvent = z.infer<typeof insertSubcontractorEventSchema>;
export type SubcontractorEvent = typeof subcontractorEvents.$inferSelect;

// Subcontractor Location Pings - Periodic location updates from web view
export const subcontractorLocationPings = pgTable("subcontractor_location_pings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenId: varchar("token_id").notNull().references(() => subcontractorTokens.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  accuracyMeters: doublePrecision("accuracy_meters"),
  recordedAt: timestamp("recorded_at").defaultNow(),
}, (table) => [
  index("idx_subcontractor_location_pings_token_id").on(table.tokenId),
  index("idx_subcontractor_location_pings_job_id").on(table.jobId),
]);

export const insertSubcontractorLocationPingSchema = createInsertSchema(subcontractorLocationPings).omit({ id: true, recordedAt: true });
export type InsertSubcontractorLocationPing = z.infer<typeof insertSubcontractorLocationPingSchema>;
export type SubcontractorLocationPing = typeof subcontractorLocationPings.$inferSelect;

// Worker Requests - Clients can request the same worker from a previous job
export const workerRequests = pgTable("worker_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  preferredWorkerId: varchar("preferred_worker_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  workerName: text("worker_name").notNull(),
  referenceJobId: varchar("reference_job_id").references(() => jobs.id, { onDelete: 'set null' }),
  referenceJobTitle: text("reference_job_title"),
  message: text("message"),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
}, (table) => [
  index("idx_worker_requests_client_id").on(table.clientId),
  index("idx_worker_requests_business_owner_id").on(table.businessOwnerId),
  index("idx_worker_requests_preferred_worker_id").on(table.preferredWorkerId),
  index("idx_worker_requests_reference_job_id").on(table.referenceJobId),
]);

export const insertWorkerRequestSchema = createInsertSchema(workerRequests).omit({ id: true, createdAt: true, respondedAt: true });
export type InsertWorkerRequest = z.infer<typeof insertWorkerRequestSchema>;
export type WorkerRequest = typeof workerRequests.$inferSelect;

// Compliance Documents - Business files, licences, insurance, white cards
export const complianceDocuments = pgTable("compliance_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text("type").notNull(), // 'licence', 'insurance', 'white_card', 'vehicle_rego', 'certification', 'other'
  title: text("title").notNull(),
  documentNumber: text("document_number"),
  issuer: text("issuer"),
  holderName: text("holder_name"), // For white cards - which worker holds this
  holderUserId: varchar("holder_user_id").references(() => users.id, { onDelete: 'set null' }), // Link to team member
  expiryDate: timestamp("expiry_date"),
  coverageAmount: text("coverage_amount"), // For insurance - e.g. "$20,000,000"
  insurer: text("insurer"), // For insurance
  vehiclePlate: text("vehicle_plate"), // For vehicle rego
  attachmentUrl: text("attachment_url"),
  attachmentType: text("attachment_type"), // 'pdf', 'image'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_compliance_documents_business_owner_id").on(table.businessOwnerId),
  index("idx_compliance_documents_holder_user_id").on(table.holderUserId),
]);

export const insertComplianceDocumentSchema = createInsertSchema(complianceDocuments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertComplianceDocument = z.infer<typeof insertComplianceDocumentSchema>;
export type ComplianceDocument = typeof complianceDocuments.$inferSelect;

// Job Requests - Client-initiated job requests from portal
export const jobRequests = pgTable("job_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description"),
  preferredDate: timestamp("preferred_date"),
  urgency: text("urgency").notNull().default('normal'),
  clientNotes: text("client_notes"),
  preferredWorkerId: varchar("preferred_worker_id"),
  preferredWorkerName: text("preferred_worker_name"),
  referenceJobId: varchar("reference_job_id").references(() => jobs.id, { onDelete: 'set null' }),
  referenceJobTitle: text("reference_job_title"),
  status: text("status").notNull().default('pending'),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_job_requests_user_id").on(table.userId),
  index("idx_job_requests_client_id").on(table.clientId),
  index("idx_job_requests_reference_job_id").on(table.referenceJobId),
  index("idx_job_requests_job_id").on(table.jobId),
]);

export const insertJobRequestSchema = createInsertSchema(jobRequests).omit({ id: true, createdAt: true, updatedAt: true, reviewedAt: true, jobId: true });
export type InsertJobRequest = z.infer<typeof insertJobRequestSchema>;
export type JobRequest = typeof jobRequests.$inferSelect;

// Saved Filters - User-saved filter presets for jobs list
export const savedFilters = pgTable("saved_filters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  filters: jsonb("filters").notNull(),
  entityType: text("entity_type").notNull().default('jobs'),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_saved_filters_user_id").on(table.userId),
]);

export const insertSavedFilterSchema = createInsertSchema(savedFilters).omit({ id: true, createdAt: true });
export type InsertSavedFilter = z.infer<typeof insertSavedFilterSchema>;
export type SavedFilter = typeof savedFilters.$inferSelect;

// Payment Records - Track partial/progress payments against invoices
export const paymentRecords = pgTable("payment_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  method: text("method").notNull().default('cash'),
  reference: text("reference"),
  note: text("note"),
  recordedBy: varchar("recorded_by"),
  paidAt: timestamp("paid_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_payment_records_invoice_id").on(table.invoiceId),
  index("idx_payment_records_user_id").on(table.userId),
]);

export const insertPaymentRecordSchema = createInsertSchema(paymentRecords).omit({ id: true, createdAt: true });
export type InsertPaymentRecord = z.infer<typeof insertPaymentRecordSchema>;
export type PaymentRecord = typeof paymentRecords.$inferSelect;

// SWMS (Safe Work Method Statements) - Australian WHS compliance
export const swmsDocuments = pgTable("swms_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  title: text("title").notNull(),
  description: text("description"),
  siteAddress: text("site_address"),
  workActivityDescription: text("work_activity_description"),
  ppeRequirements: jsonb("ppe_requirements").default([]),
  emergencyContact: text("emergency_contact"),
  firstAidLocation: text("first_aid_location"),
  status: text("status").notNull().default('draft'),
  attachmentUrl: text("attachment_url"),
  attachmentType: text("attachment_type"), // 'pdf', 'image', 'doc'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_swms_documents_user_id").on(table.userId),
  index("idx_swms_documents_job_id").on(table.jobId),
]);

export const swmsHazards = pgTable("swms_hazards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  swmsId: varchar("swms_id").notNull().references(() => swmsDocuments.id, { onDelete: 'cascade' }),
  stepNumber: integer("step_number").notNull().default(1),
  activityTask: text("activity_task").notNull(),
  hazard: text("hazard").notNull(),
  likelihood: text("likelihood").notNull().default('possible'),
  consequence: text("consequence").notNull().default('moderate'),
  riskBefore: text("risk_before").notNull().default('medium'),
  controlMeasures: text("control_measures"),
  riskAfter: text("risk_after").notNull().default('low'),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_swms_hazards_swms_id").on(table.swmsId),
]);

export const swmsSignatures = pgTable("swms_signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  swmsId: varchar("swms_id").notNull().references(() => swmsDocuments.id, { onDelete: 'cascade' }),
  workerName: text("worker_name").notNull(),
  workerUserId: varchar("worker_user_id").references(() => users.id, { onDelete: 'set null' }),
  signatureData: text("signature_data").notNull(),
  signedAt: timestamp("signed_at").notNull().defaultNow(),
  latitude: text("latitude"),
  longitude: text("longitude"),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_swms_signatures_swms_id").on(table.swmsId),
  index("idx_swms_signatures_worker_user_id").on(table.workerUserId),
]);

export const insertSwmsDocumentSchema = createInsertSchema(swmsDocuments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSwmsDocument = z.infer<typeof insertSwmsDocumentSchema>;
export type SwmsDocument = typeof swmsDocuments.$inferSelect;

export const insertSwmsHazardSchema = createInsertSchema(swmsHazards).omit({ id: true, createdAt: true });
export type InsertSwmsHazard = z.infer<typeof insertSwmsHazardSchema>;
export type SwmsHazard = typeof swmsHazards.$inferSelect;

export const insertSwmsSignatureSchema = createInsertSchema(swmsSignatures).omit({ id: true, createdAt: true });
export type InsertSwmsSignature = z.infer<typeof insertSwmsSignatureSchema>;
export type SwmsSignature = typeof swmsSignatures.$inferSelect;

// ============================================
// WHS (Work Health & Safety) Tables
// ============================================

export const incidentReports = pgTable("incident_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  incidentType: text("incident_type").notNull().default('near_miss'),
  severity: text("severity").notNull().default('minor'),
  title: text("title").notNull(),
  description: text("description").notNull(),
  location: text("location"),
  incidentDate: timestamp("incident_date").notNull().defaultNow(),
  reportedTo: text("reported_to"),
  reportedToRole: text("reported_to_role"),
  witnesses: json("witnesses").$type<string[]>(),
  immediateActions: text("immediate_actions"),
  photos: json("photos").$type<string[]>(),
  injuryDetails: text("injury_details"),
  bodyPartAffected: text("body_part_affected"),
  treatmentProvided: text("treatment_provided"),
  workerName: text("worker_name"),
  isNotifiable: boolean("is_notifiable").default(false),
  status: text("status").notNull().default('open'),
  followUpActions: text("follow_up_actions"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_incident_reports_user_id").on(table.userId),
  index("idx_incident_reports_job_id").on(table.jobId),
]);

export const siteEmergencyInfo = pgTable("site_emergency_info", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  siteName: text("site_name"),
  siteAddress: text("site_address"),
  assemblyPoint: text("assembly_point"),
  firstAidLocation: text("first_aid_location"),
  firstAidOfficer: text("first_aid_officer"),
  firstAidOfficerPhone: text("first_aid_officer_phone"),
  emergencyNumber: text("emergency_number").default('000'),
  nearestHospital: text("nearest_hospital"),
  nearestHospitalAddress: text("nearest_hospital_address"),
  fireEquipmentLocations: json("fire_equipment_locations").$type<string[]>(),
  evacuationRoutes: text("evacuation_routes"),
  siteSpecificHazards: json("site_specific_hazards").$type<string[]>(),
  additionalContacts: json("additional_contacts").$type<{name: string, role: string, phone: string}[]>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_site_emergency_info_user_id").on(table.userId),
  index("idx_site_emergency_info_job_id").on(table.jobId),
]);

export const jsaDocuments = pgTable("jsa_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  title: text("title").notNull(),
  description: text("description"),
  siteAddress: text("site_address"),
  assessedBy: text("assessed_by"),
  assessedDate: timestamp("assessed_date").defaultNow(),
  ppeRequirements: json("ppe_requirements").$type<string[]>(),
  status: text("status").notNull().default('draft'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_jsa_documents_user_id").on(table.userId),
  index("idx_jsa_documents_job_id").on(table.jobId),
]);

export const jsaSteps = pgTable("jsa_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jsaId: varchar("jsa_id").notNull().references(() => jsaDocuments.id, { onDelete: 'cascade' }),
  stepNumber: integer("step_number").notNull().default(1),
  taskDescription: text("task_description").notNull(),
  hazards: text("hazards").notNull(),
  riskLevel: text("risk_level").notNull().default('medium'),
  controlMeasures: text("control_measures").notNull(),
  responsiblePerson: text("responsible_person"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_jsa_steps_jsa_id").on(table.jsaId),
]);

export const siteHazardousEnvironments = pgTable("site_hazardous_environments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  environmentType: text("environment_type").notNull(),
  hazards: json("hazards").$type<string[]>(),
  controlMeasures: json("control_measures").$type<string[]>(),
  requiredPpe: json("required_ppe").$type<string[]>(),
  requiredLicenses: json("required_licenses").$type<string[]>(),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_site_hazardous_environments_user_id").on(table.userId),
  index("idx_site_hazardous_environments_job_id").on(table.jobId),
]);

export const siteSafetySignage = pgTable("site_safety_signage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  signType: text("sign_type").notNull(),
  signCategory: text("sign_category").notNull(),
  location: text("location"),
  description: text("description"),
  isRequired: boolean("is_required").default(true),
  isInstalled: boolean("is_installed").default(false),
  installedDate: timestamp("installed_date"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_site_safety_signage_user_id").on(table.userId),
  index("idx_site_safety_signage_job_id").on(table.jobId),
]);

export const insertIncidentReportSchema = createInsertSchema(incidentReports).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIncidentReport = z.infer<typeof insertIncidentReportSchema>;
export type IncidentReport = typeof incidentReports.$inferSelect;

export const insertSiteEmergencyInfoSchema = createInsertSchema(siteEmergencyInfo).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSiteEmergencyInfo = z.infer<typeof insertSiteEmergencyInfoSchema>;
export type SiteEmergencyInfo = typeof siteEmergencyInfo.$inferSelect;

export const insertJsaDocumentSchema = createInsertSchema(jsaDocuments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJsaDocument = z.infer<typeof insertJsaDocumentSchema>;
export type JsaDocument = typeof jsaDocuments.$inferSelect;

export const insertJsaStepSchema = createInsertSchema(jsaSteps).omit({ id: true, createdAt: true });
export type InsertJsaStep = z.infer<typeof insertJsaStepSchema>;
export type JsaStep = typeof jsaSteps.$inferSelect;

export const insertSiteHazardousEnvironmentSchema = createInsertSchema(siteHazardousEnvironments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSiteHazardousEnvironment = z.infer<typeof insertSiteHazardousEnvironmentSchema>;
export type SiteHazardousEnvironment = typeof siteHazardousEnvironments.$inferSelect;

export const insertSiteSafetySignageSchema = createInsertSchema(siteSafetySignage).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSiteSafetySignage = z.infer<typeof insertSiteSafetySignageSchema>;
export type SiteSafetySignage = typeof siteSafetySignage.$inferSelect;

export const hazardReports = pgTable("hazard_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  description: text("description").notNull(),
  location: text("location").notNull(),
  dateIdentified: text("date_identified").notNull(),
  timeIdentified: text("time_identified").notNull(),
  recommendedAction: text("recommended_action").notNull(),
  dateReportedToSupervisor: text("date_reported_to_supervisor"),
  timeReportedToSupervisor: text("time_reported_to_supervisor"),
  reportedBy: text("reported_by").notNull(),
  supervisorName: text("supervisor_name"),
  riskLevel: text("risk_level").notNull().default('medium'),
  status: text("status").notNull().default('open'),
  photos: text("photos").array(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_hazard_reports_user_id").on(table.userId),
  index("idx_hazard_reports_job_id").on(table.jobId),
]);

export const insertHazardReportSchema = createInsertSchema(hazardReports).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHazardReport = z.infer<typeof insertHazardReportSchema>;
export type HazardReport = typeof hazardReports.$inferSelect;

export const ppeChecklists = pgTable("ppe_checklists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  workerName: text("worker_name").notNull(),
  date: text("date").notNull(),
  hardHat: boolean("hard_hat").notNull().default(false),
  hiVis: boolean("hi_vis").notNull().default(false),
  safetyBoots: boolean("safety_boots").notNull().default(false),
  safetyGlasses: boolean("safety_glasses").notNull().default(false),
  hearingProtection: boolean("hearing_protection").notNull().default(false),
  gloves: boolean("gloves").notNull().default(false),
  sunscreen: boolean("sunscreen").notNull().default(false),
  respirator: boolean("respirator").notNull().default(false),
  safetyHarness: boolean("safety_harness").notNull().default(false),
  otherPpe: text("other_ppe"),
  allCorrect: boolean("all_correct").notNull().default(false),
  supervisorName: text("supervisor_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ppe_checklists_user_id").on(table.userId),
  index("idx_ppe_checklists_job_id").on(table.jobId),
]);

export const insertPpeChecklistSchema = createInsertSchema(ppeChecklists).omit({ id: true, createdAt: true });
export type InsertPpeChecklist = z.infer<typeof insertPpeChecklistSchema>;
export type PpeChecklist = typeof ppeChecklists.$inferSelect;

export const trainingRecords = pgTable("training_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  teamMemberId: varchar("team_member_id"),
  workerName: text("worker_name").notNull(),
  courseCode: text("course_code").notNull(),
  courseName: text("course_name").notNull(),
  rtoName: text("rto_name"),
  completionDate: text("completion_date").notNull(),
  expiryDate: text("expiry_date"),
  certificateNumber: text("certificate_number"),
  status: text("status").notNull().default('current'),
  attachmentUrl: text("attachment_url"),
  attachmentType: text("attachment_type"), // 'pdf', 'image', 'doc'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_training_records_user_id").on(table.userId),
]);

export const insertTrainingRecordSchema = createInsertSchema(trainingRecords).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTrainingRecord = z.infer<typeof insertTrainingRecordSchema>;
export type TrainingRecord = typeof trainingRecords.$inferSelect;

export const idempotencyKeys = pgTable("idempotency_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 512 }).notNull().unique(),
  response: text("response").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_idempotency_keys_key").on(table.key),
  index("idx_idempotency_keys_expires").on(table.expiresAt),
]);

export const rateLimits = pgTable("rate_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 512 }).notNull(),
  count: integer("count").notNull().default(1),
  windowStart: timestamp("window_start").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
}, (table) => [
  index("idx_rate_limits_key").on(table.key),
  index("idx_rate_limits_expires").on(table.expiresAt),
]);

export const aiReceptionistConfig = pgTable("ai_receptionist_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  label: text("label"),
  vapiAssistantId: text("vapi_assistant_id"),
  vapiPhoneNumberId: text("vapi_phone_number_id"),
  voiceId: text("voice_id"),
  voiceName: text("voice_name").default('Jess'),
  greeting: text("greeting"),
  mode: text("mode").notNull().default('off'), // off, after_hours, always_on_transfer, always_on_message, selective
  transferNumbers: json("transfer_numbers").default([]),
  businessHours: json("business_hours"),
  enabled: boolean("enabled").notNull().default(false),
  dedicatedPhoneNumber: text("dedicated_phone_number"),
  approvalStatus: text("approval_status").default('none'),
  provisioningError: text("provisioning_error"),
  stripeSubscriptionItemId: text("stripe_subscription_item_id"),
  twilioNumberSid: text("twilio_number_sid"),
  provisionedAt: timestamp("provisioned_at"),
  approvedAt: timestamp("approved_at"),
  knowledgeBank: json("knowledge_bank"),
  smsNotifications: boolean("sms_notifications").notNull().default(false),
  recordingEnabled: boolean("recording_enabled").notNull().default(false),
  voiceStability: real("voice_stability").default(0.5),
  voiceClarity: real("voice_clarity").default(0.75),
  voiceSpeed: real("voice_speed").default(1.0),
  voiceStyleExaggeration: real("voice_style_exaggeration").default(0),
  voiceSpeakerBoost: boolean("voice_speaker_boost").default(false),
  voicemailDetectionEnabled: boolean("voicemail_detection_enabled").default(true),
  voicemailMessage: text("voicemail_message"),
  silenceTimeoutSeconds: integer("silence_timeout_seconds").default(30),
  maxCallDurationSeconds: integer("max_call_duration_seconds").default(600),
  endCallMessage: text("end_call_message"),
  backgroundSound: text("background_sound").default('off'),
  aiModel: text("ai_model").default('gpt-4o-mini'),
  aiMaxTokens: integer("ai_max_tokens").default(250),
  aiTemperature: real("ai_temperature").default(0.5),
  customInstructions: text("custom_instructions"),
  autoReplyEnabled: boolean("auto_reply_enabled").notNull().default(true),
  autoReplyMessage: text("auto_reply_message").default("Thanks for calling {{business_name}}. We got your message and will get back to you shortly. — Sent via JobRunner"),
  lastLatencyMs: integer("last_latency_ms"),
  lastLatencyCheckedAt: timestamp("last_latency_checked_at"),
  latencyStatus: text("latency_status"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ai_config_user").on(table.userId),
  index("idx_ai_config_approval").on(table.approvalStatus),
  index("idx_ai_config_phone").on(table.dedicatedPhoneNumber),
]);

export const insertAiReceptionistConfigSchema = createInsertSchema(aiReceptionistConfig).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiReceptionistConfig = z.infer<typeof insertAiReceptionistConfigSchema>;
export type AiReceptionistConfig = typeof aiReceptionistConfig.$inferSelect;

// Tracks paid add-on subscriptions (AI Receptionist, Dedicated Number) so their
// billing state stays the single source of truth across iOS (Apple), Android & web (Stripe).
// addon: 'dedicated_number' | 'ai_receptionist'
// source: 'apple' | 'stripe'
// status: 'active' | 'past_due' | 'canceled' | 'expired'
export const addonSubscriptions = pgTable("addon_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  addon: text("addon").notNull(),
  source: text("source").notNull().default('apple'),
  status: text("status").notNull().default('active'),
  appleProductId: text("apple_product_id"),
  appleOriginalTransactionId: text("apple_original_transaction_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_addon_subs_user").on(table.userId),
  index("idx_addon_subs_apple_txn").on(table.appleOriginalTransactionId),
]);

export const insertAddonSubscriptionSchema = createInsertSchema(addonSubscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAddonSubscription = z.infer<typeof insertAddonSubscriptionSchema>;
export type AddonSubscription = typeof addonSubscriptions.$inferSelect;

export const aiReceptionistCalls = pgTable("ai_receptionist_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  vapiCallId: text("vapi_call_id").notNull(),
  phoneNumberId: varchar("phone_number_id"),
  calledNumber: text("called_number"),
  callerPhone: text("caller_phone"),
  callerName: text("caller_name"),
  status: text("status").notNull().default('ringing'), // ringing, in_progress, completed, failed, missed, transferred
  duration: integer("duration"), // seconds
  summary: text("summary"), // AI-generated call summary
  transcript: text("transcript"), // Full call transcript
  recordingUrl: text("recording_url"),
  leadId: varchar("lead_id"), // If a lead was created from this call
  outcome: text("outcome"), // message_taken, transferred, booked, missed
  transferredTo: text("transferred_to"),
  transferStatus: text("transfer_status"), // success, failed, declined, no_answer
  callerIntent: text("caller_intent"), // quote_request, job_request, enquiry, complaint, follow_up
  extractedInfo: json("extracted_info"), // {name, email, phone, address, jobType, urgency, notes}
  endedReason: text("ended_reason"), // caller_hangup, assistant_ended, transfer, error
  cost: decimal("cost", { precision: 8, scale: 4 }), // Vapi call cost
  sentiment: text("sentiment"), // positive, neutral, negative
  sentimentScore: real("sentiment_score"), // 0.0 to 1.0 confidence
  latencyMs: integer("latency_ms"), // Real measured per-call response latency from Vapi (avg turn time)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ai_calls_user").on(table.userId),
  index("idx_ai_calls_vapi").on(table.vapiCallId),
  index("idx_ai_calls_created").on(table.createdAt),
  index("idx_ai_calls_phone_number").on(table.phoneNumberId),
]);

export const insertAiReceptionistCallSchema = createInsertSchema(aiReceptionistCalls).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiReceptionistCall = z.infer<typeof insertAiReceptionistCallSchema>;
export type AiReceptionistCall = typeof aiReceptionistCalls.$inferSelect;

export const errorLogs = pgTable("error_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  level: text("level").notNull(),
  category: text("category").notNull(),
  message: text("message").notNull(),
  userId: varchar("user_id"),
  metadata: jsonb("metadata"),
  errorDetails: jsonb("error_details"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_error_logs_level").on(table.level),
  index("idx_error_logs_category").on(table.category),
  index("idx_error_logs_created").on(table.createdAt),
]);

export type ErrorLog = typeof errorLogs.$inferSelect;

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id").notNull().references(() => users.id),
  targetUserId: varchar("target_user_id").notNull().references(() => users.id),
  actionType: text("action_type").notNull(),
  metadata: jsonb("metadata"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_audit_logs_admin").on(table.adminUserId),
  index("idx_audit_logs_target").on(table.targetUserId),
  index("idx_audit_logs_created").on(table.createdAt),
]);

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export const systemEvents = pgTable("system_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: text("event_type").notNull(),
  severity: text("severity").notNull().default('info'),
  source: text("source").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  userId: varchar("user_id"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_system_events_type").on(table.eventType),
  index("idx_system_events_severity").on(table.severity),
  index("idx_system_events_source").on(table.source),
  index("idx_system_events_created").on(table.createdAt),
]);

export const insertSystemEventSchema = createInsertSchema(systemEvents).omit({ id: true, createdAt: true });
export type InsertSystemEvent = z.infer<typeof insertSystemEventSchema>;
export type SystemEvent = typeof systemEvents.$inferSelect;

export const websiteAddons = pgTable("website_addons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessId: varchar("business_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  domainUrl: text("domain_url"),
  domainStatus: text("domain_status").notNull().default('not_set_up'),
  hostingStatus: text("hosting_status").notNull().default('inactive'),
  monthlyFee: decimal("monthly_fee", { precision: 10, scale: 2 }),
  websiteClickToCall: boolean("website_click_to_call").default(true),
  websiteChatWidget: boolean("website_chat_widget").default(true),
  websiteBookingForm: boolean("website_booking_form").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_website_addons_business").on(table.businessId),
  unique("website_addons_business_id_unique").on(table.businessId),
]);

export const insertWebsiteAddonSchema = createInsertSchema(websiteAddons).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWebsiteAddon = z.infer<typeof insertWebsiteAddonSchema>;
export type WebsiteAddon = typeof websiteAddons.$inferSelect;

export const websiteChangeRequests = pgTable("website_change_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessId: varchar("business_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text("title"),
  description: text("description").notNull(),
  priority: text("priority").notNull().default('normal'),
  status: text("status").notNull().default('todo'),
  screenshotUrl: text("screenshot_url"),
  assignedTo: varchar("assigned_to"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_website_cr_business").on(table.businessId),
  index("idx_website_cr_user").on(table.userId),
  index("idx_website_cr_status").on(table.status),
]);

export const insertWebsiteChangeRequestSchema = createInsertSchema(websiteChangeRequests).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWebsiteChangeRequest = z.infer<typeof insertWebsiteChangeRequestSchema>;
export type WebsiteChangeRequest = typeof websiteChangeRequests.$inferSelect;

export const voiceChangeRequests = pgTable("voice_change_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  requestedDescription: text("requested_description").notNull(),
  status: text("status").notNull().default('pending'),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => [
  index("idx_vcr_user").on(table.userId),
  index("idx_vcr_status").on(table.status),
]);

export const insertVoiceChangeRequestSchema = createInsertSchema(voiceChangeRequests).omit({ id: true, createdAt: true, resolvedAt: true });
export type InsertVoiceChangeRequest = z.infer<typeof insertVoiceChangeRequestSchema>;
export type VoiceChangeRequest = typeof voiceChangeRequests.$inferSelect;

// Subcontractor Invoices
export const subcontractorInvoices = pgTable("subcontractor_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subcontractorUserId: varchar("subcontractor_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  docType: text("doc_type").notNull().default('invoice'),
  title: text("title"),
  gstEnabled: boolean("gst_enabled").notNull().default(true),
  status: text("status").notNull().default('draft'),
  invoiceNumber: text("invoice_number").notNull(),
  subtotalAmount: decimal("subtotal_amount", { precision: 10, scale: 2 }).notNull().default('0'),
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).notNull().default('0'),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull().default('0'),
  dueDate: timestamp("due_date"),
  validUntil: timestamp("valid_until"),
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  paidAt: timestamp("paid_at"),
  paidMethod: text("paid_method"),
  paidReference: text("paid_reference"),
  paidNotes: text("paid_notes"),
  remittanceSentAt: timestamp("remittance_sent_at"),
  accountingProvider: text("accounting_provider"),
  accountingBillId: text("accounting_bill_id"),
  accountingSyncedAt: timestamp("accounting_synced_at"),
  accountingSyncError: text("accounting_sync_error"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_subinv_subcontractor").on(table.subcontractorUserId),
  index("idx_subinv_business").on(table.businessOwnerId),
  index("idx_subinv_status").on(table.status),
]);

export const insertSubcontractorInvoiceSchema = createInsertSchema(subcontractorInvoices).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubcontractorInvoice = z.infer<typeof insertSubcontractorInvoiceSchema>;
export type SubcontractorInvoice = typeof subcontractorInvoices.$inferSelect;

// Subcontractor Invoice Line Items
export const subcontractorInvoiceItems = pgTable("subcontractor_invoice_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => subcontractorInvoices.id, { onDelete: 'cascade' }),
  description: text("description").notNull(),
  hours: decimal("hours", { precision: 10, scale: 2 }),
  rate: decimal("rate", { precision: 10, scale: 2 }),
  quantity: decimal("quantity", { precision: 10, scale: 2 }),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull().default('0'),
  jobId: varchar("job_id"),
  timeEntryId: varchar("time_entry_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_subinv_item_invoice").on(table.invoiceId),
]);

export const insertSubcontractorInvoiceItemSchema = createInsertSchema(subcontractorInvoiceItems).omit({ id: true, createdAt: true });
export type InsertSubcontractorInvoiceItem = z.infer<typeof insertSubcontractorInvoiceItemSchema>;
export type SubcontractorInvoiceItem = typeof subcontractorInvoiceItems.$inferSelect;

// Worker / Subcontractor payment details — how a worker is paid. Keyed by the
// worker's own user id so it follows them across every business they work for.
export const workerPaymentDetails = pgTable("worker_payment_details", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  bankBsb: text("bank_bsb"),
  bankAccountNumber: text("bank_account_number"),
  bankAccountName: text("bank_account_name"),
  abn: text("abn"),
  payId: text("pay_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_worker_payment_details_user").on(table.userId),
]);

export const insertWorkerPaymentDetailsSchema = createInsertSchema(workerPaymentDetails).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWorkerPaymentDetails = z.infer<typeof insertWorkerPaymentDetailsSchema>;
export type WorkerPaymentDetails = typeof workerPaymentDetails.$inferSelect;

// Payroll pay runs — records a per-worker payment for a pay period so the payroll
// summary can track paid vs outstanding and generate a payslip remittance.
export const payrollPayments = pgTable("payroll_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  workerUserId: varchar("worker_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  teamMemberId: varchar("team_member_id").references(() => teamMembers.id, { onDelete: 'set null' }),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  regularHours: decimal("regular_hours", { precision: 10, scale: 2 }).notNull().default('0'),
  overtimeHours: decimal("overtime_hours", { precision: 10, scale: 2 }).notNull().default('0'),
  totalHours: decimal("total_hours", { precision: 10, scale: 2 }).notNull().default('0'),
  grossPay: decimal("gross_pay", { precision: 10, scale: 2 }).notNull().default('0'),
  travelAllowance: decimal("travel_allowance", { precision: 10, scale: 2 }).notNull().default('0'),
  totalDistanceKm: decimal("total_distance_km", { precision: 10, scale: 2 }).notNull().default('0'),
  travelRatePerKm: decimal("travel_rate_per_km", { precision: 10, scale: 4 }).notNull().default('0'),
  method: text("method").notNull().default('bank_transfer'),
  reference: text("reference"),
  notes: text("notes"),
  paidAt: timestamp("paid_at").notNull().defaultNow(),
  remittanceSentAt: timestamp("remittance_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_payroll_payments_business").on(table.businessOwnerId),
  index("idx_payroll_payments_worker").on(table.workerUserId),
  index("idx_payroll_payments_period").on(table.periodStart, table.periodEnd),
]);

export const insertPayrollPaymentSchema = createInsertSchema(payrollPayments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPayrollPayment = z.infer<typeof insertPayrollPaymentSchema>;
export type PayrollPayment = typeof payrollPayments.$inferSelect;

// Worker State System
export const WORKER_STATES = ['available', 'busy', 'unavailable', 'on_job', 'travelling', 'break', 'delayed', 'needs_help'] as const;
export type WorkerStateValue = typeof WORKER_STATES[number];

export const WORKER_STATE_CONFIG: Record<WorkerStateValue, { label: string; color: string }> = {
  available: { label: 'Available', color: '#22c55e' },
  busy: { label: 'Busy', color: '#f59e0b' },
  unavailable: { label: 'Unavailable', color: '#9ca3af' },
  on_job: { label: 'On Job', color: '#f97316' },
  travelling: { label: 'Travelling', color: '#3b82f6' },
  break: { label: 'Break', color: '#9ca3af' },
  delayed: { label: 'Delayed', color: '#eab308' },
  needs_help: { label: 'Needs Help', color: '#ef4444' },
};

export const workerStates = pgTable("worker_states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  state: text("state").notNull().default('available'),
  jobId: varchar("job_id"),
  note: text("note"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_worker_states_user").on(table.userId),
  index("idx_worker_states_business").on(table.businessOwnerId),
  unique("uq_worker_states_biz_user").on(table.businessOwnerId, table.userId),
]);

export const insertWorkerStateSchema = createInsertSchema(workerStates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWorkerState = z.infer<typeof insertWorkerStateSchema>;
export type WorkerState = typeof workerStates.$inferSelect;

export const PORT_REQUEST_STATUSES = ['submitted', 'processing', 'completed', 'failed'] as const;
export type PortRequestStatus = typeof PORT_REQUEST_STATUSES[number];

export const numberPortRequests = pgTable("number_port_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  phoneNumber: text("phone_number").notNull(),
  currentCarrier: text("current_carrier").notNull(),
  accountNumber: text("account_number").notNull(),
  authorisationAgreed: boolean("authorisation_agreed").notNull().default(false),
  status: text("status").notNull().default('submitted'),
  adminNotes: text("admin_notes"),
  estimatedCompletionDate: timestamp("estimated_completion_date"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_port_requests_user").on(table.userId),
  index("idx_port_requests_status").on(table.status),
]);

export const insertNumberPortRequestSchema = createInsertSchema(numberPortRequests).omit({ id: true, createdAt: true, updatedAt: true, completedAt: true });
export type InsertNumberPortRequest = z.infer<typeof insertNumberPortRequestSchema>;
export type NumberPortRequest = typeof numberPortRequests.$inferSelect;

export type JobPhase = typeof jobPhases.$inferSelect;

export const insertJobPhaseSchema = createInsertSchema(jobPhases).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertJobPhase = z.infer<typeof insertJobPhaseSchema>;
export type JobPhaseAssignment = typeof jobPhaseAssignments.$inferSelect;

// ─── Progress Claims ───────────────────────────────────────────────────────
// A progress claim is a milestone billing document for large construction /
// engineering jobs. Each claim references phases, tracks schedule of values
// (contract amount, cumulative claimed, this claim, retention, balance), and
// can be pushed to Xero as an ACCREC invoice.

export const CLAIM_STATUSES = ['draft', 'submitted', 'approved', 'paid'] as const;
export type ClaimStatus = typeof CLAIM_STATUSES[number];

export const claims = pgTable("claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  claimNumber: text("claim_number").notNull(),          // e.g. PC-001
  status: text("status").notNull().default('draft'),    // draft | submitted | approved | paid
  claimDate: timestamp("claim_date").defaultNow(),
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  // Schedule of values totals (computed and stored for PDF / history)
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull().default('0.00'),
  gstAmount: decimal("gst_amount", { precision: 12, scale: 2 }).notNull().default('0.00'),
  total: decimal("total", { precision: 12, scale: 2 }).notNull().default('0.00'),
  retentionPercent: decimal("retention_percent", { precision: 5, scale: 2 }).default('0.00'),
  retentionAmount: decimal("retention_amount", { precision: 12, scale: 2 }).default('0.00'),
  plannedPercentage: decimal("planned_percentage", { precision: 5, scale: 2 }),
  notes: text("notes"),
  // Attached cost report PDF generated at submission time
  costReportUrl: text("cost_report_url"),
  // Xero sync
  xeroInvoiceId: varchar("xero_invoice_id"),
  xeroSyncedAt: timestamp("xero_synced_at"),
  xeroSyncError: text("xero_sync_error"),
  // Audit trail
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_claims_job_id").on(table.jobId),
  index("idx_claims_user_id").on(table.userId),
  index("idx_claims_status").on(table.status),
]);

export const insertClaimSchema = createInsertSchema(claims).omit({ id: true, createdAt: true, updatedAt: true, submittedAt: true, approvedAt: true, paidAt: true, xeroInvoiceId: true, xeroSyncedAt: true });
export type InsertClaim = z.infer<typeof insertClaimSchema>;
export type Claim = typeof claims.$inferSelect;

// Claim line items — one row per phase (or manual line)
export const claimLineItems = pgTable("claim_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  claimId: varchar("claim_id").notNull().references(() => claims.id, { onDelete: 'cascade' }),
  // job_phases.id is UUID in the live DB (raw ALTER created it as UUID).
  // We store as text to avoid Drizzle type mismatch; FK enforced at DB level.
  phaseId: text("phase_id"),
  // When a line item was seeded from an approved variation, this links back to it.
  // Used by approved-for-claim to exclude already-claimed variations.
  variationId: varchar("variation_id"),
  description: text("description").notNull(),
  contractValue: decimal("contract_value", { precision: 12, scale: 2 }).notNull().default('0.00'),
  previouslyClaimed: decimal("previously_claimed", { precision: 12, scale: 2 }).notNull().default('0.00'),
  thisClaim: decimal("this_claim", { precision: 12, scale: 2 }).notNull().default('0.00'),
  retentionPercent: decimal("retention_percent", { precision: 5, scale: 2 }).default('0.00'),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_claim_line_items_claim_id").on(table.claimId),
]);

export const insertClaimLineItemSchema = createInsertSchema(claimLineItems).omit({ id: true, createdAt: true });

export const claimPurchaseOrders = pgTable("claim_purchase_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  claimId: varchar("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  purchaseOrderId: varchar("purchase_order_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_cpo_claim_id").on(table.claimId),
  unique("uq_cpo_claim_po").on(table.claimId, table.purchaseOrderId),
]);
export type InsertClaimLineItem = z.infer<typeof insertClaimLineItemSchema>;
export type ClaimLineItem = typeof claimLineItems.$inferSelect;

export type PriceListItem = typeof priceListItems.$inferSelect;

export const insertPriceListItemSchema = createInsertSchema(priceListItems).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPriceListItem = z.infer<typeof insertPriceListItemSchema>;

// ── Project Templates ─────────────────────────────────────────────────────────

export const projectTemplates = pgTable("project_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  // templateData stores:
  // {
  //   phases: { phaseCode, name, description, bookedHours }[],
  //   settings: { materialMarkupPct?, equipmentMarkupPct?, subcontractorMarkupPct?, budgetedCost? },
  //   checklistItems: { text, sortOrder }[]  (optional — seeded onto new jobs with isCompleted: false)
  // }
  templateData: jsonb("template_data").notNull().$type<{
    phases: Array<{
      phaseCode: string;
      name: string;
      description?: string;
      bookedHours?: string;
    }>;
    settings?: {
      materialMarkupPct?: string;
      equipmentMarkupPct?: string;
      subcontractorMarkupPct?: string;
      budgetedCost?: string;
      description?: string;
    };
    checklistItems?: Array<{
      text: string;
      sortOrder: number;
    }>;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_project_templates_user_id").on(table.userId),
]);

export type ProjectTemplate = typeof projectTemplates.$inferSelect;

export const insertProjectTemplateSchema = createInsertSchema(projectTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProjectTemplate = z.infer<typeof insertProjectTemplateSchema>;

// ── Project Document Register ─────────────────────────────────────────────────
// Tables must be declared before any createInsertSchema / $inferSelect that evaluates them.

export const PROJECT_DOCUMENT_CATEGORIES = ['Drawings', 'Specifications', 'RFIs', 'SWMS', 'Certificates', 'Other'] as const;
export const PROJECT_RFI_STATUSES = ['open', 'answered', 'closed'] as const;

export const projectDocuments = pgTable("project_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Stable mobile-side identifier used to make initial document upload retries safe.
  clientGeneratedId: varchar("client_generated_id", { length: 100 }),
  // Auto-generated sequential number within the job, e.g. "DOC-001"
  docNumber: varchar("doc_number", { length: 20 }).notNull(),
  title: text("title").notNull(),
  category: text("category").notNull().default('Other'), // ProjectDocumentCategory
  // Points to the most-recent revision label ("A", "B", "1", "2", …)
  currentRevision: varchar("current_revision", { length: 10 }).notNull().default('A'),
  // When true, this document is visible to the client on the job portal
  isClientVisible: boolean("is_client_visible").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_project_documents_job_id").on(table.jobId),
  index("idx_project_documents_user_id").on(table.userId),
  unique("uq_project_documents_job_client_generated_id").on(
    table.jobId,
    table.userId,
    table.clientGeneratedId,
  ),
]);

export const projectDocumentRevisions = pgTable("project_document_revisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => projectDocuments.id, { onDelete: 'cascade' }),
  revision: varchar("revision", { length: 10 }).notNull(), // "A", "B", "1", "2", …
  fileName: text("file_name").notNull(),
  objectStorageKey: text("object_storage_key").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  notes: text("notes"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
}, (table) => [
  index("idx_project_document_revisions_document_id").on(table.documentId),
]);

export const projectRfis = pgTable("project_rfis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Auto-generated sequential number within the job, e.g. "RFI-001"
  rfiNumber: varchar("rfi_number", { length: 20 }).notNull(),
  question: text("question").notNull(),
  description: text("description"),
  assignedTo: varchar("assigned_to"), // user id or free-text contact name
  assignedToName: text("assigned_to_name"),
  status: text("status").notNull().default('open'), // ProjectRfiStatus
  priority: text("priority"), // 'low' | 'medium' | 'high' | 'urgent'
  dueDate: timestamp("due_date"),
  answeredAt: timestamp("answered_at"),
  answerText: text("answer_text"),
  answerFileUrl: text("answer_file_url"),
  answerObjectStorageKey: text("answer_object_storage_key"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_project_rfis_job_id").on(table.jobId),
  index("idx_project_rfis_user_id").on(table.userId),
  index("idx_project_rfis_status").on(table.status),
]);

export const DEFECT_ITEM_STATUSES = ['open', 'in_progress', 'resolved', 'client_approved'] as const;
export const insertProjectDocumentSchema = createInsertSchema(projectDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectDocumentRevisionSchema = createInsertSchema(projectDocumentRevisions).omit({
  id: true,
  uploadedAt: true,
});

export const insertProjectRfiSchema = createInsertSchema(projectRfis).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  answeredAt: true,
});

// Types
export type ProjectDocumentCategory = typeof PROJECT_DOCUMENT_CATEGORIES[number];
export type ProjectRfiStatus = typeof PROJECT_RFI_STATUSES[number];
export type ProjectDocument = typeof projectDocuments.$inferSelect;
export type ProjectDocumentRevision = typeof projectDocumentRevisions.$inferSelect;
export type ProjectRfi = typeof projectRfis.$inferSelect;
export type InsertProjectDocument = z.infer<typeof insertProjectDocumentSchema>;
export type InsertProjectDocumentRevision = z.infer<typeof insertProjectDocumentRevisionSchema>;
export type InsertProjectRfi = z.infer<typeof insertProjectRfiSchema>;

export const WEATHER_CONDITIONS = [
  'sunny', 'partly_cloudy', 'overcast', 'light_rain', 'heavy_rain',
  'windy', 'storm', 'hot', 'cold', 'foggy',
] as const;
export type InsertDefectItem = z.infer<typeof insertDefectItemSchema>;

export const defectItems = pgTable("defect_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  description: text("description").notNull(),
  photoUrl: text("photo_url"),
  photoObjectStorageKey: text("photo_object_storage_key"),
  assignedTo: varchar("assigned_to"),        // team member ID
  assignedToName: text("assigned_to_name"),  // snapshot for display
  dueDate: date("due_date"),
  status: text("status").notNull().default('open'), // open | in_progress | resolved | client_approved
  notes: text("notes"),
  resolvedAt: timestamp("resolved_at"),
  clientApprovedAt: timestamp("client_approved_at"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_defect_items_job_id").on(table.jobId),
  index("idx_defect_items_user_id").on(table.userId),
  index("idx_defect_items_status").on(table.status),
]);

export type DefectItem = typeof defectItems.$inferSelect;

export type DefectItemStatus = typeof DEFECT_ITEM_STATUSES[number];

export const insertDefectItemSchema = createInsertSchema(defectItems).omit({
  id: true, createdAt: true, updatedAt: true,
  resolvedAt: true, clientApprovedAt: true,
});

export const siteDiaryEntries = pgTable("site_diary_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  // userId is the actual author (req.userId), NOT the business owner effectiveUserId.
  // Business-level access is scoped separately via jobId → jobs.userId.
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Calendar date of the diary entry (stored as date, not timestamp)
  entryDate: date("entry_date").notNull(),
  weather: text("weather"), // WeatherCondition or null
  // Worker names (snapshot at time of entry; not FK so subcontractors can be listed freely)
  workersOnSite: jsonb("workers_on_site").$type<string[]>().default([]),
  workDone: text("work_done"),
  issuesDelays: text("issues_delays"),
  // Object-storage keys for attached photos (bucket/path format, same as jobPhotos)
  photoKeys: jsonb("photo_keys").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_site_diary_job_id").on(table.jobId),
  index("idx_site_diary_user_id").on(table.userId),
  index("idx_site_diary_entry_date").on(table.entryDate),
  unique("uq_site_diary_job_date").on(table.jobId, table.entryDate),
]);

export type WeatherCondition = typeof WEATHER_CONDITIONS[number];

export type InsertSiteDiaryEntry = z.infer<typeof insertSiteDiaryEntrySchema>;

export const insertSiteDiaryEntrySchema = createInsertSchema(siteDiaryEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SiteDiaryEntry = typeof siteDiaryEntries.$inferSelect;

export const taskMaterials = pgTable("task_materials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  jobMaterialId: varchar("job_material_id").notNull().references(() => jobMaterials.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("uq_task_materials").on(table.taskId, table.jobMaterialId),
  index("idx_task_materials_task_id").on(table.taskId),
]);

// Vapi webhook deduplication.
// dedupKey is a SHA-256 hex digest of the raw request body.
// Vapi always retries with a byte-identical payload, so true duplicates hash
// identically. Distinct events (different status value, different tool call IDs)
// produce different bodies and therefore different hashes — all pass through.
export const vapiEvents = pgTable("vapi_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callId: text("call_id"),      // audit: extracted from payload
  eventType: text("event_type"), // audit: extracted from payload
  dedupKey: text("dedup_key").notNull(),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
}, (table) => [
  unique("uq_vapi_events_dedup").on(table.dedupKey),
  index("idx_vapi_events_call_id").on(table.callId),
]);

export type VapiEvent = typeof vapiEvents.$inferSelect;
export type InsertVapiEvent = typeof vapiEvents.$inferInsert;
