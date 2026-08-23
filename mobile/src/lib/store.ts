import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { isAuthErrorMessage, setAuthExpiredCallback } from './api';

// Module-level generation counters — incremented on each fetch so stale
// out-of-order responses can be detected and discarded before committing state.
let _jobsFetchGen = 0;
let _todaysJobsFetchGen = 0;

// In-flight Promise for useClientsStore.fetchClients so concurrent callers
// (e.g. both quotes and invoices useFocusEffect firing simultaneously) all
// await the same network request rather than each launching their own.
let _clientsFetchInFlight: Promise<void> | null = null;
// Generation counter — incremented on logout/login so an in-flight request
// from a prior session cannot commit its results into the new session's store.
let _clientsFetchGen = 0;

// Register the global 401 handler immediately so any expired-session response
// anywhere in the app triggers a clean logout without each screen handling it.
// This runs once when the module loads; the handler reads the store lazily so
// there is no circular-dependency issue.
// Exported so logout() can restore it after temporarily silencing it.
export const _authExpiredHandler = () => {
  const { isAuthenticated, logout } = useAuthStore.getState();
  if (isAuthenticated) {
    if (__DEV__) console.log('[API] 401 received — triggering auth logout');
    logout();
  }
};
setAuthExpiredCallback(_authExpiredHandler);
import offlineStorage, { useOfflineStore } from './offline-storage';
import { clearRoleCache } from './role-cache';
import { useThemeStore, ThemeMode } from './theme-store';
import locationTracking from './location-tracking';
import notificationService from './notifications';
import LiveActivity from '../../modules/LiveActivity/src';
import type { TemplateCustomization } from './document-templates';
import { celebrate } from './celebrate';

// ============ TYPES ============

interface User {
  id: string;
  email: string;
  /** Pre-computed display name from the server (falls back to firstName + lastName). */
  name?: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  tradeType?: string;
  role?: string;
  roleName?: string;
  profileImageUrl?: string;
  defaultHourlyRate?: number | string;
  abn?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  brandColor?: string;
  themeColor?: string;
  gstEnabled?: boolean;
  isPlatformAdmin?: boolean;
  subscriptionTier?: 'free' | 'pro' | 'team' | 'business' | 'trial' | 'beta';
  subscriptionStatus?: string;
  subscriptionSource?: string;
  isOwner?: boolean;
  teamOwnerId?: string | null;
  activeTeamId?: string | null;
  isWorker?: boolean;
  businessOwnerId?: string | null;
  ownerSubscriptionValid?: boolean;
  ownerSubscriptionError?: string;
  ownerBusinessName?: string;
  trialEndsAt?: string;
  trialStatus?: string;
  isBeta?: boolean;
  betaLifetimeAccess?: boolean;
  betaUser?: boolean;
  hasDemoData?: boolean;
  demoDataIds?: {
    clients: string[];
    jobs: string[];
    quotes: string[];
    invoices: string[];
  };
}

interface BusinessSettings {
  simpleMode?: boolean;
  businessAddress?: string;
  id: string;
  businessName: string;
  abn?: string;
  phone?: string;
  email?: string;
  address?: string;
  logoUrl?: string;
  brandColor?: string;
  primaryColor?: string;
  teamSize?: string;
  themeMode?: 'light' | 'dark' | 'system';
  documentTemplate?: 'professional' | 'modern' | 'minimal';
  documentTemplateSettings?: TemplateCustomization;
  tradeName?: string;
  aiEnabled?: boolean;
  aiPhotoAnalysisEnabled?: boolean;
  tradeType?: string;
  gstEnabled?: boolean;
  defaultHourlyRate?: number;
  calloutFee?: number;
  onboardingCompleted?: boolean;
  onboardingUrl?: string;
  hasSeenWalkthrough?: boolean;
  dedicatedPhoneNumber?: string;
  aiReceptionistEnabled?: boolean;
  aiReceptionistMode?: string;
  // Owner-set, team-wide location tracking window.
  trackingHoursEnabled?: boolean;
  workHoursStart?: string;
  workHoursEnd?: string;
  workDays?: number[];
  defaultMaterialMarkupPct?: string;
}

/**
 * Bridge a clock-in/out into the location tracker's "override" so GPS keeps
 * running outside the owner's tracking hours while a worker is actively on the
 * clock. Lazy-imported to avoid a static cycle with the location store.
 */
async function setLocationTrackingOverride(active: boolean): Promise<void> {
  try {
    const { useLocationStore } = await import('./location-store');
    await useLocationStore.getState().setTrackingOverride(active);
  } catch {
    // location store unavailable (e.g. Expo Go) — ignore
  }
}

export interface Job {
  id: string;
  title: string;
  description?: string;
  address?: string;
  status: 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';
  scheduledAt?: string;
  clientId?: string;
  assignedTo?: string;
  clientName?: string;
  latitude?: number;
  longitude?: number;
  estimatedDuration?: number;
  // Optional/extended fields used across job/dashboard screens
  workerStatus?: string | null;
  isRecurring?: boolean;
  recurrencePattern?: string | null;
  nextRecurrenceDate?: string | null;
  recurrenceEndDate?: string | null;
  portalEnabled?: boolean;
  geofenceEnabled?: boolean;
  geofenceRadius?: number;
  geofenceAutoClockIn?: boolean;
  geofenceAutoClockOut?: boolean;
  notes?: string;
  estimatedCost?: number | string;
  isXeroImport?: boolean;
  completedAt?: string;
  createdAt?: string;
  jobNumber?: string | null;
  jobType?: string | null;
}

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  tags?: string[];
  clientType?: string;
  referralSource?: string;
  savedSignatureData?: string | null;
}

interface QuoteLineItem {
  id: string;
  quoteId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Quote {
  id: string;
  quoteNumber: string;
  clientId: string;
  jobId?: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'archived';
  subtotal: number;
  gstAmount: number;
  total: number;
  validUntil?: string;
  notes?: string;
  createdAt: string;
  lineItems?: QuoteLineItem[];
  clientName?: string;
  title?: string;
  description?: string;
  archived?: boolean;
  depositRequired?: boolean;
  depositPercent?: number;
  depositAmount?: number;
  documentTemplate?: string;
  documentTemplateSettings?: TemplateCustomization | null;
  includesGst?: boolean;
  acceptedAt?: string;
  acceptedBy?: string;
}

interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  jobId?: string;
  quoteId?: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number;
  gstAmount: number;
  total: number;
  amountPaid: number;
  dueDate?: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
  lineItems?: InvoiceLineItem[];
  clientName?: string;
  title?: string;
  description?: string;
  terms?: string;
  isRecurring?: boolean;
  recurrencePattern?: string | null;
  recurrenceEndDate?: string | null;
}

interface TimeEntry {
  id: string;
  userId: string;
  jobId?: string;
  description?: string;
  startTime: string;
  endTime?: string;
  notes?: string;
  isBreak?: boolean;
  isPaused?: boolean;
  pausedDuration?: number;
  jobTitle?: string;
}

// ============ AUTH STORE ============

interface RoleInfo {
  roleId: string;
  roleName: string;
  permissions: string[];
  hasCustomPermissions: boolean;
  isOwner: boolean;
  teamMemberId?: string;
}

interface TeamMember {
  id: string;
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  inviteStatus: 'pending' | 'accepted' | 'rejected';
  locationEnabledByOwner?: boolean;
}

interface TeamState {
  hasActiveTeam: boolean;
  activeTeamCount: number;
  members: TeamMember[];
  isLoading: boolean;
  lastFetched: number | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  businessSettings: BusinessSettings | null;
  roleInfo: RoleInfo | null;
  teamState: TeamState;
  workerPermissions: string[];
  isWorker: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  isInitialized: boolean;
  error: string | null;
  onboardingFinishing: boolean;
  dashboardReady: boolean;
  
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  forceRefreshAuth: () => Promise<void>;
  fetchRoleInfo: () => Promise<void>;
  fetchTeamState: (forceRefresh?: boolean) => Promise<void>;
  getTeamMembers: () => TeamMember[];
  fetchBusinessSettings: () => Promise<void>;
  setBusinessSettings: (settings: BusinessSettings) => void;
  setOnboardingFinishing: (value: boolean) => void;
  setDashboardReady: (value: boolean) => void;
  setUser: (user: User) => void;
  refreshUser: () => Promise<void>;
  clearError: () => void;
  updateBusinessSettings: (settings: Partial<BusinessSettings>) => Promise<boolean>;
  hasPermission: (permission: string) => boolean;
  hasWorkerPermission: (permission: string) => boolean;
  isOwner: () => boolean;
  isStaff: () => boolean;
  hasActiveTeam: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  businessSettings: null,
  roleInfo: null,
  teamState: { hasActiveTeam: false, activeTeamCount: 0, members: [], isLoading: false, lastFetched: null },
  workerPermissions: [],
  isWorker: false,
  isLoading: false,
  isAuthenticated: false,
  isInitialized: false,
  error: null,
  onboardingFinishing: false,
  dashboardReady: false,

  login: async (email: string, password: string) => {
    // Clear any stale onboarding-finishing suppression from a prior in-memory
    // session so a fresh login never starts with the global guard suppressed.
    set({ isLoading: true, error: null, onboardingFinishing: false });
    // Note: Don't clear role cache on login - per-user cache is keyed by userId
    // Each user has their own cache entry, so no cross-user leakage possible
    
    // Check if we're offline
    const { isOnline } = useOfflineStore.getState();
    
    if (!isOnline) {
      // Can't login when offline - need server authentication
      set({ 
        isLoading: false, 
        error: 'No internet connection. Please connect to sign in.' 
      });
      return false;
    }
    
    const response = await api.login(email, password);
    
    if (response.error) {
      set({ isLoading: false, error: response.error });
      return false;
    }

    if (!response.data?.user) {
      set({ isLoading: false, error: 'Invalid response from server' });
      return false;
    }

    // Sync token from API client to store for components that use direct fetch
    const currentToken = await api.getToken();
    
    set({ 
      user: response.data.user, 
      token: currentToken,
      isAuthenticated: true, 
      isLoading: false,
      error: null 
    });

    const settingsResponse = await api.get<BusinessSettings>('/api/business-settings');
    if (settingsResponse.data) {
      set({ businessSettings: settingsResponse.data });
      
      if (settingsResponse.data.themeMode) {
        useThemeStore.getState().initializeFromServer(settingsResponse.data.themeMode);
      }
    }
    
    await get().fetchRoleInfo();
    
    await get().fetchTeamState();
    
    set({ isInitialized: true });
    
    const state = get();
    await offlineStorage.cacheAuthData(state.user, state.businessSettings, state.roleInfo);
    
    await offlineStorage.fullSync();

    // Ensure this device's push token is bound to the now-logged-in user.
    // If the token failed to register on app boot (e.g. before auth was
    // ready), this retries; if it never initialized, this triggers init.
    notificationService.ensureRegisteredWithBackend().catch(() => {});

    return true;
  },

