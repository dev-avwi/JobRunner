/**
 * Business SMS requires the business's own dedicated number. Every SMS send
 * route returns 402 with code DEDICATED_NUMBER_REQUIRED when no number is
 * configured. apiRequest throws `Error("<status>: <body>")`, so we detect the
 * code (or the smsService error string) inside the thrown message.
 */
export function isDedicatedNumberError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!message) return false;
  return (
    message.includes('DEDICATED_NUMBER_REQUIRED') ||
    /dedicated (phone )?number/i.test(message)
  );
}

export const GET_NUMBER_TOAST = {
  title: 'Get your business number',
  description:
    'To send SMS to clients, your business needs its own dedicated phone number.',
} as const;

/** Deep link that opens Chat Hub with the number-purchase dialog. */
export const GET_NUMBER_URL = '/chat?setup=number';
