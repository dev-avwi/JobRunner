// AUTO-EXTRACTED jobs routes. See task #162.
  // This file holds every /api/jobs* handler that used to live in server/routes.ts.
  // Handlers are byte-identical to their originals; closure deps are passed via the
  // `deps` argument so they keep referencing the same singleton instances
  // (multer upload, trackingTokens Map, etc.) that the rest of routes.ts uses.

  import * as Sentry from "@sentry/node";
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { randomBytes, randomUUID, createHash, randomInt } from "crypto";
import { z } from "zod";
import multer from "multer";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { storage } from "../storage";
import { AuthService } from "../auth";
import { setupGoogleAuth } from "../googleAuth";
import { setupXeroAuth } from "../xeroAuth";
import {
  requireAuth,
  requireProSubscription,
  requirePaidTier,
  requirePaidTierForSms,
  requireDevelopment,
  authRateLimiter,
  passwordResetLimiter,
  paymentRateLimiter,
  messageSendLimiter,
  generalApiLimiter,
  setupOnboardingGuard,
  pdfPerUserLimiter,
  aiPerUserLimiter,
  visionPerUserLimiter,
  photoUploadPerUserLimiter,
  transcribePerUserLimiter,
  backpressureErrorHandler,
} from "./middleware";
import { isBackpressure, send429, aiQueue } from "../concurrency";
import {
  dbCheckEnRouteNotif,
  chatRateLimiterMiddleware,
  portalIpRateLimiterMiddleware,
  getIdempotencyRecord,
  setIdempotencyRecord,
  logActivity,
  type ActivityType,
  formatRelativeTime,
  normalizeAuPhone,
  resolveAssigneeUserId,
  autoUpdateWorkerState,
  gatherAIContext,
  verifyInvoiceCalculation,
  validateAustralianCoords,
  wasRecentlyNotifiedTeamJoinBlocked,
  emailPaymentLinkCooldown,
  EMAIL_PAYMENT_LINK_COOLDOWN_MS,
} from "./helpers";
import { loginSchema, insertUserSchema, type SafeUser, requestLoginCodeSchema, verifyLoginCodeSchema } from "@workspace/db";
import { sendEmailVerificationEmail, sendLoginCodeEmail, sendJobConfirmationEmail, sendPasswordResetEmail, sendTeamInviteEmail, sendJobAssignmentEmail, sendJobCompletionNotificationEmail, sendWelcomeEmail } from "../emailService";
import { FreemiumService } from "../freemiumService";
import { DEMO_USER, VISITOR_USER } from "../demoData";
import { ownerOnly, ownerOrManagerOnly, requirePermission, createPermissionMiddleware, PERMISSIONS, getUserContext, hasPermission, canAssignJobTo, getWorkerPermissionContext, sanitizeClientData, requireTeamPlan, ownerHasTeamCapability, checkTeamSeatLimit } from "../permissions";
import { logTeamActivity, type TeamActivityType } from "../activityService";
import {
  insertBusinessSettingsSchema,
  insertIntegrationSettingsSchema,
  insertNotificationSchema,
  insertClientSchema,
  insertJobSchema,
  insertQuoteSchema,
  updateQuoteSchema,
  insertQuoteLineItemSchema,
  insertInvoiceSchema,
  updateInvoiceSchema,
  insertInvoiceLineItemSchema,
  insertDocumentTemplateSchema,
  insertLineItemCatalogSchema,
  insertRateCardSchema,
  // Advanced features schemas
  insertTimeEntrySchema,
  insertTimesheetSchema,
  insertExpenseCategorySchema,
  insertExpenseSchema,
  insertInventoryCategorySchema,
  insertInventoryItemSchema,
  insertInventoryTransactionSchema,
  insertSupplierSchema,
  insertPurchaseOrderSchema,
  insertPurchaseOrderItemSchema,
  insertUserRoleSchema,
  insertTeamMemberSchema,
  type InsertTeamMember,
  ROLE_PRESETS,
  insertStaffScheduleSchema,
  insertLocationTrackingSchema,
  insertRouteSchema,
  // Checklist schemas
  insertChecklistItemSchema,
  updateChecklistItemSchema,
  // Chat schemas
  insertJobChatSchema,
  insertTeamChatSchema,
  // SMS Template schema
  insertSmsTemplateSchema,
  // Business Templates schema
  insertBusinessTemplateSchema,
  // Team Presence & Activity Feed schemas
  insertTeamPresenceSchema,
  insertActivityFeedSchema,
  updateBusinessTemplateSchema,
  BUSINESS_TEMPLATE_FAMILIES,
  isValidPurposeForFamily,
  getValidPurposesForFamily,
  type BusinessTemplateFamily,
  type BusinessTemplatePurpose,
  // Recurring contracts schema
  insertRecurringContractSchema,
  // Leads schema
  insertLeadSchema,
  // Job notes schema
  insertJobNoteSchema,
  insertJobMaterialSchema,
  jobMaterials,
  // Service reminders schema
  insertServiceReminderSchema,
  // Equipment schemas
  insertEquipmentSchema,
  insertEquipmentCategorySchema,
  insertEquipmentMaintenanceSchema,
  jobEquipment,
  equipment,
  equipmentCategories,
  // Rebates schema
  insertRebateSchema,
  // Team Groups schema
  insertTeamGroupSchema,
  // Job Invites schema
  insertJobInviteSchema,
  type JobInvite,
  // Invite codes
  inviteCodes,
  insertInviteCodeSchema,
  // Types
  type InsertTimeEntry,
  // Location tracking tables
  locationTracking,
  tradieStatus,
  // GPS Signal Loss Logging
  insertGpsSignalLogSchema,
  // Digital signatures
  digitalSignatures,
  // Tables for admin dashboard
  users,
  jobs,
  invoices,
  quotes,
  clients,
  businessSettings,
  businessTemplates,
  // Advanced team management tables
  teamMembers,
  teamMemberSkills,
  teamMemberAvailability,
  teamMemberTimeOff,
  teamMemberMetrics,
  // Job assignment requests
  jobAssignmentRequests,
  jobAssignments,
  timeEntries,
  userRoles,
  // Saved filters
  insertSavedFilterSchema,
  savedFilters,
  // Time entry edit audit trail
  timeEntryEdits,
  insertTimeEntryEditSchema,
  type InsertTimeEntryEdit,
  type TimeEntryEdit,
  // Dispute audit trail
  timeEntryDisputeEvents,
  // Invoice edit audit trail
  invoiceEdits,
  type InsertInvoiceEdit,
  type InvoiceEdit,
  // Autopilot activity log tables
  invoiceReminderLogs,
  smsAutomationLogs,
  smsAutomationRules,
  jobReminders,
  automationLogs,
  automations as automationsTable,
  geofenceAlerts as geofence_alerts,
  jobInvites,
  jobPhotos,
  swmsDocuments,
  swmsHazards,
  swmsSignatures,
  customForms,
  formSubmissions,
  rateLimits,
  smsMessages,
  smsConversations,
  aiReceptionistCalls,
  aiReceptionistConfig,
  leads,
  errorLogs,
  auditLogs,
  systemEvents,
  websiteChangeRequests,
  websiteAddons,
  subcontractorTokens,
  subcontractorEvents,
  subcontractorInvoices,
  subcontractorInvoiceItems,
  insertSubcontractorInvoiceSchema,
  insertSubcontractorInvoiceItemSchema,
  numberPortRequests,
  insertNumberPortRequestSchema,
  PORT_REQUEST_STATUSES,
} from "@workspace/db";
import { db } from "../storage";
import { eq, sql, desc, asc, and, gte, lte, lt, isNotNull, isNull, inArray, or, count, sum, ne } from "drizzle-orm";
import { logger } from "../logger";
import { 
  ObjectStorageService, 
  ObjectNotFoundError,
  objectStorageClient,
} from "../objectStorage";
import { parseObjectPath } from "../objectStorage";
import { 
  tradieQuoteTemplates, 
  tradieLineItems, 
  tradieRateCards 
} from "../tradieTemplates";
import { getSafetyFormTemplates, getSafetyFormTemplate } from "../safetyTemplates";
import { evaluateTaskRules } from "../taskRules";
import { generateAISuggestions, chatWithAI, analyzeReceipt, detectHazards, type BusinessContext } from "../ai";
import { notifyQuoteSent, notifyInvoiceSent, notifyInvoicePaid, notifyJobScheduled, notifyJobStarted, notifyJobCompleted, notifyJobAssigned as notifyJobAssignedDB, notifyTeamMemberInvited, notifySmsReceived, notifyTimesheetSubmitted, notifyChatMessage, notifyQuoteAccepted as notifyQuoteAcceptedDB, notifyQuoteRejected as notifyQuoteRejectedDB, notifyGeofenceCheckIn, notifyGeofenceCheckOut, notifyRecurringJobCreated, notifyRecurringInvoiceCreated, notifyInvoiceOverdue as notifyInvoiceOverdueDB, notifyQuoteExpiring, notifyPaymentFailed } from "../notifications";
import { notifyJobAssigned, notifyJobUpdate, notifyPaymentReceived, notifyQuoteAccepted, notifyQuoteRejected, notifyTeamMessage, notifyInvoiceOverdue, notifySmsReceived as notifySmsReceivedPush, notifyGeofenceEvent, notifyTimesheetSubmitted as notifyTimesheetSubmittedPush, notifyQuoteExpiring as notifyQuoteExpiringPush, notifyPaymentFailed as notifyPaymentFailedPush, notifyTrialExpiring as notifyTrialExpiringPush, notifyTimesheetDisputeFiled, notifyTimesheetDisputeResolved, notifyJobNudge, notifyNudgeResponse } from "../pushNotifications";
import { getEmailIntegration, getGmailConnectionStatus } from "../emailIntegrationService";
import { getUncachableStripeClient, getStripePublishableKey, isStripeInitialized } from "../stripeClient";
import { checkTwilioAvailability, sendSMS, validateTwilioWebhook } from "../twilioClient";
import { geocodeAddress, haversineDistance, calculateRouteETA } from "../geocoding";
import { processStatusChangeAutomation, processPaymentReceivedAutomation, processTimeBasedAutomations } from "../automationService";
import * as xeroService from "../xeroService";
import * as myobService from "../myobService";
import * as quickbooksService from "../quickbooksService";
import { getProductionBaseUrl, getQuotePublicUrl, getInvoicePublicUrl, getReceiptPublicUrl } from "../urlHelper";
import { generateQuoteEmailTemplate, generateInvoiceEmailTemplate } from "../emailTemplates";
import { notifyOwnerViaSms, notifyOwnerViaEmail } from "../notificationService";

