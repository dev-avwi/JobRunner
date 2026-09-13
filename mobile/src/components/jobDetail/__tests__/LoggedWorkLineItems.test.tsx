/**
 * Component-level tests for LoggedWorkLineItems.
 *
 * Focus: invoice/quote action button routing (Draft Invoice vs View Invoice)
 * and owner-guard. Complements the pure-utility tests in
 * src/utils/loggedWorkLineItems.test.ts.
 */
import React from 'react';
import { act, create } from 'react-test-renderer';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRouterPush = jest.fn();
const mockAsyncStorageSetItem = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: (...args: unknown[]) => mockAsyncStorageSetItem(...args),
    getItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

jest.mock('../../ui/AppBottomSheet', () => ({
  __esModule: true,
  default: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View testID="edit-sheet">{children}{footer}</View>;
  },
}));

jest.mock('../../../lib/toast', () => ({ showToast: jest.fn() }));

jest.mock('../../../lib/store', () => ({
  useAuthStore: () => ({ businessSettings: { defaultMaterialMarkupPct: '20' } }),
}));

jest.mock('../../../lib/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff', card: '#fff', cardBorder: '#ddd',
      foreground: '#000', mutedForeground: '#666',
      primary: '#007aff', primaryForeground: '#fff',
      destructive: '#ff3b30', success: '#34c759', buttonOutline: '#ddd',
    },
  }),
}));

jest.mock('../../../lib/design-tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16 },
  typography: { sizes: { xs: 10, sm: 12, md: 14, lg: 16, xl: 20, xxl: 24 } },
  fontWeights: { normal: '400', medium: '500', semibold: '600', bold: '700' },
}));

import { LoggedWorkLineItems } from '../LoggedWorkLineItems';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const JOB_ID = 'job-test-1';

const TIME_ENTRY = {
  id: 'te-1',
  userId: 'u1',
  userName: 'Alice',
  startTime: '2024-01-01T08:00:00Z',
  endTime: '2024-01-01T10:00:00Z',
  duration: 120,
  hourlyRate: '80',
  isBillable: true,
};

const MATERIAL = {
  id: 'mat-1',
  name: 'Paint',
  quantity: '2',
  unitCost: '10',
  unitPrice: '25',
};

const EXPENSE = {
  id: 'exp-1',
  categoryId: 'cat-1',
  categoryName: 'Travel',
  description: 'Fuel',
  amount: '45',
  expenseDate: '2024-01-01',
  isBillable: true,
  status: 'approved',
};

const baseProps = {
  jobId: JOB_ID,
  jobTitle: 'Test Job',
  isOwnerOrManager: true,
  invoice: null as any,
  quote: null as any,
  clientId: 'client-1',
  timeEntries: [TIME_ENTRY],
  materials: [MATERIAL],
  jobExpenses: [EXPENSE],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Find a React component instance by testID using `renderer.root`.
 * Returns the first match, or null. Use this for interactive elements
 * because `toJSON()` strips event handlers.
 */
function findInstanceByTestID(root: any, testID: string): any {
  try {
    const all = root.findAll(
      (n: any) => n.props && n.props.testID === testID,
      { deep: true },
    );
    return all.length > 0 ? all[0] : null;
  } catch {
    return null;
  }
}

/** Collect all string leaf values in the JSON tree (for text assertions). */
function allLeafText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(allLeafText).join('');
  if (typeof node === 'object') return (node.children || []).map(allLeafText).join('');
  return '';
}

// ─── Invoice action button routing ────────────────────────────────────────────

