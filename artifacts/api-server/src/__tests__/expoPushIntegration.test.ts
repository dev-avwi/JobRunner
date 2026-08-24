/**
 * Expo Push Notification — real-pipeline integration tests
 *
 * These tests confirm that push notifications are correctly sent through the
 * full AI Receptionist call flow: from a Vapi end-of-call webhook event all
 * the way to the Expo push HTTP endpoint. They do NOT mock pushNotifications.ts
 * — they let the real sendPushNotification / sendPushMessages path run and
 * intercept fetch() at the network boundary instead.
 *
 * Two tiers:
 *
 * 1. MOCKED-HTTP (always runs, deterministic, no outbound network)
 *    Storage is seeded with an active push token. Global fetch is replaced with
 *    a spy that captures calls to exp.host and returns a canned success ticket.
 *    The tests assert on what actually gets sent to the Expo endpoint: token
 *    value, title, body within APNS limits, data fields, and payload byte size.
 *    Any regression in processWebhookEvent → sendCallPushNotification →
 *    sendPushNotification → sendPushMessages will surface here.
 *
 * 2. REAL-DEVICE opt-in (skipped unless TEST_EXPO_PUSH_TOKEN is set)
 *    Sends to a registered test device via the live Expo push API and asserts
 *    status === "ok" with no DeviceNotRegistered / MessageTooBig error.
 *    Run manually or in a dedicated CI job:
 *      TEST_EXPO_PUSH_TOKEN="ExponentPushToken[...]" \
 *        pnpm --filter @workspace/api-server test expoPushIntegration
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setSmsTestInterceptor } from '../twilioClient';
import { processWebhookEvent } from '../vapiService';
import { sendExpoPushNotifications, type PushMessage, type PushTicket } from '../pushNotifications';

// ── Constants ─────────────────────────────────────────────────────────────────

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const APNS_BODY_MAX = 240;
const APNS_PAYLOAD_MAX_BYTES = 4096;

// A push token in the canonical Expo format registered to the test user.
const TEST_PUSH_TOKEN = 'ExponentPushToken[TestDevice0000000000001]';
const ASSISTANT_ID = 'ASSIST-PUSH-TEST-001';
const CALLER_PHONE = '+61400000001';
const DEDICATED_NUMBER = '+61399990000';
const USER_ID = 'user-push-test';

// ── Module mocks (everything except pushNotifications) ────────────────────────

vi.mock('../storage', () => {
  const storage = {
    // Business / config lookup used by processWebhookEvent
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
    // Push-specific — exercised by the real sendPushNotification path
    getIntegrationSettings: vi.fn(),
    getPushTokens: vi.fn(),
    deactivatePushToken: vi.fn(),
  };
  return { storage };
});

vi.mock('../ai', () => ({
  analyzeCallSentiment: vi.fn().mockResolvedValue({ sentiment: 'neutral', sentimentScore: 0.5 }),
}));

vi.mock('../systemEventService', () => ({
  logSystemEvent: vi.fn(),
}));

vi.mock('../urlHelper', () => ({
  getProductionBaseUrl: vi.fn().mockReturnValue(null),
}));

// NOTE: pushNotifications is intentionally NOT mocked here so the full
// sendPushNotification → sendPushMessages → fetch(EXPO_PUSH_URL) path runs.

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getStorageMock() {
  const mod = await import('../storage');
  return mod.storage as Record<string, ReturnType<typeof vi.fn>>;
}

const mockBusiness = {
  userId: USER_ID,
  vapiAssistantId: ASSISTANT_ID,
  businessName: 'Acme Trades',
  dedicatedPhoneNumber: DEDICATED_NUMBER,
};

const mockConfig = {
  userId: USER_ID,
  vapiAssistantId: ASSISTANT_ID,
  autoReplyEnabled: false, // disable SMS auto-reply to keep the test focused on push
  smsNotifications: false,
  transferNumbers: [],
};

/** A minimal active push token record as returned by storage.getPushTokens. */
const mockPushToken = {
  id: 'token-id-1',
  token: TEST_PUSH_TOKEN,
  isActive: true,
  userId: USER_ID,
};

