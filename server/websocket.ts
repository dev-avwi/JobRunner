import { WebSocket, WebSocketServer } from 'ws';
import { Server, IncomingMessage } from 'http';
import { parse } from 'url';
import cookie from 'cookie';
import { randomBytes } from 'crypto';
import { storage } from './storage';

interface LocationUpdate {
  type: 'location_update';
  userId: string;
  businessId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  batteryLevel?: number;
  isCharging?: boolean;
  activityStatus?: 'online' | 'driving' | 'working' | 'idle' | 'offline';
}

interface ClientConnection {
  id: string;
  ws: WebSocket;
  userId: string;
  businessId: string;
  isTradie: boolean;
}

const connections = new Map<string, ClientConnection>();

interface PortalLocationData {
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  updatedAt: number;
}

const workerTravelLocations = new Map<string, PortalLocationData>();

export function updateWorkerTravelLocation(jobId: string, lat: number, lng: number, speed?: number, heading?: number) {
  workerTravelLocations.set(jobId, {
    latitude: lat,
    longitude: lng,
    speed,
    heading,
    updatedAt: Date.now(),
  });
}

export function clearWorkerTravelLocation(jobId: string) {
  workerTravelLocations.delete(jobId);
}

export function getWorkerTravelLocation(jobId: string): PortalLocationData | undefined {
  return workerTravelLocations.get(jobId);
}

let wss: WebSocketServer | null = null;
let sessionStore: any = null;

// Short-lived, single-use WebSocket auth tickets. The web app authenticates
// with a Bearer token (no cookie), which must never travel in a query string.
// Instead the client POSTs /api/ws-ticket (authenticated) to get a 60s nonce.
const wsTickets = new Map<string, { userId: string; expiresAt: number }>();

export function createWsTicket(userId: string): string {
  // Prune expired tickets opportunistically
  const now = Date.now();
  wsTickets.forEach((t, k) => { if (t.expiresAt < now) wsTickets.delete(k); });
  const ticket = randomBytes(32).toString('hex');
  wsTickets.set(ticket, { userId, expiresAt: now + 60_000 });
  return ticket;
}

function redeemWsTicket(ticket: string): { userId: string } | null {
  const entry = wsTickets.get(ticket);
  if (!entry) return null;
  wsTickets.delete(ticket); // single use
  if (entry.expiresAt < Date.now()) return null;
  return { userId: entry.userId };
}

export function setupWebSocket(server: Server, store?: any) {
  wss = new WebSocketServer({ server, path: '/ws/location' });
  sessionStore = store;

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    try {
      const authenticatedUser = await authenticateConnection(req);
      
      if (!authenticatedUser) {
        ws.close(4001, 'Authentication required');
        return;
      }

      const params = parse(req.url || '', true).query;
      const businessId = params.businessId as string;
      const isTradie = params.isTradie === 'true';

      if (!businessId) {
        ws.close(4002, 'Missing businessId');
        return;
      }

      // Validate user has access to this business
      const hasAccess = await validateBusinessAccess(authenticatedUser.userId, businessId);
      if (!hasAccess) {
        ws.close(4003, 'Access denied to business');
        return;
      }

      const connectionId = `${authenticatedUser.userId}-${Date.now()}`;
      connections.set(connectionId, { 
        id: connectionId,
        ws, 
        userId: authenticatedUser.userId, 
        businessId, 
        isTradie 
      });

      console.log(`[WebSocket] Client connected: ${authenticatedUser.userId} (${isTradie ? 'tradie' : 'owner/manager'})`);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          handleMessage(connectionId, message);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      });

      ws.on('close', () => {
        cleanupEditorPresence(connectionId, authenticatedUser.userId);
        connections.delete(connectionId);
        console.log(`[WebSocket] Client disconnected: ${authenticatedUser.userId}`);
      });

      ws.on('error', (error) => {
        console.error(`[WebSocket] Error for ${authenticatedUser.userId}:`, error);
        cleanupEditorPresence(connectionId, authenticatedUser.userId);
        connections.delete(connectionId);
      });

      ws.send(JSON.stringify({ type: 'connected', userId: authenticatedUser.userId }));
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      ws.close(4000, 'Connection error');
    }
  });

  console.log('[WebSocket] Location tracking server initialized');
}

