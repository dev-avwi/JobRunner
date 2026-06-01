import { getUncachableStripeClient, getStripePublishableKey } from './stripeClient';
import { storage } from './storage';
import Stripe from 'stripe';
import { PRICING } from '@shared/schema';
import { getErrorMessage } from "./lib/errors";
import { logger } from "./logger";

export interface CheckoutSessionResult {
  success: boolean;
  sessionId?: string;
  sessionUrl?: string;
  error?: string;
}

export interface SubscriptionStatus {
  tier: 'free' | 'pro' | 'team' | 'business' | 'trial';
  status: 'active' | 'past_due' | 'canceled' | 'none';
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  seatCount?: number; // For team tier
}

export interface BillingPortalResult {
  success: boolean;
  url?: string;
  error?: string;
}

async function getOrCreateStripeCustomer(
  stripe: Stripe,
  userId: string,
  email: string,
  businessName?: string
): Promise<string> {
  const user = await storage.getUser(userId);
  const businessSettings = await storage.getBusinessSettings(userId);
  
  if (businessSettings?.stripeCustomerId) {
    try {
      await stripe.customers.retrieve(businessSettings.stripeCustomerId);
      return businessSettings.stripeCustomerId;
    } catch (e) {
      // Existing customer id no longer resolves at Stripe (deleted/wrong mode);
      // fall through to recreate. Log so we can spot churned/duplicate customers.
      logger.warn('billing', 'Failed to retrieve existing Stripe customer; recreating', {
        userId,
        error: e,
        metadata: { stripeCustomerId: businessSettings.stripeCustomerId },
      });
    }
  }

  const customer = await stripe.customers.create({
    email,
    name: businessName || businessSettings?.businessName || email,
    metadata: {
      userId,
      platform: 'jobrunner',
    },
  });

  if (businessSettings) {
    await storage.updateBusinessSettings(userId, {
      stripeCustomerId: customer.id,
    });
  }

  return customer.id;
}

async function getOrCreateProPrice(stripe: Stripe): Promise<string> {
  const prices = await stripe.prices.list({
    lookup_keys: ['jobrunner_pro_monthly_v2'],
    active: true,
    limit: 1,
  });

  if (prices.data.length > 0) {
    return prices.data[0].id;
  }

  const products = await stripe.products.list({
    active: true,
    limit: 100,
  });

  let product = products.data.find(
    (p) => p.name === PRICING.pro.name && p.active
  );

  if (!product) {
    product = await stripe.products.create({
      name: PRICING.pro.name,
      description: PRICING.pro.description,
      metadata: {
        platform: 'jobrunner',
        tier: 'pro',
      },
    });
  }

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: PRICING.pro.monthly,
    currency: 'aud',
    recurring: {
      interval: 'month',
    },
    lookup_key: 'jobrunner_pro_monthly_v2',
    metadata: {
      tier: 'pro',
    },
  });

  return price.id;
}

// Get or create flat Team monthly price ($89.99/month, includes up to 5 workers)
async function getOrCreateTeamPrice(stripe: Stripe): Promise<string> {
  const prices = await stripe.prices.list({
    lookup_keys: ['jobrunner_team_flat_monthly_v2'],
    active: true,
    limit: 1,
  });

  if (prices.data.length > 0) {
    return prices.data[0].id;
  }

  const products = await stripe.products.list({ active: true, limit: 100 });
  let product = products.data.find(p => p.name === PRICING.team.name && p.active);

  if (!product) {
    product = await stripe.products.create({
      name: PRICING.team.name,
      description: PRICING.team.description,
      metadata: { platform: 'jobrunner', tier: 'team' },
    });
  }

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: PRICING.team.monthly,
    currency: 'aud',
    recurring: { interval: 'month' },
    lookup_key: 'jobrunner_team_flat_monthly_v2',
    metadata: { tier: 'team' },
  });

  return price.id;
}

// Get or create flat Business monthly price ($129.99/month, includes up to 15 workers)
async function getOrCreateBusinessPrice(stripe: Stripe): Promise<string> {
  const prices = await stripe.prices.list({
    lookup_keys: ['jobrunner_business_flat_monthly_v2'],
    active: true,
    limit: 1,
  });

  if (prices.data.length > 0) {
    return prices.data[0].id;
  }

  const products = await stripe.products.list({ active: true, limit: 100 });
  let product = products.data.find(p => p.name === PRICING.business.name && p.active);

  if (!product) {
    product = await stripe.products.create({
      name: PRICING.business.name,
      description: PRICING.business.description,
      metadata: { platform: 'jobrunner', tier: 'business' },
    });
  }

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: PRICING.business.monthly,
    currency: 'aud',
    recurring: { interval: 'month' },
    lookup_key: 'jobrunner_business_flat_monthly_v2',
    metadata: { tier: 'business' },
  });

  return price.id;
}

