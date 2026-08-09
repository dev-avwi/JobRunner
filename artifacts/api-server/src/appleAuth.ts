import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
const KEYS_TTL_MS = 60 * 60 * 1000; // 1 hour

let cachedKeys: { keys: any[]; fetchedAt: number } | null = null;

async function fetchAppleKeys(force = false): Promise<any[]> {
  if (!force && cachedKeys && Date.now() - cachedKeys.fetchedAt < KEYS_TTL_MS) {
    return cachedKeys.keys;
  }
  const res = await fetch(APPLE_KEYS_URL);
  if (!res.ok) {
    throw new Error('Failed to fetch Apple public keys');
  }
  const data = (await res.json()) as { keys?: any[] };
  cachedKeys = { keys: data.keys || [], fetchedAt: Date.now() };
  return cachedKeys.keys;
}

export interface AppleTokenPayload {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
  iss?: string;
  aud?: string;
  exp?: number;
  iat?: number;
  nonce?: string;
}

/**
 * Verifies an Apple identity token's cryptographic signature against Apple's
 * published JWKS, plus issuer and expiry. Throws if the token is forged,
 * tampered with, expired, or not actually issued by Apple.
 *
 * Audience is intentionally NOT enforced here — callers keep their own
 * (slightly different) audience rules for the mobile bundle id vs the web
 * service id — but a verified, untampered payload is returned for them to check.
 */
export async function verifyAppleIdentityToken(identityToken: string): Promise<AppleTokenPayload> {
  const decoded = jwt.decode(identityToken, { complete: true }) as {
    header: { kid?: string; alg?: string };
  } | null;

  const kid = decoded?.header?.kid;
  if (!kid) {
    throw new Error('Invalid identity token: missing key id');
  }
  if (decoded?.header?.alg !== 'RS256') {
    throw new Error('Invalid identity token: unexpected algorithm');
  }

  let keys = await fetchAppleKeys();
  let jwk = keys.find((k) => k.kid === kid);
  if (!jwk) {
    // Apple may have rotated keys since we last cached — refresh once.
    keys = await fetchAppleKeys(true);
    jwk = keys.find((k) => k.kid === kid);
  }
  if (!jwk) {
    throw new Error('No matching Apple public key for token');
  }

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });

  const verified = jwt.verify(identityToken, publicKey, {
    algorithms: ['RS256'],
    issuer: 'https://appleid.apple.com',
  }) as AppleTokenPayload;

  return verified;
}
