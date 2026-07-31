import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Sparkles, Check, ChevronRight, DollarSign, Clock, FileCheck, Package, Pencil, MousePointerClick } from "lucide-react";
import { useDocumentTemplates, type DocumentTemplate } from "@/hooks/use-templates";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface TemplateSelectorProps {
  type: 'quote' | 'invoice' | 'job';
  onApplyTemplate: (template: DocumentTemplate) => void;
  className?: string;
  userTradeType?: string;
  showValidUntil?: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
}

export default function TemplateSelector({ type, onApplyTemplate, className, userTradeType, showValidUntil }: TemplateSelectorProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  
  const { data: templates = [], isLoading } = useDocumentTemplates(type, userTradeType);
  const { toast } = useToast();

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const calculateTemplateTotal = (template: DocumentTemplate) => {
    if (!template.defaultLineItems?.length) return null;
    const subtotal = template.defaultLineItems.reduce((sum, item) => {
      return sum + (item.qty * item.unitPrice);
    }, 0);
    const gst = template.defaults?.gstEnabled !== false ? subtotal * 0.1 : 0;
    return { subtotal, gst, total: subtotal + gst };
  };

  // Handle template selection - auto-apply when template is selected
  const handleSelectTemplate = (template: DocumentTemplate) => {
    // If clicking the same template, deselect it
    if (selectedTemplateId === template.id) {
      setSelectedTemplateId("");
      return;
    }
    
    // Select and apply the template
    setSelectedTemplateId(template.id);
    onApplyTemplate(template);
    
    toast({
      title: "Template applied",
      description: `"${template.name}" has been applied`,
    });
  };

  const handleApplyTemplate = () => {
    if (!selectedTemplate) {
      toast({
        title: "No template selected",
        description: "Tap a template to select it first",
        variant: "destructive",
      });
      return;
    }

    onApplyTemplate(selectedTemplate);
    
    toast({
      title: "Template applied",
      description: `"${selectedTemplate.name}" has been applied`,
    });
    
    setSelectedTemplateId("");
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4 animate-pulse" />
            <span>Loading templates...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (templates.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No {type} templates available</p>
          <p className="text-xs text-muted-foreground mt-1">
            Templates help you create {type}s faster
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Quick Templates
          </span>
          {userTradeType && (
            <Badge variant="secondary" className="text-xs capitalize">
              {userTradeType}
            </Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Tap a template to see what it includes
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Template Cards */}
        <div className="max-h-[360px] overflow-y-auto -mr-2 pr-2">
          <div className="space-y-2">
            {templates.map(template => {
              const totals = calculateTemplateTotal(template);
              const isSelected = selectedTemplateId === template.id;
              const hasLineItems = template.defaultLineItems?.length > 0;
              const hasDeposit = template.defaults?.depositPct && template.defaults.depositPct > 0;
              
              return (
                <div
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer transition-all",
                    isSelected 
                      ? "border-primary bg-primary/5 ring-1 ring-primary" 
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                  data-testid={`template-card-${template.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm truncate">{template.name}</h4>
                        {isSelected && (
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </div>
                      
                      {/* Quick info badges */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {hasLineItems && (
                          <Badge variant="outline" className="text-[10px] h-5 gap-1">
                            <Package className="h-3 w-3" />
                            {template.defaultLineItems.length} items
                          </Badge>
                        )}
                        {hasDeposit && (
                          <Badge variant="outline" className="text-[10px] h-5 gap-1">
                            <DollarSign className="h-3 w-3" />
                            {template.defaults.depositPct}% deposit
                          </Badge>
                        )}
                        {template.defaults?.dueTermDays && (
                          <Badge variant="outline" className="text-[10px] h-5 gap-1">
                            <Clock className="h-3 w-3" />
                            {template.defaults.dueTermDays} days
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Show estimated total if has line items with actual prices */}
                    {totals && totals.total > 0 && (
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs text-muted-foreground">Est. Total</span>
                        <p className="font-semibold text-sm text-primary">
                          {formatCurrency(totals.total)}
                        </p>
                      </div>
                    )}
                    
                    {(!totals || totals.total === 0) && (
                      <ChevronRight className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        isSelected && "rotate-90"
                      )} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Preview placeholder when nothing selected */}
        {!selectedTemplate && (
          <div className="border border-dashed rounded-lg p-4 text-center">
            <MousePointerClick className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              Tap a template to preview exactly what it fills in
            </p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              Title, description, line items and totals
            </p>
          </div>
        )}

        {/* Detailed Preview Panel */}
        {selectedTemplate && (
          <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">What gets applied:</span>
            </div>
            
            {/* Applied content list */}
            <div className="space-y-2 text-sm">
              {selectedTemplate.defaults?.title && (
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground">Title:</span>{" "}
                    <span className="font-medium">{selectedTemplate.defaults.title}</span>
                  </div>
                </div>
              )}
              
              {selectedTemplate.defaults?.description && (
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground">Description:</span>{" "}
                    <span className="font-medium line-clamp-2">{selectedTemplate.defaults.description}</span>
                  </div>
                </div>
              )}
              
              {selectedTemplate.defaultLineItems?.length > 0 && (
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-muted-foreground">Line items:</span>
                    <ul className="mt-1 space-y-0.5">
                      {selectedTemplate.defaultLineItems.map((item, idx) => (
                        <li key={idx} className="flex justify-between text-xs bg-background/50 rounded px-2 py-1">
                          <span className="truncate flex-1">{item.description}</span>
                          {item.unitPrice > 0 && (
                            <span className="font-medium text-right ml-2">
                              {item.qty} × {formatCurrency(item.unitPrice)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              
              {selectedTemplate.defaults?.terms && (
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground">Terms & conditions included</span>
                  </div>
                </div>
              )}
              
              {selectedTemplate.defaults?.gstEnabled !== false && (
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground">GST (10%) auto-calculated</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Total breakdown - only show if there are actual prices */}
            {calculateTemplateTotal(selectedTemplate) && calculateTemplateTotal(selectedTemplate)!.total > 0 && (
              <div className="pt-2 border-t space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(calculateTemplateTotal(selectedTemplate)!.subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">GST (10%)</span>
                  <span>{formatCurrency(calculateTemplateTotal(selectedTemplate)!.gst)}</span>
                </div>
                <div className="flex justify-between font-semibold text-sm pt-1">
                  <span>Estimated Total</span>
                  <span className="text-primary">{formatCurrency(calculateTemplateTotal(selectedTemplate)!.total)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Manage templates link */}
        <Link
          href={`/templates?tab=quick-templates&type=${type}`}
          className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground pt-1"
          data-testid="link-edit-templates"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit {type} templates
        </Link>
      </CardContent>
    </Card>
  );
}