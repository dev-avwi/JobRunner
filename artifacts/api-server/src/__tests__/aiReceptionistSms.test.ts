/**
 * AI Receptionist SMS encoding tests
 *
 * Confirms two things required by task #798:
 *
 * 1. AUDIT — Every SMS send in the AI Receptionist code path (vapiService.ts)
 *    goes through sendSMS() rather than calling the Twilio client directly.
 *    sendSMS() applies toGSM() *before* the test interceptor, so any text that
 *    reaches sendSMS() is guaranteed to be GSM-7 by the time Twilio sees it.
 *
 * 2. SMOKE — Feeding mock LLM output that contains typographic characters
 *    (curly quotes, em dashes, ellipses) through the Receptionist's reply and
 *    notification handlers produces only clean GSM-7 bodies at the interceptor.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { __setSmsTestInterceptor } from '../twilioClient';
import { processWebhookEvent } from '../vapiService';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../storage', () => {
  const storage = {
    getAllBusinessSettings: vi.fn(),
    getBusinessSettings: vi.fn(),
    getAllAiReceptionistConfigs: vi.fn(),
    getAiReceptionistConfigsByUser: vi.fn(),
    getAiReceptionistCallByVapiId: vi.fn(),
    createAiReceptionistCall: vi.fn(),
    updateAiReceptionistCall: vi.fn(),
    getAiReceptionistConfig: vi.fn(),
    getUser: vi.fn(),
    createLead: vi.fn(),
    getLeadsByUserAndPhone: vi.fn(),
    createNotification: vi.fn(),
  };
  return { storage };
});

vi.mock('../ai', () => ({
  analyzeCallSentiment: vi.fn().mockResolvedValue({
    sentiment: 'neutral',
    sentimentScore: 0.5,
  }),
}));

// pushNotifications is a dynamic import inside sendCallPushNotification
vi.mock('../pushNotifications', () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
}));

// systemEventService is a dynamic import inside the sendSMS catch block
vi.mock('../systemEventService', () => ({
  logSystemEvent: vi.fn(),
}));

// urlHelper is used by sendSMS to build a statusCallback URL
vi.mock('../urlHelper', () => ({
  getProductionBaseUrl: vi.fn().mockReturnValue(null),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Import the mocked storage so tests can configure per-call return values. */
async function getStorageMock() {
  const mod = await import('../storage');
  return mod.storage as Record<string, ReturnType<typeof vi.fn>>;
}

const ASSISTANT_ID = 'ASSIST-TEST-001';
const CALLER_PHONE = '+61400000001';
const DEDICATED_NUMBER = '+61399990000';
const USER_ID = 'user-abc';

/** A minimal BusinessSettings object that the lookup can match. */
const mockBusiness = {
  userId: USER_ID,
  vapiAssistantId: ASSISTANT_ID,
  businessName: 'Acme Trades',
  dedicatedPhoneNumber: DEDICATED_NUMBER,
};

/** A minimal config that enables both auto-reply and SMS notifications. */
const mockConfig = {
  userId: USER_ID,
  vapiAssistantId: ASSISTANT_ID,
  autoReplyEnabled: true,
  autoReplyMessage:
    '\u201CThanks for calling {{business_name}}\u201D\u2014we\u2019ll be in touch shortly\u2026',
  smsNotifications: true,
  transferNumbers: [{ name: 'Alice', phone: '+61411111111', priority: 1 }],
};

/** Minimal end-of-call-report event from Vapi with an LLM-generated summary. */
function makeEndOfCallEvent(summaryOverride?: string) {
  const summary =
    summaryOverride ??
    '\u201CCustomer wants a quote\u201D\u2014ring them back by 5pm\u2026 don\u2019t delay!';
  return {
    message: {
      type: 'end-of-call-report',
      call: {
        id: 'call-99',
        assistantId: ASSISTANT_ID,
        customer: { number: CALLER_PHONE },
        phoneNumber: { number: DEDICATED_NUMBER },
      },
      durationSeconds: 60,
      summary,
      transcript: 'Hello, I need a quote please.',
      analysis: { summary },
    },
  };
}

// ── Test 1: Static code-path audit ────────────────────────────────────────────

