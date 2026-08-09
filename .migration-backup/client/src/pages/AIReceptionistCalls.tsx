import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Phone,
  PhoneCall,
  PhoneForwarded,
  PhoneMissed,
  MessageSquare,
  Calendar,
  Clock,
  Zap,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  User,
  FileText,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { format, formatDistanceToNow, subDays } from "date-fns";

interface CallLog {
  id: string;
  vapiCallId: string;
  callerPhone: string | null;
  callerName: string | null;
  status: string;
  duration: number | null;
  summary: string | null;
  transcript: string | null;
  recordingUrl: string | null;
  leadId: string | null;
  outcome: string | null;
  transferredTo: string | null;
  transferStatus: string | null;
  callerIntent: string | null;
  extractedInfo: Record<string, string> | null;
  endedReason: string | null;
  cost: string | null;
  latencyMs: number | null;
  createdAt: string;
}

function latencyTone(ms: number): { className: string; label: string } {
  if (ms > 3000) {
    return {
      className: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-0",
      label: "Slow",
    };
  }
  if (ms > 1500) {
    return {
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-0",
      label: "Above target",
    };
  }
  return {
    className: "bg-muted text-muted-foreground border-0",
    label: "On target",
  };
}

function LatencyBadge({ latencyMs, showLabel = false }: { latencyMs: number | null; showLabel?: boolean }) {
  if (typeof latencyMs !== "number" || !Number.isFinite(latencyMs) || latencyMs <= 0) return null;
  const tone = latencyTone(latencyMs);
  return (
    <Badge className={tone.className} data-testid="badge-call-latency">
      <Zap className="h-3 w-3 mr-1" />
      {latencyMs}ms{showLabel ? ` · ${tone.label}` : ""}
    </Badge>
  );
}

const OUTCOME_BADGES: Record<string, { label: string; className: string }> = {
  message_taken: {
    label: "Message Taken",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-0",
  },
  transferred: {
    label: "Transferred",
    className: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0",
  },
  booked: {
    label: "Booked",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border-0",
  },
  missed: {
    label: "Missed",
    className: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-0",
  },
};

const INTENT_LABELS: Record<string, string> = {
  quote_request: "Quote Request",
  job_request: "Job Request",
  enquiry: "General Enquiry",
  complaint: "Complaint",
  follow_up: "Follow Up",
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) return <Badge variant="outline">Unknown</Badge>;
  const config = OUTCOME_BADGES[outcome];
  if (!config) return <Badge variant="outline">{outcome}</Badge>;
  return <Badge className={config.className}>{config.label}</Badge>;
}

function OutcomeIcon({ outcome }: { outcome: string | null }) {
  switch (outcome) {
    case "transferred":
      return <PhoneForwarded className="h-4 w-4 text-green-600 dark:text-green-400" />;
    case "missed":
      return <PhoneMissed className="h-4 w-4 text-red-600 dark:text-red-400" />;
    case "message_taken":
      return <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    case "booked":
      return <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
    default:
      return <PhoneCall className="h-4 w-4 text-muted-foreground" />;
  }
}

