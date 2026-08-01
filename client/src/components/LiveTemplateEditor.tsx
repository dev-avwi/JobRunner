import { useState, useEffect } from "react";
import { getAuthHeaders } from "@/lib/queryClient";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { useCreateDocumentTemplate, useUpdateDocumentTemplate } from "@/hooks/use-templates";
import { useQuery } from "@tanstack/react-query";
import LiveDocumentPreview from "./LiveDocumentPreview";
import {
  Plus,
  Trash2,
  Edit2,
  Eye,
  FileText,
  Receipt,
  Briefcase,
  Package,
  ChevronLeft,
  Palette,
  Settings,
  ListChecks,
} from "lucide-react";

const lineItemSchema = z.object({
  description: z.string().min(1, "Description required"),
  qty: z.number().min(1).default(1),
  unitPrice: z.number().min(0).default(0),
  unit: z.string().default("hour"),
});

const templateFormSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  type: z.enum(['quote', 'invoice', 'job']),
  tradeType: z.string().min(1, "Trade type is required"),
  familyKey: z.string().min(1, "Family key is required"),
  styling: z.object({
    brandColor: z.string().default("#2563eb"),
    logoDisplay: z.boolean().default(true),
  }),
  sections: z.object({
    showHeader: z.boolean().default(true),
    showLineItems: z.boolean().default(true),
    showTotals: z.boolean().default(true),
    showTerms: z.boolean().default(true),
    showSignature: z.boolean().default(true),
  }),
  defaults: z.object({
    title: z.string().min(1, "Default title is required"),
    description: z.string().default(""),
    terms: z.string().default(""),
    depositPct: z.number().min(0).max(100).default(50),
    dueTermDays: z.number().min(1).default(30),
    gstEnabled: z.boolean().default(true),
  }),
  defaultLineItems: z.array(lineItemSchema).default([]),
});

type TemplateFormData = z.infer<typeof templateFormSchema>;

const tradeTypes = [
  'plumbing', 'electrical', 'carpentry', 'painting', 'hvac', 'roofing', 
  'landscaping', 'tiling', 'flooring', 'renovation', 'handyman'
];

const units = ['hour', 'day', 'each', 'sqm', 'lm', 'flat', 'job'];

interface LiveTemplateEditorProps {
  editingTemplate?: any;
  onSave?: () => void;
  onCancel?: () => void;
}

