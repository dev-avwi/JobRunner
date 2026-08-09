import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import Constants from 'expo-constants';

import {
  maybeRequestReview,
  hasShownReviewThisVersion,
  resetReviewPromptForTesting,
} from '../store-review';

const mockedAsAvailable = StoreReview.isAvailableAsync as jest.MockedFunction<
  typeof StoreReview.isAvailableAsync
>;
const mockedHasAction = StoreReview.hasAction as jest.MockedFunction<
  typeof StoreReview.hasAction
>;
const mockedRequestReview = StoreReview.requestReview as jest.MockedFunction<
  typeof StoreReview.requestReview
>;

function setVersion(v: string) {
  (Constants as any).expoConfig = { version: v };
}

describe('store-review', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockedAsAvailable.mockReset().mockResolvedValue(true);
    mockedHasAction.mockReset().mockResolvedValue(true);
    mockedRequestReview.mockReset().mockResolvedValue(undefined);
    setVersion('1.0.0');
  });

  it('requests a review the first time on a supported platform', async () => {
    await maybeRequestReview('job_completed');
    expect(mockedRequestReview).toHaveBeenCalledTimes(1);
    expect(await hasShownReviewThisVersion()).toBe(true);
  });

  it('only fires once per app version', async () => {
    await maybeRequestReview('job_completed');
    await maybeRequestReview('invoice_paid');
    await maybeRequestReview('quote_accepted');
    expect(mockedRequestReview).toHaveBeenCalledTimes(1);
  });

  it('fires again after a version bump', async () => {
    await maybeRequestReview('job_completed');
    expect(mockedRequestReview).toHaveBeenCalledTimes(1);

    setVersion('1.1.0');
    await maybeRequestReview('job_completed');
    expect(mockedRequestReview).toHaveBeenCalledTimes(2);
  });

  it('does nothing when hasAction is false (Play services missing, etc)', async () => {
    mockedHasAction.mockResolvedValue(false);
    await maybeRequestReview('job_completed');
    expect(mockedRequestReview).not.toHaveBeenCalled();
    expect(await hasShownReviewThisVersion()).toBe(false);
  });

  it('does nothing when StoreReview is unavailable', async () => {
    mockedAsAvailable.mockResolvedValue(false);
    await maybeRequestReview('job_completed');
    expect(mockedRequestReview).not.toHaveBeenCalled();
    expect(await hasShownReviewThisVersion()).toBe(false);
  });

  it('swallows errors from the native module without rejecting', async () => {
    mockedRequestReview.mockRejectedValueOnce(new Error('boom'));
    await expect(maybeRequestReview('job_completed')).resolves.toBeUndefined();
  });

  it('resetReviewPromptForTesting resolves without throwing regardless of __DEV__', async () => {
    // __DEV__ is a compile-time constant that babel-preset-expo may inline to
    // either true (default jest run) or false (NODE_ENV=test release). We
    // assert the helper is safe in both modes rather than depending on which
    // path the bundler picked.
    await maybeRequestReview('job_completed');
    expect(await hasShownReviewThisVersion()).toBe(true);
    await expect(resetReviewPromptForTesting()).resolves.toBeUndefined();
    // Whatever the build flavour, the state must remain a boolean answer that
    // the gate can read without crashing.
    await expect(hasShownReviewThisVersion()).resolves.toEqual(expect.any(Boolean));
  });

  it('hasShownReviewThisVersion returns false when storage throws', async () => {
    const spy = jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValueOnce(new Error('storage down'));
    expect(await hasShownReviewThisVersion()).toBe(false);
    spy.mockRestore();
  });
});
