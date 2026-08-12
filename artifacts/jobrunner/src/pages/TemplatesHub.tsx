import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AIImportDialog, type AIFormDraft } from "@/components/CustomFormBuilder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, recordLocalChange, isRemoteChange, getAuthHeaders } from "@/lib/queryClient";
import {
  Palette,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Star,
  Eye,
  Layers,
  FileText,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Package,
  Shield,
  ClipboardCheck,
  Search,
  Calendar,
  MessageSquare,
  Mail,
  Download,
  Briefcase,
  Tag,
  Wrench,
} from "lucide-react";
import TemplateManagement from "@/components/TemplateManagement";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { StylePreset, RateCard, LineItemCatalog, CustomForm, QuoteTemplate, PriceListItem } from "@shared/schema";
import { format } from "date-fns";
import LiveDocumentPreview from "@/components/LiveDocumentPreview";
import { SwmsBuilder } from "@/components/SwmsBuilder";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { TemplateId, TemplateCustomization, DOCUMENT_TEMPLATES, DOCUMENT_ACCENT_COLOR } from "@/lib/document-templates";
import { Check, Settings, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useBusinessTemplates, getPurposesForFamily, PURPOSE_LABELS } from "@/hooks/use-business-templates";
import type { BusinessTemplate, BusinessTemplatePurpose } from "@/hooks/use-business-templates";

const FONT_FAMILIES = [
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Poppins", label: "Poppins" },
  { value: "Source Sans Pro", label: "Source Sans Pro" },
];

const LAYOUT_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "minimal", label: "Minimal" },
  { value: "detailed", label: "Detailed" },
];

const UNIT_OPTIONS = [
  { value: "hour", label: "Hour" },
  { value: "item", label: "Item" },
  { value: "m", label: "Metre (m)" },
  { value: "sqm", label: "Square Metre (sqm)" },
  { value: "each", label: "Each" },
];

