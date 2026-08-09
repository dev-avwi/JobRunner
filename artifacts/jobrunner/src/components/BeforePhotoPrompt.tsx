import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Camera, Upload, SkipForward, Check, X, Image, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BeforePhotoPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
  onPhotosAdded?: () => void;
  onSkip?: () => void;
  onComplete?: () => void;
}

export function BeforePhotoPrompt({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  onPhotosAdded,
  onSkip,
  onComplete,
}: BeforePhotoPromptProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setSelectedFiles(prev => [...prev, ...files]);
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotosMutation = useMutation({
    mutationFn: async () => {
      setIsUploading(true);
      
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('photoType', 'before');
        formData.append('notes', 'Before photo taken at job start');
        
        await fetch(`/api/jobs/${jobId}/photos`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
      }
      
      return { count: selectedFiles.length };
    },
    onSuccess: (data) => {
      toast({
        title: "Photos uploaded!",
        description: `${data.count} before photo${data.count > 1 ? 's' : ''} added to the job`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'photos'] });
      setSelectedFiles([]);
      setPreviews([]);
      setIsUploading(false);
      onPhotosAdded?.();
      onComplete?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
      setIsUploading(false);
    },
  });

  const handleSkip = () => {
    toast({
      title: "Skipped for now",
      description: "You can add before photos later from the job details",
    });
    onSkip?.();
    onComplete?.();
    onOpenChange(false);
  };

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      uploadPhotosMutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Take Before Photos
          </DialogTitle>
          <DialogDescription>
            Capture the job site before you start work on "{jobTitle}". This helps with documentation and disputes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {previews.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {previews.map((preview, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden border bg-muted">
                  <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={() => removePhoto(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              
              <label className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
                <Camera className="h-6 w-6 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">Add more</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
                  <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium">Take Photo</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Use your camera to capture the job site
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <label className="block">
                <div className="border rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">Upload from Gallery</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            </div>
          )}

          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Image className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Why take before photos?</p>
                <ul className="mt-1 space-y-0.5">
                  <li>• Document existing conditions</li>
                  <li>• Protect against damage claims</li>
                  <li>• Show your great work with before/after</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={isUploading}
            className="gap-2"
          >
            <SkipForward className="h-4 w-4" />
            Skip for now
          </Button>
          <Button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
            className="gap-2"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length || ''} Photo${selectedFiles.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
