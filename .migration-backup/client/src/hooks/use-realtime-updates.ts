import { useState, useEffect, useCallback, useRef } from 'react';
import { safeInvalidateQueries, isRemoteChange, queryClient, getSessionToken } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface JobStatusEvent {
  type: 'job_status_changed';
  jobId: string;
  status: string;
  title?: string;
  updatedBy?: string;
  timestamp: number;
}

interface TimerEvent {
  type: 'timer_event';
  jobId: string;
  userId: string;
  action: 'started' | 'stopped' | 'paused' | 'resumed';
  timeEntryId?: string;
  elapsedSeconds?: number;
  timestamp: number;
}

interface DocumentStatusEvent {
  type: 'document_status_changed';
  documentType: 'quote' | 'invoice';
  documentId: string;
  status: string;
  clientName?: string;
  amount?: number;
  timestamp: number;
}

interface PaymentReceivedEvent {
  type: 'payment_received';
  amount: number;
  invoiceNumber?: string;
  clientName?: string;
  paymentMethod?: string;
  timestamp: number;
}

interface SmsNotificationEvent {
  type: 'sms_notification';
  conversationId: string;
  senderPhone: string;
  senderName: string | null;
  messagePreview: string;
  jobId?: string | null;
  unreadCount: number;
  timestamp: number;
}

interface NotificationEvent {
  type: 'notification';
  title: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  link?: string;
  entityType?: string;
  entityId?: string;
  timestamp: number;
}

interface BusinessSettingsChangedEvent {
  type: 'business_settings_changed';
  updatedFields: string[];
  documentTemplate?: string;
  timestamp: number;
}

interface TemplateChangedEvent {
  type: 'template_changed';
  action: 'created' | 'updated' | 'deleted';
  templateId: string;
  templateType?: string;
  templateName?: string;
  timestamp: number;
}

interface FormChangedEvent {
  type: 'form_changed';
  action: 'created' | 'updated' | 'deleted';
  formId: string;
  formType?: string;
  formName?: string;
  timestamp: number;
}

interface ChatMessageEvent {
  type: 'chat_message';
  chatType: 'team' | 'job' | 'direct';
  messageId: string;
  jobId?: string;
  senderId: string;
  senderName?: string;
  recipientId?: string;
  preview: string;
  timestamp: number;
}

interface TeamPresenceChangedEvent {
  type: 'team_presence_changed';
  userId: string;
  status: string;
  statusMessage?: string;
  currentJobId?: string;
  timestamp: number;
}

interface ActivityFeedUpdatedEvent {
  type: 'activity_feed_updated';
  timestamp: number;
}

interface TeamMemberChangedEvent {
  type: 'team_member_changed';
  action: 'invited' | 'updated' | 'removed' | 'accepted';
  memberId?: string;
  timestamp: number;
}

interface WorkerStateChangedEvent {
  type: 'worker_state_changed';
  userId: string;
  state: string;
  jobId?: string | null;
  note?: string | null;
  timestamp: number;
}

interface GeofenceAlertEvent {
  type: 'geofence_alert';
  alertId: string;
  alertType: string;
  userId: string;
  jobId: string;
  userName?: string;
  jobTitle?: string;
  timestamp: number;
}

interface JobEditingPresenceEvent {
  type: 'job_editing_presence';
  jobId: string;
  editors: { userId: string; userName: string; joinedAt: number }[];
  timestamp: number;
}

interface JobFieldUpdatedEvent {
  type: 'job_field_updated';
  jobId: string;
  updatedFields: string[];
  updatedBy: string;
  updatedByName: string;
  version: number;
  serverData: Record<string, unknown>;
  timestamp: number;
}

