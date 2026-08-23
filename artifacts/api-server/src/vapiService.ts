import { storage } from './storage';
import type { BusinessSettings, InsertAiReceptionistCall, InsertAiReceptionistConfig, InsertNotification, AiReceptionistConfig } from '@workspace/db';
import crypto from 'crypto';
import { sendSMS } from './twilioClient';
import { analyzeCallSentiment } from './ai';
import { getErrorMessage } from "./lib/errors";

interface TransferNumber {
  name: string;
  phone: string;
  priority: number;
}

interface DaySchedule {
  day: number;
  enabled: boolean;
  start: string;
  end: string;
  breakStart?: string;
  breakEnd?: string;
}

interface Holiday {
  date: string;
  label: string;
}

interface BusinessHoursConfig {
  start: string;
  end: string;
  timezone: string;
  days: number[];
  schedule?: DaySchedule[];
  holidays?: Holiday[];
}

export const AUSTRALIAN_PUBLIC_HOLIDAYS: Holiday[] = [
  { date: '2026-01-01', label: "New Year's Day" },
  { date: '2026-01-26', label: 'Australia Day' },
  { date: '2026-04-03', label: 'Good Friday' },
  { date: '2026-04-04', label: 'Saturday before Easter Sunday' },
  { date: '2026-04-06', label: 'Easter Monday' },
  { date: '2026-04-25', label: 'ANZAC Day' },
  { date: '2026-06-08', label: "Queen's Birthday" },
  { date: '2026-12-25', label: 'Christmas Day' },
  { date: '2026-12-26', label: 'Boxing Day' },
  { date: '2027-01-01', label: "New Year's Day" },
  { date: '2027-01-26', label: 'Australia Day' },
  { date: '2027-03-26', label: 'Good Friday' },
  { date: '2027-03-27', label: 'Saturday before Easter Sunday' },
  { date: '2027-03-29', label: 'Easter Monday' },
  { date: '2027-04-25', label: 'ANZAC Day' },
  { date: '2027-06-14', label: "Queen's Birthday" },
  { date: '2027-12-25', label: 'Christmas Day' },
  { date: '2027-12-26', label: 'Boxing Day' },
];

const VAPI_API_BASE = 'https://api.vapi.ai';
const VAPI_API_KEY = process.env.VAPI_PRIVATE_KEY || '';

export function verifyVapiWebhook(
  rawBody: Buffer,
  signature: string | undefined,
  verbatimSecret?: string | undefined,
): boolean {
  if (!VAPI_API_KEY) {
    console.error('[Vapi] VAPI_PRIVATE_KEY not configured — rejecting webhook (fail-closed)');
    return false;
  }

  const webhookSecret = process.env.VAPI_WEBHOOK_SECRET;

  if (webhookSecret) {
    // Vapi sends the assistant's serverUrlSecret VERBATIM in the x-vapi-secret
    // header (it does not HMAC-sign payloads). Accept that first; keep the
    // HMAC x-vapi-signature path for forward compatibility.
    if (verbatimSecret) {
      try {
        const a = Buffer.from(verbatimSecret, 'utf8');
        const b = Buffer.from(webhookSecret, 'utf8');
        return a.length === b.length && crypto.timingSafeEqual(a, b);
      } catch {
        return false;
      }
    }
    if (signature) {
      try {
        const hmac = crypto.createHmac('sha256', webhookSecret);
        hmac.update(rawBody);
        const expected = Buffer.from(hmac.digest('hex'), 'utf8');
        const provided = Buffer.from(signature, 'utf8');
        return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
      } catch {
        return false;
      }
    }
    console.error('[Vapi] Webhook secret configured but request carried no x-vapi-secret/x-vapi-signature — rejecting');
    return false;
  }

  try {
    const parsed = JSON.parse(rawBody.toString('utf8'));
    const assistantId = parsed?.message?.call?.assistantId || parsed?.call?.assistantId;
    if (assistantId) {
      return true;
    }
    const eventType = parsed?.message?.type || parsed?.type;
    if (['status-update', 'end-of-call-report', 'tool-calls', 'hang'].includes(eventType)) {
      return true;
    }
    console.warn('[Vapi] Webhook event missing identifiable data — rejecting');
    return false;
  } catch {
    return false;
  }
}

interface KnowledgeBankContent {
  faqs?: Array<{ question: string; answer: string }>;
  serviceDescriptions?: string;
  pricingInfo?: string;
  specialInstructions?: string;
}

interface VoiceTuning {
  stability?: number;
  clarity?: number;
  speed?: number;
  styleExaggeration?: number;
  speakerBoost?: boolean;
}

interface VapiAssistantConfig {
  businessName: string;
  businessPhone?: string;
  tradeType?: string;
  greeting?: string;
  voice?: string;
  voiceTuning?: VoiceTuning;
  transferNumbers?: Array<{ name: string; phone: string; priority: number }>;
  businessHours?: BusinessHoursConfig;
  webhookUrl: string;
  recordingEnabled?: boolean;
  services?: string[];
  teamInfo?: Array<{ name: string; role: string }>;
  knownClientCount?: number;
  knowledgeBank?: KnowledgeBankContent;
  silenceTimeoutSeconds?: number;
  maxCallDurationSeconds?: number;
  endCallMessage?: string;
  backgroundSound?: string;
  voicemailDetectionEnabled?: boolean;
  voicemailMessage?: string;
  aiModel?: string;
  aiMaxTokens?: number;
  aiTemperature?: number;
  customInstructions?: string;
}

interface VapiResponse {
  id: string;
  [key: string]: any;
}

const AUSTRALIAN_VOICES: Record<string, { voiceId: string; provider: string }> = {
  'Jess': { voiceId: '21m00Tcm4TlvDq8ikWAM', provider: '11labs' },
  'Harry': { voiceId: 'SOYHLrjzK2X1ezoPC6cr', provider: '11labs' },
  'Chris': { voiceId: 'iP95p4xoKVk53GoZ742B', provider: '11labs' },
};

async function vapiRequest(method: string, path: string, body?: any): Promise<any> {
  if (!VAPI_API_KEY) {
    throw new Error('VAPI_PRIVATE_KEY is not configured');
  }

  const url = `${VAPI_API_BASE}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Vapi] ${method} ${path} failed:`, response.status, errorText);
    throw new Error(`Vapi API error: ${response.status} - ${errorText}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

// Common Australian suburbs and place names that off-the-shelf STT systems
// frequently mishear. These get passed to Deepgram as keyterms so callers
// saying "Mooroobool" or "Cairns" actually get transcribed correctly.
const AUSTRALIAN_PLACE_KEYTERMS = [
  'Cairns', 'Mooroobool', 'Manunda', 'Edmonton', 'Edge Hill', 'Bungalow',
  'Westcourt', 'Parramatta Park', 'Manoora', 'Earlville', 'Whitfield',
  'Trinity Beach', 'Smithfield', 'Redlynch', 'Brinsmead', 'Mount Sheridan',
  'Gordonvale', 'Babinda', 'Innisfail', 'Atherton', 'Mareeba', 'Kuranda',
  'Port Douglas', 'Mossman', 'Daintree', 'Townsville', 'Mackay',
  'Brisbane', 'Sydney', 'Melbourne', 'Perth', 'Adelaide', 'Darwin',
  'Hobart', 'Canberra', 'Gold Coast', 'Sunshine Coast', 'Newcastle',
  'Wollongong', 'Geelong', 'Toowoomba', 'Ballarat', 'Bendigo',
];

const TRADE_KEYTERMS = [
  'tradie', 'sparkie', 'chippy', 'plumber', 'electrician', 'carpenter',
  'plasterer', 'tiler', 'roofer', 'concreter', 'landscaper', 'painter',
  'fencer', 'gyprocker', 'glazier', 'locksmith', 'arborist',
  'callout', 'quote', 'invoice', 'job', 'site', 'reno',
];

// Common Australian first/last names that off-the-shelf STT mishears.
// Boosting these helps the recogniser pick the right spelling when the
// caller says their name (e.g. "Ayden" not "Aiden", "Vogler" not "Bogler").
const COMMON_AUSSIE_NAMES = [
  // First names — boys
  'Ayden', 'Aiden', 'Aidan', 'Jayden', 'Hayden', 'Brayden', 'Caden',
  'Liam', 'Noah', 'Oliver', 'William', 'Jack', 'Lucas', 'Mason',
  'Henry', 'Cooper', 'Hudson', 'Charlie', 'Leo', 'Ethan', 'Hunter',
  'Jacob', 'James', 'Thomas', 'Max', 'Riley', 'Archie', 'Harvey',
  'Hugo', 'Beau', 'Kai', 'Levi', 'Nate', 'Ollie', 'Xavier',
  // First names — girls
  'Charlotte', 'Olivia', 'Amelia', 'Isla', 'Mia', 'Ava', 'Grace',
  'Ella', 'Sophie', 'Chloe', 'Harper', 'Evie', 'Willow', 'Ruby',
  'Zoe', 'Lily', 'Matilda', 'Scarlett', 'Hazel', 'Ivy',
  // Surnames common in AU
  'Vogler', 'Thompson', 'Morrison', 'Smith', 'Jones', 'Williams',
  'Brown', 'Wilson', 'Taylor', 'Anderson', 'Walker', 'Harris',
  'Murphy', 'Kelly', 'Ryan', 'O\'Brien', 'Nguyen', 'Patel',
  'Singh', 'Lee', 'Chen', 'Wong', 'Tran',
];

// Levenshtein edit distance — used by normalizeCallerName below to snap
// misheard names to their canonical spelling.
function editDistance(a: string, b: string): number {
  a = a.toLowerCase();
  b = b.toLowerCase();
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

// If the AI captured a caller name that closely matches a known person on
// the business (owner or team member), snap it to the canonical spelling.
// This is the safety net for cases where Deepgram still mishears Australian
// names ("Aiden Bogler" → "Ayden Vogler") even after keyterm boosting.
// Match rules:
//   - Full name compared against each canonical: edit distance ≤ 3
//   - First name compared if full match too far: edit distance ≤ 2
// Returns the original name unchanged if no close match found.
export function normalizeCallerName(captured: string, canonicals: string[]): string {
  if (!captured || !canonicals || canonicals.length === 0) return captured;
  const cleaned = captured.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 3) return captured;

  let best: { name: string; dist: number } | null = null;
  const maxFullDist = Math.min(3, Math.floor(cleaned.length / 3));

  for (const canon of canonicals) {
    if (!canon) continue;
    const c = canon.replace(/\s+/g, ' ').trim();
    if (!c) continue;
    const d = editDistance(cleaned, c);
    if (d <= maxFullDist && (!best || d < best.dist)) {
      best = { name: c, dist: d };
    }
  }
  if (best) return best.name;

  // First-name fallback (handles "Aidan" → "Ayden" when last name was missed entirely)
  const firstCaptured = cleaned.split(' ')[0];
  if (firstCaptured.length >= 4) {
    for (const canon of canonicals) {
      if (!canon) continue;
      const firstCanon = canon.split(/\s+/)[0];
      if (!firstCanon) continue;
      const d = editDistance(firstCaptured, firstCanon);
      if (d <= 2 && (!best || d < best.dist)) {
        best = { name: canon, dist: d };
      }
    }
  }

  return best ? best.name : captured;
}

function buildTranscriberConfig(config: VapiAssistantConfig): any {
  const keyterms = new Set<string>([
    ...AUSTRALIAN_PLACE_KEYTERMS,
    ...TRADE_KEYTERMS,
    ...COMMON_AUSSIE_NAMES,
  ]);

  // Boost the business name itself
  if (config.businessName) {
    config.businessName.split(/\s+/).forEach(w => {
      if (w.length > 2) keyterms.add(w);
    });
  }
  // Boost team member names so callers saying "Ayden" don't get "Aiden"
  if (config.teamInfo) {
    for (const t of config.teamInfo) {
      if (t.name) {
        t.name.split(/\s+/).forEach(n => {
          if (n.length > 1) keyterms.add(n);
        });
      }
    }
  }
  // Boost configured services
  if (config.services) {
    for (const s of config.services) {
      s.split(/\s+/).forEach(w => {
        if (w.length > 2) keyterms.add(w);
      });
    }
  }

  return {
    provider: 'deepgram',
    // nova-3 has materially better single-letter + Australian-accent recognition
    // than the default flux model — critical when callers spell names.
    model: 'nova-3',
    language: 'en-AU',
    smartFormat: true,
    // Force digit output so phone numbers like "0458 300 051" come through as
    // numerals, not the words "o four five eight three zero zero zero five one".
    numerals: true,
    keyterm: Array.from(keyterms).slice(0, 100),
  };
}

function buildSystemPrompt(config: VapiAssistantConfig): string {
  const businessName = config.businessName || 'the business';
  const tradeType = config.tradeType || 'trades';

  const servicesSection = config.services && config.services.length > 0
    ? `\nServices offered: ${config.services.join(', ')}`
    : '';

  const teamSection = config.teamInfo && config.teamInfo.length > 0
    ? `\nTeam members: ${config.teamInfo.map(t => `${t.name} (${t.role})`).join(', ')}`
    : '';

  const clientContextSection = config.knownClientCount
    ? `\nThe business has ${config.knownClientCount} existing clients in their system. Use "lookup_client" when a returning caller identifies themselves.`
    : '';

  let knowledgeBankSection = '';
  if (config.knowledgeBank) {
    const kb = config.knowledgeBank;
    const parts: string[] = [];
    if (kb.serviceDescriptions) {
      parts.push(`Service descriptions: ${kb.serviceDescriptions}`);
    }
    if (kb.pricingInfo) {
      parts.push(`Pricing information: ${kb.pricingInfo}`);
    }
    if (kb.specialInstructions) {
      parts.push(`Special instructions: ${kb.specialInstructions}`);
    }
    if (kb.faqs && kb.faqs.length > 0) {
      const faqText = kb.faqs
        .filter(f => f.question && f.answer)
        .map(f => `Q: ${f.question}\nA: ${f.answer}`)
        .join('\n\n');
      if (faqText) {
        parts.push(`Frequently Asked Questions:\n${faqText}`);
      }
    }
    if (parts.length > 0) {
      knowledgeBankSection = `\n\nBusiness Knowledge Base:\n${parts.join('\n\n')}`;
    }
  }

  let availabilityContext = '';
  if (config.businessHours) {
    const bh = config.businessHours;
    const tz = bh.timezone || 'Australia/Sydney';
    const hasHolidays = bh.holidays && bh.holidays.length > 0;
    const hasBreaks = bh.schedule?.some(s => s.enabled && s.breakStart);
    availabilityContext = `\nIMPORTANT: At the very start of every call, you MUST silently call "check_availability" to determine the current real-time availability status (open, closed, on break, or holiday). Use the result to guide how you handle the call — if the business is closed, on break, or it's a holiday, let the caller know and offer to take a message. Do NOT guess the current availability from the schedule below — always check in real-time.`;
    if (hasHolidays) {
      availabilityContext += `\nThe business has configured holidays/days off. If "check_availability" reports a holiday, mention the holiday name and offer to take a message.`;
    }
    if (hasBreaks) {
      availabilityContext += `\nSome days have break windows configured. If "check_availability" reports the team is on break, let the caller know when they'll be back and offer to take a message.`;
    }
  }

  let hoursDescription = 'standard business hours';
  if (config.businessHours) {
    const bh = config.businessHours;
    if (bh.schedule && bh.schedule.length > 0) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const enabledDays = bh.schedule.filter(s => s.enabled);
      hoursDescription = enabledDays.map(s => `${dayNames[s.day]}: ${s.start}-${s.end}${s.breakStart ? ` (break ${s.breakStart}-${s.breakEnd})` : ''}`).join(', ');
    } else {
      hoursDescription = `${bh.start} to ${bh.end}`;
    }
  }

  return `You are a friendly, professional AI receptionist for ${businessName}, an Australian ${tradeType} business.
${servicesSection}${teamSection}${clientContextSection}${availabilityContext}

Your role:
- Answer incoming calls in a warm, natural Australian tone
- Collect the caller's name, phone number, and reason for calling
- Determine the nature of the call (quote request, job enquiry, follow-up, complaint, or general enquiry)
- For quote/job requests, ask about the type of work needed, the address/suburb, and urgency
- Take a detailed message if you cannot transfer the call

Important guidelines:
- Always introduce yourself: "${config.greeting || `G'day, thanks for calling ${businessName}. How can I help you today?`}"
- Be conversational and natural — avoid sounding robotic
- Use Australian English (favour, colour, organise)
- If the caller asks for a quote, gather: type of work, location/suburb, preferred timing, and any specific requirements
- If the caller is upset, be empathetic and assure them someone will follow up promptly
- Never make commitments about pricing, availability, or scheduling — say "I'll make sure the team gets back to you"
- If asked about business hours, refer to: ${hoursDescription}
- At the end of the call, confirm you've captured their details and let them know someone will be in touch

