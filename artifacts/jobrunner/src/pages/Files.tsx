import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import PhotoLibraryTab from "@/components/PhotoLibraryTab";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Search,
  Shield,
  FileCheck,
  HardHat,
  Car,
  Award,
  File,
  Paperclip,
  MoreVertical,
  Edit,
  Trash2,
  FileText,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  Upload,
  X,
  Loader2,
} from "lucide-react";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/compact-card";
import { apiRequest, queryClient, getSessionToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { ComplianceDocument } from "@shared/schema";

function isPrivateObjectUrl(url: string): boolean {
  return url.startsWith("/objects/.private/") || url.includes("/objects/.private/");
}

// Renders an attachment image; private compliance objects can't be loaded via a
// direct <img src> (the request can't carry the auth token), so mint a signed URL first.
function AttachmentImage({ url, className }: { url: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(isPrivateObjectUrl(url) ? null : url);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (isPrivateObjectUrl(url)) {
      setSrc(null);
      setFailed(false);
      apiRequest("POST", "/api/objects/sign-download", { path: url })
        .then(res => res.json())
        .then(({ url: signed }) => { if (!cancelled) setSrc(signed); })
        .catch(() => { if (!cancelled) setFailed(true); });
    } else {
      setSrc(url);
    }
    return () => { cancelled = true; };
  }, [url]);

  if (failed) return <p className="text-xs text-muted-foreground">Couldn't load attachment preview</p>;
  if (!src) return <div className={`bg-muted animate-pulse h-40 ${className || ""}`} />;
  return <img src={src} alt="Document attachment" className={className} />;
}

const typeConfig: Record<string, { label: string; icon: typeof Shield }> = {
  licence: { label: "Licence", icon: Shield },
  insurance: { label: "Insurance", icon: FileCheck },
  white_card: { label: "White Card", icon: HardHat },
  vehicle_rego: { label: "Vehicle Rego", icon: Car },
  certification: { label: "Certification", icon: Award },
  other: { label: "Other", icon: File },
};

const filterTabs = [
  { value: "all", label: "All" },
  { value: "licence", label: "Licences" },
  { value: "insurance", label: "Insurance" },
  { value: "white_card", label: "White Cards" },
  { value: "vehicle_rego", label: "Vehicle Rego" },
  { value: "certification", label: "Certifications" },
  { value: "other", label: "Other" },
];

function getExpiryStatus(expiryDate: string | Date | null): "current" | "expiring" | "expired" {
  if (!expiryDate) return "current";
  const now = new Date();
  const expiry = new Date(expiryDate);
  if (expiry < now) return "expired";
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  if (expiry <= thirtyDays) return "expiring";
  return "current";
}

function ExpiryBadge({ expiryDate }: { expiryDate: string | Date | null }) {
  const status = getExpiryStatus(expiryDate);
  if (status === "expired") {
    return <Badge variant="secondary" className="bg-destructive/10 text-destructive">Expired</Badge>;
  }
  if (status === "expiring") {
    return <Badge variant="secondary" className="bg-warning/10 text-warning">Expiring Soon</Badge>;
  }
  return <Badge variant="secondary" className="bg-success/10 text-success">Current</Badge>;
}

const defaultFormData = {
  type: "licence",
  title: "",
  documentNumber: "",
  issuer: "",
  holderName: "",
  expiryDate: "",
  coverageAmount: "",
  insurer: "",
  vehiclePlate: "",
  attachmentUrl: "",
  notes: "",
};

