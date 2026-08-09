import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Clock, MapPin, User, Play, Square, Plus, X, ListChecks, PartyPopper, ArrowRight, Receipt, Mail } from "lucide-react";
import PhotoGallery from "./PhotoGallery";
import SmartActionsPanel, { getJobSmartActions, SmartAction } from "./SmartActionsPanel";
import { useUpdateJob } from "@/hooks/use-jobs";
import { useToast } from "@/hooks/use-toast";
import { useTimeTracking } from "@/hooks/use-time-tracking";
import { useChecklist } from "@/hooks/use-checklist";

interface Photo {
  url: string;
  description?: string;
  uploadedAt: string;
}

interface Job {
  id: string;
  title: string;
  description?: string;
  clientName?: string;
  address?: string;
  scheduledAt?: string;
  assignedTo?: string;
  status: 'pending' | 'in_progress' | 'done';
  photos?: Photo[];
  notes?: string;
}

const jobCompletionSchema = z.object({
  completionNotes: z.string().optional(),
});

type JobCompletionData = z.infer<typeof jobCompletionSchema>;

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface JobCompletionProps {
  job: Job;
  client?: Client;
  linkedQuote?: any;
  linkedInvoice?: any;
  onComplete?: (jobId: string) => void;
  onCancel?: () => void;
  onCreateInvoice?: (jobId: string) => void;
  onSendEmail?: (type: 'invoice' | 'confirmation', jobId: string) => void;
}