async function authenticateConnection(req: IncomingMessage): Promise<{ userId: string } | null> {
  // Parse cookies from request
  const cookies = cookie.parse(req.headers.cookie || '');
  const sessionId = cookies['jobrunner.sid'];

  // Single-use ticket fallback: the web app authenticates with a Bearer token
  // (no cookie), so it first POSTs /api/ws-ticket and passes the short-lived
  // nonce here. Never accept raw session tokens in the query string.
  const queryTicket = parse(req.url || '', true).query.ticket as string | undefined;
  if (queryTicket) {
    const redeemed = redeemWsTicket(queryTicket);
    if (redeemed) return redeemed;
  }

  if (!sessionId) {
    console.log('[WebSocket] No session cookie or valid ticket found');
    return null;
  }

  // Extract the actual session ID (remove 's:' prefix and signature if present)
  let rawSessionId = sessionId;
  if (rawSessionId.startsWith('s:')) {
    rawSessionId = rawSessionId.slice(2).split('.')[0];
  }

  // Try to get session from store
  if (sessionStore) {
    const lookup = (sid: string) => new Promise<{ userId: string } | null>((resolve) => {
      sessionStore.get(sid, (err: any, session: any) => {
        if (err || !session || !session.userId) {
          resolve(null);
          return;
        }
        resolve({ userId: session.userId });
      });
    });

    const result = await lookup(rawSessionId);
    if (!result) {
      console.log('[WebSocket] Session not found or expired');
    }
    return result;
  }

  console.log('[WebSocket] No session store available');
  return null;
}

async function validateBusinessAccess(userId: string, businessId: string): Promise<boolean> {
  try {
    // Check if user owns this business or is a team member
    const user = await storage.getUser(userId);
    if (!user) return false;

    // Owner always has access to their own business
    if (userId === businessId) return true;

    // Check if user is a team member of this business
    const teamMember = await storage.getTeamMemberByUserIdAndBusiness(userId, businessId);
    if (teamMember && teamMember.inviteStatus === 'accepted') {
      return true;
    }

    return false;
  } catch (error) {
    console.error('[WebSocket] Error validating business access:', error);
    return false;
  }
}

function handleMessage(connectionId: string, message: any) {
  const connection = connections.get(connectionId);
  if (!connection) return;

  switch (message.type) {
    case 'location_update':
      handleLocationUpdate(connection, message);
      break;
    case 'job_editing_start':
      handleJobEditingStart(connection, message);
      break;
    case 'job_editing_stop':
      handleJobEditingStop(connection, message);
      break;
    case 'ping':
      connection.ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;
    default:
      console.log('[WebSocket] Unknown message type:', message.type);
  }
}

function handleLocationUpdate(sender: ClientConnection, update: LocationUpdate) {
  // Broadcast to all other users in the same business
  connections.forEach((conn) => {
    if (conn.businessId === sender.businessId && 
        conn.userId !== sender.userId && 
        conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify({
        type: 'team_location_update',
        userId: sender.userId,
        latitude: update.latitude,
        longitude: update.longitude,
        speed: update.speed,
        heading: update.heading,
        batteryLevel: update.batteryLevel,
        isCharging: update.isCharging,
        activityStatus: update.activityStatus,
        timestamp: Date.now(),
      }));
    }
  });
}

export function broadcastToBusinessUsers(businessId: string, message: any) {
  connections.forEach((conn) => {
    if (conn.businessId === businessId && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify(message));
    }
  });
}

/**
 * Broadcast SMS notification to business owner and relevant team members
 * Called when an inbound SMS arrives at the webhook
 */
