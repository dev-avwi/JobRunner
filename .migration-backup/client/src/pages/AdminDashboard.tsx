import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient, getAuthHeaders} from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  UserCheck, 
  CheckCircle, 
  Briefcase,
  FileText,
  Receipt,
  TrendingUp,
  Shield,
  Activity,
  HeartPulse,
  LayoutDashboard,
  Search,
  Clock,
  UserPlus,
  Server,
  Database,
  Cpu,
  HardDrive,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Trash2,
  Loader2,
  MessageSquare,
  Phone,
  PhoneIncoming,
  PhoneForwarded,
  Target,
  DollarSign,
  Eye,
  LogOut,
  Kanban,
  Bot,
  GripVertical,
  ArrowRight,
  Plus,
  Edit,
  Mic,
  Mail,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AuthUser {
  email?: string;
  isPlatformAdmin?: boolean;
}

interface AdminStats {
  kpis: {
    totalUsers: number;
    activeUsers: number;
    onboardingCompletionRate: number;
  };
  growthData: Array<{ month: string; signups: number }>;
  featureUsage: {
    totalJobs: number;
    totalInvoices: number;
    totalQuotes: number;
    totalClients: number;
    completedJobs: number;
    paidInvoices: number;
    acceptedQuotes: number;
  };
  tierBreakdown: {
    free: number;
    pro: number;
    trial: number;
  };
}

interface AdminUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  name: string;
  subscriptionTier: string | null;
  tradeType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  isActive: boolean | null;
  emailVerified: boolean | null;
  hasCompletedOnboarding: boolean;
  businessName: string | null;
  role: string | null;
  betaUser: boolean | null;
  betaLifetimeAccess: boolean | null;
}

interface AdminUsersResponse {
  users: AdminUser[];
}

interface RetentionCohort {
  weekStart: string;
  signups: number;
  retained: number;
  retentionPct: number | null;
  windowComplete: boolean;
}

interface RetentionData {
  cohorts: RetentionCohort[];
  headline: { retentionPct: number | null; cohorts: number; signups: number; retained: number };
  trackingStartedAt: string | null;
  generatedAt: string;
}

const adminRoutes = [
  { path: "/admin", label: "Overview", icon: LayoutDashboard },
  { path: "/admin/revenue", label: "Revenue", icon: DollarSign },
  { path: "/admin/comms", label: "Comms", icon: MessageSquare },
  { path: "/admin/users", label: "Users", icon: Users },
  { path: "/admin/kanban", label: "Kanban", icon: Kanban },
  { path: "/admin/ai-queue", label: "AI Queue", icon: Bot },
  { path: "/admin/call-monitor", label: "Calls", icon: PhoneIncoming },
  { path: "/admin/porting", label: "Porting", icon: PhoneForwarded },
  { path: "/admin/activity", label: "Activity", icon: Activity },
  { path: "/admin/email-logs", label: "Email Logs", icon: Mail },
  { path: "/admin/health", label: "Health", icon: HeartPulse },
];

function getTierBadgeVariant(tier: string | null): "default" | "secondary" | "outline" {
  switch (tier) {
    case 'pro': return 'default';
    case 'trial': return 'secondary';
    default: return 'outline';
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr), 'dd MMM yyyy');
  } catch {
    return '-';
  }
}

function formatRelativeDate(dateStr: string | null) {
  if (!dateStr) return 'Never';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return format(date, 'dd MMM yyyy');
  } catch {
    return 'Never';
  }
}

interface KPICardProps {
  title: string;
  value: string | number;
  loading?: boolean;
  icon: React.ReactNode;
  iconBgClass: string;
  testId: string;
}

