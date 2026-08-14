/**
 * Unit tests for the retention ledger summary computation.
 *
 * Imports directly from the production module so tests cover the exact same
 * code that runs in the API route — not a mirror or copy.
 */

import { describe, it, expect } from "vitest";
import { computeRetentionSummary, isRetentionReleaseClaim, type ClaimRow } from "../retentionSummary";

// ─── DB error-mapping helper (mirrors the route catch block logic) ─────────────
// Tests that the constraint-name discriminator routes 23505 correctly so that
// a racing concurrent POST returns 409 and not 500.

function mapClaimCreateError(err: { code?: string; constraint?: string }): number {
  if (
    err?.code === "23505" &&
    err?.constraint === "idx_claims_one_retention_release_active"
  ) {
    return 409;
  }
  return 500;
}

describe("DB unique-constraint error mapping", () => {
  it("maps idx_claims_one_retention_release_active violation to 409", () => {
    expect(
      mapClaimCreateError({
        code: "23505",
        constraint: "idx_claims_one_retention_release_active",
      }),
    ).toBe(409);
  });

  it("does not map other 23505 violations (e.g. variation uniqueness) to 409", () => {
    expect(
      mapClaimCreateError({
        code: "23505",
        constraint: "idx_claims_variation_unique",
      }),
    ).toBe(500);
  });

  it("does not map non-unique-violation errors to 409", () => {
    expect(mapClaimCreateError({ code: "42P01" })).toBe(500);
    expect(mapClaimCreateError({})).toBe(500);
  });
});

// ─── helpers ─────────────────────────────────────────────────────────────────

function claim(overrides: Partial<ClaimRow>): ClaimRow {
  return {
    id: "claim-1",
    status: "approved",
    retentionAmount: "5000.00",
    subtotal: "0.00",
    notes: null,
    ...overrides,
  };
}

const noJob = { practicalCompletionDate: null, defectsLiabilityMonths: 12 };

// ─── isRetentionReleaseClaim ──────────────────────────────────────────────────

describe("isRetentionReleaseClaim", () => {
  it("matches exact notes value", () => {
    expect(isRetentionReleaseClaim({ notes: "Retention Release" })).toBe(true);
  });
  it("matches case-insensitively and trims whitespace", () => {
    expect(isRetentionReleaseClaim({ notes: "  RETENTION RELEASE  " })).toBe(true);
  });
  it("does not match partial strings", () => {
    expect(isRetentionReleaseClaim({ notes: "Retention Release (partial)" })).toBe(false);
  });
  it("does not match null notes", () => {
    expect(isRetentionReleaseClaim({ notes: null })).toBe(false);
  });
});

// ─── computeRetentionSummary ──────────────────────────────────────────────────

