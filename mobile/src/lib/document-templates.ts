// Document Template System - Mobile
// Matches web client/src/lib/document-templates.ts exactly

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
  baseFontSize: number;
  headingWeight: '600' | '700' | '800';
  bodyWeight: '400' | '500' | '600' | '700';
  borderRadius: number;
  headerBorderWidth: number;
  showHeaderDivider: boolean;
  sectionBackground: string;
  noteStyle: 'bordered' | 'highlighted' | 'simple';
}

export interface TemplateCustomization {
  tableStyle?: 'bordered' | 'striped' | 'minimal';
  noteStyle?: 'bordered' | 'highlighted' | 'simple';
  headerBorderWidth?: number | '1px' | '2px' | '3px' | '4px';
  showHeaderDivider?: boolean;
  bodyWeight?: '400' | '500' | '600' | '700' | 400 | 500 | 600 | 700;
  headingWeight?: '600' | '700' | '800' | 600 | 700 | 800;
  accentColor?: string;
  fontStyle?: 'default' | 'serif' | 'mono';
}

// All templates use system font for React Native
const SYSTEM_FONT = 'System';

export const DOCUMENT_TEMPLATES: Record<TemplateId, DocumentTemplate> = {
  professional: {
    id: 'professional',
    name: 'Professional',
    description: 'Traditional layout with bordered tables. Perfect for formal business documents.',
    fontFamily: SYSTEM_FONT,
    headingFont: SYSTEM_FONT,
    headerLayout: 'classic',
    colorScheme: 'neutral',
    tableStyle: 'bordered',
    baseFontSize: 11,
    headingWeight: '700',
    bodyWeight: '600',
    borderRadius: 2,
    headerBorderWidth: 2,
    showHeaderDivider: true,
    sectionBackground: '#f8f9fa',
    noteStyle: 'bordered',
  },
  modern: {
    id: 'modern',
    name: 'Modern',
    description: 'Clean design with bold brand colors. Great for contemporary businesses.',
    fontFamily: SYSTEM_FONT,
    headingFont: SYSTEM_FONT,
    headerLayout: 'modern',
    colorScheme: 'brand',
    tableStyle: 'striped',
    baseFontSize: 12,
    headingWeight: '700',
    bodyWeight: '600',
    borderRadius: 8,
    headerBorderWidth: 3,
    showHeaderDivider: true,
    sectionBackground: 'transparent',
    noteStyle: 'highlighted',
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Ultra-clean design with subtle styling. Lets your content speak for itself.',
    fontFamily: SYSTEM_FONT,
    headingFont: SYSTEM_FONT,
    headerLayout: 'minimal',
    colorScheme: 'neutral',
    tableStyle: 'minimal',
    baseFontSize: 11,
    headingWeight: '700',
    bodyWeight: '600',
    borderRadius: 4,
    headerBorderWidth: 1,
    showHeaderDivider: false,
    sectionBackground: 'transparent',
    noteStyle: 'simple',
  },
};

// Fixed document accent color - consistent navy blue across all templates and PDFs
export const DOCUMENT_ACCENT_COLOR = '#1e3a5f';

// Default template if none selected
export const DEFAULT_TEMPLATE: TemplateId = 'minimal';

export interface TemplateStyles {
  template: DocumentTemplate;
  primaryColor: string;
  accentColor: string;
  headingStyle: {
    fontWeight: string;
    color: string;
  };
  tableHeaderStyle: {
    backgroundColor: string;
    color: string;
    borderBottomWidth: number;
    borderBottomColor: string;
  };
  tableHeaderRadius: number;
  getTableRowStyle: (index: number, isLast: boolean) => {
    borderBottomWidth: number;
    borderBottomColor: string;
    backgroundColor: string;
  };
  getNoteStyle: () => {
    borderLeftWidth?: number;
    borderLeftColor?: string;
    backgroundColor: string;
    borderRadius: number;
    borderWidth?: number;
    borderColor?: string;
    paddingVertical?: number;
    borderTopWidth?: number;
    borderTopColor?: string;
  };
  /** Optional preview-only style hooks consumed by `src/components/DocumentPreview.tsx`. */
  headerStyle?: Record<string, unknown>;
  borderRadius?: number;
  sectionStyle?: Record<string, unknown>;
}

export function getTemplateStyles(
  templateId: TemplateId = DEFAULT_TEMPLATE,
  _brandColor: string = '#2563eb',
  customization?: TemplateCustomization
): TemplateStyles {
  const baseTemplate = DOCUMENT_TEMPLATES[templateId] || DOCUMENT_TEMPLATES.minimal;
  
  const normalizeWeight = <T extends string>(w: string | number | undefined, fallback: T): T => {
    if (w === undefined) return fallback;
    return String(w) as T;
  };
  const template: DocumentTemplate = {
    ...baseTemplate,
    tableStyle: customization?.tableStyle ?? baseTemplate.tableStyle,
    noteStyle: customization?.noteStyle ?? baseTemplate.noteStyle,
    headerBorderWidth: typeof customization?.headerBorderWidth === 'string'
      ? parseInt(customization.headerBorderWidth)
      : (customization?.headerBorderWidth ?? baseTemplate.headerBorderWidth),
    showHeaderDivider: customization?.showHeaderDivider ?? baseTemplate.showHeaderDivider,
    bodyWeight: normalizeWeight(customization?.bodyWeight, baseTemplate.bodyWeight),
    headingWeight: normalizeWeight(customization?.headingWeight, baseTemplate.headingWeight),
  };
  
  const primaryColor = customization?.accentColor || DOCUMENT_ACCENT_COLOR;
  const accentColor = customization?.accentColor || DOCUMENT_ACCENT_COLOR;
  
  return {
    template,
    primaryColor,
    accentColor,
    headingStyle: {
      fontWeight: template.headingWeight,
      color: primaryColor,
    },
    tableHeaderStyle: {
      backgroundColor: template.tableStyle === 'minimal' ? 'transparent' : primaryColor,
      color: template.tableStyle === 'minimal' ? '#1a1a1a' : '#ffffff',
      borderBottomWidth: template.tableStyle === 'minimal' ? 2 : 0,
      borderBottomColor: template.tableStyle === 'minimal' ? primaryColor : 'transparent',
    },
    tableHeaderRadius: template.headerLayout === 'modern' ? template.borderRadius : 0,
    getTableRowStyle: (index: number, isLast: boolean) => {
      return {
        borderBottomWidth: isLast ? 2 : template.tableStyle === 'striped' ? 0 : 1,
        borderBottomColor: isLast 
          ? primaryColor 
          : template.tableStyle === 'minimal' 
            ? '#e5e7eb' 
            : '#eee',
        backgroundColor: template.tableStyle === 'striped' && index % 2 === 0 
          ? '#f9fafb' 
          : 'transparent',
      };
    },
    getNoteStyle: () => {
      switch (template.noteStyle) {
        case 'bordered':
          return {
            borderLeftWidth: 4,
            borderLeftColor: primaryColor,
            backgroundColor: '#fafafa',
            borderRadius: 6,
          };
        case 'highlighted':
          return {
            backgroundColor: `${primaryColor}10`,
            borderWidth: 1,
            borderColor: `${primaryColor}30`,
            borderRadius: 8,
          };
        case 'simple':
        default:
          return {
            paddingVertical: 16,
            backgroundColor: 'transparent',
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
            borderRadius: 0,
          };
      }
    },
  };
}
