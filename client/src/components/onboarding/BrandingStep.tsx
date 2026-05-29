import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { ArrowLeft, ArrowRight, Palette, Upload, Image, X } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import ColorThief from "colorthief";

const brandingSchema = z.object({
  logoUrl: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color").default("#2563eb"),
  quotePrefix: z.string().min(1, "Quote prefix is required").max(10, "Maximum 10 characters").default("Q"),
  invoicePrefix: z.string().min(1, "Invoice prefix is required").max(10, "Maximum 10 characters").default("INV"),
  businessTagline: z.string().max(200, "Maximum 200 characters").optional().default(""),
});

type BrandingData = z.infer<typeof brandingSchema>;

interface BrandingStepProps {
  data: BrandingData;
  onComplete: (data: BrandingData) => void;
  onPrevious: () => void;
}

export default function BrandingStep({
  data,
  onComplete,
  onPrevious
}: BrandingStepProps) {
  const { toast } = useToast();
  const [logoPreview, setLogoPreview] = useState<string | null>(data.logoUrl || null);
  const [detectedColors, setDetectedColors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const form = useForm<BrandingData>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      logoUrl: data.logoUrl || '',
      primaryColor: data.primaryColor || '#2563eb',
      quotePrefix: data.quotePrefix || 'Q',
      invoicePrefix: data.invoicePrefix || 'INV',
      businessTagline: data.businessTagline || '',
    },
  });

  const handleGetUploadParameters = async () => {
    // apiRequest attaches the Bearer-token fallback so this works when the
    // secure cookie is unavailable (iOS/Safari, plain HTTP).
    const response = await apiRequest("POST", "/api/objects/upload", {});

    const uploadData = await response.json();
    return {
      method: "PUT" as const,
      url: uploadData.uploadURL,
    };
  };

  const extractColors = async (imageUrl: string): Promise<string[]> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      
      img.onload = () => {
        try {
          const colorThief = new ColorThief();
          const palette = colorThief.getPalette(img, 5);
          const hexColors = palette.map((rgb: number[]) => {
            const [r, g, b] = rgb;
            return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
          });
          resolve(hexColors);
        } catch (error) {
          console.error("Error extracting colors:", error);
          resolve([]);
        }
      };
      
      img.onerror = () => {
        resolve([]);
      };
      
      img.src = imageUrl;
    });
  };

  const handleUploadComplete = async (uploadUrl: string) => {
    setUploading(true);
    
    try {
      const colors = await extractColors(uploadUrl);
      setDetectedColors(colors);
      setLogoPreview(uploadUrl);
      form.setValue('logoUrl', uploadUrl);

      if (colors.length > 0) {
        form.setValue('primaryColor', colors[0]);
        toast({
          title: "Logo uploaded!",
          description: "We detected some brand colors from your logo. Feel free to adjust.",
        });
      } else {
        toast({
          title: "Logo uploaded!",
          description: "Your logo is ready to use.",
        });
      }
    } catch (error) {
      console.error("Error processing logo:", error);
      toast({
        title: "Upload Error",
        description: "Failed to process logo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    form.setValue('logoUrl', '');
    setDetectedColors([]);
  };

  const handleColorSelect = (color: string) => {
    form.setValue('primaryColor', color);
    toast({
      title: "Color applied!",
      description: `Using ${color} as your brand color.`,
    });
  };

  const handleSubmit = async (formData: BrandingData) => {
    onComplete(formData);
  };

  const handleSkip = () => {
    onComplete({
      logoUrl: '',
      primaryColor: '#2563eb',
      quotePrefix: 'Q',
      invoicePrefix: 'INV',
      businessTagline: '',
    });
  };

  const currentColor = form.watch("primaryColor");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-6 w-6" />
          Branding & Customization
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            
            {/* Logo Upload */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Business Logo (Optional)</label>
              
              {logoPreview ? (
                <div className="flex items-start gap-4 p-4 rounded-lg border bg-accent/20">
                  <img 
                    src={logoPreview} 
                    alt="Business logo" 
                    className="h-20 w-20 object-contain rounded border bg-white"
                    data-testid="img-logo-preview"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Logo uploaded</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This will appear on your quotes and invoices
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={handleRemoveLogo}
                      data-testid="button-remove-logo"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <ObjectUploader
                  maxFileSize={5 * 1024 * 1024}
                  onGetUploadParameters={handleGetUploadParameters}
                  onComplete={handleUploadComplete}
                  accept="image/*"
                  buttonClassName="w-full"
                >
                  <div className="flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-lg hover:border-primary/50 transition-colors">
                    <Image className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {uploading ? "Uploading..." : "Click to upload your logo"}
                    </span>
                    <span className="text-xs text-muted-foreground">PNG, JPG up to 5MB</span>
                  </div>
                </ObjectUploader>
              )}
              <p className="text-xs text-muted-foreground">
                Your logo will appear on quotes, invoices, and emails
              </p>
            </div>

            {/* Detected Colors from Logo */}
            {detectedColors.length > 0 && (
              <div className="p-4 rounded-lg border bg-accent/10">
                <p className="text-sm font-medium mb-3">Colors detected from your logo:</p>
                <div className="flex flex-wrap gap-2">
                  {detectedColors.map((color, index) => (
                    <button
                      key={index}
                      type="button"
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                        currentColor === color ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/50'
                      }`}
                      onClick={() => handleColorSelect(color)}
                      data-testid={`button-detected-color-${index}`}
                    >
                      <div 
                        className="w-5 h-5 rounded border" 
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs font-mono">{color}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Primary Color */}
            <FormField
              control={form.control}
              name="primaryColor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand Color</FormLabel>
                  <div className="flex gap-3 items-center">
                    <FormControl>
                      <input
                        type="color"
                        {...field}
                        className="w-16 h-10 rounded-md cursor-pointer border border-input"
                        data-testid="input-primary-color"
                      />
                    </FormControl>
                    <Input
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder="#2563eb"
                      className="font-mono"
                      data-testid="input-color-hex"
                    />
                  </div>
                  <FormDescription>
                    This color will be used throughout your quotes, invoices, and branding
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Color Preview */}
            <div className="p-4 rounded-lg border" style={{ backgroundColor: currentColor + '10' }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-lg shadow-sm border-2 border-white"
                  style={{ backgroundColor: currentColor }}
                />
                <div>
                  <h4 className="font-medium" style={{ color: currentColor }}>
                    Preview
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    This is how your brand color will look in the app
                  </p>
                </div>
              </div>
            </div>

            {/* Quote Prefix */}
            <FormField
              control={form.control}
              name="quotePrefix"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quote Number Prefix</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Q"
                      maxLength={10}
                      {...field}
                      data-testid="input-quote-prefix"
                    />
                  </FormControl>
                  <FormDescription>
                    Your quotes will be numbered like: {field.value || 'Q'}-0001, {field.value || 'Q'}-0002
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Invoice Prefix */}
            <FormField
              control={form.control}
              name="invoicePrefix"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Number Prefix</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="INV"
                      maxLength={10}
                      {...field}
                      data-testid="input-invoice-prefix"
                    />
                  </FormControl>
                  <FormDescription>
                    Your invoices will be numbered like: {field.value || 'INV'}-0001, {field.value || 'INV'}-0002
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Business Tagline */}
            <FormField
              control={form.control}
              name="businessTagline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Tagline (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Quality service you can trust"
                      maxLength={200}
                      {...field}
                      data-testid="input-business-tagline"
                    />
                  </FormControl>
                  <FormDescription>
                    This will appear on your quotes and invoices
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Navigation */}
            <div className="flex justify-between pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onPrevious}
                data-testid="button-previous"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSkip}
                  data-testid="button-skip"
                >
                  Skip for now
                </Button>

                <Button
                  type="submit"
                  data-testid="button-continue"
                >
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
