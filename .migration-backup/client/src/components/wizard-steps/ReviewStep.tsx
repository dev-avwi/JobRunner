import { useFormContext } from "react-hook-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  User, 
  Calendar, 
  FileText, 
  Package, 
  AlertCircle,
  CheckCircle2,
  Building2
} from "lucide-react";
import { useClients } from "@/hooks/use-clients";
import { useJobs } from "@/hooks/use-jobs";

interface ReviewStepProps {
  type: "quote" | "invoice";
  showNotes?: boolean;
}

export default function ReviewStep({ type, showNotes = true }: ReviewStepProps) {
  const form = useFormContext();
  const { data: clients = [] } = useClients();
  const { data: jobs = [] } = useJobs();
  
  const formData = form.watch();
  
  const selectedClient = (clients as any[]).find(c => c.id === formData.clientId);
  const selectedJob = formData.jobId 
    ? (jobs as any[]).find(j => j.id === formData.jobId) 
    : null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const calculateTotal = (quantity: string | number, unitPrice: string | number) => {
    return (parseFloat(String(quantity)) || 0) * (parseFloat(String(unitPrice)) || 0);
  };

  const lineItems = formData.lineItems || [];
  const subtotal = lineItems.reduce((sum: number, item: any) => 
    sum + calculateTotal(item.quantity, item.unitPrice), 0
  );
  const gst = subtotal * 0.1;
  const total = subtotal + gst;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Not set";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-AU', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const hasErrors = Object.keys(form.formState.errors).length > 0;

  return (
    <div className="space-y-4">
      {hasErrors && (
        <Card 
          className="overflow-hidden border-destructive"
          style={{ borderRadius: '14px', backgroundColor: 'hsl(var(--destructive) / 0.1)' }}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
            <div>
              <p className="font-medium text-destructive">Please fix the errors above</p>
              <p className="text-sm text-muted-foreground">Some required fields are missing</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden" style={{ borderRadius: '16px' }}>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="font-semibold">Review {type === "quote" ? "Quote" : "Invoice"}</span>
          </div>

          <div className="flex items-start gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
            >
              {selectedClient?.businessName ? (
                <Building2 className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              ) : (
                <User className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground">Client</Label>
              <p className="font-medium truncate">
                {selectedClient?.name || "No client selected"}
              </p>
              {selectedClient?.businessName && (
                <p className="text-sm text-muted-foreground truncate">
                  {selectedClient.businessName}
                </p>
              )}
            </div>
          </div>

          <Separator />

          <div className="flex items-start gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'hsl(var(--muted))' }}
            >
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground">Title</Label>
              <p className="font-medium">{formData.title || "Untitled"}</p>
              {formData.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                  {formData.description}
                </p>
              )}
            </div>
          </div>

          {(formData.validUntil || formData.dueDate) && (
            <>
              <Separator />
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'hsl(var(--muted))' }}
                >
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {type === "quote" ? "Valid Until" : "Due Date"}
                  </Label>
                  <p className="font-medium">
                    {formatDate(formData.validUntil || formData.dueDate)}
                  </p>
                </div>
              </div>
            </>
          )}

          {selectedJob && (
            <>
              <Separator />
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'hsl(var(--muted))' }}
                >
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Linked Job</Label>
                  <p className="font-medium">{selectedJob.title}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden" style={{ borderRadius: '16px' }}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold">Line Items</span>
            <Badge variant="outline">{lineItems.length} items</Badge>
          </div>
          
          <div className="space-y-3">
            {lineItems.map((item: any, index: number) => {
              const lineTotal = calculateTotal(item.quantity, item.unitPrice);
              return (
                <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="font-medium text-sm truncate">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} x {formatCurrency(parseFloat(String(item.unitPrice)) || 0)}
                    </p>
                  </div>
                  <span className="font-medium text-sm whitespace-nowrap">
                    {formatCurrency(lineTotal)}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card 
        className="overflow-hidden"
        style={{ 
          borderRadius: '16px',
          backgroundColor: 'hsl(var(--trade) / 0.05)',
          borderColor: 'hsl(var(--trade) / 0.2)'
        }}
      >
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">GST (10%)</span>
            <span className="font-medium">{formatCurrency(gst)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between">
            <span className="font-bold text-lg">Total</span>
            <span className="font-bold text-lg" style={{ color: 'hsl(var(--trade))' }}>
              {formatCurrency(total)}
            </span>
          </div>
        </CardContent>
      </Card>

      {showNotes && (
        <Card className="overflow-hidden" style={{ borderRadius: '16px' }}>
          <CardContent className="p-4">
            <Label className="text-sm font-medium mb-2 block">
              Notes & Terms (Optional)
            </Label>
            <Textarea
              placeholder="Add any additional notes, terms, or conditions..."
              className="min-h-[80px]"
              style={{ borderRadius: '10px' }}
              {...form.register("notes")}
              data-testid="input-notes"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
