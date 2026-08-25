/**
 * Tests for GET /api/expenses/mine
 *
 * Verifies that:
 *   1. The WHERE clause is built using `expenses.submittedByUserId` for modern rows.
 *   2. Legacy rows with a "[Logged by <name>]" description prefix are also returned
 *      via an OR condition against the caller's resolved display name.
 *   3. An expense with neither a matching submittedByUserId nor a matching name
 *      prefix is absent from the result.
 *   4. The endpoint returns 401 when called without authentication.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Hoisted sentinels ─────────────────────────────────────────────────────────

/** Unique symbol for the submittedByUserId column reference. */
const SUBMITTED_BY_COL = vi.hoisted(() => Symbol("expenses.submittedByUserId"));
const USER_ID_COL = vi.hoisted(() => Symbol("expenses.userId"));

/**
 * eq() returns a tagged object carrying both arguments so tests can inspect
 * what column and value were used.
 */
const mockEq = vi.hoisted(() =>
  vi.fn((col: unknown, val: unknown) => ({ __eqCol: col, __eqVal: val }))
);

/** or()/and() return tagged objects so tests can verify the OR condition. */
const mockOr = vi.hoisted(() =>
  vi.fn((...args: unknown[]) => ({ __or: args }))
);
const mockAnd = vi.hoisted(() =>
  vi.fn((...args: unknown[]) => ({ __and: args }))
);

/** sql`` tagged template — captures interpolated values for assertion. */
const mockSql = vi.hoisted(() =>
  vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    __sql: { raw: strings.join("?"), values },
  }))
);

/** desc() — mocked so Symbol column values don't throw in the real drizzle impl. */
const mockDesc = vi.hoisted(() => vi.fn((col: unknown) => ({ __desc: col })));

// Drizzle select chain — plain vi.fn() nodes, re-wired in beforeEach so that
// vi.clearAllMocks() cannot silently break the chain between tests.
const mockOrderBy = vi.hoisted(() => vi.fn());
const mockWhere = vi.hoisted(() => vi.fn());
const mockLeftJoin2 = vi.hoisted(() => vi.fn());
const mockLeftJoin1 = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    db: { select: mockSelect },
    expenses: {
      submittedByUserId: SUBMITTED_BY_COL,
      userId: USER_ID_COL,
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

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return { ...actual, eq: mockEq, or: mockOr, and: mockAnd, sql: mockSql, desc: mockDesc };
});

vi.mock("../routes/middleware", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const uid = req.headers["x-user-id"];
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    req.userId = uid;
    next();
  },
}));

// Storage mock includes getUser so the route can resolve the display name.
const mockGetUser = vi.hoisted(() => vi.fn());
vi.mock("../storage", () => ({
  storage: {
    getUser: mockGetUser,
    getExpense: vi.fn(),
    updateExpense: vi.fn(),
    getJob: vi.fn(),
    getJobAssignments: vi.fn(),
  },
}));

