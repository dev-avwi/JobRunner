/**
 * Tests for PATCH /api/jobs/:jobId/project-documents/:docId
 *
 * Verifies that the move-to-phase operation:
 *   1. Updates phaseId without wiping other document fields.
 *   2. Accepts null to move a document to "no phase".
 *   3. Rejects an unknown phaseId with 400.
 *   4. Returns 401 without an auth header.
 *   5. Returns 404 when the document doesn't belong to the caller.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Hoisted fixtures ──────────────────────────────────────────────────────────

/** Sentinel table objects — identity-compared by the db select mock. */
const STUB_PROJECT_DOCUMENTS = vi.hoisted(() => ({ _stub: "projectDocuments" }));
const STUB_JOB_PHASES        = vi.hoisted(() => ({ _stub: "jobPhases" }));

/**
 * Mutable slots reset per test so each case can configure its own response.
 * These are plain objects, not vi.fn(), so clearAllMocks never touches them.
 */
const mockState = vi.hoisted(() => ({
  docRow:       null as any,  // row returned by the document lookup select
  phaseRow:     null as any,  // row returned by phase validation (null → phase not found)
  updatedRow:   null as any,  // row returned by db.update().returning()
  capturedSet:  null as any,  // fields passed to db.update().set() — inspected in assertions
}));

// ── Chainable db mock ─────────────────────────────────────────────────────────

const mockDbReturning = vi.hoisted(() =>
  vi.fn(async () => [mockState.updatedRow]),
);
const mockDbUpdateWhere = vi.hoisted(() =>
  vi.fn(() => ({ returning: mockDbReturning })),
);
const mockDbSet = vi.hoisted(() =>
  vi.fn((fields: any) => {
    mockState.capturedSet = fields;
    return { where: mockDbUpdateWhere };
  }),
);
const mockDbUpdate = vi.hoisted(() =>
  vi.fn(() => ({ set: mockDbSet })),
);

/**
 * select(cols?).from(table).where(...) chain.
 * Return value depends on which table was passed to .from().
 */
const mockDbSelect = vi.hoisted(() =>
  vi.fn((_cols?: any) => ({
    from: (table: any) => ({
      where: vi.fn(async () => {
        if (table === STUB_PROJECT_DOCUMENTS) {
          return mockState.docRow ? [mockState.docRow] : [];
        }
        if (table === STUB_JOB_PHASES) {
          return mockState.phaseRow ? [mockState.phaseRow] : [];
        }
        return [];
      }),
    }),
  })),
);

// ── Module mocks ──────────────────────────────────────────────────────────────
// Paths are relative to THIS TEST FILE (src/__tests__/), not to jobs.ts.
// jobs.ts lives in src/routes/, so its "./middleware" → our "../routes/middleware".

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
  const multerFn: any = vi.fn(() => ({
    single: vi.fn(() => (_: any, __: any, next: any) => next()),
    array:  vi.fn(() => (_: any, __: any, next: any) => next()),
    fields: vi.fn(() => (_: any, __: any, next: any) => next()),
    none:   vi.fn(() => (_: any, __: any, next: any) => next()),
    any:    vi.fn(() => (_: any, __: any, next: any) => next()),
  }));
  multerFn.memoryStorage = vi.fn(() => ({}));
  return { default: multerFn };
});

// ../storage  — db is the mock chain above; storage is a stub.
vi.mock("../storage", () => ({
  storage: {},
  db: {
    select: (...args: any[]) => mockDbSelect(...args),
    update: (...args: any[]) => mockDbUpdate(...args),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(async () => []) })) })),
    delete: vi.fn(() => ({ where: vi.fn(async () => []) })),
    execute: vi.fn(async () => ({ rows: [] })),
    transaction: vi.fn(async (fn: any) => fn({
      select: (...a: any[]) => mockDbSelect(...a),
      update: (...a: any[]) => mockDbUpdate(...a),
    })),
  },
}));

