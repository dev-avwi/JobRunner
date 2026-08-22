/**
 * End-to-end behavioural tests: retention release flow + progress-claim PDF
 *
 * Proves the full contract-billing retention flow using isolated in-memory
 * fixtures — no database, no network, no Puppeteer.
 *
 * Coverage:
 *  1. An isolated project fixture can hold approved retained claims.
 *  2. A retention release is blocked before practical completion is set.
 *  3. The computed release amount equals the outstanding retained balance.
 *  4. The progress-claim PDF HTML is non-empty and contains the three key
 *     financial figures: "Gross Claimed", "Retention Held", "Net Payable".
 *  5. A retention release claim zeroes the outstanding balance in the ledger.
 *  6. A second retention release is rejected once one already exists.
 */

import { describe, it, expect } from "vitest";
import {
  computeRetentionSummary,
  isRetentionReleaseClaim,
  type ClaimRow,
  type JobRetentionFields,
} from "../retentionSummary";
import { generateProgressClaimPDF } from "../../pdfService";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

/**
 * Minimal in-memory representation of a project job with a 5% retention rate.
 * Practical completion date starts as null (not yet reached).
 */
function makeProjectJob(overrides: Partial<JobRetentionFields> = {}): JobRetentionFields {
  return {
    practicalCompletionDate: null,
    defectsLiabilityMonths: 12,
    ...overrides,
  };
}

/** Build a progress claim row as storage would return it. */
function makeProgressClaim(
  id: string,
  retentionAmount: string,
  status: ClaimRow["status"] = "approved",
  overrides: Partial<ClaimRow> = {},
): ClaimRow {
  return {
    id,
    status,
    retentionAmount,
    subtotal: "0.00",
    notes: null,
    ...overrides,
  };
}

/** Build a retention release claim row. */
function makeReleaseClaim(
  id: string,
  releaseAmount: string,
  status: ClaimRow["status"] = "draft",
): ClaimRow {
  return {
    id,
    status,
    retentionAmount: "0.00",
    subtotal: releaseAmount,
    notes: "Retention Release",
  };
}

// ─── Isolated fixture ─────────────────────────────────────────────────────────
//
// Project: 3 progress claims each withholding $5,000 retention = $15,000 held.
// Retention rate: 5% (informational on the job record; not recalculated here
// because computeRetentionSummary works from the already-withheld amounts).

const RETENTION_PER_CLAIM = "5000.00";
const TOTAL_RETENTION_HELD = 15_000;

const progressClaims: ClaimRow[] = [
  makeProgressClaim("claim-1", RETENTION_PER_CLAIM),
  makeProgressClaim("claim-2", RETENTION_PER_CLAIM),
  makeProgressClaim("claim-3", RETENTION_PER_CLAIM),
];

// ─── 1. Fixture sanity ────────────────────────────────────────────────────────

describe("isolated project fixture — retention held", () => {
  it("sums retention across three approved progress claims", () => {
    const result = computeRetentionSummary(progressClaims, makeProjectJob());
    expect(result.sumRetentionHeld).toBe(TOTAL_RETENTION_HELD);
    expect(result.claimCount).toBe(3);
  });

  it("reports full outstanding balance before any release", () => {
    const result = computeRetentionSummary(progressClaims, makeProjectJob());
    expect(result.outstandingRetention).toBe(TOTAL_RETENTION_HELD);
  });

  it("excludes draft and submitted claims from the retention ledger", () => {
    const withDraft = [
      ...progressClaims,
      makeProgressClaim("claim-draft", "9999.00", "draft"),
      makeProgressClaim("claim-sub", "9999.00", "submitted"),
    ];
    const result = computeRetentionSummary(withDraft, makeProjectJob());
    // Only the three approved claims count
    expect(result.sumRetentionHeld).toBe(TOTAL_RETENTION_HELD);
    expect(result.claimCount).toBe(3);
  });
});

