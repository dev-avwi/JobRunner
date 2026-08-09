import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import api from '../lib/api';
import { useAuthStore } from '../lib/store';
import { useOfflineStore } from '../lib/offline-storage';
import { 
  roleCache, 
  fetchingUsers, 
  getSessionCounter, 
  startNewFetchSession,
  clearRoleCache,
  invalidateUserRoleCache,
  markUserRoleCacheStale,
  type UserRoleType
} from '../lib/role-cache';

// Re-export for backwards compatibility
export { clearRoleCache, invalidateUserRoleCache };
export type { UserRoleType };

// Cache TTL in milliseconds (5 minutes - reasonable balance between freshness and API load)
const CACHE_TTL_MS = 5 * 60 * 1000;

// Periodic refetch interval while app is active (every 5 minutes to match TTL)
const PERIODIC_REFETCH_MS = 5 * 60 * 1000;

interface TeamMemberInfo {
  roleId: string;
  roleName: string;
  permissions: string[];
  useCustomPermissions?: boolean;
  customPermissions?: string[];
  teamMemberId?: string;
}

// Permission keys that match the backend
export const PERMISSION_KEYS = {
  VIEW_CLIENTS: 'view_clients',
  CREATE_CLIENTS: 'create_clients',
  EDIT_CLIENTS: 'edit_clients',
  DELETE_CLIENTS: 'delete_clients',
  VIEW_JOBS: 'view_jobs',
  CREATE_JOBS: 'create_jobs',
  EDIT_JOBS: 'edit_jobs',
  DELETE_JOBS: 'delete_jobs',
  ASSIGN_JOBS: 'assign_jobs',
  VIEW_QUOTES: 'view_quotes',
  CREATE_QUOTES: 'create_quotes',
  EDIT_QUOTES: 'edit_quotes',
  DELETE_QUOTES: 'delete_quotes',
  SEND_QUOTES: 'send_quotes',
  VIEW_INVOICES: 'view_invoices',
  CREATE_INVOICES: 'create_invoices',
  EDIT_INVOICES: 'edit_invoices',
  DELETE_INVOICES: 'delete_invoices',
  SEND_INVOICES: 'send_invoices',
  COLLECT_PAYMENTS: 'collect_payments',
  VIEW_TEAM: 'view_team',
  MANAGE_TEAM: 'manage_team',
  MANAGE_ROLES: 'manage_roles',
  VIEW_REPORTS: 'view_reports',
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_BILLING: 'manage_billing',
  VIEW_MAP: 'view_map',
  VIEW_DISPATCH: 'view_dispatch',
  MANAGE_TEMPLATES: 'manage_templates',
  MANAGE_CATALOG: 'manage_catalog',
  MANAGE_AI_RECEPTIONIST: 'manage_ai_receptionist',
} as const;

interface CachedRoleData {
  role: UserRoleType;
  permissions: string[];
  teamMemberInfo: TeamMemberInfo | null;
  timestamp: number;
}

// Check if cache is stale (older than TTL)
const isCacheStale = (cache: CachedRoleData | undefined): boolean => {
  if (!cache) return true;
  return Date.now() - cache.timestamp > CACHE_TTL_MS;
};

// Helper to get permissions from team member info (respects custom permissions).
// Defensive: the server's standalone-owner / subcontractor branch of
// /api/team/my-role returns `permissions` as an OBJECT (not an array), so always
// normalize to string[] to avoid `.includes is not a function` crashes downstream.
const getTeamMemberPermissions = (info: any): string[] => {
  // Use custom permissions if enabled
  if (info.useCustomPermissions && Array.isArray(info.customPermissions)) {
    return info.customPermissions;
  }
  // Standard role permissions when provided as an array
  if (Array.isArray(info.permissions)) {
    return info.permissions;
  }
  // Owners (incl. standalone subcontractors) get full access via wildcard
  if (info.isOwner || info.role === 'owner' || info.role === 'solo_owner') {
    return ['*'];
  }
  return [];
};

