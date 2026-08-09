import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAppMode } from "@/hooks/use-app-mode";
import { useFeatureAccess } from "@/hooks/use-subscription";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Phone,
  Mic,
  Clock,
  Users,
  Save,
  Loader2,
  PhoneCall,
  Settings,
  ArrowRight,
  Plus,
  Trash2,
  Volume2,
  CheckCircle,
  AlertCircle,
  PhoneForwarded,
  Play,
  Square,
  BookOpen,
  MessageCircle,
  HelpCircle,
  DollarSign,
  FileText,
  Send,
  Sparkles,
  MessageSquare,
  Zap,
  AlertTriangle,
} from "lucide-react";

interface KnowledgeBankContent {
  faqs?: Array<{ question: string; answer: string }>;
  serviceDescriptions?: string;
  pricingInfo?: string;
  specialInstructions?: string;
}

interface VoiceChangeRequest {
  id: string;
  requestedDescription: string;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

interface ReceptionistConfig {
  enabled: boolean;
  mode: string;
  voice: string;
  greeting: string | null;
  transferNumbers: TransferNumber[];
  businessHours: BusinessHours | null;
  dedicatedPhoneNumber: string | null;
  vapiAssistantId: string | null;
  approvalStatus: string;
  provisioningError: string | null;
  provisionedAt: string | null;
  approvedAt: string | null;
  knowledgeBank: KnowledgeBankContent | null;
  smsNotifications?: boolean;
  recordingEnabled?: boolean;
  lastLatencyMs?: number | null;
  latencyStatus?: 'optimal' | 'amber' | 'warn' | null;
  lastLatencyCheckedAt?: string | null;
}

interface TransferNumber {
  name: string;
  phone: string;
  priority: number;
}

interface BusinessHours {
  start: string;
  end: string;
  timezone: string;
  days: number[];
}

interface VoiceOption {
  id: string;
  name: string;
  description: string;
  accent: string;
}

interface TeamAvailability {
  memberId: string;
  name: string;
  phone: string | null;
  available: boolean;
}

const MODE_OPTIONS = [
  { value: "off", label: "Off", description: "AI receptionist is disabled" },
  { value: "after_hours", label: "After Hours Only", description: "Answers calls outside business hours" },
  { value: "always_on_transfer", label: "Always On (with transfer)", description: "Answers all calls, can transfer to team" },
  { value: "always_on_message", label: "Always On (message only)", description: "Answers all calls, takes messages only" },
  { value: "selective", label: "Selective (new callers only)", description: "Only answers calls from unknown numbers" },
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TIMEZONE_OPTIONS = [
  "Australia/Brisbane",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Adelaide",
  "Australia/Perth",
  "Australia/Darwin",
  "Australia/Hobart",
];

const VOICE_CONFIGS: Record<string, { text: string; rate: number; pitch: number }> = {
  Jess: { text: "G'day, thanks for calling. How can I help you today?", rate: 1.0, pitch: 1.15 },
  Harry: { text: "Hello there, you've reached our office. What can I do for you?", rate: 0.9, pitch: 0.85 },
  Chris: { text: "Good morning, thanks for getting in touch. How may I assist?", rate: 0.95, pitch: 1.0 },
};

function VoicePreviewButton({ voiceId, voiceName }: { voiceId: string; voiceName: string }) {
  const [playing, setPlaying] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const handlePreview = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!speechSupported) return;
    if (playing) {
      window.speechSynthesis.cancel();
      setPlaying(false);
      return;
    }

    const voiceConfig = VOICE_CONFIGS[voiceName] || { text: "Hello, thanks for calling. How can I help you today?", rate: 0.95, pitch: 1.0 };
    const utterance = new SpeechSynthesisUtterance(voiceConfig.text);
    utterance.lang = "en-AU";
    utterance.rate = voiceConfig.rate;
    utterance.pitch = voiceConfig.pitch;

    const voices = window.speechSynthesis.getVoices();
    const ausVoice = voices.find(v => v.lang.includes("en-AU") || v.lang.includes("en_AU"));
    if (ausVoice) utterance.voice = ausVoice;

    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);
    utteranceRef.current = utterance;
    setPlaying(true);
    window.speechSynthesis.speak(utterance);
  }, [playing, voiceName, speechSupported]);

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={handlePreview}
      disabled={!speechSupported}
      data-testid={`button-preview-voice-${voiceId}`}
    >
      {playing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
    </Button>
  );
}

