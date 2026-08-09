// Google Calendar Client for JobRunner
// Supports per-user OAuth tokens stored in businessSettings
// Each tradie connects their own Google Calendar account

import { google, calendar_v3 } from 'googleapis';
import { storage } from './storage';
import { getErrorMessage } from "./lib/errors";

// Google OAuth credentials from environment
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;

// Get the redirect URI for OAuth
// Priority: VITE_APP_URL (production domain) > REPLIT_DEV_DOMAIN > REPLIT_DOMAINS > localhost
function getRedirectUri(): string {
  let baseUrl: string;
  
  // Check for production custom domain first (e.g., jobrunner.com)
  const appUrl = process.env.VITE_APP_URL || process.env.APP_URL;
  if (appUrl) {
    // Ensure it has https:// prefix
    baseUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
  } else if (process.env.REPLIT_DEV_DOMAIN) {
    baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  } else if (process.env.REPLIT_DOMAINS) {
    baseUrl = `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
  } else {
    baseUrl = 'http://localhost:5000';
  }
  
  // Remove trailing slash if present
  baseUrl = baseUrl.replace(/\/$/, '');
  
  const redirectUri = `${baseUrl}/api/integrations/google-calendar/callback`;
  console.log('[GoogleCalendar] Using redirect URI:', redirectUri, '(from:', appUrl ? 'VITE_APP_URL' : process.env.REPLIT_DEV_DOMAIN ? 'REPLIT_DEV_DOMAIN' : 'REPLIT_DOMAINS', ')');
  return redirectUri;
}

// Get OAuth2 client configured with app credentials
function getOAuth2Client(): any {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google Calendar credentials not configured');
  }
  
  const redirectUri = getRedirectUri();
  
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

// Generate authorization URL for a user to connect their Google Calendar
export function getAuthorizationUrl(userId: string): string {
  const oauth2Client = getOAuth2Client();
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    state: userId
  });
}

// Exchange authorization code for tokens and store them
export async function handleOAuthCallback(code: string, userId: string): Promise<{
  success: boolean;
  email?: string;
  error?: string;
}> {
  try {
    console.log(`[GoogleCalendar] Processing OAuth callback for user ${userId}`);
    const oauth2Client = getOAuth2Client();
    
    const { tokens } = await oauth2Client.getToken(code);
    console.log(`[GoogleCalendar] Got tokens - access: ${!!tokens.access_token}, refresh: ${!!tokens.refresh_token}, expiry: ${tokens.expiry_date}`);
    
    // Important: We need a refresh token for long-term access
    // Google only sends refresh_token on first authorization or when using prompt=consent
    if (!tokens.refresh_token) {
      // Check if we already have a refresh token stored
      const existingSettings = await storage.getBusinessSettings(userId);
      if (existingSettings?.googleCalendarRefreshToken) {
        console.log(`[GoogleCalendar] No new refresh token received, using existing one`);
        tokens.refresh_token = existingSettings.googleCalendarRefreshToken;
      } else {
        console.warn(`[GoogleCalendar] No refresh token received and none stored - user may need to revoke and re-authorize`);
        return { 
          success: false, 
          error: 'No refresh token received. Please revoke JobRunner access in your Google Account settings and try again.' 
        };
      }
    }
    
    oauth2Client.setCredentials(tokens);
    
    // Get user's email from Google
    let email: string | undefined;
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      email = userInfo.data.email || undefined;
      console.log(`[GoogleCalendar] Got user email: ${email}`);
    } catch (emailError: unknown) {
      console.warn(`[GoogleCalendar] Could not fetch user email: ${getErrorMessage(emailError)}`);
    }
    
    // Store tokens in businessSettings
    console.log(`[GoogleCalendar] Saving tokens for user ${userId}, email: ${email}, hasRefreshToken: ${!!tokens.refresh_token}`);
    const updateResult = await storage.updateBusinessSettings(userId, {
      googleCalendarConnected: true,
      googleCalendarAccessToken: tokens.access_token || null,
      googleCalendarRefreshToken: tokens.refresh_token || null,
      googleCalendarTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      googleCalendarEmail: email || null,
    });
    
    if (!updateResult) {
      console.error(`[GoogleCalendar] Failed to save tokens for user ${userId}`);
      return { success: false, error: 'Failed to save calendar connection settings' };
    }
    
    console.log(`[GoogleCalendar] Successfully connected for user ${userId}: ${email}`);
    return { success: true, email };
  } catch (error: any) {
    console.error('[GoogleCalendar] OAuth callback error:', getErrorMessage(error) || error);
    
    // Provide more helpful error messages
    let errorMessage = getErrorMessage(error) || 'Unknown error during authorization';
    if (errorMessage.includes('invalid_grant')) {
      errorMessage = 'Authorization code expired. Please try connecting again.';
    } else if (errorMessage.includes('redirect_uri_mismatch')) {
      errorMessage = 'OAuth configuration error. Please contact support.';
      console.error('[GoogleCalendar] Redirect URI mismatch - check Google Console configuration');
    }
    
    return { success: false, error: errorMessage };
  }
}

// Disconnect Google Calendar for a user
export async function disconnectCalendar(userId: string): Promise<void> {
  await storage.updateBusinessSettings(userId, {
    googleCalendarConnected: false,
    googleCalendarAccessToken: null,
    googleCalendarRefreshToken: null,
    googleCalendarTokenExpiry: null,
    googleCalendarEmail: null,
  });
  console.log(`[GoogleCalendar] Disconnected for user ${userId}`);
}

// Get access token for a user, refreshing if necessary
async function getUserAccessToken(userId: string): Promise<string> {
  const settings = await storage.getBusinessSettings(userId);
  
  if (!settings?.googleCalendarConnected) {
    throw new Error('Google Calendar not connected. Please connect your Google Calendar in Settings.');
  }
  
  if (!settings.googleCalendarRefreshToken) {
    console.warn(`[GoogleCalendar] No refresh token found for user ${userId}, marking as disconnected`);
    await storage.updateBusinessSettings(userId, {
      googleCalendarConnected: false,
    });
    throw new Error('Google Calendar authorization incomplete. Please reconnect your calendar.');
  }
  
  // Check if token is expired or about to expire (within 10 minutes for proactive refresh)
  const tokenExpiry = settings.googleCalendarTokenExpiry 
    ? new Date(settings.googleCalendarTokenExpiry).getTime() 
    : 0;
  const PROACTIVE_REFRESH_BUFFER = 10 * 60 * 1000; // 10 minutes before expiry
  const isExpiringSoon = tokenExpiry < Date.now() + PROACTIVE_REFRESH_BUFFER;
  
  if (!isExpiringSoon && settings.googleCalendarAccessToken) {
    const minutesLeft = Math.round((tokenExpiry - Date.now()) / 1000 / 60);
    console.log(`[GoogleCalendar] Using cached token for user ${userId}, expires in ${minutesLeft} minutes`);
    return settings.googleCalendarAccessToken;
  }
  
  // Proactively refresh the token before it expires
  console.log(`[GoogleCalendar] Token ${tokenExpiry < Date.now() ? 'expired' : 'expiring soon'} for user ${userId}, refreshing proactively...`);
  
  // Retry logic for transient failures
  const MAX_RETRIES = 3;
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials({
        refresh_token: settings.googleCalendarRefreshToken
      });
      
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new Error('No access token returned from refresh');
      }
      
      // Update stored tokens (keep the existing refresh token if not provided)
      await storage.updateBusinessSettings(userId, {
        googleCalendarAccessToken: credentials.access_token,
        googleCalendarRefreshToken: credentials.refresh_token || settings.googleCalendarRefreshToken,
        googleCalendarTokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      });
      
      console.log(`[GoogleCalendar] Successfully refreshed token for user ${userId} (attempt ${attempt})`);
      return credentials.access_token;
    } catch (error: unknown) {
      lastError = error;
      const errorMessage = getErrorMessage(error) || '';
      
      // Check if this is a permanent error (token revoked or expired)
      const isPermanentError = errorMessage.includes('invalid_grant') || 
                               errorMessage.includes('Token has been revoked') ||
                               errorMessage.includes('Token has been expired') ||
                               errorMessage.includes('unauthorized_client');
      
      if (isPermanentError) {
        console.error(`[GoogleCalendar] Token permanently invalid for user ${userId}:`, errorMessage);
        // Mark as disconnected so user can reconnect
        await storage.updateBusinessSettings(userId, {
          googleCalendarConnected: false,
          googleCalendarAccessToken: null,
        });
        throw new Error('Google Calendar access was revoked or expired. Please reconnect your calendar in Settings → Integrations.');
      }
      
      // For transient errors, retry with exponential backoff
      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.warn(`[GoogleCalendar] Token refresh attempt ${attempt} failed, retrying in ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All retries exhausted
  console.error('[GoogleCalendar] Token refresh failed after all retries:', lastError?.message || lastError);
  throw new Error(`Failed to refresh Google Calendar token after ${MAX_RETRIES} attempts. Please try again or reconnect your calendar.`);
}

// Check if Google Calendar is connected for a user
export async function isGoogleCalendarConnected(userId?: string): Promise<boolean> {
  // If no userId provided, check if credentials are configured (for integration status page)
  if (!userId) {
    return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
  }
  
  try {
    const settings = await storage.getBusinessSettings(userId);
    return !!(settings?.googleCalendarConnected && settings.googleCalendarRefreshToken);
  } catch (error) {
    return false;
  }
}

// Check if Google Calendar is configured (credentials exist)
export function isGoogleCalendarConfigured(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

// Get calendar client for a specific user
export async function getCalendarClient(userId: string): Promise<calendar_v3.Calendar> {
  const accessToken = await getUserAccessToken(userId);
  
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// Get connected calendar info for a user
export async function getCalendarInfo(userId?: string): Promise<{
  connected: boolean;
  configured: boolean;
  email?: string;
  calendarId?: string;
} | null> {
  // Check if configured
  const configured = isGoogleCalendarConfigured();
  
  if (!userId) {
    return { connected: false, configured };
  }
  
  try {
    const settings = await storage.getBusinessSettings(userId);
    
    if (!settings?.googleCalendarConnected) {
      return { connected: false, configured, email: undefined };
    }
    
    return {
      connected: true,
      configured: true,
      email: settings.googleCalendarEmail || undefined,
      calendarId: 'primary'
    };
  } catch (error) {
    console.error('[GoogleCalendar] Failed to get calendar info:', error);
    return { connected: false, configured };
  }
}

// Status colors based on job status
const STATUS_COLORS: Record<string, string> = {
  'pending': '5',      // Yellow
  'scheduled': '1',    // Lavender/Blue
  'in_progress': '6',  // Orange
  'done': '10',        // Green
  'invoiced': '2',     // Light green/Sage
  'cancelled': '8',    // Gray
};

// Build event summary with status emoji
function buildEventSummary(job: {
  title: string;
  status?: string;
  clientName?: string;
}): string {
  const statusEmojis: Record<string, string> = {
    'pending': '⏳',
    'scheduled': '📅',
    'in_progress': '🔧',
    'done': '✅',
    'invoiced': '💰',
    'cancelled': '❌',
  };
  
  const emoji = statusEmojis[job.status || 'scheduled'] || '📅';
  const clientPart = job.clientName ? ` - ${job.clientName}` : '';
  
  return `${emoji} ${job.title}${clientPart}`;
}

// Build detailed event description with tradie workflow info
function buildEventDescription(job: {
  title: string;
  description?: string | null;
  notes?: string | null;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  address?: string | null;
  status?: string;
}): string {
  const sections: string[] = [];
  
  // Client contact info section
  if (job.clientName || job.clientPhone || job.clientEmail) {
    sections.push('📋 CLIENT DETAILS');
    if (job.clientName) sections.push(`   Name: ${job.clientName}`);
    if (job.clientPhone) sections.push(`   Phone: ${job.clientPhone}`);
    if (job.clientEmail) sections.push(`   Email: ${job.clientEmail}`);
    sections.push('');
  }
  
  // Address for navigation
  if (job.address) {
    sections.push('📍 ADDRESS');
    sections.push(`   ${job.address}`);
    sections.push(`   → Open in Maps: https://maps.google.com/?q=${encodeURIComponent(job.address)}`);
    sections.push('');
  }
  
  // Job details
  sections.push('🔧 JOB DETAILS');
  sections.push(`   Title: ${job.title}`);
  if (job.status) sections.push(`   Status: ${job.status.toUpperCase()}`);
  if (job.description) sections.push(`   Description: ${job.description}`);
  sections.push('');
  
  // Notes
  if (job.notes) {
    sections.push('📝 NOTES');
    sections.push(`   ${job.notes}`);
    sections.push('');
  }
  
  // Footer
  sections.push('─────────────────');
  sections.push('Synced from JobRunner');
  
  return sections.join('\n');
}

// Create or update a calendar event for a job (user-specific)
export async function syncJobToCalendar(
  userId: string,
  job: {
    id: string;
    title: string;
    description?: string | null;
    notes?: string | null;
    address?: string | null;
    scheduledAt: Date;
    estimatedDuration?: number;
    clientName?: string;
    clientPhone?: string;
    clientEmail?: string;
    status?: string;
    calendarEventId?: string | null;
  }
): Promise<{ eventId: string; eventLink: string }> {
  const calendar = await getCalendarClient(userId);

  // Resolve business timezone (configurable per-tenant; defaults to Australia/Sydney for legacy parity).
  let businessTimezone = 'Australia/Sydney';
  try {
    const { storage } = await import('./storage');
    const settings = await storage.getBusinessSettings(userId);
    const tz = (settings as any)?.timezone;
    if (tz && typeof tz === 'string' && tz.trim()) {
      businessTimezone = tz.trim();
    }
  } catch (err) {
    console.warn('[GoogleCalendar] Failed to load business timezone, defaulting to Australia/Sydney:', err);
  }

  const startTime = new Date(job.scheduledAt);
  const endTime = new Date(startTime.getTime() + (job.estimatedDuration || 2) * 60 * 60 * 1000);
  
  const eventData: calendar_v3.Schema$Event = {
    summary: buildEventSummary(job),
    description: buildEventDescription(job),
    location: job.address || undefined,
    start: {
      dateTime: startTime.toISOString(),
      timeZone: businessTimezone
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: businessTimezone
    },
    colorId: STATUS_COLORS[job.status || 'scheduled'] || '1',
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
        { method: 'popup', minutes: 15 },
      ],
    },
    extendedProperties: {
      private: {
        jobrunnerJobId: job.id,
        source: 'jobrunner',
      }
    }
  };

  let event: calendar_v3.Schema$Event;
  
  // Try to update existing event, or create new one
  if (job.calendarEventId) {
    try {
      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId: job.calendarEventId,
        requestBody: eventData,
      });
      event = response.data;
      console.log(`[GoogleCalendar] Updated event ${job.calendarEventId} for job ${job.id}`);
    } catch (updateError: any) {
      if (updateError.code === 404) {
        const response = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: eventData,
        });
        event = response.data;
        console.log(`[GoogleCalendar] Created new event (old not found) for job ${job.id}`);
      } else {
        throw updateError;
      }
    }
  } else {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventData,
    });
    event = response.data;
    console.log(`[GoogleCalendar] Created event ${event.id} for job ${job.id}`);
  }

  return {
    eventId: event.id!,
    eventLink: event.htmlLink!,
  };
}

// Delete a calendar event
export async function deleteCalendarEvent(userId: string, eventId: string): Promise<void> {
  try {
    const calendar = await getCalendarClient(userId);
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });
    console.log(`[GoogleCalendar] Deleted event ${eventId}`);
  } catch (error: any) {
    if (error.code !== 404) {
      console.error('[GoogleCalendar] Failed to delete event:', error);
      throw error;
    }
  }
}

// Get upcoming calendar events
export async function getUpcomingEvents(userId: string, maxResults: number = 10): Promise<calendar_v3.Schema$Event[]> {
  const calendar = await getCalendarClient(userId);
  
  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });
  
  return response.data.items || [];
}
