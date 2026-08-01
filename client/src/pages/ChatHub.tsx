import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getAuthHeaders} from "@/lib/queryClient";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatComposer } from "@/components/ChatComposer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/UserAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ClientInsightsPanel from "@/components/ClientInsightsPanel";
import { 
  Users, 
  Loader2, 
  Pin, 
  MessageCircle, 
  Mail, 
  Briefcase,
  ArrowLeft,
  Search,
  Send,
  Check,
  CheckCheck,
  Phone,
  Wifi,
  WifiOff,
  Clock,
  AlertTriangle,
  ExternalLink,
  Plus,
  User,
  X,
  Trash2,
  Info,
  FileText,
  PanelRightClose,
  PanelRight,
  MapPin,
  Calendar,
  Circle,
  Navigation,
  ChevronDown,
  Receipt,
  Bell,
  Wrench,
  UserPlus,
  Link2,
  Settings as SettingsIcon,
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useSearch } from "wouter";
import { useAppMode } from "@/hooks/use-app-mode";
import { useSmsSocket } from "@/hooks/use-sms-socket";
import { useIntegrationHealth, isTwilioReady } from "@/hooks/use-integration-health";
import { TwilioWarning } from "@/components/IntegrationWarning";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";
import type { MessageTemplate } from "@shared/schema";
import { QuickRepliesBar } from "@/components/QuickRepliesBar";

interface TeamChatMessage {
  id: string;
  businessOwnerId: string;
  senderId: string;
  message: string;
  messageType?: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  isAnnouncement?: boolean;
  isPinned?: boolean;
  readBy?: string[];
  createdAt: string;
  senderName: string;
  senderAvatar?: string | null;
}

interface TeamMember {
  id: string;
  userId: string;
  memberId?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email: string;
  phone?: string | null;
  role: string;
  profileImageUrl?: string | null;
  status?: string;
  inviteStatus?: string;
  themeColor?: string;
}

interface Job {
  id: string;
  title: string;
  status: string;
  clientId?: string;
  address?: string;
  scheduledAt?: string;
  createdAt?: string;
  assignedTo?: string;
  sitePhoto?: string;
}

interface JobPhoto {
  id: string;
  jobId: string;
  objectStorageKey: string;
  fileName: string;
  category?: string;
  caption?: string;
  sortOrder?: number;
}

interface User {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}

interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

interface Conversation {
  otherUser: User;
  lastMessage?: DirectMessage;
  unreadCount: number;
}

interface UnreadCounts {
  teamChat: number;
  directMessages: number;
  jobChats: number;
  sms: number;
}

interface SmsConversation {
  id: string;
  businessOwnerId: string;
  clientId: string | null;
  clientPhone: string;
  clientName: string | null;
  jobId: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  deletedAt: string | null;
}

interface SmsMessage {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  body: string;
  senderUserId: string | null;
  status: string;
  twilioSid: string | null;
  isQuickAction: boolean;
  quickActionType: string | null;
  readAt: string | null;
  createdAt: string;
  isJobRequest?: boolean;
  intentConfidence?: 'high' | 'medium' | 'low' | null;
  intentType?: 'quote_request' | 'job_request' | 'enquiry' | 'followup' | 'other' | null;
  suggestedJobTitle?: string | null;
  jobCreatedFromSms?: string | null;
  mediaUrls?: string[] | null;
}

interface Client {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

type FilterType = 'jobs' | 'team' | 'enquiries';

interface ConversationItem {
  id: string;
  type: 'team' | 'direct' | 'job' | 'unassigned' | 'client';
  title: string;
  subtitle?: string;
  avatar?: string | null;
  avatarFallback: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  status?: string;
  // Job context
  jobId?: string;
  jobStatus?: string;
  jobAddress?: string;
  assignedWorkerName?: string;
  assignedWorkerPhone?: string;
  // Client/SMS context
  clientId?: string;
  clientPhone?: string;
  clientName?: string;
  smsConversation?: SmsConversation;
  isOnline?: boolean;
  themeColor?: string;
  relatedJobs?: Job[];
  data: any;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#6B7280',
  scheduled: '#3B82F6',
  in_progress: '#F59E0B',
  done: '#10B981',
  invoiced: '#8B5CF6',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  done: 'Completed',
  invoiced: 'Invoiced',
};

const QUICK_ACTION_TEMPLATES = [
  { id: 'omw', label: "On my way", icon: Navigation, message: "G'day! Just letting you know I'm on my way now. Should be there in about 20 minutes.", primary: true },
  { id: 'running-late', label: "Running late", icon: Clock, message: "Apologies, I'm running a bit behind schedule. Will be there as soon as I can - should only be another 15-20 minutes.", primary: true },
  { id: 'job-done', label: "Job done", icon: Check, message: "All done! The job's been completed. Let me know if you have any questions or need anything else.", primary: true },
  { id: 'quote-sent', label: "Quote sent", icon: FileText, message: "I've sent through your quote. Have a look and let me know if you've got any questions or want to go ahead.", primary: false },
  { id: 'confirm', label: "Confirm booking", icon: Calendar, message: "Just confirming our appointment. Please reply to let me know you're still available, or give us a bell if you need to reschedule.", primary: false },
  { id: 'thanks', label: "Thanks", icon: User, message: "Thanks for your business mate! Really appreciate it. Don't hesitate to reach out if you need anything.", primary: false },
];

function getWorkerNamedMessage(templateId: string, workerFirstName: string): string | null {
  const name = workerFirstName;
  switch (templateId) {
    case 'omw':
      return `G'day! Just letting you know ${name} is on the way now. Should be there in about 20 minutes.`;
    case 'running-late':
      return `Apologies, ${name} is running a bit behind schedule. Will be there as soon as possible - should only be another 15-20 minutes.`;
    case 'job-done':
      return `All done! ${name} has completed the job. Let me know if you have any questions or need anything else.`;
    default:
      return null;
  }
}

const QUICK_REPLY_TEMPLATES = QUICK_ACTION_TEMPLATES;

function ConversationSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;
  
  return (
    <div className="shrink-0 px-4 py-2 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800">
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium">You're offline</span>
        <span className="text-xs text-amber-600 dark:text-amber-500">
          — messages will send when reconnected
        </span>
      </div>
    </div>
  );
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'team':
      return <Users className="h-4 w-4" />;
    case 'client':
      return <User className="h-4 w-4" />;
    case 'direct':
      return <Mail className="h-4 w-4" />;
    default:
      return <MessageCircle className="h-4 w-4" />;
  }
}