vi.mock("@workspace/db", () => ({
  projectDocuments: STUB_PROJECT_DOCUMENTS,
  jobPhases:        STUB_JOB_PHASES,
  // The rest just need to be truthy/non-null stubs.
  db: {},
  jobDocuments: {}, jobMaterials: {}, jobEquipment: {}, equipment: {},
  equipmentCategories: {}, locationTracking: {}, tradieStatus: {},
  digitalSignatures: {}, users: {}, jobs: {}, invoices: {}, quotes: {},
  clients: {}, businessSettings: {}, businessTemplates: {}, teamMembers: {},
  teamMemberSkills: {}, teamMemberAvailability: {}, teamMemberTimeOff: {},
  teamMemberMetrics: {}, jobAssignmentRequests: {}, jobAssignments: {},
  timeEntries: {}, userRoles: {}, savedFilters: {}, timeEntryEdits: {},
  timeEntryDisputeEvents: {}, invoiceEdits: {}, invoiceReminderLogs: {},
  smsAutomationLogs: {}, smsAutomationRules: {}, jobReminders: {},
  automationLogs: {}, automations: {}, geofenceAlerts: {}, jobInvites: {},
  jobPhotos: {}, swmsDocuments: {}, swmsHazards: {}, swmsSignatures: {},
  customForms: {}, formSubmissions: {}, rateLimits: {}, smsMessages: {},
  smsConversations: {}, aiReceptionistCalls: {}, aiReceptionistConfig: {},
  leads: {}, errorLogs: {}, auditLogs: {}, systemEvents: {},
  websiteChangeRequests: {}, websiteAddons: {}, subcontractorTokens: {},
  subcontractorEvents: {}, subcontractorInvoices: {}, subcontractorInvoiceItems: {},
  numberPortRequests: {}, jobPhaseAssignments: {}, purchaseOrders: {},
  purchaseOrderItems: {}, claims: {}, claimLineItems: {}, tasks: {},
  idempotencyKeys: {}, inviteCodes: {},
  loginSchema: { parse: vi.fn() }, insertUserSchema: { parse: vi.fn() },
  requestLoginCodeSchema: { parse: vi.fn() }, verifyLoginCodeSchema: { parse: vi.fn() },
  insertBusinessSettingsSchema: {}, insertIntegrationSettingsSchema: {},
  insertNotificationSchema: {}, insertClientSchema: {}, insertJobSchema: {},
  insertQuoteSchema: {}, updateQuoteSchema: {}, insertQuoteLineItemSchema: {},
  insertInvoiceSchema: {}, updateInvoiceSchema: {}, insertInvoiceLineItemSchema: {},
  insertDocumentTemplateSchema: {}, insertLineItemCatalogSchema: {},
  insertRateCardSchema: {}, insertTimeEntrySchema: {}, insertTimesheetSchema: {},
  insertExpenseCategorySchema: {}, insertExpenseSchema: {},
  insertInventoryCategorySchema: {}, insertInventoryItemSchema: {},
  insertInventoryTransactionSchema: {}, insertSupplierSchema: {},
  insertPurchaseOrderSchema: {}, insertPurchaseOrderItemSchema: {},
  insertUserRoleSchema: {}, insertTeamMemberSchema: {}, insertStaffScheduleSchema: {},
  insertLocationTrackingSchema: {}, insertRouteSchema: {}, insertChecklistItemSchema: {},
  updateChecklistItemSchema: {}, insertJobChatSchema: {}, insertTeamChatSchema: {},
  insertSmsTemplateSchema: {}, insertBusinessTemplateSchema: {},
  updateBusinessTemplateSchema: {}, insertTeamPresenceSchema: {},
  insertActivityFeedSchema: {}, insertRecurringContractSchema: {},
  insertLeadSchema: {}, insertJobNoteSchema: {}, insertJobMaterialSchema: {},
  insertServiceReminderSchema: {}, insertEquipmentSchema: {},
  insertEquipmentCategorySchema: {}, insertEquipmentMaintenanceSchema: {},
  insertRebateSchema: {}, insertTeamGroupSchema: {}, insertJobInviteSchema: {},
  insertSubcontractorInvoiceSchema: {}, insertSubcontractorInvoiceItemSchema: {},
  insertNumberPortRequestSchema: {}, insertSavedFilterSchema: {},
  insertTimeEntryEditSchema: {}, insertGpsSignalLogSchema: {},
  ROLE_PRESETS: {}, BUSINESS_TEMPLATE_FAMILIES: [], PORT_REQUEST_STATUSES: [],
  isValidPurposeForFamily: vi.fn(() => true),
  getValidPurposesForFamily: vi.fn(() => []),
}));

