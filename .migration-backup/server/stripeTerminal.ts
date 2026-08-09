import { getErrorMessage } from "./lib/errors";
import Stripe from 'stripe';
import { getUncachableStripeClient } from './stripeClient';

export interface TerminalConnectionTokenResult {
  success: boolean;
  secret?: string;
  error?: string;
}

export interface TerminalLocationResult {
  success: boolean;
  locationId?: string;
  location?: Stripe.Terminal.Location;
  error?: string;
}

export interface TerminalPaymentIntentResult {
  success: boolean;
  paymentIntentId?: string;
  clientSecret?: string;
  amount?: number;
  error?: string;
}

export interface TerminalCaptureResult {
  success: boolean;
  paymentIntentId?: string;
  status?: string;
  error?: string;
}

export async function createTerminalConnectionToken(
  locationId?: string
): Promise<TerminalConnectionTokenResult> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Stripe not configured' };
  }

  try {
    const params: Stripe.Terminal.ConnectionTokenCreateParams = {};
    if (locationId) {
      params.location = locationId;
    }

    const connectionToken = await stripe.terminal.connectionTokens.create(params);
    
    return {
      success: true,
      secret: connectionToken.secret,
    };
  } catch (error: unknown) {
    console.error('Error creating Terminal connection token:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function getOrCreateTerminalLocation(
  businessName: string,
  address: {
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  },
  metadata?: Record<string, string>
): Promise<TerminalLocationResult> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Stripe not configured' };
  }

  try {
    const existingLocations = await stripe.terminal.locations.list({ limit: 100 });
    
    const existingLocation = existingLocations.data.find(
      loc => loc.display_name === businessName && 
             loc.address?.line1 === address.line1 &&
             loc.address?.city === address.city
    );

    if (existingLocation) {
      return {
        success: true,
        locationId: existingLocation.id,
        location: existingLocation,
      };
    }

    const newLocation = await stripe.terminal.locations.create({
      display_name: businessName,
      address: {
        line1: address.line1,
        city: address.city,
        state: address.state,
        postal_code: address.postalCode,
        country: address.country || 'AU',
      },
      metadata: metadata || {},
    });

    return {
      success: true,
      locationId: newLocation.id,
      location: newLocation,
    };
  } catch (error: unknown) {
    console.error('Error creating Terminal location:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function listTerminalLocations(): Promise<{
  success: boolean;
  locations?: Stripe.Terminal.Location[];
  error?: string;
}> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Stripe not configured' };
  }

  try {
    const locations = await stripe.terminal.locations.list({ limit: 100 });
    return {
      success: true,
      locations: locations.data,
    };
  } catch (error: unknown) {
    console.error('Error listing Terminal locations:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function createTerminalPaymentIntent(
  amount: number,
  currency: string = 'aud',
  metadata?: Record<string, string>,
  captureMethod: 'manual' | 'automatic' = 'automatic',
  idempotencyKey?: string
): Promise<TerminalPaymentIntentResult> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Stripe not configured' };
  }

  try {
    const amountInCents = Math.round(amount * 100);
    
    if (amountInCents < 100) {
      return { success: false, error: 'Minimum payment amount is $1.00 AUD' };
    }

    // Use idempotency key to prevent duplicate charges
    const requestOptions: { idempotencyKey?: string } = {};
    if (idempotencyKey) {
      requestOptions.idempotencyKey = idempotencyKey;
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      payment_method_types: ['card_present'],
      capture_method: captureMethod,
      metadata: {
        ...metadata,
        source: 'terminal',
        platform: 'jobrunner',
      },
    }, requestOptions);

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret || undefined,
      amount: amountInCents,
    };
  } catch (error: unknown) {
    console.error('Error creating Terminal payment intent:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function createTerminalPaymentIntentWithConnect(
  amount: number,
  connectedAccountId: string,
  platformFeePercent: number = 2.5,
  currency: string = 'aud',
  metadata?: Record<string, string>,
  idempotencyKey?: string
): Promise<TerminalPaymentIntentResult> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Stripe not configured' };
  }

  try {
    const amountInCents = Math.round(amount * 100);
    
    if (amountInCents < 500) {
      return { success: false, error: 'Minimum payment amount is $5.00 AUD' };
    }

    const platformFeeAmount = Math.max(Math.round(amountInCents * (platformFeePercent / 100)), 50);

    // Use idempotency key to prevent duplicate charges
    const requestOptions: { idempotencyKey?: string } = {};
    if (idempotencyKey) {
      requestOptions.idempotencyKey = idempotencyKey;
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      payment_method_types: ['card_present'],
      capture_method: 'automatic',
      application_fee_amount: platformFeeAmount,
      transfer_data: {
        destination: connectedAccountId,
      },
      metadata: {
        ...metadata,
        source: 'terminal',
        platform: 'jobrunner',
        platformFee: platformFeeAmount.toString(),
      },
    }, requestOptions);

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret || undefined,
      amount: amountInCents,
    };
  } catch (error: unknown) {
    console.error('Error creating Terminal payment intent with Connect:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function captureTerminalPayment(
  paymentIntentId: string,
  amountToCapture?: number,
  idempotencyKey?: string
): Promise<TerminalCaptureResult> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Stripe not configured' };
  }

  try {
    const params: Stripe.PaymentIntentCaptureParams = {};
    if (amountToCapture !== undefined) {
      params.amount_to_capture = Math.round(amountToCapture * 100);
    }

    // Use idempotency key to prevent double-capture
    const requestOptions: { idempotencyKey?: string } = {};
    if (idempotencyKey) {
      requestOptions.idempotencyKey = idempotencyKey;
    }

    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId, params, requestOptions);

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    };
  } catch (error: unknown) {
    console.error('Error capturing Terminal payment:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function cancelTerminalPayment(
  paymentIntentId: string
): Promise<{ success: boolean; error?: string }> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Stripe not configured' };
  }

  try {
    await stripe.paymentIntents.cancel(paymentIntentId);
    return { success: true };
  } catch (error: unknown) {
    console.error('Error canceling Terminal payment:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function getTerminalPaymentIntent(
  paymentIntentId: string
): Promise<{
  success: boolean;
  paymentIntent?: Stripe.PaymentIntent;
  error?: string;
}> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Stripe not configured' };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return {
      success: true,
      paymentIntent,
    };
  } catch (error: unknown) {
    console.error('Error retrieving Terminal payment intent:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function checkTerminalCapabilities(): Promise<{
  available: boolean;
  terminalEnabled: boolean;
  tapToPayEnabled: boolean;
  error?: string;
}> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { 
      available: false, 
      terminalEnabled: false, 
      tapToPayEnabled: false,
      error: 'Stripe not configured' 
    };
  }

  try {
    const locations = await stripe.terminal.locations.list({ limit: 1 });
    
    return {
      available: true,
      terminalEnabled: true,
      tapToPayEnabled: true,
    };
  } catch (error: any) {
    if (error.code === 'terminal_not_enabled') {
      return {
        available: false,
        terminalEnabled: false,
        tapToPayEnabled: false,
        error: 'Stripe Terminal is not enabled for this account. Please enable it in your Stripe Dashboard.',
      };
    }
    
    return {
      available: true,
      terminalEnabled: true,
      tapToPayEnabled: true,
    };
  }
}

export async function simulateTerminalPayment(
  paymentIntentId: string
): Promise<{ success: boolean; error?: string }> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Stripe not configured' };
  }

  try {
    const testPaymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        number: '4242424242424242',
        exp_month: 12,
        exp_year: 2030,
        cvc: '123',
      },
    });

    await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: testPaymentMethod.id,
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('Error simulating Terminal payment:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
