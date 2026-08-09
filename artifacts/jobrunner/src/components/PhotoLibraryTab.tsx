import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Camera,
  Upload,
  Image as ImageIcon,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Trash2,
  Tag,
  FolderOpen,
  Briefcase,
  Users,
  HardDrive,
  TrendingUp,
  Calendar,
  Loader2,
  Download,
  Plus,
  Edit,
  SlidersHorizontal,
  ArrowUpDown,
} from "lucide-react";
import { apiRequest, queryClient, getAuthHeaders} from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns";

interface PhotoItem {
  id: string;
  userId: string;
  jobId: string | null;
  objectStorageKey: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  category: string | null;
  caption: string | null;
  takenAt: string | null;
  uploadedBy: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  tags: string[];
  sortOrder: number;
  createdAt: string;
  jobTitle: string | null;
  jobStatus: string | null;
  clientId: string | null;
  clientName: string | null;
  url: string;
}

interface PhotoStats {
  totalPhotos: number;
  thisWeek: number;
  categoryBreakdown: Record<string, number>;
  storageUsedBytes: number;
  storageUsedFormatted: string;
  mostPhotographedJob: { jobId: string; title: string; count: number } | null;
}

const CATEGORY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "before", label: "Before" },
  { value: "progress", label: "During" },
  { value: "after", label: "After" },
  { value: "materials", label: "Materials" },
  { value: "general", label: "General" },
];

const CATEGORY_COLORS: Record<string, string> = {
  before: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  progress: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  after: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  materials: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  general: "bg-muted text-muted-foreground",
  damage: "bg-destructive/15 text-destructive",
};

function getCategoryLabel(cat: string | null): string {
  if (!cat) return "General";
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function getDateGroupLabel(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isThisWeek(date)) return "This Week";
  if (isThisMonth(date)) return format(date, "MMMM yyyy");
  return format(date, "MMMM yyyy");
}

