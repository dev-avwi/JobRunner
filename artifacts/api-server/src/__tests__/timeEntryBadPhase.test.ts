/**
 * timeEntryBadPhase.test.ts
 *
 * API-level regression guard for POST /api/time-entries when the caller
 * provides a phaseId that is NOT in the list returned by storage.getJobPhases.
 *
 * Verifies:
 *   1. The server responds with a 4xx error (not 2xx) — the request is
 *      rejected, not silently accepted.
 *   2. storage.getJobPhases is called to attempt the validation.
 *   3. storage.createTimeEntry is NOT called — no DB row is written.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import express from "express";
import request from "supertest";

// ── Constants ──────────────────────────────────────────────────────────────────

const OWNER_ID        = "biz-owner-3";
const WORKER_ID       = "worker-3";
const JOB_ID          = "job-phase-bad";
const VALID_PHASE_ID  = "phase-real-001";
const BOGUS_PHASE_ID  = "phase-does-not-exist-999";

// ── Hoisted mutable state ─────────────────────────────────────────────────────

const mockCreateTimeEntry    = vi.hoisted(() => vi.fn());
const mockGetJob             = vi.hoisted(() => vi.fn());
const mockGetJobPhases       = vi.hoisted(() => vi.fn());
const mockGetJobAssignments  = vi.hoisted(() => vi.fn());
const mockGetActiveTimeEntry = vi.hoisted(() => vi.fn());
const mockGetMember          = vi.hoisted(() => vi.fn());
const mockGetUserContext     = vi.hoisted(() => vi.fn());
const mockGetBusinessSettings = vi.hoisted(() => vi.fn());

// ── Module mocks ───────────────────────────────────────────────────────────────

vi.mock("@sentry/node", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  withScope: vi.fn(),
  Handlers: { requestHandler: () => (_: any, __: any, next: any) => next() },
}));

vi.mock("jsonwebtoken", () => ({
  default: { sign: vi.fn(), verify: vi.fn(), decode: vi.fn() },
  sign: vi.fn(), verify: vi.fn(), decode: vi.fn(),
}));

vi.mock("express-rate-limit", () => ({
  default: vi.fn(() => (_: any, __: any, next: any) => next()),
}));

vi.mock("multer", () => {
  const m: any = vi.fn(() => ({
    single:  vi.fn(() => (_: any, __: any, next: any) => next()),
    array:   vi.fn(() => (_: any, __: any, next: any) => next()),
    fields:  vi.fn(() => (_: any, __: any, next: any) => next()),
    none:    vi.fn(() => (_: any, __: any, next: any) => next()),
    any:     vi.fn(() => (_: any, __: any, next: any) => next()),
  }));
  m.memoryStorage = vi.fn(() => ({}));
  return { default: m };
});

vi.mock("../storage", () => ({
  storage: {
    createTimeEntry:                    (...a: any[]) => mockCreateTimeEntry(...a),
    getJob:                             (...a: any[]) => mockGetJob(...a),
    getJobPhases:                       (...a: any[]) => mockGetJobPhases(...a),
    getJobAssignments:                  (...a: any[]) => mockGetJobAssignments(...a),
    getActiveTimeEntry:                 (...a: any[]) => mockGetActiveTimeEntry(...a),
    getTeamMemberByOwnerAndMemberId:    (...a: any[]) => mockGetMember(...a),
    getBusinessSettings:                (...a: any[]) => mockGetBusinessSettings(...a),
    getTimeEntry:                       vi.fn(async () => null),
    getTimeEntryAny:                    vi.fn(async () => null),
    getUser:                            vi.fn(async () => null),
    getTeamMembers:                     vi.fn(async () => []),
    updateJob:                          vi.fn(async () => null),
  },
  db: {
    select:      vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) })),
    insert:      vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(async () => []) })) })),
    update:      vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => []) })) })),
    delete:      vi.fn(() => ({ where: vi.fn(async () => []) })),
    execute:     vi.fn(async () => ({ rows: [] })),
    transaction: vi.fn(async (fn: any) => fn({
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) })),
      insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(async () => []) })) })),
    })),
  },
}));

vi.mock("@workspace/db", () => {
  function ms(): any {
    const s: any = {
      parse:       (d: any) => d,
      safeParse:   (d: any) => ({ success: true, data: d }),
      partial:     () => s, omit:        () => s, pick:      () => s,
      extend:      () => s, refine:      () => s, superRefine: () => s,
      transform:   () => s, optional:    () => s, nullable:  () => s,
      default:     () => s, array:       () => s, shape:     {},
    };
    return s;
  }
  return {
    insertTimeEntrySchema:            ms(),
    insertBusinessSettingsSchema:     ms(),
    insertIntegrationSettingsSchema:  ms(),
    insertNotificationSchema:         ms(),
    insertClientSchema:               ms(),
    insertJobSchema:                  ms(),
    insertQuoteSchema:                ms(),
    updateQuoteSchema:                ms(),
    insertQuoteLineItemSchema:        ms(),
    insertInvoiceSchema:              ms(),
    updateInvoiceSchema:              ms(),
    insertInvoiceLineItemSchema:      ms(),
    insertDocumentTemplateSchema:     ms(),
    insertLineItemCatalogSchema:      ms(),
    insertRateCardSchema:             ms(),
    insertTimesheetSchema:            ms(),
    insertExpenseCategorySchema:      ms(),
    insertExpenseSchema:              ms(),
    insertInventoryCategorySchema:    ms(),
    insertInventoryItemSchema:        ms(),
    insertInventoryTransactionSchema: ms(),
    insertSupplierSchema:             ms(),
    insertPurchaseOrderSchema:        ms(),
    insertPurchaseOrderItemSchema:    ms(),
    insertUserRoleSchema:             ms(),
    insertTeamMemberSchema:           ms(),
    insertStaffScheduleSchema:        ms(),
    insertLocationTrackingSchema:     ms(),
    insertRouteSchema:                ms(),
    insertChecklistItemSchema:        ms(),
    updateChecklistItemSchema:        ms(),
    insertJobChatSchema:              ms(),
    insertTeamChatSchema:             ms(),
    insertSmsTemplateSchema:          ms(),
    insertBusinessTemplateSchema:     ms(),
    updateBusinessTemplateSchema:     ms(),
    insertTeamPresenceSchema:         ms(),
    insertActivityFeedSchema:         ms(),
    insertRecurringContractSchema:    ms(),
    insertLeadSchema:                 ms(),
    insertJobNoteSchema:              ms(),
    insertJobMaterialSchema:          ms(),
    insertServiceReminderSchema:      ms(),
    insertEquipmentSchema:            ms(),
    insertEquipmentCategorySchema:    ms(),
    insertEquipmentMaintenanceSchema: ms(),
    insertRebateSchema:               ms(),
    insertTeamGroupSchema:            ms(),
    insertJobInviteSchema:            ms(),
    insertSubcontractorInvoiceSchema: ms(),
    insertSubcontractorInvoiceItemSchema: ms(),
    insertNumberPortRequestSchema:    ms(),
    insertSavedFilterSchema:          ms(),
    insertTimeEntryEditSchema:        ms(),
    insertGpsSignalLogSchema:         ms(),
    loginSchema:             ms(),
    insertUserSchema:        ms(),
    requestLoginCodeSchema:  ms(),
    verifyLoginCodeSchema:   ms(),
    timeEntries:    { id: "te.id", userId: "te.userId", jobId: "te.jobId" },
    jobs:           { id: "j.id",  userId: "j.userId" },
    lineItemCatalog: {},
    users: {}, clients: {}, jobPhases: {}, jobPhaseAssignments: {},
    jobAssignments: {}, jobDocuments: {}, jobMaterials: {}, jobEquipment: {},
    equipment: {}, equipmentCategories: {}, locationTracking: {}, tradieStatus: {},
    digitalSignatures: {}, invoices: {}, quotes: {}, businessSettings: {},
    businessTemplates: {}, teamMembers: {}, teamMemberSkills: {},
    teamMemberAvailability: {}, teamMemberTimeOff: {}, teamMemberMetrics: {},
    jobAssignmentRequests: {}, userRoles: {}, savedFilters: {}, timeEntryEdits: {},
    timeEntryDisputeEvents: {}, invoiceEdits: {}, invoiceReminderLogs: {},
    smsAutomationLogs: {}, smsAutomationRules: {}, jobReminders: {},
    automationLogs: {}, automations: {}, geofenceAlerts: {}, jobInvites: {},
    jobPhotos: {}, swmsDocuments: {}, swmsHazards: {}, swmsSignatures: {},
    customForms: {}, formSubmissions: {}, rateLimits: {}, smsMessages: {},
    smsConversations: {}, aiReceptionistCalls: {}, aiReceptionistConfig: {},
    leads: {}, errorLogs: {}, auditLogs: {}, systemEvents: {},
    websiteChangeRequests: {}, websiteAddons: {}, subcontractorTokens: {},
    subcontractorEvents: {}, subcontractorInvoices: {}, subcontractorInvoiceItems: {},
    numberPortRequests: {}, purchaseOrders: {}, purchaseOrderItems: {},
    claims: {}, claimLineItems: {}, tasks: {}, idempotencyKeys: {}, inviteCodes: {},
    feedback: {}, vapiEvents: {},
    ROLE_PRESETS: {}, BUSINESS_TEMPLATE_FAMILIES: [], PORT_REQUEST_STATUSES: [],
    isValidPurposeForFamily:  () => true,
    getValidPurposesForFamily: () => [],
  };
});

vi.mock("drizzle-orm", () => ({
  eq:           (a: any, b: any)       => ({ op: "eq",       a, b }),
  and:          (...args: any[])       => ({ op: "and",      args }),
  or:           (...args: any[])       => ({ op: "or",       args }),
  ne:           (a: any, b: any)       => ({ op: "ne",       a, b }),
  isNull:       (a: any)              => ({ op: "isNull",   a }),
  isNotNull:    (a: any)              => ({ op: "isNotNull", a }),
  inArray:      (a: any, b: any)      => ({ op: "inArray",  a, b }),
  gte:          (a: any, b: any)      => ({ op: "gte",      a, b }),
  lte:          (a: any, b: any)      => ({ op: "lte",      a, b }),
  lt:           (a: any, b: any)      => ({ op: "lt",       a, b }),
  desc:         (a: any)              => ({ op: "desc",     a }),
  asc:          (a: any)              => ({ op: "asc",      a }),
  sql:          (p: any, ...v: any[]) => ({ op: "sql",      p, v }),
  count:        (a: any)              => a,
  sum:          (a: any)              => a,
  aliasedTable: (t: any, _: string)  => t,
}));

vi.mock("../permissions", () => ({
  ownerOnly:                  vi.fn(() => (_: any, __: any, next: any) => next()),
  ownerOrManagerOnly:         vi.fn(() => (_: any, __: any, next: any) => next()),
  requirePermission:          vi.fn(() => (_: any, __: any, next: any) => next()),
  requireTeamPlan:            vi.fn(() => (_: any, __: any, next: any) => next()),
  canAccessJobMedia:          vi.fn(async () => true),
  PERMISSIONS: {
    MANAGE_TEAM:    "manage_team",
    WRITE_JOBS:     "write_jobs",
    READ_JOBS:      "read_jobs",
    WRITE_EXPENSES: "write_expenses",
    VIEW_REPORTS:   "view_reports",
  },
  createPermissionMiddleware: vi.fn(() => (_: any, __: any, next: any) => next()),
  requireJobMediaAccess:      (_: any, __: any, next: any) => next(),
  getUserContext:             (...a: any[]) => mockGetUserContext(...a),
  hasPermission:              vi.fn(() => true),
  hasAnyPermission:           vi.fn(() => true),
  canAssignJobTo:             vi.fn(async () => true),
  getWorkerPermissionContext: vi.fn(async () => ({})),
  sanitizeClientData:         vi.fn((d: any) => d),
  ownerHasTeamCapability:     vi.fn(async () => true),
  checkTeamSeatLimit:         vi.fn(async () => null),
  WORKER_PROFILE_PLACEHOLDER_NAME: "Worker",
  requireOwnerSubscriptionActive: vi.fn(() => (_: any, __: any, next: any) => next()),
}));

const passThroughMw = (_: any, __: any, next: any) => next();
vi.mock("../routes/middleware", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const uid = req.headers["x-user-id"];
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    req.userId = uid;
    next();
  },
  requireProSubscription:       passThroughMw,
  requirePaidTier:              vi.fn(() => passThroughMw),
  requirePaidTierForSms:        passThroughMw,
  requireDevelopment:           passThroughMw,
  authRateLimiter:              passThroughMw,
  registerRateLimiter:          passThroughMw,
  loginRateLimiter:             passThroughMw,
  verifyRateLimiter:            passThroughMw,
  passwordResetLimiter:         passThroughMw,
  paymentRateLimiter:           passThroughMw,
  messageSendLimiter:           passThroughMw,
  generalApiLimiter:            passThroughMw,
  setupOnboardingGuard:         vi.fn(),
  pdfPerUserLimiter:            passThroughMw,
  aiPerUserLimiter:             passThroughMw,
  visionPerUserLimiter:         passThroughMw,
  photoUploadPerUserLimiter:    passThroughMw,
  transcribePerUserLimiter:     passThroughMw,
  messagePerUserLimiter:        passThroughMw,
  webhookRateLimiter:           passThroughMw,
  backpressureErrorHandler:     passThroughMw,
  activityTrackingMiddleware:   passThroughMw,
  businessLocalDate:            vi.fn(() => "2026-09-13"),
  recordUserActivity:           vi.fn(async () => {}),
  isActiveTrialUser:            vi.fn(() => false),
}));

vi.mock("../routes/helpers", () => ({
  dbCheckEnRouteNotif:                vi.fn(async () => {}),
  chatRateLimiterMiddleware:          (_: any, __: any, next: any) => next(),
  portalIpRateLimiterMiddleware:      (_: any, __: any, next: any) => next(),
  getIdempotencyRecord:               vi.fn(async () => null),
  setIdempotencyRecord:               vi.fn(async () => {}),
  logActivity:                        vi.fn(async () => {}),
  formatRelativeTime:                 vi.fn(() => ""),
  normalizeAuPhone:                   vi.fn((p: any) => p),
  resolveAssigneeUserId:              vi.fn(async () => null),
  autoUpdateWorkerState:              vi.fn(async () => {}),
  gatherAIContext:                    vi.fn(async () => ({})),
  verifyInvoiceCalculation:           vi.fn(() => ({ ok: true })),
  validateAustralianCoords:           vi.fn(() => true),
  wasRecentlyNotifiedTeamJoinBlocked: vi.fn(async () => false),
  emailPaymentLinkCooldown:           vi.fn(async () => false),
  EMAIL_PAYMENT_LINK_COOLDOWN_MS:     3600000,
}));

vi.mock("../routes/retentionSummary", () => ({
  computeRetentionSummary: vi.fn(async () => ({})),
}));

vi.mock("../concurrency", () => ({
  isBackpressure: vi.fn(() => false),
  send429:        vi.fn(),
  aiQueue:        { add: vi.fn(async (fn: any) => fn()) },
}));

vi.mock("../auth", () => ({
  AuthService: {
    getUserById:   vi.fn(async () => null),
    verifyToken:   vi.fn(async () => null),
    createSession: vi.fn(async () => "tok"),
    sanitizeUserResponse: vi.fn((u: any) => u),
  },
  sanitizeUserResponse: vi.fn((u: any) => u),
}));

vi.mock("../googleAuth",   () => ({ setupGoogleAuth:   vi.fn() }));
vi.mock("../xeroAuth",     () => ({ setupXeroAuth:     vi.fn() }));
vi.mock("../appleAuth",    () => ({ verifyAppleIdentityToken: vi.fn() }));
vi.mock("../googleMobileAuth", () => ({
  verifyGoogleMobileToken: vi.fn(),
  GoogleTokenError: class extends Error {},
}));

vi.mock("../emailService", () => ({
  sendEmailVerificationEmail:         vi.fn(async () => {}),
  sendLoginCodeEmail:                 vi.fn(async () => {}),
  sendJobConfirmationEmail:           vi.fn(async () => {}),
  sendPasswordResetEmail:             vi.fn(async () => {}),
  sendTeamInviteEmail:                vi.fn(async () => {}),
  sendJobAssignmentEmail:             vi.fn(async () => {}),
  sendJobCompletionNotificationEmail: vi.fn(async () => {}),
  sendWelcomeEmail:                   vi.fn(async () => {}),
}));

vi.mock("../freemiumService", () => ({
  FreemiumService: { checkLimit: vi.fn(async () => true) },
}));

vi.mock("../demoData", () => ({
  DEMO_USER:    { id: "demo-user" },
  VISITOR_USER: { id: "visitor-user" },
  TRY_DEMO_USER: { id: "try-demo-user" },
}));

vi.mock("../activityService", () => ({
  logTeamActivity: vi.fn(async () => {}),
}));

vi.mock("../notifications", () => ({
  createNotification:              vi.fn(async () => {}),
  notifyQuoteSent:                 vi.fn(async () => {}),
  notifyInvoiceSent:               vi.fn(async () => {}),
  notifyInvoicePaid:               vi.fn(async () => {}),
  notifyJobScheduled:              vi.fn(async () => {}),
  notifyJobStarted:                vi.fn(async () => {}),
  notifyJobCompleted:              vi.fn(async () => {}),
  notifyJobAssigned:               vi.fn(async () => {}),
  notifyTeamMemberInvited:         vi.fn(async () => {}),
  notifySmsReceived:               vi.fn(async () => {}),
  notifyTimesheetSubmitted:        vi.fn(async () => {}),
  notifyChatMessage:               vi.fn(async () => {}),
  notifyQuoteAccepted:             vi.fn(async () => {}),
  notifyQuoteRejected:             vi.fn(async () => {}),
  notifyGeofenceCheckIn:           vi.fn(async () => {}),
  notifyGeofenceCheckOut:          vi.fn(async () => {}),
  notifyRecurringJobCreated:       vi.fn(async () => {}),
  notifyRecurringInvoiceCreated:   vi.fn(async () => {}),
  notifyInvoiceOverdue:            vi.fn(async () => {}),
  notifyQuoteExpiring:             vi.fn(async () => {}),
  notifyPaymentFailed:             vi.fn(async () => {}),
}));

vi.mock("../pushNotifications", () => ({
  notifyJobAssigned:           vi.fn(async () => {}),
  notifyJobUpdate:             vi.fn(async () => {}),
  notifyPaymentReceived:       vi.fn(async () => {}),
  notifyQuoteAccepted:         vi.fn(async () => {}),
  notifyQuoteRejected:         vi.fn(async () => {}),
  notifyTeamMessage:           vi.fn(async () => {}),
  notifyInvoiceOverdue:        vi.fn(async () => {}),
  notifySmsReceived:           vi.fn(async () => {}),
  notifyGeofenceEvent:         vi.fn(async () => {}),
  notifyExpenseApproved:       vi.fn(async () => {}),
  notifyExpenseRejected:       vi.fn(async () => {}),
  notifyTimesheetFeedback:     vi.fn(async () => {}),
  notifyNewLead:               vi.fn(async () => {}),
}));

vi.mock("../websocket", () => ({
  broadcastTimeEntryUpdate:         vi.fn(),
  broadcastJobStatusChange:         vi.fn(),
  broadcastToBusinessUsers:         vi.fn(),
  broadcastToUser:                  vi.fn(),
  broadcastTimerStart:              vi.fn(),
  broadcastTimerStop:               vi.fn(),
  broadcastActiveTimersUpdate:      vi.fn(),
  broadcastTimesheetActivity:       vi.fn(),
  broadcastChatMessage:             vi.fn(),
  broadcastChatPresence:            vi.fn(),
  broadcastReadReceipt:             vi.fn(),
  broadcastTeamChatMessage:         vi.fn(),
  broadcastJobUpdate:               vi.fn(),
  broadcastPaymentUpdate:           vi.fn(),
  broadcastToRoom:                  vi.fn(),
  broadcastTimerEvent:              vi.fn(),
  getConnectedUserCount:            vi.fn(() => 0),
  initializeWebSocket:              vi.fn(),
}));

vi.mock("../liveActivity",  () => ({
  broadcastLiveActivityUpdate: vi.fn(),
}));
vi.mock("../cache",         () => ({
  invalidateAggregateDashboard: vi.fn(),
  getFromCache:                 vi.fn(async () => null),
  setInCache:                   vi.fn(async () => {}),
  invalidateCacheKey:           vi.fn(async () => {}),
}));
vi.mock("../shared-financials", () => ({
  calculateDocumentTotals: vi.fn(() => ({ subtotal: 0, gst: 0, total: 0 })),
}));
vi.mock("../middleware/errorHandler", () => ({
  errorHandler:    (_: any, __: any, ___: any, next: any) => next(),
  notFoundHandler: (_: any, res: any) => res.status(404).json({ error: "Not found" }),
}));
vi.mock("../objectStorage", () => ({
  ObjectStorageService: vi.fn(() => ({
    uploadFile: vi.fn(async () => "/path/file"),
    getSignedUrl: vi.fn(async () => "https://example.com/file"),
  })),
}));
vi.mock("../routes/expenses", () => ({
  registerExpenseRoutes: vi.fn(),
}));

// ── App factory ───────────────────────────────────────────────────────────────

let app: express.Express;

async function buildApp() {
  if (app) return app;
  const { registerRoutes } = await import("../legacyRoutes");
  const a = express();
  a.use(express.json());
  await registerRoutes(a);
  app = a;
  return app;
}

// Build once before all tests (legacyRoutes is large — allow 30 s).
beforeAll(async () => { await buildApp(); }, 30_000);

// ── Shared fixtures ───────────────────────────────────────────────────────────

// Use a clearly past timestamp so the "start time cannot be in the future"
// guard never triggers regardless of the machine's real clock.
const PAST_START = "2020-06-15T08:00:00.000Z";

/** The job the worker is clocking into. */
const MOCK_JOB = {
  id:     JOB_ID,
  userId: OWNER_ID,
  status: "scheduled",
};

