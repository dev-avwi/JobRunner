import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Bell, 
  DollarSign, 
  FileText, 
  CheckCircle, 
  Calendar, 
  Users, 
  AlertCircle,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

interface MissedNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedId?: string;
  relatedType?: string;
  priority?: 'urgent' | 'important' | 'info';
  actionUrl?: string;
  actionLabel?: string;
  createdAt: string;
}

interface MissedNotificationsResponse {
  notifications: MissedNotification[];
  count: number;
  hasUrgent: boolean;
}

const AUTO_DISMISS_DELAY = 10000;
const COUNTDOWN_INTERVAL = 100;

const SHOWN_IDS_STORAGE_KEY = 'whatYouMissed:shownIds';

function loadShownIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SHOWN_IDS_STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    // ignore storage/parse errors
  }
  return new Set();
}

function persistShownIds(ids: Set<string>) {
  try {
    sessionStorage.setItem(SHOWN_IDS_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore storage errors (e.g. private mode)
  }
}

export default function WhatYouMissedModal() {
  const [open, setOpen] = useState(false);
  const [shownNotificationIds, setShownNotificationIds] = useState<Set<string>>(() => loadShownIds());
  const [countdown, setCountdown] = useState(AUTO_DISMISS_DELAY);
  const [, setLocation] = useLocation();

  const { data } = useQuery<MissedNotificationsResponse>({
    queryKey: ['/api/notifications/missed'],
  });

  // Show modal once per session per notification set. Shown ids are persisted to
  // sessionStorage so navigating between routes (or reloading) doesn't re-trigger it.
  useEffect(() => {
    if (data && data.count > 0) {
      const currentIds = data.notifications.map(n => n.id);
      
      setShownNotificationIds(prevShownIds => {
        const hasNewNotifications = currentIds.some(id => !prevShownIds.has(id));
        
        if (hasNewNotifications) {
          setOpen(true);
          setCountdown(AUTO_DISMISS_DELAY);
          const next = new Set(prevShownIds);
          currentIds.forEach(id => next.add(id));
          persistShownIds(next);
          return next;
        }
        return prevShownIds;
      });
    }
  }, [data]);

  // Handle countdown timer separately when modal is open
  useEffect(() => {
    if (!open) return;

    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= COUNTDOWN_INTERVAL) {
          clearInterval(countdownInterval);
          setOpen(false);
          return 0;
        }
        return prev - COUNTDOWN_INTERVAL;
      });
    }, COUNTDOWN_INTERVAL);

    return () => clearInterval(countdownInterval);
  }, [open]);

  const handleClose = () => {
    setCountdown(0);
    setOpen(false);
  };

  const countdownPercent = (countdown / AUTO_DISMISS_DELAY) * 100;

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest(`/api/notifications/${id}/read`, 'PATCH'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/missed'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unified'] });
    },
  });

  const handleNotificationClick = (notification: MissedNotification) => {
    markAsReadMutation.mutate(notification.id);
    setOpen(false);

    if (notification.actionUrl) {
      setLocation(notification.actionUrl);
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
        default:
          break;
      }
    }
  };

  const getIcon = (notification: MissedNotification) => {
    switch (notification.type) {
      case 'payment_received':
      case 'installment_received':
      case 'payment_plan_completed':
        return DollarSign;
      case 'quote_accepted':
      case 'quote_rejected':
        return FileText;
      case 'job_assigned':
      case 'job_completed':
      case 'recurring_job_created':
        return CheckCircle;
      case 'job_reminder':
      case 'job_scheduled':
        return Calendar;
      case 'team_invite':
      case 'timesheet_submitted':
        return Users;
      case 'overdue_invoice':
      case 'payment_failed':
      case 'installment_due':
        return AlertCircle;
      default:
        return Bell;
    }
  };

  const getNotificationStyles = (notification: MissedNotification) => {
    // Priority-based styling takes precedence
    if (notification.priority === 'urgent') {
      return {
        bg: 'bg-emerald-100 dark:bg-emerald-900/40',
        icon: 'text-emerald-600 dark:text-emerald-400',
        border: '',
      };
    }
    if (notification.priority === 'important') {
      return {
        bg: 'bg-amber-100 dark:bg-amber-900/40',
        icon: 'text-amber-600 dark:text-amber-400',
        border: '',
      };
    }

    // Type-based styling for info/default notifications
    switch (notification.type) {
      case 'payment_received':
      case 'installment_received':
      case 'payment_plan_completed':
        return {
          bg: 'bg-emerald-100 dark:bg-emerald-900/40',
          icon: 'text-emerald-600 dark:text-emerald-400',
          border: '',
        };
      case 'quote_accepted':
        return {
          bg: 'bg-blue-100 dark:bg-blue-900/40',
          icon: 'text-blue-600 dark:text-blue-400',
          border: '',
        };
      case 'quote_rejected':
      case 'quote_declined':
        return {
          bg: 'bg-red-100 dark:bg-red-900/40',
          icon: 'text-red-600 dark:text-red-400',
          border: '',
        };
      case 'job_assigned':
      case 'job_completed':
      case 'recurring_job_created':
        return {
          bg: 'bg-blue-100 dark:bg-blue-900/40',
          icon: 'text-blue-600 dark:text-blue-400',
          border: '',
        };
      case 'job_reminder':
      case 'job_scheduled':
        return {
          bg: 'bg-purple-100 dark:bg-purple-900/40',
          icon: 'text-purple-600 dark:text-purple-400',
          border: '',
        };
      case 'team_invite':
      case 'timesheet_submitted':
        return {
          bg: 'bg-indigo-100 dark:bg-indigo-900/40',
          icon: 'text-indigo-600 dark:text-indigo-400',
          border: '',
        };
      case 'overdue_invoice':
      case 'payment_failed':
      case 'installment_due':
        return {
          bg: 'bg-red-100 dark:bg-red-900/40',
          icon: 'text-red-600 dark:text-red-400',
          border: '',
        };
      default:
        return {
          bg: 'bg-sky-100 dark:bg-sky-900/40',
          icon: 'text-sky-600 dark:text-sky-400',
          border: '',
        };
    }
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return (
          <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0 h-4">
            Money
          </Badge>
        );
      case 'important':
        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
            Action
          </Badge>
        );
      default:
        return null;
    }
  };

  if (!data || data.count === 0) {
    return null;
  }

  const sortedNotifications = [...data.notifications].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${data.hasUrgent ? 'bg-green-100 dark:bg-green-900/40' : 'bg-primary/10'}`}>
              <Bell className={`h-5 w-5 ${data.hasUrgent ? 'text-green-600 dark:text-green-400' : 'text-primary'}`} />
            </div>
            <div>
              <DialogTitle className="text-lg">What You Missed</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {data.count} update{data.count !== 1 ? 's' : ''} since you were away
              </DialogDescription>
            </div>
          </div>
          <div className="h-1 w-full bg-muted mt-3 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-100 ease-linear"
              style={{ width: `${countdownPercent}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 text-center">
            Auto-closing in {Math.ceil(countdown / 1000)}s
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="py-2">
            {sortedNotifications.map((notification) => {
              const Icon = getIcon(notification);
              const styles = getNotificationStyles(notification);
              const priorityBadge = getPriorityBadge(notification.priority);

              return (
                <div
                  key={notification.id}
                  className="px-4 py-3 cursor-pointer transition-all duration-200 hover-elevate active-elevate-2 border-b border-border/50"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${styles.bg}`}>
                      <Icon className={`h-5 w-5 ${styles.icon}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold leading-tight">
                          {notification.title}
                        </p>
                        {priorityBadge}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-muted-foreground/70">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </p>
                        {notification.actionLabel && (
                          <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                            {notification.actionLabel}
                            <ChevronRight className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="p-3 border-t bg-muted/20">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setOpen(false)}
          >
            Got it, thanks!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
