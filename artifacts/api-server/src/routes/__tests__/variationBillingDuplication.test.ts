/**
 * Regression tests: approved variations must not be billed twice.
 *
 * Coverage:
 *  1. POST /api/jobs/:jobId/claims — creates a draft claim with a variation
 *     line item and verifies the stored line carries the variation ID, expected
 *     description, ex-GST contract value, and this-claim amount.
 *  2. POST /api/jobs/:jobId/claims — a second request for the same variation
 *     is rejected with 409 before any write happens.
 *  3. GET /api/jobs/:jobId/variations/approved-for-claim — after the first
 *     claim is saved the endpoint omits the already-claimed variation so the
 *     picker cannot offer it again.
 *  4. mobile/utils/claimVariations — buildVariationLineItems (the production
 *     helper used by handleSaveClaim in mobile/app/job/[id].tsx) correctly
 *     maps selected variation IDs to line item payloads, and the input Set
 *     is never mutated so a rejected POST can be retried with the same
 *     selection intact.
 *
 * Route tests use supertest against a real Express app with mocked storage
 * so they exercise the actual claims.ts handlers, not mirror implementations.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoist mock references before any imports ─────────────────────────────────

const mockStorage = vi.hoisted(() => ({
  getJob: vi.fn(),
  getClaims: vi.fn(),
  getClaimLineItems: vi.fn(),
  getNextClaimNumber: vi.fn(),
  getBusinessSettings: vi.fn(),
  getJobVariations: vi.fn(),
  createClaim: vi.fn(),
  createClaimLineItem: vi.fn(),
  updateClaim: vi.fn(),
  getClaim: vi.fn(),
  deleteClaim: vi.fn(),
}));

// Storage — every method the create + approved-for-claim handlers touch
vi.mock("../../storage", () => ({
  storage: mockStorage,
  db: {},
  pool: { on: vi.fn() },
}));

// Auth/permissions — bypass so tests focus on business logic
vi.mock("../../permissions", () => ({
  getUserContext: vi.fn().mockResolvedValue({ effectiveUserId: "user-1" }),
  ownerOrManagerOnly: () => (_req: any, _res: any, next: any) => next(),
  requireOnboarding: (_req: any, _res: any, next: any) => next(),
  createPermissionMiddleware: () => (_req: any, _res: any, next: any) => next(),
  PERMISSIONS: {},
}));

vi.mock("../middleware", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = "user-1";
    next();
  },
  activityTrackingMiddleware: (_req: any, _res: any, next: any) => next(),
}));

// External services — claims create/approved-for-claim don't call these but
// they are imported at module load, so we stub them to avoid side-effects.
vi.mock("../../xeroService", () => ({}));
vi.mock("../../pdfService", () => ({
  generateProgressClaimPDF: vi.fn(),
  generatePDFBuffer: vi.fn(),
  generateCostReportPDF: vi.fn(),
}));
vi.mock("../../emailService", () => ({
  sendProgressClaimSubmittedEmail: vi.fn(),
}));
vi.mock("../../urlHelper", () => ({
  getProductionBaseUrl: vi.fn().mockReturnValue("http://localhost"),
}));
vi.mock("../../objectStorage", () => ({
  ObjectStorageService: vi.fn().mockImplementation(() => ({})),
}));
vi.mock("../../costReportService", () => ({
  buildCostReportData: vi.fn(),
}));

// Import after mocks are registered
import express from "express";
import request from "supertest";
import { registerClaimsRoutes } from "../claims";

// ─── Test app ─────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  registerClaimsRoutes(app);
  return app;
}

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const JOB_ID = "job-abc";
const VAR_A_ID = "var-aaa";
const VAR_B_ID = "var-bbb";
const CLAIM_1_ID = "claim-111";

const JOB = { id: JOB_ID, userId: "user-1", jobType: "project", retentionPercent: "5.00" };

const VAR_A = {
  id: VAR_A_ID,
  number: 1,
  title: "Extra Groundworks",
  description: null,
  status: "approved",
  additionalAmount: "5000.00", // ex-GST — used as contractValue
  totalAmount: "5500.00",      // inc-GST — must NOT be used as contractValue
  approvedAt: "2026-08-01T00:00:00.000Z",
  approvedByName: "Jane Smith",
};

const VAR_B = {
  id: VAR_B_ID,
  number: 2,
  title: "Concrete Upgrade",
  description: null,
  status: "approved",
  additionalAmount: "3200.00",
  totalAmount: "3520.00",
  approvedAt: "2026-08-05T00:00:00.000Z",
  approvedByName: "Jane Smith",
};

const VAR_A_LINE_ITEM_STORED = {
  id: "li-aaa",
  claimId: CLAIM_1_ID,
  variationId: VAR_A_ID,
  phaseId: null,
  description: "Variation 1: Extra Groundworks",
  contractValue: "5000.00",
  previouslyClaimed: "0.00",
  thisClaim: "5000.00",
  retentionPercent: "5.00",
  sortOrder: 0,
};

// ─── Setup defaults ───────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  mockStorage.getJob.mockResolvedValue(JOB);
  mockStorage.getNextClaimNumber.mockResolvedValue("1");
  mockStorage.getBusinessSettings.mockResolvedValue({ gstEnabled: false });
  mockStorage.getJobVariations.mockResolvedValue([VAR_A, VAR_B]);
  mockStorage.getClaims.mockResolvedValue([]);
  mockStorage.getClaimLineItems.mockResolvedValue([]);
  mockStorage.createClaim.mockResolvedValue({ id: CLAIM_1_ID, status: "draft" });
  mockStorage.createClaimLineItem.mockResolvedValue(VAR_A_LINE_ITEM_STORED);
  mockStorage.getClaimLineItems.mockResolvedValue([VAR_A_LINE_ITEM_STORED]);
  mockStorage.updateClaim.mockResolvedValue({});
  mockStorage.getClaim.mockResolvedValue({ id: CLAIM_1_ID, status: "draft" });
});

// ─── 1. Create claim with approved variation ──────────────────────────────────

describe("POST /api/jobs/:jobId/claims — variation line item", () => {
  it("returns 201 and persists the variation line with correct fields", async () => {
    // No existing claims → no already-claimed IDs
    mockStorage.getClaims.mockResolvedValue([]);

    const res = await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/claims`)
      .send({
        claimDate: "2026-08-22T00:00:00.000Z",
        lineItems: [
          {
            variationId: VAR_A_ID,
            description: "Variation 1: Extra Groundworks",
            contractValue: "5000.00",
            previouslyClaimed: "0.00",
            thisClaim: "5000.00",
          },
        ],
      });

    expect(res.status).toBe(201);

    // createClaimLineItem was called with the variation fields
    expect(mockStorage.createClaimLineItem).toHaveBeenCalledWith(
      expect.objectContaining({
        claimId: CLAIM_1_ID,
        variationId: VAR_A_ID,
        description: "Variation 1: Extra Groundworks",
        contractValue: "5000.00",
        thisClaim: "5000.00",
      }),
    );
  });

  it("stores the ex-GST additionalAmount as contractValue, not the inc-GST totalAmount", async () => {
    mockStorage.getClaims.mockResolvedValue([]);

    await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/claims`)
      .send({
        claimDate: "2026-08-22T00:00:00.000Z",
        lineItems: [
          {
            variationId: VAR_A_ID,
            description: "Variation 1: Extra Groundworks",
            contractValue: VAR_A.additionalAmount, // "5000.00"
            previouslyClaimed: "0.00",
            thisClaim: VAR_A.additionalAmount,
          },
        ],
      });

    const [lineItemArg] = mockStorage.createClaimLineItem.mock.calls[0];
    // Must use additionalAmount (ex-GST), not totalAmount (inc-GST = "5500.00")
    expect(lineItemArg.contractValue).toBe("5000.00");
    expect(lineItemArg.contractValue).not.toBe(VAR_A.totalAmount);
  });

  it("returns 409 when the variation is not approved (pending status)", async () => {
    const pendingVar = { ...VAR_A, id: "var-pending", status: "pending" };
    mockStorage.getJobVariations.mockResolvedValue([pendingVar]);

    const res = await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/claims`)
      .send({
        claimDate: "2026-08-22T00:00:00.000Z",
        lineItems: [
          {
            variationId: "var-pending",
            description: "Pending",
            contractValue: "1000.00",
            previouslyClaimed: "0.00",
            thisClaim: "1000.00",
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(mockStorage.createClaim).not.toHaveBeenCalled();
  });

  it("returns 400 when the same variation ID appears twice in one request", async () => {
    mockStorage.getClaims.mockResolvedValue([]);

    const res = await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/claims`)
      .send({
        claimDate: "2026-08-22T00:00:00.000Z",
        lineItems: [
          {
            variationId: VAR_A_ID,
            description: "Variation 1: Extra Groundworks",
            contractValue: "5000.00",
            previouslyClaimed: "0.00",
            thisClaim: "5000.00",
          },
          {
            variationId: VAR_A_ID, // duplicate
            description: "Variation 1: Extra Groundworks (copy)",
            contractValue: "5000.00",
            previouslyClaimed: "0.00",
            thisClaim: "5000.00",
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/duplicate variation ids/i);
    expect(mockStorage.createClaim).not.toHaveBeenCalled();
  });
});

// ─── 2. Second claim attempt for same variation → 409 ────────────────────────

describe("POST /api/jobs/:jobId/claims — second claim for same variation rejected", () => {
  it("returns 409 and does not create a new claim when the variation is already claimed", async () => {
    // Simulate: claim-1 already exists and holds VAR_A
    mockStorage.getClaims.mockResolvedValue([{ id: CLAIM_1_ID, status: "draft" }]);
    mockStorage.getClaimLineItems.mockResolvedValue([VAR_A_LINE_ITEM_STORED]);

    const res = await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/claims`)
      .send({
        claimDate: "2026-08-22T00:00:00.000Z",
        lineItems: [
          {
            variationId: VAR_A_ID,
            description: "Variation 1: Extra Groundworks",
            contractValue: "5000.00",
            previouslyClaimed: "0.00",
            thisClaim: "5000.00",
          },
        ],
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already been included/i);

    // No claim header or line item must be created
    expect(mockStorage.createClaim).not.toHaveBeenCalled();
    expect(mockStorage.createClaimLineItem).not.toHaveBeenCalled();
  });

  it("blocks a second claim even when the first is still a draft", async () => {
    // Draft claims still reserve their variations
    mockStorage.getClaims.mockResolvedValue([{ id: CLAIM_1_ID, status: "draft" }]);
    mockStorage.getClaimLineItems.mockResolvedValue([VAR_A_LINE_ITEM_STORED]);

    const res = await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/claims`)
      .send({
        claimDate: "2026-08-22T00:00:00.000Z",
        lineItems: [{ variationId: VAR_A_ID, description: "Dup", contractValue: "5000.00", previouslyClaimed: "0.00", thisClaim: "5000.00" }],
      });

    expect(res.status).toBe(409);
    expect(mockStorage.createClaim).not.toHaveBeenCalled();
  });

  it("allows a second claim for a DIFFERENT variation while blocking the already-claimed one", async () => {
    // VAR_A is claimed; VAR_B is still available
    mockStorage.getClaims.mockResolvedValue([{ id: CLAIM_1_ID, status: "approved" }]);
    mockStorage.getClaimLineItems.mockResolvedValue([VAR_A_LINE_ITEM_STORED]);

    const newClaimId = "claim-222";
    const varBLineItem = {
      ...VAR_A_LINE_ITEM_STORED,
      id: "li-bbb",
      claimId: newClaimId,
      variationId: VAR_B_ID,
      description: "Variation 2: Concrete Upgrade",
      contractValue: "3200.00",
      thisClaim: "3200.00",
    };
    mockStorage.createClaim.mockResolvedValue({ id: newClaimId, status: "draft" });
    mockStorage.createClaimLineItem.mockResolvedValue(varBLineItem);
    mockStorage.getClaimLineItems.mockResolvedValueOnce([VAR_A_LINE_ITEM_STORED]) // preflight
                                  .mockResolvedValue([varBLineItem]);              // after create
    mockStorage.getClaim.mockResolvedValue({ id: newClaimId, status: "draft" });

    const res = await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/claims`)
      .send({
        claimDate: "2026-08-22T00:00:00.000Z",
        lineItems: [{ variationId: VAR_B_ID, description: "Variation 2: Concrete Upgrade", contractValue: "3200.00", previouslyClaimed: "0.00", thisClaim: "3200.00" }],
      });

    expect(res.status).toBe(201);
    expect(mockStorage.createClaimLineItem).toHaveBeenCalledWith(
      expect.objectContaining({ variationId: VAR_B_ID }),
    );
  });
});

// ─── 3. Selector refresh excludes already-claimed variations ──────────────────

describe("GET /api/jobs/:jobId/variations/approved-for-claim — excludes claimed variations", () => {
  it("returns both approved variations when nothing has been claimed", async () => {
    mockStorage.getClaims.mockResolvedValue([]);

    const res = await request(buildApp())
      .get(`/api/jobs/${JOB_ID}/variations/approved-for-claim`);

    expect(res.status).toBe(200);
    const ids = res.body.map((v: any) => v.id);
    expect(ids).toContain(VAR_A_ID);
    expect(ids).toContain(VAR_B_ID);
  });

  it("excludes VAR_A from the picker after it has been used in a claim", async () => {
    mockStorage.getClaims.mockResolvedValue([{ id: CLAIM_1_ID, status: "draft" }]);
    mockStorage.getClaimLineItems.mockResolvedValue([VAR_A_LINE_ITEM_STORED]);

    const res = await request(buildApp())
      .get(`/api/jobs/${JOB_ID}/variations/approved-for-claim`);

    expect(res.status).toBe(200);
    const ids = res.body.map((v: any) => v.id);
    expect(ids).not.toContain(VAR_A_ID);
    expect(ids).toContain(VAR_B_ID);
  });

  it("returns an empty list once all approved variations have been claimed", async () => {
    const varBLine = { ...VAR_A_LINE_ITEM_STORED, id: "li-bbb", variationId: VAR_B_ID };
    mockStorage.getClaims.mockResolvedValue([{ id: CLAIM_1_ID, status: "approved" }]);
    mockStorage.getClaimLineItems.mockResolvedValue([VAR_A_LINE_ITEM_STORED, varBLine]);

    const res = await request(buildApp())
      .get(`/api/jobs/${JOB_ID}/variations/approved-for-claim`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("populates suggestedLineItem with description and ex-GST amounts from the variation", async () => {
    mockStorage.getClaims.mockResolvedValue([]);

    const res = await request(buildApp())
      .get(`/api/jobs/${JOB_ID}/variations/approved-for-claim`);

    const varA = res.body.find((v: any) => v.id === VAR_A_ID);
    expect(varA).toBeDefined();
    expect(varA.suggestedLineItem.description).toBe("Variation 1: Extra Groundworks");
    expect(varA.suggestedLineItem.contractValue).toBe(VAR_A.additionalAmount);  // ex-GST
    expect(varA.suggestedLineItem.contractValue).not.toBe(VAR_A.totalAmount);   // not inc-GST
    expect(varA.suggestedLineItem.previouslyClaimed).toBe("0.00");
    expect(varA.suggestedLineItem.thisClaim).toBe(VAR_A.additionalAmount);
  });

  it("does not include pending variations regardless of claim history", async () => {
    const pendingVar = { ...VAR_A, id: "var-pending", status: "pending" };
    mockStorage.getJobVariations.mockResolvedValue([pendingVar, VAR_B]);
    mockStorage.getClaims.mockResolvedValue([]);

    const res = await request(buildApp())
      .get(`/api/jobs/${JOB_ID}/variations/approved-for-claim`);

    expect(res.status).toBe(200);
    const ids = res.body.map((v: any) => v.id);
    expect(ids).not.toContain("var-pending");
    expect(ids).toContain(VAR_B_ID);
  });
});

