import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Clock, Briefcase, TrendingUp, ChevronDown, ChevronRight,
  Target, Zap, DollarSign, Award
} from "lucide-react";

const fmtAud = (n: number) => `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;

function getMetricColor(value: number, thresholds: { good: number; avg: number }) {
  if (value >= thresholds.good) return "text-green-600 dark:text-green-400";
  if (value >= thresholds.avg) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function getMetricBg(value: number, thresholds: { good: number; avg: number }) {
  if (value >= thresholds.good) return "bg-green-100 dark:bg-green-900/30";
  if (value >= thresholds.avg) return "bg-amber-100 dark:bg-amber-900/30";
  return "bg-red-100 dark:bg-red-900/30";
}

function getMetricDot(value: number, thresholds: { good: number; avg: number }) {
  if (value >= thresholds.good) return "bg-green-500";
  if (value >= thresholds.avg) return "bg-amber-500";
  return "bg-red-500";
}

function MiniBarChart({ data, maxHeight = 32 }: { data: number[]; maxHeight?: number }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1" style={{ height: maxHeight }}>
      {data.map((val, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-[hsl(var(--trade))] opacity-60 min-w-[6px] transition-all"
          style={{ height: `${Math.max((val / max) * maxHeight, 2)}px` }}
          title={`Week ${i + 1}: ${val}h`}
        />
      ))}
    </div>
  );
}

interface WorkerPerf {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  profileImageUrl?: string;
  jobsCompletedThisMonth: number;
  jobsCompletedAllTime: number;
  hoursWorkedThisMonth: number;
  onTimeRate: number;
  utilisationRate: number;
  revenueGenerated: number;
  last4WeeksHours: number[];
}

interface PerformanceSummary {
  averageOnTimeRate: number;
  totalHoursThisMonth: number;
  busiestWorker: { name: string; hours: number } | null;
  teamSize: number;
}

interface WorkerDetail {
  memberId: string;
  name: string;
  role: string;
  jobsCompletedThisMonth: number;
  jobsCompletedAllTime: number;
  hoursWorkedThisMonth: number;
  hoursWorkedAllTime: number;
  onTimeRate: number;
  averageJobDurationHours: number;
  utilisationRate: number;
  revenueGenerated: number;
  currentStreak: number;
}

function WorkerDetailPanel({ memberId }: { memberId: string }) {
  const { data, isLoading } = useQuery<WorkerDetail>({
    queryKey: ['/api/team', memberId, 'performance'],
    queryFn: async () => {
      const res = await fetch(`/api/team/${memberId}/performance`);
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14" />)}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-3 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-md bg-muted/50 p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">All-Time Jobs</div>
          <div className="text-base font-bold tabular-nums">{data.jobsCompletedAllTime}</div>
        </div>
        <div className="rounded-md bg-muted/50 p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">All-Time Hours</div>
          <div className="text-base font-bold tabular-nums">{data.hoursWorkedAllTime?.toFixed(1) ?? 0}h</div>
        </div>
        <div className="rounded-md bg-muted/50 p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Avg Job Duration</div>
          <div className="text-base font-bold tabular-nums">{data.averageJobDurationHours}h</div>
        </div>
        <div className="rounded-md bg-muted/50 p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">On-Time Streak</div>
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-base font-bold tabular-nums">{data.currentStreak}</span>
          </div>
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground">
        Revenue from paid invoices on assigned jobs: <span className="font-medium">{fmtAud(data.revenueGenerated)}</span>
      </div>
    </div>
  );
}

function getRoleLabel(role: string) {
  const labels: Record<string, string> = {
    worker: 'Worker',
    manager: 'Manager',
    office_admin: 'Office Admin',
    subcontractor: 'Subcontractor',
    pending: 'Pending',
  };
  return labels[role] || role || 'Worker';
}

export default function WorkerPerformanceSection() {
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<{ workers: WorkerPerf[]; summary: PerformanceSummary }>({
    queryKey: ['/api/team/performance-summary'],
    queryFn: async () => {
      const res = await fetch('/api/team/performance-summary');
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const toggleWorker = (id: string) => {
    setExpandedWorkers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
  };

  const summary = data?.summary;
  const workers = data?.workers || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Award className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
        <h2 className="text-lg font-semibold">Team Performance</h2>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Team Size</span>
              </div>
              <p className="text-2xl font-bold">{summary?.teamSize ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Avg On-Time</span>
              </div>
              <p className={`text-2xl font-bold ${getMetricColor(summary?.averageOnTimeRate ?? 0, { good: 80, avg: 50 })}`}>
                {summary?.averageOnTimeRate ?? 0}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Total Hours</span>
              </div>
              <p className="text-2xl font-bold">{(summary?.totalHoursThisMonth ?? 0).toFixed(1)}h</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Busiest Worker</span>
              </div>
              <p className="text-sm font-bold truncate">{summary?.busiestWorker?.name ?? '-'}</p>
              {summary?.busiestWorker && (
                <p className="text-xs text-muted-foreground">{summary.busiestWorker.hours}h this month</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : workers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-25" />
            <p className="text-sm text-muted-foreground">No team members with performance data yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {workers
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((w) => {
              const isExpanded = expandedWorkers.has(w.memberId);
              return (
                <Card key={w.memberId}>
                  <CardContent className="p-0">
                    <div
                      className="flex items-center gap-3 p-4 cursor-pointer"
                      onClick={() => toggleWorker(w.memberId)}
                    >
                      <UserAvatar
                        className="h-9 w-9"
                        fallbackClassName="text-xs"
                        user={{ id: w.userId, name: w.name, photoUrl: w.profileImageUrl }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{w.name}</span>
                          <Badge variant="secondary" className="text-[10px]">{getRoleLabel(w.role)}</Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); toggleWorker(w.memberId); }}>
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </div>

                    <div className="grid grid-cols-4 gap-2 px-4 pb-3">
                      <div className="text-center">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Jobs</div>
                        <div className="text-sm font-bold tabular-nums">{w.jobsCompletedThisMonth}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Hours</div>
                        <div className="text-sm font-bold tabular-nums">{w.hoursWorkedThisMonth}h</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">On-Time</div>
                        <div className={`text-sm font-bold tabular-nums ${getMetricColor(w.onTimeRate, { good: 80, avg: 50 })}`}>
                          {w.onTimeRate}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Util</div>
                        <div className={`text-sm font-bold tabular-nums ${getMetricColor(w.utilisationRate, { good: 80, avg: 50 })}`}>
                          {w.utilisationRate}%
                        </div>
                      </div>
                    </div>

                    {w.last4WeeksHours && w.last4WeeksHours.length > 0 && (
                      <div className="px-4 pb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Last 4 Weeks</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {w.last4WeeksHours.reduce((a, b) => a + b, 0).toFixed(1)}h total
                          </span>
                        </div>
                        <MiniBarChart data={w.last4WeeksHours} />
                      </div>
                    )}

                    <div className="px-4 pb-3 flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${getMetricDot(w.onTimeRate, { good: 80, avg: 50 })}`} />
                        <span className="text-[10px] text-muted-foreground">On-Time</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${getMetricDot(w.utilisationRate, { good: 80, avg: 50 })}`} />
                        <span className="text-[10px] text-muted-foreground">Utilisation</span>
                      </div>
                      <div className="flex items-center gap-1.5 ml-auto">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] font-medium">{fmtAud(w.revenueGenerated)}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t">
                        <WorkerDetailPanel memberId={w.memberId} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}
    </div>
  );
}