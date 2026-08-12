import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as globalQueryClient } from "@/lib/queryClient";
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  Plus,
  Edit2,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  CalendarDays,
  FileText,
} from "lucide-react";

interface TeamMember {
  id: string;
  memberId: string | null;
  firstName: string | null;
  lastName: string | null;
  inviteStatus: string;
}

interface Skill {
  id: string;
  teamMemberId: string;
  skillName: string;
  skillType: string;
  licenseNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  isVerified: boolean;
  notes: string | null;
}

type ExpiryStatus = "expired" | "expiring-soon" | "expiring-60" | "valid" | "no-expiry";

function getExpiryStatus(expiryDate: string | null): ExpiryStatus {
  if (!expiryDate) return "no-expiry";
  const expiry = new Date(expiryDate);
  const now = new Date();
  const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil <= 0) return "expired";
  if (daysUntil <= 30) return "expiring-soon";
  if (daysUntil <= 60) return "expiring-60";
  return "valid";
}

function getDaysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const expiry = new Date(expiryDate);
  const now = new Date();
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function ExpiryBadge({ expiryDate }: { expiryDate: string | null }) {
  const status = getExpiryStatus(expiryDate);
  const days = getDaysUntilExpiry(expiryDate);

  if (status === "no-expiry") {
    return <Badge variant="outline" className="text-muted-foreground">No expiry</Badge>;
  }
  if (status === "expired") {
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Expired</Badge>;
  }
  if (status === "expiring-soon") {
    return <Badge className="gap-1 bg-orange-500 hover:bg-orange-600 text-white"><AlertTriangle className="h-3 w-3" />Exp. in {days}d</Badge>;
  }
  if (status === "expiring-60") {
    return <Badge className="gap-1 bg-yellow-500 hover:bg-yellow-600 text-white"><Clock className="h-3 w-3" />Exp. in {days}d</Badge>;
  }
  return <Badge className="gap-1 bg-green-600 hover:bg-green-700 text-white"><CheckCircle2 className="h-3 w-3" />Valid</Badge>;
}

const SKILL_TYPES = ["certification", "license", "training", "skill"] as const;
const COMMON_SKILLS = [
  "White Card (Construction Induction)",
  "Electrical Licence",
  "Plumbing Licence",
  "Gas Fitting Licence",
  "First Aid Certificate",
  "Working at Heights",
  "Confined Space Entry",
  "Forklift Licence",
  "EWP (Elevated Work Platform)",
  "Asbestos Awareness",
  "Driver's Licence",
  "Security Licence",
  "Custom",
];