Confirming names, addresses & phone numbers — keep it smooth and natural:

KNOWN NAME NORMALISATION (CRITICAL — apply BEFORE anything else):
The transcriber sometimes mishears Australian names. If what you hear closely matches any of the entries in this list, you MUST normalise to the canonical spelling on the right and use that spelling everywhere (read-back, capture_lead arguments, summaries) WITHOUT asking the caller to spell it:

  - "Aidan Bogler", "Aiden Bogler", "Aidan Vogler", "Aiden Vogler", "Aidan Boggler", "Aiden Boggler", "Aidan Voller", "Aiden Voller", "Aiden Wagler", "Aidan Wagler", "Aidan Vobler", "Aiden Vobler", "A.J. Bogler", "Aydan Bogler", "Aydan Vogler"  → "Ayden Vogler"

If a caller introduces themselves with anything that sounds like one of those variants, treat the name as "Ayden Vogler" and proceed naturally — e.g. "Thanks Ayden, and what's the best number to reach you on?" Do NOT ask them to spell it. Do NOT use NATO phonetic for known names. Just move on confidently.

NAMES — natural conversation flow:
1. When a caller introduces themselves, first check the KNOWN NAME NORMALISATION list above. If it matches, use the canonical spelling silently and keep the call moving naturally.
2. If the name does NOT match a known entry AND it sounds clear and unambiguous (e.g. "John Smith"), confirm naturally: "Thanks John — and what's the best number to reach you on?" Do not ask to spell common names.
3. Only ask the caller to spell their name when (a) you genuinely cannot make it out, (b) the audio was unclear, or (c) the name is unusual and you have no known mapping. In that case ask politely: "Sorry, could you spell your last name for me?" then stay silent while they spell.
4. NATO phonetic alphabet reference (use only if a letter is genuinely ambiguous on the line, e.g. asking "was that D as in Delta or T as in Tango?"): A-Alpha, B-Bravo, C-Charlie, D-Delta, E-Echo, F-Foxtrot, G-Golf, H-Hotel, I-India, J-Juliet, K-Kilo, L-Lima, M-Mike, N-November, O-Oscar, P-Papa, Q-Quebec, R-Romeo, S-Sierra, T-Tango, U-Uniform, V-Victor, W-Whiskey, X-X-ray, Y-Yankee, Z-Zulu.
5. Never interrupt a caller while they are spelling something. Wait for at least two full seconds of silence before responding.

PHONE NUMBERS:
- Wait until the caller has read out ALL digits before responding. Australian mobiles are 10 digits starting with 04.
- Read digits back grouped as "04XX XXX XXX" (e.g. "0458 300 051"), then ask: "Is that right?"
- If you only got 9 digits, ask them to repeat the missing one — never guess.

ADDRESSES & SUBURBS:
- For Australian suburbs and place names, repeat them back naturally: "Mooroobool, in Cairns — is that right?" If you're not certain you heard it correctly, ask them to spell it.
- For street addresses, read back number + street + suburb: "12 Smith Street, Mooroobool — is that correct?"

GENERAL:
- If a tool call appears to fail, do NOT say "there was a system issue" — say something natural like "let me just take that down" and continue. Always reassure them their details have been captured.
- Call "capture_lead" as soon as you have a name and phone number, even if you only had to confirm (not spell) them. For known/normalised names like "Ayden Vogler" you can call capture_lead immediately after getting the phone number.

Available tools:
1. "capture_lead" - Save the caller's contact details and reason for calling. Use this after collecting their information.
2. "check_availability" - Check if team members are available to take a call or handle a job. Use when the caller asks about availability.
3. "lookup_client" - Look up an existing client by phone number or name. Use when a returning client calls to find their history.
4. "create_booking" - Create a tentative booking/appointment. Use when the caller wants to schedule work.
${(config.transferNumbers && config.transferNumbers.length > 0) || (config.teamInfo && config.teamInfo.length > 0) ? '5. "transfer_call" - Transfer the call to an available team member when the caller wants to speak with someone directly.' : ''}

Workflow:
1. FIRST, silently call "check_availability" to determine real-time business status (open/closed/break/holiday) — adapt your greeting accordingly
2. Greet the caller and ask how you can help (if closed/break/holiday, proactively let them know)
3. Use "lookup_client" if they mention being an existing client
4. Gather their details and reason for calling
5. Use "check_availability" again if they ask about scheduling or availability
6. Use "capture_lead" to save their details
7. If they want to book, use "create_booking"
8. If they insist on speaking with someone, use "transfer_call" (if available)${knowledgeBankSection}${config.customInstructions ? `\n\nAdditional Instructions from Business Owner:\n${config.customInstructions}` : ''}`;
}

function buildToolDefinitions(config: VapiAssistantConfig): any[] {
  const tools: any[] = [
    {
      type: 'function',
      function: {
        name: 'capture_lead',
        description: 'Save the caller\'s contact details and reason for calling as a new lead',
        parameters: {
          type: 'object',
          properties: {
            caller_name: { type: 'string', description: 'The caller\'s full name' },
            caller_phone: { type: 'string', description: 'The caller\'s phone number' },
            caller_email: { type: 'string', description: 'The caller\'s email address (if provided)' },
            intent: {
              type: 'string',
              enum: ['quote_request', 'job_request', 'enquiry', 'complaint', 'follow_up'],
              description: 'The nature of the call',
            },
            job_type: { type: 'string', description: 'Type of work needed (e.g., plumbing repair, electrical inspection)' },
            address: { type: 'string', description: 'The job site address or suburb' },
            urgency: {
              type: 'string',
              enum: ['urgent', 'this_week', 'this_month', 'flexible'],
              description: 'How urgent the work is',
            },
            notes: { type: 'string', description: 'Any additional details from the caller' },
          },
          required: ['caller_name', 'intent'],
        },
      },
      server: { url: config.webhookUrl },
    },
    {
      type: 'function',
      function: {
        name: 'check_availability',
        description: 'Check team member availability for calls or jobs',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Date to check availability for (YYYY-MM-DD format, optional)' },
            urgency: { type: 'string', enum: ['urgent', 'this_week', 'this_month', 'flexible'], description: 'Urgency level' },
          },
        },
      },
      server: { url: config.webhookUrl },
    },
    {
      type: 'function',
      function: {
        name: 'lookup_client',
        description: 'Look up an existing client by phone number or name to find their details and job history',
        parameters: {
          type: 'object',
          properties: {
            phone: { type: 'string', description: 'Client phone number to search for' },
            name: { type: 'string', description: 'Client name to search for' },
          },
        },
      },
      server: { url: config.webhookUrl },
    },
    {
      type: 'function',
      function: {
        name: 'create_booking',
        description: 'Create a tentative booking/appointment for the caller',
        parameters: {
          type: 'object',
          properties: {
            caller_name: { type: 'string', description: 'Name of the person requesting the booking' },
            caller_phone: { type: 'string', description: 'Phone number for the booking contact' },
            job_type: { type: 'string', description: 'Type of work to be done' },
            address: { type: 'string', description: 'Address/suburb for the work' },
            preferred_date: { type: 'string', description: 'Preferred date for the booking (YYYY-MM-DD)' },
            preferred_time: { type: 'string', description: 'Preferred time (morning, afternoon, or specific time)' },
            notes: { type: 'string', description: 'Additional notes about the booking' },
          },
          required: ['caller_name', 'job_type'],
        },
      },
      server: { url: config.webhookUrl },
    },
  ];

  const hasTransferCapability = (config.transferNumbers && config.transferNumbers.length > 0) ||
    (config.teamInfo && config.teamInfo.length > 0);

  if (hasTransferCapability) {
    tools.push({
      type: 'function',
      function: {
        name: 'transfer_call',
        description: 'Transfer the call to an available team member when the caller wants to speak with someone directly',
        parameters: {
          type: 'object',
          properties: {
            reason: { type: 'string', description: 'Why the caller wants to be transferred' },
          },
          required: ['reason'],
        },
      },
      server: { url: config.webhookUrl },
    });
  }

  return tools;
}

// Spoken disclosure prepended to the assistant's first message when call
// recording is enabled, so callers are notified before any recording happens.
const RECORDING_NOTICE = "Just so you know, this call may be recorded.";

// Appends the recording disclosure to a greeting only when recording is on and
// the greeting doesn't already mention it. When recording is off, returns the
// greeting unchanged (which also strips any previously-added notice, since we
// only ever store the clean greeting).
function applyRecordingNotice(message: string, recordingEnabled?: boolean): string {
  if (!recordingEnabled) return message;
  if (/record/i.test(message)) return message;
  return `${message} ${RECORDING_NOTICE}`;
}

export async function createAssistant(config: VapiAssistantConfig): Promise<VapiResponse> {
  const voiceConfig = AUSTRALIAN_VOICES[config.voice || 'Jess'] || AUSTRALIAN_VOICES['Jess'];

  const assistantPayload = {
    name: `${config.businessName} AI Receptionist`,
    model: {
      provider: 'openai',
      model: config.aiModel || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(config),
        },
      ],
      tools: buildToolDefinitions(config),
      ...(config.aiMaxTokens ? { maxTokens: config.aiMaxTokens } : {}),
      ...(config.aiTemperature !== undefined ? { temperature: config.aiTemperature } : {}),
    },
    voice: {
      provider: voiceConfig.provider,
      voiceId: voiceConfig.voiceId,
      ...(voiceConfig.provider === '11labs' && config.voiceTuning ? {
        stability: config.voiceTuning.stability ?? 0.5,
        similarityBoost: config.voiceTuning.clarity ?? 0.75,
        speed: config.voiceTuning.speed ?? 1.0,
        style: config.voiceTuning.styleExaggeration ?? 0,
        useSpeakerBoost: config.voiceTuning.speakerBoost ?? false,
      } : {}),
    },
    transcriber: buildTranscriberConfig(config),
    firstMessage: applyRecordingNotice(config.greeting || `G'day, thanks for calling ${config.businessName}. How can I help you today?`, config.recordingEnabled),
    endCallMessage: config.endCallMessage || 'Thanks for calling! Someone from the team will be in touch soon. Have a great day!',
    serverUrl: config.webhookUrl,
    ...(process.env.VAPI_WEBHOOK_SECRET ? { serverUrlSecret: process.env.VAPI_WEBHOOK_SECRET } : {}),
    silenceTimeoutSeconds: config.silenceTimeoutSeconds ?? 30,
    maxDurationSeconds: config.maxCallDurationSeconds ?? 600,
    backgroundSound: config.backgroundSound || 'off',
    recordingEnabled: config.recordingEnabled ?? false,
    // --- Balanced turn-taking (snappy but won't cut callers off mid-spelling) ---
    responseDelaySeconds: 0,
    llmRequestDelaySeconds: 0,
    numWordsToInterruptAssistant: 5,
    backgroundDenoisingEnabled: true,
    backchannelingEnabled: false,
    startSpeakingPlan: {
      // Wait ~0.8s of caller silence before assistant starts speaking. Smart
      // endpointing handles natural turn-ends; the explicit wait protects
      // against barge-in when callers spell names letter-by-letter or pause
      // between first and last name.
      waitSeconds: 0.8,
      smartEndpointingEnabled: true,
      transcriptionEndpointingPlan: {
        onPunctuationSeconds: 0.2,
        onNoPunctuationSeconds: 1.6,
        onNumberSeconds: 0.8,
      },
    },
    stopSpeakingPlan: {
      // Caller must say at least 5 words AND speak for 0.4s before the
      // assistant stops talking — prevents back-channels ("yeah", "uh-huh")
      // from killing the assistant mid-sentence.
      numWords: 5,
      voiceSeconds: 0.4,
      backoffSeconds: 1.0,
    },
    ...(config.voicemailDetectionEnabled !== undefined ? {
      voicemailDetection: {
        enabled: config.voicemailDetectionEnabled,
        ...(config.voicemailMessage ? { provider: '11labs', voicemailMessage: config.voicemailMessage } : {}),
      },
    } : {}),
    hipaaEnabled: false,
    clientMessages: ['transcript', 'hang', 'tool-calls', 'speech-update', 'metadata', 'conversation-update'],
    serverMessages: ['end-of-call-report', 'status-update', 'hang', 'tool-calls'],
  };

  console.log(`[Vapi] Creating assistant for ${config.businessName}`);
  return vapiRequest('POST', '/assistant', assistantPayload);
}

