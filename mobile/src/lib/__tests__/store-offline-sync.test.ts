/**
 * Offline sync correctness tests
 *
 * Verifies that the fake-success fix is preserved: a real server rejection
 * (4xx with a meaningful error body) reverts state and returns false/null,
 * while a genuine connectivity failure (isOffline flag or network throw)
 * queues the change for later sync and returns true/an offline record.
 *
 * Operations covered:
 *  Update mutations  — updateJobNotes, updateClient, updateQuote,
 *                      updateQuoteStatus, updateInvoice, updateInvoiceStatus
 *  Create mutations  — createJob, createClient, createQuote, createInvoice
 */

// ─── Mock heavy native / third-party modules before any imports ───────────────

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

// ── Offline-storage mock ──────────────────────────────────────────────────────
// Each writable fn is a jest.fn() so tests can spy on calls and control return
// values per-scenario.

const mockOfflineStore = {
  isOnline: true, // overridden per-test
};

const mockUpdateJobOffline = jest.fn().mockResolvedValue(undefined);
const mockUpdateClientOffline = jest.fn().mockResolvedValue(undefined);
const mockUpdateQuoteOffline = jest.fn().mockResolvedValue(undefined);
const mockUpdateInvoiceOffline = jest.fn().mockResolvedValue(undefined);

const mockSaveJobOffline = jest.fn();
const mockSaveClientOffline = jest.fn();
const mockSaveQuoteOffline = jest.fn();
const mockSaveInvoiceOffline = jest.fn();

const mockCacheJobs = jest.fn().mockResolvedValue(undefined);
const mockCacheClients = jest.fn().mockResolvedValue(undefined);
const mockCacheQuotes = jest.fn().mockResolvedValue(undefined);
const mockCacheInvoices = jest.fn().mockResolvedValue(undefined);

jest.mock('../offline-storage', () => ({
  __esModule: true,
  useOfflineStore: {
    getState: jest.fn(() => mockOfflineStore),
    subscribe: jest.fn(() => () => {}),
    setState: jest.fn(),
    destroy: jest.fn(),
  },
  default: {
    // update helpers
    updateJobOffline: (...args: unknown[]) => mockUpdateJobOffline(...args),
    updateClientOffline: (...args: unknown[]) => mockUpdateClientOffline(...args),
    updateQuoteOffline: (...args: unknown[]) => mockUpdateQuoteOffline(...args),
    updateInvoiceOffline: (...args: unknown[]) => mockUpdateInvoiceOffline(...args),
    // create helpers
    saveJobOffline: (...args: unknown[]) => mockSaveJobOffline(...args),
    saveClientOffline: (...args: unknown[]) => mockSaveClientOffline(...args),
    saveQuoteOffline: (...args: unknown[]) => mockSaveQuoteOffline(...args),
    saveInvoiceOffline: (...args: unknown[]) => mockSaveInvoiceOffline(...args),
    // cache helpers
    cacheJobs: (...args: unknown[]) => mockCacheJobs(...args),
    cacheClients: (...args: unknown[]) => mockCacheClients(...args),
    cacheQuotes: (...args: unknown[]) => mockCacheQuotes(...args),
    cacheInvoices: (...args: unknown[]) => mockCacheInvoices(...args),
    // read helpers (not exercised here but needed so the module loads)
    getCachedJobs: jest.fn().mockResolvedValue([]),
    getCachedClients: jest.fn().mockResolvedValue([]),
    getCachedQuotes: jest.fn().mockResolvedValue([]),
    getCachedInvoices: jest.fn().mockResolvedValue([]),
    getCachedJob: jest.fn().mockResolvedValue(null),
    getCachedClient: jest.fn().mockResolvedValue(null),
    getCachedQuote: jest.fn().mockResolvedValue(null),
    getCachedInvoice: jest.fn().mockResolvedValue(null),
    getCachedAuthData: jest.fn().mockResolvedValue(null),
    cacheAuthData: jest.fn().mockResolvedValue(undefined),
    clearCachedAuthData: jest.fn().mockResolvedValue(undefined),
    clearCache: jest.fn().mockResolvedValue(undefined),
    removeFromCache: jest.fn().mockResolvedValue(undefined),
    fullSync: jest.fn().mockResolvedValue(undefined),
  },
}));