export default function LiveTemplateEditor({ editingTemplate, onSave, onCancel }: LiveTemplateEditorProps) {
  const { toast } = useToast();
  const { data: businessSettings } = useBusinessSettings();
  const createTemplateMutation = useCreateDocumentTemplate();
  const updateTemplateMutation = useUpdateDocumentTemplate();
  
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ description: "", qty: 1, unitPrice: 0, unit: "hour" });

  const { data: userCheck } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Not authenticated');
      return res.json();
    },
    retry: false,
    staleTime: 30000,
  });

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      type: "quote",
      tradeType: userCheck?.user?.tradeType || "plumbing",
      familyKey: "",
      styling: {
        brandColor: "#2563eb",
        logoDisplay: true,
      },
      sections: {
        showHeader: true,
        showLineItems: true,
        showTotals: true,
        showTerms: true,
        showSignature: true,
      },
      defaults: {
        title: "",
        description: "",
        terms: "",
        depositPct: 50,
        dueTermDays: 30,
        gstEnabled: true,
      },
      defaultLineItems: [],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "defaultLineItems"
  });

  useEffect(() => {
    if (editingTemplate) {
      form.reset({
        name: editingTemplate.name || "",
        type: editingTemplate.type || "quote",
        tradeType: editingTemplate.tradeType || userCheck?.user?.tradeType || "plumbing",
        familyKey: editingTemplate.familyKey || "",
        styling: editingTemplate.styling || { brandColor: "#2563eb", logoDisplay: true },
        sections: editingTemplate.sections || {
          showHeader: true,
          showLineItems: true,
          showTotals: true,
          showTerms: true,
          showSignature: true,
        },
        defaults: editingTemplate.defaults || {
          title: "",
          description: "",
          terms: "",
          depositPct: 50,
          dueTermDays: 30,
          gstEnabled: true,
        },
        defaultLineItems: editingTemplate.defaultLineItems || [],
      });
    }
  }, [editingTemplate, form, userCheck]);

  const watchedValues = form.watch();

  const handleAddLineItem = () => {
    setEditForm({ description: "", qty: 1, unitPrice: 0, unit: "hour" });
    setEditingLineIndex(-1);
  };

  const handleEditLineItem = (index: number) => {
    const item = watchedValues.defaultLineItems[index];
    setEditForm({
      description: item.description || "",
      qty: item.qty || 1,
      unitPrice: item.unitPrice || 0,
      unit: item.unit || "hour"
    });
    setEditingLineIndex(index);
  };

  const handleSaveLineItem = () => {
    if (!editForm.description.trim()) {
      toast({
        title: "Description required",
        description: "Please enter a description for this item",
        variant: "destructive"
      });
      return;
    }

    if (editingLineIndex === -1) {
      append(editForm);
    } else if (editingLineIndex !== null) {
      update(editingLineIndex, editForm);
    }
    setEditingLineIndex(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const calculateTotal = (qty: number, unitPrice: number) => {
    return qty * unitPrice;
  };

  const subtotal = watchedValues.defaultLineItems?.reduce(
    (sum, item) => sum + calculateTotal(item.qty || 0, item.unitPrice || 0), 
    0
  ) || 0;
  const gst = watchedValues.defaults?.gstEnabled ? subtotal * 0.1 : 0;
  const total = subtotal + gst;

  const handleSubmit = async (data: TemplateFormData) => {
    try {
      const templateData = {
        name: data.name,
        type: data.type,
        familyKey: data.familyKey,
        tradeType: data.tradeType,
        styling: data.styling,
        sections: data.sections,
        defaults: data.defaults,
        defaultLineItems: data.defaultLineItems,
      };

      if (editingTemplate) {
        await updateTemplateMutation.mutateAsync({
          id: editingTemplate.id,
          data: templateData,
        });
        toast({
          title: "Template updated!",
          description: "Your template has been saved successfully",
        });
      } else {
        await createTemplateMutation.mutateAsync(templateData);
        toast({
          title: "Template created!",
          description: "Your template has been saved successfully",
        });
      }

      onSave?.();
    } catch (error) {
      console.error("Error saving template:", error);
      toast({
        title: "Error",
        description: "Failed to save template. Please try again.",
        variant: "destructive",
      });
    }
  };

  const businessInfo = {
    businessName: businessSettings?.businessName || "Your Business Name",
    abn: businessSettings?.abn,
    address: businessSettings?.address,
    phone: businessSettings?.phone,
    email: businessSettings?.email,
    logoUrl: watchedValues.styling?.logoDisplay ? businessSettings?.logoUrl : undefined,
    brandColor: watchedValues.styling?.brandColor || userCheck?.user?.tradeColor,
  };

  const previewLineItems = watchedValues.defaultLineItems?.map(item => ({
    description: item.description || "Sample Item",
    quantity: item.qty || 1,
    unitPrice: item.unitPrice || 0,
  })) || [];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'quote': return FileText;
      case 'invoice': return Receipt;
      case 'job': return Briefcase;
      default: return FileText;
    }
  };

  const TypeIcon = getTypeIcon(watchedValues.type);

  return (
    <div className="h-full flex flex-col">
      <div className="lg:hidden border-b-2 bg-card sticky top-0 z-10 shadow-sm">
        <Tabs value={mobileView} onValueChange={(v) => setMobileView(v as 'edit' | 'preview')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 gap-1 p-1.5 bg-muted/60">
            <TabsTrigger 
              value="edit" 
              className="gap-2 font-semibold rounded-lg data-[state=active]:shadow-md transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </TabsTrigger>
            <TabsTrigger 
              value="preview" 
              className="gap-2 font-semibold rounded-lg data-[state=active]:shadow-md transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 overflow-auto p-4 lg:p-6 ${mobileView === 'preview' ? 'hidden lg:block' : ''}`}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 max-w-xl mx-auto lg:mx-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onCancel}
                  className="rounded-xl"
                  data-testid="button-back"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-xl font-bold">{editingTemplate ? 'Edit Template' : 'New Template'}</h1>
              </div>
              <Badge 
                className="px-3 py-1.5 text-xs font-semibold"
                style={{ 
                  backgroundColor: 'hsl(var(--trade) / 0.1)', 
                  color: 'hsl(var(--trade))',
                  border: 'none'
                }}
              >
                {formatCurrency(total)}
              </Badge>
            </div>

            <Card className="rounded-2xl overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Settings className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                  Basic Info
                </div>
                
                <div>
                  <Label htmlFor="name" className="text-xs text-muted-foreground">Template Name</Label>
                  <Input
                    id="name"
                    {...form.register("name")}
                    placeholder="e.g., Emergency Plumbing Quote"
                    className="h-12 rounded-xl mt-1"
                    data-testid="input-template-name"
                  />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Type</Label>
                    <Select
                      value={watchedValues.type}
                      onValueChange={(value: 'quote' | 'invoice' | 'job') => form.setValue("type", value)}
                    >
                      <SelectTrigger className="h-12 rounded-xl mt-1" data-testid="select-template-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quote">Quote</SelectItem>
                        <SelectItem value="invoice">Invoice</SelectItem>
                        <SelectItem value="job">Job</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Trade Type</Label>
                    <Select
                      value={watchedValues.tradeType}
                      onValueChange={(value) => form.setValue("tradeType", value)}
                    >
                      <SelectTrigger className="h-12 rounded-xl mt-1" data-testid="select-trade-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tradeTypes.map((trade) => (
                          <SelectItem key={trade} value={trade}>
                            {trade.charAt(0).toUpperCase() + trade.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="familyKey" className="text-xs text-muted-foreground">Template Key</Label>
                  <Input
                    id="familyKey"
                    {...form.register("familyKey")}
                    placeholder="e.g., plumbing-emergency"
                    className="h-12 rounded-xl mt-1"
                    data-testid="input-family-key"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <TypeIcon className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                  Default Content
                </div>
                
                <div>
                  <Label htmlFor="title" className="text-xs text-muted-foreground">Default Title</Label>
                  <Input
                    id="title"
                    value={watchedValues.defaults?.title || ""}
                    onChange={(e) => form.setValue("defaults.title", e.target.value)}
                    placeholder="e.g., Emergency Plumbing Services"
                    className="h-12 rounded-xl mt-1"
                    data-testid="input-default-title"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="text-xs text-muted-foreground">Default Description</Label>
                  <Textarea
                    id="description"
                    value={watchedValues.defaults?.description || ""}
                    onChange={(e) => form.setValue("defaults.description", e.target.value)}
                    placeholder="Brief description of the work..."
                    className="rounded-xl mt-1 min-h-[80px]"
                    data-testid="input-default-description"
                  />
                </div>

                <div>
                  <Label htmlFor="terms" className="text-xs text-muted-foreground">Terms & Conditions</Label>
                  <Textarea
                    id="terms"
                    value={watchedValues.defaults?.terms || ""}
                    onChange={(e) => form.setValue("defaults.terms", e.target.value)}
                    placeholder="Payment terms, warranties..."
                    className="rounded-xl mt-1 min-h-[100px]"
                    data-testid="input-terms"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Deposit %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={watchedValues.defaults?.depositPct || 50}
                      onChange={(e) => form.setValue("defaults.depositPct", parseInt(e.target.value) || 50)}
                      className="h-12 rounded-xl mt-1"
                      data-testid="input-deposit-pct"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Due Term (Days)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={watchedValues.defaults?.dueTermDays || 30}
                      onChange={(e) => form.setValue("defaults.dueTermDays", parseInt(e.target.value) || 30)}
                      className="h-12 rounded-xl mt-1"
                      data-testid="input-due-term-days"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <Label className="text-sm">Include GST (10%)</Label>
                  <Switch
                    checked={watchedValues.defaults?.gstEnabled ?? true}
                    onCheckedChange={(checked) => form.setValue("defaults.gstEnabled", checked)}
                    data-testid="switch-gst-enabled"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Palette className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                  Styling
                </div>

                <div className="flex items-center gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Brand Color</Label>
                    <Input
                      type="color"
                      value={watchedValues.styling?.brandColor || "#2563eb"}
                      onChange={(e) => form.setValue("styling.brandColor", e.target.value)}
                      className="w-12 h-12 p-1 rounded-xl mt-1"
                      data-testid="input-brand-color"
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      value={watchedValues.styling?.brandColor || "#2563eb"}
                      onChange={(e) => form.setValue("styling.brandColor", e.target.value)}
                      placeholder="#2563eb"
                      className="h-12 rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <Label className="text-sm">Show Logo on Documents</Label>
                  <Switch
                    checked={watchedValues.styling?.logoDisplay ?? true}
                    onCheckedChange={(checked) => form.setValue("styling.logoDisplay", checked)}
                    data-testid="switch-logo-display"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Package className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                    Default Line Items
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {fields.length} {fields.length === 1 ? 'item' : 'items'}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {fields.map((field, index) => {
                    const item = watchedValues.defaultLineItems[index];
                    const itemTotal = calculateTotal(item?.qty || 0, item?.unitPrice || 0);
                    
                    return (
                      <div 
                        key={field.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover-elevate"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item?.description || 'Untitled'}</p>
                          <p className="text-xs text-muted-foreground">
                            {item?.qty} × {formatCurrency(item?.unitPrice || 0)} / {item?.unit}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">{formatCurrency(itemTotal)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditLineItem(index)}
                            className="h-8 w-8"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(index)}
                            className="h-8 w-8 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {editingLineIndex !== null && (
                  <div className="p-4 rounded-xl border-2 border-dashed space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Description</Label>
                      <Input
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="Service description"
                        className="h-10 rounded-lg mt-1"
                        autoFocus
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Qty</Label>
                        <Input
                          type="number"
                          min="1"
                          value={editForm.qty}
                          onChange={(e) => setEditForm({ ...editForm, qty: parseInt(e.target.value) || 1 })}
                          className="h-10 rounded-lg mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Price</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editForm.unitPrice}
                          onChange={(e) => setEditForm({ ...editForm, unitPrice: parseFloat(e.target.value) || 0 })}
                          className="h-10 rounded-lg mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Unit</Label>
                        <Select
                          value={editForm.unit}
                          onValueChange={(value) => setEditForm({ ...editForm, unit: value })}
                        >
                          <SelectTrigger className="h-10 rounded-lg mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {units.map((unit) => (
                              <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveLineItem}
                        style={{
                          backgroundColor: 'hsl(var(--trade))',
                          color: 'white'
                        }}
                      >
                        Save Item
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingLineIndex(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddLineItem}
                  className="w-full h-12 rounded-xl border-dashed"
                  data-testid="button-add-line-item"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line Item
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-2xl overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ListChecks className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                  Document Sections
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'showHeader', label: 'Header' },
                    { key: 'showLineItems', label: 'Line Items' },
                    { key: 'showTotals', label: 'Totals' },
                    { key: 'showTerms', label: 'Terms' },
                    { key: 'showSignature', label: 'Signature' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <Label className="text-sm">{label}</Label>
                      <Switch
                        checked={(watchedValues.sections as any)?.[key] ?? true}
                        onCheckedChange={(checked) => form.setValue(`sections.${key}` as any, checked)}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3 pb-6">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="flex-1 h-12 rounded-xl"
                data-testid="button-cancel-template"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                className="flex-1 h-12 rounded-xl"
                style={{
                  backgroundColor: 'hsl(var(--trade))',
                  color: 'white'
                }}
                data-testid="button-save-template"
              >
                {editingTemplate ? 'Update Template' : 'Create Template'}
              </Button>
            </div>
          </form>
        </div>

        <div className={`flex-1 border-l bg-muted/30 overflow-auto p-4 lg:p-6 ${mobileView === 'edit' ? 'hidden lg:block' : ''}`}>
          <div className="sticky top-0">
            <div className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Live Preview
            </div>
            {watchedValues.type !== 'job' ? (
              <LiveDocumentPreview
                type={watchedValues.type === 'invoice' ? 'invoice' : 'quote'}
                title={watchedValues.defaults?.title || `New ${watchedValues.type === 'quote' ? 'Quote' : 'Invoice'}`}
                description={watchedValues.defaults?.description}
                lineItems={previewLineItems}
                notes={watchedValues.defaults?.terms}
                terms={watchedValues.defaults?.terms}
                business={businessInfo}
                client={{
                  name: "Sample Client",
                  email: "client@example.com",
                  phone: "0412 345 678",
                  address: "123 Sample Street, Sydney NSW 2000"
                }}
                showDepositSection={watchedValues.type === 'quote' && (watchedValues.defaults?.depositPct || 0) > 0}
                depositPercent={watchedValues.defaults?.depositPct}
                gstEnabled={watchedValues.defaults?.gstEnabled}
              />
            ) : (
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Briefcase className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">What this template fills in on a new job</span>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Job title</p>
                    <p className={watchedValues.defaults?.title ? "font-medium" : "text-muted-foreground italic"}>
                      {watchedValues.defaults?.title || "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Description</p>
                    <p className={watchedValues.defaults?.description ? "whitespace-pre-wrap" : "text-muted-foreground italic"}>
                      {watchedValues.defaults?.description || "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Line items</p>
                    {previewLineItems.length > 0 ? (
                      <ul className="space-y-1">
                        {previewLineItems.map((item, idx) => (
                          <li key={idx} className="flex justify-between gap-2 text-xs bg-muted/50 rounded px-2 py-1.5">
                            <span className="truncate flex-1">{item.description || "Untitled item"}</span>
                            <span className="font-medium whitespace-nowrap">
                              {item.quantity} × ${Number(item.unitPrice || 0).toFixed(2)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground italic">None</p>
                    )}
                  </div>
                  {previewLineItems.length > 0 && (
                    <div className="pt-2 border-t space-y-1">
                      {(() => {
                        const subtotal = previewLineItems.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
                        const gst = watchedValues.defaults?.gstEnabled !== false ? subtotal * 0.1 : 0;
                        return (
                          <>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Subtotal</span>
                              <span>${subtotal.toFixed(2)}</span>
                            </div>
                            {gst > 0 && (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">GST (10%)</span>
                                <span>${gst.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-semibold text-sm pt-1">
                              <span>Estimated total</span>
                              <span className="text-primary">${(subtotal + gst).toFixed(2)}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-2 border-t">
                    {watchedValues.defaults?.gstEnabled !== false && <span>GST auto-calculated</span>}
                    {(watchedValues.defaults?.dueTermDays || 0) > 0 && <span>{watchedValues.defaults?.dueTermDays} day terms</span>}
                    {(watchedValues.defaults?.depositPct || 0) > 0 && <span>{watchedValues.defaults?.depositPct}% deposit</span>}
                    {watchedValues.defaults?.terms && <span>Terms included</span>}
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
