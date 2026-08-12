/**
 * Progress Claims routes — /api/jobs/:jobId/claims
 *
 * A progress claim is a milestone billing document for construction /
 * engineering jobs, with a schedule of values (contract value, cumulative
 * claimed, this claim, retention, balance) that can be pushed to Xero.
 */
import type { Express } from "express";
import { z } from "zod";
import { requireAuth } from "./middleware";
import { getUserContext, ownerOrManagerOnly } from "../permissions";
import { storage } from "../storage";
import * as xeroService from "../xeroService";
import { generateProgressClaimPDF, generatePDFBuffer } from "../pdfService";

// ─── helpers ─────────────────────────────────────────────────────────────────

function num(v: string | null | undefined): number {
  return parseFloat(v ?? "0") || 0;
}

/**
 * Compute schedule-of-values totals from line items and return them together
 * with the balance-remaining for each line.
 */
function buildScheduleOfValues(
  lineItems: Awaited<ReturnType<typeof storage.getClaimLineItems>>,
  retentionPercent: number,
  gstEnabled: boolean,
) {
  let contractValueTotal = 0;
  let previouslyClaimedTotal = 0;
  let thisClaimTotal = 0;
  let retentionTotal = 0;

  const rows = lineItems.map((li) => {
    const cv = num(li.contractValue);
    const prev = num(li.previouslyClaimed);
    const thisClaim = num(li.thisClaim);
    const retention = (thisClaim * (num(li.retentionPercent ?? String(retentionPercent)))) / 100;
    const balance = cv - prev - thisClaim;
    const cumulativePct = cv > 0 ? Math.round(((prev + thisClaim) / cv) * 10000) / 100 : 0;

    contractValueTotal += cv;
    previouslyClaimedTotal += prev;
    thisClaimTotal += thisClaim;
    retentionTotal += retention;

    return { ...li, balance, cumulativePct, retentionAmount: retention };
  });

  const subtotal = thisClaimTotal - retentionTotal;
  const gstAmount = gstEnabled ? subtotal * 0.1 : 0;
  const total = subtotal + gstAmount;
  const balanceTotal = contractValueTotal - previouslyClaimedTotal - thisClaimTotal;

  return {
    rows,
    summary: {
      contractValueTotal,
      previouslyClaimedTotal,
      thisClaimTotal,
      retentionTotal,
      subtotal,
      gstAmount,
      total,
      balanceTotal,
    },
  };
}

// ─── validation schemas ───────────────────────────────────────────────────────

const createClaimSchema = z.object({
  claimNumber: z.string().optional(),
  claimDate: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  retentionPercent: z.string().optional().default("0.00"),
  notes: z.string().optional(),
  lineItems: z
    .array(
      z.object({
        phaseId: z.string().optional(),
        description: z.string().min(1),
        contractValue: z.string().default("0.00"),
        previouslyClaimed: z.string().default("0.00"),
        thisClaim: z.string().default("0.00"),
        retentionPercent: z.string().optional(),
        sortOrder: z.number().optional().default(0),
      }),
    )
    .optional()
    .default([]),
});

const updateClaimSchema = createClaimSchema.partial().omit({ lineItems: true });

const updateLineItemSchema = z.object({
  description: z.string().min(1).optional(),
  contractValue: z.string().optional(),
  previouslyClaimed: z.string().optional(),
  thisClaim: z.string().optional(),
  retentionPercent: z.string().optional(),
  sortOrder: z.number().optional(),
});

// ─── register ─────────────────────────────────────────────────────────────────

