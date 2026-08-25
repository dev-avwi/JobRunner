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
  hideForStandaloneSubcontractor?: boolean;
  requiresProPlan?: boolean;
  requiresTeamPlan?: boolean;
  freeForStandaloneSubcontractor?: boolean;
  showLockedIfNoAccess?: boolean;
  locked?: boolean;
  lockReason?: string;
  allowedRoles?: UserRole[];
  // Additive unlock: a team member whose role grants this permission sees the
  // item even if their role is not in `allowedRoles` (and bypasses the
  // role-based hide flags). Subscription/plan gates still apply.
  // Accepts a single permission string or a list — the item unlocks if the
  // user holds ANY of them. A list is used where the same feature is stored in
  // more than one permission vocabulary (e.g. reports: granular `view_reports`
  // from the role editor vs coarse `read_reports` from the Admin/Manager presets).
  requiredPermission?: string | string[];
  // When true, `requiredPermission` is a HARD gate, not just an additive unlock:
  // the item is shown ONLY to users who hold one of the permissions (or the `*`
  // wildcard). Being in `allowedRoles` by role name is NOT enough on its own.
  // Owners/solo owners hold `*`, so they always pass. Used for Leads,
  // Communications and the Action Centre so a manager who has had the matching
  // permission removed via custom permissions stops seeing a menu item that
  // would only 403 — matching the server-side API gate.
  strictPermission?: boolean;
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
    hideForStandaloneSubcontractor: true,
    color: "primary",
    bgColor: "primary",
    hideForStaff: true,
    showInMore: true,
    category: "featured",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
    // Custom roles granted the (new) action-centre permission can reach this
    // page. Not a DEFAULT worker permission, so default workers are unchanged.
    requiredPermission: ['view_action_center'],
    // Gate strictly on the permission, not role name: a manager/office_admin
    // who had view_action_center removed via custom permissions should not see
    // an item that only 403s. Owners hold `*` so they always pass.
    strictPermission: true,
  },
  {
    title: "Autopilot",
    url: "/more/autopilot",
    icon: "cpu",
    description: "Automations that kill admin work",
    hideForStandaloneSubcontractor: true,
    color: "primary",
    bgColor: "primary",
    requiresOwnerOrManager: true,
    requiresProPlan: true,
    showLockedIfNoAccess: true,
    hideForStaff: true,
    showInMore: true,
    category: "featured",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
    // Automations live under business settings; a role granted manage_settings
    // can reach Autopilot. Pro-plan lock below still applies. Not a DEFAULT
    // worker permission, so default workers are unchanged.
    requiredPermission: ['manage_settings'],
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
    // Client-management grants unlock this page. Deliberately excludes the
    // read-only `view_clients` (a DEFAULT worker permission) so default workers
    // are unchanged; only create/edit/write_clients holders gain access.
    requiredPermission: ['edit_clients', 'create_clients', 'write_clients'],
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
    // Quote/invoice read grants unlock Documents. Coarse read_quotes/read_invoices
    // are what the role editor stores; granular view_* covers older roles. None
    // are DEFAULT worker permissions, so default workers are unchanged.
    requiredPermission: ['view_quotes', 'view_invoices', 'read_quotes', 'read_invoices'],
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
    // Server gates payment recording via MANAGE_PAYMENTS; the role-editor worker
    // vocab stores this as `collect_payments` (aliased → manage_payments). Neither
    // is a DEFAULT worker permission, so default workers' menus are unchanged.
    requiredPermission: ['collect_payments', 'manage_payments'],
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
    // Server gates expense writes via createPermissionMiddleware(WRITE_EXPENSES).
    // Expenses uses the coarse read_/write_ vocabulary (no granular alias);
    // neither is a DEFAULT worker permission.
    requiredPermission: ['read_expenses', 'write_expenses'],
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
    // Worker vocab `collect_payments` (aliased → manage_payments) is the
    // payment-collection permission; not a DEFAULT worker permission.
    requiredPermission: ['collect_payments', 'manage_payments'],
  },
  {
    title: "Schedule",
    url: "/more/schedule",
    icon: "calendar",
    description: "Schedule and track your jobs",
    color: "primary",
    bgColor: "primary",
    showInMore: true,
    category: "work",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
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
    hideForStandaloneSubcontractor: true,
    color: "primary",
    bgColor: "primary",
    requiresTeamPlan: true,
    hideForStaff: true,
    showInMore: true,
    category: "team",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
    showLockedIfNoAccess: true,
    // Dispatch/team-manage grants unlock the live crew view. Team-plan lock
    // below still applies. None is a DEFAULT worker permission.
    requiredPermission: ['view_dispatch', 'assign_jobs', 'manage_team'],
  },
  {
    title: "Team Management",
    url: "/more/team-management",
    icon: "users",
    description: "Workers, roles, invites & seats",
    hideForStandaloneSubcontractor: true,
    color: "primary",
    bgColor: "primary",
    requiresTeamPlan: true,
    hideForStaff: true,
    showInMore: true,
    category: "team",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
    showLockedIfNoAccess: true,
    // Team-management grants unlock this page. Team-plan lock below still
    // applies. Not a DEFAULT worker permission.
    requiredPermission: ['manage_team', 'manage_roles'],
  },
  {
    title: "Leave",
    url: "/more/leave-request",
    icon: "calendar",
    description: "Submit and track leave requests",
    color: "primary",
    bgColor: "primary",
    showInMore: true,
    category: "team",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff'],
  },
  {
    title: "My Expenses",
    url: "/more/my-expenses",
    icon: "trending-down",
    description: "View all your submitted expense receipts",
    color: "primary",
    bgColor: "primary",
    showInMore: true,
    category: "team",
    allowedRoles: ['staff_tradie', 'staff', 'subcontractor'],
  },
  {
    title: "Dispatch Board",
    url: "/more/dispatch-board",
    icon: "grid",
    description: "Assign jobs to crew (schedule, kanban, map)",
    hideForStandaloneSubcontractor: true,
    color: "primary",
    bgColor: "primary",
    requiresTeamPlan: true,
    hideForStaff: true,
    showInMore: true,
    category: "team",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
    showLockedIfNoAccess: true,
    // Dispatch-view or job-assignment grant unlocks dispatch. Team-plan lock
    // below still applies. Neither is a DEFAULT worker permission.
    requiredPermission: ['view_dispatch', 'assign_jobs'],
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
    hideForStandaloneSubcontractor: true,
    color: "primary",
    bgColor: "primary",
    requiresOwnerOrManager: true,
    requiresProPlan: true,
    showLockedIfNoAccess: true,
    hideForStaff: true,
    showInMore: true,
    category: "work",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
    // Reports-read grant unlocks Insights (same data family). Pro-plan lock
    // below still applies. Not a DEFAULT worker permission.
    requiredPermission: ['view_reports', 'read_reports'],
  },
  {
    title: "Reports",
    url: "/more/reports",
    icon: "bar-chart-2",
    description: "Business analytics and insights",
    hideForStandaloneSubcontractor: true,
    color: "primary",
    bgColor: "primary",
    requiresOwnerOrManager: true,
    requiresProPlan: true,
    showLockedIfNoAccess: true,
    hideForStaff: true,
    showInMore: true,
    category: "work",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
    requiredPermission: ['view_reports', 'read_reports'],
  },
  {
    title: "Templates",
    url: "/more/templates-hub",
    icon: "file",
    description: "Job cards and forms your team fills in on site",
    color: "primary",
    bgColor: "primary",
    hideForStaff: false,
    showInMore: true,
    category: "work",
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
    requiredPermission: 'manage_catalog',
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
    // Custom roles granted the (new) communications permission can reach this
    // page. Not a DEFAULT worker permission, so default workers are unchanged.
    requiredPermission: ['view_communications', 'read_communications'],
    // Gate strictly on the permission, not role name (see Action Centre).
    strictPermission: true,
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
    // Custom roles granted the (new) leads permission can reach this page.
    // Not a DEFAULT worker permission, so default workers are unchanged.
    requiredPermission: ['view_leads', 'read_leads'],
    // Gate strictly on the permission, not role name (see Action Centre).
    strictPermission: true,
  },
  {
    title: "AI Receptionist",
    url: "/more/ai-receptionist",
    icon: "phone",
    description: "AI-powered call answering and booking",
    hideForStandaloneSubcontractor: true,
    color: "primary",
    bgColor: "primary",
    hideForStaff: true,
    requiresProPlan: true,
    showLockedIfNoAccess: true,
    showInMore: true,
    category: "addons",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
    requiredPermission: 'manage_ai_receptionist',
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
    freeForStandaloneSubcontractor: true,
    showLockedIfNoAccess: true,
    showInMore: true,
    category: "addons",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
    // The website builder lives under business settings; a role granted
    // manage_settings can reach it. Pro-plan lock above still applies. Not a
    // DEFAULT worker permission.
    requiredPermission: ['manage_settings'],
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
    // A role granted manage_settings can reach Integrations. Not a DEFAULT
    // worker permission, so default workers are unchanged.
    requiredPermission: ['manage_settings'],
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
    freeForStandaloneSubcontractor: true,
    showLockedIfNoAccess: true,
    showInMore: true,
    category: "settings",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
    // A role granted manage_settings can reach Branding. Pro-plan lock above
    // still applies. Not a DEFAULT worker permission.
    requiredPermission: ['manage_settings'],
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
  isStandaloneSubcontractor?: boolean;
  userRole?: UserRole;
  isPlatformAdmin?: boolean;
  hasProSubscription?: boolean;
  hasTeamSubscription?: boolean;
  isSimpleMode?: boolean;
  // Granted permission keys for the current user. Used by `requiredPermission`
  // to additively unlock items for custom roles that aren't in `allowedRoles`.
  permissions?: string[];
}

