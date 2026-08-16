/**
 * Extracted, testable helpers for quote acceptance.
 *
 * Keeping this logic outside the monolithic route file means tests can import
 * and exercise the real code paths — not shadow copies.
 *
 * Exports:
 *  - checkQuoteAcceptGuards   – pure guard function; used directly by the route
 *  - autoCreateJobFromAcceptedQuote – injectable-deps job-creation helper
 *  - buildQuoteAcceptHandler  – factory that returns a fully wired route handler
 *                               with all I/O injected; enables route-level tests
 *                               without starting a server or touching a real DB
 */

// ─── Minimal Express-compatible response shape for the handler factory ────────

export type MinimalRes = {
  status: (code: number) => MinimalRes;
  json: (body: unknown) => MinimalRes;
};

// ─── Route handler factory ────────────────────────────────────────────────────

export type QuoteAcceptHandlerDeps = {
  /** Fetch a quote by its public token. Returns null when not found. */
  getQuoteByToken: (token: string) => Promise<(QuoteForGuard & QuoteForAutoJob) | null>;
  /** Persist the acceptance (status, timestamp, IP, signature). */
  updateQuote: (
    quoteId: string,
    userId: string,
    data: Record<string, unknown>,
  ) => Promise<void>;
  /** Best-effort in-app notification. Errors are caught and logged. */
  notifyAccepted: (userId: string, quote: QuoteForGuard & QuoteForAutoJob, acceptedBy: string) => Promise<void>;
  /** Auto-create a draft job from the accepted quote. Returns null on no-op or error. */
  autoCreateJob: (quote: QuoteForAutoJob, acceptedByName: string) => Promise<string | null>;
  /** Optional: broadcast a WebSocket update. Errors are caught silently. */
  broadcastUpdate?: (quoteId: string, userId: string, jobId: string | null) => void;
  /** Optional: resolve the client IP from the request (defaults to 'unknown'). */
  getClientIp?: (req: Record<string, unknown>) => string;
};

/**
 * Builds the `/api/public/quote/:token/accept` route handler with all I/O
 * injected. This lets tests import the real handler logic and pass mock deps
 * without starting a server or touching a database.
 *
 * Guard order (mirrors the original inline handler):
 *   not-found → already-accepted → declined → missing-name → missing-sig → expired
 */
export function buildQuoteAcceptHandler(deps: QuoteAcceptHandlerDeps) {
  return async (req: Record<string, any>, res: MinimalRes): Promise<void> => {
    try {
      const token: string = req.params?.token ?? req.token;
      const acceptedBy: string | undefined = req.body?.acceptedBy;
      const signature: string | undefined = req.body?.signature;

      const quote = await deps.getQuoteByToken(token);

      const guard = checkQuoteAcceptGuards({ quote, acceptedBy, signature });
      if (!guard.ok) {
        res.status(guard.httpStatus).json({ error: guard.error });
        return;
      }

      // guard.ok === true → quote is non-null and all fields are present
      const acceptedQuote = quote!;
      const resolvedName = (acceptedBy || 'Client').trim();
      const clientIp = deps.getClientIp ? deps.getClientIp(req) : 'unknown';

      await deps.updateQuote(acceptedQuote.id, acceptedQuote.userId, {
        status: 'accepted',
        acceptedAt: new Date(),
        acceptedBy: resolvedName,
        acceptanceIp: clientIp,
        acceptanceSignatureData: signature ?? null,
      });

      try {
        await deps.notifyAccepted(acceptedQuote.userId, acceptedQuote, resolvedName);
      } catch (e) {
        console.error('[QuoteAccept] Failed to send acceptance notification:', e);
      }

      const autoCreatedJobId = await deps.autoCreateJob(acceptedQuote, resolvedName);
      const effectiveJobId = acceptedQuote.jobId || autoCreatedJobId;

      try {
        deps.broadcastUpdate?.(acceptedQuote.id, acceptedQuote.userId, effectiveJobId);
      } catch { /* non-critical */ }

      res.json({ success: true, message: 'Quote accepted successfully', jobId: effectiveJobId });
    } catch (error) {
      console.error('[QuoteAccept] Unexpected error:', error);
      res.status(500).json({ error: 'Failed to accept quote' });
    }
  };
}

// ─── Guard check ──────────────────────────────────────────────────────────────

export type QuoteForGuard = {
  status: string;
  validUntil?: string | Date | null;
  [key: string]: unknown;
};

export type AcceptGuardOk = { ok: true };
export type AcceptGuardFail = { ok: false; httpStatus: 400 | 404; error: string };
export type AcceptGuardResult = AcceptGuardOk | AcceptGuardFail;

/**
 * Runs every guard check the route performs before accepting a quote.
 * Order exactly matches the route handler in legacyRoutes.ts:
 *   not-found → already-accepted → declined → missing-name → missing-sig → expired
 *
 * @param now - injectable clock, defaults to `new Date()` (for expiry testing)
 */
