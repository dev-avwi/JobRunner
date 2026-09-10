import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserX,
  ChevronRight,
  Search,
  ArrowLeft,
  Calendar,
  Briefcase,
} from "lucide-react";

interface UnassignedPhase {
  id: string;
  jobId: string;
  phaseCode: string | null;
  name: string;
  description: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  status: string;
  sortOrder: number | null;
  jobTitle: string | null;
}

interface UnassignedPhasesResponse {
  phases: UnassignedPhase[];
  teamMembers: any[];
}

interface UnassignedPhasesPageProps {
  onNavigate?: (path: string) => void;
}

const URGENT_MS = 48 * 60 * 60 * 1000;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "No date set";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "No date set";
  return d.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function phaseUrgency(dateStr: string | null): "urgent" | "overdue" | "normal" | "no-date" {
  if (!dateStr) return "no-date";
  const d = new Date(dateStr).getTime();
  if (isNaN(d)) return "no-date";
  const now = Date.now();
  if (d < now) return "overdue";
  if (d - now <= URGENT_MS) return "urgent";
  return "normal";
}

export default function UnassignedPhasesPage({ onNavigate }: UnassignedPhasesPageProps) {
  const [, setLocation] = useLocation();
  const navigate = onNavigate || setLocation;

  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<UnassignedPhasesResponse>({
    queryKey: ["/api/phases/unassigned"],
    staleTime: 2 * 60 * 1000,
  });

  const phases = data?.phases ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return phases;
    return phases.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.jobTitle ?? "").toLowerCase().includes(q) ||
        (p.phaseCode ?? "").toLowerCase().includes(q)
    );
  }, [phases, search]);

  // Counts for summary badges
  const overdueCount = phases.filter((p) => phaseUrgency(p.scheduledStart) === "overdue").length;
  const urgentCount = phases.filter((p) => phaseUrgency(p.scheduledStart) === "urgent").length;

  return (
    <div className="w-full px-4 sm:px-6 py-4 pb-28 md:pb-6" data-testid="unassigned-phases-page">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          data-testid="button-back-to-dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UserX className="h-5 w-5 text-amber-500 flex-shrink-0" />
            Unassigned Phases
          </h1>
          {!isLoading && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {phases.length} phase{phases.length !== 1 ? "s" : ""} need{phases.length === 1 ? "s" : ""} a worker
            </p>
          )}
        </div>
        {(overdueCount > 0 || urgentCount > 0) && (
          <div className="flex gap-1.5">
            {overdueCount > 0 && (
              <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">
                {overdueCount} overdue
              </Badge>
            )}
            {urgentCount > 0 && (
              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
                {urgentCount} urgent
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by phase or job name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="unassigned-phases-search"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            {phases.length === 0 ? (
              <>
                <UserX className="h-10 w-10 text-muted-foreground/25 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">No unassigned phases</p>
                <p className="text-xs text-muted-foreground mt-1">
                  All active phases have workers assigned.
                </p>
              </>
            ) : (
              <>
                <Search className="h-8 w-8 text-muted-foreground/25 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">No results</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try a different search term.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {filtered.length} of {phases.length} phase{phases.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-0 pb-2">
            {filtered.map((phase, idx) => {
              const urgency = phaseUrgency(phase.scheduledStart);
              const isUrgent = urgency === "urgent";
              const isOverdue = urgency === "overdue";
              const accent = isOverdue || isUrgent;

              return (
                <div
                  key={phase.id}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover-elevate transition-colors ${
                    idx < filtered.length - 1 ? "border-b border-border/50" : ""
                  }`}
                  onClick={() => navigate(`/jobs/${phase.jobId}?tab=phases`)}
                  data-testid={`unassigned-phase-row-${phase.id}`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      accent ? "bg-red-500/10" : "bg-amber-500/10"
                    }`}
                  >
                    <UserX
                      className={`h-4 w-4 ${accent ? "text-red-500" : "text-amber-500"}`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{phase.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Briefcase className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <p className="text-xs text-muted-foreground truncate">{phase.jobTitle}</p>
                      {phase.phaseCode && (
                        <span className="text-xs text-muted-foreground/60">· {phase.phaseCode}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {isOverdue && (
                      <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-xs" data-testid={`badge-overdue-${phase.id}`}>
                        Overdue
                      </Badge>
                    )}
                    {isUrgent && !isOverdue && (
                      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs" data-testid={`badge-urgent-${phase.id}`}>
                        Urgent
                      </Badge>
                    )}
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span className={`text-xs ${accent ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                        {formatDate(phase.scheduledStart)}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