type RealtimeEvent = 
  | JobStatusEvent 
  | TimerEvent 
  | DocumentStatusEvent 
  | PaymentReceivedEvent 
  | SmsNotificationEvent
  | NotificationEvent
  | BusinessSettingsChangedEvent
  | TemplateChangedEvent
  | FormChangedEvent
  | ChatMessageEvent
  | TeamPresenceChangedEvent
  | ActivityFeedUpdatedEvent
  | TeamMemberChangedEvent
  | WorkerStateChangedEvent
  | GeofenceAlertEvent
  | JobEditingPresenceEvent
  | JobFieldUpdatedEvent;

interface UseRealtimeUpdatesOptions {
  businessId: string;
  enabled?: boolean;
  onJobStatusChange?: (event: JobStatusEvent) => void;
  onTimerEvent?: (event: TimerEvent) => void;
  onDocumentStatusChange?: (event: DocumentStatusEvent) => void;
  onPaymentReceived?: (event: PaymentReceivedEvent) => void;
  onSmsNotification?: (event: SmsNotificationEvent) => void;
  onNotification?: (event: NotificationEvent) => void;
  onChatMessage?: (event: ChatMessageEvent) => void;
  onJobEditingPresence?: (event: JobEditingPresenceEvent) => void;
  onJobFieldUpdated?: (event: JobFieldUpdatedEvent) => void;
}

