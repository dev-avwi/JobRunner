/**
 * React hooks for native services
 * 
 * Provides easy access to:
 * - Stripe Terminal (Tap to Pay)
 * - Push Notifications
 * - Offline Storage
 * - Location Tracking
 */

import { useEffect, useState, useCallback, useRef, useSyncExternalStore } from 'react';
import { Alert, Platform } from 'react-native';
import * as Device from 'expo-device';
import { 
  terminalSimulator, 
  isSDKAvailable, 
  isTapToPayAvailable,
  isSimulationMode,
  isOsVersionNotSupported,
  OS_VERSION_NOT_SUPPORTED_MESSAGE,
  requestAndroidPermissions,
  TerminalStatus, 
  Reader, 
  PaymentIntent 
} from '../lib/stripe-terminal';
import notificationService, { NotificationPayload } from '../lib/notifications';
import offlineStorage, { useOfflineStore, CachedJob, CachedClient, CachedQuote, CachedInvoice } from '../lib/offline-storage';
import locationTracking, { TrackingStatus, LocationUpdate, GeofenceEvent } from '../lib/location-tracking';
import { useAuthStore } from '../lib/store';
import {
  isStripeTerminalSDKAvailable,
  isTerminalProviderMounted,
  subscribeTerminalProviderMounted,
} from '../providers/StripeTerminalProvider';
import api from '../lib/api';

let useStripeTerminalSDK: any = null;
// Apple Tap to Pay entitlement granted (Case-ID 20927765) — enabled in all builds.
const TAP_TO_PAY_ENABLED = true;
try {
  if (TAP_TO_PAY_ENABLED) {
    const sdk = require('@stripe/stripe-terminal-react-native');
    useStripeTerminalSDK = sdk.useStripeTerminal;
    if (__DEV__) console.log('[useStripeTerminal] SDK hook loaded successfully');
  }
} catch (e) {
  if (__DEV__) console.log('[useStripeTerminal] SDK not available - using simulation mode');
}

/**
 * Hook for Stripe Terminal (Tap to Pay)
 * Uses real SDK in native builds, simulator in Expo Go
 */
