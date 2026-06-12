import type { Express } from "express";
import { z } from "zod";
import { storage, db } from "../storage";
import { eq, sql, desc, asc, and, gte, lte, lt, isNotNull, isNull, inArray, or, count, sum, ne } from "drizzle-orm";
import { requireAuth } from "./middleware";
import { ownerOnly, createPermissionMiddleware, PERMISSIONS, getUserContext } from "../permissions";
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

      res.status(201).json(submission);
    } catch (error: any) {
      console.error("Error submitting form:", error);
      res.status(500).json({ error: error.message });
    }
  });

}
