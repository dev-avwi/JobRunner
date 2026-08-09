import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getSessionToken } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  Calendar,
  Plus,
  FileText,
  Receipt,
  Camera,
  DollarSign,
  Clock,
  ChevronRight,
  TrendingUp,
  History,
  MessageSquare,
  Star,
  FolderOpen,
  PenTool,
  File,
  Copy,
  CheckCircle,
  MessageCircle,
  Pencil,
  X,
  Trash2,
  AlertTriangle,
  Loader2,
  ClipboardList,
  Tag,
  Building2,
  UserCheck,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import StatusBadge from "./StatusBadge";
import KPIBox from "./KPIBox";
import { useLocation } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { ImportOriginBadge } from "./ImportOriginBadge";

interface ClientDetailViewProps {
  clientId: string;
  onBack?: () => void;
  onCreateJob?: (clientId: string, clientAddress?: string) => void;
  onCreateQuote?: (clientId: string) => void;
  onViewJob?: (jobId: string) => void;
  onViewQuote?: (quoteId: string) => void;
  onViewInvoice?: (invoiceId: string) => void;
}

export default function ClientDetailView({ 
  clientId, 
  onBack, 
  onCreateJob,
  onCreateQuote,
  onViewJob,
  onViewQuote,
  onViewInvoice
}: ClientDetailViewProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteAssociatedData, setDeleteAssociatedData] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    clientType: "",
    referralSource: ""
  });
  const [newTagInput, setNewTagInput] = useState("");
  const [tagSuggestionsOpen, setTagSuggestionsOpen] = useState(false);
  const { toast } = useToast();
  const [portalPreviewLoading, setPortalPreviewLoading] = useState(false);
  
  const handleViewInPortal = async () => {
    const newTab = window.open('about:blank', '_blank');
    setPortalPreviewLoading(true);
    try {
      const res = await apiRequest('POST', '/api/portal/admin-preview', { clientId });
      const data = await res.json();
      if (data.sessionToken) {
        const portalUrl = `${window.location.origin}/portal?preview_token=${data.sessionToken}`;
        if (newTab) {
          newTab.location.href = portalUrl;
        } else {
          window.open(portalUrl, '_blank');
        }
      } else {
        newTab?.close();
        toast({ title: "Unable to preview", description: data.error || "Could not generate portal preview", variant: "destructive" });
      }
    } catch (err: any) {
      newTab?.close();
      toast({ title: "Portal Preview Error", description: err.message || "Failed to open client portal", variant: "destructive" });
    } finally {
      setPortalPreviewLoading(false);
    }
  };

  // Update client mutation
  const updateClientMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      await apiRequest('PATCH', `/api/clients/${clientId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients/tags'] });
      setIsEditDialogOpen(false);
      toast({
        title: "Client updated",
        description: "Client details have been saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Could not update client details. Please try again.",
        variant: "destructive",
      });
    }
  });

  const openEditDialog = () => {
    if (client) {
      setEditForm({
        name: client.name || "",
        email: client.email || "",
        phone: client.phone || "",
        address: client.address || "",
        clientType: client.clientType || "",
        referralSource: client.referralSource || ""
      });
      setIsEditDialogOpen(true);
    }
  };

  const handleSaveClient = () => {
    if (!editForm.name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a client name",
        variant: "destructive",
      });
      return;
    }
    updateClientMutation.mutate(editForm);
  };

  // Delete client mutation
  const deleteClientMutation = useMutation({
    mutationFn: async (deleteAssociated: boolean) => {
      const url = `/api/clients/${clientId}${deleteAssociated ? '?deleteAssociated=true' : ''}`;
      await apiRequest('DELETE', url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      setIsDeleteDialogOpen(false);
      toast({
        title: "Client deleted",
        description: deleteAssociatedData 
          ? "Client and all associated data have been deleted" 
          : "Client has been deleted",
      });
      if (onBack) {
        onBack();
      } else {
        setLocation('/clients');
      }
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Could not delete client. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleDeleteClient = () => {
    deleteClientMutation.mutate(deleteAssociatedData);
  };

  const { data: clientRequests = [] } = useQuery<any[]>({
    queryKey: ['/api/job-requests', 'client', clientId],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch(`/api/job-requests?clientId=${clientId}`, { 
        credentials: 'include', 
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined 
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['/api/clients', clientId],
    queryFn: async () => {
      const token = getSessionToken();
      const response = await fetch(`/api/clients/${clientId}`, { credentials: 'include', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
      if (!response.ok) throw new Error('Failed to fetch client');
      return response.json();
    }
  });

  const { data: allTags = [] } = useQuery<string[]>({
    queryKey: ['/api/clients/tags'],
    queryFn: async () => {
      const token = getSessionToken();
      const response = await fetch('/api/clients/tags', { credentials: 'include', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
      if (!response.ok) return [];
      return response.json();
    }
  });

  const clientTags: string[] = Array.isArray(client?.tags) ? client.tags : [];

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || clientTags.includes(trimmed)) return;
    updateClientMutation.mutate({ tags: [...clientTags, trimmed] });
    setNewTagInput("");
    setTagSuggestionsOpen(false);
  };

  const removeTag = (tag: string) => {
    updateClientMutation.mutate({ tags: clientTags.filter(t => t !== tag) });
  };

  const tagSuggestions = allTags.filter(
    t => t.toLowerCase().includes(newTagInput.toLowerCase()) && !clientTags.includes(t)
  );

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['/api/clients', clientId, 'jobs'],
    queryFn: async () => {
      const token = getSessionToken();
      const response = await fetch(`/api/clients/${clientId}/jobs`, { credentials: 'include', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!clientId
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ['/api/clients', clientId, 'quotes'],
    queryFn: async () => {
      const token = getSessionToken();
      const response = await fetch(`/api/clients/${clientId}/quotes`, { credentials: 'include', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!clientId
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['/api/clients', clientId, 'invoices'],
    queryFn: async () => {
      const token = getSessionToken();
      const response = await fetch(`/api/clients/${clientId}/invoices`, { credentials: 'include', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!clientId
  });

  const { data: allPhotos = [], isLoading: photosLoading } = useQuery({
    queryKey: ['/api/clients', clientId, 'photos'],
    queryFn: async () => {
      const allJobPhotos: any[] = [];
      for (const job of jobs) {
        try {
          const token = getSessionToken();
          const response = await fetch(`/api/jobs/${job.id}/photos`, { credentials: 'include', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
          if (response.ok) {
            const photos = await response.json();
            allJobPhotos.push(...photos.map((p: any) => ({ ...p, jobId: job.id, jobTitle: job.title })));
          }
        } catch (e) {
          console.error('Failed to fetch job photos:', e);
        }
      }
      return allJobPhotos;
    },
    enabled: jobs.length > 0
  });

  const { data: clientAssets, isLoading: assetsLoading } = useQuery({
    queryKey: ['/api/clients', clientId, 'assets'],
    queryFn: async () => {
      const token = getSessionToken();
      const response = await fetch(`/api/clients/${clientId}/assets`, { credentials: 'include', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
      if (!response.ok) throw new Error('Failed to fetch assets');
      return response.json();
    },
    enabled: !!clientId
  });

  // Customer Asset Register (vessels / equipment owned by the client)
  const { data: assetRegister = [], isLoading: registerLoading } = useQuery<any[]>({
    queryKey: ['/api/client-assets', clientId],
    queryFn: async () => {
      const token = getSessionToken();
      const response = await fetch(`/api/client-assets?clientId=${clientId}`, { credentials: 'include', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
      if (!response.ok) throw new Error('Failed to fetch asset register');
      return response.json();
    },
    enabled: !!clientId
  });

  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [assetForm, setAssetForm] = useState({ name: '', assetType: 'vessel', manufacturer: '', model: '', serialNumber: '', location: '' });
  const [attachAssetId, setAttachAssetId] = useState<string | null>(null);
  const [attachJobId, setAttachJobId] = useState('');

  const createAssetMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/client-assets', { ...assetForm, clientId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-assets', clientId] });
      setAssetDialogOpen(false);
      setAssetForm({ name: '', assetType: 'vessel', manufacturer: '', model: '', serialNumber: '', location: '' });
      toast({ title: "Asset added" });
    },
    onError: () => toast({ title: "Could not add asset", variant: "destructive" }),
  });

  const deleteAssetMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/client-assets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-assets', clientId] });
      toast({ title: "Asset removed" });
    },
    onError: () => toast({ title: "Could not remove asset", variant: "destructive" }),
  });

  const attachJobMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/client-assets/${attachAssetId}/services`, {
        jobId: attachJobId,
        serviceType: 'maintenance',
        title: (jobs as any[]).find((j: any) => j.id === attachJobId)?.title || 'Job',
        serviceDate: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-assets', clientId] });
      setAttachAssetId(null);
      setAttachJobId('');
      toast({ title: "Job linked to asset" });
    },
    onError: () => toast({ title: "Could not link job", variant: "destructive" }),
  });

  // Fetch client's saved signature (stored on the client profile)
  const { data: savedSignature } = useQuery<{
    hasSavedSignature: boolean;
    signatureData: string | null;
    signatureDate: string | null;
    clientName: string;
  }>({
    queryKey: ['/api/clients', clientId, 'saved-signature'],
    queryFn: async () => {
      const token = getSessionToken();
      const response = await fetch(`/api/clients/${clientId}/saved-signature`, { credentials: 'include', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
      if (!response.ok) throw new Error('Failed to fetch saved signature');
      return response.json();
    },
    enabled: !!clientId
  });

  // Clear saved signature mutation
  const clearSignatureMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', `/api/clients/${clientId}/saved-signature`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'saved-signature'] });
      toast({
        title: "Signature cleared",
        description: "The saved signature has been removed from this client's profile",
      });
    },
    onError: () => {
      toast({
        title: "Failed to clear signature",
        description: "Please try again",
        variant: "destructive",
      });
    }
  });

  const [quickAddPopoverId, setQuickAddPopoverId] = useState<string | null>(null);
  const [copyingToJobId, setCopyingToJobId] = useState<string | null>(null);

  const copyPhotoToJobMutation = useMutation({
    mutationFn: async ({ targetJobId, sourceJobId, photoId }: { targetJobId: string; sourceJobId: string; photoId: string }) => {
      await apiRequest('POST', `/api/jobs/${targetJobId}/photos/copy`, {
        sourceJobId,
        photoIds: [photoId]
      });
    },
    onSuccess: (_, variables) => {
      const targetJob = jobs.find((j: any) => j.id === variables.targetJobId);
      toast({
        title: "Photo added to job",
        description: `Photo copied to "${targetJob?.title || 'job'}"`,
      });
      setQuickAddPopoverId(null);
      setCopyingToJobId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', variables.targetJobId, 'photos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'photos'] });
    },
    onError: () => {
      toast({
        title: "Failed to copy photo",
        description: "Please try again",
        variant: "destructive",
      });
      setCopyingToJobId(null);
    }
  });

  const [copiedAssetId, setCopiedAssetId] = useState<string | null>(null);
  
  const handleCopyAsset = async (asset: any, type: 'photo' | 'signature') => {
    try {
      if (type === 'signature' && asset.signatureData) {
        // For signatures, copy the data URL to clipboard
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(asset.signatureData);
          setCopiedAssetId(asset.id);
          toast({
            title: "Signature copied",
            description: "Signature data copied to clipboard for reuse",
          });
          setTimeout(() => setCopiedAssetId(null), 2000);
        } else {
          toast({
            title: "Unable to copy",
            description: "Clipboard not available in this browser",
            variant: "destructive",
          });
        }
      } else if (type === 'photo' && asset.signedUrl) {
        // For photos, open in new tab for download/save
        window.open(asset.signedUrl, '_blank');
        setCopiedAssetId(asset.id);
        toast({
          title: "Photo opened",
          description: "Photo opened in new tab for download",
        });
        setTimeout(() => setCopiedAssetId(null), 1500);
      }
    } catch (error) {
      console.error('Failed to copy asset:', error);
      toast({
        title: "Action failed",
        description: "Could not complete the action. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(num || 0);
  };

  if (clientLoading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading client details...</p>
          </div>
        </div>
      </PageShell>
    );
  }

  if (!client) {
    return (
      <PageShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">Client not found</p>
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Clients
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  const totalJobValue = jobs.reduce((sum: number, job: any) => {
    const quote = quotes.find((q: any) => q.jobId === job.id);
    return sum + (quote?.total ? parseFloat(quote.total) : 0);
  }, 0);

  const paidInvoices = invoices.filter((i: any) => i.status === 'paid');
  const totalPaid = paidInvoices.reduce((sum: number, i: any) => sum + parseFloat(i.total || '0'), 0);
  const unpaidInvoices = invoices.filter((i: any) => i.status === 'sent' || i.status === 'overdue');
  const totalUnpaid = unpaidInvoices.reduce((sum: number, i: any) => sum + parseFloat(i.total || '0'), 0);

  const completedJobs = jobs.filter((j: any) => j.status === 'done' || j.status === 'invoiced');
  const activeJobs = jobs.filter((j: any) => j.status === 'in_progress' || j.status === 'scheduled');

  const sortedJobs = [...jobs].sort((a: any, b: any) => 
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
  const lastJob = sortedJobs.length > 0 ? sortedJobs[0] : null;

  const createTimelineEvents = () => {
    const events: any[] = [];
    
    jobs.forEach((job: any) => {
      events.push({
        type: 'job',
        id: job.id,
        title: job.title,
        status: job.status,
        date: job.createdAt || job.scheduledAt,
        icon: Briefcase,
        action: () => onViewJob?.(job.id)
      });
    });
    
    quotes.forEach((quote: any) => {
      events.push({
        type: 'quote',
        id: quote.id,
        title: `Quote ${quote.number || '#' + quote.id.slice(0, 6)}`,
        status: quote.status,
        date: quote.createdAt || quote.sentAt,
        amount: quote.total,
        icon: FileText,
        action: () => onViewQuote ? onViewQuote(quote.id) : setLocation(`/quotes/${quote.id}`)
      });
    });
    
    invoices.forEach((invoice: any) => {
      events.push({
        type: 'invoice',
        id: invoice.id,
        title: `Invoice ${invoice.number || '#' + invoice.id.slice(0, 6)}`,
        status: invoice.status,
        date: invoice.createdAt || invoice.sentAt,
        amount: invoice.total,
        icon: Receipt,
        action: () => onViewInvoice ? onViewInvoice(invoice.id) : setLocation(`/invoices/${invoice.id}`)
      });
    });
    
    return events.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  };

  const timelineEvents = createTimelineEvents();

  return (
    <PageShell data-testid="client-detail">
      <PageHeader
        title={client.name}
        subtitle="Client Profile"
        action={
          <Button variant="outline" onClick={onBack} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPIBox
          icon={Briefcase}
          title="Total Jobs"
          value={jobs.length.toString()}
          onClick={() => setActiveTab("jobs")}
        />
        <KPIBox
          icon={TrendingUp}
          title="Total Revenue"
          value={formatCurrency(totalPaid)}
        />
        <KPIBox
          icon={Clock}
          title="Outstanding"
          value={formatCurrency(totalUnpaid)}
        />
        <KPIBox
          icon={Star}
          title="Active Jobs"
          value={activeJobs.length.toString()}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-4 p-4 border-b">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
              style={{ backgroundColor: 'hsl(var(--trade))' }}
            >
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold truncate">{client.name}</h2>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {lastJob && (
                  <span>Last job: {formatRelativeDate(lastJob.createdAt || lastJob.scheduledAt)}</span>
                )}
                {jobs.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {completedJobs.length} completed
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={openEditDialog}
                data-testid="button-edit-client"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setIsDeleteDialogOpen(true)}
                data-testid="button-delete-client"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x">
            {client.email && (
              <a 
                href={`mailto:${client.email}`}
                className="flex items-center gap-3 p-4 hover-elevate"
                data-testid="link-email"
              >
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium truncate">{client.email}</p>
                </div>
              </a>
            )}
            
            {client.phone && (
              <a 
                href={`tel:${client.phone}`}
                className="flex items-center gap-3 p-4 hover-elevate"
                data-testid="link-phone"
              >
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-medium">{client.phone}</p>
                </div>
              </a>
            )}
            
            {client.address && (
              <a 
                href={`https://maps.google.com/?q=${encodeURIComponent(client.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 hover-elevate"
                data-testid="link-address"
              >
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="text-sm font-medium truncate">{client.address}</p>
                </div>
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Tags & Classification</span>
            </div>
            {client.clientType && (
              <Badge variant="outline" className="text-xs capitalize">
                <Building2 className="h-3 w-3 mr-1" />
                {client.clientType}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {clientTags.map((tag: string) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs gap-1"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
            <Popover open={tagSuggestionsOpen} onOpenChange={setTagSuggestionsOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  data-testid="button-add-tag"
                >
                  <Plus className="h-3 w-3" />
                  Add Tag
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <Input
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder="Type a tag..."
                  className="h-8 text-xs mb-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTagInput.trim()) {
                      addTag(newTagInput);
                    }
                  }}
                  data-testid="input-new-tag"
                  autoFocus
                />
                {tagSuggestions.length > 0 && (
                  <div className="max-h-32 overflow-y-auto space-y-0.5">
                    {tagSuggestions.slice(0, 8).map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => addTag(suggestion)}
                        className="w-full text-left text-xs px-2 py-1.5 rounded hover-elevate"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
                {newTagInput.trim() && !allTags.includes(newTagInput.trim()) && (
                  <button
                    onClick={() => addTag(newTagInput)}
                    className="w-full text-left text-xs px-2 py-1.5 rounded hover-elevate text-muted-foreground mt-1 border-t pt-2"
                  >
                    <Plus className="h-3 w-3 inline mr-1" />
                    Create "{newTagInput.trim()}"
                  </button>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {(client as any).importRunId && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ImportOriginBadge importRunId={(client as any).importRunId} rowNumber={(client as any).importRowNumber} />
            </div>
          )}
          {client.referralSource && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <UserCheck className="h-3.5 w-3.5" />
              <span>Referred via: {client.referralSource}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button 
          onClick={() => onCreateJob?.(clientId, client.address)}
          className="text-white"
          style={{ backgroundColor: 'hsl(var(--trade))' }}
          data-testid="button-create-job"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Job
        </Button>
        <Button 
          variant="outline"
          onClick={() => onCreateQuote?.(clientId)}
          data-testid="button-create-quote"
        >
          <FileText className="h-4 w-4 mr-2" />
          New Quote
        </Button>
        {client.email && (
          <Button 
            variant="outline"
            onClick={() => window.open(`mailto:${client.email}`)}
            data-testid="button-send-email"
          >
            <Mail className="h-4 w-4 mr-2" />
            Email
          </Button>
        )}
        {client.phone && (
          <Button 
            variant="outline"
            onClick={() => window.open(`tel:${client.phone}`)}
            data-testid="button-call"
          >
            <Phone className="h-4 w-4 mr-2" />
            Call
          </Button>
        )}
        {client.phone && (
          <Button 
            variant="outline"
            onClick={() => setLocation(`/chat?clientId=${clientId}&phone=${encodeURIComponent(client.phone)}`)}
            data-testid="button-sms"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            SMS
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-6 h-auto">
          <TabsTrigger value="overview" className="text-xs py-2.5" data-testid="tab-overview">
            <History className="h-3.5 w-3.5 mr-1" />
            <span className="hidden sm:inline">Activity</span>
          </TabsTrigger>
          <TabsTrigger value="jobs" className="text-xs py-2.5" data-testid="tab-jobs">
            <Briefcase className="h-3.5 w-3.5 mr-1" />
            <span className="hidden sm:inline">Jobs</span>
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{jobs.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="quotes" className="text-xs py-2.5" data-testid="tab-quotes">
            <FileText className="h-3.5 w-3.5 mr-1" />
            <span className="hidden sm:inline">Quotes</span>
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{quotes.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs py-2.5" data-testid="tab-invoices">
            <Receipt className="h-3.5 w-3.5 mr-1" />
            <span className="hidden sm:inline">Invoices</span>
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{invoices.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="photos" className="text-xs py-2.5" data-testid="tab-photos">
            <Camera className="h-3.5 w-3.5 mr-1" />
            <span className="hidden sm:inline">Photos</span>
          </TabsTrigger>
          <TabsTrigger value="assets" className="text-xs py-2.5" data-testid="tab-assets">
            <FolderOpen className="h-3.5 w-3.5 mr-1" />
            <span className="hidden sm:inline">Assets</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {clientRequests.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                  <ClipboardList className="h-4 w-4" />
                  Job Requests
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{clientRequests.length}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto text-xs"
                    onClick={handleViewInPortal}
                    disabled={portalPreviewLoading}
                  >
                    {portalPreviewLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ExternalLink className="h-3 w-3 mr-1" />}
                    View in Portal
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {clientRequests.map((req: any) => (
                  <div key={req.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{req.title}</span>
                        <Badge className={cn(
                          "text-xs",
                          req.status === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                          req.status === 'accepted' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                          'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        )}>
                          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                        </Badge>
                      </div>
                      {req.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{req.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {req.preferredDate && (
                          <span>Preferred: {new Date(req.preferredDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        )}
                        {req.urgency && req.urgency !== 'normal' && (
                          <Badge className={cn(
                            "text-[10px]",
                            req.urgency === 'urgent' || req.urgency === 'emergency' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          )}>
                            {req.urgency.charAt(0).toUpperCase() + req.urgency.slice(1)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <History className="h-4 w-4" />
                Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timelineEvents.length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">No activity yet with this client</p>
                  <Button 
                    size="sm"
                    onClick={() => onCreateJob?.(clientId)}
                    className="text-white"
                    style={{ backgroundColor: 'hsl(var(--trade))' }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Job
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                  <div className="space-y-4">
                    {timelineEvents.slice(0, 10).map((event, index) => (
                      <div 
                        key={`${event.type}-${event.id}`}
                        className="relative flex gap-4 cursor-pointer hover-elevate rounded-lg p-2 -ml-2"
                        onClick={event.action}
                        data-testid={`timeline-${event.type}-${event.id}`}
                      >
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center z-10 flex-shrink-0"
                          style={{ 
                            backgroundColor: event.type === 'job' 
                              ? 'hsl(var(--trade) / 0.1)' 
                              : event.type === 'quote'
                              ? 'hsl(var(--primary) / 0.1)'
                              : 'hsl(var(--success) / 0.1)'
                          }}
                        >
                          <event.icon 
                            className="h-4 w-4" 
                            style={{ 
                              color: event.type === 'job' 
                                ? 'hsl(var(--trade))' 
                                : event.type === 'quote'
                                ? 'hsl(var(--primary))'
                                : 'hsl(var(--success))'
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{event.title}</p>
                            <StatusBadge status={event.status} />
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span>
                              {event.date && !isNaN(new Date(event.date).getTime()) 
                                ? formatRelativeDate(event.date) 
                                : 'No date'}
                            </span>
                            {event.amount && (
                              <span className="font-medium">{formatCurrency(event.amount)}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {client.notes && (
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="jobs" className="mt-4 space-y-3">
          {jobsLoading ? (
            <Card>
              <CardContent className="py-8">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              </CardContent>
            </Card>
          ) : jobs.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <Briefcase className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">No jobs yet for this client</p>
                  <Button 
                    size="sm"
                    onClick={() => onCreateJob?.(clientId)}
                    className="text-white"
                    style={{ backgroundColor: 'hsl(var(--trade))' }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Job
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            jobs.map((job: any) => (
              <Card
                key={job.id}
                className="hover-elevate active-elevate-2 cursor-pointer"
                style={{ borderRadius: '14px' }}
                onClick={() => onViewJob?.(job.id)}
                data-testid={`job-card-${job.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
                        >
                          <Briefcase className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm truncate">{job.title}</h3>
                            <StatusBadge status={job.status} />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {job.scheduledAt ? formatDate(job.scheduledAt) : 'Not scheduled'}
                          </div>
                        </div>
                      </div>
                      {job.address && (
                        <div className="pl-12 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{job.address}</span>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="quotes" className="mt-4 space-y-3">
          {quotes.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">No quotes yet for this client</p>
                  <Button 
                    size="sm"
                    onClick={() => onCreateQuote?.(clientId)}
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Quote
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            quotes.map((quote: any) => (
              <Card
                key={quote.id}
                className="hover-elevate active-elevate-2 cursor-pointer"
                style={{ borderRadius: '14px' }}
                onClick={() => onViewQuote ? onViewQuote(quote.id) : setLocation(`/quotes/${quote.id}`)}
                data-testid={`quote-card-${quote.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: 'hsl(var(--primary) / 0.1)' }}
                        >
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm">{quote.number || `Q-${quote.id.slice(0, 6)}`}</h3>
                            <StatusBadge status={quote.status} />
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{quote.title}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <p className="font-bold text-sm" style={{ color: 'hsl(var(--trade))' }}>
                          {formatCurrency(quote.total)}
                        </p>
                        {quote.sentAt && (
                          <p className="text-[10px] text-muted-foreground">
                            Sent {formatRelativeDate(quote.sentAt)}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="invoices" className="mt-4 space-y-3">
          {invoices.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <Receipt className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No invoices yet for this client</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create a quote first, then convert to invoice when accepted
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {unpaidInvoices.length > 0 && (
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {formatCurrency(totalUnpaid)} outstanding
                    </span>
                    <span className="text-xs text-amber-600">
                      ({unpaidInvoices.length} invoice{unpaidInvoices.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                </div>
              )}
              
              {invoices.map((invoice: any) => (
                <Card
                  key={invoice.id}
                  className="hover-elevate active-elevate-2 cursor-pointer"
                  style={{ borderRadius: '14px' }}
                  onClick={() => onViewInvoice ? onViewInvoice(invoice.id) : setLocation(`/invoices/${invoice.id}`)}
                  data-testid={`invoice-card-${invoice.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ 
                              backgroundColor: invoice.status === 'paid' 
                                ? 'hsl(var(--success) / 0.1)' 
                                : 'hsl(var(--trade) / 0.1)' 
                            }}
                          >
                            <Receipt 
                              className="h-5 w-5" 
                              style={{ 
                                color: invoice.status === 'paid' 
                                  ? 'hsl(var(--success))' 
                                  : 'hsl(var(--trade))' 
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-sm">{invoice.number || `INV-${invoice.id.slice(0, 6)}`}</h3>
                              <StatusBadge status={invoice.status} />
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{invoice.title}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right">
                          <p className="font-bold text-sm" style={{ color: 'hsl(var(--trade))' }}>
                            {formatCurrency(invoice.total)}
                          </p>
                          {invoice.paidAt ? (
                            <p className="text-[10px] text-green-600">
                              Paid {formatRelativeDate(invoice.paidAt)}
                            </p>
                          ) : invoice.dueDate && (
                            <p className={`text-[10px] ${invoice.status === 'overdue' ? 'text-destructive' : 'text-muted-foreground'}`}>
                              Due {formatDate(invoice.dueDate)}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="photos" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Job Photos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {photosLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : allPhotos.length === 0 ? (
                <div className="text-center py-8">
                  <Camera className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No photos yet for this client's jobs</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Photos from jobs will appear here automatically
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {allPhotos.map((photo: any) => {
                    const otherJobs = jobs.filter((j: any) => j.id !== photo.jobId);
                    return (
                      <div 
                        key={photo.id}
                        className="relative group aspect-square rounded-lg overflow-hidden border cursor-pointer"
                        onClick={() => photo.signedUrl && window.open(photo.signedUrl, '_blank')}
                      >
                        {photo.signedUrl ? (
                          <img 
                            src={photo.signedUrl} 
                            alt={photo.caption || photo.fileName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Camera className="h-8 w-8 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                          <div className="text-white text-xs flex-1 min-w-0">
                            <p className="font-medium truncate">{photo.jobTitle || 'Job'}</p>
                            {photo.caption && <p className="truncate opacity-75">{photo.caption}</p>}
                          </div>
                        </div>
                        {otherJobs.length > 0 && (
                          <div className="absolute top-1.5 right-1.5" style={{ visibility: quickAddPopoverId === photo.id ? 'visible' : undefined }}>
                            <Popover open={quickAddPopoverId === photo.id} onOpenChange={(open) => {
                              if (open) setQuickAddPopoverId(photo.id);
                              else { setQuickAddPopoverId(null); setCopyingToJobId(null); }
                            }}>
                              <PopoverTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="secondary"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                  style={quickAddPopoverId === photo.id ? { opacity: 1 } : undefined}
                                  onClick={(e) => e.stopPropagation()}
                                  title="Add to another job"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-56 p-2" align="end" onClick={(e) => e.stopPropagation()}>
                                <p className="text-xs font-medium text-muted-foreground px-2 py-1">Add to job</p>
                                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                                  {otherJobs.map((job: any) => (
                                    <Button
                                      key={job.id}
                                      variant="ghost"
                                      size="sm"
                                      className="w-full justify-start text-xs"
                                      disabled={copyPhotoToJobMutation.isPending}
                                      onClick={() => {
                                        setCopyingToJobId(job.id);
                                        copyPhotoToJobMutation.mutate({
                                          targetJobId: job.id,
                                          sourceJobId: photo.jobId,
                                          photoId: photo.id
                                        });
                                      }}
                                    >
                                      {copyingToJobId === job.id && copyPhotoToJobMutation.isPending ? (
                                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                      ) : (
                                        <Briefcase className="h-3 w-3 mr-1.5 shrink-0" />
                                      )}
                                      <span className="truncate">{job.title || job.description || 'Untitled Job'}</span>
                                    </Button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assets" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Asset Register
                </CardTitle>
                <Button size="sm" onClick={() => setAssetDialogOpen(true)} data-testid="button-add-asset">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Asset
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {registerLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : assetRegister.length === 0 ? (
                <div className="text-center py-6">
                  <Building2 className="h-9 w-9 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No assets yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Track vessels or equipment owned by this client</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {assetRegister.map((a: any) => (
                    <div key={a.id} className="rounded-md border p-3" data-testid={`asset-row-${a.id}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{a.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[a.manufacturer, a.model, a.serialNumber].filter(Boolean).join(' · ') || a.assetType}
                          </p>
                          {a.location && <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />{a.location}</p>}
                          {a.lastServiceDate && <p className="text-xs text-muted-foreground mt-0.5">Last service: {new Date(a.lastServiceDate).toLocaleDateString()}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="secondary" className="capitalize">{a.assetType}</Badge>
                          <Button size="icon" variant="ghost" onClick={() => { setAttachAssetId(a.id); setAttachJobId(''); }} title="Link a job" data-testid={`button-link-job-${a.id}`}>
                            <Briefcase className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteAssetMutation.mutate(a.id)} title="Remove" data-testid={`button-delete-asset-${a.id}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          {assetsLoading ? (
            <Card>
              <CardContent className="py-8">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              </CardContent>
            </Card>
          ) : !clientAssets || (clientAssets.photos?.length === 0 && clientAssets.signatures?.length === 0 && !savedSignature?.hasSavedSignature) ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <FolderOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No reusable assets yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Photos, signatures, and documents from jobs will appear here for easy reuse
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Saved Signature on Client Profile */}
              {savedSignature?.hasSavedSignature && savedSignature.signatureData && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <PenTool className="h-4 w-4" />
                      Saved Signature
                      <Badge variant="default" className="ml-auto text-xs bg-green-500/15 text-green-600 dark:text-green-400">Primary</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 p-3 rounded-lg border-2 border-green-500/30 bg-green-50/50 dark:bg-green-950/20">
                      <div className="w-24 h-16 rounded border bg-white flex items-center justify-center overflow-hidden">
                        <img 
                          src={savedSignature.signatureData} 
                          alt="Saved Signature" 
                          className="max-w-full max-h-full object-contain"
                          data-testid="img-saved-signature"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{client?.name || 'Client Signature'}</p>
                        {savedSignature.signatureDate && (
                          <p className="text-xs text-muted-foreground">
                            Saved on {formatDate(savedSignature.signatureDate)}
                          </p>
                        )}
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          Auto-fills on new quotes & invoices
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => clearSignatureMutation.mutate()}
                        disabled={clearSignatureMutation.isPending}
                        data-testid="button-clear-saved-signature"
                        className="text-red-500 hover:text-red-600 hover:border-red-500"
                      >
                        Clear
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {clientAssets.latestSignature && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <PenTool className="h-4 w-4" />
                      Latest Signature
                      <Badge variant="secondary" className="ml-auto text-xs">Reusable</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 p-3 rounded-lg border bg-muted/30">
                      <div className="w-24 h-16 rounded border bg-white flex items-center justify-center overflow-hidden">
                        {clientAssets.latestSignature.signatureData ? (
                          <img 
                            src={clientAssets.latestSignature.signatureData} 
                            alt="Signature" 
                            className="max-w-full max-h-full object-contain"
                          />
                        ) : (
                          <PenTool className="h-6 w-6 text-muted-foreground/30" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{clientAssets.latestSignature.signerName || 'Client Signature'}</p>
                        <p className="text-xs text-muted-foreground">
                          Signed on {formatDate(clientAssets.latestSignature.signedAt)}
                        </p>
                        {clientAssets.latestSignature.quoteNumber && (
                          <p className="text-xs text-muted-foreground">
                            From Quote #{clientAssets.latestSignature.quoteNumber}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyAsset(clientAssets.latestSignature, 'signature')}
                        data-testid="button-copy-signature"
                      >
                        {copiedAssetId === clientAssets.latestSignature.id ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-1" />
                            Use
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {clientAssets.photos?.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      Reusable Photos
                      <Badge variant="secondary" className="text-xs">{clientAssets.photos.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {clientAssets.photos.slice(0, 8).map((photo: any) => (
                        <div 
                          key={photo.id}
                          className="relative group aspect-square rounded-lg overflow-hidden border hover-elevate"
                        >
                          {photo.signedUrl ? (
                            <img 
                              src={photo.signedUrl} 
                              alt={photo.caption || 'Photo'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <Camera className="h-6 w-6 text-muted-foreground/30" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleCopyAsset(photo, 'photo')}
                              data-testid={`button-copy-photo-${photo.id}`}
                            >
                              {copiedAssetId === photo.id ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                            <p className="text-white text-[10px] truncate">{photo.jobTitle || 'Job Photo'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {clientAssets.photos.length > 8 && (
                      <p className="text-center text-xs text-muted-foreground mt-3">
                        +{clientAssets.photos.length - 8} more photos available
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {clientAssets.signatures?.length > 1 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <PenTool className="h-4 w-4" />
                      Signature History
                      <Badge variant="secondary" className="text-xs">{clientAssets.signatures.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {clientAssets.signatures.slice(1, 5).map((sig: any) => (
                      <div 
                        key={sig.id}
                        className="flex items-center gap-3 p-2 rounded-lg border hover-elevate"
                      >
                        <div className="w-16 h-10 rounded border bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                          {sig.signatureData ? (
                            <img 
                              src={sig.signatureData} 
                              alt="Signature" 
                              className="max-w-full max-h-full object-contain"
                            />
                          ) : (
                            <PenTool className="h-4 w-4 text-muted-foreground/30" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{sig.signerName || 'Signature'}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(sig.signedAt)} - {sig.quoteNumber ? `Quote #${sig.quoteNumber}` : 'Unknown'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Asset dialog */}
      <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Asset</DialogTitle>
            <DialogDescription>Track a vessel or piece of equipment owned by this client.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="asset-name">Name</Label>
              <Input id="asset-name" value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} placeholder="MV Coral Princess" data-testid="input-asset-name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-type">Type</Label>
              <Select value={assetForm.assetType} onValueChange={(v) => setAssetForm({ ...assetForm, assetType: v })}>
                <SelectTrigger id="asset-type" data-testid="select-asset-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vessel">Vessel</SelectItem>
                  <SelectItem value="hvac">HVAC</SelectItem>
                  <SelectItem value="hot_water">Hot Water</SelectItem>
                  <SelectItem value="electrical">Electrical</SelectItem>
                  <SelectItem value="plumbing">Plumbing</SelectItem>
                  <SelectItem value="solar">Solar</SelectItem>
                  <SelectItem value="appliance">Appliance</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="asset-make">Make</Label>
                <Input id="asset-make" value={assetForm.manufacturer} onChange={(e) => setAssetForm({ ...assetForm, manufacturer: e.target.value })} data-testid="input-asset-make" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="asset-model">Model</Label>
                <Input id="asset-model" value={assetForm.model} onChange={(e) => setAssetForm({ ...assetForm, model: e.target.value })} data-testid="input-asset-model" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-serial">Serial / HIN</Label>
              <Input id="asset-serial" value={assetForm.serialNumber} onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })} data-testid="input-asset-serial" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-location">Location</Label>
              <Input id="asset-location" value={assetForm.location} onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })} placeholder="Marlin Marina, Cairns" data-testid="input-asset-location" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssetDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createAssetMutation.mutate()} disabled={!assetForm.name.trim() || createAssetMutation.isPending} data-testid="button-save-asset">
              {createAssetMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attach job to asset dialog */}
      <Dialog open={!!attachAssetId} onOpenChange={(open) => { if (!open) setAttachAssetId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link a Job</DialogTitle>
            <DialogDescription>Record a job against this asset's service history.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="attach-job">Job</Label>
            <Select value={attachJobId} onValueChange={setAttachJobId}>
              <SelectTrigger id="attach-job" data-testid="select-attach-job"><SelectValue placeholder="Select a job" /></SelectTrigger>
              <SelectContent>
                {(jobs as any[]).map((j: any) => (
                  <SelectItem key={j.id} value={j.id}>{j.title || j.description || 'Untitled Job'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(jobs as any[]).length === 0 && <p className="text-xs text-muted-foreground">This client has no jobs yet.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachAssetId(null)}>Cancel</Button>
            <Button onClick={() => attachJobMutation.mutate()} disabled={!attachJobId || attachJobMutation.isPending} data-testid="button-save-attach-job">
              {attachJobMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Client name"
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@example.com"
                data-testid="input-edit-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="0400 000 000"
                data-testid="input-edit-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                value={editForm.address}
                onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="123 Main St, Sydney NSW 2000"
                data-testid="input-edit-address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-clientType">Client Type</Label>
              <Select
                value={editForm.clientType || "none"}
                onValueChange={(value) => setEditForm(prev => ({ ...prev, clientType: value === "none" ? "" : value }))}
              >
                <SelectTrigger data-testid="select-client-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="strata">Strata</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="government">Government</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-referralSource">Referral Source</Label>
              <Input
                id="edit-referralSource"
                value={editForm.referralSource}
                onChange={(e) => setEditForm(prev => ({ ...prev, referralSource: e.target.value }))}
                placeholder="e.g. Google, Word of Mouth, Facebook"
                data-testid="input-edit-referral"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveClient} 
              disabled={updateClientMutation.isPending}
              data-testid="button-save-client"
            >
              {updateClientMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => {
        setIsDeleteDialogOpen(open);
        if (!open) setDeleteAssociatedData(false);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Client
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{client?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-start space-x-3 p-4 bg-muted rounded-lg">
              <Checkbox
                id="delete-associated"
                checked={deleteAssociatedData}
                onCheckedChange={(checked) => setDeleteAssociatedData(checked as boolean)}
                data-testid="checkbox-delete-associated"
              />
              <div className="space-y-1">
                <Label htmlFor="delete-associated" className="text-sm font-medium cursor-pointer">
                  Also delete all associated data
                </Label>
                <p className="text-xs text-muted-foreground">
                  This will delete all jobs ({jobs.length}), quotes ({quotes.length}), and invoices ({invoices.length}) for this client.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteClient} 
              disabled={deleteClientMutation.isPending}
              data-testid="button-confirm-delete-client"
            >
              {deleteClientMutation.isPending ? "Deleting..." : "Delete Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
