import { hapticFeedback } from './haptics';

// App-wide "delight" trigger for the few moments worth celebrating:
// invoice paid, quote accepted, job completed. Fires a brief celebration
// overlay (see Celebration component) plus a success haptic.

export type CelebrationType = 'invoice_paid' | 'quote_accepted' | 'job_completed';

type Listener = (type: CelebrationType) => void;

const listeners = new Set<Listener>();

export function celebrate(type: CelebrationType) {
  hapticFeedback.success();
  listeners.forEach((l) => {
    try {
      l(type);
    } catch {
      // ignore listener errors
    }
  });
}

export function onCelebrate(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
