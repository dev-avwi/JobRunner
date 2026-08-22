/**
 * HTTP-level (supertest) tests for the POST /api/jobs/:jobId/claims retention
 * release flow.
 *
 * These tests spin up a minimal Express app with mocked storage, permissions,
 * and middleware so the actual route handler logic is exercised end-to-end —
 * including the eligibility guard, duplicate check, amount calculation, and
 * line-item persistence — without touching a real database.
 *
 * Coverage:
 *  1. Retention release is rejected (403) when practical completion is not set.
 *  2. Retention release succeeds (201) once practical completion is set.
 *  3. The server-computed release amount equals the outstanding retention balance.
 *  4. Blank retentionPercent on variation line items falls back to the claim rate.
 *  5. A second retention release is rejected (409) when one already exists.
 *  6. A retention release on a non-project job is rejected (403).
 *  7. A retention release is rejected (409) when outstanding retention is zero.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mock references ────────────────────────────────────────────────────

const {
  mockGetJob,
  mockGetClaims,
  mockGetNextClaimNumber,
  mockGetBusinessSettings,
  mockCreateClaim,
  mockCreateClaimLineItem,
  mockGetClaimLineItems,
  mockUpdateClaim,
  mockGetClaim,
  mockGetJobVariations,
  mockDeleteClaim,
} = vi.hoisted(() => ({
  mockGetJob: vi.fn(),
  mockGetClaims: vi.fn(),
  mockGetNextClaimNumber: vi.fn(),
  mockGetBusinessSettings: vi.fn(),
  mockCreateClaim: vi.fn(),
  mockCreateClaimLineItem: vi.fn(),
  mockGetClaimLineItems: vi.fn(),
  mockUpdateClaim: vi.fn(),
  mockGetClaim: vi.fn(),
  mockGetJobVariations: vi.fn(),
  mockDeleteClaim: vi.fn(),
}));

vi.mock("../../storage", () => ({
  storage: {
    getJob: mockGetJob,
    getClaims: mockGetClaims,
    getNextClaimNumber: mockGetNextClaimNumber,
    getBusinessSettings: mockGetBusinessSettings,
    createClaim: mockCreateClaim,
    createClaimLineItem: mockCreateClaimLineItem,
    getClaimLineItems: mockGetClaimLineItems,
    updateClaim: mockUpdateClaim,
    getClaim: mockGetClaim,
    getJobVariations: mockGetJobVariations,
    deleteClaim: mockDeleteClaim,
  },
  db: {},
  pool: { on: vi.fn() },
}));

vi.mock("../../permissions", () => ({
  requireOnboarding: (_req: any, _res: any, next: any) => next(),
  getUserContext: vi.fn().mockResolvedValue({ effectiveUserId: "user-1" }),
  createPermissionMiddleware: () => (_req: any, _res: any, next: any) => next(),
  ownerOnly: () => (_req: any, _res: any, next: any) => next(),
  ownerOrManagerOnly: () => (_req: any, _res: any, next: any) => next(),
  PERMISSIONS: { MANAGE_CATALOG: "manage_catalog" },
}));

vi.mock("../middleware", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = "user-1";
    next();
  },
  activityTrackingMiddleware: (_req: any, _res: any, next: any) => next(),
}));

// Stub out heavy services only reached by submit/approve paths
vi.mock("../../xeroService", () => ({ pushProgressClaimToXero: vi.fn() }));
vi.mock("../../pdfService", () => ({
  generateProgressClaimPDF: vi.fn().mockReturnValue("<html></html>"),
  generatePDFBuffer: vi.fn().mockResolvedValue(Buffer.from("pdf")),
  generateCostReportPDF: vi.fn().mockReturnValue("<html></html>"),
}));
vi.mock("../../emailService", () => ({ sendProgressClaimSubmittedEmail: vi.fn() }));
vi.mock("../../urlHelper", () => ({ getProductionBaseUrl: vi.fn().mockReturnValue("https://app.example.com") }));
vi.mock("../../objectStorage", () => ({
  ObjectStorageService: vi.fn().mockImplementation(() => ({
    uploadFile: vi.fn().mockResolvedValue("https://storage/file.pdf"),
    getSignedDownloadURL: vi.fn().mockResolvedValue("https://storage/signed"),
  })),
}));
vi.mock("../../costReportService", () => ({ buildCostReportData: vi.fn().mockResolvedValue({}) }));

// Import after mocks
import express from "express";
import request from "supertest";
import { registerClaimsRoutes } from "../claims";

// ─── Test app factory ─────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  registerClaimsRoutes(app);
  return app;
}

// ─── Shared fixture data ──────────────────────────────────────────────────────

const JOB_ID = "job-proj-1";
const USER_ID = "user-1";

/** A project job with 5% retention, practical completion not yet set. */
const projectJobNoPc = {
  id: JOB_ID,
  userId: USER_ID,
  jobType: "project",
  retentionPercent: "5.00",
  practicalCompletionDate: null,
  defectsLiabilityMonths: 12,
  title: "Harbour Bridge Restoration",
};