export default function FilesPage() {
  const { toast } = useToast();
  const [pageTab, setPageTab] = useState<"documents" | "photos">("documents");
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ComplianceDocument | null>(null);
  const [selectedItem, setSelectedItem] = useState<ComplianceDocument | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ComplianceDocument | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const handleFileUpload = async (file: globalThis.File) => {
    if (file.size > 100 * 1024 * 1024) {
      toast({ title: "File must be under 100MB", variant: "destructive" });
      return;
    }
    setUploadingFile(true);
    setSelectedFileName(file.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "compliance");
      const token = getSessionToken();
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const { url } = await res.json();
      if (!url) throw new Error("No URL returned");
      setFormData(prev => ({ ...prev, attachmentUrl: url }));
      toast({ title: "File uploaded" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
      setSelectedFileName(null);
    } finally {
      setUploadingFile(false);
    }
  };

  const { data: documents = [], isLoading } = useQuery<ComplianceDocument[]>({
    queryKey: ["/api/compliance-documents"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await apiRequest("POST", "/api/compliance-documents", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-documents"] });
      setDialogOpen(false);
      setFormData(defaultFormData);
      toast({ title: "Document added" });
    },
    onError: () => {
      toast({ title: "Failed to add document", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      await apiRequest("PATCH", `/api/compliance-documents/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-documents"] });
      setEditingItem(null);
      setDialogOpen(false);
      setFormData(defaultFormData);
      toast({ title: "Document updated" });
    },
    onError: () => {
      toast({ title: "Failed to update document", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/compliance-documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-documents"] });
      setSelectedItem(null);
      setDeleteTarget(null);
      toast({ title: "Document deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete document", variant: "destructive" });
    },
  });

  const kpiData = useMemo(() => {
    const total = documents.length;
    let current = 0;
    let expiring = 0;
    let expired = 0;
    documents.forEach((doc) => {
      const status = getExpiryStatus(doc.expiryDate);
      if (status === "current") current++;
      else if (status === "expiring") expiring++;
      else expired++;
    });
    return { total, current, expiring, expired };
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    let filtered = documents;
    if (activeTab !== "all") {
      filtered = filtered.filter((d) => d.type === activeTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.documentNumber?.toLowerCase().includes(q) ||
          d.holderName?.toLowerCase().includes(q) ||
          d.issuer?.toLowerCase().includes(q) ||
          d.vehiclePlate?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [documents, activeTab, searchQuery]);

  function openCreate() {
    setEditingItem(null);
    setFormData(defaultFormData);
    setSelectedFileName(null);
    setDialogOpen(true);
  }

  function openEdit(doc: ComplianceDocument) {
    setEditingItem(doc);
    setFormData({
      type: doc.type,
      title: doc.title,
      documentNumber: doc.documentNumber || "",
      issuer: doc.issuer || "",
      holderName: doc.holderName || "",
      expiryDate: doc.expiryDate ? format(new Date(doc.expiryDate), "yyyy-MM-dd") : "",
      coverageAmount: doc.coverageAmount || "",
      insurer: doc.insurer || "",
      vehiclePlate: doc.vehiclePlate || "",
      attachmentUrl: doc.attachmentUrl || "",
      notes: doc.notes || "",
    });
    setSelectedFileName(doc.attachmentUrl ? doc.attachmentUrl.split("/").pop() || "Existing file" : null);
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!formData.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    const payload: Record<string, unknown> = {
      type: formData.type,
      title: formData.title.trim(),
      documentNumber: formData.documentNumber.trim() || null,
      issuer: formData.issuer.trim() || null,
      holderName: formData.holderName.trim() || null,
      expiryDate: formData.expiryDate || null,
      coverageAmount: formData.coverageAmount.trim() || null,
      insurer: formData.insurer.trim() || null,
      vehiclePlate: formData.vehiclePlate.trim() || null,
      attachmentUrl: formData.attachmentUrl.trim() || null,
      attachmentType: formData.attachmentUrl ? (formData.attachmentUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? "image" : "pdf") : null,
      notes: formData.notes.trim() || null,
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function isImageUrl(url: string | null): boolean {
    if (!url) return false;
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  }

  async function openAttachment(url: string) {
    if (!isPrivateObjectUrl(url)) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    const win = window.open("", "_blank");
    try {
      const res = await apiRequest("POST", "/api/objects/sign-download", { path: url });
      const { url: signed } = await res.json();
      if (win) win.location.href = signed;
      else window.open(signed, "_blank");
    } catch {
      win?.close();
      toast({ title: "Couldn't open attachment", variant: "destructive" });
    }
  }

  if (isLoading) {
    return (
      <PageShell>
        <PageHeader title="Files" subtitle="Licences, insurance, certifications & compliance" />
        <div className="space-y-3">
          <div className="feed-card p-5 animate-fade-up">
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="feed-card p-4 animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3 mt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="feed-card p-4 animate-fade-up" style={{ animationDelay: `${(i + 3) * 60}ms` }}>
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title="Files" subtitle="Documents, photos & compliance" />

      <div className="section-gap">
        <div className="feed-card overflow-x-auto no-scrollbar mb-4 animate-fade-up">
          <div className="flex items-center gap-1 p-1.5">
            {[
              { value: "documents" as const, label: "Documents" },
              { value: "photos" as const, label: "Photos" },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setPageTab(tab.value)}
                className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  pageTab === tab.value ? 'text-foreground' : 'text-muted-foreground'
                }`}
                style={pageTab === tab.value ? { backgroundColor: 'hsl(var(--trade) / 0.1)', color: 'hsl(var(--trade))' } : undefined}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {pageTab === "photos" ? (
          <PhotoLibraryTab />
        ) : (
        <>
        <div className="animate-fade-up">
          <p className="ios-label mb-3">Overview</p>
          <div className="feed-card card-press p-5 mb-3 animate-fade-up stagger-delay-1"
               style={{ background: 'linear-gradient(135deg, hsl(var(--trade) / 0.06) 0%, hsl(var(--card)) 100%)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="ios-label mb-1">Total Documents</p>
                <p className="text-[36px] font-bold tracking-tight leading-none">{kpiData.total}</p>
                <p className="ios-caption mt-1">Compliance documents tracked</p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                <FileText className="h-6 w-6" style={{ color: 'hsl(var(--trade))' }} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="feed-card card-press p-4 animate-fade-up stagger-delay-2">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ backgroundColor: 'hsl(var(--success) / 0.1)' }}>
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
              </div>
              <p className="text-xl font-bold">{kpiData.current}</p>
              <p className="ios-caption">Current</p>
            </div>
            <div className="feed-card card-press p-4 animate-fade-up stagger-delay-3">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ backgroundColor: 'hsl(var(--warning) / 0.1)' }}>
                  <AlertTriangle className="h-5 w-5 text-warning" />
                </div>
              </div>
              <p className="text-xl font-bold">{kpiData.expiring}</p>
              <p className="ios-caption">Expiring</p>
            </div>
            <div className="feed-card card-press p-4 animate-fade-up stagger-delay-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ backgroundColor: 'hsl(var(--destructive) / 0.1)' }}>
                  <XCircle className="h-5 w-5 text-destructive" />
                </div>
              </div>
              <p className="text-xl font-bold">{kpiData.expired}</p>
              <p className="ios-caption">Expired</p>
            </div>
          </div>
        </div>

        <div className="animate-fade-up stagger-delay-4">
          <div className="feed-card overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1 p-1.5">
              {filterTabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    activeTab === tab.value
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  }`}
                  style={activeTab === tab.value ? { backgroundColor: 'hsl(var(--trade) / 0.1)', color: 'hsl(var(--trade))' } : undefined}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 animate-fade-up stagger-delay-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => {
              window.open('/api/compliance-documents/export/pack', '_blank');
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Pack
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Document
          </Button>
        </div>

        {filteredDocuments.length === 0 ? (
          <div className="animate-fade-up stagger-delay-6">
            <div className="feed-card text-center py-12 px-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
                   style={{ background: 'linear-gradient(135deg, hsl(var(--trade) / 0.15), hsl(var(--trade) / 0.05))' }}>
                <Shield className="h-10 w-10" style={{ color: 'hsl(var(--trade))' }} />
              </div>
              <p className="text-lg font-semibold mb-1">
                {searchQuery || activeTab !== "all" ? "No documents found" : "Start tracking compliance"}
              </p>
              <p className="ios-caption mb-6 max-w-xs mx-auto">
                {searchQuery || activeTab !== "all"
                  ? "Try adjusting your filters or search terms."
                  : "Keep all your licences, insurance, and certifications organised and up to date in one place."}
              </p>
              {!searchQuery && activeTab === "all" && (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Document
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div>
            <p className="ios-label mb-3">
              Documents {filteredDocuments.length !== documents.length && `(${filteredDocuments.length})`}
            </p>
            <div className="feed-gap">
              {filteredDocuments.map((doc, index) => {
                const config = typeConfig[doc.type] || typeConfig.other;
                const TypeIcon = config.icon;
                const status = getExpiryStatus(doc.expiryDate);
                const iconBg = status === "expired"
                  ? 'hsl(var(--destructive) / 0.1)'
                  : status === "expiring"
                    ? 'hsl(var(--warning) / 0.1)'
                    : 'hsl(var(--trade) / 0.1)';
                const iconColor = status === "expired"
                  ? 'hsl(var(--destructive))'
                  : status === "expiring"
                    ? 'hsl(var(--warning))'
                    : 'hsl(var(--trade))';

                return (
                  <div
                    key={doc.id}
                    className={`feed-card card-press cursor-pointer animate-fade-up stagger-delay-${Math.min(index + 1, 8)}`}
                    onClick={() => setSelectedItem(doc)}
                  >
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                             style={{ backgroundColor: iconBg }}>
                          <TypeIcon className="h-5 w-5" style={{ color: iconColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-[15px] truncate">{doc.title}</p>
                            <ExpiryBadge expiryDate={doc.expiryDate} />
                          </div>
                          <div className="flex items-center gap-3 ios-caption mt-0.5 flex-wrap">
                            <span>{config.label}</span>
                            {doc.documentNumber && <span>#{doc.documentNumber}</span>}
                            {doc.holderName && <span>{doc.holderName}</span>}
                            {doc.expiryDate && (
                              <span>Exp: {format(new Date(doc.expiryDate), "dd MMM yyyy")}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {doc.attachmentUrl && (
                            <Paperclip className="h-4 w-4 text-muted-foreground" />
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(doc); }}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); setDeleteTarget(doc); }}
                                className="text-red-600 dark:text-red-400"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Document" : "Add Document"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="licence">Licence</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="white_card">White Card</SelectItem>
                  <SelectItem value="vehicle_rego">Vehicle Rego</SelectItem>
                  <SelectItem value="certification">Certification</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. QBCC Builder Licence"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Document Number</Label>
              <Input
                value={formData.documentNumber}
                onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Issuer</Label>
              <Input
                value={formData.issuer}
                onChange={(e) => setFormData({ ...formData, issuer: e.target.value })}
                placeholder="e.g. QBCC, SafeWork"
              />
            </div>
            {formData.type === "white_card" && (
              <div className="space-y-1.5">
                <Label>Holder Name</Label>
                <Input
                  value={formData.holderName}
                  onChange={(e) => setFormData({ ...formData, holderName: e.target.value })}
                  placeholder="Name of card holder"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Expiry Date</Label>
              <Input
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              />
            </div>
            {formData.type === "insurance" && (
              <>
                <div className="space-y-1.5">
                  <Label>Coverage Amount</Label>
                  <Input
                    value={formData.coverageAmount}
                    onChange={(e) => setFormData({ ...formData, coverageAmount: e.target.value })}
                    placeholder="e.g. $20,000,000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Insurer</Label>
                  <Input
                    value={formData.insurer}
                    onChange={(e) => setFormData({ ...formData, insurer: e.target.value })}
                    placeholder="e.g. QBE, Allianz"
                  />
                </div>
              </>
            )}
            {formData.type === "vehicle_rego" && (
              <div className="space-y-1.5">
                <Label>Vehicle Plate</Label>
                <Input
                  value={formData.vehiclePlate}
                  onChange={(e) => setFormData({ ...formData, vehiclePlate: e.target.value })}
                  placeholder="e.g. ABC 123"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Attachment</Label>
              {formData.attachmentUrl && selectedFileName ? (
                <div className="flex items-center gap-2 p-2.5 rounded-md border bg-muted/30">
                  <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm truncate flex-1">{selectedFileName}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setFormData({ ...formData, attachmentUrl: "" });
                      setSelectedFileName(null);
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 p-4 rounded-md border-2 border-dashed cursor-pointer hover-elevate transition-colors">
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                      e.target.value = "";
                    }}
                    disabled={uploadingFile}
                  />
                  {uploadingFile ? (
                    <>
                      <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                      <span className="text-sm text-muted-foreground">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Tap to upload photo or document</span>
                    </>
                  )}
                </label>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending || uploadingFile}
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingItem ? "Save Changes" : "Add Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent className="overflow-y-auto">
          {selectedItem && (() => {
            const config = typeConfig[selectedItem.type] || typeConfig.other;
            const TypeIcon = config.icon;
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <TypeIcon className="h-5 w-5" />
                    {selectedItem.title}
                  </SheetTitle>
                </SheetHeader>
                <div className="space-y-5 mt-6">
                  <div className="flex items-center gap-2">
                    <ExpiryBadge expiryDate={selectedItem.expiryDate} />
                    <Badge variant="secondary">{config.label}</Badge>
                  </div>

                  <div className="space-y-3">
                    {selectedItem.documentNumber && (
                      <div>
                        <p className="text-xs text-muted-foreground">Document Number</p>
                        <p className="text-sm font-medium">{selectedItem.documentNumber}</p>
                      </div>
                    )}
                    {selectedItem.issuer && (
                      <div>
                        <p className="text-xs text-muted-foreground">Issuer</p>
                        <p className="text-sm font-medium">{selectedItem.issuer}</p>
                      </div>
                    )}
                    {selectedItem.holderName && (
                      <div>
                        <p className="text-xs text-muted-foreground">Holder Name</p>
                        <p className="text-sm font-medium">{selectedItem.holderName}</p>
                      </div>
                    )}
                    {selectedItem.expiryDate && (
                      <div>
                        <p className="text-xs text-muted-foreground">Expiry Date</p>
                        <p className="text-sm font-medium">{format(new Date(selectedItem.expiryDate), "dd MMMM yyyy")}</p>
                      </div>
                    )}
                    {selectedItem.coverageAmount && (
                      <div>
                        <p className="text-xs text-muted-foreground">Coverage Amount</p>
                        <p className="text-sm font-medium">{selectedItem.coverageAmount}</p>
                      </div>
                    )}
                    {selectedItem.insurer && (
                      <div>
                        <p className="text-xs text-muted-foreground">Insurer</p>
                        <p className="text-sm font-medium">{selectedItem.insurer}</p>
                      </div>
                    )}
                    {selectedItem.vehiclePlate && (
                      <div>
                        <p className="text-xs text-muted-foreground">Vehicle Plate</p>
                        <p className="text-sm font-medium">{selectedItem.vehiclePlate}</p>
                      </div>
                    )}
                    {selectedItem.notes && (
                      <div>
                        <p className="text-xs text-muted-foreground">Notes</p>
                        <p className="text-sm">{selectedItem.notes}</p>
                      </div>
                    )}
                    {selectedItem.createdAt && (
                      <div>
                        <p className="text-xs text-muted-foreground">Added</p>
                        <p className="text-sm text-muted-foreground">{format(new Date(selectedItem.createdAt), "dd MMM yyyy")}</p>
                      </div>
                    )}
                  </div>

                  {selectedItem.attachmentUrl && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Attachment</p>
                      {isImageUrl(selectedItem.attachmentUrl) ? (
                        <AttachmentImage
                          url={selectedItem.attachmentUrl}
                          className="rounded-md max-w-full border"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => selectedItem.attachmentUrl && openAttachment(selectedItem.attachmentUrl)}
                          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="h-4 w-4" />
                          View Attachment
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setSelectedItem(null);
                        openEdit(selectedItem);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => setDeleteTarget(selectedItem)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
      )}
      </div>
    </PageShell>
  );
}
