/**
 * portalVerifyCodeConcurrency.test.ts
 *
 * Regression guard for the brute-force hardening applied to
 * POST /api/portal/verify-code (task 1172).
 *
 * The route's security relies on two atomic storage operations:
 *
 *   claimVerificationAttempt(phone, maxAttempts)
 *     — single UPDATE WHERE attempts < max RETURNING, so concurrent wrong
 *       guesses each decrement the budget without a read-then-check race.
 *
 *   consumeVerificationCode(id, code)
 *     — single UPDATE WHERE verified = false RETURNING, so only one of many
 *       concurrent correct submissions wins and gets a session.
 *
 * We spin up a minimal Express server that re-implements only the
 * verify-code handler logic (no legacyRoutes dep graph), backed by a
 * controllable mock storage, and fire concurrent requests to exercise
 * the two critical races.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { randomBytes, timingSafeEqual } from 'crypto';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PHONE       = '+61407000111';
const CORRECT     = '482916';
const WRONG       = '000000';
const MAX_ATTEMPTS = 5;
const RECORD_ID   = 'rec-abc-123';

// ---------------------------------------------------------------------------
// Atomic storage mock helpers
//
// These simulate the DB semantics we rely on:
//   claimVerificationAttempt — increments an in-memory counter; returns the
//     record only when the pre-increment count was < MAX.
//   consumeVerificationCode  — flips a consumed flag atomically; only the
//     first caller wins.
// ---------------------------------------------------------------------------

function makeMockStorage(storedCode: string = CORRECT) {
  let attempts = 0;
  let consumed = false;
  const sessions: string[] = [];

  return {
    _attempts: () => attempts,
    _sessions: () => sessions,

    formatPhone: (p: string) => p,

    /** Simulates the atomic DB UPDATE … WHERE attempts < MAX RETURNING */
    claimVerificationAttempt: vi.fn(async (_phone: string, max: number) => {
      // Simulate DB atomicity: increment first, then check
      const prev = attempts;
      if (prev >= max) return undefined;
      attempts += 1;
      return { id: RECORD_ID, phone: PHONE, code: storedCode, attempts, verified: false, expiresAt: new Date(Date.now() + 600_000), createdAt: new Date() };
    }),

    /** Simulates the atomic DB UPDATE … WHERE verified = false RETURNING */
    consumeVerificationCode: vi.fn(async (id: string, code: string) => {
      if (id !== RECORD_ID || code !== storedCode || consumed) return undefined;
      consumed = true;
      return { id, phone: PHONE, code, verified: true, attempts, expiresAt: new Date(Date.now() + 600_000), createdAt: new Date() };
    }),

    getActivePortalVerificationCodeByPhone: vi.fn(async () =>
      ({ id: RECORD_ID, phone: PHONE, code: storedCode, attempts, verified: false, expiresAt: new Date(Date.now() + 600_000), createdAt: new Date() })
    ),

    createPortalSession: vi.fn(async (_phone: string, token: string) => {
      sessions.push(token);
      return { id: 'sess-1', phone: PHONE, sessionToken: token, expiresAt: new Date(Date.now() + 86_400_000) };
    }),
  };
}

// ---------------------------------------------------------------------------
// Minimal test app — mirrors the verify-code handler logic exactly
// ---------------------------------------------------------------------------

