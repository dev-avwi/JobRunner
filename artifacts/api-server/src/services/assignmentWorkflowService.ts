import { storage } from '../storage';
import { sendSmsToClient } from './smsService';
import { randomBytes } from 'crypto';
import { getErrorMessage } from "../lib/errors";

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function estimateEtaMinutes(distanceKm: number): number {
  if (distanceKm <= 5) return Math.max(5, Math.round(distanceKm * 3));
  if (distanceKm <= 20) return Math.round(distanceKm * 2.5);
  if (distanceKm <= 50) return Math.round(distanceKm * 2);
  return Math.round(distanceKm * 1.5);
}

interface OnMyWayParams {
  jobId: string;
  assignmentId: string;
  actorUserId: string;
  workerLatitude?: number;
  workerLongitude?: number;
  customMessage?: string;
  baseUrl: string;
}

interface OnMyWayResult {
  success: boolean;
  portalUrl?: string;
  etaMinutes?: number;
  smsSent?: boolean;
  antiSpamBlocked?: boolean;
  error?: string;
  // Set when the state change succeeded but the client SMS could not be sent
  // (e.g. the business has no dedicated number). Lets clients show a
  // non-blocking "get your business number" prompt without implying the
  // status change failed.
  smsFailed?: boolean;
  smsErrorCode?: string;
}

const DEDICATED_NUMBER_RE = /dedicated (phone )?number/i;

