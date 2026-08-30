import { useQuery, useMutation } from "@tanstack/react-query";
import { offlineAwareApiRequest, safeInvalidateQueries } from "@/lib/queryClient";
import { trackEvent } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (clientData: any) => {
      const response = await offlineAwareApiRequest("POST", "/api/clients", clientData);
      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ["/api/clients"] });
      trackEvent('client_created');
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Failed to create client", description: error?.message ?? "Please try again." });
    },
  });
}

export function useDeleteClient() {
  const { toast } = useToast();
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
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Failed to delete client", description: error?.message ?? "Please try again." });
    },
  });
}