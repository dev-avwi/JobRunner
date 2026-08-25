/**
 * backfillExpenseSubmitters.ts
 *
 * DISABLED: This backfill was originally designed to resolve the legacy
 * "[Logged by <name>]" description prefix on old expenses by matching
 * the name against current job assignments or team members.
 *
 * The approach is unsafe: a departed worker who logged "[Logged by Alex]"
 * could be replaced by a new current worker also named Alex. The current
 * Alex would be the unique match and would permanently receive attribution
 * for the former worker's expenses, giving them access via
 * GET /api/expenses/mine.
 *
 * Display names and current team membership are not durable identity
 * evidence for historical expense records. Rows that cannot be verified
 * against authoritative historical data are left with submittedByUserId
 * NULL. Owners can view all expenses for a job via the job-level expenses
 * endpoint regardless of submittedByUserId.
 */

import { logger } from "./lib/logger";

export async function backfillExpenseSubmitters(): Promise<void> {
  logger.info(
    "[ExpenseBackfill] Name-based backfill disabled — " +
    "legacy [Logged by Name] rows left unresolved to prevent " +
    "cross-worker expense disclosure when names are not unique."
  );
}
