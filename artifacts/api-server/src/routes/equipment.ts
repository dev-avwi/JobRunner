import type { Express } from "express";
import { z } from "zod";
import { storage, db } from "../storage";
import { eq, sql, desc, asc, and, gte, lte, lt, isNotNull, isNull, inArray, or, count, sum, ne } from "drizzle-orm";
import { requireAuth } from "./middleware";
import { ownerOnly, createPermissionMiddleware, PERMISSIONS, getUserContext } from "../permissions";
import {
  equipmentCategories,
  jobEquipment,
  jobs,
  equipment,
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

export function registerEquipmentRoutes(app: Express): void {
  // Equipment Management Routes
  app.get("/api/equipment/categories", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const categories = await storage.getEquipmentCategories(userContext.effectiveUserId);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching equipment categories:", error);
      res.status(500).json({ error: "Failed to fetch equipment categories" });
    }
  });

  app.post("/api/equipment/categories", requireAuth, createPermissionMiddleware(PERMISSIONS.MANAGE_CATALOG), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const validatedData = insertEquipmentCategorySchema.parse(req.body);
      const category = await storage.createEquipmentCategory({
        ...validatedData,
        userId: userContext.effectiveUserId,
      });
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating equipment category:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create equipment category" });
    }
  });

  app.get("/api/equipment", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const items = await storage.getEquipment(userContext.effectiveUserId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      res.status(500).json({ error: "Failed to fetch equipment" });
    }
  });

  app.post("/api/equipment", requireAuth, createPermissionMiddleware(PERMISSIONS.MANAGE_CATALOG), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const validatedData = insertEquipmentSchema.parse(req.body);
      if (validatedData.categoryId) {
        const categories = await storage.getEquipmentCategories(userContext.effectiveUserId);
        if (!categories.some(c => c.id === validatedData.categoryId)) {
          return res.status(404).json({ error: "Category not found" });
        }
      }
      const item = await storage.createEquipment({
        ...validatedData,
        userId: userContext.effectiveUserId,
      });
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating equipment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create equipment" });
    }
  });

  app.patch("/api/equipment/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.MANAGE_CATALOG), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const patchData = { ...req.body }; delete patchData.id; delete patchData.userId; delete patchData.businessOwnerId; delete patchData.createdAt; delete patchData.updatedAt;
      const item = await storage.updateEquipment(req.params.id, userContext.effectiveUserId, patchData);
      if (!item) {
        return res.status(404).json({ error: "Equipment not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error updating equipment:", error);
      res.status(500).json({ error: "Failed to update equipment" });
    }
  });

  app.delete("/api/equipment/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.MANAGE_CATALOG), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const success = await storage.deleteEquipment(req.params.id, userContext.effectiveUserId);
      if (!success) {
        return res.status(404).json({ error: "Equipment not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting equipment:", error);
      res.status(500).json({ error: "Failed to delete equipment" });
    }
  });

  app.get("/api/equipment/:id/maintenance", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const records = await storage.getEquipmentMaintenance(req.params.id, userContext.effectiveUserId);
      res.json(records);
    } catch (error) {
      console.error("Error fetching maintenance records:", error);
      res.status(500).json({ error: "Failed to fetch maintenance records" });
    }
  });

  app.post("/api/equipment/:id/maintenance", requireAuth, createPermissionMiddleware(PERMISSIONS.MANAGE_CATALOG), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const equipmentItem = await storage.getEquipmentById(req.params.id, userContext.effectiveUserId);
      if (!equipmentItem) {
        return res.status(404).json({ error: "Equipment not found" });
      }
      const validatedData = insertEquipmentMaintenanceSchema.parse({
        ...req.body,
        equipmentId: req.params.id,
      });
      const record = await storage.createEquipmentMaintenance({
        ...validatedData,
        userId: userContext.effectiveUserId,
      });
      res.status(201).json(record);
    } catch (error) {
      console.error("Error creating maintenance record:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create maintenance record" });
    }
  });

  app.get("/api/job-equipment-summary", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const results = await db
        .select({ jobId: jobEquipment.jobId })
        .from(jobEquipment)
        .where(eq(jobEquipment.userId, userContext.effectiveUserId));
      const jobIds = Array.from(new Set(results.map(r => r.jobId)));
      res.json(jobIds);
    } catch (error) {
      console.error("Error fetching job equipment summary:", error);
      res.status(500).json({ error: "Failed to fetch job equipment summary" });
    }
  });

  app.get("/api/equipment/:id/assignments", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const assignments = await db
        .select({
          id: jobEquipment.id,
          jobId: jobEquipment.jobId,
          equipmentId: jobEquipment.equipmentId,
          userId: jobEquipment.userId,
          notes: jobEquipment.notes,
          assignedAt: jobEquipment.assignedAt,
          hoursUsed: jobEquipment.hoursUsed,
          kmTravelled: jobEquipment.kmTravelled,
          capacityUsed: jobEquipment.capacityUsed,
          capacityAvailable: jobEquipment.capacityAvailable,
          postJobNotes: jobEquipment.postJobNotes,
          wasOversized: jobEquipment.wasOversized,
          completedAt: jobEquipment.completedAt,
          jobTitle: jobs.title,
          jobStatus: jobs.status,
        })
        .from(jobEquipment)
        .innerJoin(jobs, eq(jobs.id, jobEquipment.jobId))
        .where(and(
          eq(jobEquipment.equipmentId, req.params.id),
          eq(jobs.userId, userContext.effectiveUserId)
        ))
        .orderBy(desc(jobEquipment.assignedAt));
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching equipment assignments:", error);
      res.status(500).json({ error: "Failed to fetch equipment assignments" });
    }
  });

  // Job Equipment Assignments




}
