/**
 * unassignedPhasesEndpoint.test.ts
 *
 * Integration-style tests for GET /api/phases/unassigned that exercise the
 * REAL registerJobsRoutes handler (not a hand-rolled mock route).
 *
 * The database is replaced with a chainable stub that:
 *  - Captures the predicate argument passed to `.where()` so we can inspect it
 *  - Returns configurable phase rows from `.orderBy()` (the terminal step)
 *
 * The drizzle-orm operators are mocked to return plain objects, making the
 * captured predicate tree introspectable. Each test then asserts that the
 * WHERE clause contains the correct filtering predicates. If either
 * isNull(jobPhases.assignedUserId) or isNull(jobPhaseAssignments.phaseId) is
 * removed from the production endpoint, the corresponding assertion fails.
 *
 * Covers (required by task #1297):
 *  1. A phase with no assignments is returned by the endpoint.
 *  2. The WHERE clause includes isNull(jobPhaseAssignments.phaseId) — phases
 *     with a join-table row are excluded via this predicate.
 *  3. The WHERE clause includes isNull(jobPhases.assignedUserId) — phases with
 *     only a legacy field are excluded via this predicate.
 *  4. The WHERE clause includes job-status NOT IN ('done','invoiced','cancelled')
 *     — terminal-status jobs are excluded via this predicate.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── Column-identifier sentinels ───────────────────────────────────────────────
// These string constants become the "column" values on the stub table objects.
// When the production code does isNull(jobPhases.assignedUserId), the mocked
// isNull() receives the sentinel string and returns { op:'isNull', a: SENTINEL }.
// Checking for the sentinel in the captured predicate tree is what makes each
// test fail if the corresponding WHERE predicate is removed.
//
// MUST use vi.hoisted() because vi.mock() factories are hoisted before const
// declarations, so plain `const` values are not yet initialized when the
// @workspace/db mock factory runs.

const {
  JP_ASSIGNED_USER_ID,
  JP_STATUS,
  JP_USER_ID,
  JP_ID,
  JP_JOB_ID,
  JP_PHASE_CODE,
  JP_NAME,
  JP_DESCRIPTION,
  JP_SCHEDULED_START,
  JP_SCHEDULED_END,
  JP_SORT_ORDER,
  JPA_PHASE_ID,
  JPA_USER_ID,
  J_ID,
  J_TITLE,
  J_STATUS,
  J_ARCHIVED_AT,
} = vi.hoisted(() => ({
  JP_ASSIGNED_USER_ID: '__JP.assignedUserId__',
  JP_STATUS:           '__JP.status__',
  JP_USER_ID:          '__JP.userId__',
  JP_ID:               '__JP.id__',
  JP_JOB_ID:           '__JP.jobId__',
  JP_PHASE_CODE:       '__JP.phaseCode__',
  JP_NAME:             '__JP.name__',
  JP_DESCRIPTION:      '__JP.description__',
  JP_SCHEDULED_START:  '__JP.scheduledStart__',
  JP_SCHEDULED_END:    '__JP.scheduledEnd__',
  JP_SORT_ORDER:       '__JP.sortOrder__',
  JPA_PHASE_ID:        '__JPA.phaseId__',
  JPA_USER_ID:         '__JPA.userId__',
  J_ID:                '__J.id__',
  J_TITLE:             '__J.title__',
  J_STATUS:            '__J.status__',
  J_ARCHIVED_AT:       '__J.archivedAt__',
}));

// ── Hoisted mock state ────────────────────────────────────────────────────────

/**
 * `capturedWhere` records the predicate object passed to the db chain's
 * `.where()` call on each request. Inspect this in assertions.
 */
const capturedWhere = vi.hoisted(() => ({ value: null as any }));

/**
 * `mockPhaseRows` is what the db chain returns from `.orderBy()`. Set this in
 * each test to control what the endpoint finds as "unassigned phases".
 */
const mockPhaseRows = vi.hoisted(() => ({ value: [] as any[] }));

