import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Check, FileText, Sparkles, MinusSquare, Settings2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  DOCUMENT_TEMPLATES, 
  TemplateId, 
  getTemplateStyles, 
  TemplateCustomization,
  DOCUMENT_ACCENT_COLOR 
} from "@/lib/document-templates";

interface DocumentTemplateSelectorProps {
  selectedTemplate: TemplateId;
  onSelectTemplate: (templateId: TemplateId) => void;
  customization?: TemplateCustomization;
  onCustomizationChange?: (customization: TemplateCustomization) => void;
  brandColor?: string;
}

function MiniDocumentPreview({ 
  templateId, 
  brandColor = '#2563eb',
  isSelected = false,
  customization
}: { 
  templateId: TemplateId; 
  brandColor?: string;
  isSelected?: boolean;
  customization?: TemplateCustomization;
}) {
  const { template, primaryColor, tableHeaderStyle, getNoteStyle } = getTemplateStyles(templateId, brandColor, customization);
  
  return (
    <div 
      className={cn(
        "relative rounded-lg border-2 overflow-hidden transition-all duration-200",
        isSelected 
          ? "border-primary ring-2 ring-primary/20" 
          : "border-border hover:border-primary/50"
      )}
      style={{ fontFamily: template.fontFamily, fontSize: '6px' }}
    >
      {isSelected && (
        <div className="absolute top-2 right-2 z-10">
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <Check className="w-3 h-3 text-primary-foreground" />
          </div>
        </div>
      )}
      
      {/* Mini document preview */}
      <div className="bg-white p-3">
        {/* Header */}
        <div 
          className="flex justify-between items-start mb-2 pb-1"
          style={{ 
            borderBottom: template.showHeaderDivider 
              ? `${template.headerBorderWidth} solid ${primaryColor}` 
              : 'none' 
          }}
        >
          <div className="flex items-center gap-1">
            <div 
              className="w-4 h-4 rounded flex items-center justify-center"
              style={{ backgroundColor: primaryColor + '20' }}
            >
              <div 
                className="w-2 h-2 rounded-sm"
                style={{ backgroundColor: primaryColor }}
              />
            </div>
            <div>
              <div 
                className="font-bold text-[5px]"
                style={{ color: primaryColor, fontFamily: template.headingFont, fontWeight: template.headingWeight }}
              >
                ACME PLUMBING
              </div>
              <div className="text-[4px] text-gray-500" style={{ fontWeight: template.bodyWeight }}>ABN: 12 345 678 901</div>
            </div>
          </div>
          <div className="text-right">
            <div 
              className="font-bold text-[6px] tracking-wide"
              style={{ color: primaryColor, fontFamily: template.headingFont, fontWeight: template.headingWeight }}
            >
              TAX INVOICE
            </div>
            <div className="text-[4px] text-gray-500">#INV-001</div>
          </div>
        </div>
        
        {/* Table preview */}
        <div className="mb-2">
          <div 
            className="flex text-[4px] py-0.5 px-1 mb-0.5"
            style={{ 
              backgroundColor: tableHeaderStyle.backgroundColor,
              color: tableHeaderStyle.color,
              borderRadius: template.borderRadius,
            }}
          >
            <span className="flex-1">Description</span>
            <span className="w-6 text-right">Qty</span>
            <span className="w-8 text-right">Amount</span>
          </div>
          {[1, 2, 3].map((i) => (
            <div 
              key={i} 
              className="flex text-[4px] py-0.5 px-1"
              style={{
                backgroundColor: template.tableStyle === 'striped' && i % 2 === 0 ? '#f9fafb' : 'transparent',
                borderBottom: template.tableStyle === 'bordered' ? '0.5px solid #eee' : 'none',
                fontWeight: template.bodyWeight,
              }}
            >
              <span className="flex-1 text-gray-600">Line item {i}</span>
              <span className="w-6 text-right text-gray-600">{i}</span>
              <span className="w-8 text-right text-gray-600">${(i * 150).toFixed(0)}</span>
            </div>
          ))}
        </div>
        
        {/* Total */}
        <div className="flex justify-end">
          <div 
            className="text-right px-1 py-0.5"
            style={{ borderTop: `1px solid ${primaryColor}` }}
          >
            <div className="flex justify-between gap-3 text-[5px]">
              <span className="font-bold" style={{ color: primaryColor }}>Total</span>
              <span className="font-bold" style={{ color: primaryColor }}>$600.00</span>
            </div>
          </div>
        </div>
        
        {/* Notes preview */}
        <div 
          className="mt-2 p-1 text-[4px] text-gray-500"
          style={getNoteStyle()}
        >
          Additional notes...
        </div>
      </div>
    </div>
  );
}

