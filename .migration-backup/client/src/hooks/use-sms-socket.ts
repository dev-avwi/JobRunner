import { useState, useEffect, useCallback, useRef } from 'react';
import { safeInvalidateQueries } from '@/lib/queryClient';

interface SmsNotification {
  conversationId: string;
  senderPhone: string;
  senderName: string | null;
  messagePreview: string;
  jobId?: string | null;
  unreadCount: number;
  timestamp: number;
}

interface UseSmsSocketOptions {
  businessId: string;
  enabled?: boolean;
  onSmsNotification?: (notification: SmsNotification) => void;
}

export function useSmsSocket({
  businessId,
  enabled = true,
  onSmsNotification,
}: UseSmsSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastNotification, setLastNotification] = useState<SmsNotification | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;
  const isConnectingRef = useRef(false);
  const onSmsNotificationRef = useRef(onSmsNotification);

  onSmsNotificationRef.current = onSmsNotification;

  const connect = useCallback(() => {
    if (!enabled || !businessId) return;
    if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) return;

    isConnectingRef.current = true;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/location?businessId=${businessId}&isTradie=false`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[SmsSocket] Connected');
        setIsConnected(true);
        reconnectAttempts.current = 0;
        isConnectingRef.current = false;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'sms_notification') {
            const notification: SmsNotification = {
              conversationId: message.conversationId,
              senderPhone: message.senderPhone,
              senderName: message.senderName,
              messagePreview: message.messagePreview,
              jobId: message.jobId,
              unreadCount: message.unreadCount,
              timestamp: message.timestamp,
            };
            setLastNotification(notification);
            onSmsNotificationRef.current?.(notification);
            
            safeInvalidateQueries({ queryKey: ['/api/chat/unread-counts'] });
            safeInvalidateQueries({ queryKey: ['/api/sms/conversations'] });
          }
        } catch (error) {
          console.error('[SmsSocket] Failed to parse message:', error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        isConnectingRef.current = false;

        if (reconnectAttempts.current < maxReconnectAttempts && enabled) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        isConnectingRef.current = false;
      };
    } catch (error) {
      console.error('[SmsSocket] Failed to connect:', error);
      isConnectingRef.current = false;
    }
  }, [enabled, businessId]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    isConnectingRef.current = false;
    reconnectAttempts.current = maxReconnectAttempts;
  }, []);

  useEffect(() => {
    if (enabled && businessId) {
      reconnectAttempts.current = 0;
      connect();
    }
    return () => {
      disconnect();
    };
  }, [enabled, businessId, connect, disconnect]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled && businessId) {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          console.log('[SmsSocket] Page visible, reconnecting...');
          reconnectAttempts.current = 0;
          connect();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, businessId, connect]);

  return {
    isConnected,
    lastNotification,
    disconnect,
    reconnect: connect,
  };
}