export function useRealtimeUpdates({
  businessId,
  enabled = true,
  onJobStatusChange,
  onTimerEvent,
  onDocumentStatusChange,
  onPaymentReceived,
  onSmsNotification,
  onNotification,
  onChatMessage,
  onJobEditingPresence,
  onJobFieldUpdated,
}: UseRealtimeUpdatesOptions) {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;
  const isConnectingRef = useRef(false);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pongTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const awaitingPongRef = useRef(false);
  const hadPriorConnectionRef = useRef(false);

  const callbacksRef = useRef({
    onJobStatusChange,
    onTimerEvent,
    onDocumentStatusChange,
    onPaymentReceived,
    onSmsNotification,
    onNotification,
    onChatMessage,
    onJobEditingPresence,
    onJobFieldUpdated,
  });

  useEffect(() => {
    callbacksRef.current = {
      onJobStatusChange,
      onTimerEvent,
      onDocumentStatusChange,
      onPaymentReceived,
      onSmsNotification,
      onNotification,
      onChatMessage,
      onJobEditingPresence,
      onJobFieldUpdated,
    };
  }, [onJobStatusChange, onTimerEvent, onDocumentStatusChange, onPaymentReceived, onSmsNotification, onNotification, onChatMessage, onJobEditingPresence, onJobFieldUpdated]);

  const handleMessage = useCallback((event: RealtimeEvent) => {
    const callbacks = callbacksRef.current;

    switch (event.type) {
      case 'job_status_changed':
        callbacks.onJobStatusChange?.(event);
        safeInvalidateQueries({ queryKey: ['/api/jobs'] });
        safeInvalidateQueries({ queryKey: ['/api/jobs', event.jobId] });
        safeInvalidateQueries({ queryKey: ['/api/dashboard'] });
        safeInvalidateQueries({ queryKey: ['/api/dispatch/board'] });
        safeInvalidateQueries({ queryKey: ['/api/ops/health'] });
        safeInvalidateQueries({ queryKey: ['/api/ops/job-aging'] });
        safeInvalidateQueries({ queryKey: ['/api/dispatch/resources'] });
        safeInvalidateQueries({ queryKey: ['/api/map/jobs'] });
        safeInvalidateQueries({ queryKey: ['/api/activity-feed'] });
        safeInvalidateQueries({ queryKey: ['/api/notifications'] });
        safeInvalidateQueries({ queryKey: ['/api/notifications/missed'] });
        safeInvalidateQueries({ queryKey: ['/api/notifications/unified'] });
        break;

      case 'timer_event':
        callbacks.onTimerEvent?.(event);
        // Auto-invalidate time entry queries
        safeInvalidateQueries({ queryKey: ['/api/time-entries'] });
        safeInvalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
        safeInvalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
        if (event.jobId) {
          safeInvalidateQueries({ queryKey: ['/api/jobs', event.jobId] });
          safeInvalidateQueries({ queryKey: ['/api/time-entries', event.jobId] });
        }
        break;

      case 'document_status_changed':
        callbacks.onDocumentStatusChange?.(event);
        if (event.documentType === 'quote') {
          safeInvalidateQueries({ queryKey: ['/api/quotes'] });
          safeInvalidateQueries({ queryKey: ['/api/quotes', event.documentId] });
        } else {
          safeInvalidateQueries({ queryKey: ['/api/invoices'] });
          safeInvalidateQueries({ queryKey: ['/api/invoices', event.documentId] });
        }
        safeInvalidateQueries({ queryKey: ['/api/dashboard'] });
        break;

      case 'payment_received':
        callbacks.onPaymentReceived?.(event);
        toast({
          title: "Payment Received!",
          description: `$${(event.amount / 100).toFixed(2)} from ${event.clientName || 'a client'}`,
        });
        safeInvalidateQueries({ queryKey: ['/api/invoices'] });
        safeInvalidateQueries({ queryKey: ['/api/payments'] });
        safeInvalidateQueries({ queryKey: ['/api/notifications'] });
        safeInvalidateQueries({ queryKey: ['/api/notifications/missed'] });
        safeInvalidateQueries({ queryKey: ['/api/notifications/unified'] });
        safeInvalidateQueries({ queryKey: ['/api/payment-requests'] });
        safeInvalidateQueries({ queryKey: ['/api/dashboard'] });
        break;

      case 'sms_notification':
        callbacks.onSmsNotification?.(event);
        safeInvalidateQueries({ queryKey: ['/api/chat/unread-counts'] });
        safeInvalidateQueries({ queryKey: ['/api/sms/conversations'] });
        break;

      case 'notification':
        callbacks.onNotification?.(event);
        toast({
          title: event.title,
          description: event.message,
          variant: event.severity === 'error' ? 'destructive' : 'default',
        });
        safeInvalidateQueries({ queryKey: ['/api/notifications'] });
        safeInvalidateQueries({ queryKey: ['/api/notifications/missed'] });
        break;

      case 'business_settings_changed':
        // Only invalidate if this is a change from another device
        // The isRemoteChange function checks if we recently made a local change
        // If we did, we already have the data and don't need to refetch
        if (isRemoteChange('/api/business-settings', event.timestamp)) {
          console.log('[RealtimeUpdates] Remote business settings change detected, syncing...');
          safeInvalidateQueries({ queryKey: ['/api/business-settings'] });
        }
        break;

      case 'template_changed':
        // Only invalidate if this is a change from another device
        if (isRemoteChange('/api/templates', event.timestamp)) {
          console.log('[RealtimeUpdates] Remote template change detected, syncing...');
          safeInvalidateQueries({ queryKey: ['/api/templates'] });
          safeInvalidateQueries({ queryKey: ['/api/business-settings'] });
        }
        break;

      case 'form_changed':
        // Only invalidate if this is a change from another device
        if (isRemoteChange('/api/forms', event.timestamp)) {
          console.log('[RealtimeUpdates] Remote form change detected, syncing...');
          safeInvalidateQueries({ queryKey: ['/api/custom-forms'] });
          safeInvalidateQueries({ queryKey: ['/api/safety-forms'] });
        }
        break;

      case 'chat_message':
        callbacks.onChatMessage?.(event);
        if (isRemoteChange('/api/chat', event.timestamp)) {
          safeInvalidateQueries({ queryKey: ['/api/chat/unread-counts'] });
          safeInvalidateQueries({ queryKey: ['/api/notifications/unified'] });
          if (event.chatType === 'team') {
            safeInvalidateQueries({ queryKey: ['/api/team-chat'] });
          } else if (event.chatType === 'job' && event.jobId) {
            safeInvalidateQueries({ queryKey: ['/api/jobs', event.jobId, 'chat'] });
          } else if (event.chatType === 'direct') {
            safeInvalidateQueries({ queryKey: ['/api/direct-messages'] });
            safeInvalidateQueries({ queryKey: ['/api/direct-messages/conversations'] });
            if (event.senderId) {
              safeInvalidateQueries({ queryKey: ['/api/direct-messages', event.senderId] });
            }
            if (event.recipientId) {
              safeInvalidateQueries({ queryKey: ['/api/direct-messages', event.recipientId] });
            }
          }
        }
        break;

      case 'team_presence_changed':
        safeInvalidateQueries({ queryKey: ['/api/team/presence'] });
        safeInvalidateQueries({ queryKey: ['/api/map/team-locations'] });
        safeInvalidateQueries({ queryKey: ['/api/team/utilization'] });
        break;

      case 'activity_feed_updated':
        safeInvalidateQueries({ queryKey: ['/api/activity-feed'] });
        safeInvalidateQueries({ queryKey: ['/api/notifications/unified'] });
        safeInvalidateQueries({ queryKey: ['/api/notifications/missed'] });
        safeInvalidateQueries({ queryKey: ['/api/notifications'] });
        break;

      case 'team_member_changed':
        safeInvalidateQueries({ queryKey: ['/api/team/members'] });
        safeInvalidateQueries({ queryKey: ['/api/team/presence'] });
        safeInvalidateQueries({ queryKey: ['/api/dispatch/board'] });
        break;

      case 'worker_state_changed':
        safeInvalidateQueries({ queryKey: ['/api/team/worker-states'] });
        safeInvalidateQueries({ queryKey: ['/api/worker/state'] });
        safeInvalidateQueries({ queryKey: ['/api/team/presence'] });
        safeInvalidateQueries({ queryKey: ['/api/dispatch/board'] });
        break;

      case 'geofence_alert':
        safeInvalidateQueries({ queryKey: ['/api/geofence-alerts'] });
        safeInvalidateQueries({ queryKey: ['/api/map/geofence-alerts'] });
        break;

      case 'job_editing_presence':
        callbacks.onJobEditingPresence?.(event);
        break;

      case 'job_field_updated':
        callbacks.onJobFieldUpdated?.(event);
        safeInvalidateQueries({ queryKey: ['/api/jobs', event.jobId] });
        break;
    }
  }, [toast]);

  const connect = useCallback(async () => {
    if (!enabled || !businessId) return;
    // Don't attempt connection if auth is still loading or user is not authenticated
    if (authLoading || !isAuthenticated) return;
    if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) return;

    isConnectingRef.current = true;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;

    // The web app authenticates with a Bearer token which browsers can't send
    // on a WebSocket upgrade. Get a short-lived single-use ticket instead of
    // ever putting the session token in the URL.
    let ticket = '';
    if (getSessionToken()) {
      try {
        const res = await fetch('/api/ws-ticket', {
          method: 'POST',
          headers: { Authorization: `Bearer ${getSessionToken()}` },
          credentials: 'include',
        });
        if (res.ok) {
          ticket = (await res.json()).ticket || '';
        }
      } catch {
        // fall through: cookie-based auth may still work
      }
    }

    const wsUrl = `${protocol}//${host}/ws/location?businessId=${businessId}&isTradie=false${ticket ? `&ticket=${encodeURIComponent(ticket)}` : ''}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[RealtimeUpdates] Socket opened, waiting for auth...');
        isConnectingRef.current = false;
        reconnectAttempts.current = 0;

        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
        awaitingPongRef.current = false;

        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
            awaitingPongRef.current = true;
            pongTimeoutRef.current = setTimeout(() => {
              if (awaitingPongRef.current) {
                console.log('[RealtimeUpdates] Pong timeout, closing connection');
                ws.close();
              }
            }, 10000);
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'pong') {
            awaitingPongRef.current = false;
            if (pongTimeoutRef.current) {
              clearTimeout(pongTimeoutRef.current);
              pongTimeoutRef.current = null;
            }
            return;
          }

          // Handle successful authentication - only now are we truly connected
          if (message.type === 'connected') {
            console.log('[RealtimeUpdates] Authenticated successfully');
            setIsConnected(true);
            reconnectAttempts.current = 0;
            if (hadPriorConnectionRef.current) {
              console.log('[RealtimeUpdates] Reconnected — invalidating all queries to catch up on missed events');
              queryClient.invalidateQueries();
            }
            hadPriorConnectionRef.current = true;
            return;
          }
          
          // Handle all known event types
          if (message.type && [
            'job_status_changed',
            'timer_event',
            'document_status_changed',
            'payment_received',
            'sms_notification',
            'notification',
            'business_settings_changed',
            'template_changed',
            'form_changed',
            'chat_message',
            'team_presence_changed',
            'activity_feed_updated',
            'team_member_changed',
            'worker_state_changed',
            'geofence_alert',
            'job_editing_presence',
            'job_field_updated'
          ].includes(message.type)) {
            handleMessage(message as RealtimeEvent);
          }
        } catch (error) {
          console.error('[RealtimeUpdates] Failed to parse message:', error);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        wsRef.current = null;
        isConnectingRef.current = false;

        // Don't reconnect if authentication failed (4001) or access denied (4003)
        // These are permanent failures that won't resolve with retries
        if (event.code === 4001 || event.code === 4003) {
          console.log(`[RealtimeUpdates] Authentication failed (${event.code}), not reconnecting`);
          return;
        }

        if (enabled) {
          const delay = reconnectAttempts.current < maxReconnectAttempts
            ? Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
            : 60000;
          reconnectAttempts.current++;
          console.log(`[RealtimeUpdates] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        isConnectingRef.current = false;
      };
    } catch (error) {
      console.error('[RealtimeUpdates] Failed to connect:', error);
      isConnectingRef.current = false;
    }
  }, [enabled, businessId, authLoading, isAuthenticated, handleMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current);
      pongTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    isConnectingRef.current = false;
    awaitingPongRef.current = false;
    reconnectAttempts.current = maxReconnectAttempts;
  }, []);

  useEffect(() => {
    if (enabled && businessId && !authLoading && isAuthenticated) {
      reconnectAttempts.current = 0;
      connect();
    }
    return () => {
      disconnect();
    };
  }, [enabled, businessId, authLoading, isAuthenticated, connect, disconnect]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled && businessId && !authLoading && isAuthenticated) {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          console.log('[RealtimeUpdates] Page visible, reconnecting...');
          reconnectAttempts.current = 0;
          connect();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, businessId, authLoading, isAuthenticated, connect]);

  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (enabled && !isConnected) {
      const startFallback = setTimeout(() => {
        if (!fallbackIntervalRef.current) {
          console.log('[RealtimeUpdates] WS unavailable, starting fallback polling for critical data');
          fallbackIntervalRef.current = setInterval(() => {
            const criticalKeys = [
              ['/api/jobs'], ['/api/team/presence'], ['/api/notifications'],
              ['/api/chat/unread-counts'], ['/api/time-entries/active/current'],
            ];
            criticalKeys.forEach(queryKey => safeInvalidateQueries({ queryKey }));
          }, 60000);
        }
      }, 30000);
      return () => {
        clearTimeout(startFallback);
        if (fallbackIntervalRef.current) {
          clearInterval(fallbackIntervalRef.current);
          fallbackIntervalRef.current = null;
        }
      };
    }
    if (isConnected && fallbackIntervalRef.current) {
      console.log('[RealtimeUpdates] WS restored, stopping fallback polling');
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
  }, [enabled, isConnected]);

  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return {
    isConnected,
    disconnect,
    reconnect: connect,
    sendMessage,
  };
}
