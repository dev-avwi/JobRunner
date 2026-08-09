import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserAvatar } from '@/components/UserAvatar';
import { Sparkles, MapPin, Clock, Route, Calendar as CalendarIcon, ChevronRight, Lightbulb, Loader2, Navigation, AlertTriangle, Users, Wrench, User, HardHat, ArrowRight } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface OptimizedJob {
  job: {
    id: string;
    title: string;
    clientName: string;
    address?: string;
    priority?: string;
    estimatedDuration?: number;
  };
  suggestedTime: string;
  travelDistance?: number;
  travelTime?: number;
  reason: string;
}

interface TeamMemberInfo {
  id: string;
  memberId: string;
  name: string;
  role: string;
}

interface EquipmentInfo {
  id: string;
  name: string;
  category: string;
  status: string;
}

interface OptimizedSchedule {
  date: string;
  optimizedOrder: OptimizedJob[];
  totalDistance: number;
  totalTime: number;
  totalDriveTime?: number;
  routeSource?: 'osrm' | 'haversine';
  aiSuggestions: string[];
  aiRecommendations: string;
  teamMembers?: TeamMemberInfo[];
  availableEquipment?: EquipmentInfo[];
  jobAssignments?: Record<string, string | null>;
  jobEquipmentAssignments?: Record<string, any[]>;
}

interface JobAssignment {
  jobId: string;
  workerId: string | null;
  equipmentIds: string[];
}

interface AIScheduleOptimizerProps {
  onApplySchedule?: (schedule: OptimizedSchedule) => void;
  className?: string;
}

