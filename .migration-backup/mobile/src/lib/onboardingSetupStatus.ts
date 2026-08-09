import AsyncStorage from '@react-native-async-storage/async-storage';

// Records whether the background seed/complete step of the owner magic setup
// screen failed, so the dashboard can surface a non-blocking, retryable message
// after the owner lands in the app. Keyed per-user so a shared device doesn't
// leak one owner's failure state onto another account.
const KEY_PREFIX = 'jobrunner.onboarding-setup-failed.v1';
const keyFor = (userId?: string | null) => `${KEY_PREFIX}.${userId ?? 'anon'}`;

export interface OnboardingSetupFailure {
  seedFailed: boolean;
  completeFailed: boolean;
}

export async function markOnboardingSetupFailed(
  userId: string | null | undefined,
  failure: OnboardingSetupFailure,
): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(failure));
  } catch {}
}

export async function getOnboardingSetupFailure(
  userId: string | null | undefined,
): Promise<OnboardingSetupFailure | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        seedFailed: !!parsed.seedFailed,
        completeFailed: !!parsed.completeFailed,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearOnboardingSetupFailure(
  userId: string | null | undefined,
): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId));
  } catch {}
}
