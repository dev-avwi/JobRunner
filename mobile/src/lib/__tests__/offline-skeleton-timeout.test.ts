/**
 * Offline skeleton timeout tests
 *
 * Verifies that every main data screen's store exits isLoading=true within
 * 5 seconds when the network is unavailable (airplane-mode simulation).
 *
 * Regression guard: if a new store initialises to isLoading:true but its
 * offline path silently skips the isLoading:false call, these tests will
 * catch it before a regression ships.
 *
 * Screens covered:
 *  - Jobs          (mobile/app/(tabs)/jobs.tsx)
 *  - Clients       (mobile/app/more/clients.tsx)
 *  - Invoices      (mobile/app/more/invoices.tsx)
 *  - Quotes        (mobile/app/more/quotes.tsx)
 *  - Notifications (mobile/app/more/notifications-inbox.tsx)
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
// __esModule: true so that Babel's interop unwraps the `default` export
// correctly, matching what store.ts receives at runtime.
// We hold references to the cache fns so tests can override return values.
const mockGetCachedJobs = jest.fn().mockResolvedValue([]);
const mockGetCachedClients = jest.fn().mockResolvedValue([]);
const mockGetCachedQuotes = jest.fn().mockResolvedValue([]);
const mockGetCachedInvoices = jest.fn().mockResolvedValue([]);

jest.mock('../offline-storage', () => ({
  __esModule: true,
  useOfflineStore: {
    getState: jest.fn(() => ({ isOnline: false })),
    subscribe: jest.fn(() => () => {}),
    setState: jest.fn(),
    destroy: jest.fn(),
  },
  default: {
    getCachedJobs: (...args: unknown[]) => mockGetCachedJobs(...args),
    getCachedClients: (...args: unknown[]) => mockGetCachedClients(...args),
    getCachedQuotes: (...args: unknown[]) => mockGetCachedQuotes(...args),
    getCachedInvoices: (...args: unknown[]) => mockGetCachedInvoices(...args),
    getCachedJob: jest.fn().mockResolvedValue(null),
    getCachedClient: jest.fn().mockResolvedValue(null),
    getCachedQuote: jest.fn().mockResolvedValue(null),
    getCachedInvoice: jest.fn().mockResolvedValue(null),
    cacheJobs: jest.fn().mockResolvedValue(undefined),
    cacheClients: jest.fn().mockResolvedValue(undefined),
    cacheQuotes: jest.fn().mockResolvedValue(undefined),
    cacheInvoices: jest.fn().mockResolvedValue(undefined),
    getCachedAuthData: jest.fn().mockResolvedValue(null),
    cacheAuthData: jest.fn().mockResolvedValue(undefined),
    clearCachedAuthData: jest.fn().mockResolvedValue(undefined),
    clearCache: jest.fn().mockResolvedValue(undefined),
    fullSync: jest.fn().mockResolvedValue(undefined),
  },
}));

// ── API mock — all calls fail to simulate no network ─────────────────────────
const mockApiGet = jest.fn().mockRejectedValue(new Error('Network request failed'));

jest.mock('../api', () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: jest.fn().mockRejectedValue(new Error('Network request failed')),
    patch: jest.fn().mockRejectedValue(new Error('Network request failed')),
    delete: jest.fn().mockRejectedValue(new Error('Network request failed')),
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
  default: {
    startTracking: jest.fn(),
    stopTracking: jest.fn(),
  },
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
import { useNotificationsStore } from '../notifications-store';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calls fetch, awaits it, then asserts isLoading is false.
 * The 5-second Jest timeout (set below) is the hard deadline — if the fetch
 * hangs (regression: isLoading stuck true), the test fails with a timeout.
 */
