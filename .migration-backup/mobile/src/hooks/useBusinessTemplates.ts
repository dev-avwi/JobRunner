import { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '../lib/store';
import { api } from '../lib/api';

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
  family: 'email' | 'sms' | 'terms_conditions' | 'warranty' | 'safety_form' | 'checklist' | 'payment_notice';
  purpose: string;
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
  const { isAuthenticated } = useAuthStore();
  const [templates, setTemplates] = useState<BusinessTemplate[]>([]);
  const [familiesMeta, setFamiliesMeta] = useState<TemplateFamilyMeta[]>([]);
  const [purposesCache, setPurposesCache] = useState<Record<BusinessTemplateFamily, PurposeOption[]>>({} as any);
  const [purposesLoaded, setPurposesLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  const getFallbackPurposes = useCallback((family: BusinessTemplateFamily): PurposeOption[] => {
    const purposes = getPurposesForFamily(family);
    return purposes.map(id => ({ id, label: PURPOSE_LABELS[id] || id }));
  }, []);

  const fetchPurposesForFamily = useCallback(async (family: BusinessTemplateFamily): Promise<PurposeOption[] | null> => {
    if (!isAuthenticated) return null;
    
    try {
      const response = await api.get<{ purposes: PurposeOption[] }>(`/api/business-templates/purposes/${family}`);
      if (response.data?.purposes) {
        return response.data.purposes;
      }
      return null;
    } catch (err) {
      if (__DEV__) console.error(`Failed to fetch purposes for ${family}:`, err);
      return null;
    }
  }, [isAuthenticated]);

  const fetchTemplates = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      setError('Please sign in to view templates');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setLoadingTimedOut(false);
    
    try {
      const [templatesRes, familiesRes] = await Promise.all([
        api.get<BusinessTemplate[]>('/api/business-templates'),
        api.get<TemplateFamilyMeta[]>('/api/business-templates/families'),
      ]);

      // Check for errors
      if (templatesRes.error && familiesRes.error) {
        throw new Error(`Failed to load templates: ${templatesRes.error}`);
      }

      if (templatesRes.data) {
        setTemplates(templatesRes.data || []);
      } else if (templatesRes.error) {
        if (__DEV__) console.warn('Templates fetch returned error:', templatesRes.error);
      }

      if (familiesRes.data) {
        setFamiliesMeta(familiesRes.data || []);
      } else if (familiesRes.error) {
        if (__DEV__) console.warn('Families fetch returned error:', familiesRes.error);
      }

      // Prefetch purposes for all families - use fallback if API fails
      const allFamilies = Object.keys(FAMILY_CONFIG) as BusinessTemplateFamily[];
      const purposeResults = await Promise.all(
        allFamilies.map(async (family) => ({
          family,
          purposes: await fetchPurposesForFamily(family),
        }))
      );
      
      // Build purposes cache - use fallback for any that failed
      const newCache: Record<BusinessTemplateFamily, PurposeOption[]> = {} as any;
      let usedFallback = false;
      
      purposeResults.forEach(({ family, purposes }) => {
        if (purposes && purposes.length > 0) {
          newCache[family] = purposes;
        } else {
          // Use local fallback if API failed
          newCache[family] = getFallbackPurposes(family);
          usedFallback = true;
        }
      });
      
      setPurposesCache(newCache);
      setPurposesLoaded(true);
      
      if (usedFallback) {
        if (__DEV__) console.warn('Some purposes loaded from fallback - API fetch failed for some families');
      }
    } catch (err: any) {
      // Handle errors
      setError('Failed to load templates. Please try again.');
      if (__DEV__) console.error('Failed to fetch business templates:', err);
      
      // Still try to set fallback purposes so page can render
      const allFamilies = Object.keys(FAMILY_CONFIG) as BusinessTemplateFamily[];
      const fallbackCache: Record<BusinessTemplateFamily, PurposeOption[]> = {} as any;
      allFamilies.forEach((family) => {
        fallbackCache[family] = getFallbackPurposes(family);
      });
      setPurposesCache(fallbackCache);
      setPurposesLoaded(true);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, fetchPurposesForFamily, getFallbackPurposes]);

  const seedTemplates = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      await api.post('/api/business-templates/seed');
      await fetchTemplates();
    } catch (err) {
      if (__DEV__) console.error('Failed to seed templates:', err);
    }
  }, [isAuthenticated, fetchTemplates]);

  const createTemplate = useCallback(async (data: {
    family: string;
    name: string;
    description?: string;
    content: string;
    subject?: string;
    purpose?: string;
  }) => {
    if (!isAuthenticated) throw new Error('Not authenticated');
    
    const response = await api.post<BusinessTemplate>('/api/business-templates', data);

    if (response.error) {
      throw new Error(response.error || 'Failed to create template');
    }

    await fetchTemplates();
    return response.data;
  }, [isAuthenticated, fetchTemplates]);

  const updateTemplate = useCallback(async (id: string, data: {
    name?: string;
    description?: string;
    content?: string;
    subject?: string;
    purpose?: string;
  }) => {
    if (!isAuthenticated) throw new Error('Not authenticated');
    
    const response = await api.patch<BusinessTemplate>(`/api/business-templates/${id}`, data);

    if (response.error) {
      throw new Error(response.error || 'Failed to update template');
    }

    await fetchTemplates();
    return response.data;
  }, [isAuthenticated, fetchTemplates]);

  const deleteTemplate = useCallback(async (id: string) => {
    if (!isAuthenticated) throw new Error('Not authenticated');
    
    const response = await api.delete(`/api/business-templates/${id}`);

    if (response.error) {
      throw new Error('Failed to delete template');
    }

    await fetchTemplates();
  }, [isAuthenticated, fetchTemplates]);

  const activateTemplate = useCallback(async (id: string) => {
    if (!isAuthenticated) throw new Error('Not authenticated');
    
    const response = await api.post(`/api/business-templates/${id}/activate`);

    if (response.error) {
      throw new Error('Failed to activate template');
    }

    await fetchTemplates();
  }, [isAuthenticated, fetchTemplates]);

  const getTemplatesForFamily = useCallback((family: BusinessTemplateFamily) => {
    return templates.filter(t => t.family === family);
  }, [templates]);

  const getFamilyMeta = useCallback((family: BusinessTemplateFamily) => {
    return familiesMeta.find(m => m.family === family);
  }, [familiesMeta]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Loading timeout - show error after 10 seconds
  useEffect(() => {
    if (!isLoading) {
      setLoadingTimedOut(false);
      return;
    }
    
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        setLoadingTimedOut(true);
        setError('Loading is taking longer than expected. Please try again.');
      }
    }, 10000);
    
    return () => clearTimeout(timeoutId);
  }, [isLoading]);

  useEffect(() => {
    // Only seed if loading completed successfully (no error) and there are no templates
    if (!isLoading && !error && templates.length === 0 && familiesMeta.length === 0 && isAuthenticated) {
      seedTemplates();
    }
  }, [isLoading, error, templates.length, familiesMeta.length, seedTemplates, isAuthenticated]);

  const getPurposesForFamilyFromCache = useCallback((family: BusinessTemplateFamily): PurposeOption[] => {
    // Only return from cache - no fallback to ensure server enforcement
    return purposesCache[family] || [];
  }, [purposesCache]);

  return {
    templates,
    familiesMeta,
    purposesCache,
    purposesLoaded,
    isLoading,
    loadingTimedOut,
    error,
    refetch: fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    activateTemplate,
    getTemplatesForFamily,
    getFamilyMeta,
    getPurposesForFamilyFromCache,
  };
}