export async function createSubscriptionCheckout(
  userId: string,
  email: string,
  successUrl: string,
  cancelUrl: string,
  businessName?: string,
  trialDays: number = 7
): Promise<CheckoutSessionResult> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Payment system not configured' };
  }

  try {
    const customerId = await getOrCreateStripeCustomer(stripe, userId, email, businessName);
    const priceId = await getOrCreateProPrice(stripe);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_collection: 'always',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      subscription_data: {
        metadata: {
          userId,
          tier: 'pro',
          platform: 'jobrunner',
        },
        trial_period_days: trialDays,
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel',
          },
        },
      },
      metadata: {
        userId,
        type: 'subscription',
        tier: 'pro',
      },
    });

    return {
      success: true,
      sessionId: session.id,
      sessionUrl: session.url || undefined,
    };
  } catch (error: unknown) {
    console.error('Error creating subscription checkout:', error);
    return { success: false, error: getErrorMessage(error) || 'Failed to create checkout session' };
  }
}

// Create Team subscription checkout (flat $89.99/mo, includes up to 5 workers)
export async function createTeamSubscriptionCheckout(
  userId: string,
  email: string,
  successUrl: string,
  cancelUrl: string,
  businessName?: string,
  trialDays: number = 7
): Promise<CheckoutSessionResult> {
  return createFlatTierCheckout(
    userId,
    email,
    successUrl,
    cancelUrl,
    'team',
    businessName,
    trialDays,
  );
}

// Create Business subscription checkout (flat $129.99/mo, includes up to 15 workers)
export async function createBusinessSubscriptionCheckout(
  userId: string,
  email: string,
  successUrl: string,
  cancelUrl: string,
  businessName?: string,
  trialDays: number = 7
): Promise<CheckoutSessionResult> {
  return createFlatTierCheckout(
    userId,
    email,
    successUrl,
    cancelUrl,
    'business',
    businessName,
    trialDays,
  );
}

async function createFlatTierCheckout(
  userId: string,
  email: string,
  successUrl: string,
  cancelUrl: string,
  tier: 'team' | 'business',
  businessName?: string,
  trialDays: number = 7,
): Promise<CheckoutSessionResult> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Payment system not configured' };
  }

  try {
    const customerId = await getOrCreateStripeCustomer(stripe, userId, email, businessName);
    const priceId = tier === 'business'
      ? await getOrCreateBusinessPrice(stripe)
      : await getOrCreateTeamPrice(stripe);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_collection: 'always',
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      subscription_data: {
        metadata: {
          userId,
          tier,
          platform: 'jobrunner',
        },
        trial_period_days: trialDays,
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel',
          },
        },
      },
      metadata: {
        userId,
        type: 'subscription',
        tier,
      },
    });

    return {
      success: true,
      sessionId: session.id,
      sessionUrl: session.url || undefined,
    };
  } catch (error: unknown) {
    console.error(`Error creating ${tier} subscription checkout:`, error);
    return { success: false, error: getErrorMessage(error) || 'Failed to create checkout session' };
  }
}

// Create a trial subscription directly (for API-based signups)
export interface TrialSubscriptionResult {
  success: boolean;
  subscriptionId?: string;
  customerId?: string;
  trialEndsAt?: Date;
  error?: string;
}

