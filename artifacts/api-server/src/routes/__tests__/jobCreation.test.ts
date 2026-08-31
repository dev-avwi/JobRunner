/**
 * Tests for POST /api/jobs — service-job vs. project-job field validation.
 *
 * Regression tests for the class of bug where a project-only field (e.g.
 * retentionPercent) uses a refine predicate that rejects `undefined`, silently
 * blocking service-call job creation until an end-to-end smoke test catches it.
 *
 * Three cases are covered:
 *   1. Minimal service-call payload (no retentionPercent) → 201
 *   2. Project payload with retentionPercent: "5" → 201
 *   3. Project payload with retentionPercent: "150" → 400 (out of range)
 *
 * Path note: this test lives in src/routes/__tests__/.
 *   - jobs.ts (src/routes/) uses "../xxx"  → resolves to src/xxx
 *   - From __tests__/, "../../xxx" resolves to src/xxx
 *   - All vi.mock() paths are written relative to THIS test file.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getIdempotencyRecord, setIdempotencyRecord } from "../helpers";

// ── Storage mock ─────────────────────────────────────────────────────────────
const CLIENT_ID = "client-abc";

const FAKE_CLIENT = {
  id: CLIENT_ID,
  name: "Acme Corp",
  phone: null,
  email: null,
  userId: "owner-1",
};

const FAKE_SERVICE_JOB = {
  id: "job-svc-1",
  title: "Tap repair",
  jobType: "service",
  status: "pending",
  userId: "owner-1",
  clientId: CLIENT_ID,
  scheduledAt: null,
  retentionPercent: null,
  createdAt: new Date().toISOString(),
};

const FAKE_PROJECT_JOB = {
  id: "job-proj-1",
  title: "Kitchen renovation",
  jobType: "project",
  status: "pending",
  userId: "owner-1",
  clientId: CLIENT_ID,
  scheduledAt: null,
  retentionPercent: "5.00",
  createdAt: new Date().toISOString(),
};

const mockStorage = vi.hoisted(() => ({
  createJob: vi.fn(),
  getClient: vi.fn().mockResolvedValue(null),
  getUser: vi.fn().mockResolvedValue(null),
  getBusinessSettings: vi.fn().mockResolvedValue(null),
  getAssignedJobIdsForUser: vi.fn().mockResolvedValue([]),
  generateJobNumber: vi.fn().mockResolvedValue("JOB-001"),
  updateJob: vi.fn().mockResolvedValue(undefined),
  updateQuote: vi.fn().mockResolvedValue(undefined),
  // Required by findWorkerBookingConflict
  getJobs: vi.fn().mockResolvedValue([]),
}));

// ── db mock (from "../storage") ───────────────────────────────────────────────
//
// findDurableProjectReplay returns null immediately when clientGeneratedId is
// absent, so the outer db object only needs .transaction() for the project path.
// The transaction callback receives a mock tx that returns the fake project job
// from its INSERT.

const mockTx = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  select: vi.fn(),
  execute: vi.fn().mockResolvedValue(undefined),
}));

const mockDb = vi.hoisted(() => ({
  transaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
    // Wire the minimal Drizzle chain needed by the project insert path.
    // Only tx.insert(jobs).values(...).returning() is called when there is
    // no initialProjectSetup and no idempotency key.
    const mockReturning = vi.fn().mockResolvedValue([FAKE_PROJECT_JOB]);
    const mockValues = vi.fn(() => ({ returning: mockReturning, onConflictDoNothing: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })) }));
    mockTx.insert.mockReturnValue({ values: mockValues });
    // select is called by findDurableProjectReplay(tx) only when clientGeneratedId
    // is set. We do not send one, so this branch never executes.
    mockTx.select.mockReturnValue({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })),
    });
    mockTx.update.mockReturnValue({
      set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
    });
    mockTx.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    });
    return cb(mockTx);
  }),
  // Outer-scope findDurableProjectReplay uses db.select when clientGeneratedId
  // is provided. We never send one, so this stub is never invoked.
  select: vi.fn(() => ({
    from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })),
  })),
}));

vi.mock("../../storage", () => ({
  storage: mockStorage,
  db: mockDb,
}));

// ── Permissions ───────────────────────────────────────────────────────────────
const mockGetUserContext = vi.hoisted(() => vi.fn());

vi.mock("../../permissions", () => ({
  getUserContext: (...args: any[]) => mockGetUserContext(...args),
  createPermissionMiddleware: () => (_req: any, _res: any, next: any) => next(),
  PERMISSIONS: { READ_JOBS: "read_jobs", WRITE_JOBS: "write_jobs" },
  ownerOnly: () => (_req: any, _res: any, next: any) => next(),
  ownerOrManagerOnly: () => (_req: any, _res: any, next: any) => next(),
  requirePermission: () => () => (_req: any, _res: any, next: any) => next(),
  hasPermission: vi.fn().mockReturnValue(true),
  canAssignJobTo: vi.fn().mockResolvedValue({ allowed: true }),
  getWorkerPermissionContext: vi.fn().mockResolvedValue({}),
  sanitizeClientData: vi.fn((d: any) => d),
  requireTeamPlan: () => (_req: any, _res: any, next: any) => next(),
  ownerHasTeamCapability: vi.fn().mockResolvedValue(true),
  checkTeamSeatLimit: vi.fn().mockResolvedValue({ ok: true }),
  canAccessJobMedia: vi.fn().mockResolvedValue(true),
  requireJobMediaAccess: () => (_req: any, _res: any, next: any) => next(),
}));

// ── Auth middleware ───────────────────────────────────────────────────────────
const OWNER_USER_ID = "owner-1";

vi.mock("../middleware", () => {
  const pt = (_: any, __: any, next: any) => next();
  const ft = () => pt;
  return {
    requireAuth: (req: any, _res: any, next: any) => {
      req.userId = OWNER_USER_ID;
      next();
    },
    requireProSubscription: ft,
    requirePaidTier: ft,
    requirePaidTierForSms: ft,
    requireDevelopment: pt,
    authRateLimiter: pt,
    passwordResetLimiter: pt,
    paymentRateLimiter: pt,
    messageSendLimiter: pt,
    generalApiLimiter: pt,
    setupOnboardingGuard: pt,
    pdfPerUserLimiter: pt,
    aiPerUserLimiter: pt,
    visionPerUserLimiter: pt,
    photoUploadPerUserLimiter: pt,
    transcribePerUserLimiter: pt,
    backpressureErrorHandler: pt,
  };
});

// ── Route helpers ─────────────────────────────────────────────────────────────
vi.mock("../helpers", () => ({
  dbCheckEnRouteNotif: vi.fn(),
  chatRateLimiterMiddleware: (_: any, __: any, next: any) => next(),
  portalIpRateLimiterMiddleware: (_: any, __: any, next: any) => next(),
  getIdempotencyRecord: vi.fn().mockResolvedValue(null),
  setIdempotencyRecord: vi.fn().mockResolvedValue(undefined),
  logActivity: vi.fn().mockResolvedValue(undefined),
  formatRelativeTime: vi.fn().mockReturnValue(""),
  normalizeAuPhone: vi.fn((v: string) => v),
  resolveAssigneeUserId: vi.fn().mockResolvedValue(null),
  autoUpdateWorkerState: vi.fn().mockResolvedValue(undefined),
  gatherAIContext: vi.fn().mockResolvedValue({}),
  verifyInvoiceCalculation: vi.fn().mockReturnValue({ ok: true }),
  validateAustralianCoords: vi.fn().mockReturnValue(true),
  wasRecentlyNotifiedTeamJoinBlocked: vi.fn().mockReturnValue(false),
  emailPaymentLinkCooldown: vi.fn().mockReturnValue(false),
  EMAIL_PAYMENT_LINK_COOLDOWN_MS: 0,
}));

// ── Retention summary ─────────────────────────────────────────────────────────
vi.mock("../retentionSummary", () => ({
  computeRetentionSummary: vi.fn().mockResolvedValue({}),
}));

// ── FreemiumService ───────────────────────────────────────────────────────────
const mockCanUserCreateJob = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ canCreate: true, usageInfo: { jobCount: 0 } })
);
const mockIncrementJobCount = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("../../freemiumService", () => ({
  FreemiumService: {
    canUserCreateJob: (...args: any[]) => mockCanUserCreateJob(...args),
    incrementJobCount: (...args: any[]) => mockIncrementJobCount(...args),
  },
}));

// ── Cache (dynamic import inside the project creation path) ───────────────────
vi.mock("../../cache", () => ({
  invalidateAggregateDashboard: vi.fn(),
}));

// ── Google Calendar (dynamic import, non-fatal) ───────────────────────────────
vi.mock("../../googleCalendarClient", () => ({
  isGoogleCalendarConnected: vi.fn().mockResolvedValue(false),
  syncJobToCalendar: vi.fn().mockResolvedValue({ eventId: null }),
}));

// ── Heavy stubs (same set as todayJobs.test.ts) ───────────────────────────────
vi.mock("@sentry/node", () => ({
  default: {},
  captureException: vi.fn(),
  withScope: vi.fn(),
  init: vi.fn(),
  setupExpressErrorHandler: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock("multer", () => {
  const middleware = (_: any, __: any, next: any) => next();
  const m: any = vi.fn().mockReturnValue({
    single: vi.fn().mockReturnValue(middleware),
    array: vi.fn().mockReturnValue(middleware),
    fields: vi.fn().mockReturnValue(middleware),
  });
  m.memoryStorage = vi.fn().mockReturnValue({});
  m.diskStorage = vi.fn().mockReturnValue({});
  return { default: m };
});

vi.mock("express-rate-limit", () => ({
  default: vi.fn().mockReturnValue((_: any, __: any, next: any) => next()),
  rateLimit: vi.fn().mockReturnValue((_: any, __: any, next: any) => next()),
}));

vi.mock("jsonwebtoken", () => ({
  default: { sign: vi.fn().mockReturnValue("tok"), verify: vi.fn(), decode: vi.fn() },
  sign: vi.fn().mockReturnValue("tok"),
  verify: vi.fn(),
  decode: vi.fn(),
}));

vi.mock("../../auth",                    () => ({ AuthService: class { authenticate = vi.fn(); } }));
vi.mock("../../googleAuth",              () => ({ setupGoogleAuth: vi.fn() }));
vi.mock("../../xeroAuth",                () => ({ setupXeroAuth: vi.fn() }));
vi.mock("../../concurrency",             () => ({ isBackpressure: vi.fn().mockReturnValue(false), send429: vi.fn(), aiQueue: { add: vi.fn().mockResolvedValue(null) } }));
vi.mock("../../emailService",            () => ({ sendEmailVerificationEmail: vi.fn(), sendLoginCodeEmail: vi.fn(), sendJobConfirmationEmail: vi.fn(), sendPasswordResetEmail: vi.fn(), sendTeamInviteEmail: vi.fn(), sendJobAssignmentEmail: vi.fn(), sendJobCompletionNotificationEmail: vi.fn(), sendWelcomeEmail: vi.fn() }));
vi.mock("../../demoData",                () => ({ DEMO_USER: null, VISITOR_USER: null }));
vi.mock("../../activityService",         () => ({ logTeamActivity: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../logger",                  () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../../objectStorage",           () => ({ ObjectStorageService: class {}, ObjectNotFoundError: class extends Error {}, objectStorageClient: {}, parseObjectPath: vi.fn() }));
vi.mock("../../tradieTemplates",         () => ({ tradieQuoteTemplates: [], tradieLineItems: [], tradieRateCards: [] }));
vi.mock("../../safetyTemplates",         () => ({ getSafetyFormTemplates: vi.fn().mockResolvedValue([]), getSafetyFormTemplate: vi.fn().mockResolvedValue(null) }));
vi.mock("../../taskRules",               () => ({ evaluateTaskRules: vi.fn().mockResolvedValue([]) }));
vi.mock("../../ai",                      () => ({ generateAISuggestions: vi.fn(), chatWithAI: vi.fn(), analyzeReceipt: vi.fn(), detectHazards: vi.fn() }));
vi.mock("../../notifications",           () => ({ notifyQuoteSent: vi.fn(), notifyInvoiceSent: vi.fn(), notifyInvoicePaid: vi.fn(), notifyJobScheduled: vi.fn(), notifyJobStarted: vi.fn(), notifyJobCompleted: vi.fn(), notifyJobAssigned: vi.fn(), notifyTeamMemberInvited: vi.fn(), notifySmsReceived: vi.fn(), notifyTimesheetSubmitted: vi.fn(), notifyChatMessage: vi.fn(), notifyQuoteAccepted: vi.fn(), notifyQuoteRejected: vi.fn(), notifyGeofenceCheckIn: vi.fn(), notifyGeofenceCheckOut: vi.fn(), notifyRecurringJobCreated: vi.fn(), notifyRecurringInvoiceCreated: vi.fn(), notifyInvoiceOverdue: vi.fn(), notifyQuoteExpiring: vi.fn(), notifyPaymentFailed: vi.fn() }));
vi.mock("../../pushNotifications",       () => ({ notifyJobAssigned: vi.fn(), notifyJobUpdate: vi.fn(), notifyPaymentReceived: vi.fn(), notifyQuoteAccepted: vi.fn(), notifyQuoteRejected: vi.fn(), notifyTeamMessage: vi.fn(), notifyInvoiceOverdue: vi.fn(), notifySmsReceived: vi.fn(), notifyGeofenceEvent: vi.fn(), notifyTimesheetSubmitted: vi.fn(), notifyQuoteExpiring: vi.fn(), notifyPaymentFailed: vi.fn(), notifyTrialExpiring: vi.fn(), notifyTimesheetDisputeFiled: vi.fn(), notifyTimesheetDisputeResolved: vi.fn(), notifyJobNudge: vi.fn(), notifyNudgeResponse: vi.fn() }));
vi.mock("../../emailIntegrationService", () => ({ getEmailIntegration: vi.fn().mockResolvedValue(null), getGmailConnectionStatus: vi.fn().mockResolvedValue(null) }));
vi.mock("../../stripeClient",            () => ({ getUncachableStripeClient: vi.fn(), getStripePublishableKey: vi.fn().mockReturnValue(null), isStripeInitialized: vi.fn().mockReturnValue(false) }));
vi.mock("../../twilioClient",            () => ({ checkTwilioAvailability: vi.fn().mockResolvedValue(false), sendSMS: vi.fn(), validateTwilioWebhook: vi.fn().mockReturnValue(true) }));
vi.mock("../../geocoding",               () => ({ geocodeAddress: vi.fn().mockResolvedValue(null), haversineDistance: vi.fn().mockReturnValue(0), calculateRouteETA: vi.fn().mockResolvedValue(null) }));
vi.mock("../../automationService",       () => ({ processStatusChangeAutomation: vi.fn().mockResolvedValue(undefined), processPaymentReceivedAutomation: vi.fn().mockResolvedValue(undefined), processTimeBasedAutomations: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../xeroService",             () => ({}));
vi.mock("../../myobService",             () => ({}));
vi.mock("../../quickbooksService",       () => ({}));
vi.mock("../../urlHelper",               () => ({ getProductionBaseUrl: vi.fn().mockReturnValue("http://localhost"), getQuotePublicUrl: vi.fn().mockReturnValue(""), getInvoicePublicUrl: vi.fn().mockReturnValue(""), getReceiptPublicUrl: vi.fn().mockReturnValue("") }));
vi.mock("../../emailTemplates",          () => ({ generateQuoteEmailTemplate: vi.fn().mockReturnValue(""), generateInvoiceEmailTemplate: vi.fn().mockReturnValue("") }));
vi.mock("../../notificationService",     () => ({ notifyOwnerViaSms: vi.fn().mockResolvedValue(undefined), notifyOwnerViaEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../systemEventService",      () => ({ logSystemEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../phaseExpenseAttribution", () => ({ allocateExpensesByPhase: vi.fn().mockResolvedValue([]) }));

// @workspace/db: keep real schemas (insertJobSchema must run for validation tests)
// but stub table objects so Drizzle never tries to touch a live DB.
vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  const tableStub = { name: "stub" };
  // Overlay every key: real schemas keep their implementations; everything else
  // gets a lightweight table stub so Drizzle query builders don't throw.
  const overrides: Record<string, unknown> = {};
  for (const key of Object.keys(actual)) {
    const isSchemaExport =
      key.startsWith("insert") ||
      key.startsWith("update") ||
      key.startsWith("select") ||
      key === "loginSchema" ||
      key === "requestLoginCodeSchema" ||
      key === "verifyLoginCodeSchema";
    if (!isSchemaExport) {
      overrides[key] = tableStub;
    }
  }
  return { ...actual, ...overrides };
});

// drizzle-orm: lightweight stubs
vi.mock("drizzle-orm", () => {
  const noop = vi.fn();
  return {
    eq: noop, sql: noop, desc: noop, asc: noop, and: noop,
    gte: noop, lte: noop, lt: noop, isNotNull: noop, isNull: noop,
    inArray: noop, or: noop, count: noop, sum: noop, ne: noop,
    aliasedTable: noop, not: noop, between: noop,
  };
});

// ── Import the route under test ───────────────────────────────────────────────
import express from "express";
import request from "supertest";
import { registerJobsRoutes } from "../jobs";

// ── Helpers ───────────────────────────────────────────────────────────────────

const OWNER_CONTEXT = {
  userId: OWNER_USER_ID,
  effectiveUserId: OWNER_USER_ID,
  isOwner: true,
  permissions: ["write_jobs"],
  teamMemberId: null,
};

function buildApp() {
  const app = express();
  app.use(express.json());
  const noopMiddleware = (_: any, __: any, next: any) => next();
  const noopMulter = {
    single: vi.fn(() => noopMiddleware),
    array: vi.fn(() => noopMiddleware),
    fields: vi.fn(() => noopMiddleware),
  };
  registerJobsRoutes(app, {
    trackingTokens: new Map(),
    buildProofPackData: vi.fn().mockResolvedValue({}),
    sitePhotoCache: new Map(),
    upload: noopMulter as any,
    getJobWithChatAccess: vi.fn().mockResolvedValue(null),
    chatUpload: noopMulter as any,
  });
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/jobs — retentionPercent validation", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Restore mocks that vi.clearAllMocks() strips implementations from.
    mockGetUserContext.mockResolvedValue(OWNER_CONTEXT);
    mockCanUserCreateJob.mockResolvedValue({ canCreate: true, usageInfo: { jobCount: 0 } });
    mockIncrementJobCount.mockResolvedValue(undefined);

    // Storage stubs that the project creation path calls.
    mockStorage.getBusinessSettings.mockResolvedValue(null);
    mockStorage.generateJobNumber.mockResolvedValue("JOB-001");
    // Return a valid client so the cross-business guard passes and activity logging resolves.
    mockStorage.getClient.mockResolvedValue(FAKE_CLIENT);
    mockStorage.updateJob.mockResolvedValue(undefined);

    // Restore db.transaction so the project path can complete.
    mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
      const mockReturning = vi.fn().mockResolvedValue([FAKE_PROJECT_JOB]);
      const mockOnConflict = vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) }));
      const mockValues = vi.fn(() => ({ returning: mockReturning, onConflictDoNothing: mockOnConflict }));
      mockTx.insert.mockReturnValue({ values: mockValues });
      mockTx.select.mockReturnValue({
        from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })),
      });
      mockTx.update.mockReturnValue({
        set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
      });
      mockTx.delete.mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
      mockTx.execute.mockResolvedValue(undefined);
      return cb(mockTx);
    });

    // Restore outer-level db.select (used only when clientGeneratedId is set).
    mockDb.select.mockReturnValue({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })),
    });

    app = buildApp();
  });

  // ── Service call: no retentionPercent ─────────────────────────────────────

  it("accepts a minimal service-call payload with no retentionPercent and returns 201", async () => {
    mockStorage.createJob.mockResolvedValue(FAKE_SERVICE_JOB);

    const res = await request(app)
      .post("/api/jobs")
      .set("x-user-id", OWNER_USER_ID)
      .send({
        title: "Tap repair",
        jobType: "service",
        status: "pending",
        clientId: CLIENT_ID,
        // retentionPercent intentionally omitted — this is valid for service jobs
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: FAKE_SERVICE_JOB.id, jobType: "service" });
  });

  it("accepts a service-call payload with retentionPercent explicitly null and returns 201", async () => {
    mockStorage.createJob.mockResolvedValue(FAKE_SERVICE_JOB);

    const res = await request(app)
      .post("/api/jobs")
      .set("x-user-id", OWNER_USER_ID)
      .send({
        title: "Pipe flush",
        jobType: "service",
        status: "pending",
        clientId: CLIENT_ID,
        retentionPercent: null,
      });

    expect(res.status).toBe(201);
  });

  // ── Project job: valid retentionPercent ───────────────────────────────────

  it("accepts a project payload with retentionPercent '5' and returns 201", async () => {
    // The project path goes through db.transaction; mockDb.transaction calls
    // the callback with a mock tx that returns FAKE_PROJECT_JOB from its INSERT.
    const res = await request(app)
      .post("/api/jobs")
      .set("x-user-id", OWNER_USER_ID)
      .send({
        title: "Kitchen renovation",
        jobType: "project",
        status: "pending",
        clientId: CLIENT_ID,
        retentionPercent: "5",
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: FAKE_PROJECT_JOB.id, jobType: "project" });
  });

  it("accepts a project payload with retentionPercent 0 (no retention) and returns 201", async () => {
    const res = await request(app)
      .post("/api/jobs")
      .set("x-user-id", OWNER_USER_ID)
      .send({
        title: "Garden landscaping",
        jobType: "project",
        status: "pending",
        clientId: CLIENT_ID,
        retentionPercent: "0",
      });

    expect(res.status).toBe(201);
  });

  // ── Out-of-range retentionPercent → 400 ──────────────────────────────────

  it("rejects retentionPercent '150' with 400 before touching the database", async () => {
    const res = await request(app)
      .post("/api/jobs")
      .set("x-user-id", OWNER_USER_ID)
      .send({
        title: "Big project",
        jobType: "project",
        status: "pending",
        clientId: CLIENT_ID,
        retentionPercent: "150",
      });

    expect(res.status).toBe(400);
    // No DB interaction should have occurred — schema validation is the gate
    expect(mockStorage.createJob).not.toHaveBeenCalled();
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it("includes a descriptive error message for an out-of-range retentionPercent", async () => {
    const res = await request(app)
      .post("/api/jobs")
      .set("x-user-id", OWNER_USER_ID)
      .send({
        title: "Big project",
        jobType: "project",
        status: "pending",
        clientId: CLIENT_ID,
        retentionPercent: "150",
      });

    expect(res.status).toBe(400);
    // The refine message from insertJobSchema lives in details[].message;
    // the top-level error is the generic "Invalid input" envelope.
    const body = res.body as { error?: string; details?: Array<{ message: string }> };
    const allMessages = [
      body.error ?? "",
      ...(body.details?.map((d) => d.message) ?? []),
    ].join(" ");
    expect(allMessages).toMatch(/retention/i);
  });

  it("rejects a negative retentionPercent with 400", async () => {
    const res = await request(app)
      .post("/api/jobs")
      .set("x-user-id", OWNER_USER_ID)
      .send({
        title: "Bad project",
        jobType: "project",
        status: "pending",
        clientId: CLIENT_ID,
        retentionPercent: "-1",
      });

    expect(res.status).toBe(400);
    expect(mockStorage.createJob).not.toHaveBeenCalled();
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });
});

// ── Booking-conflict guard ────────────────────────────────────────────────────

describe("POST /api/jobs — worker double-booking guard", () => {
  const WORKER_A = "worker-user-a";
  const WORKER_B = "worker-user-b";

  // A job already in the system for WORKER_A starting at a fixed time.
  const BASE_TIME = new Date("2026-09-01T09:00:00.000Z");

  const EXISTING_JOB_WORKER_A = {
    id: "job-existing-1",
    title: "Existing plumbing job",
    jobType: "service",
    status: "pending",
    userId: OWNER_USER_ID,
    clientId: CLIENT_ID,
    assignedTo: WORKER_A,
    scheduledAt: BASE_TIME.toISOString(),
    estimatedDuration: 60,
    retentionPercent: null,
    createdAt: new Date().toISOString(),
  };

  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Restore mocks that vi.clearAllMocks() strips implementations from.
    mockGetUserContext.mockResolvedValue(OWNER_CONTEXT);
    mockCanUserCreateJob.mockResolvedValue({ canCreate: true, usageInfo: { jobCount: 0 } });
    mockIncrementJobCount.mockResolvedValue(undefined);

    // Storage stubs.
    mockStorage.getBusinessSettings.mockResolvedValue(null);
    mockStorage.generateJobNumber.mockResolvedValue("JOB-001");
    mockStorage.getClient.mockResolvedValue(FAKE_CLIENT);
    mockStorage.updateJob.mockResolvedValue(undefined);

    // By default, no existing jobs.
    mockStorage.getJobs.mockResolvedValue([]);

    // Service job creation returns a valid job.
    mockStorage.createJob.mockResolvedValue({
      ...FAKE_SERVICE_JOB,
      assignedTo: WORKER_A,
      scheduledAt: BASE_TIME.toISOString(),
    });

    // Restore db stubs.
    mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
      const mockReturning = vi.fn().mockResolvedValue([FAKE_PROJECT_JOB]);
      const mockOnConflict = vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) }));
      const mockValues = vi.fn(() => ({ returning: mockReturning, onConflictDoNothing: mockOnConflict }));
      mockTx.insert.mockReturnValue({ values: mockValues });
      mockTx.select.mockReturnValue({
        from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })),
      });
      mockTx.update.mockReturnValue({
        set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
      });
      mockTx.delete.mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
      mockTx.execute.mockResolvedValue(undefined);
      return cb(mockTx);
    });
    mockDb.select.mockReturnValue({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })),
    });

    app = buildApp();
  });

  it("returns 409 BOOKING_CONFLICT when a second overlapping job is posted for the same worker", async () => {
    // Simulate an existing job for WORKER_A that will overlap the new request.
    mockStorage.getJobs.mockResolvedValue([EXISTING_JOB_WORKER_A]);

    // Post a new job for the same worker, 30 minutes into the existing booking
    // (BASE_TIME + 30 min), so the windows definitely overlap.
    const overlappingTime = new Date(BASE_TIME.getTime() + 30 * 60 * 1000).toISOString();

    const res = await request(app)
      .post("/api/jobs")
      .set("x-user-id", OWNER_USER_ID)
      .send({
        title: "Second plumbing job",
        jobType: "service",
        status: "pending",
        clientId: CLIENT_ID,
        assignedTo: WORKER_A,
        scheduledAt: overlappingTime,
        estimatedDuration: 60,
      });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: "BOOKING_CONFLICT",
      conflictingJobId: EXISTING_JOB_WORKER_A.id,
    });
    // Creation must not proceed after the conflict is detected.
    expect(mockStorage.createJob).not.toHaveBeenCalled();
  });

  it("returns 201 when two different workers are booked at the same time", async () => {
    // WORKER_A already has a job at BASE_TIME.
    mockStorage.getJobs.mockResolvedValue([EXISTING_JOB_WORKER_A]);

    // WORKER_B is posted for exactly the same time slot — no conflict.
    mockStorage.createJob.mockResolvedValue({
      ...FAKE_SERVICE_JOB,
      id: "job-worker-b-1",
      assignedTo: WORKER_B,
      scheduledAt: BASE_TIME.toISOString(),
    });

    const res = await request(app)
      .post("/api/jobs")
      .set("x-user-id", OWNER_USER_ID)
      .send({
        title: "Worker B job",
        jobType: "service",
        status: "pending",
        clientId: CLIENT_ID,
        assignedTo: WORKER_B,
        scheduledAt: BASE_TIME.toISOString(),
        estimatedDuration: 60,
      });

    expect(res.status).toBe(201);
    expect(mockStorage.createJob).toHaveBeenCalledOnce();
  });
});

// ── Idempotency replay tests ──────────────────────────────────────────────────

describe("POST /api/jobs — clientGeneratedId idempotency replay", () => {
  let app: ReturnType<typeof buildApp>;

  const PROJECT_PAYLOAD = {
    title: "Kitchen renovation",
    jobType: "project",
    status: "pending",
    clientId: CLIENT_ID,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetUserContext.mockResolvedValue(OWNER_CONTEXT);
    mockCanUserCreateJob.mockResolvedValue({ canCreate: true, usageInfo: { jobCount: 0 } });
    mockIncrementJobCount.mockResolvedValue(undefined);
    mockStorage.getBusinessSettings.mockResolvedValue(null);
    mockStorage.generateJobNumber.mockResolvedValue("JOB-001");
    mockStorage.getClient.mockResolvedValue(FAKE_CLIENT);
    mockStorage.updateJob.mockResolvedValue(undefined);
    mockStorage.getJobs.mockResolvedValue([]);

    // db.transaction: project job creation path.
    // When clientGeneratedId is set the handler makes TWO tx.insert calls inside
    // the same transaction:
    //   1. tx.insert(idempotencyKeys).values(...).onConflictDoNothing().returning()
    //      → must return [{key}] to signal a successful reservation
    //   2. tx.insert(jobs).values(...).returning()
    //      → returns the created job row
    // mockReturnValueOnce chains them in order.
    mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
      // findDurableProjectReplay inside transaction uses tx.select
      mockTx.select.mockReturnValue({
        from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })),
      });

      // First insert: idempotency key reservation
      mockTx.insert
        .mockReturnValueOnce({
          values: vi.fn(() => ({
            onConflictDoNothing: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([{ key: "stub-idem-key" }]),
            })),
          })),
        })
        // Second insert: jobs row
        .mockReturnValueOnce({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([FAKE_PROJECT_JOB]),
            onConflictDoNothing: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
          })),
        });

      // tx.update: called at the end to write the final response into idempotencyKeys
      mockTx.update.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) });
      mockTx.delete.mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
      mockTx.execute.mockResolvedValue(undefined);
      return cb(mockTx);
    });

    // Outer-level db.select: used by findDurableProjectReplay before the transaction.
    // Default: no existing job found (returns empty array).
    mockDb.select.mockReturnValue({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })),
    });

    // Default helpers: cache miss on reads, no-op on writes.
    vi.mocked(getIdempotencyRecord).mockResolvedValue(null);
    vi.mocked(setIdempotencyRecord).mockResolvedValue(undefined);

    app = buildApp();
  });

  it("returns 201 with the original job body when the same clientGeneratedId is sent a second time", async () => {
    // Simulate the in-memory idempotency cache: capture what setIdempotencyRecord
    // stores on the first POST and return it from getIdempotencyRecord on the second.
    let storedRecord: any = null;
    vi.mocked(getIdempotencyRecord)
      .mockResolvedValueOnce(null)                         // first POST: cache miss
      .mockImplementation(async () => storedRecord);       // second POST: cache hit
    vi.mocked(setIdempotencyRecord).mockImplementation(async (_key, record) => {
      storedRecord = record;
    });

    const res1 = await request(app)
      .post("/api/jobs")
      .set("x-user-id", OWNER_USER_ID)
      .send({ ...PROJECT_PAYLOAD, clientGeneratedId: "idem-replay-001" });

    expect(res1.status).toBe(201);

    const res2 = await request(app)
      .post("/api/jobs")
      .set("x-user-id", OWNER_USER_ID)
      .send({ ...PROJECT_PAYLOAD, clientGeneratedId: "idem-replay-001" });

    expect(res2.status).toBe(201);
    expect(res2.body.id).toBe(res1.body.id);
  });

  it("only calls db.transaction once when the same clientGeneratedId is sent twice", async () => {
    // Wire the idempotency cache so the second POST hits the cache and never
    // reaches the transaction.
    let storedRecord: any = null;
    vi.mocked(getIdempotencyRecord)
      .mockResolvedValueOnce(null)
      .mockImplementation(async () => storedRecord);
    vi.mocked(setIdempotencyRecord).mockImplementation(async (_key, record) => {
      storedRecord = record;
    });

    await request(app)
      .post("/api/jobs")
      .set("x-user-id", OWNER_USER_ID)
      .send({ ...PROJECT_PAYLOAD, clientGeneratedId: "idem-replay-002" });

    await request(app)
      .post("/api/jobs")
      .set("x-user-id", OWNER_USER_ID)
      .send({ ...PROJECT_PAYLOAD, clientGeneratedId: "idem-replay-002" });

    // The DB transaction must run exactly once — the replay must not re-enter it.
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });
});