function getTypeColor(type: string) {
  switch (type) {
    case 'team':
      return 'bg-primary/10 text-primary';
    case 'client':
      return 'bg-green-500/10 text-green-600';
    case 'direct':
      return 'bg-purple-500/10 text-purple-600';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function getTypeLabel(type: string) {
  switch (type) {
    case 'team':
      return 'Team';
    case 'client':
      return 'Client';
    case 'direct':
      return 'Direct';
    default:
      return '';
  }
}

export default function ChatHub() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const smsInputRef = useRef<HTMLInputElement>(null);
  const { isOwner, isManager } = useAppMode();
  
  const showDirectFilter = isOwner || isManager;
  
  const [filter, setFilter] = useState<FilterType>('jobs');
  const [jobStatusFilter, setJobStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);
  const [selectedDirectUser, setSelectedDirectUser] = useState<User | null>(null);
  const [selectedSmsConversation, setSelectedSmsConversation] = useState<SmsConversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [smsNewMessage, setSmsNewMessage] = useState('');
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  
  const [newSmsDialogOpen, setNewSmsDialogOpen] = useState(false);
  const [newSmsClientSearch, setNewSmsClientSearch] = useState('');
  const [newSmsSelectedClient, setNewSmsSelectedClient] = useState<Client | null>(null);
  const [newSmsPhoneNumber, setNewSmsPhoneNumber] = useState('');
  const [newSmsInitialMessage, setNewSmsInitialMessage] = useState('');
  const [showSmsUpgrade, setShowSmsUpgrade] = useState(false);
  const [numberSearchArea, setNumberSearchArea] = useState('');
  const [numberSearchLoading, setNumberSearchLoading] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<any[]>([]);
  const [purchasingNumber, setPurchasingNumber] = useState<string | null>(null);
  const [numberSearched, setNumberSearched] = useState(false);
  const [newSmsPhoneError, setNewSmsPhoneError] = useState('');
  
  const [smsToDelete, setSmsToDelete] = useState<SmsConversation | null>(null);
  
  const [createClientDialogOpen, setCreateClientDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');

  const [assignWorkerDialogOpen, setAssignWorkerDialogOpen] = useState(false);
  const [pendingQuickAction, setPendingQuickAction] = useState<string | null>(null);

  const { data: currentUser } = useQuery<User>({
    queryKey: ['/api/auth/me'],
  });

  const handleSmsNotification = useCallback((notification: {
    conversationId: string;
    senderPhone: string;
    senderName: string | null;
    messagePreview: string;
    jobId?: string | null;
    unreadCount: number;
    timestamp: number;
  }) => {
    toast({
      title: `New SMS from ${notification.senderName || notification.senderPhone}`,
      description: notification.messagePreview.slice(0, 60) + (notification.messagePreview.length > 60 ? '...' : ''),
    });
    
    if (selectedSmsConversation?.id === notification.conversationId) {
      queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations', notification.conversationId, 'messages'] });
    }
  }, [toast, queryClient, selectedSmsConversation]);

  const { isConnected: smsSocketConnected } = useSmsSocket({
    businessId: currentUser?.id || '',
    enabled: !!currentUser?.id,
    onSmsNotification: handleSmsNotification,
  });

  const { data: integrationHealth } = useIntegrationHealth();
  const twilioConnected = isTwilioReady(integrationHealth);
  
  const { data: smsConfig } = useQuery<{
    smsMode: string;
    dedicatedPhoneNumber: string | null;
    hasDedicatedNumber: boolean;
    twilioConfigured: boolean;
    twilioConnected: boolean;
    canTwoWayText: boolean;
  }>({ queryKey: ['/api/sms/config'] });
  const canTwoWayText = smsConfig?.canTwoWayText ?? false;

  const { data: unreadCounts = { teamChat: 0, directMessages: 0, jobChats: 0, sms: 0 } } = useQuery<UnreadCounts>({
    queryKey: ['/api/chat/unread-counts'],
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const { data: teamMessages = [], isLoading: teamLoading } = useQuery<TeamChatMessage[]>({
    queryKey: ['/api/team-chat'],
  });

  const { data: dmConversations = [], isLoading: dmLoading } = useQuery<Conversation[]>({
    queryKey: ['/api/direct-messages/conversations'],
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ['/api/team/members'],
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  // Fetch job photos to display site photos in chat list
  const { data: jobPhotosMap = {} } = useQuery<Record<string, string>>({
    queryKey: ['/api/jobs/site-photos'],
    queryFn: async () => {
      const res = await fetch('/api/jobs/site-photos', { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const { data: smsConversations = [], isLoading: smsLoading } = useQuery<SmsConversation[]>({
    queryKey: ['/api/sms/conversations'],
  });

  const { data: userSmsTemplates = [] } = useQuery<MessageTemplate[]>({
    queryKey: ['/api/message-templates', 'sms'],
    queryFn: async () => {
      const res = await fetch('/api/message-templates?channel=sms', { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch templates');
      return res.json();
    },
  });

  const { data: allClients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const { data: directMessages = [], refetch: refetchDirectMessages } = useQuery<DirectMessage[]>({
    queryKey: ['/api/direct-messages', selectedDirectUser?.id],
    enabled: !!selectedDirectUser && selectedConversation?.type === 'direct',
  });

  const { data: smsMessages = [], refetch: refetchSmsMessages } = useQuery<SmsMessage[]>({
    queryKey: ['/api/sms/conversations', selectedSmsConversation?.id, 'messages'],
    enabled: !!selectedSmsConversation && ['client', 'job', 'unassigned'].includes(selectedConversation?.type || ''),
  });

  const selectedJobId = selectedConversation?.type === 'job' ? selectedConversation?.data?.id : null;

  const { data: jobQuotes = [] } = useQuery<any[]>({
    queryKey: ['/api/quotes'],
    enabled: !!selectedJobId,
  });

  const { data: jobInvoices = [] } = useQuery<any[]>({
    queryKey: ['/api/invoices'],
    enabled: !!selectedJobId,
  });

  const currentJobQuotes = useMemo(() => 
    selectedJobId ? jobQuotes.filter((q: any) => q.jobId === selectedJobId && q.acceptanceToken) : [],
    [jobQuotes, selectedJobId]
  );

  const currentJobInvoices = useMemo(() => 
    selectedJobId ? jobInvoices.filter((inv: any) => inv.jobId === selectedJobId && inv.paymentToken) : [],
    [jobInvoices, selectedJobId]
  );

  const assignWorkerMutation = useMutation({
    mutationFn: async ({ jobId, memberId }: { jobId: string; memberId: string }) => {
      const response = await apiRequest('PATCH', `/api/jobs/${jobId}`, { assignedTo: memberId });
      return response.json();
    },
    onSuccess: (data: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      if (selectedConversation) {
        const assignedMemberForUpdate = variables.memberId === currentUser?.id 
          ? null
          : teamMembers.find((m: any) => m.id === variables.memberId || m.memberId === variables.memberId || m.userId === variables.memberId);
        const newWorkerName = variables.memberId === currentUser?.id 
          ? getUserDisplayName(currentUser)
          : (assignedMemberForUpdate ? getTeamMemberName(assignedMemberForUpdate) : undefined);
        setSelectedConversation({
          ...selectedConversation,
          assignedWorkerName: newWorkerName,
          data: { ...selectedConversation.data, assignedTo: variables.memberId },
        });
      }
      toast({
        title: "Worker assigned",
        description: "The worker has been assigned to this job.",
      });
      if (pendingQuickAction) {
        const template = QUICK_ACTION_TEMPLATES.find(t => t.id === pendingQuickAction);
        if (template) {
          const isSelfAssigned = variables.memberId === currentUser?.id ||
            teamMembers.some((m: any) => (m.id === variables.memberId || m.memberId === variables.memberId) && m.userId === currentUser?.id);
          let workerFirstName: string | null = null;
          if (!isSelfAssigned) {
            const assignedMember = teamMembers.find((m: any) => m.id === variables.memberId || m.memberId === variables.memberId || m.userId === variables.memberId);
            workerFirstName = assignedMember ? (assignedMember.firstName || getTeamMemberName(assignedMember).split(' ')[0]) : null;
          }
          const namedMsg = workerFirstName ? getWorkerNamedMessage(template.id, workerFirstName) : null;
          const baseMessage = namedMsg || template.message;
          const message = selectedSmsConversation
            ? applySmsTemplateFields(baseMessage, selectedSmsConversation)
            : baseMessage;
          setSmsNewMessage(message);
        }
        setPendingQuickAction(null);
      }
      setAssignWorkerDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to assign worker",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const sendTeamMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('POST', '/api/team-chat', {
        message,
        messageType: 'text',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-chat'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/unread-counts'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const sendDirectMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!selectedDirectUser) throw new Error("No user selected");
      return apiRequest('POST', `/api/direct-messages/${selectedDirectUser.id}`, { content: message });
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/direct-messages', selectedDirectUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/direct-messages/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/unread-counts'] });
    },
  });

  const pinMessageMutation = useMutation({
    mutationFn: async ({ messageId, pinned }: { messageId: string; pinned: boolean }) => {
      const response = await apiRequest('PATCH', `/api/team-chat/${messageId}/pin`, { pinned });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-chat'] });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await apiRequest('DELETE', `/api/team-chat/${messageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-chat'] });
    },
  });

  const sendSmsMutation = useMutation({
    mutationFn: async ({ clientId, clientPhone, message, jobId }: { clientId?: string; clientPhone: string; message: string; jobId?: string }) => {
      const response = await apiRequest('POST', '/api/sms/send', {
        clientId,
        clientPhone,
        message,
        jobId,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      setSmsNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations'] });
      if (selectedSmsConversation) {
        queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations', selectedSmsConversation.id, 'messages'] });
      }
      if (data?.conversationId && (!selectedSmsConversation || selectedSmsConversation.id === 'new')) {
        queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations', data.conversationId, 'messages'] });
        setSelectedSmsConversation(prev => prev ? { ...prev, id: data.conversationId } : prev);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/chat/unread-counts'] });
      toast({
        title: "Message sent",
        description: "Your SMS has been delivered.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send SMS",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Quick action mutation for "On My Way" and other automations
  const quickActionMutation = useMutation({
    mutationFn: async ({ conversationId, actionType, jobId, jobTitle }: { conversationId: string; actionType: string; jobId?: string; jobTitle?: string }) => {
      const response = await apiRequest('POST', '/api/sms/quick-action', {
        conversationId,
        actionType,
        jobId,
        jobTitle,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations'] });
      if (selectedSmsConversation) {
        queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations', selectedSmsConversation.id, 'messages'] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/chat/unread-counts'] });
      toast({
        title: "Message sent",
        description: "Quick action SMS has been sent to the client.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const markSmsReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      await apiRequest('POST', `/api/sms/conversations/${conversationId}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/unread-counts'] });
    },
  });

  const deleteSmsConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      await apiRequest('DELETE', `/api/sms/conversations/${conversationId}`);
    },
    onSuccess: (_, deletedId) => {
      toast({
        title: "Conversation deleted",
        description: "The SMS conversation has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/unread-counts'] });
      if (selectedSmsConversation?.id === deletedId) {
        setSelectedSmsConversation(null);
        setSelectedConversation(null);
        setMobileShowChat(false);
      }
      setSmsToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete conversation",
        description: error.message || "Please try again",
        variant: "destructive",
      });
      setSmsToDelete(null);
    },
  });

  const createJobFromSmsMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const response = await apiRequest('POST', `/api/sms/messages/${messageId}/create-job`, {});
      return response.json();
    },
    onSuccess: (data: { job: { id: string; title: string } }) => {
      toast({
        title: "Job Created",
        description: `Job "${data.job.title}" has been created from this SMS.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations', selectedSmsConversation?.id, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      
      if (selectedSmsConversation) {
        setSelectedSmsConversation({
          ...selectedSmsConversation,
          jobId: data.job.id
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create job",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const createClientFromSmsMutation = useMutation({
    mutationFn: async ({ name, phone, email, address }: { name: string; phone: string; email?: string; address?: string }) => {
      const response = await apiRequest('POST', '/api/clients', {
        name,
        phone,
        email: email || undefined,
        address: address || undefined,
      });
      return response.json() as Promise<{ id: string; name: string }>;
    },
    onSuccess: async (newClient) => {
      if (selectedSmsConversation && selectedSmsConversation.id !== 'new') {
        await apiRequest('PATCH', `/api/sms/conversations/${selectedSmsConversation.id}`, {
          clientId: newClient.id,
          clientName: newClient.name,
        });
        
        setSelectedSmsConversation({
          ...selectedSmsConversation,
          clientId: newClient.id,
          clientName: newClient.name,
        });
      }
      
      toast({
        title: "Client Created",
        description: `${newClient.name} has been added and linked to this conversation.`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations'] });
      
      setCreateClientDialogOpen(false);
      setNewClientName('');
      setNewClientEmail('');
      setNewClientAddress('');
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create client",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const linkJobMutation = useMutation({
    mutationFn: async ({ conversationId, jobId }: { conversationId: string; jobId: string }) => {
      return apiRequest('PATCH', `/api/sms/conversations/${conversationId}`, { jobId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({ title: "Job linked", description: "This conversation has been linked to the job" });
      setSelectedConversation(null);
      setSelectedSmsConversation(null);
      setActiveJobContext(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to link job",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleOpenCreateClientDialog = () => {
    if (selectedSmsConversation) {
      setNewClientPhone(selectedSmsConversation.clientPhone);
      setNewClientName('');
      setNewClientEmail('');
      setNewClientAddress('');
      setCreateClientDialogOpen(true);
    }
  };

  const handleCreateClientSubmit = () => {
    if (!newClientName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the client",
        variant: "destructive",
      });
      return;
    }
    
    createClientFromSmsMutation.mutate({
      name: newClientName.trim(),
      phone: newClientPhone,
      email: newClientEmail.trim() || undefined,
      address: newClientAddress.trim() || undefined,
    });
  };

  const isUnknownClient = selectedSmsConversation && !selectedSmsConversation.clientId;

  const applySmsTemplateFields = (text: string, conversation: SmsConversation) => {
    if (!text) return text;
    const clientName = conversation?.clientName || 'Customer';
    const clientFirstName = clientName.split(' ')[0];
    return text
      .replace(/\{client_name\}/g, clientName)
      .replace(/\{client_first_name\}/g, clientFirstName)
      .replace(/\{business_name\}/g, 'Our business');
  };

  // Quick status actions (On my way / Running late / Job done). For On my way /
  // Running late on a job conversation we fetch the worker's real location and
  // ask the server for a smart ETA message; otherwise we fall back to the static
  // template text.
  const handleSmartStatus = async (template: (typeof QUICK_ACTION_TEMPLATES)[number]) => {
    // Owner/manager triggering a status on an unassigned job: assign a worker first.
    if ((template.id === 'omw' || template.id === 'running-late') &&
        selectedConversation?.type === 'job' &&
        !selectedConversation?.data?.assignedTo &&
        (isOwner || isManager)) {
      setPendingQuickAction(template.id);
      setAssignWorkerDialogOpen(true);
      return;
    }

    const buildStaticMessage = () => {
      const assignedToId = selectedConversation?.data?.assignedTo;
      const isSelfAssigned = assignedToId === currentUser?.id ||
        teamMembers.some((m: any) => (m.id === assignedToId || m.memberId === assignedToId || m.userId === assignedToId) && m.userId === currentUser?.id);
      const workerName = (!isSelfAssigned && selectedConversation?.assignedWorkerName)
        ? selectedConversation.assignedWorkerName.split(' ')[0] : null;
      const namedMsg = workerName ? getWorkerNamedMessage(template.id, workerName) : null;
      const baseMessage = namedMsg || template.message;
      return selectedSmsConversation
        ? applySmsTemplateFields(baseMessage, selectedSmsConversation)
        : baseMessage;
    };

    const focusInput = () => setTimeout(() => smsInputRef.current?.focus(), 0);

    // Real ETA only applies to On my way / Running late on a job conversation.
    const jobId = selectedConversation?.type === 'job'
      ? selectedConversation?.data?.id
      : selectedSmsConversation?.jobId;
    const isEtaAction = template.id === 'omw' || template.id === 'running-late';

    if (isEtaAction && jobId && typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 30000,
          });
        });
        const res = await apiRequest('POST', `/api/jobs/${jobId}/eta-message`, {
          type: template.id === 'running-late' ? 'late' : 'omw',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        const data = await res.json();
        if (data?.message) {
          setSmsNewMessage(data.message);
          focusInput();
          return;
        }
      } catch (err) {
        // Location denied / unavailable or endpoint failed — fall back to static text.
      }
    }

    setSmsNewMessage(buildStaticMessage());
    focusInput();
  };

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    if (params.get('setup') === 'number') {
      setShowSmsUpgrade(true);
      setLocation('/chat', { replace: true });
    }
    const targetUserId = params.get('to');
    const targetType = params.get('type');
    const smsClientId = params.get('smsClientId');
    const smsPhone = params.get('phone');

    if (targetUserId && targetType === 'dm') {
      const member = teamMembers.find(m => m.userId === targetUserId);
      if (member) {
        const user: User = {
          id: member.userId,
          email: member.email,
          firstName: (member.firstName || member.name?.split(' ')[0]) || '',
          lastName: (member.lastName || member.name?.split(' ').slice(1).join(' ')) || '',
          profileImageUrl: member.profileImageUrl,
        };
        setSelectedDirectUser(user);
        setSelectedConversation({
          id: `dm-${member.userId}`,
          type: 'direct',
          title: member.name || '',
          avatar: member.profileImageUrl,
          avatarFallback: getInitials(member.name || ''),
          unreadCount: 0,
          themeColor: member.themeColor,
          data: user,
        });
        setMobileShowChat(true);
      }
    }
    
    const jobId = params.get('job');
    if (jobId && jobs.length > 0) {
      const targetJob = jobs.find(j => j.id === jobId);
      if (targetJob) {
        setFilter('jobs');
        setActiveJobContext(targetJob);
        const clientLookup = new Map<string, any>();
        allClients.forEach((c: any) => clientLookup.set(c.id, c));
        const client = targetJob.clientId ? clientLookup.get(targetJob.clientId) : undefined;
        const clientPhone = client?.phone;
        const clientName = client?.name || targetJob.title;
        
        const jobSms = smsConversations.find(s => s.jobId === jobId || (targetJob.clientId && s.clientId === targetJob.clientId));
        
        if (jobSms) {
          setSelectedSmsConversation(jobSms);
        } else if (clientPhone) {
          setSelectedSmsConversation({
            id: 'new',
            businessOwnerId: '',
            clientId: targetJob.clientId || null,
            clientPhone: clientPhone,
            clientName: clientName,
            jobId: jobId,
            lastMessageAt: null,
            unreadCount: 0,
            deletedAt: null,
          });
        }
        
        setSelectedConversation({
          id: `job-${jobId}`,
          type: 'job',
          title: targetJob.title,
          subtitle: targetJob.address || undefined,
          avatarFallback: targetJob.title.slice(0, 2).toUpperCase(),
          unreadCount: 0,
          jobId: jobId,
          jobStatus: targetJob.status,
          clientName: clientName,
          clientPhone: clientPhone,
          data: targetJob,
        });
        setMobileShowChat(true);
      }
    }
    
    if (smsClientId || smsPhone) {
      const existingConvo = smsConversations.find(c => 
        (smsClientId && c.clientId === smsClientId) ||
        (smsPhone && c.clientPhone === smsPhone)
      );
      
      if (existingConvo) {
        setSelectedSmsConversation(existingConvo);
        setSelectedConversation({
          id: existingConvo.id,
          type: 'client',
          title: existingConvo.clientName || existingConvo.clientPhone,
          subtitle: existingConvo.clientName ? existingConvo.clientPhone : undefined,
          avatarFallback: (existingConvo.clientName || existingConvo.clientPhone || '??').slice(0, 2).toUpperCase(),
          unreadCount: existingConvo.unreadCount,
          clientId: existingConvo.clientId || undefined,
          clientPhone: existingConvo.clientPhone,
          relatedJobs: existingConvo.clientId ? jobs.filter(j => j.clientId === existingConvo.clientId) : [],
          data: existingConvo,
        });
        setMobileShowChat(true);
        markSmsReadMutation.mutate(existingConvo.id);
      } else if (smsPhone) {
        const tempConvo: SmsConversation = {
          id: 'new',
          businessOwnerId: '',
          clientId: smsClientId || null,
          clientPhone: smsPhone,
          clientName: null,
          jobId: null,
          lastMessageAt: null,
          unreadCount: 0,
          deletedAt: null,
        };
        setSelectedSmsConversation(tempConvo);
        setSelectedConversation({
          id: 'new',
          type: 'client',
          title: smsPhone,
          avatarFallback: smsPhone.slice(0, 2).toUpperCase(),
          unreadCount: 0,
          clientPhone: smsPhone,
          data: tempConvo,
        });
        setMobileShowChat(true);
      }
    }
  }, [searchString, teamMembers, smsConversations, jobs, allClients]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [teamMessages, directMessages, smsMessages]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getTeamMemberName = (m: TeamMember) => {
    if (m.firstName || m.lastName) return `${m.firstName || ''} ${m.lastName || ''}`.trim();
    if (m.name) return m.name;
    return m.email?.split('@')[0] || 'Team Member';
  };

  const isAcceptedMember = (m: TeamMember) => m.inviteStatus === 'accepted' || m.status === 'accepted';

  const getUserDisplayName = (user: User) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email?.split('@')[0] || 'User';
  };

  const decodeHtmlEntities = (text: string) => {
    return text
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/');
  };

  const renderSmsBody = (body: string, isOwn: boolean) => {
    const decoded = decodeHtmlEntities(body);
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const parts = decoded.split(urlRegex);
    if (parts.length === 1) return decoded;

    return parts.map((part, i) => {
      if (/^https?:\/\//i.test(part)) {
        let label = 'Open link';
        if (part.includes('/p/')) label = 'Track your job';
        else if (part.includes('/quote')) label = 'View quote';
        else if (part.includes('/invoice')) label = 'View invoice';
        else if (part.includes('jobrunner')) label = 'Open in JobRunner';

        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline font-semibold block mt-1 ${isOwn ? 'text-white/90 hover:text-white' : 'text-primary hover:text-primary/80'}`}
          >
            {label} →
          </a>
        );
      }
      return part;
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, 'h:mm a');
    }
    if (isYesterday(date)) {
      return 'Yesterday';
    }
    return format(date, 'MMM d');
  };

  const buildConversationList = useCallback((): ConversationItem[] => {
    const items: ConversationItem[] = [];
    
    // Team Chat - only show in team filter
    if (filter === 'team') {
      const lastTeamMsg = teamMessages[teamMessages.length - 1];
      items.push({
        id: 'team-chat',
        type: 'team',
        title: 'Team Chat',
        subtitle: `${teamMembers.filter(isAcceptedMember).length + 1} members`,
        avatarFallback: 'TC',
        lastMessage: lastTeamMsg?.message || 'Start a conversation with your team',
        lastMessageTime: lastTeamMsg?.createdAt,
        unreadCount: unreadCounts.teamChat,
        data: null,
      });
      
      // Direct messages - show existing DM conversations first
      const dmUserIds = new Set<string>();
      dmConversations.forEach(dm => {
        const displayName = getUserDisplayName(dm.otherUser);
        dmUserIds.add(dm.otherUser.id);
        items.push({
          id: `dm-${dm.otherUser.id}`,
          type: 'direct',
          title: displayName,
          avatar: dm.otherUser.profileImageUrl,
          avatarFallback: getInitials(displayName),
          lastMessage: dm.lastMessage?.content,
          lastMessageTime: dm.lastMessage?.createdAt,
          unreadCount: dm.unreadCount,
          isOnline: true,
          themeColor: teamMembers.find(m => m.userId === dm.otherUser.id)?.themeColor,
          data: dm.otherUser,
        });
      });

      // Show remaining team members without existing DM conversations
      teamMembers
        .filter(m => isAcceptedMember(m) && m.userId && !dmUserIds.has(m.userId))
        .forEach(member => {
          const memberName = getTeamMemberName(member);
          items.push({
            id: `dm-${member.userId}`,
            type: 'direct',
            title: memberName,
            avatar: member.profileImageUrl,
            avatarFallback: getInitials(memberName),
            lastMessage: 'Start a conversation',
            unreadCount: 0,
            isOnline: false,
            themeColor: member.themeColor,
            data: { id: member.userId, email: member.email, firstName: member.firstName || memberName.split(' ')[0] || '', lastName: member.lastName || memberName.split(' ').slice(1).join(' ') || '', profileImageUrl: member.profileImageUrl } as User,
          });
        });
    }
    
    // JOB-CENTRIC: Build job items with their associated SMS conversations
    if (filter === 'jobs') {
      const jobSmsMap = new Map<string, SmsConversation>();
      smsConversations.forEach(sms => {
        if (sms.jobId) {
          jobSmsMap.set(sms.jobId, sms);
        }
      });
      
      const clientSmsMap = new Map<string, SmsConversation[]>();
      smsConversations.forEach(sms => {
        if (sms.clientId) {
          const existing = clientSmsMap.get(sms.clientId) || [];
          existing.push(sms);
          clientSmsMap.set(sms.clientId, existing);
        }
      });

      const clientLookup = new Map<string, Client>();
      allClients.forEach(c => clientLookup.set(c.id, c));

      const assigneeLookup = new Map<string, TeamMember>();
      teamMembers.filter(isAcceptedMember).forEach(m => {
        if (m.userId) assigneeLookup.set(m.userId, m);
        if (m.memberId) assigneeLookup.set(m.memberId, m);
        if (m.id) assigneeLookup.set(m.id, m);
      });

      const sortedJobs = [...jobs].sort((a, b) => {
        const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return bTime - aTime;
      });
      
      const usedSmsConversationIds = new Set<string>();
      jobSmsMap.forEach(sms => usedSmsConversationIds.add(sms.id));
      
      sortedJobs.forEach(job => {
        const directSms = jobSmsMap.get(job.id);
        let clientSms: SmsConversation | undefined;
        if (!directSms && job.clientId) {
          const clientConvos = clientSmsMap.get(job.clientId) || [];
          clientSms = clientConvos.find(sms => !usedSmsConversationIds.has(sms.id));
        }
        const smsConvo = directSms || clientSms;
        if (smsConvo && !directSms) {
          usedSmsConversationIds.add(smsConvo.id);
        }
        
        const sitePhotoUrl = jobPhotosMap[job.id];

        const resolvedClientName = smsConvo?.clientName || (job.clientId ? clientLookup.get(job.clientId)?.name : undefined);
        const resolvedClientPhone = smsConvo?.clientPhone || (job.clientId ? clientLookup.get(job.clientId)?.phone : undefined);
        
        const canCreateNewSms = resolvedClientPhone && !smsConvo;
        
        const effectiveSmsConvo = smsConvo || (canCreateNewSms ? {
          id: 'new' as string,
          businessOwnerId: '',
          clientId: job.clientId || null,
          clientPhone: resolvedClientPhone,
          clientName: resolvedClientName || job.title,
          jobId: job.id,
          lastMessageAt: null,
          unreadCount: 0,
          deletedAt: null,
        } as SmsConversation : undefined);

        // Resolve assigned worker
        const assignee = job.assignedTo ? assigneeLookup.get(job.assignedTo) : undefined;
        const assignedWorkerName = assignee ? getTeamMemberName(assignee) : undefined;
        const assignedWorkerPhone = assignee?.phone || undefined;

        items.push({
          id: `job-${job.id}`,
          type: 'job',
          title: job.title,
          subtitle: job.address || undefined,
          avatar: sitePhotoUrl || null,
          avatarFallback: job.title.slice(0, 2).toUpperCase(),
          lastMessage: undefined,
          lastMessageTime: effectiveSmsConvo?.lastMessageAt || job.scheduledAt || undefined,
          unreadCount: effectiveSmsConvo?.unreadCount || 0,
          status: job.status,
          jobId: job.id,
          jobStatus: job.status,
          jobAddress: job.address,
          assignedWorkerName,
          assignedWorkerPhone,
          clientId: job.clientId || effectiveSmsConvo?.clientId || undefined,
          clientPhone: resolvedClientPhone || undefined,
          clientName: resolvedClientName || undefined,
          smsConversation: effectiveSmsConvo,
          data: job,
        });
      });

      // Apply job status filter
      if (jobStatusFilter !== 'all') {
        const filteredItems = items.filter(item => item.type !== 'job' || item.jobStatus === jobStatusFilter);
        items.length = 0;
        items.push(...filteredItems);
      }
    }
    
    // ENQUIRIES: SMS conversations not linked to any job
    if (filter === 'enquiries') {
      // Find SMS conversations that don't have a jobId and whose clientId doesn't have jobs
      const clientsWithJobs = new Set<string>();
      jobs.forEach(job => {
        if (job.clientId) clientsWithJobs.add(job.clientId);
      });
      
      smsConversations.forEach(sms => {
        const hasJob = sms.jobId || (sms.clientId && clientsWithJobs.has(sms.clientId));
        if (!hasJob) {
          items.push({
            id: `unassigned-${sms.id}`,
            type: 'unassigned',
            title: sms.clientName || sms.clientPhone,
            subtitle: 'New enquiry - tap to create job',
            avatarFallback: (sms.clientName || sms.clientPhone || '??').slice(0, 2).toUpperCase(),
            lastMessageTime: sms.lastMessageAt || undefined,
            unreadCount: sms.unreadCount,
            clientId: sms.clientId || undefined,
            clientPhone: sms.clientPhone,
            clientName: sms.clientName || undefined,
            smsConversation: sms,
            data: sms,
          });
        }
      });
    }
    
    // Sort: Team first, then by unread, then by most recent message time
    items.sort((a, b) => {
      if (a.type === 'team' && b.type !== 'team') return -1;
      if (b.type === 'team' && a.type !== 'team') return 1;
      if (a.type === 'direct' && b.type !== 'direct' && b.type !== 'team') return -1;
      if (b.type === 'direct' && a.type !== 'direct' && a.type !== 'team') return 1;
      
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (b.unreadCount > 0 && a.unreadCount === 0) return 1;

      const aHasMessages = a.smsConversation?.lastMessageAt != null;
      const bHasMessages = b.smsConversation?.lastMessageAt != null;
      if (aHasMessages && !bHasMessages) return -1;
      if (bHasMessages && !aHasMessages) return 1;
      
      const aTime = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const bTime = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return bTime - aTime;
    });
    
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      return items.filter(item => 
        item.title.toLowerCase().includes(search) ||
        item.subtitle?.toLowerCase().includes(search) ||
        item.clientName?.toLowerCase().includes(search) ||
        item.clientPhone?.toLowerCase().includes(search)
      );
    }
    
    return items;
  }, [filter, jobStatusFilter, teamMessages, dmConversations, smsConversations, jobs, teamMembers, unreadCounts, searchTerm, jobPhotosMap, allClients]);

  // State for active job context when viewing client conversations
  const [activeJobContext, setActiveJobContext] = useState<Job | null>(null);

  const handleConversationClick = (item: ConversationItem) => {
    setSelectedConversation(item);
    setMobileShowChat(true);
    
    if (item.type === 'team') {
      setSelectedDirectUser(null);
      setSelectedSmsConversation(null);
      setActiveJobContext(null);
    } else if (item.type === 'direct') {
      setSelectedDirectUser(item.data);
      setSelectedSmsConversation(null);
      setActiveJobContext(null);
    } else if (item.type === 'job') {
      // Job-centric conversation - set job as context, SMS if available
      setSelectedDirectUser(null);
      setActiveJobContext(item.data); // The job itself
      if (item.smsConversation) {
        setSelectedSmsConversation(item.smsConversation);
        if (item.smsConversation.id !== 'new') {
          markSmsReadMutation.mutate(item.smsConversation.id);
        }
      } else if (item.clientPhone && item.clientId) {
        setSelectedSmsConversation({
          id: 'new',
          businessOwnerId: '',
          clientId: item.clientId,
          clientPhone: item.clientPhone,
          clientName: item.clientName || item.title,
          jobId: item.jobId || null,
          lastMessageAt: null,
          unreadCount: 0,
          deletedAt: null,
        } as SmsConversation);
      } else {
        setSelectedSmsConversation(null);
      }
    } else if (item.type === 'unassigned') {
      // Unassigned SMS - no job context
      setSelectedDirectUser(null);
      setActiveJobContext(null);
      setSelectedSmsConversation(item.smsConversation || item.data);
      if (item.smsConversation && item.smsConversation.id !== 'new') {
        markSmsReadMutation.mutate(item.smsConversation.id);
      }
    }
  };

  const handleBack = () => {
    setSelectedConversation(null);
    setSelectedDirectUser(null);
    setSelectedSmsConversation(null);
    setActiveJobContext(null);
    setMobileShowChat(false);
    setShowContextPanel(false);
  };

  const handleSendTeamMessage = (message: string) => {
    sendTeamMessageMutation.mutate(message);
  };

  const handleSendDirectMessage = () => {
    if (newMessage.trim()) {
      sendDirectMessageMutation.mutate(newMessage.trim());
    }
  };

  const handleSendSms = () => {
    if (!smsNewMessage.trim() || !selectedSmsConversation) return;
    sendSmsMutation.mutate({
      clientId: selectedSmsConversation.clientId || undefined,
      clientPhone: selectedSmsConversation.clientPhone,
      message: smsNewMessage.trim(),
      jobId: selectedSmsConversation.jobId || activeJobContext?.id || undefined,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendDirectMessage();
    }
  };

  const handleSmsKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendSms();
    }
  };

  const formatAustralianPhone = (input: string): string => {
    const cleaned = input.replace(/[^\d+]/g, '');
    
    if (cleaned.startsWith('+614')) {
      const digits = cleaned.slice(3);
      if (digits.length <= 3) return `+61 ${digits}`;
      if (digits.length <= 6) return `+61 ${digits.slice(0, 3)} ${digits.slice(3)}`;
      return `+61 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
    }
    
    if (cleaned.startsWith('04')) {
      if (cleaned.length <= 4) return cleaned;
      if (cleaned.length <= 7) return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 10)}`;
    }
    
    return input;
  };

  const normalizePhoneForApi = (phone: string): string => {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    if (cleaned.startsWith('04') && cleaned.length === 10) {
      return '+61' + cleaned.slice(1);
    }
    return cleaned;
  };

  const validateAustralianPhone = (phone: string): string | null => {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    if (cleaned.startsWith('+61')) {
      const digits = cleaned.slice(3);
      if (digits.length !== 9) {
        return 'Australian mobile numbers should have 9 digits after +61 (e.g., +61 412 345 678)';
      }
      if (!digits.startsWith('4')) {
        return 'Australian mobile numbers should start with 4 after +61';
      }
      return null;
    }
    
    if (cleaned.startsWith('04')) {
      if (cleaned.length !== 10) {
        return 'Australian mobile numbers should be 10 digits (e.g., 0412 345 678)';
      }
      return null;
    }
    
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      return null;
    }
    
    return 'Please enter a valid Australian phone number (e.g., 0412 345 678 or +61 412 345 678)';
  };

  const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatAustralianPhone(e.target.value);
    setNewSmsPhoneNumber(formatted);
    setNewSmsPhoneError('');
  };

  const filteredClients = useMemo(() => {
    if (!newSmsClientSearch.trim()) return [];
    const search = newSmsClientSearch.toLowerCase();
    return allClients
      .filter(c => 
        (c.name?.toLowerCase().includes(search) || 
         c.phone?.toLowerCase().includes(search) ||
         c.email?.toLowerCase().includes(search)) &&
        c.phone
      )
      .slice(0, 5);
  }, [allClients, newSmsClientSearch]);

  const resetNewSmsDialog = () => {
    setNewSmsClientSearch('');
    setNewSmsSelectedClient(null);
    setNewSmsPhoneNumber('');
    setNewSmsInitialMessage('');
    setNewSmsPhoneError('');
  };

  const handleStartNewSms = () => {
    if (!newSmsSelectedClient && newSmsPhoneNumber) {
      const error = validateAustralianPhone(newSmsPhoneNumber);
      if (error) {
        setNewSmsPhoneError(error);
        return;
      }
    }
    
    const phone = newSmsSelectedClient?.phone || normalizePhoneForApi(newSmsPhoneNumber);
    const clientId = newSmsSelectedClient?.id;
    const clientName = newSmsSelectedClient?.name;
    
    if (!phone) {
      setNewSmsPhoneError('Please select a client or enter a phone number');
      return;
    }
    
    const existingConvo = smsConversations.find(c => 
      (clientId && c.clientId === clientId) || 
      c.clientPhone === phone
    );
    
    if (existingConvo) {
      setSelectedSmsConversation(existingConvo);
      setSelectedConversation({
        id: existingConvo.id,
        type: 'client',
        title: existingConvo.clientName || existingConvo.clientPhone,
        avatarFallback: (existingConvo.clientName || existingConvo.clientPhone || '??').slice(0, 2).toUpperCase(),
        unreadCount: existingConvo.unreadCount,
        clientId: existingConvo.clientId || undefined,
        clientPhone: existingConvo.clientPhone,
        relatedJobs: existingConvo.clientId ? jobs.filter(j => j.clientId === existingConvo.clientId) : [],
        data: existingConvo,
      });
      setMobileShowChat(true);
      markSmsReadMutation.mutate(existingConvo.id);
      
      if (newSmsInitialMessage.trim()) {
        sendSmsMutation.mutate({
          clientId: existingConvo.clientId || undefined,
          clientPhone: existingConvo.clientPhone,
          message: newSmsInitialMessage.trim(),
        });
      }
    } else {
      const tempConvo: SmsConversation = {
        id: 'new',
        businessOwnerId: '',
        clientId: clientId || null,
        clientPhone: phone,
        clientName: clientName || null,
        jobId: null,
        lastMessageAt: null,
        unreadCount: 0,
        deletedAt: null,
      };
      setSelectedSmsConversation(tempConvo);
      setSelectedConversation({
        id: 'new',
        type: 'client',
        title: clientName || phone,
        avatarFallback: (clientName || phone).slice(0, 2).toUpperCase(),
        unreadCount: 0,
        clientPhone: phone,
        data: tempConvo,
      });
      setMobileShowChat(true);
      
      if (newSmsInitialMessage.trim()) {
        sendSmsMutation.mutate({
          clientId: clientId,
          clientPhone: phone,
          message: newSmsInitialMessage.trim(),
        });
      }
    }
    
    setNewSmsDialogOpen(false);
    resetNewSmsDialog();
  };

  const handleSearchNumbers = async () => {
    setNumberSearchLoading(true);
    setNumberSearched(true);
    try {
      const params = new URLSearchParams();
      if (numberSearchArea) params.set('areaCode', numberSearchArea);
      params.set('limit', '8');
      const response = await apiRequest('GET', `/api/sms/available-numbers?${params.toString()}`);
      const data = await response.json();
      setAvailableNumbers(data.numbers || []);
    } catch (error: any) {
      toast({ title: 'Failed to search numbers', description: error.message, variant: 'destructive' });
    } finally {
      setNumberSearchLoading(false);
    }
  };

  const handlePurchaseNumber = async (phoneNumber: string) => {
    setPurchasingNumber(phoneNumber);
    try {
      await apiRequest('POST', '/api/sms/purchase-number', { phoneNumber });
      toast({ title: 'Number purchased', description: `${phoneNumber} is now your business texting number.` });
      setShowSmsUpgrade(false);
      setAvailableNumbers([]);
      setNumberSearched(false);
      queryClient.invalidateQueries({ queryKey: ['/api/sms/config'] });
    } catch (error: any) {
      let errorMsg = 'Failed to purchase number. Please try again.';
      try {
        const raw = error.message || '';
        const jsonStart = raw.indexOf('{');
        if (jsonStart >= 0) {
          const parsed = JSON.parse(raw.substring(jsonStart));
          errorMsg = parsed.error || errorMsg;
        } else {
          errorMsg = raw;
        }
      } catch {}
      toast({ title: 'Purchase failed', description: errorMsg, variant: 'destructive' });
    } finally {
      setPurchasingNumber(null);
    }
  };

  const enquiryConversations = useMemo(() => {
    const clientsWithJobs = new Set<string>();
    jobs.forEach(job => {
      if (job.clientId) clientsWithJobs.add(job.clientId);
    });
    return smsConversations.filter(sms => !sms.jobId && !(sms.clientId && clientsWithJobs.has(sms.clientId)));
  }, [smsConversations, jobs]);
  const enquiryCount = enquiryConversations.length;
  const enquiryUnreadCount = enquiryConversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  const jobSmsUnreadCount = smsConversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0) - enquiryUnreadCount;
  const pinnedMessages = teamMessages.filter(m => m.isPinned);
  const conversationList = buildConversationList();
  const isLoading = teamLoading || dmLoading || jobsLoading || smsLoading;

  // Personalized title for tradies (team members) vs owners
  const isTradie = !isOwner && !isManager;
  const firstName = currentUser?.firstName || 'there';
  
  const renderConversationList = () => (
    <div className="flex flex-col h-full bg-muted/30" data-testid="conversation-list">
      {/* Premium header with ios-title */}
      <div className="shrink-0 px-3 pt-3 pb-2 bg-background border-b animate-fade-up">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                 style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
              <MessageCircle className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight leading-tight">
                {isTradie ? `Hey ${firstName}` : 'Job Communications'}
              </h1>
              <p className="ios-caption text-[11px] mt-0 flex items-center gap-1">
                {isTradie ? 'Your jobs & team chat' : 'Messages, SMS & team chat'}
                {smsSocketConnected ? (
                  <span className="inline-flex items-center gap-0.5 text-green-600 dark:text-green-400">
                    <Wifi className="h-2.5 w-2.5" />
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-muted-foreground/50">
                    <WifiOff className="h-2.5 w-2.5" />
                  </span>
                )}
              </p>
            </div>
          </div>
          {!isTradie && (
            <div className="flex items-center">
              <Button
                onClick={() => setShowSmsUpgrade(true)}
                size="icon"
                variant="ghost"
                data-testid="button-sms-settings"
              >
                <SettingsIcon className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => canTwoWayText ? setNewSmsDialogOpen(true) : undefined}
                size="icon"
                variant="ghost"
                data-testid="button-new-sms"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-2 animate-fade-up stagger-delay-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-xs border bg-muted/50 focus-visible:ring-1 rounded-lg"
            data-testid="input-search"
          />
        </div>

        {/* Pill-shaped filter tabs */}
        <div className="bg-muted/60 rounded-lg p-0.5 flex gap-0.5 animate-fade-up stagger-delay-2">
          <button
            onClick={() => setFilter('jobs')}
            className={`flex-1 flex items-center justify-center gap-1 text-[11px] font-medium py-1.5 rounded-md transition-all ${
              filter === 'jobs'
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground'
            }`}
            data-testid="filter-jobs"
          >
            <Briefcase className="h-3 w-3" />
            {isTradie ? 'My Jobs' : 'Jobs'}
            {jobSmsUnreadCount > 0 && (
              <span className="min-w-[14px] h-3.5 rounded-full text-[9px] font-bold flex items-center justify-center px-0.5"
                    style={{ backgroundColor: 'hsl(var(--trade) / 0.15)', color: 'hsl(var(--trade))' }}>
                {jobSmsUnreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilter('enquiries')}
            className={`flex-1 flex items-center justify-center gap-1 text-[11px] font-medium py-1.5 rounded-md transition-all ${
              filter === 'enquiries'
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground'
            }`}
            data-testid="filter-enquiries"
          >
            <MessageCircle className="h-3 w-3" />
            Enquiries
            {enquiryCount > 0 && (
              <span className="min-w-[14px] h-3.5 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 text-[9px] font-bold flex items-center justify-center px-0.5">
                {enquiryCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilter('team')}
            className={`flex-1 flex items-center justify-center gap-1 text-[11px] font-medium py-1.5 rounded-md transition-all ${
              filter === 'team'
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground'
            }`}
            data-testid="filter-team"
          >
            <Users className="h-3 w-3" />
            Team
            {(unreadCounts.teamChat + unreadCounts.directMessages) > 0 && (
              <span className="min-w-[14px] h-3.5 rounded-full bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center px-0.5">
                {unreadCounts.teamChat + unreadCounts.directMessages}
              </span>
            )}
          </button>
        </div>
        {/* Job status sub-filter pills */}
        {filter === 'jobs' && (
          <div className="flex gap-1 mt-2 overflow-x-auto no-scrollbar animate-fade-up stagger-delay-3">
            {[
              { value: 'all', label: 'All' },
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'done', label: 'Done' },
              { value: 'invoiced', label: 'Invoiced' },
              { value: 'pending', label: 'Pending' },
            ].map(status => (
              <button
                key={status.value}
                onClick={() => setJobStatusFilter(status.value)}
                className={`text-[11px] font-medium px-3 py-1 rounded-full shrink-0 transition-all flex items-center gap-1.5 ${
                  jobStatusFilter === status.value
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground'
                }`}
                data-testid={`filter-status-${status.value}`}
              >
                {status.value !== 'all' && (
                  <Circle 
                    className="h-2 w-2" 
                    style={{ 
                      fill: jobStatusFilter === status.value ? 'currentColor' : (STATUS_COLORS[status.value] || '#6B7280'),
                      color: jobStatusFilter === status.value ? 'currentColor' : (STATUS_COLORS[status.value] || '#6B7280')
                    }} 
                  />
                )}
                {status.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <OfflineBanner />

      {/* Conversation list */}
      <ScrollArea className="flex-1 px-1">
        {isLoading ? (
          <ConversationSkeleton />
        ) : conversationList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 animate-fade-up">
            {filter === 'jobs' ? (
              <>
                <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                     style={{ backgroundColor: 'hsl(var(--trade) / 0.08)' }}>
                  <Briefcase className="h-10 w-10" style={{ color: 'hsl(var(--trade) / 0.4)' }} />
                </div>
                <p className="text-[15px] font-semibold mb-1">
                  {jobStatusFilter !== 'all' ? `No ${STATUS_LABELS[jobStatusFilter]?.toLowerCase() || jobStatusFilter} jobs` : (isTradie ? 'No jobs assigned yet' : 'No jobs yet')}
                </p>
                <p className="ios-caption text-center max-w-[240px] mb-4">
                  {jobStatusFilter !== 'all' 
                    ? 'Try changing the filter to see other jobs'
                    : (isTradie 
                      ? "When you're assigned a job, it'll appear here" 
                      : 'Create your first job to start messaging clients')}
                </p>
                {!isTradie && jobStatusFilter === 'all' && (
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="gap-1.5"
                    onClick={() => setLocation('/jobs')}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Job
                  </Button>
                )}
              </>
            ) : filter === 'enquiries' ? (
              <>
                <div className="w-20 h-20 rounded-full bg-orange-500/8 flex items-center justify-center mb-4">
                  <MessageCircle className="h-10 w-10 text-orange-500/40" />
                </div>
                <p className="text-[15px] font-semibold mb-1">No new enquiries</p>
                <p className="ios-caption text-center max-w-[240px]">
                  When clients text your business number, they'll appear here
                </p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full bg-primary/8 flex items-center justify-center mb-4">
                  <Users className="h-10 w-10 text-primary/40" />
                </div>
                <p className="text-[15px] font-semibold mb-1">Team chat is ready</p>
                <p className="ios-caption text-center max-w-[240px]">
                  {isTradie ? 'Chat with your team and the boss' : 'Start chatting with your team'}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="py-1">
            {conversationList.map((item, index) => {
              const isSelected = selectedConversation?.id === item.id;
              const hasUnread = item.unreadCount > 0;
              const prevItem = index > 0 ? conversationList[index - 1] : null;
              const showSectionHeader = !prevItem || prevItem.type !== item.type;
              const staggerClass = index < 8 ? `stagger-delay-${index + 1}` : '';
              
              return (
                <div key={item.id}>
                  
                  <div
                    className={`flex items-start gap-2.5 px-2.5 py-2 cursor-pointer rounded-lg transition-colors animate-fade-up ${staggerClass} ${
                      isSelected 
                        ? 'bg-accent'
                        : 'hover:bg-muted/60'
                    }`}
                    style={isSelected ? { boxShadow: 'inset 3px 0 0 hsl(var(--trade))' } : undefined}
                    onClick={() => handleConversationClick(item)}
                    data-testid={`conversation-${item.id}`}
                  >
                    {/* Avatar/Icon */}
                    <div className="relative shrink-0 mt-0.5">
                      {item.type === 'team' ? (
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                             style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                          <Users className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                        </div>
                      ) : item.type === 'job' ? (
                        <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <Briefcase className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                      ) : item.type === 'unassigned' ? (
                        <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                          <MessageCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        </div>
                      ) : (
                        <UserAvatar
                          className="h-9 w-9"
                          fallbackClassName="text-xs"
                          user={{
                            id: item.data?.id ?? item.title,
                            name: item.title,
                            photoUrl: item.avatar,
                            themeColor: item.themeColor,
                          }}
                        />
                      )}
                      {item.isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${hasUnread ? 'font-bold' : 'font-semibold'}`}>
                          {item.title}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.lastMessageTime && (
                            <span className="ios-caption text-[10px]">
                              {formatTime(item.lastMessageTime)}
                            </span>
                          )}
                          {hasUnread && (
                            <span className="min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 text-white"
                                  style={{ backgroundColor: 'hsl(var(--trade))' }}>
                              {item.unreadCount > 99 ? '99+' : item.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Job cards: client name + assigned worker + address */}
                      {item.type === 'job' && item.clientName && (
                        <p className="text-xs truncate mt-0.5 flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{item.clientName}</span>
                        </p>
                      )}
                      {item.type === 'job' && item.assignedWorkerName && (
                        <p className="ios-caption text-[11px] truncate mt-0.5 flex items-center gap-1">
                          <Wrench className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{item.assignedWorkerName}</span>
                          {item.assignedWorkerPhone && (
                            <a 
                              href={`tel:${item.assignedWorkerPhone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="shrink-0"
                              style={{ color: 'hsl(var(--trade))' }}
                            >
                              <Phone className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </p>
                      )}
                      {item.type === 'job' && item.subtitle && (
                        <p className="ios-caption text-[11px] truncate mt-0.5 flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{item.subtitle}</span>
                        </p>
                      )}
                      
                      {/* Non-job items: standard subtitle */}
                      {item.type !== 'job' && item.subtitle && (
                        <p className="ios-caption truncate mt-0.5">
                          {item.subtitle}
                        </p>
                      )}
                      
                      {/* Job status badge + SMS indicator */}
                      {item.type === 'job' && item.jobStatus && (
                        <div className="flex items-center gap-2 flex-wrap mt-1.5">
                          <Badge 
                            variant="secondary" 
                            className="text-[10px] h-5 px-1.5"
                            style={{ 
                              backgroundColor: `${STATUS_COLORS[item.jobStatus]}15`,
                              color: STATUS_COLORS[item.jobStatus]
                            }}
                          >
                            {STATUS_LABELS[item.jobStatus] || item.jobStatus}
                          </Badge>
                          {item.smsConversation && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Phone className="h-2.5 w-2.5" />
                              SMS
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Unassigned: show phone number */}
                      {item.type === 'unassigned' && item.clientPhone && (
                        <p className="ios-caption text-[10px] mt-1">
                          {item.clientPhone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  const renderChatView = () => {
    if (!selectedConversation) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center" data-testid="empty-chat-view">
          <div className="text-center">
            <MessageCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-medium text-muted-foreground mb-1">No conversation selected</h3>
            <p className="text-sm text-muted-foreground/70">
              Choose from the sidebar to start messaging
            </p>
          </div>
        </div>
      );
    }

    if (selectedConversation.type === 'team') {
      return (
        <div className="flex-1 flex flex-col overflow-hidden" data-testid="team-chat-view">
          {/* Minimal header */}
          <div className="shrink-0 h-14 px-4 border-b bg-background flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={handleBack} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-medium text-sm">Team Chat</h2>
              <p className="text-[11px] text-muted-foreground">
                {teamMembers.filter(isAcceptedMember).length + 1} members
              </p>
            </div>
            {pinnedMessages.length > 0 && (
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
                <Pin className="h-3 w-3" />
                {pinnedMessages.length}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowContextPanel(!showContextPanel)}
              data-testid="button-toggle-context"
            >
              {showContextPanel ? <PanelRightClose className="h-4 w-4" /> : <Info className="h-4 w-4" />}
            </Button>
          </div>

          <ScrollArea className="flex-1 px-4 py-2" ref={scrollRef}>
            {teamMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Users className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-sm mb-1">Team chat's quiet</h3>
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  Share updates, coordinate jobs, or check in with your crew
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {teamMessages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    id={msg.id}
                    message={msg.message}
                    messageType={msg.messageType}
                    senderId={msg.senderId}
                    senderName={msg.senderName}
                    senderAvatar={msg.senderAvatar}
                    isCurrentUser={msg.senderId === currentUser?.id}
                    isAnnouncement={msg.isAnnouncement}
                    isPinned={msg.isPinned}
                    attachmentUrl={msg.attachmentUrl}
                    attachmentName={msg.attachmentName}
                    createdAt={msg.createdAt}
                    onPin={(isOwner || isManager) ? (id, pinned) => pinMessageMutation.mutate({ messageId: id, pinned }) : undefined}
                    onDelete={msg.senderId === currentUser?.id || isOwner ? (id) => deleteMessageMutation.mutate(id) : undefined}
                    canPin={isOwner || isManager}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Sticky composer */}
          <div className="shrink-0 px-4 py-4 border-t bg-background">
            <ChatComposer
              onSend={handleSendTeamMessage}
              placeholder="Message your team..."
              disabled={sendTeamMessageMutation.isPending}
            />
          </div>
        </div>
      );
    }

    if (selectedConversation.type === 'direct' && selectedDirectUser) {
      return (
        <div className="flex-1 flex flex-col overflow-hidden" data-testid="direct-chat-view">
          {/* Minimal header */}
          <div className="shrink-0 h-14 px-4 border-b bg-background flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={handleBack} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="relative shrink-0">
              <UserAvatar
                className="h-9 w-9"
                fallbackClassName="text-xs"
                user={{
                  id: selectedDirectUser.id,
                  firstName: selectedDirectUser.firstName,
                  lastName: selectedDirectUser.lastName,
                  email: selectedDirectUser.email,
                  photoUrl: selectedDirectUser.profileImageUrl,
                  themeColor: selectedConversation?.themeColor,
                }}
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-medium text-sm truncate">{getUserDisplayName(selectedDirectUser)}</h2>
              <p className="text-[11px] text-muted-foreground truncate">Online</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowContextPanel(!showContextPanel)}
              data-testid="button-toggle-context"
            >
              {showContextPanel ? <PanelRightClose className="h-4 w-4" /> : <Info className="h-4 w-4" />}
            </Button>
          </div>

          <ScrollArea className="flex-1 px-4 py-2">
            {directMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                  <MessageCircle className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-sm mb-1">Start chatting</h3>
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  Message {getUserDisplayName(selectedDirectUser)} directly
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {directMessages.map((msg) => {
                  const isOwn = msg.senderId !== selectedDirectUser.id;
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? 'justify-end' : ''}`}>
                          <span className={`text-[10px] ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {formatTime(msg.createdAt)}
                          </span>
                          {isOwn && (msg.isRead ? <CheckCheck className="h-3 w-3 text-primary-foreground/70" /> : <Check className="h-3 w-3 text-primary-foreground/70" />)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Sticky composer */}
          <div className="shrink-0 px-4 py-4 border-t bg-background">
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
                data-testid="input-message"
              />
              <Button 
                onClick={handleSendDirectMessage} 
                disabled={!newMessage.trim() || sendDirectMessageMutation.isPending} 
                size="icon"
                data-testid="button-send"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Job-centric or unassigned SMS view
    if ((selectedConversation.type === 'job' || selectedConversation.type === 'unassigned' || selectedConversation.type === 'client') && (selectedSmsConversation || selectedConversation.type === 'job')) {
      const isJobView = selectedConversation.type === 'job';
      // Get job from activeJobContext or from the selected conversation's data
      const job = isJobView ? (activeJobContext || selectedConversation.data) : null;
      
      return (
        <div className="flex-1 flex flex-col overflow-hidden" data-testid={isJobView ? "job-chat-view" : "unassigned-chat-view"}>
          {/* Header - shows job info for job view, client info for unassigned */}
          <div className="shrink-0 h-14 px-4 border-b bg-background flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={handleBack} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            {isJobView && job ? (
              <>
                {jobPhotosMap[job.id] ? (
                  <img 
                    src={jobPhotosMap[job.id]} 
                    alt={job.title}
                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Briefcase className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium text-sm truncate">{job.title}</h2>
                    <Badge 
                      variant="secondary" 
                      className="text-[10px] px-1.5 shrink-0"
                      style={{ 
                        backgroundColor: `${STATUS_COLORS[job.status]}20`,
                        color: STATUS_COLORS[job.status]
                      }}
                    >
                      {STATUS_LABELS[job.status] || job.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                    {selectedSmsConversation && (
                      <span className="truncate">
                        {selectedSmsConversation.clientName || selectedSmsConversation.clientPhone}
                      </span>
                    )}
                    {job.scheduledAt && (
                      <>
                        {selectedSmsConversation && <span className="text-muted-foreground/50">•</span>}
                        <span className="flex items-center gap-0.5 shrink-0">
                          <Calendar className="h-2.5 w-2.5" />
                          {format(new Date(job.scheduledAt), 'MMM d')}
                        </span>
                      </>
                    )}
                    {job.address && (
                      <>
                        <span className="text-muted-foreground/50">•</span>
                        <span className="truncate flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" />
                          {job.address.split(',')[0]}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                  <MessageCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-medium text-sm truncate">
                    {selectedSmsConversation?.clientName || selectedSmsConversation?.clientPhone || 'New Enquiry'}
                  </h2>
                  {selectedSmsConversation?.clientName ? (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {selectedSmsConversation.clientPhone}
                    </p>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">No job linked</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5 gap-1 text-primary">
                            <Briefcase className="h-2.5 w-2.5" />
                            Link to Job
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64 max-h-64 overflow-y-auto">
                          <DropdownMenuLabel className="text-xs">Select a job</DropdownMenuLabel>
                          {jobs.length === 0 ? (
                            <DropdownMenuItem disabled>No jobs available</DropdownMenuItem>
                          ) : (
                            jobs.slice(0, 20).map(job => (
                              <DropdownMenuItem
                                key={job.id}
                                onClick={() => {
                                  if (selectedSmsConversation && selectedSmsConversation.id !== 'new') {
                                    linkJobMutation.mutate({ conversationId: selectedSmsConversation.id, jobId: job.id });
                                  }
                                }}
                                className="flex flex-col items-start gap-0.5"
                              >
                                <span className="text-sm font-medium truncate w-full">{job.title}</span>
                                {job.address && <span className="text-[10px] text-muted-foreground truncate w-full">{job.address}</span>}
                              </DropdownMenuItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              </>
            )}
            
            {/* Actions - one-tap call, SMS, and job view */}
            <div className="flex items-center gap-1">
              {selectedSmsConversation && (
                <>
                  <a href={`tel:${selectedSmsConversation.clientPhone}`}>
                    <Button variant="ghost" size="icon" data-testid="button-call" title="Call client">
                      <Phone className="h-4 w-4" />
                    </Button>
                  </a>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => smsInputRef.current?.focus()}
                    data-testid="button-sms"
                    title="Send SMS"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </>
              )}
              {isJobView && job && (
                <>
                  {/* Mobile: icon-only button */}
                  <Button 
                    variant="ghost"
                    size="icon"
                    className="sm:hidden"
                    onClick={() => setLocation(`/jobs/${job.id}`)}
                    data-testid="button-view-job-mobile"
                    title="View Job"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  {/* Desktop: text button */}
                  <Button 
                    variant="secondary"
                    size="sm"
                    className="hidden sm:flex gap-1.5"
                    onClick={() => setLocation(`/jobs/${job.id}`)}
                    data-testid="button-view-job"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View Job
                  </Button>
                </>
              )}
              <Button variant="ghost" size="icon" onClick={() => setShowContextPanel(!showContextPanel)} data-testid="button-toggle-context">
                {showContextPanel ? <PanelRightClose className="h-4 w-4" /> : <Info className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <OfflineBanner />

          {selectedSmsConversation && isUnknownClient && selectedSmsConversation.id !== 'new' && (
            <div className="shrink-0 mx-3 mt-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Unknown contact</span>
                </div>
                <Button size="sm" className="h-6 text-xs gap-1" onClick={handleOpenCreateClientDialog} data-testid="button-create-client-from-sms">
                  <Plus className="h-3 w-3" />
                  Add Client
                </Button>
              </div>
            </div>
          )}

          <ScrollArea className="flex-1 px-4 py-2">
            {!selectedSmsConversation || smsMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                  {isJobView ? <MessageCircle className="h-7 w-7 text-muted-foreground" /> : <Phone className="h-7 w-7 text-muted-foreground" />}
                </div>
                <h3 className="font-medium text-sm mb-1">
                  {isJobView && !selectedSmsConversation ? 'No client messages yet' : 'Start the conversation'}
                </h3>
                <p className="text-xs text-muted-foreground text-center max-w-xs mb-3">
                  {isJobView && !selectedSmsConversation 
                    ? 'Add a client phone number to send SMS from this job'
                    : `Use the quick actions above to message ${selectedSmsConversation?.clientName || 'your customer'}`}
                </p>
                {isJobView && !selectedSmsConversation && job && (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1.5"
                      onClick={() => setLocation(`/jobs/${job.id}`)}
                    >
                      <Briefcase className="h-3.5 w-3.5" />
                      Edit Job
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {smsMessages.map((msg) => {
                  const isOwn = msg.direction === 'outbound';
                  const isJobRequest = msg.isJobRequest && msg.direction === 'inbound';
                  const jobAlreadyCreated = !!msg.jobCreatedFromSms;
                  
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[75%] space-y-1.5">
                        {isJobRequest && (
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge variant="secondary" className="bg-blue-500/15 text-blue-700 dark:text-blue-400 text-[10px] h-5">
                              <Briefcase className="h-2.5 w-2.5 mr-0.5" />
                              {msg.intentType?.replace('_', ' ') || 'Request'}
                            </Badge>
                            {jobAlreadyCreated && (
                              <Badge variant="secondary" className="bg-green-500/15 text-green-700 dark:text-green-400 text-[10px] h-5">
                                <Check className="h-2.5 w-2.5 mr-0.5" />
                                Job Created
                              </Badge>
                            )}
                          </div>
                        )}
                        
                        <div className={`rounded-2xl px-3.5 py-2 ${isOwn ? 'bg-green-600 text-white' : 'bg-muted'}`}>
                          {msg.mediaUrls && Array.isArray(msg.mediaUrls) && msg.mediaUrls.length > 0 && (
                            <div className={`flex flex-col gap-1 ${msg.body ? 'mb-1.5' : ''}`}>
                              {msg.mediaUrls.map((url: string, i: number) => (
                                <a key={`media-${i}`} href={url} target="_blank" rel="noopener noreferrer">
                                  <img
                                    src={url}
                                    alt="MMS attachment"
                                    className="rounded-lg max-w-[200px] max-h-[200px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                  />
                                </a>
                              ))}
                            </div>
                          )}
                          {msg.body ? (
                            <p className="text-sm whitespace-pre-wrap break-words overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{renderSmsBody(msg.body, isOwn)}</p>
                          ) : null}
                          <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? 'justify-end' : ''}`}>
                            <span className={`text-[10px] ${isOwn ? 'text-white/70' : 'text-muted-foreground'}`}>
                              {formatTime(msg.createdAt)}
                            </span>
                            {isOwn && msg.status === 'delivered' && <CheckCheck className="h-3 w-3 text-white/70" />}
                            {isOwn && msg.status === 'sent' && <Check className="h-3 w-3 text-white/70" />}
                            {isOwn && msg.status === 'pending' && <Clock className="h-3 w-3 text-white/70" />}
                            {isOwn && msg.status === 'failed' && <AlertTriangle className="h-3 w-3 text-red-300" />}
                          </div>
                        </div>
                        
                        {isOwn && msg.status === 'failed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs gap-1 text-red-600 dark:text-red-400"
                            onClick={() => {
                              if (selectedSmsConversation) {
                                sendSmsMutation.mutate({
                                  clientId: selectedSmsConversation.clientId || undefined,
                                  clientPhone: selectedSmsConversation.clientPhone,
                                  message: msg.body,
                                  jobId: selectedSmsConversation.jobId || activeJobContext?.id || undefined,
                                });
                              }
                            }}
                            disabled={sendSmsMutation.isPending}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Retry
                          </Button>
                        )}
                        
                        {isJobRequest && !jobAlreadyCreated && (
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1"
                            disabled={createJobFromSmsMutation.isPending}
                            onClick={() => createJobFromSmsMutation.mutate(msg.id)}
                            data-testid={`button-create-job-${msg.id}`}
                          >
                            {createJobFromSmsMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Briefcase className="h-3 w-3" />}
                            Create Job
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Sticky composer - only show if there's an SMS conversation or if we can start one */}
          {selectedSmsConversation ? (
            <div className="shrink-0 border-t bg-background">
              {/* Quick Actions + quick replies merged into a single strip */}
              <QuickRepliesBar
                context={{
                  clientName: selectedSmsConversation?.clientName ?? null,
                  jobTitle: (selectedSmsConversation?.jobId
                    ? jobs.find(j => j.id === selectedSmsConversation.jobId)?.title
                    : undefined) ?? null,
                  jobDate: (selectedSmsConversation?.jobId
                    ? jobs.find(j => j.id === selectedSmsConversation.jobId)?.scheduledAt
                    : undefined) ?? null,
                }}
                draft={smsNewMessage}
                disabled={!twilioConnected || !canTwoWayText}
                excludeLabels={['On my way', 'Running late', 'Job done']}
                onInsert={(text) => {
                  setSmsNewMessage((prev) => (prev.trim().length > 0 ? `${prev.trimEnd()} ${text}` : text));
                  setTimeout(() => smsInputRef.current?.focus(), 0);
                }}
                leadingActions={<>
                  {/* Primary quick actions */}
                  {QUICK_ACTION_TEMPLATES.filter(t => t.primary).map((template) => {
                    const Icon = template.icon;
                    return (
                      <Button
                        key={template.id}
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-1.5 bg-background"
                        onClick={() => handleSmartStatus(template)}
                        data-testid={`quick-action-${template.id}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {template.label}
                      </Button>
                    );
                  })}
                  
                  {/* Template picker dropdown for additional templates */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="shrink-0 gap-1 text-muted-foreground" data-testid="template-picker">
                        <FileText className="h-3.5 w-3.5" />
                        Templates
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
                      {isJobView && job && (
                        <>
                          <DropdownMenuLabel className="text-xs">Job Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => setLocation(`/quotes/new?jobId=${job.id}&clientId=${job.clientId || ''}`)}
                            className="gap-2"
                          >
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">Create Quote</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setLocation(`/invoices/new?jobId=${job.id}&clientId=${job.clientId || ''}`)}
                            className="gap-2"
                          >
                            <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">Create Invoice</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setLocation(`/jobs/${job.id}`)}
                            className="gap-2"
                          >
                            <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">Set Reminder</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {(currentJobQuotes.length > 0 || currentJobInvoices.length > 0) && (
                            <>
                              <DropdownMenuLabel className="text-xs">Client Links</DropdownMenuLabel>
                              {currentJobQuotes.map((quote: any) => (
                                <DropdownMenuItem
                                  key={`quote-${quote.id}`}
                                  onClick={() => {
                                    const url = `${window.location.origin}/q/${quote.acceptanceToken}`;
                                    const clientFirst = selectedSmsConversation?.clientName?.split(' ')[0] || '';
                                    const greeting = clientFirst ? `Hi ${clientFirst}, here` : 'Here';
                                    const message = `${greeting}'s your quote - you can view, accept, or pay the deposit right from this link: ${url}`;
                                    setSmsNewMessage(message);
                                  }}
                                  className="gap-2"
                                >
                                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-sm">Send Quote Link</span>
                                </DropdownMenuItem>
                              ))}
                              {currentJobInvoices.map((invoice: any) => (
                                <DropdownMenuItem
                                  key={`invoice-${invoice.id}`}
                                  onClick={() => {
                                    const url = `${window.location.origin}/portal/invoice/${invoice.paymentToken}`;
                                    const clientFirst = selectedSmsConversation?.clientName?.split(' ')[0] || '';
                                    const greeting = clientFirst ? `Hi ${clientFirst}, here` : 'Here';
                                    const message = `${greeting}'s your invoice - you can view and pay online here: ${url}`;
                                    setSmsNewMessage(message);
                                  }}
                                  className="gap-2"
                                >
                                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-sm">Send Invoice Link</span>
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                            </>
                          )}
                        </>
                      )}
                      <DropdownMenuLabel className="text-xs">More Quick Messages</DropdownMenuLabel>
                      {QUICK_ACTION_TEMPLATES.filter(t => !t.primary).map((template) => {
                        const Icon = template.icon;
                        return (
                          <DropdownMenuItem
                            key={template.id}
                            onClick={() => {
                              const message = selectedSmsConversation 
                                ? applySmsTemplateFields(template.message, selectedSmsConversation)
                                : template.message;
                              setSmsNewMessage(message);
                            }}
                            className="gap-2"
                          >
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">{template.label}</span>
                          </DropdownMenuItem>
                        );
                      })}
                      
                      {userSmsTemplates.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs">Your Templates</DropdownMenuLabel>
                          {userSmsTemplates.map((template) => (
                            <DropdownMenuItem
                              key={template.id}
                              onClick={() => {
                                const message = selectedSmsConversation 
                                  ? applySmsTemplateFields(template.body, selectedSmsConversation)
                                  : template.body;
                                setSmsNewMessage(message);
                              }}
                              className="gap-2"
                            >
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm truncate">{template.name}</span>
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>}
              />
              {!twilioConnected && (
                <div className="px-4 pt-2">
                  <TwilioWarning compact />
                </div>
              )}
              {canTwoWayText && twilioConnected && !smsConfig?.hasDedicatedNumber && (
                <div className="px-4 pt-2">
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                    <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-blue-800 dark:text-blue-300">Messages sent via shared JobRunner number</p>
                      <p className="text-[10px] text-blue-600 dark:text-blue-400">Get your own number so customers see your business.</p>
                    </div>
                    <Button size="sm" variant="outline" className="text-xs shrink-0 h-7" onClick={() => setShowSmsUpgrade(true)}>
                      Get Number
                    </Button>
                  </div>
                </div>
              )}
              {/* Message input */}
              <div className="px-4 py-3 flex gap-2">
                <Input
                  ref={smsInputRef}
                  placeholder={!twilioConnected ? "SMS not available — check Twilio setup" : !canTwoWayText ? "SMS service unavailable..." : "Type a message..."}
                  value={smsNewMessage}
                  onChange={(e) => setSmsNewMessage(e.target.value)}
                  onKeyPress={handleSmsKeyPress}
                  className="flex-1"
                  disabled={!twilioConnected || !canTwoWayText}
                  data-testid="input-sms-message"
                />
                <Button 
                  onClick={handleSendSms} 
                  disabled={!twilioConnected || !canTwoWayText || !smsNewMessage.trim() || sendSmsMutation.isPending} 
                  size="icon"
                  data-testid="button-send-sms"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : isJobView && job ? (
            <div className="shrink-0 border-t bg-background p-4">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <MessageCircle className="h-4 w-4" />
                <span>Add a client phone number to start SMS</span>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="h-auto p-0"
                  onClick={() => setLocation(`/jobs/${job.id}`)}
                >
                  Edit Job
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      );
    }

    return null;
  };

  const renderContextPanel = () => {
    if (!selectedConversation) return null;

    if (selectedConversation.type === 'team') {
      return (
        <div className="flex flex-col h-full">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">Team Info</h3>
            <Button variant="ghost" size="icon" onClick={() => setShowContextPanel(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <ScrollArea className="flex-1 p-4">
            {pinnedMessages.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Pin className="h-3 w-3" />
                  Pinned Messages
                </h4>
                <div className="space-y-2">
                  {pinnedMessages.slice(0, 3).map((msg) => (
                    <div key={msg.id} className="p-2 rounded-lg bg-muted/50 text-xs">
                      <p className="font-medium mb-0.5">{msg.senderName}</p>
                      <p className="text-muted-foreground line-clamp-2">{msg.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Users className="h-3 w-3" />
                Members ({teamMembers.filter(isAcceptedMember).length + 1})
              </h4>
              <div className="space-y-2">
                {teamMembers.filter(isAcceptedMember).map((member) => {
                  const memberName = getTeamMemberName(member);
                  const handleStartDM = () => {
                    const user: User = {
                      id: member.userId,
                      email: member.email,
                      firstName: member.firstName || memberName.split(' ')[0],
                      lastName: member.lastName || memberName.split(' ').slice(1).join(' '),
                      profileImageUrl: member.profileImageUrl,
                    };
                    const dmConversation: ConversationItem = {
                      id: `dm-${member.userId}`,
                      type: 'direct',
                      title: memberName,
                      avatar: member.profileImageUrl,
                      avatarFallback: getInitials(memberName),
                      unreadCount: 0,
                      themeColor: member.themeColor,
                      data: user,
                    };
                    setSelectedConversation(dmConversation);
                    setSelectedDirectUser(user);
                    setSelectedSmsConversation(null);
                    setMobileShowChat(true);
                    setShowContextPanel(false);
                  };
                  
                  return (
                    <div 
                      key={member.id} 
                      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                      onClick={handleStartDM}
                      data-testid={`team-member-${member.userId}`}
                    >
                      <div className="relative">
                        <UserAvatar
                          className="h-7 w-7"
                          fallbackClassName="text-[10px]"
                          user={{
                            id: member.userId || member.id,
                            name: memberName,
                            firstName: member.firstName,
                            lastName: member.lastName,
                            email: member.email,
                            photoUrl: member.profileImageUrl,
                            themeColor: member.themeColor,
                          }}
                        />
                        <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 border border-background" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{memberName}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{member.role}</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); handleStartDM(); }}
                        data-testid={`dm-button-${member.userId}`}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        </div>
      );
    }

    if (['client', 'job', 'unassigned'].includes(selectedConversation.type) && selectedSmsConversation) {
      return (
        <ClientInsightsPanel
          clientId={selectedSmsConversation.clientId}
          clientPhone={selectedSmsConversation.clientPhone}
          conversationId={selectedSmsConversation.id}
          onClose={() => setShowContextPanel(false)}
          onNavigateToJob={(jobId) => { 
            setShowContextPanel(false); 
            setLocation(`/jobs/${jobId}`); 
          }}
          onNavigateToInvoice={(invoiceId) => { 
            setShowContextPanel(false); 
            setLocation(`/invoices/${invoiceId}`); 
          }}
          onCreateJob={() => { 
            setShowContextPanel(false); 
            setLocation('/jobs/new?clientId=' + selectedSmsConversation.clientId); 
          }}
          onCreateQuote={() => { 
            setShowContextPanel(false); 
            setLocation('/quotes/new?clientId=' + selectedSmsConversation.clientId); 
          }}
          activeJobContext={activeJobContext}
          onJobContextChange={(job) => setActiveJobContext(job)}
          relatedJobs={selectedConversation.relatedJobs}
        />
      );
    }

    if (selectedConversation.type === 'direct' && selectedDirectUser) {
      return (
        <div className="flex flex-col h-full">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">Contact Info</h3>
            <Button variant="ghost" size="icon" onClick={() => setShowContextPanel(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="p-4">
            <div className="flex flex-col items-center mb-4">
              <UserAvatar
                className="h-16 w-16 mb-2"
                user={{
                  id: selectedDirectUser.id,
                  firstName: selectedDirectUser.firstName,
                  lastName: selectedDirectUser.lastName,
                  email: selectedDirectUser.email,
                  photoUrl: selectedDirectUser.profileImageUrl,
                  themeColor: selectedConversation?.themeColor,
                }}
              />
              <h4 className="font-medium">{getUserDisplayName(selectedDirectUser)}</h4>
              <p className="text-sm text-muted-foreground">{selectedDirectUser.email}</p>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex h-full overflow-hidden bg-background" data-testid="chat-hub">
      {/* Left sidebar - conversation list */}
      <div className={`w-full md:w-72 lg:w-80 shrink-0 border-r min-w-0 ${mobileShowChat ? 'hidden md:flex md:flex-col' : 'flex flex-col'}`}>
        {renderConversationList()}
      </div>

      {/* Center - chat view (hero area) */}
      <div className={`flex-1 flex flex-col min-w-0 bg-background ${!mobileShowChat ? 'hidden md:flex' : 'flex'}`}>
        {renderChatView()}
      </div>

      {/* Right panel - context (collapsible) */}
      {showContextPanel && selectedConversation && (
        <div className="hidden xl:flex w-80 shrink-0 border-l bg-muted/30 flex-col" data-testid="context-panel">
          {renderContextPanel()}
        </div>
      )}

      {/* Mobile sheet for context panel */}
      <Sheet open={showContextPanel && !!selectedConversation} onOpenChange={setShowContextPanel}>
        <SheetContent side="right" className="w-[85vw] sm:w-[350px] p-0 xl:hidden" hideClose>
          {renderContextPanel()}
        </SheetContent>
      </Sheet>

      <Dialog open={newSmsDialogOpen} onOpenChange={(open) => {
        setNewSmsDialogOpen(open);
        if (!open) resetNewSmsDialog();
      }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-new-sms">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-green-600" />
              New SMS
            </DialogTitle>
            <DialogDescription>
              Search for a client or enter a phone number
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {newSmsSelectedClient && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{newSmsSelectedClient.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{newSmsSelectedClient.phone}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { setNewSmsSelectedClient(null); setNewSmsClientSearch(''); }} data-testid="button-clear-selected-client">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {!newSmsSelectedClient && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="client-search">Search clients</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="client-search"
                      placeholder="Search by name or phone..."
                      value={newSmsClientSearch}
                      onChange={(e) => setNewSmsClientSearch(e.target.value)}
                      className="pl-9"
                      data-testid="input-client-search"
                    />
                  </div>

                  {filteredClients.length > 0 && (
                    <div className="rounded-lg border divide-y max-h-48 overflow-y-auto">
                      {filteredClients.map((client) => (
                        <div
                          key={client.id}
                          className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
                          onClick={() => { setNewSmsSelectedClient(client); setNewSmsClientSearch(''); setNewSmsPhoneNumber(''); }}
                          data-testid={`client-option-${client.id}`}
                        >
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{client.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{client.phone}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone-number">Enter phone number</Label>
                  <Input
                    id="phone-number"
                    placeholder="0412 345 678"
                    value={newSmsPhoneNumber}
                    onChange={handlePhoneInputChange}
                    className={newSmsPhoneError ? 'border-destructive' : ''}
                    data-testid="input-phone-number"
                  />
                  {newSmsPhoneError && <p className="text-xs text-destructive">{newSmsPhoneError}</p>}
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="initial-message">Message (optional)</Label>
              <Input
                id="initial-message"
                placeholder="Type your first message..."
                value={newSmsInitialMessage}
                onChange={(e) => setNewSmsInitialMessage(e.target.value)}
                data-testid="input-initial-message"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSmsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartNewSms} disabled={!newSmsSelectedClient && !newSmsPhoneNumber} className="bg-green-600 hover:bg-green-700" data-testid="button-start-sms">
              Start Conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createClientDialogOpen} onOpenChange={setCreateClientDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-create-client">
          <DialogHeader>
            <DialogTitle>Create New Client</DialogTitle>
            <DialogDescription>
              Add this phone number as a new client
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-client-name">Name *</Label>
              <Input id="new-client-name" placeholder="Client name" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} data-testid="input-new-client-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-client-phone">Phone</Label>
              <Input id="new-client-phone" value={newClientPhone} disabled className="bg-muted" data-testid="input-new-client-phone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-client-email">Email</Label>
              <Input id="new-client-email" type="email" placeholder="email@example.com" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} data-testid="input-new-client-email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-client-address">Address</Label>
              <Input id="new-client-address" placeholder="123 Main St" value={newClientAddress} onChange={(e) => setNewClientAddress(e.target.value)} data-testid="input-new-client-address" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateClientDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateClientSubmit} disabled={!newClientName.trim() || createClientFromSmsMutation.isPending} data-testid="button-create-client-submit">
              {createClientFromSmsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignWorkerDialogOpen} onOpenChange={(open) => { if (!open) { setAssignWorkerDialogOpen(false); setPendingQuickAction(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Assign a worker first
            </DialogTitle>
            <DialogDescription>
              This job doesn't have a worker assigned yet. Choose a team member to assign, or skip and send the message anyway.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {currentUser && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => {
                  if (selectedConversation?.data?.id && currentUser.id) {
                    assignWorkerMutation.mutate({ jobId: selectedConversation.data.id, memberId: currentUser.id });
                  }
                }}
                disabled={assignWorkerMutation.isPending}
              >
                <UserAvatar
                  className="h-8 w-8"
                  user={{
                    id: currentUser.id,
                    firstName: currentUser.firstName,
                    lastName: currentUser.lastName,
                    email: currentUser.email,
                    photoUrl: currentUser.profileImageUrl,
                    themeColor: teamMembers.find(m => m.userId === currentUser.id)?.themeColor,
                  }}
                />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">{getUserDisplayName(currentUser)}</span>
                  <span className="text-xs text-muted-foreground">Assign myself</span>
                </div>
              </Button>
            )}
            {(isOwner || isManager) && teamMembers.filter(isAcceptedMember).filter(m => m.userId !== currentUser?.id).map((member) => (
              <Button
                key={member.id}
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => {
                  if (selectedConversation?.data?.id) {
                    assignWorkerMutation.mutate({ jobId: selectedConversation.data.id, memberId: member.id });
                  }
                }}
                disabled={assignWorkerMutation.isPending}
              >
                <UserAvatar
                  className="h-8 w-8"
                  user={{
                    id: member.userId || member.id,
                    name: getTeamMemberName(member),
                    firstName: member.firstName,
                    lastName: member.lastName,
                    email: member.email,
                    photoUrl: member.profileImageUrl,
                    themeColor: member.themeColor,
                  }}
                />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">{getTeamMemberName(member)}</span>
                  <span className="text-xs text-muted-foreground">{member.role}</span>
                </div>
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                if (pendingQuickAction) {
                  const template = QUICK_ACTION_TEMPLATES.find(t => t.id === pendingQuickAction);
                  if (template) {
                    const assignedToId = selectedConversation?.data?.assignedTo;
                    const isSelfAssigned = assignedToId === currentUser?.id ||
                      teamMembers.some((m: any) => (m.id === assignedToId || m.memberId === assignedToId || m.userId === assignedToId) && m.userId === currentUser?.id);
                    const workerName = (!isSelfAssigned && selectedConversation?.assignedWorkerName)
                      ? selectedConversation.assignedWorkerName.split(' ')[0] : null;
                    const namedMsg = workerName ? getWorkerNamedMessage(template.id, workerName) : null;
                    const baseMessage = namedMsg || template.message;
                    const message = selectedSmsConversation
                      ? applySmsTemplateFields(baseMessage, selectedSmsConversation)
                      : baseMessage;
                    setSmsNewMessage(message);
                  }
                }
                setPendingQuickAction(null);
                setAssignWorkerDialogOpen(false);
              }}
            >
              Skip - send anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!smsToDelete} onOpenChange={(open) => !open && setSmsToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-sms">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this SMS conversation with {smsToDelete?.clientName || smsToDelete?.clientPhone}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => smsToDelete && deleteSmsConversationMutation.mutate(smsToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSmsConversationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showSmsUpgrade} onOpenChange={setShowSmsUpgrade}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Get a Dedicated Business Number
            </DialogTitle>
            <DialogDescription>
              Get your own Australian phone number so customers see your business, not the shared JobRunner number.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <p className="text-sm font-medium">Why get a dedicated number?</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You can already send and receive SMS through the shared JobRunner number. 
                  A dedicated number means customers see your business number instead — put it on your website, 
                  Google listing, business cards, and van for a professional look.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg border space-y-1">
                  <div className="flex items-center gap-1.5">
                    <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                    <p className="text-xs font-medium">Two-Way Texting</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Send and receive SMS from clients directly</p>
                </div>
                <div className="p-2.5 rounded-lg border space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5 text-blue-600" />
                    <p className="text-xs font-medium">Auto-Link to Jobs</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Messages auto-match to the right client and job</p>
                </div>
                <div className="p-2.5 rounded-lg border space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Bell className="h-3.5 w-3.5 text-amber-600" />
                    <p className="text-xs font-medium">Smart Notifications</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Get alerted when clients reply to your messages</p>
                </div>
                <div className="p-2.5 rounded-lg border space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-purple-600" />
                    <p className="text-xs font-medium">Professional Look</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Your own number — not a shared platform number</p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Choose Your Number</p>
                <Badge variant="secondary" className="text-[10px]">~$3 AUD/month</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Search for available Australian numbers. You can search by area code (e.g., 02 for Sydney, 07 for QLD) or browse mobile numbers.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Area code (e.g., 07) or leave blank for mobile"
                  value={numberSearchArea}
                  onChange={(e) => setNumberSearchArea(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="flex-1"
                />
                <Button onClick={handleSearchNumbers} disabled={numberSearchLoading}>
                  {numberSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
                  {numberSearchLoading ? '' : 'Search'}
                </Button>
              </div>

              {numberSearched && availableNumbers.length === 0 && !numberSearchLoading && (
                <div className="p-4 text-center text-sm text-muted-foreground rounded-lg border border-dashed">
                  <Phone className="h-6 w-6 mx-auto mb-2 opacity-40" />
                  No numbers found for that area code. Try a different code or leave blank for mobile numbers.
                </div>
              )}

              {availableNumbers.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {availableNumbers.map((num: any) => (
                    <div key={num.phoneNumber} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border hover-elevate">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono font-medium">{num.friendlyName || num.phoneNumber}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {num.locality && <span>{num.locality}</span>}
                          {num.region && <span>{num.region}</span>}
                          <span className="flex items-center gap-0.5">
                            <MessageCircle className="h-2.5 w-2.5" /> SMS
                            {num.capabilities?.voice && <><Phone className="h-2.5 w-2.5 ml-1" /> Voice</>}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handlePurchaseNumber(num.phoneNumber)}
                        disabled={!!purchasingNumber}
                      >
                        {purchasingNumber === num.phoneNumber ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          'Get This Number'
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {smsConfig?.dedicatedPhoneNumber && (
              <>
                <Separator />
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">Your Number</p>
                    <p className="text-sm font-mono text-green-700 dark:text-green-400">{smsConfig.dedicatedPhoneNumber}</p>
                  </div>
                  <Badge className="bg-green-600">Active</Badge>
                </div>
              </>
            )}

            <div className="p-2.5 rounded-lg bg-muted/30 border">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Numbers are provided through Twilio and billed at approximately $3 AUD/month. 
                SMS messages are charged at standard rates (~$0.06/SMS). 
                You can release your number anytime from Settings.
                Two-way SMS is already included through the shared JobRunner number. A dedicated number is optional — it gives your business a professional look.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
