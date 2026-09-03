/**
 * Server-side verification of Google ID tokens for the mobile sign-in flow.
 *
 * All identity data (sub, email) MUST come from the verified response — never
 * from caller-supplied request fields — to prevent account-takeover attacks.
 */

export interface GoogleMobileTokenClaims {
  /** Google user ID (subject) — the stable, canonical identity. */
  sub: string;
  /** Email address as reported by Google. */
  email: string;
  /** Whether Google has verified this email address. */
  emailVerified: boolean;
}

/**
 * Verifies a Google ID token with Google's tokeninfo endpoint and enforces
 * that the token's audience exactly matches the configured OAuth client ID.
 *
 * Throws a `GoogleTokenError` with an `httpStatus` property so callers can
 * propagate the right HTTP response to the client.
 *
 * @param idToken       - The raw ID token from the mobile OAuth response.
 * @param expectedClientId - The server's configured `GOOGLE_CLIENT_ID`.
 *                          Must not be empty; pass the env var value directly.
 */
export async function verifyGoogleMobileToken(
  idToken: string,
  expectedClientId: string,
): Promise<GoogleMobileTokenClaims> {
  if (!expectedClientId) {
    const err = new GoogleTokenError(
      "Authentication service is not configured",
      503,
    );
    throw err;
  }

  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  let tokenInfoRes: Response;
  try {
    tokenInfoRes = await fetch(url);
  } catch (fetchErr: any) {
    throw new GoogleTokenError("Could not verify Google token", 503);
  }

  if (!tokenInfoRes.ok) {
    throw new GoogleTokenError("Invalid Google token", 401);
  }

  const tokenInfo = (await tokenInfoRes.json()) as {
    sub?: string;
    email?: string;
    email_verified?: string;
    aud?: string;
    error_description?: string;
  };

  if (tokenInfo.error_description || !tokenInfo.sub || !tokenInfo.email) {
    throw new GoogleTokenError("Invalid Google token", 401);
  }

  // Audience must exactly match our client ID — no wildcards, no prefix match.
  // Any mismatch means the token was minted for a different application and
  // must not be accepted.
  if (tokenInfo.aud !== expectedClientId) {
    throw new GoogleTokenError("Invalid Google token audience", 401);
  }

  return {
    sub: tokenInfo.sub,
    email: tokenInfo.email,
    emailVerified: tokenInfo.email_verified === "true",
  };
}

export class GoogleTokenError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "GoogleTokenError";
  }
}
