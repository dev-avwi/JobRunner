/**
 * timeEntryPatchRoute.test.ts
 *
 * HTTP-level regression guard for PATCH /api/time-entries/:id with focus on the
 * new business-owner tenant isolation for job-less (travel/admin/training/other) entries.
 *
 * Verifies:
 *   1. Cross-business edit denial: a manager in Business A cannot edit a
 *      worker's job-less entry stamped businessOwnerId = Business B → 404.
 *   2. Same-business edit allowed: a manager in Business A CAN edit a worker's
 *      job-less entry stamped businessOwnerId = Business A → 200.
 *   3. Job→non-job conversion: clearing jobId stamps businessOwnerId from context.
 *   4. Non-job→job conversion: setting jobId clears businessOwnerId (null).
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import express from "express";
import request from "supertest";

// ── Constants ──────────────────────────────────────────────────────────────────

const OWNER_A  = "biz-a-owner";
const OWNER_B  = "biz-b-owner";
const MANAGER  = "manager-user";  // manager of Business A
const WORKER   = "worker-user";   // belongs to both A and B
const ENTRY_ID = "te-job-less-1";
const JOB_ID   = "job-xyz";

// ── Hoisted mutable state ─────────────────────────────────────────────────────

const mockGetTimeEntry      = vi.hoisted(() => vi.fn());
const mockGetTimeEntryAny   = vi.hoisted(() => vi.fn());
const mockGetMember         = vi.hoisted(() => vi.fn());
const mockUpdateTimeEntry   = vi.hoisted(() => vi.fn());
const mockCreateTimeEntryEdit = vi.hoisted(() => vi.fn());
const mockGetJob            = vi.hoisted(() => vi.fn());
const mockGetJobAssignments = vi.hoisted(() => vi.fn());
const mockGetActiveTimeEntry = vi.hoisted(() => vi.fn());
const mockGetUserContext    = vi.hoisted(() => vi.fn());

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
    getTimeEntry:                       (...a: any[]) => mockGetTimeEntry(...a),
    getTimeEntryAny:                    (...a: any[]) => mockGetTimeEntryAny(...a),
    getTeamMemberByOwnerAndMemberId:    (...a: any[]) => mockGetMember(...a),
    updateTimeEntry:                    (...a: any[]) => mockUpdateTimeEntry(...a),
    createTimeEntryEdit:                (...a: any[]) => mockCreateTimeEntryEdit(...a),
    getJob:                             (...a: any[]) => mockGetJob(...a),
    getJobAssignments:                  (...a: any[]) => mockGetJobAssignments(...a),
    getActiveTimeEntry:                 (...a: any[]) => mockGetActiveTimeEntry(...a),
    // Other methods used by surrounding routes — return safe defaults
    getUser:                            vi.fn(async () => null),
    getTeamMembers:                     vi.fn(async () => []),
    getBusinessSettings:                vi.fn(async () => null),
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
  // Chainable Zod-like schema stub — .parse() passes data through unchanged.
  // Must be defined inside the factory because vi.mock is hoisted.
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
    // ── Schemas (all need at least .parse + .partial + .omit) ──────────────
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
    // ── Tables ──────────────────────────────────────────────────────────────
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
    // ── Constants / helpers ──────────────────────────────────────────────────
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
  businessLocalDate:            vi.fn(() => "2026-09-11"),
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/** A job-less entry owned by OWNER_B (worker is in both businesses). */
const ENTRY_IN_BIZ_B = {
  id:              ENTRY_ID,
  userId:          WORKER,
  jobId:           null,
  timeCategory:    "travel",
  businessOwnerId: OWNER_B,
  startTime:       new Date("2026-09-11T08:00:00Z"),
  endTime:         new Date("2026-09-11T10:00:00Z"),
  duration:        120,
};

/** Same entry but owned by OWNER_A. */
const ENTRY_IN_BIZ_A = { ...ENTRY_IN_BIZ_B, businessOwnerId: OWNER_A };

/** A job-linked entry (businessOwnerId null — pre-stamp). */
const JOB_LINKED_ENTRY = {
  id:              "te-job-1",
  userId:          WORKER,
  jobId:           JOB_ID,
  timeCategory:    "work",
  businessOwnerId: null,
  startTime:       new Date("2026-09-11T08:00:00Z"),
  endTime:         new Date("2026-09-11T10:00:00Z"),
  duration:        120,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateTimeEntryEdit.mockResolvedValue({});
  mockGetJobAssignments.mockResolvedValue([]);
  mockGetActiveTimeEntry.mockResolvedValue(null);
  mockGetMember.mockResolvedValue(null);
});

