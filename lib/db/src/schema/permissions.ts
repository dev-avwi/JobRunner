// Worker Permission Capabilities - granular controls owners can grant to workers
// NOTE: keep this file free of drizzle-orm/zod imports; the web frontend imports it
// directly (via @shared/permissions) to avoid bundling the full schema.
// Worker Permission Capabilities - granular controls owners can grant to workers
export const WORKER_PERMISSIONS = {
  // Payment & Financial
  COLLECT_PAYMENTS: 'collect_payments',      // Record payments, use tap-to-pay
  VIEW_INVOICES: 'view_invoices',            // View invoice details and amounts
  VIEW_QUOTES: 'view_quotes',                // View quote details and pricing
  
  // Document Creation
  CREATE_QUOTES: 'create_quotes',            // Create new quotes
  CREATE_INVOICES: 'create_invoices',        // Create new invoices
  EDIT_DOCUMENTS: 'edit_documents',          // Edit quotes/invoices
  
  // Document Sending
  SEND_QUOTES: 'send_quotes',                // Send quotes via email/SMS
  SEND_INVOICES: 'send_invoices',            // Send invoices via email/SMS
  
  // Client Access
  VIEW_CLIENTS: 'view_clients',              // View full client details (address, phone, email)
  CREATE_CLIENTS: 'create_clients',          // Add new clients
  EDIT_CLIENTS: 'edit_clients',              // Edit client information
  
  // Job Management
  UPDATE_JOB_STATUS: 'update_job_status',    // Change job status (start, complete)
  EDIT_JOBS: 'edit_jobs',                    // Edit job details, notes
  VIEW_ALL_JOBS: 'view_all_jobs',            // View all team jobs (not just assigned)
  REQUEST_JOB_ASSIGNMENT: 'request_job_assignment', // Request to be assigned to available jobs (minimal info, privacy-protected)
  
  // Time & Tracking
  TIME_TRACKING: 'time_tracking',            // Log time entries
  GPS_CHECKIN: 'gps_checkin',                // GPS check-in/out at job sites
  
  // Communication
  TEAM_CHAT: 'team_chat',                    // Access team chat
  CLIENT_SMS: 'client_sms',                  // Send SMS to clients
  VIEW_COMMUNICATIONS: 'view_communications', // View the Communications hub (sent emails + SMS history)

  // Sales & Pipeline
  VIEW_LEADS: 'view_leads',                  // View and manage the Leads pipeline

  // Operations / Workflow
  VIEW_ACTION_CENTER: 'view_action_center',  // View the Action Centre (operational action queue)
  VIEW_DISPATCH: 'view_dispatch',            // View the Dispatch Board / live crew operations

  // AI Receptionist
  MANAGE_AI_RECEPTIONIST: 'manage_ai_receptionist',  // Manage AI receptionist settings
} as const;

export type WorkerPermission = typeof WORKER_PERMISSIONS[keyof typeof WORKER_PERMISSIONS];

// Default permissions for new workers (basic operational capabilities)
export const DEFAULT_WORKER_PERMISSIONS: WorkerPermission[] = [
  WORKER_PERMISSIONS.UPDATE_JOB_STATUS,
  WORKER_PERMISSIONS.TIME_TRACKING,
  WORKER_PERMISSIONS.GPS_CHECKIN,
  WORKER_PERMISSIONS.TEAM_CHAT,
  WORKER_PERMISSIONS.VIEW_CLIENTS,  // Basic client info for job sites
];

// Office Admin permissions - office/admin staff who handle quotes, invoices, and client communication
// EXCLUDES: TIME_TRACKING, GPS_CHECKIN, UPDATE_JOB_STATUS, EDIT_JOBS, REQUEST_JOB_ASSIGNMENT
export const OFFICE_ADMIN_PERMISSIONS: WorkerPermission[] = [
  WORKER_PERMISSIONS.COLLECT_PAYMENTS,
  WORKER_PERMISSIONS.VIEW_INVOICES,
  WORKER_PERMISSIONS.VIEW_QUOTES,
  WORKER_PERMISSIONS.CREATE_QUOTES,
  WORKER_PERMISSIONS.CREATE_INVOICES,
  WORKER_PERMISSIONS.EDIT_DOCUMENTS,
  WORKER_PERMISSIONS.SEND_QUOTES,
  WORKER_PERMISSIONS.SEND_INVOICES,
  WORKER_PERMISSIONS.VIEW_CLIENTS,
  WORKER_PERMISSIONS.CREATE_CLIENTS,
  WORKER_PERMISSIONS.EDIT_CLIENTS,
  WORKER_PERMISSIONS.VIEW_ALL_JOBS,
  WORKER_PERMISSIONS.TEAM_CHAT,
  WORKER_PERMISSIONS.CLIENT_SMS,
  WORKER_PERMISSIONS.VIEW_LEADS,
  WORKER_PERMISSIONS.VIEW_COMMUNICATIONS,
  WORKER_PERMISSIONS.VIEW_ACTION_CENTER,
];

// All available permissions (for owner UI)
export const ALL_WORKER_PERMISSIONS = Object.values(WORKER_PERMISSIONS);

