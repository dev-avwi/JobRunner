const SHARED_NUMBER_DENYLIST_E164 = [
  '+61485013993',
];

export function toE164(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) {
    return digits;
  }
  if (digits.startsWith('61') && digits.length >= 11) {
    return '+' + digits;
  }
  if (digits.startsWith('0') && digits.length >= 10) {
    return '+61' + digits.slice(1);
  }
  return '+' + digits;
}

export function isSharedPlatformNumber(phone: string): boolean {
  if (!phone) return false;

  const normalized = toE164(phone);

  if (SHARED_NUMBER_DENYLIST_E164.includes(normalized)) {
    return true;
  }

  const envSharedNumber = process.env.TWILIO_PHONE_NUMBER;
  if (envSharedNumber) {
    const envNormalized = toE164(envSharedNumber);
    if (normalized === envNormalized) {
      return true;
    }
  }

  return false;
}
