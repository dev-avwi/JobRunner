/**
 * Tests for non-job time entry categories (travel, admin, training, other).
 *
 * Verifies that:
 *   1. getTeamTimeEntriesInRange uses a left-join on jobs to validate business
 *      ownership of job-linked entries (not just user-ID membership).
 *   2. The join query also restricts job-less entries to those stamped with
 *      the current businessOwnerId — preventing multi-business leakage.
 *   3. createTimeEntry receives businessOwnerId when jobId is absent.
 *   4. businessOwnerId is NOT stamped when a job is provided.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Hoisted column sentinels ──────────────────────────────────────────────────
// vi.mock() factories run before const declarations so all referenced values
// must come from vi.hoisted().

const COL = vi.hoisted(() => ({
  te: {
    userId:          Symbol("te.userId"),
    jobId:           Symbol("te.jobId"),
    startTime:       Symbol("te.startTime"),
    businessOwnerId: Symbol("te.businessOwnerId"),
  },
  j: {
    id:     Symbol("j.id"),
    userId: Symbol("j.userId"),
  },
}));

// ── Drizzle chain capture ─────────────────────────────────────────────────────
// We intercept the Drizzle select chain to capture the WHERE predicate and
// verify that a leftJoin is present (i.e. the query joins on jobs).

const capturedLeftJoin = vi.hoisted(() => ({ table: undefined as unknown, on: undefined as unknown }));
const capturedWhere    = vi.hoisted(() => ({ predicate: undefined as unknown }));
const capturedInsertValues = vi.hoisted(() => ({ row: undefined as unknown }));

const mockReturning  = vi.hoisted(() => vi.fn().mockResolvedValue([{ te: { id: "te-1" } }]));
const mockOrderBy    = vi.hoisted(() => vi.fn().mockReturnValue(Promise.resolve([{ te: { id: "te-1" } }])));
const mockWhere      = vi.hoisted(() =>
  vi.fn((pred) => { capturedWhere.predicate = pred; return { orderBy: mockOrderBy }; })
);
const mockLeftJoin   = vi.hoisted(() =>
  vi.fn((tbl, on) => { capturedLeftJoin.table = tbl; capturedLeftJoin.on = on; return { where: mockWhere }; })
);
const mockFrom       = vi.hoisted(() => vi.fn().mockReturnValue({ leftJoin: mockLeftJoin, where: mockWhere }));
const mockSelect     = vi.hoisted(() => vi.fn().mockReturnValue({ from: mockFrom }));
const mockInsertVals = vi.hoisted(() =>
  vi.fn((row) => { capturedInsertValues.row = row; return { returning: mockReturning }; })
);
const mockInsert     = vi.hoisted(() => vi.fn().mockReturnValue({ values: mockInsertVals }));

// ── Drizzle-orm operator mocks ────────────────────────────────────────────────

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    eq:        vi.fn((a, b) => ({ op: "eq",  a, b })),
    and:       vi.fn((...args: unknown[]) => ({ op: "and", args })),
    or:        vi.fn((...args: unknown[]) => ({ op: "or",  args })),
    inArray:   vi.fn((col, vals) => ({ op: "inArray", col, vals })),
    gte:       vi.fn((col, val) => ({ op: "gte", col, val })),
    lte:       vi.fn((col, val) => ({ op: "lte", col, val })),
    isNull:    vi.fn((col) => ({ op: "isNull", col })),
    isNotNull: vi.fn((col) => ({ op: "isNotNull", col })),
    desc:      vi.fn((col) => ({ op: "desc", col })),
  };
});

// ── @workspace/db mock ────────────────────────────────────────────────────────

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    db: { select: mockSelect, insert: mockInsert },
    timeEntries: {
      userId:          COL.te.userId,
      jobId:           COL.te.jobId,
      startTime:       COL.te.startTime,
      businessOwnerId: COL.te.businessOwnerId,
    },
    jobs: {
      id:     COL.j.id,
      userId: COL.j.userId,
    },
  };
});

// ── Mock heavy transitive dependencies so storage.ts can be imported ──────────

vi.mock("drizzle-orm/node-postgres", () => ({
  // storage.ts does `const db = drizzle(pool, ...)` at module load — return the
  // same mock db object so db.select / db.insert resolve to our intercept fns.
  drizzle: vi.fn(() => ({ select: mockSelect, insert: mockInsert })),
}));
vi.mock("pg", () => {
  class Pool {
    on      = vi.fn();
    query   = vi.fn().mockResolvedValue({ rows: [] });
    connect = vi.fn().mockResolvedValue({ query: vi.fn(), release: vi.fn() });
    end     = vi.fn();
    totalCount   = 0;
    idleCount    = 0;
    waitingCount = 0;
  }
  return { default: { Pool } };
});
vi.mock("../cache",         () => ({ invalidateAggregateDashboard: vi.fn() }));
vi.mock("../websocket",     () => ({ broadcastTimeEntryUpdate: vi.fn(), broadcastJobStatusChange: vi.fn() }));
vi.mock("../liveActivity",  () => ({ broadcastLiveActivityUpdate: vi.fn() }));
vi.mock("../notifications", () => ({ createNotification: vi.fn() }));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const OWNER_A  = "biz-owner-a";
const OWNER_B  = "biz-owner-b";
const WORKER_1 = "worker-1";

const START = new Date("2026-09-11T00:00:00Z");
const END   = new Date("2026-09-11T23:59:59Z");

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Re-wire the chain after clearAllMocks()
  mockReturning.mockResolvedValue([{ te: { id: "te-1" } }]);
  mockOrderBy.mockResolvedValue([{ te: { id: "te-1" } }]);
  mockWhere.mockImplementation((pred) => { capturedWhere.predicate = pred; return { orderBy: mockOrderBy }; });
  mockLeftJoin.mockImplementation((tbl, on) => { capturedLeftJoin.table = tbl; capturedLeftJoin.on = on; return { where: mockWhere }; });
  mockFrom.mockReturnValue({ leftJoin: mockLeftJoin, where: mockWhere });
  mockSelect.mockReturnValue({ from: mockFrom });
  mockInsertVals.mockImplementation((row) => { capturedInsertValues.row = row; return { returning: mockReturning }; });
  mockInsert.mockReturnValue({ values: mockInsertVals });
  capturedLeftJoin.table = undefined;
  capturedLeftJoin.on    = undefined;
  capturedWhere.predicate = undefined;
  capturedInsertValues.row = undefined;
});

// Helper: flatten an AND/OR predicate tree into a flat list of leaf nodes.
function flattenPredicates(pred: unknown): unknown[] {
  if (!pred || typeof pred !== "object") return [pred];
  const p = pred as any;
  if (p.op === "and" || p.op === "or") {
    return (p.args as unknown[]).flatMap(flattenPredicates);
  }
  return [pred];
}

describe("getTeamTimeEntriesInRange — query structure", () => {
  it("issues a leftJoin against the jobs table", async () => {
    // Mock getTeamMembers to return a single member so the function can proceed
    const { storage } = await import("../storage");
    vi.spyOn(storage, "getTeamMembers" as any).mockResolvedValue([
      { memberId: WORKER_1 },
    ]);

    await (storage as any).getTeamTimeEntriesInRange(OWNER_A, START, END);

    // leftJoin must have been called — proves the query joins on a table
    expect(mockLeftJoin).toHaveBeenCalled();
    // The joined table carries the jobs.id and jobs.userId sentinel columns
    expect(capturedLeftJoin.table).toMatchObject({ id: COL.j.id, userId: COL.j.userId });
  });

  it("uses jobs.userId in the WHERE predicate to scope job-linked entries to the business", async () => {
    const { storage } = await import("../storage");
    vi.spyOn(storage, "getTeamMembers" as any).mockResolvedValue([]);

    await (storage as any).getTeamTimeEntriesInRange(OWNER_A, START, END);

    // Flatten all predicates and look for one referencing jobs.userId
    const leaves = flattenPredicates(capturedWhere.predicate);
    const jobsUserIdPred = leaves.find(
      (l: any) => l?.op === "eq" && l?.a === COL.j.userId
    );
    expect(jobsUserIdPred).toBeDefined();
    // The value compared must be the businessOwnerId
    expect((jobsUserIdPred as any)?.b).toBe(OWNER_A);
  });

  it("scopes job-less entries by timeEntries.businessOwnerId in the WHERE predicate", async () => {
    const { storage } = await import("../storage");
    vi.spyOn(storage, "getTeamMembers" as any).mockResolvedValue([]);

    await (storage as any).getTeamTimeEntriesInRange(OWNER_A, START, END);

    const leaves = flattenPredicates(capturedWhere.predicate);
    const bizOwnerPred = leaves.find(
      (l: any) => l?.op === "eq" && l?.a === COL.te.businessOwnerId
    );
    expect(bizOwnerPred).toBeDefined();
    expect((bizOwnerPred as any)?.b).toBe(OWNER_A);
  });

  it("does NOT expose job-less entries from another business (OWNER_B predicate absent for OWNER_A query)", async () => {
    const { storage } = await import("../storage");
    vi.spyOn(storage, "getTeamMembers" as any).mockResolvedValue([]);

    await (storage as any).getTeamTimeEntriesInRange(OWNER_A, START, END);

    const leaves = flattenPredicates(capturedWhere.predicate);
    // OWNER_B must never appear as a comparison value in the predicate tree
    const crossTenantLeak = leaves.find(
      (l: any) => l?.op === "eq" && l?.b === OWNER_B
    );
    expect(crossTenantLeak).toBeUndefined();
  });
});

describe("createTimeEntry — businessOwnerId stamping", () => {
  it("stamps businessOwnerId on a job-less travel entry", async () => {
    const { storage } = await import("../storage");

    await storage.createTimeEntry({
      userId: WORKER_1,
      startTime: START,
      timeCategory: "travel",
      businessOwnerId: OWNER_A,
    } as any);

    expect(capturedInsertValues.row).toMatchObject({
      userId: WORKER_1,
      timeCategory: "travel",
      businessOwnerId: OWNER_A,
    });
  });

  it.each(["travel", "admin", "training", "other"] as const)(
    "accepts '%s' entries with null jobId and businessOwnerId set",
    async (category) => {
      const { storage } = await import("../storage");

      await storage.createTimeEntry({
        userId: WORKER_1,
        startTime: START,
        timeCategory: category,
        jobId: null,
        businessOwnerId: OWNER_A,
      } as any);

      expect(capturedInsertValues.row).toMatchObject({
        timeCategory: category,
        jobId: null,
        businessOwnerId: OWNER_A,
      });
    }
  );

  it("does NOT include businessOwnerId when a jobId is present", async () => {
    const { storage } = await import("../storage");

    await storage.createTimeEntry({
      userId: WORKER_1,
      startTime: START,
      timeCategory: "work",
      jobId: "job-abc",
      // Caller intentionally omits businessOwnerId for job-linked entries
    } as any);

    const row = capturedInsertValues.row as any;
    // businessOwnerId must be absent/undefined — not stamped for job entries
    expect(row?.businessOwnerId).toBeUndefined();
  });

  it("multi-business isolation: entry from Business A carries OWNER_A, not OWNER_B", async () => {
    const { storage } = await import("../storage");

    await storage.createTimeEntry({
      userId: WORKER_1,
      startTime: START,
      timeCategory: "admin",
      jobId: null,
      businessOwnerId: OWNER_A,
    } as any);

    const row = capturedInsertValues.row as any;
    expect(row.businessOwnerId).toBe(OWNER_A);
    expect(row.businessOwnerId).not.toBe(OWNER_B);
  });
});
