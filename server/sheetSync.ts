// One-way Excel/Google Sheets sync (Task #306)
// JobRunner is the source of truth. On a schedule (or on demand) the owner's
// chosen data types are pushed OUT to a connected Google Sheet, or emailed as
// an Excel workbook. Strictly one-way: nothing is ever read back from the
// sheet. Each sync fully replaces the tab contents so rows never pile up.

import { google } from 'googleapis';
import * as XLSX from 'xlsx';
import { storage } from './storage';
import { getErrorMessage } from './lib/errors';
import { encrypt, decrypt } from './encryption';

// ── Token encryption at rest ────────────────────────────────────────────────
// Google OAuth tokens grant ongoing write access to the owner's spreadsheets,
// so they are stored AES-256-GCM encrypted (never plaintext). A value without
// the prefix (legacy plaintext or corrupt) is treated as invalid, which forces
// a safe reconnect rather than using or preserving it.

const TOKEN_ENC_PREFIX = 'enc:v1:';

export function sealToken(token: string | null | undefined): string | null {
  if (!token) return null;
  return TOKEN_ENC_PREFIX + encrypt(token);
}

export function openToken(stored: string | null | undefined): string | null {
  if (!stored || !stored.startsWith(TOKEN_ENC_PREFIX)) return null;
  try {
    return decrypt(stored.slice(TOKEN_ENC_PREFIX.length));
  } catch {
    return null;
  }
}

// ── OAuth (mirrors googleCalendarClient.ts per-user token pattern) ──────────

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

export const SHEET_SYNC_DATA_TYPES = ['clients', 'jobs', 'invoices', 'payments'] as const;
export type SheetSyncDataType = (typeof SHEET_SYNC_DATA_TYPES)[number];
export const SHEET_SYNC_FREQUENCIES = ['daily', 'weekly'] as const;
export const SHEET_SYNC_TARGETS = ['google_sheets', 'excel_email'] as const;

