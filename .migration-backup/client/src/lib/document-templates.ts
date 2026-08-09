// Document Template System
// Defines visual styles for quotes and invoices

export type TemplateId = 'professional' | 'modern' | 'minimal';

export interface DocumentTemplate {
  id: TemplateId;
  name: string;
  description: string;
  fontFamily: string;
  headingFont: string;
  headerLayout: 'classic' | 'modern' | 'minimal';
  colorScheme: 'brand' | 'neutral' | 'bold';
  tableStyle: 'bordered' | 'striped' | 'minimal';
  // Typography settings
  baseFontSize: string;
  headingWeight: number;
  bodyWeight: number;
  // Visual styling
  borderRadius: string;
  headerBorderWidth: string;
  showHeaderDivider: boolean;
  // Section styling
  sectionBackground: string;
  noteStyle: 'bordered' | 'highlighted' | 'simple';
}

// Customization options that can override template defaults
export interface TemplateCustomization {
  tableStyle?: 'bordered' | 'striped' | 'minimal';
  noteStyle?: 'bordered' | 'highlighted' | 'simple';
  headerBorderWidth?: '1px' | '2px' | '3px' | '4px';
  showHeaderDivider?: boolean;
  bodyWeight?: 400 | 500 | 600 | 700;
  headingWeight?: 600 | 700 | 800;
  accentColor?: string; // Custom accent color override
}

// All templates use Inter font for consistent modern appearance
const INTER_FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export const DOCUMENT_TEMPLATES: Record<TemplateId, DocumentTemplate> = {
  professional: {
    id: 'professional',
    name: 'Professional',
    description: 'Traditional layout with bordered tables. Perfect for formal business documents.',
    fontFamily: INTER_FONT,
    headingFont: INTER_FONT,
    headerLayout: 'classic',
    colorScheme: 'neutral',
    tableStyle: 'bordered',
    baseFontSize: '11px',
    headingWeight: 700,
    bodyWeight: 600,
    borderRadius: '2px',
    headerBorderWidth: '2px',
    showHeaderDivider: true,
    sectionBackground: '#f8f9fa',
    noteStyle: 'bordered',
  },
  modern: {
    id: 'modern',
    name: 'Modern',
    description: 'Clean design with bold brand colors. Great for contemporary businesses.',
    fontFamily: INTER_FONT,
    headingFont: INTER_FONT,
    headerLayout: 'modern',
    colorScheme: 'brand',
    tableStyle: 'striped',
    baseFontSize: '12px',
    headingWeight: 700,
    bodyWeight: 600,
    borderRadius: '8px',
    headerBorderWidth: '3px',
    showHeaderDivider: true,
    sectionBackground: 'transparent',
    noteStyle: 'highlighted',
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Ultra-clean design with subtle styling. Lets your content speak for itself.',
    fontFamily: INTER_FONT,
    headingFont: INTER_FONT,
    headerLayout: 'minimal',
    colorScheme: 'neutral',
    tableStyle: 'minimal',
    baseFontSize: '11px',
    headingWeight: 700,
    bodyWeight: 600,
    borderRadius: '4px',
    headerBorderWidth: '1px',
    showHeaderDivider: false,
    sectionBackground: 'transparent',
    noteStyle: 'simple',
  },
};

// Fixed document accent color - consistent navy blue across all templates and PDFs
export const DOCUMENT_ACCENT_COLOR = '#1e3a5f';

// Helper to get template styles for inline application
// Now accepts optional customizations to override template defaults
export function getTemplateStyles(
  templateId: TemplateId, 
  _brandColor: string = '#2563eb',
  customization?: TemplateCustomization
) {
  const baseTemplate = DOCUMENT_TEMPLATES[templateId] || DOCUMENT_TEMPLATES.minimal;
  
  // Apply customizations if provided
  const template = {
    ...baseTemplate,
    tableStyle: customization?.tableStyle ?? baseTemplate.tableStyle,
    noteStyle: customization?.noteStyle ?? baseTemplate.noteStyle,
    headerBorderWidth: customization?.headerBorderWidth ?? baseTemplate.headerBorderWidth,
    showHeaderDivider: customization?.showHeaderDivider ?? baseTemplate.showHeaderDivider,
    bodyWeight: customization?.bodyWeight ?? baseTemplate.bodyWeight,
    headingWeight: customization?.headingWeight ?? baseTemplate.headingWeight,
  };
  
  // Use custom accent color if provided, otherwise use default
  const primaryColor = customization?.accentColor || DOCUMENT_ACCENT_COLOR;
  const accentColor = customization?.accentColor || DOCUMENT_ACCENT_COLOR;
  
  return {
    template,
    primaryColor,
    accentColor,
    // Container styles
    containerStyle: {
      fontFamily: template.fontFamily,
      fontSize: template.baseFontSize,
      fontWeight: template.bodyWeight,
      lineHeight: '1.5',
      color: '#1a1a1a',
    },
    // Header styles
    headerStyle: {
      borderBottomWidth: template.headerBorderWidth,
      borderBottomStyle: 'solid' as const,
      borderBottomColor: template.showHeaderDivider ? primaryColor : 'transparent',
    },
    // Heading styles
    headingStyle: {
      fontFamily: template.headingFont,
      fontWeight: template.headingWeight,
      color: primaryColor,
    },
    // Table header styles
    tableHeaderStyle: {
      backgroundColor: template.tableStyle === 'minimal' ? 'transparent' : primaryColor,
      color: template.tableStyle === 'minimal' ? '#1a1a1a' : '#ffffff',
      borderBottom: template.tableStyle === 'minimal' ? `2px solid ${primaryColor}` : 'none',
    },
    // Rounded corners for Modern template header cells
    tableHeaderRadius: template.headerLayout === 'modern' ? template.borderRadius : '0',
    // Table row styles - matches server/pdfService.ts generateDocumentStyles()
    getTableRowStyle: (index: number, isLast: boolean) => {
      // Server uses: striped rows have no border, minimal uses #e5e7eb, bordered uses #eee
      // Last row always has 2px solid brandColor border
      const base: React.CSSProperties = {
        borderBottom: isLast 
          ? `2px solid ${primaryColor}` 
          : template.tableStyle === 'striped'
            ? 'none'
            : template.tableStyle === 'minimal'
              ? '1px solid #e5e7eb'
              : '1px solid #eee', // bordered
        backgroundColor: template.tableStyle === 'striped' && index % 2 === 0 
          ? '#f9fafb' 
          : 'transparent',
      };
      return base;
    },
    // Section styles
    sectionStyle: {
      backgroundColor: template.sectionBackground,
      borderRadius: template.borderRadius,
    },
    // Note styles - matches server/pdfService.ts generateDocumentStyles()
    getNoteStyle: () => {
      switch (template.noteStyle) {
        case 'bordered':
          return {
            borderLeft: `4px solid ${primaryColor}`,
            backgroundColor: '#fafafa',
            borderRadius: '0 6px 6px 0', // Server hardcodes 6px
          };
        case 'highlighted':
          return {
            background: `linear-gradient(135deg, ${primaryColor}10, ${primaryColor}05)`,
            border: `1px solid ${primaryColor}30`,
            borderRadius: '8px', // Server hardcodes 8px
          };
        case 'simple':
        default:
          return {
            padding: '16px 0',
            background: 'transparent',
            borderTop: '1px solid #e5e7eb',
            borderLeft: 'none',
            borderRadius: 0,
          };
      }
    },
    // Border radius for cards/sections
    borderRadius: template.borderRadius,
  };
}

// Default template if none selected
export const DEFAULT_TEMPLATE: TemplateId = 'professional';
