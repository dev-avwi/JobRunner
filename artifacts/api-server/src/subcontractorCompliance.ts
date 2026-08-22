export type ComplianceStatus = 'valid' | 'expiring_soon' | 'expired';

type ComplianceSource = {
  licenseType?: string | null;
  licenseNumber?: string | null;
  licenseExpiry?: Date | string | null;
  insurancePolicyNumber?: string | null;
  insuranceExpiry?: Date | string | null;
};

const DAYS_UNTIL_WARNING = 30;

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date
    ? new Date(value)
    : /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00`)
      : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfToday(): Date {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

export function getSubcontractorCompliance(source: ComplianceSource | null | undefined) {
  const today = startOfToday();
  const warningDate = new Date(today);
  warningDate.setDate(warningDate.getDate() + DAYS_UNTIL_WARNING);

  const documents = [
    { kind: 'licence' as const, expiry: asDate(source?.licenseExpiry) },
    { kind: 'insurance' as const, expiry: asDate(source?.insuranceExpiry) },
  ].filter((document) => document.expiry);

  const expiredDocuments = documents
    .filter((document) => document.expiry! < today)
    .map((document) => document.kind);
  const expiringDocuments = documents
    .filter((document) => document.expiry! >= today && document.expiry! <= warningDate)
    .map((document) => document.kind);

  const status: ComplianceStatus = expiredDocuments.length > 0
    ? 'expired'
    : expiringDocuments.length > 0
      ? 'expiring_soon'
      : 'valid';

  return {
    licenseType: source?.licenseType ?? null,
    licenseNumber: source?.licenseNumber ?? null,
    licenseExpiry: source?.licenseExpiry ?? null,
    insurancePolicyNumber: source?.insurancePolicyNumber ?? null,
    insuranceExpiry: source?.insuranceExpiry ?? null,
    status,
    expiredDocuments,
    expiringDocuments,
    requiresPaymentConfirmation: status === 'expired',
  };
}

export function complianceStatusLabel(status: ComplianceStatus): 'Valid' | 'Expiring Soon' | 'Expired' {
  if (status === 'expired') return 'Expired';
  if (status === 'expiring_soon') return 'Expiring Soon';
  return 'Valid';
}