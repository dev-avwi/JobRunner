import { getErrorMessage } from "./lib/errors";
// Gmail Client using Replit's managed connector
// This provides access to Gmail API for sending emails on behalf of tradies

import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken(): Promise<string> {
  if (connectionSettings && connectionSettings.settings?.expires_at && 
      new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!hostname) {
    throw new Error('REPLIT_CONNECTORS_HOSTNAME not set');
  }

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const url = 'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail';
  console.log('[Gmail] Checking connection at:', url.replace(/token=[^&]+/, 'token=***'));
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'X_REPLIT_TOKEN': xReplitToken
    }
  });
  
  const data = await response.json();
  console.log('[Gmail] Connection response:', JSON.stringify({ 
    hasItems: !!data.items, 
    itemCount: data.items?.length || 0,
    firstItemName: data.items?.[0]?.name || 'none'
  }));
  
  connectionSettings = data.items?.[0];

  const accessToken = connectionSettings?.settings?.access_token || 
                      connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Gmail not connected - no access token found');
  }
  return accessToken;
}

// Get email from connection settings if available (doesn't require API call)
export function getEmailFromConnectionSettings(): string | null {
  if (!connectionSettings) return null;
  
  // Check various possible locations for the email in connection settings
  const email = connectionSettings.settings?.email ||
                connectionSettings.settings?.user_email ||
                connectionSettings.email ||
                connectionSettings.settings?.oauth?.email;
  
  return email || null;
}

// Get Gmail client - WARNING: Never cache this, tokens expire
export async function getGmailClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// Check if Gmail is connected via Replit connector
export async function isGmailConnected(): Promise<boolean> {
  try {
    await getAccessToken();
    console.log('[Gmail] Connection check: Connected');
    return true;
  } catch (error: unknown) {
    console.log('[Gmail] Connection check: Not connected -', getErrorMessage(error) || 'Unknown error');
    return false;
  }
}

// Get the email address from the Gmail profile
export async function getGmailProfile(): Promise<{ email: string; displayName: string } | null> {
  try {
    const gmail = await getGmailClient();
    const profile = await gmail.users.getProfile({ userId: 'me' });
    
    return {
      email: profile.data.emailAddress || '',
      displayName: profile.data.emailAddress?.split('@')[0] || 'Gmail User'
    };
  } catch (error: any) {
    // Don't spam logs for expected scope limitation - connector may have send-only permissions
    if (error?.code === 403 || error?.status === 403) {
      console.log('[Gmail] Profile access not permitted (send-only connector scope is normal)');
    } else {
      console.error('[Gmail] Profile fetch failed:', getErrorMessage(error) || error);
    }
    return null;
  }
}

// Create a raw email message with attachments for Gmail API
function createRawMessage(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}): string {
  const boundary = `boundary_${Date.now()}`;
  const { to, subject, html, text, fromEmail, fromName, replyTo, attachments } = options;

  const fromHeader = fromName 
    ? `=?UTF-8?B?${Buffer.from(fromName).toString('base64')}?= <${fromEmail}>` 
    : fromEmail;

  let message = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
  ];
  
  // Add Reply-To header so client replies go to tradie's business email
  if (replyTo) {
    message.push(`Reply-To: ${replyTo}`);
  }
  
  message.push('MIME-Version: 1.0');

  if (attachments && attachments.length > 0) {
    message.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    message.push('');
    message.push(`--${boundary}`);
    message.push('Content-Type: multipart/alternative; boundary="alt_boundary"');
    message.push('');

    if (text) {
      message.push('--alt_boundary');
      message.push('Content-Type: text/plain; charset="UTF-8"');
      message.push('');
      message.push(text);
    }

    message.push('--alt_boundary');
    message.push('Content-Type: text/html; charset="UTF-8"');
    message.push('');
    message.push(html);
    message.push('--alt_boundary--');

    for (const attachment of attachments) {
      const content = Buffer.isBuffer(attachment.content) 
        ? attachment.content.toString('base64')
        : Buffer.from(attachment.content).toString('base64');
      
      message.push(`--${boundary}`);
      message.push(`Content-Type: ${attachment.contentType || 'application/octet-stream'}`);
      message.push('Content-Transfer-Encoding: base64');
      message.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
      message.push('');
      message.push(content);
    }

    message.push(`--${boundary}--`);
  } else {
    message.push('Content-Type: multipart/alternative; boundary="alt_boundary"');
    message.push('');

    if (text) {
      message.push('--alt_boundary');
      message.push('Content-Type: text/plain; charset="UTF-8"');
      message.push('');
      message.push(text);
    }

    message.push('--alt_boundary');
    message.push('Content-Type: text/html; charset="UTF-8"');
    message.push('');
    message.push(html);
    message.push('--alt_boundary--');
  }

  const rawMessage = message.join('\r\n');
  return Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Create a raw email message with optional From display name - Gmail will auto-fill the email
