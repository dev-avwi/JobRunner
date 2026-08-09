export function formatCurrency(amount: number | string | undefined | null, options?: { compact?: boolean }): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  if (isNaN(num)) return '$0.00';

  if (options?.compact) {
    return `$${num.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function validateABN(abn: string): { valid: boolean; error?: string } {
  const digits = abn.replace(/\s/g, '');

  if (digits.length === 0) {
    return { valid: true };
  }

  if (!/^\d+$/.test(digits)) {
    return { valid: false, error: 'ABN must contain only numbers' };
  }

  if (digits.length !== 11) {
    return { valid: false, error: 'ABN must be exactly 11 digits' };
  }

  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const chars = digits.split('').map(Number);
  chars[0] -= 1;

  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += chars[i] * weights[i];
  }

  if (sum % 89 !== 0) {
    return { valid: false, error: 'Invalid ABN — checksum does not match' };
  }

  return { valid: true };
}

export function formatABN(abn: string): string {
  const digits = abn.replace(/\s/g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;
}
