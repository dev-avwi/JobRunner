import { Linking, Platform } from 'react-native';

export type EmailClient = 'gmail' | 'outlook' | 'outlook365' | 'yahoo' | 'apple_mail' | 'default';

export interface ComposeEmailOptions {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}

export function getAvailableEmailClients(): { id: EmailClient; name: string; icon: string }[] {
  const clients: { id: EmailClient; name: string; icon: string }[] = [
    { id: 'gmail', name: 'Gmail', icon: 'mail' },
    { id: 'outlook', name: 'Outlook', icon: 'mail' },
  ];
  
  if (Platform.OS === 'ios') {
    clients.push({ id: 'apple_mail', name: 'Apple Mail', icon: 'mail' });
  }
  
  clients.push({ id: 'default', name: 'Default Email', icon: 'mail' });
  
  return clients;
}

export function generateComposeUrl(client: EmailClient, options: ComposeEmailOptions): string {
  const { to, subject, body, cc, bcc } = options;
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  
  switch (client) {
    case 'gmail':
      let gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodedSubject}&body=${encodedBody}`;
      if (cc) gmailUrl += `&cc=${encodeURIComponent(cc)}`;
      if (bcc) gmailUrl += `&bcc=${encodeURIComponent(bcc)}`;
      return gmailUrl;

    case 'outlook':
    case 'outlook365':
      let outlookUrl = `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(to)}&subject=${encodedSubject}&body=${encodedBody}`;
      if (cc) outlookUrl += `&cc=${encodeURIComponent(cc)}`;
      if (bcc) outlookUrl += `&bcc=${encodeURIComponent(bcc)}`;
      return outlookUrl;

    case 'yahoo':
      let yahooUrl = `https://compose.mail.yahoo.com/?to=${encodeURIComponent(to)}&subject=${encodedSubject}&body=${encodedBody}`;
      if (cc) yahooUrl += `&cc=${encodeURIComponent(cc)}`;
      if (bcc) yahooUrl += `&bcc=${encodeURIComponent(bcc)}`;
      return yahooUrl;

    case 'apple_mail':
      let mailtoUrl = `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`;
      if (cc) mailtoUrl += `&cc=${encodeURIComponent(cc)}`;
      if (bcc) mailtoUrl += `&bcc=${encodeURIComponent(bcc)}`;
      return mailtoUrl;

    case 'default':
    default:
      let defaultUrl = `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`;
      if (cc) defaultUrl += `&cc=${encodeURIComponent(cc)}`;
      if (bcc) defaultUrl += `&bcc=${encodeURIComponent(bcc)}`;
      return defaultUrl;
  }
}

export async function openEmailClient(client: EmailClient, options: ComposeEmailOptions): Promise<boolean> {
  const url = generateComposeUrl(client, options);
  
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    } else {
      if (client !== 'default') {
        return openEmailClient('default', options);
      }
      if (__DEV__) console.error('Cannot open email client');
      return false;
    }
  } catch (error) {
    if (__DEV__) console.error('Error opening email client:', error);
    return false;
  }
}

export async function shareViaEmail(options: ComposeEmailOptions): Promise<boolean> {
  return openEmailClient('default', options);
}

export const SAMPLE_MERGE_DATA: Record<string, string> = {
  client_name: 'John Smith',
  business_name: 'My Trade Business',
  quote_number: 'Q-0001',
  invoice_number: 'INV-0001',
  quote_total: '$1,250.00',
  invoice_total: '$1,250.00',
  job_title: 'Kitchen Renovation',
  job_address: '123 Main St, Sydney NSW 2000',
  due_date: '15 Jan 2025',
  completion_date: '10 Jan 2025',
  warranty_months: '12',
  deposit_percent: '50',
  bank_details: 'BSB: 123-456, Account: 12345678',
  days_overdue: '7',
  worker_name: 'Mike Johnson',
  date: new Date().toLocaleDateString('en-AU'),
};

export function renderTemplatePreview(content: string, customData?: Record<string, string>): string {
  let preview = content;
  const data = { ...SAMPLE_MERGE_DATA, ...customData };
  
  for (const [key, value] of Object.entries(data)) {
    preview = preview.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  
  return preview;
}
