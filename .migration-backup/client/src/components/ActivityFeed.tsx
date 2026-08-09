import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Mail,
  MessageSquare,
  CreditCard,
  FileText,
  CheckCircle2,
  Clock,
  Bell,
  Send,
  AlertCircle,
  ChevronRight,
  Briefcase,
  Plus,
  UserPlus,
  UserMinus,
  Target,
  MapPin,
  MapPinOff,
  Users,
  Trophy,
  UserCheck
} from "lucide-react";
import { formatHistoryDate } from "@shared/dateUtils";
import { queryClient, apiRequest, getSessionToken } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

interface ActivityFeedProps {
  limit?: number;
  onViewAll?: () => void;
  compact?: boolean;
  showTeamActivity?: boolean;
}

interface ActivityItem {
  id: string;
  activityType: string;
  actorName?: string | null;
  entityTitle?: string | null;
  description?: string | null;
  createdAt: string;
  isRead?: boolean;
  isImportant?: boolean;
  entityType?: 'job' | 'quote' | 'invoice' | 'client' | 'team_member' | null;
  entityId?: string | null;
  metadata?: Record<string, any>;
}

const activityIcons: Record<string, typeof Mail> = {
  email_sent: Mail,
  sms_sent: MessageSquare,
  payment_received: CreditCard,
  quote_sent: FileText,
  invoice_sent: Send,
  reminder_sent: Bell,
  quote_accepted: CheckCircle2,
  quote_created: Plus,
  invoice_created: Plus,
  invoice_paid: CreditCard,
  job_scheduled: Clock,
  job_started: Clock,
  job_completed: CheckCircle2,
  job_created: Briefcase,
  job_assigned: UserCheck,
  job_status_change: Briefcase,
  team_join: UserPlus,
  team_invite: Users,
  team_leave: UserMinus,
  client_added: Plus,
  check_in: MapPin,
  check_out: MapPinOff,
  milestone: Trophy,
  message_sent: MessageSquare,
  website_change_submitted: FileText,
  ai_receptionist_provisioned: Bell,
  impersonation_started: UserCheck,
};

const activityColors: Record<string, { bg: string; icon: string }> = {
  email_sent: { bg: 'hsl(210 80% 52% / 0.1)', icon: 'hsl(210 80% 52%)' },
  sms_sent: { bg: 'hsl(280 65% 60% / 0.1)', icon: 'hsl(280 65% 60%)' },
  payment_received: { bg: 'hsl(145 65% 45% / 0.1)', icon: 'hsl(145 65% 45%)' },
  quote_sent: { bg: 'hsl(35 90% 55% / 0.1)', icon: 'hsl(35 90% 55%)' },
  invoice_sent: { bg: 'hsl(5 85% 55% / 0.1)', icon: 'hsl(5 85% 55%)' },
  reminder_sent: { bg: 'hsl(25 90% 55% / 0.1)', icon: 'hsl(25 90% 55%)' },
  quote_accepted: { bg: 'hsl(145 65% 45% / 0.1)', icon: 'hsl(145 65% 45%)' },
  quote_created: { bg: 'hsl(35 90% 55% / 0.1)', icon: 'hsl(35 90% 55%)' },
  invoice_created: { bg: 'hsl(5 85% 55% / 0.1)', icon: 'hsl(5 85% 55%)' },
  invoice_paid: { bg: 'hsl(145 65% 45% / 0.1)', icon: 'hsl(145 65% 45%)' },
  job_scheduled: { bg: 'hsl(210 80% 52% / 0.1)', icon: 'hsl(210 80% 52%)' },
  job_started: { bg: 'hsl(35 90% 55% / 0.1)', icon: 'hsl(35 90% 55%)' },
  job_completed: { bg: 'hsl(145 65% 45% / 0.1)', icon: 'hsl(145 65% 45%)' },
  job_created: { bg: 'hsl(210 80% 52% / 0.1)', icon: 'hsl(210 80% 52%)' },
  job_assigned: { bg: 'hsl(280 65% 60% / 0.1)', icon: 'hsl(280 65% 60%)' },
  job_status_change: { bg: 'hsl(35 90% 55% / 0.1)', icon: 'hsl(35 90% 55%)' },
  team_join: { bg: 'hsl(145 65% 45% / 0.1)', icon: 'hsl(145 65% 45%)' },
  team_invite: { bg: 'hsl(210 80% 52% / 0.1)', icon: 'hsl(210 80% 52%)' },
  team_leave: { bg: 'hsl(5 85% 55% / 0.1)', icon: 'hsl(5 85% 55%)' },
  client_added: { bg: 'hsl(210 80% 52% / 0.1)', icon: 'hsl(210 80% 52%)' },
  check_in: { bg: 'hsl(145 65% 45% / 0.1)', icon: 'hsl(145 65% 45%)' },
  check_out: { bg: 'hsl(35 90% 55% / 0.1)', icon: 'hsl(35 90% 55%)' },
  milestone: { bg: 'hsl(45 100% 50% / 0.15)', icon: 'hsl(45 100% 45%)' },
  message_sent: { bg: 'hsl(280 65% 60% / 0.1)', icon: 'hsl(280 65% 60%)' },
  website_change_submitted: { bg: 'hsl(210 80% 52% / 0.1)', icon: 'hsl(210 80% 52%)' },
  ai_receptionist_provisioned: { bg: 'hsl(280 65% 60% / 0.1)', icon: 'hsl(280 65% 60%)' },
  impersonation_started: { bg: 'hsl(25 90% 55% / 0.1)', icon: 'hsl(25 90% 55%)' },
};

