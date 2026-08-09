import { storage, db } from "./storage";
import { sql } from "drizzle-orm";

// Beta mode - flipped to false: paid Stripe checkout flow now active for all new signups.
// Founding Member / lifetime access is granted manually via the Admin Dashboard.
export const IS_BETA = false;

// Beta configuration
// NOTE: maxLifetimeUsers set to 0 to prevent new signups (including Apple App Review
// sandbox testers) from being auto-granted Founding Member / lifetime access. Without
// this, fresh reviewer accounts get free Pro Lifetime instantly and can never test the
// IAP flow — which caused App Store rejection 2.1.0 in April 2026.
// To grant lifetime access to a real founding member, do it manually via the Admin
// Dashboard (toggle Founding Member on the user's profile).
export const BETA_CONFIG = {
  maxLifetimeUsers: 0,
  requiresTestimonialConsent: true,
  betaEndDate: null as Date | null, // Set to a date to auto-end beta
};

/**
 * Count business owner signups (excluding demo account and team member accounts).
 * A "business owner" is a user who is NOT referenced as a memberId in team_members.
 */
export async function getBetaBusinessCount(): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(DISTINCT u.id) as count
    FROM users u
    WHERE u.email != 'demo@jobrunner.com.au'
    AND u.id NOT IN (
      SELECT tm.member_id FROM team_members tm WHERE tm.invite_status = 'accepted'
    )
  `);
  const rows = result.rows || result;
  return parseInt(String((rows as any[])[0]?.count || '0'), 10);
}

/**
 * Get the next beta cohort number for a new business owner.
 */
export async function getNextBetaCohortNumber(): Promise<number> {
  const result = await db.execute(sql`
    SELECT COALESCE(MAX(beta_cohort_number), 0) + 1 as next_number FROM users
  `);
  const rows = result.rows || result;
  return parseInt(String((rows as any[])[0]?.next_number || '1'), 10);
}

/**
 * Assign beta cohort number and lifetime access to a newly registered business owner.
 * Should be called right after createUser for non-team-member signups.
 */
export async function assignBetaCohort(userId: string): Promise<{ cohortNumber: number; lifetimeAccess: boolean }> {
  const cohortNumber = await getNextBetaCohortNumber();
  const lifetimeAccess = cohortNumber <= BETA_CONFIG.maxLifetimeUsers;

  await storage.updateUser(userId, {
    betaUser: true,
    betaCohortNumber: cohortNumber,
    betaLifetimeAccess: lifetimeAccess,
  } as any);

  console.log(`[Beta] Assigned cohort #${cohortNumber} to user ${userId}. Lifetime access: ${lifetimeAccess}`);
  return { cohortNumber, lifetimeAccess };
}

/**
 * Reconcile beta lifetime access on startup.
 * Grants lifetime access to any beta user whose cohort number is within the limit
 * but doesn't yet have the flag set (e.g. if maxLifetimeUsers was increased).
 */
export async function reconcileBetaLifetimeAccess(): Promise<void> {
  try {
    const result = await db.execute(sql`
      UPDATE users 
      SET beta_lifetime_access = true 
      WHERE beta_user = true 
      AND beta_cohort_number IS NOT NULL 
      AND beta_cohort_number <= ${BETA_CONFIG.maxLifetimeUsers}
      AND (beta_lifetime_access IS NULL OR beta_lifetime_access = false)
      RETURNING email, beta_cohort_number
    `);
    const rows = (result.rows || result) as any[];
    if (rows.length > 0) {
      rows.forEach((r: any) => {
        console.log(`[Beta] Granted lifetime access to ${r.email} (cohort #${r.beta_cohort_number})`);
      });
      console.log(`[Beta] Reconciled ${rows.length} user(s) with lifetime access`);
    }
  } catch (error) {
    console.error('[Beta] Error reconciling lifetime access:', error);
  }
}

/**
 * Grandfather ALL existing accounts with lifetime free access.
 * Call this BEFORE flipping IS_BETA to false.
 * Marks every existing user (except demo/visitor) as a beta user with lifetime access,
 * and upgrades their subscription tier to 'pro' so all features remain unlocked.
 */
export async function grandfatherAllExistingAccounts(): Promise<{ count: number }> {
  try {
    const result = await db.execute(sql`
      UPDATE users 
      SET beta_user = true,
          beta_lifetime_access = true,
          subscription_tier = CASE 
            WHEN subscription_tier IS NULL OR subscription_tier = 'free' THEN 'pro'
            ELSE subscription_tier
          END
      WHERE email NOT IN ('demo@jobrunner.com.au', 'visitor@jobrunner.com.au')
      AND (beta_lifetime_access IS NULL OR beta_lifetime_access = false)
      RETURNING email
    `);
    const rows = (result.rows || result) as any[];
    rows.forEach((r: any) => {
      console.log(`[Beta] Grandfathered lifetime access for ${r.email}`);
    });
    console.log(`[Beta] Grandfathered ${rows.length} account(s) with lifetime free access`);
    return { count: rows.length };
  } catch (error) {
    console.error('[Beta] Error grandfathering accounts:', error);
    return { count: 0 };
  }
}

