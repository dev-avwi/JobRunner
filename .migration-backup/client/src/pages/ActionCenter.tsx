import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import type { JobRequest, Job, Client } from "@shared/schema";
import {
  AlertTriangle,
  Clock,
  Lightbulb,
  CheckCircle,
  DollarSign,
  Calendar,
  Briefcase,
  ArrowRight,
  ClipboardList,
  Check,
  X,
  User,
  FileText,
  MessageSquare,
  Zap,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  Eye,
  AlertCircle,
  Search,
  Mail,
  Edit3,
  Radio,
  UserPlus,
  Timer,
  Users,
  GitBranch,
} from "lucide-react";

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
  summary: {
    fixNowCount: number;
    thisWeekCount: number;
    suggestionsCount: number;
    totalCount: number;
  };
  sections: {
    fix_now: ActionItem[];
    this_week: ActionItem[];
    suggestions: ActionItem[];
  };
}

interface OperationalAlert {
  id: string;
  type: string;
  severity: "urgent" | "important" | "info";
  title: string;
  message: string;
  actionType: string;
  actionLabel: string;
  relatedJobId?: string;
  relatedUserId?: string;
  relatedInvoiceId?: string;
  workerName?: string;
  jobTitle?: string;
  timeInfo?: string;
}

interface OperationalAlertsData {
  alerts: OperationalAlert[];
  summary: {
    total: number;
    urgent: number;
    important: number;
    info: number;
  };
}

interface ActionCenterProps {
  onNavigate?: (path: string) => void;
}

interface WorkflowItem {
  id: string;
  label: string;
  sublabel?: string;
  amount?: string;
  badge?: string;
  badgeVariant?: "destructive" | "outline" | "default";
  reviewUrl?: string;
}

interface WorkflowDialogState {
  open: boolean;
  actionId: string;
  title: string;
  description: string;
  actionLabel: (count: number) => string;
  items: WorkflowItem[];
  unsendableNote?: string;
}

const categoryConfig: Record<string, { icon: typeof DollarSign; color: string; tint: string }> = {
  revenue: { icon: DollarSign, color: "hsl(142.1 76.2% 36.3%)", tint: "hsl(142.1 76.2% 36.3% / 0.04)" },
  schedule: { icon: Calendar, color: "hsl(221.2 83.2% 53.3%)", tint: "hsl(221.2 83.2% 53.3% / 0.04)" },
  operations: { icon: Briefcase, color: "hsl(262.1 83.3% 57.8%)", tint: "hsl(262.1 83.3% 57.8% / 0.04)" },
};

const sectionConfig = [
  {
    key: "fix_now" as const,
    label: "FIX NOW",
    countKey: "fixNowCount" as const,
    icon: AlertTriangle,
    dotColor: "hsl(var(--destructive))",
    bgColor: "hsl(var(--destructive) / 0.1)",
    accentColor: "hsl(var(--destructive))",
  },
  {
    key: "this_week" as const,
    label: "THIS WEEK",
    countKey: "thisWeekCount" as const,
    icon: Clock,
    dotColor: "hsl(38 92% 50%)",
    bgColor: "hsl(38 92% 50% / 0.1)",
    accentColor: "hsl(38 92% 50%)",
  },
  {
    key: "suggestions" as const,
    label: "SUGGESTIONS",
    countKey: "suggestionsCount" as const,
    icon: Lightbulb,
    dotColor: "hsl(142.1 76.2% 36.3%)",
    bgColor: "hsl(142.1 76.2% 36.3% / 0.1)",
    accentColor: "hsl(142.1 76.2% 36.3%)",
  },
];

const EXPANDABLE_ACTIONS = new Set([
  "revenue-leak-uninvoiced",
  "revenue-leak-overdue",
  "revenue-leak-draft-invoices",
  "revenue-leak-stale-quotes",
  "quotes-unsent",
  "jobs-missing-quotes",
]);

const PREVIEW_COUNT = 3;

function ActionCardSkeleton() {
  return (
    <div className="feed-card animate-pulse">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-3">
            <div className="h-4 w-16 rounded-md bg-muted" />
            <div className="h-5 w-3/4 rounded-md bg-muted" />
            <div className="h-4 w-full rounded-md bg-muted" />
            <div className="h-4 w-1/2 rounded-md bg-muted" />
          </div>
          <div className="h-9 w-28 rounded-md bg-muted flex-shrink-0" />
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="section-gap">
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="feed-card animate-pulse p-4 space-y-2">
            <div className="h-10 w-10 rounded-xl bg-muted" />
            <div className="h-8 w-12 rounded bg-muted" />
            <div className="h-3 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-4 w-24 rounded bg-muted animate-pulse" />
        <ActionCardSkeleton />
        <ActionCardSkeleton />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-24 rounded bg-muted animate-pulse" />
        <ActionCardSkeleton />
      </div>
    </div>
  );
}

