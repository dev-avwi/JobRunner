import { describe, expect, it } from 'vitest';
import {
  isStalePaymentIntentCreation,
  paymentIntentCreationRejection,
  requiresSubcontractorPaymentReconciliation,
} from '../../paymentRequestGuards';

describe('subcontractor payment recovery guards', () => {
  it('requires reconciliation before a manual payment after a capture timeout', () => {
    // A timeout can happen after Stripe captured pi_original. The payment
    // request stays processing until the owner flow reconciles that exact ID.
    const timedOutCapture = {
      status: 'processing',
      stripePaymentIntentId: 'pi_original_capture',
    };

    expect(paymentIntentCreationRejection(timedOutCapture)).toEqual({
      httpStatus: 409,
      error: 'This payment request is already being processed',
    });
    // The manual payment route invokes stale-payment reconciliation before it
    // can record a manual payment. A processing request therefore stays held
    // against the original Stripe intent rather than being released to pay again.
    expect(timedOutCapture.stripePaymentIntentId).toBe('pi_original_capture');
    expect(requiresSubcontractorPaymentReconciliation(timedOutCapture)).toBe(true);
  });

  it('blocks a second intent when a pending request already has an immutable Stripe reference', () => {
    const existingPaymentSession = {
      status: 'pending',
      stripePaymentIntentId: 'pi_existing',
    };

    expect(paymentIntentCreationRejection(existingPaymentSession)).toMatchObject({
      httpStatus: 409,
    });
    expect(existingPaymentSession.stripePaymentIntentId).toBe('pi_existing');
  });

  it('allows a new intent only for a pending request without a prior payment session', () => {
    expect(paymentIntentCreationRejection({
      status: 'pending',
      stripePaymentIntentId: null,
    })).toBeNull();
  });

  it('only allows a timed-out creator to resume with its original attempt', () => {
    const createdAt = new Date('2026-08-22T00:00:00.000Z');
    expect(isStalePaymentIntentCreation({
      status: 'creating',
      stripePaymentIntentId: null,
      updatedAt: createdAt,
    }, createdAt.getTime() + 5 * 60 * 1000)).toBe(true);
    expect(isStalePaymentIntentCreation({
      status: 'creating',
      stripePaymentIntentId: 'pi_original_capture',
      updatedAt: createdAt,
    }, createdAt.getTime() + 10 * 60 * 1000)).toBe(false);
  });

  it('treats an in-progress intent creation as an active payment that must not be manually paid', () => {
    expect(paymentIntentCreationRejection({
      status: 'creating',
      stripePaymentIntentId: null,
    })).toEqual({
      httpStatus: 409,
      error: 'This payment request is already being processed',
    });
    expect(requiresSubcontractorPaymentReconciliation({
      status: 'creating',
      stripePaymentIntentId: null,
    })).toBe(true);
  });
});