import { storage, db } from "./storage";
import { timeEntries, jobs } from "@shared/schema";
import { and, isNull, isNotNull, eq } from "drizzle-orm";
import { notifyOvertimeWarning } from "./pushNotifications";
import { format } from "date-fns";

const overtimeNudgeSent = new Map<string, number>();
const NUDGE_COOLDOWN_MS = 2 * 60 * 60 * 1000;

export async function checkOvertimeTimers(): Promise<{ nudged: number; errors: number }> {
  let nudged = 0;
  let errors = 0;

  try {
    const activeEntries = await db.select().from(timeEntries)
      .where(and(
        isNull(timeEntries.endTime),
        isNotNull(timeEntries.jobId)
      ));

    for (const entry of activeEntries) {
      try {
        if (!entry.jobId) continue;

        const job = await storage.getJobPublic(entry.jobId);
        if (!job) continue;

        const estimatedDuration = (job as any).estimatedDuration;
        if (!estimatedDuration || estimatedDuration <= 0) continue;

        const startTime = new Date(entry.startTime);
        const now = new Date();
        let elapsedMs = now.getTime() - startTime.getTime();

        // time_entries has no paused-duration column; pause tracking is not persisted here.
        const pausedMs = 0;
        elapsedMs -= pausedMs;

        const elapsedMinutes = elapsedMs / (1000 * 60);
        const estimatedMinutes = estimatedDuration;

        if (elapsedMinutes <= estimatedMinutes) continue;

        const nudgeKey = `${entry.id}`;
        const lastNudge = overtimeNudgeSent.get(nudgeKey);
        if (lastNudge && (now.getTime() - lastNudge) < NUDGE_COOLDOWN_MS) continue;

        let nextJobTitle: string | null = null;
        let nextJobTime: string | null = null;

        try {
          const userJobs = await storage.getJobs(entry.userId);
          const upcoming = userJobs
            .filter((j: any) => {
              if (j.id === entry.jobId) return false;
              if (!['scheduled', 'pending'].includes(j.status)) return false;
              const scheduledDate = (j as any).scheduledDate || (j as any).scheduledAt;
              if (!scheduledDate) return false;
              const scheduledTime = new Date(scheduledDate);
              return scheduledTime > now;
            })
            .sort((a: any, b: any) => {
              const aDate = new Date((a as any).scheduledDate || (a as any).scheduledAt);
              const bDate = new Date((b as any).scheduledDate || (b as any).scheduledAt);
              return aDate.getTime() - bDate.getTime();
            });

          if (upcoming.length > 0) {
            const nextJob = upcoming[0];
            nextJobTitle = nextJob.title;
            const scheduledDate = (nextJob as any).scheduledDate || (nextJob as any).scheduledAt;
            if (scheduledDate) {
              nextJobTime = format(new Date(scheduledDate), 'h:mm a');
            }
          }
        } catch (e) {
        }

        const elapsedHours = elapsedMinutes / 60;
        const estimatedHours = estimatedMinutes / 60;

        await notifyOvertimeWarning(
          entry.userId,
          job.title,
          job.id,
          elapsedHours,
          estimatedHours,
          nextJobTitle,
          nextJobTime
        );

        await storage.createNotification({
          userId: entry.userId,
          type: 'general',
          title: 'Running Over Time',
          message: `You've been on ${job.title} for ${elapsedHours.toFixed(1)}h — estimated was ${estimatedHours.toFixed(1)}h.${nextJobTitle ? ` Next: ${nextJobTitle} at ${nextJobTime}.` : ''}`,
          relatedId: job.id,
          relatedType: 'job',
        });

        overtimeNudgeSent.set(nudgeKey, now.getTime());
        nudged++;

        console.log(`[OvertimeNudge] Notified user ${entry.userId} for job ${job.title}: ${elapsedHours.toFixed(1)}h elapsed vs ${estimatedHours.toFixed(1)}h estimated`);
      } catch (entryError) {
        console.error(`[OvertimeNudge] Error processing entry ${entry.id}:`, entryError);
        errors++;
      }
    }
  } catch (error) {
    console.error('[OvertimeNudge] Error querying active timers:', error);
  }

  if (nudged > 0 || errors > 0) {
    console.log(`[OvertimeNudge] Complete: ${nudged} nudged, ${errors} errors`);
  }
  return { nudged, errors };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, time] of Array.from(overtimeNudgeSent.entries())) {
    if (now - time > 24 * 60 * 60 * 1000) {
      overtimeNudgeSent.delete(key);
    }
  }
}, 60 * 60 * 1000);
