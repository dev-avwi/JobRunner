import { storage } from './storage';
import { 
  WORKER_PERMISSIONS, 
  DEFAULT_WORKER_PERMISSIONS, 
  ALL_WORKER_PERMISSIONS,
  TIER_LIMITS,
  type WorkerPermission,
  type TeamMember,
} from '@workspace/db';

export const PERMISSIONS = {
  READ_JOBS: 'read_jobs',
  WRITE_JOBS: 'write_jobs',
  READ_QUOTES: 'read_quotes',
  WRITE_QUOTES: 'write_quotes',
  READ_INVOICES: 'read_invoices',
  WRITE_INVOICES: 'write_invoices',
  READ_CLIENTS: 'read_clients',
  WRITE_CLIENTS: 'write_clients',
  READ_CLIENTS_SENSITIVE: 'read_clients_sensitive',
  MANAGE_TEAM: 'manage_team',
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_PAYMENTS: 'manage_payments',
  READ_REPORTS: 'read_reports',
  MANAGE_TEMPLATES: 'manage_templates',
  READ_TIME_ENTRIES: 'read_time_entries',
  WRITE_TIME_ENTRIES: 'write_time_entries',
  READ_EXPENSES: 'read_expenses',
  WRITE_EXPENSES: 'write_expenses',
  MANAGE_CATALOG: 'manage_catalog',
  VIEW_ALL: 'view_all',
  ASSIGN_JOBS: 'assign_jobs',
  WRITE_JOB_NOTES: 'write_job_notes',
  WRITE_JOB_MEDIA: 'write_job_media',
  MANAGE_AI_RECEPTIONIST: 'manage_ai_receptionist',
  READ_LEADS: 'read_leads',
  READ_COMMUNICATIONS: 'read_communications',
  VIEW_ACTION_CENTER: 'view_action_center',
  VIEW_DISPATCH: 'view_dispatch',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Roles in the DB store their permissions in one of several historical
// vocabularies. The mobile UI and the newer role presets use GRANULAR verbs
// (view_/create_/update_/edit_/delete_/send_, plus track_time/collect_payments),
// while the route middleware (createPermissionMiddleware) checks the COARSE
// PERMISSIONS vocabulary (read_/write_). A role explicitly granted
// "create_clients" must therefore satisfy a route that requires "write_clients".
// This map expands each granular verb into the coarse permission(s) it implies.
//
// The expansion is purely ADDITIVE: the original strings are preserved, so
// (1) roles already stored in the coarse vocabulary keep working unchanged, and
// (2) the mobile UI — which reads the raw granular strings off /api/team/my-role —
// is unaffected. We only widen what server-side enforcement accepts.
const PERMISSION_ALIASES: Record<string, string[]> = {
  // Jobs
  view_jobs: [PERMISSIONS.READ_JOBS],
  view_all_jobs: [PERMISSIONS.READ_JOBS, PERMISSIONS.VIEW_ALL],
  create_jobs: [PERMISSIONS.WRITE_JOBS],
  update_jobs: [PERMISSIONS.WRITE_JOBS],
  edit_jobs: [PERMISSIONS.WRITE_JOBS, PERMISSIONS.WRITE_JOB_NOTES, PERMISSIONS.WRITE_JOB_MEDIA],
  delete_jobs: [PERMISSIONS.WRITE_JOBS],
  update_job_status: [PERMISSIONS.WRITE_JOBS],
  // Clients — granular "view_clients" is documented (shared/schema.ts) as
  // "view full client details (address, phone, email)", and the granular
  // vocabulary has no separate sensitive-view permission, so it must also grant
  // READ_CLIENTS_SENSITIVE or PII gets redacted for these roles.
  view_clients: [PERMISSIONS.READ_CLIENTS, PERMISSIONS.READ_CLIENTS_SENSITIVE],
  create_clients: [PERMISSIONS.WRITE_CLIENTS],
  update_clients: [PERMISSIONS.WRITE_CLIENTS],
  edit_clients: [PERMISSIONS.WRITE_CLIENTS],
  delete_clients: [PERMISSIONS.WRITE_CLIENTS],
  // Quotes
  view_quotes: [PERMISSIONS.READ_QUOTES],
  create_quotes: [PERMISSIONS.WRITE_QUOTES],
  update_quotes: [PERMISSIONS.WRITE_QUOTES],
  edit_quotes: [PERMISSIONS.WRITE_QUOTES],
  delete_quotes: [PERMISSIONS.WRITE_QUOTES],
  send_quotes: [PERMISSIONS.WRITE_QUOTES],
  // Invoices
  view_invoices: [PERMISSIONS.READ_INVOICES],
  create_invoices: [PERMISSIONS.WRITE_INVOICES],
  update_invoices: [PERMISSIONS.WRITE_INVOICES],
  edit_invoices: [PERMISSIONS.WRITE_INVOICES],
  delete_invoices: [PERMISSIONS.WRITE_INVOICES],
  send_invoices: [PERMISSIONS.WRITE_INVOICES],
  // Documents (granular role that edits both quotes + invoices)
  edit_documents: [PERMISSIONS.WRITE_QUOTES, PERMISSIONS.WRITE_INVOICES],
  // Payments
  collect_payments: [PERMISSIONS.MANAGE_PAYMENTS],
  // Reports
  view_reports: [PERMISSIONS.READ_REPORTS],
  // Leads
  view_leads: [PERMISSIONS.READ_LEADS],
  manage_leads: [PERMISSIONS.READ_LEADS],
  // Communications
  view_communications: [PERMISSIONS.READ_COMMUNICATIONS],
  manage_communications: [PERMISSIONS.READ_COMMUNICATIONS],
  // Action Centre / Workflow
  view_action_center: [PERMISSIONS.VIEW_ACTION_CENTER],
  // Dispatch / live crew board
  view_dispatch: [PERMISSIONS.VIEW_DISPATCH],
  // Team
  manage_roles: [PERMISSIONS.MANAGE_TEAM],
  // Managers run the team day-to-day: seeing every job/client (not just their
  // own assignments) is required to oversee the crew, so manage_team grants
  // business-wide visibility. Deliberately NOT extended to assign_jobs — a
  // narrow assign-only role must not gain full client/job visibility.
  manage_team: [PERMISSIONS.VIEW_ALL],
  // Time tracking
  track_time: [PERMISSIONS.READ_TIME_ENTRIES, PERMISSIONS.WRITE_TIME_ENTRIES],
  time_tracking: [PERMISSIONS.READ_TIME_ENTRIES, PERMISSIONS.WRITE_TIME_ENTRIES],
  create_time_entries: [PERMISSIONS.WRITE_TIME_ENTRIES],
};

/**
 * Widen a stored permission list so granular verbs also satisfy the coarse
 * permissions the route middleware enforces. Additive only — never removes the
 * original strings, and leaves coarse-vocabulary and wildcard ("*") roles
 * untouched.
 */
export function expandPermissions(perms: string[]): string[] {
  if (!perms || perms.length === 0) return perms;
  const expanded = new Set<string>(perms);
  for (const p of perms) {
    const aliases = PERMISSION_ALIASES[p];
    if (aliases) {
      for (const a of aliases) expanded.add(a);
    }
  }
  return Array.from(expanded);
}

// Placeholder business name auto-created for invited workers/subcontractors who
// don't own a real business. It is NOT a real own-business: it exists only so
// they skip the owner onboarding wizard. Anywhere we decide "is this user a
// business owner?" we must treat this sentinel as "no own business" so a plain
// worker resolves into the business they were invited to (inheriting its plan
// and permissions) instead of being treated as the owner of an empty business.
export const WORKER_PROFILE_PLACEHOLDER_NAME = 'Worker Profile';

export const ROLE_TEMPLATES = {
  OWNER: {
    name: 'Owner',
    permissions: Object.values(PERMISSIONS),
    description: 'Full access to all features',
  },
  ADMIN: {
    name: 'Admin',
    permissions: [
      PERMISSIONS.READ_JOBS, PERMISSIONS.WRITE_JOBS, PERMISSIONS.ASSIGN_JOBS,
      PERMISSIONS.READ_QUOTES, PERMISSIONS.WRITE_QUOTES,
      PERMISSIONS.READ_INVOICES, PERMISSIONS.WRITE_INVOICES,
      PERMISSIONS.READ_CLIENTS, PERMISSIONS.WRITE_CLIENTS, PERMISSIONS.READ_CLIENTS_SENSITIVE,
      PERMISSIONS.MANAGE_TEAM,
      PERMISSIONS.MANAGE_SETTINGS,
      PERMISSIONS.READ_REPORTS,
      PERMISSIONS.MANAGE_TEMPLATES,
      PERMISSIONS.READ_TIME_ENTRIES, PERMISSIONS.WRITE_TIME_ENTRIES,
      PERMISSIONS.READ_EXPENSES, PERMISSIONS.WRITE_EXPENSES,
      PERMISSIONS.MANAGE_CATALOG,
      PERMISSIONS.VIEW_ALL,
      PERMISSIONS.MANAGE_AI_RECEPTIONIST,
      PERMISSIONS.READ_LEADS,
      PERMISSIONS.READ_COMMUNICATIONS,
      PERMISSIONS.VIEW_ACTION_CENTER,
      PERMISSIONS.VIEW_DISPATCH,
    ],
    description: 'Almost full access, except payment management',
  },
  MANAGER: {
    name: 'Manager',
    permissions: [
      PERMISSIONS.READ_JOBS, PERMISSIONS.WRITE_JOBS, PERMISSIONS.ASSIGN_JOBS,
      PERMISSIONS.READ_QUOTES, PERMISSIONS.WRITE_QUOTES,
      PERMISSIONS.READ_INVOICES, PERMISSIONS.WRITE_INVOICES,
      PERMISSIONS.READ_CLIENTS,
      PERMISSIONS.MANAGE_TEAM,
      PERMISSIONS.READ_REPORTS,
      PERMISSIONS.READ_TIME_ENTRIES, PERMISSIONS.WRITE_TIME_ENTRIES,
      PERMISSIONS.READ_EXPENSES, PERMISSIONS.WRITE_EXPENSES,
      PERMISSIONS.MANAGE_CATALOG,
      PERMISSIONS.VIEW_ALL,
      PERMISSIONS.WRITE_JOB_NOTES,
      PERMISSIONS.WRITE_JOB_MEDIA,
      PERMISSIONS.MANAGE_AI_RECEPTIONIST,
      PERMISSIONS.READ_LEADS,
      PERMISSIONS.READ_COMMUNICATIONS,
      PERMISSIONS.VIEW_ACTION_CENTER,
      PERMISSIONS.VIEW_DISPATCH,
    ],
    description: 'Manages jobs, quotes, invoices, team members - assigns to workers only',
  },
  SUPERVISOR: {
    name: 'Supervisor',
    permissions: [
      PERMISSIONS.READ_JOBS, PERMISSIONS.WRITE_JOBS,
      PERMISSIONS.READ_QUOTES,
      PERMISSIONS.READ_INVOICES,
      PERMISSIONS.READ_CLIENTS,
      PERMISSIONS.READ_REPORTS,
      PERMISSIONS.READ_TIME_ENTRIES, PERMISSIONS.WRITE_TIME_ENTRIES,
      PERMISSIONS.READ_EXPENSES,
      PERMISSIONS.VIEW_ALL,
    ],
    description: 'Can manage jobs and view most data',
  },
  WORKER: {
    name: 'Worker',
    permissions: [
      PERMISSIONS.READ_JOBS,
      PERMISSIONS.READ_CLIENTS,
      PERMISSIONS.READ_TIME_ENTRIES, PERMISSIONS.WRITE_TIME_ENTRIES,
      PERMISSIONS.WRITE_JOB_NOTES,
      PERMISSIONS.WRITE_JOB_MEDIA,
    ],
    description: 'Field worker - works on assigned jobs, adds photos and notes',
  },
  STAFF: {
    name: 'Staff',
    permissions: [
      PERMISSIONS.READ_JOBS,
      PERMISSIONS.READ_CLIENTS,
      PERMISSIONS.READ_TIME_ENTRIES, PERMISSIONS.WRITE_TIME_ENTRIES,
      PERMISSIONS.WRITE_JOB_NOTES,
      PERMISSIONS.WRITE_JOB_MEDIA,
    ],
    description: 'Basic access to assigned jobs - can add photos, notes, and track time',
  },
  SUBCONTRACTOR: {
    name: 'Subcontractor',
    permissions: [
      PERMISSIONS.READ_JOBS,
      PERMISSIONS.READ_CLIENTS,
      PERMISSIONS.READ_TIME_ENTRIES, PERMISSIONS.WRITE_TIME_ENTRIES,
      PERMISSIONS.WRITE_JOB_NOTES,
      PERMISSIONS.WRITE_JOB_MEDIA,
    ],
    description: 'External subcontractor - only sees assigned jobs, no financial data',
  },
};

export interface UserContext {
  userId: string;
  isOwner: boolean;
  effectiveUserId: string;
  businessOwnerId: string | null;
  permissions: Permission[];
  teamMemberId: string | null;
  roleName?: string;
  isSubcontractor?: boolean;
  ownerSubscriptionValid?: boolean;
  ownerSubscriptionError?: string;
  ownerBusinessName?: string;
  // The subscription tier that governs the user's CURRENT context. For a team
  // member working inside a business, this is the business owner's tier (the
  // worker inherits the business plan) — NOT the worker's own personal tier.
  // For an owner, this is their own tier.
  effectiveSubscriptionTier?: string;
}

export async function getUserContext(userId: string): Promise<UserContext> {
  const currentUser = await storage.getUser(userId);
  const activeBusinessId = currentUser?.activeBusinessId;

  let teamMembership;
  if (activeBusinessId) {
    teamMembership = await storage.getTeamMemberByUserIdAndBusiness(userId, activeBusinessId);
  } else {
    const ownSettings = await storage.getBusinessSettings(userId);
    // The "Worker Profile" placeholder is not a real own-business, so a plain
    // worker with no active business still resolves into the business they were
    // invited to (inheriting its plan + permissions) instead of looking like an
    // owner of an empty business.
    const hasRealOwnBusiness =
      !!ownSettings?.businessName &&
      ownSettings.businessName !== WORKER_PROFILE_PLACEHOLDER_NAME;
    // A subcontractor who has switched to their Personal profile (no active
    // business) must resolve to owner-mode over their OWN solo data — never
    // fall back to a joined-business membership, which would re-lock their
    // ability to create their own jobs/quotes/invoices. Only plain workers
    // inherit the invited business here.
    const isSubcontractorAccount = ownSettings?.accountType === 'subcontractor';
    if (!hasRealOwnBusiness && !isSubcontractorAccount) {
      teamMembership = await storage.getTeamMembershipByMemberId(userId);
    }
  }
  
  // A user can never be a "team member employee" of their own business. If the
  // only membership we found is a self-membership (member_id === business_owner_id,
  // which some legacy/dispatch flows created), they ARE the owner — fall through to
  // the owner result below so owner-only routes don't 403 them. Without this guard,
  // an owner whose business_settings lookup returns an empty/duplicate row gets
  // misclassified as a non-owner and locked out of owner-only actions.
  if (teamMembership && teamMembership.businessOwnerId === userId) {
    teamMembership = undefined;
  }

  if (teamMembership && teamMembership.inviteStatus === 'accepted') {
    const role = await storage.getUserRole(teamMembership.roleId);
    
    let permissions: Permission[];
    if (teamMembership.useCustomPermissions && teamMembership.customPermissions) {
      permissions = expandPermissions(teamMembership.customPermissions as string[]) as Permission[];
    } else {
      permissions = expandPermissions((role?.permissions as string[]) || []) as Permission[];
    }
    
    const ownerUser = await storage.getUser(teamMembership.businessOwnerId);
    const ownerBusinessSettings = await storage.getBusinessSettings(teamMembership.businessOwnerId);
    let ownerSubscriptionValid = true;
    let ownerSubscriptionError: string | undefined;
    let ownerBusinessName: string | undefined;
    // The plan the team member inherits from the business they work in.
    let effectiveSubscriptionTier = 'free';
    
    if (ownerUser) {
      const ownerTier = ownerUser.subscriptionTier;
      const ownerTrialStatus = ownerUser.trialStatus;
      const ownerTrialEndsAt = ownerUser.trialEndsAt;
      const subscriptionStatus = ownerBusinessSettings?.subscriptionStatus;
      
      const isTrialActive = ownerTrialStatus === 'active' && ownerTrialEndsAt && new Date(ownerTrialEndsAt) > new Date();
      
      // Tiers that include team member seats. Pro is single-user, so a worker
      // belonging to an owner who is on Pro should also be locked out.
      const teamCapableTiers = new Set(['team', 'business', 'beta']);
      const ownerHasTeamPlan = !!ownerTier && teamCapableTiers.has(ownerTier);
      const ownerHasBetaUnlock = !!(ownerUser.betaUser || ownerUser.betaLifetimeAccess);

      // The worker inherits the business owner's plan. Beta-unlocked owners map
      // to 'business' so beta workers get full feature access (the tier ranking
      // used by the UI gate doesn't understand a 'beta' tier string).
      effectiveSubscriptionTier = ownerHasBetaUnlock
        ? 'business'
        : (ownerTier || 'free');

      if (subscriptionStatus === 'canceled' && !isTrialActive) {
        ownerSubscriptionValid = false;
        ownerSubscriptionError = 'Business subscription has been canceled';
      } else if (!isTrialActive && (ownerTier === 'free' || !ownerTier)) {
        ownerSubscriptionValid = false;
        ownerSubscriptionError = 'Business does not have an active subscription';
      } else if (!isTrialActive && !ownerHasTeamPlan && !ownerHasBetaUnlock) {
        // Owner downgraded to a tier (e.g. Pro) that does not include team seats.
        ownerSubscriptionValid = false;
        ownerSubscriptionError = "Business owner's plan no longer includes team access";
      }
      
      ownerBusinessName = ownerBusinessSettings?.businessName || (ownerUser.firstName ? `${ownerUser.firstName} ${ownerUser.lastName || ''}`.trim() : undefined);
    } else {
      ownerSubscriptionValid = false;
      ownerSubscriptionError = 'Business owner account not found';
    }
    
    const roleName = role?.name || '';
    return {
      userId,
      isOwner: false,
      effectiveUserId: teamMembership.businessOwnerId,
      businessOwnerId: teamMembership.businessOwnerId,
      permissions,
      teamMemberId: teamMembership.id,
      roleName,
      isSubcontractor: roleName.toLowerCase() === 'subcontractor',
      ownerSubscriptionValid,
      ownerSubscriptionError,
      ownerBusinessName,
      effectiveSubscriptionTier,
    };
  }
  
  return {
    userId,
    isOwner: true,
    effectiveUserId: userId,
    businessOwnerId: null,
    permissions: Object.values(PERMISSIONS),
    teamMemberId: null,
    ownerSubscriptionValid: true,
    effectiveSubscriptionTier: currentUser?.subscriptionTier || 'free',
  };
}

export function hasPermission(userContext: UserContext, requiredPermission: Permission): boolean {
  if (userContext.isOwner) return true;
  if (userContext.permissions.includes('*' as Permission)) return true;
  return userContext.permissions.includes(requiredPermission);
}

export function hasAnyPermission(userContext: UserContext, requiredPermissions: Permission[]): boolean {
  if (userContext.isOwner) return true;
  if (userContext.permissions.includes('*' as Permission)) return true;
  return requiredPermissions.some(p => userContext.permissions.includes(p));
}

export function hasAllPermissions(userContext: UserContext, requiredPermissions: Permission[]): boolean {
  if (userContext.isOwner) return true;
  if (userContext.permissions.includes('*' as Permission)) return true;
  return requiredPermissions.every(p => userContext.permissions.includes(p));
}

export function createPermissionMiddleware(requiredPermission: Permission | Permission[]) {
  return async (req: any, res: any, next: any) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const userContext = await getUserContext(req.userId);
      req.userContext = userContext;
      req.effectiveUserId = userContext.effectiveUserId;
      
      if (!userContext.isOwner && userContext.ownerSubscriptionValid === false) {
        return res.status(403).json({
          error: 'subscription_lapsed',
          message: userContext.ownerSubscriptionError || 'Business subscription is not active',
        });
      }
      
      const permissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
      const hasAccess = hasAnyPermission(userContext, permissions);
      
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Access denied', 
          message: `You don't have permission to perform this action`,
          requiredPermission: permissions,
        });
      }
      
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