vi.mock("drizzle-orm", () => ({
  eq:          (a: any, b: any) => ({ op: "eq", a, b }),
  and:         (...args: any[]) => ({ op: "and", args }),
  or:          (...args: any[]) => ({ op: "or", args }),
  sql:         (s: any) => s,
  desc:        (a: any) => a,
  asc:         (a: any) => a,
  gte:         (a: any, b: any) => ({ op: "gte", a, b }),
  lte:         (a: any, b: any) => ({ op: "lte", a, b }),
  lt:          (a: any, b: any) => ({ op: "lt", a, b }),
  isNotNull:   (a: any) => ({ op: "isNotNull", a }),
  isNull:      (a: any) => ({ op: "isNull", a }),
  inArray:     (a: any, b: any) => ({ op: "inArray", a, b }),
  count:       (a: any) => a,
  sum:         (a: any) => a,
  ne:          (a: any, b: any) => ({ op: "ne", a, b }),
  aliasedTable: (t: any, _a: string) => t,
}));

// ../permissions — all middleware passes through; getUserContext sets effectiveUserId.
vi.mock("../permissions", () => ({
  requireAuth:                vi.fn(),   // unused; we mock ./middleware's version below
  requireProSubscription:     vi.fn(),
  requirePaidTier:            vi.fn(),
  requirePaidTierForSms:      vi.fn(),
  ownerOnly:                  vi.fn(() => (_: any, __: any, next: any) => next()),
  ownerOrManagerOnly:         vi.fn(() => (_: any, __: any, next: any) => next()),
  requirePermission:          vi.fn(() => (_: any, __: any, next: any) => next()),
  requireTeamPlan:            vi.fn(() => (_: any, __: any, next: any) => next()),
  canAccessJobMedia:          vi.fn(async () => true),
  PERMISSIONS: {
    WRITE_JOBS:     "write_jobs",
    READ_JOBS:      "read_jobs",
    WRITE_EXPENSES: "write_expenses",
  },
  createPermissionMiddleware: vi.fn(() => (_: any, __: any, next: any) => next()),
  requireJobMediaAccess:      (_: any, __: any, next: any) => next(),
  getUserContext:             vi.fn(async (userId: string) => ({
    effectiveUserId: userId,
    userId,
    role: "owner",
  })),
  hasPermission:              vi.fn(() => true),
  canAssignJobTo:             vi.fn(async () => true),
  getWorkerPermissionContext: vi.fn(async () => ({})),
  sanitizeClientData:         vi.fn((data: any) => data),
  ownerHasTeamCapability:     vi.fn(async () => true),
  checkTeamSeatLimit:         vi.fn(async () => null),
}));

