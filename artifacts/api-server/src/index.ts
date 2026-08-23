import "./instrument";
// Replit provides NEON_DATABASE_URL; alias it to the DATABASE_URL the legacy code expects.
if (!process.env.DATABASE_URL && process.env.NEON_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.NEON_DATABASE_URL;
}
import * as Sentry from "@sentry/node";
import express, { type Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import { createServer } from "http";
import { registerRoutes } from "./legacyRoutes";
import { storage, pool as sharedPgPool, guidedProjectSetupSchemaReady } from "./storage";
import { setupWebSocket } from "./websocket";
import { metricsMiddleware } from "./metrics";
import { activityTrackingMiddleware, backfillSignupDayActivity, backfillFeaturePermissions } from "./routes/middleware";
import { getErrorMessage } from "./lib/errors";
import { initializeStripe } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { uploadQueue, send429 } from "./concurrency";
import { logger } from "./lib/logger";

process.on('uncaughtException', (error: Error) => {
  Sentry.captureException(error);
  logger.fatal({ err: error }, 'uncaughtException');
});

process.on('unhandledRejection', (reason: unknown) => {
  Sentry.captureException(reason);
  logger.error({ err: reason }, 'unhandledRejection');
});

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

const app = express();

// Session configuration
if (process.env.NODE_ENV === 'production') {
  if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET required in production');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required in production');
}

let sessionStore: any;
if (process.env.DATABASE_URL) {
  const PgSession = connectPgSimple(session);
  sessionStore = new PgSession({
    pool: sharedPgPool as any,
    tableName: 'session',
    createTableIfMissing: false,
    errorLog: (err: any) => {
      logger.error({ err: err?.message || err }, '[SessionStore] pg error (handled)');
    },
  });
} else if (process.env.NODE_ENV === 'development') {
  sessionStore = undefined;
}