/** Same job but with practical completion in the past. */
const projectJobWithPc = {
  ...projectJobNoPc,
  practicalCompletionDate: "2026-01-01",
};

/** Three approved progress claims, each withholding $5,000 retention. */
const approvedProgressClaims = [
  { id: "claim-1", status: "approved", retentionAmount: "5000.00", subtotal: "95000.00", notes: null, jobId: JOB_ID },
  { id: "claim-2", status: "approved", retentionAmount: "5000.00", subtotal: "95000.00", notes: null, jobId: JOB_ID },
  { id: "claim-3", status: "approved", retentionAmount: "5000.00", subtotal: "95000.00", notes: null, jobId: JOB_ID },
];

/** Retention release request body (no explicit amount — server must compute it). */
const retentionReleaseBody = {
  notes: "Retention Release",
  claimDate: "2026-08-01",
};

/** Simulates what storage.createClaim returns for a newly created claim. */
const createdClaim = {
  id: "release-claim-1",
  jobId: JOB_ID,
  userId: USER_ID,
  claimNumber: "PC-004",
  status: "draft",
  retentionPercent: "0.00",
  notes: "Retention Release",
  subtotal: "0.00",
  gstAmount: "0.00",
  total: "0.00",
  retentionAmount: "0.00",
};

/** The single line item the server creates for the release. */
const releaseLineItem = {
  id: "li-release-1",
  claimId: "release-claim-1",
  description: "Retention Release",
  contractValue: "15000.00",
  previouslyClaimed: "0.00",
  thisClaim: "15000.00",
  retentionPercent: "0.00",
  retentionAmount: "0.00",
  sortOrder: 0,
};

