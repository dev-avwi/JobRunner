import type { Express } from "express";
import { z } from "zod";
import { createHmac } from "crypto";
import { storage, db } from "../storage";
import { eq, sql, desc, asc, and, gte, lte, lt, isNotNull, isNull, inArray, or, count, sum, ne } from "drizzle-orm";
import { requireAuth } from "./middleware";
import { ownerOnly, ownerOrManagerOnly, createPermissionMiddleware, PERMISSIONS, getUserContext } from "../permissions";
import { getProductionBaseUrl } from "../urlHelper";

// ── Signed PO access tokens (no DB required) ──────────────────────────────────
// Token format (base64url-encoded): `${poId}:${expiryUnix}:${hmac-hex}`
// HMAC-SHA256 over `${poId}:${expiryUnix}` using ENCRYPTION_SECRET.
// Supplier-facing: 30-day expiry, no auth required.

const PO_TOKEN_TTL_DAYS = 30;

export function generatePoAccessToken(poId: string): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error('ENCRYPTION_SECRET is required to generate PO access tokens');
  const expiry = Math.floor(Date.now() / 1000) + PO_TOKEN_TTL_DAYS * 86400;
  const payload = `${poId}:${expiry}`;
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

export function verifyPoAccessToken(token: string): { poId: string } | null {
  try {
    const secret = process.env.ENCRYPTION_SECRET;
    if (!secret) return null; // Cannot verify without a configured secret
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return null;
    const [poId, expiryStr, sig] = parts;
    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry) || Date.now() / 1000 > expiry) return null;
    const expected = createHmac('sha256', secret).update(`${poId}:${expiryStr}`).digest('hex');
    // Constant-time compare to avoid timing attacks
    if (sig.length !== expected.length) return null;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff !== 0) return null;
    return { poId };
  } catch {
    return null;
  }
}
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
  purchaseOrders as purchaseOrdersTable,
  purchaseOrderItems as purchaseOrderItemsTable,
  suppliers as suppliersTable,
  businessSettings as businessSettingsTable,
} from "@workspace/db";

/** Recompute and persist PO-level status from the current set of line items. */
/**
 * Derive and persist the PO-level status purely from the current state of all
 * line items, including resets back to pending.
 *
 * Truth table (non-cancelled items):
 *   - All received                → 'received'
 *   - Any partial qty / status    → 'partial'
 *   - All pending (qty=0)         → 'pending'  (resets a prior partial/received)
 *   - All items cancelled         → 'cancelled'
 */
async function recomputePoStatus(
  po: { id: string; status: string | null },
  items: Array<{ status: string | null; receivedQuantity?: number | null; quantity: number }>,
  userId: string,
): Promise<void> {
  const nonCancelled = items.filter(i => i.status !== 'cancelled');
  let poStatus: string;

  if (items.length === 0 || nonCancelled.length === 0) {
    poStatus = 'cancelled';
  } else if (nonCancelled.every(i => i.status === 'received')) {
    poStatus = 'received';
  } else if (nonCancelled.some(i => (i.receivedQuantity ?? 0) > 0 || i.status === 'partial')) {
    poStatus = 'partial';
  } else {
    // All remaining non-cancelled items are pending — explicitly reset to pending
    // so a prior 'partial' or 'received' is not retained after lines are rolled back.
    poStatus = 'pending';
  }

  if (poStatus !== po.status) {
    await storage.updatePurchaseOrder(po.id, userId, { status: poStatus as any });
  }
}

