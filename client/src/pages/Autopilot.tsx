import { useState, useCallback, useRef, useEffect, type ComponentProps, type ChangeEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getAuthHeaders} from "@/lib/queryClient";
import { PageShell, PageHeader, SectionTitle } from "@/components/ui/page-shell";
import {
  FileText,
  Calendar,
  DollarSign,
  Camera,
  MapPin,
  Receipt,
  Star,
  Zap,
  Plus,
  Settings,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Mail,
  MessageSquare,
  Activity,
  Truck,
} from "lucide-react";

interface AutopilotProps {
  onNavigate?: (path: string) => void;
}

interface AutomationSettings {
  quoteFollowUpEnabled?: boolean;
  quoteFollowUpDays?: number;
  quoteFollowUpType?: string;
  quoteFollowUpMessage?: string;
  jobReminderEnabled?: boolean;
  jobReminderHoursBefore?: number;
  jobReminderType?: string;
  jobReminderMessage?: string;
  invoiceReminderEnabled?: boolean;
  invoiceReminderDaysBeforeDue?: number;
  invoiceOverdueReminderDays?: number;
  invoiceReminderType?: string;
  invoiceReminderMessage?: string;
  photoRequirementsEnabled?: boolean;
  requirePhotoBeforeStart?: boolean;
  requirePhotoAfterComplete?: boolean;
  gpsAutoCheckInEnabled?: boolean;
  autoCheckInOnArrival?: boolean;
  autoCheckOutOnDeparture?: boolean;
  technicianEnRouteEnabled?: boolean;
  technicianEnRouteChannel?: string;
  autoInvoiceOnComplete?: boolean;
  autoReviewRequest?: boolean;
  autoReviewRequestType?: string;
  reviewRequestMessage?: string;
  [key: string]: boolean | number | string | undefined;
}

const DEFAULT_MESSAGES = {
  quoteFollowUpMessage: "Hi {client}, just following up on quote #{number} for {amount} we sent on {date}. Let us know if you have any questions or would like to go ahead.",
  jobReminderMessage: "Hi {client}, confirming your {jobType} appointment tomorrow at {time} at {address}. Reply YES to confirm or call us to reschedule.",
  invoiceReminderMessage: "Hi {client}, invoice #{number} for {amount} was due on {date}. Please arrange payment at your earliest convenience.",
  reviewRequestMessage: "Hi {client}, thanks for choosing {business}! We'd love to hear how we did. Your feedback helps us improve!",
};

const TEMPLATE_VARIABLES: Record<string, string[]> = {
  quoteFollowUpMessage: ["{client}", "{number}", "{amount}", "{date}"],
  jobReminderMessage: ["{client}", "{jobType}", "{time}", "{address}"],
  invoiceReminderMessage: ["{client}", "{number}", "{amount}", "{date}"],
  reviewRequestMessage: ["{client}", "{business}"],
};

type AutomationField = "quoteFollowUpEnabled" | "jobReminderEnabled" | "invoiceReminderEnabled" | "photoRequirementsEnabled" | "gpsAutoCheckInEnabled" | "technicianEnRouteEnabled" | "autoInvoiceOnComplete" | "autoReviewRequest";

const ENABLE_DEFAULTS: Partial<Record<AutomationField, Partial<AutomationSettings>>> = {
  quoteFollowUpEnabled: { quoteFollowUpDays: 3, quoteFollowUpType: "email", quoteFollowUpMessage: DEFAULT_MESSAGES.quoteFollowUpMessage },
  jobReminderEnabled: { jobReminderHoursBefore: 24, jobReminderType: "sms", jobReminderMessage: DEFAULT_MESSAGES.jobReminderMessage },
  invoiceReminderEnabled: { invoiceReminderDaysBeforeDue: 3, invoiceOverdueReminderDays: 7, invoiceReminderType: "email", invoiceReminderMessage: DEFAULT_MESSAGES.invoiceReminderMessage },
  photoRequirementsEnabled: { requirePhotoBeforeStart: true, requirePhotoAfterComplete: true },
  gpsAutoCheckInEnabled: { autoCheckInOnArrival: true, autoCheckOutOnDeparture: true },
  technicianEnRouteEnabled: { technicianEnRouteChannel: "sms" },
  autoReviewRequest: { autoReviewRequestType: "email", reviewRequestMessage: DEFAULT_MESSAGES.reviewRequestMessage },
};

