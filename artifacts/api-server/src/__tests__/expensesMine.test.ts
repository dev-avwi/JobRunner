/**
 * Tests for GET /api/expenses/mine
 *
 * Verifies that:
 *   1. The WHERE clause is built using `expenses.submittedByUserId` as the
 *      filter column — not some other column — and the authenticated worker's
 *      ID as the value.
 *   2. A different authenticated user causes a different WHERE predicate.
 *   3. The endpoint returns 401 when called without authentication.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Hoisted sentinels ─────────────────────────────────────────────────────────

/**
 * Unique symbol standing in for the real drizzle column reference
 * `expenses.submittedByUserId`.  Using a Symbol means only code that
 * reads `expensesTable.submittedByUserId` from our mock can produce it —
 * a regression using e.g. `expensesTable.id` would produce a different value.
 */
const SUBMITTED_BY_COL = vi.hoisted(() => Symbol("expenses.submittedByUserId"));

/**
 * eq() returns a tagged object that carries both arguments.  Tests then
 * inspect what mockWhere() was called with to confirm the predicate uses
 * the correct column AND the correct user ID.
 */
const mockEq = vi.hoisted(() =>
  vi.fn((col: unknown, val: unknown) => ({ __eqCol: col, __eqVal: val }))
);

// Drizzle select chain terminal — its resolved value is sent to the client
const mockOrderBy = vi.hoisted(() => vi.fn());
const mockWhere = vi.hoisted(() => vi.fn(() => ({ orderBy: mockOrderBy })));
const mockLeftJoin2 = vi.hoisted(() => vi.fn(() => ({ where: mockWhere })));
const mockLeftJoin1 = vi.hoisted(() => vi.fn(() => ({ leftJoin: mockLeftJoin2 })));
const mockFrom = vi.hoisted(() => vi.fn(() => ({ leftJoin: mockLeftJoin1 })));
const mockSelect = vi.hoisted(() => vi.fn(() => ({ from: mockFrom })));

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    db: { select: mockSelect },
    /**
     * The route accesses (expensesTable as any).submittedByUserId inside
     * the WHERE clause.  We give it our sentinel so eq() receives a value
     * we can assert on.  Other columns are given distinct symbols so we can
     * confirm they are NOT the one passed to where().
     */
    expenses: {
      submittedByUserId: SUBMITTED_BY_COL,
      id: Symbol("expenses.id"),
      jobId: Symbol("expenses.jobId"),
      categoryId: Symbol("expenses.categoryId"),
      amount: Symbol("expenses.amount"),
      gstAmount: Symbol("expenses.gstAmount"),
      description: Symbol("expenses.description"),
      vendor: Symbol("expenses.vendor"),
      expenseDate: Symbol("expenses.expenseDate"),
      status: Symbol("expenses.status"),
      rejectionReason: Symbol("expenses.rejectionReason"),
      createdAt: Symbol("expenses.createdAt"),
    },
    expenseCategories: {
      id: Symbol("expenseCategories.id"),
      name: Symbol("expenseCategories.name"),
    },
    jobs: {
      id: Symbol("jobs.id"),
      title: Symbol("jobs.title"),
    },
  };
});

/**
 * Override drizzle-orm's eq with our spy so we can capture both arguments.
 * desc() is also used in orderBy; keep the real implementation for everything
 * else to avoid breaking unrelated route behaviour.
 */
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return { ...actual, eq: mockEq };
});

vi.mock("../routes/middleware", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const uid = req.headers["x-user-id"];
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    req.userId = uid;
    next();
  },
}));

vi.mock("../storage", () => ({
  storage: {
    getExpense: vi.fn(),
    updateExpense: vi.fn(),
    getJob: vi.fn(),
    getJobAssignments: vi.fn(),
  },
}));

