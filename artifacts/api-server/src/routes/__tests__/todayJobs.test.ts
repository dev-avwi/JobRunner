/**
 * Tests for GET /api/jobs/today — Today section visibility.
 *
 * The Today section in the worker mobile app renders when todaysJobs.length > 0.
 * This module confirms the endpoint correctly:
 *   1. Returns active jobs scheduled for today  → section is visible
 *   2. Returns an empty array when no jobs are scheduled today → section is hidden
 *   3. Excludes done/invoiced jobs → completing the last job removes the section
 *
 * Path note: this test lives in src/routes/__tests__/.
 *   - jobs.ts (src/routes/) uses "../xxx"  → resolves to src/xxx
 *   - jobs.ts (src/routes/) uses "./xxx"   → resolves to src/routes/xxx
 *   - From __tests__/, "../xxx" resolves to src/routes/xxx
 *   - From __tests__/, "../../xxx" resolves to src/xxx
 * All vi.mock() paths are written relative to THIS test file.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Storage mock (src/storage → "../../storage" from __tests__) ──────────────
const mockStorage = vi.hoisted(() => ({
  getJobs: vi.fn(),
  getClients: vi.fn(),
  getAssignedJobIdsForUser: vi.fn().mockResolvedValue([]),
  getBusinessSettings: vi.fn().mockResolvedValue(null),
  getUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../storage", () => ({
  storage: mockStorage,
  db: {},
}));

// ── Permissions mock (src/permissions → "../../permissions") ─────────────────
const mockGetUserContext = vi.hoisted(() => vi.fn());

vi.mock("../../permissions", () => ({
  getUserContext: (...args: any[]) => mockGetUserContext(...args),
  createPermissionMiddleware: () => (_req: any, _res: any, next: any) => next(),
  PERMISSIONS: { READ_JOBS: "read_jobs", WRITE_JOBS: "write_jobs" },
  ownerOnly: () => (_req: any, _res: any, next: any) => next(),
  ownerOrManagerOnly: () => (_req: any, _res: any, next: any) => next(),
  requirePermission: () => () => (_req: any, _res: any, next: any) => next(),
  hasPermission: vi.fn().mockReturnValue(true),
  canAssignJobTo: vi.fn().mockResolvedValue(true),
  getWorkerPermissionContext: vi.fn().mockResolvedValue({}),
  sanitizeClientData: vi.fn((d: any) => d),
  requireTeamPlan: () => (_req: any, _res: any, next: any) => next(),
  ownerHasTeamCapability: vi.fn().mockResolvedValue(true),
  checkTeamSeatLimit: vi.fn().mockResolvedValue({ ok: true }),
  canAccessJobMedia: vi.fn().mockResolvedValue(true),
  requireJobMediaAccess: () => (_req: any, _res: any, next: any) => next(),
}));

// ── Auth middleware (src/routes/middleware → "../middleware") ─────────────────
const WORKER_USER_ID = "worker-1";
const OWNER_USER_ID  = "owner-1";

vi.mock("../middleware", () => {
  const pt = (_: any, __: any, next: any) => next();
  const ft = () => pt; // factory middleware: requirePaidTier() returns middleware
  return {
    requireAuth: (req: any, _res: any, next: any) => { req.userId = WORKER_USER_ID; next(); },
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

// ── Route-level helpers (src/routes/helpers → "../helpers") ──────────────────
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

// ── retentionSummary (src/routes/retentionSummary → "../retentionSummary") ───
vi.mock("../retentionSummary", () => ({
  computeRetentionSummary: vi.fn().mockResolvedValue({}),
}));

// ── Heavy stub modules — all in src/ → "../../xxx" from __tests__ ────────────
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
    array:  vi.fn().mockReturnValue(middleware),
    fields: vi.fn().mockReturnValue(middleware),
  });
  m.memoryStorage = vi.fn().mockReturnValue({});
  m.diskStorage   = vi.fn().mockReturnValue({});
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
vi.mock("../../freemiumService",         () => ({ FreemiumService: class { check = vi.fn().mockResolvedValue({ allowed: true }); } }));
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

// @workspace/db: stub all table/schema exports the module references
vi.mock("@workspace/db", () => {
  const tableStub  = { name: "stub" };
  const schemaStub = {
    parse: vi.fn(),
    safeParse: vi.fn().mockReturnValue({ success: true, data: {} }),
  };
  return new Proxy({}, {
    get(_target, prop) {
      if (typeof prop === "string" && (prop.startsWith("insert") || prop.startsWith("update"))) return schemaStub;
      return tableStub;
    },
  });
});

// drizzle-orm: no-op helpers (not exercised by the today route)
vi.mock("drizzle-orm", () => {
  const noop = vi.fn();
  return {
    eq: noop, sql: noop, desc: noop, asc: noop, and: noop,
    gte: noop, lte: noop, lt: noop, isNotNull: noop, isNull: noop,
    inArray: noop, or: noop, count: noop, sum: noop, ne: noop, aliasedTable: noop,
  };
});

// ── Import the route under test ───────────────────────────────────────────────
import express from "express";
import request from "supertest";
import { registerJobsRoutes } from "../jobs";

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Returns an ISO timestamp for today at the given hour (local-time). */
function todayAt(hour: number): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function yesterdayAt(hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function tomorrowAt(hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function makeJob(overrides: Record<string, any> = {}) {
  return {
    id: "job-1",
    title: "Roof inspection",
    status: "scheduled",
    scheduledAt: todayAt(9),
    clientId: "client-1",
    assignedTo: WORKER_USER_ID,
    scheduleOrder: null,
    ...overrides,
  };
}

/** Full-owner user context: sees all jobs, no assignment filter. */
const OWNER_CONTEXT = {
  userId: OWNER_USER_ID,
  effectiveUserId: OWNER_USER_ID,
  isOwner: true,
  permissions: ["view_all", "read_jobs"],
  teamMemberId: null,
};

/** Worker context: must have explicit assignment to see a job. */
const WORKER_CONTEXT = {
  userId: WORKER_USER_ID,
  effectiveUserId: OWNER_USER_ID,
  isOwner: false,
  permissions: ["read_jobs"],
  teamMemberId: "tm-1",
};

function buildApp() {
  const app = express();
  app.use(express.json());
  const noopMiddleware = (_: any, __: any, next: any) => next();
  const noopMulter = {
    single: vi.fn(() => noopMiddleware),
    array:  vi.fn(() => noopMiddleware),
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

// ── Test setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUserContext.mockResolvedValue(OWNER_CONTEXT);
  mockStorage.getClients.mockResolvedValue([
    { id: "client-1", name: "Acme Corp", phone: "0400000000", email: "acme@example.com" },
  ]);
  mockStorage.getAssignedJobIdsForUser.mockResolvedValue([]);
});

// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/jobs/today — Today section visibility", () => {

  // ── Scenario 1: at least one active job today ─────────────────────────────
  describe("when a worker has active jobs scheduled for today", () => {
    it("returns the job so the Today section is visible", async () => {
      mockStorage.getJobs.mockResolvedValue([makeJob({ status: "scheduled" })]);

      const res = await request(buildApp()).get("/api/jobs/today");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe("job-1");
    });

    it("enriches jobs with the client name", async () => {
      mockStorage.getJobs.mockResolvedValue([makeJob({ clientId: "client-1" })]);

      const res = await request(buildApp()).get("/api/jobs/today");

      expect(res.status).toBe(200);
      expect(res.body[0].clientName).toBe("Acme Corp");
    });

    it("includes in_progress jobs so a started job stays in the section", async () => {
      mockStorage.getJobs.mockResolvedValue([makeJob({ status: "in_progress" })]);

      const res = await request(buildApp()).get("/api/jobs/today");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it("includes pending jobs scheduled today", async () => {
      mockStorage.getJobs.mockResolvedValue([makeJob({ status: "pending" })]);

      const res = await request(buildApp()).get("/api/jobs/today");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it("returns multiple active today jobs so each row renders", async () => {
      mockStorage.getJobs.mockResolvedValue([
        makeJob({ id: "job-a", status: "scheduled",   scheduledAt: todayAt(8) }),
        makeJob({ id: "job-b", status: "in_progress", scheduledAt: todayAt(10) }),
        makeJob({ id: "job-c", status: "pending",     scheduledAt: todayAt(14) }),
      ]);

      const res = await request(buildApp()).get("/api/jobs/today");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
    });
  });

  // ── Scenario 2: no jobs today ─────────────────────────────────────────────
  describe("when a worker has no jobs scheduled today", () => {
    it("returns an empty array so the Today section is hidden", async () => {
      mockStorage.getJobs.mockResolvedValue([]);

      const res = await request(buildApp()).get("/api/jobs/today");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it("excludes jobs scheduled for tomorrow", async () => {
      mockStorage.getJobs.mockResolvedValue([makeJob({ scheduledAt: tomorrowAt(9) })]);

      const res = await request(buildApp()).get("/api/jobs/today");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it("excludes jobs scheduled for yesterday", async () => {
      mockStorage.getJobs.mockResolvedValue([makeJob({ scheduledAt: yesterdayAt(9) })]);

      const res = await request(buildApp()).get("/api/jobs/today");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it("excludes jobs with no scheduledAt", async () => {
      mockStorage.getJobs.mockResolvedValue([makeJob({ scheduledAt: null })]);

      const res = await request(buildApp()).get("/api/jobs/today");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });

  // ── Scenario 3: completing the last job removes it from the section ────────
  describe("when the worker completes their last job for the day", () => {
    it("excludes done jobs so the Today section disappears on the next refresh", async () => {
      mockStorage.getJobs.mockResolvedValue([makeJob({ status: "done" })]);

      const res = await request(buildApp()).get("/api/jobs/today");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it("excludes invoiced jobs from the Today section", async () => {
      mockStorage.getJobs.mockResolvedValue([makeJob({ status: "invoiced" })]);

      const res = await request(buildApp()).get("/api/jobs/today");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it("returns empty when all today jobs are done or invoiced", async () => {
      mockStorage.getJobs.mockResolvedValue([
        makeJob({ id: "job-a", status: "done",     scheduledAt: todayAt(8) }),
        makeJob({ id: "job-b", status: "invoiced", scheduledAt: todayAt(10) }),
      ]);

      const res = await request(buildApp()).get("/api/jobs/today");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it("keeps the section visible when at least one active job remains", async () => {
      mockStorage.getJobs.mockResolvedValue([
        makeJob({ id: "job-a", status: "done",      scheduledAt: todayAt(8) }),
        makeJob({ id: "job-b", status: "scheduled", scheduledAt: todayAt(14) }),
      ]);

      const res = await request(buildApp()).get("/api/jobs/today");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe("job-b");
    });
  });

  // ── Worker scoping ────────────────────────────────────────────────────────
  describe("worker job visibility — only assigned jobs appear", () => {
    it("returns only jobs assigned to the worker, not all business jobs", async () => {
      mockGetUserContext.mockResolvedValue(WORKER_CONTEXT);
      mockStorage.getJobs.mockResolvedValue([
        makeJob({ id: "job-a", assignedTo: WORKER_USER_ID,   scheduledAt: todayAt(9) }),
        makeJob({ id: "job-b", assignedTo: "another-worker", scheduledAt: todayAt(11) }),
        makeJob({ id: "job-c", assignedTo: null,             scheduledAt: todayAt(13) }),
      ]);
      mockStorage.getAssignedJobIdsForUser.mockResolvedValue([]);

      const res = await request(buildApp()).get("/api/jobs/today");

      expect(res.status).toBe(200);
      const ids = res.body.map((j: any) => j.id);
      expect(ids).toContain("job-a");
      expect(ids).not.toContain("job-b");
      expect(ids).not.toContain("job-c");
    });
  });

  // ── Sort order ────────────────────────────────────────────────────────────
  describe("sort order", () => {
    it("sorts by scheduleOrder when set", async () => {
      mockStorage.getJobs.mockResolvedValue([
        makeJob({ id: "job-b", scheduleOrder: 2, scheduledAt: todayAt(8) }),
        makeJob({ id: "job-a", scheduleOrder: 1, scheduledAt: todayAt(10) }),
      ]);

      const res = await request(buildApp()).get("/api/jobs/today");

      expect(res.status).toBe(200);
      expect(res.body[0].id).toBe("job-a");
      expect(res.body[1].id).toBe("job-b");
    });

    it("falls back to scheduledAt when no scheduleOrder is set", async () => {
      mockStorage.getJobs.mockResolvedValue([
        makeJob({ id: "job-b", scheduledAt: todayAt(14) }),
        makeJob({ id: "job-a", scheduledAt: todayAt(8) }),
      ]);

      const res = await request(buildApp()).get("/api/jobs/today");

      expect(res.status).toBe(200);
      expect(res.body[0].id).toBe("job-a");
      expect(res.body[1].id).toBe("job-b");
    });
  });
});
