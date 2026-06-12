import { useState, useEffect, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, getSessionToken } from "@/lib/queryClient";
import { ArrowLeft, Loader2, Save, MapPin, Calendar, Clock, AlertTriangle } from "lucide-react";
import AddressAutocomplete from "@/components/ui/address-autocomplete";
import type { Job, Client } from "@shared/schema";
import { PresenceIndicator, FieldUpdateIndicator, ConflictResolutionDialog } from "./JobCollaborationUI";
import { useJobCollaboration } from "@/hooks/use-job-collaboration";
import { useAuth } from "@/hooks/useAuth";

const jobEditSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  scheduledAt: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  estimatedHours: z.string().optional(),
  geofenceEnabled: z.boolean().default(false),
  geofenceRadius: z.coerce.number().min(50).max(500).default(100),
});

type JobEditData = z.infer<typeof jobEditSchema>;

interface JobEditFormProps {
  jobId: string;
  onSave?: (jobId: string) => void;
  onCancel?: () => void;
}

export default function JobEditForm({ jobId, onSave, onCancel }: JobEditFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [addressConfirmed, setAddressConfirmed] = useState(true);
  const jobVersionRef = useRef<number>(1);
  const initialLoadDone = useRef(false);

  const { data: job, isLoading: jobLoading, error: jobError } = useQuery<Job>({
    queryKey: ['/api/jobs', jobId],
  });

  const { data: client } = useQuery<Client>({
    queryKey: ['/api/clients', job?.clientId],
    enabled: !!job?.clientId,
  });

  const collaboration = useJobCollaboration(jobId, user?.id, user?.name || user?.email || 'Unknown');

  const form = useForm<JobEditData>({
    resolver: zodResolver(jobEditSchema),
    defaultValues: {
      title: "",
      description: "",
      address: "",
      scheduledAt: "",
      priority: "medium",
      estimatedHours: "",
      geofenceEnabled: false,
      geofenceRadius: 100,
    },
  });

  useEffect(() => {
    if (job && !initialLoadDone.current) {
      initialLoadDone.current = true;
      form.reset({
        title: job.title || "",
        description: job.description || "",
        address: job.address || "",
        scheduledAt: job.scheduledAt ? new Date(job.scheduledAt).toISOString().slice(0, 16) : "",
        priority: ((job as Record<string, unknown>).priority as "low" | "medium" | "high") || "medium",
        estimatedHours: (job as Record<string, unknown>).estimatedHours?.toString() || "",
        geofenceEnabled: job.geofenceEnabled || false,
        geofenceRadius: job.geofenceRadius || 100,
      });
      jobVersionRef.current = (job as Record<string, unknown>).version as number || 1;
      setIsLoading(false);
    } else if (job && initialLoadDone.current) {
      jobVersionRef.current = (job as Record<string, unknown>).version as number || jobVersionRef.current;
      const dirtyFields = collaboration.dirtyFieldsRef.current;
      if (dirtyFields.size === 0) {
        form.reset({
          title: job.title || "",
          description: job.description || "",
          address: job.address || "",
          scheduledAt: job.scheduledAt ? new Date(job.scheduledAt).toISOString().slice(0, 16) : "",
          priority: ((job as Record<string, unknown>).priority as "low" | "medium" | "high") || "medium",
          estimatedHours: (job as Record<string, unknown>).estimatedHours?.toString() || "",
          geofenceEnabled: job.geofenceEnabled || false,
          geofenceRadius: job.geofenceRadius || 100,
        });
      } else {
        const serverValues: Record<string, string | boolean | number> = {
          title: job.title || "",
          description: job.description || "",
          address: job.address || "",
          scheduledAt: job.scheduledAt ? new Date(job.scheduledAt).toISOString().slice(0, 16) : "",
          priority: ((job as Record<string, unknown>).priority as "low" | "medium" | "high") || "medium",
          estimatedHours: (job as Record<string, unknown>).estimatedHours?.toString() || "",
          geofenceEnabled: job.geofenceEnabled || false,
          geofenceRadius: job.geofenceRadius || 100,
        };
        const fieldsToUpdate = Object.keys(serverValues).filter(f => !dirtyFields.has(f));
        fieldsToUpdate.forEach(field => {
          form.setValue(field as keyof JobEditData, serverValues[field] as never);
        });
      }
    }
  }, [job, form, collaboration.dirtyFieldsRef]);

  const updateJobMutation = useMutation({
    mutationFn: async (data: JobEditData & { version?: number }) => {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      const token = getSessionToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const body = {
        ...data,
        version: data.version ?? jobVersionRef.current,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt).toISOString() : null,
        estimatedHours: data.estimatedHours ? parseFloat(data.estimatedHours) : null,
      };
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
        credentials: 'include',
      });
      if (response.status === 409) {
        const errorData = await response.json();
        if (errorData.code === 'VERSION_CONFLICT') {
          const localChanges = form.getValues();
          collaboration.handleConflictResponse(
            localChanges as Record<string, unknown>,
            errorData.serverData,
            errorData.serverVersion,
          );
          throw new Error('VERSION_CONFLICT');
        }
        throw new Error(errorData.error || 'Version conflict');
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to update job');
      }
      return response.json();
    },
    onSuccess: (updatedJob) => {
      jobVersionRef.current = updatedJob.version || jobVersionRef.current + 1;
      collaboration.clearDirtyFields();
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      toast({
        title: "Job updated",
        description: "Your changes have been saved",
      });
      onSave?.(jobId);
    },
    onError: (error: Error) => {
      if (error.message === 'VERSION_CONFLICT') return;
      toast({
        title: "Failed to update job",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleConflictResolve = useCallback(async (resolvedData: Record<string, unknown>, serverVersion: number) => {
    collaboration.resolveConflict();
    try {
      const normalizedData = { ...resolvedData };
      if (normalizedData.scheduledAt && typeof normalizedData.scheduledAt === 'string') {
        normalizedData.scheduledAt = new Date(normalizedData.scheduledAt as string).toISOString();
      }
      if (normalizedData.estimatedHours && typeof normalizedData.estimatedHours === 'string') {
        normalizedData.estimatedHours = parseFloat(normalizedData.estimatedHours as string) || null;
      }
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      const token = getSessionToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ ...normalizedData, version: serverVersion }),
        credentials: 'include',
      });
      if (response.ok) {
        const updatedJob = await response.json();
        jobVersionRef.current = updatedJob.version || serverVersion + 1;
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
        queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
        toast({ title: "Job updated", description: "Conflict resolved and changes saved" });
        onSave?.(jobId);
      } else {
        toast({ title: "Failed to save", description: "Please try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to save", description: "Please try again", variant: "destructive" });
    }
  }, [jobId, collaboration, toast, onSave]);

  const handleSubmit = (data: JobEditData) => {
    if (!addressConfirmed && data.address) {
      toast({ title: "Please select an address", description: "Tap an address from the suggestions to confirm it", variant: "destructive" });
      return;
    }
    updateJobMutation.mutate(data);
  };

  if (jobLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (jobError || !job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Job not found</p>
        <Button variant="outline" onClick={onCancel}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Edit Job</h1>
              {client && <p className="text-sm text-muted-foreground">{client.name}</p>}
              <PresenceIndicator editors={collaboration.otherEditors} />
            </div>
          </div>
          <Button
            onClick={form.handleSubmit(handleSubmit)}
            disabled={updateJobMutation.isPending}
            data-testid="button-save-job"
          >
            {updateJobMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 pb-24">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Job Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="relative">
                      {collaboration.isFieldRecentlyUpdated('title') && (
                        <FieldUpdateIndicator fieldName="title" updatedByName={collaboration.getFieldUpdateInfo('title')?.updatedByName || ''} />
                      )}
                      <FormLabel>Job Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Hot Water System Repair"
                          {...field}
                          onChange={(e) => { collaboration.markFieldDirty('title'); field.onChange(e); }}
                          data-testid="input-job-title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="relative">
                      {collaboration.isFieldRecentlyUpdated('description') && (
                        <FieldUpdateIndicator fieldName="description" updatedByName={collaboration.getFieldUpdateInfo('description')?.updatedByName || ''} />
                      )}
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the job..."
                          className="min-h-[100px]"
                          {...field}
                          onChange={(e) => { collaboration.markFieldDirty('description'); field.onChange(e); }}
                          data-testid="input-job-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem className="relative">
                      {collaboration.isFieldRecentlyUpdated('priority') && (
                        <FieldUpdateIndicator fieldName="priority" updatedByName={collaboration.getFieldUpdateInfo('priority')?.updatedByName || ''} />
                      )}
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={(val) => { collaboration.markFieldDirty('priority'); field.onChange(val); }} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-priority">
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="relative">
                      {collaboration.isFieldRecentlyUpdated('address') && (
                        <FieldUpdateIndicator fieldName="address" updatedByName={collaboration.getFieldUpdateInfo('address')?.updatedByName || ''} />
                      )}
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <AddressAutocomplete
                          value={field.value || ''}
                          onChange={(val: string) => { collaboration.markFieldDirty('address'); field.onChange(val); }}
                          onConfirmedChange={(confirmed) => setAddressConfirmed(confirmed)}
                          placeholder="Start typing an address..."
                          data-testid="input-job-address"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4 pt-2 border-t">
                  <FormField
                    control={form.control}
                    name="geofenceEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel>Enable Geofence</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Auto clock in/out when arriving at location
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={(val) => { collaboration.markFieldDirty('geofenceEnabled'); field.onChange(val); }}
                            data-testid="switch-geofence"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch("geofenceEnabled") && (
                    <FormField
                      control={form.control}
                      name="geofenceRadius"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Geofence Radius (meters)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={50}
                              max={500}
                              {...field}
                              onChange={(e) => { collaboration.markFieldDirty('geofenceRadius'); field.onChange(parseInt(e.target.value) || 100); }}
                              data-testid="input-geofence-radius"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                  Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="scheduledAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scheduled Date & Time</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          onChange={(e) => { collaboration.markFieldDirty('scheduledAt'); field.onChange(e); }}
                          data-testid="input-scheduled-at"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="estimatedHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Estimated Hours
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.5"
                          placeholder="e.g., 2.5"
                          {...field}
                          onChange={(e) => { collaboration.markFieldDirty('estimatedHours'); field.onChange(e); }}
                          data-testid="input-estimated-hours"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Notes are managed on the job detail view to prevent conflicts between editors.
                </p>
              </CardContent>
            </Card>
          </form>
        </Form>
      </div>

      {collaboration.conflict && (
        <ConflictResolutionDialog
          conflict={collaboration.conflict}
          onResolve={handleConflictResolve}
          onCancel={collaboration.resolveConflict}
        />
      )}
    </div>
  );
}
