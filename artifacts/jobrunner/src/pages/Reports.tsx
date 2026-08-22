import { useState, useEffect } from "react";
import { getAuthHeaders } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageShell, PageHeader, SectionTitle } from "@/components/ui/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  FileText, 
  Users, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  BarChart3,
  CreditCard,
  Wallet,
  ArrowUpRight,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Banknote,
  Receipt,
  FileCheck,
  ChevronRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
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
  PieChart,
  Pie,
  Cell
} from "recharts";

interface ReportSummary {
  period: { start: string; end: string };
  revenue: {
    total: number;
    pending: number;
    overdue: number;
    gstCollected: number;
  };
  jobs: {
    total: number;
    completed: number;
    inProgress: number;
  };
  quotes: {
    total: number;
    accepted: number;
    pending: number;
    conversionRate: number;
  };
  invoices: {
    total: number;
    paid: number;
    unpaid: number;
    overdue: number;
  };
}

interface MonthlyRevenue {
  year: number;
  months: Array<{
    month: string;
    revenue: number;
    gst: number;
    invoicesPaid: number;
  }>;
  yearTotal: number;
  yearGst: number;
}

interface ClientReport {
  clients: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    totalRevenue: number;
    outstandingBalance: number;
    jobsCompleted: number;
    invoicesPaid: number;
    invoicesOutstanding: number;
  }>;
  totals: {
    totalRevenue: number;
    totalOutstanding: number;
  };
}

interface StripePayment {
  id: string;
  amount: number;
  fee: number;
  net: number;
  status: string;
  paid: boolean;
  refunded: boolean;
  description: string;
  customer: string | null;
  paymentMethod: string;
  created: string;
  receiptUrl: string | null;
}

interface StripePayout {
  id: string;
  amount: number;
  status: string;
  arrivalDate: string | null;
  created: string;
  method: string;
  destination: string | null;
}

interface StripePaymentsReport {
  available: boolean;
  accountId?: string;
  message?: string;
  balance: {
    available: number;
    pending: number;
    currency: string;
  } | null;
  payments: StripePayment[];
  payouts: StripePayout[];
  totals?: {
    totalRevenue: number;
    totalFees: number;
    totalNet: number;
    paymentCount: number;
    refundedAmount: number;
  };
  period?: {
    start: string;
    end: string;
  };
}

interface TeamMemberPerformance {
  id: string;
  name: string;
  email: string;
  role: string;
  jobsAssigned: number;
  jobsCompleted: number;
  jobsInProgress: number;
  hoursWorked: number;
  timeEntryCount: number;
  avgHoursPerJob: number;
}

interface TeamReport {
  period: { start: string; end: string };
  members: TeamMemberPerformance[];
  totals: {
    totalMembers: number;
    totalJobsAssigned: number;
    totalJobsCompleted: number;
    totalHoursWorked: number;
    avgJobsPerMember: number;
  };
}

interface ComplianceDueReport {
  month: string;
  due: Array<{
    memberId: string;
    subcontractorId: string;
    name: string;
    compliance: { status: 'valid' | 'expiring_soon' | 'expired' };
    documents: Array<{ type: 'Licence' | 'Insurance'; expiry: string }>;
  }>;
}

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