export async function createTrialSubscription(
  userId: string,
  email: string,
  paymentMethodId: string,
  tier: 'pro' | 'team' | 'business' = 'pro',
  businessName?: string
): Promise<TrialSubscriptionResult> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Payment system not configured' };
  }

  try {
    const customerId = await getOrCreateStripeCustomer(stripe, userId, email, businessName);
    
    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Get the price ID based on tier
    let priceId: string;
    if (tier === 'business') {
      priceId = await getOrCreateBusinessPrice(stripe);
    } else if (tier === 'team') {
      priceId = await getOrCreateTeamPrice(stripe);
    } else {
      priceId = await getOrCreateProPrice(stripe);
    }

    // Create subscription with 7-day trial
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: 7,
      trial_settings: {
        end_behavior: {
          missing_payment_method: 'cancel',
        },
      },
      metadata: {
        userId,
        tier,
        platform: 'jobrunner',
      },
    });

    const trialEnd = subscription.trial_end 
      ? new Date(subscription.trial_end * 1000) 
      : undefined;

    await storage.updateUser(userId, {
      subscriptionTier: tier,
      subscriptionSource: 'stripe',
      trialStatus: 'active',
      trialStartedAt: new Date(),
      trialEndsAt: trialEnd,
    });

    const businessSettings = await storage.getBusinessSettings(userId);
    if (businessSettings) {
      const bsUpdate: Record<string, any> = {
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
        subscriptionStatus: subscription.status,
        trialStartDate: new Date(),
        trialEndDate: trialEnd,
        nextBillingDate: trialEnd,
      };
      if ((tier === 'team' || tier === 'business') && (!businessSettings.teamSize || businessSettings.teamSize === 'solo')) {
        bsUpdate.teamSize = 'small';
      }
      await storage.updateBusinessSettings(userId, bsUpdate);
    }

    return {
      success: true,
      subscriptionId: subscription.id,
      customerId,
      trialEndsAt: trialEnd,
    };
  } catch (error: unknown) {
    console.error('Error creating trial subscription:', error);
    return { success: false, error: getErrorMessage(error) || 'Failed to create trial subscription' };
  }
}

// Get payment method details for a user
export interface PaymentMethodDetails {
  success: boolean;
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  error?: string;
}

export async function getPaymentMethodDetails(userId: string): Promise<PaymentMethodDetails> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Payment system not configured' };
  }

  try {
    const businessSettings = await storage.getBusinessSettings(userId);
    const customerId = businessSettings?.stripeCustomerId;

    if (!customerId) {
      return { success: false, error: 'No billing account found' };
    }

    // Get the customer to find default payment method
    const customer = await stripe.customers.retrieve(customerId);
    
    if ('deleted' in customer && customer.deleted) {
      return { success: false, error: 'Customer account not found' };
    }

    const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method;

    if (!defaultPaymentMethodId) {
      // Try to get from subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        limit: 1,
      });

      if (subscriptions.data.length === 0) {
        return { success: false, error: 'No payment method on file' };
      }

      const sub = subscriptions.data[0];
      const pmId = sub.default_payment_method;
      
      if (!pmId) {
        return { success: false, error: 'No payment method on file' };
      }

      const paymentMethod = await stripe.paymentMethods.retrieve(
        typeof pmId === 'string' ? pmId : pmId.id
      );

      if (paymentMethod.type === 'card' && paymentMethod.card) {
        return {
          success: true,
          last4: paymentMethod.card.last4,
          brand: paymentMethod.card.brand,
          expiryMonth: paymentMethod.card.exp_month,
          expiryYear: paymentMethod.card.exp_year,
        };
      }

      return { success: false, error: 'No card payment method found' };
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(
      typeof defaultPaymentMethodId === 'string' 
        ? defaultPaymentMethodId 
        : defaultPaymentMethodId.id
    );

    if (paymentMethod.type === 'card' && paymentMethod.card) {
      return {
        success: true,
        last4: paymentMethod.card.last4,
        brand: paymentMethod.card.brand,
        expiryMonth: paymentMethod.card.exp_month,
        expiryYear: paymentMethod.card.exp_year,
      };
    }

    return { success: false, error: 'No card payment method found' };
  } catch (error: unknown) {
    console.error('Error getting payment method details:', error);
    return { success: false, error: getErrorMessage(error) || 'Failed to get payment method' };
  }
}

