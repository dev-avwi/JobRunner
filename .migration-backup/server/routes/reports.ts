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
} from "@shared/schema";

export function registerReportsRoutes(app: Express): void {
  app.get("/api/reports/equipment-utilisation", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_REPORTS), async (req: any, res) => {
    try {
      const userContext = req.userContext || await getUserContext(req.userId);
      const now = new Date();
      const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : defaultStart;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : now;

      const assignments = await db
        .select({
          assignmentId: jobEquipment.id,
          jobId: jobEquipment.jobId,
          equipmentId: jobEquipment.equipmentId,
          hoursUsed: jobEquipment.hoursUsed,
          kmTravelled: jobEquipment.kmTravelled,
          capacityUsed: jobEquipment.capacityUsed,
          capacityAvailable: jobEquipment.capacityAvailable,
          postJobNotes: jobEquipment.postJobNotes,
          wasOversized: jobEquipment.wasOversized,
          assignedAt: jobEquipment.assignedAt,
          completedAt: jobEquipment.completedAt,
          equipmentName: equipment.name,
          equipmentStatus: equipment.status,
          categoryId: equipment.categoryId,
          jobTitle: jobs.title,
          jobStatus: jobs.status,
        })
        .from(jobEquipment)
        .innerJoin(equipment, eq(equipment.id, jobEquipment.equipmentId))
        .innerJoin(jobs, eq(jobs.id, jobEquipment.jobId))
        .where(and(
          eq(jobEquipment.userId, userContext.effectiveUserId),
          gte(jobEquipment.assignedAt, startDate),
          lte(jobEquipment.assignedAt, endDate)
        ))
        .orderBy(desc(jobEquipment.assignedAt));

      const categories = await db
        .select()
        .from(equipmentCategories)
        .where(eq(equipmentCategories.userId, userContext.effectiveUserId));
      const categoryMap = new Map(categories.map(c => [c.id, c.name]));

      const equipmentMap = new Map<string, {
        equipmentId: string;
        name: string;
        category: string | null;
        status: string | null;
        assignments: any[];
        totalHoursUsed: number;
        totalKmTravelled: number;
        oversizedCount: number;
      }>();

      for (const row of assignments) {
        if (!equipmentMap.has(row.equipmentId)) {
          equipmentMap.set(row.equipmentId, {
            equipmentId: row.equipmentId,
            name: row.equipmentName,
            category: row.categoryId ? (categoryMap.get(row.categoryId) || null) : null,
            status: row.equipmentStatus,
            assignments: [],
            totalHoursUsed: 0,
            totalKmTravelled: 0,
            oversizedCount: 0,
          });
        }

        const entry = equipmentMap.get(row.equipmentId)!;
        const hours = parseFloat(String(row.hoursUsed || '0'));
        const km = parseFloat(String(row.kmTravelled || '0'));

        entry.totalHoursUsed += hours;
        entry.totalKmTravelled += km;
        if (row.wasOversized) entry.oversizedCount++;

        entry.assignments.push({
          jobId: row.jobId,
          jobTitle: row.jobTitle,
          jobStatus: row.jobStatus,
          hoursUsed: hours || null,
          kmTravelled: km || null,
          capacityUsed: row.capacityUsed,
          capacityAvailable: row.capacityAvailable,
          wasOversized: row.wasOversized,
          postJobNotes: row.postJobNotes,
          assignedAt: row.assignedAt,
          completedAt: row.completedAt,
        });
      }

      const periodDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

      const equipmentList = Array.from(equipmentMap.values()).map(e => {
        const totalJobs = e.assignments.length;
        const avgHoursPerJob = totalJobs > 0 ? Math.round(e.totalHoursUsed / totalJobs) : 0;
        const utilizationRate = periodDays > 0 ? Math.round((e.totalHoursUsed / (periodDays * 8)) * 100) : 0;

        return {
          equipmentId: e.equipmentId,
          name: e.name,
          category: e.category,
          status: e.status,
          totalJobs,
          totalHoursUsed: e.totalHoursUsed,
          totalKmTravelled: e.totalKmTravelled,
          oversizedCount: e.oversizedCount,
          avgHoursPerJob,
          utilizationRate: Math.min(utilizationRate, 100),
          assignments: e.assignments,
        };
      });

      const summary = {
        totalEquipmentUsed: equipmentList.length,
        totalJobAssignments: assignments.length,
        totalHoursLogged: equipmentList.reduce((sum, e) => sum + e.totalHoursUsed, 0),
        totalKmLogged: equipmentList.reduce((sum, e) => sum + e.totalKmTravelled, 0),
        oversizedInstances: equipmentList.reduce((sum, e) => sum + e.oversizedCount, 0),
        avgUtilizationRate: equipmentList.length > 0
          ? Math.round(equipmentList.reduce((sum, e) => sum + e.utilizationRate, 0) / equipmentList.length)
          : 0,
      };

      res.json({
        period: { start: startDate.toISOString(), end: endDate.toISOString() },
        equipment: equipmentList,
        summary,
      });
    } catch (error) {
      console.error("Error fetching equipment utilisation report:", error);
      res.status(500).json({ error: "Failed to fetch equipment utilisation report" });
    }
  });

}