/** The final claim returned after totals are persisted. */
const freshReleaseClaim = {
  ...createdClaim,
  subtotal: "15000.00",
  total: "15000.00",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Set up storage mocks for the happy-path release flow. */
function setupHappyPath() {
  mockGetJob.mockResolvedValue(projectJobWithPc);
  mockGetClaims.mockResolvedValue(approvedProgressClaims);
  mockGetNextClaimNumber.mockResolvedValue("PC-004");
  mockGetBusinessSettings.mockResolvedValue({ gstEnabled: false });
  mockCreateClaim.mockResolvedValue(createdClaim);
  mockCreateClaimLineItem.mockResolvedValue(releaseLineItem);
  mockGetClaimLineItems.mockResolvedValue([releaseLineItem]);
  mockUpdateClaim.mockResolvedValue(freshReleaseClaim);
  mockGetClaim.mockResolvedValue(freshReleaseClaim);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/jobs/:jobId/claims — retention release eligibility", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects (403) when practical completion has not been set", async () => {
    mockGetJob.mockResolvedValue(projectJobNoPc);
    mockGetClaims.mockResolvedValue(approvedProgressClaims);
    mockGetNextClaimNumber.mockResolvedValue("PC-004");
    mockGetBusinessSettings.mockResolvedValue({ gstEnabled: false });

    const res = await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/claims`)
      .send(retentionReleaseBody);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/practical completion/i);
    expect(res.body.retentionStatus).toBe("pre_pc");
    // No claim should have been created
    expect(mockCreateClaim).not.toHaveBeenCalled();
  });

  it("rejects (403) when practical completion date is in the future", async () => {
    mockGetJob.mockResolvedValue({ ...projectJobNoPc, practicalCompletionDate: "2099-12-31" });
    mockGetClaims.mockResolvedValue(approvedProgressClaims);
    mockGetNextClaimNumber.mockResolvedValue("PC-004");
    mockGetBusinessSettings.mockResolvedValue({ gstEnabled: false });

    const res = await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/claims`)
      .send(retentionReleaseBody);

    expect(res.status).toBe(403);
    expect(res.body.retentionStatus).toBe("pre_pc");
    expect(mockCreateClaim).not.toHaveBeenCalled();
  });

  it("rejects (403) for a non-project job type", async () => {
    mockGetJob.mockResolvedValue({ ...projectJobWithPc, jobType: "service" });
    mockGetNextClaimNumber.mockResolvedValue("PC-004");
    mockGetBusinessSettings.mockResolvedValue({ gstEnabled: false });

    const res = await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/claims`)
      .send(retentionReleaseBody);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/project-type/i);
    expect(mockCreateClaim).not.toHaveBeenCalled();
  });

  it("rejects (409) when outstanding retention is zero because no retention was ever withheld", async () => {
    // Claims exist but were all billed at 0% retention — nothing was withheld.
    // There is no existing release claim so the duplicate guard does not fire;
    // the route reaches the `outstandingRetention <= 0` check and rejects.
    const zeroRetentionClaims = [
      { id: "c1", status: "approved", retentionAmount: "0.00", subtotal: "50000.00", notes: null, jobId: JOB_ID },
      { id: "c2", status: "approved", retentionAmount: "0.00", subtotal: "50000.00", notes: null, jobId: JOB_ID },
    ];
    mockGetJob.mockResolvedValue(projectJobWithPc);
    mockGetClaims.mockResolvedValue(zeroRetentionClaims);
    mockGetNextClaimNumber.mockResolvedValue("PC-003");
    mockGetBusinessSettings.mockResolvedValue({ gstEnabled: false });

    const res = await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/claims`)
      .send(retentionReleaseBody);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/no outstanding retention/i);
    expect(mockCreateClaim).not.toHaveBeenCalled();
  });

  it("rejects (409) when a retention release claim already exists in draft/submitted/approved", async () => {
    const pendingRelease = {
      id: "existing-release",
      status: "draft",
      retentionAmount: "0.00",
      subtotal: "15000.00",
      notes: "Retention Release",
      jobId: JOB_ID,
    };
    mockGetJob.mockResolvedValue(projectJobWithPc);
    mockGetClaims.mockResolvedValue([...approvedProgressClaims, pendingRelease]);
    mockGetNextClaimNumber.mockResolvedValue("PC-005");
    mockGetBusinessSettings.mockResolvedValue({ gstEnabled: false });

    const res = await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/claims`)
      .send(retentionReleaseBody);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
    expect(res.body.existingClaimId).toBe("existing-release");
    expect(mockCreateClaim).not.toHaveBeenCalled();
  });
});

describe("POST /api/jobs/:jobId/claims — retention release happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it("returns 201 with the created claim when practical completion is set", async () => {
    const res = await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/claims`)
      .send(retentionReleaseBody);

    expect(res.status).toBe(201);
    expect(res.body.claim).toBeDefined();
  });

  it("creates a single line item whose amount equals the outstanding retention", async () => {
    await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/claims`)
      .send(retentionReleaseBody);

    // The route computes outstandingRetention = 15,000 and uses it as the release amount
    expect(mockCreateClaimLineItem).toHaveBeenCalledOnce();
    const lineItemArg = mockCreateClaimLineItem.mock.calls[0][0];
    expect(lineItemArg.description).toBe("Retention Release");
    expect(lineItemArg.thisClaim).toBe("15000.00");
    expect(lineItemArg.contractValue).toBe("15000.00");
  });

  it("overrides any client-supplied line items with the server-computed release amount", async () => {
    // Client tries to submit an inflated release amount — server must ignore it
    const res = await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/claims`)
      .send({
        ...retentionReleaseBody,
        lineItems: [
          { description: "Hacked Release", thisClaim: "999999.00", contractValue: "999999.00" },
        ],
      });

    expect(res.status).toBe(201);
    const lineItemArg = mockCreateClaimLineItem.mock.calls[0][0];
    // Must be the server-computed amount, not the client-supplied one
    expect(lineItemArg.thisClaim).toBe("15000.00");
    expect(parseFloat(lineItemArg.thisClaim)).not.toBeGreaterThan(15_000);
  });

  it("sets retentionPercent to 0.00 on the release claim itself", async () => {
    await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/claims`)
      .send(retentionReleaseBody);

    const claimArg = mockCreateClaim.mock.calls[0][0];
    expect(claimArg.retentionPercent).toBe("0.00");
  });

  it("persists totals via updateClaim after creating line items", async () => {
    await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/claims`)
      .send(retentionReleaseBody);

    expect(mockUpdateClaim).toHaveBeenCalled();
  });

  /**
   * Core double-payment guard: the server must persist a subtotal that exactly
   * equals outstandingRetention from the ledger (15,000 from three approved
   * $5,000-retention claims).  buildScheduleOfValues runs against the real
   * line-item fixture so this catches any mismatch between the computed release
   * amount and what actually lands in the database.
   */
  it("persists a subtotal that equals the outstanding retention balance from the ledger", async () => {
    await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/claims`)
      .send(retentionReleaseBody);

    expect(mockUpdateClaim).toHaveBeenCalled();
    const updateArgs = mockUpdateClaim.mock.calls[0];
    // updateClaim(claimId, userId, patch) — patch is the third argument
    const patch = updateArgs[2] as Record<string, string>;
    // Outstanding retention = sum of approved claim retentionAmounts = 15,000
    expect(patch.subtotal).toBe("15000.00");
    // The release claim itself withholds no additional retention
    expect(patch.retentionAmount).toBe("0.00");
    // total = subtotal when gstEnabled is false
    expect(patch.total).toBe("15000.00");
  });

  it("response body includes the final claim with subtotal equal to the release amount", async () => {
    const res = await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/claims`)
      .send(retentionReleaseBody);

    expect(res.status).toBe(201);
    expect(res.body.claim).toBeDefined();
    // freshReleaseClaim.subtotal is set to "15000.00" by setupHappyPath —
    // the value the route returns after persisting the computed totals.
    expect(res.body.claim.subtotal).toBe("15000.00");
  });
});