export async function createBillingPortalSession(
  userId: string,
  returnUrl: string
): Promise<BillingPortalResult> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Payment system not configured' };
  }

  try {
    const businessSettings = await storage.getBusinessSettings(userId);
    const customerId = businessSettings?.stripeCustomerId;

    if (!customerId) {
      return { success: false, error: 'No billing account found' };
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return {
      success: true,
      url: session.url,
    };
  } catch (error: unknown) {
    console.error('Error creating billing portal session:', error);
    return { success: false, error: getErrorMessage(error) || 'Failed to create portal session' };
  }
}

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const stripe = await getUncachableStripeClient();
  const user = await storage.getUser(userId);
  const businessSettings = await storage.getBusinessSettings(userId);

  if (!user) {
    return { tier: 'free', status: 'none' };
  }

  if (user.trialStatus === 'active' && user.trialEndsAt) {
    const trialEnd = new Date(user.trialEndsAt);
    if (trialEnd > new Date()) {
      return {
        tier: 'trial',
        status: 'active',
        currentPeriodEnd: trialEnd,
      };
    }
  }

  const subscriptionId = businessSettings?.stripeSubscriptionId;
  const seatCount = (businessSettings as any)?.seatCount || 0;

  if (!stripe || !subscriptionId) {
    const tier = (user.subscriptionTier as 'free' | 'pro' | 'team' | 'business') || 'free';
    return {
      tier,
      status: tier !== 'free' ? 'active' : 'none',
      stripeCustomerId: businessSettings?.stripeCustomerId || undefined,
      seatCount: (tier === 'team' || tier === 'business') ? seatCount : undefined,
    };
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
    
    const subscriptionTier = subscription.metadata?.tier || user.subscriptionTier;
    const isActive = subscription.status === 'active' || subscription.status === 'trialing';
    
    let tier: 'free' | 'pro' | 'team' | 'business' = 'free';
    if (isActive) {
      if (subscriptionTier === 'business') tier = 'business';
      else if (subscriptionTier === 'team') tier = 'team';
      else tier = 'pro';
    }

    const liveStatus = subscription.status as string;
    const storedStatus = businessSettings?.subscriptionStatus;
    const storedTier = user.subscriptionTier;

    if (liveStatus !== storedStatus || tier !== storedTier) {
      try {
        if (liveStatus !== storedStatus) {
          await storage.updateBusinessSettings(userId, { subscriptionStatus: liveStatus } as any);
        }
        if (tier !== storedTier) {
          await storage.updateUser(userId, { subscriptionTier: tier } as any);
        }
        console.log(`[BillingSync] Persisted live Stripe state for ${userId}: status=${liveStatus} (was ${storedStatus}), tier=${tier} (was ${storedTier})`);
      } catch (syncErr) {
        console.error('[BillingSync] Failed to persist Stripe state:', syncErr);
      }
    }

    return {
      tier,
      status: liveStatus as 'active' | 'past_due' | 'canceled',
      currentPeriodEnd: new Date((subscription.current_period_end || 0) * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      stripeCustomerId: businessSettings?.stripeCustomerId || undefined,
      stripeSubscriptionId: subscriptionId,
      seatCount: (tier === 'team' || tier === 'business') ? seatCount : undefined,
    };
  } catch (error: unknown) {
    console.error('Error fetching subscription:', error);
    const tier = (user.subscriptionTier as 'free' | 'pro' | 'team' | 'business') || 'free';
    return {
      tier,
      status: 'none',
      stripeCustomerId: businessSettings?.stripeCustomerId || undefined,
      seatCount: (tier === 'team' || tier === 'business') ? seatCount : undefined,
    };
  }
}

export async function cancelSubscription(userId: string): Promise<{ success: boolean; error?: string }> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Payment system not configured' };
  }

  const businessSettings = await storage.getBusinessSettings(userId);
  const subscriptionId = businessSettings?.stripeSubscriptionId;

  if (!subscriptionId) {
    return { success: false, error: 'No active subscription found' };
  }

  try {
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('Error canceling subscription:', error);
    return { success: false, error: getErrorMessage(error) || 'Failed to cancel subscription' };
  }
}

export async function resumeSubscription(userId: string): Promise<{ success: boolean; error?: string }> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Payment system not configured' };
  }

  const businessSettings = await storage.getBusinessSettings(userId);
  const subscriptionId = businessSettings?.stripeSubscriptionId;

  if (!subscriptionId) {
    return { success: false, error: 'No subscription found' };
  }

  try {
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('Error resuming subscription:', error);
    return { success: false, error: getErrorMessage(error) || 'Failed to resume subscription' };
  }
}

