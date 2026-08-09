import type { Express } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import * as XLSX from "xlsx";
import OpenAI from "openai";
import { storage, db } from "../storage";
import { and, eq, sql, isNotNull } from "drizzle-orm";
import {
  clients,
  jobs as jobsTable,
  quotes,
  quoteLineItems,
  invoices,
  invoiceLineItems,
  lineItemCatalog,
  businessSettings,
} from "@workspace/db";
import { requireAuth } from "./middleware";
import { ownerOnly } from "../permissions";
import { createNotification } from "../notifications";
import { logger } from "../logger";
import { persistImportFile, createPendingImportRun, finalizeImportRun } from "./import-history";

// ============================================================
// Smart Import: AI column mapping + edit-in-preview
// Accepts any messy CSV/XLSX, parses in a background job, uses
// OpenAI to propose column->field mappings, flags rows that
// can't be understood and duplicates, then commits the edited
// preview in an all-or-nothing batch with progress feedback.
// ============================================================

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export type SmartImportType = 'clients' | 'catalog' | 'jobs' | 'quotes' | 'invoices';
const VALID_TYPES: SmartImportType[] = ['clients', 'catalog', 'jobs', 'quotes', 'invoices'];
const MAX_IMPORT_ROWS = 5000;
const NOTIFY_THRESHOLD_ROWS = 500;

// Target fields the AI (and the user) can map columns onto, per import type.
export const IMPORT_FIELDS: Record<SmartImportType, { field: string; label: string; required?: boolean; kind?: 'number' | 'date' }[]> = {
  clients: [
    { field: 'name', label: 'Name', required: true },
    { field: 'firstName', label: 'First name' },
    { field: 'lastName', label: 'Last name' },
    { field: 'email', label: 'Email' },
    { field: 'phone', label: 'Phone' },
    { field: 'address', label: 'Address' },
    { field: 'street', label: 'Street' },
    { field: 'city', label: 'City/Suburb' },
    { field: 'state', label: 'State' },
    { field: 'postcode', label: 'Postcode' },
    { field: 'notes', label: 'Notes' },
  ],
  catalog: [
    { field: 'name', label: 'Item name', required: true },
    { field: 'description', label: 'Description' },
    { field: 'unit', label: 'Unit' },
    { field: 'unitPrice', label: 'Unit price', kind: 'number' },
    { field: 'defaultQty', label: 'Default qty', kind: 'number' },
    { field: 'tradeType', label: 'Trade/category' },
  ],
  jobs: [
    { field: 'title', label: 'Job title' },
    { field: 'refNumber', label: 'Reference #' },
    { field: 'clientName', label: 'Client name', required: true },
    { field: 'clientFirstName', label: 'Client first name' },
    { field: 'clientLastName', label: 'Client last name' },
    { field: 'clientEmail', label: 'Client email' },
    { field: 'address', label: 'Address' },
    { field: 'status', label: 'Status' },
    { field: 'scheduledAt', label: 'Scheduled date', kind: 'date' },
    { field: 'description', label: 'Description' },
    { field: 'notes', label: 'Notes' },
  ],
  quotes: [
    { field: 'title', label: 'Title' },
    { field: 'refNumber', label: 'Quote #' },
    { field: 'clientName', label: 'Client name', required: true },
    { field: 'clientFirstName', label: 'Client first name' },
    { field: 'clientLastName', label: 'Client last name' },
    { field: 'clientEmail', label: 'Client email' },
    { field: 'status', label: 'Status' },
    { field: 'total', label: 'Total', kind: 'number' },
    { field: 'subtotal', label: 'Subtotal', kind: 'number' },
    { field: 'gstAmount', label: 'GST/tax', kind: 'number' },
    { field: 'validUntil', label: 'Valid until', kind: 'date' },
    { field: 'description', label: 'Description' },
    { field: 'notes', label: 'Notes' },
    { field: 'lineDescription', label: 'Line item description' },
    { field: 'lineQty', label: 'Line qty', kind: 'number' },
    { field: 'lineUnitPrice', label: 'Line unit price', kind: 'number' },
    { field: 'lineTotal', label: 'Line total', kind: 'number' },
  ],
  invoices: [
    { field: 'title', label: 'Title' },
    { field: 'refNumber', label: 'Invoice #' },
    { field: 'clientName', label: 'Client name', required: true },
    { field: 'clientFirstName', label: 'Client first name' },
    { field: 'clientLastName', label: 'Client last name' },
    { field: 'clientEmail', label: 'Client email' },
    { field: 'status', label: 'Status' },
    { field: 'total', label: 'Total', kind: 'number' },
    { field: 'subtotal', label: 'Subtotal', kind: 'number' },
    { field: 'gstAmount', label: 'GST/tax', kind: 'number' },
    { field: 'dueDate', label: 'Due date', kind: 'date' },
    { field: 'description', label: 'Description' },
    { field: 'notes', label: 'Notes' },
    { field: 'lineDescription', label: 'Line item description' },
    { field: 'lineQty', label: 'Line qty', kind: 'number' },
    { field: 'lineUnitPrice', label: 'Line unit price', kind: 'number' },
    { field: 'lineTotal', label: 'Line total', kind: 'number' },
  ],
};

interface MappingSuggestion {
  field: string | null;
  confidence: number; // 0..1
}

interface RowIssue {
  row: number; // 0-based index into rows
  issues: string[];
}

interface DuplicateFlag {
  row: number;
  reason: string;
  matchId?: string; // existing client id (clients only — enables merge)
  matchName?: string;
}

interface SmartImportJob {
  id: string;
  userId: string;
  fileName: string;
  status: 'processing' | 'ready' | 'failed' | 'committing' | 'committed' | 'commit_failed';
  createdAt: number;
  error?: string;
  // preview payload
  type?: SmartImportType;
  typeConfidence?: number;
  aiUsed?: boolean;
  headers?: string[];
  rows?: Record<string, string>[];
  totalRows?: number;
  mappings?: Record<string, MappingSuggestion>;
  needsAttention?: RowIssue[];
  duplicates?: DuplicateFlag[];
  // commit progress
  commitProgress?: { total: number; done: number };
  result?: { imported: number; merged: number; skipped: number };
  // Task 300: import traceability — pending import_runs row + retained file
  importRunId?: string;
}

