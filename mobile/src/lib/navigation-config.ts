import { Feather } from '@expo/vector-icons';

export type UserRole = 'owner' | 'solo_owner' | 'manager' | 'office_admin' | 'staff_tradie' | 'staff' | 'subcontractor' | 'team';

export interface NavItem {
  title: string;
  url: string;
  icon: keyof typeof Feather.glyphMap;
  description?: string;
  color?: 'primary' | 'success' | 'warning' | 'info' | 'muted' | 'destructive';
  bgColor?: 'primary' | 'success' | 'warning' | 'info' | 'muted' | 'destructive';
  requiresTeam?: boolean;
  requiresOwnerOrManager?: boolean;
  requiresPlatformAdmin?: boolean;
  hideForTradie?: boolean;
  hideForStaff?: boolean;
  hideInSimpleMode?: boolean;
  hideForSolo?: boolean;
  requiresProPlan?: boolean;
  requiresTeamPlan?: boolean;
  showLockedIfNoAccess?: boolean;
  locked?: boolean;
  lockReason?: string;
  allowedRoles?: UserRole[];
  showInBottomNav?: boolean;
  showInMore?: boolean;
  showBadge?: boolean;
  badge?: string;
  category?: 'work' | 'money' | 'addons' | 'team' | 'communication' | 'settings' | 'legal' | 'account' | 'featured' | 'admin';
}

