import { storage, db } from "./storage";
import { timeEntries, jobAssignments, teamMembers } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

export type AlertSeverity = "urgent" | "important" | "info";
export type AlertActionType = "assign" | "nudge" | "view" | "invoice" | "navigate";

export interface OperationalAlert {
  id: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  actionType: AlertActionType;
  actionLabel: string;
  relatedJobId?: string;
  relatedUserId?: string;
  relatedInvoiceId?: string;
  workerName?: string;
  jobTitle?: string;
  timeInfo?: string;
}

interface CachedAlerts {
  alerts: OperationalAlert[];
  timestamp: number;
}

const alertsCache = new Map<string, CachedAlerts>();
const CACHE_TTL_MS = 45 * 1000;

export async function getOperationalAlerts(userId: string): Promise<OperationalAlert[]> {
  const cached = alertsCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.alerts;
  }

  const alerts = await computeOperationalAlerts(userId);
  alertsCache.set(userId, { alerts, timestamp: Date.now() });
  return alerts;
}

async function computeOperationalAlerts(userId: string): Promise<OperationalAlert[]> {
  const alerts: OperationalAlert[] = [];
  const now = new Date();

  try {
    const [allJobs, allTeamMembers, allInvoices] = await Promise.all([
      storage.getJobs(userId),
      db.select().from(teamMembers).where(eq(teamMembers.businessOwnerId, userId)).then(
        members => members,
        () => [] as any[]
      ).catch(() => []),
      storage.getInvoices(userId),
    ]);

    const teamMemberUserIds = allTeamMembers
      .filter((m: any) => m.memberId && m.isActive)
      .map((m: any) => m.memberId as string);
    const allUserIds = [userId, ...teamMemberUserIds];

    const allTimeEntries = allUserIds.length > 0
      ? await db.select().from(timeEntries)
          .where(inArray(timeEntries.userId, allUserIds.slice(0, 100)))
          .catch(() => [] as any[])
      : [];

    const jobIds = allJobs.map(j => j.id).slice(0, 500);
    const allJobAssignments = jobIds.length > 0
      ? await db.select().from(jobAssignments)
          .where(inArray(jobAssignments.jobId, jobIds))
          .catch(() => [] as any[])
      : [];

    const activeTimers = allTimeEntries.filter((te: any) => te.startTime && !te.endTime);

    checkJobOverruns(alerts, activeTimers, allJobs, now);
    checkScheduleRisks(alerts, activeTimers, allJobs, now);
    checkUnassignedUpcoming(alerts, allJobs, allJobAssignments, now);
    checkScheduleConflicts(alerts, allJobs, allJobAssignments);
    checkIdleWorkers(alerts, allTeamMembers, activeTimers, allJobs, now);
    checkUninvoicedJobs(alerts, allJobs, allInvoices);
    await checkSubcontractorInvoices(alerts, userId);

  } catch (error) {
    console.error("[OperationalAlerts] Error computing alerts:", error);
  }

  alerts.sort((a, b) => {
    const severityOrder: Record<AlertSeverity, number> = { urgent: 0, important: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return alerts;
}

function checkJobOverruns(
  alerts: OperationalAlert[],
  activeTimers: any[],
  allJobs: any[],
  now: Date
) {
  for (const timer of activeTimers) {
    if (!timer.jobId) continue;

    const job = allJobs.find((j: any) => j.id === timer.jobId);
    if (!job) continue;

    const estimatedDuration = job.estimatedDuration;
    if (!estimatedDuration || estimatedDuration <= 0) continue;

    const startTime = new Date(timer.startTime);
    let elapsedMs = now.getTime() - startTime.getTime();
    const pausedMs = timer.pausedDuration ? parseInt(String(timer.pausedDuration), 10) * 60 * 1000 : 0;
    elapsedMs -= pausedMs;
    const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));
    const overMinutes = elapsedMinutes - estimatedDuration;

    if (overMinutes > 0) {
      alerts.push({
        id: `overrun-${timer.id}`,
        type: "job_overrun",
        severity: overMinutes > 60 ? "urgent" : "important",
        title: "Job running over estimate",
        message: `${job.title} is running ${overMinutes} min over the ${estimatedDuration} min estimate`,
        actionType: "view",
        actionLabel: "View Job",
        relatedJobId: job.id,
        relatedUserId: timer.userId,
        jobTitle: job.title,
        timeInfo: `${overMinutes} min over`,
      });
    }
  }
}

function checkScheduleRisks(
  alerts: OperationalAlert[],
  activeTimers: any[],
  allJobs: any[],
  now: Date
) {
  for (const timer of activeTimers) {
    if (!timer.jobId) continue;

    const currentJob = allJobs.find((j: any) => j.id === timer.jobId);
    if (!currentJob) continue;

    const workerId = timer.userId;

    const estimatedDuration = currentJob.estimatedDuration || 60;
    const startTime = new Date(timer.startTime);
    const pausedMs = timer.pausedDuration ? parseInt(String(timer.pausedDuration), 10) * 60 * 1000 : 0;
    const elapsedMs = now.getTime() - startTime.getTime() - pausedMs;
    const remainingMs = Math.max(0, estimatedDuration * 60 * 1000 - elapsedMs);
    const estimatedFinish = new Date(now.getTime() + remainingMs);

    const upcomingJobs = allJobs
      .filter((j: any) => {
        if (j.id === timer.jobId) return false;
        if (!["scheduled", "pending"].includes(j.status)) return false;
        if (j.assignedTo !== workerId && j.assignedTo !== currentJob.assignedTo) return false;
        const scheduledDate = j.scheduledAt;
        if (!scheduledDate) return false;
        const scheduledTime = new Date(scheduledDate);
        return scheduledTime > now && scheduledTime.getTime() - now.getTime() < 4 * 60 * 60 * 1000;
      })
      .sort((a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    if (upcomingJobs.length === 0) continue;

    const nextJob = upcomingJobs[0];
    const nextJobTime = new Date(nextJob.scheduledAt);
    const lateByMs = estimatedFinish.getTime() - nextJobTime.getTime();
    const lateByMinutes = Math.ceil(lateByMs / (1000 * 60));

    if (lateByMinutes > 0) {
      alerts.push({
        id: `schedule-risk-${timer.id}`,
        type: "schedule_risk",
        severity: "urgent",
        title: "May miss next job",
        message: `Current job "${currentJob.title}" may cause ${lateByMinutes} min delay for "${nextJob.title}"`,
        actionType: "navigate",
        actionLabel: "View Schedule",
        relatedJobId: nextJob.id,
        relatedUserId: workerId,
        jobTitle: nextJob.title,
        timeInfo: `${lateByMinutes} min late`,
      });
    }
  }
}

function checkUnassignedUpcoming(
  alerts: OperationalAlert[],
  allJobs: any[],
  allAssignments: any[],
  now: Date
) {
  const assignedJobIds = new Set(allAssignments.filter((a: any) => a.isActive).map((a: any) => a.jobId));

  const upcomingWindow = 24 * 60 * 60 * 1000;
  const upcomingJobs = allJobs.filter((j: any) => {
    if (!["scheduled", "pending"].includes(j.status)) return false;
    if (j.assignedTo) return false;
    if (assignedJobIds.has(j.id)) return false;
    const scheduledDate = j.scheduledAt;
    if (!scheduledDate) return false;
    const scheduledTime = new Date(scheduledDate);
    return scheduledTime > now && scheduledTime.getTime() - now.getTime() < upcomingWindow;
  });

  for (const job of upcomingJobs) {
    const scheduledTime = new Date(job.scheduledAt);
    const hoursUntil = Math.floor((scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60));
    const timeLabel = hoursUntil <= 1 ? "less than 1 hour" : `${hoursUntil} hours`;

    alerts.push({
      id: `unassigned-${job.id}`,
      type: "unassigned_upcoming",
      severity: hoursUntil <= 2 ? "urgent" : "important",
      title: "No one assigned",
      message: `"${job.title}" is scheduled in ${timeLabel} with no assignee`,
      actionType: "assign",
      actionLabel: "Assign Worker",
      relatedJobId: job.id,
      jobTitle: job.title,
      timeInfo: `In ${timeLabel}`,
    });
  }
}

function checkScheduleConflicts(
  alerts: OperationalAlert[],
  allJobs: any[],
  allAssignments: any[]
) {
  const activeAssignments = allAssignments.filter((a: any) => a.isActive);
  const userJobMap = new Map<string, any[]>();

  for (const assignment of activeAssignments) {
    const job = allJobs.find((j: any) => j.id === assignment.jobId);
    if (!job || !job.scheduledAt) continue;
    if (!["scheduled", "pending", "in_progress"].includes(job.status)) continue;

    const userId = assignment.userId;
    if (!userJobMap.has(userId)) userJobMap.set(userId, []);
    userJobMap.get(userId)!.push({ ...job, _assignmentUserId: userId });
  }

  for (const assignedTo of Array.from(new Set(allJobs.filter(j => j.assignedTo && j.scheduledAt).map(j => j.assignedTo!)))) {
    const userJobs = allJobs.filter(j =>
      j.assignedTo === assignedTo &&
      j.scheduledAt &&
      ["scheduled", "pending", "in_progress"].includes(j.status)
    );
    if (!userJobMap.has(assignedTo)) userJobMap.set(assignedTo, []);
    for (const j of userJobs) {
      if (!userJobMap.get(assignedTo)!.find((ej: any) => ej.id === j.id)) {
        userJobMap.get(assignedTo)!.push(j);
      }
    }
  }

  for (const [workerUserId, workerJobs] of Array.from(userJobMap)) {
    if (workerJobs.length < 2) continue;

    const sorted = workerJobs
      .filter(j => j.scheduledAt)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    for (let i = 0; i < sorted.length - 1; i++) {
      const jobA = sorted[i];
      const jobB = sorted[i + 1];
      const endA = new Date(new Date(jobA.scheduledAt).getTime() + (jobA.estimatedDuration || 60) * 60 * 1000);
      const startB = new Date(jobB.scheduledAt);

      if (endA > startB) {
        const overlapMinutes = Math.ceil((endA.getTime() - startB.getTime()) / (1000 * 60));
        const alertId = `conflict-${jobA.id}-${jobB.id}`;
        if (!alerts.find(a => a.id === alertId)) {
          alerts.push({
            id: alertId,
            type: "schedule_conflict",
            severity: "urgent",
            title: "Schedule conflict",
            message: `"${jobA.title}" and "${jobB.title}" overlap by ${overlapMinutes} min`,
            actionType: "navigate",
            actionLabel: "View Schedule",
            relatedJobId: jobA.id,
            relatedUserId: workerUserId,
            jobTitle: jobA.title,
            timeInfo: `${overlapMinutes} min overlap`,
          });
        }
      }
    }
  }
}

function checkIdleWorkers(
  alerts: OperationalAlert[],
  allTeamMembers: any[],
  activeTimers: any[],
  allJobs: any[],
  now: Date
) {
  const hour = now.getHours();
  if (hour < 6 || hour > 18) return;

  const activeUserIds = new Set(activeTimers.map((t: any) => t.userId));

  const scheduledTodayByUser = new Map<string, any[]>();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  for (const job of allJobs) {
    if (!job.scheduledAt) continue;
    const scheduledDate = new Date(job.scheduledAt);
    if (scheduledDate < todayStart || scheduledDate > todayEnd) continue;
    if (!["scheduled", "pending", "in_progress"].includes(job.status)) continue;

    const assignee = job.assignedTo;
    if (assignee) {
      if (!scheduledTodayByUser.has(assignee)) scheduledTodayByUser.set(assignee, []);
      scheduledTodayByUser.get(assignee)!.push(job);
    }
  }

  for (const member of allTeamMembers) {
    if (!member.isActive || member.inviteStatus !== "accepted") continue;
    const memberId = member.memberId;
    if (!memberId) continue;

    if (activeUserIds.has(memberId)) continue;

    const todayJobs = scheduledTodayByUser.get(memberId) || [];
    if (todayJobs.length === 0) continue;

    const pastJobs = todayJobs.filter(j => {
      const scheduledDate = new Date(j.scheduledAt);
      return scheduledDate < now;
    });

    if (pastJobs.length > 0) {
      alerts.push({
        id: `idle-${memberId}`,
        type: "worker_idle",
        severity: "info",
        title: "Worker may be idle",
        message: `${member.name || "Team member"} has scheduled jobs today but no active timer`,
        actionType: "nudge",
        actionLabel: "View Schedule",
        relatedUserId: memberId,
        workerName: member.name || "Team member",
      });
    }
  }
}

function checkUninvoicedJobs(
  alerts: OperationalAlert[],
  allJobs: any[],
  allInvoices: any[]
) {
  const invoicedJobIds = new Set(
    allInvoices.filter((inv: any) => inv.jobId).map((inv: any) => inv.jobId)
  );

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const uninvoiced = allJobs.filter((j: any) => {
    if (j.status !== "done") return false;
    if (invoicedJobIds.has(j.id)) return false;
    const completedAt = j.completedAt;
    if (!completedAt) return true;
    return new Date(completedAt) < threeDaysAgo;
  });

  for (const job of uninvoiced.slice(0, 5)) {
    const daysSinceCompletion = job.completedAt
      ? Math.floor((Date.now() - new Date(job.completedAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    alerts.push({
      id: `uninvoiced-${job.id}`,
      type: "uninvoiced_job",
      severity: "info",
      title: "Job not invoiced",
      message: `"${job.title}" completed ${daysSinceCompletion > 0 ? `${daysSinceCompletion} days ago` : "recently"} — still not invoiced`,
      actionType: "invoice",
      actionLabel: "Create Invoice",
      relatedJobId: job.id,
      jobTitle: job.title,
      timeInfo: daysSinceCompletion > 0 ? `${daysSinceCompletion}d ago` : undefined,
    });
  }
}

async function checkSubcontractorInvoices(
  alerts: OperationalAlert[],
  businessOwnerId: string
) {
  try {
    const invoices = await storage.getSubcontractorInvoicesByBusiness(businessOwnerId);
    const pending = invoices.filter(
      (inv: any) => inv.status === "submitted" || inv.status === "approved"
    );

    for (const inv of pending.slice(0, 5)) {
      const total = parseFloat(inv.totalAmount || "0");
      const isApproved = inv.status === "approved";

      let subName = "A subcontractor";
      try {
        const u = await storage.getUser(inv.subcontractorUserId);
        if (u) {
          subName =
            `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
            u.email ||
            subName;
        }
      } catch {
        // name enrichment is best-effort
      }

      const amountText = `$${total.toLocaleString("en-AU", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

      alerts.push({
        id: `sub-invoice-${inv.id}`,
        type: "subcontractor_invoice",
        severity: "important",
        title: isApproved
          ? "Subcontractor invoice to pay"
          : "New subcontractor invoice",
        message: isApproved
          ? `${subName} — ${inv.invoiceNumber} for ${amountText} approved, awaiting payment`
          : `${subName} sent ${inv.invoiceNumber} for ${amountText} — awaiting your review`,
        actionType: "view",
        actionLabel: isApproved ? "Pay Invoice" : "Review Invoice",
        relatedInvoiceId: inv.id,
        timeInfo: amountText,
      });
    }
  } catch (error) {
    console.error(
      "[OperationalAlerts] Subcontractor invoice check failed:",
      error
    );
  }
}