const jobs = new Map<string, SmartImportJob>();

// Purge jobs older than 2 hours so buffered rows don't accumulate forever.
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  Array.from(jobs.entries()).forEach(([id, job]) => {
    if (job.createdAt < cutoff) jobs.delete(id);
  });
}, 15 * 60 * 1000).unref?.();

// ---------- parsing ----------

function parseSpreadsheet(buffer: Buffer, fileName: string): { headers: string[]; rows: Record<string, string>[] } {
  const wb = XLSX.read(buffer, { type: 'buffer', raw: false, cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('The file has no sheets');
  const sheet = wb.Sheets[sheetName];
  const grid: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  // Drop fully-empty leading rows (common in messy Excel exports)
  while (grid.length && grid[0].every((c: any) => String(c ?? '').trim() === '')) grid.shift();
  if (grid.length < 2) throw new Error('The file needs a header row and at least one data row');
  const headerRow = grid[0].map((h: any, i: number) => {
    const s = String(h ?? '').trim();
    return s || `Column ${i + 1}`;
  });
  // De-duplicate header names so they can key objects
  const seen = new Map<string, number>();
  const headers = headerRow.map((h: string) => {
    const n = seen.get(h) || 0;
    seen.set(h, n + 1);
    return n === 0 ? h : `${h} (${n + 1})`;
  });
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < grid.length; r++) {
    const raw = grid[r];
    if (!raw || raw.every((c: any) => String(c ?? '').trim() === '')) continue; // skip blank rows
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = String(raw[i] ?? '').trim(); });
    rows.push(obj);
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`Maximum ${MAX_IMPORT_ROWS} rows per import. "${fileName}" has ${rows.length} data rows.`);
  }
  return { headers, rows };
}

// ---------- heuristic fallback mapping ----------

const HEURISTIC_MAPS: Record<SmartImportType, Record<string, string>> = {
  clients: {
    'name': 'name', 'client name': 'name', 'client': 'name', 'full name': 'name', 'company': 'name', 'company name': 'name', 'business name': 'name', 'customer': 'name', 'customer name': 'name',
    'first name': 'firstName', 'last name': 'lastName', 'surname': 'lastName',
    'email': 'email', 'email address': 'email', 'e-mail': 'email',
    'phone': 'phone', 'phone number': 'phone', 'mobile': 'phone', 'telephone': 'phone', 'contact number': 'phone',
    'address': 'address', 'street address': 'address', 'location': 'address', 'street': 'street', 'city': 'city', 'suburb': 'city', 'state': 'state', 'postcode': 'postcode', 'zip': 'postcode',
    'notes': 'notes', 'note': 'notes', 'comments': 'notes', 'comment': 'notes', 'description': 'notes',
  },
  catalog: {
    'name': 'name', 'item name': 'name', 'item': 'name', 'service': 'name', 'product': 'name',
    'description': 'description', 'desc': 'description', 'details': 'description',
    'unit': 'unit', 'uom': 'unit', 'unit of measure': 'unit',
    'unit price': 'unitPrice', 'price': 'unitPrice', 'rate': 'unitPrice', 'cost': 'unitPrice',
    'default qty': 'defaultQty', 'quantity': 'defaultQty', 'qty': 'defaultQty',
    'trade type': 'tradeType', 'trade': 'tradeType', 'category': 'tradeType',
  },
  jobs: {
    'title': 'title', 'job title': 'title', 'job name': 'title', 'job description': 'title', 'description': 'title',
    'client': 'clientName', 'client name': 'clientName', 'customer': 'clientName', 'customer name': 'clientName', 'company name': 'clientName',
    'client email': 'clientEmail', 'customer email': 'clientEmail', 'email': 'clientEmail', 'email address': 'clientEmail',
    'first name': 'clientFirstName', 'last name': 'clientLastName',
    'address': 'address', 'site address': 'address', 'job address': 'address', 'location': 'address',
    'status': 'status', 'job status': 'status',
    'date': 'scheduledAt', 'scheduled date': 'scheduledAt', 'start date': 'scheduledAt', 'job date': 'scheduledAt',
    'notes': 'notes', 'job notes': 'notes',
    'reference': 'refNumber', 'ref': 'refNumber', 'job number': 'refNumber', 'job #': 'refNumber', 'job no': 'refNumber',
  },
  quotes: {
    'title': 'title', 'quote title': 'title', 'description': 'title', 'quote description': 'title',
    'client': 'clientName', 'client name': 'clientName', 'customer': 'clientName', 'customer name': 'clientName', 'company name': 'clientName',
    'client email': 'clientEmail', 'customer email': 'clientEmail', 'email': 'clientEmail', 'email address': 'clientEmail',
    'status': 'status', 'quote status': 'status',
    'total': 'total', 'amount': 'total', 'quote total': 'total',
    'subtotal': 'subtotal', 'sub total': 'subtotal',
    'gst': 'gstAmount', 'tax': 'gstAmount',
    'valid until': 'validUntil', 'expiry': 'validUntil', 'expiry date': 'validUntil',
    'notes': 'notes',
    'reference': 'refNumber', 'quote number': 'refNumber', 'quote #': 'refNumber', 'quote no': 'refNumber',
    'line description': 'lineDescription', 'item description': 'lineDescription',
    'quantity': 'lineQty', 'qty': 'lineQty', 'unit price': 'lineUnitPrice', 'line total': 'lineTotal',
  },
  invoices: {
    'title': 'title', 'invoice title': 'title', 'description': 'title', 'invoice description': 'title',
    'client': 'clientName', 'client name': 'clientName', 'customer': 'clientName', 'customer name': 'clientName', 'company name': 'clientName',
    'client email': 'clientEmail', 'customer email': 'clientEmail', 'email': 'clientEmail', 'email address': 'clientEmail',
    'status': 'status', 'invoice status': 'status', 'payment status': 'status',
    'total': 'total', 'amount': 'total', 'invoice total': 'total',
    'subtotal': 'subtotal', 'sub total': 'subtotal',
    'gst': 'gstAmount', 'tax': 'gstAmount',
    'due date': 'dueDate', 'payment due': 'dueDate',
    'notes': 'notes',
    'reference': 'refNumber', 'invoice number': 'refNumber', 'invoice #': 'refNumber', 'invoice no': 'refNumber',
    'line description': 'lineDescription', 'item description': 'lineDescription',
    'quantity': 'lineQty', 'qty': 'lineQty', 'unit price': 'lineUnitPrice', 'line total': 'lineTotal',
  },
};