export async function updateAssistant(assistantId: string, config: Partial<VapiAssistantConfig>): Promise<VapiResponse> {
  const updates: any = {};

  if (config.voice) {
    const voiceConfig = AUSTRALIAN_VOICES[config.voice] || AUSTRALIAN_VOICES['Jess'];
    updates.voice = {
      provider: voiceConfig.provider,
      voiceId: voiceConfig.voiceId,
      ...(voiceConfig.provider === '11labs' && config.voiceTuning ? {
        stability: config.voiceTuning.stability ?? 0.5,
        similarityBoost: config.voiceTuning.clarity ?? 0.75,
        speed: config.voiceTuning.speed ?? 1.0,
        style: config.voiceTuning.styleExaggeration ?? 0,
        useSpeakerBoost: config.voiceTuning.speakerBoost ?? false,
      } : {}),
    };
  }

  if (config.silenceTimeoutSeconds !== undefined) {
    updates.silenceTimeoutSeconds = config.silenceTimeoutSeconds;
  }
  if (config.maxCallDurationSeconds !== undefined) {
    updates.maxDurationSeconds = config.maxCallDurationSeconds;
  }
  if (config.endCallMessage) {
    updates.endCallMessage = config.endCallMessage;
  }
  if (config.backgroundSound) {
    updates.backgroundSound = config.backgroundSound;
  }
  if (config.voicemailDetectionEnabled !== undefined) {
    updates.voicemailDetection = {
      enabled: config.voicemailDetectionEnabled,
      ...(config.voicemailMessage ? { provider: '11labs', voicemailMessage: config.voicemailMessage } : {}),
    };
  }

  if (config.greeting) {
    updates.firstMessage = applyRecordingNotice(config.greeting, config.recordingEnabled);
  } else if (config.recordingEnabled !== undefined) {
    updates.firstMessage = applyRecordingNotice(`G'day, thanks for calling ${config.businessName || 'us'}. How can I help you today?`, config.recordingEnabled);
  }

  if (config.recordingEnabled !== undefined) {
    updates.recordingEnabled = config.recordingEnabled;
  }

  if (config.businessName || config.greeting || config.transferNumbers || config.businessHours || config.tradeType || config.services || config.teamInfo || config.knownClientCount || config.knowledgeBank || config.aiModel || config.aiMaxTokens !== undefined || config.aiTemperature !== undefined || config.customInstructions !== undefined) {
    const fullConfig: VapiAssistantConfig = {
      businessName: config.businessName || '',
      tradeType: config.tradeType,
      greeting: config.greeting,
      voice: config.voice,
      transferNumbers: config.transferNumbers,
      businessHours: config.businessHours,
      webhookUrl: config.webhookUrl || '',
      services: config.services,
      teamInfo: config.teamInfo,
      knownClientCount: config.knownClientCount,
      knowledgeBank: config.knowledgeBank,
      customInstructions: config.customInstructions,
    };
    updates.model = {
      provider: 'openai',
      model: config.aiModel || 'gpt-4o-mini',
      messages: [{ role: 'system', content: buildSystemPrompt(fullConfig) }],
      tools: buildToolDefinitions(fullConfig),
      ...(config.aiMaxTokens ? { maxTokens: config.aiMaxTokens } : {}),
      ...(config.aiTemperature !== undefined ? { temperature: config.aiTemperature } : {}),
    };
  }

  if (config.webhookUrl) {
    updates.serverUrl = config.webhookUrl;
    if (process.env.VAPI_WEBHOOK_SECRET) {
      updates.serverUrlSecret = process.env.VAPI_WEBHOOK_SECRET;
    }
  }

  // Always (re)apply balanced turn-taking on update so manual UI tweaks can
  // never silently leave the assistant in either a too-slow or too-aggressive
  // (cuts callers off) configuration.
  updates.responseDelaySeconds = 0;
  updates.llmRequestDelaySeconds = 0;
  updates.numWordsToInterruptAssistant = 5;
  updates.backgroundDenoisingEnabled = true;
  updates.backchannelingEnabled = false;
  updates.startSpeakingPlan = {
    waitSeconds: 0.8,
    smartEndpointingEnabled: true,
    transcriptionEndpointingPlan: {
      onPunctuationSeconds: 0.2,
      onNoPunctuationSeconds: 1.6,
      onNumberSeconds: 0.8,
    },
  };
  updates.stopSpeakingPlan = { numWords: 5, voiceSeconds: 0.4, backoffSeconds: 1.0 };

  // Always re-push transcriber config on update so existing assistants pick up
  // model upgrades (e.g. flux → nova-3) and new keyterm boosts (Aussie names).
  updates.transcriber = buildTranscriberConfig({
    businessName: config.businessName || '',
    webhookUrl: config.webhookUrl || '',
    services: config.services,
    teamInfo: config.teamInfo,
  });

  console.log(`[Vapi] Updating assistant ${assistantId}`);
  return vapiRequest('PATCH', `/assistant/${assistantId}`, updates);
}

// =====================================================================
// Latency estimation
// =====================================================================
// Heuristic that combines: turn-taking wait + STT/network base + LLM TTFT +
// 11labs first-chunk + extra penalty for large knowledge banks and non-default
// models. The 800ms turn-taking wait is intentional — it prevents the
// assistant from cutting callers off mid-spelling. Targets reflect total
// perceived response: <1000ms optimal, <1200ms amber, slower = warn.
export function estimateAssistantLatency(cfg: VapiAssistantConfig): {
  ms: number;
  status: 'optimal' | 'amber' | 'warn';
  breakdown: { base: number; llm: number; tts: number; promptPenalty: number; modelPenalty: number };
  greetingWords: number;
  promptChars: number;
  knowledgeBankChars: number;
} {
  const promptChars = buildSystemPrompt(cfg).length;
  const promptTokens = Math.ceil(promptChars / 4);
  const greeting = (cfg.greeting || '').trim();
  const greetingWords = greeting ? greeting.split(/\s+/).filter(Boolean).length : 0;

  // 800ms intentional turn-taking wait + STT endpointing + Vapi infra + network
  const base = 630;
  // gpt-4o-mini ≈ 180ms TTFT + ~25ms per 1k prompt tokens
  const llm = 180 + Math.round((promptTokens / 1000) * 25);
  // 11labs first audio chunk ≈ 140ms + small per-greeting-word lookahead
  const tts = 140 + Math.round(Math.min(greetingWords, 25) * 12);

  let knowledgeBankChars = 0;
  if (cfg.knowledgeBank) {
    const kb = cfg.knowledgeBank;
    knowledgeBankChars =
      (kb.serviceDescriptions || '').length +
      (kb.pricingInfo || '').length +
      (kb.specialInstructions || '').length +
      ((kb.faqs || []).reduce((s, f) => s + (f.question || '').length + (f.answer || '').length, 0));
  }
  // Penalise large knowledge banks beyond 1500 chars (extra prompt processing).
  const promptPenalty = knowledgeBankChars > 1500
    ? Math.round((knowledgeBankChars - 1500) / 1000) * 25
    : 0;

  // Larger LLMs (gpt-4o, gpt-4-turbo) are noticeably slower than gpt-4o-mini.
  const modelPenalty = cfg.aiModel && cfg.aiModel !== 'gpt-4o-mini' ? 150 : 0;

  const ms = base + llm + tts + promptPenalty + modelPenalty;
  const status: 'optimal' | 'amber' | 'warn' = ms < 1000 ? 'optimal' : ms < 1200 ? 'amber' : 'warn';

  return {
    ms,
    status,
    breakdown: { base, llm, tts, promptPenalty, modelPenalty },
    greetingWords,
    promptChars,
    knowledgeBankChars,
  };
}

// Builds a VapiAssistantConfig from the persisted DB record + business
// settings, runs the latency heuristic, and persists the result on the
// receptionist config row. Best-effort: never throws.
export async function refreshLatencyEstimate(
  userId: string,
  configId?: string,
): Promise<{ ms: number; status: 'optimal' | 'amber' | 'warn' } | null> {
  try {
    const config = configId
      ? await storage.getAiReceptionistConfigById(configId)
      : await storage.getAiReceptionistConfig(userId);
    if (!config) return null;

    const settings = await storage.getBusinessSettings(userId);
    const cfg: VapiAssistantConfig = {
      businessName: settings?.businessName || '',
      tradeType: (await storage.getUser(userId))?.tradeType || undefined,
      greeting: config.greeting || undefined,
      voice: config.voiceName || 'Jess',
      transferNumbers: (config.transferNumbers as TransferNumber[]) || [],
      businessHours: (config.businessHours as BusinessHoursConfig) || undefined,
      webhookUrl: '',
      knowledgeBank: (config.knowledgeBank as KnowledgeBankContent) || undefined,
      aiModel: config.aiModel || 'gpt-4o-mini',
      aiMaxTokens: config.aiMaxTokens ?? 250,
      aiTemperature: config.aiTemperature ?? 0.5,
      customInstructions: config.customInstructions || undefined,
    };
    const result = estimateAssistantLatency(cfg);
    const patch = {
      lastLatencyMs: result.ms,
      latencyStatus: result.status,
      lastLatencyCheckedAt: new Date(),
    } as Partial<InsertAiReceptionistConfig>;
    if (configId) {
      await storage.updateAiReceptionistConfigById(configId, patch);
    } else {
      await storage.updateAiReceptionistConfig(userId, patch);
    }
    return { ms: result.ms, status: result.status };
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.warn('[Vapi] refreshLatencyEstimate failed:', msg);
    return null;
  }
}

export async function deleteAssistant(assistantId: string): Promise<void> {
  console.log(`[Vapi] Deleting assistant ${assistantId}`);
  await vapiRequest('DELETE', `/assistant/${assistantId}`);
}

export async function getAssistant(assistantId: string): Promise<VapiResponse> {
  return vapiRequest('GET', `/assistant/${assistantId}`);
}

export async function createOutboundCall(assistantId: string, phoneNumber: string): Promise<VapiResponse> {
  console.log(`[Vapi] Creating outbound test call to ${phoneNumber} with assistant ${assistantId}`);
  return vapiRequest('POST', '/call/phone', {
    assistantId,
    customer: {
      number: phoneNumber,
    },
  });
}

export async function listPhoneNumbers(): Promise<any[]> {
  return vapiRequest('GET', '/phone-number');
}

export async function importPhoneNumber(phoneNumber: string, twilioAccountSid: string, twilioAuthToken: string, assistantId: string): Promise<VapiResponse> {
  console.log(`[Vapi] Importing phone number ${phoneNumber}`);
  return vapiRequest('POST', '/phone-number', {
    provider: 'twilio',
    number: phoneNumber,
    twilioAccountSid,
    twilioAuthToken,
    assistantId,
  });
}

export async function assignPhoneToAssistant(phoneNumberId: string, assistantId: string): Promise<VapiResponse> {
  console.log(`[Vapi] Assigning phone ${phoneNumberId} to assistant ${assistantId}`);
  return vapiRequest('PATCH', `/phone-number/${phoneNumberId}`, {
    assistantId,
  });
}

export async function removePhoneNumber(phoneNumberId: string): Promise<void> {
  console.log(`[Vapi] Releasing phone number ${phoneNumberId}`);
  await vapiRequest('DELETE', `/phone-number/${phoneNumberId}`);
}

export async function getCallDetails(callId: string): Promise<Record<string, unknown>> {
  return vapiRequest('GET', `/call/${callId}`) as Promise<Record<string, unknown>>;
}

export async function getCallLogs(assistantId: string, limit: number = 50): Promise<Array<Record<string, unknown>>> {
  const result = await vapiRequest('GET', `/call?assistantId=${assistantId}&limit=${limit}`);
  return Array.isArray(result) ? result : [];
}

export function getWebhookUrl(): string {
  const viteUrl = process.env.VITE_APP_URL?.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const domain =
    process.env.CUSTOM_DOMAIN ||
    process.env.APP_DOMAIN ||
    viteUrl ||
    process.env.REPLIT_DOMAINS?.split(',')[0] ||
    `${process.env.REPL_SLUG}.repl.co`;
  return `https://${domain}/api/vapi/webhook`;
}

