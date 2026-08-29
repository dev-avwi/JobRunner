import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import {
  Users, Plus, Filter, Sparkles, ArrowUpRight, MoreHorizontal,
  ChevronDown, Mail, ArrowRight, UserPlus, Link2, ShieldCheck,
  Search, Loader2, Lock, Crown, AlertCircle, MessageSquare,
  Phone, MapPin, Clock, CheckCircle2, RefreshCw, X, Activity,
  Trash2, Receipt, Copy, Key, ChevronRight, ChevronUp,
  Edit2, Check, Hash, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useFeatureAccess } from "@/hooks/use-subscription";
import { useAppMode } from "@/hooks/use-app-mode";
import { apiRequest, queryClient } from "@/lib/queryClient";
import SendMagicLinkSheet from "@/components/subs/SendMagicLinkSheet";
import SubcontractorInvoices from "@/pages/SubcontractorInvoices";

interface RoleOption {
  id: string;
  name: string;
  description?: string;
}

type TabKey = "directory" | "subinvoices";

interface TeamMember {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role?: string;
  roleId?: string;
  status?: string;
  invitationStatus?: string;
  lastActiveAt?: string | null;
  hoursThisWeek?: number;
  avatarUrl?: string | null;
  initials?: string;
  compliance?: {
    status: 'valid' | 'expiring_soon' | 'expired';
  };
}

interface SubcontractorRow {
  id: string;
  kind: "magic_link" | "account_sub" | "connected_business";
  name: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  status: string;
  lastActivity?: string | null;
  jobsCount?: number;
  trade?: string | null;
  businessName?: string | null;
}

interface InviteCode {
  id: string;
  code: string;
  roleType: "worker" | "manager" | "subcontractor";
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
}

// Unified directory entry type — members and subs in one list
interface DirectoryEntry {
  kind: "member" | "sub";
  id: string;
  member?: TeamMember;
  sub?: SubcontractorRow;
}

function initialsFor(first?: string, last?: string, fallback?: string) {
  const a = (first || "").trim();
  const b = (last || "").trim();
  if (a || b) return `${a[0] || ""}${b[0] || ""}`.toUpperCase() || "?";
  if (fallback) {
    const parts = fallback.trim().split(/\s+/);
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
  }
  return "?";
}

