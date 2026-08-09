import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAppMode } from "@/hooks/use-app-mode";

interface RouteGuardProps {
  children: React.ReactNode;
}

export default function RouteGuard({ children }: RouteGuardProps) {
  const [location, setLocation] = useLocation();
  const { canAccessRoute, isLoading, userRole, dashboardType } = useAppMode();
  
  const hasAccess = canAccessRoute(location);
  
  useEffect(() => {
    if (!isLoading && !hasAccess) {
      const defaultRoute = dashboardType === 'staff_tradie' ? '/jobs' : '/';
      setLocation(defaultRoute);
    }
  }, [isLoading, hasAccess, setLocation, dashboardType]);
  
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
