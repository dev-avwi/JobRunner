import { useState, useMemo, useEffect, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarDays, Calendar, Briefcase, ChevronRight, GripVertical, Plus,
  Sun, Cloud, CloudRain, CloudSnow, CloudLightning, Car, Route as RouteIcon,
  FileSignature, MessageSquare, ArrowUpDown, Check,
} from "lucide-react";

interface TodayScheduleCardProps {
  jobs: any[];
  weatherEnabled?: boolean;
  smartEmptyEnabled?: boolean;
  onCreateJob?: () => void;
  onViewJob?: (id: string) => void;
  onViewAll?: () => void;
  onNavigate?: (path: string) => void;
  renderRowActions?: (job: any) => ReactNode;
  rowMaxRows?: number;
  title?: string;
  className?: string;
}

interface WeatherData {
  temperature: number;
  weatherCode: number;
  isDay: boolean;
  daily?: {
    temperatureMax: number[];
    temperatureMin: number[];
    weatherCode: number[];
    precipitationProbability: number[];
  };
}

interface RouteSummary {
  durationMinutes: number;
  distanceKm: number;
  segments: number;
  jobsWithLocation: number;
  source: string;
}

interface EmptyStateCounts {
  acceptedUnscheduledQuotes: number;
  unreadChat: number;
  overdueInvoices: number;
}

const WEATHER_ICONS: Record<number, typeof Sun> = {
  0: Sun, 1: Sun, 2: Cloud, 3: Cloud, 45: Cloud, 48: Cloud,
  51: CloudRain, 53: CloudRain, 55: CloudRain, 56: CloudRain, 57: CloudRain,
  61: CloudRain, 63: CloudRain, 65: CloudRain, 66: CloudRain, 67: CloudRain,
  71: CloudSnow, 73: CloudSnow, 75: CloudSnow, 77: CloudSnow,
  80: CloudRain, 81: CloudRain, 82: CloudRain, 85: CloudSnow, 86: CloudSnow,
  95: CloudLightning, 96: CloudLightning, 99: CloudLightning,
};