// True when the item declares a `requiredPermission` the user has been granted
// (or holds the `*` wildcard). Used to additively bypass role-based gates.
function userHasItemPermission(
  item: { requiredPermission?: string | string[] },
  options: FilterOptions,
): boolean {
  if (!item.requiredPermission) return false;
  const perms = options.permissions;
  if (!Array.isArray(perms)) return false;
  if (perms.includes('*')) return true;
  const required = Array.isArray(item.requiredPermission)
    ? item.requiredPermission
    : [item.requiredPermission];
  return required.some((p) => perms.includes(p));
}

export function filterNavItems(items: NavItem[], options: FilterOptions): NavItem[] {
  const isOwnerOrManager = options.isOwner || options.isManager;
  const isStaffTradie = (options.isTradie || options.isSubcontractor) && !isOwnerOrManager;
  
  const results: NavItem[] = [];
  
  for (const rawItem of items) {
    const item = { ...rawItem };

    // Additive permission unlock: a custom role granted the item's
    // `requiredPermission` bypasses the role-based gates below (allowedRoles,
    // hideForStaff, hideForTradie, requiresOwnerOrManager). Subscription/plan
    // gates still apply (they lock rather than hide via showLockedIfNoAccess).
    const permissionUnlock = userHasItemPermission(item, options);
    
    if (item.requiresPlatformAdmin && !options.isPlatformAdmin) {
      continue;
    }

    // Hard permission gate: role name alone is never enough. Owners always pass
    // (explicit bypass — their cached permission set isn't always the `*`
    // wildcard, e.g. the /api/team/my-role 404 fallback stores an explicit key
    // list); a manager/office_admin who had the permission removed via custom
    // permissions is hidden, matching the server API gate instead of showing an
    // item that only 403s.
    if (item.strictPermission && !permissionUnlock && !options.isOwner) {
      continue;
    }
    
    if (item.allowedRoles && options.userRole && !permissionUnlock) {
      if (!item.allowedRoles.includes(options.userRole)) {
        continue;
      }
    }
    
    if (item.hideForStandaloneSubcontractor && options.isStandaloneSubcontractor && !permissionUnlock) {
      continue;
    }
    
    if (item.hideForStaff && isStaffTradie && !permissionUnlock) {
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

    if (
      item.requiresProPlan &&
      options.hasProSubscription === false &&
      !(item.freeForStandaloneSubcontractor && options.isStandaloneSubcontractor)
    ) {
      if (item.showLockedIfNoAccess && !options.isSubcontractor) {
        item.locked = true;
        item.lockReason = 'Available on the Pro plan. Upgrade in Subscription settings.';
        item.badge = 'Pro';
      } else {
        continue;
      }
    }

    if (item.requiresTeamPlan && options.hasTeamSubscription === false) {
      if (item.showLockedIfNoAccess && !options.isSubcontractor) {
        item.locked = true;
        item.lockReason = 'Available on the Team plan. Upgrade in Subscription settings.';
        item.badge = 'Team';
      } else {
        continue;
      }
    }
    
    if (item.requiresTeam && !options.isTeam) {
      if (item.showLockedIfNoAccess && !options.isSubcontractor) {
        item.locked = true;
        item.lockReason = 'Available on the Team plan. Upgrade in Subscription settings.';
        item.badge = 'Team';
      } else {
        continue;
      }
    }
    if (item.requiresOwnerOrManager && !isOwnerOrManager && !permissionUnlock) {
      continue;
    }
    if (item.hideForTradie && isStaffTradie && !permissionUnlock) {
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
  hideForStandaloneSubcontractor?: boolean;
  requiresOwnerOrManager?: boolean;
  requiresProPlan?: boolean;
  requiresTeam?: boolean;
  allowedRoles?: UserRole[];
  requiredPermission?: string | string[];
  // Hard permission gate — see NavItem.strictPermission.
  strictPermission?: boolean;
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
    hideForStandaloneSubcontractor: true,
    title: 'Action Centre', 
    icon: 'crosshair', 
    path: '/more/action-center',
    matchPaths: ['/more/action-center'],
    section: 'main',
    hideForStaff: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
    requiredPermission: ['view_action_center'],
    strictPermission: true,
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
    requiredPermission: ['edit_clients', 'create_clients', 'write_clients'],
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
    requiredPermission: ['view_quotes', 'view_invoices', 'read_quotes', 'read_invoices'],
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
    requiredPermission: ['collect_payments', 'manage_payments'],
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
    requiredPermission: ['read_expenses', 'write_expenses'],
  },
  { 
    id: 'calendar',
    title: 'Schedule', 
    icon: 'calendar', 
    path: '/more/schedule',
    matchPaths: ['/more/schedule'],
    section: 'main',
    allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'],
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
    matchPaths: ['/more/team-operations'],
    section: 'main',
    hideForStaff: true,
    requiresTeam: true,
    requiresOwnerOrManager: true,
    allowedRoles: ['owner', 'manager'],
    requiredPermission: ['view_dispatch', 'assign_jobs', 'manage_team'],
  },
  { 
    id: 'team-management',
    title: 'Team', 
    icon: 'users', 
    path: '/more/team-management',
    matchPaths: ['/more/team-management'],
    section: 'main',
    hideForStaff: true,
    requiresTeam: true,
    requiresOwnerOrManager: true,
    allowedRoles: ['owner', 'manager'],
    requiredPermission: ['manage_team', 'manage_roles'],
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
    hideForStandaloneSubcontractor: true,
    title: 'Insights', 
    icon: 'trending-up', 
    path: '/more/insights',
    matchPaths: ['/more/insights'],
    section: 'main',
    hideForStaff: true,
    requiresOwnerOrManager: true,
    requiresProPlan: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
    requiredPermission: ['view_reports', 'read_reports'],
  },
  { 
    id: 'autopilot',
    hideForStandaloneSubcontractor: true,
    title: 'Autopilot', 
    icon: 'cpu', 
    path: '/more/autopilot',
    matchPaths: ['/more/autopilot'],
    section: 'main',
    hideForStaff: true,
    requiresOwnerOrManager: true,
    requiresProPlan: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
    requiredPermission: ['manage_settings'],
  },
  { 
    id: 'reports',
    hideForStandaloneSubcontractor: true,
    title: 'Reports', 
    icon: 'bar-chart-2', 
    path: '/more/reports',
    matchPaths: ['/more/reports'],
    section: 'main',
    hideForStaff: true,
    requiresOwnerOrManager: true,
    requiresProPlan: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
    requiredPermission: ['view_reports', 'read_reports'],
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
    requiredPermission: ['collect_payments', 'manage_payments'],
  },
  { 
    id: 'templates',
    title: 'Templates', 
    icon: 'file-text', 
    path: '/more/templates-hub',
    matchPaths: ['/more/templates-hub', '/more/templates', '/more/business-templates', '/more/form-builder'],
    section: 'main',
    hideForStaff: false,
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
    requiredPermission: 'manage_catalog',
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
    requiredPermission: ['view_communications', 'read_communications'],
    strictPermission: true,
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
    requiredPermission: ['view_leads', 'read_leads'],
    strictPermission: true,
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
    requiredPermission: ['manage_settings'],
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
    // Additive permission unlock: a custom role granted the item's
    // `requiredPermission` bypasses the role-based gates below (allowedRoles,
    // hideForStandaloneSubcontractor, hideForStaff, requiresOwnerOrManager),
    // matching filterNavItems so tablet/foldable sidebars unlock the same pages
    // as the phone More menu. Subscription/plan gates still apply.
    const permissionUnlock = userHasItemPermission(item, options);

    // Hard permission gate (see filterNavItems): role name alone is never
    // enough. Owners always pass (explicit bypass — their cached permission set
    // isn't always the `*` wildcard).
    if (item.strictPermission && !permissionUnlock && !options.isOwner) {
      return false;
    }

    if (item.allowedRoles && options.userRole && !permissionUnlock) {
      if (!item.allowedRoles.includes(options.userRole)) {
        return false;
      }
    }
    
    if (item.hideForStandaloneSubcontractor && options.isStandaloneSubcontractor && !permissionUnlock) {
      return false;
    }
    
    if (item.hideForStaff && isStaffTradie && !permissionUnlock) {
      return false;
    }

    if (item.requiresProPlan && options.hasProSubscription === false) {
      return false;
    }

    if (item.requiresTeam && (!options.isTeam || options.hasTeamSubscription === false)) {
      return false;
    }
    
    if (item.requiresOwnerOrManager && !isOwnerOrManager && !permissionUnlock) {
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
