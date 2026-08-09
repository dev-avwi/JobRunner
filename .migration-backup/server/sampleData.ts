// Task #115: First-Run Sample Data Toggle
//
// Creates a small, clearly-labelled "Sample —" dataset for new users who
// opt-in to "Try with sample data" during onboarding. Removed in one tap
// via clearSampleDataForUser. Sample rows carry isSample=true so the
// accounting integrations can skip them when syncing to Xero/QBO/MYOB.

import { storage, db } from './storage';
import { clients, jobs, quotes, quoteLineItems, invoices, invoiceLineItems } from '@shared/schema';
import { tradeCatalog } from '@shared/tradeCatalog';
import { and, eq } from 'drizzle-orm';

interface SampleLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface TradeSampleSpec {
  scheduledJobTitle: string;
  scheduledJobDescription: string;
  inProgressJobTitle: string;
  inProgressJobDescription: string;
  draftQuoteTitle: string;
  draftQuoteItems: SampleLineItem[];
  acceptedQuoteTitle: string;
  acceptedQuoteItems: SampleLineItem[];
  sentInvoiceTitle: string;
  sentInvoiceItems: SampleLineItem[];
  paidInvoiceTitle: string;
  paidInvoiceItems: SampleLineItem[];
}

const SAMPLE_CLIENTS = [
  { name: 'Sample — Smith Family', email: 'sample.smith@example.com', phone: '+61400000001', address: '12 Sample Street, Cairns QLD 4870' },
  { name: 'Sample — Coastal Cafe', email: 'sample.coastal@example.com', phone: '+61400000002', address: '88 Esplanade, Cairns QLD 4870' },
  { name: 'Sample — Bunnings Trade', email: 'sample.bunnings@example.com', phone: '+61400000003', address: '1 Mulgrave Road, Earlville QLD 4870' },
];