export default function PhotoLibraryTab() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [jobFilter, setJobFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoItem | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [bulkJobDialogOpen, setBulkJobDialogOpen] = useState(false);
  const [bulkCategoryDialogOpen, setBulkCategoryDialogOpen] = useState(false);
  const [bulkTagDialogOpen, setBulkTagDialogOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<PhotoItem | null>(null);

  const queryParams = new URLSearchParams();
  if (categoryFilter !== "all") queryParams.set("category", categoryFilter);
  if (jobFilter) queryParams.set("jobId", jobFilter);
  if (clientFilter) queryParams.set("clientId", clientFilter);
  queryParams.set("sortBy", sortBy);
  queryParams.set("sortOrder", sortOrder);

  const { data: photos = [], isLoading: photosLoading } = useQuery<PhotoItem[]>({
    queryKey: ["/api/photos", categoryFilter, jobFilter, clientFilter, sortBy, sortOrder],
    queryFn: async () => {
      const res = await fetch(`/api/photos?${queryParams.toString()}`, { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to load photos");
      return res.json();
    },
  });

  const { data: stats } = useQuery<PhotoStats>({
    queryKey: ["/api/photos/stats"],
    queryFn: async () => {
      const res = await fetch("/api/photos/stats", { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
  });

  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: allClients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  const { data: existingTags = [] } = useQuery<string[]>({
    queryKey: ["/api/photos/tags"],
    queryFn: async () => {
      const res = await fetch("/api/photos/tags", { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const bulkActionMutation = useMutation({
    mutationFn: async (payload: any) => {
      await apiRequest("PATCH", "/api/photos/bulk", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/photos/stats"] });
      setSelectedPhotos(new Set());
      toast({ title: "Action completed" });
    },
    onError: () => {
      toast({ title: "Action failed", variant: "destructive" });
    },
  });

  const updatePhotoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/photos/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/photos/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/photos/tags"] });
      setEditingPhoto(null);
      setLightboxPhoto(null);
      toast({ title: "Photo updated" });
    },
    onError: () => {
      toast({ title: "Failed to update photo", variant: "destructive" });
    },
  });

  const togglePhotoSelection = useCallback((id: string) => {
    setSelectedPhotos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedPhotos.size === photos.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(photos.map(p => p.id)));
    }
  }, [photos, selectedPhotos.size]);

  const groupedPhotos = useMemo(() => {
    if (sortBy !== "date") return null;
    const groups: { label: string; photos: PhotoItem[] }[] = [];
    let currentLabel = "";
    for (const photo of photos) {
      const label = getDateGroupLabel(photo.createdAt);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, photos: [] });
      }
      groups[groups.length - 1].photos.push(photo);
    }
    return groups;
  }, [photos, sortBy]);

  const recentPhotos = useMemo(() => photos.slice(0, 12), [photos]);

  const lightboxIndex = useMemo(() => {
    if (!lightboxPhoto) return -1;
    return photos.findIndex(p => p.id === lightboxPhoto.id);
  }, [lightboxPhoto, photos]);

  function navigateLightbox(dir: number) {
    const newIdx = lightboxIndex + dir;
    if (newIdx >= 0 && newIdx < photos.length) {
      setLightboxPhoto(photos[newIdx]);
    }
  }

  if (photosLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="feed-card p-4 animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-up">
        <div className="feed-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
              <ImageIcon className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
            </div>
          </div>
          <p className="text-xl font-bold">{stats?.totalPhotos ?? 0}</p>
          <p className="text-xs text-muted-foreground">Total Photos</p>
        </div>
        <div className="feed-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--success) / 0.1)' }}>
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
          </div>
          <p className="text-xl font-bold">{stats?.thisWeek ?? 0}</p>
          <p className="text-xs text-muted-foreground">This Week</p>
        </div>
        <div className="feed-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--primary) / 0.1)' }}>
              <Briefcase className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="text-xl font-bold truncate" title={stats?.mostPhotographedJob?.title || "-"}>
            {stats?.mostPhotographedJob ? stats.mostPhotographedJob.count : 0}
          </p>
          <p className="text-xs text-muted-foreground truncate" title={stats?.mostPhotographedJob?.title}>
            {stats?.mostPhotographedJob?.title || "Top Job"}
          </p>
        </div>
        <div className="feed-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--warning) / 0.1)' }}>
              <HardDrive className="h-4 w-4 text-warning" />
            </div>
          </div>
          <p className="text-xl font-bold">{stats?.storageUsedFormatted ?? "0 KB"}</p>
          <p className="text-xs text-muted-foreground">Storage Used</p>
        </div>
      </div>

      {recentPhotos.length > 0 && (
        <div className="animate-fade-up stagger-delay-1">
          <p className="ios-label mb-2">Recent Uploads</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {recentPhotos.map(photo => (
              <button
                key={photo.id}
                onClick={() => setLightboxPhoto(photo)}
                className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden hover-elevate"
              >
                <img src={photo.url} alt={photo.fileName} className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 animate-fade-up stagger-delay-2">
        <div className="flex gap-1 overflow-x-auto no-scrollbar flex-shrink-0">
          {CATEGORY_OPTIONS.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                categoryFilter === cat.value
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }`}
              style={categoryFilter === cat.value ? { backgroundColor: 'hsl(var(--trade) / 0.1)', color: 'hsl(var(--trade))' } : undefined}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <Select value={jobFilter || "all-jobs"} onValueChange={v => setJobFilter(v === "all-jobs" ? "" : v)}>
            <SelectTrigger className="w-[140px]">
              <Briefcase className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Jobs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-jobs">All Jobs</SelectItem>
              {jobs.map((j: any) => (
                <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={clientFilter || "all-clients"} onValueChange={v => setClientFilter(v === "all-clients" ? "" : v)}>
            <SelectTrigger className="w-[140px]">
              <Users className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-clients">All Clients</SelectItem>
              {allClients.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={`${sortBy}-${sortOrder}`} onValueChange={v => {
            const [s, o] = v.split("-");
            setSortBy(s);
            setSortOrder(o as "asc" | "desc");
          }}>
            <SelectTrigger className="w-[140px]">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Newest First</SelectItem>
              <SelectItem value="date-asc">Oldest First</SelectItem>
              <SelectItem value="job-asc">By Job</SelectItem>
              <SelectItem value="client-asc">By Client</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedPhotos.size > 0 && (
        <div className="feed-card p-3 flex items-center gap-2 flex-wrap animate-fade-up" style={{ borderColor: 'hsl(var(--trade) / 0.3)' }}>
          <Badge variant="secondary" className="mr-1">{selectedPhotos.size} selected</Badge>
          <Button variant="outline" size="sm" onClick={() => setBulkJobDialogOpen(true)}>
            <Briefcase className="h-3.5 w-3.5 mr-1.5" />
            Attach to Job
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkCategoryDialogOpen(true)}>
            <Tag className="h-3.5 w-3.5 mr-1.5" />
            Set Category
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkTagDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Tag
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDeleteConfirmOpen(true)}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={selectAll} className="ml-auto">
            {selectedPhotos.size === photos.length ? "Deselect All" : "Select All"}
          </Button>
        </div>
      )}

      {photos.length === 0 ? (
        <div className="feed-card text-center py-12 px-6 animate-fade-up">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
               style={{ background: 'linear-gradient(135deg, hsl(var(--trade) / 0.15), hsl(var(--trade) / 0.05))' }}>
            <Camera className="h-10 w-10" style={{ color: 'hsl(var(--trade))' }} />
          </div>
          <p className="text-lg font-semibold mb-1">No photos yet</p>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
            Upload job photos to build a searchable library of proof-of-work, site conditions, and progress shots.
          </p>
          <Button onClick={() => setUploadModalOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Your First Photo
          </Button>
        </div>
      ) : groupedPhotos ? (
        groupedPhotos.map(group => (
          <div key={group.label} className="animate-fade-up">
            <div className="flex items-center gap-2 mb-2">
              <p className="ios-label">{group.label}</p>
              <Badge variant="secondary" className="text-xs">{group.photos.length}</Badge>
            </div>
            <PhotoGrid
              photos={group.photos}
              selectedPhotos={selectedPhotos}
              onToggleSelect={togglePhotoSelection}
              onViewPhoto={setLightboxPhoto}
              onNavigateToJob={(jobId) => navigate(`/jobs/${jobId}`)}
              onNavigateToClient={(clientId) => navigate(`/clients/${clientId}`)}
            />
          </div>
        ))
      ) : (
        <PhotoGrid
          photos={photos}
          selectedPhotos={selectedPhotos}
          onToggleSelect={togglePhotoSelection}
          onViewPhoto={setLightboxPhoto}
          onNavigateToJob={(jobId) => navigate(`/jobs/${jobId}`)}
          onNavigateToClient={(clientId) => navigate(`/clients/${clientId}`)}
        />
      )}

      {lightboxPhoto && !editingPhoto && (
        <Dialog open={!!lightboxPhoto} onOpenChange={() => setLightboxPhoto(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="relative">
              <img src={lightboxPhoto.url} alt={lightboxPhoto.fileName} className="w-full rounded-lg object-contain max-h-[50vh]" />
              {lightboxIndex > 0 && (
                <Button size="icon" variant="ghost" className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/60 backdrop-blur-sm" onClick={() => navigateLightbox(-1)}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              )}
              {lightboxIndex < photos.length - 1 && (
                <Button size="icon" variant="ghost" className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/60 backdrop-blur-sm" onClick={() => navigateLightbox(1)}>
                  <ChevronRight className="h-5 w-5" />
                </Button>
              )}
            </div>
            <div className="space-y-3 mt-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className={CATEGORY_COLORS[lightboxPhoto.category || 'general'] || CATEGORY_COLORS.general}>
                  {getCategoryLabel(lightboxPhoto.category)}
                </Badge>
                {lightboxPhoto.tags?.map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                ))}
                <span className="text-xs text-muted-foreground ml-auto">
                  {format(new Date(lightboxPhoto.createdAt), "dd MMM yyyy, h:mm a")}
                </span>
              </div>
              {lightboxPhoto.caption && (
                <p className="text-sm">{lightboxPhoto.caption}</p>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                {lightboxPhoto.jobId && lightboxPhoto.jobTitle && (
                  <button
                    onClick={() => { setLightboxPhoto(null); navigate(`/jobs/${lightboxPhoto.jobId}`); }}
                    className="flex items-center gap-1.5 text-sm hover-elevate px-2 py-1 rounded-md"
                  >
                    <Briefcase className="h-3.5 w-3.5" style={{ color: 'hsl(var(--trade))' }} />
                    <span className="font-medium" style={{ color: 'hsl(var(--trade))' }}>{lightboxPhoto.jobTitle}</span>
                  </button>
                )}
                {lightboxPhoto.clientId && lightboxPhoto.clientName && (
                  <button
                    onClick={() => { setLightboxPhoto(null); navigate(`/clients/${lightboxPhoto.clientId}`); }}
                    className="flex items-center gap-1.5 text-sm hover-elevate px-2 py-1 rounded-md"
                  >
                    <Users className="h-3.5 w-3.5" style={{ color: 'hsl(var(--trade))' }} />
                    <span className="font-medium" style={{ color: 'hsl(var(--trade))' }}>{lightboxPhoto.clientName}</span>
                  </button>
                )}
              </div>
              {lightboxPhoto.address && (
                <p className="text-xs text-muted-foreground">{lightboxPhoto.address}</p>
              )}
              <div className="flex items-center gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setEditingPhoto(lightboxPhoto)}>
                  <Edit className="h-3.5 w-3.5 mr-1.5" />
                  Edit Details
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={lightboxPhoto.url} download={lightboxPhoto.fileName} target="_blank" rel="noreferrer">
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Download
                  </a>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {editingPhoto && (
        <EditPhotoDialog
          photo={editingPhoto}
          existingTags={existingTags}
          onSave={(data) => updatePhotoMutation.mutate({ id: editingPhoto.id, data })}
          onClose={() => setEditingPhoto(null)}
          isPending={updatePhotoMutation.isPending}
        />
      )}

      {uploadModalOpen && (
        <UploadPhotoModal
          jobs={jobs}
          existingTags={existingTags}
          onClose={() => setUploadModalOpen(false)}
          onUploaded={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
            queryClient.invalidateQueries({ queryKey: ["/api/photos/stats"] });
            queryClient.invalidateQueries({ queryKey: ["/api/photos/tags"] });
          }}
        />
      )}

      <BulkJobDialog
        open={bulkJobDialogOpen}
        onClose={() => setBulkJobDialogOpen(false)}
        jobs={jobs}
        onConfirm={(jobId) => {
          bulkActionMutation.mutate({ photoIds: Array.from(selectedPhotos), action: "attachToJob", jobId });
          setBulkJobDialogOpen(false);
        }}
      />

      <BulkCategoryDialog
        open={bulkCategoryDialogOpen}
        onClose={() => setBulkCategoryDialogOpen(false)}
        onConfirm={(category) => {
          bulkActionMutation.mutate({ photoIds: Array.from(selectedPhotos), action: "setCategory", category });
          setBulkCategoryDialogOpen(false);
        }}
      />

      <BulkTagDialog
        open={bulkTagDialogOpen}
        onClose={() => setBulkTagDialogOpen(false)}
        existingTags={existingTags}
        onConfirm={(tags) => {
          bulkActionMutation.mutate({ photoIds: Array.from(selectedPhotos), action: "addTags", tags });
          setBulkTagDialogOpen(false);
        }}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedPhotos.size} photo{selectedPhotos.size !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The photos will be permanently deleted from storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                bulkActionMutation.mutate({ photoIds: Array.from(selectedPhotos), action: "delete" });
                setDeleteConfirmOpen(false);
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex justify-center pt-2">
        <Button onClick={() => setUploadModalOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Photos
        </Button>
      </div>
    </div>
  );
}

function PhotoGrid({
  photos,
  selectedPhotos,
  onToggleSelect,
  onViewPhoto,
  onNavigateToJob,
  onNavigateToClient,
}: {
  photos: PhotoItem[];
  selectedPhotos: Set<string>;
  onToggleSelect: (id: string) => void;
  onViewPhoto: (photo: PhotoItem) => void;
  onNavigateToJob: (jobId: string) => void;
  onNavigateToClient: (clientId: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
      {photos.map(photo => (
        <div key={photo.id} className="group relative">
          <button
            onClick={() => onViewPhoto(photo)}
            className="w-full aspect-square rounded-lg overflow-hidden hover-elevate relative"
          >
            <img
              src={photo.url}
              alt={photo.fileName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute top-1.5 left-1.5">
              <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${CATEGORY_COLORS[photo.category || 'general'] || CATEGORY_COLORS.general}`}>
                {getCategoryLabel(photo.category)}
              </Badge>
            </div>
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 pt-4">
              <p className="text-[10px] text-white/90 truncate">
                {format(new Date(photo.createdAt), "dd MMM")}
              </p>
            </div>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect(photo.id); }}
            className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
              selectedPhotos.has(photo.id)
                ? 'bg-primary border-primary'
                : 'border-white/70 bg-black/20 opacity-0 group-hover:opacity-100'
            }`}
            style={selectedPhotos.size > 0 ? { opacity: 1 } : undefined}
          >
            {selectedPhotos.has(photo.id) && <Check className="h-3 w-3 text-primary-foreground" />}
          </button>
          <div className="mt-1 space-y-0.5 min-h-[28px]">
            {photo.jobTitle && (
              <button
                onClick={() => onNavigateToJob(photo.jobId!)}
                className="text-[11px] font-medium truncate block w-full text-left hover-elevate rounded px-0.5"
                style={{ color: 'hsl(var(--trade))' }}
              >
                {photo.jobTitle}
              </button>
            )}
            {photo.clientName && (
              <button
                onClick={() => onNavigateToClient(photo.clientId!)}
                className="text-[10px] text-muted-foreground truncate block w-full text-left hover-elevate rounded px-0.5"
              >
                {photo.clientName}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function UploadPhotoModal({
  jobs,
  existingTags,
  onClose,
  onUploaded,
}: {
  jobs: any[];
  existingTags: string[];
  onClose: () => void;
  onUploaded: () => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [jobId, setJobId] = useState("");
  const [category, setCategory] = useState("general");
  const [caption, setCaption] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  function handleFilesSelected(files: FileList | null) {
    if (!files) return;
    const fileArr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (fileArr.length === 0) {
      toast({ title: "Please select image files", variant: "destructive" });
      return;
    }
    setSelectedFiles(prev => [...prev, ...fileArr]);
    fileArr.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviews(prev => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  }

  function removeFile(index: number) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    if (selectedFiles.length === 0) {
      toast({ title: "Select at least one photo", variant: "destructive" });
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    const tags = tagInput.split(",").map(t => t.trim()).filter(Boolean);

    let uploaded = 0;
    for (const file of selectedFiles) {
      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        await apiRequest("POST", "/api/photos/upload-standalone", {
          data: base64,
          fileName: file.name,
          mimeType: file.type,
          jobId: jobId || null,
          category,
          caption: caption || null,
          tags: tags.length > 0 ? tags : [],
        });
        uploaded++;
        setUploadProgress(Math.round((uploaded / selectedFiles.length) * 100));
      } catch {
        toast({ title: `Failed to upload ${file.name}`, variant: "destructive" });
      }
    }

    setUploading(false);
    if (uploaded > 0) {
      toast({ title: `${uploaded} photo${uploaded !== 1 ? "s" : ""} uploaded` });
      onUploaded();
      onClose();
    }
  }

  return (
    <Dialog open onOpenChange={() => { if (!uploading) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Photos</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover-elevate transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFilesSelected(e.dataTransfer.files); }}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">Drop photos here or tap to browse</p>
            <p className="text-xs text-muted-foreground mt-1">Camera Roll Import — select from your gallery</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="flex-1">
              <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
              Browse Gallery
            </Button>
            <Button variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()} className="flex-1">
              <Camera className="h-3.5 w-3.5 mr-1.5" />
              Take Photo
            </Button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
          </div>

          {previews.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {previews.map((preview, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden">
                  <img src={preview} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Job (optional)</Label>
              <Select value={jobId || "no-job"} onValueChange={v => setJobId(v === "no-job" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="No job selected" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-job">No job — standalone photo</SelectItem>
                  {jobs.map((j: any) => (
                    <SelectItem key={j.id} value={j.id}>{j.title}{j.clientName ? ` — ${j.clientName}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">Before</SelectItem>
                  <SelectItem value="progress">During / Progress</SelectItem>
                  <SelectItem value="after">After</SelectItem>
                  <SelectItem value="materials">Materials</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Note (optional)</Label>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a note about these photos..."
                className="resize-none"
                rows={2}
              />
            </div>
            <div>
              <Label className="text-xs">Tags (comma-separated, optional)</Label>
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="e.g. kitchen, warranty, damage"
              />
              {existingTags.length > 0 && (
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {existingTags.slice(0, 8).map(t => (
                    <button
                      key={t}
                      onClick={() => {
                        const current = tagInput.split(",").map(s => s.trim()).filter(Boolean);
                        if (!current.includes(t)) {
                          setTagInput(current.length ? `${tagInput}, ${t}` : t);
                        }
                      }}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground hover-elevate"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {uploading && (
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${uploadProgress}%`, backgroundColor: 'hsl(var(--trade))' }} />
              </div>
              <p className="text-xs text-muted-foreground text-center">{uploadProgress}% uploaded</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={uploading}>Cancel</Button>
          <Button onClick={handleUpload} disabled={uploading || selectedFiles.length === 0}>
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {uploading ? "Uploading..." : `Upload ${selectedFiles.length} Photo${selectedFiles.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditPhotoDialog({
  photo,
  existingTags,
  onSave,
  onClose,
  isPending,
}: {
  photo: PhotoItem;
  existingTags: string[];
  onSave: (data: any) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [category, setCategory] = useState(photo.category || "general");
  const [caption, setCaption] = useState(photo.caption || "");
  const [tagInput, setTagInput] = useState((photo.tags || []).join(", "));

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Photo Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before">Before</SelectItem>
                <SelectItem value="progress">During / Progress</SelectItem>
                <SelectItem value="after">After</SelectItem>
                <SelectItem value="materials">Materials</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Caption</Label>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption..."
              className="resize-none"
              rows={2}
            />
          </div>
          <div>
            <Label className="text-xs">Tags (comma-separated)</Label>
            <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="e.g. kitchen, warranty" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSave({
              category,
              caption: caption || null,
              tags: tagInput.split(",").map(t => t.trim()).filter(Boolean),
            })}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkJobDialog({ open, onClose, jobs, onConfirm }: { open: boolean; onClose: () => void; jobs: any[]; onConfirm: (jobId: string) => void }) {
  const [selected, setSelected] = useState("");
  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Attach Photos to Job</DialogTitle></DialogHeader>
        <Select value={selected || "pick"} onValueChange={v => setSelected(v === "pick" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Select a job" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pick" disabled>Select a job...</SelectItem>
            {jobs.map((j: any) => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { if (selected) onConfirm(selected); }} disabled={!selected}>Attach</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkCategoryDialog({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (cat: string) => void }) {
  const [selected, setSelected] = useState("");
  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Set Category</DialogTitle></DialogHeader>
        <Select value={selected || "pick"} onValueChange={v => setSelected(v === "pick" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pick" disabled>Select category...</SelectItem>
            <SelectItem value="before">Before</SelectItem>
            <SelectItem value="progress">During / Progress</SelectItem>
            <SelectItem value="after">After</SelectItem>
            <SelectItem value="materials">Materials</SelectItem>
            <SelectItem value="general">General</SelectItem>
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { if (selected) onConfirm(selected); }} disabled={!selected}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkTagDialog({ open, onClose, existingTags, onConfirm }: { open: boolean; onClose: () => void; existingTags: string[]; onConfirm: (tags: string[]) => void }) {
  const [tagInput, setTagInput] = useState("");
  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Tags</DialogTitle></DialogHeader>
        <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="e.g. kitchen, warranty (comma-separated)" />
        {existingTags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {existingTags.map(t => (
              <button key={t} onClick={() => setTagInput(prev => prev ? `${prev}, ${t}` : t)} className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground hover-elevate">
                {t}
              </button>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => {
            const tags = tagInput.split(",").map(t => t.trim()).filter(Boolean);
            if (tags.length > 0) onConfirm(tags);
          }} disabled={!tagInput.trim()}>Add Tags</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
