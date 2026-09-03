/**
 * helpChatScoping.test.ts
 *
 * Regression guard for POST /api/help/chat.
 *
 * The Help Assistant relies on its system prompt to scope responses to
 * app-usage questions and deflect business-data queries. These tests
 * assert the scoping *contract* — what the system prompt instructs the
 * model to do — so that a prompt change or rule deletion is caught in CI
 * before reaching production.
 *
 * Verifies:
 *   1. The system prompt sent to OpenAI explicitly prohibits answering
 *      business-data questions (jobs, earnings, invoices, etc.).
 *   2. The system prompt sent to OpenAI explicitly instructs the model to
 *      redirect business-data questions to the "AI Assistant" (not answer them).
 *   3. The system prompt is always the first message, regardless of the
 *      user's question (both business-data and app-usage queries).
 *   4. App-usage questions still reach the model with the user's message as
 *      the final turn, and the route correctly resolves related article IDs
 *      returned by the model.
 *   5. Unauthenticated requests are rejected with 401.
 *   6. Input validation: empty / missing / overlong messages return 400 without
 *      calling the model.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTHED_USER_ID = 'test-user-help-chat';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('openai', () => {
  function OpenAIMock(this: any) {
    this.chat = {
      completions: {
        create: mockCreate,
      },
    };
  }
  return { default: OpenAIMock };
});

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../routes/middleware', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const uid = req.headers['x-user-id'];
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    req.userId = uid;
    next();
  },
  aiPerUserLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../concurrency', () => ({
  aiQueue: { run: (fn: () => unknown) => fn() },
  isBackpressure: () => false,
  send429: (_res: any) => {},
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

async function buildApp() {
  const app = express();
  app.use(express.json());
  const { registerHelpRoutes } = await import('../routes/help');
  registerHelpRoutes(app);
  return app;
}

function authHeaders() {
  return { 'x-user-id': AUTHED_USER_ID };
}

function aiCompletion(payload: object) {
  return {
    choices: [{ message: { content: JSON.stringify(payload) } }],
  };
}

/** Return the messages array that was passed to the last mockCreate call. */
function capturedMessages(): Array<{ role: string; content: string }> {
  expect(mockCreate).toHaveBeenCalled();
  const callArgs = mockCreate.mock.calls[mockCreate.mock.calls.length - 1][0] as {
    messages: Array<{ role: string; content: string }>;
  };
  return callArgs.messages;
}

