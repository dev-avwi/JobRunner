import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { LogOut, User, LayoutDashboard, Zap, Receipt, Briefcase, Calendar, Clock, Shield, MessageCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { useAppMode } from "@/hooks/use-app-mode";
import { useUserRole } from "@/hooks/use-user-role";
import { useSimpleMode } from "@/hooks/use-simple-mode";
import { useFeatureAccess } from "@/hooks/use-subscription";
import { 
  getSidebarMenuItems, 
  getSidebarSettingsItems,
  type NavItem 
} from "@/lib/navigation-config";
import { prefetchRoute } from "@/lib/routePrefetch";
import jobrunnerLogo from "@assets/jobrunner-logo-cropped.png";

interface UnreadCounts {
  teamChat: number;
  directMessages: number;
  jobChats: number;
  sms: number;
  total: number;
}

interface AppSidebarProps {
  onLogout?: () => void;
  onNavigate?: (path: string) => void;
}

export default function AppSidebar({ onLogout, onNavigate }: AppSidebarProps) {
  const [location, setLocation] = useLocation();
  const { data: businessSettings } = useBusinessSettings();
  const { isTeam, isTradie, isOwner, isManager, userRole, permissionNavUrls } = useAppMode();
  const { isSimpleMode } = useSimpleMode();
  const { canUseAIFeatures } = useFeatureAccess();

  // Fetch unread counts for notification badges
  // Hardened: don't retry, don't refetch on focus, and stale for 30s. The
  // default fetcher throws on 4xx, so without these settings a 403 (e.g.
  // owner without business_settings yet) was triggering React Query's retry
  // logic which, combined with re-renders elsewhere, hammered the API
  // ~10x/sec and showed up as the React #185 prod render-loop signature.
  const { data: unreadCounts } = useQuery<UnreadCounts>({
    queryKey: ['/api/chat/unread-counts'],
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const { roleName, isSubcontractor } = useUserRole();

  const filterOptions = { isTeam, isTradie, isOwner, isManager, userRole, isSimpleMode, hasProSubscription: canUseAIFeatures, extraAllowedUrls: permissionNavUrls };
  const baseMenuItems = getSidebarMenuItems(filterOptions);
  // Subcontractors get the same pages (and page names) as the mobile app.
  const subcontractorMenuItems: NavItem[] = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "My Jobs", url: "/jobs", icon: Briefcase },
    { title: "Schedule", url: "/schedule", icon: Calendar },
    { title: "Time Tracking", url: "/time-tracking", icon: Clock },
    { title: "My Invoices", url: "/my-invoices", icon: Receipt },
    { title: "WHS Safety", url: "/whs", icon: Shield },
    { title: "Chat", url: "/chat", icon: MessageCircle },
  ];
  const visibleMenuItems = isSubcontractor ? subcontractorMenuItems : baseMenuItems;
  const visibleSettingsItems = getSidebarSettingsItems(filterOptions);

  // Get badge count for specific menu items
  const getBadgeCount = (url: string): number => {
    if (!unreadCounts) return 0;
    if (url === '/chat') return unreadCounts.total;
    return 0;
  };

  const businessName = businessSettings?.businessName || 'JobRunner';
  const initials = businessName
    .split(' ')
    .map((word: string) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Sidebar data-testid="sidebar-main">
      <SidebarHeader className="p-3 border-b border-sidebar-border min-h-[68px]">
        <div
          className="flex items-center gap-3 w-full p-2 cursor-pointer hover-elevate rounded-lg"
          data-testid="button-sidebar-settings"
          onClick={() => onNavigate?.('/settings')}
        >
          {businessSettings?.logoUrl ? (
            <div className="w-6 h-6 rounded overflow-hidden bg-white border border-sidebar-border flex-shrink-0 shadow-sm">
              <img 
                src={businessSettings.logoUrl} 
                alt="Business logo" 
                className="w-full h-full object-cover"
                data-testid="img-business-logo"
              />
            </div>
          ) : (
            <div className="w-6 h-6 rounded overflow-hidden bg-transparent flex-shrink-0 flex items-center justify-center">
              <img 
                src={jobrunnerLogo} 
                alt="JobRunner" 
                className="w-full h-full object-contain"
                data-testid="img-jobrunner-icon"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-sm truncate text-foreground" data-testid="text-business-name">
              {businessName}
            </h1>
            <p className="text-xs truncate text-muted-foreground">My Account</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        {(() => {
          // Section definitions — URLs listed here are pulled into that group;
          // anything not matched falls into the last catch-all group.
          const sectionDefs: { label: string; urls: string[] }[] = [
            { label: 'Operations', urls: ['/', '/action-center', '/work', '/schedule'] },
            { label: 'Finance', urls: ['/clients', '/documents', '/payment-hub', '/expenses'] },
            { label: 'Team', urls: ['/team', '/leave-management', '/staff-licences', '/time-tracking', '/reports/payroll'] },
            { label: 'Tools', urls: [] }, // catch-all
          ];

          const assigned = new Set<string>();
          const sections = sectionDefs.map((sec) => {
            let items: NavItem[];
            if (sec.urls.length === 0) {
              // catch-all: everything not yet assigned
              items = visibleMenuItems.filter((i: NavItem) => !assigned.has(i.url));
            } else {
              items = sec.urls
                .map((url) => visibleMenuItems.find((i: NavItem) => i.url === url))
                .filter(Boolean) as NavItem[];
              items.forEach((i) => assigned.add(i.url));
            }
            return { label: sec.label, items };
          });

          const renderItem = (item: NavItem) => {
            const isActive = location === item.url;
            const Icon = item.icon || LayoutDashboard;
            const badgeCount = getBadgeCount(item.url);
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  isActive={isActive}
                  data-testid={`sidebar-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => onNavigate?.(item.url)}
                  onMouseEnter={() => prefetchRoute(item.url)}
                  onTouchStart={() => prefetchRoute(item.url)}
                  className={isActive ? 'text-white' : ''}
                  style={isActive ? { backgroundColor: 'hsl(var(--trade))', color: 'white' } : {}}
                >
                  <div className="relative">
                    <Icon className="h-4 w-4" />
                    {badgeCount > 0 && (
                      <span
                        className="absolute -top-1.5 -right-1.5 h-4 min-w-4 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-medium px-0.5"
                        data-testid={`badge-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                  </div>
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          };

          return sections
            .filter((sec) => sec.items.length > 0)
            .map((sec) => (
              <SidebarGroup key={sec.label}>
                <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold px-2 py-1">
                  {sec.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {sec.items.map(renderItem)}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ));
        })()}

        {visibleSettingsItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleSettingsItems.map((item: NavItem) => {
                  const isActive = location === item.url;
                  const Icon = item.icon || LayoutDashboard;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        isActive={isActive}
                        data-testid={`sidebar-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        onClick={() => onNavigate?.(item.url)}
                        onMouseEnter={() => prefetchRoute(item.url)}
                        onTouchStart={() => prefetchRoute(item.url)}
                        className={isActive ? 'text-white' : ''}
                        style={isActive ? { 
                          backgroundColor: 'hsl(var(--trade))', 
                          color: 'white',

                        } : {}}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="space-y-2">
          <div 
            className="flex items-center gap-3 p-2 rounded-lg border"
            style={{ 
              backgroundColor: 'hsl(var(--trade) / 0.08)', 
              borderColor: 'hsl(var(--trade) / 0.2)' 
            }}
          >
            <UserAvatar
              className="h-8 w-8"
              user={{ id: businessName, name: businessName, photoUrl: businessSettings?.logoUrl }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate" data-testid="text-footer-business-name">
                  {businessName}
                </p>
                <Badge 
                  variant="outline" 
                  className="text-[10px] h-5 px-1.5"
                  data-testid="badge-user-role"
                >
                  {isOwner ? 'Owner' : roleName || 'Team'}
                </Badge>
              </div>
              {/* Plan label is the OWNER's billing concern. Members joined to a
                  business are covered by the business seat — showing them
                  "Free Plan" (their own placeholder settings) is wrong. */}
              {isOwner && (
                <p className="text-xs text-muted-foreground truncate">
                  {businessSettings?.subscriptionTier === 'business' ? 'Business Plan' :
                   businessSettings?.subscriptionTier === 'team' ? 'Team Plan' : 
                   businessSettings?.subscriptionTier === 'pro' ? 'Pro Plan' : 
                   businessSettings?.subscriptionTier === 'trial' ? 'Trial' : 'Free Plan'}
                </p>
              )}
            </div>
          </div>
          
          {isOwner && (!businessSettings?.subscriptionTier || businessSettings?.subscriptionTier === 'free') && (
            <Button 
              size="sm" 
              className="w-full justify-start"
              onClick={() => setLocation('/subscription')}
              data-testid="button-sidebar-upgrade"
            >
              <Zap className="h-4 w-4 mr-2" />
              Upgrade Plan
            </Button>
          )}

          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start"
            onClick={onLogout}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