export function useStripeTerminal() {
  const [status, setStatus] = useState<TerminalStatus>('not_initialized');
  const [reader, setReader] = useState<Reader | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const locationIdRef = useRef<string | null>(null);
  // Readers reported by the SDK's discovery event. Kept in a ref because
  // reading `sdkHook.discoveredReaders` inside connectReader sees a stale
  // closure snapshot from render time (always []) — the hook state updates
  // on re-render, but the captured object never does.
  const discoveredReadersRef = useRef<any[]>([]);
  // Holds the in-flight connectReader promise — concurrent calls share it.
  const connectInFlightRef = useRef<Promise<Reader | null> | null>(null);

  // Auth gate: the real StripeTerminalProvider only mounts the SDK provider
  // once the user is authenticated (see StripeTerminalProvider.tsx). Before
  // that, the SDK hook returns a context with no provider behind it and
  // `initialize()` throws "...provider is not found...". We always call the
  // SDK hook (to keep React hook ordering stable) but treat it as a no-op
  // until the provider is ready.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  // The real SDK provider only mounts once Stripe Connect is ready (see
  // StripeTerminalProvider.tsx). Track its ACTUAL mount state — calling the
  // SDK without it throws "StripeTerminalProvider component is not found".
  // When not mounted (demo account / no Stripe Connect), we fall back to the
  // simulator, which still creates real server-side payment intents.
  const providerMounted = useSyncExternalStore(
    subscribeTerminalProviderMounted,
    isTerminalProviderMounted,
  );
  const providerReady = isStripeTerminalSDKAvailable() && isAuthenticated && !!user && providerMounted;
  const onUpdateDiscoveredReaders = useCallback((readers: any[]) => {
    discoveredReadersRef.current = readers ?? [];
  }, []);
  let sdkHookValue: any = null;
  if (useStripeTerminalSDK) {
    try {
      sdkHookValue = useStripeTerminalSDK({ onUpdateDiscoveredReaders });
    } catch {
      sdkHookValue = null;
    }
  }
  const sdkHook = providerReady ? sdkHookValue : null;

  // Reset terminal state whenever we switch between the simulator and the
  // real SDK (e.g. Stripe Connect finishes loading after a simulator init).
  const prevProviderReady = useRef(providerReady);
  useEffect(() => {
    if (prevProviderReady.current !== providerReady) {
      prevProviderReady.current = providerReady;
      setIsInitialized(false);
      setStatus('not_initialized');
      setReader(null);
      setError(null);
    }
  }, [providerReady]);

  // Setup simulator status listener
  useEffect(() => {
    if (!sdkHook) {
      terminalSimulator.onStatusChange(setStatus);
    }
  }, [sdkHook]);

  // Initialize Terminal (SDK or simulator)
  const initialize = useCallback(async (): Promise<boolean> => {
    try {
      if (!TAP_TO_PAY_ENABLED) {
        setError('Tap to Pay is temporarily unavailable pending Apple approval.');
        setStatus('error');
        return false;
      }

      // If the SDK is loaded but the StripeTerminalProvider isn't mounted
      // (not authenticated yet, or the business has no Stripe Connect —
      // e.g. the demo account), sdkHook is null and we fall through to the
      // simulator path below instead of calling the unmounted SDK.
      setError(null);
      setStatus('initializing');

      // Check for iOS version compatibility (Apple Requirement 1.3)
      if (isOsVersionNotSupported()) {
        setError(OS_VERSION_NOT_SUPPORTED_MESSAGE);
        setStatus('error');
        return false;
      }

      // Request Android permissions first
      if (Platform.OS === 'android') {
        const granted = await requestAndroidPermissions();
        if (!granted) {
          setError('Location permission required for Tap to Pay');
          setStatus('error');
          return false;
        }
      }

      // Get location ID from backend (required for the real Stripe Terminal
      // SDK). Non-fatal: businesses without Stripe Connect (e.g. the demo
      // account) get a 400 here and fall back to the simulated location.
      try {
        const locationResponse = await api.get<{ locationId: string }>('/api/stripe/terminal-location');
        if (!locationResponse.error && locationResponse.data?.locationId) {
          locationIdRef.current = locationResponse.data.locationId;
        }
      } catch {
        // Ignore — locationIdRef stays null and the simulator location is used.
      }

      if (sdkHook) {
        // Real SDK initialization
        const { error: initError } = await sdkHook.initialize() || {};
        if (initError) {
          // Handle osVersionNotSupported error from SDK (Apple Requirement 1.3)
          if (initError.code === 'osVersionNotSupported' || 
              initError.message?.includes('osVersionNotSupported')) {
            setError(OS_VERSION_NOT_SUPPORTED_MESSAGE);
            setStatus('error');
            return false;
          }
          throw new Error(initError.message || 'SDK initialization failed');
        }
        setIsInitialized(true);
        setStatus('ready');
        return true;
      } else {
        // Simulator fallback
        const success = await terminalSimulator.initialize();
        setIsInitialized(success);
        return success;
      }
    } catch (err: any) {
      // warn (not error) — transient failures (server busy, token fetch)
      // shouldn't throw full-screen red LogBox errors in dev builds.
      if (__DEV__) console.warn('[useStripeTerminal] Initialize error:', err);
      // Handle osVersionNotSupported error (Apple Requirement 1.3)
      if (err.code === 'osVersionNotSupported' || 
          err.message?.includes('osVersionNotSupported')) {
        setError(OS_VERSION_NOT_SUPPORTED_MESSAGE);
      } else {
        setError(err.message || 'Failed to initialize Stripe Terminal');
      }
      setStatus('error');
      return false;
    }
  }, [sdkHook]);

  // Discover and connect to Tap to Pay reader
  const connectReader = useCallback(async (): Promise<Reader | null> => {
    // Re-entrancy guard: a second tap while discovery/connection is running
    // would hit the SDK's "busy with another command: discoverReaders" error.
    // Instead of failing the second caller, share the in-flight attempt.
    if (connectInFlightRef.current) return connectInFlightRef.current;
    const attempt = (async (): Promise<Reader | null> => {
    try {
      setError(null);
      setStatus('discovering');

      const locationId = locationIdRef.current || 'tml_simulated';

      if (sdkHook) {
        // Reuse an existing connection — reconnecting from scratch is slow.
        const existing = sdkHook.connectedReader;
        if (existing) {
          const readerInfo: Reader = {
            id: existing.id || 'local_mobile',
            deviceType: 'localMobile',
            serialNumber: existing.serialNumber || 'TAP_TO_PAY',
            status: 'online',
            batteryLevel: existing.batteryLevel,
          };
          setReader(readerInfo);
          setStatus('connected');
          return readerInfo;
        }

        // Real SDK: Discover readers using tapToPay (Tap to Pay on iPhone).
        // NOTE: this SDK version renamed 'localMobile' -> 'tapToPay'; an unknown
        // method silently falls back to Bluetooth scanning, which abort()s the
        // whole app because we don't ship Bluetooth permissions.
        // On simulators/emulators there is no NFC hardware — asking Stripe for a
        // real Tap to Pay reader makes the native SDK abort() the whole app.
        // Use Stripe's simulated reader there instead.
        discoveredReadersRef.current = [];
        let { error: discoverError } = await sdkHook.discoverReaders({
          discoveryMethod: 'tapToPay',
          simulated: !Device.isDevice,
        });

        // A previous attempt (e.g. abandoned during Apple's first-time setup
        // sheet) can leave a native discovery running. Cancel it and retry once.
        if (discoverError?.message?.includes('busy')) {
          try {
            await sdkHook.cancelDiscovering();
          } catch {
            // Ignore — the stale discovery may have just completed on its own.
          }
          ({ error: discoverError } = await sdkHook.discoverReaders({
            discoveryMethod: 'tapToPay',
            simulated: !Device.isDevice,
          }));
        }

        if (discoverError) {
          throw new Error(discoverError.message);
        }

        // Wait for the discovery event to deliver the reader. The event
        // usually arrives right around when discoverReaders resolves, but
        // first-time Tap to Pay setup (Apple's Terms of Service sheet) can
        // keep the user on a system screen for a while — allow up to 90s.
        const deadline = Date.now() + 90000;
        while (discoveredReadersRef.current.length === 0 && Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 250));
        }

        const discoveredReaders = discoveredReadersRef.current;

        if (discoveredReaders.length === 0) {
          // Don't leave a dangling native discovery behind — it would make
          // every following attempt fail with "SDK is busy".
          try {
            await sdkHook.cancelDiscovering();
          } catch {
            // Ignore — nothing to cancel.
          }
          throw new Error('No Tap to Pay reader found');
        }

        const targetReader = discoveredReaders[0];
        setStatus('connecting');

        // Connect to the reader (connectLocalMobileReader was removed in this
        // SDK version; connectReader with discoveryMethod 'tapToPay' replaces it)
        const { reader: connectedReader, error: connectError } = await sdkHook.connectReader({
          discoveryMethod: 'tapToPay',
          reader: targetReader,
          locationId,
        });

        if (connectError) {
          throw new Error(connectError.message);
        }

        const readerInfo: Reader = {
          id: connectedReader.id || 'local_mobile',
          deviceType: 'localMobile',
          serialNumber: connectedReader.serialNumber || 'TAP_TO_PAY',
          status: 'online',
          batteryLevel: connectedReader.batteryLevel,
        };

        setReader(readerInfo);
        setStatus('connected');
        return readerInfo;
      } else {
        // Simulator fallback
        const readers = await terminalSimulator.discoverReaders();
        if (readers.length > 0) {
          const connectedReader = await terminalSimulator.connectReader(readers[0].id, locationId);
          setReader(connectedReader);
          return connectedReader;
        }
        return null;
      }
    } catch (err: any) {
      if (__DEV__) console.error('[useStripeTerminal] Connect error:', err);
      setError(err.message || 'Failed to connect to reader');
      setStatus('error');
      return null;
    } finally {
      connectInFlightRef.current = null;
    }
    })();
    connectInFlightRef.current = attempt;
    return attempt;
  }, [sdkHook]);

  // Collect payment using Tap to Pay
  const collectPayment = useCallback(async (
    amountInCents: number,
    description?: string,
    options?: { invoiceId?: string; jobId?: string }
  ): Promise<PaymentIntent | null> => {
    // Track the server-created PI so we can cancel it on Stripe if the
    // customer/tradie abandons the tap sheet (otherwise it lingers as an
    // incomplete payment and the SDK can resurface stale state).
    let createdPaymentIntentId: string | null = null;
    try {
      setError(null);
      setIsProcessing(true);
      setStatus('collecting');

      // Create payment intent on backend
      const intentResponse = await api.post<{ clientSecret: string; paymentIntentId: string }>('/api/stripe/create-terminal-payment-intent', {
        amount: amountInCents,
        description: description || 'Tap to Pay payment',
        currency: 'aud',
        invoiceId: options?.invoiceId,
        jobId: options?.jobId,
      });

      if (intentResponse.error || !intentResponse.data?.clientSecret) {
        const errorMsg = typeof intentResponse.error === 'string' 
          ? intentResponse.error 
          : (intentResponse.error as any)?.message || JSON.stringify(intentResponse.error) || 'Failed to create payment intent';
        throw new Error(errorMsg);
      }

      const clientSecret = intentResponse.data.clientSecret;
      createdPaymentIntentId = intentResponse.data.paymentIntentId;

      if (sdkHook) {
        // Real SDK: Retrieve and collect payment
        const { paymentIntent: retrievedPI, error: retrieveError } = await sdkHook.retrievePaymentIntent(clientSecret);

        if (retrieveError) {
          throw new Error(retrieveError.message);
        }

        // Collect payment method (customer taps card)
        const { paymentIntent: collectedPI, error: collectError } = await sdkHook.collectPaymentMethod({
          paymentIntent: retrievedPI,
        });

        if (collectError) {
          throw new Error(collectError.message);
        }

        setStatus('processing');

        // Process the payment
        const { paymentIntent: processedPI, error: processError } = await sdkHook.confirmPaymentIntent({
          paymentIntent: collectedPI,
        });

        if (processError) {
          throw new Error(processError.message);
        }

        const result: PaymentIntent = {
          id: processedPI.id,
          amount: processedPI.amount,
          currency: processedPI.currency,
          status: processedPI.status === 'succeeded' ? 'succeeded' : 'requires_capture',
        };

        setStatus('connected');
        return result;
      } else {
        // Simulator fallback — return the SERVER's payment intent id so the
        // payment-success confirmation can find the terminal payment record.
        const result = await terminalSimulator.collectPaymentMethod(clientSecret);
        if (!result.paymentIntent) return null;
        return {
          ...result.paymentIntent,
          id: intentResponse.data.paymentIntentId,
          amount: amountInCents,
        };
      }
    } catch (err: any) {
      // warn (not error) — expected failures like incomplete Stripe onboarding
      // shouldn't throw full-screen red LogBox errors in dev builds.
      if (__DEV__) console.warn('[useStripeTerminal] Collect payment error:', err);

      // Best-effort cleanup so an abandoned/failed tap doesn't leave a live
      // incomplete PaymentIntent on Stripe or stale collect state in the SDK.
      if (sdkHook) {
        try { await sdkHook.cancelCollectPaymentMethod(); } catch {}
      }
      if (createdPaymentIntentId) {
        api.post('/api/terminal/payment-cancel', { paymentIntentId: createdPaymentIntentId }).catch(() => {});
      }

      // User cancelling the Apple tap sheet is a normal outcome, not an error.
      const msg = String(err?.message || '');
      const code = String(err?.code || '');
      const isUserCancel = /cancel/i.test(msg) || /cancel/i.test(code);
      if (isUserCancel) {
        setStatus('connected');
        return null;
      }

      setError(err.message || 'Payment collection failed');
      setStatus('error');
      // Rethrow real failures so call sites can show a proper error message
      // (null is reserved for user cancellation).
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [sdkHook]);

  // Cancel payment collection
  const cancelPayment = useCallback(async () => {
    try {
      if (sdkHook) {
        await sdkHook.cancelCollectPaymentMethod();
      } else {
        await terminalSimulator.cancelCollecting();
      }
      setIsProcessing(false);
      setStatus('connected');
    } catch (err) {
      if (__DEV__) console.error('[useStripeTerminal] Cancel error:', err);
    }
  }, [sdkHook]);

  // Disconnect reader
  const disconnect = useCallback(async () => {
    try {
      if (sdkHook) {
        await sdkHook.disconnectReader();
      } else {
        await terminalSimulator.disconnect();
      }
      setReader(null);
      setStatus('ready');
    } catch (err) {
      if (__DEV__) console.error('[useStripeTerminal] Disconnect error:', err);
    }
  }, [sdkHook]);

  return {
    status,
    reader,
    isProcessing,
    error,
    isInitialized,
    isAvailable: isTapToPayAvailable(),
    isSDKAvailable: isSDKAvailable(),
    // Effective mode: even on a native build with the SDK compiled in, we run
    // in simulation when the SDK provider isn't mounted (no Stripe Connect —
    // e.g. the demo account). Call sites use this to decide whether to show
    // the custom payment modal (simulation) or rely on Apple's native UI.
    isSimulation: isSimulationMode() || !sdkHook,
    initialize,
    connectReader,
    collectPayment,
    cancelPayment,
    disconnect,
  };
}

/**
 * Hook for Push Notifications
 */
export function useNotifications() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    const token = await notificationService.initialize();
    setPushToken(token);
    setIsInitialized(!!token);
    return token;
  }, []);

  const onNotification = useCallback((
    onReceived: (notification: NotificationPayload) => void,
    onTapped: (notification: NotificationPayload, action?: string) => void
  ) => {
    notificationService.onReceived(onReceived);
    notificationService.onTapped(onTapped);
  }, []);

  const scheduleReminder = useCallback(async (
    title: string,
    body: string,
    delaySeconds: number
  ) => {
    return notificationService.scheduleLocalNotification(title, body, {}, delaySeconds);
  }, []);

  const clearBadge = useCallback(async () => {
    await notificationService.clearBadge();
  }, []);

  useEffect(() => {
    return () => {
      notificationService.cleanup();
    };
  }, []);

  return {
    isInitialized,
    pushToken,
    initialize,
    onNotification,
    scheduleReminder,
    clearBadge,
  };
}

