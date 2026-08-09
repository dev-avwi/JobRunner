import { useState } from "react";
import { getAuthHeaders } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Plus, Edit, Trash2, Copy, FileText, Receipt, Briefcase } from "lucide-react";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { useDocumentTemplates, useDeleteDocumentTemplate } from "@/hooks/use-templates";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import LiveTemplateEditor from "./LiveTemplateEditor";

const tradeTypes = [
  'plumbing', 'electrical', 'carpentry', 'painting', 'hvac', 'roofing', 
  'landscaping', 'tiling', 'flooring', 'renovation', 'handyman'
];

interface TemplateManagementProps {
  embedded?: boolean;
  defaultType?: 'quote' | 'invoice' | 'job';
}

export default function TemplateManagement({ embedded = false, defaultType }: TemplateManagementProps = {}) {
  const [filterType, setFilterType] = useState<string>(defaultType || 'all');
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const { toast } = useToast();

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

  const [filterTradeType, setFilterTradeType] = useState<string>('all');

  const { data: templates = [], isLoading } = useDocumentTemplates(
    filterType === 'all' ? undefined : filterType,
    filterTradeType === 'all' ? undefined : filterTradeType
  );

  const deleteTemplateMutation = useDeleteDocumentTemplate();

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await deleteTemplateMutation.mutateAsync(templateId);
      toast({
        title: "Template Deleted",
        description: "The template has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete template. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditTemplate = (template: any) => {
    setEditingTemplate(template);
    setIsEditorOpen(true);
  };

  const handleDuplicateTemplate = (template: any) => {
    setEditingTemplate({
      ...template,
      id: undefined,
      name: `${template.name} (Copy)`,
      familyKey: `${template.familyKey}-copy`,
    });
    setIsEditorOpen(true);
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setIsEditorOpen(true);
  };

  const handleEditorClose = () => {
    setIsEditorOpen(false);
    setEditingTemplate(null);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'quote': return FileText;
      case 'invoice': return Receipt;
      case 'job': return Briefcase;
      default: return FileText;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'quote': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'invoice': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'job': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (isLoading) {
    const spinner = (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
    return embedded ? spinner : <PageShell>{spinner}</PageShell>;
  }

  const Wrapper = embedded ? 'div' : PageShell;

  return (
    <Wrapper data-testid="page-template-management">
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold">Quick Templates</h2>
            <p className="text-sm text-muted-foreground">
              Pre-built templates for quotes, invoices, and jobs
            </p>
          </div>
          <Button 
            onClick={handleCreateTemplate}
            data-testid="button-create-template"
            style={{
              backgroundColor: 'hsl(var(--trade))',
              borderColor: 'hsl(var(--trade-border))',
              color: 'white'
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>
      ) : (
        <PageHeader
          title="Templates"
          subtitle="Pre-built templates for quotes, invoices, and jobs"
          action={
            <Button 
              onClick={handleCreateTemplate}
              data-testid="button-create-template"
              style={{
                backgroundColor: 'hsl(var(--trade))',
                borderColor: 'hsl(var(--trade-border))',
                color: 'white'
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          }
        />
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[140px]" data-testid="select-filter-type">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="quote">Quotes</SelectItem>
            <SelectItem value="invoice">Invoices</SelectItem>
            <SelectItem value="job">Jobs</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterTradeType} onValueChange={setFilterTradeType}>
          <SelectTrigger className="w-[160px]" data-testid="select-filter-trade">
            <SelectValue placeholder="Filter by trade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Trades</SelectItem>
            {tradeTypes.map((trade) => (
              <SelectItem key={trade} value={trade}>
                {trade.charAt(0).toUpperCase() + trade.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {templates.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Templates Found</h3>
            <p className="text-muted-foreground mb-4">
              Create your first template to get started with quotes, invoices, and jobs.
            </p>
            <Button 
              onClick={handleCreateTemplate}
              style={{
                backgroundColor: 'hsl(var(--trade))',
                borderColor: 'hsl(var(--trade-border))',
                color: 'white'
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template: any) => {
            const TypeIcon = getTypeIcon(template.type);
            return (
              <Card key={template.id} className="rounded-2xl hover-elevate">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div 
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
                      >
                        <TypeIcon className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                      </div>
                      <CardTitle className="text-base truncate">{template.name}</CardTitle>
                    </div>
                    <Badge className={`${getTypeBadgeColor(template.type)} shrink-0`}>
                      {template.type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-xs">
                      {template.tradeType}
                    </Badge>
                    {template.defaultLineItems?.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {template.defaultLineItems.length} items
                      </Badge>
                    )}
                  </div>
                  
                  {template.defaults?.title && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {template.defaults.title}
                    </p>
                  )}

                  <div className="flex items-center gap-1 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditTemplate(template)}
                      data-testid={`button-edit-template-${template.id}`}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDuplicateTemplate(template)}
                      data-testid={`button-duplicate-template-${template.id}`}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-delete-template-${template.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Template</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{template.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[100vw] lg:max-w-[90vw] p-0 overflow-hidden">
          <LiveTemplateEditor
            editingTemplate={editingTemplate}
            onSave={handleEditorClose}
            onCancel={handleEditorClose}
          />
        </SheetContent>
      </Sheet>
    </Wrapper>
  );
}