export const mainMenuItems: NavItem[] = [
  {
    title: "Action Centre",
    url: "/more/action-center",
    icon: "crosshair",
    description: "What needs your attention today",
    color: "primary",
    bgColor: "primary",
    hideForStaff: true,
    showInMore: true,
    category: "featured",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
  },
  {
    title: "Autopilot",
    url: "/more/autopilot",
    icon: "cpu",
    description: "Automations that kill admin work",
    color: "primary",
    bgColor: "primary",
    requiresOwnerOrManager: true,
    requiresProPlan: true,
    showLockedIfNoAccess: true,
    hideForStaff: true,
    showInMore: true,
    category: "featured",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Clients",
    url: "/more/clients",
    icon: "users",
    description: "Manage your customers",
    color: "primary",
    bgColor: "primary",
    hideForStaff: true,
    showInMore: true,
    category: "work",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
  },
  {
    title: "Documents",
    url: "/more/documents",
    icon: "folder",
    description: "Quotes, invoices, and receipts",
    color: "primary",
    bgColor: "primary",
    hideForStaff: true,
    showInMore: true,
    category: "work",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
  },
  {
    title: "Payment Hub",
    url: "/more/payment-hub",
    icon: "dollar-sign",
    description: "Track invoices, payments, and quotes",
    color: "primary",
    bgColor: "primary",
    hideForStaff: true,
    showInMore: true,
    category: "money",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
  },
  {
    title: "Expenses",
    url: "/more/expenses",
    icon: "trending-down",
    description: "Track costs, scan receipts with AI",
    color: "primary",
    bgColor: "primary",
    hideForStaff: true,
    showInMore: true,
    category: "money",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Collect Payment",
    url: "/more/collect-payment",
    icon: "credit-card",
    description: "QR codes, payment links, receipts",
    color: "primary",
    bgColor: "primary",
    hideForStaff: true,
    showInMore: true,
    category: "money",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
  },
  {
    title: "Schedule",
    url: "/more/calendar",
    icon: "calendar",
    description: "Calendar and appointments",
    color: "primary",
    bgColor: "primary",
    showInMore: true,
    category: "work",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie', 'staff', 'subcontractor'],
  },
  {
    title: "Time Tracking",
    url: "/more/time-tracking",
    icon: "clock",
    description: "Track work hours and timesheets",
    color: "primary",
    bgColor: "primary",
    showInMore: true,
    category: "work",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff', 'subcontractor'],
  },
  {
    title: "Team Operations",
    url: "/more/team-operations",
    icon: "activity",
    description: "Live crew map, status & performance",
    color: "primary",
    bgColor: "primary",
    requiresTeamPlan: true,
    hideForStaff: true,
    showInMore: true,
    category: "team",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
    showLockedIfNoAccess: true,
  },
  {
    title: "Team Management",
    url: "/more/team-management",
    icon: "users",
    description: "Workers, roles, invites & seats",
    color: "primary",
    bgColor: "primary",
    requiresTeamPlan: true,
    hideForStaff: true,
    showInMore: true,
    category: "team",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
    showLockedIfNoAccess: true,
  },
  {
    title: "Dispatch Board",
    url: "/more/dispatch-board",
    icon: "grid",
    description: "Assign jobs to crew (schedule, kanban, map)",
    color: "primary",
    bgColor: "primary",
    requiresTeamPlan: true,
    hideForStaff: true,
    showInMore: true,
    category: "team",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
    showLockedIfNoAccess: true,
  },
  {
    title: "Chat",
    url: "/more/chat-hub",
    icon: "message-circle",
    description: "Team and job messaging",
    color: "primary",
    bgColor: "primary",
    showInMore: true,
    category: "communication",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie', 'staff', 'subcontractor'],
  },
  {
    title: "Insights",
    url: "/more/insights",
    icon: "trending-up",
    description: "Business health metrics and analytics",
    color: "primary",
    bgColor: "primary",
    requiresOwnerOrManager: true,
    requiresProPlan: true,
    showLockedIfNoAccess: true,
    hideForStaff: true,
    showInMore: true,
    category: "work",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Reports",
    url: "/more/reports",
    icon: "bar-chart-2",
    description: "Business analytics and insights",
    color: "primary",
    bgColor: "primary",
    requiresOwnerOrManager: true,
    requiresProPlan: true,
    showLockedIfNoAccess: true,
    hideForStaff: true,
    hideInSimpleMode: true,
    showInMore: true,
    category: "work",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Templates",
    url: "/more/templates",
    icon: "file",
    description: "Quote, invoice, and job templates",
    color: "primary",
    bgColor: "primary",
    hideForStaff: true,
    showInMore: true,
    category: "work",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Inventory & Equipment",
    url: "/more/inventory",
    icon: "package",
    description: "Stock, materials, tools, and assets",
    color: "primary",
    bgColor: "primary",
    hideForStaff: true,
    showInMore: true,
    category: "work",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Files",
    url: "/more/files",
    icon: "file",
    description: "Licences, insurance & compliance docs",
    color: "primary",
    bgColor: "primary",
    hideForStaff: false,
    showInMore: true,
    category: "work",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff'],
  },
  {
    title: "Communications",
    url: "/more/communications",
    icon: "send",
    description: "View sent emails and SMS messages",
    color: "primary",
    bgColor: "primary",
    hideForStaff: true,
    showInMore: true,
    category: "communication",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
  },
  {
    title: "WHS Safety",
    url: "/more/whs-hub",
    icon: "shield",
    description: "Incidents, JSAs, emergency plans & compliance",
    color: "primary",
    bgColor: "primary",
    showInMore: true,
    category: "work",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie', 'staff', 'subcontractor'],
  },
  {
    title: "Leads",
    url: "/more/leads",
    icon: "user-plus",
    description: "Track and convert potential customers",
    color: "primary",
    bgColor: "primary",
    hideForStaff: true,
    showInMore: true,
    category: "work",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
  },
  {
    title: "AI Receptionist",
    url: "/more/ai-receptionist",
    icon: "phone",
    description: "AI-powered call answering and booking",
    color: "primary",
    bgColor: "primary",
    hideForStaff: true,
    requiresProPlan: true,
    showLockedIfNoAccess: true,
    showInMore: true,
    category: "addons",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Custom Website",
    url: "/more/custom-website",
    icon: "globe",
    description: "Professional trade business website",
    color: "primary",
    bgColor: "primary",
    hideForStaff: true,
    requiresProPlan: true,
    showLockedIfNoAccess: true,
    showInMore: true,
    category: "addons",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
];

export const settingsMenuItems: NavItem[] = [
  {
    title: "Settings",
    url: "/more/settings",
    icon: "settings",
    description: "Business details and preferences",
    color: "primary",
    bgColor: "primary",
    showInMore: true,
    category: "settings",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie', 'staff', 'subcontractor'],
  },
  {
    title: "Integrations",
    url: "/more/integrations",
    icon: "link",
    description: "Connect external services",
    color: "primary",
    bgColor: "primary",
    hideForStaff: true,
    showInMore: true,
    category: "settings",
    allowedRoles: ['owner', 'solo_owner'],
  },
  {
    title: "Notifications",
    url: "/more/notifications",
    icon: "bell",
    description: "Push and email preferences",
    color: "primary",
    bgColor: "primary",
    showInMore: true,
    category: "settings",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff', 'subcontractor'],
  },
  {
    title: "Branding",
    url: "/more/branding",
    icon: "edit-3",
    description: "Custom branding & theming",
    color: "primary",
    bgColor: "primary",
    hideForStaff: true,
    requiresProPlan: true,
    showLockedIfNoAccess: true,
    showInMore: true,
    category: "settings",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "App Settings",
    url: "/more/app-settings",
    icon: "settings",
    description: "Theme and preferences",
    color: "primary",
    bgColor: "primary",
    showInMore: true,
    category: "settings",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff', 'subcontractor'],
  },
  {
    title: "Help & Support",
    url: "/more/support",
    icon: "help-circle",
    description: "FAQs, guides, and contact us",
    color: "primary",
    bgColor: "primary",
    showInMore: true,
    category: "settings",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff', 'subcontractor'],
  },
];

export const legalMenuItems: NavItem[] = [
  {
    title: "Privacy Policy",
    url: "/more/privacy-policy",
    icon: "shield",
    description: "How we protect your data",
    color: "success",
    bgColor: "success",
    showInMore: true,
    category: "legal",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff', 'subcontractor'],
  },
  {
    title: "Terms of Service",
    url: "/more/terms-of-service",
    icon: "file-text",
    description: "Terms and conditions",
    color: "muted",
    bgColor: "muted",
    showInMore: true,
    category: "legal",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff', 'subcontractor'],
  },
];

export const accountMenuItems: NavItem[] = [
  {
    title: "Subscription",
    url: "/more/subscription",
    icon: "star",
    description: "View your business plan details",
    color: "warning",
    bgColor: "warning",
    badge: "Plan",
    showInMore: true,
    category: "account",
    allowedRoles: ['owner', 'solo_owner'],
  },
  {
    title: "Delete Account",
    url: "/more/delete-account",
    icon: "trash-2",
    description: "Permanently delete your account",
    color: "destructive",
    bgColor: "destructive",
    showInMore: true,
    category: "account",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff', 'subcontractor'],
  },
];

export const adminMenuItems: NavItem[] = [
  {
    title: "Admin Dashboard",
    url: "/more/admin",
    icon: "shield",
    description: "Platform management",
    color: "destructive",
    bgColor: "destructive",
    requiresPlatformAdmin: true,
    showInMore: true,
    category: "admin",
    allowedRoles: ['owner', 'solo_owner'],
  },
  {
    title: "API & IAP Debug",
    url: "/more/api-debug",
    icon: "terminal",
    description: "Resolved API host, build profile, IAP state",
    color: "muted",
    bgColor: "muted",
    requiresPlatformAdmin: true,
    showInMore: true,
    category: "admin",
    allowedRoles: ['owner', 'solo_owner'],
  },
];

export const moreNavItem: NavItem = {
  title: "More",
  url: "/more",
  icon: "more-horizontal",
  showInBottomNav: true,
};

export interface FilterOptions {
  isTeam: boolean;
  isTradie: boolean;
  isOwner: boolean;
  isManager: boolean;
  isSolo: boolean;
  isSubcontractor?: boolean;
  userRole?: UserRole;
  isPlatformAdmin?: boolean;
  hasProSubscription?: boolean;
  hasTeamSubscription?: boolean;
  isSimpleMode?: boolean;
}

export function filterNavItems(items: NavItem[], options: FilterOptions): NavItem[] {
  const isOwnerOrManager = options.isOwner || options.isManager;
  const isStaffTradie = (options.isTradie || options.isSubcontractor) && !isOwnerOrManager;
  
  const results: NavItem[] = [];
  
  for (const rawItem of items) {
    const item = { ...rawItem };
    
    if (item.requiresPlatformAdmin && !options.isPlatformAdmin) {
      continue;
    }
    
    if (item.allowedRoles && options.userRole) {
      if (!item.allowedRoles.includes(options.userRole)) {
        continue;
      }
    }
    
    if (item.hideForStaff && isStaffTradie) {
      continue;
    }

    if (item.hideForSolo && options.isSolo) {
      if (item.showLockedIfNoAccess) {
        item.locked = true;
        item.lockReason = 'Available on the Team plan. Upgrade in Subscription settings.';
        item.badge = 'Team';
      } else {
        continue;
      }
    }

    if (item.hideInSimpleMode && options.isSimpleMode) {
      if (item.showLockedIfNoAccess) {
        item.locked = true;
        item.lockReason = 'Available on the Team plan. Upgrade in Subscription settings.';
        item.badge = 'Team';
      } else {
        continue;
      }
    }

    if (item.requiresProPlan && options.hasProSubscription === false) {
      if (item.showLockedIfNoAccess) {
        item.locked = true;
        item.lockReason = 'Available on the Pro plan. Upgrade in Subscription settings.';
        item.badge = 'Pro';
      } else {
        continue;
      }
    }

    if (item.requiresTeamPlan && options.hasTeamSubscription === false) {
      if (item.showLockedIfNoAccess) {
        item.locked = true;
        item.lockReason = 'Available on the Team plan. Upgrade in Subscription settings.';
        item.badge = 'Team';
      } else {
        continue;
      }
    }
    
    if (item.requiresTeam && !options.isTeam) {
      if (item.showLockedIfNoAccess) {
        item.locked = true;
        item.lockReason = 'Available on the Team plan. Upgrade in Subscription settings.';
        item.badge = 'Team';
      } else {
        continue;
      }
    }
    if (item.requiresOwnerOrManager && !isOwnerOrManager) {
      continue;
    }
    if (item.hideForTradie && isStaffTradie) {
      continue;
    }
    
    results.push(item);
  }
  
  return results;
}

export function getBottomNavItems(options: FilterOptions): NavItem[] {
  const filtered = filterNavItems(mainMenuItems, options);
  const bottomItems = filtered.filter(item => item.showInBottomNav);
  return [...bottomItems, moreNavItem];
}

export function getMorePageItems(options: FilterOptions): NavItem[] {
  const allItems = [...mainMenuItems, ...settingsMenuItems, ...legalMenuItems, ...accountMenuItems, ...adminMenuItems];
  const filtered = filterNavItems(allItems, options);
  return filtered.filter(item => item.showInMore);
}

export function getMorePageItemsByCategory(options: FilterOptions): Record<string, NavItem[]> {
  const items = getMorePageItems(options);
  const categories: Record<string, NavItem[]> = {
    featured: [],
    work: [],
    addons: [],
    money: [],
    team: [],
    communication: [],
    settings: [],
    legal: [],
    account: [],
    admin: [],
  };
  
  items.forEach(item => {
    const category = item.category || 'work';
    if (categories[category]) {
      categories[category].push(item);
    }
  });
  
  return categories;
}

export const categoryLabels: Record<string, string> = {
  featured: '',
  work: 'Work',
  addons: 'Add-ons',
  money: 'Payment Hub',
  team: 'Team',
  communication: 'Communication',
  settings: 'Settings',
  legal: 'Legal',
  account: 'Account',
  admin: 'Platform Admin',
};

export const categoryOrder = [
  'featured',
  'work',
  'addons',
  'money',
  'team',
  'communication',
  'settings',
  'legal',
  'account',
  'admin',
];

export interface SidebarNavItem {
  id: string;
  title: string;
  icon: keyof typeof Feather.glyphMap;
  path: string;
  matchPaths?: string[];
  section: 'main' | 'settings';
  hideForStaff?: boolean;
  requiresOwnerOrManager?: boolean;
  requiresProPlan?: boolean;
  requiresTeam?: boolean;
  allowedRoles?: UserRole[];
}

export const sidebarMainItems: SidebarNavItem[] = [
  { 
    id: 'dashboard',
    title: 'Dashboard', 
    icon: 'home', 
    path: '/',
    matchPaths: ['/', '/index'],
    section: 'main',
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie', 'staff', 'subcontractor', 'team'],
  },
  { 
    id: 'action-center',
    title: 'Action Centre', 
    icon: 'crosshair', 
    path: '/more/action-center',
    matchPaths: ['/more/action-center'],
    section: 'main',
    hideForStaff: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
  },
  { 
    id: 'work',
    title: 'Work', 
    icon: 'briefcase', 
    path: '/jobs',
    matchPaths: ['/jobs', '/job'],
    section: 'main',
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie', 'staff', 'subcontractor', 'team'],
  },
  { 
    id: 'clients',
    title: 'Clients', 
    icon: 'users', 
    path: '/more/clients',
    matchPaths: ['/more/clients', '/more/client'],
    section: 'main',
    hideForStaff: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
  },
  { 
    id: 'documents',
    title: 'Documents', 
    icon: 'folder', 
    path: '/more/documents',
    matchPaths: ['/more/documents'],
    section: 'main',
    hideForStaff: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
  },
  { 
    id: 'payment-hub',
    title: 'Payment Hub', 
    icon: 'credit-card', 
    path: '/more/payment-hub',
    matchPaths: ['/more/payment-hub', '/money', '/more/invoices', '/more/quotes'],
    section: 'main',
    hideForStaff: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
  },
  { 
    id: 'expenses',
    title: 'Expenses', 
    icon: 'trending-down', 
    path: '/more/expenses',
    matchPaths: ['/more/expenses'],
    section: 'main',
    hideForStaff: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  { 
    id: 'calendar',
    title: 'Schedule', 
    icon: 'calendar', 
    path: '/more/calendar',
    matchPaths: ['/more/calendar'],
    section: 'main',
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie', 'staff', 'subcontractor', 'team'],
  },
  { 
    id: 'time-tracking',
    title: 'Time Tracking', 
    icon: 'clock', 
    path: '/more/time-tracking',
    matchPaths: ['/more/time-tracking'],
    section: 'main',
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff', 'subcontractor', 'team'],
  },
  { 
    id: 'team-operations',
    title: 'Team Operations', 
    icon: 'activity', 
    path: '/more/team-operations',
    matchPaths: ['/more/team-operations', '/more/team-management', '/more/dispatch-board'],
    section: 'main',
    hideForStaff: true,
    requiresTeam: true,
    requiresOwnerOrManager: true,
    allowedRoles: ['owner', 'manager'],
  },
  { 
    id: 'chat',
    title: 'Chat', 
    icon: 'message-circle', 
    path: '/more/chat-hub',
    matchPaths: ['/more/chat-hub', '/more/team-chat', '/more/direct-messages'],
    section: 'main',
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie', 'staff', 'subcontractor', 'team'],
  },
  { 
    id: 'insights',
    title: 'Insights', 
    icon: 'trending-up', 
    path: '/more/insights',
    matchPaths: ['/more/insights'],
    section: 'main',
    hideForStaff: true,
    requiresOwnerOrManager: true,
    requiresProPlan: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  { 
    id: 'autopilot',
    title: 'Autopilot', 
    icon: 'cpu', 
    path: '/more/autopilot',
    matchPaths: ['/more/autopilot'],
    section: 'main',
    hideForStaff: true,
    requiresOwnerOrManager: true,
    requiresProPlan: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  { 
    id: 'reports',
    title: 'Reports', 
    icon: 'bar-chart-2', 
    path: '/more/reports',
    matchPaths: ['/more/reports'],
    section: 'main',
    hideForStaff: true,
    requiresOwnerOrManager: true,
    requiresProPlan: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  { 
    id: 'collect-payment',
    title: 'Collect Payment', 
    icon: 'smartphone', 
    path: '/more/collect-payment',
    matchPaths: ['/more/collect-payment'],
    section: 'main',
    hideForStaff: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
  },
  { 
    id: 'templates',
    title: 'Templates', 
    icon: 'file-text', 
    path: '/more/templates',
    matchPaths: ['/more/templates'],
    section: 'main',
    hideForStaff: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  { 
    id: 'inventory',
    title: 'Inventory & Equipment', 
    icon: 'package', 
    path: '/more/inventory',
    matchPaths: ['/more/inventory', '/more/equipment'],
    section: 'main',
    hideForStaff: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  { 
    id: 'files',
    title: 'Files', 
    icon: 'file', 
    path: '/more/files',
    matchPaths: ['/more/files'],
    section: 'main',
    hideForStaff: false,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff'],
  },
  { 
    id: 'communications',
    title: 'Communications', 
    icon: 'send', 
    path: '/more/communications',
    matchPaths: ['/more/communications'],
    section: 'main',
    hideForStaff: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
  },
  { 
    id: 'whs-hub',
    title: 'WHS Safety', 
    icon: 'shield', 
    path: '/more/whs-hub',
    matchPaths: ['/more/whs-hub'],
    section: 'main',
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie', 'staff', 'subcontractor'],
  },
  { 
    id: 'leads',
    title: 'Leads', 
    icon: 'user-plus', 
    path: '/more/leads',
    matchPaths: ['/more/leads'],
    section: 'main',
    hideForStaff: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
  },
];

export const sidebarSettingsItems: SidebarNavItem[] = [
  { 
    id: 'integrations',
    title: 'Integrations', 
    icon: 'link', 
    path: '/more/integrations',
    matchPaths: ['/more/integrations'],
    section: 'settings',
    hideForStaff: true,
    requiresOwnerOrManager: true,
    allowedRoles: ['owner', 'solo_owner'],
  },
  { 
    id: 'settings',
    title: 'Settings', 
    icon: 'settings', 
    path: '/more/settings',
    matchPaths: ['/more/settings', '/more/business-settings', '/more/app-settings', '/more/subscription', '/more/notifications', '/more/notification-preferences', '/more/ai-assistant', '/more/profile-edit'],
    section: 'settings',
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie', 'staff', 'subcontractor'],
  },
];

export function filterSidebarItems(items: SidebarNavItem[], options: FilterOptions): SidebarNavItem[] {
  const isOwnerOrManager = options.isOwner || options.isManager;
  const isStaffTradie = (options.isTradie || options.isSubcontractor) && !isOwnerOrManager;
  
  return items.filter(item => {
    if (item.allowedRoles && options.userRole) {
      if (!item.allowedRoles.includes(options.userRole)) {
        return false;
      }
    }
    
    if (item.hideForStaff && isStaffTradie) {
      return false;
    }

    if (item.requiresProPlan && options.hasProSubscription === false) {
      return false;
    }

    if (item.requiresTeam && (!options.isTeam || options.hasTeamSubscription === false)) {
      return false;
    }
    
    if (item.requiresOwnerOrManager && !isOwnerOrManager) {
      return false;
    }
    
    return true;
  });
}

export function getFilteredSidebarMainItems(options: FilterOptions): SidebarNavItem[] {
  return filterSidebarItems(sidebarMainItems, options);
}

export function getFilteredSidebarSettingsItems(options: FilterOptions): SidebarNavItem[] {
  return filterSidebarItems(sidebarSettingsItems, options);
}

export function isSidebarPathActive(pathname: string, item: SidebarNavItem): boolean {
  const chatRoutes = ['/more/chat-hub', '/more/team-chat', '/more/direct-messages'];
  const isChatRoute = chatRoutes.some(r => pathname === r || pathname.startsWith(r + '/'));
  
  if (isChatRoute && item.id === 'chat') {
    return true;
  }
  if (isChatRoute && item.id !== 'chat') {
    return false;
  }
  
  if (item.matchPaths) {
    return item.matchPaths.some(p => pathname === p || pathname.startsWith(p + '/'));
  }
  return pathname === item.path;
}