function formatDriveTime(minutes?: number): string {
  if (!minutes || minutes <= 0) return '0 min';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m} min`;
}

export function AIScheduleOptimizer({ onApplySchedule, className }: AIScheduleOptimizerProps) {
  const [, navigate] = useLocation();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, JobAssignment>>({});
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const optimizeMutation = useMutation({
    mutationFn: async (date: Date) => {
      const response = await apiRequest('POST', '/api/schedule/ai-optimize', {
        date: date.toISOString(),
        workdayStart: '07:00',
        workdayEnd: '17:00'
      });
      return await response.json() as OptimizedSchedule;
    },
    onSuccess: (data) => {
      setIsOptimizing(false);
      const initial: Record<string, JobAssignment> = {};
      data.optimizedOrder.forEach(item => {
        initial[item.job.id] = {
          jobId: item.job.id,
          workerId: data.jobAssignments?.[item.job.id] || null,
          equipmentIds: data.jobEquipmentAssignments?.[item.job.id]?.map((a: any) => a.equipmentId) || [],
        };
      });
      setAssignments(initial);
    },
    onError: () => {
      setIsOptimizing(false);
    }
  });

  const handleOptimize = () => {
    setIsOptimizing(true);
    optimizeMutation.mutate(selectedDate);
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/10 text-red-600 border-red-200 dark:border-red-800';
      case 'high': return 'bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-800';
      case 'medium': return 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800';
      case 'low': return 'bg-gray-500/10 text-gray-600 border-gray-200 dark:border-gray-800';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-200 dark:border-gray-800';
    }
  };

  const optimizedData = optimizeMutation.data;

  const updateWorkerAssignment = (jobId: string, workerId: string | null) => {
    setAssignments(prev => ({
      ...prev,
      [jobId]: { ...prev[jobId], workerId }
    }));
  };

  const toggleEquipment = (jobId: string, equipmentId: string) => {
    setAssignments(prev => {
      const current = prev[jobId]?.equipmentIds || [];
      const updated = current.includes(equipmentId)
        ? current.filter(id => id !== equipmentId)
        : [...current, equipmentId];
      return {
        ...prev,
        [jobId]: { ...prev[jobId], equipmentIds: updated }
      };
    });
  };

  const handleApplyFullPlan = async () => {
    if (!optimizedData) return;
    setIsSaving(true);
    try {
      for (const item of optimizedData.optimizedOrder) {
        // Apply the optimised order to the schedule by writing each job's
        // start time. Build a timestamp from the plan date + suggested time.
        const patch: Record<string, any> = {};
        const [h, m] = item.suggestedTime.split(':').map(Number);
        if (!Number.isNaN(h) && !Number.isNaN(m)) {
          const scheduled = new Date(`${optimizedData.date}T00:00:00`);
          scheduled.setHours(h, m, 0, 0);
          patch.scheduledAt = scheduled.toISOString();
        }

        const assignment = assignments[item.job.id];
        if (assignment?.workerId) {
          patch.assignedTo = assignment.workerId;
        }

        if (Object.keys(patch).length > 0) {
          await apiRequest('PATCH', `/api/jobs/${item.job.id}`, patch);
        }

        if (!assignment) continue;

        for (const eqId of assignment.equipmentIds) {
          try {
            await apiRequest('POST', `/api/jobs/${item.job.id}/equipment`, {
              equipmentId: eqId,
            });
          } catch {
            // might already be assigned
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/job-equipment-summary'] });

      toast({
        title: 'Day plan applied',
        description: `Updated ${optimizedData.optimizedOrder.length} job assignments`,
      });

      if (onApplySchedule) {
        onApplySchedule(optimizedData);
      }
    } catch (error) {
      toast({
        title: 'Error applying plan',
        description: 'Some assignments may not have been saved. Please check and retry.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewRouteOnMap = () => {
    if (!optimizedData) return;
    const routeJobs = optimizedData.optimizedOrder.map(item => ({
      jobId: item.job.id,
      title: item.job.title,
      clientName: item.job.clientName,
      address: item.job.address,
      travelTime: item.travelTime,
      travelDistance: item.travelDistance,
    }));
    const routeParam = encodeURIComponent(JSON.stringify(routeJobs));
    navigate(`/map?route=${routeParam}`);
  };

  const workerJobCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(assignments).forEach(a => {
      if (a.workerId) {
        counts[a.workerId] = (counts[a.workerId] || 0) + 1;
      }
    });
    return counts;
  }, [assignments]);

  const equipmentUsageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(assignments).forEach(a => {
      a.equipmentIds.forEach(id => {
        counts[id] = (counts[id] || 0) + 1;
      });
    });
    return counts;
  }, [assignments]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const teamMembers = optimizedData?.teamMembers || [];
  const equipment = optimizedData?.availableEquipment || [];

  return (
    <Card className={cn("border-2 border-primary/20", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            AI Day Planner
          </CardTitle>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-select-date">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {format(selectedDate, 'dd MMM yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!optimizedData && (
          <div className="text-center py-8 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
              <Route className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Plan Your Full Day</h3>
              <p className="text-sm text-muted-foreground mt-1">
                AI builds an optimised schedule assigning workers, equipment &amp; routes for every job
              </p>
            </div>
            <Button 
              onClick={handleOptimize}
              disabled={isOptimizing}
              className="bg-gradient-to-r from-purple-500 to-blue-500"
              data-testid="button-optimize-schedule"
            >
              {isOptimizing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Building Day Plan...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Build Day Plan
                </>
              )}
            </Button>
          </div>
        )}

        {optimizedData && (
          <div className="space-y-4">
            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center p-2.5 rounded-lg bg-muted/50">
                <div className="text-lg font-bold text-foreground">{optimizedData.optimizedOrder.length}</div>
                <div className="text-[10px] text-muted-foreground">Jobs</div>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-muted/50">
                <div className="text-lg font-bold text-foreground">{teamMembers.length}</div>
                <div className="text-[10px] text-muted-foreground">Workers</div>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-muted/50">
                <div className="text-lg font-bold text-foreground">{equipment.length}</div>
                <div className="text-[10px] text-muted-foreground">Equipment</div>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-muted/50">
                <div className="text-lg font-bold text-foreground">{formatDriveTime(optimizedData.totalDriveTime)}</div>
                <div className="text-[10px] text-muted-foreground">{optimizedData.totalDistance}km drive</div>
              </div>
            </div>

            {optimizedData.routeSource === 'haversine' && (
              <div className="text-[11px] text-muted-foreground -mt-2">
                Drive times are straight-line estimates (live routing unavailable).
              </div>
            )}

            {/* AI Recommendations */}
            {optimizedData.aiRecommendations && (
              <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-200/50 dark:border-purple-800/50">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-foreground whitespace-pre-wrap">
                    {optimizedData.aiRecommendations}
                  </div>
                </div>
              </div>
            )}

            {/* Suggestions */}
            {optimizedData.aiSuggestions.length > 0 && (
              <div className="space-y-1.5">
                {optimizedData.aiSuggestions.map((suggestion, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm p-2 rounded bg-muted/30">
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{suggestion}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Team Summary Bar */}
            {teamMembers.length > 0 && (
              <div className="rounded-lg border p-3">
                <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Team Allocation
                </h4>
                <div className="flex flex-wrap gap-2">
                  {teamMembers.map(member => {
                    const count = workerJobCounts[member.memberId] || 0;
                    return (
                      <div key={member.id} className="flex items-center gap-1.5 text-xs">
                        <UserAvatar
                          className="h-5 w-5"
                          fallbackClassName="text-[8px]"
                          user={{ id: member.memberId, name: member.name }}
                        />
                        <span className="text-foreground">{member.name.split(' ')[0]}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {count} job{count !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Equipment Summary */}
            {equipment.length > 0 && (
              <div className="rounded-lg border p-3">
                <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Wrench className="h-3.5 w-3.5" />
                  Equipment Allocation
                </h4>
                <div className="flex flex-wrap gap-2">
                  {equipment.map(eq => {
                    const count = equipmentUsageCounts[eq.id] || 0;
                    return (
                      <div key={eq.id} className="flex items-center gap-1.5 text-xs">
                        <HardHat className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-foreground truncate max-w-[100px]">{eq.name}</span>
                        {count > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {count}x
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Full Day Plan */}
            {optimizedData.optimizedOrder.length > 0 ? (
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
                  <Navigation className="h-4 w-4" />
                  Day Plan
                </h4>
                <div className="space-y-3">
                  {optimizedData.optimizedOrder.map((item, index) => {
                    const jobAssignment = assignments[item.job.id];
                    const assignedWorker = teamMembers.find(m => m.memberId === jobAssignment?.workerId);
                    const assignedEquipmentIds = jobAssignment?.equipmentIds || [];

                    return (
                      <div 
                        key={item.job.id}
                        className="rounded-lg border bg-card overflow-visible"
                        data-testid={`schedule-item-${item.job.id}`}
                      >
                        {/* Job Header */}
                        <div className="flex items-center gap-3 p-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-foreground truncate">{item.job.title}</span>
                              {item.job.priority && (
                                <Badge variant="outline" className={cn("text-[10px]", getPriorityColor(item.job.priority))}>
                                  {item.job.priority}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {item.suggestedTime}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {item.job.clientName}
                              </span>
                              {item.travelDistance !== undefined && item.travelDistance > 0 && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {item.travelDistance.toFixed(1)}km
                                </span>
                              )}
                              {item.travelTime !== undefined && item.travelTime > 0 && (
                                <span className="flex items-center gap-1">
                                  <Navigation className="h-3 w-3" />
                                  {item.travelTime} min drive
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Assignment Controls */}
                        <div className="border-t px-3 py-2.5 space-y-2 bg-muted/20">
                          {/* Worker Assignment */}
                          {teamMembers.length > 0 && (
                            <div className="flex items-center gap-2">
                              <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <Select
                                value={jobAssignment?.workerId || 'unassigned'}
                                onValueChange={(val) => updateWorkerAssignment(item.job.id, val === 'unassigned' ? null : val)}
                              >
                                <SelectTrigger className="h-8 text-xs flex-1">
                                  <SelectValue placeholder="Assign worker" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unassigned">Unassigned</SelectItem>
                                  {teamMembers.map(member => (
                                    <SelectItem key={member.memberId} value={member.memberId}>
                                      <span className="flex items-center gap-1.5">
                                        {member.name}
                                        <span className="text-muted-foreground">({member.role})</span>
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* Equipment Assignment */}
                          {equipment.length > 0 && (
                            <div className="flex items-start gap-2">
                              <Wrench className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-1" />
                              <div className="flex flex-wrap gap-1.5 flex-1">
                                {equipment.map(eq => {
                                  const isAssigned = assignedEquipmentIds.includes(eq.id);
                                  return (
                                    <Badge
                                      key={eq.id}
                                      variant={isAssigned ? "default" : "outline"}
                                      className={cn(
                                        "text-[10px] cursor-pointer transition-colors",
                                        isAssigned ? "bg-primary/90" : "hover-elevate"
                                      )}
                                      onClick={() => toggleEquipment(item.job.id, eq.id)}
                                    >
                                      {eq.name}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Assignment Summary */}
                          {(assignedWorker || assignedEquipmentIds.length > 0) && (
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1 border-t border-dashed">
                              <ArrowRight className="h-3 w-3" />
                              {assignedWorker && <span>{assignedWorker.name}</span>}
                              {assignedWorker && assignedEquipmentIds.length > 0 && <span>+</span>}
                              {assignedEquipmentIds.length > 0 && (
                                <span>{assignedEquipmentIds.length} equipment</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No jobs scheduled for this date
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  optimizeMutation.reset();
                  setAssignments({});
                }}
                className="flex-1"
                data-testid="button-reset-schedule"
              >
                Start Over
              </Button>
              {optimizedData.optimizedOrder.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewRouteOnMap}
                  className="flex-1"
                  data-testid="button-view-route-map"
                >
                  <Route className="h-4 w-4 mr-2" />
                  View Route
                </Button>
              )}
              {optimizedData.optimizedOrder.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleApplyFullPlan}
                  disabled={isSaving}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500"
                  data-testid="button-apply-schedule"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Apply Day Plan
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AIScheduleOptimizer;
