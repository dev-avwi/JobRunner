import { useEffect, useRef, useState } from 'react';
import { setSessionToken } from '@/lib/queryClient';

// Public landing page for the mobile → web auth handoff.
// The mobile app opens /auth/handoff?token=<single-use nonce>&next=/bring-your-business.
// We redeem the nonce for a real web session token, store it, then hard-reload
// into the app so every provider boots with the fresh session.
function getSafeNextPath(rawNext: string): string {
  const fallback = '/bring-your-business';

  if (!rawNext.startsWith('/') || rawNext.startsWith('//') || rawNext.includes('\\')) {
    return fallback;
  }

  try {
    const target = new URL(rawNext, window.location.origin);
    if (target.origin !== window.location.origin) {
      return fallback;
    }

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

export default function AuthHandoff() {
  const [error, setError] = useState<string | null>(null);
  const redeemed = useRef(false);

  useEffect(() => {
    if (redeemed.current) return;
    redeemed.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || '';
    const rawNext = params.get('next') || '/bring-your-business';
    const next = getSafeNextPath(rawNext);

    if (!token) {
      setError('This sign-in link is missing its token. Please sign in normally.');
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/auth/web-handoff/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.sessionToken) {
          setError(data?.error || 'This sign-in link has expired. Please sign in normally.');
          return;
        }
        setSessionToken(data.sessionToken);
        // Hard reload so the whole app boots authenticated (matches how other
        // standalone flows re-enter the shell).
        window.location.replace(next);
      } catch {
        setError('Could not reach the server. Please check your connection and try again.');
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-4">
        {error ? (
          <>
            <h1 className="text-xl font-semibold text-foreground">Couldn't sign you in</h1>
            <p className="text-muted-foreground">{error}</p>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover-elevate h-10 px-4 py-2"
              data-testid="link-handoff-signin"
            >
              Go to sign in
            </a>
          </>
        ) : (
          <>
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Signing you in…</p>
          </>
        )}
      </div>
    </div>
  );
}