export function registerClaimsRoutes(app: Express): void {

  // GET /api/jobs/:jobId/claims — list all claims for a job
  app.get("/api/jobs/:jobId/claims", requireAuth, async (req: any, res) => {
    try {
      const { effectiveUserId } = await getUserContext(req.userId);
      const { jobId } = req.params;
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) return res.status(404).json({ error: "Job not found" });
      const allClaims = await storage.getClaims(jobId, effectiveUserId);
      res.json(allClaims);
    } catch (err: any) {
      console.error("[claims] list error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/jobs/:jobId/claims — create a new claim (with optional line items)
  app.post("/api/jobs/:jobId/claims", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const { effectiveUserId } = await getUserContext(req.userId);
      const { jobId } = req.params;
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) return res.status(404).json({ error: "Job not found" });

      const parsed = createClaimSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      }
      const { lineItems, ...claimData } = parsed.data;

      const claimNumber = claimData.claimNumber || (await storage.getNextClaimNumber(jobId, effectiveUserId));

      const bizSettings = await storage.getBusinessSettings(effectiveUserId);
      const gstEnabled = bizSettings?.gstEnabled ?? false;

      // Build placeholder totals — recalculated after line items created
      const retentionPercent = claimData.retentionPercent ?? "0.00";

      const claim = await storage.createClaim({
        jobId,
        userId: effectiveUserId,
        claimNumber,
        status: "draft",
        claimDate: claimData.claimDate ? new Date(claimData.claimDate) : new Date(),
        periodStart: claimData.periodStart ?? null,
        periodEnd: claimData.periodEnd ?? null,
        retentionPercent,
        notes: claimData.notes ?? null,
        subtotal: "0.00",
        gstAmount: "0.00",
        total: "0.00",
        retentionAmount: "0.00",
      });

      // Create line items
      for (const [idx, li] of lineItems.entries()) {
        await storage.createClaimLineItem({
          claimId: claim.id,
          phaseId: li.phaseId ?? null,
          description: li.description,
          contractValue: li.contractValue,
          previouslyClaimed: li.previouslyClaimed,
          thisClaim: li.thisClaim,
          retentionPercent: li.retentionPercent ?? retentionPercent,
          sortOrder: li.sortOrder ?? idx,
        });
      }

      // Recalculate and persist totals
      const savedItems = await storage.getClaimLineItems(claim.id);
      const { summary } = buildScheduleOfValues(savedItems, num(retentionPercent), gstEnabled);
      await storage.updateClaim(claim.id, effectiveUserId, {
        subtotal: summary.subtotal.toFixed(2),
        gstAmount: summary.gstAmount.toFixed(2),
        total: summary.total.toFixed(2),
        retentionAmount: summary.retentionTotal.toFixed(2),
      });

      const fresh = await storage.getClaim(claim.id, effectiveUserId);
      res.status(201).json({ claim: fresh, lineItems: savedItems });
    } catch (err: any) {
      console.error("[claims] create error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/jobs/:jobId/claims/:claimId — get single claim with line items
  app.get("/api/jobs/:jobId/claims/:claimId", requireAuth, async (req: any, res) => {
    try {
      const { effectiveUserId } = await getUserContext(req.userId);
      const { jobId, claimId } = req.params;
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) return res.status(404).json({ error: "Job not found" });

      const claim = await storage.getClaim(claimId, effectiveUserId);
      if (!claim || claim.jobId !== jobId) return res.status(404).json({ error: "Claim not found" });

      const lineItems = await storage.getClaimLineItems(claimId);
      const bizSettings = await storage.getBusinessSettings(effectiveUserId);
      const gstEnabled = bizSettings?.gstEnabled ?? false;
      const { rows, summary } = buildScheduleOfValues(lineItems, num(claim.retentionPercent), gstEnabled);

      res.json({ claim, lineItems: rows, scheduleOfValues: summary });
    } catch (err: any) {
      console.error("[claims] get error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/jobs/:jobId/claims/:claimId — update claim header fields
  app.patch("/api/jobs/:jobId/claims/:claimId", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const { effectiveUserId } = await getUserContext(req.userId);
      const { jobId, claimId } = req.params;
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) return res.status(404).json({ error: "Job not found" });

      const claim = await storage.getClaim(claimId, effectiveUserId);
      if (!claim || claim.jobId !== jobId) return res.status(404).json({ error: "Claim not found" });
      if (claim.status !== "draft") return res.status(409).json({ error: "Only draft claims can be edited" });

      const parsed = updateClaimSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

      const updated = await storage.updateClaim(claimId, effectiveUserId, {
        ...parsed.data,
        claimDate: parsed.data.claimDate ? new Date(parsed.data.claimDate) : undefined,
      } as any);

      // Recalculate totals
      const items = await storage.getClaimLineItems(claimId);
      const bizSettings = await storage.getBusinessSettings(effectiveUserId);
      const gstEnabled = bizSettings?.gstEnabled ?? false;
      const { summary } = buildScheduleOfValues(items, num(updated?.retentionPercent ?? claim.retentionPercent), gstEnabled);
      await storage.updateClaim(claimId, effectiveUserId, {
        subtotal: summary.subtotal.toFixed(2),
        gstAmount: summary.gstAmount.toFixed(2),
        total: summary.total.toFixed(2),
        retentionAmount: summary.retentionTotal.toFixed(2),
      });

      const fresh = await storage.getClaim(claimId, effectiveUserId);
      res.json(fresh);
    } catch (err: any) {
      console.error("[claims] update error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/jobs/:jobId/claims/:claimId
  app.delete("/api/jobs/:jobId/claims/:claimId", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const { effectiveUserId } = await getUserContext(req.userId);
      const { jobId, claimId } = req.params;
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) return res.status(404).json({ error: "Job not found" });

      const claim = await storage.getClaim(claimId, effectiveUserId);
      if (!claim || claim.jobId !== jobId) return res.status(404).json({ error: "Claim not found" });
      if (claim.status !== "draft") return res.status(409).json({ error: "Only draft claims can be deleted" });

      await storage.deleteClaim(claimId, effectiveUserId);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[claims] delete error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Line item endpoints ────────────────────────────────────────────────────

  // POST /api/jobs/:jobId/claims/:claimId/line-items
  app.post("/api/jobs/:jobId/claims/:claimId/line-items", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const { effectiveUserId } = await getUserContext(req.userId);
      const { jobId, claimId } = req.params;
      const claim = await storage.getClaim(claimId, effectiveUserId);
      if (!claim || claim.jobId !== jobId) return res.status(404).json({ error: "Claim not found" });
      if (claim.status !== "draft") return res.status(409).json({ error: "Only draft claims can be edited" });

      const schema = z.object({
        phaseId: z.string().optional(),
        description: z.string().min(1),
        contractValue: z.string().default("0.00"),
        previouslyClaimed: z.string().default("0.00"),
        thisClaim: z.string().default("0.00"),
        retentionPercent: z.string().optional(),
        sortOrder: z.number().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

      const existing = await storage.getClaimLineItems(claimId);
      const li = await storage.createClaimLineItem({
        claimId,
        phaseId: parsed.data.phaseId ?? null,
        description: parsed.data.description,
        contractValue: parsed.data.contractValue,
        previouslyClaimed: parsed.data.previouslyClaimed,
        thisClaim: parsed.data.thisClaim,
        retentionPercent: parsed.data.retentionPercent ?? claim.retentionPercent ?? "0.00",
        sortOrder: parsed.data.sortOrder ?? existing.length,
      });

      await recalcClaimTotals(claimId, claim.userId, num(claim.retentionPercent));
      res.status(201).json(li);
    } catch (err: any) {
      console.error("[claims] create line item error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/jobs/:jobId/claims/:claimId/line-items/:lineItemId
  app.patch("/api/jobs/:jobId/claims/:claimId/line-items/:lineItemId", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const { effectiveUserId } = await getUserContext(req.userId);
      const { jobId, claimId, lineItemId } = req.params;
      const claim = await storage.getClaim(claimId, effectiveUserId);
      if (!claim || claim.jobId !== jobId) return res.status(404).json({ error: "Claim not found" });
      if (claim.status !== "draft") return res.status(409).json({ error: "Only draft claims can be edited" });

      const parsed = updateLineItemSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

      // Scope update to this claim to prevent cross-claim tampering
      const updated = await storage.updateClaimLineItem(lineItemId, claimId, parsed.data as any);
      if (!updated) return res.status(404).json({ error: "Line item not found" });

      await recalcClaimTotals(claimId, claim.userId, num(claim.retentionPercent));
      res.json(updated);
    } catch (err: any) {
      console.error("[claims] update line item error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/jobs/:jobId/claims/:claimId/line-items/:lineItemId
  app.delete("/api/jobs/:jobId/claims/:claimId/line-items/:lineItemId", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const { effectiveUserId } = await getUserContext(req.userId);
      const { jobId, claimId, lineItemId } = req.params;
      const claim = await storage.getClaim(claimId, effectiveUserId);
      if (!claim || claim.jobId !== jobId) return res.status(404).json({ error: "Claim not found" });
      if (claim.status !== "draft") return res.status(409).json({ error: "Only draft claims can be edited" });

      // Scope delete to this claim to prevent cross-claim tampering
      await storage.deleteClaimLineItem(lineItemId, claimId);
      await recalcClaimTotals(claimId, claim.userId, num(claim.retentionPercent));
      res.json({ success: true });
    } catch (err: any) {
      console.error("[claims] delete line item error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Status transition endpoints ────────────────────────────────────────────

  // POST /api/jobs/:jobId/claims/:claimId/submit
  app.post("/api/jobs/:jobId/claims/:claimId/submit", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const { effectiveUserId } = await getUserContext(req.userId);
      const { jobId, claimId } = req.params;
      const claim = await storage.getClaim(claimId, effectiveUserId);
      if (!claim || claim.jobId !== jobId) return res.status(404).json({ error: "Claim not found" });
      if (claim.status !== "draft") return res.status(409).json({ error: "Claim is not in draft status" });

      const updated = await storage.updateClaim(claimId, effectiveUserId, {
        status: "submitted",
        submittedAt: new Date(),
      } as any);
      res.json(updated);
    } catch (err: any) {
      console.error("[claims] submit error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/jobs/:jobId/claims/:claimId/approve — approve + push to Xero
  app.post("/api/jobs/:jobId/claims/:claimId/approve", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const { effectiveUserId } = await getUserContext(req.userId);
      const { jobId, claimId } = req.params;
      const claim = await storage.getClaim(claimId, effectiveUserId);
      if (!claim || claim.jobId !== jobId) return res.status(404).json({ error: "Claim not found" });
      if (claim.status !== "submitted") return res.status(409).json({ error: "Claim must be submitted before approval" });

      const approved = await storage.updateClaim(claimId, effectiveUserId, {
        status: "approved",
        approvedAt: new Date(),
      } as any);

      // Push to Xero (best-effort — approval succeeds even if Xero fails)
      let xeroResult: { success: boolean; xeroInvoiceId?: string; error?: string } = { success: false };
      try {
        xeroResult = await pushClaimToXero(claimId, effectiveUserId);
        if (xeroResult.xeroInvoiceId) {
          await storage.updateClaim(claimId, effectiveUserId, {
            xeroInvoiceId: xeroResult.xeroInvoiceId,
            xeroSyncedAt: new Date(),
          } as any);
        }
      } catch (xeroErr) {
        console.error("[claims] Xero push error (non-fatal):", xeroErr);
        xeroResult = { success: false, error: String(xeroErr) };
      }

      const fresh = await storage.getClaim(claimId, effectiveUserId);
      res.json({ claim: fresh, xero: xeroResult });
    } catch (err: any) {
      console.error("[claims] approve error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/jobs/:jobId/claims/:claimId/mark-paid
  app.post("/api/jobs/:jobId/claims/:claimId/mark-paid", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const { effectiveUserId } = await getUserContext(req.userId);
      const { jobId, claimId } = req.params;
      const claim = await storage.getClaim(claimId, effectiveUserId);
      if (!claim || claim.jobId !== jobId) return res.status(404).json({ error: "Claim not found" });
      if (claim.status !== "approved") return res.status(409).json({ error: "Claim must be approved before marking paid" });

      const updated = await storage.updateClaim(claimId, effectiveUserId, {
        status: "paid",
        paidAt: new Date(),
      } as any);
      res.json(updated);
    } catch (err: any) {
      console.error("[claims] mark-paid error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/jobs/:jobId/claims/:claimId/schedule-of-values
  app.get("/api/jobs/:jobId/claims/:claimId/schedule-of-values", requireAuth, async (req: any, res) => {
    try {
      const { effectiveUserId } = await getUserContext(req.userId);
      const { jobId, claimId } = req.params;
      const claim = await storage.getClaim(claimId, effectiveUserId);
      if (!claim || claim.jobId !== jobId) return res.status(404).json({ error: "Claim not found" });

      const lineItems = await storage.getClaimLineItems(claimId);
      const bizSettings = await storage.getBusinessSettings(effectiveUserId);
      const gstEnabled = bizSettings?.gstEnabled ?? false;
      const { rows, summary } = buildScheduleOfValues(lineItems, num(claim.retentionPercent), gstEnabled);
      res.json({ rows, summary });
    } catch (err: any) {
      console.error("[claims] schedule-of-values error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/jobs/:jobId/claims/:claimId/pdf — generate progress claim PDF
  app.get("/api/jobs/:jobId/claims/:claimId/pdf", requireAuth, async (req: any, res) => {
    try {
      const { effectiveUserId } = await getUserContext(req.userId);
      const { jobId, claimId } = req.params;
      const [job, claim, bizSettings] = await Promise.all([
        storage.getJob(jobId, effectiveUserId),
        storage.getClaim(claimId, effectiveUserId),
        storage.getBusinessSettings(effectiveUserId),
      ]);
      if (!job) return res.status(404).json({ error: "Job not found" });
      if (!claim || claim.jobId !== jobId) return res.status(404).json({ error: "Claim not found" });

      const lineItems = await storage.getClaimLineItems(claimId);
      const clients = await storage.getClients(effectiveUserId);
      const client = clients.find((c) => c.id === job.clientId);
      const gstEnabled = bizSettings?.gstEnabled ?? false;
      const { rows, summary } = buildScheduleOfValues(lineItems, num(claim.retentionPercent), gstEnabled);

      const html = generateProgressClaimPDF({
        claim,
        job,
        client: client ?? null,
        business: bizSettings,
        lineItems: rows,
        summary,
        gstEnabled,
      });
      const pdfBuffer = await generatePDFBuffer(html);
      const fileName = `progress-claim-${claim.claimNumber}-${job.title?.replace(/[^a-zA-Z0-9]/g, '-') || jobId}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error("[claims] PDF error:", err);
      res.status(500).json({ error: err.message });
    }
  });
}

// ─── helpers (module-private) ─────────────────────────────────────────────────

async function recalcClaimTotals(claimId: string, userId: string, defaultRetentionPct: number) {
  const [items, bizSettings] = await Promise.all([
    storage.getClaimLineItems(claimId),
    storage.getBusinessSettings(userId),
  ]);
  const gstEnabled = bizSettings?.gstEnabled ?? false;
  const { summary } = buildScheduleOfValues(items, defaultRetentionPct, gstEnabled);
  await storage.updateClaim(claimId, userId, {
    subtotal: summary.subtotal.toFixed(2),
    gstAmount: summary.gstAmount.toFixed(2),
    total: summary.total.toFixed(2),
    retentionAmount: summary.retentionTotal.toFixed(2),
  });
}

async function pushClaimToXero(
  claimId: string,
  userId: string,
): Promise<{ success: boolean; xeroInvoiceId?: string; error?: string }> {
  try {
    const claim = await storage.getClaim(claimId, userId);
    if (!claim) return { success: false, error: "Claim not found" };

    const connection = await (storage as any).getXeroConnection?.(userId);
    if (!connection || connection.status !== "active") return { success: true }; // no Xero — not an error

    // We push the claim as a Xero invoice by delegating to xeroService which
    // already handles token refresh, contact resolution, and error wrapping.
    // Build a minimal "invoice-like" object that syncSingleClaimToXero can use.
    const job = await storage.getJob(claim.jobId, userId);
    if (!job) return { success: false, error: "Job not found" };

    const clients = await storage.getClients(userId);
    const client = clients.find((c) => c.id === job.clientId);
    if (!client) return { success: false, error: "Client not found" };

    const lineItems = await storage.getClaimLineItems(claimId);
    const bizSettings = await storage.getBusinessSettings(userId);
    const salesAccountCode = (bizSettings as any)?.xeroSalesAccountId || (bizSettings as any)?.xeroSalesAccountCode || "200";
    const taxType = (bizSettings as any)?.xeroTaxRateId || (bizSettings as any)?.xeroTaxType || "OUTPUT";

    const result = await xeroService.pushProgressClaimToXero(userId, {
      claim,
      client,
      job,
      lineItems,
      salesAccountCode,
      taxType,
    });
    return result;
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
