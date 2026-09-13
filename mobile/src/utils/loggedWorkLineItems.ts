/**
 * Pure computation helpers for the LoggedWorkLineItems feature.
 *
 * Extracted from the component so they can be unit-tested independently of
 * React Native. No RN imports — these are plain TypeScript functions.
 */

// ─── AsyncStorage key ─────────────────────────────────────────────────────────

/**
 * AsyncStorage key used to pass pre-reviewed line items from the Manage-tab
 * "Draft Invoice / Quote" button to the invoice/quote creation screens.
 * The key is consumed (removed) immediately on first read so stale payloads
 * can never bleed into unrelated drafts.
 */
export const DRAFT_LINE_ITEMS_KEY = (jobId: string) =>
  `job_draft_line_items_${jobId}`;

// ─── Exported line-item shape (matches invoice/new.tsx LineItem) ──────────────

export interface ComputedLineItem {
  key: string;
  section: 'labour' | 'materials' | 'expenses';
  description: string;
  quantity: number;
  unitPrice: number;
}

// ─── Input shapes ─────────────────────────────────────────────────────────────

export interface TimeEntryInput {
  userId: string;
  userName?: string;
  startTime: string;
  endTime?: string;
  /** Persisted duration in minutes from the server — authoritative, accounts for paused time. */
  duration?: number | null;
  hourlyRate?: string;
  isBreak?: boolean;
  /** When explicitly false the entry is internal-only and must not appear on client invoices. */
  isBillable?: boolean;
}

export interface MaterialInput {
  id: string;
  name: string;
  /** PostgreSQL decimal fields arrive as strings from the API — accept both. */
  quantity: number | string | null;
  unitCost: number | string | null;
  unitPrice?: number | string | null;
  markupPercent?: number | string | null;
}

export interface ExpenseInput {
  id: string;
  categoryName?: string;
  description: string;
  amount: string;
  status?: string;
  /** When false the expense is internal-only and must not appear on client invoices. */
  isBillable?: boolean;
}

// ─── Computation functions ────────────────────────────────────────────────────

export const DEFAULT_MATERIAL_MARKUP = 20;

/**
 * Group completed time entries by worker and return one labour line per worker.
 * Workers with 0 billable hours are omitted.
 */
export function computeLabourItems(
  entries: TimeEntryInput[],
  billBreaks: boolean,
): ComputedLineItem[] {
  const completed = entries.filter(
    (e) => e.endTime && (billBreaks || !e.isBreak) && e.isBillable !== false,
  );

  const byWorker: Record<string, { name: string; totalMs: number; rate: number }> = {};
  completed.forEach((e) => {
    const key = e.userId || 'unknown';
    if (!byWorker[key]) {
      byWorker[key] = { name: e.userName || 'Labour', totalMs: 0, rate: 0 };
    }
    // Prefer persisted duration (minutes) — it is authoritative and accounts for
    // paused timer time. Fall back to wall-clock diff only for legacy entries
    // where duration was not yet recorded.
    let ms: number;
    if (e.duration != null && Number.isFinite(e.duration) && e.duration >= 0) {
      ms = e.duration * 60 * 1000;
    } else {
      const diff = new Date(e.endTime!).getTime() - new Date(e.startTime).getTime();
      ms = Number.isFinite(diff) ? diff : 0;
    }
    if (ms > 0) byWorker[key].totalMs += ms;
    const r = parseFloat(e.hourlyRate ?? '');
    // Use the highest positive rate seen — deterministic regardless of API ordering.
    if (r > byWorker[key].rate) byWorker[key].rate = r;
  });

  const items: ComputedLineItem[] = [];
  Object.entries(byWorker).forEach(([id, w]) => {
    const hrs = Math.round((w.totalMs / (1000 * 60 * 60)) * 10) / 10;
    if (!Number.isFinite(hrs) || hrs <= 0) return;
    items.push({
      key: `labour-${id}`,
      section: 'labour',
      description: `Labour \u2014 ${w.name}`,
      quantity: hrs,
      unitPrice: Math.round(w.rate * 100) / 100,
    });
  });
  return items;
}

/**
 * Convert materials to invoice line items using sell price priority:
 * explicit unitPrice > (unitCost × markup) > 0 (zero-rate editable row).
 *
 * Materials with a positive quantity but no derivable price are included as
 * zero-rate rows so owners can review and fill in the rate via the edit
 * affordance before drafting the invoice.
 *
 * @param fallbackMarkupPercent - Business/rate-card configured markup to use
 *   when neither unitPrice nor per-material markupPercent is set.
 *   Defaults to DEFAULT_MATERIAL_MARKUP (20 %) when not provided.
 */
export function computeMaterialItems(
  materials: MaterialInput[],
  fallbackMarkupPercent: number = DEFAULT_MATERIAL_MARKUP,
): ComputedLineItem[] {
  const items: ComputedLineItem[] = [];
  materials.forEach((m) => {
    // Normalise all fields — the API returns PostgreSQL decimal columns as strings.
    const qty = parseFloat(String(m.quantity ?? '')) || 0;
    if (qty <= 0) return; // skip truly empty rows
    const explicitPrice = parseFloat(String(m.unitPrice ?? ''));
    const cost = parseFloat(String(m.unitCost ?? ''));
    const markup = parseFloat(String(m.markupPercent ?? ''));
    const effectiveMarkup = Number.isFinite(markup) && markup >= 0 ? markup : fallbackMarkupPercent;
    let price = 0;
    if (Number.isFinite(explicitPrice) && explicitPrice > 0) {
      price = explicitPrice;
    } else if (Number.isFinite(cost) && cost > 0) {
      price = Math.round(cost * (1 + effectiveMarkup / 100) * 100) / 100;
    }
    // price may be 0 — include the row anyway so the owner can set a rate.
    items.push({
      key: `mat-${m.id}`,
      section: 'materials',
      description: m.name,
      quantity: qty,
      unitPrice: price,
    });
  });
  return items;
}

/**
 * Convert approved, billable expenses to invoice line items.
 * Pending and rejected expenses are excluded.
 * Non-billable expenses (isBillable === false) are excluded even if approved —
 * approval and client-billability are distinct concepts.
 */
export function computeExpenseItems(expenses: ExpenseInput[]): ComputedLineItem[] {
  const items: ComputedLineItem[] = [];
  expenses
    .filter((e) => e.status === 'approved' && e.isBillable !== false)
    .forEach((e) => {
      const amount = parseFloat(e.amount) || 0;
      if (amount <= 0) return;
      items.push({
        key: `exp-${e.id}`,
        section: 'expenses',
        description: `${e.categoryName || 'Expense'}: ${e.description}`,
        quantity: 1,
        unitPrice: amount,
      });
    });
  return items;
}
