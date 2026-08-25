/**
 * Confirms that rejected expenses are excluded from all cost totals
 * produced by buildCostReportData.
 */
import { describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockStorage = vi.hoisted(() => ({
  getJob: vi.fn(),
  getQuotes: vi.fn(),
  getInvoices: vi.fn(),
  getTimeEntries: vi.fn(),
  getExpenses: vi.fn(),
  getTeamMembers: vi.fn(),
  getBusinessSettings: vi.fn(),
  getJobVariations: vi.fn(),
  getJobMaterials: vi.fn(),
  getPurchaseOrdersByJobId: vi.fn(),
  getUserRoles: vi.fn(),
  getUser: vi.fn(),
  getJobPhases: vi.fn(),
  getClaims: vi.fn(),
  getClient: vi.fn(),
}));

vi.mock("../storage", () => ({ storage: mockStorage }));

// pdfService logo helper — not needed for financial logic
vi.mock("../pdfService", () => ({
  resolveBusinessLogoForPdf: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../routes/retentionSummary", () => ({
  computeRetentionSummary: vi.fn().mockReturnValue({ sumRetentionHeld: 0 }),
}));

import { buildCostReportData } from "../costReportService";

// ── Shared fixtures ───────────────────────────────────────────────────────────

const JOB_ID = "job-1";
const OWNER_ID = "owner-1";

const BASE_JOB = {
  id: JOB_ID,
  title: "Test Job",
  jobNumber: "J-001",
  status: "active",
  clientId: null,
};

const BASE_BIZ = { businessName: "Acme", abn: null, phone: null, email: null, address: null };

function seedStorage(expenses: any[]) {
  mockStorage.getJob.mockResolvedValue(BASE_JOB);
  mockStorage.getQuotes.mockResolvedValue([]);
  mockStorage.getInvoices.mockResolvedValue([]);
  mockStorage.getTimeEntries.mockResolvedValue([]);
  mockStorage.getExpenses.mockResolvedValue(expenses);
  mockStorage.getTeamMembers.mockResolvedValue([]);
  mockStorage.getBusinessSettings.mockResolvedValue(BASE_BIZ);
  mockStorage.getJobVariations.mockResolvedValue([]);
  mockStorage.getJobMaterials.mockResolvedValue([]);
  mockStorage.getPurchaseOrdersByJobId.mockResolvedValue([]);
  mockStorage.getUserRoles.mockResolvedValue([]);
  mockStorage.getJobPhases.mockResolvedValue([]);
  mockStorage.getClaims.mockResolvedValue([]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("buildCostReportData — rejected expense exclusion", () => {
  it("excludes a rejected other expense from otherExpenses and totalCosts", async () => {
    seedStorage([
      { id: "e1", status: "approved", amount: "100.00", description: "Tools", categoryName: "Tools" },
      { id: "e2", status: "rejected", amount: "250.00", description: "Tools", categoryName: "Tools" },
    ]);

    const data = await buildCostReportData(JOB_ID, OWNER_ID);

    // Only the approved $100 should count
    expect(data.financial.otherExpenses).toBeCloseTo(100, 2);
    expect(data.financial.totalCosts).toBeCloseTo(100, 2);
  });

  it("excludes a rejected material expense from materialsCost and totalCosts", async () => {
    seedStorage([
      { id: "e1", status: "approved", amount: "200.00", description: "Steel", categoryName: "Material" },
      { id: "e2", status: "rejected", amount: "500.00", description: "Concrete", categoryName: "material" },
    ]);

    const data = await buildCostReportData(JOB_ID, OWNER_ID);

    expect(data.financial.materialsCost).toBeCloseTo(200, 2);
    expect(data.financial.totalCosts).toBeCloseTo(200, 2);
  });

  it("excludes a rejected subcontractor expense from subcontractorCost and totalCosts", async () => {
    seedStorage([
      { id: "e1", status: "approved", amount: "300.00", description: "Subby", categoryName: "Subcontractor" },
      { id: "e2", status: "rejected", amount: "800.00", description: "Another Subby", categoryName: "Subcontractor" },
    ]);

    const data = await buildCostReportData(JOB_ID, OWNER_ID);

    expect(data.financial.subcontractorCost).toBeCloseTo(300, 2);
    expect(data.financial.totalCosts).toBeCloseTo(300, 2);
  });

  it("does not alter totals when there are no rejected expenses", async () => {
    seedStorage([
      { id: "e1", status: "approved", amount: "150.00", description: "Fuel", categoryName: "Fuel" },
      { id: "e2", status: "pending", amount: "50.00", description: "Parking", categoryName: "Parking" },
    ]);

    const data = await buildCostReportData(JOB_ID, OWNER_ID);

    // Both approved and pending count (neither is rejected)
    expect(data.financial.otherExpenses).toBeCloseTo(200, 2);
    expect(data.financial.totalCosts).toBeCloseTo(200, 2);
  });

  it("produces zero costs when all expenses are rejected", async () => {
    seedStorage([
      { id: "e1", status: "rejected", amount: "100.00", description: "Misc", categoryName: "Misc" },
      { id: "e2", status: "rejected", amount: "200.00", description: "Tools", categoryName: "Tools" },
    ]);

    const data = await buildCostReportData(JOB_ID, OWNER_ID);

    expect(data.financial.otherExpenses).toBe(0);
    expect(data.financial.totalCosts).toBe(0);
  });
});
