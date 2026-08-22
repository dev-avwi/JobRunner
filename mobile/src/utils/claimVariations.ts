/**
 * Shared helpers for variation-to-claim-line-item conversion.
 *
 * Extracted from handleSaveClaim in mobile/app/job/[id].tsx so the mapping
 * logic is testable in isolation and the type contract is explicit.
 */

export interface ApprovedClaimVariation {
  id: string;
  number: string;
  title: string;
  totalAmount: string;
  suggestedLineItem: {
    description: string;
    contractValue: string;
    previouslyClaimed: string;
    thisClaim: string;
  };
}

export interface VariationLineItem {
  variationId: string;
  description: string;
  contractValue: string;
  previouslyClaimed: string;
  thisClaim: string;
  sortOrder: number;
}

/**
 * Converts the user's variation selection into claim line items ready to POST.
 *
 * @param approvedClaimVariations - Full list fetched from /variations/approved-for-claim
 * @param selectedIds             - Set of variation IDs the user has ticked
 * @param sortOffset              - 0 when no phase line is pre-filled; 1 when a
 *                                  phase line item occupies sortOrder 0
 */
export function buildVariationLineItems(
  approvedClaimVariations: ApprovedClaimVariation[],
  selectedIds: Set<string>,
  sortOffset: number,
): VariationLineItem[] {
  return approvedClaimVariations
    .filter((v) => selectedIds.has(v.id))
    .map((v, index) => ({
      variationId: v.id,
      description: v.suggestedLineItem.description,
      contractValue: v.suggestedLineItem.contractValue,
      previouslyClaimed: v.suggestedLineItem.previouslyClaimed,
      thisClaim: v.suggestedLineItem.thisClaim,
      sortOrder: sortOffset + index,
    }));
}
