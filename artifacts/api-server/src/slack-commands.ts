/**
 * Slack Command Bot — /slack/events endpoint
 *
 * SETUP GUIDE (api.slack.com):
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Go to https://api.slack.com/apps → Create New App → From scratch
 * 2. Under "Event Subscriptions": enable, set Request URL to
 *      https://jobrunner.com.au/slack/events
 *    Subscribe to bot events: message.channels
 * 3. Under "OAuth & Permissions" → Bot Token Scopes, add:
 *      chat:write       (post messages)
 *      channels:history (read messages)
 *      incoming-webhook (if you want webhook posting)
 * 4. Install app to workspace → copy the xoxb- token → set SLACK_BOT_TOKEN
 * 5. Under "Basic Information" → App Credentials → Signing Secret → set SLACK_SIGNING_SECRET
 * 6. Create an Incoming Webhook for #ai-logs → set SLACK_AI_LOGS_WEBHOOK
 * 7. Add the bot to #claude-commands: /invite @YourBotName
 * 8. Add the bot to #ai-logs and #jobrunner-bugs the same way
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Required env vars:
 *   SLACK_SIGNING_SECRET  — from Basic Information → Signing Secret
 *   SLACK_BOT_TOKEN       — xoxb- token from OAuth & Permissions
 *   SLACK_AI_LOGS_WEBHOOK — Incoming Webhook URL for #ai-logs
 */

import crypto from 'crypto';
import axios from 'axios';
import type { Application, Request, Response } from 'express';
import { WebClient } from '@slack/web-api';
import { pool } from './storage';
import { logger } from './lib/logger';

// ─── Channel IDs ─────────────────────────────────────────────────────────────
const CLAUDE_COMMANDS_CHANNEL = 'C0BPA019Q15';
const BUGS_CHANNEL = 'C0BQKM72ZC0';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Verify Slack's HMAC-SHA256 signature on the raw request body */
function verifySlackSignature(req: Request): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) {
    logger.warn('[Slack] SLACK_SIGNING_SECRET not set — rejecting all requests');
    return false;
  }
  const timestamp = req.headers['x-slack-request-timestamp'] as string | undefined;
  const slackSig = req.headers['x-slack-signature'] as string | undefined;
  if (!timestamp || !slackSig) return false;

  // Guard against replay attacks (5-minute window)
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (ageSeconds > 300) return false;

  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body);
  const sigBase = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${crypto.createHmac('sha256', secret).update(sigBase).digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(slackSig));
}

/** Post a plain text message to #ai-logs via Incoming Webhook */
async function postToAiLogs(text: string): Promise<void> {
  const url = process.env.SLACK_AI_LOGS_WEBHOOK;
  if (!url) {
    logger.warn('[Slack] SLACK_AI_LOGS_WEBHOOK not set — cannot post to #ai-logs');
    return;
  }
  await axios.post(url, { text }, { timeout: 8000 });
}

/** Post to any channel using the Bot token (needed for #jobrunner-bugs) */
function getSlackClient(): WebClient {
  return new WebClient(process.env.SLACK_BOT_TOKEN);
}

// ─── Command handlers ─────────────────────────────────────────────────────────

async function handleStatus(): Promise<void> {
  let dbStatus = '✅ Connected';
  try {
    await pool.query('SELECT 1');
  } catch (err: any) {
    dbStatus = `❌ Error: ${err.message}`;
  }

  const uptimeSecs = Math.floor(process.uptime());
  const hours = Math.floor(uptimeSecs / 3600);
  const mins = Math.floor((uptimeSecs % 3600) / 60);
  const secs = uptimeSecs % 60;
  const uptime = `${hours}h ${mins}m ${secs}s`;

  const mem = process.memoryUsage();
  const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1) + ' MB';

  const text = [
    '*🟢 JobRunner API — Health Check*',
    `Database:     ${dbStatus}`,
    `Server uptime: ${uptime}`,
    `Memory (RSS):  ${mb(mem.rss)}`,
    `Memory (heap used): ${mb(mem.heapUsed)} / ${mb(mem.heapTotal)}`,
    `Time: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST`,
  ].join('\n');

  await postToAiLogs(text);
}

async function handleReport(): Promise<void> {
  const now = new Date();
  const minus24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const minus7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [usersRes, activeSubsRes, new24hRes, new7dRes] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM users'),
    pool.query(`SELECT COUNT(*) FROM subscriptions WHERE status = 'active'`),
    pool.query('SELECT COUNT(*) FROM users WHERE created_at >= $1', [minus24h]),
    pool.query('SELECT COUNT(*) FROM users WHERE created_at >= $1', [minus7d]),
  ]);

  const text = [
    '*📊 JobRunner — User Report*',
    `Total users:          ${usersRes.rows[0].count}`,
    `Active subscriptions: ${activeSubsRes.rows[0].count}`,
    `New users (24h):      ${new24hRes.rows[0].count}`,
    `New users (7d):       ${new7dRes.rows[0].count}`,
    `Generated: ${now.toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST`,
  ].join('\n');

  await postToAiLogs(text);
}