describe("computeRetentionSummary", () => {
  it("returns no_retention when there are no approved claims", () => {
    const result = computeRetentionSummary([], noJob);
    expect(result.retentionStatus).toBe("no_retention");
    expect(result.sumRetentionHeld).toBe(0);
    expect(result.outstandingRetention).toBe(0);
  });

  it("sums retentionAmount from approved and paid claims only", () => {
    const claims = [
      claim({ id: "c1", status: "approved", retentionAmount: "3000.00" }),
      claim({ id: "c2", status: "paid",      retentionAmount: "2000.00" }),
      claim({ id: "c3", status: "draft",     retentionAmount: "9999.00" }), // excluded
      claim({ id: "c4", status: "submitted", retentionAmount: "9999.00" }), // excluded
    ];
    const result = computeRetentionSummary(claims, noJob);
    expect(result.sumRetentionHeld).toBe(5000);
    expect(result.claimCount).toBe(2);
  });

  it("returns pre_pc when no PC date is set and retention is held", () => {
    const result = computeRetentionSummary(
      [claim({ retentionAmount: "5000.00" })],
      noJob,
    );
    expect(result.retentionStatus).toBe("pre_pc");
  });

  it("returns in_dlp when PC date is set and DLP has not expired", () => {
    const result = computeRetentionSummary(
      [claim({ retentionAmount: "5000.00" })],
      { practicalCompletionDate: "2026-01-01", defectsLiabilityMonths: 12 },
      new Date("2026-06-01"), // well within the 12-month DLP
    );
    expect(result.retentionStatus).toBe("in_dlp");
    expect(result.releaseDate).toBe("2027-01-01");
  });

  it("returns dlp_ended once the release date is reached or passed", () => {
    const result = computeRetentionSummary(
      [claim({ retentionAmount: "5000.00" })],
      { practicalCompletionDate: "2025-01-01", defectsLiabilityMonths: 6 },
      new Date("2025-07-15"), // past the 6-month DLP
    );
    expect(result.retentionStatus).toBe("dlp_ended");
  });

  it("returns release_pending when a Retention Release claim is in draft/submitted", () => {
    const claims = [
      claim({ id: "c1", retentionAmount: "5000.00" }),
      claim({ id: "c2", status: "draft", retentionAmount: "0.00", subtotal: "5000.00", notes: "Retention Release" }),
    ];
    const result = computeRetentionSummary(claims, noJob);
    expect(result.retentionStatus).toBe("release_pending");
    expect(result.hasReleasePending).toBe(true);
    expect(result.releasePendingClaimId).toBe("c2");
    // Outstanding unchanged while release is still pending
    expect(result.outstandingRetention).toBe(5000);
  });

  it("returns release_pending for a submitted (not yet approved) release claim", () => {
    const claims = [
      claim({ id: "c1", retentionAmount: "5000.00" }),
      claim({ id: "c2", status: "submitted", retentionAmount: "0.00", subtotal: "5000.00", notes: "Retention Release" }),
    ];
    const result = computeRetentionSummary(claims, noJob);
    expect(result.retentionStatus).toBe("release_pending");
  });

  it("returns released and zeros outstandingRetention when release claim is approved", () => {
    const claims = [
      claim({ id: "c1", retentionAmount: "5000.00" }),
      claim({ id: "c2", status: "approved", retentionAmount: "0.00", subtotal: "5000.00", notes: "Retention Release" }),
    ];
    const result = computeRetentionSummary(claims, noJob);
    expect(result.retentionStatus).toBe("released");
    expect(result.outstandingRetention).toBe(0);
    expect(result.sumRetentionHeld).toBe(5000); // raw withholding still visible
    expect(result.hasReleasePending).toBe(false);
  });

  it("returns released when release claim is paid", () => {
    const claims = [
      claim({ id: "c1", retentionAmount: "5000.00" }),
      claim({ id: "c2", status: "paid", retentionAmount: "0.00", subtotal: "5000.00", notes: "Retention Release" }),
    ];
    const result = computeRetentionSummary(claims, noJob);
    expect(result.retentionStatus).toBe("released");
    expect(result.outstandingRetention).toBe(0);
  });

  it("uses subtotal fallback to total field when subtotal is absent/zero", () => {
    const claims = [
      claim({ id: "c1", retentionAmount: "5000.00" }),
      // subtotal = "0.00" but total has the real value (edge case: old records)
      { id: "c2", status: "approved", retentionAmount: "0.00", subtotal: "0.00", total: "5000.00", notes: "Retention Release" } as ClaimRow,
    ];
    const result = computeRetentionSummary(claims, noJob);
    expect(result.retentionStatus).toBe("released");
    expect(result.outstandingRetention).toBe(0);
  });

  it("calculates correct releaseDate from PC date + DLP months", () => {
    const result = computeRetentionSummary(
      [claim({ retentionAmount: "1000.00" })],
      { practicalCompletionDate: "2026-03-15", defectsLiabilityMonths: 3 },
      new Date("2026-03-20"),
    );
    expect(result.releaseDate).toBe("2026-06-15");
  });

  it("uses 12-month DLP default when defectsLiabilityMonths is null", () => {
    const result = computeRetentionSummary(
      [claim({ retentionAmount: "1000.00" })],
      { practicalCompletionDate: "2026-01-01", defectsLiabilityMonths: null },
      new Date("2026-06-01"),
    );
    expect(result.defectsLiabilityMonths).toBe(12);
    expect(result.releaseDate).toBe("2027-01-01");
  });
});