// IMPORTANT: path must be relative to THIS file, matching how jobs.ts resolves it.
// jobs.ts is in src/routes/ and does `import ... from "./middleware"` → src/routes/middleware.
// Our test is in src/__tests__/ so we mock `../routes/middleware`.
vi.mock("../routes/middleware", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const uid = req.headers["x-user-id"];
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    req.userId = uid;
    next();
  },
  requireProSubscription: (_: any, __: any, next: any) => next(),
  requirePaidTier:        vi.fn(() => (_: any, __: any, next: any) => next()),
  requirePaidTierForSms:  (_: any, __: any, next: any) => next(),
  requireDevelopment:     (_: any, __: any, next: any) => next(),
  authRateLimiter:        (_: any, __: any, next: any) => next(),
  passwordResetLimiter:   (_: any, __: any, next: any) => next(),
  paymentRateLimiter:     (_: any, __: any, next: any) => next(),
  messageSendLimiter:     (_: any, __: any, next: any) => next(),
  generalApiLimiter:      (_: any, __: any, next: any) => next(),
  setupOnboardingGuard:   (_: any, __: any, next: any) => next(),
  pdfPerUserLimiter:      (_: any, __: any, next: any) => next(),
  aiPerUserLimiter:       (_: any, __: any, next: any) => next(),
  visionPerUserLimiter:   (_: any, __: any, next: any) => next(),
  photoUploadPerUserLimiter:  (_: any, __: any, next: any) => next(),
  transcribePerUserLimiter:   (_: any, __: any, next: any) => next(),
  backpressureErrorHandler:   (_: any, __: any, next: any) => next(),
}));

vi.mock("../routes/helpers", () => ({
  dbCheckEnRouteNotif:              vi.fn(async () => {}),
  chatRateLimiterMiddleware:        (_: any, __: any, next: any) => next(),
  portalIpRateLimiterMiddleware:    (_: any, __: any, next: any) => next(),
  getIdempotencyRecord:             vi.fn(async () => null),
  setIdempotencyRecord:             vi.fn(async () => {}),
  logActivity:                      vi.fn(async () => {}),
  formatRelativeTime:               vi.fn(() => ""),
  normalizeAuPhone:                 vi.fn((p: any) => p),
  resolveAssigneeUserId:            vi.fn(async () => null),
  autoUpdateWorkerState:            vi.fn(async () => {}),
  gatherAIContext:                  vi.fn(async () => ({})),
  verifyInvoiceCalculation:         vi.fn(() => ({ ok: true })),
  validateAustralianCoords:         vi.fn(() => true),
  wasRecentlyNotifiedTeamJoinBlocked: vi.fn(async () => false),
  emailPaymentLinkCooldown:         vi.fn(async () => false),
  EMAIL_PAYMENT_LINK_COOLDOWN_MS:   3600000,
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
    createSession: vi.fn(async () => "token"),
  },
}));

vi.mock("../googleAuth",   () => ({ setupGoogleAuth:   vi.fn() }));
vi.mock("../xeroAuth",     () => ({ setupXeroAuth:     vi.fn() }));

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
}));

vi.mock("../activityService", () => ({
  logTeamActivity: vi.fn(async () => {}),
}));

vi.mock("../notifications", () => ({
  notifyQuoteSent: vi.fn(async () => {}),
  notifyInvoiceSent: vi.fn(async () => {}),
  notifyInvoicePaid: vi.fn(async () => {}),
  notifyJobScheduled: vi.fn(async () => {}),
  notifyJobStarted: vi.fn(async () => {}),
  notifyJobCompleted: vi.fn(async () => {}),
  notifyJobAssigned: vi.fn(async () => {}),
  notifyTeamMemberInvited: vi.fn(async () => {}),
  notifySmsReceived: vi.fn(async () => {}),
  notifyTimesheetSubmitted: vi.fn(async () => {}),
  notifyChatMessage: vi.fn(async () => {}),
  notifyQuoteAccepted: vi.fn(async () => {}),
  notifyQuoteRejected: vi.fn(async () => {}),
  notifyGeofenceCheckIn: vi.fn(async () => {}),
  notifyGeofenceCheckOut: vi.fn(async () => {}),
  notifyRecurringJobCreated: vi.fn(async () => {}),
  notifyRecurringInvoiceCreated: vi.fn(async () => {}),
  notifyInvoiceOverdue: vi.fn(async () => {}),
  notifyQuoteExpiring: vi.fn(async () => {}),
  notifyPaymentFailed: vi.fn(async () => {}),
}));

