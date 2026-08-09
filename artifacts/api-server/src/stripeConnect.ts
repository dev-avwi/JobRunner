import { getErrorMessage } from "./lib/errors";
import Stripe from 'stripe';
import { getUncachableStripeClient } from './stripeClient';
import { STRIPE_CONFIG } from './config/stripe';

const PLATFORM_FEE_PERCENT = STRIPE_CONFIG.platformFeePercent;

export interface ConnectAccountResult {
  success: boolean;
  accountId?: string;
  onboardingUrl?: string;
  error?: string;
}

export interface PaymentWithFeeResult {
  success: boolean;
  paymentIntentId?: string;
  clientSecret?: string;
  tradieAmount?: number;
  platformFee?: number;
  error?: string;
}

export async function createConnectAccount(
  userId: string,
  email: string,
  businessName: string,
  returnUrl: string,
  refreshUrl: string
): Promise<ConnectAccountResult> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Stripe not configured' };
  }

  try {
    const account = await stripe.accounts.create({
      type: 'express',
      country: STRIPE_CONFIG.country,
      email,
      business_type: 'individual',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        name: businessName,
        mcc: STRIPE_CONFIG.mcc,
        url: returnUrl,
      },
      metadata: {
        userId,
        platform: 'jobrunner',
      },
    });

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return {
      success: true,
      accountId: account.id,
      onboardingUrl: accountLink.url,
    };
  } catch (error: unknown) {
    console.error('Error creating Connect account:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function createConnectOnboardingLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string
): Promise<{ url?: string; error?: string; isConfigurationError?: boolean }> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { error: 'Stripe not configured' };
  }

  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });
    return { url: accountLink.url };
  } catch (error: unknown) {
    console.error('Error creating onboarding link:', error);
    
    // Check for Australia country not enabled error
    if (getErrorMessage(error)?.includes('not enabled for Express') || getErrorMessage(error)?.includes('Country and Capabilities')) {
      return { 
        error: 'Stripe payment setup is being configured. Please try again shortly or contact support.',
        isConfigurationError: true
      };
    }
    
    return { error: getErrorMessage(error) };
  }
}

export async function getConnectAccountStatus(accountId: string): Promise<{
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsCurrentlyDue: string[];
  error?: string;
}> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { 
      chargesEnabled: false, 
      payoutsEnabled: false, 
      detailsSubmitted: false,
      requirementsCurrentlyDue: [],
      error: 'Stripe not configured' 
    };
  }

  try {
    const account = await stripe.accounts.retrieve(accountId);
    return {
      chargesEnabled: account.charges_enabled || false,
      payoutsEnabled: account.payouts_enabled || false,
      detailsSubmitted: account.details_submitted || false,
      requirementsCurrentlyDue: account.requirements?.currently_due || [],
    };
  } catch (error: unknown) {
    console.error('Error getting Connect account status:', error);
    return { 
      chargesEnabled: false, 
      payoutsEnabled: false, 
      detailsSubmitted: false,
      requirementsCurrentlyDue: [],
      error: getErrorMessage(error) 
    };
  }
}

