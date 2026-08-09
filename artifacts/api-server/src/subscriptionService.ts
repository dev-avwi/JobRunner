import { storage } from './storage';
import { TIER_LIMITS } from '@workspace/db';

export type SubscriptionTier = 'free' | 'pro' | 'team' | 'trial' | 'beta' | 'business';

export interface UsageStatus {
  tier: SubscriptionTier;
  subscriptionStatus?: string;
  isTrialActive: boolean;
  trialDaysRemaining: number | null;
  usage: {
    jobs: { used: number; limit: number; remaining: number };
    invoices: { used: number; limit: number; remaining: number };
    quotes: { used: number; limit: number; remaining: number };
  };
  canCreate: {
    job: boolean;
    invoice: boolean;
    quote: boolean;
  };
  features: string[];
  upgradeRequired: boolean;
}

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: boolean;
  usage?: { used: number; limit: number };
}

async function getEffectiveTier(user: any, subscriptionStatus?: string): Promise<SubscriptionTier> {
  if (user.betaLifetimeAccess) {
    const stored = user.subscriptionTier as string | undefined;
    if (stored === 'business') return 'business';
    if (stored === 'team') return 'team';
    if (stored === 'pro') return 'pro';
    return 'business';
  }

  let status = subscriptionStatus;
  if (!status) {
    try {
      const settings = await storage.getBusinessSettings(user.id);
      status = settings?.subscriptionStatus || 'none';
    } catch {
      status = 'none';
    }
  }

  if (status === 'past_due' || status === 'canceled' || status === 'unpaid' || status === 'paused') {
    return 'free';
  }

  if (status === 'active' || status === 'trialing') {
    const stored = user.subscriptionTier as string | undefined;
    if (stored === 'business') return 'business';
    if (stored === 'team') return 'team';
    if (stored === 'pro') return 'pro';
    return 'pro';
  }

  if (user.trialStatus === 'active' && user.trialEndsAt && new Date(user.trialEndsAt) > new Date()) {
    const stored = user.subscriptionTier as string | undefined;
    if (stored === 'business') return 'business';
    if (stored === 'team') return 'team';
    return 'pro';
  }

  return 'free';
}

function getTierLimits(tier: SubscriptionTier) {
  if (tier === 'business') {
    return TIER_LIMITS.business || TIER_LIMITS.team;
  }
  if (tier === 'team') {
    return TIER_LIMITS.team;
  }
  if (tier === 'pro' || tier === 'trial') {
    return TIER_LIMITS.pro;
  }
  return TIER_LIMITS.free;
}