vi.mock("../pushNotifications", () => ({
  notifyJobAssigned: vi.fn(async () => {}),
  notifyJobUpdate: vi.fn(async () => {}),
  notifyPaymentReceived: vi.fn(async () => {}),
  notifyQuoteAccepted: vi.fn(async () => {}),
  notifyQuoteRejected: vi.fn(async () => {}),
  notifyTeamMessage: vi.fn(async () => {}),
  notifyInvoiceOverdue: vi.fn(async () => {}),
  notifySmsReceived: vi.fn(async () => {}),
  notifyGeofenceEvent: vi.fn(async () => {}),
  notifyTimesheetSubmitted: vi.fn(async () => {}),
  notifyQuoteExpiring: vi.fn(async () => {}),
  notifyPaymentFailed: vi.fn(async () => {}),
  notifyTrialExpiring: vi.fn(async () => {}),
  notifyTimesheetDisputeFiled: vi.fn(async () => {}),
  notifyTimesheetDisputeResolved: vi.fn(async () => {}),
  notifyJobNudge: vi.fn(async () => {}),
  notifyNudgeResponse: vi.fn(async () => {}),
}));

vi.mock("../emailIntegrationService", () => ({
  getEmailIntegration:      vi.fn(async () => null),
  getGmailConnectionStatus: vi.fn(async () => null),
}));

vi.mock("../stripeClient", () => ({
  getUncachableStripeClient: vi.fn(() => null),
  getStripePublishableKey:   vi.fn(() => null),
  isStripeInitialized:       vi.fn(() => false),
}));

vi.mock("../twilioClient", () => ({
  checkTwilioAvailability: vi.fn(async () => false),
  sendSMS:                 vi.fn(async () => null),
  validateTwilioWebhook:   vi.fn(() => true),
}));

vi.mock("../geocoding", () => ({
  geocodeAddress:    vi.fn(async () => null),
  haversineDistance: vi.fn(() => 0),
  calculateRouteETA: vi.fn(async () => null),
}));

vi.mock("../automationService", () => ({
  processStatusChangeAutomation:    vi.fn(async () => {}),
  processPaymentReceivedAutomation: vi.fn(async () => {}),
  processTimeBasedAutomations:      vi.fn(async () => {}),
}));

vi.mock("../xeroService",       () => ({ getXeroClient: vi.fn(async () => null) }));
vi.mock("../myobService",       () => ({}));
vi.mock("../quickbooksService", () => ({}));

vi.mock("../urlHelper", () => ({
  getProductionBaseUrl: vi.fn(() => "http://localhost"),
  getQuotePublicUrl:    vi.fn(() => ""),
  getInvoicePublicUrl:  vi.fn(() => ""),
  getReceiptPublicUrl:  vi.fn(() => ""),
}));

vi.mock("../emailTemplates", () => ({
  generateQuoteEmailTemplate:   vi.fn(() => ""),
  generateInvoiceEmailTemplate: vi.fn(() => ""),
}));

vi.mock("../notificationService", () => ({
  notifyOwnerViaSms:   vi.fn(async () => {}),
  notifyOwnerViaEmail: vi.fn(async () => {}),
}));

vi.mock("../systemEventService", () => ({ logSystemEvent: vi.fn(async () => {}) }));

vi.mock("../phaseExpenseAttribution", () => ({
  allocateExpensesByPhase: vi.fn(() => ({ byPhaseId: new Map(), unallocated: 0 })),
}));

vi.mock("../shared-financials", () => ({
  calculateDocumentTotals: vi.fn(() => ({})),
  reverseTaxCalculation:   vi.fn(() => ({})),
}));

vi.mock("../objectStorage", () => ({
  ObjectStorageService: vi.fn(() => ({
    uploadFile:   vi.fn(),
    downloadFile: vi.fn(),
  })),
  ObjectNotFoundError:  class ObjectNotFoundError extends Error {},
  objectStorageClient:  {
    bucket: vi.fn(() => ({
      file: vi.fn(() => ({
        getSignedUrl: vi.fn(async () => [""]),
      })),
    })),
  },
  parseObjectPath: vi.fn((p: string) => ({ bucketName: "b", objectName: p })),
}));

