import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { Platform } from 'react-native';

// Stub implementation - Stripe Terminal SDK temporarily disabled for App Store builds
// Re-enable when Apple approves Tap to Pay production entitlement

export type TerminalStatus = 'not_initialized' | 'initializing' | 'ready' | 'connecting' | 'connected' | 'processing' | 'error';

export interface Reader {
  id: string;
  serialNumber: string;
  label?: string;
  locationId?: string;
  status: string;
  deviceType: string;
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface StripeTerminalState {
  isInitialized: boolean;
  isConnected: boolean;
  isCollecting: boolean;
  error: string | null;
  connectedReader: Reader | null;
  discoveredReaders: Reader[];
}

interface CollectPaymentParams {
  amount: number;
  currency: string;
  description?: string;
}

interface StripeTerminalContextValue extends StripeTerminalState {
  initializeTerminal: () => Promise<boolean>;
  discoverReaders: () => Promise<Reader[]>;
  connectReader: (reader: Reader) => Promise<boolean>;
  collectPayment: (params: CollectPaymentParams) => Promise<PaymentIntent | null>;
  cancelCollectPayment: () => Promise<boolean>;
  disconnectReader: () => Promise<boolean>;
  clearError: () => void;
  isSDKAvailable: boolean;
}

const StripeTerminalContext = createContext<StripeTerminalContextValue | null>(null);

interface StripeTerminalProviderProps {
  children: ReactNode;
}

// SDK availability check - always false since SDK is removed
export const isSDKAvailable = false;

// Tap to Pay availability - disabled pending Apple approval
export function isTapToPayAvailable(): boolean {
  return false;
}

// Check if running in simulation mode
export function isSimulationMode(): boolean {
  return true; // Always simulation since SDK is removed
}

// OS version check for Tap to Pay (iOS 16.4+ required)
export function isOsVersionNotSupported(): boolean {
  if (Platform.OS === 'ios') {
    const version = parseFloat(Platform.Version as string);
    return version < 16.4;
  }
  return false;
}

export const OS_VERSION_NOT_SUPPORTED_MESSAGE = 'Tap to Pay requires iOS 16.4 or later. Please update your device.';

// Android permissions (stub)
export async function requestAndroidPermissions(): Promise<boolean> {
  return true;
}

// Terminal simulator stub
export const terminalSimulator = {
  status: 'not_initialized' as TerminalStatus,
  onStatusChange: (callback: (status: TerminalStatus) => void) => {
    // No-op in stub
  },
  initialize: async (): Promise<boolean> => {
    if (__DEV__) console.log('[StripeTerminal] Simulator not available - SDK removed pending Apple approval');
    return false;
  },
  discoverReaders: async (): Promise<Reader[]> => {
    return [];
  },
  connectReader: async (reader: Reader): Promise<boolean> => {
    return false;
  },
  collectPayment: async (amount: number, currency: string): Promise<PaymentIntent | null> => {
    return null;
  },
  cancelPayment: async (): Promise<boolean> => {
    return false;
  },
  disconnect: async (): Promise<boolean> => {
    return false;
  },
};

export function StripeTerminalProvider({ children }: StripeTerminalProviderProps) {
  const [state] = useState<StripeTerminalState>({
    isInitialized: false,
    isConnected: false,
    isCollecting: false,
    error: 'Tap to Pay is temporarily unavailable. Pending Apple production approval.',
    connectedReader: null,
    discoveredReaders: [],
  });

  const notAvailable = useCallback(async () => {
    if (__DEV__) console.log('[StripeTerminal] SDK not available - pending Apple production approval');
    return false;
  }, []);

  const contextValue: StripeTerminalContextValue = {
    ...state,
    isSDKAvailable: false,
    initializeTerminal: notAvailable,
    discoverReaders: useCallback(async () => [], []),
    connectReader: notAvailable,
    collectPayment: useCallback(async () => null, []),
    cancelCollectPayment: notAvailable,
    disconnectReader: notAvailable,
    clearError: useCallback(() => {}, []),
  };

  return (
    <StripeTerminalContext.Provider value={contextValue}>
      {children}
    </StripeTerminalContext.Provider>
  );
}

export function useStripeTerminal(): StripeTerminalContextValue {
  const context = useContext(StripeTerminalContext);
  
  if (!context) {
    throw new Error('useStripeTerminal must be used within a StripeTerminalProvider');
  }
  
  return context;
}
