import * as Sentry from "@sentry/react";
import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { RefreshCw, WifiOff, X } from "lucide-react";
import { Switch, Route, useLocation, Redirect, Router as WouterRouter } from "wouter";
import { queryClient, clearSessionToken, getSessionToken, apiRequest } from "./lib/queryClient";
import { clearChatHistory } from "@/lib/helpChatStorage";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { NetworkProvider } from "@/contexts/NetworkContext";
import OfflineIndicator from "@/components/OfflineIndicator";
import AuthFlow from "@/components/AuthFlow";
import SimpleOnboarding from "@/components/SimpleOnboarding";
import { useRealtimeUpdates } from "@/hooks/use-realtime-updates";
import { JobCollaborationProvider, JobCollaborationCtxRaw } from "@/contexts/JobCollaborationContext";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import DemoModeBanner from "@/components/DemoModeBanner";
import { ThemeProvider, useTheme } from "@/components/ThemeProvider";

import AppSidebar from "@/components/AppSidebar";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import FloatingAIChat from "@/components/FloatingAIChat";
import PaymentToastProvider from "@/components/PaymentToastProvider";
import CelebrationOverlay from "@/components/CelebrationOverlay";
import RouteGuard from "@/components/RouteGuard";
import FeatureGate from "@/components/FeatureGate";
import ErrorBoundary, { PageErrorBoundary, ChunkErrorBoundary } from "@/components/ErrorBoundary";
import { lazyWithReload } from "@/lib/lazyWithReload";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { useFeatureAccess } from "@/hooks/use-subscription";
import GuidedTour, { useGuidedTour } from "@/components/GuidedTour";
import { useAppMode } from "@/hooks/use-app-mode";
import { useUserRole } from "@/hooks/use-user-role";
import { KeyboardShortcutsDialog, useKeyboardShortcuts } from "@/components/KeyboardShortcuts";
import WhatYouMissedModal from "@/components/WhatYouMissedModal";
import FeedbackTab from "@/components/FeedbackTab";
import AdminAppShell from "@/components/AdminAppShell";

const Dashboard = lazyWithReload(() => import("@/components/Dashboard"));
const JobsList = lazyWithReload(() => import("@/components/JobsList"));
const ClientsList = lazyWithReload(() => import("@/components/ClientsList"));
const QuotesList = lazyWithReload(() => import("@/components/QuotesList"));
const QuoteForm = lazyWithReload(() => import("@/components/QuoteForm"));
const QuoteDetailView = lazyWithReload(() => import("@/components/QuoteDetailView"));
const JobForm = lazyWithReload(() => import("@/components/JobForm"));
const JobEditForm = lazyWithReload(() => import("@/components/JobEditForm"));
const InvoiceForm = lazyWithReload(() => import("@/components/InvoiceForm"));
const DocumentEditor = lazyWithReload(() => import("@/components/DocumentEditor"));
const LiveQuoteEditor = lazyWithReload(() => import("@/components/LiveQuoteEditor"));
const FormBuilder = lazyWithReload(() => import("@/components/CustomFormBuilder").then(m => ({ default: m.FormBuilder })));
const LiveInvoiceEditor = lazyWithReload(() => import("@/components/LiveInvoiceEditor"));
const ClientForm = lazyWithReload(() => import("@/components/ClientForm"));
const InvoiceDetailView = lazyWithReload(() => import("@/components/InvoiceDetailView"));
const ReceiptDetailView = lazyWithReload(() => import("@/components/ReceiptDetailView"));
const ClientDetailView = lazyWithReload(() => import("@/components/ClientDetailView"));
const JobDetailView = lazyWithReload(() => import("@/components/JobDetailView"));
const JobCompletion = lazyWithReload(() => import("@/components/JobCompletion"));
const InvoicesList = lazyWithReload(() => import("@/components/InvoicesList"));
const CalendarView = lazyWithReload(() => import("@/components/CalendarView"));
const Settings = lazyWithReload(() => import("@/components/Settings"));
const EmailSetupGuide = lazyWithReload(() => import("@/components/EmailSetupGuide"));
const QuoteModal = lazyWithReload(() => import("@/components/QuoteModal"));
const InvoiceModal = lazyWithReload(() => import("@/components/InvoiceModal"));

const More = lazyWithReload(() => import("@/pages/More"));
const Integrations = lazyWithReload(() => import("@/pages/Integrations"));
const BringYourBusiness = lazyWithReload(() => import("@/pages/BringYourBusiness"));
const ActionCenter = lazyWithReload(() => import("@/pages/ActionCenter"));
const Insights = lazyWithReload(() => import("@/pages/Insights"));
const Autopilot = lazyWithReload(() => import("@/pages/Autopilot"));
const NotFound = lazyWithReload(() => import("@/pages/not-found"));
const VerifyEmail = lazyWithReload(() => import("@/pages/VerifyEmail"));
const AuthHandoff = lazyWithReload(() => import("@/pages/AuthHandoff"));
const VerifyEmailPending = lazyWithReload(() => import("@/pages/VerifyEmailPending"));
const ResetPassword = lazyWithReload(() => import("@/pages/ResetPassword"));
const AcceptInvite = lazyWithReload(() => import("@/pages/AcceptInvite"));
const AcceptAssignment = lazyWithReload(() => import("@/pages/AcceptAssignment"));
const JobInvite = lazyWithReload(() => import("@/pages/JobInvite"));
const OpenApp = lazyWithReload(() => import("@/pages/OpenApp"));
const TimeTrackingPage = lazyWithReload(() => import("@/pages/TimeTracking"));
const TeamOperations = lazyWithReload(() => import("@/pages/TeamOperations"));
const Team = lazyWithReload(() => import("@/pages/Team"));
const StaffLicences = lazyWithReload(() => import("@/pages/StaffLicences"));
const LeaveManagement = lazyWithReload(() => import("@/pages/LeaveManagement"));
const MagicLinkLanding = lazyWithReload(() => import("@/pages/MagicLinkLanding"));
const PaymentPage = lazyWithReload(() => import("@/pages/PaymentPage"));
const PrivacyPolicy = lazyWithReload(() => import("@/pages/PrivacyPolicy"));
const TermsOfService = lazyWithReload(() => import("@/pages/TermsOfService"));
const DeleteAccount = lazyWithReload(() => import("@/pages/DeleteAccount"));
const Support = lazyWithReload(() => import("@/pages/Support"));
const TrackArrival = lazyWithReload(() => import("@/pages/TrackArrival"));
const BookingPage = lazyWithReload(() => import("@/pages/BookingPage"));
const Reports = lazyWithReload(() => import("@/pages/Reports"));
const Calculators = lazyWithReload(() => import("@/pages/Calculators"));
const CollectPayment = lazyWithReload(() => import("@/pages/CollectPayment"));
const TeamChatPage = lazyWithReload(() => import("@/pages/TeamChat"));
const ChatHub = lazyWithReload(() => import("@/pages/ChatHub"));
const JobMapPage = lazyWithReload(() => import("@/pages/JobMap"));
const DirectMessagesPage = lazyWithReload(() => import("@/pages/DirectMessages"));
const DispatchBoard = lazyWithReload(() => import("@/pages/DispatchBoard"));
const SchedulePage = lazyWithReload(() => import("@/pages/SchedulePage"));
const AdvancedDispatch = lazyWithReload(() => import("@/pages/AdvancedDispatch"));
const Automations = lazyWithReload(() => import("@/pages/Automations"));
const RecurringJobs = lazyWithReload(() => import("@/pages/RecurringJobs"));
const ServiceRemindersPage = lazyWithReload(() => import("@/pages/ServiceReminders"));
const InventoryPage = lazyWithReload(() => import("@/pages/InventoryPage"));
const RebatesPage = lazyWithReload(() => import("@/pages/Rebates"));
const Leads = lazyWithReload(() => import("@/pages/Leads"));
const AIVisualizationPage = lazyWithReload(() => import("@/pages/AIVisualization"));
const PayrollReports = lazyWithReload(() => import("@/pages/PayrollReports"));
const ClientPortal = lazyWithReload(() => import("@/pages/ClientPortal"));
const ClientPortalHub = lazyWithReload(() => import("@/pages/ClientPortalHub"));
const JobPortal = lazyWithReload(() => import("@/pages/JobPortal"));
const PaymentHub = lazyWithReload(() => import("@/pages/PaymentHub"));
const ExpensesPage = lazyWithReload(() => import("@/pages/ExpensesPage"));
const WorkPage = lazyWithReload(() => import("@/pages/WorkPage"));
const AdminDashboard = lazyWithReload(() => import("@/pages/AdminDashboard"));
const HelpCenter = lazyWithReload(() => import("@/pages/HelpCenter"));