export async function getUserUsageStatus(userId: string): Promise<UsageStatus> {
  const user = await storage.getUser(userId);
  if (!user) {
    throw new Error('User not found');
  }

  if (user.betaLifetimeAccess) {
    const businessLimits = TIER_LIMITS.business || TIER_LIMITS.team;
    return {
      tier: 'beta' as SubscriptionTier,
      isTrialActive: false,
      trialDaysRemaining: null,
      usage: {
        jobs: { used: 0, limit: -1, remaining: -1 },
        invoices: { used: 0, limit: -1, remaining: -1 },
        quotes: { used: 0, limit: -1, remaining: -1 },
      },
      canCreate: { job: true, invoice: true, quote: true },
      features: businessLimits.features as unknown as string[],
      upgradeRequired: false,
    };
  }
  
  await resetUsageIfNeeded(userId, user);
  
  const businessSettings = await storage.getBusinessSettings(userId);
  const subscriptionStatus = businessSettings?.subscriptionStatus || 'none';
  const effectiveTier = await getEffectiveTier(user, subscriptionStatus);
  const limits = getTierLimits(effectiveTier);
  
  let trialDaysRemaining: number | null = null;
  let isTrialActive = false;
  
  if (user.trialStatus === 'active' && user.trialEndsAt) {
    const trialEnd = new Date(user.trialEndsAt);
    const now = new Date();
    if (trialEnd > now) {
      isTrialActive = true;
      trialDaysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }
  }
  
  const jobsUsed = user.jobsCreatedThisMonth || 0;
  const invoicesUsed = user.invoicesCreatedThisMonth || 0;
  const quotesUsed = user.quotesCreatedThisMonth || 0;
  
  const jobsLimit = limits.jobsPerMonth;
  const invoicesLimit = limits.invoicesPerMonth;
  const quotesLimit = limits.quotesPerMonth;
  
  const canCreateJob = jobsLimit === -1 || jobsUsed < jobsLimit;
  const canCreateInvoice = invoicesLimit === -1 || invoicesUsed < invoicesLimit;
  const canCreateQuote = quotesLimit === -1 || quotesUsed < quotesLimit;
  
  return {
    tier: (effectiveTier === 'pro' || effectiveTier === 'team') && isTrialActive ? 'trial' : effectiveTier,
    subscriptionStatus: subscriptionStatus || undefined,
    isTrialActive,
    trialDaysRemaining,
    usage: {
      jobs: {
        used: jobsUsed,
        limit: jobsLimit,
        remaining: jobsLimit === -1 ? -1 : Math.max(0, jobsLimit - jobsUsed),
      },
      invoices: {
        used: invoicesUsed,
        limit: invoicesLimit,
        remaining: invoicesLimit === -1 ? -1 : Math.max(0, invoicesLimit - invoicesUsed),
      },
      quotes: {
        used: quotesUsed,
        limit: quotesLimit,
        remaining: quotesLimit === -1 ? -1 : Math.max(0, quotesLimit - quotesUsed),
      },
    },
    canCreate: {
      job: canCreateJob,
      invoice: canCreateInvoice,
      quote: canCreateQuote,
    },
    features: limits.features as unknown as string[],
    upgradeRequired: !canCreateJob || !canCreateInvoice || !canCreateQuote,
  };
}

export async function checkCanCreateJob(userId: string): Promise<LimitCheckResult> {
  const user = await storage.getUser(userId);
  if (!user) {
    return { allowed: false, reason: 'User not found' };
  }

  if (user.betaLifetimeAccess) {
    return { allowed: true };
  }
  
  await resetUsageIfNeeded(userId, user);
  
  const effectiveTier = await getEffectiveTier(user);
  const limits = getTierLimits(effectiveTier);
  
  if (limits.jobsPerMonth === -1) {
    return { allowed: true };
  }
  
  const used = user.jobsCreatedThisMonth || 0;
  if (used >= limits.jobsPerMonth) {
    return {
      allowed: false,
      reason: `You've reached your limit of ${limits.jobsPerMonth} jobs this month. Upgrade to Pro for unlimited jobs.`,
      upgradeRequired: true,
      usage: { used, limit: limits.jobsPerMonth },
    };
  }
  
  return { allowed: true, usage: { used, limit: limits.jobsPerMonth } };
}

export async function checkCanCreateInvoice(userId: string): Promise<LimitCheckResult> {
  const user = await storage.getUser(userId);
  if (!user) {
    return { allowed: false, reason: 'User not found' };
  }

  if (user.betaLifetimeAccess) {
    return { allowed: true };
  }
  
  await resetUsageIfNeeded(userId, user);
  
  const effectiveTier = await getEffectiveTier(user);
  const limits = getTierLimits(effectiveTier);
  
  if (limits.invoicesPerMonth === -1) {
    return { allowed: true };
  }
  
  const used = user.invoicesCreatedThisMonth || 0;
  if (used >= limits.invoicesPerMonth) {
    return {
      allowed: false,
      reason: `You've reached your limit of ${limits.invoicesPerMonth} invoices this month. Upgrade to Pro for unlimited invoices.`,
      upgradeRequired: true,
      usage: { used, limit: limits.invoicesPerMonth },
    };
  }
  
  return { allowed: true, usage: { used, limit: limits.invoicesPerMonth } };
}