function KPICard({ title, value, loading, icon, iconBgClass, testId }: KPICardProps) {
  return (
    <Card data-testid={testId} className="hover-elevate">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs md:text-sm text-muted-foreground truncate">{title}</p>
            <p className="text-xl md:text-2xl font-bold mt-1" data-testid={`${testId}-value`}>
              {loading ? (
                <span className="inline-block h-6 w-12 bg-muted animate-pulse rounded" />
              ) : value}
            </p>
          </div>
          <div className={`h-10 w-10 md:h-12 md:w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBgClass}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewView({ 
  stats, 
  statsLoading, 
  statsError,
  usersData,
  usersLoading 
}: { 
  stats: AdminStats | undefined;
  statsLoading: boolean;
  statsError: Error | null;
  usersData: AdminUsersResponse | undefined;
  usersLoading: boolean;
}) {
  const { data: retention, isLoading: retentionLoading, error: retentionError } = useQuery<RetentionData>({
    queryKey: ['/api/admin/retention'],
  });

  const fmtWeek = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', timeZone: 'UTC',
    });
  };
  const cohortsWithSignups = (retention?.cohorts || []).filter((c) => c.signups > 0).reverse();

  return (
    <div className="space-y-6">
      {statsError && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="py-4 px-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
              <p className="text-destructive text-sm">Failed to load admin data. Make sure you have admin access.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          testId="card-total-users"
          title="Total Users"
          value={stats?.kpis.totalUsers || 0}
          loading={statsLoading}
          icon={<Users className="h-5 w-5 md:h-6 md:w-6 text-blue-600 dark:text-blue-400" />}
          iconBgClass="bg-blue-100 dark:bg-blue-500/20"
        />
        <KPICard
          testId="card-active-users"
          title="Active (7d)"
          value={stats?.kpis.activeUsers || 0}
          loading={statsLoading}
          icon={<UserCheck className="h-5 w-5 md:h-6 md:w-6 text-green-600 dark:text-green-400" />}
          iconBgClass="bg-green-100 dark:bg-green-500/20"
        />
        <KPICard
          testId="card-onboarding-rate"
          title="Onboarding Rate"
          value={statsLoading ? '...' : `${stats?.kpis.onboardingCompletionRate || 0}%`}
          loading={statsLoading}
          icon={<CheckCircle className="h-5 w-5 md:h-6 md:w-6 text-purple-600 dark:text-purple-400" />}
          iconBgClass="bg-purple-100 dark:bg-purple-500/20"
        />
        <KPICard
          testId="card-pro-users"
          title="Pro Users"
          value={stats?.tierBreakdown.pro || 0}
          loading={statsLoading}
          icon={<TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-amber-600 dark:text-amber-400" />}
          iconBgClass="bg-amber-100 dark:bg-amber-500/20"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-user-growth">
          <CardHeader className="pb-2">
            <CardTitle className="text-base md:text-lg">User Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] md:h-[260px]">
              {statsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.growthData || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke="hsl(var(--border))" 
                      vertical={false}
                    />
                    <XAxis 
                      dataKey="month" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      formatter={(value: number) => [value, 'Signups']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Bar 
                      dataKey="signups" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-feature-usage">
          <CardHeader className="pb-2">
            <CardTitle className="text-base md:text-lg">Feature Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { icon: Briefcase, label: "Total Jobs", value: stats?.featureUsage.totalJobs || 0, testId: "text-total-jobs" },
                { icon: CheckCircle, label: "Completed Jobs", value: stats?.featureUsage.completedJobs || 0, color: "text-green-500" },
                { icon: Receipt, label: "Total Invoices", value: stats?.featureUsage.totalInvoices || 0, testId: "text-total-invoices" },
                { icon: CheckCircle, label: "Paid Invoices", value: stats?.featureUsage.paidInvoices || 0, color: "text-green-500" },
                { icon: FileText, label: "Total Quotes", value: stats?.featureUsage.totalQuotes || 0, testId: "text-total-quotes" },
                { icon: Users, label: "Total Clients", value: stats?.featureUsage.totalClients || 0 },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2.5">
                    <item.icon className={`h-4 w-4 ${item.color || 'text-muted-foreground'}`} />
                    <span className="text-sm">{item.label}</span>
                  </div>
                  <span className="font-semibold tabular-nums" data-testid={item.testId}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-recent-users">
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg">Recent Users</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="hidden md:table-cell">Signup Date</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : usersData?.users && usersData.users.length > 0 ? (
                  usersData.users.slice(0, 5).map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell className="pl-6 font-medium">
                        <div>
                          <p className="truncate max-w-[150px]">{user.name}</p>
                          {user.businessName && (
                            <p className="text-xs text-muted-foreground truncate max-w-[150px]">{user.businessName}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        <span className="truncate block max-w-[200px]">{user.email || '-'}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getTierBadgeVariant(user.subscriptionTier)} className="capitalize">
                          {user.subscriptionTier || 'free'}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-6">
                        {user.hasCompletedOnboarding ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30">
                            Onboarded
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No users found</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-retention">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base md:text-lg">Week-1 Retention</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Business owners who came back within 7 days of signing up.
              </p>
            </div>
            {!retentionLoading && !retentionError && retention?.headline.retentionPct != null && (
              <div className="text-right">
                <div className="text-2xl md:text-3xl font-semibold" data-testid="text-retention-headline">
                  {retention.headline.retentionPct}%
                </div>
                <p className="text-xs text-muted-foreground">
                  last {retention.headline.cohorts} cohort{retention.headline.cohorts === 1 ? '' : 's'}
                </p>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {retentionLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : retentionError ? (
            <div className="flex items-center gap-3 py-6">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
              <p className="text-destructive text-sm">Failed to load retention data.</p>
            </div>
          ) : cohortsWithSignups.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground">No signups yet to measure.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cohort (week of)</TableHead>
                      <TableHead className="text-right">Signups</TableHead>
                      <TableHead className="text-right">Came back (7d)</TableHead>
                      <TableHead className="text-right">Week-1 %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cohortsWithSignups.map((c) => (
                      <TableRow key={c.weekStart} data-testid={`row-cohort-${c.weekStart}`}>
                        <TableCell>{fmtWeek(c.weekStart)}</TableCell>
                        <TableCell className="text-right">{c.signups}</TableCell>
                        <TableCell className="text-right">{c.retained}</TableCell>
                        <TableCell className="text-right">
                          {!c.windowComplete ? (
                            <span className="text-muted-foreground">In progress</span>
                          ) : (
                            <span className="font-medium">{c.retentionPct ?? 0}%</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Note: activity tracking{' '}
                {retention?.trackingStartedAt
                  ? `started ${fmtWeek(retention.trackingStartedAt)}. Cohorts before then read low because their visits weren't captured yet.`
                  : 'has only just begun, so early cohorts may read low until enough days are captured.'}
                {' '}"In progress" means the 7-day window hasn't fully elapsed.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UsersView({ 
  usersData, 
  usersLoading 
}: { 
  usersData: AdminUsersResponse | undefined;
  usersLoading: boolean;
}) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editTier, setEditTier] = useState<string>("free");
  const [editFoundingMember, setEditFoundingMember] = useState(false);

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: { subscriptionTier?: string; betaLifetimeAccess?: boolean; betaUser?: boolean } }) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${userId}`, data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update user");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "User Updated", description: "Account settings saved successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditingUser(null);
    },
    onError: (error: Error) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    },
  });

  const openEditModal = (user: AdminUser) => {
    setEditingUser(user);
    setEditTier(user.subscriptionTier || 'free');
    setEditFoundingMember(user.betaLifetimeAccess === true);
  };

  const handleSaveUser = () => {
    if (!editingUser) return;
    updateUserMutation.mutate({
      userId: editingUser.id,
      data: {
        subscriptionTier: editTier,
        betaLifetimeAccess: editFoundingMember,
        betaUser: editFoundingMember,
      },
    });
  };

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/users/${userId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete user");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "User Deleted",
        description: data.message || "User account has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDeletingUserId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
      setDeletingUserId(null);
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("POST", `/api/admin/impersonate/${userId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start impersonation");
      }
      return response.json();
    },
    onSuccess: (data: { success: boolean; targetUser: { id: string; email: string; firstName: string | null; lastName: string | null; businessName: string | null } }) => {
      sessionStorage.setItem('impersonation', JSON.stringify({
        targetUser: data.targetUser,
      }));
      toast({
        title: "Shadow Mode Active",
        description: `Now viewing as ${data.targetUser.businessName || data.targetUser.email}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      setLocation('/');
    },
    onError: (error: Error) => {
      toast({
        title: "Impersonation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleImpersonate = (userId: string) => {
    impersonateMutation.mutate(userId);
  };

  const filteredUsers = useMemo(() => {
    if (!usersData?.users) return [];
    
    return usersData.users.filter((user) => {
      const matchesSearch = 
        searchQuery === "" ||
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.businessName?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesTier = 
        tierFilter === "all" || 
        (tierFilter === "founder" ? user.betaLifetimeAccess === true : (user.subscriptionTier || 'free') === tierFilter);
      
      const matchesStatus = 
        statusFilter === "all" ||
        (statusFilter === "onboarded" && user.hasCompletedOnboarding) ||
        (statusFilter === "pending" && !user.hasCompletedOnboarding);
      
      return matchesSearch && matchesTier && matchesStatus;
    });
  }, [usersData?.users, searchQuery, tierFilter, statusFilter]);

  // Hide columns that would otherwise be a wall of "–" for the current rows.
  const hasAnyBusiness = useMemo(() => filteredUsers.some((u) => !!u.businessName), [filteredUsers]);
  const hasAnyTrade = useMemo(() => filteredUsers.some((u) => !!u.tradeType), [filteredUsers]);

  return (
    <div className="space-y-4">
      <Card className="p-4" data-testid="card-users-filters">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or business..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-users"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-tier-filter">
                <SelectValue placeholder="All Tiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="team">Team</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="founder">Founding Members</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-status-filter">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="onboarded">Onboarded</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            {(searchQuery || tierFilter !== "all" || statusFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setTierFilter("all");
                  setStatusFilter("all");
                }}
                data-testid="button-clear-filters"
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card data-testid="card-users-table">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-3">
          <CardTitle className="text-base md:text-lg">
            All Users
            <Badge variant="secondary" className="ml-2 font-normal">
              {filteredUsers.length}
            </Badge>
          </CardTitle>
          {usersData?.users && filteredUsers.length !== usersData.users.length && (
            <span className="text-sm text-muted-foreground">
              of {usersData.users.length} total
            </span>
          )}
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  {hasAnyBusiness && <TableHead className="hidden lg:table-cell">Business</TableHead>}
                  {hasAnyTrade && <TableHead className="hidden xl:table-cell">Trade</TableHead>}
                  <TableHead className="hidden sm:table-cell">Role</TableHead>
                  <TableHead className="hidden md:table-cell whitespace-nowrap">Signup</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="hidden lg:table-cell whitespace-nowrap">Last Active</TableHead>
                  <TableHead className="hidden lg:table-cell">Status</TableHead>
                  <TableHead className="min-w-[120px] pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12">
                      <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell className="pl-6 font-medium">
                        <span className="truncate block max-w-[120px]">{user.name}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        <span className="truncate block max-w-[180px]">{user.email || '-'}</span>
                      </TableCell>
                      {hasAnyBusiness && (
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          <span className="truncate block max-w-[140px]">{user.businessName || '-'}</span>
                        </TableCell>
                      )}
                      {hasAnyTrade && (
                        <TableCell className="hidden xl:table-cell">
                          {user.tradeType ? (
                            <Badge variant="outline" className="capitalize text-xs">
                              {user.tradeType}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className="text-xs capitalize">
                          {user.role || 'Unassigned'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm whitespace-nowrap">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant={getTierBadgeVariant(user.subscriptionTier)} className="capitalize">
                            {user.subscriptionTier || 'free'}
                          </Badge>
                          {user.betaLifetimeAccess && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30 text-xs">
                              Founder
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm whitespace-nowrap">
                        {formatRelativeDate(user.updatedAt)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {user.hasCompletedOnboarding ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30 text-xs">
                              Onboarded
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30 text-xs">
                              Pending
                            </Badge>
                          )}
                          {user.emailVerified && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30 text-xs hidden xl:inline-flex">
                              Verified
                            </Badge>
                          )}
                          {(user as any).websiteFeatures && (
                            <>
                              {(user as any).websiteFeatures.clickToCall && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30 text-xs hidden xl:inline-flex">
                                  Call
                                </Badge>
                              )}
                              {(user as any).websiteFeatures.chatWidget && (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30 text-xs hidden xl:inline-flex">
                                  Chat
                                </Badge>
                              )}
                              {(user as any).websiteFeatures.bookingForm && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30 text-xs hidden xl:inline-flex">
                                  Booking
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(user)}
                            title="Manage account"
                            data-testid={`button-edit-${user.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleImpersonate(user.id)}
                            title="Login as this user"
                            data-testid={`button-impersonate-${user.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <div className="w-px h-5 bg-border mx-1" />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                data-testid={`button-delete-user-${user.id}`}
                              >
                                {deletingUserId === user.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User Account</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete <strong>{user.email}</strong>? 
                                  This will permanently remove their account and all associated data including jobs, invoices, quotes, and clients.
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => {
                                    setDeletingUserId(user.id);
                                    deleteUserMutation.mutate(user.id);
                                  }}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete Account
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12">
                      <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-muted-foreground">
                        {searchQuery || tierFilter !== "all" || statusFilter !== "all" 
                          ? "No users match your filters" 
                          : "No users found"}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!editingUser} onOpenChange={(open) => { if (!open) setEditingUser(null); }}>
        <AlertDialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Manage Account</AlertDialogTitle>
            <AlertDialogDescription>
              {editingUser?.name} ({editingUser?.email})
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Subscription Tier</label>
              <Select value={editTier} onValueChange={setEditTier}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Founding Member</label>
                <p className="text-xs text-muted-foreground">Lifetime free access, bypasses all limits</p>
              </div>
              <Button
                variant={editFoundingMember ? "default" : "outline"}
                size="sm"
                onClick={() => setEditFoundingMember(!editFoundingMember)}
              >
                {editFoundingMember ? "Yes" : "No"}
              </Button>
            </div>
            <AlertDialogFooter className="pb-0">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleSaveUser}
                disabled={updateUserMutation.isPending}
              >
                {updateUserMutation.isPending ? "Saving..." : "Save Account"}
              </AlertDialogAction>
            </AlertDialogFooter>
            {editingUser && (editTier === 'team' || editTier === 'business' || editingUser.subscriptionTier === 'team' || editingUser.subscriptionTier === 'business') && (
              <AdminTeamPanel userId={editingUser.id} />
            )}
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface TeamMember {
  id: string;
  email: string | null;
  memberId: string | null;
  roleId: string | null;
  roleName: string;
  memberName: string;
  memberEmail: string | null;
  inviteStatus: string | null;
  isActive: boolean | null;
  hourlyRate: string | null;
}

interface TeamData {
  members: TeamMember[];
  seatCount: number;
  subscriptionTier: string;
  roles: { id: string; name: string }[];
}

function AdminTeamPanel({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState<string>("none");

  const { data: teamData, isLoading } = useQuery<TeamData>({
    queryKey: ['/api/admin/users', userId, 'team'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/team`, { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load team');
      return res.json();
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ email, roleId }: { email: string; roleId: string | null }) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/team/invite`, { email, roleId });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to invite");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Invited", description: `Invite sent to ${inviteEmail}` });
      setInviteEmail("");
      setInviteRoleId("none");
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users', userId, 'team'] });
    },
    onError: (error: Error) => {
      toast({ title: "Invite Failed", description: error.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/users/${userId}/team/${memberId}`);
      if (!response.ok) throw new Error("Failed to remove member");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Removed", description: "Team member removed" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users', userId, 'team'] });
    },
    onError: (error: Error) => {
      toast({ title: "Remove Failed", description: error.message, variant: "destructive" });
    },
  });

  const seatMutation = useMutation({
    mutationFn: async (seatCount: number) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${userId}/team/seats`, { seatCount });
      if (!response.ok) throw new Error("Failed to update seats");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Updated", description: "Seat count updated" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users', userId, 'team'] });
    },
  });

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    inviteMutation.mutate({ email: inviteEmail.trim(), roleId: inviteRoleId === "none" ? null : inviteRoleId });
  };

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading team...</span>
        </div>
      </Card>
    );
  }

  const members = teamData?.members || [];
  const roles = teamData?.roles || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">Team Management</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {teamData?.seatCount || 0} extra seats
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium whitespace-nowrap">Extra Seats:</label>
          <Input
            type="number"
            min={0}
            defaultValue={teamData?.seatCount || 0}
            className="w-20"
            onBlur={(e) => {
              const val = parseInt(e.target.value) || 0;
              if (val !== (teamData?.seatCount || 0)) seatMutation.mutate(val);
            }}
          />
          <span className="text-xs text-muted-foreground">Additional paid seats beyond base plan</span>
        </div>

        {members.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium text-sm">
                    <span className="truncate block max-w-[120px]">{member.memberName}</span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                    <span className="truncate block max-w-[160px]">{member.memberEmail || '-'}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">{member.roleName}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline"
                      className={
                        member.inviteStatus === 'accepted' 
                          ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30 text-xs"
                          : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30 text-xs"
                      }
                    >
                      {member.inviteStatus || 'pending'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                          <AlertDialogDescription>
                            Remove <strong>{member.memberName}</strong> from this team? They will lose access to all shared jobs and data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => removeMutation.mutate(member.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground py-2">No team members yet.</p>
        )}

        <div className="border-t pt-3 space-y-2">
          <label className="text-sm font-medium">Add Team Member</label>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="worker@email.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 min-w-[180px]"
            />
            {roles.length > 0 && (
              <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Role</SelectItem>
                  {roles.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={handleInvite} disabled={inviteMutation.isPending || !inviteEmail.trim()}>
              {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityView({ 
  usersData,
  stats 
}: { 
  usersData: AdminUsersResponse | undefined;
  stats: AdminStats | undefined;
}) {
  const recentActivity = useMemo(() => {
    if (!usersData?.users) return [];
    
    const activities: Array<{
      id: string;
      type: 'signup' | 'onboarding' | 'upgrade';
      user: string;
      email: string;
      timestamp: string;
      details?: string;
    }> = [];
    
    usersData.users.forEach((user) => {
      if (user.createdAt) {
        activities.push({
          id: `signup-${user.id}`,
          type: 'signup',
          user: user.name,
          email: user.email || '',
          timestamp: user.createdAt,
          details: user.businessName || undefined,
        });
      }
      
      if (user.hasCompletedOnboarding && user.updatedAt && user.updatedAt !== user.createdAt) {
        activities.push({
          id: `onboarding-${user.id}`,
          type: 'onboarding',
          user: user.name,
          email: user.email || '',
          timestamp: user.updatedAt,
        });
      }
      
      if (user.subscriptionTier === 'pro' && user.updatedAt) {
        activities.push({
          id: `upgrade-${user.id}`,
          type: 'upgrade',
          user: user.name,
          email: user.email || '',
          timestamp: user.updatedAt,
        });
      }
    });
    
    return activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ).slice(0, 50);
  }, [usersData?.users]);

  const getActivityConfig = (type: string) => {
    switch (type) {
      case 'signup': 
        return { 
          icon: UserPlus, 
          label: 'New signup',
          iconBg: 'bg-blue-100 dark:bg-blue-500/20',
          iconColor: 'text-blue-600 dark:text-blue-400'
        };
      case 'onboarding': 
        return { 
          icon: CheckCircle2, 
          label: 'Completed onboarding',
          iconBg: 'bg-green-100 dark:bg-green-500/20',
          iconColor: 'text-green-600 dark:text-green-400'
        };
      case 'upgrade': 
        return { 
          icon: TrendingUp, 
          label: 'Upgraded to Pro',
          iconBg: 'bg-amber-100 dark:bg-amber-500/20',
          iconColor: 'text-amber-600 dark:text-amber-400'
        };
      default: 
        return { 
          icon: Activity, 
          label: 'Activity',
          iconBg: 'bg-muted',
          iconColor: 'text-muted-foreground'
        };
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          testId="card-total-jobs"
          title="Jobs Created"
          value={stats?.featureUsage.totalJobs || 0}
          icon={<Briefcase className="h-5 w-5 md:h-6 md:w-6 text-blue-600 dark:text-blue-400" />}
          iconBgClass="bg-blue-100 dark:bg-blue-500/20"
        />
        <KPICard
          testId="card-invoices-sent"
          title="Invoices Sent"
          value={stats?.featureUsage.totalInvoices || 0}
          icon={<Receipt className="h-5 w-5 md:h-6 md:w-6 text-green-600 dark:text-green-400" />}
          iconBgClass="bg-green-100 dark:bg-green-500/20"
        />
        <KPICard
          testId="card-quotes-generated"
          title="Quotes Generated"
          value={stats?.featureUsage.totalQuotes || 0}
          icon={<FileText className="h-5 w-5 md:h-6 md:w-6 text-purple-600 dark:text-purple-400" />}
          iconBgClass="bg-purple-100 dark:bg-purple-500/20"
        />
        <KPICard
          testId="card-clients-added"
          title="Clients Added"
          value={stats?.featureUsage.totalClients || 0}
          icon={<Users className="h-5 w-5 md:h-6 md:w-6 text-amber-600 dark:text-amber-400" />}
          iconBgClass="bg-amber-100 dark:bg-amber-500/20"
        />
      </div>

      <Card data-testid="card-activity-log">
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            Platform Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length > 0 ? (
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
              <div className="space-y-0">
                {recentActivity.map((activity, idx) => {
                  const config = getActivityConfig(activity.type);
                  const Icon = config.icon;
                  return (
                    <div 
                      key={activity.id}
                      className={`relative flex items-start gap-4 py-4 ${idx !== recentActivity.length - 1 ? 'border-b border-border/50' : ''}`}
                      data-testid={`activity-${activity.id}`}
                    >
                      <div className={`relative z-10 h-10 w-10 rounded-xl ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`h-4 w-4 ${config.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        <p className="text-sm font-medium">{config.label}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {activity.user}
                          {activity.email && (
                            <span className="hidden sm:inline"> ({activity.email})</span>
                          )}
                        </p>
                        {activity.details && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                            {activity.details}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0 pt-1">
                        <Clock className="h-3 w-3" />
                        <span className="hidden sm:inline">{formatRelativeDate(activity.timestamp)}</span>
                        <span className="sm:hidden">{formatRelativeDate(activity.timestamp).split(' ')[0]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground font-medium">No recent activity</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Activity will appear here as users interact with the platform</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface HealthData {
  api: { status: string; latency: number; avgResponseTime: number };
  database: { status: string; latency: number; connections: number };
  backgroundJobs: { status: string; pending: number };
  storage: { status: string; used: string };
  metrics: { totalUsers: number; totalJobs: number; errorRate: number; activeSessions: number };
}

function HealthView() {
  const { data: health, isLoading } = useQuery<HealthData>({
    queryKey: ['/api/admin/health'],
  });

  const { data: systemEventsData } = useQuery<SystemEventsResponse>({
    queryKey: ['/api/admin/system-events'],
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'healthy': 
        return { 
          icon: CheckCircle2, 
          iconColor: 'text-green-600 dark:text-green-400',
          badgeBg: 'bg-green-100 dark:bg-green-500/20',
          badgeText: 'text-green-700 dark:text-green-400',
          label: 'Healthy'
        };
      case 'degraded': 
        return { 
          icon: AlertTriangle, 
          iconColor: 'text-amber-600 dark:text-amber-400',
          badgeBg: 'bg-amber-100 dark:bg-amber-500/20',
          badgeText: 'text-amber-700 dark:text-amber-400',
          label: 'Degraded'
        };
      case 'down': 
        return { 
          icon: XCircle, 
          iconColor: 'text-red-600 dark:text-red-400',
          badgeBg: 'bg-red-100 dark:bg-red-500/20',
          badgeText: 'text-red-700 dark:text-red-400',
          label: 'Down'
        };
      default: 
        return { 
          icon: Activity, 
          iconColor: 'text-muted-foreground',
          badgeBg: 'bg-muted',
          badgeText: 'text-muted-foreground',
          label: 'Unknown'
        };
    }
  };

  const healthMetrics = [
    { name: "API Server", status: health?.api.status || 'unknown', latency: health ? `${health.api.latency}ms` : '...', icon: Server },
    { name: "Database", status: health?.database.status || 'unknown', latency: health ? `${health.database.latency}ms` : '...', icon: Database },
    { name: "Background Jobs", status: health?.backgroundJobs.status || 'unknown', latency: health ? `${health.backgroundJobs.pending} pending` : '...', icon: Cpu },
    { name: "File Storage", status: health?.storage.status || 'unknown', latency: health?.storage.used || '...', icon: HardDrive },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          testId="card-api-latency"
          title="API Latency"
          value={isLoading ? '...' : `${health?.api.avgResponseTime || 0}ms`}
          loading={isLoading}
          icon={<Zap className="h-5 w-5 md:h-6 md:w-6 text-blue-600 dark:text-blue-400" />}
          iconBgClass="bg-blue-100 dark:bg-blue-500/20"
        />
        <KPICard
          testId="card-db-latency"
          title="DB Latency"
          value={isLoading ? '...' : `${health?.database.latency || 0}ms`}
          loading={isLoading}
          icon={<Database className="h-5 w-5 md:h-6 md:w-6 text-green-600 dark:text-green-400" />}
          iconBgClass="bg-green-100 dark:bg-green-500/20"
        />
        <KPICard
          testId="card-total-users-health"
          title="Total Users"
          value={isLoading ? '...' : (health?.metrics.totalUsers || 0)}
          loading={isLoading}
          icon={<Users className="h-5 w-5 md:h-6 md:w-6 text-purple-600 dark:text-purple-400" />}
          iconBgClass="bg-purple-100 dark:bg-purple-500/20"
        />
        <KPICard
          testId="card-total-jobs-health"
          title="Total Jobs"
          value={isLoading ? '...' : (health?.metrics.totalJobs || 0)}
          loading={isLoading}
          icon={<Briefcase className="h-5 w-5 md:h-6 md:w-6 text-amber-600 dark:text-amber-400" />}
          iconBgClass="bg-amber-100 dark:bg-amber-500/20"
        />
      </div>

      <Card data-testid="card-system-status">
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-muted-foreground" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-1">
              {healthMetrics.map((metric, idx) => {
                const Icon = metric.icon;
                const statusConfig = getStatusConfig(metric.status);
                const StatusIcon = statusConfig.icon;
                return (
                  <div 
                    key={metric.name}
                    className={`flex items-center justify-between py-3 ${idx !== healthMetrics.length - 1 ? 'border-b' : ''}`}
                    data-testid={`health-metric-${metric.name.toLowerCase().replace(' ', '-')}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{metric.name}</p>
                        <p className="text-xs text-muted-foreground">{metric.latency}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusIcon className={`h-4 w-4 ${statusConfig.iconColor}`} />
                      <span className={`text-xs font-medium px-2 py-1 rounded-md ${statusConfig.badgeBg} ${statusConfig.badgeText}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {systemEventsData && systemEventsData.events.length > 0 && (
        <Card data-testid="card-system-events">
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              Recent System Events
              <div className="flex gap-2 ml-auto">
                {Object.entries(systemEventsData.summary).map(([source, data]) => (
                  data.errors > 0 ? (
                    <Badge key={source} variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30 capitalize">
                      {source}: {data.errors} errors
                    </Badge>
                  ) : null
                ))}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {systemEventsData.events.slice(0, 20).map((event, idx) => {
                const severityConfig: Record<string, { icon: typeof CheckCircle2; color: string }> = {
                  info: { icon: Activity, color: 'text-blue-500' },
                  warning: { icon: AlertTriangle, color: 'text-amber-500' },
                  error: { icon: XCircle, color: 'text-red-500' },
                  critical: { icon: XCircle, color: 'text-red-600' },
                };
                const config = severityConfig[event.severity] || severityConfig.info;
                const SevIcon = config.icon;
                return (
                  <div
                    key={event.id}
                    className={`flex items-start gap-3 py-3 ${idx !== Math.min(19, systemEventsData.events.length - 1) ? 'border-b' : ''}`}
                  >
                    <SevIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${config.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs capitalize">{event.source}</Badge>
                        <Badge variant="outline" className="text-xs capitalize">{event.severity}</Badge>
                      </div>
                      <p className="text-sm mt-1">{event.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatRelativeDate(event.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface WebsiteChangeRequest {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  assignedTo: string | null;
  userName: string;
  createdAt: string;
  updatedAt: string;
}

function KanbanView() {
  const { toast } = useToast();
  const [newTitle, setNewTitle] = useState("");

  const { data: requests = [], isLoading } = useQuery<WebsiteChangeRequest[]>({
    queryKey: ['/api/admin/website-change-requests'],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/website-change-requests/${id}`, { status });
      if (!response.ok) throw new Error('Failed to update');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/website-change-requests'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest("POST", `/api/admin/website-change-requests`, { title });
      if (!response.ok) throw new Error('Failed to create');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/website-change-requests'] });
      setNewTitle("");
      toast({ title: "Request Created", description: "New change request added to To Do" });
    },
  });

  const columns = [
    { key: 'todo', label: 'To Do', color: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' },
    { key: 'in_progress', label: 'In Progress', color: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' },
    { key: 'done', label: 'Done', color: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' },
  ];

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('requestId', id);
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('requestId');
    if (id) {
      updateMutation.mutate({ id, status });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const getPriorityBadge = (priority: string | null) => {
    switch (priority) {
      case 'high': return <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30">High</Badge>;
      case 'medium': return <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30">Medium</Badge>;
      case 'low': return <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30">Low</Badge>;
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Add new change request..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="flex-1 min-w-[200px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTitle.trim()) {
                createMutation.mutate(newTitle.trim());
              }
            }}
          />
          <Button
            onClick={() => newTitle.trim() && createMutation.mutate(newTitle.trim())}
            disabled={!newTitle.trim() || createMutation.isPending}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Request
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {columns.map((col) => {
            const colRequests = requests.filter(r => r.status === col.key);
            return (
              <div
                key={col.key}
                className="space-y-3"
                onDrop={(e) => handleDrop(e, col.key)}
                onDragOver={handleDragOver}
                data-testid={`kanban-column-${col.key}`}
              >
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={`${col.color} font-medium`}>
                    {col.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{colRequests.length}</span>
                </div>
                <div className="space-y-2 min-h-[200px] p-2 rounded-lg border border-dashed border-border/60">
                  {colRequests.map((request) => (
                    <Card
                      key={request.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, request.id)}
                      className="cursor-grab active:cursor-grabbing hover-elevate"
                      data-testid={`kanban-card-${request.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{request.title}</p>
                            {request.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{request.description}</p>
                            )}
                            <div className="flex items-center flex-wrap gap-1.5 mt-2">
                              {getPriorityBadge(request.priority)}
                              <span className="text-xs text-muted-foreground">{request.userName}</span>
                            </div>
                          </div>
                        </div>
                        {col.key !== 'done' && (
                          <div className="flex justify-end mt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={() => updateMutation.mutate({
                                id: request.id,
                                status: col.key === 'todo' ? 'in_progress' : 'done',
                              })}
                            >
                              <ArrowRight className="h-3 w-3 mr-1" />
                              {col.key === 'todo' ? 'Start' : 'Complete'}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {colRequests.length === 0 && (
                    <div className="flex items-center justify-center py-8 text-muted-foreground/50 text-sm">
                      Drop cards here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface AiQueueItem {
  id: string;
  userId: string;
  vapiAssistantId: string | null;
  greeting: string | null;
  mode: string;
  voiceName: string | null;
  enabled: boolean;
  approvalStatus: string;
  userName: string;
  userEmail: string | null;
  businessName: string | null;
  businessPhone: string | null;
  tradeType: string | null;
  voiceStability: number | null;
  voiceClarity: number | null;
  voiceSpeed: number | null;
  voiceStyleExaggeration: number | null;
  voiceSpeakerBoost: boolean | null;
  voicemailDetectionEnabled: boolean | null;
  silenceTimeoutSeconds: number | null;
  maxCallDurationSeconds: number | null;
  backgroundSound: string | null;
  dedicatedPhoneNumber: string | null;
  transferNumbers: string[] | null;
}

interface ActiveAssistant extends AiQueueItem {
  autoReplyEnabled?: boolean;
  label?: string | null;
  allNumbers?: Array<{
    id: string;
    dedicatedPhoneNumber: string | null;
    label: string | null;
    enabled: boolean;
    mode: string | null;
    voiceName: string | null;
  }>;
  callStats: {
    totalCalls: number;
    completedCalls: number;
    avgDuration: number;
    outcomeBreakdown: Record<string, number>;
  };
}

function VoiceTuningSlider({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-mono tabular-nums">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
}

interface AdminCallLog {
  id: string;
  userId: string;
  vapiCallId: string;
  callerPhone: string | null;
  callerName: string | null;
  status: string;
  duration: number | null;
  summary: string | null;
  transcript: string | null;
  recordingUrl: string | null;
  outcome: string | null;
  callerIntent: string | null;
  sentiment: string | null;
  sentimentScore: number | null;
  createdAt: string;
}

function SentimentBadge({ sentiment }: { sentiment: string | null }) {
  const config: Record<string, { label: string; classes: string }> = {
    positive: { label: 'Positive', classes: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30' },
    neutral: { label: 'Neutral', classes: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/30' },
    negative: { label: 'Negative', classes: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30' },
  };
  const c = config[sentiment || ''] || config.neutral;
  return (
    <Badge variant="outline" className={c.classes}>
      {c.label}
    </Badge>
  );
}

function AudioPlayer({ url }: { url: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useMemo(() => {
    if (typeof window !== 'undefined') {
      const a = new window.Audio(url);
      a.addEventListener('ended', () => setIsPlaying(false));
      return a;
    }
    return null;
  }, [url]);

  const toggle = () => {
    if (!audioRef) return;
    if (isPlaying) {
      audioRef.pause();
      setIsPlaying(false);
    } else {
      audioRef.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  return (
    <Button size="icon" variant="ghost" onClick={toggle} data-testid="btn-play-recording">
      {isPlaying ? <Phone className="h-4 w-4 text-primary animate-pulse" /> : <Phone className="h-4 w-4" />}
    </Button>
  );
}

function CallMonitoringView() {
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");

  const queryParams = new URLSearchParams();
  queryParams.set('limit', '100');
  if (sentimentFilter !== 'all') queryParams.set('sentiment', sentimentFilter);
  if (sortBy === 'sentiment') queryParams.set('sortBy', 'sentiment');

  const { data: calls = [], isLoading } = useQuery<AdminCallLog[]>({
    queryKey: ['/api/admin/ai-calls', sentimentFilter, sortBy],
    queryFn: async () => {
      const res = await fetch(`/api/admin/ai-calls?${queryParams.toString()}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch calls');
      return res.json();
    },
  });

  const sentimentCounts = useMemo(() => {
    const counts = { positive: 0, neutral: 0, negative: 0 };
    calls.forEach(c => {
      const s = c.sentiment as keyof typeof counts;
      if (s && counts[s] !== undefined) counts[s]++;
    });
    return counts;
  }, [calls]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <KPICard
          testId="card-negative-calls"
          title="Negative Calls"
          value={sentimentCounts.negative}
          loading={isLoading}
          icon={<AlertTriangle className="h-5 w-5 md:h-6 md:w-6 text-red-600 dark:text-red-400" />}
          iconBgClass="bg-red-100 dark:bg-red-500/20"
        />
        <KPICard
          testId="card-neutral-calls"
          title="Neutral Calls"
          value={sentimentCounts.neutral}
          loading={isLoading}
          icon={<Phone className="h-5 w-5 md:h-6 md:w-6 text-gray-600 dark:text-gray-400" />}
          iconBgClass="bg-gray-100 dark:bg-gray-500/20"
        />
        <KPICard
          testId="card-positive-calls"
          title="Positive Calls"
          value={sentimentCounts.positive}
          loading={isLoading}
          icon={<CheckCircle2 className="h-5 w-5 md:h-6 md:w-6 text-green-600 dark:text-green-400" />}
          iconBgClass="bg-green-100 dark:bg-green-500/20"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base md:text-lg">Call Recordings & Sentiment</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sentiment</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="positive">Positive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="sentiment">Urgent First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Caller</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Sentiment</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead className="hidden md:table-cell">Summary</TableHead>
                  <TableHead className="pr-6">Recording</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : calls.length > 0 ? (
                  calls.map((call) => (
                    <TableRow key={call.id} data-testid={`row-call-${call.id}`}>
                      <TableCell className="pl-6 font-medium">
                        <div>
                          <p className="truncate max-w-[150px]">{call.callerName || 'Unknown'}</p>
                          {call.callerPhone && (
                            <p className="text-xs text-muted-foreground">{call.callerPhone}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {call.createdAt ? formatDate(call.createdAt) : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : '-'}
                      </TableCell>
                      <TableCell>
                        <SentimentBadge sentiment={call.sentiment} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{call.outcome || 'unknown'}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <p className="text-xs text-muted-foreground truncate max-w-[250px]">{call.summary || '-'}</p>
                      </TableCell>
                      <TableCell className="pr-6">
                        {call.recordingUrl ? (
                          <AudioPlayer url={call.recordingUrl} />
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <Phone className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No call recordings found</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AIApprovalView() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    greeting: string;
    voiceStability: number;
    voiceClarity: number;
    voiceSpeed: number;
    mode: string;
    voiceName: string;
  }>({ greeting: '', voiceStability: 0.5, voiceClarity: 0.75, voiceSpeed: 1.0, mode: 'off', voiceName: 'Jess' });

  const [expandedAssistant, setExpandedAssistant] = useState<string | null>(null);
  const [assistantEditForm, setAssistantEditForm] = useState<{
    greeting: string;
    voiceStability: number;
    voiceClarity: number;
    voiceSpeed: number;
    mode: string;
    voiceName: string;
  }>({ greeting: '', voiceStability: 0.5, voiceClarity: 0.75, voiceSpeed: 1.0, mode: 'off', voiceName: 'Jess' });

  const { data: queue = [], isLoading } = useQuery<AiQueueItem[]>({
    queryKey: ['/api/admin/ai-approval-queue'],
  });

  const { data: activeAssistants = [], isLoading: assistantsLoading } = useQuery<ActiveAssistant[]>({
    queryKey: ['/api/admin/ai-active-assistants'],
  });

  const approveMutation = useMutation({
    mutationFn: async (payload: { configId: string; approvalStatus: string; greeting?: string; voiceStability?: number; voiceClarity?: number; voiceSpeed?: number; mode?: string; voiceName?: string }) => {
      const { configId, ...body } = payload;
      const response = await apiRequest("PATCH", `/api/admin/ai-approval/${configId}`, body);
      if (!response.ok) throw new Error('Failed to update');
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-approval-queue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-active-assistants'] });
      toast({
        title: variables.approvalStatus === 'active' ? "Approved & Activated" : "Status Updated",
        description: variables.approvalStatus === 'active' ? "AI Receptionist is now live" : "Status has been updated",
      });
      setEditingId(null);
      setExpandedAssistant(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const startEditing = (item: AiQueueItem) => {
    setEditingId(item.id);
    setEditForm({
      greeting: item.greeting || `G'day, thanks for calling ${item.businessName || 'the business'}. How can I help you today?`,
      voiceStability: item.voiceStability ?? 0.5,
      voiceClarity: item.voiceClarity ?? 0.75,
      voiceSpeed: item.voiceSpeed ?? 1.0,
      mode: item.mode || 'off',
      voiceName: item.voiceName || 'Jess',
    });
  };

  const startEditingAssistant = (item: ActiveAssistant) => {
    setExpandedAssistant(item.id);
    setAssistantEditForm({
      greeting: item.greeting || '',
      voiceStability: item.voiceStability ?? 0.5,
      voiceClarity: item.voiceClarity ?? 0.75,
      voiceSpeed: item.voiceSpeed ?? 1.0,
      mode: item.mode || 'off',
      voiceName: item.voiceName || 'Jess',
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          testId="card-pending-approvals"
          title="Pending Approvals"
          value={queue.length}
          loading={isLoading}
          icon={<Bot className="h-5 w-5 md:h-6 md:w-6 text-amber-600 dark:text-amber-400" />}
          iconBgClass="bg-amber-100 dark:bg-amber-500/20"
        />
        <KPICard
          testId="card-ai-queue-total"
          title="Queue Status"
          value={isLoading ? '...' : (queue.length > 0 ? 'Needs Review' : 'All Clear')}
          loading={isLoading}
          icon={<CheckCircle2 className="h-5 w-5 md:h-6 md:w-6 text-green-600 dark:text-green-400" />}
          iconBgClass="bg-green-100 dark:bg-green-500/20"
        />
        <KPICard
          testId="card-active-assistants-count"
          title="Active Assistants"
          value={activeAssistants.length}
          loading={assistantsLoading}
          icon={<Phone className="h-5 w-5 md:h-6 md:w-6 text-blue-600 dark:text-blue-400" />}
          iconBgClass="bg-blue-100 dark:bg-blue-500/20"
        />
        <KPICard
          testId="card-total-ai-calls"
          title="Total AI Calls"
          value={activeAssistants.reduce((sum, a) => sum + a.callStats.totalCalls, 0)}
          loading={assistantsLoading}
          icon={<PhoneIncoming className="h-5 w-5 md:h-6 md:w-6 text-purple-600 dark:text-purple-400" />}
          iconBgClass="bg-purple-100 dark:bg-purple-500/20"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <Bot className="h-5 w-5 text-muted-foreground" />
            AI Receptionist Approval Queue
            {queue.length > 0 && <Badge variant="secondary">{queue.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : queue.length === 0 ? (
            <div className="text-center py-12">
              <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground font-medium">No pending approvals</p>
              <p className="text-sm text-muted-foreground/70 mt-1">New AI Receptionists will appear here for review</p>
            </div>
          ) : (
            <div className="space-y-4">
              {queue.map((item) => (
                <Card key={item.id} className="hover-elevate" data-testid={`ai-queue-item-${item.id}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{item.businessName || item.userName}</p>
                          <p className="text-sm text-muted-foreground">{item.userEmail}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {item.tradeType && (
                              <Badge variant="outline" className="text-xs capitalize">{item.tradeType}</Badge>
                            )}
                            {item.businessPhone && (
                              <Badge variant="outline" className="text-xs">{item.businessPhone}</Badge>
                            )}
                            <Badge variant="outline" className="text-xs capitalize">{item.mode}</Badge>
                            <Badge variant="outline" className="text-xs">{item.voiceName || 'Jess'}</Badge>
                          </div>
                        </div>
                        <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex-shrink-0">
                          Pending
                        </Badge>
                      </div>

                      {editingId === item.id ? (
                        <div className="space-y-4 bg-muted/50 rounded-md p-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">AI Greeting</p>
                            <Input
                              value={editForm.greeting}
                              onChange={(e) => setEditForm(f => ({ ...f, greeting: e.target.value }))}
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">Voice Tuning</p>
                            <div className="grid gap-3 sm:grid-cols-3">
                              <VoiceTuningSlider label="Stability" value={editForm.voiceStability} onChange={(v) => setEditForm(f => ({ ...f, voiceStability: v }))} min={0} max={1} step={0.05} />
                              <VoiceTuningSlider label="Clarity" value={editForm.voiceClarity} onChange={(v) => setEditForm(f => ({ ...f, voiceClarity: v }))} min={0} max={1} step={0.05} />
                              <VoiceTuningSlider label="Speed" value={editForm.voiceSpeed} onChange={(v) => setEditForm(f => ({ ...f, voiceSpeed: v }))} min={0.25} max={4} step={0.25} />
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => {
                              approveMutation.mutate({
                                configId: item.id,
                                approvalStatus: 'active',
                                greeting: editForm.greeting,
                                voiceStability: editForm.voiceStability,
                                voiceClarity: editForm.voiceClarity,
                                voiceSpeed: editForm.voiceSpeed,
                              });
                            }} disabled={approveMutation.isPending}>
                              {approveMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                              Save & Approve
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-muted/50 rounded-md p-3">
                          <p className="text-xs text-muted-foreground mb-1">AI Greeting</p>
                          <p className="text-sm">
                            {item.greeting || `G'day, thanks for calling ${item.businessName || 'the business'}. How can I help you today?`}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(item)}
                        >
                          <Edit className="h-3.5 w-3.5 mr-1.5" />
                          Edit & Tune
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => approveMutation.mutate({ configId: item.id, approvalStatus: 'disabled' })}
                          disabled={approveMutation.isPending}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate({ configId: item.id, approvalStatus: 'active' })}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                          Approve & Activate
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-active-assistants">
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            Active Assistants
            {activeAssistants.length > 0 && <Badge variant="secondary">{activeAssistants.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assistantsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeAssistants.length === 0 ? (
            <div className="text-center py-12">
              <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground font-medium">No active assistants</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Approved AI receptionists will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeAssistants.map((assistant) => (
                <Card key={assistant.id} className="hover-elevate" data-testid={`active-assistant-${assistant.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{assistant.businessName || assistant.userName}</p>
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30">
                            Active
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{assistant.userEmail}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="outline" className="text-xs capitalize">{assistant.mode}</Badge>
                          <Badge variant="outline" className="text-xs">
                            <Mic className="h-3 w-3 mr-1" />
                            {assistant.voiceName || 'Jess'}
                          </Badge>
                          {assistant.allNumbers && assistant.allNumbers.length > 1 ? (
                            assistant.allNumbers.map((num, idx) => (
                              <Badge key={num.id || idx} variant="outline" className="text-xs">
                                <Phone className="h-3 w-3 mr-1" />
                                {num.label ? `${num.label}: ` : ''}{num.dedicatedPhoneNumber || 'N/A'}
                              </Badge>
                            ))
                          ) : assistant.dedicatedPhoneNumber ? (
                            <Badge variant="outline" className="text-xs">
                              <Phone className="h-3 w-3 mr-1" />
                              {assistant.label ? `${assistant.label}: ` : ''}{assistant.dedicatedPhoneNumber}
                            </Badge>
                          ) : null}
                          <Badge
                            variant="outline"
                            className={`text-xs ${assistant.autoReplyEnabled !== false
                              ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30'
                              : 'bg-muted text-muted-foreground'}`}
                          >
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Auto-Reply {assistant.autoReplyEnabled !== false ? 'On' : 'Off'}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-muted-foreground">{assistant.callStats.totalCalls} calls</span>
                          <span className="text-muted-foreground">avg {assistant.callStats.avgDuration}s</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => expandedAssistant === assistant.id ? setExpandedAssistant(null) : startEditingAssistant(assistant)}
                        >
                          <Edit className="h-3.5 w-3.5 mr-1.5" />
                          {expandedAssistant === assistant.id ? 'Collapse' : 'Edit'}
                        </Button>
                      </div>
                    </div>

                    {assistant.callStats.totalCalls > 0 && (
                      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t">
                        {Object.entries(assistant.callStats.outcomeBreakdown).map(([outcome, count]) => (
                          <div key={outcome} className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground capitalize">{outcome.replace(/_/g, ' ')}:</span>
                            <span className="text-xs font-semibold tabular-nums">{count}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {expandedAssistant === assistant.id && (
                      <div className="mt-4 pt-4 border-t space-y-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Greeting</p>
                          <Input
                            value={assistantEditForm.greeting}
                            onChange={(e) => setAssistantEditForm(f => ({ ...f, greeting: e.target.value }))}
                            className="text-sm"
                          />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Mode</p>
                            <Select value={assistantEditForm.mode} onValueChange={(v) => setAssistantEditForm(f => ({ ...f, mode: v }))}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="off">Off</SelectItem>
                                <SelectItem value="after_hours">After Hours</SelectItem>
                                <SelectItem value="always_on_transfer">Always On (Transfer)</SelectItem>
                                <SelectItem value="always_on_message">Always On (Message)</SelectItem>
                                <SelectItem value="selective">Selective</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Voice</p>
                            <Input
                              value={assistantEditForm.voiceName}
                              onChange={(e) => setAssistantEditForm(f => ({ ...f, voiceName: e.target.value }))}
                              className="text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Voice Tuning</p>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <VoiceTuningSlider label="Stability" value={assistantEditForm.voiceStability} onChange={(v) => setAssistantEditForm(f => ({ ...f, voiceStability: v }))} min={0} max={1} step={0.05} />
                            <VoiceTuningSlider label="Clarity" value={assistantEditForm.voiceClarity} onChange={(v) => setAssistantEditForm(f => ({ ...f, voiceClarity: v }))} min={0} max={1} step={0.05} />
                            <VoiceTuningSlider label="Speed" value={assistantEditForm.voiceSpeed} onChange={(v) => setAssistantEditForm(f => ({ ...f, voiceSpeed: v }))} min={0.25} max={4} step={0.25} />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => {
                            approveMutation.mutate({
                              configId: assistant.id,
                              approvalStatus: 'active',
                              greeting: assistantEditForm.greeting,
                              voiceStability: assistantEditForm.voiceStability,
                              voiceClarity: assistantEditForm.voiceClarity,
                              voiceSpeed: assistantEditForm.voiceSpeed,
                              mode: assistantEditForm.mode,
                              voiceName: assistantEditForm.voiceName,
                            });
                          }} disabled={approveMutation.isPending}>
                            {approveMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                            Save Changes
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                            approveMutation.mutate({ configId: assistant.id, approvalStatus: 'disabled' });
                          }} disabled={approveMutation.isPending}>
                            Disable
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setExpandedAssistant(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <VoiceRequestsPanel />
    </div>
  );
}

interface AdminVoiceRequest {
  id: string;
  userId: string;
  requestedDescription: string;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  userName: string;
  businessName: string | null;
}

function VoiceRequestsPanel() {
  const { toast } = useToast();
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState("");

  const { data: requests = [], isLoading } = useQuery<AdminVoiceRequest[]>({
    queryKey: ['/api/admin/voice-change-requests'],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: string; status: string; adminNotes?: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/voice-change-requests/${id}`, { status, adminNotes });
      if (!response.ok) throw new Error('Failed to update');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/voice-change-requests'] });
      toast({ title: "Updated", description: "Voice request status updated" });
      setEditingNotes(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const pending = requests.filter(r => r.status === 'pending' || r.status === 'in_progress');

  const statusColor = (status: string) => {
    switch (status) {
      case 'resolved': return "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0";
      case 'in_progress': return "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-0";
      case 'rejected': return "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-0";
      default: return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-0";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base md:text-lg flex items-center gap-2">
          <Mic className="h-5 w-5 text-muted-foreground" />
          Voice Change Requests
          {pending.length > 0 && (
            <Badge variant="secondary" className="ml-auto">{pending.length} pending</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12">
            <Mic className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground font-medium">No voice requests</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Custom voice requests from users will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => (
              <Card key={req.id} className="hover-elevate" data-testid={`voice-request-${req.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{req.businessName || req.userName}</p>
                        <p className="text-sm text-muted-foreground mt-1">{req.requestedDescription}</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(req.createdAt).toLocaleDateString()}</p>
                      </div>
                      <Badge variant="outline" className={statusColor(req.status)}>
                        {req.status === 'in_progress' ? 'In Progress' : req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </Badge>
                    </div>

                    {editingNotes === req.id ? (
                      <div className="space-y-2">
                        <Input
                          value={notesText}
                          onChange={(e) => setNotesText(e.target.value)}
                          placeholder="Add admin notes..."
                          className="text-sm"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => updateMutation.mutate({ id: req.id, status: req.status, adminNotes: notesText })}>
                            Save Notes
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingNotes(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : req.adminNotes ? (
                      <div className="bg-muted/50 rounded-md p-3">
                        <p className="text-xs text-muted-foreground mb-1">Admin Notes</p>
                        <p className="text-sm">{req.adminNotes}</p>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      <Button variant="ghost" size="sm" onClick={() => { setEditingNotes(req.id); setNotesText(req.adminNotes || ""); }}>
                        <Edit className="h-3.5 w-3.5 mr-1.5" />
                        Notes
                      </Button>
                      {req.status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: req.id, status: 'in_progress' })} disabled={updateMutation.isPending}>
                          In Progress
                        </Button>
                      )}
                      {(req.status === 'pending' || req.status === 'in_progress') && (
                        <>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => updateMutation.mutate({ id: req.id, status: 'rejected' })} disabled={updateMutation.isPending}>
                            Reject
                          </Button>
                          <Button size="sm" onClick={() => updateMutation.mutate({ id: req.id, status: 'resolved' })} disabled={updateMutation.isPending}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                            Resolve
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SystemEventItem {
  id: string;
  eventType: string;
  severity: string;
  source: string;
  message: string;
  metadata: any;
  userId: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface SystemEventsResponse {
  events: SystemEventItem[];
  summary: {
    stripe: { count: number; errors: number };
    twilio: { count: number; errors: number };
    vapi: { count: number; errors: number };
    system: { count: number; errors: number };
  };
}

interface RevenueData {
  mrr: number;
  arr: number;
  totalRevenue: number;
  proPrice: number;
  subscribers: {
    pro: number;
    trial: number;
    free: number;
    total: number;
  };
  trialConversionRate: number;
  avgRevenuePerUser: number;
  recentProConversions: number;
  monthlyData: Array<{ month: string; mrr: number; subscribers: number; newUsers: number }>;
  topUsers: Array<{ id: string; name: string; email: string; tier: string; joinedAt: string }>;
}

function RevenueView() {
  const { data: revenue, isLoading } = useQuery<RevenueData>({
    queryKey: ['/api/admin/revenue'],
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          testId="card-mrr"
          title="Monthly Revenue (MRR)"
          value={isLoading ? '...' : `$${(revenue?.mrr || 0).toLocaleString()}`}
          loading={isLoading}
          icon={<DollarSign className="h-5 w-5 md:h-6 md:w-6 text-green-600 dark:text-green-400" />}
          iconBgClass="bg-green-100 dark:bg-green-500/20"
        />
        <KPICard
          testId="card-arr"
          title="Annual Revenue (ARR)"
          value={isLoading ? '...' : `$${(revenue?.arr || 0).toLocaleString()}`}
          loading={isLoading}
          icon={<TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-blue-600 dark:text-blue-400" />}
          iconBgClass="bg-blue-100 dark:bg-blue-500/20"
        />
        <KPICard
          testId="card-pro-subscribers"
          title="Pro Subscribers"
          value={isLoading ? '...' : (revenue?.subscribers.pro || 0)}
          loading={isLoading}
          icon={<UserCheck className="h-5 w-5 md:h-6 md:w-6 text-amber-600 dark:text-amber-400" />}
          iconBgClass="bg-amber-100 dark:bg-amber-500/20"
        />
        <KPICard
          testId="card-trial-conversion"
          title="Trial Conversion"
          value={isLoading ? '...' : `${revenue?.trialConversionRate || 0}%`}
          loading={isLoading}
          icon={<Target className="h-5 w-5 md:h-6 md:w-6 text-purple-600 dark:text-purple-400" />}
          iconBgClass="bg-purple-100 dark:bg-purple-500/20"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-mrr-chart">
          <CardHeader className="pb-2">
            <CardTitle className="text-base md:text-lg">MRR Trend (12 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] md:h-[260px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenue?.monthlyData || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => {
                        if (name === 'mrr') return [`$${value}`, 'MRR'];
                        return [value, name];
                      }}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Bar dataKey="mrr" fill="hsl(142, 70%, 45%)" radius={[4, 4, 0, 0]} name="mrr" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-subscriber-breakdown">
          <CardHeader className="pb-2">
            <CardTitle className="text-base md:text-lg">Subscriber Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: "Pro ($49.99/mo)", value: revenue?.subscribers.pro || 0, color: "bg-green-500", pct: revenue?.subscribers.total ? Math.round(((revenue?.subscribers.pro || 0) / revenue.subscribers.total) * 100) : 0 },
                { label: "Trial", value: revenue?.subscribers.trial || 0, color: "bg-blue-500", pct: revenue?.subscribers.total ? Math.round(((revenue?.subscribers.trial || 0) / revenue.subscribers.total) * 100) : 0 },
                { label: "Free", value: revenue?.subscribers.free || 0, color: "bg-muted-foreground/40", pct: revenue?.subscribers.total ? Math.round(((revenue?.subscribers.free || 0) / revenue.subscribers.total) * 100) : 0 },
              ].map((tier) => (
                <div key={tier.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span>{tier.label}</span>
                    <span className="font-semibold tabular-nums">{isLoading ? '...' : `${tier.value} (${tier.pct}%)`}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${tier.color} transition-all duration-500`}
                      style={{ width: `${tier.pct}%` }}
                    />
                  </div>
                </div>
              ))}

              <div className="border-t pt-4 mt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Avg Revenue/User</span>
                  <span className="font-semibold">${isLoading ? '...' : (revenue?.avgRevenuePerUser || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">New Pro (30d)</span>
                  <span className="font-semibold">{isLoading ? '...' : (revenue?.recentProConversions || 0)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Users</span>
                  <span className="font-semibold">{isLoading ? '...' : (revenue?.subscribers.total || 0)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {revenue?.topUsers && revenue.topUsers.length > 0 && (
        <Card data-testid="card-pro-users-list">
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-lg">Pro Subscribers</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="pr-6 hidden md:table-cell">Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenue.topUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="pl-6 font-medium">
                        <span className="truncate block max-w-[150px]">{user.name}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        <span className="truncate block max-w-[200px]">{user.email || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" className="capitalize">{user.tier}</Badge>
                      </TableCell>
                      <TableCell className="pr-6 hidden md:table-cell text-muted-foreground text-sm">
                        {formatDate(user.joinedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface CommsStats {
  sms: {
    total: number;
    last30d: number;
    last7d: number;
    inbound: number;
    outbound: number;
    delivered: number;
    failed: number;
    jobRequests: number;
    dailyData: Array<{ date: string; inbound: number; outbound: number }>;
  };
  conversations: { total: number };
  calls: {
    total: number;
    last30d: number;
    last7d: number;
    completed: number;
    missed: number;
    transferred: number;
    leadsCreated: number;
    avgDuration: number;
    totalCost: number;
    outcomes: Record<string, number>;
  };
  leads: {
    total: number;
    last30d: number;
    bySource: Record<string, number>;
    byStatus: Record<string, number>;
    newLeads: number;
    wonLeads: number;
    conversionRate: number;
    totalEstimatedValue: number;
  };
}

interface EmailLogRow {
  id: string;
  recipientEmail: string;
  subject: string | null;
  type: string | null;
  status: string;
  retryCount: number | null;
  maxRetries: number | null;
  permanentlyFailed: boolean | null;
  errorMessage: string | null;
  nextRetryAt: string | null;
  createdAt: string;
}

const PAGE_SIZE = 50;

function EmailLogsView() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [page, setPage] = useState(1);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (recipientSearch.trim()) params.set('recipient', recipientSearch.trim());
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String((page - 1) * PAGE_SIZE));
    return params.toString();
  }, [statusFilter, recipientSearch, page]);

  const { data, isLoading, refetch } = useQuery<{ logs: EmailLogRow[]; total: number }>({
    queryKey: ['/api/admin/email-logs', queryParams],
    queryFn: async () => {
      const { getSessionToken } = await import('@/lib/queryClient');
      const token = getSessionToken();
      const res = await fetch(`/api/admin/email-logs?${queryParams}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error('Failed to load email logs');
      const total = parseInt(res.headers.get('X-Total-Count') || '0', 10);
      const json = await res.json();
      const logs = Array.isArray(json) ? json : (json.logs || []);
      return { logs, total };
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/admin/email-logs/${id}/retry`);
    },
    onSuccess: () => {
      toast({ title: 'Queued for retry', description: 'The email will retry on the next scheduler tick.' });
      refetch();
    },
    onError: (err: any) => {
      toast({ title: 'Retry failed', description: err?.message || 'Could not queue retry.', variant: 'destructive' });
    },
  });

  const retryAllMutation = useMutation({
    mutationFn: async (scope: 'permanent' | 'failed') => {
      return apiRequest('POST', `/api/admin/email-logs/retry-all?scope=${scope}`);
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Bulk retry queued',
        description: `${data?.requeued ?? 0} email(s) re-queued for delivery.`,
      });
      refetch();
    },
    onError: (err: any) => {
      toast({ title: 'Bulk retry failed', description: err?.message || 'Could not bulk retry.', variant: 'destructive' });
    },
  });

  const logs = data?.logs || [];

  const statusBadge = (status: string, permanent: boolean | null) => {
    if (permanent) return <Badge variant="destructive">permanent</Badge>;
    switch (status) {
      case 'sent': return <Badge variant="default" className="bg-green-600 hover:bg-green-600">sent</Badge>;
      case 'failed': return <Badge variant="destructive">failed</Badge>;
      case 'pending': return <Badge variant="secondary">pending</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Email Delivery Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end mb-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground mb-1 block">Search recipient</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  data-testid="input-email-recipient-search"
                  value={recipientSearch}
                  onChange={(e) => { setRecipientSearch(e.target.value); setPage(1); }}
                  placeholder="user@example.com"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-[180px]">
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger data-testid="select-email-status-filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="permanently_failed">Permanently Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
              data-testid="button-email-logs-refresh"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="default"
              onClick={() => {
                if (confirm('Re-queue every permanently-failed email for delivery?')) {
                  retryAllMutation.mutate('permanent');
                }
              }}
              disabled={retryAllMutation.isPending}
              data-testid="button-email-logs-retry-all"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${retryAllMutation.isPending ? 'animate-spin' : ''}`} />
              Retry All Failed
            </Button>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Retries</TableHead>
                  <TableHead>Last Error</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
                ) : logs.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No email logs match the current filter.</TableCell></TableRow>
                ) : logs.map((log) => {
                  const canRetry = log.status === 'failed' && !log.permanentlyFailed;
                  return (
                    <TableRow key={log.id} data-testid={`row-email-log-${log.id}`}>
                      <TableCell className="text-xs whitespace-nowrap">{formatDate(log.createdAt)}</TableCell>
                      <TableCell className="text-sm font-medium max-w-[200px] truncate" title={log.recipientEmail}>{log.recipientEmail}</TableCell>
                      <TableCell className="text-sm max-w-[260px] truncate" title={log.subject || ''}>{log.subject || '-'}</TableCell>
                      <TableCell className="text-xs"><Badge variant="outline">{log.type || 'unknown'}</Badge></TableCell>
                      <TableCell>{statusBadge(log.status, log.permanentlyFailed)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{log.retryCount ?? 0} / {log.maxRetries ?? 5}</TableCell>
                      <TableCell className="text-xs max-w-[260px] truncate text-destructive" title={log.errorMessage || ''}>{log.errorMessage || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canRetry || retryMutation.isPending}
                          onClick={() => retryMutation.mutate(log.id)}
                          data-testid={`button-retry-email-${log.id}`}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-muted-foreground">{data?.total != null ? `${data.total} total` : ''}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button>
              <Button variant="outline" size="sm" disabled={logs.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CommunicationsView() {
  const { data: comms, isLoading } = useQuery<CommsStats>({
    queryKey: ['/api/admin/communications'],
  });

  const LEAD_STATUS_COLORS: Record<string, string> = {
    new: 'hsl(var(--primary))',
    contacted: 'hsl(210 70% 50%)',
    quoted: 'hsl(45 90% 50%)',
    won: 'hsl(142 70% 45%)',
    lost: 'hsl(0 70% 55%)',
  };

  const leadStatusData = useMemo(() => {
    if (!comms?.leads.byStatus) return [];
    return Object.entries(comms.leads.byStatus).map(([key, value]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value,
    }));
  }, [comms?.leads.byStatus]);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          testId="card-total-sms"
          title="SMS Messages"
          value={isLoading ? '...' : (comms?.sms.total || 0)}
          loading={isLoading}
          icon={<MessageSquare className="h-5 w-5 md:h-6 md:w-6 text-blue-600 dark:text-blue-400" />}
          iconBgClass="bg-blue-100 dark:bg-blue-500/20"
        />
        <KPICard
          testId="card-total-calls"
          title="AI Calls"
          value={isLoading ? '...' : (comms?.calls.total || 0)}
          loading={isLoading}
          icon={<Phone className="h-5 w-5 md:h-6 md:w-6 text-green-600 dark:text-green-400" />}
          iconBgClass="bg-green-100 dark:bg-green-500/20"
        />
        <KPICard
          testId="card-total-leads"
          title="Total Leads"
          value={isLoading ? '...' : (comms?.leads.total || 0)}
          loading={isLoading}
          icon={<Target className="h-5 w-5 md:h-6 md:w-6 text-purple-600 dark:text-purple-400" />}
          iconBgClass="bg-purple-100 dark:bg-purple-500/20"
        />
        <KPICard
          testId="card-conversion-rate"
          title="Lead Conversion"
          value={isLoading ? '...' : `${comms?.leads.conversionRate || 0}%`}
          loading={isLoading}
          icon={<TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-amber-600 dark:text-amber-400" />}
          iconBgClass="bg-amber-100 dark:bg-amber-500/20"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-sms-volume">
          <CardHeader className="pb-2">
            <CardTitle className="text-base md:text-lg">SMS Volume (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] md:h-[260px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comms?.sms.dailyData || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      interval={4}
                    />
                    <YAxis 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Bar dataKey="inbound" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} stackId="sms" name="Inbound" />
                    <Bar dataKey="outbound" fill="hsl(var(--primary) / 0.5)" radius={[2, 2, 0, 0]} stackId="sms" name="Outbound" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-lead-pipeline">
          <CardHeader className="pb-2">
            <CardTitle className="text-base md:text-lg">Lead Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] md:h-[260px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : leadStatusData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  No leads yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={leadStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {leadStatusData.map((entry, index) => (
                        <Cell 
                          key={index} 
                          fill={LEAD_STATUS_COLORS[entry.name.toLowerCase()] || 'hsl(var(--muted))'} 
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-sms-breakdown">
          <CardHeader className="pb-2">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              SMS Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Conversations", value: comms?.conversations.total || 0 },
                { label: "Inbound", value: comms?.sms.inbound || 0 },
                { label: "Outbound", value: comms?.sms.outbound || 0 },
                { label: "Delivered", value: comms?.sms.delivered || 0, color: "text-green-500" },
                { label: "Failed", value: comms?.sms.failed || 0, color: "text-destructive" },
                { label: "Job Requests (AI)", value: comms?.sms.jobRequests || 0, color: "text-blue-500" },
                { label: "Last 7 days", value: comms?.sms.last7d || 0 },
                { label: "Last 30 days", value: comms?.sms.last30d || 0 },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-1">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className={`font-semibold tabular-nums text-sm ${item.color || ''}`}>
                    {isLoading ? '...' : item.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-calls-breakdown">
          <CardHeader className="pb-2">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <Phone className="h-4 w-4" />
              AI Receptionist Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Total Calls", value: comms?.calls.total || 0 },
                { label: "Completed", value: comms?.calls.completed || 0, color: "text-green-500" },
                { label: "Missed", value: comms?.calls.missed || 0, color: "text-destructive" },
                { label: "Transferred", value: comms?.calls.transferred || 0 },
                { label: "Leads Created", value: comms?.calls.leadsCreated || 0, color: "text-blue-500" },
                { label: "Avg Duration", value: formatDuration(comms?.calls.avgDuration || 0) },
                { label: "Total Cost", value: `$${(comms?.calls.totalCost || 0).toFixed(2)}` },
                { label: "Last 7 days", value: comms?.calls.last7d || 0 },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-1">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className={`font-semibold tabular-nums text-sm ${item.color || ''}`}>
                    {isLoading ? '...' : item.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-leads-breakdown">
          <CardHeader className="pb-2">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <Target className="h-4 w-4" />
              Lead Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Total Leads", value: comms?.leads.total || 0 },
                { label: "New (Uncontacted)", value: comms?.leads.newLeads || 0 },
                { label: "Won", value: comms?.leads.wonLeads || 0, color: "text-green-500" },
                { label: "Conversion Rate", value: `${comms?.leads.conversionRate || 0}%` },
                { label: "Pipeline Value", value: `$${Math.round(comms?.leads.totalEstimatedValue || 0).toLocaleString()}` },
                { label: "Last 30 days", value: comms?.leads.last30d || 0 },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-1">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className={`font-semibold tabular-nums text-sm ${item.color || ''}`}>
                    {isLoading ? '...' : item.value}
                  </span>
                </div>
              ))}
              {comms?.leads.bySource && Object.keys(comms.leads.bySource).length > 0 && (
                <>
                  <div className="border-t pt-2 mt-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">By Source</p>
                    {Object.entries(comms.leads.bySource).map(([source, count]) => (
                      <div key={source} className="flex items-center justify-between py-0.5">
                        <span className="text-xs text-muted-foreground capitalize">{source}</span>
                        <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface PortRequest {
  id: string;
  userId: string;
  phoneNumber: string;
  currentCarrier: string;
  accountNumber: string;
  authorisationAgreed: boolean;
  status: string;
  adminNotes: string | null;
  estimatedCompletionDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  userName?: string;
  userEmail?: string | null;
  businessName?: string | null;
}

function PortingView() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState("");

  const { data: portData, isLoading } = useQuery<{ portRequests: PortRequest[] }>({
    queryKey: ['/api/admin/port-requests'],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: string; status?: string; adminNotes?: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/port-requests/${id}`, { status, adminNotes });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update port request");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Port Request Updated", description: "Status has been updated successfully." });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/port-requests'] });
      setEditingNotes(null);
    },
    onError: (error: Error) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    },
  });

  const requests = portData?.portRequests || [];
  const filtered = statusFilter === 'all' ? requests : requests.filter(r => r.status === statusFilter);

  const statusCounts = {
    all: requests.length,
    submitted: requests.filter(r => r.status === 'submitted').length,
    processing: requests.filter(r => r.status === 'processing').length,
    completed: requests.filter(r => r.status === 'completed').length,
    failed: requests.filter(r => r.status === 'failed').length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30">Submitted</Badge>;
      case 'processing': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30">Processing</Badge>;
      case 'completed': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30">Completed</Badge>;
      case 'failed': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30">Failed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatPhoneDisplay = (phone: string) => {
    if (phone.startsWith('+61')) {
      const local = phone.replace('+61', '0');
      return local.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
    }
    return phone;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(['all', 'submitted', 'processing', 'completed', 'failed'] as const).map(s => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            className="capitalize"
            onClick={() => setStatusFilter(s)}
          >
            {s} ({statusCounts[s]})
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base md:text-lg">Port Requests</CardTitle>
          {statusCounts.submitted > 0 && (
            <Badge variant="secondary">{statusCounts.submitted} pending</Badge>
          )}
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Business</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead className="hidden md:table-cell">Carrier</TableHead>
                  <TableHead className="hidden lg:table-cell">Account #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Submitted</TableHead>
                  <TableHead className="pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <PhoneForwarded className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No port requests found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(pr => (
                    <TableRow key={pr.id}>
                      <TableCell className="pl-6">
                        <div>
                          <p className="font-medium truncate max-w-[150px]">{pr.businessName || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">{pr.userEmail || pr.userName}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono font-medium">{formatPhoneDisplay(pr.phoneNumber)}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{pr.currentCarrier}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground font-mono text-xs">{pr.accountNumber}</TableCell>
                      <TableCell>{getStatusBadge(pr.status)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                        {pr.createdAt ? formatDate(pr.createdAt) : '-'}
                      </TableCell>
                      <TableCell className="pr-6">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Select
                            value={pr.status}
                            onValueChange={(val) => updateMutation.mutate({ id: pr.id, status: val })}
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="submitted">Submitted</SelectItem>
                              <SelectItem value="processing">Processing</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="failed">Failed</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditingNotes(editingNotes === pr.id ? null : pr.id);
                              setNotesText(pr.adminNotes || '');
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                        {editingNotes === pr.id && (
                          <div className="mt-2 flex gap-2">
                            <Input
                              placeholder="Admin notes..."
                              value={notesText}
                              onChange={(e) => setNotesText(e.target.value)}
                              className="text-sm"
                            />
                            <Button
                              size="sm"
                              onClick={() => updateMutation.mutate({ id: pr.id, adminNotes: notesText })}
                              disabled={updateMutation.isPending}
                            >
                              Save
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminDashboard() {
  const [location, setLocation] = useLocation();

  const { data: authUser, isLoading: authLoading } = useQuery<AuthUser>({
    queryKey: ['/api/auth/me'],
  });

  const isAdmin = authUser?.isPlatformAdmin === true;

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<AdminStats>({
    queryKey: ['/api/admin/stats'],
    enabled: isAdmin,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery<AdminUsersResponse>({
    queryKey: ['/api/admin/users'],
    enabled: isAdmin,
  });

  const currentRoute = adminRoutes.find(r => location === r.path) || adminRoutes[0];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="loading-state">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" data-testid="access-denied">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8">
            <div className="text-center">
              <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="h-7 w-7 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground text-sm">
                You don't have permission to access the admin dashboard.
              </p>
              <Button 
                className="mt-6" 
                onClick={() => setLocation('/')}
                data-testid="button-back-home"
              >
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderView = () => {
    switch (location) {
      case '/admin/revenue':
        return <RevenueView />;
      case '/admin/comms':
        return <CommunicationsView />;
      case '/admin/users':
        return <UsersView usersData={usersData} usersLoading={usersLoading} />;
      case '/admin/activity':
        return <ActivityView usersData={usersData} stats={stats} />;
      case '/admin/email-logs':
        return <EmailLogsView />;
      case '/admin/health':
        return <HealthView />;
      case '/admin/kanban':
        return <KanbanView />;
      case '/admin/ai-queue':
        return <AIApprovalView />;
      case '/admin/call-monitor':
        return <CallMonitoringView />;
      case '/admin/porting':
        return <PortingView />;
      default:
        return (
          <OverviewView 
            stats={stats}
            statsLoading={statsLoading}
            statsError={statsError}
            usersData={usersData}
            usersLoading={usersLoading}
          />
        );
    }
  };

  return (
    <PageShell data-testid="admin-dashboard">
        <PageHeader
          title="Admin Dashboard"
          subtitle="Platform analytics and user management"
          leading={<Shield className="h-5 w-5 text-primary" />}
        />

        {renderView()}
    </PageShell>
  );
}
