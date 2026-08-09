import * as Sentry from "@sentry/node";

const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|card|cvv|ssn|bank|account[-_]?number|routing/i;

function scrub(value: any, depth = 0): any {
  if (value == null || depth > 6) return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : scrub(v, depth + 1);
    }
    return out;
  }
  return value;
}

// Only report from production — dev workspace restarts (e.g. EADDRINUSE) were
// polluting Sentry with fatal noise that looks like real outages.
if (process.env.SENTRY_DSN && process.env.NODE_ENV === "production") {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    // Keep user/request context for debugging, but never let credentials leave.
    sendDefaultPii: true,
    tracesSampleRate: 0.2,
    beforeSend(event) {
      try {
        const req: any = event.request;
        if (req) {
          if (req.data) req.data = scrub(req.data);
          if (req.headers) {
            for (const h of Object.keys(req.headers)) {
              if (SENSITIVE_KEY.test(h)) req.headers[h] = "[redacted]";
            }
          }
          if (req.cookies) req.cookies = "[redacted]";
        }
        if (event.extra) event.extra = scrub(event.extra);
        if (event.contexts) event.contexts = scrub(event.contexts);
      } catch {
        // Never let scrubbing throw and drop legitimate error reports.
      }
      return event;
    },
  });
}