export async function pauseSubscription(userId: string): Promise<{ success: boolean; error?: string; resumeDate?: string }> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Payment system not configured' };
  }

  const businessSettings = await storage.getBusinessSettings(userId);
  const subscriptionId = businessSettings?.stripeSubscriptionId;

  if (!subscriptionId) {
    return { success: false, error: 'No active subscription found' };
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    if (subscription.status !== 'active') {
      return { success: false, error: 'Only active subscriptions can be paused' };
    }

    await stripe.subscriptions.update(subscriptionId, {
      pause_collection: {
        behavior: 'void',
      },
    });

    const pausedAt = new Date();
    await storage.updateBusinessSettings(userId, {
      subscriptionStatus: 'paused',
      subscriptionPausedAt: pausedAt,
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('Error pausing subscription:', error);
    return { success: false, error: getErrorMessage(error) || 'Failed to pause subscription' };
  }
}

export async function unpauseSubscription(userId: string): Promise<{ success: boolean; error?: string }> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Payment system not configured' };
  }

  const businessSettings = await storage.getBusinessSettings(userId);
  const subscriptionId = businessSettings?.stripeSubscriptionId;

  if (!subscriptionId) {
    return { success: false, error: 'No subscription found' };
  }

  try {
    await stripe.subscriptions.update(subscriptionId, {
      pause_collection: null as any,
    });

    await storage.updateBusinessSettings(userId, {
      subscriptionStatus: 'active',
      subscriptionPausedAt: null,
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('Error unpausing subscription:', error);
    return { success: false, error: getErrorMessage(error) || 'Failed to unpause subscription' };
  }
}

export async function handleSubscriptionWebhook(
  event: Stripe.Event
): Promise<void> {
  const stripe = await getUncachableStripeClient();
  
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      const tier = subscription.metadata?.tier || 'pro';

      if (!userId) {
        console.log('No userId in subscription metadata');
        return;
      }

      const isActive = subscription.status === 'active' || subscription.status === 'trialing';
      const isTrialing = subscription.status === 'trialing';
      const sub = subscription as any;
      
      // Calculate next billing date and trial end
      const currentPeriodEnd = sub.current_period_end 
        ? new Date(sub.current_period_end * 1000) 
        : undefined;
      const trialEnd = sub.trial_end 
        ? new Date(sub.trial_end * 1000) 
        : undefined;

      await storage.updateUser(userId, {
        subscriptionTier: isActive ? tier : 'free',
        subscriptionSource: isActive ? 'stripe' : undefined,
        trialStatus: isTrialing ? 'active' : (isActive ? 'converted' : undefined),
        trialStartedAt: isTrialing && event.type === 'customer.subscription.created' ? new Date() : undefined,
        trialEndsAt: trialEnd,
      });

      const businessSettings = await storage.getBusinessSettings(userId);
      if (businessSettings) {
        // Prepare business settings update
        const businessUpdate: any = {
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          currentPeriodEnd,
          nextBillingDate: isTrialing ? trialEnd : currentPeriodEnd,
        };

        // Add trial tracking if trialing
        if (isTrialing) {
          businessUpdate.trialStartDate = event.type === 'customer.subscription.created' ? new Date() : undefined;
          businessUpdate.trialEndDate = trialEnd;
        }

        // If subscription just became active (converted from trial), mark conversion
        if (subscription.status === 'active' && !isTrialing) {
          businessUpdate.trialConverted = true;
        }

        // Try to get and store payment method details
        if (stripe) {
          try {
            const customerId = typeof subscription.customer === 'string' 
              ? subscription.customer 
              : subscription.customer.id;
            
            const customer = await stripe.customers.retrieve(customerId);
            
            if (!('deleted' in customer && customer.deleted)) {
              const defaultPmId = (customer as Stripe.Customer).invoice_settings?.default_payment_method 
                || subscription.default_payment_method;
              
              if (defaultPmId) {
                const pmId = typeof defaultPmId === 'string' ? defaultPmId : defaultPmId.id;
                const paymentMethod = await stripe.paymentMethods.retrieve(pmId);
                
                if (paymentMethod.type === 'card' && paymentMethod.card) {
                  businessUpdate.paymentMethodLast4 = paymentMethod.card.last4;
                  businessUpdate.paymentMethodBrand = paymentMethod.card.brand;
                  businessUpdate.defaultPaymentMethodId = pmId;
                }
              }
            }
          } catch (pmError) {
            console.error('Error fetching payment method in webhook:', pmError);
          }
        }

        await storage.updateBusinessSettings(userId, businessUpdate);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;

      if (!userId) {
        console.log('No userId in subscription metadata');
        return;
      }

      await storage.updateUser(userId, {
        subscriptionTier: 'free',
      });

      const businessSettings = await storage.getBusinessSettings(userId);
      if (businessSettings) {
        await storage.updateBusinessSettings(userId, {
          subscriptionStatus: 'canceled',
        });
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoiceData = event.data.object as any;
      const subscriptionId = invoiceData.subscription;
      if (subscriptionId && typeof subscriptionId === 'string') {
        const subscription = await (await getUncachableStripeClient())?.subscriptions.retrieve(
          subscriptionId
        );
        if (subscription?.metadata?.userId) {
          await storage.updateUser(subscription.metadata.userId, {
            subscriptionTier: 'pro',
          });
        }
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoiceData = event.data.object as any;
      const subscriptionId = invoiceData.subscription;
      if (subscriptionId && typeof subscriptionId === 'string') {
        const subscription = await (await getUncachableStripeClient())?.subscriptions.retrieve(
          subscriptionId
        );
        if (subscription?.metadata?.userId) {
          const businessSettings = await storage.getBusinessSettings(subscription.metadata.userId);
          if (businessSettings) {
            await storage.updateBusinessSettings(subscription.metadata.userId, {
              subscriptionStatus: 'past_due',
            });
          }
        }
      }
      break;
    }
  }
}

export async function getPublishableKey(): Promise<string | null> {
  return await getStripePublishableKey();
}

// Initialize all Stripe products and prices for JobRunner subscription tiers
export async function initializeStripeProducts(): Promise<{
  success: boolean;
  products: {
    pro?: { productId: string; priceId: string };
    team?: { productId: string; priceId: string };
    business?: { productId: string; priceId: string };
  };
  error?: string;
}> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, products: {}, error: 'Stripe not configured' };
  }

  try {
    const products: {
      pro?: { productId: string; priceId: string };
      team?: { productId: string; priceId: string };
      business?: { productId: string; priceId: string };
    } = {};

    const proPriceId = await getOrCreateProPrice(stripe);
    const proPrice = await stripe.prices.retrieve(proPriceId);
    products.pro = {
      productId: typeof proPrice.product === 'string' ? proPrice.product : proPrice.product.id,
      priceId: proPriceId,
    };

    const teamPriceId = await getOrCreateTeamPrice(stripe);
    const teamPrice = await stripe.prices.retrieve(teamPriceId);
    products.team = {
      productId: typeof teamPrice.product === 'string' ? teamPrice.product : teamPrice.product.id,
      priceId: teamPriceId,
    };

    const businessPriceId = await getOrCreateBusinessPrice(stripe);
    const businessPrice = await stripe.prices.retrieve(businessPriceId);
    products.business = {
      productId: typeof businessPrice.product === 'string' ? businessPrice.product : businessPrice.product.id,
      priceId: businessPriceId,
    };

    console.log('✅ Stripe products initialized:', products);
    return { success: true, products };
  } catch (error: unknown) {
    console.error('Failed to initialize Stripe products:', error);
    return { success: false, products: {}, error: getErrorMessage(error) };
  }
}

