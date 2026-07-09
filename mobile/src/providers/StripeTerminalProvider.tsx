/**
 * Stripe Terminal Provider for Tap to Pay
 * 
 * This wrapper component provides Stripe Terminal SDK context to the app.
 * Tap to Pay enables NFC contactless payments directly on the phone.
 * 
 * REQUIREMENTS:
 * 1. Native build required (not Expo Go) - run `eas build`
 * 2. Apple Developer Program for iOS Tap to Pay
 * 3. Stripe account with Terminal enabled
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useAuthStore } from '../lib/store';
import api from '../lib/api';

// The actual SDK is only available in native builds
// In Expo Go, we provide a fallback implementation
let StripeTerminalProviderSDK: any = null;
let useStripeTerminalSDK: any = null;

// Apple Tap to Pay entitlement granted (Case-ID 20927765) — enabled in all builds.
const TAP_TO_PAY_ENABLED = true;

// Try to import the real SDK - will fail in Expo Go
try {
  if (TAP_TO_PAY_ENABLED) {
    const sdk = require('@stripe/stripe-terminal-react-native');
    StripeTerminalProviderSDK = sdk.StripeTerminalProvider;
    useStripeTerminalSDK = sdk.useStripeTerminal;
  }
} catch (e) {
  if (__DEV__) console.log('[StripeTerminal] SDK not available - using fallback mode');
}

// Check if SDK is available (native build)
export const isStripeTerminalSDKAvailable = (): boolean => {
  return StripeTerminalProviderSDK !== null;
};

// Tracks whether the real <StripeTerminalProviderSDK> is actually mounted.
// The provider only mounts once the user is authenticated AND Stripe Connect
// is ready, so hooks must NOT call the SDK before this flips true — doing so
// throws "StripeTerminalProvider component is not found".
let providerMounted = false;
const mountListeners = new Set<() => void>();
function setTerminalProviderMounted(value: boolean) {
  if (providerMounted !== value) {
    providerMounted = value;
    mountListeners.forEach((l) => l());
  }
}
export function isTerminalProviderMounted(): boolean {
  return providerMounted;
}
export function subscribeTerminalProviderMounted(listener: () => void): () => void {
  mountListeners.add(listener);
  return () => { mountListeners.delete(listener); };
}

// Check if Tap to Pay is supported on this device
export const isTapToPaySupported = (): boolean => {
  if (!isStripeTerminalSDKAvailable()) {
    return false;
  }
  
  if (Platform.OS === 'ios') {
    const version = parseFloat(Platform.Version as string);
    return version >= 17.6;
  }
  
  if (Platform.OS === 'android') {
    // Android with NFC support
    return Platform.Version >= 26;
  }
  
  return false;
};

interface TerminalProviderProps {
  children: React.ReactNode;
}

/**
 * Stripe Terminal Provider Component
 * Wraps the app with Stripe Terminal context when SDK is available
 */
