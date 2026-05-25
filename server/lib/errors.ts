/**
 * Narrow an unknown thrown value into a human-readable message.
 *
 * With `strict` (and therefore `useUnknownInCatchVariables`) enabled, every
 * `catch (err)` is `unknown`. This helper avoids the `(err as any).message`
 * cast that used to riddle the backend.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message: unknown }).message;
    return typeof m === 'string' ? m : String(m);
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** Best-effort extraction of an `Error` stack trace. */
export function getErrorStack(err: unknown): string | undefined {
  if (err instanceof Error) return err.stack;
  if (err && typeof err === 'object' && 'stack' in err) {
    const s = (err as { stack: unknown }).stack;
    return typeof s === 'string' ? s : undefined;
  }
  return undefined;
}