function CallRow({ call, onNavigate }: { call: CallLog; onNavigate: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const createdAt = new Date(call.createdAt);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border rounded-md">
        <CollapsibleTrigger className="w-full text-left" data-testid={`call-row-${call.id}`}>
          <div className="flex items-center justify-between gap-3 p-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <OutcomeIcon outcome={call.outcome} />
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">
                  {call.callerName || call.callerPhone || "Unknown Caller"}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  <span>{format(createdAt, "dd MMM yyyy, h:mm a")}</span>
                  <span className="hidden sm:inline">
                    ({formatDistanceToNow(createdAt, { addSuffix: true })})
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(call.duration)}
              </span>
              <LatencyBadge latencyMs={call.latencyMs} />
              <OutcomeBadge outcome={call.outcome} />
              {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3 border-t pt-3">
            {typeof call.latencyMs === "number" && call.latencyMs > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Response time:</span>
                <LatencyBadge latencyMs={call.latencyMs} showLabel />
              </div>
            )}
            {call.callerPhone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{call.callerPhone}</span>
              </div>
            )}
            {call.callerIntent && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>Intent: {INTENT_LABELS[call.callerIntent] || call.callerIntent}</span>
              </div>
            )}
            {call.transferredTo && (
              <div className="flex items-center gap-2 text-sm">
                <PhoneForwarded className="h-4 w-4 text-muted-foreground" />
                <span>Transferred to: {call.transferredTo}</span>
                {call.transferStatus && (
                  <Badge variant="outline" className="text-xs">
                    {call.transferStatus}
                  </Badge>
                )}
              </div>
            )}
            {call.recordingUrl && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Recording</p>
                <audio controls preload="none" className="w-full h-10" src={call.recordingUrl}>
                  Your browser does not support audio playback.
                </audio>
              </div>
            )}
            {call.summary && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Summary</p>
                <p className="text-sm bg-muted/50 rounded-md p-2">{call.summary}</p>
              </div>
            )}
            {call.transcript && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Transcript</p>
                <div className="text-sm bg-muted/50 rounded-md p-2 max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {call.transcript}
                </div>
              </div>
            )}
            {call.extractedInfo && typeof call.extractedInfo === "object" && Object.keys(call.extractedInfo).length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Extracted Information</p>
                <div className="text-sm bg-muted/50 rounded-md p-2 space-y-1">
                  {Object.entries(call.extractedInfo).map(([key, value]) =>
                    value ? (
                      <div key={key} className="flex gap-2">
                        <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}:</span>
                        <span>{String(value)}</span>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )}
            {call.leadId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate(`/leads?highlight=${call.leadId}`)}
                data-testid={`button-view-lead-${call.id}`}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                View Lead
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function AIReceptionistCalls() {
  const [, setLocation] = useLocation();
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("30");
  const [statsPeriod, setStatsPeriod] = useState<string>("30");

  const { data: calls = [], isLoading, isError } = useQuery<CallLog[]>({
    queryKey: ["/api/ai-receptionist/calls"],
  });

  const filteredCalls = useMemo(() => {
    let result = [...calls];

    if (outcomeFilter !== "all") {
      result = result.filter((c) => c.outcome === outcomeFilter);
    }

    const days = parseInt(periodFilter);
    if (!isNaN(days) && days > 0) {
      const cutoff = subDays(new Date(), days);
      result = result.filter((c) => new Date(c.createdAt) >= cutoff);
    }

    return result;
  }, [calls, outcomeFilter, periodFilter]);

  const stats = useMemo(() => {
    const days = parseInt(statsPeriod);
    let statsCalls = calls;
    if (!isNaN(days) && days > 0) {
      const cutoff = subDays(new Date(), days);
      statsCalls = calls.filter((c) => new Date(c.createdAt) >= cutoff);
    }
    const leadsCreated = statsCalls.filter((c) => c.leadId).length;
    const transferred = statsCalls.filter((c) => c.outcome === "transferred").length;
    const totalCalls = statsCalls.length;
    const conversionRate = totalCalls > 0 ? Math.round((leadsCreated / totalCalls) * 100) : 0;

    return { totalCalls, leadsCreated, transferred, conversionRate };
  }, [calls, statsPeriod]);

  return (
    <PageShell>
      <PageHeader title="Call Logs" />
      <div className="p-4 space-y-4 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/ai-receptionist")} data-testid="button-back-to-settings">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Settings
        </Button>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-medium text-muted-foreground">Performance Summary</h3>
          <Select value={statsPeriod} onValueChange={setStatsPeriod}>
            <SelectTrigger className="w-[150px]" data-testid="select-stats-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="0">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <PhoneCall className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-xl font-bold">{stats.totalCalls}</div>
              <div className="text-xs text-muted-foreground">Total Calls</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <User className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-xl font-bold">{stats.leadsCreated}</div>
              <div className="text-xs text-muted-foreground">Leads Created</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <PhoneForwarded className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-xl font-bold">{stats.transferred}</div>
              <div className="text-xs text-muted-foreground">Transferred</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <TrendingUp className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-xl font-bold">{stats.conversionRate}%</div>
              <div className="text-xs text-muted-foreground">Conversion</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-outcome-filter">
              <SelectValue placeholder="Filter by outcome" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Outcomes</SelectItem>
              <SelectItem value="message_taken">Message Taken</SelectItem>
              <SelectItem value="transferred">Transferred</SelectItem>
              <SelectItem value="booked">Booked</SelectItem>
              <SelectItem value="missed">Missed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-period-filter">
              <SelectValue placeholder="Time period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="0">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isError ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Phone className="h-10 w-10 mx-auto mb-3 text-destructive" />
              <p className="text-sm text-muted-foreground">
                Unable to load call logs. You may not have permission to view this data.
              </p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : filteredCalls.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Phone className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {calls.length === 0
                  ? "No calls yet. Calls handled by your AI receptionist will appear here."
                  : "No calls match the selected filters."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredCalls.map((call) => (
              <CallRow key={call.id} call={call} onNavigate={setLocation} />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
