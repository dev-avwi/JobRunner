import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, safeInvalidateQueries } from "@/lib/queryClient";

export type TradeType = 'general' | 'plumbing' | 'electrical' | 'carpentry' | 'painting' | 'landscaping' | 'roofing' | 'hvac' | 'tiling' | 'flooring' | 'fencing' | 'concreting' | 'demolition' | 'excavation' | 'building' | 'renovation' | 'handyman' | 'cleaning' | 'pest_control' | 'pool_maintenance' | 'solar' | 'security' | 'other';

export const TRADE_TYPES: TradeType[] = ['general', 'plumbing', 'electrical', 'carpentry', 'painting', 'landscaping', 'roofing', 'hvac', 'tiling', 'flooring', 'fencing', 'concreting', 'demolition', 'excavation', 'building', 'renovation', 'handyman', 'cleaning', 'pest_control', 'pool_maintenance', 'solar', 'security', 'other'];

export const TRADE_TYPE_LABELS: Record<TradeType, string> = {
  general: 'General',
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  carpentry: 'Carpentry',
  painting: 'Painting',
  landscaping: 'Landscaping',
  roofing: 'Roofing',
  hvac: 'HVAC',
  tiling: 'Tiling',
  flooring: 'Flooring',
  fencing: 'Fencing',
  concreting: 'Concreting',
  demolition: 'Demolition',
  excavation: 'Excavation',
  building: 'Building',
  renovation: 'Renovation',
  handyman: 'Handyman',
  cleaning: 'Cleaning',
  pest_control: 'Pest Control',
  pool_maintenance: 'Pool Maintenance',
  solar: 'Solar',
  security: 'Security',
  other: 'Other',
};

export interface BusinessTemplate {
  id: string;
  userId: string;
  family: BusinessTemplateFamily;
  purpose: BusinessTemplatePurpose;
  tradeType: TradeType;
  name: string;
  description: string | null;
  content: string;
  subject: string | null;
  isDefault: boolean;
  isActive: boolean;
  mergeFields: string[] | null;
  metadata: Record<string, unknown> | null;
  sections: unknown[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateFamilyMeta {
  family: string;
  count: number;
  activeTemplateId: string | null;
  activeTemplateName: string | null;
}

export type BusinessTemplateFamily = 'email' | 'sms' | 'terms_conditions' | 'warranty' | 'safety_form' | 'checklist' | 'payment_notice';
export type BusinessTemplatePurpose = 
  | 'quote_sent' | 'invoice_sent' | 'payment_reminder' | 'job_confirmation' | 'job_completed' 
  | 'quote_accepted' | 'quote_declined'
  | 'sms_quote_sent' | 'sms_invoice_sent' | 'sms_payment_reminder' | 'sms_job_confirmation' | 'sms_job_completed'
  | 'general';

export const PURPOSE_LABELS: Record<BusinessTemplatePurpose, string> = {
  quote_sent: 'Quote Sent',
  invoice_sent: 'Invoice Sent',
  payment_reminder: 'Payment Reminder',
  job_confirmation: 'Job Confirmation',
  job_completed: 'Job Completed',
  quote_accepted: 'Quote Accepted',
  quote_declined: 'Quote Declined',
  sms_quote_sent: 'Quote Sent',
  sms_invoice_sent: 'Invoice Sent',
  sms_payment_reminder: 'Payment Reminder',
  sms_job_confirmation: 'Job Confirmation',
  sms_job_completed: 'Job Completed',
  general: 'General',
};

export const FAMILY_CONFIG: Record<BusinessTemplateFamily, { name: string; description: string; category: string }> = {
  email: { name: 'Email Templates', description: 'Email communication templates', category: 'communications' },
  sms: { name: 'SMS Templates', description: 'Text message templates', category: 'communications' },
  terms_conditions: { name: 'Terms & Conditions', description: 'Quote and invoice terms', category: 'financial' },
  warranty: { name: 'Warranty Terms', description: 'Warranty statements', category: 'financial' },
  payment_notice: { name: 'Payment Notices', description: 'Payment reminder templates', category: 'financial' },
  safety_form: { name: 'Safety Forms', description: 'WHS compliance forms', category: 'jobs_safety' },
  checklist: { name: 'Job Checklists', description: 'Job completion checklists', category: 'jobs_safety' },
};

export const CATEGORIES = {
  communications: { name: 'Communications', families: ['email', 'sms'] as BusinessTemplateFamily[] },
  financial: { name: 'Financial', families: ['terms_conditions', 'warranty', 'payment_notice'] as BusinessTemplateFamily[] },
  jobs_safety: { name: 'Jobs & Safety', families: ['safety_form', 'checklist'] as BusinessTemplateFamily[] },
};

export function getPurposesForFamily(family: BusinessTemplateFamily): BusinessTemplatePurpose[] {
  if (family === 'email') {
    return ['quote_sent', 'invoice_sent', 'payment_reminder', 'job_confirmation', 'job_completed', 'quote_accepted', 'quote_declined'];
  }
  if (family === 'sms') {
    return ['sms_quote_sent', 'sms_invoice_sent', 'sms_payment_reminder', 'sms_job_confirmation', 'sms_job_completed'];
  }
  return ['general'];
}

export interface PurposeOption {
  id: BusinessTemplatePurpose;
  label: string;
}

export function useBusinessTemplates() {
  const templatesQuery = useQuery<BusinessTemplate[]>({
    queryKey: ['/api/business-templates'],
  });

  const familiesMetaQuery = useQuery<TemplateFamilyMeta[]>({
    queryKey: ['/api/business-templates/families'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<BusinessTemplate>) => {
      const res = await apiRequest("POST", "/api/business-templates", data);
      return res.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ['/api/business-templates'] });
      safeInvalidateQueries({ queryKey: ['/api/business-templates/families'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BusinessTemplate> }) => {
      const res = await apiRequest("PATCH", `/api/business-templates/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ['/api/business-templates'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/business-templates/${id}`);
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ['/api/business-templates'] });
      safeInvalidateQueries({ queryKey: ['/api/business-templates/families'] });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/business-templates/${id}/activate`);
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ['/api/business-templates'] });
      safeInvalidateQueries({ queryKey: ['/api/business-templates/families'] });
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/business-templates/seed");
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ['/api/business-templates'] });
      safeInvalidateQueries({ queryKey: ['/api/business-templates/families'] });
    },
  });

  return {
    templates: templatesQuery.data || [],
    familiesMeta: familiesMetaQuery.data || [],
    isLoading: templatesQuery.isLoading || familiesMetaQuery.isLoading,
    error: templatesQuery.error || familiesMetaQuery.error,
    refetch: () => {
      templatesQuery.refetch();
      familiesMetaQuery.refetch();
    },
    createTemplate: createMutation.mutateAsync,
    updateTemplate: updateMutation.mutateAsync,
    deleteTemplate: deleteMutation.mutateAsync,
    activateTemplate: activateMutation.mutateAsync,
    seedTemplates: seedMutation.mutateAsync,
    getTemplatesForFamily: (family: BusinessTemplateFamily) => 
      (templatesQuery.data || []).filter(t => t.family === family),
    getFamilyMeta: (family: BusinessTemplateFamily) => 
      (familiesMetaQuery.data || []).find(m => m.family === family),
  };
}