const downloadCSV = (data: any[], filename: string): boolean => {
  if (data.length === 0) return false;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(h => {
        const value = row[h];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  return true;
};

const getBASQuarter = () => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const fyYear = month >= 6 ? year : year - 1;
  const quarter = month >= 6 && month <= 8 ? 1 : month >= 9 && month <= 11 ? 2 : month >= 0 && month <= 2 ? 3 : 4;
  return `Q${quarter} FY ${fyYear}-${(fyYear + 1).toString().slice(-2)}`;
};

function KPICardSkeleton() {
  return (
    <div className="feed-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-28" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
      <Skeleton className="h-3 w-24 mt-2" />
    </div>
  );
}

function HeroMetricSkeleton() {
  return (
    <div className="feed-card p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Skeleton className="h-12 w-12 rounded-xl" />
      </div>
      <Skeleton className="h-3 w-32 mt-3" />
    </div>
  );
}

function ExecutiveSummarySkeleton() {
  return (
    <div className="card-accent p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-40" />
      </div>
    </div>
  );
}

export default function Reports() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<'ytd' | 'month' | 'quarter' | 'year'>('ytd');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'revenue' | 'payments' | 'jobs' | 'clients' | 'team'>('revenue');

  const getDateRange = () => {
    const now = new Date();
    let start: Date;
    
    switch (dateRange) {
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), quarterMonth, 1);
        break;
      case 'year':
        start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case 'ytd':
      default:
        start = new Date(now.getFullYear(), 0, 1);
        break;
    }
    
    return { startDate: start.toISOString(), endDate: now.toISOString() };
  };

  const { data: summary, isLoading: summaryLoading, error: summaryError, refetch: refetchSummary, dataUpdatedAt: summaryUpdatedAt } = useQuery<ReportSummary>({
    queryKey: ['/api/reports/summary', dateRange],
    queryFn: async () => {
      const range = getDateRange();
      const res = await fetch(`/api/reports/summary?startDate=${range.startDate}&endDate=${range.endDate}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to fetch summary');
      return res.json();
    },
    retry: 1,
  });

  const { data: revenueData, isLoading: revenueLoading, refetch: refetchRevenue } = useQuery<MonthlyRevenue>({
    queryKey: ['/api/reports/revenue', selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/reports/revenue?year=${selectedYear}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to fetch revenue');
      return res.json();
    },
    retry: 1,
  });

  const { data: clientData, isLoading: clientsLoading, refetch: refetchClients } = useQuery<ClientReport>({
    queryKey: ['/api/reports/clients'],
    queryFn: async () => {
      const res = await fetch('/api/reports/clients?limit=10', {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to fetch clients');
      return res.json();
    },
    retry: 1,
  });

  const { data: stripeData, isLoading: stripeLoading, refetch: refetchStripe } = useQuery<StripePaymentsReport>({
    queryKey: ['/api/reports/stripe-payments', dateRange],
    queryFn: async () => {
      const range = getDateRange();
      const res = await fetch(`/api/reports/stripe-payments?startDate=${range.startDate}&endDate=${range.endDate}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to fetch Stripe payments');
      return res.json();
    },
    retry: 1,
  });

  const { data: teamData, isLoading: teamLoading, refetch: refetchTeam } = useQuery<TeamReport>({
    queryKey: ['/api/reports/team', dateRange],
    queryFn: async () => {
      const range = getDateRange();
      const res = await fetch(`/api/reports/team?startDate=${range.startDate}&endDate=${range.endDate}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        if (res.status === 403) return null;
        throw new Error('Failed to fetch team report');
      }
      return res.json();
    },
    retry: 1,
  });

  const { data: complianceDue, isLoading: complianceDueLoading } = useQuery<ComplianceDueReport>({
    queryKey: ['/api/reports/compliance-due'],
    queryFn: async () => {
      const res = await fetch('/api/reports/compliance-due', {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        if (res.status === 403) return { month: '', due: [] };
        throw new Error('Failed to fetch compliance due report');
      }
      return res.json();
    },
    retry: 1,
  });

  useEffect(() => {
    if (summaryUpdatedAt) {
      setLastRefreshed(new Date(summaryUpdatedAt));
    }
  }, [summaryUpdatedAt]);

  const handleRefreshAll = async () => {
    await Promise.all([
      refetchSummary(),
      refetchRevenue(),
      refetchClients(),
      refetchStripe(),
      refetchTeam()
    ]);
    setLastRefreshed(new Date());
    toast({
      title: "Data refreshed",
      description: "All reports have been updated with the latest figures.",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleExportRevenue = () => {
    if (revenueData?.months && revenueData.months.length > 0) {
      const exportData = revenueData.months.map(m => ({
        Month: m.month,
        'Revenue (AUD)': m.revenue,
        'GST (AUD)': m.gst,
        'Invoices Paid': m.invoicesPaid
      }));
      const success = downloadCSV(exportData, `revenue_report_${selectedYear}`);
      if (success) {
        toast({
          title: "Export complete",
          description: `Revenue report for ${selectedYear} has been downloaded.`,
        });
      }
    }
  };

  const handleExportClients = () => {
    if (clientData?.clients && clientData.clients.length > 0) {
      const exportData = clientData.clients.map(c => ({
        Name: c.name,
        Email: c.email,
        Phone: c.phone || '',
        'Revenue (AUD)': c.totalRevenue,
        'Outstanding (AUD)': c.outstandingBalance,
        'Jobs Completed': c.jobsCompleted
      }));
      const success = downloadCSV(exportData, 'client_report');
      if (success) {
        toast({
          title: "Export complete",
          description: "Client report has been downloaded.",
        });
      }
    }
  };

  const jobPieData = summary ? [
    { name: 'Completed', value: summary.jobs.completed, color: 'hsl(var(--chart-1))' },
    { name: 'In Progress', value: summary.jobs.inProgress, color: 'hsl(var(--chart-2))' },
    { name: 'Other', value: summary.jobs.total - summary.jobs.completed - summary.jobs.inProgress, color: 'hsl(var(--chart-3))' },
  ].filter(d => d.value > 0) : [];

  const getDateRangeLabel = () => {
    switch (dateRange) {
      case 'month': return 'this month';
      case 'quarter': return 'this quarter';
      case 'year': return 'the last 12 months';
      case 'ytd':
      default: return 'this financial year';
    }
  };

  const tabs = [
    { id: 'revenue' as const, label: 'Revenue', testId: 'tab-revenue' },
    { id: 'payments' as const, label: 'Payments', testId: 'tab-payments' },
    { id: 'jobs' as const, label: 'Jobs', testId: 'tab-jobs' },
    { id: 'clients' as const, label: 'Clients', testId: 'tab-clients' },
    ...(teamData !== null ? [{ id: 'team' as const, label: 'Team', testId: 'tab-team' }] : []),
  ];

  return (
    <PageShell>
      <PageHeader
        title="Reports"
        subtitle="Your business at a glance"
        leading={<BarChart3 className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />}
      />

      <div className="section-gap">
        <div className="feed-card p-3 animate-fade-up">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
                <SelectTrigger className="w-[180px]" data-testid="select-date-range">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                  <SelectItem value="ytd">Year to Date</SelectItem>
                  <SelectItem value="year">Last 12 Months</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Updated</span> {formatDistanceToNow(lastRefreshed, { addSuffix: true })}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleRefreshAll}
                  data-testid="button-refresh-all"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              data-testid="button-export-report"
              disabled={!revenueData?.months || revenueData.months.length === 0}
              onClick={handleExportRevenue}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Revenue
            </Button>
          </div>
        </div>

        {summaryLoading ? (
          <ExecutiveSummarySkeleton />
        ) : summary && (
          <div className="card-accent p-5 animate-fade-up stagger-delay-1">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold" data-testid="text-executive-summary">
                    You've banked {formatCurrency(summary.revenue.total)} {getDateRangeLabel()}
                  </h2>
                  <p className="ios-caption mt-0.5">
                    {summary.jobs.completed} jobs completed, {summary.invoices.paid} invoices paid
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge 
                  variant="outline" 
                  className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700"
                  data-testid="badge-gst-status"
                >
                  <Receipt className="h-3 w-3 mr-1" />
                  GST collected: {formatCurrency(summary.revenue.gstCollected)}
                </Badge>
                <Badge 
                  variant="outline" 
                  className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700"
                  data-testid="badge-bas-quarter"
                >
                  <FileCheck className="h-3 w-3 mr-1" />
                  BAS: {getBASQuarter()}
                </Badge>
              </div>
            </div>

            {(summary.invoices.overdue > 0 || summary.quotes.pending > 0) && (
              <div className="mt-4 pt-4 border-t border-border/30 space-y-2">
                {summary.invoices.overdue > 0 && (
                  <div 
                    className="feed-card card-press flex items-center justify-between gap-3 p-3 bg-red-50 dark:bg-red-900/20 cursor-pointer"
                    onClick={() => navigate('/invoices?status=overdue')}
                    data-testid="action-chase-overdue"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="font-medium text-red-700 dark:text-red-300">
                          Chase {summary.invoices.overdue} overdue invoice{summary.invoices.overdue !== 1 ? 's' : ''} worth {formatCurrency(summary.revenue.overdue)}
                        </p>
                        <p className="ios-caption text-red-600/80 dark:text-red-400/80">
                          Get on the blower and chase that cash today
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                  </div>
                )}
                
                {summary.quotes.pending > 0 && (
                  <div 
                    className="feed-card card-press flex items-center justify-between gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 cursor-pointer"
                    onClick={() => navigate('/quotes?status=pending')}
                    data-testid="action-follow-quotes"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div>
                        <p className="font-medium text-yellow-700 dark:text-yellow-300">
                          Follow up on {summary.quotes.pending} pending quote{summary.quotes.pending !== 1 ? 's' : ''}
                        </p>
                        <p className="ios-caption text-yellow-600/80 dark:text-yellow-400/80">
                          Give them a nudge before they go cold
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-5">
          <SectionTitle>Compliance due this month</SectionTitle>
          <Card className="mt-3">
            <CardContent className="p-4">
              {complianceDueLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (complianceDue?.due.length ?? 0) === 0 ? (
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <p className="text-sm text-muted-foreground">No subcontractor licence or insurance renewals are due in {complianceDue?.month}.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Renewals due in {complianceDue?.month}. Keep subcontractor documents current before payment.
                  </p>
                  {complianceDue?.due.map((item) => (
                    <div key={item.memberId} className="flex items-center justify-between gap-3 border-t pt-3 first:border-t-0 first:pt-0">
                      <div>
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.documents.map((document) => `${document.type}: ${format(new Date(`${document.expiry}T00:00:00`), 'd MMM')}`).join(' · ')}
                        </p>
                      </div>
                      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 whitespace-nowrap">
                        Expiring Soon
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <SectionTitle>Key Metrics</SectionTitle>
          <div className="mt-3">
            {summaryLoading ? (
              <div className="space-y-3">
                <HeroMetricSkeleton />
                <div className="grid grid-cols-2 gap-3">
                  <KPICardSkeleton />
                  <KPICardSkeleton />
                  <KPICardSkeleton />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="feed-card card-press p-5 animate-fade-up stagger-delay-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="ios-label">Total Revenue</p>
                      <p className="text-[32px] font-bold tracking-tight leading-tight mt-1" data-testid="text-total-revenue">
                        {formatCurrency(summary?.revenue.total || 0)}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ backgroundColor: 'hsl(var(--success) / 0.1)' }}>
                      <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                  <p className="ios-caption mt-2">
                    Incl. GST: {formatCurrency(summary?.revenue.gstCollected || 0)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="feed-card card-press p-4 animate-fade-up stagger-delay-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="ios-label">Pending</p>
                        <p className="text-xl font-bold mt-1" data-testid="text-pending-revenue">
                          {formatCurrency(summary?.revenue.pending || 0)}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                      </div>
                    </div>
                    <p className="ios-caption mt-1">
                      {summary?.invoices.unpaid || 0} unpaid invoices
                    </p>
                  </div>

                  <div className="feed-card card-press p-4 animate-fade-up stagger-delay-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="ios-label">Overdue</p>
                        <p className="text-xl font-bold text-red-600 mt-1" data-testid="text-overdue-revenue">
                          {formatCurrency(summary?.revenue.overdue || 0)}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                    </div>
                    <p className="ios-caption mt-1">
                      {summary?.invoices.overdue || 0} overdue invoices
                    </p>
                  </div>

                  <div className="feed-card card-press p-4 animate-fade-up stagger-delay-5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="ios-label">Quote Conversion</p>
                        <p className="text-xl font-bold mt-1" data-testid="text-conversion-rate">
                          {`${(summary?.quotes.conversionRate || 0).toFixed(0)}%`}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                    <p className="ios-caption mt-1">
                      {summary?.quotes.accepted || 0} of {summary?.quotes.total || 0} quotes
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="feed-card p-1 animate-fade-up stagger-delay-6">
            <div className="flex overflow-x-auto no-scrollbar">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  data-testid={tab.testId}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 min-w-0 px-4 py-2.5 text-sm font-medium rounded-xl whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  }`}
                  style={activeTab === tab.id ? { backgroundColor: 'hsl(var(--trade) / 0.1)', color: 'hsl(var(--trade))' } : undefined}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'revenue' && (
            <div className="mt-4 animate-fade-up">
              <div className="feed-card">
                <div className="flex flex-row items-center justify-between gap-2 p-4 pb-0">
                  <h3 className="ios-card-title">Monthly Revenue</h3>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-[100px]" data-testid="select-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2024">2024</SelectItem>
                      <SelectItem value="2023">2023</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="p-4">
                  {revenueLoading ? (
                    <div className="h-[300px] flex items-center justify-center">
                      <div className="space-y-4 w-full">
                        <Skeleton className="h-[250px] w-full" />
                        <div className="flex gap-8 justify-center">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={revenueData?.months || []}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis 
                              dataKey="month" 
                              className="text-xs"
                              tick={{ fill: 'hsl(var(--muted-foreground))' }}
                            />
                            <YAxis 
                              className="text-xs"
                              tick={{ fill: 'hsl(var(--muted-foreground))' }}
                              tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`}
                            />
                            <Tooltip 
                              formatter={(value: number) => formatCurrency(value)}
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '12px'
                              }}
                            />
                            <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-4 pt-4 border-t flex gap-6 justify-center">
                        <div className="text-center">
                          <p className="ios-label">Total</p>
                          <p className="font-semibold mt-0.5">{formatCurrency(revenueData?.yearTotal || 0)}</p>
                        </div>
                        <div className="text-center">
                          <p className="ios-label">GST</p>
                          <p className="font-semibold mt-0.5">{formatCurrency(revenueData?.yearGst || 0)}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="mt-4 space-y-4 animate-fade-up">
              {stripeLoading ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <KPICardSkeleton />
                    <KPICardSkeleton />
                    <KPICardSkeleton />
                    <KPICardSkeleton />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="feed-card p-4 space-y-3">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                    <div className="feed-card p-4 space-y-3">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  </div>
                </div>
              ) : !stripeData?.available ? (
                <div className="feed-card p-8 flex flex-col items-center justify-center">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                       style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}>
                    <CreditCard className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="ios-card-title mb-1">Stripe Not Connected</h3>
                  <p className="ios-caption text-center mb-4 max-w-sm">
                    {stripeData?.message || 'Connect your Stripe account to see payment data'}
                  </p>
                  <Button onClick={() => navigate('/integrations')} data-testid="button-connect-stripe">
                    Connect Stripe
                  </Button>
                </div>
              ) : (
                <>
                  <SectionTitle>Stripe Balance</SectionTitle>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="feed-card card-press p-4 animate-fade-up stagger-delay-1">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="ios-label">Available</p>
                          <p className="text-xl font-bold text-green-600 mt-1" data-testid="text-stripe-available">
                            {formatCurrency(stripeData?.balance?.available || 0)}
                          </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                          <Wallet className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                      <p className="ios-caption mt-1">Ready to transfer to bank</p>
                    </div>

                    <div className="feed-card card-press p-4 animate-fade-up stagger-delay-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="ios-label">Pending</p>
                          <p className="text-xl font-bold mt-1" data-testid="text-stripe-pending">
                            {formatCurrency(stripeData?.balance?.pending || 0)}
                          </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center flex-shrink-0">
                          <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                      </div>
                      <p className="ios-caption mt-1">Being processed</p>
                    </div>

                    <div className="feed-card card-press p-4 animate-fade-up stagger-delay-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="ios-label">Net Revenue</p>
                          <p className="text-xl font-bold mt-1" data-testid="text-stripe-net">
                            {formatCurrency(stripeData?.totals?.totalNet || 0)}
                          </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                          <Banknote className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      <p className="ios-caption mt-1">After Stripe fees</p>
                    </div>

                    <div className="feed-card card-press p-4 animate-fade-up stagger-delay-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="ios-label">Payments</p>
                          <p className="text-xl font-bold mt-1" data-testid="text-stripe-count">
                            {stripeData?.totals?.paymentCount || 0}
                          </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                          <CreditCard className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                      </div>
                      <p className="ios-caption mt-1">Total: {formatCurrency(stripeData?.totals?.totalRevenue || 0)}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="feed-card animate-fade-up stagger-delay-5">
                      <div className="flex flex-row items-center justify-between gap-2 p-4 pb-2">
                        <h3 className="ios-card-title">Recent Payments</h3>
                        <Button variant="ghost" size="icon" onClick={() => refetchStripe()} data-testid="button-refresh-payments">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="p-4 pt-0">
                        {stripeData?.payments?.length === 0 ? (
                          <p className="ios-caption text-center py-6">No payments in this period</p>
                        ) : (
                          <div className="space-y-2">
                            {stripeData?.payments?.slice(0, 5).map((payment, idx) => (
                              <div key={payment.id} className={`feed-card card-press flex items-center justify-between gap-3 p-3 animate-fade-up stagger-delay-${Math.min(idx + 1, 8)}`}>
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                                    <DollarSign className="h-5 w-5 text-green-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">{payment.customer || 'Customer'}</p>
                                    <p className="ios-caption">
                                      {format(new Date(payment.created), 'MMM d, yyyy h:mm a')}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-green-600">{formatCurrency(payment.amount)}</p>
                                  <div className="flex items-center gap-1">
                                    {payment.refunded ? (
                                      <Badge variant="destructive" className="text-xs">Refunded</Badge>
                                    ) : payment.paid ? (
                                      <Badge className="bg-green-600 text-xs">Paid</Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-xs">{payment.status}</Badge>
                                    )}
                                    {payment.receiptUrl && (
                                      <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="feed-card animate-fade-up stagger-delay-6">
                      <div className="p-4 pb-2">
                        <h3 className="ios-card-title">Recent Payouts</h3>
                      </div>
                      <div className="p-4 pt-0">
                        {stripeData?.payouts?.length === 0 ? (
                          <p className="ios-caption text-center py-6">No payouts yet</p>
                        ) : (
                          <div className="space-y-2">
                            {stripeData?.payouts?.slice(0, 5).map((payout, idx) => (
                              <div key={payout.id} className={`feed-card card-press flex items-center justify-between gap-3 p-3 animate-fade-up stagger-delay-${Math.min(idx + 1, 8)}`}>
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                                    <ArrowUpRight className="h-5 w-5 text-blue-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">Bank Transfer</p>
                                    <p className="ios-caption">
                                      {payout.destination ? `To ${payout.destination}` : 'To bank account'}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold">{formatCurrency(payout.amount)}</p>
                                  <p className="ios-caption">
                                    {payout.arrivalDate 
                                      ? format(new Date(payout.arrivalDate), 'MMM d, yyyy') 
                                      : payout.status}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {stripeData?.totals && stripeData.totals.totalFees > 0 && (
                    <div className="feed-card p-4 animate-fade-up stagger-delay-7">
                      <div className="flex items-center justify-between text-sm">
                        <span className="ios-caption">Processing Fees (2.5% platform + Stripe)</span>
                        <span className="font-medium text-yellow-600">
                          -{formatCurrency(stripeData.totals.totalFees)}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'jobs' && (
            <div className="mt-4 grid gap-4 md:grid-cols-2 animate-fade-up">
              <div className="feed-card">
                <div className="p-4 pb-2">
                  <h3 className="ios-card-title">Job Status</h3>
                </div>
                <div className="p-4">
                  {summaryLoading ? (
                    <div className="h-[250px] flex items-center justify-center">
                      <Skeleton className="h-[200px] w-[200px] rounded-full" />
                    </div>
                  ) : (
                    <>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={jobPieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {jobPieData.map((entry, index) => (
                                <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '12px'
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-center gap-6 mt-4 flex-wrap">
                        {jobPieData.map((item, index) => (
                          <div key={item.name} className="flex items-center gap-2">
                            <div 
                              className="h-3 w-3 rounded-full" 
                              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                            />
                            <span className="ios-caption">
                              {item.name}: {item.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="feed-card">
                <div className="p-4 pb-2">
                  <h3 className="ios-card-title">Job Metrics</h3>
                </div>
                <div className="p-4 space-y-2">
                  {summaryLoading ? (
                    <>
                      <Skeleton className="h-16 w-full rounded-xl" />
                      <Skeleton className="h-16 w-full rounded-xl" />
                      <Skeleton className="h-16 w-full rounded-xl" />
                    </>
                  ) : (
                    <>
                      <div className="feed-card card-press flex items-center justify-between gap-3 p-4 animate-fade-up stagger-delay-1">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          </div>
                          <span className="font-medium">Jobs Completed</span>
                        </div>
                        <span className="text-xl font-bold" data-testid="text-jobs-completed">
                          {summary?.jobs.completed || 0}
                        </span>
                      </div>
                      <div className="feed-card card-press flex items-center justify-between gap-3 p-4 animate-fade-up stagger-delay-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                            <Clock className="h-5 w-5 text-blue-600" />
                          </div>
                          <span className="font-medium">In Progress</span>
                        </div>
                        <span className="text-xl font-bold" data-testid="text-jobs-in-progress">
                          {summary?.jobs.inProgress || 0}
                        </span>
                      </div>
                      <div className="feed-card card-press flex items-center justify-between gap-3 p-4 animate-fade-up stagger-delay-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                            <FileText className="h-5 w-5 text-purple-600" />
                          </div>
                          <span className="font-medium">Total Jobs</span>
                        </div>
                        <span className="text-xl font-bold" data-testid="text-jobs-total">
                          {summary?.jobs.total || 0}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'clients' && (
            <div className="mt-4 animate-fade-up">
              <div className="feed-card">
                <div className="flex flex-row items-center justify-between gap-2 p-4 pb-2">
                  <h3 className="ios-card-title">Top Clients by Revenue</h3>
                  <Button 
                    variant="outline" 
                    size="sm"
                    data-testid="button-export-clients"
                    disabled={!clientData?.clients || clientData.clients.length === 0}
                    onClick={handleExportClients}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </Button>
                </div>
                <div className="p-4 pt-0">
                  {clientsLoading ? (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {clientData?.clients.map((client, idx) => (
                          <div 
                            key={client.id} 
                            className={`feed-card card-press flex items-center justify-between gap-3 p-3 cursor-pointer animate-fade-up stagger-delay-${Math.min(idx + 1, 8)}`}
                            onClick={() => navigate(`/clients/${client.id}`)}
                            data-testid={`row-client-${client.id}`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{client.name}</p>
                              <p className="ios-caption truncate">{client.email}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-semibold text-green-600 text-sm">{formatCurrency(client.totalRevenue)}</p>
                              {client.outstandingBalance > 0 && (
                                <p className="ios-caption text-yellow-600">{formatCurrency(client.outstandingBalance)} due</p>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </div>
                        ))}
                      </div>
                      {clientData && (
                        <div className="mt-4 pt-4 border-t flex gap-6 justify-end flex-wrap">
                          <div className="text-right">
                            <p className="ios-label">Total Revenue</p>
                            <p className="font-semibold text-green-600">
                              {formatCurrency(clientData.totals.totalRevenue)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="ios-label">Outstanding</p>
                            <p className="font-semibold text-yellow-600">
                              {formatCurrency(clientData.totals.totalOutstanding)}
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'team' && teamData && (
            <div className="mt-4 space-y-4 animate-fade-up">
              <SectionTitle>Team Overview</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                {teamLoading ? (
                  <>
                    <KPICardSkeleton />
                    <KPICardSkeleton />
                    <KPICardSkeleton />
                    <KPICardSkeleton />
                  </>
                ) : (
                  <>
                    <div className="feed-card card-press p-4 animate-fade-up stagger-delay-1">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="ios-label">Team Members</p>
                          <p className="text-xl font-bold mt-1" data-testid="text-team-members">
                            {teamData.totals.totalMembers}
                          </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                          <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                    </div>

                    <div className="feed-card card-press p-4 animate-fade-up stagger-delay-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="ios-label">Jobs Completed</p>
                          <p className="text-xl font-bold text-green-600 mt-1" data-testid="text-team-jobs-completed">
                            {teamData.totals.totalJobsCompleted}
                          </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                      <p className="ios-caption mt-1">{teamData.totals.totalJobsAssigned} assigned</p>
                    </div>

                    <div className="feed-card card-press p-4 animate-fade-up stagger-delay-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="ios-label">Hours Worked</p>
                          <p className="text-xl font-bold mt-1" data-testid="text-team-hours">
                            {teamData.totals.totalHoursWorked}
                          </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                          <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                      </div>
                      <p className="ios-caption mt-1">Total tracked hours</p>
                    </div>

                    <div className="feed-card card-press p-4 animate-fade-up stagger-delay-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="ios-label">Avg Jobs/Member</p>
                          <p className="text-xl font-bold mt-1" data-testid="text-team-avg-jobs">
                            {teamData.totals.avgJobsPerMember}
                          </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center flex-shrink-0">
                          <BarChart3 className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="feed-card animate-fade-up stagger-delay-5">
                <div className="p-4 pb-2">
                  <h3 className="ios-card-title">Team Performance</h3>
                </div>
                <div className="p-4 pt-0">
                  {teamLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-14 w-full rounded-xl" />
                      <Skeleton className="h-14 w-full rounded-xl" />
                      <Skeleton className="h-14 w-full rounded-xl" />
                    </div>
                  ) : teamData.members.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
                           style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}>
                        <Users className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <p className="ios-card-title mb-1">No team members yet</p>
                      <p className="ios-caption">Add team members to see performance data</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {teamData.members.map((member, idx) => (
                        <div 
                          key={member.id}
                          className={`feed-card card-press p-3 animate-fade-up stagger-delay-${Math.min(idx + 1, 8)}`}
                          data-testid={`row-team-member-${member.id}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                   style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                                <Users className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{member.name}</p>
                                <p className="ios-caption truncate">{member.email}</p>
                              </div>
                            </div>
                            <Badge variant={member.role === 'OWNER' ? 'default' : member.role === 'ADMIN' ? 'secondary' : 'outline'}>
                              {member.role}
                            </Badge>
                          </div>
                          <div className="flex gap-4 mt-2 pl-13">
                            <div className="text-center">
                              <p className="ios-label">Done</p>
                              <p className="font-semibold text-green-600 text-sm">{member.jobsCompleted}</p>
                            </div>
                            <div className="text-center">
                              <p className="ios-label">Active</p>
                              <p className="font-semibold text-blue-600 text-sm">{member.jobsInProgress}</p>
                            </div>
                            <div className="text-center">
                              <p className="ios-label">Hours</p>
                              <p className="font-semibold text-sm">{member.hoursWorked}h</p>
                            </div>
                            <div className="text-center">
                              <p className="ios-label">Avg</p>
                              <p className="font-semibold text-muted-foreground text-sm">{member.avgHoursPerJob}h</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
