/**
 * Task: verify the dashboard retry banner for failed background onboarding
 * setup (the owner "Finish" magic-screen path fires seed/complete without
 * awaiting; failures are persisted via markOnboardingSetupFailed so the
 * dashboard can offer a non-blocking retry).
 *
 * Covers:
 *  1. Simulated /api/onboarding/complete failure on the magic-screen path
 *     (i.e. a persisted { completeFailed: true } marker) renders the banner.
 *  2. Retrying from the banner re-posts /api/onboarding/complete, and on
 *     success clears the failure marker + hides the banner.
 *  3. Retry failure keeps the marker + banner (still recoverable).
 *  4. Seed-only failure retries /api/onboarding/seed-demo-data.
 */
import React from 'react';
import { act, create, ReactTestRenderer, ReactTestInstance } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ---- mocks --------------------------------------------------------------
const mockPost = jest.fn();
jest.mock('../../../lib/api', () => ({
  api: { post: (...args: any[]) => mockPost(...args) },
}));

const mockShowToast = jest.fn();
jest.mock('../../../lib/toast', () => ({
  showToast: (...args: any[]) => mockShowToast(...args),
}));

const mockFetchBusinessSettings = jest.fn().mockResolvedValue(undefined);
let mockOnboardingCompleted = false;
jest.mock('../../../lib/store', () => ({
  useAuthStore: (selector: any) =>
    selector({
      user: { id: 'user-1' },
      fetchBusinessSettings: mockFetchBusinessSettings,
      businessSettings: { onboardingCompleted: mockOnboardingCompleted },
    }),
}));

jest.mock('../../../lib/theme', () => ({
  useTheme: () => ({
    colors: {
      destructive: '#dc2626',
      destructiveForeground: '#ffffff',
      foreground: '#111111',
      mutedForeground: '#666666',
    },
  }),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

import { OnboardingSetupFailedBanner } from '../OnboardingSetupFailedBanner';
import {
  markOnboardingSetupFailed,
  getOnboardingSetupFailure,
} from '../../../lib/onboardingSetupStatus';

const USER = 'user-1';

async function renderBanner(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<OnboardingSetupFailedBanner />);
  });
  // let the async AsyncStorage read resolve
  await act(async () => {
    await Promise.resolve();
  });
  return tree;
}

const findByTestID = (tree: ReactTestRenderer, testID: string) =>
  tree.root.findAll((n: ReactTestInstance) => n.props?.testID === testID);

// The same testID appears on nested composite+host nodes; presence is what we
// assert, and the outermost composite node carries the onPress prop.
const hasTestID = (tree: ReactTestRenderer, testID: string) =>
  findByTestID(tree, testID).length > 0;

describe('OnboardingSetupFailedBanner', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockPost.mockReset();
    mockShowToast.mockReset();
    mockOnboardingCompleted = false;
  });

  it('renders nothing when no failure marker exists', async () => {
    const tree = await renderBanner();
    expect(hasTestID(tree, 'banner-retry-setup')).toBe(false);
  });

  it('shows the retry banner after a simulated /api/onboarding/complete failure', async () => {
    // Simulates markOnboardingComplete() on the magic-screen path recording
    // the failed completion (setup.tsx does exactly this on error).
    await markOnboardingSetupFailed(USER, { seedFailed: false, completeFailed: true });

    const tree = await renderBanner();
    expect(hasTestID(tree, 'banner-retry-setup')).toBe(true);
  });

  it('retry success completes onboarding and clears the failure marker', async () => {
    await markOnboardingSetupFailed(USER, { seedFailed: false, completeFailed: true });
    mockPost.mockResolvedValue({ data: { success: true } });

    const tree = await renderBanner();
    const [retryBtn] = findByTestID(tree, 'banner-retry-setup');
    await act(async () => {
      await retryBtn.props.onPress();
    });

    expect(mockPost).toHaveBeenCalledWith('/api/onboarding/complete', {});
    expect(mockFetchBusinessSettings).toHaveBeenCalled();
    expect(await getOnboardingSetupFailure(USER)).toBeNull();
    expect(hasTestID(tree, 'banner-retry-setup')).toBe(false);
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success' })
    );
  });

  it('retry failure keeps the marker and the banner for another attempt', async () => {
    await markOnboardingSetupFailed(USER, { seedFailed: false, completeFailed: true });
    mockPost.mockResolvedValue({ error: 'offline', isOffline: true });

    const tree = await renderBanner();
    const [retryBtn] = findByTestID(tree, 'banner-retry-setup');
    await act(async () => {
      await retryBtn.props.onPress();
    });

    expect(await getOnboardingSetupFailure(USER)).toEqual({
      seedFailed: false,
      completeFailed: true,
    });
    expect(hasTestID(tree, 'banner-retry-setup')).toBe(true);
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    );
  });

  it('seed-only failure retries seed-demo-data and clears on success', async () => {
    await markOnboardingSetupFailed(USER, { seedFailed: true, completeFailed: false });
    mockPost.mockResolvedValue({ data: { success: true } });

    const tree = await renderBanner();
    const [retryBtn] = findByTestID(tree, 'banner-retry-setup');
    await act(async () => {
      await retryBtn.props.onPress();
    });

    expect(mockPost).toHaveBeenCalledWith('/api/onboarding/seed-demo-data', {});
    expect(mockPost).not.toHaveBeenCalledWith('/api/onboarding/complete', {});
    expect(await getOnboardingSetupFailure(USER)).toBeNull();
    expect(hasTestID(tree, 'banner-retry-setup')).toBe(false);
  });

  it('self-heals a stale completeFailed flag once onboarding is actually complete', async () => {
    mockOnboardingCompleted = true;
    await markOnboardingSetupFailed(USER, { seedFailed: false, completeFailed: true });

    const tree = await renderBanner();
    expect(hasTestID(tree, 'banner-retry-setup')).toBe(false);
    expect(await getOnboardingSetupFailure(USER)).toBeNull();
  });

  it('dismiss clears the marker without retrying', async () => {
    await markOnboardingSetupFailed(USER, { seedFailed: false, completeFailed: true });

    const tree = await renderBanner();
    const [dismissBtn] = findByTestID(tree, 'banner-dismiss-setup-failed');
    await act(async () => {
      await dismissBtn.props.onPress();
    });

    expect(mockPost).not.toHaveBeenCalled();
    expect(await getOnboardingSetupFailure(USER)).toBeNull();
    expect(hasTestID(tree, 'banner-retry-setup')).toBe(false);
  });
});
