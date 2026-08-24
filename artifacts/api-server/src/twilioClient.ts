/**
 * Twilio Client for SMS notifications
 * Supports both standalone deployment and Replit's managed connector
 * 
 * Integration: connection:conn_twilio_01KB17KVHYEAGTVK0VVR1H47AA
 * 
 * For standalone deployment, set these environment variables:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN (or TWILIO_API_KEY + TWILIO_API_KEY_SECRET)
 * - TWILIO_PHONE_NUMBER
 */

import twilio from 'twilio';
import { getErrorMessage } from "./lib/errors";
import { getProductionBaseUrl } from "./urlHelper";

/**
 * Sanitise a message body to the GSM-7 character set so Twilio never
 * silently switches to UCS-2 encoding (which triples segment cost).
 *
 * Replaces the most common typographic characters that arrive from
 * copy-paste or template fields:
 *   curly quotes  → straight quotes
 *   em/en dashes  → hyphen
 *   ellipsis      → three dots
 *   non-breaking space → regular space
 *
 * Any remaining non-GSM-7 code points are replaced with '?' so the
 * message always stays in the 160-char/segment GSM-7 range.
 */
export function toGSM(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")  // curly single quotes / primes
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')  // curly double quotes / double primes
    .replace(/\u2014/g, '-')   // em dash
    .replace(/\u2013/g, '-')   // en dash
    .replace(/\u2026/g, '...')  // horizontal ellipsis
    .replace(/\u00A0/g, ' ')   // non-breaking space
    // Replace any remaining characters outside the GSM-7 basic + extension charset.
    //
    // Allow-list: every Unicode code point that appears in ETSI TS 123 038
    // (3GPP TS 23.038) Table 1 (basic) or Table 2 (extension), listed
    // individually.  Broad ranges such as \u00C0-\u00C6 are intentionally
    // avoided: they admit characters like À/Á/Â/Ã that are NOT in the
    // standard and would cause Twilio to silently switch to UCS-2 encoding
    // (70-char segments instead of 160).
    //
    // \x20-\x5F\x61-\x7E — printable ASCII EXCLUDING backtick (U+0060).
    //   Position 0x60 in the GSM basic table maps to ¿, not `.
    //   Extension characters ^, [, \, ], {, |, }, ~ cost 2 septets each.
    //
    // Non-ASCII GSM-7 characters (basic table, explicit list):
    //   \u00A1 ¡  \u00A3 £  \u00A4 ¤  \u00A5 ¥  \u00A7 §  \u00BF ¿
    //   \u00C4 Ä  \u00C5 Å  \u00C6 Æ  \u00C7 Ç  \u00C9 É  \u00D1 Ñ
    //   \u00D6 Ö  \u00D8 Ø  \u00DC Ü  \u00DF ß  \u00E0 à  \u00E4 ä
    //   \u00E5 å  \u00E6 æ  \u00E8 è  \u00E9 é  \u00EC ì  \u00F1 ñ
    //   \u00F2 ò  \u00F6 ö  \u00F8 ø  \u00F9 ù  \u00FC ü
    //   Greek: \u0393 Γ \u0394 Δ \u0398 Θ \u039B Λ \u039E Ξ
    //          \u03A0 Π \u03A3 Σ \u03A6 Φ \u03A8 Ψ \u03A9 Ω
    //   Extension table: \u20AC €
    .replace(/[^\x20-\x5F\x61-\x7E\u000A\u000D\u00A1\u00A3\u00A4\u00A5\u00A7\u00BF\u00C4\u00C5\u00C6\u00C7\u00C9\u00D1\u00D6\u00D8\u00DC\u00DF\u00E0\u00E4\u00E5\u00E6\u00E8\u00E9\u00EC\u00F1\u00F2\u00F6\u00F8\u00F9\u00FC\u0393\u0394\u0398\u039B\u039E\u03A0\u03A3\u03A6\u03A8\u03A9\u20AC]/g, '?');
}