(async () => {
  await guidedProjectSetupSchemaReady;

  // Initialize Stripe and get webhook UUID
  const { stripe, webhookUuid } = await initializeStripe();

  // Initialize Twilio for SMS notifications
  const { initializeTwilio, configureTwilioWebhook } = await import('./twilioClient');
  const twilioReady = await initializeTwilio();
  if (twilioReady) {
    const webhookBaseUrl = process.env.APP_DOMAIN
      ? `https://${process.env.APP_DOMAIN}`
      : 'https://jobrunner.com.au';
    configureTwilioWebhook(webhookBaseUrl).catch((err) => {
      logger.error({ err }, '[Twilio] Failed to configure webhook (non-fatal)');
    });
  }

  // Register Stripe webhook route BEFORE express.json()
  if (webhookUuid) {
    app.post('/api/stripe/webhook/:uuid', express.raw({ type: 'application/json' }), async (req: any, res: any) => {
      const signature = req.headers['stripe-signature'];
      if (!signature) return res.status(400).json({ error: 'Missing stripe-signature' });
      try {
        const sig = Array.isArray(signature) ? signature[0] : signature;
        if (!Buffer.isBuffer(req.body)) return res.status(500).json({ error: 'Webhook processing error' });
        const { uuid } = req.params;
        await WebhookHandlers.processWebhook(req.body as Buffer, sig, uuid, storage);
        res.status(200).json({ received: true });
      } catch (error: unknown) {
        logger.error({ err: error }, 'Webhook error');
        res.status(400).json({ error: 'Webhook processing error' });
      }
    });
  }

  app.post('/api/vapi/webhook', express.raw({ type: 'application/json' }), async (req: any, res: any) => {
    try {
      const { processWebhookEvent, verifyVapiWebhook } = await import('./vapiService');
      const signature = req.headers['x-vapi-signature'] as string | undefined;
      const verbatimSecret = req.headers['x-vapi-secret'] as string | undefined;
      if (!Buffer.isBuffer(req.body)) return res.status(500).json({ error: 'Webhook processing error' });
      if (!verifyVapiWebhook(req.body, signature, verbatimSecret)) return res.status(401).json({ error: 'Invalid webhook signature' });
      const parsed = JSON.parse(req.body.toString('utf8'));
      const result = await processWebhookEvent(parsed);
      res.json(result);
    } catch (error: unknown) {
      logger.error({ err: error }, '[Vapi Webhook] Error');
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  app.post('/api/webhooks/sendgrid', express.raw({ type: 'application/json' }), async (req: any, res: any) => {
    try {
      const { verifySendGridWebhook, processSendGridEvents } = await import('./sendgridWebhook');
      const signature = req.headers['x-twilio-email-event-webhook-signature'] as string | undefined;
      const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string | undefined;
      if (!Buffer.isBuffer(req.body)) return res.status(400).json({ error: 'Invalid body' });
      if (!verifySendGridWebhook(req.body, signature, timestamp)) return res.status(401).json({ error: 'Invalid signature' });
      let events: any[] = [];
      try { const parsed = JSON.parse(req.body.toString('utf8')); events = Array.isArray(parsed) ? parsed : [parsed]; } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
      res.status(200).json({ received: events.length });
      processSendGridEvents(events).catch(err => logger.error({ err }, '[SendGrid Webhook] Processing error'));
    } catch (error: unknown) {
      logger.error({ err: error }, '[SendGrid Webhook] Error');
      if (!res.headersSent) res.status(500).json({ error: 'Webhook processing error' });
    }
  });

  // SendGrid Inbound Parse — client email replies land here.
  // SendGrid posts multipart/form-data; multer is used to extract text fields.
  {
    const multer = (await import('multer')).default;
    const { timingSafeEqual } = await import('crypto');

    // ── Step 1: Basic Auth middleware — runs BEFORE any body parsing so
    //   unauthenticated callers never trigger memory allocation in multer.
    const inboundAuth = (req: any, res: any, next: any) => {
      const configuredAuth = process.env.SENDGRID_INBOUND_BASIC_AUTH;
      if (configuredAuth) {
        const authHeader = (req.headers['authorization'] ?? '') as string;
        const match = authHeader.match(/^Basic\s+(.+)$/i);
        const provided = match ? Buffer.from(match[1], 'base64').toString('utf8') : '';
        const expected = Buffer.from(configuredAuth);
        // Pad to same length before constant-time compare (timing-safe even on length mismatch)
        const actual = Buffer.from(provided.padEnd(configuredAuth.length, '\0'));
        const valid = expected.length === actual.length && timingSafeEqual(expected, actual);
        if (!valid) {
          logger.warn('[SendGrid Inbound] Rejected — invalid or missing Basic Auth credentials');
          res.status(401).setHeader('WWW-Authenticate', 'Basic realm="SendGrid Inbound"').send('Unauthorized');
          return;
        }
      } else if (process.env.NODE_ENV === 'production') {
        // Fail closed: in production the credential MUST be configured.
        logger.error('[SendGrid Inbound] SENDGRID_INBOUND_BASIC_AUTH is not set — rejecting in production');
        res.status(503).send('Inbound webhook not configured');
        return;
      } else {
        logger.warn('[SendGrid Inbound] SENDGRID_INBOUND_BASIC_AUTH not set — unauthenticated (dev only)');
      }
      next();
    };

    // ── Step 2: Body parser — runs only after successful auth.
    // Uses multer().any() to accept text fields AND silently discard file
    // attachments (multer.none() rejects multipart requests that include files,
    // which is common when clients reply with photos or PDFs attached).
    const inboundUpload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 512 * 1024,  // accept but discard files ≤ 512 KB; larger are rejected by multer
        files: 10,
        fields: 20,
        fieldSize: 64 * 1024,  // each text field ≤ 64 KB
      },
    });
    const inboundParse = (req: any, res: any, next: any) => {
      const ct = (req.headers['content-type'] ?? '') as string;
      if (ct.includes('multipart/form-data')) {
        // .any() accepts files and fields; files are buffered then discarded by the handler
        inboundUpload.any()(req, res, next);
      } else {
        express.urlencoded({ extended: true, limit: '256kb' })(req, res, next);
      }
    };

    app.post(
      '/api/webhooks/sendgrid/inbound',
      inboundAuth,   // auth FIRST
      inboundParse,  // parse only after auth succeeds
      async (req: any, res: any) => {
        try {
          // Respond immediately — SendGrid retries if we take > 20 s
          res.status(200).send('OK');
          // Extract only text fields; any buffered file parts from req.files are ignored
          const fields: Record<string, string> = {};
          for (const [key, val] of Object.entries(req.body ?? {})) {
            if (typeof val === 'string') fields[key] = val;
            else if (Array.isArray(val) && typeof val[0] === 'string') fields[key] = val[0];
          }
          const { processInboundEmail } = await import('./inboundEmailService');
          processInboundEmail(fields).catch(err => logger.error({ err }, '[SendGrid Inbound] Processing error'));
        } catch (error: unknown) {
          logger.error({ err: error }, '[SendGrid Inbound] Error');
        }
      },
    );
  }

  const { webhookRateLimiter: xeroWebhookLimiter } = await import('./routes/middleware');

  app.post('/api/webhooks/xero', xeroWebhookLimiter as any, express.raw({ type: 'application/json' }), async (req: any, res: any) => {
    try {
      const xeroService = await import('./xeroService');
      const signature = req.headers['x-xero-signature'] as string;
      if (!Buffer.isBuffer(req.body)) return res.status(401).send();
      const rawBody = req.body.toString('utf8');
      if (!signature || !xeroService.verifyWebhookSignature(rawBody, signature)) return res.status(401).send();
      res.status(200).send();
      const payload = JSON.parse(rawBody);
      const events = payload.events || [];
      for (const event of events) {
        xeroService.processWebhookEvent({ tenantId: event.tenantId, resourceId: event.resourceId, eventCategory: event.eventCategory, eventType: event.eventType }).catch(err => logger.error({ err }, '[Xero Webhook] Event processing error'));
      }
    } catch (error: unknown) {
      logger.error({ err: error }, '[Xero Webhook] Error');
      if (!res.headersSent) res.status(200).send();
    }
  });

  app.post('/api/webhooks/quickbooks', xeroWebhookLimiter as any, express.raw({ type: 'application/json' }), async (req: any, res: any) => {
    try {
      const qbo = await import('./quickbooksService');
      const signature = req.headers['intuit-signature'] as string | undefined;
      if (!Buffer.isBuffer(req.body)) return res.status(401).send();
      const rawBody = req.body.toString('utf8');
      if (!qbo.verifyQboWebhookSignature(rawBody, signature)) return res.status(401).send();
      res.status(200).send();
      const payload = JSON.parse(rawBody);
      qbo.processQboWebhookPayload(payload).catch(err => logger.error({ err }, '[QBO Webhook] Processing error'));
    } catch (error: unknown) {
      logger.error({ err: error }, '[QBO Webhook] Error');
      if (!res.headersSent) res.status(200).send();
    }
  });

  app.post('/api/iap/apple-notifications', express.raw({ type: '*/*', limit: '1mb' }), async (req: any, res: any) => {
    try {
      const expectedBundleId = process.env.APPLE_IAP_BUNDLE_ID;
      if (!expectedBundleId) return res.status(401).json({ error: 'Webhook verification not configured' });
      let signedPayload: string | undefined;
      try { const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : ''; const parsed = raw ? JSON.parse(raw) : {}; signedPayload = parsed?.signedPayload; } catch { return res.status(401).json({ error: 'Invalid signature' }); }
      if (!signedPayload || typeof signedPayload !== 'string') return res.status(401).json({ error: 'Invalid signature' });
      const { verifyAppleJws, verifyAppleNestedJws } = await import('./appleIapVerify');
      const outer = verifyAppleJws(signedPayload, expectedBundleId);
      if (!outer.valid || !outer.payload) return res.status(401).json({ error: 'Invalid signature' });
      const notification = outer.payload;
      const { data, notificationType, subtype } = notification;
      let transactionInfo: any = null;
      if (data?.signedTransactionInfo) { const r = verifyAppleNestedJws(data.signedTransactionInfo, expectedBundleId); if (!r.valid) return res.status(401).json({ error: 'Invalid signature' }); transactionInfo = r.payload; }
      let renewalInfo: any = null;
      if (data?.signedRenewalInfo) { const r = verifyAppleNestedJws(data.signedRenewalInfo, expectedBundleId); if (!r.valid) return res.status(401).json({ error: 'Invalid signature' }); renewalInfo = r.payload; }
      const { applyAppleNotification } = await import('./appleIapWebhook');
      await applyAppleNotification({ notification, transactionInfo, renewalInfo });
      res.json({ ok: true });
    } catch (error: unknown) {
      logger.error({ err: error }, '[AppleWebhook] Error');
      res.json({ ok: true, error: getErrorMessage(error) });
    }
  });

  // Slack command bot — must be before express.json() (needs raw body for HMAC)
  const { registerSlackCommands } = await import('./slack-commands');
  registerSlackCommands(app);

  // JSON middleware (after raw webhook routes)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  const isDev = process.env.NODE_ENV !== 'production';
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://js.stripe.com", "https://*.googletagmanager.com", "https://cdnjs.cloudflare.com", ...(isDev ? ["'unsafe-inline'", "'unsafe-eval'"] : [])],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: ["'self'", "https://*.sentry.io", "https://maps.googleapis.com", "https://api.stripe.com", "https://*.google-analytics.com", "https://*.analytics.google.com", "https://*.googletagmanager.com", "https://*.replit.dev", "wss://*.replit.dev", ...(isDev ? ["'unsafe-inline'", "ws://localhost:*", "ws://127.0.0.1:*"] : [])],
        frameSrc: ["'self'", "blob:", "https://js.stripe.com", "https://hooks.stripe.com"],
        frameAncestors: isDev ? ["'self'", "https://*.replit.dev", "https://*.replit.com", "https://replit.com"] : ["'self'"],
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

  app.use((_req: any, res: any, next: any) => {
    res.setHeader('Permissions-Policy', 'geolocation=(self), microphone=(self), camera=(self), payment=(self)');
    res.setHeader('X-Robots-Tag', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    next();
  });

  app.use('/public', express.static('public'));

  const { registerWellKnownRoutes } = await import('./wellKnown');
  registerWellKnownRoutes(app);

  const isReplit = !!process.env.REPL_ID;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isReplit || isProduction) app.set('trust proxy', 1);

  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: true,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: isReplit || isProduction,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    },
    name: 'jobrunner.sid',
    proxy: isReplit || isProduction,
  }));

  app.use((req: any, _res: any, next: any) => {
    if (!req.headers['x-request-id']) req.headers['x-request-id'] = randomUUID().substring(0, 8);
    next();
  });

  app.use((req: any, res: any, next: any) => {
    if (req.path.startsWith('/api')) {
      const isFileUpload = (req.headers['content-type'] || '').includes('multipart/form-data');
      const timeoutMs = isFileUpload ? 5 * 60 * 1000 : 30000;
      const timeout = setTimeout(() => { if (!res.headersSent) res.status(504).json({ error: 'Request timeout' }); }, timeoutMs);
      res.on('finish', () => clearTimeout(timeout));
      res.on('close', () => clearTimeout(timeout));
    }
    next();
  });

  app.use((req: any, res: any, next: any) => {
    if (!req.path.startsWith('/api')) return next();
    const isFileUpload = (req.headers['content-type'] || '').includes('multipart/form-data');
    if (!isFileUpload) return next();
    let acquired = false, aborted = false, released = false;
    const release = () => { if (acquired && !released) { released = true; uploadQueue.release(); } };
    res.on('finish', release);
    res.on('close', () => { aborted = true; release(); });
    uploadQueue.acquire().then(() => {
      acquired = true;
      if (aborted) { release(); return; }
      next();
    }).catch((e: any) => { if (!aborted && !res.headersSent) send429(res, e); });
  });

  app.use(metricsMiddleware as any);
  app.use(activityTrackingMiddleware as any);

  app.use((req: any, res: any, next: any) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined;
    const originalResJson = res.json.bind(res);
    res.json = function (bodyJson: any, ...args: any[]) {
      capturedJsonResponse = bodyJson;
      if (res.headersSent) return res;
      return originalResJson(bodyJson, ...args);
    };
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (path.startsWith('/api')) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        if (logLine.length > 80) logLine = logLine.slice(0, 79) + '…';
        logger.info(logLine);
      }
    });
    next();
  });

  const { default: apiRouter } = await import('./routes');
  app.use('/api', apiRouter);

  const server = await registerRoutes(app);
  Sentry.setupExpressErrorHandler(app);

  backfillSignupDayActivity().catch((err) => logger.error({ err }, '[ActivityBackfill] failed'));
  backfillFeaturePermissions().catch((err) => logger.error({ err }, '[FeaturePermissionBackfill] failed'));

  setupWebSocket(server, sessionStore);

  server.listen({ port, host: '0.0.0.0', reusePort: true }, () => {
    logger.info({ port }, 'Server listening');

    const enableDemoData = process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEMO_DATA === 'true';
    if (enableDemoData) {
      (async () => {
        try {
          const { createDemoUserAndData, createVisitorUser, createDemoTeamMembers, createDemoSubcontractorsAndInviteCodes, ensureTryDemoData } = await import('./demoData');
          await createDemoUserAndData();
          await createVisitorUser();
          await createDemoTeamMembers();
          await createDemoSubcontractorsAndInviteCodes();
          await ensureTryDemoData();
        } catch (err) { logger.error({ err }, '[Demo] Demo data seeding failed (non-fatal)'); }
      })();
    }

    const stagger = (fn: () => void, delayMs: number) => setTimeout(fn, delayMs);
    stagger(() => { import('./reminderScheduler').then(({ startAllSchedulers }) => startAllSchedulers()).catch(err => logger.error({ err }, 'Failed to start schedulers')); }, 2000);
    stagger(() => { import('./prodSmokeScheduler').then(({ startProdSmokeScheduler }) => startProdSmokeScheduler()).catch(err => logger.error({ err }, 'Failed to start prod smoke scheduler')); }, 4000);
    stagger(() => { import('./retryScheduler').then(({ startRetryScheduler }) => startRetryScheduler()).catch(err => logger.error({ err }, 'Failed to start retry scheduler')); }, 5000);
    stagger(() => { import('./lifecycleEmailService').then(({ startLifecycleEmailScheduler }) => startLifecycleEmailScheduler()).catch(err => logger.error({ err }, 'Failed to start lifecycle email scheduler')); }, 8000);
    stagger(() => {
      import('./staleTimerService').then(({ checkAndAutoStopStaleTimers }) => {
        setInterval(async () => {
          try { await checkAndAutoStopStaleTimers(); } catch (error) { logger.error({ err: error }, '[Scheduler] Stale timer check failed'); }
        }, 30 * 60 * 1000);
      }).catch(err => logger.error({ err }, 'Failed to start stale timer scheduler'));
    }, 11000);
    stagger(() => {
      import('./overtimeNudgeService').then(({ checkOvertimeTimers }) => {
        setInterval(async () => { try { await checkOvertimeTimers(); } catch (error) { logger.error({ err: error }, '[Scheduler] Overtime nudge check failed'); } }, 15 * 60 * 1000);
      }).catch(err => logger.error({ err }, 'Failed to start overtime nudge scheduler'));
    }, 14000);
    if (enableDemoData) {
      stagger(() => { import('./demoData').then(({ startDemoDataRefreshScheduler }) => startDemoDataRefreshScheduler()).catch(err => logger.error({ err }, 'Failed to start demo refresh scheduler')); }, 17000);
    }
  });
})();
