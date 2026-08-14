import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { 
  TimerWidget, 
  TimesheetList, 
  TimeTrackingDashboard 
} from "@/components/TimeTracking";
import { 
  Clock, 
  Calendar, 
  FileText, 
  BarChart3,
  Download,
  Filter,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  Briefcase,
  Coffee,
  DollarSign,
  Timer,
  User
} from "lucide-react";
import { apiRequest, queryClient, getAuthHeaders} from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

// Payroll Reporting Component
function PayrollReporting() {
  const [reportType, setReportType] = useState<'detailed' | 'summary'>('summary');
  const [period, setPeriod] = useState<'current' | 'previous'>('current');

  const { data: payrollData, isLoading, error } = useQuery({
    queryKey: ['/api/time-tracking/reports/payroll', reportType, period],
    queryFn: async () => {
      const params = new URLSearchParams({
        format: reportType,
        period: period,
      });
      const res = await fetch(`/api/time-tracking/reports/payroll?${params}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch payroll data');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Card data-testid="card-payroll-loading">
        <CardHeader>
          <CardTitle>Payroll Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-muted rounded animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" data-testid="alert-payroll-error">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load payroll data. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card data-testid="card-payroll-report">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Payroll Report
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={reportType === 'summary' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setReportType('summary')}
              data-testid="button-report-summary"
            >
              Summary
            </Button>
            <Button
              variant={reportType === 'detailed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setReportType('detailed')}
              data-testid="button-report-detailed"
            >
              Detailed
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={period === 'current' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod('current')}
              data-testid="button-period-current"
            >
              <span className="sm:hidden">This Week</span>
              <span className="hidden sm:inline">Current Week</span>
            </Button>
            <Button
              variant={period === 'previous' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod('previous')}
              data-testid="button-period-previous"
            >
              <span className="sm:hidden">Last Week</span>
              <span className="hidden sm:inline">Previous Week</span>
            </Button>
          </div>
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          <Button variant="outline" size="sm" data-testid="button-export-payroll">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        {payrollData && (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Total Hours</div>
                <div className="text-2xl font-bold" data-testid="text-total-hours">
                  {payrollData.totalHours?.toFixed(1) || '0.0'}h
                </div>
                {payrollData.overtimeHours > 0 && (
                  <div className="text-sm text-warning">
                    +{payrollData.overtimeHours.toFixed(1)}h overtime
                  </div>
                )}
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Total Earnings</div>
                <div className="text-2xl font-bold text-success" data-testid="text-total-earnings">
                  ${payrollData.totalEarnings?.toFixed(2) || '0.00'}
                </div>
                {payrollData.overtimeEarnings > 0 && (
                  <div className="text-sm text-success">
                    +${payrollData.overtimeEarnings.toFixed(2)} overtime
                  </div>
                )}
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Average Rate</div>
                <div className="text-2xl font-bold" data-testid="text-average-rate">
                  ${payrollData.averageRate?.toFixed(0) || '0'}/hr
                </div>
                <div className="text-sm text-muted-foreground">
                  Across {payrollData.jobsWorked || 0} jobs
                </div>
              </div>
            </div>

            {/* Job Breakdown */}
            {payrollData.jobBreakdown && payrollData.jobBreakdown.length > 0 && (
              <div>
                <h4 className="font-medium mb-3">Job Breakdown</h4>
                <div className="space-y-2">
                  {payrollData.jobBreakdown.map((job: any, index: number) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-3 border rounded"
                      data-testid={`row-job-breakdown-${index}`}
                    >
                      <div>
                        <div className="font-medium" data-testid={`text-job-title-${index}`}>
                          {job.jobTitle || 'General Work'}
                        </div>
                        {job.clientName && (
                          <div className="text-sm text-muted-foreground" data-testid={`text-client-name-${index}`}>
                            {job.clientName}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-medium" data-testid={`text-job-hours-${index}`}>
                          {job.hours?.toFixed(1)}h
                        </div>
                        <div className="text-sm text-muted-foreground" data-testid={`text-job-earnings-${index}`}>
                          ${job.earnings?.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Time Tracking Analytics Component
function TimeTrackingAnalytics() {
  const { data: timesheets, isLoading } = useQuery<any[]>({
    queryKey: ['/api/timesheets', 'includeEntries'],
    queryFn: async () => {
      const res = await fetch('/api/timesheets?includeEntries=true', { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch timesheets');
      return res.json();
    },
  });

  const { data: timeEntries } = useQuery<any[]>({
    queryKey: ['/api/time-entries'],
    queryFn: async () => {
      const res = await fetch('/api/time-entries', { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch time entries');
      return res.json();
    },
  });

  const CHART_COLORS = ['hsl(var(--trade))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  const getWeeklyTrendsData = () => {
    if (!timesheets || timesheets.length === 0) {
      const now = new Date();
      return Array.from({ length: 4 }, (_, i) => {
        const weekStart = subWeeks(now, 3 - i);
        return {
          week: format(weekStart, 'MMM d'),
          hours: 0,
          earnings: 0,
        };
      });
    }

    const sortedSheets = [...timesheets]
      .sort((a, b) => new Date(a.weekStarting).getTime() - new Date(b.weekStarting).getTime())
      .slice(-4);

    return sortedSheets.map((sheet) => ({
      week: format(new Date(sheet.weekStarting), 'MMM d'),
      hours: sheet.aggregations?.totalHours || sheet.totalHours || 0,
      earnings: sheet.aggregations?.totalEarnings || 0,
    }));
  };

  const getJobDistributionData = () => {
    if (!timeEntries || timeEntries.length === 0) {
      return [
        { name: 'No data', value: 1, color: 'hsl(var(--muted))' }
      ];
    }

    const jobHours: Record<string, { name: string; hours: number }> = {};
    
    timeEntries.forEach((entry: any) => {
      const jobTitle = entry.jobTitle || 'General Work';
      if (!jobHours[jobTitle]) {
        jobHours[jobTitle] = { name: jobTitle, hours: 0 };
      }
      jobHours[jobTitle].hours += (entry.duration || 0) / 60;
    });

    const sorted = Object.values(jobHours)
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);

    if (sorted.length === 0) {
      return [{ name: 'No data', value: 1, color: 'hsl(var(--muted))' }];
    }

    return sorted.map((job, index) => ({
      name: job.name,
      value: Math.round(job.hours * 10) / 10,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
  };

  const weeklyData = getWeeklyTrendsData();
  const jobData = getJobDistributionData();
  
  // Compute totals from ALL timesheets, not just the chart data
  const totalHoursTracked = timesheets?.reduce((sum, sheet: any) => {
    return sum + (sheet.aggregations?.totalHours || sheet.totalHours || 0);
  }, 0) || 0;
  
  const totalEarnings = timesheets?.reduce((sum, sheet: any) => {
    return sum + (sheet.aggregations?.totalEarnings || 0);
  }, 0) || 0;

  // Category breakdown from time entries
  const getCategoryBreakdown = () => {
    if (!timeEntries || timeEntries.length === 0) return [];
    const catHours: Record<string, number> = {};
    const CATEGORY_COLORS_MAP: Record<string, string> = {
      work: '#2563EB', travel: '#7C3AED', materials: '#D97706',
      admin: '#0891B2', meeting: '#059669', training: '#DB2777', other: '#6B7280',
    };
    const CATEGORY_LABELS: Record<string, string> = {
      work: 'Site Work', travel: 'Driving / Travel', materials: 'Supplies Run',
      admin: 'Admin / Office', meeting: 'Meeting', training: 'Training', other: 'Other',
    };
    timeEntries.forEach((e: any) => {
      if (e.isBreak) return;
      const cat = e.timeCategory || 'work';
      catHours[cat] = (catHours[cat] || 0) + (e.duration || 0) / 60;
    });
    return Object.entries(catHours)
      .filter(([, h]) => h > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, hours]) => ({
        name: CATEGORY_LABELS[cat] ?? cat,
        hours: Math.round(hours * 10) / 10,
        color: CATEGORY_COLORS_MAP[cat] ?? '#6B7280',
      }));
  };

  const categoryBreakdown = getCategoryBreakdown();

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="card-weekly-trends">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Weekly Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 bg-muted rounded animate-pulse"></div>
          </CardContent>
        </Card>
        <Card data-testid="card-job-distribution">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Job Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 bg-muted rounded animate-pulse"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
            >
              <Clock className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">All Time Hours</p>
              <p className="text-2xl font-bold" data-testid="text-total-hours-analytics">
                {totalHoursTracked.toFixed(1)}h
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'hsl(var(--success) / 0.1)' }}
            >
              <BarChart3 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estimated Earnings</p>
              <p className="text-2xl font-bold text-success" data-testid="text-total-earnings-analytics">
                ${totalEarnings.toFixed(0)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="card-weekly-trends">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              Weekly Hours Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="week" 
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(value) => `${value}h`}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)} hours`, 'Hours']}
                  />
                  <Bar 
                    dataKey="hours" 
                    fill="hsl(var(--trade))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        {categoryBreakdown.length > 1 && (
          <Card data-testid="card-category-breakdown" className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                Hours by Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-3">
                {categoryBreakdown.map(cat => (
                  <span
                    key={cat.name}
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full font-medium"
                    style={{ backgroundColor: cat.color + '18', color: cat.color }}
                  >
                    {cat.name} <span className="font-bold">{cat.hours}h</span>
                  </span>
                ))}
              </div>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryBreakdown} layout="vertical" margin={{ left: 80 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}h`} stroke="hsl(var(--muted-foreground))" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                      formatter={(v: number) => [`${v} hours`, 'Hours']}
                    />
                    <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
                      {categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        <Card data-testid="card-job-distribution">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              Time by Job
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              {jobData[0]?.name === 'No data' ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <Briefcase className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">No time entries recorded yet</p>
                  <p className="text-xs mt-1">Start tracking time to see job distribution</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={jobData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${value}h`}
                      labelLine={false}
                    >
                      {jobData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`${value} hours`, 'Time']}
                    />
                    <Legend 
                      formatter={(value) => (
                        <span className="text-xs">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TimesheetExport() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const weekStart = startOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const handleExport = async (fmt: 'pdf' | 'csv') => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        format: fmt,
        weekStarting: weekStart.toISOString(),
      });
      const res = await fetch(`/api/timesheets/export?${params}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Export failed');
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = format(weekStart, 'yyyy-MM-dd');
      a.download = `timesheet-${dateStr}.${fmt}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({ title: "Export Downloaded", description: `Your ${fmt.toUpperCase()} timesheet has been downloaded.` });
    } catch (error) {
      toast({ title: "Export Failed", description: "Could not generate the timesheet export.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card data-testid="card-timesheet-export">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Export Timesheet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(w => w + 1)} data-testid="button-prev-week">
            Previous Week
          </Button>
          <div className="text-center">
            <p className="text-sm font-medium">
              {format(weekStart, 'dd MMM')} - {format(weekEnd, 'dd MMM yyyy')}
            </p>
            <p className="text-xs text-muted-foreground">
              {weekOffset === 0 ? 'This Week' : weekOffset === 1 ? 'Last Week' : `${weekOffset} weeks ago`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(w => Math.max(0, w - 1))} disabled={weekOffset === 0} data-testid="button-next-week">
            Next Week
          </Button>
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={() => handleExport('pdf')} disabled={isExporting} data-testid="button-export-pdf">
            <FileText className="h-4 w-4 mr-2" />
            {isExporting ? 'Generating...' : 'Export PDF'}
          </Button>
          <Button variant="outline" onClick={() => handleExport('csv')} disabled={isExporting} data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Generating...' : 'Export CSV'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          PDF format is perfect for sending to your accountant. CSV works great for spreadsheets.
        </p>
      </CardContent>
    </Card>
  );
}

function GeofenceGpsAlerts() {
  const { data: geofenceAlerts = [], isLoading: geoLoading } = useQuery<any[]>({
    queryKey: ['/api/geofence-alerts', { type: 'departure', limit: 10 }],
    queryFn: async () => {
      const res = await fetch('/api/geofence-alerts?type=departure&limit=10', { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: gpsLogs = [], isLoading: gpsLoading } = useQuery<any[]>({
    queryKey: ['/api/gps-signal-logs'],
    queryFn: async () => {
      const res = await fetch('/api/gps-signal-logs?limit=10', { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const isLoading = geoLoading || gpsLoading;

  const allAlerts = [
    ...geofenceAlerts.map((a: any) => ({
      id: a.id,
      type: 'geofence_exit' as const,
      title: `${a.userName || 'Team member'} left job site`,
      detail: a.jobTitle || a.jobAddress || '',
      time: new Date(a.createdAt),
      icon: 'map-pin',
      duration: undefined as number | undefined,
    })),
    ...gpsLogs
      .filter((l: any) => l.eventType === 'signal_lost')
      .map((l: any) => ({
        id: l.id,
        type: 'gps_loss' as const,
        title: 'GPS signal lost',
        detail: l.address || 'Unknown location',
        time: new Date(l.createdAt),
        icon: 'signal',
        duration: l.durationSeconds,
      })),
  ].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 10);

  if (isLoading) {
    return (
      <Card data-testid="card-geo-alerts-loading">
        <CardHeader><CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5" />Location Alerts</CardTitle></CardHeader>
        <CardContent><div className="h-24 bg-muted rounded animate-pulse"></div></CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-geo-alerts">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Location Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {allAlerts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No location alerts</p>
            <p className="text-xs mt-1">Geofence exits and GPS signal issues will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allAlerts.map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 p-2 rounded-md hover-elevate">
                <div className={`mt-0.5 p-1.5 rounded-full ${alert.type === 'geofence_exit' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-red-100 dark:bg-red-900/30 text-red-600'}`}>
                  {alert.type === 'geofence_exit' ? <Briefcase className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{alert.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{alert.detail}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(alert.time, 'dd MMM h:mm a')}
                    {alert.duration ? ` (${Math.round(alert.duration / 60)} min loss)` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Main Time Tracking Page
export default function TimeTrackingPage() {
  const [activeTab, setActiveTab] = useState('timer');
  const [showActiveTimers, setShowActiveTimers] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: rawActiveTimers, refetch: refetchTimers } = useQuery({
    queryKey: ['/api/time-entries/active'],
  });
  const activeTimers: any[] = Array.isArray(rawActiveTimers) ? rawActiveTimers : (rawActiveTimers ? [rawActiveTimers] : []);

  // Start break timer mutation
  const startBreakMutation = useMutation({
    mutationFn: async () => {
      const activeRes = await fetch('/api/time-entries/active/current', { credentials: 'include', headers: getAuthHeaders() });
      if (activeRes.ok) {
        const activeTimer = await activeRes.json();
        if (activeTimer && activeTimer.id) {
          await apiRequest('POST', `/api/time-entries/${activeTimer.id}/stop`);
        }
      }
      return apiRequest('POST', '/api/time-entries', {
        description: 'Break',
        isBreak: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      toast({
        title: "Break Started",
        description: "Your break timer has started. Take a well-deserved rest!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to start break timer",
        variant: "destructive",
      });
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
    queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active'] });
    queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
    toast({
      title: "Refreshed",
      description: "Time tracking data has been updated.",
    });
  };

  return (
    <PageShell data-testid="page-time-tracking">
      <PageHeader
        title="Time Tracking"
        subtitle="Track your work hours and manage timesheets"
        action={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" data-testid="button-refresh" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" data-testid="button-filter">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
        }
      />

      {/* Dashboard Stats */}
      <TimeTrackingDashboard />

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-16 p-1">
          <TabsTrigger value="timer" data-testid="tab-timer" className="flex flex-col items-center justify-center gap-0.5 py-1 px-2 text-xs h-full">
            <Clock className="h-3.5 w-3.5" />
            <span className="leading-none">Timer</span>
          </TabsTrigger>
          <TabsTrigger value="timesheet" data-testid="tab-timesheet" className="flex flex-col items-center justify-center gap-0.5 py-1 px-2 text-xs h-full">
            <Calendar className="h-3.5 w-3.5" />
            <span className="leading-none">Sheet</span>
          </TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports" className="flex flex-col items-center justify-center gap-0.5 py-1 px-2 text-xs h-full">
            <FileText className="h-3.5 w-3.5" />
            <span className="leading-none">Reports</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics" className="flex flex-col items-center justify-center gap-0.5 py-1 px-2 text-xs h-full">
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="leading-none">Stats</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timer" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card 
              className="border-2"
              style={{ borderColor: 'hsl(var(--trade) / 0.3)' }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: 'hsl(var(--trade))' }}>
                  <Timer className="h-5 w-5" />
                  Time Tracking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TimerWidget />
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  data-testid="button-start-break"
                  onClick={() => startBreakMutation.mutate()}
                  disabled={startBreakMutation.isPending}
                >
                  <Coffee className="h-4 w-4 mr-2" />
                  {startBreakMutation.isPending ? 'Starting...' : 'Start Break Timer'}
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  data-testid="button-edit-rates"
                  onClick={() => navigate('/settings?tab=payment')}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Edit Hourly Rates
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  data-testid="button-view-active"
                  onClick={() => {
                    refetchTimers();
                    setShowActiveTimers(true);
                  }}
                >
                  <Timer className="h-4 w-4 mr-2" />
                  View All Active Timers
                  {activeTimers.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {activeTimers.length}
                    </Badge>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
          
          <TimesheetList limit={5} />
        </TabsContent>

        <TabsContent value="timesheet" className="space-y-6">
          <TimesheetList limit={50} />
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <TimesheetExport />
            <GeofenceGpsAlerts />
          </div>
          <PayrollReporting />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <TimeTrackingAnalytics />
        </TabsContent>
      </Tabs>

      {/* Active Timers Dialog */}
      <Dialog open={showActiveTimers} onOpenChange={setShowActiveTimers}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Active Timers
            </DialogTitle>
            <DialogDescription>
              Currently running timers across all jobs
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {activeTimers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Timer className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No active timers</p>
                <p className="text-sm mt-1">Start a timer to track your work</p>
              </div>
            ) : (
              activeTimers.map((timer: any) => (
                <Card key={timer.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{timer.description || 'Untitled'}</p>
                      {timer.jobTitle && (
                        <p className="text-sm text-muted-foreground truncate">{timer.jobTitle}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={timer.isBreak ? "secondary" : "default"} className="text-xs">
                          {timer.isBreak ? 'Break' : 'Working'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Started {format(new Date(timer.startTime), 'h:mm a')}
                        </span>
                      </div>
                    </div>
                    {timer.user && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        {timer.user.firstName || timer.user.email?.split('@')[0]}
                      </div>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActiveTimers(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}