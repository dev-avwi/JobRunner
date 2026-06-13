import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import GettingStartedChecklist from "./GettingStartedChecklist";
import TodayScheduleCard from "./TodayScheduleCard";
import ActivityFeed from "./ActivityFeed";
import FirstQuoteCta, { useIsBrandNewOwner } from "./FirstQuoteCta";
import FloatingActionButton from "./FloatingActionButton";
import DashboardUpgradeCard from "./DashboardUpgradeCard";
import { useDashboardKPIs, useTodaysJobs } from "@/hooks/use-dashboard-data";
import { useUpdateJob } from "@/hooks/use-jobs";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { 
  Briefcase, 
  DollarSign, 
  FileText, 
  Clock,
  User,
  Plus,
  ChevronRight,
  CalendarDays,
  AlertCircle,
  Play,
  CheckCircle,
  Phone,
  MessageSquare,
  Navigation,
  WifiOff,
  Target,
  AlertTriangle,
  Lightbulb,
  Calendar,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  BarChart3,
  CircleDollarSign,
  Hammer,
} from "lucide-react";

interface OwnerManagerDashboardProps {
  userName?: string;
  businessName?: string;
  onCreateJob?: () => void;
  onCreateQuote?: () => void;
  onCreateInvoice?: () => void;
  onViewJobs?: () => void;
  onViewInvoices?: () => void;
  onViewQuotes?: () => void;
  onNavigate?: (path: string) => void;
}

function ConnectionBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="mb-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-2.5 flex items-center gap-3">
      <WifiOff className="w-4 h-4 text-amber-600 flex-shrink-0" />
      <div>
        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">You're offline</p>
        <p className="text-xs text-amber-600 dark:text-amber-400">Data may be out of date. Changes will sync when you're back online.</p>
      </div>
    </div>
  );
}