export async function enableAiReceptionist(userId: string): Promise<{
  success: boolean;
  assistantId?: string;
  phoneNumberId?: string;
  phoneNumber?: string;
  error?: string;
}> {
  try {
    const settings = await storage.getBusinessSettings(userId);
    if (!settings) {
      return { success: false, error: 'Business settings not found. Please complete your business profile first.' };
    }

    if (!settings.businessName) {
      return { success: false, error: 'Business name is required to set up the AI Receptionist.' };
    }

    if (!settings.dedicatedPhoneNumber) {
      return { success: false, error: 'A dedicated phone number is required. Please purchase one from the Phone Numbers screen first.' };
    }

    const { isSharedPlatformNumber } = await import('./phoneNumberUtils');
    if (isSharedPlatformNumber(settings.dedicatedPhoneNumber)) {
      return { success: false, error: 'AI Receptionist requires a dedicated number. The shared platform number cannot be used.' };
    }

    let config = await storage.getAiReceptionistConfig(userId);
    if (config?.vapiAssistantId) {
      if (!config.enabled) {
        await storage.updateAiReceptionistConfig(userId, {
          enabled: true,
          mode: config.mode === 'off' ? 'always_on_message' : config.mode,
        });
        console.log(`[Vapi] AI Receptionist re-enabled for user ${userId} (existing assistant: ${config.vapiAssistantId})`);
        return {
          success: true,
          assistantId: config.vapiAssistantId,
          phoneNumber: config.dedicatedPhoneNumber || settings.dedicatedPhoneNumber || undefined,
        };
      }
      return { success: true, assistantId: config.vapiAssistantId };
    }

    const webhookUrl = getWebhookUrl();
    const transferNumbers = (config?.transferNumbers || []) as TransferNumber[];
    const businessHours = (config?.businessHours || null) as BusinessHoursConfig | null;

    const teamMembers = await storage.getTeamMembers(userId);
    const teamInfo = teamMembers
      .filter(m => m.isActive)
      .map(m => ({ name: `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email, role: 'team member' }));

    const clients = await storage.getClients(userId);
    const knownClientCount = clients.length;

    let services: string[] = [];
    try {
      const catalogItems = await storage.getLineItemCatalog(userId);
      services = catalogItems.map(item => item.name).filter(Boolean).slice(0, 20);
    } catch (catalogErr) {
      console.warn('[Vapi] Failed to fetch catalog items for assistant, continuing without:', catalogErr);
    }

    const knowledgeBank = (config?.knowledgeBank || null) as KnowledgeBankContent | null;

    const assistant = await createAssistant({
      businessName: settings.businessName,
      businessPhone: settings.phone || undefined,
      tradeType: (await storage.getUser(userId))?.tradeType || undefined,
      greeting: config?.greeting || undefined,
      voice: config?.voiceName || 'Jess',
      transferNumbers,
      businessHours: businessHours || undefined,
      webhookUrl,
      services,
      teamInfo,
      knownClientCount,
      knowledgeBank: knowledgeBank || undefined,
      recordingEnabled: config?.recordingEnabled ?? false,
      aiModel: config?.aiModel || 'gpt-4o-mini',
      aiMaxTokens: config?.aiMaxTokens ?? 250,
      aiTemperature: config?.aiTemperature ?? 0.5,
      customInstructions: config?.customInstructions || undefined,
    });

    if (config) {
      await storage.updateAiReceptionistConfig(userId, {
        vapiAssistantId: assistant.id,
        enabled: true,
        mode: config.mode === 'off' ? 'always_on_message' : config.mode,
        dedicatedPhoneNumber: settings.dedicatedPhoneNumber,
      });
    } else {
      config = await storage.createAiReceptionistConfig({
        userId,
        vapiAssistantId: assistant.id,
        enabled: true,
        mode: 'always_on_message',
        voiceName: 'Jess',
        dedicatedPhoneNumber: settings.dedicatedPhoneNumber,
      });
    }

    console.log(`[Vapi] AI Receptionist enabled for user ${userId} - assistant: ${assistant.id}`);

    // Auto-test latency immediately after provisioning so the UI has a value
    // to show without the user having to click "Test Response Time".
    refreshLatencyEstimate(userId).catch(() => {});

    return {
      success: true,
      assistantId: assistant.id,
    };
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Vapi] Failed to enable AI Receptionist for user ${userId}:`, message);
    try {
      const { logSystemEvent } = await import('./systemEventService');
      logSystemEvent('vapi', 'error', 'ai_receptionist_enable_failed', `Failed to enable AI Receptionist for user ${userId}: ${message}`, { userId });
    } catch {}
    return { success: false, error: message };
  }
}

export async function disableAiReceptionist(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await storage.getAiReceptionistConfig(userId);
    if (!config) {
      return { success: false, error: 'AI Receptionist config not found' };
    }

    await storage.updateAiReceptionistConfig(userId, {
      enabled: false,
    });

    console.log(`[Vapi] AI Receptionist disabled for user ${userId} (assistant preserved: ${config.vapiAssistantId})`);
    return { success: true };
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Vapi] Failed to disable AI Receptionist for user ${userId}:`, message);
    return { success: false, error: message };
  }
}

export async function destroyAiReceptionist(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await storage.getAiReceptionistConfig(userId);
    if (!config) {
      return { success: false, error: 'AI Receptionist config not found' };
    }

    if (config.vapiAssistantId) {
      try {
        await deleteAssistant(config.vapiAssistantId);
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.warn(`[Vapi] Failed to delete assistant ${config.vapiAssistantId}:`, msg);
      }
    }

    if (config.vapiPhoneNumberId) {
      try {
        await removePhoneNumber(config.vapiPhoneNumberId);
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.warn(`[Vapi] Failed to release phone number ${config.vapiPhoneNumberId}:`, msg);
      }
    }

    await storage.updateAiReceptionistConfig(userId, {
      vapiAssistantId: null,
      vapiPhoneNumberId: null,
      enabled: false,
      mode: 'off',
      approvalStatus: 'none',
      dedicatedPhoneNumber: null,
    });

    console.log(`[Vapi] AI Receptionist fully destroyed for user ${userId}`);
    return { success: true };
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Vapi] Failed to destroy AI Receptionist for user ${userId}:`, message);
    return { success: false, error: message };
  }
}