describe("PATCH /api/time-entries/:id — cross-business tenant isolation", () => {
  it("denies a manager editing a worker's job-less entry from another business (businessOwnerId mismatch)", async () => {
    // MANAGER is an owner/manager of Business A
    mockGetUserContext.mockResolvedValue({
      effectiveUserId: OWNER_A,
      isOwner:         false,
      permissions:     ["manage_team"],
    });
    // The entry is NOT the manager's own (getTimeEntry returns null)
    mockGetTimeEntry.mockResolvedValue(null);
    // The entry exists but belongs to Business B
    mockGetTimeEntryAny.mockResolvedValue(ENTRY_IN_BIZ_B);

    const server = await buildApp();
    const res = await request(server)
      .patch(`/api/time-entries/${ENTRY_ID}`)
      .set("x-user-id", MANAGER)
      .send({ description: "cross-tenant attack" });

    // Must be 404 — the entry is not visible in this business context
    expect(res.status).toBe(404);
    expect(mockUpdateTimeEntry).not.toHaveBeenCalled();
  });

  it("allows a manager to edit a worker's job-less entry from the SAME business", async () => {
    mockGetUserContext.mockResolvedValue({
      effectiveUserId: OWNER_A,
      isOwner:         true,
      permissions:     ["manage_team"],
    });
    mockGetTimeEntry.mockResolvedValue(null);
    // Entry is owned by Business A — same as manager's context
    mockGetTimeEntryAny.mockResolvedValue(ENTRY_IN_BIZ_A);
    mockUpdateTimeEntry.mockResolvedValue({ ...ENTRY_IN_BIZ_A, description: "updated" });

    const server = await buildApp();
    const res = await request(server)
      .patch(`/api/time-entries/${ENTRY_ID}`)
      .set("x-user-id", MANAGER)
      .send({ description: "legitimate edit" });

    expect(res.status).toBe(200);
    expect(mockUpdateTimeEntry).toHaveBeenCalled();
  });
});

describe("PATCH /api/time-entries/:id — businessOwnerId consistency on jobId change", () => {
  it("stamps businessOwnerId when jobId is cleared (job→non-job conversion)", async () => {
    // Manager editing their own job-linked entry and clearing the job
    mockGetUserContext.mockResolvedValue({
      effectiveUserId: OWNER_A,
      isOwner:         true,
      permissions:     [],
    });
    // Self-edit path: getTimeEntry returns the entry directly
    mockGetTimeEntry.mockResolvedValue(JOB_LINKED_ENTRY);
    const updated = { ...JOB_LINKED_ENTRY, jobId: null, businessOwnerId: OWNER_A };
    mockUpdateTimeEntry.mockResolvedValue(updated);

    const server = await buildApp();
    const res = await request(server)
      .patch(`/api/time-entries/${JOB_LINKED_ENTRY.id}`)
      .set("x-user-id", WORKER)
      .send({ jobId: null, timeCategory: "travel" });

    expect(res.status).toBe(200);
    // The update call must carry businessOwnerId stamped from effectiveUserId
    const updateArgs = mockUpdateTimeEntry.mock.calls[0];
    expect(updateArgs[2]).toMatchObject({ businessOwnerId: OWNER_A });
  });

  it("clears businessOwnerId when a jobId is assigned (non-job→job conversion)", async () => {
    mockGetUserContext.mockResolvedValue({
      effectiveUserId: OWNER_A,
      isOwner:         true,
      permissions:     [],
    });
    // Entry currently has no job but has a businessOwnerId stamp
    mockGetTimeEntry.mockResolvedValue(ENTRY_IN_BIZ_A);
    // Job ownership check passes
    mockGetJob.mockResolvedValue({ id: JOB_ID, userId: OWNER_A, status: "in_progress" });
    mockUpdateTimeEntry.mockResolvedValue({ ...ENTRY_IN_BIZ_A, jobId: JOB_ID, businessOwnerId: null });

    const server = await buildApp();
    const res = await request(server)
      .patch(`/api/time-entries/${ENTRY_IN_BIZ_A.id}`)
      .set("x-user-id", WORKER)
      .send({ jobId: JOB_ID });

    expect(res.status).toBe(200);
    // businessOwnerId must be null — tenant now derived through the job
    const updateArgs = mockUpdateTimeEntry.mock.calls[0];
    expect(updateArgs[2]).toMatchObject({ businessOwnerId: null });
  });
});