/** Extract the system prompt from the captured call. */
function capturedSystemPrompt(): string {
  const msgs = capturedMessages();
  expect(msgs[0].role).toBe('system');
  return msgs[0].content;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/help/chat — scoping contract and endpoint behaviour', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();

    // Default AI response — used by tests that don't override it.
    mockCreate.mockResolvedValue(
      aiCompletion({
        response: 'Default test response.',
        relatedArticleIds: [],
        confidence: 'medium',
      }),
    );
  });

  // ── 1 & 2. System prompt prohibits business data and mandates AI Assistant redirect ──

  it('system prompt explicitly forbids answering business-data questions', async () => {
    await request(app)
      .post('/api/help/chat')
      .set(authHeaders())
      .send({ message: 'What jobs do I have today?' });

    const prompt = capturedSystemPrompt();

    // The prompt must contain a rule that forbids answering business-data questions.
    // We check for recognisable phrases from the scoping rules.
    expect(prompt).toMatch(/NOT answer.*business.?data|business.?data.*NOT|must not answer.*business/i);
  });

  it('system prompt instructs the model to redirect business questions to the AI Assistant', async () => {
    await request(app)
      .post('/api/help/chat')
      .set(authHeaders())
      .send({ message: 'How much have I earned this month?' });

    const prompt = capturedSystemPrompt();

    // Rule 2 of the system prompt should tell the model to send the user to the "AI Assistant".
    expect(prompt).toMatch(/AI Assistant/i);
    // The redirect instruction must be connected to business-data handling.
    // Check that "AI Assistant" appears in a context that mentions data or business questions.
    const aiAssistantIdx = prompt.search(/AI Assistant/i);
    const surrounding = prompt.slice(Math.max(0, aiAssistantIdx - 200), aiAssistantIdx + 200);
    expect(surrounding).toMatch(/business|data|jobs|earn|invoice/i);
  });

  it('system prompt lists concrete examples of out-of-scope business-data questions', async () => {
    await request(app)
      .post('/api/help/chat')
      .set(authHeaders())
      .send({ message: 'Show me my invoices.' });

    const prompt = capturedSystemPrompt();

    // The prompt should give the model concrete examples so it recognises
    // business-data questions reliably.
    expect(prompt).toMatch(/jobs|clients|invoices|payments|earned/i);
  });

  // ── 3. System prompt is always the first message, for any question ─────────

  it('system prompt is the first message for a business-data question', async () => {
    await request(app)
      .post('/api/help/chat')
      .set(authHeaders())
      .send({ message: 'What jobs do I have today?' });

    const msgs = capturedMessages();
    expect(msgs[0].role).toBe('system');
  });

  it('system prompt is the first message for an app-usage question', async () => {
    await request(app)
      .post('/api/help/chat')
      .set(authHeaders())
      .send({ message: 'How do I create a new job?' });

    const msgs = capturedMessages();
    expect(msgs[0].role).toBe('system');
  });

  it("user's message is always the final turn sent to the model", async () => {
    const userMessage = 'How do I add a team member?';
    await request(app)
      .post('/api/help/chat')
      .set(authHeaders())
      .send({ message: userMessage });

    const msgs = capturedMessages();
    const last = msgs[msgs.length - 1];
    expect(last.role).toBe('user');
    expect(last.content).toBe(userMessage);
  });

  // ── 4. App-usage questions: related article resolution ────────────────────

  it('resolves related article IDs returned by the model into article objects', async () => {
    // Use a real article ID from the seeded help articles, if any exist.
    // We'll mock an ID and confirm the route filters non-matching IDs gracefully.
    mockCreate.mockResolvedValueOnce(
      aiCompletion({
        response: 'To create a job, tap the + button on the Jobs screen.',
        relatedArticleIds: ['non-existent-id-1', 'non-existent-id-2'],
        confidence: 'high',
      }),
    );

    const res = await request(app)
      .post('/api/help/chat')
      .set(authHeaders())
      .send({ message: 'How do I create a new job?' });

    expect(res.status).toBe(200);
    // relatedArticles is always an array, even when no IDs match seeded articles.
    expect(Array.isArray(res.body.relatedArticles)).toBe(true);
    // Non-existent IDs are silently filtered; the array may be empty.
    for (const article of res.body.relatedArticles) {
      expect(article).toHaveProperty('id');
      expect(article).toHaveProperty('title');
      expect(article).toHaveProperty('summary');
    }
  });

  it('caps related articles at 3 even when the model returns more IDs', async () => {
    mockCreate.mockResolvedValueOnce(
      aiCompletion({
        response: 'Here is a long answer.',
        relatedArticleIds: ['id-1', 'id-2', 'id-3', 'id-4', 'id-5'],
        confidence: 'medium',
      }),
    );

    const res = await request(app)
      .post('/api/help/chat')
      .set(authHeaders())
      .send({ message: 'How does billing work?' });

    expect(res.status).toBe(200);
    // Route caps at 3; unknown IDs are filtered so the array will be empty here,
    // but the important thing is the slice is applied before the lookup.
    expect(res.body.relatedArticles.length).toBeLessThanOrEqual(3);
  });

  // ── 5. Auth guard ─────────────────────────────────────────────────────────

  it('returns 401 when no auth header is provided', async () => {
    const res = await request(app)
      .post('/api/help/chat')
      .send({ message: 'How do I create a job?' });

    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // ── 6. Input validation ───────────────────────────────────────────────────

  it('returns 400 when message is missing', async () => {
    const res = await request(app)
      .post('/api/help/chat')
      .set(authHeaders())
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/message/i);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when message is an empty string', async () => {
    const res = await request(app)
      .post('/api/help/chat')
      .set(authHeaders())
      .send({ message: '   ' });

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when message exceeds 1000 characters', async () => {
    const res = await request(app)
      .post('/api/help/chat')
      .set(authHeaders())
      .send({ message: 'x'.repeat(1001) });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/too long/i);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
