import type { Express } from "express";
import { z } from "zod";
import { storage, db } from "../storage";
import { eq, sql, desc, asc, and, gte, lte, lt, isNotNull, isNull, inArray, or, count, sum, ne } from "drizzle-orm";
import { requireAuth } from "./middleware";
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
} from "@shared/schema";

export function registerCustomFormsRoutes(app: Express): void {
  // ============================================================
  // Form Submission with Validation (T006)
  // ============================================================

  app.post("/api/custom-forms/:formId/submit", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { formId } = req.params;
      const { data, jobId } = req.body;

      const form = await storage.getCustomForm(formId, userContext.effectiveUserId);
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
        submittedBy: userContext.effectiveUserId,
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