// ── Chainable db select mock ──────────────────────────────────────────────────
// Intercepts db.select().from().innerJoin().leftJoin().where().orderBy()

const mockOrderBy = vi.hoisted(() =>
  vi.fn(async () => mockPhaseRows.value),
);

const mockWhere = vi.hoisted(() =>
  vi.fn((...args: any[]) => {
    capturedWhere.value = args[0]; // and(...) produces a single composite arg
    return { orderBy: mockOrderBy };
  }),
);

const mockLeftJoin = vi.hoisted(() =>
  vi.fn(() => ({ where: mockWhere })),
);

const mockInnerJoin = vi.hoisted(() =>
  vi.fn(() => ({ leftJoin: mockLeftJoin })),
);

const mockFrom = vi.hoisted(() =>
  vi.fn(() => ({ innerJoin: mockInnerJoin })),
);

const mockSelect = vi.hoisted(() =>
  vi.fn(() => ({ from: mockFrom })),
);

const mockGetTeamMembers = vi.hoisted(() => vi.fn(async () => []));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  withScope: vi.fn(),
  Handlers: { requestHandler: () => (_: any, __: any, next: any) => next() },
}));

vi.mock('jsonwebtoken', () => ({
  default: { sign: vi.fn(), verify: vi.fn(), decode: vi.fn() },
  sign: vi.fn(), verify: vi.fn(), decode: vi.fn(),
}));

vi.mock('express-rate-limit', () => ({
  default: vi.fn(() => (_: any, __: any, next: any) => next()),
}));

vi.mock('multer', () => {
  const multerFn: any = vi.fn(() => ({
    single:  vi.fn(() => (_: any, __: any, next: any) => next()),
    array:   vi.fn(() => (_: any, __: any, next: any) => next()),
    fields:  vi.fn(() => (_: any, __: any, next: any) => next()),
    none:    vi.fn(() => (_: any, __: any, next: any) => next()),
    any:     vi.fn(() => (_: any, __: any, next: any) => next()),
  }));
  multerFn.memoryStorage = vi.fn(() => ({}));
  return { default: multerFn };
});

vi.mock('../storage', () => ({
  storage: {
    getTeamMembers: (...args: any[]) => mockGetTeamMembers(...args),
  },
  db: {
    select:      (...args: any[]) => mockSelect(...args),
    insert:      vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(async () => []) })) })),
    update:      vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => []) })) })),
    delete:      vi.fn(() => ({ where: vi.fn(async () => []) })),
    execute:     vi.fn(async () => ({ rows: [] })),
    transaction: vi.fn(async (fn: any) => fn({
      select: (...a: any[]) => mockSelect(...a),
      insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(async () => []) })) })),
    })),
  },
}));