function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return "";
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(amount: string | number | null | undefined): string {
  const val = parseFloat(String(amount || '0'));
  return `$${val.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function daysOverdue(dueDate: string | Date | null | undefined): number {
  if (!dueDate) return 0;
  const now = new Date();
  const due = new Date(dueDate);
  return Math.max(0, Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
}

const urgencyConfig: Record<string, { variant: "default" | "outline" | "destructive"; label: string }> = {
  normal: { variant: "outline", label: "Normal" },
  urgent: { variant: "default", label: "Urgent" },
  emergency: { variant: "destructive", label: "Emergency" },
};

const severityConfig = {
  urgent: {
    icon: AlertTriangle,
    color: "hsl(var(--destructive))",
    bg: "hsl(var(--destructive) / 0.1)",
    label: "Urgent",
  },
  important: {
    icon: Clock,
    color: "hsl(38 92% 50%)",
    bg: "hsl(38 92% 50% / 0.1)",
    label: "Important",
  },
  info: {
    icon: Lightbulb,
    color: "hsl(221.2 83.2% 53.3%)",
    bg: "hsl(221.2 83.2% 53.3% / 0.1)",
    label: "Info",
  },
};

const alertTypeIcons: Record<string, typeof AlertTriangle> = {
  schedule_risk: Timer,
  unassigned_upcoming: UserPlus,
  job_overrun: Clock,
  worker_idle: Users,
  schedule_conflict: GitBranch,
  uninvoiced_job: DollarSign,
};

function LiveOpsSection({ navigate }: { navigate: (path: string) => void }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(true);

  const { data: opsData, isLoading } = useQuery<OperationalAlertsData>({
    queryKey: ["/api/operational-alerts"],
    refetchInterval: 60000,
  });

  const handleAlertAction = (alert: OperationalAlert) => {
    switch (alert.actionType) {
      case "view":
        if (alert.relatedJobId) navigate(`/jobs/${alert.relatedJobId}`);
        break;
      case "navigate":
        navigate("/schedule");
        break;
      case "assign":
        if (alert.relatedJobId) navigate(`/jobs/${alert.relatedJobId}`);
        break;
      case "nudge":
        navigate("/schedule");
        break;
      case "invoice":
        if (alert.relatedJobId) navigate(`/jobs/${alert.relatedJobId}`);
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="animate-fade-up">
        <div className="feed-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full bg-muted animate-pulse" />
            <div className="h-4 w-20 rounded bg-muted animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-12 rounded-md bg-muted animate-pulse" />
            <div className="h-12 rounded-md bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!opsData || opsData.alerts.length === 0) return null;

  const visibleAlerts = expanded ? opsData.alerts : opsData.alerts.slice(0, 3);

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4" style={{ color: "hsl(var(--destructive))" }} />
          <p className="ios-label">LIVE OPS</p>
          {opsData.summary.urgent > 0 && (
            <Badge variant="destructive" className="no-default-hover-elevate no-default-active-elevate text-xs">
              {opsData.summary.urgent} urgent
            </Badge>
          )}
          {opsData.summary.important > 0 && (
            <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-xs" style={{ borderColor: "hsl(38 92% 50% / 0.4)", color: "hsl(38 92% 50%)" }}>
              {opsData.summary.important} important
            </Badge>
          )}
        </div>
        {opsData.alerts.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Show less" : `Show all (${opsData.alerts.length})`}
            {expanded ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {visibleAlerts.map((alert) => {
          const severity = severityConfig[alert.severity];
          const SeverityIcon = severity.icon;
          const TypeIcon = alertTypeIcons[alert.type] || AlertCircle;

          return (
            <div key={alert.id} className="flex rounded-2xl overflow-visible">
              <div className="w-1 flex-shrink-0 rounded-l-2xl" style={{ backgroundColor: severity.color }} />
              <div
                className="feed-card flex-1 rounded-l-none card-press cursor-pointer"
                style={{ backgroundColor: severity.bg }}
                onClick={() => handleAlertAction(alert)}
              >
                <div className="p-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: `${severity.color}1a` }}
                      >
                        <TypeIcon className="h-3.5 w-3.5" style={{ color: severity.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground leading-snug">{alert.title}</p>
                          {alert.timeInfo && (
                            <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-xs">
                              {alert.timeInfo}
                            </Badge>
                          )}
                        </div>
                        <p className="ios-caption mt-0.5 line-clamp-2">{alert.message}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={alert.severity === "urgent" ? "default" : "outline"}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAlertAction(alert);
                      }}
                    >
                      {alert.actionLabel}
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ActionCenter({ onNavigate }: ActionCenterProps) {
  const [, setLocation] = useLocation();
  const navigate = onNavigate || setLocation;
  const { toast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);

  const focusUninvoiced = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('focus') === 'uninvoiced';

  const [workflowDialog, setWorkflowDialog] = useState<WorkflowDialogState | null>(null);
  const [selectedIds, setSelectedIds] = useState<Record<string, Set<string>>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const hasAutoOpened = useRef(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    actionId: string;
    title: string;
    description: string;
    confirmLabel: string;
    items: Array<{ id: string; label: string; sublabel?: string }>;
    isSendAction?: boolean;
  } | null>(null);

  const [batchSubject, setBatchSubject] = useState("");
  const [batchMessage, setBatchMessage] = useState("");
  const [batchTone, setBatchTone] = useState<'friendly' | 'formal' | 'brief'>('friendly');
  const [showMessageEditor, setShowMessageEditor] = useState(false);

  const { data: businessSettings } = useQuery<any>({
    queryKey: ['/api/business-settings'],
  });

  const { data, isLoading } = useQuery<ActionCenterData>({
    queryKey: ["/api/bi/action-center"],
  });

  const { data: pendingRequests = [], isLoading: requestsLoading } = useQuery<JobRequest[]>({
    queryKey: ["/api/job-requests", { status: "pending" }],
  });

  const needsData = workflowDialog !== null || focusUninvoiced;

  const { data: allJobs = [], isSuccess: jobsLoaded } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    enabled: needsData,
  });

  const { data: allClients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: needsData,
  });

  const { data: allInvoices = [], isSuccess: invoicesLoaded } = useQuery<any[]>({
    queryKey: ["/api/invoices"],
    enabled: needsData,
  });

  const { data: allQuotes = [], isSuccess: quotesLoaded } = useQuery<any[]>({
    queryKey: ["/api/quotes"],
    enabled: needsData,
  });

  const allDataLoaded = jobsLoaded && invoicesLoaded && quotesLoaded;

  const clientMap = useMemo(() => {
    const map = new Map<string, Client>();
    allClients.forEach((c) => map.set(c.id, c));
    return map;
  }, [allClients]);

  useEffect(() => {
    if (focusUninvoiced && allDataLoaded && !hasAutoOpened.current) {
      hasAutoOpened.current = true;
      openWorkflowDialog("revenue-leak-uninvoiced");
    }
  }, [focusUninvoiced, allDataLoaded]);

  const getSelected = (actionId: string): Set<string> => selectedIds[actionId] || new Set();

  const toggleSelection = (actionId: string, itemId: string) => {
    setSelectedIds(prev => {
      const current = new Set(prev[actionId] || []);
      if (current.has(itemId)) {
        current.delete(itemId);
      } else {
        current.add(itemId);
      }
      return { ...prev, [actionId]: current };
    });
  };

  const toggleSelectAll = (actionId: string, allItemIds: string[]) => {
    setSelectedIds(prev => {
      const current = prev[actionId] || new Set();
      if (current.size === allItemIds.length) {
        return { ...prev, [actionId]: new Set() };
      }
      return { ...prev, [actionId]: new Set(allItemIds) };
    });
  };

  const buildWorkflowItems = (actionId: string): { items: WorkflowItem[]; unsendableNote?: string } => {
    if (actionId === "revenue-leak-uninvoiced") {
      const invoicedJobIds = new Set(allInvoices.filter((inv: any) => inv.jobId).map((inv: any) => inv.jobId));
      const jobs = allJobs.filter((j) => j.status === "done" && !invoicedJobIds.has(j.id));
      return {
        items: jobs.map(j => ({
          id: j.id,
          label: j.title || 'Untitled Job',
          sublabel: j.clientId ? clientMap.get(j.clientId)?.name : undefined,
          badge: "Done",
          reviewUrl: `/jobs/${j.id}`,
        })),
      };
    }

    if (actionId === "revenue-leak-draft-invoices") {
      const drafts = allInvoices.filter((inv: any) => inv.status === 'draft');
      const sendable = drafts.filter((inv: any) => {
        const client = inv.clientId ? clientMap.get(inv.clientId) : null;
        return client?.email;
      });
      const unsendableCount = drafts.length - sendable.length;
      return {
        items: sendable.map((inv: any) => {
          const client = inv.clientId ? clientMap.get(inv.clientId) : null;
          return {
            id: inv.id,
            label: inv.number || 'Draft Invoice',
            sublabel: client?.name || 'No client',
            amount: formatCurrency(inv.total),
            reviewUrl: `/invoices/${inv.id}`,
          };
        }),
        unsendableNote: unsendableCount > 0
          ? `${unsendableCount} invoice${unsendableCount !== 1 ? 's' : ''} can't be sent — client has no email address`
          : undefined,
      };
    }

    if (actionId === "revenue-leak-overdue") {
      const now = new Date();
      const overdue = allInvoices.filter((inv: any) => {
        if (inv.status === 'paid' || inv.status === 'draft') return false;
        if (!inv.dueDate) return false;
        return new Date(inv.dueDate) < now;
      }).sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      const sendable = overdue.filter((inv: any) => {
        const client = inv.clientId ? clientMap.get(inv.clientId) : null;
        return client?.email;
      });
      return {
        items: sendable.map((inv: any) => {
          const client = inv.clientId ? clientMap.get(inv.clientId) : null;
          const days = daysOverdue(inv.dueDate);
          return {
            id: inv.id,
            label: inv.number || 'Invoice',
            sublabel: client?.name || 'Unknown client',
            amount: formatCurrency(inv.total),
            badge: days > 30 ? "30d+" : `${days}d overdue`,
            badgeVariant: (days > 30 ? "destructive" : "outline") as "destructive" | "outline",
            reviewUrl: `/invoices/${inv.id}`,
          };
        }),
      };
    }

    if (actionId === "revenue-leak-stale-quotes") {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const stale = allQuotes.filter((q: any) => {
        if (q.status !== 'sent') return false;
        const sentDate = q.sentAt ? new Date(q.sentAt) : (q.createdAt ? new Date(q.createdAt) : null);
        return sentDate && sentDate < sevenDaysAgo;
      });
      const sendable = stale.filter((q: any) => {
        const client = q.clientId ? clientMap.get(q.clientId) : null;
        return client?.email;
      });
      return {
        items: sendable.map((q: any) => {
          const client = q.clientId ? clientMap.get(q.clientId) : null;
          const sentDate = q.sentAt || q.createdAt;
          const daysSince = sentDate ? Math.floor((Date.now() - new Date(sentDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
          return {
            id: q.id,
            label: q.number || 'Quote',
            sublabel: client?.name || 'Unknown client',
            amount: formatCurrency(q.total),
            badge: `Sent ${daysSince}d ago`,
            reviewUrl: `/quotes/${q.id}`,
          };
        }),
      };
    }

    if (actionId === "quotes-unsent") {
      const drafts = allQuotes.filter((q: any) => q.status === 'draft');
      const sendable = drafts.filter((q: any) => {
        const client = q.clientId ? clientMap.get(q.clientId) : null;
        return client?.email;
      });
      const unsendableCount = drafts.length - sendable.length;
      return {
        items: sendable.map((q: any) => {
          const client = q.clientId ? clientMap.get(q.clientId) : null;
          return {
            id: q.id,
            label: q.number || 'Draft Quote',
            sublabel: client?.name || 'No client',
            amount: formatCurrency(q.total),
            reviewUrl: `/quotes/${q.id}`,
          };
        }),
        unsendableNote: unsendableCount > 0
          ? `${unsendableCount} quote${unsendableCount !== 1 ? 's' : ''} can't be sent — client has no email address`
          : undefined,
      };
    }

    if (actionId === "jobs-missing-quotes") {
      const activeJobs = allJobs.filter(j => j.status === 'in_progress' || j.status === 'scheduled');
      const jobsNoQuote = activeJobs.filter(j => !allQuotes.some((q: any) => q.jobId === j.id));
      return {
        items: jobsNoQuote.map(j => ({
          id: j.id,
          label: j.title || 'Untitled Job',
          sublabel: j.clientId ? clientMap.get(j.clientId)?.name : undefined,
          reviewUrl: `/jobs/${j.id}`,
        })),
      };
    }

    return { items: [] };
  };

  const getWorkflowConfig = (actionId: string): { title: string; description: string; actionLabel: (count: number) => string } => {
    switch (actionId) {
      case "revenue-leak-uninvoiced":
        return {
          title: "Uninvoiced Completed Jobs",
          description: "These jobs are done but haven't been invoiced yet. Select which ones to create invoices for.",
          actionLabel: (c) => `Create ${c} Invoice${c !== 1 ? 's' : ''}`,
        };
      case "revenue-leak-draft-invoices":
        return {
          title: "Draft Invoices Ready to Send",
          description: "These invoices are sitting in draft. Select which ones to send to your clients by email.",
          actionLabel: (c) => `Send ${c} Invoice${c !== 1 ? 's' : ''}`,
        };
      case "revenue-leak-overdue":
        return {
          title: "Overdue Invoices",
          description: "These invoices are past their due date. Select which ones to send a payment reminder for.",
          actionLabel: (c) => `Send ${c} Reminder${c !== 1 ? 's' : ''}`,
        };
      case "revenue-leak-stale-quotes":
        return {
          title: "Stale Quotes — No Response",
          description: "These quotes were sent over 7 days ago with no response. Select which ones to follow up on.",
          actionLabel: (c) => `Resend ${c} Quote${c !== 1 ? 's' : ''}`,
        };
      case "quotes-unsent":
        return {
          title: "Draft Quotes Ready to Send",
          description: "These quotes are sitting in draft. Select which ones to send to your clients by email.",
          actionLabel: (c) => `Send ${c} Quote${c !== 1 ? 's' : ''}`,
        };
      case "jobs-missing-quotes":
        return {
          title: "Active Jobs Without Quotes",
          description: "These active jobs don't have a quote attached yet.",
          actionLabel: () => "Create Quote",
        };
      default:
        return { title: "Items", description: "", actionLabel: (c) => `Process ${c}` };
    }
  };

  const openWorkflowDialog = (actionId: string) => {
    const config = getWorkflowConfig(actionId);
    const { items, unsendableNote } = buildWorkflowItems(actionId);
    setSearchQuery("");
    setWorkflowDialog({
      open: true,
      actionId,
      title: config.title,
      description: config.description,
      actionLabel: config.actionLabel,
      items,
      unsendableNote,
    });
  };

  const batchInvoiceMutation = useMutation({
    mutationFn: async (jobIds: string[]) => {
      const res = await apiRequest("POST", "/api/invoices/batch", { jobIds });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Invoices created",
        description: `Created ${data.summary.success} invoice${data.summary.success !== 1 ? 's' : ''} totaling ${formatCurrency(data.summary.totalAmount)}`,
      });
      setSelectedIds(prev => ({ ...prev, "revenue-leak-uninvoiced": new Set() }));
      setWorkflowDialog(null);
      queryClient.invalidateQueries({ queryKey: ["/api/bi/action-center"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/unified"] });
    },
    onError: () => {
      toast({ title: "Failed to create invoices", variant: "destructive" });
    },
  });

  const batchSendInvoicesMutation = useMutation({
    mutationFn: async (invoiceIds: string[]) => {
      const res = await apiRequest("POST", "/api/invoices/batch-send", {
        invoiceIds,
        customSubject: batchSubject || undefined,
        customMessage: batchMessage || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.summary.failed > 0) {
        const failedItems = data.results.filter((r: any) => !r.success);
        toast({
          title: `Sent ${data.summary.success} of ${data.summary.total} invoices`,
          description: `${data.summary.failed} failed: ${failedItems.map((f: any) => f.error).join(', ')}`,
          variant: data.summary.success > 0 ? "default" : "destructive",
        });
      } else {
        toast({
          title: `${data.summary.success} invoice${data.summary.success !== 1 ? 's' : ''} sent`,
          description: "Clients will receive their invoices by email",
        });
      }
      setSelectedIds({});
      setWorkflowDialog(null);
      queryClient.invalidateQueries({ queryKey: ["/api/bi/action-center"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/unified"] });
    },
    onError: () => {
      toast({ title: "Failed to send invoices", variant: "destructive" });
    },
  });

  const batchSendQuotesMutation = useMutation({
    mutationFn: async (quoteIds: string[]) => {
      const res = await apiRequest("POST", "/api/quotes/batch-send", {
        quoteIds,
        customSubject: batchSubject || undefined,
        customMessage: batchMessage || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.summary.failed > 0) {
        const failedItems = data.results.filter((r: any) => !r.success);
        toast({
          title: `Sent ${data.summary.success} of ${data.summary.total} quotes`,
          description: `${data.summary.failed} failed: ${failedItems.map((f: any) => f.error).join(', ')}`,
          variant: data.summary.success > 0 ? "default" : "destructive",
        });
      } else {
        toast({
          title: `${data.summary.success} quote${data.summary.success !== 1 ? 's' : ''} sent`,
          description: "Clients will receive their quotes by email",
        });
      }
      setSelectedIds({});
      setWorkflowDialog(null);
      queryClient.invalidateQueries({ queryKey: ["/api/bi/action-center"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/unified"] });
    },
    onError: () => {
      toast({ title: "Failed to send quotes", variant: "destructive" });
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/job-requests/${id}`, { status });
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.status === "accepted" ? "Request accepted" : "Request declined",
        description: variables.status === "accepted"
          ? "The job request has been accepted."
          : "The job request has been declined.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/job-requests"], exact: false });
      if (variables.status === "accepted") {
        queryClient.invalidateQueries({ queryKey: ["/api/jobs"], exact: false });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/unified"] });
      }
    },
    onError: () => {
      toast({ title: "Failed to update request", variant: "destructive" });
    },
  });

  const getCategoryIcon = (category: string) => categoryConfig[category]?.icon || Briefcase;
  const getCategoryColor = (category: string) => categoryConfig[category]?.color || "hsl(var(--muted-foreground))";
  const getCategoryTint = (category: string) => categoryConfig[category]?.tint || "transparent";

  const isBusy = batchInvoiceMutation.isPending || batchSendInvoicesMutation.isPending || batchSendQuotesMutation.isPending;

  const getBatchToneMessage = (tone: 'friendly' | 'formal' | 'brief', docType: 'invoice' | 'quote' | 'reminder') => {
    const bizName = businessSettings?.businessName || 'our team';
    const tones = {
      friendly: {
        invoice: { subject: `Your invoice from ${bizName}`, message: `Hey there!\n\nJust popping this invoice through for the work we've done. You can view the details and pay online using the link below - super easy!\n\nThanks heaps for your custom - really appreciate it!\n\nCheers,\n${bizName}` },
        quote: { subject: `Your quote from ${bizName}`, message: `Hey there!\n\nGreat chatting with you - here's the quote we put together. Have a look through and let us know if you've got any questions or want to tweak anything!\n\nCheers,\n${bizName}` },
        reminder: { subject: `Friendly reminder from ${bizName}`, message: `Hey there!\n\nJust a quick heads up - we've got an invoice that's past due. No stress, these things happen! You can view and pay it online using the link below.\n\nGive us a bell if you need to chat about it.\n\nCheers,\n${bizName}` },
      },
      formal: {
        invoice: { subject: `Invoice from ${bizName}`, message: `Dear Client,\n\nPlease find attached your tax invoice for services rendered.\n\nPayment is due within the terms specified on the invoice. A secure payment link has been included for your convenience.\n\nShould you have any queries regarding this invoice, please do not hesitate to contact us.\n\nKind regards,\n${bizName}` },
        quote: { subject: `Quotation from ${bizName}`, message: `Dear Client,\n\nPlease find attached the quotation as requested. This quote remains valid for 30 days from the date of issue.\n\nShould you have any queries or require clarification, please do not hesitate to contact us.\n\nKind regards,\n${bizName}` },
        reminder: { subject: `Payment reminder from ${bizName}`, message: `Dear Client,\n\nWe wish to bring to your attention that payment for the attached invoice is now overdue.\n\nWe would appreciate your prompt attention to this matter. A payment link has been included for your convenience.\n\nKind regards,\n${bizName}` },
      },
      brief: {
        invoice: { subject: `Invoice - ${bizName}`, message: `Hi,\n\nYour invoice is attached. Payment link included.\n\nCheers,\n${bizName}` },
        quote: { subject: `Quote - ${bizName}`, message: `Hi,\n\nYour quote is attached. Let us know if you'd like to go ahead.\n\nCheers,\n${bizName}` },
        reminder: { subject: `Payment overdue - ${bizName}`, message: `Hi,\n\nJust a reminder - your invoice is overdue. Payment link included.\n\nCheers,\n${bizName}` },
      },
    };
    return tones[tone][docType];
  };

  const getDocTypeForAction = (actionId: string): 'invoice' | 'quote' | 'reminder' => {
    if (actionId === 'revenue-leak-overdue') return 'reminder';
    if (actionId.includes('quote')) return 'quote';
    return 'invoice';
  };

  const isSendAction = (actionId: string) => {
    return ['revenue-leak-draft-invoices', 'revenue-leak-overdue', 'quotes-unsent', 'revenue-leak-stale-quotes'].includes(actionId);
  };

  const handleBatchAction = (actionId: string, ids: string[]) => {
    if (ids.length === 0) return;

    const getConfirmDetails = (): { title: string; description: string; confirmLabel: string } => {
      switch (actionId) {
        case "revenue-leak-uninvoiced":
          return {
            title: `Create ${ids.length} Invoice${ids.length !== 1 ? 's' : ''}?`,
            description: "Draft invoices will be created for these completed jobs. You can review and edit each one before sending.",
            confirmLabel: `Create ${ids.length} Invoice${ids.length !== 1 ? 's' : ''}`,
          };
        case "revenue-leak-draft-invoices":
          return {
            title: `Send ${ids.length} Invoice${ids.length !== 1 ? 's' : ''} to Clients?`,
            description: "Review and customise the email message before sending.",
            confirmLabel: `Send ${ids.length} Invoice${ids.length !== 1 ? 's' : ''}`,
          };
        case "revenue-leak-overdue":
          return {
            title: `Send ${ids.length} Payment Reminder${ids.length !== 1 ? 's' : ''}?`,
            description: "Review and customise the reminder message before sending.",
            confirmLabel: `Send ${ids.length} Reminder${ids.length !== 1 ? 's' : ''}`,
          };
        case "quotes-unsent":
          return {
            title: `Send ${ids.length} Quote${ids.length !== 1 ? 's' : ''} to Clients?`,
            description: "Review and customise the email message before sending.",
            confirmLabel: `Send ${ids.length} Quote${ids.length !== 1 ? 's' : ''}`,
          };
        case "revenue-leak-stale-quotes":
          return {
            title: `Resend ${ids.length} Quote${ids.length !== 1 ? 's' : ''} as Follow Up?`,
            description: "Review and customise the follow-up message before sending.",
            confirmLabel: `Resend ${ids.length} Quote${ids.length !== 1 ? 's' : ''}`,
          };
        default:
          return { title: "Confirm Action", description: "Are you sure?", confirmLabel: "Confirm" };
      }
    };

    const details = getConfirmDetails();
    const dialogItems = workflowDialog?.items?.filter(i => ids.includes(i.id)) || [];

    const isASendAction = isSendAction(actionId);
    if (isASendAction) {
      const docType = getDocTypeForAction(actionId);
      const defaultTone = 'friendly';
      const defaultMsg = getBatchToneMessage(defaultTone, docType);
      setBatchTone(defaultTone);
      setBatchSubject(defaultMsg.subject);
      setBatchMessage(defaultMsg.message);
      setShowMessageEditor(true);
    } else {
      setShowMessageEditor(false);
    }

    setConfirmDialog({
      open: true,
      actionId,
      ...details,
      isSendAction: isASendAction,
      items: dialogItems.map(i => ({
        id: i.id,
        label: `${i.label}${i.amount ? ' — ' + i.amount : ''}`,
        sublabel: i.sublabel,
      })),
    });
  };

  const executeConfirmedAction = () => {
    if (!confirmDialog) return;
    const { actionId } = confirmDialog;
    const ids = confirmDialog.items.map(i => i.id);

    if (actionId === "revenue-leak-uninvoiced") {
      batchInvoiceMutation.mutate(ids);
    } else if (actionId === "revenue-leak-draft-invoices" || actionId === "revenue-leak-overdue") {
      batchSendInvoicesMutation.mutate(ids);
    } else if (actionId === "quotes-unsent" || actionId === "revenue-leak-stale-quotes") {
      batchSendQuotesMutation.mutate(ids);
    }

    setConfirmDialog(null);
  };

  const getPreviewItems = (actionId: string): string[] => {
    if (!allDataLoaded) return [];
    const { items } = buildWorkflowItems(actionId);
    return items.slice(0, PREVIEW_COUNT).map(i => {
      let text = i.label;
      if (i.sublabel) text += ` — ${i.sublabel}`;
      if (i.amount) text += ` (${i.amount})`;
      return text;
    });
  };

  const getItemCount = (actionId: string): number | null => {
    if (!allDataLoaded) return null;
    return buildWorkflowItems(actionId).items.length;
  };

  const isEmpty = data && data.summary.totalCount === 0;

  return (
    <PageShell>
      <PageHeader
        title="Action Centre"
        subtitle="What needs your attention"
        leading={<Zap className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />}
      />

      <LiveOpsSection navigate={navigate} />

      {(isLoading || requestsLoading) && pendingRequests.length === 0 && (
        <LoadingSkeleton />
      )}

      {isEmpty && pendingRequests.length === 0 && (
        <div className="animate-fade-up">
          <div className="feed-card">
            <div className="py-16 text-center">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "linear-gradient(135deg, hsl(142.1 76.2% 36.3% / 0.12), hsl(142.1 76.2% 36.3% / 0.06))" }}
              >
                <CheckCircle className="h-10 w-10" style={{ color: "hsl(142.1 76.2% 36.3%)" }} />
              </div>
              <p className="text-lg font-semibold text-foreground mb-1">You're all caught up!</p>
              <p className="ios-caption max-w-xs mx-auto">No actions needed right now. We'll notify you when something needs your attention.</p>
            </div>
          </div>
        </div>
      )}

      {(data || pendingRequests.length > 0) && !(isEmpty && pendingRequests.length === 0) && (
        <div className="section-gap">
          {data && (
            <div className="animate-fade-up">
              <div className="grid grid-cols-4 gap-3">
                {sectionConfig.map((section, idx) => {
                  const count = data.summary[section.countKey];
                  const SectionIcon = section.icon;
                  const isHero = section.key === "fix_now";
                  return (
                    <div
                      key={section.key}
                      className={`feed-card card-press p-4 animate-fade-up stagger-delay-${idx + 1}`}
                      style={isHero && count > 0 ? { background: `linear-gradient(135deg, ${section.bgColor}, hsl(var(--card)))` } : undefined}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                        style={{ backgroundColor: section.bgColor }}
                      >
                        <SectionIcon className="h-5 w-5" style={{ color: section.dotColor }} />
                      </div>
                      <p className="text-2xl font-bold text-foreground">{count}</p>
                      <p className="ios-label mt-1">{section.label}</p>
                    </div>
                  );
                })}
                <div className="feed-card card-press p-4 animate-fade-up stagger-delay-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                    style={{ backgroundColor: "hsl(221.2 83.2% 53.3% / 0.1)" }}
                  >
                    <ClipboardList className="h-5 w-5" style={{ color: "hsl(221.2 83.2% 53.3%)" }} />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{pendingRequests.length}</p>
                  <p className="ios-label mt-1">REQUESTS</p>
                </div>
              </div>
            </div>
          )}

          {(data || pendingRequests.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-start animate-fade-up stagger-delay-4">
              {data && sectionConfig.map((section) => {
                const items = data.sections[section.key] || [];
                const count = data.summary[section.countKey];

                return (
                  <div key={section.key} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: section.dotColor }} />
                      <p className="ios-label">{section.label}</p>
                      <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-xs">{count}</Badge>
                    </div>

                    {items.length === 0 ? (
                      <div className="feed-card p-4 flex flex-col items-center justify-center text-center min-h-[80px]">
                        <CheckCircle className="h-5 w-5 text-muted-foreground/40 mb-1.5" />
                        <p className="text-xs text-muted-foreground">All clear</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {items.map((action) => {
                          const CategoryIcon = getCategoryIcon(action.category);
                          const isExpandable = EXPANDABLE_ACTIONS.has(action.id);

                          return (
                            <div key={action.id} className="flex rounded-2xl overflow-visible">
                              <div className="w-1 flex-shrink-0 rounded-l-2xl" style={{ backgroundColor: section.accentColor }} />
                              <div
                                className="feed-card flex-1 rounded-l-none card-press cursor-pointer"
                                style={{ backgroundColor: getCategoryTint(action.category) }}
                                onClick={isExpandable ? () => openWorkflowDialog(action.id) : () => navigate(action.ctaUrl)}
                              >
                                <div className="p-3">
                                  <div className="flex flex-col gap-2">
                                    <div className="flex items-start justify-between gap-2 flex-wrap">
                                      <div className="flex items-center gap-2">
                                        <div
                                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                          style={{ backgroundColor: `${getCategoryColor(action.category)}1a` }}
                                        >
                                          <CategoryIcon className="h-3.5 w-3.5" style={{ color: getCategoryColor(action.category) }} />
                                        </div>
                                        <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-xs capitalize">
                                          {action.category}
                                        </Badge>
                                      </div>
                                      {action.metric && (
                                        <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs font-semibold">
                                          {action.metric}
                                        </Badge>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-foreground leading-snug">{action.title}</p>
                                      <p className="ios-caption mt-0.5 line-clamp-2">{action.description}</p>
                                    </div>
                                    {action.impact && <p className="ios-caption line-clamp-1">{action.impact}</p>}

                                    <div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (isExpandable) {
                                            openWorkflowDialog(action.id);
                                          } else {
                                            navigate(action.ctaUrl);
                                          }
                                        }}
                                      >
                                        {action.cta}
                                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {pendingRequests.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: "hsl(221.2 83.2% 53.3%)" }} />
                    <p className="ios-label">CLIENT REQUESTS</p>
                    <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-xs">{pendingRequests.length}</Badge>
                  </div>

                  <div className="flex flex-col gap-2">
                    {pendingRequests.map((request) => {
                      const urgency = urgencyConfig[request.urgency] || urgencyConfig.normal;
                      return (
                        <div key={request.id} className="flex rounded-2xl overflow-hidden">
                          <div className="w-1 flex-shrink-0" style={{ backgroundColor: "hsl(221.2 83.2% 53.3%)" }} />
                          <div
                            className="feed-card card-press flex-1 rounded-l-none cursor-pointer"
                            onClick={() => { setSelectedRequest(request); setRequestDialogOpen(true); }}
                          >
                            <div className="p-3">
                              <div className="flex flex-col gap-2">
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                      style={{ backgroundColor: "hsl(221.2 83.2% 53.3% / 0.1)" }}
                                    >
                                      <ClipboardList className="h-3.5 w-3.5" style={{ color: "hsl(221.2 83.2% 53.3%)" }} />
                                    </div>
                                    <p className="text-sm font-semibold text-foreground leading-snug">{request.title}</p>
                                  </div>
                                  <Badge
                                    variant={urgency.variant}
                                    className={`no-default-hover-elevate no-default-active-elevate text-xs ${request.urgency === "urgent" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25" : ""}`}
                                  >
                                    {urgency.label}
                                  </Badge>
                                </div>
                                {request.description && <p className="ios-caption line-clamp-2">{request.description}</p>}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    disabled={updateRequestMutation.isPending}
                                    onClick={(e) => { e.stopPropagation(); updateRequestMutation.mutate({ id: request.id, status: "accepted" }); }}
                                  >
                                    <Check className="h-3.5 w-3.5 mr-1" />Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={updateRequestMutation.isPending}
                                    onClick={(e) => { e.stopPropagation(); updateRequestMutation.mutate({ id: request.id, status: "declined" }); }}
                                  >
                                    <X className="h-3.5 w-3.5 mr-1" />Decline
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {workflowDialog && (() => {
        const { actionId, items, unsendableNote, title, description, actionLabel } = workflowDialog;
        const isJobsNoQuotes = actionId === "jobs-missing-quotes";
        const selected = getSelected(actionId);
        const query = searchQuery.toLowerCase();
        const filteredItems = query
          ? items.filter(i =>
              i.label.toLowerCase().includes(query) ||
              (i.sublabel && i.sublabel.toLowerCase().includes(query)) ||
              (i.amount && i.amount.toLowerCase().includes(query))
            )
          : items;
        const allFilteredIds = filteredItems.map(i => i.id);

        return (
          <Dialog open={workflowDialog.open} onOpenChange={(open) => { if (!open) { setWorkflowDialog(null); setSearchQuery(""); } }}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>
              </DialogHeader>

              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <CheckCircle className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Nothing here right now</p>
                </div>
              ) : (
                <>
                  {items.length > 5 && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name, number, or client..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  )}

                  {!isJobsNoQuotes && (
                    <div className="flex items-center justify-between gap-3 flex-wrap py-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={selected.size > 0 && allFilteredIds.every(id => selected.has(id))}
                          onCheckedChange={() => toggleSelectAll(actionId, allFilteredIds)}
                        />
                        <span className="text-sm text-muted-foreground">
                          Select {query ? "filtered" : "all"} ({allFilteredIds.length})
                        </span>
                      </label>
                      {selected.size > 0 && (
                        <span className="text-xs text-muted-foreground">{selected.size} selected</span>
                      )}
                    </div>
                  )}

                  <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
                    <div className="flex flex-col gap-1">
                      {filteredItems.map((item) => {
                        const isSelected = selected.has(item.id);
                        return (
                          <div
                            key={item.id}
                            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                              isSelected ? "bg-primary/5" : "hover-elevate"
                            }`}
                          >
                            {!isJobsNoQuotes && (
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelection(actionId, item.id)}
                              />
                            )}
                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => !isJobsNoQuotes && toggleSelection(actionId, item.id)}
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-foreground">{item.label}</p>
                                {item.amount && (
                                  <span className="text-sm font-semibold text-foreground">{item.amount}</span>
                                )}
                                {item.badge && (
                                  <Badge
                                    variant={item.badgeVariant || "outline"}
                                    className="no-default-hover-elevate no-default-active-elevate text-xs"
                                  >
                                    {item.badge}
                                  </Badge>
                                )}
                              </div>
                              {item.sublabel && (
                                <p className="text-xs text-muted-foreground mt-0.5">{item.sublabel}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {item.reviewUrl && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setWorkflowDialog(null);
                                    navigate(item.reviewUrl!);
                                  }}
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1" />
                                  Review
                                </Button>
                              )}
                              {isJobsNoQuotes && item.reviewUrl && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setWorkflowDialog(null);
                                    navigate(`/quotes/new?jobId=${item.id}`);
                                  }}
                                >
                                  Create Quote
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {filteredItems.length === 0 && query && (
                        <div className="flex flex-col items-center py-6">
                          <Search className="h-6 w-6 text-muted-foreground/40 mb-2" />
                          <p className="text-sm text-muted-foreground">No matches for "{searchQuery}"</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {unsendableNote && (
                    <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                        {unsendableNote}
                      </p>
                    </div>
                  )}
                </>
              )}

              <DialogFooter className="flex items-center gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => { setWorkflowDialog(null); setSearchQuery(""); }}>
                  Close
                </Button>
                {!isJobsNoQuotes && items.length > 0 && (
                  <Button
                    disabled={selected.size === 0 || isBusy}
                    onClick={() => handleBatchAction(actionId, Array.from(selected))}
                  >
                    {isBusy ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Processing...</>
                    ) : (
                      <><Send className="h-3.5 w-3.5 mr-1.5" />{actionLabel(selected.size)}</>
                    )}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      <Dialog open={requestDialogOpen} onOpenChange={(open) => { setRequestDialogOpen(open); if (!open) setSelectedRequest(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{selectedRequest?.title}</span>
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs no-default-active-elevate">Request</Badge>
            </DialogTitle>
            <DialogDescription className="sr-only">Job request details</DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-2">
              {selectedRequest.clientName && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  {selectedRequest.clientId ? (
                    <button className="font-medium text-primary hover:underline text-left" onClick={() => { setRequestDialogOpen(false); navigate(`/clients/${selectedRequest.clientId}`); }}>
                      {selectedRequest.clientName}
                    </button>
                  ) : (
                    <span className="font-medium">{selectedRequest.clientName}</span>
                  )}
                </div>
              )}
              {selectedRequest.description && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 ios-label"><FileText className="h-3 w-3" />Description</div>
                  <p className="text-sm text-foreground">{selectedRequest.description}</p>
                </div>
              )}
              <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
                {selectedRequest.urgency && (
                  <Badge className={
                    selectedRequest.urgency === 'emergency' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 no-default-active-elevate' :
                    selectedRequest.urgency === 'urgent' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25 no-default-active-elevate' :
                    selectedRequest.urgency === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 no-default-active-elevate' :
                    'no-default-active-elevate'
                  }>
                    {(urgencyConfig[selectedRequest.urgency] || urgencyConfig.normal).label}
                  </Badge>
                )}
                {selectedRequest.preferredDate && (
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(selectedRequest.preferredDate)}</span>
                )}
                {selectedRequest.createdAt && (
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatRelativeTime(selectedRequest.createdAt)}</span>
                )}
              </div>
              {selectedRequest.notes && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 ios-label"><MessageSquare className="h-3 w-3" />Notes</div>
                  <p className="text-sm text-foreground">{selectedRequest.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex items-center gap-2">
            <Button variant="default" disabled={updateRequestMutation.isPending} onClick={() => { if (selectedRequest) { updateRequestMutation.mutate({ id: selectedRequest.id, status: "accepted" }); setRequestDialogOpen(false); } }}>
              <Check className="h-4 w-4 mr-1" />Accept
            </Button>
            <Button variant="outline" disabled={updateRequestMutation.isPending} onClick={() => { if (selectedRequest) { updateRequestMutation.mutate({ id: selectedRequest.id, status: "declined" }); setRequestDialogOpen(false); } }}>
              <X className="h-4 w-4 mr-1" />Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDialog?.open} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
        <DialogContent className={confirmDialog?.isSendAction ? "sm:max-w-lg" : ""}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmDialog?.isSendAction && <Mail className="h-4 w-4" />}
              {confirmDialog?.title}
            </DialogTitle>
            <DialogDescription>{confirmDialog?.description}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto py-1">
            {confirmDialog?.items.map(item => (
              <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.label}</p>
                  {item.sublabel && <p className="text-xs text-muted-foreground truncate">{item.sublabel}</p>}
                </div>
              </div>
            ))}
          </div>

          {confirmDialog?.isSendAction && showMessageEditor && (
            <div className="space-y-3 border-t pt-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Edit3 className="h-3.5 w-3.5" />
                  Email Message
                </Label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground mr-1">Tone:</span>
                  {(['friendly', 'formal', 'brief'] as const).map(tone => (
                    <Button
                      key={tone}
                      size="sm"
                      variant={batchTone === tone ? 'default' : 'outline'}
                      className="h-7 text-xs px-2.5"
                      onClick={() => {
                        setBatchTone(tone);
                        if (confirmDialog) {
                          const docType = getDocTypeForAction(confirmDialog.actionId);
                          const msg = getBatchToneMessage(tone, docType);
                          setBatchSubject(msg.subject);
                          setBatchMessage(msg.message);
                        }
                      }}
                    >
                      {tone.charAt(0).toUpperCase() + tone.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Subject</Label>
                <Input
                  value={batchSubject}
                  onChange={(e) => setBatchSubject(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Message</Label>
                <Textarea
                  value={batchMessage}
                  onChange={(e) => setBatchMessage(e.target.value)}
                  className="text-sm min-h-[120px] resize-none"
                />
                <p className="text-[11px] text-muted-foreground">
                  Document details, payment link, and your business info will be added automatically.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancel</Button>
            <Button disabled={isBusy} onClick={executeConfirmedAction}>
              {isBusy ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Processing...</>
              ) : (
                <><Send className="h-3.5 w-3.5 mr-1" />{confirmDialog?.confirmLabel}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
