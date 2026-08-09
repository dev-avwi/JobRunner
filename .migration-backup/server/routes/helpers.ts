import { db } from "../storage";
import { storage } from "../storage";
import { eq, and, gte, lte } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { rateLimits } from "@shared/schema";
import { createHash } from "crypto";
import { checkTwilioAvailability } from "../twilioClient";
import { getEmailIntegration, getGmailConnectionStatus } from "../emailIntegrationService";
import { hasPermission, PERMISSIONS, type UserContext } from "../permissions";
import type { BusinessContext } from "../ai";

const fallbackChatMap = new Map<string, { count: number; resetAt: number }>();
const fallbackPortalMap = new Map<string, { count: number; resetAt: number }>();
const fallbackEnRouteMap = new Map<string, number>();

export async function dbCheckRateLimit(
  key: string,
  maxCount: number,
  windowMs: number,
  fallbackMap: Map<string, { count: number; resetAt: number }>
): Promise<{ allowed: boolean; count: number }> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + windowMs);

    const existing = await db
      .select()
      .from(rateLimits)
      .where(and(eq(rateLimits.key, key), gte(rateLimits.expiresAt, now)))
      .limit(1);

    if (existing.length > 0) {
      const entry = existing[0];
      if (entry.count >= maxCount) {
        return { allowed: false, count: entry.count };
      }
      await db
        .update(rateLimits)
        .set({ count: entry.count + 1 })
        .where(eq(rateLimits.id, entry.id));
      return { allowed: true, count: entry.count + 1 };
    }

    await db.insert(rateLimits).values({
      key,
      count: 1,
      windowStart: now,
      expiresAt,
    });
    return { allowed: true, count: 1 };
  } catch (error) {
    console.error('[dbCheckRateLimit] DB error, using in-memory fallback:', error);
    const nowMs = Date.now();
    const entry = fallbackMap.get(key);
    if (entry && nowMs < entry.resetAt) {
      if (entry.count >= maxCount) {
        return { allowed: false, count: entry.count };
      }
      entry.count++;
      return { allowed: true, count: entry.count };
    }
    fallbackMap.set(key, { count: 1, resetAt: nowMs + windowMs });
    return { allowed: true, count: 1 };
  }
}

export async function dbCheckEnRouteNotif(key: string, cooldownMs: number): Promise<boolean> {
  try {
    const now = new Date();
    const existing = await db
      .select()
      .from(rateLimits)
      .where(and(eq(rateLimits.key, key), gte(rateLimits.expiresAt, now)))
      .limit(1);

    if (existing.length > 0) {
      return true;
    }

    await db.insert(rateLimits).values({
      key,
      count: 1,
      windowStart: now,
      expiresAt: new Date(now.getTime() + cooldownMs),
    });
    return false;
  } catch (error) {
    console.error('[dbCheckEnRouteNotif] DB error, using fallback:', error);
    const fallbackTs = fallbackEnRouteMap.get(key);
    if (fallbackTs && Date.now() - fallbackTs < cooldownMs) {
      return true;
    }
    fallbackEnRouteMap.set(key, Date.now());
    return false;
  }
}

export function chatRateLimiterMiddleware(req: any, res: any, next: any) {
  const userId = req.userId;
  if (!userId) return next();

  const key = `chat:${userId}`;
  dbCheckRateLimit(key, 30, 60000, fallbackChatMap)
    .then(({ allowed }) => {
      if (!allowed) {
        return res.status(429).json({ error: 'Too many messages. Please slow down.' });
      }
      next();
    })
    .catch(() => next());
}

export function portalIpRateLimiterMiddleware(req: any, res: any, next: any) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const key = `portal:${ip}`;
  dbCheckRateLimit(key, 10, 60000, fallbackPortalMap)
    .then(({ allowed }) => {
      if (!allowed) {
        return res.status(429).json({ error: 'Too many messages. Please try again later.' });
      }
      next();
    })
    .catch(() => next());
}

const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000;
const idempotencyMemCache = new Map<string, { record: any; expiresAt: number }>();