export async function createPaymentIntentWithFee(
  amount: number,
  connectedAccountId: string,
  platformFeePercent: number = PLATFORM_FEE_PERCENT,
  metadata: Record<string, string> = {}
): Promise<PaymentWithFeeResult> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Stripe not configured' };
  }

  try {
    const amountInCents = Math.round(amount * 100);
    
    // Minimum invoice amount check - must cover platform fee + Stripe fees
    if (amountInCents < STRIPE_CONFIG.minimumAmountCents) {
      return { success: false, error: `Minimum payment amount is $${(STRIPE_CONFIG.minimumAmountCents / 100).toFixed(2)} ${STRIPE_CONFIG.currency.toUpperCase()}` };
    }
    
    // Calculate platform fee (with floor to cover Stripe's per-transaction fee)
    const platformFeeAmount = Math.max(Math.round(amountInCents * (platformFeePercent / 100)), STRIPE_CONFIG.platformFeeMinCents);
    const tradieAmount = amountInCents - platformFeeAmount;
    
    // Validate tradie will receive positive amount
    if (tradieAmount <= 0) {
      return { success: false, error: 'Invoice amount too low to process' };
    }

    // Use destination charges - customer pays platform, we transfer to tradie
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: STRIPE_CONFIG.currency,
      application_fee_amount: platformFeeAmount,
      transfer_data: {
        destination: connectedAccountId,
      },
      on_behalf_of: connectedAccountId, // Process on behalf of connected account
      metadata: {
        ...metadata,
        platformFeePercent: platformFeePercent.toString(),
        tradieAmount: (tradieAmount / 100).toFixed(2),
        platformFee: (platformFeeAmount / 100).toFixed(2),
      },
    });

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret || undefined,
      tradieAmount: tradieAmount / 100,
      platformFee: platformFeeAmount / 100,
    };
  } catch (error: unknown) {
    console.error('Error creating payment intent with fee:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function createCheckoutSessionWithFee(
  amount: number,
  connectedAccountId: string,
  successUrl: string,
  cancelUrl: string,
  invoiceId: string,
  clientEmail: string,
  invoiceTitle: string,
  platformFeePercent: number = PLATFORM_FEE_PERCENT
): Promise<{ sessionId?: string; url?: string; error?: string }> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { error: 'Stripe not configured' };
  }

  try {
    const amountInCents = Math.round(amount * 100);
    
    // Minimum invoice amount check - must cover platform fee + Stripe fees
    if (amountInCents < STRIPE_CONFIG.minimumAmountCents) {
      return { error: `Minimum payment amount is $${(STRIPE_CONFIG.minimumAmountCents / 100).toFixed(2)} ${STRIPE_CONFIG.currency.toUpperCase()}` };
    }
    
    // Calculate platform fee (with floor to cover Stripe's per-transaction fee)
    const platformFeeAmount = Math.max(Math.round(amountInCents * (platformFeePercent / 100)), STRIPE_CONFIG.platformFeeMinCents);
    const tradieAmount = amountInCents - platformFeeAmount;
    
    // Validate tradie will receive positive amount
    if (tradieAmount <= 0) {
      return { error: 'Invoice amount too low to process' };
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: STRIPE_CONFIG.currency,
            product_data: {
              name: invoiceTitle,
              description: `Invoice payment`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: clientEmail,
      payment_intent_data: {
        application_fee_amount: platformFeeAmount,
        transfer_data: {
          destination: connectedAccountId,
        },
        on_behalf_of: connectedAccountId,
        metadata: {
          invoiceId,
          platformFeePercent: platformFeePercent.toString(),
          tradieAmount: (tradieAmount / 100).toFixed(2),
          platformFee: (platformFeeAmount / 100).toFixed(2),
        },
      },
      metadata: {
        invoiceId,
        type: 'invoice_payment',
      },
    });

    return {
      sessionId: session.id,
      url: session.url || undefined,
    };
  } catch (error: unknown) {
    console.error('Error creating checkout session with fee:', error);
    return { error: getErrorMessage(error) };
  }
}

export async function createLoginLink(accountId: string): Promise<{ url?: string; error?: string }> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { error: 'Stripe not configured' };
  }

  try {
    const loginLink = await stripe.accounts.createLoginLink(accountId);
    return { url: loginLink.url };
  } catch (error: unknown) {
    console.error('Error creating login link:', error);
    return { error: getErrorMessage(error) };
  }
}

export async function getAccountBalance(accountId: string): Promise<{
  available: number;
  pending: number;
  error?: string;
}> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { available: 0, pending: 0, error: 'Stripe not configured' };
  }

  try {
    const balance = await stripe.balance.retrieve({
      stripeAccount: accountId,
    } as any);

    const available = balance.available
      .filter(b => b.currency === STRIPE_CONFIG.currency)
      .reduce((sum, b) => sum + b.amount, 0) / 100;
    
    const pending = balance.pending
      .filter(b => b.currency === STRIPE_CONFIG.currency)
      .reduce((sum, b) => sum + b.amount, 0) / 100;

    return { available, pending };
  } catch (error: unknown) {
    console.error('Error getting account balance:', error);
    return { available: 0, pending: 0, error: getErrorMessage(error) };
  }
}
