import { useQuery } from "@tanstack/react-query";
import { getSessionToken } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const headers: HeadersInit = {};
      const token = getSessionToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/auth/me', { credentials: 'include', headers });
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
    staleTime: 30000,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
