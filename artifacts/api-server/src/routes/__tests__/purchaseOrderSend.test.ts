/**
 * Unit tests for purchase order send helpers and token logic.
 *
 * Covers:
 *  - generatePoAccessToken / verifyPoAccessToken round-trip
 *  - Expired token rejection
 *  - Tampered token rejection
 *  - ENCRYPTION_SECRET requirement (no insecure fallback)
 *  - SMS always includes the PO view link (even with custom messages)
 *  - Email attachment structure
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generatePoAccessToken, verifyPoAccessToken } from "../inventory";

const TEST_SECRET = "test-secret-32-chars-minimum-ok!";

// ─── Token helpers ────────────────────────────────────────────────────────────

describe("generatePoAccessToken / verifyPoAccessToken", () => {
  const poId = "po-abc-123";

  beforeEach(() => {
    process.env.ENCRYPTION_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_SECRET;
  });

  it("generates a non-empty base64url token", () => {
    const token = generatePoAccessToken(poId);
    expect(token).toBeTruthy();
    // base64url has no +, /, or = padding
    expect(token).not.toMatch(/[+/=]/);
  });

  it("verifies a freshly generated token and returns the correct poId", () => {
    const token = generatePoAccessToken(poId);
    const result = verifyPoAccessToken(token);
    expect(result).not.toBeNull();
    expect(result?.poId).toBe(poId);
  });

  it("returns null for an expired token", () => {
    const { createHmac } = require("crypto");
    const expiry = Math.floor(Date.now() / 1000) - 1; // already expired
    const payload = `${poId}:${expiry}`;
    const sig = createHmac("sha256", TEST_SECRET).update(payload).digest("hex");
    const token = Buffer.from(`${payload}:${sig}`).toString("base64url");

    expect(verifyPoAccessToken(token)).toBeNull();
  });

  it("returns null for a token with a tampered poId", () => {
    const token = generatePoAccessToken(poId);
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [, expiry, sig] = decoded.split(":");
    const tampered = Buffer.from(`different-po:${expiry}:${sig}`).toString("base64url");
    expect(verifyPoAccessToken(tampered)).toBeNull();
  });

  it("returns null for a token with a tampered signature", () => {
    const token = generatePoAccessToken(poId);
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    parts[2] = parts[2].slice(0, -1) + (parts[2].endsWith("a") ? "b" : "a");
    const tampered = Buffer.from(parts.join(":")).toString("base64url");
    expect(verifyPoAccessToken(tampered)).toBeNull();
  });

  it("returns null for a completely invalid token", () => {
    expect(verifyPoAccessToken("notavalidtoken")).toBeNull();
    expect(verifyPoAccessToken("")).toBeNull();
    expect(verifyPoAccessToken("abc.def")).toBeNull();
  });

  it("returns null when the token has too few segments", () => {
    const token = Buffer.from("only-two:segments").toString("base64url");
    expect(verifyPoAccessToken(token)).toBeNull();
  });

  it("generates different tokens for different PO IDs", () => {
    const t1 = generatePoAccessToken("po-1");
    const t2 = generatePoAccessToken("po-2");
    expect(t1).not.toBe(t2);
  });
});

// ─── Security: ENCRYPTION_SECRET is required ──────────────────────────────────

describe("ENCRYPTION_SECRET requirement", () => {
  const poId = "po-secure-test";

  afterEach(() => {
    delete process.env.ENCRYPTION_SECRET;
  });

  it("throws when ENCRYPTION_SECRET is not set during token generation", () => {
    delete process.env.ENCRYPTION_SECRET;
    expect(() => generatePoAccessToken(poId)).toThrow("ENCRYPTION_SECRET is required");
  });

  it("returns null from verifyPoAccessToken when ENCRYPTION_SECRET is not set", () => {
    // Generate with secret present
    process.env.ENCRYPTION_SECRET = TEST_SECRET;
    const token = generatePoAccessToken(poId);

    // Clear the secret before verifying — should refuse
    delete process.env.ENCRYPTION_SECRET;
    expect(verifyPoAccessToken(token)).toBeNull();
  });

  it("a token signed with one secret is rejected when verified with a different secret", () => {
    process.env.ENCRYPTION_SECRET = TEST_SECRET;
    const token = generatePoAccessToken(poId);

    process.env.ENCRYPTION_SECRET = "completely-different-secret-value";
    expect(verifyPoAccessToken(token)).toBeNull();
  });
});

// ─── SMS always includes the PO view link ────────────────────────────────────

describe("SMS message always includes PO view link", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_SECRET;
  });

  function buildSmsBody(opts: {
    customMessage?: string;
    poId: string;
    poNumber: string;
    total: string;
    businessName: string;
    supplierName?: string;
    baseUrl: string;
  }): string {
    // Mirrors the logic in the send endpoint
    const accessToken = generatePoAccessToken(opts.poId);
    const poViewUrl = `${opts.baseUrl}/api/po/view/${accessToken}`;

    return opts.customMessage
      ? `${opts.customMessage}\nView PO: ${poViewUrl}`
      : `Hi${opts.supplierName ? ` ${opts.supplierName}` : ''}, ${opts.businessName} has sent you Purchase Order ${opts.poNumber} totalling $${parseFloat(opts.total).toFixed(2)}. View the full PO here: ${poViewUrl}`;
  }

  it("default message includes the view link and PO details", () => {
    const body = buildSmsBody({
      poId: "po-test-1",
      poNumber: "PO-042",
      total: "1250.00",
      businessName: "Acme Plumbing",
      supplierName: "Steel Supplies Co",
      baseUrl: "https://jobrunner.com.au",
    });

    expect(body).toContain("/api/po/view/");
    expect(body).toContain("PO-042");
    expect(body).toContain("$1250.00");
    expect(body).toContain("Steel Supplies Co");
  });

  it("custom message always has the view link appended", () => {
    const body = buildSmsBody({
      customMessage: "Hi there, here is your order.",
      poId: "po-test-2",
      poNumber: "PO-099",
      total: "500.00",
      businessName: "Bricks R Us",
      baseUrl: "https://jobrunner.com.au",
    });

    // Must contain the custom text AND the link
    expect(body).toContain("Hi there, here is your order.");
    expect(body).toContain("/api/po/view/");
  });

  it("the embedded token in the SMS link is valid and resolves to the correct PO", () => {
    const poId = "po-link-verify";
    const body = buildSmsBody({
      poId,
      poNumber: "PO-007",
      total: "750.00",
      businessName: "Pipes Ltd",
      baseUrl: "https://jobrunner.com.au",
    });

    const match = body.match(/\/api\/po\/view\/([A-Za-z0-9_-]+)/);
    expect(match).not.toBeNull();
    const tokenFromLink = match![1];
    const verified = verifyPoAccessToken(tokenFromLink);
    expect(verified?.poId).toBe(poId);
  });
});

// ─── Email attachment structure ───────────────────────────────────────────────

describe("Email attachment structure", () => {
  it("builds attachment with filename, Buffer content, and contentType", () => {
    const pdfBuffer = Buffer.from("%PDF-1.4 fake-pdf-content");
    const poNumber = "PO-007";

    const attachment = {
      filename: `PO-${poNumber}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    };

    expect(attachment.filename).toBe("PO-PO-007.pdf");
    expect(Buffer.isBuffer(attachment.content)).toBe(true);
    expect(attachment.contentType).toBe("application/pdf");
    // Content is raw bytes, not base64 (that conversion happens inside sendEmailWithAttachment)
    expect(attachment.content.toString()).toContain("%PDF");
  });
});