function heuristicMappings(headers: string[], type: SmartImportType): Record<string, MappingSuggestion> {
  const map = HEURISTIC_MAPS[type];
  const out: Record<string, MappingSuggestion> = {};
  for (const h of headers) {
    const field = map[h.toLowerCase().trim()] || null;
    out[h] = { field, confidence: field ? 0.7 : 0 };
  }
  return out;
}

function heuristicDetectType(headers: string[]): { type: SmartImportType; confidence: number } {
  let best: SmartImportType = 'clients';
  let bestScore = 0;
  for (const t of VALID_TYPES) {
    const m = heuristicMappings(headers, t);
    const score = Object.values(m).filter(v => v.field).length;
    if (score > bestScore) { bestScore = score; best = t; }
  }
  return { type: best, confidence: headers.length ? Math.min(0.9, bestScore / headers.length) : 0 };
}

// ---------- AI mapping ----------

async function aiProposeMappings(
  headers: string[],
  sampleRows: Record<string, string>[],
  requestedType?: SmartImportType,
): Promise<{ type: SmartImportType; typeConfidence: number; mappings: Record<string, MappingSuggestion> } | null> {
  try {
    const fieldCatalog = Object.fromEntries(
      Object.entries(IMPORT_FIELDS).map(([t, fields]) => [t, fields.map(f => `${f.field} (${f.label})`)])
    );
    const samples = sampleRows.slice(0, 5).map(r => headers.map(h => r[h] ?? ''));
    const prompt = [
      `You are mapping spreadsheet columns for a trade-business app import.`,
      requestedType
        ? `The user says this file contains: ${requestedType}. Use type "${requestedType}".`
        : `First decide which import type this file is: one of ${VALID_TYPES.join(', ')}.`,
      `Available target fields per type: ${JSON.stringify(fieldCatalog)}`,
      `Column headers: ${JSON.stringify(headers)}`,
      `Sample rows (same column order): ${JSON.stringify(samples)}`,
      `Rules: map each header to exactly one target field of the chosen type, or null if it doesn't correspond to any field. Never map two headers to the same field unless one is clearly better — in that case map the weaker one to null. Use the sample values (not just header names) to decide. Confidence is 0-1.`,
      `Respond with JSON only: {"type": "<type>", "typeConfidence": <0-1>, "mappings": {"<header>": {"field": "<field id or null>", "confidence": <0-1>}, ...}} with an entry for EVERY header. "field" must be the bare field id (e.g. "name"), never the label.`,
    ].join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 6000,
      response_format: { type: 'json_object' },
    });
    const text = completion.choices[0]?.message?.content;
    if (!text) return null;
    const parsed = JSON.parse(text);
    const type: SmartImportType = requestedType || (VALID_TYPES.includes(parsed.type) ? parsed.type : 'clients');
    const fieldByLower = new Map(IMPORT_FIELDS[type].map(f => [f.field.toLowerCase(), f.field]));
    const mappings: Record<string, MappingSuggestion> = {};
    const usedFields = new Set<string>();
    const headerLookup = new Map(headers.map(h => [h.toLowerCase().trim(), h]));
    const rawMappings: Record<string, any> = {};
    for (const [k, v] of Object.entries(parsed.mappings || {})) {
      const canonical = headerLookup.get(k.toLowerCase().trim());
      if (canonical) rawMappings[canonical] = v;
    }
    for (const h of headers) {
      const m = rawMappings[h];
      // Tolerate both {"field": "...", "confidence": n} and a bare string value.
      const rawField = typeof m === 'string' ? m : (m && typeof m.field === 'string' ? m.field : null);
      // Normalise e.g. "name (Name)" → "name"
      const cleanedField = rawField ? rawField.replace(/\(.*\)/, '').trim().toLowerCase() : null;
      let field: string | null = cleanedField ? (fieldByLower.get(cleanedField) || null) : null;
      if (field && usedFields.has(field)) field = null; // enforce one column per field
      if (field) usedFields.add(field);
      const confidence = m && typeof m === 'object' && typeof m.confidence === 'number' ? Math.max(0, Math.min(1, m.confidence)) : (field ? 0.5 : 0);
      mappings[h] = { field, confidence };
    }
    const typeConfidence = typeof parsed.typeConfidence === 'number' ? Math.max(0, Math.min(1, parsed.typeConfidence)) : 0.8;
    return { type, typeConfidence, mappings };
  } catch (err: any) {
    logger.warn?.('background', `AI mapping failed, using heuristics: ${err?.message}`);
    return null;
  }
}

// ---------- value coercion + validation ----------

function parseImportDate(raw?: string): Date | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  const auMatch = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (auMatch) {
    const day = parseInt(auMatch[1], 10);
    const month = parseInt(auMatch[2], 10);
    let year = parseInt(auMatch[3], 10);
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const dt = new Date(year, month - 1, day);
      if (dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day) return dt;
    }
  }
  const native = new Date(s);
  return isNaN(native.getTime()) ? undefined : native;
}

function parseImportNumber(raw?: string): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const cleaned = String(raw).replace(/[$,\s]/g, '').replace(/^AUD?/i, '');
  if (cleaned === '') return undefined;
  const n = parseFloat(cleaned);
  return isNaN(n) ? undefined : n;
}

function applyMappings(row: Record<string, string>, mappings: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [header, field] of Object.entries(mappings)) {
    if (!field) continue;
    const v = row[header];
    if (v !== undefined && v !== '') mapped[field] = v;
  }
  if (!mapped.name && (mapped.firstName || mapped.lastName)) {
    mapped.name = [mapped.firstName, mapped.lastName].filter(Boolean).join(' ');
  }
  if (!mapped.clientName && (mapped.clientFirstName || mapped.clientLastName)) {
    mapped.clientName = [mapped.clientFirstName, mapped.clientLastName].filter(Boolean).join(' ');
  }
  if (!mapped.address && mapped.street) {
    mapped.address = [mapped.street, mapped.city, mapped.state, mapped.postcode].filter(Boolean).join(', ');
  }
  return mapped;
}