// DEPRECATED: Old per-seat Team pricing has been replaced with flat $89.99/mo Team
// and $129.99/mo Business tiers. New checkouts use jobrunner_team_flat_monthly_v2 /
// jobrunner_business_flat_monthly_v2 lookup keys via initializeStripeProducts().
// This stub is kept so the existing /api/admin/fix-team-base-price route still
// returns something sensible and doesn't 500.
export async function fixTeamBasePrice(): Promise<{
  success: boolean;
  oldPrice?: { id: string; amount: number };
  newPrice?: { id: string; amount: number };
  error?: string;
}> {
  return {
    success: false,
    error: 'Team is now flat $89.99/month — per-seat migration no longer applies. Run init-stripe-products to create the new flat Team and Business prices.',
  };
}

export interface UpgradeToTeamResult {
  success: boolean;
  subscriptionId?: string;
  trialEndsAt?: Date;
  error?: string;
}

export interface DowngradeToProResult {
  success: boolean;
  error?: string;
}

export async function downgradeTeamToPro(userId: string): Promise<DowngradeToProResult> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Payment system not configured' };
  }

  try {
    const businessSettings = await storage.getBusinessSettings(userId);
    
    if (!businessSettings?.stripeSubscriptionId) {
      return { success: false, error: 'No active subscription found' };
    }

    const currentSubscription = await stripe.subscriptions.retrieve(businessSettings.stripeSubscriptionId);
    
    if (currentSubscription.status !== 'active' && currentSubscription.status !== 'trialing') {
      return { success: false, error: 'Current subscription is not active' };
    }

    const currentTier = currentSubscription.metadata?.tier || businessSettings.subscriptionTier;
    if (currentTier !== 'team') {
      return { success: false, error: 'Current subscription is not a Team plan' };
    }

    const proPriceId = await getOrCreateProPrice(stripe);

    const items = currentSubscription.items.data;
    
    // Build update: Delete ALL existing items (base + seats) and add only Pro price
    // This properly handles multi-seat subscriptions by clearing everything
    const itemUpdates: Stripe.SubscriptionUpdateParams.Item[] = [];
    
    // Mark ALL existing items for deletion
    for (const item of items) {
      itemUpdates.push({
        id: item.id,
        deleted: true,
      });
    }
    
    // Add the Pro price as a new item
    itemUpdates.push({
      price: proPriceId,
      quantity: 1,
    });

    const updatedSubscription = await stripe.subscriptions.update(
      businessSettings.stripeSubscriptionId,
      {
        items: itemUpdates,
        proration_behavior: 'none',
        metadata: {
          ...currentSubscription.metadata,
          tier: 'pro',
          seatCount: '0',
          downgradedFromTeam: 'true',
          downgradeDate: new Date().toISOString(),
        },
      }
    );

    await storage.updateUser(userId, {
      subscriptionTier: 'pro',
    });

    await storage.updateBusinessSettings(userId, {
      subscriptionTier: 'pro',
      seatCount: 0,
      subscriptionStatus: updatedSubscription.status,
    });

    const suspendedCount = await storage.suspendTeamMembersByOwner(userId);
    console.log(`[downgradeTeamToPro] Suspended ${suspendedCount} team members for user ${userId}`);

    return { success: true };
  } catch (error: unknown) {
    console.error('Error downgrading to Pro:', error);
    return { success: false, error: getErrorMessage(error) || 'Failed to downgrade subscription' };
  }
}