/**
 * Check whether the owner has reached their team member seat limit.
 * Returns { allowed: true } if there is room, or { allowed: false, ... }
 * with a user-facing message when the cap has been hit.
 *
 * Counts members with inviteStatus = 'accepted' OR 'pending' (pending
 * invites reserve a seat so an owner can't over-invite).
 */
export async function checkTeamSeatLimit(
  ownerId: string,
  owner: any,
  businessSettings: any,
): Promise<{ allowed: boolean; error?: string; code?: string; currentCount?: number; limit?: number }> {
  const tier = (owner?.subscriptionTier as string) || 'free';

  // Active-trial owners get team-level seats regardless of which raw tier is
  // stored (startTrial() stores 'pro' when trialing Pro but the trial should
  // include team-member access). Use the same active-trial detection as
  // ownerHasTeamCapability and the requirePaidTier gate.
  const trialStatus = owner?.trialStatus as string | undefined;
  const trialEndsAt = owner?.trialEndsAt as Date | string | null | undefined;
  const isTrialActive =
    trialStatus === 'active' &&
    !!trialEndsAt &&
    new Date(trialEndsAt) > new Date();

  const limits: Record<string, number> = {
    free: TIER_LIMITS.free.teamMembers,
    pro: TIER_LIMITS.pro.teamMembers,
    team: TIER_LIMITS.team.teamMembers,
    business: TIER_LIMITS.business.teamMembers,
  };

  // Active trial → treat as team for seat-limit purposes.
  let seatLimit = isTrialActive ? TIER_LIMITS.team.teamMembers : (limits[tier] ?? 0);

  if (owner?.betaLifetimeAccess) {
    seatLimit = TIER_LIMITS.business.teamMembers;
  }

  const extraSeats = (businessSettings as any)?.seatCount || 0;
  seatLimit += extraSeats;

  if (seatLimit <= 0) {
    return {
      allowed: false,
      error: 'Your plan does not include team members. Upgrade to a Team or Business plan.',
      code: 'team_seat_limit',
      currentCount: 0,
      limit: 0,
    };
  }

  const existingMembers = await storage.getTeamMembers(ownerId);
  const activeOrPending = existingMembers.filter(
    (m: any) => m.inviteStatus === 'accepted' || m.inviteStatus === 'pending' || m.inviteStatus === 'invited',
  );

  if (activeOrPending.length >= seatLimit) {
    return {
      allowed: false,
      error: `You've reached your team member limit of ${seatLimit}. Upgrade your plan or purchase additional seats to add more members.`,
      code: 'team_seat_limit',
      currentCount: activeOrPending.length,
      limit: seatLimit,
    };
  }

  return { allowed: true, currentCount: activeOrPending.length, limit: seatLimit };
}

