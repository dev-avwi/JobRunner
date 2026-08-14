import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/UserAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DollarSign, Clock, Users, HardHat, Download, FileText, BarChart3,
  ChevronDown, ChevronRight, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, XCircle, Briefcase, Award, Flag, MessageSquare, Loader2, Wallet
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient, getSessionToken } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import WorkerPerformanceSection from "@/components/WorkerPerformanceCard";

interface DisputedTimeEntry {
  id: string;
  userId: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  description: string | null;
  isDisputed: boolean;
  disputeReason: string | null;
  disputedAt: string | null;
  disputeResolvedAt: string | null;
  disputeResolution: string | null;
  workerName: string;
  jobTitle?: string | null;
  editHistory: EditHistoryEntry[];
}

interface EditHistoryEntry {
  id: string;
  fieldChanged: string;
  oldValue: string | null;
  newValue: string | null;
  editedAt: string;
  editedByName: string;
  editReason: string | null;
}

const fmtAud = (n: number) => `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;

const csvEscape = (val: any) => {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

function getUtilColor(pct: number) {
  if (pct >= 80) return "text-green-600 dark:text-green-400";
  if (pct >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function getUtilBg(pct: number) {
  if (pct >= 80) return "bg-green-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function getBillableColor(pct: number) {
  if (pct >= 80) return "text-green-600 dark:text-green-400";
  if (pct >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function getBillableDot(pct: number) {
  if (pct >= 80) return "bg-green-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

const BUCKET_CONFIG: Record<string, { label: string; color: string; bg: string; barBg: string }> = {
  current: { label: "Current", color: "text-green-700 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/30", barBg: "bg-green-500" },
  "1-30": { label: "1-30 Days", color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30", barBg: "bg-blue-500" },
  "31-60": { label: "31-60 Days", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30", barBg: "bg-amber-500" },
  "61-90": { label: "61-90 Days", color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/30", barBg: "bg-orange-500" },
  "90+": { label: "90+ Days", color: "text-red-700 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30", barBg: "bg-red-500" },
};

const BUCKET_ORDER = ["current", "1-30", "31-60", "61-90", "90+"];

export default function PayrollReports() {
  const [activeTab, setActiveTab] = useState("payroll");
  const [payrollPeriod, setPayrollPeriod] = useState("this_month");
  const [utilisationPeriod, setUtilisationPeriod] = useState("last_30");
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set());
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set());
  const [expandedDisputes, setExpandedDisputes] = useState<Set<string>>(new Set());
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [payWorker, setPayWorker] = useState<any | null>(null);
  const [payMethod, setPayMethod] = useState('bank_transfer');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payReference, setPayReference] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payslipBusyId, setPayslipBusyId] = useState<string | null>(null);
  const [payAllOpen, setPayAllOpen] = useState(false);
  const [payAllMethod, setPayAllMethod] = useState('bank_transfer');
  const [payAllDate, setPayAllDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payAllProgress, setPayAllProgress] = useState<{ done: number; total: number } | null>(null);
  const { toast } = useToast();

  const payrollDates = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (payrollPeriod) {
      case 'this_week': {
        const start = new Date(today);
        start.setDate(start.getDate() - start.getDay() + 1);
        return { start, end: today };
      }
      case 'last_week': {
        const end = new Date(today);
        end.setDate(end.getDate() - end.getDay());
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        return { start, end };
      }
      case 'this_fortnight': {
        const start = new Date(today);
        start.setDate(start.getDate() - 13);
        return { start, end: today };
      }
      case 'this_month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start, end: today };
      }
      case 'last_month': {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return { start, end };
      }
      default:
        return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: today };
    }
  }, [payrollPeriod]);

  const utilisationDates = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (utilisationPeriod) {
      case 'last_7': {
        const start = new Date(today);
        start.setDate(start.getDate() - 7);
        return { start, end: today };
      }
      case 'last_30': {
        const start = new Date(today);
        start.setDate(start.getDate() - 30);
        return { start, end: today };
      }
      case 'this_month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start, end: today };
      }
      case 'last_month': {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return { start, end };
      }
      default: {
        const start = new Date(today);
        start.setDate(start.getDate() - 30);
        return { start, end: today };
      }
    }
  }, [utilisationPeriod]);

  const { data: payrollData, isLoading: payrollLoading } = useQuery<any>({
    queryKey: ['/api/payroll/summary', { start: payrollDates.start.toISOString(), end: payrollDates.end.toISOString() }],
    staleTime: 2 * 60 * 1000,
  });

  const { data: receivablesData, isLoading: receivablesLoading } = useQuery<any>({
    queryKey: ['/api/reports/receivables'],
    staleTime: 2 * 60 * 1000,
  });

  const { data: utilisationData, isLoading: utilisationLoading } = useQuery<any>({
    queryKey: ['/api/reports/utilisation', { start: utilisationDates.start.toISOString(), end: utilisationDates.end.toISOString() }],
    staleTime: 2 * 60 * 1000,
  });

  const { data: disputedEntries, isLoading: disputesLoading } = useQuery<DisputedTimeEntry[]>({
    queryKey: ['/api/time-entries/disputed'],
    staleTime: 30 * 1000,
  });

  const resolveDisputeMutation = useMutation({
    mutationFn: async ({ id, resolution }: { id: string; resolution: string }) => {
      await apiRequest('PATCH', `/api/time-entries/${id}/resolve-dispute`, { resolution });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/disputed'] });
      toast({ title: 'Dispute resolved', description: 'The worker will be notified.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to resolve dispute.', variant: 'destructive' });
    },
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!payWorker) return;
      const res = await apiRequest('POST', '/api/payroll/pay', {
        workerUserId: payWorker.memberId,
        periodStart: payrollDates.start.toISOString(),
        periodEnd: payrollDates.end.toISOString(),
        method: payMethod,
        paidAt: payDate ? new Date(payDate).toISOString() : new Date().toISOString(),
        reference: payReference.trim() || undefined,
        notes: payNotes.trim() || undefined,
        sendPayslip: true,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/payroll/summary'] });
      toast({ title: 'Payment recorded', description: data?.payslipSent ? 'Payslip emailed to the worker.' : 'Payroll payment recorded.' });
      setPayWorker(null);
    },
    onError: (e: any) => toast({ title: 'Payment failed', description: String(e?.message || e).replace(/^\d+:\s*/, ''), variant: 'destructive' }),
  });

  const openPay = (w: any) => {
    setPayWorker(w);
    setPayMethod('bank_transfer');
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayReference('');
    setPayNotes('');
  };

  const outstandingWorkers = useMemo(() => {
    return (payrollData?.workers || []).filter((w: any) => !w.paid && w.memberId && (w.grossPay || 0) > 0);
  }, [payrollData]);

  const outstandingTotal = useMemo(() => {
    return outstandingWorkers.reduce((sum: number, w: any) => sum + (w.grossPay || 0), 0);
  }, [outstandingWorkers]);

  const payAllMutation = useMutation({
    mutationFn: async () => {
      const workers = outstandingWorkers;
      setPayAllProgress({ done: 0, total: workers.length });
      const paidAt = payAllDate ? new Date(payAllDate).toISOString() : new Date().toISOString();
      let succeeded = 0;
      const failed: string[] = [];
      for (const w of workers) {
        try {
          const res = await apiRequest('POST', '/api/payroll/pay', {
            workerUserId: w.memberId,
            periodStart: payrollDates.start.toISOString(),
            periodEnd: payrollDates.end.toISOString(),
            method: payAllMethod,
            paidAt,
            sendPayslip: true,
          });
          await res.json();
          succeeded += 1;
        } catch (e: any) {
          const name = `${w.firstName || ''} ${w.lastName || ''}`.trim() || 'Worker';
          failed.push(name);
        }
        setPayAllProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
      return { succeeded, failed };
    },
    onSuccess: ({ succeeded, failed }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/payroll/summary'] });
      setPayAllOpen(false);
      setPayAllProgress(null);
      if (failed.length === 0) {
        toast({ title: 'Pay run complete', description: `${succeeded} worker${succeeded === 1 ? '' : 's'} paid. Payslips emailed.` });
      } else {
        toast({
          title: succeeded > 0 ? 'Pay run partially complete' : 'Pay run failed',
          description: `${succeeded} paid, ${failed.length} failed: ${failed.join(', ')}`,
          variant: 'destructive',
        });
      }
    },
    onError: (e: any) => {
      setPayAllProgress(null);
      toast({ title: 'Pay run failed', description: String(e?.message || e).replace(/^\d+:\s*/, ''), variant: 'destructive' });
    },
  });

  const openPayAll = () => {
    setPayAllMethod('bank_transfer');
    setPayAllDate(new Date().toISOString().slice(0, 10));
    setPayAllOpen(true);
  };

  const downloadPayslip = async (paymentId: string) => {
    setPayslipBusyId(paymentId);
    try {
      const token = getSessionToken();
      const res = await fetch(`/api/payroll/payslip/${paymentId}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Payslip-${paymentId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Download failed', description: 'Could not download the payslip.', variant: 'destructive' });
    } finally {
      setPayslipBusyId(null);
    }
  };

  const pendingDisputeCount = useMemo(() => {
    if (!disputedEntries) return 0;
    return disputedEntries.filter((e) => !e.disputeResolvedAt).length;
  }, [disputedEntries]);

  const toggleDispute = (id: string) => {
    setExpandedDisputes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportPayrollCSV = () => {
    if (!payrollData?.workers) return;
    const categoryLabels: Record<string, string> = {
      work: 'Site Work', travel: 'Driving/Travel', materials: 'Supplies Run',
      admin: 'Admin/Office', meeting: 'Meeting', training: 'Training', other: 'Other',
    };
    const travelRatePerKm: number = payrollData.travelRatePerKm || 0;
    const headers = ['Name', 'Type', 'Regular Hours', 'Overtime Hours', 'Break Hours', 'Total Hours', 'Billable Hours', 'Rate ($/hr)', 'Overtime Pay', 'Gross Pay', 'Travel Distance (km)', 'Travel Allowance ($)', 'Jobs', 'Approved', 'Unapproved', 'Category Breakdown'];
    const rows = payrollData.workers.map((w: any) => {
      const catBreakdown = w.timeCategories
        ? Object.entries(w.timeCategories as Record<string, number>)
            .filter(([, h]) => (h as number) > 0)
            .map(([k, h]) => `${categoryLabels[k] ?? k}: ${(h as number).toFixed(1)}h`)
            .join('; ')
        : '';
      const travelAllowance: number = w.travelAllowance ?? (travelRatePerKm > 0 ? Math.round((w.totalDistanceKm || 0) * travelRatePerKm * 100) / 100 : 0);
      return [
        `${w.firstName || ''} ${w.lastName || ''}`.trim(),
        w.isSubcontractor ? 'Subcontractor' : 'Employee',
        w.regularHours, w.overtimeHours, w.breakHours, w.totalHours, w.billableHours,
        w.hourlyRate.toFixed(2), w.overtimePay.toFixed(2), w.grossPay.toFixed(2),
        (w.totalDistanceKm || 0).toFixed(1), travelAllowance.toFixed(2),
        w.jobCount, w.approved, w.unapproved,
        catBreakdown,
      ];
    });
    const csv = [headers.join(','), ...rows.map((r: any[]) => r.map(csvEscape).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll_${payrollDates.start.toISOString().split('T')[0]}_${payrollDates.end.toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportReceivablesCSV = () => {
    if (!receivablesData?.buckets) return;
    const headers = ['Invoice #', 'Client', 'Amount', 'Due Date', 'Days Overdue', 'Aging Bucket'];
    const rows: string[][] = [];
    const bucketNames: Record<string, string> = { current: 'Current', '1-30': '1-30 Days', '31-60': '31-60 Days', '61-90': '61-90 Days', '90+': '90+ Days' };
    for (const [key, bucket] of Object.entries(receivablesData.buckets as Record<string, any>)) {
      for (const inv of bucket.invoices) {
        rows.push([inv.number, inv.clientName, inv.total.toFixed(2), inv.dueDate?.split('T')[0] || '', String(inv.daysOverdue), bucketNames[key] || key]);
      }
    }
    const csv = [headers.join(','), ...rows.map(r => r.map(csvEscape).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receivables_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleWorker = (id: string) => {
    setExpandedWorkers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleBucket = (id: string) => {
    setExpandedBuckets(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const employees = useMemo(() => {
    if (!payrollData?.workers) return [];
    return payrollData.workers
      .filter((w: any) => !w.isSubcontractor)
      .sort((a: any, b: any) => {
        const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
        const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [payrollData]);

  const subcontractors = useMemo(() => {
    if (!payrollData?.workers) return [];
    return payrollData.workers
      .filter((w: any) => w.isSubcontractor)
      .sort((a: any, b: any) => {
        const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
        const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [payrollData]);

  const receivablesTotal = useMemo(() => {
    if (!receivablesData?.buckets) return 0;
    return Object.values(receivablesData.buckets as Record<string, any>)
      .reduce((sum: number, b: any) => sum + (b.total || 0), 0);
  }, [receivablesData]);

  const clientBreakdown = useMemo(() => {
    if (!receivablesData?.buckets) return [];
    const clientMap: Record<string, { name: string; total: number }> = {};
    for (const bucket of Object.values(receivablesData.buckets as Record<string, any>)) {
      for (const inv of bucket.invoices || []) {
        const key = inv.clientName || 'Unknown';
        if (!clientMap[key]) clientMap[key] = { name: key, total: 0 };
        clientMap[key].total += inv.total || 0;
      }
    }
    return Object.values(clientMap).sort((a, b) => b.total - a.total);
  }, [receivablesData]);

  const sortedUtilWorkers = useMemo(() => {
    if (!utilisationData?.workers) return [];
    return [...utilisationData.workers].sort((a: any, b: any) => {
      const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
      const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [utilisationData]);

  const getInitials = (firstName?: string, lastName?: string) => {
    const f = firstName?.[0] || '';
    const l = lastName?.[0] || '';
    return (f + l).toUpperCase() || '?';
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="receivables">Receivables</TabsTrigger>
          <TabsTrigger value="utilisation">Utilisation</TabsTrigger>
          <TabsTrigger value="disputes" className="relative">
            Disputes
            {pendingDisputeCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                {pendingDisputeCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="payroll" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              <h2 className="text-lg font-semibold">Payroll & Pay Runs</h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={payrollPeriod} onValueChange={setPayrollPeriod}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="last_week">Last Week</SelectItem>
                  <SelectItem value="this_fortnight">This Fortnight</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={exportPayrollCSV} disabled={!payrollData?.workers}>
                <Download className="h-4 w-4 mr-1.5" />
                Export CSV
              </Button>
              {outstandingWorkers.length > 0 && (
                <Button size="sm" onClick={openPayAll} data-testid="button-pay-all">
                  <Wallet className="h-4 w-4 mr-1.5" />
                  Pay all outstanding
                </Button>
              )}
            </div>
          </div>

          {payrollLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">Total Hours</span>
                  </div>
                  <p className="text-2xl font-bold">{(payrollData?.totals?.totalHours || 0).toFixed(1)}h</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">Gross Pay</span>
                  </div>
                  <p className="text-2xl font-bold">{fmtAud(payrollData?.totals?.totalPay || 0)}</p>
                </CardContent>
              </Card>
              {(payrollData?.travelRatePerKm > 0 || (payrollData?.totals?.totalTravelAllowance || 0) > 0) && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs text-muted-foreground font-medium">Travel Allowance</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{fmtAud(payrollData?.totals?.totalTravelAllowance || 0)}</p>
                    {payrollData?.travelRatePerKm > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">${Number(payrollData.travelRatePerKm).toFixed(4)}/km</p>
                    )}
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="text-xs text-muted-foreground font-medium">Paid</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{fmtAud(payrollData?.totals?.totalPaid || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{payrollData?.totals?.paidCount || 0} worker{(payrollData?.totals?.paidCount || 0) === 1 ? '' : 's'}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs text-muted-foreground font-medium">Outstanding</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{fmtAud(payrollData?.totals?.totalOutstanding || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{payrollData?.totals?.outstandingCount || 0} worker{(payrollData?.totals?.outstandingCount || 0) === 1 ? '' : 's'}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">Workers</span>
                  </div>
                  <p className="text-2xl font-bold">{employees.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <HardHat className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">Subcontractors</span>
                  </div>
                  <p className="text-2xl font-bold">{subcontractors.length}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {payrollLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Workers
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-0 pb-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left font-medium text-muted-foreground px-4 py-2">Worker</th>
                        <th className="text-left font-medium text-muted-foreground px-3 py-2 hidden sm:table-cell">Type</th>
                        <th className="text-right font-medium text-muted-foreground px-3 py-2">Hours</th>
                        <th className="text-right font-medium text-muted-foreground px-3 py-2 hidden md:table-cell">Rate</th>
                        <th className="text-right font-medium text-muted-foreground px-3 py-2">Gross Pay</th>
                        <th className="text-right font-medium text-muted-foreground px-3 py-2 hidden lg:table-cell">Billable</th>
                        <th className="text-right font-medium text-muted-foreground px-4 py-2 hidden md:table-cell">Status</th>
                        <th className="text-right font-medium text-muted-foreground px-3 py-2">Pay run</th>
                        <th className="w-8 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(payrollData?.workers || [])
                        .sort((a: any, b: any) => {
                          const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
                          const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
                          return nameA.localeCompare(nameB);
                        })
                        .map((w: any, index: number) => {
                          const name = `${w.firstName || ''} ${w.lastName || ''}`.trim() || 'Unknown';
                          const initials = getInitials(w.firstName, w.lastName);
                          const isExpanded = expandedWorkers.has(w.id || w.userId);
                          const billablePct = w.totalHours > 0 ? Math.round((w.billableHours / w.totalHours) * 100) : 0;
                          return (
                            <tr key={w.id || w.userId || `worker-${index}`} className="border-b last:border-0">
                              <td className="px-4 py-2.5">
                                <div
                                  className="flex items-center gap-2.5 cursor-pointer"
                                  onClick={() => toggleWorker(w.id || w.userId)}
                                >
                                  <UserAvatar
                                    className="h-7 w-7"
                                    fallbackClassName="text-[10px]"
                                    user={{ id: w.userId || w.id || name, firstName: w.firstName, lastName: w.lastName, photoUrl: w.profileImageUrl, themeColor: w.themeColor }}
                                  />
                                  <span className="font-medium truncate max-w-[120px]">{name}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 hidden sm:table-cell">
                                {w.isSubcontractor ? (
                                  <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700">Subcontractor</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">Employee</Badge>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                <span>{(w.regularHours || 0).toFixed(1)}h</span>
                                {(w.overtimeHours || 0) > 0 && (
                                  <span className="text-amber-600 dark:text-amber-400 text-xs ml-1">(+{w.overtimeHours.toFixed(1)} OT)</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums hidden md:table-cell">
                                ${(w.hourlyRate || 0).toFixed(2)}/hr
                              </td>
                              <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                                {fmtAud(w.grossPay || 0)}
                              </td>
                              <td className="px-3 py-2.5 text-right hidden lg:table-cell">
                                <div className="flex items-center justify-end gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${getBillableDot(billablePct)}`} />
                                  <span className={`text-xs font-medium ${getBillableColor(billablePct)}`}>{billablePct}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-right hidden md:table-cell">
                                <div className="flex items-center justify-end gap-1.5">
                                  {(w.approved || 0) > 0 && (
                                    <span className="flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400">
                                      <CheckCircle2 className="h-3 w-3" />{w.approved}
                                    </span>
                                  )}
                                  {(w.unapproved || 0) > 0 && (
                                    <span className="flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400">
                                      <XCircle className="h-3 w-3" />{w.unapproved}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                  {w.paid ? (
                                    <>
                                      <Badge variant="outline" className="text-xs text-green-600 dark:text-green-400 border-green-300 dark:border-green-700">Paid</Badge>
                                      {w.payrollPaymentId && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => downloadPayslip(w.payrollPaymentId)}
                                          disabled={payslipBusyId === w.payrollPaymentId}
                                          data-testid={`button-payslip-${w.memberId}`}
                                        >
                                          {payslipBusyId === w.payrollPaymentId ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          ) : (
                                            <Download className="h-3.5 w-3.5" />
                                          )}
                                          <span className="ml-1 hidden lg:inline">Payslip</span>
                                        </Button>
                                      )}
                                    </>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openPay(w)}
                                      disabled={!w.memberId || (w.grossPay || 0) <= 0}
                                      data-testid={`button-pay-${w.memberId}`}
                                    >
                                      <Wallet className="h-3.5 w-3.5" />
                                      <span className="ml-1 hidden lg:inline">Mark paid</span>
                                    </Button>
                                  )}
                                </div>
                              </td>
                              <td className="px-2 py-2.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => toggleWorker(w.id || w.userId)}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      {(!payrollData?.workers || payrollData.workers.length === 0) && (
                        <tr>
                          <td colSpan={9} className="text-center py-8 text-muted-foreground">
                            <Users className="h-8 w-8 mx-auto mb-2 opacity-25" />
                            <p className="text-sm">No worker data for this period</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {Array.from(expandedWorkers).map(workerId => {
                  const worker = (payrollData?.workers || []).find((w: any) => (w.id || w.userId) === workerId);
                  if (!worker?.timeBreakdown) return null;
                  return (
                    <div key={`expanded-${workerId}`} className="mx-4 mb-3 p-3 rounded-md bg-muted/50 border">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Time Category Breakdown</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Object.entries(worker.timeBreakdown as Record<string, number>).map(([category, hours]) => (
                          <div key={category} className="flex items-center justify-between gap-2 text-xs">
                            <span className="capitalize text-muted-foreground">{category}</span>
                            <span className="font-medium tabular-nums">{(hours as number).toFixed(1)}h</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {!payrollLoading && subcontractors.length > 0 && (
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <HardHat className="h-4 w-4" />
                  Subcontractor Payables
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-0 pb-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left font-medium text-muted-foreground px-4 py-2">Subcontractor</th>
                        <th className="text-right font-medium text-muted-foreground px-3 py-2">Hours</th>
                        <th className="text-right font-medium text-muted-foreground px-3 py-2 hidden md:table-cell">Rate</th>
                        <th className="text-right font-medium text-muted-foreground px-3 py-2">Payable Amount</th>
                        <th className="text-right font-medium text-muted-foreground px-3 py-2 hidden md:table-cell">Jobs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subcontractors.map((w: any, index: number) => {
                        const name = `${w.firstName || ''} ${w.lastName || ''}`.trim() || 'Unknown';
                        const initials = getInitials(w.firstName, w.lastName);
                        return (
                          <tr key={w.id || w.userId || `subcontractor-${index}`} className="border-b last:border-0">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <UserAvatar
                                  className="h-7 w-7"
                                  fallbackClassName="text-[10px]"
                                  user={{ id: w.userId || w.id || name, firstName: w.firstName, lastName: w.lastName, photoUrl: w.profileImageUrl, themeColor: w.themeColor }}
                                />
                                <span className="font-medium truncate max-w-[120px]">{name}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {(w.totalHours || 0).toFixed(1)}h
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums hidden md:table-cell">
                              ${(w.hourlyRate || 0).toFixed(2)}/hr
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                              {fmtAud(w.grossPay || 0)}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums hidden md:table-cell">
                              {w.jobCount || 0}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="receivables" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              <h2 className="text-lg font-semibold">Aged Receivables</h2>
              <span className="text-xs text-muted-foreground ml-2">
                As of {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={exportReceivablesCSV} disabled={!receivablesData?.buckets}>
              <Download className="h-4 w-4 mr-1.5" />
              Export CSV
            </Button>
          </div>

          {receivablesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16" />
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24" />)}
              </div>
            </div>
          ) : (
            <>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <span className="text-sm text-muted-foreground font-medium">Total Outstanding</span>
                    <span className="text-xl font-bold">{fmtAud(receivablesTotal)}</span>
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                    {BUCKET_ORDER.map(key => {
                      const bucket = (receivablesData?.buckets as Record<string, any>)?.[key];
                      const total = bucket?.total || 0;
                      const pct = receivablesTotal > 0 ? (total / receivablesTotal) * 100 : 0;
                      if (pct <= 0) return null;
                      const config = BUCKET_CONFIG[key];
                      return (
                        <div
                          key={key}
                          className={`${config.barBg} transition-all`}
                          style={{ width: `${pct}%` }}
                          title={`${config.label}: ${fmtAud(total)}`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {BUCKET_ORDER.map(key => {
                      const config = BUCKET_CONFIG[key];
                      return (
                        <div key={key} className="flex items-center gap-1.5 text-xs">
                          <span className={`w-2.5 h-2.5 rounded-full ${config.barBg}`} />
                          <span className="text-muted-foreground">{config.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {BUCKET_ORDER.map(key => {
                  const bucket = (receivablesData?.buckets as Record<string, any>)?.[key];
                  const config = BUCKET_CONFIG[key];
                  const count = bucket?.count || 0;
                  const total = bucket?.total || 0;
                  const isExpanded = expandedBuckets.has(key);
                  return (
                    <Card key={key} className="col-span-1">
                      <CardContent className="p-3">
                        <div
                          className="cursor-pointer"
                          onClick={() => count > 0 && toggleBucket(key)}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                            {count > 0 && (
                              isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                          <p className="text-lg font-bold">{fmtAud(total)}</p>
                          <p className="text-xs text-muted-foreground">{count} invoice{count !== 1 ? 's' : ''}</p>
                        </div>
                        {isExpanded && bucket?.invoices && (
                          <div className="mt-2 pt-2 border-t space-y-1.5">
                            {bucket.invoices.map((inv: any, idx: number) => (
                              <div key={idx} className="text-xs space-y-0.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium truncate">{inv.number}</span>
                                  <span className="font-medium tabular-nums">{fmtAud(inv.total)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2 text-muted-foreground">
                                  <span className="truncate">{inv.clientName}</span>
                                  {inv.daysOverdue > 0 && (
                                    <span className="text-red-500 dark:text-red-400 flex-shrink-0">{inv.daysOverdue}d overdue</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {clientBreakdown.length > 0 && (
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Client Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 px-0 pb-2">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left font-medium text-muted-foreground px-4 py-2">Client</th>
                            <th className="text-right font-medium text-muted-foreground px-4 py-2">Amount Owed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientBreakdown.map((client, idx) => (
                            <tr key={client.name || idx} className="border-b last:border-0">
                              <td className="px-4 py-2.5 font-medium">{client.name}</td>
                              <td className="px-4 py-2.5 text-right font-medium tabular-nums">{fmtAud(client.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="utilisation" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              <h2 className="text-lg font-semibold">Team Utilisation</h2>
            </div>
            <Select value={utilisationPeriod} onValueChange={setUtilisationPeriod}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_7">Last 7 Days</SelectItem>
                <SelectItem value="last_30">Last 30 Days</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {utilisationLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">Avg Utilisation</span>
                    </div>
                    <p className={`text-2xl font-bold ${getUtilColor(utilisationData?.summary?.avgUtilisation || 0)}`}>
                      {(utilisationData?.summary?.avgUtilisation || 0).toFixed(0)}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">Total Revenue</span>
                    </div>
                    <p className="text-2xl font-bold">{fmtAud(utilisationData?.summary?.totalRevenue || 0)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">Labour Cost</span>
                    </div>
                    <p className="text-2xl font-bold">{fmtAud(utilisationData?.summary?.totalLabourCost || 0)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">Idle Hours</span>
                    </div>
                    <p className="text-2xl font-bold">{(utilisationData?.summary?.totalIdleHours || 0).toFixed(1)}h</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Worker Utilisation
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 px-0 pb-2">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left font-medium text-muted-foreground px-4 py-2">Worker</th>
                          <th className="text-right font-medium text-muted-foreground px-3 py-2 hidden sm:table-cell">Hours</th>
                          <th className="text-right font-medium text-muted-foreground px-3 py-2 hidden sm:table-cell">Capacity</th>
                          <th className="text-left font-medium text-muted-foreground px-3 py-2">Utilisation</th>
                          <th className="text-right font-medium text-muted-foreground px-3 py-2 hidden md:table-cell">Billable</th>
                          <th className="text-right font-medium text-muted-foreground px-3 py-2 hidden lg:table-cell">Jobs</th>
                          <th className="text-right font-medium text-muted-foreground px-3 py-2 hidden md:table-cell">Revenue</th>
                          <th className="text-right font-medium text-muted-foreground px-4 py-2 hidden lg:table-cell">Rev/Hr</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedUtilWorkers.map((w: any, index: number) => {
                          const name = `${w.firstName || ''} ${w.lastName || ''}`.trim() || 'Unknown';
                          const initials = getInitials(w.firstName, w.lastName);
                          const utilPct = w.utilisationPct || 0;
                          const billablePct = w.billablePct || 0;
                          const revenuePerHour = w.hoursWorked > 0 ? (w.revenue || 0) / w.hoursWorked : 0;
                          return (
                            <tr key={w.id || w.userId || `util-worker-${index}`} className="border-b last:border-0">
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2.5">
                                  <UserAvatar
                                    className="h-7 w-7"
                                    fallbackClassName="text-[10px]"
                                    user={{ id: w.userId || w.id || name, firstName: w.firstName, lastName: w.lastName, photoUrl: w.profileImageUrl, themeColor: w.themeColor }}
                                  />
                                  <span className="font-medium truncate max-w-[120px]">{name}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums hidden sm:table-cell">
                                {(w.hoursWorked || 0).toFixed(1)}h
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums hidden sm:table-cell">
                                {(w.capacity || 0).toFixed(1)}h
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2 min-w-[100px]">
                                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${getUtilBg(utilPct)}`}
                                      style={{ width: `${Math.min(utilPct, 100)}%` }}
                                    />
                                  </div>
                                  <span className={`text-xs font-medium tabular-nums w-8 text-right ${getUtilColor(utilPct)}`}>
                                    {utilPct.toFixed(0)}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right hidden md:table-cell">
                                <div className="flex items-center justify-end gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${getBillableDot(billablePct)}`} />
                                  <span className={`text-xs font-medium ${getBillableColor(billablePct)}`}>{billablePct.toFixed(0)}%</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums hidden lg:table-cell">
                                {w.jobsCompleted || 0}
                              </td>
                              <td className="px-3 py-2.5 text-right font-medium tabular-nums hidden md:table-cell">
                                {fmtAud(w.revenue || 0)}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums hidden lg:table-cell">
                                {fmtAud(revenuePerHour)}
                              </td>
                            </tr>
                          );
                        })}
                        {sortedUtilWorkers.length === 0 && (
                          <tr>
                            <td colSpan={8} className="text-center py-8 text-muted-foreground">
                              <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-25" />
                              <p className="text-sm">No utilisation data for this period</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="disputes" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
            <h2 className="text-lg font-semibold">Disputed Entries</h2>
            {pendingDisputeCount > 0 && (
              <Badge variant="destructive" className="text-xs">{pendingDisputeCount} pending</Badge>
            )}
          </div>

          {disputesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : !disputedEntries || disputedEntries.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-25" />
                <p className="text-sm text-muted-foreground">No disputed time entries</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {disputedEntries.map((entry) => {
                const isPending = !entry.disputeResolvedAt;
                const isExpanded = expandedDisputes.has(entry.id);
                const startDate = entry.startTime ? new Date(entry.startTime) : null;
                const endDate = entry.endTime ? new Date(entry.endTime) : null;
                const durationH = entry.duration ? (entry.duration / 60).toFixed(1) : '--';

                return (
                  <Card key={entry.id}>
                    <CardContent className="p-4">
                      <div
                        className="flex items-start justify-between gap-3 cursor-pointer"
                        onClick={() => toggleDispute(entry.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <UserAvatar
                            className="h-8 w-8 flex-shrink-0"
                            fallbackClassName="text-[10px]"
                            user={{ id: entry.workerName || entry.id, name: entry.workerName || 'Unknown' }}
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{entry.workerName || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">
                              {startDate?.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                              {' '}
                              {startDate?.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}
                              {endDate ? ` - ${endDate.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}` : ''}
                              {' '}({durationH}h)
                            </p>
                            {entry.jobTitle && (
                              <p className="text-xs text-muted-foreground truncate">Job: {entry.jobTitle}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isPending ? (
                            <Badge variant="destructive" className="text-xs">Pending</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Resolved</Badge>
                          )}
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      <div className="mt-3 p-3 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-0.5">Worker's Dispute Reason</p>
                            <p className="text-sm text-red-600 dark:text-red-300">{entry.disputeReason}</p>
                            {entry.disputedAt && (
                              <p className="text-xs text-red-400 dark:text-red-500 mt-1">
                                Filed {new Date(entry.disputedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {entry.disputeResolution && (
                        <div className="mt-2 p-3 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-0.5">Resolution</p>
                              <p className="text-sm text-green-600 dark:text-green-300">{entry.disputeResolution}</p>
                              {entry.disputeResolvedAt && (
                                <p className="text-xs text-green-400 dark:text-green-500 mt-1">
                                  Resolved {new Date(entry.disputeResolvedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {isExpanded && (
                        <div className="mt-3 space-y-3">
                          {entry.editHistory && entry.editHistory.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                Edit History
                              </p>
                              <div className="space-y-1.5">
                                {entry.editHistory.map((edit: EditHistoryEntry, idx: number) => (
                                  <div key={edit.id || idx} className="text-xs p-2 rounded bg-muted/50 border">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-medium">{edit.fieldChanged}</span>
                                      <span className="text-muted-foreground">
                                        {edit.editedAt ? new Date(edit.editedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 text-muted-foreground">
                                      <span>{edit.oldValue || '(none)'}</span>
                                      <ChevronRight className="h-3 w-3" />
                                      <span>{edit.newValue || '(none)'}</span>
                                    </div>
                                    {edit.editReason && (
                                      <p className="mt-0.5 italic text-muted-foreground">Reason: {edit.editReason}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {isPending && (
                            <div className="pt-2 border-t">
                              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                                <MessageSquare className="h-3.5 w-3.5" />
                                Resolve Dispute
                              </p>
                              <Textarea
                                placeholder="Enter resolution note (e.g., 'Adjusted end time to 5pm as requested' or 'Entry is correct per GPS records')"
                                value={resolutionNotes[entry.id] || ''}
                                onChange={(e) => setResolutionNotes(prev => ({ ...prev, [entry.id]: e.target.value }))}
                                className="text-sm mb-2"
                              />
                              <Button
                                size="sm"
                                disabled={!resolutionNotes[entry.id]?.trim() || resolveDisputeMutation.isPending}
                                onClick={() => {
                                  const note = resolutionNotes[entry.id]?.trim();
                                  if (note) {
                                    resolveDisputeMutation.mutate({ id: entry.id, resolution: note });
                                    setResolutionNotes(prev => {
                                      const next = { ...prev };
                                      delete next[entry.id];
                                      return next;
                                    });
                                  }
                                }}
                              >
                                {resolveDisputeMutation.isPending ? 'Resolving...' : 'Resolve Dispute'}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-4 mt-4">
          <WorkerPerformanceSection />
        </TabsContent>
      </Tabs>

      <Dialog open={!!payWorker} onOpenChange={(o) => { if (!o) setPayWorker(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              {payWorker ? `${`${payWorker.firstName || ''} ${payWorker.lastName || ''}`.trim() || 'Worker'} · ${fmtAud(payWorker.grossPay || 0)} for this period` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger data-testid="select-pay-method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="payid">PayID</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-date">Payment date</Label>
              <Input id="pay-date" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} data-testid="input-pay-date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-reference">Reference (optional)</Label>
              <Input id="pay-reference" value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="e.g. transfer ref" data-testid="input-pay-reference" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-notes">Notes (optional)</Label>
              <Textarea id="pay-notes" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} rows={2} data-testid="input-pay-notes" />
            </div>
            <p className="text-xs text-muted-foreground">A payslip will be emailed to the worker.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayWorker(null)} disabled={payMutation.isPending}>Cancel</Button>
            <Button onClick={() => payMutation.mutate()} disabled={payMutation.isPending} data-testid="button-confirm-pay">
              {payMutation.isPending ? (<><Loader2 className="h-4 w-4 mr-1 animate-spin" />Recording...</>) : 'Record payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payAllOpen} onOpenChange={(o) => { if (!o && !payAllMutation.isPending) setPayAllOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay all outstanding</DialogTitle>
            <DialogDescription>
              Record payment for {outstandingWorkers.length} worker{outstandingWorkers.length === 1 ? '' : 's'} totalling {fmtAud(outstandingTotal)} for this period.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select value={payAllMethod} onValueChange={setPayAllMethod}>
                <SelectTrigger data-testid="select-pay-all-method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="payid">PayID</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-all-date">Payment date</Label>
              <Input id="pay-all-date" type="date" value={payAllDate} onChange={(e) => setPayAllDate(e.target.value)} data-testid="input-pay-all-date" />
            </div>
            <p className="text-xs text-muted-foreground">A payslip will be emailed to each worker.</p>
            {payAllProgress && (
              <p className="text-xs text-muted-foreground" data-testid="text-pay-all-progress">
                Paying {payAllProgress.done} of {payAllProgress.total}…
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayAllOpen(false)} disabled={payAllMutation.isPending}>Cancel</Button>
            <Button onClick={() => payAllMutation.mutate()} disabled={payAllMutation.isPending || outstandingWorkers.length === 0} data-testid="button-confirm-pay-all">
              {payAllMutation.isPending ? (<><Loader2 className="h-4 w-4 mr-1 animate-spin" />Paying…</>) : `Pay ${fmtAud(outstandingTotal)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}