export function broadcastSmsNotification(
  businessId: string,
  notification: {
    conversationId: string;
    senderPhone: string;
    senderName: string | null;
    messagePreview: string;
    jobId?: string | null;
    unreadCount: number;
    isNewConversation?: boolean;
    isUnknownCaller?: boolean;
    isJobRequest?: boolean;
    suggestedJobTitle?: string;
    isQuoteAcceptance?: boolean;
    quoteId?: string;
  }
) {
  const message = {
    type: 'sms_notification',
    ...notification,
    timestamp: Date.now(),
  };
  
  let notifiedCount = 0;
  connections.forEach((conn) => {
    if (conn.businessId === businessId && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify(message));
      notifiedCount++;
    }
  });
  
  console.log(`[WebSocket] SMS notification broadcast to ${notifiedCount} user(s) for business ${businessId}`);
}

/**
 * Broadcast to specific user IDs within a business
 */
export function broadcastToUsers(userIds: string[], message: any) {
  connections.forEach((conn) => {
    if (userIds.includes(conn.userId) && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify(message));
    }
  });
}

export function getActiveConnections(businessId: string): string[] {
  const active: string[] = [];
  connections.forEach((conn) => {
    if (conn.businessId === businessId && conn.ws.readyState === WebSocket.OPEN) {
      active.push(conn.userId);
    }
  });
  return active;
}

/**
 * Broadcast a payment received notification to a specific user
 * Used for celebratory "Cha-ching!" toasts when Stripe payments come in
 */
export function broadcastPaymentReceived(
  userId: string,
  paymentDetails: {
    amount: number;
    invoiceNumber?: string;
    clientName?: string;
    paymentMethod?: string;
  }
) {
  const message = {
    type: 'payment_received',
    ...paymentDetails,
    timestamp: Date.now(),
  };
  
  let notifiedCount = 0;
  connections.forEach((conn) => {
    if (conn.userId === userId && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify(message));
      notifiedCount++;
    }
  });
  
  console.log(`[WebSocket] 💰 Payment notification sent to user ${userId}: $${(paymentDetails.amount / 100).toFixed(2)}`);
  return notifiedCount > 0;
}

/**
 * Broadcast job status change to all connected business users
 */
export function broadcastJobStatusChange(
  businessId: string,
  jobDetails: {
    jobId: string;
    status: string;
    title?: string;
    updatedBy?: string;
  }
) {
  broadcastToBusinessUsers(businessId, {
    type: 'job_status_changed',
    ...jobDetails,
    timestamp: Date.now(),
  });
  console.log(`[WebSocket] 🔄 Job status changed: ${jobDetails.jobId} -> ${jobDetails.status}`);
}

/**
 * Broadcast timer event (start/stop/break) to all connected business users
 */
export function broadcastTimerEvent(
  businessId: string,
  timerDetails: {
    jobId: string;
    userId: string;
    action: 'started' | 'stopped' | 'paused' | 'resumed';
    timeEntryId?: string;
    elapsedSeconds?: number;
  }
) {
  broadcastToBusinessUsers(businessId, {
    type: 'timer_event',
    ...timerDetails,
    timestamp: Date.now(),
  });
  console.log(`[WebSocket] ⏱️ Timer ${timerDetails.action}: Job ${timerDetails.jobId} by user ${timerDetails.userId}`);
}

/**
 * Broadcast quote/invoice status change
 */
export function broadcastDocumentStatusChange(
  businessId: string,
  documentDetails: {
    documentType: 'quote' | 'invoice';
    documentId: string;
    status: string;
    clientName?: string;
    amount?: number;
  }
) {
  broadcastToBusinessUsers(businessId, {
    type: 'document_status_changed',
    ...documentDetails,
    timestamp: Date.now(),
  });
  console.log(`[WebSocket] 📄 ${documentDetails.documentType} status changed: ${documentDetails.documentId} -> ${documentDetails.status}`);
}

/**
 * Broadcast notification to user(s)
 */
export function broadcastNotification(
  targetUserIds: string[],
  notification: {
    title: string;
    message: string;
    severity: 'info' | 'success' | 'warning' | 'error';
    link?: string;
    entityType?: string;
    entityId?: string;
  }
) {
  broadcastToUsers(targetUserIds, {
    type: 'notification',
    ...notification,
    timestamp: Date.now(),
  });
}

/**
 * Broadcast business settings change to all connected business users
 * Used for syncing template style preferences across web and mobile
 */
