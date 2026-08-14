/**
 * SiteDiarySection — web component for the daily site diary.
 * Shows a newest-first timeline of entries. Staff can add today's entry;
 * entries older than 24 h are read-only unless the user is owner/manager.
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, parseISO, differenceInHours } from "date-fns";
import {
  BookOpen, Plus, ChevronDown, ChevronUp, Cloud, Sun, CloudRain,
  Wind, Loader2, Pencil, Trash2, Camera, X, Users, AlertTriangle,
  FileText, Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { apiRequest, queryClient, getAuthHeaders } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppMode } from "@/hooks/use-app-mode";

const WEATHER_OPTIONS = [
  { value: "sunny", label: "Sunny", icon: Sun },
  { value: "partly_cloudy", label: "Partly Cloudy", icon: Cloud },
  { value: "overcast", label: "Overcast", icon: Cloud },
  { value: "light_rain", label: "Light Rain", icon: CloudRain },
  { value: "heavy_rain", label: "Heavy Rain", icon: CloudRain },
  { value: "windy", label: "Windy", icon: Wind },
  { value: "storm", label: "Storm", icon: CloudRain },
  { value: "hot", label: "Hot", icon: Sun },
  { value: "cold", label: "Cold", icon: Wind },
  { value: "foggy", label: "Foggy", icon: Cloud },
] as const;

interface SiteDiaryEntry {
  id: string;
  jobId: string;
  userId: string;
  entryDate: string;
  weather: string | null;
  workersOnSite: string[];
  workDone: string | null;
  issuesDelays: string | null;
  photoKeys: string[];
  photoUrls?: string[];
  authorName?: string;
  createdAt: string;
  updatedAt: string;
}

interface SiteDiarySectionProps {
  jobId: string;
  canEdit?: boolean;
  /** The authenticated user's own ID — used to gate edit/delete to the entry author. */
  currentUserId?: string;
}

function weatherLabel(w: string | null): string {
  if (!w) return "";
  return WEATHER_OPTIONS.find((o) => o.value === w)?.label ?? w;
}

function WeatherIcon({ weather }: { weather: string | null }) {
  if (!weather) return null;
  const opt = WEATHER_OPTIONS.find((o) => o.value === weather);
  if (!opt) return null;
  const Icon = opt.icon;
  return <Icon className="h-3.5 w-3.5" />;
}

function isWithin24Hours(createdAt: string): boolean {
  return differenceInHours(new Date(), parseISO(createdAt)) < 24;
}

interface EntryFormState {
  entryDate: string;
  weather: string;
  workersOnSite: string;
  workDone: string;
  issuesDelays: string;
}

const EMPTY_FORM: EntryFormState = {
  entryDate: format(new Date(), "yyyy-MM-dd"),
  weather: "",
  workersOnSite: "",
  workDone: "",
  issuesDelays: "",
};

