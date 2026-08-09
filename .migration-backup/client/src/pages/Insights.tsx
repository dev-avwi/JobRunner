import { useState, useEffect } from "react";
import { getAuthHeaders } from "@/lib/queryClient";
import { useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Clock,
  Users,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  FileBarChart,
  PieChart,
  LineChart as LineChartIcon,
  ArrowRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart as RechartsPie,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
} from "recharts";

interface InsightsProps {
  onNavigate?: (path: string) => void;
}

type PeriodId = "week" | "month" | "quarter" | "year" | "last12";

const periods: Array<{ id: PeriodId; label: string; shortLabel: string }> = [
  { id: "week", label: "This Week", shortLabel: "this week" },
  { id: "month", label: "This Month", shortLabel: "this month" },
  { id: "quarter", label: "This Quarter", shortLabel: "this quarter" },
  { id: "year", label: "This Year", shortLabel: "this year" },
  { id: "last12", label: "Last 12 Months", shortLabel: "last 12 months" },
];

function getPeriodRange(period: PeriodId): { startDate: string; endDate: string } {
  const now = new Date();
  let start: Date;
  switch (period) {
    case "week": {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      start.setDate(start.getDate() - start.getDay());
      break;
    }
    case "quarter": {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), quarterMonth, 1);
      break;
    }
    case "year":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case "last12":
      start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    case "month":
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }
  return { startDate: start.toISOString(), endDate: now.toISOString() };
}

interface ProfitSnapshot {
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
  labourCostThisMonth: number;
  materialCostThisMonth: number;
  grossProfit: number;
  grossMargin: number;
  cashCollectedToday: number;
}

interface CashflowData {
  thisMonthCollected: number;
  lastMonthCollected: number;
  dueThisWeek: number;
  overdueTotal: number;
  overdueCount: number;
  overdueBreakdown: any[];
  weeklyCollections: any[];
}

interface KPIData {
  jobsToday: number;
  unpaidInvoicesCount: number;
  unpaidInvoicesTotal: number;
  quotesAwaiting: number;
  jobsToInvoice: number;
  weeklyEarnings: number;
  monthlyEarnings: number;
  activeJobs: number;
  scheduledJobs: number;
  paidInvoicesCount: number;
  paidInvoicesTotal: number;
}

// Server payloads can arrive partial (sparse or freshly imported data).
// Normalise the whole object once with safe defaults so the page never
// renders NaN/undefined or broken charts.
const num = (v: any): number => (typeof v === "number" && isFinite(v) ? v : Number(v) || 0);

function normalizeProfit(p: any): ProfitSnapshot {
  return {
    revenueToday: num(p?.revenueToday),
    revenueThisWeek: num(p?.revenueThisWeek),
    revenueThisMonth: num(p?.revenueThisMonth),
    labourCostThisMonth: num(p?.labourCostThisMonth),
    materialCostThisMonth: num(p?.materialCostThisMonth),
    grossProfit: num(p?.grossProfit),
    grossMargin: num(p?.grossMargin),
    cashCollectedToday: num(p?.cashCollectedToday),
  };
}

function normalizeCashflow(c: any): CashflowData {
  return {
    thisMonthCollected: num(c?.thisMonthCollected ?? c?.collectedThisMonth),
    lastMonthCollected: num(c?.lastMonthCollected ?? c?.collectedLastMonth),
    dueThisWeek: num(c?.dueThisWeek),
    overdueTotal: num(c?.overdueTotal),
    overdueCount: num(c?.overdueCount),
    overdueBreakdown: Array.isArray(c?.overdueBreakdown) ? c.overdueBreakdown : [],
    weeklyCollections: Array.isArray(c?.weeklyCollections) ? c.weeklyCollections : [],
  };
}

function normalizeKpis(k: any): KPIData {
  return {
    jobsToday: num(k?.jobsToday),
    unpaidInvoicesCount: num(k?.unpaidInvoicesCount),
    unpaidInvoicesTotal: num(k?.unpaidInvoicesTotal),
    quotesAwaiting: num(k?.quotesAwaiting),
    jobsToInvoice: num(k?.jobsToInvoice),
    weeklyEarnings: num(k?.weeklyEarnings),
    monthlyEarnings: num(k?.monthlyEarnings),
    activeJobs: num(k?.activeJobs),
    scheduledJobs: num(k?.scheduledJobs),
    paidInvoicesCount: num(k?.paidInvoicesCount),
    paidInvoicesTotal: num(k?.paidInvoicesTotal),
  };
}