describe("POST /api/jobs/:jobId/claims — concurrent retention release race", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  /**
   * Fires two simultaneous Retention Release requests against the same job.
   * The application-level duplicate guard runs before createClaim, so both
   * requests can pass it when they race.  The database unique index
   * (idx_claims_one_retention_release_active) is the final backstop: the
   * second insert throws a 23505 constraint violation which the handler must
   * translate to 409 rather than 500.
   *
   * We simulate this by making createClaim succeed on the first call and throw
   * the constraint error on the second call, mirroring what PostgreSQL does
   * when both requests reach the INSERT concurrently.
   */
  it("returns 201 for one request and 409 for the other when two concurrent requests race", async () => {
    const constraintError = Object.assign(new Error("duplicate key value violates unique constraint"), {
      code: "23505",
      constraint: "idx_claims_one_retention_release_active",
    });

    // First call succeeds (one request wins); second call hits the DB constraint.
    mockCreateClaim
      .mockResolvedValueOnce(createdClaim)
      .mockRejectedValueOnce(constraintError);

    const app = buildApp();

    const [res1, res2] = await Promise.all([
      request(app).post(`/api/jobs/${JOB_ID}/claims`).send(retentionReleaseBody),
      request(app).post(`/api/jobs/${JOB_ID}/claims`).send(retentionReleaseBody),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const failed = res1.status === 409 ? res1 : res2;
    expect(failed.body.error).toMatch(/concurrent request/i);
    // Must not be a generic 500
    expect(failed.status).not.toBe(500);
  });
});

describe("POST /api/jobs/:jobId/claims — blank retentionPercent on variation line items", () => {
  beforeEach(() => vi.clearAllMocks());

  /**
   * The web wizard submits variation line items with `retentionPercent: ""`
   * (blank, not null) because the field is left empty until the user explicitly
   * overrides it.  The server must fall back to the claim-level retention rate
   * rather than persisting "0.00" (which would under-withhold retention).
   */
  it("falls back to the claim retention rate when a line item retentionPercent is blank", async () => {
    const jobId = "job-with-variation";
    const variationId = "var-approved-1";
    const claimId = "claim-variation-1";

    mockGetJob.mockResolvedValue({
      id: jobId,
      userId: USER_ID,
      jobType: "project",
      retentionPercent: "5.00",
      practicalCompletionDate: null,
      defectsLiabilityMonths: 12,
      title: "Variation Test Job",
    });
    mockGetClaims.mockResolvedValue([]); // no existing claims
    mockGetNextClaimNumber.mockResolvedValue("PC-001");
    mockGetBusinessSettings.mockResolvedValue({ gstEnabled: false });
    mockGetJobVariations.mockResolvedValue([
      {
        id: variationId,
        status: "approved",
        title: "Extra earthworks",
        number: "V001",
        totalAmount: "11000.00",
        additionalAmount: "10000.00",
      },
    ]);
    const createdVariationClaim = { id: claimId, jobId, userId: USER_ID, status: "draft", retentionPercent: "5.00", notes: null };
    mockCreateClaim.mockResolvedValue(createdVariationClaim);
    const variationLineItem = {
      id: "li-var-1",
      claimId,
      description: "Variation V001: Extra earthworks",
      contractValue: "10000.00",
      previouslyClaimed: "0.00",
      thisClaim: "10000.00",
      retentionPercent: "5.00", // storage returns the persisted rate
      retentionAmount: "500.00",
      sortOrder: 0,
    };
    mockCreateClaimLineItem.mockResolvedValue(variationLineItem);
    mockGetClaimLineItems.mockResolvedValue([variationLineItem]);
    mockUpdateClaim.mockResolvedValue(createdVariationClaim);
    mockGetClaim.mockResolvedValue(createdVariationClaim);

    // Wizard-style POST: blank retentionPercent on the variation line item
    const res = await request(buildApp())
      .post(`/api/jobs/${jobId}/claims`)
      .send({
        retentionPercent: "5.00",
        lineItems: [
          {
            variationId,
            description: "Variation V001: Extra earthworks",
            contractValue: "10000.00",
            previouslyClaimed: "0.00",
            thisClaim: "10000.00",
            retentionPercent: "",   // blank — wizard default before user edits
          },
        ],
      });

    expect(res.status).toBe(201);

    // The server must have passed the claim-level rate ("5.00"), not "" or "0"
    expect(mockCreateClaimLineItem).toHaveBeenCalledOnce();
    const persistedRate = mockCreateClaimLineItem.mock.calls[0][0].retentionPercent;
    expect(persistedRate).toBe("5.00");
    expect(persistedRate).not.toBe("");
    expect(parseFloat(persistedRate)).toBeGreaterThan(0);
  });

  it("respects an explicit non-blank per-line retentionPercent override", async () => {
    const jobId = "job-override-retention";
    const variationId = "var-approved-2";
    const claimId = "claim-override-1";

    mockGetJob.mockResolvedValue({
      id: jobId,
      userId: USER_ID,
      jobType: "project",
      retentionPercent: "5.00",
      practicalCompletionDate: null,
      defectsLiabilityMonths: 12,
      title: "Override Test Job",
    });
    mockGetClaims.mockResolvedValue([]);
    mockGetNextClaimNumber.mockResolvedValue("PC-001");
    mockGetBusinessSettings.mockResolvedValue({ gstEnabled: false });
    mockGetJobVariations.mockResolvedValue([
      {
        id: variationId,
        status: "approved",
        title: "Waterproofing",
        number: "V002",
        totalAmount: "5500.00",
        additionalAmount: "5000.00",
      },
    ]);
    const createdCl = { id: claimId, jobId, userId: USER_ID, status: "draft", retentionPercent: "5.00", notes: null };
    mockCreateClaim.mockResolvedValue(createdCl);
    mockCreateClaimLineItem.mockResolvedValue({ id: "li-ov-1", claimId, retentionPercent: "2.50" });
    mockGetClaimLineItems.mockResolvedValue([{ id: "li-ov-1", claimId, retentionPercent: "2.50", thisClaim: "5000.00", retentionAmount: "125.00" }]);
    mockUpdateClaim.mockResolvedValue(createdCl);
    mockGetClaim.mockResolvedValue(createdCl);

    const res = await request(buildApp())
      .post(`/api/jobs/${jobId}/claims`)
      .send({
        retentionPercent: "5.00",
        lineItems: [
          {
            variationId,
            description: "Variation V002: Waterproofing",
            contractValue: "5000.00",
            previouslyClaimed: "0.00",
            thisClaim: "5000.00",
            retentionPercent: "2.50",   // explicit override — must be respected
          },
        ],
      });

    expect(res.status).toBe(201);

    const persistedRate = mockCreateClaimLineItem.mock.calls[0][0].retentionPercent;
    expect(persistedRate).toBe("2.50");
  });
});