// Predicate: does this owner currently have a plan that includes team-member
// seats? Mirrors the logic used in getUserContext to decide
// `ownerSubscriptionValid` for staff. Returns true when the owner can use
// team features (Team / Business / Beta plans, active trial, or beta unlock).
//
// Inputs are the raw owner User record and their BusinessSettings row so the
// caller can avoid extra DB lookups when they already have these in scope.
export function ownerHasTeamCapability(
  owner: any,
  businessSettings: any,
): boolean {
  if (!owner) return false;

  const tier = owner.subscriptionTier as string | undefined;
  const trialStatus = owner.trialStatus as string | undefined;
  const trialEndsAt = owner.trialEndsAt as Date | string | null | undefined;
  const subscriptionStatus = businessSettings?.subscriptionStatus as
    | string
    | undefined;

  const isTrialActive =
    trialStatus === 'active' &&
    !!trialEndsAt &&
    new Date(trialEndsAt) > new Date();

  // Tiers that include team-member seats. Pro is single-user — a Pro owner
  // cannot generate invite codes or invite team members.
  const teamCapableTiers = new Set(['team', 'business', 'beta']);
  const hasTeamPlan = !!tier && teamCapableTiers.has(tier);
  const hasBetaUnlock = !!(owner.betaUser || owner.betaLifetimeAccess);

  // Mirror the exact ordering used in getUserContext (lines 190-200) so
  // a worker who would be marked `ownerSubscriptionValid=false` after
  // joining is also rejected at invite/redeem/accept time.
  // Beta unlock only saves the "downgraded to non-team tier" case — it
  // does NOT save canceled subscriptions or no-tier-at-all accounts.
  if (subscriptionStatus === 'canceled' && !isTrialActive) return false;
  if (!isTrialActive && (tier === 'free' || !tier)) return false;
  if (!isTrialActive && !hasTeamPlan && !hasBetaUnlock) return false;

  return true;
}

