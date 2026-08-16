/**
 * Tests for quote-acceptance guards, the autoCreateJobFromAcceptedQuote helper,
 * and the buildQuoteAcceptHandler route factory.
 *
 * All three imports come from the REAL production module (quoteAcceptance.ts)
 * so any change to guard order, expiry logic, or job-creation behaviour is
 * caught immediately — no shadow copies.
 *
 * Storage / DB dependencies are replaced with vi.fn() mocks. No server is
 * started and no database is touched.
 *
 * Scenarios locked in:
 *  Guard layer (checkQuoteAcceptGuards):
 *  - not found → 404
 *  - already accepted → 400, correct message
 *  - declined → 400, correct message
 *  - missing name → 400 (checked before signature)
 *  - missing / non-image signature → 400
 *  - past expiry → 400
 *  - valid pending quote → ok
 *  - no expiry set → ok
 *  - guard order: status beats expiry; name beats signature
 *
 *  Route handler (buildQuoteAcceptHandler):
 *  - guard failure → response sent, updateQuote NOT called, autoCreateJob NOT called
 *  - guard failure → response sent, updateQuote NOT called (for each guard case)
 *  - successful accept → updateQuote called, jobId returned in body
 *  - quote already has jobId → autoCreateJob returns null, original jobId returned
 *
 *  Auto-job helper (autoCreateJobFromAcceptedQuote):
 *  - null / undefined quote → null, no job created
 *  - quote.jobId set → null, no job created (duplicate-job guard)
 *  - quote.clientId missing → null, no job created
 *  - successful creation → job id returned, status is 'pending'
 *  - client address used on the job
 *  - null client → address is null, no error thrown
 *  - concurrent race (claim returns 0) → orphan job deleted, returns null
 *  - no checklist items created when race is lost
 *  - first request wins, second gets null
 *  - checklist: one item per non-empty description
 *  - checklist: empty descriptions skipped
 *  - checklist: (x<qty>) appended when qty ≠ 1
 *  - checklist: no suffix when qty = 1
 *  - checklist: no suffix when qty = null
 *  - checklist: item linked to new job id
 *  - checklist failure is non-fatal (job id still returned)
 *  - createJob failure → returns null without throwing
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkQuoteAcceptGuards,
  autoCreateJobFromAcceptedQuote,
  buildQuoteAcceptHandler,
  type QuoteForGuard,
  type QuoteForAutoJob,
  type AutoJobDeps,
  type MinimalRes,
  type QuoteAcceptHandlerDeps,
} from "../../quoteAcceptance";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const VALID_SIG = "data:image/png;base64,abc123";
const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const PAST   = new Date(Date.now() - 1000).toISOString();

const PENDING_QUOTE: QuoteForGuard & QuoteForAutoJob = {
  id: "quote-aaa",
  userId: "user-aaa",
  clientId: "client-aaa",
  status: "pending",
  jobId: null,
  number: "Q-001",
  title: "Fix the roof",
  description: "Flat roof replacement",
  validUntil: FUTURE,
};

// ─── Minimal mock response factory ───────────────────────────────────────────

function mockRes() {
  const res: { statusCode: number; body: unknown } = { statusCode: 200, body: undefined };
  const mock: MinimalRes = {
    status(code) {
      res.statusCode = code;
      return mock;
    },
    json(body) {
      res.body = body;
      return mock;
    },
  };
  return { mock, res };
}

// ─── checkQuoteAcceptGuards ───────────────────────────────────────────────────

describe("checkQuoteAcceptGuards — real production function", () => {
  it("returns 404 when quote is null", () => {
    const r = checkQuoteAcceptGuards({ quote: null, acceptedBy: "Alice", signature: VALID_SIG });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.httpStatus).toBe(404); expect(r.error).toMatch(/not found/i); }
  });

  it("returns 404 when quote is undefined", () => {
    const r = checkQuoteAcceptGuards({ quote: undefined, acceptedBy: "Alice", signature: VALID_SIG });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.httpStatus).toBe(404);
  });

  it("returns 400 when status is 'accepted'", () => {
    const r = checkQuoteAcceptGuards({
      quote: { ...PENDING_QUOTE, status: "accepted" },
      acceptedBy: "Alice", signature: VALID_SIG,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.httpStatus).toBe(400); expect(r.error).toMatch(/already accepted/i); }
  });

  it("returns 400 when status is 'declined'", () => {
    const r = checkQuoteAcceptGuards({
      quote: { ...PENDING_QUOTE, status: "declined" },
      acceptedBy: "Alice", signature: VALID_SIG,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.httpStatus).toBe(400); expect(r.error).toMatch(/declined/i); }
  });

  it("returns 400 when acceptedBy is whitespace-only", () => {
    const r = checkQuoteAcceptGuards({ quote: PENDING_QUOTE, acceptedBy: "   ", signature: VALID_SIG });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.httpStatus).toBe(400); expect(r.error).toMatch(/name is required/i); }
  });

  it("returns 400 when acceptedBy is undefined", () => {
    const r = checkQuoteAcceptGuards({ quote: PENDING_QUOTE, acceptedBy: undefined, signature: VALID_SIG });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.httpStatus).toBe(400);
  });

  it("returns 400 when signature is undefined", () => {
    const r = checkQuoteAcceptGuards({ quote: PENDING_QUOTE, acceptedBy: "Alice", signature: undefined });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.httpStatus).toBe(400); expect(r.error).toMatch(/signature is required/i); }
  });

  it("returns 400 when signature does not start with 'data:image/'", () => {
    const r = checkQuoteAcceptGuards({
      quote: PENDING_QUOTE, acceptedBy: "Alice", signature: "blob:https://example.com/abc",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.httpStatus).toBe(400);
  });

  it("returns 400 when validUntil is in the past", () => {
    const r = checkQuoteAcceptGuards({
      quote: { ...PENDING_QUOTE, validUntil: PAST }, acceptedBy: "Alice", signature: VALID_SIG,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.httpStatus).toBe(400); expect(r.error).toMatch(/expired/i); }
  });

  it("returns ok for a valid pending quote with a future expiry", () => {
    expect(checkQuoteAcceptGuards({ quote: PENDING_QUOTE, acceptedBy: "Alice", signature: VALID_SIG }).ok).toBe(true);
  });

  it("returns ok when validUntil is null (no expiry set)", () => {
    const r = checkQuoteAcceptGuards({
      quote: { ...PENDING_QUOTE, validUntil: null }, acceptedBy: "Alice", signature: VALID_SIG,
    });
    expect(r.ok).toBe(true);
  });

  it("status guard runs before expiry — 'declined' beats past expiry", () => {
    const r = checkQuoteAcceptGuards({
      quote: { ...PENDING_QUOTE, status: "declined", validUntil: PAST },
      acceptedBy: "Alice", signature: VALID_SIG,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/declined/i);
  });

  it("status guard runs before expiry — 'accepted' beats past expiry", () => {
    const r = checkQuoteAcceptGuards({
      quote: { ...PENDING_QUOTE, status: "accepted", validUntil: PAST },
      acceptedBy: "Alice", signature: VALID_SIG,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/already accepted/i);
  });

  it("name guard runs before signature guard", () => {
    // Both missing — the name error should surface first.
    const r = checkQuoteAcceptGuards({ quote: PENDING_QUOTE, acceptedBy: undefined, signature: undefined });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/name is required/i);
  });

  it("injectable clock: validUntil 1 ms before now is treated as expired", () => {
    const now = new Date("2026-08-16T10:00:00.000Z");
    const r = checkQuoteAcceptGuards({
      quote: { ...PENDING_QUOTE, validUntil: new Date(now.getTime() - 1).toISOString() },
      acceptedBy: "Alice", signature: VALID_SIG, now,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/expired/i);
  });
});

// ─── buildQuoteAcceptHandler — route-level tests ──────────────────────────────

// Object.assign is used for overrides so TypeScript keeps the base mock types
// instead of widening them to `MockType | HandlerDepsFnType` via spread.
function makeHandlerDeps(
  quoteOverride?: Partial<typeof PENDING_QUOTE> | null,
  depOverrides?: Partial<QuoteAcceptHandlerDeps>,
) {
  const updateQuote   = vi.fn().mockResolvedValue(undefined);
  const autoCreateJob = vi.fn().mockResolvedValue("job-auto-001");

  const resolvedQuote =
    quoteOverride === null
      ? null
      : { ...PENDING_QUOTE, ...quoteOverride };

  const deps = {
    getQuoteByToken: vi.fn().mockResolvedValue(resolvedQuote),
    updateQuote,
    notifyAccepted:  vi.fn().mockResolvedValue(undefined),
    autoCreateJob,
  };
  Object.assign(deps, depOverrides ?? {});
  return { deps, updateQuote, autoCreateJob };
}

function makeReq(body: Record<string, unknown> = {}) {
  return {
    params: { token: "tok-123" },
    body: { acceptedBy: "Alice", signature: VALID_SIG, ...body },
  };
}

describe("buildQuoteAcceptHandler — real route factory", () => {
  describe("guard failures: updateQuote and autoCreateJob are never called", () => {
    const guardCases: Array<{
      label: string;
      quoteOverride: Partial<typeof PENDING_QUOTE> | null;
      bodyOverride?: Record<string, unknown>;
      expectedStatus: number;
    }> = [
      { label: "quote not found",      quoteOverride: null,                             expectedStatus: 404 },
      { label: "already accepted",     quoteOverride: { status: "accepted" },           expectedStatus: 400 },
      { label: "declined",             quoteOverride: { status: "declined" },           expectedStatus: 400 },
      { label: "missing name",         quoteOverride: {},  bodyOverride: { acceptedBy: "" }, expectedStatus: 400 },
      { label: "missing signature",    quoteOverride: {},  bodyOverride: { signature: "not-an-image" }, expectedStatus: 400 },
      { label: "expired",              quoteOverride: { validUntil: PAST },             expectedStatus: 400 },
    ];

    for (const tc of guardCases) {
      it(`${tc.label} → ${tc.expectedStatus}, updateQuote not called, autoCreateJob not called`, async () => {
        const { deps, updateQuote, autoCreateJob } = makeHandlerDeps(tc.quoteOverride);
        const handler = buildQuoteAcceptHandler(deps);
        const { mock: res, res: state } = mockRes();
        await handler(makeReq(tc.bodyOverride), res);

        expect(state.statusCode).toBe(tc.expectedStatus);
        expect((state.body as any).error).toBeTruthy();
        expect(updateQuote).not.toHaveBeenCalled();
        expect(autoCreateJob).not.toHaveBeenCalled();
      });
    }
  });

  it("successful accept: updateQuote is called with status 'accepted'", async () => {
    const { deps, updateQuote } = makeHandlerDeps();
    await buildQuoteAcceptHandler(deps)(makeReq(), mockRes().mock);

    expect(updateQuote).toHaveBeenCalledOnce();
    const [, , data] = updateQuote.mock.calls[0];
    expect(data.status).toBe("accepted");
    expect(data.acceptedBy).toBe("Alice");
  });

  it("successful accept: response includes success:true and the auto-created jobId", async () => {
    const { deps } = makeHandlerDeps();
    const { mock: res, res: state } = mockRes();
    await buildQuoteAcceptHandler(deps)(makeReq(), res);

    expect((state.body as any).success).toBe(true);
    expect((state.body as any).jobId).toBe("job-auto-001");
  });

  it("when quote already has a jobId, the original jobId is returned and autoCreateJob gets null back", async () => {
    const { deps, autoCreateJob } = makeHandlerDeps({ jobId: "job-pre-linked" });
    // autoCreateJob returns null because quote.jobId is already set (helper's own guard)
    autoCreateJob.mockResolvedValue(null);
    const { mock: res, res: state } = mockRes();
    await buildQuoteAcceptHandler(deps)(makeReq(), res);

    expect((state.body as any).jobId).toBe("job-pre-linked");
  });

  it("notification failure does not prevent a successful response", async () => {
    const { deps } = makeHandlerDeps({}, {
      notifyAccepted: vi.fn().mockRejectedValue(new Error("SMTP down")),
    });
    const { mock: res, res: state } = mockRes();
    await buildQuoteAcceptHandler(deps)(makeReq(), res);

    expect((state.body as any).success).toBe(true);
  });

  it("unexpected storage error → 500 response", async () => {
    const { deps } = makeHandlerDeps({}, {
      updateQuote: vi.fn().mockRejectedValue(new Error("DB crash")),
    });
    const { mock: res, res: state } = mockRes();
    await buildQuoteAcceptHandler(deps)(makeReq(), res);

    expect(state.statusCode).toBe(500);
    expect((state.body as any).error).toBeTruthy();
  });
});

// ─── autoCreateJobFromAcceptedQuote ───────────────────────────────────────────

// Object.assign is used for overrides so TypeScript keeps the base mock types
// instead of widening them to `MockType | AutoJobDepsFnType` via spread.
function makeDeps(overrides: Partial<AutoJobDeps> = {}) {
  const base = {
    getClientById:       vi.fn().mockResolvedValue({ address: "1 Main St" }),
    createJob:           vi.fn().mockResolvedValue({ id: "job-new-001" }),
    claimQuoteJobId:     vi.fn().mockResolvedValue(1),
    deleteJob:           vi.fn().mockResolvedValue(undefined),
    getQuoteLineItems:   vi.fn().mockResolvedValue([]),
    createChecklistItem: vi.fn().mockResolvedValue(undefined),
    createNotification:  vi.fn().mockResolvedValue(undefined),
    logActivity:         vi.fn().mockResolvedValue(undefined),
  };
  Object.assign(base, overrides);
  return base;
}

describe("autoCreateJobFromAcceptedQuote — real production function", () => {
  it("returns null immediately when quote is null", async () => {
    const deps = makeDeps();
    expect(await autoCreateJobFromAcceptedQuote(null, "Alice", deps)).toBeNull();
    expect(deps.createJob).not.toHaveBeenCalled();
  });

  it("returns null immediately when quote is undefined", async () => {
    const deps = makeDeps();
    expect(await autoCreateJobFromAcceptedQuote(undefined, "Alice", deps)).toBeNull();
    expect(deps.createJob).not.toHaveBeenCalled();
  });

  it("returns null immediately when quote already has a jobId — no second job created", async () => {
    const deps = makeDeps();
    const quote: QuoteForAutoJob = { ...PENDING_QUOTE, jobId: "job-existing" };
    expect(await autoCreateJobFromAcceptedQuote(quote, "Alice", deps)).toBeNull();
    expect(deps.createJob).not.toHaveBeenCalled();
  });

  it("returns null immediately when quote has no clientId", async () => {
    const deps = makeDeps();
    const quote: QuoteForAutoJob = { ...PENDING_QUOTE, clientId: null };
    expect(await autoCreateJobFromAcceptedQuote(quote, "Alice", deps)).toBeNull();
    expect(deps.createJob).not.toHaveBeenCalled();
  });

  it("creates exactly one pending job and returns its id on a clean accept", async () => {
    const deps = makeDeps();
    const result = await autoCreateJobFromAcceptedQuote(PENDING_QUOTE, "Alice", deps);
    expect(result).toBe("job-new-001");
    expect(deps.createJob).toHaveBeenCalledOnce();
    const jobArgs = deps.createJob.mock.calls[0][0];
    expect(jobArgs.status).toBe("pending");
    expect(jobArgs.clientId).toBe(PENDING_QUOTE.clientId);
    expect(jobArgs.userId).toBe(PENDING_QUOTE.userId);
  });

  it("uses the client's address on the created job", async () => {
    const deps = makeDeps({ getClientById: vi.fn().mockResolvedValue({ address: "42 Test Ave" }) });
    await autoCreateJobFromAcceptedQuote(PENDING_QUOTE, "Alice", deps);
    expect(deps.createJob.mock.calls[0][0].address).toBe("42 Test Ave");
  });

  it("falls back to null address when client lookup returns null", async () => {
    const deps = makeDeps({ getClientById: vi.fn().mockResolvedValue(null) });
    const result = await autoCreateJobFromAcceptedQuote(PENDING_QUOTE, "Alice", deps);
    expect(result).toBe("job-new-001");
    expect(deps.createJob.mock.calls[0][0].address).toBeNull();
  });

  describe("concurrent race — duplicate-job protection", () => {
    it("returns null and deletes the orphan job when the atomic claim is lost", async () => {
      const deps = makeDeps({ claimQuoteJobId: vi.fn().mockResolvedValue(0) });
      const result = await autoCreateJobFromAcceptedQuote(PENDING_QUOTE, "Alice", deps);
      expect(result).toBeNull();
      expect(deps.deleteJob).toHaveBeenCalledWith("job-new-001", PENDING_QUOTE.userId);
    });

    it("does not create checklist items when the claim is lost", async () => {
      const deps = makeDeps({
        claimQuoteJobId:   vi.fn().mockResolvedValue(0),
        getQuoteLineItems: vi.fn().mockResolvedValue([{ description: "Install pump", quantity: 1 }]),
      });
      await autoCreateJobFromAcceptedQuote(PENDING_QUOTE, "Alice", deps);
      expect(deps.createChecklistItem).not.toHaveBeenCalled();
    });

    it("first request wins the claim; second request gets null and deletes its job", async () => {
      const deps1 = makeDeps({ claimQuoteJobId: vi.fn().mockResolvedValue(1) });
      expect(await autoCreateJobFromAcceptedQuote(PENDING_QUOTE, "Alice", deps1)).toBe("job-new-001");

      const deps2 = makeDeps({ claimQuoteJobId: vi.fn().mockResolvedValue(0) });
      expect(await autoCreateJobFromAcceptedQuote(PENDING_QUOTE, "Alice", deps2)).toBeNull();
      expect(deps2.deleteJob).toHaveBeenCalled();
    });
  });

  describe("checklist items copied from quote line items", () => {
    it("creates one item per non-empty description", async () => {
      const deps = makeDeps({
        getQuoteLineItems: vi.fn().mockResolvedValue([
          { description: "Install pump", quantity: 1 },
          { description: "Fit pipes",    quantity: 1 },
        ]),
      });
      await autoCreateJobFromAcceptedQuote(PENDING_QUOTE, "Alice", deps);
      expect(deps.createChecklistItem).toHaveBeenCalledTimes(2);
    });

    it("skips items with empty or whitespace-only descriptions", async () => {
      const deps = makeDeps({
        getQuoteLineItems: vi.fn().mockResolvedValue([
          { description: "",              quantity: 1 },
          { description: "   ",           quantity: 1 },
          { description: "Install pump",  quantity: 1 },
        ]),
      });
      await autoCreateJobFromAcceptedQuote(PENDING_QUOTE, "Alice", deps);
      expect(deps.createChecklistItem).toHaveBeenCalledTimes(1);
    });

    it("appends (x<qty>) when quantity is not 1", async () => {
      const deps = makeDeps({
        getQuoteLineItems: vi.fn().mockResolvedValue([{ description: "Install pump", quantity: 3 }]),
      });
      await autoCreateJobFromAcceptedQuote(PENDING_QUOTE, "Alice", deps);
      expect(deps.createChecklistItem.mock.calls[0][0].text).toBe("Install pump (x3)");
    });

    it("does not append a suffix when quantity is 1", async () => {
      const deps = makeDeps({
        getQuoteLineItems: vi.fn().mockResolvedValue([{ description: "Install pump", quantity: 1 }]),
      });
      await autoCreateJobFromAcceptedQuote(PENDING_QUOTE, "Alice", deps);
      expect(deps.createChecklistItem.mock.calls[0][0].text).toBe("Install pump");
    });

    it("does not append a suffix when quantity is null (defaults to 1)", async () => {
      const deps = makeDeps({
        getQuoteLineItems: vi.fn().mockResolvedValue([{ description: "Install pump", quantity: null }]),
      });
      await autoCreateJobFromAcceptedQuote(PENDING_QUOTE, "Alice", deps);
      expect(deps.createChecklistItem.mock.calls[0][0].text).toBe("Install pump");
    });

    it("links the checklist item to the correct job id", async () => {
      const deps = makeDeps({
        getQuoteLineItems: vi.fn().mockResolvedValue([{ description: "Install pump", quantity: 1 }]),
      });
      await autoCreateJobFromAcceptedQuote(PENDING_QUOTE, "Alice", deps);
      expect(deps.createChecklistItem.mock.calls[0][0].jobId).toBe("job-new-001");
    });

    it("is non-fatal: job id still returned even if line-item copy throws", async () => {
      const deps = makeDeps({
        getQuoteLineItems: vi.fn().mockRejectedValue(new Error("DB down")),
      });
      expect(await autoCreateJobFromAcceptedQuote(PENDING_QUOTE, "Alice", deps)).toBe("job-new-001");
    });
  });

  it("returns null without throwing when createJob itself throws", async () => {
    const deps = makeDeps({
      createJob: vi.fn().mockRejectedValue(new Error("DB constraint")),
    });
    expect(await autoCreateJobFromAcceptedQuote(PENDING_QUOTE, "Alice", deps)).toBeNull();
  });
});
