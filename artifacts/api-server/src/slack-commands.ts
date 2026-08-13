/**
 * Slack Command Bot — /slack/events endpoint
 *
 * SETUP GUIDE (api.slack.com):
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Go to https://api.slack.com/apps → Create New App → From scratch
 * 2. Under "Event Subscriptions": enable, set Request URL to
 *      https://jobrunner.com.au/api/slack/events
 *    Subscribe to bot events: message.channels
 * 3. Under "OAuth & Permissions" → Bot Token Scopes, add:
 *      chat:write, chat:write.public, channels:history
 * 4. Install app to workspace
 * 5. Add credentials to Replit Secrets (never in code):
 *      SLACK_SIGNING_SECRET  — Basic Information → App Credentials → Signing Secret
 *      SLACK_BOT_TOKEN       — OAuth & Permissions → Bot OAuth Token (xoxb-…)
 *      SLACK_AI_LOGS_WEBHOOK — Incoming Webhooks → Add Webhook for #ai-logs
 * 6. Invite the bot to #claude-commands, #ai-logs, and #jobrunner-bugs
 * ─────────────────────────────────────────────────────────────────────────────
 */

import crypto from 'crypto';
import axios from 'axios';
import type { Application, Request, Response } from 'express';
import { WebClient } from '@slack/web-api';
import { pool } from './storage';
import { logger } from './lib/logger';

// ─── Channel IDs ─────────────────────────────────────────────────────────────
const CLAUDE_COMMANDS_CHANNEL = 'C0BPA019Q15'; // #claude-commands
const AI_LOGS_CHANNEL = 'C0BPV2HB43W';          // #ai-logs
const BUGS_CHANNEL = 'C0BQKM72ZC0';             // #jobrunner-bugs

// ─── Posting helpers ──────────────────────────────────────────────────────────

/** Post to #ai-logs via Incoming Webhook */
async function postToAiLogs(text: string): Promise<void> {
  const url = process.env.SLACK_AI_LOGS_WEBHOOK;
  if (!url) {
    logger.warn('[Slack] SLACK_AI_LOGS_WEBHOOK not set — cannot post to #ai-logs');
    return;
  }
  await axios.post(url, { text }, { timeout: 8000 });
}

/** Post to any channel using the bot token (e.g. #jobrunner-bugs) */
async function postWithBotToken(channel: string, text: string): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    logger.warn('[Slack] SLACK_BOT_TOKEN not set — cannot post message');
    return;
  }
  const client = new WebClient(token);
  await client.chat.postMessage({ channel, text });
}

// ─── Signature verification ───────────────────────────────────────────────────

function verifySlackSignature(req: Request): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) {
    logger.warn('[Slack] SLACK_SIGNING_SECRET not set — rejecting all requests');
    return false;
  }
  const timestamp = req.headers['x-slack-request-timestamp'] as string | undefined;
  const slackSig  = req.headers['x-slack-signature']          as string | undefined;
  if (!timestamp || !slackSig) return false;

  // Guard against replay attacks (5-minute window)
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const rawBody  = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body ?? '');
  const sigBase  = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${crypto.createHmac('sha256', secret).update(sigBase).digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(slackSig));
  } catch {
    return false;
  }
}

// ─── Command handlers ─────────────────────────────────────────────────────────

async function handleStatus(): Promise<void> {
  let dbStatus = '✅ Connected';
  try { await pool.query('SELECT 1'); } catch (e: any) { dbStatus = `❌ ${e.message}`; }

  const up  = Math.floor(process.uptime());
  const h   = Math.floor(up / 3600);
  const m   = Math.floor((up % 3600) / 60);
  const s   = up % 60;
  const mem = process.memoryUsage();
  const mb  = (b: number) => (b / 1024 / 1024).toFixed(1) + ' MB';

  await postToAiLogs([
    '*🟢 JobRunner API — Health Check*',
    `Database:      ${dbStatus}`,
    `Uptime:        ${h}h ${m}m ${s}s`,
    `Memory (RSS):  ${mb(mem.rss)}`,
    `Heap used:     ${mb(mem.heapUsed)} / ${mb(mem.heapTotal)}`,
    `Time:          ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST`,
  ].join('\n'));
}

