import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Eye, LogOut } from "lucide-react";

export function ImpersonationBanner() {
  const [, setLocation] = useLocation();
  const impersonation = sessionStorage.getItem('impersonation');

  const { data: authUser } = useQuery<{ isImpersonated?: boolean }>({
    queryKey: ['/api/auth/me'],
  });

  if (!impersonation && !authUser?.isImpersonated) return null;

  const data = impersonation ? JSON.parse(impersonation) : {};

  const exitImpersonation = async () => {
    try {
      const response = await apiRequest("POST", "/api/admin/exit-impersonation");
      if (!response.ok) {
        throw new Error("Failed to exit impersonation");
      }
      sessionStorage.removeItem('impersonation');
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      setLocation('/admin');
      window.location.reload();
    } catch {
      sessionStorage.removeItem('impersonation');
      setLocation('/admin');
      window.location.reload();
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-center gap-3" data-testid="impersonation-banner">
      <Eye className="h-4 w-4" />
      <span className="text-sm font-medium">
        Viewing as {data.targetUser?.businessName || data.targetUser?.email || 'another user'}
      </span>
      <Button
        size="sm"
        variant="outline"
        className="border-amber-950/30 text-amber-950 bg-amber-400/50"
        onClick={exitImpersonation}
      >
        <LogOut className="h-3.5 w-3.5 mr-1.5" />
        Exit Shadow Mode
      </Button>
    </div>
  );
}