export default function StaffLicences() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterMember, setFilterMember] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [deleteSkillId, setDeleteSkillId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    teamMemberId: "",
    skillName: "",
    customSkillName: "",
    skillType: "license" as string,
    licenseNumber: "",
    issueDate: "",
    expiryDate: "",
    notes: "",
  });

  const { data: members = [], isLoading: membersLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/team/members"],
  });

  const { data: skills = [], isLoading: skillsLoading } = useQuery<Skill[]>({
    queryKey: ["/api/team/skills"],
  });

  const acceptedMembers = useMemo(
    () => members.filter((m) => m.inviteStatus === "accepted"),
    [members]
  );

  const memberMap = useMemo(() => {
    const map: Record<string, TeamMember> = {};
    for (const m of acceptedMembers) map[m.id] = m;
    return map;
  }, [acceptedMembers]);

  const getMemberName = (memberId: string) => {
    const m = memberMap[memberId];
    return m ? `${m.firstName || ""} ${m.lastName || ""}`.trim() || "Unknown" : "Unknown";
  };

  // Derived stats
  const stats = useMemo(() => {
    let expired = 0, expiringSoon = 0, expiring60 = 0, valid = 0, noExpiry = 0;
    for (const s of skills) {
      const status = getExpiryStatus(s.expiryDate);
      if (status === "expired") expired++;
      else if (status === "expiring-soon") expiringSoon++;
      else if (status === "expiring-60") expiring60++;
      else if (status === "valid") valid++;
      else noExpiry++;
    }
    return { expired, expiringSoon, expiring60, valid, noExpiry };
  }, [skills]);

  // Filtered and sorted skills
  const filteredSkills = useMemo(() => {
    let result = [...skills];

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.skillName.toLowerCase().includes(lower) ||
          getMemberName(s.teamMemberId).toLowerCase().includes(lower) ||
          (s.licenseNumber || "").toLowerCase().includes(lower)
      );
    }

    if (filterMember !== "all") {
      result = result.filter((s) => s.teamMemberId === filterMember);
    }

    if (filterStatus !== "all") {
      result = result.filter((s) => getExpiryStatus(s.expiryDate) === filterStatus);
    }

    if (filterType !== "all") {
      result = result.filter((s) => s.skillType === filterType);
    }

    // Sort by urgency: expired first, then expiring-soon, then expiring-60, then valid, then no-expiry
    const urgencyOrder: Record<ExpiryStatus, number> = {
      expired: 0,
      "expiring-soon": 1,
      "expiring-60": 2,
      valid: 3,
      "no-expiry": 4,
    };
    result.sort((a, b) => {
      const ao = urgencyOrder[getExpiryStatus(a.expiryDate)];
      const bo = urgencyOrder[getExpiryStatus(b.expiryDate)];
      if (ao !== bo) return ao - bo;
      // Within same category, sort by date ascending
      if (a.expiryDate && b.expiryDate) {
        return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
      }
      return 0;
    });

    return result;
  }, [skills, searchTerm, filterMember, filterStatus, filterType, memberMap]);

  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/team/skills", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/team/skills"] });
      toast({ title: "Licence added" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/team/skills/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/team/skills"] });
      toast({ title: "Licence updated" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/team/skills/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/team/skills"] });
      toast({ title: "Licence deleted" });
      setDeleteSkillId(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, isVerified }: { id: string; isVerified: boolean }) =>
      apiRequest("PATCH", `/api/team/skills/${id}`, { isVerified }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/team/skills"] });
      toast({ title: "Verification updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openAdd() {
    setEditingSkill(null);
    setForm({ teamMemberId: "", skillName: "", customSkillName: "", skillType: "license", licenseNumber: "", issueDate: "", expiryDate: "", notes: "" });
    setDialogOpen(true);
  }

  function openEdit(skill: Skill) {
    setEditingSkill(skill);
    const isCommon = COMMON_SKILLS.includes(skill.skillName) && skill.skillName !== "Custom";
    setForm({
      teamMemberId: skill.teamMemberId,
      skillName: isCommon ? skill.skillName : "Custom",
      customSkillName: isCommon ? "" : skill.skillName,
      skillType: skill.skillType,
      licenseNumber: skill.licenseNumber || "",
      issueDate: skill.issueDate ? skill.issueDate.split("T")[0] : "",
      expiryDate: skill.expiryDate ? skill.expiryDate.split("T")[0] : "",
      notes: skill.notes || "",
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingSkill(null);
  }

  function handleSubmit() {
    const effectiveName = form.skillName === "Custom" ? form.customSkillName : form.skillName;
    if (!form.teamMemberId || !effectiveName) {
      toast({ title: "Required fields missing", description: "Select a team member and enter a licence name.", variant: "destructive" });
      return;
    }

    const payload: any = {
      teamMemberId: form.teamMemberId,
      skillName: effectiveName,
      skillType: form.skillType,
    };
    if (form.licenseNumber) payload.licenseNumber = form.licenseNumber;
    if (form.issueDate) payload.issueDate = form.issueDate;
    if (form.expiryDate) payload.expiryDate = form.expiryDate;
    if (form.notes) payload.notes = form.notes;

    if (editingSkill) {
      updateMutation.mutate({ id: editingSkill.id, ...payload });
    } else {
      addMutation.mutate(payload);
    }
  }

  const isLoading = membersLoading || skillsLoading;

  return (
    <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Staff Licences & Compliance
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track and manage your team's licences, certifications, and tickets
          </p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Licence
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold text-red-700">{stats.expired}</p>
                <p className="text-xs text-red-600">Expired</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold text-orange-700">{stats.expiringSoon}</p>
                <p className="text-xs text-orange-600">Exp. within 30d</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold text-yellow-700">{stats.expiring60}</p>
                <p className="text-xs text-yellow-600">Exp. within 60d</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-700">{stats.valid + stats.noExpiry}</p>
                <p className="text-xs text-green-600">Valid</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, licence number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterMember} onValueChange={setFilterMember}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="All workers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All workers</SelectItem>
                {acceptedMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {`${m.firstName || ""} ${m.lastName || ""}`.trim() || "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="expiring-soon">Expiring ≤ 30d</SelectItem>
                <SelectItem value="expiring-60">Expiring ≤ 60d</SelectItem>
                <SelectItem value="valid">Valid</SelectItem>
                <SelectItem value="no-expiry">No expiry</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {SKILL_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            All Licences{" "}
            <span className="text-muted-foreground font-normal text-sm">
              ({filteredSkills.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No licences found</p>
              <p className="text-sm mt-1">
                {skills.length === 0
                  ? "Add your first licence to get started"
                  : "Try adjusting your filters"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker</TableHead>
                    <TableHead>Licence / Certificate</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Number</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSkills.map((skill) => (
                    <TableRow key={skill.id} className={
                      getExpiryStatus(skill.expiryDate) === "expired"
                        ? "bg-red-50/50 dark:bg-red-950/10"
                        : getExpiryStatus(skill.expiryDate) === "expiring-soon"
                        ? "bg-orange-50/50 dark:bg-orange-950/10"
                        : ""
                    }>
                      <TableCell className="font-medium">
                        {getMemberName(skill.teamMemberId)}
                      </TableCell>
                      <TableCell>{skill.skillName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize text-xs">
                          {skill.skillType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {skill.licenseNumber || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {skill.expiryDate
                          ? new Date(skill.expiryDate).toLocaleDateString("en-AU")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <ExpiryBadge expiryDate={skill.expiryDate} />
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() =>
                            verifyMutation.mutate({ id: skill.id, isVerified: !skill.isVerified })
                          }
                          className="text-sm"
                        >
                          {skill.isVerified ? (
                            <Badge className="bg-blue-600 text-white gap-1 cursor-pointer hover:bg-blue-700">
                              <CheckCircle2 className="h-3 w-3" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                              Unverified
                            </Badge>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(skill)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteSkillId(skill.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSkill ? "Edit Licence" : "Add Licence"}</DialogTitle>
            <DialogDescription>
              {editingSkill
                ? "Update the licence details below."
                : "Add a licence or certification for a team member."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Team Member *</Label>
              <Select
                value={form.teamMemberId}
                onValueChange={(v) => setForm((f) => ({ ...f, teamMemberId: v }))}
                disabled={!!editingSkill}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select worker..." />
                </SelectTrigger>
                <SelectContent>
                  {acceptedMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {`${m.firstName || ""} ${m.lastName || ""}`.trim() || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Licence / Certificate *</Label>
              <Select
                value={form.skillName}
                onValueChange={(v) => setForm((f) => ({ ...f, skillName: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select or type..." />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_SKILLS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.skillName === "Custom" && (
                <Input
                  placeholder="Enter licence name..."
                  value={form.customSkillName}
                  onChange={(e) => setForm((f) => ({ ...f, customSkillName: e.target.value }))}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={form.skillType}
                  onValueChange={(v) => setForm((f) => ({ ...f, skillType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SKILL_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Licence Number</Label>
                <Input
                  placeholder="e.g. QLD-12345"
                  value={form.licenseNumber}
                  onChange={(e) => setForm((f) => ({ ...f, licenseNumber: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Issue Date</Label>
                <Input
                  type="date"
                  value={form.issueDate}
                  onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Optional notes about this licence..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={addMutation.isPending || updateMutation.isPending}
            >
              {editingSkill ? "Save Changes" : "Add Licence"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteSkillId} onOpenChange={(o) => !o && setDeleteSkillId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Licence?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this licence record. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSkillId && deleteMutation.mutate(deleteSkillId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
