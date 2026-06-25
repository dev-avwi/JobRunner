import { useForm, FormProvider } from "react-hook-form";
import { getAuthHeaders } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { WizardLayout, WIZARD_ICONS } from "@/components/FormWizard";
import ClientStep from "@/components/wizard-steps/ClientStep";
import DetailsStep from "@/components/wizard-steps/DetailsStep";
import LineItemsStep from "@/components/wizard-steps/LineItemsStep";
import ReviewStep from "@/components/wizard-steps/ReviewStep";
import { useCreateInvoice } from "@/hooks/use-invoices";
import { useToast } from "@/hooks/use-toast";
import { type DocumentTemplate } from "@/hooks/use-templates";
import { useQuery } from "@tanstack/react-query";

const invoiceFormSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  jobId: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z.array(z.object({
    description: z.string().min(1, "Description is required"),
    quantity: z.string().min(1, "Quantity is required"),
    unitPrice: z.string().min(1, "Unit price is required"),
  })).min(1, "At least one line item is required"),
});

type InvoiceFormData = z.infer<typeof invoiceFormSchema>;

interface InvoiceFormProps {
  onSubmit?: (invoiceId: string) => void;
  onCancel?: () => void;
}

const WIZARD_STEPS = [
  {
    id: "client",
    title: "Select Client",
    description: "Who is this invoice for?",
    icon: WIZARD_ICONS.client,
    validationFields: ["clientId"]
  },
  {
    id: "details",
    title: "Invoice Details",
    description: "Add title and due date",
    icon: WIZARD_ICONS.details,
    validationFields: ["title"]
  },
  {
    id: "items",
    title: "Add Items",
    description: "What are you charging for?",
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

export default function InvoiceForm({ onSubmit, onCancel }: InvoiceFormProps) {
  const { toast } = useToast();
  const createInvoiceMutation = useCreateInvoice();

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

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      clientId: "",
      jobId: "",
      title: "",
      description: "",
      dueDate: "",
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
        notes: defaults.terms || currentValues.notes,
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

  const handleSubmit = async (data: InvoiceFormData) => {
    try {
      const { subtotal, gst, total } = calculateTotal();
      
      const invoiceData = {
        ...data,
        subtotal: subtotal.toFixed(2),
        gstAmount: gst.toFixed(2),
        total: total.toFixed(2),
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
        lineItems: data.lineItems.map((item, index) => ({
          ...item,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
          total: ((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)).toFixed(2),
          sortOrder: index + 1,
        })),
      };

      const result = await createInvoiceMutation.mutateAsync(invoiceData);
      
      toast({
        title: "Invoice created",
        description: `Invoice ${result.number} has been created successfully`,
      });
      
      if (onSubmit) onSubmit(result.id);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create invoice",
        variant: "destructive",
      });
      throw error;
    }
  };

  return (
    <div className="w-full py-4" data-testid="page-invoice-form">
      <FormProvider {...form}>
        <WizardLayout
          steps={WIZARD_STEPS}
          form={form}
          onSubmit={handleSubmit}
          onCancel={onCancel}
          submitLabel="Create Invoice"
        >
          <ClientStep fieldName="clientId" />
          
          <DetailsStep 
            type="invoice"
            userTradeType={userCheck?.tradeType}
            onApplyTemplate={handleApplyTemplate}
            showDueDate={true}
          />
          
          <LineItemsStep tradeType={userCheck?.tradeType} />
          
          <ReviewStep type="invoice" showNotes={true} />
        </WizardLayout>
      </FormProvider>
    </div>
  );
}