export async function getIdempotencyRecord(key: string): Promise<any | null> {
  const memHit = idempotencyMemCache.get(key);
  if (memHit && Date.now() < memHit.expiresAt) return memHit.record;
  try {
    const { idempotencyKeys } = await import('../../shared/schema');
    const rows = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, key)).limit(1);
    if (rows.length > 0 && new Date(rows[0].expiresAt) > new Date()) {
      const record = JSON.parse(rows[0].response);
      idempotencyMemCache.set(key, { record, expiresAt: new Date(rows[0].expiresAt).getTime() });
      return record;
    }
  } catch (e) {
    console.warn('[Idempotency] DB lookup failed, continuing:', (e as Error).message);
  }
  return null;
}

export async function setIdempotencyRecord(key: string, record: any): Promise<void> {
  const expiresAt = Date.now() + IDEMPOTENCY_TTL;
  idempotencyMemCache.set(key, { record, expiresAt });
  try {
    const { idempotencyKeys } = await import('../../shared/schema');
    await db.insert(idempotencyKeys).values({
      key,
      response: JSON.stringify(record),
      expiresAt: new Date(expiresAt),
    }).onConflictDoNothing();
  } catch (e) {
    console.warn('[Idempotency] DB write failed, memory-only:', (e as Error).message);
  }
}

setInterval(async () => {
  try {
    await db.delete(rateLimits).where(lte(rateLimits.expiresAt, new Date()));
  } catch (error) {}
  const now = Date.now();
  for (const [key, entry] of Array.from(fallbackChatMap)) {
    if (now >= entry.resetAt) fallbackChatMap.delete(key);
  }
  for (const [key, entry] of Array.from(fallbackPortalMap)) {
    if (now >= entry.resetAt) fallbackPortalMap.delete(key);
  }
  for (const [key, entry] of Array.from(idempotencyMemCache)) {
    if (now >= entry.expiresAt) idempotencyMemCache.delete(key);
  }
  try {
    import('../../shared/schema').then(({ idempotencyKeys }) => {
      db.delete(idempotencyKeys).where(sql`${idempotencyKeys.expiresAt} < now()`).catch(() => {});
    });
  } catch {}
}, 5 * 60 * 1000);

export type ActivityType = 'job_created' | 'job_status_changed' | 'job_completed' | 'job_scheduled' | 'job_started' |
  'quote_created' | 'quote_sent' | 'quote_accepted' | 'quote_rejected' |
  'invoice_created' | 'invoice_sent' | 'invoice_paid' | 'payment_received' |
  'website_change_submitted' | 'ai_receptionist_provisioned' | 'impersonation_started';

export async function logActivity(
  userId: string,
  type: ActivityType,
  title: string,
  description: string | null,
  entityType: 'job' | 'quote' | 'invoice' | null,
  entityId: string | null,
  metadata?: Record<string, any>,
  req?: any
): Promise<void> {
  try {
    const enrichedMetadata = { ...(metadata || {}) };
    if (req && req.headers?.['x-mobile-app'] === 'true') {
      enrichedMetadata.source = 'mobile';
    } else if (req) {
      enrichedMetadata.source = 'web';
    }
    await storage.createActivityLog({
      userId,
      type,
      title,
      description,
      entityType,
      entityId,
      metadata: enrichedMetadata,
    });
    try {
      const { broadcastActivityFeedUpdate } = await import('../websocket');
      broadcastActivityFeedUpdate(userId);
    } catch (wsErr) {
      console.warn('[WS] Failed to broadcast activity feed update:', wsErr);
    }
    if ((entityType === 'quote' || entityType === 'invoice') && entityId) {
      try {
        const { broadcastDocumentStatusChange } = await import('../websocket');
        broadcastDocumentStatusChange(userId, {
          documentType: entityType as 'quote' | 'invoice',
          documentId: entityId,
          status: enrichedMetadata?.status || type,
        });
      } catch (wsErr) {
        console.warn('[WS] Failed to broadcast document status change:', wsErr);
      }
    }
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) {
    return "Just now";
  } else if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return past.toLocaleDateString();
  }
}

export function normalizeAuPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const cleaned = String(input).trim().replace(/[^\d+]/g, '');
  if (!cleaned) return null;
  if (cleaned.startsWith('+61')) {
    const rest = cleaned.slice(3);
    if (rest.length >= 8 && rest.length <= 10) return '+61' + rest;
    return null;
  }
  if (cleaned.startsWith('61') && cleaned.length >= 10 && cleaned.length <= 12) {
    return '+' + cleaned;
  }
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return '+61' + cleaned.slice(1);
  }
  if (/^[2-9]\d{8}$/.test(cleaned)) {
    return '+61' + cleaned;
  }
  return null;
}

