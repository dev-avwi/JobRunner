import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import KPIBox from "./KPIBox";
import { useQuery } from "@tanstack/react-query";
import { 
  Settings, 
  Users, 
  Calendar, 
  HelpCircle, 
  LogOut,
  Crown,
  Clock,
  Zap,
  ChevronRight,
  DollarSign
} from "lucide-react";

interface MoreProps {
  onNavigate?: (path: string) => void;
  onLogout?: () => void;
  onSupport?: () => void;
  onUpgrade?: () => void;
}

export default function More({
  onNavigate,
  onLogout,
  onSupport,
  onUpgrade
}: MoreProps) {
  const { data: user } = useQuery({ queryKey: ["/api/auth/me"] });
  const { data: businessSettings } = useQuery({ queryKey: ["/api/business-settings"] });
  
  const userEmail = (user as any)?.email || '';
  const userName = (user as any)?.firstName || (user as any)?.name?.split(' ')[0] || 'User';
  const businessName = (businessSettings as any)?.businessName || 'Your Business';
  const businessPhone = (businessSettings as any)?.phone || '';

  const menuItems = [
    {
      title: "Clients",
      description: "Manage your client database",
      icon: Users,
      path: "/clients"
    },
    {
      title: "Calendar", 
      description: "Schedule and track appointments",
      icon: Calendar,
      path: "/calendar"
    },
    {
      title: "Time Tracking",
      description: "Track hours and earnings",
      icon: Clock,
      path: "/time-tracking"
    },
    {
      title: "Integrations",
      description: "Connect email and services",
      icon: Zap,
      path: "/integrations"
    },
    {
      title: "Settings",
      description: "Business profile and preferences",
      icon: Settings,
      path: "/settings"
    }
  ];

  return (
    <PageShell data-testid="more-page">
      <PageHeader
        title="More"
        subtitle="Additional features and settings"
      />

      {/* KPI Stats - matching main pages layout */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPIBox
          icon={Crown}
          title="Your Plan"
          value="Pro"
          onClick={onUpgrade}
        />
        <KPIBox
          icon={Users}
          title="Clients"
          value="-"
          onClick={() => onNavigate?.('/clients')}
        />
        <KPIBox
          icon={Clock}
          title="Time Tracked"
          value="-"
          onClick={() => onNavigate?.('/time-tracking')}
        />
        <KPIBox
          icon={DollarSign}
          title="Expenses"
          value="-"
          onClick={() => onNavigate?.('/expenses')}
        />
      </div>

      {/* Quick Navigation - full width card like other pages */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Quick Access</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {menuItems.map((item) => (
              <button
                key={item.title}
                className="w-full flex items-center gap-3 px-4 py-3 hover-elevate text-left transition-colors"
                onClick={() => onNavigate?.(item.path)}
                data-testid={`button-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ 
                    backgroundColor: 'hsl(var(--trade) / 0.1)',
                  }}
                >
                  <item.icon 
                    className="h-5 w-5" 
                    style={{ color: 'hsl(var(--trade))' }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Help & Support */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Help & Support</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <button
            className="w-full flex items-center gap-3 px-4 py-3 hover-elevate text-left transition-colors"
            onClick={onSupport}
            data-testid="button-support"
          >
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ 
                backgroundColor: 'hsl(var(--trade) / 0.1)',
              }}
            >
              <HelpCircle 
                className="h-5 w-5" 
                style={{ color: 'hsl(var(--trade))' }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Contact Support</p>
              <p className="text-xs text-muted-foreground">Get help with your account</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </button>
        </CardContent>
      </Card>

      {/* Account Info & Logout */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">{businessName}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              {businessPhone && (
                <p className="text-xs text-muted-foreground">{businessPhone}</p>
              )}
            </div>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={onLogout}
              data-testid="button-logout-more"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}