// @ts-nocheck
/**
 * Outlook/Microsoft 365 Email Client for JobRunner
 * Uses Microsoft Graph API for sending emails through user's Outlook account
 * 
 * Supports per-user OAuth tokens stored in businessSettings
 * Each tradie connects their own Outlook/Microsoft 365 account
 */

import { createHmac, randomBytes } from 'crypto';
import { storage } from './storage';
import { getErrorMessage } from "./lib/errors";

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const MICROSOFT_TENANT = process.env.MICROSOFT_TENANT || 'common';

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
const OAUTH_AUTHORITY = `https://login.microsoftonline.com/${MICROSOFT_TENANT}`;

// State tokens for CSRF protection - expire after 10 minutes
const stateTokens = new Map<string, { userId: string; createdAt: number }>();
const STATE_TOKEN_EXPIRY = 10 * 60 * 1000; // 10 minutes

function generateSecureState(userId: string): string {
  const nonce = randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const data = `${userId}:${nonce}:${timestamp}`;
  const secret = process.env.SESSION_SECRET || MICROSOFT_CLIENT_SECRET || 'fallback-secret';
  const signature = createHmac('sha256', secret).update(data).digest('hex').slice(0, 16);
  const state = `${signature}:${Buffer.from(data).toString('base64')}`;
  
  // Store for validation
  stateTokens.set(signature, { userId, createdAt: timestamp });
  
  // Cleanup old tokens
  for (const [key, value] of Array.from(stateTokens.entries())) {
    if (Date.now() - value.createdAt > STATE_TOKEN_EXPIRY) {
      stateTokens.delete(key);
    }
  }
  
  return state;
}

function validateAndExtractState(state: string): { valid: boolean; userId?: string } {
  try {
    const [signature, encodedData] = state.split(':');
    if (!signature || !encodedData) {
      return { valid: false };
    }
    
    const stored = stateTokens.get(signature);
    if (!stored) {
      return { valid: false };
    }
    
    // Check expiry
    if (Date.now() - stored.createdAt > STATE_TOKEN_EXPIRY) {
      stateTokens.delete(signature);
      return { valid: false };
    }
    
    // Verify signature
    const data = Buffer.from(encodedData, 'base64').toString('utf-8');
    const secret = process.env.SESSION_SECRET || MICROSOFT_CLIENT_SECRET || 'fallback-secret';
    const expectedSignature = createHmac('sha256', secret).update(data).digest('hex').slice(0, 16);
    
    if (signature !== expectedSignature) {
      return { valid: false };
    }
    
    // Cleanup used token
    stateTokens.delete(signature);
    
    return { valid: true, userId: stored.userId };
  } catch {
    return { valid: false };
  }
}