describe('invoice action button', () => {
  afterEach(() => {
    mockRouterPush.mockClear();
    mockAsyncStorageSetItem.mockClear();
  });

  it('shows Draft Invoice (testID=btn-draft-invoice) when no invoice exists', async () => {
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<LoggedWorkLineItems {...baseProps} invoice={null} />);
    });
    expect(findInstanceByTestID(renderer!.root, 'btn-draft-invoice')).not.toBeNull();
    expect(findInstanceByTestID(renderer!.root, 'btn-view-invoice')).toBeNull();
  });

  it('shows View Invoice (testID=btn-view-invoice) when a draft invoice exists — prevents duplicate invoicing', async () => {
    const draftInvoice = { id: 'inv-1', number: '001', title: 'Test', total: 100, status: 'draft' as const };
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<LoggedWorkLineItems {...baseProps} invoice={draftInvoice} />);
    });
    expect(findInstanceByTestID(renderer!.root, 'btn-view-invoice')).not.toBeNull();
    expect(findInstanceByTestID(renderer!.root, 'btn-draft-invoice')).toBeNull();
  });

  it('shows View Invoice when a sent invoice exists', async () => {
    const sentInvoice = { id: 'inv-2', number: '002', title: 'Test', total: 200, status: 'sent' as const };
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<LoggedWorkLineItems {...baseProps} invoice={sentInvoice} />);
    });
    expect(findInstanceByTestID(renderer!.root, 'btn-view-invoice')).not.toBeNull();
    expect(findInstanceByTestID(renderer!.root, 'btn-draft-invoice')).toBeNull();
  });

  it('shows View Invoice when a paid invoice exists', async () => {
    const paidInvoice = { id: 'inv-3', number: '003', title: 'Test', total: 300, status: 'paid' as const };
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<LoggedWorkLineItems {...baseProps} invoice={paidInvoice} />);
    });
    expect(findInstanceByTestID(renderer!.root, 'btn-view-invoice')).not.toBeNull();
    expect(findInstanceByTestID(renderer!.root, 'btn-draft-invoice')).toBeNull();
  });

  it('View Invoice navigates to the existing invoice — not a creation screen', async () => {
    const invoice = { id: 'inv-42', number: '042', title: 'Test', total: 100, status: 'draft' as const };
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<LoggedWorkLineItems {...baseProps} invoice={invoice} />);
    });
    const btn = findInstanceByTestID(renderer!.root, 'btn-view-invoice');
    expect(btn).not.toBeNull();
    await act(async () => {
      btn.props.onPress();
    });
    expect(mockRouterPush).toHaveBeenCalledWith('/more/invoice/inv-42');
    expect(mockRouterPush).not.toHaveBeenCalledWith(expect.stringContaining('/more/invoice/new'));
  });

  it('Draft Invoice writes line items to AsyncStorage before navigating', async () => {
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<LoggedWorkLineItems {...baseProps} invoice={null} />);
    });
    const btn = findInstanceByTestID(renderer!.root, 'btn-draft-invoice');
    expect(btn).not.toBeNull();
    await act(async () => {
      btn.props.onPress();
    });
    expect(mockAsyncStorageSetItem).toHaveBeenCalledWith(
      `job_draft_line_items_${JOB_ID}`,
      expect.any(String),
    );
    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.stringContaining(`/more/invoice/new?jobId=${JOB_ID}`),
    );
  });

  it('Draft Invoice payload includes items from all three data sources with numeric unitPrice strings', async () => {
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<LoggedWorkLineItems {...baseProps} invoice={null} />);
    });
    const btn = findInstanceByTestID(renderer!.root, 'btn-draft-invoice');
    await act(async () => { btn.props.onPress(); });

    const [, rawPayload] = mockAsyncStorageSetItem.mock.calls[0];
    const items: Array<{ description: string; quantity: string; unitPrice: string }> = JSON.parse(rawPayload);
    const descriptions = items.map(i => i.description);
    // Labour item from time entry
    expect(descriptions.some(d => d.includes('Alice'))).toBe(true);
    // Material item
    expect(descriptions.some(d => d.includes('Paint'))).toBe(true);
    // Expense item
    expect(descriptions.some(d => d.includes('Fuel'))).toBe(true);
    // All unitPrice values must be numeric strings (not raw API decimal objects)
    items.forEach(i => expect(Number.isFinite(parseFloat(i.unitPrice))).toBe(true));
  });
});

// ─── Owner guard ──────────────────────────────────────────────────────────────

describe('owner guard', () => {
  it('renders nothing when isOwnerOrManager is false', async () => {
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<LoggedWorkLineItems {...baseProps} isOwnerOrManager={false} />);
    });
    expect(renderer!.toJSON()).toBeNull();
  });

  it('renders the billing section when isOwnerOrManager is true', async () => {
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<LoggedWorkLineItems {...baseProps} isOwnerOrManager={true} />);
    });
    expect(renderer!.toJSON()).not.toBeNull();
  });
});

// ─── Empty state ──────────────────────────────────────────────────────────────

describe('empty state', () => {
  it('renders an empty-state hint when no work has been logged', async () => {
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(
        <LoggedWorkLineItems
          {...baseProps}
          timeEntries={[]}
          materials={[]}
          jobExpenses={[]}
        />,
      );
    });
    const text = allLeafText(renderer!.toJSON());
    expect(text).toContain('No work logged');
  });
});
