// @ts-nocheck
import type { Quote, Invoice, QuoteLineItem, InvoiceLineItem, Client, BusinessSettings, DigitalSignature, Job, TimeEntry } from "@workspace/db";

// ── Cost Report PDF ───────────────────────────────────────────────────────────

export interface CostReportData {
  job: {
    id: string;
    title: string;
    number?: string | null;
    jobNumber?: string | null;
    address?: string | null;
    status: string;
    scheduledAt?: string | null;
    completedAt?: string | null;
    startedAt?: string | null;
    jobType?: string | null;
    budgetedCost?: number | null;
    description?: string | null;
  };
  client?: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  business: {
    businessName: string;
    abn?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    logoUrl?: string | null;
  };
  quote?: {
    number?: string | null;
    total: number;
    revisedContractValue: number;
  } | null;
  phases: Array<{
    id: string | null;
    phaseCode?: string | null;
    name: string;
    status?: string | null;
    scheduledStart?: string | null;
    scheduledEnd?: string | null;
    bookedHours?: number | null;
    costs: {
      labour: number;
      subcontractor: number;
      materials: number;
      purchaseOrders: number;
      total: number;
    };
    hours: number;
    variations: { approvedTotal: number; pendingTotal: number };
  }>;
  variations: Array<{
    number: string;
    title: string;
    description?: string | null;
    reason?: string | null;
    status: string;
    totalAmount: number;
    approvedAt?: string | null;
    rejectedAt?: string | null;
    sentAt?: string | null;
    approvedByName?: string | null;
    rejectionReason?: string | null;
    phaseId?: string | null;
  }>;
  labourEntries: Array<{
    workerName: string;
    isSubcontractor: boolean;
    hours: number;
    cost: number;
    date: string;
  }>;
  materials: Array<{
    name: string;
    quantity: number | string;
    unitCost: number;
    totalCost: number;
    totalPrice: number;
    markupPercent?: number | null;
    supplier?: string | null;
  }>;
  purchaseOrders: Array<{
    poNumber: string;
    supplierName: string;
    total: number;
    status: string;
    orderDate?: string | null;
  }>;
  financial: {
    contractValue: number | null;
    approvedVariationsTotal: number;
    pendingVariationsTotal: number;
    rejectedVariationsTotal: number;
    revisedContractValue: number | null;
    invoicedRevenue: number;
    labourCost: number;
    subcontractorCost: number;
    materialsCost: number;
    materialsSellPrice: number;
    markupEarned: number;
    otherExpenses: number;
    purchaseOrdersTotal: number;
    totalCosts: number;
    grossProfit: number;
    grossMargin: number;
    budgetedCost: number | null;
    budgetVariance: number | null;
  };
  hours: {
    total: number;
    estimated: number;
    billable: number;
  };
  exportedAt: string;
  retention?: {
    sumRetentionHeld: number;
    outstandingRetention: number;
    practicalCompletionDate: string | null;
    defectsLiabilityMonths: number;
    releaseDate: string | null;
    retentionStatus: string;
  } | null;
}

export function generateCostReportPDF(data: CostReportData): string {
  const { job, client, business, quote, phases, variations, labourEntries, materials, purchaseOrders, financial, hours, exportedAt, retention } = data;

  const esc = (v: string | null | undefined): string =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n);

  const fmtDate = (d: string | null | undefined): string => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return '—'; }
  };

  const fmtHours = (h: number) => {
    if (h === 0) return '0.0';
    return h.toFixed(1);
  };

  const NAVY = '#1e3a5f';
  const LIGHT = '#f8fafc';
  const BORDER = '#e2e8f0';
  const MUTED = '#6b7280';
  const GREEN = '#16a34a';
  const AMBER = '#d97706';
  const RED = '#dc2626';

  const marginColor = financial.grossMargin < 0 ? RED : financial.grossMargin < 10 ? AMBER : GREEN;

  const logoHtml = business.logoUrl
    ? `<img src="${esc(business.logoUrl)}" alt="${esc(business.businessName)}" style="max-height:56px;max-width:160px;object-fit:contain;margin-bottom:6px"/>`
    : '';

  const jobNum = job.jobNumber || job.number || '';
  const jobDisplayNum = jobNum ? `#${esc(jobNum)}` : '';

  // Variation status labels and colors
  const varStatusLabel = (s: string) => {
    if (s === 'approved') return 'Approved';
    if (s === 'sent') return 'Pending';
    if (s === 'rejected') return 'Rejected';
    if (s === 'draft') return 'Draft';
    return esc(s);
  };
  const varStatusColor = (s: string) => {
    if (s === 'approved') return GREEN;
    if (s === 'sent') return AMBER;
    if (s === 'rejected') return RED;
    return '#9ca3af';
  };

  const phaseStatusLabel = (s: string | null) => {
    if (!s) return '—';
    if (s === 'not_started') return 'Not Started';
    if (s === 'in_progress') return 'In Progress';
    if (s === 'completed') return 'Completed';
    if (s === 'on_hold') return 'On Hold';
    return esc(s);
  };

  // Group labour by worker
  const workerMap = new Map<string, { isSubcontractor: boolean; hours: number; cost: number }>();
  for (const e of labourEntries) {
    const existing = workerMap.get(e.workerName) || { isSubcontractor: e.isSubcontractor, hours: 0, cost: 0 };
    existing.hours += e.hours;
    existing.cost += e.cost;
    workerMap.set(e.workerName, existing);
  }
  const workerRows = Array.from(workerMap.entries()).map(([name, d], i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : LIGHT}">
      <td style="padding:7px 10px">${esc(name)}</td>
      <td style="padding:7px 10px;text-align:center">${d.isSubcontractor ? 'Subcontractor' : 'Employee'}</td>
      <td style="padding:7px 10px;text-align:right;font-variant-numeric:tabular-nums">${fmtHours(d.hours)}</td>
      <td style="padding:7px 10px;text-align:right;font-variant-numeric:tabular-nums">${fmt(d.cost)}</td>
    </tr>`).join('');

  // PO summary by supplier — aggregate first, then keep individual PO detail rows
  const supplierMap = new Map<string, { total: number; count: number; statuses: Set<string> }>();
  for (const po of purchaseOrders) {
    const key = po.supplierName || 'Unknown Supplier';
    const existing = supplierMap.get(key) || { total: 0, count: 0, statuses: new Set<string>() };
    existing.total += po.total;
    existing.count++;
    existing.statuses.add(po.status);
    supplierMap.set(key, existing);
  }

  const poStatusLabel = (s: string) => {
    if (s === 'draft') return 'Draft';
    if (s === 'sent') return 'Sent';
    if (s === 'received') return 'Received';
    if (s === 'partially_received') return 'Partial';
    if (s === 'cancelled') return 'Cancelled';
    return esc(s);
  };

  const supplierRows = Array.from(supplierMap.entries()).map(([name, d], i) => {
    const statusBadges = Array.from(d.statuses).map(s =>
      `<span style="display:inline-block;padding:2px 6px;border-radius:3px;font-size:9px;font-weight:600;color:#fff;background:${s === 'received' ? GREEN : s === 'cancelled' ? '#9ca3af' : AMBER};margin-right:3px">${poStatusLabel(s)}</span>`
    ).join('');
    return `
    <tr style="background:${i % 2 === 0 ? '#fff' : LIGHT}">
      <td style="padding:7px 10px;font-weight:500">${esc(name)}</td>
      <td style="padding:7px 10px;text-align:center">${d.count}</td>
      <td style="padding:7px 10px">${statusBadges}</td>
      <td style="padding:7px 10px;text-align:right;font-weight:600;font-variant-numeric:tabular-nums">${fmt(d.total)}</td>
    </tr>`;
  }).join('');

  const poDetailRows = purchaseOrders.map((po, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : LIGHT}">
      <td style="padding:6px 10px;font-family:monospace;font-size:11px">${esc(po.poNumber)}</td>
      <td style="padding:6px 10px;font-size:11px">${esc(po.supplierName || '—')}</td>
      <td style="padding:6px 10px;white-space:nowrap;font-size:11px">${fmtDate(po.orderDate)}</td>
      <td style="padding:6px 10px;text-align:center"><span style="display:inline-block;padding:2px 6px;border-radius:3px;font-size:9px;font-weight:600;color:#fff;background:${po.status === 'received' ? GREEN : po.status === 'cancelled' ? '#9ca3af' : AMBER}">${poStatusLabel(po.status)}</span></td>
      <td style="padding:6px 10px;text-align:right;font-variant-numeric:tabular-nums;font-size:11px">${fmt(po.total)}</td>
    </tr>`).join('');

  const variationRows = variations.map((v, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : LIGHT}">
      <td style="padding:7px 10px;font-family:monospace;font-size:11px;white-space:nowrap">${esc(v.number)}</td>
      <td style="padding:7px 10px">
        <div style="font-weight:500">${esc(v.title)}</div>
        ${v.reason ? `<div style="font-size:11px;color:${MUTED};margin-top:2px">${esc(v.reason)}</div>` : ''}
        ${v.status === 'rejected' && v.rejectionReason ? `<div style="font-size:11px;color:${RED};margin-top:2px"><strong>Rejected:</strong> ${esc(v.rejectionReason)}</div>` : ''}
      </td>
      <td style="padding:7px 10px;text-align:center">
        <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;color:#fff;background:${varStatusColor(v.status)}">${varStatusLabel(v.status)}</span>
      </td>
      <td style="padding:7px 10px;white-space:nowrap;font-size:11px">${v.sentAt ? fmtDate(v.sentAt) : v.status === 'draft' ? 'Draft' : '—'}</td>
      <td style="padding:7px 10px;white-space:nowrap;font-size:11px">${v.status === 'approved' ? fmtDate(v.approvedAt) : v.status === 'rejected' ? fmtDate(v.rejectedAt) : '—'}</td>
      <td style="padding:7px 10px;text-align:right;font-variant-numeric:tabular-nums;font-weight:500">${fmt(v.totalAmount)}</td>
    </tr>`).join('');

  const materialRows = materials.map((m, i) => {
    const markup = m.totalCost > 0 && m.totalPrice > m.totalCost
      ? ((m.totalPrice - m.totalCost) / m.totalCost * 100).toFixed(0) + '%'
      : m.markupPercent != null ? m.markupPercent + '%' : '—';
    return `
    <tr style="background:${i % 2 === 0 ? '#fff' : LIGHT}">
      <td style="padding:7px 10px">${esc(m.name)}</td>
      <td style="padding:7px 10px;text-align:center">${String(m.quantity)}</td>
      <td style="padding:7px 10px;text-align:right;font-variant-numeric:tabular-nums">${fmt(m.totalCost)}</td>
      <td style="padding:7px 10px;text-align:center;color:${MUTED}">${markup}</td>
      <td style="padding:7px 10px;text-align:right;font-variant-numeric:tabular-nums">${fmt(m.totalPrice > 0 ? m.totalPrice : m.totalCost)}</td>
    </tr>`;
  }).join('');

  const phaseRows = phases.map((p, i) => {
    const isUnallocated = p.id === null;
    const rowBg = isUnallocated ? '#fffbeb' : (i % 2 === 0 ? '#fff' : LIGHT);
    return `
    <tr style="background:${rowBg}${isUnallocated ? ';font-style:italic' : ''}">
      <td style="padding:7px 10px;font-family:monospace;font-size:11px">${isUnallocated ? '' : esc(p.phaseCode || '—')}</td>
      <td style="padding:7px 10px;font-weight:${isUnallocated ? '400' : '500'};color:${isUnallocated ? MUTED : '#111827'}">${esc(p.name)}</td>
      <td style="padding:7px 10px;text-align:center;font-size:11px">${isUnallocated ? '—' : phaseStatusLabel(p.status || null)}</td>
      <td style="padding:7px 10px;text-align:right;font-size:11px">${isUnallocated ? '—' : fmtHours(p.bookedHours || 0)}</td>
      <td style="padding:7px 10px;text-align:right;font-size:11px">${fmtHours(p.hours)}</td>
      <td style="padding:7px 10px;text-align:right;font-variant-numeric:tabular-nums">${fmt(p.costs.labour)}</td>
      <td style="padding:7px 10px;text-align:right;font-variant-numeric:tabular-nums">${fmt(p.costs.subcontractor)}</td>
      <td style="padding:7px 10px;text-align:right;font-variant-numeric:tabular-nums">${fmt(p.costs.materials)}</td>
      <td style="padding:7px 10px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600">${fmt(p.costs.total)}</td>
    </tr>`;
  }).join('');

  const hasPhases = phases.filter(p => p.id !== null).length > 0;
  const hasMaterials = materials.length > 0;
  const hasPOs = purchaseOrders.length > 0;
  const hasLabour = workerMap.size > 0;
  const hasVariations = variations.length > 0;

  // Footer sums derived from actual phase rows so the table always self-reconciles.
  // These may be less than financial.totalCosts because financial includes expense-based
  // subcontractor and other costs not yet separately tracked at phase level.
  const phaseTableSums = phases.reduce(
    (acc, p) => ({
      labour: acc.labour + p.costs.labour,
      subcontractor: acc.subcontractor + p.costs.subcontractor,
      materials: acc.materials + p.costs.materials,
      total: acc.total + p.costs.total,
    }),
    { labour: 0, subcontractor: 0, materials: 0, total: 0 }
  );

  const summaryRow = (label: string, value: string, bold = false, color = '#111827', indent = false) =>
    `<tr><td style="padding:7px 14px;${indent ? 'padding-left:28px;' : ''}color:${bold ? '#111827' : MUTED};${bold ? 'font-weight:700;' : ''}">${esc(label)}</td><td style="padding:7px 14px;text-align:right;font-weight:${bold ? '700' : '500'};color:${color};font-variant-numeric:tabular-nums">${value}</td></tr>`;

  const thStyle = `padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#fff;background:${NAVY}`;
  const thRight = `${thStyle};text-align:right`;
  const thCenter = `${thStyle};text-align:center`;

  const sectionHeading = (title: string) =>
    `<h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${NAVY};border-bottom:2px solid ${NAVY};padding-bottom:6px;margin:28px 0 14px">${esc(title)}</h2>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Cost Report — ${esc(job.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 12px; color: #1f2937; background: #fff; padding: 32px 40px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 6px; }
  th { text-align: left; }
  td { vertical-align: top; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; border: 1px solid ${BORDER}; border-radius: 6px; overflow: hidden; margin-bottom: 24px; }
  .info-cell { padding: 12px 14px; border-right: 1px solid ${BORDER}; }
  .info-cell:last-child { border-right: none; }
  .info-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: ${MUTED}; margin-bottom: 4px; }
  .info-value { font-size: 13px; font-weight: 600; color: #111827; line-height: 1.4; }
  .summary-pills { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
  .pill { background: ${NAVY}; color: #fff; border-radius: 6px; padding: 10px 16px; text-align: center; min-width: 100px; }
  .pill.green { background: ${GREEN}; }
  .pill.amber { background: ${AMBER}; }
  .pill.red { background: ${RED}; }
  .pill-num { font-size: 20px; font-weight: 800; }
  .pill-lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.07em; opacity: 0.9; margin-top: 2px; }
  .footer { margin-top: 36px; padding-top: 12px; border-top: 1px solid ${BORDER}; font-size: 10px; color: ${MUTED}; display: flex; justify-content: space-between; }
  .profit-box { border: 2px solid ${marginColor}; border-radius: 8px; padding: 16px 20px; background: ${financial.grossMargin < 0 ? '#fef2f2' : financial.grossMargin < 10 ? '#fffbeb' : '#f0fdf4'}; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
  .empty-row td { padding: 10px 14px; color: ${MUTED}; font-style: italic; }
  @media print { body { padding: 20px 24px; } }
</style>
</head>
<body>

<!-- HEADER -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:18px;border-bottom:2px solid ${NAVY}">
  <div>
    ${logoHtml}
    <div style="font-size:17px;font-weight:800;color:${NAVY}">${esc(business.businessName)}</div>
    ${business.abn ? `<div style="font-size:11px;color:${MUTED}">ABN ${esc(business.abn)}</div>` : ''}
    ${[business.phone, business.email].filter(Boolean).map(esc).join(' &bull; ') ? `<div style="font-size:11px;color:${MUTED};margin-top:2px">${[business.phone, business.email].filter(Boolean).map(esc).join(' &bull; ')}</div>` : ''}
  </div>
  <div style="text-align:right">
    <div style="font-size:22px;font-weight:800;color:${NAVY}">Cost Report</div>
    <div style="font-size:11px;color:${MUTED};margin-top:3px">For government and head-contractor submission</div>
    <div style="font-size:11px;color:${MUTED};margin-top:2px">Generated ${fmtDate(exportedAt)}</div>
    ${jobDisplayNum ? `<div style="font-size:14px;font-weight:700;color:${NAVY};margin-top:6px">Job ${jobDisplayNum}</div>` : ''}
  </div>
</div>

<!-- SECTION 1: CONTRACT OVERVIEW -->
${sectionHeading('1. Contract Overview')}
<div class="info-grid">
  <div class="info-cell">
    <div class="info-label">Project</div>
    <div class="info-value">${esc(job.title)}</div>
    ${job.description ? `<div style="font-size:11px;color:${MUTED};margin-top:3px">${esc(job.description)}</div>` : ''}
  </div>
  <div class="info-cell">
    <div class="info-label">Job Number</div>
    <div class="info-value">${jobDisplayNum || '—'}</div>
    <div class="info-label" style="margin-top:8px">Status</div>
    <div class="info-value" style="font-size:12px">${esc(job.status.replace(/_/g, ' '))}</div>
  </div>
  <div class="info-cell">
    <div class="info-label">Site Address</div>
    <div class="info-value" style="font-size:12px">${esc(job.address || '—')}</div>
  </div>
</div>
<div class="info-grid">
  <div class="info-cell">
    <div class="info-label">Client</div>
    <div class="info-value">${esc(client?.name || '—')}</div>
    ${client?.email ? `<div style="font-size:11px;color:${MUTED}">${esc(client.email)}</div>` : ''}
    ${client?.phone ? `<div style="font-size:11px;color:${MUTED}">${esc(client.phone)}</div>` : ''}
  </div>
  <div class="info-cell">
    <div class="info-label">Original Contract Value</div>
    <div class="info-value">${financial.contractValue != null ? fmt(financial.contractValue) : '—'}</div>
    ${financial.approvedVariationsTotal > 0 ? `<div class="info-label" style="margin-top:8px">Revised Contract Value</div><div class="info-value">${financial.revisedContractValue != null ? fmt(financial.revisedContractValue) : '—'}</div>` : ''}
  </div>
  <div class="info-cell">
    <div class="info-label">Commenced</div>
    <div class="info-value" style="font-size:12px">${fmtDate(job.startedAt || job.scheduledAt)}</div>
    ${job.completedAt ? `<div class="info-label" style="margin-top:8px">Completed</div><div class="info-value" style="font-size:12px">${fmtDate(job.completedAt)}</div>` : ''}
  </div>
</div>

<div class="summary-pills">
  ${financial.contractValue != null ? `<div class="pill"><div class="pill-num">${fmt(financial.contractValue)}</div><div class="pill-lbl">Contract</div></div>` : ''}
  ${financial.approvedVariationsTotal > 0 ? `<div class="pill" style="background:#2563eb"><div class="pill-num">${fmt(financial.approvedVariationsTotal)}</div><div class="pill-lbl">Approved Variations</div></div>` : ''}
  <div class="pill ${financial.grossMargin >= 10 ? 'green' : financial.grossMargin >= 0 ? 'amber' : 'red'}"><div class="pill-num">${financial.grossMargin.toFixed(1)}%</div><div class="pill-lbl">Gross Margin</div></div>
  <div class="pill"><div class="pill-num">${fmtHours(hours.total)}</div><div class="pill-lbl">Total Hours</div></div>
</div>

<!-- SECTION 2: SCHEDULE OF VALUES -->
${hasPhases ? `
${sectionHeading('2. Schedule of Values')}
<table>
  <thead>
    <tr>
      <th style="${thStyle};width:80px">Phase Code</th>
      <th style="${thStyle}">Phase Name</th>
      <th style="${thCenter};width:80px">Status</th>
      <th style="${thRight};width:70px">Est. Hrs</th>
      <th style="${thRight};width:70px">Act. Hrs</th>
      <th style="${thRight};width:90px">Labour</th>
      <th style="${thRight};width:90px">Subs</th>
      <th style="${thRight};width:90px">Materials</th>
      <th style="${thRight};width:90px">Total Cost</th>
    </tr>
  </thead>
  <tbody>
    ${phaseRows || `<tr class="empty-row"><td colspan="9">No phases defined for this project.</td></tr>`}
  </tbody>
  <tfoot>
    <tr style="background:${LIGHT};font-weight:700">
      <td colspan="5" style="padding:8px 10px;text-align:right;font-size:11px;color:${MUTED}">TOTALS (attributed)</td>
      <td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums">${fmt(phaseTableSums.labour)}</td>
      <td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums">${fmt(phaseTableSums.subcontractor)}</td>
      <td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums">${fmt(phaseTableSums.materials)}</td>
      <td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums">${fmt(phaseTableSums.total)}</td>
    </tr>
  </tfoot>
</table>
<p style="font-size:10px;color:${MUTED};margin-top:4px">* Labour (time entries) and materials are attributed to phases by scheduled date window. Costs outside any phase window appear in the "Unallocated" row. Other expenses (subcontractor invoices, general expenses) are shown in full in the Financial Summary. Variations link to phases directly.</p>` : ''}

<!-- SECTION 3: VARIATION LOG -->
${sectionHeading('3. Variation Register')}
${hasVariations ? `
<table>
  <thead>
    <tr>
      <th style="${thStyle};width:70px">Var #</th>
      <th style="${thStyle}">Title / Reason</th>
      <th style="${thCenter};width:80px">Status</th>
      <th style="${thCenter};width:90px">Submitted</th>
      <th style="${thCenter};width:90px">Determined</th>
      <th style="${thRight};width:100px">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${variationRows}
  </tbody>
  <tfoot>
    <tr style="background:${LIGHT}">
      <td colspan="5" style="padding:8px 10px;text-align:right;font-size:11px;color:${MUTED}">Approved Variations Total</td>
      <td style="padding:8px 10px;text-align:right;font-weight:700;color:${GREEN};font-variant-numeric:tabular-nums">${fmt(financial.approvedVariationsTotal)}</td>
    </tr>
    ${financial.pendingVariationsTotal > 0 ? `<tr style="background:${LIGHT}">
      <td colspan="5" style="padding:8px 10px;text-align:right;font-size:11px;color:${MUTED}">Pending / Unresolved</td>
      <td style="padding:8px 10px;text-align:right;font-weight:600;color:${AMBER};font-variant-numeric:tabular-nums">${fmt(financial.pendingVariationsTotal)}</td>
    </tr>` : ''}
    ${financial.rejectedVariationsTotal > 0 ? `<tr style="background:${LIGHT}">
      <td colspan="5" style="padding:8px 10px;text-align:right;font-size:11px;color:${MUTED}">Rejected</td>
      <td style="padding:8px 10px;text-align:right;font-weight:600;color:${RED};font-variant-numeric:tabular-nums">${fmt(financial.rejectedVariationsTotal)}</td>
    </tr>` : ''}
  </tfoot>
</table>` : `<p style="color:${MUTED};font-style:italic;padding:8px 0">No variations recorded for this job.</p>`}

<!-- SECTION 4: SUBCONTRACTOR COSTS -->
${sectionHeading('4. Labour and Subcontractor Costs')}
${hasLabour ? `
<table>
  <thead>
    <tr>
      <th style="${thStyle}">Worker</th>
      <th style="${thCenter};width:120px">Type</th>
      <th style="${thRight};width:90px">Hours</th>
      <th style="${thRight};width:100px">Cost</th>
    </tr>
  </thead>
  <tbody>
    ${workerRows}
  </tbody>
  <tfoot>
    <tr style="background:${LIGHT};font-weight:700">
      <td colspan="2" style="padding:8px 10px;text-align:right;font-size:11px;color:${MUTED}">TOTALS</td>
      <td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums">${fmtHours(hours.total)}</td>
      <td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums">${fmt(financial.labourCost + financial.subcontractorCost)}</td>
    </tr>
  </tfoot>
</table>` : `<p style="color:${MUTED};font-style:italic;padding:8px 0">No labour records for this job.</p>`}

<!-- SECTION 5: MATERIAL COSTS -->
${sectionHeading('5. Material Costs')}
${hasMaterials ? `
<table>
  <thead>
    <tr>
      <th style="${thStyle}">Item</th>
      <th style="${thCenter};width:60px">Qty</th>
      <th style="${thRight};width:100px">Cost</th>
      <th style="${thCenter};width:70px">Markup</th>
      <th style="${thRight};width:100px">Sell Price</th>
    </tr>
  </thead>
  <tbody>
    ${materialRows}
  </tbody>
  <tfoot>
    <tr style="background:${LIGHT};font-weight:700">
      <td colspan="2" style="padding:8px 10px;text-align:right;font-size:11px;color:${MUTED}">TOTALS</td>
      <td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums">${fmt(financial.materialsCost)}</td>
      <td></td>
      <td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums">${fmt(financial.materialsSellPrice)}</td>
    </tr>
    ${financial.markupEarned > 0 ? `<tr style="background:${LIGHT}">
      <td colspan="4" style="padding:8px 10px;text-align:right;font-size:11px;color:${MUTED}">Markup Captured</td>
      <td style="padding:8px 10px;text-align:right;font-weight:600;color:${GREEN};font-variant-numeric:tabular-nums">+${fmt(financial.markupEarned)}</td>
    </tr>` : ''}
  </tfoot>
</table>` : `<p style="color:${MUTED};font-style:italic;padding:8px 0">No materials recorded for this job.</p>`}

<!-- SECTION 6: PURCHASE ORDERS -->
${hasPOs ? `
${sectionHeading('6. Purchase Order Summary')}
<p style="font-size:11px;color:${MUTED};margin:0 0 8px">By supplier — individual PO detail follows.</p>
<table style="margin-bottom:14px">
  <thead>
    <tr>
      <th style="${thStyle}">Supplier</th>
      <th style="${thCenter};width:60px">POs</th>
      <th style="${thStyle};width:120px">Status(es)</th>
      <th style="${thRight};width:110px">Total Amount</th>
    </tr>
  </thead>
  <tbody>
    ${supplierRows}
  </tbody>
  <tfoot>
    <tr style="background:${LIGHT};font-weight:700">
      <td colspan="3" style="padding:8px 10px;text-align:right;font-size:11px;color:${MUTED}">TOTAL (excl. cancelled)</td>
      <td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums">${fmt(financial.purchaseOrdersTotal)}</td>
    </tr>
  </tfoot>
</table>
<p style="font-size:11px;color:${MUTED};margin:0 0 6px;font-weight:600">Individual Purchase Orders</p>
<table>
  <thead>
    <tr>
      <th style="${thStyle};width:90px">PO Number</th>
      <th style="${thStyle}">Supplier</th>
      <th style="${thCenter};width:90px">Date</th>
      <th style="${thCenter};width:80px">Status</th>
      <th style="${thRight};width:100px">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${poDetailRows}
  </tbody>
</table>
<p style="font-size:10px;color:${MUTED};margin-top:4px">* Purchase order amounts are informational and may overlap with material costs above.</p>` : ''}

<!-- SECTION 7: FINANCIAL SUMMARY -->
${sectionHeading('7. Financial Summary')}
<div style="display:flex;gap:24px;align-items:flex-start">
  <div style="flex:1">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${MUTED};margin-bottom:6px">Revenue</div>
    <table style="border:1px solid ${BORDER};border-radius:6px;overflow:hidden">
      ${financial.contractValue != null ? summaryRow('Original Contract Value', fmt(financial.contractValue)) : ''}
      ${financial.approvedVariationsTotal > 0 ? summaryRow('Approved Variations', '+' + fmt(financial.approvedVariationsTotal), false, GREEN, true) : ''}
      ${financial.revisedContractValue != null && financial.approvedVariationsTotal > 0 ? summaryRow('Revised Contract Value', fmt(financial.revisedContractValue), true) : ''}
      ${summaryRow('Invoiced to Date', fmt(financial.invoicedRevenue))}
      ${financial.pendingVariationsTotal > 0 ? summaryRow('Pending Variations (not yet approved)', fmt(financial.pendingVariationsTotal), false, AMBER) : ''}
    </table>
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${MUTED};margin:16px 0 6px">Costs</div>
    <table style="border:1px solid ${BORDER};border-radius:6px;overflow:hidden">
      ${summaryRow('Labour (' + fmtHours(hours.total) + ' hrs)', fmt(financial.labourCost), false, '#111', true)}
      ${financial.subcontractorCost > 0 ? summaryRow('Subcontractor Labour', fmt(financial.subcontractorCost), false, '#111', true) : ''}
      ${summaryRow('Materials (purchase cost)', fmt(financial.materialsCost), false, '#111', true)}
      ${financial.otherExpenses > 0 ? summaryRow('Other Expenses', fmt(financial.otherExpenses), false, '#111', true) : ''}
      ${summaryRow('Total Costs', fmt(financial.totalCosts), true)}
      ${financial.budgetedCost != null ? summaryRow('Budgeted Cost', fmt(financial.budgetedCost)) : ''}
      ${financial.budgetVariance != null ? summaryRow('Budget Variance', (financial.budgetVariance > 0 ? '+' : '') + fmt(financial.budgetVariance), false, financial.budgetVariance > 0 ? RED : GREEN) : ''}
    </table>
  </div>
  <div style="flex:0 0 240px">
    <div class="profit-box">
      <div>
        <div style="font-size:11px;color:${MUTED};margin-bottom:4px">${financial.grossProfit < 0 ? 'Gross Loss' : 'Gross Profit'}</div>
        <div style="font-size:26px;font-weight:800;color:${marginColor}">${fmt(Math.abs(financial.grossProfit))}</div>
        <div style="font-size:12px;font-weight:600;color:${marginColor};margin-top:2px">${financial.grossMargin.toFixed(1)}% margin</div>
      </div>
    </div>
    <table style="border:1px solid ${BORDER};border-radius:6px;overflow:hidden">
      ${summaryRow('Total Revenue (invoiced)', fmt(financial.invoicedRevenue), true)}
      ${summaryRow('Total Costs', fmt(financial.totalCosts), true)}
      ${summaryRow(financial.grossProfit < 0 ? 'Net Loss' : 'Net Profit', fmt(Math.abs(financial.grossProfit)), true, marginColor)}
    </table>
    ${financial.markupEarned > 0 ? `<div style="margin-top:10px;padding:10px 12px;background:${LIGHT};border:1px solid ${BORDER};border-radius:6px;font-size:11px;color:${MUTED}">Materials markup captured: <strong style="color:${GREEN}">${fmt(financial.markupEarned)}</strong></div>` : ''}
  </div>
</div>

${retention && retention.sumRetentionHeld > 0 ? `
<!-- SECTION 8: RETENTION SCHEDULE -->
${sectionHeading('8. Retention Schedule')}
<div style="display:flex;gap:24px;align-items:flex-start;margin-bottom:12px">
  <div style="flex:1">
    <table style="border:1px solid ${BORDER};border-radius:6px;overflow:hidden">
      ${summaryRow('Total Retention Held', fmt(retention.sumRetentionHeld), true)}
      ${summaryRow('Outstanding (unreleased)', fmt(retention.outstandingRetention), false, retention.outstandingRetention > 0 ? AMBER : GREEN)}
      ${retention.outstandingRetention === 0 && retention.sumRetentionHeld > 0 ? summaryRow('Released in Full', fmt(retention.sumRetentionHeld), false, GREEN) : ''}
    </table>
  </div>
  <div style="flex:1">
    <table style="border:1px solid ${BORDER};border-radius:6px;overflow:hidden">
      ${summaryRow('Practical Completion', fmtDate(retention.practicalCompletionDate))}
      ${summaryRow('DLP Period', retention.defectsLiabilityMonths + ' months')}
      ${summaryRow('DLP End / Release Date', fmtDate(retention.releaseDate))}
    </table>
  </div>
</div>
<p style="font-size:10px;color:${MUTED};margin-top:4px">* Retention held is the total withheld across all approved and paid progress claims. Outstanding retention is the amount not yet returned via an approved retention release claim.</p>
` : ''}

<!-- FOOTER -->
<div class="footer">
  <span>${esc(business.businessName)}${business.abn ? ` · ABN ${esc(business.abn)}` : ''} · Cost Report · ${jobDisplayNum || esc(job.title)}</span>
  <span>Generated ${fmtDate(exportedAt)} · For government and head-contractor submission</span>
</div>

</body>
</html>`;
}
import { getClientDisplayName, getWorkerDisplayName, ensureDisplayName } from './shared-displayName';
import { ObjectStorageService, parseObjectPath, objectStorageClient } from './objectStorage';
import { pdfQueue, BackpressureError } from './concurrency';