function getRedirectUri(): string {
  let baseUrl: string;
  
  const appUrl = process.env.VITE_APP_URL || process.env.APP_URL;
  if (appUrl) {
    baseUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
  } else if (process.env.REPLIT_DEV_DOMAIN) {
    baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  } else if (process.env.REPLIT_DOMAINS) {
    baseUrl = `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
  } else {
    baseUrl = 'http://localhost:5000';
  }
  
  baseUrl = baseUrl.replace(/\/$/, '');
  const redirectUri = `${baseUrl}/api/integrations/outlook/callback`;
  console.log('[Outlook] Using redirect URI:', redirectUri);
  return redirectUri;
}

export function isOutlookConfigured(): boolean {
  return !!(MICROSOFT_CLIENT_ID && MICROSOFT_CLIENT_SECRET);
}

export function getAuthorizationUrl(userId: string): string {
  if (!MICROSOFT_CLIENT_ID) {
    throw new Error('Microsoft/Outlook credentials not configured');
  }
  
  const redirectUri = encodeURIComponent(getRedirectUri());
  const scopes = encodeURIComponent('openid profile email Mail.Send Mail.ReadWrite offline_access');
  // Use HMAC-signed state for CSRF protection
  const state = encodeURIComponent(generateSecureState(userId));
  
  return `${OAUTH_AUTHORITY}/oauth2/v2.0/authorize?` +
    `client_id=${MICROSOFT_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${redirectUri}` +
    `&scope=${scopes}` +
    `&response_mode=query` +
    `&state=${state}` +
    `&prompt=consent`;
}

export { validateAndExtractState };

export async function handleOAuthCallback(code: string, userId: string): Promise<{
  success: boolean;
  email?: string;
  error?: string;
}> {
  try {
    console.log(`[Outlook] Processing OAuth callback for user ${userId}`);
    
    if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
      throw new Error('Microsoft credentials not configured');
    }
    
    const tokenResponse = await fetch(`${OAUTH_AUTHORITY}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        client_secret: MICROSOFT_CLIENT_SECRET,
        code,
        redirect_uri: getRedirectUri(),
        grant_type: 'authorization_code',
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('[Outlook] Token exchange failed:', errorData);
      throw new Error('Failed to exchange authorization code');
    }
    
    const tokens = await tokenResponse.json();
    console.log(`[Outlook] Got tokens - access: ${!!tokens.access_token}, refresh: ${!!tokens.refresh_token}`);
    
    if (!tokens.refresh_token) {
      throw new Error('No refresh token received. Please try connecting again.');
    }
    
    let email: string | undefined;
    try {
      const profileResponse = await fetch(`${GRAPH_API_BASE}/me`, {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
        },
      });
      
      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        email = profile.mail || profile.userPrincipalName;
        console.log(`[Outlook] Got user email: ${email}`);
      }
    } catch (profileError: unknown) {
      console.warn('[Outlook] Could not fetch user profile:', getErrorMessage(profileError));
    }
    
    const expiryDate = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);
    
    await storage.updateBusinessSettings(userId, {
      outlookConnected: true,
      outlookAccessToken: tokens.access_token,
      outlookRefreshToken: tokens.refresh_token,
      outlookTokenExpiry: expiryDate,
      outlookEmail: email || null,
    });
    
    console.log(`[Outlook] Successfully connected for user ${userId}: ${email}`);
    return { success: true, email };
  } catch (error: unknown) {
    console.error('[Outlook] OAuth callback error:', getErrorMessage(error) || error);
    return { success: false, error: getErrorMessage(error) || 'Unknown error during authorization' };
  }
}

export async function disconnectOutlook(userId: string): Promise<void> {
  await storage.updateBusinessSettings(userId, {
    outlookConnected: false,
    outlookAccessToken: null,
    outlookRefreshToken: null,
    outlookTokenExpiry: null,
    outlookEmail: null,
  });
  console.log(`[Outlook] Disconnected for user ${userId}`);
}