// ── API mock ──────────────────────────────────────────────────────────────────
const mockApiPatch = jest.fn();
const mockApiPost = jest.fn();
const mockApiGet = jest.fn().mockResolvedValue({ data: [], error: null });
const mockApiDelete = jest.fn().mockResolvedValue({ data: null, error: null });

jest.mock('../api', () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
  },
  isAuthErrorMessage: jest.fn().mockReturnValue(false),
  setAuthExpiredCallback: jest.fn(),
}));

jest.mock('../role-cache', () => ({
  __esModule: true,
  clearRoleCache: jest.fn(),
}));

jest.mock('../theme-store', () => ({
  __esModule: true,
  useThemeStore: {
    getState: jest.fn(() => ({ themeMode: 'system' })),
    subscribe: jest.fn(() => () => {}),
  },
}));

jest.mock('../location-tracking', () => ({
  __esModule: true,
  default: { startTracking: jest.fn(), stopTracking: jest.fn() },
}));

jest.mock('../notifications', () => ({
  __esModule: true,
  default: {
    updateBadgeCount: jest.fn().mockResolvedValue(undefined),
    setBadgeCount: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../celebrate', () => ({
  __esModule: true,
  celebrate: jest.fn(),
}));

jest.mock(
  '../../modules/LiveActivity/src',
  () => ({
    __esModule: true,
    default: {
      startActivity: jest.fn(),
      updateActivity: jest.fn(),
      endActivity: jest.fn(),
    },
  }),
  { virtual: true },
);

// ─── Imports (after all mocks are in place) ───────────────────────────────────

import {
  useJobsStore,
  useClientsStore,
  useQuotesStore,
  useInvoicesStore,
} from '../store';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const JOB_ID = 'job-1';
const CLIENT_ID = 'client-1';
const QUOTE_ID = 'quote-1';
const INVOICE_ID = 'invoice-1';

const baseJob = {
  id: JOB_ID,
  title: 'Fix roof',
  status: 'scheduled' as const,
  notes: 'old notes',
};
const baseClient = {
  id: CLIENT_ID,
  name: 'Acme Corp',
  email: 'acme@example.com',
};
const baseQuote = {
  id: QUOTE_ID,
  quoteNumber: 'Q-001',
  clientId: CLIENT_ID,
  status: 'draft' as const,
  subtotal: 100,
  gstAmount: 10,
  total: 110,
  createdAt: '2026-01-01T00:00:00Z',
};
const baseInvoice = {
  id: INVOICE_ID,
  invoiceNumber: 'INV-001',
  clientId: CLIENT_ID,
  status: 'draft' as const,
  subtotal: 200,
  gstAmount: 20,
  total: 220,
  dueDate: '2026-02-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
};

/**
 * A response that looks like a real server rejection (403/400 body).
 *
 * The real API client parses the JSON error body and surfaces it as BOTH
 * `error` (the message string) AND `data` (the full parsed response object).
 * Fixtures must mirror this shape so that tests catch regressions where a
 * data-first check would accept the error payload as a successful result.
 */
function serverReject(msg = 'Forbidden', status = 403) {
  return {
    error: msg,
    // Realistic parsed JSON error body — same object that caused the
    // fake-success bug when data was checked before error.
    data: { message: msg, status },
  };
}

/** A response that signals a connectivity failure via the isOffline flag. */
function offlineResponse(msg = 'Network offline') {
  return { data: null, error: msg, isOffline: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function goOnline() {
  mockOfflineStore.isOnline = true;
}
function goOffline() {
  mockOfflineStore.isOnline = false;
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('store offline-sync correctness after fake-success fix', () => {
  beforeEach(() => {
    // Default: online
    goOnline();

    // Reset all mocks
    mockApiPatch.mockReset();
    mockApiPost.mockReset();
    mockUpdateJobOffline.mockReset().mockResolvedValue(undefined);
    mockUpdateClientOffline.mockReset().mockResolvedValue(undefined);
    mockUpdateQuoteOffline.mockReset().mockResolvedValue(undefined);
    mockUpdateInvoiceOffline.mockReset().mockResolvedValue(undefined);
    mockSaveJobOffline.mockReset();
    mockSaveClientOffline.mockReset();
    mockSaveQuoteOffline.mockReset();
    mockSaveInvoiceOffline.mockReset();
    mockCacheJobs.mockReset().mockResolvedValue(undefined);
    mockCacheClients.mockReset().mockResolvedValue(undefined);
    mockCacheQuotes.mockReset().mockResolvedValue(undefined);
    mockCacheInvoices.mockReset().mockResolvedValue(undefined);

    // Reset stores to a known state
    useJobsStore.setState({ jobs: [{ ...baseJob }], todaysJobs: [], error: null } as any);
    useClientsStore.setState({ clients: [{ ...baseClient }], error: null, lastFetched: null } as any);
    useQuotesStore.setState({ quotes: [{ ...baseQuote }], error: null } as any);
    useInvoicesStore.setState({ invoices: [{ ...baseInvoice }], error: null } as any);
  });

  // ══════════════════════════════════════════════════════════════════
  //  UPDATE mutations
  // ══════════════════════════════════════════════════════════════════

  // ── updateJobNotes ────────────────────────────────────────────────

  describe('updateJobNotes', () => {
    it('reverts state and returns false on a server rejection (403)', async () => {
      mockApiPatch.mockResolvedValue(serverReject('Forbidden'));

      const result = await useJobsStore.getState().updateJobNotes(JOB_ID, 'new notes');

      expect(result).toBe(false);
      // Optimistic update should be rolled back
      const { jobs } = useJobsStore.getState();
      expect(jobs.find(j => j.id === JOB_ID)?.notes).toBe('old notes');
      // Must NOT queue for offline sync
      expect(mockUpdateJobOffline).not.toHaveBeenCalled();
    });

    it('reverts state and returns false on a server rejection (400)', async () => {
      mockApiPatch.mockResolvedValue(serverReject('Validation error'));

      const result = await useJobsStore.getState().updateJobNotes(JOB_ID, 'bad notes');

      expect(result).toBe(false);
      expect(mockUpdateJobOffline).not.toHaveBeenCalled();
    });

    it('queues the change and returns true when isOffline flag is set', async () => {
      mockApiPatch.mockResolvedValue(offlineResponse());

      const result = await useJobsStore.getState().updateJobNotes(JOB_ID, 'new notes');

      expect(result).toBe(true);
      expect(mockUpdateJobOffline).toHaveBeenCalledWith(JOB_ID, { notes: 'new notes' });
    });

    it('queues the change and returns true when network throws', async () => {
      mockApiPatch.mockRejectedValue(new Error('Network request failed'));

      const result = await useJobsStore.getState().updateJobNotes(JOB_ID, 'new notes');

      expect(result).toBe(true);
      expect(mockUpdateJobOffline).toHaveBeenCalledWith(JOB_ID, { notes: 'new notes' });
    });

    it('queues the change and returns true when device is already offline', async () => {
      goOffline();

      const result = await useJobsStore.getState().updateJobNotes(JOB_ID, 'queued notes');

      expect(result).toBe(true);
      expect(mockUpdateJobOffline).toHaveBeenCalledWith(JOB_ID, { notes: 'queued notes' });
      // No API call should be made when already offline
      expect(mockApiPatch).not.toHaveBeenCalled();
    });
  });

  // ── updateClient ──────────────────────────────────────────────────

  describe('updateClient', () => {
    it('reverts state and returns false on a server rejection (403)', async () => {
      mockApiPatch.mockResolvedValue(serverReject('Forbidden'));

      const result = await useClientsStore.getState().updateClient(CLIENT_ID, { name: 'New Name' });

      expect(result).toBe(false);
      const { clients } = useClientsStore.getState();
      expect(clients.find(c => c.id === CLIENT_ID)?.name).toBe('Acme Corp');
      expect(mockUpdateClientOffline).not.toHaveBeenCalled();
    });

    it('reverts state and returns false on a server rejection (400)', async () => {
      mockApiPatch.mockResolvedValue(serverReject('Invalid email'));

      const result = await useClientsStore.getState().updateClient(CLIENT_ID, { email: 'bad' });

      expect(result).toBe(false);
      expect(mockUpdateClientOffline).not.toHaveBeenCalled();
    });

    it('queues the change and returns true when isOffline flag is set', async () => {
      mockApiPatch.mockResolvedValue(offlineResponse());

      const result = await useClientsStore.getState().updateClient(CLIENT_ID, { name: 'New Name' });

      expect(result).toBe(true);
      expect(mockUpdateClientOffline).toHaveBeenCalledWith(CLIENT_ID, { name: 'New Name' });
    });

    it('queues the change and returns true when network throws', async () => {
      mockApiPatch.mockRejectedValue(new Error('Network request failed'));

      const result = await useClientsStore.getState().updateClient(CLIENT_ID, { name: 'New Name' });

      expect(result).toBe(true);
      expect(mockUpdateClientOffline).toHaveBeenCalledWith(CLIENT_ID, { name: 'New Name' });
    });

    it('queues the change and returns true when device is already offline', async () => {
      goOffline();

      const result = await useClientsStore.getState().updateClient(CLIENT_ID, { name: 'Offline Name' });

      expect(result).toBe(true);
      expect(mockUpdateClientOffline).toHaveBeenCalledWith(CLIENT_ID, { name: 'Offline Name' });
      expect(mockApiPatch).not.toHaveBeenCalled();
    });
  });

  // ── updateQuote ───────────────────────────────────────────────────

  describe('updateQuote', () => {
    it('reverts state and returns false on a server rejection (403)', async () => {
      mockApiPatch.mockResolvedValue(serverReject('Forbidden'));

      const result = await useQuotesStore.getState().updateQuote(QUOTE_ID, { notes: 'new note' });

      expect(result).toBe(false);
      const { quotes } = useQuotesStore.getState();
      expect(quotes.find(q => q.id === QUOTE_ID)?.notes).toBeUndefined();
      expect(mockUpdateQuoteOffline).not.toHaveBeenCalled();
    });

    it('reverts state and returns false on a server rejection (400)', async () => {
      mockApiPatch.mockResolvedValue(serverReject('Validation failed'));

      const result = await useQuotesStore.getState().updateQuote(QUOTE_ID, { subtotal: -1 });

      expect(result).toBe(false);
      expect(mockUpdateQuoteOffline).not.toHaveBeenCalled();
    });

    it('queues the change and returns true when isOffline flag is set', async () => {
      mockApiPatch.mockResolvedValue(offlineResponse());

      const result = await useQuotesStore.getState().updateQuote(QUOTE_ID, { notes: 'new note' });

      expect(result).toBe(true);
      expect(mockUpdateQuoteOffline).toHaveBeenCalledWith(QUOTE_ID, { notes: 'new note' });
    });

    it('queues the change and returns true when network throws', async () => {
      mockApiPatch.mockRejectedValue(new Error('timeout'));

      const result = await useQuotesStore.getState().updateQuote(QUOTE_ID, { notes: 'new note' });

      expect(result).toBe(true);
      expect(mockUpdateQuoteOffline).toHaveBeenCalledWith(QUOTE_ID, { notes: 'new note' });
    });

    it('queues the change and returns true when device is already offline', async () => {
      goOffline();

      const result = await useQuotesStore.getState().updateQuote(QUOTE_ID, { notes: 'queued' });

      expect(result).toBe(true);
      expect(mockUpdateQuoteOffline).toHaveBeenCalledWith(QUOTE_ID, { notes: 'queued' });
      expect(mockApiPatch).not.toHaveBeenCalled();
    });
  });

  // ── updateQuoteStatus ─────────────────────────────────────────────

  describe('updateQuoteStatus', () => {
    it('reverts state and returns false on a server rejection (403)', async () => {
      mockApiPatch.mockResolvedValue(serverReject('Forbidden'));

      const result = await useQuotesStore.getState().updateQuoteStatus(QUOTE_ID, 'accepted');

      expect(result).toBe(false);
      const { quotes } = useQuotesStore.getState();
      expect(quotes.find(q => q.id === QUOTE_ID)?.status).toBe('draft');
      expect(mockUpdateQuoteOffline).not.toHaveBeenCalled();
    });

    it('reverts state and returns false on a server rejection (400)', async () => {
      mockApiPatch.mockResolvedValue(serverReject('Invalid status transition'));

      const result = await useQuotesStore.getState().updateQuoteStatus(QUOTE_ID, 'accepted');

      expect(result).toBe(false);
      expect(mockUpdateQuoteOffline).not.toHaveBeenCalled();
    });

    it('queues the status change and returns true when isOffline flag is set', async () => {
      mockApiPatch.mockResolvedValue(offlineResponse());

      const result = await useQuotesStore.getState().updateQuoteStatus(QUOTE_ID, 'sent');

      expect(result).toBe(true);
      expect(mockUpdateQuoteOffline).toHaveBeenCalledWith(QUOTE_ID, { status: 'sent' });
    });

    it('queues the status change and returns true when network throws', async () => {
      mockApiPatch.mockRejectedValue(new Error('Network request failed'));

      const result = await useQuotesStore.getState().updateQuoteStatus(QUOTE_ID, 'sent');

      expect(result).toBe(true);
      expect(mockUpdateQuoteOffline).toHaveBeenCalledWith(QUOTE_ID, { status: 'sent' });
    });

    it('queues the status change and returns true when device is already offline', async () => {
      goOffline();

      const result = await useQuotesStore.getState().updateQuoteStatus(QUOTE_ID, 'sent');

      expect(result).toBe(true);
      expect(mockUpdateQuoteOffline).toHaveBeenCalledWith(QUOTE_ID, { status: 'sent' });
      expect(mockApiPatch).not.toHaveBeenCalled();
    });
  });

  // ── updateInvoice ─────────────────────────────────────────────────

  describe('updateInvoice', () => {
    it('reverts state and returns false on a server rejection (403)', async () => {
      mockApiPatch.mockResolvedValue(serverReject('Forbidden'));

      const result = await useInvoicesStore.getState().updateInvoice(INVOICE_ID, { subtotal: 999 });

      expect(result).toBe(false);
      const { invoices } = useInvoicesStore.getState();
      expect(invoices.find(i => i.id === INVOICE_ID)?.subtotal).toBe(200);
      expect(mockUpdateInvoiceOffline).not.toHaveBeenCalled();
    });

    it('reverts state and returns false on a server rejection (400)', async () => {
      mockApiPatch.mockResolvedValue(serverReject('Validation failed'));

      const result = await useInvoicesStore.getState().updateInvoice(INVOICE_ID, { subtotal: -1 });

      expect(result).toBe(false);
      expect(mockUpdateInvoiceOffline).not.toHaveBeenCalled();
    });

    it('queues the change and returns true when isOffline flag is set', async () => {
      mockApiPatch.mockResolvedValue(offlineResponse());

      const result = await useInvoicesStore.getState().updateInvoice(INVOICE_ID, { subtotal: 999 });

      expect(result).toBe(true);
      expect(mockUpdateInvoiceOffline).toHaveBeenCalledWith(INVOICE_ID, { subtotal: 999 });
    });

    it('queues the change and returns true when network throws', async () => {
      mockApiPatch.mockRejectedValue(new Error('Network request failed'));

      const result = await useInvoicesStore.getState().updateInvoice(INVOICE_ID, { subtotal: 999 });

      expect(result).toBe(true);
      expect(mockUpdateInvoiceOffline).toHaveBeenCalledWith(INVOICE_ID, { subtotal: 999 });
    });

    it('queues the change and returns true when device is already offline', async () => {
      goOffline();

      const result = await useInvoicesStore.getState().updateInvoice(INVOICE_ID, { subtotal: 999 });

      expect(result).toBe(true);
      expect(mockUpdateInvoiceOffline).toHaveBeenCalledWith(INVOICE_ID, { subtotal: 999 });
      expect(mockApiPatch).not.toHaveBeenCalled();
    });
  });

  // ── updateInvoiceStatus ───────────────────────────────────────────

  describe('updateInvoiceStatus', () => {
    it('reverts state and returns false on a server rejection (403)', async () => {
      mockApiPatch.mockResolvedValue(serverReject('Forbidden'));

      const result = await useInvoicesStore.getState().updateInvoiceStatus(INVOICE_ID, 'paid');

      expect(result).toBe(false);
      const { invoices } = useInvoicesStore.getState();
      expect(invoices.find(i => i.id === INVOICE_ID)?.status).toBe('draft');
      expect(mockUpdateInvoiceOffline).not.toHaveBeenCalled();
    });

    it('reverts state and returns false on a server rejection (400)', async () => {
      mockApiPatch.mockResolvedValue(serverReject('Invalid status transition'));

      const result = await useInvoicesStore.getState().updateInvoiceStatus(INVOICE_ID, 'paid');

      expect(result).toBe(false);
      expect(mockUpdateInvoiceOffline).not.toHaveBeenCalled();
    });

    it('queues the status change and returns true when isOffline flag is set', async () => {
      mockApiPatch.mockResolvedValue(offlineResponse());

      const result = await useInvoicesStore.getState().updateInvoiceStatus(INVOICE_ID, 'sent');

      expect(result).toBe(true);
      expect(mockUpdateInvoiceOffline).toHaveBeenCalledWith(INVOICE_ID, { status: 'sent' });
    });

    it('queues the status change and returns true when network throws', async () => {
      mockApiPatch.mockRejectedValue(new Error('Network request failed'));

      const result = await useInvoicesStore.getState().updateInvoiceStatus(INVOICE_ID, 'sent');

      expect(result).toBe(true);
      expect(mockUpdateInvoiceOffline).toHaveBeenCalledWith(INVOICE_ID, { status: 'sent' });
    });

    it('queues the status change and returns true when device is already offline', async () => {
      goOffline();

      const result = await useInvoicesStore.getState().updateInvoiceStatus(INVOICE_ID, 'sent');

      expect(result).toBe(true);
      expect(mockUpdateInvoiceOffline).toHaveBeenCalledWith(INVOICE_ID, { status: 'sent' });
      expect(mockApiPatch).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════
  //  CREATE mutations
  // ══════════════════════════════════════════════════════════════════

  // ── createJob ─────────────────────────────────────────────────────

  describe('createJob', () => {
    const newJob = { title: 'Paint fence', status: 'scheduled' as const };
    const offlineRecord = { id: 'local-job-1', ...newJob, pendingSync: true };

    it('returns null and creates no offline record on a server rejection (400)', async () => {
      mockApiPost.mockResolvedValue(serverReject('Validation error', 400));

      const result = await useJobsStore.getState().createJob(newJob);

      expect(result).toBeNull();
      expect(mockSaveJobOffline).not.toHaveBeenCalled();
      expect(mockCacheJobs).not.toHaveBeenCalled();
      // The error payload body must not be stored as a job record
      const { jobs } = useJobsStore.getState();
      expect(jobs.every(j => j.id !== undefined && !(j as any).status?.includes('error'))).toBe(true);
      expect(jobs.some(j => (j as any).message === 'Validation error')).toBe(false);
    });

    it('returns null and creates no offline record on a server rejection (422)', async () => {
      mockApiPost.mockResolvedValue(serverReject('Unprocessable entity', 422));

      const result = await useJobsStore.getState().createJob(newJob);

      expect(result).toBeNull();
      expect(mockSaveJobOffline).not.toHaveBeenCalled();
      expect(mockCacheJobs).not.toHaveBeenCalled();
      // The error body must not be appended to jobs in the store
      const { jobs } = useJobsStore.getState();
      expect(jobs.some(j => (j as any).message === 'Unprocessable entity')).toBe(false);
    });

    it('creates an offline record and returns it when isOffline flag is set', async () => {
      mockApiPost.mockResolvedValue(offlineResponse());
      mockSaveJobOffline.mockResolvedValue(offlineRecord);

      const result = await useJobsStore.getState().createJob(newJob);

      expect(result).toEqual(offlineRecord);
      expect(mockSaveJobOffline).toHaveBeenCalledWith(newJob, 'create');
      // The offline record should appear in the store
      const { jobs } = useJobsStore.getState();
      expect(jobs.some(j => j.id === 'local-job-1')).toBe(true);
    });

    it('creates an offline record and returns it when network throws', async () => {
      mockApiPost.mockRejectedValue(new Error('Network request failed'));
      mockSaveJobOffline.mockResolvedValue(offlineRecord);

      const result = await useJobsStore.getState().createJob(newJob);

      expect(result).toEqual(offlineRecord);
      expect(mockSaveJobOffline).toHaveBeenCalledWith(newJob, 'create');
    });

    it('creates an offline record and returns it when device is already offline', async () => {
      goOffline();
      mockSaveJobOffline.mockResolvedValue(offlineRecord);

      const result = await useJobsStore.getState().createJob(newJob);

      expect(result).toEqual(offlineRecord);
      expect(mockSaveJobOffline).toHaveBeenCalledWith(newJob, 'create');
      expect(mockApiPost).not.toHaveBeenCalled();
    });
  });

  // ── createClient ──────────────────────────────────────────────────

  describe('createClient', () => {
    const newClient = { name: 'New Corp', email: 'new@example.com' };
    const offlineRecord = { id: 'local-client-1', ...newClient, pendingSync: true };

    it('returns null and creates no offline record on a server rejection (400)', async () => {
      mockApiPost.mockResolvedValue(serverReject('Validation error', 400));

      const result = await useClientsStore.getState().createClient(newClient);

      expect(result).toBeNull();
      expect(mockSaveClientOffline).not.toHaveBeenCalled();
      expect(mockCacheClients).not.toHaveBeenCalled();
      // The error body must not be stored as a client record
      const { clients } = useClientsStore.getState();
      expect(clients.some(c => (c as any).message === 'Validation error')).toBe(false);
    });

    it('returns null and creates no offline record on a server rejection (422)', async () => {
      mockApiPost.mockResolvedValue(serverReject('Duplicate email', 422));

      const result = await useClientsStore.getState().createClient(newClient);

      expect(result).toBeNull();
      expect(mockSaveClientOffline).not.toHaveBeenCalled();
      expect(mockCacheClients).not.toHaveBeenCalled();
      // The error body must not be appended to clients in the store
      const { clients } = useClientsStore.getState();
      expect(clients.some(c => (c as any).message === 'Duplicate email')).toBe(false);
    });

    it('creates an offline record and returns it when isOffline flag is set', async () => {
      mockApiPost.mockResolvedValue(offlineResponse());
      mockSaveClientOffline.mockResolvedValue(offlineRecord);

      const result = await useClientsStore.getState().createClient(newClient);

      expect(result).toEqual(offlineRecord);
      expect(mockSaveClientOffline).toHaveBeenCalledWith(newClient, 'create');
      const { clients } = useClientsStore.getState();
      expect(clients.some(c => c.id === 'local-client-1')).toBe(true);
    });

    it('creates an offline record and returns it when network throws', async () => {
      mockApiPost.mockRejectedValue(new Error('Network request failed'));
      mockSaveClientOffline.mockResolvedValue(offlineRecord);

      const result = await useClientsStore.getState().createClient(newClient);

      expect(result).toEqual(offlineRecord);
      expect(mockSaveClientOffline).toHaveBeenCalledWith(newClient, 'create');
    });

    it('creates an offline record and returns it when device is already offline', async () => {
      goOffline();
      mockSaveClientOffline.mockResolvedValue(offlineRecord);

      const result = await useClientsStore.getState().createClient(newClient);

      expect(result).toEqual(offlineRecord);
      expect(mockSaveClientOffline).toHaveBeenCalledWith(newClient, 'create');
      expect(mockApiPost).not.toHaveBeenCalled();
    });
  });

  // ── createQuote ───────────────────────────────────────────────────

  describe('createQuote', () => {
    const newQuote = {
      clientId: CLIENT_ID,
      subtotal: 500,
      gstAmount: 50,
      total: 550,
    };
    const offlineRecord = { id: 'local-quote-1', ...newQuote, pendingSync: true };

    it('returns null and creates no offline record on a server rejection (400)', async () => {
      mockApiPost.mockResolvedValue(serverReject('Validation error', 400));

      const result = await useQuotesStore.getState().createQuote(newQuote);

      expect(result).toBeNull();
      expect(mockSaveQuoteOffline).not.toHaveBeenCalled();
      expect(mockCacheQuotes).not.toHaveBeenCalled();
      // The error body must not be stored as a quote record
      const { quotes } = useQuotesStore.getState();
      expect(quotes.some(q => (q as any).message === 'Validation error')).toBe(false);
    });

    it('returns null and creates no offline record on a server rejection (422)', async () => {
      mockApiPost.mockResolvedValue(serverReject('Invalid client', 422));

      const result = await useQuotesStore.getState().createQuote(newQuote);

      expect(result).toBeNull();
      expect(mockSaveQuoteOffline).not.toHaveBeenCalled();
      expect(mockCacheQuotes).not.toHaveBeenCalled();
      // The error body must not be appended to quotes in the store
      const { quotes } = useQuotesStore.getState();
      expect(quotes.some(q => (q as any).message === 'Invalid client')).toBe(false);
    });

    it('creates an offline record and returns it when isOffline flag is set', async () => {
      mockApiPost.mockResolvedValue(offlineResponse());
      mockSaveQuoteOffline.mockResolvedValue(offlineRecord);

      const result = await useQuotesStore.getState().createQuote(newQuote);

      expect(result).toEqual(offlineRecord);
      expect(mockSaveQuoteOffline).toHaveBeenCalled();
      const { quotes } = useQuotesStore.getState();
      expect(quotes.some(q => q.id === 'local-quote-1')).toBe(true);
    });

    it('creates an offline record and returns it when network throws', async () => {
      mockApiPost.mockRejectedValue(new Error('Network request failed'));
      mockSaveQuoteOffline.mockResolvedValue(offlineRecord);

      const result = await useQuotesStore.getState().createQuote(newQuote);

      expect(result).toEqual(offlineRecord);
      expect(mockSaveQuoteOffline).toHaveBeenCalled();
    });

    it('creates an offline record and returns it when device is already offline', async () => {
      goOffline();
      mockSaveQuoteOffline.mockResolvedValue(offlineRecord);

      const result = await useQuotesStore.getState().createQuote(newQuote);

      expect(result).toEqual(offlineRecord);
      expect(mockSaveQuoteOffline).toHaveBeenCalled();
      expect(mockApiPost).not.toHaveBeenCalled();
    });
  });

  // ── createInvoice ─────────────────────────────────────────────────

  describe('createInvoice', () => {
    const newInvoice = {
      clientId: CLIENT_ID,
      subtotal: 1000,
      gstAmount: 100,
      total: 1100,
      dueDate: '2026-03-01T00:00:00Z',
    };
    const offlineRecord = { id: 'local-invoice-1', ...newInvoice, pendingSync: true };

    it('returns null and creates no offline record on a server rejection (400)', async () => {
      mockApiPost.mockResolvedValue(serverReject('Validation error', 400));

      const result = await useInvoicesStore.getState().createInvoice(newInvoice);

      expect(result).toBeNull();
      expect(mockSaveInvoiceOffline).not.toHaveBeenCalled();
      expect(mockCacheInvoices).not.toHaveBeenCalled();
      // The error body must not be stored as an invoice record
      const { invoices } = useInvoicesStore.getState();
      expect(invoices.some(i => (i as any).message === 'Validation error')).toBe(false);
    });

    it('returns null and creates no offline record on a server rejection (422)', async () => {
      mockApiPost.mockResolvedValue(serverReject('Invalid client', 422));

      const result = await useInvoicesStore.getState().createInvoice(newInvoice);

      expect(result).toBeNull();
      expect(mockSaveInvoiceOffline).not.toHaveBeenCalled();
      expect(mockCacheInvoices).not.toHaveBeenCalled();
      // The error body must not be appended to invoices in the store
      const { invoices } = useInvoicesStore.getState();
      expect(invoices.some(i => (i as any).message === 'Invalid client')).toBe(false);
    });

    it('creates an offline record and returns it when isOffline flag is set', async () => {
      mockApiPost.mockResolvedValue(offlineResponse());
      mockSaveInvoiceOffline.mockResolvedValue(offlineRecord);

      const result = await useInvoicesStore.getState().createInvoice(newInvoice);

      expect(result).toEqual(offlineRecord);
      expect(mockSaveInvoiceOffline).toHaveBeenCalled();
      const { invoices } = useInvoicesStore.getState();
      expect(invoices.some(i => i.id === 'local-invoice-1')).toBe(true);
    });

    it('creates an offline record and returns it when network throws', async () => {
      mockApiPost.mockRejectedValue(new Error('Network request failed'));
      mockSaveInvoiceOffline.mockResolvedValue(offlineRecord);

      const result = await useInvoicesStore.getState().createInvoice(newInvoice);

      expect(result).toEqual(offlineRecord);
      expect(mockSaveInvoiceOffline).toHaveBeenCalled();
    });

    it('creates an offline record and returns it when device is already offline', async () => {
      goOffline();
      mockSaveInvoiceOffline.mockResolvedValue(offlineRecord);

      const result = await useInvoicesStore.getState().createInvoice(newInvoice);

      expect(result).toEqual(offlineRecord);
      expect(mockSaveInvoiceOffline).toHaveBeenCalled();
      expect(mockApiPost).not.toHaveBeenCalled();
    });
  });
});
