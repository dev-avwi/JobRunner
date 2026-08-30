/**
 * offline-storage-cache-number.test.ts
 *
 * Verifies that cacheQuotes / cacheInvoices correctly store the document
 * number coming from the server API response (field name: `number`) into the
 * SQLite `quote_number` / `invoice_number` column, and that getCachedQuotes /
 * getCachedInvoices return it as the `number` field of CachedQuote /
 * CachedInvoice.
 *
 * Regression guard for the pre-fix path that read `quote.quoteNumber`
 * (always undefined on an API response) instead of `quote.number`.
 */

// ─── Mocks (hoisted by babel-jest — only jest.fn() allowed, no external refs) ─

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

jest.mock('expo-sqlite', () => ({
  __esModule: true,
  openDatabaseAsync: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn().mockResolvedValue({ isConnected: true }),
  },
}));

jest.mock('expo-background-fetch', () => ({
  __esModule: true,
  BackgroundFetchResult: { NewData: 1, NoData: 2, Failed: 3 },
  registerTaskAsync: jest.fn().mockResolvedValue(undefined),
  unregisterTaskAsync: jest.fn().mockResolvedValue(undefined),
  getStatusAsync: jest.fn().mockResolvedValue(3),
}));

jest.mock('expo-task-manager', () => ({
  __esModule: true,
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn().mockResolvedValue(false),
}));

jest.mock('expo-file-system/legacy', () => ({
  __esModule: true,
  documentDirectory: '/mock/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  downloadAsync: jest.fn().mockResolvedValue({ uri: '/mock/file' }),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
}));

jest.mock('../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue({ data: [], error: null }),
    post: jest.fn().mockResolvedValue({ data: null, error: null }),
    patch: jest.fn().mockResolvedValue({ data: null, error: null }),
    delete: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
  isAuthErrorMessage: jest.fn().mockReturnValue(false),
  setAuthExpiredCallback: jest.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import offlineStorage from '../offline-storage';

// ─── In-memory SQLite implementation ─────────────────────────────────────────
//
// We bypass initialize() and inject the mock db directly into the private `db`
// field of the singleton.  This avoids the jest-hoisting problem (where the
// `jest.mock` factory runs before module-level variable assignments) and lets
// us focus purely on the cacheQuotes / cacheInvoices logic.

type Row = Record<string, any>;

/** Rows stored per table name. Cleared before each test. */
const inMemoryTables: Record<string, Row[]> = {};

/** Extract the first word after a SQL keyword (case-insensitive). */
function extractTable(sql: string, keyword: 'INTO' | 'FROM'): string | null {
  const re = new RegExp(`${keyword}\\s+(\\w+)`, 'i');
  const m = sql.match(re);
  return m ? m[1].toLowerCase() : null;
}

/** Parse column list from  "INSERT OR REPLACE INTO t (col1, col2) VALUES ..." */
function parseInsertColumns(sql: string): string[] {
  const m = sql.match(/\(\s*([^)]+)\s*\)\s*VALUES/i);
  if (!m) return [];
  return m[1].split(',').map((s) => s.trim());
}

