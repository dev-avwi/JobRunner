// One-way Excel/Google Sheets sync routes (Task #306)
// All configuration is owner-only; the sync itself is strictly outbound.

import type { Express } from "express";
import { randomBytes } from "crypto";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth } from "./middleware";
import { ownerOnly, getUserContext } from "../permissions";
import {
  isSheetSyncConfigured,
  isGoogleAuthError,
  getSheetsAuthorizationUrl,
  handleSheetsOAuthCallback,
  disconnectSheets,
  runSheetSync,
  buildExcelWorkbook,
  SHEET_SYNC_DATA_TYPES,
  SHEET_SYNC_FREQUENCIES,
  SHEET_SYNC_TARGETS,
} from "../sheetSync";

// Short-lived OAuth state nonces (10 min) — the callback arrives without auth
// headers, so the state token is what binds the code to the initiating owner.
const oauthStates = new Map<string, { userId: string; expiresAt: number }>();
function cleanupStates() {
  const now = Date.now();
  for (const [k, v] of oauthStates) if (v.expiresAt < now) oauthStates.delete(k);
}

const sheetSyncSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  target: z.enum(SHEET_SYNC_TARGETS).optional(),
  frequency: z.enum(SHEET_SYNC_FREQUENCIES).optional(),
  dataTypes: z.array(z.enum(SHEET_SYNC_DATA_TYPES)).min(1).optional(),
  // Optional bookkeeper recipients for the emailed Excel export. Empty array
  // means "send to the owner" (the default). Normalised lower/trimmed and
  // de-duplicated so display + delivery are consistent.
  recipients: z
    .array(z.string().trim().toLowerCase().email("Invalid recipient email"))
    .max(5, "You can add up to 5 recipient emails")
    .optional()
    .transform((arr) => (arr ? Array.from(new Set(arr)) : arr)),
});

