/**
 * Unit tests for the LoggedWorkLineItems computation utilities.
 *
 * These cover the critical business logic for turning raw logged work into
 * invoice line items, and the AsyncStorage key contract that bridges the
 * Manage-tab "Draft Invoice" button to the invoice/quote creation screens.
 */
import {
  DRAFT_LINE_ITEMS_KEY,
  computeLabourItems,
  computeMaterialItems,
  computeExpenseItems,
  DEFAULT_MATERIAL_MARKUP,
  type TimeEntryInput,
  type MaterialInput,
  type ExpenseInput,
} from './loggedWorkLineItems';

// ─── DRAFT_LINE_ITEMS_KEY ─────────────────────────────────────────────────────

describe('DRAFT_LINE_ITEMS_KEY', () => {
  it('produces a stable, job-scoped key', () => {
    expect(DRAFT_LINE_ITEMS_KEY('job-123')).toBe('job_draft_line_items_job-123');
  });

  it('differs for different job IDs', () => {
    expect(DRAFT_LINE_ITEMS_KEY('a')).not.toBe(DRAFT_LINE_ITEMS_KEY('b'));
  });
});

// ─── computeLabourItems ───────────────────────────────────────────────────────

describe('computeLabourItems', () => {
  const start = '2024-01-01T08:00:00Z';
  const end2h = '2024-01-01T10:00:00Z'; // 2 hours later
  const end30m = '2024-01-01T08:30:00Z'; // 30 minutes later

  it('groups entries by worker and returns one line per worker', () => {
    const entries: TimeEntryInput[] = [
      { userId: 'u1', userName: 'Alice', startTime: start, endTime: end2h, hourlyRate: '80' },
      { userId: 'u1', userName: 'Alice', startTime: end2h, endTime: '2024-01-01T11:00:00Z', hourlyRate: '80' },
      { userId: 'u2', userName: 'Bob', startTime: start, endTime: end2h, hourlyRate: '90' },
    ];
    const items = computeLabourItems(entries, false);
    expect(items).toHaveLength(2);
    const alice = items.find(i => i.description.includes('Alice'));
    expect(alice).toBeDefined();
    expect(alice!.quantity).toBe(3); // 2h + 1h
    expect(alice!.unitPrice).toBe(80);
    expect(alice!.section).toBe('labour');
  });

  it('omits entries without an endTime', () => {
    const entries: TimeEntryInput[] = [
      { userId: 'u1', userName: 'Alice', startTime: start }, // running timer, no end
    ];
    expect(computeLabourItems(entries, false)).toHaveLength(0);
  });

  it('excludes breaks when billBreaks is false', () => {
    const entries: TimeEntryInput[] = [
      { userId: 'u1', userName: 'Alice', startTime: start, endTime: end2h, hourlyRate: '80', isBreak: true },
    ];
    expect(computeLabourItems(entries, false)).toHaveLength(0);
  });

  it('includes breaks when billBreaks is true', () => {
    const entries: TimeEntryInput[] = [
      { userId: 'u1', userName: 'Alice', startTime: start, endTime: end30m, hourlyRate: '80', isBreak: true },
    ];
    const items = computeLabourItems(entries, true);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(0.5); // 30 min
  });

  it('falls back to zero unitPrice when no hourlyRate is set', () => {
    const entries: TimeEntryInput[] = [
      { userId: 'u1', userName: 'Alice', startTime: start, endTime: end2h },
    ];
    const items = computeLabourItems(entries, false);
    expect(items[0].unitPrice).toBe(0);
  });

  it('uses persisted duration over wall-clock diff to handle paused timers correctly', () => {
    // Wall clock is 2h but the worker paused for 1h — duration=60min is authoritative
    const entries: TimeEntryInput[] = [
      { userId: 'u1', userName: 'Alice', startTime: start, endTime: end2h, duration: 60, hourlyRate: '80' },
    ];
    const items = computeLabourItems(entries, false);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(1); // 60 min = 1 hour
  });

  it('falls back to wall-clock diff when duration is absent (legacy entries)', () => {
    const entries: TimeEntryInput[] = [
      { userId: 'u1', userName: 'Alice', startTime: start, endTime: end2h, hourlyRate: '80' },
    ];
    const items = computeLabourItems(entries, false);
    expect(items[0].quantity).toBe(2); // 2h from timestamps
  });

  it('ignores null/undefined duration and falls back to timestamps', () => {
    const entries: TimeEntryInput[] = [
      { userId: 'u1', userName: 'Alice', startTime: start, endTime: end2h, duration: null, hourlyRate: '80' },
    ];
    const items = computeLabourItems(entries, false);
    expect(items[0].quantity).toBe(2);
  });

  it('omits an entry with malformed timestamps and no duration rather than producing NaN hours', () => {
    const entries: TimeEntryInput[] = [
      { userId: 'u1', userName: 'Alice', startTime: 'bad-date', endTime: 'also-bad', hourlyRate: '80' },
    ];
    // NaN diff → 0 ms → 0 hours → worker omitted
    expect(computeLabourItems(entries, false)).toHaveLength(0);
  });

  it('uses the highest positive rate seen — not the last — so API ordering cannot undercharge', () => {
    // High rate first, low rate second: should still bill at 100
    const highFirst: TimeEntryInput[] = [
      { userId: 'u1', startTime: start, endTime: end2h, hourlyRate: '100' },
      { userId: 'u1', startTime: end2h, endTime: '2024-01-01T12:00:00Z', hourlyRate: '80' },
    ];
    expect(computeLabourItems(highFirst, false)[0].unitPrice).toBe(100);

    // Low rate first, high rate second: should also bill at 100
    const lowFirst: TimeEntryInput[] = [
      { userId: 'u1', startTime: start, endTime: end2h, hourlyRate: '80' },
      { userId: 'u1', startTime: end2h, endTime: '2024-01-01T12:00:00Z', hourlyRate: '100' },
    ];
    expect(computeLabourItems(lowFirst, false)[0].unitPrice).toBe(100);
  });

  it('omits a worker whose total billable hours round to zero', () => {
    // 1 second — rounds to 0.0 hours
    const entries: TimeEntryInput[] = [
      { userId: 'u1', startTime: '2024-01-01T08:00:00Z', endTime: '2024-01-01T08:00:01Z', hourlyRate: '80' },
    ];
    expect(computeLabourItems(entries, false)).toHaveLength(0);
  });

  it('excludes entries explicitly marked non-billable to prevent overbilling', () => {
    const entries: TimeEntryInput[] = [
      { userId: 'u1', userName: 'Alice', startTime: start, endTime: end2h, hourlyRate: '80', isBillable: false },
    ];
    expect(computeLabourItems(entries, false)).toHaveLength(0);
  });

  it('includes entries where isBillable is true', () => {
    const entries: TimeEntryInput[] = [
      { userId: 'u1', userName: 'Alice', startTime: start, endTime: end2h, hourlyRate: '80', isBillable: true },
    ];
    expect(computeLabourItems(entries, false)).toHaveLength(1);
  });

  it('includes entries where isBillable is not set (legacy — treat as billable)', () => {
    const entries: TimeEntryInput[] = [
      { userId: 'u1', userName: 'Alice', startTime: start, endTime: end2h, hourlyRate: '80' },
    ];
    expect(computeLabourItems(entries, false)).toHaveLength(1);
  });

  it('excludes non-billable entries while keeping billable ones for the same worker', () => {
    const entries: TimeEntryInput[] = [
      { userId: 'u1', userName: 'Alice', startTime: start, endTime: end2h, hourlyRate: '80', isBillable: true },
      { userId: 'u1', userName: 'Alice', startTime: end2h, endTime: '2024-01-01T11:00:00Z', hourlyRate: '80', isBillable: false },
    ];
    const items = computeLabourItems(entries, false);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2); // only the 2h billable entry
  });
});

