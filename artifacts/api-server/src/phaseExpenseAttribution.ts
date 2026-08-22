export type PhaseExpense = {
  phaseId?: string | null;
  amount?: string | number | null;
};

export type ExpensePhaseStorage = {
  getJob(jobId: string, userId: string): Promise<unknown | undefined>;
  getJobPhases(jobId: string, userId: string): Promise<Array<{ id: string }>>;
};

export class ExpensePhaseValidationError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404,
  ) {
    super(message);
    this.name = "ExpensePhaseValidationError";
  }
}

/**
 * Assign expenses strictly by their saved phase link. Unlike historical costs,
 * an expense must never be inferred into a phase from its date.
 */
export function allocateExpensesByPhase(
  expenses: PhaseExpense[],
  phaseIds: Iterable<string>,
): { byPhaseId: Map<string, number>; unallocated: number } {
  const knownPhaseIds = new Set(phaseIds);
  const byPhaseId = new Map<string, number>();
  let unallocated = 0;

  for (const expense of expenses) {
    const amount = Number.parseFloat(String(expense.amount ?? "0"));
    if (!Number.isFinite(amount)) continue;

    if (expense.phaseId && knownPhaseIds.has(expense.phaseId)) {
      byPhaseId.set(expense.phaseId, (byPhaseId.get(expense.phaseId) ?? 0) + amount);
    } else {
      unallocated += amount;
    }
  }

  return { byPhaseId, unallocated };
}

/**
 * Confirm a phase belongs to the expense's job within the current business.
 */
export async function assertExpensePhaseAssignment(
  storage: ExpensePhaseStorage,
  effectiveUserId: string,
  jobId: string | null | undefined,
  phaseId: string | null | undefined,
): Promise<void> {
  if (!phaseId) return;
  if (!jobId) {
    throw new ExpensePhaseValidationError(
      "A job is required when assigning an expense to a phase",
      400,
    );
  }

  const job = await storage.getJob(jobId, effectiveUserId);
  if (!job) {
    throw new ExpensePhaseValidationError("Job not found", 404);
  }

  const phases = await storage.getJobPhases(jobId, effectiveUserId);
  if (!phases.some((phase) => phase.id === phaseId)) {
    throw new ExpensePhaseValidationError(
      "The selected phase does not belong to this job",
      400,
    );
  }
}