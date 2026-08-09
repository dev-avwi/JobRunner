// Lightweight, app-wide "delight" trigger. Fires a brief celebration overlay
// (see CelebrationOverlay) plus a short haptic buzz where supported. Used at the
// few moments worth celebrating: invoice paid, quote accepted, job completed.

export type CelebrationType = "invoice_paid" | "quote_accepted" | "job_completed";

export interface CelebrationDetail {
  type: CelebrationType;
}

const EVENT_NAME = "jobrunner:celebrate";

export function celebrate(type: CelebrationType) {
  if (typeof window === "undefined") return;

  // Short, restrained haptic (mobile browsers / Android). Safari ignores it.
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([12, 40, 12]);
    }
  } catch {
    // vibration not available - ignore
  }

  window.dispatchEvent(
    new CustomEvent<CelebrationDetail>(EVENT_NAME, { detail: { type } })
  );
}

export function onCelebrate(handler: (detail: CelebrationDetail) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<CelebrationDetail>).detail);
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