export async function resolveAssigneeUserId(assignedTo: string | null | undefined, businessOwnerId: string): Promise<string | null> {
  if (!assignedTo) return null;

  try {
    const directUser = await storage.getUser(assignedTo);
    if (directUser) {
      return directUser.id;
    }

    const teamMembers = await storage.getTeamMembers(businessOwnerId);
    const member = teamMembers.find((m: any) => m.id === assignedTo || m.memberId === assignedTo);
    if (member?.memberId) {
      return member.memberId;
    }

    console.log(`[resolveAssigneeUserId] Could not resolve assignedTo: ${assignedTo}`);
    return null;
  } catch (error) {
    console.error('[resolveAssigneeUserId] Error resolving assignee:', error);
    return null;
  }
}

export async function autoUpdateWorkerState(userId: string, state: string, jobId?: string | null, note?: string | null) {
  try {
    const teamMembership = await storage.getTeamMembershipByMemberId(userId);
    const businessOwnerId = teamMembership?.businessOwnerId || userId;
    await storage.upsertWorkerState(userId, businessOwnerId, state, jobId, note);
    const { broadcastWorkerStateChange } = await import('../websocket');
    broadcastWorkerStateChange(businessOwnerId, { userId, state, jobId, note });
  } catch (err) {
    console.warn('[WorkerState] Auto-update failed:', err);
  }
}