// The @workspace/db table stubs use the sentinel strings as column identifiers.
// The production query references e.g. jobPhases.assignedUserId — with the stub,
// that resolves to the JP_ASSIGNED_USER_ID sentinel, which ends up inside the
// isNull() call and is later inspectable in capturedWhere.
vi.mock('@workspace/db', () => ({
  jobPhases: {
    id:             JP_ID,
    jobId:          JP_JOB_ID,
    phaseCode:      JP_PHASE_CODE,
    name:           JP_NAME,
    description:    JP_DESCRIPTION,
    scheduledStart: JP_SCHEDULED_START,
    scheduledEnd:   JP_SCHEDULED_END,
    status:         JP_STATUS,
    sortOrder:      JP_SORT_ORDER,
    assignedUserId: JP_ASSIGNED_USER_ID,
    userId:         JP_USER_ID,
  },
  jobPhaseAssignments: {
    phaseId: JPA_PHASE_ID,
    userId:  JPA_USER_ID,
  },
  jobs: {
    id:         J_ID,
    title:      J_TITLE,
    status:     J_STATUS,
    archivedAt: J_ARCHIVED_AT,
  },
  // ── Schema stubs (non-table exports) ──────────────────────────────────────
  // All remaining @workspace/db exports that jobs.ts imports; must be present
  // or the module import will throw.
  jobDocuments: {}, jobMaterials: {}, jobEquipment: {}, equipment: {},
  equipmentCategories: {}, locationTracking: {}, tradieStatus: {},
  digitalSignatures: {}, users: {}, invoices: {}, quotes: {}, clients: {},
  businessSettings: {}, businessTemplates: {}, teamMembers: {},
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
  numberPortRequests: {}, purchaseOrders: {}, purchaseOrderItems: {},
  claims: {}, claimLineItems: {}, tasks: {}, idempotencyKeys: {}, inviteCodes: {},
  loginSchema:                  { parse: vi.fn() },
  insertUserSchema:             { parse: vi.fn() },
  requestLoginCodeSchema:       { parse: vi.fn() },
  verifyLoginCodeSchema:        { parse: vi.fn() },
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

// drizzle-orm operators return inspectable plain objects so the captured WHERE
// tree can be traversed in test assertions.
vi.mock('drizzle-orm', () => ({
  eq:           (a: any, b: any)    => ({ op: 'eq',       a, b }),
  and:          (...args: any[])    => ({ op: 'and',      args }),
  or:           (...args: any[])    => ({ op: 'or',       args }),
  // sql tagged-template: return an object recording the field sentinel and the
  // raw SQL text, enabling assertions on the NOT IN predicates.
  sql:          (parts: any, ...vals: any[]) => ({
    op: 'sql',
    field: vals[0],
    text: Array.isArray(parts) ? parts.join('') : String(parts),
  }),
  desc:         (a: any)            => ({ op: 'desc',     a }),
  asc:          (a: any)            => ({ op: 'asc',      a }),
  gte:          (a: any, b: any)    => ({ op: 'gte',      a, b }),
  lte:          (a: any, b: any)    => ({ op: 'lte',      a, b }),
  lt:           (a: any, b: any)    => ({ op: 'lt',       a, b }),
  isNotNull:    (a: any)            => ({ op: 'isNotNull', a }),
  isNull:       (a: any)            => ({ op: 'isNull',   a }),
  inArray:      (a: any, b: any)    => ({ op: 'inArray',  a, b }),
  count:        (a: any)            => a,
  sum:          (a: any)            => a,
  ne:           (a: any, b: any)    => ({ op: 'ne',       a, b }),
  aliasedTable: (t: any, _a: string) => t,
}));

vi.mock('../permissions', () => ({
  requireAuth:                vi.fn(),
  requireProSubscription:     vi.fn(),
  requirePaidTier:            vi.fn(),
  requirePaidTierForSms:      vi.fn(),
  ownerOnly:                  vi.fn(() => (_: any, __: any, next: any) => next()),
  ownerOrManagerOnly:         vi.fn(() => (_: any, __: any, next: any) => next()),
  requirePermission:          vi.fn(() => (_: any, __: any, next: any) => next()),
  requireTeamPlan:            vi.fn(() => (_: any, __: any, next: any) => next()),
  canAccessJobMedia:          vi.fn(async () => true),
  PERMISSIONS: {
    WRITE_JOBS:     'write_jobs',
    READ_JOBS:      'read_jobs',
    WRITE_EXPENSES: 'write_expenses',
  },
  createPermissionMiddleware: vi.fn(() => (_: any, __: any, next: any) => next()),
  requireJobMediaAccess:      (_: any, __: any, next: any) => next(),
  getUserContext:             vi.fn(async (userId: string) => ({
    effectiveUserId: userId, userId, role: 'owner',
  })),
  hasPermission:              vi.fn(() => true),
  canAssignJobTo:             vi.fn(async () => true),
  getWorkerPermissionContext: vi.fn(async () => ({})),
  sanitizeClientData:         vi.fn((data: any) => data),
  ownerHasTeamCapability:     vi.fn(async () => true),
  checkTeamSeatLimit:         vi.fn(async () => null),
}));

vi.mock('../routes/middleware', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const uid = req.headers['x-user-id'];
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    req.userId = uid;
    next();
  },
  requireProSubscription:       (_: any, __: any, next: any) => next(),
  requirePaidTier:              vi.fn(() => (_: any, __: any, next: any) => next()),
  requirePaidTierForSms:        (_: any, __: any, next: any) => next(),
  requireDevelopment:           (_: any, __: any, next: any) => next(),
  authRateLimiter:              (_: any, __: any, next: any) => next(),
  passwordResetLimiter:         (_: any, __: any, next: any) => next(),
  paymentRateLimiter:           (_: any, __: any, next: any) => next(),
  messageSendLimiter:           (_: any, __: any, next: any) => next(),
  generalApiLimiter:            (_: any, __: any, next: any) => next(),
  setupOnboardingGuard:         (_: any, __: any, next: any) => next(),
  pdfPerUserLimiter:            (_: any, __: any, next: any) => next(),
  aiPerUserLimiter:             (_: any, __: any, next: any) => next(),
  visionPerUserLimiter:         (_: any, __: any, next: any) => next(),
  photoUploadPerUserLimiter:    (_: any, __: any, next: any) => next(),
  transcribePerUserLimiter:     (_: any, __: any, next: any) => next(),
  backpressureErrorHandler:     (_: any, __: any, next: any) => next(),
}));