// Backwards-compat shims. PDF concurrency is now governed by `pdfQueue`
// (see server/concurrency.ts). Callers that wrap their work inside
// `acquirePdfSlot()` ... `releasePdfSlot()` are still supported, but new
// code should prefer `pdfQueue.run(() => ...)` so that backpressure is
// raised as a `BackpressureError` (HTTP 429 + Retry-After) instead of
// busy-waiting.
async function acquirePdfSlot(): Promise<void> {
  // Use the bounded queue so callers fail fast (HTTP 429) when overloaded
  // instead of polling forever and tying up the event loop.
  await pdfQueue.acquire();
}

function releasePdfSlot(): void {
  pdfQueue.release();
}

export { pdfQueue, BackpressureError };

// ── Document Register PDF ─────────────────────────────────────────────────────

export interface DocRegisterDocument {
  docNumber: string;
  title: string;
  category: string;
  currentRevision: string;
  revisions: Array<{
    revision: string;
    fileName: string;
    uploadedAt: string;
    uploadedByName?: string | null;
    notes?: string | null;
  }>;
}

export interface DocRegisterRfi {
  rfiNumber: string;
  question: string;
  description?: string | null;
  assignedToName?: string | null;
  status: string;
  answerText?: string | null;
  answeredAt?: string | null;
  createdAt: string;
}