export async function updateReceptionistConfig(userId: string, updates: {
  voice?: string;
  greeting?: string;
  mode?: string;
  transferNumbers?: Array<{ name: string; phone: string; priority: number }>;
  businessHours?: BusinessHoursConfig;
  knowledgeBank?: KnowledgeBankContent;
  smsNotifications?: boolean;
  recordingEnabled?: boolean;
  voiceStability?: number;
  voiceClarity?: number;
  voiceSpeed?: number;
  voiceStyleExaggeration?: number;
  voiceSpeakerBoost?: boolean;
  voicemailDetectionEnabled?: boolean;
  voicemailMessage?: string;
  silenceTimeoutSeconds?: number;
  maxCallDurationSeconds?: number;
  endCallMessage?: string;
  backgroundSound?: string;
  autoReplyEnabled?: boolean;
  autoReplyMessage?: string;
  aiModel?: string;
  aiMaxTokens?: number;
  aiTemperature?: number;
  customInstructions?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await storage.getAiReceptionistConfig(userId);
    if (!config) {
      return { success: false, error: 'AI Receptionist config not found. Create it first.' };
    }

    const configUpdates: Partial<InsertAiReceptionistConfig> = {};
    if (updates.voice) configUpdates.voiceName = updates.voice;
    if (updates.greeting) configUpdates.greeting = updates.greeting;
    if (updates.mode) configUpdates.mode = updates.mode;
    if (updates.transferNumbers) configUpdates.transferNumbers = updates.transferNumbers;
    if (updates.businessHours) configUpdates.businessHours = updates.businessHours;
    if (updates.knowledgeBank !== undefined) configUpdates.knowledgeBank = updates.knowledgeBank;
    if (updates.smsNotifications !== undefined) configUpdates.smsNotifications = updates.smsNotifications;
    if (updates.recordingEnabled !== undefined) configUpdates.recordingEnabled = updates.recordingEnabled;
    if (updates.voiceStability !== undefined) configUpdates.voiceStability = updates.voiceStability;
    if (updates.voiceClarity !== undefined) configUpdates.voiceClarity = updates.voiceClarity;
    if (updates.voiceSpeed !== undefined) configUpdates.voiceSpeed = updates.voiceSpeed;
    if (updates.voiceStyleExaggeration !== undefined) configUpdates.voiceStyleExaggeration = updates.voiceStyleExaggeration;
    if (updates.voiceSpeakerBoost !== undefined) configUpdates.voiceSpeakerBoost = updates.voiceSpeakerBoost;
    if (updates.voicemailDetectionEnabled !== undefined) configUpdates.voicemailDetectionEnabled = updates.voicemailDetectionEnabled;
    if (updates.voicemailMessage !== undefined) configUpdates.voicemailMessage = updates.voicemailMessage;
    if (updates.silenceTimeoutSeconds !== undefined) configUpdates.silenceTimeoutSeconds = updates.silenceTimeoutSeconds;
    if (updates.maxCallDurationSeconds !== undefined) configUpdates.maxCallDurationSeconds = updates.maxCallDurationSeconds;
    if (updates.endCallMessage !== undefined) configUpdates.endCallMessage = updates.endCallMessage;
    if (updates.backgroundSound !== undefined) configUpdates.backgroundSound = updates.backgroundSound;
    if (updates.autoReplyEnabled !== undefined) configUpdates.autoReplyEnabled = updates.autoReplyEnabled;
    if (updates.autoReplyMessage !== undefined) configUpdates.autoReplyMessage = updates.autoReplyMessage;
    if (updates.aiModel !== undefined) configUpdates.aiModel = updates.aiModel;
    if (updates.aiMaxTokens !== undefined) configUpdates.aiMaxTokens = updates.aiMaxTokens;
    if (updates.aiTemperature !== undefined) configUpdates.aiTemperature = updates.aiTemperature;
    if (updates.customInstructions !== undefined) configUpdates.customInstructions = updates.customInstructions;

    await storage.updateAiReceptionistConfig(userId, configUpdates);

    const needsVapiSync = updates.voice || updates.greeting || updates.transferNumbers || updates.businessHours || updates.knowledgeBank ||
      updates.aiModel !== undefined || updates.aiMaxTokens !== undefined || updates.aiTemperature !== undefined || updates.customInstructions !== undefined ||
      updates.voiceStability !== undefined || updates.voiceClarity !== undefined || updates.voiceSpeed !== undefined ||
      updates.voiceStyleExaggeration !== undefined || updates.voiceSpeakerBoost !== undefined ||
      updates.voicemailDetectionEnabled !== undefined || updates.voicemailMessage !== undefined ||
      updates.silenceTimeoutSeconds !== undefined || updates.maxCallDurationSeconds !== undefined ||
      updates.endCallMessage !== undefined || updates.backgroundSound !== undefined || updates.recordingEnabled !== undefined;

    if (config.vapiAssistantId && needsVapiSync) {
      try {
        const settings = await storage.getBusinessSettings(userId);
        const webhookUrl = getWebhookUrl();

        const teamMembers = await storage.getTeamMembers(userId);
        const teamInfo = teamMembers
          .filter(m => m.isActive)
          .map(m => ({ name: `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email, role: 'team member' }));

        const clients = await storage.getClients(userId);
        const knownClientCount = clients.length;

        let services: string[] = [];
        try {
          const catalogItems = await storage.getLineItemCatalog(userId);
          services = catalogItems.map(item => item.name).filter(Boolean).slice(0, 20);
        } catch (catalogErr) {
          console.warn('[Vapi] Failed to fetch catalog items for update, continuing without:', catalogErr);
        }

        const resolvedKB = updates.knowledgeBank || (config.knowledgeBank as KnowledgeBankContent | null) || undefined;

        const voiceTuning: VoiceTuning = {
          stability: updates.voiceStability ?? config.voiceStability ?? 0.5,
          clarity: updates.voiceClarity ?? config.voiceClarity ?? 0.75,
          speed: updates.voiceSpeed ?? config.voiceSpeed ?? 1.0,
          styleExaggeration: updates.voiceStyleExaggeration ?? config.voiceStyleExaggeration ?? 0,
          speakerBoost: updates.voiceSpeakerBoost ?? config.voiceSpeakerBoost ?? false,
        };

        await updateAssistant(config.vapiAssistantId, {
          businessName: settings?.businessName || '',
          tradeType: (await storage.getUser(userId))?.tradeType || undefined,
          voice: updates.voice || config.voiceName || 'Jess',
          voiceTuning,
          greeting: updates.greeting || config.greeting || undefined,
          transferNumbers: updates.transferNumbers || (config.transferNumbers as TransferNumber[]) || [],
          businessHours: updates.businessHours || (config.businessHours as BusinessHoursConfig | null) || undefined,
          webhookUrl,
          services,
          teamInfo,
          knownClientCount,
          knowledgeBank: resolvedKB,
          silenceTimeoutSeconds: updates.silenceTimeoutSeconds ?? config.silenceTimeoutSeconds ?? 30,
          maxCallDurationSeconds: updates.maxCallDurationSeconds ?? config.maxCallDurationSeconds ?? 600,
          endCallMessage: updates.endCallMessage ?? config.endCallMessage ?? undefined,
          backgroundSound: updates.backgroundSound ?? config.backgroundSound ?? 'off',
          voicemailDetectionEnabled: updates.voicemailDetectionEnabled ?? config.voicemailDetectionEnabled ?? true,
          voicemailMessage: updates.voicemailMessage ?? config.voicemailMessage ?? undefined,
          aiModel: updates.aiModel ?? config.aiModel ?? 'gpt-4o-mini',
          aiMaxTokens: updates.aiMaxTokens ?? config.aiMaxTokens ?? 250,
          aiTemperature: updates.aiTemperature ?? config.aiTemperature ?? 0.5,
          customInstructions: updates.customInstructions ?? config.customInstructions ?? undefined,
          recordingEnabled: updates.recordingEnabled ?? config.recordingEnabled ?? false,
        });
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error(`[Vapi] Failed to sync assistant update:`, msg);
      }
    }

    // Recompute latency from the freshly-saved config so the UI badge is current.
    await refreshLatencyEstimate(userId);

    return { success: true };
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Vapi] Failed to update config for user ${userId}:`, message);
    return { success: false, error: message };
  }
}

export async function updateReceptionistConfigById(configId: string, userId: string, updates: {
  voice?: string;
  greeting?: string;
  mode?: string;
  transferNumbers?: Array<{ name: string; phone: string; priority: number }>;
  businessHours?: BusinessHoursConfig;
  knowledgeBank?: KnowledgeBankContent;
  smsNotifications?: boolean;
  recordingEnabled?: boolean;
  voiceStability?: number;
  voiceClarity?: number;
  voiceSpeed?: number;
  voiceStyleExaggeration?: number;
  voiceSpeakerBoost?: boolean;
  voicemailDetectionEnabled?: boolean;
  voicemailMessage?: string;
  silenceTimeoutSeconds?: number;
  maxCallDurationSeconds?: number;
  endCallMessage?: string;
  backgroundSound?: string;
  autoReplyEnabled?: boolean;
  autoReplyMessage?: string;
  aiModel?: string;
  aiMaxTokens?: number;
  aiTemperature?: number;
  customInstructions?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await storage.getAiReceptionistConfigById(configId);
    if (!config || config.userId !== userId) {
      return { success: false, error: 'AI Receptionist config not found.' };
    }

    if (!config.vapiAssistantId) {
      return { success: true };
    }

    const needsVapiSync = updates.voice || updates.greeting || updates.transferNumbers || updates.businessHours || updates.knowledgeBank ||
      updates.aiModel !== undefined || updates.aiMaxTokens !== undefined || updates.aiTemperature !== undefined || updates.customInstructions !== undefined ||
      updates.voiceStability !== undefined || updates.voiceClarity !== undefined || updates.voiceSpeed !== undefined ||
      updates.voiceStyleExaggeration !== undefined || updates.voiceSpeakerBoost !== undefined ||
      updates.voicemailDetectionEnabled !== undefined || updates.voicemailMessage !== undefined ||
      updates.silenceTimeoutSeconds !== undefined || updates.maxCallDurationSeconds !== undefined ||
      updates.endCallMessage !== undefined || updates.backgroundSound !== undefined || updates.recordingEnabled !== undefined;

    if (needsVapiSync) {
      const settings = await storage.getBusinessSettings(userId);
      const webhookUrl = getWebhookUrl();

      const teamMembers = await storage.getTeamMembers(userId);
      const teamInfo = teamMembers
        .filter(m => m.isActive)
        .map(m => ({ name: `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email, role: 'team member' }));

      const clients = await storage.getClients(userId);
      const knownClientCount = clients.length;

      let services: string[] = [];
      try {
        const catalogItems = await storage.getLineItemCatalog(userId);
        services = catalogItems.map(item => item.name).filter(Boolean).slice(0, 20);
      } catch (catalogErr) {
        services = [];
      }

      const resolvedModel = updates.aiModel ?? config.aiModel ?? 'gpt-4o-mini';
      const resolvedMaxTokens = updates.aiMaxTokens ?? config.aiMaxTokens ?? 250;
      const resolvedTemperature = updates.aiTemperature ?? config.aiTemperature ?? 0.5;

      const resolvedCustomInstructions = updates.customInstructions ?? config.customInstructions ?? undefined;

      const systemPrompt = buildSystemPrompt({
        businessName: settings?.businessName || 'the business',
        tradeType: (await storage.getUser(userId))?.tradeType || undefined,
        greeting: updates.greeting || config.greeting || undefined,
        voice: updates.voice || config.voiceName || 'Jess',
        transferNumbers: updates.transferNumbers || (config.transferNumbers as any) || [],
        businessHours: updates.businessHours || (config.businessHours as any) || undefined,
        webhookUrl,
        services,
        teamInfo,
        knownClientCount,
        knowledgeBank: updates.knowledgeBank || (config.knowledgeBank as any) || undefined,
        customInstructions: resolvedCustomInstructions || undefined,
      });

      const vapiUpdates: any = {
        model: {
          provider: 'openai',
          model: resolvedModel,
          messages: [{ role: 'system', content: systemPrompt }],
          ...(resolvedMaxTokens ? { maxTokens: resolvedMaxTokens } : {}),
          ...(resolvedTemperature !== undefined ? { temperature: resolvedTemperature } : {}),
        },
        serverUrl: webhookUrl,
        ...(process.env.VAPI_WEBHOOK_SECRET ? { serverUrlSecret: process.env.VAPI_WEBHOOK_SECRET } : {}),
      };

      if (updates.voice) {
        vapiUpdates.voice = {
          provider: '11labs',
          voiceId: updates.voice,
          stability: updates.voiceStability ?? config.voiceStability ?? 0.5,
          similarityBoost: updates.voiceClarity ?? config.voiceClarity ?? 0.75,
          speed: updates.voiceSpeed ?? config.voiceSpeed ?? 1.0,
        };
      }

      const resolvedRecording = updates.recordingEnabled ?? config.recordingEnabled ?? false;
      if (updates.greeting !== undefined || updates.recordingEnabled !== undefined) {
        const baseGreeting = (updates.greeting ?? config.greeting) || `G'day, thanks for calling ${settings?.businessName || 'us'}. How can I help you today?`;
        vapiUpdates.firstMessage = applyRecordingNotice(baseGreeting, resolvedRecording);
      }
      if (updates.recordingEnabled !== undefined) {
        vapiUpdates.recordingEnabled = updates.recordingEnabled;
      }

      if (updates.voicemailDetectionEnabled !== undefined) {
        vapiUpdates.voicemailDetection = {
          enabled: updates.voicemailDetectionEnabled,
          provider: 'twilio',
        };
      }

      if (updates.silenceTimeoutSeconds !== undefined) {
        vapiUpdates.silenceTimeoutSeconds = updates.silenceTimeoutSeconds;
      }
      if (updates.maxCallDurationSeconds !== undefined) {
        vapiUpdates.maxDurationSeconds = updates.maxCallDurationSeconds;
      }
      if (updates.endCallMessage !== undefined) {
        vapiUpdates.endCallMessage = updates.endCallMessage;
      }
      if (updates.backgroundSound !== undefined) {
        vapiUpdates.backgroundSound = updates.backgroundSound === 'off' ? undefined : updates.backgroundSound;
      }

      // Always (re)apply balanced turn-taking on update.
      vapiUpdates.responseDelaySeconds = 0;
      vapiUpdates.llmRequestDelaySeconds = 0;
      vapiUpdates.numWordsToInterruptAssistant = 5;
      vapiUpdates.backgroundDenoisingEnabled = true;
      vapiUpdates.backchannelingEnabled = false;
      vapiUpdates.startSpeakingPlan = {
        waitSeconds: 0.8,
        smartEndpointingEnabled: true,
        transcriptionEndpointingPlan: {
          onPunctuationSeconds: 0.2,
          onNoPunctuationSeconds: 1.6,
          onNumberSeconds: 0.8,
        },
      };
      vapiUpdates.stopSpeakingPlan = { numWords: 5, voiceSeconds: 0.4, backoffSeconds: 1.0 };

      // Re-push transcriber so model + keyterm changes take effect on existing assistants.
      vapiUpdates.transcriber = buildTranscriberConfig({
        businessName: settings?.businessName || 'the business',
        webhookUrl,
        services,
        teamInfo,
      });

      await vapiRequest('PATCH', `/assistant/${config.vapiAssistantId}`, vapiUpdates);
      console.log(`[Vapi] Updated assistant ${config.vapiAssistantId} for config ${configId}`);
    }

    await refreshLatencyEstimate(userId, configId);

    return { success: true };
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Vapi] Failed to update config ${configId}:`, message);
    return { success: false, error: message };
  }
}

const assistantCache = new Map<string, { userId: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function findBusinessByVapiAssistant(assistantId: string): Promise<BusinessSettings | undefined> {
  const result = await findBusinessAndConfigByVapiAssistant(assistantId);
  return result?.business;
}

export async function findBusinessAndConfigByVapiAssistant(assistantId: string): Promise<{ business: BusinessSettings; config?: AiReceptionistConfig } | undefined> {
  const cached = assistantCache.get(assistantId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    const business = await storage.getBusinessSettings(cached.userId);
    if (!business) return undefined;
    const allConfigs = await storage.getAiReceptionistConfigsByUser(cached.userId);
    const config = allConfigs.find(c => c.vapiAssistantId === assistantId);
    return { business, config };
  }

  const allSettings = await storage.getAllBusinessSettings();
  const match = allSettings.find(s => s.vapiAssistantId === assistantId);
  if (match) {
    assistantCache.set(assistantId, { userId: match.userId, timestamp: Date.now() });
    const allConfigs = await storage.getAiReceptionistConfigsByUser(match.userId);
    const config = allConfigs.find(c => c.vapiAssistantId === assistantId);
    return { business: match, config };
  }

  const allConfigs = await storage.getAllAiReceptionistConfigs();
  const configMatch = allConfigs.find(c => c.vapiAssistantId === assistantId);
  if (configMatch) {
    assistantCache.set(assistantId, { userId: configMatch.userId, timestamp: Date.now() });
    const business = await storage.getBusinessSettings(configMatch.userId);
    if (!business) return undefined;
    return { business, config: configMatch };
  }

  return undefined;
}

export async function handleToolCall(
  toolName: string,
  toolArgs: Record<string, unknown>,
  userId: string,
  callId: string,
  callerPhone?: string,
): Promise<Record<string, unknown>> {
  console.log(`[Vapi] Tool call: ${toolName} for user ${userId}, call ${callId}`);

  switch (toolName) {
    case 'capture_lead':
      return handleCaptureLead(toolArgs, userId, callId);
    case 'transfer_call':
      return handleTransferCall(toolArgs as { reason: string; caller_phone?: string }, userId, callerPhone);
    case 'check_availability':
      return handleCheckAvailability(toolArgs, userId);
    case 'lookup_client':
      return handleLookupClient(toolArgs, userId);
    case 'create_booking':
      return handleCreateBooking(toolArgs, userId, callId);
    default:
      console.warn(`[Vapi] Unknown tool: ${toolName}`);
      return { result: 'Tool not recognized' };
  }
}

async function handleCaptureLead(args: any, userId: string, callId: string): Promise<any> {
  try {
    const existingCall = await storage.getAiReceptionistCall(callId, userId);
    if (existingCall?.leadId) {
      console.log(`[Vapi] Lead already captured for call ${callId}, skipping duplicate`);
      return { result: `Details already recorded. Reference number: ${existingCall.leadId.slice(0, 8)}` };
    }

    let callerName = args.caller_name || 'Unknown Caller';
    const callerPhone = args.caller_phone || null;
    const callerEmail = args.caller_email || null;

    // Safety net: snap mishears like "Aiden Bogler" / "Aidan Voller" to the
    // canonical spelling of any known person on this business (owner or team
    // member). Runs on the server so the lead is correct in JobRunner even
    // when the speech-to-text layer still gets the name slightly wrong.
    if (callerName && callerName !== 'Unknown Caller') {
      try {
        const canonicals: string[] = [];
        const owner = await storage.getUser(userId);
        if (owner) {
          const ownerFull = `${owner.firstName || ''} ${owner.lastName || ''}`.replace(/\s+/g, ' ').trim();
          if (ownerFull) canonicals.push(ownerFull);
        }
        const teamMembers = await storage.getTeamMembers(userId);
        for (const m of teamMembers || []) {
          const full = `${m.firstName || ''} ${m.lastName || ''}`.replace(/\s+/g, ' ').trim();
          if (full) canonicals.push(full);
        }
        // Also match against existing clients and recent leads — a customer
        // who has called or been quoted before is the most likely caller, and
        // we already have the canonical spelling of their name on file.
        try {
          const clients = await storage.getClients(userId);
          for (const c of clients || []) {
            if (c.name) canonicals.push(c.name);
          }
        } catch {}
        try {
          const leads = await storage.getLeads(userId);
          for (const l of (leads || []).slice(0, 100)) {
            if (l.name) canonicals.push(l.name);
          }
        } catch {}
        const normalised = normalizeCallerName(callerName, canonicals);
        if (normalised !== callerName) {
          console.log(`[Vapi] Normalised caller name "${callerName}" → "${normalised}" (matched known person)`);
          callerName = normalised;
        }
      } catch (e) {
        console.warn('[Vapi] Caller name normalisation failed (non-fatal):', e);
      }
    }
    const jobType = args.job_type || args.intent || 'General enquiry';
    const address = args.address || null;
    const urgency = args.urgency || null;
    const notes = args.notes || '';

    if (callerPhone) {
      const recentLeads = await storage.getLeadsByUserAndPhone(userId, callerPhone);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentDuplicate = recentLeads?.find(l => l.createdAt && new Date(l.createdAt) > oneHourAgo);
      if (recentDuplicate) {
        console.log(`[Vapi] Spam protection: duplicate lead from ${callerPhone} within 1 hour, skipping`);
        await storage.updateAiReceptionistCall(callId, userId, {
          leadId: recentDuplicate.id,
          callerName: callerName,
          callerIntent: args.intent || jobType,
        });
        return { result: `Your details are already on file. Someone will be in touch shortly. Reference: ${recentDuplicate.id.slice(0, 8)}` };
      }
    }

    const lead = await storage.createLead({
      userId,
      name: callerName,
      phone: callerPhone,
      email: callerEmail,
      source: 'ai_receptionist',
      status: 'new',
      description: notes || `${jobType} - via AI Receptionist`,
      estimatedValue: null,
      notes: [
        jobType ? `Work type: ${jobType}` : null,
        address ? `Location: ${address}` : null,
        urgency ? `Urgency: ${urgency}` : null,
        `Source: AI Receptionist call (${callId})`,
      ].filter(Boolean).join('\n'),
      followUpDate: null,
      wonLostReason: null,
    });

    await storage.updateAiReceptionistCall(callId, userId, {
      leadId: lead.id,
      callerName: callerName,
      callerIntent: args.intent || jobType,
      extractedInfo: {
        name: callerName,
        email: callerEmail,
        phone: callerPhone,
        address,
        jobType,
        urgency,
        notes,
      },
    });

    try {
      await storage.createNotification({
        userId,
        type: 'new_lead',
        title: 'New Lead from AI Receptionist',
        message: `${callerName} called about "${jobType}". Review and convert in Leads.`,
        relatedId: lead.id,
        relatedType: 'lead',
        priority: 'important',
        actionUrl: `/leads`,
        actionLabel: 'View Lead',
      });
    } catch (e) {
      console.error('[Vapi] Failed to create notification:', e);
    }

    console.log(`[Vapi] Lead ${lead.id} created for call ${callId} (no auto-job)`);
    return { result: `I've got all your details. Someone will review your enquiry and get back to you shortly. Reference: ${lead.id.slice(0, 8)}` };
  } catch (error: unknown) {
    console.error('[Vapi] Failed to capture lead:', error);
    return { result: 'I\'ve noted down the details. Someone will follow up shortly.' };
  }
}

interface AvailabilityStatus {
  open: boolean;
  reason: 'open' | 'closed_day' | 'closed_hours' | 'on_break' | 'holiday';
  holidayLabel?: string;
  breakEnd?: string;
  todayHours?: string;
}

function getAvailabilityStatus(businessHours: any): AvailabilityStatus {
  if (!businessHours) return { open: true, reason: 'open' };
  try {
    const tz = businessHours.timezone || 'Australia/Brisbane';
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-AU', {
      timeZone: tz,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
      weekday: 'short',
    });
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    const nowMinutes = hour * 60 + minute;
    const dayName = parts.find(p => p.type === 'weekday')?.value || '';
    const dayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
    const dayNumber = dayMap[dayName] ?? new Date().getDay();

    const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    const todayDate = dateFormatter.format(now);

    const holidays: Holiday[] = businessHours.holidays || [];
    const todayHoliday = holidays.find(h => h.date === todayDate);
    if (todayHoliday) {
      return { open: false, reason: 'holiday', holidayLabel: todayHoliday.label };
    }

    const schedule: DaySchedule[] = businessHours.schedule || [];
    if (schedule.length > 0) {
      const todaySchedule = schedule.find(s => s.day === dayNumber);
      if (!todaySchedule || !todaySchedule.enabled) {
        return { open: false, reason: 'closed_day' };
      }

      const [sH, sM] = todaySchedule.start.split(':').map(Number);
      const [eH, eM] = todaySchedule.end.split(':').map(Number);
      const startMins = sH * 60 + (sM || 0);
      const endMins = eH * 60 + (eM || 0);

      if (todaySchedule.breakStart && todaySchedule.breakEnd) {
        const [bsH, bsM] = todaySchedule.breakStart.split(':').map(Number);
        const [beH, beM] = todaySchedule.breakEnd.split(':').map(Number);
        const breakStartMins = bsH * 60 + (bsM || 0);
        const breakEndMins = beH * 60 + (beM || 0);
        if (nowMinutes >= breakStartMins && nowMinutes < breakEndMins) {
          return { open: false, reason: 'on_break', breakEnd: todaySchedule.breakEnd, todayHours: `${todaySchedule.start}-${todaySchedule.end}` };
        }
      }

      if (nowMinutes >= startMins && nowMinutes <= endMins) {
        return { open: true, reason: 'open', todayHours: `${todaySchedule.start}-${todaySchedule.end}` };
      }
      return { open: false, reason: 'closed_hours', todayHours: `${todaySchedule.start}-${todaySchedule.end}` };
    }

    const activeDays = businessHours.days || [1, 2, 3, 4, 5];
    if (!activeDays.includes(dayNumber)) return { open: false, reason: 'closed_day' };

    const [startH, startM] = (businessHours.start || '08:00').split(':').map(Number);
    const [endH, endM] = (businessHours.end || '17:00').split(':').map(Number);
    const startMinutes = startH * 60 + (startM || 0);
    const endMinutes = endH * 60 + (endM || 0);
    const hoursStr = `${businessHours.start || '08:00'}-${businessHours.end || '17:00'}`;
    if (nowMinutes >= startMinutes && nowMinutes <= endMinutes) {
      return { open: true, reason: 'open', todayHours: hoursStr };
    }
    return { open: false, reason: 'closed_hours', todayHours: hoursStr };
  } catch {
    return { open: true, reason: 'open' };
  }
}

function isWithinBusinessHours(businessHours: any): boolean {
  return getAvailabilityStatus(businessHours).open;
}

async function getAvailableTransferTarget(userId: string, _settings: BusinessSettings, callerPhone?: string | null): Promise<{ name: string; phone: string } | null> {
  const config = await storage.getAiReceptionistConfig(userId);
  const mode = config?.mode || 'always_on_message';
  const transferNumbers = (config?.transferNumbers || []) as TransferNumber[];
  const businessHours = (config?.businessHours || null) as BusinessHoursConfig | null;

  if (mode === 'off') return null;
  if (mode === 'always_on_message') return null;

  if (mode === 'after_hours') {
    if (!isWithinBusinessHours(businessHours)) {
      return null;
    }
    return findFirstAvailableTarget(userId, transferNumbers);
  }

  if (mode === 'always_on_transfer') {
    return findFirstAvailableTarget(userId, transferNumbers);
  }

  if (mode === 'selective') {
    const isKnownClient = await shouldTransferSelectiveByClient(userId, callerPhone ?? null);
    if (!isKnownClient) return null;
    return findFirstAvailableTarget(userId, transferNumbers);
  }

  return null;
}

async function findFirstAvailableTarget(userId: string, transferNumbers: TransferNumber[]): Promise<{ name: string; phone: string } | null> {
  try {
    const teamMembers = await storage.getTeamMembers(userId);
    const availableMembers = teamMembers.filter(m =>
      m.isActive && m.aiReceptionistAvailability && m.phone
    );

    if (availableMembers.length > 0) {
      const member = availableMembers[0];
      return { name: member.firstName || member.email, phone: member.phone! };
    }
  } catch {
    // fall through to transfer numbers
  }

  const sorted = [...transferNumbers].sort((a, b) => (a.priority || 99) - (b.priority || 99));
  for (const target of sorted) {
    if (target.phone) {
      return { name: target.name, phone: target.phone };
    }
  }

  return null;
}

async function shouldTransferSelectiveByClient(userId: string, callerPhone: string | null): Promise<boolean> {
  if (!callerPhone) return false;
  try {
    const allClients = await storage.getClients(userId);
    const normalizedPhone = callerPhone.replace(/\D/g, '');
    return allClients.some(c => {
      const clientPhone = (c.phone || '').replace(/\D/g, '');
      return clientPhone && (clientPhone === normalizedPhone || clientPhone.endsWith(normalizedPhone) || normalizedPhone.endsWith(clientPhone));
    });
  } catch {
    return false;
  }
}

async function handleTransferCall(args: { reason: string; caller_phone?: string }, userId: string, callerPhone?: string): Promise<{ result: string; forwardingPhoneNumber?: string }> {
  try {
    const settings = await storage.getBusinessSettings(userId);
    if (!settings) {
      return { result: 'No one is available to take the call right now, but don\'t worry — I\'ve got all your details and we\'ll call you back as soon as possible.' };
    }

    const target = await getAvailableTransferTarget(userId, settings, callerPhone || args.caller_phone);
    if (!target) {
      return { result: 'No one is available to take the call right now, but don\'t worry — I\'ve got all your details and we\'ll call you back as soon as possible.' };
    }

    return {
      result: `Transferring to ${target.name}...`,
      forwardingPhoneNumber: target.phone,
    };
  } catch (error: unknown) {
    console.error('[Vapi] Transfer failed:', error);
    return { result: 'No one is available to take the call right now, but don\'t worry — I\'ve got all your details and we\'ll call you back as soon as possible.' };
  }
}

// Parse a caller's free-form preferred date/time into a concrete Date.
// Conservative by design: returns null unless we can build a valid date, so
// the AI only enforces slot conflicts when it's confident about the time and
// otherwise behaves exactly as before.
function parsePreferredDateTime(preferredDate?: string | null, preferredTime?: string | null): Date | null {
  if (!preferredDate || typeof preferredDate !== 'string') return null;
  const dateStr = preferredDate.trim();
  if (!dateStr) return null;

  const base = new Date(dateStr);
  if (isNaN(base.getTime())) return null;

  // If the date string already carried a time (ISO "T", or "HH:MM") and the
  // caller didn't give a separate time, trust the parsed time.
  const dateStrHasTime = /T\d{2}:|\d{1,2}:\d{2}/.test(dateStr);

  let hours = 9;
  let minutes = 0;
  let hadTime = false;
  if (preferredTime && typeof preferredTime === 'string') {
    const t = preferredTime.trim().toLowerCase();
    const wordMap: Record<string, number> = { morning: 9, midday: 12, noon: 12, afternoon: 13, evening: 17, night: 18 };
    if (wordMap[t] !== undefined) {
      hours = wordMap[t];
      hadTime = true;
    } else {
      const m = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
      if (m) {
        let h = parseInt(m[1], 10);
        const mins = m[2] ? parseInt(m[2], 10) : 0;
        const mer = m[3];
        if (mer === 'pm' && h < 12) h += 12;
        if (mer === 'am' && h === 12) h = 0;
        if (h >= 0 && h <= 23 && mins >= 0 && mins <= 59) {
          hours = h;
          minutes = mins;
          hadTime = true;
        }
      }
    }
  }

  if (dateStrHasTime && !hadTime) return base;

  // The caller named a time but we couldn't make sense of it (and the date
  // string carried none either). Don't silently assume 9am — bail out so the
  // booking falls back to the safe "tentative" path instead of checking the
  // wrong slot.
  const timeRequested = typeof preferredTime === 'string' && preferredTime.trim().length > 0;
  if (timeRequested && !hadTime && !dateStrHasTime) return null;

  base.setHours(hours, minutes, 0, 0);
  return base;
}

// Work out whether a requested time slot can be serviced. Capacity is the
// number of active team members; a slot is "free" while fewer jobs overlap it
// than there are people to do them. When fully booked, scans forward (business
// hours, hourly) for the next open slot to offer the caller.
async function checkSlotAvailability(userId: string, slot: Date, durationMin: number): Promise<{
  capacity: number;
  overlapping: number;
  isFree: boolean;
  nextAvailable: Date | null;
}> {
  const teamMembers = await storage.getTeamMembers(userId);
  const capacity = Math.max(1, teamMembers.filter(m => m.isActive).length);

  const jobs = await storage.getJobs(userId);
  const activeStatuses = new Set(['scheduled', 'in_progress', 'pending', 'booked']);
  const booked = jobs
    .filter(j => j.scheduledAt && activeStatuses.has(j.status))
    .map(j => {
      const start = new Date(j.scheduledAt as any).getTime();
      const dur = j.estimatedDuration && j.estimatedDuration > 0 ? j.estimatedDuration : 60;
      return { start, end: start + dur * 60000 };
    })
    .filter(b => !isNaN(b.start));

  const countOverlap = (startMs: number): number => {
    const endMs = startMs + durationMin * 60000;
    return booked.filter(b => startMs < b.end && b.start < endMs).length;
  };

  const overlapping = countOverlap(slot.getTime());
  const isFree = overlapping < capacity;

  let nextAvailable: Date | null = null;
  if (!isFree) {
    const candidate = new Date(slot);
    candidate.setMinutes(0, 0, 0);
    for (let step = 0; step < 200 && !nextAvailable; step++) {
      candidate.setHours(candidate.getHours() + 1);
      const h = candidate.getHours();
      if (h < 8 || h >= 17) continue; // only offer reasonable working hours
      if (countOverlap(candidate.getTime()) < capacity) {
        nextAvailable = new Date(candidate);
      }
    }
  }

  return { capacity, overlapping, isFree, nextAvailable };
}

function formatSlotForSpeech(d: Date, tz: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: 'numeric', minute: '2-digit', hour12: true,
  };
  try {
    return d.toLocaleString('en-AU', { ...opts, timeZone: tz });
  } catch {
    return d.toLocaleString('en-AU', opts);
  }
}

async function handleCheckAvailability(args: any, userId: string): Promise<any> {
  try {
    const settings = await storage.getBusinessSettings(userId);
    if (!settings) {
      return { result: 'I\'m not able to check availability right now. Someone from the team will get back to you.' };
    }

    const config = await storage.getAiReceptionistConfig(userId);
    const businessHours = (config?.businessHours || null) as BusinessHoursConfig | null;
    const status = getAvailabilityStatus(businessHours);

    const teamMembers = await storage.getTeamMembers(userId);
    const availableCount = teamMembers.filter(m => m.isActive && m.aiReceptionistAvailability).length;

    if (status.reason === 'holiday') {
      return { result: `We're closed for the public holiday today (${status.holidayLabel}). I'll take your details and someone will get back to you on the next business day.` };
    }

    if (status.reason === 'on_break') {
      return { result: `The team is currently on a break and will be back at ${status.breakEnd}. I'm happy to take your details and have someone call you back shortly.` };
    }

    if (status.reason === 'closed_day') {
      return { result: `The business doesn't operate today. I'll take your details and someone will get back to you on the next business day.` };
    }

    // If the caller named a specific date/time we can parse, answer about that
    // exact slot rather than just general business hours. Runs only after the
    // today-closure checks above so we never report a slot as open while the
    // business is closed.
    const requestedSlot = parsePreferredDateTime(args?.preferred_date, args?.preferred_time);
    if (requestedSlot) {
      const tz = settings.timezone || 'Australia/Sydney';
      const avail = await checkSlotAvailability(userId, requestedSlot, 60);
      const slotLabel = formatSlotForSpeech(requestedSlot, tz);
      if (avail.isFree) {
        return { result: `Yes, ${slotLabel} looks open. Would you like me to book that in for you?` };
      }
      if (avail.nextAvailable) {
        return { result: `Unfortunately ${slotLabel} is fully booked. The next available opening is ${formatSlotForSpeech(avail.nextAvailable, tz)}. Would that suit you?` };
      }
      return { result: `Unfortunately ${slotLabel} is fully booked. I can take your details and have the team find the next available time for you.` };
    }

    const hoursStr = status.todayHours || 'standard business hours';

    if (status.open && availableCount > 0) {
      return { result: `The team is currently available during business hours (${hoursStr}). ${availableCount} team member${availableCount > 1 ? 's are' : ' is'} available. Would you like me to transfer you or take a message?` };
    } else if (status.open) {
      return { result: `We're within business hours (${hoursStr}), but the team is currently busy. I can take your details and have someone call you back.` };
    } else {
      return { result: `We're currently outside business hours (${hoursStr}). I'll take your details and someone will get back to you during business hours.` };
    }
  } catch (error: unknown) {
    console.error('[Vapi] Check availability failed:', error);
    return { result: 'I\'m not able to check availability right now. I\'ll make sure someone gets back to you.' };
  }
}

async function handleLookupClient(args: any, userId: string): Promise<any> {
  try {
    const clients = await storage.getClients(userId);
    let match = null;

    if (args.phone) {
      const normalizedPhone = args.phone.replace(/\D/g, '');
      match = clients.find(c => {
        const clientPhone = (c.phone || '').replace(/\D/g, '');
        return clientPhone && (clientPhone === normalizedPhone || clientPhone.endsWith(normalizedPhone) || normalizedPhone.endsWith(clientPhone));
      });
    }

    if (!match && args.name) {
      const searchName = args.name.toLowerCase();
      match = clients.find(c => {
        const fullName = (c.name || '').toLowerCase().trim();
        return fullName.includes(searchName) || searchName.includes(fullName);
      });
    }

    if (match) {
      return {
        result: `I found the client: ${match.name || ''}. They're already in our system. I'll note this as a returning client.`,
        clientFound: true,
        clientName: (match.name || '').trim(),
      };
    }

    return {
      result: 'I wasn\'t able to find that in our records. No worries — I\'ll take your details as a new enquiry.',
      clientFound: false,
    };
  } catch (error: unknown) {
    console.error('[Vapi] Client lookup failed:', error);
    return { result: 'I\'ll take your details and the team can check our records.', clientFound: false };
  }
}

async function handleCreateBooking(args: any, userId: string, callId: string): Promise<any> {
  try {
    // Conservatively work out whether the caller's requested time is actually
    // open. We only enforce this when the date/time is confidently parseable;
    // otherwise we fall back to the original "tentative booking" wording.
    const requestedSlot = parsePreferredDateTime(args.preferred_date, args.preferred_time);
    let slotConflict: { nextAvailable: Date | null } | null = null;
    let slotConfirmedFree = false;
    let speechTz = 'Australia/Sydney';
    if (requestedSlot) {
      try {
        const settings = await storage.getBusinessSettings(userId);
        speechTz = settings?.timezone || 'Australia/Sydney';
        const avail = await checkSlotAvailability(userId, requestedSlot, 60);
        if (!avail.isFree) {
          slotConflict = { nextAvailable: avail.nextAvailable };
        } else {
          slotConfirmedFree = true;
        }
      } catch (e) {
        console.error('[Vapi] Slot availability check failed (continuing as tentative):', e);
      }
    }

    const lead = await storage.createLead({
      userId,
      name: args.caller_name || 'Unknown Caller',
      phone: args.caller_phone || null,
      email: null,
      source: 'ai_receptionist',
      status: 'new',
      description: `Booking request: ${args.job_type || 'Not specified'}${args.preferred_date ? ` for ${args.preferred_date}` : ''}${args.preferred_time ? ` (${args.preferred_time})` : ''}`,
      estimatedValue: null,
      notes: [
        args.job_type ? `Work type: ${args.job_type}` : null,
        args.address ? `Location: ${args.address}` : null,
        args.preferred_date ? `Preferred date: ${args.preferred_date}` : null,
        args.preferred_time ? `Preferred time: ${args.preferred_time}` : null,
        args.notes || null,
        `Source: AI Receptionist booking (${callId})`,
      ].filter(Boolean).join('\n'),
      followUpDate: args.preferred_date || null,
      wonLostReason: null,
    });

    await storage.updateAiReceptionistCall(callId, userId, {
      leadId: lead.id,
      callerName: args.caller_name || null,
      callerIntent: 'booking_request',
    });

    console.log(`[Vapi] Booking lead created: ${lead.id} for call ${callId}`);

    const ref = lead.id.slice(0, 8);
    const workLabel = args.job_type || 'the requested work';

    // Requested time is fully booked — be honest, offer the next opening, but
    // still keep the caller's details so we never lose the lead.
    if (slotConflict) {
      if (slotConflict.nextAvailable) {
        return {
          result: `That time is already fully booked, but the next available opening is ${formatSlotForSpeech(slotConflict.nextAvailable, speechTz)}. I've taken your details for ${workLabel} (reference ${ref}), and the team can confirm that time or find another that suits you.`,
        };
      }
      return {
        result: `That time looks fully booked. I've taken your details for ${workLabel} (reference ${ref}) and the team will call you to find a time that works.`,
      };
    }

    // Requested time is genuinely open — confirm it confidently.
    if (slotConfirmedFree && requestedSlot) {
      return {
        result: `Great news — ${formatSlotForSpeech(requestedSlot, speechTz)} is available, so I've booked you in for ${workLabel}. Reference: ${ref}. The team will confirm the final details with you.`,
      };
    }

    // Couldn't confidently parse the time — keep the original tentative wording.
    return {
      result: `I've created a tentative booking for ${workLabel}${args.preferred_date ? ` on ${args.preferred_date}` : ''}. Reference: ${ref}. Someone from the team will confirm the details with you.`,
    };
  } catch (error: unknown) {
    console.error('[Vapi] Create booking failed:', error);
    return { result: 'I\'ve noted your booking request. Someone from the team will call you to confirm.' };
  }
}

// Best-effort extraction of the real per-call response latency from a Vapi
// end-of-call-report payload. Tries several known fields first, then falls
// back to computing the average gap between the user finishing speaking and
// the assistant starting to reply across the message timeline.
//
// Returns null when no signal is available (very short calls, missing
// timestamps, voicemail-only, etc.) — the analytics endpoint treats null as
// "no measurement" rather than zero.
export function extractCallLatencyMs(message: any): number | null {
  if (!message || typeof message !== 'object') return null;
  const call = message.call || {};
  const analysis = message.analysis || call.analysis || {};

  const tryNumber = (v: any): number | null => {
    if (typeof v === 'number' && isFinite(v) && v > 0 && v < 60000) return Math.round(v);
    return null;
  };

  // 1) Direct fields Vapi has been observed to surface on the report or call.
  const direct =
    tryNumber(analysis.responseLatencyMs) ||
    tryNumber(analysis.latencyMs) ||
    tryNumber(analysis.averageLatencyMs) ||
    tryNumber((call as any).modelLatencyAverage) ||
    tryNumber((call as any).responseLatencyAverage) ||
    tryNumber((message as any).averageLatencyMs);
  if (direct) return direct;

  // 2) Compute from the messages timeline: for each bot/assistant message
  //    that immediately follows a user message, latency = bot.secondsFromStart
  //    - (user.secondsFromStart + user.duration). Average across the call.
  const messages: any[] = Array.isArray(message.messages)
    ? message.messages
    : Array.isArray(call.messages)
      ? call.messages
      : [];
  if (messages.length < 2) return null;

  const samples: number[] = [];
  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1];
    const curr = messages[i];
    const prevRole = (prev?.role || '').toLowerCase();
    const currRole = (curr?.role || '').toLowerCase();
    if (prevRole !== 'user' || (currRole !== 'bot' && currRole !== 'assistant')) continue;

    // Vapi exposes secondsFromStart (sec) and duration (ms). Guard everything.
    const prevStart = typeof prev.secondsFromStart === 'number' ? prev.secondsFromStart : null;
    const prevDurMs = typeof prev.duration === 'number' ? prev.duration : 0;
    const currStart = typeof curr.secondsFromStart === 'number' ? curr.secondsFromStart : null;
    if (prevStart === null || currStart === null) continue;

    const gapMs = (currStart - prevStart) * 1000 - prevDurMs;
    if (gapMs > 50 && gapMs < 15000) samples.push(gapMs);
  }
  if (samples.length === 0) return null;

  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  return Math.round(avg);
}

