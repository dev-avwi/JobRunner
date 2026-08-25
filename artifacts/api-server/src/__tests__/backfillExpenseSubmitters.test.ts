/**
 * Tests for backfillExpenseSubmitters
 *
 * The name-based backfill is intentionally disabled: attributing legacy
 * "[Logged by <name>]" expenses to *current* team members by display name is
 * unsafe because a departed submitter can be replaced by a new worker with the
 * same name, causing cross-worker expense disclosure.
 *
 * Verifies:
 *   1. The function completes without error.
 *   2. No database queries are executed (disabled means no reads/writes).
 *   3. An informational log message explains why the backfill is disabled.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockExecute = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: { execute: mockExecute },
}));

vi.mock("../lib/logger", () => ({ logger: mockLogger }));

// ── Import after mocks ────────────────────────────────────────────────────────

import { backfillExpenseSubmitters } from "../backfillExpenseSubmitters";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("backfillExpenseSubmitters (disabled)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves without throwing", async () => {
    await expect(backfillExpenseSubmitters()).resolves.not.toThrow();
  });

  it("makes no database queries", async () => {
    await backfillExpenseSubmitters();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("logs an informational message explaining the backfill is disabled", async () => {
    await backfillExpenseSubmitters();
    expect(mockLogger.info).toHaveBeenCalledOnce();
    const [msg] = mockLogger.info.mock.calls[0] as [string];
    expect(msg).toMatch(/disabled/i);
  });

  it("does not log any error", async () => {
    await backfillExpenseSubmitters();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