// ─── computeMaterialItems ─────────────────────────────────────────────────────

describe('computeMaterialItems', () => {
  // The API returns PostgreSQL decimal columns as strings — tests use that shape.

  it('uses explicit unitPrice (string) when present and produces a numeric result', () => {
    const mats: MaterialInput[] = [
      { id: 'm1', name: 'Paint', quantity: '3', unitCost: '10', unitPrice: '25' },
    ];
    const items = computeMaterialItems(mats);
    expect(items).toHaveLength(1);
    expect(typeof items[0].unitPrice).toBe('number');
    expect(items[0].unitPrice).toBe(25);
    expect(items[0].quantity).toBe(3);
    expect(items[0].section).toBe('materials');
  });

  it('computes sell price from cost × default markup when no unitPrice (string fields)', () => {
    const mats: MaterialInput[] = [
      { id: 'm1', name: 'Pipe', quantity: '2', unitCost: '50' },
    ];
    const items = computeMaterialItems(mats);
    const expected = Math.round(50 * (1 + DEFAULT_MATERIAL_MARKUP / 100) * 100) / 100;
    expect(items[0].unitPrice).toBe(expected);
  });

  it('uses the caller-supplied fallbackMarkupPercent over DEFAULT_MATERIAL_MARKUP (string fields)', () => {
    const mats: MaterialInput[] = [
      { id: 'm1', name: 'Pipe', quantity: '1', unitCost: '100' },
    ];
    const items = computeMaterialItems(mats, 30); // business configured 30 %
    expect(items[0].unitPrice).toBe(130); // 100 × 1.30
  });

  it('respects per-material markupPercent (string) over fallback', () => {
    const mats: MaterialInput[] = [
      { id: 'm1', name: 'Wire', quantity: '10', unitCost: '5', markupPercent: '50' },
    ];
    const items = computeMaterialItems(mats, 30); // fallback 30 % but per-material wins
    expect(items[0].unitPrice).toBe(7.5); // 5 × 1.5
  });

  it('works with plain number fields too (non-API callers)', () => {
    const mats: MaterialInput[] = [
      { id: 'm1', name: 'Paint', quantity: 3, unitCost: 10, unitPrice: 25 },
    ];
    const items = computeMaterialItems(mats);
    expect(items[0].unitPrice).toBe(25);
  });

  it('omits materials with zero quantity', () => {
    const mats: MaterialInput[] = [
      { id: 'm1', name: 'Widget', quantity: '0', unitCost: '10', unitPrice: '15' },
    ];
    expect(computeMaterialItems(mats)).toHaveLength(0);
  });

  it('omits materials with null quantity', () => {
    const mats: MaterialInput[] = [
      { id: 'm1', name: 'Widget', quantity: null, unitCost: '10', unitPrice: '15' },
    ];
    expect(computeMaterialItems(mats)).toHaveLength(0);
  });

  it('includes materials with no derivable price as zero-rate editable rows', () => {
    // Appears in the review UI so owners can fill in the rate.
    const mats: MaterialInput[] = [
      { id: 'm1', name: 'Unknown Part', quantity: '2', unitCost: '0' },
    ];
    const items = computeMaterialItems(mats);
    expect(items).toHaveLength(1);
    expect(typeof items[0].unitPrice).toBe('number');
    expect(items[0].unitPrice).toBe(0); // editable — owner sets rate in the UI
    expect(items[0].quantity).toBe(2);
    expect(items[0].description).toBe('Unknown Part');
  });

  it('exported zero-price row survives a round-trip through JSON serialisation', () => {
    const mats: MaterialInput[] = [
      { id: 'm1', name: 'Part', quantity: '1', unitCost: '0' },
    ];
    const items = computeMaterialItems(mats);
    const serialised = JSON.stringify(items.map(i => ({ id: i.key, description: i.description, quantity: String(i.quantity), unitPrice: String(i.unitPrice) })));
    const parsed: Array<{ id: string; description: string; quantity: string; unitPrice: string }> = JSON.parse(serialised);
    expect(parsed[0].unitPrice).toBe('0');
    expect(parsed[0].quantity).toBe('1');
  });
});