export async function handleOnMyWay(params: OnMyWayParams): Promise<OnMyWayResult> {
  const { jobId, assignmentId, actorUserId, workerLatitude, workerLongitude, customMessage, baseUrl } = params;

  const assignment = await storage.getJobAssignment(assignmentId);
  if (!assignment) {
    return { success: false, error: 'Assignment not found' };
  }
  if (assignment.jobId !== jobId) {
    return { success: false, error: 'Assignment does not belong to this job' };
  }
  if (!assignment.isActive) {
    return { success: false, error: 'Assignment is not active' };
  }

  // Subcontractors must accept assignment before going on the way
  if (assignment.assignmentStatus === 'invited' || assignment.assignmentStatus === 'declined') {
    return { success: false, error: 'Assignment must be accepted before starting travel' };
  }

  const job = await storage.getJob(jobId, assignment.userId);
  if (!job) {
    return { success: false, error: 'Job not found' };
  }

  if (assignment.userId !== actorUserId && job.userId !== actorUserId) {
    return { success: false, error: 'You do not have permission to update this assignment' };
  }
  if (job.status === 'cancelled') {
    return { success: false, error: 'Job is cancelled' };
  }
  if (!job.clientId) {
    return { success: false, error: 'Job has no associated client' };
  }

  const client = await storage.getClient(job.clientId, assignment.userId);
  if (!client) {
    return { success: false, error: 'Client not found' };
  }

  const effectiveUserId = job.userId;
  const business = await storage.getBusinessSettings(effectiveUserId);
  const businessName = business?.businessName || 'Your tradesperson';
  const ownerPhone = business?.phone || '';
  const ownerName = businessName;

  // Pre-flight: the whole point of "on my way" is the client SMS. If the
  // business has no dedicated number, fail BEFORE any state writes so a retry
  // after purchasing a number doesn't duplicate status changes/events.
  if (client.phone && !business?.dedicatedPhoneNumber) {
    return { success: false, error: 'No business phone number configured. Purchase a dedicated number to send SMS.' };
  }

  const worker = await storage.getUser(assignment.userId);
  const workerName = assignment.workerDisplayNameSnapshot || 
    (worker ? [worker.firstName, worker.lastName].filter(Boolean).join(' ') : 'Your tradesperson');

  let etaMinutes: number | undefined;
  if (workerLatitude != null && workerLongitude != null && job.latitude != null && job.longitude != null) {
    const distance = haversineDistance(
      workerLatitude, workerLongitude,
      parseFloat(job.latitude), parseFloat(job.longitude)
    );
    etaMinutes = estimateEtaMinutes(distance);
  } else {
    etaMinutes = 20;
  }

  await storage.updateJobAssignment(assignmentId, {
    assignmentStatus: 'en_route',
    travelStartedAt: new Date(),
    etaMinutes,
    etaUpdatedAt: new Date(),
  });

  await storage.updateJob(jobId, effectiveUserId, {
    workerStatus: 'on_my_way',
    workerStatusUpdatedAt: new Date(),
    workerEtaMinutes: etaMinutes,
  });

  try {
    const teamMembership = await storage.getTeamMembershipByMemberId(actorUserId);
    const bizOwnerId = teamMembership?.businessOwnerId || effectiveUserId;
    await storage.upsertWorkerState(actorUserId, bizOwnerId, 'travelling', jobId);
    const { broadcastWorkerStateChange } = await import('../websocket');
    broadcastWorkerStateChange(bizOwnerId, { userId: actorUserId, state: 'travelling', jobId });
    await storage.upsertTradieStatus({
      userId: assignment.userId,
      businessOwnerId: effectiveUserId,
      activityStatus: 'travelling',
      currentJobId: jobId,
      lastSeenAt: new Date(),
      lastLocationUpdate: new Date(),
      ...(workerLatitude != null && workerLongitude != null ? {
        currentLatitude: workerLatitude.toString(),
        currentLongitude: workerLongitude.toString(),
      } : {}),
    });
  } catch (e) {
    console.warn('[WorkerState] Auto-update travelling failed:', e);
  }

  await storage.createAssignmentEvent({
    assignmentId,
    jobId,
    actorUserId,
    eventType: 'on_my_way_pressed',
    eventData: {
      etaMinutes,
      workerLatitude,
      workerLongitude,
      timestamp: new Date().toISOString(),
    },
  });

  let portalToken = await storage.getActiveJobPortalToken(jobId);
  if (!portalToken) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    portalToken = await storage.createJobPortalToken({
      jobId,
      assignmentId: null,
      userId: effectiveUserId,
      token,
      expiresAt,
      createdBy: actorUserId,
    });
    await storage.updateJob(jobId, effectiveUserId, { portalEnabled: true });
  }

  const portalUrl = `${baseUrl}/p/${portalToken.token}`;

  let smsSent = false;
  let antiSpamBlocked = false;

  // Determine if this assignment is primary or if it's the only active assignment on the job
  const allAssignments = await storage.getJobAssignments(jobId);
  const activeAssignments = allAssignments.filter((a: any) => a.isActive);
  const shouldSendSms = assignment.isPrimary || activeAssignments.length <= 1;

  if (shouldSendSms && client.phone) {
    const lastSms = await storage.getLastSmsNotification(assignmentId, 'on_my_way');
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    if (lastSms && new Date(lastSms.sentAt) > tenMinutesAgo) {
      antiSpamBlocked = true;
      console.log(`[OnMyWay] Anti-spam: SMS blocked for assignment ${assignmentId}, last sent ${lastSms.sentAt}`);
    } else {
      const etaText = etaMinutes ? `${etaMinutes} mins` : 'soon';
      const contactInfo = ownerPhone ? `${ownerName} on ${ownerPhone}` : ownerName;
      
      const smsBody = customMessage || 
        `JobRunner — ${businessName}: ${workerName} is on the way. ETA ${etaText}. Track live: ${portalUrl}. Questions? Call ${contactInfo}.`;

      try {
        const smsMessage = await sendSmsToClient({
          businessOwnerId: effectiveUserId,
          clientId: job.clientId,
          clientPhone: client.phone,
          clientName: client.name,
          jobId,
          message: smsBody,
          senderUserId: actorUserId,
          isQuickAction: true,
          quickActionType: 'on_my_way',
        });

        if (smsMessage.status === 'failed') {
          // Dedicated-number absence is pre-checked before any writes; any
          // failure here is transient — log it, don't fail the state change.
          console.error('[OnMyWay] SMS send failed:', smsMessage.errorMessage);
          throw new Error(smsMessage.errorMessage || 'SMS send failed');
        }

        smsSent = true;

        await storage.createSmsNotificationLog({
          jobId,
          assignmentId,
          userId: actorUserId,
          clientPhone: client.phone,
          notificationType: 'on_my_way',
          portalTokenId: portalToken.id,
          etaMinutes,
        });

        await storage.updateJobAssignment(assignmentId, {
          lastSmsSentAt: new Date(),
        });

        await storage.createAssignmentEvent({
          assignmentId,
          jobId,
          actorUserId,
          eventType: 'sms_sent',
          eventData: {
            notificationType: 'on_my_way',
            clientPhone: client.phone,
            etaMinutes,
          },
        });
      } catch (smsError: unknown) {
        console.error('[OnMyWay] SMS send failed:', getErrorMessage(smsError));
      }
    }
  }

  return {
    success: true,
    portalUrl,
    etaMinutes,
    smsSent,
    antiSpamBlocked,
  };
}

