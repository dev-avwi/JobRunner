/**
 * costReportService — shared helper that gathers all data needed to build a
 * cost report PDF for a given job.  Extracted from the GET /cost-report route
 * so the submit-claim flow can reuse the same logic without duplication.
 */

import { storage } from "./storage";
import type { CostReportData } from "./pdfService";
import { computeRetentionSummary } from "./routes/retentionSummary";

export async function buildCostReportData(
  jobId: string,
  effectiveUserId: string,
): Promise<CostReportData> {
  const job = await storage.getJob(jobId, effectiveUserId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  // Gather all data in parallel
  const [
    allQuotes,
    invoices,
    allTimeEntries,
    expenses,
    allTeamMembers,
    biz,
  ] = await Promise.all([
    storage.getQuotes(effectiveUserId),
    storage.getInvoices(effectiveUserId),
    storage.getTimeEntries(effectiveUserId, jobId),
    storage.getExpenses(effectiveUserId, { jobId }),
    storage.getTeamMembers(effectiveUserId),
    storage.getBusinessSettings(effectiveUserId),
  ]);

  const jobQuote = allQuotes.find((q: any) => q.jobId === jobId && (q.status === 'accepted' || q.status === 'sent'));
  const quotedAmount = jobQuote ? parseFloat(jobQuote.total || '0') : null;

  const jobInvoices = invoices.filter((inv: any) => inv.jobId === jobId);
  const ISSUED_STATUSES = new Set(['sent', 'overdue', 'paid', 'partial', 'viewed']);
  const totalInvoiced = jobInvoices.reduce((s: number, inv: any) =>
    s + (ISSUED_STATUSES.has(inv.status) ? parseFloat(inv.total || '0') : 0), 0);

  // Variations
  let variationsList: any[] = [];
  let approvedVariationsTotal = 0;
  let pendingVariationsTotal = 0;
  let rejectedVariationsTotal = 0;
  try {
    const vars = await storage.getJobVariations(jobId, effectiveUserId);
    variationsList = vars;
    for (const v of vars) {
      const amt = parseFloat(v.totalAmount || '0');
      if (v.status === 'approved') approvedVariationsTotal += amt;
      else if (v.status === 'sent' || v.status === 'pending') pendingVariationsTotal += amt;
      else if (v.status === 'rejected') rejectedVariationsTotal += amt;
    }
  } catch (_) {}

  // Materials
  let jobMaterials: any[] = [];
  let materialsCost = 0;
  let materialsPrice = 0;
  try {
    jobMaterials = await storage.getJobMaterials(jobId, effectiveUserId);
    materialsCost = jobMaterials.reduce((s: number, m: any) => s + parseFloat(m.totalCost?.toString() || '0'), 0);
    materialsPrice = jobMaterials.reduce((s: number, m: any) => {
      const p = parseFloat(m.totalPrice?.toString() || '0');
      const c = parseFloat(m.totalCost?.toString() || '0');
      return s + (p > 0 ? p : c);
    }, 0);
  } catch (_) {}

  // Purchase orders
  let poItems: any[] = [];
  let poTotal = 0;
  try {
    const pos = await storage.getPurchaseOrdersByJobId(jobId, effectiveUserId);
    poItems = pos.filter((po: any) => po.status !== 'cancelled');
    poTotal = poItems.reduce((s: number, po: any) => s + parseFloat(po.total?.toString() || '0'), 0);
  } catch (_) {}

  // Build subcontractor user ID set from team roles
  const userRolesList = await storage.getUserRoles().catch(() => []);
  const subcontractorRoleIds = new Set(
    userRolesList
      .filter((r: any) => /subcontractor/i.test(r.name || ''))
      .map((r: any) => r.id)
  );
  const subcontractorUserIds = new Set<string>();
  for (const member of allTeamMembers) {
    if (subcontractorRoleIds.has(member.roleId)) {
      if (member.memberId) subcontractorUserIds.add(member.memberId);
      subcontractorUserIds.add(member.id);
    }
  }

  // Classify expenses
  const catOf = (e: any): string =>
    ((e.categoryName || e.description || '') as string).toLowerCase();
  const materialExpenses = expenses.filter((e: any) =>
    /material|supply|supplies|hardware/i.test(catOf(e))
  );
  const subcontractorExpenses = expenses.filter((e: any) =>
    /subcontractor|contractor|labour hire|labor hire/i.test(catOf(e))
  );
  const otherExpenses = expenses.filter((e: any) =>
    !materialExpenses.includes(e) && !subcontractorExpenses.includes(e)
  );

  const subcontractorExpenseCost = subcontractorExpenses.reduce((s: number, e: any) => s + parseFloat(e.amount || '0'), 0);
  const otherExpensesCost = otherExpenses.reduce((s: number, e: any) => s + parseFloat(e.amount || '0'), 0);
  const materialExpensesCost = materialExpenses.reduce((s: number, e: any) => s + parseFloat(e.amount || '0'), 0);
  const totalMaterialsCost = materialsCost + materialExpensesCost;

  // Build worker name map
  const workerNameMap = new Map<string, string>();
  for (const member of allTeamMembers) {
    const displayName = [
      (member as any).firstName,
      (member as any).lastName,
    ].filter(Boolean).join(' ').trim() || (member as any).email || null;
    if (displayName) {
      workerNameMap.set(member.id, displayName);
      if (member.memberId) workerNameMap.set(member.memberId, displayName);
    }
  }

  // Batch look up any unmapped user IDs from time entries
  const completedEntries = allTimeEntries.filter((e: any) => e.endTime);
  const unmappedUserIds = [...new Set<string>(
    completedEntries
      .filter((e: any) => !workerNameMap.has(e.userId))
      .map((e: any) => e.userId as string)
  )];
  for (const uid of unmappedUserIds) {
    try {
      const u = await storage.getUser(uid);
      if (u) {
        const uName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
          || u.email || u.username || null;
        if (uName) workerNameMap.set(uid, uName);
      }
    } catch (_) {}
  }

  const calcHrs = (e: any) =>
    (new Date(e.endTime).getTime() - new Date(e.startTime).getTime()) / 3600000;
  const calcCost = (e: any) =>
    calcHrs(e) * parseFloat(e.hourlyRate?.toString() || '0');

  const labourEntriesForPdf = completedEntries.map((e: any) => ({
    workerName: workerNameMap.get(e.userId) || `Worker (${e.userId.slice(0, 6)})`,
    isSubcontractor: subcontractorUserIds.has(e.userId),
    hours: calcHrs(e),
    cost: calcCost(e),
    date: e.startTime,
  }));

  const totalHours = labourEntriesForPdf.reduce((s: number, e: any) => s + e.hours, 0);
  const labourCostEmployee = labourEntriesForPdf
    .filter((e: any) => !e.isSubcontractor)
    .reduce((s: number, e: any) => s + e.cost, 0);
  const labourCostSub = labourEntriesForPdf
    .filter((e: any) => e.isSubcontractor)
    .reduce((s: number, e: any) => s + e.cost, 0);
  const totalSubcontractorCost = labourCostSub + subcontractorExpenseCost;
  const totalCosts = labourCostEmployee + totalSubcontractorCost + totalMaterialsCost + otherExpensesCost;
  const markupEarned = Math.max(0, materialsPrice - materialsCost);

  // Phase breakdown
  let phaseBreakdown: any[] = [];
  try {
    const phases = await storage.getJobPhases(jobId, effectiveUserId);
    if (phases && phases.length > 0) {
      const windows = phases.map((p: any) => {
        let start = p.scheduledStart ? new Date(p.scheduledStart).getTime() : null;
        let end = p.scheduledEnd ? new Date(p.scheduledEnd).getTime() : null;
        if (start !== null && isNaN(start)) start = null;
        if (end !== null && isNaN(end)) end = null;
        if (end !== null) end += 24 * 60 * 60 * 1000 - 1;
        return { phaseId: p.id, start, end };
      });
      const variationsByPhase = new Map<string, { approvedTotal: number; pendingTotal: number }>();
      for (const v of variationsList) {
        if ((v as any).phaseId && v.status === 'approved') {
          const bucket = variationsByPhase.get((v as any).phaseId) || { approvedTotal: 0, pendingTotal: 0 };
          bucket.approvedTotal += parseFloat(v.totalAmount || '0');
          variationsByPhase.set((v as any).phaseId, bucket);
        } else if ((v as any).phaseId && (v.status === 'sent' || v.status === 'pending')) {
          const bucket = variationsByPhase.get((v as any).phaseId) || { approvedTotal: 0, pendingTotal: 0 };
          bucket.pendingTotal += parseFloat(v.totalAmount || '0');
          variationsByPhase.set((v as any).phaseId, bucket);
        }
      }
      const findPhaseId = (dateVal: any): string | null => {
        if (!dateVal) return null;
        const t = new Date(dateVal).getTime();
        if (isNaN(t)) return null;
        for (const w of windows) {
          if (w.start === null && w.end === null) continue;
          if (w.start !== null && t < w.start) continue;
          if (w.end !== null && t > w.end) continue;
          return w.phaseId;
        }
        return null;
      };
      type PB = { labour: number; subcontractor: number; materials: number; purchaseOrders: number; hours: number };
      const emptyPB = (): PB => ({ labour: 0, subcontractor: 0, materials: 0, purchaseOrders: 0, hours: 0 });
      const buckets = new Map<string, PB>();
      for (const p of phases) buckets.set(p.id, emptyPB());
      const unallocatedBucket: PB = emptyPB();
      const bucketFor = (dateVal: any): PB => {
        const pid = findPhaseId(dateVal);
        return pid ? buckets.get(pid)! : unallocatedBucket;
      };
      for (const e of labourEntriesForPdf) {
        const b = bucketFor(e.date);
        b.hours += e.hours;
        if (e.isSubcontractor) b.subcontractor += e.cost; else b.labour += e.cost;
      }
      for (const m of jobMaterials) {
        bucketFor((m as any).createdAt).materials += parseFloat(m.totalCost?.toString() || '0');
      }
      for (const e of materialExpenses) {
        bucketFor((e as any).expenseDate || (e as any).createdAt).materials += parseFloat(e.amount || '0');
      }
      for (const po of poItems) {
        bucketFor((po as any).orderDate || (po as any).createdAt).purchaseOrders += parseFloat(po.total?.toString() || '0');
      }
      const r2 = (n: number) => Math.round(n * 100) / 100;
      const toPhaseRow = (id: string | null, phaseCode: string | null, name: string, status: string | null, b: PB, p?: any) => {
        const v = id ? variationsByPhase.get(id) : null;
        return {
          id,
          phaseCode,
          name,
          status,
          scheduledStart: p?.scheduledStart || null,
          scheduledEnd: p?.scheduledEnd || null,
          bookedHours: p?.bookedHours ? parseFloat(p.bookedHours.toString()) : null,
          costs: {
            labour: r2(b.labour),
            subcontractor: r2(b.subcontractor),
            materials: r2(b.materials),
            purchaseOrders: r2(b.purchaseOrders),
            total: r2(b.labour + b.subcontractor + b.materials),
          },
          hours: Math.round(b.hours * 10) / 10,
          variations: { approvedTotal: r2(v?.approvedTotal || 0), pendingTotal: r2(v?.pendingTotal || 0) },
        };
      };
      phaseBreakdown = phases
        .filter((p: any) => p.scheduledStart != null || p.scheduledEnd != null)
        .map((p: any) =>
          toPhaseRow(p.id, p.phaseCode || null, p.name, p.status || null, buckets.get(p.id)!, p)
        );
      const hasUnallocated = unallocatedBucket.labour > 0 || unallocatedBucket.subcontractor > 0
        || unallocatedBucket.materials > 0 || unallocatedBucket.purchaseOrders > 0;
      if (hasUnallocated) {
        phaseBreakdown.push(toPhaseRow(null, null, 'Unallocated (outside phase windows)', null, unallocatedBucket));
      }
    }
  } catch (_) {}

  const budgetedCost = (job as any).budgetedCost
    ? parseFloat((job as any).budgetedCost.toString())
    : null;

  const bizName = (biz as any)?.businessName || 'Business';
  const bizABN = (biz as any)?.abn || null;
  const bizPhone = (biz as any)?.phone || null;
  const bizEmail = (biz as any)?.email || null;
  const bizAddress = (biz as any)?.address || null;

  // Client info
  let clientName: string | null = null;
  let clientPhone: string | null = null;
  let clientEmail: string | null = null;
  try {
    if ((job as any).clientId) {
      const client = await storage.getClient((job as any).clientId, effectiveUserId);
      if (client) {
        clientName = (client as any).name || (client as any).companyName || null;
        clientPhone = (client as any).phone || null;
        clientEmail = (client as any).email || null;
      }
    }
  } catch (_) {}

  // Business logo
  let businessLogoUrl: string | undefined;
  try {
    const { resolveBusinessLogoForPdf } = await import('./pdfService');
    businessLogoUrl = await resolveBusinessLogoForPdf(biz);
  } catch (_) {}

  const revisedContractValue = quotedAmount !== null
    ? quotedAmount + approvedVariationsTotal
    : null;
  const grossProfit = totalInvoiced - totalCosts;
  const grossMargin = totalInvoiced > 0 ? (grossProfit / totalInvoiced) * 100 : 0;

  // Retention schedule — only included when retention has been withheld
  let retention: CostReportData['retention'] = null;
  try {
    const allClaims = await storage.getClaims(jobId, effectiveUserId);
    const rs = computeRetentionSummary(allClaims as any, {
      practicalCompletionDate: (job as any).practicalCompletionDate || null,
      defectsLiabilityMonths: (job as any).defectsLiabilityMonths ?? null,
    });
    retention = rs.sumRetentionHeld > 0 ? rs : null;
  } catch (_) {}

  return {
    job: {
      id: jobId,
      title: (job as any).title,
      number: (job as any).jobNumber || (job as any).prefix || null,
      status: (job as any).status || 'active',
      address: (job as any).address || (job as any).siteAddress || null,
      scheduledAt: (job as any).scheduledAt || null,
      startedAt: (job as any).startedAt || null,
      completedAt: (job as any).completedAt || null,
      jobType: (job as any).jobType || null,
      budgetedCost,
      description: (job as any).description || null,
    },
    business: {
      businessName: bizName,
      abn: bizABN,
      phone: bizPhone,
      email: bizEmail,
      address: bizAddress,
      logoUrl: businessLogoUrl,
    },
    client: clientName ? { name: clientName, phone: clientPhone, email: clientEmail } : null,
    quote: quotedAmount !== null
      ? {
          number: jobQuote?.number || null,
          total: quotedAmount,
          revisedContractValue: revisedContractValue ?? quotedAmount,
        }
      : null,
    phases: phaseBreakdown,
    variations: variationsList.map((v: any) => ({
      number: v.number || v.id?.slice(0, 8) || '',
      title: v.title || 'Untitled Variation',
      status: v.status || 'draft',
      reason: v.reason || null,
      sentAt: v.sentAt || null,
      approvedAt: v.approvedAt || null,
      rejectedAt: v.rejectedAt || null,
      rejectionReason: v.rejectionReason || null,
      approvedByName: v.approvedByName || null,
      phaseId: (v as any).phaseId || null,
      totalAmount: parseFloat(v.totalAmount || '0'),
    })),
    labourEntries: [
      ...labourEntriesForPdf,
      ...subcontractorExpenses.map((e: any) => ({
        workerName: e.vendor || e.description || e.categoryName || 'Subcontractor',
        isSubcontractor: true,
        hours: 0,
        cost: parseFloat(e.amount || '0'),
        date: e.expenseDate || e.createdAt || null,
      })),
    ],
    materials: [
      ...jobMaterials.map((m: any) => {
        const qty = parseFloat(String(m.quantity ?? 1)) || 1;
        const tc = parseFloat(m.totalCost?.toString() || '0');
        return {
          name: m.name || 'Unnamed',
          quantity: qty,
          unitCost: qty > 0 ? tc / qty : 0,
          totalCost: tc,
          totalPrice: parseFloat(m.totalPrice?.toString() || '0'),
          markupPercent: m.markupPercent ?? null,
          supplier: m.supplier || null,
        };
      }),
      ...materialExpenses.map((e: any) => ({
        name: e.description || e.categoryName || 'Material Expense',
        quantity: 1,
        unitCost: parseFloat(e.amount || '0'),
        totalCost: parseFloat(e.amount || '0'),
        totalPrice: parseFloat(e.amount || '0'),
        markupPercent: null,
        supplier: e.vendor || null,
      })),
    ],
    purchaseOrders: poItems.map((po: any) => ({
      poNumber: po.poNumber || po.id?.slice(0, 8) || '',
      supplierName: po.supplierName || 'Unknown Supplier',
      orderDate: po.orderDate || po.createdAt || null,
      status: po.status || 'draft',
      total: parseFloat(po.total?.toString() || '0'),
    })),
    financial: {
      contractValue: quotedAmount,
      approvedVariationsTotal,
      pendingVariationsTotal,
      rejectedVariationsTotal,
      revisedContractValue,
      invoicedRevenue: totalInvoiced,
      labourCost: labourCostEmployee,
      subcontractorCost: totalSubcontractorCost,
      materialsCost: totalMaterialsCost,
      materialsSellPrice: materialsPrice + materialExpensesCost,
      markupEarned,
      otherExpenses: otherExpensesCost,
      purchaseOrdersTotal: poTotal,
      totalCosts,
      grossProfit,
      grossMargin,
      budgetedCost,
      budgetVariance: budgetedCost !== null ? totalCosts - budgetedCost : null,
    },
    hours: {
      total: totalHours,
      estimated: phaseBreakdown.reduce((s: number, p: any) => s + (p.bookedHours || 0), 0),
      billable: labourEntriesForPdf
        .filter((e: any) => !e.isSubcontractor)
        .reduce((s: number, e: any) => s + e.hours, 0),
    },
    exportedAt: new Date().toISOString(),
    retention,
  };
}