  logout: async () => {
    set({ isLoading: true });
    // Clear role cache BEFORE logout to prevent permission leakage
    clearRoleCache();
    // Silence the 401 callback for the duration of logout — we're intentionally
    // clearing the token so a 401 on the logout call itself mustn't recurse.
    // Restored in the finally block below.
    setAuthExpiredCallback(() => {});
    // Each cleanup step is best-effort: a failure in one (e.g. offline cache
    // or location tracking) must NOT prevent the auth state from being cleared.
    // The `finally` block always resets to a signed-out state so the UI can
    // navigate to login — otherwise a thrown cleanup error would leave the user
    // stuck on the dashboard (the original logout glitch).
    // Unbind this device's push token from the current user on the server FIRST,
    // in its own protected block, while the auth token is still valid and before
    // any other cleanup step can throw and skip it. Otherwise the next account
    // that signs in here keeps receiving this user's pushes (e.g. an overtime
    // nudge for a timer the old account started).
    try {
      await notificationService.deactivateTokenWithBackend();
    } catch (err) {
      if (__DEV__) console.warn('[Auth] push-token unbind failed (continuing):', err);
    }
    // End any lock-screen Live Activity timer from this account, and clear the
    // in-memory active timer (separate store), so a previous account's running
    // timer doesn't linger on the device after switching accounts.
    try { await LiveActivity.end(); } catch {}
    useTimeTrackingStore.setState({ activeTimer: null });
    // Clear per-device UI flags (tour/onboarding/banner) so the next account
    // on this device gets fresh first-run state, not the previous account's.
    try {
      await AsyncStorage.multiRemove([
        'jobrunner-mobile-tour-completed',
        'jobrunner-mobile-tour-completed-skipped',
        'jobrunner-banner-dismissed',
        'onboarding_completed',
      ]);
    } catch {}
    try {
      // Clear cached auth data for offline access
      await offlineStorage.clearCachedAuthData();
      // Clear all cached data
      await offlineStorage.clearCache();
      await locationTracking.stopJobTracking();
      await locationTracking.stopTracking();
      locationTracking.setSubcontractorMode(false);
      await api.logout();
    } catch (err) {
      if (__DEV__) console.warn('[Auth] logout cleanup error (continuing to clear state):', err);
    } finally {
      // Restore the 401 callback now that logout is done; the user is signed
      // out so new 401s (e.g. from a lingering request or next sign-in) are
      // handled correctly again.
      setAuthExpiredCallback(_authExpiredHandler);
      set({
        user: null,
        token: null,
        businessSettings: null,
        roleInfo: null,
        teamState: { hasActiveTeam: false, activeTeamCount: 0, members: [], isLoading: false, lastFetched: null },
        workerPermissions: [],
        isWorker: false,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        onboardingFinishing: false,
        dashboardReady: false,
      });
      // Restore the real 401 handler now that state is cleared and the token is
      // gone. Without this, a subsequent login leaves the app with a permanent
      // no-op handler so expired-session 401s never trigger a sign-out again.
      setAuthExpiredCallback(() => {
        const { isAuthenticated, logout } = useAuthStore.getState();
        if (isAuthenticated) {
          if (__DEV__) console.log('[API] 401 received — triggering auth logout');
          logout();
        }
      });
      // Invalidate the clients cache so a subsequent login (possibly a different
      // user on the same device) never serves the previous user's client list.
      // Incrementing the generation also prevents any in-flight request that
      // started before logout from committing its results into the new session.
      _clientsFetchGen += 1;
      _clientsFetchInFlight = null;
      useClientsStore.setState({ clients: [], lastFetched: null, isLoading: false, isOfflineData: false });
    }
  },

  checkAuth: async () => {
    // Guard: prevent multiple simultaneous auth checks
    const state = get();
    if (state.isLoading) {
      if (__DEV__) console.log('[Auth] checkAuth already in progress, skipping');
      return;
    }
    
    // Guard: if already initialized and authenticated, don't re-check
    if (state.isInitialized && state.isAuthenticated && state.user) {
      if (__DEV__) console.log('[Auth] Already authenticated, skipping checkAuth');
      return;
    }
    
    set({ isLoading: true });
    
    await api.loadToken();
    
    if (!api.hasToken()) {
      set({ 
        user: null, 
        token: null,
        isAuthenticated: false, 
        isLoading: false,
        isInitialized: true 
      });
      return;
    }

    // Check if we're online
    const { isOnline } = useOfflineStore.getState();
    
    if (!isOnline) {
      // We're offline - try to use cached auth data
      if (__DEV__) console.log('[Auth] Offline mode - attempting to use cached auth data');
      const cachedAuth = await offlineStorage.getCachedAuthData();
      
      if (cachedAuth && cachedAuth.userData) {
        // Use cached data for offline access
        // Normalize permissions to array to prevent runtime errors from old cache data
        const normalizedRoleInfo = cachedAuth.roleInfo ? {
          ...cachedAuth.roleInfo,
          permissions: Array.isArray(cachedAuth.roleInfo.permissions) ? cachedAuth.roleInfo.permissions : []
        } : null;
        // Sync token from API client
        const currentToken = await api.getToken();
        set({ 
          user: cachedAuth.userData, 
          token: currentToken,
          businessSettings: cachedAuth.businessSettings,
          roleInfo: normalizedRoleInfo,
          isAuthenticated: true, 
          isLoading: false,
          isInitialized: true 
        });
        
        // Sync theme mode from cached settings (honors last known server value)
        if (cachedAuth.businessSettings?.themeMode) {
          useThemeStore.getState().initializeFromServer(cachedAuth.businessSettings.themeMode as ThemeMode);
        }
        if (__DEV__) console.log('[Auth] Using cached auth data for offline access');
        return;
      } else {
        // No cached data and offline - can't authenticate
        set({ 
          user: null, 
          token: null,
          isAuthenticated: false, 
          isLoading: false,
          isInitialized: true 
        });
        return;
      }
    }

    // Online - verify with server
    const response = await api.getCurrentUser();
    
    if (response.error) {
      // Check if this is an authentication failure (token invalid/expired) vs
      // network error. The backend's /api/auth/me returns "Not authenticated"
      // for an invalid token — previously that string wasn't matched here, so a
      // dead token fell through to the "network error" branch and the app kept a
      // stale cached session, dead-ending every screen instead of prompting login.
      const isAuthError = isAuthErrorMessage(response.error);
      
      if (isAuthError) {
        // Token is invalid - clear everything and require re-login
        if (__DEV__) console.log('[Auth] Token invalid, clearing auth state');
        await api.setToken(null);
        await offlineStorage.clearCachedAuthData();
        set({ 
          user: null, 
          token: null,
          isAuthenticated: false, 
          isLoading: false,
          isInitialized: true 
        });
        return;
      }
      
      // Network error or server unreachable - try cached data as fallback
      const cachedAuth = await offlineStorage.getCachedAuthData();
      
      if (cachedAuth && cachedAuth.userData) {
        if (__DEV__) console.log('[Auth] Network error, using cached auth data for offline mode');
        // Normalize permissions to array to prevent runtime errors from old cache data
        const normalizedRoleInfo = cachedAuth.roleInfo ? {
          ...cachedAuth.roleInfo,
          permissions: Array.isArray(cachedAuth.roleInfo.permissions) ? cachedAuth.roleInfo.permissions : []
        } : null;
        // Sync token from API client (token may work when network returns)
        const currentToken = await api.getToken();
        set({ 
          user: cachedAuth.userData, 
          token: currentToken,
          businessSettings: cachedAuth.businessSettings,
          roleInfo: normalizedRoleInfo,
          isAuthenticated: true, 
          isLoading: false,
          isInitialized: true 
        });
        
        // Sync theme mode from cached settings
        if (cachedAuth.businessSettings?.themeMode) {
          useThemeStore.getState().initializeFromServer(cachedAuth.businessSettings.themeMode as ThemeMode);
        }
        return;
      }
      
      await api.setToken(null);
      set({ 
        user: null, 
        token: null,
        isAuthenticated: false, 
        isLoading: false,
        isInitialized: true 
      });
      return;
    }

    // Extract worker permissions from response
    const workerPerms = response.data?.workerPermissions || [];
    const isWorkerUser = response.data?.isWorker || false;
    
    // Sync token from API client
    const currentToken = await api.getToken();
    
    set({ 
      user: response.data, 
      token: currentToken,
      workerPermissions: workerPerms,
      isWorker: isWorkerUser,
      isAuthenticated: true, 
      isLoading: false,
    });

    // Authoritative owner correction. /api/auth/me is the source of truth for
    // ownership (server computes isOwner from real team memberships). If the
    // server says this account owns its business, immediately overwrite any
    // stale cached worker role so the dashboard never shows a wrong
    // "Team member" badge for an owner — even before fetchRoleInfo runs or if
    // its /api/team/my-role call later blips. Never force the worker case here.
    if ((response.data as any)?.isOwner === true) {
      set({
        roleInfo: {
          roleId: 'owner',
          roleName: 'OWNER',
          permissions: ['*'],
          hasCustomPermissions: false,
          isOwner: true,
        },
      });
    }

    const settingsResponse = await api.get<BusinessSettings>('/api/business-settings');
    if (settingsResponse.data) {
      set({ businessSettings: settingsResponse.data });
      
      if (settingsResponse.data.themeMode) {
        useThemeStore.getState().initializeFromServer(settingsResponse.data.themeMode);
      }
    }
    
    await get().fetchRoleInfo();
    
    await get().fetchTeamState();
    
    set({ isInitialized: true });
    
    const currentState = get();
    await offlineStorage.cacheAuthData(currentState.user, currentState.businessSettings, currentState.roleInfo);
  },

  forceRefreshAuth: async () => {
    set({ isInitialized: false, isAuthenticated: false });
    await get().checkAuth();
  },

  fetchRoleInfo: async () => {
    const { isOnline } = useOfflineStore.getState();
    // Only default to OWNER when the authoritative /api/auth/me isOwner flag
    // says so. A freshly-joined subcontractor has isOwner=false, so we leave
    // roleInfo unresolved (dashboard shows a brief loading state) rather than
    // flashing the owner dashboard before my-role settles.
    const serverOwner = (get().user as any)?.isOwner === true;
    if (!isOnline) {
      const currentRoleInfo = get().roleInfo;
      if (!currentRoleInfo && serverOwner) {
        set({
          roleInfo: {
            roleId: 'owner',
            roleName: 'OWNER',
            permissions: ['*'],
            hasCustomPermissions: false,
            isOwner: true,
          }
        });
      }
      return;
    }
    
    try {
      const roleResponse = await api.get<{
        roleId?: string;
        roleName?: string;
        role?: string;
        permissions: string[] | Record<string, boolean>;
        hasCustomPermissions?: boolean;
        isOwner?: boolean;
      }>('/api/team/my-role');
      
      if (roleResponse.data) {
        const data = roleResponse.data as any;
        const isOwnerRole = data.isOwner === true || data.role === 'owner' ||
          String(data.roleName || '').toLowerCase().includes('owner');
        const roleName = data.roleName || (isOwnerRole ? 'OWNER' : data.role?.toUpperCase() || 'STAFF');
        const roleId = data.roleId || data.role || (isOwnerRole ? 'owner' : 'staff');
        const permissions = Array.isArray(data.permissions) ? data.permissions : (isOwnerRole ? ['*'] : []);
        set({
          roleInfo: {
            roleId,
            roleName,
            permissions,
            hasCustomPermissions: data.hasCustomPermissions || false,
            isOwner: isOwnerRole,
          }
        });
        const rnLower = roleName.toLowerCase();
        locationTracking.setSubcontractorMode(rnLower.includes('subcontractor') || rnLower.includes('sub_contractor'));
      } else if (!get().roleInfo && serverOwner) {
        // No response AND no prior role known → cold-start unknown. Only assume
        // owner when the authoritative isOwner flag agrees (never escalate a
        // joined subcontractor to owner on an empty response).
        set({
          roleInfo: {
            roleId: 'owner',
            roleName: 'OWNER',
            permissions: ['*'],
            hasCustomPermissions: false,
            isOwner: true,
          }
        });
      }
    } catch (error) {
      // Transient role-fetch failure (e.g. on focus/pull-to-refresh): preserve
      // the existing role rather than escalating to owner. Only fall back to the
      // owner default when no role has ever been resolved on this device — never
      // overwrite an already-known subcontractor/worker role on a blip.
      if (!get().roleInfo && serverOwner) {
        console.warn('[Auth] Failed to fetch role info with no prior role, defaulting to owner:', error);
        locationTracking.setSubcontractorMode(false);
        set({
          roleInfo: {
            roleId: 'owner',
            roleName: 'OWNER',
            permissions: ['*'],
            hasCustomPermissions: false,
            isOwner: true,
          }
        });
      } else {
        console.warn('[Auth] Failed to refresh role info, keeping existing role:', error);
      }
    }
  },

