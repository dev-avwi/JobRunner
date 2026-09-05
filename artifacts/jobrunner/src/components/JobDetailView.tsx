import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, User, MapPin, Calendar, Clock, Edit, FileText, FileEdit, Receipt, Camera, ExternalLink, Sparkles, Zap, Mic, ClipboardList, Users, Timer, CheckCircle, AlertTriangle, Loader2, PenLine, Trash2, Play, Square, Navigation, History, Mail, MessageSquare, CreditCard, Send, Bell, Plus, CheckCircle2, Smartphone, QrCode, DollarSign, Link2, Check, X, UserPlus, Copy, Circle, Package, Truck, Shield, Lock, Globe, Share2, Phone, Wrench, FileDown, Search, ChevronsUpDown, Eye, Image, ListChecks, Activity, MoreVertical, Star, Banknote, Layers, BarChart2, RotateCcw, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { TimerWidget } from "./TimeTracking";
import { useLocation, useSearch } from "wouter";
import { ToastAction } from "@/components/ui/toast";
import { isDedicatedNumberError, GET_NUMBER_TOAST, GET_NUMBER_URL } from "@/lib/dedicatedNumber";
import { getJobUrgency, getInProgressDuration } from "@/lib/jobUrgency";
import { useFeatureAccess } from "@/hooks/use-subscription";
import SmartActionsPanel, { getJobSmartActions, SmartAction } from "./SmartActionsPanel";
import type { EmailTemplate } from "./EmailTemplateEditor";
import {
  JobPhotoGallery,
  JobVoiceNotes,
  JobDocuments,
  JobVariations,
  JobSignature,
  AIPhotoAnalysis,
  SafetyFormsSection,
  SafetyCheckDialog,
  JobForms,
  JobCardSection,
  JobTasksSection,
  EmailTemplateEditor,
  GeofenceSettingsCard,
  LinkedDocumentsCard,
  JobFlowWizard,
  QuickCollectPayment,
  BeforePhotoPrompt,
  LinkedJobsCard,
  JobProfitabilityCard,
  UnifiedSendModal,
  ManualSmsComposer,
  JobPhasesSection,
  ClaimsSection,
  ProjectGanttView,
  ProjectDocumentRegister,
  DefectsSection,
  SiteDiarySection,
  JobChecklistSection,
  JobRfisSection,
  JobPurchaseOrdersSection,
} from "./JobDetailLazy";
import { SignatureDisplay } from '@/components/ui/signature-pad';
import { PhaseDetailPanel } from './PhaseDetailPanel';
import { ProjectTeamModal } from './ProjectTeamModal';
import type { JobPhase as PhaseDetailJobPhase } from './PhaseDetailPanel';
import { PresenceIndicator } from './JobCollaborationUI';
import { useJobCollaboration } from '@/hooks/use-job-collaboration';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/ui/page-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar as CalendarWidget } from "@/components/ui/calendar";
import { apiRequest, queryClient, getSessionToken, getAuthHeaders} from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { formatHistoryDate } from "@shared/dateUtils";
import { getWorkerDisplayName } from "@shared/displayName";
import { useAppMode } from "@/hooks/use-app-mode";
import { useIntegrationHealth, isTwilioReady } from "@/hooks/use-integration-health";
import { ImportOriginBadge } from "./ImportOriginBadge";
import type {
  Photo,
  JobStatus,
  Job,
  Client,
  QuoteLineItem,
  LinkedDocument,
  JobMaterial,
  JobEquipmentAssignment,
  JobWithLinks,
  TeamMember,
  JobDetailViewProps,
  User as JdvUser,
} from "./JobDetailView.types";

// ── Shared helper components ──────────────────────────────────────────────────
function TabEmptyState({ icon, title, description, action }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-muted/50 mb-4">{icon}</div>
      <p className="text-sm font-medium mb-1">{title}</p>
      <p className="text-xs text-muted-foreground mb-4 max-w-[240px]">{description}</p>
      {action}
    </div>
  );
}

