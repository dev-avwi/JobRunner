import { getErrorMessage } from "./lib/errors";
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Apple Root CA - G3 (used for App Store Server Notifications V2 / App Store Server API).
// Source: https://www.apple.com/certificateauthority/
const APPLE_ROOT_CA_G3 = `-----BEGIN CERTIFICATE-----
MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS
QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u
IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN
MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS
b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y
aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49
AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf
TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517
IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr
MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA
MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4
at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM
6BgD56KyKA==
-----END CERTIFICATE-----`;

let cachedRoot: crypto.X509Certificate | null = null;
function getRoot(): crypto.X509Certificate {
  if (!cachedRoot) cachedRoot = new crypto.X509Certificate(APPLE_ROOT_CA_G3);
  return cachedRoot;
}

export interface AppleVerifyResult {
  valid: boolean;
  payload?: any;
  error?: string;
}

/**
 * Verify an Apple-signed JWS (App Store Server Notifications V2 signedPayload,
 * signedTransactionInfo, or signedRenewalInfo).
 *
 * Steps:
 *   1. Parse the JWS header and require an x5c chain (leaf, intermediate, ...).
 *   2. Verify each cert in the chain is signed by the next, and that the top
 *      cert is signed by the embedded Apple Root CA - G3.
 *   3. Verify cert validity dates.
 *   4. Verify the JWS signature (ES256) using the leaf certificate's public key.
 *   5. Optionally validate the bundleId on the decoded payload.
 */
export function verifyAppleJws(jws: string, expectedBundleId?: string): AppleVerifyResult {
  if (!jws || typeof jws !== 'string') {
    return { valid: false, error: 'Missing JWS' };
  }
  const parts = jws.split('.');
  if (parts.length !== 3) return { valid: false, error: 'Invalid JWS structure' };

  let header: any;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    return { valid: false, error: 'Invalid JWS header' };
  }

  if (header.alg !== 'ES256') {
    return { valid: false, error: `Unsupported alg: ${header.alg}` };
  }
  const x5c = header.x5c;
  if (!Array.isArray(x5c) || x5c.length < 2) {
    return { valid: false, error: 'Missing or short x5c chain' };
  }

  let certs: crypto.X509Certificate[];
  try {
    certs = x5c.map((c: string) => new crypto.X509Certificate(Buffer.from(c, 'base64')));
  } catch (e: unknown) {
    return { valid: false, error: `Invalid certificate in x5c: ${getErrorMessage(e)}` };
  }

  // Verify chain links and date validity.
  const now = Date.now();
  for (let i = 0; i < certs.length; i++) {
    const c = certs[i];
    if (Date.parse(c.validFrom) > now || Date.parse(c.validTo) < now) {
      return { valid: false, error: `Certificate ${i} expired/not yet valid` };
    }
    if (i < certs.length - 1) {
      if (!c.verify(certs[i + 1].publicKey)) {
        return { valid: false, error: `Chain verify failed at index ${i}` };
      }
    }
  }
  // Top of chain must be signed by Apple Root CA G3.
  if (!certs[certs.length - 1].verify(getRoot().publicKey)) {
    return { valid: false, error: 'Chain does not anchor to Apple Root CA G3' };
  }

  // Verify the JWS signature using the leaf cert's public key.
  let payload: any;
  try {
    const leafPem = certs[0].publicKey.export({ format: 'pem', type: 'spki' }) as string;
    payload = jwt.verify(jws, leafPem, { algorithms: ['ES256'] });
  } catch (e: unknown) {
    return { valid: false, error: `JWS signature invalid: ${getErrorMessage(e)}` };
  }

  if (expectedBundleId) {
    // Outer notification carries bundleId on payload.data.bundleId.
    // Nested signedTransactionInfo / signedRenewalInfo carry bundleId at top-level
    // (renewalInfo only sometimes — fall back to outer-context check by caller).
    const bundleId = payload?.data?.bundleId ?? payload?.bundleId;
    if (!bundleId) {
      return { valid: false, error: 'bundleId missing from payload' };
    }
    if (bundleId !== expectedBundleId) {
      return { valid: false, error: `bundleId mismatch: ${bundleId}` };
    }
  }

  return { valid: true, payload };
}

/**
 * Variant for nested JWS payloads (signedTransactionInfo / signedRenewalInfo)
 * where the bundleId is sometimes absent (e.g. renewalInfo). Verifies the
 * cryptographic chain + signature exactly the same way, but treats absent
 * bundleId as acceptable. The caller has already validated bundleId on the
 * outer notification, so an attacker cannot forge a nested payload without
 * also forging the outer one.
 */
export function verifyAppleNestedJws(jws: string, expectedBundleId: string): AppleVerifyResult {
  const r = verifyAppleJws(jws);
  if (!r.valid) return r;
  const bundleId = r.payload?.data?.bundleId ?? r.payload?.bundleId;
  if (bundleId && bundleId !== expectedBundleId) {
    return { valid: false, error: `nested bundleId mismatch: ${bundleId}` };
  }
  return r;
}