let twilioClient: ReturnType<typeof twilio> | null = null;
let twilioPhoneNumber: string | null = null;
let isInitialized = false;
let cachedAvailability: { configured: boolean; connected: boolean; hasPhoneNumber: boolean; verified?: boolean } | null = null;
let availabilityCacheTime: number = 0;
const AVAILABILITY_CACHE_TTL = 60000; // Cache for 1 minute

interface TwilioCredentials {
  accountSid: string;
  apiKey?: string;
  apiKeySecret?: string;
  authToken?: string;
  phoneNumber: string;
}

/**
 * Check if a value looks like a placeholder rather than a real credential
 */
function isPlaceholderValue(value: string | undefined | null): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (trimmed.length < 10) return true; // Too short to be real
  
  // Common placeholder patterns
  const placeholderPatterns = [
    /^AC[Xx]+$/i,           // ACxxxx... or ACXXXX...
    /^SK[Xx]+$/i,           // SKxxxx...
    /^your[_\s]/i,          // "your_account_sid", "Your Auth Token"
    /^placeholder/i,        // "placeholder..."
    /^test[_\s]/i,          // "test_..." but not real test keys
    /^example/i,            // "example..."
    /^enter[_\s]/i,         // "enter your..."
    /^\*+$/,                // Just asterisks
    /^\.+$/,                // Just dots
  ];
  
  return placeholderPatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Check if a phone number looks valid (E.164 format)
 */
function isValidPhoneNumber(phone: string | undefined | null): boolean {
  if (!phone) return false;
  const trimmed = phone.trim();
  // E.164 format: + followed by 10-15 digits
  return /^\+[1-9]\d{9,14}$/.test(trimmed);
}

/**
 * Get Twilio credentials from multiple sources (standalone deployment support)
 * Priority:
 * 1. Direct environment variables (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, etc.)
 * 2. Replit managed connector
 */
