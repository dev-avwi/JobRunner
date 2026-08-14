/**
 * Tests for retentionDueEmailService.
 *
 * Split into two sections:
 *  1. Pure helper unit tests — no I/O, fast, deterministic.
 *  2. Integration-style tests with mocked DB and email so the claim/stamp/
 *     rollback logic can be verified without a real database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeReleaseDate,
  isWithinSendWindow,
  RETENTION_DUE_LOOKBACK_DAYS,
  processRetentionDueEmails,
} from '../../retentionDueEmailService';

// ── Module mocks (hoisted before any import resolution) ──────────────────────

vi.mock('../../storage', () => ({
  db: {
    select:  vi.fn(),
    update:  vi.fn(),
  },
}));

vi.mock('../../emailService', () => ({
  sendSystemEmail: vi.fn(),
}));

vi.mock('../../urlHelper', () => ({
  getProductionBaseUrl: () => 'https://app.jobrunner.com.au',
}));

// ── Import mocked modules after vi.mock declarations ─────────────────────────

import { db } from '../../storage';
import { sendSystemEmail } from '../../emailService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build the drizzle-style fluent chain that processRetentionDueEmails uses. */
function makeSelectChain(rows: unknown[]) {
  const chain: any = { from: vi.fn() };
  chain.from.mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows), orderBy: vi.fn().mockResolvedValue(rows) }) });
  // Allow plain `.where().returning()` (for the jobs listing query which has no .limit)
  chain.from.mockReturnValue({
    where: vi.fn().mockResolvedValue(rows),
  });
  return chain;
}

/** Build the drizzle-style update chain. Returns a chain where .returning() resolves to `returnRows`. */
function makeUpdateChain(returnRows: unknown[]) {
  const returning = vi.fn().mockResolvedValue(returnRows);
  const where2    = vi.fn().mockReturnValue({ returning });
  const set       = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning, where: where2 }) });
  return { set };
}

// A minimal project job fixture whose DLP expired yesterday.
const NOW = new Date('2026-08-14T10:00:00Z');
const JOB_ID = 'job-abc-123';

const eligibleJob = {
  id:                      JOB_ID,
  userId:                  'user-1',
  title:                   'City Library Extension',
  jobNumber:               'GEM1001',
  practicalCompletionDate: '2025-08-13', // DLP 12m → release 2026-08-13 (yesterday)
  defectsLiabilityMonths:  12,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Pure helper unit tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('computeReleaseDate', () => {
  it('adds DLP months to the PC date', () => {
    const result = computeReleaseDate('2025-01-15', 12);
    expect(result.toISOString().startsWith('2026-01-15')).toBe(true);
  });

  it('month-end clamping: Jan 31 + 1 month → Feb 28 (not Mar 3)', () => {
    const result = computeReleaseDate('2025-01-31', 1);
    // Feb 2025 has 28 days; day is clamped to 28, not overflowed to Mar 3.
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(1); // February (0-indexed)
    expect(result.getDate()).toBe(28);
  });

  it('leap-year clamping: Feb 29 (leap) + 12 months → Feb 28 (non-leap)', () => {
    const result = computeReleaseDate('2024-02-29', 12);
    // 2025 is not a leap year, so Feb 29 is clamped to Feb 28.
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(1); // February (0-indexed)
    expect(result.getDate()).toBe(28);
  });

  it('handles 0 DLP months (release = PC date)', () => {
    const result = computeReleaseDate('2026-06-01', 0);
    expect(result.toISOString().startsWith('2026-06-01')).toBe(true);
  });

  it('handles multi-year DLP (e.g. 24 months)', () => {
    const result = computeReleaseDate('2024-03-01', 24);
    expect(result.toISOString().startsWith('2026-03-01')).toBe(true);
  });
});

describe('isWithinSendWindow', () => {
  const now = new Date('2026-07-15T10:00:00Z');

  it('returns true when release date equals now', () => {
    expect(isWithinSendWindow(new Date('2026-07-15T10:00:00Z'), now)).toBe(true);
  });

  it('returns true when release date is within the lookback window', () => {
    expect(isWithinSendWindow(new Date('2026-07-14T00:00:00Z'), now)).toBe(true);
  });

  it('returns false when release date is in the future', () => {
    expect(isWithinSendWindow(new Date('2026-07-16T00:00:00Z'), now)).toBe(false);
  });

  it('returns false when release date is older than lookback window', () => {
    expect(isWithinSendWindow(new Date('2026-07-13T23:59:59Z'), now)).toBe(false);
  });

  it('respects a custom lookback window', () => {
    const sixDaysAgo = new Date('2026-07-09T00:00:00Z');
    expect(isWithinSendWindow(sixDaysAgo, now, 1)).toBe(false);
    expect(isWithinSendWindow(sixDaysAgo, now, 7)).toBe(true);
  });

  it('RETENTION_DUE_LOOKBACK_DAYS constant is 1', () => {
    expect(RETENTION_DUE_LOOKBACK_DAYS).toBe(1);
  });

  it('returns false for a job whose DLP ended 30 days ago (no back-filling)', () => {
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    expect(isWithinSendWindow(thirtyDaysAgo, now)).toBe(false);
  });

  it('returns true at exactly the lookback boundary (inclusive)', () => {
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - RETENTION_DUE_LOOKBACK_DAYS);
    windowStart.setHours(0, 0, 0, 0);
    expect(isWithinSendWindow(windowStart, now)).toBe(true);
  });
});