async function handleCustomers(): Promise<void> {
  const now = new Date();
  const minus30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [usersRes, activeSubsRes, new30dRes] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM users'),
    pool.query(`SELECT COUNT(*) FROM subscriptions WHERE status = 'active'`),
    pool.query('SELECT COUNT(*) FROM users WHERE created_at >= $1', [minus30d]),
  ]);

  const text = [
    '*👥 JobRunner — Customer Summary*',
    `Total users:            ${usersRes.rows[0].count}`,
    `Active subscriptions:   ${activeSubsRes.rows[0].count}`,
    `New signups (30 days):  ${new30dRes.rows[0].count}`,
    `Generated: ${now.toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST`,
  ].join('\n');

  await postToAiLogs(text);
}

async function handleBug(description: string): Promise<void> {
  const slack = getSlackClient();
  const timestamp = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' });

  await slack.chat.postMessage({
    channel: BUGS_CHANNEL,
    text: [
      '🔴 *BUG REPORT*',
      `From: Slack command`,
      `Description: ${description || '(no description provided)'}`,
      `Status: Open`,
      `Time: ${timestamp} AEST`,
    ].join('\n'),
  });

  await postToAiLogs(`✅ Bug report filed to #jobrunner-bugs:\n_"${description}"_`);
}

async function handleHelp(): Promise<void> {
  const text = [
    '*🤖 JobRunner Slack Bot — Available Commands*',
    'Type in #claude-commands:',
    '',
    '`status`      — Server health: DB, uptime, memory usage',
    '`report`      — User counts and new signups (24h / 7d)',
    '`customers`   — Customer summary (total, active subs, 30-day signups)',
    '`bug [text]`  — File a bug report to #jobrunner-bugs',
    '`help`        — Show this message',
    '',
    'All results are posted to #ai-logs.',
  ].join('\n');

  await postToAiLogs(text);
}

// ─── Route registration ───────────────────────────────────────────────────────

export function registerSlackCommands(app: Application): void {
  // Must be registered before express.json() so the raw body is available
  // for HMAC signature verification.
  app.post(
    '/slack/events',
    // express.raw preserves the original body as a Buffer — required for HMAC
    (req: any, res: any, next: any) => {
      // Only apply raw parsing if Content-Type is application/json
      const ct = req.headers['content-type'] || '';
      if (ct.includes('application/json') || ct.includes('application/x-www-form-urlencoded')) {
        return (require('express').raw({ type: '*/*', limit: '1mb' }))(req, res, next);
      }
      next();
    },
    async (req: Request, res: Response) => {
      try {
        // 1. Verify Slack signature
        if (!verifySlackSignature(req)) {
          logger.warn('[Slack] Signature verification failed');
          return res.status(403).json({ error: 'Invalid signature' });
        }

        // Parse body (it's a raw Buffer at this point)
        let body: any;
        try {
          const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body ?? '');
          body = raw ? JSON.parse(raw) : {};
        } catch {
          return res.status(400).json({ error: 'Invalid JSON' });
        }

        // 2. URL verification challenge (one-time during Slack app setup)
        if (body.type === 'url_verification') {
          return res.status(200).type('text/plain').send(body.challenge);
        }

        // 3. Respond immediately (Slack requires <3s)
        res.status(200).send();

        // 4. Only handle messages from #claude-commands; ignore bots/edits
        const event = body.event;
        if (
          !event ||
          event.type !== 'message' ||
          event.channel !== CLAUDE_COMMANDS_CHANNEL ||
          event.bot_id ||
          event.subtype // edits, deletions, etc.
        ) {
          return;
        }

        const raw = (event.text || '').trim();
        // Strip leading slash if the user typed e.g. /status
        const text = raw.startsWith('/') ? raw.slice(1) : raw;
        const [cmd, ...args] = text.toLowerCase().split(/\s+/);
        const rest = args.join(' ');

        logger.info({ cmd, channel: event.channel }, '[Slack] Command received');

        // 5. Dispatch command
        switch (cmd) {
          case 'status':
            await handleStatus();
            break;
          case 'report':
            await handleReport();
            break;
          case 'customers':
            await handleCustomers();
            break;
          case 'bug': {
            // Preserve original casing for the bug description
            const originalArgs = text.slice(text.toLowerCase().indexOf('bug') + 3).trim();
            await handleBug(originalArgs || rest);
            break;
          }
          case 'help':
            await handleHelp();
            break;
          default:
            await postToAiLogs(
              `❓ Unknown command: \`${cmd}\`\nType \`help\` for available commands.`
            );
        }
      } catch (err: any) {
        logger.error({ err }, '[Slack] Command handler error');
        // Body already sent — just log, can't reply to Slack
      }
    }
  );

  logger.info('[Slack] /slack/events endpoint registered');
}