// ─── computeExpenseItems ──────────────────────────────────────────────────────

describe('computeExpenseItems', () => {
  it('includes approved billable expenses', () => {
    const expenses: ExpenseInput[] = [
      { id: 'e1', description: 'Fuel', amount: '45.00', status: 'approved', isBillable: true },
    ];
    const items = computeExpenseItems(expenses);
    expect(items).toHaveLength(1);
    expect(items[0].description).toContain('Fuel');
    expect(items[0].unitPrice).toBe(45);
    expect(items[0].quantity).toBe(1);
    expect(items[0].section).toBe('expenses');
  });

  it('includes approved expenses where isBillable is not set (treat as billable)', () => {
    const expenses: ExpenseInput[] = [
      { id: 'e1', description: 'Misc', amount: '20.00', status: 'approved' },
    ];
    expect(computeExpenseItems(expenses)).toHaveLength(1);
  });

  it('excludes approved but non-billable expenses to prevent overbilling clients', () => {
    // isBillable: false means the expense is internal-only — approved for reimbursement
    // but must NOT appear on a client invoice or quote.
    const expenses: ExpenseInput[] = [
      { id: 'e1', description: 'Team lunch', amount: '80.00', status: 'approved', isBillable: false },
    ];
    expect(computeExpenseItems(expenses)).toHaveLength(0);
  });

  it('excludes pending and rejected expenses regardless of isBillable', () => {
    const expenses: ExpenseInput[] = [
      { id: 'e1', description: 'Lunch', amount: '20.00', status: 'pending', isBillable: true },
      { id: 'e2', description: 'Tools', amount: '80.00', status: 'rejected', isBillable: true },
    ];
    expect(computeExpenseItems(expenses)).toHaveLength(0);
  });

  it('omits approved billable expenses with zero or invalid amount', () => {
    const expenses: ExpenseInput[] = [
      { id: 'e1', description: 'Free thing', amount: '0', status: 'approved', isBillable: true },
      { id: 'e2', description: 'Bad data', amount: 'NaN', status: 'approved', isBillable: true },
    ];
    expect(computeExpenseItems(expenses)).toHaveLength(0);
  });

  it('uses categoryName in description when provided', () => {
    const expenses: ExpenseInput[] = [
      { id: 'e1', categoryName: 'Travel', description: 'Airport parking', amount: '30', status: 'approved' },
    ];
    const items = computeExpenseItems(expenses);
    expect(items[0].description).toBe('Travel: Airport parking');
  });

  it('falls back to "Expense" category label when categoryName is missing', () => {
    const expenses: ExpenseInput[] = [
      { id: 'e1', description: 'Misc', amount: '15', status: 'approved' },
    ];
    const items = computeExpenseItems(expenses);
    expect(items[0].description).toBe('Expense: Misc');
  });

  it('returns empty array when no expenses are approved', () => {
    expect(computeExpenseItems([])).toHaveLength(0);
  });
});