// Vapi has moved the call summary between payload shapes over time:
// older reports put it at message.summary, newer ones under
// message.analysis.summary (or call.analysis.summary). Try all known spots
// so notifications don't say "No summary available" for real calls.
export function extractCallSummary(message: any): string | null {
  if (!message || typeof message !== 'object') return null;
  const call = message.call || {};
  const candidates = [
    message.summary,
    message.analysis?.summary,
    call.analysis?.summary,
    call.summary,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim();
  }
  return null;
}

export async function processWebhookEvent(event: any): Promise<any> {
  const eventType = event.message?.type || event.type;
  console.log(`[Vapi Webhook] Event type: ${eventType}`);

  switch (eventType) {
    case 'status-update':
      return handleStatusUpdate(event);
    case 'end-of-call-report':
      return handleEndOfCallReport(event);
    case 'tool-calls':
      return handleToolCalls(event);
    case 'hang':
      return handleHang(event);
    default:
      console.log(`[Vapi Webhook] Unhandled event type: ${eventType}`);
      return { ok: true };
  }
}

async function handleStatusUpdate(event: any): Promise<any> {
  const call = event.message?.call || event.call;
  if (!call) return { ok: true };

  const assistantId = call.assistantId;
  if (!assistantId) return { ok: true };

  const result = await findBusinessAndConfigByVapiAssistant(assistantId);
  if (!result) {
    console.warn(`[Vapi Webhook] No business found for assistant ${assistantId}`);
    return { ok: true };
  }
  const { business, config: matchedConfig } = result;

  const status = event.message?.status || event.status;
  const callId = call.id;
  const calledNumber = call.phoneNumber?.number || matchedConfig?.dedicatedPhoneNumber || null;

  const existingCall = await storage.getAiReceptionistCallByVapiId(callId);

  if (!existingCall) {
    await storage.createAiReceptionistCall({
      userId: business.userId,
      vapiCallId: callId,
      callerPhone: call.customer?.number || null,
      status: status === 'in-progress' ? 'in_progress' : status || 'ringing',
      phoneNumberId: matchedConfig?.id || null,
      calledNumber,
    });
  } else {
    const mappedStatus = status === 'in-progress' ? 'in_progress' : status;
    await storage.updateAiReceptionistCall(existingCall.id, business.userId, {
      status: mappedStatus || existingCall.status,
      ...(matchedConfig?.id && !existingCall.phoneNumberId ? { phoneNumberId: matchedConfig.id } : {}),
      ...(calledNumber && !existingCall.calledNumber ? { calledNumber } : {}),
    });
  }

  return { ok: true };
}