vi.mock("../tradieTemplates", () => ({
  tradieQuoteTemplates: {},
  tradieLineItems:      {},
  tradieRateCards:      {},
}));

vi.mock("../safetyTemplates", () => ({
  getSafetyFormTemplates: vi.fn(async () => []),
  getSafetyFormTemplate:  vi.fn(async () => null),
}));

vi.mock("../taskRules", () => ({ evaluateTaskRules: vi.fn(async () => []) }));

vi.mock("../ai", () => ({
  generateAISuggestions: vi.fn(async () => []),
  chatWithAI:            vi.fn(async () => ""),
  analyzeReceipt:        vi.fn(async () => null),
  detectHazards:         vi.fn(async () => []),
}));

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports (after all mocks) ─────────────────────────────────────────────────

import { registerJobsRoutes } from "../routes/jobs";

// ── Shared test fixtures ──────────────────────────────────────────────────────

const OWNER_ID = "user-owner-1";
const JOB_ID   = "job-abc";
const DOC_ID   = "doc-xyz";
const PHASE_A  = "phase-a";
const PHASE_B  = "phase-b";

/** A full document row with every field populated. */
const BASE_DOC = {
  id:              DOC_ID,
  jobId:           JOB_ID,
  userId:          OWNER_ID,
  title:           "Contract Drawings",
  category:        "drawings",
  isClientVisible: true,
  phaseId:         PHASE_A,
  createdAt:       new Date("2024-01-01T00:00:00.000Z"),
  updatedAt:       new Date("2024-01-01T00:00:00.000Z"),
};

function authHeaders(userId = OWNER_ID) {
  return { "x-user-id": userId };
}

