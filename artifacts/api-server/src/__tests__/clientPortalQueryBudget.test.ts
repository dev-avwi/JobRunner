/**
 * clientPortalQueryBudget.test.ts
 *
 * Regression guard: the portal batch-fetch storage helpers used by
 * GET /api/portal/data must each issue exactly ONE database round trip
 * regardless of how many jobs / assignments / team-members the account holds.
 *
 * A per-row regression (e.g. replacing `getJobsForClientIds(ids)` with a
 * loop of `getJobById(id)`) against a 50-job account would produce 50+
 * pool.query() calls instead of 1. This test catches that immediately.
 *
 * Strategy
 * ─────────
 * 1. Hoist a `mockPgQuery` spy before any module is imported.
 * 2. Mock the `pg` module so every `new pg.Pool()` returns a fake pool that
 *    routes all .query() calls through the spy.
 * 3. Import `storage` — it initialises `pool` and `db` against the fake pool.
 * 4. For each batch helper: reset the spy, call the method with ≥ 50 IDs,
 *    assert pool.query was called exactly once.
 * 5. In the combined test: assert the total across all ten batch methods that
 *    the portal handler exercises does not exceed 15 (≤ 11 in the happy path;
 *    budget gives a small margin for future additions without being so loose
 *    that per-row regressions slip through).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoist the spy so the pg mock can reference it ─────────────────────────────

const mockPgQuery = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ rows: [], fields: [], rowCount: 0, command: 'SELECT' }),
);

// ── Mock pg before storage.ts is imported ─────────────────────────────────────

vi.mock('pg', () => {
  // Use a class so TypeScript does not complain about implicit `this: any`.
  class Pool {
    query = mockPgQuery;
    on = vi.fn();
    connect = vi.fn().mockResolvedValue({ query: mockPgQuery, release: vi.fn() });
    end = vi.fn();
    totalCount = 0;
    idleCount = 0;
    waitingCount = 0;
  }
  return { default: { Pool } };
});

// ── Import storage AFTER the mock is in place ─────────────────────────────────

import { storage } from '../storage';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** 3 client IDs — realistic: one client maps to many jobs. */
const CLIENT_IDS = ['client-1', 'client-2', 'client-3'];

/** 50 job IDs — the minimum the task description requires. */
const JOB_IDS = Array.from({ length: 50 }, (_, i) => `job-${i + 1}`);

/** 2 assignments per job → 100 total. */
const TEAM_MEMBER_IDS = Array.from({ length: 20 }, (_, i) => `tm-${i + 1}`);

const OWNER_IDS = ['owner-a', 'owner-b'];