/**
 * Check if a user has beta lifetime access (survives IS_BETA being turned off).
 */
export async function hasBetaLifetimeAccess(userId: string): Promise<boolean> {
  const user = await storage.getUserById(userId);
  return user?.betaLifetimeAccess === true;
}

export interface FreemiumLimits {
  jobsPerMonth: number;
  invoicesPerMonth: number;
  quotesPerMonth: number;
  maxClients: number;
  maxTemplates: number;
  canUploadLogo: boolean;
  canCustomizeBranding: boolean;
  canAddTeamMembers: boolean;
  canUseAIFeatures: boolean;
}

export interface FullUsageInfo {
  jobs: { used: number; limit: number; remaining: number };
  invoices: { used: number; limit: number; remaining: number };
  quotes: { used: number; limit: number; remaining: number };
  clients: { used: number; limit: number; remaining: number };
  templates: { used: number; limit: number; remaining: number };
  isUnlimited: boolean;
}

export interface UsageCounts {
  jobsCreatedThisMonth: number;
  remainingJobs: number;
  subscriptionTier: 'free' | 'pro' | 'team' | 'business';
  canCreateJob: boolean;
  nextResetDate: Date;
}

// Define subscription tier limits - matches TIER_LIMITS in shared/schema.ts
export const SUBSCRIPTION_LIMITS: Record<string, FreemiumLimits> = {
  free: {
    jobsPerMonth: 25,
    invoicesPerMonth: 25,
    quotesPerMonth: -1, // unlimited quotes - key sales tool
    maxClients: 50,
    maxTemplates: 5,
    canUploadLogo: false,
    canCustomizeBranding: false,
    canAddTeamMembers: false,
    canUseAIFeatures: false,
  },
  pro: {
    jobsPerMonth: -1, // unlimited
    invoicesPerMonth: -1,
    quotesPerMonth: -1,
    maxClients: -1,
    maxTemplates: -1,
    canUploadLogo: true,
    canCustomizeBranding: true,
    canAddTeamMembers: false,
    canUseAIFeatures: true,
  },
  business: {
    jobsPerMonth: -1, // unlimited
    invoicesPerMonth: -1,
    quotesPerMonth: -1,
    maxClients: -1,
    maxTemplates: -1,
    canUploadLogo: true,
    canCustomizeBranding: true,
    canAddTeamMembers: true,
    canUseAIFeatures: true,
  },
  team: {
    jobsPerMonth: -1, // unlimited
    invoicesPerMonth: -1,
    quotesPerMonth: -1,
    maxClients: -1,
    maxTemplates: -1,
    canUploadLogo: true,
    canCustomizeBranding: true,
    canAddTeamMembers: true,
    canUseAIFeatures: true,
  },
};

export class FreemiumService {
  /**
   * Check if user can create a new job based on their subscription limits
   */
  static async canUserCreateJob(userId: string): Promise<{ canCreate: boolean; reason?: string; usageInfo: UsageCounts }> {
    try {
      const user = await storage.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const usageInfo = await this.getUserUsageCounts(userId);
      
      // Beta mode: all users get unlimited access
      if (IS_BETA || user.betaLifetimeAccess) {
        return {
          canCreate: true,
          usageInfo: {
            ...usageInfo,
            canCreateJob: true
          }
        };
      }

      // If user is on pro, business, or team plan, they have unlimited jobs
      if (user.subscriptionTier === 'pro' || user.subscriptionTier === 'business' || user.subscriptionTier === 'team') {
        return {
          canCreate: true,
          usageInfo: {
            ...usageInfo,
            canCreateJob: true
          }
        };
      }

      // For free users, check if they've exceeded their monthly limit
      const limits = SUBSCRIPTION_LIMITS[user.subscriptionTier || 'free'];
      const hasExceededLimit = usageInfo.jobsCreatedThisMonth >= limits.jobsPerMonth;

      if (hasExceededLimit) {
        return {
          canCreate: false,
          reason: `You've reached your monthly limit of ${limits.jobsPerMonth} jobs. Upgrade to Pro for unlimited jobs!`,
          usageInfo: {
            ...usageInfo,
            canCreateJob: false
          }
        };
      }

      return {
        canCreate: true,
        usageInfo: {
          ...usageInfo,
          canCreateJob: true
        }
      };

    } catch (error) {
      console.error('Error checking job creation limits:', error);
      return {
        canCreate: false,
        reason: 'Unable to verify subscription limits',
        usageInfo: {
          jobsCreatedThisMonth: 0,
          remainingJobs: 0,
          subscriptionTier: 'free',
          canCreateJob: false,
          nextResetDate: new Date()
        }
      };
    }
  }

