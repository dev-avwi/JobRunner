import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { 
  Wrench, 
  Zap, 
  Droplets, 
  Hammer, 
  Paintbrush, 
  Home, 
  Wind,
  Building2,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Sparkles,
  User,
  Users,
  Briefcase,
  Phone,
  Mail,
  MapPin,
  Gift,
  Loader2,
  MessageSquarePlus,
  FileText,
  Receipt,
  CreditCard,
  Eye,
  Check,
  ExternalLink,
  Info,
  DollarSign,
  Camera,
  X,
  Plus,
  Download
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getSessionToken } from "@/lib/queryClient";
import { trackEvent } from "@/lib/analytics";
import jobrunnerLogo from "@assets/jobrunner-logo-cropped.png";
import { tradeCatalog } from "@shared/tradeCatalog";

interface SimpleOnboardingProps {
  onComplete: () => void;
  onSkip?: () => void;
}

const TRADE_OPTIONS = Object.entries(tradeCatalog).map(([id, trade]) => ({
  id,
  name: trade.name,
  description: trade.description,
}));

const TRADE_CATEGORIES = [
  {
    label: "Electrical & Mechanical",
    trades: ['electrical', 'hvac'],
  },
  {
    label: "Plumbing & Water",
    trades: ['plumbing'],
  },
  {
    label: "Building & Construction",
    trades: ['building', 'concreting', 'roofing', 'fencing'],
  },
  {
    label: "Interior & Finishing",
    trades: ['painting', 'tiling'],
  },
  {
    label: "Outdoor & Landscaping",
    trades: ['landscaping', 'grounds_maintenance'],
  },
  {
    label: "Specialty Services",
    trades: ['cleaning', 'handyman'],
  },
];

const getStepsForPlan = (plan: string) => {
  const baseSteps = [
    { id: 'trade', title: 'Trade', description: 'What kind of work do you do?' },
    { id: 'business', title: 'Business', description: 'Quick business setup' },
    { id: 'payments', title: 'Payments', description: 'Get paid faster' },
    { id: 'import', title: 'Import', description: 'Bring your data' },
  ];
  
  if (plan === 'team') {
    return [
      ...baseSteps,
      { id: 'team', title: 'Team', description: 'Set up your team structure' },
      { id: 'portal', title: 'Preview', description: 'See your client portal' },
      { id: 'done', title: 'Done', description: 'You\'re ready to go' },
    ];
  }
  
  return [
    ...baseSteps,
    { id: 'portal', title: 'Preview', description: 'See your client portal' },
    { id: 'done', title: 'Done', description: 'You\'re ready to go' },
  ];
};

// Onboarding always renders in the light brand theme to match the marketing
// site. These vars override any dark values applied inline to the root element.
const ONBOARDING_LIGHT_VARS = {
  "--background": "210 40% 98%",
  "--foreground": "217 33% 17%",
  "--card": "0 0% 100%",
  "--card-foreground": "217 33% 17%",
  "--card-border": "217 12% 88%",
  "--border": "217 12% 91%",
  "--primary": "217 91% 53%",
  "--primary-foreground": "0 0% 98%",
  "--secondary": "217 8% 89%",
  "--secondary-foreground": "217 20% 14%",
  "--muted": "217 6% 93%",
  "--muted-foreground": "217 10% 46%",
  "--accent": "217 12% 89%",
  "--accent-foreground": "217 20% 14%",
  "--input": "217 12% 75%",
  "--ring": "217 91% 53%",
} as React.CSSProperties;