function formatDwell(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function getNavigationPath(activity: ActivityItem): string | null {
  if (!activity.entityType || !activity.entityId) return null;
  switch (activity.entityType) {
    case 'job':
      return `/jobs/${activity.entityId}`;
    case 'quote':
      return `/quotes/${activity.entityId}`;
    case 'invoice':
      return `/invoices/${activity.entityId}`;
    case 'client':
      return `/clients/${activity.entityId}`;
    default:
      return null;
  }
}

export default function ActivityFeed({ 
  limit = 5, 
  onViewAll,
  compact = false,
  showTeamActivity = true
}: ActivityFeedProps) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  
  const { data: activities = [], isLoading } = useQuery<ActivityItem[]>({
    queryKey: ['/api/activity-feed', { limit }],
    queryFn: async () => {
      const token = getSessionToken();
      const response = await fetch(`/api/activity-feed?limit=${limit}`, { credentials: 'include', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
      if (!response.ok) throw new Error('Failed to fetch activities');
      return response.json();
    },
    staleTime: 30 * 1000,
    enabled: !!user,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/activity-feed/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activity-feed'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/activity-feed/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activity-feed'] });
    },
  });

  const { data: systemStatus } = useQuery({
    queryKey: ['/api/integrations/health'],
    staleTime: 60 * 1000,
  });

  const health = systemStatus as any;
  const emailWorking = health?.services?.email?.status === 'ready';
  const smsWorking = health?.services?.sms?.status === 'ready';

  const unreadCount = activities.filter(a => !a.isRead).length;
  
  const handleActivityClick = (activity: ActivityItem) => {
    const path = getNavigationPath(activity);
    if (path) {
      if (!activity.isRead) {
        markReadMutation.mutate(activity.id);
      }
      setLocation(path);
    }
  };

  const activityList = (
    <div>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" 
                   style={{ borderColor: 'hsl(var(--trade))', borderTopColor: 'transparent' }} />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8">
              <div 
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}
              >
                <Users className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="ios-card-title mb-1">No team activity yet</p>
              <p className="ios-caption max-w-[250px] mx-auto">
                When team members join, complete jobs, or hit milestones, you'll see it here.
              </p>
            </div>
          ) : (
            <div>
              <div className="space-y-1">
                {activities.slice(0, limit).map((activity) => {
                  const Icon = activityIcons[activity.activityType] || Bell;
                  const colors = activityColors[activity.activityType] || { bg: 'hsl(var(--muted) / 0.5)', icon: 'hsl(var(--muted-foreground))' };
                  const navigationPath = getNavigationPath(activity);
                  const isClickable = !!navigationPath;
                  
                  return (
                    <div 
                      key={activity.id}
                      className={`relative flex items-start gap-3 p-3 rounded-xl hover-elevate ${isClickable ? 'cursor-pointer' : ''} ${!activity.isRead ? 'bg-accent/30' : ''}`}
                      onClick={() => handleActivityClick(activity)}
                      data-testid={`activity-item-${activity.id}`}
                    >
                      <div className="relative z-10">
                        <div 
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: colors.bg }}
                        >
                          <Icon className="h-4 w-4" style={{ color: colors.icon }} />
                        </div>
                        {activity.isImportant && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-card flex items-center justify-center">
                            <Trophy className="h-2 w-2 text-white" />
                          </div>
                        )}
                        {!activity.isRead && !activity.isImportant && (
                          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-card" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className={`ios-body truncate ${!activity.isRead ? 'font-semibold' : 'font-medium'}`}>
                          {activity.description || activity.entityTitle || activity.activityType.replace(/_/g, ' ')}
                          {activity.activityType === 'check_out' && typeof activity.metadata?.dwellSeconds === 'number' && activity.metadata.dwellSeconds > 0 && (
                            <span className="text-muted-foreground font-normal"> · {formatDwell(activity.metadata.dwellSeconds)} on site</span>
                          )}
                        </p>
                        {activity.actorName && (
                          <p className="ios-caption truncate mt-0.5">
                            by {activity.actorName}
                          </p>
                        )}
                        <p className="ios-label mt-1.5" style={{ fontSize: '10px' }}>
                          {formatHistoryDate(activity.createdAt)}
                        </p>
                      </div>
                      
                      {isClickable && (
                        <div className="flex items-center self-center">
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
    </div>
  );

  if (compact) {
    return activityList;
  }

  return (
    <section data-testid="activity-feed">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="ios-label">Team Activity</h2>
          {unreadCount > 0 && (
            <Badge variant="default" className="h-5 min-w-5 text-xs px-2 rounded-full">
              {unreadCount} new
            </Badge>
          )}
          <div className="flex items-center gap-1.5">
            {emailWorking && (
              <Badge variant="outline" className="text-[10px] py-0.5 px-2 border-green-300/50 text-green-600 rounded-full bg-green-50/50 dark:bg-green-950/30">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                Email Live
              </Badge>
            )}
            {smsWorking && (
              <Badge variant="outline" className="text-[10px] py-0.5 px-2 border-green-300/50 text-green-600 rounded-full bg-green-50/50 dark:bg-green-950/30">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                SMS Live
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="text-xs h-8 px-3 rounded-xl"
            >
              Mark all read
            </Button>
          )}
          {onViewAll && activities.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onViewAll}
              className="text-xs h-8 px-3 rounded-xl press-scale"
              data-testid="button-view-all-activity"
            >
              See All
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
        </div>
      </div>

      <div className="feed-card">
        <div className="card-padding">
          {activityList}
        </div>
      </div>
    </section>
  );
}