function flattenMappings(mappings: Record<string, MappingSuggestion>): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [h, m] of Object.entries(mappings)) {
    if (m.field) flat[h] = m.field;
  }
  return flat;
}

/** Returns human-readable issues for a single row, or [] if the row is importable. */
export function validateRow(type: SmartImportType, mapped: Record<string, string>): string[] {
  const issues: string[] = [];
  if (type === 'clients') {
    if (!mapped.name) issues.push('Name is missing');
    if (mapped.email && !/.+@.+\..+/.test(mapped.email)) issues.push(`"${mapped.email}" doesn't look like an email`);
  } else if (type === 'catalog') {
    if (!mapped.name) issues.push('Item name is missing');
    if (mapped.unitPrice !== undefined && parseImportNumber(mapped.unitPrice) === undefined) issues.push(`Unit price "${mapped.unitPrice}" is not a number`);
  } else if (type === 'jobs') {
    if (!mapped.title && !mapped.refNumber) issues.push('Job title or reference is missing');
    if (!mapped.clientName) issues.push('Client name is missing');
    if (mapped.scheduledAt && !parseImportDate(mapped.scheduledAt)) issues.push(`Can't read the date "${mapped.scheduledAt}"`);
  } else if (type === 'quotes' || type === 'invoices') {
    if (!mapped.clientName) issues.push('Client name is missing');
    if (mapped.total !== undefined && parseImportNumber(mapped.total) === undefined) issues.push(`Total "${mapped.total}" is not a number`);
    const dateField = type === 'quotes' ? 'validUntil' : 'dueDate';
    if (mapped[dateField] && !parseImportDate(mapped[dateField])) issues.push(`Can't read the date "${mapped[dateField]}"`);
  }
  return issues;
}

function mapStatus(status: string, type: SmartImportType): string {
  const s = status.toLowerCase().trim();
  if (type === 'jobs') {
    if (['completed', 'complete', 'done', 'finished', 'closed'].includes(s)) return 'done';
    if (['in progress', 'in_progress', 'started', 'active', 'work order'].includes(s)) return 'in_progress';
    if (['scheduled', 'confirmed', 'booked'].includes(s)) return 'scheduled';
    if (['invoiced', 'billed'].includes(s)) return 'invoiced';
    if (['cancelled', 'canceled', 'deleted'].includes(s)) return 'cancelled';
    return 'pending';
  }
  if (type === 'quotes') {
    if (['accepted', 'approved', 'won'].includes(s)) return 'accepted';
    if (['declined', 'rejected', 'lost'].includes(s)) return 'declined';
    if (['sent', 'pending', 'awaiting', 'open'].includes(s)) return 'sent';
    return 'draft';
  }
  if (type === 'invoices') {
    if (['paid', 'complete', 'completed', 'closed'].includes(s)) return 'paid';
    if (['overdue', 'past due', 'late'].includes(s)) return 'overdue';
    if (['sent', 'pending', 'awaiting payment', 'open', 'unpaid', 'outstanding'].includes(s)) return 'sent';
    return 'draft';
  }
  return status;
}

// ---------- duplicate detection ----------

async function detectDuplicates(
  userId: string,
  type: SmartImportType,
  rows: Record<string, string>[],
  flatMappings: Record<string, string>,
): Promise<DuplicateFlag[]> {
  const duplicates: DuplicateFlag[] = [];

  if (type === 'clients') {
    const existing = await storage.getClients(userId);
    const byEmail = new Map(existing.filter(c => c.email).map(c => [c.email!.toLowerCase(), c]));
    const byPhone = new Map(existing.filter(c => c.phone).map(c => [c.phone!.replace(/\s+/g, ''), c]));
    const byName = new Map(existing.filter(c => c.name).map(c => [c.name!.toLowerCase().trim(), c]));
    const seenInBatch = new Set<string>();
    for (let i = 0; i < rows.length; i++) {
      const mapped = applyMappings(rows[i], flatMappings);
      const batchKey = (mapped.email || mapped.phone || mapped.name || '').toLowerCase().trim();
      if (batchKey && seenInBatch.has(batchKey)) {
        duplicates.push({ row: i, reason: 'Duplicate row within this file' });
        continue;
      }
      if (batchKey) seenInBatch.add(batchKey);
      const emailMatch = mapped.email ? byEmail.get(mapped.email.toLowerCase()) : undefined;
      const phoneMatch = !emailMatch && mapped.phone ? byPhone.get(mapped.phone.replace(/\s+/g, '')) : undefined;
      const nameMatch = !emailMatch && !phoneMatch && mapped.name ? byName.get(mapped.name.toLowerCase().trim()) : undefined;
      const match = emailMatch || phoneMatch || nameMatch;
      if (match) {
        const via = emailMatch ? `email "${mapped.email}"` : phoneMatch ? `phone "${mapped.phone}"` : `name "${mapped.name}"`;
        duplicates.push({ row: i, reason: `Matches existing client "${match.name}" (same ${via})`, matchId: match.id, matchName: match.name });
      }
    }
    return duplicates;
  }

  if (type === 'catalog') return duplicates;

  // jobs / quotes / invoices: ref-tag + title|client matching
  const clientsList = await storage.getClients(userId);
  const clientNameById = new Map(clientsList.map(c => [c.id, c.name?.toLowerCase().trim()]));
  const records: any[] = type === 'jobs' ? await storage.getJobs(userId)
    : type === 'quotes' ? await storage.getQuotes(userId)
    : await storage.getInvoices(userId);
  const importedRefs = new Set<string>();
  const existingNumbers = new Set<string>();
  const existingTitleClient = new Set<string>();
  for (const r of records) {
    if (r.notes) {
      const m = r.notes.match(/\[Imported-Ref:([^\]]+)\]/);
      if (m) importedRefs.add(m[1].toLowerCase());
    }
    if (r.number) existingNumbers.add(String(r.number).toLowerCase());
    const cn = clientNameById.get(r.clientId) || '';
    if (r.title) existingTitleClient.add(`${r.title.toLowerCase().trim()}|${cn}`);
  }
  const seenInBatch = new Set<string>();
  const noun = type === 'jobs' ? 'Job' : type === 'quotes' ? 'Quote' : 'Invoice';
  for (let i = 0; i < rows.length; i++) {
    const mapped = applyMappings(rows[i], flatMappings);
    const batchKey = `${(mapped.refNumber || mapped.title || '').toLowerCase().trim()}|${(mapped.clientName || '').toLowerCase().trim()}`;
    if (batchKey !== '|' && seenInBatch.has(batchKey)) {
      duplicates.push({ row: i, reason: 'Duplicate row within this file' });
      continue;
    }
    if (batchKey !== '|') seenInBatch.add(batchKey);
    if (mapped.refNumber && importedRefs.has(mapped.refNumber.toLowerCase())) {
      duplicates.push({ row: i, reason: `${noun} "${mapped.refNumber}" was already imported` });
    } else if (mapped.refNumber && existingNumbers.has(mapped.refNumber.toLowerCase())) {
      duplicates.push({ row: i, reason: `${noun} number "${mapped.refNumber}" already exists` });
    } else {
      const title = (mapped.title || '').toLowerCase().trim();
      const clientName = (mapped.clientName || '').toLowerCase().trim();
      if (title && clientName && existingTitleClient.has(`${title}|${clientName}`)) {
        duplicates.push({ row: i, reason: `${noun} "${mapped.title}" for "${mapped.clientName}" may already exist` });
      }
    }
  }
  return duplicates;
}

