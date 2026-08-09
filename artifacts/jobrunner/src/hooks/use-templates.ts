import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, safeInvalidateQueries } from "@/lib/queryClient";

// API types for templates
export interface DocumentTemplate {
  id: string;
  userId: string;
  type: 'quote' | 'invoice' | 'job';
  familyKey: string;
  name: string;
  tradeType: string;
  rateCardId: string | null;
  styling: {
    brandColor?: string;
    logoDisplay?: boolean;
  };
  sections: {
    showHeader?: boolean;
    showLineItems?: boolean;
    showTotals?: boolean;
    showTerms?: boolean;
    showSignature?: boolean;
  };
  defaults: {
    title?: string;
    description?: string;
    terms?: string;
    depositPct?: number;
    dueTermDays?: number;
    gstEnabled?: boolean;
  };
  defaultLineItems: Array<{
    description: string;
    qty: number;
    unitPrice: number;
    unit: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface LineItemCatalog {
  id: string;
  userId: string;
  name: string;
  description?: string;
  defaultQuantity: string;
  defaultUnitPrice: string;
  unit?: string;
  tradeType?: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RateCard {
  id: string;
  userId: string;
  name: string;
  description?: string;
  hourlyRate: string;
  tradeType?: string;
  skillLevel?: string;
  createdAt: string;
  updatedAt: string;
}

// Templates hooks
export function useDocumentTemplates(type?: string, tradeType?: string) {
  return useQuery({
    queryKey: ['/api/templates', type, tradeType],
    queryFn: async (): Promise<DocumentTemplate[]> => {
      const params = new URLSearchParams();
      if (type) params.append('type', type);
      if (tradeType) params.append('tradeType', tradeType);
      
      const url = `/api/templates${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    },
  });
}

export function useCreateDocumentTemplate() {
  return useMutation({
    mutationFn: async (data: Partial<DocumentTemplate>) => {
      const response = await apiRequest("POST", "/api/templates", data);
      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ['/api/templates'] });
    },
  });
}

export function useUpdateDocumentTemplate() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DocumentTemplate> }) => {
      const response = await apiRequest("PATCH", `/api/templates/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ['/api/templates'] });
    },
  });
}

export function useDeleteDocumentTemplate() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/templates/${id}`);
      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ['/api/templates'] });
    },
  });
}

// Line Item Catalog hooks
export function useLineItemCatalog(tradeType?: string) {
  return useQuery({
    queryKey: ['/api/catalog', tradeType],
    queryFn: async (): Promise<LineItemCatalog[]> => {
      const params = new URLSearchParams();
      if (tradeType) params.append('tradeType', tradeType);
      
      const url = `/api/catalog${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch catalog');
      return response.json();
    },
  });
}

export function useCreateLineItemCatalog() {
  return useMutation({
    mutationFn: async (data: Partial<LineItemCatalog>) => {
      const response = await apiRequest("POST", "/api/catalog", data);
      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ['/api/catalog'] });
    },
  });
}

// Rate Cards hooks
export function useRateCards(tradeType?: string) {
  return useQuery({
    queryKey: ['/api/rate-cards', tradeType],
    queryFn: async (): Promise<RateCard[]> => {
      const params = new URLSearchParams();
      if (tradeType) params.append('tradeType', tradeType);
      
      const url = `/api/rate-cards${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch rate cards');
      return response.json();
    },
  });
}

export function useCreateRateCard() {
  return useMutation({
    mutationFn: async (data: Partial<RateCard>) => {
      const response = await apiRequest("POST", "/api/rate-cards", data);
      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ['/api/rate-cards'] });
    },
  });
}