/**
 * shared/apiTypes.ts
 *
 * Canonical TypeScript types for API response payloads.
 *
 * Field names in these types EXACTLY match what the server returns in JSON.
 * They are the single source of truth for both the web and mobile clients.
 *
 * Key points:
 * - Invoice and Quote document-number field is `number` (not `invoiceNumber` /
 *   `quoteNumber`) — Drizzle serialises the DB column name as the TS property
 *   name, which is the camelCase form of `number text NOT NULL`.
 * - Subcontractor invoices are a DIFFERENT entity stored in the
 *   `subcontractor_invoices` table.  Their document-number field is
 *   `invoiceNumber`, `subtotalAmount`, and `totalAmount` — these are the real
 *   DB column names and ARE correct.
 * - Decimal columns (subtotal, gstAmount, total, amountPaid …) are typed as
 *   `number` here to match how all client code currently consumes them.  At
 *   runtime the API may return these as numeric strings ("100.00"); consumers
 *   should use `Number(value)` when performing arithmetic.
 */

// ---------------------------------------------------------------------------
// Main Invoice / Quote API types (GET /api/invoices, GET /api/quotes)
// ---------------------------------------------------------------------------

export interface ApiInvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ApiQuoteLineItem {
  id: string;
  quoteId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/**
 * Invoice object returned by GET /api/invoices and GET /api/invoices/:id.
 *
 * FIELD NAME NOTE: the document number is exposed as `number` (matching the
 * Drizzle ORM property derived from the `number` DB column).  Earlier local
 * declarations in mobile and web used `invoiceNumber` — those were incorrect.
 */
export interface ApiInvoice {
  id: string;
  userId: string;
  clientId: string;
  jobId?: string | null;
  quoteId?: string | null;
  /** Document number, e.g. "INV-0001".  Field name is `number` on the server. */
  number: string;
  title: string;
  description?: string | null;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number;
  gstAmount: number;
  total: number;
  amountPaid: number;
  dueDate?: string | null;
  sentAt?: string | null;
  paidAt?: string | null;
  receiptSentAt?: string | null;
  paymentReference?: string | null;
  paymentMethod?: string | null;
  paymentToken?: string | null;
  stripePaymentIntentId?: string | null;
  stripeInvoiceId?: string | null;
  stripePaymentLink?: string | null;
  allowOnlinePayment?: boolean;
  notes?: string | null;
  photos?: unknown[];
  templateId?: string | null;
  familyKey?: string | null;
  isRecurring?: boolean;
  recurrencePattern?: string | null;
  recurrenceInterval?: number;
  recurrenceEndDate?: string | null;
  parentInvoiceId?: string | null;
  nextRecurrenceDate?: string | null;
  archivedAt?: string | null;
  isXeroImport?: boolean;
  xeroInvoiceId?: string | null;
  xeroContactId?: string | null;
  xeroSyncedAt?: string | null;
  quickbooksInvoiceId?: string | null;
  quickbooksSyncedAt?: string | null;
  customFields?: Record<string, unknown>;
  documentTemplate?: string | null;
  documentTemplateSettings?: unknown;
  lockedAt?: string | null;
  lockedReason?: string | null;
  calculationHash?: string | null;
  retentionPercent?: number | null;
  retentionAmount?: number | null;
  depositRequired?: boolean;
  depositPercent?: number | null;
  depositAmount?: number | null;
  depositPaid?: boolean;
  depositPaidAt?: string | null;
  isSample?: boolean;
  importRunId?: string | null;
  importRowNumber?: number | null;
  terms?: string | null;
  createdAt: string;
  updatedAt?: string;
  // Added by GET /api/invoices route handler
  clientName?: string;
  clientEmail?: string;
  // Populated by detail endpoint
  lineItems?: ApiInvoiceLineItem[];
}

/**
 * Quote object returned by GET /api/quotes and GET /api/quotes/:id.
 *
 * FIELD NAME NOTE: the document number is exposed as `number` (matching the
 * Drizzle ORM property derived from the `number` DB column).  Earlier local
 * declarations in mobile used `quoteNumber` — those were incorrect.
 */
export interface ApiQuote {
  id: string;
  userId: string;
  clientId: string;
  jobId?: string | null;
  /** Document number, e.g. "Q-0001".  Field name is `number` on the server. */
  number: string;
  title: string;
  description?: string | null;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'archived';
  subtotal: number;
  gstAmount: number;
  total: number;
  validUntil?: string | null;
  sentAt?: string | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  acceptanceToken?: string | null;
  acceptedBy?: string | null;
  acceptanceIp?: string | null;
  acceptanceSignatureData?: string | null;
  declineReason?: string | null;
  notes?: string | null;
  photos?: unknown[];
  templateId?: string | null;
  familyKey?: string | null;
  depositRequired?: boolean;
  depositPercent?: number | null;
  depositAmount?: number | null;
  depositPaid?: boolean;
  depositPaidAt?: string | null;
  depositPaymentIntentId?: string | null;
  archivedAt?: string | null;
  archived?: boolean;
  isMultiOption?: boolean;
  selectedOptionId?: string | null;
  isXeroImport?: boolean;
  xeroQuoteId?: string | null;
  xeroContactId?: string | null;
  xeroSyncedAt?: string | null;
  customFields?: Record<string, unknown>;
  documentTemplate?: string | null;
  documentTemplateSettings?: unknown;
  isSample?: boolean;
  importRunId?: string | null;
  importRowNumber?: number | null;
  includesGst?: boolean;
  createdAt: string;
  updatedAt?: string;
  // Added by GET /api/quotes route handler
  clientName?: string;
  clientEmail?: string;
  // Populated by detail endpoint
  lineItems?: ApiQuoteLineItem[];
}

// ---------------------------------------------------------------------------
// Subcontractor invoice API types
// (GET /api/subcontractor/invoices and GET /api/business/subcontractor-invoices)
// These are a DIFFERENT entity from the main Invoice above.
// Their document-number field really is `invoiceNumber` (DB column `invoice_number`).
// ---------------------------------------------------------------------------

/** Fields common to both the worker and business views of a subcontractor invoice */
export interface ApiSubcontractorInvoiceBase {
  id: string;
  subcontractorUserId: string;
  businessOwnerId: string;
  docType: string;
  title: string | null;
  gstEnabled: boolean;
  status: string;
  /** Document number for subcontractor invoices.  This IS `invoiceNumber` — a
   *  genuine DB column name on the `subcontractor_invoices` table. */
  invoiceNumber: string;
  subtotalAmount: string;
  gstAmount: string;
  totalAmount: string;
  dueDate: string | null;
  validUntil: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  paidAt: string | null;
  paidMethod: string | null;
  paidReference: string | null;
  paidNotes: string | null;
  remittanceSentAt: string | null;
  accountingProvider: string | null;
  accountingBillId: string | null;
  accountingSyncedAt: string | null;
  accountingSyncError: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ApiSubcontractorInvoiceItem {
  id: string;
  description: string;
  hours: string | null;
  rate: string | null;
  quantity: string | null;
  unitPrice: string | null;
  amount: string;
  jobId: string | null;
}

/**
 * Subcontractor invoice as returned by GET /api/subcontractor/invoices
 * (worker view — enriched with businessName and paymentToken).
 */
export interface ApiSubcontractorInvoice extends ApiSubcontractorInvoiceBase {
  /** Name of the business that hired the subcontractor (added by route handler) */
  businessName: string;
  /** Secure payment token (added by route handler) */
  paymentToken: string | null;
}

export interface ApiSubcontractorInvoiceDetail extends ApiSubcontractorInvoice {
  items: ApiSubcontractorInvoiceItem[];
  subcontractorEmail?: string | null;
}

/**
 * Subcontractor invoice as returned by GET /api/business/subcontractor-invoices
 * (business owner view — enriched with subcontractorName and compliance info).
 */
export interface ApiBusinessSubcontractorInvoice extends ApiSubcontractorInvoiceBase {
  /** Name of the subcontractor (added by route handler) */
  subcontractorName: string;
  paymentToken?: string | null;
  compliance?: {
    status: 'valid' | 'expiring_soon' | 'expired';
    expiredDocuments?: string[];
    requiresPaymentConfirmation?: boolean;
  };
}

export interface ApiBusinessSubcontractorInvoiceDetail extends ApiBusinessSubcontractorInvoice {
  items: ApiSubcontractorInvoiceItem[];
  subcontractorEmail?: string | null;
}
