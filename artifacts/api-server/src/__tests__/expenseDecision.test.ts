/**
 * Tests for:
 *   collectExpenseNotificationRecipients  (pure helper)
 *   PUT /api/expenses/:id/approve          (registered route)
 *   PUT /api/expenses/:id/reject           (registered route)
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Hoisted mocks (must be defined before vi.mock factories run) ─────────────

const mockStorage = vi.hoisted(() => ({
  getExpense: vi.fn(),
  updateExpense: vi.fn(),
  getJob: vi.fn(),
  getJobAssignments: vi.fn(),
  createNotification: vi.fn(),
}));

// Mock for the drizzle db.update chain used in the atomic approve/reject
const mockDbReturning = vi.hoisted(() => vi.fn());
const mockDbWhere = vi.hoisted(() => vi.fn(() => ({ returning: mockDbReturning })));
const mockDbSet = vi.hoisted(() => vi.fn(() => ({ where: mockDbWhere })));
const mockDbUpdate = vi.hoisted(() => vi.fn(() => ({ set: mockDbSet })));

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("../storage", () => ({ storage: mockStorage }));

vi.mock("@workspace/db", async (importOriginal) => {
  // Keep everything from the real module but override db and the expenses table
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    db: { update: mockDbUpdate },
    // expenses table needs to be a plain object; the mock WHERE builder doesn't use it
    expenses: {},
  };
});

vi.mock("../permissions", () => ({
  createPermissionMiddleware: () => (req: any, _res: any, next: any) => {
    req.effectiveUserId = req.headers["x-effective-user-id"] || req.headers["x-user-id"];
    next();
  },
  ownerOrManagerOnly: () => (_req: any, _res: any, next: any) => next(),
  PERMISSIONS: { WRITE_EXPENSES: "write_expenses" },
  getUserContext: vi.fn(),
}));

vi.mock("../routes/middleware", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const uid = req.headers["x-user-id"];
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    req.userId = uid;
    next();
  },
}));

vi.mock("../notifications", () => ({
  createNotification: vi.fn(),
  notifyExpenseDecision: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import {
  collectExpenseNotificationRecipients,
  registerExpenseRoutes,
} from "../routes/expenses";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  registerExpenseRoutes(app);
  return app;
}

function authHeaders(userId = "owner-1", effectiveUserId?: string) {
  return {
    "x-user-id": userId,
    "x-effective-user-id": effectiveUserId ?? userId,
  };
}

const PENDING_EXPENSE = {
  id: "exp-1",
  jobId: "job-1",
  status: "pending",
  amount: "150.00",
  userId: "owner-1",
};

const APPROVED_EXPENSE = { ...PENDING_EXPENSE, status: "approved", approvedBy: "owner-1" };
const REJECTED_EXPENSE = { ...PENDING_EXPENSE, status: "rejected", approvedBy: "owner-1" };

// ── collectExpenseNotificationRecipients ─────────────────────────────────────

describe("collectExpenseNotificationRecipients", () => {
  const OWNER = "owner-1";

  it("uses assignment.userId, not teamMemberId, as the notification target", () => {
    const result = collectExpenseNotificationRecipients(
      [{ userId: "worker-1", teamMemberId: "tm-99" } as any],
      null,
      OWNER
    );
    expect(result).toContain("worker-1");
    expect(result).not.toContain("tm-99");
  });

  it("excludes the owner from recipients", () => {
    const result = collectExpenseNotificationRecipients(
      [{ userId: OWNER }, { userId: "worker-1" }],
      null,
      OWNER
    );
    expect(result).not.toContain(OWNER);
    expect(result).toContain("worker-1");
  });

  it("includes the legacy assignedTo worker", () => {
    const result = collectExpenseNotificationRecipients([], "legacy-worker", OWNER);
    expect(result).toContain("legacy-worker");
  });

  it("excludes the owner even when they are the legacy assignedTo", () => {
    const result = collectExpenseNotificationRecipients([], OWNER, OWNER);
    expect(result).not.toContain(OWNER);
  });

  it("deduplicates workers appearing in both assignments and legacy assignedTo", () => {
    const result = collectExpenseNotificationRecipients(
      [{ userId: "worker-1" }],
      "worker-1",
      OWNER
    );
    expect(result.filter((id) => id === "worker-1")).toHaveLength(1);
  });

  it("returns an empty array when there are no workers", () => {
    const result = collectExpenseNotificationRecipients([], null, OWNER);
    expect(result).toHaveLength(0);
  });

  it("handles assignments with null userId gracefully", () => {
    const result = collectExpenseNotificationRecipients(
      [{ userId: null }, { userId: "worker-1" }] as any,
      null,
      OWNER
    );
    expect(result).toEqual(["worker-1"]);
  });

  it("handles multiple workers and a legacy assignee without duplicates", () => {
    const result = collectExpenseNotificationRecipients(
      [{ userId: "worker-1" }, { userId: "worker-2" }],
      "worker-3",
      OWNER
    );
    expect(result.sort()).toEqual(["worker-1", "worker-2", "worker-3"]);
  });
});

// ── PUT /api/expenses/:id/approve ─────────────────────────────────────────────

describe("PUT /api/expenses/:id/approve", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();
    mockStorage.getExpense.mockResolvedValue(PENDING_EXPENSE);
    // Default: DB update succeeds (returns the updated row)
    mockDbReturning.mockResolvedValue([APPROVED_EXPENSE]);
  });

  it("returns 401 when no auth header is provided", async () => {
    const res = await request(app).put("/api/expenses/exp-1/approve").send({});
    expect(res.status).toBe(401);
  });

  it("approves a pending expense and responds 200 with the updated record", async () => {
    const res = await request(app)
      .put("/api/expenses/exp-1/approve")
      .set(authHeaders())
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "approved" });
  });

  it("records the actual decision-maker (userId) in approvedBy", async () => {
    mockDbReturning.mockResolvedValue([{ ...APPROVED_EXPENSE, approvedBy: "manager-1" }]);

    const res = await request(app)
      .put("/api/expenses/exp-1/approve")
      .set(authHeaders("manager-1", "owner-1"))
      .send({});

    expect(res.status).toBe(200);
    // The db.update().set() should have been called with approvedBy = the manager
    expect(mockDbSet).toHaveBeenCalledWith(
      expect.objectContaining({ approvedBy: "manager-1", status: "approved" })
    );
  });

  it("returns 404 when the expense does not exist for this owner", async () => {
    mockStorage.getExpense.mockResolvedValue(undefined);
    const res = await request(app)
      .put("/api/expenses/exp-missing/approve")
      .set(authHeaders())
      .send({});

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: "Expense not found" });
  });

  it("returns 400 when the expense is already approved (pre-check)", async () => {
    mockStorage.getExpense.mockResolvedValue(APPROVED_EXPENSE);
    const res = await request(app)
      .put("/api/expenses/exp-1/approve")
      .set(authHeaders())
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already approved/);
  });

  it("returns 409 when a concurrent request already decided the expense (atomic guard)", async () => {
    // getExpense sees pending, but db update returns 0 rows (race condition)
    mockDbReturning.mockResolvedValue([]);
    const res = await request(app)
      .put("/api/expenses/exp-1/approve")
      .set(authHeaders())
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/no longer pending/i);
  });

  it("does NOT include status=pending check in the pre-check for non-pending expenses", async () => {
    // The pre-check catches already-decided expenses before hitting the DB
    mockStorage.getExpense.mockResolvedValue({ ...PENDING_EXPENSE, status: "rejected" });
    const res = await request(app)
      .put("/api/expenses/exp-1/approve")
      .set(authHeaders())
      .send({});
    expect(res.status).toBe(400);
    // DB update should NOT have been called since pre-check caught it
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });
});

// ── PUT /api/expenses/:id/reject ──────────────────────────────────────────────

describe("PUT /api/expenses/:id/reject", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();
    mockStorage.getExpense.mockResolvedValue(PENDING_EXPENSE);
    mockDbReturning.mockResolvedValue([REJECTED_EXPENSE]);
  });

  it("rejects a pending expense and responds 200 with the updated record", async () => {
    const res = await request(app)
      .put("/api/expenses/exp-1/reject")
      .set(authHeaders())
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "rejected" });
  });

  it("returns 400 when the expense is already rejected (pre-check)", async () => {
    mockStorage.getExpense.mockResolvedValue(REJECTED_EXPENSE);
    const res = await request(app)
      .put("/api/expenses/exp-1/reject")
      .set(authHeaders())
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already rejected/);
  });

  it("returns 409 when a concurrent request already decided the expense (atomic guard)", async () => {
    mockDbReturning.mockResolvedValue([]);
    const res = await request(app)
      .put("/api/expenses/exp-1/reject")
      .set(authHeaders())
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/no longer pending/i);
  });

  it("does not send worker notifications (deferred until submitter tracking is added)", async () => {
    const { notifyExpenseDecision } = await import("../notifications");
    await request(app)
      .put("/api/expenses/exp-1/reject")
      .set(authHeaders())
      .send({});
    expect(notifyExpenseDecision).not.toHaveBeenCalled();
  });
});
