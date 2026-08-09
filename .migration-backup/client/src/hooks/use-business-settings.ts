import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, safeInvalidateQueries, recordLocalChange, getSessionToken } from "@/lib/queryClient";

export function useBusinessSettings() {
  return useQuery({
    queryKey: ['/api/business-settings'],
    queryFn: async () => {
      const headers: HeadersInit = {};
      const token = getSessionToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch('/api/business-settings', {
        credentials: 'include',
        headers,
      });
      if (!response.ok) {
        if (response.status === 404) {
          return {
            businessName: 'JobRunner Business',
            email: null,
            phone: null,
            gstEnabled: false,
            emailSendingMode: 'manual'
          };
        }
        throw new Error('Failed to fetch business settings');
      }
      return response.json();
    },
    staleTime: 60000,
  });
}

export function useUpdateBusinessSettings() {
  return useMutation({
    mutationFn: async (data: Record<string, any>) => {
      // Record that this device is making a change
      // This prevents the WebSocket event from causing a re-fetch on this device
      recordLocalChange('/api/business-settings');
      const response = await apiRequest('PATCH', '/api/business-settings', data);
      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ['/api/business-settings'] });
    }
  });
}