async function getUserAccessToken(userId: string): Promise<string> {
  const settings = await storage.getBusinessSettings(userId);
  
  if (!settings?.outlookConnected) {
    throw new Error('Outlook not connected. Please connect your Outlook account in Settings.');
  }
  
  if (!settings.outlookRefreshToken) {
    console.warn(`[Outlook] No refresh token found for user ${userId}`);
    await storage.updateBusinessSettings(userId, {
      outlookConnected: false,
    });
    throw new Error('Outlook authorization incomplete. Please reconnect your account.');
  }
  
  const tokenExpiry = settings.outlookTokenExpiry 
    ? new Date(settings.outlookTokenExpiry).getTime() 
    : 0;
  const PROACTIVE_REFRESH_BUFFER = 10 * 60 * 1000;
  const isExpiringSoon = tokenExpiry < Date.now() + PROACTIVE_REFRESH_BUFFER;
  
  if (!isExpiringSoon && settings.outlookAccessToken) {
    return settings.outlookAccessToken;
  }
  
  console.log(`[Outlook] Token expiring soon for user ${userId}, refreshing...`);
  
  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
    throw new Error('Microsoft credentials not configured');
  }
  
  const MAX_RETRIES = 3;
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const tokenResponse = await fetch(`${OAUTH_AUTHORITY}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: MICROSOFT_CLIENT_ID,
          client_secret: MICROSOFT_CLIENT_SECRET,
          refresh_token: settings.outlookRefreshToken,
          grant_type: 'refresh_token',
        }),
      });
      
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        if (errorData.error === 'invalid_grant') {
          await storage.updateBusinessSettings(userId, {
            outlookConnected: false,
            outlookAccessToken: null,
          });
          throw new Error('Outlook access was revoked. Please reconnect your account in Settings → Integrations.');
        }
        throw new Error(errorData.error_description || 'Token refresh failed');
      }
      
      const tokens = await tokenResponse.json();
      
      if (!tokens.access_token) {
        throw new Error('No access token returned from refresh');
      }
      
      const expiryDate = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);
      
      await storage.updateBusinessSettings(userId, {
        outlookAccessToken: tokens.access_token,
        outlookRefreshToken: tokens.refresh_token || settings.outlookRefreshToken,
        outlookTokenExpiry: expiryDate,
      });
      
      console.log(`[Outlook] Successfully refreshed token for user ${userId}`);
      return tokens.access_token;
    } catch (error: unknown) {
      lastError = error;
      
      if (getErrorMessage(error).includes('revoked') || getErrorMessage(error).includes('invalid_grant')) {
        throw error;
      }
      
      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`[Outlook] Token refresh attempt ${attempt} failed, retrying in ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`Failed to refresh Outlook token: ${lastError?.message}`);
}

export async function isOutlookConnected(userId: string): Promise<boolean> {
  try {
    const settings = await storage.getBusinessSettings(userId);
    return !!(settings?.outlookConnected && settings.outlookRefreshToken);
  } catch {
    return false;
  }
}

export async function getOutlookProfile(userId: string): Promise<{
  email?: string;
  displayName?: string;
} | null> {
  try {
    const settings = await storage.getBusinessSettings(userId);
    if (!settings?.outlookConnected) {
      return null;
    }
    
    return {
      email: settings.outlookEmail || undefined,
      displayName: settings.outlookEmail?.split('@')[0] || undefined,
    };
  } catch {
    return null;
  }
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendViaOutlookAPI(
  userId: string,
  options: SendEmailOptions
): Promise<EmailResult> {
  try {
    const accessToken = await getUserAccessToken(userId);
    
    const message: any = {
      subject: options.subject,
      body: {
        contentType: 'HTML',
        content: options.html,
      },
      toRecipients: [
        {
          emailAddress: {
            address: options.to,
          },
        },
      ],
    };
    
    if (options.attachments && options.attachments.length > 0) {
      message.attachments = options.attachments.map(att => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: att.filename,
        contentType: att.contentType || 'application/octet-stream',
        contentBytes: typeof att.content === 'string' 
          ? att.content 
          : att.content.toString('base64'),
      }));
    }
    
    const response = await fetch(`${GRAPH_API_BASE}/me/sendMail`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        saveToSentItems: true,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Outlook] Send email failed:', errorData);
      return {
        success: false,
        error: errorData.error?.message || 'Failed to send email via Outlook',
      };
    }
    
    console.log(`[Outlook] Email sent successfully to ${options.to}`);
    return {
      success: true,
      messageId: `outlook_${Date.now()}`,
    };
  } catch (error: unknown) {
    console.error('[Outlook] Send email error:', getErrorMessage(error));
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

export async function getConnectionInfo(userId: string): Promise<{
  connected: boolean;
  configured: boolean;
  email?: string;
}> {
  const configured = isOutlookConfigured();
  
  try {
    const settings = await storage.getBusinessSettings(userId);
    
    if (!settings?.outlookConnected) {
      return { connected: false, configured };
    }
    
    return {
      connected: true,
      configured: true,
      email: settings.outlookEmail || undefined,
    };
  } catch {
    return { connected: false, configured };
  }
}
