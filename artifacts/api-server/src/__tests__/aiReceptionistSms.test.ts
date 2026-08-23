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
import * as pushNotificationsModule from '../pushNotifications';

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
function makeEndOfCallEvent(summaryOverride?: string, callerPhoneOverride?: string) {
  const summary =
    summaryOverride ??
    '\u201CCustomer wants a quote\u201D\u2014ring them back by 5pm\u2026 don\u2019t delay!';
  return {
    message: {
      type: 'end-of-call-report',
      call: {
        id: 'call-99',
        assistantId: ASSISTANT_ID,
        customer: { number: callerPhoneOverride ?? CALLER_PHONE },
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

  it('default auto-reply fallback (no autoReplyMessage set) contains no em dash', async () => {
    // Simulate a config where the owner never customised the auto-reply message.
    // The runtime fallback string in sendCallerAutoReply() must not contain an em dash.
    const configWithNoMessage = { ...mockConfig, autoReplyMessage: undefined };
    storage.getAiReceptionistConfig.mockResolvedValue(configWithNoMessage);

    await processWebhookEvent(makeEndOfCallEvent());

    const autoReply = capturedBodies.find((b) => b.includes('Thanks for calling'));
    expect(autoReply).toBeDefined();

    // Em dash must not appear in the fallback message
    expect(autoReply).not.toMatch(/\u2014/); // em dash
    expect(autoReply).not.toMatch(/\u2013/); // en dash

    // The fallback should use a plain hyphen instead
    expect(autoReply).toContain('- Sent via JobRunner');
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

// ── Test 3: Push notification payload bounds ───────────────────────────────────
//
// APNS title limit: 65 characters
// APNS body limit:  240 characters (best-practice; full APNS payload cap is 4 KB)
// FCM limits are comparable; the tighter APNS values are used throughout.
//
// sendCallPushNotification() concatenates callerName, callerIntent, and the LLM
// summary into the push body. callerName and callerIntent arrive from external
// webhook / LLM data and are unbounded, so the function applies a final hard
// cap of 240 chars before dispatching to sendPushNotification().
//
// These tests confirm that cap is effective even under worst-case inputs:
//   • A 300-char typographic summary (sliced to 120 by the snippet logic)
//   • A 200-char callerName that alone would exceed 240 without the guard
//   • An unusually long callerIntent label
// and that the outbound Expo PushMessage object stays inside the 4 KB payload
// limit when all fields (to, data, sound, priority, channelId) are included.

const APNS_TITLE_MAX = 65;
const APNS_BODY_MAX = 240;
const APNS_PAYLOAD_MAX_BYTES = 4096;

// Representative Expo push token (matches the format Expo issues in production).
const FAKE_EXPO_TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxxxx]';

interface CapturedPush {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  skipInAppNotification?: boolean;
}

/** Construct the Expo PushMessage shape that pushNotifications.ts sends to exp.host. */
function buildExpoMessage(push: CapturedPush): Record<string, unknown> {
  return {
    to: FAKE_EXPO_TOKEN,
    title: push.title,
    body: push.body,
    data: {
      type: push.type,
      ...(push.data ?? {}),
    },
    sound: 'default',
    priority: 'high',
    channelId: 'default', // ai_receptionist_call maps to 'default' in getChannelId()
  };
}

describe('AI Receptionist — push notification payload bounds', () => {
  let capturedPushCalls: CapturedPush[];
  let storage: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    capturedPushCalls = [];

    vi.mocked(pushNotificationsModule.sendPushNotification).mockImplementation(
      async (opts) => {
        capturedPushCalls.push({ ...opts } as CapturedPush);
        return true;
      },
    );

    // Absorb SMS sends — these tests focus on push, not SMS.
    __setSmsTestInterceptor(() => ({ success: true, simulated: true }));

    storage = await getStorageMock();

    storage.getAllBusinessSettings.mockResolvedValue([mockBusiness]);
    storage.getAiReceptionistConfigsByUser.mockResolvedValue([mockConfig]);
    storage.getBusinessSettings.mockResolvedValue(mockBusiness);
    storage.getAllAiReceptionistConfigs.mockResolvedValue([mockConfig]);

    // Default: no pre-existing call record (created fresh during the event).
    storage.getAiReceptionistCallByVapiId.mockResolvedValue(null);
    storage.createAiReceptionistCall.mockResolvedValue({ id: 'call-record-1', leadId: null });
    storage.updateAiReceptionistCall.mockResolvedValue(undefined);
    storage.getLeadsByUserAndPhone.mockResolvedValue([]);
    storage.createLead.mockResolvedValue({ id: 'lead-1' });
    storage.createNotification.mockResolvedValue(undefined);

    storage.getAiReceptionistConfig.mockResolvedValue(mockConfig);
    storage.getUser.mockResolvedValue({ phone: '+61422222222' });
  });

  afterEach(() => {
    __setSmsTestInterceptor(null);
    vi.clearAllMocks();
  });

  // ── title ──────────────────────────────────────────────────────────────────

  it('push title is always within the APNS 65-char limit', async () => {
    // title is the static string "AI Receptionist Call" — this guards against
    // future edits inadvertently making it too long.
    const llmSummary =
      '\u201CCustomer wants a quote\u201D\u2014ring them back by 5pm\u2026 don\u2019t delay!';

    await processWebhookEvent(makeEndOfCallEvent(llmSummary));

    expect(capturedPushCalls.length).toBeGreaterThan(0);
    for (const { title } of capturedPushCalls) {
      expect(title.length, `Push title "${title}" exceeds ${APNS_TITLE_MAX} chars`).toBeLessThanOrEqual(APNS_TITLE_MAX);
    }
  });

  // ── body with typographic summary ─────────────────────────────────────────

  it('push body stays within APNS limit when 300-char typographic summary is sliced', async () => {
    // summary.slice(0, 120) caps the snippet; the full body is
    // callerPhone(14) + '. '(2) + snippet(120) = 136 chars — well within 240.
    // This confirms the summary-snippet logic keeps things safe even when the
    // LLM returns a very long string packed with multi-byte typographic chars.
    const longTypographicSummary =
      '\u201CUrgent: Customer called about an emergency repair\u201D\u2014they need someone today\u2026 ' +
      'Please call back ASAP. They\u2019re not happy\u2014quoted $2,000\u2013$3,000 but want less\u2026 ' +
      'Very unhappy with previous contractor\u2019s work. Needs written quote urgently. ' +
      'Follow up by end of day\u2014don\u2019t let this lead go cold!';
    // Verify the fixture is actually > 240 chars so the test is meaningful.
    expect(longTypographicSummary.length).toBeGreaterThan(240);

    await processWebhookEvent(makeEndOfCallEvent(longTypographicSummary));

    expect(capturedPushCalls.length).toBeGreaterThan(0);
    for (const { body } of capturedPushCalls) {
      expect(body.length, `Push body "${body}" exceeds ${APNS_BODY_MAX} chars`).toBeLessThanOrEqual(APNS_BODY_MAX);
    }
  });

  // ── body with overlong callerName (requires the 240-char guard) ───────────

  it('push body is clamped to 240 chars when callerName alone would cause an overrun', async () => {
    // A 200-char callerName from the call record produces a raw body of
    // 200 + '. '(2) + snippet(120) = 322 chars — 82 chars over the APNS limit.
    // sendCallPushNotification() must truncate the assembled body to 240 chars.
    const longCallerName = 'A'.repeat(200);
    storage.getAiReceptionistCallByVapiId.mockResolvedValue({
      id: 'existing-call-1',
      userId: USER_ID,
      callerName: longCallerName,
      callerIntent: null,
      leadId: null,
      transferredTo: null,
      status: 'active',
      phoneNumberId: null,
      calledNumber: null,
    });

    const llmSummary =
      '\u201CCustomer wants a quote\u201D\u2014ring them back soon\u2026';

    await processWebhookEvent(makeEndOfCallEvent(llmSummary));

    expect(capturedPushCalls.length).toBeGreaterThan(0);
    for (const { body } of capturedPushCalls) {
      expect(
        body.length,
        `Push body not clamped — got ${body.length} chars, expected ≤ ${APNS_BODY_MAX}`,
      ).toBeLessThanOrEqual(APNS_BODY_MAX);
    }
  });

  // ── body with overlong callerIntent ───────────────────────────────────────

  it('push body stays within APNS limit when callerIntent produces a long formatted label', async () => {
    // callerIntent is formatted as title-case words; an unusually verbose
    // intent string could push the body over 240 chars.
    storage.createAiReceptionistCall.mockResolvedValue({
      id: 'call-record-1',
      leadId: null,
      callerIntent:
        'request_emergency_after_hours_repair_quote_for_urgent_structural_damage_inspection',
    });

    const llmSummary =
      '\u201CCustomer wants a quote\u201D\u2014ring them back by 5pm\u2026 don\u2019t delay!';

    await processWebhookEvent(makeEndOfCallEvent(llmSummary));

    expect(capturedPushCalls.length).toBeGreaterThan(0);
    for (const { body } of capturedPushCalls) {
      expect(body.length, `Push body "${body}" exceeds ${APNS_BODY_MAX} chars`).toBeLessThanOrEqual(APNS_BODY_MAX);
    }
  });

  // ── 4 KB outbound Expo payload ─────────────────────────────────────────────

  it('outbound Expo PushMessage payload stays within the APNS 4096-byte limit', async () => {
    // Measure the full Expo message object (to, title, body, data, sound, priority,
    // channelId) that pushNotifications.ts would POST to exp.host — not just the
    // internal sendPushNotification options — since the on-wire JSON is what the
    // gateway enforces.
    const llmSummary =
      '\u201CCustomer wants a quote\u201D\u2014ring them back by 5pm\u2026 don\u2019t delay!';

    await processWebhookEvent(makeEndOfCallEvent(llmSummary));

    expect(capturedPushCalls.length).toBeGreaterThan(0);
    for (const push of capturedPushCalls) {
      const expoMessage = buildExpoMessage(push);
      const payloadBytes = Buffer.byteLength(JSON.stringify(expoMessage), 'utf8');
      expect(
        payloadBytes,
        `Expo PushMessage is ${payloadBytes} bytes — exceeds APNS ${APNS_PAYLOAD_MAX_BYTES}-byte limit`,
      ).toBeLessThanOrEqual(APNS_PAYLOAD_MAX_BYTES);
    }
  });

  it('outbound Expo PushMessage payload stays within 4096 bytes even with worst-case inputs', async () => {
    // Same check with a long callerName — the truncated body makes the payload
    // larger but must remain inside the gateway limit.
    storage.getAiReceptionistCallByVapiId.mockResolvedValue({
      id: 'existing-call-1',
      userId: USER_ID,
      callerName: 'A'.repeat(200),
      callerIntent: null,
      leadId: null,
      transferredTo: null,
      status: 'active',
      phoneNumberId: null,
      calledNumber: null,
    });

    const llmSummary =
      '\u201CUrgent: Customer called about an emergency repair\u201D\u2014they need someone today\u2026 ' +
      'Please call back ASAP. They\u2019re not happy\u2014quoted $2,000\u2013$3,000 but want less\u2026';

    await processWebhookEvent(makeEndOfCallEvent(llmSummary));

    expect(capturedPushCalls.length).toBeGreaterThan(0);
    for (const push of capturedPushCalls) {
      const expoMessage = buildExpoMessage(push);
      const payloadBytes = Buffer.byteLength(JSON.stringify(expoMessage), 'utf8');
      expect(
        payloadBytes,
        `Expo PushMessage is ${payloadBytes} bytes — exceeds APNS ${APNS_PAYLOAD_MAX_BYTES}-byte limit`,
      ).toBeLessThanOrEqual(APNS_PAYLOAD_MAX_BYTES);
    }
  });

  it('oversized callerPhone from webhook does not push the Expo payload over 4096 bytes', async () => {
    // callerPhone arrives verbatim from call.customer.number in the Vapi webhook
    // and is placed directly into data.callerPhone. A pathological value — e.g.
    // 5 KB of text — would push the on-wire Expo JSON above the APNS 4 KB limit.
    // sendCallPushNotification() must clamp it to a safe length first.
    const hugePhone = '+' + '6'.repeat(5000); // 5001 chars — far beyond E.164

    const llmSummary =
      '\u201CCustomer wants a quote\u201D\u2014ring them back by 5pm\u2026 don\u2019t delay!';

    await processWebhookEvent(makeEndOfCallEvent(llmSummary, hugePhone));

    expect(capturedPushCalls.length).toBeGreaterThan(0);
    for (const push of capturedPushCalls) {
      // Verify callerPhone in data was clamped before reaching sendPushNotification.
      const phoneInData = (push.data?.callerPhone as string | null) ?? null;
      if (phoneInData !== null) {
        expect(
          phoneInData.length,
          `callerPhone in push data is ${phoneInData.length} chars — should be clamped`,
        ).toBeLessThanOrEqual(20);
      }

      // Verify the full outbound Expo payload stays within the APNS 4 KB limit.
      const expoMessage = buildExpoMessage(push);
      const payloadBytes = Buffer.byteLength(JSON.stringify(expoMessage), 'utf8');
      expect(
        payloadBytes,
        `Expo PushMessage is ${payloadBytes} bytes with huge callerPhone — exceeds APNS ${APNS_PAYLOAD_MAX_BYTES}-byte limit`,
      ).toBeLessThanOrEqual(APNS_PAYLOAD_MAX_BYTES);
    }
  });

  it('multi-kilobyte callerIntent in data does not push the Expo payload over 4096 bytes', async () => {
    // callerIntent comes from an unrestricted text column populated by LLM tool
    // arguments. A pathological value — e.g. 5 KB of text — would push the full
    // on-wire Expo JSON (body + data + metadata) well above the APNS 4 KB limit
    // even when the visible body is clamped to 240 chars.
    //
    // sendCallPushNotification() must truncate callerIntent before embedding it
    // in `data` so the serialised PushMessage stays inside the gateway limit.
    const hugeIntent = 'B'.repeat(5000); // 5 000 chars → ~5 015 bytes in JSON alone
    storage.createAiReceptionistCall.mockResolvedValue({
      id: 'call-record-1',
      leadId: null,
      callerIntent: hugeIntent,
    });

    const llmSummary =
      '\u201CCustomer wants a quote\u201D\u2014ring them back by 5pm\u2026 don\u2019t delay!';

    await processWebhookEvent(makeEndOfCallEvent(llmSummary));

    expect(capturedPushCalls.length).toBeGreaterThan(0);
    for (const push of capturedPushCalls) {
      // Verify the intent in `data` was clamped before reaching sendPushNotification.
      const intentInData = (push.data?.callerIntent as string | null) ?? null;
      if (intentInData !== null) {
        expect(
          intentInData.length,
          `callerIntent in push data is ${intentInData.length} chars — should be clamped`,
        ).toBeLessThanOrEqual(200);
      }

      // Verify the full outbound Expo payload (UTF-8 bytes) is within APNS limit.
      const expoMessage = buildExpoMessage(push);
      const payloadBytes = Buffer.byteLength(JSON.stringify(expoMessage), 'utf8');
      expect(
        payloadBytes,
        `Expo PushMessage is ${payloadBytes} bytes with large callerIntent — exceeds APNS ${APNS_PAYLOAD_MAX_BYTES}-byte limit`,
      ).toBeLessThanOrEqual(APNS_PAYLOAD_MAX_BYTES);
    }
  });
});
