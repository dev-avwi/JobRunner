/**
 * Tests for GET /api/jobs/:jobId/project-documents?phaseId=
 *
 * Verifies that:
 *   1. An authenticated worker with job access receives a filtered document list
 *      and the phaseId predicate is actually built into the DB query
 *   2. An unassigned subcontractor is blocked with 403 by the REAL
 *      requireJobMediaAccess / canAccessJobMedia / isUserAssignedToJob guard
 *   3. The empty state (zero matching docs) returns an empty array, not an error
 *
 * Guard strategy: the real requireJobMediaAccess reads req.userContext when it is
 * already set, skipping its internal getUserContext call.  buildApp() injects a
 * context via a pre-route middleware so the test controls identity without having
 * to stub the many storage methods getUserContext itself requires.  The guard then
 * calls the real canAccessJobMedia → isUserAssignedToJob → mockStorage.getJob /
 * mockStorage.getJobAssignments, which are the only storage calls that matter for
 * access-control correctness.
 *
 * Path note: this test lives in src/routes/__tests__/.
 *   - "../../xxx" resolves to src/xxx
 *   - "../xxx"   resolves to src/routes/xxx
 * All vi.mock() paths are written relative to THIS test file.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── drizzle-orm spies — hoisted so tests can assert predicate construction ────
// eq(col, val) records every call; we assert the exact column sentinel and value.
const mockEq  = vi.hoisted(() => vi.fn((col: any, val: any) => ({ __eq:  { col, val } })));
const mockAnd = vi.hoisted(() => vi.fn((...args: any[]) => ({ __and: args })));

// ── Column sentinels — hoisted so they are available both in vi.mock factories
//    (which are hoisted above module code) and in test-body assertions. ────────
const PD_COLS = vi.hoisted(() => ({
  jobId:     { __col: "pd.jobId" },
  userId:    { __col: "pd.userId" },
  phaseId:   { __col: "pd.phaseId" },
  docNumber: { __col: "pd.docNumber" },
}));
const PDR_COLS = vi.hoisted(() => ({
  documentId: { __col: "pdr.documentId" },
  uploadedAt:  { __col: "pdr.uploadedAt" },
}));

// ── DB mock (chainable drizzle-style fluent API) ─────────────────────────────
const mockDb = vi.hoisted(() => {
  const state = {
    currentTable: null as any,
    docRows:      [] as any[],
    revisionRows: [] as any[],
  };

  const chain: any = {
    _state: state,
    select:  vi.fn(),
    from:    vi.fn(),
    where:   vi.fn(),
    orderBy: vi.fn(),
  };

  chain.select.mockImplementation(() => {
    state.currentTable = null;
    return chain;
  });
  chain.from.mockImplementation((table: any) => {
    state.currentTable = table;
    return chain;
  });
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockImplementation(() =>
    Promise.resolve(
      state.currentTable?.__kind === "pdr" ? state.revisionRows : state.docRows
    )
  );

  return chain;
});

// ── Storage mock ─────────────────────────────────────────────────────────────
// Only the methods exercised by the real requireJobMediaAccess path are needed.
const mockStorage = vi.hoisted(() => ({
  getJob:            vi.fn(),
  getJobAssignments: vi.fn(),
}));

vi.mock("../../storage", () => ({
  storage: mockStorage,
  db:      mockDb,
}));

// ── @workspace/db — tagged stubs with inspectable column sentinels ────────────
// Each column is a unique object so eq(pd.phaseId, value) can be distinguished
// from eq(pd.jobId, value) etc.  The __kind tag lets mockDb.from() know which
// query is running (docs vs revisions).  PD_COLS/PDR_COLS are vi.hoisted so
// they are available inside this hoisted mock factory AND in test assertions.
vi.mock("@workspace/db", () => {
  const pd  = { __kind: "pd",  name: "projectDocuments",         ...PD_COLS };
  const pdr = { __kind: "pdr", name: "projectDocumentRevisions", ...PDR_COLS };
  const tableStub  = { name: "stub" };
  const schemaStub = {
    parse:     vi.fn(),
    safeParse: vi.fn().mockReturnValue({ success: true, data: {} }),
  };
  return new Proxy({ projectDocuments: pd, projectDocumentRevisions: pdr }, {
    get(target, prop) {
      if (prop in target) return (target as any)[prop];
      if (typeof prop === "string" && (prop.startsWith("insert") || prop.startsWith("update")))
        return schemaStub;
      return tableStub;
    },
  });
});

// ── Permissions — keep the REAL requireJobMediaAccess, canAccessJobMedia, and
//    isUserAssignedToJob; only stub the express helper factories and getUserContext
//    (the route handler in jobs.ts imports getUserContext from permissions and calls
//    it itself — that import IS intercepted by vi.mock, so mockGetUserContext works
//    for the handler body.  The real requireJobMediaAccess reads req.userContext
//    before ever calling its internal getUserContext, so no stub needed there.)
// ────────────────────────────────────────────────────────────────────────────
const mockGetUserContext = vi.hoisted(() => vi.fn());

vi.mock("../../permissions", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../permissions")>();
  return {
    ...real,
    // Replace getUserContext used by the route handler body (jobs.ts import)
    getUserContext: (...args: any[]) => mockGetUserContext(...args),
    // createPermissionMiddleware is a pass-through (READ_JOBS check not under test)
    createPermissionMiddleware: () => (_req: any, _res: any, next: any) => next(),
    // requireJobMediaAccess, canAccessJobMedia, isUserAssignedToJob: USE THE REAL ONES
  };
});

// ── Auth middleware ───────────────────────────────────────────────────────────
const WORKER_USER_ID        = "worker-1";
const SUBCONTRACTOR_USER_ID = "subcontractor-1";
const OWNER_USER_ID         = "owner-1";

vi.mock("../middleware", () => {
  const pt = (_: any, __: any, next: any) => next();
  const ft = () => pt;
  return {
    // requireAuth just stamps req.userId; individual tests control the injected
    // userContext (and thus effective identity) via buildApp(context).
    requireAuth: (req: any, _res: any, next: any) => { req.userId = req._testUserId ?? WORKER_USER_ID; next(); },
    requireProSubscription:     ft,
    requirePaidTier:            ft,
    requirePaidTierForSms:      ft,
    requireDevelopment:         pt,
    authRateLimiter:            pt,
    passwordResetLimiter:       pt,
    paymentRateLimiter:         pt,
    messageSendLimiter:         pt,
    generalApiLimiter:          pt,
    setupOnboardingGuard:       pt,
    pdfPerUserLimiter:          pt,
    aiPerUserLimiter:           pt,
    visionPerUserLimiter:       pt,
    photoUploadPerUserLimiter:  pt,
    transcribePerUserLimiter:   pt,
    backpressureErrorHandler:   pt,
  };
});

// ── Route-level helpers ───────────────────────────────────────────────────────
vi.mock("../helpers", () => ({
  dbCheckEnRouteNotif:                vi.fn(),
  chatRateLimiterMiddleware:          (_: any, __: any, next: any) => next(),
  portalIpRateLimiterMiddleware:      (_: any, __: any, next: any) => next(),
  getIdempotencyRecord:               vi.fn().mockResolvedValue(null),
  setIdempotencyRecord:               vi.fn().mockResolvedValue(undefined),
  logActivity:                        vi.fn().mockResolvedValue(undefined),
  formatRelativeTime:                 vi.fn().mockReturnValue(""),
  normalizeAuPhone:                   vi.fn((v: string) => v),
  resolveAssigneeUserId:              vi.fn().mockResolvedValue(null),
  autoUpdateWorkerState:              vi.fn().mockResolvedValue(undefined),
  gatherAIContext:                    vi.fn().mockResolvedValue({}),
  verifyInvoiceCalculation:           vi.fn().mockReturnValue({ ok: true }),
  validateAustralianCoords:           vi.fn().mockReturnValue(true),
  wasRecentlyNotifiedTeamJoinBlocked: vi.fn().mockReturnValue(false),
  emailPaymentLinkCooldown:           vi.fn().mockReturnValue(false),
  EMAIL_PAYMENT_LINK_COOLDOWN_MS:     0,
}));

vi.mock("../retentionSummary", () => ({
  computeRetentionSummary: vi.fn().mockResolvedValue({}),
}));

// ── Heavy stubs ───────────────────────────────────────────────────────────────
vi.mock("@sentry/node", () => ({
  default: {},
  captureException:         vi.fn(),
  withScope:                vi.fn(),
  init:                     vi.fn(),
  setupExpressErrorHandler: vi.fn(),
  addBreadcrumb:            vi.fn(),
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
  default:   vi.fn().mockReturnValue((_: any, __: any, next: any) => next()),
  rateLimit: vi.fn().mockReturnValue((_: any, __: any, next: any) => next()),
}));

vi.mock("jsonwebtoken", () => ({
  default: { sign: vi.fn().mockReturnValue("tok"), verify: vi.fn(), decode: vi.fn() },
  sign:    vi.fn().mockReturnValue("tok"),
  verify:  vi.fn(),
  decode:  vi.fn(),
}));

vi.mock("../../auth",            () => ({ AuthService: class { authenticate = vi.fn(); } }));
vi.mock("../../googleAuth",      () => ({ setupGoogleAuth: vi.fn() }));
vi.mock("../../xeroAuth",        () => ({ setupXeroAuth:   vi.fn() }));
vi.mock("../../concurrency",     () => ({ isBackpressure: vi.fn().mockReturnValue(false), send429: vi.fn(), aiQueue: { add: vi.fn().mockResolvedValue(null) } }));
vi.mock("../../emailService",    () => ({ sendEmailVerificationEmail: vi.fn(), sendLoginCodeEmail: vi.fn(), sendJobConfirmationEmail: vi.fn(), sendPasswordResetEmail: vi.fn(), sendTeamInviteEmail: vi.fn(), sendJobAssignmentEmail: vi.fn(), sendJobCompletionNotificationEmail: vi.fn(), sendWelcomeEmail: vi.fn() }));
vi.mock("../../freemiumService", () => ({ FreemiumService: class { check = vi.fn().mockResolvedValue({ allowed: true }); } }));
vi.mock("../../demoData",        () => ({ DEMO_USER: null, VISITOR_USER: null }));
vi.mock("../../activityService", () => ({ logTeamActivity: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../logger",          () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../../objectStorage",   () => ({
  ObjectStorageService: class {},
  ObjectNotFoundError:  class extends Error {},
  objectStorageClient:  {
    bucket: vi.fn().mockReturnValue({
      file: vi.fn().mockReturnValue({
        getSignedUrl: vi.fn().mockResolvedValue(["https://signed-url.example"]),
      }),
    }),
  },
  parseObjectPath: vi.fn().mockReturnValue({ bucketName: "bucket", objectName: "key" }),
}));
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

// ── drizzle-orm — use hoisted spies so tests can assert predicate construction ─
vi.mock("drizzle-orm", () => ({
  eq:          mockEq,
  and:         mockAnd,
  sql:         vi.fn(),
  desc:        vi.fn((...args: any[]) => args[0]),
  asc:         vi.fn((...args: any[]) => args[0]),
  gte:         vi.fn(), lte: vi.fn(), lt: vi.fn(),
  isNotNull:   vi.fn(), isNull: vi.fn(),
  inArray:     vi.fn(), or: vi.fn(), count: vi.fn(), sum: vi.fn(),
  ne:          vi.fn(), aliasedTable: vi.fn(),
}));

// ── Route under test ──────────────────────────────────────────────────────────
import express from "express";
import request from "supertest";
import { registerJobsRoutes } from "../jobs";

// ── User context fixtures ─────────────────────────────────────────────────────

/** Worker with WRITE_JOB_MEDIA permission, assigned to the job via assignedTo field. */
function workerContext() {
  return {
    userId:          WORKER_USER_ID,
    effectiveUserId: OWNER_USER_ID,
    businessOwnerId: OWNER_USER_ID,
    isOwner:         false,
    permissions:     ["read_jobs", "write_job_media"],
    teamMemberId:    "tm-worker-1",
    roleName:        "Worker",
    isSubcontractor: false,
  };
}

