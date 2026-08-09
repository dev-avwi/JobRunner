import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { apiRequest } from "@/lib/queryClient";
import {
  Search,
  ClipboardCheck,
  Plus,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  Wrench,
  Package,
  FileCheck,
  Trash2,
  Shield,
  Loader2,
  CheckCircle2,
  X,
} from "lucide-react";

interface JobScopeItem {
  id: string;
  label: string;
  category: 'labour' | 'materials' | 'compliance' | 'safety' | 'disposal';
  description?: string;
  defaultQty?: number;
  unit?: string;
  estimatedPrice?: number;
  required?: boolean;
  tags?: string[];
}

interface JobScopeTemplate {
  id: string;
  tradeId: string;
  jobType: string;
  description: string;
  icon?: string;
  estimatedDuration?: string;
  items: JobScopeItem[];
  commonlyMissed?: string[];
}

interface LineItem {
  description: string;
  quantity: string;
  unitPrice: string;
  cost?: string;
}

interface JobScopeChecklistProps {
  onAddItems: (items: LineItem[]) => void;
  currentItems?: LineItem[];
  jobType?: string;
}

const categoryIcons: Record<string, React.ElementType> = {
  labour: Wrench,
  materials: Package,
  compliance: FileCheck,
  safety: Shield,
  disposal: Trash2,
};

