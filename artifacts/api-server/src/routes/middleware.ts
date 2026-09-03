import * as Sentry from "@sentry/node";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { db } from "../storage";
import { storage } from "../storage";
import { sql } from "drizzle-orm";
import { AuthService } from "../auth";
import { getUserContext, requireOnboarding } from "../permissions";
import { IS_BETA } from "../freemiumService";
import { logger } from "../logger";

const isDevelopment = process.env.NODE_ENV !== 'production';

// Demo account is bypassed so a hostile visitor can't lock the "Try the Demo"
// button for everyone by spamming wrong passwords.
const isDemoLoginAttempt = (req: any): boolean => {
  const email = (req.body?.email || '').toString().toLowerCase().trim();
  return email === 'demo@jobrunner.com.au';
};

// Login: keyed by email+IP so one hostile IP can't lock out a victim by
// flooding their email, and one user behind CGNAT can't lock the whole NAT.
// Generous on success (we only count failures via skipSuccessfulRequests).
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req: any) => {
    const email = (req.body?.email || '').toString().toLowerCase().trim();
    const ip = ipKeyGenerator(req.ip || '', 56);
    return email ? `login:${email}:${ip}` : `login::${ip}`;
  },
  skip: isDemoLoginAttempt,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Registration: per-IP cap to stop bot signup floods, but high enough that
// a small office NAT (~20 staff signing up) doesn't get blocked.
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req: any) => ipKeyGenerator(req.ip || '', 56),
  message: { error: 'Too many sign-up attempts from this network. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Email/token verification: cheap server work but worth limiting to blunt
// token brute-forcing. Demo account exempted.
export const verifyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req: any) => ipKeyGenerator(req.ip || '', 56),
  skip: isDemoLoginAttempt,
  message: { error: 'Too many verification attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Back-compat alias — existing routes still import `authRateLimiter`. Routes
// migrate to the specific limiter above as we touch them; meanwhile this
// keeps a sensible default that won't lock the demo account.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req: any) => ipKeyGenerator(req.ip || '', 56),
  skip: isDemoLoginAttempt,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many password reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const paymentRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many payment requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const messageSendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many messages sent. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: any) => {
    const p = req.path || '';
    return p.startsWith('/assets') || p.startsWith('/public')
      || p === '/api/health' || p === '/health'
      || p === '/api/metrics' || p === '/metrics';
  },
});

// Per-user keyed limiters for heavy endpoints. These are *additive* on top of
// the IP-based generalApiLimiter and exist to prevent a single authenticated
// user from monopolising scarce server resources (Puppeteer slots, OpenAI
// quota, Twilio media, etc).
const perUserKey = (req: any, res: any) => {
  const id = req.userId || req.session?.userId;
  if (id) return `u:${id}`;
  // Fall back to IPv6-safe IP key when unauthenticated.
  return ipKeyGenerator(req.ip || '', 56);
};