/**
 * Hook for Offline Storage
 * Uses Zustand store for reactive state + offlineStorage service for operations
 */
export function useOfflineStorage() {
  const offlineState = useOfflineStore();

  const initialize = useCallback(async () => {
    try {
      await offlineStorage.initialize();
      return true;
    } catch (error) {
      // Gracefully handled: returns false and the app uses live server data.
      // Warn (not error) so it doesn't pop the red LogBox overlay in dev.
      if (__DEV__) console.warn('Failed to initialize offline storage, using server data:', error);
      return false;
    }
  }, []);

  // Jobs
  const getCachedJobs = useCallback(async (status?: string): Promise<CachedJob[]> => {
    return offlineStorage.getCachedJobs(status);
  }, []);

  const getCachedJob = useCallback(async (id: string): Promise<CachedJob | null> => {
    return offlineStorage.getCachedJob(id);
  }, []);

  const cacheJobs = useCallback(async (jobs: any[]) => {
    await offlineStorage.cacheJobs(jobs);
  }, []);

  const saveJobOffline = useCallback(async (job: Partial<CachedJob>, action: 'create' | 'update') => {
    return offlineStorage.saveJobOffline(job, action);
  }, []);

  const updateJobOffline = useCallback(async (jobId: string, updates: Partial<CachedJob>) => {
    await offlineStorage.updateJobOffline(jobId, updates);
  }, []);

  // Clients
  const getCachedClients = useCallback(async (): Promise<CachedClient[]> => {
    return offlineStorage.getCachedClients();
  }, []);

  const getCachedClient = useCallback(async (id: string): Promise<CachedClient | null> => {
    return offlineStorage.getCachedClient(id);
  }, []);

  const cacheClients = useCallback(async (clients: any[]) => {
    await offlineStorage.cacheClients(clients);
  }, []);

  const saveClientOffline = useCallback(async (client: Partial<CachedClient>, action: 'create' | 'update') => {
    return offlineStorage.saveClientOffline(client, action);
  }, []);

  // Quotes
  const getCachedQuotes = useCallback(async (): Promise<CachedQuote[]> => {
    return offlineStorage.getCachedQuotes();
  }, []);

  const getCachedQuote = useCallback(async (id: string): Promise<CachedQuote | null> => {
    return offlineStorage.getCachedQuote(id);
  }, []);

  const cacheQuotes = useCallback(async (quotes: any[]) => {
    await offlineStorage.cacheQuotes(quotes);
  }, []);

  // Invoices
  const getCachedInvoices = useCallback(async (): Promise<CachedInvoice[]> => {
    return offlineStorage.getCachedInvoices();
  }, []);

  const getCachedInvoice = useCallback(async (id: string): Promise<CachedInvoice | null> => {
    return offlineStorage.getCachedInvoice(id);
  }, []);

  const cacheInvoices = useCallback(async (invoices: any[]) => {
    await offlineStorage.cacheInvoices(invoices);
  }, []);

  // Sync
  const syncNow = useCallback(async () => {
    return offlineStorage.syncPendingChanges();
  }, []);

  const fullSync = useCallback(async () => {
    await offlineStorage.fullSync();
  }, []);

  const clearCache = useCallback(async () => {
    await offlineStorage.clearCache();
  }, []);

  return {
    ...offlineState,
    initialize,
    // Jobs
    getCachedJobs,
    getCachedJob,
    cacheJobs,
    saveJobOffline,
    updateJobOffline,
    // Clients
    getCachedClients,
    getCachedClient,
    cacheClients,
    saveClientOffline,
    // Quotes
    getCachedQuotes,
    getCachedQuote,
    cacheQuotes,
    // Invoices
    getCachedInvoices,
    getCachedInvoice,
    cacheInvoices,
    // Sync
    syncNow,
    fullSync,
    clearCache,
  };
}

