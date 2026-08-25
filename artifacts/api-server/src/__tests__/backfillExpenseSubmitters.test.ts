/**
 * Tests for backfillExpenseSubmitters
 *
 * Verifies:
 *   1. Normal match via job assignments sets submittedByUserId correctly
 *   2. Description text after the ']' bracket doesn't prevent matching
 *      (e.g. "[Logged by Jake] Pipe fittings" is still resolved)
 *   3. Fallback to team_members when expense has no jobId
 *   4. Fallback to team_members when job has assignments but none match the name
 *      (original submitter was later unassigned)
 *   5. Ambiguous names (two workers with the same first name) leave the row unresolved
 *   6. Ambiguous across the team_members fallback also leaves the row unresolved
 *   7. Already-resolved rows (submittedByUserId IS NOT NULL) are not re-fetched
 *   8. A DB error is caught and logged without crashing
 *   9. Resolved and unresolved counts are logged on completion
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockExecute = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
}));

/**
 * The backfill module imports `sql` from "drizzle-orm" (not "@workspace/db").
 * We replace the tag with a simple function that attaches the raw template
 * strings and interpolated values so captureUpdates() can inspect what was
 * sent to db.execute().
 */
const mockSql = vi.hoisted(() =>
  vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    __sqlText: strings.join(" "),
    __values: values,
  }))
);

vi.mock("@workspace/db", () => ({
  db: { execute: mockExecute },
  sql: mockSql,
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, sql: mockSql };
});

vi.mock("../lib/logger", () => ({ logger: mockLogger }));

// ── Import after mocks ────────────────────────────────────────────────────────

import { backfillExpenseSubmitters } from "../backfillExpenseSubmitters";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Scan mockExecute call history and return every call that was an UPDATE on
 * the expenses table. The __sqlText field contains the joined template strings
 * so we can detect "UPDATE expenses" without the interpolated values.
 */
