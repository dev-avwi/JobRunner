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
 * 4. Install app to workspace
 * 5. Under "Basic Information" → App Credentials → Signing Secret
 *    → add as Replit secret: SLACK_SIGNING_SECRET
 * 6. Add the bot to #claude-commands: /invite @YourBotName
 * 7. Add the bot to #ai-logs and #jobrunner-bugs the same way
 *
 * Message posting uses the Replit-managed Slack connector (no SLACK_BOT_TOKEN
 * or webhook URL needed). Only ONE secret is required:
 *   SLACK_SIGNING_SECRET — from Basic Information → App Credentials
 * ─────────────────────────────────────────────────────────────────────────────
 */

import crypto from 'crypto';
import type { Application, Request, Response } from 'express';
import { ReplitConnectors } from '@replit/connectors-sdk';
import { pool } from './storage';
import { logger } from './lib/logger';

// ─── Channel IDs ─────────────────────────────────────────────────────────────
const CLAUDE_COMMANDS_CHANNEL = 'C0BPA019Q15';
const AI_LOGS_CHANNEL = 'C0BPV2HB43W'; // #ai-logs
const BUGS_CHANNEL = 'C0BQKM72ZC0';

// ─── Slack Web API via Replit connector ──────────────────────────────────────

async function slackPost(channel: string, text: string): Promise<void> {
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy('slack', '/chat.postMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, text }),
  });
  const data: any = await response.json();
  if (!data.ok) {
    logger.error({ slackError: data.error, channel }, '[Slack] chat.postMessage failed');
    throw new Error(`Slack API error: ${data.error}`);
  }
}

// ─── Signature verification ───────────────────────────────────────────────────

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
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body ?? '');
  const sigBase = `v0:${timestamp}:${rawBody}`;
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
  try {
    await pool.query('SELECT 1');
  } catch (err: any) {
    dbStatus = `❌ Error: ${err.message}`;
  }

  const uptimeSecs = Math.floor(process.uptime());
  const h = Math.floor(uptimeSecs / 3600);
  const m = Math.floor((uptimeSecs % 3600) / 60);
  const s = uptimeSecs % 60;
  const mem = process.memoryUsage();
  const mb = (b: number) => (b / 1024 / 1024).toFixed(1) + ' MB';
  const now = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' });

  const text = [
    '*🟢 JobRunner API — Health Check*',
    `Database:      ${dbStatus}`,
    `Uptime:        ${h}h ${m}m ${s}s`,
    `Memory (RSS):  ${mb(mem.rss)}`,
    `Heap used:     ${mb(mem.heapUsed)} / ${mb(mem.heapTotal)}`,
    `Time:          ${now} AEST`,
  ].join('\n');

  await slackPost(AI_LOGS_CHANNEL, text);
}

async function handleReport(): Promise<void> {
  const now = new Date();
  const minus24h = new Date(now.getTime() - 86400_000);
  const minus7d = new Date(now.getTime() - 7 * 86400_000);

  const [total, subs, d1, d7] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM users'),
    pool.query(`SELECT COUNT(*) FROM subscriptions WHERE status = 'active'`),
    pool.query('SELECT COUNT(*) FROM users WHERE created_at >= $1', [minus24h]),
    pool.query('SELECT COUNT(*) FROM users WHERE created_at >= $1', [minus7d]),
  ]);

  const text = [
    '*📊 JobRunner — User Report*',
    `Total users:          ${total.rows[0].count}`,
    `Active subscriptions: ${subs.rows[0].count}`,
    `New users (24h):      ${d1.rows[0].count}`,
    `New users (7 days):   ${d7.rows[0].count}`,
    `Generated: ${now.toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST`,
  ].join('\n');

  await slackPost(AI_LOGS_CHANNEL, text);
}

async function handleCustomers(): Promise<void> {
  const now = new Date();
  const minus30d = new Date(now.getTime() - 30 * 86400_000);

  const [total, subs, d30] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM users'),
    pool.query(`SELECT COUNT(*) FROM subscriptions WHERE status = 'active'`),
    pool.query('SELECT COUNT(*) FROM users WHERE created_at >= $1', [minus30d]),
  ]);

  const text = [
    '*👥 JobRunner — Customer Summary*',
    `Total users:           ${total.rows[0].count}`,
    `Active subscriptions:  ${subs.rows[0].count}`,
    `New signups (30 days): ${d30.rows[0].count}`,
    `Generated: ${now.toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST`,
  ].join('\n');

  await slackPost(AI_LOGS_CHANNEL, text);
}

async function handleBug(description: string): Promise<void> {
  const ts = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' });
  await slackPost(
    BUGS_CHANNEL,
    [
      '🔴 *BUG REPORT*',
      `From: Slack command`,
      `Description: ${description || '(no description provided)'}`,
      `Status: Open`,
      `Time: ${ts} AEST`,
    ].join('\n')
  );
  await slackPost(AI_LOGS_CHANNEL, `✅ Bug report filed to #jobrunner-bugs:\n_"${description}"_`);
}

async function handleHelp(): Promise<void> {
  const text = [
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
  ].join('\n');

  await slackPost(AI_LOGS_CHANNEL, text);
}

// ─── Route registration ───────────────────────────────────────────────────────

export function registerSlackCommands(app: Application): void {
  // Must be registered BEFORE express.json() so req.body arrives as a raw
  // Buffer — required for HMAC-SHA256 signature verification.
  app.post(
    '/slack/events',
    (req: any, res: any, next: any) => {
      // Capture the raw body before any JSON parsing touches it
      const express = require('express');
      express.raw({ type: '*/*', limit: '1mb' })(req, res, next);
    },
    async (req: Request, res: Response) => {
      try {
        // 1. Verify Slack signature
        if (!verifySlackSignature(req)) {
          logger.warn('[Slack] Signature verification failed');
          return res.status(403).json({ error: 'Invalid signature' });
        }

        // Parse raw buffer → JSON
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

        // 4. Filter: only process messages from #claude-commands; ignore bots/edits
        const event = body.event;
        if (
          !event ||
          event.type !== 'message' ||
          event.channel !== CLAUDE_COMMANDS_CHANNEL ||
          event.bot_id ||
          event.subtype // edits, deletions, thread broadcasts, etc.
        ) {
          return;
        }

        // 5. Parse command (strip leading slash if present)
        const raw = (event.text || '').trim();
        const text = raw.startsWith('/') ? raw.slice(1) : raw;
        const spaceIdx = text.indexOf(' ');
        const cmd = (spaceIdx === -1 ? text : text.slice(0, spaceIdx)).toLowerCase();
        const args = spaceIdx === -1 ? '' : text.slice(spaceIdx + 1).trim();

        logger.info({ cmd, channel: event.channel }, '[Slack] Command received');

        // 6. Dispatch
        switch (cmd) {
          case 'status':    await handleStatus(); break;
          case 'report':    await handleReport(); break;
          case 'customers': await handleCustomers(); break;
          case 'bug':       await handleBug(args); break;
          case 'help':      await handleHelp(); break;
          default:
            await slackPost(
              AI_LOGS_CHANNEL,
              `❓ Unknown command: \`${cmd || '(empty)'}\`\nType \`help\` for available commands.`
            );
        }
      } catch (err: any) {
        logger.error({ err }, '[Slack] Command handler error');
        // res already sent — can't reply to Slack; just log
      }
    }
  );

  logger.info('[Slack] /slack/events endpoint registered');
}
