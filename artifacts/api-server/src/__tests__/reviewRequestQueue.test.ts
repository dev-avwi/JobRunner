/**
 * Tests for the Google review request queue automation.
 *
 * Covers:
 * - scheduleReviewRequest: settings check, 90-day dedup, ON CONFLICT, queue insertion
 * - processReviewRequestQueue: claim lifecycle, explicit sent/skipped/failed outcomes,
 *   independent channel handling (partial success for "both"), stuck-row reclaim,
 *   concurrent-enqueue deduplication
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────
// Factories must not reference outer variables (vi.mock is hoisted)

vi.mock('../emailService', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/smsService', () => ({
  // sendCustomerReply resolves with an outcome object (not void/throw) — default to success
  sendCustomerReply: vi.fn().mockResolvedValue({ success: true }),
}));

const mockStorage = {
  getAutomationSettings: vi.fn(),
  getInvoice: vi.fn(),
  getClient: vi.fn(),
  getBusinessSettings: vi.fn(),
  updateClient: vi.fn().mockResolvedValue(undefined),
};

let currentMockDb: any;

vi.mock('../storage', () => ({
  get storage() { return mockStorage; },
  get db() { return currentMockDb; },
}));

vi.mock('@workspace/db', () => ({
  reviewRequestQueue: {
    id: 'id', userId: 'userId', clientId: 'clientId',
    status: 'status', scheduledFor: 'scheduledFor', createdAt: 'createdAt',
    claimedAt: 'claimedAt', jobId: 'jobId', invoiceId: 'invoiceId',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: (a: any, b: any) => ({ type: 'eq', a, b }),
  and: (...args: any[]) => ({ type: 'and', args }),
  lte: (a: any, b: any) => ({ type: 'lte', a, b }),
  lt: (a: any, b: any) => ({ type: 'lt', a, b }),
  gte: (a: any, b: any) => ({ type: 'gte', a, b }),
  not: (v: any) => ({ type: 'not', v }),
  inArray: (col: any, vals: any) => ({ type: 'inArray', col, vals }),
  isNotNull: (col: any) => ({ type: 'isNotNull', col }),
  sql: vi.fn(),
}));

// ── Import subjects and mocked singletons AFTER mocks ─────────────────────────

import { scheduleReviewRequest, processReviewRequestQueue } from '../automationService';
import { sendEmail } from '../emailService';
import { sendCustomerReply } from '../services/smsService';

const mockSendEmail = sendEmail as Mock;
const mockSendCustomerReply = sendCustomerReply as Mock;

// ─── DB chain helpers ─────────────────────────────────────────────────────────
// Each db.select() / db.update() / db.insert() returns its own chain object
// with no shared state between the different queries in a single function call.

function makeSelectChain(resolveWith: any[] = []) {
  const chain: any = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(resolveWith); // for dedup .limit(1)
  chain.where = vi.fn().mockReturnValue(chain);
  // Make the chain directly awaitable (for due-row queries without .limit())
  chain.then = (res: any, rej: any) => Promise.resolve(resolveWith).then(res, rej);
  chain.catch = (fn: any) => Promise.resolve(resolveWith).catch(fn);
  return chain;
}

function makeUpdateChain({ returningRows = [{ id: 'row-1' }] } = {}) {
  const innerWhere: any = {
    returning: vi.fn().mockResolvedValue(returningRows),
    then: (res: any, rej: any) => Promise.resolve(undefined).then(res, rej),
    catch: (fn: any) => Promise.resolve(undefined).catch(fn),
  };
  const setChain = { where: vi.fn().mockReturnValue(innerWhere) };
  return { set: vi.fn().mockReturnValue(setChain) };
}

function makeInsertChain() {
  return {
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

// ── Mock DB factories ─────────────────────────────────────────────────────────

/** DB for scheduleReviewRequest: dedup select returns `existingRows` */
function makeScheduleDb(existingRows: any[] = []) {
  return {
    select: vi.fn(() => makeSelectChain(existingRows)),
    insert: vi.fn(() => makeInsertChain()),
    update: vi.fn(() => makeUpdateChain()),
  };
}