  /**
   * Get current usage counts for a user
   */
  static async getUserUsageCounts(userId: string): Promise<UsageCounts> {
    try {
      const user = await storage.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const now = new Date();
      const subscriptionTier = user.subscriptionTier || 'free';
      const limits = SUBSCRIPTION_LIMITS[subscriptionTier];

      // Count jobs created this month directly from the DB so enforcement matches
      // the usage display (the stored counter can drift / miss creation paths).
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const jobs = await storage.getJobs(userId);
      const jobsCreatedThisMonth = jobs.filter((j: any) =>
        j.createdAt && new Date(j.createdAt) >= startOfMonth
      ).length;
      const remainingJobs = limits.jobsPerMonth === -1 ? -1 : Math.max(0, limits.jobsPerMonth - jobsCreatedThisMonth);
      const canCreateJob = limits.jobsPerMonth === -1 || jobsCreatedThisMonth < limits.jobsPerMonth;

      // Calculate next reset date (first day of next month)
      const nextResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      return {
        jobsCreatedThisMonth,
        remainingJobs,
        subscriptionTier: subscriptionTier as 'free' | 'pro' | 'business',
        canCreateJob,
        nextResetDate,
      };

    } catch (error) {
      console.error('Error getting usage counts:', error);
      // Return safe defaults
      return {
        jobsCreatedThisMonth: 0,
        remainingJobs: 5,
        subscriptionTier: 'free',
        canCreateJob: true,
        nextResetDate: new Date(),
      };
    }
  }

  /**
   * Increment job count after successful job creation
   */
  static async incrementJobCount(userId: string): Promise<void> {
    try {
      const user = await storage.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Only increment for free users (pro/business have unlimited)
      if (user.subscriptionTier === 'free' || !user.subscriptionTier) {
        const currentCount = user.jobsCreatedThisMonth || 0;
        await storage.updateUserJobCount(userId, currentCount + 1);
      }

    } catch (error) {
      console.error('Error incrementing job count:', error);
      // Don't throw here - job creation should still succeed even if count fails to update
    }
  }

  /**
   * Reset monthly job count if we're in a new month
   */
  static async maybeResetMonthlyCount(userId: string): Promise<void> {
    try {
      const user = await storage.getUserById(userId);
      if (!user) {
        return;
      }

      const now = new Date();
      const resetDate = user.subscriptionResetDate;

      // If no reset date set, or it's past the reset date, reset the count
      if (!resetDate || now >= resetDate) {
        // Calculate next reset date (first day of next month)
        const nextResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        
        // Reset count and update reset date
        await storage.resetUserJobCount(userId, nextResetDate);
      }

    } catch (error) {
      console.error('Error resetting monthly count:', error);
    }
  }

  /**
   * Get subscription limits for a tier
   */
  static getSubscriptionLimits(tier: string): FreemiumLimits {
    return SUBSCRIPTION_LIMITS[tier] || SUBSCRIPTION_LIMITS.free;
  }

  /**
   * Check if user can access a specific feature
   */
  static async canUserAccessFeature(userId: string, feature: keyof FreemiumLimits): Promise<boolean> {
    // Beta mode: all features unlocked
    if (IS_BETA) {
      return true;
    }

    try {
      const user = await storage.getUserById(userId);
      if (!user) {
        return false;
      }

      // Beta lifetime users keep full access forever
      if (user.betaLifetimeAccess) {
        return true;
      }

      const tier = user.subscriptionTier || 'free';
      const limits = SUBSCRIPTION_LIMITS[tier];
      return limits[feature] === true || limits[feature] === -1;

    } catch (error) {
      console.error('Error checking feature access:', error);
      return false;
    }
  }

