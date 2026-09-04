import { 
  LayoutDashboard, 
  Briefcase, 
  Users, 
  FileText, 
  Receipt, 
  Calendar,
  Settings,
  Zap,
  Clock,
  UserPlus,
  BarChart3,
  MessageCircle,
  Map,
  Home,
  MoreHorizontal,
  LayoutGrid,
  Smartphone,
  UserCircle,
  Wallet,
  ClipboardList,
  Files,
  Send,
  Repeat,
  Wrench,
  PackageOpen,
  Target,
  LineChart,
  Bot,
  DollarSign,
  Shield,
  ShieldCheck,
  CalendarDays,
  Columns3,
  HelpCircle,
  type LucideIcon
} from "lucide-react";

import { type UserRole } from "./permissions";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  description?: string;
  color?: string;
  bgColor?: string;
  requiresTeam?: boolean;
  requiresOwnerOrManager?: boolean;
  hideForTradie?: boolean;
  hideForStaff?: boolean;  // Hide from staff tradies completely
  hideInSimpleMode?: boolean;  // Hide when simple mode is active
  requiresProPlan?: boolean;  // Requires Pro or higher subscription
  allowedRoles?: UserRole[];  // Explicit role whitelist
  showInBottomNav?: boolean;
  showInSidebar?: boolean;
  showInMore?: boolean;
  showBadge?: boolean;
}