interface AutomationConfig {
  field: AutomationField;
  title: string;
  subtitle: string;
  icon: typeof FileText;
  color: string;
  category: "communications" | "fieldwork" | "billing";
}

const FIELD_TO_API_TYPE: Record<AutomationField, string> = {
  quoteFollowUpEnabled: "quote_followup",
  jobReminderEnabled: "job_reminder",
  invoiceReminderEnabled: "invoice_reminder",
  photoRequirementsEnabled: "photo_requirement",
  gpsAutoCheckInEnabled: "gps_checkin",
  technicianEnRouteEnabled: "tech_en_route",
  autoInvoiceOnComplete: "auto_invoice",
  autoReviewRequest: "review_request",
};

const AUTOMATION_TYPE_LABELS: Record<string, string> = {
  quote_followup: "Quote follow-up",
  job_reminder: "Job reminder",
  invoice_reminder: "Invoice reminder",
  auto_invoice: "Auto-invoice",
  review_request: "Review request",
  photo_requirement: "Photo prompt",
  gps_checkin: "GPS check-in",
  sms_automation: "SMS automation",
  general: "Automation",
};

interface ActivityLogEntry {
  id: string;
  automationType: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  channel: string;
  status: string;
  recipientName: string;
  createdAt: string | null;
  errorMessage: string | null;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function ChannelBadge({ channel }: { channel: string }) {
  if (channel === "sms") return <Badge variant="outline" className="text-[10px] gap-0.5"><MessageSquare className="h-2.5 w-2.5" />SMS</Badge>;
  if (channel === "email") return <Badge variant="outline" className="text-[10px] gap-0.5"><Mail className="h-2.5 w-2.5" />Email</Badge>;
  if (channel === "both") return <Badge variant="outline" className="text-[10px] gap-0.5"><Mail className="h-2.5 w-2.5" />Both</Badge>;
  return null;
}

function ActivityLogItem({ entry }: { entry: ActivityLogEntry }) {
  const isFailed = entry.status === "failed" || entry.status === "error";
  return (
    <div className={`flex items-start gap-2.5 py-2 ${isFailed ? "opacity-80" : ""}`}>
      <div className="mt-0.5 flex-shrink-0">
        {isFailed ? (
          <XCircle className="h-3.5 w-3.5 text-destructive" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "hsl(142 76% 36%)" }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium truncate max-w-[200px]">
            {entry.entityLabel}
          </span>
          <ChannelBadge channel={entry.channel} />
          {isFailed && <Badge variant="destructive" className="text-[10px]">Failed</Badge>}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[11px] text-muted-foreground truncate">
            to {entry.recipientName}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {timeAgo(entry.createdAt)}
          </span>
        </div>
        {isFailed && entry.errorMessage && (
          <p className="text-[11px] text-destructive mt-0.5 truncate">{entry.errorMessage}</p>
        )}
      </div>
    </div>
  );
}

function AutomationActivityLog({ field, color }: { field: AutomationField; color: string }) {
  const apiType = FIELD_TO_API_TYPE[field];
  const [expanded, setExpanded] = useState(false);
  const limit = expanded ? 20 : 5;

  const { data: logs, isLoading, refetch } = useQuery<ActivityLogEntry[]>({
    queryKey: ["/api/autopilot/activity-log", apiType, limit],
    queryFn: async () => {
      const res = await fetch(`/api/autopilot/activity-log?type=${apiType}&limit=${limit}`, { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="pt-3 border-t border-border/50 mt-1">
        <div className="flex items-center gap-1.5 mb-2">
          <Activity className="h-3 w-3 text-muted-foreground" />
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Recent Activity</span>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="pt-3 border-t border-border/50 mt-1">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-muted-foreground" />
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Recent Activity</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5 italic">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="pt-3 border-t border-border/50 mt-1">
      <div className="flex items-center gap-1.5 mb-1">
        <Activity className="h-3 w-3" style={{ color: `hsl(${color})` }} />
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Recent Activity</span>
        <Badge variant="secondary" className="text-[9px] ml-auto">{logs.length}</Badge>
      </div>
      <div className="divide-y divide-border/30">
        {logs.map((entry) => (
          <ActivityLogItem key={entry.id} entry={entry} />
        ))}
      </div>
      {logs.length >= 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1.5 hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Show less" : "View all"}
        </button>
      )}
    </div>
  );
}

const automations: AutomationConfig[] = [
  {
    field: "quoteFollowUpEnabled",
    title: "Quote Follow-up",
    subtitle: "Sends follow-up after quote is sent with no response",
    icon: FileText,
    color: "210 100% 50%",
    category: "communications",
  },
  {
    field: "jobReminderEnabled",
    title: "Job Reminder",
    subtitle: "Sends confirmation before scheduled job start time",
    icon: Calendar,
    color: "142 76% 36%",
    category: "communications",
  },
  {
    field: "invoiceReminderEnabled",
    title: "Invoice Reminders",
    subtitle: "Sends payment reminders before due and when overdue",
    icon: DollarSign,
    color: "0 84% 60%",
    category: "billing",
  },
  {
    field: "photoRequirementsEnabled",
    title: "Photo Requirements",
    subtitle: "Prompts workers for before/after photos on jobs",
    icon: Camera,
    color: "38 92% 50%",
    category: "fieldwork",
  },
  {
    field: "gpsAutoCheckInEnabled",
    title: "GPS Auto Check-in",
    subtitle: "Auto start/stop timers at job sites via GPS",
    icon: MapPin,
    color: "270 70% 60%",
    category: "fieldwork",
  },
  {
    field: "technicianEnRouteEnabled",
    title: "Technician On Their Way",
    subtitle: "Notifies client when tech starts driving to job site",
    icon: Truck,
    color: "200 80% 50%",
    category: "communications",
  },
  {
    field: "autoInvoiceOnComplete",
    title: "Auto-invoice on Complete",
    subtitle: "Creates invoice automatically when job is completed",
    icon: Receipt,
    color: "174 72% 40%",
    category: "billing",
  },
  {
    field: "autoReviewRequest",
    title: "Review Request",
    subtitle: "Requests a review after invoice payment is confirmed",
    icon: Star,
    color: "48 96% 53%",
    category: "communications",
  },
];

function DebouncedTextarea({
  value: externalValue,
  onChange,
  ...props
}: { value: string; onChange: (v: string) => void } & Omit<ComponentProps<typeof Textarea>, 'value' | 'onChange'>) {
  const [localValue, setLocalValue] = useState(externalValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setLocalValue(externalValue); }, [externalValue]);
  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setLocalValue(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 800);
  }, [onChange]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  return <Textarea {...props} value={localValue} onChange={handleChange} />;
}

function DebouncedNumberInput({
  value: externalValue,
  onChange,
  ...props
}: { value: number; onChange: (v: number) => void } & Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'>) {
  const [localValue, setLocalValue] = useState(String(externalValue));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setLocalValue(String(externalValue)); }, [externalValue]);
  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalValue(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(parseInt(v) || 1), 600);
  }, [onChange]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  return <Input {...props} type="number" value={localValue} onChange={handleChange} />;
}

function ChannelSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1">
      {(["sms", "email", "both"] as const).map((ch) => (
        <Button
          key={ch}
          size="sm"
          variant={value === ch ? "default" : "outline"}
          onClick={() => onChange(ch)}
        >
          {ch === "sms" ? "SMS" : ch === "email" ? "Email" : "Both"}
        </Button>
      ))}
    </div>
  );
}

function InlineSettings({
  field,
  settings,
  onUpdate,
}: {
  field: AutomationField;
  settings: AutomationSettings;
  onUpdate: (changes: Partial<AutomationSettings>) => void;
}) {
  if (field === "quoteFollowUpEnabled") {
    const days = settings.quoteFollowUpDays ?? 3;
    const channel = settings.quoteFollowUpType ?? "email";
    const message = settings.quoteFollowUpMessage ?? DEFAULT_MESSAGES.quoteFollowUpMessage;
    return (
      <div className="flex flex-col gap-3 pt-3 border-t border-border/50">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Follow-up delay (days)</Label>
          <DebouncedNumberInput
            min={1}
            value={days}
            onChange={(v) => onUpdate({ quoteFollowUpDays: v })}
            className="w-24"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Channel</Label>
          <ChannelSelector value={channel} onChange={(v) => onUpdate({ quoteFollowUpType: v })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Message template</Label>
          <DebouncedTextarea
            value={message}
            onChange={(v) => onUpdate({ quoteFollowUpMessage: v })}
            rows={3}
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Variables: {TEMPLATE_VARIABLES.quoteFollowUpMessage.join(", ")}
          </p>
        </div>
      </div>
    );
  }

  if (field === "jobReminderEnabled") {
    const hours = settings.jobReminderHoursBefore ?? 24;
    const channel = settings.jobReminderType ?? "sms";
    const message = settings.jobReminderMessage ?? DEFAULT_MESSAGES.jobReminderMessage;
    return (
      <div className="flex flex-col gap-3 pt-3 border-t border-border/50">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Hours before job</Label>
          <DebouncedNumberInput
            min={1}
            value={hours}
            onChange={(v) => onUpdate({ jobReminderHoursBefore: v })}
            className="w-24"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Channel</Label>
          <ChannelSelector value={channel} onChange={(v) => onUpdate({ jobReminderType: v })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Message template</Label>
          <DebouncedTextarea
            value={message}
            onChange={(v) => onUpdate({ jobReminderMessage: v })}
            rows={3}
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Variables: {TEMPLATE_VARIABLES.jobReminderMessage.join(", ")}
          </p>
        </div>
      </div>
    );
  }

  if (field === "invoiceReminderEnabled") {
    const daysBefore = settings.invoiceReminderDaysBeforeDue ?? 3;
    const overdueInterval = settings.invoiceOverdueReminderDays ?? 7;
    const channel = settings.invoiceReminderType ?? "email";
    const message = settings.invoiceReminderMessage ?? DEFAULT_MESSAGES.invoiceReminderMessage;
    return (
      <div className="flex flex-col gap-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Days before due</Label>
            <DebouncedNumberInput
              min={1}
              value={daysBefore}
              onChange={(v) => onUpdate({ invoiceReminderDaysBeforeDue: v })}
              className="w-24"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Overdue repeat interval (days)</Label>
            <DebouncedNumberInput
              min={1}
              value={overdueInterval}
              onChange={(v) => onUpdate({ invoiceOverdueReminderDays: v })}
              className="w-24"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Channel</Label>
          <ChannelSelector value={channel} onChange={(v) => onUpdate({ invoiceReminderType: v })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Message template</Label>
          <DebouncedTextarea
            value={message}
            onChange={(v) => onUpdate({ invoiceReminderMessage: v })}
            rows={3}
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Variables: {TEMPLATE_VARIABLES.invoiceReminderMessage.join(", ")}
          </p>
        </div>
      </div>
    );
  }

  if (field === "photoRequirementsEnabled") {
    const beforeStart = settings.requirePhotoBeforeStart ?? true;
    const afterComplete = settings.requirePhotoAfterComplete ?? true;
    return (
      <div className="flex flex-col gap-3 pt-3 border-t border-border/50">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm">Require photo before start</Label>
          <Switch
            checked={beforeStart}
            onCheckedChange={(checked) => onUpdate({ requirePhotoBeforeStart: checked })}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm">Require photo after complete</Label>
          <Switch
            checked={afterComplete}
            onCheckedChange={(checked) => onUpdate({ requirePhotoAfterComplete: checked })}
          />
        </div>
      </div>
    );
  }

  if (field === "gpsAutoCheckInEnabled") {
    const checkIn = settings.autoCheckInOnArrival ?? true;
    const checkOut = settings.autoCheckOutOnDeparture ?? true;
    return (
      <div className="flex flex-col gap-3 pt-3 border-t border-border/50">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm">Auto check-in on arrival</Label>
          <Switch
            checked={checkIn}
            onCheckedChange={(checked) => onUpdate({ autoCheckInOnArrival: checked })}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm">Auto check-out on departure</Label>
          <Switch
            checked={checkOut}
            onCheckedChange={(checked) => onUpdate({ autoCheckOutOnDeparture: checked })}
          />
        </div>
      </div>
    );
  }

  if (field === "technicianEnRouteEnabled") {
    const channel = settings.technicianEnRouteChannel ?? "sms";
    return (
      <div className="flex flex-col gap-3 pt-3 border-t border-border/50">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Notification channel</Label>
          <ChannelSelector value={channel} onChange={(v) => onUpdate({ technicianEnRouteChannel: v })} />
        </div>
        <p className="text-xs text-muted-foreground">
          When a technician starts driving to a job, the client receives an automatic notification.
          Only sent once per job per trip.
        </p>
      </div>
    );
  }

  if (field === "autoReviewRequest") {
    const channel = settings.autoReviewRequestType ?? "email";
    const message = settings.reviewRequestMessage ?? DEFAULT_MESSAGES.reviewRequestMessage;
    return (
      <div className="flex flex-col gap-3 pt-3 border-t border-border/50">
        <div className="p-2.5 rounded-md bg-muted/50 text-xs text-muted-foreground">
          Sent automatically when a job is marked as completed. Add your Google Review URL in Settings &gt; Business Details to include a direct review link.
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Channel</Label>
          <ChannelSelector value={channel} onChange={(v) => onUpdate({ autoReviewRequestType: v })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Message template</Label>
          <DebouncedTextarea
            value={message}
            onChange={(v) => onUpdate({ reviewRequestMessage: v })}
            rows={3}
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Variables: {TEMPLATE_VARIABLES.reviewRequestMessage.join(", ")}
          </p>
        </div>
      </div>
    );
  }

  return null;
}

const categoryLabels: Record<string, { label: string; icon: typeof Settings }> = {
  communications: { label: "Communications", icon: FileText },
  fieldwork: { label: "Fieldwork", icon: MapPin },
  billing: { label: "Billing", icon: DollarSign },
};

export default function Autopilot({ onNavigate }: AutopilotProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"all" | "communications" | "fieldwork" | "billing">("all");

  const { data: settings, isLoading } = useQuery<AutomationSettings>({
    queryKey: ["/api/automation-settings"],
  });

  const mutation = useMutation({
    mutationFn: async (updated: AutomationSettings) => {
      const res = await apiRequest("PUT", "/api/automation-settings", updated);
      return res.json();
    },
    onMutate: async (updated) => {
      await queryClient.cancelQueries({ queryKey: ["/api/automation-settings"] });
      const previous = queryClient.getQueryData<AutomationSettings>(["/api/automation-settings"]);
      queryClient.setQueryData(["/api/automation-settings"], updated);
      return { previous };
    },
    onError: (_err, _updated, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/automation-settings"], context.previous);
      }
      toast({ title: "Error", description: "Failed to save setting", variant: "destructive" });
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Automation setting updated" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation-settings"] });
    },
  });

  const handleUpdate = (changes: Partial<AutomationSettings>) => {
    const updated = { ...settings, ...changes };
    mutation.mutate(updated);
  };

  const activeCount = settings
    ? automations.filter((a) => settings[a.field]).length
    : 0;

  const filteredAutomations = activeTab === "all"
    ? automations
    : automations.filter((a) => a.category === activeTab);

  const tabs = [
    { key: "all" as const, label: "All" },
    { key: "communications" as const, label: "Comms" },
    { key: "fieldwork" as const, label: "Fieldwork" },
    { key: "billing" as const, label: "Billing" },
  ];

  if (isLoading) {
    return (
      <PageShell>
        <div className="animate-fade-up">
          <Skeleton className="h-10 w-40 mb-2" />
          <Skeleton className="h-4 w-64 mb-6" />
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-full rounded-2xl mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </PageShell>
    );
  }

  const hasAnyActive = activeCount > 0;

  return (
    <PageShell>
      <div className="animate-fade-up">
        <PageHeader
          title="Autopilot"
          subtitle="Automations that kill admin work"
          leading={<Zap className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />}
          action={
            <Badge variant="secondary" className="text-xs">
              {activeCount}/{automations.length} active
            </Badge>
          }
        />
      </div>

      <div className="animate-fade-up stagger-delay-1">
        <div className="grid grid-cols-3 gap-3">
          <div className="feed-card p-4 animate-fade-up stagger-delay-1">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                <Zap className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              </div>
            </div>
            <p className="text-[22px] font-bold tracking-tight">{activeCount}</p>
            <p className="ios-caption">Active</p>
          </div>
          <div className="feed-card p-4 animate-fade-up stagger-delay-2">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ backgroundColor: 'hsl(142 76% 36% / 0.1)' }}>
                <TrendingUp className="h-5 w-5" style={{ color: 'hsl(142 76% 36%)' }} />
              </div>
            </div>
            <p className="text-[22px] font-bold tracking-tight">{automations.length - activeCount}</p>
            <p className="ios-caption">Available</p>
          </div>
          <div className="feed-card p-4 animate-fade-up stagger-delay-3">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ backgroundColor: 'hsl(270 70% 60% / 0.1)' }}>
                <Settings className="h-5 w-5" style={{ color: 'hsl(270 70% 60%)' }} />
              </div>
            </div>
            <p className="text-[22px] font-bold tracking-tight">{automations.length}</p>
            <p className="ios-caption">Total</p>
          </div>
        </div>
      </div>

      <div className="animate-fade-up stagger-delay-2">
        <div className="bg-muted rounded-2xl p-1.5">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 min-w-0 px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${
                  activeTab === tab.key
                    ? "text-white"
                    : "text-muted-foreground"
                }`}
                style={activeTab === tab.key ? { backgroundColor: 'hsl(var(--trade))' } : undefined}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hasAnyActive && activeTab === "all" && (
        <div className="animate-fade-up stagger-delay-3">
          <div className="card-accent p-8 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                 style={{
                   background: `linear-gradient(135deg, hsl(var(--trade) / 0.15), hsl(var(--trade) / 0.05))`,
                 }}>
              <Zap className="h-10 w-10 animate-pulse-soft" style={{ color: 'hsl(var(--trade))' }} />
            </div>
            <h3 className="text-[17px] font-semibold tracking-tight mb-1">Put your business on autopilot</h3>
            <p className="ios-caption max-w-xs mb-5">
              Automate follow-ups, reminders, invoicing and more. Save hours every week and never miss a beat.
            </p>
            <Button onClick={() => setActiveTab("all")}>
              <Plus className="h-4 w-4 mr-1.5" />
              Enable your first automation
            </Button>
          </div>
        </div>
      )}

      <div>
        <SectionTitle className="mb-3">
          {activeTab === "all" ? "All Automations" : categoryLabels[activeTab]?.label || "Automations"}
        </SectionTitle>

        <div className="space-y-3">
          {filteredAutomations.map((item, index) => {
            const Icon = item.icon;
            const isEnabled = !!settings?.[item.field];
            const hasInlineSettings = item.field !== "autoInvoiceOnComplete";

            return (
              <div
                key={item.field}
                className={`feed-card card-press animate-fade-up stagger-delay-${Math.min(index + 1, 8)}`}
              >
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `hsl(${item.color} / 0.1)` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: `hsl(${item.color})` }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="ios-card-title">{item.title}</p>
                        {isEnabled && (
                          <Badge variant="secondary" className="text-[10px]">
                            ON
                          </Badge>
                        )}
                      </div>
                      <p className="ios-caption mt-0.5">{item.subtitle}</p>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) => {
                        const defaults = checked && ENABLE_DEFAULTS[item.field] ? ENABLE_DEFAULTS[item.field] : {};
                        handleUpdate({ [item.field]: checked, ...defaults });
                      }}
                    />
                  </div>
                  {isEnabled && hasInlineSettings && (
                    <div className="mt-3 rounded-xl bg-muted/30 p-3">
                      <InlineSettings
                        field={item.field}
                        settings={settings || {}}
                        onUpdate={handleUpdate}
                      />
                    </div>
                  )}
                  {isEnabled && (
                    <div className="mt-3 rounded-xl bg-muted/30 p-3">
                      <AutomationActivityLog field={item.field} color={item.color} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <GlobalActivityFeed />
    </PageShell>
  );
}

function GlobalActivityFeed() {
  const [showAll, setShowAll] = useState(false);
  const limit = showAll ? 50 : 15;

  const { data: logs, isLoading } = useQuery<ActivityLogEntry[]>({
    queryKey: ["/api/autopilot/activity-log", "global", limit],
    queryFn: async () => {
      const res = await fetch(`/api/autopilot/activity-log?limit=${limit}`, { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div>
        <SectionTitle className="mb-3">Activity Feed</SectionTitle>
        <div className="feed-card p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div>
        <SectionTitle className="mb-3">Activity Feed</SectionTitle>
        <div className="feed-card p-6 flex flex-col items-center text-center">
          <Clock className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No automation activity yet</p>
          <p className="text-[11px] text-muted-foreground mt-1">Activity will appear here when automations fire</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle className="mb-3">
        <span className="flex items-center gap-2">
          Activity Feed
          <Badge variant="secondary" className="text-[10px]">{logs.length}</Badge>
        </span>
      </SectionTitle>
      <div className="feed-card p-4">
        <div className="divide-y divide-border/30">
          {logs.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="mt-0.5 flex-shrink-0">
                {entry.status === "failed" || entry.status === "error" ? (
                  <XCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" style={{ color: "hsl(142 76% 36%)" }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-[10px]">
                    {AUTOMATION_TYPE_LABELS[entry.automationType] || entry.automationType}
                  </Badge>
                  <span className="text-xs font-medium truncate">{entry.entityLabel}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[11px] text-muted-foreground">to {entry.recipientName}</span>
                  <ChannelBadge channel={entry.channel} />
                  <span className="text-[11px] text-muted-foreground ml-auto">{timeAgo(entry.createdAt)}</span>
                </div>
                {(entry.status === "failed" || entry.status === "error") && entry.errorMessage && (
                  <p className="text-[11px] text-destructive mt-0.5 truncate">{entry.errorMessage}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        {logs.length >= 15 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-1 text-xs text-muted-foreground mt-3 mx-auto hover:text-foreground transition-colors"
          >
            {showAll ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showAll ? "Show less" : "View more"}
          </button>
        )}
      </div>
    </div>
  );
}
