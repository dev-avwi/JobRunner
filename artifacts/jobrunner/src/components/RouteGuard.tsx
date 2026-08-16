import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAppMode } from "@/hooks/use-app-mode";
import { toast } from "@/hooks/use-toast";

interface RouteGuardProps {
  children: React.ReactNode;
}

export default function RouteGuard({ children }: RouteGuardProps) {
  const [location, setLocation] = useLocation();
  const { canAccessRoute, isLoading, userRole, dashboardType } = useAppMode();
  
  const hasAccess = canAccessRoute(location);
  // Track the last path that triggered a redirect toast so we only fire it once
  // per navigation attempt (the effect can re-run on unrelated state changes).
  const toastedPath = useRef<string | null>(null);
  
  useEffect(() => {
    if (!isLoading && !hasAccess) {
      // Only show the toast when the role is definitively resolved as a worker,
      // not during a transient loading state where role defaults to staff_tradie.
      const isWorkerRole = userRole === "staff_tradie";
      if (isWorkerRole && toastedPath.current !== location) {
        toastedPath.current = location;
        toast({
          title: "Access restricted",
          description: "That page is only available to owners and managers.",
          variant: "destructive",
        });
      }
      const defaultRoute = dashboardType === "staff_tradie" ? "/jobs" : "/";
      setLocation(defaultRoute);
    }
  }, [isLoading, hasAccess, setLocation, dashboardType, userRole, location]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]" data-testid="route-guard-loading">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]" data-testid="route-guard-redirecting">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}