async function assertSkeletonClears(
  fetch: () => Promise<void>,
  getIsLoading: () => boolean,
  screenName: string,
): Promise<void> {
  await fetch();
  if (getIsLoading()) {
    throw new Error(
      `[${screenName}] Skeleton (isLoading=true) was still visible after fetch resolved. ` +
        'The offline path must call set({ isLoading: false }) on every branch.',
    );
  }
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Offline skeleton timeout — every main screen clears isLoading within 5 s when network is unavailable', () => {
  // 5-second hard deadline per test, matching the UX requirement.
  jest.setTimeout(5000);

  beforeEach(() => {
    // Reset per-call mocks to their default (empty success) behaviour.
    mockGetCachedJobs.mockResolvedValue([]);
    mockGetCachedClients.mockResolvedValue([]);
    mockGetCachedQuotes.mockResolvedValue([]);
    mockGetCachedInvoices.mockResolvedValue([]);
    mockApiGet.mockRejectedValue(new Error('Network request failed'));

    // Reset each store to its initial loading state so tests are independent.
    useJobsStore.setState({ isLoading: true, jobs: [], error: null, isOfflineData: false });
    useClientsStore.setState({
      isLoading: true,
      clients: [],
      error: null,
      isOfflineData: false,
      lastFetched: null,
    });
    useQuotesStore.setState({ isLoading: true, quotes: [], error: null, isOfflineData: false });
    useInvoicesStore.setState({ isLoading: true, invoices: [], error: null, isOfflineData: false });
    useNotificationsStore.setState({
      isLoading: true,
      notifications: [],
      error: null,
      unreadCount: 0,
      lastFetchTime: 0,
    });
  });

  // ── Jobs ──────────────────────────────────────────────────────────────────

  it('Jobs screen: skeleton clears when offline (empty cache)', async () => {
    await assertSkeletonClears(
      () => useJobsStore.getState().fetchJobs(),
      () => useJobsStore.getState().isLoading,
      'Jobs',
    );
  });

  it('Jobs screen: skeleton clears when offline cache read throws', async () => {
    mockGetCachedJobs.mockRejectedValueOnce(new Error('SQLite error'));
    await assertSkeletonClears(
      () => useJobsStore.getState().fetchJobs(),
      () => useJobsStore.getState().isLoading,
      'Jobs (cache-read error)',
    );
  });

  // ── Clients ───────────────────────────────────────────────────────────────

  it('Clients screen: skeleton clears when offline (empty cache)', async () => {
    await assertSkeletonClears(
      () => useClientsStore.getState().fetchClients(),
      () => useClientsStore.getState().isLoading,
      'Clients',
    );
  });

  it('Clients screen: skeleton clears when offline cache read throws', async () => {
    mockGetCachedClients.mockRejectedValueOnce(new Error('SQLite error'));
    await assertSkeletonClears(
      () => useClientsStore.getState().fetchClients(),
      () => useClientsStore.getState().isLoading,
      'Clients (cache-read error)',
    );
  });

  // ── Invoices ──────────────────────────────────────────────────────────────

  it('Invoices screen: skeleton clears when offline (empty cache)', async () => {
    await assertSkeletonClears(
      () => useInvoicesStore.getState().fetchInvoices(),
      () => useInvoicesStore.getState().isLoading,
      'Invoices',
    );
  });

  it('Invoices screen: skeleton clears when offline cache read throws', async () => {
    mockGetCachedInvoices.mockRejectedValueOnce(new Error('SQLite error'));
    await assertSkeletonClears(
      () => useInvoicesStore.getState().fetchInvoices(),
      () => useInvoicesStore.getState().isLoading,
      'Invoices (cache-read error)',
    );
  });

  // ── Quotes ────────────────────────────────────────────────────────────────

  it('Quotes screen: skeleton clears when offline (empty cache)', async () => {
    await assertSkeletonClears(
      () => useQuotesStore.getState().fetchQuotes(),
      () => useQuotesStore.getState().isLoading,
      'Quotes',
    );
  });

  it('Quotes screen: skeleton clears when offline cache read throws', async () => {
    mockGetCachedQuotes.mockRejectedValueOnce(new Error('SQLite error'));
    await assertSkeletonClears(
      () => useQuotesStore.getState().fetchQuotes(),
      () => useQuotesStore.getState().isLoading,
      'Quotes (cache-read error)',
    );
  });

  // ── Notifications ─────────────────────────────────────────────────────────

  /**
   * The notifications store has no offline-cache path — it hits the API
   * directly (two endpoints in series). When both fail, the catch block must
   * still call set({ isLoading: false }). This exercises that path.
   */
  it('Notifications screen: skeleton clears when both API calls fail (no network)', async () => {
    await assertSkeletonClears(
      () => useNotificationsStore.getState().fetchNotifications(),
      () => useNotificationsStore.getState().isLoading,
      'Notifications',
    );
  });

  it('Notifications screen: skeleton clears when primary API succeeds', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: { notifications: [], unreadCount: 0 },
      error: null,
    });
    await assertSkeletonClears(
      () => useNotificationsStore.getState().fetchNotifications(),
      () => useNotificationsStore.getState().isLoading,
      'Notifications (primary succeeds)',
    );
  });
});
