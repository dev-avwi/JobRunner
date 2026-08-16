/**
 * OwnerOnlyGuard deep-link guard tests
 *
 * Verifies that a staff_tradie (or any non-owner/non-manager) who deep-links to a
 * restricted screen is:
 *   1. Never shown owner-only content (no data flash).
 *   2. Redirected to /jobs via router.replace.
 *   3. Shown a permission-denied toast.
 *
 * Also verifies that owners and managers are let through without a redirect.
 *
 * These tests cover the guard logic shared by all 17 restricted screens:
 *   mobile/app/more/insights.tsx
 *   mobile/app/more/reports.tsx
 *   mobile/app/more/autopilot.tsx
 *   mobile/app/more/team-management.tsx
 *   mobile/app/more/clients.tsx
 *   mobile/app/more/documents.tsx
 *   mobile/app/more/payment-hub.tsx
 *   mobile/app/more/expenses.tsx
 *   mobile/app/more/collect-payment.tsx
 *   mobile/app/more/inventory.tsx
 *   mobile/app/more/communications.tsx
 *   mobile/app/more/leads.tsx
 *   mobile/app/more/ai-receptionist.tsx
 *   mobile/app/more/integrations.tsx
 *   mobile/app/more/branding.tsx
 *   mobile/app/more/custom-website.tsx
 *   mobile/app/more/subscription.tsx
 */

import React from 'react';
import { View } from 'react-native';
import { act, create, ReactTestRenderer, ReactTestInstance } from 'react-test-renderer';

// ---- expo-router mock -------------------------------------------------------
const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...args: any[]) => mockRouterReplace(...args) },
}));

// ---- useUserRole mock -------------------------------------------------------
let mockRoleState = {
  isOwner: false,
  isManager: false,
  isLoading: false,
};
jest.mock('../../../hooks/use-user-role', () => ({
  useUserRole: () => mockRoleState,
}));

// ---- toast mock -------------------------------------------------------------
const mockShowToast = jest.fn();
jest.mock('../../../lib/toast', () => ({
  showToast: (...args: any[]) => mockShowToast(...args),
}));

// ---- theme mock -------------------------------------------------------------
jest.mock('../../../lib/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      primary: '#2563eb',
    },
  }),
}));

// ---- component under test ---------------------------------------------------
import { OwnerOnlyGuard } from '../OwnerOnlyGuard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SENTINEL_TEST_ID = 'restricted-screen-content';

/** JSX that wraps a sentinel View in the guard. Re-used across update() calls. */
function makeGuardTree(redirectTo?: string): React.ReactElement {
  const sentinel = <View testID={SENTINEL_TEST_ID} />;
  return redirectTo ? (
    <OwnerOnlyGuard redirectTo={redirectTo}>{sentinel}</OwnerOnlyGuard>
  ) : (
    <OwnerOnlyGuard>{sentinel}</OwnerOnlyGuard>
  );
}

async function renderGuardWithContent(redirectTo?: string): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(makeGuardTree(redirectTo));
  });
  // Flush any microtask-queued effects (useEffect).
  await act(async () => {
    await Promise.resolve();
  });
  return tree;
}

const findByTestID = (tree: ReactTestRenderer, testID: string): ReactTestInstance[] =>
  tree.root.findAll((n: ReactTestInstance) => n.props?.testID === testID);

const hasTestID = (tree: ReactTestRenderer, testID: string): boolean =>
  findByTestID(tree, testID).length > 0;