export const ROLE_PRESETS = {
  worker: {
    label: 'Worker',
    description: 'Field worker - updates job status, tracks time, checks in at sites',
    permissions: DEFAULT_WORKER_PERMISSIONS,
  },
  office_admin: {
    label: 'Office Admin',
    description: 'Office staff - manages quotes, invoices, clients, and communications',
    permissions: OFFICE_ADMIN_PERMISSIONS,
  },
  manager: {
    label: 'Manager',
    description: 'Full access - manages team, views reports, assigns jobs',
    permissions: ALL_WORKER_PERMISSIONS,
  },
  subcontractor: {
    label: 'Subcontractor',
    description: 'External sub - only sees assigned jobs, no financial data',
    permissions: [
      WORKER_PERMISSIONS.UPDATE_JOB_STATUS,
      WORKER_PERMISSIONS.TIME_TRACKING,
      WORKER_PERMISSIONS.GPS_CHECKIN,
      WORKER_PERMISSIONS.TEAM_CHAT,
      WORKER_PERMISSIONS.VIEW_CLIENTS,
    ],
  },
} as const;

// Permission categories for organized UI display
export const PERMISSION_CATEGORIES = {
  financial: {
    label: 'Payments & Financial',
    description: 'Access to payment collection and financial documents',
    permissions: [
      WORKER_PERMISSIONS.COLLECT_PAYMENTS,
      WORKER_PERMISSIONS.VIEW_INVOICES,
      WORKER_PERMISSIONS.VIEW_QUOTES,
    ],
  },
  documents: {
    label: 'Document Creation',
    description: 'Create and edit quotes and invoices',
    permissions: [
      WORKER_PERMISSIONS.CREATE_QUOTES,
      WORKER_PERMISSIONS.CREATE_INVOICES,
      WORKER_PERMISSIONS.EDIT_DOCUMENTS,
    ],
  },
  sending: {
    label: 'Document Sending',
    description: 'Send documents to clients via email or SMS',
    permissions: [
      WORKER_PERMISSIONS.SEND_QUOTES,
      WORKER_PERMISSIONS.SEND_INVOICES,
    ],
  },
  clients: {
    label: 'Client Management',
    description: 'Access and manage client information',
    permissions: [
      WORKER_PERMISSIONS.VIEW_CLIENTS,
      WORKER_PERMISSIONS.CREATE_CLIENTS,
      WORKER_PERMISSIONS.EDIT_CLIENTS,
    ],
  },
  jobs: {
    label: 'Job Management',
    description: 'Manage job status and details',
    permissions: [
      WORKER_PERMISSIONS.UPDATE_JOB_STATUS,
      WORKER_PERMISSIONS.EDIT_JOBS,
      WORKER_PERMISSIONS.VIEW_ALL_JOBS,
      WORKER_PERMISSIONS.REQUEST_JOB_ASSIGNMENT,
    ],
  },
  tracking: {
    label: 'Time & Location',
    description: 'Time tracking and GPS check-in',
    permissions: [
      WORKER_PERMISSIONS.TIME_TRACKING,
      WORKER_PERMISSIONS.GPS_CHECKIN,
    ],
  },
  communication: {
    label: 'Communication',
    description: 'Team and client communication',
    permissions: [
      WORKER_PERMISSIONS.TEAM_CHAT,
      WORKER_PERMISSIONS.CLIENT_SMS,
    ],
  },
} as const;

// Human-readable permission labels
export const PERMISSION_LABELS: Record<WorkerPermission, string> = {
  [WORKER_PERMISSIONS.COLLECT_PAYMENTS]: 'Collect Payments',
  [WORKER_PERMISSIONS.VIEW_INVOICES]: 'View Invoices',
  [WORKER_PERMISSIONS.VIEW_QUOTES]: 'View Quotes',
  [WORKER_PERMISSIONS.CREATE_QUOTES]: 'Create Quotes',
  [WORKER_PERMISSIONS.CREATE_INVOICES]: 'Create Invoices',
  [WORKER_PERMISSIONS.EDIT_DOCUMENTS]: 'Edit Documents',
  [WORKER_PERMISSIONS.SEND_QUOTES]: 'Send Quotes',
  [WORKER_PERMISSIONS.SEND_INVOICES]: 'Send Invoices',
  [WORKER_PERMISSIONS.VIEW_CLIENTS]: 'View Client Details',
  [WORKER_PERMISSIONS.CREATE_CLIENTS]: 'Create Clients',
  [WORKER_PERMISSIONS.EDIT_CLIENTS]: 'Edit Clients',
  [WORKER_PERMISSIONS.UPDATE_JOB_STATUS]: 'Update Job Status',
  [WORKER_PERMISSIONS.EDIT_JOBS]: 'Edit Job Details',
  [WORKER_PERMISSIONS.VIEW_ALL_JOBS]: 'View All Team Jobs',
  [WORKER_PERMISSIONS.REQUEST_JOB_ASSIGNMENT]: 'Request Job Assignment',
  [WORKER_PERMISSIONS.TIME_TRACKING]: 'Time Tracking',
  [WORKER_PERMISSIONS.GPS_CHECKIN]: 'GPS Check-in',
  [WORKER_PERMISSIONS.TEAM_CHAT]: 'Team Chat',
  [WORKER_PERMISSIONS.CLIENT_SMS]: 'Send SMS to Clients',
  [WORKER_PERMISSIONS.VIEW_COMMUNICATIONS]: 'View Communications Hub',
  [WORKER_PERMISSIONS.VIEW_LEADS]: 'View Leads',
  [WORKER_PERMISSIONS.VIEW_ACTION_CENTER]: 'View Action Centre',
  [WORKER_PERMISSIONS.VIEW_DISPATCH]: 'View Dispatch Board',
  [WORKER_PERMISSIONS.MANAGE_AI_RECEPTIONIST]: 'Manage AI Receptionist',
};