/**
 * Upgrades a Pro subscription to flat Team ($89.99/mo, includes up to 5 workers)
 * with a trial period.
 */
export async function upgradeProToTeamTrial(
  userId: string,
  trialDays: number = 7
): Promise<UpgradeToTeamResult> {
  return upgradeProToFlatTierTrial(userId, 'team', trialDays);
}

/**
 * Upgrades a Pro or Team subscription to flat Business ($129.99/mo, includes up to
 * 15 workers) with a trial period.
 */
export async function upgradeProToBusinessTrial(
  userId: string,
  trialDays: number = 7
): Promise<UpgradeToTeamResult> {
  return upgradeProToFlatTierTrial(userId, 'business', trialDays);
}

async function upgradeProToFlatTierTrial(
  userId: string,
  targetTier: 'team' | 'business',
  trialDays: number,
): Promise<UpgradeToTeamResult> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Payment system not configured' };
  }

  try {
    const businessSettings = await storage.getBusinessSettings(userId);

    if (!businessSettings?.stripeSubscriptionId) {
      return { success: false, error: 'No active subscription found to upgrade' };
    }

    if (!businessSettings?.stripeCustomerId) {
      return { success: false, error: 'No billing account found' };
    }

    const currentSubscription = await stripe.subscriptions.retrieve(businessSettings.stripeSubscriptionId);

    if (currentSubscription.status !== 'active' && currentSubscription.status !== 'trialing') {
      return { success: false, error: 'Current subscription is not active' };
    }

    const currentTier = currentSubscription.metadata?.tier || 'pro';
    if (currentTier === targetTier) {
      return { success: false, error: `Already on ${targetTier === 'team' ? 'Team' : 'Business'} plan` };
    }

    const newPriceId = targetTier === 'business'
      ? await getOrCreateBusinessPrice(stripe)
      : await getOrCreateTeamPrice(stripe);

    const trialEndTimestamp = Math.floor(Date.now() / 1000) + (trialDays * 24 * 60 * 60);

    // Replace ALL existing items (handles legacy multi-line per-seat subs too)
    // with a single flat-tier line item.
    const itemUpdates: Stripe.SubscriptionUpdateParams.Item[] = currentSubscription.items.data.map(item => ({
      id: item.id,
      deleted: true,
    }));
    itemUpdates.push({ price: newPriceId, quantity: 1 });

    const updatedSubscription = await stripe.subscriptions.update(
      businessSettings.stripeSubscriptionId,
      {
        items: itemUpdates,
        trial_end: trialEndTimestamp,
        proration_behavior: 'none',
        metadata: {
          ...currentSubscription.metadata,
          tier: targetTier,
          upgradedFromPro: 'true',
          upgradeTrialStart: new Date().toISOString(),
        },
      }
    );

    const trialEndsAt = new Date(trialEndTimestamp * 1000);

    await storage.updateUser(userId, {
      subscriptionTier: targetTier,
      trialStatus: 'active',
      trialStartedAt: new Date(),
      trialEndsAt: trialEndsAt,
    });

    const bsUpdate: Record<string, any> = {
      subscriptionTier: targetTier,
      subscriptionStatus: updatedSubscription.status,
      trialStartDate: new Date(),
      trialEndDate: trialEndsAt,
    };
    if (!businessSettings.teamSize || businessSettings.teamSize === 'solo') {
      bsUpdate.teamSize = 'small';
    }
    await storage.updateBusinessSettings(userId, bsUpdate);

    return {
      success: true,
      subscriptionId: updatedSubscription.id,
      trialEndsAt,
    };
  } catch (error: unknown) {
    console.error(`Error upgrading to ${targetTier} trial:`, error);
    return { success: false, error: getErrorMessage(error) || 'Failed to upgrade subscription' };
  }
}

