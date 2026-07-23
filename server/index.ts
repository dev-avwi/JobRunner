import "./instrument";
import * as Sentry from "@sentry/node";
import express, { type Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createDemoUserAndData, fixTestUserPasswords, seedSmsDataForTestUsers, createDemoTeamMembers, createDemoSubcontractorsAndInviteCodes, startDemoDataRefreshScheduler, createVisitorUser, ensureTryDemoData } from "./demoData";
import { initializeStripe } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { storage, pool as sharedPgPool } from "./storage";
import { setupWebSocket } from "./websocket";
import { metricsMiddleware } from "./metrics";
import { uploadQueue, send429 } from "./concurrency";
import { activityTrackingMiddleware, backfillSignupDayActivity, backfillFeaturePermissions } from "./routes/middleware";
import { getErrorMessage } from "./lib/errors";

process.on('uncaughtException', (error: Error) => {
  Sentry.captureException(error);
  console.error(JSON.stringify({
    level: 'fatal',
    type: 'uncaughtException',
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  }));
});

process.on('unhandledRejection', (reason: unknown) => {
  Sentry.captureException(reason);
  const message = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;
  console.error(JSON.stringify({
    level: 'error',
    type: 'unhandledRejection',
    message,
    stack,
    timestamp: new Date().toISOString(),
  }));
});

let httpServer: ReturnType<typeof import('http').createServer> | null = null;