export function broadcastBusinessSettingsChange(
  businessId: string,
  settingsDetails: {
    updatedFields: string[];
    documentTemplate?: string;
  }
) {
  broadcastToBusinessUsers(businessId, {
    type: 'business_settings_changed',
    ...settingsDetails,
    timestamp: Date.now(),
  });
  console.log(`[WebSocket] ⚙️ Business settings changed: ${settingsDetails.updatedFields.join(', ')}`);
}

/**
 * Broadcast document template change to all connected business users
 * Used for syncing document templates (quotes, invoices, jobs) across web and mobile
 */
export function broadcastTemplateChange(
  businessId: string,
  action: 'created' | 'updated' | 'deleted',
  templateDetails: {
    templateId: string;
    templateType?: string;
    templateName?: string;
  }
) {
  broadcastToBusinessUsers(businessId, {
    type: 'template_changed',
    action,
    ...templateDetails,
    timestamp: Date.now(),
  });
  console.log(`[WebSocket] 📄 Template ${action}: ${templateDetails.templateName || templateDetails.templateId}`);
}

/**
 * Broadcast custom form change to all connected business users
 * Used for syncing safety forms and custom forms across web and mobile
 */
export function broadcastFormChange(
  businessId: string,
  action: 'created' | 'updated' | 'deleted',
  formDetails: {
    formId: string;
    formType?: string;
    formName?: string;
  }
) {
  broadcastToBusinessUsers(businessId, {
    type: 'form_changed',
    action,
    ...formDetails,
    timestamp: Date.now(),
  });
  console.log(`[WebSocket] 📋 Form ${action}: ${formDetails.formName || formDetails.formId}`);
}

/**
 * Broadcast a new chat message to all connected business users (for team chat and job chat)
 */
export function broadcastChatMessage(
  businessId: string,
  chatDetails: {
    chatType: 'team' | 'job' | 'direct';
    messageId: string;
    jobId?: string;
    senderId: string;
    senderName?: string;
    preview: string;
    recipientId?: string;
  }
) {
  broadcastToBusinessUsers(businessId, {
    type: 'chat_message',
    ...chatDetails,
    timestamp: Date.now(),
  });
}

/**
 * Broadcast a direct message to specific users (sender + recipient)
 */
export function broadcastDirectChatMessage(
  userIds: string[],
  chatDetails: {
    chatType: 'direct';
    messageId: string;
    senderId: string;
    senderName?: string;
    recipientId: string;
    preview: string;
  }
) {
  broadcastToUsers(userIds, {
    type: 'chat_message',
    ...chatDetails,
    timestamp: Date.now(),
  });
}

export function broadcastTeamPresenceChange(
  businessId: string,
  presenceDetails: {
    userId: string;
    status: string;
    statusMessage?: string;
    currentJobId?: string;
  }
) {
  broadcastToBusinessUsers(businessId, {
    type: 'team_presence_changed',
    ...presenceDetails,
    timestamp: Date.now(),
  });
}

export function broadcastActivityFeedUpdate(businessId: string) {
  broadcastToBusinessUsers(businessId, {
    type: 'activity_feed_updated',
    timestamp: Date.now(),
  });
}

export function broadcastTeamMemberChange(
  businessId: string,
  action: 'invited' | 'updated' | 'removed' | 'accepted',
  memberId?: string
) {
  broadcastToBusinessUsers(businessId, {
    type: 'team_member_changed',
    action,
    memberId,
    timestamp: Date.now(),
  });
}

export function broadcastWorkerStateChange(
  businessId: string,
  details: {
    userId: string;
    state: string;
    jobId?: string | null;
    note?: string | null;
  }
) {
  broadcastToBusinessUsers(businessId, {
    type: 'worker_state_changed',
    ...details,
    timestamp: Date.now(),
  });
}

interface EditorEntry { userId: string; userName: string; joinedAt: number; connectionIds: Set<string> }
const jobEditors = new Map<string, Map<string, EditorEntry>>();

export function getJobEditors(jobId: string): { userId: string; userName: string; joinedAt: number }[] {
  const editors = jobEditors.get(jobId);
  if (!editors) return [];
  return Array.from(editors.values()).map(e => ({
    userId: e.userId,
    userName: e.userName,
    joinedAt: e.joinedAt,
  }));
}

