import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin, User, Clock, CheckCircle2, Briefcase } from "lucide-react";
import {
  addDays,
  addWeeks,
  addMonths,
  subWeeks,
  subMonths,
  startOfWeek,
  startOfMonth,
  endOfWeek,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  isToday as isDateToday,
  parseISO
} from "date-fns";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { StatCard } from "@/components/ui/compact-card";

interface Job {
  id: string;
  title: string;
  status: string;
  scheduledDate?: string;
  location?: string;
  clientId: string;
  clientName?: string;
}

type ViewMode = 'week' | 'month';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');

  // Fetch jobs
  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  // Fetch clients for mapping
  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ['/api/clients'],
  });

  const clientsMap = new Map(clients.map(c => [c.id, c]));

  // Add client names to jobs
  const jobsWithClients = jobs.map(job => ({
    ...job,
    clientName: clientsMap.get(job.clientId)?.name || 'Unknown'
  }));

  // Calculate date range based on view mode
  const getDateRange = () => {
    if (viewMode === 'week') {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 1 }), // Monday
        end: endOfWeek(currentDate, { weekStartsOn: 1 })
      };
    } else {
      return {
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
      };
    }
  };

  const { start, end } = getDateRange();
  const days = eachDayOfInterval({ start, end });

  // Group jobs by date
  const jobsByDate = jobsWithClients.reduce((acc, job) => {
    if (job.scheduledDate) {
      const dateKey = format(parseISO(job.scheduledDate), 'yyyy-MM-dd');
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(job);
    }
    return acc;
  }, {} as Record<string, Job[]>);

  // Navigation functions
  const handlePrevious = () => {
    if (viewMode === 'week') {
      setCurrentDate(prev => subWeeks(prev, 1));
    } else {
      setCurrentDate(prev => subMonths(prev, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'week') {
      setCurrentDate(prev => addWeeks(prev, 1));
    } else {
      setCurrentDate(prev => addMonths(prev, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getStatusColor = (status: string) => {
    const lower = status.toLowerCase();
    if (lower.includes('completed')) return 'bg-success/20 text-success border-success/30';
    if (lower.includes('progress')) return 'bg-info/20 text-info border-info/30';
    if (lower.includes('pending')) return 'bg-warning/20 text-warning border-warning/30';
    return 'bg-muted';
  };

  // Calculate KPI stats
  const stats = useMemo(() => {
    const today = new Date();
    const todayKey = format(today, 'yyyy-MM-dd');
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

    const jobsToday = jobsByDate[todayKey]?.length || 0;
    
    const jobsThisWeek = jobsWithClients.filter(job => {
      if (!job.scheduledDate) return false;
      const jobDate = parseISO(job.scheduledDate);
      return jobDate >= weekStart && jobDate <= weekEnd;
    }).length;

    // Compare only calendar days (not times) - exclude today from "upcoming"
    const upcoming = jobsWithClients.filter(job => {
      if (!job.scheduledDate) return false;
      const jobDateKey = format(parseISO(job.scheduledDate), 'yyyy-MM-dd');
      return jobDateKey > todayKey;
    }).length;

    const completed = jobsWithClients.filter(job => 
      job.status.toLowerCase().includes('completed')
    ).length;

    return { jobsToday, jobsThisWeek, upcoming, completed };
  }, [jobsWithClients, jobsByDate]);

  return (
    <PageShell data-testid="calendar-page">
      <PageHeader
        title="Schedule"
        subtitle="View and manage your job schedule"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard 
          title="Today" 
          value={stats.jobsToday.toString()} 
          icon={Clock}
          testId="kpi-jobs-today"
        />
        <StatCard 
          title="This Week" 
          value={stats.jobsThisWeek.toString()} 
          icon={Briefcase}
          testId="kpi-jobs-week"
        />
        <StatCard 
          title="Upcoming" 
          value={stats.upcoming.toString()} 
          icon={CalendarIcon}
          testId="kpi-upcoming-jobs"
        />
        <StatCard 
          title="Completed" 
          value={stats.completed.toString()} 
          icon={CheckCircle2}
          testId="kpi-completed-jobs"
        />
      </div>

      {/* Calendar Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
            data-testid="button-prev-period"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={handleToday}
            data-testid="button-today"
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            data-testid="button-next-period"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-base sm:text-lg font-semibold">
            {viewMode === 'week' 
              ? `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`
              : format(currentDate, 'MMMM yyyy')
            }
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'week' ? 'default' : 'outline'}
            onClick={() => setViewMode('week')}
            data-testid="button-week-view"
          >
            Week
          </Button>
          <Button
            variant={viewMode === 'month' ? 'default' : 'outline'}
            onClick={() => setViewMode('month')}
            data-testid="button-month-view"
          >
            Month
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      {jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No jobs scheduled</h3>
            <p className="text-muted-foreground text-center">
              Schedule jobs to see them on your calendar
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className={`grid gap-3 ${viewMode === 'week' ? 'grid-cols-1 md:grid-cols-7' : 'grid-cols-1 md:grid-cols-7'}`}>
          {days.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayJobs = jobsByDate[dateKey] || [];
            const isCurrentMonth = isSameMonth(day, currentDate);

            return (
              <Card 
                key={dateKey}
                className={`${!isCurrentMonth && viewMode === 'month' ? 'opacity-40' : ''} ${
                  isDateToday(day) ? 'ring-2 ring-primary' : ''
                }`}
                data-testid={`calendar-day-${dateKey}`}
              >
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span className={isDateToday(day) ? 'text-primary font-bold' : ''}>
                      {format(day, 'EEE d')}
                    </span>
                    {dayJobs.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {dayJobs.length}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-2">
                  {dayJobs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No jobs</p>
                  ) : (
                    dayJobs.map((job) => (
                      <div
                        key={job.id}
                        className="p-2 rounded-md border hover-elevate cursor-pointer transition-transform"
                        data-testid={`job-${job.id}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-medium text-sm line-clamp-2">{job.title}</h4>
                          <Badge 
                            variant="outline"
                            className={`text-xs flex-shrink-0 ${getStatusColor(job.status)}`}
                          >
                            {job.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span className="truncate">{job.clientName}</span>
                        </div>
                        {job.location && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{job.location}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