// Middleware: gate routes behind the owner's "team plan" entitlement.
// Use this on team-invite endpoints (generating invite codes, inviting
// members, resending invites) so a Free or Pro owner cannot generate codes
// that would later be rejected at redemption time.
export function requireTeamPlan() {
  return async (req: any, res: any, next: any) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userContext = req.userContext || (await getUserContext(req.userId));
      req.userContext = userContext;
      req.effectiveUserId = userContext.effectiveUserId;

      // Resolve the owner record (the requester themselves if they're the
      // owner, otherwise the business owner the team member belongs to).
      const ownerId = userContext.isOwner
        ? userContext.userId
        : userContext.businessOwnerId;

      if (!ownerId) {
        return res.status(403).json({
          error: 'This action requires an active Team or Business plan subscription.',
          code: 'team_plan_required',
          requiresTeamPlan: true,
        });
      }

      const [owner, businessSettings] = await Promise.all([
        storage.getUser(ownerId),
        storage.getBusinessSettings(ownerId),
      ]);

      if (!ownerHasTeamCapability(owner, businessSettings)) {
        return res.status(403).json({
          error:
            'Inviting team members requires a Team or Business plan. Upgrade your subscription to add team members.',
          code: 'team_plan_required',
          requiresTeamPlan: true,
          upgradeUrl: '/pricing',
        });
      }

      next();
    } catch (error) {
      console.error('Team plan check error:', error);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

export function requireOnboarding() {
  return async (req: any, res: any, next: any) => {
    try {
      const userId = req.userId || req._onboardingUserId;
      if (!userId) {
        return next();
      }

      const userContext = req.userContext || (await getUserContext(userId));
      req.userContext = userContext;
      req.effectiveUserId = userContext.effectiveUserId;

      if (!userContext.isOwner) {
        return next();
      }

      const settings = await storage.getBusinessSettings(userContext.userId);

      if (!settings || !settings.onboardingCompleted) {
        return res.status(403).json({
          error: 'Please complete your business setup before using this feature.',
          code: 'onboarding_required',
        });
      }

      next();
    } catch (error) {
      console.error('Onboarding check error:', error);
      return res.status(500).json({ error: 'Onboarding check failed' });
    }
  };
}

export function ownerOnly() {
  return async (req: any, res: any, next: any) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const userContext = await getUserContext(req.userId);
      req.userContext = userContext;
      req.effectiveUserId = userContext.effectiveUserId;
      
      if (!userContext.isOwner) {
        return res.status(403).json({ 
          error: 'Access denied', 
          message: 'This action is restricted to business owners only',
        });
      }
      
      next();
    } catch (error) {
      console.error('Owner check error:', error);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

export function ownerOrManagerOnly() {
  return async (req: any, res: any, next: any) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const userContext = await getUserContext(req.userId);
      req.userContext = userContext;
      req.effectiveUserId = userContext.effectiveUserId;
      
      if (!userContext.isOwner && userContext.ownerSubscriptionValid === false) {
        return res.status(403).json({
          error: 'subscription_lapsed',
          message: userContext.ownerSubscriptionError || 'Business subscription is not active',
        });
      }
      
      const isOwnerOrManager = userContext.isOwner || 
        userContext.permissions.includes(PERMISSIONS.MANAGE_TEAM);
      
      if (!isOwnerOrManager) {
        return res.status(403).json({ 
          error: 'Access denied', 
          message: 'This action is restricted to business owners and managers only',
        });
      }
      
      next();
    } catch (error) {
      console.error('Owner/Manager check error:', error);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

/**
 * Blocks non-owner team members when the BUSINESS OWNER's subscription has
 * lapsed (canceled / no active plan / lost team access). Owners always pass —
 * their own tier is enforced separately by requirePaidTier on write routes.
 *
 * This preserves the lapse behavior that ownerOrManagerOnly() used to provide.
 * Chain it BEFORE requirePermission(...) on routes that previously relied on
 * ownerOrManagerOnly() for that enforcement (e.g. AI receptionist reads); it
 * sets req.userContext so the following requirePermission reuses it.
 */
export function requireOwnerSubscriptionActive() {
  return async (req: any, res: any, next: any) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userContext = req.userContext || await getUserContext(req.userId);
      req.userContext = userContext;
      req.effectiveUserId = userContext.effectiveUserId;

      if (!userContext.isOwner && userContext.ownerSubscriptionValid === false) {
        return res.status(403).json({
          error: 'subscription_lapsed',
          message: userContext.ownerSubscriptionError || 'Business subscription is not active',
        });
      }

      next();
    } catch (error) {
      console.error('Owner subscription check error:', error);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

export function requirePermission(permission: string) {
  return async (req: any, res: any, next: any) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userContext = req.userContext || await getUserContext(req.userId);
      req.userContext = userContext;
      req.effectiveUserId = userContext.effectiveUserId;

      if (userContext.isOwner) {
        return next();
      }

      if (!userContext.permissions.includes(permission)) {
        return res.status(403).json({
          error: 'Access denied',
          message: `Missing required permission: ${permission}`,
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

/**
 * Checks if a user can access a specific job's media (photos, notes, videos, voice)
 * 
 * Access rules (granular job media separation):
 * - Business owners: Full access to all jobs
 * - True admins (VIEW_ALL + MANAGE_TEAM): Full access to all jobs (for oversight)
 * - All other users: Must have WRITE_JOB_MEDIA/WRITE_JOB_NOTES AND be assigned to the job
 * 
 * Note: VIEW_ALL alone (without MANAGE_TEAM) or WRITE_JOBS alone do NOT grant media access.
 * This ensures staff assigned to scheduling/viewing duties cannot access job media 
 * unless they are explicitly granted media permissions AND assigned to the job.
 * 
 * @returns true if access is allowed, false otherwise
 */
export async function canAccessJobMedia(userContext: UserContext, jobId: string): Promise<boolean> {
  // Owners have full access
  if (userContext.isOwner) {
    return true;
  }
  
  // True admins (VIEW_ALL + MANAGE_TEAM) can access all jobs for oversight
  // This ensures only actual admins, not supervisors with VIEW_ALL for job visibility, 
  // have unrestricted media access
  const isTrueAdmin = userContext.permissions.includes(PERMISSIONS.VIEW_ALL) && 
                      userContext.permissions.includes(PERMISSIONS.MANAGE_TEAM);
  if (isTrueAdmin) {
    return true;
  }
  
  // All other users need:
  // 1. Job media permissions (WRITE_JOB_MEDIA or WRITE_JOB_NOTES)
  // 2. Be assigned to this specific job
  const hasMediaPermission = userContext.permissions.includes(PERMISSIONS.WRITE_JOB_MEDIA) ||
                              userContext.permissions.includes(PERMISSIONS.WRITE_JOB_NOTES);
  
  if (!hasMediaPermission) {
    return false;
  }
  
  // Check if assigned to this job (legacy assignedTo field + job_assignments table)
  return isUserAssignedToJob(userContext.userId, jobId, userContext.effectiveUserId, userContext.teamMemberId);
}

/**
 * Express middleware for job-scoped documents and media.
 *
 * Permission middleware still decides whether the caller may perform the
 * requested operation at all. This second gate prevents a worker or
 * subcontractor with broad read/write verbs from using a guessed job URL to
 * reach another crew's private files.
 */
export async function requireJobMediaAccess(req: any, res: any, next: any) {
  try {
    const userContext = req.userContext || await getUserContext(req.userId);
    req.userContext = userContext;
    req.effectiveUserId = userContext.effectiveUserId;

    if (!await canAccessJobMedia(userContext, req.params.jobId)) {
      return res.status(403).json({ error: 'You are not assigned to this job.' });
    }

    next();
  } catch (error) {
    console.error('Job media access check error:', error);
    return res.status(500).json({ error: 'Job media access check failed' });
  }
}

/**
 * Checks if a user can write/modify a specific job's media (photos, notes, videos, voice)
 * 
 * Write rules (granular job media separation):
 * - Business owners: Full write access to all jobs
 * - True admins (VIEW_ALL + MANAGE_TEAM): Full write access to all jobs
 * - All other users: Must have WRITE_JOB_MEDIA/WRITE_JOB_NOTES AND be assigned to the job
 * 
 * Note: VIEW_ALL alone or WRITE_JOBS alone do NOT grant media write access.
 */
export async function canWriteJobMedia(userContext: UserContext, jobId: string): Promise<boolean> {
  // Owners have full access
  if (userContext.isOwner) {
    return true;
  }
  
  // True admins (VIEW_ALL + MANAGE_TEAM) can write to all jobs
  const isTrueAdmin = userContext.permissions.includes(PERMISSIONS.VIEW_ALL) && 
                      userContext.permissions.includes(PERMISSIONS.MANAGE_TEAM);
  if (isTrueAdmin) {
    return true;
  }
  
  // All other users need WRITE_JOB_MEDIA or WRITE_JOB_NOTES permission AND must be assigned to the job
  const hasMediaPermission = userContext.permissions.includes(PERMISSIONS.WRITE_JOB_MEDIA) ||
                              userContext.permissions.includes(PERMISSIONS.WRITE_JOB_NOTES);
  
  if (!hasMediaPermission) {
    return false;
  }
  
  // Check if assigned to this job (legacy assignedTo field + job_assignments table)
  return isUserAssignedToJob(userContext.userId, jobId, userContext.effectiveUserId, userContext.teamMemberId);
}

/**
 * Helper to check if user is assigned to a job (for staff assignment validation)
 * Checks both legacy assignedTo field AND the job_assignments table for multi-worker assignments
 */
export async function isUserAssignedToJob(
  userId: string, 
  jobId: string, 
  effectiveUserId: string,
  teamMemberId?: string | null
): Promise<boolean> {
  try {
    const job = await storage.getJob(jobId, effectiveUserId);
    if (!job) {
      return false;
    }
    
    // Check legacy assignedTo field
    if (job.assignedTo === userId || (teamMemberId && job.assignedTo === teamMemberId)) {
      return true;
    }
    
    // Check job_assignments table for multi-worker assignments
    try {
      const assignments = await storage.getJobAssignments(jobId);
      if (assignments && assignments.length > 0) {
        return assignments.some((a: any) => 
          a.isActive && (
            a.userId === userId || 
            (teamMemberId && a.teamMemberId === teamMemberId)
          )
        );
      }
    } catch (e) {
      // job_assignments table may not exist in all environments
    }
    
    return false;
  } catch (error) {
    console.error('Error checking job assignment:', error);
    return false;
  }
}

/**
 * Role hierarchy for job assignments:
 * - OWNER/ADMIN: Can assign to MANAGER, SUPERVISOR, WORKER, STAFF
 * - MANAGER: Can only assign to WORKER, STAFF (not to other managers or admins)
 * - SUPERVISOR: Can only assign to WORKER, STAFF
 * - WORKER/STAFF: Cannot assign jobs
 */
const ASSIGNABLE_ROLES: Record<string, string[]> = {
  'OWNER': ['ADMIN', 'MANAGER', 'SUPERVISOR', 'WORKER', 'STAFF', 'TECHNICIAN', 'TRADESMAN', 'APPRENTICE'],
  'ADMIN': ['MANAGER', 'SUPERVISOR', 'WORKER', 'STAFF', 'TECHNICIAN', 'TRADESMAN', 'APPRENTICE'],
  'MANAGER': ['WORKER', 'STAFF', 'TECHNICIAN', 'TRADESMAN', 'APPRENTICE'],
  'SUPERVISOR': ['WORKER', 'STAFF', 'TECHNICIAN', 'TRADESMAN', 'APPRENTICE'],
  'WORKER': [],
  'STAFF': [],
};

/**
 * Maps various role names to their category for RBAC matching
 */
function normalizeRoleName(roleName: string): string {
  const upperName = roleName.toUpperCase();
  
  // Map common tradie role names to categories
  if (['TECHNICIAN', 'TRADESMAN', 'APPRENTICE', 'WORKER', 'STAFF', 'LABOURER', 'ASSISTANT'].includes(upperName)) {
    return upperName;
  }
  if (['ADMINISTRATOR', 'ADMIN'].includes(upperName)) {
    return 'ADMIN';
  }
  if (['MANAGER', 'SUPERVISOR', 'FOREMAN', 'LEAD'].includes(upperName)) {
    return upperName;
  }
  
  return upperName;
}

/**
 * Determines a user's effective role based on their permissions
 */
export function getEffectiveRole(userContext: UserContext): string {
  if (userContext.isOwner) return 'OWNER';
  
  const perms = userContext.permissions;
  const hasAll = perms.includes('*' as Permission);
  
  // Wildcard permission means Admin (full access except owner-specific)
  if (hasAll) return 'ADMIN';
  
  // Check for Admin (has MANAGE_TEAM)
  if (perms.includes(PERMISSIONS.MANAGE_TEAM)) return 'ADMIN';
  
  // Check for Manager (has ASSIGN_JOBS + quotes/invoices write)
  if (perms.includes(PERMISSIONS.ASSIGN_JOBS) && 
      perms.includes(PERMISSIONS.WRITE_QUOTES) && 
      perms.includes(PERMISSIONS.WRITE_INVOICES)) return 'MANAGER';
  
  // Check for Supervisor (has VIEW_ALL but not MANAGE_TEAM)
  if (perms.includes(PERMISSIONS.VIEW_ALL)) return 'SUPERVISOR';
  
  // Default to Worker/Staff
  return 'WORKER';
}

/**
 * Validates if a user can assign a job to a target team member
 * 
 * Assignment rules:
 * - Owner can assign to anyone (managers, supervisors, workers)
 * - Manager can only assign to workers (not to other managers or owner)
 * - Workers cannot assign jobs
 * 
 * @returns { allowed: boolean, reason?: string }
 */
export async function canAssignJobTo(
  assignerContext: UserContext, 
  targetUserId: string
): Promise<{ allowed: boolean; reason?: string }> {
  // First check if user has ASSIGN_JOBS permission or is owner (handles wildcard *)
  if (!hasPermission(assignerContext, PERMISSIONS.ASSIGN_JOBS)) {
    return { allowed: false, reason: 'You do not have permission to assign jobs' };
  }
  
  const assignerRole = getEffectiveRole(assignerContext);
  const allowedTargetRoles = ASSIGNABLE_ROLES[assignerRole] || [];
  
  // Owner can assign to anyone
  if (assignerContext.isOwner) {
    return { allowed: true };
  }
  
  // Check if target is the business owner - admins/managers cannot assign to the owner
  // But owner can still assign to themselves via the PATCH /api/jobs route (different flow)
  if (targetUserId === assignerContext.businessOwnerId || targetUserId === assignerContext.effectiveUserId) {
    // Non-owners cannot assign to the business owner
    return { allowed: false, reason: 'You cannot assign jobs to the business owner' };
  }
  
  // Get target user's role
  const targetMembership = await storage.getTeamMembershipByMemberId(targetUserId);
  if (!targetMembership) {
    return { allowed: false, reason: 'Target user is not a team member' };
  }
  
  // Get target's role and normalize it for matching
  const targetRole = await storage.getUserRole(targetMembership.roleId);
  const targetRoleName = normalizeRoleName(targetRole?.name || 'STAFF');
  
  if (allowedTargetRoles.includes(targetRoleName)) {
    return { allowed: true };
  }
  
  return { 
    allowed: false, 
    reason: `${assignerRole}s can only assign jobs to workers and staff members` 
  };
}

/**
 * Sanitizes client data based on user permissions
 * Removes sensitive fields (email, phone, address, etc.) for users without READ_CLIENTS_SENSITIVE
 */
export function sanitizeClientData(client: any, userContext: UserContext): any {
  // Owners always get full access
  if (userContext.isOwner) return client;
  
  // Wildcard permission grants full access
  if (userContext.permissions.includes('*' as Permission)) {
    // But still check if they have READ_CLIENTS_SENSITIVE explicitly
    if (!userContext.permissions.includes(PERMISSIONS.READ_CLIENTS_SENSITIVE)) {
      // Admins with wildcard but no explicit sensitive permission still get masked data
      return maskSensitiveClientFields(client);
    }
    return client;
  }
  
  // Users with READ_CLIENTS_SENSITIVE get full access
  if (userContext.permissions.includes(PERMISSIONS.READ_CLIENTS_SENSITIVE)) {
    return client;
  }
  
  return maskSensitiveClientFields(client);
}

/**
 * Masks sensitive fields in client data
 */
function maskSensitiveClientFields(client: any): any {
  const { 
    email, phone, mobile, 
    address, addressLine2, suburb, postcode, state, country,
    ...safeClient 
  } = client;
  
  return {
    ...safeClient,
    // Mask sensitive contact data
    email: email ? '***@***.com' : null,
    phone: phone ? '*** *** ***' : null,
    mobile: mobile ? '*** *** ***' : null,
    // Mask full address components
    address: address ? '(Address hidden)' : null,
    addressLine2: addressLine2 ? '(Hidden)' : null,
    suburb: suburb ? '***' : null,
    postcode: postcode ? '****' : null,
    state: state || null,
    country: country || null,
  };
}

/**
 * Checks if user can view sensitive client data
 */
export function canViewClientSensitiveData(userContext: UserContext): boolean {
  return userContext.isOwner || userContext.permissions.includes(PERMISSIONS.READ_CLIENTS_SENSITIVE);
}

/**
 * Gets the worker permissions for a team member.
 * Uses customPermissions if useCustomPermissions is true, otherwise returns DEFAULT_WORKER_PERMISSIONS.
 * 
 * @param teamMember - The team member record
 * @returns Array of WorkerPermission strings
 */
export function getWorkerPermissions(teamMember: TeamMember | null): WorkerPermission[] {
  if (!teamMember) {
    return [];
  }
  
  if (teamMember.useCustomPermissions && teamMember.customPermissions) {
    return teamMember.customPermissions as WorkerPermission[];
  }
  
  return [...DEFAULT_WORKER_PERMISSIONS];
}

/**
 * Checks if a specific worker permission exists in the permissions array.
 * 
 * @param permissions - Array of worker permissions
 * @param permission - The permission to check for
 * @returns true if the permission exists
 */
export function hasWorkerPermission(permissions: WorkerPermission[], permission: WorkerPermission): boolean {
  return permissions.includes(permission);
}

/**
 * Checks if a user is the business owner.
 * 
 * @param userId - The user's ID
 * @param businessOwnerId - The business owner's ID
 * @returns true if the user is the business owner
 */
export function isBusinessOwner(userId: string, businessOwnerId: string | null): boolean {
  if (!businessOwnerId) return true; // If no business owner ID is provided, user is their own owner
  return userId === businessOwnerId;
}

/**
 * Gets the complete worker permission context for a user.
 * Owners and managers get ALL worker permissions.
 * Workers get their assigned permissions (custom or default).
 * 
 * @param userId - The user's ID
 * @returns Object with permissions array, isOwner, and isWorker flags
 */
export async function getWorkerPermissionContext(userId: string): Promise<{
  permissions: WorkerPermission[];
  isOwner: boolean;
  isWorker: boolean;
  teamMemberId: string | null;
  businessOwnerId: string | null;
}> {
  const teamMembership = await storage.getTeamMembershipByMemberId(userId);
  
  if (teamMembership && teamMembership.inviteStatus === 'accepted') {
    // User is a team member/worker
    const role = await storage.getUserRole(teamMembership.roleId);
    const roleName = role?.name?.toUpperCase() || '';
    
    // Managers get ALL worker permissions
    const isManager = roleName === 'MANAGER' || roleName === 'ADMIN' || roleName === 'ADMINISTRATOR';
    
    let permissions: WorkerPermission[];
    if (isManager) {
      // Managers get all worker permissions
      permissions = [...ALL_WORKER_PERMISSIONS];
    } else {
      // Regular workers get their assigned permissions
      permissions = getWorkerPermissions(teamMembership);
    }
    
    return {
      permissions,
      isOwner: false,
      isWorker: true,
      teamMemberId: teamMembership.id,
      businessOwnerId: teamMembership.businessOwnerId,
    };
  }
  
  // User is a business owner - they get ALL worker permissions
  return {
    permissions: [...ALL_WORKER_PERMISSIONS],
    isOwner: true,
    isWorker: false,
    teamMemberId: null,
    businessOwnerId: null,
  };
}

/**
 * Checks if a team member's business owner has a valid subscription for team member access.
 * 
 * @param businessOwnerId - The business owner's user ID
 * @returns Object with hasAccess boolean and optional reason for denial
 */
export async function checkTeamMemberOwnerAccess(businessOwnerId: string): Promise<{
  hasAccess: boolean;
  reason?: string;
}> {
  try {
    const ownerBusinessSettings = await storage.getBusinessSettings(businessOwnerId);
    
    if (!ownerBusinessSettings) {
      return { hasAccess: false, reason: 'Business owner account not found' };
    }

    const subscriptionStatus = ownerBusinessSettings.subscriptionStatus;
    const subscriptionTier = (await storage.getUser(businessOwnerId))?.subscriptionTier;

    // Deny access if owner's subscription is canceled
    if (subscriptionStatus === 'canceled') {
      return { hasAccess: false, reason: 'Business owner subscription is canceled' };
    }

    // Deny access if owner is on free tier
    if (subscriptionTier === 'free' || !subscriptionTier) {
      return { hasAccess: false, reason: 'Business owner does not have an active subscription' };
    }

    // Allow access if owner has pro or team subscription
    if (subscriptionTier === 'pro' || subscriptionTier === 'team' || subscriptionTier === 'business') {
      return { hasAccess: true };
    }

    // Default to no access for unknown tiers
    return { hasAccess: false, reason: 'Invalid subscription tier' };
  } catch (error) {
    console.error('[checkTeamMemberOwnerAccess] Error checking owner subscription:', error);
    return { hasAccess: false, reason: 'Failed to verify owner subscription status' };
  }
}

// Re-export worker permission constants for convenience
export { WORKER_PERMISSIONS, DEFAULT_WORKER_PERMISSIONS, ALL_WORKER_PERMISSIONS, type WorkerPermission };
