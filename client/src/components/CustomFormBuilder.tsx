import { useState, useEffect, useRef } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getAuthHeaders} from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Trash2,
  GripVertical,
  Save,
  Type,
  Hash,
  Mail,
  Phone,
  AlignLeft,
  CheckSquare,
  Circle,
  List,
  Calendar,
  Clock,
  Camera,
  PenTool,
  Minus,
  MoreVertical,
  Copy,
  ChevronUp,
  ChevronDown,
  FileText,
  ClipboardList,
  Shield,
  Search,
  Edit2,
  Eye,
  ChevronLeft,
  Upload,
  Download,
  GitBranch,
  Inbox,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import type { CustomForm, FormSubmission } from "@shared/schema";
import { format } from "date-fns";

export interface ConditionalLogicRule {
  fieldId: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_empty' | 'is_empty';
  value: string;
}

export interface FormField {
  id: string;
  type: 'text' | 'number' | 'email' | 'phone' | 'textarea' | 'checkbox' | 'radio' | 'select' | 'date' | 'time' | 'photo' | 'signature' | 'section';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  description?: string;
  defaultValue?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  conditionalLogic?: {
    enabled: boolean;
    action: 'show' | 'hide';
    rules: ConditionalLogicRule[];
  };
}

const FIELD_TYPES = [
  { type: 'text' as const, label: 'Text', icon: Type, description: 'Single line text input' },
  { type: 'number' as const, label: 'Number', icon: Hash, description: 'Numeric input' },
  { type: 'email' as const, label: 'Email', icon: Mail, description: 'Email address' },
  { type: 'phone' as const, label: 'Phone', icon: Phone, description: 'Phone number' },
  { type: 'textarea' as const, label: 'Text Area', icon: AlignLeft, description: 'Multi-line text' },
  { type: 'checkbox' as const, label: 'Checkbox', icon: CheckSquare, description: 'Yes/No option' },
  { type: 'radio' as const, label: 'Radio', icon: Circle, description: 'Single choice from options' },
  { type: 'select' as const, label: 'Dropdown', icon: List, description: 'Dropdown selection' },
  { type: 'date' as const, label: 'Date', icon: Calendar, description: 'Date picker' },
  { type: 'time' as const, label: 'Time', icon: Clock, description: 'Time picker' },
  { type: 'photo' as const, label: 'Photo', icon: Camera, description: 'Photo capture/upload' },
  { type: 'signature' as const, label: 'Signature', icon: PenTool, description: 'Signature capture' },
  { type: 'section' as const, label: 'Section', icon: Minus, description: 'Header divider' },
];

const FORM_TYPES = [
  { value: 'general', label: 'General', icon: FileText },
  { value: 'safety', label: 'Safety', icon: Shield },
  { value: 'compliance', label: 'Compliance', icon: ClipboardList },
  { value: 'inspection', label: 'Inspection', icon: Search },
];

