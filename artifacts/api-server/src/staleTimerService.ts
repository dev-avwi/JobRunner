import { storage, db } from "./storage";
import { timeEntries } from "@workspace/db";
import { and, isNull, lte } from "drizzle-orm";

export async function checkAndAutoStopStaleTimers(): Promise<{ stopped: number; errors: number }> {
  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const eightHoursMs = 8 * 60 * 60 * 1000;
  let stopped = 0;
  let errors = 0;

  try {
    const staleEntries = await db.select().from(timeEntries)
      .where(and(
        isNull(timeEntries.endTime),
        lte(timeEntries.startTime, twelveHoursAgo)
      ));

    console.log(`[StaleTimerCheck] Found ${staleEntries.length} stale time entries (running > 12 hours)`);

    for (const entry of staleEntries) {
      try {
        const startTime = new Date(entry.startTime);
        const now = new Date();
        const cappedEndTime8h = new Date(startTime.getTime() + eightHoursMs);
        const endTime = cappedEndTime8h < now ? cappedEndTime8h : now;
        const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

        const existingDescription = entry.description || '';
        const autoStopNote = 'Auto-stopped: exceeded 12-hour limit';
        const newDescription = existingDescription
          ? `${existingDescription} | ${autoStopNote}`
          : autoStopNote;

        await storage.updateTimeEntry(entry.id, entry.userId, {
          endTime: endTime,
          duration: durationMinutes,
          description: newDescription,
        });

        await storage.createNotification({
          userId: entry.userId,
          type: 'general',
          title: 'Timer Auto-Stopped',
          message: `Your timer running since ${startTime.toLocaleString('en-AU')} was automatically stopped after exceeding 12 hours. End time was capped at 8 hours from start.`,
          relatedId: entry.id,
          relatedType: 'time_entry',
        });

        const user = await storage.getUser(entry.userId);
        const teamMembership = await storage.getTeamMembershipByMemberId(entry.userId);
        if (teamMembership && teamMembership.businessOwnerId) {
          await storage.createNotification({
            userId: teamMembership.businessOwnerId,
            type: 'general',
            title: 'Team Timer Auto-Stopped',
            message: `${user?.firstName || 'A team member'}'s timer was auto-stopped after exceeding 12 hours (capped at 8 hours).`,
            relatedId: entry.id,
            relatedType: 'time_entry',
          });
        }

        console.log(`[StaleTimerCheck] Auto-stopped time entry ${entry.id} for user ${entry.userId} (started: ${startTime.toISOString()}, capped end: ${endTime.toISOString()})`);
        stopped++;
      } catch (entryError) {
        console.error(`[StaleTimerCheck] Failed to auto-stop entry ${entry.id}:`, entryError);
        errors++;
      }
    }
  } catch (error) {
    console.error('[StaleTimerCheck] Error querying stale timers:', error);
  }

  console.log(`[StaleTimerCheck] Complete: ${stopped} stopped, ${errors} errors`);
  return { stopped, errors };
}