// Large preview for customization section
function LargeDocumentPreview({ 
  templateId, 
  brandColor = '#2563eb',
  customization
}: { 
  templateId: TemplateId; 
  brandColor?: string;
  customization?: TemplateCustomization;
}) {
  const { template, primaryColor, tableHeaderStyle, getNoteStyle } = getTemplateStyles(templateId, brandColor, customization);
  
  return (
    <div 
      className="rounded-lg border-2 border-border overflow-hidden bg-white"
      style={{ fontFamily: template.fontFamily, fontSize: '10px' }}
    >
      <div className="p-4">
        {/* Header */}
        <div 
          className="flex justify-between items-start mb-4 pb-2"
          style={{ 
            borderBottom: template.showHeaderDivider 
              ? `${template.headerBorderWidth} solid ${primaryColor}` 
              : 'none' 
          }}
        >
          <div className="flex items-center gap-2">
            <div 
              className="w-8 h-8 rounded flex items-center justify-center"
              style={{ backgroundColor: primaryColor + '20' }}
            >
              <div 
                className="w-4 h-4 rounded-sm"
                style={{ backgroundColor: primaryColor }}
              />
            </div>
            <div>
              <div 
                className="text-sm"
                style={{ color: primaryColor, fontFamily: template.headingFont, fontWeight: template.headingWeight }}
              >
                ACME PLUMBING
              </div>
              <div className="text-[9px] text-gray-500" style={{ fontWeight: template.bodyWeight }}>ABN: 12 345 678 901</div>
            </div>
          </div>
          <div className="text-right">
            <div 
              className="text-sm tracking-wide"
              style={{ color: primaryColor, fontFamily: template.headingFont, fontWeight: template.headingWeight }}
            >
              TAX INVOICE
            </div>
            <div className="text-[9px] text-gray-500">#INV-001</div>
          </div>
        </div>
        
        {/* Table preview */}
        <div className="mb-3">
          <div 
            className="flex text-[9px] py-1 px-2 mb-1"
            style={{ 
              backgroundColor: tableHeaderStyle.backgroundColor,
              color: tableHeaderStyle.color,
              borderRadius: template.borderRadius,
              fontWeight: 600,
            }}
          >
            <span className="flex-1">Description</span>
            <span className="w-10 text-right">Qty</span>
            <span className="w-14 text-right">Amount</span>
          </div>
          {[1, 2, 3].map((i) => (
            <div 
              key={i} 
              className="flex text-[9px] py-1 px-2"
              style={{
                backgroundColor: template.tableStyle === 'striped' && i % 2 === 0 ? '#f9fafb' : 'transparent',
                borderBottom: template.tableStyle === 'bordered' ? '1px solid #eee' : 'none',
                fontWeight: template.bodyWeight,
              }}
            >
              <span className="flex-1 text-gray-600">Service line item {i}</span>
              <span className="w-10 text-right text-gray-600">{i}</span>
              <span className="w-14 text-right text-gray-600">${(i * 150).toFixed(2)}</span>
            </div>
          ))}
        </div>
        
        {/* Total */}
        <div className="flex justify-end mb-3">
          <div 
            className="text-right px-2 py-1"
            style={{ borderTop: `2px solid ${primaryColor}` }}
          >
            <div className="flex justify-between gap-4 text-[10px]" style={{ fontWeight: template.headingWeight }}>
              <span style={{ color: primaryColor }}>Total (inc GST)</span>
              <span style={{ color: primaryColor }}>$990.00</span>
            </div>
          </div>
        </div>
        
        {/* Notes preview */}
        <div 
          className="p-2 text-[9px] text-gray-500"
          style={{ ...getNoteStyle(), fontWeight: template.bodyWeight }}
        >
          Payment terms: 14 days. Thank you for your business.
        </div>
      </div>
    </div>
  );
}

