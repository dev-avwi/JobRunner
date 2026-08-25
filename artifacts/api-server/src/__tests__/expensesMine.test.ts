/**
 * Tests for GET /api/expenses/mine
 *
 * Verifies that:
 *   1. The WHERE clause is built exclusively using `expenses.submittedByUserId`.
 *   2. Name-based (ILIKE) fallback is NOT used — two workers with the same
 *      first name cannot retrieve each other's legacy expenses.
 *   3. The endpoint returns 401 when called without authentication.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Hoisted sentinels ─────────────────────────────────────────────────────────

/** Unique symbol for the submittedByUserId column reference. */
const SUBMITTED_BY_COL = vi.hoisted(() => Symbol("expenses.submittedByUserId"));

/**
 * eq() returns a tagged object carrying both arguments so tests can inspect
 * what column and value were used.
 */
const mockEq = vi.hoisted(() =>
  vi.fn((col: unknown, val: unknown) => ({ __eqCol: col, __eqVal: val }))
);

/** or()/and() — tracked to confirm they are never called (no ILIKE branch). */
const mockOr = vi.hoisted(() =>
  vi.fn((...args: unknown[]) => ({ __or: args }))
);
const mockAnd = vi.hoisted(() =>
  vi.fn((...args: unknown[]) => ({ __and: args }))
);

/** sql — tracked to confirm it is never called (no ILIKE branch). */
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
      userId: Symbol("expenses.userId"),
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

vi.mock("../storage", () => ({
  storage: {
    getUser: vi.fn(),
    getExpense: vi.fn(),
    updateExpense: vi.fn(),
    getJob: vi.fn(),
    getJobAssignments: vi.fn(),
  },
}));

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

/** Returns the argument passed to .where(). */
function whereArg(): unknown {
  if (!mockWhere.mock.calls.length) return undefined;
  return mockWhere.mock.calls[0][0];
}

// ── Fixture data ──────────────────────────────────────────────────────────────

const WORKER_A_ID = "worker-a";
const WORKER_B_ID = "worker-b";
// Both workers share the same first name — this is the collision scenario.
const SHARED_FIRST_NAME = "Alex";

const MODERN_EXPENSE_A = {
  id: "exp-a1",
  amount: "80.00",
  status: "approved",
  submittedByUserId: WORKER_A_ID,
  expenseDate: "2026-01-10",
};

const LEGACY_EXPENSE_B = {
  id: "exp-legacy-b",
  amount: "45.00",
  status: "approved",
  submittedByUserId: null,
  description: `[Logged by ${SHARED_FIRST_NAME}] Paint supplies`,
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

    mockGetUserContext.mockResolvedValue({ effectiveUserId: WORKER_A_ID });

    app = buildApp();
  });

  // ── Authentication ──────────────────────────────────────────────────────────

  it("returns 401 when called without authentication", async () => {
    const res = await request(app).get("/api/expenses/mine");
    expect(res.status).toBe(401);
  });

  // ── WHERE predicate is strictly submittedByUserId ───────────────────────────

  it("builds a simple eq predicate on submittedByUserId — no OR, no ILIKE", async () => {
    mockOrderBy.mockResolvedValue([MODERN_EXPENSE_A]);

    await request(app)
      .get("/api/expenses/mine")
      .set("x-user-id", WORKER_A_ID);

    const arg = whereArg() as any;
    expect(arg).toBeDefined();
    expect(arg.__eqCol).toBe(SUBMITTED_BY_COL);
    expect(arg.__eqVal).toBe(WORKER_A_ID);
    // Neither or() nor and() nor sql`` should be invoked — no legacy branch.
    expect(mockOr).not.toHaveBeenCalled();
    expect(mockAnd).not.toHaveBeenCalled();
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("scopes the WHERE predicate to the authenticated worker's own ID", async () => {
    mockOrderBy.mockResolvedValue([MODERN_EXPENSE_A]);

    await request(app)
      .get("/api/expenses/mine")
      .set("x-user-id", WORKER_A_ID);

    const arg = whereArg() as any;
    expect(arg.__eqVal).toBe(WORKER_A_ID);
    expect(arg.__eqVal).not.toBe(WORKER_B_ID);
  });

  it("uses worker B's ID when authenticated as worker B", async () => {
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

  // ── Same-name collision: no cross-worker leakage ────────────────────────────

  it("never uses ILIKE even when two workers share the same first name", async () => {
    // Worker A and Worker B both have firstName = SHARED_FIRST_NAME.
    // Worker A requests /mine — the predicate must still be eq(submittedByUserId, WORKER_A_ID),
    // not an OR that would also match Worker B's legacy expense via the shared name.
    mockOrderBy.mockResolvedValue([]);

    await request(app)
      .get("/api/expenses/mine")
      .set("x-user-id", WORKER_A_ID);

    // Confirm the route never touched or(), and(), or sql().
    expect(mockOr).not.toHaveBeenCalled();
    expect(mockAnd).not.toHaveBeenCalled();
    expect(mockSql).not.toHaveBeenCalled();

    // The WHERE is strictly on submittedByUserId = WORKER_A_ID.
    const arg = whereArg() as any;
    expect(arg.__eqCol).toBe(SUBMITTED_BY_COL);
    expect(arg.__eqVal).toBe(WORKER_A_ID);
  });

  it("does not return a legacy expense belonging to a same-name peer", async () => {
    // The DB correctly returns nothing for Worker A (LEGACY_EXPENSE_B belongs
    // to Worker B, who shares the first name but has a different submittedByUserId).
    mockOrderBy.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/expenses/mine")
      .set("x-user-id", WORKER_A_ID);

    expect(res.status).toBe(200);
    const ids = res.body.map((e: any) => e.id);
    expect(ids).not.toContain(LEGACY_EXPENSE_B.id);
  });

  // ── Departed-worker / replacement scenario ──────────────────────────────────

  it("does not expose a departed worker's legacy expense to a replacement with the same name", async () => {
    // Scenario: the original "Alex" left; a new "Alex" joined and is now the
    // only current team member with that name. The backfill must NOT have set
    // submitted_by_user_id = WORKER_A_ID on the departed worker's expense.
    // The read path must return nothing for the current Alex because the
    // WHERE clause only matches submittedByUserId, and a correctly-disabled
    // backfill would have left the legacy row's submittedByUserId NULL.
    //
    // We simulate this by having the DB return an empty list (the unresolved
    // legacy row has submittedByUserId = NULL, so eq(submittedByUserId, WORKER_A_ID)
    // excludes it), and assert no ILIKE/OR path was attempted.
    mockOrderBy.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/expenses/mine")
      .set("x-user-id", WORKER_A_ID);

    expect(res.status).toBe(200);
    // Replacement worker sees no expenses from the departed worker.
    expect(res.body).toEqual([]);
    // Confirm the route never attempted any name-based OR/ILIKE path.
    expect(mockOr).not.toHaveBeenCalled();
    expect(mockAnd).not.toHaveBeenCalled();
    expect(mockSql).not.toHaveBeenCalled();
  });

  // ── Normal result handling ──────────────────────────────────────────────────

  it("returns the worker's own modern expense row", async () => {
    mockOrderBy.mockResolvedValue([MODERN_EXPENSE_A]);

    const res = await request(app)
      .get("/api/expenses/mine")
      .set("x-user-id", WORKER_A_ID);

    expect(res.status).toBe(200);
    const ids = res.body.map((e: any) => e.id);
    expect(ids).toContain(MODERN_EXPENSE_A.id);
    expect(ids).not.toContain(UNRELATED_EXPENSE.id);
  });

  it("returns an empty array when the worker has no expenses", async () => {
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
