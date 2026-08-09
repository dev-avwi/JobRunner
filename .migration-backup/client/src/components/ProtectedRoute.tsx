import { useAppMode } from "@/hooks/use-app-mode";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldX, ArrowLeft, Home } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const [location, setLocation] = useLocation();
  const { canAccessRoute, isLoading, userRole } = useAppMode();
  
  // Show loading while checking permissions
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]" data-testid="route-loading">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }
  
  // Check if user can access this route
  const hasAccess = canAccessRoute(location);
  
  if (!hasAccess) {
    // Show access denied page
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-4" data-testid="access-denied">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldX className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-xl">Access Restricted</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              You don't have permission to view this page. This area is restricted based on your role.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button 
                variant="outline" 
                onClick={() => window.history.back()}
                data-testid="button-go-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
              <Button 
                onClick={() => setLocation('/')}
                data-testid="button-go-home"
              >
                <Home className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return <>{children}</>;
}

// HOC version for wrapping page components
export function withProtectedRoute<P extends object>(
  WrappedComponent: React.ComponentType<P>
) {
  return function ProtectedComponent(props: P) {
    return (
      <ProtectedRoute>
        <WrappedComponent {...props} />
      </ProtectedRoute>
    );
  };
}
