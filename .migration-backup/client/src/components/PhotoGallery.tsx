import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, X, Maximize2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface Photo {
  url: string;
  description?: string;
  uploadedAt: string;
}

interface PhotoGalleryProps {
  entityType: 'job' | 'quote' | 'invoice';
  entityId: string;
  photos: Photo[];
  maxPhotos?: number;
  disabled?: boolean;
  queryKey: string[];
}

export default function PhotoGallery({ 
  entityType,
  entityId,
  photos = [], 
  maxPhotos = 10,
  disabled = false,
  queryKey
}: PhotoGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Upload photo mutation
  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await apiRequest('POST', '/api/photos/upload', {
        entityType,
        entityId,
        file: base64,
        description: file.name,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || 'Failed to upload photo');
      }

      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.refetchQueries({ queryKey, type: 'active' });
      toast({
        title: "Photo uploaded",
        description: "Photo has been added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error?.message || "Failed to upload photo",
        variant: "destructive",
      });
    },
  });

  // Delete photo mutation
  const deletePhotoMutation = useMutation({
    mutationFn: async (photoUrl: string) => {
      const encodedUrl = encodeURIComponent(photoUrl);
      const response = await apiRequest('DELETE', `/api/photos/${entityType}/${entityId}/${encodedUrl}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(errorData.error || 'Failed to delete photo');
      }
      
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.refetchQueries({ queryKey, type: 'active' });
      toast({
        title: "Photo deleted",
        description: "Photo has been removed successfully",
      });
      setSelectedPhoto(null);
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error?.message || "Failed to delete photo",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (photos.length + files.length > maxPhotos) {
      toast({
        title: "Too many photos",
        description: `Maximum ${maxPhotos} photos allowed`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast({
            title: "Invalid file type",
            description: `${file.name} is not an image file`,
            variant: "destructive",
          });
          continue;
        }

        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds 5MB limit`,
            variant: "destructive",
          });
          continue;
        }

        // Upload file
        await uploadPhotoMutation.mutateAsync(file);
      }
    } finally {
      setUploading(false);
      // Clear the input
      event.target.value = '';
    }
  };

  const handleDelete = (photoUrl: string) => {
    if (window.confirm('Are you sure you want to delete this photo?')) {
      deletePhotoMutation.mutate(photoUrl);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading || uploadPhotoMutation.isPending || photos.length >= maxPhotos}
          data-testid="button-upload-photos"
        >
          {uploading || uploadPhotoMutation.isPending ? (
            <>
              <Camera className="h-4 w-4 mr-2 animate-pulse" />
              Uploading...
            </>
          ) : (
            <>
              <Camera className="h-4 w-4 mr-2" />
              Add Photos ({photos.length}/{maxPhotos})
            </>
          )}
        </Button>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        data-testid="input-photo-upload"
      />

      {/* Photos Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo, index) => (
            <Card key={index} className="relative group" data-testid={`photo-preview-${index}`}>
              <CardContent className="p-2">
                <div className="relative aspect-square">
                  <img
                    src={photo.url}
                    alt={photo.description || 'Photo'}
                    className="w-full h-full object-cover rounded-md cursor-pointer"
                    onClick={() => setSelectedPhoto(photo.url)}
                  />
                  {!disabled && (
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setSelectedPhoto(photo.url)}
                        data-testid={`button-view-photo-${index}`}
                      >
                        <Maximize2 className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(photo.url);
                        }}
                        disabled={deletePhotoMutation.isPending}
                        data-testid={`button-remove-photo-${index}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                {photo.description && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {photo.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Photo Viewer Dialog */}
      <Dialog open={selectedPhoto !== null} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Photo Viewer</DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <div className="flex flex-col items-center">
              <img
                src={selectedPhoto}
                alt="Full size"
                className="max-w-full max-h-[70vh] object-contain rounded-md"
              />
              {!disabled && (
                <Button
                  variant="destructive"
                  className="mt-4"
                  onClick={() => handleDelete(selectedPhoto)}
                  disabled={deletePhotoMutation.isPending}
                  data-testid="button-delete-photo-viewer"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Photo
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Empty State */}
      {photos.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Camera className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No photos yet</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Add photos to document your work
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading}
              data-testid="button-upload-photos-empty"
            >
              <Camera className="h-4 w-4 mr-2" />
              Add First Photo
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