export default function DocumentTemplateSelector({
  selectedTemplate,
  onSelectTemplate,
  customization = {},
  onCustomizationChange,
  brandColor = '#2563eb',
}: DocumentTemplateSelectorProps) {
  const templates = Object.values(DOCUMENT_TEMPLATES);
  const selectedBaseTemplate = DOCUMENT_TEMPLATES[selectedTemplate];
  
  const getTemplateIcon = (templateId: TemplateId) => {
    switch (templateId) {
      case 'modern':
        return <Sparkles className="h-4 w-4" />;
      case 'minimal':
        return <MinusSquare className="h-4 w-4" />;
      case 'professional':
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const handleCustomizationChange = (key: keyof TemplateCustomization, value: any) => {
    if (onCustomizationChange) {
      onCustomizationChange({
        ...customization,
        [key]: value,
      });
    }
  };

  const resetToDefaults = () => {
    if (onCustomizationChange) {
      onCustomizationChange({});
    }
  };

  const hasCustomizations = Object.keys(customization).length > 0;
  
  return (
    <div className="space-y-6 relative z-0">
      <div>
        <h3 className="text-lg font-semibold mb-2">Document Templates</h3>
        <p className="text-sm text-muted-foreground">
          Choose a template style for your quotes and invoices, then customise it to match your brand.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {templates.map((template) => {
          const isSelected = selectedTemplate === template.id;
          
          return (
            <Card 
              key={template.id}
              className={cn(
                "cursor-pointer transition-all duration-200 hover-elevate",
                isSelected && "ring-2 ring-primary"
              )}
              onClick={() => onSelectTemplate(template.id)}
              data-testid={`template-card-${template.id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getTemplateIcon(template.id)}
                    <CardTitle className="text-base">{template.name}</CardTitle>
                  </div>
                  {isSelected && (
                    <Badge variant="default" className="text-xs">
                      Active
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs line-clamp-2">
                  {template.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MiniDocumentPreview 
                  templateId={template.id} 
                  brandColor={brandColor}
                  isSelected={isSelected}
                  customization={isSelected ? customization : undefined}
                />
                
                <Button 
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className="w-full mt-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTemplate(template.id);
                  }}
                  data-testid={`button-select-template-${template.id}`}
                >
                  {isSelected ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Selected
                    </>
                  ) : (
                    'Select Template'
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Customization Section */}
      {onCustomizationChange && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Customise Template</CardTitle>
              </div>
              {hasCustomizations && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={resetToDefaults}
                  data-testid="button-reset-customizations"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Defaults
                </Button>
              )}
            </div>
            <CardDescription>
              Fine-tune the {selectedBaseTemplate.name} template to match your preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Controls */}
              <div className="space-y-6">
                {/* Table Style */}
                <div className="space-y-2">
                  <Label htmlFor="table-style">Table Style</Label>
                  <Select
                    value={customization.tableStyle || selectedBaseTemplate.tableStyle}
                    onValueChange={(value) => handleCustomizationChange('tableStyle', value)}
                  >
                    <SelectTrigger id="table-style" data-testid="select-table-style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bordered">Bordered - Traditional grid lines</SelectItem>
                      <SelectItem value="striped">Striped - Alternating row colours</SelectItem>
                      <SelectItem value="minimal">Minimal - Clean, no borders</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Note Style */}
                <div className="space-y-2">
                  <Label htmlFor="note-style">Notes Style</Label>
                  <Select
                    value={customization.noteStyle || selectedBaseTemplate.noteStyle}
                    onValueChange={(value) => handleCustomizationChange('noteStyle', value)}
                  >
                    <SelectTrigger id="note-style" data-testid="select-note-style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bordered">Bordered - Left accent bar</SelectItem>
                      <SelectItem value="highlighted">Highlighted - Subtle background</SelectItem>
                      <SelectItem value="simple">Simple - Plain text</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Header Border Width */}
                <div className="space-y-2">
                  <Label htmlFor="header-border">Header Border Width</Label>
                  <Select
                    value={customization.headerBorderWidth || selectedBaseTemplate.headerBorderWidth}
                    onValueChange={(value) => handleCustomizationChange('headerBorderWidth', value)}
                  >
                    <SelectTrigger id="header-border" data-testid="select-header-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1px">Thin (1px)</SelectItem>
                      <SelectItem value="2px">Medium (2px)</SelectItem>
                      <SelectItem value="3px">Thick (3px)</SelectItem>
                      <SelectItem value="4px">Extra Thick (4px)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Show Header Divider */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="show-header-divider">Show Header Divider</Label>
                    <p className="text-xs text-muted-foreground">Display a line under the header</p>
                  </div>
                  <Switch
                    id="show-header-divider"
                    checked={customization.showHeaderDivider ?? selectedBaseTemplate.showHeaderDivider}
                    onCheckedChange={(checked) => handleCustomizationChange('showHeaderDivider', checked)}
                    data-testid="switch-header-divider"
                  />
                </div>

                <Separator />

                {/* Body Font Weight */}
                <div className="space-y-2">
                  <Label htmlFor="body-weight">Body Text Weight</Label>
                  <Select
                    value={String(customization.bodyWeight || selectedBaseTemplate.bodyWeight)}
                    onValueChange={(value) => handleCustomizationChange('bodyWeight', Number(value))}
                  >
                    <SelectTrigger id="body-weight" data-testid="select-body-weight">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="400">Normal (400)</SelectItem>
                      <SelectItem value="500">Medium (500)</SelectItem>
                      <SelectItem value="600">Semibold (600)</SelectItem>
                      <SelectItem value="700">Bold (700)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Heading Font Weight */}
                <div className="space-y-2">
                  <Label htmlFor="heading-weight">Heading Weight</Label>
                  <Select
                    value={String(customization.headingWeight || selectedBaseTemplate.headingWeight)}
                    onValueChange={(value) => handleCustomizationChange('headingWeight', Number(value))}
                  >
                    <SelectTrigger id="heading-weight" data-testid="select-heading-weight">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="600">Semibold (600)</SelectItem>
                      <SelectItem value="700">Bold (700)</SelectItem>
                      <SelectItem value="800">Extra Bold (800)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Accent Color */}
                <div className="space-y-2">
                  <Label htmlFor="accent-color">Accent Colour</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      id="accent-color"
                      value={customization.accentColor || DOCUMENT_ACCENT_COLOR}
                      onChange={(e) => handleCustomizationChange('accentColor', e.target.value)}
                      className="w-10 h-10 rounded border cursor-pointer"
                      data-testid="input-accent-color"
                    />
                    <div className="flex-1 flex items-center">
                      <span className="text-sm text-muted-foreground">
                        {customization.accentColor || DOCUMENT_ACCENT_COLOR}
                      </span>
                    </div>
                    {customization.accentColor && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCustomizationChange('accentColor', undefined)}
                        data-testid="button-reset-accent-color"
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Used for headers, totals, and emphasis
                  </p>
                </div>
              </div>

              {/* Right: Live Preview */}
              <div className="space-y-3">
                <Label>Live Preview</Label>
                <LargeDocumentPreview 
                  templateId={selectedTemplate}
                  brandColor={brandColor}
                  customization={customization}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Template features comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Template Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4">Feature</th>
                  {templates.map((t) => (
                    <th key={t.id} className="text-center py-2 px-2">
                      {t.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 pr-4 text-muted-foreground">Default Table Style</td>
                  <td className="text-center py-2 px-2">Bordered</td>
                  <td className="text-center py-2 px-2">Striped</td>
                  <td className="text-center py-2 px-2">Minimal</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4 text-muted-foreground">Header Divider</td>
                  <td className="text-center py-2 px-2">Yes (2px)</td>
                  <td className="text-center py-2 px-2">Yes (3px)</td>
                  <td className="text-center py-2 px-2">No</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4 text-muted-foreground">Notes Style</td>
                  <td className="text-center py-2 px-2">Bordered</td>
                  <td className="text-center py-2 px-2">Highlighted</td>
                  <td className="text-center py-2 px-2">Simple</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-muted-foreground">Best For</td>
                  <td className="text-center py-2 px-2 text-xs">Traditional business</td>
                  <td className="text-center py-2 px-2 text-xs">Modern trades</td>
                  <td className="text-center py-2 px-2 text-xs">Clean aesthetic</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
