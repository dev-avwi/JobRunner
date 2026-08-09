import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Camera, Plus, Trash2, X, Loader2, Image as ImageIcon, CheckCircle2, Video, Film, Download, Sparkles, Check, ArrowLeftRight, Wand2, Bot, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import BeforeAfterComparison from "./BeforeAfterComparison";

interface JobPhoto {
  id: string;
  objectStorageKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: 'before' | 'after' | 'progress' | 'materials' | 'general';
  caption?: string;
  takenAt?: string;
  createdAt: string;
  signedUrl?: string;
  aiSuggestedCategory?: string | null;
}

interface JobPhotoGalleryProps {
  jobId: string;
  canUpload?: boolean;
  onPhotoUploaded?: () => void;
  existingNotes?: string;
  onNotesUpdated?: () => void;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  before: { label: 'Before', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  after: { label: 'After', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  progress: { label: 'Progress', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  materials: { label: 'Materials', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  general: { label: 'General', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' },
};

export default function JobPhotoGallery({ jobId, canUpload = true, onPhotoUploaded, existingNotes, onNotesUpdated }: JobPhotoGalleryProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('general');
  const [caption, setCaption] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<JobPhoto | null>(null);
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [analysisText, setAnalysisText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isAddingToNotes, setIsAddingToNotes] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { data: settings } = useBusinessSettings();

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

  const { data: photos = [], isLoading } = useQuery<JobPhoto[]>({
    queryKey: ['/api/jobs', jobId, 'photos'],
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { 
      fileName: string; 
      fileBase64: string; 
      mimeType: string; 
      category: string; 
      caption?: string;
      takenAt?: string;
    }) => {
      return await apiRequest('POST', `/api/jobs/${jobId}/photos`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'photos'] });
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      setCaption('');
      setSelectedCategory('general');
      toast({
        title: "Photo uploaded",
        description: "Your photo has been added to this job",
      });
      onPhotoUploaded?.();
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload photo",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (photoId: string) => {
      return await apiRequest('DELETE', `/api/jobs/${jobId}/photos/${photoId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'photos'] });
      setSelectedPhoto(null);
      toast({
        title: "Photo deleted",
        description: "The photo has been removed from this job",
      });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Failed to delete photo",
        variant: "destructive",
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ photoId, category }: { photoId: string; category: string }) => {
      return await apiRequest('PATCH', `/api/jobs/${jobId}/photos/${photoId}`, { category });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'photos'] });
      toast({
        title: "Category updated",
        description: "Photo category has been changed",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update photo category",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 10MB",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target?.result as string);
      reader.readAsDataURL(file);
      setIsUploadDialogOpen(true);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a photo to upload",
        variant: "destructive",
      });
      return;
    }
    
    if (!previewUrl) {
      toast({
        title: "Photo not ready",
        description: "Please wait for the photo to load before uploading",
        variant: "destructive",
      });
      return;
    }

    const base64Data = previewUrl.split(',')[1];
    
    uploadMutation.mutate({
      fileName: selectedFile.name,
      fileBase64: base64Data,
      mimeType: selectedFile.type,
      category: selectedCategory,
      caption: caption || undefined,
      takenAt: new Date().toISOString(),
    });
  };

  const groupedPhotos = photos.reduce((acc, photo) => {
    const category = photo.category || 'general';
    if (!acc[category]) acc[category] = [];
    acc[category].push(photo);
    return acc;
  }, {} as Record<string, JobPhoto[]>);

  const aiEnabled = settings?.aiEnabled !== false;
  const photoAnalysisEnabled = settings?.aiPhotoAnalysisEnabled !== false;
  const canUseAI = aiEnabled && photoAnalysisEnabled && photos.length > 0;

  const startAnalysis = async () => {
    if (isAnalysing) return;
    
    setIsAnalysing(true);
    setAnalysisText('');
    setIsComplete(false);
    
    abortControllerRef.current = new AbortController();
    
    try {
      const photoIdsParam = selectedPhotoIds.size > 0 
        ? `?photoIds=${Array.from(selectedPhotoIds).join(',')}`
        : '';
      const response = await fetch(`/api/jobs/${jobId}/photos/analyze${photoIdsParam}`, {
        method: 'GET',
        credentials: 'include',
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to analyse photos');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                setAnalysisText(prev => prev + data.text);
              }
              if (data.done) {
                setIsComplete(true);
              }
              if (data.error) {
                throw new Error(data.error);
              }
            } catch (e) {
              console.error('SSE parse error:', e);
            }
          }
        }
      }
      
      setIsComplete(true);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }
      console.error('Photo analysis error:', error);
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: error.message || "Could not analyse photos"
      });
      setAnalysisText('');
    } finally {
      setIsAnalysing(false);
    }
  };

  const cancelAnalysis = () => {
    abortControllerRef.current?.abort();
    setIsAnalysing(false);
    setAnalysisText('');
    setIsComplete(false);
  };

  const addToNotes = async () => {
    if (!analysisText.trim()) return;
    
    setIsAddingToNotes(true);
    try {
      const newNotes = existingNotes 
        ? `${existingNotes}\n\n--- AI Photo Analysis ---\n${analysisText}`
        : `--- AI Photo Analysis ---\n${analysisText}`;
      
      await apiRequest("PATCH", `/api/jobs/${jobId}`, { notes: newNotes });
      
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      
      toast({
        title: "Added to Notes",
        description: "Photo analysis has been added to job notes"
      });
      
      setAnalysisText('');
      setIsComplete(false);
      setIsAIDialogOpen(false);
      onNotesUpdated?.();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to Add",
        description: error.message || "Could not add analysis to notes"
      });
    } finally {
      setIsAddingToNotes(false);
    }
  };

  const discardAnalysis = () => {
    setAnalysisText('');
    setIsComplete(false);
  };

  return (
    <Card data-testid="job-photo-gallery">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Film className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
            Media {photos.length > 0 && `(${photos.length})`}
          </CardTitle>
          <div className="flex items-center gap-2">
            {groupedPhotos['before']?.length > 0 && groupedPhotos['after']?.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsComparisonOpen(true)}
                className="border-green-500/30 text-green-600 dark:text-green-400"
                data-testid="button-compare-before-after"
              >
                <ArrowLeftRight className="h-4 w-4 mr-1" />
                Compare
              </Button>
            )}
            {canUseAI && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLocation(`/ai-visualization?jobId=${jobId}`)}
                  className="text-primary"
                  data-testid="button-ai-visualize"
                >
                  <Wand2 className="h-4 w-4 mr-1" />
                  Visualize
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAIDialogOpen(true)}
                  className="text-primary"
                  data-testid="button-ai-analysis"
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  AI
                </Button>
              </>
            )}
            {canUpload && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-add-photo"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Media
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-8">
            <Film className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground mb-3">
              No media yet
            </p>
            {canUpload && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-upload-first-photo"
              >
                <Camera className="h-4 w-4 mr-2" />
                Take or Upload Media
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Display photos grouped by category */}
            {Object.entries(CATEGORY_LABELS).map(([category, { label }]) => {
              const categoryPhotos = groupedPhotos[category];
              if (!categoryPhotos?.length) return null;

              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className={CATEGORY_LABELS[category].color}>
                      {label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {categoryPhotos.length} {categoryPhotos.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {categoryPhotos.map((photo) => {
                      const isVideo = photo.mimeType?.startsWith('video/');
                      const isAiCategorized = !!photo.aiSuggestedCategory && photo.aiSuggestedCategory === photo.category;
                      const isCategorizationPending = !isVideo && !photo.aiSuggestedCategory && photo.category === 'general' && settings?.aiEnabled !== false && settings?.aiPhotoAnalysisEnabled !== false;
                      return (
                        <div key={photo.id} className="relative">
                          <button
                            className="aspect-square rounded-lg overflow-hidden bg-muted hover-elevate focus:ring-2 focus:ring-primary focus:outline-none relative w-full"
                            onClick={() => setSelectedPhoto(photo)}
                            data-testid={`photo-${photo.id}`}
                          >
                            {isVideo ? (
                              <>
                                <video
                                  src={photo.signedUrl || `/api/jobs/${jobId}/photos/${photo.id}/view`}
                                  className="w-full h-full object-cover"
                                  muted
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                  <Video className="h-8 w-8 text-white" />
                                </div>
                              </>
                            ) : (
                              <img
                                src={photo.signedUrl || `/api/jobs/${jobId}/photos/${photo.id}/view`}
                                alt={photo.caption || photo.fileName}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            )}
                            {isCategorizationPending && (
                              <div className="absolute top-1 left-1">
                                <div className="flex items-center gap-0.5 bg-black/60 rounded-sm px-1 py-0.5">
                                  <Loader2 className="h-2.5 w-2.5 animate-spin text-white" />
                                </div>
                              </div>
                            )}
                          </button>
                          {isAiCategorized && canUpload && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="absolute bottom-1 left-1 flex items-center gap-0.5 bg-black/60 rounded-sm px-1 py-0.5 text-[10px] text-white/90 hover:bg-black/80 transition-colors"
                                  data-testid={`ai-badge-${photo.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Bot className="h-2.5 w-2.5" />
                                  <span>AI sorted</span>
                                  <ChevronDown className="h-2 w-2" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="min-w-[140px]">
                                {Object.entries(CATEGORY_LABELS).map(([cat, { label }]) => (
                                  <DropdownMenuItem
                                    key={cat}
                                    onClick={() => updateCategoryMutation.mutate({ photoId: photo.id, category: cat })}
                                    className={photo.category === cat ? 'font-medium' : ''}
                                  >
                                    {label}
                                    {photo.category === cat && <Check className="h-3 w-3 ml-auto" />}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            
            {Object.keys(groupedPhotos)
              .filter(category => !CATEGORY_LABELS[category])
              .map(category => {
                const categoryPhotos = groupedPhotos[category];
                if (!categoryPhotos?.length) return null;
                
                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">
                        {category || 'Uncategorized'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {categoryPhotos.length} {categoryPhotos.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {categoryPhotos.map((photo) => {
                        const isVideo = photo.mimeType?.startsWith('video/');
                        const isAiCategorized = !!photo.aiSuggestedCategory && photo.aiSuggestedCategory === photo.category;
                        return (
                          <div key={photo.id} className="relative">
                            <button
                              className="aspect-square rounded-lg overflow-hidden bg-muted hover-elevate focus:ring-2 focus:ring-primary focus:outline-none relative w-full"
                              onClick={() => setSelectedPhoto(photo)}
                              data-testid={`photo-${photo.id}`}
                            >
                              {isVideo ? (
                                <>
                                  <video
                                    src={photo.signedUrl || `/api/jobs/${jobId}/photos/${photo.id}/view`}
                                    className="w-full h-full object-cover"
                                    muted
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                    <Video className="h-8 w-8 text-white" />
                                  </div>
                                </>
                              ) : (
                                <img
                                  src={photo.signedUrl || `/api/jobs/${jobId}/photos/${photo.id}/view`}
                                  alt={photo.caption || photo.fileName}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              )}
                            </button>
                            {isAiCategorized && canUpload && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    className="absolute bottom-1 left-1 flex items-center gap-0.5 bg-black/60 rounded-sm px-1 py-0.5 text-[10px] text-white/90 hover:bg-black/80 transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Bot className="h-2.5 w-2.5" />
                                    <span>AI sorted</span>
                                    <ChevronDown className="h-2 w-2" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="min-w-[140px]">
                                  {Object.entries(CATEGORY_LABELS).map(([cat, { label }]) => (
                                    <DropdownMenuItem
                                      key={cat}
                                      onClick={() => updateCategoryMutation.mutate({ photoId: photo.id, category: cat })}
                                      className={photo.category === cat ? 'font-medium' : ''}
                                    >
                                      {label}
                                      {photo.category === cat && <Check className="h-3 w-3 ml-auto" />}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </CardContent>

      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Photo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {previewUrl && (
              <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger data-testid="select-photo-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">Before (starting condition)</SelectItem>
                  <SelectItem value="progress">Progress (during work)</SelectItem>
                  <SelectItem value="after">After (completed work)</SelectItem>
                  <SelectItem value="materials">Materials (supplies used)</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Categorize your photos to keep them organized
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="caption">Caption (optional)</Label>
              <Input
                id="caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a description..."
                data-testid="input-photo-caption"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setIsUploadDialogOpen(false);
                setSelectedFile(null);
                setPreviewUrl(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploadMutation.isPending}
              data-testid="button-confirm-upload"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                {selectedPhoto?.caption || selectedPhoto?.fileName || 'Photo'}
                {selectedPhoto?.category && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex items-center gap-1">
                        <Badge variant="secondary" className={CATEGORY_LABELS[selectedPhoto.category]?.color}>
                          {CATEGORY_LABELS[selectedPhoto.category]?.label}
                          {selectedPhoto.aiSuggestedCategory && selectedPhoto.aiSuggestedCategory === selectedPhoto.category && (
                            <Bot className="h-3 w-3 ml-1 inline" />
                          )}
                          <ChevronDown className="h-3 w-3 ml-0.5 inline" />
                        </Badge>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[140px]">
                      {Object.entries(CATEGORY_LABELS).map(([cat, { label }]) => (
                        <DropdownMenuItem
                          key={cat}
                          onClick={() => {
                            updateCategoryMutation.mutate({ photoId: selectedPhoto.id, category: cat });
                          }}
                          className={selectedPhoto.category === cat ? 'font-medium' : ''}
                        >
                          {label}
                          {selectedPhoto.category === cat && <Check className="h-3 w-3 ml-auto" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </DialogTitle>
            </div>
          </DialogHeader>

          {selectedPhoto && (() => {
            const isVideo = selectedPhoto.mimeType?.startsWith('video/');
            const mediaUrl = selectedPhoto.signedUrl || `/api/jobs/${jobId}/photos/${selectedPhoto.id}/view`;
            
            const handleDownload = () => {
              try {
                // Use the /download endpoint which adds Content-Disposition headers
                const downloadUrl = `/api/jobs/${jobId}/photos/${selectedPhoto.id}/download`;
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = selectedPhoto.fileName || (isVideo ? 'video.mp4' : 'photo.jpg');
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                toast({
                  title: "Download started",
                  description: `${isVideo ? 'Video' : 'Photo'} is being saved to your device`,
                });
              } catch (error) {
                console.error('Download error:', error);
                toast({
                  title: "Download failed",
                  description: "Unable to download file. Please try again.",
                  variant: "destructive",
                });
              }
            };
            
            return (
              <div className="space-y-4">
                <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                  {isVideo ? (
                    <video
                      src={mediaUrl}
                      controls
                      autoPlay={false}
                      playsInline
                      className="w-full h-full object-contain"
                      data-testid="video-player"
                    >
                      <source src={mediaUrl} type={selectedPhoto.mimeType || 'video/mp4'} />
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <img
                      src={mediaUrl}
                      alt={selectedPhoto.caption || selectedPhoto.fileName}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {selectedPhoto.createdAt ? (
                      <>Uploaded {new Date(selectedPhoto.createdAt).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}</>
                    ) : 'Date unknown'}
                  </span>
                  <span>
                    {selectedPhoto.fileSize ? `${(selectedPhoto.fileSize / 1024).toFixed(0)} KB` : ''}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    data-testid="button-download-media"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Save {isVideo ? 'Video' : 'Photo'}
                  </Button>
                  
                  {canUpload && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(selectedPhoto.id)}
                      disabled={deleteMutation.isPending}
                      data-testid="button-delete-photo"
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Delete {isVideo ? 'Video' : 'Photo'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={isAIDialogOpen} onOpenChange={(open) => {
        if (!open) {
          if (isAnalysing) {
            cancelAnalysis();
          }
          setIsAIDialogOpen(false);
          setSelectedPhotoIds(new Set());
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Photo Analysis
              <Badge variant="secondary" className="text-xs">Early Access</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!isAnalysing && !analysisText && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Tap photos to select which ones to analyse, or leave all selected to analyse everything.
                </p>
                
                {/* Photo selection grid */}
                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                  {photos.filter(p => p.mimeType?.startsWith('image/')).map(photo => {
                    const isSelected = selectedPhotoIds.size === 0 || selectedPhotoIds.has(photo.id);
                    return (
                      <button
                        key={photo.id}
                        onClick={() => {
                          if (selectedPhotoIds.size === 0) {
                            const allImageIds = photos.filter(p => p.mimeType?.startsWith('image/')).map(p => p.id);
                            const remaining = allImageIds.filter(id => id !== photo.id);
                            setSelectedPhotoIds(new Set(remaining));
                          } else {
                            togglePhotoSelection(photo.id);
                          }
                        }}
                        className={`aspect-square rounded-md overflow-hidden relative border-2 transition-all ${isSelected ? 'border-primary ring-1 ring-primary' : 'border-transparent opacity-50'}`}
                        data-testid={`select-photo-${photo.id}`}
                      >
                        <img
                          src={photo.signedUrl || `/api/jobs/${jobId}/photos/${photo.id}/view`}
                          alt={photo.caption || photo.fileName}
                          className="w-full h-full object-cover"
                        />
                        {isSelected && (
                          <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-2.5 w-2.5 text-primary-foreground" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm">
                  <span className="text-muted-foreground">
                    {selectedPhotoIds.size === 0 
                      ? `All ${photos.filter(p => p.mimeType?.startsWith('image/')).length} photos selected`
                      : `${selectedPhotoIds.size} of ${photos.filter(p => p.mimeType?.startsWith('image/')).length} selected`
                    }
                  </span>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => setSelectedPhotoIds(new Set())}
                    className="h-7 text-xs"
                  >
                    Select All
                  </Button>
                </div>
              </div>
            )}

            {isAnalysing && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analysing photos...</span>
                </div>
                {analysisText && (
                  <div 
                    className="text-sm whitespace-pre-wrap p-3 bg-muted/50 rounded-lg border max-h-64 overflow-y-auto"
                    data-testid="text-analysis-streaming"
                  >
                    {analysisText}
                    <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5" />
                  </div>
                )}
              </div>
            )}

            {isComplete && analysisText && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <Check className="h-4 w-4" />
                  <span>Analysis complete</span>
                </div>
                <div 
                  className="text-sm whitespace-pre-wrap p-3 bg-muted/50 rounded-lg border max-h-64 overflow-y-auto"
                  data-testid="text-analysis-result"
                >
                  {analysisText}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {!isAnalysing && !analysisText && (
              <>
                <Button variant="outline" onClick={() => setIsAIDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={startAnalysis} 
                  disabled={selectedPhotoIds.size === 0 && photos.filter(p => p.mimeType?.startsWith('image/')).length === 0}
                  data-testid="button-start-analysis"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Analyse {selectedPhotoIds.size > 0 ? selectedPhotoIds.size : photos.filter(p => p.mimeType?.startsWith('image/')).length} Photo{(selectedPhotoIds.size > 0 ? selectedPhotoIds.size : photos.filter(p => p.mimeType?.startsWith('image/')).length) !== 1 ? 's' : ''}
                </Button>
              </>
            )}

            {isAnalysing && (
              <Button variant="outline" onClick={cancelAnalysis} data-testid="button-cancel-analysis">
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            )}

            {isComplete && analysisText && (
              <>
                <Button
                  variant="outline"
                  onClick={discardAnalysis}
                  disabled={isAddingToNotes}
                  data-testid="button-discard-analysis"
                >
                  <X className="mr-2 h-4 w-4" />
                  Discard
                </Button>
                <Button
                  onClick={addToNotes}
                  disabled={isAddingToNotes}
                  data-testid="button-add-to-notes"
                >
                  {isAddingToNotes ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Add to Job Notes
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Before/After Comparison Modal */}
      <BeforeAfterComparison
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
        beforePhotos={groupedPhotos['before'] || []}
        afterPhotos={groupedPhotos['after'] || []}
      />
    </Card>
  );
}