interface WorkerStatusParams {
  jobId: string;
  assignmentId: string;
  actorUserId: string;
  status: 'arrived' | 'in_progress' | 'completed';
  baseUrl: string;
}

export async function handleWorkerStatusChange(params: WorkerStatusParams): Promise<OnMyWayResult> {
  const { jobId, assignmentId, actorUserId, status, baseUrl } = params;

  const assignment = await storage.getJobAssignment(assignmentId);
  if (!assignment) {
    return { success: false, error: 'Assignment not found' };
  }
  if (assignment.jobId !== jobId) {
    return { success: false, error: 'Assignment does not belong to this job' };
  }

  // Load the job BEFORE any writes to enforce terminal-state guards.
  // This prevents the worker-status path from reopening a job that has
  // already been completed, invoiced, or cancelled via the status endpoints.
  const effectiveUserId = assignment.userId;
  const job = await storage.getJob(jobId, effectiveUserId);
  if (!job) {
    return { success: false, error: 'Job not found' };
  }
  const terminalJobStatuses = ['done', 'completed', 'invoiced', 'cancelled'];
  if (terminalJobStatuses.includes(job.status)) {
    return { success: false, error: `Cannot update worker status on a ${job.status} job` };
  }

  let statusSmsFailed = false;
  let statusSmsErrorCode: string | undefined;

  const assignmentStatusMap: Record<string, string> = {
    arrived: 'arrived',
    in_progress: 'in_progress', 
    completed: 'completed',
  };

  const updateData: any = {
    assignmentStatus: assignmentStatusMap[status],
  };
  if (status === 'arrived') {
    updateData.arrivedAt = new Date();
  }

  await storage.updateJobAssignment(assignmentId, updateData);

  const jobUpdateData: any = {
    workerStatus: status === 'arrived' ? 'arrived' : status,
    workerStatusUpdatedAt: new Date(),
  };
  if (status === 'in_progress') {
    jobUpdateData.status = 'in_progress';
    jobUpdateData.startedAt = new Date();
  } else if (status === 'completed') {
    jobUpdateData.status = 'done';
    jobUpdateData.completedAt = new Date();
  }

  await storage.updateJob(jobId, effectiveUserId, jobUpdateData);

  try {
    const teamMembership = await storage.getTeamMembershipByMemberId(actorUserId);
    const bizOwnerId = teamMembership?.businessOwnerId || effectiveUserId;
    const workerStateMap: Record<string, string> = {
      arrived: 'on_job',
      in_progress: 'on_job',
      completed: 'available',
    };
    const newState = workerStateMap[status] || 'available';
    await storage.upsertWorkerState(actorUserId, bizOwnerId, newState, status === 'completed' ? null : jobId);
    const { broadcastWorkerStateChange } = await import('../websocket');
    broadcastWorkerStateChange(bizOwnerId, { userId: actorUserId, state: newState, jobId: status === 'completed' ? null : jobId });
  } catch (e) {
    console.warn('[WorkerState] Auto-update on status change failed:', e);
  }

  await storage.createAssignmentEvent({
    assignmentId,
    jobId,
    actorUserId,
    eventType: status === 'arrived' ? 'arrived' : status === 'in_progress' ? 'work_started' : 'completed',
    eventData: { timestamp: new Date().toISOString() },
  });

  if (status === 'arrived' || status === 'completed') {
    try {
      const { clearWorkerTravelLocation } = await import('../websocket');
      clearWorkerTravelLocation(jobId);
    } catch (e) {}
  }

  if (status === 'completed') {
    try {
      const portalToken = await storage.getActivePortalTokenForAssignment(assignmentId) 
        || await storage.getActiveJobPortalToken(jobId);
      if (portalToken) {
        const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        if (!portalToken.expiresAt || new Date(portalToken.expiresAt) > sevenDaysFromNow) {
          await storage.updateJobPortalTokenExpiry(portalToken.id, sevenDaysFromNow);
        }
      }
    } catch (e) {
      console.log('[Portal] Failed to update token expiry on job completion:', e);
    }
  }

  if (job && job.clientId) {
    const client = await storage.getClient(job.clientId, effectiveUserId);
    if (client?.phone) {
      const business = await storage.getBusinessSettings(effectiveUserId);
      const businessName = business?.businessName || 'Your tradesperson';
      const worker = await storage.getUser(assignment.userId);
      const workerName = assignment.workerDisplayNameSnapshot || 
        (worker ? [worker.firstName, worker.lastName].filter(Boolean).join(' ') : 'Your tradesperson');

      let portalToken = await storage.getActivePortalTokenForAssignment(assignmentId);
      if (!portalToken) portalToken = await storage.getActiveJobPortalToken(jobId);
      const portalUrl = portalToken ? `${baseUrl}/p/${portalToken.token}` : '';

      const ownerPhone = business?.phone || 'the office';
      let smsBody = '';
      if (status === 'arrived') {
        const portalSuffix = portalUrl ? ` Track progress: ${portalUrl}` : '';
        smsBody = `JobRunner — ${businessName}: ${workerName} has arrived at your job "${job.title}".${portalSuffix} Call ${ownerPhone} if needed.`;
      } else if (status === 'in_progress') {
        const portalSuffix = portalUrl ? ` Track progress: ${portalUrl}` : '';
        smsBody = `JobRunner — ${businessName}: Work has started on your job "${job.title}".${portalSuffix} Call ${ownerPhone} if needed.`;
      } else if (status === 'completed') {
        const portalSuffix = portalUrl ? ` View details: ${portalUrl}` : '';
        smsBody = `JobRunner — ${businessName}: Your job "${job.title}" is now complete!${portalSuffix} Call ${ownerPhone} if you have any questions.`;
      }

      if (smsBody) {
        const lastSms = await storage.getLastSmsNotification(assignmentId, status);
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        // Cross-status anti-spam: don't send "in_progress" SMS if "arrived" SMS was sent
        // in the last 30 minutes — workers often press Arrived → Start Work back-to-back,
        // and the client doesn't need two near-identical updates.
        let crossStatusBlocked = false;
        if (status === 'in_progress') {
          const recentArrived = await storage.getLastSmsNotification(assignmentId, 'arrived');
          const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
          if (recentArrived && new Date(recentArrived.sentAt) > thirtyMinutesAgo) {
            crossStatusBlocked = true;
            console.log(`[WorkerStatus] Cross-status anti-spam: in_progress SMS blocked for assignment ${assignmentId}, arrived SMS sent at ${recentArrived.sentAt}`);
          }
        }

        if (lastSms && new Date(lastSms.sentAt) > tenMinutesAgo) {
          console.log(`[WorkerStatus] Anti-spam: ${status} SMS blocked for assignment ${assignmentId}, last sent ${lastSms.sentAt}`);
        } else if (crossStatusBlocked) {
          // Skip — already logged above
        } else if (!lastSms || new Date(lastSms.sentAt) <= tenMinutesAgo) {
          try {
            const smsMessage = await sendSmsToClient({
              businessOwnerId: effectiveUserId,
              clientId: job.clientId,
              clientPhone: client.phone,
              clientName: client.name,
              jobId,
              message: smsBody,
              senderUserId: actorUserId,
              isQuickAction: true,
              quickActionType: `worker_${status}`,
            });

            if (smsMessage.status === 'failed') {
              // Status change already persisted — don't fail it. Surface the
              // SMS failure separately so clients can show the get-a-number
              // prompt without implying the status update failed.
              statusSmsFailed = true;
              if (DEDICATED_NUMBER_RE.test(smsMessage.errorMessage || '')) {
                statusSmsErrorCode = 'DEDICATED_NUMBER_REQUIRED';
              }
              console.error(`[WorkerStatus] SMS send failed for ${status}:`, smsMessage.errorMessage);
            } else {
              await storage.createSmsNotificationLog({
                jobId,
                assignmentId,
                userId: actorUserId,
                clientPhone: client.phone,
                notificationType: status,
                portalTokenId: portalToken?.id,
              });

              await storage.updateJobAssignment(assignmentId, {
                lastSmsSentAt: new Date(),
              });
            }
          } catch (smsError: unknown) {
            statusSmsFailed = true;
            console.error(`[WorkerStatus] SMS send failed for ${status}:`, getErrorMessage(smsError));
          }
        }
      }
    }
  }

  return { success: true, ...(statusSmsFailed ? { smsFailed: true, smsErrorCode: statusSmsErrorCode } : {}) };
}