export const mainMenuItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
    description: "Overview of your business",
    color: "text-primary",
    bgColor: "bg-primary/10",
    showInBottomNav: true,
    showInSidebar: true,
    showInMore: false,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'],
  },
  {
    title: "Action Centre",
    url: "/action-center",
    icon: Target,
    description: "What needs your attention today",
    color: "text-primary",
    bgColor: "bg-primary/10",
    hideForStaff: true,
    showInSidebar: true,
    showInMore: false,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
  },
  {
    title: "Work",
    url: "/work",
    icon: Briefcase,
    description: "Manage your jobs and work",
    color: "text-primary",
    bgColor: "bg-primary/10",
    showInBottomNav: true,
    showInSidebar: true,
    showInMore: false,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'],
  },
  {
    title: "Clients",
    url: "/clients",
    icon: Users,
    description: "Manage your customers",
    color: "text-primary",
    bgColor: "bg-primary/10",
    hideForStaff: true,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
  },
  {
    title: "Documents",
    url: "/documents",
    icon: Files,
    description: "Quotes, invoices, and receipts",
    color: "text-primary",
    bgColor: "bg-primary/10",
    hideForStaff: true,
    showInSidebar: true,
    showInBottomNav: false,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
  },
  {
    title: "Payment Hub",
    url: "/payment-hub",
    icon: Wallet,
    description: "Track invoices, payments, and quotes",
    color: "text-success",
    bgColor: "bg-success/10",
    hideForStaff: true,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
  },
  {
    title: "Expenses",
    url: "/expenses",
    icon: Receipt,
    description: "Track expenses, scan receipts, manage categories",
    color: "text-muted-foreground",
    bgColor: "bg-muted/10",
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'],
  },
  {
    title: "Schedule",
    url: "/schedule",
    icon: Calendar,
    description: "Calendar and schedule view",
    color: "text-success",
    bgColor: "bg-success/10",
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'],
  },
  {
    title: "Dispatch",
    url: "/dispatch",
    icon: Columns3,
    description: "Advanced dispatch board: workers, equipment, materials",
    color: "text-blue-600",
    bgColor: "bg-blue-600/10",
    requiresTeam: true,
    hideForStaff: true,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
  },
  {
    title: "Time Tracking",
    url: "/time-tracking",
    icon: Clock,
    description: "Track work hours and manage timesheets",
    color: "text-muted-foreground",
    bgColor: "bg-muted/10",
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'],
  },
  {
    title: "Team",
    url: "/team",
    icon: Users,
    description: "Members, subcontractors and access — all in one place",
    color: "text-success",
    bgColor: "bg-success/10",
    hideForStaff: true,
    hideInSimpleMode: false,
    requiresOwnerOrManager: true,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Staff Licences",
    url: "/staff-licences",
    icon: ShieldCheck,
    description: "Track team licences, certifications, and compliance tickets",
    color: "text-blue-600",
    bgColor: "bg-blue-600/10",
    hideForStaff: true,
    hideInSimpleMode: true,
    requiresOwnerOrManager: true,
    requiresTeam: true,
    showInSidebar: false,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Leave",
    url: "/leave-management",
    icon: CalendarDays,
    description: "Manage leave requests, team calendar, and leave balances",
    color: "text-violet-600",
    bgColor: "bg-violet-600/10",
    hideForStaff: true,
    hideInSimpleMode: true,
    requiresOwnerOrManager: true,
    requiresTeam: true,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Chat",
    url: "/chat",
    icon: MessageCircle,
    description: "Team and job messaging",
    color: "text-primary",
    bgColor: "bg-primary/10",
    showInBottomNav: true,
    showInSidebar: true,
    showInMore: false,
    showBadge: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'],
  },
  {
    title: "Map",
    url: "/map",
    icon: Map,
    description: "View jobs and team on map",
    color: "text-success",
    bgColor: "bg-success/10",
    hideForStaff: false,
    hideInSimpleMode: true,
    showInBottomNav: false,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'],
  },
  {
    title: "Insights",
    url: "/insights",
    icon: LineChart,
    description: "Business health metrics and analytics",
    color: "text-primary",
    bgColor: "bg-primary/10",
    requiresOwnerOrManager: true,
    requiresProPlan: true,
    hideForStaff: true,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Payroll",
    url: "/reports/payroll",
    icon: DollarSign,
    description: "Pay runs, receivables, and utilisation",
    color: "text-primary",
    bgColor: "bg-primary/10",
    requiresOwnerOrManager: true,
    requiresTeam: true,
    hideForStaff: true,
    hideInSimpleMode: true,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'manager'],
  },
  {
    title: "Sub Invoices",
    url: "/team?tab=subinvoices",
    icon: Receipt,
    description: "Review, approve, and pay subcontractor invoices",
    color: "text-primary",
    bgColor: "bg-primary/10",
    requiresOwnerOrManager: true,
    requiresProPlan: true,
    hideForStaff: true,
    hideInSimpleMode: true,
    showInSidebar: false,
    showInMore: false,
    allowedRoles: ['owner', 'manager'],
  },
  {
    title: "Autopilot",
    url: "/autopilot",
    icon: Bot,
    description: "Automations that kill admin work",
    color: "text-primary",
    bgColor: "bg-primary/10",
    requiresOwnerOrManager: true,
    requiresProPlan: true,
    hideForStaff: true,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Reports",
    url: "/reports",
    icon: BarChart3,
    description: "Business reports and analytics",
    color: "text-primary",
    bgColor: "bg-primary/10",
    requiresOwnerOrManager: true,
    requiresProPlan: true,
    hideForStaff: true,
    hideInSimpleMode: true,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Collect Payment",
    url: "/collect-payment",
    icon: Smartphone,
    description: "Get paid on-site with Tap to Pay",
    color: "text-success",
    bgColor: "bg-success/10",
    hideForStaff: true,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
  },
  {
    title: "Templates",
    url: "/templates",
    icon: LayoutGrid,
    description: "Styles, components, and document templates",
    color: "text-primary",
    bgColor: "bg-primary/10",
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'],
  },
  // Hidden for now - will be added back when fully integrated with mobile
  // {
  //   title: "Recurring Jobs",
  //   url: "/recurring-jobs",
  //   icon: Repeat,
  //   description: "Manage scheduled recurring work",
  //   color: "text-primary",
  //   bgColor: "bg-primary/10",
  //   hideForStaff: true,
  //   showInSidebar: true,
  //   showInMore: true,
  //   allowedRoles: ['owner', 'solo_owner', 'manager'],
  // },
  // {
  //   title: "Leads",
  //   url: "/leads",
  //   icon: UserPlus,
  //   description: "Track enquiries and convert to clients",
  //   color: "text-primary",
  //   bgColor: "bg-primary/10",
  //   hideForStaff: true,
  //   showInSidebar: true,
  //   showInMore: true,
  //   allowedRoles: ['owner', 'solo_owner', 'manager'],
  // },
  {
    title: "Inventory & Equipment",
    url: "/inventory",
    icon: PackageOpen,
    description: "Stock, materials, tools, and assets",
    color: "text-primary",
    bgColor: "bg-primary/10",
    hideForStaff: true,
    hideInSimpleMode: false,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Files",
    url: "/files",
    icon: FileText,
    description: "Licences, insurance & compliance docs",
    color: "text-primary",
    bgColor: "bg-primary/10",
    hideForStaff: false,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'],
  },
  {
    title: "Communications",
    url: "/communications",
    icon: Send,
    description: "View sent emails and SMS messages",
    color: "text-primary",
    bgColor: "bg-primary/10",
    hideForStaff: true,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
  },
  {
    title: "WHS Safety",
    url: "/whs",
    icon: Shield,
    description: "Incidents, JSAs, emergency plans & compliance",
    color: "text-warning",
    bgColor: "bg-warning/10",
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'],
  },
];