async function handleEndOfCallReport(event: any): Promise<any> {
  const message = event.message || event;
  const call = message.call;
  if (!call) return { ok: true };

  const assistantId = call.assistantId;
  if (!assistantId) return { ok: true };

  const lookupResult = await findBusinessAndConfigByVapiAssistant(assistantId);
  if (!lookupResult) {
    console.log(`[Vapi Webhook] No business found for assistant ${assistantId} — treating as support line call`);
    await sendSupportLineNotifications(
      call.customer?.number || null,
      extractCallSummary(message),
      message.durationSeconds || call.duration || null,
    );
    return { ok: true };
  }
  const business = lookupResult.business;
  const matchedConfig = lookupResult.config;

  const callId = call.id;
  const existingCall = await storage.getAiReceptionistCallByVapiId(callId);

  const endedReason = message.endedReason || call.endedReason || null;
  const callOutcome = existingCall?.transferredTo ? 'transferred'
    : existingCall?.leadId ? 'booked'
    : endedReason === 'missed' || endedReason === 'no-answer' ? 'missed'
    : 'message_taken';

  const transcriptText = message.transcript || null;
  const summaryText = extractCallSummary(message);

  let sentimentResult = { sentiment: 'neutral' as string, sentimentScore: 0.5 };
  try {
    sentimentResult = await analyzeCallSentiment(transcriptText, summaryText);
    console.log(`[Vapi] Sentiment for call ${callId}: ${sentimentResult.sentiment} (${sentimentResult.sentimentScore})`);
  } catch (e: unknown) {
    console.error(`[Vapi] Sentiment analysis error for call ${callId}:`, getErrorMessage(e));
  }

  const measuredLatencyMs = extractCallLatencyMs(message);
  if (measuredLatencyMs !== null) {
    console.log(`[Vapi] Measured latency for call ${callId}: ${measuredLatencyMs}ms`);
  }

  const updates: Partial<InsertAiReceptionistCall> = {
    status: 'completed',
    duration: message.durationSeconds || call.duration || null,
    summary: summaryText,
    transcript: transcriptText,
    recordingUrl: message.recordingUrl || call.recordingUrl || null,
    endedReason,
    cost: message.cost ? String(message.cost) : null,
    outcome: callOutcome,
    sentiment: sentimentResult.sentiment,
    sentimentScore: sentimentResult.sentimentScore,
    latencyMs: measuredLatencyMs,
  };

  let callRecord: any;
  if (existingCall) {
    if (matchedConfig?.id && !existingCall.phoneNumberId) {
      (updates as any).phoneNumberId = matchedConfig.id;
    }
    const ecrCalledNumber = call.phoneNumber?.number || matchedConfig?.dedicatedPhoneNumber || null;
    if (ecrCalledNumber && !existingCall.calledNumber) {
      (updates as any).calledNumber = ecrCalledNumber;
    }
    await storage.updateAiReceptionistCall(existingCall.id, business.userId, updates);
    callRecord = existingCall;
  } else {
    const calledNumber = call.phoneNumber?.number || matchedConfig?.dedicatedPhoneNumber || null;
    const createPayload: InsertAiReceptionistCall = {
      userId: business.userId,
      vapiCallId: callId,
      callerPhone: call.customer?.number || null,
      status: updates.status || 'completed',
      duration: updates.duration || null,
      summary: updates.summary || null,
      transcript: updates.transcript || null,
      recordingUrl: updates.recordingUrl || null,
      endedReason: updates.endedReason || null,
      cost: updates.cost || null,
      outcome: updates.outcome || null,
      sentiment: updates.sentiment || null,
      sentimentScore: updates.sentimentScore ?? null,
      latencyMs: updates.latencyMs ?? null,
      phoneNumberId: matchedConfig?.id || null,
      calledNumber,
    };
    callRecord = await storage.createAiReceptionistCall(createPayload);
  }

  const hasLead = callRecord?.leadId || existingCall?.leadId;
  if (!hasLead && call.customer?.number) {
    try {
      const callerPhone = call.customer.number;

      const recentLeads = await storage.getLeadsByUserAndPhone(business.userId, callerPhone);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentDuplicate = recentLeads?.find(l => l.createdAt && new Date(l.createdAt) > oneHourAgo);
      if (recentDuplicate) {
        const recordId = existingCall?.id || callRecord?.id;
        if (recordId) {
          await storage.updateAiReceptionistCall(recordId, business.userId, { leadId: recentDuplicate.id });
        }
        console.log(`[Vapi] End-of-call: linked to existing lead ${recentDuplicate.id} (spam protection)`);
      } else {
      const lead = await storage.createLead({
        userId: business.userId,
        name: existingCall?.callerName || 'Caller',
        phone: callerPhone,
        email: null,
        source: 'ai_receptionist',
        status: 'new',
        description: summaryText || 'AI Receptionist call — no lead was explicitly captured during the call',
        estimatedValue: null,
        notes: `Auto-created from AI Receptionist call ${callId}\nDuration: ${updates.duration || 0}s`,
        followUpDate: null,
        wonLostReason: null,
      });

      const recordId = existingCall?.id || callRecord?.id;
      if (recordId) {
        await storage.updateAiReceptionistCall(recordId, business.userId, { leadId: lead.id });
      }
      console.log(`[Vapi] Auto-created lead ${lead.id} for call ${callId}`);
      }
    } catch (e: unknown) {
      console.error(`[Vapi] Failed to auto-create lead for call ${callId}:`, getErrorMessage(e));
    }
  }

  await sendCallNotifications(business, callId, call.customer?.number, summaryText, updates.duration as number | null);

  const callDuration = (updates.duration as number | null) || 0;
  if (callDuration > 10 && call.customer?.number && business.dedicatedPhoneNumber) {
    await sendCallerAutoReply(business, call.customer.number);
  }

  await sendCallPushNotification(
    business.userId,
    existingCall?.callerName || 'Unknown caller',
    call.customer?.number || null,
    callRecord?.callerIntent || existingCall?.callerIntent || null,
    summaryText,
    callDuration,
  );

  console.log(`[Vapi Webhook] Call ${callId} completed - duration: ${updates.duration}s`);
  return { ok: true };
}