export function SiteDiarySection({ jobId, canEdit = true, currentUserId }: SiteDiarySectionProps) {
  const { toast } = useToast();
  const { userRole } = useAppMode();
  const isOwnerOrManager = userRole === "owner" || userRole === "manager";

  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<SiteDiaryEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState<EntryFormState>(EMPTY_FORM);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);

  const { data: entries = [], isLoading } = useQuery<SiteDiaryEntry[]>({
    queryKey: ["/api/jobs", jobId, "diary"],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/diary`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error("Failed to load site diary");
      }
      return res.json();
    },
    enabled: !!jobId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch(`/api/jobs/${jobId}/diary`, {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: data,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create diary entry");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "diary"] });
      closeForm();
      toast({ title: "Diary entry saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const res = await fetch(`/api/jobs/${jobId}/diary/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: getAuthHeaders(),
        body: data,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update diary entry");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "diary"] });
      closeForm();
      toast({ title: "Diary entry updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/jobs/${jobId}/diary/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete entry");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "diary"] });
      toast({ title: "Entry deleted" });
      setDeletingId(null);
    },
    onError: () => {
      toast({ title: "Error deleting entry", variant: "destructive" });
      setDeletingId(null);
    },
  });

  function openNew() {
    setEditingEntry(null);
    setForm({ ...EMPTY_FORM, entryDate: format(new Date(), "yyyy-MM-dd") });
    setPhotoFiles([]);
    setPhotoPreviewUrls([]);
    setShowForm(true);
  }

  function openEdit(entry: SiteDiaryEntry) {
    setEditingEntry(entry);
    setForm({
      entryDate: entry.entryDate,
      weather: entry.weather ?? "",
      workersOnSite: entry.workersOnSite.join(", "),
      workDone: entry.workDone ?? "",
      issuesDelays: entry.issuesDelays ?? "",
    });
    setPhotoFiles([]);
    setPhotoPreviewUrls([]);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingEntry(null);
    setForm(EMPTY_FORM);
    setPhotoFiles([]);
    setPhotoPreviewUrls([]);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setPhotoFiles((prev) => [...prev, ...files]);
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setPhotoPreviewUrls((prev) => [...prev, ...newPreviews]);
  }

  function removeNewPhoto(idx: number) {
    URL.revokeObjectURL(photoPreviewUrls[idx]);
    setPhotoFiles((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPreviewUrls((prev) => prev.filter((_, i) => i !== idx));
  }

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.append("entryDate", form.entryDate);
    if (form.weather) fd.append("weather", form.weather);
    const workers = form.workersOnSite
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    fd.append("workersOnSite", JSON.stringify(workers));
    if (form.workDone) fd.append("workDone", form.workDone);
    if (form.issuesDelays) fd.append("issuesDelays", form.issuesDelays);
    for (const file of photoFiles) {
      fd.append("photos", file);
    }
    return fd;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.entryDate) return;
    const fd = buildFormData();
    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data: fd });
    } else {
      createMutation.mutate(fd);
    }
  }

  // Owner/manager can edit any entry; staff can only edit their own within 24 h.
  const canEditEntry = (entry: SiteDiaryEntry) => {
    if (!canEdit) return false;
    if (isOwnerOrManager) return true;
    return entry.userId === currentUserId && isWithin24Hours(entry.createdAt);
  };

  // Staff authors can delete their own entry within 24 h; owners/managers can delete any.
  const canDeleteEntry = (entry: SiteDiaryEntry) => {
    if (!canEdit) return false;
    if (isOwnerOrManager) return true;
    return entry.userId === currentUserId && isWithin24Hours(entry.createdAt);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Card data-testid="card-site-diary">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BookOpen className="h-4 w-4" style={{ color: "hsl(var(--trade))" }} />
            Site Diary
            {entries.length > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {entries.length} {entries.length === 1 ? "entry" : "entries"}
              </Badge>
            )}
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                className="ml-auto h-7 gap-1 text-xs"
                onClick={openNew}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Entry
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: "hsl(var(--muted) / 0.5)" }}
              >
                <BookOpen className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">No diary entries yet</p>
              <p className="text-xs text-muted-foreground/70">
                Record who was on site, what was done, and any issues each day.
              </p>
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4 gap-1"
                  onClick={openNew}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Today's Entry
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => {
                const expanded = expandedId === entry.id;
                const editable = canEditEntry(entry);
                const locked = !editable && canEdit;
                return (
                  <div
                    key={entry.id}
                    className="border rounded-lg overflow-hidden"
                  >
                    {/* Header row */}
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
                      onClick={() => setExpandedId(expanded ? null : entry.id)}
                    >
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <WeatherIcon weather={entry.weather} />
                      </div>
                      <span className="font-medium text-sm">
                        {format(parseISO(entry.entryDate), "EEE d MMM yyyy")}
                      </span>
                      {entry.weather && (
                        <Badge variant="outline" className="text-xs py-0 h-5">
                          {weatherLabel(entry.weather)}
                        </Badge>
                      )}
                      {locked && (
                        <Lock className="h-3 w-3 text-muted-foreground/60 ml-1" aria-label="Locked after 24 h" />
                      )}
                      {entry.workersOnSite.length > 0 && (
                        <span className="text-xs text-muted-foreground ml-auto mr-1 flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {entry.workersOnSite.length}
                        </span>
                      )}
                      {expanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </button>

                    {/* Body */}
                    {expanded && (
                      <div className="px-3 pb-3 border-t bg-muted/20">
                        {entry.workersOnSite.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                              <Users className="h-3 w-3" /> Workers on site
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {entry.workersOnSite.map((w) => (
                                <Badge key={w} variant="secondary" className="text-xs">
                                  {w}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {entry.workDone && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                              <FileText className="h-3 w-3" /> Work done
                            </p>
                            <p className="text-sm whitespace-pre-wrap">{entry.workDone}</p>
                          </div>
                        )}
                        {entry.issuesDelays && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-amber-500" /> Issues / delays
                            </p>
                            <p className="text-sm whitespace-pre-wrap text-amber-800 dark:text-amber-300">
                              {entry.issuesDelays}
                            </p>
                          </div>
                        )}
                        {entry.photoUrls && entry.photoUrls.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                              <Camera className="h-3 w-3" /> Photos ({entry.photoUrls.length})
                            </p>
                            <div className="grid grid-cols-3 gap-1.5">
                              {entry.photoUrls.map((url, i) => (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block aspect-square rounded overflow-hidden border hover:opacity-90 transition-opacity"
                                >
                                  <img
                                    src={url}
                                    alt={`Photo ${i + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground/60 mt-3">
                          Added by {entry.authorName ?? "staff"} ·{" "}
                          {format(parseISO(entry.createdAt), "d MMM yyyy h:mm a")}
                        </p>
                        {(canEditEntry(entry) || canDeleteEntry(entry)) && (
                          <div className="flex gap-2 mt-3">
                            {canEditEntry(entry) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 text-xs"
                                onClick={() => openEdit(entry)}
                              >
                                <Pencil className="h-3 w-3" /> Edit
                              </Button>
                            )}
                            {canDeleteEntry(entry) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                                onClick={() => setDeletingId(entry.id)}
                              >
                                <Trash2 className="h-3 w-3" /> Delete
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "Edit Diary Entry" : "New Diary Entry"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="diary-date">Date</Label>
                <Input
                  id="diary-date"
                  type="date"
                  value={form.entryDate}
                  onChange={(e) => setForm((f) => ({ ...f, entryDate: e.target.value }))}
                  required
                  disabled={!!editingEntry}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="diary-weather">Weather</Label>
                <Select
                  value={form.weather}
                  onValueChange={(v) => setForm((f) => ({ ...f, weather: v }))}
                >
                  <SelectTrigger id="diary-weather">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {WEATHER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="diary-workers">Workers on site</Label>
              <Input
                id="diary-workers"
                placeholder="e.g. John Smith, Maria Garcia, Subco Ltd"
                value={form.workersOnSite}
                onChange={(e) => setForm((f) => ({ ...f, workersOnSite: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Separate names with commas</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="diary-work">Summary of work done</Label>
              <Textarea
                id="diary-work"
                placeholder="What was completed today?"
                value={form.workDone}
                onChange={(e) => setForm((f) => ({ ...f, workDone: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="diary-issues">Issues / delays</Label>
              <Textarea
                id="diary-issues"
                placeholder="Any problems, delays, or incidents?"
                value={form.issuesDelays}
                onChange={(e) => setForm((f) => ({ ...f, issuesDelays: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Photos</Label>
              <label
                htmlFor="diary-photos"
                className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-dashed rounded-md text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Camera className="h-4 w-4" /> Attach photos
                <input
                  id="diary-photos"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </label>
              {photoPreviewUrls.length > 0 && (
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {photoPreviewUrls.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded overflow-hidden border group">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeNewPhoto(i)}
                        className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !form.entryDate}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingEntry ? "Save Changes" : "Save Entry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete diary entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The entry and any attached photos will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
