/**
 * Tests for ABN validation helpers and the PATCH /api/suppliers/:id route.
 *
 * Helper tests cover:
 *  - isValidAbn: known-valid ABNs (checksum passes)
 *  - isValidAbn: known-invalid ABNs (wrong checksum, wrong length, non-digits)
 *  - formatAbn: normalises raw digit strings to XX XXX XXX XXX
 *  - formatAbn: returns input unchanged when digit count is not 11
 *
 * Route tests cover (HTTP-level via supertest):
 *  - PATCH with a non-string abn value → 422
 *  - PATCH with an invalid-checksum string → 422 with the expected message
 *  - PATCH with a purely non-digit, non-empty string → 422
 *  - PATCH with a valid ABN string → 200, abn normalised to XX XXX XXX XXX
 *  - PATCH with abn: null → 200 (clearing is allowed)
 *  - PATCH with abn: "" → 200 (clearing is allowed)
 *  - PATCH without an abn key → 200 (untouched)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mock references so vi.mock factories can reference them ─────────────
const { mockUpdateSupplier } = vi.hoisted(() => ({
  mockUpdateSupplier: vi.fn(),
}));

vi.mock("../../storage", () => ({
  storage: { updateSupplier: mockUpdateSupplier },
  db: {},
  pool: { on: vi.fn() },
}));

vi.mock("../../permissions", () => ({
  requireOnboarding: (_req: any, _res: any, next: any) => next(),
  getUserContext: vi.fn().mockResolvedValue({ effectiveUserId: "user-1" }),
  createPermissionMiddleware: () => (_req: any, _res: any, next: any) => next(),
  ownerOnly: () => (_req: any, _res: any, next: any) => next(),
  ownerOrManagerOnly: () => (_req: any, _res: any, next: any) => next(),
  PERMISSIONS: { MANAGE_CATALOG: "manage_catalog" },
}));

vi.mock("../middleware", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = "user-1";
    next();
  },
  activityTrackingMiddleware: (_req: any, _res: any, next: any) => next(),
}));

// Import after mocks so vitest hoisting takes effect
import express from "express";
import request from "supertest";
import { isValidAbn, formatAbn, registerInventoryRoutes } from "../inventory";

// ─── Build a minimal test app ─────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  registerInventoryRoutes(app);
  return app;
}

// ─── isValidAbn ───────────────────────────────────────────────────────────────

describe("isValidAbn", () => {
  const validAbns = [
    "51 824 753 556",
    "51824753556",
    "33 051 775 556",
    "33051775556",
  ];

  const invalidAbns = [
    "51 824 753 557",
    "00000000000",
    "12345678901",
    "1234567890",
    "123456789012",
    "",
    "abcdefghijk",
  ];

  it.each(validAbns)("accepts valid ABN: %s", (abn) => {
    expect(isValidAbn(abn)).toBe(true);
  });

  it.each(invalidAbns)("rejects invalid ABN: %s", (abn) => {
    expect(isValidAbn(abn)).toBe(false);
  });

  it("rejects ABN where only the checksum digit is wrong", () => {
    expect(isValidAbn("51824753557")).toBe(false);
  });

  it("accepts ABN with extra spaces between groups", () => {
    expect(isValidAbn("51 824 753 556")).toBe(true);
  });
});

// ─── formatAbn ────────────────────────────────────────────────────────────────

describe("formatAbn", () => {
  it("formats a raw 11-digit string as XX XXX XXX XXX", () => {
    expect(formatAbn("51824753556")).toBe("51 824 753 556");
  });

  it("strips spaces before formatting", () => {
    expect(formatAbn("51 824 753 556")).toBe("51 824 753 556");
  });

  it("strips hyphens before formatting", () => {
    expect(formatAbn("51-824-753-556")).toBe("51 824 753 556");
  });

  it("returns the input trimmed when digit count is not 11", () => {
    expect(formatAbn("1234567890")).toBe("1234567890");
    expect(formatAbn("123456789012")).toBe("123456789012");
    expect(formatAbn("")).toBe("");
  });
});

// ─── PATCH /api/suppliers/:id — HTTP-level route tests ───────────────────────

describe("PATCH /api/suppliers/:id ABN validation", () => {
  const SUPPLIER_ID = "sup-abc-123";

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateSupplier.mockResolvedValue({ id: SUPPLIER_ID, name: "Acme" });
  });

  it("returns 422 when abn is a number (non-string truthy value)", async () => {
    const res = await request(buildApp())
      .patch(`/api/suppliers/${SUPPLIER_ID}`)
      .send({ abn: 51824753556 });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/must be a string/i);
    expect(mockUpdateSupplier).not.toHaveBeenCalled();
  });

  it("returns 422 when abn is boolean true (non-string truthy value)", async () => {
    const res = await request(buildApp())
      .patch(`/api/suppliers/${SUPPLIER_ID}`)
      .send({ abn: true });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/must be a string/i);
    expect(mockUpdateSupplier).not.toHaveBeenCalled();
  });

  it("returns 422 when abn string fails the checksum", async () => {
    const res = await request(buildApp())
      .patch(`/api/suppliers/${SUPPLIER_ID}`)
      .send({ abn: "12345678901" }); // wrong checksum

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/checksum/i);
    expect(mockUpdateSupplier).not.toHaveBeenCalled();
  });

  it("returns 422 when abn is purely non-digit characters", async () => {
    const res = await request(buildApp())
      .patch(`/api/suppliers/${SUPPLIER_ID}`)
      .send({ abn: "abc-def-ghi" });

    expect(res.status).toBe(422);
    expect(mockUpdateSupplier).not.toHaveBeenCalled();
  });

  it("returns 200 and normalises a valid ABN to XX XXX XXX XXX", async () => {
    const res = await request(buildApp())
      .patch(`/api/suppliers/${SUPPLIER_ID}`)
      .send({ abn: "51824753556" }); // valid, unspaced

    expect(res.status).toBe(200);
    const [, , patchArg] = mockUpdateSupplier.mock.calls[0];
    expect(patchArg.abn).toBe("51 824 753 556");
  });

  it("returns 200 when abn is null (clearing the field)", async () => {
    const res = await request(buildApp())
      .patch(`/api/suppliers/${SUPPLIER_ID}`)
      .send({ abn: null });

    expect(res.status).toBe(200);
    expect(mockUpdateSupplier).toHaveBeenCalled();
  });

  it("returns 200 when abn is empty string (clearing the field)", async () => {
    const res = await request(buildApp())
      .patch(`/api/suppliers/${SUPPLIER_ID}`)
      .send({ abn: "" });

    expect(res.status).toBe(200);
    expect(mockUpdateSupplier).toHaveBeenCalled();
  });

  it("returns 200 when abn key is absent (other fields patched, abn untouched)", async () => {
    const res = await request(buildApp())
      .patch(`/api/suppliers/${SUPPLIER_ID}`)
      .send({ name: "New Name" });

    expect(res.status).toBe(200);
    const [, , patchArg] = mockUpdateSupplier.mock.calls[0];
    expect("abn" in patchArg).toBe(false);
  });
});
