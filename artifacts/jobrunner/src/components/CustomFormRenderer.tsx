import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest, getAuthHeaders} from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/use-user-role";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Send,
  Camera,
  X,
  Check,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  CalendarDays,
  Shield,
  ShieldCheck,
  ClipboardList,
  ClipboardCheck,
  ChevronRight,
  Pencil,
  FileDown,
  Loader2,
  Lock,
  ListTodo,
  Plus,
  Trash2,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Bold,
  Italic,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import type { CustomForm, FormSubmission, Job } from "@shared/schema";
import type { FormField } from "./CustomFormBuilder";

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onClear: () => void;
  initialValue?: string;
}

function SignaturePad({ onSave, onClear, initialValue }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!initialValue);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = 150;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (initialValue) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
        };
        img.src = initialValue;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [initialValue]);

  const getCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    setIsDrawing(true);
    setHasSignature(true);
    const coords = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    const coords = getCoords(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing && hasSignature && canvasRef.current) {
      onSave(canvasRef.current.toDataURL('image/png'));
    }
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onClear();
  };

  return (
    <div className="space-y-2">
      <div className="border rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="w-full touch-none cursor-crosshair"
          style={{ height: 150 }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <div className="flex justify-between">
        <p className="text-xs text-muted-foreground">Sign above using your finger or mouse</p>
        <Button type="button" variant="ghost" size="sm" onClick={clearSignature}>
          Clear
        </Button>
      </div>
    </div>
  );
}

interface FormRendererProps {
  form: CustomForm;
  jobId: string;
  onSubmit?: () => void;
  onCancel?: () => void;
  existingSubmission?: FormSubmission;
  readOnly?: boolean;
}

