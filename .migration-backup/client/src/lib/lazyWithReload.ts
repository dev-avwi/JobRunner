import React from "react";

const RELOAD_FLAG_KEY = "chunk-reload-attempted";

/**
 * Detects the dynamic-import / chunk-load failures that happen when a user has
 * a stale tab open after a new deploy: the content-hashed chunk filenames have
 * changed, so the old filename 404s and the import rejects.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error ? error.message : String(error);
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /dynamically imported module/i.test(message)
  );
}

function getReloadFlag(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_FLAG_KEY) !== null;
  } catch {
    return false;
  }
}

function setReloadFlag(): void {
  try {
    sessionStorage.setItem(RELOAD_FLAG_KEY, String(Date.now()));
  } catch {
    /* ignore storage failures */
  }
}

export function clearReloadFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_FLAG_KEY);
  } catch {
    /* ignore storage failures */
  }
}

/**
 * Drop-in replacement for `React.lazy` that recovers from stale chunk loads.
 *
 * When a dynamic import fails because the chunk no longer exists on the server
 * (i.e. after a deploy), this performs a single guarded full-page reload to
 * pull the new chunk manifest. The guard lives in `sessionStorage` so it can't
 * loop: if a reload was already attempted and the import still fails, the error
 * is surfaced to the nearest error boundary instead of reloading again.
 *
 * A successful load clears the guard so a future deploy can recover again.
 * Non-chunk errors (genuine app errors, real offline failures) are never
 * swallowed — they propagate to the boundary as usual.
 */
export function lazyWithReload<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return React.lazy(() =>
    factory()
      .then((module) => {
        clearReloadFlag();
        return module;
      })
      .catch((error: unknown) => {
        if (isChunkLoadError(error) && !getReloadFlag()) {
          setReloadFlag();
          window.location.reload();
          // Return a never-resolving promise so Suspense keeps showing the
          // fallback while the page reloads, rather than flashing an error.
          return new Promise<{ default: T }>(() => {});
        }
        throw error;
      }),
  );
}
