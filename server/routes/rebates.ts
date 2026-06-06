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

export function registerRebatesRoutes(app: Express): void {
  // Rebates / Credits Routes
  app.get("/api/rebates", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const rebates = await storage.getRebates(userContext.effectiveUserId);
      res.json(rebates);
    } catch (error) {
      console.error("Error fetching rebates:", error);
      res.status(500).json({ error: "Failed to fetch rebates" });
    }
  });

  app.get("/api/rebates/summary", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const summary = await storage.getRebatesSummary(userContext.effectiveUserId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching rebates summary:", error);
      res.status(500).json({ error: "Failed to fetch rebates summary" });
    }
  });

  app.get("/api/rebates/:id", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const rebate = await storage.getRebateById(req.params.id, userContext.effectiveUserId);
      if (!rebate) {
        return res.status(404).json({ error: "Rebate not found" });
      }
      res.json(rebate);
    } catch (error) {
      console.error("Error fetching rebate:", error);
      res.status(500).json({ error: "Failed to fetch rebate" });
    }
  });

  app.post("/api/rebates", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_EXPENSES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const validatedData = insertRebateSchema.parse({
        ...req.body,
        userId: userContext.effectiveUserId,
      });
      const rebate = await storage.createRebate(validatedData);
      res.status(201).json(rebate);
    } catch (error) {
      console.error("Error creating rebate:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create rebate" });
    }
  });

  app.patch("/api/rebates/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_EXPENSES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const patchData = { ...req.body }; delete patchData.id; delete patchData.userId; delete patchData.businessOwnerId; delete patchData.createdAt; delete patchData.updatedAt;
      const rebate = await storage.updateRebate(req.params.id, userContext.effectiveUserId, patchData);
      if (!rebate) {
        return res.status(404).json({ error: "Rebate not found" });
      }
      res.json(rebate);
    } catch (error) {
      console.error("Error updating rebate:", error);
      res.status(500).json({ error: "Failed to update rebate" });
    }
  });

  app.delete("/api/rebates/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_EXPENSES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const success = await storage.deleteRebate(req.params.id, userContext.effectiveUserId);
      if (!success) {
        return res.status(404).json({ error: "Rebate not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting rebate:", error);
      res.status(500).json({ error: "Failed to delete rebate" });
    }
  });

  app.post("/api/rebates/:id/submit", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_EXPENSES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const rebate = await storage.updateRebate(req.params.id, userContext.effectiveUserId, {
        status: 'submitted',
        submittedAt: new Date(),
      });
      if (!rebate) {
        return res.status(404).json({ error: "Rebate not found" });
      }
      res.json(rebate);
    } catch (error) {
      console.error("Error submitting rebate:", error);
      res.status(500).json({ error: "Failed to submit rebate" });
    }
  });

  app.post("/api/rebates/:id/receive", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_EXPENSES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const rebate = await storage.updateRebate(req.params.id, userContext.effectiveUserId, {
        status: 'received',
        receivedAt: new Date(),
      });
      if (!rebate) {
        return res.status(404).json({ error: "Rebate not found" });
      }
      res.json(rebate);
    } catch (error) {
      console.error("Error receiving rebate:", error);
      res.status(500).json({ error: "Failed to receive rebate" });
    }
  });

}
