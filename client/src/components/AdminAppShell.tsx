import { ReactNode } from "react";
import { useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Users,
  Activity,
  Settings,
  LogOut,
  Shield,
  HeartPulse,
  MessageSquare,
  DollarSign,
  Kanban,
  Bot,
  PhoneIncoming,
  PhoneForwarded,
  Mail,
} from "lucide-react";
import appIconUrl from "@assets/jobrunner-logo-cropped.png";

interface AdminAppShellProps {
  children: ReactNode;
  onLogout?: () => void;
  onNavigate?: (path: string) => void;
}

const adminNavGroups = [
  {
    label: "Overview",
    items: [
      { title: "Overview", url: "/admin", icon: LayoutDashboard },
      { title: "Revenue", url: "/admin/revenue", icon: DollarSign },
    ],
  },
  {
    label: "Users & Work",
    items: [
      { title: "Users", url: "/admin/users", icon: Users },
      { title: "Kanban", url: "/admin/kanban", icon: Kanban },
      { title: "Activity", url: "/admin/activity", icon: Activity },
    ],
  },
  {
    label: "Comms & AI",
    items: [
      { title: "Communications", url: "/admin/comms", icon: MessageSquare },
      { title: "AI Queue", url: "/admin/ai-queue", icon: Bot },
      { title: "Calls", url: "/admin/call-monitor", icon: PhoneIncoming },
      { title: "Porting", url: "/admin/porting", icon: PhoneForwarded },
      { title: "Email Logs", url: "/admin/email-logs", icon: Mail },
    ],
  },
  {
    label: "System",
    items: [
      { title: "System Health", url: "/admin/health", icon: HeartPulse },
      { title: "Settings", url: "/admin/settings", icon: Settings },
    ],
  },
];

function AdminSidebar({
  onLogout,
  onNavigate,
}: {
  onLogout?: () => void;
  onNavigate?: (path: string) => void;
}) {
  const [location] = useLocation();

  return (
    <Sidebar data-testid="admin-sidebar">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded overflow-hidden bg-transparent flex items-center justify-center">
            <img
              src={appIconUrl}
              alt="JobRunner Admin"
              className="w-full h-full object-contain"
              data-testid="img-admin-logo"
            />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1
                className="font-bold text-base leading-none"
                data-testid="text-admin-title"
              >
                JobRunner
              </h1>
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-5 bg-slate-700 text-slate-100 border-slate-600"
                data-testid="badge-admin"
              >
                <Shield className="w-3 h-3 mr-1" />
                Admin
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-none">
              Platform Management
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2">
        {adminNavGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive =
                    location === item.url ||
                    (item.url === "/admin" && location === "/admin/");
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        isActive={isActive}
                        data-testid={`admin-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                        onClick={() => onNavigate?.(item.url)}
                        className={isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}
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
        ))}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={onLogout}
          data-testid="button-admin-logout"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function AdminAppShell({
  children,
  onLogout,
  onNavigate,
}: AdminAppShellProps) {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background">
        <AdminSidebar onLogout={onLogout} onNavigate={onNavigate} />

        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between h-14 px-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-admin-sidebar-toggle" />
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  Admin Console
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="hidden sm:flex text-xs"
                data-testid="badge-admin-status"
              >
                <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                System Online
              </Badge>
            </div>
          </header>

          <main className="flex-1 overflow-auto" data-testid="admin-main-content">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