// ─── 2. Eligibility gate: practical completion ────────────────────────────────

describe("retention release eligibility — practical completion gate", () => {
  it("blocks release when practical completion has not been set (pre_pc)", () => {
    const summary = computeRetentionSummary(
      progressClaims,
      makeProjectJob({ practicalCompletionDate: null }),
    );
    // The route uses retentionStatus === "pre_pc" to reject the request.
    expect(summary.retentionStatus).toBe("pre_pc");
    expect(summary.outstandingRetention).toBeGreaterThan(0);
  });

  it("blocks release when practical completion date is in the future", () => {
    const summary = computeRetentionSummary(
      progressClaims,
      makeProjectJob({ practicalCompletionDate: "2099-01-01" }),
      new Date("2026-08-22"),
    );
    expect(summary.retentionStatus).toBe("pre_pc");
  });

  it("permits release once practical completion date is today or in the past (in_dlp)", () => {
    const summary = computeRetentionSummary(
      progressClaims,
      makeProjectJob({ practicalCompletionDate: "2026-01-01", defectsLiabilityMonths: 12 }),
      new Date("2026-08-22"), // inside the 12-month DLP
    );
    // Status is "in_dlp" (PC reached, DLP still running) — route allows release from here
    expect(summary.retentionStatus).toBe("in_dlp");
    expect(summary.outstandingRetention).toBe(TOTAL_RETENTION_HELD);
  });

  it("permits release when DLP has also expired (dlp_ended)", () => {
    const summary = computeRetentionSummary(
      progressClaims,
      makeProjectJob({ practicalCompletionDate: "2025-01-01", defectsLiabilityMonths: 6 }),
      new Date("2026-08-22"), // well past the 6-month DLP
    );
    expect(summary.retentionStatus).toBe("dlp_ended");
    expect(summary.outstandingRetention).toBe(TOTAL_RETENTION_HELD);
  });
});

// ─── 3. Release amount equals outstanding retained balance ────────────────────

describe("retention release amount — matches outstanding balance", () => {
  /**
   * Simulates the route logic:
   *  computeRetentionSummary → outstandingRetention → releaseAmount
   */
  function computeReleaseAmount(claims: ClaimRow[], job: JobRetentionFields): number {
    const summary = computeRetentionSummary(claims, job);
    if (summary.retentionStatus === "pre_pc") {
      throw new Error("Cannot release retention before practical completion");
    }
    if (summary.outstandingRetention <= 0) {
      throw new Error("No outstanding retention to release");
    }
    return summary.outstandingRetention;
  }

  it("release amount equals the full outstanding retention when nothing has been released", () => {
    const job = makeProjectJob({ practicalCompletionDate: "2026-01-01" });
    const releaseAmount = computeReleaseAmount(progressClaims, job);
    expect(releaseAmount).toBe(TOTAL_RETENTION_HELD);
  });

  it("release amount reflects only the remaining balance after a partial release", () => {
    // Suppose an earlier release claim paid out $5,000
    const partialRelease = makeReleaseClaim("release-1", "5000.00", "approved");
    const claims = [...progressClaims, partialRelease];
    const job = makeProjectJob({ practicalCompletionDate: "2026-01-01" });

    const releaseAmount = computeReleaseAmount(claims, job);
    expect(releaseAmount).toBe(10_000); // 15,000 held − 5,000 released
  });

  it("release amount handles decimal retention figures precisely", () => {
    const decimalClaims: ClaimRow[] = [
      makeProgressClaim("d1", "3333.33"),
      makeProgressClaim("d2", "3333.33"),
      makeProgressClaim("d3", "3333.34"), // total = 10,000.00 exactly
    ];
    const job = makeProjectJob({ practicalCompletionDate: "2026-01-01" });
    const releaseAmount = computeReleaseAmount(decimalClaims, job);
    expect(releaseAmount).toBe(10_000);
  });

  it("throws when trying to release retention before practical completion", () => {
    const job = makeProjectJob({ practicalCompletionDate: null });
    expect(() => computeReleaseAmount(progressClaims, job)).toThrow(
      "Cannot release retention before practical completion",
    );
  });

  it("throws when outstanding retention is already zero", () => {
    // All retention already released
    const released = makeReleaseClaim("release-done", "15000.00", "approved");
    const claims = [...progressClaims, released];
    const job = makeProjectJob({ practicalCompletionDate: "2026-01-01" });
    expect(() => computeReleaseAmount(claims, job)).toThrow(
      "No outstanding retention to release",
    );
  });
});

