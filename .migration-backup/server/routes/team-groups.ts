import type { Express } from "express";
import { z } from "zod";
import { storage, db } from "../storage";
import { eq, sql, desc, asc, and, gte, lte, lt, isNotNull, isNull, inArray, or, count, sum, ne } from "drizzle-orm";
import { requireAuth } from "./middleware";
import { ownerOnly, requireTeamPlan, createPermissionMiddleware, PERMISSIONS, getUserContext } from "../permissions";
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

export function registerTeamGroupsRoutes(app: Express): void {
  // Team Groups Routes
  app.get("/api/team-groups", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const groups = await storage.getTeamGroups(userContext.effectiveUserId);
      
      const groupsWithMembers = await Promise.all(
        groups.map(async (group) => {
          const members = await storage.getGroupMembers(group.id);
          return { ...group, memberCount: members.length };
        })
      );
      
      res.json(groupsWithMembers);
    } catch (error) {
      console.error("Error fetching team groups:", error);
      res.status(500).json({ error: "Failed to fetch team groups" });
    }
  });

  app.get("/api/team-groups/:id", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const group = await storage.getTeamGroupById(req.params.id, userContext.effectiveUserId);
      if (!group) {
        return res.status(404).json({ error: "Team group not found" });
      }
      
      const members = await storage.getGroupMembers(group.id);
      const teamMembersList = await storage.getTeamMembers(userContext.effectiveUserId);
      
      const membersWithDetails = members.map((m) => {
        const member = teamMembersList.find((tm: any) => tm.id === m.teamMemberId);
        return { ...m, member };
      });
      
      res.json({ ...group, members: membersWithDetails });
    } catch (error) {
      console.error("Error fetching team group:", error);
      res.status(500).json({ error: "Failed to fetch team group" });
    }
  });

  app.post("/api/team-groups", requireAuth, ownerOnly(), requireTeamPlan(), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const validatedData = insertTeamGroupSchema.parse({
        ...req.body,
        userId: userContext.effectiveUserId,
      });
      const group = await storage.createTeamGroup(validatedData);
      res.status(201).json(group);
    } catch (error) {
      console.error("Error creating team group:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create team group" });
    }
  });

  app.patch("/api/team-groups/:id", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const patchData = { ...req.body }; delete patchData.id; delete patchData.userId; delete patchData.businessOwnerId; delete patchData.createdAt; delete patchData.updatedAt;
      const group = await storage.updateTeamGroup(req.params.id, userContext.effectiveUserId, patchData);
      if (!group) {
        return res.status(404).json({ error: "Team group not found" });
      }
      res.json(group);
    } catch (error) {
      console.error("Error updating team group:", error);
      res.status(500).json({ error: "Failed to update team group" });
    }
  });

  app.delete("/api/team-groups/:id", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const success = await storage.deleteTeamGroup(req.params.id, userContext.effectiveUserId);
      if (!success) {
        return res.status(404).json({ error: "Team group not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting team group:", error);
      res.status(500).json({ error: "Failed to delete team group" });
    }
  });

  app.post("/api/team-groups/:id/members", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const group = await storage.getTeamGroupById(req.params.id, userContext.effectiveUserId);
      if (!group) {
        return res.status(404).json({ error: "Team group not found" });
      }
      
      const { teamMemberId, role } = req.body;
      if (!teamMemberId) {
        return res.status(400).json({ error: "Team member ID is required" });
      }

      const teamMembers = await storage.getTeamMembers(userContext.effectiveUserId);
      if (!teamMembers.some((tm: any) => tm.id === teamMemberId)) {
        return res.status(404).json({ error: "Team member not found" });
      }

      const member = await storage.addMemberToGroup(req.params.id, teamMemberId, role || 'member');
      res.status(201).json(member);
    } catch (error) {
      console.error("Error adding member to group:", error);
      res.status(500).json({ error: "Failed to add member to group" });
    }
  });

  app.delete("/api/team-groups/:id/members/:memberId", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const group = await storage.getTeamGroupById(req.params.id, userContext.effectiveUserId);
      if (!group) {
        return res.status(404).json({ error: "Team group not found" });
      }
      
      const success = await storage.removeMemberFromGroup(req.params.id, req.params.memberId);
      if (!success) {
        return res.status(404).json({ error: "Member not found in group" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing member from group:", error);
      res.status(500).json({ error: "Failed to remove member from group" });
    }
  });

  // Saved Filters CRUD
  app.get("/api/saved-filters", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const entityType = (req.query.entityType as string) || 'jobs';
      const filters = await storage.getSavedFilters(userId, entityType);
      res.json(filters);
    } catch (error) {
      console.error("Error fetching saved filters:", error);
      res.status(500).json({ error: "Failed to fetch saved filters" });
    }
  });

  app.post("/api/saved-filters", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { name, filters, entityType } = req.body;
      if (!name || !filters) {
        return res.status(400).json({ error: "Name and filters are required" });
      }
      const saved = await storage.createSavedFilter({
        userId,
        name,
        filters,
        entityType: entityType || 'jobs',
      });
      res.status(201).json(saved);
    } catch (error) {
      console.error("Error creating saved filter:", error);
      res.status(500).json({ error: "Failed to create saved filter" });
    }
  });

  app.delete("/api/saved-filters/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const success = await storage.deleteSavedFilter(req.params.id, userId);
      if (!success) {
        return res.status(404).json({ error: "Saved filter not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting saved filter:", error);
      res.status(500).json({ error: "Failed to delete saved filter" });
    }
  });

  // Jobs Routes

}
