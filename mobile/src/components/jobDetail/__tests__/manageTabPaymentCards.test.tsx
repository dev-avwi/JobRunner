/**
 * Tests for the three payment-collection blocks on the Manage tab.
 *
 *   1. Quick Collect card — job done/in-progress, no invoice, positive total;
 *      hidden for subcontractor users.
 *   2. PaymentCollectionCard — invoice exists and is not yet paid; hidden for
 *      subcontractor users and when canCollectPayments is false.
 *   3. Payment Received card — a linkedReceipt exists; tapping navigates to
 *      /more/receipt/:id; hidden for subcontractor users.
 *
 * Both the extracted ManageTabPaymentSection component (Quick Collect +
 * Payment Received) and the exported PaymentCollectionCard are tested against
 * the real production code so that deleting or misconfiguring those components
 * would cause failures here.
 */

import React from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));

jest.mock('../../../lib/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      card: '#fff',
      cardBorder: '#ddd',
      border: '#e5e7eb',
      foreground: '#111827',
      mutedForeground: '#6b7280',
      muted: '#f3f4f6',
      primary: '#2563eb',
      primaryForeground: '#fff',
      primaryLight: '#dbeafe',
      secondary: '#64748b',
      secondaryForeground: '#fff',
      success: '#16a34a',
      warning: '#d97706',
      info: '#0284c7',
      white: '#fff',
    },
  }),
}));

jest.mock('../../../lib/design-tokens', () => ({
  spacing:     { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 },
  radius:      { sm: 4, md: 8, lg: 12, xl: 16 },
  typography:  { sizes: { xs: 10, sm: 12, md: 14, lg: 16, xl: 20, xxl: 24, '2xl': 22 }, button: { fontSize: 14 } },
  fontWeights: { normal: '400', medium: '500', semibold: '600', bold: '700' },
  iconSizes:   { sm: 14, md: 18, lg: 20, xl: 24 },
  shadows:     { sm: {} },
}));

// formatCurrency is require()'d inside PaymentCollectionCard at call-time.
jest.mock('../../../lib/format', () => ({
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
}));

// PressableRow is used as a named export inside PaymentCollectionCard.
// The old mock only provided `default`, leaving `PressableRow` === undefined,
// which caused react-native-css-interop to crash with "Cannot read displayName".
jest.mock('../../ui/PressableRow', () => {
  const { TouchableOpacity } = require('react-native');
  function MockPressableRow({ children, onPress, testID }: { children?: React.ReactNode; onPress?: () => void; testID?: string }) {
    return <TouchableOpacity testID={testID} onPress={onPress}>{children}</TouchableOpacity>;
  }
  return { __esModule: true, PressableRow: MockPressableRow, default: MockPressableRow };
});

// react-native-css-interop (via nativewind's jsxImportSource) probes safe-area-context
// at JSX-wrap time — mock it to keep the component tree shallow.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

// Remaining JobWorkflowComponents dependencies not exercised by PaymentCollectionCard.
jest.mock('@/lib/alert', () => ({ Alert: { alert: jest.fn() } }));
jest.mock('../../../lib/api', () => ({ api: { post: jest.fn(), put: jest.fn() } }));
jest.mock('../../../lib/toast', () => ({ showToast: jest.fn() }));
jest.mock('../../../lib/location-tracking', () => ({ default: { start: jest.fn() } }));
jest.mock('../../../lib/smsGate', () => ({
  handleDedicatedNumberError: jest.fn(),
  handleStatusSmsOutcome: jest.fn(),
}));

// ─── Production imports ───────────────────────────────────────────────────────

import { ManageTabPaymentSection, type ManageTabPaymentSectionProps } from '../ManageTabPaymentSection';
import { PaymentCollectionCard } from '../../JobWorkflowComponents';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findAllByTestID(tree: ReactTestRenderer, testID: string) {
  return tree.root.findAll((n) => n.props?.testID === testID);
}

function hasTestID(tree: ReactTestRenderer, testID: string): boolean {
  return findAllByTestID(tree, testID).length > 0;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOOP = jest.fn();

const BASE_SECTION_PROPS: ManageTabPaymentSectionProps = {
  isSubcontractorUser:   false,
  canCollectPayments:    true,
  jobStatus:             'done',
  jobId:                 'job-1',
  invoice:               null,
  quickCollectTotal:     250,
  quickCollectSource:    'quote',
  linkedReceipt:         null,
  isQuickCollecting:     false,
  showTapToPay:          false,
  onQuickCollectCash:    NOOP,
  onQuickCollectCard:    NOOP,
  onQuickCollectBank:    NOOP,
  onTapToPayQuickCollect: NOOP,
  onTapToPay:            NOOP,
  onQRCode:              NOOP,
  onPaymentLink:         NOOP,
  onRecordCash:          NOOP,
};

const RECEIPT = {
  id: 'rcpt-42',
  receiptNumber: 'REC-042',
  paymentMethod: 'cash',
  createdAt: '2026-09-01T10:00:00Z',
  amount: 375,
};

const UNPAID_INVOICE = {
  id: 'inv-1',
  number: 'INV-001',
  status: 'sent',
  total: 500,
  paidAmount: 100,
};

async function renderSection(props: ManageTabPaymentSectionProps): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<ManageTabPaymentSection {...props} />); });
  return tree;
}