function getRedirectUri(): string {
  let baseUrl: string;
  const appUrl = process.env.VITE_APP_URL || process.env.APP_URL;
  if (appUrl) {
    baseUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
  } else if (process.env.REPLIT_DEV_DOMAIN) {
    baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  } else if (process.env.REPLIT_DOMAINS) {
    baseUrl = `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
  } else {
    baseUrl = 'http://localhost:5000';
  }
  return `${baseUrl.replace(/\/$/, '')}/api/sheet-sync/callback`;
}

export function isSheetSyncConfigured(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

function getOAuth2Client(): any {
  if (!isSheetSyncConfigured()) {
    throw new Error('Google Sheets credentials not configured');
  }
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, getRedirectUri());
}

export function getSheetsAuthorizationUrl(state: string): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    state,
  });
}

export async function handleSheetsOAuthCallback(code: string, userId: string): Promise<{ success: boolean; email?: string; error?: string }> {
  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      const existing = await storage.getBusinessSettings(userId);
      const existingRefresh = openToken(existing?.googleSheetsRefreshToken);
      if (existingRefresh) {
        tokens.refresh_token = existingRefresh;
      } else {
        return {
          success: false,
          error: 'No refresh token received. Please revoke JobRunner access in your Google Account settings and try again.',
        };
      }
    }

    oauth2Client.setCredentials(tokens);

    let email: string | undefined;
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      email = userInfo.data.email || undefined;
    } catch (e: unknown) {
      console.warn(`[SheetSync] Could not fetch user email: ${getErrorMessage(e)}`);
    }

    const updated = await storage.updateBusinessSettings(userId, {
      googleSheetsConnected: true,
      googleSheetsAccessToken: sealToken(tokens.access_token),
      googleSheetsRefreshToken: sealToken(tokens.refresh_token),
      googleSheetsTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      googleSheetsEmail: email || null,
    });
    if (!updated) return { success: false, error: 'Failed to save Google Sheets connection' };
    console.log(`[SheetSync] Google Sheets connected for user ${userId}: ${email}`);
    return { success: true, email };
  } catch (error: any) {
    let errorMessage = getErrorMessage(error) || 'Unknown error during authorization';
    if (errorMessage.includes('invalid_grant')) errorMessage = 'Authorization code expired. Please try connecting again.';
    if (errorMessage.includes('redirect_uri_mismatch')) errorMessage = 'OAuth configuration error. Please contact support.';
    console.error('[SheetSync] OAuth callback error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function disconnectSheets(userId: string): Promise<void> {
  await storage.updateBusinessSettings(userId, {
    googleSheetsConnected: false,
    googleSheetsAccessToken: null,
    googleSheetsRefreshToken: null,
    googleSheetsTokenExpiry: null,
    googleSheetsEmail: null,
    sheetSyncSpreadsheetId: null,
    sheetSyncSpreadsheetUrl: null,
  });
  console.log(`[SheetSync] Google Sheets disconnected for user ${userId}`);
}

async function getUserAccessToken(userId: string): Promise<string> {
  const settings = await storage.getBusinessSettings(userId);
  if (!settings?.googleSheetsConnected) {
    throw new Error('Google Sheets is not connected. Please connect it in Settings.');
  }
  // Decryption failure (or a legacy plaintext value) yields null → treat as
  // not connected and require a fresh OAuth, wiping the unusable tokens.
  const refreshToken = openToken(settings.googleSheetsRefreshToken);
  if (!refreshToken) {
    await storage.updateBusinessSettings(userId, {
      googleSheetsConnected: false,
      googleSheetsAccessToken: null,
      googleSheetsRefreshToken: null,
      googleSheetsTokenExpiry: null,
    });
    throw new Error('Google Sheets authorization incomplete. Please reconnect in Settings.');
  }

  const tokenExpiry = settings.googleSheetsTokenExpiry ? new Date(settings.googleSheetsTokenExpiry).getTime() : 0;
  const PROACTIVE_REFRESH_BUFFER = 10 * 60 * 1000;
  const storedAccessToken = openToken(settings.googleSheetsAccessToken);
  if (tokenExpiry >= Date.now() + PROACTIVE_REFRESH_BUFFER && storedAccessToken) {
    return storedAccessToken;
  }

  try {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();
    if (!credentials.access_token) throw new Error('No access token returned from refresh');
    await storage.updateBusinessSettings(userId, {
      googleSheetsAccessToken: sealToken(credentials.access_token),
      googleSheetsRefreshToken: credentials.refresh_token ? sealToken(credentials.refresh_token) : settings.googleSheetsRefreshToken,
      googleSheetsTokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
    });
    return credentials.access_token;
  } catch (error: unknown) {
    const msg = getErrorMessage(error) || '';
    const isPermanent = msg.includes('invalid_grant') || msg.includes('revoked') || msg.includes('unauthorized_client');
    if (isPermanent) {
      await storage.updateBusinessSettings(userId, { googleSheetsConnected: false });
      throw new Error('Google Sheets access was revoked. Please reconnect in Settings.');
    }
    throw new Error(`Failed to refresh Google Sheets access: ${msg}`);
  }
}

async function getSheetsApi(userId: string) {
  const accessToken = await getUserAccessToken(userId);
  const auth = getOAuth2Client();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: 'v4', auth });
}

// ── Export data builders (same field shapes as /api/export/* CSVs) ──────────

function fmtDateAU(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function money(v: any): string {
  const n = parseFloat(String(v ?? '0'));
  return isNaN(n) ? '0.00' : n.toFixed(2);
}

export interface ExportSheet {
  title: string;
  headers: string[];
  rows: any[][];
}

export async function buildExportSheets(userId: string, dataTypes: string[]): Promise<ExportSheet[]> {
  const wanted = SHEET_SYNC_DATA_TYPES.filter((t) => dataTypes.includes(t));
  const clientsData = await storage.getClients(userId);
  const clientMap = new Map(clientsData.map((c: any) => [c.id, c.name]));
  const sheets: ExportSheet[] = [];

  for (const type of wanted) {
    if (type === 'clients') {
      sheets.push({
        title: 'Clients',
        headers: ['Name', 'Email', 'Phone', 'Address', 'Notes', 'Created Date'],
        rows: clientsData.map((c: any) => [
          c.name || '', c.email || '', c.phone || '', c.address || '', c.notes || '', fmtDateAU(c.createdAt),
        ]),
      });
    } else if (type === 'jobs') {
      const jobsData = await storage.getJobs(userId);
      sheets.push({
        title: 'Jobs',
        headers: ['Title', 'Client Name', 'Status', 'Address', 'Scheduled Date', 'Description', 'Created Date'],
        rows: jobsData.map((j: any) => [
          j.title || '', clientMap.get(j.clientId) || '', j.status || '', j.address || '',
          fmtDateAU(j.scheduledAt), j.description || '', fmtDateAU(j.createdAt),
        ]),
      });
    } else if (type === 'invoices') {
      const invoicesData = await storage.getInvoices(userId);
      sheets.push({
        title: 'Invoices',
        headers: ['Invoice Number', 'Client Name', 'Title', 'Status', 'Subtotal', 'GST', 'Total', 'Due Date', 'Paid Date', 'Created Date'],
        rows: invoicesData.map((inv: any) => [
          inv.number || '', clientMap.get(inv.clientId) || '', inv.title || '', inv.status || '',
          money(inv.subtotal), money(inv.gstAmount), money(inv.total),
          fmtDateAU(inv.dueDate), fmtDateAU(inv.paidAt), fmtDateAU(inv.createdAt),
        ]),
      });
    } else if (type === 'payments') {
      const receiptsData = await storage.getReceipts(userId);
      sheets.push({
        title: 'Payments',
        headers: ['Receipt Number', 'Client Name', 'Amount', 'GST', 'Payment Method', 'Reference', 'Description', 'Paid Date'],
        rows: receiptsData.map((r: any) => [
          r.receiptNumber || '', clientMap.get(r.clientId) || '', money(r.amount), money(r.gstAmount),
          r.paymentMethod || '', r.paymentReference || '', r.description || '', fmtDateAU(r.paidAt),
        ]),
      });
    }
  }
  return sheets;
}

// ── Excel workbook ──────────────────────────────────────────────────────────

export async function buildExcelWorkbook(userId: string, dataTypes: string[]): Promise<Buffer> {
  const sheets = await buildExportSheets(userId, dataTypes);
  const wb = XLSX.utils.book_new();
  const about = XLSX.utils.aoa_to_sheet([
    ['JobRunner Data Export (one-way)'],
    [`Generated: ${new Date().toLocaleString('en-AU')}`],
    [''],
    ['This export is one-way only. Changes made in this file do NOT flow back into JobRunner.'],
    ['JobRunner remains the source of truth — each export replaces the previous data in full.'],
  ]);
  XLSX.utils.book_append_sheet(wb, about, 'Read Me');
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([s.headers, ...s.rows]);
    XLSX.utils.book_append_sheet(wb, ws, s.title);
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// ── Google Sheets push ──────────────────────────────────────────────────────

const READ_ME_TITLE = 'Read Me';

async function ensureSpreadsheet(userId: string, settings: any): Promise<{ spreadsheetId: string; url: string }> {
  const sheetsApi = await getSheetsApi(userId);

  if (settings.sheetSyncSpreadsheetId) {
    try {
      await sheetsApi.spreadsheets.get({ spreadsheetId: settings.sheetSyncSpreadsheetId, fields: 'spreadsheetId' });
      return {
        spreadsheetId: settings.sheetSyncSpreadsheetId,
        url: settings.sheetSyncSpreadsheetUrl || `https://docs.google.com/spreadsheets/d/${settings.sheetSyncSpreadsheetId}`,
      };
    } catch (e: any) {
      // Sheet was deleted or is inaccessible — create a fresh one below.
      console.warn(`[SheetSync] Stored spreadsheet unavailable for user ${userId}, creating a new one: ${getErrorMessage(e)}`);
    }
  }

  const businessName = settings.businessName || settings.name || 'JobRunner';
  const created = await sheetsApi.spreadsheets.create({
    requestBody: {
      properties: { title: `${businessName} — JobRunner Export` },
      sheets: [{ properties: { title: READ_ME_TITLE } }],
    },
    fields: 'spreadsheetId,spreadsheetUrl',
  });
  const spreadsheetId = created.data.spreadsheetId!;
  const url = created.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  await storage.updateBusinessSettings(userId, {
    sheetSyncSpreadsheetId: spreadsheetId,
    sheetSyncSpreadsheetUrl: url,
  });
  return { spreadsheetId, url };
}

