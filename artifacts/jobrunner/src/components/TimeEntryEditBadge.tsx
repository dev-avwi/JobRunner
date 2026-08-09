import { useState } from "react";
import { getAuthHeaders } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pencil, Clock, ArrowRight } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";

interface EditHistoryEntry {
  id: string;
  timeEntryId: string;
  editedBy: string;
  editorName?: string;
  fieldChanged: string;
  oldValue: string;
  newValue: string;
  reason?: string;
  source?: string;
  editedAt: string;
}

interface HasEditsResponse {
  hasEdits: boolean;
  editCount: number;
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
      if (!isNaN(d.getTime())) {
        return format(d, "h:mm a");
      }
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
    return format(d, "d MMM h:mm a");
  } catch {
    return dateStr;
  }
}

function formatGroupDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isToday(d)) return "Today";
    if (isYesterday(d)) return "Yesterday";
    return format(d, "EEEE, d MMMM yyyy");
  } catch {
    return dateStr;
  }
}

function groupEditsByDate(edits: EditHistoryEntry[]): Record<string, EditHistoryEntry[]> {
  const groups: Record<string, EditHistoryEntry[]> = {};
  const sorted = [...edits].sort(
    (a, b) => new Date(b.editedAt).getTime() - new Date(a.editedAt).getTime()
  );

  for (const edit of sorted) {
    const dateKey = format(new Date(edit.editedAt), "yyyy-MM-dd");
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(edit);
  }

  return groups;
}

interface TimeEntryEditBadgeProps {
  timeEntryId: string;
}

export default function TimeEntryEditBadge({ timeEntryId }: TimeEntryEditBadgeProps) {
  const [open, setOpen] = useState(false);

  const { data: hasEditsData } = useQuery<HasEditsResponse>({
    queryKey: ["/api/time-entries", timeEntryId, "has-edits"],
    queryFn: async () => {
      const res = await fetch(`/api/time-entries/${timeEntryId}/has-edits`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to check edits");
      return res.json();
    },
    enabled: !!timeEntryId,
  });

  const { data: editHistory, isLoading: historyLoading } = useQuery<EditHistoryEntry[]>({
    queryKey: ["/api/time-entries", timeEntryId, "edit-history"],
    queryFn: async () => {
      const res = await fetch(`/api/time-entries/${timeEntryId}/edit-history`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch edit history");
      return res.json();
    },
    enabled: open && !!timeEntryId,
  });

  if (!hasEditsData?.hasEdits) return null;

  const grouped = editHistory ? groupEditsByDate(editHistory) : {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Badge
          variant="outline"
          className="cursor-pointer text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 no-default-hover-elevate"
        >
          <Pencil className="h-3 w-3 mr-1" />
          Edited
        </Badge>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
            Edit History
          </DialogTitle>
        </DialogHeader>

        {historyLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : !editHistory || editHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No edit history found.
          </p>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-2">
              {Object.entries(grouped).map(([dateKey, edits]) => (
                <div key={dateKey}>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {formatGroupDate(edits[0].editedAt)}
                  </p>
                  <div className="space-y-2">
                    {edits.map((edit) => (
                      <div
                        key={edit.id}
                        className="border rounded-md p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {edit.editorName || "Unknown"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatEditTimestamp(edit.editedAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm flex-wrap">
                          <span className="text-muted-foreground">
                            {getFieldLabel(edit.fieldChanged)}:
                          </span>
                          <span className="line-through text-muted-foreground/70">
                            {formatValue(edit.fieldChanged, edit.oldValue)}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">
                            {formatValue(edit.fieldChanged, edit.newValue)}
                          </span>
                        </div>
                        {edit.reason && (
                          <p className="text-xs text-muted-foreground italic">
                            Reason: {edit.reason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