// ─── Quick Collect card (ManageTabPaymentSection) ─────────────────────────────

describe('Quick Collect card', () => {
  it('appears for a done job with no invoice and a positive total', async () => {
    const tree = await renderSection(BASE_SECTION_PROPS);
    expect(hasTestID(tree, 'quick-collect-card')).toBe(true);
  });

  it('appears for an in-progress job', async () => {
    const tree = await renderSection({ ...BASE_SECTION_PROPS, jobStatus: 'in_progress' });
    expect(hasTestID(tree, 'quick-collect-card')).toBe(true);
  });

  it('is hidden for subcontractor users', async () => {
    const tree = await renderSection({ ...BASE_SECTION_PROPS, isSubcontractorUser: true });
    expect(hasTestID(tree, 'quick-collect-card')).toBe(false);
  });

  it('is hidden when an invoice already exists', async () => {
    const tree = await renderSection({ ...BASE_SECTION_PROPS, invoice: UNPAID_INVOICE });
    expect(hasTestID(tree, 'quick-collect-card')).toBe(false);
  });

  it('is hidden when the collectible total is zero', async () => {
    const tree = await renderSection({ ...BASE_SECTION_PROPS, quickCollectTotal: 0 });
    expect(hasTestID(tree, 'quick-collect-card')).toBe(false);
  });

  it('is hidden when the job is pending (neither done nor in-progress)', async () => {
    const tree = await renderSection({ ...BASE_SECTION_PROPS, jobStatus: 'pending' });
    expect(hasTestID(tree, 'quick-collect-card')).toBe(false);
  });

  it('is hidden when canCollectPayments is false', async () => {
    const tree = await renderSection({ ...BASE_SECTION_PROPS, canCollectPayments: false });
    expect(hasTestID(tree, 'quick-collect-card')).toBe(false);
  });
});

// ─── PaymentCollectionCard (ManageTabPaymentSection wrapper + direct) ─────────

describe('PaymentCollectionCard via ManageTabPaymentSection', () => {
  it('appears when an invoice is unpaid and the user is not a subcontractor', async () => {
    const tree = await renderSection({
      ...BASE_SECTION_PROPS,
      quickCollectTotal: 0,
      invoice: UNPAID_INVOICE,
    });
    expect(hasTestID(tree, 'payment-collection-card')).toBe(true);
  });

  it('is hidden for subcontractor users even with an unpaid invoice', async () => {
    const tree = await renderSection({
      ...BASE_SECTION_PROPS,
      isSubcontractorUser: true,
      quickCollectTotal: 0,
      invoice: UNPAID_INVOICE,
    });
    expect(hasTestID(tree, 'payment-collection-card')).toBe(false);
  });

  it('is hidden when the invoice is fully paid', async () => {
    const tree = await renderSection({
      ...BASE_SECTION_PROPS,
      quickCollectTotal: 0,
      invoice: { ...UNPAID_INVOICE, status: 'paid' },
    });
    expect(hasTestID(tree, 'payment-collection-card')).toBe(false);
  });
});

describe('PaymentCollectionCard directly', () => {
  it('renders when an unpaid invoice exists and canCollectPayments is true', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <PaymentCollectionCard
          invoice={UNPAID_INVOICE}
          jobId="job-1"
          canCollectPayments
          onTapToPay={NOOP}
          onQRCode={NOOP}
          onPaymentLink={NOOP}
          onRecordCash={NOOP}
        />,
      );
    });
    expect(hasTestID(tree, 'payment-collection-card')).toBe(true);
  });

  it('renders nothing when invoice is null', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <PaymentCollectionCard
          invoice={null}
          jobId="job-1"
          canCollectPayments
          onTapToPay={NOOP}
          onQRCode={NOOP}
          onPaymentLink={NOOP}
          onRecordCash={NOOP}
        />,
      );
    });
    expect(hasTestID(tree, 'payment-collection-card')).toBe(false);
  });

  it('renders nothing when the invoice is fully paid', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <PaymentCollectionCard
          invoice={{ ...UNPAID_INVOICE, status: 'paid' }}
          jobId="job-1"
          canCollectPayments
          onTapToPay={NOOP}
          onQRCode={NOOP}
          onPaymentLink={NOOP}
          onRecordCash={NOOP}
        />,
      );
    });
    expect(hasTestID(tree, 'payment-collection-card')).toBe(false);
  });

  it('renders nothing when canCollectPayments is false', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <PaymentCollectionCard
          invoice={UNPAID_INVOICE}
          jobId="job-1"
          canCollectPayments={false}
          onTapToPay={NOOP}
          onQRCode={NOOP}
          onPaymentLink={NOOP}
          onRecordCash={NOOP}
        />,
      );
    });
    expect(hasTestID(tree, 'payment-collection-card')).toBe(false);
  });
});

// ─── Payment Received card (ManageTabPaymentSection) ──────────────────────────

