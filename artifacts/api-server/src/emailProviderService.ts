import { getErrorMessage } from "./lib/errors";
// Email Provider Service - Handles SendGrid health checks and fallback to external email clients
// Supports: SendGrid (direct send), Gmail, Outlook, Apple Mail, generic mailto

export interface EmailProviderStatus {
  sendgrid: {
    available: boolean;
    configured: boolean;
    lastError?: string;
    lastCheck?: string;
  };
  gmail: {
    available: boolean;
    connected: boolean;
  };
  fallbackRequired: boolean;
  recommendedProvider: 'sendgrid' | 'gmail' | 'external';
  availableClients: EmailClient[];
}

export interface EmailClient {
  id: string;
  name: string;
  icon: string;
  available: boolean;
  priority: number;
}

export interface EmailComposeData {
  to: string;
  subject: string;
  body: string;
  attachmentUrl?: string;
  cc?: string;
  bcc?: string;
}

// Check if SendGrid is properly configured and working
export async function checkSendGridHealth(): Promise<{ available: boolean; configured: boolean; error?: string }> {
  try {
    const apiKey = process.env.SENDGRID_API_KEY;
    
    if (!apiKey) {
      return { available: false, configured: false, error: 'SendGrid API key not configured' };
    }
    
    // Check if key looks valid (basic format check)
    if (!apiKey.startsWith('SG.') || apiKey.length < 50) {
      return { available: false, configured: true, error: 'SendGrid API key appears invalid' };
    }
    
    // For now, assume configured means available - we'll get real errors on send attempts
    return { available: true, configured: true };
  } catch (error: unknown) {
    return { available: false, configured: false, error: getErrorMessage(error) };
  }
}

// Get list of available email clients for fallback (web + mobile compatible)
export function getAvailableEmailClients(): EmailClient[] {
  return [
    { id: 'gmail', name: 'Gmail', icon: 'mail', available: true, priority: 1 },
    { id: 'outlook', name: 'Outlook', icon: 'mail', available: true, priority: 2 },
    { id: 'apple_mail', name: 'Apple Mail', icon: 'mail', available: true, priority: 3 },
    { id: 'yahoo', name: 'Yahoo Mail', icon: 'mail', available: true, priority: 4 },
    { id: 'default', name: 'Default Email App', icon: 'mail', available: true, priority: 5 },
  ];
}

// Generate compose URL for various email clients
export function generateComposeUrl(client: string, data: EmailComposeData): string {
  const { to, subject, body, cc, bcc } = data;
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  const encodedTo = encodeURIComponent(to);
  
  switch (client) {
    case 'gmail':
      // Gmail compose URL (web)
      let gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedTo}&su=${encodedSubject}&body=${encodedBody}`;
      if (cc) gmailUrl += `&cc=${encodeURIComponent(cc)}`;
      if (bcc) gmailUrl += `&bcc=${encodeURIComponent(bcc)}`;
      return gmailUrl;
      
    case 'outlook':
      // Outlook web compose URL
      let outlookUrl = `https://outlook.live.com/mail/0/deeplink/compose?to=${encodedTo}&subject=${encodedSubject}&body=${encodedBody}`;
      if (cc) outlookUrl += `&cc=${encodeURIComponent(cc)}`;
      if (bcc) outlookUrl += `&bcc=${encodeURIComponent(bcc)}`;
      return outlookUrl;
      
    case 'outlook365':
      // Office 365 Outlook
      let o365Url = `https://outlook.office.com/mail/deeplink/compose?to=${encodedTo}&subject=${encodedSubject}&body=${encodedBody}`;
      if (cc) o365Url += `&cc=${encodeURIComponent(cc)}`;
      if (bcc) o365Url += `&bcc=${encodeURIComponent(bcc)}`;
      return o365Url;
      
    case 'yahoo':
      // Yahoo Mail compose URL
      let yahooUrl = `https://compose.mail.yahoo.com/?to=${encodedTo}&subject=${encodedSubject}&body=${encodedBody}`;
      if (cc) yahooUrl += `&cc=${encodeURIComponent(cc)}`;
      if (bcc) yahooUrl += `&bcc=${encodeURIComponent(bcc)}`;
      return yahooUrl;
      
    case 'apple_mail':
    case 'default':
    default:
      // Standard mailto: link (works on all platforms, opens default email client)
      let mailtoUrl = `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`;
      if (cc) mailtoUrl += `&cc=${encodeURIComponent(cc)}`;
      if (bcc) mailtoUrl += `&bcc=${encodeURIComponent(bcc)}`;
      return mailtoUrl;
  }
}

// Get comprehensive email provider status
export async function getEmailProviderStatus(userId: string, storage: any): Promise<EmailProviderStatus> {
  const sendgridHealth = await checkSendGridHealth();
  
  // Check if Gmail is connected via our integration
  let gmailConnected = false;
  try {
    const businessSettings = await storage.getBusinessSettings(userId);
    gmailConnected = businessSettings?.emailProvider === 'gmail' && !!businessSettings?.gmailConnected;
  } catch (e) {
    // Ignore errors, just mark as not connected
  }
  
  const availableClients = getAvailableEmailClients();
  
  // Determine recommended provider
  let recommendedProvider: 'sendgrid' | 'gmail' | 'external' = 'external';
  if (sendgridHealth.available) {
    recommendedProvider = 'sendgrid';
  } else if (gmailConnected) {
    recommendedProvider = 'gmail';
  }
  
  return {
    sendgrid: {
      available: sendgridHealth.available,
      configured: sendgridHealth.configured,
      lastError: sendgridHealth.error,
      lastCheck: new Date().toISOString(),
    },
    gmail: {
      available: gmailConnected,
      connected: gmailConnected,
    },
    fallbackRequired: !sendgridHealth.available && !gmailConnected,
    recommendedProvider,
    availableClients,
  };
}

// Generate user-friendly warning messages for email issues
export function getEmailWarning(status: EmailProviderStatus): { 
  type: 'info' | 'warning' | 'error'; 
  title: string; 
  message: string; 
  action?: string;
  actionUrl?: string;
} | null {
  if (status.sendgrid.available || status.gmail.available) {
    return null; // No warning needed
  }
  
  if (!status.sendgrid.configured) {
    return {
      type: 'warning',
      title: 'Email Not Set Up',
      message: 'Direct email sending is not configured. You can still send quotes and invoices by opening them in your email app.',
      action: 'Set up email in Settings',
      actionUrl: '/settings?tab=email',
    };
  }
  
  if (status.sendgrid.lastError) {
    return {
      type: 'error',
      title: 'Email Service Issue',
      message: `There's a problem with the email service: ${status.sendgrid.lastError}. Use "Open with" to send via your email app instead.`,
      action: 'Check email settings',
      actionUrl: '/settings?tab=email',
    };
  }
  
  return {
    type: 'info',
    title: 'Using External Email',
    message: 'Emails will open in your email app for sending. Connect your email in Settings for direct sending.',
    action: 'Connect email',
    actionUrl: '/settings?tab=email',
  };
}

// Format email body for plain text (for mailto links)
export function formatPlainTextBody(htmlContent: string): string {
  // Strip HTML tags and convert to plain text
  let text = htmlContent
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '') // Remove remaining HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
    .trim();
  
  return text;
}

// Types EmailProviderStatus, EmailClient, EmailComposeData are already exported above.