export async function pushToGoogleSheet(userId: string, dataTypes: string[]): Promise<{ url: string }> {
  const settings = await storage.getBusinessSettings(userId);
  if (!settings) throw new Error('Business settings not found');

  const [{ spreadsheetId, url }, exportSheets] = await Promise.all([
    ensureSpreadsheet(userId, settings),
    buildExportSheets(userId, dataTypes),
  ]);
  const sheetsApi = await getSheetsApi(userId);

  // Discover existing tabs
  const meta = await sheetsApi.spreadsheets.get({ spreadsheetId, fields: 'sheets(properties(sheetId,title))' });
  const existing = new Map<string, number>();
  for (const s of meta.data.sheets || []) {
    if (s.properties?.title != null && s.properties.sheetId != null) {
      existing.set(s.properties.title, s.properties.sheetId);
    }
  }

  // Create any missing tabs (Read Me + one per data type)
  const neededTitles = [READ_ME_TITLE, ...exportSheets.map((s) => s.title)];
  const addRequests = neededTitles
    .filter((t) => !existing.has(t))
    .map((title) => ({ addSheet: { properties: { title } } }));
  if (addRequests.length > 0) {
    await sheetsApi.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: addRequests } });
  }

  // Clear + rewrite each data tab in full (replace semantics — no dup rows)
  const clearRanges = neededTitles.map((t) => `'${t.replace(/'/g, "''")}'`);
  await sheetsApi.spreadsheets.values.batchClear({ spreadsheetId, requestBody: { ranges: clearRanges } });

  const now = new Date();
  const data = [
    {
      range: `'${READ_ME_TITLE}'!A1`,
      values: [
        ['JobRunner Data Export (one-way)'],
        [`Last synced: ${now.toLocaleString('en-AU', { timeZone: settings.timezone || 'Australia/Sydney' })}`],
        [''],
        ['This sheet is refreshed automatically by JobRunner. It is ONE-WAY only:'],
        ['changes made here do NOT flow back into JobRunner, and each sync fully'],
        ['replaces the data tabs. JobRunner remains the source of truth.'],
      ],
    },
    ...exportSheets.map((s) => ({
      range: `'${s.title.replace(/'/g, "''")}'!A1`,
      values: [s.headers, ...s.rows],
    })),
  ];
  await sheetsApi.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'RAW', data },
  });

  return { url };
}

