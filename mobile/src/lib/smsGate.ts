import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';

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

/** True when a persisted failure reason string is the "no dedicated number" reason. */
export function isDedicatedNumberReason(reason?: string | null): boolean {
  if (!reason) return false;
  return /dedicated (phone )?number/i.test(reason) || /no business phone number/i.test(reason);
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

/**
 * Show the standard "No Business Number Set Up" gate alert.
 * Always offers "Set Up Number" → /more/phone-numbers.
 * Pass an optional `fallback` button (e.g. "Call Instead", "Open Notes")
 * that appears between Cancel and Set Up Number.
 */
export function showSmsLockedAlert(fallback?: { label: string; onPress: () => void }) {
  const buttons: Array<{ text: string; style?: 'cancel' | 'default' | 'destructive'; onPress?: () => void }> = [
    { text: 'Cancel', style: 'cancel' },
  ];
  if (fallback) {
    buttons.push({ text: fallback.label, onPress: fallback.onPress });
  }
  buttons.push({
    text: 'Set Up Number',
    onPress: () => router.push('/more/phone-numbers' as any),
  });
  Alert.alert(
    'No Business Number Set Up',
    'To send SMS to clients, your business needs a dedicated phone number. Set one up in a minute — clients will see messages from your business number.',
    buttons
  );
}

// Module-level cache so repeated hook uses share one fetch per minute.
// An in-flight promise is shared so simultaneous hook mounts never fire
// more than one network request even if the cache hasn't settled yet.
let _smsLockedCache: boolean | null = null;
let _smsLockedFetchedAt = 0;
let _smsLockedInFlight: Promise<boolean> | null = null;
const SMS_LOCKED_CACHE_TTL_MS = 60_000;

async function _fetchSmsLocked(): Promise<boolean> {
  const now = Date.now();
  if (_smsLockedCache !== null && now - _smsLockedFetchedAt < SMS_LOCKED_CACHE_TTL_MS) {
    return _smsLockedCache;
  }
  // Share the in-flight request across concurrent callers.
  if (_smsLockedInFlight) return _smsLockedInFlight;
  _smsLockedInFlight = (async () => {
    try {
      const { default: api } = await import('./api');
      const res = await api.get<{
        enabled?: boolean;
        hasDedicatedNumber?: boolean;
        hasPhoneNumber?: boolean;
        phoneNumber?: string | null;
      }>('/api/sms/status');
      const d = res.data;
      const connected =
        d?.hasDedicatedNumber === true ||
        (!!d?.phoneNumber && d?.hasPhoneNumber === true);
      _smsLockedCache = !!d && !connected;
      _smsLockedFetchedAt = Date.now();
      return _smsLockedCache;
    } catch {
      // Fail-open: don't block SMS actions when the network is unavailable.
      return false;
    } finally {
      _smsLockedInFlight = null;
    }
  })();
  return _smsLockedInFlight;
}

/**
 * Hook that returns `true` when no dedicated business number is configured.
 * Uses a module-level 1-minute cache so multiple components on the same screen
 * share a single API call.
 */
export function useSmsLocked(): boolean {
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    _fetchSmsLocked().then(setLocked);
  }, []);
  return locked;
}
