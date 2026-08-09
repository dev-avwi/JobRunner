import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Camera, 
  Upload, 
  X, 
  Wand2, 
  Download, 
  Save, 
  Image as ImageIcon,
  Loader2,
  ArrowRight,
  Sparkles,
  RefreshCw
} from "lucide-react";

const STYLES = [
  { value: "modern", label: "Modern", description: "Clean lines, minimalist aesthetic" },
  { value: "traditional", label: "Traditional", description: "Classic, timeless design" },
  { value: "industrial", label: "Industrial", description: "Raw materials, urban feel" },
  { value: "minimalist", label: "Minimalist", description: "Simple, uncluttered spaces" },
  { value: "contemporary", label: "Contemporary", description: "Current trends, fresh look" },
  { value: "rustic", label: "Rustic", description: "Natural materials, cozy feel" },
] as const;

const ROOM_TYPES = [
  { value: "bathroom", label: "Bathroom" },
  { value: "kitchen", label: "Kitchen" },
  { value: "living_room", label: "Living Room" },
  { value: "bedroom", label: "Bedroom" },
  { value: "exterior", label: "Exterior" },
  { value: "laundry", label: "Laundry" },
  { value: "garage", label: "Garage" },
  { value: "office", label: "Office" },
] as const;

interface VisualizationResult {
  afterImageUrl: string;
  description: string;
  prompt: string;
  style: string;
  roomType: string;
  createdAt: string;
}

interface AIVisualizationProps {
  jobId?: string;
  onSaveToJob?: (imageUrl: string) => void;
  initialBeforeImage?: string;
}

export default function AIVisualization({ 
  jobId, 
  onSaveToJob,
  initialBeforeImage 
}: AIVisualizationProps) {
  const [beforeImage, setBeforeImage] = useState<string | null>(initialBeforeImage || null);
  const [beforeImageFile, setBeforeImageFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<string>("modern");
  const [roomType, setRoomType] = useState<string>("bathroom");
  const [result, setResult] = useState<VisualizationResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: async (data: { 
      beforeImageUrl: string; 
      prompt: string; 
      style: string; 
      roomType: string;
      jobId?: string;
    }) => {
      const response = await apiRequest("POST", "/api/ai/visualization", data);
      return response.json();
    },
    onSuccess: (data) => {
      setResult({
        afterImageUrl: data.afterImageUrl,
        description: data.description,
        prompt: prompt,
        style: style,
        roomType: roomType,
        createdAt: new Date().toISOString(),
      });
      toast({
        title: "Visualization Generated",
        description: "Your renovation concept is ready!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate visualization. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be under 10MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setBeforeImageFile(file);

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        setBeforeImage(e.target?.result as string);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to load image. Please try again.",
        variant: "destructive",
      });
      setIsUploading(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [toast]);

  const handleGenerate = async () => {
    if (!beforeImage) {
      toast({
        title: "No image selected",
        description: "Please upload a before photo first",
        variant: "destructive",
      });
      return;
    }

    if (!prompt.trim()) {
      toast({
        title: "No prompt provided",
        description: "Please describe what you'd like to visualize",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate({
      beforeImageUrl: beforeImage,
      prompt: prompt.trim(),
      style,
      roomType,
      jobId,
    });
  };

  const handleSaveToJob = () => {
    if (result?.afterImageUrl && onSaveToJob) {
      onSaveToJob(result.afterImageUrl);
      toast({
        title: "Image Saved",
        description: "Visualization added to job photos",
      });
    }
  };

  const handleDownload = async () => {
    if (!result?.afterImageUrl) return;
    
    try {
      const response = await fetch(result.afterImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `visualization-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download image",
        variant: "destructive",
      });
    }
  };

  const clearBeforeImage = () => {
    setBeforeImage(null);
    setBeforeImageFile(null);
    setResult(null);
  };

  const resetAll = () => {
    clearBeforeImage();
    setPrompt("");
    setStyle("modern");
    setRoomType("bathroom");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Before Photo
            </CardTitle>
            <CardDescription>
              Upload a photo of the current space you want to renovate
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!beforeImage ? (
              <div 
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover-elevate transition-colors"
                onClick={() => fileInputRef.current?.click()}
                data-testid="before-image-dropzone"
              >
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Upload Before Photo</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG up to 10MB
                </p>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={beforeImage}
                  alt="Before"
                  className="w-full rounded-lg object-cover aspect-[4/3]"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={clearBeforeImage}
                  data-testid="button-remove-before-image"
                >
                  <X className="h-4 w-4" />
                </Button>
                <Badge className="absolute bottom-2 left-2" variant="secondary">
                  Before
                </Badge>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              data-testid="input-before-image"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              After Concept
            </CardTitle>
            <CardDescription>
              AI-generated visualization of your renovation
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="border-2 border-dashed rounded-lg p-8 text-center aspect-[4/3] flex flex-col items-center justify-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Generated Image</h3>
                <p className="text-sm text-muted-foreground">
                  Your visualization will appear here
                </p>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={result.afterImageUrl}
                  alt="After visualization"
                  className="w-full rounded-lg object-cover aspect-[4/3]"
                />
                <Badge className="absolute bottom-2 left-2" variant="default">
                  After (AI Generated)
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Visualization Settings
          </CardTitle>
          <CardDescription>
            Describe your vision and select style preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">What would you like to visualize?</Label>
            <Textarea
              id="prompt"
              placeholder="e.g., Modernise this bathroom with new tiles, floating vanity, and frameless shower"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[80px]"
              data-testid="input-visualization-prompt"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="style">Design Style</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger id="style" data-testid="select-style">
                  <SelectValue placeholder="Select style" />
                </SelectTrigger>
                <SelectContent>
                  {STYLES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <div className="flex flex-col">
                        <span>{s.label}</span>
                        <span className="text-xs text-muted-foreground">{s.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="roomType">Room Type</Label>
              <Select value={roomType} onValueChange={setRoomType}>
                <SelectTrigger id="roomType" data-testid="select-room-type">
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {ROOM_TYPES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-4">
            <Button
              onClick={handleGenerate}
              disabled={!beforeImage || !prompt.trim() || generateMutation.isPending}
              className="gap-2"
              data-testid="button-generate-visualization"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Generate Visualization
                </>
              )}
            </Button>

            {result && (
              <>
                <Button
                  variant="outline"
                  onClick={handleDownload}
                  className="gap-2"
                  data-testid="button-download-visualization"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>

                {onSaveToJob && (
                  <Button
                    variant="outline"
                    onClick={handleSaveToJob}
                    className="gap-2"
                    data-testid="button-save-to-job"
                  >
                    <Save className="h-4 w-4" />
                    Save to Job
                  </Button>
                )}

                <Button
                  variant="ghost"
                  onClick={resetAll}
                  className="gap-2"
                  data-testid="button-reset-visualization"
                >
                  <RefreshCw className="h-4 w-4" />
                  Start Over
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>AI Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{result.description}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Badge variant="secondary">{STYLES.find(s => s.value === result.style)?.label}</Badge>
              <Badge variant="secondary">{ROOM_TYPES.find(r => r.value === result.roomType)?.label}</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
