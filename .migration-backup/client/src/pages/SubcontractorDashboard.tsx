import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin, Clock, Briefcase, DollarSign, CalendarDays, Timer,
  CheckCircle2, XCircle, Receipt, TrendingUp,
} from "lucide-react";

interface SubbieJob {
  id: string;
  title: string;
  description: string | null;
  address: string | null;
  status: string;
  scheduledAt: string | null;
  scheduledTime: string | null;
  clientName: string | null;
  businessName: string;
  businessColor: string;
  businessOwnerId: string;
  assignmentStatus: string;
  startedAt: string | null;
}

interface DashboardData {
  availabilityStatus: string;
  todaysJobs: SubbieJob[];
  weekJobs: SubbieJob[];
  pendingRequests: SubbieJob[];
  activeJob: SubbieJob | null;
  earningsWeek: number;
  earningsMonth: number;
  hoursMonth: number;
  jobsCompletedMonth: number;
  earningsByBusiness: { businessName: string; amount: number; hours: number }[];
  earningsTrend: { period: string; earnings: number; hours: number }[];
  businesses: { id: string; name: string; color: string }[];
}

const AVAILABILITY_OPTIONS = [
  { value: "available", label: "Available", dot: "bg-emerald-500" },
  { value: "busy", label: "Busy", dot: "bg-amber-500" },
  { value: "unavailable", label: "Unavailable", dot: "bg-red-500" },
];

