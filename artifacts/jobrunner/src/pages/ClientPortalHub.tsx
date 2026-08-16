import { useState, useEffect, useLayoutEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Phone, 
  FileText, 
  Receipt, 
  Briefcase, 
  ArrowLeft,
  Check,
  X,
  CreditCard,
  Download,
  Clock,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Building2,
  Calendar,
  MapPin,
  Mail,
  Shield,
  Users,
  UserCircle,
  Heart,
  Loader2,
  MessageCircle,
  PlusCircle,
  ClipboardList,
  Send,
  Pencil,
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jobrunnerLogo from "@assets/jobrunner-logo-cropped.png";
import jobrunnerLogoWhite from "@assets/jobrunner-logo-white.png";

interface PortalClient {
  id: string;
  name: string;
  email?: string;
}

interface PortalQuote {
  id: string;
  clientId?: string;
  number: string;
  title: string;
  status: string;
  total: string;
  createdAt: string;
  validUntil?: string;
  acceptanceToken?: string;
  business: {
    businessName?: string;
    email?: string;
    phone?: string;
    logoUrl?: string;
  } | null;
}

interface PortalInvoice {
  id: string;
  clientId?: string;
  number: string;
  title: string;
  status: string;
  total: string;
  createdAt: string;
  dueDate?: string;
  paidAt?: string;
  paymentToken?: string;
  allowOnlinePayment?: boolean;
  stripePaymentLink?: string;
  business: {
    businessName?: string;
    email?: string;
    phone?: string;
    logoUrl?: string;
  } | null;
}

interface PortalReceipt {
  id: string;
  clientId?: string;
  number: string;
  total: string;
  paymentDate: string;
  viewToken?: string;
}

interface PortalJob {
  id: string;
  clientId?: string;
  title: string;
  address?: string;
  status: string;
  scheduledAt?: string;
  completedAt?: string;
  photos?: any[];
  portalToken?: string;
  assignedWorkers?: Array<{ id: string; name: string }>;
  userId?: string;
}

interface PortalVariation {
  id: string;
  jobId: string;
  clientId?: string;
  jobTitle?: string;
  number: string;
  title?: string;
  description?: string;
  reason?: string;
  totalAmount: string;
  status: string;
  sentAt?: string;
  approvedAt?: string;
  approvedByName?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  businessInfo?: {
    businessName?: string;
  } | null;
}

interface PortalData {
  phone: string;
  clients: PortalClient[];
  quotes: PortalQuote[];
  invoices: PortalInvoice[];
  receipts: PortalReceipt[];
  jobs: PortalJob[];
  variations?: PortalVariation[];
}

function getVariationStatusColor(status: string): string {
  switch (status) {
    case 'approved': return 'bg-green-100 text-green-800';
    case 'rejected': return 'bg-red-100 text-red-800';
    case 'sent': return 'bg-amber-100 text-amber-800';
    default: return 'bg-slate-100 text-slate-700';
  }
}

type ViewState = 'phone' | 'code' | 'dashboard' | 'quote-detail' | 'invoice-detail' | 'not-found' | 'select-client';

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(num || 0);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function getQuoteStatusColor(status: string): string {
  switch (status) {
    case 'accepted': return 'bg-green-100 text-green-800';
    case 'declined': return 'bg-red-100 text-red-800';
    case 'sent': return 'bg-blue-100 text-blue-800';
    default: return 'bg-slate-100 text-slate-700';
  }
}

function getInvoiceStatusColor(status: string): string {
  switch (status) {
    case 'paid': return 'bg-green-100 text-green-800';
    case 'overdue': return 'bg-red-100 text-red-800';
    case 'sent': return 'bg-blue-100 text-blue-800';
    default: return 'bg-slate-100 text-slate-700';
  }
}

function getJobStatusColor(status: string): string {
  switch (status) {
    case 'paid': return 'bg-green-100 text-green-800';
    case 'done': case 'completed': return 'bg-green-100 text-green-800';
    case 'invoiced': return 'bg-purple-100 text-purple-800';
    case 'in_progress': return 'bg-orange-100 text-orange-800';
    case 'scheduled': return 'bg-blue-100 text-blue-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    case 'unscheduled': return 'bg-slate-100 text-slate-600';
    default: return 'bg-slate-100 text-slate-700';
  }
}

export default function ClientPortalHub() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [viewState, setViewState] = useState<ViewState>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<PortalQuote | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<PortalInvoice | null>(null);
  const [sourceDocument, setSourceDocument] = useState<{ type: string; token: string } | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [variationApprovalNames, setVariationApprovalNames] = useState<Record<string, string>>({});
  const [variationActionId, setVariationActionId] = useState<string | null>(null);
  const [requestingWorker, setRequestingWorker] = useState<{ workerId: string; workerName: string; jobId: string; jobTitle: string } | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [submittedRequests, setSubmittedRequests] = useState<Set<string>>(new Set());
  const [jobRequests, setJobRequests] = useState<any[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isSubmittingJobRequest, setIsSubmittingJobRequest] = useState(false);
  const [editingRequest, setEditingRequest] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', preferredDate: '', urgency: 'normal', clientNotes: '' });
  const [isUpdatingRequest, setIsUpdatingRequest] = useState(false);
  const [isDeletingRequest, setIsDeletingRequest] = useState<string | null>(null);
  const [jobRequestForm, setJobRequestForm] = useState({
    title: '',
    description: '',
    preferredDate: '',
    urgency: 'normal',
    clientNotes: '',
    preferredWorkerId: '',
    preferredWorkerName: '',
    referenceJobId: '',
    referenceJobTitle: '',
  });
  const [previousJobs, setPreviousJobs] = useState<any[]>([]);
  const [selectedReferenceJob, setSelectedReferenceJob] = useState<any>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.classList.contains('dark') ? 'dark' : 'light';
    root.classList.remove('dark');

    root.style.setProperty('--background', '210 40% 98%');
    root.style.setProperty('--foreground', '222.2 84% 4.9%');
    root.style.setProperty('--card', '0 0% 100%');
    root.style.setProperty('--card-foreground', '222.2 84% 4.9%');
    root.style.setProperty('--popover', '0 0% 100%');
    root.style.setProperty('--popover-foreground', '222.2 84% 4.9%');
    root.style.setProperty('--muted', '210 40% 96.1%');
    root.style.setProperty('--muted-foreground', '215.4 16.3% 46.9%');
    root.style.setProperty('--border', '214.3 31.8% 91.4%');
    root.style.setProperty('--input', '214.3 31.8% 91.4%');
    root.style.setProperty('--ring', '221.2 83.2% 53.3%');
    root.style.setProperty('color-scheme', 'light');

    return () => {
      if (previousTheme === 'dark') {
        root.classList.add('dark');
      }
      root.style.removeProperty('--background');
      root.style.removeProperty('--foreground');
      root.style.removeProperty('--card');
      root.style.removeProperty('--card-foreground');
      root.style.removeProperty('--popover');
      root.style.removeProperty('--popover-foreground');
      root.style.removeProperty('--muted');
      root.style.removeProperty('--muted-foreground');
      root.style.removeProperty('--border');
      root.style.removeProperty('--input');
      root.style.removeProperty('--ring');
      root.style.removeProperty('color-scheme');
    };
  }, []);

  const [isAdminPreview, setIsAdminPreview] = useState(false);
  
  useEffect(() => {
    const initializePortal = async () => {
      const params = new URLSearchParams(window.location.search);
      
      const previewToken = params.get('preview_token');
      if (previewToken) {
        setSessionToken(previewToken);
        setIsAdminPreview(true);
        setViewState('dashboard');
        fetchPortalData(previewToken);
        window.history.replaceState({}, '', '/portal');
        return;
      }
      
      const phoneParam = params.get('phone');
      if (phoneParam) {
        setPhone(phoneParam);
      }

      const docType = params.get('doc');
      const docToken = params.get('token');
      
      if (docType && docToken) {
        setSourceDocument({ type: docType, token: docToken });
        
        const savedToken = localStorage.getItem('portal_session_token');
        if (savedToken) {
          setSessionToken(savedToken);
          setViewState('dashboard');
          fetchPortalData(savedToken);
          return;
        }
        
        try {
          const res = await fetch('/api/portal/auto-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentType: docType, documentToken: docToken })
          });
          
          if (res.ok) {
            const data = await res.json();
            if (data.sessionToken) {
              localStorage.setItem('portal_session_token', data.sessionToken);
              setSessionToken(data.sessionToken);
              setViewState('dashboard');
              fetchPortalData(data.sessionToken);
              return;
            }
          }
        } catch (error) {
          console.error('Auto-auth failed:', error);
        }
      }
      
      const savedToken = localStorage.getItem('portal_session_token');
      if (savedToken) {
        setSessionToken(savedToken);
        setViewState('dashboard');
        fetchPortalData(savedToken);
      }
    };
    
    initializePortal();
  }, []);

  const fetchPortalData = async (token: string) => {
    setIsLoadingData(true);
    setLoadError(false);
    try {
      const res = await fetch('/api/portal/data', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('portal_session_token');
          setSessionToken(null);
          setViewState('phone');
          return;
        }
        throw new Error('Failed to fetch data');
      }
      
      const data = await res.json();
      setPortalData(data);
      fetchJobRequests(token);
      fetchJobHistory(token);
      if (data.clients.length === 0) {
        setViewState('not-found');
      } else if (data.clients.length === 1) {
        setSelectedClientId(data.clients[0].id);
        setViewState('dashboard');
      } else {
        setViewState('select-client');
      }
    } catch (error) {
      console.error('Error fetching portal data:', error);
      setLoadError(true);
      toast({
        title: "Couldn't Load Data",
        description: "Something went wrong loading your documents. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleRequestCode = async () => {
    if (!phone.trim()) {
      toast({
        title: "Phone Required",
        description: "Please enter your mobile number",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/portal/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast({
          title: "Code Sent",
          description: "Check your phone for a verification code"
        });
        setViewState('code');
      } else {
        throw new Error(data.error || 'Failed to send code');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send verification code",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code.trim() || code.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter the 6-digit code from your SMS",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/portal/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), code: code.trim() })
      });
      
      const data = await res.json();
      
      if (res.ok && data.sessionToken) {
        localStorage.setItem('portal_session_token', data.sessionToken);
        setSessionToken(data.sessionToken);
        setViewState('dashboard');
        fetchPortalData(data.sessionToken);
        toast({
          title: "Welcome!",
          description: "You're now logged in to your portal"
        });
      } else {
        throw new Error(data.error || 'Invalid verification code');
      }
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid or expired code. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (sessionToken) {
        await fetch('/api/portal/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('portal_session_token');
      setSessionToken(null);
      setPortalData(null);
      setPhone('');
      setCode('');
      setViewState('phone');
    }
  };

  const handlePayInvoice = (invoice: PortalInvoice) => {
    if (invoice.stripePaymentLink) {
      window.location.href = invoice.stripePaymentLink;
    } else if (invoice.paymentToken) {
      window.location.href = `/portal/invoice/${invoice.paymentToken}`;
    }
  };

  const handleViewQuote = (quote: PortalQuote) => {
    if (quote.acceptanceToken) {
      window.location.href = `/portal/quote/${quote.acceptanceToken}`;
    }
  };

  const handleViewInvoice = (invoice: PortalInvoice) => {
    if (invoice.paymentToken) {
      window.location.href = `/portal/invoice/${invoice.paymentToken}`;
    } else {
      toast({ title: "Invoice Preview", description: `Invoice #${invoice.number} — ${formatCurrency(invoice.total)}`, variant: "default" });
    }
  };

  const handleViewReceipt = (receipt: PortalReceipt) => {
    if (receipt.viewToken) {
      window.location.href = `/portal/receipt/${receipt.viewToken}`;
    } else {
      toast({ title: "Receipt", description: `Receipt #${receipt.number} — ${formatCurrency(receipt.total)}`, variant: "default" });
    }
  };

  const handleApproveVariation = async (variation: PortalVariation) => {
    const name = (variationApprovalNames[variation.id] || '').trim();
    if (!name) {
      toast({
        title: "Name Required",
        description: "Please enter your name to approve this variation",
        variant: "destructive"
      });
      return;
    }
    setVariationActionId(variation.id);
    try {
      const res = await fetch(`/api/portal/variations/${variation.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ approvedByName: name })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to approve variation');
      }
      toast({
        title: "Variation Approved",
        description: "Thank you! The business has been notified.",
      });
      if (sessionToken) await fetchPortalData(sessionToken);
    } catch (err: any) {
      toast({
        title: "Couldn't Approve Variation",
        description: err?.message || 'Something went wrong. Please try again.',
        variant: "destructive"
      });
    } finally {
      setVariationActionId(null);
    }
  };

  const handleRejectVariation = async (variation: PortalVariation) => {
    if (!window.confirm('Are you sure you want to reject this variation? The business will be notified.')) {
      return;
    }
    const reason = window.prompt('Optional: let them know why you are rejecting this variation') || '';
    setVariationActionId(variation.id);
    try {
      const res = await fetch(`/api/portal/variations/${variation.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ rejectionReason: reason.trim() || undefined })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to reject variation');
      }
      toast({
        title: "Variation Rejected",
        description: "The business has been notified of your decision.",
      });
      if (sessionToken) await fetchPortalData(sessionToken);
    } catch (err: any) {
      toast({
        title: "Couldn't Reject Variation",
        description: err?.message || 'Something went wrong. Please try again.',
        variant: "destructive"
      });
    } finally {
      setVariationActionId(null);
    }
  };

  const handleRequestWorker = async (workerId: string, workerName: string, jobId: string, jobTitle: string, clientId?: string) => {
    setIsSubmittingRequest(true);
    try {
      const res = await fetch('/api/portal/request-worker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          workerId,
          workerName,
          jobId,
          jobTitle,
          clientId,
          message: requestMessage || undefined,
        })
      });
      
      if (res.ok) {
        toast({
          title: "Request Sent!",
          description: `Your request for ${workerName} has been sent to the business`,
        });
        setSubmittedRequests(prev => new Set([...Array.from(prev), `${workerId}-${jobId}`]));
        setRequestingWorker(null);
        setRequestMessage('');
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send request');
      }
    } catch (error: any) {
      toast({
        title: "Request Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const fetchJobRequests = async (token: string) => {
    setIsLoadingRequests(true);
    try {
      const res = await fetch('/api/portal/job-requests', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setJobRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching job requests:', error);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const fetchJobHistory = async (token: string) => {
    try {
      const res = await fetch('/api/portal/job-history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPreviousJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Error fetching job history:', error);
    }
  };

  const uniqueWorkers = useMemo(() => {
    const workerMap = new Map<string, { id: string; name: string; jobCount: number }>();
    previousJobs.forEach((job: any) => {
      if (job.assignedTo && job.workerName) {
        const existing = workerMap.get(job.assignedTo);
        if (existing) {
          existing.jobCount++;
        } else {
          workerMap.set(job.assignedTo, { id: job.assignedTo, name: job.workerName, jobCount: 1 });
        }
      }
    });
    return Array.from(workerMap.values());
  }, [previousJobs]);

  const handleSubmitJobRequest = async () => {
    if (!jobRequestForm.title.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a title for your job request",
        variant: "destructive"
      });
      return;
    }

    setIsSubmittingJobRequest(true);
    try {
      const res = await fetch('/api/portal/job-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          ...jobRequestForm,
          referenceJobId: jobRequestForm.referenceJobId === 'none' ? '' : jobRequestForm.referenceJobId,
          preferredWorkerId: jobRequestForm.preferredWorkerId === 'none' ? '' : jobRequestForm.preferredWorkerId,
          clientId: selectedClientId || undefined,
        })
      });

      if (res.ok) {
        toast({
          title: "Request Submitted",
          description: "Your job request has been sent to the business"
        });
        setJobRequestForm({
          title: '',
          description: '',
          preferredDate: '',
          urgency: 'normal',
          clientNotes: '',
          preferredWorkerId: '',
          preferredWorkerName: '',
          referenceJobId: '',
          referenceJobTitle: '',
        });
        setSelectedReferenceJob(null);
        if (sessionToken) {
          fetchJobRequests(sessionToken);
        }
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit request');
      }
    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmittingJobRequest(false);
    }
  };

  const getRequestStatusColor = (status: string): string => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'declined': return 'bg-red-100 text-red-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getUrgencyColor = (urgency: string): string => {
    switch (urgency) {
      case 'emergency': return 'bg-red-100 text-red-700';
      case 'urgent': return 'bg-orange-100 text-orange-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const startEditingRequest = (request: any) => {
    setEditingRequest(request);
    setEditForm({
      title: request.title || '',
      description: request.description || '',
      preferredDate: request.preferredDate ? new Date(request.preferredDate).toISOString().split('T')[0] : '',
      urgency: request.urgency || 'normal',
      clientNotes: request.clientNotes || '',
    });
  };

  const handleUpdateRequest = async () => {
    if (!editingRequest || !editForm.title.trim()) return;
    setIsUpdatingRequest(true);
    try {
      const res = await fetch(`/api/portal/job-requests/${editingRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        toast({ title: "Request Updated", description: "Your job request has been updated" });
        setEditingRequest(null);
        if (sessionToken) fetchJobRequests(sessionToken);
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update');
      }
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUpdatingRequest(false);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    setIsDeletingRequest(requestId);
    try {
      const res = await fetch(`/api/portal/job-requests/${requestId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });
      if (res.ok) {
        toast({ title: "Request Deleted", description: "Your job request has been removed" });
        if (sessionToken) fetchJobRequests(sessionToken);
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
    } catch (error: any) {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsDeletingRequest(null);
    }
  };

  if (viewState === 'phone') {
    return (
      <div className="min-h-screen flex flex-col relative bg-white">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top, rgba(37,99,235,0.03), transparent, transparent)' }} />
        <div className="py-10 px-4 relative">
          <div className="max-w-md mx-auto text-center">
            <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 mx-auto mb-3 object-contain" />
            <h1 className="text-2xl font-bold text-slate-900">Client Portal</h1>
            <p className="text-sm text-slate-500 mt-1">Access your quotes, invoices, and job history</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-start px-4 relative">
          <Card className="w-full max-w-md rounded-md shadow-lg bg-white">
            <CardHeader className="text-center pb-2">
              <div className="w-14 h-14 rounded-full bg-brand/10 ring-1 ring-brand/20 flex items-center justify-center mx-auto mb-3">
                <Phone className="w-6 h-6 text-brand" />
              </div>
              <CardTitle className="text-lg text-slate-900">Verify Your Identity</CardTitle>
              <CardDescription className="text-slate-500">
                Enter the mobile number associated with your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Input
                  type="tel"
                  placeholder="0400 000 000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="text-center text-lg bg-white text-slate-900"
                />
              </div>
              <Button 
                onClick={handleRequestCode}
                disabled={isLoading || !phone.trim()}
                className="w-full bg-brand"
                size="lg"
              >
                {isLoading ? 'Sending...' : 'Send Verification Code'}
              </Button>
              <p className="text-xs text-center text-slate-500 flex items-center justify-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                We'll send a 6-digit code to verify your identity
              </p>
            </CardContent>
          </Card>

          <div className="mt-4 text-center">
            <a href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to JobRunner
            </a>
          </div>
        </div>

        <div className="text-center py-8 flex items-center justify-center gap-2">
          <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 object-contain" />
          <span className="text-sm text-slate-500">Powered by <span className="font-semibold text-slate-500">JobRunner</span></span>
        </div>
      </div>
    );
  }

  if (viewState === 'code') {
    return (
      <div className="min-h-screen flex flex-col relative bg-white">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top, rgba(37,99,235,0.03), transparent, transparent)' }} />
        <div className="py-10 px-4 relative">
          <div className="max-w-md mx-auto text-center">
            <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 mx-auto mb-3 object-contain" />
            <h1 className="text-2xl font-bold text-slate-900">Client Portal</h1>
            <p className="text-sm text-slate-500 mt-1">Secure verification</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-start px-4 relative">
          <Card className="w-full max-w-md rounded-md shadow-lg bg-white">
            <CardHeader className="text-center pb-2">
              <div className="w-14 h-14 rounded-full bg-brand/10 ring-1 ring-brand/20 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-brand" />
              </div>
              <CardTitle className="text-lg text-slate-900">Enter Verification Code</CardTitle>
              <CardDescription className="text-slate-500">
                We sent a 6-digit code to {phone}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Input
                  type="text"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center text-2xl tracking-widest font-mono bg-white text-slate-900"
                  maxLength={6}
                />
              </div>
              <Button 
                onClick={handleVerifyCode}
                disabled={isLoading || code.length !== 6}
                className="w-full bg-brand"
                size="lg"
              >
                {isLoading ? 'Verifying...' : 'Verify & Continue'}
              </Button>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  onClick={() => setViewState('phone')}
                  className="flex-1"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={handleRequestCode}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Resend Code
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center py-8 flex items-center justify-center gap-2">
          <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 object-contain" />
          <span className="text-sm text-slate-500">Powered by <span className="font-semibold text-slate-500">JobRunner</span></span>
        </div>
      </div>
    );
  }

  if (viewState === 'not-found') {
    return (
      <div className="min-h-screen flex flex-col relative bg-white">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top, rgba(37,99,235,0.03), transparent, transparent)' }} />
        <div className="py-10 px-4 relative">
          <div className="max-w-md mx-auto text-center">
            <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 mx-auto mb-3 object-contain" />
            <h1 className="text-2xl font-bold text-slate-900">Client Portal</h1>
            <p className="text-sm text-slate-500 mt-1">Account lookup</p>
          </div>
        </div>

        <div className="flex-1 flex items-start justify-center px-4 relative">
          <div className="w-full max-w-md text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-slate-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900">
                We couldn't find an active client profile for that contact.
              </h2>
              <p className="text-sm text-slate-500">
                If you think this is a mistake, contact your service provider.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button
                className="w-full bg-brand"
                size="lg"
                onClick={() => window.location.href = 'mailto:admin@avwebinnovation.com?subject=Quote%20Request'}
              >
                <Mail className="w-4 h-4 mr-2" />
                Request a Quote
              </Button>
              <Button
                variant="outline"
                className="w-full"
                size="lg"
                onClick={() => window.location.href = 'tel:1300000000'}
              >
                <Phone className="w-4 h-4 mr-2" />
                Call Dispatch
              </Button>
            </div>
            <Button
              variant="ghost"
              className="text-slate-500"
              onClick={handleLogout}
            >
              Try a different number
            </Button>
          </div>
        </div>

        <div className="text-center py-8 flex items-center justify-center gap-2">
          <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 object-contain" />
          <span className="text-sm text-slate-500">Powered by <span className="font-semibold text-slate-500">JobRunner</span></span>
        </div>
      </div>
    );
  }

  if (viewState === 'select-client') {
    return (
      <div className="min-h-screen flex flex-col relative bg-white">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top, rgba(37,99,235,0.03), transparent, transparent)' }} />
        <div className="py-10 px-4 relative">
          <div className="max-w-md mx-auto text-center">
            <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 mx-auto mb-3 object-contain" />
            <h1 className="text-2xl font-bold text-slate-900">Client Portal</h1>
            <p className="text-sm text-slate-500 mt-1">Select your account</p>
          </div>
        </div>

        <div className="flex-1 flex items-start justify-center px-4 relative">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-brand/10 ring-1 ring-brand/20 flex items-center justify-center mx-auto">
                <Users className="w-6 h-6 text-brand" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Which account are you checking?</h2>
              <p className="text-sm text-slate-500">Multiple profiles are linked to this number</p>
            </div>
            <div className="space-y-3">
              {portalData?.clients.map((client) => (
                <div
                  key={client.id}
                  className="bg-white rounded-md shadow-lg p-4 cursor-pointer hover-elevate"
                  onClick={() => {
                    setSelectedClientId(client.id);
                    setViewState('dashboard');
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-brand" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">{client.name}</h3>
                      {client.email && (
                        <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {client.email}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center py-8 flex items-center justify-center gap-2">
          <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 object-contain" />
          <span className="text-sm text-slate-500">Powered by <span className="font-semibold text-slate-500">JobRunner</span></span>
        </div>
      </div>
    );
  }

  if (viewState === 'dashboard') {
    const filteredQuotes = selectedClientId ? portalData?.quotes.filter(q => q.clientId === selectedClientId) : portalData?.quotes;
    const filteredInvoices = selectedClientId ? portalData?.invoices.filter(i => i.clientId === selectedClientId) : portalData?.invoices;
    const filteredReceipts = selectedClientId ? portalData?.receipts.filter(r => r.clientId === selectedClientId) : portalData?.receipts;
    const filteredJobs = selectedClientId ? portalData?.jobs.filter(j => j.clientId === selectedClientId) : portalData?.jobs;
    const filteredVariations = selectedClientId ? portalData?.variations?.filter(v => v.clientId === selectedClientId) : portalData?.variations;
    const pendingVariationCount = filteredVariations?.filter(v => v.status === 'sent').length || 0;
    const business = filteredQuotes?.[0]?.business || filteredInvoices?.[0]?.business || null;
    const selectedClient = portalData?.clients.find(c => c.id === selectedClientId);
    const clientName = selectedClient?.name || portalData?.clients[0]?.name;

    return (
      <div className="min-h-screen flex flex-col bg-white">
        {isAdminPreview && (
          <div className="bg-amber-500 text-white text-center text-xs py-1.5 font-medium sticky top-0 z-30">
            Admin Preview — This is how your client sees their portal (30 min session)
          </div>
        )}
        <header className={`bg-brand sticky ${isAdminPreview ? 'top-7' : 'top-0'} z-20`}>
          <div className="px-4 py-4">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {business?.logoUrl ? (
                  <img
                    src={business.logoUrl}
                    alt={business.businessName || 'Business'}
                    className="w-8 h-8 object-contain rounded-md bg-white/10 p-1"
                  />
                ) : (
                  <img src={jobrunnerLogo} alt="JobRunner" className="w-9 h-9 object-contain brightness-0 invert" />
                )}
                <div className="min-w-0">
                  <h1 className="font-bold text-base text-white truncate">
                    {business?.businessName || 'Client Portal'}
                  </h1>
                  <div className="flex gap-3 text-xs text-white/70 flex-wrap">
                    {business?.phone && (
                      <a href={`tel:${business.phone}`} className="hover:text-white flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {business.phone}
                      </a>
                    )}
                    {business?.email && (
                      <a href={`mailto:${business.email}`} className="hover:text-white flex items-center gap-1 hidden sm:flex">
                        <Mail className="w-3 h-3" /> {business.email}
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {portalData && portalData.clients.length > 1 && (
                  <Button variant="outline" size="sm" onClick={() => setViewState('select-client')} className="text-white border-white/30">
                    <Users className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Switch</span>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleLogout} className="text-white border-white/30">
                  <LogOut className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="border-b border-slate-200 px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {clientName ? `Welcome back, ${clientName}` : 'Your Documents'}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {portalData?.phone ? `Logged in as ${portalData.phone}` : 'View your quotes, invoices, and jobs'}
                </p>
              </div>
              {sourceDocument && (
                <Button variant="outline" size="sm" className="border border-slate-200"
                  onClick={() => setLocation(`/portal/${sourceDocument.type}/${sourceDocument.token}`)}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">
                    Back to {sourceDocument.type === 'quote' ? 'Quote' : sourceDocument.type === 'invoice' ? 'Invoice' : 'Receipt'}
                  </span>
                  <span className="sm:hidden">Back</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        <main className="flex-1 px-4 py-6">
          <div className="max-w-4xl mx-auto">
            {isLoadingData ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : loadError ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 mx-auto text-slate-500/40 mb-4" />
                <h2 className="text-lg font-semibold mb-2 text-slate-900">Couldn't load your documents</h2>
                <p className="text-sm text-slate-500 mb-4">Something went wrong. Please check your connection and try again.</p>
                <Button variant="outline" size="sm" onClick={() => sessionToken && fetchPortalData(sessionToken)}>
                  Try again
                </Button>
              </div>
            ) : (
              <Tabs defaultValue="quotes" className="w-full">
                <TabsList className="grid w-full grid-cols-6 mb-6 bg-slate-100">
                  <TabsTrigger value="quotes" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span className="hidden sm:inline">Quotes</span>
                    {filteredQuotes?.length ? (
                      <Badge variant="secondary" className="ml-1">{filteredQuotes.length}</Badge>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="invoices" className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    <span className="hidden sm:inline">Invoices</span>
                    {filteredInvoices?.length ? (
                      <Badge variant="secondary" className="ml-1">{filteredInvoices.length}</Badge>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="receipts" className="flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    <span className="hidden sm:inline">Receipts</span>
                    {filteredReceipts?.length ? (
                      <Badge variant="secondary" className="ml-1">{filteredReceipts.length}</Badge>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="variations" className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4" />
                    <span className="hidden sm:inline">Variations</span>
                    {pendingVariationCount ? (
                      <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-800">{pendingVariationCount}</Badge>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="jobs" className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    <span className="hidden sm:inline">Jobs</span>
                    {filteredJobs?.length ? (
                      <Badge variant="secondary" className="ml-1">{filteredJobs.length}</Badge>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="requests" className="flex items-center gap-2" onClick={() => { if (sessionToken) fetchJobRequests(sessionToken); }}>
                    <ClipboardList className="w-4 h-4" />
                    <span className="hidden sm:inline">Requests</span>
                    {jobRequests.length ? (
                      <Badge variant="secondary" className="ml-1">{jobRequests.length}</Badge>
                    ) : null}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="quotes" className="space-y-4">
                  {filteredQuotes?.length === 0 ? (
                    <div className="bg-white rounded-md shadow-lg p-10 text-center">
                      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-slate-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">No Quotes Yet</h3>
                      <p className="text-sm text-slate-500">Your quotes will appear here once they're sent</p>
                    </div>
                  ) : (
                    filteredQuotes?.map((quote) => (
                      <div
                        key={quote.id}
                        className={`bg-white rounded-md shadow-lg overflow-hidden hover-elevate cursor-pointer ${
                          quote.status === 'sent'
                            ? 'border border-brand/20'
                            : ''
                        }`}
                        onClick={() => handleViewQuote(quote)}
                      >
                        <div className="p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5 text-brand" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-slate-900 truncate">Quote #{quote.number}</h3>
                                <Badge className={getQuoteStatusColor(quote.status)}>
                                  {quote.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="ml-13 space-y-1">
                            <p className="text-sm text-slate-500 truncate">{quote.title}</p>
                            {quote.business?.businessName && (
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {quote.business.businessName}
                              </p>
                            )}
                            <p className="text-xs text-slate-500">
                              {formatDate(quote.createdAt)}
                              {quote.validUntil && ` · Valid until ${formatDate(quote.validUntil)}`}
                            </p>
                          </div>
                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Amount</p>
                                <p className="text-xl font-bold text-slate-900">{formatCurrency(quote.total)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        {quote.status === 'sent' && (
                          <div className="px-5 pb-5">
                            <Button className="w-full" size="lg">
                              <Check className="w-4 h-4 mr-2" />
                              View & Accept Quote
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="invoices" className="space-y-4">
                  {filteredInvoices?.length === 0 ? (
                    <div className="bg-white rounded-md shadow-lg p-10 text-center">
                      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                        <CreditCard className="w-8 h-8 text-slate-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">No Invoices Yet</h3>
                      <p className="text-sm text-slate-500">Your invoices will appear here once they're created</p>
                    </div>
                  ) : (
                    filteredInvoices?.map((invoice) => {
                      const isPayable = invoice.status !== 'paid' && invoice.allowOnlinePayment;
                      const isPaid = invoice.status === 'paid';
                      const isOverdue = invoice.status === 'overdue';

                      return (
                        <div
                          key={invoice.id}
                          className={`rounded-md overflow-hidden hover-elevate cursor-pointer ${
                            isPayable
                              ? 'bg-brand/5 shadow-xl border-2 border-brand/20'
                              : isPaid
                              ? 'bg-white shadow-lg border border-green-200'
                              : isOverdue
                              ? 'bg-white shadow-lg border border-red-200'
                              : 'bg-white shadow-lg'
                          }`}
                          onClick={() => handleViewInvoice(invoice)}
                        >
                          <div className="p-5">
                            <div className="flex items-center gap-3 mb-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                isPaid
                                  ? 'bg-green-100'
                                  : isOverdue
                                  ? 'bg-red-100'
                                  : 'bg-brand/10'
                              }`}>
                                {isPaid ? (
                                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                                ) : isOverdue ? (
                                  <AlertCircle className="w-5 h-5 text-red-500" />
                                ) : (
                                  <CreditCard className="w-5 h-5 text-brand" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-slate-900 truncate">Invoice #{invoice.number}</h3>
                                  <Badge className={getInvoiceStatusColor(invoice.status)}>
                                    {invoice.status}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="ml-13 space-y-1">
                              <p className="text-sm text-slate-500 truncate">{invoice.title}</p>
                              {invoice.business?.businessName && (
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {invoice.business.businessName}
                                </p>
                              )}
                              <p className="text-xs text-slate-500">
                                {formatDate(invoice.createdAt)}
                                {invoice.dueDate && invoice.status !== 'paid' && ` · Due ${formatDate(invoice.dueDate)}`}
                                {invoice.paidAt && ` · Paid ${formatDate(invoice.paidAt)}`}
                              </p>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-200">
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                                    {isPaid ? 'Amount Paid' : isOverdue ? 'Amount Overdue' : 'Amount Due'}
                                  </p>
                                  <p className={`text-xl font-bold ${
                                    isPaid ? 'text-green-700' : isOverdue ? 'text-red-600' : 'text-slate-900'
                                  }`}>{formatCurrency(invoice.total)}</p>
                                </div>
                                {isPaid && (
                                  <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                                    <CheckCircle2 className="w-5 h-5" />
                                    Paid
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          {isPayable && (
                            <div className="px-5 pb-5">
                              <Button className="w-full" size="lg" onClick={(e) => { e.stopPropagation(); handlePayInvoice(invoice); }}>
                                <CreditCard className="w-4 h-4 mr-2" />
                                Pay Now
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </TabsContent>

                <TabsContent value="receipts" className="space-y-4">
                  {filteredReceipts?.length === 0 ? (
                    <div className="bg-white rounded-md shadow-lg p-10 text-center">
                      <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                        <Receipt className="w-8 h-8 text-green-300" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">No Receipts Yet</h3>
                      <p className="text-sm text-slate-500">Payment receipts will appear here after completed payments</p>
                    </div>
                  ) : (
                    filteredReceipts?.map((receipt) => (
                      <div
                        key={receipt.id}
                        className="bg-white rounded-md shadow-lg border border-green-200 overflow-hidden hover-elevate cursor-pointer"
                        onClick={() => handleViewReceipt(receipt)}
                      >
                        <div className="p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-slate-900 truncate">Receipt #{receipt.number}</h3>
                              <p className="text-xs text-slate-500">
                                Paid {formatDate(receipt.paymentDate)}
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-green-100">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Amount Paid</p>
                                <p className="text-xl font-bold text-green-700">{formatCurrency(receipt.total)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="px-5 pb-5">
                          <Button variant="outline" className="w-full">
                            <Download className="w-4 h-4 mr-2" />
                            View Receipt
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="variations" className="space-y-4">
                  {!filteredVariations || filteredVariations.length === 0 ? (
                    <div className="bg-white rounded-md shadow-lg p-10 text-center">
                      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                        <ClipboardList className="w-8 h-8 text-slate-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">No Variations</h3>
                      <p className="text-sm text-slate-500">Any scope changes needing your approval will appear here</p>
                    </div>
                  ) : (
                    filteredVariations.map((variation) => (
                      <div
                        key={variation.id}
                        className={`bg-white rounded-md shadow-lg overflow-hidden ${
                          variation.status === 'sent' ? 'border border-amber-300' : ''
                        }`}
                      >
                        <div className="p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                              <ClipboardList className="w-5 h-5 text-amber-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-slate-900 truncate">Variation {variation.number}</h3>
                                <Badge className={getVariationStatusColor(variation.status)}>
                                  {variation.status === 'sent' ? 'Awaiting Your Approval' : variation.status.charAt(0).toUpperCase() + variation.status.slice(1)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1">
                            {variation.title && (
                              <p className="text-sm font-medium text-slate-900">{variation.title}</p>
                            )}
                            {variation.description && (
                              <p className="text-sm text-slate-600">{variation.description}</p>
                            )}
                            {variation.reason && (
                              <p className="text-xs text-slate-500"><span className="font-semibold uppercase tracking-wider">Reason:</span> {variation.reason}</p>
                            )}
                            {variation.jobTitle && (
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                <Briefcase className="w-3 h-3" /> {variation.jobTitle}
                              </p>
                            )}
                            {variation.businessInfo?.businessName && (
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                <Building2 className="w-3 h-3" /> {variation.businessInfo.businessName}
                              </p>
                            )}
                          </div>
                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Amount (incl. GST)</p>
                                <p className="text-xl font-bold text-slate-900">{formatCurrency(variation.totalAmount)}</p>
                              </div>
                              {variation.status === 'approved' && (
                                <div className="text-right">
                                  <p className="text-xs text-green-700 flex items-center gap-1 justify-end">
                                    <CheckCircle2 className="w-3 h-3" /> Approved{variation.approvedByName ? ` by ${variation.approvedByName}` : ''}
                                  </p>
                                  {variation.approvedAt && (
                                    <p className="text-xs text-slate-500">{formatDate(variation.approvedAt)}</p>
                                  )}
                                </div>
                              )}
                              {variation.status === 'rejected' && (
                                <div className="text-right">
                                  <p className="text-xs text-red-700 flex items-center gap-1 justify-end">
                                    <X className="w-3 h-3" /> Rejected
                                  </p>
                                  {variation.rejectedAt && (
                                    <p className="text-xs text-slate-500">{formatDate(variation.rejectedAt)}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {variation.status === 'sent' && (
                          <div className="px-5 pb-5 space-y-3">
                            <Input
                              placeholder="Your full name (required to approve)"
                              value={variationApprovalNames[variation.id] || ''}
                              onChange={(e) => setVariationApprovalNames(prev => ({ ...prev, [variation.id]: e.target.value }))}
                              disabled={variationActionId === variation.id}
                            />
                            <div className="flex gap-3">
                              <Button
                                className="flex-1"
                                size="lg"
                                onClick={() => handleApproveVariation(variation)}
                                disabled={variationActionId === variation.id}
                              >
                                {variationActionId === variation.id ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Check className="w-4 h-4 mr-2" />
                                )}
                                Approve Variation
                              </Button>
                              <Button
                                variant="outline"
                                size="lg"
                                className="text-red-600 border-red-200"
                                onClick={() => handleRejectVariation(variation)}
                                disabled={variationActionId === variation.id}
                              >
                                <X className="w-4 h-4 mr-2" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="jobs" className="space-y-4">
                  {filteredJobs?.length === 0 ? (
                    <div className="bg-white rounded-md shadow-lg p-10 text-center">
                      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                        <Briefcase className="w-8 h-8 text-slate-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">No Jobs Yet</h3>
                      <p className="text-sm text-slate-500">Your job history will appear here</p>
                    </div>
                  ) : (
                    filteredJobs?.map((job) => {
                      const isDone = job.status === 'done' || job.status === 'completed';
                      const isInvoiced = job.status === 'invoiced';
                      const isInProgress = job.status === 'in_progress';
                      const isScheduled = job.status === 'scheduled';

                      return (
                        <div
                          key={job.id}
                          className={`bg-white rounded-md shadow-lg overflow-hidden ${
                            isDone
                              ? 'border border-green-200'
                              : isInvoiced
                              ? 'border border-purple-200'
                              : isInProgress
                              ? 'border border-orange-200'
                              : isScheduled
                              ? 'border border-blue-200'
                              : ''
                          }`}
                        >
                          <div 
                            className="p-5 cursor-pointer hover-elevate"
                            onClick={() => {
                              if (job.portalToken) {
                                window.location.href = `/p/${job.portalToken}`;
                              }
                            }}
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                isDone
                                  ? 'bg-green-100'
                                  : isInvoiced
                                  ? 'bg-purple-100'
                                  : isInProgress
                                  ? 'bg-orange-100'
                                  : isScheduled
                                  ? 'bg-blue-100'
                                  : 'bg-slate-100'
                              }`}>
                                <Briefcase className={`w-5 h-5 ${
                                  isDone
                                    ? 'text-green-600'
                                    : isInvoiced
                                    ? 'text-purple-600'
                                    : isInProgress
                                    ? 'text-orange-600'
                                    : isScheduled
                                    ? 'text-blue-600'
                                    : 'text-slate-500'
                                }`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-slate-900 truncate">{job.title}</h3>
                                  <Badge className={getJobStatusColor(job.status)}>
                                    {job.status === 'done' ? 'Completed' : job.status === 'in_progress' ? 'In Progress' : job.status === 'invoiced' ? 'Invoiced' : job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                                  </Badge>
                                </div>
                              </div>
                              {job.photos && job.photos.length > 0 && (
                                <Badge variant="secondary">
                                  {job.photos.length} photo{job.photos.length !== 1 ? 's' : ''}
                                </Badge>
                              )}
                            </div>
                            <div className="ml-13 space-y-1">
                              {job.address && (
                                <p className="text-sm text-slate-500 flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {job.address}
                                </p>
                              )}
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {job.scheduledAt ? `Scheduled: ${formatDate(job.scheduledAt)}` : 'Not scheduled'}
                                {job.completedAt && ` · Completed: ${formatDate(job.completedAt)}`}
                              </p>
                            </div>
                          </div>
                          
                          {job.assignedWorkers && job.assignedWorkers.length > 0 && (
                            <div className="px-5 pb-4 border-t border-slate-200">
                              <div className="pt-3">
                                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Assigned Team</p>
                                <div className="space-y-2">
                                  {job.assignedWorkers.map((worker) => {
                                    const requestKey = `${worker.id}-${job.id}`;
                                    const alreadyRequested = submittedRequests.has(requestKey);
                                    const isExpanded = requestingWorker?.workerId === worker.id && requestingWorker?.jobId === job.id;
                                    
                                    return (
                                      <div key={worker.id} className="space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                                              <UserCircle className="w-4 h-4 text-brand" />
                                            </div>
                                            <span className="text-sm font-medium text-slate-900 truncate">{worker.name}</span>
                                          </div>
                                          {alreadyRequested ? (
                                            <Badge variant="secondary" className="flex-shrink-0">
                                              <Check className="w-3 h-3 mr-1" />
                                              Requested
                                            </Badge>
                                          ) : isDone ? (
                                            <Button 
                                              variant="outline" 
                                              size="sm"
                                              className="flex-shrink-0"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (isExpanded) {
                                                  setRequestingWorker(null);
                                                  setRequestMessage('');
                                                } else {
                                                  setRequestingWorker({ workerId: worker.id, workerName: worker.name, jobId: job.id, jobTitle: job.title });
                                                }
                                              }}
                                            >
                                              <Heart className="w-3.5 h-3.5 mr-1" />
                                              Request Again
                                            </Button>
                                          ) : null}
                                        </div>
                                        
                                        {isExpanded && (
                                          <div className="ml-9 p-3 bg-slate-50 rounded-md space-y-2">
                                            <p className="text-xs text-slate-500">Add a note for the business (optional):</p>
                                            <textarea
                                              className="w-full text-sm border border-slate-200 rounded-md p-2 bg-white text-slate-900 resize-none"
                                              rows={2}
                                              placeholder="e.g. Great work last time, would love the same person..."
                                              value={requestMessage}
                                              onChange={(e) => setRequestMessage(e.target.value)}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                            <div className="flex gap-2">
                                              <Button 
                                                size="sm" 
                                                className="flex-1"
                                                disabled={isSubmittingRequest}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleRequestWorker(worker.id, worker.name, job.id, job.title, selectedClientId || undefined);
                                                }}
                                              >
                                                {isSubmittingRequest ? (
                                                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                                ) : (
                                                  <MessageCircle className="w-3.5 h-3.5 mr-1" />
                                                )}
                                                Send Request
                                              </Button>
                                              <Button 
                                                variant="ghost" 
                                                size="sm"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setRequestingWorker(null);
                                                  setRequestMessage('');
                                                }}
                                              >
                                                Cancel
                                              </Button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}

                          {job.portalToken && (isInProgress || isScheduled) && (
                            <div className="px-5 pb-4">
                              <Button 
                                variant="outline" 
                                className="w-full"
                                onClick={() => window.location.href = `/p/${job.portalToken}`}
                              >
                                <MapPin className="w-4 h-4 mr-2" />
                                Track Live Progress
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </TabsContent>

                <TabsContent value="requests" className="space-y-6">
                  <Card className="bg-white rounded-md shadow-lg">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-brand/10 rounded-full flex items-center justify-center">
                          <PlusCircle className="w-4 h-4 text-brand" />
                        </div>
                        <CardTitle className="text-base text-slate-900">Request a Job</CardTitle>
                      </div>
                      <CardDescription className="text-slate-500">
                        Submit a request and the business will get back to you
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-900 mb-1">Title <span className="text-red-500">*</span></label>
                        <Input
                          type="text"
                          placeholder="e.g. Fix leaking tap in kitchen"
                          value={jobRequestForm.title}
                          onChange={(e) => setJobRequestForm(prev => ({ ...prev, title: e.target.value }))}
                          className="bg-white text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-900 mb-1">Description</label>
                        <Textarea
                          placeholder="Describe what you need done..."
                          value={jobRequestForm.description}
                          onChange={(e) => setJobRequestForm(prev => ({ ...prev, description: e.target.value }))}
                          className="bg-white text-slate-900 resize-none"
                          rows={3}
                        />
                      </div>
                      {previousJobs.length > 0 && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-slate-900 mb-1">Reference Previous Job</label>
                            <p className="text-xs text-slate-500 mb-2">Link to a previous job for context</p>
                            <Select
                              value={jobRequestForm.referenceJobId}
                              onValueChange={(value) => {
                                if (value === 'none') {
                                  setSelectedReferenceJob(null);
                                  setJobRequestForm(prev => ({
                                    ...prev,
                                    referenceJobId: '',
                                    referenceJobTitle: '',
                                    preferredWorkerId: '',
                                    preferredWorkerName: '',
                                  }));
                                } else {
                                  const job = previousJobs.find((j: any) => j.id === value);
                                  setSelectedReferenceJob(job || null);
                                  setJobRequestForm(prev => ({
                                    ...prev,
                                    referenceJobId: value,
                                    referenceJobTitle: job?.title || '',
                                    preferredWorkerId: job?.assignedTo || prev.preferredWorkerId,
                                    preferredWorkerName: job?.workerName || prev.preferredWorkerName,
                                  }));
                                }
                              }}
                            >
                              <SelectTrigger className="bg-white text-slate-900">
                                <SelectValue placeholder="Select a previous job (optional)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No reference</SelectItem>
                                {previousJobs.map((job: any) => (
                                  <SelectItem key={job.id} value={job.id}>
                                    {job.title} {job.workerName ? `(${job.workerName})` : ''} - {job.status}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {selectedReferenceJob && (
                            <Card className="bg-slate-50 rounded-md border-slate-200">
                              <CardContent className="p-3">
                                <p className="text-sm font-medium text-slate-900">{selectedReferenceJob.title}</p>
                                <p className="text-xs text-slate-500 mt-1">{selectedReferenceJob.address || 'No address'}</p>
                                {selectedReferenceJob.workerName && (
                                  <p className="text-xs text-slate-600 mt-1">Worker: {selectedReferenceJob.workerName}</p>
                                )}
                                {selectedReferenceJob.notes && selectedReferenceJob.notes.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    <p className="text-xs font-medium text-slate-700">Previous Notes:</p>
                                    {selectedReferenceJob.notes.slice(0, 3).map((note: any, i: number) => (
                                      <p key={i} className="text-xs text-slate-500 line-clamp-2">
                                        {note.content}
                                      </p>
                                    ))}
                                    {selectedReferenceJob.notes.length > 3 && (
                                      <p className="text-xs text-slate-400">+{selectedReferenceJob.notes.length - 3} more notes</p>
                                    )}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          )}
                          {uniqueWorkers.length > 0 && (
                            <div>
                              <label className="block text-sm font-medium text-slate-900 mb-1">Request Previous Worker</label>
                              <p className="text-xs text-slate-500 mb-2">Request the same worker from a previous job</p>
                              <Select
                                value={jobRequestForm.preferredWorkerId}
                                onValueChange={(value) => {
                                  const worker = uniqueWorkers.find((w: any) => w.id === value);
                                  setJobRequestForm(prev => ({
                                    ...prev,
                                    preferredWorkerId: value === 'none' ? '' : value,
                                    preferredWorkerName: value === 'none' ? '' : (worker?.name || ''),
                                  }));
                                }}
                              >
                                <SelectTrigger className="bg-white text-slate-900">
                                  <SelectValue placeholder="Any available worker" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Any available worker</SelectItem>
                                  {uniqueWorkers.map((worker: any) => (
                                    <SelectItem key={worker.id} value={worker.id}>
                                      {worker.name} ({worker.jobCount} previous job{worker.jobCount > 1 ? 's' : ''})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-900 mb-1">Preferred Date</label>
                          <Input
                            type="date"
                            value={jobRequestForm.preferredDate}
                            onChange={(e) => setJobRequestForm(prev => ({ ...prev, preferredDate: e.target.value }))}
                            className="bg-white text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-900 mb-1">Urgency</label>
                          <Select
                            value={jobRequestForm.urgency}
                            onValueChange={(value) => setJobRequestForm(prev => ({ ...prev, urgency: value }))}
                          >
                            <SelectTrigger className="bg-white text-slate-900">
                              <SelectValue placeholder="Select urgency" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                              <SelectItem value="emergency">Emergency</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-900 mb-1">Additional Notes</label>
                        <Textarea
                          placeholder="Any other details or special instructions..."
                          value={jobRequestForm.clientNotes}
                          onChange={(e) => setJobRequestForm(prev => ({ ...prev, clientNotes: e.target.value }))}
                          className="bg-white text-slate-900 resize-none"
                          rows={2}
                        />
                      </div>
                      <Button
                        onClick={handleSubmitJobRequest}
                        disabled={isSubmittingJobRequest || !jobRequestForm.title.trim()}
                        className="w-full bg-brand text-white"
                        size="lg"
                      >
                        {isSubmittingJobRequest ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        {isSubmittingJobRequest ? 'Submitting...' : 'Submit Request'}
                      </Button>
                    </CardContent>
                  </Card>

                  <div>
                    <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-brand" />
                      Your Requests
                    </h3>
                    {isLoadingRequests ? (
                      <div className="space-y-4">
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-32 w-full" />
                      </div>
                    ) : jobRequests.length === 0 ? (
                      <div className="bg-white rounded-md shadow-lg p-10 text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                          <ClipboardList className="w-8 h-8 text-slate-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-1">No Requests Yet</h3>
                        <p className="text-sm text-slate-500">Submit a job request above and it will appear here</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {jobRequests.map((request) => (
                          <div key={request.id} className="bg-white rounded-md shadow-lg overflow-hidden">
                            <div className="p-5">
                              {editingRequest?.id === request.id ? (
                                <div className="space-y-3">
                                  <Input
                                    value={editForm.title}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="Job title"
                                  />
                                  <Textarea
                                    value={editForm.description}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Description"
                                    rows={2}
                                  />
                                  <Input
                                    type="date"
                                    value={editForm.preferredDate}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, preferredDate: e.target.value }))}
                                  />
                                  <Select value={editForm.urgency} onValueChange={(v) => setEditForm(prev => ({ ...prev, urgency: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="normal">Normal</SelectItem>
                                      <SelectItem value="urgent">Urgent</SelectItem>
                                      <SelectItem value="emergency">Emergency</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Textarea
                                    value={editForm.clientNotes}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, clientNotes: e.target.value }))}
                                    placeholder="Additional notes"
                                    rows={2}
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <Button variant="outline" size="sm" onClick={() => setEditingRequest(null)}>Cancel</Button>
                                    <Button size="sm" onClick={handleUpdateRequest} disabled={isUpdatingRequest}>
                                      {isUpdatingRequest && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                                      Save
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                      request.status === 'accepted' ? 'bg-green-100' :
                                      request.status === 'declined' ? 'bg-red-100' :
                                      request.status === 'in_progress' ? 'bg-blue-100' :
                                      'bg-yellow-100'
                                    }`}>
                                      <ClipboardList className={`w-5 h-5 ${
                                        request.status === 'accepted' ? 'text-green-600' :
                                        request.status === 'declined' ? 'text-red-500' :
                                        request.status === 'in_progress' ? 'text-blue-600' :
                                        'text-yellow-600'
                                      }`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-semibold text-slate-900 truncate">{request.title}</h3>
                                        <Badge className={getRequestStatusColor(request.status)}>
                                          {request.status === 'in_progress' ? 'In Progress' : request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                        </Badge>
                                        {request.urgency && request.urgency !== 'normal' && (
                                          <Badge className={getUrgencyColor(request.urgency)}>
                                            {request.urgency.charAt(0).toUpperCase() + request.urgency.slice(1)}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    {request.status === 'pending' && (
                                      <div className="flex gap-1 flex-shrink-0">
                                        <Button size="icon" variant="ghost" onClick={() => startEditingRequest(request)}>
                                          <Pencil className="w-4 h-4 text-slate-400" />
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => handleDeleteRequest(request.id)}
                                          disabled={isDeletingRequest === request.id}
                                        >
                                          {isDeletingRequest === request.id
                                            ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                            : <Trash2 className="w-4 h-4 text-red-400" />
                                          }
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                  <div className="ml-13 space-y-1">
                                    {request.description && (
                                      <p className="text-sm text-slate-500">{request.description}</p>
                                    )}
                                    <p className="text-xs text-slate-500 flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      Submitted {formatDate(request.createdAt)}
                                      {request.preferredDate && ` · Preferred: ${formatDate(request.preferredDate)}`}
                                    </p>
                                    {request.reviewNotes && (
                                      <div className="mt-2 p-2 bg-slate-50 rounded-md border border-slate-100">
                                        <p className="text-xs font-medium text-slate-600 mb-0.5">Business Response:</p>
                                        <p className="text-sm text-slate-700">{request.reviewNotes}</p>
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </main>

        <div className="text-center py-8 border-t border-slate-200 bg-white/80 backdrop-blur-sm flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 object-contain" />
            <span className="text-sm text-slate-500">Powered by <span className="font-semibold text-slate-900">JobRunner</span></span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500/60">
            <Shield className="w-3.5 h-3.5" />
            <span>Secure portal with industry-standard encryption</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