async function handleReport(): Promise<void> {
  const now      = new Date();
  const minus24h = new Date(now.getTime() - 86400_000);
  const minus7d  = new Date(now.getTime() - 7 * 86400_000);

  const [total, subs, d1, d7] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM users'),
    pool.query(`SELECT COUNT(*) FROM subscriptions WHERE status = 'active'`),
    pool.query('SELECT COUNT(*) FROM users WHERE created_at >= $1', [minus24h]),
    pool.query('SELECT COUNT(*) FROM users WHERE created_at >= $1', [minus7d]),
  ]);

  await postToAiLogs([
    '*📊 JobRunner — User Report*',
    `Total users:          ${total.rows[0].count}`,
    `Active subscriptions: ${subs.rows[0].count}`,
    `New users (24h):      ${d1.rows[0].count}`,
    `New users (7 days):   ${d7.rows[0].count}`,
    `Generated: ${now.toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST`,
  ].join('\n'));
}

async function handleCustomers(): Promise<void> {
  const now     = new Date();
  const minus30 = new Date(now.getTime() - 30 * 86400_000);

  const [total, subs, d30] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM users'),
    pool.query(`SELECT COUNT(*) FROM subscriptions WHERE status = 'active'`),
    pool.query('SELECT COUNT(*) FROM users WHERE created_at >= $1', [minus30]),
  ]);

  await postToAiLogs([
    '*👥 JobRunner — Customer Summary*',
    `Total users:           ${total.rows[0].count}`,
    `Active subscriptions:  ${subs.rows[0].count}`,
    `New signups (30 days): ${d30.rows[0].count}`,
    `Generated: ${now.toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST`,
  ].join('\n'));
}

async function handleBug(description: string): Promise<void> {
  const ts = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' });
  await postWithBotToken(
    BUGS_CHANNEL,
    [
      '🔴 *BUG REPORT*',
      `From: Slack command`,
      `Description: ${description || '(no description provided)'}`,
      `Status: Open`,
      `Time: ${ts} AEST`,
    ].join('\n')
  );
  await postToAiLogs(`✅ Bug report filed to #jobrunner-bugs:\n_"${description}"_`);
}

async function handleHelp(): Promise<void> {
  await postToAiLogs([
    '*🤖 JobRunner Slack Bot — Available Commands*',
    'Type any of these in *#claude-commands*:',
    '',
    '`status`        — Server health: DB, uptime, memory',
    '`report`        — User counts and new signups (24h / 7d)',
    '`customers`     — Customer summary (total, active subs, 30-day signups)',
    '`bug [text]`    — File a bug report to #jobrunner-bugs',
    '`help`          — Show this message',
    '',
    '_All results are posted to #ai-logs._',
  ].join('\n'));
}

// ─── Route registration ───────────────────────────────────────────────────────

export function registerSlackCommands(app: Application): void {
  // Must be registered BEFORE express.json() so req.body is a raw Buffer —
  // required for HMAC-SHA256 signature verification.
  app.post(
    '/api/slack/events',
    (req: any, res: any, next: any) => {
      require('express').raw({ type: '*/*', limit: '1mb' })(req, res, next);
    },
    async (req: Request, res: Response) => {
      try {
        // 1. Verify Slack signature
        if (!verifySlackSignature(req)) {
          logger.warn('[Slack] Signature verification failed');
          return res.status(403).json({ error: 'Invalid signature' });
        }

        // Parse raw Buffer → JSON
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

        // 3. Respond 200 immediately — Slack requires a response within 3 seconds
        res.status(200).send();

        // 4. Only process messages from #claude-commands; ignore bots and edits
        const event = body.event;
        if (
          !event ||
          event.type !== 'message' ||
          event.channel !== CLAUDE_COMMANDS_CHANNEL ||
          event.bot_id ||
          event.subtype
        ) return;

        // 5. Parse command — strip leading slash if present
        const raw    = (event.text || '').trim();
        const text   = raw.startsWith('/') ? raw.slice(1) : raw;
        const spIdx  = text.indexOf(' ');
        const cmd    = (spIdx === -1 ? text : text.slice(0, spIdx)).toLowerCase();
        const args   = spIdx === -1 ? '' : text.slice(spIdx + 1).trim();

        logger.info({ cmd, channel: event.channel }, '[Slack] Command received');

        // 6. Dispatch
        switch (cmd) {
          case 'status':    await handleStatus();      break;
          case 'report':    await handleReport();      break;
          case 'customers': await handleCustomers();   break;
          case 'bug':       await handleBug(args);     break;
          case 'help':      await handleHelp();        break;
          default:
            await postToAiLogs(
              `❓ Unknown command: \`${cmd || '(empty)'}\`\nType \`help\` for available commands.`
            );
        }
      } catch (err: any) {
        logger.error({ err }, '[Slack] Command handler error');
      }
    }
  );

  logger.info('[Slack] /slack/events endpoint registered');
}