// ── App factory ───────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());

  const passThrough = (_: any, __: any, next: any) => next();
  const multerStub = () => ({
    single: () => passThrough,
    array:  () => passThrough,
    fields: () => passThrough,
    none:   () => passThrough,
    any:    () => passThrough,
  });

  const stubDeps: any = {
    trackingTokens:       new Map(),
    buildProofPackData:   vi.fn(async () => ({})),
    sitePhotoCache:       new Map(),
    upload:               multerStub() as any,
    getJobWithChatAccess: vi.fn(async () => null),
    chatUpload:           multerStub() as any,
  };

  registerJobsRoutes(app, stubDeps);
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PATCH /api/jobs/:jobId/project-documents/:docId — phase move", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();

    // Defaults: document exists, phase B exists, update succeeds.
    mockState.docRow     = { ...BASE_DOC };
    mockState.phaseRow   = { id: PHASE_B };
    mockState.updatedRow = { ...BASE_DOC, phaseId: PHASE_B };
    mockState.capturedSet = null;
  });

  // ── Authentication ────────────────────────────────────────────────────────

  it("returns 401 when no auth header is provided", async () => {
    const res = await request(app)
      .patch(`/api/jobs/${JOB_ID}/project-documents/${DOC_ID}`)
      .send({ phaseId: PHASE_B });

    expect(res.status).toBe(401);
  });

  // ── Move to a different phase ─────────────────────────────────────────────

  it("changes phaseId and leaves all other fields untouched", async () => {
    const res = await request(app)
      .patch(`/api/jobs/${JOB_ID}/project-documents/${DOC_ID}`)
      .set(authHeaders())
      .send({ phaseId: PHASE_B });

    expect(res.status).toBe(200);

    // The update payload must contain only phaseId and updatedAt — never
    // title, category, or isClientVisible, which the client did not send.
    expect(mockState.capturedSet).toHaveProperty("phaseId", PHASE_B);
    expect(mockState.capturedSet).not.toHaveProperty("title");
    expect(mockState.capturedSet).not.toHaveProperty("category");
    expect(mockState.capturedSet).not.toHaveProperty("isClientVisible");

    // Response body reflects the updated row.
    expect(res.body).toMatchObject({
      id:              DOC_ID,
      phaseId:         PHASE_B,
      title:           BASE_DOC.title,
      category:        BASE_DOC.category,
      isClientVisible: BASE_DOC.isClientVisible,
    });
  });

  // ── Move to null (no phase) ───────────────────────────────────────────────

  it("sets phaseId to null and leaves all other fields untouched", async () => {
    mockState.docRow     = { ...BASE_DOC, phaseId: PHASE_A };
    mockState.updatedRow = { ...BASE_DOC, phaseId: null };

    const res = await request(app)
      .patch(`/api/jobs/${JOB_ID}/project-documents/${DOC_ID}`)
      .set(authHeaders())
      .send({ phaseId: null });

    expect(res.status).toBe(200);

    // phaseId must be explicitly null in the DB update.
    expect(mockState.capturedSet).toHaveProperty("phaseId", null);
    expect(mockState.capturedSet).not.toHaveProperty("title");
    expect(mockState.capturedSet).not.toHaveProperty("category");
    expect(mockState.capturedSet).not.toHaveProperty("isClientVisible");

    expect(res.body).toMatchObject({
      phaseId:         null,
      title:           BASE_DOC.title,
      category:        BASE_DOC.category,
      isClientVisible: BASE_DOC.isClientVisible,
    });
  });

  // ── Move with an unknown phase ────────────────────────────────────────────

  it("returns 400 when phaseId does not belong to this job", async () => {
    // Phase lookup returns nothing — unknown phase.
    mockState.phaseRow = null;

    const res = await request(app)
      .patch(`/api/jobs/${JOB_ID}/project-documents/${DOC_ID}`)
      .set(authHeaders())
      .send({ phaseId: "unknown-phase" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Invalid phase ID for this job" });

    // db.update must NOT have been called.
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  // ── Document not found ────────────────────────────────────────────────────

  it("returns 404 when the document doesn't exist for this job/user", async () => {
    mockState.docRow = null;

    const res = await request(app)
      .patch(`/api/jobs/${JOB_ID}/project-documents/${DOC_ID}`)
      .set(authHeaders())
      .send({ phaseId: PHASE_B });

    expect(res.status).toBe(404);
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  // ── Moving preserves isClientVisible flag ─────────────────────────────────

  it("does not change isClientVisible when only phaseId is sent", async () => {
    mockState.docRow     = { ...BASE_DOC, isClientVisible: false };
    mockState.updatedRow = { ...BASE_DOC, isClientVisible: false, phaseId: PHASE_B };

    const res = await request(app)
      .patch(`/api/jobs/${JOB_ID}/project-documents/${DOC_ID}`)
      .set(authHeaders())
      .send({ phaseId: PHASE_B });

    expect(res.status).toBe(200);
    expect(mockState.capturedSet).not.toHaveProperty("isClientVisible");
    expect(res.body).toMatchObject({ isClientVisible: false, phaseId: PHASE_B });
  });

  // ── Visibility update doesn't discard phaseId ────────────────────────────

  it("does not touch phaseId when only isClientVisible is sent", async () => {
    mockState.updatedRow = { ...BASE_DOC, isClientVisible: false };

    const res = await request(app)
      .patch(`/api/jobs/${JOB_ID}/project-documents/${DOC_ID}`)
      .set(authHeaders())
      .send({ isClientVisible: false });

    expect(res.status).toBe(200);
    // phaseId must NOT appear in the update set (not touched).
    expect(mockState.capturedSet).not.toHaveProperty("phaseId");
    expect(mockState.capturedSet).toHaveProperty("isClientVisible", false);
  });

  // ── Validation ────────────────────────────────────────────────────────────

  it("returns 400 when the request body is empty (no fields provided)", async () => {
    const res = await request(app)
      .patch(`/api/jobs/${JOB_ID}/project-documents/${DOC_ID}`)
      .set(authHeaders())
      .send({});

    expect(res.status).toBe(400);
  });
});