function getTradeSampleSpec(tradeType: string | undefined | null, hourly: number, callout: number): TradeSampleSpec {
  const trade = (tradeType && tradeCatalog[tradeType]) ? tradeType : 'general';

  switch (trade) {
    case 'electrical':
      return {
        scheduledJobTitle: 'Switchboard Upgrade',
        scheduledJobDescription: 'Replace ceramic fuse board with safety switch board. Install RCDs on all circuits.',
        inProgressJobTitle: 'LED Downlight Installation',
        inProgressJobDescription: 'Supply and install 12x LED downlights in living and kitchen.',
        draftQuoteTitle: 'Switchboard Upgrade Quote',
        draftQuoteItems: [
          { description: 'New switchboard with RCDs', quantity: 1, unitPrice: 1200 },
          { description: 'Labour — Licensed electrician', quantity: 6, unitPrice: hourly },
          { description: 'Certificate of electrical safety', quantity: 1, unitPrice: 120 },
        ],
        acceptedQuoteTitle: 'LED Downlight Installation Quote',
        acceptedQuoteItems: [
          { description: 'LED Downlight (warm white, dimmable)', quantity: 12, unitPrice: 45 },
          { description: 'Wiring and connection labour', quantity: 4, unitPrice: hourly },
          { description: 'Call-out fee', quantity: 1, unitPrice: callout },
        ],
        sentInvoiceTitle: 'Power Point Installation — Invoice',
        sentInvoiceItems: [
          { description: 'Double GPO', quantity: 4, unitPrice: 35 },
          { description: 'TPS cable (2.5mm)', quantity: 25, unitPrice: 4.5 },
          { description: 'Labour', quantity: 3, unitPrice: hourly },
        ],
        paidInvoiceTitle: 'Smoke Alarm Service — Invoice',
        paidInvoiceItems: [
          { description: 'Smoke alarm replacement (10yr)', quantity: 3, unitPrice: 65 },
          { description: 'Labour', quantity: 1, unitPrice: hourly },
        ],
      };
    case 'plumbing':
      return {
        scheduledJobTitle: 'Hot Water System Replacement',
        scheduledJobDescription: 'Remove old electric HWS and install new 250L Rheem unit with tempering valve.',
        inProgressJobTitle: 'Blocked Drain Clearing',
        inProgressJobDescription: 'Kitchen drain slow. CCTV inspect and high-pressure jet.',
        draftQuoteTitle: 'Hot Water System Replacement Quote',
        draftQuoteItems: [
          { description: 'Rheem 250L Electric HWS', quantity: 1, unitPrice: 1350 },
          { description: 'Tempering valve supply & install', quantity: 1, unitPrice: 180 },
          { description: 'Labour — Licensed plumber', quantity: 4, unitPrice: hourly },
        ],
        acceptedQuoteTitle: 'Drain Clearing Quote',
        acceptedQuoteItems: [
          { description: 'CCTV drain inspection', quantity: 1, unitPrice: 180 },
          { description: 'High pressure drain jetting', quantity: 1, unitPrice: 320 },
          { description: 'Call-out fee', quantity: 1, unitPrice: callout },
        ],
        sentInvoiceTitle: 'Tap Replacement — Invoice',
        sentInvoiceItems: [
          { description: 'Mixer Tap (Caroma)', quantity: 2, unitPrice: 195 },
          { description: 'Flexi hoses & fittings', quantity: 4, unitPrice: 25 },
          { description: 'Labour', quantity: 2, unitPrice: hourly },
        ],
        paidInvoiceTitle: 'Toilet Repair — Invoice',
        paidInvoiceItems: [
          { description: 'Cistern parts replacement', quantity: 1, unitPrice: 95 },
          { description: 'Labour', quantity: 1, unitPrice: hourly },
        ],
      };
    case 'building':
      return {
        scheduledJobTitle: 'Timber Deck Construction',
        scheduledJobDescription: 'Build 6m x 4m hardwood deck off rear of house with stairs and handrails.',
        inProgressJobTitle: 'Bathroom Renovation',
        inProgressJobDescription: 'Strip out and renovate main bathroom. New tiling, vanity, shower screen, fixtures.',
        draftQuoteTitle: 'Timber Deck Quote',
        draftQuoteItems: [
          { description: 'Merbau decking (24m²)', quantity: 24, unitPrice: 85 },
          { description: 'Timber framing & substructure', quantity: 1, unitPrice: 1200 },
          { description: 'Labour — Builder', quantity: 24, unitPrice: hourly },
        ],
        acceptedQuoteTitle: 'Bathroom Renovation Quote',
        acceptedQuoteItems: [
          { description: 'Strip-out and demolition', quantity: 1, unitPrice: 800 },
          { description: 'Tiling — floor and walls', quantity: 18, unitPrice: 75 },
          { description: 'Labour — Builder', quantity: 32, unitPrice: hourly },
        ],
        sentInvoiceTitle: 'Pergola Installation — Invoice',
        sentInvoiceItems: [
          { description: 'Steel frame pergola (4m x 3m)', quantity: 1, unitPrice: 2200 },
          { description: 'Polycarbonate roofing panels', quantity: 12, unitPrice: 65 },
          { description: 'Labour', quantity: 12, unitPrice: hourly },
        ],
        paidInvoiceTitle: 'Door Replacement — Invoice',
        paidInvoiceItems: [
          { description: 'Solid timber door & jamb', quantity: 1, unitPrice: 480 },
          { description: 'Labour', quantity: 3, unitPrice: hourly },
        ],
      };
    default: {
      const typical = tradeCatalog[trade]?.typicalJobs || ['Service call', 'Repair job', 'New installation'];
      return {
        scheduledJobTitle: typical[0] || 'Service call',
        scheduledJobDescription: `Sample scheduled job — ${typical[0] || 'service call'}.`,
        inProgressJobTitle: typical[1] || 'Repair job',
        inProgressJobDescription: `Sample in-progress job — ${typical[1] || 'repair'} for the Coastal Cafe.`,
        draftQuoteTitle: `${typical[0] || 'Service'} Quote`,
        draftQuoteItems: [
          { description: 'Materials', quantity: 1, unitPrice: 250 },
          { description: 'Labour', quantity: 4, unitPrice: hourly },
          { description: 'Call-out fee', quantity: 1, unitPrice: callout },
        ],
        acceptedQuoteTitle: `${typical[1] || 'Repair'} Quote`,
        acceptedQuoteItems: [
          { description: 'Parts and materials', quantity: 1, unitPrice: 180 },
          { description: 'Labour', quantity: 3, unitPrice: hourly },
        ],
        sentInvoiceTitle: `${typical[2] || 'Installation'} — Invoice`,
        sentInvoiceItems: [
          { description: 'Materials', quantity: 1, unitPrice: 320 },
          { description: 'Labour', quantity: 4, unitPrice: hourly },
        ],
        paidInvoiceTitle: 'Maintenance Visit — Invoice',
        paidInvoiceItems: [
          { description: 'Service & inspection', quantity: 1, unitPrice: 180 },
          { description: 'Replacement parts', quantity: 1, unitPrice: 95 },
          { description: 'Call-out fee', quantity: 1, unitPrice: callout },
        ],
      };
    }
  }
}