function createRawMessageWithoutFrom(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}): string {
  const boundary = `boundary_${Date.now()}`;
  const { to, subject, html, text, fromName, replyTo, attachments } = options;

  // Build message headers - include From with display name if provided
  // Gmail API will merge the email address when sending
  let message: string[] = [];
  
  // Add From header with display name if provided
  // Gmail API will replace/merge the email but preserve the display name
  if (fromName) {
    // Encode the display name for email headers (RFC 2047)
    const encodedName = `=?UTF-8?B?${Buffer.from(fromName).toString('base64')}?=`;
    // Use 'me' as placeholder - Gmail API will replace with actual authenticated email
    message.push(`From: ${encodedName} <me>`);
  }
  
  // Add Reply-To header so client replies go to tradie's business email
  if (replyTo) {
    message.push(`Reply-To: ${replyTo}`);
  }
  
  message.push(`To: ${to}`);
  message.push(`Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`);
  message.push('MIME-Version: 1.0');

  if (attachments && attachments.length > 0) {
    message.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    message.push('');
    message.push(`--${boundary}`);
    message.push('Content-Type: multipart/alternative; boundary="alt_boundary"');
    message.push('');

    if (text) {
      message.push('--alt_boundary');
      message.push('Content-Type: text/plain; charset="UTF-8"');
      message.push('');
      message.push(text);
    }

    message.push('--alt_boundary');
    message.push('Content-Type: text/html; charset="UTF-8"');
    message.push('');
    message.push(html);
    message.push('--alt_boundary--');

    for (const attachment of attachments) {
      const content = Buffer.isBuffer(attachment.content) 
        ? attachment.content.toString('base64')
        : Buffer.from(attachment.content).toString('base64');
      
      message.push(`--${boundary}`);
      message.push(`Content-Type: ${attachment.contentType || 'application/octet-stream'}`);
      message.push('Content-Transfer-Encoding: base64');
      message.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
      message.push('');
      message.push(content);
    }

    message.push(`--${boundary}--`);
  } else {
    message.push('Content-Type: multipart/alternative; boundary="alt_boundary"');
    message.push('');

    if (text) {
      message.push('--alt_boundary');
      message.push('Content-Type: text/plain; charset="UTF-8"');
      message.push('');
      message.push(text);
    }

    message.push('--alt_boundary');
    message.push('Content-Type: text/html; charset="UTF-8"');
    message.push('');
    message.push(html);
    message.push('--alt_boundary--');
  }

  const rawMessage = message.join('\r\n');
  return Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function updateSendAsDisplayName(gmail: any, fromEmail: string, displayName: string): Promise<boolean> {
  try {
    await gmail.users.settings.sendAs.patch({
      userId: 'me',
      sendAsEmail: fromEmail,
      requestBody: {
        displayName: displayName,
      },
    });
    console.log(`[Gmail] Updated sendAs display name to "${displayName}" for ${fromEmail}`);
    return true;
  } catch (error: any) {
    if (error?.code === 403 || error?.status === 403) {
      console.log(`[Gmail] Cannot update sendAs display name (insufficient permissions) — sender will show account default name`);
    } else {
      console.warn(`[Gmail] sendAs display name update failed:`, getErrorMessage(error));
    }
    return false;
  }
}

// Send email via Gmail API
export async function sendViaGmailAPI(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const gmail = await getGmailClient();
    
    let fromEmail: string | null = null;
    
    fromEmail = getEmailFromConnectionSettings();
    
    if (!fromEmail) {
      try {
        const profile = await gmail.users.getProfile({ userId: 'me' });
        fromEmail = profile.data.emailAddress || null;
      } catch (profileError: any) {
        if (profileError?.code === 403 || profileError?.status === 403) {
          console.log('[Gmail] Profile API returned 403 - connector has send-only permissions, will try sending without explicit From');
        } else {
          console.warn('[Gmail] Profile fetch failed:', getErrorMessage(profileError));
        }
      }
    }
    
    if (!fromEmail && options.replyTo) {
      console.log(`[Gmail] Using replyTo as from email for display name: ${options.fromName || 'none'}`);
      fromEmail = options.replyTo;
    }

    if (options.fromName && fromEmail) {
      await updateSendAsDisplayName(gmail, fromEmail, options.fromName);
    }

    if (!fromEmail) {
      console.log(`[Gmail] No from email available, attempting send with auto-from (fromName: ${options.fromName || 'none'}, replyTo: ${options.replyTo || 'none'})`);
      const raw = createRawMessageWithoutFrom({
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        fromName: options.fromName,
        replyTo: options.replyTo,
        attachments: options.attachments,
      });

      const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw
        }
      });

      console.log(`✅ Email sent via Gmail (auto-from), messageId: ${result.data.id}`);
      
      return {
        success: true,
        messageId: result.data.id || undefined
      };
    }

    const raw = createRawMessage({
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      fromEmail,
      fromName: options.fromName,
      replyTo: options.replyTo,
      attachments: options.attachments,
    });

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw
      }
    });

    console.log(`✅ Email sent via Gmail, messageId: ${result.data.id}`);
    
    return {
      success: true,
      messageId: result.data.id || undefined
    };
  } catch (error: unknown) {
    console.error('Gmail send error:', getErrorMessage(error) || 'Unknown error');
    return {
      success: false,
      error: getErrorMessage(error) || 'Failed to send via Gmail'
    };
  }
}

