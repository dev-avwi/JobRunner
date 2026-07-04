// Frontend permissions configuration
// Mirrors backend server/permissions.ts for consistent access control

export const PERMISSIONS = {
  READ_JOBS: 'read_jobs',
  WRITE_JOBS: 'write_jobs',
  READ_QUOTES: 'read_quotes',
  WRITE_QUOTES: 'write_quotes',
  READ_INVOICES: 'read_invoices',
  WRITE_INVOICES: 'write_invoices',
  READ_CLIENTS: 'read_clients',
  WRITE_CLIENTS: 'write_clients',
  READ_CLIENTS_SENSITIVE: 'read_clients_sensitive',
  MANAGE_TEAM: 'manage_team',
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_PAYMENTS: 'manage_payments',
  READ_REPORTS: 'read_reports',
  MANAGE_TEMPLATES: 'manage_templates',
  READ_TIME_ENTRIES: 'read_time_entries',
  WRITE_TIME_ENTRIES: 'write_time_entries',
  READ_EXPENSES: 'read_expenses',
  WRITE_EXPENSES: 'write_expenses',
  MANAGE_CATALOG: 'manage_catalog',
  VIEW_ALL: 'view_all',
  ASSIGN_JOBS: 'assign_jobs',
  WRITE_JOB_NOTES: 'write_job_notes',
  WRITE_JOB_MEDIA: 'write_job_media',
  MANAGE_AUTOMATIONS: 'manage_automations',
  MANAGE_INTEGRATIONS: 'manage_integrations',
  VIEW_MAP: 'view_map',
  ACCESS_DISPATCH: 'access_dispatch',
  MANAGE_AI_RECEPTIONIST: 'manage_ai_receptionist',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Role types for the UI
export type UserRole = 'owner' | 'solo_owner' | 'manager' | 'office_admin' | 'staff_tradie';

// Page access configuration - which pages each role can access
export interface PagePermission {
  path: string;
  label: string;
  allowedRoles: UserRole[];
  requiredPermissions?: Permission[];
  showInNav?: boolean;
}

// Define page-level access control
export const PAGE_PERMISSIONS: PagePermission[] = [
  // Always accessible
  { path: '/', label: 'Dashboard', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'], showInNav: true },
  { path: '/profile', label: 'Profile', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'], showInNav: false },
  { path: '/my-account', label: 'My Account', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'], showInNav: true },
  
  // Work - unified job view for all roles
  { path: '/work', label: 'Work', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'], showInNav: true },
  
  // Jobs - all roles can see, but staff only sees assigned
  { path: '/jobs', label: 'Jobs', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'], showInNav: true },
  { path: '/jobs/new', label: 'New Job', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },
  { path: '/jobs/:id', label: 'Job Details', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'], showInNav: false },
  { path: '/jobs/:id/edit', label: 'Edit Job', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },
  { path: '/jobs/:id/complete', label: 'Complete Job', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },
  
  // Clients - office admin has full client access
  { path: '/clients', label: 'Clients', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'], showInNav: true },
  { path: '/clients/new', label: 'New Client', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'], showInNav: false },
  { path: '/clients/:id', label: 'Client Details', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'], showInNav: false },
  
  // Documents Hub - office admin handles documents
  { path: '/documents', label: 'Documents', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'], showInNav: true },
  
  // Quotes - office admin can manage quotes
  { path: '/quotes', label: 'Quotes', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'], showInNav: true },
  { path: '/quotes/new', label: 'New Quote', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'], showInNav: false },
  { path: '/quotes/:id', label: 'Quote Details', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'], showInNav: false },
  { path: '/quotes/:id/edit', label: 'Edit Quote', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'], showInNav: false },
  { path: '/quote-editor/:id', label: 'Quote Editor', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'], showInNav: false },
  
  // Invoices - office admin can manage invoices
  { path: '/invoices', label: 'Invoices', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'], showInNav: true },
  { path: '/invoices/new', label: 'New Invoice', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'], showInNav: false },
  { path: '/invoices/:id', label: 'Invoice Details', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'], showInNav: false },
  { path: '/invoices/:id/edit', label: 'Edit Invoice', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'], showInNav: false },
  { path: '/invoice-editor/:id', label: 'Invoice Editor', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'], showInNav: false },
  
  // Receipts - office admin can view receipts
  { path: '/receipts/:id', label: 'Receipt Details', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'], showInNav: false },
  
  // Calendar/Schedule - staff sees only their assigned jobs
  { path: '/calendar', label: 'Calendar', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'], showInNav: true },
  { path: '/schedule', label: 'Schedule', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'], showInNav: true },
  
  // Dispatch - owner/manager only
  { path: '/dispatch', label: 'Dispatch', allowedRoles: ['owner', 'manager'], showInNav: true },
  { path: '/dispatch-board', label: 'Dispatch Board', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },
  
  // Time Tracking - all roles (office admin excluded - no field work)
  { path: '/time-tracking', label: 'Time Tracking', allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'], showInNav: true },
  
  
  // Team Operations - consolidated team management
  // Legacy routes redirect to /team-operations (keep in permissions for RouteGuard to allow access before redirect)
  { path: '/team', label: 'Team', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },
  { path: '/team-dashboard', label: 'Team Hub', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'], showInNav: false },
  { path: '/team/invite', label: 'Invite Team', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },
  { path: '/team-operations', label: 'Team Management', allowedRoles: ['owner', 'manager'], showInNav: true },
  
  // Chat - all roles including solo owners for SMS conversations
  { path: '/chat', label: 'Chat', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'], showInNav: true },
  { path: '/team-chat', label: 'Team Chat', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'], showInNav: false },
  
  // Map - owner/solo_owner/manager + staff (workers see their assigned jobs on the map)
  { path: '/map', label: 'Map', allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'], showInNav: true },
  
  // Reports - owner/manager only
  { path: '/reports', label: 'Reports', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: true },
  { path: '/reports/profitability', label: 'Profitability', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },
  { path: '/reports/payroll', label: 'Payroll', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },
  { path: '/subcontractor-invoices', label: 'Sub Invoices', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },
  
  // Collect Payment - office admin can collect payments
  { path: '/collect-payment', label: 'Collect Payment', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'], showInNav: true },
  
  // Payment Hub - office admin can manage payments
  { path: '/payment-hub', label: 'Payment Hub', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'], showInNav: true },
  { path: '/expenses', label: 'Expenses', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'], showInNav: true },
  
  // Automations - owner only (controls now in Communications Hub)
  { path: '/automations', label: 'Automations', allowedRoles: ['owner', 'solo_owner'], showInNav: false },
  
  // Leads / CRM - owner/solo_owner/manager/office_admin
  { path: '/leads', label: 'Leads', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'], showInNav: true },
  
  // Recurring Jobs - owner/solo_owner/manager
  { path: '/recurring-jobs', label: 'Recurring Jobs', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: true },
  
  // Custom Forms - owner/manager only (redirects to /templates)
  { path: '/custom-forms', label: 'Forms', allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'], showInNav: false },

  // Form/Job Card builder pages (create + edit) - same access as Templates Hub
  { path: '/forms/new', label: 'Form Builder', allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'], showInNav: false },
  { path: '/forms/:id/edit', label: 'Form Builder', allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'], showInNav: false },
  
  // Templates Hub - owner/manager, staff can access for safety forms
  { path: '/templates', label: 'Templates', allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'], showInNav: true },
  
  // Communications Hub - office admin handles communications
  { path: '/communications', label: 'Communications', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin'], showInNav: true },
  
  // Inventory & Equipment (unified page)
  { path: '/inventory', label: 'Inventory & Equipment', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: true },

  // Equipment (redirects to inventory page equipment tab)
  { path: '/equipment', label: 'Equipment', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },

  // Files (Compliance & Licensing) - all roles (content filtered by RBAC on backend)
  { path: '/files', label: 'Files', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'], showInNav: true },
  
  // Integrations - owner only
  { path: '/integrations', label: 'Integrations', allowedRoles: ['owner', 'solo_owner'], showInNav: true },

  // Website Addon - owner only (upsell page handles its own locked/unlocked states)
  { path: '/website', label: 'Website', allowedRoles: ['owner', 'solo_owner'], showInNav: false },
  
  // Settings - owner/solo full, manager limited, staff profile/notifications/appearance only
  { path: '/settings', label: 'Settings', allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'], showInNav: true },
  
  // Billing - owner only
  { path: '/billing', label: 'Billing', allowedRoles: ['owner', 'solo_owner'], showInNav: false },
  { path: '/payouts', label: 'Payouts', allowedRoles: ['owner', 'solo_owner'], showInNav: false },
  { path: '/stripe-connect', label: 'Stripe Connect', allowedRoles: ['owner', 'solo_owner'], showInNav: false },
  
  // Business Intelligence - Action Centre, Insights, Autopilot
  { path: '/action-center', label: 'Action Centre', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: true },
  { path: '/insights', label: 'Insights', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: true },
  { path: '/autopilot', label: 'Autopilot', allowedRoles: ['owner', 'solo_owner'], showInNav: true },

  // More page - all roles
  { path: '/more', label: 'More', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'], showInNav: true },

  // Email Setup - owner/manager (settings-related)
  { path: '/email-setup', label: 'Email Setup', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },

  // Subscription - owner only (billing-related)
  { path: '/subscription', label: 'Subscription', allowedRoles: ['owner', 'solo_owner'], showInNav: false },

  // Audit Log - owner/manager (reporting)
  { path: '/audit-log', label: 'Audit Log', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },

  // Messages redirect - all roles (redirects to /chat)
  { path: '/messages', label: 'Messages', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'], showInNav: false },

  // Calculators - owner/manager (business tools)
  { path: '/calculators', label: 'Calculators', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },

  // Admin pages - platform admin only (handled separately in AppLayout, but listed for completeness)
  { path: '/admin', label: 'Admin', allowedRoles: ['owner'], showInNav: false },
  { path: '/admin/users', label: 'Admin Users', allowedRoles: ['owner'], showInNav: false },
  { path: '/admin/activity', label: 'Admin Activity', allowedRoles: ['owner'], showInNav: false },
  { path: '/admin/health', label: 'Admin Health', allowedRoles: ['owner'], showInNav: false },
  { path: '/admin/settings', label: 'Admin Settings', allowedRoles: ['owner'], showInNav: false },

  // Service Reminders - owner/manager
  { path: '/service-reminders', label: 'Service Reminders', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },

  // WHS Safety - all roles (safety is everyone's responsibility)
  { path: '/whs', label: 'WHS Safety', allowedRoles: ['owner', 'solo_owner', 'manager', 'office_admin', 'staff_tradie'], showInNav: false },

  // Rebates - owner/manager
  { path: '/rebates', label: 'Rebates', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },

  // Team Groups - owner/manager
  { path: '/team-groups', label: 'Team Groups', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },

  // AI Visualization - owner/manager
  { path: '/ai-visualization', label: 'AI Visualization', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },

  // AI Receptionist - owner/solo_owner/office_admin full access, manager partial, staff_tradie self-availability only
  { path: '/ai-receptionist', label: 'AI Receptionist', allowedRoles: ['owner', 'solo_owner', 'office_admin', 'manager', 'staff_tradie'], showInNav: false },
  { path: '/ai-receptionist/calls', label: 'AI Receptionist Calls', allowedRoles: ['owner', 'solo_owner', 'office_admin', 'manager'], showInNav: false },
];

// Check if a role can access a specific path
export function canAccessPath(role: UserRole, path: string): boolean {
  // Normalize path - remove trailing slashes BUT preserve root path "/"
  let normalizedPath = path.replace(/\/$/, '');
  if (normalizedPath === '') {
    normalizedPath = '/';
  }
  
  // Find matching permission entry
  const permission = PAGE_PERMISSIONS.find(p => {
    // Handle exact match
    if (p.path === normalizedPath) return true;
    
    // Handle dynamic routes like /jobs/:id
    const pattern = p.path.replace(/:[^/]+/g, '[^/]+');
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(normalizedPath);
  });
  
  // If no permission defined, deny access by default
  if (!permission) {
    // Allow public routes
    if (['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/verify-email-pending', '/onboarding', '/privacy', '/terms', '/accept-invite', '/accept-assignment', '/invite', '/open-app', '/portal', '/q/', '/i/', '/r/', '/p/', '/s/', '/pay/', '/job-portal', '/track/', '/receipt/', '/landing', '/auth'].some(p => normalizedPath.startsWith(p))) {
      return true;
    }
    return false;
  }
  
  return permission.allowedRoles.includes(role);
}

// Get navigation items filtered by role
export function getNavItemsForRole(role: UserRole, isTeam: boolean): PagePermission[] {
  return PAGE_PERMISSIONS.filter(p => {
    if (!p.showInNav) return false;
    if (!p.allowedRoles.includes(role)) return false;
    
    // Hide team-specific items for solo users (but keep /team for upgrading)
    if (!isTeam && ['/chat', '/map', '/dispatch'].includes(p.path)) {
      return false;
    }
    
    return true;
  });
}

// Action permissions - what actions each role can perform
export interface ActionPermissions {
  canCreateJobs: boolean;
  canEditJobs: boolean;
  canDeleteJobs: boolean;
  canAssignJobs: boolean;
  canCreateClients: boolean;
  canEditClients: boolean;
  canDeleteClients: boolean;
  canCreateQuotes: boolean;
  canEditQuotes: boolean;
  canDeleteQuotes: boolean;
  canSendQuotes: boolean;
  canCreateInvoices: boolean;
  canEditInvoices: boolean;
  canDeleteInvoices: boolean;
  canSendInvoices: boolean;
  canManageTeam: boolean;
  canInviteTeam: boolean;
  canRemoveTeam: boolean;
  canManageSettings: boolean;
  canManageBilling: boolean;
  canManageTemplates: boolean;
  canManageAutomations: boolean;
  canManageIntegrations: boolean;
  canViewAllJobs: boolean;
  canViewReports: boolean;
  canViewMap: boolean;
  canUseDispatch: boolean;
}

// Get action permissions for a role
export function getActionPermissions(role: UserRole): ActionPermissions {
  switch (role) {
    case 'owner':
    case 'solo_owner':
      return {
        canCreateJobs: true,
        canEditJobs: true,
        canDeleteJobs: true,
        canAssignJobs: true,
        canCreateClients: true,
        canEditClients: true,
        canDeleteClients: true,
        canCreateQuotes: true,
        canEditQuotes: true,
        canDeleteQuotes: true,
        canSendQuotes: true,
        canCreateInvoices: true,
        canEditInvoices: true,
        canDeleteInvoices: true,
        canSendInvoices: true,
        canManageTeam: true,
        canInviteTeam: true,
        canRemoveTeam: true,
        canManageSettings: true,
        canManageBilling: true,
        canManageTemplates: true,
        canManageAutomations: true,
        canManageIntegrations: true,
        canViewAllJobs: true,
        canViewReports: true,
        canViewMap: true,
        canUseDispatch: true,
      };
      
    case 'manager':
      return {
        canCreateJobs: true,
        canEditJobs: true,
        canDeleteJobs: false,
        canAssignJobs: true,
        canCreateClients: true,
        canEditClients: true,
        canDeleteClients: false,
        canCreateQuotes: true,
        canEditQuotes: true,
        canDeleteQuotes: false,
        canSendQuotes: true,
        canCreateInvoices: true,
        canEditInvoices: true,
        canDeleteInvoices: false,
        canSendInvoices: true,
        canManageTeam: true,
        canInviteTeam: true,
        canRemoveTeam: false,
        canManageSettings: false,
        canManageBilling: false,
        canManageTemplates: false,
        canManageAutomations: false,
        canManageIntegrations: false,
        canViewAllJobs: true,
        canViewReports: true,
        canViewMap: true,
        canUseDispatch: true,
      };
      
    case 'office_admin':
      return {
        canCreateJobs: false,
        canEditJobs: false,
        canDeleteJobs: false,
        canAssignJobs: false,
        canCreateClients: true,
        canEditClients: true,
        canDeleteClients: false,
        canCreateQuotes: true,
        canEditQuotes: true,
        canDeleteQuotes: false,
        canSendQuotes: true,
        canCreateInvoices: true,
        canEditInvoices: true,
        canDeleteInvoices: false,
        canSendInvoices: true,
        canManageTeam: false,
        canInviteTeam: false,
        canRemoveTeam: false,
        canManageSettings: false,
        canManageBilling: false,
        canManageTemplates: false,
        canManageAutomations: false,
        canManageIntegrations: false,
        canViewAllJobs: true,
        canViewReports: false,
        canViewMap: false,
        canUseDispatch: false,
      };

    case 'staff_tradie':
      return {
        canCreateJobs: false,
        canEditJobs: false,
        canDeleteJobs: false,
        canAssignJobs: false,
        canCreateClients: false,
        canEditClients: false,
        canDeleteClients: false,
        canCreateQuotes: false,
        canEditQuotes: false,
        canDeleteQuotes: false,
        canSendQuotes: false,
        canCreateInvoices: false,
        canEditInvoices: false,
        canDeleteInvoices: false,
        canSendInvoices: false,
        canManageTeam: false,
        canInviteTeam: false,
        canRemoveTeam: false,
        canManageSettings: false,
        canManageBilling: false,
        canManageTemplates: false,
        canManageAutomations: false,
        canManageIntegrations: false,
        canViewAllJobs: false,
        canViewReports: false,
        canViewMap: true,
        canUseDispatch: false,
      };
      
    default:
      // Default to staff permissions for safety
      return getActionPermissions('staff_tradie');
  }
}
