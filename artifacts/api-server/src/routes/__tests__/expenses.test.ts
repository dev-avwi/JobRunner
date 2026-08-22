import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStorage = vi.hoisted(() => ({
  getJob: vi.fn(),
  getJobPhases: vi.fn(),
  getExpenses: vi.fn(),
  createExpense: vi.fn(),
  getExpense: vi.fn(),
  updateExpense: vi.fn(),
}));

vi.mock("../../storage", () => ({ storage: mockStorage }));

vi.mock("../../permissions", () => ({
  createPermissionMiddleware: () => (_req: any, _res: any, next: any) => next(),
  PERMISSIONS: { WRITE_EXPENSES: "write_expenses" },
}));

vi.mock("../middleware", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = "staff-1";
    req.effectiveUserId = "owner-1";
    next();
  },
}));

import express from "express";
import request from "supertest";
import { registerExpenseRoutes } from "../expenses";

const JOB_ID = "job-1";
const PHASE_ID = "phase-1";
const EXPENSE_ID = "expense-1";

const expenseBody = {
  jobId: JOB_ID,
  phaseId: PHASE_ID,
  categoryId: "category-1",
  amount: "125.00",
  description: "Electrical fittings",
  expenseDate: "2026-08-22",
};

function buildApp() {
  const app = express();
  app.use(express.json());
  registerExpenseRoutes(app);
  return app;
}

function setupValidPhase() {
  mockStorage.getJob.mockResolvedValue({ id: JOB_ID, userId: "owner-1" });
  mockStorage.getJobPhases.mockResolvedValue([{ id: PHASE_ID, jobId: JOB_ID }]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("expense phase attribution", () => {
  it("returns stored phase attribution in the expense list", async () => {
    mockStorage.getExpenses.mockResolvedValue([{ id: EXPENSE_ID, ...expenseBody }]);

    const response = await request(buildApp())
      .get(`/api/expenses?jobId=${JOB_ID}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: EXPENSE_ID, ...expenseBody }]);
    expect(mockStorage.getExpenses).toHaveBeenCalledWith("staff-1", {
      jobId: JOB_ID,
      categoryId: undefined,
      startDate: undefined,
      endDate: undefined,
    });
  });

  it("creates an expense with a phase belonging to its job", async () => {
    setupValidPhase();
    mockStorage.createExpense.mockResolvedValue({ id: EXPENSE_ID, ...expenseBody });

    const response = await request(buildApp())
      .post("/api/expenses")
      .send(expenseBody);

    expect(response.status).toBe(201);
    expect(mockStorage.getJob).toHaveBeenCalledWith(JOB_ID, "owner-1");
    expect(mockStorage.getJobPhases).toHaveBeenCalledWith(JOB_ID, "owner-1");
    expect(mockStorage.createExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: JOB_ID,
        phaseId: PHASE_ID,
        userId: "staff-1",
      }),
    );
  });

  it("rejects a phase that belongs to another job before creating the expense", async () => {
    mockStorage.getJob.mockResolvedValue({ id: JOB_ID, userId: "owner-1" });
    mockStorage.getJobPhases.mockResolvedValue([{ id: "phase-from-another-job", jobId: "job-2" }]);

    const response = await request(buildApp())
      .post("/api/expenses")
      .send(expenseBody);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/does not belong to this job/i);
    expect(mockStorage.createExpense).not.toHaveBeenCalled();
  });

  it("rejects a phase assignment when no job is supplied", async () => {
    const { jobId: _jobId, ...bodyWithoutJob } = expenseBody;

    const response = await request(buildApp())
      .post("/api/expenses")
      .send(bodyWithoutJob);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/job is required/i);
    expect(mockStorage.getJob).not.toHaveBeenCalled();
    expect(mockStorage.createExpense).not.toHaveBeenCalled();
  });

  it("rejects an update that would assign a phase from another job", async () => {
    mockStorage.getExpense.mockResolvedValue({
      id: EXPENSE_ID,
      jobId: JOB_ID,
      phaseId: null,
    });
    mockStorage.getJob.mockResolvedValue({ id: JOB_ID, userId: "owner-1" });
    mockStorage.getJobPhases.mockResolvedValue([{ id: "phase-from-another-job", jobId: "job-2" }]);

    const response = await request(buildApp())
      .put(`/api/expenses/${EXPENSE_ID}`)
      .send({ phaseId: PHASE_ID });

    expect(response.status).toBe(400);
    expect(mockStorage.updateExpense).not.toHaveBeenCalled();
  });

  it("allows clearing a phase while retaining the expense job", async () => {
    mockStorage.getExpense.mockResolvedValue({
      id: EXPENSE_ID,
      jobId: JOB_ID,
      phaseId: PHASE_ID,
    });
    mockStorage.getJob.mockResolvedValue({ id: JOB_ID, userId: "owner-1" });
    mockStorage.updateExpense.mockResolvedValue({
      id: EXPENSE_ID,
      jobId: JOB_ID,
      phaseId: null,
    });

    const response = await request(buildApp())
      .put(`/api/expenses/${EXPENSE_ID}`)
      .send({ phaseId: null });

    expect(response.status).toBe(200);
    expect(mockStorage.updateExpense).toHaveBeenCalledWith(
      EXPENSE_ID,
      "staff-1",
      expect.objectContaining({ phaseId: null }),
    );
  });
});