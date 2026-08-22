import type { Express } from "express";
import { insertExpenseSchema } from "@workspace/db";
import { storage } from "../storage";
import { createPermissionMiddleware, PERMISSIONS } from "../permissions";
import { requireAuth } from "./middleware";

type ExpenseScope = {
  jobId?: string | null;
  phaseId?: string | null;
  ownerId: string;
};

type ValidationFailure = {
  status: number;
  error: string;
};

async function validateExpenseScope({
  jobId,
  phaseId,
  ownerId,
}: ExpenseScope): Promise<ValidationFailure | undefined> {
  if (!jobId) {
    if (phaseId) {
      return {
        status: 400,
        error: "A job is required when assigning an expense to a phase",
      };
    }
    return undefined;
  }

  const job = await storage.getJob(jobId, ownerId);
  if (!job) {
    return { status: 404, error: "Job not found" };
  }

  if (!phaseId) return undefined;

  const phases = await storage.getJobPhases(jobId, job.userId);
  if (!phases.some((phase) => phase.id === phaseId)) {
    return {
      status: 400,
      error: "Phase not found or does not belong to this job",
    };
  }

  return undefined;
}

export function registerExpenseRoutes(app: Express) {
  app.get("/api/expenses", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, categoryId, startDate, endDate } = req.query;
      const expenses = await storage.getExpenses(userId, {
        jobId: jobId as string,
        categoryId: categoryId as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json(expenses);
    } catch (error) {
      console.error("Get expenses error:", error);
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.post(
    "/api/expenses",
    requireAuth,
    createPermissionMiddleware(PERMISSIONS.WRITE_EXPENSES),
    async (req: any, res) => {
      try {
        const userId = req.userId!;
        const ownerId = req.effectiveUserId || userId;
        const data = insertExpenseSchema.parse(req.body);
        const validationFailure = await validateExpenseScope({
          jobId: data.jobId,
          phaseId: data.phaseId,
          ownerId,
        });
        if (validationFailure) {
          return res.status(validationFailure.status).json({ error: validationFailure.error });
        }

        const expense = await storage.createExpense({
          ...data,
          userId,
        });
        res.status(201).json(expense);
      } catch (error) {
        console.error("Create expense error:", error);
        res.status(400).json({ error: "Invalid expense data" });
      }
    },
  );

  app.put(
    "/api/expenses/:id",
    requireAuth,
    createPermissionMiddleware(PERMISSIONS.WRITE_EXPENSES),
    async (req: any, res) => {
      try {
        const userId = req.userId!;
        const ownerId = req.effectiveUserId || userId;
        const { id } = req.params;
        const data = insertExpenseSchema.partial().parse(req.body);
        const existing = await storage.getExpense(id, userId);
        if (!existing) {
          return res.status(404).json({ error: "Expense not found" });
        }

        const validationFailure = await validateExpenseScope({
          jobId: data.jobId === undefined ? existing.jobId : data.jobId,
          phaseId: data.phaseId === undefined ? existing.phaseId : data.phaseId,
          ownerId,
        });
        if (validationFailure) {
          return res.status(validationFailure.status).json({ error: validationFailure.error });
        }

        const expense = await storage.updateExpense(id, userId, data);
        if (!expense) {
          return res.status(404).json({ error: "Expense not found" });
        }
        res.json(expense);
      } catch (error) {
        console.error("Update expense error:", error);
        res.status(400).json({ error: "Invalid expense data" });
      }
    },
  );
}