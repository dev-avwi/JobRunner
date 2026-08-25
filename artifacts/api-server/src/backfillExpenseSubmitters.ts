/**
 * backfillExpenseSubmitters.ts
 *
 * One-time startup migration that resolves the legacy "[Logged by <name>]"
 * description prefix on old expenses and writes the corresponding user ID into
 * the submittedByUserId column.
 *
 * Resolution strategy (per expense row):
 *   1. If the expense has a jobId, query job_assignments and look for exactly
 *      one worker whose first name / username matches the extracted name.
 *   2. If step 1 yields no match (empty assignments, worker unassigned since
 *      logging, or name not in the assignment list), fall back to the full
 *      team_members list for the business owner and apply the same single-
 *      match rule.
 *   3. If there is still no unique match (0 candidates or 2+ with the same
 *      name), leave submittedByUserId NULL — the GET /api/expenses/mine ILIKE
 *      fallback still covers these rows.
 *
 * The migration is idempotent: it only touches rows where submittedByUserId IS
 * NULL, so re-running after a partial failure is safe.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./lib/logger";

/** Extract the logged-by name from a "[Logged by <name>] ..." description. */
function extractLoggedByName(description: string): string | null {
  const match = description.match(/^\[Logged by ([^\]]+)\]/i);
  return match ? match[1].trim().toLowerCase() : null;
}

type Candidate = { userId: string; candidateName: string };

export async function backfillExpenseSubmitters(): Promise<void> {
  try {
    // 1. Fetch all unresolved legacy expenses in one query.
    //    Pattern '[Logged by %' (no trailing bracket) matches the full
    //    description including any text after the ']', e.g.:
    //      "[Logged by Jake] Pipe fittings"
    const rows = await db.execute<{
      id: string;
      description: string;
      job_id: string | null;
      user_id: string;
    }>(sql`
      SELECT id, description, job_id, user_id
      FROM expenses
      WHERE submitted_by_user_id IS NULL
        AND description ILIKE '[Logged by %'
    `);

    if (rows.rows.length === 0) {
      logger.info("[ExpenseBackfill] No legacy expenses to backfill — skipping");
      return;
    }

    logger.info(
      { count: rows.rows.length },
      "[ExpenseBackfill] Backfilling submittedByUserId on legacy expenses"
    );

    // 2. Build per-job and per-owner caches to avoid repeated DB round trips.
    const assignmentCache = new Map<string, Candidate[]>();
    const teamMemberCache = new Map<string, Candidate[]>();

    let resolved = 0;
    let unresolved = 0;

    for (const row of rows.rows) {
      const loggedByName = extractLoggedByName(row.description);
      if (!loggedByName) {
        unresolved++;
        continue;
      }

      let matchedUserId: string | null = null;
      // Track how many assignment rows matched the name so we can decide
      // whether the team_members fallback is worth attempting.
      let assignmentMatchCount = 0;

      // ── Step 1: job assignment candidates ──────────────────────────────────
      if (row.job_id) {
        if (!assignmentCache.has(row.job_id)) {
          const assignmentRows = await db.execute<{
            user_id: string;
            first_name: string | null;
            username: string | null;
          }>(sql`
            SELECT ja.user_id,
                   u.first_name,
                   u.username
            FROM job_assignments ja
            JOIN users u ON u.id = ja.user_id
            WHERE ja.job_id = ${row.job_id}
          `);
          assignmentCache.set(
            row.job_id,
            assignmentRows.rows.map((r) => ({
              userId: r.user_id,
              candidateName: (r.first_name || r.username || "").trim().toLowerCase(),
            }))
          );
        }
        const assignmentCandidates = assignmentCache.get(row.job_id)!;
        const assignmentMatches = assignmentCandidates.filter(
          (c) => c.candidateName && c.candidateName === loggedByName
        );
        assignmentMatchCount = assignmentMatches.length;
        if (assignmentMatches.length === 1) {
          matchedUserId = assignmentMatches[0].userId;
        }
        // 2+ assignment matches → already ambiguous within the job; team_members
        // (a superset) would be at least as ambiguous, so skip the fallback.
      }

      // ── Step 2: team_member fallback ───────────────────────────────────────
      // Attempt only when step 1 yielded ZERO name matches. This covers:
      //   • expense has no jobId
      //   • job has no current assignments
      //   • original submitter was later unassigned from the job
      //   • name not present in the assignment list (username vs firstName mismatch)
      // When assignments had 2+ matches the name is already ambiguous; skipping
      // team_members avoids an even larger ambiguous candidate pool.
      if (!matchedUserId && assignmentMatchCount === 0) {
        const ownerId = row.user_id;
        if (!teamMemberCache.has(ownerId)) {
          // NOTE: team_members uses `member_id` (FK to users.id), not `user_id`.
          const memberRows = await db.execute<{
            member_id: string;
            first_name: string | null;
            username: string | null;
          }>(sql`
            SELECT tm.member_id,
                   u.first_name,
                   u.username
            FROM team_members tm
            JOIN users u ON u.id = tm.member_id
            WHERE tm.business_owner_id = ${ownerId}
              AND tm.member_id IS NOT NULL
          `);
          teamMemberCache.set(
            ownerId,
            memberRows.rows.map((r) => ({
              userId: r.member_id,
              candidateName: (r.first_name || r.username || "").trim().toLowerCase(),
            }))
          );
        }
        const teamCandidates = teamMemberCache.get(ownerId)!;
        const teamMatches = teamCandidates.filter(
          (c) => c.candidateName && c.candidateName === loggedByName
        );
        if (teamMatches.length === 1) {
          matchedUserId = teamMatches[0].userId;
        }
        // 2+ team member matches → ambiguous, leave unresolved
      }

      if (matchedUserId) {
        await db.execute(sql`
          UPDATE expenses
          SET submitted_by_user_id = ${matchedUserId}
          WHERE id = ${row.id}
            AND submitted_by_user_id IS NULL
        `);
        resolved++;
      } else {
        unresolved++;
      }
    }

    logger.info(
      { resolved, unresolved, total: rows.rows.length },
      "[ExpenseBackfill] Backfill complete"
    );
  } catch (err) {
    // Non-fatal — the ILIKE fallback in GET /api/expenses/mine still works for
    // any rows that weren't resolved, so a transient failure here doesn't break
    // the app. The migration will retry on the next startup.
    logger.error({ err }, "[ExpenseBackfill] Backfill failed (non-fatal)");
  }
}
