/**
 * Progress Claims routes — /api/jobs/:jobId/claims
 *
 * A progress claim is a milestone billing document for construction /
 * engineering jobs, with a schedule of values (contract value, cumulative
 * claimed, this claim, retention, balance) that can be pushed to Xero.
 */
import type { Express } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { requireAuth } from "./middleware";
import { getUserContext, ownerOrManagerOnly } from "../permissions";
import { storage, db } from "../storage";
import * as xeroService from "../xeroService";
import { generateProgressClaimPDF, generatePDFBuffer, generateCostReportPDF } from "../pdfService";
import { computeRetentionSummary } from "./retentionSummary";
import { sendProgressClaimSubmittedEmail } from "../emailService";
import { getProductionBaseUrl } from "../urlHelper";
import { ObjectStorageService } from "../objectStorage";
import { buildCostReportData } from "../costReportService";

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
  retentionPercent: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z
    .array(
      z.object({
        phaseId: z.string().optional(),
        variationId: z.string().optional(),
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
      let { lineItems, ...claimData } = parsed.data;

      const claimNumber = claimData.claimNumber || (await storage.getNextClaimNumber(jobId, effectiveUserId));

      const bizSettings = await storage.getBusinessSettings(effectiveUserId);
      const gstEnabled = bizSettings?.gstEnabled ?? false;
      // A project-level rate is the contract default. Individual claims can still
      // override it when a particular stage has different retention terms.
      let retentionPercent = claimData.retentionPercent ?? (job as any).retentionPercent ?? "0.00";

      // ── Retention-release: eligibility + duplicate guard ─────────────────────
      // All reads happen before any write so no orphan claim is created on rejection.
      const isRetentionRelease = (claimData.notes ?? "").trim().toLowerCase() === "retention release";
      if (isRetentionRelease) {
        // 0. Project-type guard — retention release is only meaningful on project
        //    jobs. Service jobs may accrue retentionAmount if a non-zero retention %
        //    was set, but the full release flow is project-scoped only.
        if ((job as any).jobType !== "project") {
          return res.status(403).json({
            error: "Retention Release claims can only be created for project-type jobs",
          });
        }

        const existingClaims = await storage.getClaims(jobId, effectiveUserId);

        // 1. Duplicate check — application-level fast path (DB unique index is
        //    the true atomic backstop for concurrent requests).
        const conflicting = existingClaims.find(
          (c: any) =>
            (c.notes ?? "").trim().toLowerCase() === "retention release" &&
            (c.status === "draft" || c.status === "submitted" || c.status === "approved" || c.status === "paid"),
        );
        if (conflicting) {
          return res.status(409).json({
            error: "A Retention Release claim already exists for this job",
            existingClaimId: conflicting.id,
            existingStatus: conflicting.status,
          });
        }

        // 2. Practical-completion eligibility. The DLP remains visible in the
        //    ledger as a contract milestone, but this release claim is available
        //    once practical completion has been recorded.
        const summary = computeRetentionSummary(existingClaims as any, {
          practicalCompletionDate: (job as any).practicalCompletionDate || null,
          defectsLiabilityMonths: (job as any).defectsLiabilityMonths ?? null,
        });
        if (summary.retentionStatus === "pre_pc") {
          return res.status(403).json({
            error: "Retention cannot be released before practical completion is reached",
            retentionStatus: summary.retentionStatus,
            releaseDate: summary.releaseDate,
          });
        }

        if (summary.outstandingRetention <= 0) {
          return res.status(409).json({
            error: "There is no outstanding retention available to release",
            retentionStatus: summary.retentionStatus,
          });
        }

        // The outstanding ledger balance is authoritative. Never accept a
        // client-supplied release figure because it could overpay the contract.
        const releaseAmount = summary.outstandingRetention.toFixed(2);
        retentionPercent = "0.00";
        lineItems = [{
          description: "Retention Release",
          contractValue: releaseAmount,
          previouslyClaimed: "0.00",
          thisClaim: releaseAmount,
          retentionPercent: "0.00",
          sortOrder: 0,
        }];
      }
      // ────────────────────────────────────────────────────────────────────────

      // ── Variation pre-flight validation (all reads, no writes yet) ──────────
      // Validate BEFORE creating anything so no orphan claim is left on rejection.
      const variationLineItems = lineItems.filter((li) => (li as any).variationId);
      if (variationLineItems.length > 0) {
        // Check for duplicates within this request
        const requestVariationIds = variationLineItems.map((li) => (li as any).variationId as string);
        const uniqueRequestIds = new Set(requestVariationIds);
        if (uniqueRequestIds.size !== requestVariationIds.length) {
          return res.status(400).json({ error: "Duplicate variation IDs within the same claim are not allowed" });
        }

        const allJobVariations = await storage.getJobVariations(jobId, effectiveUserId);
        const approvedVariationMap = new Map(
          allJobVariations.filter((v: any) => v.status === 'approved').map((v: any) => [v.id, v]),
        );

        // Collect variation IDs already on any existing claim for this job
        const existingClaims = await storage.getClaims(jobId, effectiveUserId);
        const alreadyClaimedIds = new Set<string>();
        for (const c of existingClaims) {
          const lis = await storage.getClaimLineItems(c.id);
          for (const li of lis) if ((li as any).variationId) alreadyClaimedIds.add((li as any).variationId);
        }

        for (const vId of requestVariationIds) {
          if (!approvedVariationMap.has(vId)) {
            return res.status(400).json({ error: `Variation ${vId} is not found, not approved, or does not belong to this job` });
          }
          if (alreadyClaimedIds.has(vId)) {
            return res.status(409).json({ error: `Variation ${vId} has already been included in another claim` });
          }
        }
      }
      // ────────────────────────────────────────────────────────────────────────

      // Create the claim header. The outer try/catch below converts postgres
      // error 23505 (unique-index violation from the DB-level duplicate guard)
      // to a 409 so concurrent requests can't both create a Retention Release.
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

      // Create line items — if any insert fails (e.g. a concurrent race fires the
      // unique index on variation_id), clean up the orphan claim and return 409.
      try {
        for (const [idx, li] of lineItems.entries()) {
          await storage.createClaimLineItem({
            claimId: claim.id,
            phaseId: li.phaseId ?? null,
            variationId: (li as any).variationId ?? null,
            description: li.description,
            contractValue: li.contractValue,
            previouslyClaimed: li.previouslyClaimed,
            thisClaim: li.thisClaim,
            // Treat blank strings as absent — the wizard submits "" for variation
            // line items when the user has not overridden the claim-level rate.
            // `??` alone cannot catch "" because it is not nullish, so we use
            // `||` which treats both "" and null/undefined as "use the default".
            retentionPercent: li.retentionPercent?.trim() || retentionPercent,
            sortOrder: li.sortOrder ?? idx,
          });
        }
      } catch (liErr: any) {
        // Roll back orphan claim on line item failure
        await storage.deleteClaim?.(claim.id, effectiveUserId).catch(() => {});
        const isUniqueViolation = liErr?.code === '23505';
        return res.status(isUniqueViolation ? 409 : 500).json({
          error: isUniqueViolation
            ? "A variation in this claim was already claimed by a concurrent request"
            : "Failed to create claim line items",
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
      // DB unique-index violation (23505) — concurrent request won the race to
      // create a Retention Release claim; return 409 instead of 500.
      // DB unique-index violation on the retention-release guard index.
      // PostgreSQL exposes the violated constraint name in err.constraint (not
      // err.detail), so we match on that to avoid false-positives from other
      // 23505 violations in the same handler (e.g. variation uniqueness).
      if (
        err?.code === "23505" &&
        err?.constraint === "idx_claims_one_retention_release_active"
      ) {
        return res.status(409).json({
          error: "A Retention Release claim already exists for this job (concurrent request)",
        });
      }
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

      // ── Fire-and-forget: generate cost report PDF + notify client ───────────
      // Both tasks run after the response is sent so latency never blocks the caller.
      (async () => {
        // 1. Generate cost report PDF and store it alongside the claim
        try {
          const reportData = await buildCostReportData(jobId, effectiveUserId);
          const html = generateCostReportPDF(reportData);
          const pdfBuffer = await generatePDFBuffer(html);
          const claimNum = ((updated as any)?.claimNumber || claim.claimNumber || claimId).replace(/[^a-z0-9-]/gi, '-');
          const fileName = `claim-cost-reports/${effectiveUserId}/${jobId}/cost-report-${claimNum}.pdf`;
          const objectService = new ObjectStorageService();
          const objectUrl = await objectService.uploadFile(fileName, pdfBuffer, 'application/pdf');
          await storage.updateClaim(claimId, effectiveUserId, { costReportUrl: objectUrl } as any);
          console.info(`[claims] cost report attached for claim ${claimId}`);
        } catch (pdfErr: any) {
          // Non-fatal — a missing cost report never blocks the submitted claim
          console.error("[claims] cost report generation error:", pdfErr?.message || pdfErr);
        }

        // 2. Notify client via email if portal is configured, attaching claim PDF
        try {
          const portalToken = await storage.getActiveJobPortalToken(jobId);
          if (!portalToken) return;
          if (!portalToken.showFinancialsOnPortal) return;

          const job = await storage.getJob(jobId, effectiveUserId);
          if (!job || !(job as any).clientId) return;

          const client = await storage.getClient((job as any).clientId, effectiveUserId);
          if (!client || !(client as any).email) return;

          const bizSettings = await storage.getBusinessSettings(effectiveUserId);
          const businessName = bizSettings?.businessName || null;

          const baseUrl = getProductionBaseUrl();
          const portalUrl = `${baseUrl}/p/${portalToken.token}`;

          // Generate progress claim PDF for direct attachment
          let claimPdfBuffer: Buffer | undefined;
          let claimPdfFilename: string | undefined;
          try {
            const freshClaim = await storage.getClaim(claimId, effectiveUserId);
            const lineItems = await storage.getClaimLineItems(claimId);
            const clients = await storage.getClients(effectiveUserId);
            const clientForPdf = clients.find((c) => c.id === (job as any).clientId);
            const gstEnabled = bizSettings?.gstEnabled ?? false;
            const { rows, summary } = buildScheduleOfValues(lineItems, num(freshClaim?.retentionPercent), gstEnabled);
            const claimHtml = generateProgressClaimPDF({
              claim: freshClaim ?? claim,
              job,
              client: clientForPdf ?? null,
              business: bizSettings,
              lineItems: rows,
              summary,
              gstEnabled,
            });
            claimPdfBuffer = await generatePDFBuffer(claimHtml);
            const claimRef = ((updated as any)?.claimNumber || claim.claimNumber || claimId).replace(/[^a-z0-9-]/gi, '-');
            claimPdfFilename = `progress-claim-${claimRef}.pdf`;
          } catch (pdfGenErr: any) {
            console.error("[claims] claim PDF generation for email failed:", pdfGenErr?.message || pdfGenErr);
            // Non-fatal — email still sends without attachment
          }

          await sendProgressClaimSubmittedEmail({
            clientEmail: (client as any).email,
            clientName: (client as any).name || null,
            businessName,
            claimNumber: (updated as any)?.claimNumber || claim.claimNumber || null,
            periodStart: (updated as any)?.periodStart
              ? String((updated as any).periodStart)
              : claim.periodStart
              ? String(claim.periodStart)
              : null,
            periodEnd: (updated as any)?.periodEnd
              ? String((updated as any).periodEnd)
              : claim.periodEnd
              ? String(claim.periodEnd)
              : null,
            totalAmount: parseFloat((updated as any)?.total ?? claim.total ?? '0') || 0,
            portalUrl,
            jobTitle: (job as any).title || null,
            pdfBuffer: claimPdfBuffer,
            pdfFilename: claimPdfFilename,
          });
        } catch (emailErr: any) {
          console.error("[claims] submit email error:", emailErr?.message || emailErr);
        }
      })();
      // ────────────────────────────────────────────────────────────────────────
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

      // Push to Xero using the same atomic slot mechanism as the manual push-xero route.
      // Approval succeeds even if Xero fails; failures are persisted so the sync chip shows retry.
      let xeroResult: { success: boolean; xeroInvoiceId?: string; error?: string } = { success: false };
      try {
        // Acquire sync slot atomically — skip if already synced or a manual push is in progress
        const approvalSlot = await db.execute(sql`
          UPDATE claims
          SET xero_sync_error = '__SYNCING__'
          WHERE id = ${claimId}
            AND xero_invoice_id IS NULL
            AND (xero_sync_error IS NULL OR xero_sync_error NOT IN ('__SYNCING__'))
          RETURNING id
        `);
        if ((approvalSlot.rows ?? []).length === 0) {
          // Already synced or manual push in progress — skip silently
          xeroResult = { success: true };
        } else {
          // Slot acquired — always release in finally
          try {
            xeroResult = await pushClaimToXero(claimId, effectiveUserId);
            if (xeroResult.xeroInvoiceId) {
              await db.execute(sql`UPDATE claims SET xero_invoice_id = ${xeroResult.xeroInvoiceId}, xero_synced_at = NOW(), xero_sync_error = NULL WHERE id = ${claimId}`);
            } else if (!xeroResult.success && xeroResult.error) {
              await db.execute(sql`UPDATE claims SET xero_sync_error = ${xeroResult.error} WHERE id = ${claimId}`);
            } else {
              await db.execute(sql`UPDATE claims SET xero_sync_error = NULL WHERE id = ${claimId}`);
            }
          } catch (pushErr: any) {
            const errMsg = String(pushErr?.message ?? pushErr);
            xeroResult = { success: false, error: errMsg };
            await db.execute(sql`UPDATE claims SET xero_sync_error = ${errMsg} WHERE id = ${claimId}`).catch(() => {});
          }
        }
      } catch (xeroErr) {
        console.error("[claims] Xero push error (non-fatal):", xeroErr);
        xeroResult = { success: false, error: String(xeroErr) };
      }

      // Auto-advance linked phases from "complete" → "invoiced"
      try {
        const lineItems = await storage.getClaimLineItems(claimId);
        const phaseIds = [...new Set(
          lineItems.map((li: any) => li.phaseId).filter(Boolean) as string[],
        )];
        if (phaseIds.length > 0) {
          const phases = await storage.getJobPhases(jobId, effectiveUserId);
          for (const phase of phases) {
            if (phaseIds.includes(phase.id) && (phase as any).status === "complete") {
              await storage.updateJobPhase(phase.id, jobId, effectiveUserId, {
                status: "invoiced",
              } as any);
            }
          }
        }
      } catch (phaseErr) {
        console.error("[claims] phase auto-advance error (non-fatal):", phaseErr);
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

      // Include approved variations so the frontend can display the revised contract total.
      // IMPORTANT: the current claim's line items may already include variation-sourced rows
      // (identified by variationId). Those rows already contribute to summary.contractValueTotal.
      // To avoid double-counting, only add approved variations that are NOT yet represented
      // as a line item on any claim for this job.
      let approvedVariations: any[] = [];
      let approvedVariationsTotal = 0;      // total of ALL approved variations (informational)
      let unclaimedVariationsTotal = 0;     // only those not yet in any claim line item
      try {
        // Collect variation IDs already present on any claim line item across this job
        const allClaims = await storage.getClaims(jobId, effectiveUserId);
        const claimedVariationIds = new Set<string>();
        for (const c of allClaims) {
          const lis = await storage.getClaimLineItems(c.id);
          for (const li of lis) {
            if ((li as any).variationId) claimedVariationIds.add((li as any).variationId);
          }
        }

        const allVariations = await storage.getJobVariations(jobId, effectiveUserId);
        approvedVariations = allVariations
          .filter((v: any) => v.status === 'approved')
          .map((v: any) => ({
            id: v.id,
            number: v.number,
            title: v.title,
            totalAmount: v.totalAmount,
            additionalAmount: v.additionalAmount,   // ex-GST — needed for revisedContractTotal
            approvedAt: v.approvedAt,
            approvedByName: v.approvedByName,
            approvalMethod: v.approvalMethod,
            alreadyClaimed: claimedVariationIds.has(v.id),
          }));
        approvedVariationsTotal = approvedVariations.reduce(
          (s: number, v: any) => s + parseFloat(v.totalAmount || '0'), 0,
        );
        // revisedContractTotal = contractValueTotal (includes claimed variation line items)
        //                      + unclaimed approved variations (not yet in any line item)
        // Use additionalAmount (ex-GST) for the revised contract total because the
        // SOV applies GST separately via buildScheduleOfValues. totalAmount is inc-GST
        // and would cause double-counting when gstEnabled is true.
        unclaimedVariationsTotal = approvedVariations
          .filter((v: any) => !v.alreadyClaimed)
          .reduce((s: number, v: any) => s + parseFloat(v.additionalAmount || v.totalAmount || '0'), 0);
      } catch (_) {}

      res.json({
        rows,
        summary: {
          ...summary,
          approvedVariationsTotal: Math.round(approvedVariationsTotal * 100) / 100,
          // revisedContractTotal correctly avoids double-counting variations
          // already present as line items in contractValueTotal
          revisedContractTotal: Math.round((summary.contractValueTotal + unclaimedVariationsTotal) * 100) / 100,
        },
        approvedVariations,
      });
    } catch (err: any) {
      console.error("[claims] schedule-of-values error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/jobs/:jobId/variations/approved-for-claim — returns approved variations as suggested claim line items.
  // Excludes variations that have already been added to any existing claim line item for this job,
  // preventing duplicate billing across claims.
  app.get("/api/jobs/:jobId/variations/approved-for-claim", requireAuth, async (req: any, res) => {
    try {
      const { effectiveUserId } = await getUserContext(req.userId);
      const { jobId } = req.params;
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) return res.status(404).json({ error: "Job not found" });

      // Find variation IDs already present on any claim line item for this job
      const existingClaims = await storage.getClaims(jobId, effectiveUserId);
      const alreadyClaimedVariationIds = new Set<string>();
      for (const claim of existingClaims) {
        const lineItems = await storage.getClaimLineItems(claim.id);
        for (const li of lineItems) {
          if ((li as any).variationId) {
            alreadyClaimedVariationIds.add((li as any).variationId);
          }
        }
      }

      const allVariations = await storage.getJobVariations(jobId, effectiveUserId);
      const available = allVariations
        .filter((v: any) => v.status === 'approved' && !alreadyClaimedVariationIds.has(v.id))
        .map((v: any) => ({
          id: v.id,
          number: v.number,
          title: v.title,
          description: v.description,
          totalAmount: v.totalAmount,
          additionalAmount: v.additionalAmount,
          approvedAt: v.approvedAt,
          approvedByName: v.approvedByName,
          // Pre-filled values for use as claim line items.
          // contractValue uses additionalAmount (ex-GST) because the SOV calculation
          // applies GST separately — using totalAmount (inc. GST) would double-count GST.
          suggestedLineItem: {
            description: `Variation ${v.number}: ${v.title}`,
            contractValue: v.additionalAmount,
            previouslyClaimed: "0.00",
            thisClaim: v.additionalAmount,
          },
        }));
      res.json(available);
    } catch (err: any) {
      console.error("[claims] approved-for-claim error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/jobs/:jobId/claims/:claimId/cost-report-pdf
  // Returns a short-lived (10 min) signed URL for the cost report PDF stored at
  // submission time. Requires auth + owner/manager role — callers never receive
  // the raw object-storage path, only the time-limited signed URL.
  app.get("/api/jobs/:jobId/claims/:claimId/cost-report-pdf", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const { effectiveUserId } = await getUserContext(req.userId);
      const { jobId, claimId } = req.params;
      const claim = await storage.getClaim(claimId, effectiveUserId);
      if (!claim || claim.jobId !== jobId) {
        return res.status(404).json({ error: "Claim not found" });
      }
      const storedPath = (claim as any).costReportUrl as string | null | undefined;
      if (!storedPath) {
        return res.status(404).json({ error: "No cost report has been generated for this claim yet. Submit the claim first." });
      }
      const objectService = new ObjectStorageService();
      const signedUrl = await objectService.getSignedDownloadURL(storedPath, 600);
      res.json({ url: signedUrl });
    } catch (err: any) {
      console.error("[claims] cost-report-pdf error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/jobs/:jobId/claims/:claimId/push-xero — manual Xero push / retry
  app.post("/api/jobs/:jobId/claims/:claimId/push-xero", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const { effectiveUserId } = await getUserContext(req.userId);
      const { jobId, claimId } = req.params;
      const claim = await storage.getClaim(claimId, effectiveUserId);
      if (!claim || claim.jobId !== jobId) {
        return res.status(404).json({ error: "Claim not found" });
      }
      // Atomic concurrency guard: try to claim the sync slot by writing '__SYNCING__' only when
      // xero_invoice_id is NULL and no concurrent sync is already running.
      // Uses a single UPDATE statement so the check-and-set is atomic at the DB level.
      const slotResult = await db.execute(sql`
        UPDATE claims
        SET xero_sync_error = '__SYNCING__'
        WHERE id = ${claimId}
          AND xero_invoice_id IS NULL
          AND (xero_sync_error IS NULL OR xero_sync_error NOT IN ('__SYNCING__'))
        RETURNING id
      `);
      if ((slotResult.rows ?? []).length === 0) {
        // Either already synced or a concurrent push is running — re-fetch and return current state
        const fresh = await storage.getClaim(claimId, effectiveUserId);
        const freshRow = fresh as any;
        if (freshRow?.xeroInvoiceId) {
          return res.json({ success: true, xeroInvoiceId: freshRow.xeroInvoiceId, alreadySynced: true });
        }
        return res.status(409).json({ error: "Xero sync already in progress" });
      }
      // Slot claimed — push to Xero; always release the slot in finally so a crash / exception
      // never leaves the claim stuck in __SYNCING__ indefinitely.
      let result: { success: boolean; xeroInvoiceId?: string; error?: string } = { success: false };
      let syncErr: string | null = null;
      try {
        result = await pushClaimToXero(claimId, effectiveUserId);
        if (result.success && result.xeroInvoiceId) {
          await db.execute(sql`UPDATE claims SET xero_invoice_id = ${result.xeroInvoiceId}, xero_synced_at = NOW(), xero_sync_error = NULL WHERE id = ${claimId}`);
        } else if (!result.success) {
          syncErr = result.error ?? "Xero sync failed";
          await db.execute(sql`UPDATE claims SET xero_sync_error = ${syncErr} WHERE id = ${claimId}`);
        } else {
          // No Xero connection configured — clear the slot
          await db.execute(sql`UPDATE claims SET xero_sync_error = NULL WHERE id = ${claimId}`);
        }
      } catch (pushErr: any) {
        syncErr = String(pushErr?.message ?? pushErr);
        await db.execute(sql`UPDATE claims SET xero_sync_error = ${syncErr} WHERE id = ${claimId}`).catch(() => {});
        throw pushErr;
      }
      if (result.success && result.xeroInvoiceId) {
        return res.json({ success: true, xeroInvoiceId: result.xeroInvoiceId });
      } else if (syncErr) {
        return res.status(422).json({ success: false, error: syncErr });
      } else {
        return res.json({ success: true, message: "No Xero connection configured" });
      }
    } catch (err: any) {
      console.error("[claims] push-xero error:", err);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  });

  // GET /api/jobs/:jobId/claims/:claimId/purchase-orders — list POs attributed to a claim
  app.get("/api/jobs/:jobId/claims/:claimId/purchase-orders", requireAuth, async (req: any, res) => {
    try {
      const { effectiveUserId } = await getUserContext(req.userId);
      const { jobId, claimId } = req.params;
      const claim = await storage.getClaim(claimId, effectiveUserId);
      if (!claim || claim.jobId !== jobId) return res.status(404).json({ error: "Claim not found" });
      const rows = await db.execute(sql`
        SELECT po.id, po.po_number, po.total, po.status, po.order_date, po.supplier_id
        FROM claim_purchase_orders cpo
        JOIN purchase_orders po ON po.id = cpo.purchase_order_id
        WHERE cpo.claim_id = ${claimId}
        ORDER BY po.order_date ASC
      `);
      res.json(rows.rows ?? []);
    } catch (err: any) {
      console.error("[claims] get-claim-pos error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/jobs/:jobId/claims/:claimId/purchase-orders — replace attributed POs for a claim
  app.put("/api/jobs/:jobId/claims/:claimId/purchase-orders", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const { effectiveUserId } = await getUserContext(req.userId);
      const { jobId, claimId } = req.params;
      const { purchaseOrderIds } = req.body;
      const claim = await storage.getClaim(claimId, effectiveUserId);
      if (!claim || claim.jobId !== jobId) return res.status(404).json({ error: "Claim not found" });

      const ids: string[] = Array.isArray(purchaseOrderIds)
        ? purchaseOrderIds.map((id) => String(id)).filter(Boolean)
        : [];

      if (ids.length > 0) {
        // Validate that every submitted PO ID belongs to this user AND this specific job,
        // preventing cross-tenant or cross-job data association.
        const validationResult = await db.execute(sql`
          SELECT id FROM purchase_orders
          WHERE id = ANY(${ids}::varchar[])
            AND job_id = ${jobId}
            AND user_id = ${effectiveUserId}
        `);
        const validIds = new Set((validationResult.rows ?? []).map((r: any) => r.id));
        const invalidIds = ids.filter((id) => !validIds.has(id));
        if (invalidIds.length > 0) {
          return res.status(422).json({
            error: "One or more purchase order IDs are invalid or do not belong to this job",
            invalidIds,
          });
        }
      }

      // Replace all attributed POs atomically using Drizzle's transaction callback,
      // which guarantees all statements run on the same pooled connection.
      await db.transaction(async (tx) => {
        await tx.execute(sql`DELETE FROM claim_purchase_orders WHERE claim_id = ${claimId}`);
        for (const poId of ids) {
          await tx.execute(sql`
            INSERT INTO claim_purchase_orders (claim_id, purchase_order_id)
            VALUES (${claimId}, ${poId})
            ON CONFLICT (claim_id, purchase_order_id) DO NOTHING
          `);
        }
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("[claims] put-claim-pos error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/jobs/:jobId/financial-chain — full document trail + reconciliation summary
  app.get("/api/jobs/:jobId/financial-chain", requireAuth, async (req: any, res) => {
    try {
      const { effectiveUserId } = await getUserContext(req.userId);
      const { jobId } = req.params;
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) return res.status(404).json({ error: "Job not found" });

      const [allVariations, allClaims, quotesResult, invoicesResult] = await Promise.all([
        storage.getJobVariations(jobId, effectiveUserId),
        storage.getClaims(jobId, effectiveUserId),
        db.execute(sql`SELECT id, status, total, created_at FROM quotes WHERE job_id = ${jobId} AND user_id = ${effectiveUserId} ORDER BY created_at ASC`),
        db.execute(sql`SELECT id, status, total, created_at FROM invoices WHERE job_id = ${jobId} AND user_id = ${effectiveUserId} ORDER BY created_at ASC`),
      ]);

      const quotes = (quotesResult.rows ?? []) as any[];
      const invoices = (invoicesResult.rows ?? []) as any[];
      const activeQuote = quotes.find((q: any) => q.status === "accepted") ?? quotes.find((q: any) => q.status === "sent") ?? quotes[0] ?? null;
      const approvedVariations = allVariations.filter((v: any) => v.status === "approved");

      // Batch-fetch attributed POs for all claims in this job (one query, avoids N+1)
      const claimPosByClaimId = new Map<string, { id: string; poNumber: string; total: number; status: string }[]>();
      if (allClaims.length > 0) {
        const claimPosResult = await db.execute(sql`
          SELECT cpo.claim_id, po.id, po.po_number, po.total, po.status
          FROM claim_purchase_orders cpo
          JOIN purchase_orders po ON po.id = cpo.purchase_order_id
          JOIN claims c ON c.id = cpo.claim_id
          WHERE c.job_id = ${jobId} AND c.user_id = ${effectiveUserId}
          ORDER BY po.created_at ASC
        `);
        for (const row of (claimPosResult.rows ?? []) as any[]) {
          if (!claimPosByClaimId.has(row.claim_id)) claimPosByClaimId.set(row.claim_id, []);
          claimPosByClaimId.get(row.claim_id)!.push({
            id: row.id,
            poNumber: row.po_number,
            total: parseFloat(row.total ?? "0"),
            status: row.status,
          });
        }
      }

      const quoteTotal = activeQuote ? parseFloat(activeQuote.total ?? "0") : 0;
      const variationsTotal = approvedVariations.reduce((s: number, v: any) => s + parseFloat(v.amount ?? "0"), 0);
      const revisedContractTotal = quoteTotal + variationsTotal;
      const totalClaimed = allClaims
        .filter((c: any) => c.status !== "draft")
        .reduce((s: number, c: any) => s + parseFloat(c.total ?? "0"), 0);
      const outstandingBalance = revisedContractTotal - totalClaimed;

      const chain: any[] = [];
      if (activeQuote) {
        chain.push({ type: "quote", id: activeQuote.id, status: activeQuote.status, total: parseFloat(activeQuote.total ?? "0"), date: activeQuote.created_at });
      }
      for (const v of approvedVariations) {
        chain.push({ type: "variation", id: (v as any).id, variationNumber: (v as any).variationNumber, title: (v as any).title, amount: parseFloat((v as any).amount ?? "0"), status: v.status, date: (v as any).approvedAt ?? (v as any).createdAt });
      }
      for (const c of allClaims) {
        chain.push({
          type: "claim", id: c.id, claimNumber: c.claimNumber,
          total: parseFloat(c.total ?? "0"), status: c.status,
          date: (c as any).claimDate ?? (c as any).createdAt,
          xeroInvoiceId: c.xeroInvoiceId, xeroSyncError: (c as any).xeroSyncError,
          purchaseOrders: claimPosByClaimId.get(c.id) ?? [],
        });
      }
      for (const inv of invoices) {
        chain.push({ type: "invoice", id: inv.id, total: parseFloat(inv.total ?? "0"), status: inv.status, date: inv.created_at });
      }

      res.json({ chain, summary: { quoteTotal, approvedVariationsTotal: variationsTotal, revisedContractTotal, totalClaimed, outstandingBalance } });
    } catch (err: any) {
      console.error("[claims] financial-chain error:", err);
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