export const settingsMenuItems: NavItem[] = [
  {
    title: "Integrations",
    url: "/integrations",
    icon: Zap,
    description: "Connect Stripe & SendGrid",
    color: "text-warning",
    bgColor: "bg-warning/10",
    requiresOwnerOrManager: true,
    hideForStaff: true,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner'],
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    description: "Your details and preferences",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    hideForStaff: false,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'],
  },
  {
    title: "Help & Support",
    url: "/support",
    icon: HelpCircle,
    description: "Guides, FAQs, and support",
    color: "text-primary",
    bgColor: "bg-primary/10",
    hideForStaff: false,
    showInSidebar: false,  // rendered separately in AppSidebar with onShowHelp handler
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'],
  },
];

export const moreNavItem: NavItem = {
  title: "More",
  url: "/more",
  icon: MoreHorizontal,
  showInBottomNav: true,
};

export interface FilterOptions {
  isTeam: boolean;
  isTradie: boolean;
  isOwner: boolean;
  isManager: boolean;
  userRole?: UserRole;
  isSimpleMode?: boolean;
  hasProSubscription?: boolean;
  extraAllowedUrls?: string[];  // Nav URLs unlocked by granted worker permissions
}

export function filterNavItems(items: NavItem[], options: FilterOptions): NavItem[] {
  const isOwnerOrManager = options.isOwner || options.isManager;
  const isStaffTradie = options.isTradie && !isOwnerOrManager;
  
  return items.filter(item => {
    // Worker permission override: an explicitly granted permission unlocks the
    // matching nav item even when role/hideForStaff would normally hide it.
    const grantedByPermission = options.extraAllowedUrls?.includes(item.url) ?? false;

    // Use allowedRoles if specified (new permission system)
    if (item.allowedRoles && options.userRole && !grantedByPermission) {
      if (!item.allowedRoles.includes(options.userRole)) {
        return false;
      }
    }
    
    // Hide from staff tradies
    if (item.hideForStaff && isStaffTradie && !grantedByPermission) {
      return false;
    }

    // Hide items that require Pro plan
    if (item.requiresProPlan && options.hasProSubscription === false) {
      return false;
    }

    // Hide in simple mode
    if (item.hideInSimpleMode && options.isSimpleMode) {
      return false;
    }
    
    // Legacy checks for backwards compatibility
    if (item.requiresTeam && !options.isTeam) {
      return false;
    }
    if (item.requiresOwnerOrManager && !isOwnerOrManager) {
      return false;
    }
    if (item.hideForTradie && isStaffTradie) {
      return false;
    }
    
    return true;
  });
}

export function getBottomNavItems(options: FilterOptions): NavItem[] {
  const filtered = filterNavItems(mainMenuItems, options);
  const bottomItems = filtered.filter(item => item.showInBottomNav);
  return [...bottomItems, moreNavItem];
}

export function getSidebarMenuItems(options: FilterOptions): NavItem[] {
  const filtered = filterNavItems(mainMenuItems, options);
  return filtered.filter(item => item.showInSidebar);
}

export function getSidebarSettingsItems(options: FilterOptions): NavItem[] {
  const filtered = filterNavItems(settingsMenuItems, options);
  return filtered.filter(item => item.showInSidebar !== false);
}

export function getMorePageItems(options: FilterOptions): NavItem[] {
  const allItems = [...mainMenuItems, ...settingsMenuItems];
  const filtered = filterNavItems(allItems, options);
  // Show items where showInMore is true (or undefined and showInSidebar is true)
  // Exclude items where showInMore is explicitly false (bottom nav items)
  return filtered.filter(item => {
    if (item.showInMore === false) return false;
    return item.showInMore || item.showInSidebar;
  });
}

export function getMorePagesPattern(): RegExp {
  const allItems = [...mainMenuItems, ...settingsMenuItems];
  const morePaths = allItems
    .filter(item => item.showInMore)
    .map(item => item.url.replace('/', ''))
    .filter(Boolean);
  return new RegExp(`^\\/(${morePaths.join('|')})`);
}