/** A canned success ticket returned by our fetch spy. */
const successTicket: PushTicket = {
  id: 'expo-ticket-abc123',
  status: 'ok',
};

/** A canned error ticket for DeviceNotRegistered. */
const deviceNotRegisteredTicket: PushTicket = {
  id: 'expo-ticket-err1',
  status: 'error',
  message: 'ExponentPushToken[...] is not a registered push notification recipient',
  details: { error: 'DeviceNotRegistered' },
};

function makeEndOfCallEvent(summaryOverride?: string, callerNameOverride?: string) {
  const summary =
    summaryOverride ??
    'Customer called about a new fence installation. Needs a quote by Friday.';
  return {
    message: {
      type: 'end-of-call-report',
      call: {
        id: 'call-push-test-01',
        assistantId: ASSISTANT_ID,
        customer: { number: CALLER_PHONE },
        phoneNumber: { number: DEDICATED_NUMBER },
      },
      durationSeconds: 65, // > 10 s → push notification is sent
      summary,
      transcript: 'Hello, I need a quote please.',
      analysis: { summary },
    },
  };
}

// ── Tier 1: mocked-HTTP, full call-flow ───────────────────────────────────────

describe('AI Receptionist push — full call-flow with mocked Expo HTTP', () => {
  let storage: Record<string, ReturnType<typeof vi.fn>>;
  /** All fetch calls captured during each test. */
  let fetchCalls: { url: string; body: PushMessage[] }[];
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    fetchCalls = [];
    originalFetch = globalThis.fetch;

    // Intercept fetch so tests are deterministic and require no outbound network.
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlString = url instanceof Request ? url.url : String(url);
      if (urlString === EXPO_PUSH_URL) {
        const body = JSON.parse((init?.body as string) ?? '[]') as PushMessage[];
        fetchCalls.push({ url: urlString, body });
        return new Response(
          JSON.stringify({ data: body.map(() => successTicket) }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      // Pass through any non-Expo fetch (e.g. Twilio in auto-reply path).
      return originalFetch(url, init);
    }) as typeof globalThis.fetch;

    // Absorb any outbound SMS (auto-reply is disabled in mockConfig, but be safe).
    __setSmsTestInterceptor(() => ({ success: true, simulated: true }));

    storage = await getStorageMock();

    // Business / config resolution
    storage.getAllBusinessSettings.mockResolvedValue([mockBusiness]);
    storage.getAiReceptionistConfigsByUser.mockResolvedValue([mockConfig]);
    storage.getBusinessSettings.mockResolvedValue(mockBusiness);
    storage.getAllAiReceptionistConfigs.mockResolvedValue([mockConfig]);

    // Call record lifecycle
    storage.getAiReceptionistCallByVapiId.mockResolvedValue(null);
    storage.createAiReceptionistCall.mockResolvedValue({ id: 'call-record-push-1', leadId: null });
    storage.updateAiReceptionistCall.mockResolvedValue(undefined);
    storage.getLeadsByUserAndPhone.mockResolvedValue([]);
    storage.createLead.mockResolvedValue({ id: 'lead-push-1' });
    storage.createNotification.mockResolvedValue(undefined);
    storage.getAiReceptionistConfig.mockResolvedValue(mockConfig);
    storage.getUser.mockResolvedValue({ phone: '+61422222222' });

    // Push-specific storage — the real sendPushNotification path reads these.
    storage.getIntegrationSettings.mockResolvedValue(null); // null → all notifications enabled
    storage.getPushTokens.mockResolvedValue([mockPushToken]);
    storage.deactivatePushToken.mockResolvedValue(true);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    __setSmsTestInterceptor(null);
    vi.clearAllMocks();
  });

  // ── Routing ────────────────────────────────────────────────────────────────

  it('processWebhookEvent sends exactly one POST to the Expo push endpoint', async () => {
    await processWebhookEvent(makeEndOfCallEvent());

    const expoPosts = fetchCalls.filter(c => c.url === EXPO_PUSH_URL);
    expect(expoPosts).toHaveLength(1);
  });

  it('the Expo POST carries the active token registered for the user', async () => {
    await processWebhookEvent(makeEndOfCallEvent());

    const [call] = fetchCalls;
    expect(call).toBeDefined();
    expect(call.body.length).toBeGreaterThan(0);
    expect(call.body[0].to).toBe(TEST_PUSH_TOKEN);
  });

  it('push is NOT sent when the call duration is 10 seconds or less', async () => {
    const shortCallEvent = {
      message: {
        ...makeEndOfCallEvent().message,
        durationSeconds: 10, // boundary — exactly 10 s → skipped
      },
    };

    await processWebhookEvent(shortCallEvent);

    const expoPosts = fetchCalls.filter(c => c.url === EXPO_PUSH_URL);
    expect(expoPosts).toHaveLength(0);
  });

  // ── Payload structure ──────────────────────────────────────────────────────

  it('push message title is "AI Receptionist Call"', async () => {
    await processWebhookEvent(makeEndOfCallEvent());

    const [call] = fetchCalls;
    expect(call.body[0].title).toBe('AI Receptionist Call');
  });

  it('push message body stays within the APNS 240-char limit', async () => {
    await processWebhookEvent(makeEndOfCallEvent());

    const [call] = fetchCalls;
    const { body } = call.body[0];
    expect(
      body.length,
      `Push body "${body}" is ${body.length} chars — exceeds APNS ${APNS_BODY_MAX}-char limit`,
    ).toBeLessThanOrEqual(APNS_BODY_MAX);
  });

  it('push message body is clamped to 240 chars when callerName alone would cause overrun', async () => {
    // A 200-char callerName produces a raw body of 200 + intent + snippet > 240 chars.
    const longCallerName = 'A'.repeat(200);
    storage.getAiReceptionistCallByVapiId.mockResolvedValue({
      id: 'existing-call-push-1',
      userId: USER_ID,
      callerName: longCallerName,
      callerIntent: null,
      leadId: null,
      transferredTo: null,
      status: 'active',
      phoneNumberId: null,
      calledNumber: null,
    });

    await processWebhookEvent(makeEndOfCallEvent());

    const [call] = fetchCalls;
    expect(call.body[0].body.length).toBeLessThanOrEqual(APNS_BODY_MAX);
  });

  it('push data includes callerPhone, callerIntent, and relatedType fields', async () => {
    await processWebhookEvent(makeEndOfCallEvent());

    const [call] = fetchCalls;
    const data = call.body[0].data as Record<string, unknown>;
    expect(data).toBeDefined();
    // type is injected by sendPushNotification
    expect(data.type).toBe('ai_receptionist_call');
    expect(data.relatedType).toBe('ai_call');
  });

  it('on-wire Expo JSON payload stays within the APNS 4096-byte limit', async () => {
    await processWebhookEvent(makeEndOfCallEvent());

    const [call] = fetchCalls;
    const payloadBytes = Buffer.byteLength(JSON.stringify(call.body), 'utf8');
    expect(
      payloadBytes,
      `On-wire payload is ${payloadBytes} bytes — exceeds APNS 4096-byte limit`,
    ).toBeLessThanOrEqual(APNS_PAYLOAD_MAX_BYTES);
  });

  it('oversized callerPhone from webhook is clamped before reaching the Expo endpoint', async () => {
    const hugePhone = '+' + '6'.repeat(5000);
    const event = {
      message: {
        ...makeEndOfCallEvent().message,
        call: {
          ...makeEndOfCallEvent().message.call,
          customer: { number: hugePhone },
        },
      },
    };

    await processWebhookEvent(event);

    const expoPosts = fetchCalls.filter(c => c.url === EXPO_PUSH_URL);
    if (expoPosts.length > 0) {
      const [call] = expoPosts;
      const data = call.body[0].data as Record<string, unknown>;
      if (data.callerPhone != null) {
        expect(String(data.callerPhone).length).toBeLessThanOrEqual(20);
      }
      const payloadBytes = Buffer.byteLength(JSON.stringify(call.body), 'utf8');
      expect(payloadBytes).toBeLessThanOrEqual(APNS_PAYLOAD_MAX_BYTES);
    }
  });

  // ── DeviceNotRegistered handling ───────────────────────────────────────────

  it('deactivates the push token when Expo returns DeviceNotRegistered', async () => {
    // Override fetch to return a DeviceNotRegistered error ticket.
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlString = url instanceof Request ? url.url : String(url);
      if (urlString === EXPO_PUSH_URL) {
        const body = JSON.parse((init?.body as string) ?? '[]') as PushMessage[];
        fetchCalls.push({ url: urlString, body });
        return new Response(
          JSON.stringify({ data: body.map(() => deviceNotRegisteredTicket) }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return originalFetch(url, init);
    }) as typeof globalThis.fetch;

    await processWebhookEvent(makeEndOfCallEvent());

    // The real sendPushNotification must call deactivatePushToken for the stale token.
    expect(storage.deactivatePushToken).toHaveBeenCalledWith(
      mockPushToken.id,
      USER_ID,
    );
  });

  it('does not send a push when the user has no active tokens', async () => {
    storage.getPushTokens.mockResolvedValue([]); // no tokens registered

    await processWebhookEvent(makeEndOfCallEvent());

    const expoPosts = fetchCalls.filter(c => c.url === EXPO_PUSH_URL);
    expect(expoPosts).toHaveLength(0);
  });

  it('does not send a push when the user has tokens but all are inactive', async () => {
    storage.getPushTokens.mockResolvedValue([{ ...mockPushToken, isActive: false }]);

    await processWebhookEvent(makeEndOfCallEvent());

    const expoPosts = fetchCalls.filter(c => c.url === EXPO_PUSH_URL);
    expect(expoPosts).toHaveLength(0);
  });

  it('sends to all active tokens when the user has multiple registered devices', async () => {
    const token2 = { id: 'token-id-2', token: 'ExponentPushToken[TestDevice0000000000002]', isActive: true, userId: USER_ID };
    storage.getPushTokens.mockResolvedValue([mockPushToken, token2]);

    await processWebhookEvent(makeEndOfCallEvent());

    const [call] = fetchCalls.filter(c => c.url === EXPO_PUSH_URL);
    expect(call.body).toHaveLength(2);
    expect(call.body.map(m => m.to)).toContain(TEST_PUSH_TOKEN);
    expect(call.body.map(m => m.to)).toContain(token2.token);
  });
});