  clearError: () => set({ error: null }),

  fetchBusinessSettings: async () => {
    const { isOnline } = useOfflineStore.getState();
    if (!isOnline) {
      // Offline - keep existing cached settings
      return;
    }
    
    const settingsResponse = await api.get<BusinessSettings>('/api/business-settings');
    if (settingsResponse.data) {
      set({ businessSettings: settingsResponse.data });
    }
  },

  setBusinessSettings: (settings: BusinessSettings) => {
    set({ businessSettings: settings });
  },

  setOnboardingFinishing: (value: boolean) => {
    set({ onboardingFinishing: value });
  },

  setDashboardReady: (value: boolean) => {
    set({ dashboardReady: value });
  },

  setUser: (user: User) => {
    set({ user });
  },

  refreshUser: async () => {
    const { isOnline } = useOfflineStore.getState();
    if (!isOnline) {
      return;
    }
    
    const response = await api.getCurrentUser();
    if (response.data) {
      const workerPerms = response.data.workerPermissions || [];
      const isWorkerUser = response.data.isWorker || false;
      
      set({ 
        user: response.data,
        workerPermissions: workerPerms,
        isWorker: isWorkerUser,
      });

      // Self-heal a stale cached role. refreshUser runs on app focus /
      // pull-to-refresh even when checkAuth's init guard short-circuits, so any
      // account stuck showing a stale badge (an owner shown as "Team member", a
      // subcontractor shown as "Team member", etc.) recovers here: re-fetch the
      // authoritative role from the server so the real roleName (OWNER /
      // Subcontractor / Worker) is restored without a reinstall or re-login.
      await get().fetchRoleInfo();
      
      const state = get();
      await offlineStorage.cacheAuthData(state.user, state.businessSettings, state.roleInfo);
    }
  },

  updateBusinessSettings: async (settings: Partial<BusinessSettings>) => {
    const response = await api.patch<BusinessSettings>('/api/business-settings', settings);
    if (response.data) {
      set({ businessSettings: response.data });
      return true;
    }
    return false;
  },
  
  hasPermission: (permission: string) => {
    const { roleInfo } = get();
    if (!roleInfo) return false;
    if (roleInfo.isOwner) return true;
    // Guard against undefined permissions array
    const permissions = Array.isArray(roleInfo.permissions) ? roleInfo.permissions : [];
    if (permissions.includes('*')) return true;
    return permissions.includes(permission);
  },
  
  hasWorkerPermission: (permission: string) => {
    const { workerPermissions, roleInfo } = get();
    // Owners have all permissions
    if (roleInfo?.isOwner) return true;
    // Guard against undefined workerPermissions array
    const perms = Array.isArray(workerPermissions) ? workerPermissions : [];
    return perms.includes(permission);
  },
  
  isOwner: () => {
    const { roleInfo } = get();
    return roleInfo?.isOwner ?? false;
  },
  
  isStaff: () => {
    const { roleInfo } = get();
    return roleInfo !== null && !roleInfo.isOwner;
  },
  
  fetchTeamState: async (forceRefresh = false) => {
    const { isOnline } = useOfflineStore.getState();
    if (!isOnline) {
      return;
    }
    
    // Skip if recently fetched (within 5 minutes) and not forcing refresh
    const { teamState } = get();
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    if (!forceRefresh && teamState.lastFetched && Date.now() - teamState.lastFetched < CACHE_DURATION) {
      return;
    }
    
    set({ teamState: { ...teamState, isLoading: true } });
    
    try {
      const membersResponse = await api.get<any[]>('/api/team/members');
      const members = Array.isArray(membersResponse.data) ? membersResponse.data : [];
      const acceptedMembers = members.filter((m: any) => m.inviteStatus === 'accepted');
      
      set({
        teamState: {
          hasActiveTeam: acceptedMembers.length > 0,
          activeTeamCount: acceptedMembers.length,
          members: members,
          isLoading: false,
          lastFetched: Date.now(),
        }
      });
    } catch (e) {
      if (__DEV__) console.log('[Auth] Failed to fetch team state:', e);
      set({
        teamState: {
          ...get().teamState,
          isLoading: false,
        }
      });
    }
  },
  
  hasActiveTeam: () => {
    const { teamState, roleInfo } = get();
    return roleInfo?.isOwner === true && teamState.hasActiveTeam;
  },
  
  getTeamMembers: () => {
    return get().teamState.members;
  },
}));

// ============ JOBS STORE (with offline support) ============

interface JobsState {
  jobs: Job[];
  todaysJobs: Job[];
  isLoading: boolean;
  error: string | null;
  isOfflineData: boolean;
  
  fetchJobs: () => Promise<void>;
  fetchTodaysJobs: () => Promise<void>;
  getJob: (id: string) => Promise<Job | null>;
  updateJobStatus: (jobId: string, status: Job['status']) => Promise<boolean>;
  updateJobNotes: (jobId: string, notes: string) => Promise<boolean>;
  createJob: (job: Partial<Job>) => Promise<Job | null>;
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: [],
  todaysJobs: [],
  isLoading: true,
  error: null,
  isOfflineData: false,

  fetchJobs: async () => {
    // Generation guard: discard responses that arrive after a newer request started.
    const gen = ++_jobsFetchGen;
    set({ isLoading: true, error: null });
    
    const isOnline = useOfflineStore.getState().isOnline;
    
    if (!isOnline) {
      try {
        const cachedJobs = await offlineStorage.getCachedJobs();
        if (gen !== _jobsFetchGen) return;
        set({ 
          jobs: cachedJobs as Job[], 
          isLoading: false, 
          isOfflineData: true,
          error: null 
        });
        return;
      } catch (e) {
        if (__DEV__) console.log('[JobsStore] Offline cache read failed:', e);
        if (gen !== _jobsFetchGen) return;
        set({ isLoading: false, error: null, isOfflineData: true });
        return;
      }
    }
    
    const response = await api.get<Job[]>('/api/jobs');
    if (gen !== _jobsFetchGen) return; // stale — a newer fetch already owns the state
    
    if (response.error) {
      try {
        const cachedJobs = await offlineStorage.getCachedJobs();
        if (cachedJobs.length > 0) {
          if (gen !== _jobsFetchGen) return;
          set({ 
            jobs: cachedJobs as Job[], 
            isLoading: false, 
            isOfflineData: true,
            error: null 
          });
          return;
        }
      } catch (e) {
        if (__DEV__) console.log('[JobsStore] Cache fallback failed:', e);
      }
      set({ isLoading: false, error: null, isOfflineData: true });
      return;
    }

    try {
      await offlineStorage.cacheJobs(response.data || []);
    } catch (e) {
      if (__DEV__) console.log('[JobsStore] Failed to cache jobs:', e);
    }

    set({ jobs: response.data || [], isLoading: false, isOfflineData: false });
  },

  fetchTodaysJobs: async () => {
    const gen = ++_todaysJobsFetchGen;
    set({ isLoading: true, error: null });
    
    const isOnline = useOfflineStore.getState().isOnline;
    const today = new Date().toDateString();
    
    if (!isOnline) {
      try {
        const cachedJobs = await offlineStorage.getCachedJobs();
        const todaysJobs = cachedJobs.filter(j => 
          j.scheduledAt && new Date(j.scheduledAt).toDateString() === today
        );
        if (gen !== _todaysJobsFetchGen) return;
        set({ 
          todaysJobs: todaysJobs as Job[], 
          isLoading: false,
          isOfflineData: true,
          error: null 
        });
        return;
      } catch (e) {
        if (__DEV__) console.log('[JobsStore] Offline cache read failed:', e);
        if (gen !== _todaysJobsFetchGen) return;
        set({ isLoading: false, error: null, isOfflineData: true });
        return;
      }
    }
    
    const response = await api.get<Job[]>('/api/jobs/today');
    if (gen !== _todaysJobsFetchGen) return;
    
    if (response.error) {
      try {
        const cachedJobs = await offlineStorage.getCachedJobs();
        const todaysJobs = cachedJobs.filter(j => 
          j.scheduledAt && new Date(j.scheduledAt).toDateString() === today
        );
        if (gen !== _todaysJobsFetchGen) return;
        set({ 
          todaysJobs: todaysJobs as Job[], 
          isLoading: false,
          isOfflineData: true,
          error: null 
        });
        return;
      } catch (e) {
        if (__DEV__) console.log('[JobsStore] Cache fallback failed:', e);
      }
      set({ isLoading: false, error: null, isOfflineData: true });
      return;
    }

    set({ todaysJobs: response.data || [], isLoading: false, isOfflineData: false });
  },

  getJob: async (id: string) => {
    const isOnline = useOfflineStore.getState().isOnline;
    
    if (!isOnline) {
      try {
        const cached = await offlineStorage.getCachedJob(id);
        return cached as Job | null;
      } catch (e) {
        return null;
      }
    }
    
    const response = await api.get<Job>(`/api/jobs/${id}`);
    if (response.data) {
      return response.data;
    }
    
    try {
      const cached = await offlineStorage.getCachedJob(id);
      return cached as Job | null;
    } catch (e) {
      return null;
    }
  },

  updateJobStatus: async (jobId: string, status: Job['status']) => {
    const { jobs, todaysJobs } = get();
    const isOnline = useOfflineStore.getState().isOnline;
    
    const previousJobs = jobs;
    const previousTodaysJobs = todaysJobs;
    
    set({
      jobs: jobs.map(j => j.id === jobId ? { ...j, status } : j),
      todaysJobs: todaysJobs.map(j => j.id === jobId ? { ...j, status } : j),
    });
    
    if (isOnline) {
      try {
        const response = await api.patch<Job>(`/api/jobs/${jobId}`, { status });
        
        if (response.error) {
          // Only queue for later sync when the request never reached the
          // server (offline/timeout). A real server rejection (safety gate,
          // permissions, validation) is permanent — queueing it just retries
          // a guaranteed failure forever and leaves a stuck "tap to sync"
          // badge. Revert and surface the server's message instead.
          const isConnectivityFailure =
            (response as any).isOffline ||
            /offline|timed out|network|connection/i.test(response.error);
          if (!isConnectivityFailure) {
            set({ jobs: previousJobs, todaysJobs: previousTodaysJobs, error: response.error });
            return false;
          }
          try {
            await offlineStorage.updateJobOffline(jobId, { status });
          } catch (queueErr) {
            if (__DEV__) console.log('[JobsStore] Failed to queue offline update, reverting:', queueErr);
            set({ jobs: previousJobs, todaysJobs: previousTodaysJobs, error: 'Failed to update job status' });
            return false;
          }
        } else if (response.data) {
          await offlineStorage.cacheJobs([response.data]);
        }
      } catch (e) {
        if (__DEV__) console.log('[JobsStore] Network error, queueing status update:', e);
        try {
          await offlineStorage.updateJobOffline(jobId, { status });
        } catch (queueErr) {
          if (__DEV__) console.log('[JobsStore] Failed to queue offline update, reverting:', queueErr);
          set({ jobs: previousJobs, todaysJobs: previousTodaysJobs, error: 'Failed to update job status' });
          return false;
        }
      }
    } else {
      try {
        await offlineStorage.updateJobOffline(jobId, { status });
      } catch (e) {
        if (__DEV__) console.log('[JobsStore] Failed to queue offline update, reverting:', e);
        set({ jobs: previousJobs, todaysJobs: previousTodaysJobs, error: 'Failed to update job status' });
        return false;
      }
    }

    if (status === 'done') celebrate('job_completed');
    return true;
  },

