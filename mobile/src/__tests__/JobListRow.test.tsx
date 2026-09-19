/**
 * Tests for the JobListRow component rendered in the jobs list view.
 * Covers: project type badge + health row, recurring badge + next-recurrence
 * label, and the Invoice CTA shown when a job is done.
 */
import React from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer, ReactTestInstance } from 'react-test-renderer';

// ─── dependency mocks ────────────────────────────────────────────────────────

jest.mock('@/lib/alert', () => ({ Alert: { alert: jest.fn() } }));

jest.mock('@/components/ui/PressableRow', () => ({
  __esModule: true,
  PressableRow: ({ children, onPress }: any) => {
    const { TouchableOpacity } = require('react-native');
    return <TouchableOpacity onPress={onPress}>{children}</TouchableOpacity>;
  },
}));

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: mockRouterPush },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({}),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../lib/device', () => ({
  useContentWidth: () => 390,
  useIsTablet: () => false,
}));

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));

jest.mock('../lib/store', () => ({
  useJobsStore: () => ({ jobs: [], isLoading: false, fetchJobs: jest.fn(), deleteJob: jest.fn() }),
  useClientsStore: () => ({ clients: [], fetchClients: jest.fn() }),
  useAuthStore: () => ({ user: null }),
}));

jest.mock('../hooks/use-user-role', () => ({
  useUserRole: () => ({
    isOwnerOrManager: true,
    isSubcontractor: false,
    isStandaloneSubcontractor: false,
    isSoloOwner: false,
    hasPermission: () => true,
  }),
}));

const mockApiGet = jest.fn();
jest.mock('../lib/api', () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../components/ui/StatusBadge', () => ({
  StatusBadge: () => null,
}));

jest.mock('../components/ui/XeroBadge', () => ({
  XeroBadge: () => null,
}));

jest.mock('../components/ui/AnimatedPressable', () => ({
  AnimatedCardPressable: ({ children, onPress, style }: any) => {
    const { TouchableOpacity } = require('react-native');
    return <TouchableOpacity onPress={onPress} style={style}>{children}</TouchableOpacity>;
  },
}));

const COLORS = {
  background: '#ffffff',
  card: '#ffffff',
  cardBorder: '#d1d5db',
  border: '#d1d5db',
  destructive: '#dc2626',
  foreground: '#111827',
  muted: '#f3f4f6',
  mutedForeground: '#6b7280',
  primary: '#2563eb',
  primaryForeground: '#ffffff',
  primaryLight: '#dbeafe',
  pending: '#f59e0b',
  scheduled: '#3b82f6',
  inProgress: '#8b5cf6',
  done: '#22c55e',
  invoiced: '#6b7280',
  isDark: false,
} as any;

jest.mock('../lib/theme', () => ({
  useTheme: () => ({ colors: COLORS }),
  colorWithOpacity: (c: string) => c,
}));

jest.mock('../lib/design-tokens', () => ({
  fontWeights: { regular: '400', medium: '500', semibold: '600', bold: '700' },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { sm: 4, md: 8, lg: 12, full: 9999 },
  shadows: { sm: {}, md: {}, card: {} },
  sizes: { icon: { sm: 14, md: 16, lg: 20 } },
  pageShell: { paddingHorizontal: 16 },
  typography: {
    sizes: { xs: 11, sm: 13, md: 15, lg: 17, xl: 20, '2xl': 22, xxl: 24, '3xl': 28, '4xl': 32 },
    button: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
    caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
    captionSmall: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
    body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
    bodySemibold: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
    label: { fontSize: 11, fontWeight: '500' },
    badge: { fontSize: 11, fontWeight: '600' },
    cardTitle: { fontSize: 17, fontWeight: '600', lineHeight: 23 },
    subtitle: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
    headline: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
    sectionHeader: { fontSize: 13, fontWeight: '600' },
    statValue: { fontSize: 22, fontWeight: '700' },
    bodySmall: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
    title: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
    sectionTitle: { fontSize: 22, fontWeight: '600', lineHeight: 28 },
    pageTitle: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
    largeTitle: { fontSize: 32, fontWeight: '700', lineHeight: 38 },
  },
  iconSizes: { sm: 14, md: 16, lg: 20 },
  usePageShell: () => ({ paddingHorizontal: 16, paddingTop: 0, paddingBottom: 0 }),
  HEADER_HEIGHT: 60,
}));

jest.mock('../contexts/ScrollContext', () => ({
  useScrollToTop: () => ({ ref: { current: null }, scrollToTop: jest.fn() }),
}));

jest.mock('../components/Skeleton', () => ({
  SkeletonJobCard: () => null,
}));

