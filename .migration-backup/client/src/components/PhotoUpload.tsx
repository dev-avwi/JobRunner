import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Photo {
  id: string;
  url: string;
  filename: string;
  uploadedAt: string;
}

interface PhotoUploadProps {
  photos: Photo[];
  onPhotosChange?: (photos: Photo[]) => void;
  maxPhotos?: number;
  disabled?: boolean;
}

export default function PhotoUpload({ 
  photos = [], 
  onPhotosChange, 
  maxPhotos = 10,
  disabled = false 
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
      const newPhotos: Photo[] = [];
      
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

        // Create data URL for preview (in real app, upload to server)
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });

        const photo: Photo = {
          id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          url: dataUrl,
          filename: file.name,
          uploadedAt: new Date().toISOString(),
        };

        newPhotos.push(photo);
      }

      const updatedPhotos = [...photos, ...newPhotos];
      onPhotosChange?.(updatedPhotos);

      if (newPhotos.length > 0) {
        toast({
          title: "Photos uploaded",
          description: `${newPhotos.length} photo(s) uploaded successfully`,
        });
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload photos. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Clear the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removePhoto = (photoId: string) => {
    const updatedPhotos = photos.filter(photo => photo.id !== photoId);
    onPhotosChange?.(updatedPhotos);
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={openFileDialog}
          disabled={disabled || uploading || photos.length >= maxPhotos}
          data-testid="button-upload-photos"
        >
          {uploading ? (
            <>
              <Upload className="h-4 w-4 mr-2 animate-spin" />
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
          {photos.map((photo) => (
            <Card key={photo.id} className="relative group" data-testid={`photo-preview-${photo.id}`}>
              <CardContent className="p-2">
                <div className="relative aspect-square">
                  <img
                    src={photo.url}
                    alt={photo.filename}
                    className="w-full h-full object-cover rounded-md"
                  />
                  {!disabled && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removePhoto(photo.id)}
                      data-testid={`button-remove-photo-${photo.id}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {photo.filename}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {photos.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Image className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No photos yet</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Add photos to document the completed work
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={openFileDialog}
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