export const pdfPerUserLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: perUserKey,
  message: { error: 'Too many PDF generations. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const aiPerUserLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: perUserKey,
  message: { error: 'Too many AI requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Per-user (not per-IP) limiter for authenticated send endpoints that contact an
// arbitrary recipient (e.g. tap-to-pay receipts to a customer-entered address).
// Per-user keying avoids falsely throttling multiple workers behind one office IP.
export const messagePerUserLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: perUserKey,
  message: { error: 'Too many messages sent. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const visionPerUserLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: perUserKey,
  message: { error: 'Too many image-analysis requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const photoUploadPerUserLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: perUserKey,
  message: { error: 'Too many photo uploads. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const transcribePerUserLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  keyGenerator: perUserKey,
  message: { error: 'Too many transcription requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Task #91: per-IP rate limit for inbound provider webhooks (QBO/Xero/etc).
// Webhooks are unauthenticated by design (we verify HMAC inside the handler),
// so we key by IP — keeping the bound generous since legitimate batches can
// burst, but tight enough to blunt brute-force signature guessing or abuse.
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req: any) => ipKeyGenerator(req.ip || '', 56),
  message: { error: 'Too many webhook requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Express error-handling middleware that converts a `BackpressureError`
 * thrown anywhere in the request lifecycle into a polite HTTP 429 with a
 * `Retry-After` header so callers (web + mobile) can back off gracefully.
 */
export function backpressureErrorHandler(
  err: any,
  _req: any,
  res: any,
  next: any,
) {
  if (err && err.name === 'BackpressureError') {
    const retryAfter = Math.max(1, Math.min(60, err.retryAfterSec || 5));
    if (!res.headersSent) {
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: err.message,
        type: 'BACKPRESSURE',
        retryAfter,
      });
    }
  }
  return next(err);
}

// ============================================================================
// Activity tracking (week-1 retention)
// ----------------------------------------------------------------------------
// Records at most ONE "active day" per user per local day, for BOTH the web
// app and the mobile app, with no client SDK. It hooks res.finish so it runs
// AFTER requireAuth has populated req.userId, then upserts a daily-activity
// row. Background/sync/polling/health/location traffic is excluded so an
// "active day" reflects a real human action rather than automated noise.
// ============================================================================

const BUSINESS_TZ = 'Australia/Sydney';

/** Calendar date (YYYY-MM-DD) in the business timezone for the given instant. */
export function businessLocalDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

// Path prefixes that represent background/automated traffic (sync, polling,
// health checks, location pings, push registration) — NOT a human action.
const ACTIVITY_EXCLUDED_PREFIXES = [
  '/api/health',
  '/api/metrics',
  '/api/auth/me', // app boot / session poll
  '/api/notifications', // notification + unread-count polling
  '/api/team/presence', // presence heartbeat polling
  '/api/location',
  '/api/location-tracking',
  '/api/tracking',
  '/api/tradie-status',
  '/api/geofence', // geofence event/alert pings
  '/api/sync',
  '/api/offline',
  '/api/push',
  '/api/push-tokens',
];

// In-memory dedup so we touch the DB at most once per user per day.
let activityDayKey = '';
let recordedToday = new Set<string>();

export async function recordUserActivity(userId: string, day: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO user_activity (user_id, activity_date)
    VALUES (${userId}, ${day})
    ON CONFLICT (user_id, activity_date) DO NOTHING
  `);
}

export function activityTrackingMiddleware(req: any, res: any, next: any) {
  if (!req.path?.startsWith('/api')) return next();
  res.on('finish', () => {
    try {
      const userId = req.userId; // set by requireAuth before the response finishes
      if (!userId) return;
      // Only count successful, intentional human actions.
      if (res.statusCode < 200 || res.statusCode >= 400) return;
      if (req.method === 'OPTIONS' || req.method === 'HEAD') return;
      const path = (req.originalUrl || req.path || '').split('?')[0];
      if (ACTIVITY_EXCLUDED_PREFIXES.some((p) => path.startsWith(p))) return;

      const today = businessLocalDate();
      if (today !== activityDayKey) {
        activityDayKey = today;
        recordedToday = new Set();
      }
      const dedupKey = `${userId}:${today}`;
      if (recordedToday.has(dedupKey)) return;
      recordedToday.add(dedupKey);

      // Fire-and-forget — never block or fail the response on this.
      recordUserActivity(userId, today).catch(() => {
        // Allow a later request today to retry the write.
        recordedToday.delete(dedupKey);
      });
    } catch {
      // never let activity tracking affect the request
    }
  });
  next();
}

/**
 * One-time idempotent backfill: seed every existing user's signup day as their
 * day-0 activity so retention cohorts are populated from the start. Safe to run
 * on every boot (ON CONFLICT DO NOTHING).
 */
export async function backfillSignupDayActivity(): Promise<void> {
  await db.execute(sql`
    INSERT INTO user_activity (user_id, activity_date)
    SELECT id, (created_at AT TIME ZONE ${BUSINESS_TZ})::date
    FROM users
    WHERE created_at IS NOT NULL
    ON CONFLICT (user_id, activity_date) DO NOTHING
  `);
}

/**
 * One-time idempotent backfill: grant the Leads / Communications / Action Centre
 * permission keys (view_leads, view_communications, view_action_center) to
 * existing manager / admin / supervisor / office-admin role rows that predate
 * those keys being added to the role presets.
 *
 * WHY: the mobile menu shows Leads, Communications and the Action Centre to any
 * role that normalises to "manager" (name contains manager/admin/supervisor) or
 * "office_admin" via the `allowedRoles` gate — independently of whether the role
 * actually carries the new permission keys. Now that the underlying API routes
 * (/api/leads*, /api/bi/action-center and the communications reads) are gated by
 * createPermissionMiddleware, a manager/office-admin whose stored role row was
 * created BEFORE the keys were added to the presets would keep seeing the menu
 * but get a 403 from the API — i.e. lose access (violating the "no removal"
 * rule). This backfill closes that gap so enforcement is additive.
 *
 * It is purely ADDITIVE and idempotent:
 *  - only rows whose name maps to a role the menu already exposes are touched;
 *  - plain worker / staff / subcontractor rows are left untouched, so they
 *    correctly start receiving 403s (the intended enforcement);
 *  - the granular keys are appended without removing any existing permission,
 *    and rows that already carry all three (or the "*" wildcard) are skipped.
 *
 * Granular keys (view_*) are stored rather than the coarse read_* the route
 * middleware checks because (a) the presets store the granular vocabulary and
 * (b) expandPermissions() bridges granular -> coarse at request time, while the
 * mobile UI reads the raw granular strings off /api/team/my-role.
 */
export async function backfillFeaturePermissions(): Promise<void> {
  // user_roles: grant to manager / admin / supervisor / office-admin role rows.
  await db.execute(sql`
    UPDATE user_roles
    SET permissions = (
      SELECT to_jsonb(array_agg(DISTINCT elem))
      FROM (
        SELECT jsonb_array_elements_text(COALESCE(permissions::jsonb, '[]'::jsonb)) AS elem
        UNION
        SELECT unnest(ARRAY['view_leads', 'view_communications', 'view_action_center']) AS elem
      ) AS merged
    )::json
    WHERE (
      LOWER(name) LIKE '%manager%'
      OR LOWER(name) LIKE '%admin%'
      OR LOWER(name) LIKE '%supervisor%'
      OR LOWER(name) LIKE '%office%'
    )
    AND NOT COALESCE(permissions::jsonb, '[]'::jsonb) @> '"*"'::jsonb
    AND NOT COALESCE(permissions::jsonb, '[]'::jsonb)
      @> '["view_leads","view_communications","view_action_center"]'::jsonb
  `);

  // team_members: members with a custom permission override whose ROLE name maps
  // to manager/office-admin level. The menu still exposes the items to these
  // members by role name, so their custom set must carry the keys too.
  await db.execute(sql`
    UPDATE team_members tm
    SET custom_permissions = (
      SELECT to_jsonb(array_agg(DISTINCT elem))
      FROM (
        SELECT jsonb_array_elements_text(COALESCE(tm.custom_permissions::jsonb, '[]'::jsonb)) AS elem
        UNION
        SELECT unnest(ARRAY['view_leads', 'view_communications', 'view_action_center']) AS elem
      ) AS merged
    )::json
    FROM user_roles ur
    WHERE tm.role_id = ur.id
    AND tm.use_custom_permissions = true
    AND tm.custom_permissions IS NOT NULL
    AND (
      LOWER(ur.name) LIKE '%manager%'
      OR LOWER(ur.name) LIKE '%admin%'
      OR LOWER(ur.name) LIKE '%supervisor%'
      OR LOWER(ur.name) LIKE '%office%'
    )
    AND NOT COALESCE(tm.custom_permissions::jsonb, '[]'::jsonb) @> '"*"'::jsonb
    AND NOT COALESCE(tm.custom_permissions::jsonb, '[]'::jsonb)
      @> '["view_leads","view_communications","view_action_center"]'::jsonb
  `);
}

export const requireAuth = async (req: any, res: any, next: any) => {
  let userId = req.session?.userId;
  let isDemoSession = req.session?.isDemo === true;
  let demoDataUserId = req.session?.demoDataUserId;

  if (!userId) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const sessionToken = authHeader.substring(7);
      try {
        const result = await db.execute(
          sql`SELECT sess FROM session WHERE sid = ${sessionToken} AND expire > NOW()`
        );
        if (result.rows && result.rows.length > 0) {
          const sessionData = result.rows[0].sess as any;
          userId = sessionData?.userId;
          isDemoSession = sessionData?.isDemo === true;
          demoDataUserId = sessionData?.demoDataUserId;
        }
      } catch (err) {
        console.error('Session token lookup error:', err);
      }
    }
  }

  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (req.session?.impersonating && req.session?.impersonationExpiresAt) {
    if (Date.now() > req.session.impersonationExpiresAt) {
      const adminId = req.session.originalAdminUserId;
      req.session.userId = adminId;
      delete req.session.impersonating;
      delete req.session.originalAdminUserId;
      delete req.session.impersonationExpiresAt;
      await new Promise<void>((resolve) => {
        req.session.save(() => resolve());
      });
      userId = adminId;
    }
  }

  const effectiveUserId = (isDemoSession && demoDataUserId) ? demoDataUserId : userId;
  const user = await AuthService.getUserById(effectiveUserId);
  if (!user) {
    if (req.session) {
      req.session.destroy(() => {});
    }
    return res.status(401).json({ error: "User not found" });
  }

  req.userId = user.id;
  req.user = user;
  req.isDemo = isDemoSession;

  Sentry.setUser({
    id: String(user.id),
    email: user.email || undefined,
    username: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
  });

  // Demo sessions are read-only. Any state-changing method is rejected here so
  // the restriction is enforced at the server boundary regardless of which
  // route or client makes the request.
  //
  // Paths listed here are explicitly safe for demo users: they call external
  // services (AI) or record non-destructive signals (feedback) but do NOT
  // write or mutate any business-owned data.
  const DEMO_ALLOWED_WRITES = new Set([
    '/api/help/chat',
    '/api/help/articles',
  ]);
  const isDemoAllowedPath = DEMO_ALLOWED_WRITES.has(req.path) ||
    req.path.startsWith('/api/help/articles/') && req.path.endsWith('/feedback');

  if (isDemoSession && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !isDemoAllowedPath) {
    return res.status(403).json({
      error: 'Demo sessions are read-only. Sign up for a free account to make changes.',
    });
  }

  next();
};

// ── Single source of truth for active-trial detection ────────────────────────
// startTrial() stores the trial tier as 'pro' or 'team' (not the string
// 'trial') and sets trialStatus:'active' + trialEndsAt. An active trial
// grants full team-level access so users can actually try every paid feature.
// All three paid-feature gates and the /api/subscription/usage response use
// this helper so the entitlement decision is never split across the codebase.
export function isActiveTrialUser(user: any): boolean {
  const trialStatus = user?.trialStatus as string | undefined;
  const trialEndsAt = user?.trialEndsAt as Date | string | null | undefined;
  return (
    trialStatus === 'active' &&
    !!trialEndsAt &&
    new Date(trialEndsAt) > new Date()
  );
}

export const requireProSubscription = async (req: any, res: any, next: any) => {
  if (IS_BETA) {
    return next();
  }
  if (req.user?.betaLifetimeAccess) {
    return next();
  }

  // Resolve the business owner so workers in a trial business inherit access.
  // (req.user is the requesting user, which for team members is themselves —
  // not the owner whose subscription covers the business's features.)
  try {
    const userContext = req.userContext || (await getUserContext(req.userId));
    req.userContext = userContext;
    const ownerId = userContext?.effectiveUserId || req.userId;
    const owner = ownerId === req.userId ? req.user : await storage.getUser(ownerId);

    if (owner?.betaLifetimeAccess) return next();
    // Active trial (on the owner's account) grants full paid-feature access.
    if (isActiveTrialUser(owner)) return next();

    const tier = (owner?.subscriptionTier as string) || 'free';
    if (tier === 'pro' || tier === 'team' || tier === 'business' || tier === 'beta') {
      return next();
    }
  } catch {
    // If owner resolution fails, fall back to req.user so an error here never
    // locks out a legitimately-paying owner.
    if (isActiveTrialUser(req.user)) return next();
    const tier = req.user?.subscriptionTier;
    if (tier === 'pro' || tier === 'team' || tier === 'business' || tier === 'beta') {
      return next();
    }
  }

  return res.status(403).json({ error: "This feature requires a Pro subscription" });
};

export const requirePaidTierForSms = async (req: any, res: any, next: any) => {
  try {
    if (IS_BETA) return next();

    const userContext = await getUserContext(req.userId);
    const ownerId = userContext?.effectiveUserId || req.userId;
    req.effectiveUserId = ownerId;
    const owner = await storage.getUser(ownerId);
    if (!owner) {
      return res.status(404).json({ error: 'Account not found' });
    }
    if (owner.betaLifetimeAccess) return next();
    // Active trial users get full access to paid features including SMS.
    if (isActiveTrialUser(owner)) return next();

    const tier = owner.subscriptionTier;
    if (tier === 'pro' || tier === 'team' || tier === 'business' || tier === 'beta') {
      return next();
    }

    return res.status(402).json({
      error: 'SMS sending requires a Pro plan or higher. Upgrade to send SMS to clients.',
      type: 'SUBSCRIPTION_LIMIT',
      feature: 'sms',
    });
  } catch (err) {
    console.error('requirePaidTierForSms error:', err);
    return res.status(500).json({ error: 'Failed to verify SMS access' });
  }
};

// Generic server-side tier gate. Resolves the BUSINESS OWNER (so team members
// inherit the owner's plan and aren't wrongly blocked) and checks the owner's
// subscriptionTier. Active-trial owners are elevated to team-level rank so they
// can access every team-gated feature during their trial. Lapsed subscriptions
// (canceled/past_due/unpaid/paused) are downgraded to free. Raw stored tier is
// used for all other cases (pro, team, business, founding-member demo tiers).
const PAID_TIER_RANK: Record<string, number> = {
  free: 0,
  // 'trial' (raw DB value) only appears on legacy accounts that were created
  // before startTrial() began storing the actual tier. An expired raw-trial
  // account is treated as free here; active ones are caught by isActiveTrialUser
  // before this map is consulted.
  trial: 0,
  pro: 2,
  team: 3,
  business: 4,
  beta: 5,
};

export const requirePaidTier = (minTier: 'pro' | 'team' | 'business' = 'pro') => async (req: any, res: any, next: any) => {
  try {
    if (IS_BETA) return next();

    const userContext = req.userContext || (await getUserContext(req.userId));
    req.userContext = userContext;
    const ownerId = userContext?.effectiveUserId || req.userId;
    req.effectiveUserId = ownerId;

    const owner = await storage.getUser(ownerId);
    if (!owner) {
      return res.status(404).json({ error: 'Account not found' });
    }
    if (owner.betaLifetimeAccess) return next();
    // Active trial: full team-level access regardless of which tier is stored.
    if (isActiveTrialUser(owner)) return next();

    // Honor the raw subscriptionTier (works for manual tiers like demo/founding
    // that have no active Stripe status), BUT if the subscription has explicitly
    // lapsed (canceled/past_due/unpaid/paused) treat them as free — same set
    // getEffectiveTier downgrades — so a stale tier can't grant access after
    // cancellation/payment failure. A null/'none'/'active'/'trialing' status
    // keeps the stored tier.
    let tier = (owner.subscriptionTier as string) || 'free';
    try {
      const businessSettings = await storage.getBusinessSettings(ownerId);
      const status = businessSettings?.subscriptionStatus || 'none';
      if (status === 'past_due' || status === 'canceled' || status === 'unpaid' || status === 'paused') {
        tier = 'free';
      }
    } catch {
      // If settings can't be read, fall back to the raw tier (fail open to the
      // owner's stored plan rather than locking out a paying customer).
    }

    if ((PAID_TIER_RANK[tier] ?? 0) >= (PAID_TIER_RANK[minTier] ?? 99)) {
      return next();
    }

    const label = minTier === 'pro' ? 'Pro' : minTier === 'team' ? 'Team' : 'Business';
    return res.status(402).json({
      error: `This feature requires a ${label} plan or higher. Upgrade to unlock it.`,
      type: 'SUBSCRIPTION_LIMIT',
      requiredTier: minTier,
      upgradeUrl: '/pricing',
    });
  } catch (err) {
    console.error('requirePaidTier error:', err);
    return res.status(500).json({ error: 'Failed to verify subscription access' });
  }
};

export const requireDevelopment = (req: any, res: any, next: any) => {
  if (!isDevelopment) {
    return res.status(403).json({ error: "This endpoint is only available in development mode" });
  }
  next();
};

export const onboardingExemptPrefixes = [
  '/api/auth',
  '/api/onboarding',
  '/api/billing',
  '/api/subscription',
  '/api/subscribe',
  '/api/business-settings',
  '/api/user',
  '/api/usage-status',
  '/api/admin',
  '/api/stripe',
  '/api/demo',
  '/api/push',
  '/api/notifications',
  '/api/health',
  '/api/profile',
  '/api/team/invite/accept',
  '/api/team/invite/validate',
  '/api/team/invite-code/redeem',
  '/api/team/invite-code/validate',
  '/api/mobile',
  '/api/check-email',
  '/api/visitor',
];

export function setupOnboardingGuard(app: any) {
  app.use('/api', async (req: any, res: any, next: any) => {
    const path = req.originalUrl.split('?')[0];
    if (onboardingExemptPrefixes.some(prefix => path.startsWith(prefix))) {
      return next();
    }

    let resolvedUserId = req.session?.userId;
    if (!resolvedUserId) {
      const authHeader = req.headers?.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const sessionToken = authHeader.substring(7);
        try {
          const result = await db.execute(
            sql`SELECT sess FROM session WHERE sid = ${sessionToken} AND expire > NOW()`
          );
          if (result.rows && result.rows.length > 0) {
            resolvedUserId = (result.rows[0].sess as any)?.userId;
          }
        } catch (e) {
          // Session-token resolution is a fallback auth path; a DB failure here
          // silently downgrades the request to unauthenticated, so surface it.
          logger.warn('auth', 'Bearer session-token lookup failed', { error: e });
        }
      }
    }

    if (!resolvedUserId) {
      return next();
    }

    req._onboardingUserId = resolvedUserId;
    requireOnboarding()(req, res, next);
  });
}
