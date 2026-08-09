import { useState } from "react";
import { ObjectUploader } from "./ObjectUploader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Palette } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ColorThief from "colorthief";
import { queryClient } from "@/lib/queryClient";

interface LogoUploadProps {
  currentLogoUrl?: string | null;
  onColorsDetected?: (colors: string[]) => void;
}

export function LogoUpload({ currentLogoUrl, onColorsDetected }: LogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [detectedColors, setDetectedColors] = useState<string[]>([]);
  const { toast } = useToast();

  const extractColors = async (imageUrl: string): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      img.onload = () => {
        try {
          const colorThief = new ColorThief();
          const palette = colorThief.getPalette(img, 5);
          
          // Convert RGB arrays to hex colors
          const hexColors = palette.map((rgb: number[]) => {
            const [r, g, b] = rgb;
            return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
          });
          
          resolve(hexColors);
        } catch (error) {
          console.error("Error extracting colors:", error);
          resolve([]); // Return empty array on error
        }
      };
      
      img.onerror = () => {
        console.error("Error loading image for color extraction");
        resolve([]); // Return empty array on error
      };
      
      img.src = imageUrl;
    });
  };

  const handleUploadComplete = async (uploadUrl: string) => {
    setUploading(true);
    
    try {
      // Extract colors from the uploaded image
      const colors = await extractColors(uploadUrl);
      setDetectedColors(colors);
      
      // Update business settings with logo and detected colors
      const response = await fetch("/api/logo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoURL: uploadUrl,
          detectedColors: colors
        })
      });

      if (!response.ok) {
        throw new Error("Failed to save logo");
      }

      const result = await response.json();
      
      // Invalidate business settings cache to refetch updated data
      queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/unified"] });
      
      // Call the callback with detected colors
      onColorsDetected?.(colors);

      toast({
        title: "Logo uploaded successfully!",
        description: colors.length > 0 
          ? `${colors.length} brand colors detected and applied to your theme.`
          : "Logo uploaded, but no colors could be detected.",
      });

    } catch (error) {
      console.error("Error processing logo upload:", error);
      toast({
        title: "Upload Error",
        description: "Failed to process logo upload. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleApplyColor = (color: string) => {
    // Apply this color as the primary brand color
    onColorsDetected?.([color]);
    toast({
      title: "Brand Color Applied",
      description: `Applied ${color} as your primary brand color.`,
    });
  };

  return (
    <Card data-testid="card-logo-upload">
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="h-5 w-5" />
          <h3 className="font-semibold">Business Logo</h3>
        </div>

        <div className="space-y-4">
          {currentLogoUrl && (
            <div className="flex items-center gap-4">
              <img 
                src={currentLogoUrl} 
                alt="Current business logo" 
                className="h-16 w-16 object-contain rounded border"
                data-testid="img-current-logo"
              />
              <div>
                <p className="text-sm font-medium">Current Logo</p>
                <p className="text-xs text-muted-foreground">Upload a new logo to replace</p>
              </div>
            </div>
          )}

          <ObjectUploader
            maxFileSize={5 * 1024 * 1024} // 5MB
            uploadEndpoint="/api/objects/upload-file"
            onComplete={handleUploadComplete}
            accept="image/*"
            buttonClassName="w-full"
          >
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              <span>{uploading ? "Processing..." : "Upload Logo"}</span>
            </div>
          </ObjectUploader>

          {detectedColors.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                <span className="text-sm font-medium">Detected Brand Colors</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {detectedColors.map((color, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="h-auto p-2 flex-col gap-1"
                    onClick={() => handleApplyColor(color)}
                    data-testid={`button-color-${index}`}
                  >
                    <div 
                      className="w-6 h-6 rounded border" 
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs">{color}</span>
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Click any color to apply it as your primary brand color
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}