import type { Express } from "express";
import { z } from "zod";
import { storage, db } from "../storage";
import { eq, sql, desc, asc, and, gte, lte, lt, isNotNull, isNull, inArray, or, count, sum, ne } from "drizzle-orm";
import { requireAuth, requirePaidTier } from "./middleware";
import { ownerOnly, createPermissionMiddleware, PERMISSIONS, getUserContext } from "../permissions";
import {
  equipmentCategories,
  jobEquipment,
  jobs,
  equipment,
  invoices,
  timeEntries,
  jobMaterials,
  clients,
  expenses,
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

export function registerReportsRoutes(app: Express): void {
  // Top N most profitable completed jobs in a date range, plus per-job-type summary.
  // Owner-only (matches the existing /api/reports/profitability* restriction).
  app.get("/api/reports/top-jobs", requireAuth, requirePaidTier(), async (req: any, res) => {
    try {
      const userContext = req.userContext || await getUserContext(req.userId);

      // Only business owners may access profitability data
      if (!userContext.isOwner) {
        return res.status(403).json({ error: 'Access denied - owners only' });
      }

      const effectiveUserId = userContext.effectiveUserId;

      const now = new Date();
      const defaultStart = new Date(now.getFullYear(), 0, 1); // YTD by default
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : defaultStart;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : now;
      const limit = Math.min(parseInt(String(req.query.limit || '10')), 50);

      // Fetch completed jobs scoped to the business owner.
      // Canonical terminal statuses are 'done', 'invoiced', and 'paid'.
      // Filter by completedAt so we only count jobs that actually finished in the period;
      // fall back to createdAt for the rare jobs where completedAt was never stamped.
      const COMPLETED_STATUSES = ['done', 'invoiced', 'paid'] as const;
      const completedJobs = await db
        .select({
          id: jobs.id,
          title: jobs.title,
          status: jobs.status,
          jobType: jobs.jobType,
          clientId: jobs.clientId,
          completedAt: jobs.completedAt,
        })
        .from(jobs)
        .where(and(
          eq(jobs.userId, effectiveUserId),
          inArray(jobs.status, COMPLETED_STATUSES as unknown as string[]),
          or(
            // Jobs with a recorded completion date in range
            and(isNotNull(jobs.completedAt), gte(jobs.completedAt, startDate), lte(jobs.completedAt, endDate)),
            // Jobs with no completedAt stamped — use createdAt as proxy
            and(isNull(jobs.completedAt), gte(jobs.createdAt, startDate), lte(jobs.createdAt, endDate)),
          ),
        ));

      const emptyResponse = {
        jobs: [],
        jobTypeSummary: [],
        period: { start: startDate.toISOString(), end: endDate.toISOString() },
      };
      if (completedJobs.length === 0) return res.json(emptyResponse);

      const jobIds = completedJobs.map(j => j.id);

      // Run all supporting queries in parallel for speed
      const [clientRows, invoiceRows, timeRows, materialRows, expenseRows] = await Promise.all([
        // Client names
        (() => {
          const clientIds = [...new Set(completedJobs.map(j => j.clientId).filter(Boolean))] as string[];
          if (clientIds.length === 0) return Promise.resolve([]);
          return db
            .select({ id: clients.id, name: clients.name })
            .from(clients)
            .where(inArray(clients.id, clientIds));
        })(),

        // Revenue: paid invoices scoped to this business owner
        db
          .select({ jobId: invoices.jobId, total: invoices.total })
          .from(invoices)
          .where(and(
            eq(invoices.userId, effectiveUserId),
            inArray(invoices.jobId, jobIds),
            eq(invoices.status, 'paid'),
          )),

        // Labour: all time entries for these jobs regardless of which team member clocked them.
        // jobIds are already scoped to effectiveUserId so no userId filter is needed here —
        // adding one would silently drop team-member clock-ins and overstate profit.
        db
          .select({
            jobId: timeEntries.jobId,
            startTime: timeEntries.startTime,
            endTime: timeEntries.endTime,
            duration: timeEntries.duration,
            hourlyRate: timeEntries.hourlyRate,
            isBreak: timeEntries.isBreak,
          })
          .from(timeEntries)
          .where(and(
            inArray(timeEntries.jobId, jobIds),
            isNotNull(timeEntries.endTime),
          )),

        // Material costs scoped to business owner
        db
          .select({ jobId: jobMaterials.jobId, totalCost: jobMaterials.totalCost })
          .from(jobMaterials)
          .where(and(
            eq(jobMaterials.userId, effectiveUserId),
            inArray(jobMaterials.jobId, jobIds),
          )),

        // Approved/pending expenses scoped to business owner (exclude rejected worker receipts)
        db
          .select({ jobId: expenses.jobId, amount: expenses.amount, status: expenses.status })
          .from(expenses)
          .where(and(
            eq(expenses.userId, effectiveUserId),
            inArray(expenses.jobId, jobIds),
            ne(expenses.status, 'rejected'),
          )),
      ]);

      // Build lookup maps
      const clientMap = new Map(
        (clientRows as any[]).map(c => [c.id, (c.name as string) || 'Unknown'])
      );

      const revenueMap = new Map<string, number>();
      for (const inv of invoiceRows) {
        if (!inv.jobId) continue;
        revenueMap.set(inv.jobId, (revenueMap.get(inv.jobId) || 0) + parseFloat(inv.total || '0'));
      }

      const labourMap = new Map<string, { cost: number; hours: number }>();
      for (const te of timeRows) {
        if (!te.jobId || te.isBreak) continue;
        // Prefer duration field; fall back to startTime/endTime difference
        let hours: number;
        if (te.duration != null) {
          hours = parseFloat(String(te.duration)) / 60;
        } else if (te.endTime) {
          hours = (new Date(te.endTime).getTime() - new Date(te.startTime).getTime()) / (1000 * 60 * 60);
        } else {
          continue;
        }
        const rate = parseFloat(String(te.hourlyRate || '0'));
        const entry = labourMap.get(te.jobId) || { cost: 0, hours: 0 };
        entry.hours += hours;
        entry.cost += hours * rate;
        labourMap.set(te.jobId, entry);
      }

      const materialMap = new Map<string, number>();
      for (const mat of materialRows) {
        materialMap.set(mat.jobId, (materialMap.get(mat.jobId) || 0) + parseFloat(String(mat.totalCost || '0')));
      }

      const expenseMap = new Map<string, number>();
      for (const exp of expenseRows) {
        if (!exp.jobId) continue;
        expenseMap.set(exp.jobId, (expenseMap.get(exp.jobId) || 0) + parseFloat(String(exp.amount || '0')));
      }

      // Compute profitability per job
      const allJobResults = completedJobs
        .map(job => {
          const revenue = revenueMap.get(job.id) || 0;
          const labourData = labourMap.get(job.id) || { cost: 0, hours: 0 };
          const materialCost = materialMap.get(job.id) || 0;
          const expenseCost = expenseMap.get(job.id) || 0;
          const costs = labourData.cost + materialCost + expenseCost;
          const profit = revenue - costs;
          const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;

          return {
            jobId: job.id,
            title: job.title,
            status: job.status,
            // Normalise job type: the schema uses 'service' and 'project'
            jobType: job.jobType || 'service',
            clientName: job.clientId ? (clientMap.get(job.clientId) || 'Unknown') : 'No client',
            completedAt: job.completedAt,
            revenue: Math.round(revenue * 100) / 100,
            labourCost: Math.round(labourData.cost * 100) / 100,
            materialCost: Math.round(materialCost * 100) / 100,
            expenseCost: Math.round(expenseCost * 100) / 100,
            costs: Math.round(costs * 100) / 100,
            profit: Math.round(profit * 100) / 100,
            margin: Math.round(marginPct * 10) / 10,
            totalHours: Math.round(labourData.hours * 10) / 10,
            profitStatus: (marginPct > 15 ? 'profitable' : marginPct > 5 ? 'tight' : 'loss') as 'profitable' | 'tight' | 'loss',
          };
        })
        .filter(j => j.revenue > 0 || j.costs > 0);

      // Top N by profit
      const topJobs = [...allJobResults].sort((a, b) => b.profit - a.profit).slice(0, limit);

      // Per-job-type summary using jobs.jobType (the canonical enum field, not the title)
      const typeMap = new Map<string, { jobCount: number; totalRevenue: number; totalCosts: number; totalProfit: number }>();
      for (const j of allJobResults) {
        const key = j.jobType;
        const entry = typeMap.get(key) || { jobCount: 0, totalRevenue: 0, totalCosts: 0, totalProfit: 0 };
        entry.jobCount++;
        entry.totalRevenue += j.revenue;
        entry.totalCosts += j.costs;
        entry.totalProfit += j.profit;
        typeMap.set(key, entry);
      }

      const jobTypeSummary = Array.from(typeMap.entries()).map(([jobType, data]) => ({
        jobType,
        jobCount: data.jobCount,
        totalRevenue: Math.round(data.totalRevenue * 100) / 100,
        totalCosts: Math.round(data.totalCosts * 100) / 100,
        totalProfit: Math.round(data.totalProfit * 100) / 100,
        avgJobValue: data.jobCount > 0 ? Math.round((data.totalRevenue / data.jobCount) * 100) / 100 : 0,
        avgMargin: data.totalRevenue > 0 ? Math.round((data.totalProfit / data.totalRevenue) * 1000) / 10 : 0,
      })).sort((a, b) => b.totalRevenue - a.totalRevenue);

      res.json({
        jobs: topJobs,
        jobTypeSummary,
        period: { start: startDate.toISOString(), end: endDate.toISOString() },
      });
    } catch (error) {
      console.error("Error fetching top jobs report:", error);
      res.status(500).json({ error: "Failed to fetch top jobs report" });
    }
  });

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
