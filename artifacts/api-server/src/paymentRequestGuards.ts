type PaymentRequestIntentState = {
  status: string | null | undefined;
  stripePaymentIntentId?: string | null;
};

export type PaymentIntentCreationRejection = {
  httpStatus: number;
  error: string;
};

/**
 * A payment intent may only be created once for a pending request. Replacing an
 * intent after capture begins would lose the immutable Stripe reference that
 * stale-payment recovery needs to reconcile before a manual payment is allowed.
 */
export function paymentIntentCreationRejection(
  request: PaymentRequestIntentState,
): PaymentIntentCreationRejection | null {
  if (request.status === 'paid') {
    return { httpStatus: 409, error: 'Payment has already been made' };
  }
  if (request.status === 'cancelled') {
    return { httpStatus: 410, error: 'Payment request has been cancelled' };
  }
  if (request.status !== 'pending') {
    return { httpStatus: 409, error: 'This payment request is already being processed' };
  }
  if (request.stripePaymentIntentId) {
    return {
      httpStatus: 409,
      error: 'A payment session already exists for this request. Please complete or cancel it before trying again.',
    };
  }
  return null;
}

export function requiresSubcontractorPaymentReconciliation(
  request: PaymentRequestIntentState | null | undefined,
) {
  return request?.status === 'creating' || request?.status === 'processing';
}

export function isStalePaymentIntentCreation(
  request: (PaymentRequestIntentState & { updatedAt?: Date | string | null }) | null | undefined,
  now = Date.now(),
) {
  if (request?.status !== 'creating' || request.stripePaymentIntentId) return false;
  const updatedAt = request.updatedAt ? new Date(request.updatedAt).getTime() : 0;
  return now - updatedAt >= 5 * 60 * 1000;
}