function buildApp(storage: ReturnType<typeof makeMockStorage>) {
  const app = express();
  app.use(express.json());

  app.post('/api/portal/verify-code', async (req, res) => {
    try {
      const { phone, code } = req.body ?? {};
      if (!phone || typeof phone !== 'string') return res.status(400).json({ error: 'Phone number is required' });
      if (!code  || typeof code  !== 'string') return res.status(400).json({ error: 'Code is required' });

      const normalizedPhone = storage.formatPhone(phone);

      const claimed = await storage.claimVerificationAttempt(normalizedPhone, MAX_ATTEMPTS);
      if (!claimed) {
        const existing = await storage.getActivePortalVerificationCodeByPhone(normalizedPhone);
        if (existing) return res.status(429).json({ error: 'Too many attempts. Please request a new code.' });
        return res.status(400).json({ error: 'Invalid or expired code' });
      }

      const suppliedCode = code.trim();
      const storedCode   = claimed.code;
      const codesMatch   =
        suppliedCode.length === storedCode.length &&
        timingSafeEqual(Buffer.from(suppliedCode), Buffer.from(storedCode));

      if (!codesMatch) return res.status(400).json({ error: 'Invalid or expired code' });

      const consumed = await storage.consumeVerificationCode(claimed.id, storedCode);
      if (!consumed) return res.status(400).json({ error: 'Code has already been used' });

      const sessionToken = randomBytes(32).toString('hex');
      const expiresAt    = new Date(Date.now() + 86_400_000);
      await storage.createPortalSession(normalizedPhone, sessionToken, expiresAt);

      return res.json({ success: true, sessionToken, expiresAt: expiresAt.toISOString() });
    } catch (err: any) {
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/portal/verify-code — concurrency hardening', () => {

  // ── 1. Correct attempt limit: sequential wrong guesses ───────────────────
  it('rejects wrong codes and exhausts the attempt budget after MAX_ATTEMPTS', async () => {
    const storage = makeMockStorage();
    const app = buildApp(storage);

    const results: number[] = [];
    for (let i = 0; i < MAX_ATTEMPTS + 3; i++) {
      const res = await request(app)
        .post('/api/portal/verify-code')
        .send({ phone: PHONE, code: WRONG });
      results.push(res.status);
    }

    // First MAX_ATTEMPTS guesses get 400 (wrong code, attempt consumed)
    const badCodeResponses = results.slice(0, MAX_ATTEMPTS);
    expect(badCodeResponses.every(s => s === 400)).toBe(true);

    // Subsequent guesses get 429 (attempt budget exhausted)
    const throttledResponses = results.slice(MAX_ATTEMPTS);
    expect(throttledResponses.every(s => s === 429)).toBe(true);

    // claimVerificationAttempt was called for every request
    expect(storage.claimVerificationAttempt).toHaveBeenCalledTimes(MAX_ATTEMPTS + 3);
    // consumeVerificationCode was never called (wrong code every time)
    expect(storage.consumeVerificationCode).not.toHaveBeenCalled();
    // No session created
    expect(storage.createPortalSession).not.toHaveBeenCalled();
  });

  // ── 2. Concurrent wrong guesses respect the attempt cap ──────────────────
  it('enforces the attempt cap under concurrent wrong-code requests', async () => {
    const storage = makeMockStorage();
    const app = buildApp(storage);

    // Fire MAX_ATTEMPTS + 5 concurrent requests all with wrong codes
    const reqs = Array.from({ length: MAX_ATTEMPTS + 5 }, () =>
      request(app).post('/api/portal/verify-code').send({ phone: PHONE, code: WRONG })
    );
    const responses = await Promise.all(reqs);
    const statuses  = responses.map(r => r.status);

    const bad       = statuses.filter(s => s === 400);
    const throttled = statuses.filter(s => s === 429);

    // Exactly MAX_ATTEMPTS slots were claimed → MAX_ATTEMPTS wrong-code 400s
    expect(bad.length).toBe(MAX_ATTEMPTS);
    // The remaining 5 requests hit the 429
    expect(throttled.length).toBe(5);
    // No session ever created
    expect(storage.createPortalSession).not.toHaveBeenCalled();
  });

  // ── 3. Only one concurrent correct submission wins a session ─────────────
  it('allows exactly one session when multiple concurrent correct guesses race', async () => {
    const storage = makeMockStorage();
    const app = buildApp(storage);

    // Fire 5 simultaneous correct-code requests
    const reqs = Array.from({ length: 5 }, () =>
      request(app).post('/api/portal/verify-code').send({ phone: PHONE, code: CORRECT })
    );
    const responses = await Promise.all(reqs);
    const statuses  = responses.map(r => r.status);
    const successes = responses.filter(r => r.status === 200);

    // Exactly one request wins and creates a session
    expect(successes.length).toBe(1);
    expect(storage._sessions().length).toBe(1);

    // The winning response contains a valid-looking session token
    const { sessionToken } = successes[0].body;
    expect(typeof sessionToken).toBe('string');
    expect(sessionToken.length).toBe(64);

    // consumeVerificationCode was called multiple times but only one won
    expect(storage.consumeVerificationCode).toHaveBeenCalled();

    // The rest returned 400 (already used) or 429 (attempts exhausted)
    const failures = statuses.filter(s => s !== 200);
    expect(failures.every(s => s === 400 || s === 429)).toBe(true);
  });

  // ── 4. A single correct guess succeeds cleanly ───────────────────────────
  it('returns a session token for a single correct submission', async () => {
    const storage = makeMockStorage();
    const app = buildApp(storage);

    const res = await request(app)
      .post('/api/portal/verify-code')
      .send({ phone: PHONE, code: CORRECT });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.sessionToken).toBe('string');
    expect(res.body.sessionToken).toHaveLength(64);
    expect(storage.createPortalSession).toHaveBeenCalledOnce();
  });

  // ── 5. Missing or invalid fields are rejected before any DB touch ─────────
  it('returns 400 for missing phone or code without touching storage', async () => {
    const storage = makeMockStorage();
    const app = buildApp(storage);

    const r1 = await request(app).post('/api/portal/verify-code').send({ code: CORRECT });
    const r2 = await request(app).post('/api/portal/verify-code').send({ phone: PHONE });

    expect(r1.status).toBe(400);
    expect(r2.status).toBe(400);
    expect(storage.claimVerificationAttempt).not.toHaveBeenCalled();
    expect(storage.createPortalSession).not.toHaveBeenCalled();
  });
});