  updateJobNotes: async (jobId: string, notes: string) => {
    const { jobs, todaysJobs } = get();
    const previousJobs = jobs;
    const previousTodaysJobs = todaysJobs;
    set({
      jobs: jobs.map(j => j.id === jobId ? { ...j, notes } : j),
      todaysJobs: todaysJobs.map(j => j.id === jobId ? { ...j, notes } : j),
    });
    try {
      const response = await api.patch<Job>(`/api/jobs/${jobId}`, { notes });
      if (response.error) {
        try {
          await offlineStorage.updateJobOffline(jobId, { notes });
        } catch {
          set({ jobs: previousJobs, todaysJobs: previousTodaysJobs, error: 'Failed to update job notes' });
          return false;
        }
      } else if (response.data) {
        await offlineStorage.cacheJobs([response.data]);
      }
      return true;
    } catch {
      try {
        await offlineStorage.updateJobOffline(jobId, { notes });
        return true;
      } catch {
        set({ jobs: previousJobs, todaysJobs: previousTodaysJobs, error: 'Failed to update job notes' });
        return false;
      }
    }
  },

  createJob: async (job: Partial<Job>) => {
    const isOnline = useOfflineStore.getState().isOnline;
    
    if (isOnline) {
      try {
        const response = await api.post<Job>('/api/jobs', job);
        if (response.data) {
          const { jobs } = get();
          set({ jobs: [...jobs, response.data] });
          
          // Cache the new job
          await offlineStorage.cacheJobs([response.data]);
          
          return response.data;
        }
        // API error - fall through to offline creation
      } catch (e) {
        // Network error - create offline
        if (__DEV__) console.log('[JobsStore] Network error, creating job offline:', e);
      }
      
      // Fall back to offline creation
      try {
        const offlineJob = await offlineStorage.saveJobOffline(job, 'create');
        const { jobs } = get();
        set({ jobs: [...jobs, offlineJob as Job] });
        return offlineJob as Job;
      } catch (e) {
        if (__DEV__) console.log('[JobsStore] Failed to create offline job:', e);
        return null;
      }
    } else {
      // Create offline
      try {
        const offlineJob = await offlineStorage.saveJobOffline(job, 'create');
        const { jobs } = get();
        set({ jobs: [...jobs, offlineJob as Job] });
        return offlineJob as Job;
      } catch (e) {
        if (__DEV__) console.log('[JobsStore] Failed to create offline job:', e);
        return null;
      }
    }
  },
}));

const CLIENTS_TTL_MS = 5 * 60 * 1000; // 5 minutes
interface ClientsState {
  clients: Client[];
  isLoading: boolean;
  error: string | null;
  isOfflineData: boolean;
  lastFetched: number | null;
  
  fetchClients: () => Promise<void>;
  getClient: (id: string) => Promise<Client | null>;
  createClient: (client: Partial<Client>) => Promise<Client | null>;
  updateClient: (id: string, client: Partial<Client>) => Promise<boolean>;
  deleteClient: (id: string, deleteAssociated?: boolean) => Promise<boolean>;
}

export const useClientsStore = create<ClientsState>((set, get) => ({
  clients: [],
  isLoading: true,
  error: null,
  isOfflineData: false,
  lastFetched: null,

  fetchClients: (): Promise<void> => {
    // TTL guard: skip the network round-trip if clients were loaded recently.
    // A null lastFetched (never loaded) always falls through. An empty response
    // is also cached — accounts with zero clients must not re-fetch every visit.
    const { lastFetched } = get();
    if (lastFetched !== null && Date.now() - lastFetched < CLIENTS_TTL_MS) {
      return Promise.resolve();
    }

    // Coalesce concurrent callers onto the same in-flight Promise so parallel
    // useFocusEffect triggers (e.g. quotes + invoices screens) share one request
    // and all callers properly await the same result.
    if (_clientsFetchInFlight) {
      return _clientsFetchInFlight;
    }

    set({ isLoading: true, error: null });

    // Capture generation at request start; if logout fires mid-flight the
    // counter increments and every generation check below discards the result
    // instead of committing stale data from a prior session.
    const myGen = _clientsFetchGen;

    _clientsFetchInFlight = (async () => {
      try {
        const isOnline = useOfflineStore.getState().isOnline;

        // Offline: serve from cache silently
        if (!isOnline) {
          try {
            const cachedClients = await offlineStorage.getCachedClients();
            if (_clientsFetchGen === myGen) {
              set({ clients: cachedClients as Client[], isLoading: false, isOfflineData: true, error: null });
            }
          } catch (e) {
            if (__DEV__) console.log('[ClientsStore] Offline cache read failed:', e);
            if (_clientsFetchGen === myGen) set({ isLoading: false, error: null, isOfflineData: true });
          }
          return;
        }

        const response = await api.get<Client[]>('/api/clients');

        // Discard if a logout occurred while the request was in flight
        if (_clientsFetchGen !== myGen) return;

        if (response.error) {
          // Fall back to cached data silently on API error
          try {
            const cachedClients = await offlineStorage.getCachedClients();
            if (cachedClients.length > 0) {
              if (_clientsFetchGen === myGen) {
                set({ clients: cachedClients as Client[], isLoading: false, isOfflineData: true, error: null });
              }
              return;
            }
          } catch (e) {
            if (__DEV__) console.log('[ClientsStore] Cache fallback failed:', e);
          }
          if (_clientsFetchGen === myGen) set({ isLoading: false, error: null, isOfflineData: true });
          return;
        }

        // Write to the offline cache, then recheck before committing to state.
        // A logout during cacheClients would increment the generation and clear
        // the SQLite cache; without this recheck the stale write would re-pollute
        // the cache and commit the prior account's data to the new session.
        try {
          await offlineStorage.cacheClients(response.data || []);
        } catch (e) {
          if (__DEV__) console.log('[ClientsStore] Failed to cache clients:', e);
        }

        // Final generation check — must happen AFTER every awaited operation.
        if (_clientsFetchGen !== myGen) return;

        set({ clients: response.data || [], isLoading: false, isOfflineData: false, lastFetched: Date.now() });
      } finally {
        // Only clear the in-flight marker when our generation still owns it.
        // If logout incremented _clientsFetchGen (and possibly a new-session fetch
        // has already started), leave the new marker alone so it can coalesce.
        if (_clientsFetchGen === myGen) {
          _clientsFetchInFlight = null;
        }
      }
    })();

    return _clientsFetchInFlight;
  },

  getClient: async (id: string) => {
    const isOnline = useOfflineStore.getState().isOnline;
    
    // Check offline FIRST - use cache silently
    if (!isOnline) {
      try {
        const cached = await offlineStorage.getCachedClient(id);
        return cached as Client | null;
      } catch (e) {
        if (__DEV__) console.log('[ClientsStore] Offline cache read failed:', e);
        return null;
      }
    }
    
    const response = await api.get<Client>(`/api/clients/${id}`);
    if (response.data) {
      return response.data;
    }
    
    // Fall back to cache on API error
    try {
      const cached = await offlineStorage.getCachedClient(id);
      return cached as Client | null;
    } catch (e) {
      return null;
    }
  },

  createClient: async (client: Partial<Client>) => {
    const isOnline = useOfflineStore.getState().isOnline;
    
    if (isOnline) {
      try {
        const response = await api.post<Client>('/api/clients', client);
        if (response.data) {
          const { clients } = get();
          // Invalidate TTL so the next fetchClients() re-fetches from the server.
          set({ clients: [...clients, response.data], lastFetched: null });
          
          // Cache the new client
          await offlineStorage.cacheClients([response.data]);
          
          return response.data;
        }
        // API error - fall through to offline creation
      } catch (e) {
        // Network error - create offline
        if (__DEV__) console.log('[ClientsStore] Network error, creating client offline:', e);
      }
      
      // Fall back to offline creation
      try {
        const offlineClient = await offlineStorage.saveClientOffline(client, 'create');
        const { clients } = get();
        set({ clients: [...clients, offlineClient as Client] });
        return offlineClient as Client;
      } catch (e) {
        if (__DEV__) console.log('[ClientsStore] Failed to create offline client:', e);
        return null;
      }
    } else {
      // Create offline
      try {
        const offlineClient = await offlineStorage.saveClientOffline(client, 'create');
        const { clients } = get();
        set({ clients: [...clients, offlineClient as Client] });
        return offlineClient as Client;
      } catch (e) {
        if (__DEV__) console.log('[ClientsStore] Failed to create offline client:', e);
        return null;
      }
    }
  },

  updateClient: async (id: string, client: Partial<Client>) => {
    const { clients } = get();
    const isOnline = useOfflineStore.getState().isOnline;
    
    const previousClients = clients;
    
    // Invalidate TTL so the next fetchClients() re-fetches fresh data.
    set({ clients: clients.map(c => c.id === id ? { ...c, ...client } : c), lastFetched: null });
    
    if (isOnline) {
      try {
        const response = await api.patch<Client>(`/api/clients/${id}`, client);
        if (response.error) {
          try {
            await offlineStorage.updateClientOffline(id, client);
          } catch (queueErr) {
            if (__DEV__) console.log('[ClientsStore] Failed to queue offline update, reverting:', queueErr);
            set({ clients: previousClients, error: 'Failed to update client' });
            return false;
          }
        } else if (response.data) {
          set({ clients: clients.map(c => c.id === id ? response.data! : c) });
          await offlineStorage.cacheClients([response.data]);
        }
      } catch (e) {
        if (__DEV__) console.log('[ClientsStore] Network error, queueing update:', e);
        try {
          await offlineStorage.updateClientOffline(id, client);
        } catch (queueErr) {
          if (__DEV__) console.log('[ClientsStore] Failed to queue offline update, reverting:', queueErr);
          set({ clients: previousClients, error: 'Failed to update client' });
          return false;
        }
      }
    } else {
      try {
        await offlineStorage.updateClientOffline(id, client);
      } catch (e) {
        if (__DEV__) console.log('[ClientsStore] Failed to queue offline update, reverting:', e);
        set({ clients: previousClients, error: 'Failed to update client' });
        return false;
      }
    }
    return true;
  },

  deleteClient: async (id: string, deleteAssociated: boolean = false) => {
    const { clients } = get();
    const isOnline = useOfflineStore.getState().isOnline;
    
    if (!isOnline) {
      // Can't delete while offline - inform user
      if (__DEV__) console.log('[ClientsStore] Cannot delete while offline');
      return false;
    }
    
    // Optimistic update
    set({ clients: clients.filter(c => c.id !== id) });
    
    try {
      const url = deleteAssociated ? `/api/clients/${id}?deleteAssociated=true` : `/api/clients/${id}`;
      const response = await api.delete(url);
      if (response.error) {
        // Revert optimistic update if delete fails
        set({ clients });
        return false;
      }
      // Remove from cache on successful delete and invalidate TTL.
      await offlineStorage.removeFromCache('clients', id);
      set({ lastFetched: null });
      return true;
    } catch (e) {
      // Network error - revert optimistic update
      if (__DEV__) console.log('[ClientsStore] Network error during delete:', e);
      set({ clients });
      return false;
    }
  },
}));

// ============ QUOTES STORE (with offline support) ============

interface QuotesState {
  quotes: Quote[];
  isLoading: boolean;
  error: string | null;
  isOfflineData: boolean;
  
  fetchQuotes: () => Promise<void>;
  getQuote: (id: string) => Promise<Quote | null>;
  createQuote: (quote: Partial<Quote>) => Promise<Quote | null>;
  updateQuote: (id: string, quote: Partial<Quote>) => Promise<boolean>;
  updateQuoteStatus: (id: string, status: Quote['status']) => Promise<boolean>;
  deleteQuote: (id: string) => Promise<boolean>;
}

