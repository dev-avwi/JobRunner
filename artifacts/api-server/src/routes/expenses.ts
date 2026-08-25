import type { Express } from "express";
import { insertExpenseSchema } from "@workspace/db";
import { storage } from "../storage";
import { createPermissionMiddleware, ownerOrManagerOnly, PERMISSIONS, getUserContext } from "../permissions";
import { requireAuth } from "./middleware";
import {
  assertExpensePhaseAssignment,
  ExpensePhaseValidationError,
} from "../phaseExpenseAttribution";
import { createNotification } from "../notifications";

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
  try {
    await assertExpensePhaseAssignment(storage, ownerId, jobId, phaseId);
  } catch (error) {
    if (error instanceof ExpensePhaseValidationError) {
      return { status: error.status, error: error.message };
    }
    throw error;
  }

  return undefined;
}

export function registerExpenseRoutes(app: Express) {
  /**
   * Worker-accessible expense creation scoped to a job.
   * Workers cannot use POST /api/expenses (requires WRITE_EXPENSES permission),
   * but they can log a receipt against a job they are assigned to.
   *
   * Security rules enforced here:
   * 1. Non-owners must be actively assigned to the target job.
   * 2. All expenses are stored under the business owner's userId so they appear
   *    in owner expense lists, reports, and approval flows.
   * 3. Any supplied categoryId is validated against the owner's categories.
   */
  app.post("/api/jobs/:jobId/expenses", requireAuth, async (req: any, res) => {
    try {
      const rawUserId = req.userId!;
      const { jobId } = req.params;

      // Resolve business context (works for both owners and team members)
      const userContext = await getUserContext(rawUserId);
      const { effectiveUserId, isOwner } = userContext;

      // Verify the job exists and belongs to this business
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Non-owners (workers, subcontractors) must be actively assigned to this job
      if (!isOwner) {
        const isLegacyAssigned = (job as any).assignedTo === rawUserId;
        if (!isLegacyAssigned) {
          const assignmentRecord = await storage.getJobAssignmentForUser(jobId, rawUserId);
          if (!assignmentRecord) {
            return res.status(403).json({ error: "You are not assigned to this job" });
          }
        }
      }

      // Resolve and validate category against the business owner's categories
      const ownerCategories = await storage.getExpenseCategories(effectiveUserId);
      let resolvedCategoryId = req.body.categoryId;
      if (!resolvedCategoryId || resolvedCategoryId === "_worker_receipt_") {
        if (ownerCategories.length === 0) {
          return res.status(400).json({ error: "No expense categories are set up yet. Ask your owner to add one first." });
        }
        resolvedCategoryId = ownerCategories[0].id;
      } else if (!ownerCategories.some((c: any) => c.id === resolvedCategoryId)) {
        return res.status(400).json({ error: "Invalid expense category" });
      }

      // Validate phaseId belongs to this job if provided
      if (req.body.phaseId) {
        const phases = await storage.getJobPhases(jobId, effectiveUserId);
        if (!phases.some((p: any) => p.id === req.body.phaseId)) {
          return res.status(400).json({ error: "Phase not found or does not belong to this job" });
        }
      }

      // Prepend submitter attribution to description when logged by a worker
      let description = String(req.body.description || "").trim();
      let submitterName: string | null = null;
      if (!isOwner) {
        const submitter = await storage.getUser(rawUserId);
        submitterName = submitter ? (submitter.firstName || submitter.username || null) : null;
        if (submitterName) {
          description = `[Logged by ${submitterName}] ${description}`;
        }
      }

      const data = insertExpenseSchema.parse({
        ...req.body,
        categoryId: resolvedCategoryId,
        jobId,
        description,
      });

      // Store under the business owner's userId so it appears in all owner-scoped
      // expense lists, cost reports, and approval workflows.
      const expense = await storage.createExpense({
        ...data,
        userId: effectiveUserId,
        status: "pending",
        // Track the submitting worker so they can be notified when approved/rejected
        submittedByUserId: isOwner ? undefined : rawUserId,
      } as any);

      // Notify the business owner when a worker submits a receipt
      if (!isOwner) {
        try {
          await createNotification(storage, {
            userId: effectiveUserId,
            type: "expense_logged",
            title: "Receipt logged for review",
            message: `${submitterName ?? "A worker"} logged a $${parseFloat(String(data.amount)).toFixed(2)} expense on "${job.title}" — pending your approval.`,
            relatedType: "job",
            relatedId: jobId,
            priority: "important",
            actionUrl: `/jobs/${jobId}`,
            actionLabel: "Review Expense",
          });
        } catch (_notifyErr) {
          // Non-fatal — expense was still created
        }
      }

      res.status(201).json(expense);
    } catch (error: any) {
      console.error("Create worker expense error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid expense data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to log expense" });
    }
  });

  app.get("/api/expenses", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const rawUserId = req.userId!;
      const { jobId, categoryId, startDate, endDate } = req.query;
      // ownerOrManagerOnly() already resolved the context; fall back to getUserContext
      // so managers retrieve the owner-scoped business list, not just their own rows.
      const userContext = await getUserContext(rawUserId);
      const ownerId = userContext.effectiveUserId;
      const expenses = await storage.getExpenses(ownerId, {
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

  /**
   * PATCH /api/expenses/:id/status
   * Owners/managers approve or reject a worker-submitted pending expense.
   * - Sets status to 'approved' or 'rejected'
   * - Records who approved (approvedBy) and optional rejection reason
   * - Notifies the submitting worker of the decision
   */
  app.patch(
    "/api/expenses/:id/status",
    requireAuth,
    ownerOrManagerOnly(),
    async (req: any, res) => {
      try {
        const userId = req.userId!;
        const ownerId = req.effectiveUserId || userId;
        const { id } = req.params;
        const { status, rejectionReason } = req.body;

        if (status !== "approved" && status !== "rejected") {
          return res.status(400).json({ error: "status must be 'approved' or 'rejected'" });
        }

        const existing = await storage.getExpense(id, ownerId);
        if (!existing) {
          return res.status(404).json({ error: "Expense not found" });
        }

        // Only worker-submitted expenses go through this approval flow.
        // Support both the new submittedByUserId field (set after this feature shipped)
        // and the legacy "[Logged by Name]" prefix on descriptions written before the migration.
        const submittedByUserId = (existing as any).submittedByUserId as string | null;
        const isLegacyWorkerExpense = /^\[Logged by /i.test(existing.description ?? "");
        if (!submittedByUserId && !isLegacyWorkerExpense) {
          return res.status(400).json({ error: "Only worker-submitted expenses can be approved or rejected" });
        }

        if (existing.status !== "pending") {
          return res.status(400).json({ error: "Only pending expenses can be approved or rejected" });
        }

        const updates: Record<string, any> = {
          status,
          approvedBy: userId,
        };
        if (status === "rejected" && rejectionReason?.trim()) {
          updates.rejectionReason = rejectionReason.trim();
        }

        const updated = await storage.updateExpense(id, ownerId, updates);
        if (!updated) {
          return res.status(404).json({ error: "Expense not found" });
        }

        // Notify the worker who submitted the expense (submittedByUserId already declared above)
        if (submittedByUserId) {
          try {
            const amountFmt = `$${parseFloat(String(existing.amount)).toFixed(2)}`;
            if (status === "approved") {
              await createNotification(storage, {
                userId: submittedByUserId,
                type: "expense_approved",
                title: "Expense approved",
                message: `Your ${amountFmt} expense has been approved.`,
                relatedType: "job",
                relatedId: existing.jobId ?? undefined,
                priority: "important",
                actionUrl: existing.jobId ? `/jobs/${existing.jobId}` : undefined,
                actionLabel: "View Job",
              });
            } else {
              const reasonSuffix = updates.rejectionReason ? `: ${updates.rejectionReason}` : ".";
              await createNotification(storage, {
                userId: submittedByUserId,
                type: "expense_rejected",
                title: "Expense rejected",
                message: `Your ${amountFmt} expense was not approved${reasonSuffix}`,
                relatedType: "job",
                relatedId: existing.jobId ?? undefined,
                priority: "important",
                actionUrl: existing.jobId ? `/jobs/${existing.jobId}` : undefined,
                actionLabel: "View Job",
              });
            }
          } catch (_notifyErr) {
            // Non-fatal
          }
        }

        res.json(updated);
      } catch (error) {
        console.error("Update expense status error:", error);
        res.status(500).json({ error: "Failed to update expense status" });
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