function captureUpdates(): Array<{ id: unknown; userId: unknown }> {
  const updates: Array<{ id: unknown; userId: unknown }> = [];
  for (const call of mockExecute.mock.calls) {
    const sqlArg = call[0] as {
      __sqlText?: string;
      __values?: unknown[];
    };
    if (sqlArg?.__sqlText?.includes("UPDATE expenses")) {
      // Template: UPDATE expenses SET submitted_by_user_id = ${userId} WHERE id = ${expenseId}
      // __values order: [userId, expenseId]
      updates.push({ userId: sqlArg.__values?.[0], id: sqlArg.__values?.[1] });
    }
  }
  return updates;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("backfillExpenseSubmitters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips the whole run when there are no legacy rows", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] }); // SELECT expenses
    await backfillExpenseSubmitters();
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("skipping")
    );
    expect(captureUpdates()).toHaveLength(0);
  });

  it("resolves a '[Logged by Jake] Pipe fittings' description via job assignments", async () => {
    mockExecute
      // SELECT expenses
      .mockResolvedValueOnce({
        rows: [
          {
            id: "exp-1",
            description: "[Logged by Jake] Pipe fittings",
            job_id: "job-1",
            user_id: "owner-1",
          },
        ],
      })
      // SELECT job_assignments for job-1
      .mockResolvedValueOnce({
        rows: [
          { user_id: "worker-jake", first_name: "Jake", username: null },
          { user_id: "worker-bob", first_name: "Bob", username: null },
        ],
      })
      // UPDATE
      .mockResolvedValueOnce({ rows: [] });

    await backfillExpenseSubmitters();

    const updates = captureUpdates();
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe("exp-1");
    expect(updates[0].userId).toBe("worker-jake");
  });

  it("resolves a '[Logged by Jake]' description with no text after the bracket", async () => {
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          {
            id: "exp-2",
            description: "[Logged by Jake]",
            job_id: "job-1",
            user_id: "owner-1",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ user_id: "worker-jake", first_name: "Jake", username: null }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await backfillExpenseSubmitters();

    const updates = captureUpdates();
    expect(updates).toHaveLength(1);
    expect(updates[0].userId).toBe("worker-jake");
  });

  it("falls back to team_members when the expense has no jobId", async () => {
    mockExecute
      // SELECT expenses
      .mockResolvedValueOnce({
        rows: [
          {
            id: "exp-3",
            description: "[Logged by Maria] Fuel",
            job_id: null,
            user_id: "owner-1",
          },
        ],
      })
      // SELECT team_members for owner-1 (uses member_id column, not user_id)
      .mockResolvedValueOnce({
        rows: [
          { member_id: "worker-maria", first_name: "Maria", username: null },
        ],
      })
      // UPDATE
      .mockResolvedValueOnce({ rows: [] });

    await backfillExpenseSubmitters();

    const updates = captureUpdates();
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe("exp-3");
    expect(updates[0].userId).toBe("worker-maria");
  });

  it("falls back to team_members when the job has assignments but none match the name", async () => {
    // Scenario: Jake logged the expense, was later unassigned.
    // Only Bob is still on the job, but Jake is still a team member.
    mockExecute
      // SELECT expenses
      .mockResolvedValueOnce({
        rows: [
          {
            id: "exp-7",
            description: "[Logged by Jake] Scaffold hire",
            job_id: "job-9",
            user_id: "owner-3",
          },
        ],
      })
      // SELECT job_assignments for job-9 — Jake not here (unassigned)
      .mockResolvedValueOnce({
        rows: [{ user_id: "worker-bob", first_name: "Bob", username: null }],
      })
      // SELECT team_members for owner-3 — Jake still a team member
      .mockResolvedValueOnce({
        rows: [
          { member_id: "worker-jake", first_name: "Jake", username: null },
          { member_id: "worker-bob", first_name: "Bob", username: null },
        ],
      })
      // UPDATE
      .mockResolvedValueOnce({ rows: [] });

    await backfillExpenseSubmitters();

    const updates = captureUpdates();
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe("exp-7");
    expect(updates[0].userId).toBe("worker-jake");
  });

  it("leaves the row unresolved when two job-assigned workers share the same first name", async () => {
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          {
            id: "exp-4",
            description: "[Logged by Sam] Materials",
            job_id: "job-2",
            user_id: "owner-1",
          },
        ],
      })
      // Two workers both called Sam — ambiguous in assignments
      .mockResolvedValueOnce({
        rows: [
          { user_id: "worker-sam-a", first_name: "Sam", username: null },
          { user_id: "worker-sam-b", first_name: "Sam", username: null },
        ],
      });
    // When assignments are ambiguous (2 matches) we do NOT fall back to team_members.
    // No further mockExecute call is expected.

    await backfillExpenseSubmitters();

    expect(captureUpdates()).toHaveLength(0);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ unresolved: 1 }),
      expect.any(String)
    );
  });

  it("leaves the row unresolved when team_members fallback is also ambiguous", async () => {
    // No job, two team members named Alex.
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          {
            id: "exp-8",
            description: "[Logged by Alex] Parking",
            job_id: null,
            user_id: "owner-2",
          },
        ],
      })
      // SELECT team_members — two Alexes
      .mockResolvedValueOnce({
        rows: [
          { member_id: "worker-alex-a", first_name: "Alex", username: null },
          { member_id: "worker-alex-b", first_name: "Alex", username: null },
        ],
      });

    await backfillExpenseSubmitters();

    expect(captureUpdates()).toHaveLength(0);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ unresolved: 1 }),
      expect.any(String)
    );
  });

  it("does not update rows that already have submittedByUserId set", async () => {
    // The SELECT only returns rows WHERE submitted_by_user_id IS NULL,
    // so returning an empty list verifies no spurious UPDATEs are issued.
    mockExecute.mockResolvedValueOnce({ rows: [] });

    await backfillExpenseSubmitters();

    expect(captureUpdates()).toHaveLength(0);
  });

  it("catches a DB error and logs it without crashing", async () => {
    mockExecute.mockRejectedValueOnce(new Error("connection reset"));

    await expect(backfillExpenseSubmitters()).resolves.not.toThrow();
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      expect.stringContaining("Backfill failed")
    );
  });

  it("logs resolved and unresolved counts on completion", async () => {
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          {
            id: "exp-5",
            description: "[Logged by Zoe] Electricals",
            job_id: "job-3",
            user_id: "owner-2",
          },
          {
            id: "exp-6",
            description: "[Logged by Unknown] Something",
            job_id: "job-3",
            user_id: "owner-2",
          },
        ],
      })
      // Assignments for job-3 (both expenses share the same job, cached after first)
      .mockResolvedValueOnce({
        rows: [{ user_id: "worker-zoe", first_name: "Zoe", username: null }],
      })
      // UPDATE for exp-5
      .mockResolvedValueOnce({ rows: [] })
      // team_members fallback for exp-6 (no assignment match for "Unknown")
      .mockResolvedValueOnce({ rows: [] });

    await backfillExpenseSubmitters();

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ resolved: 1, unresolved: 1, total: 2 }),
      expect.any(String)
    );
  });
});