function totals(items: SampleLineItem[]) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const gstAmount = subtotal * 0.1;
  const total = subtotal + gstAmount;
  return {
    subtotal: subtotal.toFixed(2),
    gstAmount: gstAmount.toFixed(2),
    total: total.toFixed(2),
  };
}

export interface SampleDataResult {
  success: boolean;
  message: string;
  created?: { clients: number; jobs: number; quotes: number; invoices: number };
}

export async function seedSampleDataForUser(userId: string, tradeTypeArg?: string | null): Promise<SampleDataResult> {
  const user = await storage.getUser(userId);
  if (!user) return { success: false, message: 'User not found' };

  // Skip if sample data already present for this user.
  const existing = await db.select({ id: clients.id }).from(clients)
    .where(and(eq(clients.userId, userId), eq(clients.isSample, true))).limit(1);
  if (existing.length > 0) {
    return { success: true, message: 'Sample data already loaded.' };
  }

  const tradeType = tradeTypeArg || user.tradeType || 'general';
  const trade = tradeCatalog[tradeType];
  const hourly = trade?.defaultRateCard?.hourlyRate ?? 85;
  const callout = trade?.defaultRateCard?.calloutFee ?? 80;
  const spec = getTradeSampleSpec(tradeType, hourly, callout);

  // 1. Three sample clients (clearly named "Sample —").
  const createdClients = [];
  for (const c of SAMPLE_CLIENTS) {
    const [row] = await db.insert(clients).values({
      userId,
      name: c.name,
      email: c.email,
      phone: c.phone,
      address: c.address,
      notes: 'Sample client created during onboarding. Safe to remove from Dashboard or Settings.',
      isSample: true,
    }).returning();
    createdClients.push(row);
  }

  // 2. Two jobs: one scheduled tomorrow, one in-progress.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const [scheduledJob] = await db.insert(jobs).values({
    userId,
    clientId: createdClients[0].id,
    title: spec.scheduledJobTitle,
    description: spec.scheduledJobDescription,
    address: createdClients[0].address,
    status: 'scheduled',
    scheduledAt: tomorrow,
    scheduledTime: '09:00',
    estimatedDuration: 120,
    isSample: true,
  }).returning();

  const [inProgressJob] = await db.insert(jobs).values({
    userId,
    clientId: createdClients[1].id,
    title: spec.inProgressJobTitle,
    description: spec.inProgressJobDescription,
    address: createdClients[1].address,
    status: 'in_progress',
    startedAt: new Date(),
    estimatedDuration: 90,
    isSample: true,
  }).returning();

  // 3. Two quotes (draft + accepted).
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);

  const draftTotals = totals(spec.draftQuoteItems);
  const draftQuoteNumber = `SAMPLE-Q-${Date.now()}-1`;
  const [draftQuote] = await db.insert(quotes).values({
    userId,
    clientId: createdClients[0].id,
    jobId: scheduledJob.id,
    number: draftQuoteNumber,
    title: spec.draftQuoteTitle,
    status: 'draft',
    subtotal: draftTotals.subtotal,
    gstAmount: draftTotals.gstAmount,
    total: draftTotals.total,
    validUntil,
    isSample: true,
  }).returning();
  for (let i = 0; i < spec.draftQuoteItems.length; i++) {
    const li = spec.draftQuoteItems[i];
    await db.insert(quoteLineItems).values({
      quoteId: draftQuote.id,
      description: li.description,
      quantity: String(li.quantity),
      unitPrice: li.unitPrice.toFixed(2),
      total: (li.quantity * li.unitPrice).toFixed(2),
      sortOrder: i,
    });
  }

  const acceptedTotals = totals(spec.acceptedQuoteItems);
  const acceptedQuoteNumber = `SAMPLE-Q-${Date.now()}-2`;
  const [acceptedQuote] = await db.insert(quotes).values({
    userId,
    clientId: createdClients[1].id,
    jobId: inProgressJob.id,
    number: acceptedQuoteNumber,
    title: spec.acceptedQuoteTitle,
    status: 'accepted',
    subtotal: acceptedTotals.subtotal,
    gstAmount: acceptedTotals.gstAmount,
    total: acceptedTotals.total,
    validUntil,
    sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    acceptedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    acceptedBy: 'Sample Client',
    isSample: true,
  }).returning();
  for (let i = 0; i < spec.acceptedQuoteItems.length; i++) {
    const li = spec.acceptedQuoteItems[i];
    await db.insert(quoteLineItems).values({
      quoteId: acceptedQuote.id,
      description: li.description,
      quantity: String(li.quantity),
      unitPrice: li.unitPrice.toFixed(2),
      total: (li.quantity * li.unitPrice).toFixed(2),
      sortOrder: i,
    });
  }

  // 4. Two invoices (sent + paid).
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  const sentTotals = totals(spec.sentInvoiceItems);
  const sentInvoiceNumber = `SAMPLE-INV-${Date.now()}-1`;
  const [sentInvoice] = await db.insert(invoices).values({
    userId,
    clientId: createdClients[2].id,
    number: sentInvoiceNumber,
    title: spec.sentInvoiceTitle,
    status: 'sent',
    subtotal: sentTotals.subtotal,
    gstAmount: sentTotals.gstAmount,
    total: sentTotals.total,
    dueDate,
    sentAt: new Date(),
    isSample: true,
  }).returning();
  for (let i = 0; i < spec.sentInvoiceItems.length; i++) {
    const li = spec.sentInvoiceItems[i];
    await db.insert(invoiceLineItems).values({
      invoiceId: sentInvoice.id,
      description: li.description,
      quantity: String(li.quantity),
      unitPrice: li.unitPrice.toFixed(2),
      total: (li.quantity * li.unitPrice).toFixed(2),
      sortOrder: i,
    });
  }

  const paidTotals = totals(spec.paidInvoiceItems);
  const paidInvoiceNumber = `SAMPLE-INV-${Date.now()}-2`;
  const [paidInvoice] = await db.insert(invoices).values({
    userId,
    clientId: createdClients[0].id,
    number: paidInvoiceNumber,
    title: spec.paidInvoiceTitle,
    status: 'paid',
    subtotal: paidTotals.subtotal,
    gstAmount: paidTotals.gstAmount,
    total: paidTotals.total,
    dueDate,
    sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    paidAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    paymentMethod: 'bank_transfer',
    amountPaid: paidTotals.total,
    isSample: true,
  }).returning();
  for (let i = 0; i < spec.paidInvoiceItems.length; i++) {
    const li = spec.paidInvoiceItems[i];
    await db.insert(invoiceLineItems).values({
      invoiceId: paidInvoice.id,
      description: li.description,
      quantity: String(li.quantity),
      unitPrice: li.unitPrice.toFixed(2),
      total: (li.quantity * li.unitPrice).toFixed(2),
      sortOrder: i,
    });
  }

  return {
    success: true,
    message: 'Sample data loaded — explore your dashboard, then remove it any time.',
    created: { clients: 3, jobs: 2, quotes: 2, invoices: 2 },
  };
}