function MyAvailabilityToggle() {
  const { toast } = useToast();
  const [localAvailable, setLocalAvailable] = useState<boolean | null>(null);

  const { data: myRole } = useQuery<{ teamMember?: { aiReceptionistAvailability?: boolean } }>({
    queryKey: ["/api/team/my-role"],
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const available = localAvailable ?? (myRole?.teamMember?.aiReceptionistAvailability !== false);

  const toggleMutation = useMutation({
    mutationFn: async (newAvailable: boolean) => {
      return apiRequest("PATCH", "/api/ai-receptionist/availability", { available: newAvailable });
    },
    onSuccess: (_, newAvailable) => {
      setLocalAvailable(newAvailable);
      queryClient.invalidateQueries({ queryKey: ["/api/team/my-role"] });
      toast({ title: "Availability updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update availability", variant: "destructive" });
    },
  });

  if (!myRole?.teamMember) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Phone className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
          My Call Transfer Availability
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm">Receive transferred calls from the AI receptionist</p>
            <p className="text-xs text-muted-foreground mt-1">
              When available, the AI can transfer callers to you directly.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                available
                  ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0"
                  : ""
              }
            >
              {available ? "Available" : "Unavailable"}
            </Badge>
            <Switch
              checked={available}
              onCheckedChange={(checked) => toggleMutation.mutate(checked)}
              disabled={toggleMutation.isPending}
              data-testid="switch-my-availability"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AIReceptionist() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { isOwner, isManager, isTeam, isOfficeAdmin, hasPermission } = useAppMode();
  const canManageAiReceptionist = hasPermission('manage_ai_receptionist');

  const { canPurchaseAddons, isLoading: subscriptionLoading } = useFeatureAccess();
  const canManageConfig = isOwner || isManager || isOfficeAdmin || canManageAiReceptionist;
  const canToggleEnabled = isOwner || isOfficeAdmin || canManageAiReceptionist;

  const [checkoutReturn, setCheckoutReturn] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('provisioning') === 'true';
  });

  const { data: config, isLoading: configLoading, isError: configError } = useQuery<ReceptionistConfig>({
    queryKey: ["/api/ai-receptionist/config"],
    enabled: canManageConfig,
    refetchInterval: (query) => {
      const status = query.state.data?.approvalStatus;
      if (status === 'provisioning') return 3000;
      if (checkoutReturn) return 3000;
      return false;
    },
  });

  const { data: voices = [] } = useQuery<VoiceOption[]>({
    queryKey: ["/api/ai-receptionist/voices"],
    enabled: canManageConfig,
  });

  const { data: analytics } = useQuery<{
    avgMeasuredLatencyMs: number | null;
    latencySampleSize: number;
    latencyMismatch: boolean;
  }>({
    queryKey: ["/api/ai-receptionist/analytics"],
    enabled: canManageConfig && !!config?.vapiAssistantId,
    refetchInterval: 60000,
  });

  const { data: teamAvailability = [], refetch: refetchAvailability } = useQuery<TeamAvailability[]>({
    queryKey: ["/api/ai-receptionist/team/availability"],
    enabled: isTeam && canManageConfig,
  });

  useEffect(() => {
    if (checkoutReturn) {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-receptionist/config"] });
      window.history.replaceState({}, '', window.location.pathname);
      const timeout = setTimeout(() => setCheckoutReturn(false), 60000);
      return () => clearTimeout(timeout);
    }
    return;
  }, [checkoutReturn]);

  useEffect(() => {
    if (checkoutReturn && config?.approvalStatus && config.approvalStatus !== 'none' && config.approvalStatus !== 'provisioning') {
      setCheckoutReturn(false);
    }
  }, [checkoutReturn, config?.approvalStatus]);

  const { data: voiceRequests = [] } = useQuery<VoiceChangeRequest[]>({
    queryKey: ["/api/ai-receptionist/voice-requests"],
    enabled: canManageConfig,
  });

  const [knowledgeBank, setKnowledgeBank] = useState<KnowledgeBankContent>({});
  const [kbInitialized, setKbInitialized] = useState(false);
  const [voiceRequestDescription, setVoiceRequestDescription] = useState("");

  useEffect(() => {
    if (config?.knowledgeBank && !kbInitialized) {
      setKnowledgeBank(config.knowledgeBank);
      setKbInitialized(true);
    }
  }, [config?.knowledgeBank, kbInitialized]);

  const saveKnowledgeBankMutation = useMutation({
    mutationFn: async (data: KnowledgeBankContent) => {
      return apiRequest("PATCH", "/api/ai-receptionist/config", { knowledgeBank: data });
    },
    onSuccess: async (res: any) => {
      const updated = await (res as Response).json().catch(() => null);
      const latencyMs: number | null = updated?.lastLatencyMs ?? null;
      const latencyStatus: string | null = updated?.latencyStatus ?? null;
      if (latencyStatus === 'warn') {
        toast({
          title: 'Knowledge Bank saved — but response time is slow',
          description: `Estimated ${latencyMs}ms (target <1000ms). Try trimming your training content.`,
          variant: 'destructive',
        });
      } else if (latencyStatus === 'amber') {
        toast({
          title: 'Knowledge Bank saved',
          description: `Synced — response time ~${latencyMs}ms (slightly above 1000ms target).`,
        });
      } else {
        toast({ title: 'Knowledge Bank saved', description: 'Your training content has been synced to the AI.' });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/ai-receptionist/config"] });
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message || "Failed to save knowledge bank", variant: "destructive" });
    },
  });

  const submitVoiceRequestMutation = useMutation({
    mutationFn: async (description: string) => {
      return apiRequest("POST", "/api/ai-receptionist/voice-requests", { requestedDescription: description });
    },
    onSuccess: () => {
      toast({ title: "Voice request submitted", description: "We'll review your request and get back to you." });
      setVoiceRequestDescription("");
      queryClient.invalidateQueries({ queryKey: ["/api/ai-receptionist/voice-requests"] });
    },
    onError: (error: Error) => {
      toast({ title: "Request failed", description: error.message || "Failed to submit voice request", variant: "destructive" });
    },
  });

  const addFaq = () => {
    setKnowledgeBank(prev => ({
      ...prev,
      faqs: [...(prev.faqs || []), { question: "", answer: "" }],
    }));
  };

  const removeFaq = (index: number) => {
    setKnowledgeBank(prev => ({
      ...prev,
      faqs: (prev.faqs || []).filter((_, i) => i !== index),
    }));
  };

  const updateFaq = (index: number, field: "question" | "answer", value: string) => {
    setKnowledgeBank(prev => ({
      ...prev,
      faqs: (prev.faqs || []).map((faq, i) => i === index ? { ...faq, [field]: value } : faq),
    }));
  };

  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<{
    mode: string;
    voice: string;
    greeting: string;
    transferNumbers: TransferNumber[];
    businessHours: BusinessHours;
    smsNotifications: boolean;
    recordingEnabled: boolean;
  } | null>(null);

  const initForm = () => {
    setFormData({
      mode: config?.mode || "off",
      voice: config?.voice || "Jess",
      greeting: config?.greeting || "",
      transferNumbers: (config?.transferNumbers || []) as TransferNumber[],
      businessHours: (config?.businessHours as BusinessHours) || {
        start: "08:00",
        end: "17:00",
        timezone: "Australia/Brisbane",
        days: [1, 2, 3, 4, 5],
      },
      smsNotifications: config?.smsNotifications || false,
      recordingEnabled: config?.recordingEnabled || false,
    });
    setEditMode(true);
  };

  interface ConfigPayload {
    voice: string;
    greeting?: string;
    mode: string;
    transferNumbers: TransferNumber[];
    businessHours?: BusinessHours;
    smsNotifications?: boolean;
    recordingEnabled?: boolean;
  }

  const hasExistingConfig = !!config;

  const saveConfigMutation = useMutation({
    mutationFn: async (data: ConfigPayload) => {
      if (hasExistingConfig) {
        return apiRequest("PATCH", "/api/ai-receptionist/config", data);
      }
      return apiRequest("POST", "/api/ai-receptionist/config", data);
    },
    onSuccess: async (res: any) => {
      const updated = await (res as Response).json().catch(() => null);
      const latencyMs: number | null = updated?.lastLatencyMs ?? null;
      const latencyStatus: string | null = updated?.latencyStatus ?? null;
      if (latencyStatus === 'warn') {
        toast({
          title: 'Saved — but response time is slow',
          description: `Estimated ${latencyMs}ms (target <1000ms). Try shortening your greeting or knowledge bank.`,
          variant: 'destructive',
        });
      } else if (latencyStatus === 'amber') {
        toast({
          title: 'Saved',
          description: `Response time ~${latencyMs}ms (slightly above 1000ms target).`,
        });
      } else {
        toast({ title: 'Settings saved', description: 'AI Receptionist configuration updated' });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/ai-receptionist/config"] });
      setEditMode(false);
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message || "Failed to save settings", variant: "destructive" });
    },
  });

  const measureLatencyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai-receptionist/measure-latency");
      return (res as Response).json();
    },
    onSuccess: (data: { lastLatencyMs: number; latencyStatus: 'optimal' | 'amber' | 'warn' }) => {
      const label = data.latencyStatus === 'optimal'
        ? 'Excellent — under 1000ms target (includes 0.8s anti-interruption pause)'
        : data.latencyStatus === 'amber'
          ? 'Acceptable, but above 1000ms target'
          : 'Slow — exceeds 1200ms ceiling';
      toast({
        title: `Estimated response time: ${data.lastLatencyMs}ms`,
        description: label,
        variant: data.latencyStatus === 'warn' ? 'destructive' : 'default',
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-receptionist/config"] });
    },
    onError: (error: Error) => {
      toast({ title: 'Test failed', description: error.message || 'Could not measure latency', variant: 'destructive' });
    },
  });

  const toggleEnabledMutation = useMutation({
    mutationFn: async (enable: boolean) => {
      return apiRequest("POST", `/api/ai-receptionist/${enable ? "enable" : "disable"}`);
    },
    onSuccess: (_, enable) => {
      toast({ title: enable ? "AI Receptionist enabled" : "AI Receptionist disabled" });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-receptionist/config"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to toggle AI Receptionist", variant: "destructive" });
    },
  });

  const toggleAvailabilityMutation = useMutation({
    mutationFn: async ({ memberId, available }: { memberId: string; available: boolean }) => {
      return apiRequest("PATCH", `/api/ai-receptionist/team/${memberId}/availability`, { available });
    },
    onSuccess: () => {
      refetchAvailability();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update availability", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!formData) return;
    saveConfigMutation.mutate({
      voice: formData.voice,
      greeting: formData.greeting || undefined,
      mode: formData.mode,
      transferNumbers: formData.transferNumbers,
      businessHours: formData.mode === "after_hours" ? formData.businessHours : undefined,
      smsNotifications: formData.smsNotifications,
      recordingEnabled: formData.recordingEnabled,
    });
  };

  const addTransferNumber = () => {
    if (!formData) return;
    setFormData({
      ...formData,
      transferNumbers: [
        ...formData.transferNumbers,
        { name: "", phone: "", priority: formData.transferNumbers.length + 1 },
      ],
    });
  };

  const removeTransferNumber = (index: number) => {
    if (!formData) return;
    setFormData({
      ...formData,
      transferNumbers: formData.transferNumbers.filter((_, i) => i !== index),
    });
  };

  const updateTransferNumber = (index: number, field: keyof TransferNumber, value: string | number) => {
    if (!formData) return;
    const updated = [...formData.transferNumbers];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, transferNumbers: updated });
  };

  const toggleBusinessDay = (day: number) => {
    if (!formData) return;
    const days = formData.businessHours.days.includes(day)
      ? formData.businessHours.days.filter((d) => d !== day)
      : [...formData.businessHours.days, day].sort();
    setFormData({
      ...formData,
      businessHours: { ...formData.businessHours, days },
    });
  };

  if (!canManageConfig) {
    return (
      <PageShell>
        <PageHeader title="AI Receptionist" />
        <div className="p-4 max-w-3xl mx-auto space-y-4">
          <MyAvailabilityToggle />
        </div>
      </PageShell>
    );
  }

  if (!subscriptionLoading && !canPurchaseAddons) {
    return (
      <PageShell>
        <PageHeader title="AI Receptionist" />
        <div className="p-4 max-w-3xl mx-auto">
          <Card>
            <CardContent className="flex flex-col items-center text-center py-12 px-6">
              <div className="rounded-full p-4 mb-5" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                <Phone className="h-8 w-8" style={{ color: 'hsl(var(--trade))' }} />
              </div>
              <h2 className="text-xl font-semibold mb-2">AI Receptionist</h2>
              <p className="text-muted-foreground mb-4 max-w-sm">
                Never miss a call again. Your AI receptionist answers calls 24/7, takes messages, captures leads, and can transfer callers to your team.
              </p>
              <div className="space-y-2 text-sm text-left w-full max-w-xs mb-6">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                  <span>Dedicated Australian phone number</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                  <span>AI-powered with natural Australian voice</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                  <span>Automatic lead capture and job creation</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                  <span>Call transfer to your team members</span>
                </div>
              </div>
              <div className="bg-muted/50 rounded-md p-4 mb-6 w-full">
                <p className="text-sm text-muted-foreground">Available as an add-on with Pro or Team plan</p>
                <p className="text-2xl font-bold mt-1">$30/month</p>
              </div>
              <Button onClick={() => setLocation("/settings?tab=billing")} data-testid="button-upgrade-ai-receptionist">
                <Sparkles className="h-4 w-4 mr-2" />
                Upgrade to Pro
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  if (configLoading) {
    return (
      <PageShell>
        <PageHeader title="AI Receptionist" />
        <div className="space-y-4 p-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </PageShell>
    );
  }

  if (configError) {
    return (
      <PageShell>
        <PageHeader title="AI Receptionist" />
        <div className="p-4 max-w-3xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
              <p className="text-sm text-muted-foreground">
                Unable to load AI Receptionist settings. You may not have permission to access this feature.
              </p>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  const isEnabled = config?.enabled || false;
  const currentMode = config?.mode || "off";
  const currentVoice = config?.voice || "Jess";
  const approvalStatus = config?.approvalStatus || "none";
  const isProvisioning = approvalStatus === "provisioning" || (checkoutReturn && (approvalStatus === "none" || !config));
  const isPendingApproval = approvalStatus === "pending_approval";
  const isFailed = approvalStatus === "failed";
  const isApproved = approvalStatus === "approved" || approvalStatus === "active";
  const hasNoNumber = !config?.dedicatedPhoneNumber && !config?.vapiAssistantId && approvalStatus === "none";

  if (hasNoNumber && !isProvisioning) {
    return (
      <PageShell>
        <PageHeader title="AI Receptionist" />
        <div className="p-4 max-w-3xl mx-auto">
          <Card>
            <CardContent className="flex flex-col items-center text-center py-12 px-6">
              <div className="rounded-full p-4 mb-5 bg-amber-100 dark:bg-amber-900/30">
                <Phone className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Dedicated Number Required</h2>
              <p className="text-muted-foreground mb-2 max-w-sm">
                Your business doesn't have its own phone number yet.
              </p>
              <p className="text-muted-foreground mb-6 max-w-sm">
                To set up an AI Receptionist, you need your own dedicated phone number first. Your AI will answer calls and take messages on that number.
              </p>
              <div className="space-y-2 text-sm text-left w-full max-w-xs mb-6">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                  <span>Clients see YOUR number, not a shared one</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                  <span>Two-way SMS direct to your Chat Hub</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                  <span>Required for AI Receptionist activation</span>
                </div>
              </div>
              <Button onClick={() => setLocation("/settings")} data-testid="button-get-dedicated-number">
                <Phone className="h-4 w-4 mr-2" />
                Get a Dedicated Number — $10/month
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                Go to Settings to purchase your dedicated Australian phone number
              </p>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  // Provisioning loading screen
  if (isProvisioning) {
    return (
      <PageShell>
        <PageHeader title="AI Receptionist" />
        <div className="p-4 max-w-3xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto" style={{ color: "hsl(var(--trade))" }} />
              <h2 className="text-xl font-semibold">Setting up your AI Receptionist...</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                We're setting up your AI voice assistant on your dedicated number
                and configuring everything for your business. This usually takes about 30 seconds.
              </p>
              <div className="flex flex-col gap-2 text-xs text-muted-foreground pt-4">
                <div className="flex items-center gap-2 justify-center">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Configuring AI assistant on your number...</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/ai-receptionist/config"] })}
              >
                Refresh Status
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  // Failed provisioning state
  if (isFailed) {
    return (
      <PageShell>
        <PageHeader title="AI Receptionist" />
        <div className="p-4 max-w-3xl mx-auto space-y-4">
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
              <h2 className="text-lg font-semibold">Setup Issue</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                There was an issue setting up your AI Receptionist. Our team has been notified and will resolve it shortly.
              </p>
              {config?.provisioningError && (
                <p className="text-xs text-muted-foreground bg-muted rounded-md p-3 max-w-md mx-auto">
                  {config.provisioningError}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                If this persists, please contact{" "}
                <a href="mailto:admin@avwebinnovation.com" className="text-primary hover:underline">
                  support
                </a>.
              </p>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title="AI Receptionist" />
      <div className="p-4 space-y-4 max-w-6xl mx-auto">
        {isPendingApproval && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-900 dark:text-amber-100">Pending Admin Review</h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Your AI Receptionist has been set up! Our team will review and activate it within 24 hours.
                  You can configure your settings below while you wait.
                </p>
                {config?.dedicatedPhoneNumber && (
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
                    Your new number: <span className="font-medium">{config.dedicatedPhoneNumber}</span>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Phone className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                AI Receptionist
              </CardTitle>
              {canManageConfig && (
                <div className="flex items-center gap-3 flex-wrap">
                  {isPendingApproval ? (
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-0">
                      Pending Approval
                    </Badge>
                  ) : (
                    <>
                      <Badge className={isEnabled ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0" : ""}>
                        {isEnabled ? "Active" : "Inactive"}
                      </Badge>
                      {canToggleEnabled && isApproved && (
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(checked) => {
                            if (!checked) {
                              setShowDisableDialog(true);
                            } else {
                              toggleEnabledMutation.mutate(true);
                            }
                          }}
                          disabled={toggleEnabledMutation.isPending}
                          data-testid="switch-ai-receptionist-enabled"
                        />
                      )}
                    </>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Your AI receptionist answers calls, takes messages, and can transfer callers to your team.
              </p>
              {config?.dedicatedPhoneNumber && (
                <div className="flex items-center gap-2 text-sm">
                  <PhoneCall className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Your AI answers on:</span>
                  <span className="font-medium">{config.dedicatedPhoneNumber}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Mic className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Voice:</span>
                <span className="font-medium">{currentVoice}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Mode:</span>
                <span className="font-medium">{MODE_OPTIONS.find((m) => m.value === currentMode)?.label || currentMode}</span>
              </div>
              <div className="flex gap-2 pt-2 flex-wrap">
                {!editMode && canManageConfig && (
                  <Button variant="outline" size="sm" onClick={initForm} data-testid="button-edit-config">
                    <Settings className="h-4 w-4 mr-1" />
                    Configure
                  </Button>
                )}
                {canManageConfig && (isApproved || isEnabled) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation("/ai-receptionist/calls")}
                    data-testid="button-view-call-logs"
                  >
                    <PhoneCall className="h-4 w-4 mr-1" />
                    View Call Logs
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
                {canManageConfig && config?.vapiAssistantId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => measureLatencyMutation.mutate()}
                    disabled={measureLatencyMutation.isPending}
                    data-testid="button-test-latency"
                  >
                    {measureLatencyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-1" />
                    )}
                    Test Response Time
                  </Button>
                )}
              </div>
              {config?.vapiAssistantId && config?.lastLatencyMs != null && (
                <div className="flex items-center gap-2 text-sm pt-1 flex-wrap">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Estimate:</span>
                  <Badge
                    variant="outline"
                    className={
                      config.latencyStatus === 'optimal'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0'
                        : config.latencyStatus === 'amber'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-0'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-0'
                    }
                    data-testid="badge-latency"
                  >
                    {config.lastLatencyMs}ms · {config.latencyStatus === 'optimal' ? 'Fast' : config.latencyStatus === 'amber' ? 'OK' : 'Slow'}
                  </Badge>
                  {analytics && analytics.avgMeasuredLatencyMs != null && analytics.latencySampleSize > 0 && (
                    <>
                      <span className="text-muted-foreground">Real avg (last {analytics.latencySampleSize}):</span>
                      <Badge
                        variant="outline"
                        className={
                          analytics.avgMeasuredLatencyMs < 1000
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0'
                            : analytics.avgMeasuredLatencyMs < 1500
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-0'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-0'
                        }
                        data-testid="badge-measured-latency"
                      >
                        {analytics.avgMeasuredLatencyMs}ms
                      </Badge>
                    </>
                  )}
                  <span className="text-xs text-muted-foreground">target &lt;1000ms</span>
                </div>
              )}
              {analytics?.latencyMismatch && (
                <div
                  className="flex items-start gap-2 text-sm rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 p-3 mt-2"
                  data-testid="alert-latency-mismatch"
                >
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-red-600 dark:text-red-400 shrink-0" />
                  <div className="text-red-700 dark:text-red-300">
                    <div className="font-semibold">Estimate vs reality mismatch</div>
                    <div className="text-xs mt-0.5">
                      Estimate says "Fast" but real calls are averaging {analytics.avgMeasuredLatencyMs}ms. Tap "Test Response Time" to recalibrate, or try trimming the greeting / knowledge bank.
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {isTeam && canManageConfig ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                  Team Availability
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Toggle which team members are available for call transfers.
                </p>
                {teamAvailability.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No team members found.</p>
                ) : (
                  <div className="space-y-2">
                    {teamAvailability.map((member) => (
                      <div key={member.memberId} className="flex items-center justify-between gap-3 p-3 rounded-md border">
                        <div>
                          <div className="font-medium text-sm">{member.name}</div>
                          {member.phone && <div className="text-xs text-muted-foreground">{member.phone}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              member.available
                                ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0"
                                : ""
                            }
                          >
                            {member.available ? "Available" : "Unavailable"}
                          </Badge>
                          <Switch
                            checked={member.available}
                            onCheckedChange={(checked) =>
                              toggleAvailabilityMutation.mutate({ memberId: member.memberId, available: checked })
                            }
                            disabled={toggleAvailabilityMutation.isPending}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <MyAvailabilityToggle />
          )}
        </div>

        {editMode && formData && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                    Mode
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select value={formData.mode} onValueChange={(value) => setFormData({ ...formData, mode: value })}>
                    <SelectTrigger data-testid="select-mode">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      {MODE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div>
                            <div className="font-medium">{opt.label}</div>
                            <div className="text-xs text-muted-foreground">{opt.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Volume2 className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                    Voice
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2">
                    {voices.map((v) => (
                      <div
                        key={v.id}
                        className={`flex items-center justify-between gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                          formData.voice === v.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover-elevate"
                        }`}
                        onClick={() => setFormData({ ...formData, voice: v.id })}
                        data-testid={`voice-option-${v.id}`}
                      >
                        <div className="flex items-center gap-3">
                          {formData.voice === v.id ? (
                            <CheckCircle className="h-5 w-5 text-primary" />
                          ) : (
                            <Mic className="h-5 w-5 text-muted-foreground" />
                          )}
                          <div>
                            <div className="font-medium">{v.name}</div>
                            <div className="text-xs text-muted-foreground">{v.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <VoicePreviewButton voiceId={v.id} voiceName={v.name} />
                          <Badge variant="outline">{v.accent}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Greeting</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={formData.greeting}
                  onChange={(e) => setFormData({ ...formData, greeting: e.target.value })}
                  placeholder="G'day, thanks for calling [Your Business]. How can I help you today?"
                  className="resize-none"
                  rows={3}
                  maxLength={500}
                  data-testid="input-greeting"
                />
                {(() => {
                  const wordCount = formData.greeting.trim().split(/\s+/).filter(Boolean).length;
                  const slow = wordCount > 15;
                  return (
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-xs text-muted-foreground">
                        {formData.greeting.length}/500 characters · {wordCount} words
                      </p>
                      {slow && (
                        <p className="text-xs flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3" />
                          Long greetings increase response time. Try keeping it under 15 words.
                        </p>
                      )}
                    </div>
                  );
                })()}
                {formData.greeting && (
                  <div className="p-3 rounded-md bg-muted/50 text-sm">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Preview</p>
                    <p className="italic">"{formData.greeting}"</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {(formData.mode === "always_on_transfer" || formData.mode === "after_hours") && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {(formData.mode === "always_on_transfer" || formData.mode === "after_hours") && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <PhoneForwarded className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                        Transfer Numbers
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {formData.transferNumbers.map((tn, i) => (
                        <div key={i} className="flex items-end gap-2 flex-wrap">
                          <div className="flex-1 min-w-[120px]">
                            <Label className="text-xs">Name</Label>
                            <Input
                              value={tn.name}
                              onChange={(e) => updateTransferNumber(i, "name", e.target.value)}
                              placeholder="John"
                              data-testid={`input-transfer-name-${i}`}
                            />
                          </div>
                          <div className="flex-1 min-w-[140px]">
                            <Label className="text-xs">Phone</Label>
                            <Input
                              value={tn.phone}
                              onChange={(e) => updateTransferNumber(i, "phone", e.target.value)}
                              placeholder="+61400000000"
                              data-testid={`input-transfer-phone-${i}`}
                            />
                          </div>
                          <div className="w-20">
                            <Label className="text-xs">Priority</Label>
                            <Input
                              type="number"
                              min={1}
                              max={99}
                              value={tn.priority}
                              onChange={(e) => updateTransferNumber(i, "priority", parseInt(e.target.value) || 1)}
                            />
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => removeTransferNumber(i)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={addTransferNumber}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Number
                      </Button>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <MessageSquare className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                        <div>
                          <Label className="text-sm font-medium">SMS Call Notifications</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Get a text message when the AI handles a call, with the caller's number so you can call them back
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={formData.smsNotifications}
                        onCheckedChange={(checked) => setFormData({ ...formData, smsNotifications: checked })}
                        data-testid="switch-sms-notifications"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Mic className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                        <div>
                          <Label className="text-sm font-medium">Record Calls</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Off by default. When on, callers are told the call may be recorded before it starts. Only turn this on if you have the caller's consent to record.
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={formData.recordingEnabled}
                        onCheckedChange={(checked) => setFormData({ ...formData, recordingEnabled: checked })}
                        data-testid="switch-recording"
                      />
                    </div>
                  </CardContent>
                </Card>

                {formData.mode === "after_hours" && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                        Business Hours
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        The AI receptionist will answer calls outside these hours.
                      </p>
                      <div className="flex gap-3 flex-wrap">
                        <div>
                          <Label className="text-xs">Start</Label>
                          <Input
                            type="time"
                            value={formData.businessHours.start}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                businessHours: { ...formData.businessHours, start: e.target.value },
                              })
                            }
                            data-testid="input-hours-start"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">End</Label>
                          <Input
                            type="time"
                            value={formData.businessHours.end}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                businessHours: { ...formData.businessHours, end: e.target.value },
                              })
                            }
                            data-testid="input-hours-end"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs mb-2 block">Timezone</Label>
                        <Select
                          value={formData.businessHours.timezone}
                          onValueChange={(value) =>
                            setFormData({
                              ...formData,
                              businessHours: { ...formData.businessHours, timezone: value },
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIMEZONE_OPTIONS.map((tz) => (
                              <SelectItem key={tz} value={tz}>
                                {tz.replace("Australia/", "")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs mb-2 block">Working Days</Label>
                        <div className="flex gap-1 flex-wrap">
                          {DAY_NAMES.map((name, i) => (
                            <Button
                              key={i}
                              variant={formData.businessHours.days.includes(i) ? "default" : "outline"}
                              size="sm"
                              onClick={() => toggleBusinessDay(i)}
                              className="min-w-[44px]"
                            >
                              {name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setEditMode(false);
                  setFormData(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saveConfigMutation.isPending} data-testid="button-save-config">
                {saveConfigMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" />
                    Save Configuration
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {canManageConfig && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                Knowledge Bank
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Train your AI receptionist with business-specific information so it can give informed answers to callers.
              </p>

              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Service Descriptions
                </Label>
                <Textarea
                  value={knowledgeBank.serviceDescriptions || ""}
                  onChange={(e) => setKnowledgeBank(prev => ({ ...prev, serviceDescriptions: e.target.value }))}
                  placeholder="Describe your services, specialties, and what sets you apart..."
                  className="resize-none"
                  rows={3}
                  maxLength={2000}
                  data-testid="input-kb-services"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  Pricing Information
                </Label>
                <Textarea
                  value={knowledgeBank.pricingInfo || ""}
                  onChange={(e) => setKnowledgeBank(prev => ({ ...prev, pricingInfo: e.target.value }))}
                  placeholder="Call-out fees, hourly rates, common job pricing ranges..."
                  className="resize-none"
                  rows={3}
                  maxLength={2000}
                  data-testid="input-kb-pricing"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Special Instructions
                </Label>
                <Textarea
                  value={knowledgeBank.specialInstructions || ""}
                  onChange={(e) => setKnowledgeBank(prev => ({ ...prev, specialInstructions: e.target.value }))}
                  placeholder="Any special handling instructions, areas you service, things the AI should know..."
                  className="resize-none"
                  rows={3}
                  maxLength={2000}
                  data-testid="input-kb-instructions"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label className="text-sm flex items-center gap-1.5">
                    <HelpCircle className="h-3.5 w-3.5" />
                    FAQs
                  </Label>
                  <Button variant="outline" size="sm" onClick={addFaq} data-testid="button-add-faq">
                    <Plus className="h-4 w-4 mr-1" />
                    Add FAQ
                  </Button>
                </div>
                {(knowledgeBank.faqs || []).map((faq, i) => (
                  <div key={i} className="space-y-2 p-3 rounded-md border">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-2">
                        <Input
                          value={faq.question}
                          onChange={(e) => updateFaq(i, "question", e.target.value)}
                          placeholder="Common question..."
                          data-testid={`input-faq-question-${i}`}
                        />
                        <Textarea
                          value={faq.answer}
                          onChange={(e) => updateFaq(i, "answer", e.target.value)}
                          placeholder="Answer..."
                          className="resize-none"
                          rows={2}
                          data-testid={`input-faq-answer-${i}`}
                        />
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => removeFaq(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {(() => {
                const totalChars =
                  (knowledgeBank.serviceDescriptions || '').length +
                  (knowledgeBank.pricingInfo || '').length +
                  (knowledgeBank.specialInstructions || '').length +
                  (knowledgeBank.faqs || []).reduce(
                    (s, f) => s + (f.question || '').length + (f.answer || '').length,
                    0,
                  );
                const slow = totalChars > 2000;
                return (
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs text-muted-foreground">
                      {totalChars.toLocaleString()} characters of training content
                    </p>
                    {slow && (
                      <p className="text-xs flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        Large knowledge banks slow response time. Consider trimming below 2,000 characters.
                      </p>
                    )}
                  </div>
                );
              })()}

              <Button
                onClick={() => saveKnowledgeBankMutation.mutate(knowledgeBank)}
                disabled={saveKnowledgeBankMutation.isPending}
                data-testid="button-save-knowledge-bank"
              >
                {saveKnowledgeBankMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" />
                    Save Knowledge Bank
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {canManageConfig && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mic className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                Request a Voice
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Want a different voice for your AI receptionist? Describe what you're looking for and we'll set it up for you.
              </p>

              {voiceRequests.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Your Requests</Label>
                  {voiceRequests.map((req) => (
                    <div key={req.id} className="flex items-start justify-between gap-3 p-3 rounded-md border">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{req.requestedDescription}</p>
                        {req.adminNotes && (
                          <p className="text-xs text-muted-foreground mt-1">Admin: {req.adminNotes}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          req.status === "resolved"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0"
                            : req.status === "in_progress"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-0"
                              : req.status === "rejected"
                                ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-0"
                                : ""
                        }
                      >
                        {req.status === "in_progress" ? "In Progress" : req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <Textarea
                  value={voiceRequestDescription}
                  onChange={(e) => setVoiceRequestDescription(e.target.value)}
                  placeholder="Describe the voice you'd like (e.g., 'younger female voice', 'British accent', 'deeper male voice')..."
                  className="resize-none"
                  rows={2}
                  maxLength={500}
                  data-testid="input-voice-request"
                />
                <Button
                  variant="outline"
                  onClick={() => submitVoiceRequestMutation.mutate(voiceRequestDescription)}
                  disabled={!voiceRequestDescription.trim() || voiceRequestDescription.length < 5 || submitVoiceRequestMutation.isPending}
                  data-testid="button-submit-voice-request"
                >
                  {submitVoiceRequestMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  Submit Request
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable AI Receptionist?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop the AI from answering calls on your dedicated number. Your settings, voice, and knowledge bank will be preserved — you can re-enable at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toggleEnabledMutation.mutate(false);
                setShowDisableDialog(false);
              }}
            >
              Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
