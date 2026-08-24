import { beforeEach, describe, expect, it, vi } from "vitest";

const WORKER_USER_ID = "worker-1";
const OWNER_USER_ID = "owner-1";
const CATEGORY_ID = "category-1";

const mockStorage = vi.hoisted(() => ({
  getJob: vi.fn(),
  getJobPhases: vi.fn(),
  getExpenses: vi.fn(),
  createExpense: vi.fn(),
  getExpense: vi.fn(),
  updateExpense: vi.fn(),
  getExpenseCategories: vi.fn(),
  getJobAssignmentForUser: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("../../storage", () => ({ storage: mockStorage }));

// getUserContext is used only by the new worker expense route
const mockGetUserContext = vi.fn().mockResolvedValue({
  userId: WORKER_USER_ID,
  effectiveUserId: OWNER_USER_ID,
  isOwner: false,
  teamMemberId: "tm-1",
  ownerSubscriptionValid: true,
});

vi.mock("../../permissions", () => ({
  createPermissionMiddleware: () => (_req: any, _res: any, next: any) => next(),
  PERMISSIONS: { WRITE_EXPENSES: "write_expenses" },
  getUserContext: (...args: any[]) => mockGetUserContext(...args),
}));

vi.mock("../../notifications", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

// requireAuth sets both userId (the actual caller) and effectiveUserId (business
// owner scope) so that both the existing owner-level routes and the new worker
// route behave correctly in tests.
vi.mock("../middleware", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = WORKER_USER_ID;
    req.effectiveUserId = OWNER_USER_ID; // used by existing POST/PUT /api/expenses
    next();
  },
}));

import express from "express";
import request from "supertest";
import { registerExpenseRoutes } from "../expenses";
import { createNotification } from "../../notifications";

const JOB_ID = "job-1";
const PHASE_ID = "phase-1";
const EXPENSE_ID = "expense-1";

const expenseBody = {
  jobId: JOB_ID,
  phaseId: PHASE_ID,
  categoryId: CATEGORY_ID,
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
  mockStorage.getJob.mockResolvedValue({ id: JOB_ID, userId: OWNER_USER_ID });
  mockStorage.getJobPhases.mockResolvedValue([{ id: PHASE_ID, jobId: JOB_ID }]);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset to worker context by default; override per test as needed
  mockGetUserContext.mockResolvedValue({
    userId: WORKER_USER_ID,
    effectiveUserId: OWNER_USER_ID,
    isOwner: false,
    teamMemberId: "tm-1",
    ownerSubscriptionValid: true,
  });
});

// ── Existing expense phase attribution tests ──────────────────────────────────

