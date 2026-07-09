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

import { useCallback, useEffect, useState } from 'react';
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

  // Fetch connection token from backend
  const fetchTokenProvider = useCallback(async (): Promise<string> => {
    try {
      const response = await api.post<{ secret: string }>('/api/stripe/terminal-connection-token');
      
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
    // Only initialize the Terminal SDK when the user is authenticated AND
    // their business actually has Stripe Connect set up. Mounting the SDK
    // without it makes the SDK immediately call the token provider, which is
    // guaranteed to fail (400 "Stripe Connect account not set up") and spams
    // console errors on every launch.
    let cancelled = false;
    if (!isAuthenticated || !user) {
      setIsReady(false);
      return;
    }
    (async () => {
      try {
        const res = await api.get<{ connected: boolean; chargesEnabled?: boolean }>('/api/stripe-connect/status');
        const ok = !res.error && !!res.data?.connected && res.data?.chargesEnabled !== false;
        if (!cancelled) {
          setIsReady(ok);
          if (__DEV__ && !ok) console.log('[StripeTerminal] Skipping Terminal init — Stripe Connect not ready');
        }
      } catch (e) {
        if (!cancelled) setIsReady(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, user]);

  // Publish the actual mount state of the SDK provider so hooks elsewhere
  // (useStripeTerminal) know whether SDK calls are safe or they should use
  // the simulator fallback.
  useEffect(() => {
    setTerminalProviderMounted(!!StripeTerminalProviderSDK && isReady);
    return () => setTerminalProviderMounted(false);
  }, [isReady]);

  // If SDK is not available (Expo Go), just render children
  if (!StripeTerminalProviderSDK) {
    if (__DEV__) console.log('[StripeTerminal] Running in fallback mode (Expo Go)');
    return <>{children}</>;
  }

  // If not authenticated, don't initialize Terminal
  if (!isReady) {
    return <>{children}</>;
  }

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