function ColorSwatch({ color, size = "sm" }: { color: string; size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "w-5 h-5" : "w-8 h-8";
  return (
    <div
      className={`${sizeClass} rounded-md border border-border shadow-sm`}
      style={{ backgroundColor: color }}
    />
  );
}

// Mini template preview component
function MiniTemplatePreview({ templateId, accentColor }: { templateId: TemplateId; accentColor: string }) {
  const template = DOCUMENT_TEMPLATES[templateId];
  
  return (
    <div className="w-full aspect-[8.5/11] bg-white rounded border border-border shadow-sm p-2 text-[6px] overflow-hidden">
      {/* Header section */}
      <div 
        className="flex justify-between items-start mb-2 pb-1.5"
        style={{ 
          borderBottom: template.showHeaderDivider 
            ? `${template.headerBorderWidth} solid ${accentColor}` 
            : 'none' 
        }}
      >
        <div>
          <div 
            className="w-8 h-3 rounded-sm mb-0.5"
            style={{ backgroundColor: accentColor + '30' }}
          />
          <div className="w-12 h-1 bg-muted rounded-sm" />
        </div>
        <div 
          className="text-right font-bold"
          style={{ color: accentColor, fontSize: '8px' }}
        >
          INVOICE
        </div>
      </div>
      
      {/* Client info */}
      <div className="flex gap-2 mb-2">
        <div className="flex-1">
          <div className="w-8 h-1 bg-muted-foreground/30 rounded-sm mb-0.5" />
          <div className="w-10 h-1 bg-muted rounded-sm" />
        </div>
        <div className="flex-1">
          <div className="w-6 h-1 bg-muted-foreground/30 rounded-sm mb-0.5" />
          <div className="w-8 h-1 bg-muted rounded-sm" />
        </div>
      </div>
      
      {/* Table section */}
      <div className="mb-2">
        <div 
          className="flex gap-1 px-1 py-0.5 mb-0.5"
          style={{ 
            backgroundColor: template.tableStyle === 'minimal' ? 'transparent' : accentColor,
            borderBottom: template.tableStyle === 'minimal' ? `1px solid ${accentColor}` : 'none',
          }}
        >
          <div 
            className="flex-1 h-1 rounded-sm"
            style={{ 
              backgroundColor: template.tableStyle === 'minimal' ? '#666' : 'rgba(255,255,255,0.8)'
            }}
          />
        </div>
        {[0, 1, 2].map((i) => (
          <div 
            key={i}
            className="flex gap-1 px-1 py-0.5"
            style={{ 
              backgroundColor: template.tableStyle === 'striped' && i % 2 === 0 ? '#f9fafb' : 'transparent',
              borderBottom: template.tableStyle === 'bordered' ? '1px solid #eee' : 'none',
            }}
          >
            <div className="flex-1 h-1 bg-muted rounded-sm" />
            <div className="w-3 h-1 bg-muted rounded-sm" />
          </div>
        ))}
      </div>
      
      {/* Totals */}
      <div className="flex justify-end mb-2">
        <div className="w-12">
          <div className="flex justify-between mb-0.5">
            <div className="w-4 h-1 bg-muted rounded-sm" />
            <div className="w-3 h-1 bg-muted rounded-sm" />
          </div>
          <div 
            className="flex justify-between pt-0.5"
            style={{ borderTop: `1px solid ${accentColor}` }}
          >
            <div className="w-4 h-1 rounded-sm" style={{ backgroundColor: accentColor }} />
            <div className="w-4 h-1 rounded-sm" style={{ backgroundColor: accentColor }} />
          </div>
        </div>
      </div>
      
      {/* Notes section */}
      <div 
        className="p-1"
        style={{
          borderLeft: template.noteStyle === 'bordered' ? `2px solid ${accentColor}` : 'none',
          backgroundColor: template.noteStyle === 'bordered' ? '#fafafa' : 
                          template.noteStyle === 'highlighted' ? accentColor + '10' : 'transparent',
          borderRadius: template.noteStyle === 'highlighted' ? '2px' : 
                        template.noteStyle === 'bordered' ? '0 2px 2px 0' : '0',
          borderTop: template.noteStyle === 'simple' ? '1px solid #e5e7eb' : 'none',
        }}
      >
        <div className="w-8 h-1 bg-muted rounded-sm" />
      </div>
    </div>
  );
}

function StylePresetsWithPreview() {
  const { toast } = useToast();
  const [previewType, setPreviewType] = useState<"quote" | "invoice">("quote");
  const [selectedTemplateId, setSelectedTemplateId] = useState<TemplateId>('professional');
  
  // Customization state
  const [customization, setCustomization] = useState<TemplateCustomization>({
    tableStyle: 'bordered',
    noteStyle: 'bordered',
    headerBorderWidth: '2px',
    showHeaderDivider: true,
    bodyWeight: 600,
    headingWeight: 700,
    accentColor: DOCUMENT_ACCENT_COLOR,
  });

  const { data: business } = useBusinessSettings();

  const { data: presets = [], isLoading: isPresetsLoading } = useQuery<StylePreset[]>({
    queryKey: ["/api/style-presets"],
  });

  // Get default preset accent color for preview
  const defaultPreset = presets.find(p => p.isDefault) || presets[0];
  const accentColor = customization.accentColor || defaultPreset?.accentColor || DOCUMENT_ACCENT_COLOR;

  // Track if initial data has been loaded (uses state so we can show loading)
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Refs to prevent useEffects from running multiple times
  const hasInitialLoadRef = useRef(false);
  const hasLoadedCustomizationRef = useRef(false);
  // Track server template for detecting remote changes
  const lastServerTemplateRef = useRef<string | null>(null);

  // Initialize component from server data ONCE on mount
  // After initial load, local state is the single source of truth during the session
  useEffect(() => {
    // Only initialize once per component mount
    if (hasInitialLoadRef.current || hasLoadedCustomizationRef.current) return;
    if (!business) return;
    
    // Mark as loaded IMMEDIATELY to prevent any race conditions
    hasInitialLoadRef.current = true;
    hasLoadedCustomizationRef.current = true;
    
    // Load template selection
    if (business.documentTemplate) {
      let serverTemplateId = business.documentTemplate as TemplateId;
      if (serverTemplateId === 'standard' as any) {
        serverTemplateId = 'professional';
      }
      if (['professional', 'modern', 'minimal'].includes(serverTemplateId)) {
        setSelectedTemplateId(serverTemplateId);
        // Track this as the initial server value for change detection
        lastServerTemplateRef.current = serverTemplateId;
      }
    }
    
    // Load customization settings
    const savedSettings = (business as any)?.documentTemplateSettings;
    if (savedSettings) {
      setCustomization({
        tableStyle: savedSettings.tableStyle || 'bordered',
        noteStyle: savedSettings.noteStyle || 'bordered',
        headerBorderWidth: savedSettings.headerBorderWidth || '2px',
        showHeaderDivider: savedSettings.showHeaderDivider ?? true,
        bodyWeight: savedSettings.bodyWeight || 600,
        headingWeight: savedSettings.headingWeight || 700,
        accentColor: savedSettings.accentColor || DOCUMENT_ACCENT_COLOR,
      });
    }
    
    // Mark initialization complete - this triggers re-render to show content
    setIsInitialized(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!business]); // Only depend on business truthiness
  
  // Sync remote changes AFTER initialization
  // This allows changes from mobile to propagate to web
  useEffect(() => {
    // Skip if not initialized yet (let the first effect handle initial load)
    if (!isInitialized) return;
    if (!business) return;
    
    const serverTemplate = business.documentTemplate as TemplateId | undefined;
    
    // Only sync if the server template has changed AND it's a remote change
    if (serverTemplate && serverTemplate !== lastServerTemplateRef.current) {
      // Check if this is a remote change (not from this device)
      if (isRemoteChange('/api/business-settings', Date.now())) {
        if (['professional', 'modern', 'minimal'].includes(serverTemplate)) {
          setSelectedTemplateId(serverTemplate);
          // Also sync the template customization settings from server
          const serverSettings = (business as any)?.documentTemplateSettings;
          if (serverSettings) {
            setCustomization({
              tableStyle: serverSettings.tableStyle || 'bordered',
              noteStyle: serverSettings.noteStyle || 'bordered',
              headerBorderWidth: serverSettings.headerBorderWidth || '2px',
              showHeaderDivider: serverSettings.showHeaderDivider ?? true,
              bodyWeight: serverSettings.bodyWeight || 600,
              headingWeight: serverSettings.headingWeight || 700,
              accentColor: serverSettings.accentColor || DOCUMENT_ACCENT_COLOR,
            });
          }
        }
      }
      lastServerTemplateRef.current = serverTemplate;
    }
  }, [isInitialized, business?.documentTemplate]);
  
  // Reset customization to template defaults when user explicitly selects a new template
  // Note: This is only called from handleSelectTemplate (user-initiated), not for remote changes
  const resetToTemplateDefaults = (templateId: TemplateId) => {
    const template = DOCUMENT_TEMPLATES[templateId];
    if (template) {
      const newCustomization = {
        tableStyle: template.tableStyle,
        noteStyle: template.noteStyle,
        headerBorderWidth: template.headerBorderWidth as '1px' | '2px' | '3px' | '4px',
        showHeaderDivider: template.showHeaderDivider,
        bodyWeight: template.bodyWeight as 400 | 500 | 600 | 700,
        headingWeight: template.headingWeight as 600 | 700 | 800,
      };
      setCustomization(prev => ({
        ...prev,
        ...newCustomization,
      }));
    }
  };

  // Sync template selection to business settings (for PDF generation)
  // Note: We only update business settings - it's the single source of truth
  const updateTemplateMutation = useMutation({
    mutationFn: async (templateId: TemplateId) => {
      // Record that this device is making a change to prevent sync from resetting
      recordLocalChange('/api/business-settings');
      await apiRequest("PATCH", "/api/business-settings", {
        documentTemplate: templateId,
      });
    },
    onSuccess: () => {
      // Don't invalidate here - we've already updated local state
      // Invalidating causes unnecessary refetch and potential flicker
    },
  });

  const handleSelectTemplate = (newTemplateId: TemplateId) => {
    setSelectedTemplateId(newTemplateId);
    
    // Reset customization to template defaults and save both template + customization to server
    const template = DOCUMENT_TEMPLATES[newTemplateId];
    if (template) {
      const resetCustomization = {
        tableStyle: template.tableStyle,
        noteStyle: template.noteStyle,
        headerBorderWidth: template.headerBorderWidth as '1px' | '2px' | '3px' | '4px',
        showHeaderDivider: template.showHeaderDivider,
        bodyWeight: template.bodyWeight as 400 | 500 | 600 | 700,
        headingWeight: template.headingWeight as 600 | 700 | 800,
        accentColor: customization.accentColor || DOCUMENT_ACCENT_COLOR,
      };
      setCustomization(prev => ({
        ...prev,
        ...resetCustomization,
      }));
      
      // Save both template and reset customization to server in one request
      recordLocalChange('/api/business-settings');
      apiRequest("PATCH", "/api/business-settings", {
        documentTemplate: newTemplateId,
        documentTemplateSettings: resetCustomization,
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
      });
    } else {
      updateTemplateMutation.mutate(newTemplateId);
    }
    
    toast({ title: `${DOCUMENT_TEMPLATES[newTemplateId].name} template selected` });
  };

  const updateCustomization = (updates: Partial<TemplateCustomization>) => {
    setCustomization(prev => ({ ...prev, ...updates }));
  };

  // Save customization to server
  const saveCustomizationMutation = useMutation({
    mutationFn: async (customizationToSave: TemplateCustomization) => {
      // Record that this device is making a change to prevent WebSocket flicker
      recordLocalChange('/api/business-settings');
      await apiRequest("PATCH", "/api/business-settings", {
        documentTemplateSettings: customizationToSave,
      });
    },
    onSuccess: () => {
      toast({ title: "Template customisation saved" });
    },
    onError: () => {
      toast({ title: "Failed to save customisation", variant: "destructive" });
    },
  });

  const handleSaveCustomization = () => {
    saveCustomizationMutation.mutate(buildTemplateCustomization());
  };

  // Build template customization for live preview
  // Uses the current customization state (which reflects either template defaults or user overrides)
  const buildTemplateCustomization = (): TemplateCustomization => ({
    ...customization,
    accentColor: customization.accentColor || DOCUMENT_ACCENT_COLOR,
  });

  // Show loading ONLY until initialization is complete
  // This prevents the flash of default values before server data loads
  // Once initialized, never show loading again (prevents scroll reset on query failures)
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const templateIds: TemplateId[] = ['professional', 'modern', 'minimal'];

  return (
    <div className="space-y-8">
      {/* Main layout: Template cards + Customization on left, Preview on right */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left side: Template selection + Customization */}
        <div className="space-y-6">
          {/* Template Style Cards */}
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Template Style</h2>
              <p className="text-sm text-muted-foreground">
                Choose a base template for your quotes and invoices
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {templateIds.map((templateId) => {
                const template = DOCUMENT_TEMPLATES[templateId];
                const isActive = selectedTemplateId === templateId;
                
                return (
                  <Card 
                    key={templateId}
                    className={`cursor-pointer transition-all ${isActive ? 'ring-2 ring-primary' : 'hover-elevate'}`}
                    onClick={() => handleSelectTemplate(templateId)}
                    data-testid={`card-template-${templateId}`}
                  >
                    <CardContent className="p-3 space-y-3">
                      {/* Mini preview */}
                      <MiniTemplatePreview templateId={templateId} accentColor={accentColor} />
                      
                      {/* Template info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{template.name}</span>
                          {isActive && (
                            <Badge variant="default" className="text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {template.description}
                        </p>
                      </div>
                      
                      {/* Action button */}
                      {!isActive && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectTemplate(templateId);
                          }}
                        >
                          Select Template
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Customise Template Panel */}
          <Card data-testid="card-customise-template" className="relative overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: "hsl(var(--trade) / 0.1)" }}
                >
                  <Settings className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                </div>
                <div>
                  <CardTitle className="text-lg">Customise Template</CardTitle>
                  <CardDescription>
                    Fine-tune the {DOCUMENT_TEMPLATES[selectedTemplateId].name} template
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Table Style */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Table Style</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['bordered', 'striped', 'minimal'] as const).map((style) => (
                    <Button
                      key={style}
                      variant={customization.tableStyle === style ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateCustomization({ tableStyle: style })}
                      className="capitalize"
                    >
                      {style}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Accent Colour */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Accent Colour</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="color"
                    value={customization.accentColor || DOCUMENT_ACCENT_COLOR}
                    onChange={(e) => updateCustomization({ accentColor: e.target.value })}
                    className="w-12 h-9 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={customization.accentColor || DOCUMENT_ACCENT_COLOR}
                    onChange={(e) => updateCustomization({ accentColor: e.target.value })}
                    className="flex-1 font-mono text-sm"
                    placeholder="#2563eb"
                  />
                </div>
              </div>

              {/* Header Border */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Header Border</Label>
                <div className="grid grid-cols-4 gap-2">
                  {(['1px', '2px', '3px', '4px'] as const).map((width) => (
                    <Button
                      key={width}
                      variant={customization.headerBorderWidth === width ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateCustomization({ headerBorderWidth: width })}
                    >
                      {width}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Show Header Divider */}
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Show Header Divider</Label>
                <Switch
                  checked={customization.showHeaderDivider}
                  onCheckedChange={(checked) => updateCustomization({ showHeaderDivider: checked })}
                />
              </div>

              {/* Font Weights */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Body Font Weight</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {([400, 500, 600, 700] as const).map((weight) => (
                      <Button
                        key={weight}
                        variant={customization.bodyWeight === weight ? "default" : "outline"}
                        size="sm"
                        onClick={() => updateCustomization({ bodyWeight: weight })}
                      >
                        {weight}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Heading Font Weight</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {([600, 700, 800] as const).map((weight) => (
                      <Button
                        key={weight}
                        variant={customization.headingWeight === weight ? "default" : "outline"}
                        size="sm"
                        onClick={() => updateCustomization({ headingWeight: weight })}
                      >
                        {weight}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Note Style */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Note Style</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['simple', 'bordered', 'highlighted'] as const).map((style) => (
                    <Button
                      key={style}
                      variant={customization.noteStyle === style ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateCustomization({ noteStyle: style })}
                      className="capitalize"
                    >
                      {style}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t">
                <Button 
                  onClick={handleSaveCustomization}
                  disabled={saveCustomizationMutation.isPending}
                  className="w-full"
                >
                  {saveCustomizationMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Customisation"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right side: Live preview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">Live Preview</h2>
              <p className="text-sm text-muted-foreground">
                See how your documents will look
              </p>
            </div>
            <Select value={previewType} onValueChange={(v) => setPreviewType(v as "quote" | "invoice")}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quote">Quote</SelectItem>
                <SelectItem value="invoice">Invoice</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {business ? (
                <div className="bg-muted/30 p-4">
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden" style={{ maxHeight: '700px', overflow: 'auto' }}>
                    <LiveDocumentPreview
                      key={`${selectedTemplateId}-${JSON.stringify(customization)}`}
                      type={previewType}
                      documentNumber={previewType === 'quote' ? 'Q-2024-001' : 'INV-2024-001'}
                      title={previewType === 'quote' ? 'Quote' : 'Invoice'}
                      date={new Date().toISOString()}
                      validUntil={previewType === 'quote' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : undefined}
                      dueDate={previewType === 'invoice' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : undefined}
                      business={{
                        businessName: business.businessName || business.name || "Your Business",
                        email: business.email || "email@example.com",
                        phone: business.phone || "",
                        address: business.address || "",
                        abn: business.abn || "",
                        logoUrl: business.logoUrl || "",
                      }}
                      client={{
                        name: "Sample Client",
                        email: "client@example.com",
                        phone: "0400 000 000",
                        address: "123 Sample Street, Sydney NSW 2000",
                      }}
                      lineItems={[
                        { description: "Labour - Standard Rate", quantity: 4, unitPrice: 85 },
                        { description: "Materials and Supplies", quantity: 1, unitPrice: 150 },
                        { description: "Site Preparation", quantity: 2, unitPrice: 65 },
                      ]}
                      notes="Thank you for your business. Payment is due within 14 days of invoice date."
                      gstEnabled={business.gstEnabled ?? true}
                      templateId={selectedTemplateId}
                      templateCustomization={buildTemplateCustomization()}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-16 text-center">
                  <div>
                    <Eye className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Configure your business settings to see preview
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Template Features Comparison Table */}
      <Card data-testid="card-template-features">
        <CardHeader>
          <CardTitle className="text-lg">Template Features</CardTitle>
          <CardDescription>Compare the built-in features of each template style</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">Feature</th>
                  <th className="text-center py-3 px-4 font-semibold">Professional</th>
                  <th className="text-center py-3 px-4 font-semibold">Modern</th>
                  <th className="text-center py-3 px-4 font-semibold">Minimal</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-3 px-4 text-muted-foreground">Default Table Style</td>
                  <td className="py-3 px-4 text-center">Bordered</td>
                  <td className="py-3 px-4 text-center">Striped</td>
                  <td className="py-3 px-4 text-center">Minimal</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-muted-foreground">Header Divider</td>
                  <td className="py-3 px-4 text-center">Yes (2px)</td>
                  <td className="py-3 px-4 text-center">Yes (3px)</td>
                  <td className="py-3 px-4 text-center">No</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-muted-foreground">Notes Style</td>
                  <td className="py-3 px-4 text-center">Bordered</td>
                  <td className="py-3 px-4 text-center">Highlighted</td>
                  <td className="py-3 px-4 text-center">Simple</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-muted-foreground">Best For</td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant="secondary">Traditional business</Badge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant="secondary">Modern trades</Badge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant="secondary">Clean aesthetic</Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RateCardsSection() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCard, setEditingCard] = useState<RateCard | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<RateCard | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    tradeType: "general",
    hourlyRate: "100.00",
    calloutFee: "80.00",
    materialMarkupPct: "20.00",
    afterHoursMultiplier: "1.50",
    gstEnabled: true,
  });

  const { data: user } = useQuery<{ tradeType?: string }>({
    queryKey: ["/api/auth/me"],
  });

  const { data: rateCards = [], isLoading } = useQuery<RateCard[]>({
    queryKey: ["/api/rate-cards"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/rate-cards", data);
    },
    onSuccess: () => {
      toast({ title: "Rate card created" });
      setDialogOpen(false);
      resetFormData();
      queryClient.invalidateQueries({ queryKey: ["/api/rate-cards"] });
    },
    onError: () => {
      toast({ title: "Failed to create rate card", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      return apiRequest("PATCH", `/api/rate-cards/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Rate card updated" });
      setDialogOpen(false);
      setEditingCard(null);
      resetFormData();
      queryClient.invalidateQueries({ queryKey: ["/api/rate-cards"] });
    },
    onError: () => {
      toast({ title: "Failed to update rate card", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/rate-cards/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Rate card deleted" });
      setDeleteConfirmOpen(false);
      setCardToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/rate-cards"] });
    },
    onError: () => {
      toast({ title: "Failed to delete rate card", variant: "destructive" });
    },
  });

  const resetFormData = () => {
    setFormData({
      name: "",
      tradeType: user?.tradeType || "general",
      hourlyRate: "100.00",
      calloutFee: "80.00",
      materialMarkupPct: "20.00",
      afterHoursMultiplier: "1.50",
      gstEnabled: true,
    });
  };

  const handleEditCard = (card: RateCard) => {
    setEditingCard(card);
    setFormData({
      name: card.name,
      tradeType: card.tradeType || "general",
      hourlyRate: String(card.hourlyRate || "100.00"),
      calloutFee: String(card.calloutFee || "80.00"),
      materialMarkupPct: String(card.materialMarkupPct || "20.00"),
      afterHoursMultiplier: String(card.afterHoursMultiplier || "1.50"),
      gstEnabled: card.gstEnabled !== false,
    });
    setDialogOpen(true);
  };

  const handleDeleteCard = (card: RateCard) => {
    setCardToDelete(card);
    setDeleteConfirmOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCard(null);
    resetFormData();
  };

  const handleSubmit = () => {
    if (editingCard) {
      updateMutation.mutate({ id: editingCard.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredCards = rateCards.filter((card) =>
    card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.tradeType?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            placeholder="Search rate cards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
          />
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} data-testid="button-create-rate-card">
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {filteredCards.length} of {rateCards.length} rate card{rateCards.length !== 1 ? "s" : ""}
      </p>

      {filteredCards.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          {rateCards.length === 0 ? "No rate cards yet. Create one to set your pricing." : "No matching rate cards found."}
        </p>
      ) : (
        <ScrollArea className="h-[200px]">
          <div className="space-y-2 pr-3">
            {filteredCards.map((card) => (
              <div
                key={card.id}
                className="p-3 rounded-lg border bg-muted/30 space-y-2"
                data-testid={`rate-card-${card.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{card.name}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
                      <span>${card.hourlyRate}/hr</span>
                      <span>Callout: ${card.calloutFee}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => handleEditCard(card)}
                      data-testid={`button-edit-rate-card-${card.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="text-destructive"
                      onClick={() => handleDeleteCard(card)}
                      data-testid={`button-delete-rate-card-${card.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary" className="capitalize">{card.tradeType}</Badge>
                  <span className="text-xs text-muted-foreground">{card.afterHoursMultiplier}x after hours</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCard ? "Edit Rate Card" : "Create Rate Card"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rate-name">Name</Label>
              <Input
                id="rate-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Standard Rates"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  step="0.01"
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="calloutFee">Callout Fee ($)</Label>
                <Input
                  id="calloutFee"
                  type="number"
                  step="0.01"
                  value={formData.calloutFee}
                  onChange={(e) => setFormData({ ...formData, calloutFee: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="afterHoursMultiplier">After Hours Multiplier</Label>
                <Input
                  id="afterHoursMultiplier"
                  type="number"
                  step="0.1"
                  value={formData.afterHoursMultiplier}
                  onChange={(e) => setFormData({ ...formData, afterHoursMultiplier: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="materialMarkupPct">Material Markup (%)</Label>
                <Input
                  id="materialMarkupPct"
                  type="number"
                  step="1"
                  value={formData.materialMarkupPct}
                  onChange={(e) => setFormData({ ...formData, materialMarkupPct: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="gstEnabled">GST Enabled</Label>
              <Switch
                id="gstEnabled"
                checked={formData.gstEnabled}
                onCheckedChange={(checked) => setFormData({ ...formData, gstEnabled: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingCard ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rate Card</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{cardToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCardToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cardToDelete && deleteMutation.mutate(cardToDelete.id)}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LineItemsCatalogSection() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingItem, setEditingItem] = useState<LineItemCatalog | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<LineItemCatalog | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    itemCode: "",
    description: "",
    unit: "item",
    unitPrice: "0.00",
    tradeType: "general",
    defaultQty: "1.00",
  });

  const { data: user } = useQuery<{ tradeType?: string }>({
    queryKey: ["/api/auth/me"],
  });

  const { data: catalogItems = [], isLoading } = useQuery<LineItemCatalog[]>({
    queryKey: ["/api/catalog"],
  });

  const resetFormData = () => {
    setFormData({
      name: "",
      itemCode: "",
      description: "",
      unit: "item",
      unitPrice: "0.00",
      tradeType: user?.tradeType || "general",
      defaultQty: "1.00",
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/catalog", data);
    },
    onSuccess: () => {
      toast({ title: "Catalog item created" });
      setDialogOpen(false);
      resetFormData();
      queryClient.invalidateQueries({ queryKey: ["/api/catalog"] });
    },
    onError: () => {
      toast({ title: "Failed to create item", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      return apiRequest("PATCH", `/api/catalog/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Catalog item updated" });
      setDialogOpen(false);
      setEditingItem(null);
      resetFormData();
      queryClient.invalidateQueries({ queryKey: ["/api/catalog"] });
    },
    onError: () => {
      toast({ title: "Failed to update item", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/catalog/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Catalog item deleted" });
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/catalog"] });
    },
    onError: () => {
      toast({ title: "Failed to delete item", variant: "destructive" });
    },
  });

  const handleEditItem = (item: LineItemCatalog) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      itemCode: (item as any).itemCode || "",
      description: item.description || "",
      unit: item.unit || "item",
      unitPrice: String(item.unitPrice || "0.00"),
      tradeType: item.tradeType || "general",
      defaultQty: String(item.defaultQty || "1.00"),
    });
    setDialogOpen(true);
  };

  const handleDeleteItem = (item: LineItemCatalog) => {
    setItemToDelete(item);
    setDeleteConfirmOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    resetFormData();
  };

  const handleSubmit = () => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredItems = catalogItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item as any).itemCode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            placeholder="Search catalog items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
          />
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} data-testid="button-create-catalog-item">
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {filteredItems.length} of {catalogItems.length} item{catalogItems.length !== 1 ? "s" : ""} in catalog
      </p>

      {filteredItems.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          {catalogItems.length === 0 ? "No catalog items yet. Add items you use frequently." : "No matching items found."}
        </p>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-2 pr-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-lg border bg-muted/30 space-y-2"
                data-testid={`catalog-item-${item.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium break-words">{item.name}</p>
                    {item.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => handleEditItem(item)}
                      data-testid={`button-edit-catalog-item-${item.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="text-destructive"
                      onClick={() => handleDeleteItem(item)}
                      data-testid={`button-delete-catalog-item-${item.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">${item.unitPrice}/{item.unit}</Badge>
                  {(item as any).itemCode && (
                    <Badge variant="secondary" className="font-mono text-xs">{(item as any).itemCode}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Catalog Item" : "Add Catalog Item"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="item-name">Name</Label>
              <Input
                id="item-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Labour - Standard"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-code">Item Code (optional)</Label>
              <Input
                id="item-code"
                value={formData.itemCode}
                onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
                placeholder="e.g. NDIS 01_801_0138_1_1 or SKU"
                data-testid="input-catalog-item-code"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-description">Description</Label>
              <Input
                id="item-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="unitPrice">Unit Price ($)</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  step="0.01"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((unit) => (
                      <SelectItem key={unit.value} value={unit.value}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingItem ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Catalog Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{itemToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => itemToDelete && deleteMutation.mutate(itemToDelete.id)}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const PRICE_LIST_UNIT_OPTIONS = [
  { value: "each", label: "Each" },
  { value: "hour", label: "Hour" },
  { value: "day", label: "Day" },
  { value: "m", label: "Metre (m)" },
  { value: "m²", label: "Square Metre (m²)" },
  { value: "m³", label: "Cubic Metre (m³)" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "l", label: "Litre (l)" },
  { value: "item", label: "Item" },
  { value: "week", label: "Week" },
  { value: "job", label: "Job" },
];

const PRICE_LIST_TRADE_TYPES = [
  "general", "plumbing", "electrical", "hvac", "carpentry", "painting",
  "landscaping", "tiling", "roofing", "concreting", "plastering", "cleaning",
];

function PriceListSection() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [editingItem, setEditingItem] = useState<PriceListItem | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<PriceListItem | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    unitPrice: "0.00",
    category: "General",
    unit: "each",
    itemType: "service",
    tradeType: "",
    defaultQuantity: "1.00",
    gstIncluded: true,
    isActive: true,
  });

  const { data: user } = useQuery<{ tradeType?: string }>({ queryKey: ["/api/auth/me"] });

  const { data: priceListItems = [], isLoading } = useQuery<PriceListItem[]>({
    queryKey: ["/api/price-list-items"],
  });

  const resetFormData = () => setFormData({
    name: "",
    description: "",
    unitPrice: "0.00",
    category: "General",
    unit: "each",
    itemType: "service",
    tradeType: user?.tradeType || "",
    defaultQuantity: "1.00",
    gstIncluded: true,
    isActive: true,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/price-list-items", data),
    onSuccess: () => {
      toast({ title: "Price list item created" });
      setDialogOpen(false);
      resetFormData();
      queryClient.invalidateQueries({ queryKey: ["/api/price-list-items"] });
    },
    onError: () => toast({ title: "Failed to create item", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) =>
      apiRequest("PATCH", `/api/price-list-items/${id}`, data),
    onSuccess: () => {
      toast({ title: "Price list item updated" });
      setDialogOpen(false);
      setEditingItem(null);
      resetFormData();
      queryClient.invalidateQueries({ queryKey: ["/api/price-list-items"] });
    },
    onError: () => toast({ title: "Failed to update item", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/price-list-items/${id}`),
    onSuccess: () => {
      toast({ title: "Price list item deleted" });
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/price-list-items"] });
    },
    onError: () => toast({ title: "Failed to delete item", variant: "destructive" }),
  });

  const handleEditItem = (item: PriceListItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      unitPrice: String(item.unitPrice || "0.00"),
      category: item.category || "General",
      unit: item.unit || "each",
      itemType: item.itemType || "service",
      tradeType: item.tradeType || "",
      defaultQuantity: String(item.defaultQuantity || "1.00"),
      gstIncluded: item.gstIncluded !== false,
      isActive: item.isActive !== false,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    resetFormData();
  };

  const handleSubmit = () => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filtered = priceListItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesType = typeFilter === "all" || item.itemType === typeFilter;
    return matchesSearch && matchesType;
  });

  const ITEM_TYPE_ICONS: Record<string, React.ElementType> = { service: Wrench, material: Package, equipment: Tag };
  const ITEM_TYPE_BADGE_COLORS: Record<string, string> = {
    service: "bg-blue-100 text-blue-800",
    material: "bg-green-100 text-green-800",
    equipment: "bg-orange-100 text-orange-800",
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            placeholder="Search price list..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
            data-testid="input-price-list-search"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36 h-8">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="service">Services</SelectItem>
            <SelectItem value="material">Materials</SelectItem>
            <SelectItem value="equipment">Equipment</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setDialogOpen(true)} data-testid="button-create-price-list-item">
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} of {priceListItems.length} item{priceListItems.length !== 1 ? "s" : ""} · Material items get markup applied when added to quotes/invoices
      </p>

      {filtered.length === 0 ? (
        <div className="text-center py-8">
          <Tag className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {priceListItems.length === 0
              ? "No items yet. Add services, materials, and equipment you use frequently."
              : "No items match your filters."}
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-2 pr-3">
            {filtered.map(item => {
              const Icon = ITEM_TYPE_ICONS[item.itemType] || Tag;
              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border space-y-2 ${item.isActive === false ? "opacity-50 bg-muted/10" : "bg-muted/30"}`}
                  data-testid={`price-list-item-${item.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium break-words">{item.name}</p>
                        {item.description && (
                          <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => handleEditItem(item)} data-testid={`button-edit-price-list-item-${item.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { setItemToDelete(item); setDeleteConfirmOpen(true); }} data-testid={`button-delete-price-list-item-${item.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="font-semibold">${parseFloat(String(item.unitPrice)).toFixed(2)}/{item.unit || "each"}</Badge>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ITEM_TYPE_BADGE_COLORS[item.itemType] || ""}`}>
                      {item.itemType}
                    </span>
                    {item.category && item.category !== "General" && (
                      <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                    )}
                    {item.tradeType && (
                      <Badge variant="outline" className="text-xs capitalize">{item.tradeType}</Badge>
                    )}
                    {item.isActive === false && (
                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Price List Item" : "Add Price List Item"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Replace hot water system"
                data-testid="input-price-list-name"
              />
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description shown on quote/invoice"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formData.itemType} onValueChange={(v) => setFormData({ ...formData, itemType: v })}>
                  <SelectTrigger data-testid="select-price-list-item-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="material">Material</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g. Hot Water, Drainage"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unit Price ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                  data-testid="input-price-list-unit-price"
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICE_LIST_UNIT_OPTIONS.map(u => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Default Qty</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.defaultQuantity}
                  onChange={(e) => setFormData({ ...formData, defaultQuantity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Trade Type (optional)</Label>
                <Select value={formData.tradeType || "_none"} onValueChange={(v) => setFormData({ ...formData, tradeType: v === "_none" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All trades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">All trades</SelectItem>
                    {PRICE_LIST_TRADE_TYPES.map(t => (
                      <SelectItem key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.gstIncluded}
                  onChange={(e) => setFormData({ ...formData, gstIncluded: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Price includes GST</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Active</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-price-list-item"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingItem ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Price List Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{itemToDelete?.name}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => itemToDelete && deleteMutation.mutate(itemToDelete.id)}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ComponentsTab() {
  const [rateCardsOpen, setRateCardsOpen] = useState(true);
  const [lineItemsOpen, setLineItemsOpen] = useState(true);
  const { data: business } = useBusinessSettings();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Reusable Components</h2>
          <p className="text-sm text-muted-foreground">
            Building blocks for your quotes and invoices
          </p>
        </div>

        <div className="space-y-4">
          <Collapsible open={rateCardsOpen} onOpenChange={setRateCardsOpen}>
            <Card data-testid="card-rate-cards">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover-elevate rounded-t-xl">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: "hsl(var(--trade) / 0.1)" }}
                      >
                        <DollarSign className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Rate Cards</CardTitle>
                        <CardDescription>Hourly rates, callout fees, and multipliers</CardDescription>
                      </div>
                    </div>
                    {rateCardsOpen ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <RateCardsSection />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <Collapsible open={lineItemsOpen} onOpenChange={setLineItemsOpen}>
            <Card data-testid="card-line-items">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover-elevate rounded-t-xl">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: "hsl(var(--trade) / 0.1)" }}
                      >
                        <Package className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Line Items Catalog</CardTitle>
                        <CardDescription>Reusable items for quotes and invoices</CardDescription>
                      </div>
                    </div>
                    {lineItemsOpen ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <LineItemsCatalogSection />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </div>
      
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Preview</h2>
          <p className="text-sm text-muted-foreground">
            See how components appear in documents
          </p>
        </div>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-muted/30 p-4">
              <div className="bg-white rounded-lg shadow-sm overflow-hidden" style={{ maxHeight: '600px', overflow: 'auto' }}>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    {business?.logoUrl && (
                      <img src={business.logoUrl} alt="Logo" className="h-12 w-auto object-contain" />
                    )}
                    <div>
                      <h3 className="font-bold text-lg" style={{ color: '#1f3a5f' }}>
                        {business?.businessName || 'Your Business'}
                      </h3>
                      <p className="text-sm text-muted-foreground">{business?.address}</p>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">Rate Cards & Line Items</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Your rate cards and line items will be used when creating quotes and invoices. Add frequently used items to save time.
                    </p>
                    <div className="space-y-2">
                      <div className="p-3 rounded-lg bg-muted/50 border">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Labour - Standard Rate</span>
                          <span className="text-sm text-muted-foreground">$85/hour</span>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50 border">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Materials & Supplies</span>
                          <span className="text-sm text-muted-foreground">$150/item</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Type to represent both custom forms and system templates in a unified way
interface FormItem extends CustomForm {
  isSystemTemplate?: boolean;
  templateKey?: string;
}

interface JobCardTemplate {
  id: string;
  trade: string;
  tradeLabel: string;
  name: string;
  description: string;
  requiresSignature?: boolean;
  blockJobCompletion?: boolean;
  fields: any[];
}

function JobCardsTab() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { data: business } = useBusinessSettings();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<CustomForm | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(true);

  const { data: customForms = [], isLoading } = useQuery<CustomForm[]>({
    queryKey: ["/api/custom-forms"],
  });

  const { data: templates = [] } = useQuery<JobCardTemplate[]>({
    queryKey: ["/api/job-card-templates"],
  });

  const jobCards = customForms
    .filter(f => (f as any).isJobCard && f.isActive)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const myTrade = (business as any)?.tradeType as string | undefined;

  // Group templates by trade, ordered with the user's trade first, then General, then the rest.
  const groupedTemplates = (() => {
    const groups = new Map<string, { label: string; items: JobCardTemplate[] }>();
    for (const t of templates) {
      if (!groups.has(t.trade)) groups.set(t.trade, { label: t.tradeLabel, items: [] });
      groups.get(t.trade)!.items.push(t);
    }
    return Array.from(groups.entries())
      .map(([trade, g]) => ({ trade, ...g }))
      .sort((a, b) => {
        const rank = (tr: string) => (tr === myTrade ? 0 : tr === 'general' ? 1 : 2);
        const ra = rank(a.trade), rb = rank(b.trade);
        if (ra !== rb) return ra - rb;
        return a.label.localeCompare(b.label);
      });
  })();

  const createFromTemplateMutation = useMutation({
    mutationFn: async (template: JobCardTemplate) => {
      const res = await apiRequest("POST", "/api/custom-forms", {
        name: template.name,
        description: template.description,
        formType: 'general',
        tradeType: template.trade,
        fields: template.fields,
        isJobCard: true,
        blockJobCompletion: template.blockJobCompletion || false,
        requiresSignature: template.requiresSignature || false,
        isActive: true,
      });
      return await res.json();
    },
    onSuccess: (form: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-forms"] });
      toast({ title: "Job card created from template" });
      setLocation(`/forms/${form.id}/edit?returnTab=job-cards`);
    },
    onError: () => toast({ title: "Failed to create job card", variant: "destructive" }),
  });

  // Prevent accidental duplicates: if a job card from this template already
  // exists, open the existing one instead of creating another identical copy.
  const handleCustomise = (template: JobCardTemplate) => {
    const norm = (s?: string | null) => (s || '').trim().toLowerCase();
    const existing = jobCards.find(c => norm(c.name) === norm(template.name));
    if (existing) {
      toast({
        title: "You already have this job card",
        description: "Opening it so you can edit instead of making a copy.",
      });
      setLocation(`/forms/${existing.id}/edit?returnTab=job-cards`);
      return;
    }
    createFromTemplateMutation.mutate(template);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/custom-forms/${id}`),
    onSuccess: () => {
      toast({ title: "Job card deleted" });
      setDeleteOpen(false);
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/custom-forms"] });
    },
    onError: () => toast({ title: "Failed to delete job card", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Job Cards</h2>
          <p className="text-sm text-muted-foreground max-w-xl">
            A job card is a checklist that appears on every job. Your team fills it in on site, and you can require it before a job can be marked done.
          </p>
        </div>
        <Button size="sm" onClick={() => setLocation('/forms/new?jobCard=1&returnTab=job-cards')} data-testid="button-create-job-card">
          <Plus className="h-4 w-4 mr-2" />
          Create Job Card
        </Button>
      </div>

      {jobCards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center text-center py-12">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
              <ClipboardCheck className="h-6 w-6 text-primary" />
            </div>
            <p className="font-medium">No job cards yet</p>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Create a job card to add a standard checklist to every job — like site checks, sign-off, or photos.
            </p>
            <Button size="sm" className="mt-4" onClick={() => setLocation('/forms/new?jobCard=1&returnTab=job-cards')} data-testid="button-create-job-card-empty">
              <Plus className="h-4 w-4 mr-2" />
              Create Job Card
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {jobCards.map((card) => {
            const fieldCount = Array.isArray((card as any).fields) ? (card as any).fields.length : 0;
            const blocks = !!(card as any).blockJobCompletion;
            return (
              <Card
                key={card.id}
                className="hover-elevate cursor-pointer"
                onClick={() => setLocation(`/forms/${card.id}/edit?returnTab=job-cards`)}
                data-testid={`card-job-card-${card.id}`}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <ClipboardCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{card.name}</p>
                      {blocks && <Badge variant="outline">Required to close</Badge>}
                    </div>
                    {card.description && (
                      <p className="text-sm text-muted-foreground truncate">{card.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fieldCount} {fieldCount === 1 ? 'field' : 'fields'}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); setLocation(`/forms/${card.id}/edit?returnTab=job-cards`); }}
                    data-testid={`button-edit-job-card-${card.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); setToDelete(card); setDeleteOpen(true); }}
                    data-testid={`button-delete-job-card-${card.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {groupedTemplates.length > 0 && (
        <Card data-testid="card-job-card-templates">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setTemplatesOpen(!templatesOpen)}>
            <CardTitle className="text-sm font-medium flex items-center justify-between gap-4">
              <span className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                <div>
                  <div>Start from a template</div>
                  <div className="text-xs font-normal text-muted-foreground">Ready-made job cards for your trade — customise and save your own</div>
                </div>
              </span>
              <Badge variant="secondary" className="text-xs">{templates.length}</Badge>
            </CardTitle>
          </CardHeader>
          {templatesOpen && (
            <CardContent className="pt-0 space-y-5">
              {groupedTemplates.map((group) => (
                <div key={group.trade} className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2 pb-1">
                    {group.label}
                    {group.trade === myTrade && <span className="ml-2 normal-case font-normal text-primary">Your trade</span>}
                  </p>
                  {group.items.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between gap-3 p-2 rounded-md"
                      data-testid={`row-job-card-template-${template.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <ClipboardCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm truncate">{template.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{template.description}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => handleCustomise(template)}
                        disabled={createFromTemplateMutation.isPending}
                        data-testid={`button-customize-job-card-${template.id}`}
                      >
                        {createFromTemplateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Customise
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete job card?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.name}" will be removed from all jobs. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FormsTab() {
  const { data: business } = useBusinessSettings();
  const { toast } = useToast();
  const [safetyFormsOpen, setSafetyFormsOpen] = useState(true);
  const [complianceFormsOpen, setComplianceFormsOpen] = useState(true);
  const [inspectionFormsOpen, setInspectionFormsOpen] = useState(true);
  const [swmsTemplatesOpen, setSwmsTemplatesOpen] = useState(true);
  const [, setLocation] = useLocation();
  const [selectedForm, setSelectedForm] = useState<FormItem | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<FormItem | null>(null);
  const [formSearch, setFormSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [swmsBuilderOpen, setSwmsBuilderOpen] = useState(false);
  const [swmsBuilderSwmsId, setSwmsBuilderSwmsId] = useState<string | undefined>(undefined);
  const [swmsBuilderTitle, setSwmsBuilderTitle] = useState<string>('');
  const [swmsDeleteConfirmOpen, setSwmsDeleteConfirmOpen] = useState(false);
  const [swmsToDelete, setSwmsToDelete] = useState<any>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [aiImportOpen, setAiImportOpen] = useState(false);
  const handleAiDraft = (draft: AIFormDraft) => {
    setAiImportOpen(false);
    try { sessionStorage.setItem('aiFormDraft', JSON.stringify(draft)); } catch {}
    setLocation('/forms/new?aiDraft=1&returnTab=forms');
  };
  const [exportFormId, setExportFormId] = useState<string>('all');
  const [exportFormat, setExportFormat] = useState<'csv' | 'tsv'>('csv');
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exporting, setExporting] = useState(false);

  // Fetch custom forms
  const { data: customForms = [], isLoading: isLoadingCustomForms } = useQuery<CustomForm[]>({
    queryKey: ["/api/custom-forms"],
  });

  // Fetch safety form templates
  const { data: safetyTemplates = [], isLoading: isLoadingSafetyTemplates } = useQuery<any[]>({
    queryKey: ["/api/safety-form-templates"],
  });

  // Combine and transform data
  const forms: FormItem[] = [
    // Add custom forms as-is
    ...customForms,
    // Transform safety templates to have 'id' field and mark as system template
    ...safetyTemplates.map((template: any) => ({
      id: template.templateKey,
      name: template.name,
      description: template.description || '',
      formType: template.formType,
      tradeType: template.tradeType || 'general',
      fields: template.fields || [],
      settings: template.settings || {},
      requiresSignature: template.requiresSignature || false,
      isDefault: false,
      isActive: true,
      isJobCard: false,
      blockJobCompletion: false,
      taskRules: [],
      userId: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      isSystemTemplate: true,
      templateKey: template.templateKey,
    })),
  ];

  const { data: swmsTemplates = [], isLoading: isLoadingSwmsTemplates } = useQuery<any[]>({
    queryKey: ["/api/swms/templates"],
  });

  const { data: mySwmsDocs = [], isLoading: isLoadingMySwms } = useQuery<any[]>({
    queryKey: ["/api/swms"],
  });

  const isLoading = isLoadingCustomForms || isLoadingSafetyTemplates || isLoadingSwmsTemplates || isLoadingMySwms;

  const swmsCreateFromTemplateMutation = useMutation({
    mutationFn: async (template: any) => {
      const res = await apiRequest("POST", "/api/swms", {
        title: template.title,
        description: template.description,
        workActivityDescription: template.workActivityDescription || '',
        ppeRequirements: template.ppeRequirements || [],
        status: 'draft',
        hazards: (template.hazards || []).map((h: any) => ({
          activityTask: h.activityTask,
          hazard: h.hazard,
          likelihood: h.likelihood || 'possible',
          consequence: h.consequence || 'moderate',
          riskBefore: h.riskBefore || 'medium',
          controlMeasures: h.controlMeasures || '',
          riskAfter: h.riskAfter || 'low',
        })),
      });
      return await res.json();
    },
    onSuccess: (newDoc: any) => {
      toast({ title: "SWMS document created from template" });
      queryClient.invalidateQueries({ queryKey: ["/api/swms"] });
      setSwmsBuilderSwmsId(newDoc.id);
      setSwmsBuilderTitle(newDoc.title);
      setSwmsBuilderOpen(true);
    },
    onError: () => {
      toast({ title: "Failed to create SWMS document", variant: "destructive" });
    },
  });

  const swmsDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/swms/${id}`);
    },
    onSuccess: () => {
      toast({ title: "SWMS document deleted" });
      setSwmsDeleteConfirmOpen(false);
      setSwmsToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/swms"] });
    },
    onError: () => {
      toast({ title: "Failed to delete SWMS document", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/custom-forms/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Form deleted" });
      setDeleteConfirmOpen(false);
      setFormToDelete(null);
      if (selectedForm?.id === formToDelete?.id) {
        setSelectedForm(null);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/custom-forms"] });
    },
    onError: () => {
      toast({ title: "Failed to delete form", variant: "destructive" });
    },
  });

  const createFromTemplateMutation = useMutation({
    mutationFn: async (templateKey: string) => {
      const res = await apiRequest("POST", `/api/safety-form-templates/${templateKey}/create`, {});
      return res.json();
    },
    onSuccess: (newForm: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-forms"] });
      if (!newForm?.id) {
        toast({ title: "Failed to create form from template", variant: "destructive" });
        return;
      }
      toast({ title: "Form created from template" });
      // Open the newly created form in the inline editor
      setLocation(`/forms/${newForm.id}/edit`);
    },
    onError: () => {
      toast({ title: "Failed to create form from template", variant: "destructive" });
    },
  });

  const handleExportSubmissions = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (exportFormId && exportFormId !== 'all') params.append('formId', exportFormId);
      if (exportFrom) params.append('from', exportFrom);
      if (exportTo) params.append('to', exportTo);
      params.append('format', exportFormat);
      const response = await fetch(`/api/form-submissions/export?${params.toString()}`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.message || err?.error || 'Export failed');
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `submissions.${exportFormat}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportDialogOpen(false);
      toast({ title: 'Export downloaded' });
    } catch (e: any) {
      toast({ title: 'Export failed', description: e?.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const handleEditForm = (form: FormItem) => {
    if (!form.isSystemTemplate) {
      setLocation(`/forms/${form.id}/edit`);
    }
  };

  const handleDeleteForm = (form: FormItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!form.isSystemTemplate) {
      setFormToDelete(form);
      setDeleteConfirmOpen(true);
    }
  };

  const handleUseTemplate = (form: FormItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (form.isSystemTemplate && form.templateKey) {
      createFromTemplateMutation.mutate(form.templateKey);
    }
  };

  const searchLower = formSearch.toLowerCase();
  const safetyForms = forms.filter(f => f.formType === 'safety' && f.isActive && (!formSearch || f.name.toLowerCase().includes(searchLower)));
  const complianceForms = forms.filter(f => f.formType === 'compliance' && f.isActive && (!formSearch || f.name.toLowerCase().includes(searchLower)));
  const inspectionForms = forms.filter(f => f.formType === 'inspection' && f.isActive && (!formSearch || f.name.toLowerCase().includes(searchLower)));

  const getFormTypeIcon = (formType: string) => {
    switch (formType) {
      case 'safety':
        return <Shield className="h-4 w-4" />;
      case 'compliance':
        return <ClipboardCheck className="h-4 w-4" />;
      case 'inspection':
        return <Search className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getFormTypeBadgeVariant = (formType: string): "default" | "secondary" | "outline" => {
    switch (formType) {
      case 'safety':
        return "default";
      case 'compliance':
        return "secondary";
      case 'inspection':
        return "outline";
      default:
        return "outline";
    }
  };

  const FORMS_VISIBLE_DEFAULT = 5;

  const renderFormRow = (form: FormItem) => (
    <div
      key={form.id}
      className={`flex items-center justify-between gap-2 py-2 px-3 border-b last:border-b-0 cursor-pointer transition-colors ${selectedForm?.id === form.id ? 'bg-primary/5' : 'hover-elevate'}`}
      onClick={() => setSelectedForm(form)}
      data-testid={`card-form-${form.id}`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div
          className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: "hsl(var(--trade) / 0.1)" }}
        >
          {getFormTypeIcon(form.formType || 'general')}
        </div>
        <span className="text-sm font-medium truncate">{form.name}</span>
        <Badge variant={getFormTypeBadgeVariant(form.formType || 'general')} className="text-xs capitalize flex-shrink-0">
          {form.formType || 'general'}
        </Badge>
        {form.requiresSignature && (
          <Badge variant="outline" className="text-xs flex-shrink-0">
            Sig
          </Badge>
        )}
        {form.isSystemTemplate && (
          <Badge variant="outline" className="text-xs flex-shrink-0">
            Template
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {form.isSystemTemplate ? (
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => handleUseTemplate(form, e)}
            data-testid={`button-use-template-${form.id}`}
            disabled={createFromTemplateMutation.isPending}
          >
            <Plus className="h-4 w-4" />
          </Button>
        ) : (
          <>
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleEditForm(form);
              }}
              data-testid={`button-edit-form-${form.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-destructive"
              onClick={(e) => handleDeleteForm(form, e)}
              data-testid={`button-delete-form-${form.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );

  const renderFormSection = (
    title: string,
    description: string,
    forms: FormItem[],
    icon: React.ReactNode,
    isOpen: boolean,
    setIsOpen: (open: boolean) => void,
    testId: string
  ) => {
    const isExpanded = expandedSections[testId] ?? false;
    const visibleForms = isExpanded ? forms : forms.slice(0, FORMS_VISIBLE_DEFAULT);
    const hasMore = forms.length > FORMS_VISIBLE_DEFAULT;

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card data-testid={testId}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover-elevate rounded-t-xl py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: "hsl(var(--trade) / 0.1)" }}
                  >
                    {icon}
                  </div>
                  <div>
                    <CardTitle className="text-base">{title}</CardTitle>
                    <CardDescription className="text-xs">{description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{forms.length}</Badge>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 px-0 pb-0">
              {forms.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground px-4">
                  <p className="text-sm">No {title.toLowerCase()} created yet</p>
                </div>
              ) : (
                <div>
                  {visibleForms.map(renderFormRow)}
                  {hasMore && (
                    <div className="px-3 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-muted-foreground"
                        onClick={() => setExpandedSections(prev => ({ ...prev, [testId]: !isExpanded }))}
                      >
                        {isExpanded ? 'Show less' : `Show all ${forms.length} forms`}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalForms = safetyForms.length + complianceForms.length + inspectionForms.length;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Form Templates</h2>
            <p className="text-sm text-muted-foreground">
              Safety, compliance, and inspection forms
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" data-testid="button-export-submissions" onClick={() => setExportDialogOpen(true)}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button size="sm" variant="outline" data-testid="button-ai-import" onClick={() => setAiImportOpen(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Rebuild with AI
            </Button>
            <Button size="sm" data-testid="button-create-form" onClick={() => setLocation('/forms/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Form
            </Button>
          </div>
        </div>
        <AIImportDialog open={aiImportOpen} onOpenChange={setAiImportOpen} onDraft={handleAiDraft} />

        {totalForms === 0 && !formSearch ? (
          <Card className="p-6 text-center">
            <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-semibold mb-2">No forms yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create safety checklists, compliance forms, and inspection templates for your job sites.
            </p>
            <Button size="sm" data-testid="button-create-form-empty" onClick={() => setLocation('/forms/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Form
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search forms..."
                value={formSearch}
                onChange={(e) => setFormSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {formSearch && totalForms === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No forms matching "{formSearch}"</p>
              </div>
            ) : (
            <>
            {renderFormSection(
              "Safety Forms",
              "SWMS, JSA, and safety checklists",
              safetyForms,
              <Shield className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />,
              safetyFormsOpen,
              setSafetyFormsOpen,
              "card-safety-forms"
            )}

            {renderFormSection(
              "Compliance Forms",
              "Regulatory and compliance documentation",
              complianceForms,
              <ClipboardCheck className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />,
              complianceFormsOpen,
              setComplianceFormsOpen,
              "card-compliance-forms"
            )}

            {renderFormSection(
              "Inspection Forms",
              "Site inspections and quality checks",
              inspectionForms,
              <Search className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />,
              inspectionFormsOpen,
              setInspectionFormsOpen,
              "card-inspection-forms"
            )}

            <Card data-testid="card-swms">
              <CardHeader className="pb-2 cursor-pointer" onClick={() => setSwmsTemplatesOpen(!swmsTemplatesOpen)}>
                <CardTitle className="text-sm font-medium flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2">
                    <Shield className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                    <div>
                      <div>SWMS</div>
                      <div className="text-xs font-normal text-muted-foreground">Safe Work Method Statements for high-risk work</div>
                    </div>
                  </span>
                  <Badge variant="secondary" className="text-xs">{mySwmsDocs.length + swmsTemplates.length}</Badge>
                </CardTitle>
              </CardHeader>
              {swmsTemplatesOpen && (
                <CardContent className="pt-0 space-y-5">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2 pb-1">Your SWMS</p>
                    {mySwmsDocs.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2 px-2">
                        No SWMS yet. Pick a template below and customise it to create your first one.
                      </p>
                    ) : (
                      mySwmsDocs.map((doc: any) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between gap-3 p-2 rounded-md hover-elevate cursor-pointer"
                          onClick={() => setSelectedForm({
                            id: `swms-doc-${doc.id}`,
                            name: doc.title,
                            description: doc.description || '',
                            formType: 'safety',
                            fields: [],
                            settings: {},
                            requiresSignature: true,
                            isActive: true,
                            userId: doc.userId,
                            createdAt: doc.createdAt,
                            updatedAt: doc.updatedAt,
                          } as any)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm truncate">{doc.title}</span>
                            <Badge variant={doc.status === 'active' ? 'default' : 'secondary'} className="text-xs shrink-0 capitalize">{doc.status || 'draft'}</Badge>
                            {doc.hazardCount > 0 && (
                              <span className="text-xs text-muted-foreground shrink-0">{doc.hazardCount} hazards</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSwmsBuilderSwmsId(doc.id);
                                setSwmsBuilderTitle(doc.title);
                                setSwmsBuilderOpen(true);
                              }}
                              data-testid={`button-edit-swms-${doc.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSwmsToDelete(doc);
                                setSwmsDeleteConfirmOpen(true);
                              }}
                              data-testid={`button-delete-swms-${doc.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2 pb-1">Start from a template</p>
                    {swmsTemplates.map((template: any) => (
                      <div
                        key={template.id}
                        className="flex items-center justify-between gap-3 p-2 rounded-md hover-elevate cursor-pointer"
                        onClick={() => setSelectedForm({
                          id: `swms-${template.id}`,
                          name: template.title,
                          description: template.description || '',
                          formType: 'safety',
                          fields: (template.hazards || []).map((h: any, i: number) => ({
                            id: `hazard-${i}`,
                            type: 'text',
                            label: `${h.activityTask}: ${h.hazard}`,
                            required: false,
                          })),
                          settings: {},
                          requiresSignature: true,
                          isActive: true,
                          userId: '',
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                          isSystemTemplate: true,
                          templateKey: template.id,
                          _swmsTemplate: template,
                        } as any)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate">{template.title}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{template.hazards?.length || 0} hazards</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            swmsCreateFromTemplateMutation.mutate(template);
                          }}
                          disabled={swmsCreateFromTemplateMutation.isPending}
                          data-testid={`button-customize-swms-${template.id}`}
                        >
                          {swmsCreateFromTemplateMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              Customise
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
            </>
            )}
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Preview</h2>
          <p className="text-sm text-muted-foreground">
            {selectedForm ? `Preview: ${selectedForm.name}` : "Select a form to preview"}
          </p>
        </div>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-muted/30 p-4">
              <div className="bg-white rounded-lg shadow-sm overflow-hidden" style={{ maxHeight: '600px', overflow: 'auto' }}>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    {business?.logoUrl && (
                      <img src={business.logoUrl} alt="Logo" className="h-12 w-auto object-contain" />
                    )}
                    <div>
                      <h3 className="font-bold text-lg" style={{ color: '#1f3a5f' }}>
                        {business?.businessName || 'Your Business'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedForm?.name || 'Safety Checklist'}
                      </p>
                    </div>
                  </div>
                  
                  {selectedForm ? (
                    <div className="space-y-4 border-t pt-4">
                      {selectedForm.description && (
                        <p className="text-sm text-muted-foreground">{selectedForm.description}</p>
                      )}
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={getFormTypeBadgeVariant(selectedForm.formType || 'general')} className="capitalize">
                          {getFormTypeIcon(selectedForm.formType || 'general')}
                          <span className="ml-1">{(selectedForm as any)._swmsTemplate ? 'SWMS' : (selectedForm.formType || 'General')}</span>
                        </Badge>
                        {selectedForm.requiresSignature && (
                          <Badge variant="outline">Requires Signature</Badge>
                        )}
                        {selectedForm.tradeType && selectedForm.tradeType !== 'general' && (
                          <Badge variant="secondary" className="capitalize">{selectedForm.tradeType}</Badge>
                        )}
                      </div>

                      {(selectedForm as any)._swmsTemplate ? (
                        <div className="space-y-3 border-t pt-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hazard Assessment</p>
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-1 pr-2">Activity</th>
                                <th className="text-left py-1 pr-2">Hazard</th>
                                <th className="text-left py-1">Risk</th>
                              </tr>
                            </thead>
                            <tbody>
                              {((selectedForm as any)._swmsTemplate.hazards || []).slice(0, 5).map((h: any, i: number) => (
                                <tr key={i} className="border-b border-muted">
                                  <td className="py-1 pr-2">{h.activityTask}</td>
                                  <td className="py-1 pr-2">{h.hazard}</td>
                                  <td className="py-1">
                                    <Badge variant="outline" className={`text-[10px] py-0 ${
                                      h.riskBefore === 'high' || h.riskBefore === 'extreme' 
                                        ? 'border-red-500 text-red-600 dark:text-red-400' 
                                        : h.riskBefore === 'medium' 
                                          ? 'border-orange-500 text-orange-600 dark:text-orange-400' 
                                          : 'border-green-500 text-green-600 dark:text-green-400'
                                    }`}>
                                      {(h.riskBefore || 'medium').toUpperCase()}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {((selectedForm as any)._swmsTemplate.hazards || []).length > 5 && (
                            <p className="text-xs text-muted-foreground">+{(selectedForm as any)._swmsTemplate.hazards.length - 5} more hazards...</p>
                          )}
                          {(selectedForm as any)._swmsTemplate.ppeRequirements?.length > 0 && (
                            <div className="border-t pt-3">
                              <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-muted-foreground">PPE Requirements</p>
                              <div className="flex flex-wrap gap-1">
                                {(selectedForm as any)._swmsTemplate.ppeRequirements.map((ppe: string) => (
                                  <Badge key={ppe} variant="secondary" className="text-xs capitalize">
                                    {ppe.replace(/_/g, ' ')}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="border-t pt-3 mt-3">
                            <p className="text-xs text-muted-foreground">Worker sign-off required</p>
                            <div className="h-16 border-2 border-dashed rounded mt-2" />
                          </div>
                        </div>
                      ) : (
                      <div className="space-y-3 border-t pt-4">
                        {Array.isArray(selectedForm.fields) && selectedForm.fields.length > 0 ? (
                          (selectedForm.fields as Array<{ label?: string; name?: string; type?: string }>).slice(0, 5).map((field, index) => {
                            const fieldLabel = field.label || field.name || `${(field.type || 'field').charAt(0).toUpperCase() + (field.type || 'field').slice(1)} ${index + 1}`;
                            return (
                              <div key={index} className="flex items-center gap-2">
                                {field.type === 'checkbox' ? (
                                  <div className="w-4 h-4 border-2 rounded flex-shrink-0" />
                                ) : field.type === 'textarea' ? (
                                  <div className="w-4 h-4 border-2 rounded flex-shrink-0 flex items-center justify-center">
                                    <div className="w-2.5 h-0.5 bg-muted-foreground/30" />
                                  </div>
                                ) : (
                                  <div className="w-4 h-4 border-2 rounded-full flex-shrink-0" />
                                )}
                                <span className="text-sm">{fieldLabel}</span>
                              </div>
                            );
                          })
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 rounded flex-shrink-0" />
                              <span className="text-sm">Sample checklist item</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 rounded flex-shrink-0" />
                              <span className="text-sm">Another item to verify</span>
                            </div>
                          </>
                        )}
                        
                        {Array.isArray(selectedForm.fields) && selectedForm.fields.length > 5 && (
                          <p className="text-xs text-muted-foreground">
                            +{selectedForm.fields.length - 5} more fields...
                          </p>
                        )}
                      </div>
                      )}

                      {selectedForm.requiresSignature && !(selectedForm as any)._swmsTemplate && (
                        <div className="border-t pt-3 mt-3">
                          <p className="text-xs text-muted-foreground">Signature required</p>
                          <div className="h-16 border-2 border-dashed rounded mt-2" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 border-t pt-4">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 rounded" />
                        <span className="text-sm">Site hazards identified</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 rounded" />
                        <span className="text-sm">PPE requirements verified</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 rounded" />
                        <span className="text-sm">Emergency exits noted</span>
                      </div>
                      <div className="border-t pt-3 mt-3">
                        <p className="text-xs text-muted-foreground">Signature required</p>
                        <div className="h-16 border-2 border-dashed rounded mt-2" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Form</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{formToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFormToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => formToDelete && deleteMutation.mutate(formToDelete.id)}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Submissions
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Form</Label>
              <Select value={exportFormId} onValueChange={setExportFormId}>
                <SelectTrigger data-testid="select-export-form">
                  <SelectValue placeholder="Select a form" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All job cards</SelectItem>
                  {customForms.filter(f => f.isActive).map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>From (optional)</Label>
                <Input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} data-testid="input-export-from" />
              </div>
              <div className="space-y-2">
                <Label>To (optional)</Label>
                <Input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} data-testid="input-export-to" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as 'csv' | 'tsv')}>
                <SelectTrigger data-testid="select-export-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (Excel)</SelectItem>
                  <SelectItem value="tsv">TSV (tab-separated)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleExportSubmissions}
              disabled={exporting}
              data-testid="button-download-export"
            >
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={swmsDeleteConfirmOpen} onOpenChange={setSwmsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete SWMS Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{swmsToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSwmsToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => swmsToDelete && swmsDeleteMutation.mutate(swmsToDelete.id)}
              className="bg-destructive text-destructive-foreground"
            >
              {swmsDeleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={swmsBuilderOpen} onOpenChange={(open) => {
        setSwmsBuilderOpen(open);
        if (!open) {
          setSwmsBuilderSwmsId(undefined);
          setSwmsBuilderTitle('');
          queryClient.invalidateQueries({ queryKey: ["/api/swms"] });
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{swmsBuilderTitle ? `Edit: ${swmsBuilderTitle}` : 'SWMS Builder'}</DialogTitle>
          </DialogHeader>
          {swmsBuilderOpen && (
            <SwmsBuilder
              jobId=""
              swmsId={swmsBuilderSwmsId}
              onClose={() => {
                setSwmsBuilderOpen(false);
                setSwmsBuilderSwmsId(undefined);
                setSwmsBuilderTitle('');
                queryClient.invalidateQueries({ queryKey: ["/api/swms"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const MESSAGING_MERGE_FIELDS = [
  '{{clientName}}',
  '{{jobTitle}}',
  '{{amount}}',
  '{{invoiceNumber}}',
  '{{quoteNumber}}',
  '{{businessName}}',
  '{{dueDate}}',
];

const SMS_MAX_CHARS = 320;

function MessagingTemplatesTab() {
  const { templates, getTemplatesForFamily, createTemplate, updateTemplate, deleteTemplate, activateTemplate, isLoading } = useBusinessTemplates();
  const { toast } = useToast();
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const channelTemplates = getTemplatesForFamily(channel);
  const channelPurposes = getPurposesForFamily(channel);
  const channelLabel = channel === 'email' ? 'Email' : 'SMS';

  const [selectedTemplate, setSelectedTemplate] = useState<BusinessTemplate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BusinessTemplate | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<BusinessTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    purpose: 'quote_sent' as BusinessTemplatePurpose,
    subject: '',
    content: '',
  });

  const handleChannelSwitch = (newChannel: 'email' | 'sms') => {
    setChannel(newChannel);
    setSelectedTemplate(null);
    setFormData({
      name: '',
      purpose: newChannel === 'email' ? 'quote_sent' : 'sms_quote_sent',
      subject: '',
      content: '',
    });
  };

  const grouped = channelPurposes.reduce((acc, purpose) => {
    acc[purpose] = channelTemplates.filter(t => t.purpose === purpose);
    return acc;
  }, {} as Record<string, BusinessTemplate[]>);

  const resetFormData = () => {
    setFormData({
      name: '',
      purpose: channel === 'email' ? 'quote_sent' : 'sms_quote_sent',
      subject: '',
      content: '',
    });
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTemplate(null);
    resetFormData();
  };

  const handleEditTemplate = (template: BusinessTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      purpose: template.purpose,
      subject: template.subject || '',
      content: template.content || '',
    });
    setDialogOpen(true);
  };

  const handleDeleteTemplate = (template: BusinessTemplate) => {
    setTemplateToDelete(template);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;
    try {
      await deleteTemplate(templateToDelete.id);
      toast({ title: `${channelLabel} template deleted` });
      if (selectedTemplate?.id === templateToDelete.id) setSelectedTemplate(null);
    } catch {
      toast({ title: "Failed to delete template", variant: "destructive" });
    }
    setDeleteConfirmOpen(false);
    setTemplateToDelete(null);
  };

  const handleActivate = async (template: BusinessTemplate) => {
    try {
      await activateTemplate(template.id);
      toast({ title: `"${template.name}" set as active` });
    } catch {
      toast({ title: "Failed to activate template", variant: "destructive" });
    }
  };

  const insertMergeField = (field: string) => {
    const textarea = contentRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = formData.content.substring(0, start) + field + formData.content.substring(end);
      if (channel === 'sms' && newContent.length > SMS_MAX_CHARS) return;
      setFormData(prev => ({ ...prev, content: newContent }));
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + field.length, start + field.length);
      }, 0);
    } else {
      const newContent = formData.content + field;
      if (channel === 'sms' && newContent.length > SMS_MAX_CHARS) return;
      setFormData(prev => ({ ...prev, content: newContent }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Template name is required", variant: "destructive" });
      return;
    }
    if (!formData.content.trim()) {
      toast({ title: "Template content is required", variant: "destructive" });
      return;
    }
    try {
      const payload: Partial<BusinessTemplate> = {
        name: formData.name,
        purpose: formData.purpose,
        content: formData.content,
      };
      if (channel === 'email') {
        payload.subject = formData.subject || null;
      }
      if (editingTemplate) {
        await updateTemplate({
          id: editingTemplate.id,
          data: payload,
        });
        toast({ title: `${channelLabel} template updated` });
      } else {
        await createTemplate({
          family: channel,
          ...payload,
        });
        toast({ title: `${channelLabel} template created` });
      }
      handleCloseDialog();
    } catch {
      toast({ title: `Failed to ${editingTemplate ? 'update' : 'create'} template`, variant: "destructive" });
    }
  };

  const highlightMergeFields = (text: string) => {
    const parts = text.split(/(\{\{[^}]+\}\})/g);
    return parts.map((part, i) => {
      if (part.match(/^\{\{[^}]+\}\}$/)) {
        return (
          <span key={i} className="inline-block px-1 rounded bg-primary/10 text-primary font-medium text-xs">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const charCount = formData.content.length;
  const smsSegments = charCount <= 160 ? 1 : Math.ceil(charCount / 153);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <Button size="sm" variant={channel === 'email' ? 'default' : 'ghost'} onClick={() => handleChannelSwitch('email')}>
          <Mail className="h-4 w-4 mr-1" /> Email
        </Button>
        <Button size="sm" variant={channel === 'sms' ? 'default' : 'ghost'} onClick={() => handleChannelSwitch('sms')}>
          <MessageSquare className="h-4 w-4 mr-1" /> SMS
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">{channelLabel} Templates</h2>
              <p className="text-sm text-muted-foreground">
                {channel === 'email' ? 'Email templates for client communications' : 'Text message templates for client notifications'}
              </p>
            </div>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {channelTemplates.length} template{channelTemplates.length !== 1 ? "s" : ""}
          </p>

          {channelTemplates.length === 0 ? (
            <Card className="p-6 text-center">
              {channel === 'email' ? (
                <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              ) : (
                <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              )}
              <h3 className="font-semibold mb-2">No {channelLabel.toLowerCase()} templates</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create {channelLabel.toLowerCase()} templates for automated client {channel === 'email' ? 'communications' : 'notifications'}
              </p>
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Create Template
              </Button>
            </Card>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4 pr-3">
                {channelPurposes.map((purpose) => {
                  const purposeTemplates = grouped[purpose] || [];
                  if (purposeTemplates.length === 0) return null;
                  return (
                    <div key={purpose}>
                      <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                        {PURPOSE_LABELS[purpose]}
                      </p>
                      <div className="space-y-2">
                        {purposeTemplates.map((template) => {
                          const isSelected = selectedTemplate?.id === template.id;
                          return (
                            <div
                              key={template.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                isSelected ? 'ring-2 ring-primary bg-primary/5' : 'bg-muted/30 hover-elevate'
                              }`}
                              onClick={() => setSelectedTemplate(template)}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium truncate">{template.name}</p>
                                  {template.isActive && (
                                    <Badge variant="default" className="text-xs">
                                      <Check className="h-3 w-3 mr-1" />
                                      Active
                                    </Badge>
                                  )}
                                </div>
                                {channel === 'email' && template.subject && (
                                  <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                                    Subject: {template.subject}
                                  </p>
                                )}
                                <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                                  {template.content}
                                </p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <Badge variant="outline" className="text-xs">
                                    {PURPOSE_LABELS[template.purpose]}
                                  </Badge>
                                  {channel === 'sms' && (
                                    <span className="text-xs text-muted-foreground">
                                      {template.content?.length || 0} chars
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {!template.isActive && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    title="Set as active"
                                    onClick={(e) => { e.stopPropagation(); handleActivate(template); }}
                                  >
                                    <Star className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={(e) => { e.stopPropagation(); handleEditTemplate(template); }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template); }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Template Preview</h2>
            <p className="text-sm text-muted-foreground">
              {selectedTemplate ? selectedTemplate.name : "Select a template to preview"}
            </p>
          </div>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-muted/30 p-4">
                <div className="bg-white dark:bg-card rounded-lg shadow-sm overflow-hidden" style={{ maxHeight: '600px', overflow: 'auto' }}>
                  <div className="p-6">
                    {selectedTemplate ? (
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-bold text-lg">{selectedTemplate.name}</h3>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="secondary">
                              {PURPOSE_LABELS[selectedTemplate.purpose]}
                            </Badge>
                            {selectedTemplate.isActive && (
                              <Badge variant="default" className="text-xs">
                                <Check className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            )}
                            {channel === 'sms' && (
                              <span className="text-xs text-muted-foreground">
                                {selectedTemplate.content?.length || 0} / {SMS_MAX_CHARS} chars
                              </span>
                            )}
                          </div>
                        </div>

                        {channel === 'email' && selectedTemplate.subject && (
                          <div className="border-t pt-4">
                            <h4 className="font-medium text-sm mb-2">Subject Line</h4>
                            <div className="p-3 rounded-lg bg-muted/50 border">
                              <p className="text-sm font-medium">
                                {highlightMergeFields(selectedTemplate.subject)}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="border-t pt-4">
                          <h4 className="font-medium text-sm mb-3">
                            {channel === 'email' ? 'Email Body' : 'Message Content'}
                          </h4>
                          <div className="p-4 rounded-lg bg-muted/50 border">
                            <div className="flex items-start gap-3">
                              {channel === 'email' ? (
                                <Mail className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                              ) : (
                                <MessageSquare className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                              )}
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                {highlightMergeFields(selectedTemplate.content || '')}
                              </p>
                            </div>
                          </div>
                          {channel === 'sms' && (
                            <p className="text-xs text-muted-foreground mt-2">
                              {(selectedTemplate.content?.length || 0) <= 160
                                ? '1 SMS segment'
                                : `${Math.ceil((selectedTemplate.content?.length || 0) / 153)} SMS segments`}
                            </p>
                          )}
                        </div>

                        <div className="border-t pt-4">
                          <h4 className="font-medium text-sm mb-2">Merge Fields Used</h4>
                          <div className="flex gap-2 flex-wrap">
                            {MESSAGING_MERGE_FIELDS.filter(f => {
                              const inContent = selectedTemplate.content?.includes(f);
                              const inSubject = channel === 'email' && selectedTemplate.subject?.includes(f);
                              return inContent || inSubject;
                            }).map(field => (
                              <Badge key={field} variant="outline" className="text-xs font-mono">
                                {field}
                              </Badge>
                            ))}
                            {!MESSAGING_MERGE_FIELDS.some(f => {
                              const inContent = selectedTemplate.content?.includes(f);
                              const inSubject = channel === 'email' && selectedTemplate.subject?.includes(f);
                              return inContent || inSubject;
                            }) && (
                              <p className="text-xs text-muted-foreground">No merge fields used</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        {channel === 'email' ? (
                          <Mail className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        ) : (
                          <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        )}
                        <p className="font-medium">Select a template</p>
                        <p className="text-sm mt-1">Click a template from the list to preview its content</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? `Edit ${channelLabel} Template` : `Create ${channelLabel} Template`}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="msg-template-name">Template Name</Label>
              <Input
                id="msg-template-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Quote Sent Notification"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="msg-template-purpose">Purpose</Label>
              <Select
                value={formData.purpose}
                onValueChange={(v) => setFormData({ ...formData, purpose: v as BusinessTemplatePurpose })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {channelPurposes.map(p => (
                    <SelectItem key={p} value={p}>{PURPOSE_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {channel === 'email' && (
              <div className="space-y-2">
                <Label htmlFor="msg-template-subject">Subject Line</Label>
                <Input
                  id="msg-template-subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g., Your Quote from {{businessName}}"
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="msg-template-content">
                  {channel === 'email' ? 'Email Body' : 'Message Content'}
                </Label>
                {channel === 'sms' && (
                  <span className={`text-xs ${charCount > SMS_MAX_CHARS ? 'text-destructive font-medium' : charCount > 160 ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'}`}>
                    {charCount} / {SMS_MAX_CHARS}
                    {charCount > 0 && ` (${smsSegments} SMS${smsSegments > 1 ? ' segments' : ''})`}
                  </span>
                )}
              </div>
              <Textarea
                ref={contentRef}
                id="msg-template-content"
                value={formData.content}
                onChange={(e) => {
                  if (channel === 'sms') {
                    if (e.target.value.length <= SMS_MAX_CHARS) {
                      setFormData({ ...formData, content: e.target.value });
                    }
                  } else {
                    setFormData({ ...formData, content: e.target.value });
                  }
                }}
                placeholder={channel === 'email'
                  ? "Hi {{clientName}},\n\nPlease find your quote attached..."
                  : "Hi {{clientName}}, your quote #{{quoteNumber}} is ready..."}
                rows={channel === 'email' ? 8 : 4}
                className="resize-none text-sm"
              />
              {channel === 'sms' && charCount <= 160 && (
                <p className="text-xs text-muted-foreground">
                  Keep under 160 characters for a single SMS segment
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Available Merge Fields (click to insert)</Label>
              <div className="flex gap-1.5 flex-wrap">
                {MESSAGING_MERGE_FIELDS.map(field => (
                  <Badge
                    key={field}
                    variant="outline"
                    className="text-xs font-mono cursor-pointer"
                    onClick={() => insertMergeField(field)}
                  >
                    {field}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name.trim() || !formData.content.trim()}
            >
              {editingTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {channelLabel} Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{templateToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTemplateToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function TemplatesHub() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(search);
  const tabParam = searchParams.get('tab');
  const typeParam = searchParams.get('type');
  const templateType = ['quote', 'invoice', 'job'].includes(typeParam || '')
    ? (typeParam as 'quote' | 'invoice' | 'job')
    : 'job';
  const activeTab = ['styles', 'components', 'price-list', 'quick-templates', 'sms-templates', 'job-cards', 'forms'].includes(tabParam || '')
    ? (tabParam as string)
    : 'styles';
  return (
    <PageShell>
      <PageHeader
        title="Templates Hub"
        subtitle="Customize your document styles, components, and forms"
        leading={<Palette className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />}
      />

      <div className="mt-6">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setLocation(`/templates?tab=${v}`)}
          className="space-y-6"
        >
          <TabsList>
            <TabsTrigger value="styles" className="gap-2">
              <Palette className="h-4 w-4" />
              Styles
            </TabsTrigger>
            <TabsTrigger value="components" className="gap-2">
              <Layers className="h-4 w-4" />
              Components
            </TabsTrigger>
            <TabsTrigger value="price-list" className="gap-2" data-testid="tab-price-list">
              <Tag className="h-4 w-4" />
              Price List
            </TabsTrigger>
            <TabsTrigger value="quick-templates" className="gap-2">
              <Briefcase className="h-4 w-4" />
              Quick Templates
            </TabsTrigger>
            <TabsTrigger value="sms-templates" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Messaging
            </TabsTrigger>
            <TabsTrigger value="job-cards" className="gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Job Cards
            </TabsTrigger>
            <TabsTrigger value="forms" className="gap-2">
              <FileText className="h-4 w-4" />
              Forms & Safety
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="styles">
            <StylePresetsWithPreview />
          </TabsContent>
          
          <TabsContent value="components">
            <ComponentsTab />
          </TabsContent>

          <TabsContent value="price-list">
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Price List</h2>
                <p className="text-sm text-muted-foreground">
                  Save your services, materials, and equipment with fixed prices so you can drop them onto quotes and invoices in seconds. Material items automatically get your markup applied.
                </p>
              </div>
              <PriceListSection />
            </div>
          </TabsContent>
          
          <TabsContent value="quick-templates">
            <TemplateManagement key={templateType} embedded defaultType={templateType} />
          </TabsContent>
          
          <TabsContent value="sms-templates">
            <MessagingTemplatesTab />
          </TabsContent>
          
          <TabsContent value="job-cards">
            <JobCardsTab />
          </TabsContent>
          
          <TabsContent value="forms">
            <FormsTab />
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}