// ---------- background preview processing ----------

async function processPreviewJob(job: SmartImportJob, buffer: Buffer, requestedType?: SmartImportType) {
  try {
    const { headers, rows } = parseSpreadsheet(buffer, job.fileName);
    job.headers = headers;
    job.rows = rows;
    job.totalRows = rows.length;

    const ai = await aiProposeMappings(headers, rows, requestedType);
    let type: SmartImportType;
    let typeConfidence: number;
    let mappings: Record<string, MappingSuggestion>;
    if (ai) {
      type = ai.type;
      typeConfidence = ai.typeConfidence;
      mappings = ai.mappings;
      job.aiUsed = true;
      // Backfill obvious heuristic matches the AI left unmapped
      const heur = heuristicMappings(headers, type);
      for (const h of headers) {
        if (!mappings[h]?.field && heur[h]?.field) {
          const alreadyUsed = Object.values(mappings).some(m => m.field === heur[h].field);
          if (!alreadyUsed) mappings[h] = heur[h];
        }
      }
    } else {
      const detected = requestedType ? { type: requestedType, confidence: 1 } : heuristicDetectType(headers);
      type = detected.type;
      typeConfidence = detected.confidence;
      mappings = heuristicMappings(headers, type);
      job.aiUsed = false;
    }
    job.type = type;
    job.typeConfidence = typeConfidence;
    job.mappings = mappings;

    const flat = flattenMappings(mappings);
    job.needsAttention = rows
      .map((r, i) => ({ row: i, issues: validateRow(type, applyMappings(r, flat)) }))
      .filter(x => x.issues.length > 0);
    job.duplicates = await detectDuplicates(job.userId, type, rows, flat);
    job.status = 'ready';

    if (rows.length >= NOTIFY_THRESHOLD_ROWS) {
      await createNotification(storage, {
        userId: job.userId,
        type: 'import_preview_ready',
        title: 'Import preview ready',
        message: `"${job.fileName}" (${rows.length} rows) is ready to review before importing.`,
        priority: 'info',
        actionUrl: '/settings?tab=data',
        actionLabel: 'Review import',
      });
    }
  } catch (err: any) {
    job.status = 'failed';
    job.error = err?.message || 'Failed to process file';
  }
}

// Re-run validation + duplicate detection for the current (possibly edited) mappings.
async function recomputeChecks(job: SmartImportJob, type: SmartImportType, flat: Record<string, string>, rows: Record<string, string>[]) {
  const needsAttention = rows
    .map((r, i) => ({ row: i, issues: validateRow(type, applyMappings(r, flat)) }))
    .filter(x => x.issues.length > 0);
  const duplicates = await detectDuplicates(job.userId, type, rows, flat);
  return { needsAttention, duplicates };
}

// ---------- commit ----------

interface CommitRequest {
  type: SmartImportType;
  mappings: Record<string, string>; // header -> field
  rows: { data: Record<string, string>; excluded?: boolean }[];
  duplicateResolutions: Record<number, 'merge' | 'keep' | 'skip'>; // keyed by row index
}

