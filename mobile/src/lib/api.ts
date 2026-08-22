import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { useOfflineStore } from './offline-storage';
import { getExpoExtras, getDevHostUri } from './expo-extra';

const FORBIDDEN_PROD_HOST_PATTERNS = [
  /\.replit\.dev/i,
  /\.repl\.co/i,
  /localhost/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^http:\/\//i,
];

function assertProdHostAllowed(url: string): void {
  for (const pattern of FORBIDDEN_PROD_HOST_PATTERNS) {
    if (pattern.test(url)) {
      throw new Error(
        `[API] Refusing to start: configured API URL "${url}" is not a valid production host. Set EXPO_PUBLIC_API_URL in the matching eas.json profile.`
      );
    }
  }
}

// Hard fallback so OTA updates pushed without EXPO_PUBLIC_API_URL set in the
// shell never crash the app at boot. JobRunner production API is fixed.
const PROD_FALLBACK_API_URL = 'https://jobrunner.com.au';

const getApiBaseUrl = (): string => {
  const extras = getExpoExtras();
  const fromExtra = extras.apiUrl;
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  const explicit = (typeof fromExtra === 'string' && fromExtra.length > 0)
    ? fromExtra
    : (typeof fromEnv === 'string' && fromEnv.length > 0 ? fromEnv : undefined);

  if (!__DEV__) {
    const resolved = explicit || PROD_FALLBACK_API_URL;
    assertProdHostAllowed(resolved);
    return resolved;
  }

  if (explicit) return explicit;

  const devOverride = process.env.EXPO_PUBLIC_DEV_API_URL || extras.devApiUrl;
  if (typeof devOverride === 'string' && devOverride.length > 0) {
    return devOverride;
  }

  const hostUri = getDevHostUri();
  if (typeof hostUri === 'string' && hostUri.length > 0) {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost') {
      return `http://${host}:5000`;
    }
  }
  return Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';
};

const API_BASE_URL = getApiBaseUrl();

if (__DEV__) {
  console.log(`[API] base url = ${API_BASE_URL}`);
}

export const API_URL = API_BASE_URL;

interface ApiResponse<T> {
  data?: T;
  error?: string;
  isOffline?: boolean;
  /** Set when the server returned 429 (bounded queue / rate limiter at capacity). */
  backpressure?: { code: 'BACKPRESSURE'; retryAfterSec: number };
}

/**
 * True when an API error string means the session is invalid/expired and the
 * user needs to sign in again (HTTP 401). The backend uses several wordings
 * ("Not authenticated", "Authentication required", "Unauthorized") across
 * different middlewares, so match them all case-insensitively rather than
 * relying on one exact string.
 */
/**
 * Module-level 401 callback — registered once from useAuthStore so the API
 * client can trigger a logout without importing the store (circular dep).
 */
let _authExpiredCallback: (() => void) | null = null;
export function setAuthExpiredCallback(cb: () => void): void {
  _authExpiredCallback = cb;
}

export function isAuthErrorMessage(error?: string | null): boolean {
  if (!error) return false;
  const e = error.toLowerCase();
  return (
    e.includes('not authenticated') ||
    e.includes('authentication required') ||
    e.includes('unauthorized') ||
    e.includes('401') ||
    e === 'user not found'
  );
}

interface LoginResponse {
  success: boolean;
  user: any;
  sessionToken: string;
}

class ApiClient {
  private baseUrl: string;
  private sessionToken: string | null = null;
  private tokenLoaded: boolean = false;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async isOnline(): Promise<boolean> {
    return useOfflineStore.getState().isOnline;
  }

  async loadToken(): Promise<string | null> {
    if (this.tokenLoaded) {
      return this.sessionToken;
    }
    try {
      this.sessionToken = await SecureStore.getItemAsync('session_token');
      this.tokenLoaded = true;
    } catch (error) {
      if (__DEV__) console.error('Failed to load session token:', error);
    }
    return this.sessionToken;
  }

  async setToken(token: string | null) {
    this.sessionToken = token;
    this.tokenLoaded = true;
    try {
      if (token) {
        await SecureStore.setItemAsync('session_token', token);
      } else {
        await SecureStore.deleteItemAsync('session_token');
      }
    } catch (error) {
      if (__DEV__) console.error('Failed to save session token:', error);
    }
    // On a fresh (re)login, immediately retry any buffered/401'd location pings
    // so a worker who was already sharing reappears on the team map without
    // waiting for the heartbeat. Lazy require avoids a circular import
    // (location-tracking imports this api module at load time). Fire-and-forget.
    if (token) {
      try {
        const { locationTracking } = require('./location-tracking');
        locationTracking?.onAuthChanged?.();
      } catch {
        // location-tracking not available in this context — ignore.
      }
    }
  }

