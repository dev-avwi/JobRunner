/**
 * Tests for buildVariationLineItems (mobile/src/utils/claimVariations).
 *
 * This is the production helper used by handleSaveClaim in
 * mobile/app/job/[id].tsx. The key guarantee under test is that the Set of
 * selected variation IDs is never mutated — so if the server rejects the POST
 * (e.g. with 409 "already included") the component's selection state survives
 * intact and the user can retry without re-picking their variations.
 */

import {
  buildVariationLineItems,
  type ApprovedClaimVariation,
} from "../claimVariations";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VAR_A: ApprovedClaimVariation = {
  id: "var-aaa",
  number: "1",
  title: "Extra Groundworks",
  totalAmount: "5500.00",
  suggestedLineItem: {
    description: "Variation 1: Extra Groundworks",
    contractValue: "5000.00",
    previouslyClaimed: "0.00",
    thisClaim: "5000.00",
  },
};

const VAR_B: ApprovedClaimVariation = {
  id: "var-bbb",
  number: "2",
  title: "Concrete Upgrade",
  totalAmount: "3520.00",
  suggestedLineItem: {
    description: "Variation 2: Concrete Upgrade",
    contractValue: "3200.00",
    previouslyClaimed: "0.00",
    thisClaim: "3200.00",
  },
};

// ─── Line item mapping ────────────────────────────────────────────────────────

describe("buildVariationLineItems — line item mapping", () => {
  it("builds one line item for each selected variation", () => {
    const lines = buildVariationLineItems([VAR_A, VAR_B], new Set(["var-aaa", "var-bbb"]), 0);
    expect(lines).toHaveLength(2);
    expect(lines[0].variationId).toBe("var-aaa");
    expect(lines[1].variationId).toBe("var-bbb");
  });

  it("copies description, contractValue, previouslyClaimed and thisClaim from suggestedLineItem", () => {
    const [line] = buildVariationLineItems([VAR_A], new Set(["var-aaa"]), 0);
    expect(line.description).toBe("Variation 1: Extra Groundworks");
    expect(line.contractValue).toBe("5000.00");
    expect(line.previouslyClaimed).toBe("0.00");
    expect(line.thisClaim).toBe("5000.00");
  });

  it("applies sortOffset 0 when no phase line is pre-filled", () => {
    const lines = buildVariationLineItems([VAR_A, VAR_B], new Set(["var-aaa", "var-bbb"]), 0);
    expect(lines[0].sortOrder).toBe(0);
    expect(lines[1].sortOrder).toBe(1);
  });

  it("applies sortOffset 1 when a phase line occupies sortOrder 0", () => {
    const lines = buildVariationLineItems([VAR_A, VAR_B], new Set(["var-aaa", "var-bbb"]), 1);
    expect(lines[0].sortOrder).toBe(1);
    expect(lines[1].sortOrder).toBe(2);
  });

  it("filters out variations whose IDs are not in the selected Set", () => {
    const lines = buildVariationLineItems([VAR_A, VAR_B], new Set(["var-bbb"]), 0);
    expect(lines).toHaveLength(1);
    expect(lines[0].variationId).toBe("var-bbb");
  });

  it("returns an empty array when the selection is empty", () => {
    const lines = buildVariationLineItems([VAR_A, VAR_B], new Set(), 0);
    expect(lines).toHaveLength(0);
  });

  it("returns an empty array when the available variations list is empty", () => {
    const lines = buildVariationLineItems([], new Set(["var-aaa"]), 0);
    expect(lines).toHaveLength(0);
  });
});

// ─── Selector state preservation on API rejection ─────────────────────────────
//
// handleSaveClaim in mobile/app/job/[id].tsx clears selectedClaimVariationIds
// only on success. If the server returns an error (e.g. 409 "already included")
// the catch block runs without touching the Set — so the user can retry.
//
// buildVariationLineItems must not mutate the Set it reads from, because the
// same Set reference is held in component state and reused on retry.

describe("buildVariationLineItems — does not mutate the selectedIds Set", () => {
  it("leaves the Set unchanged after building line items", () => {
    const selected = new Set(["var-aaa", "var-bbb"]);
    const before = new Set(selected); // snapshot

    buildVariationLineItems([VAR_A, VAR_B], selected, 0);

    expect(selected.size).toBe(before.size);
    expect(selected.has("var-aaa")).toBe(true);
    expect(selected.has("var-bbb")).toBe(true);
  });

  it("Set stays intact after a filtered (partial) call — simulates retry after 409", () => {
    // Simulate: first POST was rejected (409 for var-aaa), user's Set is untouched.
    // On retry they deselect var-aaa and call again with only var-bbb still selected.
    const selected = new Set(["var-aaa", "var-bbb"]);

    // First call (produces the payload that gets rejected)
    buildVariationLineItems([VAR_A, VAR_B], selected, 0);

    // Set is still intact — user can deselect var-aaa and retry
    expect(selected.has("var-aaa")).toBe(true);
    expect(selected.has("var-bbb")).toBe(true);

    // User manually removes var-aaa from their selection
    selected.delete("var-aaa");

    // Retry call — only var-bbb
    const retryLines = buildVariationLineItems([VAR_A, VAR_B], selected, 0);
    expect(retryLines).toHaveLength(1);
    expect(retryLines[0].variationId).toBe("var-bbb");
  });
});