jest.mock('../hooks/usePreserveScrollOnFold', () => ({
  usePreserveScrollOnFold: () => ({ onScroll: jest.fn(), scrollY: { current: 0 } }),
}));

jest.mock('../lib/jobUrgency', () => ({
  getJobUrgency: () => null,
}));

jest.mock('../components/UsageLimitBanner', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../components/QuickActionSheet', () => ({
  QuickActionSheet: () => null,
}));

jest.mock('../lib/toast', () => ({
  showToast: jest.fn(),
}));

jest.mock('../components/ui/Button', () => ({
  Button: ({ children, onPress, icon }: any) => {
    const { TouchableOpacity, View } = require('react-native');
    return (
      <TouchableOpacity onPress={onPress}>
        {icon ? <View>{icon}</View> : null}
        {children}
      </TouchableOpacity>
    );
  },
}));

jest.mock('../components/ui/ConfirmDialog', () => ({
  useConfirmDialog: () => jest.fn().mockResolvedValue(false),
}));

// ─── import component under test (after all mocks are in place) ──────────────

import { JobListRow } from '../../app/(tabs)/jobs';

// ─── helpers ─────────────────────────────────────────────────────────────────

function findAllWithText(tree: ReactTestRenderer, str: string): ReactTestInstance[] {
  return tree.root.findAll((node: ReactTestInstance) => {
    if (node.type !== 'Text') return false;
    const flatten = (children: any): string =>
      Array.isArray(children)
        ? children.map(flatten).join('')
        : typeof children === 'string'
        ? children
        : '';
    return flatten(node.props.children).includes(str);
  });
}

function hasText(tree: ReactTestRenderer, str: string): boolean {
  return findAllWithText(tree, str).length > 0;
}

const BASE_JOB = {
  id: 'job-1',
  title: 'Test Job',
  status: 'scheduled',
  jobType: 'service_call',
  isRecurring: false,
  nextRecurrenceDate: null,
  isXeroImport: false,
  scheduledAt: null,
  clientName: 'Acme Corp',
  address: null,
  jobNumber: 'J001',
};

async function renderRow(job: any, extra: { canCreateInvoices?: boolean } = {}): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <JobListRow
        job={job}
        onPress={jest.fn()}
        onDelete={jest.fn()}
        onQuickAction={jest.fn()}
        onShowActionSheet={jest.fn()}
        canCreateInvoices={extra.canCreateInvoices ?? true}
      />,
    );
    // Allow MobileProjectHealthRow's useEffect to settle
    await Promise.resolve();
  });
  return tree;
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('JobListRow badges and CTAs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: all API calls return empty data
    mockApiGet.mockResolvedValue({ data: [] });
  });

  it('shows the Project badge and project health row for a project-type job', async () => {
    // Seed phase data so MobileProjectHealthRow has something to display
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/phases')) {
        return Promise.resolve({
          data: [
            { id: 'ph-1', status: 'completed' },
            { id: 'ph-2', status: 'in_progress' },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });

    const job = { ...BASE_JOB, jobType: 'project' };
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <JobListRow
          job={job}
          onPress={jest.fn()}
          onDelete={jest.fn()}
          onQuickAction={jest.fn()}
          onShowActionSheet={jest.fn()}
          canCreateInvoices
        />,
      );
    });
    // Flush the useEffect that loads health data
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    expect(hasText(tree, 'Project')).toBe(true);
    // Health row shows "done/total phases" text
    expect(hasText(tree, 'phases')).toBe(true);
  });

  it('shows the Recurring badge and next-recurrence label for a recurring job', async () => {
    const job = {
      ...BASE_JOB,
      isRecurring: true,
      nextRecurrenceDate: '2026-10-15T00:00:00.000Z',
    };
    const tree = await renderRow(job);

    expect(hasText(tree, 'Recurring')).toBe(true);
    expect(hasText(tree, 'Next:')).toBe(true);
  });

  it('shows the Invoice CTA when a job is done', async () => {
    const job = { ...BASE_JOB, status: 'done' };
    const tree = await renderRow(job, { canCreateInvoices: true });

    expect(hasText(tree, 'Invoice')).toBe(true);
  });

  it('does not show the Invoice CTA when the job is not done', async () => {
    const job = { ...BASE_JOB, status: 'in_progress' };
    const tree = await renderRow(job, { canCreateInvoices: true });

    // StatusBadge is mocked to null, so the only "Invoice" text would be the CTA
    expect(hasText(tree, 'Invoice')).toBe(false);
  });

  it('does not show the Invoice CTA when canCreateInvoices is false', async () => {
    const job = { ...BASE_JOB, status: 'done' };
    const tree = await renderRow(job, { canCreateInvoices: false });

    expect(hasText(tree, 'Invoice')).toBe(false);
  });
});