function StepIndicator({ steps, currentStep }: { steps: { id: string; title: string }[]; currentStep: number }) {
  return (
    <div className="w-full max-w-lg mx-auto mb-6">
      <div className="flex items-center justify-between relative">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;

          return (
            <div key={step.id} className="flex flex-col items-center relative z-10" style={{ flex: index === 0 || index === steps.length - 1 ? '0 0 auto' : '1' }}>
              <div
                className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                  isCompleted
                    ? 'bg-[#2B7DE9] text-white'
                    : isActive
                    ? 'bg-[#2B7DE9] text-white ring-4 ring-[#2B7DE9]/15'
                    : 'bg-white text-gray-400 border-2 border-gray-200'
                }`}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span className={`mt-1.5 text-[10px] md:text-xs font-medium whitespace-nowrap transition-colors ${
                isCompleted || isActive ? 'text-gray-900' : 'text-gray-400'
              }`}>
                {step.title}
              </span>
            </div>
          );
        })}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 -z-0" style={{ marginLeft: '16px', marginRight: '16px' }}>
          <div
            className="h-full bg-[#2B7DE9] transition-all duration-500"
            style={{ width: `${currentStep === 0 ? 0 : (currentStep / (steps.length - 1)) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function VerticalSteps({ steps, currentStep }: { steps: { id: string; title: string }[]; currentStep: number }) {
  return (
    <div className="flex flex-col">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;
        const isLast = index === steps.length - 1;
        return (
          <div key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                  isCompleted
                    ? 'bg-[#2B7DE9] text-white'
                    : isActive
                    ? 'bg-[#2B7DE9] text-white ring-4 ring-[#2B7DE9]/15'
                    : 'bg-white text-gray-400 border-2 border-gray-200'
                }`}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              {!isLast && (
                <div className={`w-0.5 flex-1 min-h-[18px] my-1 rounded-full ${index < currentStep ? 'bg-[#2B7DE9]' : 'bg-gray-200'}`} />
              )}
            </div>
            <div className={`pt-1.5 ${isLast ? '' : 'pb-2'}`}>
              <p className={`text-sm font-medium transition-colors ${
                isActive ? 'text-gray-900' : isCompleted ? 'text-gray-600' : 'text-gray-400'
              }`}>
                {step.title}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type OnboardingRole = 'owner' | 'worker' | 'subcontractor' | null;

export default function SimpleOnboarding({ onComplete, onSkip }: SimpleOnboardingProps) {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<OnboardingRole>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [resumeChecked, setResumeChecked] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteValidation, setInviteValidation] = useState<{ valid: boolean; businessName?: string; roleType?: string; ownerName?: string; error?: string } | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [workerName, setWorkerName] = useState('');
  const [workerLastName, setWorkerLastName] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');
  const validateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const { data: user, isLoading: userLoading } = useQuery<{
    id: string;
    intendedTier?: string;
    [key: string]: any;
  }>({
    queryKey: ['/api/auth/me'],
  });
  
  useEffect(() => {
    if (user) {
      setWorkerName(user.firstName || '');
      setWorkerLastName(user.lastName || '');
    }
  }, [user]);

  const validateInviteCodeWeb = async (code: string) => {
    if (code.length !== 6) {
      setInviteValidation(null);
      return;
    }
    setIsValidatingCode(true);
    try {
      const res = await fetch(`/api/team/invite-code/validate/${code.toUpperCase()}`, { credentials: 'include' });
      const data = await res.json();
      setInviteValidation(data);
    } catch {
      setInviteValidation({ valid: false, error: 'Failed to validate code' });
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleInviteCodeChange = (text: string) => {
    const clean = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setInviteCode(clean);
    if (validateTimerRef.current) clearTimeout(validateTimerRef.current);
    if (clean.length === 6) {
      validateTimerRef.current = setTimeout(() => validateInviteCodeWeb(clean), 300);
    } else {
      setInviteValidation(null);
    }
  };

  const handleWorkerRedeem = async () => {
    if (!inviteValidation?.valid) {
      toast({ title: 'Invalid Code', description: 'Please enter a valid 6-character invite code', variant: 'destructive' });
      return;
    }
    if (!workerName.trim()) {
      toast({ title: 'Missing Info', description: 'Please enter your first name', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const redeemRes = await apiRequest('POST', '/api/team/invite-code/redeem', {
        code: inviteCode,
        phone: workerPhone || undefined,
      });
      const redeemData = await redeemRes.json();
      if (redeemData.error) {
        toast({ title: 'Error', description: redeemData.error, variant: 'destructive' });
        return;
      }
      if (workerName.trim() || workerLastName.trim()) {
        await apiRequest('PATCH', '/api/user/profile', {
          firstName: workerName.trim(),
          lastName: workerLastName.trim(),
        });
      }
      await apiRequest('POST', '/api/onboarding/complete', {}).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
      toast({ title: 'Welcome!', description: `You've joined ${redeemData.businessName || 'the team'}` });
      onComplete();
    } catch (error: any) {
      const raw = error?.message || '';
      // Strip our protocol prefixes (team_plan_required:, session_expired:, etc.)
      // so the toast shows the user-friendly text instead of the internal code.
      const friendly = raw.startsWith('team_plan_required:')
        ? raw.replace(/^team_plan_required:\s*/, '')
        : raw || 'Failed to join team';
      toast({ title: raw.startsWith('team_plan_required:') ? "Owner's plan inactive" : 'Error', description: friendly, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPlan = user?.intendedTier || 'free';
  const isTeamPlan = selectedPlan === 'team';
  const isProPlan = selectedPlan === 'pro';
  
  const STEPS = getStepsForPlan(selectedPlan);
  
  const [formData, setFormData] = useState({
    tradeType: '',
    businessName: '',
    abn: '',
    phone: '',
    email: '',
    address: '',
    gstRegistered: true,
    hourlyRate: '85',
    teamSize: 'solo',
  });

  useEffect(() => {
    if (user?.intendedTier === 'team') {
      setFormData(prev => ({ ...prev, teamSize: 'small' }));
    }
  }, [user?.intendedTier]);

  useEffect(() => {
    if (currentStep !== 1) return;

    const savedDraft = localStorage.getItem('jobrunner_onboarding_business_draft');
    if (savedDraft) {
      try {
        const draftData = JSON.parse(savedDraft);
        setFormData(prev => ({ ...prev, ...draftData }));
      } catch {
        localStorage.removeItem('jobrunner_onboarding_business_draft');
      }
    }
  }, []);

  useEffect(() => {
    if (currentStep !== 1) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      const businessDraftData = {
        businessName: formData.businessName,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        abn: formData.abn,
        gstRegistered: formData.gstRegistered,
        hourlyRate: formData.hourlyRate,
      };
      localStorage.setItem('jobrunner_onboarding_business_draft', JSON.stringify(businessDraftData));
    }, 3000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [formData, currentStep]);

  useEffect(() => {
    if (!resumeChecked) return;
    const stepId = STEPS[currentStep]?.id;
    if (stepId) {
      trackEvent('onboarding_step_viewed', { step: stepId });
    }
  }, [currentStep, resumeChecked]);

  // Force the light brand theme for the whole onboarding flow, regardless of the
  // user's saved dark/light preference, so it matches the marketing site.
  // ThemeProvider re-writes the root class + inline CSS vars whenever theme/brand
  // changes (e.g. settings load mid-onboarding), so a one-shot flip isn't enough.
  // We snapshot the root, re-assert light via a MutationObserver, and apply the
  // light vars at the ROOT so portaled menus (Select/Popover) also render light.
  useEffect(() => {
    const root = document.documentElement;
    const snapshotClass = root.getAttribute('class');
    const snapshotStyle = root.getAttribute('style');
    const lightVars = ONBOARDING_LIGHT_VARS as Record<string, string>;

    // Guard so re-asserting (which mutates the root) doesn't recurse forever.
    let applying = false;
    const forceLight = () => {
      if (applying) return;
      applying = true;
      try {
        if (root.classList.contains('dark')) root.classList.remove('dark');
        if (!root.classList.contains('light')) root.classList.add('light');
        for (const [name, value] of Object.entries(lightVars)) {
          if (root.style.getPropertyValue(name) !== value) {
            root.style.setProperty(name, value);
          }
        }
      } finally {
        applying = false;
      }
    };

    forceLight();
    const observer = new MutationObserver(forceLight);
    observer.observe(root, { attributes: true, attributeFilter: ['class', 'style'] });

    return () => {
      observer.disconnect();
      if (snapshotClass === null) root.removeAttribute('class');
      else root.setAttribute('class', snapshotClass);
      if (snapshotStyle === null) root.removeAttribute('style');
      else root.setAttribute('style', snapshotStyle);
    };
  }, []);

  useEffect(() => {
    const checkExistingSettings = async () => {
      try {
        // Use apiRequest so the Bearer-token fallback is sent — raw fetch only
        // sends the cookie, which fails on iOS/Safari and over plain HTTP.
        const res = await apiRequest('GET', '/api/business-settings');
        if (res.ok) {
          const settings = await res.json();
          if (!settings.onboardingCompleted) {
            if (settings.tradeType) {
              setFormData(prev => ({
                ...prev,
                tradeType: settings.tradeType || '',
                businessName: settings.businessName || '',
                abn: settings.abn || '',
                phone: settings.phone || '',
                gstRegistered: settings.gstEnabled ?? true,
                hourlyRate: String(settings.defaultHourlyRate || '85'),
              }));
              if (settings.businessName) {
                setCurrentStep(2);
              } else {
                setCurrentStep(1);
              }
            }
          }
        }
      } catch (e) {
        // No existing settings, start fresh
      } finally {
        setResumeChecked(true);
      }
    };
    checkExistingSettings();
  }, []);

  const handleTradeSelect = (tradeId: string) => {
    setFormData(prev => ({ ...prev, tradeType: tradeId }));
  };

  const userTradeKey = formData.tradeType || 'general';

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const autoSaveTrade = async (tradeType: string) => {
    // PATCH first (apiRequest sends the Bearer fallback). Only create a new row
    // on an explicit 404 — a transient 401/network/500 must NOT trigger a POST,
    // since create is a plain insert and would error on a duplicate.
    try {
      await apiRequest('PATCH', '/api/business-settings', {
        tradeType,
        onboardingCompleted: false,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.startsWith('404')) {
        try {
          await apiRequest('POST', '/api/business-settings', {
            tradeType,
            onboardingCompleted: false,
            businessName: '',
          });
        } catch {
          // Best effort - auto-save only
        }
      }
      // Other errors (auth/network) are swallowed; not safe to create.
    }
  };

  const getStepIndexById = (id: string) => STEPS.findIndex(s => s.id === id);

  const handleNext = async () => {
    const stepId = STEPS[currentStep]?.id;

    if (stepId === 'trade') {
      if (!formData.tradeType) {
        toast({ variant: "destructive", title: "Please select your trade" });
        return;
      }
      autoSaveTrade(formData.tradeType);
      setCurrentStep(prev => prev + 1);
      return;
    }
    
    if (stepId === 'business') {
      if (!formData.businessName.trim()) {
        toast({ variant: "destructive", title: "Business name is required" });
        return;
      }
      
      setIsSubmitting(true);
      try {
        await apiRequest('POST', '/api/business-settings', {
          businessName: formData.businessName,
          abn: formData.abn,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          tradeType: formData.tradeType,
          gstEnabled: formData.gstRegistered,
          defaultHourlyRate: parseFloat(formData.hourlyRate) || 85,
          calloutFee: 90,
          teamSize: isTeamPlan ? 'small' : 'solo',
          onboardingCompleted: false,
          logoUrl: logoPreview || undefined,
        });
        
        localStorage.removeItem('jobrunner_onboarding_business_draft');
        await queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
        setCurrentStep(prev => prev + 1);
      } catch (error) {
        toast({ 
          variant: "destructive", 
          title: "Error saving settings", 
          description: error instanceof Error ? error.message : "Please try again" 
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (stepId === 'payments') {
      setCurrentStep(prev => prev + 1);
      return;
    }

    if (stepId === 'import') {
      setCurrentStep(prev => prev + 1);
      return;
    }
    
    if (stepId === 'team') {
      setIsSubmitting(true);
      try {
        await apiRequest('PATCH', '/api/business-settings', {
          onboardingCompleted: false,
        });
        await queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
        setCurrentStep(prev => prev + 1);
      } catch (error) {
        toast({ 
          variant: "destructive", 
          title: "Error saving settings", 
          description: error instanceof Error ? error.message : "Please try again" 
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (stepId === 'portal') {
      setCurrentStep(prev => prev + 1);
      return;
    }
    
    if (stepId === 'done') {
      await completeOnboarding();
      return;
    }
    
    setCurrentStep(prev => prev + 1);
  };

  const completeOnboarding = async (redirectTo?: string) => {
    setIsSubmitting(true);
    try {
      if (teamInviteEmails.length > 0) {
        for (const email of teamInviteEmails) {
          try {
            await apiRequest('POST', '/api/team/invite', { email, role: 'tradie' });
          } catch (error) {
            console.log('Failed to send invite to:', email);
          }
        }
      }

      if (seedDemoData) {
        try {
          // Task #115: opt-in "Try with sample data". Creates 3 sample clients,
          // 2 quotes, 2 invoices, 1 scheduled + 1 in-progress job (all flagged
          // isSample=true so accounting integrations skip them, and one tap
          // removes everything from Dashboard or Settings).
          await apiRequest('POST', '/api/onboarding/seed-sample-data', { tradeType: userTradeKey });
          await queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
          await queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
          await queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
          await queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
          await queryClient.invalidateQueries({ queryKey: ['/api/onboarding/sample-data'] });
        } catch (error) {
          console.log('Sample data seeding skipped:', error);
        }
      }

      if (isProPlan || isTeamPlan) {
        try {
          await apiRequest('POST', '/api/subscription/trial', {});
          await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
          await queryClient.invalidateQueries({ queryKey: ['/api/subscription/status'] });
        } catch (error) {
          console.error('Failed to start trial:', error);
          toast({
            title: "Trial activation pending",
            description: "You can activate your trial from the subscription settings.",
          });
        }
      }

      try {
        await apiRequest('PATCH', '/api/business-settings', { onboardingCompleted: true });
        await queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
      } catch (e) {}

      trackEvent('onboarding_completed');
      onComplete();

      if (redirectTo) {
        setTimeout(() => { window.location.href = redirectTo; }, 100);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleStripeConnect = async () => {
    setStripeConnecting(true);
    try {
      const res = await apiRequest('POST', '/api/stripe-connect/onboard', {});
      const data = await res.json();
      if (data.onboardingUrl || data.url) {
        window.location.href = data.onboardingUrl || data.url;
      } else {
        toast({ variant: "destructive", title: "Could not start Stripe setup", description: "Please try again later." });
      }
    } catch (error) {
      toast({ 
        variant: "destructive", 
        title: "Stripe connection failed", 
        description: error instanceof Error ? error.message : "Please try again later or skip for now." 
      });
    } finally {
      setStripeConnecting(false);
    }
  };

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  // Task #115: opt-in sample data toggle. Default OFF — most users prefer
  // an empty workspace they can populate with their own jobs straight away.
  const [seedDemoData, setSeedDemoData] = useState(false);
  const [importMode, setImportMode] = useState<'none' | 'clients' | 'catalog' | 'tradify' | 'servicem8'>('none');
  const [importPreview, setImportPreview] = useState<{ headers: string[]; rows: any[]; totalRows: number; suggestedMappings: Record<string, string>; detectedType?: string; detectedPlatform?: string; duplicateCount?: number; duplicates?: { row: number; reason: string }[]; formatWarning?: string } | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [teamInviteEmails, setTeamInviteEmails] = useState<string[]>([]);
  const [currentInviteEmail, setCurrentInviteEmail] = useState('');
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Please upload an image under 5MB" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportResult(null);
    
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);
    const isCompetitor = importMode === 'tradify' || importMode === 'servicem8';
    if (isCompetitor) {
      formDataUpload.append('platform', importMode);
    } else {
      formDataUpload.append('type', importMode);
    }
    
    try {
      // FormData uploads can't go through apiRequest (it sets a JSON
      // content-type), so attach the Bearer-token fallback by hand.
      const token = getSessionToken();
      const res = await fetch('/api/import/preview', {
        method: 'POST',
        body: formDataUpload,
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error('Failed to parse file');
      const data = await res.json();
      setImportPreview(data);
    } catch (error) {
      toast({ variant: "destructive", title: "Could not read that file", description: "Make sure it's a CSV file with headers in the first row." });
      setImportFile(null);
    }
  };

  const handleExecuteImport = async () => {
    if (!importPreview) return;
    setIsImporting(true);
    try {
      const isCompetitor = importMode === 'tradify' || importMode === 'servicem8';
      const importType = isCompetitor ? (importPreview.detectedType || 'clients') : importMode;
      const res = await apiRequest('POST', '/api/import/execute', {
        type: importType,
        data: importPreview.rows,
        mappings: importPreview.suggestedMappings,
        platform: isCompetitor ? importMode : 'generic',
        skipDuplicates: true,
      });
      const result = await res.json();
      setImportResult(result);
      if (result.imported > 0) {
        const keys = ['/api/clients', '/api/jobs', '/api/quotes', '/api/invoices', '/api/catalog'];
        for (const k of keys) {
          await queryClient.invalidateQueries({ queryKey: [k] });
        }
        const typeLabels: Record<string, string> = { clients: 'clients', catalog: 'items', jobs: 'jobs', quotes: 'quotes', invoices: 'invoices' };
        toast({ title: `Imported ${result.imported} ${typeLabels[importType] || 'records'}` });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Import failed", description: "Please check your file and try again." });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = (type: string) => {
    window.open(`/api/import/templates/${type}`, '_blank');
  };

  const resetImport = () => {
    setImportMode('none');
    setImportPreview(null);
    setImportFile(null);
    setImportResult(null);
  };

  const [showTradeRequest, setShowTradeRequest] = useState(false);
  const [requestedTrade, setRequestedTrade] = useState('');

  const handleRequestTrade = async () => {
    if (!requestedTrade.trim()) {
      toast({ variant: "destructive", title: "Please enter your trade type" });
      return;
    }
    
    try {
      await apiRequest('POST', '/api/trade-requests', {
        tradeName: requestedTrade.trim(),
      });
      
      toast({
        title: "Trade request submitted",
        description: "We'll add your trade soon! For now, you'll use the General category.",
      });
      
      handleTradeSelect('general');
      setShowTradeRequest(false);
    } catch (error) {
      handleTradeSelect('general');
      setShowTradeRequest(false);
      toast({
        title: "Request noted",
        description: "Using General category for now. We'll add your trade soon!",
      });
    }
  };

  const renderTradeStep = () => {
    const selectedTrade = formData.tradeType ? tradeCatalog[formData.tradeType] : null;
    
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            What's your trade?
          </h2>
          <p className="text-muted-foreground">
            We'll set up your workspace with the right templates, pricing, and job types
          </p>
        </div>
        
        <div className="max-w-md mx-auto space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trade-select" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Trade Category
            </Label>
            <Select
              value={formData.tradeType}
              onValueChange={handleTradeSelect}
            >
              <SelectTrigger id="trade-select" className="w-full h-12" data-testid="select-trade">
                <SelectValue placeholder="Select your trade..." />
              </SelectTrigger>
              <SelectContent>
                {TRADE_CATEGORIES.map((category) => (
                  <SelectGroup key={category.label}>
                    <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {category.label}
                    </SelectLabel>
                    {category.trades.map((tradeId) => {
                      const trade = tradeCatalog[tradeId];
                      if (!trade) return null;
                      return (
                        <SelectItem key={tradeId} value={tradeId} data-testid={`trade-${tradeId}`}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: trade.color }}
                            />
                            <span>{trade.name}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                ))}
                <SelectGroup>
                  <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Other
                  </SelectLabel>
                  <SelectItem value="general" data-testid="trade-general">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gray-500" />
                      <span>General Trade Services</span>
                    </div>
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {selectedTrade && (
            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <div 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: selectedTrade.color }}
                />
                <span className="font-medium">{selectedTrade.name}</span>
              </div>
              <p className="text-sm text-muted-foreground">{selectedTrade.description}</p>
              {selectedTrade.typicalJobs && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedTrade.typicalJobs.slice(0, 4).map((job) => (
                    <span key={job} className="text-xs bg-background px-2 py-0.5 rounded-full border">
                      {job}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {!showTradeRequest ? (
            <button
              type="button"
              onClick={() => setShowTradeRequest(true)}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <MessageSquarePlus className="h-4 w-4" />
              Can't find your trade? Request it
            </button>
          ) : (
            <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
              <Label htmlFor="request-trade">Request a new trade category</Label>
              <Input
                id="request-trade"
                placeholder="e.g. Glazier, Pool Technician..."
                value={requestedTrade}
                onChange={(e) => setRequestedTrade(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowTradeRequest(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleRequestTrade}>
                  Submit & Continue with General
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                We'll notify you when your trade category is added. For now, you'll use the General category.
              </p>
            </div>
          )}
        </div>
        
        <div className="flex justify-end pt-4">
          <Button 
            onClick={handleNext} 
            disabled={!formData.tradeType}
            size="lg"
            data-testid="button-next"
          >
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const renderBusinessStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Tell us about your business
        </h2>
        <p className="text-muted-foreground">
          This goes on your quotes and invoices - takes 30 seconds
        </p>
      </div>
      
      <div className="space-y-4 max-w-md mx-auto">
        <div className="flex flex-col items-center mb-4">
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            className="w-20 h-20 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden transition-all"
          >
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Camera className="h-6 w-6 text-muted-foreground/50" />
            )}
          </button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoSelect}
            className="hidden"
          />
          <p className="text-xs text-muted-foreground mt-2">Add your logo (optional)</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="businessName" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Business Name *
          </Label>
          <Input
            id="businessName"
            placeholder="e.g. Smith Electrical"
            value={formData.businessName}
            onChange={(e) => handleInputChange('businessName', e.target.value)}
            data-testid="input-business-name"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="phone" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Phone Number
          </Label>
          <Input
            id="phone"
            placeholder="0400 000 000"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            data-testid="input-phone"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email
          </Label>
          <Input
            id="email"
            placeholder="hello@yourbusiness.com.au"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            data-testid="input-email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Address
          </Label>
          <Input
            id="address"
            placeholder="123 Main St, Sydney NSW 2000"
            value={formData.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
            data-testid="input-address"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="abn" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            ABN (optional)
          </Label>
          <Input
            id="abn"
            placeholder="XX XXX XXX XXX"
            value={formData.abn}
            onChange={(e) => handleInputChange('abn', e.target.value)}
            data-testid="input-abn"
          />
        </div>
        
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div>
            <Label htmlFor="gst" className="font-medium">GST Registered</Label>
            <p className="text-xs text-muted-foreground">Add 10% GST to quotes and invoices</p>
          </div>
          <Switch
            id="gst"
            checked={formData.gstRegistered}
            onCheckedChange={(checked) => handleInputChange('gstRegistered', checked)}
            data-testid="switch-gst"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="hourlyRate" className="flex items-center gap-2">
            Default Hourly Rate
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="hourlyRate"
              type="number"
              placeholder="85"
              value={formData.hourlyRate}
              onChange={(e) => handleInputChange('hourlyRate', e.target.value)}
              className="pl-7"
              data-testid="input-hourly-rate"
            />
          </div>
        </div>
      </div>
      
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={handleBack} data-testid="button-back">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button 
          onClick={handleNext} 
          disabled={isSubmitting || !formData.businessName.trim()}
          size="lg"
          data-testid="button-next"
        >
          {isSubmitting ? 'Saving...' : 'Continue'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderPaymentsStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Get Paid Faster
        </h2>
        <p className="text-gray-600 max-w-sm mx-auto">
          Clients can pay your invoices online with one tap. No chasing, no delays.
        </p>
      </div>
      
      <div className="max-w-md mx-auto space-y-4">
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#2B7DE9]/10 flex items-center justify-center flex-shrink-0">
              <CreditCard className="h-4 w-4 text-[#2B7DE9]" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900">Accept card payments</h4>
              <p className="text-sm text-gray-600">Clients pay invoices directly online</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#F28C28]/10 flex items-center justify-center flex-shrink-0">
              <ExternalLink className="h-4 w-4 text-[#F28C28]" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900">Send payment links</h4>
              <p className="text-sm text-gray-600">One-click payment links via SMS or email</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900">Fast deposits</h4>
              <p className="text-sm text-gray-600">Funds deposited directly to your bank</p>
            </div>
          </div>
        </div>

        <Button 
          onClick={handleStripeConnect}
          disabled={stripeConnecting}
          size="lg"
          className="w-full"
        >
          {stripeConnecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Connect Stripe
            </>
          )}
        </Button>

        <div className="flex items-start gap-2 px-1">
          <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            You can always connect Stripe later from Settings
          </p>
        </div>
      </div>
      
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={handleBack} data-testid="button-back">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button 
          variant="ghost"
          onClick={handleNext}
          data-testid="button-skip-stripe"
        >
          Skip for now
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderImportStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Switching from another app?
        </h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Bring your data across in seconds. We auto-detect Tradify and ServiceM8 exports.
        </p>
      </div>
      
      {importMode === 'none' && !importResult && (
        <div className="max-w-md mx-auto space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Import from competitor</p>
          <div 
            className="p-4 rounded-xl border hover-elevate cursor-pointer transition-all"
            onClick={() => setImportMode('tradify')}
            data-testid="import-tradify-option"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center flex-shrink-0">
                <Download className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">Import from Tradify</p>
                <p className="text-sm text-muted-foreground">Clients, jobs, quotes & invoices</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          
          <div 
            className="p-4 rounded-xl border hover-elevate cursor-pointer transition-all"
            onClick={() => setImportMode('servicem8')}
            data-testid="import-servicem8-option"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
                <Download className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">Import from ServiceM8</p>
                <p className="text-sm text-muted-foreground">Clients, jobs, quotes & invoices</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 pt-2">Or upload a generic CSV</p>
          <div 
            className="p-4 rounded-xl border hover-elevate cursor-pointer transition-all"
            onClick={() => setImportMode('clients')}
            data-testid="import-clients-option"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">Import Clients</p>
                <p className="text-sm text-muted-foreground">Upload a CSV with your client list</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          
          <div 
            className="p-4 rounded-xl border hover-elevate cursor-pointer transition-all"
            onClick={() => setImportMode('catalog')}
            data-testid="import-catalog-option"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#F28C28]/10 flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-[#F28C28]" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">Import Price List</p>
                <p className="text-sm text-muted-foreground">Upload your materials or service items</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          
          <p className="text-xs text-center text-muted-foreground pt-2">
            You can also import data later from Settings
          </p>
        </div>
      )}
      
      {importMode !== 'none' && !importResult && (
        <div className="max-w-md mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900 dark:text-white">
              {importMode === 'tradify' ? 'Import from Tradify' : importMode === 'servicem8' ? 'Import from ServiceM8' : importMode === 'clients' ? 'Import Clients' : 'Import Price List'}
            </h3>
            <Button variant="ghost" size="sm" onClick={resetImport}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
          
          {!importPreview && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {(importMode === 'tradify' || importMode === 'servicem8') 
                  ? `Upload any CSV exported from ${importMode === 'tradify' ? 'Tradify' : 'ServiceM8'}. We'll auto-detect whether it's clients, jobs, quotes, or invoices.`
                  : `Upload a CSV file with your ${importMode === 'clients' ? 'client list' : 'price list'}.`
                }
              </p>
              <div 
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors hover:border-muted-foreground/40"
                onClick={() => importFileRef.current?.click()}
              >
                <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-900 dark:text-white">Drop your CSV file here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
              </div>
              <input
                ref={importFileRef}
                type="file"
                accept=".csv"
                onChange={handleImportFileSelect}
                className="hidden"
              />
              {(importMode === 'clients' || importMode === 'catalog') && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => handleDownloadTemplate(importMode === 'clients' ? 'clients' : 'catalog')}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Download CSV template
                </Button>
              )}
            </div>
          )}
          
          {importPreview && (
            <div className="space-y-3">
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <p className="text-sm font-medium">{importFile?.name}</p>
                  <div className="flex gap-1 flex-wrap">
                    {importPreview.detectedType && (importMode === 'tradify' || importMode === 'servicem8') && (
                      <Badge variant="secondary" className="capitalize">{importPreview.detectedType}</Badge>
                    )}
                    <Badge variant="outline">{importPreview.totalRows} rows</Badge>
                  </div>
                </div>
                {importPreview.formatWarning && (
                  <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded p-2 mb-2">
                    <p className="font-medium">{importPreview.formatWarning}</p>
                  </div>
                )}
                {(importPreview.duplicateCount || 0) > 0 && (
                  <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded p-2 mb-2 space-y-0.5">
                    <p className="font-medium">{importPreview.duplicateCount} duplicate{importPreview.duplicateCount !== 1 ? 's' : ''} will be skipped:</p>
                    {importPreview.duplicates?.slice(0, 3).map((d, i) => (
                      <p key={i}>{d.reason}</p>
                    ))}
                    {(importPreview.duplicates?.length || 0) > 3 && (
                      <p>...and {(importPreview.duplicates?.length || 0) - 3} more</p>
                    )}
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        {importPreview.headers.slice(0, 4).map((h, i) => (
                          <th key={i} className="text-left p-1 font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.rows.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-t border-border/50">
                          {importPreview.headers.slice(0, 4).map((h, j) => (
                            <td key={j} className="p-1 truncate max-w-[120px]">{row[h] || '-'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importPreview.totalRows > 3 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    ...and {importPreview.totalRows - 3} more rows
                  </p>
                )}
              </div>
              
              <Button 
                onClick={handleExecuteImport} 
                disabled={isImporting}
                className="w-full"
                data-testid="button-execute-import"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Import {importPreview.totalRows - (importPreview.duplicateCount || 0)} {(importMode === 'tradify' || importMode === 'servicem8') ? (importPreview.detectedType || 'records') : importMode === 'clients' ? 'clients' : 'items'}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
      
      {importResult && (
        <div className="max-w-md mx-auto space-y-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 text-center">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="font-medium text-green-900 dark:text-green-100">
              {importResult.imported} records imported
            </p>
            {importResult.skipped > 0 && (
              <p className="text-sm text-green-700 dark:text-green-300">
                {importResult.skipped} skipped (duplicates or missing required fields)
              </p>
            )}
          </div>
          <Button variant="outline" className="w-full" onClick={resetImport}>
            Import more data
          </Button>
        </div>
      )}
      
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={handleBack} data-testid="button-back">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button 
          onClick={() => { resetImport(); handleNext(); }}
          size="lg"
          data-testid="button-next"
        >
          {importResult ? 'Continue' : 'Skip for now'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderPortalStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Professional from Day One
        </h2>
        <p className="text-gray-600 max-w-sm mx-auto">
          This is what your clients see. Clean, professional, and branded with your business.
        </p>
      </div>
      
      <div className="max-w-sm mx-auto">
        <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="bg-[#2B7DE9] px-4 py-3">
            <p className="text-white font-semibold text-sm">
              {formData.businessName || 'Your Business'}
            </p>
            <p className="text-blue-100 text-xs">Client Portal</p>
          </div>
          
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Quote #1024</p>
                <p className="text-sm font-semibold text-gray-900">Kitchen Renovation</p>
              </div>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                Pending
              </span>
            </div>
            
            <div className="border-t pt-3 space-y-2">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Demolition & prep work</span>
                <span className="font-medium">$850.00</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>New cabinetry install</span>
                <span className="font-medium">$2,400.00</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Benchtop & splashback</span>
                <span className="font-medium">$1,200.00</span>
              </div>
              <div className="border-t pt-2 flex justify-between text-sm font-semibold text-gray-900">
                <span>Total (inc. GST)</span>
                <span>$4,895.00</span>
              </div>
            </div>
            
            <div className="flex gap-2 pt-1">
              <div className="flex-1 bg-green-600 text-white text-center text-xs font-medium py-2 rounded-md">
                Accept Quote
              </div>
              <div className="flex-1 bg-blue-600 text-white text-center text-xs font-medium py-2 rounded-md">
                Pay Invoice
              </div>
            </div>
          </div>
        </div>
        
        <p className="text-xs text-center text-muted-foreground mt-3">
          Clients receive a link to view and accept quotes or pay invoices online
        </p>
      </div>
      
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={handleBack} data-testid="button-back">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button 
          onClick={handleNext}
          size="lg"
          data-testid="button-next"
        >
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderTeamStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          You're the Team Owner
        </h2>
        <p className="text-muted-foreground">
          As the owner, you'll manage your team and assign jobs to your workers
        </p>
      </div>
      
      <div className="bg-muted/50 rounded-xl p-5 max-w-md mx-auto space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-primary font-bold text-sm">1</span>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">Free trial started</h4>
            <p className="text-sm text-muted-foreground">All Team features unlocked — add a payment method before the trial ends to keep them.</p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-primary font-bold text-sm">2</span>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">Invite your workers</h4>
            <p className="text-sm text-muted-foreground">They'll get an email to join your team</p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-primary font-bold text-sm">3</span>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">Assign jobs & track progress</h4>
            <p className="text-sm text-muted-foreground">Live GPS tracking and team chat included</p>
          </div>
        </div>
      </div>
      
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="font-semibold text-green-900 dark:text-green-100">Team Features Ready</span>
        </div>
        <p className="text-sm text-green-700 dark:text-green-300">
          After setup, go to Team Management to invite your first team member.
        </p>
      </div>

      <div className="max-w-md mx-auto space-y-3">
        <Label className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Invite Team Members (optional)
        </Label>
        <div className="flex gap-2">
          <Input
            placeholder="team@example.com"
            type="email"
            value={currentInviteEmail}
            onChange={(e) => setCurrentInviteEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (currentInviteEmail.trim() && currentInviteEmail.includes('@')) {
                  setTeamInviteEmails(prev => [...prev, currentInviteEmail.trim()]);
                  setCurrentInviteEmail('');
                }
              }
            }}
            data-testid="input-team-invite-email"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (currentInviteEmail.trim() && currentInviteEmail.includes('@')) {
                setTeamInviteEmails(prev => [...prev, currentInviteEmail.trim()]);
                setCurrentInviteEmail('');
              }
            }}
            disabled={!currentInviteEmail.trim() || !currentInviteEmail.includes('@')}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {teamInviteEmails.length > 0 && (
          <div className="space-y-1">
            {teamInviteEmails.map((email, index) => (
              <div key={index} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span>{email}</span>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setTeamInviteEmails(prev => prev.filter((_, i) => i !== index))}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Invites will be sent when you complete setup
            </p>
          </div>
        )}
      </div>
      
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={handleBack} data-testid="button-back">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button 
          onClick={handleNext} 
          disabled={isSubmitting}
          size="lg"
          data-testid="button-next"
        >
          {isSubmitting ? 'Saving...' : 'Continue'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const selectedTradeName = tradeCatalog[userTradeKey]?.name || 'your trade';
  const selectedTradeJobs = tradeCatalog[userTradeKey]?.typicalJobs?.slice(0, 3) || ['Service call', 'Repair job', 'New installation'];

  const renderDoneStep = () => (
    <div className="text-center py-6 space-y-5">
      <div className="mx-auto w-16 h-16 bg-green-50 border border-green-200 rounded-full flex items-center justify-center">
        <CheckCircle className="h-8 w-8 text-green-600" />
      </div>
      
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          You're all set!
        </h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Start quoting, invoicing, and getting paid. Everything you need is right here.
        </p>
      </div>

      <div className="max-w-sm mx-auto space-y-3">
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-gray-900">Your first job journey</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-5 h-5 rounded-full bg-[#2B7DE9] text-white flex items-center justify-center text-[10px] font-bold">1</div>
              <span>Create a Job</span>
            </div>
            <ArrowRight className="h-3 w-3 shrink-0" />
            <div className="flex items-center gap-1">
              <div className="w-5 h-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold">2</div>
              <span>Send a Quote</span>
            </div>
            <ArrowRight className="h-3 w-3 shrink-0" />
            <div className="flex items-center gap-1">
              <div className="w-5 h-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold">3</div>
              <span>Invoice</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Step 1 of 3: Create your first {selectedTradeName} job — we'll pre-fill it with a sample client and address so you can see the workflow.
          </p>
          <Button
            type="button"
            className="w-full gap-2"
            disabled={isSubmitting}
            onClick={() => {
              const firstJob = selectedTradeJobs[0] || 'New Job';
              const sampleAddress = '15 Sheridan Street, Cairns QLD 4870';
              const sampleClient = 'Sarah Mitchell';
              completeOnboarding(`/jobs/new?title=${encodeURIComponent(firstJob)}&address=${encodeURIComponent(sampleAddress)}&clientName=${encodeURIComponent(sampleClient)}`);
            }}
            data-testid="button-create-first-demo-job"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Wrench className="h-4 w-4 shrink-0" />}
            Create My First Demo Job
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <p className="text-xs font-medium">Try with sample data</p>
            <p className="text-xs text-muted-foreground">Loads a few example clients, quotes &amp; invoices so you can explore. Remove any time.</p>
          </div>
          <Switch
            checked={seedDemoData}
            onCheckedChange={setSeedDemoData}
            data-testid="switch-try-sample-data"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={isSubmitting}
          onClick={() => completeOnboarding()}
          data-testid="button-go-to-dashboard"
        >
          Go to Dashboard
        </Button>
      </div>
      
      {isTeamPlan ? (
        <>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 max-w-sm mx-auto">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Gift className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-green-900 dark:text-green-100">Team Plan Active</span>
            </div>
            <p className="text-sm text-green-700 dark:text-green-300 mb-3">
              You're the Team Owner! All Team features are unlocked.
            </p>
            <a href="/team" className="text-sm font-medium text-green-600 hover:text-green-700 dark:text-green-400">
              Go to Team Management →
            </a>
          </div>
        </>
      ) : isProPlan ? (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 max-w-sm mx-auto">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Gift className="h-5 w-5 text-orange-500" />
              <span className="font-semibold text-blue-900 dark:text-blue-100">Pro Features Unlocked</span>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
              You're on a free trial — unlimited jobs, invoices and AI while it's active.
            </p>
            <a href="/subscription" className="text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400">
              View Plans →
            </a>
          </div>
        </>
      ) : (
        <>
          <div className="bg-muted/50 rounded-xl p-4 max-w-sm mx-auto">
            <h3 className="font-medium mb-3">Free Plan Includes:</h3>
            <ul className="text-sm text-muted-foreground space-y-2 text-left">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Unlimited quotes
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                25 jobs per month
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                25 invoices per month
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                50 clients
              </li>
            </ul>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 max-w-sm mx-auto">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Gift className="h-5 w-5 text-orange-500" />
              <span className="font-semibold text-blue-900 dark:text-blue-100">Want Unlimited Access?</span>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
              Upgrade to Pro for unlimited jobs, invoices, clients and AI assistant.
            </p>
            <a href="/subscription" className="text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400">
              View Plans →
            </a>
          </div>
        </>
      )}
      
    </div>
  );

  const renderCurrentStep = () => {
    const stepId = STEPS[currentStep]?.id;
    switch (stepId) {
      case 'trade':
        return renderTradeStep();
      case 'business':
        return renderBusinessStep();
      case 'payments':
        return renderPaymentsStep();
      case 'import':
        return renderImportStep();
      case 'team':
        return renderTeamStep();
      case 'portal':
        return renderPortalStep();
      case 'done':
        return renderDoneStep();
      default:
        return null;
    }
  };

  if (userLoading || !resumeChecked) {
    return (
      <div className="min-h-screen bg-[#F2F4F8] flex items-center justify-center" style={ONBOARDING_LIGHT_VARS} data-testid="simple-onboarding-loading">
        <div className="flex flex-col items-center gap-4">
          <img src={jobrunnerLogo} alt="JobRunner" className="h-10 w-auto" />
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span className="text-muted-foreground text-sm">Loading your setup...</span>
        </div>
      </div>
    );
  }

  const currentStepId = STEPS[currentStep]?.id;
  const isDoneStep = currentStepId === 'done';

  if (selectedRole === null) {
    return (
      <div className="min-h-screen bg-[#F2F4F8]" style={ONBOARDING_LIGHT_VARS} data-testid="simple-onboarding-role">
        <div className="max-w-lg mx-auto p-4 md:p-6 min-h-screen flex flex-col justify-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <img src={jobrunnerLogo} alt="JobRunner" className="h-8 w-auto" />
            <span className="text-xl font-bold">
              <span className="text-[#F28C28]">Job</span><span className="text-[#2B7DE9]">Runner</span>
            </span>
          </div>
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-bold text-foreground text-center mb-2">How will you use JobRunner?</h2>
              <p className="text-sm text-muted-foreground text-center mb-6">Choose your role to get the right setup</p>
              <div className="space-y-3">
                <button
                  onClick={() => setSelectedRole('owner')}
                  className="w-full flex items-center gap-4 p-4 rounded-md border border-gray-200 bg-white hover-elevate transition-colors text-left"
                >
                  <div className="p-2.5 rounded-md bg-[#2B7DE9]/10">
                    <Briefcase className="h-5 w-5 text-[#2B7DE9]" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Business Owner</p>
                    <p className="text-sm text-muted-foreground">I run my own trade business</p>
                  </div>
                </button>
                <button
                  onClick={() => setSelectedRole('worker')}
                  className="w-full flex items-center gap-4 p-4 rounded-md border border-gray-200 bg-white hover-elevate transition-colors text-left"
                >
                  <div className="p-2.5 rounded-md bg-green-100">
                    <Users className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Team Member</p>
                    <p className="text-sm text-muted-foreground">I have an invite code from my employer</p>
                  </div>
                </button>
                <button
                  onClick={() => setSelectedRole('subcontractor')}
                  className="w-full flex items-center gap-4 p-4 rounded-md border border-gray-200 bg-white hover-elevate transition-colors text-left"
                >
                  <div className="p-2.5 rounded-md bg-[#F28C28]/10">
                    <Wrench className="h-5 w-5 text-[#F28C28]" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Subcontractor</p>
                    <p className="text-sm text-muted-foreground">I have an invite code to join a team</p>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (selectedRole === 'worker' || selectedRole === 'subcontractor') {
    const roleLabel = selectedRole === 'worker' ? 'Team Member' : 'Subcontractor';
    return (
      <div className="min-h-screen bg-[#F2F4F8]" style={ONBOARDING_LIGHT_VARS} data-testid="simple-onboarding-invite">
        <div className="max-w-lg mx-auto p-4 md:p-6 min-h-screen flex flex-col justify-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <img src={jobrunnerLogo} alt="JobRunner" className="h-8 w-auto" />
            <span className="text-xl font-bold">
              <span className="text-[#F28C28]">Job</span><span className="text-[#2B7DE9]">Runner</span>
            </span>
          </div>
          <Card>
            <CardContent className="p-6">
              <button onClick={() => setSelectedRole(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <h2 className="text-xl font-bold text-foreground mb-1">Join as {roleLabel}</h2>
              <p className="text-sm text-muted-foreground mb-6">Enter the invite code from your employer to join their team</p>
              <div className="space-y-4">
                <div>
                  <Label>Invite Code</Label>
                  <Input
                    value={inviteCode}
                    onChange={(e) => handleInviteCodeChange(e.target.value)}
                    placeholder="e.g. MIKE42"
                    className="text-center text-lg tracking-widest font-mono uppercase mt-1"
                    maxLength={6}
                  />
                  {isValidatingCode && <p className="text-sm text-muted-foreground mt-1">Checking...</p>}
                  {inviteValidation?.valid && (
                    <div className="flex items-center gap-2 mt-2 p-2.5 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-sm text-green-700 dark:text-green-300">Joining <strong>{inviteValidation.businessName}</strong> as {inviteValidation.roleType}</span>
                    </div>
                  )}
                  {inviteValidation && !inviteValidation.valid && (
                    <p className="text-sm text-red-500 mt-1">{inviteValidation.error}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>First Name</Label>
                    <Input value={workerName} onChange={(e) => setWorkerName(e.target.value)} placeholder="First name" className="mt-1" />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <Input value={workerLastName} onChange={(e) => setWorkerLastName(e.target.value)} placeholder="Last name" className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label>Phone (optional)</Label>
                  <Input value={workerPhone} onChange={(e) => setWorkerPhone(e.target.value)} placeholder="+61 4XX XXX XXX" className="mt-1" />
                </div>
                <Button
                  className="w-full"
                  onClick={handleWorkerRedeem}
                  disabled={!inviteValidation?.valid || !workerName.trim() || isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Join Team
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F4F8] flex items-center justify-center p-4 md:p-8" style={ONBOARDING_LIGHT_VARS} data-testid="simple-onboarding">
      <div className="w-full max-w-5xl">
        <div className="lg:hidden flex items-center justify-center gap-2 mb-5">
          <img src={jobrunnerLogo} alt="JobRunner" className="h-7 w-auto" />
          <span className="text-lg font-bold">
            <span className="text-[#F28C28]">Job</span><span className="text-[#2B7DE9]">Runner</span>
          </span>
        </div>

        <Card className="overflow-hidden shadow-sm">
          <div className="flex flex-col lg:flex-row">
            <aside className="hidden lg:flex lg:flex-col lg:w-72 shrink-0 border-r border-gray-100 bg-gray-50 p-8">
              <div className="flex items-center gap-2 mb-10">
                <img src={jobrunnerLogo} alt="JobRunner" className="h-8 w-auto" />
                <span className="text-xl font-bold">
                  <span className="text-[#F28C28]">Job</span><span className="text-[#2B7DE9]">Runner</span>
                </span>
              </div>
              {!isDoneStep ? (
                <VerticalSteps steps={STEPS} currentStep={currentStep} />
              ) : (
                <p className="text-sm font-medium text-gray-900">Setup complete</p>
              )}
              <p className="mt-auto pt-8 text-sm text-gray-500">
                Takes about 2 minutes. You can change anything later in Settings.
              </p>
            </aside>

            <div className="flex-1 min-w-0 p-6 md:p-10">
              {!isDoneStep && (
                <div className="lg:hidden -mt-1 mb-7">
                  <StepIndicator steps={STEPS} currentStep={currentStep} />
                </div>
              )}
              {renderCurrentStep()}

              {onSkip && !isDoneStep && (
                <div className="text-center pt-6">
                  <Button
                    variant="ghost"
                    onClick={onSkip}
                    className="text-muted-foreground"
                    data-testid="button-skip"
                  >
                    Skip for now
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