async function runCommit(job: SmartImportJob, req: CommitRequest) {
  const userId = job.userId;
  const { type, mappings, rows, duplicateResolutions } = req;
  // Recompute duplicates authoritatively from the SUBMITTED (possibly edited)
  // rows — never the flags cached at preview time. A merge/skip resolution is
  // only honored when the edited row still matches a duplicate; otherwise the
  // row imports as new instead of merging into a stale match or being dropped.
  const freshDuplicates = await detectDuplicates(userId, type, rows.map(r => r.data), mappings);
  const dupByRow = new Map(freshDuplicates.map(d => [d.row, d]));
  const effectiveResolution = (i: number) => (dupByRow.has(i) ? duplicateResolutions[i] : undefined);
  const included = rows
    .map((r, i) => ({ ...r, index: i }))
    .filter(r => !r.excluded && effectiveResolution(r.index) !== 'skip');
  job.commitProgress = { total: included.length, done: 0 };
  let imported = 0;
  let merged = 0;
  const skipped = rows.length - included.length;

  // Cache existing clients for merge/find-or-create
  const existingClients = await storage.getClients(userId);
  const clientByEmail = new Map(existingClients.filter(c => c.email).map(c => [c.email!.toLowerCase(), c]));
  const clientByName = new Map(existingClients.filter(c => c.name).map(c => [c.name!.toLowerCase().trim(), c]));
  const clientById = new Map(existingClients.map(c => [c.id, c]));

  let userTradeType = 'general';
  if (type === 'catalog') {
    const user = await storage.getUser(userId);
    const settings = await storage.getBusinessSettings(userId);
    userTradeType = user?.tradeType || (settings as any)?.tradeType || 'general';
  }
  // Tx-aware document numbering, mirroring storage.generateQuote/InvoiceNumber
  // but writing the counter through the SAME transaction so a rollback also
  // undoes the reservation.
  const bizSettings = (type === 'quotes' || type === 'invoices')
    ? await storage.getBusinessSettings(userId)
    : null;
  const makeNumberGenerator = (tx: any, kind: 'quote' | 'invoice') => {
    const table = kind === 'quote' ? quotes : invoices;
    const prefix = (kind === 'quote' ? bizSettings?.quotePrefix : bizSettings?.invoicePrefix)
      || (kind === 'quote' ? 'QT-' : 'TT-');
    const counterCol = kind === 'quote' ? businessSettings.quoteNextNumber : businessSettings.invoiceNextNumber;
    const counterEnabled = kind === 'quote'
      ? (bizSettings?.quoteNextNumber && bizSettings.quoteNextNumber > 0)
      : (bizSettings?.invoiceNextNumber && bizSettings.invoiceNextNumber > 0);
    let classicNext: number | null = null;
    return async (): Promise<string> => {
      if (counterEnabled && bizSettings) {
        for (let attempts = 0; attempts < 1000; attempts++) {
          const [row] = await tx.update(businessSettings)
            .set({ [kind === 'quote' ? 'quoteNextNumber' : 'invoiceNextNumber']: sql`${counterCol} + 1`, updatedAt: new Date() })
            .where(and(eq(businessSettings.id, bizSettings.id), isNotNull(counterCol)))
            .returning({ next: counterCol });
          if (!row?.next) break;
          const candidate = `${prefix}${(row.next - 1).toString().padStart(4, '0')}`;
          const clash = await tx.select({ id: table.id }).from(table).where(eq(table.number, candidate)).limit(1);
          if (clash.length === 0) return candidate;
        }
      }
      // Classic per-year format; scan once, then count up locally.
      const year = new Date().getFullYear();
      if (classicNext === null) {
        const existing = await tx.select({ number: table.number }).from(table)
          .where(and(eq(table.userId, userId), sql`EXTRACT(YEAR FROM created_at) = ${year}`));
        classicNext = 1;
        for (const q of existing) {
          const m = q.number?.match(/-(\d+)(-[A-Z0-9]+)?$/);
          if (m) {
            const n = parseInt(m[1], 10);
            if (n >= classicNext) classicNext = n + 1;
          }
        }
      }
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      return `${prefix}${year}-${(classicNext++).toString().padStart(3, '0')}-${randomSuffix}`;
    };
  };

  try {
    // All-or-nothing: every write happens inside ONE database transaction.
    // Any failure (including the test hook) rolls the whole import back at
    // the database level — no partial data can ever persist.
    await db.transaction(async (tx) => {
      const nextQuoteNumber = makeNumberGenerator(tx, 'quote');
      const nextInvoiceNumber = makeNumberGenerator(tx, 'invoice');
      const findOrCreateClient = async (name: string, email?: string, rowNumber?: number): Promise<string> => {
        if (email) {
          const c = clientByEmail.get(email.toLowerCase());
          if (c) return c.id;
        }
        const byName = clientByName.get(name.toLowerCase().trim());
        if (byName) return byName.id;
        const [created] = await tx.insert(clients).values({
          userId, name, email: email || null, phone: null, address: null, notes: null,
          importRunId: job.importRunId ?? null, importRowNumber: rowNumber ?? null,
        } as any).returning();
        clientByName.set(name.toLowerCase().trim(), created);
        if (email) clientByEmail.set(email.toLowerCase(), created);
        return created.id;
      };

      for (const r of included) {
        const mapped = applyMappings(r.data, mappings);
        const resolution = effectiveResolution(r.index);
        // Spreadsheet row number (1-based data rows + header row)
        const sourceRow = r.index + 2;
        const origin = { importRunId: job.importRunId ?? null, importRowNumber: sourceRow };

        if (type === 'clients') {
          const dup = dupByRow.get(r.index);
          if (resolution === 'merge' && dup?.matchId && clientById.has(dup.matchId)) {
            const existing = clientById.get(dup.matchId)!;
            const updates: any = {};
            if (mapped.email && !existing.email) updates.email = mapped.email;
            if (mapped.phone && !existing.phone) updates.phone = mapped.phone;
            if (mapped.address && !existing.address) updates.address = mapped.address;
            if (mapped.notes && !(existing.notes || '').includes(mapped.notes)) {
              updates.notes = [existing.notes, mapped.notes].filter(Boolean).join('\n');
            }
            if (Object.keys(updates).length > 0) {
              await tx.update(clients)
                .set({ ...updates, updatedAt: new Date() })
                .where(and(eq(clients.id, dup.matchId), eq(clients.userId, userId)));
            }
            merged++;
          } else {
            await tx.insert(clients).values({
              userId,
              name: mapped.name,
              email: mapped.email || null,
              phone: mapped.phone || null,
              address: mapped.address || null,
              notes: mapped.notes || null,
              ...origin,
            } as any);
            imported++;
          }
        } else if (type === 'catalog') {
          const validUnits = ['hour', 'item', 'm', 'sqm'];
          let unit = (mapped.unit || 'item').toLowerCase().trim();
          if (!validUnits.includes(unit)) unit = 'item';
          const unitPrice = parseImportNumber(mapped.unitPrice) ?? 0;
          const defaultQty = parseImportNumber(mapped.defaultQty) ?? 1;
          await tx.insert(lineItemCatalog).values({
            userId,
            tradeType: mapped.tradeType || userTradeType,
            name: mapped.name,
            description: mapped.description || mapped.name,
            unit,
            unitPrice: unitPrice.toFixed(2),
            defaultQty: defaultQty.toFixed(2),
            tags: [],
            ...origin,
          } as any);
          imported++;
        } else if (type === 'jobs') {
          const clientId = await findOrCreateClient(mapped.clientName, mapped.clientEmail, sourceRow);
          const refTag = mapped.refNumber ? `[Imported-Ref:${mapped.refNumber}]` : '';
          await tx.insert(jobsTable).values({
            userId,
            clientId,
            title: mapped.title || `Job ${mapped.refNumber || ''}`.trim(),
            description: mapped.description || null,
            address: mapped.address || null,
            status: mapped.status ? mapStatus(mapped.status, 'jobs') : 'pending',
            scheduledAt: parseImportDate(mapped.scheduledAt) || null,
            notes: [mapped.notes, refTag].filter(Boolean).join(' ') || null,
            ...origin,
          } as any);
          imported++;
        } else if (type === 'quotes' || type === 'invoices') {
          const clientId = await findOrCreateClient(mapped.clientName, mapped.clientEmail, sourceRow);
          const total = parseImportNumber(mapped.total) ?? 0;
          const subtotal = parseImportNumber(mapped.subtotal) ?? total;
          const gstAmount = parseImportNumber(mapped.gstAmount) ?? 0;
          const refTag = mapped.refNumber ? `[Imported-Ref:${mapped.refNumber}]` : '';
          const notes = [mapped.notes, refTag].filter(Boolean).join(' ') || null;
          const title = mapped.title || `${type === 'quotes' ? 'Quote' : 'Invoice'} ${mapped.refNumber || ''}`.trim();
          if (type === 'quotes') {
            const number = await nextQuoteNumber();
            const [quote] = await tx.insert(quotes).values({
              userId, clientId, number, title,
              description: mapped.description || null,
              status: mapped.status ? mapStatus(mapped.status, 'quotes') : 'draft',
              subtotal: subtotal.toFixed(2), gstAmount: gstAmount.toFixed(2), total: total.toFixed(2),
              validUntil: parseImportDate(mapped.validUntil) || null,
              notes,
              ...origin,
            } as any).returning();
            if (mapped.lineDescription) {
              const qty = parseImportNumber(mapped.lineQty) ?? 1;
              const unitPrice = parseImportNumber(mapped.lineUnitPrice) ?? 0;
              const lineTotal = parseImportNumber(mapped.lineTotal) ?? qty * unitPrice;
              await tx.insert(quoteLineItems).values({
                quoteId: quote.id, description: mapped.lineDescription,
                quantity: qty.toFixed(2), unitPrice: unitPrice.toFixed(2), total: lineTotal.toFixed(2),
              } as any);
            } else if (total > 0 && title) {
              await tx.insert(quoteLineItems).values({
                quoteId: quote.id, description: title, quantity: '1.00',
                unitPrice: subtotal.toFixed(2), total: subtotal.toFixed(2),
              } as any);
            }
          } else {
            const number = await nextInvoiceNumber();
            const [invoice] = await tx.insert(invoices).values({
              userId, clientId, number, title,
              description: mapped.description || null,
              status: mapped.status ? mapStatus(mapped.status, 'invoices') : 'draft',
              subtotal: subtotal.toFixed(2), gstAmount: gstAmount.toFixed(2), total: total.toFixed(2),
              dueDate: parseImportDate(mapped.dueDate) || null,
              notes,
              ...origin,
            } as any).returning();
            if (mapped.lineDescription) {
              const qty = parseImportNumber(mapped.lineQty) ?? 1;
              const unitPrice = parseImportNumber(mapped.lineUnitPrice) ?? 0;
              const lineTotal = parseImportNumber(mapped.lineTotal) ?? qty * unitPrice;
              await tx.insert(invoiceLineItems).values({
                invoiceId: invoice.id, description: mapped.lineDescription,
                quantity: qty.toFixed(2), unitPrice: unitPrice.toFixed(2), total: lineTotal.toFixed(2),
              } as any);
            } else if (total > 0 && title) {
              await tx.insert(invoiceLineItems).values({
                invoiceId: invoice.id, description: title, quantity: '1.00',
                unitPrice: subtotal.toFixed(2), total: subtotal.toFixed(2),
              } as any);
            }
          }
          imported++;
        }
        job.commitProgress!.done++;
        // Test hook: lets integration tests force a mid-commit failure to verify
        // the transaction rolls everything back at the database level.
        if (process.env.NODE_ENV !== 'production' && process.env.SMART_IMPORT_FAIL_AFTER
            && job.commitProgress!.done >= parseInt(process.env.SMART_IMPORT_FAIL_AFTER, 10)) {
          throw new Error('Simulated failure (SMART_IMPORT_FAIL_AFTER)');
        }
      }
    });

    // The transaction committed — the import definitively succeeded. Mark the
    // job first so best-effort follow-ups can never flip a successful import
    // to "failed".
    job.result = { imported, merged, skipped };
    job.status = 'committed';
    // Free row buffers now the import finished.
    job.rows = undefined;

    // Task 300: close out the import run so it appears in Import History.
    if (job.importRunId) {
      try {
        await finalizeImportRun(job.importRunId, { type, imported, merged, skipped });
      } catch (err) {
        logger.warn?.('background', `Failed to finalize import run for job ${job.id}`, { error: err } as any);
      }
    }

    // Best-effort post-commit work: caches + notification. Never fatal.
    try {
      const { invalidateAggregateDashboard, invalidateBusinessSettings } = await import('../cache');
      invalidateAggregateDashboard(userId);
      if (type === 'quotes' || type === 'invoices') invalidateBusinessSettings(userId);
    } catch { /* cache invalidation is best-effort */ }
    if ((imported + merged) >= NOTIFY_THRESHOLD_ROWS) {
      try {
        await createNotification(storage, {
          userId,
          type: 'import_complete',
          title: 'Import finished',
          message: `Imported ${imported} ${type}${merged ? ` and updated ${merged} existing` : ''} from "${job.fileName}".`,
          priority: 'info',
        });
      } catch (notifyErr) {
        logger.warn?.('background', `Smart import notification failed for job ${job.id}`, { error: notifyErr } as any);
      }
    }
  } catch (err: any) {
    // The transaction was rolled back by the database — nothing persisted.
    job.status = 'commit_failed';
    job.error = `Import failed at row ${(job.commitProgress?.done ?? 0) + 1}: ${err?.message || 'unknown error'}. Nothing was saved — fix the issue and try again.`;
    job.commitProgress = { total: included.length, done: 0 };
    logger.error?.('background', `Commit failed for job ${job.id}`, { error: err });
  }
}