export const useQuotesStore = create<QuotesState>((set, get) => ({
  quotes: [],
  isLoading: true,
  error: null,
  isOfflineData: false,

  fetchQuotes: async () => {
    set({ isLoading: true, error: null });
    
    const isOnline = useOfflineStore.getState().isOnline;
    
    // Check offline FIRST - use cache silently, NO errors
    if (!isOnline) {
      try {
        const cachedQuotes = await offlineStorage.getCachedQuotes();
        set({ 
          quotes: cachedQuotes as Quote[], 
          isLoading: false,
          isOfflineData: true,
          error: null
        });
        return;
      } catch (e) {
        if (__DEV__) console.log('[QuotesStore] Offline cache read failed:', e);
        set({ isLoading: false, error: null, isOfflineData: true });
        return;
      }
    }
    
    const response = await api.get<Quote[]>('/api/quotes');
    
    if (response.error) {
      // Fall back to cached data silently
      try {
        const cachedQuotes = await offlineStorage.getCachedQuotes();
        if (cachedQuotes.length > 0) {
          set({ 
            quotes: cachedQuotes as Quote[], 
            isLoading: false,
            isOfflineData: true,
            error: null 
          });
          return;
        }
      } catch (e) {
        if (__DEV__) console.log('[QuotesStore] Cache fallback failed:', e);
      }
      set({ isLoading: false, error: null, isOfflineData: true });
      return;
    }

    // Cache the data
    try {
      await offlineStorage.cacheQuotes(response.data || []);
    } catch (e) {
      if (__DEV__) console.log('[QuotesStore] Failed to cache quotes:', e);
    }

    set({ quotes: response.data || [], isLoading: false, isOfflineData: false });
  },

  getQuote: async (id: string) => {
    const isOnline = useOfflineStore.getState().isOnline;
    
    // Check offline FIRST - use cache silently
    if (!isOnline) {
      try {
        const cached = await offlineStorage.getCachedQuote(id);
        return cached as Quote | null;
      } catch (e) {
        if (__DEV__) console.log('[QuotesStore] Offline cache read failed:', e);
        return null;
      }
    }
    
    const response = await api.get<Quote>(`/api/quotes/${id}`);
    if (response.data) {
      return response.data;
    }
    
    // Fall back to cache on API error
    try {
      const cached = await offlineStorage.getCachedQuote(id);
      return cached as Quote | null;
    } catch (e) {
      return null;
    }
  },

  createQuote: async (quote: Partial<Quote>) => {
    const isOnline = useOfflineStore.getState().isOnline;
    
    if (isOnline) {
      try {
        const response = await api.post<Quote>('/api/quotes', quote);
        if (response.data) {
          const { quotes } = get();
          set({ quotes: [...quotes, response.data] });
          
          // Cache the new quote
          await offlineStorage.cacheQuotes([response.data]);
          
          return response.data;
        }
        // API error - fall through to offline creation
      } catch (e) {
        // Network error - create offline
        if (__DEV__) console.log('[QuotesStore] Network error, creating quote offline:', e);
      }
      
      // Fall back to offline creation
      try {
        const offlineQuote = await offlineStorage.saveQuoteOffline(quote as Parameters<typeof offlineStorage.saveQuoteOffline>[0]);
        const { quotes } = get();
        set({ quotes: [...quotes, offlineQuote as Quote] });
        return offlineQuote as Quote;
      } catch (e) {
        if (__DEV__) console.log('[QuotesStore] Failed to create offline quote:', e);
        return null;
      }
    } else {
      // Create offline
      try {
        const offlineQuote = await offlineStorage.saveQuoteOffline(quote as Parameters<typeof offlineStorage.saveQuoteOffline>[0]);
        const { quotes } = get();
        set({ quotes: [...quotes, offlineQuote as Quote] });
        return offlineQuote as Quote;
      } catch (e) {
        if (__DEV__) console.log('[QuotesStore] Failed to create offline quote:', e);
        return null;
      }
    }
  },

  updateQuote: async (id: string, quote: Partial<Quote>) => {
    const { quotes } = get();
    const isOnline = useOfflineStore.getState().isOnline;
    
    const previousQuotes = quotes;
    
    set({ quotes: quotes.map(q => q.id === id ? { ...q, ...quote } : q) });
    
    if (isOnline) {
      try {
        const response = await api.patch<Quote>(`/api/quotes/${id}`, quote);
        if (response.error) {
          try {
            await offlineStorage.updateQuoteOffline(id, quote);
          } catch (queueErr) {
            if (__DEV__) console.log('[QuotesStore] Failed to queue offline update, reverting:', queueErr);
            set({ quotes: previousQuotes, error: 'Failed to update quote' });
            return false;
          }
        } else if (response.data) {
          set({ quotes: quotes.map(q => q.id === id ? response.data! : q) });
          await offlineStorage.cacheQuotes([response.data]);
        }
      } catch (e) {
        if (__DEV__) console.log('[QuotesStore] Network error, queueing update:', e);
        try {
          await offlineStorage.updateQuoteOffline(id, quote);
        } catch (queueErr) {
          if (__DEV__) console.log('[QuotesStore] Failed to queue offline update, reverting:', queueErr);
          set({ quotes: previousQuotes, error: 'Failed to update quote' });
          return false;
        }
      }
    } else {
      try {
        await offlineStorage.updateQuoteOffline(id, quote);
      } catch (e) {
        if (__DEV__) console.log('[QuotesStore] Failed to queue offline update, reverting:', e);
        set({ quotes: previousQuotes, error: 'Failed to update quote' });
        return false;
      }
    }
    return true;
  },

  updateQuoteStatus: async (id: string, status: Quote['status']) => {
    const { quotes } = get();
    const isOnline = useOfflineStore.getState().isOnline;
    
    const previousQuotes = quotes;
    
    set({ quotes: quotes.map(q => q.id === id ? { ...q, status } : q) });
    
    if (isOnline) {
      try {
        const response = await api.patch<Quote>(`/api/quotes/${id}`, { status });
        if (response.error) {
          try {
            await offlineStorage.updateQuoteOffline(id, { status });
          } catch (queueErr) {
            if (__DEV__) console.log('[QuotesStore] Failed to queue offline status update, reverting:', queueErr);
            set({ quotes: previousQuotes, error: 'Failed to update quote status' });
            return false;
          }
        } else if (response.data) {
          await offlineStorage.cacheQuotes([response.data]);
        }
      } catch (e) {
        if (__DEV__) console.log('[QuotesStore] Network error, queueing status update:', e);
        try {
          await offlineStorage.updateQuoteOffline(id, { status });
        } catch (queueErr) {
          if (__DEV__) console.log('[QuotesStore] Failed to queue offline status update, reverting:', queueErr);
          set({ quotes: previousQuotes, error: 'Failed to update quote status' });
          return false;
        }
      }
    } else {
      try {
        await offlineStorage.updateQuoteOffline(id, { status });
      } catch (e) {
        if (__DEV__) console.log('[QuotesStore] Failed to queue offline status update, reverting:', e);
        set({ quotes: previousQuotes, error: 'Failed to update quote status' });
        return false;
      }
    }
    if (status === 'accepted') celebrate('quote_accepted');
    return true;
  },

  deleteQuote: async (id: string) => {
    const { quotes } = get();
    const isOnline = useOfflineStore.getState().isOnline;
    
    if (!isOnline) {
      // Can't delete while offline - inform user
      if (__DEV__) console.log('[QuotesStore] Cannot delete while offline');
      return false;
    }
    
    // Optimistic update
    set({ quotes: quotes.filter(q => q.id !== id) });
    
    try {
      const response = await api.delete(`/api/quotes/${id}`);
      if (response.error) {
        set({ quotes });
        return false;
      }
      // Remove from cache on successful delete
      await offlineStorage.removeFromCache('quotes', id);
      return true;
    } catch (e) {
      if (__DEV__) console.log('[QuotesStore] Network error during delete:', e);
      set({ quotes });
      return false;
    }
  },
}));

// ============ INVOICES STORE (with offline support) ============

interface InvoicesState {
  invoices: Invoice[];
  isLoading: boolean;
  error: string | null;
  isOfflineData: boolean;
  
  fetchInvoices: () => Promise<void>;
  getInvoice: (id: string) => Promise<Invoice | null>;
  createInvoice: (invoice: Partial<Invoice>) => Promise<Invoice | null>;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => Promise<boolean>;
  updateInvoiceStatus: (id: string, status: Invoice['status']) => Promise<boolean>;
  deleteInvoice: (id: string) => Promise<boolean>;
}

