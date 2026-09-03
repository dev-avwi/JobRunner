// @ts-nocheck
import type { Express } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { db } from "../storage";
import { feedback } from "@workspace/db";
import { ObjectStorageService } from "../objectStorage";
import { randomUUID } from "crypto";
import { logger } from "../logger";
import { requireAuth } from "./middleware";

const feedbackRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many feedback submissions. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Allowed raster MIME types — SVG is explicitly excluded because browsers execute
// script inside SVGs served from the same origin (stored-XSS risk).
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
]);

// Magic-byte signatures for each allowed type.
// We check the raw buffer, not the client-declared MIME type, to prevent spoofing.
const MAGIC_SIGNATURES: Array<{ type: string; bytes: number[]; offset?: number }> = [
  { type: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { type: "image/png",  bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: "image/gif",  bytes: [0x47, 0x49, 0x46, 0x38] },   // GIF8
  // WebP: RIFF....WEBP
  { type: "image/webp", bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
  { type: "image/bmp",  bytes: [0x42, 0x4d] },
];

function isValidImageBuffer(buf: Buffer): boolean {
  for (const sig of MAGIC_SIGNATURES) {
    const offset = sig.offset ?? 0;
    if (buf.length < offset + sig.bytes.length) continue;
    if (sig.bytes.every((b, i) => buf[offset + i] === b)) return true;
  }
  return false;
}

// Up to 3 images, 5 MB each — raster images only (no SVG).
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      cb(new Error("Only raster image files are allowed (JPEG, PNG, GIF, WebP, BMP)"));
    } else {
      cb(null, true);
    }
  },
});

/** Escape a string for safe insertion into HTML. */
function esc(str: unknown): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Build an absolute URL from an object-storage path (/objects/...). */
function absoluteStorageUrl(path: string): string {
  const base =
    process.env.APP_DOMAIN
      ? `https://${process.env.APP_DOMAIN}`
      : process.env.VITE_APP_URL || "https://jobrunner.com.au";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Wraps multer.array() so fileFilter/size errors become 400 responses instead of 500s. */
function multerUpload(uploadMiddleware: ReturnType<typeof multer>) {
  return (count: number) =>
    (req: any, res: any, next: any) => {
      uploadMiddleware.array("photos", count)(req, res, (err: any) => {
        if (!err) return next();
        const status =
          err?.code === "LIMIT_FILE_SIZE"
            ? 413
            : err?.code?.startsWith("LIMIT_")
            ? 400
            : 400;
        return res.status(status).json({ error: err.message || "File upload error" });
      });
    };
}

async function uploadValidatedPhoto(
  file: Express.Multer.File,
  objectStorage: ObjectStorageService,
): Promise<string> {
  if (!isValidImageBuffer(file.buffer)) {
    throw new Error("File content does not match a recognised raster image format");
  }
  const ext = file.mimetype.split("/")[1] || "jpg";
  const fileName = `feedback/${randomUUID()}.${ext}`;
  return objectStorage.uploadFile(fileName, file.buffer, file.mimetype);
}

export function registerFeedbackRoutes(app: Express) {
  // Standalone photo upload — returns absolute URLs for use in bug-reports.
  // Requires authentication so only logged-in users can write to object storage.
  // Photos are content-validated (magic bytes) to prevent MIME-spoofed SVG uploads.
  const uploadPhotosMiddleware = multerUpload(photoUpload)(3);

  app.post(
    "/api/feedback/upload-photos",
    requireAuth,
    feedbackRateLimit,
    uploadPhotosMiddleware,
    async (req: any, res) => {
      try {
        const files = (req.files as Express.Multer.File[]) ?? [];
        if (files.length === 0) {
          return res.status(400).json({ error: "No photos provided" });
        }
        const objectStorage = new ObjectStorageService();
        const urls: string[] = [];
        for (const file of files) {
          const storedPath = await uploadValidatedPhoto(file, objectStorage);
          urls.push(absoluteStorageUrl(storedPath));
        }
        return res.json({ urls });
      } catch (err: any) {
        logger.error({ err }, "Failed to upload feedback photos");
        const msg = err?.message?.includes("raster image")
          ? err.message
          : "Failed to upload photos";
        return res.status(400).json({ error: msg });
      }
    },
  );

  // POST /api/feedback — accepts multipart (with inline photos) or JSON (no photos).
  // requireAuth resolves both cookie sessions (web) and Bearer tokens (mobile),
  // so req.userId is always available and identity is never trust-on-body.
  const uploadFeedbackMiddleware = multerUpload(photoUpload)(3);

  app.post(
    "/api/feedback",
    requireAuth,
    feedbackRateLimit,
    uploadFeedbackMiddleware,
    async (req: any, res) => {
      try {
        const body =
          typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};

        const {
          feedbackType = "general",
          message,
          rating,
          platform,
          appVersion,
          currentRoute,
          deviceInfo,
        } = body;

        if (!message || !String(message).trim()) {
          return res.status(400).json({ error: "Message is required" });
        }

        // Identity from session only — never trust the request body.
        const sessionUserId: string | null =
          req.session?.userId ?? req.userId ?? null;
        const sessionBusinessId: string | null =
          req.session?.businessId ?? null;

        // Upload and content-validate any directly-attached photos.
        const photoUrls: string[] = [];
        const files = (req.files as Express.Multer.File[]) ?? [];
        if (files.length > 0) {
          const objectStorage = new ObjectStorageService();
          for (const file of files) {
            const storedPath = await uploadValidatedPhoto(file, objectStorage);
            photoUrls.push(absoluteStorageUrl(storedPath));
          }
        }

        const parsedRating =
          rating !== undefined && rating !== null && rating !== ""
            ? Number(rating)
            : null;

        const parsedDeviceInfo = deviceInfo
          ? typeof deviceInfo === "string"
            ? (() => { try { return JSON.parse(deviceInfo); } catch { return null; } })()
            : deviceInfo
          : null;

        const [record] = await db
          .insert(feedback)
          .values({
            userId: sessionUserId,
            businessId: sessionBusinessId,
            feedbackType: ["bug", "feature", "general"].includes(feedbackType)
              ? feedbackType
              : "general",
            message: String(message).trim(),
            rating:
              parsedRating && parsedRating >= 1 && parsedRating <= 5
                ? parsedRating
                : null,
            photoUrls,
            platform: platform ?? null,
            appVersion: appVersion ?? null,
            currentRoute: currentRoute ?? null,
            deviceInfo: parsedDeviceInfo,
          })
          .returning({ id: feedback.id });

        logger.info(
          {
            feedbackId: record.id,
            feedbackType,
            platform,
            rating: parsedRating,
            photoCount: photoUrls.length,
            userId: sessionUserId,
          },
          `[FEEDBACK] New ${feedbackType} submission (id=${record.id})`,
        );

        // Fire-and-forget email notification
        sendFeedbackEmail({
          feedbackId: record.id,
          feedbackType,
          message: String(message).trim(),
          rating: parsedRating,
          platform,
          appVersion,
          currentRoute,
          photoUrls,
          userId: sessionUserId,
        }).catch((err) =>
          logger.warn({ err }, "Feedback email send failed (non-fatal)"),
        );

        return res.json({ success: true, id: record.id });
      } catch (err: any) {
        logger.error({ err }, "Failed to save feedback");
        return res.status(500).json({ error: "Failed to submit feedback" });
      }
    },
  );
}