async function getCredentials(): Promise<TwilioCredentials> {
  // Priority 1: Check for direct environment variables (standalone deployment)
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const apiKey = process.env.TWILIO_API_KEY;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  
  if (accountSid && (authToken || (apiKey && apiKeySecret))) {
    console.log('✅ Using direct Twilio environment variables');
    return {
      accountSid,
      authToken: authToken || undefined,
      apiKey: apiKey || undefined,
      apiKeySecret: apiKeySecret || undefined,
      phoneNumber: phoneNumber || ''
    };
  }

  // Priority 2: Try Replit managed connector
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken || !hostname) {
    throw new Error('No Twilio credentials available (direct env vars or Replit connector)');
  }

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=twilio`,
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );

  const data = await response.json() as any;
  const connectionSettings = data.items?.[0];

  if (!connectionSettings?.settings?.account_sid || 
      !connectionSettings?.settings?.api_key || 
      !connectionSettings?.settings?.api_key_secret) {
    throw new Error('Twilio not connected - missing credentials from Replit connector');
  }

  console.log('✅ Using Replit managed Twilio connector');
  // Handle both phone_number and twilio_phone_number field names
  const phoneNum = connectionSettings.settings.phone_number || 
                   connectionSettings.settings.twilio_phone_number || 
                   connectionSettings.settings.phoneNumber || '';
  return {
    accountSid: connectionSettings.settings.account_sid,
    apiKey: connectionSettings.settings.api_key,
    apiKeySecret: connectionSettings.settings.api_key_secret,
    phoneNumber: phoneNum
  };
}

export async function initializeTwilio(): Promise<boolean> {
  try {
    const credentials = await getCredentials();
    
    // Support both authToken and apiKey authentication
    if (credentials.authToken) {
      // Use account SID + auth token authentication
      twilioClient = twilio(credentials.accountSid, credentials.authToken);
    } else if (credentials.apiKey && credentials.apiKeySecret) {
      // Use API key authentication
      twilioClient = twilio(credentials.apiKey, credentials.apiKeySecret, {
        accountSid: credentials.accountSid
      });
    } else {
      throw new Error('No valid Twilio authentication method available');
    }
    
    twilioPhoneNumber = credentials.phoneNumber;
    isInitialized = true;
    console.log('✅ Twilio initialized for SMS notifications');
    return true;
  } catch (error) {
    console.log('⚠️ Twilio not available - SMS notifications will be simulated');
    isInitialized = false;
    return false;
  }
}

export function isTwilioInitialized(): boolean {
  return isInitialized && twilioClient !== null;
}

// Check if Twilio is available (async - checks connector or env vars, with caching)
// Returns connected: true only if credentials appear valid (not placeholders) and phone number is present
export async function checkTwilioAvailability(): Promise<{ configured: boolean; connected: boolean; hasPhoneNumber: boolean; verified: boolean }> {
  // Return cached result if still valid
  const now = Date.now();
  if (cachedAvailability && (now - availabilityCacheTime) < AVAILABILITY_CACHE_TTL) {
    return { ...cachedAvailability, verified: cachedAvailability.connected };
  }
  
  // If already initialized and verified, return cached positive result
  if (isInitialized && twilioClient && twilioPhoneNumber && isValidPhoneNumber(twilioPhoneNumber)) {
    const result = { configured: true, connected: true, hasPhoneNumber: true, verified: true };
    cachedAvailability = result;
    availabilityCacheTime = now;
    return result;
  }
  
  try {
    const credentials = await getCredentials();
    
    // Check if credentials look like placeholders
    const hasRealAccountSid = !isPlaceholderValue(credentials.accountSid) && 
                               credentials.accountSid.startsWith('AC') && 
                               credentials.accountSid.length >= 34;
    
    const hasRealAuthToken = credentials.authToken ? 
                              (!isPlaceholderValue(credentials.authToken) && credentials.authToken.length >= 32) : 
                              false;
    
    const hasRealApiKey = credentials.apiKey ? 
                          (!isPlaceholderValue(credentials.apiKey) && credentials.apiKey.startsWith('SK')) : 
                          false;
    
    const hasRealApiSecret = credentials.apiKeySecret ? 
                              (!isPlaceholderValue(credentials.apiKeySecret) && credentials.apiKeySecret.length >= 32) : 
                              false;
    
    const hasValidAuth = hasRealAccountSid && (hasRealAuthToken || (hasRealApiKey && hasRealApiSecret));
    const hasValidPhone = isValidPhoneNumber(credentials.phoneNumber);
    
    // configured = credentials exist (even if placeholder)
    // connected = credentials appear valid (not placeholders) AND phone number is valid
    const result = {
      configured: !!(credentials.accountSid && (credentials.authToken || (credentials.apiKey && credentials.apiKeySecret))),
      connected: hasValidAuth && hasValidPhone,
      hasPhoneNumber: hasValidPhone,
      verified: hasValidAuth && hasValidPhone
    };
    
    cachedAvailability = result;
    availabilityCacheTime = now;
    return result;
  } catch (error) {
    const result = {
      configured: false,
      connected: false,
      hasPhoneNumber: false,
      verified: false
    };
    cachedAvailability = result;
    availabilityCacheTime = now;
    return result;
  }
}

export async function getTwilioClient() {
  if (!twilioClient) {
    await initializeTwilio();
  }
  return twilioClient;
}

export function getTwilioPhoneNumber(): string | null {
  return twilioPhoneNumber;
}

interface SendSMSOptions {
  to: string;
  message: string;
  mediaUrls?: string[]; // MMS media URLs (max 10, each up to 5MB)
  alphanumericSenderId?: string; // Registered alphanumeric sender ID (e.g., "JobRunner")
  fromNumber?: string; // Override from number (e.g., dedicated AI Receptionist number)
}

interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
  notConfigured?: boolean;
}

/**
 * Resolve the Twilio `from` value for a given set of SMS options and the
 * currently-configured Twilio phone number.
 *
 * Twilio rejects alphanumeric sender IDs when the message includes media
 * (MMS). In that case the function falls back to fromNumber → twilioPhone.
 * This is the single canonical implementation of that guard; both the live
 * send path and the test interceptor use this function so they can never
 * diverge.
 */
export function resolveFromValue(
  opts: Pick<SendSMSOptions, 'mediaUrls' | 'alphanumericSenderId' | 'fromNumber'>,
  twilioPhone: string | null,
): string {
  const isMMS = (opts.mediaUrls?.length ?? 0) > 0;
  // Alphanumeric sender IDs are one-way only — Twilio rejects them for MMS.
  return (!isMMS && opts.alphanumericSenderId)
    ? opts.alphanumericSenderId
    : (opts.fromNumber || twilioPhone || '');
}

// Test-only transport interceptor: lets server tests capture the exact
// options (esp. resolvedFrom) that would be handed to Twilio without sending
// a real SMS. Never active in production.
//
// resolvedFrom is produced by resolveFromValue() — the same function used in
// the live send path — so the test is guarding the real guard code.
interface SmsInterceptorPayload extends SendSMSOptions {
  /** Resolved Twilio `from` value, produced by resolveFromValue() */
  resolvedFrom: string;
}
let smsTestInterceptor: ((payload: SmsInterceptorPayload) => SMSResult | Promise<SMSResult>) | null = null;
export function __setSmsTestInterceptor(fn: ((payload: SmsInterceptorPayload) => SMSResult | Promise<SMSResult>) | null) {
  if (process.env.NODE_ENV === 'production') return;
  smsTestInterceptor = fn;
}

export async function sendSMS(options: SendSMSOptions): Promise<SMSResult> {
  // Sanitise to GSM-7 here — before the test interceptor — so that the interceptor
  // always sees the same body that would be sent to Twilio.  This makes it impossible
  // to bypass the sanitiser by calling sendSMS from any code path.
  const sanitisedOptions: SendSMSOptions = {
    ...options,
    message: toGSM(options.message),
  };

  // Resolve the sender before the test interceptor so the interceptor can
  // assert the exact `from` value Twilio would receive. resolveFromValue() is
  // the canonical implementation shared with the live send path below.
  const resolvedFrom = resolveFromValue(sanitisedOptions, twilioPhoneNumber);

  if (smsTestInterceptor) {
    return await smsTestInterceptor({ ...sanitisedOptions, resolvedFrom });
  }
  const { to, message, mediaUrls } = sanitisedOptions;

  // Format Australian phone number
  let formattedTo = to.replace(/\s+/g, '').replace(/^0/, '+61');
  if (!formattedTo.startsWith('+')) {
    formattedTo = '+61' + formattedTo.replace(/^61/, '');
  }

  // Validate media URLs (max 10 per Twilio MMS)
  const validMediaUrls = mediaUrls?.slice(0, 10) || [];
  const isMMS = validMediaUrls.length > 0;

  // Ensure Twilio is initialized before checking status
  await getTwilioClient();
  
  if (!isTwilioInitialized() || !twilioClient || !twilioPhoneNumber) {
    // SMS not configured - return error instead of pretending success
    console.log(`⚠️ [SMS NOT SENT - Twilio not configured]`);
    console.log(`   To: ${formattedTo}`);
    console.log(`   Message: ${message.substring(0, 50)}...`);
    return {
      success: false,
      notConfigured: true,
      error: 'SMS not configured. Please set up Twilio in Settings > Integrations to send text messages.'
    };
  }

  try {
    // Use the same canonical resolver so live path and test path are identical.
    const fromValue = resolveFromValue(sanitisedOptions, twilioPhoneNumber);

    const messageOptions: any = {
      body: message,  // already sanitised to GSM-7 above
      from: fromValue,
      to: formattedTo
    };

    // Add MediaUrl for MMS (Twilio accepts array of URLs)
    if (isMMS) {
      messageOptions.mediaUrl = validMediaUrls;
    }

    // Ask Twilio to POST delivery status updates back so we can detect
    // undelivered/failed messages and alert the sender.
    try {
      const baseUrl = getProductionBaseUrl();
      if (baseUrl && baseUrl.startsWith('https://')) {
        messageOptions.statusCallback = `${baseUrl}/api/sms/webhook/status`;
      }
    } catch {}

    const result = await twilioClient.messages.create(messageOptions);

    console.log(`✅ ${isMMS ? 'MMS' : 'SMS'} sent to ${formattedTo}: ${result.sid}`);
    return {
      success: true,
      messageId: result.sid
    };
  } catch (error: unknown) {
    console.error(`❌ Failed to send ${isMMS ? 'MMS' : 'SMS'}:`, getErrorMessage(error));
    try {
      const { logSystemEvent } = await import('./systemEventService');
      logSystemEvent('twilio', 'error', 'sms_send_failed', `Failed to send ${isMMS ? 'MMS' : 'SMS'}: ${getErrorMessage(error)}`, { to: options.to, error: getErrorMessage(error) });
    } catch {}
    return {
      success: false,
      error: getErrorMessage(error)
    };
  }
}

/**
 * Auto-configure the Twilio phone number's incoming SMS webhook URL
 * so inbound messages route to our app instead of showing the default Twilio auto-reply.
 */
export async function configureTwilioWebhook(baseUrl: string): Promise<boolean> {
  if (!twilioClient || !twilioPhoneNumber) {
    console.log('⚠️ Cannot configure Twilio webhook - client or phone number not available');
    return false;
  }

  const webhookUrl = `${baseUrl}/api/sms/webhook/incoming`;

  try {
    const incomingNumbers = await twilioClient.incomingPhoneNumbers.list({
      phoneNumber: twilioPhoneNumber,
      limit: 1,
    });

    if (incomingNumbers.length === 0) {
      console.log(`⚠️ Twilio phone number ${twilioPhoneNumber} not found in account - webhook not configured`);
      console.log('   This may be normal if using an alphanumeric sender ID or messaging service');
      return false;
    }

    const phoneNumberSid = incomingNumbers[0].sid;
    const currentSmsUrl = incomingNumbers[0].smsUrl;
    const currentVoiceUrl = incomingNumbers[0].voiceUrl;
    const voiceUrl = `${baseUrl}/api/twilio/voice/shared`;

    if (currentSmsUrl === webhookUrl && currentVoiceUrl === voiceUrl) {
      console.log(`✅ Twilio SMS webhook already configured: ${webhookUrl}`);
      console.log(`✅ Twilio Voice webhook already configured: ${voiceUrl}`);
      return true;
    }

    await twilioClient.incomingPhoneNumbers(phoneNumberSid).update({
      smsUrl: webhookUrl,
      smsMethod: 'POST',
      voiceUrl: voiceUrl,
      voiceMethod: 'POST',
    });

    console.log(`✅ Twilio SMS webhook configured: ${webhookUrl}`);
    console.log(`✅ Twilio Voice webhook configured: ${voiceUrl}`);
    if (currentSmsUrl) {
      console.log(`   (SMS was: ${currentSmsUrl})`);
    }
    return true;
  } catch (error: unknown) {
    console.error('❌ Failed to configure Twilio webhook:', getErrorMessage(error));
    console.log(`   Please manually set SMS webhook URL to: ${webhookUrl}`);
    return false;
  }
}

/**
 * Search for available Australian phone numbers to purchase
 */
export async function searchAvailableNumbers(options: {
  areaCode?: string;
  contains?: string;
  locality?: string;
  limit?: number;
  smsEnabled?: boolean;
}): Promise<{ success: boolean; numbers?: any[]; error?: string }> {
  const client = await getTwilioClient();
  if (!client) {
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const searchParams: any = {
      smsEnabled: options.smsEnabled !== false,
      voiceEnabled: true,
    };
    if (options.contains) searchParams.contains = options.contains;
    if (options.locality) searchParams.inLocality = options.locality;
    
    let numbers;
    if (options.areaCode) {
      searchParams.areaCode = options.areaCode;
      numbers = await client.availablePhoneNumbers('AU')
        .local.list({ ...searchParams, limit: options.limit || 10 });
    } else {
      numbers = await client.availablePhoneNumbers('AU')
        .mobile.list({ ...searchParams, limit: options.limit || 10 });
      
      if (numbers.length === 0) {
        numbers = await client.availablePhoneNumbers('AU')
          .local.list({ ...searchParams, limit: options.limit || 10 });
      }
    }

    return {
      success: true,
      numbers: numbers.map((n: any) => ({
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName,
        locality: n.locality,
        region: n.region,
        isoCountry: n.isoCountry,
        capabilities: {
          voice: n.capabilities?.voice,
          sms: n.capabilities?.sms,
          mms: n.capabilities?.mms,
        },
        monthlyPrice: '3.00',
      })),
    };
  } catch (error: unknown) {
    console.error('Error searching available numbers:', getErrorMessage(error));
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Purchase a Twilio phone number and configure its webhook
 */
export function parseAustralianAddress(address: string): { street: string; city: string; region: string; postalCode: string; valid: boolean } {
  if (!address || address.trim().length < 5) {
    return { street: '', city: '', region: '', postalCode: '', valid: false };
  }

  const postcodeMatch = address.match(/\b(\d{4})\b(?:\s*$|\s*,)/);
  const postalCode = postcodeMatch ? postcodeMatch[1] : '';

  const stateAbbreviations = ['QLD', 'NSW', 'VIC', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
  let region = '';
  for (const state of stateAbbreviations) {
    const stateRegex = new RegExp(`\\b${state}\\b`, 'i');
    if (stateRegex.test(address)) {
      region = state;
      break;
    }
  }

  let cleaned = address;
  if (postalCode) cleaned = cleaned.replace(new RegExp(`\\s*,?\\s*${postalCode}\\s*`), ' ');
  if (region) cleaned = cleaned.replace(new RegExp(`\\s*,?\\s*\\b${region}\\b\\s*`, 'i'), ', ');
  
  const commaParts = cleaned.split(',').map(p => p.trim()).filter(Boolean);
  const street = commaParts[0] || '';
  const city = commaParts.length > 1 ? commaParts[commaParts.length - 1] : '';

  const valid = !!(street && city && region && postalCode);
  return { street, city, region, postalCode, valid };
}

export async function createOrFindTwilioAddress(businessOwnerId: string, businessInfo: {
  businessName: string;
  address: string;
  city?: string;
  region?: string;
  postalCode?: string;
  customerName?: string;
}): Promise<{ success: boolean; addressSid?: string; error?: string }> {
  const client = await getTwilioClient();
  if (!client) {
    return { success: false, error: 'Twilio not configured' };
  }

  const tenantKey = `JobRunner-${businessOwnerId}`;

  try {
    const existing = await client.addresses.list({ friendlyName: tenantKey, limit: 1 });
    if (existing.length > 0) {
      console.log(`[Twilio] Found existing address for tenant: ${existing[0].sid}`);
      return { success: true, addressSid: existing[0].sid };
    }

    const parts = parseAustralianAddress(businessInfo.address);
    if (!parts.valid) {
      return { success: false, error: 'Business address is incomplete. Please update your business address in Settings (include street, suburb, state, and postcode).' };
    }

    const addressPayload = {
      friendlyName: tenantKey,
      customerName: businessInfo.customerName || businessInfo.businessName,
      street: parts.street,
      city: businessInfo.city || parts.city,
      region: businessInfo.region || parts.region,
      postalCode: businessInfo.postalCode || parts.postalCode,
      isoCountry: 'AU',
      autoCorrectAddress: true,
    };

    try {
      const created = await client.addresses.create(addressPayload);
      console.log(`[Twilio] Created address: ${created.sid} for tenant ${tenantKey}`);
      return { success: true, addressSid: created.sid };
    } catch (createError: unknown) {
      console.warn('[Twilio] Address creation failed:', getErrorMessage(createError));

      const validated = await client.addresses.list({ isoCountry: 'AU', limit: 5 });
      const reusable = validated.find(a => a.validated);
      if (reusable) {
        console.log(`[Twilio] Reusing existing validated AU address: ${reusable.sid} (${reusable.street}, ${reusable.city})`);
        return { success: true, addressSid: reusable.sid };
      }

      throw createError;
    }
  } catch (error: unknown) {
    console.error('[Twilio] Error creating address:', getErrorMessage(error));
    const msg = getErrorMessage(error) || '';
    if (msg.includes('cannot be validated') || msg.includes('invalid') || msg.includes('not valid')) {
      return { success: false, error: 'Your business address could not be verified by Twilio. Please ensure it is a real, complete Australian address with unit/street number, street name, suburb, state, and postcode (e.g. "42 Smith Street, Cairns, QLD 4870").' };
    }
    return { success: false, error: msg };
  }
}

export async function purchasePhoneNumber(phoneNumber: string, webhookUrl: string, addressSid?: string, businessName?: string): Promise<{ success: boolean; sid?: string; phoneNumber?: string; error?: string }> {
  const client = await getTwilioClient();
  if (!client) {
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const friendlyLabel = businessName 
      ? `${businessName} — JobRunner` 
      : `JobRunner Business Number`;
    const createParams: Record<string, string> = {
      phoneNumber: phoneNumber,
      smsUrl: webhookUrl,
      smsMethod: 'POST',
      friendlyName: friendlyLabel,
    };
    
    if (addressSid) {
      createParams.addressSid = addressSid;
    }

    const bundles = await client.numbers.v2.regulatoryCompliance.bundles.list({
      isoCountry: 'AU',
      numberType: 'mobile',
      status: 'twilio-approved',
      limit: 1,
    });
    if (bundles.length > 0) {
      createParams.bundleSid = bundles[0].sid;
      console.log(`[SMS] Using regulatory bundle: ${bundles[0].sid} (${bundles[0].friendlyName})`);
    }

    const purchased = await client.incomingPhoneNumbers.create(createParams);

    console.log(`[SMS] Purchased Twilio number: ${purchased.phoneNumber} (${purchased.sid})`);
    return {
      success: true,
      sid: purchased.sid,
      phoneNumber: purchased.phoneNumber,
    };
  } catch (error: unknown) {
    console.error('[SMS] Error purchasing phone number:', getErrorMessage(error));
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateNumberFriendlyName(phoneNumber: string, friendlyName: string): Promise<{ success: boolean; error?: string }> {
  const client = await getTwilioClient();
  if (!client) return { success: false, error: 'Twilio not configured' };

  try {
    const numbers = await client.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
    if (numbers.length === 0) return { success: false, error: 'Number not found in Twilio' };
    
    await client.incomingPhoneNumbers(numbers[0].sid).update({ friendlyName });
    console.log(`[SMS] Updated friendly name for ${phoneNumber} to "${friendlyName}"`);
    return { success: true };
  } catch (error: unknown) {
    console.error('[SMS] Error updating friendly name:', getErrorMessage(error));
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateNumberWebhooks(phoneNumber: string, smsWebhookUrl: string, voiceWebhookUrl?: string, friendlyName?: string): Promise<{ success: boolean; error?: string }> {
  const client = await getTwilioClient();
  if (!client) return { success: false, error: 'Twilio not configured' };

  try {
    const numbers = await client.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
    if (numbers.length === 0) return { success: false, error: 'Number not found in Twilio' };
    
    const updateParams: Record<string, string> = {
      smsUrl: smsWebhookUrl,
      smsMethod: 'POST',
    };
    if (voiceWebhookUrl) {
      updateParams.voiceUrl = voiceWebhookUrl;
      updateParams.voiceMethod = 'POST';
    }
    if (friendlyName) {
      updateParams.friendlyName = friendlyName;
    }

    await client.incomingPhoneNumbers(numbers[0].sid).update(updateParams);
    console.log(`[SMS] Updated webhooks for ${phoneNumber}: SMS → ${smsWebhookUrl}${voiceWebhookUrl ? `, Voice → ${voiceWebhookUrl}` : ''}${friendlyName ? `, Name → ${friendlyName}` : ''}`);
    return { success: true };
  } catch (error: unknown) {
    console.error('[SMS] Error updating number webhooks:', getErrorMessage(error));
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function listAllTwilioNumbers(): Promise<{ success: boolean; numbers?: any[]; error?: string }> {
  const client = await getTwilioClient();
  if (!client) return { success: false, error: 'Twilio not configured' };

  try {
    const numbers = await client.incomingPhoneNumbers.list({ limit: 50 });
    return {
      success: true,
      numbers: numbers.map(n => ({
        sid: n.sid,
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName,
        smsUrl: n.smsUrl,
        voiceUrl: n.voiceUrl,
        capabilities: n.capabilities,
      })),
    };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Release (delete) a Twilio phone number
 */
export async function releasePhoneNumber(phoneNumber: string): Promise<{ success: boolean; error?: string }> {
  const client = await getTwilioClient();
  if (!client) {
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const numbers = await client.incomingPhoneNumbers.list({
      phoneNumber: phoneNumber,
      limit: 1,
    });

    if (numbers.length === 0) {
      return { success: false, error: 'Phone number not found in Twilio account' };
    }

    await client.incomingPhoneNumbers(numbers[0].sid).remove();
    console.log(`✅ Released Twilio number: ${phoneNumber}`);
    return { success: true };
  } catch (error: unknown) {
    console.error('Error releasing phone number:', getErrorMessage(error));
    return { success: false, error: getErrorMessage(error) };
  }
}

// SMS Templates for JobRunner notifications
export const smsTemplates = {
  quoteReady: (clientName: string, businessName: string, quoteNumber: string, _businessPhone?: string) =>
    `Hi ${clientName}, ${businessName} has sent you a quote. View and approve it here:`,

  quoteWithTotal: (clientName: string, businessName: string, quoteNumber: string, total: string, _businessPhone?: string) =>
    `Hi ${clientName}, ${businessName} has sent you a quote for $${total}. View and approve it here:`,

  invoiceSent: (clientName: string, businessName: string, invoiceNumber: string, amount: string, _businessPhone?: string) =>
    `Hi ${clientName}, ${businessName} has sent you an invoice for ${amount}. Pay securely here:`,

  paymentReceived: (clientName: string, amount: string, businessName: string, receiptUrl?: string, _businessPhone?: string) =>
    receiptUrl
      ? `Hi ${clientName}, ${businessName} has received your payment of ${amount}. Your receipt: ${receiptUrl}`
      : `Hi ${clientName}, ${businessName} has received your payment of ${amount}. Thank you!`,

  jobScheduled: (clientName: string, businessName: string, date: string, _businessPhone?: string) =>
    `Hi ${clientName}, ${businessName} has confirmed your job for ${date}. Someone will be in touch shortly with details. Reply to this message to chat with the team.`,

  jobComplete: (clientName: string, businessName: string, _businessPhone?: string) =>
    `Hi ${clientName}, your job with ${businessName} is complete. Thanks for choosing us! Reply to this message if you need anything.`,

  reminder: (clientName: string, businessName: string, message: string, _businessPhone?: string) =>
    `Hi ${clientName}, reminder from ${businessName}: ${message}`,

  jobConfirmed: (clientName: string, businessName: string) =>
    `Hi ${clientName}, ${businessName} has confirmed your job. Someone will be in touch shortly with details. Reply to this message to chat with the team.`,

  aiReceptionistCaptured: (clientName: string, businessName: string, portalUrl?: string) =>
    portalUrl
      ? `Hi ${clientName}, thanks for calling ${businessName}. We have your details and will call you back shortly. Track your job at: ${portalUrl}`
      : `Hi ${clientName}, thanks for calling ${businessName}. We have your details and will call you back shortly.`,
};

export function validateTwilioWebhook(req: any, res: any, next: any) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Twilio Webhook] No TWILIO_AUTH_TOKEN in production - rejecting request');
      return res.status(503).send('Service unavailable');
    }
    console.warn('[Twilio Webhook] No TWILIO_AUTH_TOKEN set, skipping signature verification (dev mode)');
    return next();
  }

  const twilioSignature = req.headers['x-twilio-signature'];
  if (!twilioSignature) {
    console.warn('[Twilio Webhook] Missing X-Twilio-Signature header');
    return res.status(403).send('Forbidden');
  }

  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['host'] || req.hostname;
  const url = `${protocol}://${host}${req.originalUrl}`;

  const { validateRequest } = twilio;
  const isValid = validateRequest(authToken, twilioSignature, url, req.body || {});

  if (!isValid) {
    console.warn('[Twilio Webhook] Invalid signature - request rejected');
    return res.status(403).send('Forbidden');
  }

  next();
}