describe('end-to-end eligibility (computeReleaseDate + isWithinSendWindow)', () => {
  it('eligible when DLP expires today', () => {
    const now = new Date('2026-08-14T09:00:00Z');
    expect(isWithinSendWindow(computeReleaseDate('2025-08-14', 12), now)).toBe(true);
  });

  it('eligible when DLP expired yesterday (scheduler ran late)', () => {
    const now = new Date('2026-08-14T09:00:00Z');
    expect(isWithinSendWindow(computeReleaseDate('2025-08-13', 12), now)).toBe(true);
  });

  it('ineligible when DLP is still active', () => {
    const now = new Date('2026-08-14T09:00:00Z');
    expect(isWithinSendWindow(computeReleaseDate('2026-01-01', 12), now)).toBe(false);
  });

  it('ineligible when DLP expired over a year ago', () => {
    const now = new Date('2026-08-14T09:00:00Z');
    expect(isWithinSendWindow(computeReleaseDate('2024-08-01', 12), now)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Integration-style tests with mocked DB + email
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Wire up the drizzle fluent-chain mocks for a full processRetentionDueEmails run.
 *
 * Call order inside processRetentionDueEmails (after refactor):
 *  1. db.select() — list of candidate project jobs     (awaited .from().where())
 *  2. db.select() — claims for the job                 (awaited .from().where())
 *  3. db.select() — owner user row                     (awaited .from().where().limit())  ← before claim
 *  4. db.update() — atomic claim (WHERE IS NULL)       (.set().where().where().returning())
 *  5. db.select() — business settings row              (awaited .from().where().limit())
 *
 * No rollback update exists: stamp is intentionally kept on send failure so
 * the existing emailDeliveryLogs retry queue is the sole retransmission path.
 */
function wireDbMocks({
  candidateJobs = [eligibleJob],
  jobClaims = [
    { id: 'c1', status: 'approved', retentionAmount: '10000.00', subtotal: '0.00', total: '0.00', notes: null },
  ],
  claimRows = 1, // rows from the atomic UPDATE (1 = claimed, 0 = already taken)
  ownerRows = [{ id: 'user-1', email: 'owner@test.com', firstName: 'Alice' }],
  bizRows   = [{ businessName: 'Acme Build Co', brandColor: '#2563EB' }],
}: {
  candidateJobs?: unknown[];
  jobClaims?:     unknown[];
  claimRows?:     number;
  ownerRows?:     unknown[];
  bizRows?:       unknown[];
} = {}) {
  const dbMock = db as any;

  /**
   * Build a fluent chain whose terminal call (where / limit) is awaitable AND
   * whose intermediate calls each return the next level. This mirrors drizzle's
   * actual chaining:
   *   .from(t).where(cond)           → awaitable (no .limit)
   *   .from(t).where(cond).limit(n)  → awaitable
   */
  const makeQueryResult = (rows: unknown[]) => {
    const p: any = Promise.resolve(rows);
    p.limit = () => Promise.resolve(rows);
    return p;
  };

  let selectCallCount = 0;
  dbMock.select.mockImplementation(() => {
    selectCallCount++;
    const n = selectCallCount;
    const rows =
      n === 1 ? candidateJobs :   // candidate jobs
      n === 2 ? jobClaims     :   // claims
      n === 3 ? ownerRows     :   // owner (before claim)
      n === 4 ? bizRows       : []; // biz settings
    return {
      from: () => ({
        where: () => makeQueryResult(rows),
      }),
    };
  });

  // Only the atomic claim UPDATE — no rollback update.
  dbMock.update.mockImplementation(() => {
    const retRows   = Array(claimRows).fill({ id: JOB_ID });
    const returning = vi.fn().mockResolvedValue(retRows);
    const innerWhere = vi.fn().mockReturnValue({ returning });
    const outerWhere = vi.fn().mockReturnValue({ returning, where: innerWhere });
    return { set: vi.fn().mockReturnValue({ where: outerWhere }) };
  });
}

describe('processRetentionDueEmails — integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Freeze time so date-window checks are deterministic.
    vi.setSystemTime(NOW);
  });

  it('sends email and keeps stamp when claim succeeds and send succeeds', async () => {
    wireDbMocks();
    (sendSystemEmail as any).mockResolvedValue({ messageId: 'sg-123', sentVia: 'sendgrid' });

    await processRetentionDueEmails();

    expect(sendSystemEmail).toHaveBeenCalledOnce();
    const call = (sendSystemEmail as any).mock.calls[0][0];
    expect(call.to).toBe('owner@test.com');
    expect(call.subject).toContain('Retention due');
    expect(call.subject).toContain('GEM1001');

    // Only one update: the atomic claim. No rollback update.
    expect((db as any).update).toHaveBeenCalledOnce();
  });

  it('skips and does not send when atomic claim returns 0 rows (concurrent process)', async () => {
    wireDbMocks({ claimRows: 0 });

    await processRetentionDueEmails();

    expect(sendSystemEmail).not.toHaveBeenCalled();
  });

  it('keeps stamp when email send fails — delivery retry queue handles retransmission', async () => {
    wireDbMocks();
    (sendSystemEmail as any).mockRejectedValue(new Error('SendGrid 503'));

    await processRetentionDueEmails();

    expect(sendSystemEmail).toHaveBeenCalledOnce();

    // Only ONE update (the claim stamp). No rollback — stamp is kept so the
    // emailDeliveryLogs retry queue is the sole retransmission path, preventing
    // a race where a queued retry succeeds and the next daily run re-sends.
    expect((db as any).update).toHaveBeenCalledOnce();
  });

  it('skips jobs with no outstanding retention (already fully released)', async () => {
    const releasedClaims = [
      { id: 'c1', status: 'approved', retentionAmount: '5000.00', subtotal: '0.00', total: '0.00', notes: null },
      { id: 'c2', status: 'approved', retentionAmount: '0.00',    subtotal: '5000.00', total: '5000.00', notes: 'Retention Release' },
    ];
    wireDbMocks({ jobClaims: releasedClaims });

    await processRetentionDueEmails();

    expect(sendSystemEmail).not.toHaveBeenCalled();
    expect((db as any).update).not.toHaveBeenCalled();
  });

  it('skips jobs that already have a pending retention-release claim in flight', async () => {
    // A pending release claim means the owner already acted — sending another
    // "create a release claim" prompt could trigger a duplicate claim.
    // computeRetentionSummary treats status 'draft' | 'submitted' + notes
    // "Retention Release" (case-insensitive) as a pending release claim.
    const pendingReleaseClaims = [
      { id: 'c1', status: 'approved',   retentionAmount: '10000.00', subtotal: '0.00',     total: '0.00',     notes: null },
      { id: 'c2', status: 'submitted',  retentionAmount: '0.00',     subtotal: '10000.00', total: '10000.00', notes: 'Retention Release' },
    ];
    wireDbMocks({ jobClaims: pendingReleaseClaims });

    await processRetentionDueEmails();

    expect(sendSystemEmail).not.toHaveBeenCalled();
    expect((db as any).update).not.toHaveBeenCalled();
  });

  it('skips jobs whose DLP release date is in the future', async () => {
    const futureJob = {
      ...eligibleJob,
      practicalCompletionDate: '2026-01-01', // DLP expires Jan 2027 — in the future
    };
    wireDbMocks({ candidateJobs: [futureJob] });

    await processRetentionDueEmails();

    expect(sendSystemEmail).not.toHaveBeenCalled();
    expect((db as any).update).not.toHaveBeenCalled();
  });

  it('skips jobs whose DLP ended more than lookback days ago', async () => {
    const staleJob = {
      ...eligibleJob,
      practicalCompletionDate: '2024-08-01', // DLP expired Aug 2025 — over a year ago
    };
    wireDbMocks({ candidateJobs: [staleJob] });

    await processRetentionDueEmails();

    expect(sendSystemEmail).not.toHaveBeenCalled();
  });

  it('skips without stamping when owner has no email address (job stays available for retry)', async () => {
    // Owner email lookup happens BEFORE the atomic claim. No stamp is written,
    // so the job remains eligible on subsequent runs (owner may add an email later).
    wireDbMocks({ ownerRows: [{ id: 'user-1', email: null, firstName: 'Alice' }] });

    await processRetentionDueEmails();

    expect(sendSystemEmail).not.toHaveBeenCalled();
    // No update at all — claim was never attempted.
    expect((db as any).update).not.toHaveBeenCalled();
  });

  it('does nothing when there are no candidate jobs', async () => {
    wireDbMocks({ candidateJobs: [] });

    await processRetentionDueEmails();

    expect(sendSystemEmail).not.toHaveBeenCalled();
    expect((db as any).update).not.toHaveBeenCalled();
  });
});
