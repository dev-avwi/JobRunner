/**
 * Stripe Terminal SDK for Tap to Pay
 * 
 * This module provides NFC-based contactless payment functionality using
 * Stripe Terminal's Tap to Pay on iPhone/Android feature.
 * 
 * IMPORTANT: Tap to Pay requires:
 * 1. A native build (not Expo Go) - run `eas build`
 * 2. Apple Developer Program membership ($99/year) for iOS
 * 3. Tap to Pay entitlement from Apple for iOS
 * 4. Stripe account with Terminal enabled
 * 5. Location services enabled
 * 
 * The @stripe/stripe-terminal-react-native package is used for actual payments.
 * In Expo Go, this module provides a simulation/fallback mode for testing UI.
 */

import { Platform } from 'react-native';

// Types for Stripe Terminal
export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_capture' | 'succeeded' | 'canceled';
  clientSecret?: string;
}

export interface Reader {
  id: string;
  deviceType: 'tapToPay' | 'localMobile' | 'chipper' | 'wisepad' | 'stripeM2';
  serialNumber: string;
  status: 'online' | 'offline';
  batteryLevel?: number;
  label?: string;
}

export type TerminalStatus = 
  | 'not_initialized'
  | 'initializing'
  | 'ready'
  | 'discovering'
  | 'connecting'
  | 'connected'
  | 'collecting'
  | 'processing'
  | 'error';

export interface TerminalState {
  status: TerminalStatus;
  reader: Reader | null;
  error: string | null;
  paymentIntent: PaymentIntent | null;
}

export interface CollectPaymentResult {
  paymentIntent: PaymentIntent;
  error?: string;
}

let StripeTerminalSDK: any = null;
let sdkAvailable = false;

// Apple Tap to Pay entitlement granted (Case-ID 20927765) — enabled in all builds.
const TAP_TO_PAY_ENABLED = true;

try {
  if (TAP_TO_PAY_ENABLED) {
    StripeTerminalSDK = require('@stripe/stripe-terminal-react-native');
    sdkAvailable = true;
    if (__DEV__) console.log('[StripeTerminal] SDK loaded successfully');
  }
} catch (e) {
  if (__DEV__) console.log('[StripeTerminal] SDK not available - using simulation mode (Expo Go or missing native module)');
}

/**
 * Check if Stripe Terminal SDK is available (native build)
 */
export const isSDKAvailable = (): boolean => {
  return sdkAvailable;
};

/**
 * Check if Tap to Pay is available on this device
 * Requires: iOS 17.6+ (per Apple Tap to Pay requirements) or Android 8+ with NFC
 */
export const isTapToPayAvailable = (): boolean => {
  if (Platform.OS === 'ios') {
    const version = parseFloat(Platform.Version as string);
    // iOS 17.6+ required for Tap to Pay on iPhone (Apple Requirement 1.3)
    return version >= 17.6;
  }
  if (Platform.OS === 'android') {
    // Tap to Pay is not offered on Android — hide the option entirely
    return false;
  }
  return false;
};

/**
 * Check if iOS version is too old for Tap to Pay
 * Returns true if iOS but version is below 17.6
 */
export const isOsVersionNotSupported = (): boolean => {
  if (Platform.OS === 'ios') {
    const version = parseFloat(Platform.Version as string);
    return version < 17.6;
  }
  return false;
};

/**
 * Error message for unsupported OS version (Apple Requirement 1.3)
 */
export const OS_VERSION_NOT_SUPPORTED_MESSAGE = 
  'Please update to the latest version of iOS to use Tap to Pay on iPhone';

/**
 * Get the useStripeTerminal hook from SDK if available
 * This is the primary hook for Terminal operations in native builds
 */
export const getUseStripeTerminal = () => {
  if (StripeTerminalSDK?.useStripeTerminal) {
    return StripeTerminalSDK.useStripeTerminal;
  }
  return null;
};

/**
 * Request Android permissions for Stripe Terminal
 */
export const requestAndroidPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }

  if (StripeTerminalSDK?.requestNeededAndroidPermissions) {
    try {
      const result = await StripeTerminalSDK.requestNeededAndroidPermissions({
        accessFineLocation: {
          title: 'Location Permission',
          message: 'JobRunner needs location access to process Tap to Pay payments.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      });
      return result === 'granted';
    } catch (error) {
      if (__DEV__) console.error('[StripeTerminal] Permission request failed:', error);
      return false;
    }
  }
  
  return true;
};

/**
 * Simulation service for Expo Go / testing
 * Provides the same interface as the real SDK for UI development
 */
class StripeTerminalSimulator {
  private status: TerminalStatus = 'not_initialized';
  private statusCallback?: (status: TerminalStatus) => void;
  private reader: Reader | null = null;

  async initialize(): Promise<boolean> {
    if (__DEV__) console.log('[StripeTerminal Simulator] Initializing...');
    this.updateStatus('initializing');
    await this.delay(800);
    this.updateStatus('ready');
    return true;
  }

  async discoverReaders(): Promise<Reader[]> {
    this.updateStatus('discovering');
    await this.delay(1500);
    
    const reader: Reader = {
      id: 'simulated_tap_to_pay',
      deviceType: 'localMobile',
      serialNumber: 'SIMULATED_DEVICE',
      status: 'online',
      batteryLevel: 100,
      label: 'Tap to Pay (Simulated)',
    };
    
    return [reader];
  }

  async connectReader(readerId: string, locationId: string): Promise<Reader | null> {
    this.updateStatus('connecting');
    await this.delay(1000);
    
    this.reader = {
      id: readerId,
      deviceType: 'localMobile',
      serialNumber: 'SIMULATED_DEVICE',
      status: 'online',
      batteryLevel: 100,
    };
    
    this.updateStatus('connected');
    return this.reader;
  }

  async collectPaymentMethod(clientSecret: string): Promise<CollectPaymentResult> {
    this.updateStatus('collecting');
    if (__DEV__) console.log('[StripeTerminal Simulator] Waiting for card tap...');
    
    // Simulate waiting for card tap (3 seconds)
    await this.delay(3000);
    
    this.updateStatus('processing');
    await this.delay(1500);
    
    const paymentIntent: PaymentIntent = {
      id: 'pi_simulated_' + Date.now(),
      amount: 0,
      currency: 'aud',
      status: 'succeeded',
      clientSecret,
    };
    
    this.updateStatus('connected');
    
    return { paymentIntent };
  }

  async cancelCollecting(): Promise<void> {
    if (__DEV__) console.log('[StripeTerminal Simulator] Canceling collection');
    this.updateStatus('connected');
  }

  async disconnect(): Promise<void> {
    if (__DEV__) console.log('[StripeTerminal Simulator] Disconnecting');
    this.reader = null;
    this.updateStatus('ready');
  }

  onStatusChange(callback: (status: TerminalStatus) => void): void {
    this.statusCallback = callback;
  }

  getStatus(): TerminalStatus {
    return this.status;
  }

  getReader(): Reader | null {
    return this.reader;
  }

  isConnected(): boolean {
    return this.status === 'connected' && this.reader !== null;
  }

  private updateStatus(status: TerminalStatus): void {
    this.status = status;
    if (this.statusCallback) {
      this.statusCallback(status);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton simulator for fallback mode
export const terminalSimulator = new StripeTerminalSimulator();

/**
 * Check if currently running in simulation mode (no real SDK available)
 * When true, payments are simulated and no actual charges occur
 */
export const isSimulationMode = (): boolean => {
  return !sdkAvailable;
};

export default terminalSimulator;
