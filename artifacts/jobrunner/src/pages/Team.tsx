import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import {
  Users, Plus, Filter, Sparkles, ArrowUpRight, MoreHorizontal,
  ChevronDown, Mail, ArrowRight, UserPlus, Link2, ShieldCheck,
  Search, Loader2, Lock, Crown, AlertCircle, MessageSquare,
  Phone, MapPin, Clock, CheckCircle2, RefreshCw, X, Activity, Trash2, Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import SendMagicLinkSheet from "@/components/subs/SendMagicLinkSheet";
import SubcontractorInvoices from "@/pages/SubcontractorInvoices";

interface RoleOption {
  id: string;
  name: string;
  description?: string;
}

type TabKey = "members" | "subcontractors" | "subinvoices";
type SubFilter = "all" | "active" | "pending" | "off" | "inactive";

interface TeamMember {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role?: string;
  status?: string;
  invitationStatus?: string;
  lastActiveAt?: string | null;
  hoursThisWeek?: number;
  avatarUrl?: string | null;
  initials?: string;
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

function MiniSpark({ color = "hsl(217 91% 53%)" }: { color?: string }) {
  return (
    <svg viewBox="0 0 60 24" className="w-14 h-5">
      <polyline
        points="0,18 10,14 20,16 30,8 40,11 50,5 60,7"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatCard({
  label, value, delta, deltaPositive, sparkColor,
}: { label: string; value: string | number; delta?: string; deltaPositive?: boolean; sparkColor?: string }) {
  return (
    <Card className="flex-1 min-w-[180px]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
          {delta && (
            <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${deltaPositive ? "text-success" : "text-muted-foreground"}`}>
              <ArrowUpRight className="w-2.5 h-2.5" />{delta}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <div className="text-[26px] font-bold tracking-tight tabular-nums">{value}</div>
          <MiniSpark color={sparkColor} />
        </div>
      </CardContent>
    </Card>
  );
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

export default function TeamPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { subscriptionTier, canAddTeamMembers } = useFeatureAccess();
  const searchString = useSearch();
  const urlTab = new URLSearchParams(searchString).get("tab");
  const [tab, setTab] = useState<TabKey>(() =>
    urlTab === "subinvoices" || urlTab === "subcontractors" ? urlTab : "members"
  );
  useEffect(() => {
    if (urlTab === "subinvoices" || urlTab === "subcontractors" || urlTab === "members") {
      setTab(urlTab as TabKey);
    }
  }, [urlTab]);
  const [filter, setFilter] = useState<SubFilter>("all");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [sendLinkOpen, setSendLinkOpen] = useState(false);
  const [inviteMemberOpen, setInviteMemberOpen] = useState(false);
  const [inviteAccountSubOpen, setInviteAccountSubOpen] = useState(false);
  const [upgradeSubOpen, setUpgradeSubOpen] = useState(false);
  const [upgradeSubTarget, setUpgradeSubTarget] = useState<SubcontractorRow | null>(null);

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

  const members = membersQuery.data ?? [];
  const subs = subsQuery.data ?? [];

  const filteredMembers = useMemo(() => {
    const lower = search.trim().toLowerCase();
    return members.filter((m) => {
      if (filter === "active" && (m.status === "off_today" || m.invitationStatus !== "accepted")) return false;
      if (filter === "pending" && m.invitationStatus === "accepted") return false;
      if (filter === "off" && m.status !== "off_today") return false;
      if (filter === "inactive" && m.status !== "inactive") return false;
      if (!lower) return true;
      const hay = `${m.firstName || ""} ${m.lastName || ""} ${m.email || ""} ${m.role || ""}`.toLowerCase();
      return hay.includes(lower);
    });
  }, [members, filter, search]);

  const filteredSubs = useMemo(() => {
    const lower = search.trim().toLowerCase();
    return subs.filter((s) => {
      if (filter === "active" && s.status !== "active" && s.status !== "accepted") return false;
      if (filter === "pending" && s.status !== "pending") return false;
      if (filter === "inactive" && s.status !== "revoked" && s.status !== "expired") return false;
      if (filter === "off") return false;
      if (!lower) return true;
      const hay = `${s.name} ${s.contactPhone || ""} ${s.contactEmail || ""} ${s.trade || ""}`.toLowerCase();
      return hay.includes(lower);
    });
  }, [subs, filter, search]);

  const stats = useMemo(() => {
    const activeMembers = members.filter((m) => m.invitationStatus === "accepted" && m.status !== "inactive").length;
    const pendingMembers = members.filter((m) => m.invitationStatus !== "accepted").length;
    const totalSubs = subs.length;
    const hours = members.reduce((acc, m) => acc + (m.hoursThisWeek || 0), 0);
    return { activeMembers, pendingMembers, totalSubs, hours };
  }, [members, subs]);

  const filterCounts = useMemo(() => {
    if (tab === "members") {
      return {
        all: members.length,
        active: members.filter((m) => m.invitationStatus === "accepted" && m.status !== "off_today" && m.status !== "inactive").length,
        pending: members.filter((m) => m.invitationStatus !== "accepted").length,
        off: members.filter((m) => m.status === "off_today").length,
        inactive: members.filter((m) => m.status === "inactive").length,
      };
    }
    return {
      all: subs.length,
      active: subs.filter((s) => s.status === "active" || s.status === "accepted").length,
      pending: subs.filter((s) => s.status === "pending").length,
      off: 0,
      inactive: subs.filter((s) => s.status === "revoked" || s.status === "expired").length,
    };
  }, [tab, members, subs]);

  const handleAddChoice = (kind: "member" | "magic_link" | "account_sub") => {
    setAddOpen(false);
    if (kind === "member") {
      if (!hasTeamPlan) {
        toast({
          title: "Team Plan needed",
          description: "Inviting members needs a Team plan ($99.99/mo flat). Upgrading now.",
        });
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

  return (
    <div className="flex-1 overflow-y-auto" data-testid="page-team">
      <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-12 max-w-[1400px] mx-auto">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-team-title">Team</h1>
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-success/10 text-success flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-success animate-pulse" />
                {stats.activeMembers + stats.totalSubs} active
              </span>
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
                      Permanent staff with email login & role-based access.
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
                      Recurring sub with their own dashboard & invoicing.
                    </div>
                    <Badge variant="secondary" className="mt-1 text-[10px]">Team Plan · $99.99/mo flat</Badge>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stat cards */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <StatCard label="Active members" value={hasTeamPlan ? stats.activeMembers : 0} delta={hasTeamPlan ? `${stats.activeMembers} on payroll` : "Locked"} deltaPositive />
          <StatCard label="Pending invites" value={hasTeamPlan ? stats.pendingMembers : 0} delta={stats.pendingMembers > 0 ? "Awaiting accept" : "All caught up"} sparkColor="hsl(35 90% 50%)" />
          <StatCard label="Subcontractors" value={stats.totalSubs} delta="Magic-link + account" deltaPositive sparkColor="hsl(280 55% 58%)" />
          <StatCard label="Hours this week" value={`${stats.hours}h`} delta={stats.hours > 0 ? "Across team" : "—"} deltaPositive sparkColor="hsl(145 65% 42%)" />
        </div>

        {/* Tabs */}
        <div className="border-b flex items-center flex-wrap gap-y-1">
          {([
            ["members", "Members", filterCounts.all, Users, hasTeamPlan ? members.length : 0],
            ["subcontractors", "Subcontractors", subs.length, Link2, subs.length],
            ["subinvoices", "Sub Invoices", 0, Receipt, null],
          ] as const).map(([key, label, _, Icon, count]) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => { setTab(key as TabKey); setFilter("all"); }}
                data-testid={`tab-${key}`}
                className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
                  active ? "text-foreground border-foreground" : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {count !== null && (
                  <span className={`text-[10.5px] font-medium px-1.5 py-px rounded ${active ? "bg-foreground/10 text-foreground" : "bg-muted text-muted-foreground"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-1 pb-1.5">
            <Button variant="ghost" size="sm" className="text-[12px] text-muted-foreground" onClick={() => setLocation("/team-operations")} data-testid="button-roles-permissions">
              Roles & permissions
            </Button>
            <Button variant="ghost" size="sm" className="text-[12px] text-muted-foreground" onClick={() => setLocation("/team-operations")} data-testid="button-activity-log">
              Activity log
            </Button>
          </div>
        </div>

        {/* Sub-filters + search */}
        {tab !== "subinvoices" && (
        <div className="flex items-center gap-2 py-3.5 flex-wrap">
          {([
            ["all", "All", filterCounts.all],
            ["active", "Active", filterCounts.active],
            ["pending", "Pending", filterCounts.pending],
            ...(tab === "members" ? [["off", "On time off", filterCounts.off] as const] : []),
            ["inactive", "Inactive", filterCounts.inactive],
          ] as const).map(([key, label, count]) => {
            const active = filter === key;
            return (
              <Button
                key={key}
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(key as SubFilter)}
                data-testid={`filter-${key}`}
                className="h-7"
              >
                {label} <span className={`text-[10px] ml-1 ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{count}</span>
              </Button>
            );
          })}
          <div className="relative ml-auto">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team or subs…"
              className="h-8 w-64 pl-8 text-[12.5px]"
              data-testid="input-team-search"
            />
          </div>
        </div>
        )}

        {/* Tab content */}
        <div className={tab === "subinvoices" ? "relative min-h-[420px] pt-3.5" : "relative"}>
          {tab === "members" && !hasTeamPlan && (
            <PlanLockOverlay
              onUpgrade={() => setLocation("/pricing")}
              message={isPro
                ? "You're on Pro (single user). Upgrade to Team to invite staff — $99.99/mo flat — up to 5 team members."
                : "Inviting team members requires a Team plan. Subs are still available on Pro."
              }
            />
          )}

          {tab === "members" ? (
            <MembersTable
              members={filteredMembers}
              loading={membersQuery.isLoading && hasTeamPlan}
              showLockedSample={!hasTeamPlan}
            />
          ) : tab === "subinvoices" ? (
            isFree ? (
              <PlanLockOverlay
                onUpgrade={() => setLocation("/pricing")}
                message="Reviewing and paying subcontractor invoices needs a paid plan. Upgrade to unlock."
              />
            ) : (
              <SubcontractorInvoices embedded />
            )
          ) : (
            <SubcontractorsTable
              rows={filteredSubs}
              loading={subsQuery.isLoading}
              onSendNew={() => handleAddChoice("magic_link")}
              onUpgrade={(sub) => {
                if (!hasTeamPlan) {
                  toast({ title: "Team Plan needed", description: "Upgrading subs to accounts needs a Team plan." });
                  setLocation("/pricing");
                  return;
                }
                setUpgradeSubTarget(sub);
                setUpgradeSubOpen(true);
              }}
            />
          )}
        </div>

        {/* Below-the-fold add-chooser tiles (always-visible, plan-aware) */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <AddTile
            icon={UserPlus}
            iconColor="hsl(217 91% 53%)"
            title="Invite member"
            desc="Permanent staff with email login & role-based access."
            tag={hasTeamPlan ? "Team Plan" : "Upgrade required"}
            tagColor={hasTeamPlan ? "hsl(217 91% 53%)" : "hsl(35 90% 50%)"}
            locked={!hasTeamPlan}
            onClick={() => handleAddChoice("member")}
            testId="tile-invite-member"
          />
          <AddTile
            icon={Link2}
            iconColor="hsl(280 55% 58%)"
            title="Magic-link sub"
            desc="One-job access via SMS — no app, no account needed. Free for the sub."
            tag={isFree ? "Pro+ required" : "Free with Pro+"}
            tagColor="hsl(280 55% 58%)"
            locked={isFree}
            onClick={() => handleAddChoice("magic_link")}
            testId="tile-magic-link"
          />
          <AddTile
            icon={ShieldCheck}
            iconColor="hsl(145 65% 42%)"
            title="Account subcontractor"
            desc="Recurring sub with their own dashboard, invoicing, and history."
            tag={hasTeamPlan ? "$99.99/mo flat" : "Team Plan needed"}
            tagColor={hasTeamPlan ? "hsl(145 65% 42%)" : "hsl(35 90% 50%)"}
            locked={!hasTeamPlan}
            onClick={() => handleAddChoice("account_sub")}
            testId="tile-account-sub"
          />
        </div>
      </div>

      {/* Send Magic Link Sheet */}
      <SendMagicLinkSheet
        open={sendLinkOpen}
        onOpenChange={setSendLinkOpen}
        onSent={() => {
          subsQuery.refetch();
        }}
      />

      {/* Invite Member Sheet — real form */}
      <InviteMemberSheet
        open={inviteMemberOpen}
        onOpenChange={setInviteMemberOpen}
        mode="member"
      />

      {/* Account Sub Invite Sheet — real form, role pre-selected to Subcontractor */}
      <InviteMemberSheet
        open={inviteAccountSubOpen}
        onOpenChange={setInviteAccountSubOpen}
        mode="account_sub"
      />

      {/* Upgrade magic-link → account sub */}
      <UpgradeSubSheet
        open={upgradeSubOpen}
        onOpenChange={setUpgradeSubOpen}
        sub={upgradeSubTarget}
      />
    </div>
  );
}

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

  // For account_sub: only show Subcontractor role; pre-select it.
  // For member: show every non-Subcontractor role.
  const filteredRoles = useMemo(() => {
    if (mode === "account_sub") {
      return roles.filter((r) => (r.name || "").toLowerCase() === "subcontractor");
    }
    return roles.filter((r) => (r.name || "").toLowerCase() !== "subcontractor");
  }, [roles, mode]);

  // Auto-select the only sensible role when sheet opens
  useMemo(() => {
    if (!open) return;
    if (roleId) return;
    if (mode === "account_sub" && filteredRoles.length === 1) {
      setRoleId(filteredRoles[0].id);
    }
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
      toast({
        title: "Invitation sent",
        description: `${email} has been invited.`,
      });
      onOpenChange(false);
      setFirstName(""); setLastName(""); setEmail(""); setPhone(""); setHourlyRate(""); setRoleId("");
    },
    onError: (err: any) => {
      const raw = err?.message || "";
      let msg = raw;
      if (raw.startsWith("team_plan_required:")) msg = raw.replace(/^team_plan_required:\s*/, "");
      toast({
        title: "Could not send invite",
        description: msg || "Please check the details and try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: "Email required", variant: "destructive" });
      return;
    }
    if (!roleId) {
      toast({ title: "Role required", variant: "destructive" });
      return;
    }
    inviteMutation.mutate();
  };

  const isAccountSub = mode === "account_sub";
  const title = isAccountSub ? "Add an account subcontractor" : "Invite a team member";
  const desc = isAccountSub
    ? "Invite a sub who'll have their own login and can submit invoices to you. included in $99.99/mo Team plan."
    : "Permanent staff with email login & role-based access. included in $99.99/mo Team plan.";

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
              <Input
                id={`${mode}-fn`}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jamie"
                data-testid={`input-${mode}-firstname`}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${mode}-ln`}>Last name</Label>
              <Input
                id={`${mode}-ln`}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                data-testid={`input-${mode}-lastname`}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${mode}-email`}>Email <span className="text-destructive">*</span></Label>
            <Input
              id={`${mode}-email`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jamie@example.com"
              required
              data-testid={`input-${mode}-email`}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${mode}-phone`}>Phone (optional)</Label>
            <Input
              id={`${mode}-phone`}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0400 000 000"
              data-testid={`input-${mode}-phone`}
            />
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
                  <SelectItem key={r.id} value={r.id} data-testid={`role-option-${r.name.toLowerCase()}`}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isAccountSub && (
              <p className="text-[11.5px] text-muted-foreground">
                Account subs are always assigned the Subcontractor role.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${mode}-rate`}>Hourly rate (optional)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                id={`${mode}-rate`}
                type="number"
                min="0"
                step="0.01"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="0.00"
                className="pl-7"
                data-testid={`input-${mode}-rate`}
              />
            </div>
          </div>
          <SheetFooter className="mt-auto pt-4 flex-row gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid={`button-${mode}-cancel`}>
              Cancel
            </Button>
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

function UpgradeSubSheet({
  open, onOpenChange, sub,
}: { open: boolean; onOpenChange: (v: boolean) => void; sub: SubcontractorRow | null }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");

  // Pre-fill from the existing sub each time the sheet opens
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
      toast({
        title: "Could not upgrade subcontractor",
        description: msg || "Please check the details and try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: "Email required to send the account invite", variant: "destructive" });
      return;
    }
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
              <Input
                id="upgrade-fn"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                data-testid="input-upgrade-firstname"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="upgrade-ln">Last name</Label>
              <Input
                id="upgrade-ln"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                data-testid="input-upgrade-lastname"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="upgrade-email">Email <span className="text-destructive">*</span></Label>
            <Input
              id="upgrade-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sub@example.com"
              required
              data-testid="input-upgrade-email"
            />
            <p className="text-[11.5px] text-muted-foreground">Required so we can send the account-setup link.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="upgrade-rate">Hourly rate (optional)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                id="upgrade-rate"
                type="number"
                min="0"
                step="0.01"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="0.00"
                className="pl-7"
                data-testid="input-upgrade-rate"
              />
            </div>
          </div>
          <SheetFooter className="mt-auto pt-4 flex-row gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-upgrade-cancel">
              Cancel
            </Button>
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

function AddTile({
  icon: Icon, iconColor, title, desc, tag, tagColor, locked, onClick, testId,
}: {
  icon: any; iconColor: string; title: string; desc: string;
  tag: string; tagColor: string; locked: boolean; onClick: () => void; testId: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className="group text-left p-4 bg-card rounded-md border hover-elevate active-elevate-2 transition-colors relative"
    >
      <div className="flex items-start justify-between mb-2.5 gap-2">
        <div
          className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in oklch, ${iconColor} 12%, transparent)`, color: iconColor }}
        >
          <Icon className="w-4 h-4" />
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded inline-flex items-center gap-1"
          style={{ background: `color-mix(in oklch, ${tagColor} 12%, transparent)`, color: tagColor }}
        >
          {locked && <Lock className="w-2.5 h-2.5" />}
          {tag}
        </span>
      </div>
      <div className="text-[13.5px] font-semibold mb-0.5">{title}</div>
      <div className="text-[12px] text-muted-foreground leading-relaxed">{desc}</div>
    </button>
  );
}

function MembersTable({
  members, loading, showLockedSample,
}: { members: TeamMember[]; loading: boolean; showLockedSample: boolean }) {
  const sample: TeamMember[] = showLockedSample ? [
    { id: "s1", firstName: "Sarah", lastName: "Chen", role: "manager", status: "active", invitationStatus: "accepted", lastActiveAt: new Date(Date.now() - 120000).toISOString(), hoursThisWeek: 38 },
    { id: "s2", firstName: "Marcus", lastName: "Johnson", role: "tradie", status: "active", invitationStatus: "accepted", lastActiveAt: new Date().toISOString(), hoursThisWeek: 42 },
    { id: "s3", firstName: "Tom", lastName: "Reilly", role: "tradie", status: "off_today", invitationStatus: "accepted", lastActiveAt: new Date(Date.now() - 3 * 86400000).toISOString(), hoursThisWeek: 0 },
  ] : [];

  const rows = showLockedSample ? sample : members;

  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
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

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <h3 className="font-semibold text-base mb-1">No team members yet</h3>
          <p className="text-sm text-muted-foreground">Invite your first team member to get started.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr_120px_44px] px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/40 border-b">
        <div>Member</div>
        <div>Role</div>
        <div>Status</div>
        <div>Last active</div>
        <div>Hours / wk</div>
        <div></div>
      </div>
      {rows.map((m) => {
        const name = `${m.firstName || ""} ${m.lastName || ""}`.trim() || "Unknown";
        const status = m.invitationStatus !== "accepted" ? "pending" : m.status === "off_today" ? "away" : m.status === "inactive" ? "inactive" : "on";
        const init = initialsFor(m.firstName, m.lastName);
        const color = colorFromString(m.id || name);

        return (
          <div
            key={m.id}
            data-testid={`row-member-${m.id}`}
            onClick={() => { if (!showLockedSample) setLocation("/team-operations"); }}
            className="grid grid-cols-[1.6fr_1fr_1fr_1fr_120px_44px] px-4 py-3 items-center text-[13px] border-b last:border-0 hover-elevate group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-full text-white text-[11px] font-semibold flex items-center justify-center" style={{ background: color }}>
                  {init}
                </div>
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-background ${
                  status === "on" ? "bg-success" : status === "away" ? "bg-purple-500" : status === "pending" ? "bg-warning" : "bg-muted-foreground"
                }`} />
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{name}</div>
                <div className="text-[11.5px] text-muted-foreground truncate">{m.email || m.phone || `@${(m.firstName || "user").toLowerCase()}`}</div>
              </div>
            </div>
            <div>
              <Badge variant="secondary" className="text-[11px] capitalize">{m.role || "member"}</Badge>
            </div>
            <div className="text-[11.5px] font-medium flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${
                status === "on" ? "bg-success" : status === "away" ? "bg-purple-500" : status === "pending" ? "bg-warning" : "bg-muted-foreground"
              }`} />
              <span className={
                status === "on" ? "text-success" : status === "away" ? "text-purple-600" : status === "pending" ? "text-warning" : "text-muted-foreground"
              }>
                {status === "on" ? "Active" : status === "away" ? "On time off" : status === "pending" ? "Pending" : "Inactive"}
              </span>
            </div>
            <div className="text-[12.5px] text-muted-foreground tabular-nums">{timeAgo(m.lastActiveAt)}</div>
            <div className="text-[12.5px] tabular-nums font-medium">{m.hoursThisWeek ? `${m.hoursThisWeek}h` : "—"}</div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
              {showLockedSample ? (
                <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-4 h-4" /></Button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`button-member-row-actions-${m.id}`}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {status === "pending" && (
                      <DropdownMenuItem
                        onSelect={(e) => { e.preventDefault(); resendMutation.mutate(m.id); }}
                        disabled={resendMutation.isPending}
                        data-testid={`action-resend-invite-${m.id}`}
                      >
                        {resendMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Resend invite
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={(e) => { e.preventDefault(); setRemoveTarget(m); }}
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
      })}
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
    </Card>
  );
}

function SubcontractorsTable({
  rows, loading, onSendNew, onUpgrade,
}: {
  rows: SubcontractorRow[];
  loading: boolean;
  onSendNew: () => void;
  onUpgrade: (sub: SubcontractorRow) => void;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <Link2 className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <h3 className="font-semibold text-base mb-1">No subcontractors yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Send a magic-link to a sub for instant one-job access — no app required.</p>
          <Button onClick={onSendNew} data-testid="button-send-first-link">
            <Link2 className="w-4 h-4" /> Send first magic link
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr_120px_44px] px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/40 border-b">
        <div>Subcontractor</div>
        <div>Type</div>
        <div>Status</div>
        <div>Last activity</div>
        <div>Jobs</div>
        <div></div>
      </div>
      {rows.map((s) => {
        const init = initialsFor(undefined, undefined, s.name);
        const color = colorFromString(s.id);
        const kindLabel = s.kind === "magic_link" ? "Magic link" : s.kind === "account_sub" ? "Account" : "Connected";
        const kindColor = s.kind === "magic_link" ? "hsl(280 55% 58%)" : s.kind === "account_sub" ? "hsl(145 65% 42%)" : "hsl(217 91% 53%)";

        return (
          <div
            key={s.id}
            data-testid={`row-sub-${s.id}`}
            className="grid grid-cols-[1.6fr_1fr_1fr_1fr_120px_44px] px-4 py-3 items-center text-[13px] border-b last:border-0 hover-elevate group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full text-white text-[11px] font-semibold flex items-center justify-center flex-shrink-0" style={{ background: color }}>
                {init}
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{s.name}</div>
                <div className="text-[11.5px] text-muted-foreground truncate">
                  {s.contactPhone || s.contactEmail || s.businessName || s.trade || "—"}
                </div>
              </div>
            </div>
            <div>
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded inline-flex items-center gap-1"
                style={{ background: `color-mix(in oklch, ${kindColor} 12%, transparent)`, color: kindColor }}
              >
                {s.kind === "magic_link" ? <Link2 className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                {kindLabel}
              </span>
            </div>
            <div className="text-[11.5px] font-medium flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${
                s.status === "active" || s.status === "accepted" ? "bg-success" :
                s.status === "pending" ? "bg-warning" :
                s.status === "revoked" || s.status === "expired" ? "bg-destructive" : "bg-muted-foreground"
              }`} />
              <span className="capitalize">{s.status}</span>
            </div>
            <div className="text-[12.5px] text-muted-foreground tabular-nums">{timeAgo(s.lastActivity)}</div>
            <div className="text-[12.5px] tabular-nums font-medium">{s.jobsCount ?? 0}</div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`button-sub-row-actions-${s.id}`}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {s.kind === "magic_link" && (
                    <DropdownMenuItem
                      onSelect={(e) => { e.preventDefault(); onUpgrade(s); }}
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
      })}
    </Card>
  );
}