export async function gatherAIContext(userId: string, storageInstance: any, userContext?: UserContext): Promise<BusinessContext> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const isOwner = !userContext || userContext.isOwner;
  const effectiveUserId = userContext?.effectiveUserId || userId;

  let userRole: 'owner' | 'manager' | 'supervisor' | 'worker' = 'owner';
  if (userContext && !userContext.isOwner) {
    const hasManageTeam = userContext.permissions.includes('manage_team');
    const hasViewAll = userContext.permissions.includes('view_all');
    const hasWriteJobs = userContext.permissions.includes('write_jobs');

    if (hasManageTeam && hasViewAll) {
      userRole = 'manager';
    } else if (hasViewAll && hasWriteJobs) {
      userRole = 'supervisor';
    } else {
      userRole = 'worker';
    }
  }

  const [
    businessSettings,
    user,
    allJobs,
    allInvoices,
    allQuotes,
    allClients,
    emailIntegration,
    gmailStatus,
    currentUser,
    teamMember
  ] = await Promise.all([
    storageInstance.getBusinessSettings(effectiveUserId),
    storageInstance.getUser(effectiveUserId),
    storageInstance.getJobs(effectiveUserId),
    storageInstance.getInvoices(effectiveUserId),
    storageInstance.getQuotes(effectiveUserId),
    storageInstance.getClients(effectiveUserId),
    getEmailIntegration(effectiveUserId),
    getGmailConnectionStatus(effectiveUserId),
    storageInstance.getUser(userId),
    userContext?.teamMemberId ? storageInstance.getTeamMember(userContext.teamMemberId) : null
  ]);

  const isWorker = userRole === 'worker';
  let filteredJobs = allJobs;

  if (isWorker && userContext) {
    filteredJobs = allJobs.filter((j: any) => {
      return j.assignedTo === userId ||
             j.assignedTo === userContext.teamMemberId ||
             (j.assignedTeamMembers && Array.isArray(j.assignedTeamMembers) &&
              (j.assignedTeamMembers.includes(userId) || j.assignedTeamMembers.includes(userContext.teamMemberId)));
    });
  }

  const openJobs = filteredJobs.filter((j: any) => j.status !== 'done' && j.status !== 'cancelled').length;

  const completedJobsThisMonth = filteredJobs.filter((j: any) => {
    if (j.status !== 'done') return false;
    const completedDate = j.completedAt ? new Date(j.completedAt) : null;
    return completedDate && completedDate >= startOfMonth;
  }).length;

  const todaysJobs = filteredJobs
    .filter((j: any) => {
      if (!j.scheduledAt) return false;
      const jobDate = new Date(j.scheduledAt);
      return jobDate >= today && jobDate < tomorrow;
    })
    .map((j: any) => {
      const client = allClients.find((c: any) => c.id === j.clientId);
      return {
        id: j.id,
        title: j.title || 'Untitled Job',
        clientName: client?.name || 'Unknown Client',
        clientId: j.clientId,
        address: j.address || j.location,
        time: j.scheduledAt ? new Date(j.scheduledAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : undefined,
        status: j.status
      };
    });

  const upcomingJobs = filteredJobs
    .filter((j: any) => {
      if (!j.scheduledAt) return false;
      const jobDate = new Date(j.scheduledAt);
      return jobDate >= tomorrow && jobDate < weekFromNow && j.status !== 'done' && j.status !== 'cancelled';
    })
    .map((j: any) => {
      const client = allClients.find((c: any) => c.id === j.clientId);
      return {
        id: j.id,
        title: j.title || 'Untitled Job',
        clientName: client?.name || 'Unknown Client',
        clientId: j.clientId,
        scheduledDate: new Date(j.scheduledAt).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }),
        status: j.status
      };
    })
    .sort((a: any, b: any) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

  const assignedJobs = isWorker ? filteredJobs.map((j: any) => {
    const client = allClients.find((c: any) => c.id === j.clientId);
    return {
      id: j.id,
      title: j.title || 'Untitled Job',
      clientName: client?.name || 'Unknown Client',
      address: j.address || j.location,
      status: j.status,
      scheduledDate: j.scheduledAt ? new Date(j.scheduledAt).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) : undefined
    };
  }) : undefined;

  let overdueInvoicesList: any[] = [];
  let unpaidInvoicesTotal = 0;
  let paidThisMonth = 0;
  let recentInvoices: any[] = [];
  let pendingQuotes: any[] = [];
  let recentQuotes: any[] = [];

  if (!isWorker) {
    overdueInvoicesList = allInvoices
      .filter((i: any) => {
        if (i.status === 'paid') return false;
        if (!i.dueDate) return false;
        return new Date(i.dueDate) < now;
      })
      .map((i: any) => {
        const client = allClients.find((c: any) => c.id === i.clientId);
        const daysPastDue = Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: i.id,
          clientName: client?.name || 'Unknown Client',
          clientId: i.clientId,
          clientEmail: (userContext && hasPermission(userContext, PERMISSIONS.READ_CLIENTS_SENSITIVE)) || isOwner ? client?.email : undefined,
          clientPhone: (userContext && hasPermission(userContext, PERMISSIONS.READ_CLIENTS_SENSITIVE)) || isOwner ? client?.phone : undefined,
          amount: parseFloat(i.total || '0'),
          daysPastDue,
          invoiceNumber: i.number
        };
      })
      .sort((a: any, b: any) => b.daysPastDue - a.daysPastDue);

    unpaidInvoicesTotal = overdueInvoicesList.reduce((sum: number, i: any) => sum + i.amount, 0);

    paidThisMonth = allInvoices
      .filter((i: any) => {
        if (i.status !== 'paid') return false;
        const paidDate = i.paidAt ? new Date(i.paidAt) : null;
        return paidDate && paidDate >= startOfMonth;
      })
      .reduce((sum: number, i: any) => sum + parseFloat(i.total || '0'), 0);

    recentInvoices = allInvoices
      .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 10)
      .map((i: any) => {
        const client = allClients.find((c: any) => c.id === i.clientId);
        return {
          id: i.id,
          clientName: client?.name || 'Unknown Client',
          amount: parseFloat(i.total || '0'),
          status: i.status,
          invoiceNumber: i.number
        };
      });

    pendingQuotes = allQuotes
      .filter((q: any) => q.status === 'sent' || q.status === 'pending')
      .map((q: any) => {
        const client = allClients.find((c: any) => c.id === q.clientId);
        const createdDaysAgo = Math.floor((now.getTime() - new Date(q.createdAt || q.issuedDate || now).getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: q.id,
          clientName: client?.name || 'Unknown Client',
          clientId: q.clientId,
          clientEmail: (userContext && hasPermission(userContext, PERMISSIONS.READ_CLIENTS_SENSITIVE)) || isOwner ? client?.email : undefined,
          total: parseFloat(q.total || '0'),
          createdDaysAgo,
          quoteNumber: q.number
        };
      });

    recentQuotes = allQuotes
      .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 10)
      .map((q: any) => {
        const client = allClients.find((c: any) => c.id === q.clientId);
        return {
          id: q.id,
          clientName: client?.name || 'Unknown Client',
          amount: q.totalAmount || 0,
          status: q.status,
          quoteNumber: q.quoteNumber
        };
      });
  }

  const recentClients = allClients
    .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 15)
    .map((c: any) => ({
      id: c.id,
      name: c.name || 'Unknown',
      email: isWorker ? undefined : c.email,
      phone: isWorker ? undefined : c.phone
    }));

  const recentActivity = filteredJobs
    .slice(0, 3)
    .map((j: any) => j.title)
    .filter(Boolean) as string[];

  const twilioStatus = await checkTwilioAvailability();
  const hasSmsSetup = twilioStatus.configured || twilioStatus.verified;

  const userName = currentUser?.firstName || currentUser?.name?.split(' ')[0] || 'mate';
  const teamMemberName = teamMember?.name;

  return {
    businessName: businessSettings?.businessName || 'Your Business',
    trade: businessSettings?.tradeType || 'Trade Business',
    tradieFirstName: isOwner ? (user?.firstName || user?.name?.split(' ')[0] || 'mate') : userName,
    tradieEmail: user?.email || '',
    openJobs,
    completedJobsThisMonth,
    overdueInvoices: overdueInvoicesList.length,
    unpaidInvoicesTotal,
    paidThisMonth,
    recentActivity,
    todaysJobs,
    upcomingJobs,
    overdueInvoicesList,
    recentClients,
    pendingQuotes,
    recentInvoices,
    recentQuotes,
    hasEmailSetup: !!(
      (emailIntegration && emailIntegration.status === 'connected') ||
      gmailStatus.connected ||
      process.env.SENDGRID_API_KEY
    ),
    emailAddress: emailIntegration?.emailAddress || (gmailStatus.connected ? gmailStatus.email : undefined),
    emailProvider: emailIntegration?.status === 'connected' ? 'smtp' : (gmailStatus.connected ? 'gmail' : (process.env.SENDGRID_API_KEY ? 'platform' : undefined)),
    hasSmsSetup,
    userRole,
    userName,
    permissions: userContext?.permissions || Object.values(PERMISSIONS),
    isTeamMember: !isOwner,
    teamMemberName,
    assignedJobs
  };
}