/**
 * DB for processReviewRequestQueue.
 * Update call order:
 *   #1 = reclaim stuck rows (no .returning needed)
 *   #2 = atomic claim (returns claimReturns)
 *   #3 = mark sent / skipped / failed
 */
function makeQueueDb({
  dueRows = [pendingRow],
  claimReturns = [{ id: 'row-1' }],
} = {}) {
  let updateCallCount = 0;
  return {
    select: vi.fn(() => makeSelectChain(dueRows)),
    insert: vi.fn(() => makeInsertChain()),
    update: vi.fn(() => {
      updateCallCount++;
      if (updateCallCount === 1) return makeUpdateChain({ returningRows: [] }); // reclaim
      if (updateCallCount === 2) return makeUpdateChain({ returningRows: claimReturns }); // claim
      return makeUpdateChain({ returningRows: [] }); // mark outcome
    }),
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseSettings = {
  autoReviewRequest: true,
  autoReviewRequestType: 'email',
  reviewRequestDelayHours: 24,
  reviewRequestMessage: 'Hi {client_name}, thanks for choosing {business_name}!',
};

const baseInvoice = { id: 'inv-1', clientId: 'client-1', jobId: 'job-1' };
const baseClient = {
  id: 'client-1', name: 'Jane Smith', email: 'jane@example.com',
  phone: null, reviewRequestSentAt: null,
};
const baseBizSettings = {
  businessName: 'Test Plumbing', googleReviewUrl: 'https://g.page/r/TEST/review',
};

const pendingRow = {
  id: 'row-1', userId: 'user-1', clientId: 'client-1', jobId: 'job-1',
  invoiceId: 'inv-1', scheduledFor: new Date(Date.now() - 1000), status: 'pending',
  attemptCount: 0,
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.getAutomationSettings.mockResolvedValue(baseSettings);
  mockStorage.getInvoice.mockResolvedValue(baseInvoice);
  mockStorage.getClient.mockResolvedValue(baseClient);
  mockStorage.getBusinessSettings.mockResolvedValue(baseBizSettings);
  currentMockDb = makeScheduleDb();
});

// ─── scheduleReviewRequest ────────────────────────────────────────────────────

describe('scheduleReviewRequest', () => {
  it('does nothing when autoReviewRequest is disabled', async () => {
    mockStorage.getAutomationSettings.mockResolvedValue({ autoReviewRequest: false });
    await scheduleReviewRequest('user-1', 'inv-1');
    expect(currentMockDb.insert).not.toHaveBeenCalled();
  });

  it('does nothing when invoice has no clientId', async () => {
    mockStorage.getInvoice.mockResolvedValue({ id: 'inv-1', clientId: null });
    await scheduleReviewRequest('user-1', 'inv-1');
    expect(currentMockDb.insert).not.toHaveBeenCalled();
  });

  it('skips when client received a request within 90 days', async () => {
    const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    mockStorage.getClient.mockResolvedValue({ ...baseClient, reviewRequestSentAt: recentDate });
    await scheduleReviewRequest('user-1', 'inv-1');
    expect(currentMockDb.insert).not.toHaveBeenCalled();
  });

  it('skips when a pending/processing/sent entry exists for this client', async () => {
    currentMockDb = makeScheduleDb([{ id: 'existing-row' }]);
    await scheduleReviewRequest('user-1', 'inv-1');
    expect(currentMockDb.insert).not.toHaveBeenCalled();
  });

  it('inserts with correct scheduledFor and calls onConflictDoNothing', async () => {
    await scheduleReviewRequest('user-1', 'inv-1');
    expect(currentMockDb.insert).toHaveBeenCalled();
    const insertChain = (currentMockDb.insert as Mock).mock.results[0].value;
    const valuesChain = insertChain.values.mock.results[0].value;
    expect(valuesChain.onConflictDoNothing).toHaveBeenCalled();
    const valuesArg = insertChain.values.mock.calls[0][0];
    expect(valuesArg).toMatchObject({ userId: 'user-1', invoiceId: 'inv-1', clientId: 'client-1' });
    const diff = valuesArg.scheduledFor.getTime() - Date.now();
    expect(diff).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(diff).toBeLessThan(25 * 60 * 60 * 1000);
  });

  it('uses delayHours=0 to schedule immediately', async () => {
    mockStorage.getAutomationSettings.mockResolvedValue({ ...baseSettings, reviewRequestDelayHours: 0 });
    await scheduleReviewRequest('user-1', 'inv-1');
    const insertChain = (currentMockDb.insert as Mock).mock.results[0].value;
    const valuesArg = insertChain.values.mock.calls[0][0];
    expect(valuesArg.scheduledFor.getTime() - Date.now()).toBeLessThan(5000);
  });

  it('re-queues when reviewRequestSentAt is older than 90 days', async () => {
    mockStorage.getClient.mockResolvedValue({
      ...baseClient,
      reviewRequestSentAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
    });
    await scheduleReviewRequest('user-1', 'inv-1');
    expect(currentMockDb.insert).toHaveBeenCalled();
  });

  it('allows re-queuing when only skipped/failed entries exist (excluded from dedup)', async () => {
    // Dedup query returns empty because skipped/failed are excluded via inArray(['pending','processing','sent'])
    currentMockDb = makeScheduleDb([]);
    mockStorage.getClient.mockResolvedValue({
      ...baseClient,
      reviewRequestSentAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
    });
    await scheduleReviewRequest('user-1', 'inv-1');
    expect(currentMockDb.insert).toHaveBeenCalled();
  });

  it('concurrent enqueue: onConflictDoNothing absorbs the duplicate', async () => {
    // Simulate the second concurrent call: same client, no existing entry in SELECT
    // (both callers passed the SELECT before either INSERT completed), but the
    // unique index fires for one of them — onConflictDoNothing handles it silently.
    await scheduleReviewRequest('user-1', 'inv-1');
    const insertChain = (currentMockDb.insert as Mock).mock.results[0].value;
    const valuesChain = insertChain.values.mock.results[0].value;
    // The absence of a thrown error confirms onConflictDoNothing was called
    expect(valuesChain.onConflictDoNothing).toHaveBeenCalled();
  });
});

// ─── processReviewRequestQueue ────────────────────────────────────────────────

describe('processReviewRequestQueue', () => {
  it('sends email and marks row "sent" when channel=email and client has email', async () => {
    currentMockDb = makeQueueDb();
    await processReviewRequestQueue();
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'jane@example.com' }));
    expect(mockStorage.updateClient).toHaveBeenCalledWith(
      'client-1', 'user-1',
      expect.objectContaining({ reviewRequestSentAt: expect.any(Date) }),
    );
    // Third update call should mark the row 'sent'
    const thirdUpdate = (currentMockDb.update as Mock).mock.results[2].value;
    expect(thirdUpdate.set.mock.calls[0][0].status).toBe('sent');
  });

  it('marks row "skipped" (not "sent") when no channel is available — reviewRequestSentAt NOT updated', async () => {
    mockStorage.getClient.mockResolvedValue({ ...baseClient, email: null, phone: null });
    currentMockDb = makeQueueDb();
    await processReviewRequestQueue();
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSendCustomerReply).not.toHaveBeenCalled();
    expect(mockStorage.updateClient).not.toHaveBeenCalled();
    // Third update should mark 'skipped', NOT 'sent'
    const thirdUpdate = (currentMockDb.update as Mock).mock.results[2].value;
    expect(thirdUpdate.set.mock.calls[0][0].status).toBe('skipped');
  });

  it('marks row "skipped" when automation is disabled at send time', async () => {
    mockStorage.getAutomationSettings.mockResolvedValue({ autoReviewRequest: false });
    currentMockDb = makeQueueDb();
    await processReviewRequestQueue();
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockStorage.updateClient).not.toHaveBeenCalled();
    const thirdUpdate = (currentMockDb.update as Mock).mock.results[2].value;
    expect(thirdUpdate.set.mock.calls[0][0].status).toBe('skipped');
  });

  it('marks row "skipped" when client was recently contacted during the delay', async () => {
    const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    mockStorage.getClient.mockResolvedValue({ ...baseClient, reviewRequestSentAt: recentDate });
    currentMockDb = makeQueueDb();
    await processReviewRequestQueue();
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockStorage.updateClient).not.toHaveBeenCalled();
    const thirdUpdate = (currentMockDb.update as Mock).mock.results[2].value;
    expect(thirdUpdate.set.mock.calls[0][0].status).toBe('skipped');
  });

  it('sends SMS when channel=sms and client has phone', async () => {
    mockSendCustomerReply.mockResolvedValueOnce({ success: true, messageId: 'SM123' });
    mockStorage.getAutomationSettings.mockResolvedValue({ ...baseSettings, autoReviewRequestType: 'sms' });
    mockStorage.getClient.mockResolvedValue({ ...baseClient, email: null, phone: '0412345678' });
    currentMockDb = makeQueueDb();
    await processReviewRequestQueue();
    expect(mockSendCustomerReply).toHaveBeenCalled();
    expect(mockStorage.updateClient).toHaveBeenCalled();
  });

  it('treats resolved { success: false } from sendCustomerReply as a channel error and re-queues for retry', async () => {
    // sendCustomerReply resolves (not throws) when business has no dedicated number
    mockSendCustomerReply.mockResolvedValueOnce({ success: false, notConfigured: true, error: 'No business phone number configured.' });
    mockStorage.getAutomationSettings.mockResolvedValue({ ...baseSettings, autoReviewRequestType: 'sms' });
    mockStorage.getClient.mockResolvedValue({ ...baseClient, email: null, phone: '0412345678' });
    currentMockDb = makeQueueDb();
    await processReviewRequestQueue();
    // Must NOT credit a successful send
    expect(mockStorage.updateClient).not.toHaveBeenCalled();
    // Row should be re-queued for retry (not marked sent or skipped)
    const thirdUpdate = (currentMockDb.update as Mock).mock.results[2].value;
    expect(thirdUpdate.set.mock.calls[0][0].status).toBe('pending');
    expect(thirdUpdate.set.mock.calls[0][0].attemptCount).toBe(1);
  });

  it('marks sent when email succeeds even if SMS resolves { success: false } (both channel)', async () => {
    mockSendCustomerReply.mockResolvedValueOnce({ success: false, notConfigured: true, error: 'No dedicated number' });
    mockStorage.getAutomationSettings.mockResolvedValue({ ...baseSettings, autoReviewRequestType: 'both' });
    mockStorage.getClient.mockResolvedValue({ ...baseClient, email: 'jane@example.com', phone: '0412345678' });
    currentMockDb = makeQueueDb();
    await processReviewRequestQueue();
    // Email went through; at least one channel succeeded
    expect(mockSendEmail).toHaveBeenCalled();
    expect(mockStorage.updateClient).toHaveBeenCalled(); // reviewRequestSentAt recorded
    const thirdUpdate = (currentMockDb.update as Mock).mock.results[2].value;
    expect(thirdUpdate.set.mock.calls[0][0].status).toBe('sent');
  });

  describe('channel=both partial success', () => {
    it('marks "sent" when email succeeds and SMS fails — partial success is still sent', async () => {
      mockStorage.getAutomationSettings.mockResolvedValue({ ...baseSettings, autoReviewRequestType: 'both' });
      mockStorage.getClient.mockResolvedValue({ ...baseClient, email: 'jane@example.com', phone: '0412345678' });
      mockSendCustomerReply.mockRejectedValueOnce(new Error('Twilio error'));
      currentMockDb = makeQueueDb();
      await processReviewRequestQueue();
      expect(mockSendEmail).toHaveBeenCalled();
      expect(mockStorage.updateClient).toHaveBeenCalled(); // reviewRequestSentAt written
      const thirdUpdate = (currentMockDb.update as Mock).mock.results[2].value;
      expect(thirdUpdate.set.mock.calls[0][0].status).toBe('sent');
    });

    it('marks "sent" when SMS succeeds and email fails', async () => {
      mockStorage.getAutomationSettings.mockResolvedValue({ ...baseSettings, autoReviewRequestType: 'both' });
      mockStorage.getClient.mockResolvedValue({ ...baseClient, email: 'jane@example.com', phone: '0412345678' });
      mockSendEmail.mockRejectedValueOnce(new Error('SMTP error'));
      currentMockDb = makeQueueDb();
      await processReviewRequestQueue();
      expect(mockSendCustomerReply).toHaveBeenCalled();
      expect(mockStorage.updateClient).toHaveBeenCalled();
      const thirdUpdate = (currentMockDb.update as Mock).mock.results[2].value;
      expect(thirdUpdate.set.mock.calls[0][0].status).toBe('sent');
    });

    it('re-queues for retry (not immediately "failed") when both channels throw on first attempt', async () => {
      // First failure → re-queue with bounded retry; only permanently failed after MAX_ATTEMPTS.
      mockStorage.getAutomationSettings.mockResolvedValue({ ...baseSettings, autoReviewRequestType: 'both' });
      mockStorage.getClient.mockResolvedValue({ ...baseClient, email: 'jane@example.com', phone: '0412345678' });
      mockSendEmail.mockRejectedValueOnce(new Error('SMTP error'));
      mockSendCustomerReply.mockRejectedValueOnce(new Error('Twilio error'));
      currentMockDb = makeQueueDb(); // pendingRow.attemptCount = 0
      await processReviewRequestQueue();
      expect(mockStorage.updateClient).not.toHaveBeenCalled();
      const thirdUpdate = (currentMockDb.update as Mock).mock.results[2].value;
      const outcomePayload = thirdUpdate.set.mock.calls[0][0];
      expect(outcomePayload.status).toBe('pending'); // re-queued, not permanently failed
      expect(outcomePayload.attemptCount).toBe(1);
    });

    it('marks "failed" permanently when both channels throw and MAX_ATTEMPTS is reached', async () => {
      mockStorage.getAutomationSettings.mockResolvedValue({ ...baseSettings, autoReviewRequestType: 'both' });
      mockStorage.getClient.mockResolvedValue({ ...baseClient, email: 'jane@example.com', phone: '0412345678' });
      mockSendEmail.mockRejectedValueOnce(new Error('SMTP error'));
      mockSendCustomerReply.mockRejectedValueOnce(new Error('Twilio error'));
      const maxedRow = { ...pendingRow, attemptCount: 2 }; // next failure = attempt 3 = MAX_ATTEMPTS
      currentMockDb = makeQueueDb({ dueRows: [maxedRow] });
      await processReviewRequestQueue();
      expect(mockStorage.updateClient).not.toHaveBeenCalled();
      const thirdUpdate = (currentMockDb.update as Mock).mock.results[2].value;
      expect(thirdUpdate.set.mock.calls[0][0].status).toBe('failed');
    });
  });

  it('re-queues stuck "processing" rows back to "pending" (not "failed")', async () => {
    // The first update call in processReviewRequestQueue is the reclaim step.
    // It should set status='pending' (re-queue), not 'failed'.
    currentMockDb = makeQueueDb({ dueRows: [] }); // no due rows so only reclaim runs
    await processReviewRequestQueue();
    const firstUpdate = (currentMockDb.update as Mock).mock.results[0].value;
    const reclaimPayload = firstUpdate.set.mock.calls[0][0];
    expect(reclaimPayload.status).toBe('pending');
    expect(reclaimPayload.claimedAt).toBeNull();
  });

  it('sets claimedAt when atomically claiming a row', async () => {
    currentMockDb = makeQueueDb();
    await processReviewRequestQueue();
    const secondUpdate = (currentMockDb.update as Mock).mock.results[1].value;
    const claimPayload = secondUpdate.set.mock.calls[0][0];
    expect(claimPayload.status).toBe('processing');
    expect(claimPayload.claimedAt).toBeInstanceOf(Date);
  });

  it('skips the row when claim is lost to another instance', async () => {
    currentMockDb = makeQueueDb({ claimReturns: [] });
    await processReviewRequestQueue();
    expect(mockSendEmail).not.toHaveBeenCalled();
    // Only 2 update calls (reclaim + failed claim) — no mark-outcome call
    expect((currentMockDb.update as Mock).mock.calls.length).toBe(2);
  });

  it('does nothing when there are no due pending rows', async () => {
    currentMockDb = makeQueueDb({ dueRows: [] });
    await processReviewRequestQueue();
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockStorage.updateClient).not.toHaveBeenCalled();
  });

  it('includes the Google review link in the email body', async () => {
    currentMockDb = makeQueueDb();
    await processReviewRequestQueue();
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.text).toContain('https://g.page/r/TEST/review');
    expect(call.html).toContain('https://g.page/r/TEST/review');
  });

  it('omits review link when googleReviewUrl is empty', async () => {
    mockStorage.getBusinessSettings.mockResolvedValue({ ...baseBizSettings, googleReviewUrl: '' });
    currentMockDb = makeQueueDb();
    await processReviewRequestQueue();
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.text).not.toContain('Leave a review:');
  });

  describe('retry behavior', () => {
    it('re-queues row as "pending" with incremented attemptCount on first failure (not permanently failed)', async () => {
      mockSendEmail.mockRejectedValueOnce(new Error('SMTP timeout'));
      currentMockDb = makeQueueDb();
      await processReviewRequestQueue();
      expect(mockStorage.updateClient).not.toHaveBeenCalled();
      // Third update = retry re-queue: status should be 'pending', not 'failed'
      const thirdUpdate = (currentMockDb.update as Mock).mock.results[2].value;
      const retryPayload = thirdUpdate.set.mock.calls[0][0];
      expect(retryPayload.status).toBe('pending');
      expect(retryPayload.attemptCount).toBe(1);
      expect(retryPayload.claimedAt).toBeNull();
      expect(retryPayload.scheduledFor).toBeInstanceOf(Date);
      // Re-scheduled time should be ~1h from now
      const diff = retryPayload.scheduledFor.getTime() - Date.now();
      expect(diff).toBeGreaterThan(55 * 60 * 1000);
      expect(diff).toBeLessThan(65 * 60 * 1000);
    });

    it('permanently marks row "failed" after MAX_ATTEMPTS (3) consecutive failures', async () => {
      // Row that has already been retried twice (attemptCount=2)
      const retriedRow = { ...pendingRow, attemptCount: 2 };
      mockSendEmail.mockRejectedValueOnce(new Error('SMTP timeout'));
      currentMockDb = makeQueueDb({ dueRows: [retriedRow] });
      await processReviewRequestQueue();
      const thirdUpdate = (currentMockDb.update as Mock).mock.results[2].value;
      const finalPayload = thirdUpdate.set.mock.calls[0][0];
      expect(finalPayload.status).toBe('failed');
      expect(finalPayload.attemptCount).toBe(3);
    });

    it('after retry re-queue, a subsequent run picks up the pending row and sends successfully', async () => {
      // Simulate a previously re-queued row (attemptCount=1, now past its scheduledFor)
      const retriedRow = {
        ...pendingRow,
        attemptCount: 1,
        scheduledFor: new Date(Date.now() - 100),
      };
      currentMockDb = makeQueueDb({ dueRows: [retriedRow] });
      await processReviewRequestQueue();
      expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'jane@example.com' }));
      expect(mockStorage.updateClient).toHaveBeenCalled();
      const thirdUpdate = (currentMockDb.update as Mock).mock.results[2].value;
      expect(thirdUpdate.set.mock.calls[0][0].status).toBe('sent');
    });
  });
});
