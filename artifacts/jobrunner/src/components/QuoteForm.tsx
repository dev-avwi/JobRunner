import { useState } from "react";
import { getAuthHeaders } from "@/lib/queryClient";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { WizardLayout, WIZARD_ICONS } from "@/components/FormWizard";
import ClientStep from "@/components/wizard-steps/ClientStep";
import DetailsStep from "@/components/wizard-steps/DetailsStep";
import LineItemsStep from "@/components/wizard-steps/LineItemsStep";
import ReviewStep from "@/components/wizard-steps/ReviewStep";
import { MultiOptionQuoteEditor } from "@/components/MultiOptionQuoteEditor";
import { useCreateQuote } from "@/hooks/use-quotes";
import { useToast } from "@/hooks/use-toast";
import { type DocumentTemplate } from "@/hooks/use-templates";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { useFeatureAccess } from "@/hooks/use-subscription";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Layers } from "lucide-react";

const quoteFormSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  jobId: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  validUntil: z.string().min(1, "Valid until date is required"),
  notes: z.string().optional(),
  lineItems: z.array(z.object({
    description: z.string().min(1, "Description is required"),
    quantity: z.string().min(1, "Quantity is required"),
    unitPrice: z.string().min(1, "Unit price is required"),
  })).min(1, "At least one line item is required"),
});

type QuoteFormData = z.infer<typeof quoteFormSchema>;

interface QuoteFormProps {
  onSubmit?: (quoteId: string) => void;
  onCancel?: () => void;
}

const WIZARD_STEPS = [
  {
    id: "client",
    title: "Select Client",
    description: "Who is this quote for?",
    icon: WIZARD_ICONS.client,
    validationFields: ["clientId"]
  },
  {
    id: "details",
    title: "Quote Details",
    description: "Add title and description",
    icon: WIZARD_ICONS.details,
    validationFields: ["title", "validUntil"]
  },
  {
    id: "items",
    title: "Add Items",
    description: "What are you quoting for?",
    icon: WIZARD_ICONS.items,
    validationFields: ["lineItems"]
  },
  {
    id: "review",
    title: "Review & Create",
    description: "Check everything looks good",
    icon: WIZARD_ICONS.review,
    validationFields: []
  }
];

// Define option types for multi-option quotes
interface QuoteOption {
  id?: string;
  name: string;
  description?: string;
  items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  subtotal: number;
  gstAmount: number;
  total: number;
  isRecommended: boolean;
  sortOrder: number;
}

export default function QuoteForm({ onSubmit, onCancel }: QuoteFormProps) {
  const { toast } = useToast();
  const { canUseAIFeatures } = useFeatureAccess();
  const createQuoteMutation = useCreateQuote();
  const [isMultiOptionMode, setIsMultiOptionMode] = useState(false);
  const [quoteOptions, setQuoteOptions] = useState<QuoteOption[]>([]);

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

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      clientId: "",
      jobId: "",
      title: "",
      description: "",
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: "",
      lineItems: [{ description: "", quantity: "1", unitPrice: "" }],
    },
  });

  const calculateTotal = () => {
    const lineItems = form.watch("lineItems") || [];
    const subtotal = lineItems.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      return sum + (quantity * unitPrice);
    }, 0);
    const gst = subtotal * 0.1;
    return { subtotal, gst, total: subtotal + gst };
  };

  const handleApplyTemplate = (template: DocumentTemplate) => {
    try {
      const defaults = template.defaults || {};
      const defaultLineItems = template.defaultLineItems || [];
      const currentValues = form.getValues();
      
      // Build new values object
      const newValues = {
        ...currentValues,
        title: defaults.title || currentValues.title,
        description: defaults.description || currentValues.description,
        lineItems: defaultLineItems.length > 0 
          ? defaultLineItems.map((item) => ({
              description: item.description || "",
              quantity: String(item.qty || 1),
              unitPrice: String(item.unitPrice || ""),
            }))
          : currentValues.lineItems,
      };
      
      // Use form.reset() to ensure form state and UI are in sync
      form.reset(newValues, { keepDirty: false });
    } catch (error) {
      toast({
        title: "Error applying template",
        description: "There was an issue applying the template data",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (data: QuoteFormData) => {
    try {
      const { subtotal, gst, total } = calculateTotal();
      
      const quoteData = {
        ...data,
        subtotal: subtotal.toFixed(2),
        gstAmount: gst.toFixed(2),
        total: total.toFixed(2),
      };

      const result = await createQuoteMutation.mutateAsync(quoteData);
      
      toast({
        title: "Quote created",
        description: "Quote has been created successfully",
      });
      
      if (onSubmit) onSubmit(result.id);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create quote",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Handle saving multi-option quote options
  const handleSaveOptions = (options: QuoteOption[]) => {
    setQuoteOptions(options);
    // Convert options to line items for the form (use recommended option or first)
    const recommendedOption = options.find(o => o.isRecommended) || options[0];
    if (recommendedOption && recommendedOption.items.length > 0) {
      const lineItems = recommendedOption.items.map(item => ({
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice)
      }));
      form.setValue("lineItems", lineItems);
    }
  };

  // Custom steps based on mode
  const getActiveSteps = () => {
    if (isMultiOptionMode) {
      return [
        WIZARD_STEPS[0], // Client
        WIZARD_STEPS[1], // Details
        { 
          id: "options",
          title: "Quote Options",
          description: "Create multiple pricing options",
          icon: WIZARD_ICONS.items,
          validationFields: []
        },
        WIZARD_STEPS[3] // Review
      ];
    }
    return WIZARD_STEPS;
  };

  return (
    <div className="w-full py-4" data-testid="page-quote-form">
      <FormProvider {...form}>
        <WizardLayout
          steps={getActiveSteps()}
          form={form}
          onSubmit={handleSubmit}
          onCancel={onCancel}
          submitLabel="Create Quote"
        >
          <ClientStep fieldName="clientId" />
          
          <div className="space-y-6">
            <DetailsStep 
              type="quote"
              userTradeType={userCheck?.tradeType}
              onApplyTemplate={handleApplyTemplate}
              showValidUntil={true}
            />
            
            {/* AI Multi-Option Mode Toggle */}
            {canUseAIFeatures && (
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI Multi-Option Quote
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="multi-option-mode" className="text-sm font-medium">
                      Enable multiple pricing options
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Let customers choose between Good, Better, Best packages
                    </p>
                  </div>
                  <Switch
                    id="multi-option-mode"
                    checked={isMultiOptionMode}
                    onCheckedChange={setIsMultiOptionMode}
                    data-testid="switch-multi-option-mode"
                  />
                </div>
              </CardContent>
            </Card>
            )}
          </div>
          
          {/* Line Items or Multi-Option Editor based on mode */}
          {isMultiOptionMode ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Layers className="h-4 w-4" />
                <span>Create pricing tiers for your customer to choose from</span>
              </div>
              <MultiOptionQuoteEditor 
                onSave={handleSaveOptions}
                initialOptions={quoteOptions.length > 0 ? quoteOptions : undefined}
                className="border rounded-lg"
              />
            </div>
          ) : (
            <LineItemsStep tradeType={userCheck?.tradeType} />
          )}
          
          <ReviewStep type="quote" showNotes={true} />
        </WizardLayout>
      </FormProvider>
    </div>
  );
}
