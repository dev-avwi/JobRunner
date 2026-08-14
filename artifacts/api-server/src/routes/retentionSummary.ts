/**
 * Retention ledger summary computation.
 *
 * Pure function — no I/O. Import this in both the route handler and tests so
 * the tests exercise exactly the same code that ships to production.
 */

export interface ClaimRow {
  id: string;
  status: string;          // draft | submitted | approved | paid
  retentionAmount: string; // decimal string — amount withheld by this claim
  subtotal: string;        // decimal string — net billed (used for release claim amount)
  total?: string;          // fallback if subtotal is absent
  notes: string | null;
}

export interface JobRetentionFields {
  practicalCompletionDate: string | null;
  defectsLiabilityMonths: number | null;
}

export type RetentionStatus =
  | "no_retention"
  | "pre_pc"
  | "in_dlp"
  | "dlp_ended"
  | "release_pending"
  | "released";

export interface RetentionSummary {
  sumRetentionHeld: number;
  outstandingRetention: number;
  hasReleasePending: boolean;
  releasePendingClaimId: string | null;
  practicalCompletionDate: string | null;
  defectsLiabilityMonths: number;
  releaseDate: string | null;
  retentionStatus: RetentionStatus;
  claimCount: number;
}

/** Returns true when a claim is a Retention Release claim (matched by notes). */
export function isRetentionReleaseClaim(c: Pick<ClaimRow, "notes">): boolean {
  return (c.notes ?? "").trim().toLowerCase() === "retention release";
}

/**
 * Compute the retention ledger summary for a project job.
 *
 * @param claims   All claims for the job (any status).
 * @param job      Subset of job fields needed for the computation.
 * @param now      Current timestamp (injectable for testing).
 */
export function computeRetentionSummary(
  claims: ClaimRow[],
  job: JobRetentionFields,
  now: Date = new Date(),
): RetentionSummary {
  const approvedClaims = claims.filter(
    (c) => c.status === "approved" || c.status === "paid",
  );

  // Total retention withheld across all approved/paid progress claims.
  const sumRetentionHeld = approvedClaims.reduce(
    (sum, c) => sum + parseFloat(c.retentionAmount || "0"),
    0,
  );

  const releaseClaims = claims.filter(isRetentionReleaseClaim);
  const paidReleaseClaims = releaseClaims.filter(
    (c) => c.status === "approved" || c.status === "paid",
  );
  const pendingReleaseClaims = releaseClaims.filter(
    (c) => c.status === "draft" || c.status === "submitted",
  );

  // Amount already released = sum of subtotals (net of GST) on approved/paid release claims.
  const sumRetentionReleased = paidReleaseClaims.reduce((sum, c) => {
    // Use numeric fallback: subtotal is preferred; if it parses to 0 (e.g.
    // "0.00" on older records), fall back to the gross total field.
    const sub = parseFloat(c.subtotal || "0");
    const tot = parseFloat(c.total || "0");
    return sum + (sub !== 0 ? sub : tot);
  }, 0);
  const outstandingRetention = Math.max(
    0,
    Math.round((sumRetentionHeld - sumRetentionReleased) * 100) / 100,
  );

  // Compute DLP release date.
  const pcDate = job.practicalCompletionDate
    ? new Date(job.practicalCompletionDate)
    : null;
  const dlpMonths = job.defectsLiabilityMonths ?? 12;
  let releaseDate: Date | null = null;
  if (pcDate) {
    releaseDate = new Date(pcDate);
    releaseDate.setMonth(releaseDate.getMonth() + dlpMonths);
  }

  // Derive status (priority: released → release_pending → date-based).
  let retentionStatus: RetentionStatus = "no_retention";
  if (sumRetentionHeld > 0) {
    if (outstandingRetention === 0) {
      retentionStatus = "released";
    } else if (pendingReleaseClaims.length > 0) {
      retentionStatus = "release_pending";
    } else if (!pcDate) {
      retentionStatus = "pre_pc";
    } else if (releaseDate && now >= releaseDate) {
      retentionStatus = "dlp_ended";
    } else {
      retentionStatus = "in_dlp";
    }
  }

  return {
    sumRetentionHeld: Math.round(sumRetentionHeld * 100) / 100,
    outstandingRetention,
    hasReleasePending: pendingReleaseClaims.length > 0,
    releasePendingClaimId: pendingReleaseClaims[0]?.id ?? null,
    practicalCompletionDate: job.practicalCompletionDate,
    defectsLiabilityMonths: dlpMonths,
    releaseDate: releaseDate ? releaseDate.toISOString().split("T")[0] : null,
    retentionStatus,
    claimCount: approvedClaims.length,
  };
}