vi.mock('../routes/helpers', () => ({
  dbCheckEnRouteNotif:                vi.fn(async () => {}),
  chatRateLimiterMiddleware:          (_: any, __: any, next: any) => next(),
  portalIpRateLimiterMiddleware:      (_: any, __: any, next: any) => next(),
  getIdempotencyRecord:               vi.fn(async () => null),
  setIdempotencyRecord:               vi.fn(async () => {}),
  logActivity:                        vi.fn(async () => {}),
  formatRelativeTime:                 vi.fn(() => ''),
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

vi.mock('../routes/retentionSummary', () => ({
  computeRetentionSummary: vi.fn(async () => ({})),
}));

vi.mock('../concurrency', () => ({
  isBackpressure: vi.fn(() => false),
  send429:        vi.fn(),
  aiQueue:        { add: vi.fn(async (fn: any) => fn()) },
}));

vi.mock('../auth', () => ({
  AuthService: {
    getUserById:   vi.fn(async () => null),
    verifyToken:   vi.fn(async () => null),
    createSession: vi.fn(async () => 'token'),
  },
}));

vi.mock('../googleAuth',   () => ({ setupGoogleAuth:   vi.fn() }));
vi.mock('../xeroAuth',     () => ({ setupXeroAuth:     vi.fn() }));

vi.mock('../emailService', () => ({
  sendEmailVerificationEmail:         vi.fn(async () => {}),
  sendLoginCodeEmail:                 vi.fn(async () => {}),
  sendJobConfirmationEmail:           vi.fn(async () => {}),
  sendPasswordResetEmail:             vi.fn(async () => {}),
  sendTeamInviteEmail:                vi.fn(async () => {}),
  sendJobAssignmentEmail:             vi.fn(async () => {}),
  sendJobCompletionNotificationEmail: vi.fn(async () => {}),
  sendWelcomeEmail:                   vi.fn(async () => {}),
}));

vi.mock('../freemiumService', () => ({
  FreemiumService: { checkLimit: vi.fn(async () => true) },
}));

vi.mock('../demoData', () => ({
  DEMO_USER:    { id: 'demo-user' },
  VISITOR_USER: { id: 'visitor-user' },
}));

vi.mock('../activityService', () => ({
  logTeamActivity: vi.fn(async () => {}),
}));

vi.mock('../notifications', () => ({
  notifyQuoteSent:              vi.fn(async () => {}),
  notifyInvoiceSent:            vi.fn(async () => {}),
  notifyInvoicePaid:            vi.fn(async () => {}),
  notifyJobScheduled:           vi.fn(async () => {}),
  notifyJobStarted:             vi.fn(async () => {}),
  notifyJobCompleted:           vi.fn(async () => {}),
  notifyJobAssigned:            vi.fn(async () => {}),
  notifyTeamMemberInvited:      vi.fn(async () => {}),
  notifySmsReceived:            vi.fn(async () => {}),
  notifyTimesheetSubmitted:     vi.fn(async () => {}),
  notifyChatMessage:            vi.fn(async () => {}),
  notifyQuoteAccepted:          vi.fn(async () => {}),
  notifyQuoteRejected:          vi.fn(async () => {}),
  notifyGeofenceCheckIn:        vi.fn(async () => {}),
  notifyGeofenceCheckOut:       vi.fn(async () => {}),
  notifyRecurringJobCreated:    vi.fn(async () => {}),
  notifyRecurringInvoiceCreated: vi.fn(async () => {}),
  notifyInvoiceOverdue:         vi.fn(async () => {}),
  notifyQuoteExpiring:          vi.fn(async () => {}),
  notifyPaymentFailed:          vi.fn(async () => {}),
}));

vi.mock('../pushNotifications', () => ({
  notifyJobAssigned:              vi.fn(async () => {}),
  notifyJobUpdate:                vi.fn(async () => {}),
  notifyPaymentReceived:          vi.fn(async () => {}),
  notifyQuoteAccepted:            vi.fn(async () => {}),
  notifyQuoteRejected:            vi.fn(async () => {}),
  notifyTeamMessage:              vi.fn(async () => {}),
  notifyInvoiceOverdue:           vi.fn(async () => {}),
  notifySmsReceived:              vi.fn(async () => {}),
  notifyGeofenceEvent:            vi.fn(async () => {}),
  notifyTimesheetSubmitted:       vi.fn(async () => {}),
  notifyQuoteExpiring:            vi.fn(async () => {}),
  notifyPaymentFailed:            vi.fn(async () => {}),
  notifyTrialExpiring:            vi.fn(async () => {}),
  notifyTimesheetDisputeFiled:    vi.fn(async () => {}),
  notifyTimesheetDisputeResolved: vi.fn(async () => {}),
  notifyJobNudge:                 vi.fn(async () => {}),
  notifyNudgeResponse:            vi.fn(async () => {}),
}));

vi.mock('../emailIntegrationService', () => ({
  getEmailIntegration:      vi.fn(async () => null),
  getGmailConnectionStatus: vi.fn(async () => null),
}));

vi.mock('../stripeClient', () => ({
  getUncachableStripeClient: vi.fn(() => null),
  getStripePublishableKey:   vi.fn(() => null),
  isStripeInitialized:       vi.fn(() => false),
}));

vi.mock('../twilioClient', () => ({
  checkTwilioAvailability: vi.fn(async () => false),
  sendSMS:                 vi.fn(async () => null),
  validateTwilioWebhook:   vi.fn(() => true),
}));

vi.mock('../geocoding', () => ({
  geocodeAddress:    vi.fn(async () => null),
  haversineDistance: vi.fn(() => 0),
  calculateRouteETA: vi.fn(async () => null),
}));

vi.mock('../automationService', () => ({
  processStatusChangeAutomation:    vi.fn(async () => {}),
  processPaymentReceivedAutomation: vi.fn(async () => {}),
  processTimeBasedAutomations:      vi.fn(async () => {}),
}));

vi.mock('../xeroService',       () => ({ getXeroClient: vi.fn(async () => null) }));
vi.mock('../myobService',       () => ({}));
vi.mock('../quickbooksService', () => ({}));

vi.mock('../urlHelper', () => ({
  getProductionBaseUrl: vi.fn(() => 'http://localhost'),
  getQuotePublicUrl:    vi.fn(() => ''),
  getInvoicePublicUrl:  vi.fn(() => ''),
  getReceiptPublicUrl:  vi.fn(() => ''),
}));

vi.mock('../emailTemplates', () => ({
  generateQuoteEmailTemplate:   vi.fn(() => ''),
  generateInvoiceEmailTemplate: vi.fn(() => ''),
}));

vi.mock('../notificationService', () => ({
  notifyOwnerViaSms:   vi.fn(async () => {}),
  notifyOwnerViaEmail: vi.fn(async () => {}),
}));

vi.mock('../systemEventService',       () => ({ logSystemEvent: vi.fn(async () => {}) }));
vi.mock('../phaseExpenseAttribution',  () => ({
  allocateExpensesByPhase: vi.fn(() => ({ byPhaseId: new Map(), unallocated: 0 })),
}));
vi.mock('../shared-financials',        () => ({
  calculateDocumentTotals: vi.fn(() => ({})),
  reverseTaxCalculation:   vi.fn(() => ({})),
}));
vi.mock('../objectStorage', () => ({
  ObjectStorageService: vi.fn(() => ({ uploadFile: vi.fn(), downloadFile: vi.fn() })),
  ObjectNotFoundError:  class ObjectNotFoundError extends Error {},
  objectStorageClient:  {
    bucket: vi.fn(() => ({ file: vi.fn(() => ({ getSignedUrl: vi.fn(async () => ['']) })) })),
  },
  parseObjectPath: vi.fn((p: string) => ({ bucketName: 'b', objectName: p })),
}));
vi.mock('../tradieTemplates', () => ({
  tradieQuoteTemplates: {}, tradieLineItems: {}, tradieRateCards: {},
}));
vi.mock('../safetyTemplates', () => ({
  getSafetyFormTemplates: vi.fn(async () => []),
  getSafetyFormTemplate:  vi.fn(async () => null),
}));
vi.mock('../taskRules', () => ({ evaluateTaskRules: vi.fn(async () => []) }));
vi.mock('../ai', () => ({
  generateAISuggestions: vi.fn(async () => []),
  chatWithAI:            vi.fn(async () => ''),
  analyzeReceipt:        vi.fn(async () => null),
  detectHazards:         vi.fn(async () => []),
}));
vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Import the real route (after all mocks are registered) ────────────────────

import { registerJobsRoutes } from '../routes/jobs';

// ── Helpers ───────────────────────────────────────────────────────────────────

const OWNER_ID = 'user-owner-1';

/**
 * Recursively walks the captured predicate tree looking for a node that
 * satisfies `test`. Used to assert that specific predicates are present.
 */
function findInPredicate(pred: any, test: (node: any) => boolean): boolean {
  if (!pred || typeof pred !== 'object') return false;
  if (test(pred)) return true;
  if (pred.op === 'and' && Array.isArray(pred.args)) {
    return pred.args.some((a: any) => findInPredicate(a, test));
  }
  return false;
}

function buildApp() {
  const app = express();
  app.use(express.json());

  const passThrough = (_: any, __: any, next: any) => next();
  const multerStub = () => ({
    single: () => passThrough, array: () => passThrough,
    fields: () => passThrough, none:  () => passThrough, any: () => passThrough,
  });

  registerJobsRoutes(app, {
    trackingTokens:       new Map(),
    buildProofPackData:   vi.fn(async () => ({})),
    sitePhotoCache:       new Map(),
    upload:               multerStub() as any,
    getJobWithChatAccess: vi.fn(async () => null),
    chatUpload:           multerStub() as any,
  });

  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/phases/unassigned — SQL predicate integration', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedWhere.value = null;
    mockPhaseRows.value  = [];
    app = buildApp();
  });

  // ── 1. A phase with no assignments is returned ────────────────────────────
  // The mock db returns one phase row; the endpoint must pass it through and
  // include it in the response body.

  it('returns a phase with no assignments in the response', async () => {
    const phaseRow = {
      id: 'phase-1', jobId: 'job-1', phaseCode: null, name: 'Foundation',
      description: null, scheduledStart: new Date('2026-09-15T08:00:00Z'),
      scheduledEnd: null, status: 'not_started', sortOrder: 0,
      assignedUserId: null, jobTitle: 'Build House',
    };
    mockPhaseRows.value = [phaseRow];

    const res = await request(app)
      .get('/api/phases/unassigned')
      .set('x-user-id', OWNER_ID);

    expect(res.status).toBe(200);
    expect(res.body.phases).toHaveLength(1);
    expect(res.body.phases[0].id).toBe('phase-1');
    expect(res.body).toHaveProperty('teamMembers');
  });

  // ── 2. Phases with a join-table row are excluded by isNull(jpa.phaseId) ──
  // The WHERE clause must contain isNull(jobPhaseAssignments.phaseId). If that
  // predicate is removed from jobs.ts, the assertion on capturedWhere fails.

  it('WHERE clause contains isNull(jobPhaseAssignments.phaseId) to exclude assigned phases', async () => {
    await request(app)
      .get('/api/phases/unassigned')
      .set('x-user-id', OWNER_ID);

    expect(capturedWhere.value).not.toBeNull();

    const hasJpaPhaseIdCheck = findInPredicate(
      capturedWhere.value,
      (node) => node.op === 'isNull' && node.a === JPA_PHASE_ID,
    );

    expect(hasJpaPhaseIdCheck).toBe(true);
  });

  // ── 3. Phases with only a legacy assignedUserId are excluded ─────────────
  // The WHERE clause must contain isNull(jobPhases.assignedUserId). If removed,
  // the assertion on capturedWhere fails.

  it('WHERE clause contains isNull(jobPhases.assignedUserId) to exclude legacy-assigned phases', async () => {
    await request(app)
      .get('/api/phases/unassigned')
      .set('x-user-id', OWNER_ID);

    expect(capturedWhere.value).not.toBeNull();

    const hasAssignedUserIdCheck = findInPredicate(
      capturedWhere.value,
      (node) => node.op === 'isNull' && node.a === JP_ASSIGNED_USER_ID,
    );

    expect(hasAssignedUserIdCheck).toBe(true);
  });

  // ── 4. Phases from done/invoiced/cancelled jobs are excluded ─────────────
  // The WHERE clause must contain a sql predicate on jobs.status that excludes
  // terminal statuses. If removed, the assertion fails.

  it('WHERE clause contains a job-status NOT IN predicate excluding done and invoiced', async () => {
    await request(app)
      .get('/api/phases/unassigned')
      .set('x-user-id', OWNER_ID);

    expect(capturedWhere.value).not.toBeNull();

    // The production code uses: sql`${jobs.status} NOT IN ('done','invoiced','cancelled')`
    // With the drizzle-orm mock this becomes: { op:'sql', field: J_STATUS, text: " NOT IN ..." }
    const hasJobStatusExclusion = findInPredicate(
      capturedWhere.value,
      (node) =>
        node.op === 'sql' &&
        node.field === J_STATUS &&
        node.text.includes('done') &&
        node.text.includes('invoiced'),
    );

    expect(hasJobStatusExclusion).toBe(true);
  });

  // ── 5. Archived jobs are excluded ────────────────────────────────────────
  // The WHERE clause must contain isNull(jobs.archivedAt).

  it('WHERE clause contains isNull(jobs.archivedAt) to exclude archived jobs', async () => {
    await request(app)
      .get('/api/phases/unassigned')
      .set('x-user-id', OWNER_ID);

    const hasArchivedAtCheck = findInPredicate(
      capturedWhere.value,
      (node) => node.op === 'isNull' && node.a === J_ARCHIVED_AT,
    );

    expect(hasArchivedAtCheck).toBe(true);
  });

  // ── 6. Response shape is always { phases, teamMembers } ──────────────────

  it('response body always has phases and teamMembers arrays', async () => {
    const res = await request(app)
      .get('/api/phases/unassigned')
      .set('x-user-id', OWNER_ID);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.phases)).toBe(true);
    expect(Array.isArray(res.body.teamMembers)).toBe(true);
    expect(Array.isArray(res.body)).toBe(false);
  });

  // ── 7. Unauthenticated requests are rejected ──────────────────────────────

  it('returns 401 when no auth header is provided', async () => {
    const res = await request(app).get('/api/phases/unassigned');
    expect(res.status).toBe(401);
  });
});
