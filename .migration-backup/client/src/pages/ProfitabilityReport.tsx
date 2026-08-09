import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ArrowLeft,
  Briefcase,
  Users,
  HardHat,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);

interface ProfitabilitySummary {
  totalRevenue: number;
  totalCosts: number;
  totalProfit: number;
  averageMargin: number;
  jobsAnalyzed: number;
  jobsProfitable: number;
  jobsAtLoss: number;
  jobsNoRevenue: number;
}

interface ProfitabilityJob {
  jobId: string;
  title: string;
  status: string;
  clientId: string | null;
  clientName: string;
  assignedTo: string | null;
  quoted: number;
  revenue: number;
  labourCost: number;
  subcontractorCost: number;
  materialCost: number;
  expenseCost: number;
  costs: number;
  profit: number;
  margin: number;
  profitStatus: "profitable" | "tight" | "loss";
  totalHours: number;
}

interface TrendDataPoint {
  month: string;
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
}

interface ProfitabilityReport {
  summary: ProfitabilitySummary;
  jobs: ProfitabilityJob[];
}

interface ClientProfitability {
  clientId: string;
  clientName: string;
  jobCount: number;
  totalRevenue: number;
  totalCosts: number;
  totalProfit: number;
  avgMargin: number;
}

interface WorkerProfitability {
  workerId: string;
  workerName: string;
  jobCount: number;
  totalHours: number;
  avgHourlyRate: number;
  totalLabourCost: number;
  revenueGenerated: number;
}

interface JobTypeProfitability {
  jobType: string;
  jobCount: number;
  totalRevenue: number;
  totalLabourCost: number;
  totalMaterialCost: number;
  totalExpenseCost: number;
  totalCosts: number;
  totalProfit: number;
  totalHours: number;
  avgMargin: number;
  previousMargin: number | null;
  marginChange: number | null;
}

interface JobTypeReport {
  jobTypes: JobTypeProfitability[];
  best: { jobType: string; avgMargin: number } | null;
  worst: { jobType: string; avgMargin: number } | null;
}

type DatePreset = "this_week" | "this_month" | "last_month" | "last_3_months" | "this_year" | "custom";

const datePresets: { label: string; value: DatePreset }[] = [
  { label: "This Week", value: "this_week" },
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "Last 3 Months", value: "last_3_months" },
  { label: "This Year", value: "this_year" },
];

function getDateRange(preset: DatePreset): { startDate: string; endDate: string } | null {
  const now = new Date();
  let start: Date;
  switch (preset) {
    case "this_week": {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
      break;
    }
    case "this_month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "last_month":
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { startDate: start.toISOString(), endDate: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString() };
    case "last_3_months":
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      break;
    case "this_year":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      return null;
  }
  return { startDate: start.toISOString(), endDate: now.toISOString() };
}

function getStatusColor(profitStatus: string) {
  switch (profitStatus) {
    case "profitable":
      return "text-green-600 dark:text-green-400";
    case "tight":
      return "text-amber-600 dark:text-amber-400";
    case "loss":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-muted-foreground";
  }
}

