import type { Express } from "express";
import { z } from "zod";
import multer from "multer";
import { storage, db } from "../storage";
import { eq, sql, desc, asc, and, gte, lte, lt, isNotNull, isNull, inArray, or, count, sum, ne } from "drizzle-orm";
import { requireAuth, visionPerUserLimiter } from "./middleware";
import { extractFormFromImages, extractFormFromText } from "../ai";
import { ownerOnly, createPermissionMiddleware, PERMISSIONS, getUserContext } from "../permissions";
import { evaluateTaskRules } from "../taskRules";
import {
  equipmentCategories,
  jobEquipment,
  insertServiceReminderSchema,
  insertEquipmentSchema,
  insertEquipmentCategorySchema,
  insertEquipmentMaintenanceSchema,
  insertInventoryItemSchema,
  insertInventoryCategorySchema,
  insertInventoryTransactionSchema,
  insertSupplierSchema,
  insertPurchaseOrderSchema,
  insertPurchaseOrderItemSchema,
  insertRebateSchema,
  insertTeamGroupSchema,
} from "@workspace/db";

export function registerCustomFormsRoutes(app: Express): void {
  // ============================================================
  // AI form rebuild from uploaded checklists (Task: AI import)
  // Accepts image / PDF / Excel uploads and returns a DRAFT form
  // definition. Nothing is saved — the client opens the draft in
  // the form builder for review, and saving goes through the
  // normal POST /api/custom-forms.
  // ============================================================

  const aiImportUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024, files: 5 },
  });

  // HEIC/HEIF intentionally not accepted — the vision API can't read them and
  // we don't transcode server-side. iOS Safari converts to JPEG when the
  // input accept list omits HEIC.
  const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  const EXCEL_MIME_TYPES = new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
  ]);

  app.post("/api/custom-forms/ai-import", requireAuth, visionPerUserLimiter, (req: any, res, next) => {
    aiImportUpload.array('files', 5)(req, res, (err: any) => {
      if (err) {
        const msg = err.code === 'LIMIT_FILE_SIZE'
          ? 'File too large. Maximum size is 15MB per file.'
          : (err.message || 'Upload failed');
        return res.status(400).json({ error: msg });
      }
      next();
    });
  }, async (req: any, res) => {
    try {
      const files: Express.Multer.File[] = req.files || [];
      if (files.length === 0) {
        return res.status(400).json({ error: 'Please upload a photo, PDF or spreadsheet of your form.' });
      }

      const images: Array<{ buffer: Buffer; mimeType: string }> = [];
      const textParts: string[] = [];

      for (const file of files) {
        const name = (file.originalname || '').toLowerCase();
        const mime = file.mimetype || '';

        if (IMAGE_MIME_TYPES.has(mime)) {
          images.push({ buffer: file.buffer, mimeType: mime });
        } else if (mime === 'image/heic' || mime === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif')) {
          return res.status(400).json({
            error: `HEIC photos aren't supported yet (${file.originalname}). Please upload a JPG or PNG — on iPhone, share/export the photo as JPEG.`,
          });
        } else if (mime === 'application/pdf' || name.endsWith('.pdf')) {
          // @ts-ignore — pdfjs-dist types may not be available in this workspace config
          const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
          const doc = await pdfjs.getDocument({ data: new Uint8Array(file.buffer), useSystemFonts: true }).promise;
          const pageTexts: string[] = [];
          const maxPages = Math.min(doc.numPages, 20);
          for (let i = 1; i <= maxPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            pageTexts.push(content.items.map((it: any) => it.str).join(' '));
          }
          await doc.destroy();
          const pdfText = pageTexts.join('\n\n').trim();
          if (pdfText.length < 40) {
            return res.status(422).json({
              error: 'This PDF looks like a scan with no readable text. Please upload a clear photo of the form instead.',
            });
          }
          textParts.push(pdfText);
        } else if (EXCEL_MIME_TYPES.has(mime) || name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
          const XLSX = await import('xlsx');
          const wb = XLSX.read(file.buffer, { type: 'buffer' });
          for (const sheetName of wb.SheetNames.slice(0, 10)) {
            const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName], { blankrows: false });
            if (csv.trim()) textParts.push(`Sheet: ${sheetName}\n${csv}`);
          }
          if (textParts.length === 0) {
            return res.status(422).json({ error: 'That spreadsheet appears to be empty.' });
          }
        } else {
          return res.status(400).json({
            error: `Unsupported file type: ${file.originalname}. Upload a photo (JPG/PNG), PDF or Excel/CSV file.`,
          });
        }
      }

      if (images.length > 0 && textParts.length > 0) {
        return res.status(400).json({ error: 'Please upload either photos OR a document, not a mix.' });
      }

      const draft = images.length > 0
        ? await extractFormFromImages(images)
        : await extractFormFromText(textParts.join('\n\n---\n\n'));

      if (!draft.fields || draft.fields.length === 0) {
        return res.status(422).json({
          error: "Couldn't find any form fields in that file. Make sure the upload shows a checklist or form, and try a clearer photo if it was scanned.",
        });
      }

      res.json({ draft });
    } catch (error: any) {
      if (error?.name === 'BackpressureError') {
        return res.status(429).json({ error: 'AI is busy right now. Please try again in a moment.' });
      }
      console.error('[AI form import] error:', error);
      res.status(500).json({ error: 'Failed to read that file. Please try again or build the form manually.' });
    }
  });

  // ============================================================
  // Form Submission with Validation (T006)
  // ============================================================

  app.post("/api/custom-forms/:formId/submit", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { formId } = req.params;
      const { data, jobId } = req.body;

      // Shared business form, or the submitter's own personal form.
      let form = await storage.getCustomForm(formId, userContext.effectiveUserId);
      if (!form && userContext.effectiveUserId !== req.userId) {
        form = await storage.getCustomForm(formId, req.userId);
      }
      if (!form) return res.status(404).json({ error: "Form not found" });

      const fields = (form.fields as any[]) || [];
      const errors: string[] = [];

      const isFieldVisible = (field: any): boolean => {
        const cl = field.conditionalLogic;
        if (!cl) return true;

        if (cl.enabled && cl.rules && Array.isArray(cl.rules)) {
          let visible = true;
          for (const rule of cl.rules) {
            const depVal = data?.[rule.fieldId];
            let match = false;
            if (rule.operator === 'equals') match = depVal === rule.value;
            else if (rule.operator === 'not_equals') match = depVal !== rule.value;
            else if (rule.operator === 'contains') match = String(depVal || '').includes(rule.value);
            else if (rule.operator === 'not_empty') match = depVal !== undefined && depVal !== null && depVal !== '';
            else if (rule.operator === 'is_empty') match = depVal === undefined || depVal === null || depVal === '';
            if (!match) { visible = false; break; }
          }
          if (cl.action === 'hide') visible = !visible;
          return visible;
        }

        if (cl.fieldId && cl.operator) {
          const depVal = data?.[cl.fieldId];
          let visible = true;
          if (cl.operator === 'equals') visible = depVal === cl.value;
          else if (cl.operator === 'not_equals') visible = depVal !== cl.value;
          else if (cl.operator === 'contains') visible = String(depVal || '').includes(cl.value);
          if (cl.action === 'hide') visible = !visible;
          return visible;
        }

        return true;
      };

      for (const field of fields) {
        if (!isFieldVisible(field)) continue;

        if (field.required && (!data || data[field.id] === undefined || data[field.id] === null || data[field.id] === '')) {
          errors.push(`${field.label} is required`);
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({ error: "Validation failed", errors });
      }

      // Ensure any linked job belongs to this business (prevent cross-business linking)
      if (jobId) {
        const job = await storage.getJob(jobId, userContext.effectiveUserId);
        if (!job) return res.status(404).json({ error: "Job not found" });
      }

      const submission = await storage.createFormSubmission({
        formId,
        jobId: jobId || null,
        submittedBy: req.userId,
        submittedAt: new Date(),
        submissionData: data,
        status: 'submitted',
      });

      // Spawn follow-up tasks from the form's owner-defined task rules
      try {
        await evaluateTaskRules({ form, submission, answers: data || {}, ownerUserId: userContext.effectiveUserId, jobId: jobId || null, assignedBy: userContext.effectiveUserId });
      } catch (e) {
        console.error('[taskRules] custom-form submission hook failed:', e);
      }

      res.status(201).json(submission);
    } catch (error: any) {
      console.error("Error submitting form:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // Follow-up Tasks (spawned by form task rules, or manual)
  // ============================================================

  // List tasks (owner scope); optional ?jobId= filter
  app.get("/api/tasks", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : undefined;
      const list = await storage.getTasks(userContext.effectiveUserId, jobId);
      res.json(list);
    } catch (error: any) {
      console.error("Error listing tasks:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Tasks for a specific job
  app.get("/api/jobs/:jobId/tasks", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { jobId } = req.params;
      const list = await storage.getTasks(userContext.effectiveUserId, jobId);
      res.json(list);
    } catch (error: any) {
      console.error("Error listing job tasks:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create a task manually (owner only)
  app.post("/api/tasks", ownerOnly(), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { title, description, jobId, assignedTo, dueAt } = req.body || {};
      if (!title || !String(title).trim()) {
        return res.status(400).json({ error: "title is required" });
      }
      if (jobId) {
        const job = await storage.getJob(jobId, userContext.effectiveUserId);
        if (!job) return res.status(404).json({ error: "Job not found" });
      }
      const task = await storage.createTask({
        userId: userContext.effectiveUserId,
        jobId: jobId || null,
        title: String(title).slice(0, 500),
        description: description || null,
        status: 'open',
        assignedTo: assignedTo || null,
        dueAt: dueAt ? new Date(dueAt) : null,
        source: 'manual',
      } as any);
      res.status(201).json(task);
    } catch (error: any) {
      console.error("Error creating task:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update a task (owner only) — title/description/status/assignedTo/dueAt
  app.patch("/api/tasks/:id", ownerOnly(), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { id } = req.params;
      const updates: any = {};
      const b = req.body || {};
      if (typeof b.title === 'string') updates.title = b.title.slice(0, 500);
      if ('description' in b) updates.description = b.description || null;
      if ('assignedTo' in b) updates.assignedTo = b.assignedTo || null;
      if ('dueAt' in b) updates.dueAt = b.dueAt ? new Date(b.dueAt) : null;

      if (b.status === 'done') {
        const done = await storage.completeTask(id, userContext.effectiveUserId, req.userId);
        if (!done) return res.status(404).json({ error: "Task not found" });
        return res.json(done);
      }
      if (b.status === 'open') {
        updates.status = 'open';
        updates.completedAt = null;
        updates.completedBy = null;
      }

      const updated = await storage.updateTask(id, userContext.effectiveUserId, updates);
      if (!updated) return res.status(404).json({ error: "Task not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating task:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a task (owner only)
  app.delete("/api/tasks/:id", ownerOnly(), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { id } = req.params;
      const ok = await storage.deleteTask(id, userContext.effectiveUserId);
      if (!ok) return res.status(404).json({ error: "Task not found" });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting task:", error);
      res.status(500).json({ error: error.message });
    }
  });

}
