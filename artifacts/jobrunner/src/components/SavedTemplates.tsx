import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Check, Trash2, Star, FileText, Upload, Palette } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DocumentTemplate } from "@shared/schema";

interface SavedTemplatesProps {
  currentDefaultId?: string;
  onSetDefault?: (templateId: string) => void;
  onDelete?: (templateId: string) => void;
}

export function SavedTemplates({ 
  currentDefaultId, 
  onSetDefault, 
  onDelete 
}: SavedTemplatesProps) {
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: templates, isLoading } = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/templates"],
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await apiRequest("PATCH", `/api/templates/${templateId}/set-default`);
      return response.json();
    },
    onSuccess: (_, templateId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] });
      toast({
        title: "Default template set",
        description: "This template will now be used for new documents.",
      });
      onSetDefault?.(templateId);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to set default",
        description: error.message || "Could not set this template as default.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      await apiRequest("DELETE", `/api/templates/${templateId}`);
      return templateId;
    },
    onSuccess: (templateId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template deleted",
        description: "The template has been removed.",
      });
      onDelete?.(templateId);
      setDeletingId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete",
        description: error.message || "Could not delete this template.",
        variant: "destructive",
      });
      setDeletingId(null);
    },
  });

  const handleSetDefault = (templateId: string) => {
    setDefaultMutation.mutate(templateId);
  };

  const handleDelete = (templateId: string) => {
    setDeletingId(templateId);
    deleteMutation.mutate(templateId);
  };

  const getStyling = (template: DocumentTemplate): { brandColors?: { primary?: string; secondary?: string }; logoPosition?: string } => {
    return (template.styling as any) || {};
  };

  const getSections = (template: DocumentTemplate): { 
    showHeader?: boolean; 
    showLineItems?: boolean; 
    showTotals?: boolean; 
    showTerms?: boolean; 
    showSignature?: boolean 
  } => {
    return (template.sections as any) || {};
  };

  const getDetectedSections = (template: DocumentTemplate): string[] => {
    const sections = getSections(template);
    const detected: string[] = [];
    if (sections.showHeader) detected.push("Header");
    if (sections.showLineItems) detected.push("Line Items");
    if (sections.showTotals) detected.push("Totals");
    if (sections.showTerms) detected.push("Terms");
    if (sections.showSignature) detected.push("Signature");
    return detected;
  };

  if (isLoading) {
    return (
      <Card data-testid="saved-templates-container">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Your Custom Templates
          </CardTitle>
          <CardDescription>
            Templates you've created from uploaded PDFs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-32 w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!templates || templates.length === 0) {
    return (
      <Card data-testid="saved-templates-container">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Your Custom Templates
          </CardTitle>
          <CardDescription>
            Templates you've created from uploaded PDFs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            <p 
              className="text-muted-foreground"
              data-testid="text-no-templates"
            >
              No custom templates yet. Upload a PDF to create one!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="saved-templates-container">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Your Custom Templates
        </CardTitle>
        <CardDescription>
          Templates you've created from uploaded PDFs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => {
            const isDefault = template.id === currentDefaultId;
            const styling = getStyling(template);
            const detectedSections = getDetectedSections(template);
            const isDeleting = deletingId === template.id;

            return (
              <div
                key={template.id}
                data-testid={`template-card-${template.id}`}
                className="relative rounded-lg border p-4 space-y-3 bg-card hover-elevate transition-all"
              >
                {isDefault && (
                  <Badge 
                    data-testid="badge-default-template"
                    className="absolute top-2 right-2"
                    variant="default"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Default
                  </Badge>
                )}

                <div className="space-y-1">
                  <h4 className="font-medium truncate pr-16">{template.name}</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {template.type}
                    </Badge>
                    {template.tradeType && (
                      <Badge variant="secondary" className="text-xs capitalize">
                        {template.tradeType}
                      </Badge>
                    )}
                  </div>
                </div>

                {styling.brandColors?.primary && (
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    <div className="flex items-center gap-1">
                      <div
                        className="w-5 h-5 rounded border"
                        style={{ backgroundColor: styling.brandColors.primary }}
                        title={`Primary: ${styling.brandColors.primary}`}
                      />
                      {styling.brandColors.secondary && (
                        <div
                          className="w-5 h-5 rounded border"
                          style={{ backgroundColor: styling.brandColors.secondary }}
                          title={`Secondary: ${styling.brandColors.secondary}`}
                        />
                      )}
                    </div>
                  </div>
                )}

                {detectedSections.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {detectedSections.map((section) => (
                      <Badge 
                        key={section} 
                        variant="secondary" 
                        className="text-xs"
                      >
                        {section}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  {!isDefault && (
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`button-set-default-${template.id}`}
                      onClick={() => handleSetDefault(template.id)}
                      disabled={setDefaultMutation.isPending}
                    >
                      <Star className="h-3 w-3 mr-1" />
                      Set Default
                    </Button>
                  )}
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        data-testid={`button-delete-template-${template.id}`}
                        className="text-destructive hover:text-destructive"
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-3 w-3" />
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
                          onClick={() => handleDelete(template.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
