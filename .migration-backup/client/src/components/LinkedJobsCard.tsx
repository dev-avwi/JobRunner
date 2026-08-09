import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Link2, Camera, ChevronDown, ChevronUp, Check, Loader2, Image as ImageIcon, FileText, Copy, StickyNote, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient, getSessionToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface LinkedJobsCardProps {
  jobId: string;
  clientId: string | null;
  clientName: string;
}

interface LinkedJob {
  id: string;
  title: string;
  description?: string;
  clientId?: string;
  status: string;
  notes?: string;
  createdAt: string;
}

interface PhotoItem {
  id: string;
  objectStorageKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: string;
  caption?: string;
  createdAt: string;
}

const STATUS_BADGE_CONFIG: Record<string, { variant?: "secondary" | "outline"; style?: Record<string, string> }> = {
  enquiry: { variant: "secondary" },
  quoted: { variant: "outline" },
  accepted: {
    style: { backgroundColor: 'hsl(217.2 91.2% 59.8% / 0.15)', color: 'hsl(217.2 91.2% 59.8%)' },
  },
  in_progress: {
    style: { backgroundColor: 'hsl(45 93% 47% / 0.15)', color: 'hsl(45 93% 47%)' },
  },
  done: {
    style: { backgroundColor: 'hsl(142.1 76.2% 36.3% / 0.15)', color: 'hsl(142.1 76.2% 36.3%)' },
  },
  invoiced: {
    style: { backgroundColor: 'hsl(262.1 83.3% 57.8% / 0.15)', color: 'hsl(262.1 83.3% 57.8%)' },
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  before: 'Before',
  after: 'After',
  progress: 'Progress',
  materials: 'Materials',
  general: 'General',
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function LinkedJobsCard({ jobId, clientId, clientName }: LinkedJobsCardProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [expanded, setExpanded] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [sourceJob, setSourceJob] = useState<LinkedJob | null>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>("photos");
  const [copyCategory, setCopyCategory] = useState<"keep" | "general">("keep");

  const { data: allJobs = [], isLoading } = useQuery<LinkedJob[]>({
    queryKey: ['/api/jobs'],
  });

  const linkedJobs = clientId
    ? allJobs
        .filter((j) => j.clientId === clientId && j.id !== jobId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];

  const sourceJobId = sourceJob?.id || null;

  const { data: sourcePhotos = [], isLoading: photosLoading } = useQuery<PhotoItem[]>({
    queryKey: ['/api/jobs', sourceJobId, 'photos'],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch(`/api/jobs/${sourceJobId}/photos`, { credentials: 'include', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!sourceJobId,
  });

  const copyMutation = useMutation({
    mutationFn: async (data: { sourceJobId: string; photoIds: string[]; preserveCategory?: boolean }) => {
      return apiRequest('POST', `/api/jobs/${jobId}/photos/copy`, data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'photos'] });
      toast({
        title: `${variables.photoIds.length} photo${variables.photoIds.length !== 1 ? 's' : ''} imported`,
        description: "Photos have been added to this job",
      });
      setImportDialogOpen(false);
      setSourceJob(null);
      setSelectedPhotoIds(new Set());
    },
    onError: (error: any) => {
      toast({
        title: "Import failed",
        description: error.message || "Failed to import photos",
        variant: "destructive",
      });
    },
  });

  const copyNotesMutation = useMutation({
    mutationFn: async (data: { notes: string }) => {
      return apiRequest('PATCH', `/api/jobs/${jobId}`, { notes: data.notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      toast({
        title: "Notes imported",
        description: "Previous job notes added to this job",
      });
      setImportDialogOpen(false);
      setSourceJob(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to import notes",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  if (!clientId || isLoading || linkedJobs.length === 0) {
    return null;
  }

  const displayedJobs = expanded ? linkedJobs : linkedJobs.slice(0, 3);

  const openImportDialog = (e: React.MouseEvent, job: LinkedJob) => {
    e.stopPropagation();
    setSourceJob(job);
    setSelectedPhotoIds(new Set());
    setActiveTab("photos");
    setCopyCategory("keep");
    setImportDialogOpen(true);
  };

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotoIds(prev => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPhotoIds.size === sourcePhotos.length) {
      setSelectedPhotoIds(new Set());
    } else {
      setSelectedPhotoIds(new Set(sourcePhotos.map(p => p.id)));
    }
  };

  const handleCopyPhotos = () => {
    if (!sourceJob || selectedPhotoIds.size === 0) return;
    copyMutation.mutate({
      sourceJobId: sourceJob.id,
      photoIds: Array.from(selectedPhotoIds),
      preserveCategory: copyCategory === "keep",
    });
  };

  const handleCopyNotes = () => {
    if (!sourceJob?.notes) return;
    const header = `--- Imported from: ${sourceJob.title || 'Previous Job'} (${formatDate(sourceJob.createdAt)}) ---`;
    const notesContent = `${header}\n${sourceJob.notes}\n`;
    copyNotesMutation.mutate({ notes: notesContent });
  };

  const photoCategoryCounts = sourcePhotos.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Link2 className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
              Previous Jobs for {clientName}
            </CardTitle>
            <Badge variant="secondary">{linkedJobs.length} job{linkedJobs.length !== 1 ? 's' : ''}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {displayedJobs.map((job) => {
            const config = STATUS_BADGE_CONFIG[job.status] || {};
            const hasNotes = !!job.notes;
            return (
              <div
                key={job.id}
                className="flex items-center justify-between gap-2 p-2 rounded-md cursor-pointer hover-elevate"
                onClick={() => navigate(`/jobs/${job.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{job.title || job.description || 'Untitled Job'}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">{formatDate(job.createdAt)}</span>
                    {hasNotes && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <StickyNote className="h-3 w-3" />
                        Has notes
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Badge
                    variant={config.variant || "secondary"}
                    style={config.style}
                    className="no-default-hover-elevate no-default-active-elevate"
                  >
                    {formatStatus(job.status)}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => openImportDialog(e, job)}
                    className="gap-1.5"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Import</span>
                  </Button>
                </div>
              </div>
            );
          })}

          {linkedJobs.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  View all {linkedJobs.length} jobs
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setImportDialogOpen(false);
          setSourceJob(null);
          setSelectedPhotoIds(new Set());
        }
      }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span>Import from:</span>
              <span className="text-muted-foreground font-normal">{sourceJob?.title || 'Previous Job'}</span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground">{sourceJob?.createdAt ? formatDate(sourceJob.createdAt) : ''}</p>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="photos" className="gap-1.5">
                <Camera className="h-3.5 w-3.5" />
                Photos
                {sourcePhotos.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{sourcePhotos.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="notes" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Notes
                {sourceJob?.notes && <Badge variant="secondary" className="ml-1 text-xs">1</Badge>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="photos" className="flex-1 min-h-0 flex flex-col mt-3">
              {photosLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : sourcePhotos.length === 0 ? (
                <div className="text-center py-8">
                  <ImageIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No photos in this job</p>
                  <p className="text-xs text-muted-foreground mt-1">Try another job from the list</p>
                </div>
              ) : (
                <div className="space-y-3 flex-1 min-h-0 flex flex-col">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">
                        {selectedPhotoIds.size} of {sourcePhotos.length} selected
                      </p>
                      {Object.entries(photoCategoryCounts).map(([cat, count]) => (
                        <Badge key={cat} variant="secondary" className="text-xs capitalize">
                          {CATEGORY_LABELS[cat] || cat}: {count}
                        </Badge>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                      {selectedPhotoIds.size === sourcePhotos.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 overflow-y-auto flex-1" style={{ maxHeight: '35vh' }}>
                    {sourcePhotos.map((photo) => {
                      const isSelected = selectedPhotoIds.has(photo.id);
                      return (
                        <button
                          key={photo.id}
                          className={`relative aspect-square rounded-md overflow-hidden bg-muted focus:outline-none transition-all ${isSelected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : 'opacity-80'}`}
                          onClick={() => togglePhotoSelection(photo.id)}
                        >
                          <img
                            src={`/api/jobs/${sourceJobId}/photos/${photo.id}/view`}
                            alt={photo.fileName}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          {isSelected && (
                            <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] text-white/90 capitalize font-medium">{CATEGORY_LABELS[photo.category] || photo.category}</span>
                              {photo.caption && <span className="text-[9px] text-white/60 truncate">{photo.caption}</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedPhotoIds.size > 0 && (
                    <div className="flex items-center justify-between gap-3 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="copyCategory"
                            checked={copyCategory === "keep"}
                            onChange={() => setCopyCategory("keep")}
                            className="rounded-full"
                          />
                          <span className="text-xs">Keep original categories</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="copyCategory"
                            checked={copyCategory === "general"}
                            onChange={() => setCopyCategory("general")}
                            className="rounded-full"
                          />
                          <span className="text-xs">Set all to General</span>
                        </label>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleCopyPhotos}
                        disabled={copyMutation.isPending}
                        className="gap-1.5"
                      >
                        {copyMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ArrowRight className="h-3.5 w-3.5" />
                        )}
                        Import {selectedPhotoIds.size} photo{selectedPhotoIds.size !== 1 ? 's' : ''}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="mt-3">
              {sourceJob?.notes ? (
                <div className="space-y-3">
                  <div className="rounded-md border bg-muted/30 p-3 max-h-[40vh] overflow-y-auto">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{sourceJob.notes}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      These notes will be added to the current job with a reference header
                    </p>
                    <Button
                      size="sm"
                      onClick={handleCopyNotes}
                      disabled={copyNotesMutation.isPending}
                      className="gap-1.5"
                    >
                      {copyNotesMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      Import Notes
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No notes on this job</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
