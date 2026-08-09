import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell, Check, Calendar, DollarSign, CheckCircle, FileText, Users, Briefcase, BellOff, CheckCheck, ChevronRight, Trash2, Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

interface UnifiedNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedId?: string;
  relatedType?: string;
  priority?: 'urgent' | 'important' | 'info';
  actionUrl?: string;
  actionLabel?: string;
  read: boolean;
  dismissed: boolean;
  createdAt: string;
  notificationType: 'system' | 'sms' | 'chat';
  unreadCount?: number;
}

interface UnifiedNotificationsResponse {
  notifications: UnifiedNotification[];
  unreadCount: number;
}

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery<UnifiedNotificationsResponse>({
    queryKey: ['/api/notifications/unified'],
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;
  const activeNotifications = notifications.filter(n => !n.dismissed);

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest(`/api/notifications/${id}/read`, 'PATCH'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unified'] });
    },
  });

  const markSmsAsReadMutation = useMutation({
    mutationFn: (conversationId: string) => 
      apiRequest(`/api/notifications/sms/${conversationId}/read`, 'PATCH'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unified'] });
    },
  });

  const markChatAsReadMutation = useMutation({
    mutationFn: (messageId: string) => 
      apiRequest(`/api/notifications/chat/${messageId}/read`, 'PATCH'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unified'] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest(`/api/notifications/${id}/dismiss`, 'PATCH'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unified'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiRequest('/api/notifications/read-all', 'PATCH'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unified'] });
    },
  });

  const handleNotificationClick = (notification: UnifiedNotification) => {
    if (!notification.read) {
      if (notification.notificationType === 'sms' && notification.relatedId) {
        markSmsAsReadMutation.mutate(notification.relatedId);
      } else if (notification.notificationType === 'chat' && notification.relatedId) {
        markChatAsReadMutation.mutate(notification.relatedId);
      } else if (notification.notificationType === 'system') {
        markAsReadMutation.mutate(notification.id);
      }
    }
    
    setOpen(false);
    
    if (notification.notificationType === 'sms') {
      setLocation(`/chat?smsClientId=${notification.relatedId}`);
      return;
    }
    
    if (notification.notificationType === 'chat') {
      setLocation('/chat');
      return;
    }
    
    if (notification.relatedType && notification.relatedId) {
      switch (notification.relatedType) {
        case 'job':
          setLocation(`/jobs/${notification.relatedId}`);
          break;
        case 'quote':
          setLocation(`/quotes/${notification.relatedId}`);
          break;
        case 'invoice':
          setLocation(`/invoices/${notification.relatedId}`);
          break;
        case 'client':
          setLocation(`/clients/${notification.relatedId}`);
          break;
        case 'subscription':
          setLocation('/subscription');
          break;
        case 'receipt':
          setLocation(`/receipts/${notification.relatedId}`);
          break;
        case 'subcontractor_invoice':
          setLocation('/team?tab=subinvoices');
          break;
        default:
          // Fall back to the notification's own actionUrl (e.g. training
          // certificate expiry alerts deep-link to /whs?tab=training).
          if (notification.actionUrl) {
            setLocation(notification.actionUrl);
          }
          break;
      }
      return;
    }

    if (notification.actionUrl) {
      setLocation(notification.actionUrl);
    }
  };

  const handleDismiss = (e: React.MouseEvent, notification: UnifiedNotification) => {
    e.stopPropagation();
    if (notification.notificationType === 'system') {
      dismissMutation.mutate(notification.id);
    }
  };

  const getNotificationIcon = (notification: UnifiedNotification) => {
    if (notification.notificationType === 'sms') {
      return Phone;
    }
    if (notification.notificationType === 'chat') {
      return MessageCircle;
    }
    
    switch (notification.type) {
      case 'job_reminder':
      case 'job_scheduled':
        return Calendar;
      case 'overdue_invoice':
      case 'invoice_sent':
      case 'invoice_paid':
        return DollarSign;
      case 'payment_received':
      case 'payment_failed':
        return CheckCircle;
      case 'quote_accepted':
      case 'quote_rejected':
      case 'quote_sent':
      case 'quote_created':
        return FileText;
      case 'client_created':
        return Users;
      case 'subscription_created':
      case 'subscription_canceled':
        return Briefcase;
      default:
        return Bell;
    }
  };

  const getNotificationColor = (notification: UnifiedNotification) => {
    if (notification.notificationType === 'sms') {
      return { bg: 'bg-emerald-100 dark:bg-emerald-900/40', icon: 'text-emerald-600 dark:text-emerald-400' };
    }
    if (notification.notificationType === 'chat') {
      return { bg: 'bg-indigo-100 dark:bg-indigo-900/40', icon: 'text-indigo-600 dark:text-indigo-400' };
    }
    
    switch (notification.type) {
      case 'payment_received':
      case 'quote_accepted':
      case 'invoice_paid':
        return { bg: 'bg-green-100 dark:bg-green-900/40', icon: 'text-green-600 dark:text-green-400' };
      case 'overdue_invoice':
      case 'payment_failed':
      case 'quote_rejected':
        return { bg: 'bg-red-100 dark:bg-red-900/40', icon: 'text-red-600 dark:text-red-400' };
      case 'job_reminder':
      case 'job_scheduled':
        return { bg: 'bg-blue-100 dark:bg-blue-900/40', icon: 'text-blue-600 dark:text-blue-400' };
      case 'quote_sent':
      case 'quote_created':
      case 'invoice_sent':
        return { bg: 'bg-purple-100 dark:bg-purple-900/40', icon: 'text-purple-600 dark:text-purple-400' };
      default:
        return { bg: 'bg-muted', icon: 'text-muted-foreground' };
    }
  };

  const getNotificationTypeBadge = (notification: UnifiedNotification) => {
    if (notification.notificationType === 'sms') {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
          SMS
        </Badge>
      );
    }
    if (notification.notificationType === 'chat') {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
          Chat
        </Badge>
      );
    }
    return null;
  };

  const getPriorityBadge = (notification: UnifiedNotification) => {
    if (notification.priority === 'urgent') {
      return (
        <Badge className="text-[10px] px-1.5 py-0 h-4 bg-green-500 text-white border-0">
          Money
        </Badge>
      );
    }
    if (notification.priority === 'important') {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
          Action
        </Badge>
      );
    }
    return null;
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span 
              className="absolute -top-0.5 -right-0.5 h-5 min-w-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium px-1 animate-pulse-soft"
              data-testid="badge-notification-count"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-md p-0 flex flex-col"
        data-testid="sheet-notifications"
      >
        <SheetHeader className="px-4 py-4 border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-lg">Notifications</SheetTitle>
                {unreadCount > 0 && (
                  <p className="text-sm text-muted-foreground" data-testid="text-unread-count">{unreadCount} unread</p>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
                className="gap-1.5"
                data-testid="button-mark-all-read"
              >
                <CheckCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Mark all read</span>
              </Button>
            )}
          </div>
        </SheetHeader>
        
        <ScrollArea className="flex-1" data-testid="scroll-notifications">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4" data-testid="empty-notifications">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <BellOff className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">All caught up!</h3>
              <p className="text-sm text-muted-foreground text-center">
                You have no new notifications. We'll let you know when something happens.
              </p>
            </div>
          ) : (
            <div className="py-2" data-testid="list-notifications">
              {activeNotifications.map((notification, index) => {
                const Icon = getNotificationIcon(notification);
                const colors = getNotificationColor(notification);
                const typeBadge = getNotificationTypeBadge(notification);
                const priorityBadge = getPriorityBadge(notification);
                const urgentBorder = notification.priority === 'urgent' ? 'border-l-4 border-l-green-500' : '';
                const importantBorder = notification.priority === 'important' ? 'border-l-4 border-l-amber-500' : '';
                
                return (
                  <div 
                    key={notification.id}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div
                      className={`px-4 py-4 cursor-pointer transition-all duration-200 hover:bg-muted/50 active:bg-muted border-b border-border/50 ${urgentBorder} ${importantBorder} ${
                        !notification.read ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                      data-testid={`notification-item-${notification.id}`}
                    >
                      <div className="flex gap-4">
                        <div className={`h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 ${colors.bg}`}>
                          <Icon className={`h-5 w-5 ${colors.icon}`} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p 
                                  className={`text-sm leading-tight ${!notification.read ? 'font-semibold' : 'font-medium'}`}
                                  data-testid={`notification-title-${notification.id}`}
                                >
                                  {notification.title}
                                </p>
                                {priorityBadge}
                                {typeBadge}
                                {!notification.read && (
                                  <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" data-testid={`indicator-unread-${notification.id}`} />
                                )}
                              </div>
                              <p 
                                className="text-sm text-muted-foreground mt-1 line-clamp-2"
                                data-testid={`notification-message-${notification.id}`}
                              >
                                {notification.message}
                              </p>
                              <p 
                                className="text-xs text-muted-foreground/70 mt-2"
                                data-testid={`notification-time-${notification.id}`}
                              >
                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {notification.unreadCount && notification.unreadCount > 1 && (
                                <Badge variant="secondary" className="text-xs" data-testid={`badge-unread-${notification.id}`}>
                                  {notification.unreadCount}
                                </Badge>
                              )}
                              {(notification.relatedType || notification.notificationType !== 'system') && (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                          
                          {notification.notificationType === 'system' && (
                            <div className="flex items-center gap-2 mt-3">
                              {!notification.read && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsReadMutation.mutate(notification.id);
                                  }}
                                  data-testid={`button-mark-read-${notification.id}`}
                                >
                                  <Check className="h-3.5 w-3.5 mr-1" />
                                  Mark read
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-muted-foreground hover:text-destructive"
                                onClick={(e) => handleDismiss(e, notification)}
                                data-testid={`button-dismiss-${notification.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                Dismiss
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        
        <div className="px-4 py-3 border-t bg-muted/20 flex-shrink-0">
          <Button
            variant="ghost"
            className="w-full justify-center gap-2"
            onClick={() => {
              setOpen(false);
              setLocation('/settings?tab=notifications');
            }}
            data-testid="button-notification-settings"
          >
            Notification Settings
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