// Shared admin sub-paths, rendered in both the main tradie Router (so
// /admin/* doesn't fall through to NotFound — AdminDashboard handles 403s)
// and the AdminAppShell switch (the only shell platform admins ever see).
// Returns an array (not a wrapping component) because wouter's <Switch>
// only flattens through React.Fragment when matching Route children.
const ADMIN_SUB_PATHS = ["/admin", "/admin/comms", "/admin/revenue", "/admin/users", "/admin/kanban", "/admin/ai-queue", "/admin/call-monitor", "/admin/porting", "/admin/activity", "/admin/health", "/admin/settings"] as const;
const renderAdminRoutes = () => ADMIN_SUB_PATHS.map((path) => (
  <Route key={path} path={path} component={AdminDashboard} />
));
const LandingPage = lazyWithReload(() => import("@/pages/LandingPage"));
const DemoPage = lazyWithReload(() => import("@/pages/Demo"));
const SubscriptionPage = lazyWithReload(() => import("@/pages/SubscriptionPage"));
const TemplatesHub = lazyWithReload(() => import("@/pages/TemplatesHub"));
const DocumentsHub = lazyWithReload(() => import("@/pages/DocumentsHub"));
const WhsHubPage = lazyWithReload(() => import("@/pages/WhsHub"));
const CommunicationsHub = lazyWithReload(() => import("@/pages/CommunicationsHub"));
const TimeEditAuditLog = lazyWithReload(() => import("@/pages/TimeEditAuditLog"));
const ProfitabilityReport = lazyWithReload(() => import("@/pages/ProfitabilityReport"));
const SubcontractorWebView = lazyWithReload(() => import("@/pages/SubcontractorWebView"));
const MyInvoices = lazyWithReload(() => import("@/pages/MyInvoices"));
const SubcontractorDashboardPage = lazyWithReload(() => import("@/pages/SubcontractorDashboard"));
const FilesPage = lazyWithReload(() => import("@/pages/Files"));
const AIReceptionist = lazyWithReload(() => import("@/pages/AIReceptionist"));
const AIReceptionistCalls = lazyWithReload(() => import("@/pages/AIReceptionistCalls"));
const WebsiteAddonPage = lazyWithReload(() => import("@/pages/WebsiteAddon"));