export function FormRenderer({ form, jobId, onSubmit, onCancel, existingSubmission, readOnly }: FormRendererProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    if (existingSubmission?.submissionData) {
      return existingSubmission.submissionData as Record<string, any>;
    }
    return {};
  });
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fields = (form.fields as FormField[]) || [];

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/form-submissions', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'form-submissions'] });
      toast({ title: "Form submitted", description: "Your response has been recorded." });
      onSubmit?.();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PATCH', `/api/form-submissions/${existingSubmission?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'form-submissions'] });
      toast({ title: "Form updated" });
      onSubmit?.();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateValue = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    for (const field of fields) {
      if (field.required && field.type !== 'section') {
        const value = formData[field.id];
        if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
          newErrors[field.id] = 'This field is required';
        }
      }
    }

    if (form.requiresSignature && !signatureData) {
      newErrors['_signature'] = 'Signature is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    const submissionData = {
      ...formData,
      _signature: signatureData,
    };

    if (existingSubmission) {
      updateMutation.mutate({ submissionData });
    } else {
      submitMutation.mutate({
        formId: form.id,
        jobId,
        submissionData,
        status: 'submitted',
      });
    }
  };

  const renderField = (field: FormField) => {
    const value = formData[field.id];
    const error = errors[field.id];

    if (field.type === 'section') {
      return (
        <div key={field.id} className="space-y-2 pt-4">
          <h3 className="font-medium text-lg">{field.label}</h3>
          {field.description && <p className="text-sm text-muted-foreground">{field.description}</p>}
          <Separator />
        </div>
      );
    }

    const renderInput = () => {
      switch (field.type) {
        case 'text':
        case 'email':
        case 'phone':
          return (
            <Input
              type={field.type === 'phone' ? 'tel' : field.type}
              placeholder={field.placeholder}
              value={value || ''}
              onChange={(e) => updateValue(field.id, e.target.value)}
              disabled={readOnly}
              data-testid={`input-${field.id}`}
            />
          );

        case 'number':
          return (
            <Input
              type="number"
              placeholder={field.placeholder}
              value={value || ''}
              onChange={(e) => updateValue(field.id, e.target.value)}
              disabled={readOnly}
              data-testid={`input-${field.id}`}
            />
          );

        case 'textarea':
          return (
            <Textarea
              placeholder={field.placeholder}
              value={value || ''}
              onChange={(e) => updateValue(field.id, e.target.value)}
              disabled={readOnly}
              rows={3}
              data-testid={`textarea-${field.id}`}
            />
          );

        case 'checkbox':
          return (
            <div className="flex items-center space-x-2">
              <Checkbox
                id={field.id}
                checked={value || false}
                onCheckedChange={(checked) => updateValue(field.id, checked)}
                disabled={readOnly}
                data-testid={`checkbox-${field.id}`}
              />
              <label htmlFor={field.id} className="text-sm cursor-pointer">
                {field.description || field.label}
              </label>
            </div>
          );

        case 'radio':
          return (
            <RadioGroup
              value={value || ''}
              onValueChange={(val) => updateValue(field.id, val)}
              disabled={readOnly}
              data-testid={`radio-${field.id}`}
            >
              {(field.options || []).map((option, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${field.id}-${idx}`} />
                  <Label htmlFor={`${field.id}-${idx}`}>{option}</Label>
                </div>
              ))}
            </RadioGroup>
          );

        case 'select':
          return (
            <Select
              value={value || ''}
              onValueChange={(val) => updateValue(field.id, val)}
              disabled={readOnly}
            >
              <SelectTrigger data-testid={`select-${field.id}`}>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {(field.options || []).map((option, idx) => (
                  <SelectItem key={idx} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          );

        case 'date':
          return (
            <Input
              type="date"
              value={value || ''}
              onChange={(e) => updateValue(field.id, e.target.value)}
              disabled={readOnly}
              data-testid={`date-${field.id}`}
            />
          );

        case 'time':
          return (
            <Input
              type="time"
              value={value || ''}
              onChange={(e) => updateValue(field.id, e.target.value)}
              disabled={readOnly}
              data-testid={`time-${field.id}`}
            />
          );

        case 'photo':
          return (
            <div className="space-y-2">
              {value && (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
                  <img src={value} alt="Captured" className="w-full h-full object-cover" />
                  {!readOnly && (
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => updateValue(field.id, null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
              {!value && !readOnly && (
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          updateValue(field.id, ev.target?.result);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    data-testid={`photo-${field.id}`}
                  />
                </div>
              )}
            </div>
          );

        case 'signature':
          return (
            <SignaturePad
              onSave={(data) => updateValue(field.id, data)}
              onClear={() => updateValue(field.id, null)}
              initialValue={value}
            />
          );

        default:
          return <Input value={value || ''} onChange={(e) => updateValue(field.id, e.target.value)} disabled={readOnly} />;
      }
    };

    return (
      <div key={field.id} className="space-y-2">
        {field.type !== 'checkbox' && (
          <Label className="flex items-center gap-1">
            {field.label}
            {field.required && <span className="text-destructive">*</span>}
          </Label>
        )}
        {field.description && field.type !== 'checkbox' && (
          <p className="text-sm text-muted-foreground">{field.description}</p>
        )}
        {renderInput()}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{form.name}</CardTitle>
        {form.description && <CardDescription>{form.description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map(renderField)}

        {form.requiresSignature && (
          <div className="space-y-2 pt-4">
            <Label className="flex items-center gap-1">
              Signature
              <span className="text-destructive">*</span>
            </Label>
            <SignaturePad
              onSave={setSignatureData}
              onClear={() => setSignatureData(null)}
              initialValue={signatureData || undefined}
            />
            {errors['_signature'] && (
              <p className="text-sm text-destructive">{errors['_signature']}</p>
            )}
          </div>
        )}
      </CardContent>
      {!readOnly && (
        <CardFooter className="flex justify-end gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
          )}
          <Button 
            onClick={handleSubmit} 
            disabled={submitMutation.isPending || updateMutation.isPending}
            data-testid="button-submit-form"
          >
            <Send className="h-4 w-4 mr-2" />
            {submitMutation.isPending || updateMutation.isPending ? 'Submitting...' : 'Submit Form'}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

interface FormSubmissionListProps {
  jobId: string;
  onFillForm: (form: CustomForm) => void;
}

export function FormSubmissionList({ jobId, onFillForm }: FormSubmissionListProps) {
  const { data: submissions, isLoading: loadingSubmissions } = useQuery<FormSubmission[]>({
    queryKey: ['/api/jobs', jobId, 'form-submissions'],
  });

  // Get user's trade type for filtering custom forms
  const { data: user } = useQuery<{ tradeType?: string }>({
    queryKey: ['/api/auth/me'],
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
  });

  const [selectedForm, setSelectedForm] = useState<CustomForm | null>(null);
  const [showFormPicker, setShowFormPicker] = useState(false);

  const isLoading = loadingSubmissions || loadingForms;

  const getFormById = (formId: string) => forms?.find(f => f.id === formId);

  const isSafetyForm = (form: CustomForm | undefined) => 
    form?.formType === 'safety' || form?.formType === 'compliance' || form?.formType === 'inspection';

  const getFormIcon = (form: CustomForm | undefined) => {
    if (isSafetyForm(form)) {
      return <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />;
    }
    return <FileText className="h-4 w-4 text-primary" />;
  };

  const getFormIconBg = (form: CustomForm | undefined) => {
    if (isSafetyForm(form)) {
      return "bg-green-100 dark:bg-green-900";
    }
    return "bg-primary/10";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Submitted</Badge>;
      case 'reviewed':
        return <Badge variant="secondary"><FileText className="h-3 w-3 mr-1" />Reviewed</Badge>;
      case 'approved':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  const activeForms = forms?.filter(f => f.isActive && !isSafetyForm(f)) || [];
  const nonSafetySubmissions = submissions?.filter(s => !isSafetyForm(getFormById(s.formId))) || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          General Forms
        </CardTitle>
        {activeForms.length > 0 && (
          <Button size="sm" onClick={() => setShowFormPicker(true)} data-testid="button-fill-form">
            Fill Form
          </Button>
        )}
      </CardHeader>
      <CardContent>
      {nonSafetySubmissions.length === 0 && activeForms.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No general forms available</p>
          <p className="text-xs">Create forms in Settings to use them on jobs</p>
        </div>
      ) : (
        <div className="space-y-2">
          {nonSafetySubmissions.map(submission => {
            const form = getFormById(submission.formId);
            return (
              <Card 
                key={submission.id} 
                className="p-3 hover-elevate cursor-pointer"
                data-testid={`submission-${submission.id}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-8 w-8 rounded-lg ${getFormIconBg(form)} flex items-center justify-center shrink-0`}>
                      {getFormIcon(form)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{form?.name || 'Unknown Form'}</p>
                      <p className="text-xs text-muted-foreground">
                        {submission.submittedAt && format(new Date(submission.submittedAt), 'dd MMM yyyy, h:mm a')}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(submission.status || 'submitted')}
                </div>
              </Card>
            );
          })}

          {nonSafetySubmissions.length === 0 && activeForms.length > 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No forms filled yet</p>
          )}
        </div>
      )}

      <Dialog open={showFormPicker} onOpenChange={setShowFormPicker}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select a Form</DialogTitle>
            <DialogDescription>Choose a form to fill out for this job</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4 max-h-[400px] overflow-y-auto">
            {activeForms.map(form => (
              <Card
                key={form.id}
                className="p-3 cursor-pointer hover-elevate"
                onClick={() => {
                  setShowFormPicker(false);
                  onFillForm(form);
                }}
                data-testid={`form-picker-${form.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{form.name}</p>
                    {form.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">{form.description}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      </CardContent>
    </Card>
  );
}

interface JobCardSectionProps {
  jobId: string;
}

export function JobCardSection({ jobId }: JobCardSectionProps) {
  const { toast } = useToast();
  const { isOwner, isManager } = useUserRole();
  const canManageJobCard = isOwner || isManager;
  const [, setLocation] = useLocation();
  const { data: submissions, isLoading: loadingSubmissions } = useQuery<FormSubmission[]>({
    queryKey: ['/api/jobs', jobId, 'form-submissions'],
  });

  const { data: user } = useQuery<{ tradeType?: string }>({
    queryKey: ['/api/auth/me'],
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
  });

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [selectedForm, setSelectedForm] = useState<CustomForm | null>(null);
  const [existingSubmission, setExistingSubmission] = useState<FormSubmission | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const isLoading = loadingSubmissions || loadingForms;
  const jobCards = (forms || []).filter(f => f.isActive && (f as any).isJobCard);
  const getSubmissionForForm = (formId: string) =>
    (submissions || []).find(s => s.formId === formId);

  const openList = () => { setView('list'); setOpen(true); };

  const handleFill = (form: CustomForm) => {
    setSelectedForm(form);
    setExistingSubmission(getSubmissionForForm(form.id) || null);
    setView('form');
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/job-card-pdf`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to generate PDF');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `job-card-${jobId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Could not generate the job card PDF. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportSingle = async (formId: string, formName: string) => {
    setExportingId(formId);
    try {
      const response = await fetch(`/api/jobs/${jobId}/job-card-pdf?formId=${encodeURIComponent(formId)}`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to generate PDF');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const slug = formName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'section';
      a.href = url;
      a.download = `job-card-${slug}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Could not generate the PDF. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setExportingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasCards = jobCards.length > 0;
  // Workers with no job card set up see nothing; owners/managers always get the launcher so they can set one up.
  if (!hasCards && !canManageJobCard) return null;

  const completedCount = jobCards.filter(f => !!getSubmissionForForm(f.id)).length;
  const anyCompleted = completedCount > 0;
  const requiredRemaining = jobCards.filter(
    f => (f as any).blockJobCompletion && !getSubmissionForForm(f.id)
  ).length;

  return (
    <>
      {/* Launcher - opens the focused Job Card popup */}
      <Card
        className="hover-elevate cursor-pointer"
        onClick={openList}
        data-testid="card-job-card-launcher"
      >
        <CardContent className="flex items-center gap-3 p-4">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <ClipboardCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium">Job Card</p>
            <p className="text-sm text-muted-foreground truncate">
              {hasCards
                ? `${completedCount}/${jobCards.length} sections done${requiredRemaining > 0 ? ` · ${requiredRemaining} required to close` : ''}`
                : 'No sections yet — tap to set up'}
            </p>
          </div>
          {hasCards && (
            <Badge variant={requiredRemaining > 0 ? 'outline' : 'secondary'}>
              {completedCount}/{jobCards.length}
            </Badge>
          )}
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {view === 'list' && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <DialogTitle className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5" />
                    Job Card
                  </DialogTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    {canManageJobCard && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLocation('/templates')}
                        data-testid="button-edit-job-card"
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit sections
                      </Button>
                    )}
                    {anyCompleted && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleExport}
                        disabled={exporting}
                        data-testid="button-export-job-card"
                      >
                        {exporting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <FileDown className="h-4 w-4 mr-2" />
                        )}
                        Export PDF
                      </Button>
                    )}
                  </div>
                </div>
                <DialogDescription>
                  {hasCards
                    ? 'Complete each section for this job.'
                    : 'No job card sections have been set up yet.'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                {!hasCards && (
                  <div className="text-center text-muted-foreground py-6">
                    <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No job card sections yet.</p>
                    {canManageJobCard && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={() => setLocation('/templates')}
                        data-testid="button-setup-job-card"
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Set up job card
                      </Button>
                    )}
                  </div>
                )}
                {jobCards.map(form => {
                  const submission = getSubmissionForForm(form.id);
                  const isDone = !!submission;
                  const required = !!(form as any).blockJobCompletion;
                  return (
                    <Card
                      key={form.id}
                      className="p-3 hover-elevate cursor-pointer"
                      onClick={() => handleFill(form)}
                      data-testid={`job-card-${form.id}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-8 w-8 rounded-lg ${isDone ? 'bg-green-100 dark:bg-green-900' : 'bg-primary/10'} flex items-center justify-center shrink-0`}>
                            {isDone ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                            ) : (
                              <ClipboardList className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{form.name}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              {isDone && submission?.submittedAt && (
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(submission.submittedAt), 'dd MMM yyyy, h:mm a')}
                                </span>
                              )}
                              {required && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Lock className="h-3 w-3" />
                                  Required to close
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isDone ? (
                            <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Done</Badge>
                          ) : (
                            <Badge variant="outline">Not started</Badge>
                          )}
                          {isDone && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); handleExportSingle(form.id, form.name); }}
                              disabled={exportingId === form.id}
                              title="Export this card as PDF"
                              data-testid={`button-export-card-${form.id}`}
                            >
                              {exportingId === form.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FileDown className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}

          {view === 'form' && selectedForm && (
            <FormRenderer
              form={selectedForm}
              jobId={jobId}
              existingSubmission={existingSubmission || undefined}
              onSubmit={() => setView('list')}
              onCancel={() => setView('list')}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface JobFormsProps {
  jobId: string;
}

export function JobForms({ jobId }: JobFormsProps) {
  const [selectedForm, setSelectedForm] = useState<CustomForm | null>(null);
  const [showFormDialog, setShowFormDialog] = useState(false);

  const handleFillForm = (form: CustomForm) => {
    setSelectedForm(form);
    setShowFormDialog(true);
  };

  return (
    <>
      <FormSubmissionList jobId={jobId} onFillForm={handleFillForm} />

      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedForm && (
            <FormRenderer
              form={selectedForm}
              jobId={jobId}
              onSubmit={() => setShowFormDialog(false)}
              onCancel={() => setShowFormDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface JobTask {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  source?: string | null;
  createdAt?: string;
}

// Markdown toolbar button helper
function MdBtn({ icon: Icon, title, onClick }: { icon: React.ElementType; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

import { applyLinePrefix, applyInline } from "@/lib/markdownEditor";
import {
  buildCreateTaskPayload,
  descriptionSaveValue,
  toggleNextStatus,
  descriptionInitialValue,
} from "@/lib/taskDescriptionUtils";

function useMarkdownEditor(initial = '') {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);

  const getSel = () => {
    const el = ref.current;
    if (!el) return { start: 0, end: 0 };
    return { start: el.selectionStart, end: el.selectionEnd };
  };

  const apply = (fn: (v: string, sel: { start: number; end: number }) => string) => {
    const sel = getSel();
    setValue(v => fn(v, sel));
    // Restore focus
    setTimeout(() => ref.current?.focus(), 0);
  };

  const toolbar = (
    <div className="flex items-center gap-0.5 border border-border rounded-t-md bg-muted/50 px-1.5 py-1">
      <MdBtn icon={Heading2} title="Heading 2" onClick={() => apply((v, s) => applyLinePrefix(v, s, '## '))} />
      <MdBtn icon={Heading3} title="Heading 3" onClick={() => apply((v, s) => applyLinePrefix(v, s, '### '))} />
      <span className="w-px h-4 bg-border mx-0.5" />
      <MdBtn icon={List} title="Bullet list" onClick={() => apply((v, s) => applyLinePrefix(v, s, '- '))} />
      <MdBtn icon={ListOrdered} title="Numbered list" onClick={() => apply((v, s) => applyLinePrefix(v, s, '1. '))} />
      <span className="w-px h-4 bg-border mx-0.5" />
      <MdBtn icon={Bold} title="Bold" onClick={() => apply((v, s) => applyInline(v, s, '**'))} />
      <MdBtn icon={Italic} title="Italic" onClick={() => apply((v, s) => applyInline(v, s, '*'))} />
    </div>
  );

  return { value, setValue, ref, toolbar };
}

// Renders markdown task description safely (headings, bullets, bold, italic)
function TaskMarkdown({ content }: { content: string }) {
  return (
    <div className="prose prose-xs max-w-none text-xs text-muted-foreground [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-1 [&_h2]:mb-0.5 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-1 [&_h3]:mb-0.5 [&_ul]:pl-4 [&_ol]:pl-4 [&_li]:my-0 [&_p]:my-0.5">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

export function JobTasksSection({ jobId }: { jobId: string }) {
  const { toast } = useToast();
  const { isOwner } = useUserRole();
  const [newTitle, setNewTitle] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [editingTask, setEditingTask] = useState<JobTask | null>(null);
  const createDesc = useMarkdownEditor("");
  const editDesc = useMarkdownEditor("");

  const { data: tasks = [], isLoading } = useQuery<JobTask[]>({
    queryKey: ['/api/jobs', jobId, 'tasks'],
    enabled: !!jobId,
  });

  const createMutation = useMutation({
    mutationFn: async ({ title, description }: { title: string; description?: string }) =>
      apiRequest('POST', '/api/tasks', buildCreateTaskPayload(title, jobId, description ?? '')),
    onSuccess: () => {
      setNewTitle("");
      setCreateTitle("");
      createDesc.setValue("");
      setShowCreateDialog(false);
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'tasks'] });
    },
    onError: () => toast({ title: 'Could not add task', variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      apiRequest('PATCH', `/api/tasks/${id}`, { status: toggleNextStatus(status) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'tasks'] }),
    onError: () => toast({ title: 'Could not update task', variant: 'destructive' }),
  });

  const updateDescMutation = useMutation({
    mutationFn: async ({ id, description }: { id: string; description: string | null }) =>
      apiRequest('PATCH', `/api/tasks/${id}`, { description: description === null ? null : descriptionSaveValue(description) }),
    onSuccess: () => {
      setEditingTask(null);
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'tasks'] });
    },
    onError: () => toast({ title: 'Could not save description', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/tasks/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'tasks'] }),
    onError: () => toast({ title: 'Could not delete task', variant: 'destructive' }),
  });

  const openCreateDialog = () => {
    setCreateTitle(newTitle.trim());
    createDesc.setValue("");
    setShowCreateDialog(true);
  };

  const openEditDesc = (task: JobTask) => {
    editDesc.setValue(descriptionInitialValue(task));
    setEditingTask(task);
  };

  if (isLoading) return null;
  // Non-owners only see the card when there are tasks (read-only). Owners always
  // see it so they can add follow-up tasks manually even when none exist yet.
  if (tasks.length === 0 && !isOwner) return null;

  const openCount = tasks.filter(t => t.status !== 'done').length;

  return (
    <>
    <Card data-testid="card-job-tasks">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            Follow-up Tasks
          </CardTitle>
          <Badge variant="secondary">{openCount} open</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.length === 0 && isOwner && (
          <p className="text-sm text-muted-foreground py-1">
            No follow-up tasks yet. Add one below or set up form task rules.
          </p>
        )}
        {tasks.map(task => (
          <div
            key={task.id}
            className="flex items-start gap-3 p-3 rounded-md bg-muted/50"
            data-testid={`job-task-${task.id}`}
          >
            <Checkbox
              checked={task.status === 'done'}
              onCheckedChange={() => toggleMutation.mutate({ id: task.id, status: task.status })}
              disabled={!isOwner}
              className="mt-0.5"
              data-testid={`checkbox-task-${task.id}`}
            />
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                {task.title}
              </p>
              {task.description && (
                <TaskMarkdown content={task.description} />
              )}
            </div>
            {isOwner && (
              <div className="flex items-center gap-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => openEditDesc(task)}
                  title="Edit description"
                  data-testid={`button-edit-desc-task-${task.id}`}
                  className={task.description ? "text-primary" : ""}
                >
                  <FileText className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => deleteMutation.mutate(task.id)}
                  data-testid={`button-delete-task-${task.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
        {isOwner && (
          <div className="flex items-center gap-2 pt-1">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Add a task"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTitle.trim())
                  createMutation.mutate({ title: newTitle.trim() });
              }}
              data-testid="input-new-task"
            />
            <Button
              size="icon"
              onClick={openCreateDialog}
              disabled={createMutation.isPending}
              title="Add task with description"
              data-testid="button-add-task"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Create task dialog */}
    <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
      <DialogContent className="max-w-lg" data-testid="dialog-create-task">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
          <DialogDescription>
            Add a title and optional rich description with headings, lists, and formatted steps.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder="Task title"
              autoFocus
              data-testid="input-create-task-title"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && createTitle.trim()) {
                  createMutation.mutate({ title: createTitle.trim(), description: createDesc.value.trim() || undefined });
                }
              }}
            />
          </div>
          <div className="space-y-1">
            <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            {createDesc.toolbar}
            <Textarea
              ref={createDesc.ref}
              value={createDesc.value}
              onChange={(e) => createDesc.setValue(e.target.value)}
              placeholder={"## Heading\n- Bullet item\n1. Numbered step\n\nOr write plain instructions..."}
              className="min-h-[140px] rounded-t-none border-t-0 font-mono text-xs resize-none"
              data-testid="textarea-create-task-desc"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
          <Button
            onClick={() => createMutation.mutate({ title: createTitle.trim(), description: createDesc.value.trim() || undefined })}
            disabled={!createTitle.trim() || createMutation.isPending}
            data-testid="button-confirm-add-task"
          >
            {createMutation.isPending ? "Adding..." : "Add Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Edit description dialog */}
    <Dialog open={!!editingTask} onOpenChange={(open) => { if (!open) setEditingTask(null); }}>
      <DialogContent className="max-w-lg" data-testid="dialog-edit-desc">
        <DialogHeader>
          <DialogTitle className="truncate">{editingTask?.title}</DialogTitle>
          <DialogDescription>
            Edit the task description. Supports headings (## H2, ### H3), bullet lists, numbered lists, **bold**, and *italic*.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 py-1">
          <Label>Description</Label>
          {editDesc.toolbar}
          <Textarea
            ref={editDesc.ref}
            value={editDesc.value}
            onChange={(e) => editDesc.setValue(e.target.value)}
            placeholder={"## Heading\n- Bullet item\n1. Numbered step\n\nOr write plain instructions..."}
            className="min-h-[180px] rounded-t-none border-t-0 font-mono text-xs resize-none"
            data-testid="textarea-edit-task-desc"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditingTask(null)}>Cancel</Button>
          {editingTask && editDesc.value.trim() && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => updateDescMutation.mutate({ id: editingTask.id, description: null })}
              disabled={updateDescMutation.isPending}
              data-testid="button-confirm-clear-desc"
            >
              Clear
            </Button>
          )}
          <Button
            onClick={() => editingTask && updateDescMutation.mutate({ id: editingTask.id, description: editDesc.value.trim() || null })}
            disabled={!editingTask || updateDescMutation.isPending}
            data-testid="button-confirm-save-desc"
          >
            {updateDescMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
