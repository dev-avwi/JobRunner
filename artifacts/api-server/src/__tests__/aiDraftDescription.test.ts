/**
 * aiDraftDescription.test.ts
 *
 * HTTP-level tests for POST /api/ai/draft-description.
 *
 * Verifies:
 *   1. When a jobId is supplied and the job exists, phases and materials are
 *      fetched and forwarded to draftDocumentDescription.
 *   2. When phases storage throws, the endpoint still succeeds with empty
 *      phaseNames (graceful fallback).
 *   3. When materials storage throws, the endpoint still succeeds with empty
 *      materialNames (graceful fallback).
 *   4. When phases and materials are both absent (empty arrays), the description
 *      is generated from the remaining context only.
 *   5. When no jobId is provided, no phase/material lookups are made and the
 *      endpoint delegates to draftDocumentDescription with empty arrays.
 *   6. When the job is not found (getJob returns null), no phase/material
 *      lookups are made.
 *   7. Invalid docType returns 400 without calling the AI.
 *   8. Unauthenticated requests return 401.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── Hoisted mock fns ──────────────────────────────────────────────────────────

const mockGetUser          = vi.hoisted(() => vi.fn());
const mockGetJob           = vi.hoisted(() => vi.fn());
const mockGetJobPhases     = vi.hoisted(() => vi.fn());
const mockGetJobMaterials  = vi.hoisted(() => vi.fn());
const mockGetUserContext   = vi.hoisted(() => vi.fn());
const mockDraftDescription = vi.hoisted(() => vi.fn());

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

vi.mock('../storage', () => ({
  storage: {
    getUser:                         (...a: any[]) => mockGetUser(...a),
    getJob:                          (...a: any[]) => mockGetJob(...a),
    getJobPhases:                    (...a: any[]) => mockGetJobPhases(...a),
    getJobMaterials:                 (...a: any[]) => mockGetJobMaterials(...a),
    // Safe defaults for surrounding routes that legacyRoutes registers
    getTeamMembers:                  vi.fn(async () => []),
    getBusinessSettings:             vi.fn(async () => null),
    getTimeEntry:                    vi.fn(async () => null),
    getTimeEntryAny:                 vi.fn(async () => null),
    getTeamMemberByOwnerAndMemberId: vi.fn(async () => null),
    updateTimeEntry:                 vi.fn(async () => null),
    createTimeEntryEdit:             vi.fn(async () => ({})),
    getActiveTimeEntry:              vi.fn(async () => null),
    getTask:                         vi.fn(async () => null),
    getTaskByIdForJob:               vi.fn(async () => null),
    getTaskWorkLog:                  vi.fn(async () => ({})),
    logTaskHours:                    vi.fn(async () => ({})),
    logTaskMaterials:                vi.fn(async () => ({})),
    getJobAssignments:               vi.fn(async () => []),
    updateTask:                      vi.fn(async () => ({})),
  },
  db: {
    select:      vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) })),
    insert:      vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(async () => []) })) })),
    update:      vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => []) })) })) })),
    delete:      vi.fn(() => ({ where: vi.fn(async () => []) })),
    execute:     vi.fn(async () => ({ rows: [] })),
    transaction: vi.fn(async (fn: any) => fn({
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) })),
      insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(async () => []) })) })),
    })),
  },
}));

vi.mock('../ai', () => ({
  draftDocumentDescription: (...a: any[]) => mockDraftDescription(...a),
}));

vi.mock('@workspace/db', () => {
  function ms(): any {
    const s: any = {
      parse:       (d: any) => d,
      safeParse:   (d: any) => ({ success: true, data: d }),
      partial:     () => s, omit: () => s, pick: () => s,
      extend:      () => s, refine: () => s, superRefine: () => s,
      transform:   () => s, optional: () => s, nullable: () => s,
      default:     () => s, array: () => s, shape: {},
    };
    return s;
  }
  return {
    insertTimeEntrySchema: ms(), insertBusinessSettingsSchema: ms(),
    insertIntegrationSettingsSchema: ms(), insertNotificationSchema: ms(),
    insertClientSchema: ms(), insertJobSchema: ms(), insertQuoteSchema: ms(),
    updateQuoteSchema: ms(), insertQuoteLineItemSchema: ms(), insertInvoiceSchema: ms(),
    updateInvoiceSchema: ms(), insertInvoiceLineItemSchema: ms(),
    insertDocumentTemplateSchema: ms(), insertLineItemCatalogSchema: ms(),
    insertRateCardSchema: ms(), insertTimesheetSchema: ms(),
    insertExpenseCategorySchema: ms(), insertExpenseSchema: ms(),
    insertInventoryCategorySchema: ms(), insertInventoryItemSchema: ms(),
    insertInventoryTransactionSchema: ms(), insertSupplierSchema: ms(),
    insertPurchaseOrderSchema: ms(), insertPurchaseOrderItemSchema: ms(),
    insertUserRoleSchema: ms(), insertTeamMemberSchema: ms(),
    insertStaffScheduleSchema: ms(), insertLocationTrackingSchema: ms(),
    insertRouteSchema: ms(), insertChecklistItemSchema: ms(),
    updateChecklistItemSchema: ms(), insertJobChatSchema: ms(),
    insertTeamChatSchema: ms(), insertSmsTemplateSchema: ms(),
    insertBusinessTemplateSchema: ms(), updateBusinessTemplateSchema: ms(),
    insertTeamPresenceSchema: ms(), insertActivityFeedSchema: ms(),
    insertRecurringContractSchema: ms(), insertLeadSchema: ms(),
    insertJobNoteSchema: ms(), insertJobMaterialSchema: ms(),
    insertServiceReminderSchema: ms(), insertEquipmentSchema: ms(),
    insertEquipmentCategorySchema: ms(), insertEquipmentMaintenanceSchema: ms(),
    insertRebateSchema: ms(), insertTeamGroupSchema: ms(),
    insertJobInviteSchema: ms(), insertSubcontractorInvoiceSchema: ms(),
    insertSubcontractorInvoiceItemSchema: ms(), insertNumberPortRequestSchema: ms(),
    insertSavedFilterSchema: ms(), insertTimeEntryEditSchema: ms(),
    insertGpsSignalLogSchema: ms(), loginSchema: ms(), insertUserSchema: ms(),
    requestLoginCodeSchema: ms(), verifyLoginCodeSchema: ms(),
    timeEntries:    { id: 'te.id', userId: 'te.userId', jobId: 'te.jobId' },
    jobs:           { id: 'j.id', userId: 'j.userId', status: 'j.status' },
    tasks:          { id: 't.id', userId: 't.userId', jobId: 't.jobId' },
    lineItemCatalog: {}, users: {}, clients: {}, jobPhases: {},
    jobPhaseAssignments: {}, jobAssignments: {}, jobDocuments: {},
    jobMaterials: {}, jobEquipment: {}, equipment: {}, equipmentCategories: {},
    locationTracking: {}, tradieStatus: {}, digitalSignatures: {},
    invoices: {}, quotes: {}, businessSettings: {}, businessTemplates: {},
    teamMembers: {}, teamMemberSkills: {}, teamMemberAvailability: {},
    teamMemberTimeOff: {}, teamMemberMetrics: {}, jobAssignmentRequests: {},
    userRoles: {}, savedFilters: {}, timeEntryEdits: {}, timeEntryDisputeEvents: {},
    invoiceEdits: {}, invoiceReminderLogs: {}, smsAutomationLogs: {},
    smsAutomationRules: {}, jobReminders: {}, automationLogs: {}, automations: {},
    geofenceAlerts: {}, jobInvites: {}, jobPhotos: {}, swmsDocuments: {},
    swmsHazards: {}, swmsSignatures: {}, customForms: {}, formSubmissions: {},
    rateLimits: {}, smsMessages: {}, smsConversations: {}, aiReceptionistCalls: {},
    aiReceptionistConfig: {}, leads: {}, errorLogs: {}, auditLogs: {},
    systemEvents: {}, websiteChangeRequests: {}, websiteAddons: {},
    subcontractorTokens: {}, subcontractorEvents: {}, subcontractorInvoices: {},
    subcontractorInvoiceItems: {}, numberPortRequests: {}, purchaseOrders: {},
    purchaseOrderItems: {}, claims: {}, claimLineItems: {}, idempotencyKeys: {},
    inviteCodes: {}, feedback: {}, vapiEvents: {},
    ROLE_PRESETS: {}, BUSINESS_TEMPLATE_FAMILIES: [], PORT_REQUEST_STATUSES: [],
    isValidPurposeForFamily: () => true,
    getValidPurposesForFamily: () => [],
  };
});

vi.mock('drizzle-orm', () => ({
  eq:           (a: any, b: any)       => ({ op: 'eq',      a, b }),
  and:          (...args: any[])       => ({ op: 'and',     args }),
  or:           (...args: any[])       => ({ op: 'or',      args }),
  ne:           (a: any, b: any)       => ({ op: 'ne',      a, b }),
  isNull:       (a: any)              => ({ op: 'isNull',   a }),
  isNotNull:    (a: any)              => ({ op: 'isNotNull', a }),
  inArray:      (a: any, b: any)      => ({ op: 'inArray',  a, b }),
  gte:          (a: any, b: any)      => ({ op: 'gte',      a, b }),
  lte:          (a: any, b: any)      => ({ op: 'lte',      a, b }),
  lt:           (a: any, b: any)      => ({ op: 'lt',       a, b }),
  desc:         (a: any)              => ({ op: 'desc',     a }),
  asc:          (a: any)              => ({ op: 'asc',      a }),
  sql:          (p: any, ...v: any[]) => ({ op: 'sql',      p, v }),
  count:        (a: any)              => a,
  sum:          (a: any)              => a,
  aliasedTable: (t: any, _: string)  => t,
}));

const passThroughMw = (_: any, __: any, next: any) => next();

vi.mock('../permissions', () => ({
  ownerOnly:                  vi.fn(() => passThroughMw),
  ownerOrManagerOnly:         vi.fn(() => passThroughMw),
  requirePermission:          vi.fn(() => passThroughMw),
  requireTeamPlan:            vi.fn(() => passThroughMw),
  canAccessJobMedia:          vi.fn(async () => true),
  PERMISSIONS: {
    MANAGE_TEAM:    'manage_team',
    WRITE_JOBS:     'write_jobs',
    READ_JOBS:      'read_jobs',
    WRITE_EXPENSES: 'write_expenses',
    VIEW_REPORTS:   'view_reports',
    VIEW_ALL:       'view_all',
  },
  createPermissionMiddleware:  vi.fn(() => passThroughMw),
  requireJobMediaAccess:       passThroughMw,
  getUserContext:              (...a: any[]) => mockGetUserContext(...a),
  hasPermission:               vi.fn(() => true),
  hasAnyPermission:            vi.fn(() => true),
  canAssignJobTo:              vi.fn(async () => true),
  getWorkerPermissionContext:  vi.fn(async () => ({})),
  sanitizeClientData:          vi.fn((d: any) => d),
  ownerHasTeamCapability:      vi.fn(async () => true),
  checkTeamSeatLimit:          vi.fn(async () => null),
  isUserAssignedToJob:         vi.fn(async () => false),
  WORKER_PROFILE_PLACEHOLDER_NAME: 'Worker',
  requireOwnerSubscriptionActive: vi.fn(() => passThroughMw),
}));

vi.mock('../routes/middleware', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const uid = req.headers['x-user-id'];
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    req.userId = uid;
    next();
  },
  requireProSubscription: passThroughMw,
  requirePaidTier:        vi.fn(() => passThroughMw),
  requirePaidTierForSms:  passThroughMw,
  requireDevelopment:     passThroughMw,
  authRateLimiter:        passThroughMw,
  registerRateLimiter:    passThroughMw,
  loginRateLimiter:       passThroughMw,
  verifyRateLimiter:      passThroughMw,
  passwordResetLimiter:   passThroughMw,
  paymentRateLimiter:     passThroughMw,
  messageSendLimiter:     passThroughMw,
  generalApiLimiter:      passThroughMw,
  setupOnboardingGuard:   vi.fn(),
  pdfPerUserLimiter:      passThroughMw,
  aiPerUserLimiter:       passThroughMw,
  visionPerUserLimiter:   passThroughMw,
  photoUploadPerUserLimiter: passThroughMw,
  transcribePerUserLimiter:  passThroughMw,
  messagePerUserLimiter:     passThroughMw,
  webhookRateLimiter:        passThroughMw,
  backpressureErrorHandler:  passThroughMw,
  activityTrackingMiddleware: passThroughMw,
  businessLocalDate:  vi.fn(() => '2026-09-14'),
  recordUserActivity: vi.fn(async () => {}),
  isActiveTrialUser:  vi.fn(() => false),
}));

vi.mock('../routes/helpers', () => ({
  dbCheckEnRouteNotif:                vi.fn(async () => {}),
  chatRateLimiterMiddleware:          passThroughMw,
  portalIpRateLimiterMiddleware:      passThroughMw,
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
  aiQueue:        { run: vi.fn((fn: any) => fn()) },
}));

vi.mock('../auth', () => ({
  AuthService: {
    getUserById:          vi.fn(async () => null),
    verifyToken:          vi.fn(async () => null),
    createSession:        vi.fn(async () => 'tok'),
    sanitizeUserResponse: vi.fn((u: any) => u),
  },
  sanitizeUserResponse: vi.fn((u: any) => u),
}));

vi.mock('../googleAuth',       () => ({ setupGoogleAuth:          vi.fn() }));
vi.mock('../xeroAuth',         () => ({ setupXeroAuth:            vi.fn() }));
vi.mock('../appleAuth',        () => ({ verifyAppleIdentityToken:  vi.fn() }));
vi.mock('../googleMobileAuth', () => ({
  verifyGoogleMobileToken: vi.fn(),
  GoogleTokenError: class extends Error {},
}));
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
  DEMO_USER:     { id: 'demo-user' },
  VISITOR_USER:  { id: 'visitor-user' },
  TRY_DEMO_USER: { id: 'try-demo-user' },
}));
vi.mock('../activityService',  () => ({ logTeamActivity: vi.fn(async () => {}) }));
vi.mock('../notifications',    () => ({
  createNotification:        vi.fn(async () => {}),
  notifyQuoteSent:           vi.fn(async () => {}),
  notifyInvoiceSent:         vi.fn(async () => {}),
  notifyInvoicePaid:         vi.fn(async () => {}),
  notifyJobScheduled:        vi.fn(async () => {}),
  notifyJobStarted:          vi.fn(async () => {}),
  notifyJobCompleted:        vi.fn(async () => {}),
  notifyJobAssigned:         vi.fn(async () => {}),
  notifyTeamMemberInvited:   vi.fn(async () => {}),
  notifySmsReceived:         vi.fn(async () => {}),
  notifyTimesheetSubmitted:  vi.fn(async () => {}),
  notifyChatMessage:         vi.fn(async () => {}),
  notifyQuoteAccepted:       vi.fn(async () => {}),
  notifyQuoteRejected:       vi.fn(async () => {}),
  notifyGeofenceCheckIn:     vi.fn(async () => {}),
  notifyGeofenceCheckOut:    vi.fn(async () => {}),
  notifyRecurringJobCreated: vi.fn(async () => {}),
  notifyRecurringInvoiceCreated: vi.fn(async () => {}),
  notifyInvoiceOverdue:      vi.fn(async () => {}),
  notifyQuoteExpiring:       vi.fn(async () => {}),
  notifyPaymentFailed:       vi.fn(async () => {}),
}));
vi.mock('../pushNotifications', () => ({
  notifyJobAssigned:        vi.fn(async () => {}),
  notifyJobUpdate:          vi.fn(async () => {}),
  notifyPaymentReceived:    vi.fn(async () => {}),
  notifyQuoteAccepted:      vi.fn(async () => {}),
  notifyQuoteRejected:      vi.fn(async () => {}),
  notifyTeamMessage:        vi.fn(async () => {}),
  notifyInvoiceOverdue:     vi.fn(async () => {}),
  notifySmsReceived:        vi.fn(async () => {}),
  notifyGeofenceEvent:      vi.fn(async () => {}),
  notifyExpenseApproved:    vi.fn(async () => {}),
  notifyExpenseRejected:    vi.fn(async () => {}),
  notifyTimesheetFeedback:  vi.fn(async () => {}),
  notifyNewLead:            vi.fn(async () => {}),
}));
vi.mock('../websocket', () => ({
  broadcastTimeEntryUpdate:    vi.fn(),
  broadcastJobStatusChange:    vi.fn(),
  broadcastToBusinessUsers:    vi.fn(),
  broadcastToUser:             vi.fn(),
  broadcastTimerStart:         vi.fn(),
  broadcastTimerStop:          vi.fn(),
  broadcastActiveTimersUpdate: vi.fn(),
  broadcastTimesheetActivity:  vi.fn(),
  broadcastChatMessage:        vi.fn(),
  broadcastChatPresence:       vi.fn(),
  broadcastReadReceipt:        vi.fn(),
  broadcastTeamChatMessage:    vi.fn(),
  broadcastJobUpdate:          vi.fn(),
  broadcastPaymentUpdate:      vi.fn(),
  broadcastToRoom:             vi.fn(),
  getConnectedUserCount:       vi.fn(() => 0),
  initializeWebSocket:         vi.fn(),
}));
vi.mock('../liveActivity',    () => ({ broadcastLiveActivityUpdate: vi.fn() }));
vi.mock('../cache',           () => ({
  invalidateAggregateDashboard: vi.fn(),
  getFromCache:                 vi.fn(async () => null),
  setInCache:                   vi.fn(async () => {}),
  invalidateCacheKey:           vi.fn(async () => {}),
}));
vi.mock('../shared-financials', () => ({
  calculateDocumentTotals: vi.fn(() => ({ subtotal: 0, gst: 0, total: 0 })),
}));
vi.mock('../middleware/errorHandler', () => ({
  errorHandler:    (_: any, __: any, ___: any, next: any) => next(),
  notFoundHandler: (_: any, res: any) => res.status(404).json({ error: 'Not found' }),
}));
vi.mock('../objectStorage', () => ({
  ObjectStorageService: vi.fn(() => ({
    uploadFile:   vi.fn(async () => '/path/file'),
    getSignedUrl: vi.fn(async () => 'https://example.com/file'),
  })),
}));
vi.mock('../routes/expenses', () => ({ registerExpenseRoutes: vi.fn() }));

// ── Constants ─────────────────────────────────────────────────────────────────

const OWNER_ID = 'draft-test-owner';
const JOB_ID   = 'draft-test-job';

const USER_CONTEXT = {
  userId:          OWNER_ID,
  effectiveUserId: OWNER_ID,
  isOwner:         true,
  permissions:     ['*'],
  teamMemberId:    null,
};

const SAMPLE_JOB = {
  id:          JOB_ID,
  userId:      OWNER_ID,
  title:       'Bathroom Renovation',
  description: 'Full bathroom remodel including tiling and plumbing',
  status:      'in_progress',
};

const SAMPLE_PHASES = [
  { id: 'p1', name: 'Demolition' },
  { id: 'p2', name: 'Plumbing rough-in' },
  { id: 'p3', name: 'Tiling' },
];

const SAMPLE_MATERIALS = [
  { id: 'm1', name: 'Ceramic tiles' },
  { id: 'm2', name: 'Copper pipe' },
  { id: 'm3', name: 'Waterproof membrane' },
];

// ── App factory ───────────────────────────────────────────────────────────────

let app: express.Express;

async function buildApp() {
  if (app) return app;
  const { registerRoutes } = await import('../legacyRoutes');
  const a = express();
  a.use(express.json());
  await registerRoutes(a);
  app = a;
  return app;
}

beforeAll(async () => { await buildApp(); }, 30_000);

beforeEach(() => {
  vi.clearAllMocks();

  mockGetUserContext.mockResolvedValue(USER_CONTEXT);
  mockGetUser.mockResolvedValue({ id: OWNER_ID, tradeType: 'Plumber' });
  mockGetJob.mockResolvedValue(SAMPLE_JOB);
  mockGetJobPhases.mockResolvedValue(SAMPLE_PHASES);
  mockGetJobMaterials.mockResolvedValue(SAMPLE_MATERIALS);
  mockDraftDescription.mockResolvedValue('Comprehensive bathroom renovation covering demolition, plumbing, and tiling.');
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/ai/draft-description — job context forwarding', () => {

  it('passes phase and material names to draftDocumentDescription when jobId is provided', async () => {
    const res = await request(app)
      .post('/api/ai/draft-description')
      .set('x-user-id', OWNER_ID)
      .send({
        docType:   'quote',
        jobId:     JOB_ID,
        clientName: 'Smith Household',
        docTitle:  'Bathroom Reno Quote',
      });

    expect(res.status).toBe(200);
    expect(res.body.description).toBeTruthy();

    expect(mockGetJobPhases).toHaveBeenCalledWith(JOB_ID, OWNER_ID);
    expect(mockGetJobMaterials).toHaveBeenCalledWith(JOB_ID, OWNER_ID);

    const callArgs = mockDraftDescription.mock.calls[0][0];
    expect(callArgs.phaseNames).toEqual(['Demolition', 'Plumbing rough-in', 'Tiling']);
    expect(callArgs.materialNames).toEqual(['Ceramic tiles', 'Copper pipe', 'Waterproof membrane']);
    expect(callArgs.jobTitle).toBe('Bathroom Renovation');
    expect(callArgs.docType).toBe('quote');
    expect(callArgs.clientName).toBe('Smith Household');
  });

  it('includes the job title and notes in context forwarded to the AI', async () => {
    const res = await request(app)
      .post('/api/ai/draft-description')
      .set('x-user-id', OWNER_ID)
      .send({ docType: 'invoice', jobId: JOB_ID });

    expect(res.status).toBe(200);

    const callArgs = mockDraftDescription.mock.calls[0][0];
    expect(callArgs.jobTitle).toBe('Bathroom Renovation');
    expect(callArgs.jobNotes).toBe('Full bathroom remodel including tiling and plumbing');
  });

  it('caps phases at 6 when the job has more', async () => {
    mockGetJobPhases.mockResolvedValue([
      { id: 'p1', name: 'Phase A' },
      { id: 'p2', name: 'Phase B' },
      { id: 'p3', name: 'Phase C' },
      { id: 'p4', name: 'Phase D' },
      { id: 'p5', name: 'Phase E' },
      { id: 'p6', name: 'Phase F' },
      { id: 'p7', name: 'Phase G' },
    ]);

    const res = await request(app)
      .post('/api/ai/draft-description')
      .set('x-user-id', OWNER_ID)
      .send({ docType: 'quote', jobId: JOB_ID });

    expect(res.status).toBe(200);
    const callArgs = mockDraftDescription.mock.calls[0][0];
    expect(callArgs.phaseNames.length).toBe(6);
    expect(callArgs.phaseNames).not.toContain('Phase G');
  });

  it('caps materials at 8 when the job has more', async () => {
    mockGetJobMaterials.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, name: `Material ${i}` })),
    );

    const res = await request(app)
      .post('/api/ai/draft-description')
      .set('x-user-id', OWNER_ID)
      .send({ docType: 'quote', jobId: JOB_ID });

    expect(res.status).toBe(200);
    const callArgs = mockDraftDescription.mock.calls[0][0];
    expect(callArgs.materialNames.length).toBe(8);
  });

  it('falls back gracefully when getJobPhases throws — still calls AI with empty phases', async () => {
    mockGetJobPhases.mockRejectedValue(new Error('DB timeout'));

    const res = await request(app)
      .post('/api/ai/draft-description')
      .set('x-user-id', OWNER_ID)
      .send({ docType: 'quote', jobId: JOB_ID });

    expect(res.status).toBe(200);
    const callArgs = mockDraftDescription.mock.calls[0][0];
    expect(callArgs.phaseNames).toEqual([]);
    // materials should still be populated from the successful call
    expect(callArgs.materialNames).toEqual(['Ceramic tiles', 'Copper pipe', 'Waterproof membrane']);
  });

  it('falls back gracefully when getJobMaterials throws — still calls AI with empty materials', async () => {
    mockGetJobMaterials.mockRejectedValue(new Error('DB timeout'));

    const res = await request(app)
      .post('/api/ai/draft-description')
      .set('x-user-id', OWNER_ID)
      .send({ docType: 'quote', jobId: JOB_ID });

    expect(res.status).toBe(200);
    const callArgs = mockDraftDescription.mock.calls[0][0];
    expect(callArgs.materialNames).toEqual([]);
    // phases should still be populated from the successful call
    expect(callArgs.phaseNames).toEqual(['Demolition', 'Plumbing rough-in', 'Tiling']);
  });

  it('generates description from remaining context when both phases and materials are empty', async () => {
    mockGetJobPhases.mockResolvedValue([]);
    mockGetJobMaterials.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/ai/draft-description')
      .set('x-user-id', OWNER_ID)
      .send({ docType: 'quote', jobId: JOB_ID, clientName: 'Jones Family' });

    expect(res.status).toBe(200);
    // AI should still be called — the job title and notes provide context
    expect(mockDraftDescription).toHaveBeenCalledOnce();
    const callArgs = mockDraftDescription.mock.calls[0][0];
    expect(callArgs.phaseNames).toEqual([]);
    expect(callArgs.materialNames).toEqual([]);
    expect(callArgs.jobTitle).toBe('Bathroom Renovation');
    expect(callArgs.clientName).toBe('Jones Family');
  });

  it('skips phase and material lookups when no jobId is provided', async () => {
    const res = await request(app)
      .post('/api/ai/draft-description')
      .set('x-user-id', OWNER_ID)
      .send({
        docType:    'invoice',
        clientName: 'Brown Corp',
        docTitle:   'General Invoice',
        lineItemDescriptions: ['Electrical work', 'Inspection fee'],
      });

    expect(res.status).toBe(200);
    expect(mockGetJobPhases).not.toHaveBeenCalled();
    expect(mockGetJobMaterials).not.toHaveBeenCalled();
    const callArgs = mockDraftDescription.mock.calls[0][0];
    expect(callArgs.phaseNames).toEqual([]);
    expect(callArgs.materialNames).toEqual([]);
    expect(callArgs.lineItemDescriptions).toEqual(['Electrical work', 'Inspection fee']);
  });

  it('skips phase and material lookups when getJob returns null for the given jobId', async () => {
    mockGetJob.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/ai/draft-description')
      .set('x-user-id', OWNER_ID)
      .send({ docType: 'quote', jobId: 'nonexistent-job' });

    expect(res.status).toBe(200);
    expect(mockGetJobPhases).not.toHaveBeenCalled();
    expect(mockGetJobMaterials).not.toHaveBeenCalled();
    const callArgs = mockDraftDescription.mock.calls[0][0];
    expect(callArgs.jobTitle).toBeUndefined();
    expect(callArgs.phaseNames).toEqual([]);
    expect(callArgs.materialNames).toEqual([]);
  });

  it('passes lineItemDescriptions through when provided alongside a jobId', async () => {
    const res = await request(app)
      .post('/api/ai/draft-description')
      .set('x-user-id', OWNER_ID)
      .send({
        docType:  'quote',
        jobId:    JOB_ID,
        lineItemDescriptions: ['Supply and install mixer tap', 'Grout all surfaces'],
      });

    expect(res.status).toBe(200);
    const callArgs = mockDraftDescription.mock.calls[0][0];
    expect(callArgs.lineItemDescriptions).toEqual([
      'Supply and install mixer tap',
      'Grout all surfaces',
    ]);
  });

  it('normalises a non-array lineItemDescriptions to an empty array', async () => {
    const res = await request(app)
      .post('/api/ai/draft-description')
      .set('x-user-id', OWNER_ID)
      .send({ docType: 'quote', lineItemDescriptions: 'not-an-array' });

    expect(res.status).toBe(200);
    const callArgs = mockDraftDescription.mock.calls[0][0];
    expect(callArgs.lineItemDescriptions).toEqual([]);
  });

  it('uses the tradeType from the authenticated user record', async () => {
    mockGetUser.mockResolvedValue({ id: OWNER_ID, tradeType: 'Electrician' });

    const res = await request(app)
      .post('/api/ai/draft-description')
      .set('x-user-id', OWNER_ID)
      .send({ docType: 'invoice' });

    expect(res.status).toBe(200);
    const callArgs = mockDraftDescription.mock.calls[0][0];
    expect(callArgs.tradeType).toBe('Electrician');
  });

  it('returns 400 when docType is missing', async () => {
    const res = await request(app)
      .post('/api/ai/draft-description')
      .set('x-user-id', OWNER_ID)
      .send({ jobId: JOB_ID });

    expect(res.status).toBe(400);
    expect(mockDraftDescription).not.toHaveBeenCalled();
  });

  it('returns 400 when docType is not quote or invoice', async () => {
    const res = await request(app)
      .post('/api/ai/draft-description')
      .set('x-user-id', OWNER_ID)
      .send({ docType: 'estimate', jobId: JOB_ID });

    expect(res.status).toBe(400);
    expect(mockDraftDescription).not.toHaveBeenCalled();
  });

  it('returns 401 when no auth header is provided', async () => {
    const res = await request(app)
      .post('/api/ai/draft-description')
      .send({ docType: 'quote' });

    expect(res.status).toBe(401);
    expect(mockDraftDescription).not.toHaveBeenCalled();
  });

  it('returns the description string from the AI function in the response body', async () => {
    const expectedDescription = 'Supply and installation of new bathroom fixtures and fittings throughout.';
    mockDraftDescription.mockResolvedValue(expectedDescription);

    const res = await request(app)
      .post('/api/ai/draft-description')
      .set('x-user-id', OWNER_ID)
      .send({ docType: 'quote', jobId: JOB_ID });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ description: expectedDescription });
  });
});