// ─── 4. Ledger state after an approved release claim ─────────────────────────

describe("ledger state — after retention release claim", () => {
  it("zeros outstandingRetention when a full release claim is approved", () => {
    const releaseClaim = makeReleaseClaim("release-full", "15000.00", "approved");
    const claims = [...progressClaims, releaseClaim];
    const result = computeRetentionSummary(claims, makeProjectJob({ practicalCompletionDate: "2026-01-01" }));

    expect(result.retentionStatus).toBe("released");
    expect(result.outstandingRetention).toBe(0);
    // Raw withholding still visible in the ledger
    expect(result.sumRetentionHeld).toBe(TOTAL_RETENTION_HELD);
  });

  it("sets release_pending and keeps outstanding unchanged while release is in draft", () => {
    const pendingRelease = makeReleaseClaim("release-pending", "15000.00", "draft");
    const claims = [...progressClaims, pendingRelease];
    const result = computeRetentionSummary(claims, makeProjectJob({ practicalCompletionDate: "2026-01-01" }));

    expect(result.retentionStatus).toBe("release_pending");
    expect(result.hasReleasePending).toBe(true);
    expect(result.releasePendingClaimId).toBe("release-pending");
    expect(result.outstandingRetention).toBe(TOTAL_RETENTION_HELD);
  });

  it("sets release_pending for a submitted (not yet approved) release claim", () => {
    const submittedRelease = makeReleaseClaim("release-submitted", "15000.00", "submitted");
    const claims = [...progressClaims, submittedRelease];
    const result = computeRetentionSummary(claims, makeProjectJob({ practicalCompletionDate: "2026-01-01" }));

    expect(result.retentionStatus).toBe("release_pending");
  });
});

// ─── 5. Duplicate release detection ──────────────────────────────────────────

describe("duplicate retention release detection", () => {
  /**
   * Mirrors the application-level duplicate guard in the claims route:
   * a conflicting release claim is one with notes = "Retention Release" and
   * status in { draft, submitted, approved, paid }.
   */
  function hasConflictingReleaseClaim(claims: ClaimRow[]): boolean {
    return claims.some(
      (c) =>
        isRetentionReleaseClaim(c) &&
        (c.status === "draft" || c.status === "submitted" || c.status === "approved" || c.status === "paid"),
    );
  }

  it("detects a conflicting draft release claim", () => {
    const draft = makeReleaseClaim("rr-draft", "15000.00", "draft");
    expect(hasConflictingReleaseClaim([...progressClaims, draft])).toBe(true);
  });

  it("detects a conflicting submitted release claim", () => {
    const submitted = makeReleaseClaim("rr-submitted", "15000.00", "submitted");
    expect(hasConflictingReleaseClaim([...progressClaims, submitted])).toBe(true);
  });

  it("detects a conflicting approved release claim", () => {
    const approved = makeReleaseClaim("rr-approved", "15000.00", "approved");
    expect(hasConflictingReleaseClaim([...progressClaims, approved])).toBe(true);
  });

  it("returns false when no release claim exists", () => {
    expect(hasConflictingReleaseClaim(progressClaims)).toBe(false);
  });

  it("returns false for an ordinary claim whose notes happen to be non-null", () => {
    const ordinary = makeProgressClaim("ord", "1000.00", "approved", { notes: "Phase 2 works" });
    expect(hasConflictingReleaseClaim([...progressClaims, ordinary])).toBe(false);
  });
});