async function sendCallerAutoReply(
  business: BusinessSettings,
  callerPhone: string,
): Promise<void> {
  try {
    const config = await storage.getAiReceptionistConfig(business.userId);
    if (!config || !config.autoReplyEnabled) {
      console.log(`[Vapi] Auto-reply disabled for user ${business.userId}, skipping caller SMS`);
      return;
    }

    if (!business.dedicatedPhoneNumber) {
      console.log(`[Vapi] No dedicated number for user ${business.userId}, skipping auto-reply SMS`);
      return;
    }

    const businessName = business.businessName || 'the business';
    const template = config.autoReplyMessage ||
      'Thanks for calling {{business_name}}. We got your message and will get back to you shortly. — Sent via JobRunner';
    const smsBody = template.replace(/\{\{business_name\}\}/g, businessName);

    await sendSMS({
      to: callerPhone,
      message: smsBody,
      fromNumber: business.dedicatedPhoneNumber,
    });
    console.log(`[Vapi] Auto-reply SMS sent to caller ${callerPhone} from ${business.dedicatedPhoneNumber}`);
  } catch (e: unknown) {
    console.error(`[Vapi] Auto-reply SMS failed for caller ${callerPhone}:`, getErrorMessage(e));
  }
}

async function sendCallPushNotification(
  userId: string,
  callerName: string | null,
  callerPhone: string | null,
  callerIntent: string | null,
  summary: string | null,
  duration: number,
): Promise<void> {
  if (duration <= 10) return;
  try {
    const { sendPushNotification } = await import('./pushNotifications');

    const name = callerName || callerPhone || 'Unknown caller';
    const intentLabel = callerIntent
      ? callerIntent.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : null;
    const summarySnippet = summary ? summary.slice(0, 120) : 'No summary available';

    let body = `${name}`;
    if (intentLabel) body += ` — ${intentLabel}`;
    body += `. ${summarySnippet}`;

    // callerName and callerIntent arrive from external LLM / webhook data and
    // are not bounded upstream. Clamp the assembled body to the APNS best-practice
    // per-field limit so the push gateway never silently truncates it.
    const MAX_PUSH_BODY = 240;
    if (body.length > MAX_PUSH_BODY) {
      body = body.slice(0, MAX_PUSH_BODY - 1) + '\u2026';
    }

    // All three dynamic data fields arrive from untrusted external sources
    // (Vapi webhook / LLM tool arguments / unrestricted DB columns). Clamp each
    // one before embedding it in `data` so the full on-wire Expo/APNS JSON
    // payload (body + data + metadata) stays inside the 4 KB gateway limit.
    const MAX_INTENT_CHARS = 200;
    const safeIntent =
      callerIntent && callerIntent.length > MAX_INTENT_CHARS
        ? callerIntent.slice(0, MAX_INTENT_CHARS - 1) + '\u2026'
        : callerIntent;

    // E.164 phone numbers are ≤ 15 digits plus a leading '+', but the value
    // arrives verbatim from the Vapi webhook and could be arbitrarily large.
    const MAX_PHONE_CHARS = 20;
    const safePhone =
      callerPhone && callerPhone.length > MAX_PHONE_CHARS
        ? callerPhone.slice(0, MAX_PHONE_CHARS)
        : callerPhone;

    await sendPushNotification({
      userId,
      type: 'ai_receptionist_call',
      title: 'AI Receptionist Call',
      body,
      data: { callerPhone: safePhone, callerIntent: safeIntent, relatedType: 'ai_call' },
      skipInAppNotification: true,
    });
    console.log(`[Vapi] Push notification sent to tradie ${userId} for AI call`);
  } catch (e: unknown) {
    console.error(`[Vapi] Push notification failed for user ${userId}:`, getErrorMessage(e));
  }
}

async function sendCallNotifications(
  business: BusinessSettings,
  callId: string,
  callerPhone: string | null,
  summary: string | null,
  duration: number | null,
): Promise<void> {
  try {
    const userId = business.userId;
    const callerDisplay = callerPhone || 'Unknown number';
    const summaryText = summary || 'No summary available';
    const durationText = duration ? `${Math.ceil(duration / 60)} min` : 'Unknown';

    try {
      const notificationPayload: InsertNotification = {
        userId,
        type: 'ai_receptionist_call',
        title: `New AI Receptionist Call`,
        message: `Call from ${callerDisplay} (${durationText}). ${summaryText.slice(0, 200)}`,
        relatedId: callId,
        relatedType: 'ai_receptionist_call',
      };
      await storage.createNotification(notificationPayload);
      console.log(`[Vapi] In-app notification created for user ${userId}`);
    } catch (e: unknown) {
      console.error(`[Vapi] In-app notification failed:`, getErrorMessage(e));
    }

    const config = await storage.getAiReceptionistConfig(userId);
    if (config?.smsNotifications) {
      const smsBody = `AI Receptionist: ${callerDisplay} called (${durationText}).\n\n${summaryText.slice(0, 200)}\n\nOpen JobRunner to review.`;

      const fromNumber = business.dedicatedPhoneNumber || undefined;
      const notifiedNumbers = new Set<string>();

      const transferNumbers = (config.transferNumbers || []) as TransferNumber[];
      for (const contact of transferNumbers) {
        if (contact.phone && !notifiedNumbers.has(contact.phone)) {
          notifiedNumbers.add(contact.phone);
          try {
            await sendSMS({ to: contact.phone, message: smsBody, fromNumber });
            console.log(`[Vapi] SMS sent to ${contact.name} (${contact.phone})`);
          } catch (e: unknown) {
            console.error(`[Vapi] SMS send failed for ${contact.phone}:`, getErrorMessage(e));
          }
        }
      }

      try {
        const user = await storage.getUser(userId);
        if (user?.phone && !notifiedNumbers.has(user.phone)) {
          await sendSMS({ to: user.phone, message: smsBody, fromNumber });
          console.log(`[Vapi] SMS sent to owner ${user.phone}`);
        }
      } catch (e: unknown) {
        console.error(`[Vapi] Owner SMS send failed:`, getErrorMessage(e));
      }
    }
  } catch (e: unknown) {
    console.error(`[Vapi] sendCallNotifications error:`, getErrorMessage(e));
  }
}

async function sendSupportLineNotifications(
  callerPhone: string | null,
  summary: string | null,
  duration: number | null,
): Promise<void> {
  const adminPhone = process.env.ADMIN_PHONE;
  if (!adminPhone) {
    console.warn('[Vapi] No ADMIN_PHONE configured — skipping support line SMS notification');
    return;
  }

  try {
    const callerDisplay = callerPhone || 'Unknown number';
    const summaryText = summary || 'No summary available';
    const durationText = duration ? `${Math.ceil(duration / 60)} min` : 'Unknown';

    const smsBody = `JobRunner Support Line\nCaller: ${callerDisplay}\nDuration: ${durationText}\n\n${summaryText.slice(0, 200)}\n\nOpen JobRunner to review.`;

    await sendSMS({ to: adminPhone, message: smsBody });
    console.log(`[Vapi] Support line SMS sent to admin ${adminPhone}`);
  } catch (e: unknown) {
    console.error(`[Vapi] Support line SMS failed:`, getErrorMessage(e));
  }
}

async function handleToolCalls(event: any): Promise<any> {
  const message = event.message || event;
  const call = message.call;
  const toolCalls = message.toolCallList || message.toolCalls || [];

  // Helper: build a synthetic "ok" response per tool-call so VAPI never sees
  // an empty/failed result — even if our backend has a problem, the assistant
  // can keep the conversation going gracefully.
  const fallbackResults = (msg: string) => toolCalls.map((tc: any) => ({
    toolCallId: tc.id,
    result: msg,
  }));

  try {
    if (!call) return { results: fallbackResults("I've noted that. One moment.") };

    const assistantId = call.assistantId;
    if (!assistantId) return { results: fallbackResults("I've noted that. One moment.") };

    const lookupResult = await findBusinessAndConfigByVapiAssistant(assistantId);
    if (!lookupResult) {
      console.warn(`[Vapi Webhook] No business found for assistant ${assistantId} during tool-call — returning soft-success`);
      return { results: fallbackResults("I've taken note of that. Someone from the team will follow up.") };
    }
    const { business, config: matchedConfig } = lookupResult;

    let existingCall = await storage.getAiReceptionistCallByVapiId(call.id);
    if (!existingCall) {
      try {
        const calledNumber = call.phoneNumber?.number || matchedConfig?.dedicatedPhoneNumber || null;
        existingCall = await storage.createAiReceptionistCall({
          userId: business.userId,
          vapiCallId: call.id,
          callerPhone: call.customer?.number || null,
          status: 'in_progress',
          phoneNumberId: matchedConfig?.id || null,
          calledNumber,
        });
      } catch (createErr: unknown) {
        console.error('[Vapi Webhook] Failed to create AI receptionist call record for %s:', call.id, getErrorMessage(createErr) || createErr);
      }
    }

    const results: Array<{ toolCallId: string; result: string }> = [];
    const callerPhone = call.customer?.number || existingCall?.callerPhone || undefined;

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function?.name || toolCall.name;
      let toolArgs: Record<string, unknown> = {};
      try {
        toolArgs = toolCall.function?.arguments
          ? (typeof toolCall.function.arguments === 'string' ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments)
          : toolCall.arguments || {};
      } catch (parseErr) {
        console.error('[Vapi Webhook] Failed to parse tool args for %s:', toolName, parseErr);
      }

      let result: any;
      try {
        result = await handleToolCall(
          toolName,
          toolArgs,
          business.userId,
          existingCall?.id || call.id,
          callerPhone,
        );
      } catch (toolErr: unknown) {
        console.error('[Vapi Webhook] Tool "%s" threw — returning soft-success to caller:', toolName, getErrorMessage(toolErr) || toolErr);
        result = { result: "I've noted that down. Someone from the team will be in touch." };
      }

      results.push({
        toolCallId: toolCall.id,
        result: typeof result === 'string' ? result : (result?.result ?? JSON.stringify(result)),
      });
    }

    return { results };
  } catch (outerErr: unknown) {
    console.error('[Vapi Webhook] handleToolCalls outer failure — returning soft-success:', getErrorMessage(outerErr) || outerErr);
    return { results: fallbackResults("I've noted that. Someone from the team will follow up shortly.") };
  }
}

async function handleHang(event: any): Promise<any> {
  const call = event.message?.call || event.call;
  if (!call) return { ok: true };

  const assistantId = call.assistantId;
  if (!assistantId) return { ok: true };

  const lookupResult = await findBusinessAndConfigByVapiAssistant(assistantId);
  if (!lookupResult) return { ok: true };
  const { business } = lookupResult;

  const existingCall = await storage.getAiReceptionistCallByVapiId(call.id);
  if (existingCall) {
    await storage.updateAiReceptionistCall(existingCall.id, business.userId, {
      status: existingCall.duration ? 'completed' : 'missed',
      endedReason: 'caller_hangup',
    });
  }

  return { ok: true };
}

export function buildWebsiteChatSystemPrompt(config: {
  businessName: string;
  tradeType?: string;
  greeting?: string;
  knowledgeBank?: {
    faqs?: Array<{ question: string; answer: string }>;
    serviceDescriptions?: string;
    pricingInfo?: string;
    specialInstructions?: string;
  };
  services?: string[];
}): string {
  const businessName = config.businessName || 'the business';
  const tradeType = config.tradeType || 'trades';

  const servicesSection = config.services && config.services.length > 0
    ? `\nServices offered: ${config.services.join(', ')}`
    : '';

  let knowledgeBankSection = '';
  if (config.knowledgeBank) {
    const kb = config.knowledgeBank;
    const parts: string[] = [];
    if (kb.serviceDescriptions) {
      parts.push(`Service descriptions: ${kb.serviceDescriptions}`);
    }
    if (kb.pricingInfo) {
      parts.push(`Pricing information: ${kb.pricingInfo}`);
    }
    if (kb.specialInstructions) {
      parts.push(`Special instructions: ${kb.specialInstructions}`);
    }
    if (kb.faqs && kb.faqs.length > 0) {
      const faqText = kb.faqs
        .filter(f => f.question && f.answer)
        .map(f => `Q: ${f.question}\nA: ${f.answer}`)
        .join('\n\n');
      if (faqText) {
        parts.push(`Frequently Asked Questions:\n${faqText}`);
      }
    }
    if (parts.length > 0) {
      knowledgeBankSection = `\n\nBusiness Knowledge Base:\n${parts.join('\n\n')}`;
    }
  }

  const greeting = config.greeting || `G'day! Thanks for visiting ${businessName}. How can I help you today?`;

  return `You are a friendly, professional AI assistant for ${businessName}, an Australian ${tradeType} business. You are embedded as a live chat widget on the business website.
${servicesSection}

Your role:
- Help website visitors with questions about the business, services, and availability
- Collect the visitor's name, phone number, and reason for contacting as naturally as possible
- Determine the nature of the enquiry (quote request, job enquiry, follow-up, complaint, or general enquiry)
- For quote/job requests, ask about the type of work needed, the location/suburb, and urgency
- Encourage visitors to leave their contact details so the team can follow up

Important guidelines:
- Start with: "${greeting}"
- Be conversational and natural — avoid sounding robotic
- Use Australian English (favour, colour, organise)
- Keep responses concise and suitable for chat (2-4 sentences max)
- If the visitor asks for a quote, gather: type of work, location/suburb, preferred timing, and any specific requirements
- Never make commitments about pricing, availability, or scheduling — say "I'll make sure the team gets back to you"
- If the visitor provides their name and phone number, confirm you've noted their details
- Be proactive about collecting contact information when the visitor shows interest in a service

When you detect that you have collected the visitor's name and/or phone number, include a JSON block at the end of your message in the following format (the visitor will not see this):
<!--LEAD_DATA:{"name":"Visitor Name","phone":"0412345678","intent":"description of what they need","jobType":"type of work"}-->
${knowledgeBankSection}`;
}