function buildMockDb() {
  return {
    execAsync: jest.fn().mockResolvedValue(undefined),

    runAsync: jest.fn(async (sql: string, params: any[]) => {
      const table = extractTable(sql, 'INTO');
      if (!table) return;
      const cols = parseInsertColumns(sql);
      if (!cols.length) return;

      const row: Row = {};
      cols.forEach((col, i) => { row[col] = params[i] ?? null; });

      if (!inMemoryTables[table]) inMemoryTables[table] = [];

      // Simulate INSERT OR REPLACE: upsert by primary key (id column)
      const idIdx = cols.indexOf('id');
      if (idIdx !== -1) {
        const pk = params[idIdx];
        const idx = inMemoryTables[table].findIndex((r) => r.id === pk);
        if (idx !== -1) { inMemoryTables[table][idx] = row; return; }
      }
      inMemoryTables[table].push(row);
    }),

    getAllAsync: jest.fn(async (sql: string, _params?: any[]) => {
      // PRAGMA calls return empty — migration guards find no columns to fix
      if (/PRAGMA/i.test(sql)) return [];
      const table = extractTable(sql, 'FROM');
      if (!table) return [];
      return inMemoryTables[table] ?? [];
    }),

    getFirstAsync: jest.fn(async (sql: string, params?: any[]) => {
      const table = extractTable(sql, 'FROM');
      if (!table) return null;
      const rows = inMemoryTables[table] ?? [];
      if (!params?.length) return rows[0] ?? null;
      return rows.find((r) => r.id === params[0]) ?? null;
    }),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal API-shaped quote (mirrors what the server returns). */
function makeApiQuote(overrides: Record<string, any> = {}) {
  return {
    id: 'q-test-1',
    number: 'Q-2026-001',
    clientId: 'client-1',
    clientName: 'Acme Corp',
    jobId: null,
    status: 'draft',
    subtotal: 500,
    gstAmount: 50,
    total: 550,
    validUntil: '2026-12-31',
    notes: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/** Minimal API-shaped invoice (mirrors what the server returns). */
function makeApiInvoice(overrides: Record<string, any> = {}) {
  return {
    id: 'inv-test-1',
    number: 'INV-2026-001',
    clientId: 'client-1',
    clientName: 'Acme Corp',
    jobId: null,
    quoteId: null,
    status: 'draft',
    subtotal: 800,
    gstAmount: 80,
    total: 880,
    amountPaid: 0,
    dueDate: '2026-03-01',
    paidAt: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('cacheQuotes / cacheInvoices — document number field preservation', () => {
  let mockDb: ReturnType<typeof buildMockDb>;

  beforeEach(() => {
    // Clear in-memory tables
    Object.keys(inMemoryTables).forEach((k) => { inMemoryTables[k] = []; });

    // Build a fresh mock db and inject it directly into the singleton,
    // bypassing initialize() and all native-module complexity.
    mockDb = buildMockDb();
    (offlineStorage as any).db = mockDb;
  });

  afterAll(() => {
    // Clean up the injected db so other test suites start fresh
    (offlineStorage as any).db = null;
    (offlineStorage as any).initPromise = null;
  });

  // ── cacheQuotes ────────────────────────────────────────────────────────────

  describe('cacheQuotes', () => {
    it('stores quote.number (API field) into the quote_number SQLite column', async () => {
      const apiQuote = makeApiQuote({ number: 'Q-2026-007' });
      await offlineStorage.cacheQuotes([apiQuote]);

      const rows = inMemoryTables['quotes'] ?? [];
      expect(rows).toHaveLength(1);
      expect(rows[0].quote_number).toBe('Q-2026-007');
    });

    it('getCachedQuotes returns the number field as non-null after cacheQuotes', async () => {
      const apiQuote = makeApiQuote({ number: 'Q-2026-042' });
      await offlineStorage.cacheQuotes([apiQuote]);

      const cached = await offlineStorage.getCachedQuotes();
      expect(cached).toHaveLength(1);
      expect(cached[0].number).toBe('Q-2026-042');
    });

    it('getCachedQuote(id) returns the correct number for a specific quote', async () => {
      const apiQuote = makeApiQuote({ id: 'q-specific', number: 'Q-2026-099' });
      await offlineStorage.cacheQuotes([apiQuote]);

      const cached = await offlineStorage.getCachedQuote('q-specific');
      expect(cached).not.toBeNull();
      expect(cached!.number).toBe('Q-2026-099');
    });

    it('does NOT read quoteNumber (old camelCase field name — pre-fix bug)', async () => {
      // The old code read quote.quoteNumber which is always undefined on a
      // real API response.  This test confirms the fix reads quote.number.
      const bugShape = { ...makeApiQuote(), number: 'Q-CORRECT', quoteNumber: 'Q-OLD-FIELD' };
      await offlineStorage.cacheQuotes([bugShape]);

      const rows = inMemoryTables['quotes'] ?? [];
      // Must come from `number`, not `quoteNumber`
      expect(rows[0].quote_number).toBe('Q-CORRECT');
    });

    it('preserves each document number when caching multiple quotes', async () => {
      const quotes = [
        makeApiQuote({ id: 'q1', number: 'Q-001' }),
        makeApiQuote({ id: 'q2', number: 'Q-002' }),
        makeApiQuote({ id: 'q3', number: 'Q-003' }),
      ];
      await offlineStorage.cacheQuotes(quotes);

      const cached = await offlineStorage.getCachedQuotes();
      expect(cached).toHaveLength(3);
      const numbers = cached.map((q) => q.number).sort();
      expect(numbers).toEqual(['Q-001', 'Q-002', 'Q-003']);
    });
  });

  // ── cacheInvoices ──────────────────────────────────────────────────────────

  describe('cacheInvoices', () => {
    it('stores invoice.number (API field) into the invoice_number SQLite column', async () => {
      const apiInvoice = makeApiInvoice({ number: 'INV-2026-007' });
      await offlineStorage.cacheInvoices([apiInvoice]);

      const rows = inMemoryTables['invoices'] ?? [];
      expect(rows).toHaveLength(1);
      expect(rows[0].invoice_number).toBe('INV-2026-007');
    });

    it('getCachedInvoices returns the number field as non-null after cacheInvoices', async () => {
      const apiInvoice = makeApiInvoice({ number: 'INV-2026-042' });
      await offlineStorage.cacheInvoices([apiInvoice]);

      const cached = await offlineStorage.getCachedInvoices();
      expect(cached).toHaveLength(1);
      expect(cached[0].number).toBe('INV-2026-042');
    });

    it('getCachedInvoice(id) returns the correct number for a specific invoice', async () => {
      const apiInvoice = makeApiInvoice({ id: 'inv-specific', number: 'INV-2026-099' });
      await offlineStorage.cacheInvoices([apiInvoice]);

      const cached = await offlineStorage.getCachedInvoice('inv-specific');
      expect(cached).not.toBeNull();
      expect(cached!.number).toBe('INV-2026-099');
    });

    it('does NOT read invoiceNumber (old camelCase field name — pre-fix bug)', async () => {
      const bugShape = {
        ...makeApiInvoice(),
        number: 'INV-CORRECT',
        invoiceNumber: 'INV-OLD-FIELD',
      };
      await offlineStorage.cacheInvoices([bugShape]);

      const rows = inMemoryTables['invoices'] ?? [];
      expect(rows[0].invoice_number).toBe('INV-CORRECT');
    });

    it('preserves each document number when caching multiple invoices', async () => {
      const invoices = [
        makeApiInvoice({ id: 'i1', number: 'INV-001' }),
        makeApiInvoice({ id: 'i2', number: 'INV-002' }),
        makeApiInvoice({ id: 'i3', number: 'INV-003' }),
      ];
      await offlineStorage.cacheInvoices(invoices);

      const cached = await offlineStorage.getCachedInvoices();
      expect(cached).toHaveLength(3);
      const numbers = cached.map((i) => i.number).sort();
      expect(numbers).toEqual(['INV-001', 'INV-002', 'INV-003']);
    });
  });
});
