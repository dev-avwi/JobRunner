import { useQuery, useMutation } from "@tanstack/react-query";
import { offlineAwareApiRequest, safeInvalidateQueries } from "@/lib/queryClient";
import { trackEvent } from "@/lib/analytics";

export function useClients() {
  return useQuery({
    queryKey: ["/api/clients"],
  });
}

export function useClient(clientId: string) {
  return useQuery({
    queryKey: ["/api/clients", clientId],
    enabled: !!clientId,
  });
}

export function useCreateClient() {
  return useMutation({
    mutationFn: async (clientData: any) => {
      const response = await offlineAwareApiRequest("POST", "/api/clients", clientData);
      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ["/api/clients"] });
      trackEvent('client_created');
    },
  });
}

export function useDeleteClient() {
  return useMutation({
    mutationFn: async (clientId: string) => {
      const response = await offlineAwareApiRequest("DELETE", `/api/clients/${clientId}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to delete client" }));
        throw new Error(error.error || "Failed to delete client");
      }
      return clientId;
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ["/api/clients"] });
    },
  });
}