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

  // ── POST /api/purchase-orders/:id/send — email PO to supplier (owner/manager only) ──
  app.post("/api/purchase-orders/:id/send", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const po = await storage.getPurchaseOrder(req.params.id, userContext.effectiveUserId);
      if (!po) return res.status(404).json({ error: "Purchase order not found" });

      const items = await storage.getPurchaseOrderItems(po.id);
      const businessSettings = await storage.getBusinessSettings(userContext.effectiveUserId);

      // Determine recipient email
      let toEmail: string = req.body.email || '';
      if (!toEmail && po.supplierId) {
        const supplier = await storage.getSupplier(po.supplierId, userContext.effectiveUserId);
        toEmail = supplier?.email || '';
      }
      if (!toEmail) {
        return res.status(400).json({ error: "No supplier email address available. Please enter an email address." });
      }

      const businessName = businessSettings?.businessName || 'Your Contractor';
      const abn = businessSettings?.abn ? `ABN: ${businessSettings.abn}` : '';
      const orderDate = po.orderDate ? new Date(po.orderDate).toLocaleDateString('en-AU') : '';

      // Build a simple HTML email body (no PDF dependency — simple and fast)
      const lineRows = items.map(item => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${item.description}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">$${parseFloat(item.unitPrice).toFixed(2)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">$${parseFloat(item.lineTotal).toFixed(2)}</td>
        </tr>`).join('');

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Purchase Order ${po.poNumber}</title></head>
<body style="font-family:Arial,sans-serif;color:#333;max-width:700px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 4px 0;">${businessName}</h2>
  ${abn ? `<p style="margin:0 0 16px 0;color:#6b7280;font-size:14px;">${abn}</p>` : ''}
  <hr style="border:none;border-top:2px solid #2563EB;margin:16px 0;">
  <h1 style="font-size:22px;margin:0 0 8px 0;">Purchase Order</h1>
  <p style="margin:0;color:#6b7280;font-size:14px;">PO# <strong>${po.poNumber}</strong>&nbsp;&nbsp;|&nbsp;&nbsp;Date: ${orderDate}</p>
  ${po.requiredDate ? `<p style="margin:4px 0 0;color:#6b7280;font-size:14px;">Required by: ${new Date(po.requiredDate).toLocaleDateString('en-AU')}</p>` : ''}
  <table style="width:100%;border-collapse:collapse;margin-top:24px;font-size:14px;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="padding:10px 12px;text-align:left;font-weight:600;">Description</th>
        <th style="padding:10px 12px;text-align:center;font-weight:600;">Qty</th>
        <th style="padding:10px 12px;text-align:right;font-weight:600;">Unit Price</th>
        <th style="padding:10px 12px;text-align:right;font-weight:600;">Total</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
    <tfoot>
      ${po.gstAmount && parseFloat(po.gstAmount) > 0 ? `
      <tr><td colspan="3" style="padding:8px 12px;text-align:right;font-size:13px;color:#6b7280;">Subtotal</td><td style="padding:8px 12px;text-align:right;">$${parseFloat(po.subtotal || '0').toFixed(2)}</td></tr>
      <tr><td colspan="3" style="padding:8px 12px;text-align:right;font-size:13px;color:#6b7280;">GST (10%)</td><td style="padding:8px 12px;text-align:right;">$${parseFloat(po.gstAmount).toFixed(2)}</td></tr>
      ` : ''}
      <tr style="background:#f3f4f6;font-weight:700;">
        <td colspan="3" style="padding:10px 12px;text-align:right;">Total</td>
        <td style="padding:10px 12px;text-align:right;">$${parseFloat(po.total || '0').toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>
  ${po.terms ? `<p style="margin-top:20px;font-size:13px;color:#6b7280;"><strong>Terms:</strong> ${po.terms}</p>` : ''}
  ${po.notes ? `<p style="margin-top:8px;font-size:13px;color:#6b7280;"><strong>Notes:</strong> ${po.notes}</p>` : ''}
  <p style="margin-top:32px;font-size:12px;color:#9ca3af;">This purchase order was sent by ${businessName} via JobRunner.</p>
</body></html>`;

      const { sendEmailWithAttachment } = await import('../emailService');
      await sendEmailWithAttachment({
        to: toEmail,
        fromName: businessName,
        subject: `Purchase Order ${po.poNumber} from ${businessName}`,
        html,
        _meta: { userId: userContext.effectiveUserId, type: 'purchase_order', relatedId: po.id },
      });

      // Mark PO as sent
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
      // Include items for each PO
      const posWithItems = await Promise.all(pos.map(async (po) => {
        const items = await storage.getPurchaseOrderItems(po.id);
        return { ...po, items };
      }));
      res.json(posWithItems);
    } catch (error) {
      console.error("Error fetching job purchase orders:", error);
      res.status(500).json({ error: "Failed to fetch purchase orders" });
    }
  });

}