  /**
   * Check if a free-tier user is allowed to create a new client. Paid tiers
   * (pro/team/business), beta lifetime users, and beta mode get unlimited
   * clients. Free users are capped at SUBSCRIPTION_LIMITS.free.maxClients.
   */
  static async canUserCreateClient(userId: string): Promise<{ canCreate: boolean; reason?: string; current?: number; limit?: number }> {
    try {
      const user = await storage.getUserById(userId);
      if (!user) {
        return { canCreate: false, reason: 'User not found' };
      }

      if (IS_BETA || user.betaLifetimeAccess) {
        return { canCreate: true };
      }

      const tier = user.subscriptionTier || 'free';
      if (tier === 'pro' || tier === 'team' || tier === 'business') {
        return { canCreate: true };
      }

      const limits = SUBSCRIPTION_LIMITS[tier];
      const maxClients = limits.maxClients;
      if (maxClients === -1) {
        return { canCreate: true };
      }

      const clients = await storage.getClients(userId);
      const current = clients.length;
      if (current >= maxClients) {
        return {
          canCreate: false,
          reason: `You've reached the free-tier limit of ${maxClients} clients. Upgrade to Pro for unlimited clients.`,
          current,
          limit: maxClients,
        };
      }

      return { canCreate: true, current, limit: maxClients };
    } catch (error) {
      console.error('Error checking client creation limit:', error);
      // Fail open so a transient DB hiccup doesn't block client creation —
      // the limit is a soft monetization guardrail, not a security boundary.
      return { canCreate: true };
    }
  }

  /**
   * Get full usage information for billing display
   */
  static async getFullUsageInfo(userId: string): Promise<FullUsageInfo> {
    // Beta mode or beta lifetime users: everything is unlimited
    if (IS_BETA) {
      return {
        jobs: { used: 0, limit: -1, remaining: -1 },
        invoices: { used: 0, limit: -1, remaining: -1 },
        quotes: { used: 0, limit: -1, remaining: -1 },
        clients: { used: 0, limit: -1, remaining: -1 },
        templates: { used: 0, limit: -1, remaining: -1 },
        isUnlimited: true
      };
    }

    try {
      const user = await storage.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Beta lifetime users get unlimited access forever
      if (user.betaLifetimeAccess) {
        return {
          jobs: { used: 0, limit: -1, remaining: -1 },
          invoices: { used: 0, limit: -1, remaining: -1 },
          quotes: { used: 0, limit: -1, remaining: -1 },
          clients: { used: 0, limit: -1, remaining: -1 },
          templates: { used: 0, limit: -1, remaining: -1 },
          isUnlimited: true
        };
      }

      const tier = user.subscriptionTier || 'free';
      const limits = SUBSCRIPTION_LIMITS[tier];
      const isUnlimited = tier === 'pro' || tier === 'team' || tier === 'business';

      // Get actual counts from database
      const jobs = await storage.getJobs(userId);
      const invoices = await storage.getInvoices(userId);
      const quotes = await storage.getQuotes(userId);
      const clients = await storage.getClients(userId);
      const templates = await storage.getDocumentTemplates(userId);

      // For monthly counts, count this month's creations directly from the DB
      // so usage always matches the actual records (counter fields can drift and
      // aren't incremented by demo/sample data or every creation path).
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const jobsUsed = jobs.filter((j: any) =>
        j.createdAt && new Date(j.createdAt) >= startOfMonth
      ).length;

      const invoicesThisMonth = invoices.filter((i: any) => 
        i.createdAt && new Date(i.createdAt) >= startOfMonth
      ).length;
      
      const quotesThisMonth = quotes.filter((q: any) => 
        q.createdAt && new Date(q.createdAt) >= startOfMonth
      ).length;

      const calcRemaining = (used: number, limit: number) => 
        limit === -1 ? -1 : Math.max(0, limit - used);

      return {
        jobs: {
          used: jobsUsed,
          limit: limits.jobsPerMonth,
          remaining: calcRemaining(jobsUsed, limits.jobsPerMonth)
        },
        invoices: {
          used: invoicesThisMonth,
          limit: limits.invoicesPerMonth,
          remaining: calcRemaining(invoicesThisMonth, limits.invoicesPerMonth)
        },
        quotes: {
          used: quotesThisMonth,
          limit: limits.quotesPerMonth,
          remaining: calcRemaining(quotesThisMonth, limits.quotesPerMonth)
        },
        clients: {
          used: clients.length,
          limit: limits.maxClients,
          remaining: calcRemaining(clients.length, limits.maxClients)
        },
        templates: {
          used: templates.length,
          limit: limits.maxTemplates,
          remaining: calcRemaining(templates.length, limits.maxTemplates)
        },
        isUnlimited
      };

    } catch (error) {
      console.error('Error getting full usage info:', error);
      // Return safe defaults
      return {
        jobs: { used: 0, limit: 5, remaining: 5 },
        invoices: { used: 0, limit: 5, remaining: 5 },
        quotes: { used: 0, limit: 10, remaining: 10 },
        clients: { used: 0, limit: 10, remaining: 10 },
        templates: { used: 0, limit: 3, remaining: 3 },
        isUnlimited: false
      };
    }
  }
}