export const useInvoicesStore = create<InvoicesState>((set, get) => ({
  invoices: [],
  isLoading: true,
  error: null,
  isOfflineData: false,

  fetchInvoices: async () => {
    set({ isLoading: true, error: null });
    
    const isOnline = useOfflineStore.getState().isOnline;
    
    // Check offline FIRST - use cache silently, NO errors
    if (!isOnline) {
      try {
        const cachedInvoices = await offlineStorage.getCachedInvoices();
        set({ 
          invoices: cachedInvoices as Invoice[], 
          isLoading: false,
          isOfflineData: true,
          error: null
        });
        return;
      } catch (e) {
        if (__DEV__) console.log('[InvoicesStore] Offline cache read failed:', e);
        set({ isLoading: false, error: null, isOfflineData: true });
        return;
      }
    }
    
    const response = await api.get<Invoice[]>('/api/invoices');
    
    if (response.error) {
      // Fall back to cached data silently
      try {
        const cachedInvoices = await offlineStorage.getCachedInvoices();
        if (cachedInvoices.length > 0) {
          set({ 
            invoices: cachedInvoices as Invoice[], 
            isLoading: false,
            isOfflineData: true,
            error: null 
          });
          return;
        }
      } catch (e) {
        if (__DEV__) console.log('[InvoicesStore] Cache fallback failed:', e);
      }
      set({ isLoading: false, error: null, isOfflineData: true });
      return;
    }

    // Cache the data
    try {
      await offlineStorage.cacheInvoices(response.data || []);
    } catch (e) {
      if (__DEV__) console.log('[InvoicesStore] Failed to cache invoices:', e);
    }

    set({ invoices: response.data || [], isLoading: false, isOfflineData: false });
  },

  getInvoice: async (id: string) => {
    const isOnline = useOfflineStore.getState().isOnline;
    
    // Check offline FIRST - use cache silently
    if (!isOnline) {
      try {
        const cached = await offlineStorage.getCachedInvoice(id);
        return cached as Invoice | null;
      } catch (e) {
        if (__DEV__) console.log('[InvoicesStore] Offline cache read failed:', e);
        return null;
      }
    }
    
    const response = await api.get<Invoice>(`/api/invoices/${id}`);
    if (response.data) {
      return response.data;
    }
    
    // Fall back to cache on API error
    try {
      const cached = await offlineStorage.getCachedInvoice(id);
      return cached as Invoice | null;
    } catch (e) {
      return null;
    }
  },

  createInvoice: async (invoice: Partial<Invoice>) => {
    const isOnline = useOfflineStore.getState().isOnline;
    
    if (isOnline) {
      try {
        const response = await api.post<Invoice>('/api/invoices', invoice);
        if (response.data) {
          const { invoices } = get();
          set({ invoices: [...invoices, response.data] });
          
          // Cache the new invoice
          await offlineStorage.cacheInvoices([response.data]);
          
          return response.data;
        }
        // API error - fall through to offline creation
      } catch (e) {
        // Network error - create offline
        if (__DEV__) console.log('[InvoicesStore] Network error, creating invoice offline:', e);
      }
      
      // Fall back to offline creation
      try {
        const offlineInvoice = await offlineStorage.saveInvoiceOffline(invoice as Parameters<typeof offlineStorage.saveInvoiceOffline>[0]);
        const { invoices } = get();
        set({ invoices: [...invoices, offlineInvoice as Invoice] });
        return offlineInvoice as Invoice;
      } catch (e) {
        if (__DEV__) console.log('[InvoicesStore] Failed to create offline invoice:', e);
        return null;
      }
    } else {
      // Create offline
      try {
        const offlineInvoice = await offlineStorage.saveInvoiceOffline(invoice as Parameters<typeof offlineStorage.saveInvoiceOffline>[0]);
        const { invoices } = get();
        set({ invoices: [...invoices, offlineInvoice as Invoice] });
        return offlineInvoice as Invoice;
      } catch (e) {
        if (__DEV__) console.log('[InvoicesStore] Failed to create offline invoice:', e);
        return null;
      }
    }
  },

  updateInvoice: async (id: string, invoice: Partial<Invoice>) => {
    const { invoices } = get();
    const isOnline = useOfflineStore.getState().isOnline;
    
    const previousInvoices = invoices;
    
    set({ invoices: invoices.map(i => i.id === id ? { ...i, ...invoice } : i) });
    
    if (isOnline) {
      try {
        const response = await api.patch<Invoice>(`/api/invoices/${id}`, invoice);
        if (response.error) {
          try {
            await offlineStorage.updateInvoiceOffline(id, invoice);
          } catch (queueErr) {
            if (__DEV__) console.log('[InvoicesStore] Failed to queue offline update, reverting:', queueErr);
            set({ invoices: previousInvoices, error: 'Failed to update invoice' });
            return false;
          }
        } else if (response.data) {
          set({ invoices: invoices.map(i => i.id === id ? response.data! : i) });
          await offlineStorage.cacheInvoices([response.data]);
        }
      } catch (e) {
        if (__DEV__) console.log('[InvoicesStore] Network error, queueing update:', e);
        try {
          await offlineStorage.updateInvoiceOffline(id, invoice);
        } catch (queueErr) {
          if (__DEV__) console.log('[InvoicesStore] Failed to queue offline update, reverting:', queueErr);
          set({ invoices: previousInvoices, error: 'Failed to update invoice' });
          return false;
        }
      }
    } else {
      try {
        await offlineStorage.updateInvoiceOffline(id, invoice);
      } catch (e) {
        if (__DEV__) console.log('[InvoicesStore] Failed to queue offline update, reverting:', e);
        set({ invoices: previousInvoices, error: 'Failed to update invoice' });
        return false;
      }
    }
    return true;
  },

  updateInvoiceStatus: async (id: string, status: Invoice['status']) => {
    const { invoices } = get();
    const isOnline = useOfflineStore.getState().isOnline;
    
    const previousInvoices = invoices;
    
    set({ invoices: invoices.map(i => i.id === id ? { ...i, status } : i) });
    
    if (isOnline) {
      try {
        const response = await api.patch<Invoice>(`/api/invoices/${id}`, { status });
        if (response.error) {
          try {
            await offlineStorage.updateInvoiceOffline(id, { status });
          } catch (queueErr) {
            if (__DEV__) console.log('[InvoicesStore] Failed to queue offline status update, reverting:', queueErr);
            set({ invoices: previousInvoices, error: 'Failed to update invoice status' });
            return false;
          }
        } else if (response.data) {
          await offlineStorage.cacheInvoices([response.data]);
        }
      } catch (e) {
        if (__DEV__) console.log('[InvoicesStore] Network error, queueing status update:', e);
        try {
          await offlineStorage.updateInvoiceOffline(id, { status });
        } catch (queueErr) {
          if (__DEV__) console.log('[InvoicesStore] Failed to queue offline status update, reverting:', queueErr);
          set({ invoices: previousInvoices, error: 'Failed to update invoice status' });
          return false;
        }
      }
    } else {
      try {
        await offlineStorage.updateInvoiceOffline(id, { status });
      } catch (e) {
        if (__DEV__) console.log('[InvoicesStore] Failed to queue offline status update, reverting:', e);
        set({ invoices: previousInvoices, error: 'Failed to update invoice status' });
        return false;
      }
    }
    if (status === 'paid') celebrate('invoice_paid');
    return true;
  },

  deleteInvoice: async (id: string) => {
    const { invoices } = get();
    const isOnline = useOfflineStore.getState().isOnline;
    
    if (!isOnline) {
      // Can't delete while offline - inform user
      if (__DEV__) console.log('[InvoicesStore] Cannot delete while offline');
      return false;
    }
    
    // Optimistic update
    set({ invoices: invoices.filter(i => i.id !== id) });
    
    try {
      const response = await api.delete(`/api/invoices/${id}`);
      if (response.error) {
        set({ invoices });
        return false;
      }
      // Remove from cache on successful delete
      await offlineStorage.removeFromCache('invoices', id);
      return true;
    } catch (e) {
      if (__DEV__) console.log('[InvoicesStore] Network error during delete:', e);
      set({ invoices });
      return false;
    }
  },
}));

// ============ DASHBOARD STATS ============

interface DashboardStats {
  jobsToday: number;
  overdueJobs: number;
  pendingQuotes: number;
  thisMonthRevenue: number;
  unpaidInvoices: number;
  outstandingAmount: number;
  paidLast30Days: number;
  lastMonthRevenue: number;
  lastMonthJobsCompleted: number;
  thisMonthJobsCompleted: number;
  lastMonthQuotesSent: number;
  thisMonthQuotesSent: number;
}

interface DashboardState {
  stats: DashboardStats;
  isLoading: boolean;
  
  fetchStats: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  stats: {
    jobsToday: 0,
    overdueJobs: 0,
    pendingQuotes: 0,
    thisMonthRevenue: 0,
    unpaidInvoices: 0,
    outstandingAmount: 0,
    paidLast30Days: 0,
    lastMonthRevenue: 0,
    lastMonthJobsCompleted: 0,
    thisMonthJobsCompleted: 0,
    lastMonthQuotesSent: 0,
    thisMonthQuotesSent: 0,
  },
  isLoading: false,

  fetchStats: async () => {
    set({ isLoading: true });
    
    const isOnline = useOfflineStore.getState().isOnline;
    
    let jobs: Job[] = [];
    let quotes: Quote[] = [];
    let invoices: Invoice[] = [];
    
    // Check offline FIRST - use cached data silently
    if (!isOnline) {
      try {
        const [cachedJobs, cachedQuotes, cachedInvoices] = await Promise.all([
          offlineStorage.getCachedJobs(),
          offlineStorage.getCachedQuotes(),
          offlineStorage.getCachedInvoices(),
        ]);
        jobs = cachedJobs as Job[];
        quotes = cachedQuotes as Quote[];
        invoices = cachedInvoices as Invoice[];
      } catch (e) {
        if (__DEV__) console.log('[DashboardStore] Offline cache read failed:', e);
        set({ isLoading: false });
        return;
      }
    } else {
      // Online - fetch from API
      const [jobsRes, quotesRes, invoicesRes] = await Promise.all([
        api.get<Job[]>('/api/jobs'),
        api.get<Quote[]>('/api/quotes'),
        api.get<Invoice[]>('/api/invoices'),
      ]);

      // If any API call failed, fall back to cached data
      if (jobsRes.error || quotesRes.error || invoicesRes.error) {
        try {
          const [cachedJobs, cachedQuotes, cachedInvoices] = await Promise.all([
            offlineStorage.getCachedJobs(),
            offlineStorage.getCachedQuotes(),
            offlineStorage.getCachedInvoices(),
          ]);
          jobs = cachedJobs as Job[];
          quotes = cachedQuotes as Quote[];
          invoices = cachedInvoices as Invoice[];
        } catch (e) {
          if (__DEV__) console.log('[DashboardStore] Cache fallback failed:', e);
          set({ isLoading: false });
          return;
        }
      } else {
        jobs = jobsRes.data || [];
        quotes = quotesRes.data || [];
        invoices = invoicesRes.data || [];
      }
    }

    // Calculate stats
    const today = new Date().toDateString();
    const jobsToday = jobs.filter(j => 
      j.scheduledAt && new Date(j.scheduledAt).toDateString() === today
    ).length;

    const overdueJobs = jobs.filter(j => 
      j.status === 'scheduled' && 
      j.scheduledAt && 
      new Date(j.scheduledAt) < new Date()
    ).length;

    const pendingQuotes = quotes.filter(q => 
      q.status === 'sent' || q.status === 'draft'
    ).length;

    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    const thisMonthRevenue = invoices
      .filter(i => {
        if (i.status !== 'paid' || !i.paidAt) return false;
        const paidDate = new Date(i.paidAt);
        return paidDate.getMonth() === thisMonth && paidDate.getFullYear() === thisYear;
      })
      .reduce((sum, i) => sum + (i.total || 0), 0);

    const unpaidInvoices = invoices.filter(i => 
      i.status === 'sent' || i.status === 'overdue'
    ).length;

    // Calculate outstanding amount (total value of unpaid invoices)
    const outstandingAmount = invoices
      .filter(i => i.status === 'sent' || i.status === 'overdue')
      .reduce((sum, i) => sum + ((i.total || 0) - (i.amountPaid || 0)), 0);

    // Calculate paid in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const paidLast30Days = invoices
      .filter(i => {
        if (i.status !== 'paid' || !i.paidAt) return false;
        const paidDate = new Date(i.paidAt);
        return paidDate >= thirtyDaysAgo;
      })
      .reduce((sum, i) => sum + (i.total || 0), 0);

    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

    const lastMonthRevenue = invoices
      .filter(i => {
        if (i.status !== 'paid' || !i.paidAt) return false;
        const paidDate = new Date(i.paidAt);
        return paidDate.getMonth() === lastMonth && paidDate.getFullYear() === lastMonthYear;
      })
      .reduce((sum, i) => sum + (i.total || 0), 0);

    const thisMonthJobsCompleted = jobs.filter(j => {
      if (j.status !== 'done' && j.status !== 'invoiced') return false;
      const scheduled = j.scheduledAt ? new Date(j.scheduledAt) : null;
      return scheduled && scheduled.getMonth() === thisMonth && scheduled.getFullYear() === thisYear;
    }).length;

    const lastMonthJobsCompleted = jobs.filter(j => {
      if (j.status !== 'done' && j.status !== 'invoiced') return false;
      const scheduled = j.scheduledAt ? new Date(j.scheduledAt) : null;
      return scheduled && scheduled.getMonth() === lastMonth && scheduled.getFullYear() === lastMonthYear;
    }).length;

    const thisMonthQuotesSent = quotes.filter(q => {
      const created = q.createdAt ? new Date(q.createdAt) : null;
      return created && created.getMonth() === thisMonth && created.getFullYear() === thisYear;
    }).length;

    const lastMonthQuotesSent = quotes.filter(q => {
      const created = q.createdAt ? new Date(q.createdAt) : null;
      return created && created.getMonth() === lastMonth && created.getFullYear() === lastMonthYear;
    }).length;

    set({
      stats: {
        jobsToday,
        overdueJobs,
        pendingQuotes,
        thisMonthRevenue: thisMonthRevenue / 100,
        unpaidInvoices,
        outstandingAmount: outstandingAmount / 100,
        paidLast30Days: paidLast30Days / 100,
        lastMonthRevenue: lastMonthRevenue / 100,
        lastMonthJobsCompleted,
        thisMonthJobsCompleted,
        lastMonthQuotesSent,
        thisMonthQuotesSent,
      },
      isLoading: false,
    });
  },
}));

// ============ TIME TRACKING STORE ============

interface TimeTrackingState {
  activeTimer: TimeEntry | null;
  isLoading: boolean;
  error: string | null;