export default function JobDetailView({
  jobId,
  onBack,
  onEditJob,
  onCompleteJob,
  onCreateQuote,
  onCreateInvoice,
  onViewClient,
}: JobDetailViewProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const searchString = useSearch();

  // Track search string in local state so browser back/forward updates the active tab.
  // wouter's useSearch does not reliably re-render on popstate, so we maintain our own
  // copy that is kept in sync via a popstate listener and updated optimistically on tab click.
  const [tabSearch, setTabSearch] = useState(() =>
    typeof window !== 'undefined' ? window.location.search : ''
  );
  useEffect(() => {
    const onPopState = () => setTabSearch(window.location.search);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const { canUseAIFeatures } = useFeatureAccess();
  const collaboration = useJobCollaboration(jobId, user?.id, user?.name || user?.email || 'Viewer');
  const chatSectionRef = useRef<HTMLDivElement>(null);
  const [showSmartActions, setShowSmartActions] = useState(false);
  const [smartActions, setSmartActions] = useState<SmartAction[]>([]);
  const [isExecutingActions, setIsExecutingActions] = useState(false);
  const [emailEditorOpen, setEmailEditorOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<SmartAction | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<Record<string, EmailTemplate>>({});
  const [showEmptyJobWarning, setShowEmptyJobWarning] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSafetyCheck, setShowSafetyCheck] = useState(false);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);
  const [rollbackTargetStatus, setRollbackTargetStatus] = useState<JobStatus | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showQuickCollect, setShowQuickCollect] = useState(false);
  const [showBeforePhotoPrompt, setShowBeforePhotoPrompt] = useState(false);
  const [showUnifiedSendModal, setShowUnifiedSendModal] = useState(false);
  const [unifiedSendDefaultTab, setUnifiedSendDefaultTab] = useState<'email' | 'sms'>('email');
  const [showManualSms, setShowManualSms] = useState(false);
  const [pendingTimerStart, setPendingTimerStart] = useState(false);
  // Phase-complete → claim wizard trigger
  const [pendingClaimPhase, setPendingClaimPhase] = useState<{ id: string; phaseCode: string; name: string; bookedHours: string | null } | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRole, setInviteRole] = useState<'subcontractor' | 'viewer'>('subcontractor');
  const [invitePermissions, setInvitePermissions] = useState<string[]>(['view_job', 'add_notes', 'add_photos', 'update_status']);
  const [inviteExpiry, setInviteExpiry] = useState<'never' | '7days' | '30days'>('30days');
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [inviteContactName, setInviteContactName] = useState('');
  const [inviteContactPhone, setInviteContactPhone] = useState('');
  const [inviteContactEmail, setInviteContactEmail] = useState('');
  const [inviteSendSms, setInviteSendSms] = useState(false);
  const [inviteSendEmail, setInviteSendEmail] = useState(false);
  const [inviteSendResults, setInviteSendResults] = useState<{ sms?: boolean; email?: boolean } | null>(null);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [showAssignEquipment, setShowAssignEquipment] = useState(false);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
  const [equipmentNotes, setEquipmentNotes] = useState('');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);
  const [rescheduleTime, setRescheduleTime] = useState("09:00");
  const [materialName, setMaterialName] = useState('');
  const [materialQty, setMaterialQty] = useState('1');
  const [materialUnit, setMaterialUnit] = useState('each');
  const [materialUnitCost, setMaterialUnitCost] = useState('');
  const [materialUnitPrice, setMaterialUnitPrice] = useState('');
  const [materialSupplier, setMaterialSupplier] = useState('');
  const [materialTrackingNumber, setMaterialTrackingNumber] = useState('');
  const [materialTrackingCarrier, setMaterialTrackingCarrier] = useState('');
  const [materialTrackingUrl, setMaterialTrackingUrl] = useState('');
  const [materialNotes, setMaterialNotes] = useState('');
  const [materialMarkupPercent, setMaterialMarkupPercent] = useState('');
  const [materialPhaseId, setMaterialPhaseId] = useState('');
  const [costPromptMaterial, setCostPromptMaterial] = useState<{ id: string; name: string; status: string } | null>(null);
  const [costPromptValue, setCostPromptValue] = useState('');
  
  const [showSiteUpdateDialog, setShowSiteUpdateDialog] = useState(false);
  const [siteUpdateNote, setSiteUpdateNote] = useState('');
  const [siteUpdatePhoto, setSiteUpdatePhoto] = useState<File | null>(null);
  const [siteUpdatePhotoPreview, setSiteUpdatePhotoPreview] = useState<string | null>(null);
  const [selectedDurationEstimate, setSelectedDurationEstimate] = useState<string>('');
  const [proofPackPreviewOpen, setProofPackPreviewOpen] = useState(false);
  const [proofPackBlobUrl, setProofPackBlobUrl] = useState<string | null>(null);
  const [proofPackLoading, setProofPackLoading] = useState(false);
  const [proofPackError, setProofPackError] = useState<string | null>(null);
  const [proofPackSections, setProofPackSections] = useState({
    timeline: true,
    attendance: true,
    gpsProof: true,
    materials: true,
    variations: true,
    photos: true,
    invoice: true,
    retention: true,
    compliance: true,
    swms: true,
    forms: true,
    subcontractors: true,
  });
  const [inspectionNotesInput, setInspectionNotesInput] = useState("");
  const [workerPopoverOpen, setWorkerPopoverOpen] = useState(false);
  const [detailPanelPhase, setDetailPanelPhase] = useState<PhaseDetailJobPhase | null>(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  // Time & Attendance expanded-worker state
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set());
  const toggleWorkerSessions = (userId: string) => {
    setExpandedWorkers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  // Retention ledger state
  const [retentionEditMode, setRetentionEditMode] = useState(false);
  const [retentionPercent, setRetentionPercent] = useState('0');
  const [retentionPcDate, setRetentionPcDate] = useState('');
  const [retentionDlpMonths, setRetentionDlpMonths] = useState('12');
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [retentionReleasing, setRetentionReleasing] = useState(false);
  
  // Update current time every second for live timer display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Check for tab=chat in URL to scroll to chat section
  const shouldScrollToChat = searchString?.includes('tab=chat');
  
  // Scroll to chat section when navigating from Chat Hub with tab=chat
  useEffect(() => {
    if (shouldScrollToChat && chatSectionRef.current) {
      // Small delay to ensure the section is rendered
      setTimeout(() => {
        chatSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [shouldScrollToChat]);
  
  const loadProofPackPreview = useCallback(async () => {
    if (!jobId) return;
    setProofPackLoading(true);
    setProofPackError(null);
    if (proofPackBlobUrl) {
      URL.revokeObjectURL(proofPackBlobUrl);
      setProofPackBlobUrl(null);
    }
    try {
      const params = new URLSearchParams();
      Object.entries(proofPackSections).forEach(([key, val]) => {
        if (!val) params.set(`hide_${key}`, '1');
      });
      const res = await fetch(`/api/jobs/${jobId}/proof-pack/preview?${params.toString()}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to load preview');
      }
      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html' });
      setProofPackBlobUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      setProofPackError(err.message || 'Failed to load proof pack preview');
    } finally {
      setProofPackLoading(false);
    }
  }, [jobId, proofPackSections]);

  useEffect(() => {
    if (proofPackPreviewOpen) {
      loadProofPackPreview();
    }
    return () => {
      if (proofPackBlobUrl) {
        URL.revokeObjectURL(proofPackBlobUrl);
      }
    };
  }, [proofPackPreviewOpen, loadProofPackPreview]);

  const { userRole, isTradie, isSolo, actionPermissions } = useAppMode();
  const { data: businessSettings } = useBusinessSettings();
  const { data: integrationHealth } = useIntegrationHealth();
  const twilioConnected = isTwilioReady(integrationHealth);

  const { data: job, isLoading: jobLoading, error: jobError } = useQuery<Job>({
    queryKey: ['/api/jobs', jobId],
  });

  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ['/api/clients', job?.clientId],
    enabled: !!job?.clientId,
  });

  const { data: currentUser } = useQuery<JdvUser>({
    queryKey: ['/api/auth/me'],
  });

  // Fetch linked quote/invoice for this job using dedicated endpoint
  interface LinkedReceipt {
    id: string;
    receiptNumber: string;
    amount: string;
    gstAmount: string | null;
    paymentMethod: string | null;
    paidAt: string | null;
    pdfUrl: string | null;
    createdAt: string;
  }
  
  interface LinkedDocumentsResponse {
    linkedQuote: LinkedDocument | null;
    linkedInvoice: LinkedDocument | null;
    linkedReceipts: LinkedReceipt[];
    quoteCount: number;
    invoiceCount: number;
    receiptCount: number;
  }
  
  const { data: linkedDocuments } = useQuery<LinkedDocumentsResponse>({
    queryKey: ['/api/jobs', jobId, 'linked-documents'],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch(`/api/jobs/${jobId}/linked-documents`, { credentials: 'include', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
      if (!res.ok) {
        if (res.status === 401) return { linkedQuote: null, linkedInvoice: null, linkedReceipts: [], quoteCount: 0, invoiceCount: 0, receiptCount: 0 };
        throw new Error('Failed to fetch linked documents');
      }
      return res.json();
    },
    enabled: !!currentUser && !!jobId,
    staleTime: 30000,
  });

  const linkedQuote = linkedDocuments?.linkedQuote;
  const linkedInvoice = linkedDocuments?.linkedInvoice;
  const linkedReceipts = linkedDocuments?.linkedReceipts || [];

  const { data: jobMaterials = [], isLoading: materialsLoading } = useQuery<JobMaterial[]>({
    queryKey: ['/api/jobs', jobId, 'materials'],
    enabled: !!jobId,
  });

  const { data: jobVariations = [] } = useQuery<any[]>({
    queryKey: ['/api/jobs', jobId, 'variations'],
    enabled: !!jobId,
  });

  // Profitability data — also carries retentionSummary for the retention ledger card
  const { data: jobProfitabilityData } = useQuery<any>({
    queryKey: ['/api/jobs', jobId, 'profitability'],
    enabled: !isTradie && !!jobId,
  });

  // Phases for the phase picker — loaded for project jobs only
  const { data: jobPhasesForPicker = [] } = useQuery<Array<{
    id: string; name: string; phaseCode: string; status: string;
    sortOrder?: number;
    scheduledStart?: string | null; scheduledEnd?: string | null;
    budgetedHours?: string | null; actualHours?: number | null;
    assignedUsers?: Array<{ id: string; name: string; isLead: boolean }>;
    assignedUserId?: string | null; assignedUserName?: string | null;
  }>>({
    queryKey: ['/api/jobs', jobId, 'phases'],
    enabled: !!jobId && (job as any)?.jobType === 'project',
    staleTime: 30000,
  });

  // Defect items — fetched here (not just in DefectsSection) so the retention
  // card can reactively reflect the cleared state without reading stale cache.
  const { data: defectItemsForRetention = [] } = useQuery<any[]>({
    queryKey: ['/api/jobs', jobId, 'defect-items'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/jobs/${jobId}/defect-items`);
      return res.json();
    },
    enabled: !isTradie && !!(job as any)?.jobType && (job as any)?.jobType === 'project' && !!jobId,
  });

  const { data: jobEquipmentList = [] } = useQuery<JobEquipmentAssignment[]>({
    queryKey: ['/api/jobs', jobId, 'equipment'],
  });

  const { data: allEquipment = [] } = useQuery<any[]>({
    queryKey: ['/api/equipment'],
  });

  // Fetch team members for assignment (only for owners/managers)
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ['/api/team/members'],
    enabled: !isTradie && !isSolo,
  });

  // Fetch all jobs to check worker availability (for assignment dropdown)
  const { data: allJobs = [] } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
    enabled: !isTradie && !isSolo && teamMembers.length > 0,
  });

  // Fetch job assignments with acceptance signatures
  interface JobAssignmentData {
    id: string;
    jobId: string;
    userId: string;
    displayName?: string;
    assignmentStatus?: string;
    acceptedAt?: string;
    acceptedByName?: string;
    acceptanceSignatureData?: string;
    confidentialityAgreed?: boolean;
    isActive?: boolean;
    isPrimary?: boolean;
    completedAt?: string | null;
    workerDisplayNameSnapshot?: string;
  }
  const { data: jobAssignments = [] } = useQuery<JobAssignmentData[]>({
    queryKey: ['/api/jobs', jobId, 'assignments'],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch(`/api/jobs/${jobId}/assignments`, { credentials: 'include', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!jobId && !isTradie && !isSolo,
  });

  // Helper function to check if a worker is on another active job
  const isWorkerOnOtherJob = (memberId: string): boolean => {
    return allJobs.some(
      (j) => j.assignedTo === memberId && j.status === 'in_progress' && j.id !== jobId
    );
  };

  // Fetch job photos - enable for all job statuses to support team sync
  const { data: jobPhotos = [] } = useQuery<{ id: string }[]>({
    queryKey: ['/api/jobs', jobId, 'photos'],
    enabled: !!jobId,
  });

  // Fetch job notes - timestamped notes tied to moments
  interface JobNote {
    id: string;
    content: string;
    createdBy?: string;
    createdByName?: string;
    createdAt: string;
  }
  const { data: jobNotesData = [] } = useQuery<JobNote[]>({
    queryKey: ['/api/jobs', jobId, 'notes'],
    enabled: !!jobId,
  });

  interface TimeEntryForCosting {
    id: string;
    userId?: string;
    userName?: string;
    startTime: string;
    endTime?: string;
    isBreak?: boolean;
    hourlyRate?: number;
    duration?: number;
    description?: string;
    origin?: string;
    clockInLatitude?: string;
    clockInLongitude?: string;
    clockInAddress?: string;
    clockOutLatitude?: string;
    clockOutLongitude?: string;
    clockOutAddress?: string;
    isBillable?: boolean;
    timeCategory?: string;
  }

  const { data: timeEntries = [] } = useQuery<TimeEntryForCosting[]>({
    queryKey: ['/api/time-entries', { jobId, teamView: 'true' }],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch(`/api/time-entries?jobId=${jobId}&teamView=true`, { credentials: 'include', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!jobId,
  });

  interface WorkerTimeSummary {
    userId: string;
    name: string;
    totalMinutes: number;
    totalHours: number;
    hourlyRate: number;
    laborCost: number;
    entries: TimeEntryForCosting[];
    hasGps: boolean;
    breakMinutes: number;
  }

  const { workerSummaries, actualHoursData } = useMemo(() => {
    const completedWorkEntries = timeEntries.filter(
      (entry) => entry.endTime && !entry.isBreak
    );
    
    const totalMinutes = completedWorkEntries.reduce((total, entry) => {
      const start = new Date(entry.startTime).getTime();
      const end = new Date(entry.endTime!).getTime();
      return total + Math.floor((end - start) / 60000);
    }, 0);
    
    const actualHours = totalMinutes / 60;
    
    const entriesWithRate = completedWorkEntries.filter(e => e.hourlyRate && e.hourlyRate > 0);
    const avgHourlyRate = entriesWithRate.length > 0
      ? entriesWithRate.reduce((sum, e) => sum + (e.hourlyRate || 0), 0) / entriesWithRate.length
      : 0;
    
    const laborCost = actualHours * avgHourlyRate;

    const byWorker = new Map<string, TimeEntryForCosting[]>();
    for (const entry of timeEntries) {
      const key = entry.userId || 'unknown';
      if (!byWorker.has(key)) byWorker.set(key, []);
      byWorker.get(key)!.push(entry);
    }

    const getEntryMinutes = (entry: TimeEntryForCosting) => {
      if (entry.endTime) {
        return entry.duration || Math.floor((new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / 60000);
      }
      return Math.floor((Date.now() - new Date(entry.startTime).getTime()) / 60000);
    };

    const summaries: WorkerTimeSummary[] = [];
    for (const [userId, entries] of Array.from(byWorker.entries())) {
      const workEntries = entries.filter(e => !e.isBreak);
      const breakEntries = entries.filter(e => e.isBreak);
      
      const workerMins = workEntries.reduce((total, entry) => total + getEntryMinutes(entry), 0);
      const breakMins = breakEntries.reduce((total, entry) => total + getEntryMinutes(entry), 0);

      const rateEntries = workEntries.filter(e => e.hourlyRate && e.hourlyRate > 0);
      const workerRate = rateEntries.length > 0
        ? rateEntries.reduce((sum, e) => sum + (e.hourlyRate || 0), 0) / rateEntries.length
        : avgHourlyRate;
      const workerHours = workerMins / 60;

      summaries.push({
        userId,
        name: entries[0]?.userName || 'Worker',
        totalMinutes: workerMins,
        totalHours: Math.round(workerHours * 100) / 100,
        hourlyRate: Math.round(workerRate * 100) / 100,
        laborCost: Math.round(workerHours * workerRate * 100) / 100,
        entries: workEntries,
        hasGps: entries.some(e => e.clockInLatitude || e.origin === 'geofence'),
        breakMinutes: breakMins,
      });
    }

    summaries.sort((a, b) => b.totalMinutes - a.totalMinutes);

    const totalLaborCost = summaries.reduce((sum, w) => sum + w.laborCost, 0);
    const totalHoursFromWorkers = summaries.reduce((sum, w) => sum + w.totalHours, 0);

    return {
      workerSummaries: summaries,
      actualHoursData: {
        actualHours: totalHoursFromWorkers > 0 ? totalHoursFromWorkers : Math.round(actualHours * 100) / 100,
        laborCost: totalLaborCost > 0 ? totalLaborCost : Math.round(laborCost * 100) / 100,
        hasData: completedWorkEntries.length > 0 || summaries.some(s => s.entries.some(e => !e.endTime)),
        hourlyRate: avgHourlyRate,
      },
    };
  }, [timeEntries]);

  // Fetch voice notes - enable for all job statuses to support team sync
  const { data: voiceNotes = [] } = useQuery<{ id: string }[]>({
    queryKey: ['/api/jobs', jobId, 'voice-notes'],
    enabled: !!jobId,
  });

  // Fetch signatures - enable for all job statuses to support team sync
  const { data: signatures = [] } = useQuery<{ id: string }[]>({
    queryKey: ['/api/jobs', jobId, 'signatures'],
    enabled: !!jobId,
  });

  // Activity feed types and styling
  interface JobActivityItem {
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: string;
    status: 'success' | 'pending' | 'failed';
    entityType?: 'job' | 'quote' | 'invoice' | null;
    entityId?: string | null;
    metadata?: Record<string, any>;
  }

  const activityIcons: Record<string, typeof Mail> = {
    email_sent: Mail,
    sms_sent: MessageSquare,
    payment_received: CreditCard,
    quote_sent: FileText,
    invoice_sent: Send,
    reminder_sent: Bell,
    quote_accepted: CheckCircle2,
    job_scheduled: Clock,
    job_started: Clock,
    job_completed: CheckCircle2,
    job_created: Briefcase,
    job_status_changed: Briefcase,
    quote_created: Plus,
    invoice_created: Plus,
    invoice_paid: CreditCard,
    photo_added: Camera,
    voice_note_added: Mic,
    note_updated: PenLine,
    note_added: Plus,
    note_edited: PenLine,
    note_deleted: Trash2,
    variation_created: Plus,
    variation_sent: Send,
    variation_approved: Check,
    variation_rejected: X,
    variation_deleted: Trash2,
  };

  const activityColors: Record<string, { bg: string; icon: string }> = {
    email_sent: { bg: 'hsl(210 80% 52% / 0.1)', icon: 'hsl(210 80% 52%)' },
    sms_sent: { bg: 'hsl(280 65% 60% / 0.1)', icon: 'hsl(280 65% 60%)' },
    payment_received: { bg: 'hsl(145 65% 45% / 0.1)', icon: 'hsl(145 65% 45%)' },
    quote_sent: { bg: 'hsl(35 90% 55% / 0.1)', icon: 'hsl(35 90% 55%)' },
    invoice_sent: { bg: 'hsl(5 85% 55% / 0.1)', icon: 'hsl(5 85% 55%)' },
    reminder_sent: { bg: 'hsl(25 90% 55% / 0.1)', icon: 'hsl(25 90% 55%)' },
    quote_accepted: { bg: 'hsl(145 65% 45% / 0.1)', icon: 'hsl(145 65% 45%)' },
    job_scheduled: { bg: 'hsl(210 80% 52% / 0.1)', icon: 'hsl(210 80% 52%)' },
    job_started: { bg: 'hsl(35 90% 55% / 0.1)', icon: 'hsl(35 90% 55%)' },
    job_completed: { bg: 'hsl(145 65% 45% / 0.1)', icon: 'hsl(145 65% 45%)' },
    job_created: { bg: 'hsl(210 80% 52% / 0.1)', icon: 'hsl(210 80% 52%)' },
    job_status_changed: { bg: 'hsl(35 90% 55% / 0.1)', icon: 'hsl(35 90% 55%)' },
    quote_created: { bg: 'hsl(35 90% 55% / 0.1)', icon: 'hsl(35 90% 55%)' },
    invoice_created: { bg: 'hsl(5 85% 55% / 0.1)', icon: 'hsl(5 85% 55%)' },
    invoice_paid: { bg: 'hsl(145 65% 45% / 0.1)', icon: 'hsl(145 65% 45%)' },
    photo_added: { bg: 'hsl(180 60% 45% / 0.1)', icon: 'hsl(180 60% 45%)' },
    voice_note_added: { bg: 'hsl(320 70% 55% / 0.1)', icon: 'hsl(320 70% 55%)' },
    note_updated: { bg: 'hsl(45 85% 50% / 0.1)', icon: 'hsl(45 85% 50%)' },
    note_added: { bg: 'hsl(145 65% 45% / 0.1)', icon: 'hsl(145 65% 45%)' },
    note_edited: { bg: 'hsl(45 85% 50% / 0.1)', icon: 'hsl(45 85% 50%)' },
    note_deleted: { bg: 'hsl(5 85% 55% / 0.1)', icon: 'hsl(5 85% 55%)' },
    variation_created: { bg: 'hsl(35 90% 55% / 0.1)', icon: 'hsl(35 90% 55%)' },
    variation_sent: { bg: 'hsl(210 80% 52% / 0.1)', icon: 'hsl(210 80% 52%)' },
    variation_approved: { bg: 'hsl(145 65% 45% / 0.1)', icon: 'hsl(145 65% 45%)' },
    variation_rejected: { bg: 'hsl(5 85% 55% / 0.1)', icon: 'hsl(5 85% 55%)' },
    variation_deleted: { bg: 'hsl(5 85% 55% / 0.1)', icon: 'hsl(5 85% 55%)' },
  };

  // Fetch job-specific activity history
  const { data: jobActivities = [], isLoading: activitiesLoading } = useQuery<JobActivityItem[]>({
    queryKey: ['/api/jobs', jobId, 'activity'],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch(`/api/jobs/${jobId}/activity?limit=10`, { credentials: 'include', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!currentUser && !!jobId,
    staleTime: 30000,
  });

  // Fetch active timer to check if timer is running for this job
  const { data: globalActiveTimer } = useQuery<{ id: string; jobId?: string; startTime: string; description?: string } | null>({
    queryKey: ['/api/time-entries/active/current'],
    staleTime: 10000,
  });

  const activeTimerForThisJob = globalActiveTimer && globalActiveTimer.jobId === jobId ? globalActiveTimer : null;

  // Auto-start timer mutation
  const startTimerMutation = useMutation({
    mutationFn: async (data: { description: string; jobId: string; hourlyRate?: string }) => {
      return apiRequest('POST', '/api/time-entries', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      toast({
        title: "Timer Started",
        description: "Time tracking has begun automatically",
      });
    },
    onError: (error: any) => {
      console.error('Auto-start timer error:', error);
    },
  });

  // Stop timer mutation
  const stopTimerMutation = useMutation({
    mutationFn: async (timerId: string) => {
      return apiRequest('POST', `/api/time-entries/${timerId}/stop`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      toast({
        title: "Time Saved",
        description: "Your time has been recorded",
      });
    },
  });

  const completeInspectionMutation = useMutation({
    mutationFn: async (notes: string) => {
      return apiRequest('POST', `/api/jobs/${jobId}/complete-inspection`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      toast({ title: "Inspection Complete", description: "Inspection marked as done. You can now create a quote." });
      setInspectionNotesInput("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to mark inspection as complete", variant: "destructive" });
    },
  });

  // Helper to get elapsed time string
  const getElapsedTime = (startTime: string) => {
    const start = new Date(startTime);
    const diffMs = currentTime.getTime() - start.getTime();
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate job urgency for scheduled jobs
  const jobUrgency = job ? getJobUrgency(job.scheduledAt, job.status) : null;

  // Fetch safety form submissions to check if safety forms have been completed
  interface FormSubmissionWithForm {
    id: string;
    formId: string;
    status: string;
    submissionData: Record<string, any>;
  }
  
  const { data: formSubmissions = [] } = useQuery<FormSubmissionWithForm[]>({
    queryKey: ['/api/jobs', jobId, 'form-submissions'],
    enabled: !!jobId,
  });

  // Get user's trade type for filtering custom forms
  const { data: authUser } = useQuery<{ tradeType?: string }>({
    queryKey: ['/api/auth/me'],
    staleTime: 30000,
  });
  const userTradeType = authUser?.tradeType;

  const { data: customForms = [] } = useQuery<{ id: string; formType: string; requiresSignature: boolean }[]>({
    queryKey: ['/api/custom-forms', userTradeType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userTradeType) params.append('tradeType', userTradeType);
      const url = `/api/custom-forms${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch forms');
      return response.json();
    },
    enabled: !!authUser && !!jobId,
    staleTime: 30000,
  });

  // Check if any safety forms exist and if any are completed
  const safetyForms = customForms.filter(f => 
    f.formType === 'safety' || f.formType === 'compliance' || f.formType === 'inspection'
  );
  
  const hasSafetyForms = safetyForms.length > 0;
  
  const safetyFormSubmissions = formSubmissions.filter(s => {
    const form = customForms.find(f => f.id === s.formId);
    return form && (form.formType === 'safety' || form.formType === 'compliance' || form.formType === 'inspection');
  });
  
  const hasCompletedSafetyForm = safetyFormSubmissions.length > 0;

  // Check if job is "empty" (no documentation)
  const isEmptyJob = () => {
    const hasPhotos = jobPhotos.length > 0;
    const hasNotes = jobNotesData.length > 0 || (job?.notes && job.notes.trim().length > 0);
    // Count ANY time entries (active or completed) - not just completed ones
    const hasTimeTracked = timeEntries.length > 0;
    const hasSignatures = signatures.length > 0;
    const hasVoiceNotes = voiceNotes.length > 0;
    return !hasPhotos && !hasNotes && !hasTimeTracked && !hasSignatures && !hasVoiceNotes;
  };

  // Handler for completing job with empty job guardrail
  const handleCompleteJob = () => {
    if (isEmptyJob()) {
      setShowEmptyJobWarning(true);
    } else {
      updateJobMutation.mutate({ status: 'done' });
    }
  };

  const confirmCompleteEmptyJob = () => {
    setShowEmptyJobWarning(false);
    updateJobMutation.mutate({ status: 'done' });
  };

  // Multi-worker assignment mutations
  const invalidateAssignmentQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'assignments'] });
    queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
    queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
    queryClient.invalidateQueries({ queryKey: ['/api/jobs/my-jobs'] });
    queryClient.invalidateQueries({ queryKey: ['/api/jobs/today'] });
    queryClient.invalidateQueries({ queryKey: ['/api/dashboard/kpis'] });
  };

  const addWorkersMutation = useMutation({
    mutationFn: async (workerIds: string[]) => {
      return await apiRequest("POST", `/api/jobs/${jobId}/multi-assign`, { workerIds });
    },
    onSuccess: () => {
      invalidateAssignmentQueries();
      toast({ title: "Worker Assigned", description: "Worker has been added to this job" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to assign worker", variant: "destructive" });
    },
  });

  const removeWorkerMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("DELETE", `/api/jobs/${jobId}/assignments/${userId}/remove`);
    },
    onSuccess: () => {
      invalidateAssignmentQueries();
      toast({ title: "Worker Removed", description: "Worker has been removed from this job" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove worker", variant: "destructive" });
    },
  });

  const makeLeadMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      return await apiRequest("POST", `/api/jobs/${jobId}/assignments/${assignmentId}/make-lead`, {});
    },
    onSuccess: () => {
      invalidateAssignmentQueries();
      toast({ title: "Lead Updated", description: "Lead worker has been changed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to set lead worker", variant: "destructive" });
    },
  });

  // Active worker assignments (multi-worker support)
  const activeAssignments = jobAssignments.filter((a) => a.isActive !== false);
  const assignedUserIds = new Set(activeAssignments.map((a) => a.userId));
  const isMemberAssigned = (memberId: string | null | undefined) => !!memberId && assignedUserIds.has(memberId);
  const assignBusy = addWorkersMutation.isPending || removeWorkerMutation.isPending;

  const updateJobMutation = useMutation({
    mutationFn: async (data: { status?: string; scheduledAt?: string }) => {
      // Staff tradies use the status-specific endpoint (which only allows status updates on assigned jobs)
      // Owners and managers use the full update endpoint
      // For non-status updates (like rescheduling), always use the full endpoint
      const isStatusOnly = data.status && !data.scheduledAt;
      const endpoint = isTradie && isStatusOnly
        ? `/api/jobs/${jobId}/status`
        : `/api/jobs/${jobId}`;
      return await apiRequest("PATCH", endpoint, data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'linked-documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'activity'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity-feed'] });
      
      if (variables?.status === 'done') {
        toast({
          title: "Job Completed",
          description: "Job has been marked as completed successfully",
        });
      } else {
        toast({
          title: "Job Updated",
          description: "Job status has been updated",
        });
      }
    },
    onError: (error: any) => {
      // Surface WHS gating blocks (expired licence / Take 5 required) with the
      // server's friendly message instead of a generic error.
      let title = "Error";
      let description = "Failed to update job";
      const raw = typeof error?.message === 'string' ? error.message : '';
      const jsonStart = raw.indexOf('{');
      if (jsonStart !== -1) {
        try {
          const parsed = JSON.parse(raw.slice(jsonStart));
          if (parsed?.code === 'TAKE5_REQUIRED') {
            title = "Pre-start safety check required";
            description = parsed.error;
          } else if (parsed?.code === 'COMPLIANCE_EXPIRED') {
            title = "Expired licence — job blocked";
            description = parsed.error;
          } else if (parsed?.error) {
            description = parsed.error;
          }
        } catch {}
      }
      toast({
        title,
        description,
        variant: "destructive",
      });
    },
  });

  const reopenJobMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/jobs/${jobId}/reopen`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'activity'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity-feed'] });
      toast({
        title: "Job Re-opened",
        description: "The job has been moved back to scheduled. The original completion is preserved in the activity log.",
      });
    },
    onError: (error: any) => {
      let description = "Failed to re-open job";
      const raw = typeof error?.message === 'string' ? error.message : '';
      const jsonStart = raw.indexOf('{');
      if (jsonStart !== -1) {
        try {
          const parsed = JSON.parse(raw.slice(jsonStart));
          if (parsed?.error) description = parsed.error;
        } catch {}
      }
      toast({ title: "Error", description, variant: "destructive" });
    },
  });

  // Add new note mutation - creates timestamped note tied to the moment
  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest("POST", `/api/jobs/${jobId}/notes`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity-logs'] });
      setShowNotesModal(false);
      setEditedNotes('');
      toast({
        title: "Note Added",
        description: "Your note has been recorded with timestamp",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
    },
  });

  const handleOpenNotesModal = () => {
    setEditedNotes('');
    setShowNotesModal(true);
  };

  const handleSaveNotes = () => {
    if (editedNotes.trim()) {
      addNoteMutation.mutate(editedNotes.trim());
    }
  };

  const [isSiteUpdateSubmitting, setIsSiteUpdateSubmitting] = useState(false);

  const handleSiteUpdatePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSiteUpdatePhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSiteUpdatePhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitSiteUpdate = async () => {
    if (!siteUpdateNote.trim()) return;
    setIsSiteUpdateSubmitting(true);
    try {
      const noteContent = `[Site Update] ${siteUpdateNote.trim()}`;
      await apiRequest("POST", `/api/jobs/${jobId}/notes`, { content: noteContent });

      if (siteUpdatePhoto && siteUpdatePhotoPreview) {
        await apiRequest("POST", `/api/jobs/${jobId}/photos`, {
          fileName: siteUpdatePhoto.name,
          fileBase64: siteUpdatePhotoPreview.split(',')[1],
          mimeType: siteUpdatePhoto.type,
          category: 'progress',
          caption: siteUpdateNote.trim(),
        });
      }

      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'photos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity-logs'] });

      setSiteUpdateNote('');
      setSiteUpdatePhoto(null);
      setSiteUpdatePhotoPreview(null);
      setShowSiteUpdateDialog(false);
      toast({
        title: "Site update logged",
        description: "Your note and photo have been recorded",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to log site update",
        variant: "destructive",
      });
    } finally {
      setIsSiteUpdateSubmitting(false);
    }
  };

  // Rename job mutation
  const renameJobMutation = useMutation({
    mutationFn: async (title: string) => {
      return await apiRequest("PATCH", `/api/jobs/${jobId}`, { title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      setShowRenameDialog(false);
      toast({
        title: "Job Renamed",
        description: "Job title has been updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to rename job",
        variant: "destructive",
      });
    },
  });

  const handleOpenRenameDialog = () => {
    setNewJobTitle(job?.title || '');
    setShowRenameDialog(true);
  };

  const handleRenameJob = () => {
    if (newJobTitle.trim()) {
      renameJobMutation.mutate(newJobTitle.trim());
    }
  };

  const addMaterialMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `/api/jobs/${jobId}/materials`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'materials'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'profitability'] });
      setShowAddMaterial(false);
      setMaterialName('');
      setMaterialQty('1');
      setMaterialUnit('each');
      setMaterialUnitCost('');
      setMaterialUnitPrice('');
      setMaterialSupplier('');
      setMaterialTrackingNumber('');
      setMaterialTrackingCarrier('');
      setMaterialTrackingUrl('');
      setMaterialNotes('');
      setMaterialMarkupPercent('');
      setMaterialPhaseId('');
      toast({ title: 'Material added' });
    },
    onError: () => {
      toast({ title: 'Failed to add material', variant: 'destructive' });
    },
  });

  const updateMaterialStatusMutation = useMutation({
    mutationFn: async ({ id, status, unitCost }: { id: string; status: string; unitCost?: string }) => {
      const body: any = { status };
      if (unitCost !== undefined) body.unitCost = unitCost;
      const res = await apiRequest('PATCH', `/api/materials/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'materials'] });
    },
  });

  const handleMaterialStatusChange = (mat: any, newStatus: string) => {
    const hasCost = parseFloat(mat.unitCost || '0') > 0;
    if ((newStatus === 'received' || newStatus === 'installed') && !hasCost && !isTradie) {
      setCostPromptMaterial({ id: mat.id, name: mat.name, status: newStatus });
      setCostPromptValue('');
    } else {
      updateMaterialStatusMutation.mutate({ id: mat.id, status: newStatus });
    }
  };

  const handleCostPromptSubmit = () => {
    if (!costPromptMaterial) return;
    const cost = costPromptValue ? costPromptValue : '0';
    updateMaterialStatusMutation.mutate({
      id: costPromptMaterial.id,
      status: costPromptMaterial.status,
      unitCost: cost,
    });
    setCostPromptMaterial(null);
    setCostPromptValue('');
  };

  const handleCostPromptSkip = () => {
    if (!costPromptMaterial) return;
    updateMaterialStatusMutation.mutate({
      id: costPromptMaterial.id,
      status: costPromptMaterial.status,
    });
    setCostPromptMaterial(null);
    setCostPromptValue('');
  };

  const deleteMaterialMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/materials/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'materials'] });
      toast({ title: 'Material removed' });
    },
  });

  const uploadMaterialReceiptMutation = useMutation({
    mutationFn: async ({ materialId, base64Image }: { materialId: string; base64Image: string }) => {
      const res = await apiRequest('POST', `/api/materials/${materialId}/receipt-photo`, { image: base64Image });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'materials'] });
      setUploadingMaterialId(null);
      toast({ title: 'Receipt photo saved' });
    },
    onError: () => {
      setUploadingMaterialId(null);
      toast({ title: 'Failed to upload receipt', variant: 'destructive' });
    },
  });

  const [uploadingMaterialId, setUploadingMaterialId] = useState<string | null>(null);

  const handleMaterialReceiptUpload = (materialId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Please select an image file', variant: 'destructive' });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: 'Image too large (max 10MB)', variant: 'destructive' });
        return;
      }
      setUploadingMaterialId(materialId);
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        uploadMaterialReceiptMutation.mutate({ materialId, base64Image: base64 });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const assignEquipmentMutation = useMutation({
    mutationFn: async (data: { equipmentId: string; notes?: string }) => {
      const res = await apiRequest('POST', `/api/jobs/${jobId}/equipment`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'equipment'] });
      setShowAssignEquipment(false);
      setSelectedEquipmentId('');
      setEquipmentNotes('');
      toast({ title: 'Equipment assigned to job' });
    },
    onError: () => {
      toast({ title: 'Failed to assign equipment', variant: 'destructive' });
    },
  });

  const unassignEquipmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      await apiRequest('DELETE', `/api/jobs/${jobId}/equipment/${assignmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'equipment'] });
      toast({ title: 'Equipment removed from job' });
    },
    onError: () => {
      toast({ title: 'Failed to remove equipment', variant: 'destructive' });
    },
  });

  // Delete job mutation
  const deleteJobMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/jobs/${jobId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/kpis'] });
      toast({
        title: "Job Deleted",
        description: "The job has been permanently deleted",
      });
      onBack();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete job",
        variant: "destructive",
      });
    },
  });

  const cloneJobMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/clone`);
      return await res.json();
    },
    onSuccess: (newJob: Job) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/kpis'] });
      toast({
        title: "Job Duplicated",
        description: `"${newJob.title}" has been created as a copy`,
      });
      navigate(`/jobs/${newJob.id}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to duplicate job",
        variant: "destructive",
      });
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      // Fetch the current phases and checklist items for this job in parallel
      const token = getSessionToken();
      const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
      const [phasesRes, checklistRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}/phases`, { credentials: 'include', headers }),
        fetch(`/api/jobs/${jobId}/checklist`, { credentials: 'include', headers }),
      ]);
      if (!phasesRes.ok) {
        throw new Error(`Failed to fetch phases (${phasesRes.status})`);
      }
      if (!checklistRes.ok) {
        throw new Error(`Failed to fetch checklist (${checklistRes.status})`);
      }
      const phases: any[] = await phasesRes.json();
      const checklist: any[] = await checklistRes.json();
      const templatePhases = phases.map((p: any) => ({
        phaseCode: p.phaseCode,
        name: p.name,
        description: p.description || undefined,
        bookedHours: p.bookedHours ? String(p.bookedHours) : undefined,
      }));
      const templateChecklistItems = checklist
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((item: any, i: number) => ({
          text: item.text,
          sortOrder: item.sortOrder ?? i,
        }));
      const res = await apiRequest("POST", "/api/project-templates", {
        name,
        templateData: {
          phases: templatePhases,
          settings: {
            description: (job as any)?.description || undefined,
          },
          ...(templateChecklistItems.length > 0 ? { checklistItems: templateChecklistItems } : {}),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Failed to save template (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-templates'] });
      toast({ title: "Template saved", description: `"${saveTemplateName}" is now available when creating a new project` });
      setShowSaveTemplateDialog(false);
      setSaveTemplateName('');
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save template", variant: "destructive" });
    },
  });

  const handleExportTimeCSV = () => {
    const exportable = timeEntries.filter(e => !e.isBreak && e.endTime);
    if (!exportable.length) return;

    // Encode a value as a safe CSV cell:
    // - Numbers are passed through as-is
    // - Strings are quoted, internal quotes doubled, and formula-leading
    //   characters (=, +, -, @) are prefixed with a tab to neutralise injection
    const csvCell = (value: string | number | boolean): string => {
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
      const s = String(value ?? '');
      // Neutralise spreadsheet formula injection
      const safe = /^[=+\-@]/.test(s) ? `\t${s}` : s;
      // Quote the field and escape any embedded quotes by doubling them
      return `"${safe.replace(/"/g, '""')}"`;
    };

    const headers = ['Worker', 'Date', 'Clock In', 'Clock Out', 'Hours', 'Category', 'Billable', 'GPS Verified', 'Hourly Rate', 'Cost'];
    const rows = exportable.map(entry => {
      const start = new Date(entry.startTime);
      const end = new Date(entry.endTime!);
      // Use stored duration as the authoritative source (matches what the UI cards show),
      // falling back to timestamp difference only when duration is absent.
      const mins = entry.duration != null
        ? entry.duration
        : Math.floor((end.getTime() - start.getTime()) / 60000);
      const hours = Math.round(mins / 60 * 100) / 100;
      const cost = entry.hourlyRate ? Math.round(hours * entry.hourlyRate * 100) / 100 : '';
      const verified = (entry.clockInLatitude || (entry as any).origin === 'geofence') ? 'Yes' : 'No';
      return [
        csvCell(entry.userName || 'Worker'),
        csvCell(start.toLocaleDateString('en-AU')),
        csvCell(start.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })),
        csvCell(end.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })),
        hours,
        csvCell(entry.timeCategory || 'work'),
        csvCell(entry.isBillable === false ? 'No' : 'Yes'),
        csvCell(verified),
        entry.hourlyRate ?? '',
        cost,
      ].join(',');
    });
    const csv = [headers.map(csvCell).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-entries-job-${jobId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteJob = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteJob = () => {
    setShowDeleteConfirm(false);
    deleteJobMutation.mutate();
  };

  interface SubTokenData {
    id: string;
    token: string;
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    permissions: string[];
    expiresAt: string | null;
    status: string;
    acceptedAt: string | null;
    createdAt: string;
  }

  const { data: subTokens, refetch: refetchSubTokens } = useQuery<SubTokenData[]>({
    queryKey: ['/api/jobs', jobId, 'subcontractor-tokens'],
    enabled: !!jobId && !isTradie,
  });

  const createInviteMutation = useMutation({
    mutationFn: async () => {
      const expiresAt = inviteExpiry === 'never' 
        ? null 
        : inviteExpiry === '7days' 
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const response = await apiRequest("POST", `/api/jobs/${jobId}/subcontractor-token`, {
        contactName: inviteContactName || null,
        contactPhone: inviteContactPhone || null,
        contactEmail: inviteContactEmail || null,
        permissions: invitePermissions,
        expiresAt,
        sendViaSms: inviteSendSms && !!inviteContactPhone,
        sendViaEmail: inviteSendEmail && !!inviteContactEmail,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedInviteLink(data.webLink);
      setInviteSendResults(data.sendResults || null);
      refetchSubTokens();
      const sentMethods: string[] = [];
      if (data.sendResults?.sms) sentMethods.push('SMS');
      if (data.sendResults?.email) sentMethods.push('email');
      toast({
        title: "Invite Created",
        description: sentMethods.length > 0 
          ? `Invite sent via ${sentMethods.join(' and ')}` 
          : "Copy the link to share with your subcontractor",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create invite",
        variant: "destructive",
      });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      return await apiRequest("DELETE", `/api/jobs/${jobId}/subcontractor-tokens/${tokenId}`);
    },
    onSuccess: () => {
      refetchSubTokens();
      toast({
        title: "Invite Revoked",
        description: "The invite link is no longer valid",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to revoke invite",
        variant: "destructive",
      });
    },
  });

  const handleCopyInviteLink = async () => {
    if (generatedInviteLink) {
      await navigator.clipboard.writeText(generatedInviteLink);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    }
  };

  const handleOpenInviteModal = () => {
    setGeneratedInviteLink(null);
    setInviteSendResults(null);
    setInviteRole('subcontractor');
    setInvitePermissions(['view_job', 'add_notes', 'add_photos', 'update_status']);
    setInviteExpiry('30days');
    setInviteContactName('');
    setInviteContactPhone('');
    setInviteContactEmail('');
    setInviteSendSms(false);
    setInviteSendEmail(false);
    setShowInviteModal(true);
  };

  const togglePermission = (perm: string) => {
    if (invitePermissions.includes(perm)) {
      setInvitePermissions(invitePermissions.filter(p => p !== perm));
    } else {
      setInvitePermissions([...invitePermissions, perm]);
    }
  };

  // Helper to check if job is overdue (past scheduled time)
  const isJobOverdue = (): boolean => {
    if (!job?.scheduledAt) return false;
    const scheduledTime = new Date(job.scheduledAt);
    return currentTime > scheduledTime;
  };

  // Helper to parse error messages and detect SMS configuration issues
  const handleSmsError = (error: any) => {
    if (isDedicatedNumberError(error)) {
      toast({
        ...GET_NUMBER_TOAST,
        action: (
          <ToastAction altText="Get number" onClick={() => navigate(GET_NUMBER_URL)}>
            Get number
          </ToastAction>
        ),
      });
      return;
    }
    let errorMessage = error.message || "Failed to send notification";
    // Parse "400: {json}" style errors
    if (errorMessage.includes(': ')) {
      const parts = errorMessage.split(': ');
      if (!isNaN(parseInt(parts[0]))) {
        errorMessage = parts.slice(1).join(': ');
      }
    }
    // Try to extract error from JSON body
    try {
      const parsed = JSON.parse(errorMessage);
      errorMessage = parsed.error || errorMessage;
    } catch {}
    
    const isNotConfigured = errorMessage.toLowerCase().includes('not configured') || 
                            errorMessage.toLowerCase().includes('set up');
    if (isNotConfigured) {
      toast({
        title: "SMS error",
        description: "SMS could not be sent. Please try again later.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Couldn't send notification",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const DURATION_OPTIONS = [
    { value: '45', label: '30-60 mins', minutes: 45 },
    { value: '90', label: '1-2 hours', minutes: 90 },
    { value: '240', label: 'Half day', minutes: 240 },
    { value: '480', label: 'Full day', minutes: 480 },
    { value: '960', label: 'Multi-day', minutes: 960 },
  ];

  const getDurationLabel = (minutes: number): string => {
    const option = DURATION_OPTIONS.find(o => o.minutes === minutes);
    if (option) return option.label;
    if (minutes < 60) return `${minutes} mins`;
    if (minutes < 480) return `${Math.round(minutes / 60)} hours`;
    return `${Math.round(minutes / 480)} day(s)`;
  };

  // On My Way mutation - updates worker status and sends SMS to client
  const onMyWayMutation = useMutation({
    mutationFn: async () => {
      const etaMinutes = selectedDurationEstimate ? parseInt(selectedDurationEstimate) : undefined;
      const etaLabel = etaMinutes ? getDurationLabel(etaMinutes) : '30-60 mins';
      return await apiRequest("PATCH", `/api/jobs/${jobId}/worker-status`, {
        workerStatus: 'on_my_way',
        workerEta: etaLabel,
        workerEtaMinutes: etaMinutes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      setSelectedDurationEstimate('');
      toast({
        title: "On My Way - client notified",
        description: "SMS sent with tracking link",
      });
    },
    onError: handleSmsError,
  });

  // Arrived mutation - updates worker status to arrived
  const arrivedMutation = useMutation({
    mutationFn: async () => {
      const etaMinutes = selectedDurationEstimate ? parseInt(selectedDurationEstimate) : undefined;
      const etaLabel = etaMinutes ? getDurationLabel(etaMinutes) : undefined;
      return await apiRequest("PATCH", `/api/jobs/${jobId}/worker-status`, {
        workerStatus: 'arrived',
        workerEtaMinutes: etaMinutes,
        workerEta: etaLabel,
      });
    },
    onSuccess: async (res: Response) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      setSelectedDurationEstimate('');
      let data: any = null;
      try { data = await res.json(); } catch {}
      if (data?.smsErrorCode === 'DEDICATED_NUMBER_REQUIRED') {
        toast({
          title: "Arrived — status updated",
          description: GET_NUMBER_TOAST.description,
          action: (
            <ToastAction altText="Get number" onClick={() => navigate(GET_NUMBER_URL)}>
              Get number
            </ToastAction>
          ),
        });
        return;
      }
      toast({
        title: data?.smsFailed ? "Arrived — status updated (SMS not sent)" : "Arrived - client notified",
      });
    },
    onError: handleSmsError,
  });

  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [portalSettings, setPortalSettings] = useState({
    showTimeline: true,
    showPhotos: true,
    showChecklist: true,
    showActivityFeed: true,
    showFinancialsOnPortal: false,
    showProgrammeOnPortal: false,
    clientMessage: '' as string,
  });
  const [showPortalControls, setShowPortalControls] = useState(false);
  const [portalMessageDraft, setPortalMessageDraft] = useState('');
  const [elapsedTime, setElapsedTime] = useState('');

  useEffect(() => {
    if (!job?.workerStatusUpdatedAt || !['on_my_way', 'arrived'].includes(job?.workerStatus || '')) {
      setElapsedTime('');
      return;
    }
    const updateTimer = () => {
      const diff = Date.now() - new Date(job.workerStatusUpdatedAt!).getTime();
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      if (mins > 60) {
        const hrs = Math.floor(mins / 60);
        setElapsedTime(`${hrs}h ${mins % 60}m`);
      } else {
        setElapsedTime(`${mins}m ${secs}s`);
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [job?.workerStatusUpdatedAt, job?.workerStatus]);

  const portalFetchedRef = useRef<string | false>(false);
  useEffect(() => {
    if (job?.portalEnabled && jobId && portalFetchedRef.current !== jobId) {
      portalFetchedRef.current = jobId;
      const token = getSessionToken();
      fetch(`/api/jobs/${jobId}/portal-links`, {
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
      }).then(res => res.ok ? res.json() : []).then((tokens: any[]) => {
        if (tokens && tokens.length > 0) {
          const activeToken = tokens.find((t: any) => !t.revokedAt);
          if (activeToken) {
            const baseUrl = window.location.origin;
            setPortalUrl(`${baseUrl}/p/${activeToken.token}`);
            setPortalSettings({
              showTimeline: activeToken.showTimeline !== false,
              showPhotos: activeToken.showPhotos !== false,
              showChecklist: activeToken.showChecklist !== false,
              showActivityFeed: activeToken.showActivityFeed !== false,
              showFinancialsOnPortal: activeToken.showFinancialsOnPortal === true,
              showProgrammeOnPortal: activeToken.showProgrammeOnPortal === true,
              clientMessage: activeToken.clientMessage || '',
            });
            setPortalMessageDraft(activeToken.clientMessage || '');
          }
        }
      }).catch(() => { portalFetchedRef.current = false; });
    }
  }, [job?.portalEnabled, jobId]);

  // Portal link mutation - generates client tracking link
  const portalLinkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/portal-link`);
      const json = await res.json();
      return json;
    },
    onSuccess: (data: any) => {
      if (data.url) {
        setPortalUrl(data.url);
        setShowShareDialog(true);
      } else if (data.token?.token) {
        const baseUrl = window.location.origin;
        setPortalUrl(`${baseUrl}/p/${data.token.token}`);
        setShowShareDialog(true);
      }
    },
  });

  const portalSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<typeof portalSettings>) => {
      const res = await apiRequest("PATCH", `/api/jobs/${jobId}/portal-settings`, settings);
      return await res.json();
    },
    onSuccess: (data: any) => {
      if (data.showTimeline !== undefined) {
        setPortalSettings(prev => ({
          ...prev,
          showTimeline: data.showTimeline !== false,
          showPhotos: data.showPhotos !== false,
          showChecklist: data.showChecklist !== false,
          showActivityFeed: data.showActivityFeed !== false,
          showFinancialsOnPortal: data.showFinancialsOnPortal === true,
          showProgrammeOnPortal: data.showProgrammeOnPortal === true,
          clientMessage: data.clientMessage || '',
        }));
      }
      toast({ title: "Portal settings updated" });
    },
    onError: () => {
      toast({ title: "Failed to update portal settings", variant: "destructive" });
    },
  });

  // Running Late mutation - sends SMS to client when past scheduled time
  const runningLateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/jobs/${jobId}/running-late`);
    },
    onSuccess: () => {
      toast({
        title: "Running Late notification sent to client",
      });
    },
    onError: handleSmsError,
  });

  const isLoading = jobLoading || clientLoading;

  // Initialize smart actions when job and client are loaded
  const initializeSmartActions = () => {
    if (job && client) {
      const actions = getJobSmartActions(job, client, linkedQuote, linkedInvoice);
      setSmartActions(actions);
      setShowSmartActions(true);
    }
  };

  const handleActionToggle = (actionId: string, enabled: boolean) => {
    setSmartActions(prev => prev.map(a => 
      a.id === actionId ? { ...a, enabled } : a
    ));
  };

  const handleActionPreview = (actionId: string) => {
    const action = smartActions.find(a => a.id === actionId);
    if (action) {
      toast({
        title: `Preview: ${action.title}`,
        description: action.preview?.message || action.description,
      });
    }
  };

  const handleActionEdit = (actionId: string) => {
    const action = smartActions.find(a => a.id === actionId);
    if (action && (action.type === 'send_email' || action.type === 'send_confirmation')) {
      setEditingAction(action);
      setEmailEditorOpen(true);
    } else {
      toast({
        title: "Edit Action",
        description: "This action type doesn't have an editable template",
      });
    }
  };

  const handleSaveEmailTemplate = (template: EmailTemplate) => {
    if (editingAction) {
      setEmailTemplates(prev => ({
        ...prev,
        [editingAction.id]: template
      }));
      
      setSmartActions(prev => prev.map(a => 
        a.id === editingAction.id 
          ? { 
              ...a, 
              preview: {
                ...a.preview,
                subject: template.subject,
                message: template.body,
              }
            } 
          : a
      ));
      
      setEditingAction(null);
    }
  };

  const handleExecuteActions = async () => {
    setIsExecutingActions(true);
    const enabledActions = smartActions.filter(a => a.enabled && !a.missingRequirements?.length);
    
    for (const action of enabledActions) {
      setSmartActions(prev => prev.map(a => 
        a.id === action.id ? { ...a, status: 'running' } : a
      ));

      try {
        if (action.type === 'create_invoice') {
          navigate(`/invoices/new?jobId=${jobId}`);
          setSmartActions(prev => prev.map(a => 
            a.id === action.id ? { ...a, status: 'completed' } : a
          ));
        } else if (action.type === 'send_email' || action.type === 'send_confirmation') {
          setSmartActions(prev => prev.map(a => 
            a.id === action.id ? { ...a, status: 'completed' } : a
          ));
        }
      } catch (error) {
        setSmartActions(prev => prev.map(a => 
          a.id === action.id ? { ...a, status: 'suggested' } : a
        ));
      }
    }

    setIsExecutingActions(false);
  };

  const handleSkipAll = () => {
    setSmartActions(prev => prev.map(a => ({ ...a, enabled: false, status: 'skipped' })));
    setShowSmartActions(false);
    toast({
      title: "Actions skipped",
      description: "You can always do these later from the job details",
    });
  };

  // ── Tab navigation ────────────────────────────────────────────────────────
  const activeTab = useMemo(() => {
    const isProjectLocal = (job as any)?.jobType === 'project';
    const params = new URLSearchParams(tabSearch || '');
    const tab = params.get('tab');
    if (tab === 'claims') return isProjectLocal ? 'phases' : 'overview';
    const valid = isProjectLocal
      ? ['overview', 'phases', 'activity', 'financials', 'docs', 'chat']
      : ['overview', 'activity', 'financials', 'docs', 'chat'];
    return valid.includes(tab || '') ? tab! : 'overview';
  }, [tabSearch, job]);

  const handleTabChange = useCallback((tab: string) => {
    if (tab === 'chat') { navigate(`/chat?job=${jobId}`); return; }
    // Push a new history entry so browser back/forward navigate between tabs.
    // We update tabSearch optimistically so the tab switch is instant (no flicker),
    // and the popstate listener keeps tabSearch in sync on back/forward.
    const newSearch = `?tab=${tab}`;
    window.history.pushState(null, '', `/jobs/${jobId}${newSearch}`);
    setTabSearch(newSearch);
  }, [navigate, jobId]);

  if (isLoading) {
    return (
      <PageShell data-testid="job-detail-loading">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="animate-pulse">
            <div className="h-6 w-48 bg-muted rounded mb-2" />
            <div className="h-4 w-32 bg-muted rounded" />
          </div>
        </div>
      </PageShell>
    );
  }

  const groupActivitiesByDate = (activities: JobActivityItem[]) => {
    const groups: { date: string; label: string; activities: JobActivityItem[] }[] = [];
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    activities.forEach(activity => {
      const actDate = new Date(activity.timestamp);
      const dateKey = actDate.toDateString();

      let label: string;
      if (dateKey === today.toDateString()) label = 'Today';
      else if (dateKey === yesterday.toDateString()) label = 'Yesterday';
      else label = format(actDate, 'EEE, d MMM');

      const existing = groups.find(g => g.date === dateKey);
      if (existing) {
        existing.activities.push(activity);
      } else {
        groups.push({ date: dateKey, label, activities: [activity] });
      }
    });

    return groups;
  };

  // ── Retention ledger card (computed before return; uses top-level state/hooks) ──
  const retentionStatusConfig = {
    no_retention:     { label: 'No retention held',                color: 'text-muted-foreground',                            bg: 'bg-muted' },
    pre_pc:           { label: 'Pre-completion, retention held',  color: 'text-amber-700 dark:text-amber-400',               bg: 'bg-amber-50 dark:bg-amber-950/30' },
    in_dlp:           { label: 'Practical completion reached',    color: 'text-blue-700 dark:text-blue-400',                 bg: 'bg-blue-50 dark:bg-blue-950/30' },
    dlp_ended:        { label: 'DLP ended, retention due',        color: 'text-green-700 dark:text-green-400',               bg: 'bg-green-50 dark:bg-green-950/30' },
    release_pending:  { label: 'Release claim in progress',       color: 'text-orange-700 dark:text-orange-400',             bg: 'bg-orange-50 dark:bg-orange-950/30' },
    released:         { label: 'Released',                        color: 'text-muted-foreground',                            bg: 'bg-muted' },
  } as const;

  const handleSaveRetention = async () => {
    setRetentionSaving(true);
    try {
      await apiRequest('PATCH', `/api/jobs/${jobId}`, {
        retentionPercent: retentionPercent || '0',
        practicalCompletionDate: retentionPcDate || null,
        defectsLiabilityMonths: parseInt(retentionDlpMonths) || 12,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'profitability'] });
      setRetentionEditMode(false);
    } catch (err: any) {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
    } finally {
      setRetentionSaving(false);
    }
  };

  const handleReleaseRetention = async () => {
    const rs = jobProfitabilityData?.retentionSummary;
    if (!rs?.outstandingRetention || rs.outstandingRetention <= 0) return;
    if (retentionReleasing) return; // in-flight guard (double-click / concurrent tab)
    // Client-side hint: server will enforce the real 409 guard atomically
    if (rs.hasReleasePending) {
      toast({ title: 'Release already in progress', description: 'A Retention Release claim already exists. Review and approve it first.', variant: 'destructive' });
      return;
    }
    setRetentionReleasing(true);
    try {
      const amountStr = rs.outstandingRetention.toFixed(2);
      const response = await apiRequest('POST', `/api/jobs/${jobId}/claims`, {
        claimDate: new Date().toISOString().split('T')[0],
        retentionPercent: '0.00',
        notes: 'Retention Release',
        lineItems: [{
          description: 'Retention Release',
          contractValue: amountStr,
          previouslyClaimed: '0.00',
          thisClaim: amountStr,
          retentionPercent: '0.00',
          sortOrder: 0,
        }],
      });
      const data = await response.json();
      toast({ title: 'Retention Release claim created', description: 'Draft claim created — review and submit.' });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'claims'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'profitability'] });
      if (data?.claim?.id) {
        navigate(`/jobs/${jobId}?tab=claims`);
      }
    } catch (err: any) {
      // 409 means a concurrent release got in first — refresh the summary so the UI reflects it
      if (err?.message?.includes('409') || err?.status === 409) {
        toast({ title: 'Release already exists', description: 'A Retention Release claim was created by another session. Refreshing…', variant: 'destructive' });
        queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'profitability'] });
      } else {
        toast({ title: 'Failed to create release claim', description: err.message, variant: 'destructive' });
      }
    } finally {
      setRetentionReleasing(false);
    }
  };

  const retentionCard = (!isTradie && (job as any)?.jobType === 'project') ? (() => {
    const rs = jobProfitabilityData?.retentionSummary;
    const rsStatus = (rs?.retentionStatus ?? 'no_retention') as keyof typeof retentionStatusConfig;
    const rsCfg = retentionStatusConfig[rsStatus] ?? retentionStatusConfig.no_retention;
    const outstanding = rs?.outstandingRetention ?? rs?.sumRetentionHeld ?? 0;
    // A release claim becomes available as soon as practical completion is recorded.
    const canRelease = outstanding > 0 && (rsStatus === 'in_dlp' || rsStatus === 'dlp_ended') && !retentionEditMode;

    return (
      <Card data-testid="card-retention-ledger">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
              <CardTitle className="text-sm font-medium">Retention</CardTitle>
            </div>
            {!retentionEditMode && (
              <Button size="sm" variant="ghost" onClick={() => {
                setRetentionPcDate((job as any)?.practicalCompletionDate ?? '');
                setRetentionDlpMonths(String((job as any)?.defectsLiabilityMonths ?? 12));
                setRetentionPercent(String((job as any)?.retentionPercent ?? 0));
                setRetentionEditMode(true);
              }}>
                <Edit className="h-3.5 w-3.5 mr-1" />
                Edit dates
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {/* Primary figure: outstanding (held − released) */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Retention held to date</span>
            <span className="text-sm font-semibold">
              {rs ? `$${outstanding.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
            </span>
          </div>
          {/* Show total withheld separately when some has been released */}
          {rs && rs.sumRetentionHeld > outstanding && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total withheld</span>
              <span className="text-sm text-muted-foreground">
                ${rs.sumRetentionHeld.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {retentionEditMode ? (
            <div className="space-y-3 border rounded-md p-3 bg-muted/30">
              <div className="space-y-1">
                <Label className="text-xs">Retention %</Label>
                <Input type="number" min={0} max={100} step="0.01" value={retentionPercent} onChange={e => setRetentionPercent(e.target.value)} className="h-8 text-sm" />
                <p className="text-xs text-muted-foreground">Used as the default for new progress claims.</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Practical Completion Date</Label>
                <Input type="date" value={retentionPcDate} onChange={e => setRetentionPcDate(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Defects Liability Period (months)</Label>
                <Input type="number" min={0} max={60} value={retentionDlpMonths} onChange={e => setRetentionDlpMonths(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveRetention} disabled={retentionSaving}>
                  {retentionSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRetentionEditMode(false)} disabled={retentionSaving}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Contract retention rate</span>
                <span className="text-sm">{Number((job as any)?.retentionPercent ?? 0).toFixed(2)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Practical completion</span>
                <span className="text-sm">
                  {(job as any)?.practicalCompletionDate
                    ? format(new Date((job as any).practicalCompletionDate), 'dd MMM yyyy')
                    : <span className="text-muted-foreground italic">Not set</span>}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">DLP period</span>
                <span className="text-sm">{(job as any)?.defectsLiabilityMonths ?? 12} months</span>
              </div>
              {rs?.releaseDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Retention due date</span>
                  <span className="text-sm">{format(new Date(rs.releaseDate), 'dd MMM yyyy')}</span>
                </div>
              )}
            </>
          )}

          {rs !== undefined && (
            <div className={`rounded-md px-3 py-1.5 ${rsCfg.bg}`}>
              <span className={`text-xs font-medium ${rsCfg.color}`}>{rsCfg.label}</span>
            </div>
          )}

          {/* All defects cleared — reactive indicator driven by defectItemsForRetention query */}
          {defectItemsForRetention.length > 0 &&
            defectItemsForRetention.every((d: any) => d.status === 'resolved' || d.status === 'client_approved') && (
            <div className="flex items-center gap-2 px-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
              <span className="text-xs text-green-700 dark:text-green-300 font-medium">All defects cleared</span>
            </div>
          )}

          {/* Release button — only when retention is outstanding and no release pending */}
          {canRelease && (
            <Button size="sm" variant="outline" className="w-full" onClick={handleReleaseRetention} disabled={retentionReleasing}>
              {retentionReleasing
                ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                : <Banknote className="h-3.5 w-3.5 mr-1.5" />}
              {retentionReleasing ? 'Creating claim…' : `Release Retention ($${outstanding.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
            </Button>
          )}
          {/* Pending release — show link to claim instead of button */}
          {rs?.hasReleasePending && rs.releasePendingClaimId && !retentionEditMode && (
            <Button size="sm" variant="ghost" className="w-full text-muted-foreground" onClick={() => navigate(`/jobs/${jobId}?tab=claims`)}>
              <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
              Release claim pending review — view claim
            </Button>
          )}
        </CardContent>
      </Card>
    );
  })() : null;

  if (jobError || !job) {
    return (
      <PageShell data-testid="job-detail-error">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Job Not Found</h1>
            <p className="text-sm text-muted-foreground">This job may have been deleted</p>
          </div>
        </div>
      </PageShell>
    );
  }


  const isProject = job.jobType === 'project';
  const isServiceCall = !isProject;

  const SERVICE_STEPS = [
    { status: 'scheduled' as const, label: 'Scheduled' },
    { status: 'in_progress' as const, label: 'In Progress' },
    { status: 'done' as const, label: 'Complete' },
    { status: 'invoiced' as const, label: 'Invoiced' },
  ];
  const STATUS_ORDER: Record<string, number> = { pending: -1, scheduled: 0, in_progress: 1, done: 2, invoiced: 3 };
  const currentStatusOrder = STATUS_ORDER[job.status] ?? -1;

  const tabConfig = isProject ? [
    { id: 'overview', label: 'Overview', icon: <Briefcase className="h-4 w-4" /> },
    { id: 'phases', label: 'Phases', icon: <Layers className="h-4 w-4" />, badge: jobPhasesForPicker.length > 0 ? String(jobPhasesForPicker.length) : undefined },
    { id: 'activity', label: 'Activity', icon: <Camera className="h-4 w-4" /> },
    { id: 'financials', label: 'Financials', icon: <DollarSign className="h-4 w-4" /> },
    { id: 'docs', label: 'Docs & Safety', icon: <Shield className="h-4 w-4" /> },
    { id: 'chat', label: 'Chat', icon: <MessageSquare className="h-4 w-4" /> },
  ] : [
    { id: 'overview', label: 'Overview', icon: <Briefcase className="h-4 w-4" /> },
    { id: 'activity', label: 'Activity', icon: <Camera className="h-4 w-4" /> },
    { id: 'financials', label: 'Financials', icon: <DollarSign className="h-4 w-4" /> },
    { id: 'docs', label: 'Docs & Safety', icon: <Shield className="h-4 w-4" /> },
    { id: 'chat', label: 'Chat', icon: <MessageSquare className="h-4 w-4" /> },
  ];

  return (
    <PageShell data-testid="job-detail-view">

      {/* ─── HEADER ─── */}
      <div className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-1 min-w-0">
            <Button variant="ghost" size="icon" className="-ml-2 shrink-0 mt-0.5" onClick={onBack} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 group cursor-pointer" onClick={handleOpenRenameDialog} title="Click to rename">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">{job.title}</h1>
                <Edit className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                {/* Status badge */}
                {(() => {
                  const statusLabels: Record<string, string> = { pending: 'Pending', scheduled: 'Scheduled', in_progress: 'In Progress', done: 'Complete', invoiced: 'Invoiced' };
                  const statusColors: Record<string, string> = {
                    pending: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                    scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                    in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                    done: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
                    invoiced: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
                  };
                  return (
                    <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[job.status] || statusColors.pending}`}>
                      {statusLabels[job.status] || job.status}
                    </span>
                  );
                })()}
                {/* Type badge */}
                {isProject ? (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800" data-testid="badge-job-type-project">Project</span>
                ) : (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" data-testid="badge-job-type-service-call">Service Call</span>
                )}
                {/* Client name */}
                {client?.name && (
                  <span
                    className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline cursor-pointer transition-colors"
                    onClick={(e) => { e.stopPropagation(); job.clientId && onViewClient?.(job.clientId); }}
                    data-testid="link-client"
                  >{client.name}</span>
                )}
                {/* Job number */}
                {(job as any).jobNumber && (
                  <span className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border select-all">
                    {(job as any).jobNumber}
                  </span>
                )}
                <PresenceIndicator editors={collaboration.otherEditors} />
                <ImportOriginBadge importRunId={(job as any).importRunId} rowNumber={(job as any).importRowNumber} />
              </div>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {onEditJob && (
              <Button variant="outline" size="sm" className="gap-1.5 hidden sm:flex" onClick={() => onEditJob(jobId)} data-testid="button-edit-job">
                <Edit className="h-4 w-4" />Edit
              </Button>
            )}
            {onEditJob && (
              <Button variant="outline" size="icon" className="h-9 w-9 sm:hidden" onClick={() => onEditJob(jobId)}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {!isTradie && (
              linkedInvoice ? (
                <Button size="sm" className="gap-1.5 hidden sm:flex" onClick={() => navigate(`/invoices/${linkedInvoice.id}`)}>
                  <Receipt className="h-4 w-4" />Invoice
                </Button>
              ) : (job.status === 'done' || job.status === 'invoiced') ? (
                <Button size="sm" className="gap-1.5 hidden sm:flex" onClick={() => onCreateInvoice?.(jobId)}>
                  <Receipt className="h-4 w-4" />Invoice
                </Button>
              ) : linkedQuote ? (
                <Button size="sm" variant="outline" className="gap-1.5 hidden sm:flex" onClick={() => navigate(`/quotes/${linkedQuote.id}`)}>
                  <FileText className="h-4 w-4" />Quote
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="gap-1.5 hidden sm:flex" onClick={() => onCreateQuote?.(jobId)}>
                  <FileText className="h-4 w-4" />Quote
                </Button>
              )
            )}
            {!isTradie && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9" data-testid="button-job-actions-menu">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleOpenInviteModal} data-testid="button-invite">
                    <UserPlus className="h-4 w-4 mr-2" />Invite Subcontractor
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => cloneJobMutation.mutate()} disabled={cloneJobMutation.isPending} data-testid="button-duplicate-job">
                    {cloneJobMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Copy className="h-4 w-4 mr-2" />}
                    Duplicate Job
                  </DropdownMenuItem>
                  {isProject && (
                    <DropdownMenuItem onClick={() => { setSaveTemplateName(job?.title || ''); setShowSaveTemplateDialog(true); }} data-testid="button-save-project-template">
                      <Layers className="h-4 w-4 mr-2" />Save as Project Template
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setProofPackPreviewOpen(true)} data-testid="button-proof-pack">
                    <FileDown className="h-4 w-4 mr-2" />Proof Pack
                  </DropdownMenuItem>
                  {canUseAIFeatures && job && client && (
                    <DropdownMenuItem onClick={initializeSmartActions}>
                      <Sparkles className="h-4 w-4 mr-2" />Smart Actions
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleDeleteJob} disabled={deleteJobMutation.isPending} className="text-destructive focus:text-destructive" data-testid="button-delete-job">
                    {deleteJobMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    Delete Job
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Status stepper (service calls, non-tradie, non-pending) */}
        {isServiceCall && job.status !== 'pending' && !isTradie && (
          <div className="flex items-center mt-3 overflow-x-auto" data-testid="status-stepper">
            {SERVICE_STEPS.map((step, idx) => {
              const stepOrder = STATUS_ORDER[step.status] ?? 0;
              const isCompleted = stepOrder < currentStatusOrder;
              const isActive = step.status === job.status;
              return (
                <div key={step.status} className="flex items-center flex-1 last:flex-none min-w-0">
                  <button
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                      isActive ? 'text-white' : isCompleted ? 'text-green-600 dark:text-green-400 hover:text-green-700' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    style={isActive ? { backgroundColor: 'hsl(var(--trade))' } : undefined}
                    onClick={() => {
                      if (isActive) return;
                      if (isCompleted) { setRollbackTargetStatus(step.status); setShowRollbackConfirm(true); }
                      else if (step.status === 'in_progress') setShowSafetyCheck(true);
                      else if (step.status === 'done') handleCompleteJob();
                      else if (step.status === 'invoiced') onCreateInvoice?.(jobId);
                      else updateJobMutation.mutate({ status: step.status });
                    }}
                  >
                    {isCompleted ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : isActive ? <div className="h-2 w-2 rounded-full bg-white shrink-0" /> : <Circle className="h-3 w-3 shrink-0" />}
                    <span className="ml-1">{step.label}</span>
                  </button>
                  {idx < SERVICE_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 ${stepOrder < currentStatusOrder ? 'bg-green-400' : 'bg-border'}`} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Project phase progress bar */}
        {isProject && jobPhasesForPicker.length > 0 && (() => {
          const total = jobPhasesForPicker.length;
          const completedCount = jobPhasesForPicker.filter(p => p.status === 'complete' || p.status === 'invoiced').length;
          const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
          return (
            <div className="mt-3" data-testid="phase-progress-bar">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="flex items-center gap-1.5 text-muted-foreground"><Layers className="h-3 w-3" />Phase progress</span>
                <span className="font-medium">{completedCount} / {total} complete ({pct}%)</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: 'hsl(var(--trade))' }} />
              </div>
            </div>
          );
        })()}
      </div>

      {/* ─── BANNERS ─── */}
      <div className="space-y-3 mb-4">
        {/* Loss warning */}
        {!isTradie && jobProfitabilityData?.profit?.isNegative && (
          <div className="rounded-xl p-4 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/50 shrink-0"><AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" /></div>
              <div>
                <p className="font-semibold text-red-700 dark:text-red-300">Job running at a loss</p>
                <p className="text-sm text-red-600/80 dark:text-red-400/80">Margin: {jobProfitabilityData.profit.margin.toFixed(1)}% — review costs in the Financials tab.</p>
              </div>
            </div>
          </div>
        )}
        {/* Labour overrun */}
        {!isTradie && jobProfitabilityData?.labourOverrun && (
          <div className="rounded-xl p-4 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/50 shrink-0"><AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" /></div>
              <div>
                <p className="font-semibold text-amber-700 dark:text-amber-300">Labour hours over estimate</p>
                <p className="text-sm text-amber-600/80 dark:text-amber-400/80">{jobProfitabilityData.hours.total.toFixed(1)} hrs logged vs {jobProfitabilityData.hours.estimated?.toFixed(1) ?? '—'} hrs estimated.</p>
              </div>
            </div>
          </div>
        )}
        {/* Urgency */}
        {job.status === 'scheduled' && jobUrgency && !activeTimerForThisJob && (
          <div className={`rounded-xl p-4 border ${jobUrgency.bgColor} ${jobUrgency.animate ? 'animate-pulse' : ''}`} data-testid="banner-job-urgency">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${jobUrgency.level === 'overdue' ? 'bg-red-200 dark:bg-red-800' : 'bg-orange-200 dark:bg-orange-800'}`}>
                  <Clock className={`h-5 w-5 ${jobUrgency.color}`} />
                </div>
                <div>
                  <p className={`font-semibold ${jobUrgency.color}`}>{jobUrgency.label}</p>
                  <p className="text-sm text-muted-foreground">{jobUrgency.level === 'overdue' ? 'This job is past its scheduled time' : 'Ready to start?'}</p>
                </div>
              </div>
              <Button onClick={() => setShowSafetyCheck(true)} disabled={updateJobMutation.isPending} className="text-white shrink-0" style={{ backgroundColor: 'hsl(var(--trade))' }} data-testid="button-quick-start">
                <Play className="h-4 w-4 mr-2" />Start Now
              </Button>
            </div>
          </div>
        )}
        {/* Active timer banner */}
        {job.status === 'in_progress' && activeTimerForThisJob && (
          <div className="rounded-xl overflow-hidden relative" style={{ backgroundColor: 'hsl(var(--trade) / 0.15)' }} data-testid="banner-active-timer">
            <div className="absolute inset-0 rounded-xl" style={{ border: '2px solid hsl(var(--trade))', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
            <div className="relative p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="p-3 rounded-full animate-pulse" style={{ backgroundColor: 'hsl(var(--trade) / 0.2)' }}>
                  <Timer className="h-6 w-6" style={{ color: 'hsl(var(--trade))' }} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'hsl(var(--trade))' }} />
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--trade))' }}>Timer Running</span>
                  </div>
                  <div className="text-3xl font-mono font-bold tracking-wider" style={{ color: 'hsl(var(--trade))' }} data-testid="text-live-timer">{getElapsedTime(activeTimerForThisJob.startTime)}</div>
                </div>
              </div>
              <Button variant="destructive" onClick={() => stopTimerMutation.mutate(activeTimerForThisJob.id)} disabled={stopTimerMutation.isPending} className="h-12 px-6" data-testid="button-stop-timer-banner">
                <Square className="h-4 w-4 mr-2" />{stopTimerMutation.isPending ? 'Saving...' : 'Clock Out'}
              </Button>
            </div>
          </div>
        )}
        {/* No-timer prompt */}
        {job.status === 'in_progress' && !activeTimerForThisJob && !globalActiveTimer && (
          <div className="rounded-xl p-4 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30" data-testid="banner-no-timer">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-amber-200 dark:bg-amber-800"><Timer className="h-5 w-5 text-amber-600 dark:text-amber-400" /></div>
                <div>
                  <p className="font-semibold text-amber-700 dark:text-amber-300">Timer not running</p>
                  <p className="text-sm text-muted-foreground">Start tracking time for this job</p>
                </div>
              </div>
              <Button onClick={() => { setPendingTimerStart(true); setShowBeforePhotoPrompt(true); }} disabled={startTimerMutation.isPending} className="text-white shrink-0" style={{ backgroundColor: 'hsl(var(--trade))' }} data-testid="button-start-timer-banner">
                <Play className="h-4 w-4 mr-2" />{startTimerMutation.isPending ? 'Starting...' : 'Start Timer'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ─── TABS ─── */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        {/* Sticky tab strip */}
        <div className="sticky top-0 z-20 -mx-4 sm:-mx-5 md:-mx-6 lg:-mx-8 px-4 sm:px-5 md:px-6 lg:px-8 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
          <TabsList data-testid="tab-strip" className="h-auto bg-transparent rounded-none p-0 w-full justify-start gap-0 flex overflow-x-auto">
            {tabConfig.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                data-testid={`tab-${tab.id}`}
                className="relative flex items-center gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0"
              >
                {tab.icon}
                <span>{tab.label}</span>
                {'badge' in tab && tab.badge && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 ml-0.5">{tab.badge}</Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ─── Two-column grid: main content + persistent sidebar ─── */}
        {/* On the Phases tab the sidebar is hidden so the gantt/phases content gets full width */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-8 mt-6 space-y-6 lg:space-y-0">

          {/* ═══ MAIN CONTENT COLUMN ═══ */}
          <div className={`${activeTab === 'phases' ? 'lg:col-span-12' : 'lg:col-span-8'} flex flex-col gap-6`}>

            {/* ── OVERVIEW TAB ── */}
            <TabsContent value="overview" className="mt-0 space-y-6">

              {/* Worker dispatch status timeline */}
              {(job.status === 'scheduled' || job.status === 'in_progress' || job.status === 'pending') && job.clientId && (
                <div className="rounded-xl border border-border bg-card" data-testid="worker-status-controls">
                  <div className="px-4 pt-4 pb-3">
                    {(() => {
                      const steps = [{ key: 'assigned', label: 'Assigned' }, { key: 'on_my_way', label: 'On My Way' }, { key: 'arrived', label: 'Arrived' }, { key: 'in_progress', label: 'Working' }, { key: 'completed', label: 'Done' }];
                      const statusOrder = ['assigned', 'on_my_way', 'arrived', 'in_progress', 'completed'];
                      const currentIdx = statusOrder.indexOf(job.workerStatus || 'assigned');
                      return (
                        <div className="flex items-center w-full">
                          {steps.map((step, idx) => {
                            const isCompleted = idx < currentIdx;
                            const isActive = idx === currentIdx;
                            return (
                              <div key={step.key} className="flex items-center flex-1 last:flex-none">
                                <div className="flex flex-col items-center gap-1">
                                  <div className={`h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center ${isCompleted ? 'bg-green-500 border-green-500' : isActive ? 'border-[hsl(var(--trade))] bg-[hsl(var(--trade))] animate-pulse' : 'border-muted-foreground/30 bg-transparent'}`}>
                                    {isCompleted && <Check className="h-2.5 w-2.5 text-white" />}
                                  </div>
                                  <span className={`text-[10px] leading-tight text-center whitespace-nowrap ${isCompleted ? 'text-green-600 dark:text-green-400 font-medium' : isActive ? 'font-semibold' : 'text-muted-foreground/50'}`}>{step.label}</span>
                                </div>
                                {idx < steps.length - 1 && <div className={`h-0.5 flex-1 mx-1 mt-[-14px] ${idx < currentIdx ? 'bg-green-500' : 'bg-muted-foreground/15'}`} />}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="px-4 pb-2 flex items-center gap-2 flex-wrap text-sm">
                    {client && <span className="flex items-center gap-1 text-muted-foreground"><User className="h-3.5 w-3.5" /><span className="font-medium text-foreground">{client.name}</span></span>}
                    {client && job.address && <span className="text-muted-foreground/40">|</span>}
                    {job.address && (
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-muted-foreground hover:text-foreground rounded px-1 -mx-1">
                        <MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate max-w-[200px]">{job.address}</span><ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                      </a>
                    )}
                  </div>
                  <div className="px-4 pb-3">
                    {(!job.workerStatus || job.workerStatus === 'assigned') && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                          <span className="text-sm font-medium">Ready to dispatch</span>
                          {isJobOverdue() && <Badge variant="destructive" className="text-[10px]">Overdue</Badge>}
                        </div>
                        <Button onClick={() => onMyWayMutation.mutate()} disabled={onMyWayMutation.isPending} className="w-full gap-2 text-white" style={{ backgroundColor: 'hsl(var(--trade))' }} data-testid="button-on-my-way">
                          {onMyWayMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                          <div className="flex flex-col items-start"><span>On My Way</span><span className="text-[10px] opacity-80 font-normal">Notify client you're heading out</span></div>
                        </Button>
                      </div>
                    )}
                    {job.workerStatus === 'on_my_way' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-sm font-medium">En route</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {elapsedTime && <Badge variant="secondary" className="text-xs gap-1 font-mono"><Clock className="h-3 w-3" />{elapsedTime} ago</Badge>}
                            {job.workerEta && <Badge variant="secondary" className="text-xs">ETA: {job.workerEta}</Badge>}
                          </div>
                        </div>
                        <Button onClick={() => arrivedMutation.mutate()} disabled={arrivedMutation.isPending} className="w-full gap-2 text-white" style={{ backgroundColor: 'hsl(var(--trade))' }} data-testid="button-arrived">
                          {arrivedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                          <div className="flex flex-col items-start"><span>Arrived</span><span className="text-[10px] opacity-80 font-normal">Mark arrival on site</span></div>
                        </Button>
                        <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground gap-1" onClick={() => runningLateMutation.mutate()} disabled={runningLateMutation.isPending} data-testid="button-running-late">
                          {runningLateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}Notify client I'm running late
                        </Button>
                      </div>
                    )}
                    {job.workerStatus === 'arrived' && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span className="text-sm font-medium">On site</span>
                        {elapsedTime && <Badge variant="secondary" className="text-xs gap-1 font-mono"><Clock className="h-3 w-3" />{elapsedTime} on site</Badge>}
                      </div>
                    )}
                    {job.workerStatus === 'completed' && (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-600" />
                        <span className="text-sm font-medium text-green-700 dark:text-green-400">Job completed by worker</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* JobCardSection */}
              <div><JobCardSection jobId={jobId} /></div>

              {/* Workflow action buttons */}
              <div className="flex flex-col gap-2">
                {job.status === 'pending' && (
                  <Button onClick={() => updateJobMutation.mutate({ status: 'scheduled' })} disabled={updateJobMutation.isPending} className="w-full text-white" style={{ backgroundColor: 'hsl(var(--trade))' }} data-testid="button-schedule-job">
                    <Calendar className="h-4 w-4 mr-2" />{updateJobMutation.isPending ? 'Scheduling...' : 'Schedule Job'}
                  </Button>
                )}
                {job.status === 'done' && (
                  <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400">
                    <CheckCircle className="h-5 w-5" /><span className="font-medium">Job Completed</span>
                  </div>
                )}
                {job.status === 'done' && !isTradie && (
                  <Button variant="outline" className="w-full gap-2" onClick={() => reopenJobMutation.mutate()} disabled={reopenJobMutation.isPending} data-testid="button-reopen-job">
                    <RotateCcw className="h-4 w-4" />{reopenJobMutation.isPending ? 'Re-opening...' : 'Re-open Job'}
                  </Button>
                )}
                <div className="flex flex-wrap gap-2 [&>button]:flex-1 [&>div]:flex-1">
                  {currentUser && !isSolo && (
                    <div ref={chatSectionRef} data-testid="section-job-chat" className="min-w-[70px]">
                      <Button variant="outline" className="w-full gap-1.5 px-2 text-xs h-9 bg-card hover:bg-accent" onClick={() => navigate(`/chat?job=${jobId}`)}>
                        <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate">Chat</span>
                      </Button>
                    </div>
                  )}
                  {client?.email && (
                    <Button variant="outline" className="gap-1.5 px-2 text-xs h-9 bg-card hover:bg-accent min-w-[70px]" onClick={() => { setUnifiedSendDefaultTab('email'); setShowUnifiedSendModal(true); }} data-testid="button-email-client">
                      <Mail className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate">Email</span>
                    </Button>
                  )}
                  {client?.phone && (
                    <Button variant="outline" className="gap-1.5 px-2 text-xs h-9 bg-card hover:bg-accent min-w-[70px]" onClick={() => { setUnifiedSendDefaultTab('sms'); setShowUnifiedSendModal(true); }} data-testid="button-sms-client">
                      <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate">SMS</span>
                    </Button>
                  )}
                  {job.status !== 'invoiced' && job.status !== 'pending' && (
                    <Button variant="outline" className="gap-1.5 px-2 text-xs h-9 bg-card hover:bg-accent min-w-[70px]" onClick={() => setShowSiteUpdateDialog(true)} data-testid="button-log-site-update">
                      <PenLine className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate">Update</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* JobFlowWizard */}
              <JobFlowWizard
                status={job.status}
                hasQuote={!!linkedQuote}
                hasInvoice={!!linkedInvoice}
                invoicePaid={linkedInvoice?.status === 'paid'}
                timestamps={{ scheduledAt: job.scheduledAt, startedAt: job.startedAt, completedAt: job.completedAt, invoicedAt: job.invoicedAt }}
                timerRunning={!!activeTimerForThisJob}
                onCreateQuote={() => onCreateQuote?.(jobId)}
                onViewQuote={() => linkedQuote && navigate(`/quotes/${linkedQuote.id}`)}
                onSchedule={() => onEditJob?.(jobId)}
                onStart={() => updateJobMutation.mutate({ status: 'in_progress' })}
                onComplete={onCompleteJob ? () => onCompleteJob(jobId) : handleCompleteJob}
                onCreateInvoice={!isTradie ? () => onCreateInvoice?.(jobId) : undefined}
                onViewInvoice={() => linkedInvoice && navigate(`/invoices/${linkedInvoice.id}`)}
                onStatusChange={(newStatus) => { setRollbackTargetStatus(newStatus); setShowRollbackConfirm(true); }}
              />

              {/* Phase Progress card — project jobs with phases */}
              {isProject && jobPhasesForPicker.length > 0 && !isTradie && (() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const AVATAR_COLORS = ['#4f7ddb','#e07b39','#5ba85f','#9b59b6','#e74c3c','#16a085','#d35400','#2c3e50'];
                const avatarColorFn = (id: string) => {
                  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
                  return AVATAR_COLORS[h % AVATAR_COLORS.length];
                };
                const initialsFn = (name: string) => {
                  const parts = name.trim().split(/\s+/);
                  if (parts.length === 1) return (parts[0][0] ?? '').toUpperCase();
                  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase();
                };
                const fmtD = (d?: string | null) => {
                  if (!d) return null;
                  try { return format(new Date(d), 'd MMM'); } catch { return null; }
                };
                const statusCfgMap: Record<string, { label: string; cls: string }> = {
                  not_started: { label: 'Not Started', cls: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
                  in_progress:  { label: 'In Progress',  cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
                  complete:     { label: 'Complete',     cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
                  invoiced:     { label: 'Invoiced',     cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
                };

                return (
                  <Card data-testid="card-phase-progress">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Layers className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                          Phase Progress
                        </CardTitle>
                        <button
                          onClick={() => handleTabChange('phases')}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          View all
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-1.5">
                      {jobPhasesForPicker.map((phase) => {
                        const isComplete = phase.status === 'complete' || phase.status === 'invoiced';
                        const budgeted = phase.budgetedHours ? parseFloat(phase.budgetedHours) : 0;
                        const actual = phase.actualHours ?? 0;
                        const isOverBudget = budgeted > 0 && actual > budgeted;
                        const isNearBudget = budgeted > 0 && actual >= budgeted * 0.8 && !isOverBudget;
                        const isOverdue = !isComplete && !!phase.scheduledEnd && new Date(phase.scheduledEnd) < today;
                        const pctUsed = budgeted > 0 ? Math.min((actual / budgeted) * 100, 100) : 0;
                        const barColor = isOverBudget ? 'hsl(var(--destructive))' : isNearBudget ? '#f59e0b' : 'hsl(var(--trade))';
                        const statusCfg = statusCfgMap[phase.status] ?? { label: phase.status, cls: 'bg-gray-100 text-gray-700' };
                        const phaseMembers =
                          phase.assignedUsers ??
                          (phase.assignedUserId
                            ? [{ id: phase.assignedUserId, name: phase.assignedUserName ?? '' }]
                            : []);

                        return (
                          <button
                            key={phase.id}
                            onClick={() => handleTabChange('phases')}
                            className="w-full text-left rounded-lg border bg-background hover:bg-muted/40 transition-colors p-2.5"
                            data-testid={`phase-progress-row-${phase.id}`}
                          >
                            {/* Top row: code, name, status, flags, avatars */}
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span
                                className="shrink-0 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border"
                                style={{ borderColor: 'hsl(var(--trade) / 0.4)', color: 'hsl(var(--trade))' }}
                              >
                                {phase.phaseCode}
                              </span>
                              <span className="text-sm font-medium flex-1 min-w-0 truncate">{phase.name}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${statusCfg.cls}`}>
                                {statusCfg.label}
                              </span>
                              {isOverdue && (
                                <span className="flex items-center gap-0.5 text-[10px] font-medium text-red-600 dark:text-red-400 shrink-0">
                                  <AlertTriangle className="h-3 w-3" />Overdue
                                </span>
                              )}
                              {isOverBudget && (
                                <span className="flex items-center gap-0.5 text-[10px] font-medium text-red-600 dark:text-red-400 shrink-0">
                                  <TrendingUp className="h-3 w-3" />Over budget
                                </span>
                              )}
                              {phaseMembers.length > 0 && (
                                <div className="flex -space-x-1 shrink-0">
                                  {phaseMembers.slice(0, 3).map((m) => (
                                    <span
                                      key={m.id}
                                      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[8px] font-bold text-white border border-background"
                                      style={{ backgroundColor: avatarColorFn(m.id) }}
                                    >
                                      {initialsFn(m.name)}
                                    </span>
                                  ))}
                                  {phaseMembers.length > 3 && (
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[8px] font-bold text-muted-foreground bg-muted border border-background">
                                      +{phaseMembers.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            {/* Second row: date range + hours progress bar */}
                            {(phase.scheduledStart || phase.scheduledEnd || budgeted > 0) && (
                              <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                                {(phase.scheduledStart || phase.scheduledEnd) && (
                                  <span className="shrink-0">
                                    {fmtD(phase.scheduledStart) ?? '?'} → {fmtD(phase.scheduledEnd) ?? '?'}
                                  </span>
                                )}
                                {budgeted > 0 && (
                                  <div className="flex-1 flex items-center gap-2 min-w-0">
                                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all duration-300"
                                        style={{ width: `${pctUsed}%`, backgroundColor: barColor }}
                                      />
                                    </div>
                                    <span className={`shrink-0 text-[10px] font-medium tabular-nums ${isOverBudget ? 'text-red-600 dark:text-red-400' : isNearBudget ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                                      {actual.toFixed(1)}/{budgeted.toFixed(1)}h
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Job Details card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Briefcase className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />Job Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {job.description && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                      <p className="text-sm whitespace-pre-wrap">{job.description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {client?.name && (
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1"><User className="h-3 w-3" />Client</div>
                        <p className="font-medium hover:underline cursor-pointer" onClick={() => job.clientId && onViewClient?.(job.clientId)} data-testid="client-name">{client.name}</p>
                      </div>
                    )}
                    {job.address && (
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1"><MapPin className="h-3 w-3" />Address</div>
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline inline-flex items-center gap-1">
                          {job.address}<ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                    )}
                    {job.scheduledAt && (
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1"><Calendar className="h-3 w-3" />Scheduled</div>
                        <Popover open={rescheduleOpen} onOpenChange={(open) => {
                          setRescheduleOpen(open);
                          if (open && job.scheduledAt) { const d = new Date(job.scheduledAt); setRescheduleDate(d); setRescheduleTime(format(d, 'HH:mm')); }
                        }}>
                          <PopoverTrigger asChild>
                            <button className="text-left hover:bg-muted/50 rounded-md p-1 -m-1 transition-colors group">
                              <p className="font-medium group-hover:text-primary">{format(new Date(job.scheduledAt), 'MMM d, yyyy')}</p>
                              <p className="text-xs text-muted-foreground">{format(new Date(job.scheduledAt), 'h:mm a')}</p>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarWidget mode="single" selected={rescheduleDate} onSelect={setRescheduleDate} initialFocus />
                            <div className="p-3 border-t space-y-3">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <Input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} className="flex-1" />
                              </div>
                              <Button className="w-full" disabled={!rescheduleDate || updateJobMutation.isPending} onClick={() => {
                                if (!rescheduleDate) return;
                                const [hours, minutes] = rescheduleTime.split(':').map(Number);
                                const newDate = new Date(rescheduleDate);
                                newDate.setHours(hours, minutes, 0, 0);
                                updateJobMutation.mutate({ scheduledAt: newDate.toISOString() }, { onSuccess: () => setRescheduleOpen(false) });
                              }}>
                                {updateJobMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calendar className="h-4 w-4 mr-2" />}Confirm Reschedule
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </div>

                  {/* Assign Workers / Manage Team */}
                  {!isTradie && !isSolo && teamMembers.length > 0 && (
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-semibold">{isProject ? "Team" : "Assign Workers"}</span>
                        </div>
                        {isProject && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => setShowTeamModal(true)}
                            data-testid="button-manage-team"
                          >
                            <Users className="h-3 w-3" />
                            Manage Team
                          </Button>
                        )}
                      </div>
                      {/* Service call: show full worker picker combobox */}
                      {!isProject && (
                        <Popover open={workerPopoverOpen} onOpenChange={setWorkerPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-expanded={workerPopoverOpen} className="w-full justify-between font-normal h-auto min-h-9 py-2 text-left" disabled={assignBusy} data-testid="select-assign-worker">
                              {(() => {
                                const assigned = teamMembers.filter(m => isMemberAssigned(m.memberId));
                                if (assigned.length === 0) return <span className="text-muted-foreground">Unassigned</span>;
                                if (assigned.length <= 2) return <span className="truncate">{assigned.map(m => getWorkerDisplayName(m)).join(', ')}</span>;
                                return <span>{assigned.length} workers assigned</span>;
                              })()}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search workers..." />
                              <CommandEmpty>No worker found.</CommandEmpty>
                              <CommandList>
                                <CommandGroup>
                                  {teamMembers.filter(m => m.isActive && m.roleName?.toLowerCase() !== 'administrator').map((member) => {
                                    const onOtherJob = isWorkerOnOtherJob(member.memberId);
                                    const checked = isMemberAssigned(member.memberId);
                                    return (
                                      <CommandItem key={member.memberId} value={`${getWorkerDisplayName(member)} ${member.roleName}`}
                                        onSelect={() => { if (assignBusy || !member.memberId) return; if (checked) removeWorkerMutation.mutate(member.memberId); else addWorkersMutation.mutate([member.memberId]); }}
                                        data-testid={`option-worker-${member.memberId}`}
                                      >
                                        <Check className={`mr-2 h-4 w-4 ${checked ? 'opacity-100' : 'opacity-0'}`} />
                                        <span className="flex-1">{getWorkerDisplayName(member)} ({member.roleName})</span>
                                        {onOtherJob
                                          ? <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 ml-2">On a job</Badge>
                                          : <Badge variant="outline" className="text-xs text-green-600 border-green-300 ml-2">Available</Badge>}
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      )}
                      {/* Assignment list — shown for both projects and service calls */}
                      {activeAssignments.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {activeAssignments.map((assignment) => {
                            const member = teamMembers.find(m => m.memberId === assignment.userId);
                            const name = assignment.workerDisplayNameSnapshot || (member ? getWorkerDisplayName(member) : (assignment.displayName || 'Worker'));
                            return (
                              <div key={`assigned-${assignment.id}`} className="flex items-center gap-2 py-1.5 px-2 rounded-md border" data-testid={`row-assignment-${assignment.userId}`}>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-sm font-medium truncate">{name}</span>
                                    {assignment.isPrimary && <Badge variant="outline" className="text-xs">Lead</Badge>}
                                  </div>
                                  {assignment.completedAt
                                    ? <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400"><CheckCircle2 className="h-3 w-3" />Done · {new Date(assignment.completedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
                                    : <span className="text-xs text-muted-foreground">In progress</span>}
                                </div>
                                {!isProject && !assignment.isPrimary && activeAssignments.length > 1 && (
                                  <Button variant="ghost" size="sm" className="h-8" disabled={makeLeadMutation.isPending} onClick={() => makeLeadMutation.mutate(assignment.id)} data-testid={`button-make-lead-${assignment.userId}`}>
                                    <Star className="h-3.5 w-3.5 mr-1" />Make lead
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Subcontractors */}
                  {!isTradie && (
                    <div className="pt-3 border-t">
                      <div className="flex items-center gap-2 mb-2">
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Subcontractors</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">Invite subcontractors via SMS or email — restricted view of this job only</p>
                      {subTokens && subTokens.filter(t => t.status === 'pending' || t.status === 'accepted').length > 0 && (
                        <div className="space-y-2 mb-3">
                          {subTokens.filter(t => t.status === 'pending' || t.status === 'accepted').map((tk) => (
                            <div key={tk.id} className="flex items-center justify-between gap-2 p-2 rounded-md border text-sm">
                              <div className="flex items-center gap-2 min-w-0">
                                {tk.status === 'accepted' ? <Check className="h-4 w-4 text-green-600 shrink-0" /> : <Clock className="h-4 w-4 text-muted-foreground shrink-0" />}
                                <div>
                                  <Badge variant={tk.status === 'accepted' ? 'default' : 'secondary'} className="text-xs">{tk.status === 'accepted' ? 'Accepted' : 'Pending'}</Badge>
                                  {tk.contactName && <span className="text-xs font-medium ml-2">{tk.contactName}</span>}
                                </div>
                              </div>
                              {tk.status === 'pending' && <Button variant="ghost" size="icon" onClick={() => revokeInviteMutation.mutate(tk.id)} disabled={revokeInviteMutation.isPending}><X className="h-4 w-4" /></Button>}
                            </div>
                          ))}
                        </div>
                      )}
                      <Button variant="outline" size="sm" className="w-full" onClick={handleOpenInviteModal}>
                        <UserPlus className="h-4 w-4 mr-2" />Invite Subcontractor
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Job Brief (projects: quote scope + approved variations) */}
              {isProject && ((linkedQuote?.lineItems?.length ?? 0) > 0 || jobVariations.filter((v: any) => v.status === 'approved').length > 0) && (
                <Card data-testid="card-job-brief">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                      <CardTitle className="text-sm font-medium">Job Brief</CardTitle>
                      {linkedQuote && <p className="text-xs text-muted-foreground ml-auto">From {linkedQuote.number ? `Quote #${linkedQuote.number}` : 'linked quote'}</p>}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {linkedQuote?.lineItems && linkedQuote.lineItems.length > 0 && (
                      <div className="space-y-1.5">
                        {linkedQuote.description && <p className="text-sm text-muted-foreground">{linkedQuote.description}</p>}
                        {linkedQuote.lineItems.map((item) => (
                          <div key={item.id} className="flex items-start gap-2">
                            <Circle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/50" />
                            <span className="text-sm flex-1">{item.description}</span>
                            {!isTradie && item.total && <span className="text-sm text-muted-foreground shrink-0">${parseFloat(item.total).toFixed(2)}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {jobVariations.filter((v: any) => v.status === 'approved').length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t">
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide">Approved Variations</span>
                        {jobVariations.filter((v: any) => v.status === 'approved').map((variation: any) => (
                          <div key={variation.id} className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 rounded-md p-2">
                            <Plus className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium">{variation.title}</span>
                              {variation.description && <p className="text-xs text-muted-foreground mt-0.5">{variation.description}</p>}
                            </div>
                            {!isTradie && variation.totalAmount && <span className="text-sm font-medium text-amber-700 dark:text-amber-400 shrink-0">+${parseFloat(variation.totalAmount).toFixed(2)}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {!isTradie && linkedQuote?.total && (
                      <div className="pt-2 border-t space-y-1">
                        <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Original Quote</span><span>${parseFloat(linkedQuote.total).toFixed(2)}</span></div>
                        {jobVariations.filter((v: any) => v.status === 'approved').length > 0 && (
                          <div className="flex items-center justify-between text-sm font-semibold pt-1 border-t">
                            <span>Revised Total</span>
                            <span>${(parseFloat(linkedQuote.total) + jobVariations.filter((v: any) => v.status === 'approved').reduce((sum: number, v: any) => sum + (parseFloat(v.totalAmount) || 0), 0)).toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Notes card */}
              <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={handleOpenNotesModal} data-testid="card-job-notes">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />Notes
                      {jobNotesData.length > 0 && <Badge variant="secondary" className="text-xs">{jobNotesData.length}</Badge>}
                    </span>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {jobNotesData.length > 0 ? (
                    <div className="space-y-3">
                      {jobNotesData.slice(0, 3).map((note) => (
                        <div key={note.id} className="p-3 rounded-lg bg-muted/50 border border-border">
                          <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" /><span>{formatHistoryDate(note.createdAt)}</span>
                            {note.createdByName && <><span>•</span><span>{note.createdByName}</span></>}
                          </div>
                        </div>
                      ))}
                      {jobNotesData.length > 3 && <p className="text-xs text-muted-foreground text-center">+{jobNotesData.length - 3} more notes</p>}
                    </div>
                  ) : job.notes ? (
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <p className="text-sm whitespace-pre-wrap">{job.notes}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground"><Clock className="h-3 w-3" /><span>Legacy note</span></div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Tap to add a note...</p>
                  )}
                </CardContent>
              </Card>

              {/* Project extras: Variations + Retention */}
              {isProject && <JobVariations jobId={jobId} canEdit={job.status !== 'invoiced' && !isTradie} />}
              {isProject && retentionCard}

              {/* Voice Notes */}
              <JobVoiceNotes jobId={jobId} canUpload={job.status !== 'invoiced'} existingNotes={job.notes} />

              {/* Linked Jobs */}
              <LinkedJobsCard jobId={jobId} clientId={job.clientId ?? null} clientName={client?.name || 'Client'} />

              {/* Inspection prompts */}
              {job.requiresInspection && !job.inspectionCompletedAt && !isTradie && (
                <Card className="border-2" style={{ borderColor: 'hsl(45 93% 47% / 0.5)' }} data-testid="card-inspection-required">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'hsl(45 93% 47% / 0.15)' }}>
                        <Search className="h-5 w-5" style={{ color: 'hsl(45 93% 47%)' }} />
                      </div>
                      <div><p className="font-semibold text-sm">Inspection Required</p><p className="text-xs text-muted-foreground">Complete the site inspection, then create a quote</p></div>
                    </div>
                    <div className="space-y-2">
                      <Textarea placeholder="Inspection notes (optional)..." value={inspectionNotesInput} onChange={(e) => setInspectionNotesInput(e.target.value)} className="text-sm" data-testid="textarea-inspection-notes" />
                      <Button className="w-full" style={{ backgroundColor: 'hsl(45 93% 47%)', color: 'white' }} onClick={() => completeInspectionMutation.mutate(inspectionNotesInput)} disabled={completeInspectionMutation.isPending} data-testid="button-complete-inspection">
                        {completeInspectionMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}Mark Inspection Complete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              {job.requiresInspection && job.inspectionCompletedAt && !linkedQuote && !isTradie && (
                <Card className="border-2" style={{ borderColor: 'hsl(221.2 83.2% 53.3% / 0.5)' }} data-testid="card-inspection-done-quote">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'hsl(221.2 83.2% 53.3% / 0.15)' }}>
                        <FileText className="h-5 w-5" style={{ color: 'hsl(221.2 83.2% 53.3%)' }} />
                      </div>
                      <div><p className="font-semibold text-sm">Inspection Done — Create Quote</p><p className="text-xs text-muted-foreground">Inspection completed {job.inspectionCompletedAt ? new Date(job.inspectionCompletedAt).toLocaleDateString() : ''}.</p></div>
                    </div>
                    {job.inspectionNotes && <p className="text-xs text-muted-foreground mb-3 italic">Notes: {job.inspectionNotes}</p>}
                    <Button className="w-full" style={{ backgroundColor: 'hsl(221.2 83.2% 53.3%)', color: 'white' }} onClick={() => onCreateQuote?.(jobId)} data-testid="button-create-quote-after-inspection">
                      <FileText className="h-4 w-4 mr-2" />Create Quote
                    </Button>
                  </CardContent>
                </Card>
              )}
              {job.status === 'done' && !linkedInvoice && !isTradie && (
                <Card className="border-2" style={{ borderColor: 'hsl(142.1 76.2% 36.3% / 0.5)' }} data-testid="card-create-invoice-prompt">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'hsl(142.1 76.2% 36.3% / 0.15)' }}>
                        <Receipt className="h-5 w-5" style={{ color: 'hsl(142.1 76.2% 36.3%)' }} />
                      </div>
                      <div><p className="font-semibold text-sm">Job Complete — Get Paid</p><p className="text-xs text-muted-foreground">Create and send an invoice to your client</p></div>
                    </div>
                    <Button className="w-full" style={{ backgroundColor: 'hsl(142.1 76.2% 36.3%)', color: 'white' }} onClick={() => onCreateInvoice?.(jobId)} data-testid="button-create-invoice-prompt">
                      <Receipt className="h-4 w-4 mr-2" />Create Invoice
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── PHASES TAB (project only) ── */}
            {isProject && (
              <TabsContent value="phases" className="mt-0 space-y-6">
                <JobPhasesSection
                  jobId={jobId}
                  isTradie={isTradie}
                  onCreateClaimForPhase={!isTradie ? (phase) => setPendingClaimPhase({ id: phase.id, phaseCode: phase.phaseCode, name: phase.name, bookedHours: phase.bookedHours ?? null }) : undefined}
                  onOpenDetail={(phase) => setDetailPanelPhase(phase as PhaseDetailJobPhase)}
                />
                <ProjectGanttView jobId={jobId} isTradie={isTradie} />
                <ClaimsSection
                  jobId={jobId}
                  isTradie={isTradie}
                  retentionPercent={(job as any)?.retentionPercent ?? '0'}
                  openNewClaimForPhase={pendingClaimPhase}
                  onNewClaimForPhaseConsumed={() => setPendingClaimPhase(null)}
                />
              </TabsContent>
            )}

            {/* ── ACTIVITY TAB ── */}
            <TabsContent value="activity" className="mt-0 space-y-6">
              {(job.status === 'pending' || job.status === 'scheduled') && jobPhotos.length === 0 && (
                <Card className="border-2 border-dashed" data-testid="card-before-photos-prompt">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/10"><Camera className="h-5 w-5 text-primary" /></div>
                      <div><p className="font-semibold text-sm">Take Before Photos</p><p className="text-xs text-muted-foreground">Capture the site before work begins</p></div>
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => setShowBeforePhotoPrompt(true)} data-testid="button-add-before-photos">
                      <Camera className="h-4 w-4 mr-2" />Add Before Photos
                    </Button>
                  </CardContent>
                </Card>
              )}
              <JobChecklistSection jobId={jobId} readOnly={job.status === 'invoiced'} />
              <JobTasksSection jobId={jobId} />
              <JobForms jobId={jobId} />
              <JobPhotoGallery jobId={jobId} canUpload={job.status !== 'invoiced'} />
              {canUseAIFeatures && jobPhotos.length > 0 && (
                <AIPhotoAnalysis jobId={jobId} photoCount={jobPhotos.length} existingNotes={jobNotesData.length > 0 ? jobNotesData.map(n => n.content).join('\n') : job.notes} />
              )}
              <SiteDiarySection jobId={jobId} canEdit={!isTradie || job.status !== 'invoiced'} currentUserId={currentUser?.id} />
            </TabsContent>

            {/* ── FINANCIALS TAB ── */}
            <TabsContent value="financials" className="mt-0 space-y-6">
              {/* Time Tracking widget */}
              {job.status === 'in_progress' && (
                <Card className="border-2" style={{ borderColor: 'hsl(var(--trade) / 0.3)' }} data-testid="card-time-tracking">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: 'hsl(var(--trade))' }}>
                      <Timer className="h-5 w-5" />Time Tracking
                    </CardTitle>
                  </CardHeader>
                  <CardContent><TimerWidget jobId={jobId} jobTitle={job.title} /></CardContent>
                </Card>
              )}
              {!isTradie && (
                <GeofenceSettingsCard
                  jobId={jobId}
                  hasLocation={!!(job.latitude && job.longitude)}
                  geofenceEnabled={job.geofenceEnabled}
                  geofenceRadius={job.geofenceRadius}
                  geofenceAutoClockIn={job.geofenceAutoClockIn}
                  geofenceAutoClockOut={job.geofenceAutoClockOut}
                  assignedTo={job.assignedTo}
                />
              )}
              {/* Worker time summaries — visual breakdown */}
              {workerSummaries.length > 0 && (() => {
                const CAT_COLORS: Record<string, string> = { work: '#2563EB', travel: '#7C3AED', materials: '#D97706', admin: '#0891B2', meeting: '#059669', training: '#DB2777', other: '#6B7280' };
                const CAT_LABELS: Record<string, string> = { work: 'Site Work', travel: 'Driving', materials: 'Supplies', admin: 'Admin', meeting: 'Meeting', training: 'Training', other: 'Other' };
                const CAT_EMOJI: Record<string, string> = { work: '🔨', travel: '🚗', materials: '🛒', admin: '🖥️', meeting: '📋', training: '🎓', other: '⚙️' };

                // Category totals for the donut chart
                const catMap: Record<string, number> = {};
                timeEntries.filter(e => !e.isBreak && e.endTime).forEach(e => {
                  const cat = (e as any).timeCategory || 'work';
                  const mins = (e as any).duration || Math.floor((new Date(e.endTime!).getTime() - new Date(e.startTime).getTime()) / 60000);
                  catMap[cat] = (catMap[cat] || 0) + mins;
                });
                const donutData = Object.entries(catMap).filter(([, m]) => m > 0).sort(([, a], [, b]) => b - a).map(([cat, mins]) => ({
                  name: `${CAT_EMOJI[cat] ?? ''} ${CAT_LABELS[cat] ?? cat}`,
                  value: Math.round(mins / 6) / 10,
                  color: CAT_COLORS[cat] ?? '#6B7280',
                }));

                // Variance numbers
                const totalActualHours = actualHoursData.actualHours;
                const budgetedHours = job.estimatedHours ?? 0;
                const hourVariance = budgetedHours > 0 ? totalActualHours - budgetedHours : null;
                const overBudget = hourVariance !== null && hourVariance > 0;

                const totalWorkerMinutes = workerSummaries.reduce((s, w) => s + w.totalMinutes, 0);

                return (
                  <Card data-testid="card-worker-attendance">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          <Clock className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                          Time & Attendance
                        </CardTitle>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={handleExportTimeCSV}
                        >
                          <FileDown className="h-3.5 w-3.5" />
                          Export CSV
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">

                      {/* Summary bar */}
                      <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/40">
                        {/* Hours */}
                        <div>
                          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Hours worked</p>
                          <div className="flex items-end gap-1.5">
                            <span className="text-xl font-bold tabular-nums">{totalActualHours.toFixed(1)}</span>
                            {budgetedHours > 0 && <span className="text-xs text-muted-foreground mb-0.5">/ {budgetedHours}h est.</span>}
                          </div>
                          {hourVariance !== null && (
                            <div className={`flex items-center gap-0.5 text-xs font-medium mt-0.5 ${overBudget ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                              {overBudget ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {overBudget ? '+' : ''}{hourVariance.toFixed(1)}h vs estimate
                            </div>
                          )}
                        </div>
                        {/* Labour cost */}
                        {actualHoursData.laborCost > 0 && (
                          <div>
                            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Labour cost</p>
                            <div className="flex items-end gap-1.5">
                              <span className="text-xl font-bold tabular-nums">${actualHoursData.laborCost.toFixed(0)}</span>
                            </div>
                            {actualHoursData.hourlyRate > 0 && (
                              <p className="text-xs text-muted-foreground mt-0.5">${actualHoursData.hourlyRate.toFixed(0)}/hr avg rate</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Per-worker cards */}
                      <div className="space-y-2">
                        {workerSummaries.map((worker) => {
                          const sharePercent = totalWorkerMinutes > 0 ? Math.round((worker.totalMinutes / totalWorkerMinutes) * 100) : 0;
                          const isExpanded = expandedWorkers.has(worker.userId);
                          return (
                            <div key={worker.userId} className="rounded-lg border bg-card overflow-hidden">
                              {/* Worker header row */}
                              <div className="flex items-center gap-3 p-3">
                                <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold" style={{ background: 'hsl(var(--trade) / 0.12)', color: 'hsl(var(--trade))' }}>
                                  {worker.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-semibold truncate">{worker.name}</span>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {worker.laborCost > 0 && <span className="text-sm font-semibold">${worker.laborCost.toFixed(2)}</span>}
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground"
                                        onClick={() => toggleWorkerSessions(worker.userId)}
                                      >
                                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                    <span className="font-medium text-foreground">{worker.totalHours}h</span>
                                    {worker.breakMinutes > 0 && <span>+ {Math.round(worker.breakMinutes / 60 * 10) / 10}h break</span>}
                                    {worker.hourlyRate > 0 && <span>· ${worker.hourlyRate}/hr</span>}
                                    {worker.entries.length > 0 && <span>· {worker.entries.length} session{worker.entries.length !== 1 ? 's' : ''}</span>}
                                    {worker.hasGps && <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1 py-0.5 rounded"><CheckCircle className="h-2.5 w-2.5" />GPS</span>}
                                  </div>
                                  {/* Mini share bar */}
                                  <div className="mt-2 flex items-center gap-2">
                                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                      <div className="h-full rounded-full transition-all" style={{ width: `${sharePercent}%`, background: 'hsl(var(--trade))' }} />
                                    </div>
                                    <span className="text-[10px] text-muted-foreground tabular-nums">{sharePercent}%</span>
                                  </div>
                                </div>
                              </div>
                              {/* Collapsible sessions */}
                              {isExpanded && worker.entries.length > 0 && (
                                <div className="border-t bg-muted/20 divide-y divide-border/50">
                                  {worker.entries.map((entry) => {
                                    const hasGps = !!(entry.clockInLatitude || entry.clockOutLatitude);
                                    const isGeofence = (entry as any).origin === 'geofence';
                                    const verified = hasGps || isGeofence;
                                    const startDate = new Date(entry.startTime);
                                    const endDate = entry.endTime ? new Date(entry.endTime) : null;
                                    const durationMins = endDate
                                      ? (entry.duration || Math.floor((endDate.getTime() - startDate.getTime()) / 60000))
                                      : Math.floor((Date.now() - startDate.getTime()) / 60000);
                                    const hours = Math.round(durationMins / 60 * 10) / 10;
                                    const cat = (entry as any).timeCategory || 'work';
                                    return (
                                      <div key={entry.id} className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground px-3 py-2">
                                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CAT_COLORS[cat] ?? '#6B7280' }} />
                                        <span className="font-medium text-foreground">{startDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
                                        <span>
                                          {startDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                                          {endDate ? ` \u2013 ${endDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}` : ''}
                                        </span>
                                        {!endDate && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 animate-pulse">Active</Badge>}
                                        {hours > 0 && <span className="font-medium text-foreground">{hours}h</span>}
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: (CAT_COLORS[cat] ?? '#6B7280') + '1a', color: CAT_COLORS[cat] ?? '#6B7280' }}>
                                          {CAT_EMOJI[cat] ?? ''} {CAT_LABELS[cat] ?? cat}
                                        </span>
                                        {verified && <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1 py-0.5 rounded"><CheckCircle className="h-2.5 w-2.5" />GPS</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Category donut chart */}
                      {donutData.length > 1 && (
                        <div className="pt-2 border-t">
                          <p className="text-xs font-medium text-muted-foreground mb-3">Hours by Category</p>
                          <div className="flex items-center gap-4">
                            <div className="w-24 h-24 flex-shrink-0">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={donutData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={28}
                                    outerRadius={42}
                                    paddingAngle={2}
                                    dataKey="value"
                                    strokeWidth={0}
                                  >
                                    {donutData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <RechartsTooltip
                                    formatter={(value: number) => [`${value}h`, '']}
                                    contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 6 }}
                                    itemStyle={{ padding: 0 }}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="flex-1 space-y-1.5">
                              {donutData.map((item) => (
                                <div key={item.name} className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: item.color }} />
                                    <span className="text-xs text-muted-foreground">{item.name}</span>
                                  </div>
                                  <span className="text-xs font-medium tabular-nums">{item.value}h</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}
              {/* Profitability */}
              {!isTradie && <JobProfitabilityCard jobId={jobId} />}
              {/* Job costing */}
              {(job.estimatedHours || actualHoursData.hasData) && (
                <Card>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center gap-1 text-muted-foreground text-xs mb-2"><DollarSign className="h-3 w-3" />Job Costing</div>
                    {job.estimatedHours && <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Estimated</span><span className="text-sm font-medium">{job.estimatedHours} hrs</span></div>}
                    {actualHoursData.hasData && <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Actual</span><span className="text-sm font-medium">{actualHoursData.actualHours} hrs</span></div>}
                    {job.estimatedHours && actualHoursData.hasData && (() => {
                      const variance = actualHoursData.actualHours - job.estimatedHours;
                      return <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Variance</span><span className={`text-sm font-medium ${variance > 0 ? 'text-red-600 dark:text-red-400' : variance < 0 ? 'text-green-600 dark:text-green-400' : ''}`}>{variance > 0 ? '+' : ''}{variance.toFixed(2)} hrs</span></div>;
                    })()}
                  </CardContent>
                </Card>
              )}
              {/* Materials */}
              <Card data-testid="card-materials">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                      <CardTitle className="text-sm font-medium">Materials & Parts</CardTitle>
                      {jobMaterials.length > 0 && <Badge variant="secondary" className="text-xs">{jobMaterials.length}</Badge>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setShowAddMaterial(!showAddMaterial)}><Plus className="h-4 w-4 mr-1" />Add</Button>
                      {isProject && <Button size="sm" variant="ghost" onClick={() => setShowAssignEquipment(true)}><Wrench className="h-4 w-4 mr-1" />Equipment</Button>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {showAddMaterial && (
                    <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                      <Input placeholder="Material name (e.g., 25mm copper pipe)" value={materialName} onChange={(e) => setMaterialName(e.target.value)} />
                      <div className="grid grid-cols-3 gap-2">
                        <Input placeholder="Qty" type="number" value={materialQty} onChange={(e) => setMaterialQty(e.target.value)} />
                        <Select value={materialUnit} onValueChange={setMaterialUnit}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{['each', 'metre', 'sqm', 'litre', 'kg', 'box', 'pack', 'roll'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                        </Select>
                        {!isTradie && <Input placeholder="$ Cost" type="number" step="0.01" value={materialUnitCost} onChange={(e) => setMaterialUnitCost(e.target.value)} />}
                      </div>
                      {!isTradie && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="$ Sell Price" type="number" step="0.01" value={materialUnitPrice} onChange={(e) => setMaterialUnitPrice(e.target.value)} />
                          <div className="flex items-center text-xs text-muted-foreground px-2">
                            {materialUnitCost && materialUnitPrice && parseFloat(materialUnitPrice) > 0
                              ? <span className={parseFloat(materialUnitPrice) > parseFloat(materialUnitCost) ? 'text-green-600' : 'text-red-600'}>Margin: {(((parseFloat(materialUnitPrice) - parseFloat(materialUnitCost)) / parseFloat(materialUnitPrice)) * 100).toFixed(1)}%</span>
                              : null}
                          </div>
                        </div>
                      )}
                      <Input placeholder="Supplier (optional)" value={materialSupplier} onChange={(e) => setMaterialSupplier(e.target.value)} />
                      {isProject && jobPhasesForPicker.length > 0 && (
                        <Select value={materialPhaseId} onValueChange={setMaterialPhaseId}>
                          <SelectTrigger><SelectValue placeholder="Phase (optional)" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">No phase</SelectItem>
                            {jobPhasesForPicker.map(p => <SelectItem key={p.id} value={p.id}>{p.phaseCode} {p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" disabled={!materialName.trim() || addMaterialMutation.isPending}
                          onClick={() => addMaterialMutation.mutate({ name: materialName.trim(), quantity: materialQty || '1', unit: materialUnit, unitCost: materialUnitCost || '0', unitPrice: materialUnitPrice || '0', supplier: materialSupplier || undefined, markupPercent: materialMarkupPercent || undefined, phaseId: materialPhaseId === '__none__' ? undefined : (materialPhaseId || undefined) })}
                          style={{ backgroundColor: 'hsl(var(--trade))', color: 'white' }}>
                          {addMaterialMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Material'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowAddMaterial(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                  {jobMaterials.length === 0 && !showAddMaterial && (
                    <TabEmptyState icon={<Package className="h-6 w-6 text-muted-foreground/50" />} title="No materials tracked yet" description="Add parts and materials used on this job." action={<Button size="sm" variant="outline" onClick={() => setShowAddMaterial(true)}><Plus className="h-4 w-4 mr-1" />Add Material</Button>} />
                  )}
                  {jobMaterials.length > 0 && (
                    <div className="space-y-2">
                      {jobMaterials.map((mat) => {
                        const statusColors: Record<string, string> = {
                          needed: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
                          ordered: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
                          shipped: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
                          received: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
                          installed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
                        };
                        return (
                          <div key={mat.id} className="p-3 rounded-lg border bg-background space-y-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">{mat.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColors[mat.status] || statusColors.needed}`}>{mat.status}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                                <span>{mat.quantity} {mat.unit}</span>
                                {mat.supplier && <span>from {mat.supplier}</span>}
                                {!isTradie && mat.totalCost && parseFloat(mat.totalCost) > 0 && <span className="font-medium">Cost: ${parseFloat(mat.totalCost).toFixed(2)}</span>}
                                {!isTradie && mat.unitPrice && parseFloat(mat.unitPrice) > 0 && <span className="font-medium text-green-700 dark:text-green-400">Price: ${(parseFloat(mat.unitPrice) * parseFloat(mat.quantity || '1')).toFixed(2)}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Button size="sm" variant={mat.receiptPhotoUrl ? "ghost" : "outline"} onClick={() => handleMaterialReceiptUpload(mat.id)} disabled={uploadingMaterialId === mat.id}>
                                {uploadingMaterialId === mat.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5 mr-1" />}
                                {mat.receiptPhotoUrl ? '' : 'Receipt'}
                              </Button>
                              <Select value={mat.status} onValueChange={(val) => handleMaterialStatusChange(mat, val)}>
                                <SelectTrigger className="h-7 w-[90px] text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {['needed', 'ordered', 'shipped', 'received', 'installed'].map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              {!isTradie && <Button size="icon" variant="ghost" onClick={() => deleteMaterialMutation.mutate(mat.id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!isTradie && jobMaterials.length > 0 && (() => {
                    const totalCost = jobMaterials.reduce((sum, m) => sum + (parseFloat(m.totalCost) || 0), 0);
                    const totalPrice = jobMaterials.reduce((sum, m) => { const up = parseFloat(m.unitPrice || '0'); const qty = parseFloat(m.quantity || '1'); return sum + (up > 0 ? up * qty : 0); }, 0);
                    const profit = totalPrice - totalCost;
                    const hasCostData = jobMaterials.some(m => parseFloat(m.unitCost || '0') > 0);
                    return (
                      <div className="flex items-center justify-between pt-2 border-t gap-3 flex-wrap">
                        <span className={`text-sm font-medium ${!hasCostData ? 'text-muted-foreground' : ''}`}>Cost: {hasCostData ? `$${totalCost.toFixed(2)}` : 'Not set'}</span>
                        {totalPrice > 0 && <span className="text-sm font-medium text-green-700 dark:text-green-400">Revenue: ${totalPrice.toFixed(2)}</span>}
                        {totalPrice > 0 && hasCostData && <span className={`text-sm font-semibold ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>Profit: ${profit.toFixed(2)} ({totalPrice > 0 ? ((profit / totalPrice) * 100).toFixed(0) : 0}%)</span>}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
              {/* Defects (project only) */}
              {isProject && <DefectsSection jobId={jobId} isTradie={isTradie} teamMembers={teamMembers} />}
            </TabsContent>

            {/* ── DOCS & SAFETY TAB ── */}
            <TabsContent value="docs" className="mt-0 space-y-6">
              {isProject && <ProjectDocumentRegister jobId={jobId} canUpload={job.status !== 'invoiced'} />}
              <SafetyFormsSection jobId={jobId} jobStatus={job.status} jobTitle={job.title} jobAddress={job.address} />
              <JobDocuments jobId={jobId} canUpload={job.status !== 'invoiced'} canDelete={!isTradie} phases={jobPhasesForPicker} />
              {(job.status === 'in_progress' || job.status === 'done' || job.status === 'invoiced') && <JobSignature jobId={jobId} />}
              {/* Purchase orders linked to this job */}
              {!isTradie && <JobPurchaseOrdersSection jobId={jobId} isTradie={isTradie} />}
              {/* RFIs for service-call jobs (projects get RFIs via ProjectDocumentRegister above) */}
              {!isProject && <JobRfisSection jobId={jobId} canEdit={job.status !== 'invoiced'} />}
            </TabsContent>

            {/* ── CHAT TAB ── */}
            <TabsContent value="chat" className="mt-0">
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                  <MessageSquare className="h-8 w-8" style={{ color: 'hsl(var(--trade))' }} />
                </div>
                <p className="text-base font-semibold mb-2">Job Chat</p>
                <p className="text-sm text-muted-foreground mb-6 max-w-[280px]">Discuss this job with your team in real time.</p>
                <Button onClick={() => navigate(`/chat?job=${jobId}`)} style={{ backgroundColor: 'hsl(var(--trade))', color: 'white' }}>
                  <MessageSquare className="h-4 w-4 mr-2" />Open Chat
                </Button>
              </div>
            </TabsContent>

          </div>{/* end main column */}

          {/* ═══ PERSISTENT SIDEBAR ═══ */}
          <div className={`lg:col-span-4 ${activeTab === 'phases' ? 'hidden' : ''}`}>
            <div className="space-y-4 lg:sticky lg:top-20">

              {/* ── CLIENT CARD ── */}
              {(client || job.address) && (
                <Card data-testid="sidebar-client-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                      <User className="h-3.5 w-3.5" />Client
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {client && (
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div
                          className="w-10 h-10 rounded-full text-white text-sm font-bold flex items-center justify-center shrink-0"
                          style={{ backgroundColor: 'hsl(var(--trade))' }}
                        >
                          {client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <button
                            className="text-sm font-semibold hover:underline text-left truncate block w-full"
                            onClick={() => job.clientId && onViewClient?.(job.clientId)}
                          >
                            {client.name}
                          </button>
                          <div className="flex flex-col gap-1 mt-1.5">
                            {client.phone && (
                              <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                <Phone className="h-3 w-3 shrink-0" />{client.phone}
                              </a>
                            )}
                            {client.email && (
                              <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                <Mail className="h-3 w-3 shrink-0" /><span className="truncate">{client.email}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {job.address && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <MapPin className="h-3 w-3 mt-0.5 shrink-0" /><span>{job.address}</span>
                      </a>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ── JOB PROGRESS ── */}
              <Card data-testid="sidebar-at-a-glance">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                    <CheckCircle className="h-3.5 w-3.5" />Job Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {/* Status badge */}
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-xs capitalize ${
                        job.status === 'done' || job.status === 'invoiced'
                          ? 'border-green-500 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30'
                          : job.status === 'in_progress'
                          ? 'border-blue-500 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30'
                          : (job.status as string) === 'cancelled' || (job.status as string) === 'on_hold'
                          ? 'border-gray-400 text-gray-600 dark:text-gray-400'
                          : 'border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30'
                      }`}
                    >
                      {job.status === 'in_progress' ? 'In Progress' : (job.status as string) === 'on_hold' ? 'On Hold' : job.status}
                    </Badge>
                    {job.scheduledAt && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />{format(new Date(job.scheduledAt), 'MMM d')}
                      </span>
                    )}
                  </div>

                  {/* Service call: status stepper */}
                  {isServiceCall && (() => {
                    const steps: { key: string; label: string }[] = [
                      { key: 'pending', label: 'Pending' },
                      { key: 'scheduled', label: 'Scheduled' },
                      { key: 'in_progress', label: 'In Progress' },
                      { key: 'done', label: 'Done' },
                      { key: 'invoiced', label: 'Invoiced' },
                    ];
                    const currentIdx = steps.findIndex(s => s.key === job.status);
                    const activeIdx = currentIdx === -1 ? 0 : currentIdx;
                    return (
                      <div className="flex items-center gap-0.5">
                        {steps.map((step, idx) => {
                          const done = idx < activeIdx;
                          const active = idx === activeIdx;
                          return (
                            <div key={step.key} className="flex items-center flex-1 min-w-0">
                              <div className="flex flex-col items-center flex-1 min-w-0">
                                <div
                                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold transition-all ${
                                    done
                                      ? 'bg-green-500 text-white'
                                      : active
                                      ? 'text-white'
                                      : 'bg-muted text-muted-foreground'
                                  }`}
                                  style={active ? { backgroundColor: 'hsl(var(--trade))' } : undefined}
                                  title={step.label}
                                >
                                  {done ? <Check className="h-2.5 w-2.5" /> : idx + 1}
                                </div>
                                <span className={`text-[9px] mt-0.5 text-center leading-tight ${active ? 'font-semibold' : 'text-muted-foreground'}`} style={active ? { color: 'hsl(var(--trade))' } : undefined}>
                                  {step.label}
                                </span>
                              </div>
                              {idx < steps.length - 1 && (
                                <div className={`h-px flex-shrink-0 w-2 mb-3.5 ${done ? 'bg-green-500' : 'bg-muted'}`} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Project: phase progress bar */}
                  {isProject && jobPhasesForPicker.length > 0 && (() => {
                    const total = jobPhasesForPicker.length;
                    const completedCount = jobPhasesForPicker.filter(p => p.status === 'complete' || p.status === 'invoiced').length;
                    const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
                    return (
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-muted-foreground flex items-center gap-1"><Layers className="h-3 w-3" />Phases</span>
                          <span className="font-medium">{completedCount} / {total} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: pct === 100 ? 'hsl(142 71% 45%)' : 'hsl(var(--trade))' }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Time tracked row */}
                  {!isTradie && actualHoursData.hasData && (
                    <div className="flex items-center justify-between text-xs pt-0.5 border-t border-border">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="h-3 w-3" />Time tracked</span>
                      <span className="font-medium">{actualHoursData.actualHours}h</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── FINANCIAL SNAPSHOT ── */}
              {!isTradie && jobProfitabilityData && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                      <DollarSign className="h-3.5 w-3.5" />Financial Snapshot
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {(() => {
                      const quoted = jobProfitabilityData?.quoted?.amount ?? null;
                      const costs = jobProfitabilityData?.costs?.total ?? null;
                      const margin = jobProfitabilityData?.profit?.margin ?? null;
                      const isLoss = jobProfitabilityData?.profit?.isNegative;

                      // Outstanding balance is computed server-side in the profitability API:
                      // sum of ALL invoice totals (any status) minus sum of all receipts received.
                      // This is accurate for multi-invoice jobs and any payment status.
                      const serverOutstanding = jobProfitabilityData?.revenue?.outstandingBalance ?? null;
                      const allInvoicedTotal = jobProfitabilityData?.revenue?.allInvoicedTotal ?? null;
                      let outstandingAmt: number | null = null;
                      let outstandingColor: string | undefined;
                      if (serverOutstanding !== null && allInvoicedTotal !== null && allInvoicedTotal > 0) {
                        outstandingAmt = serverOutstanding;
                        if (outstandingAmt === 0) {
                          outstandingColor = 'text-green-600 dark:text-green-400';
                        } else if (linkedInvoice?.status === 'overdue') {
                          outstandingColor = 'text-red-600 dark:text-red-400';
                        } else {
                          outstandingColor = 'text-amber-600 dark:text-amber-400';
                        }
                      }

                      const fmt = (n: number) =>
                        `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                      const marginColor = margin === null
                        ? ''
                        : isLoss || margin < 0
                        ? 'text-red-600 dark:text-red-400'
                        : margin < 15
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-green-600 dark:text-green-400';

                      const rows: { label: string; value: string | null; color?: string; icon?: React.ReactNode }[] = [
                        {
                          label: 'Quoted',
                          value: quoted !== null ? fmt(parseFloat(quoted.toString())) : null,
                          icon: <FileText className="h-3 w-3" />,
                        },
                        {
                          label: 'Costs to date',
                          value: costs !== null ? fmt(parseFloat(costs.toString())) : null,
                          color: costs !== null && quoted !== null && costs > parseFloat(quoted.toString()) ? 'text-red-600 dark:text-red-400' : undefined,
                          icon: <Receipt className="h-3 w-3" />,
                        },
                        {
                          label: 'Outstanding',
                          value: outstandingAmt !== null ? fmt(outstandingAmt) : null,
                          color: outstandingColor,
                          icon: <Banknote className="h-3 w-3" />,
                        },
                      ];

                      return (
                        <>
                          {rows.filter(r => r.value !== null).map((row) => (
                            <div key={row.label} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground flex items-center gap-1.5">{row.icon}{row.label}</span>
                              <span className={`font-semibold tabular-nums ${row.color ?? ''}`}>{row.value}</span>
                            </div>
                          ))}
                          {margin !== null && (
                            <div className="flex items-center justify-between text-sm pt-1.5 mt-0.5 border-t border-border">
                              <span className="text-muted-foreground flex items-center gap-1.5"><BarChart2 className="h-3 w-3" />Margin</span>
                              <span className={`font-bold tabular-nums ${marginColor}`}>
                                {isLoss ? '' : ''}{margin.toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              {/* ── ASSIGNED TEAM ── */}
              {!isTradie && !isSolo && activeAssignments.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" />Team ({activeAssignments.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-2">
                      {activeAssignments.map((a) => {
                        const name = a.workerDisplayNameSnapshot || a.displayName || 'Worker';
                        const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                        const isPrimary = a.isPrimary;
                        return (
                          <div key={a.id} className="flex items-center gap-1.5 group" title={name}>
                            <div
                              className="w-7 h-7 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0 ring-2 ring-background"
                              style={{ backgroundColor: isPrimary ? 'hsl(var(--trade))' : 'hsl(var(--muted-foreground))' }}
                            >
                              {initials}
                            </div>
                            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors truncate max-w-[90px]">
                              {name.split(' ')[0]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── QUICK LINKS ── */}
              {!isTradie && (
                <Card data-testid="sidebar-quick-links">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                      <Link2 className="h-3.5 w-3.5" />Quick Links
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {job.clientId && (
                      <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => onViewClient?.(job.clientId!)}>
                        <User className="h-4 w-4 text-muted-foreground" /><span className="flex-1 text-left truncate">{client?.name || 'View Client'}</span><ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                      </Button>
                    )}
                    <LinkedDocumentsCard
                      linkedQuote={linkedQuote}
                      linkedInvoice={linkedInvoice}
                      linkedReceipts={linkedReceipts}
                      jobStatus={job.status}
                      onViewQuote={(id) => navigate(`/quotes/${id}`)}
                      onViewInvoice={(id) => navigate(`/invoices/${id}`)}
                      onViewReceipt={(id) => navigate(`/receipts/${id}`)}
                      onCreateQuote={() => onCreateQuote?.(jobId)}
                      onCreateInvoice={() => onCreateInvoice?.(jobId)}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Client portal */}
              {job.clientId && (
                <Card data-testid="card-client-portal">
                  <CardContent className="py-3">
                    {portalUrl ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />Client Portal</span>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setShowPortalControls(!showPortalControls)} title="Portal settings"><Eye className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => window.open(portalUrl, '_blank')} title="Preview as client"><ExternalLink className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 p-2 rounded-md bg-muted/50 border cursor-pointer group" onClick={async () => { try { await navigator.clipboard.writeText(portalUrl); toast({ title: "Copied", description: "Portal link copied to clipboard" }); } catch { toast({ title: "Copied" }); } }}>
                          <span className="text-xs text-muted-foreground truncate flex-1 select-all">{portalUrl}</span>
                          <Copy className="h-3 w-3 text-muted-foreground shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={async () => { try { await navigator.clipboard.writeText(portalUrl); toast({ title: "Copied" }); } catch {} }}><Copy className="h-3 w-3" />Copy</Button>
                          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={async () => { try { await apiRequest("POST", `/api/jobs/${jobId}/share-portal-sms`); toast({ title: "SMS Sent" }); } catch (err: any) { toast({ title: "SMS Failed", description: err.message, variant: "destructive" }); } }} disabled={!client?.phone}><Phone className="h-3 w-3" />SMS</Button>
                          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={async () => { try { await apiRequest("POST", `/api/jobs/${jobId}/share-portal-email`); toast({ title: "Email Sent" }); } catch (err: any) { toast({ title: "Email Failed", description: err.message, variant: "destructive" }); } }} disabled={!client?.email}><Mail className="h-3 w-3" />Email</Button>
                        </div>
                        {showPortalControls && (
                          <div className="space-y-3 pt-2 border-t">
                            <span className="text-xs font-medium text-muted-foreground">Client can see:</span>
                            <div className="space-y-2">
                              {([
                                { key: 'showTimeline' as const, label: 'Progress Timeline', icon: Clock },
                                { key: 'showPhotos' as const, label: 'Job Photos', icon: Camera },
                                { key: 'showChecklist' as const, label: 'Checklist', icon: ListChecks },
                                { key: 'showActivityFeed' as const, label: 'Activity Feed', icon: Activity },
                                { key: 'showFinancialsOnPortal' as const, label: 'Schedule of Values', icon: DollarSign },
                                { key: 'showProgrammeOnPortal' as const, label: 'Project Programme', icon: BarChart2 },
                              ] as const).map(({ key, label, icon: Icon }) => (
                                <div key={key} className="flex items-center justify-between gap-2">
                                  <label className="text-xs flex items-center gap-1.5 cursor-pointer"><Icon className="h-3 w-3 text-muted-foreground" />{label}</label>
                                  <Switch checked={portalSettings[key]} onCheckedChange={(checked) => { setPortalSettings(prev => ({ ...prev, [key]: checked })); portalSettingsMutation.mutate({ [key]: checked }); }} disabled={portalSettingsMutation.isPending} />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full gap-2 text-xs" onClick={() => portalLinkMutation.mutate()} disabled={portalLinkMutation.isPending}>
                        {portalLinkMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}Share Client Portal
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Payment collection */}
              {linkedInvoice && !isTradie && (linkedInvoice.status === 'sent' || linkedInvoice.status === 'overdue' || linkedInvoice.status === 'partial') && (
                <Card data-testid="card-collect-payment">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <CreditCard className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />Collect Payment
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">${parseFloat(linkedInvoice.total as string || '0').toFixed(2)} outstanding</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">Invoice {linkedInvoice.invoiceNumber} is awaiting payment</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="default" className="flex items-center justify-center gap-2" style={{ backgroundColor: 'hsl(var(--trade))', color: 'white' }} onClick={() => navigate(`/collect-payment?invoiceId=${linkedInvoice.id}&jobId=${jobId}`)} data-testid="button-tap-to-pay-job"><Smartphone className="h-4 w-4" />Tap to Pay</Button>
                      <Button variant="outline" className="flex items-center justify-center gap-2" onClick={() => navigate(`/collect-payment?invoiceId=${linkedInvoice.id}&jobId=${jobId}&method=qr`)} data-testid="button-qr-code-job"><QrCode className="h-4 w-4" />QR Code</Button>
                      <Button variant="outline" className="flex items-center justify-center gap-2" onClick={() => navigate(`/collect-payment?invoiceId=${linkedInvoice.id}&jobId=${jobId}&method=link`)} data-testid="button-send-link-job"><Link2 className="h-4 w-4" />Send Link</Button>
                      <Button variant="outline" className="flex items-center justify-center gap-2" onClick={() => navigate(`/invoices/${linkedInvoice.id}?action=recordPayment`)} data-testid="button-record-cash-job"><DollarSign className="h-4 w-4" />Record Cash</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              {(job.status === 'done' || job.status === 'in_progress') && linkedQuote && linkedQuote.status === 'accepted' && !linkedInvoice && (
                <Card data-testid="card-quick-collect">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2"><CreditCard className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />Collect Payment Now</CardTitle>
                      <Badge variant="secondary" className="text-xs">Based on quote</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-background border">
                      <span className="text-sm text-muted-foreground">Quote total</span>
                      <span className="text-lg font-bold" style={{ color: 'hsl(var(--trade))' }}>${parseFloat(linkedQuote.total as string || '0').toFixed(2)}</span>
                    </div>
                    <Button className="w-full" style={{ backgroundColor: 'hsl(var(--trade))', color: 'white' }} onClick={() => setShowQuickCollect(true)} data-testid="button-quick-collect-open">
                      <CreditCard className="h-4 w-4 mr-2" />Quick Collect Payment
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Activity feed */}
              <Card data-testid="job-activity-feed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <History className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activitiesLoading ? (
                    <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : jobActivities.length === 0 ? (
                    <div className="text-center py-4">
                      <History className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">No activity yet</p>
                      <p className="text-xs text-muted-foreground/70">Status changes and events appear here</p>
                    </div>
                  ) : (
                    <div>
                      {(() => {
                        const displayedActivities = showAllActivities ? jobActivities : jobActivities.slice(0, 6);
                        const dateGroups = groupActivitiesByDate(displayedActivities);
                        return (
                          <>
                            <div className="relative">
                              <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" />
                              {dateGroups.map((group, groupIndex) => (
                                <div key={group.date}>
                                  <div className={`relative flex items-center gap-3 mb-3 ${groupIndex > 0 ? 'mt-4' : ''}`}>
                                    <div className="w-8 h-5 bg-card z-10 flex items-center justify-center">
                                      <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                                    </div>
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</span>
                                  </div>
                                  {group.activities.map((activity) => {
                                    const Icon = activityIcons[activity.type] || Briefcase;
                                    const colors = activityColors[activity.type] || { bg: 'hsl(var(--muted) / 0.5)', icon: 'hsl(var(--muted-foreground))' };
                                    return (
                                      <div key={activity.id} className="relative flex gap-3 pb-4 last:pb-0" data-testid={`activity-item-${activity.id}`}>
                                        <div className="relative z-10 shrink-0">
                                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-card border-2" style={{ borderColor: colors.bg }}>
                                            <Icon className="h-3.5 w-3.5" style={{ color: colors.icon }} />
                                          </div>
                                        </div>
                                        <div className="flex-1 min-w-0 pt-1">
                                          <p className="text-sm font-medium">{activity.title}</p>
                                          {activity.description && <p className="text-xs text-muted-foreground mt-0.5">{activity.description}</p>}
                                          <p className="text-[11px] text-muted-foreground/70 mt-1">{formatHistoryDate(activity.timestamp)}</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                            {jobActivities.length > 6 && (
                              <div className="pt-2">
                                <Button variant="ghost" className="w-full text-xs" onClick={() => setShowAllActivities(!showAllActivities)}>
                                  {showAllActivities ? 'Show less' : `View all (${jobActivities.length})`}
                                </Button>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </div>{/* end sidebar */}

        </div>{/* end grid */}
      </Tabs>

      {/* Email Template Editor Dialog */}
      {editingAction && (
        <EmailTemplateEditor
          isOpen={emailEditorOpen}
          onClose={() => {
            setEmailEditorOpen(false);
            setEditingAction(null);
          }}
          onSave={handleSaveEmailTemplate}
          actionType={editingAction.type === 'send_confirmation' ? 'confirmation' : 'invoice'}
          initialSubject={emailTemplates[editingAction.id]?.subject || editingAction.preview?.subject}
          initialBody={emailTemplates[editingAction.id]?.body || editingAction.preview?.message}
          recipientEmail={editingAction.preview?.recipient || client?.email}
          recipientName={client?.name || 'Client'}
          mergeFields={[
            { key: 'jobTitle', label: 'Job Title', value: job?.title || 'Job' },
            { key: 'total', label: 'Total', value: linkedQuote?.total ? `$${parseFloat(linkedQuote.total).toFixed(2)}` : 'TBA' },
            { key: 'invoiceNumber', label: 'Invoice #', value: linkedInvoice?.invoiceNumber || 'TBA' },
            { key: 'quoteNumber', label: 'Quote #', value: linkedQuote?.quoteNumber || 'TBA' },
            { key: 'scheduledDate', label: 'Scheduled Date', value: job?.scheduledAt ? format(new Date(job.scheduledAt), 'dd/MM/yyyy') : 'TBA' },
            { key: 'dueDate', label: 'Due Date', value: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-AU') },
          ]}
          businessName={businessSettings?.businessName || 'Your Business'}
        />
      )}

      {/* Empty Job Warning Dialog */}
      <AlertDialog open={showEmptyJobWarning} onOpenChange={setShowEmptyJobWarning}>
        <AlertDialogContent data-testid="dialog-empty-job-warning">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Complete Job?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This job has no photos, notes, time tracked, or signatures. Are you sure you want to mark it as complete?
              <br /><br />
              Consider adding documentation before completing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-complete">Go Back</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmCompleteEmptyJob}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="button-confirm-complete-anyway"
            >
              Complete Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Note Modal - Timestamped notes tied to moments */}
      <Dialog open={showNotesModal} onOpenChange={setShowNotesModal}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-add-note">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="h-5 w-5" />
              Add Note
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              This note will be timestamped and tied to this moment.
            </p>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={editedNotes}
              onChange={(e) => setEditedNotes(e.target.value)}
              placeholder="What's happening right now..."
              className="min-h-[150px] resize-none"
              autoFocus
              data-testid="textarea-job-notes"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNotesModal(false)}
              data-testid="button-cancel-notes"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveNotes}
              disabled={addNoteMutation.isPending || !editedNotes.trim()}
              data-testid="button-save-notes"
            >
              {addNoteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Note'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Job Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="sm:max-w-[400px]" data-testid="dialog-rename-job">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" />
              Rename Job
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <input
              type="text"
              value={newJobTitle}
              onChange={(e) => setNewJobTitle(e.target.value)}
              placeholder="Enter job title..."
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newJobTitle.trim()) {
                  handleRenameJob();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRenameJob}
              disabled={renameJobMutation.isPending || !newJobTitle.trim()}
            >
              {renameJobMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Job Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent data-testid="dialog-delete-job">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete Job?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{job.title}"? This action cannot be undone.
              <br /><br />
              All photos, notes, and other data associated with this job will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteJob}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status Rollback Confirmation Dialog */}
      <AlertDialog open={showRollbackConfirm} onOpenChange={setShowRollbackConfirm}>
        <AlertDialogContent data-testid="dialog-rollback-status">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Change Job Status?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change this job back to "{rollbackTargetStatus}"?
              <br /><br />
              This will clear the timestamps for any later stages. For example, reverting to "In Progress" will clear the "Done" and "Invoiced" timestamps.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setRollbackTargetStatus(null)}
              data-testid="button-cancel-rollback"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (rollbackTargetStatus) {
                  updateJobMutation.mutate({ status: rollbackTargetStatus });
                }
                setShowRollbackConfirm(false);
                setRollbackTargetStatus(null);
              }}
              className="bg-amber-500 hover:bg-amber-600"
              data-testid="button-confirm-rollback"
            >
              Change Status
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!costPromptMaterial} onOpenChange={(open) => { if (!open) { setCostPromptMaterial(null); setCostPromptValue(''); } }}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Enter Material Cost</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            How much did <span className="font-medium text-foreground">{costPromptMaterial?.name}</span> cost you?
          </p>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">$</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="Unit cost"
              value={costPromptValue}
              onChange={(e) => setCostPromptValue(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCostPromptSubmit(); }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Tracking costs helps you see your real profit on each job.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setCostPromptMaterial(null); setCostPromptValue(''); }}>
              Cancel
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCostPromptSkip}>
              Skip — No Cost
            </Button>
            <Button size="sm" onClick={handleCostPromptSubmit} disabled={!costPromptValue || parseFloat(costPromptValue) <= 0}>
              Save & Mark {costPromptMaterial?.status === 'installed' ? 'Installed' : 'Received'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Job Invite Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-[500px]" data-testid="dialog-job-invite">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Invite Subcontractor
            </DialogTitle>
          </DialogHeader>
          
          {generatedInviteLink ? (
            <div className="space-y-4 py-4">
              {inviteSendResults && (inviteSendResults.sms || inviteSendResults.email) && (
                <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm font-medium">
                    <Check className="h-4 w-4" />
                    Invite sent
                    {inviteSendResults.sms && inviteSendResults.email ? ' via SMS and email' :
                     inviteSendResults.sms ? ' via SMS' : ' via email'}
                  </div>
                </div>
              )}
              {inviteSendResults && ((inviteSendResults.sms === false && inviteSendSms) || (inviteSendResults.email === false && inviteSendEmail)) && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-md">
                  <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    {inviteSendResults.sms === false && inviteSendSms ? 'SMS delivery failed. ' : ''}
                    {inviteSendResults.email === false && inviteSendEmail ? 'Email delivery failed. ' : ''}
                    You can still share the link below.
                  </div>
                </div>
              )}
              <div className="p-4 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground mb-2">Portal link:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedInviteLink}
                    className="flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm"
                  />
                  <Button size="icon" onClick={handleCopyInviteLink}>
                    {copiedInvite ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  This link opens a restricted portal — subcontractors can only see this specific job
                </p>
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                {inviteContactName && <p><strong>Name:</strong> {inviteContactName}</p>}
                <p><strong>Expires:</strong> {inviteExpiry === 'never' ? 'Never' : inviteExpiry === '7days' ? 'In 7 days' : 'In 30 days'}</p>
              </div>

              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => { setGeneratedInviteLink(null); setInviteSendResults(null); }}
              >
                Invite Another
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Dave's Electrical"
                  value={inviteContactName}
                  onChange={(e) => setInviteContactName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Mobile Number</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="tel"
                    placeholder="04XX XXX XXX"
                    value={inviteContactPhone}
                    onChange={(e) => setInviteContactPhone(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm"
                  />
                  <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={inviteSendSms}
                      onChange={(e) => setInviteSendSms(e.target.checked)}
                      disabled={!inviteContactPhone}
                      className="rounded border-input"
                    />
                    <span className="text-xs text-muted-foreground">Send SMS</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Email</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="email"
                    placeholder="subbie@example.com"
                    value={inviteContactEmail}
                    onChange={(e) => setInviteContactEmail(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm"
                  />
                  <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={inviteSendEmail}
                      onChange={(e) => setInviteSendEmail(e.target.checked)}
                      disabled={!inviteContactEmail}
                      className="rounded border-input"
                    />
                    <span className="text-xs text-muted-foreground">Send Email</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Permissions</label>
                <div className="space-y-2">
                  {[
                    { id: 'view_job', label: 'View Job Details' },
                    { id: 'add_notes', label: 'Add Notes' },
                    { id: 'add_photos', label: 'Add Photos' },
                    { id: 'update_status', label: 'Update Status' },
                    { id: 'view_client', label: 'View Client Info' },
                  ].map((perm) => (
                    <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={invitePermissions.includes(perm.id)}
                        onChange={() => togglePermission(perm.id)}
                        className="rounded border-input"
                      />
                      <span className="text-sm">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Expires</label>
                <Select value={inviteExpiry} onValueChange={(v: 'never' | '7days' | '30days') => setInviteExpiry(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30days">In 30 days</SelectItem>
                    <SelectItem value="7days">In 7 days</SelectItem>
                    <SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {subTokens && subTokens.filter(t => t.status === 'pending').length > 0 && !generatedInviteLink && (
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-2">Active Invites</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {subTokens.filter(t => t.status === 'pending').map((tk) => (
                  <div key={tk.id} className="flex items-center justify-between gap-2 p-2 bg-muted rounded-md text-sm">
                    <div>
                      <span className="font-medium">{tk.contactName || 'Unnamed'}</span>
                      {tk.contactPhone && <span className="text-muted-foreground ml-2">{tk.contactPhone}</span>}
                      {tk.expiresAt && (
                        <span className="text-muted-foreground ml-2">
                          Expires {format(new Date(tk.expiresAt), 'MMM d')}
                        </span>
                      )}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => revokeInviteMutation.mutate(tk.id)}
                      disabled={revokeInviteMutation.isPending}
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteModal(false)}>
              {generatedInviteLink ? 'Done' : 'Cancel'}
            </Button>
            {!generatedInviteLink && (
              <Button 
                onClick={() => createInviteMutation.mutate()}
                disabled={createInviteMutation.isPending || invitePermissions.length === 0}
              >
                {createInviteMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {(inviteSendSms || inviteSendEmail) ? 'Sending...' : 'Creating...'}
                  </>
                ) : (inviteSendSms || inviteSendEmail) ? (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Invite
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4 mr-2" />
                    Generate Link
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Safety Check Dialog - prompts before starting work */}
      <SafetyCheckDialog
        open={showSafetyCheck}
        onOpenChange={setShowSafetyCheck}
        onContinue={() => {
          setShowSafetyCheck(false);
          updateJobMutation.mutate({ status: 'in_progress' });
          // Auto-start timer when starting job (only if no timer is already running)
          if (!globalActiveTimer && job?.title) {
            setTimeout(() => {
              startTimerMutation.mutate({
                description: `Working on ${job.title}`,
                jobId: jobId,
                hourlyRate: '85.00',
              });
            }, 500);
          }
        }}
        onAddSafetyForm={() => {
          setShowSafetyCheck(false);
          const safetySection = document.querySelector('[data-testid="card-safety-forms"]');
          if (safetySection) {
            safetySection.scrollIntoView({ behavior: 'smooth' });
            const addButton = safetySection.querySelector('[data-testid="button-add-safety-form"]') as HTMLButtonElement;
            if (addButton) {
              setTimeout(() => addButton.click(), 300);
            }
          }
        }}
        hasSafetyForms={hasSafetyForms && !hasCompletedSafetyForm}
      />

      {/* Quick Collect Payment Modal */}
      {linkedQuote && linkedQuote.status === 'accepted' && client && (
        <QuickCollectPayment
          open={showQuickCollect}
          onOpenChange={setShowQuickCollect}
          jobId={jobId}
          jobTitle={job?.title || 'Job'}
          quoteId={linkedQuote.id}
          quoteTotal={linkedQuote.total as string || '0'}
          quoteGst={(parseFloat(linkedQuote.total as string || '0') * 0.0909).toFixed(2)}
          clientName={client.name}
          clientId={client.id}
          onSuccess={(receiptId) => {
            navigate(`/receipts/${receiptId}`);
          }}
        />
      )}

      {/* Before Photo Prompt - shown when starting timer */}
      <BeforePhotoPrompt
        open={showBeforePhotoPrompt}
        onOpenChange={(open) => {
          setShowBeforePhotoPrompt(open);
          if (!open) {
            setPendingTimerStart(false);
          }
        }}
        jobId={jobId}
        jobTitle={job?.title || 'Job'}
        onComplete={() => {
          if (job?.title) {
            startTimerMutation.mutate({
              description: `Working on ${job.title}`,
              jobId: jobId,
              hourlyRate: '85.00',
            });
          }
          setShowBeforePhotoPrompt(false);
          setPendingTimerStart(false);
        }}
        onSkip={() => {
          if (job?.title) {
            startTimerMutation.mutate({
              description: `Working on ${job.title}`,
              jobId: jobId,
              hourlyRate: '85.00',
            });
          }
          setShowBeforePhotoPrompt(false);
          setPendingTimerStart(false);
        }}
      />

      {/* Unified Send Modal - Email + SMS side by side */}
      {client && (
        <UnifiedSendModal
          open={showUnifiedSendModal}
          onOpenChange={setShowUnifiedSendModal}
          documentType="job"
          documentId={jobId}
          recipientName={client.name}
          recipientEmail={client.email}
          recipientPhone={client.phone}
          documentTitle={job?.title}
          defaultTab={unifiedSendDefaultTab}
        />
      )}

      {/* Manual SMS Composer - fallback when Twilio not configured */}
      {client?.phone && (
        <ManualSmsComposer
          open={showManualSms}
          onOpenChange={setShowManualSms}
          recipientName={client.name}
          recipientPhone={client.phone}
        />
      )}

      {/* Log Site Update Dialog */}
      <Dialog open={showSiteUpdateDialog} onOpenChange={(open) => {
        setShowSiteUpdateDialog(open);
        if (!open) {
          setSiteUpdateNote('');
          setSiteUpdatePhoto(null);
          setSiteUpdatePhotoPreview(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              Log Site Update
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="What's happening on site right now?"
              value={siteUpdateNote}
              onChange={(e) => setSiteUpdateNote(e.target.value)}
              className="min-h-[100px]"
            />
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  className="gap-2"
                  onClick={() => document.getElementById('site-update-photo-input')?.click()}
                >
                  <Camera className="h-4 w-4" />
                  {siteUpdatePhoto ? 'Change Photo' : 'Add Photo (optional)'}
                </Button>
              </label>
              <input
                id="site-update-photo-input"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleSiteUpdatePhotoChange}
              />
              {siteUpdatePhotoPreview && (
                <div className="relative">
                  <img
                    src={siteUpdatePhotoPreview}
                    alt="Preview"
                    className="w-full max-h-48 object-cover rounded-md"
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setSiteUpdatePhoto(null);
                      setSiteUpdatePhotoPreview(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowSiteUpdateDialog(false);
                setSiteUpdateNote('');
                setSiteUpdatePhoto(null);
                setSiteUpdatePhotoPreview(null);
              }}
              disabled={isSiteUpdateSubmitting}
            >
              Cancel
            </Button>
            <Button
              style={{ backgroundColor: 'hsl(var(--trade))', color: 'white' }}
              onClick={handleSubmitSiteUpdate}
              disabled={!siteUpdateNote.trim() || isSiteUpdateSubmitting}
            >
              {isSiteUpdateSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Update'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showAssignEquipment} onOpenChange={setShowAssignEquipment}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Equipment</DialogTitle>
            <p className="text-sm text-muted-foreground">Optionally track which equipment is used on this job.</p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Equipment</Label>
              <Select value={selectedEquipmentId} onValueChange={setSelectedEquipmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select equipment..." />
                </SelectTrigger>
                <SelectContent>
                  {allEquipment
                    .filter((eq: any) => !jobEquipmentList.some(je => je.equipmentId === eq.id))
                    .map((eq: any) => (
                      <SelectItem key={eq.id} value={eq.id}>
                        {eq.name}{eq.serialNumber ? ` (${eq.serialNumber})` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={equipmentNotes}
                onChange={(e) => setEquipmentNotes(e.target.value)}
                placeholder="e.g., Needed for installation"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignEquipment(false)}>Cancel</Button>
            <Button
              onClick={() => assignEquipmentMutation.mutate({ equipmentId: selectedEquipmentId, notes: equipmentNotes || undefined })}
              disabled={!selectedEquipmentId || assignEquipmentMutation.isPending}
            >
              {assignEquipmentMutation.isPending ? 'Assigning...' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={proofPackPreviewOpen} onOpenChange={(open) => {
        setProofPackPreviewOpen(open);
        if (!open) {
          if (proofPackBlobUrl) URL.revokeObjectURL(proofPackBlobUrl);
          setProofPackBlobUrl(null);
          setProofPackError(null);
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Job Proof Pack</DialogTitle>
          </DialogHeader>
          <div className="flex gap-4">
            <div className="w-48 flex-shrink-0 space-y-3 border-r pr-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Include Sections</p>
              {([
                { key: 'timeline' as const, label: 'Job Timeline' },
                { key: 'attendance' as const, label: 'Worker Hours' },
                { key: 'gpsProof' as const, label: 'GPS Verification' },
                { key: 'materials' as const, label: 'Materials & Costs' },
                { key: 'variations' as const, label: 'Variations' },
                { key: 'photos' as const, label: 'Photos' },
                { key: 'invoice' as const, label: 'Invoice Summary' },
                ...((jobProfitabilityData?.retentionSummary?.sumRetentionHeld ?? 0) > 0
                  ? [{ key: 'retention' as const, label: 'Retention' }]
                  : []),
                { key: 'compliance' as const, label: 'Compliance & Licensing' },
                { key: 'subcontractors' as const, label: 'Subcontractor Coordination' },
                { key: 'swms' as const, label: 'Safety & SWMS' },
                { key: 'forms' as const, label: 'Job Cards & Forms' },
              ] as { key: keyof typeof proofPackSections; label: string }[]).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={proofPackSections[key]}
                    onChange={(e) => setProofPackSections(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="rounded border-border"
                  />
                  {label}
                </label>
              ))}
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={loadProofPackPreview}>
                Update Preview
              </Button>
            </div>
            <div className="flex-1 min-w-0">
              {proofPackLoading && (
                <div className="flex items-center justify-center" style={{ height: '60vh' }}>
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Generating preview...</span>
                </div>
              )}
              {proofPackError && (
                <div className="flex flex-col items-center justify-center gap-2" style={{ height: '60vh' }}>
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                  <p className="text-sm text-destructive">{proofPackError}</p>
                  <Button variant="outline" size="sm" onClick={loadProofPackPreview}>Retry</Button>
                </div>
              )}
              {!proofPackLoading && !proofPackError && proofPackBlobUrl && (
                <iframe
                  src={proofPackBlobUrl}
                  className="w-full border rounded-md bg-white"
                  style={{ height: '60vh' }}
                  title="Proof Pack Preview"
                />
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setProofPackPreviewOpen(false)}>
              Close
            </Button>
            <Button variant="outline" data-testid="button-proof-pack-tsv" onClick={() => {
              const params = new URLSearchParams();
              Object.entries(proofPackSections).forEach(([key, val]) => {
                if (!val) params.set(`hide_${key}`, '1');
              });
              params.set('format', 'tsv');
              window.open(`/api/jobs/${jobId}/proof-pack/export?${params.toString()}`, '_blank');
            }}>
              <FileDown className="h-4 w-4 mr-2" />
              Export for Excel
            </Button>
            <Button onClick={() => {
              const params = new URLSearchParams();
              Object.entries(proofPackSections).forEach(([key, val]) => {
                if (!val) params.set(`hide_${key}`, '1');
              });
              window.open(`/api/jobs/${jobId}/proof-pack?${params.toString()}`, '_blank');
            }}>
              <FileDown className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Save as Project Template Dialog */}
      <Dialog open={showSaveTemplateDialog} onOpenChange={(open) => {
        setShowSaveTemplateDialog(open);
        if (!open) setSaveTemplateName('');
      }}>
        <DialogContent className="max-w-md" data-testid="dialog-save-project-template">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Save as Project Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              This will save the current phases, checklist items, and project description as a reusable template. You can apply it when creating new projects.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="template-name">Template name</Label>
              <Input
                id="template-name"
                placeholder="e.g. Commercial Fitout, Residential Renovation"
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && saveTemplateName.trim()) {
                    saveTemplateMutation.mutate({ name: saveTemplateName.trim() });
                  }
                }}
                data-testid="input-template-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveTemplateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveTemplateMutation.mutate({ name: saveTemplateName.trim() })}
              disabled={!saveTemplateName.trim() || saveTemplateMutation.isPending}
              data-testid="button-confirm-save-template"
            >
              {saveTemplateMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
              ) : (
                'Save Template'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Phase detail slide-over panel ─────────────────────────── */}
      {detailPanelPhase && (
        <PhaseDetailPanel
          jobId={jobId}
          phase={detailPanelPhase}
          workers={activeAssignments
            .filter((a) => a.isActive !== false)
            .map((a) => ({
              id: a.userId,
              name: a.workerDisplayNameSnapshot || a.displayName || 'Worker',
            }))}
          isTradie={isTradie}
          onClose={() => setDetailPanelPhase(null)}
          onUpdated={() => {
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/phases`] });
          }}
          onCreateClaim={!isTradie ? (phase) => {
            setPendingClaimPhase({ id: phase.id, phaseCode: phase.phaseCode, name: phase.name, bookedHours: phase.bookedHours ?? null });
            setDetailPanelPhase(null);
            handleTabChange('phases');
          } : undefined}
        />
      )}

      {/* ── Unified Manage Team modal (projects only) ──────────────── */}
      {showTeamModal && isProject && (
        <ProjectTeamModal
          jobId={jobId}
          phases={jobPhasesForPicker}
          teamMembers={teamMembers}
          activeAssignments={jobAssignments}
          isWorkerOnOtherJob={isWorkerOnOtherJob}
          getWorkerDisplayName={getWorkerDisplayName}
          onClose={() => setShowTeamModal(false)}
          onRefresh={() => {
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/phases`] });
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/assignments`] });
          }}
        />
      )}

    </PageShell>
  );
}