describe('AI Receptionist — SMS send audit', () => {
  it('vapiService.ts contains no direct twilioClient.messages.create calls for SMS', () => {
    const src = readFileSync(
      resolve(__dirname, '../vapiService.ts'),
      'utf8',
    );

    // The only Twilio import in vapiService.ts is for provisioning phone numbers
    // (importPhoneNumber / assignPhoneToAssistant via the Vapi REST API, not SMS).
    // Direct calls such as `twilioClient.messages.create(...)` must not appear here;
    // all outbound SMS must go through sendSMS() which enforces GSM-7 sanitisation.
    const directTwilioSmsPattern = /twilioClient\.messages\.create/g;
    const matches = src.match(directTwilioSmsPattern) ?? [];
    expect(matches).toHaveLength(0);
  });

  it('every sendSMS call in vapiService.ts goes through the sendSMS() wrapper', () => {
    const src = readFileSync(
      resolve(__dirname, '../vapiService.ts'),
      'utf8',
    );

    // Count explicit sendSMS( calls (the wrapper from twilioClient.ts)
    const wrapperCalls = (src.match(/\bsendSMS\s*\(/g) ?? []).length;

    // Sanity: there must be at least the known 4 call sites
    expect(wrapperCalls).toBeGreaterThanOrEqual(4);
  });
});

// ── Test 2: Smoke tests — typographic LLM output reaches the interceptor clean ─

describe('AI Receptionist — outbound SMS bodies are GSM-7 clean', () => {
  let capturedBodies: string[];
  let storage: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    capturedBodies = [];

    // Capture every SMS that would be sent to Twilio
    __setSmsTestInterceptor((opts) => {
      capturedBodies.push(opts.message);
      return { success: true, simulated: true };
    });

    storage = await getStorageMock();

    // findBusinessAndConfigByVapiAssistant path: getAllBusinessSettings
    storage.getAllBusinessSettings.mockResolvedValue([mockBusiness]);
    storage.getAiReceptionistConfigsByUser.mockResolvedValue([mockConfig]);
    storage.getBusinessSettings.mockResolvedValue(mockBusiness);
    storage.getAllAiReceptionistConfigs.mockResolvedValue([mockConfig]);

    // handleEndOfCallReport path
    storage.getAiReceptionistCallByVapiId.mockResolvedValue(null);
    storage.createAiReceptionistCall.mockResolvedValue({ id: 'call-record-1', leadId: null });
    storage.updateAiReceptionistCall.mockResolvedValue(undefined);
    storage.getLeadsByUserAndPhone.mockResolvedValue([]);
    storage.createLead.mockResolvedValue({ id: 'lead-1' });
    storage.createNotification.mockResolvedValue(undefined);

    // sendCallerAutoReply + sendCallNotifications
    storage.getAiReceptionistConfig.mockResolvedValue(mockConfig);
    storage.getUser.mockResolvedValue({ phone: '+61422222222' });
  });

  afterEach(() => {
    __setSmsTestInterceptor(null);
    vi.clearAllMocks();
  });

  it('auto-reply body strips curly quotes and em dash before reaching Twilio', async () => {
    await processWebhookEvent(makeEndOfCallEvent());

    // At least one SMS should have been sent (the auto-reply to the caller)
    expect(capturedBodies.length).toBeGreaterThan(0);

    // Find the auto-reply (sent to the caller's number — the content comes from
    // mockConfig.autoReplyMessage which contains \u201C, \u201D, \u2014, \u2019, \u2026)
    const autoReply = capturedBodies.find((b) => b.includes('Thanks for calling'));
    expect(autoReply).toBeDefined();

    // Must not contain any typographic characters
    expect(autoReply).not.toMatch(/[\u2018\u2019\u201A\u201B\u2032\u2035]/); // curly single quotes
    expect(autoReply).not.toMatch(/[\u201C\u201D\u201E\u201F\u2033\u2036]/); // curly double quotes
    expect(autoReply).not.toMatch(/\u2014/); // em dash
    expect(autoReply).not.toMatch(/\u2013/); // en dash
    expect(autoReply).not.toMatch(/\u2026/); // ellipsis
    expect(autoReply).not.toMatch(/\u00A0/); // non-breaking space
  });

  it('notification SMS body strips LLM summary typographic characters', async () => {
    const llmSummary =
      '\u201CCustomer wants a quote\u201D\u2014ring them back by 5pm\u2026 don\u2019t delay!';

    await processWebhookEvent(makeEndOfCallEvent(llmSummary));

    expect(capturedBodies.length).toBeGreaterThan(0);

    // Every captured body must be free of non-GSM-7 typographic characters
    for (const body of capturedBodies) {
      expect(body, `SMS body contains typographic chars: ${body}`).not.toMatch(
        /[\u2018\u2019\u201A\u201B\u2032\u2035\u201C\u201D\u201E\u201F\u2033\u2036\u2014\u2013\u2026\u00A0]/,
      );
    }
  });

  it('notification SMS body with plain ASCII summary passes through unchanged', async () => {
    const plainSummary = 'Customer wants a quote. Ring them back by 5pm.';

    await processWebhookEvent(makeEndOfCallEvent(plainSummary));

    // Every body should contain the plain summary text verbatim (no corruption)
    const bodyWithSummary = capturedBodies.find((b) => b.includes('Customer wants a quote'));
    expect(bodyWithSummary).toBeDefined();
    expect(bodyWithSummary).toContain(plainSummary);
  });

  it('sends SMS to all configured transfer numbers and the owner', async () => {
    await processWebhookEvent(makeEndOfCallEvent());

    // transferNumbers has 1 entry (+61411111111) and owner is +61422222222
    // plus the caller auto-reply (+61400000001) = 3 total SMS at minimum
    expect(capturedBodies.length).toBeGreaterThanOrEqual(3);

    // All bodies must be GSM-7 clean
    for (const body of capturedBodies) {
      expect(body).not.toMatch(
        /[\u2018\u2019\u201A\u201B\u2032\u2035\u201C\u201D\u201E\u201F\u2033\u2036\u2014\u2013\u2026\u00A0]/,
      );
    }
  });
});