/**
 * Subcontractor with WRITE_JOB_MEDIA permission but NO active job assignment.
 * The real canAccessJobMedia will return false → 403.
 */
function unassignedSubcontractorContext() {
  return {
    userId:          SUBCONTRACTOR_USER_ID,
    effectiveUserId: OWNER_USER_ID,
    businessOwnerId: OWNER_USER_ID,
    isOwner:         false,
    permissions:     ["read_jobs", "write_job_media"],
    teamMemberId:    "tm-sub-1",
    roleName:        "Subcontractor",
    isSubcontractor: true,
  };
}

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id:        "doc-1",
    jobId:     "job-1",
    userId:    OWNER_USER_ID,
    phaseId:   "phase-abc",
    title:     "Site Survey",
    category:  "Other",
    docNumber: 1,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeRevision(overrides: Record<string, unknown> = {}) {
  return {
    id:               "rev-1",
    documentId:       "doc-1",
    revision:         "A",
    objectStorageKey: "private/project-documents/owner-1/job-1/file.pdf",
    uploadedAt:       new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Build a test Express app.
 *
 * The injectedContext middleware runs first and sets req.userContext, so the
 * real requireJobMediaAccess skips its internal getUserContext call and goes
 * straight to canAccessJobMedia → isUserAssignedToJob → mockStorage.
 */
function buildApp(injectedContext: Record<string, unknown> = workerContext() as any) {
  const app = express();
  app.use(express.json());

  // Pre-inject userContext so requireJobMediaAccess uses it directly without
  // calling getUserContext (which needs many unrelated storage methods).
  app.use((req: any, _res: any, next: any) => {
    req.userContext = injectedContext;
    next();
  });

  const noopMw = (_: any, __: any, next: any) => next();
  const noopMulter = {
    single: vi.fn(() => noopMw),
    array:  vi.fn(() => noopMw),
    fields: vi.fn(() => noopMw),
  };
  registerJobsRoutes(app, {
    trackingTokens:       new Map(),
    buildProofPackData:   vi.fn().mockResolvedValue({}),
    sitePhotoCache:       new Map(),
    upload:               noopMulter as any,
    getJobWithChatAccess: vi.fn().mockResolvedValue(null),
    chatUpload:           noopMulter as any,
  });
  return app;
}

// ── Test setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // mockGetUserContext handles the route handler body's getUserContext call
  mockGetUserContext.mockResolvedValue(workerContext());

  // Default: job exists and is assigned to the worker via legacy assignedTo field
  mockStorage.getJob.mockResolvedValue({
    id:         "job-1",
    userId:     OWNER_USER_ID,
    assignedTo: WORKER_USER_ID,
  });
  mockStorage.getJobAssignments.mockResolvedValue([]);

  // Default: no docs or revisions
  mockDb._state.docRows      = [];
  mockDb._state.revisionRows = [];
  mockDb._state.currentTable = null;

  // Reset chain mocks (cleared by vi.clearAllMocks above)
  mockDb.select.mockImplementation(() => {
    mockDb._state.currentTable = null;
    return mockDb;
  });
  mockDb.from.mockImplementation((table: any) => {
    mockDb._state.currentTable = table;
    return mockDb;
  });
  mockDb.where.mockReturnValue(mockDb);
  mockDb.orderBy.mockImplementation(() =>
    Promise.resolve(
      mockDb._state.currentTable?.__kind === "pdr"
        ? mockDb._state.revisionRows
        : mockDb._state.docRows
    )
  );
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/jobs/:jobId/project-documents", () => {

  describe("worker with job access", () => {

    it("returns documents and builds a phaseId predicate in the DB query", async () => {
      mockDb._state.docRows      = [makeDoc({ phaseId: "phase-abc" })];
      mockDb._state.revisionRows = [makeRevision()];

      const res = await request(buildApp())
        .get("/api/jobs/job-1/project-documents?phaseId=phase-abc");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe("doc-1");
      expect(res.body[0].phaseId).toBe("phase-abc");

      // The route must call eq(pd.phaseId, 'phase-abc') — the exact column sentinel
      // and value must match so a regression like eq(pd.jobId, phaseId) would fail.
      const phaseEqCall = mockEq.mock.calls.find(
        ([col, val]: any) => col === PD_COLS.phaseId && val === "phase-abc"
      );
      expect(phaseEqCall).toBeDefined();

      // The phaseId predicate must be composed into the where clause via and()
      const andCall = mockAnd.mock.calls.find((args: any[]) =>
        args.some((arg: any) => arg?.__eq?.col === PD_COLS.phaseId && arg.__eq.val === "phase-abc")
      );
      expect(andCall).toBeDefined();
    });

    it("includes latestRevision and revisionCount on each returned document", async () => {
      mockDb._state.docRows      = [makeDoc()];
      mockDb._state.revisionRows = [makeRevision()];

      const res = await request(buildApp())
        .get("/api/jobs/job-1/project-documents?phaseId=phase-abc");

      expect(res.status).toBe(200);
      expect(res.body[0].revisionCount).toBe(1);
      expect(res.body[0].latestRevision).toBeDefined();
      expect(res.body[0].latestRevision.id).toBe("rev-1");
    });

    it("returns an empty array (not an error) when no documents match the phaseId", async () => {
      // _state.docRows is already []

      const res = await request(buildApp())
        .get("/api/jobs/job-1/project-documents?phaseId=phase-empty");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("still builds a phaseId predicate with the correct column even when the result set is empty", async () => {
      // _state.docRows is already []

      await request(buildApp())
        .get("/api/jobs/job-1/project-documents?phaseId=phase-empty");

      // Must use the phaseId column sentinel, not just any eq value
      const phaseEqCall = mockEq.mock.calls.find(
        ([col, val]: any) => col === PD_COLS.phaseId && val === "phase-empty"
      );
      expect(phaseEqCall).toBeDefined();
    });

    it("returns 404 when the job is not found by the handler after the guard passes", async () => {
      // The real guard (isUserAssignedToJob) calls storage.getJob first.
      // Return the job for that call so the guard passes, then return null
      // for the route handler's own getJob call so it produces 404.
      mockStorage.getJob
        .mockResolvedValueOnce({ id: "job-1", userId: OWNER_USER_ID, assignedTo: WORKER_USER_ID }) // guard
        .mockResolvedValueOnce(null); // handler body

      const res = await request(buildApp())
        .get("/api/jobs/job-1/project-documents?phaseId=phase-abc");

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: "Job not found" });
    });

  });

  describe("unassigned subcontractor — real requireJobMediaAccess guard", () => {

    it("returns 403 from the real canAccessJobMedia guard", async () => {
      // Job exists but the subcontractor is not in assignedTo and has no
      // active entry in job_assignments — real canAccessJobMedia returns false.
      mockStorage.getJob.mockResolvedValue({
        id:         "job-1",
        userId:     OWNER_USER_ID,
        assignedTo: WORKER_USER_ID, // a different worker holds the assignment
      });
      mockStorage.getJobAssignments.mockResolvedValue([]); // no multi-assignments

      const res = await request(buildApp(unassignedSubcontractorContext()))
        .get("/api/jobs/job-1/project-documents?phaseId=phase-abc");

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ error: "You are not assigned to this job." });
    });

    it("does not execute any DB document query when access is denied", async () => {
      mockStorage.getJob.mockResolvedValue({
        id:         "job-1",
        userId:     OWNER_USER_ID,
        assignedTo: WORKER_USER_ID,
      });
      mockStorage.getJobAssignments.mockResolvedValue([]);

      await request(buildApp(unassignedSubcontractorContext()))
        .get("/api/jobs/job-1/project-documents?phaseId=phase-abc");

      // The guard fires before the handler body, so no db.select should occur
      expect(mockDb.select).not.toHaveBeenCalled();
    });

  });

});