/**
 * Hook for Location Tracking
 */
export function useLocationTracking() {
  const [status, setStatus] = useState<TrackingStatus>('stopped');
  const [currentLocation, setCurrentLocation] = useState<LocationUpdate | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const initialize = useCallback(async () => {
    const success = await locationTracking.initialize();
    setIsInitialized(success);
    return success;
  }, []);

  const checkPermissions = useCallback(async () => {
    return locationTracking.checkPermissions();
  }, []);

  const requestForegroundPermission = useCallback(async () => {
    return locationTracking.requestForegroundPermission();
  }, []);

  const requestBackgroundPermission = useCallback(async () => {
    return locationTracking.requestBackgroundPermission();
  }, []);

  useEffect(() => {
    locationTracking.onStatus(setStatus);
    locationTracking.onLocation(setCurrentLocation);
  }, []);

  const startTracking = useCallback(async () => {
    return locationTracking.startTracking();
  }, []);

  const stopTracking = useCallback(async () => {
    await locationTracking.stopTracking();
  }, []);

  const getCurrentLocation = useCallback(async () => {
    return locationTracking.getCurrentLocation();
  }, []);

  const addJobGeofence = useCallback(async (
    jobId: string,
    latitude: number,
    longitude: number,
    radius?: number
  ) => {
    return locationTracking.addJobGeofence(jobId, latitude, longitude, radius);
  }, []);

  const removeJobGeofence = useCallback(async (jobId: string) => {
    await locationTracking.removeJobGeofence(jobId);
  }, []);

  const onGeofenceEvent = useCallback((callback: (event: GeofenceEvent) => void) => {
    locationTracking.onGeofence(callback);
  }, []);

  return {
    status,
    currentLocation,
    isInitialized,
    isTracking: status === 'tracking' || status === 'foreground_only',
    initialize,
    checkPermissions,
    requestForegroundPermission,
    requestBackgroundPermission,
    startTracking,
    stopTracking,
    getCurrentLocation,
    addJobGeofence,
    removeJobGeofence,
    onGeofenceEvent,
  };
}