  async getToken(): Promise<string | null> {
    if (!this.tokenLoaded) {
      await this.loadToken();
    }
    return this.sessionToken;
  }

  hasToken(): boolean {
    return !!this.sessionToken;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private async getHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'x-mobile-app': 'true',
    };
    
    const token = await this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  async request<T = unknown>(
    method: string,
    endpoint: string,
    body?: any,
    options?: { headers?: Record<string, string>; timeoutMs?: number }
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs ?? 15000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers = await this.getHeaders();
      if (options?.headers) {
        Object.assign(headers, options.headers);
      }
      const config: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      if (body && method !== 'GET') {
        if (body instanceof FormData) {
          config.body = body;
          delete (headers as any)['Content-Type'];
        } else {
          config.body = JSON.stringify(body);
        }
      }

      const url = `${this.baseUrl}${endpoint}`;
      if (__DEV__) console.log(`[API] ${method} ${endpoint}`);
      
      let response = await fetch(url, config);

      // Graceful 429 handling: server returns Retry-After (seconds) when a
      // bounded queue (PDF/AI/vision) or per-user limiter is at capacity.
      // For idempotent GETs we transparently back off and retry once. For
      // mutations we surface BACKPRESSURE so the caller can show a friendly
      // "Server busy — try again" message instead of failing silently.
      if (response.status === 429 && method === 'GET') {
        const retryAfterRaw = response.headers.get('retry-after');
        const retryAfterSec = retryAfterRaw ? Math.min(15, Math.max(1, parseInt(retryAfterRaw, 10) || 5)) : 5;
        const jitterMs = Math.floor(Math.random() * 500);
        if (__DEV__) console.log(`[API] 429 backoff ${retryAfterSec}s for GET ${endpoint}`);
        await new Promise((r) => setTimeout(r, retryAfterSec * 1000 + jitterMs));
        response = await fetch(url, config);
      }

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfterRaw = response.headers.get('retry-after');
          const retryAfterSec = retryAfterRaw ? parseInt(retryAfterRaw, 10) : 5;
          if (__DEV__) console.log(`[API] 429 backpressure (final) for ${method} ${endpoint}, retry-after=${retryAfterSec}s`);
          return {
            error: `Server is busy — please try again in ${retryAfterSec}s.`,
            backpressure: { code: 'BACKPRESSURE', retryAfterSec },
          };
        }
        if (response.status === 401) {
          if (__DEV__) console.log(`[API] 401 on ${method} ${endpoint} — session expired`);
          // Fire the registered auth-expiry handler (wired up in store.ts to avoid circular imports).
          // Guarded so auth-related endpoints (login/verify) don't trigger a recursive logout.
          const isAuthEndpoint = endpoint.startsWith('/api/auth/');
          if (!isAuthEndpoint && _authExpiredCallback) {
            _authExpiredCallback();
          }
          const text = await response.text().catch(() => '');
          let errMsg = 'Session expired. Please sign in again.';
          try { errMsg = JSON.parse(text).error || errMsg; } catch {}
          return { error: errMsg };
        }
        if (response.status === 504) {
          return { error: 'Request took too long. Please try again.' };
        }
        if (isJson) {
          const errorData = await response.json().catch(() => ({}));
          if (__DEV__) console.log(`[API] Error ${response.status}:`, errorData);
          return { error: errorData.error || errorData.message || `Request failed: ${response.status}`, data: errorData as T };
        } else {
          const text = await response.text().catch(() => '');
          if (__DEV__) console.log(`[API] Non-JSON Error ${response.status}:`, text.substring(0, 100));
          return { error: `Server error (${response.status}). Please try again.` };
        }
      }

      if (!isJson) {
        if (__DEV__) console.log(`[API] Warning: Non-JSON response for ${endpoint}`);
        return { data: {} as T };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error && (error as any).name === 'AbortError') {
        return { error: 'Request timed out. Please check your connection and try again.' };
      }
      const online = await this.isOnline();
      if (!online) {
        if (__DEV__) console.log(`[API] Offline - skipping ${method} ${endpoint}`);
        return { error: 'offline', isOffline: true };
      }
      if (__DEV__) console.warn(`[API] Network Error [${method} ${endpoint}]:`, error);
      return { error: error instanceof Error ? error.message : 'Network error' };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async get<T = unknown>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint);
  }

  async post<T = unknown>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, body);
  }

  async patch<T = unknown>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', endpoint, body);
  }

  async put<T = unknown>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', endpoint, body);
  }

  async delete<T = unknown>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint);
  }

  async uploadFile<T = unknown>(endpoint: string, formData: FormData, timeoutMs: number = 60000): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const token = await this.getToken();
      const headers: HeadersInit = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const url = `${this.baseUrl}${endpoint}`;
      if (__DEV__) console.log(`[API] POST (upload) ${endpoint}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });
      
      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      
      if (!response.ok) {
        if (isJson) {
          const errorData = await response.json().catch(() => ({}));
          if (__DEV__) console.log(`[API] Upload Error ${response.status}:`, errorData);
          return { error: errorData.error || errorData.message || `Upload failed: ${response.status}` };
        } else {
          return { error: `Upload failed (${response.status})` };
        }
      }
      
      if (!isJson) {
        return { data: {} as T };
      }
      
      const data = await response.json();
      return { data };
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error && (error as any).name === 'AbortError') {
        return { error: 'Upload timed out. Please check your connection and try again.' };
      }
      const online = await this.isOnline();
      if (!online) {
        if (__DEV__) console.log(`[API] Offline - skipping upload ${endpoint}`);
        return { error: 'offline', isOffline: true };
      }
      if (__DEV__) console.warn(`[API] Upload Error [${endpoint}]:`, error);
      return { error: error instanceof Error ? error.message : 'Upload failed' };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async login(email: string, password: string): Promise<ApiResponse<LoginResponse>> {
    const response = await this.post<LoginResponse>('/api/auth/login', { email, password });
    
    if (response.data?.sessionToken) {
      await this.setToken(response.data.sessionToken);
    }
    
    return response;
  }

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    businessName?: string;
    tradeType?: string;
    phone?: string;
    inviteToken?: string;
    platform?: 'web' | 'mobile';
  }): Promise<ApiResponse<LoginResponse>> {
    const response = await this.post<LoginResponse>('/api/auth/register', data);
    
    if (response.data?.sessionToken) {
      await this.setToken(response.data.sessionToken);
    }
    
    return response;
  }

  async logout(): Promise<ApiResponse<any>> {
    const response = await this.post<any>('/api/auth/logout');
    await this.setToken(null);
    return response;
  }

  async getCurrentUser(): Promise<ApiResponse<any>> {
    return this.get<any>('/api/auth/me');
  }

  async updateBusinessSettings(data: {
    businessName?: string;
    tradeType?: string;
    abn?: string;
    phone?: string;
    address?: string;
    gstEnabled?: boolean;
    defaultHourlyRate?: number;
    calloutFee?: number;
    brandColor?: string;
    logoUrl?: string;
  }): Promise<ApiResponse<any>> {
    return this.patch<any>('/api/business-settings', data);
  }

  async uploadBusinessLogo(uri: string): Promise<ApiResponse<{ logoUrl: string }>> {
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'logo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : `image/jpeg`;

    formData.append('logo', {
      uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
      name: filename,
      type,
    } as any);

    return this.uploadFile<{ logoUrl: string }>('/api/business-settings/logo', formData);
  }

  async forgotPassword(email: string): Promise<{ success: boolean; error?: string; message?: string }> {
    const response = await this.post<{ success: boolean; message?: string }>('/api/auth/forgot-password', { email });
    
    if (response.error) {
      return { success: false, error: response.error };
    }
    
    return { success: true, message: response.data?.message };
  }

  async resetPassword(token: string, password: string): Promise<{ success: boolean; error?: string; message?: string }> {
    const response = await this.post<{ success: boolean; message?: string }>('/api/auth/reset-password', { token, password });
    
    if (response.error) {
      return { success: false, error: response.error };
    }
    
    return { success: true, message: response.data?.message };
  }

  // Subscription API methods
  async getSubscriptionStatus(): Promise<ApiResponse<{
    tier: string;
    status: string;
    trialEndsAt: string | null;
    nextBillingDate: string | null;
    cancelAtPeriodEnd: boolean;
    paymentMethod: { last4: string; brand: string } | null;
    seats: number | null;
    canUpgrade: boolean;
    canDowngrade: boolean;
  }>> {
    return this.get('/api/subscription/status');
  }

  async createSubscriptionCheckout(tier: 'pro' | 'team', seats?: number): Promise<ApiResponse<{ url: string }>> {
    return this.post('/api/subscription/create-checkout', { tier, seats });
  }

  async getSubscriptionManageUrl(): Promise<ApiResponse<{ url: string }>> {
    return this.post('/api/subscription/manage');
  }

  async getSubscriptionInvoices(): Promise<ApiResponse<{ 
    invoices: Array<{ 
      id: string; 
      amount: number; 
      status: string; 
      date: string; 
      pdfUrl: string | null 
    }> 
  }>> {
    return this.get('/api/subscription/invoices');
  }

  // Google Calendar Integration API methods
  async getGoogleCalendarStatus(): Promise<ApiResponse<{
    configured: boolean;
    connected: boolean;
    email?: string;
    message?: string;
  }>> {
    return this.get('/api/integrations/google-calendar/status');
  }

  async syncJobToCalendar(jobId: string): Promise<ApiResponse<{
    success: boolean;
    eventId: string;
    eventLink: string;
  }>> {
    return this.post('/api/integrations/google-calendar/sync-job', { jobId });
  }

  async syncAllJobsToCalendar(): Promise<ApiResponse<{
    success: boolean;
    synced: number;
    failed: number;
    errors: string[];
    message: string;
  }>> {
    return this.post('/api/integrations/google-calendar/sync-all-jobs');
  }

  async getGoogleCalendarEvents(limit?: number): Promise<ApiResponse<{
    events: Array<{
      id: string;
      summary: string;
      description: string;
      location: string;
      start: string;
      end: string;
      htmlLink: string;
    }>
  }>> {
    return this.get(`/api/integrations/google-calendar/events${limit ? `?limit=${limit}` : ''}`);
  }

  // Xero Integration API methods
  async getXeroStatus(): Promise<ApiResponse<{
    connected: boolean;
    configured: boolean;
    organisationName?: string;
    email?: string;
    lastSyncedAt?: string;
    message?: string;
  }>> {
    return this.get('/api/integrations/xero/status');
  }

  async syncContactsFromXero(): Promise<ApiResponse<{
    success: boolean;
    imported: number;
    skipped: number;
    errors: string[];
  }>> {
    return this.post('/api/integrations/xero/sync-contacts');
  }

  async pushInvoiceToXero(invoiceId: string): Promise<ApiResponse<{
    success: boolean;
    xeroInvoiceId: string;
    xeroInvoiceNumber: string;
  }>> {
    return this.post(`/api/integrations/xero/push-invoice/${invoiceId}`);
  }

  // Task #93: push a quote to Xero via the real Xero Quotes API.
  async pushQuoteToXero(quoteId: string): Promise<ApiResponse<{
    success: boolean;
    xeroQuoteId?: string;
    message?: string;
  }>> {
    return this.post(`/api/integrations/xero/push-quote-real/${quoteId}`);
  }

  async getMyBusinesses(): Promise<ApiResponse<{
    businesses: Array<{
      businessOwnerId: string;
      businessName: string;
      roleName: string;
      teamMemberId: string;
      logoUrl?: string;
      pendingJobCount?: number;
    }>;
    activeBusinessId: string | null;
  }>> {
    return this.get('/api/auth/my-businesses');
  }

  async switchBusiness(businessId: string): Promise<ApiResponse<{ success: boolean; activeBusinessId: string }>> {
    return this.post('/api/auth/switch-business', { businessId });
  }

  async getPendingInvites(): Promise<ApiResponse<{
    invites: Array<{
      id: string;
      businessName: string;
      roleName: string;
      inviterName: string;
    }>;
  }>> {
    return this.get('/api/auth/pending-invites');
  }

  async acceptInviteById(teamMemberId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.post('/api/auth/accept-invite', { teamMemberId });
  }

  async getJobConflicts(): Promise<ApiResponse<{
    conflicts: Array<{
      job1: { id: string; title: string; businessName: string; scheduledAt: string; estimatedDuration: number };
      job2: { id: string; title: string; businessName: string; scheduledAt: string; estimatedDuration: number };
      overlapMinutes: number;
    }>;
  }>> {
    return this.get('/api/auth/job-conflicts');
  }

  // All integrations status (unified endpoint for mobile)
  async getAllIntegrationsStatus(): Promise<ApiResponse<{
    googleCalendar: {
      configured: boolean;
      connected: boolean;
      email?: string;
      message?: string;
    };
    xero: {
      configured: boolean;
      connected: boolean;
      organisationName?: string;
    };
    stripe: {
      configured: boolean;
      connected: boolean;
    };
    twilio: {
      configured: boolean;
      connected: boolean;
    };
  }>> {
    return this.get('/api/integrations/status');
  }
}

export const api = new ApiClient(API_BASE_URL);
export default api;