// ─── AsyncStorage bridge contract ────────────────────────────────────────────

describe('AsyncStorage bridge contract', () => {
  /**
   * These tests verify the data shape that LoggedWorkLineItems writes and
   * invoice/quote screens expect. They don't test AsyncStorage itself (that's
   * an integration concern), but they confirm the serialisation format never
   * silently drifts.
   */
  it('DRAFT_LINE_ITEMS_KEY produces a string safe for AsyncStorage keys', () => {
    const key = DRAFT_LINE_ITEMS_KEY('job-abc-123');
    expect(typeof key).toBe('string');
    expect(key).not.toContain(' ');
    expect(key.length).toBeLessThan(128);
  });

  it('computed item keys are unique across sections', () => {
    const labourItems = computeLabourItems(
      [{ userId: 'u1', startTime: '2024-01-01T08:00:00Z', endTime: '2024-01-01T10:00:00Z' }],
      false,
    );
    const matItems = computeMaterialItems([{ id: 'u1', name: 'Wire', quantity: 1, unitCost: 10, unitPrice: 12 }]);
    const expItems = computeExpenseItems([{ id: 'u1', description: 'Fuel', amount: '30', status: 'approved' }]);
    const allKeys = [
      ...labourItems.map(i => i.key),
      ...matItems.map(i => i.key),
      ...expItems.map(i => i.key),
    ];
    // All keys must be unique even when the underlying IDs coincide
    expect(new Set(allKeys).size).toBe(allKeys.length);
  });
});