import { logSystemEvent } from "../systemEventService";
import { computeRetentionSummary } from "./retentionSummary";


  // Escape user-provided values before embedding them in HTML emails/templates.
  function escapeHtml(str: string | null | undefined): string {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }


  export interface JobsRoutesDeps {
    trackingTokens: Map<string, {
      businessName: string;
      businessLogo?: string | null;
      businessPhone?: string | null;
      businessEmail?: string | null;
      tradieName: string;
      jobAddress: string;
      suburb: string;
      sentAt: Date;
      estimatedMinutes: number;
      status: 'on_the_way' | 'arrived' | 'completed';
    }>;
    buildProofPackData: (jobId: string, userId: string, query: any) => Promise<any>;
    sitePhotoCache: Map<string, { url: string; expires: number }>;
    upload: multer.Multer;
    getJobWithChatAccess: (jobId: string, userId: string) => Promise<any>;
    chatUpload: multer.Multer;
  }

  // Per-worker double-booking guard. Returns the first scheduled job that
  // overlaps the requested time window for the SAME assigned worker, or null
  // when the slot is free. Two different workers booked at the same time is
  // allowed — only the same worker overlapping themselves is a conflict.
  // Cancelled/done/invoiced jobs never count as a conflict.
  async function findWorkerBookingConflict(params: {
    effectiveUserId: string;
    assignedTo: string;
    scheduledAt: Date;
    estimatedDuration?: number | null;
    excludeJobId?: string;
  }): Promise<any | null> {
    const { effectiveUserId, assignedTo, scheduledAt, estimatedDuration, excludeJobId } = params;
    const start = new Date(scheduledAt).getTime();
    if (Number.isNaN(start)) return null;
    const durationMin = estimatedDuration && estimatedDuration > 0 ? estimatedDuration : 60;
    const end = start + durationMin * 60 * 1000;

    const skipStatuses = new Set(['cancelled', 'done', 'invoiced']);
    const allJobs = await storage.getJobs(effectiveUserId);

    for (const other of allJobs) {
      if (excludeJobId && other.id === excludeJobId) continue;
      if (other.assignedTo !== assignedTo) continue;
      if (skipStatuses.has(other.status)) continue;
      if (!other.scheduledAt) continue;

      const otherStart = new Date(other.scheduledAt).getTime();
      if (Number.isNaN(otherStart)) continue;
      const otherDuration = other.estimatedDuration && other.estimatedDuration > 0 ? other.estimatedDuration : 60;
      const otherEnd = otherStart + otherDuration * 60 * 1000;

      // Overlap when one window starts before the other ends, both ways.
      if (start < otherEnd && otherStart < end) {
        return other;
      }
    }
    return null;
  }

  // Shared WHS gate: returns a blocking {status, body} when a job is being
  // started (transition to in_progress) and a configured safety/compliance
  // requirement is not met. Returns null when the start is allowed. Applied to
  // ALL job status-mutation paths (status, full update, bulk) so it can't be
  // bypassed.
  async function checkJobStartGate(params: {
    job: any;
    newStatus: string | undefined;
    businessSettings: any;
    effectiveUserId: string;
    fallbackUserId: string;
  }): Promise<{ status: number; body: any } | null> {
    const { job, newStatus, businessSettings, effectiveUserId, fallbackUserId } = params;
    if (newStatus !== 'in_progress' || !job || job.status === 'in_progress') return null;

    // 1. Block start when the assigned worker / business has an expired licence or cert
    if (businessSettings?.blockJobStartOnExpiredCompliance) {
      const assigneeUserId =
        (await resolveAssigneeUserId(job.assignedTo, effectiveUserId)) ||
        job.assignedTo ||
        fallbackUserId;
      const docs = await storage.getComplianceDocuments(effectiveUserId);
      const nowTs = new Date();
      const blockingTypes = ['licence', 'white_card', 'certification', 'insurance', 'vehicle_rego'];
      const expired = docs.filter((d: any) =>
        blockingTypes.includes(d.type) &&
        d.expiryDate && new Date(d.expiryDate) < nowTs &&
        (!d.holderUserId || d.holderUserId === assigneeUserId)
      );
      if (expired.length > 0) {
        return {
          status: 409,
          body: {
            error: `Cannot start job — ${expired.length} expired licence/compliance document${expired.length > 1 ? 's' : ''} must be renewed first.`,
            code: 'COMPLIANCE_EXPIRED',
            expiredDocuments: expired.map((d: any) => ({
              id: d.id,
              title: d.title,
              type: d.type,
              holderName: d.holderName,
              expiryDate: d.expiryDate,
            })),
          },
        };
      }
    }

    // 2. Require a pre-start / Take 5 safety form to be submitted for this job
    if (businessSettings?.requireTake5BeforeStart) {
      const safetyCount = await storage.getJobSafetyFormSubmissionCount(job.id, effectiveUserId);
      if (safetyCount === 0) {
        return {
          status: 428,
          body: {
            error: 'A pre-start (Take 5) safety check must be completed before starting this job.',
            code: 'TAKE5_REQUIRED',
          },
        };
      }
    }

    return null;
  }

  // Job completion is restricted to the lead worker (primary assignee), in
  // addition to owner/manager. Other assigned workers finish by clocking off
  // their own timer; they cannot mark the whole job Done.
  async function isPrimaryAssignee(job: any, userId: string): Promise<boolean> {
    if (!job || !userId) return false;
    const assignments = await storage.getJobAssignments(job.id);
    const primary = assignments.find((a: any) => a.isPrimary);
    if (primary) return primary.userId === userId;
    // Legacy fallback: a job with no explicit primary treats its single
    // assignedTo worker as the lead.
    return job.assignedTo === userId;
  }

  // Job total time runs from the FIRST worker's clock-in to the LAST worker's
  // clock-out. When a job is marked done, use the latest time-entry end as the
  // completion timestamp (instead of "now") so a late Complete tap by the lead
  // doesn't inflate the job's total duration. Falls back to `now` when the job
  // has no ended time entries or any timer is still running.
  async function resolveJobCompletionTime(jobId: string, now: Date): Promise<Date> {
    try {
      const entries = await storage.getTimeEntriesForJob(jobId);
      if (entries.some(e => !e.endTime && !e.isBreak)) return now;
      let latest: Date | null = null;
      for (const e of entries) {
        if (!e.endTime) continue;
        const end = new Date(e.endTime);
        if (!latest || end > latest) latest = end;
      }
      if (latest && latest <= now) return latest;
      return now;
    } catch (err) {
      console.error('[resolveJobCompletionTime] failed, using now:', err);
      return now;
    }
  }

  // Shared "all timers stopped / time entries sane" precondition for marking a
  // job done. Returns a list of human-readable problems (empty = OK to complete).
  async function getJobCompletionErrors(jobId: string, effectiveUserId?: string): Promise<string[]> {
    const timeEntries = await storage.getTimeEntriesForJob(jobId);
    const validationErrors: string[] = [];

    // Job Card required-to-close gate: any active job card marked
    // "block job completion" must have a submission for this job before it can close.
    if (effectiveUserId) {
      try {
        const forms = await storage.getCustomForms(effectiveUserId);
        const blockingCards = forms.filter(
          (f) => f.isJobCard && f.blockJobCompletion && f.isActive !== false,
        );
        if (blockingCards.length > 0) {
          const submissions = await storage.getFormSubmissionsByJob(jobId, effectiveUserId);
          const submittedFormIds = new Set(submissions.map((s) => s.formId));
          for (const card of blockingCards) {
            if (!submittedFormIds.has(card.id)) {
              validationErrors.push(`Job Card "${card.name}" must be completed before closing this job`);
            }
          }
        }
      } catch (err) {
        console.error('[getJobCompletionErrors] job card gate check failed:', err);
      }

      // PO reconciliation gate: when enabled, all POs for this job must be
      // Fully Received or Cancelled before the job can be marked done.
      // NOTE: errors here fail CLOSED — an unreadable gate blocks completion
      // rather than silently allowing a job to close with open POs.
      const biz = await storage.getBusinessSettings(effectiveUserId);
      if ((biz as any)?.requirePoReconciliation) {
        const pos = await storage.getPurchaseOrdersByJobId(jobId, effectiveUserId);
        const unresolved = pos.filter(
          (po) => po.status !== 'received' && po.status !== 'cancelled',
        );
        if (unresolved.length > 0) {
          validationErrors.push(
            `${unresolved.length} purchase order${unresolved.length > 1 ? 's' : ''} (${unresolved.map(p => p.poNumber).join(', ')}) must be fully received or cancelled before closing this job`,
          );
        }
      }
    }

    const openEntries = timeEntries.filter(e => !e.endTime && !e.isBreak);
    if (openEntries.length > 0) {
      validationErrors.push(`${openEntries.length} timer(s) still running - stop all timers before completing`);
    }

    const negativeDurations = timeEntries.filter(e => e.duration !== null && e.duration < 0);
    if (negativeDurations.length > 0) {
      validationErrors.push(`${negativeDurations.length} time entry/entries have negative duration`);
    }

    const byWorker = new Map<string, typeof timeEntries>();
    for (const entry of timeEntries.filter(e => e.startTime && e.endTime)) {
      const key = entry.userId;
      if (!byWorker.has(key)) byWorker.set(key, []);
      byWorker.get(key)!.push(entry);
    }

    for (const [, entries] of Array.from(byWorker)) {
      const sorted = entries.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        if (current.endTime && new Date(current.endTime) > new Date(next.startTime)) {
          validationErrors.push('Overlapping time entries detected for a worker');
          break;
        }
      }
    }

    return validationErrors;
  }

  // Business SMS requires the business's own dedicated number. When a send
  // fails for that reason, return the standard 402 shape so clients can show
  // the friendly "get your business number" prompt instead of a raw error.
  function smsFailureResponse(res: any, errorMsg?: string | null, notConfigured?: boolean) {
    if (/dedicated (phone )?number/i.test(errorMsg || '')) {
      return res.status(402).json({
        error: 'Your business needs its own dedicated phone number to send SMS. Purchase one in Phone Numbers.',
        code: 'DEDICATED_NUMBER_REQUIRED',
      });
    }
    return res.status(400).json({
      error: errorMsg || 'Failed to send SMS',
      notConfigured: notConfigured || false,
    });
  }

  export function registerJobsRoutes(app: Express, deps: JobsRoutesDeps): void {
    const {
      trackingTokens,
      buildProofPackData,
      sitePhotoCache,
      upload,
      getJobWithChatAccess,
      chatUpload,
    } = deps;

    app.post("/api/jobs/:jobId/subcontractor-token", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      const { contactPhone, contactName, contactEmail, permissions, expiresAt, sendViaSms, sendViaEmail, hourlyRate, requireCode } = req.body;

      const job = await storage.getJob(jobId, userId);
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const businessSettings = await storage.getBusinessSettings(userId);
      const businessName = businessSettings?.businessName || 'Your contractor';

      const token = randomBytes(32).toString('hex');

      // If contractor opted into wrong-number defence, generate a 4-digit code,
      // hash it, and only return the plaintext to the contractor in the response
      // (NEVER send it via the same SMS — that defeats the purpose).
      let plaintextCode: string | null = null;
      let codeHash: string | null = null;
      let codeIssuedAt: Date | null = null;
      if (requireCode) {
        // Use crypto-grade RNG (not Math.random) so the 4-digit code can't be
        // predicted from prior values.
        plaintextCode = String(randomInt(0, 10000)).padStart(4, '0');
        codeHash = createHash('sha256').update(plaintextCode).digest('hex');
        codeIssuedAt = new Date();
      }

      const tokenData = {
        jobId,
        userId,
        token,
        contactPhone: contactPhone || null,
        contactName: contactName || null,
        contactEmail: contactEmail || null,
        permissions: permissions || ['view_job', 'add_notes', 'add_photos', 'update_status'],
        status: 'pending',
        hourlyRate: hourlyRate !== undefined && hourlyRate !== null ? String(hourlyRate) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        requireCode: !!requireCode,
      } as any;

      const created = await storage.createSubcontractorToken(tokenData);

      // If we generated a code, persist the hash on the token record
      if (codeHash) {
        try {
          await db.update(subcontractorTokens)
            .set({ codeHash, codeIssuedAt, codeAttempts: 0 })
            .where(eq(subcontractorTokens.id, created.id));
        } catch (e) {
          console.error('Failed to persist code hash on subcontractor token:', e);
        }
      }

      // T008: Auto-link known phones. If the recipient phone matches an
      // existing JR user (any role: tradie, owner, sub), pre-set recipientUserId
      // AND nameConfirmedAt so the recipient skips the "Are you Jake?" gate.
      // The 4-digit code (if requireCode=true) is still required.
      let recipientLinkedFirstName: string | null = null;
      if (contactPhone) {
        try {
          const normalized = normalizeAuPhone(contactPhone);
          if (normalized) {
            const existing = await storage.getUserByPhoneNormalized(normalized);
            if (existing) {
              await storage.setSubcontractorTokenRecipient(created.id, existing.id, /*alsoMarkNameConfirmed*/ true);
              recipientLinkedFirstName = existing.firstName || null;
            }
          }
        } catch (e) {
          console.error('Failed to auto-link recipient by phone:', e);
        }
      }

      const baseUrl = getProductionBaseUrl(req);
      // /m/:token = the new premium landing flow with name-gate. /s/:token kept as legacy alias.
      const webLink = `${baseUrl}/m/${created.token}`;

      const sendResults: { sms?: boolean; email?: boolean } = {};
      const recipientName = contactName || 'there';

      if (sendViaSms && contactPhone) {
        try {
          // PII-FREE template. No name, no business, no job title (job titles often
          // contain customer addresses). The name-confirm gate on the landing page
          // handles "is this for you?" without leaking anything via SMS.
          const smsMessage = `JobRunner: A contractor has sent you a job. Tap to view: ${webLink}`;
          const { sendSMS: twilioSend } = await import('../twilioClient');
          const smsResult = await twilioSend({
            to: contactPhone,
            message: smsMessage,
          });
          sendResults.sms = smsResult.success;
        } catch (smsErr: any) {
          console.error('Failed to send subcontractor invite SMS:', smsErr);
          sendResults.sms = false;
        }
      }

      if (sendViaEmail && contactEmail) {
        try {
          const { sendEmail: emailSend } = await import('../emailService');
          await emailSend({
            to: contactEmail,
            subject: `JobRunner: A contractor has sent you a job`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a1a2e;">You've been sent a job</h2>
                <p>A contractor has sent you a job through JobRunner. Tap the button below to confirm it's for you and view the details.</p>
                <div style="text-align: center; margin: 24px 0;">
                  <a href="${webLink}" style="background: #3b82f6; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">Open job</a>
                </div>
                <p style="color: #6b7280; font-size: 14px;">If this wasn't meant for you, you'll be able to say so on the next screen — no job details will be revealed.</p>
              </div>
            `,
          });
          sendResults.email = true;
        } catch (emailErr: any) {
          console.error('Failed to send subcontractor invite email:', emailErr);
          sendResults.email = false;
        }
      }

      // verificationCode is returned ONCE in this response so the contractor
      // can read it out-of-band to the sub. We never store the plaintext.
      res.json({
        ...created,
        webLink,
        sendResults,
        verificationCode: plaintextCode || undefined,
        requireCode: !!requireCode,
      });
    } catch (error: any) {
      console.error('Error creating subcontractor token:', error);
      res.status(500).json({ error: "Failed to create subcontractor token" });
    }
  });

  app.get("/api/jobs/:jobId/subcontractor-tokens", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      const job = await storage.getJob(jobId, userId);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      const tokens = await storage.getSubcontractorTokensByJobId(jobId);
      const events = await storage.getSubcontractorEventsByJob(jobId);

      const tokensWithActivity = tokens.map((token: any) => {
        const tokenEvents = events.filter((e: any) => e.tokenId === token.id);
        const statusMap: Record<string, string> = {
          'SUBBIE_FINISHED': 'done',
          'SUBBIE_STARTED': 'working',
          'SUBBIE_ARRIVED': 'arrived',
          'SUBBIE_EN_ROUTE': 'en_route',
          'SUBBIE_ACCEPTED': 'accepted',
        };
        const statusEventTypes = new Set(Object.keys(statusMap));
        const latestStatusEvent = tokenEvents
          .filter((e: any) => statusEventTypes.has(e.eventType))
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        let currentStatus = token.status;
        if (latestStatusEvent) {
          currentStatus = statusMap[latestStatusEvent.eventType] || token.status;
        }
        const noteEvents = tokenEvents.filter((e: any) => e.eventType === 'SUBBIE_NOTE_ADDED');
        const photoEvents = tokenEvents.filter((e: any) => e.eventType === 'SUBBIE_PHOTO_UPLOADED');
        return {
          ...token,
          currentStatus,
          events: tokenEvents,
          noteCount: noteEvents.length,
          photoCount: photoEvents.length,
          notes: noteEvents.map((e: any) => ({ content: (e.eventData as any)?.content, createdAt: e.createdAt })),
          photos: photoEvents.map((e: any) => ({ url: (e.eventData as any)?.url, caption: (e.eventData as any)?.caption, category: (e.eventData as any)?.category, createdAt: e.createdAt })),
        };
      });
      res.json(tokensWithActivity);
    } catch (error: any) {
      console.error('Error getting subcontractor tokens:', error);
      res.status(500).json({ error: "Failed to load subcontractor tokens" });
    }
  });

  app.delete("/api/jobs/:jobId/subcontractor-tokens/:tokenId", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, tokenId } = req.params;
      const job = await storage.getJob(jobId, userId);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      await db.execute(sql`UPDATE subcontractor_tokens SET status = 'revoked', revoked_at = NOW() WHERE id = ${tokenId} AND job_id = ${jobId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error revoking subcontractor token:', error);
      res.status(500).json({ error: "Failed to revoke subcontractor token" });
    }
  });

  app.get("/api/jobs/:jobId/proof-pack/preview", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const jobId = req.params.jobId;
      const userId = userContext.effectiveUserId;

      const { generateJobProofPackPDF } = await import('../pdfService');
      const data = await buildProofPackData(jobId, userId, req.query);
      const html = generateJobProofPackPDF(data);

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error: any) {
      console.error("Error generating proof pack preview:", error);
      if (error.status) return res.status(error.status).json({ error: error.message });
      res.status(500).json({ error: "Failed to generate proof pack preview" });
    }
  });

  app.get("/api/jobs/:jobId/proof-pack", requireAuth, pdfPerUserLimiter, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const jobId = req.params.jobId;
      const userId = userContext.effectiveUserId;

      const { generateJobProofPackPDF, generatePDFBuffer } = await import('../pdfService');
      const data = await buildProofPackData(jobId, userId, req.query);
      const html = generateJobProofPackPDF(data);

      const pdfBuffer = await generatePDFBuffer(html);
      const fileName = `proof-pack-${data.job.number || jobId}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Error generating proof pack PDF:", error);
      if (error.status) return res.status(error.status).json({ error: error.message });
      res.status(500).json({ error: "Failed to generate proof pack PDF" });
    }
  });

  app.get("/api/jobs/:jobId/proof-pack/export", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const jobId = req.params.jobId;
      const userId = userContext.effectiveUserId;

      const format = req.query.format === 'csv' ? 'csv' : 'tsv';
      const delim = format === 'csv' ? ',' : '\t';
      const esc = (val: any): string => {
        if (val === undefined || val === null) return '';
        let str = String(val).replace(/\r?\n/g, ' ');
        if (/^\s*[=+\-@]/.test(str)) str = "'" + str;
        if (format === 'csv') {
          if (str.includes(',') || str.includes('"')) str = '"' + str.replace(/"/g, '""') + '"';
        } else {
          str = str.replace(/\t/g, ' ');
        }
        return str;
      };
      const row = (cells: any[]) => cells.map(esc).join(delim);

      const data = await buildProofPackData(jobId, userId, req.query);
      const lines: string[] = [];

      lines.push(row(['JOB PROOF PACK']));
      lines.push(row(['Job', data.job.title || data.job.number || jobId]));
      lines.push(row(['Job Number', data.job.number || '']));
      lines.push(row(['Client', (data.client as any)?.name || '']));
      lines.push(row(['Address', data.job.address || '']));
      lines.push(row(['Status', data.job.status || '']));
      lines.push(row(['Exported', new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })]));
      lines.push('');

      if (!data.hideSections.attendance) {
      lines.push(row(['TIME ENTRIES']));
      lines.push(row(['Worker', 'Start', 'End', 'Duration (min)', 'Billable', 'Clock-in Address', 'Clock-out Address']));
      for (const e of data.timeEntries) {
        lines.push(row([e.workerName, e.startTime, e.endTime || '', e.duration, e.billable ? 'Yes' : 'No', e.clockInAddress || '', e.clockOutAddress || '']));
      }
      lines.push('');
      }

      if (!data.hideSections.materials && data.materials.length > 0) {
        lines.push(row(['MATERIALS']));
        lines.push(row(['Name', 'Quantity', 'Unit Cost', 'Total Cost', 'Supplier', 'Status']));
        for (const m of data.materials) {
          lines.push(row([m.name, m.quantity || '', m.unitCost || '', m.totalCost || '', m.supplier || '', m.status || '']));
        }
        lines.push('');
      }

      if (!data.hideSections.photos && data.photos.length > 0) {
        lines.push(row(['PHOTOS']));
        lines.push(row(['Category', 'Caption', 'Taken At', 'Location']));
        for (const ph of data.photos) {
          lines.push(row([ph.category, ph.caption || '', ph.createdAt || '', ph.address || (ph.latitude != null ? `${ph.latitude}, ${ph.longitude}` : '')]));
        }
        lines.push('');
      }

      if (!data.hideSections.swms && data.swmsList.length > 0) {
        lines.push(row(['SWMS SIGN-OFFS']));
        lines.push(row(['SWMS Title', 'Status', 'Worker', 'Signed At', 'Location']));
        for (const sw of data.swmsList) {
          if (sw.signatures.length === 0) {
            lines.push(row([sw.title, sw.status, '(no signatures)', '', '']));
          } else {
            for (const sig of sw.signatures) {
              lines.push(row([sw.title, sw.status, sig.name, sig.signedAt, sig.location || '']));
            }
          }
        }
        lines.push('');
      }

      const pushFormRows = (title: string, forms: any[]) => {
        if (forms.length === 0) return;
        lines.push(row([title]));
        lines.push(row(['Form', 'Type', 'Completed By', 'Submitted At', 'Status', 'Item', 'Response']));
        for (const f of forms) {
          const typeLabel = f.isJobCard ? 'Job Card' : (f.formType === 'safety' ? 'Safety Form' : f.formType === 'inspection' ? 'Inspection' : f.formType === 'compliance' ? 'Compliance Check' : 'Form');
          if (f.responses.length === 0) {
            lines.push(row([f.formName, typeLabel, f.submittedBy || '', f.submittedAt, f.status, '', '']));
          } else {
            for (const r of f.responses) {
              lines.push(row([f.formName, typeLabel, f.submittedBy || '', f.submittedAt, f.status, r.label, r.value]));
            }
          }
          if (f.notes) lines.push(row([f.formName, typeLabel, f.submittedBy || '', f.submittedAt, f.status, 'Notes', f.notes]));
        }
        lines.push('');
      };
      const isSafetyType = (f: any) => !f.isJobCard && ['safety', 'inspection', 'compliance'].includes(String(f.formType || '').toLowerCase());
      if (!data.hideSections.swms) pushFormRows('SAFETY FORMS & CHECKLISTS', (data.safetyForms as any[]).filter(isSafetyType));
      if (!(data.hideSections as any).forms) pushFormRows('JOB CARDS & FORMS', (data.safetyForms as any[]).filter((f: any) => !isSafetyType(f)));

      if (!data.hideSections.invoice && data.invoice) {
        lines.push(row(['INVOICE']));
        lines.push(row(['Number', 'Date', 'Total', 'GST', 'Status']));
        lines.push(row([data.invoice.number, data.invoice.date, data.invoice.total, data.invoice.gstAmount, data.invoice.status]));
      }

      const content = '\ufeff' + lines.join('\r\n');
      const ext = format === 'csv' ? 'csv' : 'tsv';
      const fileName = `proof-pack-${data.job.number || jobId}.${ext}`;
      res.setHeader('Content-Type', format === 'csv' ? 'text/csv; charset=utf-8' : 'text/tab-separated-values; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(content);
    } catch (error: any) {
      console.error("Error exporting proof pack:", error);
      if (error.status) return res.status(error.status).json({ error: error.message });
      res.status(500).json({ error: "Failed to export proof pack" });
    }
  });

  // Shared data builder for job card PDF + preview so both render identically.
  const buildJobCardHtml = async (req: any): Promise<{ html: string; jobCards: any[]; jobId: string } | { error: string; status: number }> => {
    const userContext = await getUserContext(req.userId);
    const jobId = req.params.jobId;
    const userId = userContext.effectiveUserId;

    const job = await storage.getJob(jobId, userId);
    if (!job) return { error: "Job not found", status: 404 };

    const forms = await storage.getCustomForms(userId);
    let jobCards = forms.filter((f: any) => f.isJobCard);
    const submissions = await storage.getFormSubmissionsByJob(jobId, userId);

    // Optional single-card export: ?formId=<id> limits the PDF to one job card section.
    const formId = req.query.formId as string | undefined;
    if (formId) {
      jobCards = jobCards.filter((f: any) => f.id === formId);
      if (jobCards.length === 0) {
        return { error: "Job card not found", status: 404 };
      }
    }

    let businessSettings = await storage.getBusinessSettings(userId);
    const client = job.clientId ? await storage.getClient(job.clientId, userId) : undefined;

    const { generateJobCardHTML, resolveBusinessLogoForPdf } = await import('../pdfService');
    if (businessSettings) {
      businessSettings = await resolveBusinessLogoForPdf(businessSettings as any);
    }
    const html = generateJobCardHTML({ job, jobCards, submissions, businessSettings, client });
    return { html, jobCards, jobId };
  };

  app.get("/api/jobs/:jobId/job-card-pdf/preview", requireAuth, async (req: any, res) => {
    try {
      const result = await buildJobCardHtml(req);
      if ('error' in result) return res.status(result.status).json({ error: result.error });
      res.setHeader('Content-Type', 'text/html');
      res.send(result.html);
    } catch (error: any) {
      console.error("Error generating job card preview:", error);
      res.status(500).json({ error: "Failed to generate job card preview" });
    }
  });

  app.get("/api/jobs/:jobId/job-card-pdf", requireAuth, pdfPerUserLimiter, async (req: any, res) => {
    try {
      const result = await buildJobCardHtml(req);
      if ('error' in result) return res.status(result.status).json({ error: result.error });
      const { html, jobCards, jobId } = result;
      const formId = req.query.formId as string | undefined;

      const { generatePDFBuffer } = await import('../pdfService');
      const pdfBuffer = await generatePDFBuffer(html);
      const cardSlug = formId
        ? (jobCards[0]?.name || 'section').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        : null;
      const fileName = cardSlug ? `job-card-${cardSlug}-${jobId}.pdf` : `job-card-${jobId}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Error generating job card PDF:", error);
      if (error.status) return res.status(error.status).json({ error: error.message });
      res.status(500).json({ error: "Failed to generate job card PDF" });
    }
  });

  app.get("/api/jobs/:jobId/photos/analyze", requireAuth, visionPerUserLimiter, requirePaidTier(), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const jobId = req.params.jobId;
      
      // Get optional photoIds query parameter for selecting specific photos
      const photoIdsParam = req.query.photoIds as string | undefined;
      const selectedPhotoIds = photoIdsParam ? photoIdsParam.split(',').filter(Boolean) : null;
      
      // Get job details
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      // Get photos with signed URLs
      const { getJobPhotos } = await import('../photoService');
      const photos = await getJobPhotos(jobId, userContext.effectiveUserId);
      
      if (!photos.length) {
        return res.status(400).json({ error: 'No photos found for this job' });
      }
      
      // Filter to only photos with valid signed URLs and limit to 10
      // If photoIds are provided, only include those photos
      const photosWithUrls = photos
        .filter(p => p.signedUrl && (p.mimeType?.startsWith('image/') ?? true))
        .filter(p => selectedPhotoIds ? selectedPhotoIds.includes(p.id) : true)
        .slice(0, 10)
        .map(p => ({
          id: p.id,
          signedUrl: p.signedUrl!,
          fileName: p.fileName,
          category: p.category,
          caption: p.caption || undefined
        }));
      
      if (!photosWithUrls.length) {
        return res.status(400).json({ error: 'No valid photo URLs available' });
      }
      
      // Get business settings for trade type and AI permissions
      const businessSettings = await storage.getBusinessSettings(userContext.effectiveUserId);
      
      // Check if AI photo analysis is enabled
      const aiEnabled = businessSettings?.aiEnabled !== false;
      const aiPhotoAnalysisEnabled = businessSettings?.aiPhotoAnalysisEnabled !== false;
      
      if (!aiEnabled || !aiPhotoAnalysisEnabled) {
        return res.status(403).json({ 
          error: 'AI photo analysis is disabled. Enable it in Settings > Notifications to use this feature.' 
        });
      }
      
      const client = job.clientId ? await storage.getClient(job.clientId, userContext.effectiveUserId) : null;
      const tradeOwner = await storage.getUser(userContext.effectiveUserId);
      
      // Stream the AI analysis
      const { streamPhotoAnalysis } = await import('../ai');
      
      const jobContext = {
        title: job.title,
        description: job.description || undefined,
        clientName: client?.name || undefined,
        trade: tradeOwner?.tradeType || undefined
      };
      
      // Check if non-streaming mode is requested (for React Native)
      const noStream = req.query.noStream === 'true';
      
      if (noStream) {
        // Non-streaming mode: collect all chunks and return as JSON
        let fullText = '';
        for await (const chunk of streamPhotoAnalysis(photosWithUrls, jobContext)) {
          fullText += chunk;
        }
        return res.json({ text: fullText, done: true });
      }
      
      // Streaming mode: Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      
      for await (const chunk of streamPhotoAnalysis(photosWithUrls, jobContext)) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
      
      // Signal completion
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error('Error in streaming photo analysis:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to analyze photos" });
      } else {
        res.write(`data: ${JSON.stringify({ error: "Failed to analyze photos" })}\n\n`);
        res.end();
      }
    }
  });

  app.get("/api/jobs/:id/next-action", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const job = await storage.getJob(req.params.id, userContext.effectiveUserId);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Get related data
      const quotes = await storage.getQuotes(userContext.effectiveUserId);
      const invoices = await storage.getInvoices(userContext.effectiveUserId);
      const clients = await storage.getClients(userContext.effectiveUserId);
      
      const jobQuotes = quotes.filter(q => q.jobId === job.id);
      const jobInvoices = invoices.filter(i => i.jobId === job.id);
      const client = clients.find(c => c.id === job.clientId);
      
      const hasQuote = jobQuotes.length > 0;
      const hasInvoice = jobInvoices.length > 0;
      const quoteStatus = hasQuote ? jobQuotes[0].status : undefined;
      const invoiceStatus = hasInvoice ? jobInvoices[0].status : undefined;
      
      const daysSinceCreated = Math.floor((Date.now() - new Date(job.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24));
      const daysSinceLastUpdate = Math.floor((Date.now() - new Date(job.updatedAt || job.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24));
      
      const { generateJobNextAction } = await import('../ai');
      
      const nextAction = await generateJobNextAction({
        jobStatus: job.status,
        jobTitle: job.title,
        clientName: client?.name || 'Unknown',
        hasQuote,
        quoteStatus,
        hasInvoice,
        invoiceStatus,
        daysSinceCreated,
        daysSinceLastUpdate,
        hasPhotos: !!((job as any).photos?.length),
        scheduledAt: job.scheduledAt,
        completedAt: job.completedAt,
      });
      
      res.json(nextAction);
    } catch (error) {
      console.error("Error getting job next action:", error);
      res.status(500).json({ error: "Failed to get next action" });
    }
  });

  app.get("/api/jobs/next-actions", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const jobs = await storage.getJobs(userContext.effectiveUserId);
      const quotes = await storage.getQuotes(userContext.effectiveUserId);
      const invoices = await storage.getInvoices(userContext.effectiveUserId);
      const clients = await storage.getClients(userContext.effectiveUserId);
      
      const { generateJobNextAction } = await import('../ai');
      
      const nextActions: Record<string, any> = {};
      
      // Process active jobs only (not invoiced)
      const activeJobs = jobs.filter(j => j.status !== 'invoiced').slice(0, 50);
      
      for (const job of activeJobs) {
        const jobQuotes = quotes.filter(q => q.jobId === job.id);
        const jobInvoices = invoices.filter(i => i.jobId === job.id);
        const client = clients.find(c => c.id === job.clientId);
        
        const hasQuote = jobQuotes.length > 0;
        const hasInvoice = jobInvoices.length > 0;
        const quoteStatus = hasQuote ? jobQuotes[0].status : undefined;
        const invoiceStatus = hasInvoice ? jobInvoices[0].status : undefined;
        
        const daysSinceCreated = Math.floor((Date.now() - new Date(job.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24));
        const daysSinceLastUpdate = Math.floor((Date.now() - new Date(job.updatedAt || job.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24));
        
        nextActions[job.id] = await generateJobNextAction({
          jobStatus: job.status,
          jobTitle: job.title,
          clientName: client?.name || 'Unknown',
          hasQuote,
          quoteStatus,
          hasInvoice,
          invoiceStatus,
          daysSinceCreated,
          daysSinceLastUpdate,
          hasPhotos: !!((job as any).photos?.length),
          scheduledAt: job.scheduledAt,
          completedAt: job.completedAt,
        });
      }
      
      res.json(nextActions);
    } catch (error) {
      console.error("Error getting job next actions:", error);
      res.status(500).json({ error: "Failed to get next actions" });
    }
  });

  app.get("/api/jobs/:id/profit", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const job = await storage.getJob(req.params.id, userContext.effectiveUserId);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Get invoices for this job
      const invoices = await storage.getInvoices(userContext.effectiveUserId);
      const jobInvoices = invoices.filter(i => i.jobId === job.id && i.status === 'paid');
      const invoiceTotal = jobInvoices.reduce((sum, i) => sum + (parseFloat(i.total || '0')), 0);
      
      // Get quoted amount
      const quotes = await storage.getQuotes(userContext.effectiveUserId);
      const jobQuote = quotes.find(q => q.jobId === job.id && (q.status === 'accepted' || q.status === 'sent'));
      const quotedAmount = jobQuote ? parseFloat(jobQuote.total || '0') : null;
      
      // Get expenses for this job
      const expenses = await storage.getExpenses(userContext.effectiveUserId);
      const jobExpenses = expenses.filter(e => e.jobId === job.id);
      const materialsCostFromExpenses = jobExpenses.filter(e => e.category === 'materials').reduce((sum, e) => sum + parseFloat(e.amount), 0);
      const otherExpenses = jobExpenses.filter(e => e.category !== 'materials').reduce((sum, e) => sum + parseFloat(e.amount), 0);
      
      // Get materials from job_materials table
      let materialsCostFromMaterials = 0;
      try {
        const jobMaterials = await storage.getJobMaterials(job.id, userContext.effectiveUserId);
        materialsCostFromMaterials = jobMaterials.reduce((sum, m) => sum + parseFloat(m.totalCost?.toString() || '0'), 0);
      } catch (e) { /* no materials */ }
      
      const materialsCost = materialsCostFromExpenses + materialsCostFromMaterials;
      
      // Get time entries for labour cost using actual rates (all team members)
      const completedEntries = await storage.getTimeEntriesForJob(job.id);
      const timeEntries = completedEntries;
      const totalMinutes = timeEntries.reduce((sum, t) => {
        if (t.startTime && t.endTime) {
          return sum + Math.floor((new Date(t.endTime).getTime() - new Date(t.startTime).getTime()) / 60000);
        }
        return sum;
      }, 0);
      const labourCost = timeEntries.reduce((sum, t) => {
        if (t.startTime && t.endTime) {
          const hours = (new Date(t.endTime).getTime() - new Date(t.startTime).getTime()) / (1000 * 60 * 60);
          const rate = parseFloat(t.hourlyRate?.toString() || '0');
          return sum + (hours * rate);
        }
        return sum;
      }, 0);
      
      const { calculateJobProfit } = await import('../ai');
      
      const profitData = calculateJobProfit({
        invoiceTotal,
        labourCost,
        materialsCost,
        otherExpenses,
      });
      
      res.json({
        ...profitData,
        revenue: invoiceTotal,
        quoted: quotedAmount,
        quotedVsActual: quotedAmount !== null ? quotedAmount - (invoiceTotal) : null,
        costs: {
          labour: labourCost,
          materials: materialsCost,
          other: otherExpenses,
          total: labourCost + materialsCost + otherExpenses,
        },
        hoursWorked: totalMinutes / 60,
      });
    } catch (error) {
      console.error("Error calculating job profit:", error);
      res.status(500).json({ error: "Failed to calculate profit" });
    }
  });

  app.get("/api/jobs/:id/equipment", requireAuth, async (req: any, res) => {
    try {
      const assignments = await storage.getJobEquipment(req.params.id);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching job equipment:", error);
      res.status(500).json({ error: "Failed to fetch job equipment" });
    }
  });

  app.post("/api/jobs/:id/equipment", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const jobId = req.params.id;
      const equipmentId = req.body.equipmentId;
      const forceAssign = req.body.forceAssign === true;

      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const equipmentItem = await storage.getEquipmentById(equipmentId, userContext.effectiveUserId);
      if (!equipmentItem) {
        return res.status(404).json({ error: "Equipment not found" });
      }

      if (!forceAssign) {
        const jobDate = job.scheduledAt;

        if (jobDate) {
          const existingAssignments = await db
            .select({
              id: jobEquipment.id,
              jobId: jobEquipment.jobId,
              equipmentId: jobEquipment.equipmentId,
              jobTitle: jobs.title,
              jobStatus: jobs.status,
              jobScheduledAt: jobs.scheduledAt,
            })
            .from(jobEquipment)
            .innerJoin(jobs, eq(jobs.id, jobEquipment.jobId))
            .where(and(
              eq(jobEquipment.equipmentId, equipmentId),
              eq(jobs.userId, userContext.effectiveUserId)
            ));

          const conflicts = [];
          const jobDay = new Date(jobDate).toDateString();

          for (const assignment of existingAssignments) {
            if (assignment.jobId === jobId) continue;

            const assignedDate = assignment.jobScheduledAt;
            if (!assignedDate) continue;

            const assignedDay = new Date(assignedDate).toDateString();

            if (jobDay === assignedDay && !['completed', 'cancelled', 'done'].includes(assignment.jobStatus || '')) {
              conflicts.push({
                jobId: assignment.jobId,
                jobTitle: assignment.jobTitle,
                date: assignedDay
              });
            }
          }

          if (conflicts.length > 0) {
            return res.status(409).json({
              warning: 'Equipment scheduling conflict',
              conflicts,
              message: `This equipment is already assigned to ${conflicts.length} other active job(s) on this date`
            });
          }
        }
      }

      const assignment = await storage.addJobEquipment({
        jobId,
        equipmentId,
        userId: String(req.user.id),
        notes: req.body.notes || null,
      });
      res.json(assignment);
    } catch (error) {
      console.error("Error assigning equipment to job:", error);
      res.status(500).json({ error: "Failed to assign equipment" });
    }
  });

  app.patch("/api/jobs/:jobId/equipment/:assignmentId", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { jobId, assignmentId } = req.params;

      const [existing] = await db
        .select()
        .from(jobEquipment)
        .where(and(
          eq(jobEquipment.id, assignmentId),
          eq(jobEquipment.jobId, jobId),
          eq(jobEquipment.userId, userContext.effectiveUserId)
        ));

      if (!existing) {
        return res.status(404).json({ error: "Equipment assignment not found" });
      }

      const hoursUsed = req.body.hoursUsed !== undefined && req.body.hoursUsed !== '' ? parseFloat(req.body.hoursUsed) : undefined;
      const kmTravelled = req.body.kmTravelled !== undefined && req.body.kmTravelled !== '' ? parseFloat(req.body.kmTravelled) : undefined;

      if (hoursUsed !== undefined && (isNaN(hoursUsed) || hoursUsed < 0)) {
        return res.status(400).json({ error: "hoursUsed must be a non-negative number" });
      }
      if (kmTravelled !== undefined && (isNaN(kmTravelled) || kmTravelled < 0)) {
        return res.status(400).json({ error: "kmTravelled must be a non-negative number" });
      }

      const updateData: Record<string, any> = {};
      if (hoursUsed !== undefined) updateData.hoursUsed = hoursUsed;
      if (req.body.hoursUsed === '') updateData.hoursUsed = null;
      if (kmTravelled !== undefined) updateData.kmTravelled = kmTravelled;
      if (req.body.kmTravelled === '') updateData.kmTravelled = null;
      if (req.body.capacityUsed !== undefined) updateData.capacityUsed = req.body.capacityUsed === '' ? null : req.body.capacityUsed;
      if (req.body.capacityAvailable !== undefined) updateData.capacityAvailable = req.body.capacityAvailable === '' ? null : req.body.capacityAvailable;
      if (req.body.postJobNotes !== undefined) updateData.postJobNotes = req.body.postJobNotes === '' ? null : req.body.postJobNotes;
      if (req.body.wasOversized !== undefined) updateData.wasOversized = req.body.wasOversized;
      if (req.body.completedAt !== undefined) updateData.completedAt = req.body.completedAt ? new Date(req.body.completedAt) : null;

      const [updated] = await db
        .update(jobEquipment)
        .set(updateData)
        .where(eq(jobEquipment.id, assignmentId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error updating equipment assignment:", error);
      res.status(500).json({ error: "Failed to update equipment assignment" });
    }
  });

  app.delete("/api/jobs/:id/equipment/:assignmentId", requireAuth, async (req: any, res) => {
    try {
      await storage.removeJobEquipment(req.params.assignmentId, String(req.user.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing equipment from job:", error);
      res.status(500).json({ error: "Failed to remove equipment" });
    }
  });

  // Returns the set of job ids a worker is actively assigned to via the
  // job_assignments table. The legacy jobs.assignedTo column only holds ONE
  // assignee (the lead), so on multi-worker jobs every other assigned worker
  // would otherwise be hidden from their own lists. Match by user id or team
  // member id and fail open to an empty set on error.
  const getWorkerAssignedJobIds = async (userContext: any): Promise<Set<string>> => {
    try {
      const ids = await storage.getAssignedJobIdsForUser(userContext.userId, userContext.teamMemberId);
      return new Set(ids);
    } catch (e) {
      console.error('Error loading worker job assignments:', e);
      return new Set<string>();
    }
  };

  app.get("/api/jobs", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const includeArchived = req.query.archived === 'true';
      let jobs = await storage.getJobs(userContext.effectiveUserId, includeArchived);

      // Cross-business subcontractor: pull in jobs this user is assigned to that
      // live in ANOTHER business. getJobs() is scoped to the active workspace, so
      // a job owned by a different business never appears even though the user is
      // on its assigned team. getAssignedJobIdsForUser spans all businesses, so
      // fetch any assigned ids missing from the workspace set via the unscoped
      // lookup and merge them in (respecting the archived/active toggle).
      const assignedIds = await getWorkerAssignedJobIds(userContext);
      if (assignedIds.size > 0) {
        const presentIds = new Set(jobs.map(j => j.id));
        const missingIds = [...assignedIds].filter(id => !presentIds.has(id));
        if (missingIds.length > 0) {
          const extraJobs = (await Promise.all(
            missingIds.map(id => storage.getJobPublic(id).catch(() => undefined))
          )).filter((j): j is NonNullable<typeof j> =>
            !!j && (includeArchived ? !!j.archivedAt : !j.archivedAt)
          );
          if (extraJobs.length > 0) jobs = [...jobs, ...extraJobs];
        }
      }
      
      // Staff tradies and subcontractors (team members without VIEW_ALL permission) only see their assigned jobs
      const hasViewAll = userContext.permissions.includes('view_all') || userContext.isOwner;
      if (!hasViewAll && userContext.teamMemberId) {
        jobs = jobs.filter(job => 
          job.assignedTo === userContext.teamMemberId || 
          job.assignedTo === userContext.userId ||
          assignedIds.has(job.id)
        );
      }
      
      // Filter for unassigned jobs if requested
      const { unassigned } = req.query;
      if (unassigned === 'true') {
        jobs = jobs.filter(job => 
          !job.assignedTo && 
          job.status !== 'done' && 
          job.status !== 'invoiced'
        );
      }

      // Server-side filtering params
      const statusFilter = req.query.status as string | undefined;
      if (statusFilter) {
        const statuses = statusFilter.split(',').map((s: string) => s.trim());
        jobs = jobs.filter(job => statuses.includes(job.status));
      }

      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      if (dateFrom) {
        const from = new Date(dateFrom);
        jobs = jobs.filter(job => {
          const d = job.scheduledAt ? new Date(job.scheduledAt) : job.createdAt ? new Date(job.createdAt) : null;
          return d && d >= from;
        });
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        jobs = jobs.filter(job => {
          const d = job.scheduledAt ? new Date(job.scheduledAt) : job.createdAt ? new Date(job.createdAt) : null;
          return d && d <= to;
        });
      }

      const assignedTo = req.query.assignedTo as string | undefined;
      if (assignedTo) {
        jobs = jobs.filter(job => job.assignedTo === assignedTo);
      }

      const clientId = req.query.clientId as string | undefined;
      if (clientId) {
        jobs = jobs.filter(job => job.clientId === clientId);
      }

      const searchText = req.query.search as string | undefined;
      if (searchText) {
        const lower = searchText.toLowerCase();
        jobs = jobs.filter(job =>
          (job.title || '').toLowerCase().includes(lower) ||
          (job.address || '').toLowerCase().includes(lower) ||
          (job.description || '').toLowerCase().includes(lower)
        );
      }

      const suburb = req.query.suburb as string | undefined;
      if (suburb) {
        const lower = suburb.toLowerCase();
        jobs = jobs.filter(job => (job.address || '').toLowerCase().includes(lower));
      }
      
      const totalCount = jobs.length;
      res.setHeader('X-Total-Count', totalCount);

      const limitParam = parseInt(req.query.limit as string);
      const offsetParam = parseInt(req.query.offset as string);
      if (!isNaN(limitParam) && limitParam > 0) {
        const offset = !isNaN(offsetParam) && offsetParam >= 0 ? offsetParam : 0;
        jobs = jobs.slice(offset, offset + limitParam);
      }
      
      const clients = await storage.getClients(userContext.effectiveUserId);
      const clientMap = new Map(clients.map((c: any) => [c.id, c]));
      const enrichedJobs = jobs.map((job: any) => {
        const client = job.clientId ? clientMap.get(job.clientId) : null;
        return {
          ...job,
          clientName: client?.name || null,
          clientEmail: client?.email || null,
          clientPhone: client?.phone || null,
        };
      });
      
      res.json(enrichedJobs);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  app.get("/api/jobs/site-photos", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      let jobs = await storage.getJobs(userContext.effectiveUserId);
      
      if (!userContext.isOwner) {
        const hasViewAll = userContext.permissions.includes('view_all' as any);
        const hasManageTeam = userContext.permissions.includes('manage_team' as any);
        if (!hasViewAll && !hasManageTeam) {
          const assignedIds = await getWorkerAssignedJobIds(userContext);
          jobs = jobs.filter((j: any) => {
            return j.assignedTo === req.userId || 
                   j.assignedTo === userContext.teamMemberId ||
                   assignedIds.has(j.id) ||
                   (j.assignedTeamMembers && Array.isArray(j.assignedTeamMembers) && 
                    (j.assignedTeamMembers.includes(req.userId) || j.assignedTeamMembers.includes(userContext.teamMemberId)));
          });
        }
      }
      
      // Limit to recent 50 jobs for performance
      const recentJobs = jobs.slice(0, 50);
      
      const photoMap: Record<string, string> = {};
      const now = Date.now();
      const urlPromises: Promise<void>[] = [];
      
      // Process jobs and check cache first
      for (const job of recentJobs) {
        const cached = sitePhotoCache.get(job.id);
        if (cached && cached.expires > now) {
          photoMap[job.id] = cached.url;
          continue;
        }
        
        // Queue URL generation for jobs not in cache
        urlPromises.push((async () => {
          try {
            const photos = await storage.getJobPhotos(job.id, userContext.effectiveUserId);
            if (photos && photos.length > 0) {
              const firstPhoto = photos[0];
              if (firstPhoto.objectStorageKey) {
                const { getSignedPhotoUrl } = await import('../photoService');
                const { url: signedUrl } = await getSignedPhotoUrl(firstPhoto.objectStorageKey);
                if (signedUrl) {
                  photoMap[job.id] = signedUrl;
                  // Cache for 30 minutes
                  sitePhotoCache.set(job.id, { url: signedUrl, expires: now + 30 * 60 * 1000 });
                }
              }
            }
          } catch (urlError) {
            // Photo URL generation failed, skip this job silently
          }
        })());
      }
      
      // Generate URLs in parallel with concurrency limit (10 at a time)
      const chunks = [];
      for (let i = 0; i < urlPromises.length; i += 10) {
        chunks.push(urlPromises.slice(i, i + 10));
      }
      for (const chunk of chunks) {
        await Promise.all(chunk);
      }
      
      res.json(photoMap);
    } catch (error) {
      console.error("Error fetching job site photos:", error);
      res.status(500).json({ error: "Failed to fetch job site photos" });
    }
  });

  app.post("/api/jobs/:id/archive", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const job = await storage.archiveJob(req.params.id, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error archiving job:", error);
      res.status(500).json({ error: "Failed to archive job" });
    }
  });

  app.post("/api/jobs/:id/unarchive", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const job = await storage.unarchiveJob(req.params.id, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error unarchiving job:", error);
      res.status(500).json({ error: "Failed to unarchive job" });
    }
  });

  app.post("/api/jobs/:id/clone", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const effectiveUserId = userContext.effectiveUserId;
      const sourceJob = await storage.getJob(req.params.id, effectiveUserId);
      if (!sourceJob) {
        return res.status(404).json({ error: "Job not found" });
      }

      const limitCheck = await FreemiumService.canUserCreateJob(effectiveUserId);
      if (!limitCheck.canCreate) {
        return res.status(402).json({
          error: limitCheck.reason,
          type: 'SUBSCRIPTION_LIMIT',
          usageInfo: limitCheck.usageInfo
        });
      }

      const clonedJob = await storage.createJob({
        userId: effectiveUserId,
        title: sourceJob.title,
        description: sourceJob.description || undefined,
        clientId: sourceJob.clientId,
        address: sourceJob.address || undefined,
        latitude: sourceJob.latitude || undefined,
        longitude: sourceJob.longitude || undefined,
        scheduledAt: sourceJob.scheduledAt ? new Date(sourceJob.scheduledAt) : undefined,
        estimatedDuration: sourceJob.estimatedDuration || undefined,
        status: 'pending',
      });

      // Note: job number is auto-generated inside storage.createJob when a prefix is configured.
      await FreemiumService.incrementJobCount(effectiveUserId);

      await logActivity(
        effectiveUserId,
        'job_created',
        `Duplicated job: ${clonedJob.title}`,
        `Cloned from job ${sourceJob.title}`,
        'job',
        clonedJob.id,
        { source: 'clone', sourceJobId: sourceJob.id },
        req
      );

      res.status(201).json(clonedJob);
    } catch (error) {
      console.error("Error cloning job:", error);
      res.status(500).json({ error: "Failed to clone job" });
    }
  });

  app.get("/api/jobs/my-jobs", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_JOBS), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const jobs = await storage.getJobs(userContext.effectiveUserId);
      const clients = await storage.getClients(userContext.effectiveUserId);
      const canSeeSensitiveData = userContext.isOwner || hasPermission(userContext, PERMISSIONS.READ_CLIENTS_SENSITIVE);
      
      // Filter to only jobs assigned to this user (check teamMemberId, userId, and job_assignments)
      const assignedIds = await getWorkerAssignedJobIds(userContext);
      const myJobs = jobs
        .filter(job => 
          job.assignedTo === userContext.teamMemberId || 
          job.assignedTo === userContext.userId ||
          assignedIds.has(job.id)
        )
        .map(job => {
          const client = clients.find((c: any) => c.id === job.clientId);
          return {
            ...job,
            clientName: client?.name || 'Unknown Client',
            clientPhone: canSeeSensitiveData ? (client?.phone || null) : null,
            clientEmail: canSeeSensitiveData ? (client?.email || null) : null,
          };
        })
        .sort((a, b) => {
          // scheduleOrder only applies WITHIN the today cohort — never
          // promotes today jobs ahead of past/future jobs.
          const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);
          const isToday = (j: any) => j.scheduledAt &&
            new Date(j.scheduledAt) >= todayStart && new Date(j.scheduledAt) < todayEnd;
          if (isToday(a) && isToday(b) && a.scheduleOrder != null && b.scheduleOrder != null) {
            return (a.scheduleOrder as number) - (b.scheduleOrder as number);
          }
          if (a.scheduledAt && b.scheduledAt) {
            return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
          }
          if (a.scheduledAt) return -1;
          if (b.scheduledAt) return 1;
          return 0;
        });
      
      res.json(myJobs);
    } catch (error) {
      console.error("Error fetching my jobs:", error);
      res.status(500).json({ error: "Failed to fetch my jobs" });
    }
  });

  app.get("/api/jobs/available", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_JOBS), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      
      // Check if user has REQUEST_JOB_ASSIGNMENT permission
      // (legacy permission string not part of the Permission enum)
      const hasPermission = (userContext.permissions as string[]).includes('request_job_assignment') || userContext.isOwner;
      if (!hasPermission) {
        return res.status(403).json({ error: "You don't have permission to view available jobs" });
      }
      
      const jobs = await storage.getJobs(userContext.effectiveUserId);
      
      // Filter to only unassigned, active jobs
      const availableJobs = jobs
        .filter(job => 
          !job.assignedTo && 
          job.status !== 'done' && 
          job.status !== 'invoiced' &&
          job.status !== 'cancelled' &&
          !job.archivedAt
        )
        .map(job => ({
          // Return minimal info only - privacy protected
          id: job.id,
          title: job.title,
          description: job.description ? job.description.substring(0, 100) + (job.description.length > 100 ? '...' : '') : null,
          status: job.status,
          scheduledAt: job.scheduledAt,
          scheduledEndAt: job.scheduledAt
            ? new Date(new Date(job.scheduledAt).getTime() + (job.estimatedDuration ?? 60) * 60 * 1000)
            : null,
          estimatedDuration: job.estimatedDuration,
          priority: null,
          // Location info - only suburb/city, not full address
          suburb: job.address ? job.address.split(',').slice(-2, -1)[0]?.trim() : null,
          // NO client name, phone, email, full address for privacy
          createdAt: job.createdAt,
        }))
        .sort((a, b) => {
          // Sort by scheduled date
          if (a.scheduledAt && b.scheduledAt) {
            return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
          }
          if (a.scheduledAt) return -1;
          if (b.scheduledAt) return 1;
          return 0;
        });
      
      res.json(availableJobs);
    } catch (error) {
      console.error("Error fetching available jobs:", error);
      res.status(500).json({ error: "Failed to fetch available jobs" });
    }
  });

  app.post("/api/jobs/:id/request-assignment", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_JOBS), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      
      // Check if user has REQUEST_JOB_ASSIGNMENT permission
      // (legacy permission string not part of the Permission enum)
      const hasPermission = (userContext.permissions as string[]).includes('request_job_assignment');
      if (!hasPermission) {
        return res.status(403).json({ error: "You don't have permission to request job assignments" });
      }
      
      // Must be a team member (not owner)
      if (userContext.isOwner || !userContext.teamMemberId) {
        return res.status(400).json({ error: "Only team members can request job assignments" });
      }
      
      const { reason } = req.body;
      const jobId = req.params.id;
      
      // Verify job exists and is available
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (job.assignedTo) {
        return res.status(400).json({ error: "This job is already assigned" });
      }
      
      if (job.status === 'done' || job.status === 'invoiced' || job.status === 'cancelled') {
        return res.status(400).json({ error: "Cannot request assignment to a completed or cancelled job" });
      }
      
      // Check for existing pending request
      const existingRequest = await db.select()
        .from(jobAssignmentRequests)
        .where(
          and(
            eq(jobAssignmentRequests.jobId, jobId),
            eq(jobAssignmentRequests.requesterId, req.userId),
            eq(jobAssignmentRequests.status, 'pending')
          )
        )
        .limit(1);
      
      if (existingRequest.length > 0) {
        return res.status(400).json({ error: "You already have a pending request for this job" });
      }
      
      // Create the assignment request
      const [request] = await db.insert(jobAssignmentRequests)
        .values({
          jobId,
          teamMemberId: userContext.teamMemberId,
          requesterId: req.userId,
          businessOwnerId: userContext.effectiveUserId,
          reason: reason || null,
          status: 'pending',
        })
        .returning();
      
      // Create notification for owner
      const requester = await storage.getUser(req.userId);
      await storage.createNotification({
        userId: userContext.effectiveUserId,
        type: 'job_assignment_request',
        title: 'Job Assignment Request',
        message: `${requester?.firstName || 'A team member'} has requested to be assigned to: ${job.title}`,
        relatedId: jobId,
        relatedType: 'job',
      });
      
      res.json({ 
        success: true, 
        request,
        message: 'Your assignment request has been submitted' 
      });
    } catch (error) {
      console.error("Error requesting job assignment:", error);
      res.status(500).json({ error: "Failed to request job assignment" });
    }
  });

  app.get("/api/jobs/today", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_JOBS), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      let jobs = await storage.getJobs(userContext.effectiveUserId);
      const clients = await storage.getClients(userContext.effectiveUserId);
      
      // Staff tradies and subcontractors only see their assigned jobs
      const hasViewAll = userContext.permissions.includes('view_all') || userContext.isOwner;
      if (!hasViewAll && userContext.teamMemberId) {
        const assignedIds = await getWorkerAssignedJobIds(userContext);
        jobs = jobs.filter(job => 
          job.assignedTo === userContext.teamMemberId || 
          job.assignedTo === userContext.userId ||
          assignedIds.has(job.id)
        );
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todaysJobs = jobs
        .filter(job => {
          if (!job.scheduledAt) return false;
          const schedDate = new Date(job.scheduledAt);
          return schedDate >= today && schedDate < tomorrow;
        })
        .map(job => {
          const client = clients.find((c: any) => c.id === job.clientId);
          return {
            ...job,
            clientName: client?.name || 'Unknown Client',
            clientPhone: client?.phone || null,
            clientEmail: client?.email || null,
          };
        })
        .sort((a, b) => {
          const aHasOrder = a.scheduleOrder != null;
          const bHasOrder = b.scheduleOrder != null;
          if (aHasOrder && bHasOrder) return (a.scheduleOrder as number) - (b.scheduleOrder as number);
          if (aHasOrder) return -1;
          if (bHasOrder) return 1;
          return new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime();
        });

      res.json(todaysJobs);
    } catch (error) {
      console.error("Error fetching today's jobs:", error);
      res.status(500).json({ error: "Failed to fetch today's jobs" });
    }
  });

  app.patch("/api/jobs/today/reorder", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_JOBS), async (req: any, res) => {
    try {
      const schema = z.object({
        jobIds: z.array(z.string().min(1)).min(1).max(100),
        // Optional ISO date (YYYY-MM-DD) — defaults to server "today" in
        // local timezone. Validated to ensure submitted IDs all fall on
        // that calendar day so reorders can't smuggle cross-day changes.
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues });
      const { jobIds, date } = parsed.data;
      if (new Set(jobIds).size !== jobIds.length) {
        return res.status(400).json({ error: 'jobIds must be unique' });
      }
      const userContext = await getUserContext(req.userId);
      const uid = userContext.effectiveUserId;

      const dayStart = date ? new Date(`${date}T00:00:00`) : new Date();
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const allJobs = await storage.getJobs(uid);
      const reorderAssignedIds = await getWorkerAssignedJobIds(userContext);
      const inScopeToday = allJobs.filter((j: any) => {
        if (!j.scheduledAt) return false;
        const t = new Date(j.scheduledAt);
        if (t < dayStart || t >= dayEnd) return false;
        if (userContext.isOwner || userContext.permissions.includes('view_all')) return true;
        return j.assignedTo === userContext.teamMemberId || j.assignedTo === userContext.userId || reorderAssignedIds.has(j.id);
      });
      const allowed = new Set(inScopeToday.map((j: any) => j.id));
      for (const id of jobIds) {
        if (!allowed.has(id)) {
          return res.status(403).json({ error: 'One or more jobs are not in scope for the requested date' });
        }
      }

      // Assign 10, 20, 30… so future inserts can wedge between values.
      const submitted = new Set(jobIds);
      for (let idx = 0; idx < jobIds.length; idx++) {
        await storage.updateJob(jobIds[idx], uid, { scheduleOrder: (idx + 1) * 10 });
      }
      // Clear stale order on omitted same-day jobs.
      for (const j of inScopeToday) {
        if (!submitted.has(j.id) && j.scheduleOrder != null) {
          await storage.updateJob(j.id, uid, { scheduleOrder: null });
        }
      }
      res.json({ success: true, count: jobIds.length, date: dayStart.toISOString().slice(0, 10) });
    } catch (error: any) {
      console.error("Error reordering today's jobs:", error);
      res.status(500).json({ error: error?.message || "Failed to reorder" });
    }
  });

  app.get("/api/jobs/today/route", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_JOBS), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const uid = userContext.effectiveUserId;
      let jobs = await storage.getJobs(uid);
      const hasViewAll = userContext.permissions.includes('view_all') || userContext.isOwner;
      if (!hasViewAll) {
        // Even when teamMemberId is missing, restrict to jobs explicitly
        // assigned to this user — never fall through to business-wide
        // route metrics for non-view_all users.
        const assignedIds = await getWorkerAssignedJobIds(userContext);
        jobs = jobs.filter((j: any) =>
          (userContext.teamMemberId && j.assignedTo === userContext.teamMemberId) ||
          j.assignedTo === userContext.userId ||
          assignedIds.has(j.id)
        );
      }
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      const todays = jobs
        .filter((j: any) => j.scheduledAt && new Date(j.scheduledAt) >= today && new Date(j.scheduledAt) < tomorrow)
        .filter((j: any) => j.latitude != null && j.longitude != null)
        .sort((a: any, b: any) => {
          const aHas = a.scheduleOrder != null, bHas = b.scheduleOrder != null;
          if (aHas && bHas) return a.scheduleOrder - b.scheduleOrder;
          if (aHas) return -1; if (bHas) return 1;
          return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
        });
      if (todays.length < 2) {
        return res.json({ durationMinutes: 0, distanceKm: 0, segments: 0, jobsWithLocation: todays.length, source: 'none' });
      }
      let totalMinutes = 0, totalKm = 0, source: 'osrm' | 'haversine' | 'mixed' = 'osrm';
      let osrmFailures = 0;
      for (let i = 0; i < todays.length - 1; i++) {
        const from = todays[i], to = todays[i + 1];
        const fLat = parseFloat(String(from.latitude)), fLng = parseFloat(String(from.longitude));
        const tLat = parseFloat(String(to.latitude)), tLng = parseFloat(String(to.longitude));
        const eta = await calculateRouteETA(fLat, fLng, tLat, tLng);
        if (eta) {
          totalMinutes += eta.durationMinutes;
          totalKm += eta.distanceKm;
        } else {
          osrmFailures++;
          const km = haversineDistance(fLat, fLng, tLat, tLng);
          totalKm += km;
          totalMinutes += Math.ceil((km / 50) * 60); // assume 50 km/h average
        }
      }
      if (osrmFailures === todays.length - 1) source = 'haversine';
      else if (osrmFailures > 0) source = 'mixed';
      res.json({
        durationMinutes: totalMinutes,
        distanceKm: Math.round(totalKm * 10) / 10,
        segments: todays.length - 1,
        jobsWithLocation: todays.length,
        source,
      });
    } catch (error: any) {
      console.error("Error computing today's route:", error);
      res.status(500).json({ error: "Failed to compute route" });
    }
  });

  app.get("/api/jobs/contextual", requireAuth, async (req: any, res) => {
    try {
      const { status, forDocument } = req.query;
      const userId = req.userId;
      
      const [jobs, quotes, invoices, clients] = await Promise.all([
        storage.getJobs(userId),
        storage.getQuotes(userId),
        storage.getInvoices(userId),
        storage.getClients(userId)
      ]);
      
      // Create lookup maps
      const clientsMap = new Map(clients.map((c: any) => [c.id, c]));
      const quotesMap = new Map(quotes.filter((q: any) => q.jobId).map((q: any) => [q.jobId, q]));
      const invoicesMap = new Map(invoices.filter((i: any) => i.jobId).map((i: any) => [i.jobId, i]));
      
      // Filter by status if provided
      let filteredJobs = jobs;
      if (status) {
        const statusFilters = status.split(',');
        filteredJobs = jobs.filter((j: any) => statusFilters.includes(j.status));
      }
      
      // Sort jobs: priority for completed/done, then by recency
      const statusPriority: Record<string, number> = {
        'done': 0,
        'completed': 0,
        'invoiced': 1,
        'in_progress': 2,
        'scheduled': 3,
        'pending': 4
      };
      
      filteredJobs.sort((a: any, b: any) => {
        const priorityA = statusPriority[a.status] ?? 5;
        const priorityB = statusPriority[b.status] ?? 5;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
      });
      
      // Enrich jobs with client data, time entries, photos, and linked documents
      const enrichedJobs = await Promise.all(
        filteredJobs
          .slice(0, 20) // Limit to 20 most recent
          .map(async (job: any) => {
            const client = clientsMap.get(job.clientId);
            const linkedQuote = quotesMap.get(job.id);
            const linkedInvoice = invoicesMap.get(job.id);
            
            // Get time entries for this job
            const timeEntries = await storage.getTimeEntries(userId, job.id);
            const totalMinutes = timeEntries.reduce((acc: number, entry: any) => {
              if (entry.duration) return acc + entry.duration;
              if (entry.endTime && entry.startTime) {
                const diffMs = new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime();
                return acc + Math.round(diffMs / 60000);
              }
              return acc;
            }, 0);
            const totalHours = Math.round(totalMinutes / 60 * 100) / 100;
            
            // Get photos for this job
            const photos = await storage.getJobPhotos(job.id, userId);
            
            // Get line items for linked quote if exists
            const quoteLineItems = linkedQuote 
              ? await storage.getQuoteLineItems(linkedQuote.id)
              : [];
            
            return {
              ...job,
              client: client ? {
                id: client.id,
                name: client.name,
                email: client.email,
                phone: client.phone,
                address: client.address,
              } : null,
              timeTracking: {
                totalMinutes,
                totalHours,
                entriesCount: timeEntries.length,
              },
              photos: photos.map((p: any) => ({
                id: p.id,
                fileName: p.fileName,
                category: p.category,
                caption: p.caption,
              })),
              hasQuote: !!linkedQuote,
              hasInvoice: !!linkedInvoice,
              linkedQuote: linkedQuote ? {
                id: linkedQuote.id,
                quoteNumber: linkedQuote.number,
                title: linkedQuote.title,
                description: linkedQuote.description,
                lineItems: quoteLineItems.map((item: any) => ({
                  id: item.id,
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  total: item.total,
                })),
                subtotal: linkedQuote.subtotal,
                gstAmount: linkedQuote.gstAmount,
                total: linkedQuote.total,
                status: linkedQuote.status,
                notes: linkedQuote.notes,
                terms: linkedQuote.terms,
                depositPercent: linkedQuote.depositPercent,
              } : null,
              linkedInvoice: linkedInvoice ? {
                id: linkedInvoice.id,
                invoiceNumber: linkedInvoice.number,
                title: linkedInvoice.title,
                description: linkedInvoice.description,
                lineItems: linkedInvoice.lineItems,
                subtotal: linkedInvoice.subtotal,
                gstAmount: linkedInvoice.gstAmount,
                total: linkedInvoice.total,
                status: linkedInvoice.status,
                notes: linkedInvoice.notes,
                dueDate: linkedInvoice.dueDate,
              } : null,
            };
          })
      );
      
      res.json(enrichedJobs);
    } catch (error) {
      console.error("Error fetching contextual jobs:", error);
      res.status(500).json({ error: "Failed to fetch contextual jobs" });
    }
  });

  app.get("/api/jobs/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_JOBS), async (req: any, res) => {
    try {
      // Use effectiveUserId (business owner's ID) for multi-tenant data scoping
      const effectiveUserId = req.effectiveUserId || req.userId;
      const userContext = req.userContext;
      
      let job = await storage.getJob(req.params.id, effectiveUserId);
      // Cross-business subcontractor: the job belongs to a different business
      // than the requester's active workspace, so the scoped lookup misses it.
      // If they hold an active assignment to this job they're legitimately
      // working on it (e.g. assigned as a worker on another business's job),
      // so serve it via the unscoped lookup. Without this they get a spurious
      // "Job not found" even though they appear on the assigned team.
      let crossBusinessAssigned = false;
      if (!job) {
        const ja = await storage.getJobAssignmentForUser(req.params.id, req.userId);
        if (ja) {
          job = await storage.getJobPublic(req.params.id);
          crossBusinessAssigned = !!job;
        }
      }
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Staff tradies can only view their assigned jobs. Skip when we already
      // proved a cross-business assignment above.
      const hasViewAll = userContext?.permissions?.includes('view_all') || userContext?.isOwner;
      if (!crossBusinessAssigned && !hasViewAll && userContext?.teamMemberId) {
        // Assignment can be stored either as the team member id or the member's
        // underlying user id depending on how the job was assigned, so match both.
        const assignIds = [userContext.teamMemberId, req.userId].filter(Boolean);
        let isAssigned = assignIds.includes(job.assignedTo) ||
                          assignIds.includes((job as any).assignedTeamMemberId);
        if (!isAssigned) {
          // Multi-worker jobs: this worker may be assigned via job_assignments
          // even when they aren't the one stored in the legacy assignedTo column.
          const ja = await storage.getJobAssignmentForUser(job.id, req.userId);
          isAssigned = !!ja;
        }
        if (!isAssigned) {
          return res.status(403).json({ error: "You can only view your assigned jobs" });
        }
      }
      
      res.json(job);
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });

  app.get("/api/jobs/:id/suggest-assignee", requireAuth, async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const job = await storage.getJob(req.params.id, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const members = await storage.getTeamMembers(effectiveUserId);
      const activeMembers = members.filter((m: any) => m.isActive && m.inviteStatus === 'accepted' && m.memberId);

      const ownerUser = await storage.getUser(effectiveUserId);
      const allCandidates: Array<{ id: string; memberId: string; name: string; isOwner: boolean }> = [];

      if (ownerUser) {
        allCandidates.push({
          id: effectiveUserId,
          memberId: effectiveUserId,
          name: [ownerUser.firstName, ownerUser.lastName].filter(Boolean).join(' ') || ownerUser.email || 'Owner',
          isOwner: true,
        });
      }
      for (const m of activeMembers) {
        allCandidates.push({
          id: m.id,
          memberId: m.memberId!,
          name: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
          isOwner: false,
        });
      }

      const allJobs = await storage.getJobs(effectiveUserId);

      const jobDate = job.scheduledAt ? new Date(job.scheduledAt) : new Date();
      const dayStart = new Date(jobDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(jobDate);
      dayEnd.setHours(23, 59, 59, 999);

      const weekStart = new Date(dayStart);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const jobLat = job.latitude ? parseFloat(String(job.latitude)) : null;
      const jobLng = job.longitude ? parseFloat(String(job.longitude)) : null;

      const jobTitle = (job.title || '').toLowerCase();

      const suggestions = await Promise.all(allCandidates.map(async (candidate) => {
        let availabilityScore = 100;
        let skillScore = 50;
        let proximityScore = 50;
        let workloadScore = 100;

        const availabilityDetails: string[] = [];
        const skillDetails: string[] = [];
        const proximityDetails: string[] = [];
        const workloadDetails: string[] = [];

        const memberDayJobs = allJobs.filter((j: any) => {
          if (!j.scheduledAt) return false;
          const jDate = new Date(j.scheduledAt);
          const matchesDay = jDate >= dayStart && jDate <= dayEnd;
          const isAssigned = candidate.isOwner
            ? (!j.assignedTo || j.assignedTo === candidate.memberId)
            : (j.assignedTo === candidate.memberId || j.assignedTo === candidate.id);
          return matchesDay && isAssigned && j.id !== job.id;
        });

        if (memberDayJobs.length === 0) {
          availabilityScore = 100;
          availabilityDetails.push('No other jobs scheduled this day');
        } else {
          const jobStartHour = job.scheduledTime ? parseInt(job.scheduledTime.split(':')[0], 10) : 9;
          const jobDuration = job.estimatedDuration || 60;
          const jobEndMinute = jobStartHour * 60 + jobDuration;

          let hasConflict = false;
          for (const dj of memberDayJobs) {
            const djStart = dj.scheduledTime ? parseInt(dj.scheduledTime.split(':')[0], 10) * 60 : 540;
            const djEnd = djStart + (dj.estimatedDuration || 60);
            if (jobStartHour * 60 < djEnd && jobEndMinute > djStart) {
              hasConflict = true;
              break;
            }
          }

          if (hasConflict) {
            availabilityScore = 10;
            availabilityDetails.push(`Time conflict with ${memberDayJobs.length} job(s) on this day`);
          } else {
            availabilityScore = Math.max(40, 100 - memberDayJobs.length * 20);
            availabilityDetails.push(`${memberDayJobs.length} other job(s) this day, no time conflict`);
          }
        }

        if (!candidate.isOwner) {
          try {
            const skills = await db.select().from(teamMemberSkills)
              .where(eq(teamMemberSkills.teamMemberId, candidate.id));

            if (skills.length > 0) {
              const skillNames = skills.map((s: any) => s.skillName.toLowerCase());
              const match = skillNames.some((sn: string) =>
                jobTitle.includes(sn) || sn.includes(jobTitle.split(' ')[0])
              );
              if (match) {
                skillScore = 100;
                skillDetails.push('Skills match job type');
              } else {
                skillScore = 40;
                skillDetails.push('Has skills but no direct match');
              }
            } else {
              skillScore = 50;
              skillDetails.push('No skills on record');
            }
          } catch {
            skillScore = 50;
            skillDetails.push('Could not check skills');
          }
        } else {
          skillScore = 70;
          skillDetails.push('Business owner');
        }

        try {
          const lastLoc = await storage.getLatestLocationForUser(candidate.memberId);
          if (lastLoc && jobLat && jobLng) {
            const memLat = parseFloat(String(lastLoc.latitude));
            const memLng = parseFloat(String(lastLoc.longitude));
            const distKm = haversineDistance(memLat, memLng, jobLat, jobLng);
            if (distKm < 5) {
              proximityScore = 100;
              proximityDetails.push(`${distKm.toFixed(1)} km away`);
            } else if (distKm < 15) {
              proximityScore = 80;
              proximityDetails.push(`${distKm.toFixed(1)} km away`);
            } else if (distKm < 30) {
              proximityScore = 60;
              proximityDetails.push(`${distKm.toFixed(1)} km away`);
            } else if (distKm < 60) {
              proximityScore = 40;
              proximityDetails.push(`${distKm.toFixed(1)} km away`);
            } else {
              proximityScore = 20;
              proximityDetails.push(`${distKm.toFixed(1)} km away`);
            }
          } else {
            proximityScore = 50;
            proximityDetails.push('Location unknown');
          }
        } catch {
          proximityScore = 50;
          proximityDetails.push('Location unavailable');
        }

        const weekJobs = allJobs.filter((j: any) => {
          if (!j.scheduledAt) return false;
          const jDate = new Date(j.scheduledAt);
          const isInWeek = jDate >= weekStart && jDate <= weekEnd;
          const isAssigned = candidate.isOwner
            ? (!j.assignedTo || j.assignedTo === candidate.memberId)
            : (j.assignedTo === candidate.memberId || j.assignedTo === candidate.id);
          return isInWeek && isAssigned && j.id !== job.id;
        });

        const weekJobCount = weekJobs.length;
        workloadScore = Math.max(10, 100 - weekJobCount * 12);
        if (weekJobCount === 0) {
          workloadDetails.push('No other jobs this week');
        } else {
          workloadDetails.push(`${weekJobCount} job(s) this week`);
        }

        const totalScore = Math.round(
          availabilityScore * 0.35 +
          skillScore * 0.25 +
          proximityScore * 0.20 +
          workloadScore * 0.20
        );

        return {
          teamMemberId: candidate.id,
          memberId: candidate.memberId,
          name: candidate.name,
          isOwner: candidate.isOwner,
          totalScore,
          scores: {
            availability: { score: availabilityScore, weight: 35, details: availabilityDetails },
            skills: { score: skillScore, weight: 25, details: skillDetails },
            proximity: { score: proximityScore, weight: 20, details: proximityDetails },
            workload: { score: workloadScore, weight: 20, details: workloadDetails },
          },
        };
      }));

      suggestions.sort((a, b) => b.totalScore - a.totalScore);

      res.json({
        jobId: job.id,
        jobTitle: job.title,
        scheduledAt: job.scheduledAt,
        suggestions,
      });
    } catch (error) {
      console.error("Error suggesting assignees:", error);
      res.status(500).json({ error: "Failed to suggest assignees" });
    }
  });

  app.get("/api/jobs/:id/linked-documents", requireAuth, async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const jobId = req.params.id;
      
      // Determine if user is a worker to control pricing visibility
      const workerContext = await getWorkerPermissionContext(req.userId);
      const isWorker = workerContext.isWorker;
      
      // Verify job exists and user has access
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Fetch all quotes, invoices, and receipts, then filter for this job
      const [quotes, invoices, receiptsForJob] = await Promise.all([
        storage.getQuotes(effectiveUserId),
        storage.getInvoices(effectiveUserId),
        storage.getReceiptsForJob(jobId, effectiveUserId)
      ]);
      
      // Find linked quote - check both directions:
      // 1. Quotes that have jobId pointing to this job (quote created for job)
      // 2. Quotes that match the job's quoteId (job created from quote)
      let linkedQuotes = quotes.filter((q: any) => q.jobId === jobId);
      
      // Also check if job has a quoteId - always include the originating quote
      // This handles "job created from quote" case and ensures both associations are captured
      if ((job as any).quoteId) {
        const quoteFromJob = quotes.find((q: any) => q.id === (job as any).quoteId);
        if (quoteFromJob && !linkedQuotes.some((q: any) => q.id === quoteFromJob.id)) {
          // Insert originating quote at the beginning (it's the primary one)
          linkedQuotes.unshift(quoteFromJob);
        }
      }
      
      const linkedQuote = linkedQuotes.length > 0 ? linkedQuotes[linkedQuotes.length - 1] : null;
      
      // Find linked invoice - check both directions:
      // 1. Invoices that have jobId pointing to this job (invoice created for job)
      // 2. Invoices that match the job's invoiceId (job created from invoice, rare)
      let linkedInvoices = invoices.filter((i: any) => i.jobId === jobId);
      
      // Also check if job has an invoiceId - always include the originating invoice
      if ((job as any).invoiceId) {
        const invoiceFromJob = invoices.find((i: any) => i.id === (job as any).invoiceId);
        if (invoiceFromJob && !linkedInvoices.some((i: any) => i.id === invoiceFromJob.id)) {
          linkedInvoices.unshift(invoiceFromJob);
        }
      }
      
      const linkedInvoice = linkedInvoices.length > 0 ? linkedInvoices[linkedInvoices.length - 1] : null;
      
      res.json({
        linkedQuote: linkedQuote ? await (async () => {
          const lineItems = await storage.getQuoteLineItems(linkedQuote.id);
          const sortedLineItems = lineItems.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
          return {
            id: linkedQuote.id,
            number: linkedQuote.number,
            quoteNumber: linkedQuote.number,
            title: linkedQuote.title,
            status: linkedQuote.status,
            ...(isWorker ? {} : { total: linkedQuote.total }),
            description: linkedQuote.description,
            createdAt: linkedQuote.createdAt,
            lineItems: sortedLineItems.map((item: any) => ({
              id: item.id,
              description: item.description,
              quantity: item.quantity,
              ...(isWorker ? {} : { unitPrice: item.unitPrice, total: item.total }),
              sortOrder: item.sortOrder,
            })),
          };
        })() : null,
        linkedInvoice: linkedInvoice ? {
          id: linkedInvoice.id,
          number: linkedInvoice.number,
          invoiceNumber: linkedInvoice.number, // Alias for backward compatibility
          title: linkedInvoice.title,
          status: linkedInvoice.status,
          total: linkedInvoice.total,
          dueDate: linkedInvoice.dueDate,
          paidAt: linkedInvoice.paidAt,
          createdAt: linkedInvoice.createdAt,
        } : null,
        // Include receipts array (all receipts for this job)
        linkedReceipts: receiptsForJob.map((r: any) => ({
          id: r.id,
          receiptNumber: r.receiptNumber,
          amount: r.amount,
          gstAmount: r.gstAmount,
          paymentMethod: r.paymentMethod,
          paidAt: r.paidAt,
          pdfUrl: r.pdfUrl,
          createdAt: r.createdAt,
        })),
        // Include counts for UI
        quoteCount: linkedQuotes.length,
        invoiceCount: linkedInvoices.length,
        receiptCount: receiptsForJob.length,
      });
    } catch (error) {
      console.error("Error fetching linked documents:", error);
      res.status(500).json({ error: "Failed to fetch linked documents" });
    }
  });

  app.get("/api/jobs/:id/activity", requireAuth, async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const jobId = req.params.id;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      
      // Verify job exists and user has access
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Get all activity logs for this user, then filter for job-related ones
      const allActivityLogs = await storage.getActivityLogs(effectiveUserId, 100);
      
      // Filter for activities related to this job
      const jobActivities = allActivityLogs.filter((log: any) => {
        if (log.entityType === 'job' && log.entityId === jobId) {
          return true;
        }
        if (log.metadata && (log.metadata as any).jobId === jobId) {
          return true;
        }
        return false;
      }).slice(0, limit);
      
      // Map to activity items with proper structure
      const activities = jobActivities.map((log: any) => ({
        id: log.id,
        type: log.type,
        title: log.title,
        description: log.description || '',
        timestamp: log.createdAt,
        status: log.metadata?.status || 'success',
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: log.metadata,
      }));
      
      // If no activity logs exist, generate synthetic timeline from job timestamps
      if (activities.length === 0 && job) {
        const synthetic: any[] = [];
        if (job.createdAt) {
          synthetic.push({
            id: `synthetic-created-${jobId}`,
            type: 'job_created',
            title: `Job created: ${job.title}`,
            description: job.clientId ? 'New job added' : 'New job added',
            timestamp: job.createdAt,
            status: 'success',
            entityType: 'job',
            entityId: jobId,
            metadata: { synthetic: true },
          });
        }
        if (job.scheduledAt) {
          synthetic.push({
            id: `synthetic-scheduled-${jobId}`,
            type: 'job_scheduled',
            title: `Job scheduled`,
            description: `Scheduled for ${new Date(job.scheduledAt).toLocaleDateString('en-AU')}`,
            timestamp: job.scheduledAt,
            status: 'success',
            entityType: 'job',
            entityId: jobId,
            metadata: { synthetic: true, newStatus: 'scheduled' },
          });
        }
        if (job.startedAt) {
          synthetic.push({
            id: `synthetic-started-${jobId}`,
            type: 'job_started',
            title: `Job started`,
            description: 'Work began on this job',
            timestamp: job.startedAt,
            status: 'success',
            entityType: 'job',
            entityId: jobId,
            metadata: { synthetic: true, newStatus: 'in_progress' },
          });
        }
        if (job.completedAt) {
          synthetic.push({
            id: `synthetic-completed-${jobId}`,
            type: 'job_completed',
            title: `Job completed`,
            description: 'All work finished',
            timestamp: job.completedAt,
            status: 'success',
            entityType: 'job',
            entityId: jobId,
            metadata: { synthetic: true, newStatus: 'done' },
          });
        }
        synthetic.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return res.json(synthetic.slice(0, limit));
      }
      
      res.json(activities);
    } catch (error) {
      console.error("Error fetching job activity:", error);
      res.status(500).json({ error: "Failed to fetch job activity" });
    }
  });

  app.get("/api/jobs/:id/safety-status", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const jobId = req.params.id;
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      const swmsDocs = await db.select().from(swmsDocuments).where(and(eq(swmsDocuments.jobId, jobId), eq(swmsDocuments.userId, userContext.effectiveUserId)));
      const draftSwms = swmsDocs.filter(s => s.status === 'draft').length;
      let unsignedSwms = 0;
      for (const doc of swmsDocs) {
        if (doc.status === 'draft') continue;
        const sigResult = await db.select({ count: sql<number>`count(*)` }).from(swmsSignatures).where(eq(swmsSignatures.swmsId, doc.id));
        if ((sigResult[0]?.count ?? 0) === 0) unsignedSwms++;
      }
      res.json({ draftSwms, unsignedSwms, pendingForms: 0, totalSwms: swmsDocs.length });
    } catch (error: any) {
      res.json({ draftSwms: 0, unsignedSwms: 0, pendingForms: 0, totalSwms: 0 });
    }
  });

  app.get("/api/jobs/:id/site-attendance", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const jobId = req.params.id;
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) return res.status(404).json({ error: "Job not found" });

      const alerts = await db.select().from(geofence_alerts).where(eq(geofence_alerts.jobId, jobId));
      const sorted = alerts.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      const arrivals = sorted.filter((a: any) => a.alertType === 'geofence_enter' || a.alertType === 'arrival');
      const departures = sorted.filter((a: any) => a.alertType === 'geofence_exit' || a.alertType === 'departure');

      res.json({
        events: sorted.map((a: any) => ({
          id: a.id,
          type: a.alertType === 'geofence_enter' || a.alertType === 'arrival' ? 'arrival' : 'departure',
          timestamp: a.createdAt,
          latitude: a.latitude,
          longitude: a.longitude,
        })),
        arrivalCount: arrivals.length,
        departureCount: departures.length,
        firstArrival: arrivals[0]?.createdAt || null,
        lastDeparture: departures[departures.length - 1]?.createdAt || null,
      });
    } catch (error: any) {
      console.error("Error fetching site attendance:", error);
      res.status(500).json({ error: "Failed to fetch site attendance" });
    }
  });

  app.post("/api/jobs", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      const { clientGeneratedId, ...reqBody } = req.body;
      const effectiveUserId = req.effectiveUserId || req.userId;
      const idempKey = clientGeneratedId ? `job:${effectiveUserId}:${clientGeneratedId}` : null;
      if (idempKey) {
        const cached = await getIdempotencyRecord(idempKey);
        if (cached) return res.status(201).json(cached);
      }
      
      // Check freemium limits first
      const limitCheck = await FreemiumService.canUserCreateJob(effectiveUserId);
      if (!limitCheck.canCreate) {
        return res.status(402).json({ 
          error: limitCheck.reason,
          type: 'SUBSCRIPTION_LIMIT',
          usageInfo: limitCheck.usageInfo
        });
      }

      // Preprocess date fields from ISO strings to Date objects (mobile sends strings)
      const body = { ...reqBody };
      if (body.scheduledAt && typeof body.scheduledAt === 'string') {
        body.scheduledAt = new Date(body.scheduledAt);
      }
      if (body.completedAt && typeof body.completedAt === 'string') {
        body.completedAt = new Date(body.completedAt);
      }
      if (body.startedAt && typeof body.startedAt === 'string') {
        body.startedAt = new Date(body.startedAt);
      }
      if (body.nextRecurrenceDate && typeof body.nextRecurrenceDate === 'string') {
        body.nextRecurrenceDate = new Date(body.nextRecurrenceDate);
      }
      if (body.recurrenceEndDate && typeof body.recurrenceEndDate === 'string') {
        body.recurrenceEndDate = new Date(body.recurrenceEndDate);
      }

      const data = insertJobSchema.parse(body);

      // Validate job_type to the two allowed values
      if (data.jobType !== undefined && data.jobType !== null && !['service', 'project'].includes(data.jobType)) {
        return res.status(400).json({ error: "jobType must be 'service' or 'project'" });
      }

      // Verify referenced client belongs to this business (cross-business write guard)
      if (data.clientId) {
        const client = await storage.getClient(data.clientId, effectiveUserId);
        if (!client) return res.status(404).json({ error: "Client not found" });
      }
      
      // Validate job assignment RBAC if assignedTo is provided
      if (data.assignedTo) {
        const userContext = req.userContext || await getUserContext(req.userId);
        const assignmentCheck = await canAssignJobTo(userContext, data.assignedTo);
        if (!assignmentCheck.allowed) {
          return res.status(403).json({ 
            error: assignmentCheck.reason || "You don't have permission to assign this job to that team member",
            code: "ASSIGNMENT_NOT_ALLOWED"
          });
        }
      }
      
      // Per-worker double-booking guard: block when this worker already has an
      // overlapping scheduled job. Different workers at the same time is fine.
      if (data.assignedTo && data.scheduledAt) {
        const conflict = await findWorkerBookingConflict({
          effectiveUserId,
          assignedTo: data.assignedTo,
          scheduledAt: new Date(data.scheduledAt as any),
          estimatedDuration: data.estimatedDuration ?? null,
        });
        if (conflict) {
          return res.status(409).json({
            error: "This worker is already booked for an overlapping time. Pick a different time or worker.",
            code: "BOOKING_CONFLICT",
            conflictingJobId: conflict.id,
            conflictingJobTitle: conflict.title,
            conflictingScheduledAt: conflict.scheduledAt,
          });
        }
      }

      // Auto-geocode address if provided but lat/lng missing
      let jobData = { ...data, userId: effectiveUserId };
      if (data.address && (!data.latitude || !data.longitude)) {
        const geocoded = await geocodeAddress(data.address);
        if (geocoded) {
          jobData.latitude = geocoded.latitude.toString();
          jobData.longitude = geocoded.longitude.toString();
          console.log(`[Geocoding] Job address "${data.address}" -> ${geocoded.latitude}, ${geocoded.longitude}`);
        }
      }
      
      const job = await storage.createJob(jobData);
      // Note: job number is auto-generated inside storage.createJob when a prefix is configured.
      
      // If job was created from a quote, update the quote's jobId to link back
      // and copy quote line items as job materials
      // Use req.body.quoteId since insertJobSchema strips non-schema fields
      const quoteIdFromRequest = req.body.quoteId;
      if (quoteIdFromRequest) {
        try {
          await storage.updateQuote(quoteIdFromRequest, effectiveUserId, { jobId: job.id });
          console.log(`[Job Creation] Linked quote ${quoteIdFromRequest} to new job ${job.id}`);
          
          // Copy quote line items as job materials (only from accepted quotes the user owns)
          const quoteWithItems = await storage.getQuoteWithLineItems(quoteIdFromRequest, effectiveUserId);
          if (quoteWithItems && quoteWithItems.status === 'accepted' && quoteWithItems.lineItems?.length) {
            let materialsCreated = 0;
            for (const item of quoteWithItems.lineItems) {
              try {
                const quantity = parseFloat(item.quantity?.toString() || '1');
                const unitCost = parseFloat(item.cost?.toString() || '0');
                const unitPrice = parseFloat(item.unitPrice?.toString() || '0');
                await storage.createJobMaterial({
                  jobId: job.id,
                  userId: effectiveUserId,
                  name: item.description,
                  quantity: quantity.toString(),
                  unit: 'each',
                  unitCost: unitCost.toString(),
                  unitPrice: unitPrice.toString(),
                  totalCost: (quantity * unitCost).toFixed(2),
                  totalPrice: (quantity * unitPrice).toFixed(2),
                  status: 'needed',
                });
                materialsCreated++;
              } catch (matError) {
                console.error(`[Job Creation] Failed to create material from quote item:`, matError);
              }
            }
            console.log(`[Job Creation] Created ${materialsCreated} materials from ${quoteWithItems.lineItems.length} quote line items`);
          }
        } catch (linkError) {
          console.error(`[Job Creation] Failed to link quote to job:`, linkError);
          // Don't fail job creation if quote linking fails
        }
      }
      
      // Increment job count after successful creation
      await FreemiumService.incrementJobCount(effectiveUserId);
      
      // Log activity for dashboard feed
      const client = job.clientId ? await storage.getClient(job.clientId, effectiveUserId) : null;
      await logActivity(
        effectiveUserId,
        'job_created',
        `New job created: ${job.title}`,
        client ? `Client: ${client.name}` : null,
        'job',
        job.id,
        { jobTitle: job.title, clientName: client?.name, status: job.status }
      );
      
      // Auto-sync to Google Calendar if user is connected and job is scheduled
      if (job.scheduledAt) {
        try {
          const { syncJobToCalendar, isGoogleCalendarConnected } = await import('../googleCalendarClient');
          const connected = await isGoogleCalendarConnected(effectiveUserId);
          if (connected) {
            const result = await syncJobToCalendar(effectiveUserId, {
              id: job.id,
              title: job.title,
              description: job.description,
              notes: job.notes,
              address: job.address,
              scheduledAt: new Date(job.scheduledAt),
              estimatedDuration: job.estimatedDuration ? job.estimatedDuration / 60 : 2,
              clientName: client?.name,
              clientPhone: client?.phone || undefined,
              clientEmail: client?.email || undefined,
              status: job.status,
              calendarEventId: null
            });
            // Update job with calendar event ID
            await storage.updateJob(job.id, effectiveUserId, { calendarEventId: result.eventId });
            console.log(`[GoogleCalendar] Auto-synced new job ${job.id} to calendar for user ${effectiveUserId}`);
          }
        } catch (calendarError) {
          console.error('[GoogleCalendar] Auto-sync failed for new job:', calendarError);
          // Don't fail job creation if calendar sync fails
        }
      }
      
      if (idempKey) {
        await setIdempotencyRecord(idempKey, job);
      }
      res.status(201).json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error creating job:", error);
      res.status(500).json({ error: "Failed to create job" });
    }
  });

  app.patch("/api/jobs/bulk-status", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      const schema = z.object({
        ids: z.array(z.string().uuid()).min(1).max(100),
        status: z.enum(['pending', 'scheduled', 'in_progress', 'done', 'invoiced']),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.errors });
      }
      const { ids, status } = parsed.data;
      const userContext = await getUserContext(req.userId);
      const effectiveUserId = userContext.effectiveUserId;
      const results = { updated: 0, failed: 0, errors: [] as string[] };
      // Load business settings once for the WHS start gate (only relevant when starting jobs)
      const bulkBusinessSettings = status === 'in_progress'
        ? await storage.getBusinessSettings(effectiveUserId)
        : null;
      // Job completion is restricted to owner/manager/lead worker. Resolve the
      // caller's owner/manager status once; lead-worker is checked per job.
      let bulkIsOwner = false;
      let bulkIsManager = false;
      if (status === 'done') {
        const cbs = await storage.getBusinessSettings(effectiveUserId);
        bulkIsOwner = !!cbs && cbs.userId === req.userId;
        if (!bulkIsOwner) {
          const tm = await storage.getTeamMemberByUserIdAndBusiness(req.userId, effectiveUserId);
          if (tm && tm.roleId) {
            const role = await storage.getUserRole(tm.roleId);
            bulkIsManager = role?.name?.toLowerCase().includes('manager') ||
                            role?.name?.toLowerCase().includes('admin') || false;
          }
        }
      }
      for (const id of ids) {
        try {
          const existingJob = await storage.getJob(id, effectiveUserId);
          if (!existingJob) {
            results.failed++;
            results.errors.push(`Job ${id} not found`);
            continue;
          }
          // WHS gating: enforce pre-start safety + licence compliance when starting a job
          const startGate = await checkJobStartGate({
            job: existingJob,
            newStatus: status,
            businessSettings: bulkBusinessSettings,
            effectiveUserId,
            fallbackUserId: req.userId,
          });
          if (startGate) {
            results.failed++;
            results.errors.push(`Job ${id}: ${startGate.body.error}`);
            continue;
          }
          if (status === 'done' && !bulkIsOwner && !bulkIsManager && !(await isPrimaryAssignee(existingJob, req.userId))) {
            results.failed++;
            results.errors.push(`Job ${id}: Only the lead worker or owner can complete this job`);
            continue;
          }
          if (status === 'done') {
            const completionErrors = await getJobCompletionErrors(id, effectiveUserId);
            if (completionErrors.length > 0) {
              results.failed++;
              results.errors.push(`Job ${id}: ${completionErrors.join('; ')}`);
              continue;
            }
          }
          const now = new Date();
          const updateData: any = { status };
          if (status !== existingJob.status) {
            if (status === 'in_progress' && !existingJob.startedAt) {
              updateData.startedAt = now;
            } else if (status === 'done' && !existingJob.completedAt) {
              updateData.completedAt = await resolveJobCompletionTime(existingJob.id, now);
            } else if (status === 'invoiced' && !existingJob.invoicedAt) {
              updateData.invoicedAt = now;
            }
            if (status === 'pending' || status === 'scheduled') {
              updateData.startedAt = null;
              updateData.completedAt = null;
              updateData.invoicedAt = null;
            } else if (status === 'in_progress') {
              updateData.completedAt = null;
              updateData.invoicedAt = null;
            } else if (status === 'done') {
              updateData.invoicedAt = null;
            }
          }
          const updated = await storage.updateJob(id, effectiveUserId, updateData);
          if (updated) {
            results.updated++;
          } else {
            results.failed++;
            results.errors.push(`Failed to update job ${id}`);
          }
        } catch (err) {
          results.failed++;
          results.errors.push(`Error updating job ${id}`);
        }
      }
      res.json(results);
    } catch (error) {
      console.error("Error in bulk status update jobs:", error);
      res.status(500).json({ error: "Failed to bulk update job statuses" });
    }
  });

  app.patch("/api/jobs/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      // Use effectiveUserId (business owner's ID) for multi-tenant data scoping
      const effectiveUserId = req.effectiveUserId || req.userId;
      
      // Debug logging for job update - track assignedTo persistence
      console.log('[PATCH /api/jobs/:id] Request body received:', JSON.stringify(req.body, null, 2));
      console.log('[PATCH /api/jobs/:id] Job ID:', req.params.id);
      console.log('[PATCH /api/jobs/:id] assignedTo value in request:', req.body.assignedTo);
      
      // Preprocess date fields from ISO strings to Date objects (mobile sends strings)
      const body = { ...req.body };
      if (body.scheduledAt && typeof body.scheduledAt === 'string') {
        body.scheduledAt = new Date(body.scheduledAt);
      }
      if (body.completedAt && typeof body.completedAt === 'string') {
        body.completedAt = new Date(body.completedAt);
      }
      if (body.startedAt && typeof body.startedAt === 'string') {
        body.startedAt = new Date(body.startedAt);
      }
      if (body.inspectionCompletedAt && typeof body.inspectionCompletedAt === 'string') {
        body.inspectionCompletedAt = new Date(body.inspectionCompletedAt);
      }
      
      const submittedVersion = body.version;
      delete body.version;
      
      const data = insertJobSchema.partial().parse(body);
      
      if (data.scheduledAt && !data.scheduledTime) {
        const d = new Date(data.scheduledAt as any);
        if (!isNaN(d.getTime())) {
          const h = d.getHours().toString().padStart(2, '0');
          const m = d.getMinutes().toString().padStart(2, '0');
          data.scheduledTime = `${h}:${m}`;
        }
      }
      
      // Validate jobType enum on updates (same constraint enforced on create)
      if (data.jobType !== undefined && data.jobType !== null && !['service', 'project'].includes(data.jobType)) {
        return res.status(400).json({ error: "jobType must be 'service' or 'project'" });
      }

      console.log('[PATCH /api/jobs/:id] Parsed data after validation:', JSON.stringify(data, null, 2));
      
      const existingJob = await storage.getJob(req.params.id, effectiveUserId);

      // WHS gating: enforce pre-start safety + licence compliance when starting a job
      if (data.status === 'in_progress' && existingJob && existingJob.status !== 'in_progress') {
        const businessSettings = await storage.getBusinessSettings(effectiveUserId);
        const startGate = await checkJobStartGate({
          job: existingJob,
          newStatus: data.status,
          businessSettings,
          effectiveUserId,
          fallbackUserId: req.userId,
        });
        if (startGate) {
          return res.status(startGate.status).json(startGate.body);
        }
      }
      
      const editableFields = ['title', 'description', 'address', 'scheduledAt', 'estimatedHours', 'priority', 'geofenceEnabled', 'geofenceRadius'];
      const hasEditableFieldChanges = Object.keys(data).some(k => editableFields.includes(k));
      
      
      // Validate: Can't set status to "invoiced" without a linked invoice
      if (data.status === 'invoiced' && existingJob?.status !== 'invoiced') {
        const invoices = await storage.getInvoices(effectiveUserId);
        const linkedInvoice = invoices.find((inv: any) => inv.jobId === req.params.id);
        if (!linkedInvoice) {
          return res.status(400).json({ 
            error: "Cannot mark job as invoiced without creating an invoice first. Please create an invoice for this job.",
            code: "INVOICE_REQUIRED"
          });
        }
      }
      
      if (data.status === 'done' || data.status === 'completed') {
        // Only the lead worker (primary assignee) or an owner/manager may
        // complete the whole job. Other assigned workers clock off instead.
        if (existingJob) {
          const completeBusinessSettings = await storage.getBusinessSettings(effectiveUserId);
          const isCompleteOwner = !!completeBusinessSettings && completeBusinessSettings.userId === req.userId;
          let isCompleteManager = false;
          if (!isCompleteOwner) {
            const teamMemberInfo = await storage.getTeamMemberByUserIdAndBusiness(req.userId, effectiveUserId);
            if (teamMemberInfo && teamMemberInfo.roleId) {
              const role = await storage.getUserRole(teamMemberInfo.roleId);
              isCompleteManager = role?.name?.toLowerCase().includes('manager') ||
                                  role?.name?.toLowerCase().includes('admin') || false;
            }
          }
          if (!isCompleteOwner && !isCompleteManager && !(await isPrimaryAssignee(existingJob, req.userId))) {
            return res.status(403).json({
              error: "Only the lead worker or owner can complete this job. Use Clock Off to finish your own work.",
              code: "NOT_LEAD_WORKER"
            });
          }
        }

        const validationErrors = await getJobCompletionErrors(req.params.id, effectiveUserId);
        if (validationErrors.length > 0) {
          return res.status(400).json({
            error: 'Time entries need attention before completing this job',
            validationErrors
          });
        }
      }
      
      // Validate job assignment RBAC: Manager can only assign to workers, not to other managers or owner
      if (data.assignedTo && data.assignedTo !== existingJob?.assignedTo) {
        const userContext = req.userContext || await getUserContext(req.userId);
        const assignmentCheck = await canAssignJobTo(userContext, data.assignedTo);
        if (!assignmentCheck.allowed) {
          return res.status(403).json({ 
            error: assignmentCheck.reason || "You don't have permission to assign this job to that team member",
            code: "ASSIGNMENT_NOT_ALLOWED"
          });
        }
      }

      // Per-worker double-booking guard on reschedule/reassign. Only runs when
      // the worker or the time is actually changing; uses the merged final
      // worker + time and excludes this same job from the comparison.
      if (data.assignedTo !== undefined || data.scheduledAt !== undefined) {
        const finalAssignedTo = data.assignedTo !== undefined ? data.assignedTo : existingJob?.assignedTo;
        const finalScheduledAt = data.scheduledAt !== undefined ? data.scheduledAt : existingJob?.scheduledAt;
        const finalDuration = data.estimatedDuration !== undefined ? data.estimatedDuration : existingJob?.estimatedDuration;
        if (finalAssignedTo && finalScheduledAt) {
          const conflict = await findWorkerBookingConflict({
            effectiveUserId,
            assignedTo: finalAssignedTo,
            scheduledAt: new Date(finalScheduledAt as any),
            estimatedDuration: finalDuration ?? null,
            excludeJobId: req.params.id,
          });
          if (conflict) {
            return res.status(409).json({
              error: "This worker is already booked for an overlapping time. Pick a different time or worker.",
              code: "BOOKING_CONFLICT",
              conflictingJobId: conflict.id,
              conflictingJobTitle: conflict.title,
              conflictingScheduledAt: conflict.scheduledAt,
            });
          }
        }
      }
      
      if (data.notes !== undefined) {
        delete data.notes;
      }
      
      // Auto-geocode if address changed (always re-geocode when address changes)
      let updateData = { ...data };
      if (data.address && data.address !== existingJob?.address) {
        const geocoded = await geocodeAddress(data.address);
        if (geocoded) {
          updateData.latitude = geocoded.latitude.toString();
          updateData.longitude = geocoded.longitude.toString();
          console.log(`[Geocoding] Updated job address "${data.address}" -> ${geocoded.latitude}, ${geocoded.longitude}`);
        }
      }
      
      // Auto-set stage timestamps when status changes
      if (data.status && existingJob && data.status !== existingJob.status) {
        const now = new Date();
        if (data.status === 'in_progress' && !existingJob.startedAt) {
          updateData.startedAt = now;
        } else if (data.status === 'done' && !existingJob.completedAt) {
          updateData.completedAt = await resolveJobCompletionTime(existingJob.id, now);
        } else if (data.status === 'invoiced' && !existingJob.invoicedAt) {
          updateData.invoicedAt = now;
        }
        // Clear timestamps if going back to earlier status (allow rollback)
        if (data.status === 'pending') {
          updateData.startedAt = null;
          updateData.completedAt = null;
          updateData.invoicedAt = null;
        } else if (data.status === 'scheduled') {
          updateData.startedAt = null;
          updateData.completedAt = null;
          updateData.invoicedAt = null;
        } else if (data.status === 'in_progress') {
          updateData.completedAt = null;
          updateData.invoicedAt = null;
        } else if (data.status === 'done') {
          updateData.invoicedAt = null;
        }

        // Sync workerStatus with main job status so the client portal stays up to date
        if (data.status === 'in_progress' && (!existingJob.workerStatus || ['assigned', 'on_my_way', 'arrived'].includes(existingJob.workerStatus))) {
          updateData.workerStatus = 'in_progress';
          updateData.workerStatusUpdatedAt = now;
        } else if ((data.status === 'done' || data.status === 'invoiced' || data.status === 'paid') && existingJob.workerStatus !== 'completed') {
          updateData.workerStatus = 'completed';
          updateData.workerStatusUpdatedAt = now;
        } else if (data.status === 'scheduled' && existingJob.workerStatus && existingJob.workerStatus !== 'assigned') {
          updateData.workerStatus = 'assigned';
          updateData.workerStatusUpdatedAt = now;
        } else if (data.status === 'pending') {
          updateData.workerStatus = null;
          updateData.workerStatusUpdatedAt = null;
        }
      }
      
      updateData.version = (existingJob?.version || 1) + 1;
      
      console.log('[PATCH /api/jobs/:id] updateData being saved:', JSON.stringify(updateData, null, 2));
      console.log('[PATCH /api/jobs/:id] assignedTo in updateData:', updateData.assignedTo);
      
      let job: Awaited<ReturnType<typeof storage.updateJob>>;
      if (submittedVersion !== undefined && hasEditableFieldChanges) {
        const result = await db
          .update(jobs)
          .set({ ...updateData, updatedAt: new Date() })
          .where(and(
            eq(jobs.id, req.params.id),
            eq(jobs.userId, effectiveUserId),
            eq(jobs.version, Number(submittedVersion)),
          ))
          .returning();
        if (result.length === 0) {
          const freshJob = await storage.getJob(req.params.id, effectiveUserId);
          if (!freshJob) {
            return res.status(404).json({ error: "Job not found" });
          }
          return res.status(409).json({
            error: "This job has been modified by another user since you started editing. Please review the changes.",
            code: "VERSION_CONFLICT",
            serverVersion: freshJob.version,
            serverData: freshJob,
          });
        }
        job = result[0];
      } else {
        job = await storage.updateJob(req.params.id, effectiveUserId, updateData);
      }
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      const dataRecord = data as Record<string, unknown>;
      const existingRecord = existingJob as Record<string, unknown> | null;
      const changedFields = Object.keys(data).filter(k => {
        if (k === 'version' || k === 'updatedAt') return false;
        return existingRecord && JSON.stringify(dataRecord[k]) !== JSON.stringify(existingRecord[k]);
      });
      if (changedFields.length > 0) {
        try {
          const user = await storage.getUser(req.userId);
          const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown' : 'Unknown';
          const { broadcastJobFieldUpdate } = await import('../websocket');
          broadcastJobFieldUpdate(effectiveUserId, {
            jobId: req.params.id,
            updatedFields: changedFields,
            updatedBy: req.userId,
            updatedByName: userName,
            version: job.version || 1,
            serverData: job as unknown as Record<string, unknown>,
          });
        } catch (e) {
          console.error('[PATCH /api/jobs/:id] Failed to broadcast field update:', e);
        }
      }


      // Create notifications and log activity for status changes
      if (data.status && existingJob && data.status !== existingJob.status) {
        const client = job.clientId ? await storage.getClient(job.clientId, effectiveUserId) : null;
        const clientName = client?.name || 'Unknown client';

        if (data.status === 'scheduled') {
          await notifyJobScheduled(storage, effectiveUserId, job, clientName);
          await logActivity(effectiveUserId, 'job_scheduled', `Job scheduled: ${job.title}`, `Client: ${clientName}`, 'job', job.id, { jobTitle: job.title, clientName, oldStatus: existingJob.status, newStatus: data.status });
        } else if (data.status === 'in_progress') {
          await notifyJobStarted(storage, effectiveUserId, job, clientName);
          await logActivity(effectiveUserId, 'job_started', `Job started: ${job.title}`, `Client: ${clientName}`, 'job', job.id, { jobTitle: job.title, clientName, oldStatus: existingJob.status, newStatus: data.status });
        } else if (data.status === 'done') {
          await notifyJobCompleted(storage, effectiveUserId, job, { firstName: 'You', username: 'You' });
          await logActivity(effectiveUserId, 'job_completed', `Job completed: ${job.title}`, `Client: ${clientName}`, 'job', job.id, { jobTitle: job.title, clientName, oldStatus: existingJob.status, newStatus: data.status });
        } else {
          // Create notification for all other status changes (quoted, booked, invoiced, on_hold, cancelled etc.)
          try {
            const statusLabel = (data.status || '').replace(/_/g, ' ');
            await storage.createNotification({
              userId: effectiveUserId,
              type: 'job_status_changed',
              title: `Job Phase Changed`,
              message: `"${job.title}" moved to ${statusLabel}`,
              priority: 'normal',
              actionUrl: `/jobs/${job.id}`,
              actionLabel: 'View Job',
              relatedId: job.id,
              relatedType: 'job',
            });
          } catch (e) { console.error('Failed to create job status notification:', e); }
          await logActivity(effectiveUserId, 'job_status_changed', `Job status updated: ${job.title}`, `${existingJob.status} → ${data.status}`, 'job', job.id, { jobTitle: job.title, clientName, oldStatus: existingJob.status, newStatus: data.status });
        }
      }

      // Notify assigned worker(s) when a job is cancelled, so nobody turns up to
      // a job that's been called off. Push + SMS, fire-and-forget.
      if (data.status === 'cancelled' && existingJob && existingJob.status !== 'cancelled') {
        (async () => {
          try {
            const recipientIds = new Set<string>();
            const primary = job.assignedTo ? await resolveAssigneeUserId(job.assignedTo, effectiveUserId) : null;
            if (primary) recipientIds.add(primary);
            const assignments = await storage.getJobAssignments(job.id);
            for (const a of assignments) {
              if (a.isActive !== false && a.userId) recipientIds.add(a.userId);
            }
            // Don't notify the person who performed the cancellation
            recipientIds.delete(req.userId);

            for (const uid of Array.from(recipientIds)) {
              try {
                await notifyJobUpdate(uid, job.title, job.id, 'This job has been cancelled');
              } catch (e) { console.error('[Job Cancel] push notify failed:', e); }
              try {
                const worker = await storage.getUser(uid);
                if (worker?.phone) {
                  await sendSMS({
                    to: worker.phone,
                    message: `JobRunner: "${job.title}" has been cancelled. You no longer need to attend.`,
                  });
                }
              } catch (e) { console.error('[Job Cancel] SMS notify failed:', e); }
            }
          } catch (e) {
            console.error('[Job Cancel] Failed to notify workers of cancellation:', e);
          }
        })();
      }
      
      // Auto-sync to Google Calendar if user is connected and job has schedule changes
      const scheduleChanged = data.scheduledAt || data.title || data.address || data.description || data.notes || data.status;
      if (scheduleChanged && job.scheduledAt) {
        try {
          const { syncJobToCalendar, isGoogleCalendarConnected } = await import('../googleCalendarClient');
          const connected = await isGoogleCalendarConnected(effectiveUserId);
          if (connected) {
            const client = job.clientId ? await storage.getClient(job.clientId, effectiveUserId) : null;
            const result = await syncJobToCalendar(effectiveUserId, {
              id: job.id,
              title: job.title,
              description: job.description,
              notes: job.notes,
              address: job.address,
              scheduledAt: new Date(job.scheduledAt),
              estimatedDuration: job.estimatedDuration ? job.estimatedDuration / 60 : 2,
              clientName: client?.name,
              clientPhone: client?.phone || undefined,
              clientEmail: client?.email || undefined,
              status: job.status,
              calendarEventId: job.calendarEventId
            });
            // Update job with calendar event ID if new
            if (result.eventId !== job.calendarEventId) {
              await storage.updateJob(job.id, effectiveUserId, { calendarEventId: result.eventId });
            }
            console.log(`[GoogleCalendar] Auto-synced updated job ${job.id} to calendar for user ${effectiveUserId}`);
          }
        } catch (calendarError) {
          console.error('[GoogleCalendar] Auto-sync failed for job update:', calendarError);
          // Don't fail job update if calendar sync fails
        }
      }

      res.json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error updating job:", error);
      res.status(500).json({ error: "Failed to update job" });
    }
  });

  app.patch("/api/jobs/:id/status", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_JOBS), async (req: any, res) => {
    try {
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: "status is required" });
      }
      
      // Validate status value
      const validStatuses = ['pending', 'scheduled', 'in_progress', 'done', 'invoiced'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }
      
      // Prevent staff from setting status to "invoiced" - only owners/managers can do this after creating invoice
      if (status === 'invoiced') {
        return res.status(403).json({ 
          error: "Staff cannot mark jobs as invoiced. Only owners or managers can do this after creating an invoice.",
          code: "PERMISSION_DENIED"
        });
      }
      
      const userContext = await getUserContext(req.userId);
      const effectiveUserId = userContext.effectiveUserId;
      
      // Get the job
      const existingJob = await storage.getJob(req.params.id, effectiveUserId);
      if (!existingJob) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Check if user is owner/manager OR assigned to this job
      const businessSettings = await storage.getBusinessSettings(effectiveUserId);
      const isOwner = businessSettings && businessSettings.userId === req.userId;
      
      let isManager = false;
      if (!isOwner) {
        const teamMemberInfo = await storage.getTeamMemberByUserIdAndBusiness(req.userId, effectiveUserId);
        if (teamMemberInfo && teamMemberInfo.roleId) {
          const role = await storage.getUserRole(teamMemberInfo.roleId);
          isManager = role?.name?.toLowerCase().includes('manager') || 
                      role?.name?.toLowerCase().includes('admin') || false;
        }
      }
      
      const isAssigned = existingJob.assignedTo === req.userId;
      
      // Staff can only update status on their assigned jobs
      if (!isOwner && !isManager && !isAssigned) {
        return res.status(403).json({ error: "You can only update status on jobs assigned to you" });
      }
      
      if (status === 'done' || status === 'completed') {
        // Only the lead worker (primary assignee) or an owner/manager may
        // complete the whole job. Other assigned workers clock off instead.
        if (!isOwner && !isManager && !(await isPrimaryAssignee(existingJob, req.userId))) {
          return res.status(403).json({
            error: "Only the lead worker or owner can complete this job. Use Clock Off to finish your own work.",
            code: "NOT_LEAD_WORKER"
          });
        }

        const validationErrors = await getJobCompletionErrors(req.params.id, effectiveUserId);
        if (validationErrors.length > 0) {
          return res.status(400).json({
            error: 'Time entries need attention before completing this job',
            validationErrors
          });
        }
      }

      // WHS gating: enforce pre-start safety + licence compliance when starting a job
      const startGate = await checkJobStartGate({
        job: existingJob,
        newStatus: status,
        businessSettings,
        effectiveUserId,
        fallbackUserId: req.userId,
      });
      if (startGate) {
        return res.status(startGate.status).json(startGate.body);
      }

      // Build update data with stage timestamps
      const now = new Date();
      const updateData: any = { status };
      
      // Auto-set stage timestamps when status changes
      if (status !== existingJob.status) {
        if (status === 'in_progress' && !existingJob.startedAt) {
          updateData.startedAt = now;
        } else if (status === 'done' && !existingJob.completedAt) {
          updateData.completedAt = await resolveJobCompletionTime(existingJob.id, now);
        } else if (status === 'invoiced' && !existingJob.invoicedAt) {
          updateData.invoicedAt = now;
        }
        // Clear timestamps if going back to earlier status
        if (status === 'pending' || status === 'scheduled') {
          updateData.startedAt = null;
          updateData.completedAt = null;
          updateData.invoicedAt = null;
        } else if (status === 'in_progress') {
          updateData.completedAt = null;
          updateData.invoicedAt = null;
        } else if (status === 'done') {
          updateData.invoicedAt = null;
        }
      }
      
      // Update job status with timestamps
      const job = await storage.updateJob(req.params.id, effectiveUserId, updateData);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Get user info for notifications
      const user = await storage.getUser(req.userId);
      const userName = user?.firstName || user?.username || 'Team member';
      
      // Broadcast real-time job status change to all connected users
      if (status !== existingJob.status) {
        const { broadcastJobStatusChange } = await import('../websocket');
        broadcastJobStatusChange(effectiveUserId, {
          jobId: job.id,
          status,
          title: job.title,
          updatedBy: req.userId,
        });
      }
      
      // Create notifications for status changes (notify owner/manager)
      if (status !== existingJob.status) {
        const client = job.clientId ? await storage.getClient(job.clientId, effectiveUserId) : null;
        const clientName = client?.name || 'Unknown client';
        
        if (status === 'in_progress') {
          await notifyJobStarted(storage, effectiveUserId, job, clientName);
        } else if (status === 'done') {
          // Notify business owner that staff completed the job
          await notifyJobCompleted(storage, effectiveUserId, job, { firstName: userName, username: userName });

          try {
            const owner = await storage.getUser(effectiveUserId);
            if (owner?.phone) {
              await notifyOwnerViaSms(owner.phone, 'jobCompleted', userName || 'Team', job.title);
            }
          } catch (e) { console.error('Owner SMS failed:', e); }

          // Send email to owner when staff completes job
          try {
            const owner = await storage.getUser(effectiveUserId);
            
            if (owner?.email && req.userId !== effectiveUserId) {
              // Only send email if staff (not owner) completed the job
              await sendJobCompletionNotificationEmail(
                owner.email,
                owner.firstName || null,
                userName,
                job.title,
                clientName,
                new Date(),
                getProductionBaseUrl(req),
                job.id
              );
            }
          } catch (emailError) {
            console.error('Failed to send job completion email:', emailError);
          }
        } else {
          // Notify for all other status changes
          try {
            const statusLabel = (status || '').replace(/_/g, ' ');
            await storage.createNotification({
              userId: effectiveUserId,
              type: 'job_status_changed', 
              title: 'Job Phase Changed',
              message: `"${job.title}" moved to ${statusLabel} by ${userName}`,
              priority: 'normal',
              actionUrl: `/jobs/${job.id}`,
              actionLabel: 'View Job',
              relatedId: job.id,
              relatedType: 'job',
            });
          } catch (e) { console.error('Failed to create job status notification:', e); }
        }
        
        // Trigger automation rules for job status change
        processStatusChangeAutomation(effectiveUserId, 'job', job.id, existingJob.status, status)
          .catch(err => console.error('[Automations] Error processing job status change:', err));
        
        if (status === 'done' || status === 'completed') {
          const { processReviewRequestAutomation } = await import('../automationService');
          processReviewRequestAutomation(effectiveUserId, job.id)
            .catch(err => console.error('[Automations] Error processing review request:', err));
        }
        
        // Send push notification for job status change
        try {
          const statusDescription = status === 'in_progress' ? 'started' : 
                                   status === 'done' ? 'completed' : 
                                   status === 'invoiced' ? 'invoiced' : 
                                   `changed to ${status}`;
          
          // Notify job owner if status changed by someone else
          if (req.userId !== effectiveUserId) {
            await notifyJobUpdate(effectiveUserId, job.title, job.id, statusDescription);
            console.log(`[PushNotification] Sent job update notification to owner ${effectiveUserId}`);
          }
          
          // Notify assignee if they exist and are different from who made the change
          // Resolve assignedTo to proper user ID (it may be a team member record ID)
          const assigneeUserId = await resolveAssigneeUserId(job.assignedTo, effectiveUserId);
          if (assigneeUserId && assigneeUserId !== req.userId && assigneeUserId !== effectiveUserId) {
            await notifyJobUpdate(assigneeUserId, job.title, job.id, statusDescription);
            console.log(`[PushNotification] Sent job update notification to assignee ${assigneeUserId}`);
          }
        } catch (pushError) {
          console.error('[PushNotification] Error sending job status update notification:', pushError);
        }
      }
      
      res.json(job);
    } catch (error) {
      console.error("Error updating job status:", error);
      res.status(500).json({ error: "Failed to update job status" });
    }
  });

  app.post("/api/jobs/:id/complete-inspection", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_JOBS), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const userContext = req.userContext || await getUserContext(userId);
      const effectiveUserId = userContext.effectiveUserId;
      
      const job = await storage.getJob(req.params.id, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (!job.requiresInspection) {
        return res.status(400).json({ error: "This job does not require inspection" });
      }

      // Only people who manage jobs (owner/admin/manager/supervisor via WRITE_JOBS)
      // or a worker actually assigned to the job may sign off its inspection.
      // Check BOTH the primary assignee field and the multi-assignment records so
      // secondary assigned workers/subcontractors aren't wrongly blocked.
      const canManageJobs = userContext.isOwner || hasPermission(userContext, PERMISSIONS.WRITE_JOBS);
      let isAssigned = job.assignedTo === userId;
      if (!canManageJobs && !isAssigned) {
        const assignment = await storage.getJobAssignmentForUser(req.params.id, userId);
        isAssigned = !!assignment;
      }
      if (!canManageJobs && !isAssigned) {
        return res.status(403).json({ error: "You can only complete inspection on jobs assigned to you" });
      }
      
      const updatedJob = await storage.updateJob(req.params.id, effectiveUserId, {
        inspectionCompletedAt: new Date(),
        inspectionNotes: req.body.notes || null,
      });
      
      res.json(updatedJob);
    } catch (error) {
      console.error("Error completing inspection:", error);
      res.status(500).json({ error: "Failed to complete inspection" });
    }
  });

  app.post("/api/jobs/:id/assign", requireAuth, createPermissionMiddleware(PERMISSIONS.ASSIGN_JOBS), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { assignedTo } = req.body;
      
      // Allow null for unassigning jobs
      if (assignedTo === null || assignedTo === undefined) {
        // Unassign the job - only owners/managers can do this
        const canManageJobs = userContext.isOwner || userContext.permissions.includes('view_all');
        if (!canManageJobs) {
          return res.status(403).json({ error: "You don't have permission to unassign jobs" });
        }
        
        const job = await storage.updateJob(req.params.id, userContext.effectiveUserId, { 
          assignedTo: null
        });
        
        if (!job) {
          return res.status(404).json({ error: "Job not found" });
        }
        
        return res.json(job);
      }
      
      // Validate job assignment RBAC: Owner assigns to anyone, Manager assigns to workers only
      const assignmentCheck = await canAssignJobTo(userContext, assignedTo);
      if (!assignmentCheck.allowed) {
        return res.status(403).json({ 
          error: assignmentCheck.reason || "You don't have permission to assign this job to that team member",
          code: "ASSIGNMENT_NOT_ALLOWED"
        });
      }
      
      // Verify the assignee is a valid team member (or the owner)
      // Note: assignedTo can be either memberId (team_members.member_id) or userId (users.id)
      const teamMembers = await storage.getTeamMembers(userContext.effectiveUserId);
      const validAssignee = teamMembers.find(m => 
        m.memberId === assignedTo && 
        m.inviteStatus === 'accepted'
      );
      const isAssigningToOwner = assignedTo === userContext.businessOwnerId || assignedTo === userContext.effectiveUserId;
      
      if (!validAssignee && !isAssigningToOwner) {
        return res.status(400).json({ error: "Invalid team member for assignment" });
      }
      
      // Update the job with the assignedTo field
      const job = await storage.updateJob(req.params.id, userContext.effectiveUserId, { 
        assignedTo,
        status: 'scheduled' // Auto-schedule when assigned
      });
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Resolve assignedTo to proper user ID for notifications
      // (assignedTo may be a team member record ID or a user ID)
      const assigneeUserId = await resolveAssigneeUserId(assignedTo, userContext.effectiveUserId) || assignedTo;
      
      // Create DB notification for the assigned team member
      try {
        const assigner = await storage.getUser(req.userId);
        await notifyJobAssignedDB(storage, assigneeUserId, job, assigner || { firstName: 'Manager' });
      } catch (notifErr) {
        console.error('Failed to send job assigned DB notification:', notifErr);
      }
      
      // Send push notification to assigned team member
      await notifyJobAssigned(assigneeUserId, job.title, job.id);
      
      // Send email notification to assigned team member
      try {
        const assigneeUser = await storage.getUser(assigneeUserId);
        const assigner = await storage.getUser(req.userId);
        
        if (assigneeUser?.email) {
          await sendJobAssignmentEmail(
            assigneeUser.email,
            assigneeUser.firstName || null,
            assigner?.firstName || 'Your manager',
            (await storage.getBusinessSettings(userContext.effectiveUserId))?.businessName || 'JobRunner',
            job.title,
            (job as any).address || null,
            (job as any).scheduledDate || null,
            getProductionBaseUrl(req),
            job.id
          );
        }
      } catch (emailError) {
        console.error('Failed to send job assignment email:', emailError);
        // Don't fail if email fails
      }
      
      res.json(job);
    } catch (error: any) {
      console.error("Error assigning job:", error);
      res.status(500).json({ error: error.message || "Failed to assign job" });
    }
  });

  app.post("/api/jobs/:id/multi-assign", requireAuth, createPermissionMiddleware(PERMISSIONS.ASSIGN_JOBS), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const canManage = userContext.isOwner || userContext.permissions.includes('view_all');
      if (!canManage) {
        return res.status(403).json({ error: "Only owners and managers can multi-assign jobs" });
      }

      const { workerIds } = req.body;
      if (!Array.isArray(workerIds)) {
        return res.status(400).json({ error: "workerIds must be an array" });
      }

      const jobId = req.params.id;
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) return res.status(404).json({ error: "Job not found" });

      const teamMembers = await storage.getTeamMembers(userContext.effectiveUserId);
      const existingAssignments = await storage.getJobAssignments(jobId);

      const results: any[] = [];
      const assigner = await storage.getUser(req.userId);

      for (const workerId of workerIds) {
        const validMember = teamMembers.find((m: any) =>
          (m.memberId === workerId || m.userId === workerId) &&
          m.inviteStatus === 'accepted'
        );
        const isOwner = workerId === userContext.businessOwnerId || workerId === userContext.effectiveUserId;
        if (!validMember && !isOwner) continue;

        const alreadyAssigned = existingAssignments.find((a: any) =>
          a.userId === workerId && a.isActive
        );
        if (alreadyAssigned) {
          results.push({ workerId, status: 'already_assigned' });
          continue;
        }

        const resolvedUserId = await resolveAssigneeUserId(workerId, userContext.effectiveUserId) || workerId;

        try {
          const assignment = await storage.createJobAssignment({
            jobId,
            userId: resolvedUserId,
            teamMemberId: validMember?.id || null,
            assignmentStatus: 'assigned',
            isActive: true,
            isPrimary: existingAssignments.length === 0 && results.filter(r => r.status === 'assigned').length === 0,
            workerDisplayNameSnapshot: validMember
              ? [validMember.firstName, validMember.lastName].filter(Boolean).join(' ') || validMember.email
              : null,
          });

          await notifyJobAssigned(resolvedUserId, job.title, job.id);
          try {
            await notifyJobAssignedDB(storage, resolvedUserId, job, assigner || { firstName: 'Manager' });
          } catch (e) {
            logger.warn('background', 'Failed to persist in-app job-assignment notification', { userId: resolvedUserId, error: e, metadata: { jobId: job.id } });
          }

          results.push({ workerId, status: 'assigned', assignmentId: assignment?.id });
        } catch (assignErr) {
          console.error(`[MultiAssign] Failed to assign ${workerId}:`, assignErr);
          results.push({ workerId, status: 'error' });
        }
      }

      if (results.some(r => r.status === 'assigned') && job.status === 'pending') {
        await storage.updateJob(jobId, userContext.effectiveUserId, { status: 'scheduled' });
      }

      if (results.length > 0) {
        const firstAssigned = results.find(r => r.status === 'assigned');
        if (firstAssigned) {
          const resolvedId = await resolveAssigneeUserId(firstAssigned.workerId, userContext.effectiveUserId) || firstAssigned.workerId;
          await storage.updateJob(jobId, userContext.effectiveUserId, { assignedTo: resolvedId });
        }
      }

      const allAssignments = await storage.getJobAssignments(jobId);
      res.json({ results, assignments: allAssignments });
    } catch (error: any) {
      console.error("Error in multi-assign:", error);
      res.status(500).json({ error: error.message || "Failed to multi-assign job" });
    }
  });

  app.delete("/api/jobs/:jobId/assignments/:userId/remove", requireAuth, createPermissionMiddleware(PERMISSIONS.ASSIGN_JOBS), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const canManage = userContext.isOwner || userContext.permissions.includes('view_all');
      if (!canManage) {
        return res.status(403).json({ error: "Only owners and managers can unassign workers" });
      }

      const { jobId, userId: targetUserId } = req.params;

      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) return res.status(404).json({ error: "Job not found or access denied" });

      const assignments = await storage.getJobAssignments(jobId);
      const assignment = assignments.find((a: any) => a.userId === targetUserId && a.isActive);

      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      await storage.updateJobAssignment(assignment.id, { isActive: false, assignmentStatus: 'removed' });

      const remaining = assignments.filter((a: any) => a.id !== assignment.id && a.isActive);
      if (remaining.length > 0) {
        const primary = remaining.find((a: any) => a.isPrimary) || remaining[0];
        await storage.updateJob(jobId, userContext.effectiveUserId, { assignedTo: primary.userId });
      } else {
        await storage.updateJob(jobId, userContext.effectiveUserId, { assignedTo: null });
      }

      const allAssignments = await storage.getJobAssignments(jobId);
      res.json({ removed: true, assignments: allAssignments });
    } catch (error: any) {
      console.error("Error removing assignment:", error);
      res.status(500).json({ error: error.message || "Failed to remove assignment" });
    }
  });

  app.post("/api/jobs/:jobId/nudge-worker", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const canManage = userContext.isOwner || userContext.permissions.includes('view_all');
      if (!canManage) {
        return res.status(403).json({ error: "Only owners and managers can nudge workers" });
      }

      const { jobId } = req.params;
      const { workerId } = req.body;
      if (!workerId) return res.status(400).json({ error: "workerId is required" });

      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) return res.status(404).json({ error: "Job not found" });

      const manager = await storage.getUser(req.userId);
      const managerName = manager?.firstName || 'Your manager';

      let minutesAway: number | null = null;
      const scheduledDate = (job as any).scheduledDate || (job as any).scheduledAt;
      if (scheduledDate) {
        const scheduled = new Date(scheduledDate);
        const now = new Date();
        minutesAway = Math.max(0, Math.round((scheduled.getTime() - now.getTime()) / (1000 * 60)));
      }

      const resolvedUserId = await resolveAssigneeUserId(workerId, userContext.effectiveUserId) || workerId;

      await notifyJobNudge(
        resolvedUserId,
        job.title,
        jobId,
        (job as any).address || null,
        minutesAway,
        managerName
      );

      await storage.createNotification({
        userId: resolvedUserId,
        type: 'general',
        title: `Heads Up from ${managerName}`,
        message: `${job.title}${(job as any).address ? ` at ${(job as any).address}` : ''}${minutesAway ? ` in ~${minutesAway} min` : ' coming up'}`,
        relatedId: jobId,
        relatedType: 'job',
      });

      res.json({ success: true, nudgedUserId: resolvedUserId });
    } catch (error: any) {
      console.error("Error nudging worker:", error);
      res.status(500).json({ error: error.message || "Failed to nudge worker" });
    }
  });

  app.post("/api/jobs/:jobId/nudge-response", requireAuth, async (req: any, res) => {
    try {
      const { response } = req.body;
      if (!['acknowledged', 'running_late'].includes(response)) {
        return res.status(400).json({ error: "Response must be 'acknowledged' or 'running_late'" });
      }

      const { jobId } = req.params;
      const job = await storage.getJobPublic(jobId);
      if (!job) return res.status(404).json({ error: "Job not found" });

      const assignments = await storage.getJobAssignments(jobId);
      const isAssigned = assignments.some((a: any) => a.userId === req.userId && a.isActive);
      const isJobAssignee = job.assignedTo === req.userId;
      if (!isAssigned && !isJobAssignee) {
        return res.status(403).json({ error: "You are not assigned to this job" });
      }

      const worker = await storage.getUser(req.userId);
      const workerName = worker?.firstName || 'Worker';

      const managerId = job.userId;

      await notifyNudgeResponse(
        managerId,
        workerName,
        job.title,
        jobId,
        response
      );

      await storage.createNotification({
        userId: managerId,
        type: 'general',
        title: response === 'acknowledged' ? 'Worker Confirmed' : 'Worker Running Late',
        message: response === 'acknowledged'
          ? `${workerName}: "Got it, heading there now" for ${job.title}`
          : `${workerName}: "Running late" for ${job.title}`,
        relatedId: jobId,
        relatedType: 'job',
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error handling nudge response:", error);
      res.status(500).json({ error: error.message || "Failed to handle nudge response" });
    }
  });

  app.post("/api/jobs/:id/send", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      const { method, subject, body } = req.body;
      const userContext = await getUserContext(req.userId);
      const job = await storage.getJob(req.params.id, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (!job.clientId) {
        return res.status(400).json({ error: "Job has no associated client" });
      }

      const client = await storage.getClient(job.clientId, userContext.effectiveUserId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      if (!client.email) {
        return res.status(400).json({ error: "Client has no email address" });
      }

      const business = await storage.getBusinessSettings(userContext.effectiveUserId) || {
        businessName: 'Business',
        abn: '',
        address: '',
        phone: '',
        email: '',
        brandColor: '#2563eb'
      };

      if (method === 'email') {
        // Send via SendGrid
        const sgMail = await import('@sendgrid/mail');
        if (!process.env.SENDGRID_API_KEY) {
          return res.status(400).json({ error: "Email service not configured" });
        }
        
        sgMail.default.setApiKey(process.env.SENDGRID_API_KEY);
        
        const fromEmail = business.email || 'noreply@jobrunner.com.au';
        const businessName = business.businessName || 'JobRunner';
        
        await sgMail.default.send({
          trackingSettings: { clickTracking: { enable: false, enableText: false }, openTracking: { enable: true } },
          to: client.email,
          from: {
            email: fromEmail,
            name: businessName
          },
          subject: subject || `Your Job from ${escapeHtml(businessName)}`,
          text: body || `Hi ${client.name || 'there'},\n\nHere are the details for your job: ${job.title}\n\nScheduled: ${job.scheduledAt || 'To be confirmed'}\nAddress: ${job.address || 'To be confirmed'}\n\nIf you have any questions, please don't hesitate to reach out.\n\nCheers,\n${businessName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: ${business.brandColor || '#2563eb'};">${escapeHtml(businessName)}</h2>
              <p>Hi ${client.name || 'there'},</p>
              <p>${body?.replace(/\n/g, '<br>') || `Here are the details for your job: <strong>${job.title}</strong>`}</p>
              <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="margin: 0;"><strong>Job:</strong> ${job.title}</p>
                <p style="margin: 8px 0 0;"><strong>Scheduled:</strong> ${job.scheduledAt || 'To be confirmed'}</p>
                <p style="margin: 8px 0 0;"><strong>Address:</strong> ${job.address || 'To be confirmed'}</p>
              </div>
              <p>If you have any questions, please don't hesitate to reach out.</p>
              <p>Cheers,<br>${escapeHtml(businessName)}</p>
            </div>
          `,
        });

        // Log activity
        await logActivity(
          userContext.effectiveUserId,
          'email_sent' as ActivityType,
          `Job details sent - ${job.title}`,
          `Email sent to ${client.email}`,
          'job',
          job.id,
          { clientEmail: client.email, subject }
        );

        res.json({ success: true, message: 'Job details sent via email' });
      } else {
        return res.status(400).json({ error: "Unsupported send method" });
      }
    } catch (error: any) {
      console.error("Error sending job:", error);
      res.status(500).json({ error: error.message || "Failed to send job details" });
    }
  });

  app.post("/api/jobs/:id/send-confirmation", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const job = await storage.getJob(req.params.id, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (!job.clientId) {
        return res.status(400).json({ error: "Job has no associated client" });
      }

      const client = await storage.getClient(job.clientId, userContext.effectiveUserId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      if (!client.email) {
        return res.status(400).json({ error: "Client has no email address" });
      }

      const business = await storage.getBusinessSettings(userContext.effectiveUserId) || {
        businessName: 'Business',
        abn: '',
        address: '',
        phone: '',
        email: '',
        brandColor: '#2563eb'
      };

      await sendJobConfirmationEmail(job, client, business);
      res.json({ success: true, message: 'Job confirmation email sent successfully' });
    } catch (error: any) {
      console.error("Error sending job confirmation email:", error);
      res.status(500).json({ error: error.message || "Failed to send job confirmation email" });
    }
  });

  app.post("/api/jobs/:id/on-my-way", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);

      // Idempotency: dedupe replays from offline queue.
      const idempotencyKey: string | undefined = req.body?.idempotencyKey || req.headers['idempotency-key'];
      if (idempotencyKey) {
        const cached = await getIdempotencyRecord(`onmyway:${req.params.id}:${idempotencyKey}`);
        if (cached) {
          return res.json({ ...cached, idempotentReplay: true });
        }
      }

      const job = await storage.getJob(req.params.id, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (!job.clientId) {
        return res.status(400).json({ error: "Job has no associated client" });
      }

      const client = await storage.getClient(job.clientId, userContext.effectiveUserId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      if (!client.phone) {
        return res.status(400).json({ error: "Client has no phone number for SMS notification" });
      }

      const business = await storage.getBusinessSettings(userContext.effectiveUserId);

      // Pre-flight: the whole point of on-my-way is the client SMS. If the
      // business has no dedicated number, return the 402 prompt BEFORE any
      // state writes so retrying after purchase doesn't duplicate updates.
      if (!business?.dedicatedPhoneNumber) {
        return smsFailureResponse(res, 'Your business needs its own dedicated phone number to send SMS. Purchase a dedicated number.');
      }

      const businessName = business?.businessName || 'Your tradesperson';
      const user = await storage.getUser(req.userId);
      const workerFirstName = (user?.firstName || '').trim();
      const tradieName = workerFirstName || businessName;
      // Sender label avoids "{businessName} from {businessName}" when the worker
      // has no first name set (e.g. a worker logged into a business account).
      const senderLabel = workerFirstName ? `${workerFirstName} from ${businessName}` : businessName;

      let { customMessage, latitude, longitude } = req.body;

      // If the app didn't send a fresh GPS fix (e.g. the one-time read failed),
      // fall back to the worker's most recently shared live location so the ETA
      // is still real instead of the static default. Only use it if it's recent.
      if ((latitude == null || longitude == null)) {
        try {
          const status = await storage.getTradieStatus(req.userId);
          const lastUpdate = status?.lastLocationUpdate || status?.lastSeenAt;
          const fresh = lastUpdate ? (Date.now() - new Date(lastUpdate).getTime()) < 15 * 60 * 1000 : false;
          if (fresh && status?.currentLatitude && status?.currentLongitude) {
            latitude = status.currentLatitude;
            longitude = status.currentLongitude;
          }
        } catch (statusErr) {
          console.log('[OnMyWay] Could not load last shared location for ETA fallback:', statusErr);
        }
      }

      // Calculate real ETA using GPS coordinates + OSRM routing
      let estimatedMinutes = 20;
      let etaSource = 'default';
      let distanceKm: number | null = null;

      if (latitude && longitude && job.address) {
        try {
          // Get job coordinates - try stored lat/lng first, then geocode address
          let jobLat = job.latitude ? parseFloat(String(job.latitude)) : null;
          let jobLng = job.longitude ? parseFloat(String(job.longitude)) : null;
          
          if (!jobLat || !jobLng) {
            const geocoded = await geocodeAddress(job.address);
            if (geocoded) {
              jobLat = geocoded.latitude;
              jobLng = geocoded.longitude;
            }
          }

          if (jobLat && jobLng) {
            // Try OSRM real driving time first
            const routeETA = await calculateRouteETA(
              parseFloat(String(latitude)),
              parseFloat(String(longitude)),
              jobLat,
              jobLng
            );

            if (routeETA) {
              estimatedMinutes = Math.max(routeETA.durationMinutes, 2);
              distanceKm = routeETA.distanceKm;
              etaSource = 'osrm';
            } else {
              // Fallback: Haversine distance with speed heuristic
              const dist = haversineDistance(
                parseFloat(String(latitude)),
                parseFloat(String(longitude)),
                jobLat,
                jobLng
              );
              distanceKm = Math.round(dist * 10) / 10;

              if (dist <= 5) {
                estimatedMinutes = Math.max(Math.ceil(dist * 3), 3);
              } else if (dist <= 20) {
                estimatedMinutes = Math.ceil(dist * 2.5);
              } else if (dist <= 50) {
                estimatedMinutes = Math.ceil(dist * 2);
              } else {
                estimatedMinutes = Math.ceil(dist * 1.5);
              }
              etaSource = 'haversine';
            }
          }
        } catch (etaError) {
          console.log('[OnMyWay] ETA calculation failed, using default:', etaError);
        }
      }

      const baseUrl = getProductionBaseUrl(req);

      // Get or create a Job Portal token so the client sees the full job view
      let portalUrl: string | null = null;
      try {
        let activePortalToken = await storage.getActiveJobPortalToken(job.id);
        if (!activePortalToken) {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);
          activePortalToken = await storage.createJobPortalToken({
            jobId: job.id,
            userId: userContext.effectiveUserId,
            token: randomBytes(32).toString('hex'),
            expiresAt,
            createdBy: req.userId,
          });
          await storage.updateJob(job.id, userContext.effectiveUserId, { portalEnabled: true });
        }
        portalUrl = `${baseUrl}/p/${activePortalToken.token}`;
      } catch (portalErr) {
        console.log('[OnMyWay] Could not create portal token, falling back to tracking link:', portalErr);
      }

      // Fallback: in-memory tracking token if portal creation fails
      if (!portalUrl) {
        const trackingToken = randomBytes(16).toString('hex');
        const addressParts = (job.address || '').split(',');
        const suburb = addressParts.length > 1 ? addressParts[addressParts.length - 2]?.trim() : addressParts[0]?.trim() || 'your area';
        trackingTokens.set(trackingToken, {
          businessName,
          businessLogo: business?.logoUrl || null,
          businessPhone: business?.phone || null,
          businessEmail: business?.email || null,
          tradieName,
          jobAddress: job.address || '',
          suburb,
          sentAt: new Date(),
          estimatedMinutes,
          status: 'on_the_way'
        });
        setTimeout(() => trackingTokens.delete(trackingToken), 2 * 60 * 60 * 1000);
        portalUrl = `${baseUrl}/track/${trackingToken}`;
      }

      // Update job worker status to on_my_way with ETA
      try {
        await storage.updateJob(job.id, userContext.effectiveUserId, {
          workerStatus: 'on_my_way',
          workerEtaMinutes: estimatedMinutes,
          workerStatusUpdatedAt: new Date(),
        });
      } catch (statusErr) {
        console.log('[OnMyWay] Could not update worker status:', statusErr);
      }

      // Update assignment status to en_route so crew-locations endpoint returns this worker
      try {
        const jobAssignments = await storage.getJobAssignments(job.id);
        const myAssignment = jobAssignments.find((a: any) => a.userId === req.userId && a.isActive);
        if (myAssignment) {
          await storage.updateJobAssignment(myAssignment.id, {
            assignmentStatus: 'en_route',
            travelStartedAt: new Date(),
            etaMinutes: estimatedMinutes,
            etaUpdatedAt: new Date(),
          });
          // Store initial location ping so the map shows the worker immediately
          if (latitude && longitude) {
            try {
              await storage.createLocationPing({
                assignmentId: myAssignment.id,
                userId: req.userId,
                latitude: parseFloat(String(latitude)),
                longitude: parseFloat(String(longitude)),
                accuracyMeters: null,
              } as any);
            } catch (pingErr) {
              console.log('[OnMyWay] Could not store initial location ping:', pingErr);
            }
          }
        }
      } catch (assignErr) {
        console.log('[OnMyWay] Could not update assignment status:', assignErr);
      }

      // Persist the fresh coords to the worker's live status (tradie_status) too.
      // The customer portal map reads this feed, so this is what makes a worker
      // show up even when the job has NO assignment row — e.g. a solo tradie or
      // owner running their own job (in that case the en_route/ping branch above
      // is skipped because myAssignment is null). Same feed as the in-app map.
      if (latitude && longitude) {
        try {
          await storage.upsertTradieStatus({
            userId: req.userId,
            businessOwnerId: userContext.effectiveUserId,
            currentLatitude: String(latitude),
            currentLongitude: String(longitude),
            activityStatus: 'driving',
            currentJobId: job.id,
            lastLocationUpdate: new Date(),
            lastSeenAt: new Date(),
          } as any);
        } catch (statusErr) {
          console.log('[OnMyWay] Could not persist live status location:', statusErr);
        }
      }

      const trackingUrl = portalUrl;

      // Build smart ETA message based on calculated driving time
      const etaText = estimatedMinutes <= 5
        ? 'should be there in about 5 minutes'
        : `ETA approximately ${estimatedMinutes} minutes`;
      const distanceText = distanceKm !== null ? ` (${distanceKm} km away)` : '';

      let baseMessage = customMessage || `Hi ${client.name || 'there'}, ${senderLabel} is on the way to your job at ${job.address || 'your location'}. ${etaText.charAt(0).toUpperCase() + etaText.slice(1)}${distanceKm && distanceKm > 0 ? ` (${distanceKm} km away)` : ''}.`;
      baseMessage = baseMessage.replace(/\n*Track arrival:[\s\S]*$/gim, '').replace(/\n*Track your job:[\s\S]*$/gim, '').replace(/\n*\[link will be added\][\s\S]*$/gim, '').replace(/\n*Track arrival:\s*$/gim, '').trim();
      const message = `${baseMessage}\n\nTrack your job: ${trackingUrl}`;
      
      // Send SMS via smsService to properly track in conversations/Chat Hub
      const { sendSmsToClient } = await import('../services/smsService');
      let smsResult: any = { success: false };
      try {
        const smsMessage = await sendSmsToClient({
          businessOwnerId: userContext.effectiveUserId,
          clientId: client.id,
          clientPhone: client.phone,
          clientName: client.name || client.email || undefined,
          jobId: job.id,
          message: message,
          senderUserId: req.userId,
          isQuickAction: true,
          quickActionType: 'on_my_way',
        });
        const isSent = smsMessage.status === 'sent' || smsMessage.status === 'pending';
        smsResult = { success: isSent, error: isSent ? undefined : (smsMessage.errorMessage || 'SMS delivery failed') };
      } catch (smsErr: any) {
        console.error('[OnMyWay] SMS send error:', smsErr);
        smsResult = { success: false, error: smsErr.message };
      }

      // Log activity
      await logActivity(
        userContext.effectiveUserId,
        'job_started',
        `On My Way - ${job.title || 'Job'}`,
        smsResult.success 
          ? `On My Way SMS sent to ${client.name || client.email || 'client'} at ${client.phone} (ETA: ${estimatedMinutes} min via ${etaSource})`
          : `On My Way notification failed - SMS not configured`,
        'job',
        job.id,
        { 
          clientName: client.name, 
          clientPhone: client.phone,
          smsSent: smsResult.success,
          estimatedMinutes,
          distanceKm,
          etaSource
        }
      );

      if (!smsResult.success) {
        return smsFailureResponse(res, smsResult.error, smsResult.notConfigured);
      }

      const responsePayload = {
        success: true,
        message: 'On My Way notification sent',
        trackingUrl,
        estimatedMinutes,
        distanceKm,
        etaSource
      };
      if (idempotencyKey) {
        await setIdempotencyRecord(`onmyway:${req.params.id}:${idempotencyKey}`, responsePayload);
      }
      res.json(responsePayload);
    } catch (error: any) {
      console.error("Error sending on-my-way notification:", error);
      res.status(500).json({ error: error.message || "Failed to send notification" });
    }
  });

  // Build a smart "On my way" / "Running late" message with a REAL ETA for the
  // chat composer. Unlike /on-my-way this does NOT send an SMS — it returns the
  // message text so the worker can review and send it from the Chat Hub. A live
  // tracking link is only included when the business allows location sharing.
  app.post("/api/jobs/:id/eta-message", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const job = await storage.getJob(req.params.id, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const type: 'omw' | 'late' = req.body?.type === 'late' ? 'late' : 'omw';
      const { latitude, longitude } = req.body || {};
      // previewOnly: build the real-ETA message text for a preview WITHOUT any
      // side effects (no portal token, no en_route flip, no location ping). The
      // actual /on-my-way call does that work when the worker confirms send.
      const previewOnly = req.body?.previewOnly === true;

      const business = await storage.getBusinessSettings(userContext.effectiveUserId);
      const businessName = business?.businessName || 'your tradesperson';
      const user = await storage.getUser(req.userId);
      const tradieName = user?.firstName || businessName;
      const client = job.clientId ? await storage.getClient(job.clientId, userContext.effectiveUserId) : null;
      const clientFirst = client?.name || 'there';
      const allowSharing = true;

      // Calculate real ETA using GPS coordinates + OSRM routing (same logic as /on-my-way)
      let estimatedMinutes: number | null = null;
      let distanceKm: number | null = null;
      let etaSource = 'none';

      if (latitude && longitude && (job.address || (job.latitude && job.longitude))) {
        try {
          let jobLat = job.latitude ? parseFloat(String(job.latitude)) : null;
          let jobLng = job.longitude ? parseFloat(String(job.longitude)) : null;
          if ((!jobLat || !jobLng) && job.address) {
            const geocoded = await geocodeAddress(job.address);
            if (geocoded) {
              jobLat = geocoded.latitude;
              jobLng = geocoded.longitude;
            }
          }
          if (jobLat && jobLng) {
            const routeETA = await calculateRouteETA(
              parseFloat(String(latitude)),
              parseFloat(String(longitude)),
              jobLat,
              jobLng,
            );
            if (routeETA) {
              estimatedMinutes = Math.max(routeETA.durationMinutes, 2);
              distanceKm = routeETA.distanceKm;
              etaSource = 'osrm';
            } else {
              const dist = haversineDistance(
                parseFloat(String(latitude)),
                parseFloat(String(longitude)),
                jobLat,
                jobLng,
              );
              distanceKm = Math.round(dist * 10) / 10;
              if (dist <= 5) estimatedMinutes = Math.max(Math.ceil(dist * 3), 3);
              else if (dist <= 20) estimatedMinutes = Math.ceil(dist * 2.5);
              else if (dist <= 50) estimatedMinutes = Math.ceil(dist * 2);
              else estimatedMinutes = Math.ceil(dist * 1.5);
              etaSource = 'haversine';
            }
          }
        } catch (etaError) {
          console.log('[EtaMessage] ETA calculation failed:', etaError);
        }
      }

      // Only build a tracking link when the business allows location sharing AND we
      // have a real position to show. Otherwise the message has no link.
      let trackingUrl: string | null = null;
      if (allowSharing && latitude && longitude && !previewOnly) {
        const baseUrl = getProductionBaseUrl(req);
        try {
          let activePortalToken = await storage.getActiveJobPortalToken(job.id);
          if (!activePortalToken) {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);
            activePortalToken = await storage.createJobPortalToken({
              jobId: job.id,
              userId: userContext.effectiveUserId,
              token: randomBytes(32).toString('hex'),
              expiresAt,
              createdBy: req.userId,
            });
            await storage.updateJob(job.id, userContext.effectiveUserId, { portalEnabled: true });
          }
          trackingUrl = `${baseUrl}/p/${activePortalToken.token}`;
        } catch (portalErr) {
          console.log('[EtaMessage] Could not create portal token:', portalErr);
        }

        // Mark assignment en_route + store a ping so the live map shows the worker
        try {
          const jobAssignments = await storage.getJobAssignments(job.id);
          const myAssignment = jobAssignments.find((a: any) => a.userId === req.userId && a.isActive);
          if (myAssignment) {
            await storage.updateJobAssignment(myAssignment.id, {
              assignmentStatus: 'en_route',
              travelStartedAt: new Date(),
              etaMinutes: estimatedMinutes ?? undefined,
              etaUpdatedAt: new Date(),
            });
            await storage.createLocationPing({
              userId: req.userId,
              assignmentId: myAssignment.id,
              latitude: parseFloat(String(latitude)),
              longitude: parseFloat(String(longitude)),
              accuracyMeters: null,
            });
          }
        } catch (assignErr) {
          console.log('[EtaMessage] Could not update assignment:', assignErr);
        }
      }

      // Build the message text
      const distanceText = distanceKm && distanceKm > 0 ? ` (${distanceKm} km away)` : '';
      let message: string;
      if (type === 'late') {
        if (estimatedMinutes !== null) {
          const mins = estimatedMinutes <= 5 ? 'about 5 minutes' : `about ${estimatedMinutes} minutes`;
          message = `Apologies ${clientFirst}, running a bit behind schedule. ${tradieName} is ${mins} away${distanceText}.`;
        } else {
          message = `Apologies ${clientFirst}, ${tradieName} is running a bit behind schedule. Should be there in about 20 minutes.`;
        }
      } else {
        if (estimatedMinutes !== null) {
          const etaText = estimatedMinutes <= 5
            ? 'Should be there in about 5 minutes'
            : `ETA approximately ${estimatedMinutes} minutes`;
          message = `G'day ${clientFirst}, ${tradieName} from ${businessName} is on the way to ${job.address || 'your location'}. ${etaText}${distanceText}.`;
        } else {
          message = `G'day ${clientFirst}, ${tradieName} from ${businessName} is on the way now. Should be there in about 20 minutes.`;
        }
      }
      if (trackingUrl) {
        message = `${message}\n\nTrack arrival: ${trackingUrl}`;
      }

      res.json({ message, estimatedMinutes, distanceKm, trackingUrl, etaSource, hasRealEta: estimatedMinutes !== null });
    } catch (error: any) {
      console.error("Error building ETA message:", error);
      res.status(500).json({ error: error.message || "Failed to build ETA message" });
    }
  });

  app.post("/api/jobs/:jobId/assignments/:assignmentId/on-my-way", requireAuth, async (req: any, res) => {
    try {
      const { handleOnMyWay } = await import('../services/assignmentWorkflowService');
      const baseUrl = getProductionBaseUrl(req);
      
      const result = await handleOnMyWay({
        jobId: req.params.jobId,
        assignmentId: req.params.assignmentId,
        actorUserId: req.userId,
        workerLatitude: req.body.latitude,
        workerLongitude: req.body.longitude,
        customMessage: req.body.customMessage,
        baseUrl,
      });

      if (!result.success) {
        return smsFailureResponse(res, result.error);
      }
      res.json(result);
    } catch (error: any) {
      console.error("Error in assignment on-my-way:", error);
      res.status(500).json({ error: error.message || "Failed to process on-my-way" });
    }
  });

  app.patch("/api/jobs/:jobId/assignments/:assignmentId/status", requireAuth, async (req: any, res) => {
    try {
      const { handleWorkerStatusChange } = await import('../services/assignmentWorkflowService');
      const { status } = req.body;
      
      if (!['arrived', 'in_progress', 'completed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be: arrived, in_progress, or completed' });
      }

      const baseUrl = getProductionBaseUrl(req);

      const result = await handleWorkerStatusChange({
        jobId: req.params.jobId,
        assignmentId: req.params.assignmentId,
        actorUserId: req.userId,
        status,
        baseUrl,
      });

      if (!result.success) {
        return smsFailureResponse(res, result.error);
      }
      res.json(result);
    } catch (error: any) {
      console.error("Error in assignment status change:", error);
      res.status(500).json({ error: error.message || "Failed to update status" });
    }
  });

  app.post("/api/jobs/:jobId/assignments/:assignmentId/delayed", requireAuth, async (req: any, res) => {
    try {
      const { handleDelayedNotification } = await import('../services/assignmentWorkflowService');
      const { newEtaMinutes } = req.body;
      
      if (!newEtaMinutes || typeof newEtaMinutes !== 'number' || newEtaMinutes < 1) {
        return res.status(400).json({ error: 'newEtaMinutes is required and must be a positive number' });
      }

      const baseUrl = getProductionBaseUrl(req);

      const result = await handleDelayedNotification({
        jobId: req.params.jobId,
        assignmentId: req.params.assignmentId,
        actorUserId: req.userId,
        newEtaMinutes,
        baseUrl,
      });

      if (!result.success) {
        return smsFailureResponse(res, result.error);
      }
      res.json(result);
    } catch (error: any) {
      console.error("Error in delayed notification:", error);
      res.status(500).json({ error: error.message || "Failed to send delayed notification" });
    }
  });

  // A worker marks THEIR OWN part of a multi-worker job complete. This records
  // their per-assignment completion AND clocks them off (stops their running
  // timer for this job). The whole job stays open — only the lead/owner closes
  // it. When the last worker completes, the lead + owner are notified.
  app.post("/api/jobs/:id/complete-my-part", requireAuth, async (req: any, res) => {
    try {
      const jobId = req.params.id;
      const job = await storage.getJobPublic(jobId);
      if (!job) return res.status(404).json({ error: "Job not found" });

      const assignment = await storage.getJobAssignmentForUser(jobId, req.userId);
      if (!assignment) {
        return res.status(403).json({ error: "You're not assigned to this job.", code: "NOT_ASSIGNED" });
      }

      // Mark this worker's part complete (idempotent). justCompleted is true only
      // on the call that actually transitions this worker from incomplete -> complete,
      // so the "all done" notification fires exactly once.
      let justCompleted = false;
      if (!assignment.completedAt) {
        await storage.updateJobAssignment(assignment.id, { completedAt: new Date() });
        justCompleted = true;
        try {
          await storage.createAssignmentEvent({
            assignmentId: assignment.id,
            jobId,
            actorUserId: req.userId,
            eventType: 'part_completed',
          });
        } catch {}
      }

      // Clock off: stop this worker's running (non-break) timer for this job.
      let stoppedTimer = false;
      try {
        const activeForJob = await storage.getActiveTimeEntriesForJob(jobId);
        const mine = activeForJob.find((e: any) => e.userId === req.userId && !e.isBreak && !e.endTime);
        if (mine) {
          await storage.stopTimeEntry(mine.id, req.userId);
          stoppedTimer = true;
        }
      } catch (timerErr) {
        console.error("complete-my-part: failed to stop timer", timerErr);
      }

      // Recompute progress across active assignments.
      const assignments = await storage.getJobAssignments(jobId);
      const active = assignments.filter((a: any) => a.isActive !== false);
      const completed = active.filter((a: any) => a.completedAt);
      const completedCount = completed.length;
      const totalCount = active.length;
      const allComplete = totalCount > 0 && completedCount === totalCount;

      const ownerId = job.userId;

      // Notify lead + owner + managers once everyone has finished their part.
      // Gated on totalCount > 1 (this flow is for multi-worker jobs) and on
      // justCompleted so the notification is sent exactly once.
      if (allComplete && totalCount > 1 && justCompleted) {
        const primary = active.find((a: any) => a.isPrimary);
        const leadUserId = primary?.userId || job.assignedTo || null;
        const recipients = new Set<string>();
        if (leadUserId) recipients.add(leadUserId);
        if (ownerId) recipients.add(ownerId);
        // Include managers/admins of the business.
        try {
          const members = await storage.getTeamMembers(ownerId);
          for (const m of members) {
            if (!m.memberId || !m.isActive || !m.roleId) continue;
            const role = await storage.getUserRole(m.roleId);
            const rn = role?.name?.toLowerCase() || '';
            if (rn.includes('manager') || rn.includes('admin')) recipients.add(m.memberId);
          }
        } catch (mgrErr) {
          console.error("complete-my-part: failed to resolve managers", mgrErr);
        }
        for (const uid of Array.from(recipients)) {
          try {
            await storage.createNotification({
              userId: uid,
              type: 'general',
              title: 'Job ready to finish',
              message: `All workers have completed their part of "${job.title}". Review and finish the job.`,
              relatedId: jobId,
              relatedType: 'job',
            });
          } catch (notifyErr) {
            console.error("complete-my-part: failed to notify", notifyErr);
          }
        }
      }

      // Broadcast so the lead/owner's job view refreshes the X/Y progress.
      try {
        const { broadcastJobFieldUpdate } = await import('../websocket');
        const actor = await storage.getUser(req.userId);
        broadcastJobFieldUpdate(ownerId, {
          jobId,
          updatedFields: ['assignmentCompletion'],
          updatedBy: req.userId,
          updatedByName: actor?.firstName || 'Worker',
          version: (job as any).version || 0,
          serverData: { completedCount, totalCount, allComplete },
        });
      } catch (wsErr) {
        console.error("complete-my-part: broadcast failed", wsErr);
      }

      res.json({ success: true, completedCount, totalCount, allComplete, stoppedTimer });
    } catch (error: any) {
      console.error("Error in complete-my-part:", error);
      res.status(500).json({ error: error.message || "Failed to mark your part complete" });
    }
  });

  // Owner, manager (assign permission), or the current lead worker sets which
  // assigned worker is the lead (primary). Clears the flag on the others and
  // syncs jobs.assignedTo.
  app.post("/api/jobs/:jobId/assignments/:assignmentId/make-lead", requireAuth, async (req: any, res) => {
    try {
      const { jobId, assignmentId } = req.params;
      const job = await storage.getJobPublic(jobId);
      if (!job) return res.status(404).json({ error: "Job not found" });

      // Authorize: caller must belong to this job's business (prevents cross-business IDOR)
      // AND be the owner, a manager (assign permission), or the current lead worker.
      const userContext = await getUserContext(req.userId);
      if (userContext.effectiveUserId !== job.userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const assignments = await storage.getJobAssignments(jobId);
      const target = assignments.find((a: any) => a.id === assignmentId);
      if (!target) return res.status(404).json({ error: "Assignment not found" });

      const isOwner = req.userId === job.userId;
      const canAssign = hasPermission(userContext, PERMISSIONS.ASSIGN_JOBS);
      const isCurrentLead = job.assignedTo === req.userId
        || assignments.some((a: any) => a.isPrimary && a.userId === req.userId);
      if (!isOwner && !canAssign && !isCurrentLead) {
        return res.status(403).json({ error: "Only the owner, a manager, or the lead worker can change the lead." });
      }

      for (const a of assignments) {
        if (a.id === assignmentId && !a.isPrimary) {
          await storage.updateJobAssignment(a.id, { isPrimary: true });
        } else if (a.id !== assignmentId && a.isPrimary) {
          await storage.updateJobAssignment(a.id, { isPrimary: false });
        }
      }

      // Keep the legacy lead pointer (jobs.assignedTo) in sync.
      if (job.assignedTo !== target.userId) {
        await storage.updateJob(jobId, job.userId, { assignedTo: target.userId });
      }

      try {
        await storage.createAssignmentEvent({
          assignmentId,
          jobId,
          actorUserId: req.userId,
          eventType: 'made_lead',
        });
      } catch {}

      try {
        const { broadcastJobFieldUpdate } = await import('../websocket');
        const actor = await storage.getUser(req.userId);
        broadcastJobFieldUpdate(job.userId, {
          jobId,
          updatedFields: ['leadWorker', 'assignedTo'],
          updatedBy: req.userId,
          updatedByName: actor?.firstName || 'Manager',
          version: (job as any).version || 0,
          serverData: { leadUserId: target.userId },
        });
      } catch (wsErr) {
        console.error("make-lead: broadcast failed", wsErr);
      }

      res.json({ success: true, leadUserId: target.userId, leadAssignmentId: assignmentId });
    } catch (error: any) {
      console.error("Error in make-lead:", error);
      res.status(500).json({ error: error.message || "Failed to set lead worker" });
    }
  });

  app.get("/api/jobs/:jobId/assignments", requireAuth, async (req: any, res) => {
    try {
      const job = await storage.getJobPublic(req.params.jobId);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      const assignments = await storage.getJobAssignments(req.params.jobId);
      const isOwner = job.userId === req.user.id;
      const isAssignedWorker = assignments.some((a: any) => a.userId === req.user.id);
      if (!isOwner && !isAssignedWorker) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (!isOwner) {
        const ownAssignments = assignments.filter((a: any) => a.userId === req.user.id);
        return res.json(ownAssignments);
      }
      res.json(assignments);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get job assignments" });
    }
  });

  app.get("/api/jobs/:jobId/assignments/:assignmentId/details", requireAuth, async (req: any, res) => {
    try {
      const assignment = await storage.getJobAssignment(req.params.assignmentId);
      if (!assignment || assignment.jobId !== req.params.jobId) {
        return res.status(404).json({ error: 'Assignment not found' });
      }
      if (assignment.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const job = await storage.getJobPublic(req.params.jobId);
      const owner = await storage.getUser(job?.userId || '');
      const businessSettingsData = owner ? await storage.getBusinessSettings(owner.id) : null;

      res.json({
        assignmentId: assignment.id,
        jobId: assignment.jobId,
        assignmentStatus: assignment.assignmentStatus,
        displayName: assignment.displayName,
        workerName: (assignment as any).workerDisplayNameSnapshot || assignment.displayName || req.user.fullName || req.user.email,
        jobTitle: job?.title || 'Untitled Job',
        jobAddress: job?.address || '',
        scheduledDate: (job as any)?.scheduledDate || (job as any)?.scheduledAt,
        businessName: (businessSettingsData as any)?.businessName || owner?.firstName || 'Business',
        businessLogo: (businessSettingsData as any)?.logoUrl || null,
        acceptedAt: assignment.acceptedAt,
        hasSignature: !!(assignment as any).acceptanceSignatureData,
        confidentialityAgreed: (assignment as any).confidentialityAgreed,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch assignment details' });
    }
  });

  app.post("/api/jobs/:jobId/assignments/:assignmentId/accept", requireAuth, async (req: any, res) => {
    try {
      const { signature_data, signer_name, confidentiality_agreed } = req.body;
      const assignment = await storage.getJobAssignment(req.params.assignmentId);
      if (!assignment || assignment.jobId !== req.params.jobId) {
        return res.status(404).json({ error: 'Assignment not found' });
      }
      if (assignment.userId !== req.user.id) {
        return res.status(403).json({ error: 'Only the assigned worker can accept' });
      }
      if (!['assigned', 'invited'].includes(assignment.assignmentStatus || '')) {
        return res.status(400).json({ error: 'Assignment cannot be accepted in current status' });
      }

      if (!signature_data || !signature_data.startsWith('data:image/')) {
        return res.status(400).json({ error: 'A valid signature is required to accept this assignment' });
      }
      if (!confidentiality_agreed) {
        return res.status(400).json({ error: 'You must agree to the confidentiality terms to accept' });
      }

      const clientIp = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      const signerNameFinal = (signer_name || req.user.fullName || req.user.email || 'Worker').trim();

      await storage.updateJobAssignment(assignment.id, { 
        assignmentStatus: 'accepted',
        acceptedAt: new Date(),
        acceptedByName: signerNameFinal,
        acceptanceSignatureData: signature_data,
        confidentialityAgreed: true,
        acceptanceIpAddress: clientIp,
        acceptanceUserAgent: userAgent,
      });

      try {
        await storage.createDigitalSignature({
          assignmentId: assignment.id,
          jobId: req.params.jobId,
          signerName: signerNameFinal,
          signerRole: 'worker',
          signatureData: signature_data,
          signedAt: new Date(),
          ipAddress: clientIp,
          userAgent: userAgent,
          documentType: 'assignment_acceptance',
          isValid: true,
        });
      } catch (sigError) {
        console.error('[Assignment Accept] Error saving digital signature:', sigError);
      }

      await storage.createAssignmentEvent({
        assignmentId: assignment.id,
        jobId: req.params.jobId,
        actorUserId: req.user.id,
        eventType: 'assignment_accepted',
        eventData: { 
          timestamp: new Date().toISOString(),
          signerName: signerNameFinal,
          confidentialityAgreed: true,
          hasSignature: true,
        },
      });
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to accept assignment' });
    }
  });

  app.post("/api/jobs/:jobId/assignments/:assignmentId/decline", requireAuth, async (req: any, res) => {
    try {
      const assignment = await storage.getJobAssignment(req.params.assignmentId);
      if (!assignment || assignment.jobId !== req.params.jobId) {
        return res.status(404).json({ error: 'Assignment not found' });
      }
      if (assignment.userId !== req.user.id) {
        return res.status(403).json({ error: 'Only the assigned worker can decline' });
      }
      if (!['assigned', 'invited'].includes(assignment.assignmentStatus || '')) {
        return res.status(400).json({ error: 'Assignment cannot be declined in current status' });
      }
      
      await storage.updateJobAssignment(assignment.id, { 
        assignmentStatus: 'declined',
        isActive: false,
      });
      
      await storage.createAssignmentEvent({
        assignmentId: assignment.id,
        jobId: req.params.jobId,
        actorUserId: req.user.id,
        eventType: 'assignment_declined',
        eventData: { 
          timestamp: new Date().toISOString(),
          reason: req.body.reason || null,
        },
      });
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to decline assignment' });
    }
  });

  app.get("/api/jobs/:jobId/assignment-signatures", requireAuth, async (req: any, res) => {
    try {
      const job = await storage.getJobPublic(req.params.jobId);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      if (job.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      const signatures = await storage.getDigitalSignaturesByJobId(req.params.jobId);
      const assignmentSignatures = signatures.filter((s: any) => s.documentType === 'assignment_acceptance');
      res.json(assignmentSignatures);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch signatures' });
    }
  });

  app.get("/api/jobs/:jobId/assignments/:assignmentId/events", requireAuth, async (req: any, res) => {
    try {
      const assignment = await storage.getJobAssignment(req.params.assignmentId);
      if (!assignment || assignment.jobId !== req.params.jobId) {
        return res.status(404).json({ error: 'Assignment not found' });
      }
      
      const events = await storage.getAssignmentEvents(req.params.assignmentId);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to get events' });
    }
  });

  app.post("/api/jobs/:id/running-late", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const job = await storage.getJob(req.params.id, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (!job.clientId) {
        return res.status(400).json({ error: "Job has no associated client" });
      }

      const client = await storage.getClient(job.clientId, userContext.effectiveUserId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      if (!client.phone) {
        return res.status(400).json({ error: "Client has no phone number for SMS notification" });
      }

      const business = await storage.getBusinessSettings(userContext.effectiveUserId);
      const businessName = business?.businessName || 'Your tradesperson';
      const user = await storage.getUser(req.userId);
      const tradieName = user?.firstName || businessName;

      const { customMessage, latitude, longitude } = req.body;

      // Calculate real ETA if GPS coordinates provided
      let etaText = 'will be there as soon as possible';
      if (latitude && longitude && job.address) {
        try {
          let jobLat = job.latitude ? parseFloat(String(job.latitude)) : null;
          let jobLng = job.longitude ? parseFloat(String(job.longitude)) : null;
          if (!jobLat || !jobLng) {
            const geocoded = await geocodeAddress(job.address);
            if (geocoded) { jobLat = geocoded.latitude; jobLng = geocoded.longitude; }
          }
          if (jobLat && jobLng) {
            const routeETA = await calculateRouteETA(parseFloat(String(latitude)), parseFloat(String(longitude)), jobLat, jobLng);
            if (routeETA) {
              etaText = `should be there in about ${routeETA.durationMinutes} minutes`;
            } else {
              const dist = haversineDistance(parseFloat(String(latitude)), parseFloat(String(longitude)), jobLat, jobLng);
              const mins = dist <= 5 ? Math.max(Math.ceil(dist * 3), 3) : dist <= 20 ? Math.ceil(dist * 2.5) : Math.ceil(dist * 2);
              etaText = `should be there in about ${mins} minutes`;
            }
          }
        } catch (e) { console.log('[RunningLate] ETA calc failed:', e); }
      }

      let baseMessage = customMessage || `Hi ${client.name || 'there'}, ${tradieName} from ${businessName} here. Running a bit late for your job at ${job.address || 'your location'}. Apologies for the delay - ${etaText}.`;
      baseMessage = baseMessage.replace(/\n*Track arrival:[\s\S]*$/gim, '').replace(/\n*\[link will be added\][\s\S]*$/gim, '').replace(/\n*Track arrival:\s*$/gim, '').trim();
      const message = baseMessage;
      
      // Send SMS via dedicated/shared number (customer-facing)
      const { sendCustomerReply: sendCustReply } = await import('../services/smsService');
      const smsResult = await sendCustReply(client.phone, message, userContext.effectiveUserId);

      // Log activity
      await logActivity(
        userContext.effectiveUserId,
        'job_started',
        `Running Late - ${job.title || 'Job'}`,
        smsResult.success 
          ? `Running Late SMS sent to ${client.name || client.email || 'client'} at ${client.phone}`
          : `Running Late notification failed - SMS not configured`,
        'job',
        job.id,
        { 
          clientName: client.name, 
          clientPhone: client.phone,
          smsSent: smsResult.success
        }
      );

      if (!smsResult.success) {
        return smsFailureResponse(res, smsResult.error, smsResult.notConfigured);
      }

      res.json({ 
        success: true, 
        message: 'Running Late notification sent'
      });
    } catch (error: any) {
      console.error("Error sending running-late notification:", error);
      res.status(500).json({ error: error.message || "Failed to send notification" });
    }
  });

  app.post("/api/jobs/:id/quick-collect", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { quoteId, paymentMethod, amount, notes, lineItems } = req.body;
      
      // Validate inputs
      if (!paymentMethod || !amount) {
        return res.status(400).json({ error: "Missing required fields: paymentMethod, amount" });
      }
      
      const validMethods = ['cash', 'card', 'bank_transfer', 'stripe_link'];
      if (!validMethods.includes(paymentMethod)) {
        return res.status(400).json({ error: "Invalid payment method" });
      }

      // Get the job
      const job = await storage.getJob(req.params.id, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Get quote if provided
      let quote: any = null;
      if (quoteId) {
        quote = await storage.getQuote(quoteId, userContext.effectiveUserId);
        if (quote && quote.status !== 'accepted') {
          quote = null;
        }
      }

      // Get client from quote or job
      const clientId = quote?.clientId || job.clientId;
      if (!clientId) {
        return res.status(400).json({ error: "No client associated with this job" });
      }
      const client = await storage.getClient(clientId, userContext.effectiveUserId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      // Handle Stripe payment link flow
      if (paymentMethod === 'stripe_link') {
        // For stripe_link, create a payment request and send it
        try {
          const paymentRequest = await storage.createPaymentRequest({
            clientId: client.id,
            amount: amount,
            status: 'pending',
            description: notes || `Quick payment for ${job.title}`,
            userId: userContext.effectiveUserId,
            token: randomBytes(24).toString('hex'),
          });

          // Create Stripe payment link if Stripe is available
          if (isStripeInitialized()) {
            const stripe = await getUncachableStripeClient();
            if (!stripe) {
              return res.status(400).json({ error: "Stripe is not configured for payment links" });
            }
            const host = req.get('host') || 'localhost';
            const protocol = req.get('x-forwarded-proto') || (host.includes('replit') ? 'https' : 'http');
            
            const session = await stripe.checkout.sessions.create({
              mode: 'payment',
              line_items: [{
                price_data: {
                  currency: 'aud',
                  product_data: {
                    name: job.title || 'Job Payment',
                    description: `Payment for ${job.title}${job.address ? ` at ${job.address}` : ''}`,
                  },
                  unit_amount: Math.round(parseFloat(amount) * 100),
                },
                quantity: 1,
              }],
              success_url: `${protocol}://${host}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
              cancel_url: `${protocol}://${host}/jobs/${job.id}`,
              metadata: {
                jobId: job.id,
                ...(quote ? { quoteId: quote.id } : {}),
                clientId: client.id,
                paymentRequestId: paymentRequest.id,
                quickCollect: 'true',
              },
            });

            // Persist the Stripe session id on the payment request so the
            // checkout can be reconciled later (no dedicated paymentLink column;
            // the link is derived from / returned to the client directly).
            await storage.updatePaymentRequest(paymentRequest.id, userContext.effectiveUserId, {
              stripePaymentIntentId: session.id,
            });

            // Send SMS with payment link if client has phone
            if (client.phone) {
              const business = await storage.getBusinessSettings(userContext.effectiveUserId);
              const message = `Hi ${client.name || 'there'}, here's your payment link for ${job.title || 'your recent job'} from ${business?.businessName || 'your tradesperson'}: ${session.url}. Amount: $${parseFloat(amount).toFixed(2)}`;
              const { sendCustomerReply: sendCR } = await import('../services/smsService');
              await sendCR(client.phone, message, userContext.effectiveUserId);
            }

            return res.json({
              success: true,
              paymentLinkSent: true,
              paymentRequestId: paymentRequest.id,
              paymentLink: session.url,
            });
          } else {
            return res.status(400).json({ error: "Stripe is not configured for payment links" });
          }
        } catch (stripeError: any) {
          console.error("Stripe payment link error:", stripeError);
          logSystemEvent('stripe', 'error', 'payment_link_error', `Failed to create payment link: ${stripeError.message}`, { error: stripeError.message });
          return res.status(500).json({ error: `Failed to create payment link: ${stripeError.message}` });
        }
      }

      // For immediate payment methods (cash, card, bank_transfer), create invoice + receipt
      const parsedAmount = parseFloat(amount);
      const gstRate = 0.10; // Australian GST
      const gstAmount = parsedAmount - (parsedAmount / (1 + gstRate));
      const subtotal = parsedAmount - gstAmount;

      // Get line items: from quote if available, or from request body
      const quoteLineItems = quoteId && quote ? await storage.getQuoteLineItems(quoteId) : [];

      // Generate invoice number
      const existingInvoices = await storage.getInvoices(userContext.effectiveUserId);
      const year = new Date().getFullYear();
      const invoiceCount = existingInvoices.length + 1;
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const invoiceNumber = `INV${year}-${String(invoiceCount).padStart(3, '0')}-${randomSuffix}`;

      // Create invoice marked as paid and locked
      const invoiceData: any = {
        clientId: client.id,
        jobId: job.id,
        number: invoiceNumber,
        title: job.title || 'Job Payment',
        description: notes || `Quick payment collected for ${job.title}`,
        status: 'paid',
        subtotal: subtotal.toFixed(2),
        gstAmount: gstAmount.toFixed(2),
        total: parsedAmount.toFixed(2),
        dueDate: new Date(),
        sentAt: new Date(),
        paidAt: new Date(),
        lockedAt: new Date(),
        lockedReason: 'payment_received',
      };
      if (quote) {
        invoiceData.quoteId = quote.id;
      }
      const invoice = await storage.createInvoice({ ...invoiceData, userId: userContext.effectiveUserId });

      // Copy line items from quote to invoice, or use provided line items
      if (quoteLineItems.length > 0) {
        for (const item of quoteLineItems) {
          await storage.createInvoiceLineItem({
            invoiceId: invoice.id,
            itemCode: item.itemCode || null,
            description: item.description,
            quantity: String(item.quantity),
            unitPrice: item.unitPrice,
            total: item.total,
          }, userContext.effectiveUserId);
        }
      } else if (lineItems && Array.isArray(lineItems) && lineItems.length > 0) {
        for (const item of lineItems) {
          await storage.createInvoiceLineItem({
            invoiceId: invoice.id,
            itemCode: item.itemCode || null,
            description: item.description || 'Item',
            quantity: String(item.quantity || 1),
            unitPrice: String(item.unitPrice || item.total || 0),
            total: String(item.total || 0),
          }, userContext.effectiveUserId);
        }
      } else {
        await storage.createInvoiceLineItem({
          invoiceId: invoice.id,
          description: job.title || 'Job Payment',
          quantity: '1',
          unitPrice: String(parsedAmount.toFixed(2)),
          total: String(parsedAmount.toFixed(2)),
        }, userContext.effectiveUserId);
      }

      // Generate receipt number
      const existingReceipts = await storage.getReceipts(userContext.effectiveUserId);
      const receiptCount = existingReceipts.length + 1;
      const receiptNumber = `REC-${String(receiptCount).padStart(6, '0')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

      // Create receipt
      const receipt = await storage.createReceipt({
        invoiceId: invoice.id,
        clientId: client.id,
        receiptNumber: receiptNumber,
        amount: parsedAmount.toFixed(2),
        gstAmount: gstAmount.toFixed(2),
        paymentMethod: paymentMethod,
        paidAt: new Date(),
        description: notes || `Quick collect at job site`,
        userId: userContext.effectiveUserId,
      });

      // Update job status to invoiced if not already
      if (job.status === 'done') {
        await storage.updateJob(job.id, userContext.effectiveUserId, {
          status: 'invoiced',
          invoicedAt: new Date(),
        });
      }

      // Log activity
      await logActivity(
        userContext.effectiveUserId,
        'payment_received',
        `Quick Payment Collected - ${job.title || 'Job'}`,
        `$${parsedAmount.toFixed(2)} collected via ${paymentMethod} for ${client.name || client.email || 'client'}`,
        'invoice',
        invoice.id,
        {
          jobId: job.id,
          ...(quote ? { quoteId: quote.id } : {}),
          clientName: client.name || client.email,
          amount: parsedAmount,
          paymentMethod,
          quickCollect: true,
        }
      );

      res.json({
        success: true,
        invoiceId: invoice.id,
        receiptId: receipt.id,
        invoiceNumber: invoice.number,
        receiptNumber: receipt.receiptNumber,
        amount: parsedAmount,
      });
    } catch (error: any) {
      console.error("Error in quick collect payment:", error);
      res.status(500).json({ error: error.message || "Failed to collect payment" });
    }
  });

  app.delete("/api/jobs/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      // Use effectiveUserId (business owner's ID) for multi-tenant data scoping
      const effectiveUserId = req.effectiveUserId || req.userId;
      const success = await storage.deleteJob(req.params.id, effectiveUserId);
      if (!success) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting job:", error);
      res.status(500).json({ error: "Failed to delete job" });
    }
  });

  app.patch("/api/jobs/:id/worker-status", requireAuth, async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const { workerStatus, workerEta, workerEtaMinutes, latitude, longitude } = req.body;
      
      const validStatuses = ['assigned', 'on_my_way', 'arrived', 'in_progress', 'completed'];
      if (!workerStatus || !validStatuses.includes(workerStatus)) {
        return res.status(400).json({ error: 'Invalid worker status' });
      }
      
      // Validate GPS coordinates when location is provided (action-triggering endpoint)
      if (latitude !== undefined && longitude !== undefined) {
        const validation = validateAustralianCoords(
          typeof latitude === 'string' ? parseFloat(latitude) : latitude,
          typeof longitude === 'string' ? parseFloat(longitude) : longitude
        );
        if (!validation.valid) {
          return res.status(400).json({ error: `Invalid coordinates: ${validation.reason}` });
        }
      }
      
      const job = await storage.getJob(req.params.id, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Try assignment-based workflow first
      const assignment = await storage.getJobAssignmentForUser(req.params.id, req.userId);
      if (assignment) {
        const baseUrl = getProductionBaseUrl(req);

        if (workerStatus === 'on_my_way') {
          const { handleOnMyWay } = await import('../services/assignmentWorkflowService');
          const result = await handleOnMyWay({
            jobId: req.params.id,
            assignmentId: assignment.id,
            actorUserId: req.userId,
            workerLatitude: latitude,
            workerLongitude: longitude,
            baseUrl,
          });
          if (!result.success) {
            return smsFailureResponse(res, result.error);
          }
          const updatedJob = await storage.getJob(req.params.id, effectiveUserId);

          try {
            const { broadcastJobStatusChange } = await import('../websocket');
            broadcastJobStatusChange(effectiveUserId, {
              jobId: updatedJob!.id,
              status: updatedJob!.status,
              title: updatedJob!.title,
              updatedBy: req.userId,
            });
          } catch (e) {}

          try {
            const statusDescription = 'is on the way';
            if (req.userId !== effectiveUserId) {
              await notifyJobUpdate(effectiveUserId, updatedJob!.title, updatedJob!.id, statusDescription);
            }
          } catch (pushError) {
            console.error('[WorkerStatus] Push notification error:', pushError);
          }

          return res.json(updatedJob);
        } else if (['arrived', 'in_progress', 'completed'].includes(workerStatus)) {
          const { handleWorkerStatusChange } = await import('../services/assignmentWorkflowService');
          const result = await handleWorkerStatusChange({
            jobId: req.params.id,
            assignmentId: assignment.id,
            actorUserId: req.userId,
            status: workerStatus as 'arrived' | 'in_progress' | 'completed',
            baseUrl,
          });
          if (!result.success) {
            return smsFailureResponse(res, result.error);
          }
          const updatedJob = await storage.getJob(req.params.id, effectiveUserId);

          try {
            const { broadcastJobStatusChange } = await import('../websocket');
            broadcastJobStatusChange(effectiveUserId, {
              jobId: updatedJob!.id,
              status: updatedJob!.status,
              title: updatedJob!.title,
              updatedBy: req.userId,
            });
          } catch (e) {}

          if (workerStatus === 'in_progress' || workerStatus === 'completed' || workerStatus === 'arrived') {
            try {
              const client = updatedJob!.clientId ? await storage.getClient(updatedJob!.clientId, effectiveUserId) : null;
              const clientName = client?.name || 'Unknown client';
              const actor = await storage.getUser(req.userId);
              const actorName = actor ? [actor.firstName, actor.lastName].filter(Boolean).join(' ') || 'Team member' : 'Team member';

              if (workerStatus === 'arrived') {
                await storage.createNotification({
                  userId: effectiveUserId,
                  type: 'job_update',
                  title: 'Worker Arrived',
                  message: `${actorName} has arrived at "${updatedJob!.title}"`,
                  relatedId: updatedJob!.id,
                  relatedType: 'job',
                });
              } else if (workerStatus === 'in_progress') {
                await notifyJobStarted(storage, effectiveUserId, updatedJob, clientName);
              } else if (workerStatus === 'completed') {
                await notifyJobCompleted(storage, effectiveUserId, updatedJob, { firstName: actorName, username: actorName });

                try {
                  const owner = await storage.getUser(effectiveUserId);
                  if (owner?.phone) {
                    await notifyOwnerViaSms(owner.phone, 'jobCompleted', actorName || 'Team', updatedJob!.title);
                  }
                } catch (e) { console.error('Owner SMS failed:', e); }

                if (req.userId !== effectiveUserId) {
                  try {
                    const owner = await storage.getUser(effectiveUserId);
                    if (owner?.email) {
                      await sendJobCompletionNotificationEmail(
                        owner.email,
                        owner.firstName || null,
                        actorName,
                        updatedJob!.title,
                        clientName,
                        new Date(),
                        getProductionBaseUrl(req),
                        updatedJob!.id
                      );
                    }
                  } catch (emailError) {
                    console.error('Failed to send job completion email:', emailError);
                  }
                }
              }
            } catch (notifError) {
              console.error('[WorkerStatus] Error creating notifications:', notifError);
            }
          }

          try {
            const statusDescription = workerStatus === 'arrived' ? 'has arrived' :
                                     workerStatus === 'in_progress' ? 'started work' :
                                     workerStatus === 'completed' ? 'completed the job' : `status: ${workerStatus}`;

            if (req.userId !== effectiveUserId) {
              await notifyJobUpdate(effectiveUserId, updatedJob!.title, updatedJob!.id, statusDescription);
            }
          } catch (pushError) {
            console.error('[WorkerStatus] Push notification error:', pushError);
          }

          return res.json({
            ...updatedJob,
            ...(result.smsFailed ? { smsFailed: true, smsErrorCode: result.smsErrorCode } : {}),
          });
        }
      }

      // Fallback: legacy flow for jobs without assignments
      let legacySmsFailed = false;
      let legacySmsErrorCode: string | undefined;
      const updateData: any = { 
        workerStatus,
        workerStatusUpdatedAt: new Date(),
      };
      if (workerEta !== undefined) updateData.workerEta = workerEta;
      if (workerEtaMinutes !== undefined) updateData.workerEtaMinutes = workerEtaMinutes;
      
      if (workerStatus === 'in_progress' && job.status !== 'in_progress') {
        updateData.status = 'in_progress';
        updateData.startedAt = new Date();
      } else if (workerStatus === 'completed' && job.status !== 'done') {
        updateData.status = 'done';
        updateData.completedAt = new Date();
      }
      
      const updatedJob = await storage.updateJob(req.params.id, effectiveUserId, updateData);
      
      const { clearWorkerTravelLocation } = await import('../websocket');
      if (workerStatus === 'arrived' || workerStatus === 'completed') {
        clearWorkerTravelLocation(req.params.id);
      }
      
      if (workerStatus === 'on_my_way' || workerStatus === 'arrived' || workerStatus === 'completed') {
        try {
          const client = await storage.getClient(job.clientId, effectiveUserId);
          const businessSettingsData = await storage.getBusinessSettingsByUserId(effectiveUserId);
          
          if (client?.phone) {
            const { sendSmsToClient } = await import('../services/smsService');
            const businessName = businessSettingsData?.businessName || 'Your tradesperson';
            
            let workerName = 'Your tradesperson';
            if (job.assignedTo) {
              const teamMembersList = await storage.getTeamMembers(effectiveUserId);
              const assignedMember = teamMembersList.find((m: any) => m.id === job.assignedTo || m.memberId === job.assignedTo);
              if (assignedMember) {
                workerName = [assignedMember.firstName, assignedMember.lastName].filter(Boolean).join(' ') || workerName;
              }
            }
            if (workerName === 'Your tradesperson') {
              const user = await storage.getUser(effectiveUserId);
              if (user) workerName = [user.firstName, user.lastName].filter(Boolean).join(' ') || workerName;
            }
            
            let portalUrl = '';
            let activeToken = await storage.getActiveJobPortalToken(job.id);
            if (!activeToken) {
              const cryptoModule = await import('crypto');
              const token = cryptoModule.randomBytes(32).toString('hex');
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + 30);
              activeToken = await storage.createJobPortalToken({
                jobId: job.id,
                userId: effectiveUserId,
                token,
                expiresAt,
                createdBy: req.userId,
              });
              await storage.updateJob(req.params.id, effectiveUserId, { portalEnabled: true });
            }
            
            const baseUrl = getProductionBaseUrl(req);
            portalUrl = `${baseUrl}/p/${activeToken.token}`;
            
            let smsBody = '';
            const ownerPhone = businessSettingsData?.phone || '';
            const ownerName = businessName;
            
            if (workerStatus === 'on_my_way') {
              const etaText = workerEta || 'soon';
              const contactInfo = ownerPhone ? `${ownerName} on ${ownerPhone}` : ownerName;
              smsBody = `JobRunner: ${businessName} update — ${workerName} is on the way to your job "${job.title}". ETA: ${etaText}. Track progress + photos here: ${portalUrl}. Need help? Call ${contactInfo}.`;
            } else if (workerStatus === 'arrived') {
              smsBody = `JobRunner: ${businessName} update — ${workerName} has arrived at your job "${job.title}". Track progress: ${portalUrl}`;
            } else if (workerStatus === 'completed') {
              smsBody = `JobRunner: ${businessName} update — "${job.title}" has been completed by ${workerName}. View details + documents: ${portalUrl}`;
            }
            
            if (smsBody) {
              const smsMessage = await sendSmsToClient({
                businessOwnerId: effectiveUserId,
                clientId: job.clientId,
                clientPhone: client.phone,
                clientName: client.name,
                jobId: job.id,
                message: smsBody,
                senderUserId: req.userId,
                isQuickAction: true,
                quickActionType: `worker_${workerStatus}`,
              });
              if (smsMessage.status === 'failed') {
                // Status change already persisted — keep it successful but
                // surface the SMS failure so the app can show a non-blocking
                // "get your business number" prompt.
                legacySmsFailed = true;
                if (/dedicated (phone )?number/i.test(smsMessage.errorMessage || '')) {
                  legacySmsErrorCode = 'DEDICATED_NUMBER_REQUIRED';
                }
                console.error(`[WorkerStatus] SMS send failed for ${workerStatus}:`, smsMessage.errorMessage);
              } else {
                console.log(`[WorkerStatus] SMS sent to client for ${workerStatus}: ${client.phone}`);
              }
            }
          }
        } catch (smsError) {
          legacySmsFailed = true;
          console.error('[WorkerStatus] Error sending SMS:', smsError);
        }
      }
      
      res.json({
        ...updatedJob,
        ...(legacySmsFailed ? { smsFailed: true, smsErrorCode: legacySmsErrorCode } : {}),
      });
    } catch (error: any) {
      console.error('Error updating worker status:', error);
      res.status(500).json({ error: error.message || 'Failed to update worker status' });
    }
  });

  app.post("/api/jobs/:id/travel-location", requireAuth, async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const { latitude, longitude, speed, heading } = req.body;
      
      if (latitude == null || longitude == null) {
        return res.status(400).json({ error: 'Missing latitude/longitude' });
      }
      
      // Validate GPS coordinates (action-triggering endpoint - reject invalid coords)
      const validation = validateAustralianCoords(
        typeof latitude === 'string' ? parseFloat(latitude) : latitude,
        typeof longitude === 'string' ? parseFloat(longitude) : longitude
      );
      if (!validation.valid) {
        return res.status(400).json({ error: `Invalid coordinates: ${validation.reason}` });
      }
      
      const job = await storage.getJob(req.params.id, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      if (job.workerStatus !== 'on_my_way') {
        return res.status(400).json({ error: 'Travel tracking only active during on_my_way status' });
      }
      
      const { updateWorkerTravelLocation } = await import('../websocket');
      updateWorkerTravelLocation(req.params.id, latitude, longitude, speed, heading);
      
      let etaMinutes: number | null = null;
      if (job.latitude && job.longitude) {
        const jobLat = parseFloat(String(job.latitude));
        const jobLng = parseFloat(String(job.longitude));
        const workerLat = parseFloat(String(latitude));
        const workerLng = parseFloat(String(longitude));
        
        const R = 6371;
        const dLat = (jobLat - workerLat) * Math.PI / 180;
        const dLon = (jobLng - workerLng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(workerLat * Math.PI / 180) * Math.cos(jobLat * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distanceKm = R * c;
        
        const avgSpeedKmh = (speed && speed > 5) ? speed : 40;
        etaMinutes = Math.max(1, Math.round((distanceKm / avgSpeedKmh) * 60));
        
        await storage.updateJob(req.params.id, effectiveUserId, {
          workerEtaMinutes: etaMinutes,
        });

        // Auto-arrival: when the worker's live pings show them within ~100m of
        // the job site while still on_my_way, flip the assignment to "arrived"
        // (client SMS + portal step + worker state) and notify the owner. This
        // is one-shot: handleWorkerStatusChange sets workerStatus='arrived',
        // and this endpoint rejects further pings once status leaves on_my_way.
        if (distanceKm <= 0.1) {
          try {
            const assignment = await storage.getJobAssignmentForUser(req.params.id, req.userId);
            if (!assignment) {
              // No assignment row (job-level On My Way, e.g. solo owner): flip
              // the job's workerStatus directly so the portal moves to Arrived.
              await storage.updateJob(req.params.id, effectiveUserId, {
                workerStatus: 'arrived',
                workerStatusUpdatedAt: new Date(),
                workerEtaMinutes: 0,
              });
              try {
                const { clearWorkerTravelLocation } = await import('../websocket');
                clearWorkerTravelLocation(req.params.id);
              } catch {}
              const { sendPushNotification } = await import('../pushNotifications');
              if (effectiveUserId !== req.userId) {
                sendPushNotification({
                  userId: effectiveUserId,
                  type: 'job_update',
                  title: 'Worker arrived on site',
                  body: `A worker has arrived at "${job.title}".`,
                  data: { jobId: req.params.id, event: 'worker_arrived' },
                }).catch(() => {});
              }
              sendPushNotification({
                userId: req.userId,
                type: 'job_update',
                title: "You've arrived",
                body: `You're at "${job.title}". Tap to start your timer.`,
                data: { jobId: req.params.id, event: 'arrival_start_timer' },
              }).catch(() => {});
              return res.json({ success: true, etaMinutes: 0, arrived: true });
            }
            if (assignment && assignment.assignmentStatus !== 'arrived') {
              const { handleWorkerStatusChange } = await import('../services/assignmentWorkflowService');
              const baseUrl = getProductionBaseUrl(req);
              const result = await handleWorkerStatusChange({
                jobId: req.params.id,
                assignmentId: assignment.id,
                actorUserId: req.userId,
                status: 'arrived',
                baseUrl,
              });
              if (result.success) {
                const { sendPushNotification } = await import('../pushNotifications');
                const worker = await storage.getUser(req.userId);
                const workerName = assignment.workerDisplayNameSnapshot ||
                  (worker ? [worker.firstName, worker.lastName].filter(Boolean).join(' ') : 'A worker');
                // Notify the business owner (skip if the worker IS the owner)
                if (effectiveUserId !== req.userId) {
                  sendPushNotification({
                    userId: effectiveUserId,
                    type: 'job_update',
                    title: 'Worker arrived on site',
                    body: `${workerName} has arrived at "${job.title}".`,
                    data: { jobId: req.params.id, event: 'worker_arrived' },
                  }).catch(() => {});
                }
                // Prompt the worker to start their timer
                sendPushNotification({
                  userId: req.userId,
                  type: 'job_update',
                  title: "You've arrived",
                  body: `You're at "${job.title}". Tap to start your timer.`,
                  data: { jobId: req.params.id, event: 'arrival_start_timer' },
                }).catch(() => {});
                return res.json({ success: true, etaMinutes: 0, arrived: true });
              }
            }
          } catch (arrivalError) {
            console.error('[AutoArrival] Failed to auto-mark arrived:', arrivalError);
          }
        }
      }
      
      res.json({ success: true, etaMinutes });
    } catch (error: any) {
      console.error('Error updating travel location:', error);
      res.status(500).json({ error: error.message || 'Failed to update travel location' });
    }
  });

  app.get("/api/jobs/:id/portal-link", requireAuth, async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const job = await storage.getJob(req.params.id, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      const baseUrl = getProductionBaseUrl(req);
      let activeToken = await storage.getActiveJobPortalToken(job.id);
      if (!activeToken) {
        const cryptoModule = await import('crypto');
        const tokenStr = cryptoModule.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        activeToken = await storage.createJobPortalToken({
          jobId: job.id,
          userId: effectiveUserId,
          token: tokenStr,
          expiresAt,
          createdBy: req.userId,
        });
        await storage.updateJob(req.params.id, effectiveUserId, { portalEnabled: true });
      }
      return res.redirect(`${baseUrl}/p/${activeToken.token}`);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to get portal link' });
    }
  });

  app.post("/api/jobs/:id/portal-link", requireAuth, async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const job = await storage.getJob(req.params.id, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      let activeToken = await storage.getActiveJobPortalToken(job.id);
      if (activeToken) {
        const baseUrl = getProductionBaseUrl(req);
        return res.json({ 
          token: activeToken,
          url: `${baseUrl}/p/${activeToken.token}`,
        });
      }
      
      const cryptoModule = await import('crypto');
      const token = cryptoModule.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      const portalToken = await storage.createJobPortalToken({
        jobId: job.id,
        userId: effectiveUserId,
        token,
        expiresAt,
        createdBy: req.userId,
      });
      
      await storage.updateJob(req.params.id, effectiveUserId, { portalEnabled: true });
      
      const baseUrl = getProductionBaseUrl(req);
      
      res.json({
        token: portalToken,
        url: `${baseUrl}/p/${portalToken.token}`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create portal link' });
    }
  });

  app.delete("/api/jobs/:id/portal-link/:tokenId", requireAuth, async (req: any, res) => {
    try {
      await storage.revokeJobPortalToken(req.params.tokenId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to revoke portal link' });
    }
  });

  app.get("/api/jobs/:id/portal-links", requireAuth, async (req: any, res) => {
    try {
      const tokens = await storage.getJobPortalTokensByJobId(req.params.id);
      const baseUrl = getProductionBaseUrl(req);
      const withUrls = (tokens || []).map((t: any) => ({
        ...t,
        url: `${baseUrl}/p/${t.token}`,
      }));
      res.json(withUrls);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to get portal links' });
    }
  });

  app.patch("/api/jobs/:id/portal-settings", requireAuth, async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const job = await storage.getJob(req.params.id, effectiveUserId);
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const settingsSchema = z.object({
        showTimeline: z.boolean().optional(),
        showPhotos: z.boolean().optional(),
        showChecklist: z.boolean().optional(),
        showActivityFeed: z.boolean().optional(),
        showFinancialsOnPortal: z.boolean().optional(),
        clientMessage: z.string().max(500).nullable().optional(),
      });

      const parsed = settingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid settings', details: parsed.error.errors });
      }

      const activeToken = await storage.getActiveJobPortalToken(job.id);
      if (!activeToken) {
        return res.status(404).json({ error: 'No active portal link found for this job' });
      }

      const updated = await storage.updateJobPortalTokenSettings(activeToken.id, parsed.data);
      res.json(updated || activeToken);
    } catch (error: any) {
      console.error('Error updating portal settings:', error);
      res.status(500).json({ error: error.message || 'Failed to update portal settings' });
    }
  });

  app.post("/api/jobs/:id/share-portal-sms", requireAuth, requirePaidTierForSms, async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const job = await storage.getJob(req.params.id, effectiveUserId);
      if (!job) return res.status(404).json({ error: 'Job not found' });

      let activeToken = await storage.getActiveJobPortalToken(job.id);
      if (!activeToken) {
        const crypto = await import('crypto');
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        activeToken = await storage.createJobPortalToken({
          jobId: job.id,
          userId: effectiveUserId,
          token,
          expiresAt,
          createdBy: req.userId,
        });
        await storage.updateJob(req.params.id, effectiveUserId, { portalEnabled: true });
      }

      if (!job.clientId) return res.status(400).json({ error: 'No client assigned to this job' });
      const client = await storage.getClient(job.clientId, effectiveUserId);
      if (!client?.phone) return res.status(400).json({ error: 'Client has no phone number' });

      const settings = await storage.getBusinessSettings(effectiveUserId);
      const businessName = settings?.businessName || 'Your tradesperson';

      const baseUrl = getProductionBaseUrl(req);
      const portalUrl = `${baseUrl}/p/${activeToken.token}`;

      const { sendCustomerReply: sendCustReply2 } = await import('../services/smsService');
      const smsResult = await sendCustReply2(client.phone, `Hi ${client.name}, track your job "${job.title}" live here: ${portalUrl}\n- ${businessName}`, effectiveUserId);

      if (!smsResult.success) {
        return res.status(500).json({ error: smsResult.error || 'Failed to send SMS' });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to send tracking link' });
    }
  });

  app.post("/api/jobs/:id/share-portal-email", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const job = await storage.getJob(req.params.id, effectiveUserId);
      if (!job) return res.status(404).json({ error: 'Job not found' });

      let activeToken = await storage.getActiveJobPortalToken(job.id);
      if (!activeToken) {
        const crypto = await import('crypto');
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        activeToken = await storage.createJobPortalToken({
          jobId: job.id,
          userId: effectiveUserId,
          token,
          expiresAt,
          createdBy: req.userId,
        });
        await storage.updateJob(req.params.id, effectiveUserId, { portalEnabled: true });
      }

      if (!job.clientId) return res.status(400).json({ error: 'No client assigned to this job' });
      const client = await storage.getClient(job.clientId, effectiveUserId);
      if (!client?.email) return res.status(400).json({ error: 'Client has no email address' });

      const settings = await storage.getBusinessSettings(effectiveUserId);
      const businessName = settings?.businessName || 'Your tradesperson';

      const baseUrl = getProductionBaseUrl(req);
      const portalUrl = `${baseUrl}/p/${activeToken.token}`;

      const { sendEmail } = await import('../emailService');
      const emailResult = await sendEmail({
        to: client.email,
        subject: `Track your job: ${job.title} - ${escapeHtml(businessName)}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Hi ${client.name},</h2>
            <p style="color: #555; font-size: 16px;">You can track the progress of your job "<strong>${job.title}</strong>" using the link below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${portalUrl}" style="background-color: #2563EB; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Track Your Job</a>
            </div>
            <p style="color: #888; font-size: 14px;">This link gives you live updates on your job status, photos, and documents.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="color: #999; font-size: 12px;">Sent by ${escapeHtml(businessName)} via JobRunner</p>
          </div>
        `,
        fromName: businessName,
      });

      if (!emailResult.success) {
        return res.status(500).json({ error: emailResult.error || 'Failed to send tracking email' });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to send tracking email' });
    }
  });

  app.get("/api/jobs/:jobId/checklist", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const items = await storage.getChecklistItems(req.params.jobId, userContext.effectiveUserId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching checklist items:", error);
      res.status(500).json({ error: "Failed to fetch checklist items" });
    }
  });

  app.post("/api/jobs/:jobId/checklist", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const data = insertChecklistItemSchema.parse({
        ...req.body,
        jobId: req.params.jobId
      });
      const item = await storage.createChecklistItem(data, userContext.effectiveUserId);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid checklist item data", details: error.errors });
      }
      if (error instanceof Error && error.message === "Job not found or access denied") {
        return res.status(404).json({ error: "Job not found" });
      }
      console.error("Error creating checklist item:", error);
      res.status(500).json({ error: "Failed to create checklist item" });
    }
  });

  app.post("/api/jobs/:id/generate-quote", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_QUOTES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const job = await storage.getJob(req.params.id, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Generate quote number
      const quoteNumber = await storage.generateQuoteNumber(userContext.effectiveUserId);
      
      // Create quote from job data
      const quoteData = insertQuoteSchema.parse({
        clientId: job.clientId,
        jobId: job.id,
        number: quoteNumber,
        title: `Quote for ${job.title}`,
        description: job.description || '',
        status: 'draft',
        subtotal: '0.00',
        gstAmount: '0.00',
        total: '0.00'
      });

      const quote = await storage.createQuote({ ...quoteData, userId: userContext.effectiveUserId });
      const quoteWithItems = await storage.getQuoteWithLineItems(quote.id, userContext.effectiveUserId);
      
      res.status(201).json(quoteWithItems);
    } catch (error) {
      console.error("Error generating quote from job:", error);
      res.status(500).json({ error: "Failed to generate quote from job" });
    }
  });

  app.get("/api/jobs/:jobId/invoices", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_INVOICES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const allInvoices = await storage.getInvoices(userContext.effectiveUserId);
      const jobInvoices = allInvoices
        .filter((inv: any) => inv.jobId === req.params.jobId)
        .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .map((inv: any) => ({
          id: inv.id,
          number: inv.number,
          title: inv.title,
          status: inv.status,
          total: inv.total,
          createdAt: inv.createdAt,
          paidAt: inv.paidAt,
          stripePaymentLink: inv.stripePaymentLink,
          paymentToken: inv.paymentToken,
        }));
      res.json(jobInvoices);
    } catch (error) {
      console.error("Error fetching job invoices:", error);
      res.status(500).json({ error: "Failed to fetch job invoices" });
    }
  });

  app.get("/api/jobs/:id/receipts", requireAuth, async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const jobReceipts = await storage.getReceiptsForJob(req.params.id, effectiveUserId);
      res.json(jobReceipts);
    } catch (error) {
      console.error("Error fetching job receipts:", error);
      res.status(500).json({ error: "Failed to fetch job receipts" });
    }
  });

  app.get("/api/jobs/:id/profitability", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id: jobId } = req.params;
      
      // Get job details
      const job = await storage.getJob(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Get client info
      let client = null;
      try {
        if (job.clientId) {
          client = await storage.getClientById(job.clientId);
        }
      } catch (e) {}

      // Get quoted amount
      const allQuotes = await storage.getQuotes(userId);
      const jobQuote = allQuotes.find(q => q.jobId === jobId && (q.status === 'accepted' || q.status === 'sent'));
      const quotedAmount = jobQuote ? parseFloat(jobQuote.total || '0') : null;

      // Get job revenue (from invoices)
      const invoices = await storage.getInvoices(userId);
      const jobInvoices = invoices.filter(invoice => invoice.jobId === jobId);
      const totalRevenue = jobInvoices.reduce((sum, invoice) => {
        return sum + (invoice.status === 'paid' ? parseFloat(invoice.total || '0') : 0);
      }, 0);
      const pendingRevenue = jobInvoices.filter(inv => inv.status === 'sent').reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);

      // Approved variation revenue (adds to revised contract value, shown separately)
      let approvedVariationsTotal = 0;
      let pendingVariationsTotal = 0;
      let approvedVariationsCount = 0;
      let pendingVariationsCount = 0;
      try {
        const jobVariationsData = await storage.getJobVariations(jobId, userId);
        for (const v of jobVariationsData) {
          if (v.status === 'approved') {
            approvedVariationsTotal += parseFloat(v.totalAmount || '0');
            approvedVariationsCount++;
          } else if (v.status === 'sent') {
            pendingVariationsTotal += parseFloat(v.totalAmount || '0');
            pendingVariationsCount++;
          }
        }
      } catch (_) {}

      // Get job expenses
      const expenses = await storage.getExpenses(userId, { jobId });
      const materialExpenses = expenses.filter(e => e.category === 'materials');
      const nonMaterialExpensesList = expenses.filter(e => e.category !== 'materials');
      const materialExpenseCost = materialExpenses.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);
      const nonMaterialExpenses = nonMaterialExpensesList.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);

      // Get materials from job_materials table
      let jobMaterials: any[] = [];
      let materialsCostFromTable = 0;
      let materialsPriceFromTable = 0; // marked-up sell price
      try {
        jobMaterials = await storage.getJobMaterials(jobId, userId);
        materialsCostFromTable = jobMaterials.reduce((sum, m) => sum + parseFloat(m.totalCost?.toString() || '0'), 0);
        // totalPrice is the sell price (cost + markup). Fall back to totalCost if not set.
        materialsPriceFromTable = jobMaterials.reduce((sum, m) => {
          const price = parseFloat(m.totalPrice?.toString() || '0');
          const cost = parseFloat(m.totalCost?.toString() || '0');
          return sum + (price > 0 ? price : cost);
        }, 0);
      } catch (e) { /* no materials */ }

      const totalMaterialsCost = materialExpenseCost + materialsCostFromTable;
      // Markup captured = difference between what we charge and what we paid for materials
      const markupCaptured = Math.max(0, materialsPriceFromTable - materialsCostFromTable);

      // Get time tracking costs — separate subcontractor vs employee labour
      const allTimeEntries = await storage.getTimeEntries(userId, jobId);
      const completedEntries = allTimeEntries.filter(entry => entry.endTime);

      const allTeamMembers = await storage.getTeamMembers(userId);
      const subcontractorUserIds = new Set<string>();
      for (const member of allTeamMembers) {
        if (member.roleId) {
          try {
            const role = await storage.getUserRole(member.roleId);
            if (role?.name?.toLowerCase().includes('subcontractor')) {
              if (member.memberId) subcontractorUserIds.add(member.memberId);
              subcontractorUserIds.add(member.id);
            }
          } catch (e) {}
        }
      }

      const employeeEntries = completedEntries.filter(entry => !subcontractorUserIds.has(entry.userId));
      const subcontractorEntries = completedEntries.filter(entry => subcontractorUserIds.has(entry.userId));

      const calcEntryCost = (entry: any) => {
        const hours = (new Date(entry.endTime!).getTime() - new Date(entry.startTime).getTime()) / (1000 * 60 * 60);
        return hours * parseFloat(entry.hourlyRate?.toString() || '0');
      };

      const employeeLaborCost = employeeEntries.reduce((sum, entry) => sum + calcEntryCost(entry), 0);
      const subcontractorTimeCost = subcontractorEntries.reduce((sum, entry) => sum + calcEntryCost(entry), 0);

      const subcontractorExpenses = expenses.filter(e => {
        const desc = (e.description || '').toLowerCase();
        const cat = ((e as any).category || (e as any).categoryName || '').toLowerCase();
        return cat.includes('subcontractor') || desc.includes('subcontractor');
      });
      const subcontractorExpenseCost = subcontractorExpenses.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);

      const totalSubcontractorCost = subcontractorTimeCost + subcontractorExpenseCost;
      const nonSubNonMaterialExpenses = nonMaterialExpenses - subcontractorExpenseCost;
      const totalLaborCost = employeeLaborCost;

      // Hours breakdown
      const totalHours = completedEntries.reduce((sum, entry) => {
        return sum + (new Date(entry.endTime!).getTime() - new Date(entry.startTime).getTime()) / (1000 * 60 * 60);
      }, 0);
      const billableHours = completedEntries.filter(e => e.isBillable !== false).reduce((sum, entry) => {
        return sum + (new Date(entry.endTime!).getTime() - new Date(entry.startTime).getTime()) / (1000 * 60 * 60);
      }, 0);
      const nonBillableHours = totalHours - billableHours;

      const totalCosts = nonSubNonMaterialExpenses + totalMaterialsCost + totalLaborCost + totalSubcontractorCost;
      const profit = totalRevenue - totalCosts;
      const profitMargin = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 1000) / 10 : 0;

      // Budget vs actual
      // Treat budgetedCost=0 as "no budget set" — a $0 budget is not meaningful
      // and would cause division-by-zero in percentUsed.
      const rawBudget = (job as any).budgetedCost;
      const budgetedCost = (rawBudget !== null && rawBudget !== undefined)
        ? parseFloat(rawBudget)
        : null;
      const hasBudget = budgetedCost !== null && !isNaN(budgetedCost) && budgetedCost > 0;
      const budgetVariance = hasBudget ? totalCosts - budgetedCost! : null;
      const budgetTrafficLight = hasBudget
        ? totalCosts <= budgetedCost! * 0.9 ? 'green'
          : totalCosts <= budgetedCost! * 1.05 ? 'amber'
          : 'red'
        : null;

      // Historical comparison: last 5 jobs of same title pattern (by first word/type)
      let historicalComparison: { avgMargin: number; jobCount: number; jobType: string } | null = null;
      try {
        const allJobs = await storage.getJobs(userId);
        const titleWords = job.title.split(/\s+/).slice(0, 2).join(' ').toLowerCase();
        const similarCompleted = allJobs.filter((j: any) =>
          j.id !== jobId &&
          (j.status === 'done' || j.status === 'invoiced') &&
          j.title.toLowerCase().startsWith(titleWords)
        ).slice(-5);
        if (similarCompleted.length >= 2) {
          // For each similar job, get its invoices to compute rough margin
          const allInvoices = await storage.getInvoices(userId);
          const margins: number[] = [];
          for (const sj of similarCompleted) {
            const sjRevenue = allInvoices
              .filter((i: any) => i.jobId === sj.id && i.status === 'paid')
              .reduce((s: number, i: any) => s + parseFloat(i.total || '0'), 0);
            if (sjRevenue > 0) {
              // Rough margin using only invoice total vs material cost from expenses
              const sjExpenses = await storage.getExpenses(userId, { jobId: sj.id });
              const sjCost = sjExpenses.reduce((s: number, e: any) => s + parseFloat(e.amount || '0'), 0);
              // Add labour cost from time entries
              try {
                const sjTime = await storage.getTimeEntries(userId, sj.id);
                const sjLabour = sjTime
                  .filter((e: any) => e.endTime)
                  .reduce((s: number, e: any) => {
                    const hrs = (new Date(e.endTime).getTime() - new Date(e.startTime).getTime()) / 3600000;
                    return s + hrs * parseFloat(e.hourlyRate?.toString() || '0');
                  }, 0);
                const sjProfit = sjRevenue - (sjCost + sjLabour);
                margins.push(Math.round((sjProfit / sjRevenue) * 1000) / 10);
              } catch (_) {
                const sjProfit = sjRevenue - sjCost;
                margins.push(Math.round((sjProfit / sjRevenue) * 1000) / 10);
              }
            }
          }
          if (margins.length >= 2) {
            const avgMargin = Math.round((margins.reduce((s, m) => s + m, 0) / margins.length) * 10) / 10;
            historicalComparison = { avgMargin, jobCount: margins.length, jobType: titleWords };
          }
        }
      } catch (_) { /* historical comparison is best-effort */ }

      // Effective markup settings for this job
      let businessMarkupSettings: any = {};
      try {
        const biz = await storage.getBusinessSettings(userId);
        if (biz) {
          businessMarkupSettings = {
            defaultMaterialMarkupPct: parseFloat(String((biz as any).defaultMaterialMarkupPct ?? '20')),
            defaultEquipmentMarkupPct: parseFloat(String((biz as any).defaultEquipmentMarkupPct ?? '15')),
            defaultSubcontractorMarkupPct: parseFloat(String((biz as any).defaultSubcontractorMarkupPct ?? '10')),
          };
        }
      } catch (_) {}

      res.json({
        jobId,
        jobTitle: job.title,
        jobStatus: job.status,
        clientName: client ? `${(client as any).firstName || ''} ${(client as any).lastName || ''}`.trim() : null,
        quoted: {
          amount: quotedAmount,
          gst: jobQuote ? parseFloat((jobQuote as any).gstAmount || '0') : null,
          quoteNumber: jobQuote?.number || null,
          revisedContractValue: quotedAmount !== null ? Math.round((quotedAmount + approvedVariationsTotal) * 100) / 100 : null,
        },
        revenue: {
          invoiced: totalRevenue,
          pending: pendingRevenue,
          received: totalRevenue,
        },
        variations: {
          approvedTotal: Math.round(approvedVariationsTotal * 100) / 100,
          approvedCount: approvedVariationsCount,
          pendingTotal: Math.round(pendingVariationsTotal * 100) / 100,
          pendingCount: pendingVariationsCount,
        },
        costs: {
          labour: Math.round(totalLaborCost * 100) / 100,
          subcontractor: Math.round(totalSubcontractorCost * 100) / 100,
          materials: Math.round(totalMaterialsCost * 100) / 100,
          materialsSellPrice: Math.round(materialsPriceFromTable * 100) / 100,
          otherExpenses: Math.round(nonSubNonMaterialExpenses * 100) / 100,
          total: Math.round(totalCosts * 100) / 100,
        },
        markup: {
          captured: Math.round(markupCaptured * 100) / 100,
          materialMarkupPct: (job as any).materialMarkupPct !== null && (job as any).materialMarkupPct !== undefined ? parseFloat((job as any).materialMarkupPct) : null,
          equipmentMarkupPct: (job as any).equipmentMarkupPct !== null && (job as any).equipmentMarkupPct !== undefined ? parseFloat((job as any).equipmentMarkupPct) : null,
          subcontractorMarkupPct: (job as any).subcontractorMarkupPct !== null && (job as any).subcontractorMarkupPct !== undefined ? parseFloat((job as any).subcontractorMarkupPct) : null,
          ...businessMarkupSettings,
        },
        budget: hasBudget ? {
          budgetedCost: Math.round(budgetedCost! * 100) / 100,
          actualCost: Math.round(totalCosts * 100) / 100,
          variance: Math.round((budgetVariance ?? 0) * 100) / 100,
          trafficLight: budgetTrafficLight,
          // percentUsed is always finite here because budgetedCost > 0 is enforced above
          percentUsed: Math.round((totalCosts / budgetedCost!) * 1000) / 10,
        } : null,
        profit: {
          amount: Math.round(profit * 100) / 100,
          margin: Math.round(profitMargin * 10) / 10,
          vsQuote: quotedAmount !== null ? Math.round((quotedAmount - totalCosts - profit) * 100) / 100 : null,
          isNegative: profit < 0,
        },
        hours: {
          total: Math.round(totalHours * 10) / 10,
          billable: Math.round(billableHours * 10) / 10,
          nonBillable: Math.round(nonBillableHours * 10) / 10,
        },
        status: profitMargin > 15 ? 'profitable' : profitMargin > 5 ? 'tight' : 'loss',
        historicalComparison,
        expenses: expenses.map(expense => ({
          id: expense.id,
          description: expense.description,
          amount: parseFloat(expense.amount || '0'),
          category: expense.categoryName || 'Uncategorized',
          date: expense.expenseDate,
          receiptUrl: expense.receiptUrl
        })),
        timeEntries: completedEntries.map(entry => ({
          id: entry.id,
          description: entry.description,
          hours: ((new Date(entry.endTime!).getTime() - new Date(entry.startTime).getTime()) / (1000 * 60 * 60)).toFixed(2),
          rate: entry.hourlyRate,
          cost: ((new Date(entry.endTime!).getTime() - new Date(entry.startTime).getTime()) / (1000 * 60 * 60)) * parseFloat(entry.hourlyRate?.toString() || '0'),
          date: entry.startTime
        })),
        materials: jobMaterials.map(m => ({
          id: m.id,
          name: m.name,
          quantity: m.quantity,
          unitCost: m.unitCost,
          unitPrice: m.unitPrice,
          totalCost: parseFloat(m.totalCost?.toString() || '0'),
          totalPrice: parseFloat(m.totalPrice?.toString() || '0'),
          markupPercent: m.markupPercent,
          supplier: m.supplier,
          status: m.status,
        })),
        retentionSummary: await (async () => {
          try {
            const allClaims = await storage.getClaims(jobId, userId);
            return computeRetentionSummary(allClaims, {
              practicalCompletionDate: (job as any).practicalCompletionDate || null,
              defectsLiabilityMonths: (job as any).defectsLiabilityMonths ?? null,
            });
          } catch (_) {
            return null;
          }
        })(),
      });
    } catch (error) {
      console.error("Get job profitability error:", error);
      res.status(500).json({ error: "Failed to fetch job profitability" });
    }
  });

  // Per-job markup override settings
  // Per-job markup and budget override — requires WRITE_JOBS permission (same as PATCH /api/jobs/:id)
  app.patch("/api/jobs/:id/markup", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id: jobId } = req.params;
      const userContext = await getUserContext(userId);
      const effectiveUserId = userContext.effectiveUserId;

      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) return res.status(404).json({ error: "Job not found" });

      const schema = z.object({
        materialMarkupPct: z.number().min(0).max(500).nullable().optional(),
        equipmentMarkupPct: z.number().min(0).max(500).nullable().optional(),
        subcontractorMarkupPct: z.number().min(0).max(500).nullable().optional(),
        budgetedCost: z.number().min(0).nullable().optional(),
      });

      const parsed = schema.parse(req.body);
      const updateFields: Record<string, any> = {};
      // Use explicit key-presence checks so that 0 is preserved as a valid value
      if (Object.prototype.hasOwnProperty.call(parsed, 'materialMarkupPct')) {
        updateFields.materialMarkupPct = parsed.materialMarkupPct !== null && parsed.materialMarkupPct !== undefined ? String(parsed.materialMarkupPct) : null;
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'equipmentMarkupPct')) {
        updateFields.equipmentMarkupPct = parsed.equipmentMarkupPct !== null && parsed.equipmentMarkupPct !== undefined ? String(parsed.equipmentMarkupPct) : null;
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'subcontractorMarkupPct')) {
        updateFields.subcontractorMarkupPct = parsed.subcontractorMarkupPct !== null && parsed.subcontractorMarkupPct !== undefined ? String(parsed.subcontractorMarkupPct) : null;
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'budgetedCost')) {
        updateFields.budgetedCost = parsed.budgetedCost !== null && parsed.budgetedCost !== undefined ? String(parsed.budgetedCost) : null;
      }

      const updated = await storage.updateJob(jobId, effectiveUserId, updateFields);
      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') return res.status(400).json({ error: 'Invalid markup data', details: error.errors });
      console.error("Patch job markup error:", error);
      res.status(500).json({ error: "Failed to update markup settings" });
    }
  });

  app.get("/api/jobs/geofence-enabled", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const effectiveUserId = userContext.effectiveUserId;
      
      const allJobs = await storage.getJobs(effectiveUserId);
      
      // Filter jobs with geofence enabled and valid coordinates
      const geofenceJobs = allJobs
        .filter(job => job.geofenceEnabled && job.latitude && job.longitude)
        .map(job => ({
          id: job.id,
          title: job.title,
          address: job.address,
          latitude: parseFloat(job.latitude as string),
          longitude: parseFloat(job.longitude as string),
          radius: job.geofenceRadius || 100,
          autoClockIn: job.geofenceAutoClockIn,
          autoClockOut: job.geofenceAutoClockOut,
          identifier: `job_${job.id}`,
        }));
      
      res.json(geofenceJobs);
    } catch (error: any) {
      console.error('Error fetching geofence-enabled jobs:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/jobs/:id/geofence", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const { id } = req.params;

      const geofenceSchema = z.object({
        geofenceEnabled: z.boolean().optional(),
        geofenceRadius: z.number().int().min(10).max(10000).optional(),
        geofenceAutoClockIn: z.boolean().optional(),
        geofenceAutoClockOut: z.boolean().optional(),
      });
      const parsed = geofenceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid geofence settings', details: parsed.error.errors });
      }
      const { geofenceEnabled, geofenceRadius, geofenceAutoClockIn, geofenceAutoClockOut } = parsed.data;

      const updateData: any = {};
      if (geofenceEnabled !== undefined) updateData.geofenceEnabled = geofenceEnabled;
      if (geofenceRadius !== undefined) updateData.geofenceRadius = geofenceRadius;
      if (geofenceAutoClockIn !== undefined) updateData.geofenceAutoClockIn = geofenceAutoClockIn;
      if (geofenceAutoClockOut !== undefined) updateData.geofenceAutoClockOut = geofenceAutoClockOut;
      
      const updatedJob = await storage.updateJob(id, effectiveUserId, updateData);
      
      if (!updatedJob) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      console.log(`[Geofence] Updated settings for job ${id}:`, updateData);
      
      res.json({
        id: updatedJob.id,
        geofenceEnabled: updatedJob.geofenceEnabled,
        geofenceRadius: updatedJob.geofenceRadius,
        geofenceAutoClockIn: updatedJob.geofenceAutoClockIn,
        geofenceAutoClockOut: updatedJob.geofenceAutoClockOut,
      });
    } catch (error: any) {
      console.error('Error updating geofence settings:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/:jobId/photos", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobId = req.params.jobId;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      const { getJobPhotos } = await import('../photoService');
      // Use effectiveUserId to see all photos uploaded by any team member for this job
      const photos = await getJobPhotos(jobId, userContext.effectiveUserId);
      
      res.json(photos);
    } catch (error: any) {
      console.error('Error getting job photos:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/jobs/:jobId/photos", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobId = req.params.jobId;
      const { fileName, fileBase64, mimeType, category, caption, takenAt } = req.body;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      // Verify job exists and belongs to this user/team (security check)
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found or access denied' });
      }
      
      if (!fileName || !fileBase64 || !mimeType) {
        return res.status(400).json({ error: 'fileName, fileBase64, and mimeType required' });
      }
      
      const fileBuffer = Buffer.from(fileBase64, 'base64');
      
      const { uploadJobPhoto } = await import('../photoService');
      // Use effectiveUserId so all team uploads are visible to everyone on the team
      const result = await uploadJobPhoto(userContext.effectiveUserId, jobId, fileBuffer, {
        fileName,
        fileSize: fileBuffer.length,
        mimeType,
        category: category || 'general',
        caption,
        takenAt: takenAt ? new Date(takenAt) : undefined,
      });
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      res.json({ photoId: result.photoId, success: true });
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/jobs/:jobId/photos/upload", requireAuth, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobId = req.params.jobId;
      const file = req.file;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      // Verify job exists and belongs to this user/team (security check)
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found or access denied' });
      }
      
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const { category, caption, takenAt, latitude, longitude, address } = req.body;
      
      const parsedLat = latitude != null && latitude !== '' ? parseFloat(latitude) : undefined;
      const parsedLng = longitude != null && longitude !== '' ? parseFloat(longitude) : undefined;
      const validLat = parsedLat != null && !isNaN(parsedLat) && parsedLat >= -90 && parsedLat <= 90 ? parsedLat : undefined;
      const validLng = parsedLng != null && !isNaN(parsedLng) && parsedLng >= -180 && parsedLng <= 180 ? parsedLng : undefined;
      
      const { uploadJobPhoto } = await import('../photoService');
      // Use effectiveUserId so all team uploads are visible to everyone on the team
      const result = await uploadJobPhoto(userContext.effectiveUserId, jobId, file.buffer, {
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        category: category || 'general',
        caption,
        takenAt: takenAt ? new Date(takenAt) : undefined,
        latitude: validLat,
        longitude: validLng,
        address: address || undefined,
      });
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      // Create activity log for photo upload
      try {
        const categoryLabel = category === 'before' ? 'Before photo' : 
                             category === 'after' ? 'After photo' : 
                             category === 'progress' ? 'Progress photo' : 'Photo';
        await logActivity(
          userContext.effectiveUserId,
          'photo_added' as ActivityType,
          `${categoryLabel} added to job`,
          caption || `${file.originalname}`,
          'job',
          jobId,
          { photoId: result.photoId, category: category || 'general', fileName: file.originalname }
        );
      } catch (activityError) {
        console.error('Failed to log photo activity:', activityError);
      }
      
      res.json({ photoId: result.photoId, success: true });
    } catch (error: any) {
      console.error('Error uploading media via multipart:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/jobs/:jobId/photos/:photoId", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { photoId } = req.params;

      const photoMetaSchema = z.object({
        category: z.string().max(100).optional(),
        caption: z.string().max(500).optional(),
        sortOrder: z.number().int().min(0).optional(),
      });
      const parsed = photoMetaSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid photo metadata', details: parsed.error.errors });
      }
      const { category, caption, sortOrder } = parsed.data;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      const { updatePhotoMetadata } = await import('../photoService');
      const result = await updatePhotoMetadata(photoId, userContext.effectiveUserId, { category, caption, sortOrder });
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error updating photo:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/jobs/:jobId/photos/:photoId", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { photoId } = req.params;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      const { deleteJobPhoto } = await import('../photoService');
      const result = await deleteJobPhoto(photoId, userContext.effectiveUserId);
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting photo:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/jobs/:jobId/photos/copy", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobId = req.params.jobId;
      const { sourceJobId, photoIds } = req.body;

      // Validate request body
      if (!sourceJobId || !Array.isArray(photoIds) || photoIds.length === 0) {
        return res.status(400).json({ error: 'sourceJobId and photoIds array required' });
      }

      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      const effectiveUserId = userContext.effectiveUserId || userId;

      // Verify target job exists and belongs to user
      const targetJob = await storage.getJob(jobId, effectiveUserId);
      if (!targetJob) {
        return res.status(404).json({ error: 'Target job not found or access denied' });
      }

      // Verify source job exists and belongs to user
      const sourceJob = await storage.getJob(sourceJobId, effectiveUserId);
      if (!sourceJob) {
        return res.status(404).json({ error: 'Source job not found or access denied' });
      }

      // Enforce same-client constraint
      if (!targetJob.clientId || !sourceJob.clientId || targetJob.clientId !== sourceJob.clientId) {
        return res.status(400).json({ error: "Photos can only be copied between jobs for the same client" });
      }
      // Get all photos from source job
      const sourcePhotos = await storage.getJobPhotos(sourceJobId, effectiveUserId);
      
      // Filter to only requested photoIds
      const photosToCopy = sourcePhotos.filter(photo => photoIds.includes(photo.id));

      if (photosToCopy.length === 0) {
        return res.status(400).json({ error: 'No valid photos found to copy' });
      }

      // Create copies of photos for target job
      const copiedPhotos: any[] = [];
      for (const sourcePhoto of photosToCopy) {
        const newPhoto = await storage.createJobPhoto({
          userId: effectiveUserId,
          jobId: jobId,
          objectStorageKey: sourcePhoto.objectStorageKey, // Use same storage key - no duplication
          fileName: sourcePhoto.fileName,
          fileSize: sourcePhoto.fileSize,
          mimeType: sourcePhoto.mimeType,
          category: 'general', // Set all copied photos to general category
          caption: sourcePhoto.caption,
          takenAt: sourcePhoto.takenAt,
          uploadedBy: effectiveUserId, // Current user as the one who initiated the copy
          sortOrder: 0,
        });
        copiedPhotos.push(newPhoto);
      }

      // Create activity log for copy action
      try {
        await logActivity(
          effectiveUserId,
          'photos_copied' as ActivityType,
          `${copiedPhotos.length} photo(s) copied from another job`,
          `Copied from job ${sourceJobId}`,
          'job',
          jobId,
          { sourceJobId, photoCount: copiedPhotos.length }
        );
      } catch (activityError) {
        console.error('Failed to log photo copy activity:', activityError);
      }

      res.json({ success: true, copiedPhotos });
    } catch (error: any) {
      console.error('Error copying photos:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/:jobId/photos/:photoId/view", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, photoId } = req.params;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      // Get photo from database
      const photo = await storage.getJobPhoto(photoId, userContext.effectiveUserId);
      if (!photo) {
        return res.status(404).json({ error: 'Photo not found' });
      }
      
      // Get signed URL and redirect to it
      const { getSignedPhotoUrl } = await import('../photoService');
      const { url, error } = await getSignedPhotoUrl(photo.objectStorageKey);
      
      if (error || !url) {
        console.error('Error getting signed URL for photo view:', error);
        return res.status(500).json({ error: 'Failed to access photo' });
      }
      
      res.redirect(url);
    } catch (error: any) {
      console.error('Error viewing photo:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/:jobId/photos/:photoId/download", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, photoId } = req.params;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      // Get photo from database
      const photo = await storage.getJobPhoto(photoId, userContext.effectiveUserId);
      if (!photo) {
        return res.status(404).json({ error: 'Photo not found' });
      }
      
      // Get signed URL
      const { getSignedPhotoUrl } = await import('../photoService');
      const { url, error } = await getSignedPhotoUrl(photo.objectStorageKey);
      
      if (error || !url) {
        console.error('Error getting signed URL for photo download:', error);
        return res.status(500).json({ error: 'Failed to access photo' });
      }
      
      // Fetch the media and stream it with proper headers
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(500).json({ error: 'Failed to fetch media' });
      }
      
      // Set headers for download
      const fileName = photo.fileName || `media_${photoId}.${photo.mimeType?.split('/')[1] || 'jpg'}`;
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', photo.mimeType || 'application/octet-stream');
      
      // Stream the response
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      console.error('Error downloading photo:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/:jobId/voice-notes", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      const { getJobVoiceNotes } = await import('../voiceNoteService');
      // Use effectiveUserId to see all voice notes from any team member for this job
      const voiceNotes = await getJobVoiceNotes(jobId, userContext.effectiveUserId);
      
      res.json(voiceNotes);
    } catch (error: any) {
      console.error('Error getting voice notes:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/jobs/:jobId/voice-notes", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      const { audioData, fileName, mimeType, duration, title } = req.body;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      if (!audioData) {
        return res.status(400).json({ error: 'Audio data is required' });
      }
      
      // Remove base64 prefix if present
      // Handle MIME types with codec parameters like "audio/webm;codecs=opus"
      // The data URL format is: data:audio/webm;codecs=opus;base64,XXXXX
      const base64Data = audioData.replace(/^data:audio\/[^;]+(?:;[^;]+)*;base64,/, '');
      console.log('[VoiceNote Upload] Original length:', audioData.length, 'Base64 length:', base64Data.length);
      const fileBuffer = Buffer.from(base64Data, 'base64');
      console.log('[VoiceNote Upload] Buffer size:', fileBuffer.length);
      
      const { uploadVoiceNote } = await import('../voiceNoteService');
      // Use effectiveUserId so all team uploads are visible to everyone on the team
      const result = await uploadVoiceNote(userContext.effectiveUserId, jobId, fileBuffer, {
        fileName: fileName || `voice-note-${Date.now()}.webm`,
        fileSize: fileBuffer.length,
        mimeType: mimeType || 'audio/webm',
        duration,
        title,
      });
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      // Create activity log for voice note upload
      try {
        await logActivity(
          userContext.effectiveUserId,
          'voice_note_added' as ActivityType,
          'Voice note recorded',
          title || 'New voice note',
          'job',
          jobId,
          { voiceNoteId: result.voiceNoteId, duration, fileName: fileName || 'voice-note.webm' }
        );
      } catch (activityError) {
        console.error('Failed to log voice note activity:', activityError);
      }
      
      res.json({ 
        success: true, 
        voiceNoteId: result.voiceNoteId,
        objectStorageKey: result.objectStorageKey 
      });
    } catch (error: any) {
      console.error('Error uploading voice note:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/jobs/:jobId/voice-notes/:voiceNoteId", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { voiceNoteId } = req.params;

      const titleSchema = z.object({ title: z.string().trim().min(1).max(200) });
      const parsed = titleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Valid title is required', details: parsed.error.errors });
      }
      const { title } = parsed.data;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      const { updateVoiceNoteTitle } = await import('../voiceNoteService');
      const result = await updateVoiceNoteTitle(voiceNoteId, userContext.effectiveUserId, title);
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error updating voice note:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/jobs/:jobId/voice-notes/:voiceNoteId/transcribe", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { voiceNoteId } = req.params;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      const { transcribeVoiceNote } = await import('../voiceNoteService');
      const result = await transcribeVoiceNote(voiceNoteId, userContext.effectiveUserId);
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      res.json({ success: true, transcription: result.transcription });
    } catch (error: any) {
      console.error('Error transcribing voice note:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI summary of a voice note's transcription (persisted on the voice note)
  app.post("/api/jobs/:jobId/voice-notes/:voiceNoteId/summarize", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, voiceNoteId } = req.params;

      if (isBackpressure(aiQueue)) {
        return send429(res, 'AI is busy right now — try again shortly.');
      }

      const userContext = await getUserContext(userId);
      const { summarizeVoiceNote } = await import('../voiceNoteService');
      const result = await aiQueue.run(() => summarizeVoiceNote(voiceNoteId, userContext.effectiveUserId, jobId));

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.json({ success: true, summary: result.summary });
    } catch (error: any) {
      console.error('Error summarising voice note:', error);
      res.status(500).json({ error: 'Failed to summarise voice note' });
    }
  });

  // AI summary of the job's notes (returned, not persisted)
  app.post("/api/jobs/:jobId/notes/summarize", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;

      if (isBackpressure(aiQueue)) {
        return send429(res, 'AI is busy right now — try again shortly.');
      }

      const userContext = await getUserContext(userId);
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Notes live in two places: the legacy jobs.notes field and the
      // structured job_notes table. Combine both for the summary.
      const structuredNotes = await storage.getJobNotes(jobId, userContext.effectiveUserId);
      const parts: string[] = [];
      if (job.notes && job.notes.trim()) parts.push(job.notes.trim());
      for (const n of structuredNotes) {
        if (n.content && n.content.trim()) parts.push(n.content.trim());
      }
      const combined = parts.join('\n\n');
      if (!combined) {
        return res.status(400).json({ error: 'This job has no notes to summarise' });
      }

      const { summarizeTextForOwner } = await import('../voiceNoteService');
      const result = await aiQueue.run(() => summarizeTextForOwner(combined, 'job_notes'));

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.json({ success: true, summary: result.summary });
    } catch (error: any) {
      console.error('Error summarising job notes:', error);
      res.status(500).json({ error: 'Failed to summarise notes' });
    }
  });

  app.post("/api/jobs/:jobId/voice-notes/:voiceNoteId/confirm-action", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, voiceNoteId } = req.params;
      const { actionIndex, action: actionOverride } = req.body;

      if (actionIndex === undefined || actionIndex === null) {
        return res.status(400).json({ error: 'actionIndex is required' });
      }

      const userContext = await getUserContext(userId);
      const voiceNote = await storage.getVoiceNote(voiceNoteId, userContext.effectiveUserId);
      if (!voiceNote) {
        return res.status(404).json({ error: 'Voice note not found' });
      }

      const detectedActions = (voiceNote.detectedActions as any[]) || [];
      if (actionIndex < 0 || actionIndex >= detectedActions.length) {
        return res.status(400).json({ error: 'Invalid action index' });
      }

      const detectedAction = { ...detectedActions[actionIndex], ...(actionOverride || {}) };

      let createdEntity: any = null;

      if (detectedAction.type === 'reminder' && detectedAction.date) {
        const sendAt = new Date(detectedAction.date);
        if (isNaN(sendAt.getTime())) {
          return res.status(400).json({ error: 'Invalid date for reminder' });
        }
        createdEntity = await storage.createJobReminder({
          jobId,
          userId: userContext.effectiveUserId,
          type: 'sms',
          sendAt,
          hoursBeforeJob: 0,
          status: 'pending',
        });
      }

      try {
        await logTeamActivity({
          businessOwnerId: userContext.effectiveUserId,
          actorUserId: userId,
          activityType: 'voice_action_confirmed' as TeamActivityType,
          entityType: 'job',
          entityId: jobId,
          description: `Confirmed voice action: ${detectedAction.type} - ${detectedAction.description}`,
        });
      } catch (e) {
        logger.warn('background', 'Failed to write team activity for confirmed voice action', { userId, error: e, metadata: { jobId } });
      }

      detectedActions[actionIndex] = { ...detectedActions[actionIndex], confirmed: true };
      await storage.updateVoiceNote(voiceNoteId, userContext.effectiveUserId, {
        detectedActions: detectedActions as any,
      });

      res.json({
        success: true,
        action: detectedAction,
        createdEntity,
      });
    } catch (error: any) {
      console.error('Error confirming voice action:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/jobs/:jobId/voice-notes/:voiceNoteId/dismiss-action", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { voiceNoteId } = req.params;
      const { actionIndex } = req.body;

      if (actionIndex === undefined || actionIndex === null) {
        return res.status(400).json({ error: 'actionIndex is required' });
      }

      const userContext = await getUserContext(userId);
      const voiceNote = await storage.getVoiceNote(voiceNoteId, userContext.effectiveUserId);
      if (!voiceNote) {
        return res.status(404).json({ error: 'Voice note not found' });
      }

      const detectedActions = (voiceNote.detectedActions as any[]) || [];
      if (actionIndex < 0 || actionIndex >= detectedActions.length) {
        return res.status(400).json({ error: 'Invalid action index' });
      }

      detectedActions[actionIndex] = { ...detectedActions[actionIndex], dismissed: true };
      await storage.updateVoiceNote(voiceNoteId, userContext.effectiveUserId, {
        detectedActions: detectedActions as any,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error dismissing voice action:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/jobs/:jobId/voice-notes/:voiceNoteId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { voiceNoteId } = req.params;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      const { deleteVoiceNote } = await import('../voiceNoteService');
      const result = await deleteVoiceNote(voiceNoteId, userContext.effectiveUserId);
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting voice note:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/:jobId/voice-notes/:voiceNoteId/view", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, voiceNoteId } = req.params;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      // Get voice note from database
      const voiceNote = await storage.getVoiceNote(voiceNoteId, userContext.effectiveUserId);
      if (!voiceNote) {
        return res.status(404).json({ error: 'Voice note not found' });
      }
      
      // Get signed URL and redirect to it
      const { getSignedVoiceNoteUrl } = await import('../voiceNoteService');
      const { url, error } = await getSignedVoiceNoteUrl(voiceNote.objectStorageKey);
      
      if (error || !url) {
        console.error('Error getting signed URL for voice note view:', error);
        return res.status(500).json({ error: 'Failed to access voice note' });
      }
      
      res.redirect(url);
    } catch (error: any) {
      console.error('Error viewing voice note:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/:jobId/voice-notes/:voiceNoteId/stream", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, voiceNoteId } = req.params;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      // Get voice note from database
      const voiceNote = await storage.getVoiceNote(voiceNoteId, userContext.effectiveUserId);
      if (!voiceNote) {
        return res.status(404).json({ error: 'Voice note not found' });
      }
      
      // Get signed URL
      const { getSignedVoiceNoteUrl } = await import('../voiceNoteService');
      const { url, error } = await getSignedVoiceNoteUrl(voiceNote.objectStorageKey);
      
      if (error || !url) {
        console.error('Error getting signed URL for voice note stream:', error);
        return res.status(500).json({ error: 'Failed to access voice note' });
      }
      
      // Check if this is a webm file that needs transcoding for iOS
      const isWebm = voiceNote.mimeType?.includes('webm') || voiceNote.fileName?.endsWith('.webm');
      
      if (isWebm) {
        // Transcode webm to mp4/aac for iOS compatibility using ffmpeg
        // Buffer output first, then verify success before sending response
        console.log('[VoiceNote] Transcoding webm to mp4 for iOS compatibility');
        
        // First verify the source URL is accessible
        try {
          const checkResponse = await fetch(url, { method: 'HEAD' });
          if (!checkResponse.ok) {
            console.error('[VoiceNote] Source URL not accessible:', checkResponse.status);
            return res.status(500).json({ error: 'Voice note source not accessible' });
          }
        } catch (checkError) {
          console.error('[VoiceNote] Failed to check source URL:', checkError);
          return res.status(500).json({ error: 'Failed to verify voice note source' });
        }
        
        const { spawn } = await import('child_process');
        
        // Buffer output to verify transcoding succeeded before sending
        const outputChunks: Buffer[] = [];
        let hasError = false;
        let stderrOutput = '';
        
        // Use ffmpeg to transcode webm -> mp4 (aac audio)
        const ffmpeg = spawn('ffmpeg', [
          '-y',                // Overwrite output
          '-i', url,           // Input from signed URL
          '-c:a', 'aac',       // Convert to AAC codec
          '-b:a', '128k',      // Bitrate
          '-f', 'mp4',         // Output format
          '-movflags', 'frag_keyframe+empty_moov',  // Fragmented MP4 for streaming
          'pipe:1'             // Output to stdout
        ]);
        
        ffmpeg.stdout.on('data', (chunk: Buffer) => {
          outputChunks.push(chunk);
        });
        
        ffmpeg.stderr.on('data', (data: Buffer) => {
          stderrOutput += data.toString();
          // Check for error indicators
          const msg = data.toString();
          if (msg.includes('Error') || msg.includes('error opening') || msg.includes('Invalid')) {
            hasError = true;
          }
        });
        
        ffmpeg.on('error', (err: Error) => {
          console.error('[ffmpeg] Process error:', err);
          hasError = true;
          if (!res.headersSent) {
            res.status(500).json({ error: 'Transcoding failed' });
          }
        });
        
        ffmpeg.on('close', (code: number) => {
          const totalSize = outputChunks.reduce((acc, c) => acc + c.length, 0);
          
          if (code !== 0 || hasError || totalSize < 100) {
            console.error('[ffmpeg] Transcoding failed - code:', code, 'totalSize:', totalSize, 'hasError:', hasError);
            console.error('[ffmpeg] stderr:', stderrOutput.substring(0, 500));
            if (!res.headersSent) {
              res.status(500).json({ error: 'Transcoding failed' });
            }
          } else {
            console.log('[ffmpeg] Transcoding complete, output size:', totalSize);
            // Only now set headers and send response
            res.setHeader('Content-Type', 'audio/mp4');
            res.setHeader('Content-Length', totalSize);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            
            for (const chunk of outputChunks) {
              res.write(chunk);
            }
            res.end();
          }
        });
        
        // Handle client disconnect
        req.on('close', () => {
          ffmpeg.kill('SIGTERM');
        });
        
        return;
      }
      
      // Non-webm files: fetch and stream directly
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(500).json({ error: 'Failed to fetch voice note' });
      }
      
      // Determine content type
      let contentType = voiceNote.mimeType || 'audio/mpeg';
      if (voiceNote.fileName?.endsWith('.m4a')) {
        contentType = 'audio/mp4';
      }
      
      // Set proper headers for audio streaming
      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      // Stream the response
      const arrayBuffer = await response.arrayBuffer();
      res.setHeader('Content-Length', arrayBuffer.byteLength);
      res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      console.error('Error streaming voice note:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/:jobId/notes", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      
      const userContext = await getUserContext(userId);
      const notes = await storage.getJobNotes(jobId, userContext.effectiveUserId);
      
      res.json(notes);
    } catch (error: any) {
      console.error('Error fetching job notes:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/jobs/:jobId/notes", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      
      // Validate request body with Zod schema - enforce non-empty trimmed content
      const contentSchema = z.object({ content: z.string().trim().min(1, 'Note content cannot be empty') });
      const parseResult = contentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'Note content is required', details: parseResult.error.errors });
      }
      const { content } = parseResult.data;
      
      const userContext = await getUserContext(userId);
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const user = await storage.getUser(userId);
      
      const note = await storage.createJobNote({
        userId: userContext.effectiveUserId,
        jobId,
        content,
        createdBy: userId,
        createdByName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : undefined,
      });
      
      await storage.createActivityLog({
        userId: userContext.effectiveUserId,
        type: 'note_added',
        title: 'Note added',
        entityType: 'job',
        entityId: jobId,
        description: 'Added a note to job',
      });
      
      res.json(note);
    } catch (error: any) {
      console.error('Error creating job note:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/jobs/:jobId/notes/:noteId", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, noteId } = req.params;
      
      // Validate request body with Zod schema - enforce non-empty trimmed content
      const contentSchema = z.object({ content: z.string().trim().min(1, 'Note content cannot be empty') });
      const parseResult = contentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'Note content is required', details: parseResult.error.errors });
      }
      const { content } = parseResult.data;
      
      const userContext = await getUserContext(userId);
      
      // Verify job access
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      // Verify note exists and belongs to this job BEFORE updating
      const existingNotes = await storage.getJobNotes(jobId, userContext.effectiveUserId);
      const noteToUpdate = existingNotes.find(n => n.id === noteId);
      if (!noteToUpdate) {
        return res.status(404).json({ error: 'Note not found or does not belong to this job' });
      }
      
      const note = await storage.updateJobNote(noteId, userContext.effectiveUserId, { content });
      
      if (!note) {
        return res.status(404).json({ error: 'Failed to update note' });
      }
      
      // Log activity for note update
      await storage.createActivityLog({
        userId: userContext.effectiveUserId,
        type: 'note_edited',
        title: 'Note edited',
        entityType: 'job',
        entityId: jobId,
        description: 'Edited a note on job',
      });
      
      res.json(note);
    } catch (error: any) {
      console.error('Error updating job note:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/jobs/:jobId/notes/:noteId", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, noteId } = req.params;
      
      const userContext = await getUserContext(userId);
      
      // Verify job access first
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      // Get the note before deleting to verify it belongs to this job
      const existingNotes = await storage.getJobNotes(jobId, userContext.effectiveUserId);
      const noteToDelete = existingNotes.find(n => n.id === noteId);
      if (!noteToDelete) {
        return res.status(404).json({ error: 'Note not found or does not belong to this job' });
      }
      
      const deleted = await storage.deleteJobNote(noteId, userContext.effectiveUserId);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Note not found' });
      }
      
      // Log activity for note deletion
      await storage.createActivityLog({
        userId: userContext.effectiveUserId,
        type: 'note_deleted',
        title: 'Note deleted',
        entityType: 'job',
        entityId: jobId,
        description: 'Removed a note from job',
      });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting job note:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/:jobId/variations", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      
      const userContext = await getUserContext(userId);
      const variations = await storage.getJobVariations(jobId, userContext.effectiveUserId);
      
      res.json(variations);
    } catch (error: any) {
      console.error('Error getting job variations:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/jobs/:jobId/variations", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      
      const userContext = await getUserContext(userId);
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const user = await storage.getUser(userId);
      const nextNumber = await storage.getNextVariationNumber(jobId, userContext.effectiveUserId);
      
      // Calculate GST (10% for Australia)
      const additionalAmount = parseFloat(req.body.additionalAmount || '0');
      const gstAmount = additionalAmount * 0.10;
      const totalAmount = additionalAmount + gstAmount;
      
      const variation = await storage.createJobVariation({
        userId: userContext.effectiveUserId,
        jobId,
        number: nextNumber,
        title: req.body.title || 'Untitled Variation',
        description: req.body.description,
        reason: req.body.reason,
        additionalAmount: String(additionalAmount),
        gstAmount: String(gstAmount.toFixed(2)),
        totalAmount: String(totalAmount.toFixed(2)),
        status: 'draft',
        photos: req.body.photos || [],
        createdBy: userId,
        createdByName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : undefined,
      });
      
      // Log activity
      await storage.createActivityLog({
        userId: userContext.effectiveUserId,
        type: 'variation_created',
        title: 'Variation Created',
        entityType: 'job',
        entityId: jobId,
        description: `Created variation ${nextNumber}: ${variation.title}`,
      });
      
      res.json(variation);
    } catch (error: any) {
      console.error('Error creating job variation:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/jobs/:jobId/variations/:variationId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, variationId } = req.params;

      const userContext = await getUserContext(userId);

      // Only owners/managers can update variations
      if (!userContext.isOwner && !hasPermission(userContext, PERMISSIONS.WRITE_JOBS)) {
        return res.status(403).json({ error: 'Only owners and managers can update variations' });
      }

      const existing = await storage.getJobVariation(variationId, userContext.effectiveUserId);
      if (!existing || existing.jobId !== jobId) {
        return res.status(404).json({ error: 'Variation not found' });
      }

      const { status, rejectionReason } = req.body;
      const updates: Record<string, any> = {};

      if (status) {
        const validTransitions: Record<string, string[]> = {
          draft: ['sent'],
          sent: ['approved', 'rejected'],
          approved: [],
          rejected: ['sent'], // allow re-sending if needed
        };
        const allowed = validTransitions[existing.status] ?? [];
        if (!allowed.includes(status)) {
          return res.status(422).json({
            error: `Cannot transition variation from '${existing.status}' to '${status}'`,
          });
        }
        updates.status = status;
        if (status === 'approved') {
          const user = await storage.getUser(userId);
          updates.approvedAt = new Date();
          updates.approvedByName = user
            ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
            : 'Unknown';
        }
        if (status === 'rejected') {
          updates.rejectedAt = new Date();
          if (rejectionReason) updates.rejectionReason = rejectionReason;
        }
        if (status === 'sent') {
          updates.sentAt = new Date();
        }
      }

      // Allow updating other fields when in draft
      if (existing.status === 'draft') {
        const editable = ['title', 'description', 'reason', 'photos', 'notes'];
        for (const field of editable) {
          if (req.body[field] !== undefined) updates[field] = req.body[field];
        }
        if (req.body.additionalAmount !== undefined) {
          const additionalAmount = parseFloat(req.body.additionalAmount || '0');
          const gstAmount = additionalAmount * 0.10;
          updates.additionalAmount = String(additionalAmount);
          updates.gstAmount = String(gstAmount.toFixed(2));
          updates.totalAmount = String((additionalAmount + gstAmount).toFixed(2));
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(422).json({ error: 'No valid fields to update' });
      }

      const updated = await storage.updateJobVariation(variationId, userContext.effectiveUserId, updates);

      if (status) {
        await storage.createActivityLog({
          userId: userContext.effectiveUserId,
          type: 'variation_updated',
          title: 'Variation Updated',
          entityType: 'job',
          entityId: jobId,
          description: `Variation ${existing.number} status changed to ${status}`,
        });
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Error updating job variation:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/jobs/:jobId/variations/approved-for-claim
  // Returns approved variations that have NOT already been included in a claim line item.
  // Used by the claims wizard to offer one-click "add variation" buttons.
  app.get("/api/jobs/:jobId/variations/approved-for-claim", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      const { effectiveUserId } = await getUserContext(userId);

      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) return res.status(404).json({ error: "Job not found" });

      const allVariations = await storage.getJobVariations(jobId, effectiveUserId);
      const approvedVariations = allVariations.filter((v: any) => v.status === 'approved');

      // Collect variationIds already used in any claim line item for this job
      const existingClaims = await storage.getClaims(jobId, effectiveUserId);
      const claimedVariationIds = new Set<string>();
      for (const claim of existingClaims) {
        const lineItems = await storage.getClaimLineItems(claim.id);
        for (const li of lineItems) {
          if ((li as any).variationId) claimedVariationIds.add((li as any).variationId);
        }
      }

      const unclaimed = approvedVariations.filter((v: any) => !claimedVariationIds.has(v.id));

      // Seed suggested line-item amounts from additionalAmount (ex-GST).
      // The claims creation route treats all line-item amounts as ex-GST and
      // applies GST on top when gstEnabled — using totalAmount here would cause
      // a ~10% overcharge for GST-registered businesses.
      const result = unclaimed.map((v: any) => ({
        id: v.id,
        number: v.number,
        title: v.title,
        totalAmount: v.totalAmount || "0.00",
        suggestedLineItem: {
          description: `Variation ${v.number}: ${v.title}`,
          contractValue: v.additionalAmount || "0.00",
          previouslyClaimed: "0.00",
          thisClaim: v.additionalAmount || "0.00",
        },
      }));

      res.json(result);
    } catch (error: any) {
      console.error('Error getting approved-for-claim variations:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/:jobId/variations/summary", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      
      const userContext = await getUserContext(userId);
      const variations = await storage.getJobVariations(jobId, userContext.effectiveUserId);
      
      const approvedVariations = variations.filter(v => v.status === 'approved');
      const pendingVariations = variations.filter(v => v.status === 'sent');
      
      const approvedTotal = approvedVariations.reduce((sum, v) => sum + parseFloat(v.totalAmount || '0'), 0);
      const pendingTotal = pendingVariations.reduce((sum, v) => sum + parseFloat(v.totalAmount || '0'), 0);
      
      res.json({
        totalVariations: variations.length,
        approvedCount: approvedVariations.length,
        pendingCount: pendingVariations.length,
        approvedTotal: approvedTotal.toFixed(2),
        pendingTotal: pendingTotal.toFixed(2),
      });
    } catch (error: any) {
      console.error('Error getting variation summary:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Job Phases CRUD ─────────────────────────────────────────────────────────

  app.get("/api/jobs/:jobId/phases", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_JOBS), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      const effectiveUserId = req.effectiveUserId || userId;
      const userContext = req.userContext;

      // Resolve job — mirror the same logic as GET /api/jobs/:id
      let job = await storage.getJob(jobId, effectiveUserId);
      let crossBusinessAssigned = false;
      if (!job) {
        // Cross-business subcontractor path: worker may be assigned to a job in another tenant
        const ja = await storage.getJobAssignmentForUser(jobId, userId);
        if (ja) {
          job = await storage.getJobPublic(jobId);
          crossBusinessAssigned = !!job;
        }
      }
      if (!job) return res.status(404).json({ error: "Job not found" });

      // Staff tradies only see their assigned jobs (skip if cross-business assignment already proved)
      const hasViewAll = userContext?.permissions?.includes('view_all') || userContext?.isOwner;
      if (!crossBusinessAssigned && !hasViewAll && userContext?.teamMemberId) {
        const assignIds = [userContext.teamMemberId, userId].filter(Boolean);
        let isAssigned = assignIds.includes(job.assignedTo) ||
                         assignIds.includes((job as any).assignedTeamMemberId);
        if (!isAssigned) {
          const ja = await storage.getJobAssignmentForUser(job.id, userId);
          isAssigned = !!ja;
        }
        if (!isAssigned) return res.status(403).json({ error: "You can only view your assigned jobs" });
      }

      // Phases are tenant-scoped — use the job owner's userId, not the requester's effectiveUserId,
      // so cross-business workers see the correct phases rather than an empty list from their own tenant.
      const phaseOwnerId = job.userId;
      const phases = await storage.getJobPhases(jobId, phaseOwnerId);
      res.json(phases);
    } catch (err: any) {
      console.error("Error fetching job phases:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Normalize blank strings to null so z.coerce.date() never receives "" and
  // numeric/decimal columns never receive an empty string from the form.
  // Explicit null is preserved (not converted to undefined) so PATCH can clear existing values.
  function normalizePhaseBody(body: Record<string, any>) {
    const out = { ...body };
    for (const key of ['scheduledStart', 'scheduledEnd']) {
      if (out[key] === '') out[key] = null;  // blank string → null; explicit null stays null
    }
    if (out['bookedHours'] === '') out['bookedHours'] = null;
    return out;
  }

  app.post("/api/jobs/:jobId/phases", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      const effectiveUserId = req.effectiveUserId || userId;
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) return res.status(404).json({ error: "Job not found" });

      const bodySchema = z.object({
        phaseCode: z.string().min(1).max(20),
        name: z.string().min(1).max(200),
        description: z.string().optional().nullable(),
        scheduledStart: z.coerce.date().optional().nullable(),
        scheduledEnd: z.coerce.date().optional().nullable(),
        bookedHours: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a positive number').optional().nullable(),
        status: z.enum(["not_started", "in_progress", "complete", "invoiced"]).default("not_started"),
        sortOrder: z.number().int().optional(),
        notes: z.string().optional().nullable(),
      });
      const parsed = bodySchema.parse(normalizePhaseBody(req.body));

      // Auto-assign sortOrder = count of existing phases
      const existing = await storage.getJobPhases(jobId, effectiveUserId);
      const sortOrder = parsed.sortOrder ?? existing.length;

      const phase = await storage.createJobPhase({
        jobId,
        userId: effectiveUserId,
        phaseCode: parsed.phaseCode.trim().toUpperCase(),
        name: parsed.name.trim(),
        description: parsed.description ?? null,
        scheduledStart: parsed.scheduledStart ?? null,
        scheduledEnd: parsed.scheduledEnd ?? null,
        bookedHours: parsed.bookedHours ?? null,
        status: parsed.status,
        sortOrder,
        notes: parsed.notes ?? null,
      });
      res.status(201).json(phase);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Invalid phase data", details: err.errors });
      console.error("Error creating job phase:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/jobs/:jobId/phases/reorder", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      const effectiveUserId = req.effectiveUserId || userId;
      const { orderedIds } = z.object({ orderedIds: z.array(z.string()).min(1) }).parse(req.body);
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) return res.status(404).json({ error: "Job not found" });
      await storage.reorderJobPhases(jobId, effectiveUserId, orderedIds);
      res.json({ success: true });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Invalid request", details: err.errors });
      if (err.message?.includes('exact permutation')) return res.status(400).json({ error: err.message });
      console.error("Error reordering job phases:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/jobs/:jobId/phases/:phaseId", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, phaseId } = req.params;
      const effectiveUserId = req.effectiveUserId || userId;
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) return res.status(404).json({ error: "Job not found" });

      const updateSchema = z.object({
        phaseCode: z.string().min(1).max(20).optional(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().optional().nullable(),
        scheduledStart: z.coerce.date().optional().nullable(),
        scheduledEnd: z.coerce.date().optional().nullable(),
        bookedHours: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a positive number').optional().nullable(),
        status: z.enum(["not_started", "in_progress", "complete", "invoiced"]).optional(),
        sortOrder: z.number().int().optional(),
        notes: z.string().optional().nullable(),
      });
      const updates = updateSchema.parse(normalizePhaseBody(req.body));
      if (updates.phaseCode) updates.phaseCode = updates.phaseCode.trim().toUpperCase() as any;
      if (updates.name) updates.name = updates.name.trim() as any;

      // Pass jobId so storage scopes by phaseId + jobId + userId — prevents cross-job mutations
      const phase = await storage.updateJobPhase(phaseId, jobId, effectiveUserId, updates as any);
      if (!phase) return res.status(404).json({ error: "Phase not found" });
      res.json(phase);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Invalid phase data", details: err.errors });
      console.error("Error updating job phase:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/jobs/:jobId/phases/:phaseId", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, phaseId } = req.params;
      const effectiveUserId = req.effectiveUserId || userId;
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) return res.status(404).json({ error: "Job not found" });
      // Pass jobId so storage scopes by phaseId + jobId + userId — prevents cross-job mutations
      const deleted = await storage.deleteJobPhase(phaseId, jobId, effectiveUserId);
      if (!deleted) return res.status(404).json({ error: "Phase not found" });
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting job phase:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────

  app.get("/api/jobs/:jobId/materials", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      const effectiveUserId = req.effectiveUserId || userId;

      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const materials = await storage.getJobMaterials(jobId, effectiveUserId);

      const workerContext = await getWorkerPermissionContext(userId);
      if (workerContext.isWorker) {
        const sanitized = materials.map((m: any) => ({
          ...m,
          unitCost: undefined,
          totalCost: undefined,
        }));
        return res.json(sanitized);
      }

      res.json(materials);
    } catch (error: any) {
      console.error('Error getting job materials:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/jobs/:jobId/materials", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      const effectiveUserId = req.effectiveUserId || userId;

      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const parsed = insertJobMaterialSchema.parse({
        ...req.body,
        jobId,
        userId: effectiveUserId,
      });

      const quantity = parseFloat(String(parsed.quantity || '1'));
      const unitCost = parseFloat(String(parsed.unitCost || '0'));
      let unitPrice = parseFloat(String(parsed.unitPrice || '0'));
      let markupPercent = parsed.markupPercent ? parseFloat(String(parsed.markupPercent)) : null;

      // Auto-calculate unitPrice via markup if not explicitly provided
      if (unitPrice === 0 && unitCost > 0) {
        // Resolve effective markup: per-line > per-job > business default > 20%
        if (markupPercent === null || isNaN(markupPercent)) {
          const rawJobMarkup = (job as any).materialMarkupPct;
          const jobMarkup = rawJobMarkup !== null && rawJobMarkup !== undefined ? parseFloat(rawJobMarkup) : null;
          if (jobMarkup !== null && !isNaN(jobMarkup)) {
            markupPercent = jobMarkup;
          } else {
            try {
              const biz = await storage.getBusinessSettings(effectiveUserId);
              const bizMarkup = biz ? parseFloat(String((biz as any).defaultMaterialMarkupPct ?? '20')) : 20;
              markupPercent = isNaN(bizMarkup) ? 20 : bizMarkup;
            } catch (_) {
              markupPercent = 20;
            }
          }
        }
        unitPrice = Math.round(unitCost * (1 + (markupPercent ?? 20) / 100) * 100) / 100;
      }

      const totalCost = (quantity * unitCost).toFixed(2);
      const totalPrice = (quantity * unitPrice).toFixed(2);

      const material = await storage.createJobMaterial({
        ...parsed,
        markupPercent: markupPercent !== null ? String(markupPercent) : parsed.markupPercent,
        unitPrice: String(unitPrice),
        totalCost,
        totalPrice,
      });

      res.status(201).json(material);
    } catch (error: any) {
      console.error('Error creating job material:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid material data', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/:jobId/documents", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      
      const userContext = await getUserContext(userId);
      
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found or access denied' });
      }
      
      const documents = await storage.getJobDocuments(jobId, userContext.effectiveUserId);
      
      const objectStorage = new ObjectStorageService();
      const documentsWithUrls = await Promise.all(documents.map(async (doc) => {
        try {
          const signedUrl = await objectStorage.getSignedReadURLFromKey(doc.objectStorageKey, 3600);
          return { ...doc, fileUrl: signedUrl };
        } catch (error) {
          console.error('Error getting signed URL for document:', error);
          return { ...doc, fileUrl: null };
        }
      }));
      
      res.json(documentsWithUrls);
    } catch (error: any) {
      console.error('Error getting job documents:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/jobs/:jobId/documents", requireAuth, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      const file = req.file;
      
      const userContext = await getUserContext(userId);
      
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found or access denied' });
      }
      
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const { title, documentType } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }
      
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({ error: 'Invalid file type. Only PDF and images are allowed.' });
      }
      
      const objectStorage = new ObjectStorageService();
      const privateDir = objectStorage.getPrivateObjectDir();
      const fileExtension = file.originalname.split('.').pop() || 'pdf';
      const objectKey = `${privateDir}/job-documents/${userContext.effectiveUserId}/${jobId}/${Date.now()}-${randomBytes(4).toString('hex')}.${fileExtension}`;
      
      const { bucketName, objectName } = parseObjectPath(objectKey);
      const bucket = objectStorageClient.bucket(bucketName);
      const gcsFile = bucket.file(objectName);
      
      await gcsFile.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
        },
      });
      
      const document = await storage.createJobDocument({
        userId: userContext.effectiveUserId,
        jobId,
        title,
        documentType: documentType || 'other',
        fileName: file.originalname,
        objectStorageKey: objectKey,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedBy: userId,
      });
      
      const signedUrl = await objectStorage.getSignedReadURLFromKey(objectKey, 3600);
      
      res.json({ ...document, fileUrl: signedUrl, success: true });
    } catch (error: any) {
      console.error('Error uploading job document:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/jobs/:jobId/documents/:docId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, docId } = req.params;
      
      const userContext = await getUserContext(userId);
      
      const document = await storage.getJobDocument(docId, userContext.effectiveUserId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      try {
        const { bucketName, objectName } = parseObjectPath(document.objectStorageKey);
        const bucket = objectStorageClient.bucket(bucketName);
        const file = bucket.file(objectName);
        await file.delete();
      } catch (deleteError) {
        console.error('Error deleting file from object storage:', deleteError);
      }
      
      const deleted = await storage.deleteJobDocument(docId, userContext.effectiveUserId);
      
      if (!deleted) {
        return res.status(500).json({ error: 'Failed to delete document' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting job document:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/:jobId/documents/:docId/view", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { docId } = req.params;
      
      const userContext = await getUserContext(userId);
      
      const document = await storage.getJobDocument(docId, userContext.effectiveUserId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const objectStorage = new ObjectStorageService();
      const signedUrl = await objectStorage.getSignedReadURLFromKey(document.objectStorageKey, 3600);
      
      res.redirect(signedUrl);
    } catch (error: any) {
      console.error('Error viewing document:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/:jobId/signatures", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      // Verify job access using effectiveUserId
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const signatures = await db.select().from(digitalSignatures).where(eq(digitalSignatures.jobId, jobId));
      
      // Ensure consistent camelCase property names for mobile/web clients
      const mappedSignatures = signatures.map(sig => ({
        id: sig.id,
        jobId: sig.jobId,
        clientId: sig.clientId,
        signerName: sig.signerName,
        signerEmail: sig.signerEmail,
        signerRole: sig.signerRole || 'client',
        signatureData: sig.signatureData,
        signedAt: sig.signedAt,
        documentType: sig.documentType,
        ipAddress: sig.ipAddress,
        userAgent: sig.userAgent,
      }));
      
      res.json(mappedSignatures);
    } catch (error: any) {
      console.error('Error getting signatures:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/jobs/:jobId/signatures", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      const { signerName, signerEmail, signatureData, signerRole, saveToClient } = req.body;
      
      if (!signerName || !signatureData) {
        return res.status(400).json({ error: 'Signer name and signature data are required' });
      }
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      // Verify job access using effectiveUserId
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const [signature] = await db.insert(digitalSignatures).values({
        jobId,
        clientId: job.clientId,
        signerName,
        signerEmail: signerEmail || null,
        signerRole: signerRole || 'client',
        signatureData,
        signedAt: new Date(),
        documentType: 'job_completion',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).returning();
      
      // If saveToClient is true and signerRole is 'client', save signature to client profile
      if (saveToClient && (signerRole === 'client' || !signerRole)) {
        try {
          await db.update(clients)
            .set({ 
              savedSignatureData: signatureData,
              savedSignatureDate: new Date(),
              updatedAt: new Date()
            })
            .where(eq(clients.id, job.clientId));
        } catch (clientError) {
          console.log('Could not save signature to client profile:', clientError);
        }
      }
      
      // Return with explicit camelCase property names
      res.json({
        id: signature.id,
        jobId: signature.jobId,
        clientId: signature.clientId,
        signerName: signature.signerName,
        signerEmail: signature.signerEmail,
        signerRole: signature.signerRole || 'client',
        signatureData: signature.signatureData,
        signedAt: signature.signedAt,
        documentType: signature.documentType,
        ipAddress: signature.ipAddress,
        userAgent: signature.userAgent,
      });
    } catch (error: any) {
      console.error('Error saving signature:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/jobs/:jobId/signatures/:signatureId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, signatureId } = req.params;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      // Verify job access using effectiveUserId
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      await db.delete(digitalSignatures).where(and(eq(digitalSignatures.id, signatureId), eq(digitalSignatures.jobId, jobId)));
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting signature:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/chat/latest", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const latestMessages = await storage.getLatestJobChatMessages(userId);
      res.json(latestMessages);
    } catch (error: any) {
      console.error('Error fetching latest job chat messages:', error);
      res.status(500).json({ error: 'Failed to fetch latest chat messages' });
    }
  });

  app.get("/api/jobs/:jobId/chat", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobId = req.params.jobId;
      
      // Verify user has access to this job (owner, team member, or assigned)
      const job = await getJobWithChatAccess(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found or access denied' });
      }
      
      const allMessages = await storage.getJobChatMessages(jobId);

      // Replay-on-reconnect: if client sends ?since=<iso>, return only newer messages.
      const since = typeof req.query.since === 'string' ? new Date(req.query.since) : null;
      const messages = since && !isNaN(since.getTime())
        ? allMessages.filter(m => m.createdAt && new Date(m.createdAt as any).getTime() > since.getTime())
        : allMessages;

      // Enrich messages with user info
      const enrichedMessages = await Promise.all(
        messages.map(async (msg) => {
          const user = await storage.getUser(msg.userId);
          return {
            ...msg,
            senderName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown',
            senderAvatar: user?.profileImageUrl,
          };
        })
      );
      
      // Mark messages as read for this user
      await storage.markJobChatAsRead(jobId, userId);
      
      res.json(enrichedMessages);
    } catch (error: any) {
      console.error('Error getting job chat:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/jobs/:jobId/chat", requireAuth, chatRateLimiterMiddleware, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobId = req.params.jobId;
      
      // Verify user has access to this job
      const job = await getJobWithChatAccess(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found or access denied' });
      }
      
      const validatedData = insertJobChatSchema.parse({
        ...req.body,
        jobId,
        userId,
      });
      
      const message = await storage.createJobChatMessage(validatedData);

      // Enrich with user info
      const user = await storage.getUser(userId);

      const { broadcastChatMessage } = await import('../websocket');
      const userContext = await getUserContext(userId);
      broadcastChatMessage(userContext.effectiveUserId, {
        chatType: 'job',
        messageId: message.id,
        jobId: req.params.jobId,
        senderId: userId,
        senderName: user?.firstName || 'Team member',
        preview: (req.body.message || '').substring(0, 100),
      });
      const senderName = user ? (`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown') : 'Unknown';
      const enrichedMessage = {
        ...message,
        senderName,
        senderAvatar: user?.profileImageUrl,
      };
      
      // Send push notifications and DB notifications to other job chat participants
      try {
        const messagePreview = req.body.message || '';
        
        // Notify job owner if they didn't send the message
        if (job.userId !== userId) {
          await notifyTeamMessage(job.userId, senderName, messagePreview, 'job');
          await notifyChatMessage(storage, job.userId, senderName, messagePreview || 'Sent a message', message.id);
          console.log(`[PushNotification] Sent job chat notification to owner ${job.userId}`);
        }
        
        // Notify assigned user if they exist and didn't send the message
        // Resolve assignedTo to proper user ID (it may be a team member record ID)
        const assigneeUserId = await resolveAssigneeUserId(job.assignedTo, job.userId);
        if (assigneeUserId && assigneeUserId !== userId && assigneeUserId !== job.userId) {
          await notifyTeamMessage(assigneeUserId, senderName, messagePreview, 'job');
          await notifyChatMessage(storage, assigneeUserId, senderName, messagePreview || 'Sent a message', message.id);
          console.log(`[PushNotification] Sent job chat notification to assignee ${assigneeUserId}`);
        }
      } catch (pushError) {
        console.error('[PushNotification] Error sending job chat notification:', pushError);
      }
      
      res.json(enrichedMessage);
    } catch (error: any) {
      console.error('Error sending job chat message:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/jobs/:jobId/chat/upload", requireAuth, chatUpload.single('file'), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobId = req.params.jobId;
      const file = req.file;
      const { message } = req.body;
      
      // Verify user has access to this job
      const job = await getJobWithChatAccess(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found or access denied' });
      }
      
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      // Determine message type based on mime type
      let messageType = 'file';
      if (file.mimetype.startsWith('image/')) {
        messageType = 'image';
      } else if (file.mimetype.startsWith('video/')) {
        messageType = 'video';
      }
      
      // Upload file to object storage
      const { ObjectStorageService } = await import('../objectStorage');
      const objectStorageService = new ObjectStorageService();
      
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `/.private/chat-attachments/${userId}/${jobId}/${timestamp}_${safeName}`;
      
      const attachmentUrl = await objectStorageService.uploadFile(fileName, file.buffer, file.mimetype);
      
      if (!attachmentUrl) {
        return res.status(500).json({ error: 'Failed to upload attachment' });
      }
      
      // Create chat message with attachment
      const validatedData = insertJobChatSchema.parse({
        jobId,
        userId,
        message: message || file.originalname,
        messageType,
        attachmentUrl,
        attachmentName: file.originalname,
      });
      
      const chatMessage = await storage.createJobChatMessage(validatedData);
      
      // Enrich with user info
      const user = await storage.getUser(userId);
      const enrichedMessage = {
        ...chatMessage,
        senderName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown',
        senderAvatar: user?.profileImageUrl,
      };
      
      res.json(enrichedMessage);
    } catch (error: any) {
      console.error('Error uploading chat attachment:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/:jobId/chat/participants", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobId = req.params.jobId;
      
      // Verify access
      const job = await getJobWithChatAccess(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found or access denied' });
      }
      
      // Get participants list
      const participants: Array<{ id: string; name: string; role: string; avatar?: string | null }> = [];
      
      // 1. Job owner (business owner)
      const owner = await storage.getUser(job.userId);
      if (owner) {
        participants.push({
          id: owner.id,
          name: `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email || 'Owner',
          role: 'Owner',
          avatar: owner.profileImageUrl,
        });
      }
      
      // 2. Assigned tradie (if different from owner)
      if (job.assignedTo && job.assignedTo !== job.userId) {
        const assignedUser = await storage.getUser(job.assignedTo);
        if (assignedUser) {
          // Check their team role
          const membership = await storage.getTeamMembershipByMemberId(job.assignedTo);
          const role = (membership ? (await storage.getUserRole(membership.roleId))?.name : null) || 'Assigned';
          participants.push({
            id: assignedUser.id,
            name: `${assignedUser.firstName || ''} ${assignedUser.lastName || ''}`.trim() || assignedUser.email || 'Team Member',
            role: role.charAt(0).toUpperCase() + role.slice(1).toLowerCase(),
            avatar: assignedUser.profileImageUrl,
          });
        }
      }
      
      // 3. Team admins/supervisors (they have access to all jobs)
      const teamMembers = await storage.getTeamMembers(job.userId);
      for (const member of teamMembers) {
        if (member.inviteStatus !== 'accepted' || !member.isActive || !member.memberId) continue;
        const memberRoleName = (await storage.getUserRole(member.roleId))?.name || '';
        if ((memberRoleName === 'admin' || memberRoleName === 'supervisor') &&
            !participants.some(p => p.id === member.memberId)) {
          const memberUser = await storage.getUser(member.memberId);
          if (memberUser) {
            participants.push({
              id: memberUser.id,
              name: `${memberUser.firstName || ''} ${memberUser.lastName || ''}`.trim() || memberUser.email || 'Team Member',
              role: memberRoleName.charAt(0).toUpperCase() + memberRoleName.slice(1).toLowerCase(),
              avatar: memberUser.profileImageUrl,
            });
          }
        }
      }
      
      // Get client information if job has a client
      let client = null;
      if (job.clientId) {
        client = await storage.getClient(job.clientId, job.userId);
      }
      
      res.json({ 
        participants,
        jobTitle: job.title,
        participantCount: participants.length,
        client: client ? {
          id: client.id,
          name: client.name,
          phone: client.phone,
          email: client.email,
        } : null,
      });
    } catch (error: any) {
      console.error('Error getting job chat participants:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/:jobId/chat/unread", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobId = req.params.jobId;
      
      // Verify access before returning count
      const job = await getJobWithChatAccess(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found or access denied' });
      }
      
      const count = await storage.getUnreadJobChatCount(jobId, userId);
      res.json({ count });
    } catch (error: any) {
      console.error('Error getting unread count:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/jobs/:jobId/chat/:messageId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, messageId } = req.params;
      
      // Check user context for role-based deletion
      const userContext = await getUserContext(userId);
      const canDeleteAny = userContext.isOwner || hasPermission(userContext, PERMISSIONS.MANAGE_TEAM);
      
      // First verify the job belongs to this user's business
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found or access denied' });
      }
      
      // Verify job belongs to the correct business owner
      if (job.userId !== userContext.businessOwnerId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // If owner/admin/manager, can delete any message in their jobs
      if (canDeleteAny) {
        const deleted = await storage.forceDeleteJobChatMessage(messageId, jobId, job.userId);
        if (deleted) {
          return res.json({ success: true });
        }
      }
      
      // Otherwise, users can only delete their own messages
      const deleted = await storage.deleteJobChatMessage(messageId, userId);
      if (!deleted) {
        return res.status(404).json({ error: 'Message not found or not authorized' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting job chat message:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/map-data", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const effectiveUserId = userContext.effectiveUserId;
      
      let jobs = await storage.getJobs(effectiveUserId);
      const clients = await storage.getClients(effectiveUserId);
      
      if (userContext.isSubcontractor) {
        const assignedIds = await getWorkerAssignedJobIds(userContext);
        jobs = jobs.filter(job => 
          job.assignedTo === userContext.userId || 
          (userContext.teamMemberId && job.assignedTo === userContext.teamMemberId) ||
          assignedIds.has(job.id)
        );
      }
      
      const clientMap = new Map(clients.map(c => [c.id, c]));
      
      const mapData = jobs.map(job => {
        const client = clientMap.get(job.clientId);
        return {
          id: job.id,
          title: job.title,
          address: job.address || '',
          latitude: job.latitude ? parseFloat(job.latitude) : null,
          longitude: job.longitude ? parseFloat(job.longitude) : null,
          status: job.status,
          scheduledAt: job.scheduledAt,
          assignedTo: job.assignedTo,
          clientName: client?.name || 'Unknown Client',
          clientPhone: client?.phone || null,
        };
      });
      
      res.json(mapData);
    } catch (error: any) {
      console.error('Error fetching map data:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/jobs/:id/coordinates", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);

      const coordsSchema = z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      });
      const parsed = coordsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Valid latitude and longitude are required', details: parsed.error.errors });
      }
      const { latitude, longitude } = parsed.data;
      
      const job = await storage.updateJob(
        req.params.id,
        userContext.effectiveUserId,
        { latitude: latitude.toString(), longitude: longitude.toString() }
      );
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      res.json(job);
    } catch (error: any) {
      console.error('Error updating job coordinates:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/jobs/:id/booking-link", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id: jobId } = req.params;
      const { sendSms, templateId } = req.body;
      
      const job = await storage.getJob(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days
      
      const bookingLink = await storage.createSmsBookingLink({
        jobId,
        businessOwnerId: userId,
        token,
        expiresAt,
        clientResponse: null,
        clientNotes: null,
      });
      
      const baseUrl = process.env.REPLIT_DOMAIN 
        ? `https://${process.env.REPLIT_DOMAIN}`
        : process.env.BASE_URL || 'http://localhost:5000';
      
      const bookingUrl = `${baseUrl}/booking/${token}`;
      
      // Send SMS with booking link if requested
      let smsResult = null;
      if (sendSms && job.clientId) {
        const client = await storage.getClient(job.clientId, userId);
        if (client?.phone) {
          const businessSettings = await storage.getBusinessSettings(userId);
          const { sendSmsToClient, parseSmsTemplate } = await import('../services/smsService');
          
          // Get template or use default
          let templateBody = 'Hi {client_name}, your booking with {business_name} is confirmed for {scheduled_date} at {scheduled_time}. Confirm here: {booking_link}';
          if (templateId) {
            const template = await storage.getSmsTemplate(templateId, userId);
            if (template) {
              templateBody = template.body;
            }
          }
          
          // Format scheduled date/time
          const scheduledDate = job.scheduledAt 
            ? new Date(job.scheduledAt).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
            : '';
          const scheduledTime = job.scheduledAt
            ? new Date(job.scheduledAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
            : job.scheduledTime || '';
          
          // Parse template with merge fields
          const parsedMessage = parseSmsTemplate(templateBody, {
            client_name: client.name || '',
            client_first_name: client.name?.split(' ')[0] || '',
            job_title: job.title || '',
            job_address: job.address || '',
            scheduled_date: scheduledDate,
            scheduled_time: scheduledTime,
            business_name: businessSettings?.businessName || 'Your Tradesperson',
            booking_link: bookingUrl,
          });
          
          try {
            smsResult = await sendSmsToClient({
              businessOwnerId: userId,
              clientId: job.clientId,
              clientPhone: client.phone,
              clientName: client.name || undefined,
              jobId,
              message: parsedMessage,
              senderUserId: userId,
            });
            if ((smsResult as any)?.status === 'failed' && /dedicated (phone )?number/i.test((smsResult as any)?.errorMessage || '')) {
              return smsFailureResponse(res, (smsResult as any).errorMessage);
            }
          } catch (smsError: any) {
            console.error('Error sending booking SMS:', smsError);
            smsResult = { error: smsError.message };
          }
        }
      }
      
      res.status(201).json({
        ...bookingLink,
        url: bookingUrl,
        smsResult,
      });
    } catch (error: any) {
      console.error('Error creating booking link:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/jobs/:id/tracking-link", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id: jobId } = req.params;
      
      const job = await storage.getJob(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      // Check if there's already an active tracking link for this job
      const existingLink = await storage.getSmsTrackingLinkByJobId(jobId);
      if (existingLink && existingLink.isActive && new Date(existingLink.expiresAt) > new Date()) {
        const baseUrl = process.env.REPLIT_DOMAIN 
          ? `https://${process.env.REPLIT_DOMAIN}`
          : process.env.BASE_URL || 'http://localhost:5000';
        return res.json({
          ...existingLink,
          url: `${baseUrl}/track/${existingLink.token}`,
        });
      }
      
      // Deactivate any existing links
      if (existingLink) {
        await storage.deactivateSmsTrackingLink(existingLink.id);
      }
      
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Expires in 24 hours
      
      // Get business owner ID (for team scenarios)
      const userContext = await getUserContext(userId);
      
      const trackingLink = await storage.createSmsTrackingLink({
        jobId,
        teamMemberId: userId,
        businessOwnerId: userContext.effectiveUserId,
        token,
        expiresAt,
        estimatedArrival: null,
      });
      
      const baseUrl = process.env.REPLIT_DOMAIN 
        ? `https://${process.env.REPLIT_DOMAIN}`
        : process.env.BASE_URL || 'http://localhost:5000';
      
      res.status(201).json({
        ...trackingLink,
        url: `${baseUrl}/track/${token}`,
      });
    } catch (error: any) {
      console.error('Error creating tracking link:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/:jobId/form-submissions", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      
      // Resolve to the business owner's id — workers submit against the
      // owner's job, so scoping by the raw worker id returned [] and their
      // own completed job cards never showed up.
      const userContext = await getUserContext(userId);
      const submissions = await storage.getFormSubmissionsByJob(jobId, userContext.effectiveUserId);
      res.json(submissions);
    } catch (error: any) {
      console.error('Error fetching job form submissions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/jobs/:jobId/form-submissions", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;

      const { ...payload } = req.body || {};

      // Validate referenced form and job belong to this business (cross-business write guard)
      const userContext = await getUserContext(userId);
      if (!payload.formId) {
        return res.status(400).json({ error: 'formId is required' });
      }
      const form = await storage.getCustomForm(payload.formId, userContext.effectiveUserId);
      if (!form) {
        return res.status(404).json({ error: 'Form not found' });
      }
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Normalize mobile payload key (`data`) to the DB column (`submissionData`)
      if (payload.submissionData === undefined && payload.data !== undefined) {
        payload.submissionData = payload.data;
      }
      delete payload.data;

      // Strip server-controlled fields (mass-assignment guard)
      delete payload.id;
      delete payload.submittedBy;
      delete payload.submittedAt;
      delete payload.reviewedBy;
      delete payload.reviewedAt;
      delete payload.status;
      delete payload.customerUserId;

      const submission = await storage.createFormSubmission({
        ...payload,
        jobId,
        submittedBy: userId,
        submittedAt: new Date(),
      });

      // Spawn follow-up tasks from the form's owner-defined task rules
      try {
        const answers = (submission as any).submissionData || payload?.submissionData || {};
        await evaluateTaskRules({ form, submission, answers, ownerUserId: userContext.effectiveUserId, jobId, assignedBy: userId });
      } catch (e) {
        console.error('[taskRules] job form-submission hook failed:', e);
      }

      res.status(201).json(submission);
    } catch (error: any) {
      console.error('Error creating job form submission:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/:jobId/reminders", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      
      // Verify job ownership
      const job = await storage.getJob(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const reminders = await storage.getJobReminders(jobId);
      res.json(reminders);
    } catch (error: any) {
      console.error('Error getting job reminders:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/jobs/:jobId/reminders", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      const { type, sendAt, hoursBeforeJob } = req.body;
      
      // Verify job ownership
      const job = await storage.getJob(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      if (!sendAt) {
        return res.status(400).json({ error: 'sendAt is required' });
      }
      
      const reminder = await storage.createJobReminder({
        jobId,
        userId,
        type: type || 'sms',
        sendAt: new Date(sendAt),
        hoursBeforeJob: hoursBeforeJob || 24,
        status: 'pending',
      });
      
      res.json(reminder);
    } catch (error: any) {
      console.error('Error creating job reminder:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/jobs/:jobId/reminders/cancel", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      
      // Verify job ownership
      const job = await storage.getJob(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      await storage.cancelJobReminders(jobId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error cancelling job reminders:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/:jobId/photo-requirements", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      
      // Verify job ownership
      const job = await storage.getJob(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const requirements = await storage.getJobPhotoRequirements(jobId);
      res.json(requirements);
    } catch (error: any) {
      console.error('Error getting photo requirements:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/jobs/:jobId/photo-requirements", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      const { stage, description, isRequired } = req.body;
      
      // Verify job ownership
      const job = await storage.getJob(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      if (!stage || !description) {
        return res.status(400).json({ error: 'stage and description are required' });
      }
      
      const requirement = await storage.createJobPhotoRequirement({
        jobId,
        stage,
        description,
        isRequired: isRequired !== false,
      });
      
      res.json(requirement);
    } catch (error: any) {
      console.error('Error creating photo requirement:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/:jobId/invites", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobId = req.params.jobId;

      // Verify job exists and belongs to user
      const job = await storage.getJob(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const invites = await storage.getJobInvites(jobId, userId);
      res.json(invites);
    } catch (error: any) {
      console.error('Error getting job invites:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/jobs/:jobId/invites", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobId = req.params.jobId;

      // Verify job exists and belongs to user
      const job = await storage.getJob(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const { email, role, permissions, expiresAt } = req.body;

      const inviteData = {
        jobId,
        userId,
        email: email || null,
        role: role || 'subcontractor',
        permissions: permissions || ['view_job', 'add_notes'],
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        status: 'pending' as const,
        inviteCode: '', // Will be generated by storage
      };

      const invite = await storage.createJobInvite(inviteData);
      
      // Build invite link
      const baseUrl = getProductionBaseUrl(req);
      const inviteLink = `${baseUrl}/invite/${invite.inviteCode}`;

      res.json({
        ...invite,
        inviteLink,
      });
    } catch (error: any) {
      console.error('Error creating job invite:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/jobs/:jobId/invites/:inviteId", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, inviteId } = req.params;

      // Verify job exists and belongs to user
      const job = await storage.getJob(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const revokedInvite = await storage.revokeJobInvite(inviteId, userId);
      if (!revokedInvite) {
        return res.status(404).json({ error: 'Invite not found' });
      }

      res.json({ success: true, invite: revokedInvite });
    } catch (error: any) {
      console.error('Error revoking job invite:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/:jobId/swms", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const userId = userContext.effectiveUserId;
      const docs = await db.select().from(swmsDocuments).where(and(eq(swmsDocuments.jobId, req.params.jobId), eq(swmsDocuments.userId, userId))).orderBy(desc(swmsDocuments.createdAt));
      const docsWithCounts = await Promise.all(docs.map(async (doc) => {
        const hazardCount = await db.select({ count: sql<number>`count(*)` }).from(swmsHazards).where(eq(swmsHazards.swmsId, doc.id));
        const sigCount = await db.select({ count: sql<number>`count(*)` }).from(swmsSignatures).where(eq(swmsSignatures.swmsId, doc.id));
        return { ...doc, hazardCount: Number(hazardCount[0]?.count || 0), signatureCount: Number(sigCount[0]?.count || 0) };
      }));
      res.json(docsWithCounts);
    } catch (error: any) {
      console.error("Error fetching job SWMS:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Project Templates ─────────────────────────────────────────────────────

  app.get("/api/project-templates", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const templates = await storage.getProjectTemplates(effectiveUserId);
      res.json(templates);
    } catch (error: any) {
      console.error("Error fetching project templates:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/project-templates", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const bodySchema = z.object({
        name: z.string().min(1, "Template name is required").max(200),
        description: z.string().max(1000).optional(),
        templateData: z.object({
          phases: z.array(z.object({
            phaseCode: z.string().min(1).max(20),
            name: z.string().min(1),
            description: z.string().optional(),
            bookedHours: z.string().optional(),
          })),
          settings: z.object({
            materialMarkupPct: z.string().optional(),
            equipmentMarkupPct: z.string().optional(),
            subcontractorMarkupPct: z.string().optional(),
            budgetedCost: z.string().optional(),
            description: z.string().optional(),
          }).optional(),
        }),
      });
      const parsed = bodySchema.parse(req.body);
      const template = await storage.createProjectTemplate({
        ...parsed,
        userId: effectiveUserId,
      });
      res.status(201).json(template);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid template data", details: error.errors });
      }
      console.error("Error creating project template:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/project-templates/:id", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const { id } = req.params;
      const deleted = await storage.deleteProjectTemplate(id, effectiveUserId);
      if (!deleted) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting project template:", error);
      res.status(500).json({ error: error.message });
    }
  });

  }
  