function BusinessPicker({ userId }: { userId: string }) {
  const { data: businessData } = useQuery<{
    businesses?: Array<{
      businessOwnerId: string;
      businessName: string;
      roleName?: string;
      pendingJobCount?: number;
    }>;
    activeBusinessId?: string;
  }>({
    queryKey: ['/api/auth/my-businesses'],
    enabled: !!userId,
  });
  
  const [isOpen, setIsOpen] = useState(false);
  
  if (!businessData?.businesses || businessData.businesses.length <= 1) {
    return null;
  }
  
  const currentBusiness = businessData.businesses.find(
    (b: any) => b.businessOwnerId === businessData.activeBusinessId
  ) || businessData.businesses[0];
  
  const handleSwitch = async (businessId: string) => {
    try {
      await apiRequest('POST', '/api/auth/switch-business', { businessId });
      queryClient.clear();
      window.location.reload();
    } catch (err) {
      console.error('Failed to switch business:', err);
    }
    setIsOpen(false);
  };
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-border bg-background hover-elevate"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/></svg>
        <span className="max-w-[140px] truncate">{currentBusiness?.businessName}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-md border border-border bg-popover shadow-md">
            <div className="p-1">
              {businessData.businesses.map((b: any) => (
                <button
                  key={b.businessOwnerId}
                  onClick={() => handleSwitch(b.businessOwnerId)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover-elevate ${
                    b.businessOwnerId === businessData.activeBusinessId ? 'bg-accent text-accent-foreground' : ''
                  }`}
                >
                  <div className="flex-1 text-left">
                    <div className="font-medium truncate">{b.businessName}</div>
                    <div className="text-xs text-muted-foreground">{b.roleName}</div>
                  </div>
                  {b.pendingJobCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-semibold rounded-full bg-primary text-primary-foreground">
                      {b.pendingJobCount}
                    </span>
                  )}
                  {b.businessOwnerId === businessData.activeBusinessId && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TrialBanner({ trialEndsAt, onUpgrade }: { trialEndsAt: string; onUpgrade: () => void }) {
  const trialEnd = new Date(trialEndsAt);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  
  if (daysRemaining <= 0) return null;
  
  const urgentClass = daysRemaining <= 2 ? 'bg-destructive/10 border-destructive/20 text-destructive' : 'bg-primary/5 border-primary/10 text-primary';
  
  return (
    <div className={`flex items-center justify-between gap-2 px-4 py-1.5 text-sm border-b ${urgentClass}`}>
      <span className="font-medium">
        Free trial: {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
      </span>
      <button 
        onClick={onUpgrade}
        className="text-xs font-semibold underline underline-offset-2 hover:no-underline"
      >
        Upgrade Now
      </button>
    </div>
  );
}

function PaymentOverdueBanner({ onResolve }: { onResolve: () => void }) {
  const { data: usage } = useQuery<{ subscriptionStatus?: string; subscriptionTier?: string }>({
    queryKey: ['/api/subscription/usage'],
  });

  if (!usage?.subscriptionStatus) return null;

  if (usage.subscriptionStatus === 'paused') {
    return (
      <div className="flex items-center justify-between gap-2 px-4 py-2 text-sm border-b bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400">
        <span className="font-medium">
          Your subscription is paused. You're on the free plan until you resume.
        </span>
        <button 
          onClick={onResolve}
          className="text-xs font-semibold underline underline-offset-2 hover:no-underline whitespace-nowrap"
        >
          Resume Subscription
        </button>
      </div>
    );
  }

  if (usage.subscriptionStatus !== 'past_due') return null;

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2 text-sm border-b bg-destructive/10 border-destructive/20 text-destructive">
      <span className="font-medium">
        Your subscription payment has failed. Features are restricted until payment is resolved.
      </span>
      <button 
        onClick={onResolve}
        className="text-xs font-semibold underline underline-offset-2 hover:no-underline whitespace-nowrap"
      >
        Update Payment
      </button>
    </div>
  );
}

// Types for job completion
interface JobPhoto {
  url: string;
  description?: string;
  uploadedAt: string;
}

interface JobData {
  id: string;
  title: string;
  description?: string;
  clientId?: string;
  address?: string;
  scheduledAt?: string;
  status: 'pending' | 'in_progress' | 'done';
  photos?: JobPhoto[];
}

interface ClientData {
  id: string;
  name: string;
}

// Redirect from the retired /dispatch-board route to the unified /dispatch page,
// preserving any query parameters (e.g. ?date=YYYY-MM-DD) so deep links still work.
function DispatchBoardRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const search = window.location.search;
    setLocation("/dispatch" + search, { replace: true } as any);
  }, [setLocation]);
  return null;
}

// Short URL redirects for quote/invoice links sent via email/SMS
function QuoteShortRedirect({ token }: { token: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (token) {
      setLocation(`/portal/quote/${token}`);
    }
  }, [token, setLocation]);
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading your quote...</p>
      </div>
    </div>
  );
}

function InvoiceShortRedirect({ token }: { token: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (token) {
      setLocation(`/portal/invoice/${token}`);
    }
  }, [token, setLocation]);
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading your invoice...</p>
      </div>
    </div>
  );
}

// Public Receipt Redirect - redirects to PDF download for SMS links
function PublicReceiptRedirect({ token }: { token: string }) {
  useEffect(() => {
    if (token) {
      window.location.href = `/api/public/receipt/${token}/pdf`;
    }
  }, [token]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center" data-testid="public-receipt-redirect">
      <div className="text-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">Downloading your receipt...</p>
      </div>
    </div>
  );
}

// Stable Settings wrapper - prevents remounting on parent re-renders
function SettingsWrapper() {
  return (
    <Settings 
      onSave={(data) => console.log('Settings saved:', data)}
      onUploadLogo={(file) => console.log('Logo uploaded:', file.name)}
      onUpgradePlan={() => console.log('Upgrade plan')}
    />
  );
}

// Job Completion Wrapper with real data fetching
function JobCompletionWrapper({ jobId, onComplete, onCancel }: {
  jobId: string;
  onComplete: (jobId: string) => void;
  onCancel: () => void;
}) {
  const { data: job, isLoading: jobLoading, error: jobError } = useQuery<JobData>({
    queryKey: [`/api/jobs`, jobId],
  });

  const { data: client, isLoading: clientLoading } = useQuery<ClientData>({
    queryKey: [`/api/clients`, job?.clientId],
    enabled: !!job?.clientId,
  });

  const isLoading = jobLoading || clientLoading;
  const error = jobError;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to load job details</p>
          <button 
            onClick={onCancel}
            className="text-primary hover:underline"
            data-testid="button-back-to-jobs"
          >
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  return (
    <JobCompletion 
      job={{
        id: job.id,
        title: job.title,
        description: job.description || '',
        clientName: client?.name || 'Unknown Client',
        address: job.address || '',
        scheduledAt: job.scheduledAt,
        status: job.status,
        photos: job.photos || []
      }}
      onComplete={onComplete}
      onCancel={onCancel}
    />
  );
}

// Stable wrapper components to prevent remounting when Router re-renders
// Using memo to ensure stable component identity
const LiveQuoteEditorWrapper = React.memo(({ 
  onSave, 
  onCancel 
}: { 
  onSave: (quoteId: string) => void;
  onCancel: () => void;
}) => (
  <LiveQuoteEditor onSave={onSave} onCancel={onCancel} />
));

const LiveInvoiceEditorWrapper = React.memo(({ 
  onSave, 
  onCancel 
}: { 
  onSave: (invoiceId: string) => void;
  onCancel: () => void;
}) => (
  <LiveInvoiceEditor onSave={onSave} onCancel={onCancel} />
));

const JobFormWrapper = React.memo(({ 
  onSubmit, 
  onCancel 
}: { 
  onSubmit: (jobId: string) => void;
  onCancel: () => void;
}) => (
  <JobForm onSubmit={onSubmit} onCancel={onCancel} />
));

// Main router component
function Router({ 
  onNavigate, 
  onShowQuoteModal, 
  onShowInvoiceModal 
}: { 
  onNavigate: (path: string) => void;
  onShowQuoteModal: (quoteId: string) => void;
  onShowInvoiceModal: (invoiceId: string) => void;
}) {
  const [location] = useLocation();
  const { isSubcontractor, isLoading: roleLoading } = useUserRole();
  
  // Stable callbacks for quote/invoice editors using useCallback
  const handleQuoteSave = useCallback((quoteId: string) => {
    onShowQuoteModal(quoteId);
  }, [onShowQuoteModal]);
  
  const handleQuoteCancel = useCallback(() => {
    onNavigate('/quotes');
  }, [onNavigate]);
  
  const handleInvoiceSave = useCallback((invoiceId: string) => {
    onShowInvoiceModal(invoiceId);
  }, [onShowInvoiceModal]);
  
  const handleInvoiceCancel = useCallback(() => {
    onNavigate('/invoices');
  }, [onNavigate]);
  
  const handleJobSubmit = useCallback((jobId: string) => {
    onNavigate(`/jobs/${jobId}`);
  }, [onNavigate]);
  
  const handleJobCancel = useCallback(() => {
    if (window.history.length > 2) {
      window.history.back();
    } else {
      onNavigate('/jobs');
    }
  }, [onNavigate]);

  return (
    <ChunkErrorBoundary>
    <Suspense fallback={
      <div className="w-full px-6 lg:px-8 py-6 space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-48 bg-muted rounded-md" />
            <div className="h-4 w-64 bg-muted rounded-md" />
          </div>
          <div className="h-9 w-28 bg-muted rounded-md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border bg-card p-5 space-y-3">
              <div className="h-4 w-24 bg-muted rounded-md" />
              <div className="h-8 w-32 bg-muted rounded-md" />
              <div className="h-3 w-40 bg-muted rounded-md" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <div className="h-5 w-36 bg-muted rounded-md" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-10 w-10 bg-muted rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 bg-muted rounded-md" />
                  <div className="h-3 w-56 bg-muted rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    }>
      <Switch location={location}>
      {/* Public demo entry (also reachable when already signed in - swaps to demo session) */}
      <Route path="/demo" component={() => <DemoPage />} />

      {/* Work page - unified job workflow view */}
      <Route path="/work" component={() => (
        <WorkPage 
          onViewJob={(id) => onNavigate(`/jobs/${id}`)}
          onCreateJob={() => onNavigate('/jobs/new')}
          onShowQuoteModal={onShowQuoteModal}
          onShowInvoiceModal={onShowInvoiceModal}
        />
      )} />
      
      {/* IMPORTANT: /jobs/new must come BEFORE /jobs/:id to prevent "new" matching as an ID */}
      <Route path="/jobs/new">
        <JobFormWrapper 
          onSubmit={handleJobSubmit}
          onCancel={handleJobCancel}
        />
      </Route>
      
      <Route path="/jobs/:id/complete" component={({ params }: any) => (
        <JobCompletionWrapper 
          jobId={params.id}
          onComplete={(jobId) => {
            // After completion, go back to the job details
            onNavigate(`/jobs/${jobId}`);
          }}
          onCancel={() => {
            // Smart back: use browser history if available
            if (window.history.length > 2) {
              window.history.back();
            } else {
              onNavigate(`/jobs/${params.id}`);
            }
          }}
        />
      )} />
      
      <Route path="/jobs/:id/edit" component={({ params }: any) => (
        <JobEditForm
          jobId={params.id}
          onSave={(jobId) => {
            // After saving, go back to the job details
            onNavigate(`/jobs/${jobId}`);
          }}
          onCancel={() => {
            // Smart back: use browser history if available
            if (window.history.length > 2) {
              window.history.back();
            } else {
              onNavigate(`/jobs/${params.id}`);
            }
          }}
        />
      )} />
      
      <Route path="/jobs/:id" component={({ params }: any) => (
        <JobDetailView
          jobId={params.id}
          onBack={() => {
            // Smart back: use browser history if available, otherwise fallback
            if (window.history.length > 2) {
              window.history.back();
            } else {
              onNavigate('/jobs');
            }
          }}
          onEditJob={(id) => onNavigate(`/jobs/${id}/edit`)}
          onCompleteJob={(id) => onNavigate(`/jobs/${id}/complete`)}
          onCreateQuote={(id) => onNavigate(`/quotes/new?jobId=${id}`)}
          onCreateInvoice={(id) => onNavigate(`/invoices/new?jobId=${id}`)}
          onViewClient={(clientId) => onNavigate(`/clients/${clientId}`)}
        />
      )} />
      
      {/* Catch-all redirect for /jobs to /work (MUST come AFTER more specific job routes) */}
      <Route path="/jobs">
        <Redirect to="/work" />
      </Route>
      
      {/* IMPORTANT: /clients/new must come BEFORE /clients to prevent list matching */}
      <Route path="/clients/new" component={() => (
        <ClientForm 
          onSubmit={(clientId) => {
            onNavigate(`/clients/${clientId}`);
          }}
          onCancel={() => onNavigate('/clients')}
        />
      )} />
      
      <Route path="/clients/:id" component={({ params }: { params: { id: string } }) => (
        <ClientDetailView 
          clientId={params.id}
          onBack={() => {
            // Smart back: use browser history if available, otherwise fallback
            if (window.history.length > 2) {
              window.history.back();
            } else {
              onNavigate('/clients');
            }
          }}
          onCreateJob={(clientId) => onNavigate(`/jobs/new?clientId=${clientId}`)}
          onCreateQuote={(clientId) => onNavigate(`/quotes/new?clientId=${clientId}`)}
          onViewJob={(jobId) => onNavigate(`/jobs/${jobId}`)}
        />
      )} />
      
      <Route path="/clients" component={() => (
        <ClientsList 
          onCreateClient={() => onNavigate('/clients/new')}
          onViewClient={(id) => onNavigate(`/clients/${id}`)}
          onCreateJobForClient={(id) => onNavigate(`/jobs/new?clientId=${id}`)}
          onCallClient={(phone) => window.open(`tel:${phone}`)}
          onEmailClient={(email) => window.open(`mailto:${email}`)}
          onSmsClient={(clientId, phone) => onNavigate(`/chat?smsClientId=${clientId}&phone=${encodeURIComponent(phone)}`)}
        />
      )} />
      
      <Route path="/documents" component={() => (
        <DocumentsHub onNavigate={onNavigate} />
      )} />

      {/* Inline form builder (SWMS / safety forms) — full page with live preview */}
      <Route path="/forms/new">
        <FormBuilder onBack={() => onNavigate('/templates?tab=forms')} />
      </Route>
      <Route path="/forms/:id/edit" component={({ params }: { params: { id: string } }) => (
        <FormBuilder
          formId={params.id}
          onBack={() => onNavigate('/templates?tab=forms')}
        />
      )} />
      
      {/* IMPORTANT: /quotes/new must come BEFORE /quotes redirect to prevent redirect from matching */}
      {/* Using stable wrapper component to prevent remounting when Router re-renders */}
      <Route path="/quotes/new">
        <LiveQuoteEditorWrapper 
          onSave={handleQuoteSave}
          onCancel={handleQuoteCancel}
        />
      </Route>
      
      <Route path="/quotes/:id/edit" component={({ params }: { params: { id: string } }) => (
        <LiveQuoteEditor 
          quoteId={params.id}
          onSave={(quoteId) => onNavigate(`/quotes/${quoteId}`)}
          onCancel={() => onNavigate(`/quotes/${params.id}`)}
        />
      )} />

      <Route path="/quotes/:id" component={({ params }: { params: { id: string } }) => (
        <QuoteDetailView quoteId={params.id} />
      )} />
      
      {/* Redirect /quotes to Documents Hub after more specific routes */}
      <Route path="/quotes">
        <Redirect to="/documents?tab=quotes" />
      </Route>
      
      {/* IMPORTANT: /invoices/new must come BEFORE /invoices redirect to prevent redirect from matching */}
      {/* Using stable wrapper component to prevent remounting when Router re-renders */}
      <Route path="/invoices/new">
        <LiveInvoiceEditorWrapper 
          onSave={handleInvoiceSave}
          onCancel={handleInvoiceCancel}
        />
      </Route>

      <Route path="/invoices/:id/edit" component={({ params }: { params: { id: string } }) => (
        <LiveInvoiceEditor 
          invoiceId={params.id}
          onSave={(invoiceId) => onNavigate(`/invoices/${invoiceId}`)}
          onCancel={() => onNavigate(`/invoices/${params.id}`)}
        />
      )} />
      
      <Route path="/invoices/:id" component={({ params }: { params: { id: string } }) => (
        <InvoiceDetailView invoiceId={params.id} />
      )} />
      
      {/* Redirect /invoices to Documents Hub after more specific routes */}
      <Route path="/invoices">
        <Redirect to="/documents?tab=invoices" />
      </Route>
      
      <Route path="/receipts/:id" component={({ params }: { params: { id: string } }) => (
        <ReceiptDetailView receiptId={params.id} onBack={() => window.history.back()} />
      )} />
      
      <Route path="/schedule" component={() => (
        <SchedulePage 
          onCreateJob={() => onNavigate('/jobs/new')}
          onViewJob={(id) => onNavigate(`/jobs/${id}`)}
        />
      )} />

      <Route path="/calendar">
        <Redirect to="/schedule" />
      </Route>

      {/* /dispatch-board is retired; preserve ?date= and other query params so
          bookmarks / deep links open the correct day in AdvancedDispatch */}
      <Route path="/dispatch-board">
        <DispatchBoardRedirect />
      </Route>

      <Route path="/dispatch" component={() => (
        <FeatureGate requiredTier="team" featureName="Dispatch" description="Advanced dispatch board combining workers, equipment, and materials in one view.">
          <AdvancedDispatch />
        </FeatureGate>
      )} />
      
      {/* Templates route removed - template customization is now in Settings > Documents */}
      
      <Route path="/settings" component={SettingsWrapper} />
      
      <Route path="/email-setup" component={() => (
        <EmailSetupGuide 
          onSetupComplete={() => onNavigate('/invoices')}
          onSkip={() => onNavigate('/dashboard')}
        />
      )} />
      
      <Route path="/integrations" component={() => (
        <Integrations />
      )} />
      
      {/* Task #303: Bring-your-business migration wizard */}
      <Route path="/bring-your-business" component={() => (
        <BringYourBusiness />
      )} />
      
      <Route path="/subscription" component={() => (
        <SubscriptionPage />
      )} />
      
      <Route path="/time-tracking" component={() => (
        <TimeTrackingPage />
      )} />
      
      <Route path="/audit-log" component={TimeEditAuditLog} />
      
      <Route path="/team" component={() => (
        <Team />
      )} />

      <Route path="/team-dashboard">
        <Redirect to="/team" />
      </Route>

      <Route path="/team-management">
        <Redirect to="/team" />
      </Route>

      <Route path="/team-groups">
        <Redirect to="/team" />
      </Route>

      <Route path="/team-operations">
        <FeatureGate requiredTier="team" featureName="Team Operations" description="Manage your team's schedule, dispatch jobs, and track progress in real time.">
          <TeamOperations />
        </FeatureGate>
      </Route>

      <Route path="/staff-licences" component={() => (
        <FeatureGate requiredTier="team" featureName="Staff Licences" description="Track and manage your team's licences, certifications, and compliance tickets.">
          <StaffLicences />
        </FeatureGate>
      )} />

      <Route path="/leave-management" component={() => (
        <FeatureGate requiredTier="team" featureName="Leave Management" description="Manage leave requests, view the team calendar, and track leave balances.">
          <LeaveManagement />
        </FeatureGate>
      )} />
      
      <Route path="/team-chat" component={() => (
        <FeatureGate requiredTier="team" featureName="Team Chat" description="Communicate with your team in real-time with built-in messaging.">
          <TeamChatPage />
        </FeatureGate>
      )} />
      
      <Route path="/chat" component={() => (
        <ChatHub />
      )} />
      
      <Route path="/map" component={() => (
        <FeatureGate requiredTier="team" featureName="Job Map" description="Track your team's live locations and view all jobs on an interactive map.">
          <JobMapPage />
        </FeatureGate>
      )} />
      
      <Route path="/messages">
        {() => {
          window.location.href = '/chat';
          return null;
        }}
      </Route>
      
      <Route path="/action-center" component={() => (
        <ActionCenter onNavigate={onNavigate} />
      )} />

      <Route path="/insights" component={() => (
        <FeatureGate requiredTier="pro" featureName="Business Insights" description="Get AI-powered insights and analytics to grow your trade business.">
          <Insights onNavigate={onNavigate} />
        </FeatureGate>
      )} />

      <Route path="/autopilot" component={() => (
        <FeatureGate requiredTier="pro" featureName="Autopilot" description="Automate follow-ups, reminders, and routine tasks to save time.">
          <Autopilot onNavigate={onNavigate} />
        </FeatureGate>
      )} />

      <Route path="/reports/profitability" component={() => (
        <FeatureGate requiredTier="pro" featureName="Profitability Reports" description="See profit by job, client, and worker. Available on paid plans.">
          <ProfitabilityReport />
        </FeatureGate>
      )} />

      <Route path="/reports/payroll" component={() => (
        <FeatureGate requiredTier="pro" featureName="Payroll Reports" description="Track team hours and payroll. Available on paid plans.">
          <PayrollReports />
        </FeatureGate>
      )} />

      <Route path="/subcontractor-invoices">
        <Redirect to="/team?tab=subinvoices" />
      </Route>

      <Route path="/my-invoices" component={MyInvoices} />

      <Route path="/reports" component={() => (
        <FeatureGate requiredTier="pro" featureName="Reports" description="Access detailed reports on jobs, revenue, team performance, and more.">
          <Reports />
        </FeatureGate>
      )} />
      
      <Route path="/calculators" component={Calculators} />
      
      {renderAdminRoutes()}
      
      <Route path="/payment-hub" component={PaymentHub} />

      <Route path="/expenses" component={() => (
        <FeatureGate requiredTier="pro" featureName="Expenses" description="Track and report business expenses. Available on paid plans.">
          <ExpensesPage />
        </FeatureGate>
      )} />
      
      <Route path="/automations" component={() => (
        <FeatureGate requiredTier="pro" featureName="Automations" description="Automate follow-ups, reminders, and routine tasks. Available on paid plans.">
          <Automations />
        </FeatureGate>
      )} />
      {/* Automations controls moved to Communications Hub - route kept for backward compatibility */}
      
      <Route path="/recurring-jobs" component={() => (
        <RecurringJobs />
      )} />
      
      <Route path="/service-reminders" component={() => (
        <ServiceRemindersPage />
      )} />
      
      <Route path="/inventory" component={() => (
        <InventoryPage />
      )} />
      
      <Route path="/equipment" component={() => (
        <InventoryPage initialSection="equipment" />
      )} />
      
      <Route path="/whs" component={() => (
        <WhsHubPage />
      )} />
      
      <Route path="/files" component={() => (
        <FilesPage />
      )} />
      
      <Route path="/rebates" component={() => (
        <RebatesPage />
      )} />
      
      <Route path="/leads" component={() => (
        <FeatureGate requiredTier="pro" featureName="Leads" description="Capture and convert leads with the CRM pipeline. Available on paid plans.">
          <Leads />
        </FeatureGate>
      )} />
      
      <Route path="/custom-forms">
        <Redirect to="/templates?tab=jobs_safety" />
      </Route>
      
      <Route path="/templates" component={TemplatesHub} />
      
      <Route path="/communications" component={() => (
        <CommunicationsHub />
      )} />
      
      <Route path="/collect-payment" component={() => (
        <CollectPayment />
      )} />
      
      <Route path="/my-account">
        {() => {
          window.location.href = '/settings';
          return null;
        }}
      </Route>
      
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/verify-email-pending" component={VerifyEmailPending} />
      <Route path="/reset-password" component={ResetPassword} />
      {/* NOTE: /accept-invite and /accept-assignment are normally handled by a
          standalone short-circuit in AppLayout (rendered full-screen, outside this
          shell) for both logged-in and logged-out users. These in-shell routes are
          a defensive fallback only and are effectively unreachable in normal flow. */}
      <Route path="/accept-invite/:token" component={AcceptInvite} />
      <Route path="/accept-assignment/:jobId/:assignmentId" component={AcceptAssignment} />
      <Route path="/invite/:code">
        {(params: { code: string }) => <JobInvite code={params.code} />}
      </Route>
      <Route path="/open-app/:action/:token" component={OpenApp} />
      
      <Route path="/ai-receptionist/calls" component={() => (
        <FeatureGate requiredTier="pro" featureName="AI Receptionist" description="AI-powered phone answering that captures leads and transfers calls.">
          <AIReceptionistCalls />
        </FeatureGate>
      )} />
      
      <Route path="/ai-receptionist" component={() => (
        <FeatureGate requiredTier="pro" featureName="AI Receptionist" description="AI-powered phone answering that captures leads and transfers calls.">
          <AIReceptionist />
        </FeatureGate>
      )} />

      <Route path="/website" component={() => (
        <WebsiteAddonPage />
      )} />

      <Route path="/ai-visualization" component={GatedAIVisualizationPage} />
      
      <Route path="/more" component={More} />
      
      {/* Root route must be near the end to avoid prefix matching issues */}
      <Route path="/" component={() => roleLoading ? (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4 animate-pulse">
          <div className="h-16 bg-muted rounded-md" />
          <div className="h-32 bg-muted rounded-md" />
        </div>
      ) : isSubcontractor ? (
        <SubcontractorDashboardPage />
      ) : (
        <Dashboard 
          onCreateJob={() => onNavigate('/jobs')}
          onCreateQuote={() => onNavigate('/quotes')}
          onCreateInvoice={() => onNavigate('/invoices')}
          onViewJobs={() => onNavigate('/jobs')}
          onViewInvoices={() => onNavigate('/invoices')}
          onViewQuotes={() => onNavigate('/quotes')}
          onNavigate={onNavigate}
        />
      )} />
      
      <Route component={NotFound} />
      </Switch>
    </Suspense>
    </ChunkErrorBoundary>
  );
}

// Main app layout with sidebar and bottom navigation
// Helper function for trade color conversion
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function GatedFloatingAIChat({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { canUseAIFeatures, isLoading } = useFeatureAccess();
  if (isLoading || !canUseAIFeatures) return null;
  return <FloatingAIChat onNavigate={onNavigate} />;
}

function GatedAIVisualizationPage() {
  const { canUseAIFeatures, isLoading } = useFeatureAccess();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (!isLoading && !canUseAIFeatures) {
      setLocation("/dashboard");
    }
  }, [isLoading, canUseAIFeatures, setLocation]);
  if (isLoading || !canUseAIFeatures) return null;
  return <AIVisualizationPage />;
}

function AppLayout() {
  const { theme, setTheme, setThemeWithSync } = useTheme();
  const [location, setLocation] = useLocation();
  const [authKey, setAuthKey] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // Modal state for quotes and invoices
  const [quoteModal, setQuoteModal] = useState<{ isOpen: boolean; quoteId: string | null }>({ isOpen: false, quoteId: null });
  const [invoiceModal, setInvoiceModal] = useState<{ isOpen: boolean; invoiceId: string | null }>({ isOpen: false, invoiceId: null });
  
  // Guided tour state
  const { 
    showTour, 
    hasCompleted: tourCompleted, 
    startTour, 
    closeTour, 
    completeTour 
  } = useGuidedTour();
  
  const autoTourTriggered = useRef(false);

  // Detect OAuth callback and trigger auth refresh
  useEffect(() => {
    // Check if we've returned from OAuth (URL contains certain params or we're on the root)
    const urlParams = new URLSearchParams(window.location.search);
    const hasOAuthParams = urlParams.has('code') || urlParams.has('state');
    // Also check for our custom auth param from Google OAuth callback
    const authParam = urlParams.get('auth');
    const hasGoogleAuthSuccess = authParam === 'google_success' || authParam === 'xero_success' || authParam === 'success';
    
    if (hasOAuthParams || hasGoogleAuthSuccess || sessionStorage.getItem('oauth-in-progress')) {
      sessionStorage.removeItem('oauth-in-progress');
      // Directly invalidate auth queries to trigger refresh
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
      setAuthKey(prev => prev + 1);
      // Clean up URL (remove OAuth params but keep clean URL)
      if (hasOAuthParams || hasGoogleAuthSuccess) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);
  

  // Check if user is authenticated
  const { data: userCheck, isLoading, error } = useQuery({
    queryKey: ["/api/auth/me", authKey],
    queryFn: async () => {
      const headers: HeadersInit = {};
      const token = getSessionToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/auth/me', { credentials: 'include', headers });
      // Fail fast on genuine auth failures (401/403) so logout/expired tokens are
      // immediate, and on rate limits (429) so we respect the server's backoff
      // instead of hammering it. Other failures (network drop / 5xx) are retried.
      if (res.status === 401 || res.status === 403 || res.status === 429) {
        const noRetryErr = new Error('Not authenticated') as Error & { noRetry?: boolean };
        noRetryErr.noRetry = true;
        throw noRetryErr;
      }
      if (!res.ok) throw new Error(`Auth check failed: ${res.status}`);
      return res.json();
    },
    // Retry transient network/5xx blips so an authenticated user isn't bounced to
    // the public landing page on a momentary hiccup, but never retry the
    // fast-fail cases (401/403/429) flagged above.
    retry: (failureCount, err) => !(err as Error & { noRetry?: boolean })?.noRetry && failureCount < 2,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (userCheck) {
      Sentry.setUser({
        id: String(userCheck.id),
        email: userCheck.email,
        username: userCheck.businessName || userCheck.fullName,
      });
      import("@/lib/routePrefetch").then(({ warmCoreData }) => warmCoreData());
    } else if (!isLoading) {
      Sentry.setUser(null);
    }
  }, [userCheck, isLoading]);

  // Check if user needs onboarding (check business settings)
  // IMPORTANT: This must be called before any conditional returns to satisfy Rules of Hooks
  const { 
    data: businessSettings, 
    isLoading: businessSettingsLoading,
    error: businessSettingsError 
  } = useQuery({
    queryKey: ['/api/business-settings'],
    enabled: !!userCheck && !isLoading && !error,
    retry: false,
    queryFn: async () => {
      const headers: HeadersInit = {};
      const token = getSessionToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/business-settings', { credentials: 'include', headers });
      if (res.status === 404) {
        // No business settings found - return null to trigger onboarding
        return null;
      }
      if (!res.ok) {
        throw new Error('Failed to fetch business settings');
      }
      return res.json();
    }
  });

  // Check if user is a team member (staff users should skip onboarding)
  const { 
    data: teamRoleInfo, 
    isLoading: teamRoleLoading 
  } = useQuery({
    queryKey: ['/api/team/my-role'],
    enabled: !!userCheck && !isLoading && !error,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    queryFn: async () => {
      const headers: HeadersInit = {};
      const token = getSessionToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/team/my-role', { credentials: 'include', headers });
      if (res.status === 404) {
        // Not a team member - this is expected for business owners
        return null;
      }
      if (!res.ok) {
        throw new Error('Failed to fetch team role');
      }
      return res.json();
    }
  });

  // Staff users (team members on someone else's team) should skip onboarding entirely
  // Owners without business settings still need to complete onboarding
  const isStaffOnOtherTeam = !!teamRoleInfo && teamRoleInfo.role !== 'owner';

  // Choose which guided tour to run. Field workers (those who can't open the
  // Clients page) get a job-focused tour instead of the owner tour, which
  // references pages they don't have (Clients, quotes, business settings).
  // Route access is role-gated, so this stays correct even when a worker holds
  // the VIEW_CLIENTS permission (which doesn't grant /clients route access).
  const { isOwner: tourIsOwner, canAccessRoute: tourCanAccessRoute } = useAppMode();
  const tourAudience: 'owner' | 'worker' =
    (!tourIsOwner && !tourCanAccessRoute('/clients')) ? 'worker' : 'owner';

  // Get the businessId for real-time updates
  // For team members, use their business owner's ID; for owners, use their own ID
  const realtimeBusinessId = teamRoleInfo?.businessOwnerId || userCheck?.id || '';
  
  // Wire up real-time WebSocket updates for live UI synchronization
  // This handles job status changes, timer events, document updates, payments, etc.
  // MUST be called unconditionally before any early returns (React Rules of Hooks)
  const wsEnabled = !!userCheck && !!realtimeBusinessId && !isLoading && !businessSettingsLoading;
  const collaborationCtx = React.useContext(JobCollaborationCtxRaw);
  
  const handleJobEditingPresence = useCallback((event: { jobId: string; editors: { userId: string; userName: string; joinedAt: number }[] }) => {
    collaborationCtx?._dispatchPresence(event.jobId, event.editors);
  }, [collaborationCtx]);
  
  const handleJobFieldUpdated = useCallback((event: { jobId: string; updatedFields: string[]; updatedBy: string; updatedByName: string; version: number; serverData: Record<string, unknown>; timestamp: number }) => {
    collaborationCtx?._dispatchFieldUpdate(event);
  }, [collaborationCtx]);
  
  const { isConnected: wsConnected, hadPriorConnection: wsHadPriorConnection, gaveUp: wsGaveUp, forceReconnect: wsForceReconnect, sendMessage: wsSendMessage } = useRealtimeUpdates({
    businessId: realtimeBusinessId,
    enabled: wsEnabled,
    onJobEditingPresence: handleJobEditingPresence,
    onJobFieldUpdated: handleJobFieldUpdated,
  });
  
  const prevWsConnected = useRef(false);
  useEffect(() => {
    if (collaborationCtx) {
      collaborationCtx.setSendMessage(wsSendMessage);
      if (wsConnected && !prevWsConnected.current) {
        collaborationCtx._dispatchReconnect();
      }
      prevWsConnected.current = wsConnected;
    }
  }, [collaborationCtx, wsSendMessage, wsConnected]);
  const [showHelpCenter, setShowHelpCenter] = useState(false);
  const [showReconnecting, setShowReconnecting] = useState(false);
  const [reconnectingDismissed, setReconnectingDismissed] = useState(false);
  useEffect(() => {
    // Only show the banner if: enabled, disconnected, AND the user has had a
    // prior successful connection (avoid flashing on first-ever load).
    if (wsEnabled && !wsConnected && wsHadPriorConnection && !reconnectingDismissed) {
      const timer = setTimeout(() => setShowReconnecting(true), 6000);
      return () => clearTimeout(timer);
    }
    setShowReconnecting(false);
    // When we reconnect, clear the dismissed state so it can show again next time
    if (wsConnected) setReconnectingDismissed(false);
    return;
  }, [wsEnabled, wsConnected, wsHadPriorConnection, reconnectingDismissed]);

  // Initialize and update trade colors based on theme and trade selection
  // IMPORTANT: All useEffect hooks must be called before any conditional returns
  // NOTE: Trade type colors are ONLY applied when custom brand theme is NOT enabled
  // When custom brand theme is enabled, ThemeProvider handles all --trade variables
  useEffect(() => {
    const updateTradeColors = () => {
      // Check if custom brand theme is enabled - if so, don't override ThemeProvider's colors
      const brandThemeStr = localStorage.getItem('jobrunner-brand-theme');
      if (brandThemeStr) {
        try {
          const brandTheme = JSON.parse(brandThemeStr);
          // If custom theme is enabled with a valid color, let ThemeProvider handle the colors
          if (brandTheme.customThemeEnabled && brandTheme.primaryColor && /^#[0-9A-Fa-f]{6}$/i.test(brandTheme.primaryColor)) {
            return; // Skip - ThemeProvider will set the colors
          }
        } catch (e) {
          // Invalid JSON, continue with trade type colors
        }
      }
      
      // JobRunner brand blue — the global accent stays ONE consistent colour
      // app-wide. Per-trade colours still live in the catalog for badges/icons,
      // but they no longer drive the theme (which previously made non-plumbing
      // trades, e.g. Electrical = red, clash with the blue brand elsewhere).
      // The only thing that recolours the app is an explicit custom brand theme
      // (handled by ThemeProvider, which sets every accent var consistently).
      const hexColor = '#2563EB';
      const hsl = hexToHsl(hexColor);
      
      // Check current theme
      const isDark = document.documentElement.classList.contains('dark');
      
      // Primary trade color
      document.documentElement.style.setProperty('--trade', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
      
      // Background variants - responsive to light/dark mode
      const bgLightness = isDark ? Math.max(hsl.l - 55, 8) : Math.min(hsl.l + 45, 96);
      const bgSaturation = Math.max(hsl.s - 30, 10);
      document.documentElement.style.setProperty('--trade-bg', `${hsl.h} ${bgSaturation}% ${bgLightness}%`);
      
      // Border variants - enhanced contrast responsive to theme
      const borderLightness = isDark ? Math.min(hsl.l + 20, 80) : Math.max(hsl.l - 15, 30);
      document.documentElement.style.setProperty('--trade-border', `${hsl.h} ${hsl.s}% ${borderLightness}%`);
      
      // Special accent colors for enhanced theming
      const accentLightness = isDark ? Math.min(hsl.l + 10, 70) : Math.max(hsl.l - 5, 40);
      document.documentElement.style.setProperty('--trade-accent', `${hsl.h} ${Math.min(hsl.s + 10, 100)}% ${accentLightness}%`);
      
      // Subtle glow effect color
      const glowLightness = isDark ? Math.max(hsl.l - 20, 20) : Math.min(hsl.l + 30, 85);
      document.documentElement.style.setProperty('--trade-glow', `${hsl.h} ${Math.min(hsl.s + 20, 100)}% ${glowLightness}%`);
    };

    // Initial setup
    updateTradeColors();
    
    // Listen for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          updateTradeColors();
        }
      });
    });
    
    // Listen for trade changes from Dashboard
    const handleTradeChange = () => {
      updateTradeColors();
    };
    
    observer.observe(document.documentElement, { attributes: true });
    window.addEventListener('trade-change', handleTradeChange);
    
    return () => {
      observer.disconnect();
      window.removeEventListener('trade-change', handleTradeChange);
    };
  }, []);

  // Update trade colors when user changes
  useEffect(() => {
    if (userCheck?.tradeType) {
      const tradeType = userCheck.tradeType;
      localStorage.setItem('jobrunner-trade-type', tradeType);
      // Trigger a re-render of trade colors
      window.dispatchEvent(new Event('trade-change'));
    }
  }, [userCheck?.tradeType]);

  // Listen for guided tour trigger from settings
  useEffect(() => {
    const handleStartTour = () => {
      startTour();
    };
    window.addEventListener('start-guided-tour', handleStartTour);
    return () => {
      window.removeEventListener('start-guided-tour', handleStartTour);
    };
  }, [startTour]);

  // Sync brand theme AND theme mode from backend to ThemeProvider ONLY on initial load
  // We use a ref to track if we've already synced to prevent overriding user's local changes
  const { setBrandTheme, initializeFromServer } = useTheme();
  const hasInitialSynced = useRef(false);
  
  useEffect(() => {
    // Only sync once when businessSettings first loads
    // This prevents overriding user's local color selections when switching themes
    if (businessSettings && !hasInitialSynced.current) {
      hasInitialSynced.current = true;
      
      // Sync theme mode (light/dark/system) from server - this ensures mobile and web stay in sync
      const serverThemeMode = businessSettings.themeMode as 'light' | 'dark' | 'system' | null;
      if (serverThemeMode) {
        initializeFromServer(serverThemeMode);
      }
      
      const serverColor = (businessSettings.primaryColor || businessSettings.brandColor || '').toUpperCase();
      const serverCustomEnabled = businessSettings.customThemeEnabled || false;
      
      if (serverCustomEnabled && serverColor && /^#[0-9A-Fa-f]{6}$/i.test(serverColor)) {
        // Backend has custom theme enabled - use it
        setBrandTheme({
          primaryColor: serverColor,
          customThemeEnabled: true
        });
        localStorage.setItem('jobrunner-brand-theme', JSON.stringify({
          primaryColor: serverColor,
          customThemeEnabled: true
        }));
      }
      // If backend doesn't have custom theme enabled, we keep the localStorage/default values
      // This allows users to experiment with colors before saving
    }
    // Note: setBrandTheme and initializeFromServer are stable (useCallback) so they won't cause re-runs
  }, [businessSettings, setBrandTheme, initializeFromServer]);

  useEffect(() => {
    if (businessSettings && businessSettings.onboardingCompleted && !businessSettings.hasSeenWalkthrough && !autoTourTriggered.current) {
      autoTourTriggered.current = true;
      apiRequest('PATCH', '/api/business-settings', { hasSeenWalkthrough: true })
        .then(() => queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] }))
        .catch(() => {});
      startTour();
    }
  }, [businessSettings, startTour, queryClient]);

  useEffect(() => {
    const authEntryRoutes = ['/auth', '/login', '/register', '/forgot-password'];
    if (!isLoading && userCheck && !error && authEntryRoutes.some(r => location === r || location.startsWith(r))) {
      setLocation('/');
    }
  }, [isLoading, userCheck, error, location, setLocation]);

  const handleLoginSuccess = () => {
    // Invalidate both auth and business settings queries to refetch fresh data
    queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
    setAuthKey(prev => prev + 1); // Force refetch of auth status
  };

  const handleNeedOnboarding = () => {
    // User successfully authenticated but needs onboarding
    // Only invalidate business settings to trigger onboarding check
    queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
  };

  const handleSimpleOnboardingComplete = async () => {
    // SimpleOnboarding already saves business settings via its own API call
    // Just invalidate queries to refresh the app state
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/unified"] }),
    ]);
    handleLoginSuccess();
  };

  const handleLogout = async () => {
    // Show a deliberate "Signing out" screen so the app doesn't snap straight
    // to the landing page. We hold the overlay for a minimum moment and run the
    // logout request in parallel, so the transition always feels guided.
    setIsLoggingOut(true);
    // Always show the overlay for at least 1.1s so it feels deliberate, but
    // never wait longer than 2.5s for the network — a hung logout request must
    // not leave the user stuck on the "Signing you out" screen.
    const minimumDelay = new Promise((resolve) => setTimeout(resolve, 1100));
    const request = fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch((error) => {
      console.error('Logout error:', error);
    });
    const cappedRequest = Promise.race([
      request,
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
    try {
      await Promise.all([cappedRequest, minimumDelay]);
    } finally {
      // Clear session token from localStorage (for iOS/Safari fallback)
      clearSessionToken();
      // Clear Help Center chat history so a subsequent user on the same device
      // cannot see the previous user's conversation.
      clearChatHistory();
      // Reset the sync flag so the next login will sync from backend
      hasInitialSynced.current = false;
      // Invalidate all queries
      queryClient.clear();
      // Navigate to auth page after the deliberate pause
      setLocation('/auth');
      // Force refetch of auth status which will show login screen
      setAuthKey(prev => prev + 1);
      // Reveal the auth screen (batched with the updates above in one render)
      setIsLoggingOut(false);
    }
  };

  if (isLoggingOut) {
    return (
      <div className="fixed inset-0 z-[200] bg-background flex items-center justify-center page-enter">
        <div className="text-center px-6">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-foreground font-medium">Signing you out</p>
          <p className="text-muted-foreground text-sm mt-1">Saving your session and securing your account...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading JobRunner...</p>
        </div>
      </div>
    );
  }

  if (userCheck && !error && (location === '/auth' || location.startsWith('/auth'))) {
    return null;
  }

  // If not authenticated, show landing page or auth flow based on route
  if (error || !userCheck) {
    // Show auth flow at /auth route
    if (location === '/auth' || location.startsWith('/auth')) {
      return (
        <AuthFlow 
          onLoginSuccess={handleLoginSuccess}
          onNeedOnboarding={handleNeedOnboarding}
        />
      );
    }
    // Show email verification pages without authentication (required for signup flow)
    if (location === '/verify-email-pending' || location.startsWith('/verify-email-pending')) {
      return <VerifyEmailPending />;
    }
    if (location === '/verify-email' || location.startsWith('/verify-email')) {
      return <VerifyEmail />;
    }
    // Show privacy policy and terms of service without authentication (Apple App Store requirement)
    if (location === '/privacy' || location === '/privacy-policy') {
      return <PrivacyPolicy />;
    }
    if (location === '/terms' || location === '/terms-of-service') {
      return <TermsOfService />;
    }
    if (location === '/delete-account' || location === '/delete-account/') {
      return <DeleteAccount />;
    }
    if (location === '/support' || location === '/support/') {
      return <Support />;
    }
    // Show accept-invite page without authentication (team members accepting invitations)
    if (location.startsWith('/accept-invite/')) {
      return <AcceptInvite />;
    }
    // Show smart app redirect page (tries to open app, falls back to web/store)
    if (location.startsWith('/open-app/')) {
      return <OpenApp />;
    }
    // Show password reset page without authentication
    if (location.startsWith('/reset-password')) {
      return <ResetPassword />;
    }
    // Public demo entry — auto-logs into the demo workspace
    if (location === '/demo' || location.startsWith('/demo?') || location.startsWith('/demo/')) {
      return <DemoPage />;
    }
    // Show landing page for all other routes when not authenticated
    // Remember the deep link a logged-out user tried to reach so we can send
    // them back there after they sign in.
    try {
      const authEntryRoutes = ['/auth', '/login', '/register', '/forgot-password'];
      if (location && location !== '/' && !authEntryRoutes.some(r => location.startsWith(r))) {
        sessionStorage.setItem('postLoginRedirect', location);
      }
    } catch {}
    return <LandingPage />;
  }

  // Platform admin users get a completely different interface - check early before tradie-specific logic
  if (userCheck?.isPlatformAdmin === true) {
    return (
      <AdminAppShell 
        onLogout={handleLogout} 
        onNavigate={(path) => setLocation(path)}
      >
        <ChunkErrorBoundary>
        <Suspense fallback={
          <div className="w-full px-6 lg:px-8 py-6 space-y-6 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-7 w-48 bg-muted rounded-md" />
                <div className="h-4 w-64 bg-muted rounded-md" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-lg border bg-card p-5 space-y-3">
                  <div className="h-4 w-20 bg-muted rounded-md" />
                  <div className="h-8 w-24 bg-muted rounded-md" />
                </div>
              ))}
            </div>
            <div className="rounded-lg border bg-card p-5 space-y-4">
              <div className="h-5 w-32 bg-muted rounded-md" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 w-full bg-muted rounded-md" />
                ))}
              </div>
            </div>
          </div>
        }>
        <Switch>
          {renderAdminRoutes()}
          {/* Redirect any other path to admin dashboard */}
          <Route>
            <Redirect to="/admin" />
          </Route>
        </Switch>
        </Suspense>
        </ChunkErrorBoundary>
      </AdminAppShell>
    );
  }

  // If authenticated but still loading business settings or team role, show loading state
  if (userCheck && (businessSettingsLoading || teamRoleLoading)) {
    // Still loading business settings or team role
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (userCheck && !userCheck.isOwner && userCheck.ownerSubscriptionValid === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Subscription Inactive</h2>
            <p className="text-muted-foreground">
              {userCheck.ownerBusinessName 
                ? `${userCheck.ownerBusinessName}'s JobRunner subscription is no longer active.`
                : "Your employer's JobRunner subscription is no longer active."}
            </p>
            <p className="text-muted-foreground mt-2">
              Please contact the business owner to restore access.
            </p>
          </div>
          <button 
            onClick={handleLogout}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover-elevate h-10 px-4 py-2"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Send owner to onboarding when:
  //  1) no business_settings row at all (businessSettings === null), OR
  //  2) row exists but onboardingCompleted is false — server-side onboarding
  //     guard will 403 every data API otherwise, leaving the dashboard broken.
  // Invite/assignment acceptance links must work even for an owner who hasn't
  // finished onboarding — otherwise clicking a "join the team" link dumps them
  // into their own business onboarding instead of the invite they clicked.
  const isInviteAcceptanceRoute =
    location.startsWith('/accept-invite/') ||
    location.startsWith('/accept-assignment/');

  const ownerNeedsOnboarding =
    !!userCheck &&
    !isStaffOnOtherTeam &&
    !userCheck.isPlatformAdmin &&
    !isInviteAcceptanceRoute &&
    (businessSettings === null ||
      (businessSettings && businessSettings.onboardingCompleted === false));

  if (ownerNeedsOnboarding) {
    return <SimpleOnboarding onComplete={handleSimpleOnboardingComplete} onSkip={handleSimpleOnboardingComplete} />;
  }

  // Invite/assignment acceptance pages are full-screen standalone flows. Even
  // when the user is already signed in, render them on their own — never embed
  // them inside the authenticated app shell (sidebar + header). Otherwise a
  // logged-in owner who clicks a "join the team" link sees the invite card
  // stuffed inside their dashboard, and the post-accept redirect looks like
  // nothing happened. Both pages read their params via useRoute internally.
  if (isInviteAcceptanceRoute) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      }>
        {location.startsWith('/accept-assignment/') ? <AcceptAssignment /> : <AcceptInvite />}
      </Suspense>
    );
  }

  // If authenticated, show main app below (existing code continues...)

  const handleNavigation = (path: string) => {
    setLocation(path);
  };

  // Custom sidebar width for JobRunner
  const style = {
    "--sidebar-width": "16rem",       // 256px - compact for laptop screens
    "--sidebar-width-icon": "3.5rem",
  };

  const getPageTitle = () => {
    const routes: Record<string, string> = {
      '/': 'Dashboard',
      '/jobs': 'Jobs',
      '/clients': 'Clients',
      '/quotes': 'Quotes',
      '/invoices': 'Invoices',
      '/calendar': 'Calendar',
      '/settings': 'Settings',
      '/integrations': 'Integrations',
      '/more': 'More'
    };
    return routes[location] || 'JobRunner';
  };

  const showAddButton = () => {
    return ['/jobs', '/clients', '/quotes', '/invoices', '/calendar'].includes(location);
  };

  const getAddButtonText = () => {
    const buttonTexts: Record<string, string> = {
      '/jobs': 'New Job',
      '/clients': 'New Client',
      '/quotes': 'New Quote',
      '/invoices': 'New Invoice',
      '/calendar': 'Schedule Job'
    };
    return buttonTexts[location] || 'Add';
  };

  return (
    <>
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          {/* Desktop Sidebar */}
          <AppSidebar onNavigate={handleNavigation} onLogout={handleLogout} />
          
          {/* Main Content - takes full remaining width */}
          <div className="flex flex-col flex-1 min-w-0 w-full">
            {/* Header - needs z-index above map content */}
            <div className="space-y-0 relative z-[20]">
              <Header 
                title={undefined}
                showSearch={location === '/' || location === '/jobs' || location === '/clients'}
                showAddButton={false}
                addButtonText={getAddButtonText()}
                onAddClick={() => console.log('Add button clicked')}
                onThemeToggle={() => setThemeWithSync(theme === 'dark' ? 'light' : 'dark')}
                isDarkMode={theme === 'dark'}
                onProfileClick={() => setLocation('/settings')}
                onSettingsClick={() => setLocation('/settings')}
                onLogoutClick={handleLogout}
                onHelpClick={() => setShowHelpCenter(true)}
              />
              {/* Business Picker for multi-business users */}
              {userCheck && <BusinessPicker userId={userCheck.id} />}
              {/* Offline Indicator */}
              <OfflineIndicator />
              {/* WebSocket Reconnecting Indicator */}
              {showReconnecting && (
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-muted border-b border-border text-muted-foreground text-xs font-medium" role="status" aria-live="polite" data-testid="ws-reconnecting-banner">
                  <div className="flex items-center gap-2">
                    {wsGaveUp
                      ? <WifiOff className="h-3 w-3 text-destructive" />
                      : <RefreshCw className="h-3 w-3 animate-spin" />
                    }
                    <span>{wsGaveUp ? 'Live updates disconnected.' : 'Reconnecting to live updates...'}</span>
                    {wsGaveUp && (
                      <button
                        onClick={() => { setReconnectingDismissed(false); wsForceReconnect(); }}
                        className="underline hover:text-foreground transition-colors"
                      >
                        Try again
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setReconnectingDismissed(true)}
                    className="ml-2 hover:text-foreground transition-colors"
                    aria-label="Dismiss"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {/* Trial Banner */}
              {userCheck?.trialStatus === 'active' && userCheck?.trialEndsAt && (
                <TrialBanner trialEndsAt={userCheck.trialEndsAt} onUpgrade={() => setLocation('/settings?tab=billing')} />
              )}
              {/* Payment Overdue Banner */}
              <PaymentOverdueBanner onResolve={() => setLocation('/settings?tab=billing')} />
              <DemoModeBanner isVisitorDemo={userCheck?.isVisitorDemo === true} />
            </div>
            
            {/* Page Content - flex container for proper height context, z-index below header */}
            <main className="flex-1 relative flex flex-col min-h-0 overflow-hidden z-[10]" data-scroll-container>
              {/* RouteGuard checks permissions before rendering content */}
              <RouteGuard>
                <PageErrorBoundary key={location}>
                {/* Map page renders directly in the flex container, other pages get scroll wrapper */}
                {location.startsWith('/map') ? (
                  <Router 
                    onNavigate={handleNavigation}
                    onShowQuoteModal={(quoteId) => setQuoteModal({ isOpen: true, quoteId })}
                    onShowInvoiceModal={(invoiceId) => setInvoiceModal({ isOpen: true, invoiceId })}
                  />
                ) : (
                  <div className="flex-1 overflow-y-auto pb-20 md:pb-4 page-enter">
                    <Router 
                      onNavigate={handleNavigation}
                      onShowQuoteModal={(quoteId) => setQuoteModal({ isOpen: true, quoteId })}
                      onShowInvoiceModal={(invoiceId) => setInvoiceModal({ isOpen: true, invoiceId })}
                    />
                  </div>
                )}
                </PageErrorBoundary>
              </RouteGuard>
            </main>
          </div>
        </div>
        {/* Fixed position elements - inside SidebarProvider for context access */}
        <BottomNav onNavigate={handleNavigation} />
      </SidebarProvider>
      
      {/* Payment Toast Provider - shows celebratory "Cha-ching!" when payments come in */}
      <PaymentToastProvider />

      {/* Brief delight overlay on key wins (invoice paid, quote accepted, job done) */}
      <CelebrationOverlay />
      
      {/* What You Missed popup - shows on app open */}
      <WhatYouMissedModal />
      
      {/* AI Assistant - floating above all pages (only for Pro+ subscribers) */}
      <GatedFloatingAIChat onNavigate={handleNavigation} />

      {/* Feedback tab - always visible on the right edge */}
      <FeedbackTab />
      
      {quoteModal.quoteId && (
        <QuoteModal
          quoteId={quoteModal.quoteId}
          isOpen={quoteModal.isOpen}
          onClose={() => setQuoteModal({ isOpen: false, quoteId: null })}
          onViewFullQuote={(quoteId) => {
            setQuoteModal({ isOpen: false, quoteId: null });
            handleNavigation(`/quotes/${quoteId}`);
          }}
        />
      )}
      
      {invoiceModal.invoiceId && (
        <InvoiceModal
          invoiceId={invoiceModal.invoiceId}
          isOpen={invoiceModal.isOpen}
          onClose={() => setInvoiceModal({ isOpen: false, invoiceId: null })}
          onViewFullInvoice={(invoiceId) => {
            setInvoiceModal({ isOpen: false, invoiceId: null });
            handleNavigation(`/invoices/${invoiceId}`);
          }}
        />
      )}
      
      {/* Guided Tour */}
      <GuidedTour
        isOpen={showTour}
        onClose={closeTour}
        onComplete={completeTour}
        audience={tourAudience}
      />

      {/* Help Center slide-over panel */}
      <Suspense fallback={null}>
        <HelpCenter
          open={showHelpCenter}
          onOpenChange={setShowHelpCenter}
          currentRoute={location}
        />
      </Suspense>
      
      
      {/* Keyboard Shortcuts */}
      <KeyboardShortcutsDialog />
    </>
  );
}

// Root app component
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <ErrorBoundary>
      <ImpersonationBanner />
      <ThemeProvider defaultTheme="light" storageKey="jobrunner-ui-theme">
        <NetworkProvider>
          <JobCollaborationProvider>
          <TooltipProvider>
            <ChunkErrorBoundary>
            <Suspense fallback={
              <div className="flex items-center justify-center h-screen">
                <div className="space-y-4 w-full max-w-sm px-6 animate-pulse">
                  <div className="h-10 w-10 bg-muted rounded-lg mx-auto" />
                  <div className="h-5 w-32 bg-muted rounded-md mx-auto" />
                  <div className="h-3 w-48 bg-muted rounded-md mx-auto" />
                </div>
              </div>
            }>
            <Switch>
              {/* Public routes - no auth required, more specific paths first */}
              <Route path="/q/:token">{(params) => <QuoteShortRedirect token={params.token} />}</Route>
              <Route path="/i/:token">{(params) => <InvoiceShortRedirect token={params.token} />}</Route>
              <Route path="/pay/:token" component={PaymentPage} />
              <Route path="/portal/:type/:token" component={ClientPortal} />
              <Route path="/portal" component={ClientPortalHub} />
              <Route path="/job-portal/:token" component={JobPortal} />
              <Route path="/p/:token" component={JobPortal} />
              <Route path="/s/:token">{(params) => <SubcontractorWebView token={params.token} />}</Route>
              <Route path="/m/:token">{() => <MagicLinkLanding />}</Route>
              <Route path="/track/:token">{(params) => <TrackArrival token={params.token} />}</Route>
              <Route path="/book/:slug">{(params) => <BookingPage slug={params.slug} />}</Route>
              <Route path="/receipt/:token">{(params) => <PublicReceiptRedirect token={params.token} />}</Route>
              <Route path="/auth/handoff" component={AuthHandoff} />
              <Route path="/privacy" component={PrivacyPolicy} />
              <Route path="/terms" component={TermsOfService} />
              {/* All other routes go through AppLayout */}
              <Route>
                <AppLayout />
              </Route>
            </Switch>
            </Suspense>
            </ChunkErrorBoundary>
            <Toaster />
          </TooltipProvider>
          </JobCollaborationProvider>
        </NetworkProvider>
      </ThemeProvider>
      </ErrorBoundary>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