function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received — shutting down gracefully...`);
  const forceTimeout = setTimeout(() => {
    console.error('Graceful shutdown timed out after 10s, forcing exit');
    process.exit(1);
  }, 10_000);
  forceTimeout.unref();

  const closeServer = new Promise<void>((resolve) => {
    if (httpServer) {
      httpServer.close(() => resolve());
    } else {
      resolve();
    }
  });

  closeServer
    .then(async () => {
      try {
        const { pool } = await import('./storage');
        await pool.end();
        console.log('[Shutdown] Database pool closed');
      } catch (poolErr) {
        console.error('[Shutdown] Error closing database pool:', poolErr);
      }
    })
    .then(() => {
      console.log('Graceful shutdown complete');
      process.exit(0);
    })
    .catch((err: unknown) => {
      console.error('Error during shutdown:', err);
      process.exit(1);
    });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const app = express();

// Session configuration - require SESSION_SECRET and DATABASE_URL in production
if (process.env.NODE_ENV === 'production') {
  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required in production');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required in production for persistent session storage');
  }
}

// Configure session store based on environment.
// Share the main pg pool (which has its own 'error' handler + Neon-tuned
// timeouts) instead of letting connect-pg-simple spin up an un-handled pool.
// Without this, Neon idle disconnects bubble up as "Connection terminated
// unexpectedly" and fail user requests (e.g. GET /api/jobs).
let sessionStore;
if (process.env.DATABASE_URL) {
  const PgSession = connectPgSimple(session);
  sessionStore = new PgSession({
    pool: sharedPgPool as any,
    tableName: 'session',
    createTableIfMissing: false,
    // Swallow transient pool errors so a dropped Neon connection on a
    // session lookup doesn't crash the request — the next query will
    // reconnect cleanly.
    errorLog: (err: any) => {
      console.error('[SessionStore] pg error (handled):', err?.message || err);
    },
  });
  console.log('✅ Using PostgreSQL session store (shared pool)');
} else if (process.env.NODE_ENV === 'development') {
  sessionStore = undefined;
  console.log('⚠️ Using in-memory session store (development only)');
} else {
  throw new Error('PostgreSQL session store required for production - DATABASE_URL missing');
}

(async () => {
  // Initialize Stripe and get webhook UUID
  const { stripe, webhookUuid } = await initializeStripe();
  
  // Initialize Twilio for SMS notifications
  const { initializeTwilio, configureTwilioWebhook } = await import('./twilioClient');
  const twilioReady = await initializeTwilio();
  if (twilioReady) {
    const webhookBaseUrl = process.env.APP_DOMAIN 
      ? `https://${process.env.APP_DOMAIN}`
      : 'https://jobrunner.com.au';
    // Fire-and-forget: configuring the upstream Twilio webhook is a network call.
    // It must not block startup, or it can delay server.listen() past the
    // deployment health probe and cause a promote timeout.
    configureTwilioWebhook(webhookBaseUrl).catch((err) => {
      console.error('[Twilio] Failed to configure webhook (non-fatal):', err);
    });
  }
  
  // Register Stripe webhook route BEFORE express.json()
  // This is critical - webhook needs raw Buffer, not parsed JSON
  if (webhookUuid) {
    app.post(
      '/api/stripe/webhook/:uuid',
      express.raw({ type: 'application/json' }),
      async (req, res) => {
        const signature = req.headers['stripe-signature'];

        if (!signature) {
          return res.status(400).json({ error: 'Missing stripe-signature' });
        }

        try {
          const sig = Array.isArray(signature) ? signature[0] : signature;

          if (!Buffer.isBuffer(req.body)) {
            console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer');
            return res.status(500).json({ error: 'Webhook processing error' });
          }

          const { uuid } = req.params;
          await WebhookHandlers.processWebhook(req.body as Buffer, sig, uuid, storage);

          res.status(200).json({ received: true });
        } catch (error: unknown) {
          console.error('Webhook error:', getErrorMessage(error));
          res.status(400).json({ error: 'Webhook processing error' });
        }
      }
    );
    console.log('✅ Stripe webhook route configured');
  }

  app.post(
    '/api/vapi/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      try {
        const { processWebhookEvent, verifyVapiWebhook } = await import('./vapiService');
        const signature = req.headers['x-vapi-signature'] as string | undefined;
        const verbatimSecret = req.headers['x-vapi-secret'] as string | undefined;

        if (!Buffer.isBuffer(req.body)) {
          console.error('[Vapi Webhook] req.body is not a Buffer');
          return res.status(500).json({ error: 'Webhook processing error' });
        }

        if (!verifyVapiWebhook(req.body, signature, verbatimSecret)) {
          console.warn('[Vapi Webhook] Invalid signature - rejecting request');
          return res.status(401).json({ error: 'Invalid webhook signature' });
        }

        const parsed = JSON.parse(req.body.toString('utf8'));
        const result = await processWebhookEvent(parsed);
        res.json(result);
      } catch (error: unknown) {
        console.error('[Vapi Webhook] Error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
      }
    }
  );
  console.log('✅ Vapi webhook route configured');

  // SendGrid Event Webhook — tracks delivered/open/click/bounce events for sent emails.
  // Must be registered BEFORE express.json() so we receive the raw Buffer needed
  // for ECDSA signature verification (signed payload = timestamp + raw_body).
  app.post(
    '/api/webhooks/sendgrid',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const startedAt = Date.now();
      try {
        const { verifySendGridWebhook, processSendGridEvents } = await import('./sendgridWebhook');
        const signature = req.headers['x-twilio-email-event-webhook-signature'] as string | undefined;
        const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string | undefined;

        if (!Buffer.isBuffer(req.body)) {
          console.warn(JSON.stringify({ provider: 'sendgrid', signatureValid: false, eventType: null, latencyMs: Date.now() - startedAt, error: 'body_not_buffer' }));
          return res.status(400).json({ error: 'Invalid body' });
        }

        if (!verifySendGridWebhook(req.body, signature, timestamp)) {
          console.warn(JSON.stringify({ provider: 'sendgrid', signatureValid: false, eventType: null, latencyMs: Date.now() - startedAt }));
          return res.status(401).json({ error: 'Invalid signature' });
        }

        let events: any[] = [];
        try {
          const parsed = JSON.parse(req.body.toString('utf8'));
          events = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          console.warn(JSON.stringify({ provider: 'sendgrid', signatureValid: true, eventType: null, latencyMs: Date.now() - startedAt, error: 'invalid_json' }));
          return res.status(400).json({ error: 'Invalid JSON' });
        }

        console.log(JSON.stringify({ provider: 'sendgrid', signatureValid: true, eventType: 'batch', count: events.length, latencyMs: Date.now() - startedAt }));
        // Acknowledge first so SendGrid doesn't retry on slow processing.
        res.status(200).json({ received: events.length });
        processSendGridEvents(events).catch(err =>
          console.error('[SendGrid Webhook] Processing error:', err?.message)
        );
      } catch (error: unknown) {
        console.error('[SendGrid Webhook] Error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Webhook processing error' });
        }
      }
    }
  );
  console.log('✅ SendGrid webhook route configured');

  // Task #91 (review fix): per-IP rate limiter on Xero webhook for parity with
  // the QBO route. Mounted before raw-body parser so blocked requests don't
  // even consume body buffers; HMAC verify still happens inside the handler.
  const { webhookRateLimiter: xeroWebhookLimiter } = await import('./routes/middleware');
  app.post(
    '/api/webhooks/xero',
    xeroWebhookLimiter,
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const startedAt = Date.now();
      try {
        const xeroService = await import('./xeroService');
        const signature = req.headers['x-xero-signature'] as string;

        if (!Buffer.isBuffer(req.body)) {
          console.warn(JSON.stringify({ provider: 'xero', signatureValid: false, eventType: null, latencyMs: Date.now() - startedAt, error: 'body_not_buffer' }));
          return res.status(401).send();
        }

        const rawBody = req.body.toString('utf8');

        if (!signature || !xeroService.verifyWebhookSignature(rawBody, signature)) {
          console.warn(JSON.stringify({ provider: 'xero', signatureValid: false, eventType: null, latencyMs: Date.now() - startedAt }));
          return res.status(401).send();
        }

        res.status(200).send();

        const payload = JSON.parse(rawBody);
        const events = payload.events || [];
        console.log(JSON.stringify({ provider: 'xero', signatureValid: true, eventType: 'batch', count: events.length, latencyMs: Date.now() - startedAt }));
        for (const event of events) {
          xeroService.processWebhookEvent({
            tenantId: event.tenantId,
            resourceId: event.resourceId,
            eventCategory: event.eventCategory,
            eventType: event.eventType,
          }).catch(err => console.error('[Xero Webhook] Event processing error:', err));
        }
      } catch (error: unknown) {
        console.error('[Xero Webhook] Error:', error);
        if (!res.headersSent) {
          res.status(200).send();
        }
      }
    }
  );
  console.log('✅ Xero webhook route configured');

  // QuickBooks Online webhook — HMAC-SHA256(rawBody, QBO_WEBHOOK_VERIFIER_TOKEN)
  // base64-compared against the `intuit-signature` header. Forged/unsigned
  // requests get a fast 401 before any storage call. Mounted BEFORE
  // express.json() so the raw buffer is intact for HMAC.
  app.post(
    '/api/webhooks/quickbooks',
    xeroWebhookLimiter,
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const startedAt = Date.now();
      try {
        const qbo = await import('./quickbooksService');
        const signature = req.headers['intuit-signature'] as string | undefined;

        if (!Buffer.isBuffer(req.body)) {
          console.warn(JSON.stringify({ provider: 'quickbooks', signatureValid: false, eventType: null, latencyMs: Date.now() - startedAt, error: 'body_not_buffer' }));
          return res.status(401).send();
        }
        const rawBody = req.body.toString('utf8');

        if (!qbo.verifyQboWebhookSignature(rawBody, signature)) {
          console.warn(JSON.stringify({ provider: 'quickbooks', signatureValid: false, eventType: null, latencyMs: Date.now() - startedAt }));
          return res.status(401).send();
        }

        res.status(200).send();

        const payload = JSON.parse(rawBody);
        const count = (payload?.eventNotifications || []).reduce(
          (acc: number, n: any) => acc + (n.dataChangeEvent?.entities?.length || 0), 0
        );
        console.log(JSON.stringify({ provider: 'quickbooks', signatureValid: true, eventType: 'batch', count, latencyMs: Date.now() - startedAt }));

        qbo.processQboWebhookPayload(payload).catch(err =>
          console.error('[QBO Webhook] Processing error:', err?.message || err)
        );
      } catch (error: unknown) {
        console.error('[QBO Webhook] Error:', error);
        if (!res.headersSent) res.status(200).send();
      }
    }
  );
  console.log('✅ QuickBooks webhook route configured');

  // Apple App Store Server Notifications V2 webhook.
  // Registered BEFORE express.json() so the raw JWS body is captured. The JWS
  // itself is self-signed (x5c chain anchored to Apple Root CA G3) so we don't
  // need a separate HMAC, but we still gate every side effect behind a fresh
  // verification of the outer + nested JWS payloads. Forged or unsigned
  // requests get a fast 401 before any storage call.
  app.post(
    '/api/iap/apple-notifications',
    express.raw({ type: '*/*', limit: '1mb' }),
    async (req, res) => {
      const startedAt = Date.now();
      const log = (fields: Record<string, unknown>) =>
        console.log(JSON.stringify({ provider: 'apple_iap', latencyMs: Date.now() - startedAt, ...fields }));

      const expectedBundleId = process.env.APPLE_IAP_BUNDLE_ID;
      if (!expectedBundleId) {
        log({ signatureValid: false, eventType: null, error: 'APPLE_IAP_BUNDLE_ID_not_set' });
        return res.status(401).json({ error: 'Webhook verification not configured' });
      }

      let signedPayload: string | undefined;
      try {
        const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
        const parsed = raw ? JSON.parse(raw) : {};
        signedPayload = parsed?.signedPayload;
      } catch {
        log({ signatureValid: false, eventType: null, error: 'malformed_json' });
        return res.status(401).json({ error: 'Invalid signature' });
      }

      if (!signedPayload || typeof signedPayload !== 'string') {
        log({ signatureValid: false, eventType: null, error: 'missing_signedPayload' });
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const { verifyAppleJws, verifyAppleNestedJws } = await import('./appleIapVerify');
      const outer = verifyAppleJws(signedPayload, expectedBundleId);
      if (!outer.valid || !outer.payload) {
        log({ signatureValid: false, eventType: null, error: outer.error });
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const notification = outer.payload;
      const { notificationType, subtype, data } = notification;

      let transactionInfo: any = null;
      if (data?.signedTransactionInfo) {
        const r = verifyAppleNestedJws(data.signedTransactionInfo, expectedBundleId);
        if (!r.valid) {
          log({ signatureValid: false, eventType: notificationType, error: `tx:${r.error}` });
          return res.status(401).json({ error: 'Invalid signature' });
        }
        transactionInfo = r.payload;
      }
      let renewalInfo: any = null;
      if (data?.signedRenewalInfo) {
        const r = verifyAppleNestedJws(data.signedRenewalInfo, expectedBundleId);
        if (!r.valid) {
          log({ signatureValid: false, eventType: notificationType, error: `renew:${r.error}` });
          return res.status(401).json({ error: 'Invalid signature' });
        }
        renewalInfo = r.payload;
      }

      try {
        const { applyAppleNotification } = await import('./appleIapWebhook');
        await applyAppleNotification({ notification, transactionInfo, renewalInfo });
        log({ signatureValid: true, eventType: notificationType, subtype: subtype || null });
        res.json({ ok: true });
      } catch (error: unknown) {
        console.error('[AppleWebhook] Error processing notification:', error);
        log({ signatureValid: true, eventType: notificationType, error: getErrorMessage(error) });
        // Apple retries on non-2xx; only fail-closed for signature problems.
        res.json({ ok: true, error: getErrorMessage(error) });
      }
    },
  );
  console.log('✅ Apple IAP webhook route configured');

  // Now apply JSON middleware for all other routes
  // Increase limit to 10MB for voice note and photo uploads (base64 encoded)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  const isDev = process.env.NODE_ENV !== 'production';
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "https://js.stripe.com",
          "https://*.googletagmanager.com",
          "https://cdnjs.cloudflare.com",
          ...(isDev ? ["'unsafe-inline'", "'unsafe-eval'"] : []),
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: [
          "'self'",
          "https://*.sentry.io",
          "https://maps.googleapis.com",
          "https://api.stripe.com",
          "https://*.google-analytics.com",
          "https://*.analytics.google.com",
          "https://*.googletagmanager.com",
          "https://*.replit.dev",
          "wss://*.replit.dev",
          ...(isDev ? ["'unsafe-inline'", "ws://localhost:*", "ws://127.0.0.1:*"] : []),
        ],
        frameSrc: ["'self'", "blob:", "https://js.stripe.com", "https://hooks.stripe.com"],
        frameAncestors: isDev
          ? ["'self'", "https://*.replit.dev", "https://*.replit.com", "https://replit.com"]
          : ["'self'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        workerSrc: ["'self'", "blob:"],
        mediaSrc: ["'self'", "blob:"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: isDev ? false : { action: 'sameorigin' },
  }));

  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'geolocation=(self), microphone=(self), camera=(self), payment=(self)');
    // Explicit indexing directive for crawlers. Overrides any upstream
    // X-Robots-Tag: noindex (e.g. some platform preview domains) so the
    // production site is indexable by Google/Bing. Auth/admin paths are
    // still excluded via robots.txt.
    res.setHeader(
      'X-Robots-Tag',
      'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    );
    next();
  });

  // Serve static public assets (logo, etc.) for emails
  app.use('/public', express.static('public'));

  // Universal / App Links discovery files (iOS AASA, Android assetlinks)
  // Must be served as application/json over HTTPS with no redirects.
  const { registerWellKnownRoutes } = await import('./wellKnown');
  registerWellKnownRoutes(app);

  // Detect if running on Replit (served via HTTPS even in development)
  const isReplit = !!process.env.REPL_ID;
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Trust proxy first (must be before session middleware)
  if (isReplit || isProduction) {
    app.set('trust proxy', 1);
  }
  
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: true,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: isReplit || isProduction,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    },
    name: 'jobrunner.sid',
    proxy: isReplit || isProduction
  }));

  app.use((req, _res, next) => {
    if (!req.headers['x-request-id']) {
      req.headers['x-request-id'] = randomUUID().substring(0, 8);
    }
    next();
  });

  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      // File uploads (multipart/form-data) can legitimately take minutes on slow
      // mobile connections, so they get a longer — but still finite — timeout.
      // Total size is still hard-capped by multer's per-route fileSize limit, and
      // concurrent in-flight uploads are bounded by the uploadQueue gate below.
      const isFileUpload = (req.headers['content-type'] || '').includes('multipart/form-data');
      const timeoutMs = isFileUpload ? 5 * 60 * 1000 : 30000;
      const timeout = setTimeout(() => {
        if (!res.headersSent) {
          res.status(504).json({ error: 'Request timeout' });
        }
      }, timeoutMs);
      res.on('finish', () => clearTimeout(timeout));
      res.on('close', () => clearTimeout(timeout));
    }
    next();
  });

  // Bound concurrent in-memory file uploads so a burst of large (up to 100MB)
  // uploads can't exhaust RAM. Sheds excess with HTTP 429 + Retry-After, which
  // both the web and mobile clients already handle gracefully.
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) return next();
    const isFileUpload = (req.headers['content-type'] || '').includes('multipart/form-data');
    if (!isFileUpload) return next();

    let acquired = false; // true once we own a live queue slot
    let aborted = false;  // request closed before/while waiting
    let released = false;
    const release = () => {
      if (acquired && !released) { released = true; uploadQueue.release(); }
    };
    // Attach listeners up front so a disconnect/timeout while still waiting in
    // the queue can't strand the slot once acquire() eventually resolves.
    res.on('finish', release);
    res.on('close', () => { aborted = true; release(); });

    uploadQueue.acquire().then(() => {
      acquired = true;
      if (aborted) {
        // Client already gone — hand the slot straight back, never call next().
        release();
        return;
      }
      next();
    }).catch((e) => {
      if (!aborted && !res.headersSent) send429(res, e);
    });
  });

  // Per-route timing + counters for /api/metrics (in-memory, ring buffer per route)
  app.use(metricsMiddleware);
  app.use(activityTrackingMiddleware);

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      // If the response was already sent — e.g. the 30s timeout middleware
      // above fired a 504 before a slow handler (PDF generation under load)
      // finished, then that handler's success send or catch-block error
      // response runs late — calling res.json again throws "Cannot set
      // headers after they are sent to the client" and surfaces as an
      // unhandled rejection. Quietly no-op instead of crashing the request.
      if (res.headersSent) {
        return res;
      }
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      }
    });

    next();
  });

  // Demo data seeding - only run in development or when explicitly enabled for Apple review
  // Set ENABLE_DEMO_DATA=true in production only during App Store review periods
  const enableDemoData = process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEMO_DATA === 'true';
  // NOTE: demo data seeding is intentionally DEFERRED until after the HTTP port
  // is open (see the server.listen callback below). On a cold production database
  // this seeding does heavy DB/network work that can be slow or fail; running it
  // before listen() blocks the deployment health probe and causes promote timeouts.

  const server = await registerRoutes(app);
  httpServer = server;

  Sentry.setupExpressErrorHandler(app);

  // Seed each existing user's signup day as day-0 activity so retention
  // cohorts aren't empty. Idempotent + fire-and-forget; never blocks startup.
  backfillSignupDayActivity().catch((err) => {
    console.error('[ActivityBackfill] failed:', err?.message || err);
  });

  // Grant the Leads / Communications / Action Centre permission keys to existing
  // manager/office-admin role rows that predate the keys, so the newly-enforced
  // API routes don't 403 roles that still see the menu. Idempotent + additive;
  // fire-and-forget so it never blocks startup.
  backfillFeaturePermissions().catch((err) => {
    console.error('[FeaturePermissionBackfill] failed:', err?.message || err);
  });

  // Validate dedicated phone numbers against Twilio on startup
  (async () => {
    try {
      const { listAllTwilioNumbers } = await import('./twilioClient');
      const result = await listAllTwilioNumbers();
      if (!result.success || !result.numbers) return;
      
      const twilioNumbers = new Set(result.numbers.map((n: any) => n.phoneNumber));
      const { db } = await import('./storage');
      const { businessSettings: bsTable } = await import('../shared/schema');
      const { isNotNull } = await import('drizzle-orm');
      
      const settingsWithNumbers = await db.select({
        userId: bsTable.userId,
        businessName: bsTable.businessName,
        dedicatedPhoneNumber: bsTable.dedicatedPhoneNumber,
      }).from(bsTable).where(isNotNull(bsTable.dedicatedPhoneNumber));
      
      for (const settings of settingsWithNumbers) {
        if (settings.dedicatedPhoneNumber && !twilioNumbers.has(settings.dedicatedPhoneNumber)) {
          console.log(`⚠️ [NumberValidation] Business "${settings.businessName}" has dedicated number ${settings.dedicatedPhoneNumber} but it no longer exists in Twilio. Clearing.`);
          await storage.updateBusinessSettings(settings.userId, {
            dedicatedPhoneNumber: null,
            smsMode: 'standard',
          });
        }
      }
      console.log(`✅ [NumberValidation] Validated ${settingsWithNumbers.length} dedicated number(s) against Twilio`);
    } catch (err) {
      console.error('[NumberValidation] Error validating dedicated numbers:', err);
    }

    const { reconcileBetaLifetimeAccess } = await import("./freemiumService");
    await reconcileBetaLifetimeAccess();
  })();

  // Set up WebSocket for real-time location tracking with session auth
  setupWebSocket(server, sessionStore);

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);

    // Seed demo data AFTER the port is open so it can never block the deployment
    // health probe. Non-essential and safe to fail; demo@jobrunner.com.au is only
    // needed for App Store review, not for serving real traffic.
    if (enableDemoData) {
      (async () => {
        try {
          await createDemoUserAndData();
          await createVisitorUser();
          await createDemoTeamMembers();
          await createDemoSubcontractorsAndInviteCodes();
          // Public "Try the Demo" account (trydemo@) — same rich data as demo@,
          // but it's the one visitors actually edit so demo@ stays untouched.
          await ensureTryDemoData();
          console.log('[Demo] Demo data seeding complete');
        } catch (err) {
          console.error('[Demo] Demo data seeding failed (non-fatal):', err);
        }
      })();
    }

    // Start background schedulers with staggered delays to prevent connection pool stampede
    const stagger = (fn: () => void, delayMs: number) => setTimeout(fn, delayMs);

    stagger(() => {
      import('./reminderScheduler').then(({ startAllSchedulers }) => {
        startAllSchedulers();
      }).catch(error => {
        console.error('Failed to start schedulers:', error);
      });
    }, 2000);

    stagger(() => {
      import('./retryScheduler').then(({ startRetryScheduler }) => {
        startRetryScheduler();
      }).catch(error => {
        console.error('Failed to start retry scheduler:', error);
      });
    }, 5000);

    stagger(() => {
      import('./lifecycleEmailService').then(({ startLifecycleEmailScheduler }) => {
        startLifecycleEmailScheduler();
      }).catch(error => {
        console.error('Failed to start lifecycle email scheduler:', error);
      });
    }, 8000);

    stagger(() => {
      import('./staleTimerService').then(({ checkAndAutoStopStaleTimers }) => {
        const STALE_TIMER_INTERVAL = 30 * 60 * 1000;
        setInterval(async () => {
          try {
            console.log('[Scheduler] Running stale timer detection...');
            const result = await checkAndAutoStopStaleTimers();
            if (result.stopped > 0 || result.errors > 0) {
              console.log(`[Scheduler] Stale timer check: ${result.stopped} stopped, ${result.errors} errors`);
            }
          } catch (error) {
            console.error('[Scheduler] Stale timer check failed:', error);
          }
        }, STALE_TIMER_INTERVAL);
        console.log('✅ Stale timer detection scheduler started (every 30 minutes)');
      }).catch(error => {
        console.error('Failed to start stale timer scheduler:', error);
      });
    }, 11000);

    stagger(() => {
      import('./overtimeNudgeService').then(({ checkOvertimeTimers }) => {
        const OVERTIME_INTERVAL = 15 * 60 * 1000;
        setInterval(async () => {
          try {
            await checkOvertimeTimers();
          } catch (error) {
            console.error('[Scheduler] Overtime nudge check failed:', error);
          }
        }, OVERTIME_INTERVAL);
        console.log('✅ Overtime nudge scheduler started (every 15 minutes)');
      }).catch(error => {
        console.error('Failed to start overtime nudge scheduler:', error);
      });
    }, 14000);
    
    if (enableDemoData) {
      stagger(() => startDemoDataRefreshScheduler(), 17000);
    }
  });
})();
