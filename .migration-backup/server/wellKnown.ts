import type { Express, Request, Response } from "express";

export const APP_LINKS_DOMAIN = "jobrunner.com.au";

const IOS_APP_ID = process.env.IOS_APP_LINKS_APP_ID || "6557LUX45F.com.jobrunner.app";
const ANDROID_PACKAGE = process.env.ANDROID_APP_LINKS_PACKAGE || "com.jobrunner.app";

const APP_LINK_PATHS = [
  "/verify-email",
  "/verify-email/*",
  "/accept-invite",
  "/accept-invite/*",
  "/reset-password",
  "/reset-password/*",
];

function getAndroidFingerprints(): string[] {
  const raw = process.env.ANDROID_APP_LINKS_SHA256_FINGERPRINTS || "";
  return raw
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f));
}

function buildAppleAppSiteAssociation() {
  return {
    applinks: {
      apps: [],
      details: [
        {
          appID: IOS_APP_ID,
          appIDs: [IOS_APP_ID],
          paths: APP_LINK_PATHS,
          components: APP_LINK_PATHS.map((p) => ({
            "/": p.endsWith("/*") ? p.slice(0, -2) + "/*" : p,
            comment: `JobRunner magic link: ${p}`,
          })),
        },
      ],
    },
    webcredentials: {
      apps: [IOS_APP_ID],
    },
  };
}

function buildAssetLinks() {
  const fingerprints = getAndroidFingerprints();
  return [
    {
      relation: [
        "delegate_permission/common.handle_all_urls",
        "delegate_permission/common.get_login_creds",
      ],
      target: {
        namespace: "android_app",
        package_name: ANDROID_PACKAGE,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}

export function registerWellKnownRoutes(app: Express): void {
  const sendJson = (res: Response, body: unknown) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.status(200).send(JSON.stringify(body));
  };

  app.get("/.well-known/apple-app-site-association", (_req: Request, res: Response) => {
    sendJson(res, buildAppleAppSiteAssociation());
  });

  app.get("/apple-app-site-association", (_req: Request, res: Response) => {
    sendJson(res, buildAppleAppSiteAssociation());
  });

  app.get("/.well-known/assetlinks.json", (_req: Request, res: Response) => {
    const fingerprints = getAndroidFingerprints();
    if (fingerprints.length === 0) {
      // Fail loud: an empty fingerprint list silently breaks Android App Link
      // verification (taps fall back to the browser chooser). Refuse to serve
      // a useless file in production so the gap is visible in monitoring.
      console.error(
        "[AppLinks] /.well-known/assetlinks.json requested but ANDROID_APP_LINKS_SHA256_FINGERPRINTS is not set — refusing to serve an empty fingerprint list"
      );
      if (process.env.NODE_ENV === "production") {
        res.setHeader("Cache-Control", "no-store");
        res.status(503).type("application/json").send(
          JSON.stringify({
            error:
              "assetlinks.json not yet configured: ANDROID_APP_LINKS_SHA256_FINGERPRINTS is missing on the server",
          })
        );
        return;
      }
    }
    sendJson(res, buildAssetLinks());
  });
}