const getRoleFromTeamInfo = (info: any): UserRoleType => {
  const roleName = (info.roleName || '').toLowerCase();
  if (roleName.includes('owner')) return 'owner';
  if (roleName.includes('manager') || roleName.includes('admin') || roleName.includes('supervisor')) {
    return 'manager';
  }
  if (roleName.includes('subcontractor') || roleName.includes('sub_contractor')) {
    return 'subcontractor';
  }
  // No usable roleName: fall back to the server-provided role / isOwner flags
  // (the standalone-owner branch omits roleName entirely).
  if (info.role === 'owner' || info.role === 'solo_owner' || info.isOwner) {
    return 'owner';
  }
  return 'staff';
};

// Check if user is business owner based on settings
const isBusinessOwner = (settings: any, userId: string | undefined): boolean => {
  if (!settings || !userId) return false;
  const settingsUserId = settings.userId || settings.user_id;
  return settingsUserId === userId;
};

export function useUserRole() {
  const { user, businessSettings, roleInfo: persistedRoleInfo } = useAuthStore();
  const userId: string | undefined = user?.id;
  const { isOnline } = useOfflineStore();
  // Authoritative owner signal from /api/auth/me. The server computes this
  // against the user's ACTIVE business, so it is correct even for a freshly
  // signed-up user who joined another business (it returns false there). Use
  // this — never a businessSettings heuristic — for the pre-fetch optimistic
  // guess, so we never flash "owner" before /api/team/my-role settles.
  const serverIsOwner = (user as any)?.isOwner === true;
  
  // Force re-render trigger when fetch completes
  const [fetchVersion, setFetchVersion] = useState(0);
  const sessionRef = useRef(getSessionCounter());
  const mountedRef = useRef(true);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Revalidate cache when app comes to foreground (match web's focus refetch)
  // Only refetch when online to avoid repeated network errors
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        userId &&
        isOnline  // Only refetch when online
      ) {
        // App came to foreground - always refetch like web's focus refetch
        // This ensures permission changes are picked up immediately.
        // Mark stale (don't delete) so the last-settled role stays readable
        // during the refetch — deleting flickers the owner view for subcontractors.
        markUserRoleCacheStale(userId);
        setFetchVersion(v => v + 1);
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [userId, isOnline]);

  // Periodic refetch while app is active (catch permission changes without focus change)
  // Only refetch when online to avoid repeated network errors
  useEffect(() => {
    if (!userId || !isOnline) return;
    
    const interval = setInterval(() => {
      // Only refetch if cache is stale AND we're online
      const cache = roleCache.get(userId);
      if (isCacheStale(cache) && isOnline) {
        // Mark stale (don't delete) so the last-settled role stays readable
        // during the refetch — deleting flickers the owner view for subcontractors.
        markUserRoleCacheStale(userId);
        setFetchVersion(v => v + 1);
      }
    }, PERIODIC_REFETCH_MS);
    
    return () => clearInterval(interval);
  }, [userId, isOnline]);

  // Offline cold start: the in-memory roleCache is empty after an app relaunch
  // with no connection, so the role would stay 'loading' forever and every
  // role-gated screen (the whole More menu) renders a permanent skeleton.
  // Seed the cache from the persisted roleInfo (restored from cached_auth by
  // the auth store) with timestamp 0, so it is readable immediately but
  // treated as stale and refetched the moment we're back online.
  useEffect(() => {
    if (!userId || isOnline) return;
    if (roleCache.get(userId)) return;
    const info: any = persistedRoleInfo;
    if (!info) return;

    const perms = Array.isArray(info.permissions) ? info.permissions : [];
    let role = getRoleFromTeamInfo(info);
    if (role === 'owner') {
      const settings = businessSettings as any;
      const teamSize = settings?.teamSize || settings?.team_size || 'solo';
      if (teamSize === '1' || teamSize === 'solo') role = 'solo_owner';
    }

    roleCache.set(userId, {
      role,
      permissions: perms,
      teamMemberInfo: {
        roleId: info.roleId,
        roleName: info.roleName,
        permissions: perms,
        teamMemberId: info.teamMemberId,
        isOwner: info.isOwner === true,
      } as any,
      timestamp: 0,
    });
    setFetchVersion(v => v + 1);
  }, [userId, isOnline, persistedRoleInfo, businessSettings]);

  // Fetch role info when userId changes or cache is stale
  // Only fetch when online to avoid repeated network errors
  useEffect(() => {
    if (!userId) return;
    const uid: string = userId;
    
    // Don't attempt network requests when offline - use cached data
    if (!isOnline) return;
    
    // Check if cache exists and is fresh
    const existingCache = roleCache.get(uid);
    if (existingCache && !isCacheStale(existingCache)) return;
    
    // Skip if already fetching
    if (fetchingUsers.has(uid)) return;
    
    // Start new fetch session and capture the session token
    // This token is used to detect if the fetch becomes stale
    const fetchSessionToken = startNewFetchSession();
    sessionRef.current = fetchSessionToken;
    fetchingUsers.add(uid);
    
    async function fetchRoleInfo(sessionToken: number) {
      try {
        const response = await api.get<TeamMemberInfo>('/api/team/my-role');
        
        // Check for stale fetch - compare against captured session token
        if (sessionToken !== getSessionCounter() || !mountedRef.current) {
          fetchingUsers.delete(uid);
          return;
        }
        
        const data = response.data || null;
        
        if (data) {
          const role = getRoleFromTeamInfo(data);
          const permissions = getTeamMemberPermissions(data);
          roleCache.set(uid, {
            role,
            permissions,
            teamMemberInfo: data,
            timestamp: Date.now(),
          });

          useAuthStore.setState({
            roleInfo: {
              roleId: data.roleId,
              roleName: data.roleName,
              permissions,
              hasCustomPermissions: data.useCustomPermissions ?? false,
              isOwner: (data as any).isOwner === true || role === 'owner' || role === 'solo_owner',
              teamMemberId: data.teamMemberId || undefined,
            },
            isWorker: role === 'staff',
          });
        }
        
        fetchingUsers.delete(uid);
        if (mountedRef.current) setFetchVersion(v => v + 1);
        
      } catch (error: any) {
        // Check for stale fetch - compare against captured session token
        if (sessionToken !== getSessionCounter() || !mountedRef.current) {
          fetchingUsers.delete(uid);
          return;
        }
        
        const status = error?.response?.status;
        if (status === 404) {
          // 404 = not a team member = likely owner
          const settings = businessSettings as any;
          const ownerCheck = isBusinessOwner(settings, uid);
          const teamSize = settings?.teamSize || settings?.team_size || 'solo';
          const role: UserRoleType = ownerCheck 
            ? (teamSize === '1' || teamSize === 'solo' ? 'solo_owner' : 'owner')
            : 'staff';
          
          const ownerPermissions = role === 'owner' || role === 'solo_owner' 
            ? Object.values(PERMISSION_KEYS) 
            : [];
          roleCache.set(uid, {
            role,
            permissions: ownerPermissions,
            teamMemberInfo: null,
            timestamp: Date.now(),
          });

          const isOwnerRole = role === 'owner' || role === 'solo_owner';
          useAuthStore.setState({
            roleInfo: {
              roleId: isOwnerRole ? 'owner' : 'staff',
              roleName: isOwnerRole ? 'OWNER' : 'STAFF',
              permissions: isOwnerRole ? ['*'] : ownerPermissions,
              hasCustomPermissions: false,
              isOwner: isOwnerRole,
            },
            isWorker: !isOwnerRole,
          });
        }
        
        fetchingUsers.delete(uid);
        if (mountedRef.current) setFetchVersion(v => v + 1);
      }
    }
    
    fetchRoleInfo(fetchSessionToken);
  }, [userId, businessSettings, fetchVersion, isOnline]);

  // Derive all values from cache - NO stale state possible
  const cache = userId ? roleCache.get(userId) : undefined;
  const isFetching = userId ? fetchingUsers.has(userId) : false;
  
  // Determine current role
  const getCurrentRole = useCallback((): UserRoleType => {
    if (!userId) return 'staff';
    
    // If we have cache, use it
    if (cache) return cache.role;
    
    // If fetching, determine preliminary role from the authoritative server
    // isOwner flag (NOT a businessSettings heuristic — that flashes "owner" for
    // a joined subcontractor before my-role settles).
    if (isFetching || !cache) {
      if (serverIsOwner) {
        // Genuine owner - return owner to prevent flicker
        const settings = businessSettings as any;
        const teamSize = settings?.teamSize || settings?.team_size || 'solo';
        return teamSize === '1' || teamSize === 'solo' ? 'solo_owner' : 'owner';
      }
      // Unknown / not a confirmed owner - return loading (no owner flash)
      return 'loading';
    }
    
    return 'staff';
  }, [userId, cache, isFetching, businessSettings, serverIsOwner]);

  // Get permissions
  const getPermissions = useCallback((): string[] => {
    if (!userId) return [];
    
    // If we have cache, use it (guard against non-array permissions)
    if (cache) return Array.isArray(cache.permissions) ? cache.permissions : [];
    
    // Only grant-all during loading for a CONFIRMED server owner (avoids
    // leaking owner permissions to a joined subcontractor mid-fetch).
    if (serverIsOwner) {
      return Object.values(PERMISSION_KEYS);
    }
    
    return [];
  }, [userId, cache, businessSettings, serverIsOwner]);

  const role = getCurrentRole();
  const permissions = getPermissions();
  const isLoading = role === 'loading' || (isFetching && !cache);
  
  // Check permission
  const hasPermission = useCallback((key: string): boolean => {
    if (!userId) return false;
    
    // If cached, use cache
    if (cache) {
      if (cache.role === 'owner' || cache.role === 'solo_owner') return true;
      // Guard against non-array permissions (legacy owner/subcontractor object shape)
      const perms = Array.isArray(cache.permissions) ? cache.permissions : [];
      // Handle wildcard "*" permission (Administrator and other full-access roles)
      if (perms.includes('*')) return true;
      return perms.includes(key);
    }
    
    // During loading, only grant for a CONFIRMED server owner.
    if (serverIsOwner) return true;
    
    // Otherwise deny (safe default)
    return false;
  }, [userId, cache, businessSettings, serverIsOwner]);

  const isOwner = role === 'owner' || role === 'solo_owner';
  const isManager = role === 'manager';
  const isStaff = role === 'staff' || role === 'subcontractor';
  const isSubcontractor = role === 'subcontractor';
  // A subcontractor operating in their OWN Personal workspace has full owner
  // powers — the server (/api/team/my-role) returns isOwner:true for them, but
  // we keep role='subcontractor' so the Subcontractor dashboard/badge still
  // shows. This flag distinguishes the free Personal profile from being
  // switched INTO a joined business (where isOwner is absent and create locks).
  const isStandaloneSubcontractor = isSubcontractor && (cache?.teamMemberInfo as any)?.isOwner === true;
  const isSolo = role === 'solo_owner';
  const teamMemberId = cache?.teamMemberInfo?.teamMemberId;
  
  // Subscription tier checks
  const subscriptionTier = user?.subscriptionTier || 'free';
  const subscriptionStatus = (user as any)?.subscriptionStatus || 'none';
  const isPaymentOverdue = subscriptionStatus === 'past_due';
  const isSubscriptionPaused = subscriptionStatus === 'paused';
  const isSubscriptionRestricted = isPaymentOverdue || isSubscriptionPaused;
  // During beta, OR for users with lifetime beta access, all paid features are unlocked
  const hasBetaUnlock = !!(user?.isBeta || user?.betaLifetimeAccess);
  const hasTeamSubscription = !isSubscriptionRestricted && (hasBetaUnlock || subscriptionTier === 'team' || subscriptionTier === 'business' || (subscriptionTier as string) === 'beta');
  const hasProSubscription = !isSubscriptionRestricted && (hasBetaUnlock || subscriptionTier === 'pro' || subscriptionTier === 'team' || subscriptionTier === 'business' || (subscriptionTier as string) === 'beta');
  const canUseAIFeatures = hasProSubscription;
  
  // Team access requires both role permission AND team subscription
  // Pro users can see team features but should get upgrade prompts
  const hasTeamAccess = (isOwner || isManager) && hasTeamSubscription;
  
  // Can access team pages (for visibility) - shows pages but may block features
  const canAccessTeamPages = isOwner || isManager;

  return {
    role,
    isOwner,
    isManager,
    isStaff,
    isSubcontractor,
    isStandaloneSubcontractor,
    isSolo,
    teamMemberId,
    hasTeamAccess,
    canAccessTeamPages,
    subscriptionTier,
    subscriptionStatus,
    isPaymentOverdue,
    isSubscriptionPaused,
    isSubscriptionRestricted,
    hasTeamSubscription,
    hasProSubscription,
    canUseAIFeatures,
    isLoading,
    permissions,
    hasPermission,
    
    // Client permissions
    canViewClients: hasPermission(PERMISSION_KEYS.VIEW_CLIENTS),
    canCreateClients: hasPermission(PERMISSION_KEYS.CREATE_CLIENTS),
    canEditClients: hasPermission(PERMISSION_KEYS.EDIT_CLIENTS),
    canDeleteClients: hasPermission(PERMISSION_KEYS.DELETE_CLIENTS),
    canAccessClients: hasPermission(PERMISSION_KEYS.VIEW_CLIENTS),
    
    // Job permissions
    canViewJobs: hasPermission(PERMISSION_KEYS.VIEW_JOBS),
    canCreateJobs: hasPermission(PERMISSION_KEYS.CREATE_JOBS),
    canEditJobs: hasPermission(PERMISSION_KEYS.EDIT_JOBS),
    canDeleteJobs: hasPermission(PERMISSION_KEYS.DELETE_JOBS),
    canAssignJobs: hasPermission(PERMISSION_KEYS.ASSIGN_JOBS),
    
    // Quote permissions
    canViewQuotes: hasPermission(PERMISSION_KEYS.VIEW_QUOTES),
    canCreateQuotes: hasPermission(PERMISSION_KEYS.CREATE_QUOTES),
    canEditQuotes: hasPermission(PERMISSION_KEYS.EDIT_QUOTES),
    canDeleteQuotes: hasPermission(PERMISSION_KEYS.DELETE_QUOTES),
    canSendQuotes: hasPermission(PERMISSION_KEYS.SEND_QUOTES),
    canAccessQuotes: hasPermission(PERMISSION_KEYS.VIEW_QUOTES),
    
    // Invoice permissions
    canViewInvoices: hasPermission(PERMISSION_KEYS.VIEW_INVOICES),
    canCreateInvoices: hasPermission(PERMISSION_KEYS.CREATE_INVOICES),
    canEditInvoices: hasPermission(PERMISSION_KEYS.EDIT_INVOICES),
    canDeleteInvoices: hasPermission(PERMISSION_KEYS.DELETE_INVOICES),
    canSendInvoices: hasPermission(PERMISSION_KEYS.SEND_INVOICES),
    canCollectPayments: hasPermission(PERMISSION_KEYS.COLLECT_PAYMENTS),
    canAccessInvoices: hasPermission(PERMISSION_KEYS.VIEW_INVOICES),
    
    // Team permissions
    canViewTeam: hasPermission(PERMISSION_KEYS.VIEW_TEAM),
    canManageTeam: hasPermission(PERMISSION_KEYS.MANAGE_TEAM),
    canManageRoles: hasPermission(PERMISSION_KEYS.MANAGE_ROLES),
    canAccessTeamManagement: hasPermission(PERMISSION_KEYS.VIEW_TEAM),
    
    // Other permissions
    canAccessReports: hasPermission(PERMISSION_KEYS.VIEW_REPORTS),
    canAccessSettings: hasPermission(PERMISSION_KEYS.MANAGE_SETTINGS),
    canAccessBilling: hasPermission(PERMISSION_KEYS.MANAGE_BILLING),
    canAccessMap: hasPermission(PERMISSION_KEYS.VIEW_MAP),
    canAccessDispatch: hasPermission(PERMISSION_KEYS.VIEW_DISPATCH),
    canManageTemplates: hasPermission(PERMISSION_KEYS.MANAGE_TEMPLATES),
    canManageCatalog: hasPermission(PERMISSION_KEYS.MANAGE_CATALOG),
  };
}