export async function createAiReceptionistCheckout(
  userId: string,
  email: string,
  successUrl: string,
  cancelUrl: string,
  businessName?: string,
): Promise<CheckoutSessionResult> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Payment system not configured' };
  }

  try {
    const customerId = await getOrCreateStripeCustomer(stripe, userId, email, businessName);
    const priceId = await getOrCreateAiReceptionistPrice(stripe);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_collection: 'always',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      subscription_data: {
        metadata: {
          userId,
          type: 'ai_receptionist',
          platform: 'jobrunner',
        },
      },
      metadata: {
        userId,
        type: 'ai_receptionist',
      },
    });

    return {
      success: true,
      sessionId: session.id,
      sessionUrl: session.url || undefined,
    };
  } catch (error: unknown) {
    console.error('Error creating AI Receptionist checkout:', error);
    return { success: false, error: getErrorMessage(error) || 'Failed to create checkout session' };
  }
}

async function getOrCreateAiReceptionistPrice(stripe: Stripe): Promise<string> {
  const prices = await stripe.prices.list({
    lookup_keys: ['jobrunner_ai_receptionist_monthly'],
    active: true,
    limit: 1,
  });

  if (prices.data.length > 0) {
    return prices.data[0].id;
  }

  const products = await stripe.products.list({
    active: true,
    limit: 100,
  });

  let product = products.data.find(
    (p) => p.name === PRICING.addons.aiReceptionist.name && p.active
  );

  if (!product) {
    product = await stripe.products.create({
      name: PRICING.addons.aiReceptionist.name,
      description: PRICING.addons.aiReceptionist.description,
      metadata: {
        platform: 'jobrunner',
        type: 'addon',
        addon: 'ai_receptionist',
      },
    });
  }

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: PRICING.addons.aiReceptionist.monthly,
    currency: 'aud',
    recurring: {
      interval: 'month',
    },
    lookup_key: 'jobrunner_ai_receptionist_monthly',
    metadata: {
      type: 'addon',
      addon: 'ai_receptionist',
    },
  });

  return price.id;
}

export async function createDedicatedNumberCheckout(
  userId: string,
  email: string,
  phoneNumber: string,
  successUrl: string,
  cancelUrl: string,
  businessName?: string,
): Promise<CheckoutSessionResult> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Payment system not configured' };
  }

  try {
    const customerId = await getOrCreateStripeCustomer(stripe, userId, email, businessName);
    const priceId = await getOrCreateDedicatedNumberPrice(stripe);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_collection: 'always',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      subscription_data: {
        metadata: {
          userId,
          type: 'dedicated_number',
          phoneNumber,
          platform: 'jobrunner',
        },
      },
      metadata: {
        userId,
        type: 'dedicated_number',
        phoneNumber,
      },
    });

    return {
      success: true,
      sessionId: session.id,
      sessionUrl: session.url || undefined,
    };
  } catch (error: unknown) {
    console.error('Error creating dedicated number checkout:', error);
    return { success: false, error: getErrorMessage(error) || 'Failed to create checkout session' };
  }
}

async function getOrCreateDedicatedNumberPrice(stripe: Stripe): Promise<string> {
  const prices = await stripe.prices.list({
    lookup_keys: ['jobrunner_dedicated_number_monthly'],
    active: true,
    limit: 1,
  });

  if (prices.data.length > 0) {
    return prices.data[0].id;
  }

  const products = await stripe.products.list({
    active: true,
    limit: 100,
  });

  let product = products.data.find(
    (p) => p.name === PRICING.addons.dedicatedNumber.name && p.active
  );

  if (!product) {
    product = await stripe.products.create({
      name: PRICING.addons.dedicatedNumber.name,
      description: PRICING.addons.dedicatedNumber.description,
      metadata: {
        platform: 'jobrunner',
        type: 'addon',
        addon: 'dedicated_number',
      },
    });
  }

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: PRICING.addons.dedicatedNumber.monthly,
    currency: 'aud',
    recurring: {
      interval: 'month',
    },
    lookup_key: 'jobrunner_dedicated_number_monthly',
    metadata: {
      type: 'addon',
      addon: 'dedicated_number',
    },
  });

  return price.id;
}