export async function handleDelayedNotification(params: {
  jobId: string;
  assignmentId: string;
  actorUserId: string;
  newEtaMinutes: number;
  baseUrl: string;
}): Promise<OnMyWayResult> {
  const { jobId, assignmentId, actorUserId, newEtaMinutes, baseUrl } = params;

  const assignment = await storage.getJobAssignment(assignmentId);
  if (!assignment) return { success: false, error: 'Assignment not found' };

  // Pre-flight: the whole point of a delay notification is the client SMS.
  // Check the dedicated number BEFORE any state writes so a retry after
  // purchasing a number doesn't duplicate ETA updates/events.
  {
    const preJob = await storage.getJob(jobId, assignment.userId);
    if (preJob?.clientId) {
      const preClient = await storage.getClient(preJob.clientId, assignment.userId);
      if (preClient?.phone) {
        const preBiz = await storage.getBusinessSettings(assignment.userId);
        if (!preBiz?.dedicatedPhoneNumber) {
          return { success: false, error: 'No business phone number configured. Purchase a dedicated number to send SMS.' };
        }
      }
    }
  }

  await storage.updateJobAssignment(assignmentId, {
    etaMinutes: newEtaMinutes,
    etaUpdatedAt: new Date(),
  });

  await storage.updateJob(jobId, assignment.userId, {
    workerEtaMinutes: newEtaMinutes,
  });

  await storage.createAssignmentEvent({
    assignmentId,
    jobId,
    actorUserId,
    eventType: 'eta_updated',
    eventData: { newEtaMinutes, timestamp: new Date().toISOString() },
  });

  const job = await storage.getJob(jobId, assignment.userId);
  if (!job || !job.clientId) return { success: true, etaMinutes: newEtaMinutes };

  const client = await storage.getClient(job.clientId, assignment.userId);
  if (!client?.phone) return { success: true, etaMinutes: newEtaMinutes };

  const business = await storage.getBusinessSettings(assignment.userId);
  const businessName = business?.businessName || 'Your tradesperson';
  const worker = await storage.getUser(assignment.userId);
  const workerName = assignment.workerDisplayNameSnapshot ||
    (worker ? [worker.firstName, worker.lastName].filter(Boolean).join(' ') : 'Your tradesperson');

  let portalToken = await storage.getActivePortalTokenForAssignment(assignmentId);
  if (!portalToken) portalToken = await storage.getActiveJobPortalToken(jobId);
  const portalUrl = portalToken ? `${baseUrl}/p/${portalToken.token}` : '';

  const ownerPhone = business?.phone || '';
  const contactSuffix = ownerPhone ? ` Questions? Call ${ownerPhone}.` : '';
  const trackSuffix = portalUrl ? ` Track live: ${portalUrl}.` : '';
  const smsBody = `${businessName}: Apologies — ${workerName} is running ~${newEtaMinutes} mins late.${trackSuffix}${contactSuffix}`;

  const lastSms = await storage.getLastSmsNotification(assignmentId, 'delayed');
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  if (!lastSms || new Date(lastSms.sentAt) <= tenMinutesAgo) {
    try {
      const smsMessage = await sendSmsToClient({
        businessOwnerId: assignment.userId,
        clientId: job.clientId,
        clientPhone: client.phone,
        clientName: client.name,
        jobId,
        message: smsBody,
        senderUserId: actorUserId,
        isQuickAction: true,
        quickActionType: 'worker_delayed',
      });

      if (smsMessage.status === 'failed') {
        // Dedicated-number absence is pre-checked before any writes; a
        // failure here is transient — log it, don't fail the state change.
        throw new Error(smsMessage.errorMessage || 'SMS send failed');
      }

      await storage.createSmsNotificationLog({
        jobId,
        assignmentId,
        userId: actorUserId,
        clientPhone: client.phone,
        notificationType: 'delayed',
        etaMinutes: newEtaMinutes,
      });
    } catch (e: unknown) {
      console.error('[Delayed] SMS send failed:', getErrorMessage(e));
    }
  }

  return { success: true, etaMinutes: newEtaMinutes };
}