function colorFromString(s: string) {
  const palette = [
    "hsl(217 91% 53%)",
    "hsl(145 65% 42%)",
    "hsl(35 90% 50%)",
    "hsl(280 55% 58%)",
    "hsl(10 80% 58%)",
    "hsl(195 70% 48%)",
  ];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

function timeAgo(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  if (diff < 0) return "—";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function daysUntil(dateStr: string) {
  const d = new Date(dateStr);
  const diff = d.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function PlanLockOverlay({ onUpgrade, message }: { onUpgrade: () => void; message: string }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/85 backdrop-blur-sm rounded-md">
      <Card className="max-w-md w-[90%] mx-auto">
        <CardContent className="p-6 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-warning/10 flex items-center justify-center mb-3">
            <Crown className="w-6 h-6 text-warning" />
          </div>
          <h3 className="text-base font-semibold mb-1">Team Plan required</h3>
          <p className="text-sm text-muted-foreground mb-4">{message}</p>
          <Button onClick={onUpgrade} data-testid="button-upgrade-from-team-page">
            Upgrade to Team — $99.99/mo flat
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Lighter stat pill (not a full card)
function StatPill({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-muted/50 border">
      <div className="text-[22px] font-bold tabular-nums" style={color ? { color } : {}}>{value}</div>
      <div className="text-[11px] text-muted-foreground leading-tight font-medium">{label}</div>
    </div>
  );
}

// Role type label + colour helper
const ROLE_TYPE_META: Record<string, { label: string; color: string }> = {
  worker: { label: "Worker", color: "hsl(217 91% 53%)" },
  manager: { label: "Manager", color: "hsl(280 55% 58%)" },
  subcontractor: { label: "Subcontractor", color: "hsl(145 65% 42%)" },
};

export default function TeamPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { subscriptionTier, canAddTeamMembers } = useFeatureAccess();
  const { isOwner } = useAppMode();
  const searchString = useSearch();
  const urlTab = new URLSearchParams(searchString).get("tab");
  const [tab, setTab] = useState<TabKey>(() =>
    urlTab === "subinvoices" ? "subinvoices" : "directory"
  );
  useEffect(() => {
    if (urlTab === "subinvoices") setTab("subinvoices");
    else if (urlTab === "members" || urlTab === "subcontractors" || urlTab === "directory") setTab("directory");
  }, [urlTab]);

  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [sendLinkOpen, setSendLinkOpen] = useState(false);
  const [inviteMemberOpen, setInviteMemberOpen] = useState(false);
  const [inviteAccountSubOpen, setInviteAccountSubOpen] = useState(false);
  const [upgradeSubOpen, setUpgradeSubOpen] = useState(false);
  const [upgradeSubTarget, setUpgradeSubTarget] = useState<SubcontractorRow | null>(null);
  const [roleEditTarget, setRoleEditTarget] = useState<TeamMember | null>(null);
  const [codesExpanded, setCodesExpanded] = useState(true);

  const isFree = subscriptionTier === "free";
  const isPro = subscriptionTier === "pro" || subscriptionTier === "trial";
  const hasTeamPlan = canAddTeamMembers;

  const membersQuery = useQuery<TeamMember[]>({
    queryKey: ["/api/team/members"],
    enabled: hasTeamPlan,
  });

  const subsQuery = useQuery<SubcontractorRow[]>({
    queryKey: ["/api/subcontractors"],
  });

  const inviteCodesQuery = useQuery<InviteCode[]>({
    queryKey: ["/api/team/invite-codes"],
    enabled: hasTeamPlan,
  });

  const members = membersQuery.data ?? [];
  const subs = subsQuery.data ?? [];
  const inviteCodes = (inviteCodesQuery.data ?? []).filter((c) => c.isActive);

  const stats = useMemo(() => {
    const activeMembers = members.filter((m) => m.invitationStatus === "accepted" && m.status !== "inactive").length;
    const pendingMembers = members.filter((m) => m.invitationStatus !== "accepted").length;
    const totalSubs = subs.length;
    const hours = members.reduce((acc, m) => acc + (m.hoursThisWeek || 0), 0);
    return { activeMembers, pendingMembers, totalSubs, hours };
  }, [members, subs]);

  // Build unified directory
  const allEntries = useMemo((): DirectoryEntry[] => {
    const memberEntries: DirectoryEntry[] = members.map((m) => ({ kind: "member", id: `m-${m.id}`, member: m }));
    const subEntries: DirectoryEntry[] = subs.map((s) => ({ kind: "sub", id: `s-${s.id}`, sub: s }));
    return [...memberEntries, ...subEntries];
  }, [members, subs]);

  const searchedEntries = useMemo(() => {
    const lower = search.trim().toLowerCase();
    if (!lower) return allEntries;
    return allEntries.filter((e) => {
      if (e.kind === "member" && e.member) {
        const m = e.member;
        return `${m.firstName || ""} ${m.lastName || ""} ${m.email || ""} ${m.phone || ""} ${m.role || ""}`.toLowerCase().includes(lower);
      }
      if (e.kind === "sub" && e.sub) {
        const s = e.sub;
        return `${s.name} ${s.contactPhone || ""} ${s.contactEmail || ""} ${s.trade || ""}`.toLowerCase().includes(lower);
      }
      return false;
    });
  }, [allEntries, search]);

  // Group entries
  const grouped = useMemo(() => {
    const active: DirectoryEntry[] = [];
    const pending: DirectoryEntry[] = [];
    const inactive: DirectoryEntry[] = [];

    for (const e of searchedEntries) {
      if (e.kind === "member" && e.member) {
        const m = e.member;
        if (m.invitationStatus !== "accepted") pending.push(e);
        else if (m.status === "inactive") inactive.push(e);
        else active.push(e);
      } else if (e.kind === "sub" && e.sub) {
        const s = e.sub;
        if (s.status === "pending") pending.push(e);
        else if (s.status === "revoked" || s.status === "expired") inactive.push(e);
        else active.push(e);
      }
    }
    return { active, pending, inactive };
  }, [searchedEntries]);

  const handleAddChoice = (kind: "member" | "magic_link" | "account_sub") => {
    setAddOpen(false);
    if (kind === "member") {
      if (!hasTeamPlan) {
        toast({ title: "Team Plan needed", description: "Inviting members needs a Team plan ($99.99/mo flat)." });
        setLocation("/pricing");
        return;
      }
      setInviteMemberOpen(true);
    } else if (kind === "magic_link") {
      if (isFree) {
        toast({ title: "Pro plan needed", description: "Magic-link subs are on Pro and above." });
        setLocation("/pricing");
        return;
      }
      setSendLinkOpen(true);
    } else {
      if (!hasTeamPlan) {
        toast({ title: "Team Plan needed", description: "Account subs need a Team plan." });
        setLocation("/pricing");
        return;
      }
      setInviteAccountSubOpen(true);
    }
  };

  const totalCount = allEntries.length;

  return (
    <div className="flex-1 overflow-y-auto" data-testid="page-team">
      <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-12 max-w-[1400px] mx-auto">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-team-title">Team</h1>
              {totalCount > 0 && (
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-success/10 text-success flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-success animate-pulse" />
                  {stats.activeMembers + subs.filter((s) => s.status === "active" || s.status === "accepted").length} active
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Members, subcontractors and access — everything in one place.
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/team-operations")}
              data-testid="button-team-live-ops"
            >
              <Activity className="w-3.5 h-3.5 text-success" /> Live operations
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/insights")}
              data-testid="button-team-insights"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-500" /> Insights
            </Button>
            <DropdownMenu open={addOpen} onOpenChange={setAddOpen}>
              <DropdownMenuTrigger asChild>
                <Button size="sm" data-testid="button-team-add">
                  <Plus className="w-3.5 h-3.5" /> Add
                  <ChevronDown className="w-3 h-3 opacity-70 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 p-2">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">
                  Add to your team
                </DropdownMenuLabel>
                <DropdownMenuItem
                  className="flex items-start gap-3 p-2.5 rounded-md cursor-pointer"
                  onClick={() => handleAddChoice("member")}
                  data-testid="add-choice-member"
                >
                  <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold">Invite member</div>
                    <div className="text-[11.5px] text-muted-foreground leading-relaxed">
                      Permanent staff with email login and role-based access.
                    </div>
                    <Badge variant="secondary" className="mt-1 text-[10px]">Team Plan · $99.99/mo flat</Badge>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-start gap-3 p-2.5 rounded-md cursor-pointer"
                  onClick={() => handleAddChoice("magic_link")}
                  data-testid="add-choice-magic-link"
                >
                  <div className="w-9 h-9 rounded-md bg-purple-500/10 text-purple-600 flex items-center justify-center flex-shrink-0">
                    <Link2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold">Magic-link sub</div>
                    <div className="text-[11.5px] text-muted-foreground leading-relaxed">
                      One-job access via SMS — no app, no account needed.
                    </div>
                    <Badge variant="secondary" className="mt-1 text-[10px]">Pro+ · Free</Badge>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-start gap-3 p-2.5 rounded-md cursor-pointer"
                  onClick={() => handleAddChoice("account_sub")}
                  data-testid="add-choice-account-sub"
                >
                  <div className="w-9 h-9 rounded-md bg-success/10 text-success flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold">Account subcontractor</div>
                    <div className="text-[11.5px] text-muted-foreground leading-relaxed">
                      Recurring sub with their own dashboard and invoicing.
                    </div>
                    <Badge variant="secondary" className="mt-1 text-[10px]">Team Plan · $99.99/mo flat</Badge>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stats row — lighter pills, not heavy cards */}
        <div className="flex gap-2.5 mb-5 flex-wrap">
          <StatPill label="Active members" value={hasTeamPlan ? stats.activeMembers : "—"} color="hsl(145 65% 42%)" />
          <StatPill label="Pending invites" value={hasTeamPlan ? stats.pendingMembers : "—"} color="hsl(35 90% 50%)" />
          <StatPill label="Subcontractors" value={stats.totalSubs} color="hsl(280 55% 58%)" />
          <StatPill label="Hours this week" value={`${stats.hours}h`} />
        </div>

        {/* Invite Codes panel */}
        {hasTeamPlan && (
          <InviteCodesPanel
            codes={inviteCodes}
            loading={inviteCodesQuery.isLoading}
            expanded={codesExpanded}
            onToggle={() => setCodesExpanded((v) => !v)}
          />
        )}

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="mt-5">
          <div className="border-b flex items-center flex-wrap gap-y-0">
            <TabsList className="h-auto bg-transparent p-0 gap-0 rounded-none -mb-px">
              <TabsTrigger
                value="directory"
                data-testid="tab-directory"
                className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent bg-transparent text-muted-foreground hover:text-foreground transition-colors"
              >
                <Users className="w-3.5 h-3.5" />
                Directory
                {totalCount > 0 && (
                  <span className={`text-[10.5px] font-medium px-1.5 py-px rounded ${tab === "directory" ? "bg-foreground/10 text-foreground" : "bg-muted text-muted-foreground"}`}>
                    {totalCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="subinvoices"
                data-testid="tab-subinvoices"
                className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent bg-transparent text-muted-foreground hover:text-foreground transition-colors"
              >
                <Receipt className="w-3.5 h-3.5" />
                Sub Invoices
              </TabsTrigger>
            </TabsList>
            <div className="ml-auto flex items-center gap-1 pb-1.5">
              <Button variant="ghost" size="sm" className="text-[12px] text-muted-foreground" onClick={() => setLocation("/team-operations")} data-testid="button-roles-permissions">
                Roles and permissions
              </Button>
              <Button variant="ghost" size="sm" className="text-[12px] text-muted-foreground" onClick={() => setLocation("/team-operations")} data-testid="button-activity-log">
                Activity log
              </Button>
            </div>
          </div>

          <TabsContent value="directory" className="mt-0">
            {/* Search bar */}
            <div className="flex items-center gap-2 py-3.5">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search people…"
                  className="h-8 pl-8 text-[12.5px]"
                  data-testid="input-team-search"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {search && (
                <span className="text-[12px] text-muted-foreground">
                  {searchedEntries.length} result{searchedEntries.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="relative">
              <DirectoryView
                grouped={grouped}
                membersLoading={membersQuery.isLoading && hasTeamPlan}
                subsLoading={subsQuery.isLoading}
                hasTeamPlan={hasTeamPlan}
                isFree={isFree}
                canChangeRoles={isOwner}
                onInviteMember={() => handleAddChoice("member")}
                onSendMagicLink={() => handleAddChoice("magic_link")}
                onUpgradeSub={(sub) => {
                  if (!hasTeamPlan) {
                    toast({ title: "Team Plan needed", description: "Upgrading subs to accounts needs a Team plan." });
                    setLocation("/pricing");
                    return;
                  }
                  setUpgradeSubTarget(sub);
                  setUpgradeSubOpen(true);
                }}
                onChangeRole={(member) => setRoleEditTarget(member)}
              />
            </div>
          </TabsContent>

          <TabsContent value="subinvoices" className="relative min-h-[420px] pt-3.5 mt-0">
            {isFree ? (
              <PlanLockOverlay
                onUpgrade={() => setLocation("/pricing")}
                message="Reviewing and paying subcontractor invoices needs a paid plan. Upgrade to unlock."
              />
            ) : (
              <SubcontractorInvoices embedded />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Send Magic Link Sheet */}
      <SendMagicLinkSheet
        open={sendLinkOpen}
        onOpenChange={setSendLinkOpen}
        onSent={() => { subsQuery.refetch(); }}
      />

      {/* Invite Member Sheet */}
      <InviteMemberSheet
        open={inviteMemberOpen}
        onOpenChange={setInviteMemberOpen}
        mode="member"
      />

      {/* Account Sub Invite Sheet */}
      <InviteMemberSheet
        open={inviteAccountSubOpen}
        onOpenChange={setInviteAccountSubOpen}
        mode="account_sub"
      />

      {/* Upgrade magic-link to account sub */}
      <UpgradeSubSheet
        open={upgradeSubOpen}
        onOpenChange={setUpgradeSubOpen}
        sub={upgradeSubTarget}
      />

      {/* Role editor sheet */}
      <RoleEditSheet
        member={roleEditTarget}
        open={!!roleEditTarget}
        onOpenChange={(v) => { if (!v) setRoleEditTarget(null); }}
      />
    </div>
  );
}

// ─── Invite Codes Panel ────────────────────────────────────────────────────────

function InviteCodesPanel({
  codes, loading, expanded, onToggle,
}: {
  codes: InviteCode[];
  loading: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { toast } = useToast();
  const [genRole, setGenRole] = useState<"worker" | "manager" | "subcontractor">("worker");
  const [copying, setCopying] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/team/invite-codes", { roleType: genRole });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team/invite-codes"] });
      toast({ title: "Invite code generated", description: "Share it with your new team member." });
    },
    onError: (err: any) => {
      toast({ title: "Could not generate code", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/team/invite-codes/${id}`);
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team/invite-codes"] });
      toast({ title: "Code revoked" });
    },
    onError: (err: any) => {
      toast({ title: "Could not revoke code", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const handleCopy = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopying(id);
      setTimeout(() => setCopying(null), 1500);
      toast({ title: "Code copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", description: "Please copy the code manually.", variant: "destructive" });
    }
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden" data-testid="invite-codes-panel">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
        onClick={onToggle}
        data-testid="button-toggle-invite-codes"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <Key className="w-3.5 h-3.5" />
          </div>
          <div className="text-left">
            <div className="text-[13.5px] font-semibold">Invite codes</div>
            <div className="text-[11.5px] text-muted-foreground">
              {codes.length > 0 ? `${codes.length} active code${codes.length !== 1 ? "s" : ""}` : "Generate a reusable code per role type"}
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t px-4 pt-3 pb-4">
          {/* Generate new code */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Select value={genRole} onValueChange={(v) => setGenRole(v as typeof genRole)}>
              <SelectTrigger className="h-8 w-[160px] text-[12.5px]" data-testid="select-invite-code-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="worker">Worker</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="subcontractor">Subcontractor</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              data-testid="button-generate-invite-code"
              className="h-8"
            >
              {generateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Generate code
            </Button>
            <span className="text-[11px] text-muted-foreground ml-auto hidden sm:block">
              Codes expire in 30 days, valid for up to 10 uses each
            </span>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && codes.length === 0 && (
            <div className="text-center py-6 text-[13px] text-muted-foreground">
              <Key className="w-6 h-6 mx-auto mb-2 opacity-40" />
              No active codes — generate one above and share it with your new team member.
            </div>
          )}

          {!loading && codes.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {codes.map((c) => {
                const meta = ROLE_TYPE_META[c.roleType] || { label: c.roleType, color: "hsl(217 91% 53%)" };
                const usesLeft = c.maxUses - c.usedCount;
                const days = daysUntil(c.expiresAt);
                const isCopied = copying === c.id;

                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                    data-testid={`invite-code-card-${c.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-[14px] font-mono font-bold tracking-widest text-foreground">
                          {c.code}
                        </code>
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: `color-mix(in oklch, ${meta.color} 12%, transparent)`, color: meta.color }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span>{usesLeft}/{c.maxUses} uses left</span>
                        <span className="opacity-40">·</span>
                        <span className={days <= 3 ? "text-destructive font-medium" : ""}>{days}d remaining</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleCopy(c.code, c.id)}
                            data-testid={`button-copy-code-${c.id}`}
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{isCopied ? "Copied!" : "Copy code"}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => revokeMutation.mutate(c.id)}
                            disabled={revokeMutation.isPending}
                            data-testid={`button-revoke-code-${c.id}`}
                          >
                            {revokeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Revoke code</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Directory View ────────────────────────────────────────────────────────────

function DirectoryView({
  grouped, membersLoading, subsLoading, hasTeamPlan, isFree, canChangeRoles,
  onInviteMember, onSendMagicLink, onUpgradeSub, onChangeRole,
}: {
  grouped: { active: DirectoryEntry[]; pending: DirectoryEntry[]; inactive: DirectoryEntry[] };
  membersLoading: boolean;
  subsLoading: boolean;
  hasTeamPlan: boolean;
  isFree: boolean;
  canChangeRoles: boolean;
  onInviteMember: () => void;
  onSendMagicLink: () => void;
  onUpgradeSub: (sub: SubcontractorRow) => void;
  onChangeRole: (member: TeamMember) => void;
}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // Members are locked for non-Team users; subs remain accessible to Pro+ users
  const showLockedMembers = !hasTeamPlan;

  const sampleMembers: TeamMember[] = [
    { id: "s1", firstName: "Sarah", lastName: "Chen", role: "Manager", status: "active", invitationStatus: "accepted", lastActiveAt: new Date(Date.now() - 120000).toISOString(), hoursThisWeek: 38, email: "sarah@example.com" },
    { id: "s2", firstName: "Marcus", lastName: "Johnson", role: "Worker", status: "active", invitationStatus: "accepted", lastActiveAt: new Date().toISOString(), hoursThisWeek: 42, email: "marcus@example.com" },
    { id: "s3", firstName: "Tom", lastName: "Reilly", role: "Worker", status: "off_today", invitationStatus: "accepted", lastActiveAt: new Date(Date.now() - 3 * 86400000).toISOString(), hoursThisWeek: 0, phone: "0400 000 000" },
  ];

  const resendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/team/members/${id}/resend-invite`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team/members"] });
      toast({ title: "Invite resent", description: "We've sent the invitation again." });
    },
    onError: (err: any) => {
      toast({ title: "Could not resend invite", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/team/members/${id}`);
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team/members"] });
      toast({ title: "Member removed", description: "They no longer have access to your team." });
      setRemoveTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "Could not remove member", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const isLoading = (membersLoading && hasTeamPlan) || subsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Separate real entries into member-only and sub-only lists
  const realSubEntries = {
    active: grouped.active.filter((e) => e.kind === "sub"),
    pending: grouped.pending.filter((e) => e.kind === "sub"),
    inactive: grouped.inactive.filter((e) => e.kind === "sub"),
  };
  const realMemberEntries = {
    active: grouped.active.filter((e) => e.kind === "member"),
    pending: grouped.pending.filter((e) => e.kind === "member"),
    inactive: grouped.inactive.filter((e) => e.kind === "member"),
  };

  // Sample member entries to show behind the lock for non-Team plans
  const sampleMemberEntries: DirectoryEntry[] = sampleMembers.map((m) => ({ kind: "member", id: `m-${m.id}`, member: m }));

  // What to actually render for members
  const memberActiveEntries = showLockedMembers ? sampleMemberEntries : realMemberEntries.active;

  // When everything is empty and user has full access — show the prompt
  const totalRealEntries =
    realMemberEntries.active.length + realMemberEntries.pending.length + realMemberEntries.inactive.length +
    realSubEntries.active.length + realSubEntries.pending.length + realSubEntries.inactive.length;

  if (!showLockedMembers && !isFree && totalRealEntries === 0) {
    return (
      <div className="text-center py-16 border rounded-lg bg-card">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Users className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-base mb-1">No team members yet</h3>
        <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
          Invite your first member by email or generate an invite code they can use to join.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button onClick={onInviteMember} data-testid="button-empty-invite-member">
            <UserPlus className="w-3.5 h-3.5" /> Invite member
          </Button>
          <Button variant="outline" onClick={onSendMagicLink} data-testid="button-empty-magic-link">
            <Link2 className="w-3.5 h-3.5" /> Magic-link sub
          </Button>
        </div>
      </div>
    );
  }

  // Build combined active entries: real subs first (always visible for Pro+), then members (locked sample or real)
  const combinedActiveEntries: DirectoryEntry[] = [
    ...(isFree ? [] : realSubEntries.active),
    ...memberActiveEntries,
  ];

  return (
    <div className="space-y-4">
      {/* Active section */}
      <DirectorySection
        title="Active"
        entries={combinedActiveEntries}
        emptyLabel={isFree ? "No active members — upgrade to Pro to add subcontractors." : "No active members"}
        showLockedSample={showLockedMembers}
        canChangeRoles={canChangeRoles}
        onResendInvite={(id) => resendMutation.mutate(id)}
        onRemoveMember={(m) => setRemoveTarget(m)}
        onUpgradeSub={onUpgradeSub}
        onChangeRole={onChangeRole}
        onNavigate={() => setLocation("/team-operations")}
      />

      {/* Members lock upsell banner for Pro (non-Team) users */}
      {showLockedMembers && !isFree && (
        <div className="flex items-center gap-3 p-3.5 rounded-lg border bg-warning/5 border-warning/20">
          <Crown className="w-4 h-4 text-warning flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold">Staff members need a Team plan</div>
            <div className="text-[12px] text-muted-foreground">
              You're on Pro (single user). Your subcontractors above are available. Upgrade to add permanent staff.
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setLocation("/pricing")} className="flex-shrink-0 text-[12px]" data-testid="button-upgrade-from-directory">
            Upgrade
          </Button>
        </div>
      )}

      {/* Members lock upsell for free users */}
      {isFree && (
        <div className="flex items-center gap-3 p-3.5 rounded-lg border bg-warning/5 border-warning/20">
          <Crown className="w-4 h-4 text-warning flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold">Upgrade to add team members and subcontractors</div>
            <div className="text-[12px] text-muted-foreground">
              Pro plan adds magic-link subs. Team plan adds permanent staff.
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setLocation("/pricing")} className="flex-shrink-0 text-[12px]" data-testid="button-upgrade-from-directory-free">
            See plans
          </Button>
        </div>
      )}

      {/* Pending section: subs for Pro+, members only for Team plan */}
      {(!isFree && realSubEntries.pending.length > 0) || (!showLockedMembers && realMemberEntries.pending.length > 0) ? (
        <DirectorySection
          title="Pending"
          entries={[
            ...(isFree ? [] : realSubEntries.pending),
            ...(showLockedMembers ? [] : realMemberEntries.pending),
          ]}
          emptyLabel=""
          showLockedSample={false}
          canChangeRoles={canChangeRoles}
          statusOverride="pending"
          onResendInvite={(id) => resendMutation.mutate(id)}
          onRemoveMember={(m) => setRemoveTarget(m)}
          onUpgradeSub={onUpgradeSub}
          onChangeRole={onChangeRole}
          onNavigate={() => setLocation("/team-operations")}
        />
      ) : null}

      {/* Inactive section — collapsible; show subs for Pro+, members only for Team plan */}
      {((!isFree && realSubEntries.inactive.length > 0) || (!showLockedMembers && realMemberEntries.inactive.length > 0)) && (
        <div>
          <button
            className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground mb-2 transition-colors"
            onClick={() => setShowInactive((v) => !v)}
            data-testid="button-toggle-inactive"
          >
            {showInactive ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Inactive ({(isFree ? 0 : realSubEntries.inactive.length) + (showLockedMembers ? 0 : realMemberEntries.inactive.length)})
          </button>
          {showInactive && (
            <DirectorySection
              title=""
              entries={[
                ...(isFree ? [] : realSubEntries.inactive),
                ...(showLockedMembers ? [] : realMemberEntries.inactive),
              ]}
              emptyLabel=""
              showLockedSample={false}
              canChangeRoles={canChangeRoles}
              statusOverride="inactive"
              onResendInvite={(id) => resendMutation.mutate(id)}
              onRemoveMember={(m) => setRemoveTarget(m)}
              onUpgradeSub={onUpgradeSub}
              onChangeRole={onChangeRole}
              onNavigate={() => setLocation("/team-operations")}
            />
          )}
        </div>
      )}

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from team?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget
                ? `${`${removeTarget.firstName || ""} ${removeTarget.lastName || ""}`.trim() || removeTarget.email || "This member"} will lose access to your business. This can't be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeMutation.isPending}
              onClick={(e) => { e.preventDefault(); if (removeTarget) removeMutation.mutate(removeTarget.id); }}
              data-testid="button-confirm-remove-member"
            >
              {removeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Directory Section ─────────────────────────────────────────────────────────

function DirectorySection({
  title, entries, emptyLabel, showLockedSample, statusOverride, canChangeRoles,
  onResendInvite, onRemoveMember, onUpgradeSub, onChangeRole, onNavigate,
}: {
  title: string;
  entries: DirectoryEntry[];
  emptyLabel: string;
  showLockedSample: boolean;
  statusOverride?: "pending" | "inactive";
  canChangeRoles: boolean;
  onResendInvite: (id: string) => void;
  onRemoveMember: (m: TeamMember) => void;
  onUpgradeSub: (s: SubcontractorRow) => void;
  onChangeRole: (m: TeamMember) => void;
  onNavigate: () => void;
}) {
  if (entries.length === 0 && emptyLabel) {
    return (
      <div>
        {title && <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">{title}</div>}
        <div className="text-[12.5px] text-muted-foreground py-3 pl-2">{emptyLabel}</div>
      </div>
    );
  }

  return (
    <div>
      {title && (
        <div className="flex items-center gap-2 mb-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{title}</div>
          <div className="text-[11px] font-medium text-muted-foreground">({entries.length})</div>
        </div>
      )}
      <div className="rounded-lg border bg-card overflow-hidden divide-y">
        {entries.map((e) => (
          <DirectoryRow
            key={e.id}
            entry={e}
            showLockedSample={showLockedSample}
            statusOverride={statusOverride}
            canChangeRoles={canChangeRoles}
            onResendInvite={onResendInvite}
            onRemoveMember={onRemoveMember}
            onUpgradeSub={onUpgradeSub}
            onChangeRole={onChangeRole}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Directory Row ─────────────────────────────────────────────────────────────

function memberStatus(m: TeamMember): "on" | "away" | "pending" | "inactive" {
  if (m.invitationStatus !== "accepted") return "pending";
  if (m.status === "off_today") return "away";
  if (m.status === "inactive") return "inactive";
  return "on";
}

const STATUS_META = {
  on: { dot: "bg-success", text: "text-success", label: "Active" },
  away: { dot: "bg-purple-500", text: "text-purple-600", label: "On time off" },
  pending: { dot: "bg-warning", text: "text-warning", label: "Pending" },
  inactive: { dot: "bg-muted-foreground", text: "text-muted-foreground", label: "Inactive" },
};

function DirectoryRow({
  entry, showLockedSample, statusOverride, canChangeRoles,
  onResendInvite, onRemoveMember, onUpgradeSub, onChangeRole, onNavigate,
}: {
  entry: DirectoryEntry;
  showLockedSample: boolean;
  statusOverride?: "pending" | "inactive";
  canChangeRoles: boolean;
  onResendInvite: (id: string) => void;
  onRemoveMember: (m: TeamMember) => void;
  onUpgradeSub: (s: SubcontractorRow) => void;
  onChangeRole: (m: TeamMember) => void;
  onNavigate: () => void;
}) {
  if (entry.kind === "member" && entry.member) {
    const m = entry.member;
    const name = `${m.firstName || ""} ${m.lastName || ""}`.trim() || "Unknown";
    const status = memberStatus(m);
    const init = initialsFor(m.firstName, m.lastName);
    const color = colorFromString(m.id || name);
    const sm = STATUS_META[status];
    const contact = m.phone
      ? { icon: Phone, value: m.phone }
      : m.email
        ? { icon: Mail, value: m.email }
        : null;

    return (
      <div
        data-testid={`row-member-${m.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 group cursor-pointer transition-colors"
        onClick={() => { if (!showLockedSample) onNavigate(); }}
      >
        {/* Avatar */}
        <UserAvatar
          className="h-9 w-9 flex-shrink-0"
          user={{ id: m.id, firstName: m.firstName, lastName: m.lastName, email: m.email }}
          showStatus={true}
          statusColor={
            status === "on" ? "hsl(var(--success))" :
            status === "away" ? "#a855f7" :
            status === "pending" ? "hsl(var(--warning))" :
            "hsl(var(--muted-foreground))"
          }
        />

        {/* Name + contact */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[13.5px] truncate">{name}</span>
            <Badge variant="secondary" className="text-[10.5px] capitalize h-[18px] px-1.5">{m.role || "Member"}</Badge>
            {m.role?.toLowerCase().includes("subcontractor") && (
              <Badge className="text-[10.5px] h-[18px] px-1.5 bg-emerald-100 text-emerald-700 border-0 hover:bg-emerald-100">Sub</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className={`text-[11.5px] font-medium flex items-center gap-1 ${sm.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sm.dot} flex-shrink-0`} />
              {sm.label}
            </span>
            {contact && (
              <span className="text-[11.5px] text-muted-foreground flex items-center gap-1 truncate">
                <contact.icon className="w-3 h-3 flex-shrink-0" />
                {contact.value}
              </span>
            )}
            {m.compliance && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                m.compliance.status === "expired" ? "bg-red-50 text-red-700" :
                m.compliance.status === "expiring_soon" ? "bg-amber-50 text-amber-700" :
                "bg-emerald-50 text-emerald-700"
              }`}>
                {m.compliance.status === "expired" ? "Expired" : m.compliance.status === "expiring_soon" ? "Expiring soon" : "Compliant"}
              </span>
            )}
          </div>
        </div>

        {/* Hours */}
        {m.hoursThisWeek !== undefined && m.hoursThisWeek > 0 && (
          <div className="hidden sm:flex flex-col items-end flex-shrink-0 text-right">
            <span className="text-[13px] font-semibold tabular-nums">{m.hoursThisWeek}h</span>
            <span className="text-[10.5px] text-muted-foreground">this week</span>
          </div>
        )}

        {/* Last active */}
        <div className="hidden md:block text-[12px] text-muted-foreground tabular-nums flex-shrink-0 min-w-[80px] text-right">
          {timeAgo(m.lastActiveAt)}
        </div>

        {/* Actions */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {showLockedSample ? (
            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-4 h-4" /></Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-member-row-actions-${m.id}`}>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {canChangeRoles && (
                  <DropdownMenuItem
                    onSelect={(e) => { e.preventDefault(); onChangeRole(m); }}
                    data-testid={`action-change-role-${m.id}`}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Change role
                  </DropdownMenuItem>
                )}
                {status === "pending" && (
                  <DropdownMenuItem
                    onSelect={(e) => { e.preventDefault(); onResendInvite(m.id); }}
                    data-testid={`action-resend-invite-${m.id}`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Resend invite
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={(e) => { e.preventDefault(); onRemoveMember(m); }}
                  data-testid={`action-remove-member-${m.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove from team
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    );
  }

  if (entry.kind === "sub" && entry.sub) {
    const s = entry.sub;
    const init = initialsFor(undefined, undefined, s.name);
    const color = colorFromString(s.id);
    const kindLabel = s.kind === "magic_link" ? "Magic link" : s.kind === "account_sub" ? "Account sub" : "Connected";
    const kindColor = s.kind === "magic_link" ? "hsl(280 55% 58%)" : s.kind === "account_sub" ? "hsl(145 65% 42%)" : "hsl(217 91% 53%)";
    const isActive = s.status === "active" || s.status === "accepted";
    const subStatus = s.status === "pending" ? "pending" : isActive ? "on" : "inactive";
    const sm = STATUS_META[subStatus as keyof typeof STATUS_META] || STATUS_META.inactive;

    const contact = s.contactPhone
      ? { icon: Phone, value: s.contactPhone }
      : s.contactEmail
        ? { icon: Mail, value: s.contactEmail }
        : null;

    return (
      <div
        data-testid={`row-sub-${s.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 group cursor-pointer transition-colors"
      >
        {/* Avatar */}
        <UserAvatar
          className="h-9 w-9 flex-shrink-0"
          user={{ id: s.id, name: s.name }}
          showStatus={true}
          statusColor={
            subStatus === "on" ? "hsl(var(--success))" :
            subStatus === "pending" ? "hsl(var(--warning))" :
            "hsl(var(--muted-foreground))"
          }
        />

        {/* Name + contact */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[13.5px] truncate">{s.name}</span>
            <span
              className="text-[10.5px] font-medium px-1.5 py-px rounded inline-flex items-center gap-1 flex-shrink-0"
              style={{ background: `color-mix(in oklch, ${kindColor} 12%, transparent)`, color: kindColor }}
            >
              {s.kind === "magic_link" ? <Link2 className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
              {kindLabel}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className={`text-[11.5px] font-medium flex items-center gap-1 ${sm.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sm.dot} flex-shrink-0`} />
              {sm.label}
            </span>
            {contact && (
              <span className="text-[11.5px] text-muted-foreground flex items-center gap-1 truncate">
                <contact.icon className="w-3 h-3 flex-shrink-0" />
                {contact.value}
              </span>
            )}
            {s.trade && (
              <span className="text-[11.5px] text-muted-foreground">{s.trade}</span>
            )}
          </div>
        </div>

        {/* Jobs count */}
        {(s.jobsCount ?? 0) > 0 && (
          <div className="hidden sm:flex flex-col items-end flex-shrink-0 text-right">
            <span className="text-[13px] font-semibold tabular-nums">{s.jobsCount}</span>
            <span className="text-[10.5px] text-muted-foreground">jobs</span>
          </div>
        )}

        {/* Last activity */}
        <div className="hidden md:block text-[12px] text-muted-foreground tabular-nums flex-shrink-0 min-w-[80px] text-right">
          {timeAgo(s.lastActivity)}
        </div>

        {/* Actions */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-sub-row-actions-${s.id}`}>
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {s.kind === "magic_link" && (
                <DropdownMenuItem
                  onSelect={(e) => { e.preventDefault(); onUpgradeSub(s); }}
                  data-testid={`action-upgrade-sub-${s.id}`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Upgrade to account sub
                </DropdownMenuItem>
              )}
              {s.kind !== "magic_link" && (
                <DropdownMenuItem disabled>
                  Already an account sub
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Role Edit Sheet ───────────────────────────────────────────────────────────

function RoleEditSheet({
  member, open, onOpenChange,
}: { member: TeamMember | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [selectedRoleId, setSelectedRoleId] = useState("");

  const { data: roles = [], isLoading: rolesLoading } = useQuery<RoleOption[]>({
    queryKey: ["/api/team/roles"],
    enabled: open,
  });

  const nonSubRoles = roles.filter((r) => (r.name || "").toLowerCase() !== "subcontractor");

  useEffect(() => {
    if (open && member) {
      const match = roles.find((r) => r.name?.toLowerCase() === member.role?.toLowerCase() || r.id === member.roleId);
      setSelectedRoleId(match?.id || "");
    }
  }, [open, member, roles]);

  const patchMutation = useMutation({
    mutationFn: async () => {
      if (!member) throw new Error("No member");
      const res = await apiRequest("PATCH", `/api/team/members/${member.id}`, { roleId: selectedRoleId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team/members"] });
      toast({ title: "Role updated" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Could not update role", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const memberName = member ? `${member.firstName || ""} ${member.lastName || ""}`.trim() || member.email || "Member" : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-sm flex flex-col" data-testid="sheet-role-edit">
        <SheetHeader>
          <SheetTitle>Change role</SheetTitle>
          <SheetDescription>Update the role for {memberName}.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex-1 flex flex-col gap-4">
          {rolesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {nonSubRoles.map((r) => (
                <button
                  key={r.id}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedRoleId === r.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                  }`}
                  onClick={() => setSelectedRoleId(r.id)}
                  data-testid={`role-option-${r.name.toLowerCase()}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[13.5px] font-semibold">{r.name}</div>
                    {selectedRoleId === r.id && <Check className="w-4 h-4 text-primary" />}
                  </div>
                  {r.description && (
                    <div className="text-[11.5px] text-muted-foreground mt-0.5">{r.description}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <SheetFooter className="flex-row gap-2 justify-end pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => patchMutation.mutate()}
            disabled={!selectedRoleId || patchMutation.isPending}
            data-testid="button-save-role"
          >
            {patchMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Invite Member Sheet ───────────────────────────────────────────────────────

function InviteMemberSheet({
  open, onOpenChange, mode,
}: { open: boolean; onOpenChange: (v: boolean) => void; mode: "member" | "account_sub" }) {
  const { toast } = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [roleId, setRoleId] = useState("");

  const { data: roles = [], isLoading: rolesLoading } = useQuery<RoleOption[]>({
    queryKey: ["/api/team/roles"],
    enabled: open,
  });

  const filteredRoles = useMemo(() => {
    if (mode === "account_sub") return roles.filter((r) => (r.name || "").toLowerCase() === "subcontractor");
    return roles.filter((r) => (r.name || "").toLowerCase() !== "subcontractor");
  }, [roles, mode]);

  useMemo(() => {
    if (!open) return;
    if (roleId) return;
    if (mode === "account_sub" && filteredRoles.length === 1) setRoleId(filteredRoles[0].id);
  }, [open, mode, filteredRoles, roleId]);

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        email: email.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        roleId,
      };
      const rate = parseFloat(hourlyRate);
      if (!isNaN(rate) && rate > 0) body.hourlyRate = String(rate);
      const res = await apiRequest("POST", "/api/team/members/invite", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subcontractors"] });
      toast({ title: "Invitation sent", description: `${email} has been invited.` });
      onOpenChange(false);
      setFirstName(""); setLastName(""); setEmail(""); setPhone(""); setHourlyRate(""); setRoleId("");
    },
    onError: (err: any) => {
      const raw = err?.message || "";
      let msg = raw;
      if (raw.startsWith("team_plan_required:")) msg = raw.replace(/^team_plan_required:\s*/, "");
      toast({ title: "Could not send invite", description: msg || "Please check the details and try again.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast({ title: "Email required", variant: "destructive" }); return; }
    if (!roleId) { toast({ title: "Role required", variant: "destructive" }); return; }
    inviteMutation.mutate();
  };

  const isAccountSub = mode === "account_sub";
  const title = isAccountSub ? "Add an account subcontractor" : "Invite a team member";
  const desc = isAccountSub
    ? "Invite a sub who'll have their own login and can submit invoices to you. Included in $99.99/mo Team plan."
    : "Permanent staff with email login and role-based access. Included in $99.99/mo Team plan.";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md flex flex-col" data-testid={`sheet-${mode}-invite`}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{desc}</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-4 flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${mode}-fn`}>First name</Label>
              <Input id={`${mode}-fn`} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jamie" data-testid={`input-${mode}-firstname`} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${mode}-ln`}>Last name</Label>
              <Input id={`${mode}-ln`} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" data-testid={`input-${mode}-lastname`} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${mode}-email`}>Email <span className="text-destructive">*</span></Label>
            <Input id={`${mode}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jamie@example.com" required data-testid={`input-${mode}-email`} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${mode}-phone`}>Phone (optional)</Label>
            <Input id={`${mode}-phone`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0400 000 000" data-testid={`input-${mode}-phone`} />
            <p className="text-[11.5px] text-muted-foreground">If provided, we'll also SMS the invite link.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${mode}-role`}>Role <span className="text-destructive">*</span></Label>
            <Select value={roleId} onValueChange={setRoleId} disabled={isAccountSub && filteredRoles.length === 1}>
              <SelectTrigger id={`${mode}-role`} data-testid={`select-${mode}-role`}>
                <SelectValue placeholder={rolesLoading ? "Loading roles…" : "Choose a role"} />
              </SelectTrigger>
              <SelectContent>
                {filteredRoles.length === 0 && !rolesLoading && (
                  <SelectItem value="__none" disabled>No roles available</SelectItem>
                )}
                {filteredRoles.map((r) => (
                  <SelectItem key={r.id} value={r.id} data-testid={`role-option-${r.name.toLowerCase()}`}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isAccountSub && (
              <p className="text-[11.5px] text-muted-foreground">Account subs are always assigned the Subcontractor role.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${mode}-rate`}>Hourly rate (optional)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input id={`${mode}-rate`} type="number" min="0" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="0.00" className="pl-7" data-testid={`input-${mode}-rate`} />
            </div>
          </div>
          <SheetFooter className="mt-auto pt-4 flex-row gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid={`button-${mode}-cancel`}>Cancel</Button>
            <Button type="submit" disabled={inviteMutation.isPending} data-testid={`button-${mode}-submit`}>
              {inviteMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Send invitation
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Upgrade Sub Sheet ─────────────────────────────────────────────────────────

function UpgradeSubSheet({
  open, onOpenChange, sub,
}: { open: boolean; onOpenChange: (v: boolean) => void; sub: SubcontractorRow | null }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");

  useMemo(() => {
    if (!open || !sub) return;
    setEmail(sub.contactEmail || "");
    const parts = (sub.name || "").trim().split(/\s+/);
    setFirstName(parts[0] || "");
    setLastName(parts.slice(1).join(" ") || "");
    setHourlyRate("");
  }, [open, sub]);

  const upgradeMutation = useMutation({
    mutationFn: async () => {
      if (!sub) throw new Error("No sub selected");
      const body: any = {
        tokenId: sub.id,
        email: email.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      };
      const rate = parseFloat(hourlyRate);
      if (!isNaN(rate) && rate > 0) body.hourlyRate = String(rate);
      const res = await apiRequest("POST", "/api/subcontractors/upgrade-to-account", body);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/team/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subcontractors"] });
      toast({
        title: data?.alreadyExisted ? "Already an account sub" : "Upgrade invite sent",
        description: data?.alreadyExisted
          ? "This person is already a team member — re-using their existing record."
          : `${email} has been invited to create a JobRunner account.`,
      });
      onOpenChange(false);
    },
    onError: (err: any) => {
      const raw = err?.message || "";
      let msg = raw;
      if (raw.startsWith("team_plan_required:")) msg = raw.replace(/^team_plan_required:\s*/, "");
      toast({ title: "Could not upgrade subcontractor", description: msg || "Please check the details and try again.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast({ title: "Email required to send the account invite", variant: "destructive" }); return; }
    upgradeMutation.mutate();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md flex flex-col" data-testid="sheet-upgrade-sub">
        <SheetHeader>
          <SheetTitle>Upgrade to account sub</SheetTitle>
          <SheetDescription>
            Convert this magic-link sub into a full account-subcontractor with their own login,
            dashboard and invoicing. We'll re-use their existing details.
          </SheetDescription>
        </SheetHeader>
        {sub && (
          <div className="mt-3 p-3 bg-muted/40 rounded-md text-[12.5px]">
            <div className="font-semibold">{sub.name}</div>
            <div className="text-muted-foreground">{sub.contactPhone || sub.contactEmail || "—"}</div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="mt-4 flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="upgrade-fn">First name</Label>
              <Input id="upgrade-fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} data-testid="input-upgrade-firstname" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="upgrade-ln">Last name</Label>
              <Input id="upgrade-ln" value={lastName} onChange={(e) => setLastName(e.target.value)} data-testid="input-upgrade-lastname" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="upgrade-email">Email <span className="text-destructive">*</span></Label>
            <Input id="upgrade-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sub@example.com" required data-testid="input-upgrade-email" />
            <p className="text-[11.5px] text-muted-foreground">Required so we can send the account-setup link.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="upgrade-rate">Hourly rate (optional)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input id="upgrade-rate" type="number" min="0" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="0.00" className="pl-7" data-testid="input-upgrade-rate" />
            </div>
          </div>
          <SheetFooter className="mt-auto pt-4 flex-row gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-upgrade-cancel">Cancel</Button>
            <Button type="submit" disabled={upgradeMutation.isPending} data-testid="button-upgrade-submit">
              {upgradeMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Send upgrade invite
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