export function registerInventoryRoutes(app: Express): void {

  // ── GET /api/po/view/:token — supplier-facing PO PDF (no auth required) ──────
  // Suppliers follow this link from the SMS. The signed token encodes the PO ID
  // and a 30-day expiry; no session or login is needed.
  app.get("/api/po/view/:token", async (req: any, res) => {
    try {
      const verified = verifyPoAccessToken(req.params.token);
      if (!verified) {
        return res.status(410).send('<html><body style="font-family:sans-serif;padding:40px"><h2>Link expired or invalid</h2><p>Ask your supplier to resend the purchase order.</p></body></html>');
      }

      // Query without userId scoping — the signed token is the auth mechanism
      const [poRows, items] = await Promise.all([
        db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, verified.poId)).limit(1),
        db.select().from(purchaseOrderItemsTable).where(eq(purchaseOrderItemsTable.poId, verified.poId)),
      ]);
      const po = poRows[0] ?? null;
      if (!po) {
        return res.status(404).send('<html><body style="font-family:sans-serif;padding:40px"><h2>Purchase order not found.</h2></body></html>');
      }

      const [supplierRows, bizRows] = await Promise.all([
        (po as any).supplierId
          ? db.select().from(suppliersTable).where(eq(suppliersTable.id, (po as any).supplierId)).limit(1)
          : Promise.resolve([]),
        db.select().from(businessSettingsTable).where(eq(businessSettingsTable.userId, (po as any).userId)).limit(1),
      ]);

      const supplier = supplierRows[0] ?? null;
      const biz = bizRows[0] ?? null;

      const { generatePurchaseOrderPDF, generatePDFBuffer } = await import('../pdfService');
      const pdfHtml = generatePurchaseOrderPDF({
        po: {
          poNumber: (po as any).poNumber,
          orderDate: (po as any).orderDate,
          requiredDate: (po as any).requiredDate,
          status: (po as any).status,
          subtotal: (po as any).subtotal,
          gstAmount: (po as any).gstAmount,
          total: (po as any).total,
          terms: (po as any).terms,
          notes: (po as any).notes,
        },
        items: items.map((i: any) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
        })),
        supplier: supplier ? {
          name: (supplier as any).name,
          email: (supplier as any).email,
          phone: (supplier as any).phone,
          address: (supplier as any).address,
        } : null,
        business: biz ? {
          businessName: (biz as any).businessName,
          logoUrl: (biz as any).logoUrl,
          abn: (biz as any).abn,
          address: (biz as any).address,
          phone: (biz as any).phone,
          email: (biz as any).email,
        } : { businessName: 'Your Contractor' },
        job: null,
      });

      const pdfBuffer = await generatePDFBuffer(pdfHtml);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="PO-${po.poNumber}.pdf"`);
      res.setHeader('Cache-Control', 'private, no-store');
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error('[PO view] Error:', error);
      res.status(500).send('<html><body><h2>Failed to load purchase order.</h2></body></html>');
    }
  });

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

  app.patch("/api/purchase-orders/:id", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const patchData = { ...req.body };
      delete patchData.id; delete patchData.userId; delete patchData.businessOwnerId;
      delete patchData.createdAt; delete patchData.updatedAt;

      // 'received' PO status must not be set directly by the client — it is derived
      // server-side from line items. Strip it from any direct PATCH so it can only be
      // set via the item reconciliation endpoint or the computed path.
      if (patchData.status === 'received') {
        // Verify that every non-cancelled line item is actually fully received before
        // honouring a manual transition to 'received'.
        const items = await storage.getPurchaseOrderItems(req.params.id);
        const nonCancelled = items.filter(i => i.status !== 'cancelled');
        const allReceived = nonCancelled.length > 0 && nonCancelled.every(i => i.status === 'received');
        if (!allReceived) {
          return res.status(400).json({
            error: "Cannot mark a PO as Received until all line items have been fully received. Update each line item's received quantity first.",
            code: "LINES_NOT_RECEIVED",
          });
        }
      }

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

  // ── PATCH /api/purchase-orders/:id/items/:itemId — update received qty (owner/manager only) ──
  app.patch("/api/purchase-orders/:id/items/:itemId", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      // Verify PO ownership
      const po = await storage.getPurchaseOrder(req.params.id, userContext.effectiveUserId);
      if (!po) return res.status(404).json({ error: "Purchase order not found" });

      // Fetch the current item to validate against ordered quantity
      const existingItems = await storage.getPurchaseOrderItems(req.params.id);
      const existingItem = existingItems.find(i => i.id === req.params.itemId);
      if (!existingItem) return res.status(404).json({ error: "Item not found" });

      // ── Server-side validation ──
      // Only accept receivedQuantity and explicit cancellation; derive status server-side.
      const { receivedQuantity, status: clientStatus } = req.body;

      // Allow explicit cancellation of an item
      if (clientStatus === 'cancelled') {
        const updated = await storage.updatePurchaseOrderItem(req.params.itemId, req.params.id, { status: 'cancelled' });
        if (!updated) return res.status(404).json({ error: "Item not found" });

        // Recompute PO-level status
        const freshItems = await storage.getPurchaseOrderItems(req.params.id);
        await recomputePoStatus(po, freshItems, userContext.effectiveUserId);
        return res.json(updated);
      }

      if (receivedQuantity === undefined) {
        return res.status(400).json({ error: "receivedQuantity is required" });
      }

      const qty = Number(receivedQuantity);
      if (!Number.isInteger(qty) || qty < 0) {
        return res.status(400).json({ error: "receivedQuantity must be a non-negative integer" });
      }
      if (qty > existingItem.quantity) {
        return res.status(400).json({ error: `receivedQuantity (${qty}) cannot exceed ordered quantity (${existingItem.quantity})` });
      }

      // Compute status server-side from received qty
      const derivedStatus = qty === 0 ? 'pending' : qty >= existingItem.quantity ? 'received' : 'partial';
      const updateData = { receivedQuantity: qty, status: derivedStatus };

      const updated = await storage.updatePurchaseOrderItem(req.params.itemId, req.params.id, updateData);
      if (!updated) return res.status(404).json({ error: "Item not found" });

      // Recompute PO-level status from all items
      const freshItems = await storage.getPurchaseOrderItems(req.params.id);
      await recomputePoStatus(po, freshItems, userContext.effectiveUserId);

      res.json(updated);
    } catch (error) {
      console.error("Error updating purchase order item:", error);
      res.status(500).json({ error: "Failed to update item" });
    }
  });

  // ── POST /api/purchase-orders/:id/send — send PO to supplier via email or SMS ──
  app.post("/api/purchase-orders/:id/send", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const po = await storage.getPurchaseOrder(req.params.id, userContext.effectiveUserId);
      if (!po) return res.status(404).json({ error: "Purchase order not found" });

      // Resolve channel and recipient — accept new { channel, to } or legacy { email }
      const channel: 'email' | 'sms' = req.body.channel === 'sms' ? 'sms' : 'email';
      const customMessage: string | undefined = req.body.message;

      const items = await storage.getPurchaseOrderItems(po.id);
      const businessSettings = await storage.getBusinessSettings(userContext.effectiveUserId);
      const businessName = businessSettings?.businessName || 'Your Contractor';

      // Resolve supplier contact details
      let supplier: any = null;
      if (po.supplierId) {
        supplier = await storage.getSupplier(po.supplierId, userContext.effectiveUserId);
      }

      // Resolve job details for the PDF
      let job: any = null;
      if ((po as any).jobId) {
        try { job = await storage.getJob((po as any).jobId, userContext.effectiveUserId); } catch {}
      }

      if (channel === 'email') {
        // ── Email channel ──────────────────────────────────────────────────────
        let toEmail: string = req.body.to || req.body.email || '';
        if (!toEmail) toEmail = supplier?.email || '';
        if (!toEmail) {
          return res.status(400).json({ error: "No supplier email address available. Please enter an email address." });
        }

        // Generate PDF attachment
        const { generatePurchaseOrderPDF, generatePDFBuffer } = await import('../pdfService');
        const pdfHtml = generatePurchaseOrderPDF({
          po: {
            poNumber: po.poNumber,
            orderDate: po.orderDate,
            requiredDate: (po as any).requiredDate,
            status: po.status,
            subtotal: po.subtotal,
            gstAmount: po.gstAmount,
            total: po.total,
            terms: (po as any).terms,
            notes: po.notes,
          },
          items: items.map(i => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            lineTotal: i.lineTotal,
          })),
          supplier: supplier ? { name: supplier.name, email: supplier.email, phone: supplier.phone, address: supplier.address } : null,
          business: {
            businessName: businessSettings?.businessName,
            logoUrl: (businessSettings as any)?.logoUrl,
            abn: businessSettings?.abn,
            address: businessSettings?.address,
            phone: businessSettings?.phone,
            email: businessSettings?.email,
          },
          job: job ? { number: job.number, title: job.title, address: job.address } : null,
        });

        const pdfBuffer = await generatePDFBuffer(pdfHtml);

        // Email body — concise covering note
        const emailBody = customMessage
          ? `<p style="font-family:Arial,sans-serif;color:#374151;">${customMessage}</p>`
          : `<p style="font-family:Arial,sans-serif;color:#374151;">Please find attached Purchase Order <strong>${po.poNumber}</strong> from <strong>${businessName}</strong>.</p>`;

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 4px 0;">${businessName}</h2>
  <hr style="border:none;border-top:2px solid #2563EB;margin:12px 0 16px;">
  ${emailBody}
  <p style="font-family:Arial,sans-serif;color:#6b7280;font-size:13px;">The full purchase order is attached as a PDF.</p>
  <p style="margin-top:32px;font-size:12px;color:#9ca3af;">Sent via JobRunner</p>
</body></html>`;

        const { sendEmailWithAttachment } = await import('../emailService');
        await sendEmailWithAttachment({
          to: toEmail,
          fromName: businessName,
          subject: `Purchase Order ${po.poNumber} from ${businessName}`,
          html,
          attachments: [{
            filename: `PO-${po.poNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          }],
          _meta: { userId: userContext.effectiveUserId, type: 'purchase_order', relatedId: po.id },
        });

        // Record audit trail as a job note if the PO is linked to a job
        if ((po as any).jobId) {
          try {
            await storage.createJobNote({
              jobId: (po as any).jobId,
              userId: userContext.effectiveUserId,
              content: `Purchase order ${po.poNumber} emailed to supplier${supplier?.name ? ` (${supplier.name})` : ''} at ${toEmail}.`,
            } as any);
          } catch {}
        }

      } else {
        // ── SMS channel ────────────────────────────────────────────────────────
        let toPhone: string = req.body.to || '';
        if (!toPhone) toPhone = supplier?.phone || '';
        if (!toPhone) {
          return res.status(400).json({ error: "No supplier phone number available. Please enter a phone number." });
        }

        // Generate a signed, time-limited link so the supplier can view the full PO PDF.
        // The link is always appended — even when the sender provides custom text —
        // so the supplier can access the document regardless of message phrasing.
        const accessToken = generatePoAccessToken(po.id);
        const baseUrl = getProductionBaseUrl(req);
        const poViewUrl = `${baseUrl}/api/po/view/${accessToken}`;

        const smsBody = customMessage
          ? `${customMessage}\nView PO: ${poViewUrl}`
          : `Hi${supplier?.name ? ` ${supplier.name}` : ''}, ${businessName} has sent you Purchase Order ${po.poNumber} totalling $${parseFloat(po.total || '0').toFixed(2)}. View the full PO here: ${poViewUrl}`;

        const defaultMessage = smsBody;

        const { sendSMS } = await import('../twilioClient');
        const smsResult = await sendSMS({ to: toPhone, message: defaultMessage });

        if (!smsResult.success && !smsResult.simulated) {
          return res.status(500).json({ error: smsResult.error || "Failed to send SMS" });
        }

        // Record audit trail
        if ((po as any).jobId) {
          try {
            await storage.createJobNote({
              jobId: (po as any).jobId,
              userId: userContext.effectiveUserId,
              content: `Purchase order ${po.poNumber} sent via SMS to ${toPhone}${supplier?.name ? ` (${supplier.name})` : ''} with a link to view the PO document (expires in ${PO_TOKEN_TTL_DAYS} days).`,
            } as any);
          } catch {}
        }
      }

      // Mark PO as sent and record timestamp
      const updated = await storage.updatePurchaseOrder(po.id, userContext.effectiveUserId, {
        status: 'sent',
        sentAt: new Date(),
      } as any);

      res.json({ success: true, po: updated });
    } catch (error: any) {
      console.error("Error sending purchase order:", error);
      res.status(500).json({ error: error.message || "Failed to send purchase order" });
    }
  });

  // ── GET /api/jobs/:jobId/purchase-orders — POs linked to a job ──
  app.get("/api/jobs/:jobId/purchase-orders", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const pos = await storage.getPurchaseOrdersByJobId(req.params.jobId, userContext.effectiveUserId);
      // Batch-load supplier names in one pass
      const supplierIds = [...new Set((pos as any[]).map((p: any) => p.supplierId).filter(Boolean))];
      const supplierMap: Record<string, { name: string; phone?: string | null; email?: string | null }> = {};
      await Promise.all(supplierIds.map(async (sid: any) => {
        const s = await storage.getSupplier(sid, userContext.effectiveUserId);
        if (s) supplierMap[sid] = { name: (s as any).name, phone: (s as any).phone ?? null, email: (s as any).email ?? null };
      }));
      // Include items and resolved supplier info for each PO
      const posWithItems = await Promise.all((pos as any[]).map(async (po: any) => {
        const items = await storage.getPurchaseOrderItems(po.id);
        const sup = po.supplierId ? (supplierMap[po.supplierId] ?? null) : null;
        return {
          ...po,
          items,
          supplierName: sup?.name ?? null,
          supplierPhone: sup?.phone ?? null,
          supplierEmail: sup?.email ?? null,
        };
      }));
      res.json(posWithItems);
    } catch (error) {
      console.error("Error fetching job purchase orders:", error);
      res.status(500).json({ error: "Failed to fetch purchase orders" });
    }
  });

}