/** Phone in the format the portal session stores. */
const PHONE = '+61400000001';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Client portal query budget — one DB round trip per batch helper', () => {
  beforeEach(() => {
    // Reset call count before every test; keep the mock implementation.
    mockPgQuery.mockClear();
    mockPgQuery.mockResolvedValue({ rows: [], fields: [], rowCount: 0, command: 'SELECT' });
  });

  // ── Individual batch helpers ────────────────────────────────────────────────

  it('getClientsByPhone issues exactly 1 query', async () => {
    await storage.getClientsByPhone(PHONE);
    expect(mockPgQuery).toHaveBeenCalledTimes(1);
  });

  it('getQuotesForClientIds issues exactly 1 query for 3 client IDs', async () => {
    await storage.getQuotesForClientIds(CLIENT_IDS);
    expect(mockPgQuery).toHaveBeenCalledTimes(1);
  });

  it('getInvoicesForClientIds issues exactly 1 query for 3 client IDs', async () => {
    await storage.getInvoicesForClientIds(CLIENT_IDS);
    expect(mockPgQuery).toHaveBeenCalledTimes(1);
  });

  it('getReceiptsForClientIds issues exactly 1 query for 3 client IDs', async () => {
    await storage.getReceiptsForClientIds(CLIENT_IDS);
    expect(mockPgQuery).toHaveBeenCalledTimes(1);
  });

  it('getJobsForClientIds issues exactly 1 query regardless of client count', async () => {
    await storage.getJobsForClientIds(CLIENT_IDS);
    expect(mockPgQuery).toHaveBeenCalledTimes(1);
  });

  it('getBusinessSettingsBatch issues exactly 1 query for multiple owner IDs', async () => {
    await storage.getBusinessSettingsBatch(OWNER_IDS);
    expect(mockPgQuery).toHaveBeenCalledTimes(1);
  });

  it('getJobPortalTokensByJobIds issues exactly 1 query for 50 job IDs', async () => {
    await storage.getJobPortalTokensByJobIds(JOB_IDS);
    expect(mockPgQuery).toHaveBeenCalledTimes(1);
  });

  it('getJobAssignmentsByJobIds issues exactly 1 query for 50 job IDs', async () => {
    await storage.getJobAssignmentsByJobIds(JOB_IDS);
    expect(mockPgQuery).toHaveBeenCalledTimes(1);
  });

  it('getTeamMembersByIds issues exactly 1 query for 20 team member IDs', async () => {
    await storage.getTeamMembersByIds(TEAM_MEMBER_IDS);
    expect(mockPgQuery).toHaveBeenCalledTimes(1);
  });

  it('getJobVariationsByJobIds issues exactly 1 query for 50 job IDs', async () => {
    await storage.getJobVariationsByJobIds(JOB_IDS);
    expect(mockPgQuery).toHaveBeenCalledTimes(1);
  });

  // ── Early-exit: empty input must NOT hit the database ──────────────────────

  it('getQuotesForClientIds returns [] without a DB call when clientIds is empty', async () => {
    const result = await storage.getQuotesForClientIds([]);
    expect(result).toEqual([]);
    expect(mockPgQuery).not.toHaveBeenCalled();
  });

  it('getInvoicesForClientIds returns [] without a DB call when clientIds is empty', async () => {
    const result = await storage.getInvoicesForClientIds([]);
    expect(result).toEqual([]);
    expect(mockPgQuery).not.toHaveBeenCalled();
  });

  it('getReceiptsForClientIds returns [] without a DB call when clientIds is empty', async () => {
    const result = await storage.getReceiptsForClientIds([]);
    expect(result).toEqual([]);
    expect(mockPgQuery).not.toHaveBeenCalled();
  });

  it('getBusinessSettingsBatch returns empty Map without a DB call when userIds is empty', async () => {
    const result = await storage.getBusinessSettingsBatch([]);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(mockPgQuery).not.toHaveBeenCalled();
  });

  it('getJobsForClientIds returns [] without a DB call when clientIds is empty', async () => {
    const result = await storage.getJobsForClientIds([]);
    expect(result).toEqual([]);
    expect(mockPgQuery).not.toHaveBeenCalled();
  });

  it('getJobPortalTokensByJobIds returns empty Map without a DB call when jobIds is empty', async () => {
    const result = await storage.getJobPortalTokensByJobIds([]);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(mockPgQuery).not.toHaveBeenCalled();
  });

  it('getJobAssignmentsByJobIds returns empty Map without a DB call when jobIds is empty', async () => {
    const result = await storage.getJobAssignmentsByJobIds([]);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(mockPgQuery).not.toHaveBeenCalled();
  });

  it('getTeamMembersByIds returns empty Map without a DB call when ids is empty', async () => {
    const result = await storage.getTeamMembersByIds([]);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(mockPgQuery).not.toHaveBeenCalled();
  });

  it('getJobVariationsByJobIds returns empty Map without a DB call when jobIds is empty', async () => {
    const result = await storage.getJobVariationsByJobIds([]);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(mockPgQuery).not.toHaveBeenCalled();
  });

  // ── Combined budget: simulate the full portal data load path ───────────────
  //
  // The portal handler fires these ten helpers for every portal page load.
  // If any one of them regresses to a per-row pattern the combined query
  // count will exceed the budget of 15 long before it approaches 50+ (one
  // per job) or 100+ (one per assignment).

  it('all ten portal batch helpers together stay within a budget of 15 DB queries', async () => {
    await storage.getClientsByPhone(PHONE);                         // 1
    await storage.getQuotesForClientIds(CLIENT_IDS);               // 2
    await storage.getInvoicesForClientIds(CLIENT_IDS);             // 3
    await storage.getReceiptsForClientIds(CLIENT_IDS);             // 4
    await storage.getJobsForClientIds(CLIENT_IDS);                 // 5
    await storage.getBusinessSettingsBatch(OWNER_IDS);             // 6
    await storage.getJobPortalTokensByJobIds(JOB_IDS);             // 7
    await storage.getJobAssignmentsByJobIds(JOB_IDS);              // 8
    await storage.getTeamMembersByIds(TEAM_MEMBER_IDS);            // 9
    await storage.getJobVariationsByJobIds(JOB_IDS);               // 10

    // Budget: 15 round trips maximum.
    // Batch path: exactly 10 (one per helper).
    // Per-row path against this fixture: 50 (jobs) + 100 (assignments) + …
    const totalQueries = mockPgQuery.mock.calls.length;
    expect(totalQueries).toBeLessThanOrEqual(15);

    // Tighter assertion: every helper should contribute exactly 1 query.
    expect(totalQueries).toBe(10);
  });
});