vi.mock("../permissions", () => ({
  createPermissionMiddleware: () => (req: any, _res: any, next: any) => {
    req.effectiveUserId = req.headers["x-effective-user-id"] || req.headers["x-user-id"];
    next();
  },
  ownerOrManagerOnly: () => (_req: any, _res: any, next: any) => next(),
  PERMISSIONS: { WRITE_EXPENSES: "write_expenses" },
  getUserContext: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock("../phaseExpenseAttribution", () => ({
  assertExpensePhaseAssignment: vi.fn().mockResolvedValue(undefined),
  ExpensePhaseValidationError: class extends Error {},
}));

vi.mock("../notifications", () => ({
  createNotification: vi.fn(),
  notifyExpenseDecision: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { registerExpenseRoutes } from "../routes/expenses";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  registerExpenseRoutes(app);
  return app;
}

/** Returns the tagged object that eq() produced for the WHERE clause. */
function wherePredicateArg(): { __eqCol: unknown; __eqVal: unknown } | undefined {
  // mockWhere is called once with the result of eq(submittedByUserId, userId)
  const calls = mockWhere.mock.calls as unknown as Array<[unknown]>;
  if (!calls.length) return undefined;
  return calls[0][0] as { __eqCol: unknown; __eqVal: unknown };
}

const WORKER_A_ID = "worker-a";
const WORKER_B_ID = "worker-b";

const WORKER_A_EXPENSES = [
  {
    id: "exp-a1",
    amount: "80.00",
    status: "approved",
    submittedByUserId: WORKER_A_ID,
    expenseDate: "2026-01-10",
  },
  {
    id: "exp-a2",
    amount: "20.00",
    status: "pending",
    submittedByUserId: WORKER_A_ID,
    expenseDate: "2026-01-11",
  },
];

const WORKER_B_EXPENSES = [
  {
    id: "exp-b1",
    amount: "500.00",
    status: "pending",
    submittedByUserId: WORKER_B_ID,
    expenseDate: "2026-01-12",
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/expenses/mine", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();
  });

  it("returns 401 when called without authentication", async () => {
    const res = await request(app).get("/api/expenses/mine");
    expect(res.status).toBe(401);
  });

  it("builds the WHERE predicate on expenses.submittedByUserId (not another column)", async () => {
    mockOrderBy.mockResolvedValue(WORKER_A_EXPENSES);

    await request(app)
      .get("/api/expenses/mine")
      .set("x-user-id", WORKER_A_ID);

    const predicate = wherePredicateArg();
    expect(predicate).toBeDefined();
    // The column passed to eq() must be the submittedByUserId sentinel,
    // not expenses.id, expenses.jobId, or any other column.
    expect(predicate!.__eqCol).toBe(SUBMITTED_BY_COL);
  });

  it("scopes the WHERE predicate to the authenticated worker's ID", async () => {
    mockOrderBy.mockResolvedValue(WORKER_A_EXPENSES);

    await request(app)
      .get("/api/expenses/mine")
      .set("x-user-id", WORKER_A_ID);

    const predicate = wherePredicateArg();
    expect(predicate!.__eqVal).toBe(WORKER_A_ID);
    // Worker B's ID must never appear as the filter value in worker A's request
    expect(predicate!.__eqVal).not.toBe(WORKER_B_ID);
  });

  it("uses worker B's ID in the WHERE predicate when authenticated as worker B", async () => {
    mockOrderBy.mockResolvedValue(WORKER_B_EXPENSES);

    await request(app)
      .get("/api/expenses/mine")
      .set("x-user-id", WORKER_B_ID);

    const predicate = wherePredicateArg();
    expect(predicate!.__eqCol).toBe(SUBMITTED_BY_COL);
    expect(predicate!.__eqVal).toBe(WORKER_B_ID);
    expect(predicate!.__eqVal).not.toBe(WORKER_A_ID);
  });

  it("returns only worker A's scoped rows in the response", async () => {
    mockOrderBy.mockResolvedValue(WORKER_A_EXPENSES);

    const res = await request(app)
      .get("/api/expenses/mine")
      .set("x-user-id", WORKER_A_ID);

    expect(res.status).toBe(200);
    const ids = res.body.map((e: any) => e.id);
    for (const exp of WORKER_A_EXPENSES) expect(ids).toContain(exp.id);
    for (const exp of WORKER_B_EXPENSES) expect(ids).not.toContain(exp.id);
  });

  it("returns an empty array when the authenticated worker has no expenses", async () => {
    mockOrderBy.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/expenses/mine")
      .set("x-user-id", WORKER_A_ID);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 500 when the database query fails", async () => {
    mockOrderBy.mockRejectedValue(new Error("DB connection lost"));

    const res = await request(app)
      .get("/api/expenses/mine")
      .set("x-user-id", WORKER_A_ID);

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: expect.stringContaining("expenses") });
  });
});