// ---------- routes ----------

function jobToPreviewResponse(job: SmartImportJob) {
  return {
    id: job.id,
    status: job.status,
    fileName: job.fileName,
    error: job.error || null,
    type: job.type || null,
    typeConfidence: job.typeConfidence ?? null,
    aiUsed: job.aiUsed ?? null,
    headers: job.headers || null,
    rows: job.status === 'ready' ? job.rows : null,
    totalRows: job.totalRows ?? null,
    mappings: job.mappings || null,
    needsAttention: job.needsAttention || null,
    duplicates: job.duplicates || null,
    commitProgress: job.commitProgress || null,
    result: job.result || null,
    fields: job.type ? IMPORT_FIELDS[job.type] : null,
  };
}

export function registerSmartImportRoutes(app: Express): void {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req: any, file: any, cb: any) => {
      const name = (file.originalname || '').toLowerCase();
      const ok = name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls') ||
        ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(file.mimetype);
      cb(ok ? null : new Error('Only CSV or Excel (.xlsx/.xls) files are supported'), ok);
    },
  });

  // Upload a file → background preview job (parse + AI mapping + checks)
  app.post('/api/import/smart/upload', requireAuth, ownerOnly(), upload.single('file'), async (req: any, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'No file uploaded' });
      const requestedType = req.body?.type && VALID_TYPES.includes(req.body.type) ? req.body.type as SmartImportType : undefined;
      const job: SmartImportJob = {
        id: randomUUID(),
        userId: req.userId!,
        fileName: file.originalname || 'import',
        status: 'processing',
        createdAt: Date.now(),
      };
      jobs.set(job.id, job);
      // Run in the background — the upload response never blocks on parsing/AI.
      setImmediate(async () => {
        // Task 300: retain the original file + open a pending import run so a
        // committed import is traceable and undoable. Best-effort — a storage
        // hiccup must never block the import itself.
        try {
          const filePath = await persistImportFile(file.originalname, file.buffer, file.mimetype);
          job.importRunId = await createPendingImportRun({
            userId: job.userId,
            fileName: job.fileName,
            filePath,
            fileSize: file.size ?? file.buffer.length,
            source: 'smart',
            type: requestedType,
          });
        } catch (err) {
          logger.warn?.('background', 'Smart import: failed to open import run', { error: err } as any);
        }
        processPreviewJob(job, file.buffer, requestedType).catch((err) => {
          job.status = 'failed';
          job.error = err?.message || 'Failed to process file';
        });
      });
      res.json({ jobId: job.id, status: job.status });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Upload failed' });
    }
  });

  // Poll job status / fetch preview payload
  app.get('/api/import/smart/jobs/:id', requireAuth, ownerOnly(), async (req: any, res) => {
    const job = jobs.get(req.params.id);
    if (!job || job.userId !== req.userId) return res.status(404).json({ error: 'Import not found (it may have expired — upload again)' });
    res.json(jobToPreviewResponse(job));
  });

  // Re-run validation + duplicate checks after the user edits mappings/type in the preview
  app.post('/api/import/smart/jobs/:id/recheck', requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const job = jobs.get(req.params.id);
      if (!job || job.userId !== req.userId) return res.status(404).json({ error: 'Import not found' });
      if (job.status !== 'ready') return res.status(400).json({ error: 'Preview is not ready' });
      const { type, mappings, rows } = req.body || {};
      if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid import type' });
      if (!mappings || typeof mappings !== 'object') return res.status(400).json({ error: 'Mappings are required' });
      const useRows: Record<string, string>[] = Array.isArray(rows) && rows.length ? rows : (job.rows || []);
      const checks = await recomputeChecks(job, type, mappings, useRows);
      job.type = type;
      job.needsAttention = checks.needsAttention;
      job.duplicates = checks.duplicates;
      res.json({ ...checks, fields: IMPORT_FIELDS[type as SmartImportType] });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Recheck failed' });
    }
  });

  // Commit the edited preview. Validates everything up front (all-or-nothing gate),
  // then imports in the background with progress available via the job endpoint.
  app.post('/api/import/smart/jobs/:id/commit', requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const job = jobs.get(req.params.id);
      if (!job || job.userId !== req.userId) return res.status(404).json({ error: 'Import not found (it may have expired — upload again)' });
      if (job.status === 'committing') return res.status(409).json({ error: 'Import already in progress' });
      if (job.status === 'committed') return res.status(409).json({ error: 'This import was already committed' });

      const { type, mappings, rows, duplicateResolutions } = req.body || {};
      if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid import type' });
      if (!mappings || typeof mappings !== 'object') return res.status(400).json({ error: 'Mappings are required' });
      if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'No rows to import' });
      if (rows.length > MAX_IMPORT_ROWS) return res.status(400).json({ error: `Maximum ${MAX_IMPORT_ROWS} rows per import` });
      const resolutions: Record<number, 'merge' | 'keep' | 'skip'> = duplicateResolutions || {};

      // All-or-nothing validation gate: every included row must be valid
      // (or explicitly excluded/skipped) before anything is written.
      const invalid: { row: number; issues: string[] }[] = [];
      let includedCount = 0;
      rows.forEach((r: any, i: number) => {
        if (r?.excluded || resolutions[i] === 'skip') return;
        includedCount++;
        const issues = validateRow(type, applyMappings(r?.data || {}, mappings));
        if (issues.length) invalid.push({ row: i, issues });
      });
      if (includedCount === 0) return res.status(400).json({ error: 'Every row is excluded — nothing to import' });
      if (invalid.length > 0) {
        return res.status(400).json({
          error: `${invalid.length} row${invalid.length === 1 ? ' still needs' : 's still need'} attention. Fix or skip them before importing.`,
          invalidRows: invalid.slice(0, 50),
        });
      }

      job.status = 'committing';
      job.error = undefined;
      setImmediate(() => {
        runCommit(job, { type, mappings, rows, duplicateResolutions: resolutions }).catch((err) => {
          job.status = 'commit_failed';
          job.error = err?.message || 'Import failed';
        });
      });
      res.json({ status: 'committing', jobId: job.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Commit failed' });
    }
  });
}