function money(n: number) {
  return (n || 0).toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

function jobTimeLabel(j: SubbieJob) {
  if (!j.scheduledAt) return null;
  const d = new Date(j.scheduledAt);
  const date = d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  return j.scheduledTime ? `${date}, ${j.scheduledTime}` : date;
}

function ElapsedTimer({ since }: { since: string }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = (v: number) => String(v).padStart(2, "0");
  return <span className="font-mono tabular-nums">{h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`}</span>;
}

function JobRow({ job }: { job: SubbieJob }) {
  return (
    <div className="flex items-start gap-3 py-2.5" data-testid={`row-subbie-job-${job.id}`}>
      <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: job.businessColor }} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{job.title}</p>
        <p className="text-xs text-muted-foreground truncate">
          {job.businessName}
          {job.clientName ? ` · ${job.clientName}` : ""}
        </p>
        {job.address && (
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3 shrink-0" />
            {job.address}
          </p>
        )}
      </div>
      <div className="text-right shrink-0">
        {jobTimeLabel(job) && <p className="text-xs text-muted-foreground">{jobTimeLabel(job)}</p>}
        <Badge variant="outline" className="mt-1 text-[10px]">{job.status.replace(/_/g, " ")}</Badge>
      </div>
    </div>
  );
}

export default function SubcontractorDashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [declineJob, setDeclineJob] = useState<SubbieJob | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ["/api/subcontractor/dashboard"],
    refetchInterval: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/subcontractor/dashboard"] });
  };

  const availabilityMutation = useMutation({
    mutationFn: (status: string) =>
      apiRequest("PATCH", "/api/subcontractor/availability-status", { status }),
    onSuccess: invalidate,
    onError: () => toast({ title: "Couldn't update availability", variant: "destructive" }),
  });

  const acceptMutation = useMutation({
    mutationFn: (jobId: string) => apiRequest("POST", `/api/subcontractor/jobs/${jobId}/accept`),
    onSuccess: () => {
      toast({ title: "Job accepted" });
      invalidate();
    },
    onError: () => toast({ title: "Couldn't accept job", variant: "destructive" }),
  });

  const declineMutation = useMutation({
    mutationFn: ({ jobId, reason }: { jobId: string; reason: string }) =>
      apiRequest("POST", `/api/subcontractor/jobs/${jobId}/decline`, { reason }),
    onSuccess: () => {
      toast({ title: "Job declined" });
      setDeclineJob(null);
      setDeclineReason("");
      invalidate();
    },
    onError: () => toast({ title: "Couldn't decline job", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-32 w-full rounded-md" />
        <Skeleton className="h-48 w-full rounded-md" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Couldn't load your dashboard. Please refresh.
          </CardContent>
        </Card>
      </div>
    );
  }

  const maxTrend = Math.max(1, ...data.earningsTrend.map((t) => t.earnings));

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-subbie-dashboard-title">My Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your jobs and earnings across the businesses you work with.</p>
        </div>
        <Button variant="outline" onClick={() => setLocation("/my-invoices")} data-testid="button-goto-my-invoices">
          <Receipt className="h-4 w-4 mr-1.5" />
          My Invoices
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">MY STATUS</p>
          <div className="flex gap-2 flex-wrap">
            {AVAILABILITY_OPTIONS.map((opt) => {
              const active = data.availabilityStatus === opt.value;
              return (
                <Button
                  key={opt.value}
                  size="sm"
                  variant="outline"
                  className={active ? "toggle-elevate toggle-elevated" : "toggle-elevate"}
                  disabled={availabilityMutation.isPending}
                  onClick={() => availabilityMutation.mutate(opt.value)}
                  data-testid={`button-availability-${opt.value}`}
                >
                  <span className={`h-2 w-2 rounded-full mr-1.5 ${opt.dot}`} />
                  {opt.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {data.activeJob && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
              <Timer className="h-4 w-4 text-emerald-600" />
              Active job
              {data.activeJob.startedAt && (
                <span className="text-emerald-600 text-sm">
                  <ElapsedTimer since={data.activeJob.startedAt} />
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <JobRow job={data.activeJob} />
          </CardContent>
        </Card>
      )}

      {data.pendingRequests.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending requests ({data.pendingRequests.length})</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 divide-y">
            {data.pendingRequests.map((job) => (
              <div key={job.id}>
                <JobRow job={job} />
                <div className="flex gap-2 pb-3 pl-4">
                  <Button
                    size="sm"
                    onClick={() => acceptMutation.mutate(job.id)}
                    disabled={acceptMutation.isPending}
                    data-testid={`button-accept-${job.id}`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeclineJob(job)}
                    data-testid={`button-decline-${job.id}`}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <DollarSign className="h-4 w-4 text-muted-foreground mb-1" />
            <p className="text-lg font-semibold" data-testid="text-earnings-week">{money(data.earningsWeek)}</p>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <TrendingUp className="h-4 w-4 text-muted-foreground mb-1" />
            <p className="text-lg font-semibold" data-testid="text-earnings-month">{money(data.earningsMonth)}</p>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Clock className="h-4 w-4 text-muted-foreground mb-1" />
            <p className="text-lg font-semibold">{data.hoursMonth}h</p>
            <p className="text-xs text-muted-foreground">Hours this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Briefcase className="h-4 w-4 text-muted-foreground mb-1" />
            <p className="text-lg font-semibold">{data.jobsCompletedMonth}</p>
            <p className="text-xs text-muted-foreground">Jobs done this month</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Today's jobs
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 divide-y">
          {data.todaysJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No jobs scheduled for today.</p>
          ) : (
            data.todaysJobs.map((job) => <JobRow key={job.id} job={job} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">This week</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 divide-y">
          {data.weekJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No jobs scheduled this week.</p>
          ) : (
            data.weekJobs.map((job) => <JobRow key={job.id} job={job} />)
          )}
        </CardContent>
      </Card>

      {(data.earningsByBusiness.length > 0 || data.earningsTrend.some((t) => t.earnings > 0)) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Earnings</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {data.earningsTrend.some((t) => t.earnings > 0) && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Last 6 months</p>
                <div className="flex items-end gap-2 h-24">
                  {data.earningsTrend.map((t) => (
                    <div key={t.period} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-sm bg-primary/70 min-h-[2px]"
                        style={{ height: `${Math.round((t.earnings / maxTrend) * 80)}px` }}
                        title={money(t.earnings)}
                      />
                      <span className="text-[10px] text-muted-foreground">{t.period}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {data.earningsByBusiness.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">This month by business</p>
                <div className="space-y-1.5">
                  {data.earningsByBusiness.map((b) => (
                    <div key={b.businessName} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{b.businessName}</span>
                      <span className="text-muted-foreground shrink-0">
                        {b.hours}h · {money(b.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!declineJob} onOpenChange={(open) => { if (!open) { setDeclineJob(null); setDeclineReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline "{declineJob?.title}"?</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Reason (optional) — the business owner will see this"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            data-testid="input-decline-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeclineJob(null); setDeclineReason(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={declineMutation.isPending}
              onClick={() => declineJob && declineMutation.mutate({ jobId: declineJob.id, reason: declineReason })}
              data-testid="button-confirm-decline"
            >
              Decline job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