function getMarginColor(margin: number) {
  if (margin > 15) return "text-green-600 dark:text-green-400";
  if (margin > 5) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function getMarginBarColor(margin: number) {
  if (margin > 15) return "hsl(142.1 76.2% 36.3%)";
  if (margin > 5) return "hsl(38 92% 50%)";
  return "hsl(0 84.2% 60.2%)";
}

function MarginBadge({ margin }: { margin: number }) {
  if (margin > 15) {
    return <Badge variant="secondary" className="text-xs text-green-600 dark:text-green-400">{margin.toFixed(1)}%</Badge>;
  }
  if (margin > 0) {
    return <Badge variant="secondary" className="text-xs text-amber-600 dark:text-amber-400">{margin.toFixed(1)}%</Badge>;
  }
  return <Badge variant="secondary" className="text-xs text-red-600 dark:text-red-400">{margin.toFixed(1)}%</Badge>;
}

function SummaryCards({ summary }: { summary: ProfitabilitySummary }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1 flex-wrap">
            <DollarSign className="h-3.5 w-3.5" />
            Total Revenue
          </div>
          <p className="text-lg font-semibold text-green-600 dark:text-green-400">
            {formatCurrency(summary.totalRevenue)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1 flex-wrap">
            <TrendingDown className="h-3.5 w-3.5" />
            Total Costs
          </div>
          <p className="text-lg font-semibold text-muted-foreground">
            {formatCurrency(summary.totalCosts)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1 flex-wrap">
            <BarChart3 className="h-3.5 w-3.5" />
            Net Profit
          </div>
          <p className={`text-lg font-semibold ${summary.totalProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {formatCurrency(summary.totalProfit)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1 flex-wrap">
            <TrendingUp className="h-3.5 w-3.5" />
            Average Margin
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-lg font-semibold">{summary.averageMargin.toFixed(1)}%</p>
            <Badge variant="secondary" className={`text-xs ${summary.averageMargin > 15 ? "text-green-600 dark:text-green-400" : summary.averageMargin > 5 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
              {summary.jobsProfitable} profitable
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-4 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-4 space-y-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TrendChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-sm text-xs space-y-1">
      <p className="font-medium text-foreground">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold" style={{ color: p.color }}>{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function ProfitTrendChart() {
  const { data, isLoading } = useQuery<{ trend: TrendDataPoint[] }>({
    queryKey: ["/api/reports/profitability/trend"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const trend = data?.trend || [];
  if (trend.length === 0) return null;

  const hasData = trend.some(t => t.revenue > 0 || t.costs > 0);
  if (!hasData) return null;

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">12-MONTH PROFIT TREND</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={trend} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(217.2 91.2% 59.8%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(217.2 91.2% 59.8%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<TrendChartTooltip />} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke="hsl(142.1 76.2% 36.3%)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="costs"
              name="Costs"
              stroke="hsl(0 84.2% 60.2%)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Area
              type="monotone"
              dataKey="profit"
              name="Profit"
              stroke="hsl(217.2 91.2% 59.8%)"
              strokeWidth={2}
              fill="url(#profitGradient)"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function ByJobView({ jobs, navigate }: { jobs: ProfitabilityJob[]; navigate: (path: string) => void }) {
  const sorted = useMemo(() => [...jobs].sort((a, b) => b.profit - a.profit), [jobs]);

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Briefcase className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No job data for this period.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="hidden lg:block">
        <div className="grid grid-cols-8 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground">
          <div className="col-span-2">Job</div>
          <div className="text-right">Revenue</div>
          <div className="text-right">Labour</div>
          <div className="text-right">Materials</div>
          <div className="text-right">Profit</div>
          <div className="text-right">Margin</div>
          <div className="text-right">Status</div>
        </div>
      </div>
      {sorted.map((job) => (
        <Card
          key={job.jobId}
          className="hover-elevate cursor-pointer"
          onClick={() => navigate(`/jobs/${job.jobId}`)}
        >
          <CardContent className="pt-4 pb-4">
            <div className="hidden lg:grid grid-cols-8 gap-2 items-center">
              <div className="col-span-2 min-w-0">
                <p className="text-sm font-medium truncate">{job.title}</p>
                <p className="text-xs text-muted-foreground truncate">{job.clientName || 'No client'}</p>
              </div>
              <p className="text-sm text-right">{formatCurrency(job.revenue)}</p>
              <p className="text-sm text-right text-muted-foreground">{formatCurrency(job.labourCost)}</p>
              <p className="text-sm text-right text-muted-foreground">{formatCurrency(job.materialCost)}</p>
              <p className={`text-sm text-right font-medium ${getStatusColor(job.profitStatus)}`}>{formatCurrency(job.profit)}</p>
              <div className="text-right"><MarginBadge margin={job.margin} /></div>
              <div className="text-right">
                <Badge variant="secondary" className="text-xs capitalize">{job.status.replace("_", " ")}</Badge>
              </div>
            </div>
            <div className="lg:hidden space-y-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{job.title}</p>
                  <p className="text-xs text-muted-foreground">{job.clientName || 'No client'}</p>
                </div>
                <MarginBadge margin={job.margin} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                  <p className="text-sm font-medium">{formatCurrency(job.revenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Labour</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(job.labourCost)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Materials</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(job.materialCost)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Gross Profit</p>
                  <p className={`text-sm font-medium ${getStatusColor(job.profitStatus)}`}>{formatCurrency(job.profit)}</p>
                </div>
                <Badge variant="secondary" className="text-xs capitalize">{job.status.replace("_", " ")}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ByClientView({ dateRange }: { dateRange: { startDate: string; endDate: string } | null }) {
  const queryParams: Record<string, string> = {};
  if (dateRange) {
    queryParams.startDate = dateRange.startDate;
    queryParams.endDate = dateRange.endDate;
  }

  const { data, isLoading } = useQuery<{ clients: ClientProfitability[] }>({
    queryKey: ["/api/reports/profitability/by-client", queryParams],
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}><CardContent className="pt-4 pb-4 space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-4 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  const clients = data?.clients || [];
  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Users className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No client data for this period.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="hidden lg:block">
        <div className="grid grid-cols-7 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground">
          <div className="col-span-2">Client</div>
          <div className="text-right">Jobs</div>
          <div className="text-right">Revenue</div>
          <div className="text-right">Costs</div>
          <div className="text-right">Profit</div>
          <div className="text-right">Avg Margin</div>
        </div>
      </div>
      {clients.map((c) => (
        <Card key={c.clientId}>
          <CardContent className="pt-4 pb-4">
            <div className="hidden lg:grid grid-cols-7 gap-2 items-center">
              <div className="col-span-2 min-w-0">
                <p className="text-sm font-medium truncate">{c.clientName}</p>
              </div>
              <p className="text-sm text-right text-muted-foreground">{c.jobCount}</p>
              <p className="text-sm text-right">{formatCurrency(c.totalRevenue)}</p>
              <p className="text-sm text-right text-muted-foreground">{formatCurrency(c.totalCosts)}</p>
              <p className={`text-sm text-right font-medium ${getMarginColor(c.avgMargin)}`}>{formatCurrency(c.totalProfit)}</p>
              <div className="text-right"><MarginBadge margin={c.avgMargin} /></div>
            </div>
            <div className="lg:hidden space-y-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.clientName}</p>
                  <p className="text-xs text-muted-foreground">{c.jobCount} job{c.jobCount !== 1 ? 's' : ''}</p>
                </div>
                <MarginBadge margin={c.avgMargin} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                  <p className="text-sm font-medium">{formatCurrency(c.totalRevenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Costs</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(c.totalCosts)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Profit</p>
                  <p className={`text-sm font-medium ${getMarginColor(c.avgMargin)}`}>{formatCurrency(c.totalProfit)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ByWorkerView({ dateRange }: { dateRange: { startDate: string; endDate: string } | null }) {
  const queryParams: Record<string, string> = {};
  if (dateRange) {
    queryParams.startDate = dateRange.startDate;
    queryParams.endDate = dateRange.endDate;
  }

  const { data, isLoading } = useQuery<{ workers: WorkerProfitability[] }>({
    queryKey: ["/api/reports/profitability/by-worker", queryParams],
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}><CardContent className="pt-4 pb-4 space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-4 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  const workers = data?.workers || [];
  if (workers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <HardHat className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No worker data for this period.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="hidden lg:block">
        <div className="grid grid-cols-6 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground">
          <div className="col-span-2">Worker</div>
          <div className="text-right">Jobs</div>
          <div className="text-right">Hours</div>
          <div className="text-right">Labour Cost</div>
          <div className="text-right">Revenue</div>
        </div>
      </div>
      {workers.map((w) => (
        <Card key={w.workerId}>
          <CardContent className="pt-4 pb-4">
            <div className="hidden lg:grid grid-cols-6 gap-2 items-center">
              <div className="col-span-2 min-w-0">
                <p className="text-sm font-medium truncate">{w.workerName}</p>
                <p className="text-xs text-muted-foreground">{w.avgHourlyRate > 0 ? `${formatCurrency(w.avgHourlyRate)}/hr` : 'No rate'}</p>
              </div>
              <p className="text-sm text-right text-muted-foreground">{w.jobCount}</p>
              <p className="text-sm text-right text-muted-foreground">{w.totalHours}h</p>
              <p className="text-sm text-right">{formatCurrency(w.totalLabourCost)}</p>
              <p className="text-sm text-right font-medium text-green-600 dark:text-green-400">{formatCurrency(w.revenueGenerated)}</p>
            </div>
            <div className="lg:hidden space-y-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{w.workerName}</p>
                  <p className="text-xs text-muted-foreground">{w.jobCount} job{w.jobCount !== 1 ? 's' : ''}</p>
                </div>
                {w.avgHourlyRate > 0 && (
                  <Badge variant="secondary" className="text-xs">{formatCurrency(w.avgHourlyRate)}/hr</Badge>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Hours</p>
                  <p className="text-sm font-medium">{w.totalHours}h</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Labour Cost</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(w.totalLabourCost)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">{formatCurrency(w.revenueGenerated)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartTooltipContent({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-sm text-xs">
      <p className="font-medium text-foreground mb-1 max-w-[200px] truncate">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

function MarginChart({ jobTypes }: { jobTypes: JobTypeProfitability[] }) {
  const chartData = useMemo(() => {
    return jobTypes
      .slice(0, 10)
      .map(t => ({
        name: t.jobType.length > 20 ? t.jobType.substring(0, 18) + "..." : t.jobType,
        fullName: t.jobType,
        margin: t.avgMargin,
      }));
  }, [jobTypes]);

  if (chartData.length === 0) return null;

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">MARGIN % BY JOB TYPE</p>
        <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 36)}>
          <BarChart data={chartData} layout="vertical" barSize={20} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={120} />
            <Tooltip content={<ChartTooltipContent formatter={(v: number) => `${v.toFixed(1)}%`} />} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
            <Bar dataKey="margin" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={getMarginBarColor(entry.margin)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function ByJobTypeView({ dateRange }: { dateRange: { startDate: string; endDate: string } | null }) {
  const queryParams: Record<string, string> = {};
  if (dateRange) {
    queryParams.startDate = dateRange.startDate;
    queryParams.endDate = dateRange.endDate;
  }

  const { data, isLoading } = useQuery<JobTypeReport>({
    queryKey: ["/api/reports/profitability/by-job-type", queryParams],
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}><CardContent className="pt-4 pb-4 space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-4 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  const jobTypes = data?.jobTypes || [];
  const best = data?.best;
  const worst = data?.worst;

  if (jobTypes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Layers className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No job type data for this period.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(best || worst) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {best && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1 flex-wrap">
                  <TrendingUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  Best Performing
                </div>
                <p className="text-sm font-medium truncate">{best.jobType}</p>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">{best.avgMargin.toFixed(1)}% margin</p>
              </CardContent>
            </Card>
          )}
          {worst && best?.jobType !== worst?.jobType && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1 flex-wrap">
                  <TrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                  Worst Performing
                </div>
                <p className="text-sm font-medium truncate">{worst.jobType}</p>
                <p className="text-lg font-semibold text-red-600 dark:text-red-400">{worst.avgMargin.toFixed(1)}% margin</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <MarginChart jobTypes={jobTypes} />

      <div className="space-y-3">
        <div className="hidden lg:block">
          <div className="grid grid-cols-8 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground">
            <div className="col-span-2">Job Type</div>
            <div className="text-right">Jobs</div>
            <div className="text-right">Revenue</div>
            <div className="text-right">Costs</div>
            <div className="text-right">Profit</div>
            <div className="text-right">Margin</div>
            <div className="text-right">Trend</div>
          </div>
        </div>
        {jobTypes.map((t) => (
          <Card key={t.jobType}>
            <CardContent className="pt-4 pb-4">
              <div className="hidden lg:grid grid-cols-8 gap-2 items-center">
                <div className="col-span-2 min-w-0">
                  <p className="text-sm font-medium truncate">{t.jobType}</p>
                  <p className="text-xs text-muted-foreground">{t.jobCount} job{t.jobCount !== 1 ? 's' : ''}</p>
                </div>
                <p className="text-sm text-right text-muted-foreground">{t.jobCount}</p>
                <p className="text-sm text-right">{formatCurrency(t.totalRevenue)}</p>
                <p className="text-sm text-right text-muted-foreground">{formatCurrency(t.totalCosts)}</p>
                <p className={`text-sm text-right font-medium ${getMarginColor(t.avgMargin)}`}>{formatCurrency(t.totalProfit)}</p>
                <div className="text-right"><MarginBadge margin={t.avgMargin} /></div>
                <div className="text-right">
                  {t.marginChange !== null ? (
                    <div className="flex items-center justify-end gap-1">
                      {t.marginChange >= 0 ? (
                        <ArrowUpRight className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                      )}
                      <span className={`text-xs font-medium ${t.marginChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {t.marginChange >= 0 ? "+" : ""}{t.marginChange.toFixed(1)}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">--</span>
                  )}
                </div>
              </div>
              <div className="lg:hidden space-y-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.jobType}</p>
                    <p className="text-xs text-muted-foreground">{t.jobCount} job{t.jobCount !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <MarginBadge margin={t.avgMargin} />
                    {t.marginChange !== null && (
                      <div className="flex items-center gap-0.5">
                        {t.marginChange >= 0 ? (
                          <ArrowUpRight className="h-3 w-3 text-green-600 dark:text-green-400" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3 text-red-600 dark:text-red-400" />
                        )}
                        <span className={`text-xs ${t.marginChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {t.marginChange >= 0 ? "+" : ""}{t.marginChange.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                    <p className="text-sm font-medium">{formatCurrency(t.totalRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Costs</p>
                    <p className="text-sm text-muted-foreground">{formatCurrency(t.totalCosts)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Profit</p>
                    <p className={`text-sm font-medium ${getMarginColor(t.avgMargin)}`}>{formatCurrency(t.totalProfit)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function ProfitabilityReportPage() {
  const [, navigate] = useLocation();
  const searchParams = useSearch();
  const [activeTab, setActiveTab] = useState("by-job");
  const [datePreset, setDatePreset] = useState<DatePreset>("this_year");

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const tabParam = params.get('tab');
    if (tabParam && ["by-job", "by-job-type", "by-client", "by-worker"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const dateRange = getDateRange(datePreset);

  const queryParams: Record<string, string> = {};
  if (dateRange) {
    queryParams.startDate = dateRange.startDate;
    queryParams.endDate = dateRange.endDate;
  }

  const { data, isLoading } = useQuery<ProfitabilityReport>({
    queryKey: ["/api/reports/profitability", queryParams],
  });

  return (
    <PageShell>
      <PageHeader
        title="Profitability Report"
        subtitle="See which jobs make money and which ones cost you"
        leading={<TrendingUp className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />}
        action={
          <Button variant="ghost" size="icon" onClick={() => navigate("/reports")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        }
      />

      <div className="space-y-4 mt-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {datePresets.map((p) => (
            <Button
              key={p.value}
              variant={datePreset === p.value ? "default" : "outline"}
              size="sm"
              onClick={() => setDatePreset(p.value)}
              className="toggle-elevate"
            >
              {p.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : !data ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Briefcase className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              No job data available. Complete some jobs to see profitability analysis.
            </p>
          </div>
        ) : (
          <>
            <SummaryCards summary={data.summary} />

            <ProfitTrendChart />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="by-job" className="flex-1 sm:flex-initial gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" />
                  By Job
                </TabsTrigger>
                <TabsTrigger value="by-job-type" className="flex-1 sm:flex-initial gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  By Job Type
                </TabsTrigger>
                <TabsTrigger value="by-client" className="flex-1 sm:flex-initial gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  By Client
                </TabsTrigger>
                <TabsTrigger value="by-worker" className="flex-1 sm:flex-initial gap-1.5">
                  <HardHat className="h-3.5 w-3.5" />
                  By Worker
                </TabsTrigger>
              </TabsList>

              <TabsContent value="by-job">
                <ByJobView jobs={data.jobs} navigate={navigate} />
              </TabsContent>

              <TabsContent value="by-job-type">
                <ByJobTypeView dateRange={dateRange} />
              </TabsContent>

              <TabsContent value="by-client">
                <ByClientView dateRange={dateRange} />
              </TabsContent>

              <TabsContent value="by-worker">
                <ByWorkerView dateRange={dateRange} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </PageShell>
  );
}
