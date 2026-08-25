import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getAuthHeaders} from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Plus,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  PenLine,
  AlertCircle,
  Download,
  Trash2,
  Loader2,
  Edit,
} from "lucide-react";
import { format } from "date-fns";
import { FormRenderer } from "./CustomFormRenderer";
import { SwmsBuilder } from "./SwmsBuilder";
import type { CustomForm, FormSubmission } from "@shared/schema";
import { SAFETY_FORM_TYPES } from "@shared/safety-forms";

interface SwmsListItem {
  id: string;
  title: string;
  status: string;
  hazardCount: number;
  signatureCount: number;
  createdAt?: string;
  siteAddress?: string;
}

interface SafetyFormsSectionProps {
  jobId: string;
  jobStatus: string;
  jobTitle?: string;
  jobAddress?: string;
  onSafetyCheckRequired?: () => void;
  className?: string;
}

export function SafetyFormsSection({ jobId, jobStatus, jobTitle, jobAddress, onSafetyCheckRequired, className }: SafetyFormsSectionProps) {
  const { toast } = useToast();
  const [showFormPicker, setShowFormPicker] = useState(false);
  const [selectedForm, setSelectedForm] = useState<CustomForm | null>(null);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [viewingSubmission, setViewingSubmission] = useState<FormSubmission | null>(null);
  const [showSwmsBuilder, setShowSwmsBuilder] = useState(false);
  const [editingSwmsId, setEditingSwmsId] = useState<string | undefined>(undefined);

  const { data: submissions, isLoading: loadingSubmissions } = useQuery<FormSubmission[]>({
    queryKey: ['/api/jobs', jobId, 'form-submissions'],
    enabled: !!jobId,
    staleTime: 30000,
  });

  // Get user's trade type for filtering
  const { data: user } = useQuery<{ tradeType?: string }>({
    queryKey: ['/api/auth/me'],
    staleTime: 30000,
  });
  const tradeType = user?.tradeType;

  const { data: forms, isLoading: loadingForms } = useQuery<CustomForm[]>({
    queryKey: ['/api/custom-forms', tradeType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tradeType) params.append('tradeType', tradeType);
      const url = `/api/custom-forms${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch forms');
      return response.json();
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const { data: swmsList, isLoading: loadingSwms } = useQuery<SwmsListItem[]>({
    queryKey: ['/api/jobs', jobId, 'swms'],
    enabled: !!jobId,
    staleTime: 30000,
  });

  const deleteSwmsMutation = useMutation({
    mutationFn: async (swmsId: string) => {
      await apiRequest('DELETE', `/api/swms/${swmsId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'swms'] });
      toast({ title: 'SWMS deleted', description: 'The SWMS document has been removed' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete SWMS', variant: 'destructive' });
    },
  });

  const handleDownloadPdf = async (swmsId: string) => {
    try {
      const response = await fetch(`/api/swms/${swmsId}/pdf`, { credentials: 'include', headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to download');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `swms-${swmsId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Error', description: 'Failed to download PDF', variant: 'destructive' });
    }
  };

  const getSwmsStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500"><ShieldCheck className="h-3 w-3 mr-1" />Active</Badge>;
      case 'draft':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Draft</Badge>;
      case 'archived':
        return <Badge variant="outline"><FileText className="h-3 w-3 mr-1" />Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isLoading = loadingSubmissions || loadingForms;

  const safetyForms = forms?.filter(f => 
    f.isActive && (f.formType === 'safety' || f.formType === 'compliance' || f.formType === 'inspection')
  ) || [];

  const safetySubmissions = submissions?.filter(s => {
    const form = forms?.find(f => f.id === s.formId);
    return form && (form.formType === 'safety' || form.formType === 'compliance' || form.formType === 'inspection');
  }) || [];

  const getFormById = (formId: string) => forms?.find(f => f.id === formId);

  const hasPendingSignatures = safetySubmissions.some(s => {
    const data = s.submissionData as Record<string, any>;
    const form = getFormById(s.formId);
    return form?.requiresSignature && !data?._signature;
  });

  const hasCompletedSafetyForm = safetySubmissions.some(s => {
    const data = s.submissionData as Record<string, any>;
    const form = getFormById(s.formId);
    return !form?.requiresSignature || data?._signature;
  });

  const getStatusBadge = (submission: FormSubmission) => {
    const form = getFormById(submission.formId);
    const data = submission.submissionData as Record<string, any>;
    const hasSig = data?._signature;

    if (submission.status === 'approved') {
      return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
    }
    if (submission.status === 'rejected') {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
    }
    if (form?.requiresSignature && !hasSig) {
      return <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400"><PenLine className="h-3 w-3 mr-1" />Pending Signature</Badge>;
    }
    if (submission.status === 'submitted') {
      return <Badge variant="secondary"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
    }
    return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{submission.status}</Badge>;
  };

  const handleSelectForm = (form: CustomForm) => {
    setSelectedForm(form);
    setShowFormPicker(false);
    setShowFormDialog(true);
  };

  const handleViewSubmission = (submission: FormSubmission) => {
    const form = getFormById(submission.formId);
    if (form) {
      setSelectedForm(form);
      setViewingSubmission(submission);
      setShowFormDialog(true);
    }
  };

  const getSafetyStatus = () => {
    if (safetyForms.length === 0) {
      return { status: 'none', icon: Shield, color: 'text-muted-foreground' };
    }
    if (safetySubmissions.length === 0) {
      return { status: 'required', icon: ShieldAlert, color: 'text-amber-500' };
    }
    if (hasPendingSignatures) {
      return { status: 'pending', icon: ShieldAlert, color: 'text-amber-500' };
    }
    return { status: 'complete', icon: ShieldCheck, color: 'text-green-500' };
  };

  const safetyStatus = getSafetyStatus();

  if (isLoading) {
    return (
      <Card data-testid="card-safety-forms-loading" className={className}>
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalSafetyDocs = safetySubmissions.length + (swmsList?.length || 0);
  const hasAnySafetyContent = totalSafetyDocs > 0;

  return (
    <>
      <Card data-testid="card-safety-forms" className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <safetyStatus.icon className={`h-4 w-4 ${safetyStatus.color}`} />
            Safety & Compliance
          </CardTitle>
          <div className="flex items-center gap-2">
            {totalSafetyDocs > 0 && (
              <Badge variant="secondary" className="text-xs">
                {totalSafetyDocs}
              </Badge>
            )}
            {safetyStatus.status === 'required' && !hasAnySafetyContent && (
              <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                Required
              </Badge>
            )}
            {safetyStatus.status === 'complete' && (
              <Badge className="bg-green-500 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Complete
              </Badge>
            )}
            {jobStatus !== 'invoiced' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingSwmsId(undefined);
                  setShowSwmsBuilder(true);
                }}
                data-testid="button-add-safety-doc"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasAnySafetyContent && safetyForms.length > 0 && (
            <div className={`p-4 rounded-lg border-2 ${jobStatus === 'invoiced' ? 'border-muted bg-muted/30' : 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/80'}`}>
              <div className="flex items-start gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${jobStatus === 'invoiced' ? 'bg-muted' : 'bg-amber-100 dark:bg-amber-900'}`}>
                  <AlertTriangle className={`h-5 w-5 ${jobStatus === 'invoiced' ? 'text-muted-foreground' : 'text-amber-600 dark:text-amber-400'}`} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${jobStatus === 'invoiced' ? 'text-muted-foreground' : 'text-amber-800 dark:text-amber-200'}`}>
                    {jobStatus === 'invoiced' ? 'No safety forms were completed' : 'Safety documentation required'}
                  </p>
                  <p className={`text-xs mt-1 ${jobStatus === 'invoiced' ? 'text-muted-foreground/70' : 'text-amber-600 dark:text-amber-400'}`}>
                    {jobStatus === 'invoiced' ? 'Safety forms were not completed for this job' : 'Complete a SWMS or safety checklist before starting high-risk work'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {swmsList && swmsList.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SWMS Documents</p>
              {swmsList.map((swms) => (
                <div
                  key={swms.id}
                  className="p-3 rounded-md border"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{swms.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {getSwmsStatusBadge(swms.status)}
                        <span className="text-xs text-muted-foreground">
                          {swms.hazardCount} hazard{swms.hazardCount !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {swms.signatureCount} signature{swms.signatureCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingSwmsId(swms.id);
                          setShowSwmsBuilder(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDownloadPdf(swms.id)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteSwmsMutation.mutate(swms.id)}
                        disabled={deleteSwmsMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {safetySubmissions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Safety Checklists</p>
              {safetySubmissions.map(submission => {
                const form = getFormById(submission.formId);
                return (
                  <button
                    key={submission.id}
                    onClick={() => handleViewSubmission(submission)}
                    className="w-full p-3 rounded-lg border hover-elevate transition-all text-left"
                    data-testid={`safety-submission-${submission.id}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                          <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{form?.name || 'Safety Form'}</p>
                          <p className="text-xs text-muted-foreground">
                            {submission.submittedAt && format(new Date(submission.submittedAt), 'dd MMM yyyy, h:mm a')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(submission)}
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {jobStatus !== 'invoiced' && (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setEditingSwmsId(undefined);
                  setShowSwmsBuilder(true);
                }}
                className="flex-1 min-w-[150px]"
                variant={!hasAnySafetyContent ? "default" : "outline"}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create SWMS
              </Button>
              {safetyForms.length > 0 && (
                <Button
                  onClick={() => setShowFormPicker(true)}
                  className="flex-1 min-w-[150px]"
                  variant="outline"
                  data-testid="button-add-safety-form"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Safety Checklist
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showSwmsBuilder} onOpenChange={(open) => {
        setShowSwmsBuilder(open);
        if (!open) setEditingSwmsId(undefined);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              {editingSwmsId ? 'Edit SWMS' : 'Create SWMS'}
            </DialogTitle>
            <DialogDescription>
              {editingSwmsId ? 'Update the Safe Work Method Statement' : 'Create a new Safe Work Method Statement for this job'}
            </DialogDescription>
          </DialogHeader>
          <SwmsBuilder
            jobId={jobId}
            jobTitle={jobTitle}
            jobAddress={jobAddress}
            swmsId={editingSwmsId}
            onClose={() => {
              setShowSwmsBuilder(false);
              setEditingSwmsId(undefined);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showFormPicker} onOpenChange={setShowFormPicker}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Select Safety Form
            </DialogTitle>
            <DialogDescription>Choose a safety form to complete for this job</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4 max-h-[400px] overflow-y-auto">
            {safetyForms.map(form => (
              <button
                key={form.id}
                onClick={() => handleSelectForm(form)}
                className="w-full p-4 rounded-lg border hover:border-primary/50 hover:bg-accent/50 transition-all text-left"
                data-testid={`safety-form-picker-${form.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{form.name}</p>
                    {form.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">{form.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {form.requiresSignature && (
                        <Badge variant="outline" className="text-xs">
                          <PenLine className="h-3 w-3 mr-1" />
                          Signature Required
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {safetyForms.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No safety forms available</p>
                <p className="text-xs">Create SWMS/JSA templates in Settings</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showFormDialog} onOpenChange={(open) => {
        setShowFormDialog(open);
        if (!open) {
          setViewingSubmission(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedForm && (
            <FormRenderer
              form={selectedForm}
              jobId={jobId}
              onSubmit={() => {
                setShowFormDialog(false);
                setViewingSubmission(null);
              }}
              onCancel={() => {
                setShowFormDialog(false);
                setViewingSubmission(null);
              }}
              existingSubmission={viewingSubmission || undefined}
              readOnly={!!viewingSubmission}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface SafetyCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
  onAddSafetyForm: () => void;
  hasSafetyForms: boolean;
}

export function SafetyCheckDialog({ 
  open, 
  onOpenChange, 
  onContinue, 
  onAddSafetyForm,
  hasSafetyForms 
}: SafetyCheckDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-safety-check">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Safety Check Required
          </DialogTitle>
          <DialogDescription className="pt-2">
            {hasSafetyForms 
              ? "This job has no completed safety forms. For high-risk construction work, Australian WHS regulations require a Safe Work Method Statement (SWMS) before starting work."
              : "Consider completing a safety form before starting work on this job."
            }
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-300">WHS Compliance Reminder</p>
                <p className="text-amber-600 dark:text-amber-400 mt-1">
                  SWMS documents are legally required for high-risk construction work including:
                </p>
                <ul className="text-xs text-amber-600 dark:text-amber-400 mt-2 space-y-1 list-disc list-inside">
                  <li>Work at heights over 2 meters</li>
                  <li>Work near electrical installations</li>
                  <li>Work in confined spaces</li>
                  <li>Work involving hazardous substances</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={onAddSafetyForm} data-testid="button-add-safety-form-dialog">
            <ShieldCheck className="h-4 w-4 mr-2" />
            Complete Safety Form First
          </Button>
          <Button variant="outline" onClick={onContinue} data-testid="button-continue-without-safety">
            Continue Without Safety Form
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
