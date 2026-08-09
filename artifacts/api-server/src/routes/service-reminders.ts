import type { Express } from "express";
import { z } from "zod";
import { storage, db } from "../storage";
import { eq, sql, desc, asc, and, gte, lte, lt, isNotNull, isNull, inArray, or, count, sum, ne } from "drizzle-orm";
import { requireAuth } from "./middleware";
import { ownerOnly, ownerOrManagerOnly, createPermissionMiddleware, PERMISSIONS, getUserContext } from "../permissions";
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

export function registerServiceRemindersRoutes(app: Express): void {
  // Service Reminders Routes
  app.get("/api/service-reminders", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const reminders = await storage.getServiceReminders(userContext.effectiveUserId);
      res.json(reminders);
    } catch (error) {
      console.error("Error fetching service reminders:", error);
      res.status(500).json({ error: "Failed to fetch service reminders" });
    }
  });

  app.get("/api/service-reminders/upcoming", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const days = parseInt(req.query.days as string) || 30;
      const reminders = await storage.getUpcomingServiceReminders(userContext.effectiveUserId, days);
      res.json(reminders);
    } catch (error) {
      console.error("Error fetching upcoming service reminders:", error);
      res.status(500).json({ error: "Failed to fetch upcoming service reminders" });
    }
  });

  app.get("/api/service-reminders/:id", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const reminder = await storage.getServiceReminderById(req.params.id, userContext.effectiveUserId);
      if (!reminder) {
        return res.status(404).json({ error: "Service reminder not found" });
      }
      res.json(reminder);
    } catch (error) {
      console.error("Error fetching service reminder:", error);
      res.status(500).json({ error: "Failed to fetch service reminder" });
    }
  });

  app.post("/api/service-reminders", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const validatedData = insertServiceReminderSchema.parse({
        ...req.body,
        userId: userContext.effectiveUserId,
      });
      const reminder = await storage.createServiceReminder(validatedData);
      res.status(201).json(reminder);
    } catch (error) {
      console.error("Error creating service reminder:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create service reminder" });
    }
  });

  app.patch("/api/service-reminders/:id", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const patchData = { ...req.body }; delete patchData.id; delete patchData.userId; delete patchData.businessOwnerId; delete patchData.createdAt; delete patchData.updatedAt;
      const reminder = await storage.updateServiceReminder(req.params.id, userContext.effectiveUserId, patchData);
      if (!reminder) {
        return res.status(404).json({ error: "Service reminder not found" });
      }
      res.json(reminder);
    } catch (error) {
      console.error("Error updating service reminder:", error);
      res.status(500).json({ error: "Failed to update service reminder" });
    }
  });

  app.delete("/api/service-reminders/:id", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const success = await storage.deleteServiceReminder(req.params.id, userContext.effectiveUserId);
      if (!success) {
        return res.status(404).json({ error: "Service reminder not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting service reminder:", error);
      res.status(500).json({ error: "Failed to delete service reminder" });
    }
  });

  app.post("/api/service-reminders/:id/complete", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { scheduleNext } = req.body;
      
      const reminder = await storage.getServiceReminderById(req.params.id, userContext.effectiveUserId);
      if (!reminder) {
        return res.status(404).json({ error: "Service reminder not found" });
      }

      // Mark as completed
      const updated = await storage.updateServiceReminder(req.params.id, userContext.effectiveUserId, {
        status: 'completed',
      });

      // Optionally schedule next occurrence
      if (scheduleNext && reminder.intervalMonths) {
        const nextDueDate = new Date(reminder.nextDueDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + reminder.intervalMonths);
        
        const newReminder = await storage.createServiceReminder({
          jobId: reminder.jobId,
          clientId: reminder.clientId,
          userId: reminder.userId,
          serviceType: reminder.serviceType,
          nextDueDate: nextDueDate,
          intervalMonths: reminder.intervalMonths,
          reminderDays: reminder.reminderDays,
          notes: reminder.notes,
          status: 'pending',
        });
        
        return res.json({ completed: updated, scheduled: newReminder });
      }

      res.json({ completed: updated });
    } catch (error) {
      console.error("Error completing service reminder:", error);
      res.status(500).json({ error: "Failed to complete service reminder" });
    }
  });

}
