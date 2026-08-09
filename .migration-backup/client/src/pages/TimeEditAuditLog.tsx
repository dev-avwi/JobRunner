import { useState } from "react";
import { getAuthHeaders } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { History, ArrowRight, User, Briefcase, Calendar, FileText } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";

interface EditLogEntry {
  id: string;
  timeEntryId: string;
  editedBy: string;
  editorName?: string;
  entryOwnerName?: string;
  jobTitle?: string;
  entryDate?: string;
  fieldChanged: string;
  oldValue: string;
  newValue: string;
  reason?: string;
  source?: string;
  editedAt: string;
}

const FIELD_LABELS: Record<string, string> = {
  startTime: "Start Time",
  endTime: "End Time",
  hourlyRate: "Hourly Rate",
  isBillable: "Billable",
  timeCategory: "Category",
  description: "Description",
  jobId: "Job",
  duration: "Duration",
  notes: "Notes",
  isBreak: "Break",
};

function getFieldLabel(field: string): string {
  return FIELD_LABELS[field] || field.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

function formatValue(field: string, value: string): string {
  if (!value || value === "null" || value === "undefined") return "—";

  if (field === "isBillable" || field === "isBreak") {
    return value === "true" ? "Yes" : "No";
  }

  if (field === "hourlyRate") {
    const num = parseFloat(value);
    return isNaN(num) ? value : `$${num.toFixed(2)}`;
  }

  if (field === "startTime" || field === "endTime") {
    try {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return format(d, "h:mm a");
    } catch {}
    return value;
  }

  if (field === "duration") {
    const mins = parseInt(value, 10);
    if (!isNaN(mins)) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
  }

  return value;
}

function formatEditTimestamp(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isToday(d)) return `Today ${format(d, "h:mm a")}`;
    if (isYesterday(d)) return `Yesterday ${format(d, "h:mm a")}`;
    return format(d, "d MMM yyyy, h:mm a");
  } catch {
    return dateStr;
  }
}

type FilterPeriod = "7" | "30" | "all";

export default function TimeEditAuditLog() {
  const [period, setPeriod] = useState<FilterPeriod>("30");

  const { data: editLog, isLoading } = useQuery<EditLogEntry[]>({
    queryKey: ["/api/time-entries/edit-log", { limit: "50", days: period === "all" ? undefined : period }],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50" });
      if (period !== "all") params.append("days", period);
      const res = await fetch(`/api/time-entries/edit-log?${params}`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch edit log");
      return res.json();
    },
  });

  return (
    <PageShell>
      <PageHeader
        title="Time Entry Audit Log"
        subtitle="Track all manual changes to time entries across your team"
        leading={<History className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />}
      />

      <div className="flex gap-2 flex-wrap">
        <Button
          variant={period === "7" ? "default" : "outline"}
          size="sm"
          onClick={() => setPeriod("7")}
        >
          Last 7 days
        </Button>
        <Button
          variant={period === "30" ? "default" : "outline"}
          size="sm"
          onClick={() => setPeriod("30")}
        >
          Last 30 days
        </Button>
        <Button
          variant={period === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setPeriod("all")}
        >
          All time
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-16 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !editLog || editLog.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "hsl(var(--muted))" }}
              >
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No time entry edits recorded yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Edits will appear here when team members modify their tracked time.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {editLog.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">
                      {formatEditTimestamp(entry.editedAt)}
                    </span>
                    {entry.source && (
                      <Badge variant="outline" className="no-default-hover-elevate">
                        {entry.source === "supervisor" ? "Supervisor" : "Manual"}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium">{entry.editorName || "Unknown"}</span>
                    {entry.entryOwnerName && entry.entryOwnerName !== entry.editorName && (
                      <span className="text-muted-foreground">
                        edited {entry.entryOwnerName}&apos;s entry
                      </span>
                    )}
                  </div>
                  {entry.jobTitle && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Briefcase className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{entry.jobTitle}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-sm flex-wrap">
                  <span className="text-muted-foreground">
                    {getFieldLabel(entry.fieldChanged)}:
                  </span>
                  <span className="line-through text-muted-foreground/70">
                    {formatValue(entry.fieldChanged, entry.oldValue)}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium">
                    {formatValue(entry.fieldChanged, entry.newValue)}
                  </span>
                </div>

                {entry.reason && (
                  <p className="text-xs text-muted-foreground italic">
                    Reason: {entry.reason}
                  </p>
                )}

                {entry.entryDate && (
                  <p className="text-xs text-muted-foreground">
                    Entry date: {format(new Date(entry.entryDate), "d MMM yyyy")}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