export default function JobCompletion({ 
  job, 
  client,
  linkedQuote,
  linkedInvoice,
  onComplete, 
  onCancel,
  onCreateInvoice,
  onSendEmail 
}: JobCompletionProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const updateJobMutation = useUpdateJob();
  const [isJobCompleted, setIsJobCompleted] = useState(false);
  const [smartActions, setSmartActions] = useState<SmartAction[]>([]);
  const [isExecutingActions, setIsExecutingActions] = useState(false);
  const [showNoPhotoWarning, setShowNoPhotoWarning] = useState(false);
  const [pendingCompletion, setPendingCompletion] = useState<JobCompletionData | null>(null);

  // Use time tracking hook
  const {
    timeEntries,
    activeEntry,
    totalDuration,
    elapsedDisplay,
    startTimer,
    stopTimer,
    isStarting,
    isStopping,
  } = useTimeTracking(job.id);

  // Use checklist hook
  const {
    items: checklistItems,
    addItem,
    toggleItem,
    deleteItem,
    isAdding,
  } = useChecklist(job.id);

  const [newChecklistItem, setNewChecklistItem] = useState("");

  const form = useForm<JobCompletionData>({
    resolver: zodResolver(jobCompletionSchema),
    defaultValues: {
      completionNotes: job.notes || "",
    },
  });

  const handleAddChecklistItem = () => {
    if (newChecklistItem.trim()) {
      addItem(newChecklistItem.trim());
      setNewChecklistItem("");
    }
  };

  const completeJob = async (data: JobCompletionData) => {
    try {
      const updateData = {
        status: 'done' as const,
        notes: data.completionNotes || job.notes,
      };

      await updateJobMutation.mutateAsync({ 
        id: job.id, 
        data: updateData 
      });
      
      toast({
        title: "Job completed!",
        description: `${job.title} has been marked as completed`,
      });
      
      // Initialize smart actions for next steps
      const completedJob = { ...job, status: 'done' as const };
      const actions = getJobSmartActions(completedJob, client, linkedQuote, linkedInvoice);
      setSmartActions(actions);
      setIsJobCompleted(true);
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete job",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (data: JobCompletionData) => {
    // Warn (but don't block) when completing a job with no photos — photos
    // help protect the tradie in disputes.
    if (!job.photos || job.photos.length === 0) {
      setPendingCompletion(data);
      setShowNoPhotoWarning(true);
      return;
    }
    await completeJob(data);
  };

  const handleActionToggle = (actionId: string, enabled: boolean) => {
    setSmartActions(prev => prev.map(a => 
      a.id === actionId ? { ...a, enabled } : a
    ));
  };

  const handleActionPreview = (actionId: string) => {
    const action = smartActions.find(a => a.id === actionId);
    if (action) {
      toast({
        title: `Preview: ${action.title}`,
        description: action.preview?.message || action.description,
      });
    }
  };

  const handleActionEdit = (actionId: string) => {
    const action = smartActions.find(a => a.id === actionId);
    if (action?.type === 'send_email') {
      toast({
        title: "Email Editor",
        description: "Opening email composer...",
      });
    }
  };

  const handleExecuteActions = async () => {
    setIsExecutingActions(true);
    const enabledActions = smartActions.filter(a => a.enabled && !a.missingRequirements?.length);
    
    for (const action of enabledActions) {
      setSmartActions(prev => prev.map(a => 
        a.id === action.id ? { ...a, status: 'running' } : a
      ));

      try {
        if (action.type === 'create_invoice') {
          if (onCreateInvoice) {
            await onCreateInvoice(job.id);
          } else {
            navigate(`/invoices/new?jobId=${job.id}`);
          }
          setSmartActions(prev => prev.map(a => 
            a.id === action.id ? { ...a, status: 'completed' } : a
          ));
        } else if (action.type === 'send_email') {
          setSmartActions(prev => prev.map(a => 
            a.id === action.id ? { ...a, status: 'completed' } : a
          ));
          toast({
            title: "Email ready",
            description: "Navigate to the invoice to send the email",
          });
        }
      } catch (error) {
        setSmartActions(prev => prev.map(a => 
          a.id === action.id ? { ...a, status: 'suggested' } : a
        ));
        toast({
          title: "Action failed",
          description: `Failed to ${action.title.toLowerCase()}`,
          variant: "destructive",
        });
      }
    }

    setIsExecutingActions(false);
    
    if (onComplete) {
      onComplete(job.id);
    }
  };

  const handleSkipAll = () => {
    setSmartActions(prev => prev.map(a => ({ ...a, enabled: false, status: 'skipped' })));
    toast({
      title: "Actions skipped",
      description: "You can always create invoices and send emails later from the job details",
    });
    if (onComplete) {
      onComplete(job.id);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not scheduled';
    return new Date(dateString).toLocaleString('en-AU', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const totalTrackedTime = Array.isArray(timeEntries) ? timeEntries.reduce((total: number, entry: any) => {
    if (entry.endTime) {
      const start = new Date(entry.startTime);
      const end = new Date(entry.endTime);
      return total + (end.getTime() - start.getTime());
    }
    return total;
  }, 0) : 0;

  const formatTotalTime = (totalMs: number) => {
    const hours = Math.floor(totalMs / (1000 * 60 * 60));
    const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // Show Smart Actions panel after job is completed
  if (isJobCompleted) {
    return (
      <div className="w-full px-6 lg:px-8 py-6 space-y-6" data-testid="page-job-completed">
        {/* Success Header */}
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                <PartyPopper className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-green-800 dark:text-green-200">Job Completed!</h2>
                <p className="text-green-600 dark:text-green-400">{job.title} has been marked as done</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Smart Actions - Next Steps */}
        <SmartActionsPanel
          title="Next Steps"
          subtitle="Choose what to do next - nothing runs until you approve"
          actions={smartActions}
          onActionToggle={handleActionToggle}
          onActionPreview={handleActionPreview}
          onActionEdit={handleActionEdit}
          onExecuteAll={handleExecuteActions}
          onSkipAll={handleSkipAll}
          isExecuting={isExecutingActions}
          entityType="job"
          entityStatus="done"
        />

        {/* Quick Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(`/jobs/${job.id}`)}
            className="flex-1"
            data-testid="button-view-job"
          >
            View Job Details
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/jobs')}
            className="flex-1"
            data-testid="button-all-jobs"
          >
            Back to All Jobs
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-6 lg:px-8 py-6 space-y-6" data-testid="page-job-completion">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
            Complete Job
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Job Summary */}
          <div className="space-y-4 mb-6">
            <div>
              <h3 className="text-lg font-semibold">{job.title}</h3>
              {job.description && (
                <p className="text-muted-foreground mt-1">{job.description}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {job.clientName && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>Client: {job.clientName}</span>
                </div>
              )}
              
              {job.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{job.address}</span>
                </div>
              )}
              
              {job.scheduledAt && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDate(job.scheduledAt)}</span>
                </div>
              )}
              
              {job.assignedTo && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>Assigned to: {job.assignedTo}</span>
                </div>
              )}
            </div>
          </div>

          <Separator className="my-6" />

          {/* Time Tracking Controls */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Time Tracking
            </h4>
            
            {activeEntry ? (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Timer running</p>
                        <p className="text-2xl font-bold text-primary">{elapsedDisplay}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Started {new Date(activeEntry.startTime).toLocaleTimeString('en-AU', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                      <Button
                        onClick={stopTimer}
                        disabled={isStopping}
                        variant="destructive"
                        size="lg"
                        data-testid="button-stop-timer"
                        className="h-16 w-16"
                      >
                        {isStopping ? (
                          <Clock className="h-6 w-6 animate-spin" />
                        ) : (
                          <Square className="h-6 w-6" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Button
                onClick={startTimer}
                disabled={isStarting}
                variant="default"
                size="lg"
                data-testid="button-start-timer"
                className="w-full"
              >
                {isStarting ? (
                  <>
                    <Clock className="h-5 w-5 mr-2 animate-spin" />
                    Starting Timer...
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 mr-2" />
                    Start Timer
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Time Tracking Summary */}
          {Array.isArray(timeEntries) && timeEntries.length > 0 && (
            <>
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Time Tracking Summary
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="font-medium">Total Time Tracked:</span>
                    <span className="text-lg font-semibold text-primary">
                      {formatTotalTime(totalTrackedTime)}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    {timeEntries.map((entry: any, index: number) => (
                      <div key={entry.id || index} className="flex justify-between items-center py-1">
                        <span className="text-muted-foreground">
                          {entry.description || 'Work session'}
                        </span>
                        <span>{formatDuration(entry.startTime, entry.endTime)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <Separator className="my-6" />
            </>
          )}

          {/* Job Checklist */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
              Job Checklist
            </h4>
            
            {/* Add new item */}
            <div className="flex gap-2">
              <Input
                placeholder="Add checklist item (e.g., Turn off main water)"
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddChecklistItem();
                  }
                }}
                disabled={isAdding}
                data-testid="input-new-checklist-item"
              />
              <Button
                type="button"
                onClick={handleAddChecklistItem}
                disabled={!newChecklistItem.trim() || isAdding}
                size="icon"
                variant="default"
                data-testid="button-add-checklist-item"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Checklist items */}
            {checklistItems.length > 0 ? (
              <div className="space-y-2">
                {checklistItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover-elevate"
                    data-testid={`checklist-item-${item.id}`}
                  >
                    <Checkbox
                      checked={item.isCompleted}
                      onCheckedChange={(checked) =>
                        toggleItem(item.id, checked as boolean)
                      }
                      data-testid={`checkbox-${item.id}`}
                    />
                    <span
                      className={`flex-1 ${
                        item.isCompleted
                          ? "line-through text-muted-foreground"
                          : ""
                      }`}
                    >
                      {item.text}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteItem(item.id)}
                      className="h-8 w-8"
                      data-testid={`button-delete-${item.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="text-sm text-muted-foreground pt-2">
                  {checklistItems.filter((item) => item.isCompleted).length} of{" "}
                  {checklistItems.length} completed
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No checklist items yet. Add items to keep track of tasks for this job.
              </p>
            )}
          </div>

          <Separator className="my-6" />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {/* Photo Upload */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Job Photos</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add photos to document the completed work. These will be attached to the job record.
                  </p>
                </div>
                
                <PhotoGallery
                  entityType="job"
                  entityId={job.id}
                  photos={job.photos || []}
                  maxPhotos={10}
                  disabled={updateJobMutation.isPending}
                  queryKey={['/api/jobs']}
                />
              </div>

              <Separator />

              {/* Completion Notes */}
              <FormField
                control={form.control}
                name="completionNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Completion Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Add any notes about the completed work, materials used, or recommendations..."
                        rows={4}
                        {...field} 
                        data-testid="input-completion-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Summary */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <h4 className="font-semibold mb-2">Completion Summary</h4>
                  <div className="text-sm space-y-1">
                    <p>• Job will be marked as <strong>completed</strong></p>
                    <p>• {job.photos?.length || 0} photo(s) attached</p>
                    {form.watch("completionNotes") && (
                      <p>• Completion notes will be saved</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-4">
                <Button 
                  type="submit" 
                  disabled={updateJobMutation.isPending}
                  data-testid="button-complete-job"
                  className="flex-1"
                >
                  {updateJobMutation.isPending ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2 animate-spin" />
                      Completing Job...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Complete Job
                    </>
                  )}
                </Button>
                
                {onCancel && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onCancel} 
                    data-testid="button-cancel-completion"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <AlertDialog open={showNoPhotoWarning} onOpenChange={setShowNoPhotoWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No photos attached</AlertDialogTitle>
            <AlertDialogDescription>
              Photos help protect you if there's ever a dispute about this job. Are you sure you want to complete it without any?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-add-photos-instead">Go back and add photos</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-complete-without-photos"
              onClick={async () => {
                const data = pendingCompletion;
                setShowNoPhotoWarning(false);
                setPendingCompletion(null);
                if (data) await completeJob(data);
              }}
            >
              Complete anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}