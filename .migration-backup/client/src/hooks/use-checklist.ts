import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, safeInvalidateQueries } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface ChecklistItem {
  id: string;
  jobId: string;
  text: string;
  isCompleted: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function useChecklist(jobId: string) {
  const { toast } = useToast();
  const queryKey = ["/api/jobs", jobId, "checklist"];

  // Fetch checklist items
  const { data: items = [], isLoading } = useQuery<ChecklistItem[]>({
    queryKey,
    enabled: !!jobId,
  });

  // Add item mutation
  const addItemMutation = useMutation({
    mutationFn: async (text: string) => {
      const sortOrder = items.length;
      return apiRequest("POST", `/api/jobs/${jobId}/checklist`, {
        text,
        isCompleted: false,
        sortOrder,
      });
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add checklist item",
        variant: "destructive",
      });
    },
  });

  // Toggle item mutation
  const toggleItemMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: boolean }) => {
      return apiRequest("PATCH", `/api/checklist/${id}`, { isCompleted });
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update checklist item",
        variant: "destructive",
      });
    },
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/checklist/${id}`);
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete checklist item",
        variant: "destructive",
      });
    },
  });

  return {
    items,
    isLoading,
    addItem: (text: string) => addItemMutation.mutate(text),
    toggleItem: (id: string, isCompleted: boolean) => toggleItemMutation.mutate({ id, isCompleted }),
    deleteItem: (id: string) => deleteItemMutation.mutate(id),
    isAdding: addItemMutation.isPending,
    isToggling: toggleItemMutation.isPending,
    isDeleting: deleteItemMutation.isPending,
  };
}