export function registerSheetSyncRoutes(app: Express) {
  // Status + current settings (owner sees full detail; team members get 403
  // via ownerOnly on the mutating routes — status itself is owner-scoped too).
  app.get("/api/sheet-sync/status", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      res.set('Cache-Control', 'no-store');
      const userContext = await getUserContext(req.userId);
      const settings = await storage.getBusinessSettings(userContext.effectiveUserId);
      // A Google Sheets-targeted sync whose last run failed on an auth error
      // (revoked/expired grant — the token refresh path also flips
      // googleSheetsConnected off for permanent failures) needs the owner to
      // reconnect; surface that prominently in Settings.
      const target = settings?.sheetSyncTarget || 'google_sheets';
      const needsReconnect =
        target === 'google_sheets' &&
        settings?.sheetSyncLastStatus === 'error' &&
        (!settings?.googleSheetsConnected || isGoogleAuthError(settings?.sheetSyncLastError));
      res.json({
        configured: isSheetSyncConfigured(),
        needsReconnect,
        enabled: settings?.sheetSyncEnabled || false,
        target: settings?.sheetSyncTarget || 'google_sheets',
        frequency: settings?.sheetSyncFrequency || 'daily',
        dataTypes: Array.isArray(settings?.sheetSyncDataTypes) && settings!.sheetSyncDataTypes!.length > 0
          ? settings!.sheetSyncDataTypes
          : ['clients', 'jobs', 'invoices', 'payments'],
        googleConnected: settings?.googleSheetsConnected || false,
        googleEmail: settings?.googleSheetsEmail || null,
        spreadsheetUrl: settings?.sheetSyncSpreadsheetUrl || null,
        lastRunAt: settings?.sheetSyncLastRunAt || null,
        lastStatus: settings?.sheetSyncLastStatus || null,
        lastError: settings?.sheetSyncLastError || null,
        recipients: Array.isArray(settings?.sheetSyncRecipients) ? settings!.sheetSyncRecipients : [],
        ownerEmail: settings?.email || (await storage.getUser(userContext.effectiveUserId))?.email || null,
      });
    } catch (error: any) {
      console.error("Error getting sheet sync status:", error);
      res.status(500).json({ error: error.message || "Failed to get sheet sync status" });
    }
  });

  // Start Google OAuth for Sheets
  app.post("/api/sheet-sync/connect", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      if (!isSheetSyncConfigured()) {
        return res.status(400).json({ error: "Google Sheets integration is not configured yet." });
      }
      const userContext = await getUserContext(req.userId);
      cleanupStates();
      const state = randomBytes(24).toString('hex');
      oauthStates.set(state, {
        userId: userContext.effectiveUserId,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });
      res.json({ authUrl: getSheetsAuthorizationUrl(state) });
    } catch (error: any) {
      console.error("Error starting Google Sheets connection:", error);
      res.status(500).json({ error: error.message || "Failed to start Google Sheets connection" });
    }
  });

  // OAuth callback (no auth headers — validated via the state nonce)
  app.get("/api/sheet-sync/callback", async (req: any, res) => {
    try {
      const { code, state } = req.query;
      if (!code || !state) {
        return res.redirect('/settings?tab=data&sheetsync=error&message=' + encodeURIComponent('Missing parameters'));
      }
      cleanupStates();
      const entry = oauthStates.get(state as string);
      oauthStates.delete(state as string);
      if (!entry || entry.expiresAt < Date.now()) {
        return res.redirect('/settings?tab=data&sheetsync=error&message=' + encodeURIComponent('Connection request expired. Please try again.'));
      }
      const result = await handleSheetsOAuthCallback(code as string, entry.userId);
      if (result.success) {
        return res.redirect('/settings?tab=data&sheetsync=connected');
      }
      return res.redirect('/settings?tab=data&sheetsync=error&message=' + encodeURIComponent(result.error || 'Connection failed'));
    } catch (error: any) {
      console.error("Error in Google Sheets OAuth callback:", error);
      return res.redirect('/settings?tab=data&sheetsync=error&message=' + encodeURIComponent(error.message || 'Connection failed'));
    }
  });

  app.post("/api/sheet-sync/disconnect", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      await disconnectSheets(userContext.effectiveUserId);
      // Disconnecting the Google account disables a Google Sheets-targeted sync
      const settings = await storage.getBusinessSettings(userContext.effectiveUserId);
      if (settings?.sheetSyncEnabled && (settings.sheetSyncTarget || 'google_sheets') === 'google_sheets') {
        await storage.updateBusinessSettings(userContext.effectiveUserId, { sheetSyncEnabled: false });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error disconnecting Google Sheets:", error);
      res.status(500).json({ error: error.message || "Failed to disconnect Google Sheets" });
    }
  });

  // Update sync settings (toggles, frequency, data types, target)
  app.post("/api/sheet-sync/settings", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const parsed = sheetSyncSettingsSchema.parse(req.body || {});
      const settings = await storage.getBusinessSettings(userContext.effectiveUserId);
      if (!settings) return res.status(404).json({ error: "Business settings not found" });

      const target = parsed.target ?? settings.sheetSyncTarget ?? 'google_sheets';
      const enabling = parsed.enabled === true && !settings.sheetSyncEnabled;
      if (enabling && target === 'google_sheets' && !settings.googleSheetsConnected) {
        return res.status(400).json({ error: "Connect your Google account first, or switch to Excel email export." });
      }

      const updates: any = {};
      if (parsed.enabled !== undefined) updates.sheetSyncEnabled = parsed.enabled;
      if (parsed.target !== undefined) updates.sheetSyncTarget = parsed.target;
      // Switching the target to Google Sheets while Google isn't connected
      // must not leave the sync silently enabled with an unusable destination.
      const willBeEnabled = parsed.enabled ?? settings.sheetSyncEnabled ?? false;
      if (willBeEnabled && target === 'google_sheets' && !settings.googleSheetsConnected) {
        updates.sheetSyncEnabled = false;
      }
      if (parsed.frequency !== undefined) updates.sheetSyncFrequency = parsed.frequency;
      if (parsed.dataTypes !== undefined) updates.sheetSyncDataTypes = parsed.dataTypes;
      if (parsed.recipients !== undefined) updates.sheetSyncRecipients = parsed.recipients;
      const updated = await storage.updateBusinessSettings(userContext.effectiveUserId, updates);
      res.json({
        enabled: updated?.sheetSyncEnabled || false,
        target: updated?.sheetSyncTarget || 'google_sheets',
        frequency: updated?.sheetSyncFrequency || 'daily',
        dataTypes: updated?.sheetSyncDataTypes || ['clients', 'jobs', 'invoices', 'payments'],
        recipients: Array.isArray(updated?.sheetSyncRecipients) ? updated!.sheetSyncRecipients : [],
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid settings", details: error.errors });
      }
      console.error("Error updating sheet sync settings:", error);
      res.status(500).json({ error: error.message || "Failed to update sheet sync settings" });
    }
  });

  // Run a sync immediately
  app.post("/api/sheet-sync/run-now", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const result = await runSheetSync(userContext.effectiveUserId, { manual: true });
      if (!result.success) {
        return res.status(400).json({ error: result.error || "Sync failed" });
      }
      res.json({ success: true, url: result.url || null });
    } catch (error: any) {
      console.error("Error running sheet sync:", error);
      res.status(500).json({ error: error.message || "Failed to run sync" });
    }
  });

  // On-demand Excel download (all currently-selected data types)
  app.get("/api/sheet-sync/download-excel", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const settings = await storage.getBusinessSettings(userContext.effectiveUserId);
      const dataTypes: string[] = Array.isArray(settings?.sheetSyncDataTypes) && settings!.sheetSyncDataTypes!.length > 0
        ? settings!.sheetSyncDataTypes!
        : ['clients', 'jobs', 'invoices', 'payments'];
      const buffer = await buildExcelWorkbook(userContext.effectiveUserId, dataTypes);
      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="jobrunner-export-${dateStr}.xlsx"`);
      res.send(buffer);
    } catch (error: any) {
      console.error("Error generating Excel export:", error);
      res.status(500).json({ error: error.message || "Failed to generate Excel export" });
    }
  });
}