  fetchActiveTimer: () => Promise<void>;
  startTimer: (jobId: string, description?: string, isBreak?: boolean, phaseId?: string) => Promise<boolean>;
  stopTimer: (options?: { keepLiveActivity?: boolean; distanceKm?: string }) => Promise<boolean>;
  pauseTimer: () => Promise<boolean>;
  resumeTimer: () => Promise<boolean>;
  getElapsedMinutes: () => number;
  isOnBreak: () => boolean;
}

export const useTimeTrackingStore = create<TimeTrackingState>((set, get) => ({
  activeTimer: null,
  isLoading: false,
  error: null,

  fetchActiveTimer: async () => {
    set({ isLoading: true, error: null });

    // T1: Always check for a pending local timer first. If one exists, prefer it
    // — the server hasn't seen it yet (or has a stale entry), and we don't want
    // the UI to flicker to "no active timer" while the sync queue catches up.
    const localPending = await offlineStorage.getActiveLocalTimeEntry();
    if (localPending) {
      const localTimer: TimeEntry = {
        id: localPending.id,
        jobId: localPending.jobId,
        userId: localPending.userId,
        description: localPending.description,
        startTime: localPending.startTime,
        isBreak: false,
        pausedDuration: 0,
      } as any;
      set({ activeTimer: localTimer, isLoading: false, error: null });
      // Restore the GPS window override: a clocked-in worker keeps tracking
      // even outside the owner's hours. Without this, an app restart while on
      // the clock would drop the override and stop GPS.
      void setLocationTrackingOverride(true);
      return;
    }

    const isOnline = useOfflineStore.getState().isOnline;

    if (!isOnline) {
      set({ isLoading: false, error: null });
      return;
    }

    try {
      const response = await api.get<TimeEntry>('/api/time-entries/active');
      set({ activeTimer: response.data || null, isLoading: false, error: null });
      // Mirror the clocked-in state into the tracking override on hydrate.
      void setLocationTrackingOverride(!!response.data);
    } catch (error: any) {
      // 404 means no active timer, which is fine
      if (error.response?.status === 404) {
        set({ activeTimer: null, isLoading: false, error: null });
        void setLocationTrackingOverride(false);
      } else {
        // Silently fail - don't show errors for timer fetch failures. Leave the
        // override untouched: a transient network blip must NOT drop GPS for a
        // worker who may still be on the clock.
        set({ activeTimer: null, isLoading: false, error: null });
      }
    }
  },

  startTimer: async (jobId: string, description?: string, isBreak?: boolean, phaseId?: string) => {
    set({ isLoading: true, error: null });

    // Offline path: write to local SQLite + queue, no network
    const isOnline = useOfflineStore.getState().isOnline;
    if (!isOnline) {
      try {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) {
          set({ isLoading: false, error: 'Not signed in' });
          return false;
        }
        const desc = description || (isBreak ? 'Taking a break' : 'Working on job');
        const offlineEntry = await offlineStorage.startTimeEntryOffline(userId, jobId || undefined, desc, phaseId || undefined);
        const localTimer: TimeEntry = {
          id: offlineEntry.id,
          jobId: offlineEntry.jobId,
          userId: offlineEntry.userId,
          description: offlineEntry.description || desc,
          startTime: offlineEntry.startTime,
          isBreak: !!isBreak,
          pausedDuration: 0,
        } as any;
        set({ activeTimer: localTimer, isLoading: false, error: null });
        void setLocationTrackingOverride(true);
        return true;
      } catch (e: any) {
        set({ isLoading: false, error: e?.message || 'Failed to start timer offline' });
        return false;
      }
    }

    try {
      const response = await api.post<TimeEntry>('/api/time-entries', {
        jobId,
        description: description || (isBreak ? 'Taking a break' : 'Working on job'),
        startTime: new Date().toISOString(),
        isBreak: isBreak || false,
        ...(phaseId ? { phaseId } : {}),
      });
      
      if (response.data) {
        // Set active timer from the response
        set({ activeTimer: response.data, isLoading: false, error: null });
        void setLocationTrackingOverride(true);

        // If a BREAK timer is starting, flip the existing Live Activity to
        // the on_break state so the lock screen reflects that the worker
        // has paused. Fire-and-forget — no-op on Android / if no activity.
        if (isBreak) {
          LiveActivity.update('on_break').catch(() => {});
        }

        // Auto-update job status to in_progress when starting a work timer (not a break)
        // This correlates the timer with the job workflow
        if (!isBreak && jobId) {
          try {
            const jobsStore = useJobsStore.getState();
            // Try to get job from store first, then from offline cache
            let job = await jobsStore.getJob(jobId);
            
            // If getJob returns null (e.g. offline with uncached job), try offline cache directly
            if (!job) {
              try {
                const cachedJob = await offlineStorage.getCachedJob(jobId);
                if (cachedJob) {
                  job = cachedJob as Job;
                }
              } catch {
                // Ignore cache errors
              }
            }
            
            // Update status if job is in a state that should transition to in_progress
            if (job && (job.status === 'scheduled' || job.status === 'pending')) {
              if (__DEV__) console.log('[TimeTracking] Auto-updating job status to in_progress');
              await jobsStore.updateJobStatus(jobId, 'in_progress');
            }
            // Fire (or refresh) the Live Activity on the lock screen for any
            // in-progress job whenever a work timer starts — covers both the
            // freshly-promoted job above AND resuming work on an already
            // in_progress job. Fire-and-forget; never block the timer.
            if (job) {
              LiveActivity.start({
                id: job.id,
                address: job.address ?? '',
                clientName: job.clientName ?? '',
              }).catch(() => {});
            }
          } catch (e) {
            // Non-critical - don't fail the timer start if job update fails
            if (__DEV__) console.log('[TimeTracking] Could not auto-update job status:', e);
          }
        }
        
        return true;
      }
      
      // If no data in response, fetch from server to get actual state
      const activeResponse = await api.get<TimeEntry>('/api/time-entries/active');
      set({ 
        activeTimer: activeResponse.data || null, 
        isLoading: false, 
        error: activeResponse.data ? null : 'Timer created but not returned' 
      });
      // Keep the GPS window override in sync with the confirmed clocked-in state.
      void setLocationTrackingOverride(!!activeResponse.data);
      return !!activeResponse.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to start timer';
      set({ isLoading: false, error: errorMessage });
      return false;
    }
  },

  stopTimer: async (options?: { keepLiveActivity?: boolean; distanceKm?: string }) => {
    const { activeTimer } = get();
    if (!activeTimer) {
      set({ error: 'No active timer to stop' });
      return false;
    }

    const timerId = activeTimer.id;
    set({ isLoading: true, error: null });

    // End the lock-screen Live Activity on a real stop. pauseTimer/resumeTimer
    // pass keepLiveActivity so the activity survives the work<->break transition
    // (it flips to "on_break"/"in_progress" via update() instead of vanishing).
    // Local native call — fire-and-forget, never block the stop.
    const endLiveActivity = () => {
      if (!options?.keepLiveActivity) {
        LiveActivity.end().catch(() => {});
      }
    };

    // Offline path or local-only timer (id starts with "local_") -> stop in SQLite + queue
    const isOnline = useOfflineStore.getState().isOnline;
    if (!isOnline || (typeof timerId === 'string' && timerId.startsWith('local_'))) {
      try {
        await offlineStorage.stopTimeEntryOffline(timerId, options?.distanceKm);
        set({ activeTimer: null, isLoading: false, error: null });
        void setLocationTrackingOverride(false);
        endLiveActivity();
        return true;
      } catch (e: any) {
        set({ isLoading: false, error: e?.message || 'Failed to stop timer offline' });
        return false;
      }
    }

    try {
      const body: Record<string, unknown> = {};
      if (options?.distanceKm != null) body.distanceKm = options.distanceKm;
      await api.post(`/api/time-entries/${timerId}/stop`, body);
      // Clear active timer immediately on success
      set({ activeTimer: null, isLoading: false, error: null });
      void setLocationTrackingOverride(false);
      endLiveActivity();
      return true;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to stop timer';
      set({ error: errorMessage });
      
      // Refresh from server to get actual state
      try {
        const response = await api.get<TimeEntry>('/api/time-entries/active');
        set({ activeTimer: response.data || null, isLoading: false });
      } catch {
        set({ activeTimer: null, isLoading: false });
      }
      return false;
    }
  },

  pauseTimer: async () => {
    const { activeTimer, stopTimer, startTimer } = get();
    if (!activeTimer || activeTimer.isBreak) {
      set({ error: 'No work timer to pause' });
      return false;
    }

    const jobId = activeTimer.jobId;
    const description = activeTimer.description;
    set({ isLoading: true, error: null });
    
    try {
      // Stop the current work timer (keep the Live Activity alive — it flips to
      // "on break" when the break timer starts, instead of disappearing).
      const stopped = await stopTimer({ keepLiveActivity: true });
      if (!stopped) {
        set({ isLoading: false });
        return false;
      }
      
      // Start a break timer for the same job
      const started = await startTimer(
        jobId || '', 
        `Break - ${description || 'Work session'}`,
        true
      );
      
      set({ isLoading: false });
      return started;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to pause timer';
      set({ isLoading: false, error: errorMessage });
      return false;
    }
  },

  resumeTimer: async () => {
    const { activeTimer, stopTimer, startTimer } = get();
    if (!activeTimer) {
      set({ error: 'No timer to resume from' });
      return false;
    }

    const jobId = activeTimer.jobId;
    const wasOnBreak = activeTimer.isBreak;
    set({ isLoading: true, error: null });
    
    try {
      // If on break, stop the break timer first (keep the Live Activity alive —
      // the work timer that follows flips it back to "in progress").
      if (wasOnBreak) {
        const stopped = await stopTimer({ keepLiveActivity: true });
        if (!stopped) {
          set({ isLoading: false });
          return false;
        }
      }
      
      // Start a work timer for the same job
      const started = await startTimer(
        jobId || '', 
        'Working on job',
        false
      );

      // Flip the lock-screen Live Activity back to in_progress after a
      // resume-from-break. startTimer already fires LiveActivity.start()
      // for the work-timer path, but an explicit update() guarantees the
      // status field reflects "working" rather than the prior "on_break"
      // even if the native side treats start() on an active activity as
      // a no-op. Fire-and-forget; never block timer resume.
      if (started && wasOnBreak) {
        LiveActivity.update('in_progress').catch(() => {});
      }

      set({ isLoading: false });
      return started;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to resume timer';
      set({ isLoading: false, error: errorMessage });
      return false;
    }
  },

  getElapsedMinutes: () => {
    const { activeTimer } = get();
    if (!activeTimer?.startTime) return 0;
    try {
      const start = new Date(activeTimer.startTime);
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - start.getTime()) / (1000 * 60));
      return elapsed >= 0 ? elapsed : 0;
    } catch {
      return 0;
    }
  },

  isOnBreak: () => {
    const { activeTimer } = get();
    return activeTimer?.isBreak === true;
  },
}));

// ============ REPORTS STORE ============

interface ReportSummary {
  period: { start: string; end: string };
  revenue: {
    total: number;
    pending: number;
    overdue: number;
    gstCollected: number;
  };
  jobs: {
    total: number;
    completed: number;
    inProgress: number;
  };
  quotes: {
    total: number;
    accepted: number;
    pending: number;
    conversionRate: number;
  };
  invoices: {
    total: number;
    paid: number;
    unpaid: number;
    overdue: number;
  };
}

interface RevenueReport {
  year: number;
  months: {
    month: string;
    revenue: number;
    gst: number;
    invoicesPaid: number;
  }[];
  yearTotal: number;
  yearGst: number;
}

interface ClientReport {
  clients: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    totalRevenue: number;
    outstandingBalance: number;
    jobsCompleted: number;
    invoicesPaid: number;
    invoicesOutstanding: number;
  }[];
  totals: {
    totalRevenue: number;
    totalOutstanding: number;
  };
}

