import { useAppMode } from "@/hooks/use-app-mode";
import { useDashboardUnified, unwrapSection } from "@/hooks/use-dashboard-data";
import OwnerManagerDashboard from "./OwnerManagerDashboard";
import StaffTradieDashboard from "./StaffTradieDashboard";

interface DashboardProps {
  onCreateJob?: () => void;
  onCreateQuote?: () => void;
  onCreateInvoice?: () => void;
  onViewJobs?: () => void;
  onViewInvoices?: () => void;
  onViewQuotes?: () => void;
  onNavigate?: (path: string) => void;
}

function DashboardLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen" data-testid="dashboard-loading">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading your workspace...</p>
      </div>
    </div>
  );
}

/**
 * Inner component — only mounts AFTER the unified query has resolved
 * and hydrated per-section sub-caches. This means `useAppMode()` and any
 * child `useQuery` calls (e.g. `["/api/auth/me"]`, `["/api/business-settings"]`)
 * will hit the populated cache and skip their network requests on cold start.
 */
function DashboardInner({
  user,
  businessSettings,
  onCreateJob,
  onCreateQuote,
  onCreateInvoice,
  onViewJobs,
  onViewInvoices,
  onViewQuotes,
  onNavigate,
}: DashboardProps & { user: any; businessSettings: any }) {
  const {
    dashboardType,
    isLoading,
    canCreateJobs,
    canCreateQuotes,
    canCreateInvoices,
  } = useAppMode();

  const firstName = user?.firstName;
  const fullName = user?.name;
  const businessName = businessSettings?.businessName;

  const roleLabels = ["primary", "owner", "manager", "tradie", "admin"];
  const isRoleLabel = (name: string) => roleLabels.includes(name?.toLowerCase());

  let userName = "there";
  if (firstName && !isRoleLabel(firstName)) {
    userName = firstName;
  } else if (fullName && !isRoleLabel(fullName)) {
    userName = fullName.split(" ")[0];
  } else if (businessName) {
    userName = businessName.split(" ")[0];
  }

  if (isLoading || dashboardType === "loading") {
    return <DashboardLoading />;
  }

  switch (dashboardType) {
    case "staff_tradie":
      return (
        <StaffTradieDashboard
          userName={userName}
          onViewJob={(id) => onNavigate?.(`/jobs/${id}`)}
          onViewJobs={onViewJobs}
          onOpenTeamChat={() => onNavigate?.("/team-chat")}
          onNavigate={onNavigate}
        />
      );

    case "owner":
    case "manager":
      return (
        <OwnerManagerDashboard
          userName={userName}
          businessName={businessName}
          onCreateJob={canCreateJobs ? onCreateJob : undefined}
          onCreateQuote={canCreateQuotes ? onCreateQuote : undefined}
          onCreateInvoice={canCreateInvoices ? onCreateInvoice : undefined}
          onViewJobs={onViewJobs}
          onViewInvoices={onViewInvoices}
          onViewQuotes={onViewQuotes}
          onNavigate={onNavigate}
        />
      );

    case "office_admin":
      return (
        <OwnerManagerDashboard
          userName={userName}
          businessName={businessName}
          onCreateQuote={canCreateQuotes ? onCreateQuote : undefined}
          onCreateInvoice={canCreateInvoices ? onCreateInvoice : undefined}
          onViewJobs={onViewJobs}
          onViewInvoices={onViewInvoices}
          onViewQuotes={onViewQuotes}
          onNavigate={onNavigate}
        />
      );

    case "solo_tradie":
    default:
      return (
        <OwnerManagerDashboard
          userName={userName}
          businessName={businessName}
          onCreateJob={canCreateJobs ? onCreateJob : undefined}
          onCreateQuote={canCreateQuotes ? onCreateQuote : undefined}
          onCreateInvoice={canCreateInvoices ? onCreateInvoice : undefined}
          onViewJobs={onViewJobs}
          onViewInvoices={onViewInvoices}
          onViewQuotes={onViewQuotes}
          onNavigate={onNavigate}
        />
      );
  }
}

/**
 * Dashboard root — fires exactly ONE aggregate request (`/api/dashboard/unified`)
 * on cold mount, then renders children only after the response has populated
 * sub-caches. This collapses the previous 8-10 endpoint fan-out into a single
 * round-trip on initial load.
 */
export default function Dashboard(props: DashboardProps) {
  const unified = useDashboardUnified();

  if (!unified.data) {
    return <DashboardLoading />;
  }

  const user = unwrapSection<any>(unified.data.user, null);
  const businessSettings = unwrapSection<any>(unified.data.businessSettings, null);

  return (
    <DashboardInner
      {...props}
      user={user}
      businessSettings={businessSettings}
    />
  );
}