function PreviewField({ field, allFields, formData }: { field: FormField; allFields?: FormField[]; formData?: Record<string, any> }) {
  if (field.conditionalLogic?.enabled && allFields && formData) {
    const rulesMet = field.conditionalLogic.rules.every(rule => {
      const val = formData[rule.fieldId];
      switch (rule.operator) {
        case 'equals': return String(val) === rule.value;
        case 'not_equals': return String(val) !== rule.value;
        case 'contains': return String(val || '').includes(rule.value);
        case 'not_empty': return val !== undefined && val !== null && val !== '';
        case 'is_empty': return val === undefined || val === null || val === '';
        default: return true;
      }
    });
    const shouldShow = field.conditionalLogic.action === 'show' ? rulesMet : !rulesMet;
    if (!shouldShow) return null;
  }

  if (field.type === 'section') {
    return (
      <div className="border-b pb-2 pt-4">
        <h3 className="font-semibold text-sm">{field.label}</h3>
      </div>
    );
  }

  const renderInput = () => {
    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'number':
        return (
          <Input
            type={field.type === 'number' ? 'number' : 'text'}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            className="h-12 rounded-xl"
            disabled
          />
        );
      case 'textarea':
        return (
          <Textarea
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            className="rounded-xl resize-none"
            rows={3}
            disabled
          />
        );
      case 'checkbox':
        return (
          <div className="flex items-center gap-3">
            <Checkbox disabled />
            <span className="text-sm text-muted-foreground">{field.placeholder || 'Check if applicable'}</span>
          </div>
        );
      case 'radio':
        return (
          <RadioGroup disabled className="space-y-2">
            {(field.options || ['Option 1', 'Option 2']).map((option, i) => (
              <div key={i} className="flex items-center gap-3">
                <RadioGroupItem value={option} id={`${field.id}-${i}`} disabled />
                <Label htmlFor={`${field.id}-${i}`} className="text-sm">{option}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      case 'select':
        return (
          <Select disabled>
            <SelectTrigger className="h-12 rounded-xl">
              <SelectValue placeholder={field.placeholder || 'Select option'} />
            </SelectTrigger>
          </Select>
        );
      case 'date':
        return <Input type="date" className="h-12 rounded-xl" disabled />;
      case 'time':
        return <Input type="time" className="h-12 rounded-xl" disabled />;
      case 'photo':
        return (
          <div className="h-24 border-2 border-dashed rounded-xl flex items-center justify-center text-muted-foreground gap-2">
            <Upload className="h-5 w-5" />
            <span className="text-sm">Upload photo</span>
          </div>
        );
      case 'signature':
        return (
          <div className="h-24 border-2 border-dashed rounded-xl flex items-center justify-center text-muted-foreground">
            <PenTool className="h-5 w-5 mr-2" />
            <span className="text-sm">Signature</span>
          </div>
        );
      default:
        return <Input className="h-12 rounded-xl" disabled />;
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm flex items-center gap-1.5">
        {field.label}
        {field.required && <span className="text-destructive">*</span>}
        {field.conditionalLogic?.enabled && (
          <GitBranch className="h-3 w-3 text-muted-foreground" />
        )}
      </Label>
      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
      {renderInput()}
    </div>
  );
}

function FormPreview({ fields, formName, requiresSignature }: { 
  fields: FormField[], 
  formName: string, 
  requiresSignature: boolean 
}) {
  return (
    <div className="p-4 lg:p-6">
      <div className="max-w-md mx-auto">
        <Card className="rounded-2xl overflow-visible shadow-lg">
          <CardHeader className="pb-4">
            <h2 className="text-lg font-semibold">{formName || 'Untitled Form'}</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Add fields to see preview</p>
            ) : (
              fields.map(field => (
                <PreviewField key={field.id} field={field} />
              ))
            )}
            {requiresSignature && (
              <div className="border-t pt-4 mt-4">
                <Label className="text-sm">Customer Signature</Label>
                <div className="h-24 border-2 border-dashed rounded-xl mt-2 flex items-center justify-center text-muted-foreground">
                  <PenTool className="h-5 w-5 mr-2" />
                  Sign here
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface FormBuilderProps {
  formId?: string;
  onBack: () => void;
}

export function FormBuilder({ formId, onBack }: FormBuilderProps) {
  const { toast } = useToast();
  const isEditing = !!formId;
  const search = useSearch();
  const [, navigate] = useLocation();
  const initialJobCard = !isEditing && new URLSearchParams(search).get('jobCard') === '1';
  const returnTab = new URLSearchParams(search).get('returnTab');
  const handleBack = () => {
    if (returnTab) {
      navigate(`/templates?tab=${returnTab}`);
    } else {
      onBack();
    }
  };

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState("general");
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [isJobCard, setIsJobCard] = useState(initialJobCard);
  const [blockJobCompletion, setBlockJobCompletion] = useState(false);
  const [taskRules, setTaskRules] = useState<Array<{ fieldId: string; operator: string; value: string; taskTitle: string }>>([]);
  const [fields, setFields] = useState<FormField[]>([]);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [showFieldDialog, setShowFieldDialog] = useState(false);
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [addFieldSheetOpen, setAddFieldSheetOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const { data: existingForm, isLoading } = useQuery<CustomForm>({
    queryKey: ['/api/custom-forms', formId],
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingForm) {
      setFormName(existingForm.name);
      setFormDescription(existingForm.description || "");
      setFormType(existingForm.formType || "general");
      setRequiresSignature(existingForm.requiresSignature || false);
      setIsJobCard((existingForm as any).isJobCard || false);
      setBlockJobCompletion((existingForm as any).blockJobCompletion || false);
      setTaskRules(Array.isArray((existingForm as any).taskRules) ? (existingForm as any).taskRules : []);
      setFields((existingForm.fields as FormField[]) || []);
    }
  }, [existingForm]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/custom-forms', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-forms'] });
      toast({ title: "Form created", description: "Your custom form has been saved." });
      handleBack();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PATCH', `/api/custom-forms/${formId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-forms'] });
      toast({ title: "Form updated", description: "Your changes have been saved." });
      handleBack();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!formName.trim()) {
      toast({ title: "Name required", description: "Please enter a form name.", variant: "destructive" });
      return;
    }
    if (fields.length === 0) {
      toast({ title: "Fields required", description: "Please add at least one field.", variant: "destructive" });
      return;
    }

    const data = {
      name: formName,
      description: formDescription,
      formType,
      requiresSignature,
      isJobCard,
      blockJobCompletion: isJobCard ? blockJobCompletion : false,
      taskRules: taskRules.filter(r => r.fieldId && r.taskTitle),
      fields,
      isActive: true,
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const generateId = () => `field_${crypto.randomUUID()}`;

  const addField = (type: FormField['type']) => {
    const fieldType = FIELD_TYPES.find(f => f.type === type);
    const newField: FormField = {
      id: generateId(),
      type,
      label: fieldType?.label || 'New Field',
      required: false,
      options: type === 'radio' || type === 'select' ? ['Option 1', 'Option 2'] : undefined,
    };
    setFields([...fields, newField]);
    setEditingField(newField);
    setShowFieldDialog(true);
    setAddFieldSheetOpen(false);
  };

  const updateField = (updatedField: FormField) => {
    setFields(fields.map(f => f.id === updatedField.id ? updatedField : f));
    setShowFieldDialog(false);
    setEditingField(null);
  };

  const deleteField = (fieldId: string) => {
    setFields(prev => {
      const updated = prev.filter(f => f.id !== fieldId);
      return updated.map(f => {
        if (f.conditionalLogic?.rules.some(r => r.fieldId === fieldId)) {
          return {
            ...f,
            conditionalLogic: {
              ...f.conditionalLogic,
              rules: f.conditionalLogic!.rules.filter(r => r.fieldId !== fieldId),
            },
          };
        }
        return f;
      });
    });
  };

  const duplicateField = (field: FormField) => {
    const duplicate = { ...field, id: generateId(), label: `${field.label} (Copy)`, conditionalLogic: undefined };
    const index = fields.findIndex(f => f.id === field.id);
    const newFields = [...fields];
    newFields.splice(index + 1, 0, duplicate);
    setFields(newFields);
  };

  const moveField = (fieldId: string, direction: 'up' | 'down') => {
    const index = fields.findIndex(f => f.id === fieldId);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === fields.length - 1)) {
      return;
    }
    const newFields = [...fields];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newFields[index], newFields[swapIndex]] = [newFields[swapIndex], newFields[index]];
    setFields(newFields);
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newFields = [...fields];
    const [moved] = newFields.splice(dragIndex, 1);
    newFields.splice(dropIndex, 0, moved);
    setFields(newFields);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const getFieldIcon = (type: FormField['type']) => {
    const fieldType = FIELD_TYPES.find(f => f.type === type);
    return fieldType ? fieldType.icon : Type;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="xl:hidden border-b-2 bg-card sticky top-0 z-10 shadow-sm">
        <Tabs value={mobileView} onValueChange={(v) => setMobileView(v as 'edit' | 'preview')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 gap-1 p-1.5 bg-muted/60">
            <TabsTrigger value="edit" className="gap-2 font-semibold rounded-lg data-[state=active]:shadow-md transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Edit2 className="h-4 w-4" />
              Edit
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2 font-semibold rounded-lg data-[state=active]:shadow-md transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 overflow-auto p-4 xl:p-6 ${mobileView === 'preview' ? 'hidden xl:block' : ''}`}>
          <div className="space-y-6 max-w-3xl">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Button type="button" variant="ghost" size="icon" onClick={handleBack} className="rounded-xl" data-testid="button-back">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <h1 className="ios-title text-xl font-semibold">{isEditing ? 'Edit Form' : 'New Form'}</h1>
              </div>
              <Badge 
                className="px-3 py-1.5 text-xs font-semibold" 
                style={{ backgroundColor: 'hsl(var(--trade) / 0.1)', color: 'hsl(var(--trade))', border: 'none' }}
              >
                {fields.length} fields
              </Badge>
            </div>

            <Card className="rounded-2xl overflow-visible">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                  Form Details
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="form-name">Form Name</Label>
                    <Input
                      id="form-name"
                      placeholder="e.g., Site Safety Checklist"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="h-12 rounded-xl"
                      data-testid="input-form-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="form-type">Form Type</Label>
                    <Select value={formType} onValueChange={setFormType}>
                      <SelectTrigger className="h-12 rounded-xl" data-testid="select-form-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FORM_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <type.icon className="h-4 w-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="form-description">Description (Optional)</Label>
                  <Textarea
                    id="form-description"
                    placeholder="Brief description of when to use this form..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={2}
                    className="rounded-xl resize-none"
                    data-testid="input-form-description"
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                  <div className="space-y-0.5">
                    <Label>Require Signature</Label>
                    <p className="text-xs text-muted-foreground">Customer must sign after completing</p>
                  </div>
                  <Switch
                    checked={requiresSignature}
                    onCheckedChange={setRequiresSignature}
                    data-testid="switch-require-signature"
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                  <div className="space-y-0.5">
                    <Label>Use as Job Card</Label>
                    <p className="text-xs text-muted-foreground">Show this form as a Job Card tab on every job</p>
                  </div>
                  <Switch
                    checked={isJobCard}
                    onCheckedChange={setIsJobCard}
                    data-testid="switch-is-job-card"
                  />
                </div>
                {isJobCard && (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                    <div className="space-y-0.5">
                      <Label>Required to Close Job</Label>
                      <p className="text-xs text-muted-foreground">Job can't be marked done until this card is filled in</p>
                    </div>
                    <Switch
                      checked={blockJobCompletion}
                      onCheckedChange={setBlockJobCompletion}
                      data-testid="switch-block-completion"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl overflow-visible">
              <CardContent className="p-4 space-y-3">
                <div className="space-y-0.5">
                  <Label>Follow-up Task Rules</Label>
                  <p className="text-xs text-muted-foreground">Automatically create a follow-up task when an answer matches a rule</p>
                </div>
                {fields.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Add a field first to create rules.</p>
                ) : (
                  <>
                    {taskRules.map((rule, idx) => (
                      <div key={idx} className="space-y-2 p-3 bg-muted/50 rounded-xl" data-testid={`task-rule-${idx}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground shrink-0">When</span>
                          <Select
                            value={rule.fieldId}
                            onValueChange={(v) => setTaskRules(prev => prev.map((r, i) => i === idx ? { ...r, fieldId: v } : r))}
                          >
                            <SelectTrigger className="h-9 rounded-lg flex-1" data-testid={`select-rule-field-${idx}`}>
                              <SelectValue placeholder="Field" />
                            </SelectTrigger>
                            <SelectContent>
                              {fields.map((f) => (
                                <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setTaskRules(prev => prev.filter((_, i) => i !== idx))}
                            data-testid={`button-remove-rule-${idx}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={rule.operator}
                            onValueChange={(v) => setTaskRules(prev => prev.map((r, i) => i === idx ? { ...r, operator: v } : r))}
                          >
                            <SelectTrigger className="h-9 rounded-lg w-40" data-testid={`select-rule-operator-${idx}`}>
                              <SelectValue placeholder="Condition" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equals">is equal to</SelectItem>
                              <SelectItem value="not_equals">is not equal to</SelectItem>
                              <SelectItem value="contains">contains</SelectItem>
                              <SelectItem value="is_checked">is checked / yes</SelectItem>
                              <SelectItem value="not_checked">is unchecked / no</SelectItem>
                              <SelectItem value="is_empty">is empty</SelectItem>
                              <SelectItem value="is_not_empty">is not empty</SelectItem>
                              <SelectItem value="greater_than">is greater than</SelectItem>
                              <SelectItem value="less_than">is less than</SelectItem>
                              <SelectItem value="any">has any answer</SelectItem>
                            </SelectContent>
                          </Select>
                          {!['is_checked', 'not_checked', 'is_empty', 'is_not_empty', 'any'].includes(rule.operator) && (
                            <Input
                              className="h-9 rounded-lg flex-1"
                              placeholder="Value"
                              value={rule.value}
                              onChange={(e) => setTaskRules(prev => prev.map((r, i) => i === idx ? { ...r, value: e.target.value } : r))}
                              data-testid={`input-rule-value-${idx}`}
                            />
                          )}
                        </div>
                        <Input
                          className="h-9 rounded-lg"
                          placeholder="Task to create (e.g. Order replacement part)"
                          value={rule.taskTitle}
                          onChange={(e) => setTaskRules(prev => prev.map((r, i) => i === idx ? { ...r, taskTitle: e.target.value } : r))}
                          data-testid={`input-rule-title-${idx}`}
                        />
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => setTaskRules(prev => [...prev, { fieldId: fields[0]?.id || '', operator: 'equals', value: '', taskTitle: '' }])}
                      data-testid="button-add-task-rule"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Rule
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl overflow-visible">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ClipboardList className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                    Form Fields
                  </div>
                  <Sheet open={addFieldSheetOpen} onOpenChange={setAddFieldSheetOpen}>
                    <SheetTrigger asChild>
                      <Button size="sm" className="rounded-xl xl:hidden" data-testid="button-add-field-mobile">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Field
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl pb-8 z-[60]">
                      <SheetHeader>
                        <SheetTitle>Add Field</SheetTitle>
                      </SheetHeader>
                      <div className="grid grid-cols-2 gap-2 p-4 overflow-auto">
                        {FIELD_TYPES.map(fieldType => {
                          const Icon = fieldType.icon;
                          return (
                            <Button
                              key={fieldType.type}
                              variant="outline"
                              className="h-auto py-3 flex-col gap-2 rounded-xl"
                              onClick={() => addField(fieldType.type)}
                              data-testid={`button-add-${fieldType.type}-mobile`}
                            >
                              <div 
                                className="h-10 w-10 rounded-lg flex items-center justify-center" 
                                style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
                              >
                                <Icon className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                              </div>
                              <span className="text-sm font-medium">{fieldType.label}</span>
                            </Button>
                          );
                        })}
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
                
                {fields.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No fields yet</p>
                    <p className="text-sm text-muted-foreground">Add fields to build your form</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fields.map((field, index) => {
                      const FieldIcon = getFieldIcon(field.type);
                      const isDragOver = dragOverIndex === index && dragIndex !== index;
                      return (
                        <div
                          key={field.id}
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDrop={(e) => handleDrop(e, index)}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center gap-3 p-3 border rounded-xl bg-card hover-elevate cursor-pointer transition-all ${
                            dragIndex === index ? 'opacity-50' : ''
                          } ${isDragOver ? 'border-primary border-2' : ''}`}
                          onClick={() => {
                            setEditingField(field);
                            setShowFieldDialog(true);
                          }}
                          data-testid={`field-item-${field.id}`}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0 cursor-grab active:cursor-grabbing" />
                          <div 
                            className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
                          >
                            <FieldIcon className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium truncate">{field.label}</span>
                              {field.required && (
                                <Badge variant="secondary" className="text-xs shrink-0">Required</Badge>
                              )}
                              {field.conditionalLogic?.enabled && (
                                <Badge variant="outline" className="text-xs shrink-0">
                                  <GitBranch className="h-3 w-3 mr-1" />
                                  Conditional
                                </Badge>
                              )}
                            </div>
                            <span className="text-sm text-muted-foreground capitalize">{field.type}</span>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); moveField(field.id, 'up'); }} disabled={index === 0}>
                                <ChevronUp className="h-4 w-4 mr-2" />
                                Move Up
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); moveField(field.id, 'down'); }} disabled={index === fields.length - 1}>
                                <ChevronDown className="h-4 w-4 mr-2" />
                                Move Down
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicateField(field); }}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); deleteField(field.id); }} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="hidden xl:block">
              <Card className="rounded-2xl overflow-visible">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Plus className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                    Add Field
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {FIELD_TYPES.map(fieldType => {
                      const Icon = fieldType.icon;
                      return (
                        <Button
                          key={fieldType.type}
                          variant="outline"
                          className="h-auto py-3 flex-col gap-2 rounded-xl"
                          onClick={() => addField(fieldType.type)}
                          data-testid={`button-add-${fieldType.type}`}
                        >
                          <div 
                            className="h-10 w-10 rounded-lg flex items-center justify-center" 
                            style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
                          >
                            <Icon className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                          </div>
                          <span className="text-sm font-medium">{fieldType.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="sticky bottom-0 bg-background/95 backdrop-blur pt-4 pb-4 border-t -mx-4 px-4 xl:-mx-6 xl:px-6">
              <Button 
                onClick={handleSave} 
                disabled={createMutation.isPending || updateMutation.isPending} 
                className="w-full h-12 rounded-xl"
                data-testid="button-save-form"
              >
                <Save className="h-4 w-4 mr-2" />
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Form'}
              </Button>
            </div>
          </div>
        </div>

        <div className={`xl:w-[400px] border-l bg-muted/30 overflow-auto ${mobileView === 'edit' ? 'hidden xl:block' : ''}`}>
          <FormPreview fields={fields} formName={formName} requiresSignature={requiresSignature} />
        </div>
      </div>

      <FieldEditDialog
        field={editingField}
        allFields={fields}
        open={showFieldDialog}
        onOpenChange={setShowFieldDialog}
        onSave={updateField}
      />
    </div>
  );
}

interface FieldEditDialogProps {
  field: FormField | null;
  allFields: FormField[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (field: FormField) => void;
}

function FieldEditDialog({ field, allFields, open, onOpenChange, onSave }: FieldEditDialogProps) {
  const [editedField, setEditedField] = useState<FormField | null>(null);
  const [newOption, setNewOption] = useState("");

  useEffect(() => {
    if (field) {
      setEditedField({ 
        ...field, 
        options: field.options ? [...field.options] : undefined,
        validation: field.validation ? { ...field.validation } : undefined,
        conditionalLogic: field.conditionalLogic ? {
          ...field.conditionalLogic,
          rules: field.conditionalLogic.rules.map(r => ({ ...r })),
        } : undefined,
      });
    }
  }, [field]);

  const handleSave = () => {
    if (editedField) {
      onSave(editedField);
    }
  };

  const addOption = () => {
    if (newOption.trim() && editedField) {
      setEditedField({
        ...editedField,
        options: [...(editedField.options || []), newOption.trim()],
      });
      setNewOption("");
    }
  };

  const removeOption = (index: number) => {
    if (editedField) {
      const newOptions = [...(editedField.options || [])];
      newOptions.splice(index, 1);
      setEditedField({ ...editedField, options: newOptions });
    }
  };

  const updateOption = (index: number, value: string) => {
    if (editedField) {
      const newOptions = [...(editedField.options || [])];
      newOptions[index] = value;
      setEditedField({ ...editedField, options: newOptions });
    }
  };

  const otherFields = allFields.filter(f => f.id !== editedField?.id && f.type !== 'section');

  const toggleConditionalLogic = (enabled: boolean) => {
    if (!editedField) return;
    if (enabled) {
      setEditedField({
        ...editedField,
        conditionalLogic: {
          enabled: true,
          action: 'show',
          rules: [{ fieldId: otherFields[0]?.id || '', operator: 'equals', value: '' }],
        },
      });
    } else {
      setEditedField({
        ...editedField,
        conditionalLogic: undefined,
      });
    }
  };

  const updateConditionRule = (ruleIndex: number, updates: Partial<ConditionalLogicRule>) => {
    if (!editedField?.conditionalLogic) return;
    const newRules = [...editedField.conditionalLogic.rules];
    newRules[ruleIndex] = { ...newRules[ruleIndex], ...updates };
    setEditedField({
      ...editedField,
      conditionalLogic: { ...editedField.conditionalLogic, rules: newRules },
    });
  };

  const addConditionRule = () => {
    if (!editedField?.conditionalLogic) return;
    setEditedField({
      ...editedField,
      conditionalLogic: {
        ...editedField.conditionalLogic,
        rules: [
          ...editedField.conditionalLogic.rules,
          { fieldId: otherFields[0]?.id || '', operator: 'equals' as const, value: '' },
        ],
      },
    });
  };

  const removeConditionRule = (ruleIndex: number) => {
    if (!editedField?.conditionalLogic) return;
    const newRules = editedField.conditionalLogic.rules.filter((_, i) => i !== ruleIndex);
    if (newRules.length === 0) {
      setEditedField({ ...editedField, conditionalLogic: undefined });
    } else {
      setEditedField({
        ...editedField,
        conditionalLogic: { ...editedField.conditionalLogic, rules: newRules },
      });
    }
  };

  if (!editedField) return null;

  const hasOptions = editedField.type === 'radio' || editedField.type === 'select';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Field</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="field-label">Label</Label>
            <Input
              id="field-label"
              value={editedField.label}
              onChange={(e) => setEditedField({ ...editedField, label: e.target.value })}
              className="h-12 rounded-xl"
              data-testid="input-field-label"
            />
          </div>
          
          {editedField.type !== 'section' && editedField.type !== 'checkbox' && (
            <div className="space-y-2">
              <Label htmlFor="field-placeholder">Placeholder (Optional)</Label>
              <Input
                id="field-placeholder"
                value={editedField.placeholder || ""}
                onChange={(e) => setEditedField({ ...editedField, placeholder: e.target.value })}
                className="h-12 rounded-xl"
                data-testid="input-field-placeholder"
              />
            </div>
          )}

          {editedField.type !== 'section' && (
            <div className="space-y-2">
              <Label htmlFor="field-description">Help Text (Optional)</Label>
              <Input
                id="field-description"
                placeholder="Instructions for filling this field"
                value={editedField.description || ""}
                onChange={(e) => setEditedField({ ...editedField, description: e.target.value })}
                className="h-12 rounded-xl"
                data-testid="input-field-description"
              />
            </div>
          )}

          {hasOptions && (
            <div className="space-y-2">
              <Label>Options</Label>
              <div className="space-y-2">
                {(editedField.options || []).map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      className="h-12 rounded-xl"
                      data-testid={`input-option-${index}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(index)}
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Add option..."
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addOption()}
                    className="h-12 rounded-xl"
                    data-testid="input-new-option"
                  />
                  <Button variant="outline" size="icon" onClick={addOption} className="shrink-0 rounded-xl">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {editedField.type !== 'section' && (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
              <Label htmlFor="field-required">Required</Label>
              <Switch
                id="field-required"
                checked={editedField.required || false}
                onCheckedChange={(checked) => setEditedField({ ...editedField, required: checked })}
                data-testid="switch-field-required"
              />
            </div>
          )}

          {editedField.type !== 'section' && otherFields.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                    <Label>Conditional Logic</Label>
                  </div>
                  <Switch
                    checked={!!editedField.conditionalLogic?.enabled}
                    onCheckedChange={toggleConditionalLogic}
                    data-testid="switch-conditional-logic"
                  />
                </div>

                {editedField.conditionalLogic?.enabled && (
                  <div className="space-y-3 p-3 bg-muted/30 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Select
                        value={editedField.conditionalLogic.action}
                        onValueChange={(v) => setEditedField({
                          ...editedField,
                          conditionalLogic: { ...editedField.conditionalLogic!, action: v as 'show' | 'hide' },
                        })}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="show">Show</SelectItem>
                          <SelectItem value="hide">Hide</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-muted-foreground">this field when:</span>
                    </div>

                    {editedField.conditionalLogic.rules.map((rule, ruleIdx) => (
                      <div key={ruleIdx} className="space-y-2 p-3 border rounded-lg bg-card">
                        <div className="flex items-center gap-2">
                          <Select
                            value={rule.fieldId}
                            onValueChange={(v) => updateConditionRule(ruleIdx, { fieldId: v })}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select field" />
                            </SelectTrigger>
                            <SelectContent>
                              {otherFields.map(f => (
                                <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeConditionRule(ruleIdx)}
                            className="shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={rule.operator}
                            onValueChange={(v) => updateConditionRule(ruleIdx, { operator: v as ConditionalLogicRule['operator'] })}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equals">Equals</SelectItem>
                              <SelectItem value="not_equals">Not Equals</SelectItem>
                              <SelectItem value="contains">Contains</SelectItem>
                              <SelectItem value="not_empty">Not Empty</SelectItem>
                              <SelectItem value="is_empty">Is Empty</SelectItem>
                            </SelectContent>
                          </Select>
                          {rule.operator !== 'not_empty' && rule.operator !== 'is_empty' && (
                            <Input
                              placeholder="Value"
                              value={rule.value}
                              onChange={(e) => updateConditionRule(ruleIdx, { value: e.target.value })}
                              className="flex-1"
                            />
                          )}
                        </div>
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addConditionRule}
                      className="w-full rounded-lg"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Condition
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={handleSave} className="rounded-xl" data-testid="button-save-field">Save Field</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubmissionsViewer({ formId, formName, fields }: { formId: string; formName: string; fields: FormField[] }) {
  const { data: submissions, isLoading } = useQuery<FormSubmission[]>({
    queryKey: ['/api/custom-forms', formId, 'submissions'],
  });

  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const exportSubmissions = () => {
    if (!submissions || submissions.length === 0) return;

    const headers = ['Submitted At', 'Status', ...fields.filter(f => f.type !== 'section').map(f => f.label)];
    const rows = submissions.map(sub => {
      const data = (sub.submissionData as Record<string, any>) || {};
      return [
        sub.submittedAt ? format(new Date(sub.submittedAt), 'yyyy-MM-dd HH:mm') : '',
        sub.status || 'submitted',
        ...fields.filter(f => f.type !== 'section').map(f => {
          const val = data[f.id];
          if (val === undefined || val === null) return '';
          if (typeof val === 'boolean') return val ? 'Yes' : 'No';
          if (typeof val === 'string' && val.startsWith('data:')) return '[file]';
          return String(val);
        }),
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${formName.replace(/[^a-z0-9]/gi, '_')}_submissions.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!submissions || submissions.length === 0) {
    return (
      <div className="text-center py-12">
        <Inbox className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">No submissions yet</p>
        <p className="text-sm text-muted-foreground">Submissions will appear here when forms are filled out</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{submissions.length} submission{submissions.length !== 1 ? 's' : ''}</p>
        <Button variant="outline" size="sm" onClick={exportSubmissions} className="rounded-xl">
          <Download className="h-4 w-4 mr-1" />
          Export CSV
        </Button>
      </div>

      <div className="space-y-2">
        {submissions.map(sub => (
          <Card
            key={sub.id}
            className="p-3 hover-elevate cursor-pointer"
            onClick={() => setSelectedSubmission(sub)}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {getStatusIcon(sub.status || 'submitted')}
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {sub.submittedAt ? format(new Date(sub.submittedAt), 'dd MMM yyyy, h:mm a') : 'Unknown date'}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{sub.status || 'submitted'}</p>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs capitalize">{sub.status || 'submitted'}</Badge>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submission Details</DialogTitle>
            <DialogDescription>
              {selectedSubmission?.submittedAt ? format(new Date(selectedSubmission.submittedAt), 'dd MMMM yyyy, h:mm a') : ''}
            </DialogDescription>
          </DialogHeader>
          {selectedSubmission && (
            <div className="space-y-4 py-4">
              {fields.filter(f => f.type !== 'section').map(field => {
                const data = (selectedSubmission.submissionData as Record<string, any>) || {};
                const value = data[field.id];
                return (
                  <div key={field.id} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{field.label}</Label>
                    <div className="text-sm">
                      {value === undefined || value === null || value === '' ? (
                        <span className="text-muted-foreground italic">No response</span>
                      ) : typeof value === 'boolean' ? (
                        value ? 'Yes' : 'No'
                      ) : typeof value === 'string' && value.startsWith('data:image') ? (
                        <img src={value} alt={field.label} className="max-w-full h-auto rounded-lg max-h-40" />
                      ) : (
                        String(value)
                      )}
                    </div>
                  </div>
                );
              })}
              {selectedSubmission.notes && (
                <div className="space-y-1 border-t pt-3">
                  <Label className="text-xs text-muted-foreground">Review Notes</Label>
                  <p className="text-sm">{selectedSubmission.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface FormListProps {
  onCreateNew: () => void;
  onEdit: (formId: string) => void;
  onViewSubmissions?: (formId: string) => void;
  hideHeader?: boolean;
}

export function FormList({ onCreateNew, onEdit, onViewSubmissions, hideHeader = false }: FormListProps) {
  const { toast } = useToast();
  
  const { data: user } = useQuery<{ tradeType?: string }>({
    queryKey: ['/api/auth/me'],
  });
  const tradeType = user?.tradeType;

  const { data: forms, isLoading } = useQuery<CustomForm[]>({
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/custom-forms/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-forms'] });
      toast({ title: "Form deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getFormTypeIcon = (type: string) => {
    const formType = FORM_TYPES.find(t => t.value === type);
    return formType?.icon || FileText;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Custom Forms</h1>
            <p className="text-sm text-muted-foreground">Create and manage form templates for your jobs</p>
          </div>
          <Button onClick={onCreateNew} className="rounded-xl" data-testid="button-create-form">
            <Plus className="h-4 w-4 mr-2" />
            Create Form
          </Button>
        </div>
      )}

      {!forms || forms.length === 0 ? (
        <Card className="p-12 text-center rounded-2xl">
          <ClipboardList className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No forms yet</h3>
          <p className="text-muted-foreground mb-4">Create your first custom form template</p>
          <Button onClick={onCreateNew} className="rounded-xl">
            <Plus className="h-4 w-4 mr-2" />
            Create Form
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map(form => {
            const Icon = getFormTypeIcon(form.formType || 'general');
            const fieldCount = Array.isArray(form.fields) ? form.fields.length : 0;
            const hasConditionalLogic = Array.isArray(form.fields) && (form.fields as FormField[]).some(f => f.conditionalLogic?.enabled);
            return (
              <Card 
                key={form.id} 
                className="hover-elevate cursor-pointer rounded-2xl"
                onClick={() => onEdit(form.id)}
                data-testid={`form-card-${form.id}`}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
                  <div 
                    className="h-12 w-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
                  >
                    <Icon className="h-6 w-6" style={{ color: 'hsl(var(--trade))' }} />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(form.id); }}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit Form
                      </DropdownMenuItem>
                      {onViewSubmissions && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewSubmissions(form.id); }}>
                          <Inbox className="h-4 w-4 mr-2" />
                          View Submissions
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(form.id); }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  <h3 className="font-medium truncate">{form.name}</h3>
                  {form.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{form.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <Badge variant="secondary" className="capitalize">{form.formType}</Badge>
                    <span className="text-sm text-muted-foreground">{fieldCount} fields</span>
                    {form.requiresSignature && (
                      <Badge variant="outline">
                        <PenTool className="h-3 w-3 mr-1" />
                        Sign
                      </Badge>
                    )}
                    {hasConditionalLogic && (
                      <Badge variant="outline">
                        <GitBranch className="h-3 w-3 mr-1" />
                        Logic
                      </Badge>
                    )}
                    {!form.isActive && (
                      <Badge variant="destructive">Inactive</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface CustomFormsPageProps {
  hideHeader?: boolean;
}

export function CustomFormsPage({ hideHeader = false }: CustomFormsPageProps) {
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'submissions'>('list');
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [submissionsFormId, setSubmissionsFormId] = useState<string | null>(null);

  const { data: forms } = useQuery<CustomForm[]>({
    queryKey: ['/api/custom-forms'],
  });

  const handleEdit = (formId: string) => {
    setEditingFormId(formId);
    setView('edit');
  };

  const handleViewSubmissions = (formId: string) => {
    setSubmissionsFormId(formId);
    setView('submissions');
  };

  const handleBack = () => {
    setView('list');
    setEditingFormId(null);
    setSubmissionsFormId(null);
  };

  if (view === 'create') {
    return <FormBuilder onBack={handleBack} />;
  }

  if (view === 'edit' && editingFormId) {
    return <FormBuilder formId={editingFormId} onBack={handleBack} />;
  }

  if (view === 'submissions' && submissionsFormId) {
    const form = forms?.find(f => f.id === submissionsFormId);
    return (
      <div className="space-y-6 p-4 xl:p-6">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={handleBack} className="rounded-xl">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{form?.name || 'Form'} Submissions</h1>
            <p className="text-sm text-muted-foreground">View and export form responses</p>
          </div>
        </div>
        <SubmissionsViewer 
          formId={submissionsFormId} 
          formName={form?.name || 'Form'} 
          fields={(form?.fields as FormField[]) || []} 
        />
      </div>
    );
  }

  return (
    <FormList 
      onCreateNew={() => setView('create')} 
      onEdit={handleEdit} 
      onViewSubmissions={handleViewSubmissions}
      hideHeader={hideHeader} 
    />
  );
}