const categoryColors: Record<string, string> = {
  labour: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  materials: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  compliance: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  safety: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  disposal: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

export default function JobScopeChecklist({
  onAddItems,
  currentItems = [],
  jobType: initialJobType,
}: JobScopeChecklistProps) {
  const { toast } = useToast();
  const { data: businessSettings } = useBusinessSettings();
  const tradeId = businessSettings?.tradeType || 'general';

  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['labour', 'materials', 'compliance']));
  const [activeTab, setActiveTab] = useState<'templates' | 'checklist' | 'ai'>('templates');
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [aiAdvice, setAiAdvice] = useState<string>("");

  const { data: templates = [], isLoading: templatesLoading } = useQuery<JobScopeTemplate[]>({
    queryKey: [`/api/job-scope-templates?tradeId=${tradeId}`],
  });

  const { data: allTemplates = [] } = useQuery<JobScopeTemplate[]>({
    queryKey: ['/api/job-scope-templates'],
  });

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId) return null;
    return allTemplates.find(t => t.id === selectedTemplateId) || null;
  }, [selectedTemplateId, allTemplates]);

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const query = searchQuery.toLowerCase();
    return allTemplates.filter(t =>
      t.jobType.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) ||
      t.tradeId.toLowerCase().includes(query)
    );
  }, [templates, allTemplates, searchQuery]);

  const groupedItems = useMemo(() => {
    if (!selectedTemplate) return {};
    const groups: Record<string, JobScopeItem[]> = {};
    for (const item of selectedTemplate.items) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [selectedTemplate]);

  const filteredItems = useMemo(() => {
    if (!selectedTemplate) return {};
    if (!searchQuery.trim()) return groupedItems;
    
    const query = searchQuery.toLowerCase();
    const filtered: Record<string, JobScopeItem[]> = {};
    
    for (const [category, items] of Object.entries(groupedItems)) {
      const matchingItems = items.filter(item =>
        item.label.toLowerCase().includes(query) ||
        item.tags?.some(tag => tag.includes(query))
      );
      if (matchingItems.length > 0) {
        filtered[category] = matchingItems;
      }
    }
    return filtered;
  }, [groupedItems, searchQuery]);

  const checkMissingItemsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/quotes/check-missing-items`, {
        jobType: selectedTemplate?.jobType || initialJobType,
        templateId: selectedTemplateId,
        currentItems: currentItems.map(item => ({ description: item.description })),
      });
      return res.json();
    },
    onSuccess: (data) => {
      setAiSuggestions(data.missingItems || []);
      setAiAdvice(data.overallAdvice || "");
      setActiveTab('ai');
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to check for missing items",
        variant: "destructive",
      });
    },
  });

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const selectAllRequired = () => {
    if (!selectedTemplate) return;
    const required = selectedTemplate.items.filter(item => item.required).map(item => item.id);
    setSelectedItems(new Set([...Array.from(selectedItems), ...required]));
  };

  const addSelectedToQuote = () => {
    if (!selectedTemplate) return;
    
    const itemsToAdd: LineItem[] = [];
    for (const itemId of Array.from(selectedItems)) {
      const item = selectedTemplate.items.find(i => i.id === itemId);
      if (item) {
        itemsToAdd.push({
          description: item.label,
          quantity: String(item.defaultQty || 1),
          unitPrice: String(item.estimatedPrice || 0),
        });
      }
    }
    
    if (itemsToAdd.length > 0) {
      onAddItems(itemsToAdd);
      toast({
        title: "Items Added",
        description: `Added ${itemsToAdd.length} items to your quote`,
      });
      setSelectedItems(new Set());
    }
  };

  const addSuggestionToQuote = (suggestion: any) => {
    onAddItems([{
      description: suggestion.label,
      quantity: "1",
      unitPrice: "0",
    }]);
    toast({
      title: "Item Added",
      description: `Added "${suggestion.label}" to your quote`,
    });
    setAiSuggestions(prev => prev.filter(s => s.label !== suggestion.label));
  };

  const renderTemplateSelector = () => (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search job types..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>
      
      <ScrollArea className="h-[400px]">
        <div className="space-y-2 pr-4">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No templates found for "{searchQuery}"</p>
              <p className="text-sm mt-1">Try a different search or check other trades</p>
            </div>
          ) : (
            filteredTemplates.map((template) => (
              <Card
                key={template.id}
                className={`cursor-pointer transition-all hover-elevate ${
                  selectedTemplateId === template.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => {
                  setSelectedTemplateId(template.id);
                  setActiveTab('checklist');
                  setSearchQuery("");
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{template.jobType}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-1">{template.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {template.items.length} items
                        </Badge>
                        {template.estimatedDuration && (
                          <Badge variant="outline" className="text-xs">
                            {template.estimatedDuration}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );

  const renderChecklist = () => {
    if (!selectedTemplate) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No template selected</p>
          <p className="text-sm mt-1">Choose a job type to see the checklist</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => setActiveTab('templates')}
          >
            Browse Templates
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h4 className="font-medium">{selectedTemplate.jobType}</h4>
            <p className="text-sm text-muted-foreground">{selectedTemplate.items.length} items in scope</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={selectAllRequired}>
              Select Required
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                setSelectedTemplateId(null);
                setActiveTab('templates');
              }}
            >
              Change
            </Button>
          </div>
        </div>

        {selectedTemplate.commonlyMissed && selectedTemplate.commonlyMissed.length > 0 && (
          <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950">
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Commonly Missed</p>
                  <p className="text-xs text-orange-700 dark:text-orange-300">
                    {selectedTemplate.commonlyMissed.join(' • ')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <ScrollArea className="h-[320px]">
          <div className="space-y-3 pr-4">
            {Object.entries(filteredItems).map(([category, items]) => {
              const CategoryIcon = categoryIcons[category] || Package;
              const isExpanded = expandedCategories.has(category);
              
              return (
                <Collapsible key={category} open={isExpanded} onOpenChange={() => toggleCategory(category)}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 cursor-pointer hover-elevate">
                      <div className="flex items-center gap-2">
                        <CategoryIcon className="h-4 w-4" />
                        <span className="font-medium capitalize">{category}</span>
                        <Badge variant="secondary" className="text-xs">
                          {items.length}
                        </Badge>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-1 mt-2 pl-2">
                      {items.map((item) => {
                        const isSelected = selectedItems.has(item.id);
                        return (
                          <div
                            key={item.id}
                            className={`flex items-center gap-3 p-2 rounded-md transition-colors cursor-pointer ${
                              isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
                            }`}
                            onClick={() => toggleItem(item.id)}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleItem(item.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm ${item.required ? 'font-medium' : ''}`}>
                                  {item.label}
                                </span>
                                {item.required && (
                                  <Badge variant="destructive" className="text-xs px-1 py-0">
                                    Required
                                  </Badge>
                                )}
                              </div>
                              {item.estimatedPrice !== undefined && item.estimatedPrice > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  ~${item.estimatedPrice.toFixed(2)}
                                  {item.unit && ` / ${item.unit}`}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-muted-foreground">
            {selectedItems.size} items selected
          </span>
          <Button 
            onClick={addSelectedToQuote} 
            disabled={selectedItems.size === 0}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add to Quote
          </Button>
        </div>
      </div>
    );
  };

  const renderAICheck = () => (
    <div className="space-y-4">
      <div className="text-center">
        <Sparkles className="h-10 w-10 mx-auto mb-2 text-primary" />
        <h4 className="font-medium">AI Missing Items Check</h4>
        <p className="text-sm text-muted-foreground mt-1">
          Let AI review your quote for commonly missed items
        </p>
      </div>

      {currentItems.length === 0 && (
        <Card className="border-muted">
          <CardContent className="p-3 text-center">
            <p className="text-sm text-muted-foreground">
              Add some items to your quote first, then AI can check for anything you might have missed
            </p>
          </CardContent>
        </Card>
      )}

      {currentItems.length > 0 && (
        <>
          <Button
            className="w-full"
            onClick={() => checkMissingItemsMutation.mutate()}
            disabled={checkMissingItemsMutation.isPending}
          >
            {checkMissingItemsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Check for Missing Items
              </>
            )}
          </Button>

          {aiSuggestions.length > 0 && (
            <div className="space-y-3">
              {aiAdvice && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-3">
                    <p className="text-sm">{aiAdvice}</p>
                  </CardContent>
                </Card>
              )}
              
              <h5 className="font-medium text-sm">Suggested Items:</h5>
              <ScrollArea className="h-[250px]">
                <div className="space-y-2 pr-4">
                  {aiSuggestions.map((suggestion, index) => (
                    <Card key={index} className="hover-elevate">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{suggestion.label}</span>
                              <Badge 
                                variant={suggestion.priority === 'high' ? 'destructive' : 'secondary'}
                                className="text-xs"
                              >
                                {suggestion.priority}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{suggestion.reason}</p>
                            <Badge variant="outline" className={`text-xs mt-1 ${categoryColors[suggestion.category] || ''}`}>
                              {suggestion.category}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => addSuggestionToQuote(suggestion)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {aiSuggestions.length === 0 && checkMissingItemsMutation.isSuccess && (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-600" />
              <p className="font-medium text-green-700 dark:text-green-400">Looking Good!</p>
              <p className="text-sm text-muted-foreground mt-1">
                No obvious missing items detected
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <ClipboardCheck className="h-4 w-4 mr-2" />
          Job Scope Checklist
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Job Scope Checklist
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="templates">Job Types</TabsTrigger>
              <TabsTrigger value="checklist">Checklist</TabsTrigger>
              <TabsTrigger value="ai">
                <Sparkles className="h-3 w-3 mr-1" />
                AI Check
              </TabsTrigger>
            </TabsList>

            <div className="mt-4">
              <TabsContent value="templates" className="m-0">
                {renderTemplateSelector()}
              </TabsContent>

              <TabsContent value="checklist" className="m-0">
                {renderChecklist()}
              </TabsContent>

              <TabsContent value="ai" className="m-0">
                {renderAICheck()}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
