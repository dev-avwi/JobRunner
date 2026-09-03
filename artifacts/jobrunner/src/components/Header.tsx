import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import GlobalSearch from "@/components/GlobalSearch";
import NotificationDropdown from "@/components/NotificationDropdown";
import SyncStatusIndicator from "@/components/SyncStatusIndicator";
import { 
  Search, 
  Sun, 
  Moon,
  Plus,
  Map,
  HelpCircle,
} from "lucide-react";
import { useLocation } from "wouter";
import { useAppMode } from "@/hooks/use-app-mode";
import { useQuery } from "@tanstack/react-query";
import appIconUrl from '@assets/jobrunner-logo-cropped.png';
import { UserAvatar } from "@/components/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  title?: string;
  showSearch?: boolean;
  showAddButton?: boolean;
  addButtonText?: string;
  onAddClick?: () => void;
  onThemeToggle?: () => void;
  isDarkMode?: boolean;
  onProfileClick?: () => void;
  onSettingsClick?: () => void;
  onLogoutClick?: () => void;
  onHelpClick?: () => void;
}

export default function Header({ 
  title,
  showSearch = true,
  showAddButton = false,
  addButtonText = "Add",
  onAddClick,
  onThemeToggle,
  isDarkMode = false,
  onProfileClick,
  onSettingsClick,
  onLogoutClick,
  onHelpClick,
}: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { isOwner, isManager, isTradie } = useAppMode();
  const canViewMap = isOwner || isManager || isTradie;
  
  // Fetch current user data
  const { data: user } = useQuery<{
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    businessName?: string;
    profileImageUrl?: string | null;
    themeColor?: string | null;
  }>({ queryKey: ["/api/auth/me"] });
  
  // Get display name
  const displayName = user?.businessName || 
    (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.firstName) || 
    'User';
  const userEmail = user?.email || '';
  
  // Add keyboard shortcut for search (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
  return (
    <header 
      className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 relative z-[20] border-b border-border"
    >
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* SidebarTrigger - shown on both mobile and desktop */}
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          
          {/* JobRunner branding - clickable to go to settings/My Account */}
          <button
            onClick={() => setLocation('/settings')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            data-testid="button-header-settings"
          >
            <img 
              src={appIconUrl} 
              alt="JobRunner" 
              className="h-6 w-6 object-contain"
              data-testid="img-header-logo"
            />
            <span 
              className="text-base sm:text-xl font-bold"
              data-testid="header-brand"
            >
              <span className="text-primary">Job</span><span className="text-primary">Runner</span>
            </span>
          </button>
          
          {title && (
            <h1 className="text-xl font-semibold hidden md:block" data-testid="header-title">
              {title}
            </h1>
          )}
        </div>

      <div className="flex items-center gap-3">
        {showSearch && (
          <>
            <Button
              variant="ghost"
              className="hidden sm:flex items-center gap-2 text-muted-foreground hover:text-foreground px-3"
              onClick={() => setSearchOpen(true)}
              data-testid="button-open-search"
            >
              <Search className="h-4 w-4" />
              <span className="text-sm">Search...</span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              onClick={() => setSearchOpen(true)}
              data-testid="button-open-search-mobile"
            >
              <Search className="h-4 w-4" />
            </Button>
            <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
          </>
        )}

        {canViewMap && (
          <>
            {/* Mobile: icon-only button */}
            <Button
              variant={location === '/map' ? "default" : "outline"}
              size="icon"
              onClick={() => setLocation('/map')}
              className="sm:hidden"
              data-testid="button-header-map-mobile"
              style={location === '/map' ? {
                backgroundColor: 'hsl(var(--trade))',
                borderColor: 'hsl(var(--trade))'
              } : {}}
            >
              <Map className="h-4 w-4" />
            </Button>
            {/* Desktop: button with text */}
            <Button
              variant={location === '/map' ? "default" : "outline"}
              size="sm"
              onClick={() => setLocation('/map')}
              className="hidden sm:flex items-center gap-2"
              data-testid="button-header-map"
              style={location === '/map' ? {
                backgroundColor: 'hsl(var(--trade))',
                borderColor: 'hsl(var(--trade))'
              } : {}}
            >
              <Map className="h-4 w-4" />
              <span className="hidden md:inline">Job Map</span>
            </Button>
          </>
        )}

        {showAddButton && (
          <Button 
            onClick={onAddClick}
            data-testid="button-add-primary"
            style={{
              backgroundColor: 'hsl(var(--trade))',
              color: 'white',
              borderColor: 'hsl(var(--trade))'
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            {addButtonText}
          </Button>
        )}

        <SyncStatusIndicator />

        <Button
          variant="ghost"
          size="icon"
          onClick={onHelpClick}
          title="Help Center"
          data-testid="button-help"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onThemeToggle}
          data-testid="button-theme-toggle"
        >
          {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <NotificationDropdown />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full" data-testid="button-profile-menu">
              <UserAvatar
                className="h-8 w-8"
                fallbackClassName="text-xs"
                user={{
                  id: user?.id,
                  firstName: user?.firstName,
                  lastName: user?.lastName,
                  email: user?.email,
                  photoUrl: user?.profileImageUrl,
                  themeColor: user?.themeColor,
                }}
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium" data-testid="text-profile-name">{displayName}</p>
                <p className="text-xs text-muted-foreground" data-testid="text-profile-email">{userEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onProfileClick} data-testid="menu-profile">
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogoutClick} data-testid="menu-logout">
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
    </header>
  );
}