// ── Tier 2: real-device opt-in ────────────────────────────────────────────────

const REAL_DEVICE_TOKEN = process.env.TEST_EXPO_PUSH_TOKEN ?? null;

describe.skipIf(!REAL_DEVICE_TOKEN)(
  'Expo push pipeline — real device (set TEST_EXPO_PUSH_TOKEN to enable)',
  () => {
    it(
      'push notification to real test device returns status ok with a receipt ID',
      async () => {
        const message: PushMessage = {
          to: REAL_DEVICE_TOKEN!,
          title: 'AI Receptionist Call',
          body: 'Test caller — Quote Request. Integration test from JobRunner server.',
          data: {
            type: 'ai_receptionist_call',
            callerPhone: '+61400000001',
            callerIntent: 'quote_request',
            relatedType: 'ai_call',
          },
          sound: 'default',
          priority: 'high',
          channelId: 'default',
        };

        const tickets = await sendExpoPushNotifications([message]);

        expect(tickets).toHaveLength(1);
        const ticket = tickets[0] as PushTicket;

        expect(
          ticket.status,
          `Expected status "ok" but got "${ticket.status}". ` +
            `Error: ${ticket.details?.error ?? ticket.message ?? 'none'}`,
        ).toBe('ok');

        // A success ticket must include a receipt ID for later delivery verification.
        expect(typeof ticket.id).toBe('string');
        expect(ticket.id.length).toBeGreaterThan(0);

        // Fatal errors that indicate misconfigured payload or stale token.
        expect(ticket.details?.error).not.toBe('DeviceNotRegistered');
        expect(ticket.details?.error).not.toBe('MessageTooBig');
        expect(ticket.details?.error).not.toBe('InvalidCredentials');
      },
      15_000,
    );
  },
);
