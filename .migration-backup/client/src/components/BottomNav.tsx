import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAppMode } from "@/hooks/use-app-mode";
import { useSimpleMode } from "@/hooks/use-simple-mode";
import { useFeatureAccess } from "@/hooks/use-subscription";
import { useSidebar } from "@/components/ui/sidebar";
import { useQuery } from "@tanstack/react-query";
import { 
  getBottomNavItems, 
  getMorePagesPattern,
  type NavItem 
} from "@/lib/navigation-config";
import { prefetchRoute } from "@/lib/routePrefetch";

interface UnreadCountsResponse {
  teamChat: number;
  directMessages: number;
  jobChats: number;
  total: number;
}

interface BottomNavProps {
  onNavigate?: (path: string) => void;
}

export const BOTTOM_NAV_HEIGHT = 80;

export default function BottomNav({ onNavigate }: BottomNavProps) {
  const [location] = useLocation();
  const { isTeam, isTradie, isOwner, isManager, userRole, permissionNavUrls } = useAppMode();
  const { isSimpleMode } = useSimpleMode();
  const { canUseAIFeatures } = useFeatureAccess();
  const { openMobile, isMobile } = useSidebar();

  // Hardened: see AppSidebar — same query, same render-loop concern.
  const { data: unreadCounts } = useQuery<UnreadCountsResponse>({
    queryKey: ['/api/chat/unread-counts'],
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const navItems = getBottomNavItems({ isTeam, isTradie, isOwner, isManager, userRole, isSimpleMode, hasProSubscription: canUseAIFeatures, extraAllowedUrls: permissionNavUrls });
  const morePagesPattern = getMorePagesPattern();
  
  const totalUnread = unreadCounts?.total || 0;
  
  if (isMobile && openMobile) {
    return null;
  }
  
  if (location === '/auth' || location.startsWith('/auth') || location === '/verify-email' || location === '/verify-email-pending') {
    return null;
  }
  
  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 right-0 z-[55]"
      style={{ 
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        WebkitTapHighlightColor: 'transparent'
      }}
      data-testid="bottom-nav"
    >
      <div 
        className="mx-3 mb-2 rounded-2xl bg-background/95 backdrop-blur-lg shadow-lg"
        style={{ 
          border: '1px solid hsl(var(--border) / 0.5)',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.08), 0 -2px 8px rgba(0, 0, 0, 0.04)'
        }}
      >
        <div className="flex items-center justify-around py-2 px-2">
          {navItems.map((item: NavItem) => {
            let isActive = location === item.url;
            
            if (item.url === "/more") {
              isActive = location === "/more" || morePagesPattern.test(location);
            }
            
            const showUnreadBadge = item.showBadge && totalUnread > 0 && !isActive;
            
            return (
              <Button
                key={item.title}
                variant="ghost"
                size="xl"
                className={`
                  flex flex-col items-center gap-1 h-auto py-2.5 px-4 rounded-xl
                  min-w-[60px] relative
                `}
                style={isActive ? {
                  backgroundColor: 'hsl(var(--trade) / 0.12)',
                } : {}}
                data-testid={`bottom-nav-${item.title.toLowerCase()}`}
                onClick={() => onNavigate?.(item.url)}
                onTouchStart={() => prefetchRoute(item.url)}
              >
                {isActive && (
                  <div 
                    className="absolute inset-0 rounded-xl"
                    style={{
                      backgroundColor: 'hsl(var(--trade) / 0.1)',
                    }}
                  />
                )}
                <div className="relative">
                  <item.icon 
                    className="h-6 w-6 relative z-10"
                    style={{ 
                      color: isActive ? 'hsl(var(--trade))' : 'hsl(var(--muted-foreground))',
                      strokeWidth: isActive ? 2.5 : 2
                    }}
                  />
                  {showUnreadBadge && (
                    <span 
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full text-[10px] flex items-center justify-center font-bold z-20"
                      data-testid="chat-unread-badge"
                    >
                      {totalUnread > 9 ? '9+' : totalUnread}
                    </span>
                  )}
                </div>
                <span 
                  className={`text-[11px] relative z-10 ${isActive ? 'font-semibold' : 'font-medium'}`}
                  style={{ 
                    color: isActive ? 'hsl(var(--trade))' : 'hsl(var(--muted-foreground))'
                  }}
                >
                  {item.title}
                </span>
              </Button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
