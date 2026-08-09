import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useFeatureAccess } from "@/hooks/use-subscription";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Globe,
  ExternalLink,
  CheckCircle,
  Clock,
  AlertTriangle,
  Send,
  History,
  Monitor,
  Loader2,
  RefreshCw,
  ArrowLeft,
  Sparkles,
  ImagePlus,
  X,
  Phone,
  MessageSquare,
  CalendarPlus,
  Code,
  Copy,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";

interface WebsiteAddon {
  id: string;
  businessId: string;
  domainUrl: string | null;
  domainStatus: string;
  hostingStatus: string;
  monthlyFee: string | null;
  websiteClickToCall: boolean;
  websiteChatWidget: boolean;
  websiteBookingForm: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EmbedSnippets {
  clickToCall: string | null;
  chatWidget: string | null;
  bookingForm: string | null;
}

interface ChangeRequest {
  id: string;
  businessId: string;
  userId: string;
  description: string;
  priority: string;
  status: string;
  screenshotUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

function getDomainStatusConfig(status: string) {
  switch (status) {
    case "active":
      return { label: "Active", variant: "default" as const, icon: CheckCircle, className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/30" };
    case "configuring":
      return { label: "Configuring", variant: "secondary" as const, icon: Clock, className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30" };
    case "dns_pending":
      return { label: "DNS Pending", variant: "secondary" as const, icon: Clock, className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30" };
    case "pending":
      return { label: "Pending", variant: "secondary" as const, icon: Clock, className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30" };
    case "error":
      return { label: "Error", variant: "destructive" as const, icon: AlertTriangle, className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30" };
    default:
      return { label: "Not Set Up", variant: "outline" as const, icon: AlertTriangle, className: "bg-muted text-muted-foreground" };
  }
}

function getHostingStatusConfig(status: string) {
  switch (status) {
    case "active":
      return { label: "Active", className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/30" };
    case "provisioning":
      return { label: "Provisioning", className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30" };
    case "error":
      return { label: "Error", className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30" };
    default:
      return { label: "Inactive", className: "bg-muted text-muted-foreground" };
  }
}

function getPriorityConfig(priority: string) {
  switch (priority) {
    case "urgent":
      return { label: "Urgent", className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30" };
    case "low":
      return { label: "Low", className: "bg-muted text-muted-foreground" };
    default:
      return { label: "Normal", className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30" };
  }
}

function getStatusConfig(status: string) {
  switch (status) {
    case "in_progress":
      return { label: "In Progress", className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30" };
    case "done":
      return { label: "Done", className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/30" };
    default:
      return { label: "To Do", className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30" };
  }
}

interface BookingServiceItem {
  name: string;
  duration: number;
  description?: string | null;
}

interface BookingBusinessSettings {
  bookingSlug?: string | null;
  bookingPageEnabled?: boolean | null;
  bookingPageDescription?: string | null;
  bookingPageServices?: BookingServiceItem[] | null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function BookingPortalCard() {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery<BookingBusinessSettings>({
    queryKey: ["/api/business-settings"],
  });

  const [enabled, setEnabled] = useState(false);
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [services, setServices] = useState<BookingServiceItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  if (settings && !hydrated) {
    setEnabled(!!settings.bookingPageEnabled);
    setSlug(settings.bookingSlug || "");
    setDescription(settings.bookingPageDescription || "");
    setServices(Array.isArray(settings.bookingPageServices) ? settings.bookingPageServices : []);
    setHydrated(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<BookingBusinessSettings>) => {
      const res = await apiRequest("PATCH", "/api/business-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] });
      toast({ title: "Booking page saved" });
    },
    onError: (err: any) => {
      toast({ title: "Could not save", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const handleSave = () => {
    const cleanSlug = slugify(slug);
    if (enabled && !cleanSlug) {
      toast({ title: "Add a booking link name first", variant: "destructive" });
      return;
    }
    setSlug(cleanSlug);
    saveMutation.mutate({
      bookingPageEnabled: enabled,
      bookingSlug: cleanSlug || null,
      bookingPageDescription: description.trim() || null,
      bookingPageServices: services.filter((s) => s.name.trim()),
    });
  };

  const updateService = (index: number, patch: Partial<BookingServiceItem>) => {
    setServices((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  return (
    <Card data-testid="card-booking-portal">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarPlus className="h-4 w-4 text-muted-foreground" />
          Online Booking Page
        </CardTitle>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          data-testid="switch-booking-enabled"
        />
      </CardHeader>
      <CardContent className="space-y-5">
        <CardDescription>
          Share a link customers can use to request a booking. You approve or decline each request — nothing is locked in until you say so.
        </CardDescription>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="booking-slug">Booking link name</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">/book/</span>
                <Input
                  id="booking-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  onBlur={() => setSlug(slugify(slug))}
                  placeholder="your-business"
                  data-testid="input-booking-slug"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="booking-description">Intro text (optional)</Label>
              <Textarea
                id="booking-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short welcome message shown at the top of your booking page"
                rows={2}
                data-testid="input-booking-description"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label>Services customers can pick</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setServices((prev) => [...prev, { name: "", duration: 60, description: "" }])}
                  data-testid="button-add-service"
                >
                  Add service
                </Button>
              </div>
              {services.length === 0 ? (
                <p className="text-xs text-muted-foreground">No services yet. Customers can still request a general booking.</p>
              ) : (
                <div className="space-y-3">
                  {services.map((service, index) => (
                    <div key={index} className="rounded-md border p-3 space-y-2" data-testid={`service-row-${index}`}>
                      <div className="flex items-center gap-2">
                        <Input
                          value={service.name}
                          onChange={(e) => updateService(index, { name: e.target.value })}
                          placeholder="Service name"
                          data-testid={`input-service-name-${index}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setServices((prev) => prev.filter((_, i) => i !== index))}
                          data-testid={`button-remove-service-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">Duration (min)</span>
                        <Input
                          type="number"
                          min={15}
                          step={15}
                          value={service.duration}
                          onChange={(e) => updateService(index, { duration: parseInt(e.target.value, 10) || 0 })}
                          className="max-w-[120px]"
                          data-testid={`input-service-duration-${index}`}
                        />
                      </div>
                      <Input
                        value={service.description || ""}
                        onChange={(e) => updateService(index, { description: e.target.value })}
                        placeholder="Short description (optional)"
                        data-testid={`input-service-description-${index}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-booking">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save booking page
            </Button>

            {settings?.bookingPageEnabled && settings?.bookingSlug ? (
              <div className="space-y-3 pt-2 border-t">
                <div className="space-y-2">
                  <Label>Your booking link</Label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs bg-muted rounded-md px-2 py-1.5 break-all flex-1 min-w-[200px]" data-testid="text-booking-url">
                      {`${window.location.origin}/book/${settings.bookingSlug}`}
                    </code>
                    <Button variant="outline" size="sm" onClick={() => copy(`${window.location.origin}/book/${settings.bookingSlug}`, "link")} data-testid="button-copy-booking-link">
                      {copied === "link" ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                      {copied === "link" ? "Copied" : "Copy"}
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`${window.location.origin}/book/${settings.bookingSlug}`} target="_blank" rel="noopener noreferrer" data-testid="link-open-booking">
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Open
                      </a>
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Code className="h-3.5 w-3.5" /> Embed button</Label>
                  <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto" data-testid="text-booking-embed"><code>{`<a href="${window.location.origin}/book/${settings.bookingSlug}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;border-radius:6px;font-family:sans-serif;text-decoration:none;font-weight:600;">Book a job</a>`}</code></pre>
                  <Button variant="outline" size="sm" onClick={() => copy(`<a href="${window.location.origin}/book/${settings.bookingSlug}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;border-radius:6px;font-family:sans-serif;text-decoration:none;font-weight:600;">Book a job</a>`, "embed")} data-testid="button-copy-booking-embed">
                    {copied === "embed" ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                    {copied === "embed" ? "Copied" : "Copy embed code"}
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function WebsiteAddon() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { canPurchaseAddons, isLoading: subscriptionLoading } = useFeatureAccess();
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: addon, isLoading: addonLoading } = useQuery<WebsiteAddon | null>({
    queryKey: ["/api/website-addon"],
  });

  const { data: changeRequests, isLoading: requestsLoading } = useQuery<ChangeRequest[]>({
    queryKey: ["/api/website-addon/change-requests"],
    enabled: !!addon,
  });

  const submitRequestMutation = useMutation({
    mutationFn: async (data: { description: string; priority: string; screenshotUrl?: string | null }) => {
      const response = await apiRequest("POST", "/api/website-addon/change-requests", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit request");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Request Submitted", description: "Your change request has been sent to the team." });
      setDescription("");
      setPriority("normal");
      clearScreenshot();
      queryClient.invalidateQueries({ queryKey: ["/api/website-addon/change-requests"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Submit", description: error.message, variant: "destructive" });
    },
  });

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File Too Large", description: "Screenshot must be under 5MB", variant: "destructive" });
        return;
      }
      setScreenshotFile(file);
      const reader = new FileReader();
      reader.onload = () => setScreenshotPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const clearScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    let screenshotUrl: string | null = null;

    if (screenshotFile) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", screenshotFile);
        formData.append("type", "website-change-request");
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          screenshotUrl = uploadData.url;
        }
      } catch {
        toast({ title: "Upload Failed", description: "Could not upload screenshot, submitting without it.", variant: "destructive" });
      } finally {
        setIsUploading(false);
      }
    }

    submitRequestMutation.mutate({
      description: description.trim(),
      priority,
      screenshotUrl,
    });
  };

  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const featureToggleMutation = useMutation({
    mutationFn: async (data: { websiteClickToCall?: boolean; websiteChatWidget?: boolean; websiteBookingForm?: boolean }) => {
      const response = await apiRequest("PATCH", "/api/website-addon/features", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update features");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Feature Updated", description: "Website feature settings have been saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/website-addon"] });
      queryClient.invalidateQueries({ queryKey: ["/api/website-addon/embed-snippets"] });
    },
    onError: (error: Error) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    },
  });

  const { data: embedSnippets } = useQuery<EmbedSnippets>({
    queryKey: ["/api/website-addon/embed-snippets"],
    enabled: !!addon && (!!addon.websiteClickToCall || !!addon.websiteChatWidget || !!addon.websiteBookingForm),
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSnippet(label);
      toast({ title: "Copied", description: `${label} embed code copied to clipboard.` });
      setTimeout(() => setCopiedSnippet(null), 2000);
    });
  };

  const domainConfig = getDomainStatusConfig(addon?.domainStatus || "not_set_up");
  const hostingConfig = getHostingStatusConfig(addon?.hostingStatus || "inactive");
  const DomainIcon = domainConfig.icon;

  const hasWebsite = addon?.domainUrl && addon.domainStatus === "active";
  const hasAddonAccess = !!addon;

  if (!addonLoading && !hasAddonAccess && !subscriptionLoading) {
    return (
      <PageShell>
        <PageHeader
          title="Website"
          subtitle="Get a professional website for your trade business"
          leading={
            <Button variant="ghost" size="icon" onClick={() => setLocation("/settings")} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          }
        />
        <div className="max-w-lg mx-auto mb-6">
          <BookingPortalCard />
        </div>
        <div className="max-w-lg mx-auto">
          <Card data-testid="card-website-upgrade">
            <CardContent className="flex flex-col items-center text-center py-12 px-6">
              <div className="rounded-full bg-primary/10 p-4 mb-5">
                <Globe className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Your Own Professional Tradie Website</h2>
              <p className="text-muted-foreground mb-4 max-w-sm">
                Built from your JobRunner data. Your services, reviews, and contact details — all in one place. Leads from your website flow straight back into your jobs.
              </p>
              <div className="space-y-2 text-sm text-left w-full max-w-xs mb-6">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                  <span>Custom domain (yourbusiness.com.au)</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                  <span>Professionally designed and hosted for you</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                  <span>Request changes anytime — we handle the updates</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                  <span>Leads flow directly into your JobRunner jobs</span>
                </div>
              </div>
              <div className="bg-muted/50 rounded-md p-4 mb-6 w-full">
                <p className="text-sm text-muted-foreground">Included in the Full Bundle, or add standalone</p>
                <p className="text-2xl font-bold mt-1">Custom quote based on your needs</p>
              </div>
              {canPurchaseAddons ? (
                <Button onClick={() => setLocation("/settings?tab=billing")} data-testid="button-upgrade-website">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Get Your Website
                </Button>
              ) : (
                <Button onClick={() => setLocation("/settings?tab=billing")} data-testid="button-upgrade-website">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Upgrade to Pro
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Website"
        subtitle="Preview your live website, check domain status, and request changes"
        leading={
          <Button variant="ghost" size="icon" onClick={() => setLocation("/settings")} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <BookingPortalCard />
          <Card data-testid="card-website-preview">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                Website Preview
              </CardTitle>
              {addon?.domainUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={addon.domainUrl.startsWith("http") ? addon.domainUrl : `https://${addon.domainUrl}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Open
                  </a>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {addonLoading ? (
                <div className="flex items-center justify-center h-[400px] bg-muted/30 rounded-md">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : hasWebsite ? (
                <div className="relative w-full rounded-md overflow-hidden border" style={{ paddingBottom: "56.25%" }}>
                  <iframe
                    src={addon.domainUrl!.startsWith("http") ? addon.domainUrl! : `https://${addon.domainUrl}`}
                    className="absolute inset-0 w-full h-full"
                    title="Website Preview"
                    sandbox="allow-scripts allow-same-origin"
                    loading="lazy"
                    data-testid="iframe-website-preview"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] bg-muted/20 rounded-md border border-dashed" data-testid="website-not-configured">
                  <Globe className="h-12 w-12 text-muted-foreground/40 mb-4" />
                  <p className="text-muted-foreground font-medium mb-1">No website configured yet</p>
                  <p className="text-sm text-muted-foreground/70">Your custom website will appear here once it's been set up by the team.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-change-request-form">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4 text-muted-foreground" />
                Request a Change
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">What needs changing?</label>
                  <Textarea
                    placeholder="Describe what you'd like changed on your website..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-[100px] resize-none"
                    data-testid="textarea-change-description"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Priority</label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger data-testid="select-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Screenshot (optional)</label>
                  {screenshotPreview ? (
                    <div className="relative inline-block">
                      <img
                        src={screenshotPreview}
                        alt="Screenshot preview"
                        className="max-h-32 rounded-md border"
                        data-testid="img-screenshot-preview"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="absolute -top-2 -right-2 rounded-full"
                        onClick={clearScreenshot}
                        data-testid="button-clear-screenshot"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover-elevate rounded-md border border-dashed p-3" data-testid="label-screenshot-upload">
                      <ImagePlus className="h-4 w-4" />
                      <span>Attach a screenshot</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleScreenshotChange}
                        data-testid="input-screenshot"
                      />
                    </label>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={!description.trim() || submitRequestMutation.isPending || isUploading}
                  data-testid="button-submit-change-request"
                >
                  {(submitRequestMutation.isPending || isUploading) ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {isUploading ? "Uploading..." : "Submit Request"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card data-testid="card-domain-status">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                Domain & Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {addonLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 bg-muted animate-pulse rounded-md" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Domain URL</p>
                    {addon?.domainUrl ? (
                      <a
                        href={addon.domainUrl.startsWith("http") ? addon.domainUrl : `https://${addon.domainUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                        data-testid="link-domain-url"
                      >
                        {addon.domainUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not configured</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Domain Status</p>
                    <Badge variant={domainConfig.variant} className={domainConfig.className} data-testid="badge-domain-status">
                      <DomainIcon className="h-3 w-3 mr-1" />
                      {domainConfig.label}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Hosting Status</p>
                    <Badge variant="outline" className={hostingConfig.className} data-testid="badge-hosting-status">
                      {hostingConfig.label}
                    </Badge>
                  </div>

                  {addon?.monthlyFee && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Monthly Fee</p>
                      <p className="text-sm font-medium">${parseFloat(addon.monthlyFee).toFixed(2)}/mo</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-change-request-history">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                Change Request History
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/website-addon/change-requests"] })}
                data-testid="button-refresh-requests"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
                  ))}
                </div>
              ) : changeRequests && changeRequests.length > 0 ? (
                <div className="space-y-3">
                  {changeRequests.map((request) => {
                    const priorityConfig = getPriorityConfig(request.priority);
                    const statusConfig = getStatusConfig(request.status);
                    return (
                      <div
                        key={request.id}
                        className="p-3 rounded-md border space-y-2"
                        data-testid={`change-request-${request.id}`}
                      >
                        <p className="text-sm line-clamp-2">{request.description}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={priorityConfig.className}>
                            {priorityConfig.label}
                          </Badge>
                          <Badge variant="outline" className={statusConfig.className}>
                            {statusConfig.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {request.createdAt ? format(new Date(request.createdAt), "dd MMM yyyy 'at' h:mm a") : ""}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8" data-testid="no-change-requests">
                  <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No change requests yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Submit a request using the form</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {hasAddonAccess && (
        <div className="space-y-6 mt-6">
          <Card data-testid="card-website-features">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Website Features</CardTitle>
              <CardDescription>Enable interactive features on your website to generate more leads</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4 p-3 rounded-md border" data-testid="toggle-click-to-call">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-blue-100 dark:bg-blue-500/15 p-2">
                    <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Click-to-Call Button</p>
                    <p className="text-xs text-muted-foreground">Floating call button that dials your dedicated number</p>
                  </div>
                </div>
                <Switch
                  checked={addon?.websiteClickToCall || false}
                  onCheckedChange={(checked) => featureToggleMutation.mutate({ websiteClickToCall: checked })}
                  disabled={featureToggleMutation.isPending}
                  data-testid="switch-click-to-call"
                />
              </div>

              <div className="flex items-center justify-between gap-4 p-3 rounded-md border" data-testid="toggle-chat-widget">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-purple-100 dark:bg-purple-500/15 p-2">
                    <MessageSquare className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">AI Chat Widget</p>
                    <p className="text-xs text-muted-foreground">AI-powered live chat using your knowledge bank</p>
                  </div>
                </div>
                <Switch
                  checked={addon?.websiteChatWidget || false}
                  onCheckedChange={(checked) => featureToggleMutation.mutate({ websiteChatWidget: checked })}
                  disabled={featureToggleMutation.isPending}
                  data-testid="switch-chat-widget"
                />
              </div>

              <div className="flex items-center justify-between gap-4 p-3 rounded-md border" data-testid="toggle-booking-form">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-green-100 dark:bg-green-500/15 p-2">
                    <CalendarPlus className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Booking / Contact Form</p>
                    <p className="text-xs text-muted-foreground">Collects name, phone, email, job type and creates leads</p>
                  </div>
                </div>
                <Switch
                  checked={addon?.websiteBookingForm || false}
                  onCheckedChange={(checked) => featureToggleMutation.mutate({ websiteBookingForm: checked })}
                  disabled={featureToggleMutation.isPending}
                  data-testid="switch-booking-form"
                />
              </div>
            </CardContent>
          </Card>

          {(addon?.websiteClickToCall || addon?.websiteChatWidget || addon?.websiteBookingForm) && embedSnippets && (
            <Card data-testid="card-embed-snippets">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Code className="h-4 w-4 text-muted-foreground" />
                  Embed Code Snippets
                </CardTitle>
                <CardDescription>Copy and paste these into your website HTML to enable each feature</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {embedSnippets.clickToCall && (
                  <div className="space-y-2" data-testid="snippet-click-to-call">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        Click-to-Call
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(embedSnippets.clickToCall!, "Click-to-Call")}
                        data-testid="button-copy-click-to-call"
                      >
                        {copiedSnippet === "Click-to-Call" ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                        {copiedSnippet === "Click-to-Call" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-x-auto max-h-32 border">
                      <code>{embedSnippets.clickToCall}</code>
                    </pre>
                  </div>
                )}

                {embedSnippets.chatWidget && (
                  <div className="space-y-2" data-testid="snippet-chat-widget">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                        AI Chat Widget
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(embedSnippets.chatWidget!, "Chat Widget")}
                        data-testid="button-copy-chat-widget"
                      >
                        {copiedSnippet === "Chat Widget" ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                        {copiedSnippet === "Chat Widget" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-x-auto max-h-32 border">
                      <code>{embedSnippets.chatWidget}</code>
                    </pre>
                  </div>
                )}

                {embedSnippets.bookingForm && (
                  <div className="space-y-2" data-testid="snippet-booking-form">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        <CalendarPlus className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                        Booking Form
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(embedSnippets.bookingForm!, "Booking Form")}
                        data-testid="button-copy-booking-form"
                      >
                        {copiedSnippet === "Booking Form" ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                        {copiedSnippet === "Booking Form" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-x-auto max-h-32 border">
                      <code>{embedSnippets.bookingForm}</code>
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </PageShell>
  );
}