async function sendFeedbackEmail(data: {
  feedbackId: string;
  feedbackType: string;
  message: string;
  rating: number | null;
  platform?: string;
  appVersion?: string;
  currentRoute?: string;
  photoUrls: string[];
  userId?: string | null;
}) {
  if (!process.env.SENDGRID_API_KEY) return;

  const typeLabel =
    data.feedbackType === "bug"
      ? "Bug Report"
      : data.feedbackType === "feature"
        ? "Feature Request"
        : "General Feedback";

  const stars = data.rating
    ? "★".repeat(data.rating) + "☆".repeat(5 - data.rating)
    : "Not rated";

  // All user-controlled fields are HTML-escaped before interpolation.
  // Photo URLs are absolute (prefixed with the app base URL) so email clients
  // can render them as clickable links.
  const photoSection =
    data.photoUrls.length > 0
      ? `<div style="margin-bottom:16px;">
          <h2 style="font-size:16px;color:#374151;margin:0 0 8px 0;">Attachments (${data.photoUrls.length})</h2>
          ${data.photoUrls
            .map(
              (u) =>
                `<p style="margin:4px 0;"><a href="${esc(u)}" style="color:#2563eb;">${esc(u)}</a></p>`,
            )
            .join("")}
        </div>`
      : "";

  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#2563eb;padding:20px;border-radius:8px;margin-bottom:20px;">
      <h1 style="color:white;margin:0;font-size:20px;">${esc(typeLabel)} — JobRunner</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Rating: ${esc(stars)} | Platform: ${esc(data.platform ?? "unknown")}</p>
    </div>
    <div style="background:#f9fafb;padding:16px;border-radius:8px;margin-bottom:16px;">
      <h2 style="margin:0 0 8px;font-size:16px;">Details</h2>
      <p style="margin:4px 0;"><strong>ID:</strong> ${esc(data.feedbackId)}</p>
      <p style="margin:4px 0;"><strong>User ID:</strong> ${esc(data.userId ?? "anonymous")}</p>
      <p style="margin:4px 0;"><strong>App Version:</strong> ${esc(data.appVersion ?? "unknown")}</p>
      <p style="margin:4px 0;"><strong>Route/Screen:</strong> ${esc(data.currentRoute ?? "unknown")}</p>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;padding:16px;border-radius:8px;margin-bottom:16px;">
      <h2 style="margin:0 0 8px;font-size:16px;">Message</h2>
      <p style="margin:0;white-space:pre-wrap;">${esc(data.message)}</p>
    </div>
    ${photoSection}
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin-top:16px;">Submitted ${new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney" })} AEST</p>
  </body></html>`;

  const sgMail = await import("@sendgrid/mail");
  sgMail.default.setApiKey(process.env.SENDGRID_API_KEY!);
  await sgMail.default.send({
    trackingSettings: {
      clickTracking: { enable: false, enableText: false },
      openTracking: { enable: true },
    },
    to: "admin@avwebinnovation.com",
    from: { email: "noreply@jobrunner.com.au", name: "JobRunner Feedback" },
    subject: `[${typeLabel}] ${data.message.substring(0, 60)}${data.message.length > 60 ? "..." : ""}`,
    html,
  });
}