interface MonthlyRevenue {
  year: number;
  months: Array<{ month: string; revenue: number; gst: number; invoicesPaid: number }>;
  yearTotal: number;
  yearGst: number;
}

const tabs = [
  { id: "profit", label: "Profit & Margin", icon: DollarSign },
  { id: "cashflow", label: "Cashflow", icon: BarChart3 },
  { id: "efficiency", label: "Time & Efficiency", icon: Clock },
  { id: "growth", label: "Growth & Clients", icon: Users },
] as const;

type TabId = (typeof tabs)[number]["id"];

const fmtAud = (n: number) =>
  "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtAudK = (n: number) => {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
};

function getMarginColor(margin: number): string {
  if (margin > 30) return "hsl(142.1 76.2% 36.3%)";
  if (margin >= 15) return "hsl(38 92% 50%)";
  return "hsl(0 84.2% 60.2%)";
}

function HeroMetricCard({
  label, value, icon: Icon, context, valueColor, onClick, animClass,
}: {
  label: string; value: string; icon?: typeof DollarSign; context?: string;
  valueColor?: string; onClick?: () => void; animClass?: string;
}) {
  return (
    <div
      className={`feed-card card-press ${onClick ? "cursor-pointer" : ""} ${animClass || ""}`}
      style={{ opacity: animClass ? 0 : 1 }}
      onClick={onClick}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="ios-label">{label}</p>
            <p className="text-[32px] sm:text-[36px] font-bold tracking-tight mt-1.5 leading-none"
              style={valueColor ? { color: valueColor } : undefined}>
              {value}
            </p>
            {context && <p className="ios-caption mt-2">{context}</p>}
          </div>
          <div className="flex items-center gap-2">
            {Icon && (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "hsl(var(--trade) / 0.1)" }}>
                <Icon className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
              </div>
            )}
            {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label, value, icon: Icon, context, valueColor, onClick, animClass, iconBg, iconColor,
}: {
  label: string; value: string; icon?: typeof DollarSign; context?: string;
  valueColor?: string; onClick?: () => void; animClass?: string; iconBg?: string; iconColor?: string;
}) {
  return (
    <div
      className={`feed-card card-press ${onClick ? "cursor-pointer" : ""} ${animClass || ""}`}
      style={{ opacity: animClass ? 0 : 1 }}
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="ios-label">{label}</p>
            <p className="text-2xl font-bold mt-1" style={valueColor ? { color: valueColor } : undefined}>
              {value}
            </p>
            {context && <p className="ios-caption mt-1">{context}</p>}
          </div>
          <div className="flex items-center gap-2">
            {Icon && (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: iconBg || "hsl(var(--trade) / 0.1)" }}>
                <Icon className="h-5 w-5" style={{ color: iconColor || "hsl(var(--trade))" }} />
              </div>
            )}
            {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartTooltipContent({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 shadow-sm text-xs">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

function MarginArc({ margin }: { margin: number }) {
  const color = getMarginColor(margin);
  const capped = Math.min(margin, 100);
  const data = [
    { value: capped, fill: color },
    { value: Math.max(0, 100 - capped), fill: "hsl(var(--muted))" },
  ];
  return (
    <div className="feed-card p-4 animate-fade-up stagger-delay-2" style={{ opacity: 0 }}>
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0" style={{ width: 80, height: 80 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPie>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                startAngle={180}
                endAngle={0}
                innerRadius={28}
                outerRadius={38}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
            </RechartsPie>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center" style={{ marginTop: 12 }}>
            <span className="text-sm font-bold" style={{ color }}>{margin.toFixed(0)}%</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="ios-label">GROSS MARGIN</p>
          <p className="text-2xl font-bold mt-0.5" style={{ color }}>{margin.toFixed(1)}%</p>
          <p className="ios-caption mt-1">
            {margin > 30 ? "Healthy margin" : margin >= 15 ? "Room to improve" : "Needs attention"}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </div>
    </div>
  );
}

function CostBreakdownBar({
  revenue, grossProfit, labourCost, materialCost,
}: {
  revenue: number; grossProfit: number; labourCost: number; materialCost: number;
}) {
  const data = [
    { name: "Revenue", value: revenue },
    { name: "Gross Profit", value: grossProfit },
    { name: "Labour", value: labourCost },
    { name: "Materials", value: materialCost },
  ];

  const colors = [
    "hsl(var(--trade))",
    "hsl(142.1 76.2% 36.3%)",
    "hsl(38 92% 50%)",
    "hsl(262 83% 58%)",
  ];

  return (
    <div className="feed-card p-4 animate-fade-up stagger-delay-4" style={{ opacity: 0 }}>
      <p className="ios-label mb-3">COST BREAKDOWN</p>
      <ResponsiveContainer width="100%" height={110}>
        <BarChart data={data} barSize={28} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={fmtAudK} />
          <Tooltip content={<ChartTooltipContent formatter={fmtAud} />} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={colors[i]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RevenueChart({ months }: { months: Array<{ month: string; revenue: number }> }) {
  const recent = months.slice(-6);
  return (
    <div className="feed-card p-4 animate-fade-up stagger-delay-3" style={{ opacity: 0 }}>
      <p className="ios-label mb-3">REVENUE TREND (6 MONTHS)</p>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={recent} barSize={20} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={fmtAudK} />
          <Tooltip content={<ChartTooltipContent formatter={fmtAud} />} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
          <Bar dataKey="revenue" fill="hsl(var(--trade))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CashflowComparisonChart({
  thisMonth, lastMonth, dueThisWeek, overdueTotal,
}: {
  thisMonth: number; lastMonth: number; dueThisWeek: number; overdueTotal: number;
}) {
  const data = [
    { name: "Prior Period", value: lastMonth, fill: "hsl(var(--muted-foreground) / 0.5)" },
    { name: "This Period", value: thisMonth, fill: "hsl(var(--trade))" },
    { name: "Due This Week", value: dueThisWeek, fill: "hsl(38 92% 50%)" },
    { name: "Overdue", value: overdueTotal, fill: "hsl(0 84.2% 60.2%)" },
  ];

  return (
    <div className="feed-card p-4 animate-fade-up stagger-delay-3" style={{ opacity: 0 }}>
      <p className="ios-label mb-3">CASHFLOW OVERVIEW</p>
      <ResponsiveContainer width="100%" height={130}>
        <BarChart data={data} barSize={32} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={fmtAudK} />
          <Tooltip content={<ChartTooltipContent formatter={fmtAud} />} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function QuoteConversionDonut({ awaiting, total }: { awaiting: number; total: number }) {
  const responded = Math.max(0, total - awaiting);
  const data = [
    { name: "Responded", value: responded, fill: "hsl(var(--trade))" },
    { name: "Awaiting", value: awaiting, fill: "hsl(38 92% 50%)" },
  ];
  const rate = total > 0 ? Math.round((responded / total) * 100) : 0;

  return (
    <div className="feed-card p-4 animate-fade-up stagger-delay-3" style={{ opacity: 0 }}>
      <p className="ios-label mb-3">QUOTE PIPELINE</p>
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0" style={{ width: 90, height: 90 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPie>
              <Pie data={total > 0 ? data : [{ name: "None", value: 1, fill: "hsl(var(--muted))" }]}
                cx="50%" cy="50%" innerRadius={28} outerRadius={40} dataKey="value" strokeWidth={0}>
                {(total > 0 ? data : []).map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
            </RechartsPie>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-bold text-foreground">{rate}%</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: "hsl(var(--trade))" }} />
            <span className="text-muted-foreground">Responded</span>
            <span className="font-semibold ml-auto">{responded}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: "hsl(38 92% 50%)" }} />
            <span className="text-muted-foreground">Awaiting</span>
            <span className="font-semibold ml-auto">{awaiting}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-muted" />
            <span className="text-muted-foreground">Total Sent</span>
            <span className="font-semibold ml-auto">{total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PipelineStrip({
  stages, onNavigate,
}: {
  stages: Array<{ label: string; count: number; color: string; path: string }>;
  onNavigate?: (path: string) => void;
}) {
  const allEmpty = stages.every(s => s.count === 0);
  return (
    <div className="feed-card p-4 animate-fade-up stagger-delay-1" style={{ opacity: 0 }} data-testid="pipeline-strip">
      <p className="ios-label mb-3">JOB PIPELINE</p>
      {allEmpty ? (
        <p className="ios-caption">As quotes go out and jobs get done, you'll see your work move through the pipeline here.</p>
      ) : (
        <div className="flex items-stretch gap-1.5 overflow-x-auto no-scrollbar">
          {stages.map((stage, i) => (
            <div key={stage.label} className="flex items-stretch gap-1.5 flex-1 min-w-0">
              <button
                type="button"
                className="flex-1 min-w-[72px] rounded-xl px-2 py-2.5 text-center card-press cursor-pointer"
                style={{ backgroundColor: `${stage.color.replace(")", " / 0.08)")}` }}
                onClick={() => onNavigate?.(stage.path)}
                data-testid={`pipeline-stage-${i}`}
              >
                <p className="text-xl font-bold leading-none" style={{ color: stage.color }}>{stage.count}</p>
                <p className="text-[10px] font-medium text-muted-foreground mt-1.5 leading-tight">{stage.label}</p>
              </button>
              {i < stages.length - 1 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0 self-center" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyChartHint({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="feed-card p-4 animate-fade-up stagger-delay-3" style={{ opacity: 0 }}>
      <p className="ios-label mb-2">{label}</p>
      <div className="py-6 text-center">
        <LineChartIcon className="h-6 w-6 mx-auto mb-2 text-muted-foreground/50" />
        <p className="ios-caption max-w-[240px] mx-auto">{hint}</p>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="section-gap">
      <div className="feed-card p-5">
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-9 w-32 mb-2" />
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="feed-card p-4">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-7 w-16 mb-1" />
          </div>
        ))}
      </div>
      <div className="feed-card p-4">
        <Skeleton className="h-3 w-28 mb-3" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
    </div>
  );
}

export default function Insights({ onNavigate }: InsightsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("profit");
  const [period, setPeriod] = useState<PeriodId>("month");
  const searchParams = useSearch();

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const tabParam = params.get('tab');
    if (tabParam && tabs.some(t => t.id === tabParam)) {
      setActiveTab(tabParam as TabId);
    }
  }, [searchParams]);

  const range = getPeriodRange(period);
  const rangeQs = `startDate=${encodeURIComponent(range.startDate)}&endDate=${encodeURIComponent(range.endDate)}`;
  const periodLabel = periods.find(p => p.id === period)?.shortLabel ?? "this month";

  const fetchJson = async (url: string) => {
    const res = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch ${url}`);
    return res.json();
  };

  const { data: profitRaw, isLoading: profitLoading } = useQuery<any>({
    queryKey: ["/api/dashboard/profit-snapshot", period],
    queryFn: () => fetchJson(`/api/dashboard/profit-snapshot?${rangeQs}`),
  });

  const { data: cashflowRaw, isLoading: cashflowLoading } = useQuery<any>({
    queryKey: ["/api/dashboard/cashflow", period],
    queryFn: () => fetchJson(`/api/dashboard/cashflow?${rangeQs}`),
  });

  const { data: kpisRaw, isLoading: kpisLoading } = useQuery<any>({
    queryKey: ["/api/dashboard/kpis", "insights", period],
    queryFn: () => fetchJson(`/api/dashboard/kpis?${rangeQs}`),
  });

  const profit = profitRaw ? normalizeProfit(profitRaw) : undefined;
  const cashflow = cashflowRaw ? normalizeCashflow(cashflowRaw) : undefined;
  const kpis = kpisRaw ? normalizeKpis(kpisRaw) : undefined;

  const { data: revenueData } = useQuery<MonthlyRevenue>({
    queryKey: ['/api/reports/revenue', new Date().getFullYear().toString()],
    queryFn: async () => {
      const res = await fetch(`/api/reports/revenue?year=${new Date().getFullYear()}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch revenue');
      return res.json();
    },
  });

  const { data: quotesData } = useQuery<any>({
    queryKey: ["/api/quotes"],
  });

  const isLoading = profitLoading || cashflowLoading || kpisLoading;

  const collectionDiff = (cashflow?.thisMonthCollected ?? 0) - (cashflow?.lastMonthCollected ?? 0);
  const collectionUp = collectionDiff >= 0;

  const totalQuotesSent = Array.isArray(quotesData)
    ? quotesData.filter((q: any) => q.status !== 'draft').length
    : 0;

  const hasNoData = !isLoading
    && !profit?.revenueThisMonth
    && !kpis?.monthlyEarnings
    && !kpis?.weeklyEarnings
    && !kpis?.jobsToday
    && !kpis?.unpaidInvoicesCount
    && !kpis?.quotesAwaiting
    && !kpis?.jobsToInvoice
    && !cashflow?.thisMonthCollected
    && !cashflow?.lastMonthCollected
    && totalQuotesSent === 0;

  return (
    <div className="w-full px-4 sm:px-5 md:px-6 py-5 sm:py-6 section-gap pb-28 md:pb-6">
      <div className="space-y-1">
        <h1 className="ios-title">Insights</h1>
        <p className="ios-caption mt-0.5">Business health at a glance</p>
      </div>

      {!hasNoData && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar" data-testid="period-picker">
          {periods.map((p) => {
            const isActive = period === p.id;
            return isActive ? (
              <Button key={p.id} size="sm" className="text-white font-medium flex-shrink-0 rounded-full"
                style={{ backgroundColor: "hsl(var(--trade))", borderColor: "hsl(var(--trade))" }}
                onClick={() => setPeriod(p.id)} data-testid={`period-${p.id}`}>
                {p.label}
              </Button>
            ) : (
              <Button key={p.id} variant="outline" size="sm" className="flex-shrink-0 rounded-full"
                onClick={() => setPeriod(p.id)} data-testid={`period-${p.id}`}>
                {p.label}
              </Button>
            );
          })}
        </div>
      )}

      {!hasNoData && !isLoading && (
        <PipelineStrip
          onNavigate={onNavigate}
          stages={[
            { label: "Quotes awaiting", count: kpis?.quotesAwaiting ?? 0, color: "hsl(38 92% 50%)", path: "/documents?tab=quotes" },
            { label: "Scheduled", count: kpis?.scheduledJobs ?? 0, color: "hsl(217 91% 60%)", path: "/work" },
            { label: "In progress", count: kpis?.activeJobs ?? 0, color: "hsl(262 83% 58%)", path: "/work" },
            { label: "To invoice", count: kpis?.jobsToInvoice ?? 0, color: "hsl(0 84.2% 60.2%)", path: "/work" },
            { label: "Paid", count: kpis?.paidInvoicesCount ?? 0, color: "hsl(142.1 76.2% 36.3%)", path: "/documents?tab=invoices&filter=paid" },
          ]}
        />
      )}

      {!hasNoData && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const TabIcon = tab.icon;
            return isActive ? (
              <Button key={tab.id} size="sm" className="text-white font-medium flex-shrink-0"
                style={{ backgroundColor: "hsl(var(--trade))", borderColor: "hsl(var(--trade))" }}
                onClick={() => setActiveTab(tab.id)}>
                <TabIcon className="h-3.5 w-3.5 mr-1.5" />
                {tab.label}
              </Button>
            ) : (
              <Button key={tab.id} variant="ghost" size="sm" className="flex-shrink-0" onClick={() => setActiveTab(tab.id)}>
                <TabIcon className="h-3.5 w-3.5 mr-1.5" />
                {tab.label}
              </Button>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <SkeletonGrid />
      ) : hasNoData ? (
        <div className="feed-card animate-fade-up">
          <div className="py-16 text-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "linear-gradient(135deg, hsl(var(--trade) / 0.12), hsl(var(--trade) / 0.06))" }}
            >
              <BarChart3 className="h-10 w-10" style={{ color: "hsl(var(--trade))" }} />
            </div>
            <p className="text-lg font-semibold text-foreground mb-1">No insights yet</p>
            <p className="ios-caption max-w-xs mx-auto">Create your first job, quote, or invoice and your numbers will start showing up here.</p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button size="sm" className="text-white" style={{ backgroundColor: "hsl(var(--trade))" }}
                onClick={() => onNavigate?.("/work")} data-testid="button-empty-create-job">
                Create a job
              </Button>
              <Button variant="outline" size="sm" onClick={() => onNavigate?.("/settings")} data-testid="button-empty-import">
                Import your data
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {activeTab === "profit" && (
            <div className="section-gap">
              <HeroMetricCard
                label={`REVENUE ${periodLabel.toUpperCase()}`}
                value={fmtAud(profit?.revenueThisMonth ?? 0)}
                icon={DollarSign}
                context={`This week: ${fmtAud(profit?.revenueThisWeek ?? 0)}`}
                onClick={() => onNavigate?.("/documents?tab=invoices&filter=paid")}
                animClass="animate-fade-up stagger-delay-1"
              />

              <MetricCard
                label="GROSS PROFIT"
                value={fmtAud(profit?.grossProfit ?? 0)}
                icon={TrendingUp}
                valueColor="hsl(142.1 76.2% 36.3%)"
                context={`After labour & materials`}
                onClick={() => onNavigate?.("/profitability-report")}
                animClass="animate-fade-up stagger-delay-2"
                iconBg="hsl(142.1 76.2% 36.3% / 0.1)"
                iconColor="hsl(142.1 76.2% 36.3%)"
              />

              <MarginArc margin={profit?.grossMargin ?? 0} />

              {revenueData?.months && revenueData.months.some(m => (m.revenue ?? 0) > 0) ? (
                <RevenueChart months={revenueData.months} />
              ) : (
                <EmptyChartHint
                  label="REVENUE TREND (6 MONTHS)"
                  hint="Your revenue trend will appear here once invoices start getting paid."
                />
              )}

              <div>
                <p className="ios-label mb-3">COSTS {periodLabel.toUpperCase()}</p>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    label="LABOUR COST"
                    value={fmtAud(profit?.labourCostThisMonth ?? 0)}
                    icon={Clock}
                    context={periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)}
                    onClick={() => onNavigate?.("/time-tracking")}
                    animClass="animate-fade-up stagger-delay-5"
                    iconBg="hsl(38 92% 50% / 0.1)"
                    iconColor="hsl(38 92% 50%)"
                  />
                  <MetricCard
                    label="MATERIAL COST"
                    value={fmtAud(profit?.materialCostThisMonth ?? 0)}
                    icon={BarChart3}
                    context={periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)}
                    onClick={() => onNavigate?.("/work")}
                    animClass="animate-fade-up stagger-delay-6"
                    iconBg="hsl(262 83% 58% / 0.1)"
                    iconColor="hsl(262 83% 58%)"
                  />
                </div>
              </div>

              <CostBreakdownBar
                revenue={profit?.revenueThisMonth ?? 0}
                grossProfit={profit?.grossProfit ?? 0}
                labourCost={profit?.labourCostThisMonth ?? 0}
                materialCost={profit?.materialCostThisMonth ?? 0}
              />

              <div
                className="feed-card card-press cursor-pointer animate-fade-up stagger-delay-5"
                style={{ opacity: 0 }}
                onClick={() => onNavigate?.("/profitability-report?tab=by-job-type")}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="ios-label">MARGIN BY JOB TYPE</p>
                      <p className="text-sm text-muted-foreground mt-1">See which types of jobs are most profitable</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: "hsl(var(--trade) / 0.1)" }}>
                        <PieChart className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "cashflow" && (
            <div className="section-gap">
              <HeroMetricCard
                label="CASH COLLECTED TODAY"
                value={fmtAud(profit?.cashCollectedToday ?? 0)}
                icon={DollarSign}
                onClick={() => onNavigate?.("/documents?tab=invoices&filter=paid")}
                animClass="animate-fade-up stagger-delay-1"
              />

              <div
                className="feed-card card-press cursor-pointer animate-fade-up stagger-delay-2"
                style={{ opacity: 0 }}
                onClick={() => onNavigate?.("/documents?tab=invoices&filter=paid")}
              >
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="ios-label mb-1">COLLECTED {periodLabel.toUpperCase()}</p>
                      <p className="text-xl font-bold">{fmtAud(cashflow?.thisMonthCollected ?? 0)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {collectionUp
                        ? <ArrowUpRight className="h-5 w-5" style={{ color: "hsl(142.1 76.2% 36.3%)" }} />
                        : <ArrowDownRight className="h-5 w-5" style={{ color: "hsl(0 84.2% 60.2%)" }} />}
                      <span className="text-sm font-semibold" style={{ color: collectionUp ? "hsl(142.1 76.2% 36.3%)" : "hsl(0 84.2% 60.2%)" }}>
                        {fmtAud(Math.abs(collectionDiff))} vs prior period
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <CashflowComparisonChart
                thisMonth={cashflow?.thisMonthCollected ?? 0}
                lastMonth={cashflow?.lastMonthCollected ?? 0}
                dueThisWeek={cashflow?.dueThisWeek ?? 0}
                overdueTotal={cashflow?.overdueTotal ?? 0}
              />

              <div>
                <p className="ios-label mb-3">OUTSTANDING</p>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    label="DUE THIS WEEK"
                    value={fmtAud(cashflow?.dueThisWeek ?? 0)}
                    icon={Clock}
                    onClick={() => onNavigate?.("/documents?tab=invoices&filter=unpaid")}
                    animClass="animate-fade-up stagger-delay-4"
                    iconBg="hsl(38 92% 50% / 0.1)"
                    iconColor="hsl(38 92% 50%)"
                  />
                  <div className="relative">
                    <MetricCard
                      label="OVERDUE TOTAL"
                      value={fmtAud(cashflow?.overdueTotal ?? 0)}
                      icon={TrendingDown}
                      valueColor={(cashflow?.overdueTotal ?? 0) > 0 ? "hsl(0 84.2% 60.2%)" : undefined}
                      onClick={() => onNavigate?.("/documents?tab=invoices&filter=overdue")}
                      animClass="animate-fade-up stagger-delay-5"
                      iconBg="hsl(0 84.2% 60.2% / 0.1)"
                      iconColor="hsl(0 84.2% 60.2%)"
                    />
                    {(cashflow?.overdueCount ?? 0) > 0 && (
                      <div className="absolute top-3 right-3">
                        <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-xs no-default-hover-elevate no-default-active-elevate">
                          {cashflow?.overdueCount} overdue
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "efficiency" && (
            <div className="section-gap">
              <HeroMetricCard
                label={`EARNINGS ${periodLabel.toUpperCase()}`}
                value={fmtAud(kpis?.monthlyEarnings ?? 0)}
                icon={DollarSign}
                onClick={() => onNavigate?.("/time-tracking")}
                animClass="animate-fade-up stagger-delay-1"
              />

              <div>
                <p className="ios-label mb-3">ACTIVITY</p>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    label="JOBS TODAY"
                    value={String(kpis?.jobsToday ?? 0)}
                    icon={Clock}
                    onClick={() => onNavigate?.("/work")}
                    animClass="animate-fade-up stagger-delay-2"
                  />
                  <MetricCard
                    label="WEEKLY EARNINGS"
                    value={fmtAud(kpis?.weeklyEarnings ?? 0)}
                    icon={TrendingUp}
                    onClick={() => onNavigate?.("/time-tracking")}
                    animClass="animate-fade-up stagger-delay-3"
                    iconBg="hsl(142.1 76.2% 36.3% / 0.1)"
                    iconColor="hsl(142.1 76.2% 36.3%)"
                  />
                  <MetricCard
                    label="JOBS TO INVOICE"
                    value={String(kpis?.jobsToInvoice ?? 0)}
                    icon={BarChart3}
                    valueColor={(kpis?.jobsToInvoice ?? 0) > 0 ? "hsl(38 92% 50%)" : undefined}
                    context={(kpis?.jobsToInvoice ?? 0) > 0 ? "Completed, not yet invoiced" : "All caught up"}
                    onClick={() => onNavigate?.("/work")}
                    animClass="animate-fade-up stagger-delay-4"
                    iconBg="hsl(38 92% 50% / 0.1)"
                    iconColor="hsl(38 92% 50%)"
                  />
                  <MetricCard
                    label="UNPAID INVOICES"
                    value={String(kpis?.unpaidInvoicesCount ?? 0)}
                    icon={DollarSign}
                    context={fmtAud(kpis?.unpaidInvoicesTotal ?? 0) + " total"}
                    valueColor={(kpis?.unpaidInvoicesCount ?? 0) > 0 ? "hsl(0 84.2% 60.2%)" : undefined}
                    onClick={() => onNavigate?.("/documents?tab=invoices&filter=unpaid")}
                    animClass="animate-fade-up stagger-delay-5"
                    iconBg="hsl(0 84.2% 60.2% / 0.1)"
                    iconColor="hsl(0 84.2% 60.2%)"
                  />
                </div>
              </div>

              {revenueData?.months && revenueData.months.some(m => (m.revenue ?? 0) > 0) ? (
                <RevenueChart months={revenueData.months} />
              ) : (
                <EmptyChartHint
                  label="REVENUE TREND (6 MONTHS)"
                  hint="Your revenue trend will appear here once invoices start getting paid."
                />
              )}
            </div>
          )}

          {activeTab === "growth" && (
            <div className="section-gap">
              <HeroMetricCard
                label="QUOTES AWAITING"
                value={String(kpis?.quotesAwaiting ?? 0)}
                icon={Users}
                context="Sent, awaiting response"
                onClick={() => onNavigate?.("/documents?tab=quotes")}
                animClass="animate-fade-up stagger-delay-1"
              />

              <QuoteConversionDonut
                awaiting={kpis?.quotesAwaiting ?? 0}
                total={totalQuotesSent}
              />

              <div>
                <p className="ios-label mb-3">RECEIVABLES</p>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    label="UNPAID INVOICES"
                    value={String(kpis?.unpaidInvoicesCount ?? 0)}
                    icon={DollarSign}
                    context={fmtAud(kpis?.unpaidInvoicesTotal ?? 0) + " total"}
                    valueColor={(kpis?.unpaidInvoicesCount ?? 0) > 0 ? "hsl(0 84.2% 60.2%)" : undefined}
                    onClick={() => onNavigate?.("/documents?tab=invoices&filter=unpaid")}
                    animClass="animate-fade-up stagger-delay-4"
                    iconBg="hsl(0 84.2% 60.2% / 0.1)"
                    iconColor="hsl(0 84.2% 60.2%)"
                  />
                  <MetricCard
                    label="JOBS TO INVOICE"
                    value={String(kpis?.jobsToInvoice ?? 0)}
                    icon={BarChart3}
                    valueColor={(kpis?.jobsToInvoice ?? 0) > 0 ? "hsl(38 92% 50%)" : undefined}
                    context={(kpis?.jobsToInvoice ?? 0) > 0 ? "Needs invoicing" : "All caught up"}
                    onClick={() => onNavigate?.("/work")}
                    animClass="animate-fade-up stagger-delay-5"
                    iconBg="hsl(38 92% 50% / 0.1)"
                    iconColor="hsl(38 92% 50%)"
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div>
        <p className="ios-label mb-3">DETAILED REPORTS</p>
        <div className="feed-gap">
          <div
            className="feed-card card-press cursor-pointer animate-fade-up stagger-delay-6"
            style={{ opacity: 0 }}
            onClick={() => onNavigate?.("/reports")}
          >
            <div className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "hsl(var(--trade) / 0.1)" }}>
                    <FileBarChart className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Reports</p>
                    <p className="ios-caption">Full financials, charts, and exports</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-xs no-default-hover-elevate no-default-active-elevate">
                    Full view
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>

          <div
            className="feed-card card-press cursor-pointer animate-fade-up stagger-delay-7"
            style={{ opacity: 0 }}
            onClick={() => onNavigate?.("/reports/profitability")}
          >
            <div className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "hsl(142.1 76.2% 36.3% / 0.1)" }}>
                    <PieChart className="h-5 w-5" style={{ color: "hsl(142.1 76.2% 36.3%)" }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Profitability Report</p>
                    <p className="ios-caption">By job, client, and worker</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