// getUserContext is called by the route; return a simple context object.
const mockGetUserContext = vi.hoisted(() => vi.fn());
vi.mock("../permissions", () => ({
  createPermissionMiddleware: () => (req: any, _res: any, next: any) => {
    req.effectiveUserId = req.headers["x-effective-user-id"] || req.headers["x-user-id"];
    next();
  },
  ownerOrManagerOnly: () => (_req: any, _res: any, next: any) => next(),
  PERMISSIONS: { WRITE_EXPENSES: "write_expenses" },
  getUserContext: mockGetUserContext,
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

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { registerExpenseRoutes } from "../routes/expenses";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  registerExpenseRoutes(app);
  return app;
}

/** Returns the argument passed to .where() (eq result or or result). */
function whereArg(): unknown {
  if (!mockWhere.mock.calls.length) return undefined;
  return mockWhere.mock.calls[0][0];
}

// ── Fixture data ──────────────────────────────────────────────────────────────

const WORKER_A_ID = "worker-a";
const WORKER_B_ID = "worker-b";
const WORKER_A_NAME = "Alice";

const MODERN_EXPENSE_A = {
  id: "exp-a1",
  amount: "80.00",
  status: "approved",
  submittedByUserId: WORKER_A_ID,
  expenseDate: "2026-01-10",
};

const LEGACY_EXPENSE_A = {
  id: "exp-legacy-1",
  amount: "45.00",
  status: "approved",
  submittedByUserId: null,
  description: `[Logged by ${WORKER_A_NAME}] Paint supplies`,
  expenseDate: "2025-06-15",
};

const UNRELATED_EXPENSE = {
  id: "exp-unrelated",
  amount: "200.00",
  status: "pending",
  submittedByUserId: WORKER_B_ID,
  description: "Unrelated",
  expenseDate: "2026-01-12",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/expenses/mine", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Re-wire the drizzle select chain after clearAllMocks resets implementations.
    // Chain: select → from → leftJoin → leftJoin → where → orderBy
    mockOrderBy.mockResolvedValue([]);
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockLeftJoin2.mockReturnValue({ where: mockWhere });
    mockLeftJoin1.mockReturnValue({ leftJoin: mockLeftJoin2 });
    mockFrom.mockReturnValue({ leftJoin: mockLeftJoin1 });
    mockSelect.mockReturnValue({ from: mockFrom });

    // Default: no display name → only the submittedByUserId branch fires.
    mockGetUser.mockResolvedValue(null);
    // Default: getUserContext returns a simple identity context.
    mockGetUserContext.mockResolvedValue({ effectiveUserId: WORKER_A_ID });

    app = buildApp();
  });

  // ── Authentication ──────────────────────────────────────────────────────────

  it("returns 401 when called without authentication", async () => {
    const res = await request(app).get("/api/expenses/mine");
    expect(res.status).toBe(401);
  });

  // ── Modern path (submittedByUserId) ─────────────────────────────────────────

  it("builds a simple eq predicate on submittedByUserId when user has no display name", async () => {
    mockGetUser.mockResolvedValue(null);
    mockOrderBy.mockResolvedValue([MODERN_EXPENSE_A]);

    await request(app)
      .get("/api/expenses/mine")
      .set("x-user-id", WORKER_A_ID);

    // No name → no OR; where() receives eq(submittedByUserId, userId) directly.
    const arg = whereArg() as any;
    expect(arg).toBeDefined();
    expect(arg.__eqCol).toBe(SUBMITTED_BY_COL);
    expect(arg.__eqVal).toBe(WORKER_A_ID);
    // or() must NOT have been called when there is no display name.
    expect(mockOr).not.toHaveBeenCalled();
  });

  it("scopes the WHERE predicate to the authenticated worker's ID", async () => {
    mockGetUser.mockResolvedValue(null);
    mockOrderBy.mockResolvedValue([MODERN_EXPENSE_A]);

    await request(app)
      .get("/api/expenses/mine")
      .set("x-user-id", WORKER_A_ID);

    const arg = whereArg() as any;
    expect(arg.__eqVal).toBe(WORKER_A_ID);
    expect(arg.__eqVal).not.toBe(WORKER_B_ID);
  });

  it("uses worker B's ID in the WHERE predicate when authenticated as worker B", async () => {
    mockGetUser.mockResolvedValue(null);
    mockGetUserContext.mockResolvedValue({ effectiveUserId: WORKER_B_ID });
    mockOrderBy.mockResolvedValue([]);

    await request(app)
      .get("/api/expenses/mine")
      .set("x-user-id", WORKER_B_ID);

    const arg = whereArg() as any;
    expect(arg.__eqCol).toBe(SUBMITTED_BY_COL);
    expect(arg.__eqVal).toBe(WORKER_B_ID);
    expect(arg.__eqVal).not.toBe(WORKER_A_ID);
  });

  it("returns the modern expense row in the response", async () => {
    mockGetUser.mockResolvedValue(null);
    mockOrderBy.mockResolvedValue([MODERN_EXPENSE_A]);

    const res = await request(app)
      .get("/api/expenses/mine")
      .set("x-user-id", WORKER_A_ID);

    expect(res.status).toBe(200);
    const ids = res.body.map((e: any) => e.id);
    expect(ids).toContain(MODERN_EXPENSE_A.id);
    expect(ids).not.toContain(UNRELATED_EXPENSE.id);
  });

  // ── Legacy path ([Logged by Name] prefix) ───────────────────────────────────

  it("builds an OR predicate that includes the ILIKE branch when the user has a display name", async () => {
    mockGetUser.mockResolvedValue({ firstName: WORKER_A_NAME, username: "alice123" });
    mockOrderBy.mockResolvedValue([MODERN_EXPENSE_A]);

    await request(app)
      .get("/api/expenses/mine")
      .set("x-user-id", WORKER_A_ID);

    // or() should have been called to combine the modern and legacy branches.
    expect(mockOr).toHaveBeenCalledOnce();
    const [modernBranch] = mockOr.mock.calls[0] as any[];
    expect(modernBranch.__eqCol).toBe(SUBMITTED_BY_COL);
    expect(modernBranch.__eqVal).toBe(WORKER_A_ID);
  });

  it("includes the correct [Logged by Name] ILIKE pattern in the legacy branch", async () => {
    mockGetUser.mockResolvedValue({ firstName: WORKER_A_NAME });
    mockOrderBy.mockResolvedValue([LEGACY_EXPENSE_A]);

    await request(app)
      .get("/api/expenses/mine")
      .set("x-user-id", WORKER_A_ID);

    expect(mockAnd).toHaveBeenCalledOnce();
    expect(mockSql).toHaveBeenCalledOnce();
    const sqlCall = mockSql.mock.calls[0];
    // sql`${col} ILIKE ${pattern} ESCAPE ...`
    // index 0 = TemplateStringsArray, 1 = column symbol, 2 = ILIKE string
    const iLikePattern = sqlCall[2] as string;
    expect(typeof iLikePattern).toBe("string");
    expect(iLikePattern).toMatch(/^\[Logged by Alice\]/);
  });

  it("returns a legacy expense row when the DB resolves it for the OR query", async () => {
    mockGetUser.mockResolvedValue({ firstName: WORKER_A_NAME });
    // Simulate the DB returning the legacy row (matched by the ILIKE branch).
    mockOrderBy.mockResolvedValue([LEGACY_EXPENSE_A]);

    const res = await request(app)
      .get("/api/expenses/mine")
      .set("x-user-id", WORKER_A_ID);

    expect(res.status).toBe(200);
    const ids = res.body.map((e: any) => e.id);
    expect(ids).toContain(LEGACY_EXPENSE_A.id);
  });

  it("confirms an unrelated expense (no matching userId, no matching name prefix) is absent", async () => {
    mockGetUser.mockResolvedValue({ firstName: WORKER_A_NAME });
    // The DB returns nothing — the unrelated expense matched neither branch.
    mockOrderBy.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/expenses/mine")
      .set("x-user-id", WORKER_A_ID);

    expect(res.status).toBe(200);
    const ids = res.body.map((e: any) => e.id);
    expect(ids).not.toContain(UNRELATED_EXPENSE.id);
  });

  // ── Edge cases ──────────────────────────────────────────────────────────────

  it("returns an empty array when the authenticated worker has no expenses", async () => {
    mockGetUser.mockResolvedValue(null);
    mockOrderBy.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/expenses/mine")
      .set("x-user-id", WORKER_A_ID);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 500 when the database query fails", async () => {
    mockGetUser.mockResolvedValue(null);
    mockOrderBy.mockRejectedValue(new Error("DB connection lost"));

    const res = await request(app)
      .get("/api/expenses/mine")
      .set("x-user-id", WORKER_A_ID);

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: expect.stringContaining("expenses") });
  });
});
