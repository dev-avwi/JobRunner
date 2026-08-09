import { captureException } from './sentry';
import { showToast } from './toast';

export interface ReportErrorOptions {
  context?: Record<string, unknown>;
  toast?: string | false;
  silent?: boolean;
}

function extractMessage(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null) {
    const anyErr = err as any;
    if (typeof anyErr.message === 'string') return anyErr.message;
    if (typeof anyErr.error === 'string') return anyErr.error;
  }
  return fallback;
}

export function reportError(
  err: unknown,
  scope: string,
  opts: ReportErrorOptions = {},
): void {
  const { context, toast, silent } = opts;
  const msg = extractMessage(err, 'Unknown error');

  if (__DEV__) {
    console.error(`[${scope}]`, msg, err);
  }

  captureException(err, { scope, ...context });

  if (silent || toast === false) return;
  showToast({
    type: 'error',
    message: typeof toast === 'string' ? toast : 'Something went wrong',
    description: msg.length > 140 ? msg.slice(0, 137) + '…' : msg,
  });
}

export function reportWarning(message: string, scope: string, context?: Record<string, unknown>): void {
  if (__DEV__) {
    console.warn(`[${scope}]`, message, context);
  }
  captureException(new Error(message), { scope, level: 'warning', ...context });
}

let installed = false;

export function installGlobalErrorHandler(): void {
  if (installed) return;
  installed = true;

  const ErrorUtils: any = (globalThis as any).ErrorUtils;
  if (ErrorUtils && typeof ErrorUtils.getGlobalHandler === 'function') {
    const previous = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((err: unknown, isFatal?: boolean) => {
      try {
        captureException(err, { scope: 'global', isFatal: !!isFatal });
      } catch {}
      if (typeof previous === 'function') {
        try { previous(err, isFatal); } catch {}
      }
    });
  }

  const rejectionTracking = (() => {
    try {
      return require('promise/setimmediate/rejection-tracking');
    } catch {
      return null;
    }
  })();

  if (rejectionTracking && typeof rejectionTracking.enable === 'function') {
    rejectionTracking.enable({
      allRejections: true,
      onUnhandled: (id: number, err: unknown) => {
        if (__DEV__) console.warn(`[UnhandledPromise:${id}]`, err);
        captureException(err, { scope: 'unhandled_promise_rejection', rejectionId: id });
      },
      onHandled: () => {},
    });
  }
}
