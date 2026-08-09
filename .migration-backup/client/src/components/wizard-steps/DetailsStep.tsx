import JobPicker from "@/components/JobPicker";
import { useFormContext } from "react-hook-form";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Calendar, Sparkles, Briefcase, ChevronRight } from "lucide-react";
import { useJobs } from "@/hooks/use-jobs";
import TemplateSelector from "@/components/TemplateSelector";
import { useDocumentTemplates, type DocumentTemplate } from "@/hooks/use-templates";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";

interface DetailsStepProps {
  type: "quote" | "invoice";
  userTradeType?: string;
  onApplyTemplate?: (template: DocumentTemplate) => void;
  showJobSelector?: boolean;
  showValidUntil?: boolean;
  showDueDate?: boolean;
}

export default function DetailsStep({ 
  type,
  userTradeType,
  onApplyTemplate,
  showJobSelector = true,
  showValidUntil = false,
  showDueDate = false
}: DetailsStepProps) {
  const form = useFormContext();
  const { data: jobs = [] } = useJobs();
  const { toast } = useToast();
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false);
  const [appliedTemplateId, setAppliedTemplateId] = useState<string>("");

  const { data: allTemplates = [] } = useDocumentTemplates(type, userTradeType);
  const tradeMatchedTemplates = allTemplates
    .filter(t => userTradeType && t.tradeType === userTradeType);
  const suggestedTemplates = tradeMatchedTemplates.length > 0
    ? tradeMatchedTemplates.slice(0, 3)
    : allTemplates.filter(t => !t.tradeType || t.tradeType === 'general').slice(0, 3);

  const handleApplyTemplate = (template: DocumentTemplate) => {
    if (onApplyTemplate) {
      onApplyTemplate(template);
    }
    setAppliedTemplateId(template.id);
    setTemplateSheetOpen(false);
  };

  const handleApplySuggested = (template: DocumentTemplate) => {
    if (onApplyTemplate) {
      onApplyTemplate(template);
    }
    setAppliedTemplateId(template.id);
    toast({ title: "Template applied", description: `"${template.name}" has been applied` });
  };

  const formatPrice = (items: DocumentTemplate['defaultLineItems']) => {
    if (!items?.length) return null;
    const subtotal = items.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);
    return subtotal > 0 ? `$${subtotal.toFixed(0)}` : null;
  };

  return (
    <div className="space-y-4">
      {suggestedTemplates.length > 0 && (
        <div className="space-y-2" data-testid="suggested-templates">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Suggested for your trade</p>
          <div className="grid gap-2">
            {suggestedTemplates.map((template) => {
              const price = formatPrice(template.defaultLineItems);
              const isApplied = appliedTemplateId === template.id;
              return (
                <Button
                  key={template.id}
                  type="button"
                  variant={isApplied ? "default" : "outline"}
                  className="w-full justify-between gap-2 text-sm min-h-[44px]"
                  onClick={() => handleApplySuggested(template)}
                  data-testid={`suggested-template-${template.familyKey}`}
                >
                  <div className="flex items-center gap-2 text-left min-w-0">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: isApplied ? undefined : 'hsl(var(--trade))' }} />
                    <span className="truncate">{template.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {price && <Badge variant="secondary" className="text-xs">{price}</Badge>}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <Sheet open={templateSheetOpen} onOpenChange={setTemplateSheetOpen}>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full min-h-[56px] justify-start gap-3"
            style={{ borderRadius: '12px' }}
            data-testid="button-use-template"
          >
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
            >
              <Sparkles className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
            </div>
            <div className="text-left">
              <div className="font-medium">{suggestedTemplates.length > 0 ? 'Browse All Templates' : 'Use a Template'}</div>
              <div className="text-sm text-muted-foreground">Quickly fill in common {type}s</div>
            </div>
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[80vh] pb-8 z-[60]">
          <SheetHeader className="mb-4">
            <SheetTitle>Choose a Template</SheetTitle>
          </SheetHeader>
          <div className="overflow-auto h-[calc(80vh-80px)]">
            <TemplateSelector
              type={type}
              onApplyTemplate={handleApplyTemplate}
              userTradeType={userTradeType}
              data-testid={`template-selector-${type}`}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Card className="overflow-hidden" style={{ borderRadius: '16px' }}>
        <CardContent className="p-4 space-y-4">
          <div>
            <Label htmlFor="title" className="text-sm font-medium mb-2 block">
              <FileText className="h-4 w-4 inline mr-2" />
              {type === "quote" ? "Quote" : "Invoice"} Title
            </Label>
            <Input
              id="title"
              placeholder={`Enter ${type} title`}
              className="min-h-[48px]"
              style={{ borderRadius: '10px' }}
              {...form.register("title")}
              data-testid="input-title"
            />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive mt-1">
                {String(form.formState.errors.title.message)}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="description" className="text-sm font-medium mb-2 block">
              Description (Optional)
            </Label>
            <Textarea
              id="description"
              placeholder="Add a description..."
              className="min-h-[100px]"
              style={{ borderRadius: '10px' }}
              {...form.register("description")}
              data-testid="input-description"
            />
          </div>

          {showJobSelector && (
            <div>
              <Label className="text-sm font-medium mb-2 flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Link to Job (Optional)
              </Label>
              <JobPicker
                value={form.watch("jobId") || ""}
                onChange={(jobId) => form.setValue("jobId", jobId)}
                label={null}
              />
            </div>
          )}

          {showValidUntil && (
            <div>
              <Label htmlFor="validUntil" className="text-sm font-medium mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Valid Until
              </Label>
              <Input
                id="validUntil"
                type="date"
                className="min-h-[48px]"
                style={{ borderRadius: '10px' }}
                {...form.register("validUntil")}
                data-testid="input-valid-until"
              />
              {form.formState.errors.validUntil && (
                <p className="text-sm text-destructive mt-1">
                  {String(form.formState.errors.validUntil.message)}
                </p>
              )}
            </div>
          )}

          {showDueDate && (
            <div>
              <Label htmlFor="dueDate" className="text-sm font-medium mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Due Date (Optional)
              </Label>
              <Input
                id="dueDate"
                type="date"
                className="min-h-[48px]"
                style={{ borderRadius: '10px' }}
                {...form.register("dueDate")}
                data-testid="input-due-date"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