/**
 * Phases list returned by getJobPhases — does NOT contain BOGUS_PHASE_ID.
 * Only VALID_PHASE_ID is present, so any other value is unrecognised.
 */
const MOCK_PHASES_WITHOUT_BOGUS = [
  { id: VALID_PHASE_ID, jobId: JOB_ID, name: "Real Phase" },
];

// ── beforeEach ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Worker authenticated under OWNER_ID's business
  mockGetUserContext.mockResolvedValue({
    effectiveUserId: OWNER_ID,
    isOwner:         false,
    permissions:     [],
  });

  // No active timer — won't produce a 409
  mockGetActiveTimeEntry.mockResolvedValue(null);

  // Job belongs to this business
  mockGetJob.mockResolvedValue(MOCK_JOB);

  // Phases list does NOT include the bogus phaseId the caller will send
  mockGetJobPhases.mockResolvedValue(MOCK_PHASES_WITHOUT_BOGUS);

  // No rate overrides
  mockGetJobAssignments.mockResolvedValue([]);
  mockGetMember.mockResolvedValue(null);
  mockGetBusinessSettings.mockResolvedValue(null);

  // createTimeEntry should never be reached — configure it to throw so any
  // accidental call surfaces clearly in the test output.
  mockCreateTimeEntry.mockRejectedValue(
    new Error("createTimeEntry must not be called for an unrecognised phaseId"),
  );
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/time-entries — timer started with an unrecognised phaseId", () => {
  it("rejects the request with a 4xx status when phaseId is not in getJobPhases", async () => {
    const server = await buildApp();

    const res = await request(server)
      .post("/api/time-entries")
      .set("x-user-id", WORKER_ID)
      .send({
        jobId:        JOB_ID,
        phaseId:      BOGUS_PHASE_ID,
        description:  "timer with bogus phase",
        timeCategory: "work",
        startTime:    PAST_START,
      });

    // The route must refuse the request — a 2xx response would mean the
    // dangling phaseId was silently accepted.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("calls storage.getJobPhases to attempt phaseId validation", async () => {
    const server = await buildApp();

    await request(server)
      .post("/api/time-entries")
      .set("x-user-id", WORKER_ID)
      .send({
        jobId:        JOB_ID,
        phaseId:      BOGUS_PHASE_ID,
        description:  "timer with bogus phase",
        timeCategory: "work",
        startTime:    PAST_START,
      });

    // The validation branch must be entered — getJobPhases must be called
    expect(mockGetJobPhases).toHaveBeenCalled();
  });

  it("does NOT call storage.createTimeEntry when the phaseId is unrecognised", async () => {
    const server = await buildApp();

    // Reset to a plain mock so a spurious call is caught by the assertion
    // rather than causing an unhandled rejection.
    mockCreateTimeEntry.mockResolvedValue(undefined);

    await request(server)
      .post("/api/time-entries")
      .set("x-user-id", WORKER_ID)
      .send({
        jobId:        JOB_ID,
        phaseId:      BOGUS_PHASE_ID,
        description:  "timer with bogus phase",
        timeCategory: "work",
        startTime:    PAST_START,
      });

    // No DB write must occur for a dangling phaseId
    expect(mockCreateTimeEntry).not.toHaveBeenCalled();
  });
});