async function resolveUserName(userId: string): Promise<string> {
  try {
    const { storage } = await import('./storage');
    const user = await storage.getUser(userId);
    if (user) {
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      return name || user.email || 'Unknown';
    }
  } catch { /* fallback */ }
  return 'Unknown';
}

async function handleJobEditingStart(connection: ClientConnection, message: { jobId?: string }) {
  const { jobId } = message;
  if (!jobId) return;

  if (!jobEditors.has(jobId)) {
    jobEditors.set(jobId, new Map());
  }
  const editors = jobEditors.get(jobId)!;
  const existing = editors.get(connection.userId);
  if (existing) {
    existing.connectionIds.add(connection.id);
  } else {
    const userName = await resolveUserName(connection.userId);
    editors.set(connection.userId, {
      userId: connection.userId,
      userName,
      joinedAt: Date.now(),
      connectionIds: new Set([connection.id]),
    });
  }

  const presencePayload = JSON.stringify({
    type: 'job_editing_presence',
    jobId,
    editors: getJobEditors(jobId),
    timestamp: Date.now(),
  });

  connections.forEach((conn) => {
    if (conn.businessId === connection.businessId &&
        conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(presencePayload);
    }
  });
}

function handleJobEditingStop(connection: ClientConnection, message: { jobId?: string }) {
  const { jobId } = message;
  if (!jobId) return;

  const editors = jobEditors.get(jobId);
  if (editors) {
    const entry = editors.get(connection.userId);
    if (entry) {
      entry.connectionIds.delete(connection.id);
      if (entry.connectionIds.size === 0) {
        editors.delete(connection.userId);
      }
    }
    if (editors.size === 0) {
      jobEditors.delete(jobId);
    }
  }

  connections.forEach((conn) => {
    if (conn.businessId === connection.businessId &&
        conn.userId !== connection.userId &&
        conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify({
        type: 'job_editing_presence',
        jobId,
        editors: getJobEditors(jobId),
        timestamp: Date.now(),
      }));
    }
  });
}

function cleanupEditorPresence(connectionId: string, userId: string) {
  const disconnectedConn = Array.from(connections.values()).find(c => c.userId === userId);
  const businessId = disconnectedConn?.businessId;

  const affectedJobs: string[] = [];
  jobEditors.forEach((editors, jobId) => {
    const entry = editors.get(userId);
    if (entry) {
      entry.connectionIds.delete(connectionId);
      if (entry.connectionIds.size === 0) {
        editors.delete(userId);
        affectedJobs.push(jobId);
      }
      if (editors.size === 0) {
        jobEditors.delete(jobId);
      }
    }
  });

  if (businessId && affectedJobs.length > 0) {
    affectedJobs.forEach(jobId => {
      const presencePayload = JSON.stringify({
        type: 'job_editing_presence',
        jobId,
        editors: getJobEditors(jobId),
        timestamp: Date.now(),
      });
      connections.forEach((conn) => {
        if (conn.businessId === businessId &&
            conn.userId !== userId &&
            conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.send(presencePayload);
        }
      });
    });
  }
}

export function broadcastJobFieldUpdate(
  businessId: string,
  jobDetails: {
    jobId: string;
    updatedFields: string[];
    updatedBy: string;
    updatedByName: string;
    version: number;
    serverData: Record<string, unknown>;
  }
) {
  connections.forEach((conn) => {
    if (conn.businessId === businessId &&
        conn.userId !== jobDetails.updatedBy &&
        conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify({
        type: 'job_field_updated',
        ...jobDetails,
        timestamp: Date.now(),
      }));
    }
  });
}

export function broadcastGeofenceAlert(
  businessId: string,
  alertDetails: {
    alertId: string;
    alertType: string;
    userId: string;
    jobId: string;
    userName?: string;
    jobTitle?: string;
  }
) {
  broadcastToBusinessUsers(businessId, {
    type: 'geofence_alert',
    ...alertDetails,
    timestamp: Date.now(),
  });
}
