import { Alert } from 'react-native';
import { router } from 'expo-router';

/**
 * Business SMS requires the business's own dedicated number. The server
 * returns 402 with code DEDICATED_NUMBER_REQUIRED from every SMS send path
 * when no number is configured. These helpers turn that raw error into a
 * friendly "get your business number" prompt that deep-links to the
 * Phone Numbers purchase screen.
 */

type ApiErrorLike = {
  error?: string;
  data?: unknown;
};

export function isDedicatedNumberError(response: ApiErrorLike | null | undefined): boolean {
  if (!response?.error) return false;
  const code = (response.data as { code?: string } | undefined)?.code;
  if (code === 'DEDICATED_NUMBER_REQUIRED') return true;
  // Fallback: persisted-failed sends surface the smsService error string.
  return /dedicated (phone )?number/i.test(response.error);
}

export function showGetNumberPrompt() {
  Alert.alert(
    'Get your business number',
    'To send SMS to clients, your business needs its own dedicated phone number. Set one up in a minute — your clients will see texts from your business.',
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Get a number',
        onPress: () => router.push('/more/phone-numbers' as any),
      },
    ]
  );
}

/**
 * Returns true (and shows the prompt) when the failed SMS response was caused
 * by the missing dedicated number; callers should skip their generic error
 * handling in that case.
 */
export function handleDedicatedNumberError(response: ApiErrorLike | null | undefined): boolean {
  if (isDedicatedNumberError(response)) {
    showGetNumberPrompt();
    return true;
  }
  return false;
}

/**
 * Status-change routes (worker-status, assignment status) keep the status
 * update SUCCESSFUL when the client SMS could not be sent, returning 200 with
 * `smsFailed: true` and `smsErrorCode: 'DEDICATED_NUMBER_REQUIRED'` instead of
 * failing the transition. Call this on every successful status-change response:
 * it shows the "get your business number" prompt (non-blocking — the status
 * change stays applied) and returns true when the SMS was skipped for that
 * reason.
 */
export function handleStatusSmsOutcome(data: unknown): boolean {
  const d = data as { smsFailed?: boolean; smsErrorCode?: string } | null | undefined;
  if (d?.smsErrorCode === 'DEDICATED_NUMBER_REQUIRED') {
    showGetNumberPrompt();
    return true;
  }
  return false;
}