export async function verifyInvoiceCalculation(
  invoiceId: string,
  userId: string,
  invoice: any
): Promise<{ valid: boolean; error?: string; details?: any }> {
  const lineItems = await storage.getInvoiceLineItems(invoiceId);
  const calculatedSubtotal = lineItems.reduce((sum, item) => {
    return sum + parseFloat(String(item.total || '0'));
  }, 0);

  const storedSubtotal = parseFloat(String(invoice.subtotal || '0'));

  if (Math.abs(calculatedSubtotal - storedSubtotal) > 0.01) {
    return {
      valid: false,
      error: 'Invoice totals don\'t match line items. Please refresh and try again.',
      details: { calculated: calculatedSubtotal.toFixed(2), stored: storedSubtotal }
    };
  }

  const hashInput = lineItems.map((i: any) => `${i.description}:${i.quantity}:${i.unitPrice}:${i.total}`).join('|');
  const calculationHash = createHash('sha256').update(hashInput).digest('hex').substring(0, 16);

  await storage.updateInvoice(invoiceId, userId, { calculationHash });

  return { valid: true };
}

export function validateAustralianCoords(lat: number, lng: number, accuracy?: number): { valid: boolean; reason?: string } {
  if (isNaN(lat) || isNaN(lng)) return { valid: false, reason: 'Invalid coordinate values' };
  if (lat === 0 && lng === 0) return { valid: false, reason: 'Null Island coordinates (0,0) rejected' };
  if (lat < -55 || lat > -8 || lng < 105 || lng > 165) return { valid: false, reason: 'Coordinates outside Australian region' };
  if (accuracy !== undefined && accuracy > 500) return { valid: false, reason: `GPS accuracy too low: ${accuracy}m` };
  return { valid: true };
}

export async function wasRecentlyNotifiedTeamJoinBlocked(
  ownerId: string,
  relatedType: 'invite_code' | 'team_member',
  relatedId: string,
): Promise<boolean> {
  try {
    const recent = await storage.getNotifications(ownerId);
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    return recent.some((n: any) =>
      n.type === 'team_join_blocked' &&
      n.relatedType === relatedType &&
      n.relatedId === relatedId &&
      n.createdAt && new Date(n.createdAt).getTime() > oneHourAgo
    );
  } catch {
    return false;
  }
}

export const emailPaymentLinkCooldown = new Map<string, number>();
export const EMAIL_PAYMENT_LINK_COOLDOWN_MS = 60 * 1000;
