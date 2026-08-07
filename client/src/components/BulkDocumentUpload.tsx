import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest, getAuthHeaders } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  UploadCloud, FileText, Image as ImageIcon, File as FileIcon, Trash2,
  CheckCircle2, XCircle, Loader2, ClipboardList, BadgeCheck, ShieldCheck,
  FolderOpen, ExternalLink, Plus,
} from "lucide-react";
import { useLocation } from "wouter";

const DOC_TYPES = [
  { value: "swms", label: "SWMS / JSA", hasExpiry: false },
  { value: "licence", label: "Licence", hasExpiry: true },
  { value: "insurance", label: "Insurance", hasExpiry: true },
  { value: "white_card", label: "White Card", hasExpiry: true },
  { value: "training", label: "Training / Certificate", hasExpiry: true },
  { value: "other", label: "Other", hasExpiry: true },
] as const;

type DocType = typeof DOC_TYPES[number]["value"];

const ACCEPT = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.heic";
const MAX_SIZE = 100 * 1024 * 1024;

interface PendingFile {
  id: string;
  file: File;
  title: string;
  type: DocType;
  personKey: string; // "" = none, otherwise team member key
  expiryDate: string; // yyyy-mm-dd or ""
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
  destination?: string;
}

interface TeamMemberOption {
  key: string;
  name: string;
  userId: string | null;
  teamMemberId: string | null;
}

function guessType(name: string): DocType {
  const n = name.toLowerCase();
  if (n.includes("swms") || n.includes("jsa") || n.includes("safe work") || n.includes("risk assess") || n.includes("method statement")) return "swms";
  if (n.includes("white card") || n.includes("whitecard")) return "white_card";
  if (n.includes("insur") || n.includes("policy") || n.includes("liability")) return "insurance";
  if (n.includes("licen")) return "licence";
  if (n.includes("cert") || n.includes("training") || n.includes("first aid") || n.includes("cpr") || n.includes("course")) return "training";
  return "other";
}

function titleFromFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function attachmentTypeFor(file: File): string {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return "pdf";
  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|heic)$/i.test(file.name)) return "image";
  return "doc";
}

function fileIcon(file: File) {
  const t = attachmentTypeFor(file);
  if (t === "pdf") return <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />;
  if (t === "image") return <ImageIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />;
  return <FileIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
}

const DESTINATION_META: Record<string, { label: string; icon: typeof ClipboardList; section?: string; href?: string }> = {
  swms: { label: "WHS Hub → SWMS & JSA", icon: ClipboardList, section: "swms" },
  training: { label: "WHS Hub → Training", icon: BadgeCheck, section: "training" },
  compliance: { label: "Compliance Records (Files)", icon: ShieldCheck, href: "/files" },
};

function destinationFor(type: DocType): string {
  if (type === "swms") return "swms";
  if (type === "training") return "training";
  return "compliance";
}

interface BulkDocumentUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateSection?: (section: string) => void;
}