// ─── 6. Progress-claim PDF — HTML content verification ───────────────────────
//
// generateProgressClaimPDF is a pure synchronous function that returns an HTML
// string.  We verify the HTML (which is identical to what Puppeteer renders)
// rather than the binary PDF buffer, avoiding a Chromium dependency in tests.

describe("progress-claim PDF — HTML content", () => {
  /** Shared fixture: a progress claim with 5% retention applied to $50,000. */
  const claimFixture = {
    id: "claim-pdf-1",
    claimNumber: "PC-001",
    status: "approved",
    claimDate: "2026-06-01",
    periodStart: "2026-05-01",
    periodEnd: "2026-05-31",
    retentionPercent: "5.00",
    notes: null,
  };

  const jobFixture = {
    id: "job-pdf-1",
    title: "Harbour Bridge Restoration",
    address: "Harbour Bridge, Sydney NSW 2000",
    jobType: "project",
  };

  const clientFixture = {
    name: "Roads & Maritime Services",
    email: "contracts@rms.nsw.gov.au",
  };

  const businessFixture = {
    businessName: "Apex Civil Pty Ltd",
    abn: "12 345 678 901",
  };

  /**
   * Single line item: $100,000 contract value, $50,000 this claim, 5% retention.
   * Gross claimed:   $50,000
   * Retention held:  $2,500  (5% of $50,000)
   * Net payable:     $47,500
   */
  const lineItemsFixture = [
    {
      id: "li-1",
      description: "Structural steelwork — Phase 1",
      contractValue: "100000.00",
      previouslyClaimed: "0.00",
      thisClaim: "50000.00",
      retentionPercent: "5.00",
      retentionAmount: 2500, // pre-computed by buildScheduleOfValues
      balance: 50000,
      cumulativePct: 50,
    },
  ];

  const summaryFixture = {
    contractValueTotal: 100_000,
    previouslyClaimedTotal: 0,
    thisClaimTotal: 50_000,
    retentionTotal: 2_500,
    subtotal: 47_500,      // gross - retention = net payable
    gstAmount: 0,
    total: 47_500,
    balanceTotal: 50_000,
  };

  function buildHtml(gstEnabled = false): string {
    return generateProgressClaimPDF({
      claim: claimFixture,
      job: jobFixture,
      client: clientFixture,
      business: businessFixture,
      lineItems: lineItemsFixture,
      summary: summaryFixture,
      gstEnabled,
    });
  }

  it("returns a non-empty HTML string", () => {
    const html = buildHtml();
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(200);
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("contains the Gross Claimed figure", () => {
    const html = buildHtml();
    expect(html).toContain("Gross Claimed");
    // $50,000.00 in en-AU locale
    expect(html).toContain("$50,000.00");
  });

  it("contains the Retention Held figure", () => {
    const html = buildHtml();
    expect(html).toContain("Retention Held");
    // 5% of $50,000 = $2,500.00
    expect(html).toContain("$2,500.00");
  });

  it("contains the Net Payable figure", () => {
    const html = buildHtml();
    expect(html).toContain("Net Payable");
    // $50,000 − $2,500 = $47,500.00
    expect(html).toContain("$47,500.00");
  });

  it("contains the claim number and job title", () => {
    const html = buildHtml();
    expect(html).toContain("PC-001");
    expect(html).toContain("Harbour Bridge Restoration");
  });

  it("contains the business and client names", () => {
    const html = buildHtml();
    expect(html).toContain("Apex Civil Pty Ltd");
    expect(html).toContain("Roads &amp; Maritime Services"); // HTML-escaped
  });

  it("does not include GST row when gstEnabled is false", () => {
    const html = buildHtml(false);
    expect(html).not.toContain("GST (10%)");
  });

  it("includes GST row and amount when gstEnabled is true", () => {
    const summaryWithGst = {
      ...summaryFixture,
      gstAmount: 4_750,   // 10% of $47,500
      total: 52_250,
    };
    const html = generateProgressClaimPDF({
      claim: claimFixture,
      job: jobFixture,
      client: clientFixture,
      business: businessFixture,
      lineItems: lineItemsFixture,
      summary: summaryWithGst,
      gstEnabled: true,
    });
    expect(html).toContain("GST (10%)");
    expect(html).toContain("$4,750.00");
  });
});

// ─── 7. Retention release claim — PDF content ─────────────────────────────────

describe("retention release claim — PDF HTML content", () => {
  /**
   * A retention release claim has:
   *   contractValue = releaseAmount = $15,000
   *   thisClaim     = $15,000
   *   retentionPercent = 0%
   *   retentionAmount  = 0
   *   gross claimed = $15,000
   *   retention held = $0
   *   net payable    = $15,000
   */
  const releaseClaim = {
    id: "release-claim-1",
    claimNumber: "PC-004",
    status: "approved",
    claimDate: "2026-08-01",
    periodStart: null,
    periodEnd: null,
    retentionPercent: "0.00",
    notes: "Retention Release",
  };

  const lineItems = [
    {
      id: "li-release",
      description: "Retention Release",
      contractValue: "15000.00",
      previouslyClaimed: "0.00",
      thisClaim: "15000.00",
      retentionPercent: "0.00",
      retentionAmount: 0,
      balance: 0,
      cumulativePct: 100,
    },
  ];

  const summary = {
    contractValueTotal: 15_000,
    previouslyClaimedTotal: 0,
    thisClaimTotal: 15_000,
    retentionTotal: 0,
    subtotal: 15_000,
    gstAmount: 0,
    total: 15_000,
    balanceTotal: 0,
  };

  it("PDF HTML is non-empty and valid", () => {
    const html = generateProgressClaimPDF({
      claim: releaseClaim,
      job: { id: "job-1", title: "Harbour Bridge Restoration", jobType: "project" },
      client: { name: "Roads & Maritime Services" },
      business: { businessName: "Apex Civil Pty Ltd" },
      lineItems,
      summary,
      gstEnabled: false,
    });
    expect(html.length).toBeGreaterThan(200);
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("shows Gross Claimed of $15,000 for the release amount", () => {
    const html = generateProgressClaimPDF({
      claim: releaseClaim,
      job: { id: "job-1", title: "Test Job", jobType: "project" },
      client: null,
      business: null,
      lineItems,
      summary,
      gstEnabled: false,
    });
    expect(html).toContain("Gross Claimed");
    expect(html).toContain("$15,000.00");
  });

  it("shows zero Retention Held for the release claim", () => {
    const html = generateProgressClaimPDF({
      claim: releaseClaim,
      job: { id: "job-1", title: "Test Job", jobType: "project" },
      client: null,
      business: null,
      lineItems,
      summary,
      gstEnabled: false,
    });
    expect(html).toContain("Retention Held");
    // Retention is $0.00 on the release claim itself
    expect(html).toContain("-$0.00");
  });

  it("shows Net Payable equal to the full release amount", () => {
    const html = generateProgressClaimPDF({
      claim: releaseClaim,
      job: { id: "job-1", title: "Test Job", jobType: "project" },
      client: null,
      business: null,
      lineItems,
      summary,
      gstEnabled: false,
    });
    expect(html).toContain("Net Payable");
    expect(html).toContain("$15,000.00");
  });

  it("includes the Retention Release notes in the PDF", () => {
    const html = generateProgressClaimPDF({
      claim: releaseClaim,
      job: { id: "job-1", title: "Test Job", jobType: "project" },
      client: null,
      business: null,
      lineItems,
      summary,
      gstEnabled: false,
    });
    expect(html).toContain("Retention Release");
  });
});
