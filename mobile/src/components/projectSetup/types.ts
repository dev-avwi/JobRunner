// Types for the Advanced Project Setup wizard

export interface ProjectPhase {
  clientId: string; // local UUID for referencing
  phaseCode: string;
  name: string;
  description: string;
  scheduledStart: string; // YYYY-MM-DD
  scheduledEnd: string;   // YYYY-MM-DD
  budgetedCost: string;
  assignedUserId: string | null;
  assignedUserIds?: string[];
  sortOrder: number;
}

export interface POItem {
  description: string;
  quantity: string;
  unitPrice: string;
}

export interface PurchaseOrder {
  clientId: string; // local UUID
  poNumber: string;
  supplierId: string | null;
  phaseClientId: string | null; // references ProjectPhase.clientId
  requiredDate: string; // YYYY-MM-DD
  terms: string;
  notes: string;
  items: POItem[];
}

export interface ClaimStage {
  clientId: string; // local UUID
  name: string;
  claimDate: string; // YYYY-MM-DD
  percentage: string;
  retentionPercent: string;
  phaseClientId: string | null;
}

export interface ChecklistItem {
  clientId: string;
  title: string;
}

export interface RequiredInfoRow {
  clientId: string;
  label: string;
  value: string;
}

export interface DocumentFile {
  clientId: string;
  uri: string;
  name: string;
  mimeType: string;
  title: string;
  category: string;
}

export interface FinancialSettings {
  contractValue: string;
  totalBudget: string;
  materialMarkupPct: string;
  equipmentMarkupPct: string;
  subcontractorMarkupPct: string;
  retentionPercent: string;
  defectsLiabilityMonths: string;
  paymentTerms: string;
  depositPercent: string;
}

export interface ProjectSetupData {
  phases: ProjectPhase[];
  purchaseOrders: PurchaseOrder[];
  claimStages: ClaimStage[];
  checklistItems: ChecklistItem[];
  requiredInformation: RequiredInfoRow[];
  documents: DocumentFile[];
  financialSettings: FinancialSettings;
}

export const DEFAULT_FINANCIAL_SETTINGS: FinancialSettings = {
  contractValue: '',
  totalBudget: '',
  materialMarkupPct: '',
  equipmentMarkupPct: '',
  subcontractorMarkupPct: '',
  retentionPercent: '',
  defectsLiabilityMonths: '',
  paymentTerms: '',
  depositPercent: '',
};

export const DOCUMENT_CATEGORIES = [
  'Contract',
  'Drawings',
  'Specifications',
  'Permits',
  'Insurance',
  'Safety',
  'Other',
];

/** Returns true if any advanced data has been filled in (used for offline blocking). */
export function hasAdvancedData(data: ProjectSetupData): boolean {
  const { phases, purchaseOrders, claimStages, checklistItems, requiredInformation, documents, financialSettings } = data;
  if (phases.length > 0) return true;
  if (purchaseOrders.length > 0) return true;
  if (claimStages.length > 0) return true;
  if (checklistItems.length > 0) return true;
  if (requiredInformation.length > 0) return true;
  if (documents.length > 0) return true;
  const fs = financialSettings;
  if (
    fs.contractValue ||
    fs.totalBudget ||
    fs.materialMarkupPct ||
    fs.equipmentMarkupPct ||
    fs.subcontractorMarkupPct ||
    fs.retentionPercent ||
    fs.defectsLiabilityMonths ||
    fs.paymentTerms ||
    fs.depositPercent
  ) return true;
  return false;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function invalidNonNegativeNumber(value: string): boolean {
  if (!value.trim()) return false;
  const number = Number(value);
  return !Number.isFinite(number) || number < 0;
}

function invalidMoney(value: string): boolean {
  if (!value.trim()) return false;
  return !/^\d+(\.\d{1,2})?$/.test(value.trim());
}

function invalidPercent(value: string): boolean {
  if (!value.trim()) return false;
  const number = Number(value);
  return !Number.isFinite(number) || number < 0 || number > 100;
}

export function validateProjectSetup(data: ProjectSetupData): string | null {
  const fs = data.financialSettings;
  if (invalidNonNegativeNumber(fs.contractValue)) return 'Contract value must be a positive number';
  if (invalidNonNegativeNumber(fs.totalBudget)) return 'Total budget must be a positive number';
  if (invalidNonNegativeNumber(fs.materialMarkupPct)) return 'Material markup must be a positive number';
  if (invalidNonNegativeNumber(fs.equipmentMarkupPct)) return 'Equipment markup must be a positive number';
  if (invalidNonNegativeNumber(fs.subcontractorMarkupPct)) return 'Subcontractor markup must be a positive number';
  if (invalidPercent(fs.retentionPercent)) return 'Retention must be between 0 and 100%';
  if (invalidPercent(fs.depositPercent)) return 'Deposit must be between 0 and 100%';
  if (
    fs.defectsLiabilityMonths &&
    (!Number.isInteger(Number(fs.defectsLiabilityMonths)) || Number(fs.defectsLiabilityMonths) < 0)
  ) return 'Defects liability months must be a positive whole number';

  for (const phase of data.phases) {
    if (!phase.name.trim()) return 'Every phase needs a name';
    if (phase.scheduledStart && !isValidDate(phase.scheduledStart)) {
      return `Enter a valid start date for ${phase.name}`;
    }
    if (phase.scheduledEnd && !isValidDate(phase.scheduledEnd)) {
      return `Enter a valid end date for ${phase.name}`;
    }
    if (
      phase.scheduledStart &&
      phase.scheduledEnd &&
      phase.scheduledEnd < phase.scheduledStart
    ) return `${phase.name} must end on or after its start date`;
    if (invalidMoney(phase.budgetedCost)) {
      return `Enter a non-negative budget with up to 2 decimal places for ${phase.name}`;
    }
  }

  for (const [poIndex, po] of data.purchaseOrders.entries()) {
    const label = po.poNumber.trim() || `purchase order ${poIndex + 1}`;
    if (!po.poNumber.trim()) return `Enter a PO number for ${label}`;
    if (!po.supplierId) return `Select a supplier for ${label}`;
    if (po.requiredDate && !isValidDate(po.requiredDate)) return `Enter a valid due date for ${label}`;
    if (po.items.length === 0) return `Add at least one line item to ${label}`;
    for (const [itemIndex, item] of po.items.entries()) {
      if (!item.description.trim()) return `Add a description to item ${itemIndex + 1} in ${label}`;
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return `Item ${itemIndex + 1} in ${label} needs a positive whole-number quantity`;
      }
      if (invalidNonNegativeNumber(item.unitPrice) || !item.unitPrice.trim()) {
        return `Item ${itemIndex + 1} in ${label} needs a valid unit price`;
      }
    }
  }

  let claimTotal = 0;
  for (const stage of data.claimStages) {
    if (!stage.name.trim()) return 'Every claim stage needs a name';
    if (!stage.claimDate || !isValidDate(stage.claimDate)) {
      return `Enter a valid claim date for ${stage.name}`;
    }
    const percentage = Number(stage.percentage);
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
      return `${stage.name} must have a percentage between 0 and 100`;
    }
    if (invalidPercent(stage.retentionPercent)) {
      return `${stage.name} retention must be between 0 and 100%`;
    }
    claimTotal += percentage;
  }
  if (claimTotal > 100.0001) return 'Claim stage percentages cannot total more than 100%';

  if (data.checklistItems.some((item) => !item.title.trim())) {
    return 'Every checklist item needs a title';
  }
  if (data.requiredInformation.some((row) => !row.label.trim())) {
    return 'Every required information row needs a label';
  }
  return null;
}