// Create a Gmail draft with PDF attachment - tradie can review and send
export async function createGmailDraftWithAttachment(options: {
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
}): Promise<{ success: boolean; draftId?: string; draftUrl?: string; error?: string }> {
  try {
    const gmail = await getGmailClient();
    
    // Try to get the authenticated user's email from multiple sources
    let fromEmail: string | null = null;
    
    // 1. First try to get email from connection settings (no API call needed)
    fromEmail = getEmailFromConnectionSettings();
    
    // 2. If not available, try the profile API
    if (!fromEmail) {
      try {
        const profile = await gmail.users.getProfile({ userId: 'me' });
        fromEmail = profile.data.emailAddress || null;
      } catch (profileError: any) {
        if (profileError?.code === 403 || profileError?.status === 403) {
          console.log('[Gmail] Profile API returned 403 for draft creation - will try without explicit From');
        } else {
          console.warn('[Gmail] Profile fetch failed for draft:', getErrorMessage(profileError));
        }
      }
    }
    
    // 3. Create draft with or without explicit From
    let raw: string;
    if (fromEmail) {
      raw = createRawMessage({
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        fromEmail,
        fromName: options.fromName,
        attachments: options.attachments,
      });
    } else {
      raw = createRawMessageWithoutFrom({
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        fromName: options.fromName,
        attachments: options.attachments,
      });
    }

    // Create draft instead of sending
    const result = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw
        }
      }
    });

    const draftId = result.data.id;
    // Gmail draft URL format to open compose window with the draft
    const draftUrl = draftId 
      ? `https://mail.google.com/mail/u/0/?compose=${draftId}`
      : null;

    console.log(`✅ Gmail draft created with attachment, draftId: ${draftId}`);
    
    return {
      success: true,
      draftId: draftId || undefined,
      draftUrl: draftUrl || undefined
    };
  } catch (error: unknown) {
    console.error('Gmail draft creation error:', getErrorMessage(error) || 'Unknown error');
    return {
      success: false,
      error: getErrorMessage(error) || 'Failed to create Gmail draft'
    };
  }
}