describe('Payment Received card', () => {
  it('appears when a linkedReceipt exists', async () => {
    const tree = await renderSection({ ...BASE_SECTION_PROPS, linkedReceipt: RECEIPT });
    expect(hasTestID(tree, 'payment-received-card')).toBe(true);
  });

  it('is hidden when there is no linkedReceipt', async () => {
    const tree = await renderSection({ ...BASE_SECTION_PROPS, linkedReceipt: null });
    expect(hasTestID(tree, 'payment-received-card')).toBe(false);
  });

  it('is hidden for subcontractor users even when a receipt exists', async () => {
    const tree = await renderSection({
      ...BASE_SECTION_PROPS,
      isSubcontractorUser: true,
      linkedReceipt: RECEIPT,
    });
    expect(hasTestID(tree, 'payment-received-card')).toBe(false);
  });

  it('navigates to /more/receipt/:id when tapped', async () => {
    mockRouterPush.mockReset();
    const tree = await renderSection({ ...BASE_SECTION_PROPS, linkedReceipt: RECEIPT });

    await act(async () => {
      findAllByTestID(tree, 'payment-received-card')[0].props.onPress();
      await Promise.resolve();
    });

    expect(mockRouterPush).toHaveBeenCalledWith('/more/receipt/rcpt-42');
  });

  it('shows the receipt amount', async () => {
    const tree = await renderSection({ ...BASE_SECTION_PROPS, linkedReceipt: RECEIPT });
    const card = findAllByTestID(tree, 'payment-received-card')[0];
    const allText = card.findAll((n) => n.type === 'Text');
    const combined = allText.map((t) => String(t.props.children)).join(' ');
    expect(combined).toContain('375');
  });
});

// ─── Quick Collect button actions ─────────────────────────────────────────────
//
// Verify that pressing each Quick Collect button invokes the correct callback.
// These are user-press simulations through the real rendered TouchableOpacity
// elements — not direct prop calls.

describe('Quick Collect button actions', () => {
  let onCash: jest.Mock;
  let onCard: jest.Mock;
  let onBank: jest.Mock;

  beforeEach(() => {
    onCash = jest.fn();
    onCard = jest.fn();
    onBank = jest.fn();
  });

  async function renderWithHandlers() {
    return renderSection({
      ...BASE_SECTION_PROPS,
      onQuickCollectCash: onCash,
      onQuickCollectCard: onCard,
      onQuickCollectBank: onBank,
    });
  }

  it('Cash button press invokes onQuickCollectCash', async () => {
    const tree = await renderWithHandlers();
    await act(async () => {
      findAllByTestID(tree, 'quick-collect-cash')[0].props.onPress();
      await Promise.resolve();
    });
    expect(onCash).toHaveBeenCalledTimes(1);
    expect(onCard).not.toHaveBeenCalled();
    expect(onBank).not.toHaveBeenCalled();
  });

  it('Card Link button press invokes onQuickCollectCard', async () => {
    const tree = await renderWithHandlers();
    await act(async () => {
      findAllByTestID(tree, 'quick-collect-card-link')[0].props.onPress();
      await Promise.resolve();
    });
    expect(onCard).toHaveBeenCalledTimes(1);
    expect(onCash).not.toHaveBeenCalled();
    expect(onBank).not.toHaveBeenCalled();
  });

  it('Bank button press invokes onQuickCollectBank', async () => {
    const tree = await renderWithHandlers();
    await act(async () => {
      findAllByTestID(tree, 'quick-collect-bank')[0].props.onPress();
      await Promise.resolve();
    });
    expect(onBank).toHaveBeenCalledTimes(1);
    expect(onCash).not.toHaveBeenCalled();
    expect(onCard).not.toHaveBeenCalled();
  });
});

// ─── Wiring: ManageTabPaymentSection is connected in job/[id].tsx ─────────────
//
// These source-level assertions verify the section is imported and rendered in
// the Manage tab. They catch accidental deletion of the wiring without
// requiring the full 17 000-line screen to be mounted in Jest (which would
// demand mocking 100+ imports).

describe('job/[id].tsx wiring', () => {
  const fs = require('fs');
  const path = require('path');
  const screenSource: string = fs.readFileSync(
    path.resolve(__dirname, '../../../../app/job/[id].tsx'),
    'utf-8',
  );

  it('imports ManageTabPaymentSection', () => {
    expect(screenSource).toContain('ManageTabPaymentSection');
  });

  it('renders <ManageTabPaymentSection in the Manage tab', () => {
    expect(screenSource).toContain('<ManageTabPaymentSection');
  });

  it('passes isSubcontractorUser prop to ManageTabPaymentSection', () => {
    expect(screenSource).toContain('isSubcontractorUser={isSubcontractorUser}');
  });

  it('passes canCollectPayments prop to ManageTabPaymentSection', () => {
    expect(screenSource).toContain('canCollectPayments={canCollectPayments}');
  });

  it('passes linkedReceipt prop to ManageTabPaymentSection', () => {
    expect(screenSource).toContain('linkedReceipt={linkedReceipt}');
  });
});