type ReportPeriod = 'week' | 'month' | 'quarter' | 'year';

interface JobTypeProfitability {
  jobType: string;
  jobCount: number;
  totalRevenue: number;
  totalLabourCost: number;
  totalMaterialCost: number;
  totalExpenseCost: number;
  totalCosts: number;
  totalProfit: number;
  totalHours: number;
  avgMargin: number;
  previousMargin: number | null;
  marginChange: number | null;
}

interface ProfitabilityByJobTypeReport {
  jobTypes: JobTypeProfitability[];
  best: { jobType: string; avgMargin: number } | null;
  worst: { jobType: string; avgMargin: number } | null;
}

interface AgedReceivablesReport {
  asOf: string;
  buckets: {
    current: { count: number; total: number; invoices: any[] };
    '1-30': { count: number; total: number; invoices: any[] };
    '31-60': { count: number; total: number; invoices: any[] };
    '61-90': { count: number; total: number; invoices: any[] };
    '90+': { count: number; total: number; invoices: any[] };
  };
  clientBreakdown: { clientId: string; clientName: string; total: number; count: number }[];
  grandTotal: number;
  invoiceCount: number;
}

interface PayrollReport {
  period: { start: string; end: string };
  workers: {
    teamMemberId: string;
    memberId: string;
    firstName: string;
    lastName: string;
    email: string;
    hourlyRate: number;
    isSubcontractor: boolean;
    regularHours: number;
    overtimeHours: number;
    breakHours: number;
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    grossPay: number;
    overtimePay: number;
    jobCount: number;
    entryCount: number;
    approved: number;
    unapproved: number;
    paid: boolean;
    paidAt: string | null;
    payrollPaymentId: string | null;
    paidMethod: string | null;
    paidReference: string | null;
    travelAllowance?: number;
    totalDistanceKm?: number;
  }[];
  totals: {
    totalHours: number;
    totalPay: number;
    totalPaid: number;
    totalOutstanding: number;
    paidCount: number;
    outstandingCount: number;
    workerCount: number;
    subcontractorCount: number;
  };
}

interface UtilisationReport {
  period: { start: string; end: string; workingDays: number };
  workers: {
    teamMemberId: string;
    memberId: string;
    firstName: string;
    lastName: string;
    hoursWorked: number;
    billableHours: number;
    capacityHours: number;
    utilisation: number;
    billableUtilisation: number;
    jobsCompleted: number;
    revenue: number;
    labourCost: number;
    revenuePerHour: number;
    idleHours: number;
  }[];
  averageUtilisation: number;
  totalRevenue: number;
  totalLabourCost: number;
  totalIdleHours: number;
}

interface ReportsState {
  summary: ReportSummary | null;
  revenueReport: RevenueReport | null;
  clientReport: ClientReport | null;
  profitabilityReport: ProfitabilityByJobTypeReport | null;
  agedReceivablesReport: AgedReceivablesReport | null;
  payrollReport: PayrollReport | null;
  utilisationReport: UtilisationReport | null;
  period: ReportPeriod;
  isLoading: boolean;
  error: string | null;
  
  setPeriod: (period: ReportPeriod) => void;
  fetchSummary: () => Promise<void>;
  fetchRevenueReport: (year?: number) => Promise<void>;
  fetchClientReport: (limit?: number) => Promise<void>;
  fetchProfitabilityReport: () => Promise<void>;
  fetchAgedReceivables: () => Promise<void>;
  fetchPayroll: () => Promise<void>;
  fetchUtilisation: () => Promise<void>;
  fetchAllReports: () => Promise<void>;
}

function getDateRangeForPeriod(period: ReportPeriod): { startDate: string; endDate: string } {
  const now = new Date();
  const end = now.toISOString();
  let start: Date;
  
  switch (period) {
    case 'week':
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), quarterMonth, 1);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  
  return { startDate: start.toISOString(), endDate: end };
}

export const useReportsStore = create<ReportsState>((set, get) => ({
  summary: null,
  revenueReport: null,
  clientReport: null,
  profitabilityReport: null,
  agedReceivablesReport: null,
  payrollReport: null,
  utilisationReport: null,
  period: 'month',
  isLoading: false,
  error: null,

  setPeriod: (period: ReportPeriod) => {
    set({ period });
    get().fetchSummary();
  },

  fetchSummary: async () => {
    set({ isLoading: true, error: null });
    
    const isOnline = useOfflineStore.getState().isOnline;
    if (!isOnline) {
      set({ isLoading: false, error: 'Reports require an internet connection' });
      return;
    }
    
    const { period } = get();
    const { startDate, endDate } = getDateRangeForPeriod(period);
    
    try {
      const response = await api.get<ReportSummary>(`/api/reports/summary?startDate=${startDate}&endDate=${endDate}`);
      
      if (response.error) {
        set({ isLoading: false, error: 'Failed to load report summary' });
        return;
      }
      
      set({ summary: response.data, isLoading: false, error: null });
    } catch (e) {
      if (__DEV__) console.log('[ReportsStore] Error fetching summary:', e);
      set({ isLoading: false, error: 'Failed to load report summary' });
    }
  },

  fetchRevenueReport: async (year?: number) => {
    set({ isLoading: true, error: null });
    
    const isOnline = useOfflineStore.getState().isOnline;
    if (!isOnline) {
      set({ isLoading: false, error: 'Reports require an internet connection' });
      return;
    }
    
    const targetYear = year || new Date().getFullYear();
    
    try {
      const response = await api.get<RevenueReport>(`/api/reports/revenue?year=${targetYear}`);
      
      if (response.error) {
        set({ isLoading: false, error: 'Failed to load revenue report' });
        return;
      }
      
      set({ revenueReport: response.data, isLoading: false, error: null });
    } catch (e) {
      if (__DEV__) console.log('[ReportsStore] Error fetching revenue report:', e);
      set({ isLoading: false, error: 'Failed to load revenue report' });
    }
  },

  fetchClientReport: async (limit?: number) => {
    set({ isLoading: true, error: null });
    
    const isOnline = useOfflineStore.getState().isOnline;
    if (!isOnline) {
      set({ isLoading: false, error: 'Reports require an internet connection' });
      return;
    }
    
    try {
      const url = limit ? `/api/reports/clients?limit=${limit}` : '/api/reports/clients';
      const response = await api.get<ClientReport>(url);
      
      if (response.error) {
        set({ isLoading: false, error: 'Failed to load client report' });
        return;
      }
      
      set({ clientReport: response.data, isLoading: false, error: null });
    } catch (e) {
      if (__DEV__) console.log('[ReportsStore] Error fetching client report:', e);
      set({ isLoading: false, error: 'Failed to load client report' });
    }
  },

  fetchProfitabilityReport: async () => {
    set({ isLoading: true, error: null });
    
    const isOnline = useOfflineStore.getState().isOnline;
    if (!isOnline) {
      set({ isLoading: false, error: 'Reports require an internet connection' });
      return;
    }
    
    const { period } = get();
    const { startDate, endDate } = getDateRangeForPeriod(period);
    
    try {
      const response = await api.get<ProfitabilityByJobTypeReport>(`/api/reports/profitability/by-job-type?startDate=${startDate}&endDate=${endDate}`);
      
      if (response.error) {
        set({ isLoading: false, error: 'Failed to load profitability report' });
        return;
      }
      
      set({ profitabilityReport: response.data, isLoading: false, error: null });
    } catch (e) {
      if (__DEV__) console.log('[ReportsStore] Error fetching profitability report:', e);
      set({ isLoading: false, error: 'Failed to load profitability report' });
    }
  },

  fetchAgedReceivables: async () => {
    set({ isLoading: true, error: null });
    const isOnline = useOfflineStore.getState().isOnline;
    if (!isOnline) {
      set({ isLoading: false, error: 'Reports require an internet connection' });
      return;
    }
    try {
      const response = await api.get<AgedReceivablesReport>('/api/reports/receivables');
      if (response.error) {
        set({ isLoading: false, error: 'Failed to load aged receivables' });
        return;
      }
      set({ agedReceivablesReport: response.data || null, isLoading: false, error: null });
    } catch (e) {
      if (__DEV__) console.log('[ReportsStore] Error fetching aged receivables:', e);
      set({ isLoading: false, error: 'Failed to load aged receivables' });
    }
  },

  fetchPayroll: async () => {
    set({ isLoading: true, error: null });
    const isOnline = useOfflineStore.getState().isOnline;
    if (!isOnline) {
      set({ isLoading: false, error: 'Reports require an internet connection' });
      return;
    }
    const { period } = get();
    const { startDate, endDate } = getDateRangeForPeriod(period);
    try {
      const response = await api.get<PayrollReport>(`/api/payroll/summary?start=${startDate}&end=${endDate}`);
      if (response.error) {
        set({ isLoading: false, error: 'Failed to load payroll report' });
        return;
      }
      set({ payrollReport: response.data || null, isLoading: false, error: null });
    } catch (e) {
      if (__DEV__) console.log('[ReportsStore] Error fetching payroll:', e);
      set({ isLoading: false, error: 'Failed to load payroll report' });
    }
  },

  fetchUtilisation: async () => {
    set({ isLoading: true, error: null });
    const isOnline = useOfflineStore.getState().isOnline;
    if (!isOnline) {
      set({ isLoading: false, error: 'Reports require an internet connection' });
      return;
    }
    const { period } = get();
    const { startDate, endDate } = getDateRangeForPeriod(period);
    try {
      const response = await api.get<UtilisationReport>(`/api/reports/utilisation?start=${startDate}&end=${endDate}`);
      if (response.error) {
        set({ isLoading: false, error: 'Failed to load utilisation report' });
        return;
      }
      set({ utilisationReport: response.data || null, isLoading: false, error: null });
    } catch (e) {
      if (__DEV__) console.log('[ReportsStore] Error fetching utilisation:', e);
      set({ isLoading: false, error: 'Failed to load utilisation report' });
    }
  },

  fetchAllReports: async () => {
    set({ isLoading: true, error: null });
    
    const isOnline = useOfflineStore.getState().isOnline;
    if (!isOnline) {
      set({ isLoading: false, error: 'Reports require an internet connection' });
      return;
    }
    
    const { period } = get();
    const { startDate, endDate } = getDateRangeForPeriod(period);
    const currentYear = new Date().getFullYear();
    
    try {
      const [summaryRes, revenueRes, clientRes, profitabilityRes, agedRes, payrollRes, utilisationRes] = await Promise.all([
        api.get<ReportSummary>(`/api/reports/summary?startDate=${startDate}&endDate=${endDate}`),
        api.get<RevenueReport>(`/api/reports/revenue?year=${currentYear}`),
        api.get<ClientReport>('/api/reports/clients?limit=5'),
        api.get<ProfitabilityByJobTypeReport>(`/api/reports/profitability/by-job-type?startDate=${startDate}&endDate=${endDate}`),
        api.get<AgedReceivablesReport>('/api/reports/receivables'),
        api.get<PayrollReport>(`/api/payroll/summary?start=${startDate}&end=${endDate}`),
        api.get<UtilisationReport>(`/api/reports/utilisation?start=${startDate}&end=${endDate}`),
      ]);
      
      set({
        summary: summaryRes.data || null,
        revenueReport: revenueRes.data || null,
        clientReport: clientRes.data || null,
        profitabilityReport: profitabilityRes.data || null,
        agedReceivablesReport: agedRes.data || null,
        payrollReport: payrollRes.data || null,
        utilisationReport: utilisationRes.data || null,
        isLoading: false,
        error: null,
      });
    } catch (e) {
      if (__DEV__) console.log('[ReportsStore] Error fetching all reports:', e);
      set({ isLoading: false, error: 'Failed to load reports' });
    }
  },
}));
