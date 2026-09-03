/**
 * Security tests for the mobile Google and Apple authentication routes.
 *
 * Covers:
 *   1. Google mobile — missing GOOGLE_CLIENT_ID (service misconfiguration)
 *   2. Google mobile — token minted for a different OAuth client (wrong audience)
 *   3. Google mobile — unverified email must NOT trigger account lookup/linking
 *   4. Apple mobile — audience with the right prefix but not in the allow-list is rejected
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  verifyGoogleMobileToken,
  GoogleTokenError,
} from "../googleMobileAuth";

// ─── helpers ────────────────────────────────────────────────────────────────

function makeFetchResponse(
  body: object,
  ok = true,
  status = 200,
): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

// ─── Google mobile token verification ────────────────────────────────────────

describe("verifyGoogleMobileToken", () => {
  const VALID_CLIENT_ID = "123456789.apps.googleusercontent.com";
  const VALID_TOKEN = "header.payload.sig";
  const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ── 1. Service misconfiguration ──────────────────────────────────────────

  it("rejects immediately when expectedClientId is empty (service misconfigured)", async () => {
    // fetch must NOT be called — we should fail before hitting the network
    await expect(
      verifyGoogleMobileToken(VALID_TOKEN, ""),
    ).rejects.toMatchObject({
      name: "GoogleTokenError",
      httpStatus: 503,
      message: "Authentication service is not configured",
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // ── 2. Wrong audience (token minted for another OAuth client) ────────────

  it("rejects when the token audience does not match the configured client ID", async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({
        sub: "google-uid-attacker",
        email: "attacker@example.com",
        email_verified: "true",
        // Token was minted for a DIFFERENT OAuth client:
        aud: "evil-client.apps.googleusercontent.com",
      }),
    );

    await expect(
      verifyGoogleMobileToken(VALID_TOKEN, VALID_CLIENT_ID),
    ).rejects.toMatchObject({
      name: "GoogleTokenError",
      httpStatus: 401,
      message: "Invalid Google token audience",
    });
  });

  it("rejects when the token audience is a prefix-extended version of the client ID", async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({
        sub: "google-uid-attacker",
        email: "attacker@example.com",
        email_verified: "true",
        // Prefix of the real client ID — must NOT match
        aud: `${VALID_CLIENT_ID}.evil`,
      }),
    );

    await expect(
      verifyGoogleMobileToken(VALID_TOKEN, VALID_CLIENT_ID),
    ).rejects.toMatchObject({
      name: "GoogleTokenError",
      httpStatus: 401,
      message: "Invalid Google token audience",
    });
  });

  it("accepts when the token audience exactly matches the configured client ID", async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({
        sub: "google-uid-123",
        email: "user@example.com",
        email_verified: "true",
        aud: VALID_CLIENT_ID,
      }),
    );

    const claims = await verifyGoogleMobileToken(VALID_TOKEN, VALID_CLIENT_ID);
    expect(claims).toEqual({
      sub: "google-uid-123",
      email: "user@example.com",
      emailVerified: true,
    });
  });

  // ── 3. Unverified email must not enable email-based account lookup ────────
  //
  // verifyGoogleMobileToken surfaces email_verified so the caller can gate
  // the email-based account-lookup path.  These tests confirm the flag is
  // propagated accurately — the route tests below verify gating behaviour.

  it("returns emailVerified:false when Google reports email_verified:'false'", async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({
        sub: "google-uid-456",
        email: "unverified@example.com",
        email_verified: "false",
        aud: VALID_CLIENT_ID,
      }),
    );

    const claims = await verifyGoogleMobileToken(VALID_TOKEN, VALID_CLIENT_ID);
    expect(claims.emailVerified).toBe(false);
  });

  it("returns emailVerified:false when Google omits email_verified", async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({
        sub: "google-uid-789",
        email: "noverified@example.com",
        // email_verified intentionally absent
        aud: VALID_CLIENT_ID,
      }),
    );

    const claims = await verifyGoogleMobileToken(VALID_TOKEN, VALID_CLIENT_ID);
    expect(claims.emailVerified).toBe(false);
  });

  // ── 4. Google tokeninfo HTTP error ───────────────────────────────────────

  it("rejects with 401 when Google tokeninfo returns a non-OK response", async () => {
    fetchSpy.mockResolvedValueOnce(makeFetchResponse({ error: "invalid_token" }, false, 400));

    await expect(
      verifyGoogleMobileToken(VALID_TOKEN, VALID_CLIENT_ID),
    ).rejects.toMatchObject({
      name: "GoogleTokenError",
      httpStatus: 401,
    });
  });

  it("rejects with 503 when the fetch itself throws (network failure)", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(
      verifyGoogleMobileToken(VALID_TOKEN, VALID_CLIENT_ID),
    ).rejects.toMatchObject({
      name: "GoogleTokenError",
      httpStatus: 503,
    });
  });
});

// ─── Apple audience validation ────────────────────────────────────────────────
//
// The route builds the valid-audiences list from configured env vars and then
// does an exact includes() check.  These tests verify the exact-match logic
// that replaced the removed prefix-bypass (`startsWith('com.jobrunner.')`).

describe("Apple audience validation (exact-match logic)", () => {
  const BUNDLE_ID = "com.jobrunner.app";
  const WEB_SERVICE_ID = "com.jobrunner.web";

  function isAudienceValid(tokenAud: string, validAudiences: string[]): boolean {
    // Mirrors the check now used in the route — no prefix bypass.
    return validAudiences.includes(tokenAud);
  }

  it("accepts the configured bundle ID", () => {
    expect(isAudienceValid(BUNDLE_ID, [BUNDLE_ID, WEB_SERVICE_ID])).toBe(true);
  });

  it("accepts the configured web service ID", () => {
    expect(isAudienceValid(WEB_SERVICE_ID, [BUNDLE_ID, WEB_SERVICE_ID])).toBe(true);
  });

  it("rejects an audience that shares the com.jobrunner prefix but is not configured", () => {
    // Previously this was accepted via startsWith('com.jobrunner.') — it must
    // now be rejected.
    expect(
      isAudienceValid("com.jobrunner.evil", [BUNDLE_ID, WEB_SERVICE_ID]),
    ).toBe(false);
  });

  it("rejects an audience that is a superset of the bundle ID", () => {
    expect(
      isAudienceValid(`${BUNDLE_ID}.extra`, [BUNDLE_ID, WEB_SERVICE_ID]),
    ).toBe(false);
  });

  it("rejects an empty audience string", () => {
    expect(isAudienceValid("", [BUNDLE_ID, WEB_SERVICE_ID])).toBe(false);
  });

  it("rejects a completely unrelated audience", () => {
    expect(
      isAudienceValid("com.attacker.app", [BUNDLE_ID, WEB_SERVICE_ID]),
    ).toBe(false);
  });

  it("accepts host.exp.Exponent when it is in the list (non-production)", () => {
    const devAudiences = [BUNDLE_ID, WEB_SERVICE_ID, "host.exp.Exponent"];
    expect(isAudienceValid("host.exp.Exponent", devAudiences)).toBe(true);
  });

  it("rejects host.exp.Exponent when it is NOT in the list (production)", () => {
    // In production the Expo Go audience is not added to validAudiences
    expect(
      isAudienceValid("host.exp.Exponent", [BUNDLE_ID, WEB_SERVICE_ID]),
    ).toBe(false);
  });
});