function formatJobTime(dateStr?: string): string {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "TBD";
  return d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function TodayScheduleCard({
  jobs,
  weatherEnabled = true,
  smartEmptyEnabled = true,
  onCreateJob,
  onViewJob,
  onViewAll,
  onNavigate,
  renderRowActions,
  rowMaxRows = 5,
  title = "Today's Schedule",
  className,
}: TodayScheduleCardProps) {
  const { toast } = useToast();
  // When true, all of today's jobs are rendered (and draggable) so the user
  // can persist a complete sequence — even past the default rowMaxRows cap.
  const [reorderMode, setReorderMode] = useState(false);

  // Local order mirror; only re-sync when the id-set changes so optimistic
  // drag isn't reverted by parent re-renders.
  const [order, setOrder] = useState<string[]>(() => jobs.map((j) => j.id));
  useEffect(() => {
    const ids = jobs.map((j) => j.id);
    setOrder((prev) => {
      const sameSet = prev.length === ids.length && prev.every((id) => ids.includes(id));
      return sameSet ? prev : ids;
    });
  }, [jobs]);

  const orderedJobs = useMemo(() => {
    const byId = new Map(jobs.map((j) => [j.id, j]));
    return order.map((id) => byId.get(id)).filter(Boolean) as any[];
  }, [jobs, order]);

  const reorderMutation = useMutation({
    mutationFn: async (jobIds: string[]) => {
      const today = new Date();
      const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      return apiRequest("PATCH", "/api/jobs/today/reorder", { jobIds, date });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/today/route"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/my-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/unified"] });
    },
    onError: (err: any) => {
      toast({ title: "Reorder failed", description: err?.message || "Couldn't save the new order", variant: "destructive" });
      // Roll back local order to server order
      setOrder(jobs.map((j) => j.id));
    },
  });

  const [dragId, setDragId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const next = [...order];
    const fromIdx = next.indexOf(dragId);
    const toIdx = next.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, dragId);
    setOrder(next);
    setDragId(null);
    reorderMutation.mutate(next);
  };

  // Weather (1h client cache via staleTime)
  const { data: weather } = useQuery<WeatherData>({
    queryKey: ["/api/weather"],
    staleTime: 60 * 60 * 1000,
    enabled: weatherEnabled,
    retry: 1,
  });

  // Drive route — only fetch when 2+ jobs (otherwise no driving needed)
  const { data: route } = useQuery<RouteSummary>({
    queryKey: ["/api/jobs/today/route"],
    staleTime: 5 * 60 * 1000,
    enabled: jobs.length >= 2,
    retry: 1,
  });

  // Smart empty state counts — only when no jobs
  const { data: emptyCounts } = useQuery<EmptyStateCounts>({
    queryKey: ["/api/dashboard/today-empty-state"],
    staleTime: 60 * 1000,
    enabled: smartEmptyEnabled && jobs.length === 0,
    retry: 1,
  });

  const WeatherIcon = weather ? (WEATHER_ICONS[weather.weatherCode] || Cloud) : Cloud;
  const todayHi = weather?.daily?.temperatureMax?.[0];
  const todayLo = weather?.daily?.temperatureMin?.[0];
  const rainPct = weather?.daily?.precipitationProbability?.[0];

  // Pick highest-priority CTA when empty
  const smartCta = useMemo(() => {
    if (!emptyCounts) return null;
    const { acceptedUnscheduledQuotes, unreadChat } = emptyCounts;
    if (acceptedUnscheduledQuotes > 0) {
      return {
        icon: FileSignature,
        title: `${acceptedUnscheduledQuotes} accepted ${acceptedUnscheduledQuotes === 1 ? "quote" : "quotes"} unscheduled`,
        description: "Lock one in for this week before the customer cools off.",
        actionLabel: "Schedule a Job",
        onClick: () => onCreateJob?.(),
        tone: "trade" as const,
      };
    }
    if (unreadChat > 0) {
      return {
        icon: MessageSquare,
        title: `${unreadChat} unread ${unreadChat === 1 ? "message" : "messages"}`,
        description: "Reply now while you're between jobs.",
        actionLabel: "Open Chat Hub",
        onClick: () => onNavigate?.("/chat-hub"),
        tone: "trade" as const,
      };
    }
    // Overdue invoices are intentionally NOT surfaced here — the Action Centre
    // already owns that prompt, and Today's Schedule should stay about the day's work.
    return null;
  }, [emptyCounts, onCreateJob, onNavigate]);

  const isOwnerStarted = jobs.length > 0;

  return (
    <Card className={className} data-testid="today-schedule-card">
      <CardHeader className="flex flex-row items-center justify-between gap-4 py-3 px-4">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <CalendarDays className="h-4 w-4" style={{ color: "hsl(var(--trade))" }} aria-hidden="true" />
          {title}
        </CardTitle>
        <div className="flex items-center gap-1">
          {isOwnerStarted && jobs.length > 1 && (
            <Button
              variant={reorderMode ? "default" : "ghost"}
              size="sm"
              onClick={() => setReorderMode((v) => !v)}
              data-testid="button-today-reorder-toggle"
              title={reorderMode ? "Done reordering" : "Reorder all today's jobs"}
            >
              {reorderMode ? <Check className="h-3.5 w-3.5 mr-0.5" /> : <ArrowUpDown className="h-3.5 w-3.5 mr-0.5" />}
              {reorderMode ? "Done" : "Reorder"}
            </Button>
          )}
          {isOwnerStarted && onViewAll && !reorderMode && (
            <Button variant="ghost" size="sm" onClick={onViewAll} data-testid="button-today-view-all">
              All Jobs <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
            </Button>
          )}
        </div>
      </CardHeader>

      {/* Weather + drive strip — always visible at top so the schedule is framed by context */}
      {(weatherEnabled && weather) || (route && route.segments > 0) ? (
        <div className="px-4 pb-2 -mt-1">
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap" data-testid="today-context-strip">
            {weatherEnabled && weather && (
              <div className="flex items-center gap-1.5" data-testid="today-weather-chip">
                <WeatherIcon className="h-3.5 w-3.5" style={{ color: weather.isDay ? "hsl(35, 95%, 55%)" : "hsl(220, 50%, 70%)" }} />
                <span className="font-medium text-foreground">
                  {Math.round(weather.temperature)}°
                </span>
                {todayHi != null && todayLo != null && (
                  <span>{Math.round(todayHi)}° / {Math.round(todayLo)}°</span>
                )}
                {rainPct != null && rainPct > 0 && (
                  <span className="flex items-center gap-1">
                    <CloudRain className="h-3 w-3" />
                    {rainPct}%
                  </span>
                )}
              </div>
            )}
            {route && route.segments > 0 && (
              <div className="flex items-center gap-1.5" data-testid="today-drive-chip">
                <Car className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{formatDuration(route.durationMinutes)}</span>
                <span className="flex items-center gap-1">
                  <RouteIcon className="h-3 w-3" />
                  {route.distanceKm} km
                </span>
                <span className="text-muted-foreground/70">across {route.segments + 1} stops</span>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <CardContent className="pt-0 px-4 pb-4">
        {jobs.length === 0 ? (
          smartCta ? (
            <div className="text-center py-5" data-testid="today-smart-empty">
              <smartCta.icon
                className="h-8 w-8 mx-auto mb-2"
                style={{ color: "hsl(var(--trade))" }}
              />
              <p className="text-sm font-medium">{smartCta.title}</p>
              <p className="text-xs text-muted-foreground mt-1 mb-3">{smartCta.description}</p>
              <Button size="sm" onClick={smartCta.onClick} data-testid="button-today-smart-cta">
                {smartCta.actionLabel}
              </Button>
            </div>
          ) : (
            <div className="text-center py-6">
              <Briefcase className="h-8 w-8 text-muted-foreground/25 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">No jobs on today</p>
              {onCreateJob && (
                <Button size="sm" onClick={onCreateJob} data-testid="button-schedule-job">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Schedule a Job
                </Button>
              )}
            </div>
          )
        ) : (
          <div className="space-y-1">
            {(reorderMode ? orderedJobs : orderedJobs.slice(0, rowMaxRows)).map((job) => {
              const isDragging = dragId === job.id;
              return (
                <div
                  key={job.id}
                  draggable={reorderMode}
                  onDragStart={reorderMode ? (e) => handleDragStart(e, job.id) : undefined}
                  onDragOver={reorderMode ? handleDragOver : undefined}
                  onDrop={reorderMode ? (e) => handleDrop(e, job.id) : undefined}
                  onDragEnd={reorderMode ? () => setDragId(null) : undefined}
                  className={`flex items-center gap-2 p-2.5 rounded-md hover-elevate ${isDragging ? "opacity-50" : ""}`}
                  style={{ cursor: reorderMode ? "grab" : undefined }}
                  data-testid={`today-row-${job.id}`}
                >
                  {reorderMode && (
                    <GripVertical className="h-4 w-4 text-muted-foreground/60 flex-shrink-0" aria-hidden="true" />
                  )}
                  <div
                    className="flex-shrink-0 w-14 text-center cursor-pointer"
                    onClick={() => onViewJob?.(job.id)}
                  >
                    <p className="text-sm font-bold" style={{ color: "hsl(var(--trade))" }}>
                      {formatJobTime(job.scheduledAt)}
                    </p>
                  </div>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => onViewJob?.(job.id)}
                  >
                    <p className="text-sm font-medium truncate">{job.title}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {job.clientName && <span className="truncate">{job.clientName}</span>}
                      {job.address && <span className="truncate">· {job.address.split(",")[0]}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {renderRowActions ? (
                      renderRowActions(job)
                    ) : (
                      <Badge variant={job.status === "in_progress" ? "default" : "secondary"} className="text-xs">
                        {job.status === "in_progress" ? "Active" : job.status === "done" ? "Done" : "Scheduled"}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
            {!reorderMode && jobs.length > rowMaxRows && (
              <div className="flex items-center gap-2 mt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-muted-foreground"
                  onClick={() => setReorderMode(true)}
                  data-testid="button-today-reorder-all"
                >
                  <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
                  Reorder all {jobs.length}
                </Button>
                {onViewAll && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-muted-foreground"
                    onClick={onViewAll}
                  >
                    +{jobs.length - rowMaxRows} more
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