export async function checkCanCreateQuote(userId: string): Promise<LimitCheckResult> {
  const user = await storage.getUser(userId);
  if (!user) {
    return { allowed: false, reason: 'User not found' };
  }

  if (user.betaLifetimeAccess) {
    return { allowed: true };
  }
  
  await resetUsageIfNeeded(userId, user);
  
  const effectiveTier = await getEffectiveTier(user);
  const limits = getTierLimits(effectiveTier);
  
  if (limits.quotesPerMonth === -1) {
    return { allowed: true };
  }
  
  const used = user.quotesCreatedThisMonth || 0;
  if (used >= limits.quotesPerMonth) {
    return {
      allowed: false,
      reason: `You've reached your limit of ${limits.quotesPerMonth} quotes this month. Upgrade to Pro for unlimited quotes.`,
      upgradeRequired: true,
      usage: { used, limit: limits.quotesPerMonth },
    };
  }
  
  return { allowed: true, usage: { used, limit: limits.quotesPerMonth } };
}

export async function incrementJobUsage(userId: string): Promise<void> {
  await storage.incrementUserUsage(userId, 'jobs');
}

export async function incrementInvoiceUsage(userId: string): Promise<void> {
  await storage.incrementUserUsage(userId, 'invoices');
}

export async function incrementQuoteUsage(userId: string): Promise<void> {
  await storage.incrementUserUsage(userId, 'quotes');
}

async function resetUsageIfNeeded(userId: string, user: any): Promise<void> {
  const resetDate = user.usageResetDate ? new Date(user.usageResetDate) : null;
  const now = new Date();
  
  if (!resetDate || (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear())) {
    await storage.resetUserUsage(userId);
  }
}

export async function startTrial(userId: string, tier?: 'pro' | 'team'): Promise<{ success: boolean; endsAt?: Date; tier?: string; error?: string }> {
  const user = await storage.getUser(userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }
  
  if (user.subscriptionTier === 'pro' || user.subscriptionTier === 'team') {
    return { success: false, error: 'Already subscribed to a paid tier' };
  }
  
  if (user.trialStatus === 'active' || user.trialStatus === 'expired' || user.trialStatus === 'converted') {
    return { success: false, error: 'Trial already used' };
  }
  
  // Determine trial tier: explicit param > user's intendedTier > default to 'pro'
  // Whitelist the requested tier — never trust a client-supplied tier that could
  // grant a higher plan (e.g. 'business') for free during the trial.
  const requestedTier = tier === 'pro' || tier === 'team' ? tier : undefined;
  const trialTier = requestedTier || (user.intendedTier === 'team' ? 'team' : 'pro');
  
  const now = new Date();
  const endsAt = new Date(now.getTime() + (TIER_LIMITS.trial.durationDays * 24 * 60 * 60 * 1000));
  
  await storage.updateUser(userId, {
    subscriptionTier: trialTier, // Set tier to pro/team during trial
    trialStartedAt: now,
    trialEndsAt: endsAt,
    trialStatus: 'active',
  });
  
  if (trialTier === 'team') {
    const bs = await storage.getBusinessSettings(userId);
    if (bs && (!bs.teamSize || bs.teamSize === 'solo')) {
      await storage.updateBusinessSettings(userId, { teamSize: 'small' });
    }
  }
  
  return { success: true, endsAt, tier: trialTier };
}

export async function checkAndExpireTrials(): Promise<number> {
  const usersWithActiveTrial = await storage.getUsersWithActiveTrial();
  let expiredCount = 0;
  
  const now = new Date();
  for (const user of usersWithActiveTrial) {
    if (user.trialEndsAt && new Date(user.trialEndsAt) <= now) {
      await storage.updateUser(user.id, {
        subscriptionTier: 'free', // Downgrade to free when trial expires
        trialStatus: 'expired',
      });
      expiredCount++;
    }
  }
  
  return expiredCount;
}

export async function upgradeToPro(userId: string): Promise<{ success: boolean; error?: string }> {
  const user = await storage.getUser(userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }
  
  await storage.updateUser(userId, {
    subscriptionTier: 'pro',
    trialStatus: user.trialStatus === 'active' ? 'converted' : user.trialStatus,
  });
  
  return { success: true };
}

export async function downgradeToFree(userId: string): Promise<{ success: boolean; error?: string }> {
  const user = await storage.getUser(userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }
  
  await storage.updateUser(userId, {
    subscriptionTier: 'free',
  });
  
  return { success: true };
}

export function hasFeature(features: string[], feature: string): boolean {
  return features.includes(feature);
}