/** Returns true when the tree contains an ActivityIndicator native host node. */
const hasSpinner = (tree: ReactTestRenderer): boolean =>
  tree.root.findAll((n: ReactTestInstance) => n.type === 'ActivityIndicator').length > 0;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OwnerOnlyGuard – staff user deep-link guard', () => {
  beforeEach(() => {
    mockRouterReplace.mockReset();
    mockShowToast.mockReset();
  });

  // -- Loading state ----------------------------------------------------------

  it('shows a spinner (not restricted content) while the role is still loading', async () => {
    mockRoleState = { isOwner: false, isManager: false, isLoading: true };

    const tree = await renderGuardWithContent();

    // The spinner placeholder must be present.
    expect(hasSpinner(tree)).toBe(true);

    // Restricted content must NOT be visible.
    expect(hasTestID(tree, SENTINEL_TEST_ID)).toBe(false);

    // No redirect while loading.
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  // -- Staff / worker role (simulates staff_tradie) ---------------------------

  it('redirects a staff user to /jobs and shows a toast – no restricted content flash', async () => {
    mockRoleState = { isOwner: false, isManager: false, isLoading: false };

    const tree = await renderGuardWithContent();

    // Restricted content must never have been rendered.
    expect(hasTestID(tree, SENTINEL_TEST_ID)).toBe(false);

    // Guard must have redirected to the Jobs tab.
    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).toHaveBeenCalledWith('/jobs');

    // Permission-denied toast must have been shown.
    expect(mockShowToast).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
  });

  it('does not trigger a second redirect if the component re-renders while still denied', async () => {
    mockRoleState = { isOwner: false, isManager: false, isLoading: false };

    const tree = await renderGuardWithContent();

    // Force a re-render (e.g. parent state update).
    await act(async () => {
      tree.update(makeGuardTree());
      await Promise.resolve();
    });

    // router.replace must only have been called once (redirectedRef guard).
    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledTimes(1);
  });

  it('redirects to a custom `redirectTo` path when provided', async () => {
    mockRoleState = { isOwner: false, isManager: false, isLoading: false };

    const tree = await renderGuardWithContent('/more');

    expect(mockRouterReplace).toHaveBeenCalledWith('/more');
    expect(hasTestID(tree, SENTINEL_TEST_ID)).toBe(false);
  });

  // -- Simulates all restricted More screens (original 4 + 13 added in Task #645) --

  const RESTRICTED_PATHS = [
    // Original four
    '/more/insights',
    '/more/reports',
    '/more/autopilot',
    '/more/team-management',
    // 13 screens guarded in Task #645
    '/more/clients',
    '/more/documents',
    '/more/payment-hub',
    '/more/expenses',
    '/more/collect-payment',
    '/more/inventory',
    '/more/communications',
    '/more/leads',
    '/more/ai-receptionist',
    '/more/integrations',
    '/more/branding',
    '/more/custom-website',
    '/more/subscription',
  ];

  it.each(RESTRICTED_PATHS)(
    'blocks a staff user who deep-links to %s and shows no screen data',
    async (path) => {
      mockRoleState = { isOwner: false, isManager: false, isLoading: false };
      mockRouterReplace.mockReset();
      mockShowToast.mockReset();

      const screenTestID = `screen-data-${path}`;
      let tree!: ReactTestRenderer;
      await act(async () => {
        tree = create(
          // Each screen renders <OwnerOnlyGuard> then its content.
          // We test the guard with a labelled sentinel child to confirm
          // no screen-specific data is ever rendered.
          <OwnerOnlyGuard>
            <View testID={screenTestID} />
          </OwnerOnlyGuard>,
        );
      });
      await act(async () => { await Promise.resolve(); });

      // No screen data rendered.
      expect(tree.root.findAll((n: ReactTestInstance) => n.props?.testID === screenTestID).length).toBe(0);

      // Redirected to Jobs tab, not the restricted screen.
      expect(mockRouterReplace).toHaveBeenCalledTimes(1);
      expect(mockRouterReplace).toHaveBeenCalledWith('/jobs');

      // Toast shown.
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    },
  );

  // -- Owner role ------------------------------------------------------------

  it('renders restricted content for an owner without redirecting', async () => {
    mockRoleState = { isOwner: true, isManager: false, isLoading: false };

    const tree = await renderGuardWithContent();

    // Content must be visible.
    expect(hasTestID(tree, SENTINEL_TEST_ID)).toBe(true);

    // No redirect or toast.
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  // -- Manager role ----------------------------------------------------------

  it('renders restricted content for a manager without redirecting', async () => {
    mockRoleState = { isOwner: false, isManager: true, isLoading: false };

    const tree = await renderGuardWithContent();

    expect(hasTestID(tree, SENTINEL_TEST_ID)).toBe(true);
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  // -- Loading → staff transition (cold role cache) --------------------------

  it('redirects after role resolves from loading to staff (cold cache scenario)', async () => {
    // Start with role still loading (cold cache).
    mockRoleState = { isOwner: false, isManager: false, isLoading: true };

    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(makeGuardTree());
    });

    // During loading: no content, no redirect yet.
    expect(hasTestID(tree, SENTINEL_TEST_ID)).toBe(false);
    expect(mockRouterReplace).not.toHaveBeenCalled();

    // Role resolves to staff.
    mockRoleState = { isOwner: false, isManager: false, isLoading: false };
    await act(async () => {
      tree.update(makeGuardTree());
      await Promise.resolve();
    });

    // Now the redirect must fire.
    expect(mockRouterReplace).toHaveBeenCalledWith('/jobs');
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
    // Content still never rendered.
    expect(hasTestID(tree, SENTINEL_TEST_ID)).toBe(false);
  });

  // -- Loading → owner transition (cold cache, should NOT redirect) ----------

  it('shows content once role resolves from loading to owner (no redirect)', async () => {
    mockRoleState = { isOwner: false, isManager: false, isLoading: true };

    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(makeGuardTree());
    });

    expect(hasTestID(tree, SENTINEL_TEST_ID)).toBe(false);

    // Role resolves to owner.
    mockRoleState = { isOwner: true, isManager: false, isLoading: false };
    await act(async () => {
      tree.update(makeGuardTree());
      await Promise.resolve();
    });

    expect(hasTestID(tree, SENTINEL_TEST_ID)).toBe(true);
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalled();
  });
});