export function TerminalProvider({ children }: TerminalProviderProps) {
  const { isAuthenticated, user } = useAuthStore();
  const [isReady, setIsReady] = useState(false);
  // Tri-state Connect readiness for the token provider: 'unknown' while the
  // status check is in flight (don't block real users at boot), then
  // 'ready' / 'not_ready'. Kept in a ref so fetchTokenProvider (stable
  // callback handed to the SDK) always sees the latest value.
  const connectReadyRef = useRef<'unknown' | 'ready' | 'not_ready'>('unknown');

  // Fetch connection token from backend
  const fetchTokenProvider = useCallback(async (): Promise<string> => {
    // The SDK provider is mounted from boot (stable tree — see render below),
    // so it may ask for a token before login. Fail quietly; it retries when
    // a payment flow actually initializes the terminal.
    if (!useAuthStore.getState().isAuthenticated) {
      throw new Error('Not authenticated yet');
    }
    // Known-not-ready: skip the doomed API call (400 "Connect not set up").
    // 'unknown' falls through so a Connect-ready user isn't blocked by the
    // status check still being in flight at boot.
    if (connectReadyRef.current === 'not_ready') {
      throw new Error('Stripe Connect not set up');
    }
    try {
      let response = await api.post<{ secret: string }>('/api/stripe/terminal-connection-token');

      // The server applies backpressure (429 + Retry-After) under load.
      // POSTs aren't auto-retried by the api client, but the token fetch is
      // idempotent and cheap — wait out the Retry-After and try again (2x)
      // so a transient 429 doesn't kill Terminal initialization.
      let retries = 0;
      while ((response as any)?.backpressure?.code === 'BACKPRESSURE' && retries < 2) {
        const waitSec = Math.min(15, Math.max(1, (response as any).backpressure.retryAfterSec || 5));
        if (__DEV__) console.log(`[StripeTerminal] Token fetch backpressure, retrying in ${waitSec}s`);
        await new Promise((r) => setTimeout(r, waitSec * 1000 + Math.floor(Math.random() * 500)));
        response = await api.post<{ secret: string }>('/api/stripe/terminal-connection-token');
        retries++;
      }

      if (response.error || !response.data?.secret) {
        throw new Error(response.error || 'Failed to fetch connection token');
      }
      
      return response.data.secret;
    } catch (error) {
      // warn (not error) so a missing Stripe Connect setup doesn't spam
      // full-screen red LogBox errors in dev builds.
      if (__DEV__) console.warn('[StripeTerminal] Connection token fetch failed:', error);
      throw error;
    }
  }, []);

  useEffect(() => {
    // Check whether this business has Stripe Connect set up. This does NOT
    // gate rendering (the SDK provider stays mounted for a stable tree) —
    // it only drives providerMounted (real-SDK-usable flag for hooks) and
    // the token-provider short-circuit above.
    let cancelled = false;
    if (!isAuthenticated || !user) {
      connectReadyRef.current = 'unknown';
      setIsReady(false);
      return;
    }
    (async () => {
      try {
        const res = await api.get<{ connected: boolean; chargesEnabled?: boolean }>('/api/stripe-connect/status');
        const ok = !res.error && !!res.data?.connected && res.data?.chargesEnabled !== false;
        if (!cancelled) {
          connectReadyRef.current = ok ? 'ready' : 'not_ready';
          setIsReady(ok);
          if (__DEV__ && !ok) console.log('[StripeTerminal] Stripe Connect not ready — hooks use simulator fallback');
        }
      } catch (e) {
        if (!cancelled) {
          // Status check failed (network etc) — leave 'unknown' so a real
          // payment attempt can still try fetching a token.
          connectReadyRef.current = 'unknown';
          setIsReady(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, user]);

  // Publish "real SDK usable" (NOT literal mount state — the SDK provider is
  // always mounted when available). Hooks (useStripeTerminal) use this to
  // pick the real SDK vs the simulator fallback.
  useEffect(() => {
    setTerminalProviderMounted(!!StripeTerminalProviderSDK && isReady);
    return () => setTerminalProviderMounted(false);
  }, [isReady]);

  // If SDK is not available (Expo Go), just render children
  if (!StripeTerminalProviderSDK) {
    if (__DEV__) console.log('[StripeTerminal] Running in fallback mode (Expo Go)');
    return <>{children}</>;
  }

  // IMPORTANT: when the SDK is available, ALWAYS render the SDK provider —
  // never conditionally swap between <>{children}</> and the provider based
  // on auth/Connect state. Changing the wrapper element type mid-session
  // remounts the ENTIRE children subtree (including the Expo Router <Stack>),
  // which resets navigation and dumps the user back to the start screen.
  // Gating is done instead via: (a) fetchTokenProvider failing quietly when
  // not authenticated, and (b) providerMounted (published above) staying
  // false until Stripe Connect is ready, so hooks use the simulator fallback.
  return (
    <StripeTerminalProviderSDK
      logLevel="verbose"
      tokenProvider={fetchTokenProvider}
    >
      {children}
    </StripeTerminalProviderSDK>
  );
}

export default TerminalProvider;
