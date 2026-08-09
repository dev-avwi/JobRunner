import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  ClipboardCheck,
  Plus,
  ChevronRight,
  Loader2,
} from "lucide-react";
import type { QuoteTemplate } from "@shared/schema";

interface LineItem {
  description: string;
  quantity: string;
  unitPrice: string;
}

interface QuoteTemplatePickerProps {
  onApplyTemplate: (items: LineItem[]) => void;
}

export function QuoteTemplatePicker({ onApplyTemplate }: QuoteTemplatePickerProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<QuoteTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery<QuoteTemplate[]>({
    queryKey: ["/api/quote-templates"],
  });

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const q = searchQuery.toLowerCase();
    return templates.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.tradeType?.toLowerCase().includes(q)
    );
  }, [templates, searchQuery]);

  const groupedTemplates = useMemo(() => {
    return filteredTemplates.reduce<Record<string, QuoteTemplate[]>>((acc, t) => {
      const trade = t.tradeType || 'general';
      if (!acc[trade]) acc[trade] = [];
      acc[trade].push(t);
      return acc;
    }, {});
  }, [filteredTemplates]);

  const handleApply = () => {
    if (!selectedTemplate) return;
    const items = Array.isArray(selectedTemplate.items) ? (selectedTemplate.items as any[]) : [];
    const lineItems: LineItem[] = items
      .filter((item: any) => item.description || item.label)
      .map((item: any) => ({
        description: item.description || item.label || "",
        quantity: String(item.quantity || item.qty || item.defaultQty || 1),
        unitPrice: String(item.unitPrice || item.estimatedPrice || item.price || 0),
      }));

    if (lineItems.length > 0) {
      onApplyTemplate(lineItems);
      toast({
        title: "Template Applied",
        description: `Added ${lineItems.length} items from "${selectedTemplate.name}"`,
      });
      setOpen(false);
      setSelectedTemplate(null);
      setSearchQuery("");
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <ClipboardCheck className="h-4 w-4 mr-2" />
          Quote Templates
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Quote Templates
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : selectedTemplate ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="font-medium">{selectedTemplate.name}</h4>
                  {selectedTemplate.description && (
                    <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedTemplate(null)}
                >
                  Change
                </Button>
              </div>

              <ScrollArea className="h-[350px]">
                <div className="space-y-1 pr-4">
                  {(Array.isArray(selectedTemplate.items) ? selectedTemplate.items as any[] : []).map((item: any, index: number) => (
                    <div key={index} className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/50 text-sm">
                      <span className="flex-1 min-w-0 truncate">{item.description || item.label}</span>
                      <div className="flex items-center gap-3 shrink-0 text-muted-foreground">
                        <span>x{item.quantity || item.qty || item.defaultQty || 1}</span>
                        {parseFloat(item.unitPrice || item.estimatedPrice || item.price || 0) > 0 && (
                          <span>${parseFloat(item.unitPrice || item.estimatedPrice || item.price || 0).toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="pt-2 border-t">
                <Button onClick={handleApply} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Apply {(Array.isArray(selectedTemplate.items) ? (selectedTemplate.items as any[]).length : 0)} Items to Quote
                </Button>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[420px]">
              <div className="space-y-4 pr-4">
                {Object.keys(groupedTemplates).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ClipboardCheck className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">No templates found</p>
                    <p className="text-sm mt-1">Create templates in the Templates Hub</p>
                  </div>
                ) : (
                  Object.entries(groupedTemplates).map(([tradeType, tradeTemplates]) => (
                    <div key={tradeType}>
                      <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 capitalize">{tradeType}</p>
                      <div className="space-y-1">
                        {tradeTemplates.map((template) => {
                          const items = Array.isArray(template.items) ? template.items as any[] : [];
                          return (
                            <div
                              key={template.id}
                              className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover-elevate bg-muted/30"
                              onClick={() => setSelectedTemplate(template)}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{template.name}</p>
                                <Badge variant="outline" className="text-xs mt-1">{items.length} items</Badge>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