// ── Run a full sync for one owner ───────────────────────────────────────────

export async function runSheetSync(userId: string, opts?: { manual?: boolean }): Promise<{ success: boolean; url?: string; error?: string }> {
  const settings = await storage.getBusinessSettings(userId);
  if (!settings) return { success: false, error: 'Business settings not found' };

  const dataTypes: string[] = Array.isArray(settings.sheetSyncDataTypes) && settings.sheetSyncDataTypes.length > 0
    ? settings.sheetSyncDataTypes
    : ['clients', 'jobs', 'invoices', 'payments'];
  const target = settings.sheetSyncTarget || 'google_sheets';

  try {
    let url: string | undefined;
    if (target === 'excel_email') {
      const user = await storage.getUser(userId);
      const toEmail = settings.email || user?.email;
      if (!toEmail) throw new Error('No email address on file to send the Excel export to');
      const buffer = await buildExcelWorkbook(userId, dataTypes);
      const { sendEmailWithAttachment } = await import('./emailService');
      const dateStr = new Date().toISOString().slice(0, 10);
      await sendEmailWithAttachment({
        to: toEmail,
        subject: `Your JobRunner data export — ${dateStr}`,
        html: `
          <p>G'day,</p>
          <p>Attached is your scheduled JobRunner data export (${dataTypes.join(', ')}).</p>
          <p><strong>This export is one-way:</strong> changes made in the spreadsheet do not flow back into JobRunner. Each export contains the complete, current data.</p>
          <p>You can adjust what's included, the frequency, or turn this off in Settings &rarr; Data.</p>
        `,
        fromName: 'JobRunner',
        attachments: [{
          filename: `jobrunner-export-${dateStr}.xlsx`,
          content: buffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }],
      });
    } else {
      const result = await pushToGoogleSheet(userId, dataTypes);
      url = result.url;
    }

    await storage.updateBusinessSettings(userId, {
      sheetSyncLastRunAt: new Date(),
      sheetSyncLastStatus: 'success',
      sheetSyncLastError: null,
    });
    console.log(`[SheetSync] Sync succeeded for user ${userId} (${target}, ${dataTypes.join(',')})`);
    return { success: true, url };
  } catch (error: unknown) {
    const message = getErrorMessage(error) || 'Unknown sync error';
    console.error(`[SheetSync] Sync failed for user ${userId}:`, message);
    await storage.updateBusinessSettings(userId, {
      sheetSyncLastRunAt: new Date(),
      sheetSyncLastStatus: 'error',
      sheetSyncLastError: message.slice(0, 500),
    }).catch(() => {});
    // Surface the failure to the owner in-app (scheduled runs only — manual
    // runs report the error directly in the response).
    if (!opts?.manual) {
      try {
        await storage.createNotification({
          userId,
          type: 'sheet_sync_failed',
          title: 'Spreadsheet sync failed',
          message: `Your scheduled spreadsheet export didn't complete: ${message.slice(0, 200)}. Check Settings → Data to fix the connection or run it again.`,
          priority: 'important',
          actionUrl: '/settings?tab=data',
          actionLabel: 'Open Settings',
        });
      } catch (e) {
        console.error('[SheetSync] Failed to create failure notification:', e);
      }
    }
    return { success: false, error: message };
  }
}

// ── Scheduler entry point ───────────────────────────────────────────────────

const FREQUENCY_MS: Record<string, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

// Run slightly early so a "daily" sync that takes a moment to schedule doesn't
// drift later every day (interval poll is 30 min).
const DUE_TOLERANCE_MS = 25 * 60 * 1000;

export async function processDueSheetSyncs(): Promise<void> {
  const { pool } = await import('./storage');
  const result = await pool.query(
    `SELECT user_id, sheet_sync_frequency, sheet_sync_last_run_at
     FROM business_settings
     WHERE sheet_sync_enabled = true`
  );
  for (const row of result.rows) {
    const freq = FREQUENCY_MS[row.sheet_sync_frequency] || FREQUENCY_MS.daily;
    const lastRun = row.sheet_sync_last_run_at ? new Date(row.sheet_sync_last_run_at).getTime() : 0;
    if (Date.now() - lastRun >= freq - DUE_TOLERANCE_MS) {
      try {
        await runSheetSync(row.user_id);
      } catch (e) {
        console.error(`[SheetSync] Scheduled sync crashed for user ${row.user_id}:`, e);
      }
    }
  }
}
