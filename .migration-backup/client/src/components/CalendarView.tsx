import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Plus,
  Clock,
  MapPin,
  Briefcase
} from "lucide-react";
import { useJobs } from "@/hooks/use-jobs";
import { useClients } from "@/hooks/use-clients";
import StatusBadge from "./StatusBadge";

interface JobForDate {
  id: string;
  title: string;
  client: string;
  address: string;
  time: string;
  duration: string;
  status: string;
  date: string;
}

interface MonthViewProps {
  currentDate: Date;
  getJobsForDate: (date: Date) => JobForDate[];
  isToday: (date: Date) => boolean;
  onViewJob?: (id: string) => void;
  onCreateJob?: () => void;
}

function MonthView({ currentDate, getJobsForDate, isToday, onViewJob, onCreateJob }: MonthViewProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();
  
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  
  for (let i = 0; i < startDayOfWeek; i++) {
    const prevDate = new Date(year, month, 1 - (startDayOfWeek - i));
    currentWeek.push(prevDate);
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(new Date(year, month, day));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  
  if (currentWeek.length > 0) {
    let nextDay = 1;
    while (currentWeek.length < 7) {
      currentWeek.push(new Date(year, month + 1, nextDay++));
    }
    weeks.push(currentWeek);
  }
  
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const isCurrentMonth = (date: Date) => date.getMonth() === month;
  
  const totalJobsThisMonth = Array.from({ length: daysInMonth }, (_, i) => 
    getJobsForDate(new Date(year, month, i + 1)).length
  ).reduce((sum, count) => sum + count, 0);

  return (
    <Card className="mt-3">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            {totalJobsThisMonth} job{totalJobsThisMonth !== 1 ? 's' : ''} this month
          </p>
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {dayNames.map((name) => (
            <div 
              key={name} 
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {name}
            </div>
          ))}
          
          {weeks.map((week, weekIndex) => (
            week.map((date, dayIndex) => {
              const dayJobs = getJobsForDate(date);
              const today = isToday(date);
              const inMonth = isCurrentMonth(date);
              
              return (
                <div
                  key={`${weekIndex}-${dayIndex}`}
                  className={`min-h-[80px] sm:min-h-[100px] p-1 rounded-lg border transition-colors ${
                    !inMonth 
                      ? 'bg-muted/30 border-transparent' 
                      : today 
                        ? 'border-2' 
                        : 'border-border hover:bg-muted/50'
                  }`}
                  style={today ? { 
                    borderColor: 'hsl(var(--trade))',
                    backgroundColor: 'hsl(var(--trade) / 0.05)'
                  } : {}}
                  data-testid={`month-day-${date.getDate()}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span 
                      className={`text-xs sm:text-sm font-medium ${
                        !inMonth ? 'text-muted-foreground/50' : today ? '' : ''
                      }`}
                      style={today ? { color: 'hsl(var(--trade))' } : {}}
                    >
                      {date.getDate()}
                    </span>
                    {dayJobs.length > 0 && (
                      <Badge 
                        variant="secondary" 
                        className="text-[10px] px-1 py-0 h-4"
                        style={{
                          backgroundColor: 'hsl(var(--trade) / 0.15)',
                          color: 'hsl(var(--trade))'
                        }}
                      >
                        {dayJobs.length}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-0.5 overflow-hidden">
                    {dayJobs.slice(0, 2).map((job) => (
                      <div
                        key={job.id}
                        onClick={() => onViewJob?.(job.id)}
                        className="text-[10px] sm:text-xs px-1 py-0.5 rounded truncate cursor-pointer hover-elevate"
                        style={{
                          backgroundColor: 'hsl(var(--trade) / 0.1)',
                        }}
                        data-testid={`month-job-${job.id}`}
                      >
                        <span className="hidden sm:inline">{job.time} </span>
                        <span className="font-medium">{job.title}</span>
                      </div>
                    ))}
                    {dayJobs.length > 2 && (
                      <div className="text-[10px] text-muted-foreground pl-1">
                        +{dayJobs.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface CalendarViewProps {
  onCreateJob?: () => void;
  onViewJob?: (id: string) => void;
  onEditJob?: (id: string) => void;
}

export default function CalendarView({
  onCreateJob,
  onViewJob,
  onEditJob
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'month'>('week');
  
  const { data: jobs = [] } = useJobs();
  const { data: clients = [] } = useClients();

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('en-AU', { 
      day: 'numeric',
      month: 'short'
    });
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-AU', { 
      year: 'numeric', 
      month: 'long'
    });
  };

  const getCurrentWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };

  const getJobsForDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    return (jobs as any[]).filter(job => {
      if (!job.scheduledAt) return false;
      const jd = new Date(job.scheduledAt);
      const jYear = jd.getFullYear();
      const jMonth = String(jd.getMonth() + 1).padStart(2, '0');
      const jDay = String(jd.getDate()).padStart(2, '0');
      return `${jYear}-${jMonth}-${jDay}` === dateStr;
    }).map(job => {
      const client = (clients as any[]).find(c => c.id === job.clientId);
      let timeDisplay = '';
      let sortMinutes = 1440;
      if (job.scheduledTime) {
        const parts = job.scheduledTime.split(':').map(Number);
        const h = parts[0] || 0;
        const m = parts[1] || 0;
        sortMinutes = h * 60 + m;
        const ampm = h >= 12 ? 'pm' : 'am';
        const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
        timeDisplay = `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
      } else {
        const scheduledDate = new Date(job.scheduledAt);
        const h = scheduledDate.getHours();
        const m = scheduledDate.getMinutes();
        if (h !== 0 || m !== 0) {
          sortMinutes = h * 60 + m;
          const ampm = h >= 12 ? 'pm' : 'am';
          const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
          timeDisplay = `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
        }
      }
      return {
        id: job.id,
        title: job.title,
        client: client?.name || 'Unknown Client',
        address: job.address || 'No address',
        time: timeDisplay,
        duration: job.estimatedHours ? `${job.estimatedHours} hours` : 'TBD',
        status: job.status,
        date: dateStr,
        _sortMinutes: sortMinutes
      };
    }).sort((a, b) => a._sortMinutes - b._sortMinutes);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const weekDays = getCurrentWeekDays();
  const weekStart = formatDateShort(weekDays[0]);
  const weekEnd = formatDateShort(weekDays[6]);

  // Count total jobs this week
  const weekJobCount = weekDays.reduce((total, date) => total + getJobsForDate(date).length, 0);

  return (
    <PageShell data-testid="calendar-view">
      <PageHeader
        title="Calendar"
        subtitle="Schedule and track your jobs"
        action={
          <Button 
            onClick={onCreateJob} 
            data-testid="button-create-job-calendar"
            style={{
              backgroundColor: 'hsl(var(--trade))',
              borderColor: 'hsl(var(--trade-border))',
              color: 'white'
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Schedule Job
          </Button>
        }
      />

      {/* Calendar Controls - Mobile Optimized with better spacing */}
      <Card>
        <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
          {/* Navigation Row - Stacked on mobile for more space */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center justify-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1 p-1 bg-muted rounded-lg flex-1 sm:flex-none">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView('week')}
                  data-testid="button-week-view"
                  className={`flex-1 sm:flex-none px-4 ${view === 'week' ? 'shadow-sm' : ''}`}
                  style={view === 'week' ? {
                    backgroundColor: 'hsl(var(--trade))',
                    color: 'white'
                  } : {}}
                >
                  Week
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView('month')}
                  data-testid="button-month-view"
                  className={`flex-1 sm:flex-none px-4 ${view === 'month' ? 'shadow-sm' : ''}`}
                  style={view === 'month' ? {
                    backgroundColor: 'hsl(var(--trade))',
                    color: 'white'
                  } : {}}
                >
                  Month
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
                data-testid="button-today"
                className="px-4"
              >
                <CalendarIcon className="h-4 w-4 mr-1" />
                Today
              </Button>
            </div>
          </div>

          {/* Date Navigation Row */}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => view === 'week' ? navigateWeek('prev') : navigateMonth('prev')}
              data-testid="button-prev-period"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="text-center flex-1 min-w-0 px-2">
              <h2 className="text-base sm:text-lg font-semibold truncate">
                {view === 'week' 
                  ? `${weekStart} - ${weekEnd}`
                  : formatMonthYear(currentDate)
                }
              </h2>
              <p className="text-xs text-muted-foreground">
                {view === 'week' && weekJobCount > 0 ? `${weekJobCount} job${weekJobCount === 1 ? '' : 's'} scheduled` : ''}
              </p>
            </div>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => view === 'week' ? navigateWeek('next') : navigateMonth('next')}
              data-testid="button-next-period"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Week View - Horizontal Scroll on Mobile, Grid on Desktop */}
      {view === 'week' && (
        <>
          {/* Mobile: Horizontal Day Selector with larger touch targets */}
          <div className="md:hidden mt-3">
            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {weekDays.map((date, index) => {
                const dayJobs = getJobsForDate(date);
                const dayName = date.toLocaleDateString('en-AU', { weekday: 'short' });
                const dayNumber = date.getDate();
                const today = isToday(date);
                const isSelected = currentDate.toDateString() === date.toDateString();
                
                return (
                  <button
                    key={index}
                    onClick={() => setCurrentDate(date)}
                    className={`flex-shrink-0 min-w-[52px] py-3 px-2 rounded-xl text-center transition-all border ${
                      today 
                        ? 'border-transparent' 
                        : isSelected
                        ? 'bg-muted border-muted'
                        : 'border-transparent hover:bg-muted/50'
                    }`}
                    style={today ? { 
                      backgroundColor: 'hsl(var(--trade) / 0.15)',
                      boxShadow: '0 0 0 2px hsl(var(--trade))'
                    } : {}}
                    data-testid={`calendar-day-${index}`}
                  >
                    <p className="text-xs font-medium text-muted-foreground mb-1">{dayName}</p>
                    <p className={`text-xl font-bold`} style={today ? { color: 'hsl(var(--trade))' } : {}}>
                      {dayNumber}
                    </p>
                    {dayJobs.length > 0 && (
                      <div 
                        className="mx-auto w-2 h-2 rounded-full mt-1"
                        style={{ backgroundColor: 'hsl(var(--trade))' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Mobile: Today's Jobs List */}
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                    <span className="font-medium">
                      {currentDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  {isToday(currentDate) && (
                    <Badge 
                      variant="default" 
                      className="text-xs"
                      style={{
                        backgroundColor: 'hsl(var(--trade))',
                        color: 'white'
                      }}
                    >
                      Today
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {getJobsForDate(currentDate).length > 0 ? (
                  getJobsForDate(currentDate).map((job) => (
                    <div 
                      key={job.id}
                      className="p-3 rounded-lg border hover-elevate cursor-pointer"
                      onClick={() => onViewJob?.(job.id)}
                      data-testid={`calendar-job-${job.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'hsl(var(--trade))' }} />
                            <span className="text-sm font-medium">{job.time}</span>
                          </div>
                          <p className="font-medium truncate">{job.title}</p>
                          <p className="text-sm text-muted-foreground truncate">{job.client}</p>
                        </div>
                        <StatusBadge status={job.status} />
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="text-xs truncate">{job.address}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Briefcase className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm">No jobs scheduled</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={onCreateJob}
                      data-testid="button-schedule-job-empty"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Schedule Job
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Desktop: 7-Day Grid */}
          <div className="hidden md:grid md:grid-cols-7 gap-3">
            {weekDays.map((date, index) => {
              const dayJobs = getJobsForDate(date);
              const dayName = date.toLocaleDateString('en-AU', { weekday: 'short' });
              const dayNumber = date.getDate();
              const today = isToday(date);
              
              return (
                <Card 
                  key={index} 
                  className="min-h-[180px]"
                  style={today ? { 
                    borderColor: 'hsl(var(--trade))',
                    boxShadow: '0 0 0 2px hsl(var(--trade))'
                  } : {}}
                >
                  <CardHeader className="pb-2 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{dayName}</p>
                        <p className={`text-lg font-bold`} style={today ? { color: 'hsl(var(--trade))' } : {}}>
                          {dayNumber}
                        </p>
                      </div>
                      {today && (
                        <Badge 
                          variant="default" 
                          className="text-xs"
                          style={{
                            backgroundColor: 'hsl(var(--trade))',
                            color: 'white'
                          }}
                        >
                          Today
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-3 pb-3 space-y-2">
                    {dayJobs.map((job) => (
                      <div 
                        key={job.id}
                        className="p-2 rounded-lg bg-muted hover-elevate cursor-pointer"
                        onClick={() => onViewJob?.(job.id)}
                        data-testid={`calendar-job-${job.id}`}
                      >
                        <div className="flex items-center gap-1 mb-1">
                          <Clock className="h-3 w-3" style={{ color: 'hsl(var(--trade))' }} />
                          <span className="text-xs font-medium">{job.time}</span>
                        </div>
                        <p className="text-xs font-medium line-clamp-1">{job.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{job.client}</p>
                      </div>
                    ))}
                    
                    {dayJobs.length === 0 && (
                      <div className="flex items-center justify-center py-4 text-muted-foreground">
                        <p className="text-xs">No jobs</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {view === 'month' && (
        <MonthView 
          currentDate={currentDate}
          getJobsForDate={getJobsForDate}
          isToday={isToday}
          onViewJob={onViewJob}
          onCreateJob={onCreateJob}
        />
      )}
    </PageShell>
  );
}
