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

export function registerInventoryRoutes(app: Express): void {
  // ============================================================
  // Inventory Management Routes
  // ============================================================
  
  app.get("/api/inventory/categories", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const categories = await storage.getInventoryCategories(userContext.effectiveUserId);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching inventory categories:", error);
      res.status(500).json({ error: "Failed to fetch inventory categories" });
    }
  });

  app.post("/api/inventory/categories", requireAuth, createPermissionMiddleware(PERMISSIONS.MANAGE_CATALOG), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const parsed = insertInventoryCategorySchema.parse(req.body);
      const category = await storage.createInventoryCategory({ ...parsed, userId: userContext.effectiveUserId });
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating inventory category:", error);
      res.status(500).json({ error: "Failed to create inventory category" });
    }
  });

  app.patch("/api/inventory/categories/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.MANAGE_CATALOG), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const patchData = { ...req.body }; delete patchData.id; delete patchData.userId; delete patchData.businessOwnerId; delete patchData.createdAt; delete patchData.updatedAt;
      const updated = await storage.updateInventoryCategory(req.params.id, userContext.effectiveUserId, patchData);
      if (!updated) return res.status(404).json({ error: "Category not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating inventory category:", error);
      res.status(500).json({ error: "Failed to update inventory category" });
    }
  });

  app.delete("/api/inventory/categories/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.MANAGE_CATALOG), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const deleted = await storage.deleteInventoryCategory(req.params.id, userContext.effectiveUserId);
      if (!deleted) return res.status(404).json({ error: "Category not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting inventory category:", error);
      res.status(500).json({ error: "Failed to delete inventory category" });
    }
  });

  app.get("/api/inventory/items", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const categoryId = req.query.categoryId as string | undefined;
      const items = await storage.getInventoryItems(userContext.effectiveUserId, categoryId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching inventory items:", error);
      res.status(500).json({ error: "Failed to fetch inventory items" });
    }
  });

  app.get("/api/inventory/items/:id", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const item = await storage.getInventoryItem(req.params.id, userContext.effectiveUserId);
      if (!item) return res.status(404).json({ error: "Item not found" });
      res.json(item);
    } catch (error) {
      console.error("Error fetching inventory item:", error);
      res.status(500).json({ error: "Failed to fetch inventory item" });
    }
  });

  app.post("/api/inventory/items", requireAuth, createPermissionMiddleware(PERMISSIONS.MANAGE_CATALOG), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const parsed = insertInventoryItemSchema.parse(req.body);
      if (parsed.categoryId) {
        const categories = await storage.getInventoryCategories(userContext.effectiveUserId);
        if (!categories.some(c => c.id === parsed.categoryId)) {
          return res.status(404).json({ error: "Category not found" });
        }
      }
      const item = await storage.createInventoryItem({ ...parsed, userId: userContext.effectiveUserId });
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating inventory item:", error);
      res.status(500).json({ error: "Failed to create inventory item" });
    }
  });

  app.patch("/api/inventory/items/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.MANAGE_CATALOG), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const patchData = { ...req.body }; delete patchData.id; delete patchData.userId; delete patchData.businessOwnerId; delete patchData.createdAt; delete patchData.updatedAt;
      const updated = await storage.updateInventoryItem(req.params.id, userContext.effectiveUserId, patchData);
      if (!updated) return res.status(404).json({ error: "Item not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating inventory item:", error);
      res.status(500).json({ error: "Failed to update inventory item" });
    }
  });

  app.delete("/api/inventory/items/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.MANAGE_CATALOG), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const deleted = await storage.deleteInventoryItem(req.params.id, userContext.effectiveUserId);
      if (!deleted) return res.status(404).json({ error: "Item not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting inventory item:", error);
      res.status(500).json({ error: "Failed to delete inventory item" });
    }
  });

  app.get("/api/inventory/items/:id/transactions", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const transactions = await storage.getInventoryTransactions(userContext.effectiveUserId, req.params.id);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching inventory transactions:", error);
      res.status(500).json({ error: "Failed to fetch inventory transactions" });
    }
  });

  app.post("/api/inventory/items/:id/transactions", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const item = await storage.getInventoryItem(req.params.id, userContext.effectiveUserId);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }
      const parsed = insertInventoryTransactionSchema.parse(req.body);
      const transaction = await storage.createInventoryTransaction({
        ...parsed,
        itemId: req.params.id,
        userId: userContext.effectiveUserId,
      });

      if (item) {
        const currentStock = parseInt(String(item.currentStock || '0'));
        const qty = parsed.quantity || 0;
        let newStock = currentStock;
        if (parsed.type === 'stock_in' || parsed.type === 'in' || parsed.type === 'purchase' || parsed.type === 'return') {
          newStock = currentStock + qty;
        } else if (parsed.type === 'stock_out' || parsed.type === 'out' || parsed.type === 'usage' || parsed.type === 'damage') {
          newStock = currentStock - qty;
        } else if (parsed.type === 'adjustment') {
          newStock = qty;
        }
        await storage.updateInventoryItem(req.params.id, userContext.effectiveUserId, {
          currentStock: newStock,
        } as any);
      }

      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error creating inventory transaction:", error);
      res.status(500).json({ error: "Failed to create inventory transaction" });
    }
  });

  app.get("/api/inventory/low-stock", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const items = await storage.getInventoryItems(userContext.effectiveUserId);
      const lowStock = items.filter(item => {
        const current = parseInt(String(item.currentStock || '0'));
        const minimum = parseInt(String(item.minimumStock || '0'));
        return minimum > 0 && current <= minimum;
      });
      res.json(lowStock);
    } catch (error) {
      console.error("Error fetching low stock items:", error);
      res.status(500).json({ error: "Failed to fetch low stock items" });
    }
  });

  // ============================================================
  // Supplier Management Routes
  // ============================================================

  app.get("/api/suppliers", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const result = await storage.getSuppliers(userContext.effectiveUserId);
      res.json(result);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ error: "Failed to fetch suppliers" });
    }
  });

  app.get("/api/suppliers/:id", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const supplier = await storage.getSupplier(req.params.id, userContext.effectiveUserId);
      if (!supplier) return res.status(404).json({ error: "Supplier not found" });
      res.json(supplier);
    } catch (error) {
      console.error("Error fetching supplier:", error);
      res.status(500).json({ error: "Failed to fetch supplier" });
    }
  });

  app.post("/api/suppliers", requireAuth, createPermissionMiddleware(PERMISSIONS.MANAGE_CATALOG), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const parsed = insertSupplierSchema.parse(req.body);
      const supplier = await storage.createSupplier({ ...parsed, userId: userContext.effectiveUserId });
      res.status(201).json(supplier);
    } catch (error) {
      console.error("Error creating supplier:", error);
      res.status(500).json({ error: "Failed to create supplier" });
    }
  });

  app.patch("/api/suppliers/:id", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const patchData = { ...req.body }; delete patchData.id; delete patchData.userId; delete patchData.businessOwnerId; delete patchData.createdAt; delete patchData.updatedAt;
      const updated = await storage.updateSupplier(req.params.id, userContext.effectiveUserId, patchData);
      if (!updated) return res.status(404).json({ error: "Supplier not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating supplier:", error);
      res.status(500).json({ error: "Failed to update supplier" });
    }
  });

  app.delete("/api/suppliers/:id", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const deleted = await storage.deleteSupplier(req.params.id, userContext.effectiveUserId);
      if (!deleted) return res.status(404).json({ error: "Supplier not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting supplier:", error);
      res.status(500).json({ error: "Failed to delete supplier" });
    }
  });

  // ============================================================
  // Purchase Order Routes
  // ============================================================

  app.get("/api/purchase-orders", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const orders = await storage.getPurchaseOrders(userContext.effectiveUserId);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
      res.status(500).json({ error: "Failed to fetch purchase orders" });
    }
  });

  app.get("/api/purchase-orders/:id", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const po = await storage.getPurchaseOrder(req.params.id, userContext.effectiveUserId);
      if (!po) return res.status(404).json({ error: "Purchase order not found" });
      const items = await storage.getPurchaseOrderItems(req.params.id);
      res.json({ ...po, items });
    } catch (error) {
      console.error("Error fetching purchase order:", error);
      res.status(500).json({ error: "Failed to fetch purchase order" });
    }
  });

  app.post("/api/purchase-orders", requireAuth, createPermissionMiddleware(PERMISSIONS.MANAGE_CATALOG), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { items: poItems, ...poData } = req.body;
      const parsed = insertPurchaseOrderSchema.parse(poData);
      if (parsed.supplierId) {
        const supplier = await storage.getSupplier(parsed.supplierId, userContext.effectiveUserId);
        if (!supplier) {
          return res.status(404).json({ error: "Supplier not found" });
        }
      }
      if (poItems && Array.isArray(poItems)) {
        for (const item of poItems) {
          if (item?.inventoryItemId) {
            const invItem = await storage.getInventoryItem(item.inventoryItemId, userContext.effectiveUserId);
            if (!invItem) {
              return res.status(404).json({ error: "Inventory item not found" });
            }
          }
        }
      }
      const po = await storage.createPurchaseOrder({ ...parsed, userId: userContext.effectiveUserId });

      if (poItems && Array.isArray(poItems)) {
        for (const item of poItems) {
          const parsedItem = insertPurchaseOrderItemSchema.parse({ ...item, poId: po.id });
          await storage.createPurchaseOrderItem(parsedItem);
        }
      }

      const createdItems = await storage.getPurchaseOrderItems(po.id);
      res.status(201).json({ ...po, items: createdItems });
    } catch (error) {
      console.error("Error creating purchase order:", error);
      res.status(500).json({ error: "Failed to create purchase order" });
    }
  });

  app.patch("/api/purchase-orders/:id", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const patchData = { ...req.body }; delete patchData.id; delete patchData.userId; delete patchData.businessOwnerId; delete patchData.createdAt; delete patchData.updatedAt;
      const updated = await storage.updatePurchaseOrder(req.params.id, userContext.effectiveUserId, patchData);
      if (!updated) return res.status(404).json({ error: "Purchase order not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating purchase order:", error);
      res.status(500).json({ error: "Failed to update purchase order" });
    }
  });

  app.delete("/api/purchase-orders/:id", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const deleted = await storage.deletePurchaseOrder(req.params.id, userContext.effectiveUserId);
      if (!deleted) return res.status(404).json({ error: "Purchase order not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting purchase order:", error);
      res.status(500).json({ error: "Failed to delete purchase order" });
    }
  });

  app.get("/api/purchase-orders/:id/items", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const po = await storage.getPurchaseOrder(req.params.id, userContext.effectiveUserId);
      if (!po) return res.status(404).json({ error: "Purchase order not found" });
      const items = await storage.getPurchaseOrderItems(req.params.id);
      res.json(items);
    } catch (error) {
      console.error("Error fetching purchase order items:", error);
      res.status(500).json({ error: "Failed to fetch purchase order items" });
    }
  });

}