export async function clearSampleDataForUser(userId: string): Promise<SampleDataResult> {
  // Order matters: invoices/quotes/jobs first, then clients (FK cascades will handle line items).
  const delInvoices = await db.delete(invoices)
    .where(and(eq(invoices.userId, userId), eq(invoices.isSample, true))).returning({ id: invoices.id });
  const delQuotes = await db.delete(quotes)
    .where(and(eq(quotes.userId, userId), eq(quotes.isSample, true))).returning({ id: quotes.id });
  const delJobs = await db.delete(jobs)
    .where(and(eq(jobs.userId, userId), eq(jobs.isSample, true))).returning({ id: jobs.id });
  const delClients = await db.delete(clients)
    .where(and(eq(clients.userId, userId), eq(clients.isSample, true))).returning({ id: clients.id });

  return {
    success: true,
    message: 'Sample data removed.',
    created: {
      clients: delClients.length,
      jobs: delJobs.length,
      quotes: delQuotes.length,
      invoices: delInvoices.length,
    },
  };
}

export async function userHasSampleData(userId: string): Promise<boolean> {
  const [c] = await db.select({ id: clients.id }).from(clients)
    .where(and(eq(clients.userId, userId), eq(clients.isSample, true))).limit(1);
  if (c) return true;
  const [j] = await db.select({ id: jobs.id }).from(jobs)
    .where(and(eq(jobs.userId, userId), eq(jobs.isSample, true))).limit(1);
  if (j) return true;
  const [q] = await db.select({ id: quotes.id }).from(quotes)
    .where(and(eq(quotes.userId, userId), eq(quotes.isSample, true))).limit(1);
  if (q) return true;
  const [i] = await db.select({ id: invoices.id }).from(invoices)
    .where(and(eq(invoices.userId, userId), eq(invoices.isSample, true))).limit(1);
  return !!i;
}