export default function OwnerManagerDashboard({
  userName = "there",
  businessName,
  onCreateJob,
  onCreateQuote,
  onCreateInvoice,
  onViewJobs,
  onNavigate,
}: OwnerManagerDashboardProps) {
  const { data: kpis, isLoading: kpisLoading } = useDashboardKPIs();
  const { data: todaysJobs = [] } = useTodaysJobs();
  const updateJob = useUpdateJob();
  const { toast } = useToast();
  const { isBrandNew } = useIsBrandNewOwner();

  interface CashflowData {
    overdueTotal: number;
    overdueCount: number;
    outstandingTotal: number;
    dueThisWeek: number;
    dueThisWeekCount: number;
    collectedThisMonth: number;
    collectedLastMonth: number;
    collectedTrend: number;
    revenueByWeek: { week: string; amount: number }[];
  }

  const { data: cashflow } = useQuery<CashflowData>({
    queryKey: ["/api/dashboard/cashflow"],
    staleTime: 5 * 60 * 1000,
  });

  interface ProfitData {
    revenueToday: number;
    revenueThisWeek: number;
    revenueThisMonth: number;
    grossProfit: number;
    grossMargin: number;
  }

  const { data: profitData } = useQuery<ProfitData>({
    queryKey: ["/api/dashboard/profit-snapshot"],
    staleTime: 5 * 60 * 1000,
  });

  interface JobPipelineData {
    scheduled: number;
    inProgress: number;
    completed: number;
    quoted: number;
  }

  const { data: allJobs } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
    staleTime: 5 * 60 * 1000,
  });

  const jobPipeline = useMemo<JobPipelineData>(() => {
    if (!allJobs) return { scheduled: 0, inProgress: 0, completed: 0, quoted: 0 };
    const active = allJobs.filter((j: any) => !j.archivedAt);
    return {
      scheduled: active.filter((j: any) => j.status === 'pending' || j.status === 'scheduled').length,
      inProgress: active.filter((j: any) => j.status === 'in_progress').length,
      completed: active.filter((j: any) => j.status === 'done' || j.status === 'invoiced' || j.status === 'paid').length,
      quoted: active.filter((j: any) => j.status === 'quoted').length,
    };
  }, [allJobs]);

  interface ActionItem {
    id: string;
    priority: string;
    title: string;
    description: string;
    impact: string;
    cta: string;
    ctaUrl: string;
    metric: string;
    category: string;
  }
  interface ActionCenterData {
    actions: ActionItem[];
    summary: { fixNowCount: number; thisWeekCount: number; suggestionsCount: number; totalCount: number };
    sections: { fix_now: ActionItem[]; this_week: ActionItem[]; suggestions: ActionItem[] };
  }

  const { data: actionData } = useQuery<ActionCenterData>({
    queryKey: ["/api/bi/action-center"],
    staleTime: 5 * 60 * 1000,
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const formatJobTime = (dateStr: string) => {
    if (!dateStr) return 'TBD';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'TBD';
    return date.toLocaleTimeString('en-AU', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const handleStartJob = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateJob.mutateAsync({ 
        id: jobId, 
        data: { status: 'in_progress' } 
      });
      toast({ title: "Job Started", description: "Timer started. You're on the clock!" });
    } catch {
      toast({ title: "Error", description: "Failed to start job", variant: "destructive" });
    }
  };

  const handleCompleteJob = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateJob.mutateAsync({ 
        id: jobId, 
        data: { status: 'done' } 
      });
      toast({ title: "Job Complete", description: "Nice work! Job marked as done." });
    } catch {
      toast({ title: "Error", description: "Failed to complete job", variant: "destructive" });
    }
  };

  const handleCall = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `tel:${phone}`;
  };

  const handleSMS = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `sms:${phone}`;
  };

  const handleNavigate = (address: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://maps.google.com/maps?q=${encodeURIComponent(address)}`, '_blank');
  };

  const getStatusButton = (job: any) => {
    if (job.status === 'pending') {
      return (
        <Button
          size="sm"
          className="bg-green-600 text-white font-medium"
          onClick={(e) => handleStartJob(job.id, e)}
          disabled={updateJob.isPending}
          data-testid={`button-start-job-${job.id}`}
        >
          <Play className="h-3.5 w-3.5 mr-1.5" />
          Start
        </Button>
      );
    } else if (job.status === 'in_progress') {
      return (
        <Button
          size="sm"
          className="text-white font-medium"
          style={{ backgroundColor: 'hsl(var(--trade))' }}
          onClick={(e) => handleCompleteJob(job.id, e)}
          disabled={updateJob.isPending}
          data-testid={`button-complete-job-${job.id}`}
        >
          <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
          Done
        </Button>
      );
    }
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate?.(`/jobs/${job.id}`);
        }}
        data-testid={`button-view-job-${job.id}`}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    );
  };

  const getStatusBadge = (status: string) => {
    if (status === 'done') {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">Done</Badge>;
    } else if (status === 'in_progress') {
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1 animate-pulse" />
          Active
        </Badge>
      );
    }
    return <Badge variant="outline" className="text-xs">Scheduled</Badge>;
  };

  const fmtAud = (n: number) => '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const hasMoneyData = (kpis?.unpaidInvoicesTotal ?? 0) > 0;
  const hasOverdue = (cashflow?.overdueCount ?? 0) > 0;

  return (
    <div className="w-full px-4 sm:px-6 py-4 pb-28 md:pb-6" data-testid="owner-manager-dashboard">
      <DashboardUpgradeCard />
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {getGreeting()}, {userName}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {todaysJobs.length > 0 
              ? `${todaysJobs.length} job${todaysJobs.length > 1 ? 's' : ''} on today`
              : businessName || "Welcome back"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" data-testid="quick-actions-section">
          {onCreateJob && (
            <Button 
              size="sm"
              onClick={onCreateJob}
              data-testid="button-quick-create-job"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Job
            </Button>
          )}
          {onCreateQuote && (
            <Button variant="outline" size="sm" onClick={onCreateQuote} data-testid="button-quick-create-quote">
              <FileText className="h-3.5 w-3.5 mr-1" />
              Quote
            </Button>
          )}
          {onCreateInvoice && (
            <Button variant="outline" size="sm" onClick={onCreateInvoice} data-testid="button-quick-create-invoice">
              <DollarSign className="h-3.5 w-3.5 mr-1" />
              Invoice
            </Button>
          )}
        </div>
      </div>

      <ConnectionBanner />

      {hasMoneyData && (
        <Card 
          className="mb-3 cursor-pointer hover-elevate"
          onClick={() => onNavigate?.('/documents?tab=invoices&filter=unpaid')}
          data-testid="kpi-money-owed"
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-destructive/10">
                  <DollarSign className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <p className="text-xl font-bold text-destructive">
                    {fmtAud(kpis?.unpaidInvoicesTotal || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">owed across {kpis?.unpaidInvoicesCount || 0} invoices</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {hasOverdue && (
                  <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {cashflow?.overdueCount} overdue
                  </Badge>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {kpisLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 mb-4">
          {[1,2,3,4,5,6].map(i => (
            <Card key={i}>
              <CardContent className="py-2.5 px-3">
                <Skeleton className="h-6 w-12 mb-1" />
                <Skeleton className="h-3 w-10" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 mb-4">
          <Card 
            className="cursor-pointer hover-elevate"
            onClick={() => onNavigate?.('/work?filter=today')}
            data-testid="kpi-jobs-today"
          >
            <CardContent className="py-2.5 px-3">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 flex-shrink-0" style={{ color: 'hsl(var(--trade))' }} />
                <p className="text-lg font-bold">{kpis?.jobsToday || 0}</p>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate">Jobs Today</p>
            </CardContent>
          </Card>
          <Card 
            className="cursor-pointer hover-elevate"
            onClick={() => onNavigate?.('/work?filter=done')}
            data-testid="kpi-jobs-to-invoice"
          >
            <CardContent className="py-2.5 px-3">
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 flex-shrink-0" style={{ color: 'hsl(var(--trade))' }} />
                <p className="text-lg font-bold">{kpis?.jobsToInvoice ?? 0}</p>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate">To Invoice</p>
            </CardContent>
          </Card>
          <Card 
            className="cursor-pointer hover-elevate"
            onClick={() => onNavigate?.('/documents?tab=quotes&filter=sent')}
            data-testid="kpi-pending"
          >
            <CardContent className="py-2.5 px-3">
              <div className="flex items-center gap-1.5">
                <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'hsl(var(--trade))' }} />
                <p className="text-lg font-bold">{kpis?.quotesAwaiting || 0}</p>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate">Quotes Out</p>
            </CardContent>
          </Card>
          <Card 
            className="cursor-pointer hover-elevate"
            onClick={() => onNavigate?.('/work?filter=in_progress')}
            data-testid="kpi-active-jobs"
          >
            <CardContent className="py-2.5 px-3">
              <div className="flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 flex-shrink-0" style={{ color: 'hsl(var(--trade))' }} />
                <p className="text-lg font-bold">{kpis?.activeJobs || 0}</p>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate">Active Jobs</p>
            </CardContent>
          </Card>
          <Card 
            className="cursor-pointer hover-elevate"
            onClick={() => onNavigate?.('/insights?tab=profit')}
            data-testid="kpi-weekly-earnings"
          >
            <CardContent className="py-2.5 px-3">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 flex-shrink-0 text-green-600" />
                <p className="text-lg font-bold text-green-600">
                  {fmtAud(kpis?.weeklyEarnings || 0)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate">This Week</p>
            </CardContent>
          </Card>
          <Card 
            className="cursor-pointer hover-elevate"
            onClick={() => onNavigate?.('/documents?tab=invoices&filter=overdue')}
            data-testid="kpi-overdue-invoices"
          >
            <CardContent className="py-2.5 px-3">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${(cashflow?.overdueCount ?? 0) > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                <p className={`text-lg font-bold ${(cashflow?.overdueCount ?? 0) > 0 ? 'text-red-500' : ''}`}>
                  {cashflow?.overdueCount ?? 0}
                </p>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate">Overdue</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 py-3 px-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-destructive" />
              Action Centre
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate?.('/action-center')} data-testid="button-view-action-center">
              View All <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            {actionData && actionData.actions.length > 0 ? (
              <div className="space-y-2">
                {actionData.actions.slice(0, 3).map((action) => {
                  const priorityIcon = action.priority === 'fix_now' ? AlertTriangle : action.priority === 'this_week' ? Clock : Lightbulb;
                  const PIcon = priorityIcon;
                  const priorityClasses = action.priority === 'fix_now' 
                    ? { bg: 'bg-red-500/10', text: 'text-red-500' } 
                    : action.priority === 'this_week' 
                    ? { bg: 'bg-amber-500/10', text: 'text-amber-500' } 
                    : { bg: 'bg-green-500/10', text: 'text-green-600' };
                  return (
                    <div
                      key={action.id}
                      className="flex items-center gap-3 p-2.5 rounded-md cursor-pointer hover-elevate"
                      onClick={() => onNavigate?.(action.ctaUrl)}
                      data-testid={`action-item-${action.id}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${priorityClasses.bg}`}>
                        <PIcon className={`h-4 w-4 ${priorityClasses.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{action.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{action.impact}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <Target className="h-8 w-8 text-muted-foreground/25 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">You're all caught up</p>
                <p className="text-xs text-muted-foreground/70 mt-1">No actions needed right now</p>
              </div>
            )}
          </CardContent>
        </Card>

        <TodayScheduleCard
          jobs={todaysJobs}
          onCreateJob={onCreateJob}
          onViewAll={onViewJobs}
          onViewJob={(id) => onNavigate?.(`/jobs/${id}`)}
          onNavigate={onNavigate}
          renderRowActions={(job) => (
            <>
              {job.address && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleNavigate(job.address, e)}
                  data-testid={`address-link-${job.id}`}
                  title="Open in Maps"
                >
                  <Navigation className="h-4 w-4" />
                </Button>
              )}
              {job.clientPhone && (
                <>
                  <Button variant="ghost" size="icon" onClick={(e) => handleCall(job.clientPhone, e)} data-testid={`button-call-${job.id}`}>
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={(e) => handleSMS(job.clientPhone, e)} data-testid={`button-sms-${job.id}`}>
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </>
              )}
              {getStatusBadge(job.status)}
              {getStatusButton(job)}
            </>
          )}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mb-4">
        <Card className="hidden xl:block">
          <CardHeader className="flex flex-row items-center justify-between gap-4 py-3 px-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-green-600" />
              Revenue
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate?.('/payment-hub')} data-testid="button-view-revenue">
              Details <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold tracking-tight">${(profitData?.revenueThisMonth ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">Collected this month</p>
                </div>
                {cashflow?.collectedTrend !== undefined && cashflow.collectedTrend !== 0 && (
                  <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${cashflow.collectedTrend > 0 ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-950/40' : 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-950/40'}`}>
                    {cashflow.collectedTrend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {cashflow.collectedTrend > 0 ? '+' : ''}{cashflow.collectedTrend}%
                  </div>
                )}
              </div>

              {(() => {
                const rawWeeks = cashflow?.revenueByWeek ?? [];
                const now = new Date();
                const paddedWeeks: { week: string; amount: number }[] = [];
                for (let i = 3; i >= 0; i--) {
                  const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
                  const weekStart = new Date(d);
                  weekStart.setDate(d.getDate() - d.getDay() + 1);
                  const label = `${String(weekStart.getDate()).padStart(2, '0')} ${weekStart.toLocaleString('en-AU', { month: 'short' })}`;
                  const match = rawWeeks.find(w => w.week === label);
                  paddedWeeks.push({ week: label, amount: match?.amount ?? 0 });
                }
                const maxVal = Math.max(...paddedWeeks.map(w => w.amount), 1);
                return (
                  <div className="relative">
                    <div className="flex items-end gap-2 h-24">
                      {paddedWeeks.map((week, i) => {
                        const isLast = i === paddedWeeks.length - 1;
                        const barHeight = week.amount > 0 ? Math.max((week.amount / maxVal) * 80, 6) : 3;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                            <div className="invisible group-hover:visible absolute -top-6 bg-foreground text-background text-xs px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                              ${week.amount.toLocaleString()}
                            </div>
                            <div
                              className="w-full rounded-md transition-all duration-300"
                              style={{
                                height: `${barHeight}px`,
                                backgroundColor: isLast ? 'hsl(var(--trade))' : week.amount > 0 ? 'hsl(var(--trade) / 0.35)' : 'hsl(var(--trade) / 0.08)',
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 mt-2">
                      {paddedWeeks.map((week, i) => (
                        <span key={i} className="flex-1 text-xs text-muted-foreground text-center">{week.week}</span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-2.5 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Outstanding</p>
                  <p className="text-sm font-bold">${(cashflow?.outstandingTotal ?? 0).toLocaleString()}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">This week</p>
                  <p className="text-sm font-bold">${(profitData?.revenueThisWeek ?? 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hidden xl:flex xl:flex-col overflow-visible">
          <CardHeader className="flex flex-row items-center justify-between gap-4 py-3 px-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Team Activity
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate?.('/communications')} data-testid="button-view-all-activity-card">
              See All <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4 flex-1">
            {isBrandNew ? (
              <FirstQuoteCta onCreateQuote={onCreateQuote} />
            ) : (
              <ActivityFeed 
                limit={4}
                onViewAll={() => onNavigate?.('/communications')}
                compact
              />
            )}
          </CardContent>
        </Card>

        <Card className="hidden xl:block">
          <CardHeader className="flex flex-row items-center justify-between gap-4 py-3 px-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Hammer className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
              Job Pipeline
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate?.('/work')} data-testid="button-view-pipeline">
              All Jobs <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="space-y-4">
              {(() => {
                const total = jobPipeline.scheduled + jobPipeline.inProgress + jobPipeline.completed + jobPipeline.quoted;
                const segments = [
                  { label: 'Quoted', count: jobPipeline.quoted, color: 'hsl(38 92% 50%)', bgLight: 'rgba(245, 158, 11, 0.1)', bgDark: 'rgba(245, 158, 11, 0.08)', filter: 'quoted' },
                  { label: 'Scheduled', count: jobPipeline.scheduled, color: 'hsl(var(--trade))', bgLight: 'hsl(var(--trade) / 0.1)', bgDark: 'hsl(var(--trade) / 0.08)', filter: 'scheduled' },
                  { label: 'In Progress', count: jobPipeline.inProgress, color: 'hsl(217.2 91.2% 59.8%)', bgLight: 'rgba(59, 130, 246, 0.1)', bgDark: 'rgba(59, 130, 246, 0.08)', filter: 'in_progress' },
                  { label: 'Completed', count: jobPipeline.completed, color: 'hsl(142.1 76.2% 36.3%)', bgLight: 'rgba(22, 163, 74, 0.1)', bgDark: 'rgba(22, 163, 74, 0.08)', filter: 'done' },
                ];
                return (
                  <>
                    <div className="flex rounded-full h-2.5 overflow-hidden bg-muted/60 gap-0.5">
                      {total > 0 && segments.map((seg, i) => seg.count > 0 && (
                        <div
                          key={i}
                          style={{ width: `${(seg.count / total) * 100}%`, backgroundColor: seg.color }}
                          className="transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {segments.map((seg, i) => (
                        <div
                          key={i}
                          data-testid={`pipeline-${seg.filter}`}
                          className="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer hover-elevate active-elevate-2 transition-colors"
                          style={{ backgroundColor: seg.bgLight }}
                          onClick={() => onNavigate?.(`/work?filter=${seg.filter}`)}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: seg.color + '20' }}>
                            <span className="text-sm font-bold" style={{ color: seg.color }}>{seg.count}</span>
                          </div>
                          <p className="text-xs font-medium text-muted-foreground">{seg.label}</p>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}

              {(cashflow?.overdueCount ?? 0) > 0 && (
                <div 
                  className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover-elevate bg-red-50 dark:bg-red-950/20"
                  onClick={() => onNavigate?.('/payment-hub')}
                >
                  <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-red-700 dark:text-red-400">{cashflow?.overdueCount} overdue invoice{(cashflow?.overdueCount ?? 0) > 1 ? 's' : ''}</p>
                    <p className="text-xs text-red-500/70 mt-0.5">${(cashflow?.overdueTotal ?? 0).toLocaleString()} outstanding</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-red-400 flex-shrink-0" />
                </div>
              )}

              {profitData && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Gross margin</p>
                  <p className="text-sm font-bold">{profitData.grossMargin}%</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="xl:hidden">
        {isBrandNew ? (
          <FirstQuoteCta onCreateQuote={onCreateQuote} />
        ) : (
          <ActivityFeed 
            limit={5}
            onViewAll={() => onNavigate?.('/communications')}
          />
        )}
      </div>

      <GettingStartedChecklist 
        onNavigate={onNavigate}
        onCreateClient={() => onNavigate?.('/clients')}
        onCreateQuote={onCreateQuote}
      />

      <FloatingActionButton
        onCreateJob={onCreateJob}
        onCreateQuote={onCreateQuote}
        onCreateInvoice={onCreateInvoice}
        onCreateClient={() => onNavigate?.('/clients/new')}
        onCollectPayment={() => onNavigate?.('/collect-payment')}
      />
    </div>
  );
}