export function checkQuoteAcceptGuards(params: {
  quote: QuoteForGuard | null | undefined;
  acceptedBy: string | undefined;
  signature: string | undefined;
  now?: Date;
}): AcceptGuardResult {
  const { quote, acceptedBy, signature, now = new Date() } = params;

  if (!quote) {
    return { ok: false, httpStatus: 404, error: 'Quote not found' };
  }
  if (quote.status === 'accepted') {
    return { ok: false, httpStatus: 400, error: 'Quote already accepted' };
  }
  if (quote.status === 'declined') {
    return { ok: false, httpStatus: 400, error: 'Quote was declined' };
  }
  if (!acceptedBy || !acceptedBy.trim()) {
    return { ok: false, httpStatus: 400, error: 'Name is required to accept the quote' };
  }
  if (!signature || !signature.startsWith('data:image/')) {
    return { ok: false, httpStatus: 400, error: 'Signature is required to accept the quote' };
  }
  if (quote.validUntil && new Date(quote.validUntil) < now) {
    return { ok: false, httpStatus: 400, error: 'This quote has expired' };
  }

  return { ok: true };
}

// ─── Auto-create job from accepted quote ──────────────────────────────────────

export type QuoteForAutoJob = {
  id: string;
  userId: string;
  clientId: string | null;
  jobId: string | null;
  title?: string | null;
  description?: string | null;
  number?: string | null;
};

export type LineItemForAutoJob = {
  description?: string | null;
  quantity?: string | number | null;
};

/** Injected dependencies — makes the function fully unit-testable without a real DB. */
export type AutoJobDeps = {
  getClientById: (id: string) => Promise<{ address?: string | null } | null | undefined>;
  createJob: (data: Record<string, unknown>) => Promise<{ id: string }>;
  /** Atomically link jobId to quote only when jobId IS NULL. Returns rows updated. */
  claimQuoteJobId: (quoteId: string, jobId: string) => Promise<number>;
  deleteJob: (jobId: string, userId: string) => Promise<void>;
  getQuoteLineItems: (quoteId: string) => Promise<LineItemForAutoJob[]>;
  createChecklistItem: (data: Record<string, unknown>, userId: string) => Promise<void>;
  createNotification: (data: Record<string, unknown>) => Promise<void>;
  logActivity: (...args: unknown[]) => Promise<void>;
};

/**
 * Auto-creates a pending job when a client accepts a quote that has no linked job.
 * Uses an optimistic-lock UPDATE (WHERE jobId IS NULL) to prevent race conditions
 * from creating duplicate jobs on concurrent accepts.
 *
 * Returns the new job id on success, or null when:
 *  - quote is null/undefined
 *  - quote already has a jobId
 *  - quote has no clientId
 *  - the atomic claim lost a race (another request already linked a job)
 *  - any unexpected error (logged, not re-thrown)
 */
export async function autoCreateJobFromAcceptedQuote(
  quote: QuoteForAutoJob | null | undefined,
  acceptedByName: string,
  deps: AutoJobDeps,
): Promise<string | null> {
  if (!quote || quote.jobId || !quote.clientId) return null;

  try {
    const client = await deps.getClientById(quote.clientId);
    const shortId = quote.id.slice(0, 8);
    const job = await deps.createJob({
      userId: quote.userId,
      clientId: quote.clientId,
      title: quote.title || `Job for quote ${quote.number || shortId}`,
      description: quote.description || null,
      address: client?.address || null,
      status: 'pending',
      notes: `Auto-created from accepted quote ${quote.number || shortId}`,
    });

    // Atomically claim the quote: only link the new job if no job has been linked yet.
    // Guards against concurrent accepts / double-submits creating duplicate jobs.
    const rowsUpdated = await deps.claimQuoteJobId(quote.id, job.id);
    if (rowsUpdated === 0) {
      // Another request already linked a job to this quote; discard ours.
      try {
        await deps.deleteJob(job.id, quote.userId);
      } catch (cleanupErr) {
        console.error('[Quote Acceptance] Failed to clean up duplicate auto-created job:', cleanupErr);
      }
      return null;
    }

    // Quote line items become the job scope (checklist items)
    try {
      const lineItems = await deps.getQuoteLineItems(quote.id);
      for (const item of lineItems) {
        const desc = (item.description || '').trim();
        if (!desc) continue;
        const qty = parseFloat(String(item.quantity ?? '1'));
        const text = qty && qty !== 1 ? `${desc} (x${qty})` : desc;
        await deps.createChecklistItem({ jobId: job.id, text }, quote.userId);
      }
    } catch (e) {
      console.error('[Quote Acceptance] Failed to copy quote line items to job scope:', e);
    }

    // Notify the owner that a draft job was created
    try {
      await deps.createNotification({
        userId: quote.userId,
        type: 'job_created',
        title: 'Draft Job Created',
        message: `${acceptedByName} accepted quote ${quote.number || shortId}. A draft job has been created and is ready to review and schedule.`,
        relatedId: job.id,
        relatedType: 'job',
      });
    } catch (e) {
      console.error('[Quote Acceptance] Failed to create draft-job notification:', e);
    }

    try {
      await deps.logActivity(
        quote.userId,
        'job_created',
        'Draft Job Created',
        `Draft job auto-created after quote ${quote.number || shortId} was accepted by ${acceptedByName}`,
        'job',
        job.id,
        { quoteId: quote.id, quoteNumber: quote.number, trigger: 'quote_accepted' },
      );
    } catch { /* non-critical */ }

    console.log(`[Quote Acceptance] Auto-created draft job ${job.id} from quote ${quote.id}`);
    return job.id;
  } catch (e) {
    console.error('[Quote Acceptance] Failed to auto-create job from accepted quote:', e);
    return null;
  }
}