export function BulkDocumentUpload({ open, onOpenChange, onNavigateSection }: BulkDocumentUploadProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [finished, setFinished] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const { data: teamMembersRaw = [] } = useQuery<any[]>({
    queryKey: ["/api/team/members"],
    enabled: open,
    staleTime: 60_000,
  });

  const teamMembers: TeamMemberOption[] = (Array.isArray(teamMembersRaw) ? teamMembersRaw : []).map((m: any, i: number) => ({
    key: m.id || m.memberId || String(i),
    name: m.displayName || [m.firstName, m.lastName].filter(Boolean).join(" ") || m.name || m.email || "Team member",
    userId: m.memberId || null,
    teamMemberId: m.id || null,
  }));

  const addFiles = (list: FileList | File[]) => {
    const next: PendingFile[] = [];
    for (const file of Array.from(list)) {
      if (file.size > MAX_SIZE) {
        toast({ title: `${file.name} is too large`, description: "Files must be under 100MB", variant: "destructive" });
        continue;
      }
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        title: titleFromFilename(file.name),
        type: guessType(file.name),
        personKey: "",
        expiryDate: "",
        status: "pending",
      });
    }
    if (next.length > 0) setFiles(prev => [...prev, ...next]);
  };

  const updateFile = (id: string, patch: Partial<PendingFile>) => {
    setFiles(prev => prev.map(f => (f.id === id ? { ...f, ...patch } : f)));
  };

  const reset = () => {
    setFiles([]);
    setFinished(false);
    setUploading(false);
  };

  const handleClose = (o: boolean) => {
    if (uploading) return;
    onOpenChange(o);
    if (!o) reset();
  };

  async function uploadOne(pf: PendingFile): Promise<void> {
    // 1. Upload the raw file to private compliance storage
    const formData = new FormData();
    formData.append("file", pf.file);
    formData.append("type", "compliance");
    const uploadRes = await fetch("/api/upload", {
      method: "POST",
      body: formData,
      credentials: "include",
      headers: getAuthHeaders(),
    });
    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}));
      throw new Error(err.error || `Upload failed (${uploadRes.status})`);
    }
    const { url } = await uploadRes.json();
    const attachmentType = attachmentTypeFor(pf.file);
    const person = teamMembers.find(m => m.key === pf.personKey);

    // 2. File it into the right existing area
    if (pf.type === "swms") {
      await apiRequest("POST", "/api/swms", {
        title: pf.title || pf.file.name,
        description: "Uploaded document",
        status: "active",
        attachmentUrl: url,
        attachmentType,
      });
    } else if (pf.type === "training") {
      await apiRequest("POST", "/api/whs/training-records", {
        workerName: person?.name || "Unassigned",
        teamMemberId: person?.teamMemberId || null,
        courseCode: "CERT",
        courseName: pf.title || pf.file.name,
        completionDate: new Date().toISOString().slice(0, 10),
        expiryDate: pf.expiryDate || null,
        certificateNumber: null,
        status: "current",
        attachmentUrl: url,
        attachmentType,
        notes: "Bulk uploaded document",
      });
    } else {
      await apiRequest("POST", "/api/compliance-documents", {
        type: pf.type,
        title: pf.title || pf.file.name,
        holderName: person?.name || null,
        holderUserId: person?.userId || null,
        expiryDate: pf.expiryDate ? new Date(pf.expiryDate).toISOString() : null,
        attachmentUrl: url,
        attachmentType,
      });
    }
  }

  const handleUploadAll = async () => {
    if (files.length === 0) return;
    setUploading(true);
    for (const pf of files) {
      if (pf.status === "done") continue;
      updateFile(pf.id, { status: "uploading", error: undefined });
      try {
        await uploadOne(pf);
        updateFile(pf.id, { status: "done", destination: destinationFor(pf.type) });
      } catch (e: any) {
        updateFile(pf.id, { status: "error", error: e?.message || "Failed" });
      }
    }
    setUploading(false);
    setFinished(true);
    queryClient.invalidateQueries({ queryKey: ["/api/whs/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/swms"] });
    queryClient.invalidateQueries({ queryKey: ["/api/whs/training-records"] });
    queryClient.invalidateQueries({ queryKey: ["/api/compliance-documents"] });
  };

  const doneFiles = files.filter(f => f.status === "done");
  const errorFiles = files.filter(f => f.status === "error");
  const allDone = finished && errorFiles.length === 0;

  const goTo = (dest: string) => {
    const meta = DESTINATION_META[dest];
    onOpenChange(false);
    reset();
    if (meta?.href) {
      setLocation(meta.href);
    } else if (meta?.section && onNavigateSection) {
      onNavigateSection(meta.section);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5" />
            Bulk Document Upload
          </DialogTitle>
          <DialogDescription>
            Bring your SWMS, licences, insurance, white cards and training certificates in one go.
            Each file is filed into the right place with expiry reminders where relevant.
          </DialogDescription>
        </DialogHeader>

        {!finished && (
          <>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
              }}
              data-testid="bulk-upload-dropzone"
            >
              <UploadCloud className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Drop files here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, Word documents and images — up to 100MB each</p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPT}
                className="hidden"
                onChange={e => {
                  if (e.target.files?.length) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {files.length > 0 && (
              <div className="space-y-3">
                {files.map(pf => {
                  const typeMeta = DOC_TYPES.find(t => t.value === pf.type)!;
                  return (
                    <div key={pf.id} className={`p-3 rounded-lg border space-y-2 ${pf.status === "error" ? "border-destructive/50" : ""}`}>
                      <div className="flex items-center gap-2">
                        {fileIcon(pf.file)}
                        <span className="text-sm font-medium truncate flex-1" title={pf.file.name}>{pf.file.name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {(pf.file.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                        {pf.status === "uploading" && <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />}
                        {pf.status === "done" && <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />}
                        {pf.status === "error" && <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />}
                        {pf.status === "pending" && !uploading && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0"
                            onClick={() => setFiles(prev => prev.filter(f => f.id !== pf.id))}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      {pf.status === "error" && (
                        <p className="text-xs text-destructive">{pf.error}</p>
                      )}
                      {pf.status !== "done" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Title</Label>
                            <Input
                              value={pf.title}
                              onChange={e => updateFile(pf.id, { title: e.target.value })}
                              disabled={uploading}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Type</Label>
                            <Select value={pf.type} onValueChange={v => updateFile(pf.id, { type: v as DocType })} disabled={uploading}>
                              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {DOC_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Person (optional)</Label>
                            <Select
                              value={pf.personKey || "none"}
                              onValueChange={v => updateFile(pf.id, { personKey: v === "none" ? "" : v })}
                              disabled={uploading}
                            >
                              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="None" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {teamMembers.map(m => <SelectItem key={m.key} value={m.key}>{m.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              {typeMeta.hasExpiry ? "Expiry (optional)" : "Expiry"}
                            </Label>
                            {typeMeta.hasExpiry ? (
                              <Input
                                type="date"
                                value={pf.expiryDate}
                                onChange={e => updateFile(pf.id, { expiryDate: e.target.value })}
                                disabled={uploading}
                                className="h-8 text-sm"
                              />
                            ) : (
                              <div className="h-8 flex items-center text-xs text-muted-foreground">Not applicable</div>
                            )}
                          </div>
                        </div>
                      )}
                      {pf.status !== "done" && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <FolderOpen className="w-3 h-3" />
                          Files to: {DESTINATION_META[destinationFor(pf.type)].label}
                          {typeMeta.hasExpiry && pf.expiryDate && destinationFor(pf.type) === "compliance" && (
                            <Badge variant="secondary" className="text-[10px] py-0 ml-1">Expiry reminders on</Badge>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <p className="text-xs text-muted-foreground">
                {files.length > 0 ? `${files.length} file${files.length !== 1 ? "s" : ""} ready` : ""}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleClose(false)} disabled={uploading}>Cancel</Button>
                <Button onClick={handleUploadAll} disabled={files.length === 0 || uploading} data-testid="button-bulk-upload-all">
                  {uploading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading…</>) : (<><UploadCloud className="w-4 h-4 mr-2" /> Upload {files.length > 0 ? files.length : ""} file{files.length !== 1 ? "s" : ""}</>)}
                </Button>
              </div>
            </div>
          </>
        )}

        {finished && (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border flex items-center gap-3 ${allDone ? "border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40" : "border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40"}`}>
              {allDone
                ? <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                : <XCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />}
              <div>
                <p className="text-sm font-semibold">
                  {doneFiles.length} of {files.length} document{files.length !== 1 ? "s" : ""} filed
                </p>
                <p className="text-xs text-muted-foreground">
                  {errorFiles.length > 0
                    ? `${errorFiles.length} failed — you can retry them below.`
                    : "Everything is organised. Expiry reminders will fire automatically for dated documents."}
                </p>
              </div>
            </div>

            {doneFiles.length > 0 && (
              <div className="space-y-2">
                {(["swms", "training", "compliance"] as const).map(dest => {
                  const group = doneFiles.filter(f => f.destination === dest);
                  if (group.length === 0) return null;
                  const meta = DESTINATION_META[dest];
                  const Icon = meta.icon;
                  return (
                    <div key={dest} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Icon className="w-4 h-4 text-primary" /> {meta.label}
                          <Badge variant="secondary" className="text-xs">{group.length}</Badge>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => goTo(dest)}>
                          View <ExternalLink className="w-3 h-3 ml-1" />
                        </Button>
                      </div>
                      <ul className="space-y-1">
                        {group.map(f => (
                          <li key={f.id} className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />
                            <span className="truncate">{f.title || f.file.name}</span>
                            {f.expiryDate && <span className="flex-shrink-0">· expires {new Date(f.expiryDate).toLocaleDateString("en-AU")}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}

            {errorFiles.length > 0 && (
              <div className="p-3 rounded-lg border border-destructive/50 space-y-1">
                <p className="text-sm font-medium text-destructive">Failed uploads</p>
                {errorFiles.map(f => (
                  <p key={f.id} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <XCircle className="w-3 h-3 text-destructive flex-shrink-0" />
                    <span className="truncate">{f.file.name}</span> — {f.error}
                  </p>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              {errorFiles.length > 0 && (
                <Button variant="outline" onClick={() => { setFinished(false); }}>
                  <Plus className="w-4 h-4 mr-1" /> Retry failed
                </Button>
              )}
              <Button onClick={() => handleClose(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