describe("expense phase attribution", () => {
  it("returns stored phase attribution in the expense list", async () => {
    mockStorage.getExpenses.mockResolvedValue([{ id: EXPENSE_ID, ...expenseBody }]);

    const response = await request(buildApp())
      .get(`/api/expenses?jobId=${JOB_ID}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: EXPENSE_ID, ...expenseBody }]);
    expect(mockStorage.getExpenses).toHaveBeenCalledWith(WORKER_USER_ID, {
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
    expect(mockStorage.getJob).toHaveBeenCalledWith(JOB_ID, OWNER_USER_ID);
    expect(mockStorage.getJobPhases).toHaveBeenCalledWith(JOB_ID, OWNER_USER_ID);
    expect(mockStorage.createExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: JOB_ID,
        phaseId: PHASE_ID,
        userId: WORKER_USER_ID,
      }),
    );
  });

  it("rejects a phase that belongs to another job before creating the expense", async () => {
    mockStorage.getJob.mockResolvedValue({ id: JOB_ID, userId: OWNER_USER_ID });
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
    mockStorage.getJob.mockResolvedValue({ id: JOB_ID, userId: OWNER_USER_ID });
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
    mockStorage.getJob.mockResolvedValue({ id: JOB_ID, userId: OWNER_USER_ID });
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
      WORKER_USER_ID,
      expect.objectContaining({ phaseId: null }),
    );
  });
});

// ── Worker job expense (POST /api/jobs/:jobId/expenses) ───────────────────────

describe("worker job expense creation", () => {
  const workerExpenseBody = {
    categoryId: CATEGORY_ID,
    amount: "48.50",
    description: "Conduit and fittings",
    expenseDate: "2026-08-24",
  };

  function setupWorkerExpenseDefaults() {
    mockStorage.getJob.mockResolvedValue({
      id: JOB_ID,
      title: "Residential rewire",
      assignedTo: null,
    });
    mockStorage.getExpenseCategories.mockResolvedValue([
      { id: CATEGORY_ID, name: "Materials" },
    ]);
    mockStorage.getJobAssignmentForUser.mockResolvedValue({
      id: "assign-1",
      jobId: JOB_ID,
      userId: WORKER_USER_ID,
      isActive: true,
    });
    mockStorage.getUser.mockResolvedValue({
      id: WORKER_USER_ID,
      firstName: "Jake",
      username: "jake.m",
    });
    mockStorage.createExpense.mockResolvedValue({
      id: EXPENSE_ID,
      userId: OWNER_USER_ID,
      jobId: JOB_ID,
      ...workerExpenseBody,
      status: "pending",
    });
  }

  it("lets an assigned worker log an expense stored under the business owner's userId", async () => {
    setupWorkerExpenseDefaults();

    const response = await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/expenses`)
      .send(workerExpenseBody);

    expect(response.status).toBe(201);

    // Job and categories looked up under business owner scope
    expect(mockStorage.getJob).toHaveBeenCalledWith(JOB_ID, OWNER_USER_ID);
    expect(mockStorage.getExpenseCategories).toHaveBeenCalledWith(OWNER_USER_ID);

    // Expense persisted under owner's userId so it appears in owner expense lists
    expect(mockStorage.createExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OWNER_USER_ID,
        jobId: JOB_ID,
        status: "pending",
      }),
    );
  });

  it("includes the worker's name in the description for attribution", async () => {
    setupWorkerExpenseDefaults();

    await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/expenses`)
      .send(workerExpenseBody);

    expect(mockStorage.createExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining("Jake"),
      }),
    );
  });

  it("returns 403 when the caller is not assigned to the job", async () => {
    mockGetUserContext.mockResolvedValue({
      userId: WORKER_USER_ID,
      effectiveUserId: OWNER_USER_ID,
      isOwner: false,
      teamMemberId: "tm-1",
      ownerSubscriptionValid: true,
    });
    mockStorage.getJob.mockResolvedValue({
      id: JOB_ID,
      title: "Residential rewire",
      assignedTo: null, // not the worker
    });
    mockStorage.getJobAssignmentForUser.mockResolvedValue(undefined); // no record

    const response = await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/expenses`)
      .send(workerExpenseBody);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/not assigned/i);
    expect(mockStorage.createExpense).not.toHaveBeenCalled();
  });

  it("returns 404 when the job does not belong to this business", async () => {
    mockStorage.getJob.mockResolvedValue(undefined);

    const response = await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/expenses`)
      .send(workerExpenseBody);

    expect(response.status).toBe(404);
    expect(mockStorage.createExpense).not.toHaveBeenCalled();
  });

  it("rejects a categoryId that does not belong to the owner's business", async () => {
    mockStorage.getJob.mockResolvedValue({
      id: JOB_ID,
      title: "Residential rewire",
      assignedTo: WORKER_USER_ID, // legacy assignment
    });
    mockStorage.getExpenseCategories.mockResolvedValue([
      { id: "other-category", name: "Travel" },
    ]);

    const response = await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/expenses`)
      .send({ ...workerExpenseBody, categoryId: "foreign-category" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/invalid expense category/i);
    expect(mockStorage.createExpense).not.toHaveBeenCalled();
  });

  it("resolves the first available category when the placeholder is sent", async () => {
    setupWorkerExpenseDefaults();

    await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/expenses`)
      .send({ ...workerExpenseBody, categoryId: "_worker_receipt_" });

    expect(mockStorage.createExpense).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: CATEGORY_ID }),
    );
  });

  it("bypasses the assignment check when the caller is the business owner", async () => {
    mockGetUserContext.mockResolvedValue({
      userId: OWNER_USER_ID,
      effectiveUserId: OWNER_USER_ID,
      isOwner: true,
    });
    mockStorage.getJob.mockResolvedValue({
      id: JOB_ID,
      title: "Owner's own job",
      assignedTo: null,
    });
    mockStorage.getExpenseCategories.mockResolvedValue([
      { id: CATEGORY_ID, name: "Materials" },
    ]);
    mockStorage.createExpense.mockResolvedValue({
      id: EXPENSE_ID,
      userId: OWNER_USER_ID,
      jobId: JOB_ID,
      status: "pending",
    });

    const response = await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/expenses`)
      .send(workerExpenseBody);

    expect(response.status).toBe(201);
    expect(mockStorage.getJobAssignmentForUser).not.toHaveBeenCalled();
  });

  it("notifies the business owner after a worker successfully logs an expense", async () => {
    setupWorkerExpenseDefaults();

    const response = await request(buildApp())
      .post(`/api/jobs/${JOB_ID}/expenses`)
      .send(workerExpenseBody);

    expect(response.status).toBe(201);
    expect(createNotification).toHaveBeenCalledWith(
      expect.anything(), // storage
      expect.objectContaining({
        userId: OWNER_USER_ID,
        type: "expense_logged",
        relatedType: "job",
        relatedId: JOB_ID,
      }),
    );
  });
});