export function generateDocumentRegisterPDF(data: {
  job: { number?: string | null; title?: string | null; address?: string | null; scheduledAt?: string | null; completedAt?: string | null };
  business: { businessName?: string | null; logoUrl?: string | null; phone?: string | null; email?: string | null };
  documents: DocRegisterDocument[];
  rfis: DocRegisterRfi[];
  exportedAt: string;
}): string {
  const { job, business, documents, rfis, exportedAt } = data;

  const esc = (v: string | null | undefined) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const logoHtml = business.logoUrl
    ? `<img src="${business.logoUrl}" class="logo" alt="${esc(business.businessName)}" />`
    : '';

  const DOC_CATEGORIES = ['Drawings', 'Specifications', 'RFIs', 'SWMS', 'Certificates', 'Other'];

  const groupedDocs: Record<string, DocRegisterDocument[]> = {};
  for (const cat of DOC_CATEGORIES) groupedDocs[cat] = [];
  for (const doc of documents) {
    const cat = DOC_CATEGORIES.includes(doc.category) ? doc.category : 'Other';
    groupedDocs[cat].push(doc);
  }

  const rfiStatusLabel = (s: string) =>
    s === 'open' ? 'Open' : s === 'answered' ? 'Answered' : 'Closed';
  const rfiStatusColor = (s: string) =>
    s === 'open' ? '#f59e0b' : s === 'answered' ? '#3b82f6' : '#6b7280';

  const docSectionsHtml = DOC_CATEGORIES.filter(cat => groupedDocs[cat].length > 0).map(cat => {
    const rows = groupedDocs[cat].map(doc => {
      const revRows = doc.revisions.length === 0
        ? `<tr><td colspan="4" style="color:#9ca3af;font-style:italic;padding:4px 8px">No revisions</td></tr>`
        : doc.revisions.map((rev, i) => `
          <tr class="${i % 2 === 0 ? 'even' : ''}">
            <td style="font-family:monospace;white-space:nowrap">Rev ${esc(rev.revision)}</td>
            <td>${esc(rev.fileName)}</td>
            <td style="white-space:nowrap">${fmtDate(rev.uploadedAt)}</td>
            <td>${esc(rev.uploadedByName || '')}</td>
          </tr>`).join('');

      return `
        <tr class="doc-header-row">
          <td style="width:100px;font-family:monospace;font-size:11px">${esc(doc.docNumber)}</td>
          <td><strong>${esc(doc.title)}</strong></td>
          <td style="width:80px;text-align:center;font-family:monospace">Rev ${esc(doc.currentRevision)}</td>
          <td style="width:80px;text-align:center;color:#6b7280;font-size:11px">${doc.revisions.length} rev${doc.revisions.length !== 1 ? 's' : ''}</td>
        </tr>
        <tr class="rev-rows-wrapper">
          <td colspan="4" style="padding:0">
            <table class="rev-table">
              <thead>
                <tr>
                  <th style="width:80px">Revision</th>
                  <th>File</th>
                  <th style="width:100px">Uploaded</th>
                  <th style="width:120px">By</th>
                </tr>
              </thead>
              <tbody>${revRows}</tbody>
            </table>
          </td>
        </tr>`;
    }).join('');

    return `
      <div class="category-section">
        <h3 class="category-heading">${esc(cat)}</h3>
        <table class="doc-table">
          <thead>
            <tr>
              <th style="width:100px">Doc #</th>
              <th>Title</th>
              <th style="width:80px">Current Rev</th>
              <th style="width:80px">History</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join('');

  const rfisHtml = rfis.length === 0 ? '<p class="empty-note">No RFIs raised for this project.</p>' : `
    <table class="doc-table">
      <thead>
        <tr>
          <th style="width:90px">RFI #</th>
          <th>Question</th>
          <th style="width:70px">Status</th>
          <th style="width:90px">Raised</th>
          <th style="width:90px">Answered</th>
          <th style="width:110px">Assigned To</th>
        </tr>
      </thead>
      <tbody>
        ${rfis.map((rfi, i) => `
        <tr class="${i % 2 === 0 ? 'even' : ''}">
          <td style="font-family:monospace;font-size:11px">${esc(rfi.rfiNumber)}</td>
          <td>
            <div>${esc(rfi.question)}</div>
            ${rfi.answerText ? `<div style="color:#4b5563;font-size:11px;margin-top:3px"><em>Answer:</em> ${esc(rfi.answerText)}</div>` : ''}
          </td>
          <td><span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;color:#fff;background:${rfiStatusColor(rfi.status)}">${rfiStatusLabel(rfi.status)}</span></td>
          <td style="white-space:nowrap;font-size:11px">${fmtDate(rfi.createdAt)}</td>
          <td style="white-space:nowrap;font-size:11px">${fmtDate(rfi.answeredAt)}</td>
          <td style="font-size:11px">${esc(rfi.assignedToName || '—')}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;

  const dateRange = (() => {
    if (job.scheduledAt && job.completedAt)
      return `${fmtDate(job.scheduledAt)} → ${fmtDate(job.completedAt)}`;
    if (job.scheduledAt) return `From ${fmtDate(job.scheduledAt)}`;
    return '—';
  })();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Document Register — ${esc(job.number || '')} ${esc(job.title || '')}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 12px; color: #1f2937; background: #fff; padding: 32px 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #1e3a5f; }
  .header-left { flex: 1; }
  .logo { max-height: 60px; max-width: 200px; object-fit: contain; }
  .business-name { font-size: 18px; font-weight: 700; color: #1e3a5f; }
  .business-contact { font-size: 11px; color: #6b7280; margin-top: 2px; }
  .header-right { text-align: right; }
  .report-title { font-size: 20px; font-weight: 700; color: #1e3a5f; }
  .report-meta { font-size: 11px; color: #6b7280; margin-top: 4px; }
  .job-info { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 16px; margin-bottom: 24px; display: flex; gap: 32px; flex-wrap: wrap; }
  .job-info-item { }
  .job-info-label { font-size: 10px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; }
  .job-info-value { font-size: 13px; font-weight: 600; color: #1f2937; margin-top: 2px; }
  .summary-bar { display: flex; gap: 20px; margin-bottom: 24px; }
  .summary-pill { background: #1e3a5f; color: #fff; border-radius: 6px; padding: 10px 18px; text-align: center; min-width: 90px; }
  .summary-pill .num { font-size: 22px; font-weight: 700; }
  .summary-pill .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.85; margin-top: 2px; }
  .section-heading { font-size: 15px; font-weight: 700; color: #1e3a5f; margin-bottom: 14px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
  .category-section { margin-bottom: 24px; }
  .category-heading { font-size: 13px; font-weight: 700; color: #374151; background: #f1f5f9; padding: 6px 10px; border-radius: 4px; margin-bottom: 8px; }
  .doc-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 4px; }
  .doc-table th { background: #1e3a5f; color: #fff; text-align: left; padding: 6px 10px; font-weight: 600; font-size: 11px; }
  .doc-table td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .doc-header-row td { background: #f8fafc; font-weight: 500; }
  .rev-rows-wrapper td { background: #fff; }
  .rev-table { width: 100%; border-collapse: collapse; font-size: 11px; border-top: 1px solid #e9edf2; }
  .rev-table th { background: #eef2f7; color: #4b5563; text-align: left; padding: 4px 10px 4px 20px; font-weight: 600; font-size: 10px; letter-spacing: 0.04em; }
  .rev-table td { padding: 4px 10px 4px 20px; color: #6b7280; border-bottom: 1px solid #f5f5f5; }
  .rev-table tr.even td { background: #fafafa; }
  .even td { background: #fafbfc; }
  .empty-note { color: #9ca3af; font-style: italic; font-size: 12px; padding: 8px 0; }
  .footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    ${logoHtml}
    ${!logoHtml ? `<div class="business-name">${esc(business.businessName || 'Business')}</div>` : `<div class="business-name" style="margin-top:6px">${esc(business.businessName || '')}</div>`}
    ${(business.phone || business.email) ? `<div class="business-contact">${[business.phone, business.email].filter(Boolean).map(esc).join(' · ')}</div>` : ''}
  </div>
  <div class="header-right">
    <div class="report-title">Document Register</div>
    <div class="report-meta">Handover Pack</div>
    <div class="report-meta" style="margin-top:4px">Exported ${fmtDate(exportedAt)}</div>
  </div>
</div>

<div class="job-info">
  ${job.number ? `<div class="job-info-item"><div class="job-info-label">Job #</div><div class="job-info-value">${esc(job.number)}</div></div>` : ''}
  ${job.title ? `<div class="job-info-item"><div class="job-info-label">Project</div><div class="job-info-value">${esc(job.title)}</div></div>` : ''}
  ${job.address ? `<div class="job-info-item"><div class="job-info-label">Address</div><div class="job-info-value">${esc(job.address)}</div></div>` : ''}
  <div class="job-info-item"><div class="job-info-label">Period</div><div class="job-info-value">${dateRange}</div></div>
</div>

<div class="summary-bar">
  <div class="summary-pill"><div class="num">${documents.length}</div><div class="lbl">Document${documents.length !== 1 ? 's' : ''}</div></div>
  <div class="summary-pill"><div class="num">${documents.reduce((s, d) => s + d.revisions.length, 0)}</div><div class="lbl">Revisions</div></div>
  <div class="summary-pill"><div class="num">${rfis.length}</div><div class="lbl">RFI${rfis.length !== 1 ? 's' : ''}</div></div>
  <div class="summary-pill" style="background:#f59e0b"><div class="num">${rfis.filter(r => r.status === 'open').length}</div><div class="lbl">Open RFIs</div></div>
</div>

${documents.length > 0 ? `<h2 class="section-heading">Documents</h2>${docSectionsHtml}` : '<p class="empty-note" style="margin-bottom:24px">No documents registered for this project.</p>'}

<h2 class="section-heading" style="margin-top:12px">Requests for Information (RFIs)</h2>
${rfisHtml}

<div class="footer">
  <span>${esc(business.businessName || '')} · Document Register · ${esc(job.number || '')} ${esc(job.title || '')}</span>
  <span>Generated ${fmtDate(exportedAt)}</span>
</div>

</body>
</html>`;
}

/**
 * Resolves a logo URL from object storage path to a base64 data URL.
 * This is necessary because Puppeteer can't access /objects/* paths directly.
 * 
 * @param logoUrl - The logo URL (could be /objects/*, data:*, https://* or null)
 * @returns A base64 data URL that can be used in HTML img tags, or the original URL if not an object path
 */
export async function resolveLogoUrl(logoUrl: string | null | undefined): Promise<string | null> {
  if (!logoUrl) {
    return null;
  }
  
  // Already a data URL - return as is
  if (logoUrl.startsWith('data:')) {
    return logoUrl;
  }
  
  // Already an https URL - return as is (external URL)
  if (logoUrl.startsWith('https://') || logoUrl.startsWith('http://')) {
    return logoUrl;
  }
  
  // Normalize the path to ensure it has /objects/ prefix
  let objectPath = logoUrl;
  if (!objectPath.startsWith('/objects/')) {
    if (objectPath.startsWith('/')) {
      objectPath = `/objects${objectPath}`;
    } else {
      objectPath = `/objects/${objectPath}`;
    }
  }
  
  // Object storage path - fetch and convert to base64
  try {
    const objectStorageService = new ObjectStorageService();
    const file = await objectStorageService.getObjectEntityFile(objectPath);
    
    // Download the file content
    const [buffer] = await file.download();
    
    // Get the content type
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || 'image/png';
    
    // Convert to base64 data URL
    const base64 = buffer.toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error('Failed to resolve logo from object storage:', error);
    return null;
  }
}

/**
 * Resolves the logo URL in a business settings object for PDF generation.
 * Returns a new object with the resolved logo URL.
 */
export async function resolveBusinessLogoForPdf<T extends { logoUrl?: string | null }>(business: T): Promise<T> {
  const resolvedLogoUrl = await resolveLogoUrl(business.logoUrl);
  return {
    ...business,
    logoUrl: resolvedLogoUrl,
  };
}

/**
 * Calculates the line item total on-the-fly.
 * If item.total is 0 or missing, calculates it from quantity * unitPrice.
 * This ensures PDFs display correct amounts even if stored total is 0.
 */
function calculateLineItemTotal(item: { quantity?: string | number | null; unitPrice?: string | number | null; total?: string | number | null }): number {
  const storedTotal = parseFloat(String(item.total || '0'));
  if (storedTotal > 0) {
    return storedTotal;
  }
  const qty = parseFloat(String(item.quantity || '1'));
  const price = parseFloat(String(item.unitPrice || '0'));
  return qty * price;
}

// Document Template Definitions (mirrored from client/src/lib/document-templates.ts)
type TemplateId = 'professional' | 'modern' | 'minimal';

interface DocumentTemplate {
  id: TemplateId;
  fontFamily: string;
  tableStyle: 'bordered' | 'striped' | 'minimal';
  headerBorderWidth: string;
  showHeaderDivider: boolean;
  noteStyle: 'bordered' | 'highlighted' | 'simple';
  baseFontSize: string;
  headingWeight: number;
  bodyWeight: number;
}

// Customization options that can override template defaults (mirrors client type)
interface TemplateCustomization {
  tableStyle?: 'bordered' | 'striped' | 'minimal';
  noteStyle?: 'bordered' | 'highlighted' | 'simple';
  headerBorderWidth?: '1px' | '2px' | '3px' | '4px';
  showHeaderDivider?: boolean;
  bodyWeight?: 400 | 500 | 600 | 700;
  headingWeight?: 600 | 700 | 800;
  accentColor?: string;
}

// Apply customizations to base template
function getCustomizedTemplate(templateId: TemplateId, customization?: TemplateCustomization): { template: DocumentTemplate; accentColor: string } {
  const baseTemplate = DOCUMENT_TEMPLATES[templateId] || DOCUMENT_TEMPLATES.minimal;
  
  if (!customization) {
    return { template: baseTemplate, accentColor: DOCUMENT_ACCENT_COLOR };
  }
  
  const template: DocumentTemplate = {
    ...baseTemplate,
    tableStyle: customization.tableStyle ?? baseTemplate.tableStyle,
    noteStyle: customization.noteStyle ?? baseTemplate.noteStyle,
    headerBorderWidth: customization.headerBorderWidth ?? baseTemplate.headerBorderWidth,
    showHeaderDivider: customization.showHeaderDivider ?? baseTemplate.showHeaderDivider,
    bodyWeight: customization.bodyWeight ?? baseTemplate.bodyWeight,
    headingWeight: customization.headingWeight ?? baseTemplate.headingWeight,
  };
  
  const accentColor = customization.accentColor || DOCUMENT_ACCENT_COLOR;
  
  return { template, accentColor };
}

// Fixed document accent color - consistent navy blue across all templates
// This must match DOCUMENT_ACCENT_COLOR in client/src/lib/document-templates.ts
const DOCUMENT_ACCENT_COLOR = '#1e3a5f';

// Interface for custom template settings stored in businessSettings.documentTemplateSettings
interface CustomTemplateSettings {
  brandColors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
  typography?: {
    style?: 'modern' | 'professional' | 'minimal';
  };
  layout?: {
    header?: { includes_company_name?: boolean; includes_abn?: boolean; includes_contact_info?: boolean; };
    totals?: { position?: string; shows_subtotal?: boolean; shows_gst?: boolean; shows_total?: boolean; };
    footer?: { has_terms?: boolean; has_payment_details?: boolean; has_signature_block?: boolean; };
  };
  logo?: {
    position?: 'top-left' | 'top-center' | 'top-right' | 'none';
    approximate_size?: 'small' | 'medium' | 'large' | 'none';
  };
}

// Get template and accent color from business settings (including custom uploaded templates)
// This function merges both legacy TemplateCustomization fields AND new AI-analyzed CustomTemplateSettings
function getTemplateFromBusinessSettings(business: { documentTemplate?: string | null; documentTemplateSettings?: unknown }): { template: DocumentTemplate; accentColor: string } {
  const settings = business.documentTemplateSettings as (TemplateCustomization & CustomTemplateSettings) | null;
  
  // Determine base template ID
  let baseTemplateId: TemplateId = 'professional';
  
  // Check AI-analyzed typography style first, then fall back to documentTemplate setting
  if (settings?.typography?.style) {
    const style = settings.typography.style;
    if (style === 'modern' || style === 'professional' || style === 'minimal') {
      baseTemplateId = style;
    }
  } else if (business.documentTemplate) {
    const storedTemplate = business.documentTemplate as string;
    if (storedTemplate === 'modern' || storedTemplate === 'professional' || storedTemplate === 'minimal') {
      baseTemplateId = storedTemplate;
    }
  }
  
  // Build TemplateCustomization from both legacy fields and new AI-analyzed settings
  const customization: TemplateCustomization = {};
  
  // Preserve legacy customization fields if they exist
  if (settings?.tableStyle) customization.tableStyle = settings.tableStyle;
  if (settings?.noteStyle) customization.noteStyle = settings.noteStyle;
  if (settings?.headerBorderWidth) customization.headerBorderWidth = settings.headerBorderWidth;
  if (settings?.showHeaderDivider !== undefined) customization.showHeaderDivider = settings.showHeaderDivider;
  if (settings?.bodyWeight) customization.bodyWeight = settings.bodyWeight;
  if (settings?.headingWeight) customization.headingWeight = settings.headingWeight;
  
  // Determine accent color with proper fallback chain:
  // 1. AI-analyzed brandColors.primary
  // 2. Legacy accentColor field
  // 3. Default navy color
  if (settings?.brandColors?.primary) {
    customization.accentColor = settings.brandColors.primary;
  } else if (settings?.accentColor) {
    customization.accentColor = settings.accentColor;
  }
  
  // Use the existing getCustomizedTemplate to apply all customizations properly
  return getCustomizedTemplate(baseTemplateId, Object.keys(customization).length > 0 ? customization : undefined);
}

// Document-level template interface (saved when document is created)
interface DocumentTemplateData {
  documentTemplate?: string | null;
  // Stored as Json in the DB (typed `unknown` on select rows); narrowed to
  // TemplateCustomization at the use site below.
  documentTemplateSettings?: unknown;
}

// Get template from document first (saved at creation time), falling back to business settings
// This ensures PDFs use the template the document was created with, not the current business template
function getTemplateForDocument(
  document: DocumentTemplateData,
  business: BusinessSettings
): { template: DocumentTemplate; accentColor: string } {
  // Check if document has its own template settings (saved at creation time)
  if (document.documentTemplate) {
    const docTemplateId = document.documentTemplate as string;
    if (docTemplateId === 'modern' || docTemplateId === 'professional' || docTemplateId === 'minimal') {
      // Use document's own template settings
      const docSettings = document.documentTemplateSettings as TemplateCustomization | null;
      console.log(`[PDF] Using document-level template: ${docTemplateId}`, docSettings ? 'with customization' : 'no customization');
      return getCustomizedTemplate(docTemplateId as TemplateId, docSettings || undefined);
    }
  }
  
  // Fall back to business settings
  console.log('[PDF] Document has no template settings, falling back to business settings');
  return getTemplateFromBusinessSettings(business);
}

// All templates use Inter font for consistent modern appearance
const INTER_FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const DOCUMENT_TEMPLATES: Record<TemplateId, DocumentTemplate> = {
  professional: {
    id: 'professional',
    fontFamily: INTER_FONT,
    tableStyle: 'bordered',
    headerBorderWidth: '2px',
    showHeaderDivider: true,
    noteStyle: 'bordered',
    baseFontSize: '11px',
    headingWeight: 700,
    bodyWeight: 600,
  },
  modern: {
    id: 'modern',
    fontFamily: INTER_FONT,
    tableStyle: 'striped',
    headerBorderWidth: '3px',
    showHeaderDivider: true,
    noteStyle: 'highlighted',
    baseFontSize: '12px',
    headingWeight: 700,
    bodyWeight: 600,
  },
  minimal: {
    id: 'minimal',
    fontFamily: INTER_FONT,
    tableStyle: 'minimal',
    headerBorderWidth: '1px',
    showHeaderDivider: false,
    noteStyle: 'simple',
    baseFontSize: '11px',
    headingWeight: 700,
    bodyWeight: 600,
  },
};

interface QuoteWithDetails {
  quote: Quote;
  lineItems: QuoteLineItem[];
  client: Client;
  business: BusinessSettings;
  signature?: DigitalSignature; // Quote acceptance signature (captured when client accepts)
  previousSignature?: DigitalSignature; // Client's most recent signature from previous quotes (for pre-fill)
  token?: string; // For payment API calls
  canAcceptPayments?: boolean; // Whether business has Stripe Connect set up
  job?: Job; // Linked job for address/details
  acceptanceUrl?: string; // Public URL for client to accept quote online
  jobSignatures?: DigitalSignature[]; // Signatures from linked job (for consistency with invoices)
  showSuccess?: boolean; // Show success confirmation overlay after accepting quote
  beforePhotos?: Array<{ url: string; caption?: string; category: string }>;
}

interface InvoiceWithDetails {
  invoice: Invoice;
  lineItems: InvoiceLineItem[];
  client: Client;
  business: BusinessSettings;
  job?: Job; // Linked job for address/details
  timeEntries?: TimeEntry[]; // Time tracking for labor billing
  paymentUrl?: string; // Public URL for client to pay invoice online
  jobSignatures?: DigitalSignature[]; // Signatures from linked job (client/tradie completion signatures)
  termsTemplate?: string; // Custom terms & conditions from business templates
  warrantyTemplate?: string; // Custom warranty text from business templates
  beforePhotos?: Array<{ url: string; caption?: string; category: string }>;
  afterPhotos?: Array<{ url: string; caption?: string; category: string }>;
  labourSummary?: {
    labourLines: Array<{
      workerName: string;
      hourlyRate: number;
      roundedHours: number;
      total: number;
      hideNameOnInvoice: boolean;
      workPeriodStart: Date | null;
      workPeriodEnd: Date | null;
      sessionCount: number;
      hasGpsProof?: boolean;
      attendanceRecords?: Array<{
        workerName: string;
        clockIn: { latitude: string | null; longitude: string | null; address: string | null; timestamp: Date | null };
        clockOut: { latitude: string | null; longitude: string | null; address: string | null; timestamp: Date | null };
        durationMinutes: number;
        gpsVerified: boolean;
      }>;
    }>;
    workPeriodStart: Date | null;
    workPeriodEnd: Date | null;
    totalBillableHours: number;
    totalLabourAmount: number;
    gpsVerified: boolean;
    trackingInterruptions: number;
    manualEdits: number;
    locationProof?: Array<{
      workerName: string;
      clockIn: { latitude: string | null; longitude: string | null; address: string | null; timestamp: Date | null };
      clockOut: { latitude: string | null; longitude: string | null; address: string | null; timestamp: Date | null };
      durationMinutes: number;
      gpsVerified: boolean;
    }>;
  };
  assignments?: Array<{
    workerName: string;
    assignmentStatus: string;
    travelStartedAt?: Date | string | null;
    arrivedAt?: Date | string | null;
    completedAt?: Date | string | null;
  }>;
}

const formatAUDateTime = (date: Date | string | null | undefined): string => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
};

const formatCurrency = (amount: string | number): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(num);
};

const formatTimePeriod = (start: Date | string | null, end: Date | string | null): string => {
  if (!start || !end) return '';
  const s = new Date(start);
  const e = new Date(end);
  const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
  return `${s.toLocaleTimeString('en-AU', timeOpts)} – ${e.toLocaleTimeString('en-AU', timeOpts)}`;
};

const formatDate = (date: Date | string | null): string => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const formatDateTime = (date: Date | string | null): string => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const getMissingInfoWarnings = (business: BusinessSettings, total?: number): string[] => {
  const warnings: string[] = [];
  // ABN is mandatory for tax invoices over $82.50 (ATO requirement)
  if (!business.abn && total && total > 82.50) {
    warnings.push('ABN required for tax invoices over $82.50');
  } else if (!business.abn) {
    warnings.push('ABN not set');
  }
  if (!business.address) warnings.push('Business address not set');
  if (!business.phone) warnings.push('Phone number not set');
  if (!business.email) warnings.push('Email not set');
  return warnings;
};

// Default Australian trade terms and conditions
const getDefaultQuoteTerms = (): string => `
1. ACCEPTANCE: This quote is valid for 30 days from the date of issue. Acceptance of this quote constitutes a binding agreement.
2. PAYMENT: A deposit of 50% may be required before work commences. Balance due on completion unless otherwise agreed.
3. VARIATIONS: Any variations to the quoted work must be agreed in writing and may result in additional charges.
4. MATERIALS: All materials remain the property of the contractor until full payment is received.
5. WARRANTY: All workmanship is guaranteed for 12 months from completion, unless otherwise specified.
6. ACCESS: The client must provide safe and reasonable access to the work site.
7. CANCELLATION: Cancellation after acceptance may incur costs for materials ordered or work commenced.
`.trim();

const getDefaultInvoiceTerms = (lateFeeRate: string = '1.5% per month'): string => `
1. PAYMENT TERMS: Payment is due within 14 days of invoice date unless otherwise agreed.
2. LATE PAYMENT: Overdue accounts will incur interest at ${lateFeeRate} on outstanding balances.
3. DISPUTES: Any disputes must be raised within 7 days of receiving this invoice.
4. OWNERSHIP: Goods remain the property of the supplier until payment is received in full.
`.trim();

const generateGoogleFontsLink = (): string => {
  return `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">`;
};

const generateDocumentStyles = (template: DocumentTemplate, accentColor: string) => {
  const brandColor = accentColor;
  
  // Table header styles based on template
  const tableHeaderStyles = template.tableStyle === 'minimal' 
    ? `background: transparent; color: #1a1a1a; border-bottom: 2px solid ${brandColor};`
    : `background: ${brandColor}; color: white;`;
  
  // Rounded corners for Modern template header row
  const headerRadius = '0';
  
  // Table row styles based on template
  const getTableRowStyles = () => {
    switch (template.tableStyle) {
      case 'striped':
        return `
    .line-items-table tbody tr:nth-child(odd) { background: #f9fafb; }
    .line-items-table tbody tr:nth-child(even) { background: transparent; }
    .line-items-table td { border-bottom: none; }`;
      case 'minimal':
        return `
    .line-items-table td { border-bottom: 1px solid #e5e7eb; }`;
      case 'bordered':
      default:
        return `
    .line-items-table td { border-bottom: 1px solid #eee; }`;
    }
  };
  
  // Note section styles based on template
  const getNoteStyles = () => {
    switch (template.noteStyle) {
      case 'highlighted':
        return `
    .notes-section {
      margin-bottom: 8px;
      padding: 6px 8px;
      background: linear-gradient(135deg, ${brandColor}10, ${brandColor}05);
      border: 1px solid ${brandColor}30;
      border-radius: 6px;
    }`;
      case 'simple':
        return `
    .notes-section {
      margin-bottom: 8px;
      padding: 6px 0;
      background: transparent;
      border-top: 1px solid #e5e7eb;
      border-left: none;
      border-radius: 0;
    }`;
      case 'bordered':
      default:
        return `
    .notes-section {
      margin-bottom: 8px;
      padding: 6px 8px;
      background: #fafafa;
      border-left: 4px solid ${brandColor};
      border-radius: 0 6px 6px 0;
    }`;
    }
  };
  
  // Header border based on template
  const headerBorder = template.showHeaderDivider 
    ? `border-bottom: ${template.headerBorderWidth} solid ${brandColor};`
    : 'border-bottom: none;';

  return `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: ${template.fontFamily};
      font-size: ${template.baseFontSize};
      font-weight: ${template.bodyWeight};
      line-height: 1.5;
      color: #1a1a1a;
      background: #fff;
    }
    
    .document {
      max-width: 800px;
      margin: 0 auto;
      padding: 15px 20px;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
      padding-bottom: 10px;
      ${headerBorder}
    }
    
    .company-info {
      flex: 1;
    }
    
    .company-name {
      font-size: 24px;
      font-weight: ${template.headingWeight};
      color: ${brandColor};
      margin-bottom: 8px;
    }
    
    .company-details {
      color: #666;
      font-size: 10px;
      line-height: 1.6;
    }
    
    .company-details p {
      margin: 2px 0;
    }
    
    .document-type {
      text-align: right;
    }
    
    .document-title {
      font-size: 28px;
      font-weight: ${template.headingWeight};
      color: ${brandColor};
      text-transform: uppercase;
      letter-spacing: 1px;
      line-height: 1.2;
      white-space: nowrap;
    }
    
    .document-number {
      font-size: 14px;
      color: #666;
      margin-top: 4px;
    }
    
    .logo {
      max-width: 150px;
      max-height: 60px;
      object-fit: contain;
      margin-bottom: 12px;
    }
    
    .info-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      gap: 20px;
    }
    
    .info-block {
      flex: 1;
    }
    
    .info-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #888;
      margin-bottom: 6px;
      font-weight: 600;
    }
    
    .info-value {
      color: #1a1a1a;
      line-height: 1.5;
    }
    
    .info-value strong {
      font-weight: 600;
    }
    
    .description-section {
      margin-bottom: 10px;
      padding: 8px;
      background: ${template.noteStyle === 'simple' ? 'transparent' : '#f8f9fa'};
      border-radius: 6px;
    }
    
    .description-title {
      font-weight: ${template.headingWeight};
      margin-bottom: 8px;
      color: ${brandColor};
    }
    
    .line-items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }
    
    .line-items-table th {
      ${tableHeaderStyles}
      padding: 8px;
      text-align: left;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    /* Rounded corners for Modern template header */
    .line-items-table th:first-child {
      border-top-left-radius: ${headerRadius};
      border-bottom-left-radius: ${headerRadius};
    }
    
    .line-items-table th:last-child {
      border-top-right-radius: ${headerRadius};
      border-bottom-right-radius: ${headerRadius};
    }
    
    .line-items-table th:nth-child(2),
    .line-items-table th:nth-child(3),
    .line-items-table th:nth-child(4) {
      text-align: right;
    }
    
    .line-items-table td {
      padding: 8px;
      vertical-align: top;
    }
    
    .line-items-table td:nth-child(2),
    .line-items-table td:nth-child(3),
    .line-items-table td:nth-child(4) {
      text-align: right;
      white-space: nowrap;
    }
    
    .line-items-table tr:last-child td {
      border-bottom: 2px solid ${brandColor};
    }
    ${getTableRowStyles()}
    
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 10px;
    }
    
    .totals-table {
      width: 280px;
    }
    
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    
    .totals-row.total {
      border-bottom: none;
      border-top: 2px solid ${brandColor};
      padding-top: 12px;
      margin-top: 4px;
    }
    
    .totals-row.total .totals-label,
    .totals-row.total .totals-value {
      font-size: 16px;
      font-weight: ${template.headingWeight};
      color: ${brandColor};
    }
    
    .totals-label {
      color: #666;
    }
    
    .totals-value {
      font-weight: 600;
    }
    
    .gst-note {
      text-align: right;
      font-size: 9px;
      color: #888;
      margin-top: 4px;
    }
    ${getNoteStyles()}
    
    .notes-title {
      font-weight: ${template.headingWeight};
      margin-bottom: 4px;
      color: #333;
      font-size: 9px;
    }
    
    .notes-content {
      color: #666;
      font-size: 8px;
      line-height: 1.4;
      white-space: pre-wrap;
    }
    
    .payment-section {
      margin-bottom: 8px;
      padding: 6px 10px;
      background: linear-gradient(135deg, ${brandColor}10, ${brandColor}05);
      border: 1px solid ${brandColor}30;
      border-radius: 6px;
    }
    
    .payment-title {
      font-weight: ${template.headingWeight};
      margin-bottom: 6px;
      color: ${brandColor};
      font-size: 10px;
    }
    
    .payment-details {
      color: #444;
      font-size: 9px;
      line-height: 1.4;
      white-space: pre-wrap;
    }
    
    .terms-section {
      margin-bottom: 8px;
    }
    
    .terms-title {
      font-weight: ${template.headingWeight};
      margin-bottom: 2px;
      color: #333;
      font-size: 8px;
    }
    
    .terms-content {
      color: #666;
      font-size: 7px;
      line-height: 1.3;
    }
    
    .acceptance-section {
      margin-top: 16px;
      padding: 12px;
      border: 2px dashed #ddd;
      border-radius: 8px;
    }
    
    .acceptance-title {
      font-weight: ${template.headingWeight};
      margin-bottom: 8px;
      color: #333;
    }
    
    .signature-line {
      display: flex;
      gap: 30px;
      margin-top: 10px;
    }
    
    .signature-block {
      flex: 1;
    }
    
    .signature-label {
      font-size: 10px;
      color: #888;
      margin-bottom: 16px;
    }
    
    .signature-underline {
      border-bottom: 1px solid #333;
      height: 1px;
    }
    
    .accepted-stamp {
      position: absolute;
      top: 350px;
      right: 40px;
      padding: 8px 20px;
      border: 3px solid #22c55e;
      color: #22c55e;
      font-size: 18px;
      font-weight: ${template.headingWeight};
      text-transform: uppercase;
      transform: rotate(-15deg);
      opacity: 0.5;
      z-index: 10;
      background: rgba(255, 255, 255, 0.9);
    }
    
    .footer {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid #eee;
      text-align: center;
      font-size: 8px;
      color: #999;
    }
    
    .photos-section {
      margin: 10px 0;
      page-break-inside: avoid;
    }
    .photos-section-title {
      font-weight: 600;
      font-size: 11px;
      color: #333;
      margin-bottom: 10px;
      padding-bottom: 4px;
      border-bottom: 1px solid #eee;
    }
    .photos-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .photo-item {
      border-radius: 4px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }
    .photo-item img {
      width: 100%;
      height: 120px;
      object-fit: cover;
      display: block;
    }
    .photo-caption {
      font-size: 8px;
      color: #666;
      padding: 3px 5px;
      background: #f9fafb;
    }
    
    .warning-banner {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      color: #92400e;
      padding: 10px 16px;
      border-radius: 6px;
      margin-bottom: 20px;
      font-size: 10px;
    }
    
    .warning-title {
      font-weight: 600;
      margin-bottom: 4px;
    }
    
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .status-draft { background: #e5e7eb; color: #374151; }
    .status-sent { background: #dbeafe; color: #1d4ed8; }
    .status-accepted { background: #dcfce7; color: #166534; }
    .status-declined { background: #fee2e2; color: #991b1b; }
    .status-paid { background: #dcfce7; color: #166534; }
    .status-overdue { background: #fee2e2; color: #991b1b; }
    
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .document { padding: 20px; }
    }
    
    /* Page break handling for multi-page documents */
    .line-items-table { page-break-inside: auto; }
    .line-items-table tr { page-break-inside: avoid; page-break-after: auto; }
    .line-items-table thead { display: table-header-group; }
    .totals-section { page-break-inside: avoid; }
    .notes-section { page-break-inside: avoid; }
    .terms-section { page-break-inside: avoid; page-break-after: auto; }
    .payment-section { page-break-inside: avoid; }
    .acceptance-section { page-break-inside: avoid; page-break-before: auto; }
    .footer { page-break-inside: avoid; margin-top: 10px; }
    .signature-section { page-break-inside: avoid; }
    
    /* Keep acceptance info and signature together as one block */
    .quote-acceptance-block { page-break-inside: avoid; page-break-before: auto; }
    
    @page {
      size: A4;
      margin: 10mm;
    }
  </style>
`;
};

export const generateQuotePDF = (data: QuoteWithDetails): string => {
  const { quote, lineItems, client, business, job, acceptanceUrl } = data;
  // Use document-level template if saved, otherwise fall back to business settings
  const { template, accentColor } = getTemplateForDocument(quote, business);
  
  const subtotal = parseFloat(quote.subtotal as unknown as string);
  const gstAmount = parseFloat(quote.gstAmount as unknown as string);
  const total = parseFloat(quote.total as unknown as string);
  
  const warnings = getMissingInfoWarnings(business, total);
  const isGstRegistered = business.gstEnabled && gstAmount > 0;
  const quoteTerms = (business as any).quoteTerms || getDefaultQuoteTerms();
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote ${quote.number} - ${business.businessName}</title>
  ${generateGoogleFontsLink()}
  ${generateDocumentStyles(template, accentColor)}
</head>
<body>
  <div class="document">
    
    <div class="header">
      <div class="company-info">
        ${business.logoUrl ? `<img src="${business.logoUrl}" alt="${business.businessName}" class="logo" />` : ''}
        <div class="company-name">${business.businessName}</div>
        <div class="company-details">
          ${business.abn ? `<p><strong>ABN:</strong> ${business.abn}</p>` : ''}
          ${business.address ? `<p>${business.address}</p>` : ''}
          ${business.phone ? `<p>Phone: ${business.phone}</p>` : ''}
          ${business.email ? `<p>Email: ${business.email}</p>` : ''}
          ${business.licenseNumber ? `<p>Licence No: ${business.licenseNumber}</p>` : ''}
          ${(business as any).regulatorRegistration ? `<p>Reg: ${(business as any).regulatorRegistration}</p>` : ''}
        </div>
      </div>
      <div class="document-type">
        <div class="document-title">Quote</div>
        <div class="document-number">${quote.number}</div>
        <div style="margin-top: 8px;">
          <span class="status-badge status-${quote.status}">${quote.status}</span>
        </div>
      </div>
    </div>
    
    <div class="info-section">
      <div class="info-block">
        <div class="info-label">Quote For</div>
        <div class="info-value">
          <strong>${getClientDisplayName(client)}</strong><br/>
          ${client.address ? `${client.address}<br/>` : ''}
          ${client.email ? `${client.email}<br/>` : ''}
          ${client.phone ? `${client.phone}` : ''}
        </div>
      </div>
      <div class="info-block">
        <div class="info-label">Quote Details</div>
        <div class="info-value">
          <strong>Date:</strong> ${formatDate(quote.createdAt)}<br/>
          ${quote.validUntil ? `<strong>Valid Until:</strong> ${formatDate(quote.validUntil)}<br/>` : ''}
          ${quote.acceptedAt ? `<strong>Accepted:</strong> ${formatDate(quote.acceptedAt)}` : ''}
        </div>
      </div>
    </div>
    
    ${job?.address ? `
    <div class="info-section" style="margin-top: 6px;">
      <div class="info-block" style="flex: 1;">
        <div class="info-label">Job Site Location</div>
        <div class="info-value">
          <strong>${job.address}</strong>
          ${job.scheduledAt ? `<br/><span style="color: #666;">Scheduled: ${formatDate(job.scheduledAt)}</span>` : ''}
        </div>
      </div>
    </div>
    ` : ''}
    
    ${quote.title ? `
      <div class="description-section">
        <div class="description-title">${quote.title}</div>
        ${quote.description ? `<div>${quote.description}</div>` : ''}
      </div>
    ` : ''}
    
    <table class="line-items-table">
      <thead>
        <tr>
          <th style="width: 50%;">Description</th>
          <th style="width: 15%;">Qty</th>
          <th style="width: 17%;">Unit Price</th>
          <th style="width: 18%;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItems.map(item => `
          <tr>
            <td>${(item as any).itemCode ? `<div style="font-size: 9px; color: #666; font-family: monospace;">${escapeHtml((item as any).itemCode)}</div>` : ''}${item.description}</td>
            <td>${parseFloat(item.quantity as unknown as string).toFixed(2)}</td>
            <td>${formatCurrency(item.unitPrice)}</td>
            <td>${formatCurrency(calculateLineItemTotal(item))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="totals-section">
      <div class="totals-table">
        <div class="totals-row">
          <span class="totals-label">Subtotal</span>
          <span class="totals-value">${formatCurrency(subtotal)}</span>
        </div>
        ${gstAmount > 0 ? `
          <div class="totals-row">
            <span class="totals-label">GST (10%)</span>
            <span class="totals-value">${formatCurrency(gstAmount)}</span>
          </div>
        ` : ''}
        <div class="totals-row total">
          <span class="totals-label">Total${gstAmount > 0 ? ' (incl. GST)' : ''}</span>
          <span class="totals-value">${formatCurrency(total)}</span>
        </div>
      </div>
    </div>
    
    ${quote.status !== 'accepted' && quote.status !== 'declined' && ((business as any).bankBsb || (business as any).bankAccountNumber || (business as any).bankAccountName || business.paymentInstructions) ? `
      <div class="payment-section">
        <div class="payment-title">Payment Details</div>
        <div class="payment-details">
${(business as any).bankBsb || (business as any).bankAccountNumber || (business as any).bankAccountName ? `
<strong style="display: block; margin-bottom: 4px; color: #374151; font-size: 9px;">Bank Transfer</strong>
<table style="margin-bottom: 6px; font-size: 9px;">
${(business as any).bankAccountName ? `<tr><td style="color: #6b7280; padding-right: 8px;">Account:</td><td style="font-weight: 500;">${(business as any).bankAccountName}</td></tr>` : ''}
${(business as any).bankBsb ? `<tr><td style="color: #6b7280; padding-right: 8px;">BSB:</td><td style="font-weight: 500; font-family: monospace;">${(business as any).bankBsb}</td></tr>` : ''}
${(business as any).bankAccountNumber ? `<tr><td style="color: #6b7280; padding-right: 8px;">Acc #:</td><td style="font-weight: 500; font-family: monospace;">${(business as any).bankAccountNumber}</td></tr>` : ''}
<tr><td style="color: #6b7280; padding-right: 8px;">Ref:</td><td style="font-weight: 500;">${quote.number || 'QTE-' + quote.id.substring(0,8).toUpperCase()}</td></tr>
</table>
${business.paymentInstructions ? `<span style="font-size: 9px; color: #666;">${business.paymentInstructions}</span>` : ''}
` : business.paymentInstructions ? `
<span style="font-size: 9px; color: #666;">${business.paymentInstructions}</span>
` : `
<span style="font-size: 9px; color: #666;">Please contact us for payment options.</span>
`}
        </div>
      </div>
    ` : ''}
    
    ${acceptanceUrl && quote.status !== 'accepted' && quote.status !== 'declined' ? `
      <div style="margin: 12px 0; padding: 12px; background: linear-gradient(135deg, ${accentColor}10 0%, ${accentColor}05 100%); border-radius: 6px; border: 2px solid ${accentColor}; text-align: center;">
        <p style="font-size: 11px; font-weight: 600; color: ${accentColor}; margin: 0 0 4px 0;">Accept This Quote Online</p>
        <p style="font-size: 9px; color: #666; margin: 0 0 8px 0;">Click the link or scan the QR code to accept this quote</p>
        <a href="${acceptanceUrl}" style="display: inline-block; background: ${accentColor}; color: white; padding: 6px 16px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 10px;">${acceptanceUrl}</a>
      </div>
    ` : ''}
    
    ${data.beforePhotos && data.beforePhotos.length > 0 ? `
      <div class="photos-section">
        <div class="photos-section-title">Before Photos — Site Assessment</div>
        <div class="photos-grid">
          ${data.beforePhotos.map(photo => `
            <div class="photo-item">
              <img src="${photo.url}" alt="${photo.caption || 'Before photo'}" />
              ${photo.caption ? `<div class="photo-caption">${photo.caption}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    
    ${quote.notes ? `
      <div class="notes-section">
        <div class="notes-title">Additional Notes</div>
        <div class="notes-content">${quote.notes}</div>
      </div>
    ` : ''}
    
    <div class="terms-section">
      <div class="terms-title">Terms & Conditions</div>
      <div class="terms-content" style="white-space: pre-wrap;">${quoteTerms}</div>
    </div>
    
    ${business.warrantyPeriod ? `
      <div class="notes-section" style="margin-top: 6px;">
        <div class="notes-title">Warranty</div>
        <div class="notes-content">All work is guaranteed for ${business.warrantyPeriod} from completion date.</div>
      </div>
    ` : ''}
    
    ${(business as any).insuranceDetails || (business as any).insuranceProvider ? `
      <div class="notes-section" style="margin-top: 6px; background: #f0f9ff; border-left-color: #3b82f6;">
        <div class="notes-title" style="color: #1e40af;">Insurance & Licensing</div>
        <div class="notes-content" style="color: #1e40af;">
${business.licenseNumber ? `Licence: ${business.licenseNumber}` : ''}
${(business as any).insuranceProvider ? `Insurer: ${(business as any).insuranceProvider}` : ''}
${(business as any).insuranceAmount ? `Coverage: ${(business as any).insuranceAmount}` : ''}
        </div>
      </div>
    ` : ''}
    
    
    ${quote.status === 'accepted' && quote.acceptedBy ? `
      <div class="quote-acceptance-block" style="page-break-inside: avoid; display: block; margin-top: 10px; border: 1px solid #22c55e; border-radius: 6px; overflow: hidden;">
        <div style="background: #dcfce7; padding: 8px 12px;">
          <div style="font-weight: 600; color: #166534; font-size: 11px; margin-bottom: 2px;">Quote Accepted</div>
          <div style="font-size: 9px; color: #166534; line-height: 1.4;">
            Accepted by: ${quote.acceptedBy}<br/>
            Date: ${formatDate(quote.acceptedAt)}
          </div>
        </div>
        ${data.signature?.signatureData ? `
          <div style="background: #f0fdf4; padding: 6px 12px; display: flex; align-items: center; gap: 10px;">
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 4px; padding: 4px; display: inline-block;">
              <img src="${data.signature.signatureData.startsWith('data:') ? data.signature.signatureData : 'data:image/png;base64,' + data.signature.signatureData}" alt="${data.signature.signerName || 'Client'} signature" style="max-height: 28px; max-width: 80px; width: auto; display: block;" />
            </div>
            <div style="display: inline-block;">
              <div style="font-size: 9px; font-weight: 500; color: #166534;">${data.signature.signerName || quote.acceptedBy || 'Client'}</div>
              <div style="font-size: 8px; color: #6b7280;">Signed ${formatDate(data.signature.signedAt || quote.acceptedAt)}</div>
            </div>
          </div>
        ` : ''}
      </div>
    ` : ''}
    
    ${(() => {
      const clientSigs = (data.jobSignatures || []).filter(s => s.signatureData && s.documentType !== 'assignment_acceptance');
      const assignmentSigs = (data.jobSignatures || []).filter(s => s.signatureData && s.documentType === 'assignment_acceptance');
      let html = '';
      if (clientSigs.length > 0) {
        html += `
      <div style="margin-top: 24px; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb; page-break-inside: avoid;">
        <div style="font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;">
          Job Completion Signatures
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 24px; justify-content: center;">
          ${clientSigs.map(sig => {
            const sigDataUrl = sig.signatureData.startsWith('data:') 
              ? sig.signatureData 
              : 'data:image/png;base64,' + sig.signatureData;
            const signerName = sig.signerName || 'Client';
            return `
            <div style="text-align: center; min-width: 150px;">
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin-bottom: 8px;">
                <img src="${sigDataUrl}" alt="${signerName} signature" style="max-height: 50px; max-width: 140px; width: auto;" />
              </div>
              <div style="font-size: 11px; font-weight: 500; color: #1f2937;">${signerName}</div>
              <div style="font-size: 10px; color: #6b7280;">Client Signature</div>
              <div style="font-size: 9px; color: #9ca3af;">${formatDate(sig.signedAt)}</div>
            </div>
          `}).join('')}
        </div>
      </div>`;
      }
      if (assignmentSigs.length > 0) {
        html += `
      <div style="margin-top: 24px; padding: 20px; border: 1px solid #93c5fd; border-radius: 8px; background: #eff6ff; page-break-inside: avoid;">
        <div style="font-size: 12px; font-weight: 600; color: #1e40af; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;">
          Subcontractor Acceptance Signatures
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 24px; justify-content: center;">
          ${assignmentSigs.map(sig => {
            const sigDataUrl = sig.signatureData.startsWith('data:') 
              ? sig.signatureData 
              : 'data:image/png;base64,' + sig.signatureData;
            const signerName = sig.signerName || 'Worker';
            return `
            <div style="text-align: center; min-width: 150px;">
              <div style="background: white; border: 1px solid #93c5fd; border-radius: 6px; padding: 12px; margin-bottom: 8px;">
                <img src="${sigDataUrl}" alt="${signerName} signature" style="max-height: 50px; max-width: 140px; width: auto;" />
              </div>
              <div style="font-size: 11px; font-weight: 500; color: #1e40af;">${signerName}</div>
              <div style="font-size: 10px; color: #3b82f6;">Assignment Accepted</div>
              <div style="font-size: 9px; color: #6b7280;">${formatDate(sig.signedAt)}</div>
              <div style="font-size: 8px; color: #6b7280; margin-top: 2px;">Confidentiality agreement signed</div>
            </div>
          `}).join('')}
        </div>
      </div>`;
      }
      return html;
    })()}
    
    ${(business as any).includeSignatureOnQuotes && (business as any).defaultSignature ? `
      <div style="margin-top: 24px; padding: 20px; border-top: 1px solid #e5e7eb;">
        <div style="display: flex; justify-content: flex-end;">
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #666; margin-bottom: 8px;">Prepared by:</div>
            <img src="${(business as any).defaultSignature}" alt="Signature" style="max-height: 60px; width: auto; margin-bottom: 4px;" />
            ${(business as any).signatureName ? `<div style="font-size: 11px; font-weight: 500; color: #333;">${(business as any).signatureName}</div>` : ''}
            <div style="font-size: 10px; color: #666;">${business.businessName}</div>
          </div>
        </div>
      </div>
    ` : ''}
    
    <div class="footer">
      <p>Thank you for your business!</p>
      ${business.abn ? `<p style="margin-top: 4px;">ABN: ${business.abn}</p>` : ''}
      <p style="margin-top: 4px;">Generated by JobRunner • ${formatDate(new Date())}</p>
    </div>
  </div>
</body>
</html>
  `;
};

export const generateInvoicePDF = (data: InvoiceWithDetails): string => {
  const { invoice, lineItems: allLineItems, client, business, job, timeEntries, paymentUrl, termsTemplate, warrantyTemplate, labourSummary } = data;
  const lineItems = allLineItems.filter(item => item.sourceType !== 'labour');
  
  // Validate required fields with helpful error messages
  if (!invoice) {
    throw new Error('Invoice data is missing');
  }
  if (!client) {
    throw new Error('Client data is missing for invoice');
  }
  if (!business) {
    throw new Error('Business settings are missing');
  }
  
  // Use document-level template if saved, otherwise fall back to business settings
  const { template, accentColor } = getTemplateForDocument(invoice, business);
  
  // Calculate time tracking totals if present
  const totalMinutes = timeEntries?.reduce((sum, entry) => sum + (entry.duration || 0), 0) || 0;
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  const timeTrackingFormatted = totalMinutes > 0 ? `${totalHours}h ${remainingMinutes}m` : null;
  
  // Handle null/undefined numeric fields gracefully
  const subtotal = parseFloat(String(invoice.subtotal ?? '0')) || 0;
  const gstAmount = parseFloat(String(invoice.gstAmount ?? '0')) || 0;
  const total = parseFloat(String(invoice.total ?? '0')) || 0;
  
  const warnings = getMissingInfoWarnings(business, total);
  const isGstRegistered = business.gstEnabled && gstAmount > 0;
  // Use provided template first, then business setting, then default
  const invoiceTerms = termsTemplate || (business as any).invoiceTerms || getDefaultInvoiceTerms(business.lateFeeRate || '1.5% per month');
  // Use provided warranty template or fallback to business warranty period
  const warrantyText = warrantyTemplate || (business.warrantyPeriod ? `All work is guaranteed for ${business.warrantyPeriod} from completion date.` : null);
  
  const isPaid = invoice.status === 'paid';
  const isOverdue = invoice.status === 'overdue' || 
    (invoice.dueDate && new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid');
  
  // Determine document title - must say "TAX INVOICE" for GST-registered businesses (ATO requirement)
  // Keep title clean - the PAID stamp shows payment status separately
  const documentTitle = isGstRegistered ? 'TAX INVOICE' : 'Invoice';
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${documentTitle} ${invoice.number} - ${business.businessName}</title>
  ${generateGoogleFontsLink()}
  ${generateDocumentStyles(template, accentColor)}
</head>
<body>
  <div class="document">
    
    <div class="header">
      <div class="company-info">
        ${business.logoUrl ? `<img src="${business.logoUrl}" alt="${business.businessName}" class="logo" />` : ''}
        <div class="company-name">${business.businessName}</div>
        <div class="company-details">
          ${business.abn ? `<p><strong>ABN:</strong> ${business.abn}</p>` : ''}
          ${business.address ? `<p>${business.address}</p>` : ''}
          ${business.phone ? `<p>Phone: ${business.phone}</p>` : ''}
          ${business.email ? `<p>Email: ${business.email}</p>` : ''}
          ${business.licenseNumber ? `<p>Licence No: ${business.licenseNumber}</p>` : ''}
          ${(business as any).regulatorRegistration ? `<p>Reg: ${(business as any).regulatorRegistration}</p>` : ''}
        </div>
      </div>
      <div class="document-type">
        <div class="document-title" style="color: ${isPaid ? '#22c55e' : accentColor}; font-size: ${documentTitle.length > 15 ? '22px' : '28px'};">
          ${documentTitle}
        </div>
        <div class="document-number">${invoice.number}</div>
        <div style="margin-top: 8px;">
          <span class="status-badge status-${invoice.status}">${invoice.status}</span>
        </div>
      </div>
    </div>
    
    <div class="info-section">
      <div class="info-block">
        <div class="info-label">Bill To</div>
        <div class="info-value">
          <strong>${getClientDisplayName(client)}</strong><br/>
          ${client.address ? `${client.address}<br/>` : ''}
          ${client.email ? `${client.email}<br/>` : ''}
          ${client.phone ? `${client.phone}` : ''}
        </div>
      </div>
      <div class="info-block">
        <div class="info-label">Invoice Details</div>
        <div class="info-value">
          <strong>Issue Date:</strong> ${formatDate(invoice.createdAt)}<br/>
          ${invoice.dueDate ? `<strong>Due Date:</strong> ${formatDate(invoice.dueDate)}<br/>` : ''}
          ${invoice.paidAt ? `<strong>Paid:</strong> ${formatDate(invoice.paidAt)}` : ''}
        </div>
      </div>
    </div>
    
    ${job?.address || timeTrackingFormatted || (labourSummary && labourSummary.totalBillableHours > 0) ? `
    <div class="info-section" style="margin-top: 16px;">
      ${job?.address ? `
      <div class="info-block">
        <div class="info-label">Job Site Location</div>
        <div class="info-value">
          <strong>${job.address}</strong>
          ${job.scheduledAt ? `<br/><span style="color: #666;">Completed: ${formatDate(job.scheduledAt)}</span>` : ''}
        </div>
      </div>
      ` : ''}
      ${labourSummary && labourSummary.totalBillableHours > 0 ? `
      <div class="info-block">
        <div class="info-label">Work Summary</div>
        <div class="info-value">
          <strong>${labourSummary.totalBillableHours}h total</strong>
          <span style="color: #666;"> (${labourSummary.labourLines.reduce((s: number, l: any) => s + l.sessionCount, 0)} sessions)</span>
          ${labourSummary.workPeriodStart && labourSummary.workPeriodEnd ? `<br/><span style="color: #666;">Period: ${formatDate(labourSummary.workPeriodStart)} – ${formatDate(labourSummary.workPeriodEnd)}</span>` : ''}
          ${labourSummary.gpsVerified ? `<br/><span style="color: #16a34a; font-size: 9px;">✓ GPS Tracking Verified</span>` : ''}
        </div>
      </div>
      ` : timeTrackingFormatted ? `
      <div class="info-block">
        <div class="info-label">Time Worked</div>
        <div class="info-value">
          <strong>${timeTrackingFormatted}</strong>
          <span style="color: #666;"> (${timeEntries?.length || 0} session${(timeEntries?.length || 0) !== 1 ? 's' : ''})</span>
        </div>
      </div>
      ` : ''}
    </div>
    ` : ''}
    
    ${invoice.description ? `
      <div class="description-section">
        <div class="description-title">${invoice.title}</div>
        <div>${invoice.description}</div>
      </div>
    ` : ''}
    
    ${labourSummary && labourSummary.labourLines && labourSummary.labourLines.length > 0 ? `
    <div style="margin-bottom: 16px;">
      <div style="font-size: 10px; font-weight: 600; color: #374151; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Labour Summary</div>
      <table class="line-items-table">
        <thead>
          <tr>
            <th style="width: 40%;">Worker</th>
            <th style="width: 15%;">Rate</th>
            <th style="width: 15%;">Hours</th>
            <th style="width: 15%;">Period</th>
            <th style="width: 15%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${labourSummary.labourLines.map((line: any) => `
            <tr>
              <td>${line.hideNameOnInvoice ? 'Labour' : ensureDisplayName(line.workerName, 'Team member')}${line.hasGpsProof ? ' <span style="color: #16a34a; font-size: 8px;">GPS</span>' : ''}</td>
              <td>${formatCurrency(line.hourlyRate)}/hr</td>
              <td>${line.roundedHours}h</td>
              <td style="font-size: 8px; color: #666;">${formatTimePeriod(line.workPeriodStart, line.workPeriodEnd)}</td>
              <td>${formatCurrency(line.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ${labourSummary.locationProof && labourSummary.locationProof.filter((r: any) => r.gpsVerified).length > 0 ? `
    <div style="margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px;">
      <div style="font-size: 10px; font-weight: 600; color: #16a34a; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
        Worker Presence Verified
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
        <thead>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <th style="text-align: left; padding: 4px 6px; color: #6b7280;">Worker</th>
            <th style="text-align: left; padding: 4px 6px; color: #6b7280;">Arrived</th>
            <th style="text-align: left; padding: 4px 6px; color: #6b7280;">Departed</th>
            <th style="text-align: left; padding: 4px 6px; color: #6b7280;">Location</th>
            <th style="text-align: right; padding: 4px 6px; color: #6b7280;">Duration</th>
          </tr>
        </thead>
        <tbody>
          ${labourSummary.locationProof.filter((r: any) => r.gpsVerified).map((record: any) => `
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 4px 6px;">${ensureDisplayName(record.workerName, 'Team member')}</td>
              <td style="padding: 4px 6px;">${record.clockIn.timestamp ? formatDateTime(record.clockIn.timestamp) : '—'}</td>
              <td style="padding: 4px 6px;">${record.clockOut.timestamp ? formatDateTime(record.clockOut.timestamp) : '—'}</td>
              <td style="padding: 4px 6px; font-size: 8px; color: #6b7280;">${record.clockIn.address || (record.clockIn.latitude ? record.clockIn.latitude + ', ' + record.clockIn.longitude : '—')}</td>
              <td style="padding: 4px 6px; text-align: right;">${record.durationMinutes > 0 ? Math.round(record.durationMinutes / 60 * 10) / 10 + 'h' : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="margin-top: 6px; font-size: 7px; color: #9ca3af;">GPS coordinates recorded at clock-in/clock-out. Times shown in local timezone.</div>
    </div>
    ` : ''}
    ` : ''}
    
    <table class="line-items-table">
      <thead>
        <tr>
          <th style="width: 50%;">Description</th>
          <th style="width: 15%;">Qty</th>
          <th style="width: 17%;">Unit Price</th>
          <th style="width: 18%;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItems.map(item => `
          <tr>
            <td>${(item as any).itemCode ? `<div style="font-size: 9px; color: #666; font-family: monospace;">${escapeHtml((item as any).itemCode)}</div>` : ''}${item.description}</td>
            <td>${parseFloat(item.quantity as unknown as string).toFixed(2)}</td>
            <td>${formatCurrency(item.unitPrice)}</td>
            <td>${formatCurrency(calculateLineItemTotal(item))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="totals-section">
      <div class="totals-table">
        <div class="totals-row">
          <span class="totals-label">Subtotal</span>
          <span class="totals-value">${formatCurrency(subtotal)}</span>
        </div>
        ${gstAmount > 0 ? `
          <div class="totals-row">
            <span class="totals-label">GST (10%)</span>
            <span class="totals-value">${formatCurrency(gstAmount)}</span>
          </div>
        ` : ''}
        <div class="totals-row total" style="${isPaid ? 'border-top-color: #22c55e;' : ''}">
          <span class="totals-label" style="${isPaid ? 'color: #22c55e;' : ''}">
            ${isPaid ? 'Amount Paid' : `Total${gstAmount > 0 ? ' (incl. GST)' : ''}`}
          </span>
          <span class="totals-value" style="${isPaid ? 'color: #22c55e;' : ''}">${formatCurrency(total)}</span>
        </div>
      </div>
    </div>
    ${gstAmount > 0 ? `<div class="gst-note">GST included in total</div>` : ''}
    
    ${paymentUrl && !isPaid ? `
      <div style="margin: 24px 0; padding: 20px; background: linear-gradient(135deg, #22c55e10 0%, #22c55e05 100%); border-radius: 8px; border: 2px solid #22c55e; text-align: center;">
        <p style="font-size: 12px; font-weight: 600; color: #16a34a; margin: 0 0 8px 0;">Pay This Invoice Online</p>
        <p style="font-size: 10px; color: #666; margin: 0 0 12px 0;">Click the link below to view and pay this invoice securely</p>
        <a href="${paymentUrl}" style="display: inline-block; background: #22c55e; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 11px;">${paymentUrl}</a>
      </div>
    ` : ''}
    
    ${!isPaid ? `
      <div class="payment-section">
        <div class="payment-title">Payment Details</div>
        <div class="payment-details">
${(business as any).bankBsb || (business as any).bankAccountNumber || (business as any).bankAccountName ? `
<strong style="display: block; margin-bottom: 4px; color: #374151; font-size: 9px;">Bank Transfer</strong>
<table style="margin-bottom: 6px; font-size: 9px;">
${(business as any).bankAccountName ? `<tr><td style="color: #6b7280; padding-right: 8px;">Account:</td><td style="font-weight: 500;">${(business as any).bankAccountName}</td></tr>` : ''}
${(business as any).bankBsb ? `<tr><td style="color: #6b7280; padding-right: 8px;">BSB:</td><td style="font-weight: 500; font-family: monospace;">${(business as any).bankBsb}</td></tr>` : ''}
${(business as any).bankAccountNumber ? `<tr><td style="color: #6b7280; padding-right: 8px;">Acc #:</td><td style="font-weight: 500; font-family: monospace;">${(business as any).bankAccountNumber}</td></tr>` : ''}
<tr><td style="color: #6b7280; padding-right: 8px;">Ref:</td><td style="font-weight: 500;">${invoice.number || 'INV-' + invoice.id.substring(0,8).toUpperCase()}</td></tr>
</table>
` : ''}
${business.paymentInstructions || (!((business as any).bankBsb || (business as any).bankAccountNumber) ? 'Please contact us for payment options.' : '')}${invoice.dueDate ? ` Due by ${formatDate(invoice.dueDate)}.` : ''}${business.lateFeeRate ? ` Late payments may incur interest at ${business.lateFeeRate}.` : ''}
        </div>
      </div>
    ` : ''}
    
    ${data.beforePhotos && data.beforePhotos.length > 0 ? `
      <div class="photos-section">
        <div class="photos-section-title">Before Photos</div>
        <div class="photos-grid">
          ${data.beforePhotos.map(photo => `
            <div class="photo-item">
              <img src="${photo.url}" alt="${photo.caption || 'Before photo'}" />
              ${photo.caption ? `<div class="photo-caption">${photo.caption}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    
    ${data.afterPhotos && data.afterPhotos.length > 0 ? `
      <div class="photos-section">
        <div class="photos-section-title">After Photos — Completed Work</div>
        <div class="photos-grid">
          ${data.afterPhotos.map(photo => `
            <div class="photo-item">
              <img src="${photo.url}" alt="${photo.caption || 'After photo'}" />
              ${photo.caption ? `<div class="photo-caption">${photo.caption}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    
    ${invoice.notes ? `
      <div class="notes-section">
        <div class="notes-title">Additional Notes</div>
        <div class="notes-content">${invoice.notes}</div>
      </div>
    ` : ''}
    
    ${isPaid && invoice.paymentReference ? `
      <div class="notes-section" style="background: #dcfce7; border-left-color: #22c55e;">
        <div class="notes-title" style="color: #166534;">Payment Received - Thank You!</div>
        <div class="notes-content" style="color: #166534;">
Reference: ${invoice.paymentReference}
${invoice.paymentMethod ? `Method: ${invoice.paymentMethod}` : ''}
Date: ${formatDate(invoice.paidAt)}
Amount: ${formatCurrency(total)}
        </div>
      </div>
    ` : ''}
    
    <!-- Compact Terms & Warranty Footer - Full content with small text -->
    <div style="margin-top: 16px; padding-top: 10px; border-top: 1px solid #e5e7eb;">
      <div style="display: flex; gap: 24px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 280px;">
          <div style="font-size: 7px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Terms & Conditions</div>
          <div style="font-size: 7px; color: #9ca3af; line-height: 1.4; white-space: pre-wrap;">${invoiceTerms || 'Standard trading terms apply.'}</div>
        </div>
        ${warrantyText ? `
        <div style="flex: 0 0 200px;">
          <div style="font-size: 7px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Warranty</div>
          <div style="font-size: 7px; color: #9ca3af; line-height: 1.4;">${warrantyText}</div>
        </div>
        ` : ''}
      </div>
    </div>
    
    ${(business as any).insuranceDetails || (business as any).insuranceProvider ? `
      <div class="notes-section" style="margin-top: 16px; background: #f0f9ff; border-left-color: #3b82f6;">
        <div class="notes-title" style="color: #1e40af;">Insurance & Licensing</div>
        <div class="notes-content" style="color: #1e40af;">
${business.licenseNumber ? `Licence: ${business.licenseNumber}` : ''}
${(business as any).insuranceProvider ? `Insurer: ${(business as any).insuranceProvider}` : ''}
${(business as any).insuranceAmount ? `Coverage: ${(business as any).insuranceAmount}` : ''}
        </div>
      </div>
    ` : ''}
    
    ${data.assignments && data.assignments.length > 0 ? `
    <div style="margin-top: 16px; margin-bottom: 16px;">
      <div style="font-size: 10px; font-weight: 600; color: #374151; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Worker Timeline</div>
      <table class="line-items-table">
        <thead>
          <tr>
            <th style="width: 30%;">Worker</th>
            <th style="width: 25%;">Travel Started</th>
            <th style="width: 25%;">Arrived On Site</th>
            <th style="width: 20%;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${data.assignments.map(a => `
            <tr>
              <td>${ensureDisplayName(a.workerName, 'Team member')}</td>
              <td>${formatAUDateTime(a.travelStartedAt)}</td>
              <td>${formatAUDateTime(a.arrivedAt)}</td>
              <td><span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 500; background: ${a.assignmentStatus === 'completed' || a.assignmentStatus === 'done' ? '#dcfce7; color: #166534' : a.assignmentStatus === 'arrived' || a.assignmentStatus === 'working' ? '#dbeafe; color: #1e40af' : a.assignmentStatus === 'en_route' || a.assignmentStatus === 'travelling' ? '#fef3c7; color: #92400e' : '#f3f4f6; color: #374151'};">${a.assignmentStatus}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}
    
    ${(() => {
      const clientSigs = (data.jobSignatures || []).filter(s => s.signatureData && s.documentType !== 'assignment_acceptance');
      const assignmentSigs = (data.jobSignatures || []).filter(s => s.signatureData && s.documentType === 'assignment_acceptance');
      let html = '';
      if (clientSigs.length > 0) {
        html += `
      <div style="margin-top: 24px; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb; page-break-inside: avoid;">
        <div style="font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;">
          Job Completion Signatures
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 24px; justify-content: center;">
          ${clientSigs.map(sig => {
            const sigDataUrl = sig.signatureData.startsWith('data:') 
              ? sig.signatureData 
              : 'data:image/png;base64,' + sig.signatureData;
            const signerName = sig.signerName || 'Client';
            return `
            <div style="text-align: center; min-width: 150px;">
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin-bottom: 8px;">
                <img src="${sigDataUrl}" alt="${signerName} signature" style="max-height: 50px; max-width: 140px; width: auto;" />
              </div>
              <div style="font-size: 11px; font-weight: 500; color: #1f2937;">${signerName}</div>
              <div style="font-size: 10px; color: #6b7280;">Client Signature</div>
              <div style="font-size: 9px; color: #9ca3af;">${formatDate(sig.signedAt)}</div>
            </div>
          `}).join('')}
        </div>
      </div>`;
      }
      if (assignmentSigs.length > 0) {
        html += `
      <div style="margin-top: 24px; padding: 20px; border: 1px solid #93c5fd; border-radius: 8px; background: #eff6ff; page-break-inside: avoid;">
        <div style="font-size: 12px; font-weight: 600; color: #1e40af; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;">
          Subcontractor Acceptance Signatures
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 24px; justify-content: center;">
          ${assignmentSigs.map(sig => {
            const sigDataUrl = sig.signatureData.startsWith('data:') 
              ? sig.signatureData 
              : 'data:image/png;base64,' + sig.signatureData;
            const signerName = sig.signerName || 'Worker';
            return `
            <div style="text-align: center; min-width: 150px;">
              <div style="background: white; border: 1px solid #93c5fd; border-radius: 6px; padding: 12px; margin-bottom: 8px;">
                <img src="${sigDataUrl}" alt="${signerName} signature" style="max-height: 50px; max-width: 140px; width: auto;" />
              </div>
              <div style="font-size: 11px; font-weight: 500; color: #1e40af;">${signerName}</div>
              <div style="font-size: 10px; color: #3b82f6;">Assignment Accepted</div>
              <div style="font-size: 9px; color: #6b7280;">${formatDate(sig.signedAt)}</div>
              <div style="font-size: 8px; color: #6b7280; margin-top: 2px;">Confidentiality agreement signed</div>
            </div>
          `}).join('')}
        </div>
      </div>`;
      }
      return html;
    })()}
    
    ${(business as any).includeSignatureOnInvoices && (business as any).defaultSignature ? `
      <div style="margin-top: 24px; padding: 20px; border-top: 1px solid #e5e7eb;">
        <div style="display: flex; justify-content: flex-end;">
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #666; margin-bottom: 8px;">Issued by:</div>
            <img src="${(business as any).defaultSignature}" alt="Signature" style="max-height: 60px; width: auto; margin-bottom: 4px;" />
            ${(business as any).signatureName ? `<div style="font-size: 11px; font-weight: 500; color: #333;">${(business as any).signatureName}</div>` : ''}
            <div style="font-size: 10px; color: #666;">${business.businessName}</div>
          </div>
        </div>
      </div>
    ` : ''}
    
    <div class="footer">
      <p>Thank you for your business!</p>
      ${business.abn ? `<p style="margin-top: 4px;">ABN: ${business.abn}</p>` : ''}
      <p style="margin-top: 4px;">Generated by JobRunner • ${formatDate(new Date())}</p>
    </div>
  </div>
</body>
</html>
  `;
};

export const generateQuoteAcceptancePage = (data: QuoteWithDetails, acceptanceUrl: string): string => {
  const { quote, lineItems, client, business, signature, previousSignature, token, canAcceptPayments, showSuccess } = data;
  const brandColor = business.brandColor || '#2563eb';
  
  const subtotal = parseFloat(quote.subtotal as unknown as string);
  const gstAmount = parseFloat(quote.gstAmount as unknown as string);
  const total = parseFloat(quote.total as unknown as string);
  
  // Calculate deposit amount
  let depositAmount = 0;
  if ((quote as any).depositRequired) {
    if ((quote as any).depositAmount) {
      depositAmount = parseFloat((quote as any).depositAmount as unknown as string);
    } else if ((quote as any).depositPercent) {
      const percent = parseFloat((quote as any).depositPercent as unknown as string);
      depositAmount = total * (percent / 100);
    } else {
      depositAmount = total * 0.2; // Default 20%
    }
  }
  const depositPaid = (quote as any).depositPaid || false;
  const depositRequired = (quote as any).depositRequired || false;
  
  const isExpired = quote.validUntil && new Date(quote.validUntil) < new Date();
  const isAlreadyActioned = quote.status === 'accepted' || quote.status === 'declined';
  
  // Generate lighter shade of brand color for gradient
  const lighterBrand = brandColor + '20';
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote ${quote.number} - ${business.businessName}</title>
  <link rel="icon" type="image/png" href="${business.logoUrl || '/favicon-32.png'}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      min-height: 100vh;
      padding: 20px;
      color: #1e293b;
      line-height: 1.6;
    }
    
    .container {
      max-width: 680px;
      margin: 0 auto;
    }
    
    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(0,0,0,0.1);
      overflow: hidden;
      margin-bottom: 20px;
      border: 1px solid #e2e8f0;
    }
    
    .header {
      background: linear-gradient(135deg, ${brandColor} 0%, ${brandColor}dd 100%);
      color: white;
      padding: 32px 24px;
      text-align: center;
      position: relative;
    }
    
    .header::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 50%, rgba(255,255,255,0.3) 100%);
    }
    
    .header-logo {
      max-height: 56px;
      max-width: 200px;
      object-fit: contain;
      margin-bottom: 12px;
      background: white;
      padding: 8px 16px;
      border-radius: 8px;
    }
    
    .header h1 {
      font-size: 26px;
      font-weight: 700;
      margin-bottom: 6px;
      letter-spacing: -0.5px;
    }
    
    .header p {
      opacity: 0.9;
      font-size: 14px;
      font-weight: 500;
    }
    
    .content {
      padding: 24px;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 28px;
    }
    
    @media (max-width: 500px) {
      .info-grid { grid-template-columns: 1fr; gap: 20px; }
    }
    
    .info-block h3 {
      font-size: 11px;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 10px;
      letter-spacing: 0.8px;
      font-weight: 600;
    }
    
    .info-block p {
      color: #334155;
      line-height: 1.7;
      font-size: 14px;
    }
    
    .info-block p strong {
      color: #0f172a;
      font-weight: 600;
    }
    
    .description {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 28px;
      border: 1px solid #e2e8f0;
    }
    
    .description h4 {
      color: ${brandColor};
      margin-bottom: 10px;
      font-size: 16px;
      font-weight: 600;
    }
    
    .description p {
      font-size: 14px;
      color: #475569;
    }
    
    .line-items {
      margin-bottom: 28px;
    }
    
    .line-item {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 14px 0;
      border-bottom: 1px solid #f1f5f9;
      gap: 16px;
    }
    
    .line-item:last-child {
      border-bottom: none;
    }
    
    .line-item-desc {
      flex: 1;
      font-size: 14px;
      color: #1e293b;
    }
    
    .line-item-desc small {
      color: #64748b;
      font-size: 12px;
      display: block;
      margin-top: 4px;
    }
    
    .line-item-amount {
      font-weight: 600;
      text-align: right;
      color: #0f172a;
      font-size: 14px;
      white-space: nowrap;
    }
    
    .totals {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 28px;
      border: 1px solid #e2e8f0;
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      font-size: 14px;
      color: #475569;
    }
    
    .total-row.final {
      border-top: 2px solid ${brandColor};
      margin-top: 12px;
      padding-top: 16px;
      font-size: 22px;
      font-weight: 700;
      color: ${brandColor};
    }
    
    .status-banner {
      padding: 20px;
      border-radius: 12px;
      text-align: center;
      margin-bottom: 28px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    
    .status-banner svg {
      margin-bottom: 4px;
    }
    
    .status-accepted {
      background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
      color: #166534;
      border: 1px solid #86efac;
    }
    
    .status-declined {
      background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
      color: #991b1b;
      border: 1px solid #fca5a5;
    }
    
    .status-expired {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      color: #92400e;
      border: 1px solid #fcd34d;
    }
    
    .actions {
      display: flex;
      gap: 12px;
    }
    
    @media (max-width: 500px) {
      .actions { flex-direction: column; }
    }
    
    .btn {
      flex: 1;
      padding: 16px 28px;
      border: none;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    
    .btn-accept {
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      color: white;
      box-shadow: 0 4px 14px -4px rgba(34, 197, 94, 0.4);
    }
    
    .btn-accept:hover {
      background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
      transform: translateY(-1px);
      box-shadow: 0 6px 20px -4px rgba(34, 197, 94, 0.5);
    }
    
    .btn-accept:active {
      transform: translateY(0);
    }
    
    .btn-decline {
      background: #f8fafc;
      color: #475569;
      border: 1px solid #e2e8f0;
    }
    
    .btn-decline:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
    }
    
    .form-group {
      margin-bottom: 20px;
    }
    
    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #334155;
    }
    
    .form-group input,
    .form-group textarea {
      width: 100%;
      padding: 14px 16px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      font-size: 15px;
      font-family: inherit;
      background: #f8fafc;
      transition: all 0.2s ease;
    }
    
    .form-group input:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: ${brandColor};
      background: white;
      box-shadow: 0 0 0 3px ${brandColor}15;
    }
    
    .signature-pad-container {
      margin-bottom: 16px;
    }
    
    .signature-pad-container label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 6px;
      color: #374151;
    }
    
    .signature-pad-wrapper {
      position: relative;
      border: 2px dashed #d1d5db;
      border-radius: 8px;
      background: #fafafa;
      touch-action: none;
    }
    
    .signature-pad-wrapper.has-signature {
      border-style: solid;
      border-color: ${brandColor};
    }
    
    .signature-canvas {
      display: block;
      width: 100%;
      height: 150px;
      cursor: crosshair;
      touch-action: none;
    }
    
    .signature-placeholder {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #9ca3af;
      font-size: 14px;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .signature-placeholder.hidden {
      display: none;
    }
    
    .signature-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
      gap: 8px;
    }
    
    .signature-btn {
      padding: 6px 12px;
      font-size: 13px;
      border-radius: 6px;
      border: 1px solid #d1d5db;
      background: white;
      color: #374151;
      cursor: pointer;
    }
    
    .signature-btn:hover {
      background: #f3f4f6;
    }
    
    .signature-error {
      color: #dc2626;
      font-size: 13px;
      margin-top: 4px;
    }
    
    .signature-display {
      margin-top: 16px;
      padding: 16px;
      background: white;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    
    .signature-display-label {
      font-size: 12px;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }
    
    .signature-display img {
      max-width: 100%;
      max-height: 100px;
      display: block;
    }
    
    .signature-display-info {
      margin-top: 8px;
      font-size: 13px;
      color: #6b7280;
    }
    
    /* Payment section styles */
    .payment-section {
      margin-top: 24px;
      padding: 20px;
      background: #f0fdf4;
      border-radius: 12px;
      border: 1px solid #bbf7d0;
    }
    
    .payment-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    
    .payment-header svg {
      color: #16a34a;
    }
    
    .payment-header h3 {
      font-size: 16px;
      font-weight: 600;
      color: #166534;
    }
    
    .payment-amount {
      font-size: 28px;
      font-weight: 700;
      color: #166534;
      margin-bottom: 4px;
    }
    
    .payment-label {
      font-size: 13px;
      color: #15803d;
      margin-bottom: 20px;
    }
    
    .payment-form-container {
      background: white;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }
    
    #payment-form {
      margin-bottom: 16px;
    }
    
    #payment-element {
      margin-bottom: 16px;
    }
    
    .payment-btn {
      width: 100%;
      padding: 14px 24px;
      background: #16a34a;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 48px;
    }
    
    .payment-btn:hover {
      background: #15803d;
    }
    
    .payment-btn:disabled {
      background: #86efac;
      cursor: not-allowed;
    }
    
    .payment-error {
      color: #dc2626;
      font-size: 14px;
      margin-top: 12px;
      padding: 12px;
      background: #fef2f2;
      border-radius: 6px;
      display: none;
    }
    
    .payment-success {
      text-align: center;
      padding: 24px;
    }
    
    .payment-success svg {
      color: #16a34a;
      margin-bottom: 12px;
    }
    
    .payment-success h3 {
      font-size: 18px;
      font-weight: 600;
      color: #166534;
      margin-bottom: 8px;
    }
    
    .payment-success p {
      color: #15803d;
      font-size: 14px;
    }
    
    .deposit-paid-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: #dcfce7;
      border-radius: 8px;
      margin-top: 16px;
    }
    
    .deposit-paid-banner svg {
      color: #16a34a;
      flex-shrink: 0;
    }
    
    .deposit-paid-banner span {
      color: #166534;
      font-weight: 500;
    }
    
    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid white;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .hidden {
      display: none;
    }
    
    .footer {
      text-align: center;
      padding: 28px 20px;
      color: #64748b;
      font-size: 12px;
    }
    
    .footer-business {
      margin-bottom: 8px;
      color: #475569;
      font-weight: 500;
    }
    
    .footer-powered {
      color: #94a3b8;
      font-size: 11px;
    }
    
    /* Success confirmation overlay */
    .success-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }
    
    .success-card {
      background: white;
      border-radius: 20px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
    }
    
    .success-header {
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      padding: 40px 24px;
      color: white;
    }
    
    .success-icon {
      width: 72px;
      height: 72px;
      background: rgba(255,255,255,0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }
    
    .success-icon svg {
      width: 40px;
      height: 40px;
    }
    
    .success-header h2 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    
    .success-header p {
      opacity: 0.9;
      font-size: 14px;
    }
    
    .success-body {
      padding: 28px;
    }
    
    .success-details {
      background: #f8fafc;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
      text-align: left;
    }
    
    .success-details-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 14px;
    }
    
    .success-details-row:not(:last-child) {
      border-bottom: 1px solid #e2e8f0;
    }
    
    .success-details-label {
      color: #64748b;
    }
    
    .success-details-value {
      color: #0f172a;
      font-weight: 600;
    }
    
    .success-btn {
      width: 100%;
      padding: 16px;
      background: ${brandColor};
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
      margin-bottom: 12px;
    }
    
    .success-btn:hover {
      filter: brightness(0.95);
    }
    
    .success-btn-secondary {
      background: #f1f5f9;
      color: #475569;
    }
    
    .success-btn-secondary:hover {
      background: #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        ${business.logoUrl ? `<img src="${business.logoUrl}" alt="${business.businessName}" class="header-logo" />` : ''}
        <h1>${business.businessName}</h1>
        <p>Quote ${quote.number}</p>
      </div>
      
      <div class="content">
        ${isAlreadyActioned ? `
          <div class="status-banner ${quote.status === 'accepted' ? 'status-accepted' : 'status-declined'}">
            ${quote.status === 'accepted' ? `
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            ` : `
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            `}
            <strong style="font-size: 16px;">Quote ${quote.status === 'accepted' ? 'Accepted' : 'Declined'}</strong>
            <span style="font-size: 13px; opacity: 0.9;">
              ${quote.acceptedAt ? `on ${formatDate(quote.acceptedAt)}` : ''}
              ${quote.rejectedAt ? `on ${formatDate(quote.rejectedAt)}` : ''}
              ${quote.acceptedBy ? ` by ${quote.acceptedBy}` : ''}
            </span>
          </div>
          
          ${quote.status === 'accepted' ? `
            <!-- Download PDF button for accepted quotes -->
            <div style="margin-bottom: 24px; text-align: center;">
              <a href="/api/public/quote/${token}/pdf" target="_blank" class="btn btn-accept" style="text-decoration: none; display: inline-flex; max-width: 280px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download Signed Quote
              </a>
            </div>
          ` : ''}
          
          ${quote.status === 'accepted' && signature ? `
            <div class="signature-display">
              <div class="signature-display-label">Client Signature</div>
              <img src="${signature.signatureData}" alt="Client signature" />
              <div class="signature-display-info">
                Signed by ${signature.signerName} on ${formatDate(signature.signedAt)}
              </div>
            </div>
          ` : ''}
          ${quote.status === 'accepted' && depositRequired && canAcceptPayments ? `
            ${depositPaid ? `
              <div class="deposit-paid-banner">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <span>Deposit of ${formatCurrency(depositAmount)} has been paid. Thank you!</span>
              </div>
            ` : `
              <div class="payment-section" id="payment-section">
                <div class="payment-header">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                    <line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                  <h3>Pay Deposit Now</h3>
                </div>
                <div class="payment-amount">${formatCurrency(depositAmount)}</div>
                <div class="payment-label">Deposit required to secure your booking</div>
                
                <div id="payment-loading">
                  <div class="payment-form-container">
                    <p style="text-align: center; color: #6b7280;">Loading payment form...</p>
                  </div>
                </div>
                
                <div id="payment-container" class="hidden">
                  <div class="payment-form-container">
                    <form id="payment-form">
                      <div id="payment-element"></div>
                      <button type="submit" class="payment-btn" id="payment-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                          <path d="M9 12l2 2 4-4"/>
                        </svg>
                        Pay ${formatCurrency(depositAmount)}
                      </button>
                    </form>
                    <div class="payment-error" id="payment-error"></div>
                  </div>
                </div>
                
                <div id="payment-success" class="hidden">
                  <div class="payment-success">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <h3>Payment Successful!</h3>
                    <p>Your deposit has been received. We'll be in touch soon to confirm your booking.</p>
                  </div>
                </div>
              </div>
              
              <script src="https://js.stripe.com/v3/"></script>
              <script>
                (async function initPayment() {
                  const token = '${token || ''}';
                  if (!token) {
                    document.getElementById('payment-loading').innerHTML = '<p style="text-align: center; color: #dc2626;">Payment not available</p>';
                    return;
                  }
                  
                  try {
                    // Create payment intent
                    const response = await fetch('/api/public/quote/' + token + '/pay', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' }
                    });
                    
                    if (!response.ok) {
                      const error = await response.json();
                      throw new Error(error.error || 'Failed to initialize payment');
                    }
                    
                    const { clientSecret, publishableKey } = await response.json();
                    
                    if (!clientSecret || !publishableKey) {
                      throw new Error('Payment configuration error');
                    }
                    
                    // Initialize Stripe
                    const stripe = Stripe(publishableKey);
                    const elements = stripe.elements({ clientSecret });
                    const paymentElement = elements.create('payment');
                    paymentElement.mount('#payment-element');
                    
                    // Show payment form
                    document.getElementById('payment-loading').classList.add('hidden');
                    document.getElementById('payment-container').classList.remove('hidden');
                    
                    // Handle form submission
                    const form = document.getElementById('payment-form');
                    const submitBtn = document.getElementById('payment-btn');
                    const errorDiv = document.getElementById('payment-error');
                    
                    form.addEventListener('submit', async (e) => {
                      e.preventDefault();
                      submitBtn.disabled = true;
                      submitBtn.innerHTML = '<div class="spinner"></div> Processing...';
                      errorDiv.style.display = 'none';
                      
                      const { error, paymentIntent } = await stripe.confirmPayment({
                        elements,
                        confirmParams: {
                          return_url: window.location.href
                        },
                        redirect: 'if_required'
                      });
                      
                      if (error) {
                        errorDiv.textContent = error.message;
                        errorDiv.style.display = 'block';
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M9 12l2 2 4-4"/></svg> Pay ${formatCurrency(depositAmount).replace('$', '\\$')}';
                      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
                        document.getElementById('payment-container').classList.add('hidden');
                        document.getElementById('payment-success').classList.remove('hidden');
                      }
                    });
                    
                  } catch (err) {
                    document.getElementById('payment-loading').innerHTML = '<p style="text-align: center; color: #dc2626;">' + (err.message || 'Payment not available') + '</p>';
                  }
                })();
              </script>
            `}
          ` : ''}
        ` : isExpired ? `
          <div class="status-banner status-expired">
            <strong>This quote has expired</strong>
            <br><small>Expired on ${formatDate(quote.validUntil)}</small>
          </div>
        ` : ''}
        
        <div class="info-grid">
          <div class="info-block">
            <h3>Prepared For</h3>
            <p>
              <strong>${getClientDisplayName(client)}</strong><br/>
              ${client.address ? `${client.address}<br/>` : ''}
              ${client.email || ''}
            </p>
          </div>
          <div class="info-block">
            <h3>Quote Details</h3>
            <p>
              <strong>Date:</strong> ${formatDate(quote.createdAt)}<br/>
              ${quote.validUntil ? `<strong>Valid Until:</strong> ${formatDate(quote.validUntil)}` : ''}
            </p>
          </div>
        </div>
        
        ${quote.description ? `
          <div class="description">
            <h4>${quote.title}</h4>
            <p>${quote.description}</p>
          </div>
        ` : ''}
        
        <div class="line-items">
          ${lineItems.map(item => `
            <div class="line-item">
              <div class="line-item-desc">
                ${(item as any).itemCode ? `<small style="color: #666; font-family: monospace;">${escapeHtml((item as any).itemCode)}</small><br>` : ''}${item.description}
                <br><small>${parseFloat(item.quantity as unknown as string)} × ${formatCurrency(item.unitPrice)}</small>
              </div>
              <div class="line-item-amount">${formatCurrency(calculateLineItemTotal(item))}</div>
            </div>
          `).join('')}
        </div>
        
        <div class="totals">
          <div class="total-row">
            <span>Subtotal</span>
            <span>${formatCurrency(subtotal)}</span>
          </div>
          ${gstAmount > 0 ? `
            <div class="total-row">
              <span>GST (10%)</span>
              <span>${formatCurrency(gstAmount)}</span>
            </div>
          ` : ''}
          <div class="total-row final">
            <span>Total</span>
            <span>${formatCurrency(total)}</span>
          </div>
        </div>
        
        ${!isAlreadyActioned && ((business as any).bankBsb || (business as any).bankAccountNumber || (business as any).bankAccountName) ? `
          <div class="card" style="margin-top: 28px; background: #f8fafc; border: 1px solid #e2e8f0; box-shadow: none;">
            <div style="padding: 20px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${brandColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2"/>
                  <line x1="2" y1="10" x2="22" y2="10"/>
                </svg>
                <h3 style="font-size: 14px; font-weight: 600; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Bank Transfer Details</h3>
              </div>
              <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                ${(business as any).bankAccountName ? `
                  <tr>
                    <td style="padding: 6px 0; color: #64748b; width: 140px;">Account Name:</td>
                    <td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${(business as any).bankAccountName}</td>
                  </tr>
                ` : ''}
                ${(business as any).bankBsb ? `
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">BSB:</td>
                    <td style="padding: 6px 0; font-weight: 500; font-family: monospace; color: #0f172a;">${(business as any).bankBsb}</td>
                  </tr>
                ` : ''}
                ${(business as any).bankAccountNumber ? `
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Account Number:</td>
                    <td style="padding: 6px 0; font-weight: 500; font-family: monospace; color: #0f172a;">${(business as any).bankAccountNumber}</td>
                  </tr>
                ` : ''}
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Reference:</td>
                  <td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${quote.number}</td>
                </tr>
              </table>
              ${business.paymentInstructions ? `
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #475569; line-height: 1.5;">
                  ${business.paymentInstructions}
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}
        
        ${quote.notes ? `
          <div class="description" style="margin-bottom: 24px;">
            <h4>Terms & Conditions</h4>
            <p style="white-space: pre-wrap; font-size: 13px; color: #4b5563;">${quote.notes}</p>
          </div>
        ` : ''}
        
        ${!isAlreadyActioned && !isExpired ? `
          <form id="acceptance-form" method="POST" action="${acceptanceUrl}">
            <div id="accept-section" class="hidden">
              <div class="form-group">
                <label for="accepted_by">Your Name *</label>
                <input type="text" id="accepted_by" name="accepted_by" required placeholder="Enter your full name" value="${getClientDisplayName(client)}"/>
              </div>
              
              <div class="signature-pad-container">
                <label>Your Signature *</label>
                ${previousSignature ? `
                <div id="saved-signature-section" style="margin-bottom: 16px; padding: 16px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <span style="color: #166534; font-weight: 500;">Your saved signature</span>
                  </div>
                  <img id="saved-signature-img" src="${previousSignature.signatureData}" alt="Saved signature" style="max-height: 80px; max-width: 100%; display: block; margin-bottom: 12px; background: white; padding: 8px; border-radius: 6px; border: 1px solid #e5e7eb;" />
                  <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn btn-accept" style="flex: 1; padding: 10px 16px; font-size: 14px;" onclick="useSavedSignature()">Use This Signature</button>
                    <button type="button" class="signature-btn" style="flex-shrink: 0;" onclick="drawNewSignature()">Draw New</button>
                  </div>
                </div>
                ` : ''}
                <div id="signature-draw-section" ${previousSignature ? 'class="hidden"' : ''}>
                  <div class="signature-pad-wrapper" id="signature-wrapper">
                    <canvas id="signature-canvas" class="signature-canvas"></canvas>
                    <div class="signature-placeholder" id="signature-placeholder">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                      </svg>
                      <span>Draw your signature here</span>
                    </div>
                  </div>
                  <div class="signature-actions">
                    <button type="button" class="signature-btn" onclick="clearSignature()">Clear</button>
                    ${previousSignature ? '<button type="button" class="signature-btn" onclick="showSavedSignature()">Use Saved</button>' : ''}
                  </div>
                </div>
                <div class="signature-error hidden" id="signature-error">Please provide your signature</div>
                <input type="hidden" id="signature_data" name="signature_data" />
              </div>
              
              <div class="form-group">
                <label for="notes">Additional Notes (optional)</label>
                <textarea id="notes" name="notes" rows="3" placeholder="Any special requests or notes?"></textarea>
              </div>
            </div>
            
            <div id="decline-section" class="hidden">
              <div class="form-group">
                <label for="decline_reason">Reason for Declining (optional)</label>
                <textarea id="decline_reason" name="decline_reason" rows="3" placeholder="Help us understand why..."></textarea>
              </div>
            </div>
            
            <!-- Single action input to avoid duplicate form fields -->
            <input type="hidden" id="action-input" name="action" value="accept"/>
            
            <div class="actions" id="action-buttons">
              <button type="button" class="btn btn-accept" onclick="showAcceptForm()">Accept Quote</button>
              <button type="button" class="btn btn-decline" onclick="showDeclineForm()">Decline</button>
            </div>
            
            <div class="actions hidden" id="confirm-accept">
              <button type="submit" class="btn btn-accept" onclick="return validateAndSubmit()">Confirm Acceptance</button>
              <button type="button" class="btn btn-decline" onclick="resetForm()">Cancel</button>
            </div>
            
            <div class="actions hidden" id="confirm-decline">
              <button type="submit" class="btn btn-decline" style="background: #ef4444; color: white;">Confirm Decline</button>
              <button type="button" class="btn btn-decline" onclick="resetForm()">Cancel</button>
            </div>
          </form>
          
          <script>
            // Signature pad variables
            let canvas, ctx, isDrawing = false, hasSignature = false;
            let lastX = 0, lastY = 0;
            
            // Initialize signature pad
            let canvasInitialized = false;
            let initRetryCount = 0;
            const MAX_RETRIES = 10;
            
            function initializeCanvas() {
              if (canvasInitialized) return true;
              
              canvas = document.getElementById('signature-canvas');
              if (!canvas) {
                console.log('Canvas element not found');
                return false;
              }
              
              // Check if signature-draw-section is visible
              const drawSection = document.getElementById('signature-draw-section');
              if (drawSection && drawSection.classList.contains('hidden')) {
                console.log('Signature draw section is hidden');
                return false;
              }
              
              // Set canvas size to match display size
              const rect = canvas.parentElement.getBoundingClientRect();
              if (rect.width === 0) {
                console.log('Canvas parent has 0 width, will retry');
                return false;
              }
              
              ctx = canvas.getContext('2d');
              const dpr = window.devicePixelRatio || 1;
              canvas.width = rect.width * dpr;
              canvas.height = 150 * dpr;
              canvas.style.width = rect.width + 'px';
              canvas.style.height = '150px';
              ctx.scale(dpr, dpr);
              ctx.lineWidth = 2;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.strokeStyle = '#1f2937';
              
              // Mouse events
              canvas.addEventListener('mousedown', startDrawing);
              canvas.addEventListener('mousemove', draw);
              canvas.addEventListener('mouseup', stopDrawing);
              canvas.addEventListener('mouseout', stopDrawing);
              
              // Touch events for mobile
              canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
              canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
              canvas.addEventListener('touchend', stopDrawing);
              
              canvasInitialized = true;
              console.log('Canvas initialized successfully, width:', rect.width);
              return true;
            }
            
            function retryInitCanvas() {
              if (canvasInitialized || initRetryCount >= MAX_RETRIES) return;
              initRetryCount++;
              if (!initializeCanvas()) {
                setTimeout(retryInitCanvas, 100);
              }
            }
            
            document.addEventListener('DOMContentLoaded', function() {
              // Don't initialize on page load - canvas is hidden
              // It will be initialized when showAcceptForm is called
            });
            
            function getPos(e) {
              const rect = canvas.getBoundingClientRect();
              return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
              };
            }
            
            function handleTouchStart(e) {
              e.preventDefault();
              const touch = e.touches[0];
              const pos = getPos(touch);
              lastX = pos.x;
              lastY = pos.y;
              isDrawing = true;
            }
            
            function handleTouchMove(e) {
              e.preventDefault();
              if (!isDrawing) return;
              const touch = e.touches[0];
              const pos = getPos(touch);
              ctx.beginPath();
              ctx.moveTo(lastX, lastY);
              ctx.lineTo(pos.x, pos.y);
              ctx.stroke();
              lastX = pos.x;
              lastY = pos.y;
              updateSignatureState();
            }
            
            function startDrawing(e) {
              isDrawing = true;
              const pos = getPos(e);
              lastX = pos.x;
              lastY = pos.y;
            }
            
            function draw(e) {
              if (!isDrawing) return;
              const pos = getPos(e);
              ctx.beginPath();
              ctx.moveTo(lastX, lastY);
              ctx.lineTo(pos.x, pos.y);
              ctx.stroke();
              lastX = pos.x;
              lastY = pos.y;
              updateSignatureState();
            }
            
            function stopDrawing() {
              if (isDrawing) {
                isDrawing = false;
                // Update state when drawing ends too
                updateSignatureState();
              }
            }
            
            function updateSignatureState() {
              // Check if canvas has any non-transparent pixels (actual drawing)
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              let hasContent = false;
              for (let i = 3; i < imageData.data.length; i += 4) {
                if (imageData.data[i] > 0) {
                  hasContent = true;
                  break;
                }
              }
              
              if (hasContent) {
                hasSignature = true;
                document.getElementById('signature-wrapper').classList.add('has-signature');
                document.getElementById('signature-placeholder').classList.add('hidden');
                document.getElementById('signature-error').classList.add('hidden');
                // Save signature data
                document.getElementById('signature_data').value = canvas.toDataURL('image/png');
                console.log('Signature detected and saved');
              }
            }
            
            function clearSignature() {
              const dpr = window.devicePixelRatio || 1;
              ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
              hasSignature = false;
              document.getElementById('signature-wrapper').classList.remove('has-signature');
              document.getElementById('signature-placeholder').classList.remove('hidden');
              document.getElementById('signature_data').value = '';
            }
            
            function validateAndSubmit(e) {
              if (e) e.preventDefault();
              
              const nameInput = document.getElementById('accepted_by');
              if (!nameInput.value.trim()) {
                nameInput.focus();
                return false;
              }
              
              // Double-check canvas for signature content before validating
              if (!hasSignature && canvas && ctx) {
                try {
                  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                  for (let i = 3; i < imageData.data.length; i += 4) {
                    if (imageData.data[i] > 0) {
                      hasSignature = true;
                      document.getElementById('signature_data').value = canvas.toDataURL('image/png');
                      console.log('Signature found during validation check');
                      break;
                    }
                  }
                } catch (e) {
                  console.log('Error checking canvas:', e);
                }
              }
              
              if (!hasSignature) {
                document.getElementById('signature-error').classList.remove('hidden');
                console.log('No signature detected');
                return false;
              }
              
              console.log('Form validation passed, submitting via fetch...');
              
              // Collect form data
              const form = document.getElementById('acceptance-form');
              const formData = new FormData(form);
              // Use getAttribute to avoid shadowing by input named "action"
              const actionUrl = form.getAttribute('action');
              const baseUrl = actionUrl.replace('/action', '');
              
              // Submit via fetch with manual redirect handling
              fetch(actionUrl, {
                method: 'POST',
                body: new URLSearchParams(formData),
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded'
                },
                redirect: 'manual' // Handle redirect ourselves
              }).then(function(response) {
                console.log('Fetch response:', response.status, response.type);
                if (response.type === 'opaqueredirect' || response.status === 0) {
                  // Server sent a redirect, navigate to success page
                  console.log('Server redirected, navigating to success page');
                  window.location.href = baseUrl + '?success=1';
                } else if (response.status >= 300 && response.status < 400) {
                  // Redirect status, go to success
                  console.log('Redirect status received');
                  window.location.href = baseUrl + '?success=1';
                } else if (response.ok) {
                  // Success, redirect to success page
                  console.log('Success response, redirecting');
                  window.location.href = baseUrl + '?success=1';
                } else {
                  console.error('Form submission failed:', response.status);
                  alert('Error submitting form. Please try again.');
                }
              }).catch(function(error) {
                console.error('Form submission error:', error);
                alert('Error submitting form. Please try again.');
              });
              
              return false;
            }
            
            function showAcceptForm() {
              document.getElementById('accept-section').classList.remove('hidden');
              document.getElementById('decline-section').classList.add('hidden');
              document.getElementById('action-buttons').classList.add('hidden');
              document.getElementById('confirm-accept').classList.remove('hidden');
              document.getElementById('confirm-decline').classList.add('hidden');
              document.getElementById('action-input').value = 'accept';
              
              // Also make sure signature-draw-section is visible (in case it was hidden for saved signature)
              const drawSection = document.getElementById('signature-draw-section');
              const savedSection = document.getElementById('saved-signature-section');
              if (!savedSection && drawSection) {
                drawSection.classList.remove('hidden');
              }
              
              // Initialize canvas with retry mechanism
              initRetryCount = 0;
              setTimeout(function() {
                if (!initializeCanvas()) {
                  retryInitCanvas();
                }
              }, 50);
            }
            
            function showDeclineForm() {
              document.getElementById('decline-section').classList.remove('hidden');
              document.getElementById('accept-section').classList.add('hidden');
              document.getElementById('action-buttons').classList.add('hidden');
              document.getElementById('confirm-decline').classList.remove('hidden');
              document.getElementById('confirm-accept').classList.add('hidden');
              document.getElementById('action-input').value = 'decline';
            }
            
            function resetForm() {
              document.getElementById('accept-section').classList.add('hidden');
              document.getElementById('decline-section').classList.add('hidden');
              document.getElementById('action-buttons').classList.remove('hidden');
              document.getElementById('confirm-accept').classList.add('hidden');
              document.getElementById('confirm-decline').classList.add('hidden');
              clearSignature();
              // Show saved signature section if it exists
              const savedSection = document.getElementById('saved-signature-section');
              if (savedSection) {
                savedSection.classList.remove('hidden');
                document.getElementById('signature-draw-section').classList.add('hidden');
              }
            }
            
            // Use saved signature from previous quote
            function useSavedSignature() {
              const savedImg = document.getElementById('saved-signature-img');
              if (savedImg) {
                document.getElementById('signature_data').value = savedImg.src;
                hasSignature = true;
                document.getElementById('signature-error').classList.add('hidden');
              }
            }
            
            // Draw a new signature instead of using saved
            function drawNewSignature() {
              const savedSection = document.getElementById('saved-signature-section');
              if (savedSection) {
                savedSection.classList.add('hidden');
              }
              document.getElementById('signature-draw-section').classList.remove('hidden');
              hasSignature = false;
              document.getElementById('signature_data').value = '';
              
              // Initialize canvas with retry mechanism
              initRetryCount = 0;
              canvasInitialized = false; // Force re-init
              setTimeout(function() {
                if (!initializeCanvas()) {
                  retryInitCanvas();
                }
              }, 50);
            }
            
            // Show saved signature section again
            function showSavedSignature() {
              const savedSection = document.getElementById('saved-signature-section');
              if (savedSection) {
                savedSection.classList.remove('hidden');
                document.getElementById('signature-draw-section').classList.add('hidden');
                clearSignature();
              }
            }
          </script>
        ` : ''}
      </div>
    </div>
    
    <div class="footer">
      <p class="footer-business">${business.businessName}${business.abn ? ` <span style="color: #94a3b8;">•</span> ABN ${business.abn}` : ''}</p>
      <p class="footer-powered">Powered by JobRunner</p>
    </div>
  </div>
  
  ${showSuccess && quote.status === 'accepted' ? `
  <!-- Success confirmation overlay -->
  <div class="success-overlay" id="success-overlay">
    <div class="success-card">
      <div class="success-header">
        <div class="success-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h2>Quote Accepted!</h2>
        <p>Thank you for your confirmation</p>
      </div>
      <div class="success-body">
        <div class="success-details">
          <div class="success-details-row">
            <span class="success-details-label">Quote</span>
            <span class="success-details-value">${quote.number}</span>
          </div>
          <div class="success-details-row">
            <span class="success-details-label">Business</span>
            <span class="success-details-value">${business.businessName}</span>
          </div>
          <div class="success-details-row">
            <span class="success-details-label">Total</span>
            <span class="success-details-value">${formatCurrency(total)}</span>
          </div>
          ${signature ? `
          <div class="success-details-row">
            <span class="success-details-label">Signed by</span>
            <span class="success-details-value">${signature.signerName}</span>
          </div>
          ` : ''}
        </div>
        
        <a href="/api/public/quote/${token}/pdf" target="_blank" class="success-btn" style="text-decoration: none;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download Signed Quote
        </a>
        
        <button class="success-btn success-btn-secondary" onclick="closeSuccessOverlay()">
          View Quote Details
        </button>
      </div>
    </div>
  </div>
  
  <script>
    function closeSuccessOverlay() {
      document.getElementById('success-overlay').style.display = 'none';
      // Update URL to remove success param
      history.replaceState(null, '', window.location.pathname);
    }
  </script>
  ` : ''}
</body>
</html>
  `;
};

// Payment Receipt Data Interface
export interface PaymentReceiptData {
  payment: {
    id: string;
    amount: number; // in cents
    gstAmount?: number;
    paymentMethod: string;
    reference?: string | null;
    paidAt: Date | null;
  };
  client?: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  // Structural subset (template reads only these, all null-safe); accepts full
  // BusinessSettings as well as the minimal { businessName } fallback.
  // documentTemplate/documentTemplateSettings drive the same template selection
  // used by quotes/invoices so receipts render with the owner's chosen style.
  business: {
    businessName?: string | null;
    abn?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    logoUrl?: string | null;
    licenseNumber?: string | null;
    brandColor?: string | null;
    documentTemplate?: string | null;
    documentTemplateSettings?: unknown;
  };
  invoice?: {
    number: string;
    title?: string | null;
  } | null;
  job?: {
    title: string;
    address?: string | null;
  } | null;
}


// Format cents to currency
const formatCentsToAUD = (cents: number): string => {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
};

// Generate Payment Receipt PDF HTML - Professional template matching Quotes/Invoices
export const generatePaymentReceiptPDF = (data: PaymentReceiptData): string => {
  const { payment, client, business, invoice, job } = data;
  
  // Render with the owner's business-level document template (modern /
  // professional / minimal) + custom settings so receipts match their quotes
  // and invoices. Falls back to the default template when those fields are
  // absent (e.g. the minimal { businessName } fallback).
  const { template, accentColor } = getTemplateFromBusinessSettings(business as { documentTemplate?: string | null; documentTemplateSettings?: unknown });
  
  // Amounts are already in dollars (not cents) - no conversion needed
  const amountDollars = payment.amount;
  const gstAmountDollars = payment.gstAmount || 0;
  const subtotalDollars = gstAmountDollars > 0 ? amountDollars - gstAmountDollars : amountDollars;
  
  // Get payment method display name
  const getPaymentMethodDisplay = (method: string): string => {
    const methodMap: Record<string, string> = {
      'card': 'Card Payment',
      'tap_to_pay': 'Tap to Pay',
      'bank_transfer': 'Bank Transfer',
      'cash': 'Cash',
      'cheque': 'Cheque',
      'eftpos': 'EFTPOS',
      'stripe': 'Online Payment',
      'manual': 'Manual Payment',
    };
    return methodMap[method.toLowerCase()] || method;
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt${payment.reference ? ` - ${payment.reference}` : ''} - ${business.businessName}</title>
  ${generateGoogleFontsLink()}
  ${generateDocumentStyles(template, accentColor)}
  <style>
    /* Receipt-specific overrides for single-page printing */
    body {
      background: #ffffff !important;
    }
    
    .document {
      max-width: 800px;
      background: #ffffff;
      padding: 20px 30px;
    }
    
    /* Compact header for receipts */
    .header {
      margin-bottom: 16px !important;
      padding-bottom: 12px !important;
    }
    
    .company-name {
      font-size: 18px !important;
    }
    
    .company-details p {
      margin-bottom: 1px !important;
      font-size: 10px !important;
    }
    
    .info-section {
      padding: 12px !important;
      margin-bottom: 12px !important;
    }
    
    .info-label {
      font-size: 9px !important;
      margin-bottom: 4px !important;
    }
    
    .info-value {
      font-size: 11px !important;
      line-height: 1.4 !important;
    }
    
    
    /* Compact payment summary box */
    .payment-summary {
      margin: 14px 0;
      padding: 12px 16px;
      background: #ffffff;
      border: 2px solid #22c55e;
      border-radius: 6px;
      position: relative;
    }
    
    .payment-summary::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(34, 197, 94, 0.02));
      border-radius: 5px;
      pointer-events: none;
    }
    
    .payment-summary-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(34, 197, 94, 0.3);
      position: relative;
    }
    
    .payment-summary-title {
      font-size: 11px;
      font-weight: ${template.headingWeight};
      color: #166534;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .payment-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      background: #22c55e;
      color: white;
      border-radius: 16px;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .payment-status-badge::before {
      content: '✓';
      font-size: 10px;
    }
    
    .payment-amount-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid rgba(34, 197, 94, 0.2);
      position: relative;
    }
    
    .payment-amount-row:last-child {
      border-bottom: none;
    }
    
    .payment-amount-row.total {
      border-bottom: none;
      border-top: 2px solid #22c55e;
      padding-top: 10px;
      margin-top: 8px;
    }
    
    .payment-amount-row .label {
      color: #166534;
      font-size: 10px;
      font-weight: 500;
    }
    
    .payment-amount-row .value {
      font-weight: 600;
      color: #166534;
      font-size: 10px;
    }
    
    .payment-amount-row.total .label {
      font-size: 13px;
      font-weight: ${template.headingWeight};
      color: #166534;
    }
    
    .payment-amount-row.total .value {
      font-size: 16px;
      font-weight: ${template.headingWeight};
      color: #166534;
    }
    
    /* Compact transaction details grid */
    .transaction-details {
      margin: 14px 0;
    }
    
    .transaction-details-title {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #666;
      margin-bottom: 8px;
      font-weight: 600;
      border-bottom: 2px solid ${accentColor};
      padding-bottom: 4px;
      display: inline-block;
    }
    
    .transaction-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    
    .transaction-item {
      padding: 8px 10px;
      background: #fafafa;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
    }
    
    .transaction-item-label {
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #666;
      margin-bottom: 3px;
      font-weight: 600;
    }
    
    .transaction-item-value {
      font-size: 10px;
      font-weight: 600;
      color: #1a1a1a;
    }
    
    /* Compact linked document references */
    .linked-document {
      margin: 10px 0;
      padding: 10px 14px;
      background: #fafafa;
      border-left: 3px solid ${accentColor};
      border-radius: 0 4px 4px 0;
    }
    
    .linked-document-title {
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #666;
      margin-bottom: 4px;
      font-weight: 600;
    }
    
    .linked-document-content {
      font-size: 11px;
      color: #1a1a1a;
      line-height: 1.4;
    }
    
    .linked-document-content strong {
      font-weight: 600;
      color: ${accentColor};
    }
    
    /* Compact thank you section - minimal for single page fit */
    .thank-you-section {
      text-align: center;
      margin: 10px 0 8px 0;
      padding: 10px;
      background: linear-gradient(135deg, ${accentColor}08, ${accentColor}03);
      border: 1px solid ${accentColor}20;
      border-radius: 4px;
    }
    
    .thank-you-text {
      font-size: 12px;
      font-weight: ${template.headingWeight};
      color: ${accentColor};
      margin-bottom: 2px;
    }
    
    .thank-you-subtext {
      font-size: 9px;
      color: #666;
      line-height: 1.3;
    }
    
    .footer {
      margin-top: 12px !important;
      padding-top: 10px !important;
      font-size: 9px !important;
    }
    
    .footer p {
      margin-bottom: 2px !important;
    }
    
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff !important; }
      .document { padding: 15px 25px; background: #fff !important; }
    }
    
    @page {
      size: A4;
      margin: 8mm;
    }
  </style>
</head>
<body>
  <div class="document">
    <div class="header">
      <div class="company-info">
        ${business.logoUrl ? `<img src="${business.logoUrl}" alt="${business.businessName}" class="logo" />` : ''}
        <div class="company-name">${business.businessName}</div>
        <div class="company-details">
          ${business.abn ? `<p><strong>ABN:</strong> ${business.abn}</p>` : ''}
          ${business.address ? `<p>${business.address}</p>` : ''}
          ${business.phone ? `<p>Phone: ${business.phone}</p>` : ''}
          ${business.email ? `<p>Email: ${business.email}</p>` : ''}
          ${business.licenseNumber ? `<p>Licence No: ${business.licenseNumber}</p>` : ''}
        </div>
      </div>
      <div class="document-type">
        <div class="document-title">Receipt</div>
        <div class="document-number">${payment.reference || `REC-${payment.id.slice(0, 8).toUpperCase()}`}</div>
        <div style="margin-top: 8px;">
          <span class="status-badge status-accepted">Paid</span>
        </div>
      </div>
    </div>
    
    <div class="info-section">
      <div class="info-block">
        <div class="info-label">Received From</div>
        <div class="info-value">
          ${client ? `
            <strong>${getClientDisplayName(client)}</strong><br/>
            ${client.address ? `${client.address}<br/>` : ''}
            ${client.email ? `${client.email}<br/>` : ''}
            ${client.phone ? `${client.phone}` : ''}
          ` : '<em>Walk-in Customer</em>'}
        </div>
      </div>
      <div class="info-block">
        <div class="info-label">Payment Details</div>
        <div class="info-value">
          <strong>Date:</strong> ${formatDate(payment.paidAt)}<br/>
          <strong>Time:</strong> ${payment.paidAt ? new Date(payment.paidAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : ''}<br/>
          <strong>Method:</strong> ${getPaymentMethodDisplay(payment.paymentMethod)}
        </div>
      </div>
    </div>
    
    ${job?.address || job?.title ? `
    <div class="info-section" style="margin-top: 16px;">
      <div class="info-block" style="flex: 1;">
        <div class="info-label">Job Reference</div>
        <div class="info-value">
          <strong>${job.title}</strong>
          ${job.address ? `<br/><span style="color: #666;">${job.address}</span>` : ''}
        </div>
      </div>
    </div>
    ` : ''}
    
    <div class="payment-summary">
      <div class="payment-summary-header">
        <div class="payment-summary-title">Payment Received</div>
        <div class="payment-status-badge">Paid</div>
      </div>
      
      ${gstAmountDollars > 0 ? `
        <div class="payment-amount-row">
          <span class="label">Subtotal (excl. GST)</span>
          <span class="value">${formatCurrency(subtotalDollars)}</span>
        </div>
        <div class="payment-amount-row">
          <span class="label">GST (10%)</span>
          <span class="value">${formatCurrency(gstAmountDollars)}</span>
        </div>
      ` : ''}
      
      <div class="payment-amount-row total">
        <span class="label">Total Amount Paid${gstAmountDollars > 0 ? ' (incl. GST)' : ''}</span>
        <span class="value">${formatCurrency(amountDollars)}</span>
      </div>
    </div>
    
    <div class="transaction-details">
      <div class="transaction-details-title">Transaction Details</div>
      <div class="transaction-grid">
        <div class="transaction-item">
          <div class="transaction-item-label">Payment Method</div>
          <div class="transaction-item-value">${getPaymentMethodDisplay(payment.paymentMethod)}</div>
        </div>
        <div class="transaction-item">
          <div class="transaction-item-label">Transaction ID</div>
          <div class="transaction-item-value" style="font-size: 11px; word-break: break-all;">${payment.id}</div>
        </div>
        ${payment.reference ? `
        <div class="transaction-item">
          <div class="transaction-item-label">Reference Number</div>
          <div class="transaction-item-value">${payment.reference}</div>
        </div>
        ` : ''}
        <div class="transaction-item">
          <div class="transaction-item-label">Date & Time</div>
          <div class="transaction-item-value">${formatDateTime(payment.paidAt)}</div>
        </div>
      </div>
    </div>
    
    ${invoice ? `
    <div class="linked-document">
      <div class="linked-document-title">Invoice Reference</div>
      <div class="linked-document-content">
        <strong>Invoice #${invoice.number}</strong>
        ${invoice.title ? `<br/>${invoice.title}` : ''}
      </div>
    </div>
    ` : ''}
    
    <div class="thank-you-section">
      <div class="thank-you-text">Thank you for your payment!</div>
      <div class="thank-you-subtext">This receipt confirms your payment has been received and processed.<br/>Please retain this document for your records.</div>
    </div>
    
    <div class="footer">
      <p>Thank you for your business!</p>
      ${business.abn ? `<p style="margin-top: 4px;">ABN: ${business.abn}</p>` : ''}
      <p style="margin-top: 4px;">Generated by JobRunner • ${formatDate(new Date())}</p>
    </div>
  </div>
</body>
</html>
  `;
};

export const generateJobProofPackPDF = (data: {
  job: any;
  business: any;
  client: any;
  timeEntries: Array<{workerName: string; startTime: string; endTime?: string; duration?: number; billable?: boolean; clockInLatitude?: string | null; clockInLongitude?: string | null; clockInAddress?: string | null; clockOutLatitude?: string | null; clockOutLongitude?: string | null; clockOutAddress?: string | null; origin?: string}>;
  materials: Array<{name: string; quantity?: string; unitCost?: string; totalCost?: string; supplier?: string; status?: string}>;
  photos: Array<{url: string; caption?: string; category: string; createdAt?: string; latitude?: number | null; longitude?: number | null; address?: string | null}>;
  invoice?: {number: string; date: string; total: string; gstAmount: string; status: string} | null;
  geofenceAlerts?: Array<{workerName: string; alertType: string; latitude?: string; longitude?: string; address?: string; distanceFromSite?: string; createdAt: string}>;
  complianceDocs?: Array<{type: string; title: string; documentNumber?: string; issuer?: string; holderName?: string; expiryDate?: string | null; coverageAmount?: string; status: string}>;
  subcontractors?: Array<{name: string; status: string; invitedAt?: string | null; acceptedAt?: string | null; lastAccessed?: string | null; source: string}>;
  variations?: Array<{number: string; title: string; description?: string; reason?: string; additionalAmount: string; gstAmount: string; totalAmount: string; status: string; approvedByName?: string; approvedAt?: string; createdAt?: string}>;
  swmsList?: Array<{title: string; status: string; siteAddress?: string; workActivity?: string; ppe: string[]; hazards: Array<{activity: string; hazard: string; riskBefore: string; controlMeasures?: string; riskAfter: string}>; signatures: Array<{name: string; signedAt: string; location?: string | null}>; createdAt: string}>;
  safetyForms?: Array<{formName: string; formType: string; isJobCard?: boolean; description?: string; status: string; submittedAt: string; submittedBy?: string; notes?: string; responses: Array<{label: string; value: string; type: string}>}>;
  hideSections?: {timeline?: boolean; attendance?: boolean; gpsProof?: boolean; materials?: boolean; variations?: boolean; photos?: boolean; invoice?: boolean; retention?: boolean; compliance?: boolean; subcontractors?: boolean; swms?: boolean; forms?: boolean};
  accentColor?: string;
  retention?: {
    sumRetentionHeld: number;
    outstandingRetention: number;
    practicalCompletionDate: string | null;
    defectsLiabilityMonths: number;
    releaseDate: string | null;
    retentionStatus: string;
  } | null;
}): string => {
  const { job, business, client, timeEntries, materials, photos, invoice, geofenceAlerts = [], complianceDocs = [], subcontractors = [], variations = [], swmsList = [], safetyForms = [], hideSections = {}, accentColor: overrideColor, retention = null } = data;
  const safetyOnlyForms = safetyForms.filter(f => !f.isJobCard && ['safety', 'inspection', 'compliance'].includes(f.formType));
  const jobCardForms = safetyForms.filter(f => f.isJobCard || !['safety', 'inspection', 'compliance'].includes(f.formType));
  let proofSectionNumber = 0;
  const proofSectionTitle = (title: string) => `${++proofSectionNumber}. ${title}`;

  const { template, accentColor: templateColor } = getTemplateFromBusinessSettings(business);
  const brandColor = overrideColor || templateColor;

  const formatProofDate = (date: Date | string | null | undefined): string => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Australia/Sydney',
    }) + ', ' + d.toLocaleTimeString('en-AU', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Australia/Sydney',
    });
  };

  const formatShortDate = (date: Date | string | null | undefined): string => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Australia/Sydney' });
  };

  const formatShortTime = (date: Date | string | null | undefined): string => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Australia/Sydney' });
  };

  const formatDuration = (minutes: number | undefined): string => {
    if (!minutes && minutes !== 0) return '-';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h === 0) return `${m}m`;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const logoHtml = business.logoUrl
    ? `<img src="${business.logoUrl}" class="logo" alt="${business.businessName || 'Business'}" />`
    : '';

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { pending: 'Pending', scheduled: 'Scheduled', in_progress: 'In Progress', done: 'Completed', invoiced: 'Invoiced', cancelled: 'Cancelled' };
    return map[s] || s;
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = { pending: '#f59e0b', scheduled: '#3b82f6', in_progress: '#8b5cf6', done: '#22c55e', invoiced: '#06b6d4', cancelled: '#ef4444' };
    return map[s] || '#6b7280';
  };

  const dateRange = [job.scheduledAt, job.completedAt].filter(Boolean);
  const dateRangeStr = dateRange.length === 2
    ? `${formatShortDate(dateRange[0])} → ${formatShortDate(dateRange[1])}`
    : dateRange.length === 1
      ? formatShortDate(dateRange[0])
      : 'No dates set';

  const totalTimeMinutes = timeEntries.reduce((sum, e) => sum + (e.duration || 0), 0);
  const totalTimeStr = formatDuration(totalTimeMinutes);

  const materialsTotal = materials.reduce((sum, m) => sum + parseFloat(m.totalCost || '0'), 0);

  const timelineRows = [
    { label: 'Created', date: job.createdAt },
    { label: 'Scheduled', date: job.scheduledAt },
    { label: 'Started', date: job.startedAt },
    { label: 'Completed', date: job.completedAt },
  ];

  const timeEntriesHtml = timeEntries.length > 0
    ? `<table class="proof-table">
        <thead>
          <tr>
            <th>Worker</th>
            <th>Date</th>
            <th>Start</th>
            <th>End</th>
            <th style="text-align:right">Duration</th>
            <th style="text-align:center">Billable</th>
          </tr>
        </thead>
        <tbody>
          ${timeEntries.map(e => `
          <tr>
            <td>${ensureDisplayName(e.workerName, 'Owner')}</td>
            <td>${formatShortDate(e.startTime)}</td>
            <td>${formatShortTime(e.startTime)}</td>
            <td>${e.endTime ? formatShortTime(e.endTime) : '-'}</td>
            <td style="text-align:right">${formatDuration(e.duration)}</td>
            <td style="text-align:center">${e.billable !== false ? 'Yes' : 'No'}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="text-align:right;font-weight:700;border-top:2px solid ${brandColor}">Total Hours</td>
            <td style="text-align:right;font-weight:700;border-top:2px solid ${brandColor}">${totalTimeStr}</td>
            <td style="border-top:2px solid ${brandColor}"></td>
          </tr>
        </tfoot>
      </table>`
    : `<p class="empty-message">No time entries recorded</p>`;

  const materialsHtml = materials.length > 0
    ? `<table class="proof-table">
        <thead>
          <tr>
            <th>Material</th>
            <th style="text-align:right">Qty</th>
            <th style="text-align:right">Unit Cost</th>
            <th style="text-align:right">Total</th>
            <th>Supplier</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${materials.map(m => `
          <tr>
            <td>${m.name || '-'}</td>
            <td style="text-align:right">${m.quantity || '-'}</td>
            <td style="text-align:right">${m.unitCost ? `$${parseFloat(m.unitCost).toFixed(2)}` : '-'}</td>
            <td style="text-align:right">${m.totalCost ? `$${parseFloat(m.totalCost).toFixed(2)}` : '-'}</td>
            <td>${m.supplier || '-'}</td>
            <td><span class="status-pill">${m.status || '-'}</span></td>
          </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="text-align:right;font-weight:700;border-top:2px solid ${brandColor}">Materials Total</td>
            <td style="text-align:right;font-weight:700;border-top:2px solid ${brandColor}">$${materialsTotal.toFixed(2)}</td>
            <td colspan="2" style="border-top:2px solid ${brandColor}"></td>
          </tr>
        </tfoot>
      </table>`
    : `<p class="empty-message">No materials tracked</p>`;

  const variationsTotal = variations.reduce((sum, v) => sum + parseFloat(v.totalAmount || '0'), 0);
  const variationsHtml = variations.length > 0
    ? `<table class="proof-table">
        <thead>
          <tr>
            <th>Ref</th>
            <th>Description</th>
            <th>Status</th>
            <th style="text-align:right">Amount (inc GST)</th>
            <th>Approved By</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${variations.map(v => {
            const statusColor = v.status === 'approved' ? '#166534' : v.status === 'rejected' ? '#991b1b' : '#92400e';
            const statusBg = v.status === 'approved' ? '#dcfce7' : v.status === 'rejected' ? '#fecaca' : '#fef3c7';
            return `
          <tr>
            <td style="font-weight:600">${v.number}</td>
            <td>
              <strong>${v.title}</strong>
              ${v.description ? `<br/><span style="color:#666;font-size:9px">${v.description}</span>` : ''}
              ${v.reason ? `<br/><span style="color:#888;font-size:9px">Reason: ${v.reason}</span>` : ''}
            </td>
            <td><span class="status-pill" style="background:${statusBg};color:${statusColor}">${v.status}</span></td>
            <td style="text-align:right">${parseFloat(v.totalAmount) >= 0 ? '' : '-'}$${Math.abs(parseFloat(v.totalAmount)).toFixed(2)}</td>
            <td>${v.approvedByName || '-'}</td>
            <td>${v.approvedAt || v.createdAt || '-'}</td>
          </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="text-align:right;font-weight:700;border-top:2px solid ${brandColor}">Variations Total</td>
            <td style="text-align:right;font-weight:700;border-top:2px solid ${brandColor}">${variationsTotal >= 0 ? '' : '-'}$${Math.abs(variationsTotal).toFixed(2)}</td>
            <td colspan="2" style="border-top:2px solid ${brandColor}"></td>
          </tr>
        </tfoot>
      </table>`
    : `<p class="empty-message">No variations recorded</p>`;

  const photosHtml = photos.length > 0
    ? `<div class="photo-grid">
        ${photos.map(p => `
        <div class="photo-card">
          <img src="${p.url}" alt="${p.caption || 'Job photo'}" class="photo-img" />
          <div class="photo-meta">
            <span class="photo-category">${p.category || 'general'}</span>
            ${p.caption ? `<span class="photo-caption">${p.caption}</span>` : ''}
            ${p.createdAt ? `<span class="photo-date">${formatShortDate(p.createdAt)}</span>` : ''}
            ${p.latitude != null && p.longitude != null ? `<span class="photo-location"><span class="gps-badge verified">GPS</span> ${p.address || `${Number(p.latitude).toFixed(5)}, ${Number(p.longitude).toFixed(5)}`}</span>` : ''}
          </div>
        </div>`).join('')}
      </div>`
    : `<p class="empty-message">No photos attached</p>`;

  const invoiceHtml = invoice
    ? `<table class="proof-table">
        <tbody>
          <tr><td style="font-weight:600;width:180px">Invoice Number</td><td>${invoice.number}</td></tr>
          <tr><td style="font-weight:600">Date</td><td>${invoice.date}</td></tr>
          <tr><td style="font-weight:600">Total (inc GST)</td><td>$${parseFloat(invoice.total).toFixed(2)}</td></tr>
          <tr><td style="font-weight:600">GST</td><td>$${parseFloat(invoice.gstAmount).toFixed(2)}</td></tr>
          <tr><td style="font-weight:600">Payment Status</td><td><span class="status-pill" style="background:${invoice.status === 'paid' ? '#dcfce7' : '#fef3c7'};color:${invoice.status === 'paid' ? '#166534' : '#92400e'}">${invoice.status === 'paid' ? 'Paid' : invoice.status}</span></td></tr>
        </tbody>
      </table>`
    : `<p class="empty-message">No invoice generated</p>`;

  const gpsEntries = timeEntries.filter(e => e.clockInLatitude || e.clockOutLatitude || e.origin === 'geofence');

  // Build worker presence summary - group by worker and calculate total on-site time
  const workerPresenceMap = new Map<string, { worker: string; firstIn: string | null; lastOut: string | null; totalMs: number; address: string; verified: boolean }>();
  for (const e of gpsEntries) {
    const key = e.workerName || 'Owner';
    const existing = workerPresenceMap.get(key) || { worker: key, firstIn: null, lastOut: null, totalMs: 0, address: '', verified: false };
    if (e.startTime && (!existing.firstIn || new Date(e.startTime) < new Date(existing.firstIn))) {
      existing.firstIn = e.startTime;
    }
    if (e.endTime && (!existing.lastOut || new Date(e.endTime) > new Date(existing.lastOut))) {
      existing.lastOut = e.endTime;
    }
    if (e.duration) existing.totalMs += e.duration * 60 * 1000;
    if (e.clockInAddress) existing.address = e.clockInAddress;
    else if (e.clockInLatitude) existing.address = `${e.clockInLatitude}, ${e.clockInLongitude}`;
    if (e.clockInLatitude || e.clockOutLatitude || e.origin === 'geofence') existing.verified = true;
    workerPresenceMap.set(key, existing);
  }
  // Also include geofence alerts in presence data
  for (const a of geofenceAlerts) {
    const key = a.workerName || 'Worker';
    const existing = workerPresenceMap.get(key) || { worker: key, firstIn: null, lastOut: null, totalMs: 0, address: '', verified: false };
    if (a.alertType === 'arrival' && a.createdAt && (!existing.firstIn || new Date(a.createdAt) < new Date(existing.firstIn))) {
      existing.firstIn = a.createdAt;
    }
    if (a.alertType === 'departure' && a.createdAt && (!existing.lastOut || new Date(a.createdAt) > new Date(existing.lastOut))) {
      existing.lastOut = a.createdAt;
    }
    if (a.address) existing.address = a.address;
    else if (a.latitude) existing.address = `${a.latitude}, ${a.longitude}`;
    existing.verified = true;
    workerPresenceMap.set(key, existing);
  }

  const presenceSummaryHtml = workerPresenceMap.size > 0
    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px;margin-bottom:12px">
        <div style="font-weight:700;font-size:12px;color:#166534;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">Worker Presence Summary</div>
        ${Array.from(workerPresenceMap.values()).map(w => {
          const durationStr = w.totalMs > 0 ? `${Math.floor(w.totalMs / 3600000)}h ${Math.floor((w.totalMs % 3600000) / 60000)}m` : (w.firstIn && w.lastOut ? `${Math.floor((new Date(w.lastOut).getTime() - new Date(w.firstIn).getTime()) / 3600000)}h ${Math.floor(((new Date(w.lastOut).getTime() - new Date(w.firstIn).getTime()) % 3600000) / 60000)}m` : '-');
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #dcfce7">
            <div>
              <span style="font-weight:600;color:#14532d">${ensureDisplayName(w.worker, 'Team member')}</span>
              ${w.verified ? '<span class="gps-badge verified" style="margin-left:6px;font-size:9px">GPS Verified</span>' : ''}
            </div>
            <div style="text-align:right;font-size:11px;color:#166534">
              ${w.firstIn ? `${formatShortTime(w.firstIn)}` : '?'} — ${w.lastOut ? `${formatShortTime(w.lastOut)}` : '?'}
              <span style="font-weight:600;margin-left:8px">(${durationStr})</span>
            </div>
          </div>
          ${w.address ? `<div style="font-size:10px;color:#15803d;padding:2px 0 4px 0">${w.address}</div>` : ''}`;
        }).join('')}
      </div>`
    : '';

  const gpsProofHtml = gpsEntries.length > 0 || geofenceAlerts.length > 0
    ? `${presenceSummaryHtml}
      <table class="proof-table">
        <thead>
          <tr>
            <th>Worker</th>
            <th>Event</th>
            <th>Time</th>
            <th>Location</th>
            <th style="text-align:center">Verified</th>
          </tr>
        </thead>
        <tbody>
          ${gpsEntries.map(e => {
            const rows = [];
            if (e.clockInLatitude || e.clockInAddress) {
              rows.push(`<tr>
                <td>${ensureDisplayName(e.workerName, 'Owner')}</td>
                <td>Clock In</td>
                <td>${formatShortTime(e.startTime)}, ${formatShortDate(e.startTime)}</td>
                <td>${e.clockInAddress || `${e.clockInLatitude}, ${e.clockInLongitude}`}</td>
                <td style="text-align:center"><span class="gps-badge verified">GPS</span></td>
              </tr>`);
            }
            if (e.clockOutLatitude || e.clockOutAddress) {
              rows.push(`<tr>
                <td>${ensureDisplayName(e.workerName, 'Owner')}</td>
                <td>Clock Out</td>
                <td>${e.endTime ? `${formatShortTime(e.endTime)}, ${formatShortDate(e.endTime)}` : '-'}</td>
                <td>${e.clockOutAddress || `${e.clockOutLatitude}, ${e.clockOutLongitude}`}</td>
                <td style="text-align:center"><span class="gps-badge verified">GPS</span></td>
              </tr>`);
            }
            if (rows.length === 0 && e.origin === 'geofence') {
              rows.push(`<tr>
                <td>${ensureDisplayName(e.workerName, 'Owner')}</td>
                <td>Geofence</td>
                <td>${formatShortTime(e.startTime)}, ${formatShortDate(e.startTime)}</td>
                <td>Auto-detected by geofence</td>
                <td style="text-align:center"><span class="gps-badge verified">GPS</span></td>
              </tr>`);
            }
            return rows.join('');
          }).join('')}
          ${geofenceAlerts.map(a => `<tr>
            <td>${ensureDisplayName(a.workerName, 'Team member')}</td>
            <td>${a.alertType === 'arrival' ? 'Geofence Arrival' : 'Geofence Departure'}</td>
            <td>${formatShortTime(a.createdAt)}, ${formatShortDate(a.createdAt)}</td>
            <td>${a.address || (a.latitude ? `${a.latitude}, ${a.longitude}` : '-')}${a.distanceFromSite ? ` (${parseFloat(a.distanceFromSite).toFixed(0)}m from site)` : ''}</td>
            <td style="text-align:center"><span class="gps-badge verified">GPS</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
      <p style="font-size:9px;color:#888;margin-top:4px;font-style:italic">GPS coordinates recorded at clock-in/clock-out. Presence verified via device location services. Times shown in AEST.</p>`
    : `<p class="empty-message">No GPS verification data recorded</p>`;

  const complianceTypeLabel = (t: string) => {
    const map: Record<string, string> = { licence: 'Trade Licence', insurance: 'Insurance', white_card: 'White Card', vehicle_rego: 'Vehicle Rego', certification: 'Certification', other: 'Other' };
    return map[t] || t;
  };

  const complianceStatusColor = (s: string) => {
    if (s === 'current') return 'background:#dcfce7;color:#166534';
    if (s === 'expiring') return 'background:#fef3c7;color:#92400e';
    return 'background:#fee2e2;color:#991b1b';
  };

  const complianceHtml = complianceDocs.length > 0
    ? `<table class="proof-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Document</th>
            <th>Number</th>
            <th>Holder</th>
            <th>Issuer</th>
            <th>Expiry</th>
            <th style="text-align:center">Status</th>
          </tr>
        </thead>
        <tbody>
          ${complianceDocs.map(d => `
          <tr>
            <td>${complianceTypeLabel(d.type)}</td>
            <td style="font-weight:600">${d.title}</td>
            <td>${d.documentNumber || '-'}</td>
            <td>${d.holderName || '-'}</td>
            <td>${d.issuer || '-'}</td>
            <td>${d.expiryDate || 'No expiry'}</td>
            <td style="text-align:center"><span class="status-pill" style="${complianceStatusColor(d.status)}">${d.status === 'current' ? 'Current' : d.status === 'expiring' ? 'Expiring' : 'Expired'}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
      ${complianceDocs.some(d => d.coverageAmount) ? `<p style="font-size:9px;color:#888;margin-top:4px;font-style:italic">Insurance coverage: ${complianceDocs.filter(d => d.coverageAmount).map(d => `${d.title} — ${d.coverageAmount}`).join(', ')}</p>` : ''}`
    : `<p class="empty-message">No compliance documents on file</p>`;

  const subStatusLabel = (s: string) => {
    const map: Record<string, string> = { pending: 'Pending', accepted: 'Accepted', active: 'Active', expired: 'Expired', revoked: 'Revoked' };
    return map[s] || s;
  };

  const subStatusColor = (s: string) => {
    if (s === 'accepted' || s === 'active') return 'background:#dcfce7;color:#166534';
    if (s === 'pending') return 'background:#fef3c7;color:#92400e';
    return 'background:#fee2e2;color:#991b1b';
  };

  const subcontractorsHtml = subcontractors.length > 0
    ? `<table class="proof-table">
        <thead>
          <tr>
            <th>Subcontractor</th>
            <th>Invited</th>
            <th>Accepted</th>
            <th>Last Active</th>
            <th style="text-align:center">Status</th>
          </tr>
        </thead>
        <tbody>
          ${subcontractors.map(s => `
          <tr>
            <td style="font-weight:600">${s.name}</td>
            <td>${s.invitedAt || '-'}</td>
            <td>${s.acceptedAt || '-'}</td>
            <td>${s.lastAccessed || '-'}</td>
            <td style="text-align:center"><span class="status-pill" style="${subStatusColor(s.status)}">${subStatusLabel(s.status)}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>`
    : `<p class="empty-message">No subcontractors assigned to this job</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${generateGoogleFontsLink()}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${template.fontFamily};
      font-size: ${template.baseFontSize};
      font-weight: ${template.bodyWeight};
      line-height: 1.5;
      color: #1a1a1a;
      background: #fff;
    }
    .document { max-width: 800px; margin: 0 auto; padding: 15px 20px; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      padding-bottom: 12px;
      ${template.showHeaderDivider ? `border-bottom: ${template.headerBorderWidth} solid ${brandColor};` : 'border-bottom: none;'}
    }
    .company-info { flex: 1; }
    .company-name { font-size: 22px; font-weight: ${template.headingWeight}; color: ${brandColor}; margin-bottom: 4px; }
    .company-details { color: #666; font-size: 10px; line-height: 1.6; }
    .logo { max-width: 140px; max-height: 55px; object-fit: contain; margin-bottom: 8px; }
    .document-type { text-align: right; }
    .document-title { font-size: 24px; font-weight: ${template.headingWeight}; color: ${brandColor}; text-transform: uppercase; letter-spacing: 1.5px; }
    .job-meta { margin-top: 6px; font-size: 11px; color: #555; }
    .job-meta p { margin: 2px 0; }
    .status-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 600; color: white; }
    .info-section { display: flex; justify-content: space-between; margin-bottom: 14px; gap: 20px; }
    .info-block { flex: 1; }
    .info-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 4px; font-weight: 600; }
    .info-value { color: #1a1a1a; line-height: 1.5; font-size: 11px; }

    .section { margin-bottom: 18px; page-break-inside: avoid; }
    .section-title {
      font-size: 14px;
      font-weight: ${template.headingWeight};
      color: ${brandColor};
      margin-bottom: 8px;
      padding-bottom: 4px;
      ${template.id === 'minimal' ? 'border-bottom: 1px solid #e5e7eb;' : `border-bottom: 1px solid ${brandColor}40;`}
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .section-icon { font-size: 16px; }

    .proof-table { width: 100%; ${template.id === 'modern' ? 'border-collapse: separate; border-spacing: 0;' : 'border-collapse: collapse;'} margin-bottom: 4px; }
    .proof-table th {
      ${template.tableStyle === 'minimal' ? `background: transparent; color: #1a1a1a; border-bottom: 2px solid ${brandColor};` : `background: ${brandColor}; color: white;`}
      padding: 6px 8px;
      text-align: left;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    ${template.id === 'modern' ? `
    .proof-table th:first-child { border-top-left-radius: 8px; border-bottom-left-radius: 8px; }
    .proof-table th:last-child { border-top-right-radius: 8px; border-bottom-right-radius: 8px; }
    ` : ''}
    .proof-table td { padding: 6px 8px; font-size: 11px; vertical-align: top; }
    ${template.tableStyle === 'striped' ? `
    .proof-table td { border-bottom: none; }
    .proof-table tbody tr:nth-child(odd) { background: #f9fafb; }
    .proof-table tbody tr:nth-child(even) { background: transparent; }
    ` : template.tableStyle === 'minimal' ? `
    .proof-table td { border-bottom: 1px solid #e5e7eb; }
    ` : `
    .proof-table td { border-bottom: 1px solid #eee; }
    `}
    .proof-table tfoot td { background: transparent; }

    .empty-message { color: #888; font-style: italic; padding: 12px; background: ${template.id === 'minimal' ? 'transparent; border: 1px solid #e5e7eb;' : '#f9fafb;'} border-radius: 6px; text-align: center; font-size: 11px; }

    .status-pill { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; background: #f3f4f6; color: #374151; }

    .photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .photo-card { border: 1px solid ${template.id === 'minimal' ? '#e5e7eb' : '#e5e7eb'}; border-radius: ${template.id === 'modern' ? '8px' : '6px'}; overflow: hidden; }
    .photo-img { width: 100%; height: 140px; object-fit: cover; display: block; }
    .photo-meta { padding: 4px 6px; font-size: 9px; color: #555; }
    .photo-category { display: inline-block; background: ${brandColor}15; color: ${brandColor}; padding: 1px 6px; border-radius: 8px; font-weight: 600; text-transform: capitalize; margin-right: 4px; }
    .photo-caption { display: block; margin-top: 2px; color: #333; }
    .photo-date { display: block; color: #999; font-size: 9px; }
    .photo-location { display: block; margin-top: 2px; font-size: 8px; color: #666; }
    .photo-location .gps-badge { font-size: 7px; padding: 0 4px; margin-right: 2px; vertical-align: middle; }

    .gps-badge { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 9px; font-weight: 700; letter-spacing: 0.5px; }
    .gps-badge.verified { background: #dcfce7; color: #166534; }
    .gps-badge.manual { background: #fef3c7; color: #92400e; }

    .footer {
      margin-top: 20px;
      padding-top: 12px;
      ${template.id === 'minimal' ? 'border-top: 1px solid #e5e7eb;' : `border-top: 2px solid ${brandColor};`}
      text-align: center;
      color: #888;
      font-size: 10px;
    }
    .footer p { margin: 3px 0; }
    .footer .official { font-weight: 600; color: #555; }
  </style>
</head>
<body>
  <div class="document">
    <div class="header">
      <div class="company-info">
        ${logoHtml}
        <div class="company-name">${business.businessName || 'Business'}</div>
        <div class="company-details">
          ${business.abn ? `<p>ABN: ${business.abn}</p>` : ''}
          ${business.address ? `<p>${business.address}</p>` : ''}
          ${business.phone ? `<p>${business.phone}</p>` : ''}
          ${business.email ? `<p>${business.email}</p>` : ''}
        </div>
      </div>
      <div class="document-type">
        <div class="document-title">Job Proof Pack</div>
        <div class="job-meta">
          <p><strong>${job.title || 'Untitled Job'}</strong></p>
          ${job.number ? `<p>Job #${job.number}</p>` : `<p>Job ID: ${job.id?.slice(0, 8)}</p>`}
          <p><span class="status-badge" style="background:${statusColor(job.status)}">${statusLabel(job.status)}</span></p>
          <p style="margin-top:4px">${dateRangeStr}</p>
        </div>
      </div>
    </div>

    <div class="info-section">
      <div class="info-block">
        <div class="info-label">Client</div>
        <div class="info-value">
          <strong>${getClientDisplayName(client, 'Unknown Client')}</strong>
          ${client?.email ? `<br/>${client.email}` : ''}
          ${client?.phone ? `<br/>${client.phone}` : ''}
          ${client?.address ? `<br/>${client.address}` : ''}
        </div>
      </div>
      <div class="info-block">
        <div class="info-label">Job Site</div>
        <div class="info-value">
          ${job.address || job.location || client?.address || 'Not specified'}
          ${job.description ? `<br/><span style="color:#666;font-size:10px">${job.description.substring(0, 120)}${job.description.length > 120 ? '...' : ''}</span>` : ''}
        </div>
      </div>
    </div>

    ${!hideSections.timeline ? `<div class="section">
      <div class="section-title">${proofSectionTitle('Job Timeline')}</div>
      <table class="proof-table">
        <thead>
          <tr>
            <th>Milestone</th>
            <th>Date &amp; Time</th>
          </tr>
        </thead>
        <tbody>
          ${timelineRows.map(r => `
          <tr>
            <td style="font-weight:600">${r.label}</td>
            <td>${formatProofDate(r.date)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}

    ${!hideSections.attendance ? `<div class="section">
      <div class="section-title">${proofSectionTitle('Hours Per Worker')}</div>
      ${timeEntriesHtml}
    </div>` : ''}

    ${!hideSections.gpsProof ? `<div class="section">
      <div class="section-title">${proofSectionTitle('Worker Presence Verification (GPS)')}</div>
      ${gpsProofHtml}
    </div>` : ''}

    ${!hideSections.materials ? `<div class="section">
      <div class="section-title">${proofSectionTitle('Materials &amp; Costs')}</div>
      ${materialsHtml}
    </div>` : ''}

    ${!hideSections.variations ? `<div class="section">
      <div class="section-title">${proofSectionTitle('Variations')}</div>
      ${variationsHtml}
    </div>` : ''}

    ${!hideSections.photos ? `<div class="section">
      <div class="section-title">${proofSectionTitle('Photos (Before / After)')}</div>
      ${photosHtml}
    </div>` : ''}

    ${!hideSections.invoice ? `<div class="section">
      <div class="section-title">${proofSectionTitle('Invoice Summary')}</div>
      ${invoiceHtml}
    </div>` : ''}

    ${!hideSections.retention ? `<div class="section">
      <div class="section-title">${proofSectionTitle('Retention Schedule')}</div>
      ${retention && retention.sumRetentionHeld > 0 ? `
      <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
        <div style="flex:1;min-width:180px">
          <table class="proof-table">
            <tbody>
              <tr><td style="font-weight:600">Total Retention Held</td><td style="text-align:right;font-weight:700">${new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(retention.sumRetentionHeld)}</td></tr>
              <tr><td style="font-weight:600">Outstanding (unreleased)</td><td style="text-align:right;font-weight:600;color:${retention.outstandingRetention > 0 ? '#d97706' : '#16a34a'}">${new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(retention.outstandingRetention)}</td></tr>
              ${retention.outstandingRetention === 0 ? `<tr><td style="font-weight:600">Status</td><td style="text-align:right;color:#16a34a;font-weight:600">Released in Full</td></tr>` : ''}
            </tbody>
          </table>
        </div>
        <div style="flex:1;min-width:180px">
          <table class="proof-table">
            <tbody>
              <tr><td style="font-weight:600">Practical Completion</td><td style="text-align:right">${retention.practicalCompletionDate ? new Date(retention.practicalCompletionDate).toLocaleDateString('en-AU',{day:'2-digit',month:'short',year:'numeric'}) : '—'}</td></tr>
              <tr><td style="font-weight:600">DLP Period</td><td style="text-align:right">${retention.defectsLiabilityMonths} months</td></tr>
              <tr><td style="font-weight:600">DLP End / Release Date</td><td style="text-align:right">${retention.releaseDate ? new Date(retention.releaseDate).toLocaleDateString('en-AU',{day:'2-digit',month:'short',year:'numeric'}) : '—'}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <p style="font-size:9px;color:#6b7280;margin-top:6px">* Retention held is the total withheld across all approved and paid progress claims. Outstanding retention is the amount not yet returned via an approved retention release claim.</p>` : '<p class="empty-message">No retention has been withheld for this job</p>'}
    </div>` : ''}

    ${!hideSections.compliance ? `<div class="section">
      <div class="section-title">${proofSectionTitle('Compliance &amp; Licensing')}</div>
      ${complianceHtml}
    </div>` : ''}

    ${!hideSections.subcontractors ? `<div class="section">
      <div class="section-title">${proofSectionTitle('Subcontractor Coordination')}</div>
      ${subcontractorsHtml}
    </div>` : ''}

    ${!(hideSections as any).swms ? `<div class="section">
      <div class="section-title">${proofSectionTitle('Safety &amp; SWMS')}</div>
      ${swmsList.length > 0 ? `
      <div style="margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:${brandColor};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e2e8f0">Safe Work Method Statements</div>
        ${swmsList.map(s => `
          <div style="margin-bottom:12px;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <div style="font-weight:700;font-size:13px">${s.title}</div>
              <span class="status-pill" style="${s.status === 'active' ? 'background:#dcfce7;color:#166534' : s.status === 'completed' ? 'background:#dbeafe;color:#1e40af' : 'background:#f3f4f6;color:#6b7280'}">${(s.status || 'draft').toUpperCase()}</span>
            </div>
            ${s.workActivity ? `<p style="font-size:10px;color:#555;margin:0 0 8px 0">${s.workActivity}</p>` : ''}
            ${s.hazards.length > 0 ? `
            <table class="proof-table" style="margin-bottom:8px">
              <thead><tr><th>Activity</th><th>Hazard</th><th style="text-align:center">Risk</th><th>Controls</th><th style="text-align:center">Residual</th></tr></thead>
              <tbody>${s.hazards.map(h => {
                const rc = (r: string) => r === 'low' ? 'background:#dcfce7;color:#166534' : r === 'medium' ? 'background:#fef3c7;color:#92400e' : r === 'high' ? 'background:#fee2e2;color:#991b1b' : 'background:#7f1d1d;color:#fff';
                return `<tr>
                  <td>${h.activity}</td>
                  <td>${h.hazard}</td>
                  <td style="text-align:center"><span class="status-pill" style="${rc(h.riskBefore)}">${h.riskBefore.toUpperCase()}</span></td>
                  <td>${h.controlMeasures || '-'}</td>
                  <td style="text-align:center"><span class="status-pill" style="${rc(h.riskAfter)}">${h.riskAfter.toUpperCase()}</span></td>
                </tr>`;
              }).join('')}</tbody>
            </table>` : ''}
            ${s.ppe.length > 0 ? `<p style="font-size:9px;color:#666;margin:4px 0"><strong>PPE:</strong> ${s.ppe.join(', ')}</p>` : ''}
            ${s.signatures.length > 0 ? `<p style="font-size:9px;color:#666;margin:4px 0"><strong>Signed by:</strong> ${s.signatures.map(sig => `${sig.name} (${sig.signedAt})`).join(', ')}</p>` : '<p style="font-size:9px;color:#cc6600;margin:4px 0"><strong>No worker signatures recorded</strong></p>'}
          </div>
        `).join('')}
      </div>` : ''}
      ${safetyOnlyForms.length > 0 ? `
      <div style="margin-bottom:8px">
        <div style="font-size:11px;font-weight:700;color:${brandColor};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e2e8f0">Safety Inspections &amp; Checklists</div>
        ${safetyOnlyForms.map(f => {
          const typeLabels: Record<string, string> = { safety: 'Safety Form', inspection: 'Inspection', compliance: 'Compliance Check', general: 'Form' };
          const typeLabel = f.isJobCard ? 'Job Card' : (typeLabels[f.formType] || 'Form');
          return `
          <div style="margin-bottom:12px;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <div>
                <div style="font-weight:700;font-size:13px">${f.formName}</div>
                <div style="font-size:9px;color:#888;margin-top:2px">${typeLabel} &bull; Submitted ${f.submittedAt}${f.submittedBy ? ` by ${f.submittedBy}` : ''}</div>
              </div>
              <span class="status-pill" style="${f.status === 'approved' ? 'background:#dcfce7;color:#166534' : f.status === 'reviewed' ? 'background:#dbeafe;color:#1e40af' : f.status === 'rejected' ? 'background:#fee2e2;color:#991b1b' : 'background:#fef3c7;color:#92400e'}">${f.status.toUpperCase()}</span>
            </div>
            ${f.description ? `<p style="font-size:10px;color:#555;margin:0 0 8px 0">${f.description}</p>` : ''}
            ${f.responses.length > 0 ? `
            <table class="proof-table" style="margin-bottom:4px">
              <thead><tr><th style="width:40%">Item</th><th>Response</th></tr></thead>
              <tbody>${f.responses.map(r => {
                const isPassFail = r.value === 'Yes' || r.value === 'No' || r.value === 'Pass' || r.value === 'Fail' || r.value === 'N/A';
                const pillStyle = r.value === 'Yes' || r.value === 'Pass' ? 'background:#dcfce7;color:#166534' : r.value === 'No' || r.value === 'Fail' ? 'background:#fee2e2;color:#991b1b' : r.value === 'N/A' ? 'background:#f3f4f6;color:#6b7280' : '';
                return `<tr>
                  <td style="font-weight:500">${r.label}</td>
                  <td>${isPassFail ? `<span class="status-pill" style="${pillStyle}">${r.value}</span>` : r.value}</td>
                </tr>`;
              }).join('')}</tbody>
            </table>` : '<p style="font-size:10px;color:#888">No responses recorded</p>'}
            ${f.notes ? `<p style="font-size:9px;color:#666;margin:4px 0"><strong>Notes:</strong> ${f.notes}</p>` : ''}
          </div>`;
        }).join('')}
      </div>` : ''}
      ${swmsList.length === 0 && safetyOnlyForms.length === 0 ? '<p style="font-size:10px;color:#888">No safety documents recorded for this job</p>' : ''}
    </div>` : ''}

    ${!(hideSections as any).forms ? `<div class="section">
      <div class="section-title">${proofSectionTitle('Job Cards &amp; Forms')}</div>
      ${jobCardForms.length === 0 ? '<p style="font-size:10px;color:#888">No job cards or forms submitted for this job</p>' : ''}
      ${jobCardForms.map(f => {
        const typeLabel = f.isJobCard ? 'Job Card' : 'Form';
        return `
        <div style="margin-bottom:12px;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div>
              <div style="font-weight:700;font-size:13px">${f.formName}</div>
              <div style="font-size:9px;color:#888;margin-top:2px">${typeLabel} &bull; Submitted ${f.submittedAt}${f.submittedBy ? ` by ${f.submittedBy}` : ''}</div>
            </div>
            <span class="status-pill" style="${f.status === 'approved' ? 'background:#dcfce7;color:#166534' : f.status === 'reviewed' ? 'background:#dbeafe;color:#1e40af' : f.status === 'rejected' ? 'background:#fee2e2;color:#991b1b' : 'background:#fef3c7;color:#92400e'}">${f.status.toUpperCase()}</span>
          </div>
          ${f.description ? `<p style="font-size:10px;color:#555;margin:0 0 8px 0">${f.description}</p>` : ''}
          ${f.responses.length > 0 ? `
          <table class="proof-table" style="margin-bottom:4px">
            <thead><tr><th style="width:40%">Item</th><th>Response</th></tr></thead>
            <tbody>${f.responses.map(r => {
              const isPassFail = r.value === 'Yes' || r.value === 'No' || r.value === 'Pass' || r.value === 'Fail' || r.value === 'N/A';
              const pillStyle = r.value === 'Yes' || r.value === 'Pass' ? 'background:#dcfce7;color:#166534' : r.value === 'No' || r.value === 'Fail' ? 'background:#fee2e2;color:#991b1b' : r.value === 'N/A' ? 'background:#f3f4f6;color:#6b7280' : '';
              return `<tr>
                <td style="font-weight:500">${r.label}</td>
                <td>${isPassFail ? `<span class="status-pill" style="${pillStyle}">${r.value}</span>` : r.value}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>` : '<p style="font-size:10px;color:#888">No responses recorded</p>'}
          ${f.notes ? `<p style="font-size:9px;color:#666;margin:4px 0"><strong>Notes:</strong> ${f.notes}</p>` : ''}
        </div>`;
      }).join('')}
    </div>` : ''}

    <div class="footer">
      <p>Generated by JobRunner &bull; ${formatDate(new Date())}</p>
      <p class="official">This document is an official record of work performed</p>
    </div>
  </div>
</body>
</html>`;
};

export function getSwmsTemplateSettings(business: BusinessSettings | null): { template: DocumentTemplate; accentColor: string } {
  if (!business) {
    return { template: DOCUMENT_TEMPLATES.professional, accentColor: DOCUMENT_ACCENT_COLOR };
  }
  return getTemplateFromBusinessSettings(business);
}

// Convert HTML to actual PDF using Puppeteer
export const generatePDFBuffer = async (html: string): Promise<Buffer> => {
  await acquirePdfSlot();
  try {
    const puppeteer = await import('puppeteer');
    const { execSync } = await import('child_process');
    
    console.log('[PDF] Starting PDF generation...');
    
    let chromiumPath: string | undefined;
    try {
      chromiumPath = execSync('which chromium').toString().trim();
      console.log('[PDF] Found Chromium at:', chromiumPath);
    } catch {
      console.log('[PDF] Chromium not found in PATH, using Puppeteer default');
    }
    
    const browser = await puppeteer.default.launch({
      headless: true,
      executablePath: chromiumPath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--single-process',
      ],
      timeout: 60000,
    });
    
    try {
      console.log('[PDF] Browser launched, creating page...');
      const page = await browser.newPage();
      
      page.setDefaultTimeout(30000);
      
      console.log('[PDF] Setting page content...');
      await page.setContent(html, { 
        waitUntil: 'load',
        timeout: 30000,
      });
      
      // Wait for web fonts (e.g. Google Fonts / Inter) to finish loading before
      // capturing the PDF.  document.fonts.ready resolves once all @font-face
      // sources have either loaded or failed, so we never render with the system
      // fallback font when the real font was just slow.
      try {
        await page.evaluate(() => (document as any).fonts.ready);
      } catch {
        // Older Chromium builds may not support the Font Loading API — fall back
        // to a brief pause so the font still has a chance to arrive.
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      console.log('[PDF] Generating PDF buffer...');
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: false,
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
        timeout: 30000,
      });
      
      console.log('[PDF] PDF generated successfully, size:', pdfBuffer.length);
      return Buffer.from(pdfBuffer);
    } finally {
      console.log('[PDF] Closing browser...');
      await browser.close();
    }
  } catch (error) {
    console.error('[PDF] Failed to generate PDF buffer:', error instanceof Error ? error.message : error);
    throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    releasePdfSlot();
  }
};

// Convert PDF buffer to PNG image (first page only) for template analysis
// Uses pdf.js to render the PDF on a canvas (works in headless Chromium)
export const convertPdfToImage = async (pdfBuffer: Buffer): Promise<Buffer> => {
  await acquirePdfSlot();
  try {
    const puppeteer = await import('puppeteer');
    const { execSync } = await import('child_process');
    
    console.log('[PDF-to-Image] Starting PDF to image conversion using pdf.js...');
    
    let chromiumPath: string | undefined;
    try {
      chromiumPath = execSync('which chromium').toString().trim();
      console.log('[PDF-to-Image] Found Chromium at:', chromiumPath);
    } catch {
      console.log('[PDF-to-Image] Chromium not found in PATH, using Puppeteer default');
    }
    
    const browser = await puppeteer.default.launch({
      headless: true,
      executablePath: chromiumPath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--single-process',
      ],
      timeout: 60000,
    });
    
    try {
      console.log('[PDF-to-Image] Browser launched, creating page...');
      const page = await browser.newPage();
      
      page.setDefaultTimeout(30000);
      
      await page.setViewport({ width: 1200, height: 1700, deviceScaleFactor: 2 });
      
      const base64Pdf = pdfBuffer.toString('base64');
      
      console.log('[PDF-to-Image] Loading pdf.js and rendering PDF...');
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              background: white;
              display: flex;
              justify-content: center;
              align-items: flex-start;
              min-height: 100vh;
              padding: 0;
            }
            #canvas {
              display: block;
            }
          </style>
        </head>
        <body>
          <canvas id="canvas"></canvas>
          <script>
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            
            async function renderPdf() {
              try {
                const pdfData = atob('${base64Pdf}');
                const pdfArray = new Uint8Array(pdfData.length);
                for (let i = 0; i < pdfData.length; i++) {
                  pdfArray[i] = pdfData.charCodeAt(i);
                }
                
                const pdf = await pdfjsLib.getDocument({ data: pdfArray }).promise;
                const page = await pdf.getPage(1);
                
                const scale = 2.0;
                const viewport = page.getViewport({ scale });
                
                const canvas = document.getElementById('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                await page.render({
                  canvasContext: context,
                  viewport: viewport
                }).promise;
                
                console.log('PDF rendered successfully');
                window.pdfRendered = true;
                window.canvasWidth = canvas.width;
                window.canvasHeight = canvas.height;
              } catch (error) {
                console.error('Error rendering PDF:', error);
                window.pdfError = error.message;
              }
            }
            
            renderPdf();
          </script>
        </body>
        </html>
      `;
      
      await page.setContent(html, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      
      console.log('[PDF-to-Image] Waiting for pdf.js to render...');
      try {
        await page.waitForFunction(
          '() => window.pdfRendered === true || window.pdfError', 
          { timeout: 30000 }
        );
      } catch (e) {
        console.error('[PDF-to-Image] Timeout waiting for PDF render');
        throw new Error('PDF rendering timed out');
      }
      
      const pdfError = await page.evaluate(() => (window as any).pdfError);
      if (pdfError) {
        throw new Error(`PDF render error: ${pdfError}`);
      }
      
      const dimensions = await page.evaluate(() => ({
        width: (window as any).canvasWidth,
        height: (window as any).canvasHeight
      }));
      
      console.log('[PDF-to-Image] Canvas dimensions:', dimensions);
      
      const canvasElement = await page.$('#canvas');
      if (!canvasElement) {
        throw new Error('Canvas element not found');
      }
      
      console.log('[PDF-to-Image] Taking screenshot of canvas...');
      const screenshotBuffer = await canvasElement.screenshot({
        type: 'png'
      });
      
      console.log('[PDF-to-Image] Screenshot captured, size:', screenshotBuffer.length, 'bytes');
      return Buffer.from(screenshotBuffer);
    } finally {
      console.log('[PDF-to-Image] Closing browser...');
      await browser.close();
    }
  } catch (error) {
    console.error('[PDF] Failed to generate PDF image:', error instanceof Error ? error.message : error);
    throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    releasePdfSlot();
  }
};

// Subcontractor Invoice PDF Generation
interface SubcontractorInvoicePdfData {
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    docType?: string | null;
    title?: string | null;
    gstEnabled?: boolean | null;
    subtotalAmount: string;
    gstAmount: string;
    totalAmount: string;
    dueDate: Date | string | null;
    validUntil?: Date | string | null;
    notes: string | null;
    createdAt: Date | string | null;
  };
  items: Array<{
    description: string;
    quantity?: string | null;
    unitPrice?: string | null;
    hours: string | null;
    rate: string | null;
    amount: string;
    jobId: string | null;
  }>;
  subcontractor: {
    name: string;
    email: string;
    abn: string | null;
    logoUrl?: string | null;
    brandColor?: string | null;
  };
  business: {
    name: string;
    abn: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
  };
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function generateSubcontractorInvoicePdf(data: SubcontractorInvoicePdfData): Promise<Buffer> {
  const { invoice, items, subcontractor, business } = data;

  const rawBrand = (subcontractor.brandColor || '').trim();
  const brandColor = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(rawBrand) ? rawBrand : '#1e3a5f';
  const logoUrl = await resolveLogoUrl(subcontractor.logoUrl);

  const subtotal = parseFloat(invoice.subtotalAmount);
  const gst = parseFloat(invoice.gstAmount);
  const total = parseFloat(invoice.totalAmount);

  const isQuote = invoice.docType === 'quote';
  const docLabel = isQuote ? 'QUOTE' : 'TAX INVOICE';
  const gstApplied = invoice.gstEnabled !== false;
  const qtyHeader = isQuote ? 'Qty' : 'Qty / Hrs';

  const lineItemRows = items.map(item => {
    // New builder docs carry quantity/unitPrice; legacy docs carry hours/rate.
    const qtyVal = item.quantity != null ? parseFloat(item.quantity) : (item.hours != null ? parseFloat(item.hours) : null);
    const priceVal = item.unitPrice != null ? item.unitPrice : item.rate;
    const qty = qtyVal != null && !isNaN(qtyVal) ? qtyVal.toFixed(2) : '-';
    const price = priceVal != null && priceVal !== '' ? formatCurrency(priceVal) : '-';
    return `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${(item as any).itemCode ? `<div style="font-size: 9px; color: #666; font-family: monospace;">${escapeHtml((item as any).itemCode)}</div>` : ''}${escapeHtml(item.description)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${qty}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${price}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.amount)}</td>
      </tr>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      ${generateGoogleFontsLink()}
      <style>
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #1a1a1a;
          margin: 0;
          padding: 40px;
          font-size: 11px;
          line-height: 1.5;
        }
        .header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 3px solid ${brandColor};
        }
        .header-left .logo {
          max-height: 56px;
          max-width: 200px;
          display: block;
          margin-bottom: 12px;
        }
        .header-left h1 {
          margin: 0;
          font-size: 22px;
          color: ${brandColor};
          font-weight: 700;
        }
        .header-left p {
          margin: 4px 0 0;
          color: #666;
          font-size: 11px;
        }
        .header-right {
          text-align: right;
        }
        .header-right .invoice-label {
          font-size: 28px;
          font-weight: 700;
          color: ${brandColor};
          margin: 0;
        }
        .header-right .invoice-number {
          font-size: 14px;
          color: #666;
          margin: 4px 0 0;
        }
        .parties {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
        }
        .party {
          width: 48%;
        }
        .party h3 {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #999;
          margin: 0 0 8px;
          font-weight: 600;
        }
        .party p {
          margin: 3px 0;
          font-size: 11px;
        }
        .party .name {
          font-weight: 600;
          font-size: 13px;
          color: #1a1a1a;
        }
        .meta-row {
          display: flex;
          gap: 40px;
          margin-bottom: 24px;
          padding: 12px 16px;
          background: #f8f9fa;
          border-radius: 6px;
        }
        .meta-item label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #999;
          display: block;
          margin-bottom: 2px;
        }
        .meta-item span {
          font-weight: 600;
          font-size: 12px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
        }
        th {
          background: ${brandColor};
          color: white;
          padding: 10px 12px;
          text-align: left;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }
        th:nth-child(2), th:nth-child(3), th:nth-child(4) {
          text-align: right;
        }
        th:nth-child(2) { text-align: center; }
        .totals {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 30px;
        }
        .totals-box {
          width: 280px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          font-size: 12px;
        }
        .totals-row.total {
          border-top: 2px solid ${brandColor};
          margin-top: 8px;
          padding-top: 10px;
          font-size: 16px;
          font-weight: 700;
          color: ${brandColor};
        }
        .notes {
          padding: 12px 16px;
          background: #f8f9fa;
          border-radius: 6px;
          margin-bottom: 24px;
        }
        .notes h4 {
          margin: 0 0 6px;
          font-size: 11px;
          font-weight: 600;
        }
        .notes p {
          margin: 0;
          font-size: 11px;
          color: #555;
        }
        .footer {
          margin-top: 40px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #999;
          font-size: 9px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          ${logoUrl ? `<img class="logo" src="${logoUrl}" alt="${escapeHtml(subcontractor.name)}" />` : ''}
          <h1>${escapeHtml(ensureDisplayName(subcontractor.name, 'Subcontractor'))}</h1>
          ${subcontractor.abn ? `<p>ABN: ${escapeHtml(subcontractor.abn)}</p>` : ''}
          ${subcontractor.email ? `<p>${escapeHtml(subcontractor.email)}</p>` : ''}
        </div>
        <div class="header-right">
          <p class="invoice-label">${docLabel}</p>
          <p class="invoice-number">${invoice.invoiceNumber}</p>
          ${invoice.title ? `<p class="invoice-number">${escapeHtml(invoice.title)}</p>` : ''}
        </div>
      </div>

      <div class="parties">
        <div class="party">
          <h3>From</h3>
          <p class="name">${escapeHtml(ensureDisplayName(subcontractor.name, 'Subcontractor'))}</p>
          ${subcontractor.abn ? `<p>ABN: ${escapeHtml(subcontractor.abn)}</p>` : ''}
          ${subcontractor.email ? `<p>${escapeHtml(subcontractor.email)}</p>` : ''}
        </div>
        <div class="party">
          <h3>Bill To</h3>
          <p class="name">${escapeHtml(business.name)}</p>
          ${business.abn ? `<p>ABN: ${escapeHtml(business.abn)}</p>` : ''}
          ${business.address ? `<p>${escapeHtml(business.address)}</p>` : ''}
          ${business.email ? `<p>${escapeHtml(business.email)}</p>` : ''}
          ${business.phone ? `<p>${escapeHtml(business.phone)}</p>` : ''}
        </div>
      </div>

      <div class="meta-row">
        <div class="meta-item">
          <label>${isQuote ? 'Quote Date' : 'Invoice Date'}</label>
          <span>${formatDate(invoice.createdAt)}</span>
        </div>
        <div class="meta-item">
          <label>${isQuote ? 'Valid Until' : 'Due Date'}</label>
          <span>${formatDate(isQuote ? (invoice.validUntil ?? null) : invoice.dueDate)}</span>
        </div>
        <div class="meta-item">
          <label>Status</label>
          <span>${invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>${qtyHeader}</th>
            <th>${isQuote ? 'Unit Price' : 'Rate'}</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemRows}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-box">
          <div class="totals-row">
            <span>Subtotal</span>
            <span>${formatCurrency(subtotal)}</span>
          </div>
          ${gstApplied ? `
          <div class="totals-row">
            <span>GST (10%)</span>
            <span>${formatCurrency(gst)}</span>
          </div>` : ''}
          <div class="totals-row total">
            <span>Total</span>
            <span>${formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      ${invoice.notes ? `
      <div class="notes">
        <h4>Notes</h4>
        <p>${escapeHtml(invoice.notes)}</p>
      </div>
      ` : ''}

      <div class="footer">
        <p>${isQuote
          ? (gstApplied ? 'This is a quote for services. Prices include GST at the Australian standard rate of 10%.' : 'This is a quote for services. GST is not applied.')
          : (gstApplied ? 'This is a tax invoice for services rendered. GST calculated at the Australian standard rate of 10%.' : 'This is an invoice for services rendered. GST is not applied.')}</p>
      </div>
    </body>
    </html>
  `;

  return await generatePDFBuffer(html);
}

// Task #271: Remittance advice (subcontractor) + payslip (payroll) PDF.
export interface RemittancePdfData {
  type: 'remittance' | 'payslip';
  business: {
    name: string;
    abn: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
  };
  payee: {
    name: string;
    abn?: string | null;
    email?: string | null;
  };
  paymentDate: Date | string;
  method: string;
  reference?: string | null;
  notes?: string | null;
  // Subcontractor remittance
  invoiceNumber?: string | null;
  // Payslip
  periodStart?: Date | string | null;
  periodEnd?: Date | string | null;
  // Breakdown rows (label + value). Money rows formatted as AUD.
  lines: Array<{ label: string; value: string | number; isMoney?: boolean }>;
  total: string | number;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  payid: 'PayID',
  cash: 'Cash',
  cheque: 'Cheque',
  card: 'Card',
  other: 'Other',
};

export async function generateRemittancePdf(data: RemittancePdfData): Promise<Buffer> {
  const { type, business, payee, paymentDate, method, reference, notes, invoiceNumber, periodStart, periodEnd, lines, total } = data;

  const isPayslip = type === 'payslip';
  const docLabel = isPayslip ? 'PAYSLIP' : 'REMITTANCE ADVICE';
  const methodLabel = PAYMENT_METHOD_LABELS[method] || method;

  const lineRows = lines.map(line => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(line.label)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${line.isMoney ? formatCurrency(line.value) : escapeHtml(String(line.value))}</td>
    </tr>
  `).join('');

  const metaItems: string[] = [
    `<div class="meta-item"><label>Payment Date</label><span>${formatDate(paymentDate)}</span></div>`,
    `<div class="meta-item"><label>Method</label><span>${escapeHtml(methodLabel)}</span></div>`,
  ];
  if (reference) {
    metaItems.push(`<div class="meta-item"><label>Reference</label><span>${escapeHtml(reference)}</span></div>`);
  }
  if (!isPayslip && invoiceNumber) {
    metaItems.push(`<div class="meta-item"><label>Invoice</label><span>${escapeHtml(invoiceNumber)}</span></div>`);
  }
  if (isPayslip && periodStart && periodEnd) {
    metaItems.push(`<div class="meta-item"><label>Pay Period</label><span>${formatDate(periodStart)} – ${formatDate(periodEnd)}</span></div>`);
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      ${generateGoogleFontsLink()}
      <style>
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #1a1a1a;
          margin: 0;
          padding: 40px;
          font-size: 11px;
          line-height: 1.5;
        }
        .header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 3px solid #1e3a5f;
        }
        .header-left h1 {
          margin: 0;
          font-size: 22px;
          color: #1e3a5f;
          font-weight: 700;
        }
        .header-left p {
          margin: 4px 0 0;
          color: #666;
          font-size: 11px;
        }
        .header-right {
          text-align: right;
        }
        .header-right .doc-label {
          font-size: 24px;
          font-weight: 700;
          color: #1e3a5f;
          margin: 0;
        }
        .parties {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
        }
        .party {
          width: 48%;
        }
        .party h3 {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #999;
          margin: 0 0 8px;
          font-weight: 600;
        }
        .party p {
          margin: 3px 0;
          font-size: 11px;
        }
        .party .name {
          font-weight: 600;
          font-size: 13px;
          color: #1a1a1a;
        }
        .meta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 32px;
          margin-bottom: 24px;
          padding: 12px 16px;
          background: #f8f9fa;
          border-radius: 6px;
        }
        .meta-item label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #999;
          display: block;
          margin-bottom: 2px;
        }
        .meta-item span {
          font-weight: 600;
          font-size: 12px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
        }
        th {
          background: #1e3a5f;
          color: white;
          padding: 10px 12px;
          text-align: left;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }
        th:nth-child(2) { text-align: right; }
        .totals {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 30px;
        }
        .totals-box {
          width: 280px;
        }
        .totals-row.total {
          display: flex;
          justify-content: space-between;
          border-top: 2px solid #1e3a5f;
          padding-top: 10px;
          font-size: 16px;
          font-weight: 700;
          color: #1e3a5f;
        }
        .notes {
          margin-top: 12px;
          padding: 12px 16px;
          background: #f8f9fa;
          border-radius: 6px;
          font-size: 11px;
          color: #444;
        }
        .notes label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #999;
          display: block;
          margin-bottom: 4px;
        }
        .footer {
          margin-top: 40px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
          color: #999;
          font-size: 10px;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          <h1>${escapeHtml(ensureDisplayName(business.name, 'Business'))}</h1>
          ${business.abn ? `<p>ABN: ${escapeHtml(business.abn)}</p>` : ''}
          ${business.address ? `<p>${escapeHtml(business.address)}</p>` : ''}
          ${business.email ? `<p>${escapeHtml(business.email)}</p>` : ''}
          ${business.phone ? `<p>${escapeHtml(business.phone)}</p>` : ''}
        </div>
        <div class="header-right">
          <p class="doc-label">${docLabel}</p>
        </div>
      </div>

      <div class="parties">
        <div class="party">
          <h3>${isPayslip ? 'Employee' : 'Paid To'}</h3>
          <p class="name">${escapeHtml(ensureDisplayName(payee.name, isPayslip ? 'Worker' : 'Subcontractor'))}</p>
          ${payee.abn ? `<p>ABN: ${escapeHtml(payee.abn)}</p>` : ''}
          ${payee.email ? `<p>${escapeHtml(payee.email)}</p>` : ''}
        </div>
      </div>

      <div class="meta-row">
        ${metaItems.join('')}
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineRows}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-box">
          <div class="totals-row total">
            <span>${isPayslip ? 'Net Pay' : 'Total Paid'}</span>
            <span>${formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      ${notes ? `<div class="notes"><label>Notes</label>${escapeHtml(notes)}</div>` : ''}

      <div class="footer">
        ${isPayslip ? 'This payslip confirms payment for the period shown above.' : 'This remittance advice confirms payment of the invoice shown above.'}
      </div>
    </body>
    </html>
  `;

  return await generatePDFBuffer(html);
}

interface JobCardPdfData {
  job: any;
  jobCards: any[];
  submissions: any[];
  businessSettings?: any;
  client?: any;
}

export function generateJobCardHTML(data: JobCardPdfData): string {
  const { job, jobCards, submissions, businessSettings, client } = data;

  const businessName = ensureDisplayName((businessSettings as any)?.businessName || businessSettings?.name, 'Business');
  // Match the Job Proof Pack: same template + accent colour resolution.
  const { template, accentColor } = getTemplateFromBusinessSettings((businessSettings || {}) as { documentTemplate?: string | null; documentTemplateSettings?: unknown });
  const brandColor = accentColor;
  const logoHtml = (businessSettings as any)?.logoUrl
    ? `<img src="${(businessSettings as any).logoUrl}" class="logo" alt="${escapeHtml(businessName)}" />`
    : '';

  const fmtDate = (d: any) => {
    if (!d) return '';
    try { return new Date(d).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return ''; }
  };

  // Strict allowlist so submitted values can't break out of the src attribute
  // (stored XSS guard — this HTML is also rendered in the mobile preview WebView).
  const safeImageSrc = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    return /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : null;
  };

  const renderFieldValue = (field: any, value: any): string => {
    if (value === undefined || value === null || value === '') {
      return '<span style="color:#9ca3af;">—</span>';
    }
    if (field.type === 'photo' || field.type === 'signature') {
      const src = safeImageSrc(value);
      if (src) {
        return `<img src="${src}" style="max-width:280px;max-height:200px;border:1px solid #e5e7eb;border-radius:6px;" />`;
      }
      return '<span style="color:#9ca3af;">—</span>';
    }
    if (field.type === 'checkbox') {
      return value === true || value === 'true' ? 'Yes' : 'No';
    }
    if (Array.isArray(value)) {
      return escapeHtml(value.join(', '));
    }
    return escapeHtml(String(value));
  };

  const renderCard = (card: any): string => {
    const cardSubs = submissions.filter((s: any) => s.formId === card.id);
    const fields = (card.fields as any[]) || [];

    if (cardSubs.length === 0) {
      return `
        <div class="card">
          <div class="card-title">${escapeHtml(card.name)}</div>
          <p style="color:#9ca3af;margin:0;">Not completed</p>
        </div>`;
    }

    const subsHtml = cardSubs.map((sub: any) => {
      const answers = (sub.submissionData || {}) as Record<string, any>;
      const rows = fields.map((field: any) => {
        if (field.type === 'section') {
          return `<tr><td colspan="2" class="section-row">${escapeHtml(field.label)}</td></tr>`;
        }
        return `
          <tr>
            <td class="field-label">${escapeHtml(field.label)}${field.required ? ' *' : ''}</td>
            <td class="field-value">${renderFieldValue(field, answers[field.id])}</td>
          </tr>`;
      }).join('');

      const sig = safeImageSrc(answers['_signature']);
      const sigHtml = sig
        ? `<tr><td class="field-label">Signature</td><td class="field-value"><img src="${sig}" style="max-width:280px;max-height:150px;border:1px solid #e5e7eb;border-radius:6px;" /></td></tr>`
        : '';

      return `
        <div class="card">
          <div class="card-title">${escapeHtml(card.name)}</div>
          <p class="submitted-at">Submitted ${escapeHtml(fmtDate(sub.submittedAt || sub.createdAt))}</p>
          <table class="fields">${rows}${sigHtml}</table>
        </div>`;
    }).join('');

    return subsHtml;
  };

  const cardsHtml = jobCards.length > 0
    ? jobCards.map(renderCard).join('')
    : '<div class="card"><p style="color:#9ca3af;margin:0;">No job cards configured.</p></div>';

  const statusLabelMap: Record<string, string> = { pending: 'Pending', scheduled: 'Scheduled', in_progress: 'In Progress', done: 'Completed', invoiced: 'Invoiced', cancelled: 'Cancelled' };
  const statusColorMap: Record<string, string> = { pending: '#f59e0b', scheduled: '#3b82f6', in_progress: '#8b5cf6', done: '#22c55e', invoiced: '#06b6d4', cancelled: '#ef4444' };
  const jobStatus = String(job.status || '');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: ${template.fontFamily};
            font-size: ${template.baseFontSize};
            font-weight: ${template.bodyWeight};
            line-height: 1.5;
            color: #1a1a1a;
            background: #fff;
          }
          .document { max-width: 800px; margin: 0 auto; padding: 15px 20px; }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16px;
            padding-bottom: 12px;
            ${template.showHeaderDivider ? `border-bottom: ${template.headerBorderWidth} solid ${brandColor};` : 'border-bottom: none;'}
          }
          .company-info { flex: 1; }
          .company-name { font-size: 22px; font-weight: ${template.headingWeight}; color: ${brandColor}; margin-bottom: 4px; }
          .logo { max-width: 140px; max-height: 55px; object-fit: contain; margin-bottom: 8px; }
          .document-type { text-align: right; }
          .document-title { font-size: 24px; font-weight: ${template.headingWeight}; color: ${brandColor}; text-transform: uppercase; letter-spacing: 1.5px; }
          .job-meta { margin-top: 6px; font-size: 11px; color: #555; }
          .job-meta p { margin: 2px 0; }
          .status-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 600; color: white; }
          .info-section { display: flex; justify-content: space-between; margin-bottom: 14px; gap: 20px; }
          .info-block { flex: 1; }
          .info-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 4px; font-weight: 600; }
          .info-value { color: #1a1a1a; line-height: 1.5; font-size: 11px; }
          .card { margin-bottom: 18px; page-break-inside: avoid; }
          .card-title {
            font-size: 14px;
            font-weight: ${template.headingWeight};
            color: ${brandColor};
            margin-bottom: 8px;
            padding-bottom: 4px;
            ${template.id === 'minimal' ? 'border-bottom: 1px solid #e5e7eb;' : `border-bottom: 1px solid ${brandColor}40;`}
          }
          .submitted-at { color: #888; font-size: 10px; margin: 0 0 8px; font-style: italic; }
          table.fields { width: 100%; ${template.id === 'modern' ? 'border-collapse: separate; border-spacing: 0;' : 'border-collapse: collapse;'} margin-bottom: 4px; }
          table.fields td { padding: 6px 8px; font-size: 11px; vertical-align: top; }
          ${template.tableStyle === 'striped' ? `
          table.fields td { border-bottom: none; }
          table.fields tr:nth-child(odd) td { background: #f9fafb; }
          ` : template.tableStyle === 'minimal' ? `
          table.fields td { border-bottom: 1px solid #e5e7eb; }
          ` : `
          table.fields td { border-bottom: 1px solid #eee; }
          `}
          .field-label { width: 40%; color: #666; font-weight: 600; }
          .field-value { width: 60%; }
          .section-row { font-weight: ${template.headingWeight}; background: ${brandColor}10; color: ${brandColor}; padding-top: 10px; }
          .empty-message { color: #888; font-style: italic; padding: 12px; background: ${template.id === 'minimal' ? 'transparent; border: 1px solid #e5e7eb;' : '#f9fafb;'} border-radius: 6px; text-align: center; font-size: 11px; }
          .footer {
            margin-top: 20px;
            padding-top: 12px;
            ${template.id === 'minimal' ? 'border-top: 1px solid #e5e7eb;' : `border-top: 2px solid ${brandColor};`}
            text-align: center;
            color: #888;
            font-size: 10px;
          }
        </style>
      </head>
      <body>
        <div class="document">
          <div class="header">
            <div class="company-info">
              ${logoHtml}
              <div class="company-name">${escapeHtml(businessName)}</div>
            </div>
            <div class="document-type">
              <div class="document-title">Job Card</div>
              <div class="job-meta">
                ${job.number ? `<p>Job #${escapeHtml(String(job.number))}</p>` : ''}
                <p><span class="status-badge" style="background:${statusColorMap[jobStatus] || '#6b7280'}">${escapeHtml(statusLabelMap[jobStatus] || jobStatus)}</span></p>
              </div>
            </div>
          </div>
          <div class="info-section">
            <div class="info-block"><div class="info-label">Job</div><div class="info-value">${escapeHtml(job.title || '')}</div></div>
            ${client ? `<div class="info-block"><div class="info-label">Client</div><div class="info-value">${escapeHtml(ensureDisplayName(client.name, 'Client'))}</div></div>` : ''}
            ${job.address ? `<div class="info-block"><div class="info-label">Address</div><div class="info-value">${escapeHtml(job.address)}</div></div>` : ''}
          </div>
          ${cardsHtml}
          <div class="footer">Generated ${escapeHtml(fmtDate(new Date()))} • ${escapeHtml(businessName)}</div>
        </div>
      </body>
    </html>
  `;
}

// ─── Progress Claim PDF ───────────────────────────────────────────────────────

export function generateProgressClaimPDF(data: {
  claim: any;
  job: any;
  client: any | null;
  business: any | null;
  lineItems: any[];
  summary: {
    contractValueTotal: number;
    previouslyClaimedTotal: number;
    thisClaimTotal: number;
    retentionTotal: number;
    subtotal: number;
    gstAmount: number;
    total: number;
    balanceTotal: number;
  };
  gstEnabled: boolean;
}): string {
  const { claim, job, client, business, lineItems, summary, gstEnabled } = data;

  const rawBrand = (business?.brandColor || business?.primaryColor || '').trim();
  const brandColor = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(rawBrand) ? rawBrand : '#1e3a5f';

  function fmt(v: number | string | null | undefined): string {
    const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0);
    return `$${(isNaN(n) ? 0 : n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function fmtDate(d: Date | string | null | undefined): string {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return String(d); }
  }

  function esc(s: string | null | undefined): string {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const statusLabel: Record<string, string> = {
    draft: 'DRAFT', submitted: 'SUBMITTED', approved: 'APPROVED', paid: 'PAID',
  };
  const statusColors: Record<string, string> = {
    draft: '#6b7280', submitted: '#2563eb', approved: '#16a34a', paid: '#7c3aed',
  };

  const lineRows = lineItems.map((li, i) => {
    const cv = parseFloat(li.contractValue ?? '0');
    const prev = parseFloat(li.previouslyClaimed ?? '0');
    const thisClaim = parseFloat(li.thisClaim ?? '0');
    const balance = cv - prev - thisClaim;
    const cumPct = cv > 0 ? ((prev + thisClaim) / cv * 100).toFixed(1) : '0.0';
    return `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9fafb'}">
        <td style="padding:9px 10px;border-bottom:1px solid #e5e7eb;">${esc(li.description)}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(cv)}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(prev)}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:${brandColor};">${fmt(thisClaim)}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:right;color:#6b7280;">${cumPct}%</td>
        <td style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(parseFloat(li.retentionAmount ?? '0'))}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(balance)}</td>
      </tr>`;
  }).join('');

  const claimStatus = claim.status ?? 'draft';
  const businessName = esc(business?.businessName || 'Your Business');
  const businessAbn = business?.abn ? `ABN: ${esc(business.abn)}` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 36px; font-size: 10.5px; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 18px; border-bottom: 3px solid ${brandColor}; }
    .header-left h2 { margin: 0 0 4px; font-size: 13px; color: #666; letter-spacing: 0.05em; }
    .header-left h1 { margin: 0; font-size: 20px; color: ${brandColor}; font-weight: 700; }
    .header-right { text-align: right; }
    .doc-label { font-size: 24px; font-weight: 800; color: ${brandColor}; margin: 0; }
    .doc-sub { font-size: 12px; color: #555; margin: 4px 0 0; }
    .status-chip { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 10px; font-weight: 700; color: #fff; background: ${statusColors[claimStatus] || '#6b7280'}; margin-top: 6px; letter-spacing: 0.05em; }
    .parties { display: flex; gap: 40px; margin-bottom: 28px; }
    .party h3 { margin: 0 0 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; }
    .party p { margin: 2px 0; }
    .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: #f3f4f6; padding: 14px 16px; border-radius: 8px; margin-bottom: 24px; }
    .meta-item label { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.07em; color: #888; margin-bottom: 2px; }
    .meta-item span { font-weight: 600; }
    .sov-title { font-size: 13px; font-weight: 700; color: ${brandColor}; margin: 0 0 10px; border-left: 3px solid ${brandColor}; padding-left: 8px; }
    table.sov { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 24px; }
    table.sov th { background: ${brandColor}; color: #fff; padding: 9px 10px; text-align: right; font-weight: 600; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.04em; }
    table.sov th:first-child { text-align: left; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 24px; }
    .totals-box { min-width: 300px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e5e7eb; }
    .totals-row.total { font-size: 13px; font-weight: 700; color: ${brandColor}; border-bottom: 2px solid ${brandColor}; }
    .notes { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 14px; margin-bottom: 24px; font-size: 10px; }
    .notes h4 { margin: 0 0 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em; color: #888; }
    .sig-block { display: flex; gap: 40px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; }
    .sig-line { flex: 1; border-top: 1px solid #1a1a1a; padding-top: 6px; font-size: 9px; color: #666; }
    .footer { text-align: center; font-size: 9px; color: #aaa; margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h2>${businessName}</h2>
      <h1>PROGRESS CLAIM</h1>
      ${businessAbn ? `<p style="margin:4px 0 0;color:#666;font-size:10px;">${businessAbn}</p>` : ''}
      ${business?.phone ? `<p style="margin:2px 0 0;color:#666;font-size:10px;">${esc(business.phone)}</p>` : ''}
      ${business?.email ? `<p style="margin:2px 0 0;color:#666;font-size:10px;">${esc(business.email)}</p>` : ''}
    </div>
    <div class="header-right">
      <p class="doc-label">${esc(claim.claimNumber)}</p>
      <p class="doc-sub">Progress Claim</p>
      <span class="status-chip">${statusLabel[claimStatus] || claimStatus.toUpperCase()}</span>
    </div>
  </div>

  <div class="parties">
    <div class="party" style="flex:1">
      <h3>Contractor</h3>
      <p><strong>${businessName}</strong></p>
      ${business?.address ? `<p>${esc(business.address)}</p>` : ''}
      ${businessAbn ? `<p>${businessAbn}</p>` : ''}
    </div>
    <div class="party" style="flex:1">
      <h3>Principal / Client</h3>
      <p><strong>${client ? esc(client.name) : '-'}</strong></p>
      ${client?.email ? `<p>${esc(client.email)}</p>` : ''}
      ${client?.phone ? `<p>${esc(client.phone)}</p>` : ''}
      ${client?.address ? `<p>${esc(client.address)}</p>` : ''}
    </div>
    <div class="party" style="flex:1">
      <h3>Project</h3>
      <p><strong>${esc(job?.title || 'Unnamed Job')}</strong></p>
      ${job?.address ? `<p>${esc(job.address)}</p>` : ''}
      ${job?.number ? `<p>Job #${esc(String(job.number))}</p>` : ''}
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><label>Claim Date</label><span>${fmtDate(claim.claimDate)}</span></div>
    <div class="meta-item"><label>Period From</label><span>${fmtDate(claim.periodStart)}</span></div>
    <div class="meta-item"><label>Period To</label><span>${fmtDate(claim.periodEnd)}</span></div>
    <div class="meta-item"><label>Retention Rate</label><span>${parseFloat(claim.retentionPercent ?? '0').toFixed(1)}%</span></div>
    <div class="meta-item"><label>Retention Held</label><span>${fmt(summary.retentionTotal)}</span></div>
    <div class="meta-item"><label>Balance Remaining</label><span>${fmt(summary.balanceTotal)}</span></div>
  </div>

  <p class="sov-title">Schedule of Values</p>
  <table class="sov">
    <thead>
      <tr>
        <th style="text-align:left;width:35%;">Description / Phase</th>
        <th>Contract Value</th>
        <th>Prev. Claimed</th>
        <th style="background:${brandColor};">This Claim</th>
        <th>Cumulative %</th>
        <th>Retention</th>
        <th>Balance</th>
      </tr>
    </thead>
    <tbody>
      ${lineRows}
      <tr style="background:#f3f4f6;font-weight:700;font-size:10.5px;">
        <td style="padding:10px;border-top:2px solid ${brandColor};">TOTALS</td>
        <td style="padding:10px;text-align:right;border-top:2px solid ${brandColor};">${fmt(summary.contractValueTotal)}</td>
        <td style="padding:10px;text-align:right;border-top:2px solid ${brandColor};">${fmt(summary.previouslyClaimedTotal)}</td>
        <td style="padding:10px;text-align:right;color:${brandColor};border-top:2px solid ${brandColor};">${fmt(summary.thisClaimTotal)}</td>
        <td style="padding:10px;text-align:right;border-top:2px solid ${brandColor};">${summary.contractValueTotal > 0 ? (((summary.previouslyClaimedTotal + summary.thisClaimTotal) / summary.contractValueTotal) * 100).toFixed(1) : '0.0'}%</td>
        <td style="padding:10px;text-align:right;border-top:2px solid ${brandColor};">${fmt(summary.retentionTotal)}</td>
        <td style="padding:10px;text-align:right;border-top:2px solid ${brandColor};">${fmt(summary.balanceTotal)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Gross Claimed</span><span>${fmt(summary.thisClaimTotal)}</span></div>
      <div class="totals-row"><span>Retention Held</span><span>-${fmt(summary.retentionTotal)}</span></div>
      <div class="totals-row"><span>Net Payable</span><span>${fmt(summary.subtotal)}</span></div>
      ${gstEnabled ? `<div class="totals-row"><span>GST (10%)</span><span>${fmt(summary.gstAmount)}</span></div>` : ''}
      <div class="totals-row total"><span>TOTAL DUE</span><span>${fmt(summary.total)}</span></div>
    </div>
  </div>

  ${claim.notes ? `<div class="notes"><h4>Notes</h4><p>${esc(claim.notes)}</p></div>` : ''}

  <div class="sig-block">
    <div>
      <div class="sig-line">Submitted by: ___________________________</div>
      <p style="margin:4px 0 0;font-size:9px;color:#666;">Name &amp; Date</p>
    </div>
    <div>
      <div class="sig-line">Authorised by (Principal): ___________________________</div>
      <p style="margin:4px 0 0;font-size:9px;color:#666;">Name &amp; Date</p>
    </div>
  </div>

  <div class="footer">Generated ${new Date().toLocaleDateString('en-AU')} &bull; ${businessName} &bull; ${esc(claim.claimNumber)}</div>
</body>
</html>`;
}

// ─── Variation Order PDF ───────────────────────────────────────────────────

export function generateVariationOrderPDF(data: {
  variation: any;
  job: any;
  client: any | null;
  business: any | null;
  gstEnabled: boolean;
}): string {
  const { variation, job, client, business, gstEnabled } = data;

  const rawBrand = (business?.brandColor || business?.primaryColor || '').trim();
  const brandColor = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(rawBrand) ? rawBrand : '#1e3a5f';

  function fmt(v: number | string | null | undefined): string {
    const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0);
    return `$${(isNaN(n) ? 0 : n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function fmtDate(d: Date | string | null | undefined): string {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return String(d); }
  }

  function esc(s: string | null | undefined): string {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const statusLabel: Record<string, string> = {
    draft: 'DRAFT', sent: 'SUBMITTED TO CLIENT', approved: 'APPROVED', rejected: 'REJECTED',
  };
  const statusColor: Record<string, string> = {
    draft: '#6b7280', sent: '#2563eb', approved: '#16a34a', rejected: '#dc2626',
  };

  const varStatus = variation.status ?? 'draft';
  const businessName = esc(business?.businessName || 'Your Business');
  const businessAbn = business?.abn ? `ABN: ${esc(business.abn)}` : '';

  const clientName = client
    ? esc(`${(client.firstName || '')} ${(client.lastName || '')}`.trim() || client.businessName || client.name || '')
    : '';
  const clientAddress = esc(client?.address || '');

  const additionalEx = parseFloat(variation.additionalAmount ?? '0');
  const gstAmt = parseFloat(variation.gstAmount ?? '0');
  const total = parseFloat(variation.totalAmount ?? '0');

  const approvalMethodLabel: Record<string, string> = {
    verbal: 'Verbal', email: 'Email', signed: 'Signed document',
  };

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 36px; font-size: 10.5px; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 18px; border-bottom: 3px solid ${brandColor}; }
    .header-left h2 { margin: 0 0 4px; font-size: 13px; color: #666; letter-spacing: 0.05em; }
    .header-left h1 { margin: 0; font-size: 20px; color: ${brandColor}; font-weight: 700; }
    .header-right { text-align: right; }
    .doc-label { font-size: 24px; font-weight: 800; color: ${brandColor}; margin: 0; }
    .doc-sub { font-size: 12px; color: #555; margin: 4px 0 0; }
    .status-chip { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 10px; font-weight: 700; color: #fff; background: ${statusColor[varStatus] || '#6b7280'}; margin-top: 6px; letter-spacing: 0.05em; }
    .parties { display: flex; gap: 40px; margin-bottom: 28px; }
    .party h3 { margin: 0 0 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; }
    .party p { margin: 2px 0; }
    .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: #f3f4f6; padding: 14px 16px; border-radius: 8px; margin-bottom: 24px; }
    .meta-item label { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.07em; color: #888; margin-bottom: 2px; }
    .meta-item span { font-weight: 600; }
    .section-title { font-size: 13px; font-weight: 700; color: ${brandColor}; margin: 0 0 10px; border-left: 3px solid ${brandColor}; padding-left: 8px; }
    .description-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 14px; margin-bottom: 20px; white-space: pre-wrap; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 24px; }
    .totals-box { min-width: 280px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 14px; border-bottom: 1px solid #e5e7eb; }
    .totals-row:last-child { border-bottom: none; }
    .totals-row.total { font-size: 13px; font-weight: 700; color: ${brandColor}; background: #f0f4ff; }
    .approval-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; }
    .approval-box h4 { margin: 0 0 8px; font-size: 11px; font-weight: 700; color: #16a34a; }
    .approval-row { display: flex; gap: 24px; }
    .approval-item label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.07em; color: #6b7280; display: block; margin-bottom: 2px; }
    .approval-item span { font-weight: 600; font-size: 11px; }
    .sig-block { display: flex; gap: 40px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; }
    .sig-area { flex: 1; }
    .sig-area label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.07em; color: #888; display: block; margin-bottom: 48px; }
    .sig-line { border-top: 1px solid #1a1a1a; padding-top: 4px; font-size: 9px; color: #666; }
    .footer { text-align: center; font-size: 9px; color: #aaa; margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h2>${businessName}</h2>
      <h1>VARIATION ORDER</h1>
      ${businessAbn ? `<p style="margin:4px 0 0;color:#666;font-size:10px;">${businessAbn}</p>` : ''}
      ${business?.phone ? `<p style="margin:2px 0 0;color:#666;font-size:10px;">${esc(business.phone)}</p>` : ''}
      ${business?.email ? `<p style="margin:2px 0 0;color:#666;font-size:10px;">${esc(business.email)}</p>` : ''}
    </div>
    <div class="header-right">
      <p class="doc-label">${esc(variation.number)}</p>
      <p class="doc-sub">Variation Order</p>
      <span class="status-chip">${statusLabel[varStatus] || varStatus.toUpperCase()}</span>
    </div>
  </div>

  <div class="parties">
    <div class="party" style="flex:1">
      <h3>Contractor</h3>
      <p><strong>${businessName}</strong></p>
      ${businessAbn ? `<p>${businessAbn}</p>` : ''}
      ${business?.address ? `<p>${esc(business.address)}</p>` : ''}
    </div>
    ${clientName ? `
    <div class="party" style="flex:1">
      <h3>Client</h3>
      <p><strong>${clientName}</strong></p>
      ${clientAddress ? `<p>${clientAddress}</p>` : ''}
      ${client?.email ? `<p>${esc(client.email)}</p>` : ''}
    </div>` : ''}
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <label>Variation No.</label>
      <span>${esc(variation.number)}</span>
    </div>
    <div class="meta-item">
      <label>Job</label>
      <span>${esc(job.title || job.jobNumber || '')}</span>
    </div>
    <div class="meta-item">
      <label>Date</label>
      <span>${fmtDate(variation.createdAt)}</span>
    </div>
  </div>

  <h3 class="section-title">${esc(variation.title)}</h3>

  ${variation.description ? `
  <div class="description-box">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#888;margin-bottom:4px;">Description of Work</div>
    ${esc(variation.description)}
  </div>` : ''}

  ${variation.reason ? `
  <div class="description-box" style="margin-bottom:20px;">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#888;margin-bottom:4px;">Reason for Variation</div>
    ${esc(variation.reason)}
  </div>` : ''}

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row">
        <span>Additional Amount (ex GST)</span>
        <span>${fmt(additionalEx)}</span>
      </div>
      ${gstEnabled ? `
      <div class="totals-row">
        <span>GST (10%)</span>
        <span>${fmt(gstAmt)}</span>
      </div>` : ''}
      <div class="totals-row total">
        <span>Variation Total</span>
        <span>${fmt(total)}</span>
      </div>
    </div>
  </div>

  ${variation.status === 'approved' ? `
  <div class="approval-box">
    <h4>✓ Client Approval Recorded</h4>
    <div class="approval-row">
      ${variation.approvedByName ? `
      <div class="approval-item">
        <label>Approved By</label>
        <span>${esc(variation.approvedByName)}</span>
      </div>` : ''}
      ${variation.approvalMethod ? `
      <div class="approval-item">
        <label>Method</label>
        <span>${esc(approvalMethodLabel[variation.approvalMethod] || variation.approvalMethod)}</span>
      </div>` : ''}
      ${variation.approvedAt ? `
      <div class="approval-item">
        <label>Date</label>
        <span>${fmtDate(variation.approvedAt)}</span>
      </div>` : ''}
      ${variation.approvalContact ? `
      <div class="approval-item">
        <label>Reference</label>
        <span>${esc(variation.approvalContact)}</span>
      </div>` : ''}
    </div>
    ${(() => {
      // SSRF guard: only allow inline data-URI signatures (base64-encoded images).
      // Full-match regex with anchored end: restricts MIME to known safe image types
      // and allows only valid base64 payload characters, preventing quote-injection
      // that would let an attacker break out of the src attribute and add arbitrary HTML.
      const sig = variation.approvedBySignature;
      const SAFE_DATA_URI = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/\r\n]+=*$/;
      const safe = sig && SAFE_DATA_URI.test(sig);
      if (!safe) return '';
      // Extra defense-in-depth: escape double-quotes before interpolating into attribute.
      const escapedSig = sig!.replace(/"/g, '&quot;');
      return `
    <div style="margin-top:12px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#888;margin-bottom:4px;">Client Signature</div>
      <img src="${escapedSig}" style="height:48px;border-bottom:1px solid #16a34a;" alt="Signature" />
    </div>`;
    })()}
  </div>` : `
  <div class="sig-block">
    <div class="sig-area">
      <label>Contractor Authorisation</label>
      <div class="sig-line">Name &amp; signature / date</div>
    </div>
    <div class="sig-area">
      <label>Client Acceptance</label>
      <div class="sig-line">Name &amp; signature / date</div>
    </div>
  </div>`}

  <div class="footer">
    Generated ${new Date().toLocaleDateString('en-AU')} &bull; ${businessName} &bull; Variation ${esc(variation.number)}
  </div>
</body>
</html>`;
}

// ── Purchase Order PDF ─────────────────────────────────────────────────────────

export interface PurchaseOrderPDFData {
  po: {
    poNumber: string;
    orderDate?: Date | string | null;
    requiredDate?: Date | string | null;
    status?: string | null;
    subtotal?: string | null;
    gstAmount?: string | null;
    total?: string | null;
    terms?: string | null;
    notes?: string | null;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
  supplier?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  business: {
    businessName?: string | null;
    logoUrl?: string | null;
    abn?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  job?: {
    number?: string | null;
    title?: string | null;
    address?: string | null;
  } | null;
}

export function generatePurchaseOrderPDF(data: PurchaseOrderPDFData): string {
  const { po, items, supplier, business, job } = data;

  const esc = (v: string | null | undefined) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const fmtDate = (d: Date | string | null | undefined) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return ''; }
  };

  const fmtMoney = (v: string | number | null | undefined) => {
    const n = parseFloat(String(v ?? '0'));
    return isNaN(n) ? '$0.00' : `$${n.toFixed(2)}`;
  };

  const accent = '#2563EB';
  const logoHtml = business.logoUrl
    ? `<img src="${esc(business.logoUrl)}" alt="${esc(business.businessName)}" style="max-height:64px;max-width:160px;object-fit:contain;" />`
    : '';

  const itemRows = items.map(item => `
    <tr>
      <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;">${esc(item.description)}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmtMoney(item.unitPrice)}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmtMoney(item.lineTotal)}</td>
    </tr>`).join('');

  const gst = parseFloat(po.gstAmount ?? '0');
  const subtotal = parseFloat(po.subtotal ?? '0');
  const total = parseFloat(po.total ?? '0');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Purchase Order ${esc(po.poNumber)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #1f2937; background: #fff; padding: 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
    .biz-name { font-size: 20px; font-weight: 700; color: #111; margin-bottom: 4px; }
    .biz-detail { font-size: 12px; color: #6b7280; line-height: 1.6; }
    .po-block { text-align: right; }
    .po-title { font-size: 28px; font-weight: 800; color: ${accent}; letter-spacing: -0.5px; }
    .po-number { font-size: 15px; font-weight: 600; color: #374151; margin-top: 4px; }
    .po-meta { font-size: 12px; color: #6b7280; margin-top: 2px; }
    .divider { border: none; border-top: 2px solid ${accent}; margin: 20px 0; }
    .info-row { display: flex; gap: 32px; margin-bottom: 24px; }
    .info-block { flex: 1; }
    .info-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin-bottom: 6px; }
    .info-value { font-size: 13px; color: #1f2937; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    thead tr { background: ${accent}; color: #fff; }
    thead th { padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; }
    thead th.right { text-align: right; }
    thead th.center { text-align: center; }
    tbody tr:nth-child(even) { background: #f9fafb; }
    .totals { display: flex; justify-content: flex-end; margin-top: 8px; }
    .totals-table { width: 260px; }
    .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; border-bottom: 1px solid #f3f4f6; }
    .totals-row.grand { font-weight: 700; font-size: 15px; border-top: 2px solid #1f2937; border-bottom: none; padding-top: 8px; margin-top: 4px; }
    .notes-block { margin-top: 24px; padding: 14px 16px; background: #f9fafb; border-left: 3px solid ${accent}; border-radius: 4px; font-size: 12px; color: #374151; line-height: 1.6; }
    .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${logoHtml}
      <div class="biz-name">${esc(business.businessName)}</div>
      <div class="biz-detail">
        ${business.abn ? `ABN: ${esc(business.abn)}<br>` : ''}
        ${business.address ? `${esc(business.address)}<br>` : ''}
        ${business.phone ? `${esc(business.phone)}<br>` : ''}
        ${business.email ? `${esc(business.email)}` : ''}
      </div>
    </div>
    <div class="po-block">
      <div class="po-title">PURCHASE ORDER</div>
      <div class="po-number">${esc(po.poNumber)}</div>
      ${po.orderDate ? `<div class="po-meta">Date: ${fmtDate(po.orderDate)}</div>` : ''}
      ${po.requiredDate ? `<div class="po-meta">Required by: ${fmtDate(po.requiredDate)}</div>` : ''}
    </div>
  </div>
  <hr class="divider">

  <div class="info-row">
    <div class="info-block">
      <div class="info-label">Supplier</div>
      <div class="info-value">
        ${supplier?.name ? `<strong>${esc(supplier.name)}</strong><br>` : '<em>No supplier</em>'}
        ${supplier?.address ? `${esc(supplier.address)}<br>` : ''}
        ${supplier?.email ? `${esc(supplier.email)}<br>` : ''}
        ${supplier?.phone ? `${esc(supplier.phone)}` : ''}
      </div>
    </div>
    ${job ? `
    <div class="info-block">
      <div class="info-label">Job Reference</div>
      <div class="info-value">
        ${job.number ? `<strong>#${esc(job.number)}</strong><br>` : ''}
        ${job.title ? `${esc(job.title)}<br>` : ''}
        ${job.address ? `${esc(job.address)}` : ''}
      </div>
    </div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:52%;">Description</th>
        <th class="center" style="width:12%;">Qty</th>
        <th class="right" style="width:18%;">Unit Price</th>
        <th class="right" style="width:18%;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows || '<tr><td colspan="4" style="padding:12px;color:#9ca3af;font-style:italic;">No line items</td></tr>'}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-table">
      ${gst > 0 ? `
      <div class="totals-row"><span>Subtotal</span><span>${fmtMoney(subtotal)}</span></div>
      <div class="totals-row"><span>GST (10%)</span><span>${fmtMoney(gst)}</span></div>
      ` : ''}
      <div class="totals-row grand"><span>Total</span><span>${fmtMoney(total)}</span></div>
    </div>
  </div>

  ${(po.terms || po.notes) ? `
  <div class="notes-block">
    ${po.terms ? `<strong>Terms:</strong> ${esc(po.terms)}<br>` : ''}
    ${po.notes ? `<strong>Notes:</strong> ${esc(po.notes)}` : ''}
  </div>` : ''}

  <div class="footer">
    This purchase order was issued by ${esc(business.businessName)} &bull; Generated ${new Date().toLocaleDateString('en-AU')}
  </div>
</body>
</html>`;
}
