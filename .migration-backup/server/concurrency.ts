/**
 * Bounded concurrency queue with backpressure.
 *
 * - Limits in-flight tasks to `concurrency`.
 * - Queues additional tasks up to `maxQueue`.
 * - Throws BackpressureError when the queue is full so callers can return
 *   HTTP 429 + Retry-After to the client instead of letting requests pile up.
 */

export class BackpressureError extends Error {
  retryAfterSec: number;
  constructor(name: string, retryAfterSec: number) {
    super(`${name} is at capacity, retry after ${retryAfterSec}s`);
    this.name = "BackpressureError";
    this.retryAfterSec = retryAfterSec;
  }
}

interface Waiter {
  resolve: () => void;
  reject: (err: Error) => void;
}

export class BoundedQueue {
  private active = 0;
  private waiters: Waiter[] = [];
  private completedDurationsMs: number[] = [];
  private totalRun = 0;
  private totalRejected = 0;

  constructor(
    public readonly name: string,
    public readonly concurrency: number,
    public readonly maxQueue: number,
    public readonly retryAfterSec: number = 5
  ) {}

  acquire(): Promise<void> {
    if (this.active < this.concurrency) {
      this.active++;
      return Promise.resolve();
    }
    if (this.waiters.length >= this.maxQueue) {
      this.totalRejected++;
      const wait = Math.min(60, Math.max(1, this.retryAfterSec + Math.floor(this.waiters.length / Math.max(1, this.concurrency))));
      return Promise.reject(new BackpressureError(this.name, wait));
    }
    return new Promise<void>((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
  }

  release() {
    const next = this.waiters.shift();
    if (next) {
      // active stays the same — handing the slot directly to the waiter
      next.resolve();
    } else {
      this.active = Math.max(0, this.active - 1);
    }
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    const start = Date.now();
    try {
      const result = await task();
      return result;
    } finally {
      this.totalRun++;
      const dur = Date.now() - start;
      this.completedDurationsMs.push(dur);
      if (this.completedDurationsMs.length > 200) this.completedDurationsMs.shift();
      this.release();
    }
  }

  stats() {
    const sorted = [...this.completedDurationsMs].sort((a, b) => a - b);
    const p = (q: number) =>
      sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor((q / 100) * sorted.length))];
    return {
      name: this.name,
      concurrency: this.concurrency,
      maxQueue: this.maxQueue,
      active: this.active,
      queued: this.waiters.length,
      totalRun: this.totalRun,
      totalRejected: this.totalRejected,
      p50Ms: p(50),
      p95Ms: p(95),
      p99Ms: p(99),
    };
  }
}

// Server-wide queues. Tuned for a single Reserved VM serving ~100 concurrent
// users. PDF generation is heavy (Puppeteer); AI calls are bandwidth-bound on
// the OpenAI side. Both should fail fast under load rather than queue forever.
export const pdfQueue = new BoundedQueue("pdf", 3, 12, 8);
export const aiQueue = new BoundedQueue("ai", 8, 24, 5);
export const visionQueue = new BoundedQueue("vision", 4, 12, 8);
// File uploads are buffered fully in memory (multer.memoryStorage) before they
// reach object storage. With a 100MB per-file cap, unbounded concurrency could
// exhaust RAM, so we cap how many large uploads are in flight at once and shed
// the rest with HTTP 429 + Retry-After.
export const uploadQueue = new BoundedQueue("upload", 6, 12, 8);

export function getAllQueueStats() {
  return [pdfQueue.stats(), aiQueue.stats(), visionQueue.stats(), uploadQueue.stats()];
}

/** True when the thrown value originated from a bounded queue at capacity. */
export function isBackpressure(e: any): e is BackpressureError {
  return !!e && (e instanceof BackpressureError || e?.name === "BackpressureError");
}

/**
 * Sends an HTTP 429 with Retry-After for a BackpressureError. Use inside
 * route catch blocks so the mobile + web clients get a structured signal
 * instead of a 500.
 */
export function send429(res: any, e: any): void {
  const retryAfterSec = (e && typeof e.retryAfterSec === "number") ? e.retryAfterSec : 5;
  res.set("Retry-After", String(retryAfterSec));
  res.status(429).json({
    error: e?.message || "Server is busy. Please try again.",
    code: "BACKPRESSURE",
    retryAfterSec,
  });
}
