import { useState, useEffect, useRef } from "react";
import { Link, useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { SignaturePad, SignatureDisplay } from "@/components/ui/signature-pad";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { useTheme } from "@/components/ThemeProvider";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { clearChatHistory } from "@/lib/helpChatStorage";
import { useAppMode } from "@/hooks/use-app-mode";
import { 
  Building, 
  Palette, 
  CreditCard, 
  Mail,
  Save,
  Upload,
  Crown,
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Shield,
  FileText,
  Settings as SettingsIcon,
  Loader2,
  Zap,
  Calendar,
  ExternalLink,
  TrendingUp,
  Headphones,
  Phone,
  MessageCircle,
  PenTool,
  HelpCircle,
  Briefcase,
  Receipt,
  ClipboardList,
  Users,
  BookOpen,
  Sparkles,
  User,
  Edit2,
  X,
  CheckCircle2,
  Check,
  Building2,
  MapPin,
  Wallet,
  Banknote,
  Percent,
  AlertCircle,
  DollarSign,
  PlayCircle,
  Clock,
  ArrowLeft,
  ArrowRight,
  Download,
  MessageSquare,
  Bot,
  Link2,
  Star,
  Globe,
  Copy,
  CalendarPlus,
  Plus,
  Settings2,
  Layers,
} from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { LogoUpload } from "./LogoUpload";
import { ObjectUploader } from "./ObjectUploader";
import { UserAvatar } from "@/components/UserAvatar";
import { QuickRepliesSettings } from "./QuickRepliesSettings";
import { useToast } from "@/hooks/use-toast";
import DataSafetyBanner from "./DataSafetyBanner";
import { TemplateId, TemplateCustomization } from "@/lib/document-templates";
import { PRICING } from "@shared/pricing";
import { tradeCatalog, getTradeDefinition } from "@shared/tradeCatalog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ClearSampleDataCard, ImportDataCard, TimezoneField } from "./SettingsImportCards";
import { ImportHistoryCard } from "./ImportHistoryCard";
import { SheetSyncCard } from "./SheetSyncCard";
import { ProjectTemplatesSettings } from "./ProjectTemplatesSettings";

// Types for MyAccount tab
interface ColorOption {
  color: string;
  available: boolean;
  isCurrentUser: boolean;
}

interface ColorAvailability {
  colors: ColorOption[];
  currentColor: string | null;
  usedCount: number;
  availableCount: number;
}

interface ProfileData {
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    profileImageUrl: string | null;
    tradeType: string | null;
    emailVerified: boolean;
    createdAt: string;
    googleId: string | null;
  };
  isOwner: boolean;
  isTeamMember: boolean;
  teamInfo: {
    isBusinessOwner?: boolean;
    businessOwnerId?: number;
    businessName: string;
    businessEmail: string;
    businessPhone: string | null;
    teamSize?: number;
    joinedAt?: string;
  } | null;
  roleInfo: {
    roleId: string | number;
    roleName: string;
    roleDescription: string;
    hasCustomPermissions: boolean;
  } | null;
  permissions: string[];
}

const permissionLabels: Record<string, string> = {
  read_jobs: "View Jobs",
  write_jobs: "Create/Edit Jobs",
  delete_jobs: "Delete Jobs",
  read_clients: "View Clients",
  write_clients: "Create/Edit Clients",
  delete_clients: "Delete Clients",
  read_quotes: "View Quotes",
  write_quotes: "Create/Edit Quotes",
  read_invoices: "View Invoices",
  write_invoices: "Create/Edit Invoices",
  read_payments: "View Payments",
  process_payments: "Process Payments",
  read_time_entries: "View Time Entries",
  write_time_entries: "Track Time",
  read_team: "View Team Members",
  manage_team: "Manage Team",
  view_reports: "View Reports",
  view_map: "View Map Tracking",
  manage_settings: "Manage Settings",
  manage_billing: "Manage Billing",
};

interface SettingsProps {
  onSave?: (data: any) => void;
  onUploadLogo?: (file: File) => void;
  onUpgradePlan?: () => void;
}


export default function Settings({
  onSave,
  onUploadLogo,
  onUpgradePlan
}: SettingsProps) {
  const { data: businessSettings, isLoading: settingsLoading } = useBusinessSettings();
  const { brandTheme, setBrandTheme } = useTheme();
  const { toast } = useToast();
  const { isTradie, isOwner, isManager, isSolo } = useAppMode();
  
  const canAccessBusinessSettings = !isTradie;
  const canAccessBilling = isOwner || isSolo;
  
  // Remember which tab the user was on - all users can access 'account' tab
  const defaultTab = 'account';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [showAllPermissions, setShowAllPermissions] = useState(false);
  
  // Sync with localStorage on client side only (respect role restrictions)
  useEffect(() => {
    const savedTab = typeof window !== 'undefined' 
      ? localStorage.getItem('jobrunner-settings-tab') 
      : null;
    if (savedTab) {
      // Migrate legacy tab names to new grouped structure
      const legacyTabMap: Record<string, string> = {
        templates: defaultTab,
        business: 'mybusiness',
        branding: 'mybusiness',
        payment: 'money',
        notifications: 'teamcomms',
        communications: 'teamcomms',
      };
      const resolvedTab = legacyTabMap[savedTab] || savedTab;
      if (resolvedTab !== savedTab) {
        localStorage.setItem('jobrunner-settings-tab', resolvedTab);
      }
      // Staff can access account, appearance and support tabs
      if (isTradie && !['support', 'account', 'appearance'].includes(resolvedTab)) {
        setActiveTab('account');
      } else if (!canAccessBilling && resolvedTab === 'billing') {
        setActiveTab(defaultTab);
      } else {
        setActiveTab(resolvedTab);
      }
    }
  }, [isTradie, canAccessBilling, defaultTab]);

  // Honor ?tab= deep links (e.g. /settings?tab=business) so in-app buttons land
  // on the correct section. Takes precedence over the saved localStorage tab.
  // Supports friendly aliases so older links keep working.
  const tabSearch = useSearch();
  const appliedTabSearchRef = useRef<string | null>(null);
  useEffect(() => {
    if (appliedTabSearchRef.current === tabSearch) return;
    const requestedRaw = new URLSearchParams(tabSearch).get('tab');
    if (!requestedRaw) return;
    const aliases: Record<string, string> = {
      subscription: 'billing',
      plan: 'billing',
      // Legacy tab names that map to new grouped structure
      business: 'mybusiness',
      branding: 'mybusiness',
      brand: 'mybusiness',
      payment: 'money',
      rates: 'money',
      notifications: 'teamcomms',
      alerts: 'teamcomms',
      comms: 'teamcomms',
      communications: 'teamcomms',
      export: 'data',
    };
    const key = requestedRaw.toLowerCase();
    const target = aliases[key] || key;
    const validTabs = ['account', 'appearance', 'mybusiness', 'workflow', 'money', 'teamcomms', 'billing', 'support', 'data', 'developer'];
    if (!validTabs.includes(target)) return;
    // Respect role gating before switching
    const isAlwaysAvailable = ['account', 'appearance', 'support'].includes(target);
    const needsBilling = target === 'billing';
    const needsBusiness = !isAlwaysAvailable && !needsBilling;
    if (needsBilling && !canAccessBilling) return;
    if (needsBusiness && !canAccessBusinessSettings) return;
    appliedTabSearchRef.current = tabSearch;
    setActiveTab(target);
    try { localStorage.setItem('jobrunner-settings-tab', target); } catch {}
  }, [tabSearch, canAccessBusinessSettings, canAccessBilling]);
  
  // Business data from API
  const [businessData, setBusinessData] = useState({
    name: "",
    abn: "",
    phone: "",
    email: "",
    address: "",
    gstEnabled: false,
    timezone: "Australia/Sydney",
    currency: "AUD",
    aiEnabled: true,
    aiPhotoAnalysisEnabled: true,
    aiSuggestionsEnabled: true,
    aiAutoCategorizationEnabled: true,
    emailSendingMode: "manual" as "manual" | "automatic",
    tradeType: "general",
    googleReviewUrl: "",
  });

  // Default color matches ThemeProvider's default (#2563EB blue)
  const DEFAULT_BRAND_COLOR = "#2563EB";
  
  const [brandingData, setBrandingData] = useState({
    color: DEFAULT_BRAND_COLOR,
    invoicePrefix: "TT-",
    quotePrefix: "QT-",
    jobPrefix: "",
    invoiceNextNumber: "",
    quoteNextNumber: "",
    jobNextNumber: "",
    customThemeEnabled: false
  });
  
  // Track if user has made local edits to branding (prevents refetch overwrite)
  const [brandingDirty, setBrandingDirty] = useState(false);

  const [paymentData, setPaymentData] = useState({
    defaultHourlyRate: 100,
    calloutFee: 80,
    quoteValidityDays: 30,
    paymentInstructions: "",
    bankDetails: "",
    lateFeeRate: "1.5% per month",
    defaultPaymentTermsDays: 14,
    quoteTerms: "",
    invoiceTerms: "",
    warrantyPeriod: "12 months",
    // Markup defaults (Task #388)
    defaultMaterialMarkupPct: 20,
    defaultEquipmentMarkupPct: 15,
    defaultSubcontractorMarkupPct: 10,
    // Travel allowance rate ($/km) for driving/travel time entries
    travelRatePerKm: 0.85,
  });

  // Signature settings
  const [signatureData, setSignatureData] = useState({
    defaultSignature: "",
    signatureName: "",
    includeSignatureOnQuotes: false,
    includeSignatureOnInvoices: false,
    includeLocationProofOnInvoices: true,
    billBreaks: false,
  });

  // Document template settings
  const [documentTemplate, setDocumentTemplate] = useState<TemplateId>('professional');
  const [templateCustomization, setTemplateCustomization] = useState<TemplateCustomization>({});

  // My Account tab state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchAddresses = async (query: string) => {
    if (query.length < 3) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      return;
    }
    try {
      const encoded = encodeURIComponent(query);
      const res = await fetch(`/api/address-search?q=${encoded}`);
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          setAddressSuggestions(data);
          setShowAddressSuggestions(true);
        } else {
          setAddressSuggestions([]);
          setShowAddressSuggestions(false);
        }
      }
    } catch {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
    }
  };

  const handleAddressInputChange = (value: string) => {
    setBusinessData(prev => ({ ...prev, address: value }));
    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    addressDebounceRef.current = setTimeout(() => searchAddresses(value), 400);
  };

  const handleAddressSelect = (suggestion: any) => {
    setBusinessData(prev => ({ ...prev, address: suggestion.description }));
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);
  };

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await apiRequest('POST', '/api/auth/change-password', data);
      return res.json();
    },
    onSuccess: () => {
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast({ title: 'Password updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: error.message || 'Failed to change password', variant: 'destructive' });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', '/api/account');
    },
    onSuccess: () => {
      window.location.href = '/';
    },
    onError: (error: any) => {
      toast({ title: error.message || 'Failed to delete account', variant: 'destructive' });
    },
  });

  function handleChangePassword() {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (passwordForm.newPassword.length < 8 || !/[A-Z]/.test(passwordForm.newPassword) || !/[^A-Za-z0-9]/.test(passwordForm.newPassword)) {
      toast({ title: 'Password must be at least 8 characters with one uppercase letter and one special character', variant: 'destructive' });
      return;
    }
    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  }

  function handleSignOut() {
    apiRequest('POST', '/api/auth/logout').then(() => {
      clearChatHistory();
      window.location.href = '/';
    }).catch(() => {
      toast({ title: 'Failed to sign out', variant: 'destructive' });
    });
  }

  function handleDeleteAccount() {
    deleteAccountMutation.mutate();
  }

  // Profile query for My Account tab
  const { data: profile, isLoading: isLoadingProfile } = useQuery<ProfileData>({
    queryKey: ['/api/profile/me'],
    staleTime: 30000,
  });

  // Color availability query for My Account tab
  const { data: colorAvailability, isLoading: isLoadingColors } = useQuery<ColorAvailability>({
    queryKey: ['/api/team/colors/available'],
    staleTime: 10000,
  });

  // Update theme color mutation
  const updateThemeColorMutation = useMutation({
    mutationFn: async (themeColor: string) => {
      const response = await apiRequest('PATCH', '/api/user/theme-color', { themeColor });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/colors/available'] });
      queryClient.invalidateQueries({ queryKey: ['/api/profile/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/team/members/colors'] });
      toast({
        title: "Theme colour updated",
        description: "Your unique colour has been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update colour",
        description: error.message || "This colour may already be taken by another team member.",
        variant: "destructive",
      });
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; phone: string }) => {
      const response = await apiRequest('PATCH', '/api/profile/me', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({
        title: "Profile updated",
        description: "Your personal details have been saved.",
      });
      setIsEditingProfile(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update profile",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update profile photo (separate from the edit form so it works inline)
  const updatePhotoMutation = useMutation({
    mutationFn: async (profileImageUrl: string | null) => {
      const response = await apiRequest('PATCH', '/api/profile/me', { profileImageUrl });
      return response.json();
    },
    onSuccess: (_data, profileImageUrl) => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({
        title: profileImageUrl ? "Photo updated" : "Photo removed",
        description: profileImageUrl
          ? "Your profile photo has been saved."
          : "Your profile photo has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update photo",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEditProfile = () => {
    if (profile) {
      setProfileFormData({
        firstName: profile.user.firstName || "",
        lastName: profile.user.lastName || "",
        phone: profile.user.phone || "",
      });
      setIsEditingProfile(true);
    }
  };

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(profileFormData);
  };

  const handleCancelProfileEdit = () => {
    setIsEditingProfile(false);
  };

  const [notificationPreferences, setNotificationPreferences] = useState({
    quoteResponses: true,
    paymentConfirmations: true,
    overdueInvoices: true,
    weeklySummary: false
  });

  // Load real data from businessSettings - DO NOT modify theme context on load
  // Theme is managed by ThemeProvider from localStorage, only update on explicit save
  useEffect(() => {
    if (businessSettings) {
      // Always update business data
      setBusinessData({
        name: businessSettings.businessName || "",
        abn: businessSettings.abn || "",
        phone: businessSettings.phone || "",
        email: businessSettings.email || "",
        address: businessSettings.address || "",
        gstEnabled: businessSettings.gstEnabled || false,
        timezone: (businessSettings as any).timezone || "Australia/Sydney",
        currency: "AUD",
        aiEnabled: (businessSettings as any).aiEnabled !== false,
        aiPhotoAnalysisEnabled: (businessSettings as any).aiPhotoAnalysisEnabled !== false,
        aiSuggestionsEnabled: (businessSettings as any).aiSuggestionsEnabled !== false,
        aiAutoCategorizationEnabled: (businessSettings as any).aiAutoCategorizationEnabled !== false,
        emailSendingMode: (businessSettings as any).emailSendingMode || "manual",
        tradeType: (businessSettings as any).tradeType || "general",
        googleReviewUrl: (businessSettings as any).googleReviewUrl || "",
      });
      
      // Always update payment data
      setPaymentData({
        defaultHourlyRate: parseFloat(businessSettings.defaultHourlyRate) || 100,
        calloutFee: parseFloat(businessSettings.calloutFee) || 80,
        quoteValidityDays: businessSettings.quoteValidityDays || 30,
        paymentInstructions: businessSettings.paymentInstructions || "",
        bankDetails: (businessSettings as any).bankDetails || "",
        lateFeeRate: businessSettings.lateFeeRate || "1.5% per month",
        defaultPaymentTermsDays: (businessSettings as any).defaultPaymentTermsDays || 14,
        quoteTerms: (businessSettings as any).quoteTerms || "",
        invoiceTerms: (businessSettings as any).invoiceTerms || "",
        warrantyPeriod: businessSettings.warrantyPeriod || "12 months",
        // Markup defaults (Task #388) — use isNaN guard so a saved value of 0 is not replaced by the fallback
        defaultMaterialMarkupPct: (() => { const v = parseFloat((businessSettings as any).defaultMaterialMarkupPct); return isNaN(v) ? 20 : v; })(),
        defaultEquipmentMarkupPct: (() => { const v = parseFloat((businessSettings as any).defaultEquipmentMarkupPct); return isNaN(v) ? 15 : v; })(),
        defaultSubcontractorMarkupPct: (() => { const v = parseFloat((businessSettings as any).defaultSubcontractorMarkupPct); return isNaN(v) ? 10 : v; })(),
        travelRatePerKm: (() => { const v = parseFloat((businessSettings as any).travelRatePerKm); return isNaN(v) ? 0.85 : v; })(),
      });
      
      // Load signature settings
      setSignatureData({
        defaultSignature: (businessSettings as any).defaultSignature || "",
        signatureName: (businessSettings as any).signatureName || "",
        includeSignatureOnQuotes: (businessSettings as any).includeSignatureOnQuotes || false,
        includeSignatureOnInvoices: (businessSettings as any).includeSignatureOnInvoices || false,
        includeLocationProofOnInvoices: (businessSettings as any).includeLocationProofOnInvoices !== false,
        billBreaks: (businessSettings as any).billBreaks === true,
      });
      
      // Load document template setting
      setDocumentTemplate(((businessSettings as any).documentTemplate || 'professional') as TemplateId);
      
      // Load template customization settings
      const savedCustomization = (businessSettings as any).documentTemplateSettings;
      if (savedCustomization && typeof savedCustomization === 'object') {
        setTemplateCustomization(savedCustomization);
      }
      
      // Get server values - check both primaryColor and brandColor fields
      const serverColor = businessSettings.primaryColor || businessSettings.brandColor || DEFAULT_BRAND_COLOR;
      const serverCustomEnabled = businessSettings.customThemeEnabled || false;
      
      // Validate color is a proper hex color (6 characters after #)
      const isValidColor = serverColor && /^#[0-9A-Fa-f]{6}$/.test(serverColor);
      const safeColor = isValidColor ? serverColor : DEFAULT_BRAND_COLOR;
      
      // Only update local form state if user hasn't made edits
      // This protects unsaved form values from being overwritten
      if (!brandingDirty) {
        setBrandingData({
          color: safeColor,
          invoicePrefix: businessSettings.invoicePrefix || "TT-",
          quotePrefix: businessSettings.quotePrefix || "QT-",
          jobPrefix: businessSettings.jobPrefix || "",
          invoiceNextNumber: businessSettings.invoiceNextNumber != null ? String(businessSettings.invoiceNextNumber) : "",
          quoteNextNumber: businessSettings.quoteNextNumber != null ? String(businessSettings.quoteNextNumber) : "",
          jobNextNumber: (businessSettings as any).jobNextNumber != null ? String((businessSettings as any).jobNextNumber) : "",
          customThemeEnabled: serverCustomEnabled
        });
      }
    }
  }, [businessSettings, brandingDirty]);

  // Fetch integration status
  const { data: integrationStatus } = useQuery({
    queryKey: ['/api/integrations/status'],
    queryFn: async () => {
      const response = await fetch('/api/integrations/status');
      if (!response.ok) return { stripe: false, sendgrid: false };
      return response.json();
    }
  });

  // Fetch integration settings (includes notification preferences)
  const { data: integrationSettingsData } = useQuery<any>({
    queryKey: ['/api/integrations/settings'],
  });

  // Load notification preferences from integration settings
  useEffect(() => {
    if (integrationSettingsData) {
      setNotificationPreferences({
        quoteResponses: integrationSettingsData.notifyQuoteResponses ?? true,
        paymentConfirmations: integrationSettingsData.notifyPaymentConfirmations ?? true,
        overdueInvoices: integrationSettingsData.notifyOverdueInvoices ?? true,
        weeklySummary: integrationSettingsData.notifyWeeklySummary ?? false
      });
    }
  }, [integrationSettingsData]);

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", "/api/business-settings", data);
    },
    onSuccess: () => {
      // Reset dirty flag after successful save
      setBrandingDirty(false);
      queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
      toast({
        title: "Settings Saved",
        description: "Your business settings have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Save notification preferences mutation
  const saveNotificationPreferencesMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/integrations/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/settings'] });
      toast({
        title: "Preferences Saved",
        description: "Your notification preferences have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save notification preferences.",
        variant: "destructive",
      });
    }
  });

  // Handle notification preference change
  const handleNotificationChange = (key: keyof typeof notificationPreferences, value: boolean) => {
    const newPrefs = { ...notificationPreferences, [key]: value };
    setNotificationPreferences(newPrefs);
    
    // Map to database field names
    const dbData = {
      notifyQuoteResponses: newPrefs.quoteResponses,
      notifyPaymentConfirmations: newPrefs.paymentConfirmations,
      notifyOverdueInvoices: newPrefs.overdueInvoices,
      notifyWeeklySummary: newPrefs.weeklySummary
    };
    
    saveNotificationPreferencesMutation.mutate(dbData);
  };

  // Quick save for individual business settings (e.g., AI toggles)
  const handleBusinessSave = (data: Partial<typeof businessData>) => {
    saveSettingsMutation.mutate(data);
  };

  const handleSave = async () => {
    const updateData = {
      businessName: businessData.name,
      abn: businessData.abn,
      phone: businessData.phone,
      email: businessData.email,
      address: businessData.address,
      gstEnabled: businessData.gstEnabled,
      timezone: businessData.timezone,
      tradeType: businessData.tradeType,
      primaryColor: brandingData.color,
      invoicePrefix: brandingData.invoicePrefix,
      quotePrefix: brandingData.quotePrefix,
      jobPrefix: brandingData.jobPrefix?.trim() || null,
      invoiceNextNumber: brandingData.invoiceNextNumber.trim() !== "" && parseInt(brandingData.invoiceNextNumber, 10) > 0 ? parseInt(brandingData.invoiceNextNumber, 10) : null,
      quoteNextNumber: brandingData.quoteNextNumber.trim() !== "" && parseInt(brandingData.quoteNextNumber, 10) > 0 ? parseInt(brandingData.quoteNextNumber, 10) : null,
      jobNextNumber: brandingData.jobNextNumber.trim() !== "" && parseInt(brandingData.jobNextNumber, 10) > 0 ? parseInt(brandingData.jobNextNumber, 10) : null,
      customThemeEnabled: brandingData.customThemeEnabled,
      defaultHourlyRate: paymentData.defaultHourlyRate.toString(),
      calloutFee: paymentData.calloutFee.toString(),
      quoteValidityDays: paymentData.quoteValidityDays,
      paymentInstructions: paymentData.paymentInstructions,
      bankDetails: paymentData.bankDetails,
      lateFeeRate: paymentData.lateFeeRate,
      defaultPaymentTermsDays: paymentData.defaultPaymentTermsDays,
      quoteTerms: paymentData.quoteTerms,
      invoiceTerms: paymentData.invoiceTerms,
      warrantyPeriod: paymentData.warrantyPeriod,
      // Markup defaults (Task #388)
      defaultMaterialMarkupPct: paymentData.defaultMaterialMarkupPct.toString(),
      defaultEquipmentMarkupPct: paymentData.defaultEquipmentMarkupPct.toString(),
      defaultSubcontractorMarkupPct: paymentData.defaultSubcontractorMarkupPct.toString(),
      travelRatePerKm: paymentData.travelRatePerKm.toString(),
      // Signature settings
      defaultSignature: signatureData.defaultSignature,
      signatureName: signatureData.signatureName,
      includeSignatureOnQuotes: signatureData.includeSignatureOnQuotes,
      includeSignatureOnInvoices: signatureData.includeSignatureOnInvoices,
      includeLocationProofOnInvoices: signatureData.includeLocationProofOnInvoices,
      billBreaks: signatureData.billBreaks,
      // Document template
      documentTemplate: documentTemplate,
      documentTemplateSettings: templateCustomization,
      // Google Reviews & Booking Page
      googleReviewUrl: businessData.googleReviewUrl,
    };
    
    saveSettingsMutation.mutate(updateData);
    onSave?.(updateData);
  };

  // Australian Invoice Legal Compliance Checklist
  const complianceChecklist = [
    {
      id: 'tax_invoice_label',
      label: '"TAX INVOICE" label displayed when GST enabled',
      status: businessSettings?.gstEnabled || businessData.gstEnabled ? 'pass' : 'warning',
      description: 'Required for GST-registered businesses on taxable sales over $82.50'
    },
    {
      id: 'business_identity',
      label: 'Business name/identity clearly shown',
      status: businessSettings?.businessName || businessData.name ? 'pass' : 'fail',
      description: 'Must display registered business name or individual name'
    },
    {
      id: 'abn_display',
      label: 'Australian Business Number (ABN) displayed',
      status: businessSettings?.abn || businessData.abn ? 'pass' : 'fail',
      description: 'Valid ABN required for all tax invoices'
    },
    {
      id: 'issue_date',
      label: 'Invoice issue date included',
      status: 'pass',
      description: 'Invoice creation date automatically included'
    },
    {
      id: 'item_descriptions',
      label: 'Detailed item descriptions with quantities',
      status: 'pass',
      description: 'Line items show descriptions, quantities, and individual prices'
    },
    {
      id: 'gst_calculation',
      label: 'GST amount calculated correctly (10%)',
      status: businessSettings?.gstEnabled || businessData.gstEnabled ? 'pass' : 'na',
      description: 'GST = 1/11 of GST-inclusive price, rounded to nearest cent'
    },
    {
      id: 'buyer_details',
      label: 'Customer details for invoices $1,000+',
      status: 'pass',
      description: 'Client name and contact details included for high-value invoices'
    },
    {
      id: 'payment_terms',
      label: 'Payment terms specified',
      status: paymentData.defaultPaymentTermsDays > 0 ? 'pass' : 'warning',
      description: 'Clear payment terms help with debt recovery'
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default:
        return <CheckCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getFixAction = (item: { id: string; status: string }) => {
    if (item.status === 'pass' || item.status === 'na') return null;

    const scrollToElement = (selector: string) => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus?.();
        el.classList.add('ring-2', 'ring-offset-2');
        setTimeout(() => el.classList.remove('ring-2', 'ring-offset-2'), 2000);
      }
    };

    switch (item.id) {
      case 'tax_invoice_label':
        return () => scrollToElement('[data-testid="switch-gst"]');
      case 'business_identity':
        return () => scrollToElement('[data-testid="input-business-name"]');
      case 'abn_display':
        return () => scrollToElement('[data-testid="input-abn"]');
      case 'payment_terms':
        return () => {
          setActiveTab('money');
          localStorage.setItem('jobrunner-settings-tab', 'money');
          setTimeout(() => scrollToElement('[data-testid="input-payment-terms-days"]'), 300);
        };
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass':
        return <Badge variant="default" className="bg-green-100 text-green-800">Compliant</Badge>;
      case 'fail':
        return <Badge variant="destructive">Missing</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      default:
        return <Badge variant="outline">N/A</Badge>;
    }
  };

  return (
    <PageShell data-testid="settings">
      <PageHeader
        title="Settings"
        subtitle="Manage your business profile and preferences"
        action={
          <Button 
            onClick={handleSave} 
            disabled={saveSettingsMutation.isPending}
            data-testid="button-save-settings"
            style={{
              backgroundColor: 'hsl(var(--trade))',
              borderColor: 'hsl(var(--trade-border))',
              color: 'white'
            }}
          >
            {saveSettingsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        }
      />

      {/* Quick Plan Status - links to Billing tab (hidden for staff) */}
      {canAccessBilling && (
        <Card 
          className="hover-elevate cursor-pointer" 
          onClick={() => {
            setActiveTab('billing');
            localStorage.setItem('jobrunner-settings-tab', 'billing');
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                <div>
                  <p className="font-semibold">Manage Subscription</p>
                  <p className="text-sm text-muted-foreground">View plan details, usage & billing</p>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      )}


      <Tabs 
        value={activeTab} 
        onValueChange={(value) => {
          setActiveTab(value);
          localStorage.setItem('jobrunner-settings-tab', value);
        }} 
        className="space-y-6"
      >
        {/* Grouped tab navigation — 4 purpose-based sections + utility tabs */}
        <div className="overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
          <TabsList className="inline-flex w-auto min-w-max items-center">
            {/* Personal */}
            <TabsTrigger value="account" data-testid="tab-account" className="flex-shrink-0">
              <User className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">My Account</span>
              <span className="sm:hidden">Me</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" data-testid="tab-appearance" className="flex-shrink-0">
              <Palette className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Appearance</span>
              <span className="sm:hidden">Look</span>
            </TabsTrigger>

            {canAccessBusinessSettings && (
              <>
                {/* Divider */}
                <div className="w-px h-5 bg-border mx-1 flex-shrink-0" aria-hidden />

                {/* My Business group */}
                <TabsTrigger value="mybusiness" data-testid="tab-mybusiness" className="flex-shrink-0">
                  <Building className="h-4 w-4 mr-1.5" />
                  <span className="hidden sm:inline">My Business</span>
                  <span className="sm:hidden">Business</span>
                </TabsTrigger>

                {/* Workflow group */}
                <TabsTrigger value="workflow" data-testid="tab-workflow" className="flex-shrink-0">
                  <ClipboardList className="h-4 w-4 mr-1.5" />
                  Workflow
                </TabsTrigger>

                {/* Money group */}
                <TabsTrigger value="money" data-testid="tab-money" className="flex-shrink-0">
                  <Wallet className="h-4 w-4 mr-1.5" />
                  Money
                </TabsTrigger>

                {/* Team & Comms group */}
                <TabsTrigger value="teamcomms" data-testid="tab-teamcomms" className="flex-shrink-0">
                  <Users className="h-4 w-4 mr-1.5" />
                  <span className="hidden sm:inline">Team & Comms</span>
                  <span className="sm:hidden">Team</span>
                </TabsTrigger>

                <div className="w-px h-5 bg-border mx-1 flex-shrink-0" aria-hidden />
              </>
            )}

            {/* Utility tabs */}
            {canAccessBilling && (
              <TabsTrigger value="billing" data-testid="tab-billing" className="flex-shrink-0">
                <Crown className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Billing</span>
                <span className="sm:hidden">Plan</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="support" data-testid="tab-support" className="flex-shrink-0">
              <Headphones className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Support</span>
              <span className="sm:hidden">Help</span>
            </TabsTrigger>
            {canAccessBusinessSettings && (
              <TabsTrigger value="data" data-testid="tab-data" className="flex-shrink-0">
                <Download className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Data Export</span>
                <span className="sm:hidden">Export</span>
              </TabsTrigger>
            )}
            {import.meta.env.DEV && canAccessBusinessSettings && (
              <TabsTrigger value="developer" data-testid="tab-developer" className="flex-shrink-0">
                <Zap className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Developer</span>
                <span className="sm:hidden">Dev</span>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="account" className="space-y-6">
          {isLoadingProfile ? (
            <div className="space-y-6">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : !profile ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Unable to load profile information. Please try again.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Personal Details
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">Your personal information</p>
                  </div>
                  {!isEditingProfile ? (
                    <Button variant="outline" size="sm" onClick={handleEditProfile} data-testid="button-edit-profile">
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveProfile} disabled={updateProfileMutation.isPending} data-testid="button-save-profile">
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleCancelProfileEdit} data-testid="button-cancel-edit">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <UserAvatar
                      className="h-16 w-16 text-lg"
                      user={{
                        id: String(profile.user.id),
                        firstName: profile.user.firstName,
                        lastName: profile.user.lastName,
                        email: profile.user.email,
                        photoUrl: profile.user.profileImageUrl,
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <ObjectUploader
                        maxFileSize={5 * 1024 * 1024}
                        uploadEndpoint="/api/objects/upload-file"
                        onComplete={(url) => updatePhotoMutation.mutate(url)}
                        accept="image/*"
                      >
                        <div className="flex items-center gap-2">
                          <Upload className="h-4 w-4" />
                          <span>{profile.user.profileImageUrl ? "Change photo" : "Upload photo"}</span>
                        </div>
                      </ObjectUploader>
                      {profile.user.profileImageUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updatePhotoMutation.mutate(null)}
                          disabled={updatePhotoMutation.isPending}
                          data-testid="button-remove-photo"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      {isEditingProfile ? (
                        <Input
                          id="firstName"
                          value={profileFormData.firstName}
                          onChange={(e) => setProfileFormData({ ...profileFormData, firstName: e.target.value })}
                          data-testid="input-first-name"
                        />
                      ) : (
                        <p className="text-foreground font-medium" data-testid="text-first-name">
                          {profile.user.firstName || "-"}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      {isEditingProfile ? (
                        <Input
                          id="lastName"
                          value={profileFormData.lastName}
                          onChange={(e) => setProfileFormData({ ...profileFormData, lastName: e.target.value })}
                          data-testid="input-last-name"
                        />
                      ) : (
                        <p className="text-foreground font-medium" data-testid="text-last-name">
                          {profile.user.lastName || "-"}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        Email
                      </Label>
                      <div className="flex items-center gap-2">
                        <p className="text-foreground font-medium" data-testid="text-email">
                          {profile.user.email}
                        </p>
                        {profile.user.emailVerified && (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        Phone
                      </Label>
                      {isEditingProfile ? (
                        <Input
                          id="account-phone"
                          value={profileFormData.phone}
                          onChange={(e) => setProfileFormData({ ...profileFormData, phone: e.target.value })}
                          placeholder="04XX XXX XXX"
                          data-testid="input-phone"
                        />
                      ) : (
                        <p className="text-foreground font-medium" data-testid="text-phone">
                          {profile.user.phone || "-"}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Account created{" "}
                      {profile.user.createdAt
                        ? format(new Date(profile.user.createdAt), "d MMM yyyy")
                        : "Unknown"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Team Membership
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {profile.isOwner ? "Your business information" : "The business you work for"}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Business Name</Label>
                      <p className="font-medium" data-testid="text-business-name">
                        {profile.teamInfo?.businessName || "Not set"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Business Email</Label>
                      <p className="font-medium" data-testid="text-business-email">
                        {profile.teamInfo?.businessEmail || "-"}
                      </p>
                    </div>
                  </div>

                  {profile.isOwner && profile.teamInfo?.isBusinessOwner && (
                    <div className="flex items-center gap-4 pt-2">
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                        <Crown className="h-3 w-3 mr-1" />
                        Business Owner
                      </Badge>
                      {typeof profile.teamInfo.teamSize === 'number' && (
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {profile.teamInfo.teamSize} team member{profile.teamInfo.teamSize !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  )}

                  {profile.isTeamMember && profile.teamInfo?.joinedAt && (
                    <p className="text-sm text-muted-foreground">
                      Joined {format(new Date(profile.teamInfo.joinedAt), "d MMM yyyy")}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Role & Permissions
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Your access level and what you can do in the app
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Badge
                      className={
                        profile.isOwner
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "bg-blue-100 text-blue-800"
                      }
                    >
                      {profile.roleInfo?.roleName || "Unknown Role"}
                    </Badge>
                    {profile.roleInfo?.hasCustomPermissions && (
                      <Badge variant="outline" className="text-xs">
                        Custom Permissions
                      </Badge>
                    )}
                  </div>

                  {profile.roleInfo?.roleDescription && (
                    <p className="text-sm text-muted-foreground">
                      {profile.roleInfo.roleDescription}
                    </p>
                  )}

                  <Separator />

                  <div>
                    <h4 className="text-sm font-medium mb-3">Your Permissions</h4>
                    <div className="flex flex-wrap gap-2">
                      {profile.permissions && profile.permissions.length > 0 ? (
                        (showAllPermissions ? profile.permissions : profile.permissions.slice(0, 8)).map((perm) => (
                          <Badge key={perm} variant="secondary" className="text-xs">
                            {permissionLabels[perm] || perm}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No specific permissions assigned
                        </p>
                      )}
                    </div>
                    {profile.permissions && profile.permissions.length > 8 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => setShowAllPermissions(!showAllPermissions)}
                        data-testid="button-toggle-permissions"
                      >
                        {showAllPermissions ? "Show less" : `Show all ${profile.permissions.length} permissions`}
                      </Button>
                    )}
                  </div>

                  {profile.isOwner && (
                    <p className="text-xs text-muted-foreground mt-4">
                      As the business owner, you have full access to all features.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Security - Password Change */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage your password and sign-in methods
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Change Password</h4>
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    placeholder="Enter current password"
                    data-testid="input-current-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    placeholder="Min 8 chars, 1 uppercase, 1 number"
                    data-testid="input-new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    placeholder="Repeat new password"
                    data-testid="input-confirm-password"
                  />
                </div>
                <Button
                  onClick={handleChangePassword}
                  disabled={changePasswordMutation.isPending || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                  data-testid="button-change-password"
                >
                  {changePasswordMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Connected Accounts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Connected Accounts
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Sign-in methods linked to your account
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center border">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Email & Password</p>
                    <p className="text-xs text-muted-foreground">{profile?.user.email}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center border">
                    <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Google</p>
                    <p className="text-xs text-muted-foreground">
                      {profile?.user.googleId ? 'Connected' : 'Not connected'}
                    </p>
                  </div>
                </div>
                {profile?.user.googleId ? (
                  <Badge variant="secondary" className="text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Linked
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Not linked
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Account Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Account Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Sign Out</p>
                  <p className="text-xs text-muted-foreground">Log out of your account on this device</p>
                </div>
                <Button variant="outline" onClick={handleSignOut} data-testid="button-sign-out">
                  Sign Out
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-destructive">Delete Account</p>
                  <p className="text-xs text-muted-foreground">Permanently delete your account and all data</p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  data-testid="button-delete-account"
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Delete Account Confirmation Dialog */}
          <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-destructive">Delete Account</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                This will permanently delete your account and all associated data including jobs, quotes, invoices, clients, and team settings. This action cannot be undone.
              </p>
              <div className="space-y-2">
                <Label>Type "DELETE" to confirm</Label>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder='Type "DELETE"'
                  data-testid="input-delete-confirm"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || deleteAccountMutation.isPending}
                  data-testid="button-confirm-delete"
                >
                  {deleteAccountMutation.isPending ? 'Deleting...' : 'Delete My Account'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Clear Sample Data Card - shown when user has demo data */}
          <ClearSampleDataCard />

          {/* Import Data Card */}
          <ImportDataCard />

          {/* Import History - traceability + undo for every import (Task 300) */}
          <ImportHistoryCard />
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          {/* Personal colour - available to all team members */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Your Colour
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Choose your unique colour for map tracking and app theme. Each team member has a different colour so you're easy to spot on the map.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingColors ? (
                <div className="flex gap-2">
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-10 rounded-full" />
                  ))}
                </div>
              ) : colorAvailability ? (
                <>
                  <div className="grid grid-cols-5 sm:grid-cols-8 gap-3">
                    {colorAvailability.colors.map((colorOption) => (
                      <button
                        key={colorOption.color}
                        type="button"
                        disabled={!colorOption.available && !colorOption.isCurrentUser || updateThemeColorMutation.isPending}
                        onClick={() => {
                          if (colorOption.available || colorOption.isCurrentUser) {
                            updateThemeColorMutation.mutate(colorOption.color);
                          }
                        }}
                        className={`
                          relative h-10 w-10 rounded-full border-2 transition-all
                          ${colorOption.isCurrentUser 
                            ? 'ring-2 ring-offset-2 ring-primary border-primary scale-110' 
                            : colorOption.available 
                              ? 'border-transparent hover:scale-110 hover-elevate cursor-pointer' 
                              : 'opacity-40 cursor-not-allowed border-muted'
                          }
                        `}
                        style={{ backgroundColor: colorOption.color }}
                        data-testid={`color-swatch-${colorOption.color.replace('#', '')}`}
                        title={
                          colorOption.isCurrentUser 
                            ? 'Your current colour' 
                            : colorOption.available 
                              ? 'Available - click to select' 
                              : 'Already taken by a team member'
                        }
                      >
                        {colorOption.isCurrentUser && (
                          <Check className="absolute inset-0 m-auto h-5 w-5 text-white drop-shadow-md" />
                        )}
                        {updateThemeColorMutation.isPending && colorOption.color === colorAvailability.currentColor && (
                          <Loader2 className="absolute inset-0 m-auto h-5 w-5 text-white animate-spin" />
                        )}
                      </button>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-primary ring-2 ring-primary ring-offset-1"></div>
                      <span>Your colour</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-muted-foreground/40"></div>
                      <span>Taken</span>
                    </div>
                  </div>

                  {colorAvailability.currentColor && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div 
                        className="h-8 w-8 rounded-full border-2 border-primary" 
                        style={{ backgroundColor: colorAvailability.currentColor }}
                      />
                      <div>
                        <p className="font-medium text-sm">Current colour</p>
                        <p className="text-xs text-muted-foreground">
                          This colour will be shown on the team map and in your profile
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Unable to load colour options</p>
              )}
            </CardContent>
          </Card>

          {/* App brand colour - business owners/managers only */}
          {canAccessBusinessSettings && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  App Color
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <p className="text-sm text-muted-foreground">
                    Choose your accent color for the app. This color will be used for buttons, highlights, and other interactive elements.
                  </p>
                  
                  {/* Color Picker */}
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                      {[
                        { color: '#2563EB', name: 'Blue' },
                        { color: '#3b82f6', name: 'Blue' },
                        { color: '#10b981', name: 'Green' },
                        { color: '#8b5cf6', name: 'Purple' },
                        { color: '#f59e0b', name: 'Orange' },
                        { color: '#ef4444', name: 'Red' },
                        { color: '#ec4899', name: 'Pink' },
                        { color: '#06b6d4', name: 'Cyan' },
                        { color: '#84cc16', name: 'Lime' },
                      ].map((preset) => (
                        <button
                          key={preset.color}
                          type="button"
                          onClick={() => {
                            setBrandingDirty(true);
                            setBrandingData(prev => ({ ...prev, color: preset.color, customThemeEnabled: true }));
                            setBrandTheme({
                              primaryColor: preset.color,
                              customThemeEnabled: true
                            });
                            localStorage.setItem('jobrunner-brand-theme', JSON.stringify({
                              primaryColor: preset.color,
                              customThemeEnabled: true
                            }));
                          }}
                          className={`w-12 h-12 rounded-xl transition-shadow duration-200 ${
                            brandingData.color === preset.color && brandingData.customThemeEnabled
                              ? 'ring-2 ring-offset-2 ring-foreground shadow-lg' 
                              : 'ring-1 ring-border'
                          }`}
                          style={{ 
                            backgroundColor: preset.color,
                            WebkitTapHighlightColor: 'transparent',
                            touchAction: 'manipulation'
                          }}
                          title={preset.name}
                          data-testid={`color-${preset.name.toLowerCase()}`}
                        />
                      ))}
                    </div>
                    
                    {/* Custom color input */}
                    <div className="flex items-center gap-3 pt-2">
                      <div className="flex items-center gap-2 flex-1 max-w-xs">
                        <input
                          type="color"
                          value={brandingData.color}
                          onChange={(e) => {
                            setBrandingDirty(true);
                            setBrandingData(prev => ({ ...prev, color: e.target.value, customThemeEnabled: true }));
                            setBrandTheme({
                              primaryColor: e.target.value,
                              customThemeEnabled: true
                            });
                            localStorage.setItem('jobrunner-brand-theme', JSON.stringify({
                              primaryColor: e.target.value,
                              customThemeEnabled: true
                            }));
                          }}
                          className="w-12 h-12 rounded-xl cursor-pointer border-0 p-0"
                          data-testid="input-custom-color"
                        />
                        <div className="flex-1">
                          <Label className="text-sm font-medium">Custom Color</Label>
                          <Input
                            value={brandingData.color}
                            onChange={(e) => {
                              setBrandingDirty(true);
                              setBrandingData(prev => ({ ...prev, color: e.target.value, customThemeEnabled: true }));
                              if (e.target.value.match(/^#[0-9A-Fa-f]{6}$/)) {
                                setBrandTheme({
                                  primaryColor: e.target.value,
                                  customThemeEnabled: true
                                });
                                localStorage.setItem('jobrunner-brand-theme', JSON.stringify({
                                  primaryColor: e.target.value,
                                  customThemeEnabled: true
                                }));
                              }
                            }}
                            placeholder="#2563EB"
                            className="h-8 text-sm font-mono"
                            data-testid="input-brand-color"
                          />
                        </div>
                      </div>
                      
                      {brandingData.customThemeEnabled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setBrandingDirty(true);
                            setBrandingData(prev => ({ ...prev, color: '#2563EB', customThemeEnabled: false }));
                            setBrandTheme({
                              primaryColor: '#2563EB',
                              customThemeEnabled: false
                            });
                            localStorage.setItem('jobrunner-brand-theme', JSON.stringify({
                              primaryColor: '#2563EB',
                              customThemeEnabled: false
                            }));
                          }}
                          className="text-muted-foreground"
                          data-testid="button-reset-color"
                        >
                          Reset to Default
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Preview */}
                  {brandingData.customThemeEnabled && (
                    <div className="pt-4 border-t animate-fade-in">
                      <p className="text-xs text-muted-foreground mb-3">Preview</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <Button style={{ backgroundColor: brandingData.color }} className="text-white">
                          Primary Button
                        </Button>
                        <Badge style={{ backgroundColor: brandingData.color }} className="text-white">
                          Badge
                        </Badge>
                        <div 
                          className="h-2 w-24 rounded-full" 
                          style={{ backgroundColor: brandingData.color }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── My Business ── profile, branding, logo, GST, document templates ── */}
        <TabsContent value="mybusiness" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business-name">Business Name</Label>
                  <Input
                    id="business-name"
                    value={businessData.name}
                    onChange={(e) => setBusinessData(prev => ({ ...prev, name: e.target.value }))}
                    data-testid="input-business-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="abn">ABN (Optional)</Label>
                  <Input
                    id="abn"
                    value={businessData.abn}
                    onChange={(e) => setBusinessData(prev => ({ ...prev, abn: e.target.value }))}
                    data-testid="input-abn"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={businessData.phone}
                    onChange={(e) => setBusinessData(prev => ({ ...prev, phone: e.target.value }))}
                    data-testid="input-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={businessData.email}
                    onChange={(e) => setBusinessData(prev => ({ ...prev, email: e.target.value }))}
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={businessData.address}
                    onChange={(e) => handleAddressInputChange(e.target.value)}
                    onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 200)}
                    placeholder="Start typing to search..."
                    data-testid="input-address"
                  />
                  {showAddressSuggestions && addressSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {addressSuggestions.slice(0, 5).map((suggestion: any, index: number) => (
                        <button
                          key={index}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover-elevate flex items-center gap-2 border-b border-border last:border-b-0"
                          onMouseDown={(e) => { e.preventDefault(); handleAddressSelect(suggestion); }}
                        >
                          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{suggestion.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trade-type">Trade Type</Label>
                  <Select 
                    value={businessData.tradeType} 
                    onValueChange={(value) => setBusinessData(prev => ({ ...prev, tradeType: value }))}
                  >
                    <SelectTrigger data-testid="select-trade-type">
                      <SelectValue placeholder="Select your trade" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(tradeCatalog).map(([key, trade]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: trade.color }}
                            />
                            <span>{trade.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {businessData.tradeType && businessData.tradeType !== 'general' && (
                    <p className="text-xs text-muted-foreground">
                      {getTradeDefinition(businessData.tradeType)?.description}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              <TimezoneField
                value={businessData.timezone}
                onChange={(tz) => setBusinessData(prev => ({ ...prev, timezone: tz }))}
              />

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>GST Registration</Label>
                  <p className="text-sm text-muted-foreground">Add GST to quotes and invoices</p>
                </div>
                <Switch
                  checked={businessData.gstEnabled}
                  onCheckedChange={(checked) => setBusinessData(prev => ({ ...prev, gstEnabled: checked }))}
                  data-testid="switch-gst"
                />
              </div>
            </CardContent>
          </Card>

          {/* Australian Legal Compliance */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5" style={{ color: 'hsl(var(--trade))' }} />
                <CardTitle>Australian Tax Invoice Compliance</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Ensure your invoices meet ATO (Australian Taxation Office) requirements for GST compliance
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {complianceChecklist.map((item) => {
                const fixAction = getFixAction(item);
                return (
                  <div key={item.id} className="flex items-start justify-between p-4 border rounded-lg">
                    <div className="flex items-start gap-3 flex-1">
                      {getStatusIcon(item.status)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h4 className="font-medium">{item.label}</h4>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(item.status)}
                            {fixAction && (
                              <Button variant="outline" size="sm" onClick={fixAction}>
                                Fix Now
                                <ArrowRight className="h-3 w-3 ml-1" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              <div 
                className="mt-4 p-4 rounded-lg border"
                style={{ 
                  backgroundColor: 'hsl(var(--trade) / 0.05)',
                  borderColor: 'hsl(var(--trade) / 0.2)'
                }}
              >
                <div className="flex items-start gap-2">
                  <FileText className="w-5 h-5 mt-0.5" style={{ color: 'hsl(var(--trade))' }} />
                  <div>
                    <h4 className="font-medium" style={{ color: 'hsl(var(--trade))' }}>Compliance Summary</h4>
                    <p className="text-sm mt-1" style={{ color: 'hsl(var(--trade) / 0.8)' }}>
                      {complianceChecklist.filter(item => item.status === 'pass').length} of{' '}
                      {complianceChecklist.filter(item => item.status !== 'na').length} requirements met.
                      {complianceChecklist.some(item => item.status === 'fail') && (
                        <span className="block mt-1 text-red-700 font-medium">
                          Please complete missing business information to ensure full compliance.
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5" style={{ color: 'hsl(var(--trade))' }} />
                <CardTitle>Google Reviews</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Add your Google review link to automatically request reviews from customers after completing jobs.
                Enable this in Autopilot to send review requests via SMS or email.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="google-review-url">Google Review URL</Label>
                <Input
                  id="google-review-url"
                  placeholder="https://g.page/r/your-business/review"
                  value={businessData.googleReviewUrl}
                  onChange={(e) => setBusinessData(prev => ({ ...prev, googleReviewUrl: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Find this in your Google Business Profile under "Ask for reviews" or "Get more reviews"
                </p>
              </div>
              {businessData.googleReviewUrl && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
                  <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                  <span className="text-sm">Review link configured. Enable "Review Request" in Autopilot to auto-send after jobs.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Logo Upload — part of My Business */}
          <Card>
            <CardHeader>
              <CardTitle>Business Logo</CardTitle>
            </CardHeader>
            <CardContent>
              <LogoUpload 
                currentLogoUrl={businessSettings?.logoUrl}
                onColorsDetected={(colors) => {
                  if (colors.length > 0) {
                    const primaryColor = colors[0];
                    setBrandingDirty(true);
                    setBrandingData(prev => ({ 
                      ...prev, 
                      color: primaryColor,
                      customThemeEnabled: true
                    }));
                    setBrandTheme({
                      primaryColor: primaryColor,
                      customThemeEnabled: true
                    });
                    toast({
                      title: "Color Detected",
                      description: "Your app color has been updated to match your logo.",
                    });
                  }
                }}
              />
            </CardContent>
          </Card>

          {/* Document Prefixes — part of My Business */}
          <Card>
            <CardHeader>
              <CardTitle>Document Prefixes & Numbering</CardTitle>
              <p className="text-sm text-muted-foreground">
                Set a prefix for your business — e.g. <span className="font-mono font-semibold">DMP</span> — and Jobs and Projects share one unified counter: <span className="font-mono">DMP#001</span> (Job), <span className="font-mono">DMP#002</span> (Project), <span className="font-mono">DMP#003</span> (Job)…
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice-prefix2">Invoice Prefix</Label>
                  <Input
                    id="invoice-prefix2"
                    value={brandingData.invoicePrefix}
                    onChange={(e) => {
                      setBrandingDirty(true);
                      setBrandingData(prev => ({ ...prev, invoicePrefix: e.target.value }));
                    }}
                    placeholder="INV-"
                    data-testid="input-invoice-prefix"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quote-prefix2">Quote Prefix</Label>
                  <Input
                    id="quote-prefix2"
                    value={brandingData.quotePrefix}
                    onChange={(e) => {
                      setBrandingDirty(true);
                      setBrandingData(prev => ({ ...prev, quotePrefix: e.target.value }));
                    }}
                    placeholder="QT-"
                    data-testid="input-quote-prefix"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-prefix2">Job / Project Prefix</Label>
                  <Input
                    id="job-prefix2"
                    value={brandingData.jobPrefix || ''}
                    onChange={(e) => {
                      setBrandingDirty(true);
                      setBrandingData(prev => ({ ...prev, jobPrefix: e.target.value.toUpperCase() }));
                    }}
                    placeholder="e.g. DMP or ABC"
                    data-testid="input-job-prefix"
                  />
                  <p className="text-xs text-muted-foreground">Shared by Jobs &amp; Projects</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="invoice-next-number2">Next Invoice Number</Label>
                  <Input
                    id="invoice-next-number2"
                    type="number"
                    min="1"
                    value={brandingData.invoiceNextNumber}
                    onChange={(e) => {
                      setBrandingDirty(true);
                      setBrandingData(prev => ({ ...prev, invoiceNextNumber: e.target.value }));
                    }}
                    placeholder="e.g. 100"
                    data-testid="input-invoice-next-number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quote-next-number2">Next Quote Number</Label>
                  <Input
                    id="quote-next-number2"
                    type="number"
                    min="1"
                    value={brandingData.quoteNextNumber}
                    onChange={(e) => {
                      setBrandingDirty(true);
                      setBrandingData(prev => ({ ...prev, quoteNextNumber: e.target.value }));
                    }}
                    placeholder="e.g. 100"
                    data-testid="input-quote-next-number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-next-number2">Next Job / Project Number</Label>
                  <Input
                    id="job-next-number2"
                    type="number"
                    min="1"
                    value={brandingData.jobNextNumber}
                    onChange={(e) => {
                      setBrandingDirty(true);
                      setBrandingData(prev => ({ ...prev, jobNextNumber: e.target.value }));
                    }}
                    placeholder="e.g. 1"
                    data-testid="input-job-next-number"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Set a next number to use simple sequential numbering (e.g. INV-0100). Leave blank to keep automatic year-based numbers. Job / Project numbering only activates when a prefix is set.
              </p>
            </CardContent>
          </Card>

          {/* Documents & Signature — part of My Business */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Documents & Signature
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="quote-terms2">Quote Terms & Conditions</Label>
                <Textarea
                  id="quote-terms2"
                  className="min-h-[120px] font-mono"
                  value={paymentData.quoteTerms}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, quoteTerms: e.target.value }))}
                  placeholder="Enter your quote terms..."
                  data-testid="textarea-quote-terms"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-terms2">Invoice Terms & Conditions</Label>
                <Textarea
                  id="invoice-terms2"
                  className="min-h-[120px] font-mono"
                  value={paymentData.invoiceTerms}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, invoiceTerms: e.target.value }))}
                  placeholder="Enter your invoice terms..."
                  data-testid="textarea-invoice-terms"
                />
              </div>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <PenTool className="h-5 w-5" />
                  <Label className="text-base font-semibold">Digital Signature</Label>
                </div>
                <div className="space-y-2">
                  <Label>Your Signature</Label>
                  {signatureData.defaultSignature ? (
                    <div className="space-y-3">
                      <div className="border-2 border-primary rounded-lg p-4 bg-white dark:bg-gray-900">
                        <img 
                          src={signatureData.defaultSignature} 
                          alt="Your signature" 
                          className="max-h-24 w-auto"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSignatureData(prev => ({ ...prev, defaultSignature: "" }))}
                        data-testid="button-clear-signature"
                      >
                        Clear Signature
                      </Button>
                    </div>
                  ) : (
                    <SignaturePad
                      onSignatureChange={(data) => setSignatureData(prev => ({ ...prev, defaultSignature: data || "" }))}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signature-name2">Name Under Signature</Label>
                  <Input
                    id="signature-name2"
                    value={signatureData.signatureName}
                    onChange={(e) => setSignatureData(prev => ({ ...prev, signatureName: e.target.value }))}
                    placeholder="e.g., John Smith, Director"
                    data-testid="input-signature-name"
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-sm">Automatically Include Signature On:</Label>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <Label htmlFor="signature-quotes2" className="font-medium">Quotes</Label>
                    <Switch
                      id="signature-quotes2"
                      checked={signatureData.includeSignatureOnQuotes}
                      onCheckedChange={(checked) => 
                        setSignatureData(prev => ({ ...prev, includeSignatureOnQuotes: checked }))
                      }
                      data-testid="switch-signature-quotes"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <Label htmlFor="signature-invoices2" className="font-medium">Invoices</Label>
                    <Switch
                      id="signature-invoices2"
                      checked={signatureData.includeSignatureOnInvoices}
                      onCheckedChange={(checked) => 
                        setSignatureData(prev => ({ ...prev, includeSignatureOnInvoices: checked }))
                      }
                      data-testid="switch-signature-invoices"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saveSettingsMutation.isPending}
              data-testid="button-save-mybusiness"
              style={{ backgroundColor: 'hsl(var(--trade))', color: 'white' }}
            >
              {saveSettingsMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
              ) : (
                <><Save className="h-4 w-4 mr-2" />Save Changes</>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* ── Workflow ── safety gates, location tracking, AI, simple mode ── */}
        <TabsContent value="workflow" className="space-y-6">

          {(isOwner || isManager) && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5" style={{ color: 'hsl(var(--trade))' }} />
                  <CardTitle>Project Templates</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">
                  Build a library of standard project types with phases and checklist items. Templates appear in the job-creation flow for quick setup.
                </p>
              </CardHeader>
              <CardContent>
                <ProjectTemplatesSettings />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" style={{ color: 'hsl(var(--trade))' }} />
                <CardTitle>Site Safety (WHS)</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Enforce safety steps before a worker can start a job.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label>Require pre-start (Take 5) before starting a job</Label>
                  <p className="text-sm text-muted-foreground">A safety or inspection form must be completed for the job first</p>
                </div>
                <Switch
                  checked={!!(businessSettings as any)?.requireTake5BeforeStart}
                  onCheckedChange={(checked) => handleBusinessSave({ requireTake5BeforeStart: checked } as any)}
                  data-testid="switch-require-take5"
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label>Block job start on expired licence/compliance</Label>
                  <p className="text-sm text-muted-foreground">Stop a job starting when the worker or business has an expired licence, white card, cert, insurance or rego</p>
                </div>
                <Switch
                  checked={!!(businessSettings as any)?.blockJobStartOnExpiredCompliance}
                  onCheckedChange={(checked) => handleBusinessSave({ blockJobStartOnExpiredCompliance: checked } as any)}
                  data-testid="switch-block-expired-compliance"
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label>Require PO reconciliation before closing a job</Label>
                  <p className="text-sm text-muted-foreground">All purchase orders linked to a job must be Fully Received or Cancelled before the job can be marked done</p>
                </div>
                <Switch
                  checked={!!(businessSettings as any)?.requirePoReconciliation}
                  onCheckedChange={(checked) => handleBusinessSave({ requirePoReconciliation: checked } as any)}
                  data-testid="switch-require-po-reconciliation"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5" style={{ color: 'hsl(var(--trade))' }} />
                <CardTitle>Team Location Tracking Hours</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Save your team's battery by only tracking GPS during work hours. Outside these hours and on non-work days, phones stop tracking — unless a worker is clocked into a job or on their way to one.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label>Limit tracking to work hours</Label>
                  <p className="text-sm text-muted-foreground">When off, phones track whenever a worker has tracking enabled.</p>
                </div>
                <Switch
                  checked={!!(businessSettings as any)?.trackingHoursEnabled}
                  onCheckedChange={(checked) => handleBusinessSave({ trackingHoursEnabled: checked } as any)}
                  data-testid="switch-tracking-hours-enabled"
                />
              </div>

              {!!(businessSettings as any)?.trackingHoursEnabled && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tracking-start" className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-muted-foreground" /> Start time
                      </Label>
                      <Input
                        id="tracking-start"
                        type="time"
                        value={(businessSettings as any)?.workHoursStart || '07:00'}
                        onChange={(e) => handleBusinessSave({ workHoursStart: e.target.value } as any)}
                        data-testid="input-tracking-start"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tracking-end" className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-muted-foreground" /> End time
                      </Label>
                      <Input
                        id="tracking-end"
                        type="time"
                        value={(businessSettings as any)?.workHoursEnd || '17:00'}
                        onChange={(e) => handleBusinessSave({ workHoursEnd: e.target.value } as any)}
                        data-testid="input-tracking-end"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Work days</Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 1, label: 'Mon' },
                        { value: 2, label: 'Tue' },
                        { value: 3, label: 'Wed' },
                        { value: 4, label: 'Thu' },
                        { value: 5, label: 'Fri' },
                        { value: 6, label: 'Sat' },
                        { value: 0, label: 'Sun' },
                      ].map((day) => {
                        const currentDays: number[] = Array.isArray((businessSettings as any)?.workDays)
                          ? (businessSettings as any).workDays
                          : [1, 2, 3, 4, 5];
                        const active = currentDays.includes(day.value);
                        return (
                          <Button
                            key={day.value}
                            type="button"
                            variant={active ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => {
                              const next = active
                                ? currentDays.filter((d) => d !== day.value)
                                : [...currentDays, day.value].sort((a, b) => a - b);
                              handleBusinessSave({ workDays: next } as any);
                            }}
                            data-testid={`button-tracking-day-${day.value}`}
                          >
                            {day.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>


          {/* AI Features Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Control which AI-powered features are enabled in your account. AI features help automate documentation and provide smart suggestions.
              </p>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label>Enable AI Features</Label>
                    <p className="text-sm text-muted-foreground">Master toggle for all AI-powered features</p>
                  </div>
                  <Switch 
                    checked={businessData.aiEnabled !== false}
                    onCheckedChange={(checked) => {
                      setBusinessData(prev => ({ ...prev, aiEnabled: checked }));
                      handleBusinessSave({ aiEnabled: checked });
                    }}
                    data-testid="switch-ai-enabled" 
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label>AI Photo Analysis</Label>
                    <p className="text-sm text-muted-foreground">Automatically analyse job photos and generate notes</p>
                  </div>
                  <Switch 
                    checked={businessData.aiPhotoAnalysisEnabled !== false}
                    onCheckedChange={(checked) => {
                      setBusinessData(prev => ({ ...prev, aiPhotoAnalysisEnabled: checked }));
                      handleBusinessSave({ aiPhotoAnalysisEnabled: checked });
                    }}
                    disabled={businessData.aiEnabled === false}
                    data-testid="switch-ai-photo-analysis" 
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label>Auto-categorize Photos on Upload</Label>
                    <p className="text-sm text-muted-foreground">Automatically sort uploaded photos into categories (before, after, progress, materials)</p>
                  </div>
                  <Switch 
                    checked={businessData.aiAutoCategorizationEnabled !== false}
                    onCheckedChange={(checked) => {
                      setBusinessData(prev => ({ ...prev, aiAutoCategorizationEnabled: checked }));
                      handleBusinessSave({ aiAutoCategorizationEnabled: checked });
                    }}
                    disabled={businessData.aiEnabled === false}
                    data-testid="switch-ai-auto-categorization" 
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label>AI Suggestions</Label>
                    <p className="text-sm text-muted-foreground">Smart suggestions for quotes, invoices, and follow-ups</p>
                  </div>
                  <Switch 
                    checked={businessData.aiSuggestionsEnabled !== false}
                    onCheckedChange={(checked) => {
                      setBusinessData(prev => ({ ...prev, aiSuggestionsEnabled: checked }));
                      handleBusinessSave({ aiSuggestionsEnabled: checked });
                    }}
                    disabled={businessData.aiEnabled === false}
                    data-testid="switch-ai-suggestions" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <DataSafetyBanner />
        </TabsContent>

        {/* Branding tab removed — logo/prefixes/docs are now in My Business tab */}
        {false && <TabsContent value="branding-removed" className="space-y-6 animate-fade-in-up">
          {/* Logo Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Business Logo</CardTitle>
            </CardHeader>
            <CardContent>
              <LogoUpload 
                currentLogoUrl={businessSettings?.logoUrl}
                onColorsDetected={(colors) => {
                  if (colors.length > 0) {
                    const primaryColor = colors[0];
                    setBrandingDirty(true);
                    setBrandingData(prev => ({ 
                      ...prev, 
                      color: primaryColor,
                      customThemeEnabled: true
                    }));
                    setBrandTheme({
                      primaryColor: primaryColor,
                      customThemeEnabled: true
                    });
                    toast({
                      title: "Color Detected",
                      description: "Your app color has been updated to match your logo.",
                    });
                  }
                }}
              />
            </CardContent>
          </Card>

          {/* Document Prefixes */}
          <Card>
            <CardHeader>
              <CardTitle>Document Prefixes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice-prefix">Invoice Prefix</Label>
                  <Input
                    id="invoice-prefix"
                    value={brandingData.invoicePrefix}
                    onChange={(e) => {
                      setBrandingDirty(true);
                      setBrandingData(prev => ({ ...prev, invoicePrefix: e.target.value }));
                    }}
                    placeholder="INV-"
                    data-testid="input-invoice-prefix"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="quote-prefix">Quote Prefix</Label>
                  <Input
                    id="quote-prefix"
                    value={brandingData.quotePrefix}
                    onChange={(e) => {
                      setBrandingDirty(true);
                      setBrandingData(prev => ({ ...prev, quotePrefix: e.target.value }));
                    }}
                    placeholder="QT-"
                    data-testid="input-quote-prefix"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="job-prefix">Job Prefix</Label>
                  <Input
                    id="job-prefix"
                    value={brandingData.jobPrefix || ''}
                    onChange={(e) => {
                      setBrandingDirty(true);
                      setBrandingData(prev => ({ ...prev, jobPrefix: e.target.value }));
                    }}
                    placeholder="JOB-"
                    data-testid="input-job-prefix"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="invoice-next-number">Next Invoice Number</Label>
                  <Input
                    id="invoice-next-number"
                    type="number"
                    min="1"
                    value={brandingData.invoiceNextNumber}
                    onChange={(e) => {
                      setBrandingDirty(true);
                      setBrandingData(prev => ({ ...prev, invoiceNextNumber: e.target.value }));
                    }}
                    placeholder="e.g. 100"
                    data-testid="input-invoice-next-number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quote-next-number">Next Quote Number</Label>
                  <Input
                    id="quote-next-number"
                    type="number"
                    min="1"
                    value={brandingData.quoteNextNumber}
                    onChange={(e) => {
                      setBrandingDirty(true);
                      setBrandingData(prev => ({ ...prev, quoteNextNumber: e.target.value }));
                    }}
                    placeholder="e.g. 100"
                    data-testid="input-quote-next-number"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Set a next number to use simple sequential numbering (e.g. INV-0100, INV-0101). Leave blank to keep automatic year-based numbers. The counter increases automatically as you create documents.
              </p>
            </CardContent>
          </Card>

          {/* Documents & Signature */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Documents & Signature
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="quote-terms">Quote Terms & Conditions</Label>
                <Textarea
                  id="quote-terms"
                  className="min-h-[120px] font-mono"
                  value={paymentData.quoteTerms}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, quoteTerms: e.target.value }))}
                  placeholder="Enter your quote terms..."
                  data-testid="textarea-quote-terms"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice-terms">Invoice Terms & Conditions</Label>
                <Textarea
                  id="invoice-terms"
                  className="min-h-[120px] font-mono"
                  value={paymentData.invoiceTerms}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, invoiceTerms: e.target.value }))}
                  placeholder="Enter your invoice terms..."
                  data-testid="textarea-invoice-terms"
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <PenTool className="h-5 w-5" />
                  <Label className="text-base font-semibold">Digital Signature</Label>
                </div>

                <div className="space-y-2">
                  <Label>Your Signature</Label>
                  {signatureData.defaultSignature ? (
                    <div className="space-y-3">
                      <div className="border-2 border-primary rounded-lg p-4 bg-white dark:bg-gray-900">
                        <img 
                          src={signatureData.defaultSignature} 
                          alt="Your signature" 
                          className="max-h-24 w-auto"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSignatureData(prev => ({ ...prev, defaultSignature: "" }))}
                        data-testid="button-clear-signature"
                      >
                        Clear Signature
                      </Button>
                    </div>
                  ) : (
                    <SignaturePad
                      onSignatureChange={(data) => setSignatureData(prev => ({ ...prev, defaultSignature: data || "" }))}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signature-name">Name Under Signature</Label>
                  <Input
                    id="signature-name"
                    value={signatureData.signatureName}
                    onChange={(e) => setSignatureData(prev => ({ ...prev, signatureName: e.target.value }))}
                    placeholder="e.g., John Smith, Director"
                    data-testid="input-signature-name"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm">Automatically Include Signature On:</Label>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="space-y-0.5">
                      <Label htmlFor="signature-quotes" className="font-medium">Quotes</Label>
                    </div>
                    <Switch
                      id="signature-quotes"
                      checked={signatureData.includeSignatureOnQuotes}
                      onCheckedChange={(checked) => 
                        setSignatureData(prev => ({ ...prev, includeSignatureOnQuotes: checked }))
                      }
                      data-testid="switch-signature-quotes"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="space-y-0.5">
                      <Label htmlFor="signature-invoices" className="font-medium">Invoices</Label>
                    </div>
                    <Switch
                      id="signature-invoices"
                      checked={signatureData.includeSignatureOnInvoices}
                      onCheckedChange={(checked) => 
                        setSignatureData(prev => ({ ...prev, includeSignatureOnInvoices: checked }))
                      }
                      data-testid="switch-signature-invoices"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        </TabsContent>}

        {/* ── Money ── payment methods, rates, markup, invoice terms ── */}
        <TabsContent value="money" className="space-y-6">
          {/* Card 1: Rates & Defaults */}
          <Card>
            <CardHeader>
              <CardTitle>Rates & Defaults</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hourly-rate">Default Hourly Rate ($)</Label>
                  <Input
                    id="hourly-rate"
                    type="number"
                    value={paymentData.defaultHourlyRate}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, defaultHourlyRate: Number(e.target.value) }))}
                    data-testid="input-hourly-rate"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="callout-fee">Callout Fee ($)</Label>
                  <Input
                    id="callout-fee"
                    type="number"
                    value={paymentData.calloutFee}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, calloutFee: Number(e.target.value) }))}
                    data-testid="input-callout-fee"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quote-validity">Quote Validity (Days)</Label>
                  <Input
                    id="quote-validity"
                    type="number"
                    value={paymentData.quoteValidityDays}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, quoteValidityDays: Number(e.target.value) }))}
                    data-testid="input-quote-validity"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="travel-rate-per-km">Travel Allowance ($/km)</Label>
                  <Input
                    id="travel-rate-per-km"
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentData.travelRatePerKm}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, travelRatePerKm: Number(e.target.value) }))}
                    placeholder="0.85"
                    data-testid="input-travel-rate-per-km"
                  />
                  <p className="text-xs text-muted-foreground">Rate per km for Driving / Travel entries. Shown on payroll export.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment-terms-days">Payment Due (Days)</Label>
                  <Input
                    id="payment-terms-days"
                    type="number"
                    value={paymentData.defaultPaymentTermsDays}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, defaultPaymentTermsDays: Number(e.target.value) }))}
                    data-testid="input-payment-terms-days"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="late-fee-rate">Late Fee Rate</Label>
                  <Input
                    id="late-fee-rate"
                    value={paymentData.lateFeeRate}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, lateFeeRate: e.target.value }))}
                    placeholder="1.5% per month"
                    data-testid="input-late-fee-rate"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warranty-period">Warranty Period</Label>
                  <Input
                    id="warranty-period"
                    value={paymentData.warrantyPeriod}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, warrantyPeriod: e.target.value }))}
                    placeholder="12 months"
                    data-testid="input-warranty-period"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSave}
                  disabled={saveSettingsMutation.isPending}
                  data-testid="button-save-rates"
                >
                  {saveSettingsMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Rates
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Markup Defaults */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Default Markup Percentages
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Applied automatically when materials, equipment, or subcontractor costs are added to a job.
                The marked-up price rolls into invoices so you never undercharge. You can override per-job or per-line item.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="material-markup">Materials markup (%)</Label>
                  <p className="text-xs text-muted-foreground">Parts, consumables, pipe, fittings, etc.</p>
                  <Input
                    id="material-markup"
                    type="number"
                    min={0}
                    max={500}
                    step={1}
                    value={paymentData.defaultMaterialMarkupPct}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, defaultMaterialMarkupPct: Number(e.target.value) }))}
                    data-testid="input-material-markup"
                  />
                  <p className="text-xs text-muted-foreground">
                    e.g. $100 cost → charged at ${(100 * (1 + paymentData.defaultMaterialMarkupPct / 100)).toFixed(0)}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="equipment-markup">Plant / Equipment markup (%)</Label>
                  <p className="text-xs text-muted-foreground">Hired equipment, plant, machinery rentals.</p>
                  <Input
                    id="equipment-markup"
                    type="number"
                    min={0}
                    max={500}
                    step={1}
                    value={paymentData.defaultEquipmentMarkupPct}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, defaultEquipmentMarkupPct: Number(e.target.value) }))}
                    data-testid="input-equipment-markup"
                  />
                  <p className="text-xs text-muted-foreground">
                    e.g. $100 cost → charged at ${(100 * (1 + paymentData.defaultEquipmentMarkupPct / 100)).toFixed(0)}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subcontractor-markup">Subcontractor markup (%)</Label>
                  <p className="text-xs text-muted-foreground">Third-party trades, hired subcontractors.</p>
                  <Input
                    id="subcontractor-markup"
                    type="number"
                    min={0}
                    max={500}
                    step={1}
                    value={paymentData.defaultSubcontractorMarkupPct}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, defaultSubcontractorMarkupPct: Number(e.target.value) }))}
                    data-testid="input-subcontractor-markup"
                  />
                  <p className="text-xs text-muted-foreground">
                    e.g. $100 cost → charged at ${(100 * (1 + paymentData.defaultSubcontractorMarkupPct / 100)).toFixed(0)}
                  </p>
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <strong>How it works:</strong> When you add a material with a cost but no sell price, the marked-up price is calculated automatically
                and stored. Invoice generation uses the sell price, so you always charge the right amount — no manual calculation needed.
                You can set a different markup on any individual line item to override this default.
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={saveSettingsMutation.isPending}
                  data-testid="button-save-markup"
                >
                  {saveSettingsMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Markup Defaults
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Bank & Payment Methods */}
          <PaymentMethodsSettings />

          <Card>
            <CardHeader>
              <CardTitle>GPS Location Proof</CardTitle>
              <p className="text-sm text-muted-foreground">
                When workers clock in and out with GPS enabled, their location is recorded as proof of attendance
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-0.5">
                  <Label htmlFor="location-proof-invoices" className="font-medium">Show on Invoices</Label>
                  <p className="text-xs text-muted-foreground">Include a "Worker Presence Verified" table on invoice PDFs showing GPS-stamped arrival and departure times</p>
                </div>
                <Switch
                  id="location-proof-invoices"
                  checked={signatureData.includeLocationProofOnInvoices}
                  onCheckedChange={(checked) => 
                    setSignatureData(prev => ({ ...prev, includeLocationProofOnInvoices: checked }))
                  }
                  data-testid="switch-location-proof-invoices"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Break Time</CardTitle>
              <p className="text-sm text-muted-foreground">
                Choose whether tracked break time is charged to clients on invoices
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-0.5">
                  <Label htmlFor="bill-breaks" className="font-medium">Bill for breaks</Label>
                  <p className="text-xs text-muted-foreground">When on, break time is included as billable labour on invoices. This does not change what workers are paid. Default is off.</p>
                </div>
                <Switch
                  id="bill-breaks"
                  checked={signatureData.billBreaks}
                  onCheckedChange={(checked) =>
                    setSignatureData(prev => ({ ...prev, billBreaks: checked }))
                  }
                  data-testid="switch-bill-breaks"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Team & Comms ── notifications, quick replies, AI, email settings ── */}
        <TabsContent value="teamcomms" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Notifications You Receive
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Control which email notifications JobRunner sends to you
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label>Quote Responses</Label>
                    <p className="text-sm text-muted-foreground">Get notified when clients accept or reject quotes</p>
                  </div>
                  <Switch 
                    checked={notificationPreferences.quoteResponses}
                    onCheckedChange={(checked) => handleNotificationChange('quoteResponses', checked)}
                    disabled={saveNotificationPreferencesMutation.isPending}
                    data-testid="switch-quote-notifications" 
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label>Payment Confirmations</Label>
                    <p className="text-sm text-muted-foreground">Get notified when payments are received</p>
                  </div>
                  <Switch 
                    checked={notificationPreferences.paymentConfirmations}
                    onCheckedChange={(checked) => handleNotificationChange('paymentConfirmations', checked)}
                    disabled={saveNotificationPreferencesMutation.isPending}
                    data-testid="switch-payment-notifications" 
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label>Overdue Invoices</Label>
                    <p className="text-sm text-muted-foreground">Get reminded about overdue invoices</p>
                  </div>
                  <Switch 
                    checked={notificationPreferences.overdueInvoices}
                    onCheckedChange={(checked) => handleNotificationChange('overdueInvoices', checked)}
                    disabled={saveNotificationPreferencesMutation.isPending}
                    data-testid="switch-overdue-notifications" 
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label>Weekly Summary</Label>
                    <p className="text-sm text-muted-foreground">Receive a weekly business summary email</p>
                  </div>
                  <Switch 
                    checked={notificationPreferences.weeklySummary}
                    onCheckedChange={(checked) => handleNotificationChange('weeklySummary', checked)}
                    disabled={saveNotificationPreferencesMutation.isPending}
                    data-testid="switch-weekly-summary" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Replies — merged from Communications tab */}
          <QuickRepliesSettings />
        </TabsContent>

        <BillingTabContent />

        {/* Support Tab */}
        <SupportTab />

        {/* Data Export Tab */}
        {canAccessBusinessSettings && (
          <DataExportTab />
        )}

        {/* Developer Tab - only in development mode */}
        {import.meta.env.DEV && (
          <TabsContent value="developer" className="space-y-6">
            <DeveloperTab />
          </TabsContent>
        )}
      </Tabs>
    </PageShell>
  );
}

// Billing Tab Content Component
function BillingTabContent() {
  const { toast } = useToast();
  const { data: businessSettings } = useBusinessSettings();

  // Currency formatter
  const formatPrice = (cents: number) => {
    const dollars = cents / 100;
    return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
  };

  // Flat pricing in dollars (matches Apple IAP)
  const proMonthly = formatPrice(PRICING.pro.monthly); // $49.99
  const teamMonthly = formatPrice(PRICING.team.monthly); // $99.99
  const businessMonthly = formatPrice(PRICING.business.monthly); // $199.99

  // Fetch billing status
  const { data: billingStatus, isLoading: billingLoading } = useQuery<{
    tier: 'free' | 'pro' | 'team' | 'business' | 'trial';
    status: 'active' | 'past_due' | 'canceled' | 'none' | 'trialing';
    isTrial?: boolean;
    trialEndsAt?: string;
    currentPeriodEnd?: string;
    daysRemaining?: number;
    cancelAtPeriodEnd?: boolean;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    seatCount?: number;
  }>({
    queryKey: ['/api/billing/status'],
  });

  // Fetch usage info
  const { data: usageInfo } = useQuery<{
    jobs: { used: number; limit: number; remaining: number };
    invoices: { used: number; limit: number; remaining: number };
    quotes: { used: number; limit: number; remaining: number };
    clients: { used: number; limit: number; remaining: number };
    templates: { used: number; limit: number; remaining: number };
    isUnlimited: boolean;
  }>({
    queryKey: ['/api/subscription/usage'],
  });

  // Create Pro checkout session mutation
  const createProCheckoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/checkout");
      return res.json();
    },
    onSuccess: (data: { url?: string; sessionId?: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Upgrade Failed",
        description: error.message || "Could not start checkout. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Create Team checkout session mutation (flat $99.99/mo)
  const createTeamCheckoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/checkout/team");
      return res.json();
    },
    onSuccess: (data: { url?: string; sessionId?: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Upgrade Failed",
        description: error.message || "Could not start checkout. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Create Business checkout session mutation (flat $199.99/mo)
  const createBusinessCheckoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/checkout/business");
      return res.json();
    },
    onSuccess: (data: { url?: string; sessionId?: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Upgrade Failed",
        description: error.message || "Could not start checkout. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Cancel subscription mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/cancel");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/billing/status'] });
      toast({
        title: "Subscription Canceled",
        description: "Your subscription will end at the current billing period.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Cancel Failed",
        description: error.message || "Could not cancel subscription.",
        variant: "destructive",
      });
    }
  });

  // Resume subscription mutation
  const resumeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/resume");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/billing/status'] });
      toast({
        title: "Subscription Resumed",
        description: "Your subscription has been reactivated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Resume Failed",
        description: error.message || "Could not resume subscription.",
        variant: "destructive",
      });
    }
  });

  // Open billing portal mutation
  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/portal");
      return res.json();
    },
    onSuccess: (data: { url?: string }) => {
      if (data.url) {
        window.open(data.url, '_blank');
      }
    },
    onError: (error: any) => {
      toast({
        title: "Portal Error",
        description: error.message || "Could not open billing portal.",
        variant: "destructive",
      });
    }
  });

  // Upgrade Pro to Team with trial mutation (flat $99.99/mo)
  const upgradeToTeamMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/upgrade-to-team");
      return res.json();
    },
    onSuccess: (data: { success?: boolean; message?: string; trialEndsAt?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/billing/status'] });
      toast({
        title: "Upgraded to Team!",
        description: data.message || "Team features are now unlocked. Your trial has started.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upgrade Failed",
        description: error.message || "Could not upgrade to Team plan.",
        variant: "destructive",
      });
    }
  });

  // Upgrade to Business with trial mutation (flat $199.99/mo)
  const upgradeToBusinessMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/upgrade-to-business");
      return res.json();
    },
    onSuccess: (data: { success?: boolean; message?: string; trialEndsAt?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/billing/status'] });
      toast({
        title: "Upgraded to Business!",
        description: data.message || "Business features are now unlocked.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upgrade Failed",
        description: error.message || "Could not upgrade to Business plan.",
        variant: "destructive",
      });
    }
  });

  // Downgrade Team to Pro mutation
  const downgradeToProMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/downgrade-to-pro");
      return res.json();
    },
    onSuccess: (data: { success?: boolean; message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/billing/status'] });
      toast({
        title: "Downgraded to Pro",
        description: data.message || "Your subscription has been changed to Pro.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Downgrade Failed",
        description: error.message || "Could not downgrade subscription.",
        variant: "destructive",
      });
    }
  });

  const isPro = billingStatus?.tier === 'pro';
  const isTeam = billingStatus?.tier === 'team';
  const isBusiness = billingStatus?.tier === 'business';
  const hasPaidPlan = isPro || isTeam || isBusiness;
  const isTrialing = billingStatus?.isTrial === true || billingStatus?.status === 'trialing';
  const isCanceled = billingStatus?.cancelAtPeriodEnd === true;
  const periodEnd = billingStatus?.currentPeriodEnd ? new Date(billingStatus.currentPeriodEnd) : null;

  // Prefer the trial end from the live billing status, falling back to business settings.
  const trialEndDate = billingStatus?.trialEndsAt
    ? new Date(billingStatus.trialEndsAt)
    : (businessSettings?.trialEndDate ? new Date(businessSettings.trialEndDate as string) : null);
  // Use trial end date when trialing, otherwise use period end
  const effectiveEndDate = isTrialing && trialEndDate ? trialEndDate : periodEnd;
  const daysRemaining = billingStatus?.daysRemaining ?? (effectiveEndDate
    ? Math.max(0, Math.ceil((effectiveEndDate.getTime() - Date.now()) / 86_400_000))
    : null);
  const fmtDate = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <TabsContent value="billing" className="space-y-6">
      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
            Your Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {billingLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Plan Status */}
              <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'hsl(var(--trade)/0.1)' }}>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--trade))' }}>
                    <Crown className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">
                      {isBusiness ? 'Business Plan' : isTeam ? 'Team Plan' : isPro ? 'Pro Plan' : 'Free Plan'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {hasPaidPlan
                        ? isTrialing
                          ? (daysRemaining !== null
                              ? `Free trial — ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`
                              : 'Free trial active — all paid features unlocked')
                          : isCanceled
                            ? (effectiveEndDate ? `Cancels on ${fmtDate(effectiveEndDate)}` : 'Cancels at period end')
                            : isBusiness
                              ? `$${businessMonthly}/month (up to 15 team members)`
                              : isTeam
                                ? `$${teamMonthly}/month (up to 5 team members)`
                                : `$${proMonthly}/month`
                        : 'Limited features'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {hasPaidPlan ? (
                    <Badge 
                      variant="default" 
                      style={{ backgroundColor: isTrialing ? 'hsl(var(--success))' : isCanceled ? 'hsl(var(--muted-foreground))' : 'hsl(var(--success))' }}
                    >
                      {isTrialing ? 'Trial' : isCanceled ? 'Canceling' : 'Active'}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Free</Badge>
                  )}
                  {effectiveEndDate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {isCanceled ? 'Ends' : isTrialing ? 'Billing starts' : 'Renews'}: {fmtDate(effectiveEndDate)}
                    </p>
                  )}
                </div>
              </div>

              {/* Free tier - upgrade prompt */}
              {!hasPaidPlan && (
                <div className="p-4 rounded-lg bg-muted/40 border">
                  <div className="flex items-center gap-2 mb-3">
                    <Crown className="h-4 w-4 text-amber-500" />
                    <span className="font-medium">Upgrade to unlock more</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    You're on the free plan. Upgrade for unlimited jobs, invoices, clients and team features.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => createProCheckoutMutation.mutate()}
                      disabled={createProCheckoutMutation.isPending}
                      data-testid="button-upgrade-free-to-pro"
                    >
                      {createProCheckoutMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Crown className="h-4 w-4 mr-2" />
                      )}
                      Upgrade to Pro (${proMonthly}/mo)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => createTeamCheckoutMutation.mutate()}
                      disabled={createTeamCheckoutMutation.isPending}
                      data-testid="button-upgrade-free-to-team"
                    >
                      {createTeamCheckoutMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Users className="h-4 w-4 mr-2" />
                      )}
                      Team (${teamMonthly}/mo)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => createBusinessCheckoutMutation.mutate()}
                      disabled={createBusinessCheckoutMutation.isPending}
                      data-testid="button-upgrade-free-to-business"
                    >
                      {createBusinessCheckoutMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Crown className="h-4 w-4 mr-2" />
                      )}
                      Business (${businessMonthly}/mo)
                    </Button>
                  </div>
                </div>
              )}

              {/* Features List - Show when already subscribed */}
              {hasPaidPlan && (
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Your Plan Includes</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { icon: Zap, text: 'Unlimited jobs, quotes & invoices' },
                      { icon: TrendingUp, text: 'AI-powered suggestions' },
                      { icon: Palette, text: 'Custom branding & theming' },
                      { icon: Mail, text: 'Automated email & SMS reminders' },
                      ...(isTeam ? [
                        { icon: Users, text: 'Team management & permissions' },
                        { icon: MapPin, text: 'Live GPS tracking' },
                      ] : []),
                      { icon: Shield, text: 'Priority support' },
                    ].map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <feature.icon className="h-4 w-4 text-green-600" />
                        <span>{feature.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trial Banner */}
              {isTrialing && (
                <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-700">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-700 dark:text-green-300">Trial active — all Pro features unlocked</span>
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    Add a payment method before your trial ends to keep using the paid features.
                  </p>
                </div>
              )}

              {/* Upgrade/Downgrade Options for Existing Subscribers */}
              {hasPaidPlan && !isCanceled && (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Change Plan</h4>
                  <div className="flex flex-wrap gap-3">
                    {isPro && (
                      <Button
                        variant="outline"
                        onClick={() => upgradeToTeamMutation.mutate()}
                        disabled={upgradeToTeamMutation.isPending}
                        data-testid="button-upgrade-to-team"
                      >
                        {upgradeToTeamMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Users className="h-4 w-4 mr-2" />
                        )}
                        Upgrade to Team (${teamMonthly}/mo)
                      </Button>
                    )}
                    {(isPro || isTeam) && (
                      <Button
                        variant="outline"
                        onClick={() => upgradeToBusinessMutation.mutate()}
                        disabled={upgradeToBusinessMutation.isPending}
                        data-testid="button-upgrade-to-business"
                      >
                        {upgradeToBusinessMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Crown className="h-4 w-4 mr-2" />
                        )}
                        Upgrade to Business (${businessMonthly}/mo)
                      </Button>
                    )}
                    {isTeam && (
                      <Button
                        variant="outline"
                        onClick={() => downgradeToProMutation.mutate()}
                        disabled={downgradeToProMutation.isPending}
                        data-testid="button-downgrade-to-pro"
                      >
                        {downgradeToProMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <ArrowLeft className="h-4 w-4 mr-2" />
                        )}
                        Downgrade to Pro (${proMonthly}/mo)
                      </Button>
                    )}
                  </div>
                  {(isTeam || isBusiness) && (
                    <p className="text-xs text-muted-foreground">
                      Downgrading will remove team member access. They can still use the free tier.
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <Separator />
              <div className="flex flex-wrap gap-3">
                {!hasPaidPlan ? null : isCanceled ? (
                  <Button
                    onClick={() => resumeMutation.mutate()}
                    disabled={resumeMutation.isPending}
                    style={{ backgroundColor: 'hsl(var(--trade))', borderColor: 'hsl(var(--trade-border))' }}
                    data-testid="button-resume"
                  >
                    {resumeMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    Resume Subscription
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                    data-testid="button-cancel"
                  >
                    {cancelMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Cancel Subscription
                  </Button>
                )}
                
                {billingStatus?.stripeCustomerId && (
                  <Button
                    variant="outline"
                    onClick={() => portalMutation.mutate()}
                    disabled={portalMutation.isPending}
                    data-testid="button-manage-billing"
                  >
                    {portalMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Manage Billing
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            This Month's Usage
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {usageInfo?.isUnlimited 
              ? 'Unlimited usage with Pro plan' 
              : 'Usage resets at the start of each month'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {usageInfo && (
              <>
                <UsageBar label="Jobs" used={usageInfo.jobs.used} limit={usageInfo.jobs.limit} />
                <UsageBar label="Quotes" used={usageInfo.quotes.used} limit={usageInfo.quotes.limit} />
                <UsageBar label="Invoices" used={usageInfo.invoices.used} limit={usageInfo.invoices.limit} />
                <UsageBar label="Clients" used={usageInfo.clients.used} limit={usageInfo.clients.limit} />
                <UsageBar label="Templates" used={usageInfo.templates.used} limit={usageInfo.templates.limit} />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dedicated Number Add-On */}
      <DedicatedNumberAddon />

      {/* AI Receptionist Settings Link */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
            <CardTitle className="text-base">AI Receptionist</CardTitle>
          </div>
          <Button variant="outline" asChild data-testid="link-ai-receptionist-settings">
            <Link href="/ai-receptionist">
              <Settings2 className="h-4 w-4 mr-1.5" />
              Configure
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            Set up your AI-powered virtual receptionist to handle calls, create leads, and transfer to your team.
          </p>
        </CardContent>
      </Card>

      {/* Custom Website Add-on */}
      <Card 
        className="hover-elevate cursor-pointer" 
        onClick={() => { window.location.href = '/website'; }}
        data-testid="card-website-addon-link"
      >
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
            <CardTitle className="text-base">Custom Website</CardTitle>
          </div>
          <Button variant="outline" onClick={(e) => { e.stopPropagation(); window.location.href = '/website'; }}>
            <ExternalLink className="h-4 w-4 mr-1.5" />
            Manage
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            Get a professional website for your trade business. Preview your site, check domain status, and request changes.
          </p>
        </CardContent>
      </Card>
    </TabsContent>
  );
}

function DedicatedNumberAddon() {
  const { toast } = useToast();
  const { data: smsConfig } = useQuery<{
    smsMode: string;
    dedicatedPhoneNumber: string | null;
    hasDedicatedNumber: boolean;
    twilioConfigured: boolean;
    twilioConnected: boolean;
    canTwoWayText: boolean;
  }>({ queryKey: ['/api/sms/config'] });

  const hasNumber = smsConfig?.hasDedicatedNumber;

  const releaseNumberMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/sms/release-number');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Number released', description: 'You are now using the shared JobRunner number for notifications.' });
      queryClient.invalidateQueries({ queryKey: ['/api/sms/config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to release number', description: err.message || 'Please try again or contact support.', variant: 'destructive' });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
          Dedicated Business Number
          {hasNumber && (
            <Badge variant="default" className="ml-auto" style={{ backgroundColor: 'hsl(var(--success))' }}>Active</Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {hasNumber 
            ? 'Your dedicated number for two-way client texting and AI Receptionist.'
            : 'Add a dedicated Australian phone number for two-way SMS and AI Receptionist.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasNumber ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'hsl(var(--success)/0.1)' }}>
              <div>
                <p className="text-sm font-medium">Your Number</p>
                <p className="text-sm font-mono">{smsConfig?.dedicatedPhoneNumber}</p>
              </div>
              <Badge variant="secondary" className="text-xs">
                {smsConfig?.smsMode === 'ai_receptionist' ? 'AI Receptionist' : 'Two-Way SMS'}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4 text-green-600" />
                <span>Two-Way Texting</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Bot className="h-4 w-4 text-blue-600" />
                <span>AI Receptionist</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Link2 className="h-4 w-4 text-purple-600" />
                <span>Auto-Link to Jobs</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" asChild>
                <a href="/chat">
                  <MessageSquare className="h-4 w-4 mr-1.5" />
                  Open Chat Hub
                </a>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive">
                    <Phone className="h-4 w-4 mr-1.5" />
                    Revert to Shared
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Revert to shared number?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <span className="block">This will release your dedicated number ({smsConfig?.dedicatedPhoneNumber}) and revert to the shared JobRunner number.</span>
                      <span className="block">Your existing conversation history will be preserved, but clients will no longer be able to text you directly on this number.</span>
                      {smsConfig?.smsMode === 'ai_receptionist' && (
                        <span className="block font-medium">Your AI Receptionist will also be disabled.</span>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Number</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => releaseNumberMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={releaseNumberMutation.isPending}
                    >
                      {releaseNumberMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Releasing...</>
                      ) : (
                        'Yes, Revert to Shared'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <p className="text-xs text-muted-foreground">
              $10/month for your dedicated number. SMS billed at ~$0.06/message.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4 text-green-600" />
                <span>Two-way client texting</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Bot className="h-4 w-4 text-blue-600" />
                <span>AI Receptionist (auto-detect job requests)</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Link2 className="h-4 w-4 text-purple-600" />
                <span>Messages auto-linked to jobs</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-amber-600" />
                <span>Your own Australian number</span>
              </div>
            </div>
            <Separator />
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">$5 AUD/month + ~$0.06 per SMS</p>
                <p className="text-xs text-muted-foreground">Cancel anytime. Replaces the shared JobRunner number with your own.</p>
              </div>
              <Button variant="outline" asChild>
                <a href="/chat?setup=number">
                  <Phone className="h-4 w-4 mr-1.5" />
                  Set Up in Chat Hub
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              One-way notifications (job updates, reminders) are already included and sent from "JobRunner" sender ID.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Support Tab Component
function SupportTab() {
  return (
    <TabsContent value="support" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="h-5 w-5" />
            Need Help?
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Get in touch with our team for any questions or issues with JobRunner
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Phone Support */}
            <div className="p-4 rounded-lg border-2 hover-elevate">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold">Call or Text</h3>
                  <p className="text-sm text-muted-foreground">
                    Quick questions? Give us a call or send a text.
                  </p>
                  <a 
                    href="tel:0458300051" 
                    className="text-lg font-medium text-primary hover:underline block mt-2"
                    data-testid="link-support-phone"
                  >
                    0458 300 051
                  </a>
                  <p className="text-xs text-muted-foreground">
                    Available Mon-Fri 8am-6pm AEST
                  </p>
                </div>
              </div>
            </div>

            {/* Email Support */}
            <div className="p-4 rounded-lg border-2 hover-elevate">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold">Email Us</h3>
                  <p className="text-sm text-muted-foreground">
                    For detailed questions or feature requests.
                  </p>
                  <a 
                    href="mailto:admin@avwebinnovation.com" 
                    className="text-lg font-medium text-primary hover:underline block mt-2"
                    data-testid="link-support-email"
                  >
                    admin@avwebinnovation.com
                  </a>
                  <p className="text-xs text-muted-foreground">
                    We usually reply within 24 hours
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Comprehensive FAQ System */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Frequently Asked Questions
            </h3>
            
            <Accordion type="multiple" className="w-full" data-testid="support-faq-accordion">
              {/* Getting Started */}
              <AccordionItem value="getting-started">
                <AccordionTrigger className="text-sm font-medium" data-testid="faq-section-getting-started">
                  <span className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-primary" />
                    Getting Started
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-first-job">
                    <p className="font-medium text-sm">How do I create my first job?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Head to the Jobs page and tap the "+" button. Add a client (or create a new one), 
                      enter the job description and address, then save. You can schedule it for a specific 
                      date or leave it as pending.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-first-client">
                    <p className="font-medium text-sm">How do I add a client?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Go to the Clients page and tap "+". Enter their name, phone, email, and address. 
                      You can also add clients on the fly when creating a job using "Quick Add Client".
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-business-setup">
                    <p className="font-medium text-sm">How do I set up my business details?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Go to Settings → Business to add your company name, ABN, contact details, and logo. 
                      These will appear on all your quotes and invoices.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Jobs & Scheduling */}
              <AccordionItem value="jobs">
                <AccordionTrigger className="text-sm font-medium" data-testid="faq-section-jobs">
                  <span className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    Jobs & Scheduling
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-job-status">
                    <p className="font-medium text-sm">What do the job statuses mean?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      <strong>Pending:</strong> New job, not yet scheduled. <strong>Scheduled:</strong> Has a date set. 
                      <strong>In Progress:</strong> Work has started. <strong>Done:</strong> Work complete, ready to invoice. 
                      <strong>Invoiced:</strong> Invoice has been sent to the customer.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-job-photos">
                    <p className="font-medium text-sm">Can I add photos to a job?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Yes! Open any job and scroll to the Photos section. You can upload before, during, 
                      and after shots. Great for documentation and showing clients your work.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-schedule-job">
                    <p className="font-medium text-sm">How do I schedule a job for a specific day?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Edit the job and set the "Scheduled Date". The job will then appear in your 
                      Today's Schedule on the Dashboard when that day comes.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-complete-job">
                    <p className="font-medium text-sm">How do I mark a job as complete?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Open the job and change the status to "Done". You'll then see an option to 
                      create an invoice for the completed work.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Quotes */}
              <AccordionItem value="quotes">
                <AccordionTrigger className="text-sm font-medium" data-testid="faq-section-quotes">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Quotes
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-create-quote">
                    <p className="font-medium text-sm">How do I create a quote?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Go to Quotes and tap "+", or open a job and tap "Create Quote". Add line items 
                      with descriptions, quantities, and prices. GST is calculated automatically.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-send-quote">
                    <p className="font-medium text-sm">How do I send a quote to a customer?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Open the quote and tap "Email Quote". A professional PDF will be generated 
                      and sent to your customer. Make sure your email is connected on the Integrations page.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-quote-to-invoice">
                    <p className="font-medium text-sm">Can I convert a quote to an invoice?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Yes! Once a quote is accepted, open it and tap "Convert to Invoice". 
                      All the line items will be copied across automatically.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-quote-deposit">
                    <p className="font-medium text-sm">How do I request a deposit with a quote?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      When creating or editing a quote, enable the deposit option and set a percentage 
                      or fixed amount. Customers can pay the deposit online if you have Stripe connected.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Invoices & Payments */}
              <AccordionItem value="invoices">
                <AccordionTrigger className="text-sm font-medium" data-testid="faq-section-invoices">
                  <span className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-primary" />
                    Invoices & Payments
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-create-invoice">
                    <p className="font-medium text-sm">How do I create an invoice?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Go to Invoices and tap "+", or from a completed job, tap "Create Invoice". 
                      Add your line items, set payment terms, and save.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-send-invoice">
                    <p className="font-medium text-sm">How do I send an invoice?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Open the invoice and tap "Email Invoice". The customer will receive a PDF 
                      with a payment link if you have Stripe connected.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-stripe-setup">
                    <p className="font-medium text-sm">How do I accept card payments?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Go to the Integrations page and connect Stripe. Once verified, customers 
                      can pay invoices online via credit card. Funds go directly to your bank account.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-mark-paid">
                    <p className="font-medium text-sm">How do I mark an invoice as paid?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Open the invoice and tap "Record Payment". You can record cash, bank transfer, 
                      or other payment methods. The invoice status will update to "Paid".
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-overdue-invoices">
                    <p className="font-medium text-sm">How do I chase overdue invoices?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      JobRunner shows overdue invoices on your Dashboard. You can send reminder 
                      emails from the invoice page. Consider enabling automated reminders in Settings.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Team Management */}
              <AccordionItem value="team">
                <AccordionTrigger className="text-sm font-medium" data-testid="faq-section-team">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Team Management
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-add-team">
                    <p className="font-medium text-sm">How do I add team members?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Go to Settings → Team and tap "Invite Member". Enter their email and choose 
                      a role. They'll receive an invitation to join your business.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-team-roles">
                    <p className="font-medium text-sm">What are the different team roles?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      <strong>Owner:</strong> Full access to everything. <strong>Admin/Manager:</strong> Can manage jobs, 
                      quotes, and team. <strong>Staff:</strong> Can view and update assigned jobs only.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-assign-jobs">
                    <p className="font-medium text-sm">How do I assign a job to a team member?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Edit the job and select the team member from the "Assigned To" dropdown. 
                      They'll be notified and the job will appear in their schedule.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Troubleshooting */}
              <AccordionItem value="troubleshooting">
                <AccordionTrigger className="text-sm font-medium" data-testid="faq-section-troubleshooting">
                  <span className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-primary" />
                    Troubleshooting
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-email-issues">
                    <p className="font-medium text-sm">Emails not sending?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Check the Integrations page to make sure your email (Gmail or SendGrid) is connected. 
                      If using Gmail, you may need to re-authorize. Contact us if you're still having trouble.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-stripe-issues">
                    <p className="font-medium text-sm">Stripe payments not working?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Make sure you've completed Stripe Connect setup on the Integrations page. 
                      If the status shows "Pending", you need to finish verification with Stripe.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-sync-issues">
                    <p className="font-medium text-sm">Data not syncing between devices?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Make sure you're connected to the internet. Pull down to refresh on any list. 
                      If using the mobile app offline, data will sync when you're back online.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-pdf-issues">
                    <p className="font-medium text-sm">PDF not generating correctly?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Check that your business details and logo are set up in Settings → Business. 
                      If PDFs look wrong, try a different template style or contact support.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50" data-testid="faq-feature-request">
                    <p className="font-medium text-sm">Feature request or bug report?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      We love feedback! Email us at admin@avwebinnovation.com with your ideas or any 
                      bugs you find. We're always working to make JobRunner better for Aussie trade professionals.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <Separator />

          {/* App Tour */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Learn JobRunner
            </h3>
            <div className="p-4 rounded-lg border-2 bg-gradient-to-r from-primary/5 to-primary/10">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2 flex-1">
                  <h4 className="font-semibold">Take the App Tour</h4>
                  <p className="text-sm text-muted-foreground">
                    New to JobRunner? Our quick walkthrough will show you how to create jobs, 
                    send quotes, and get paid faster.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button 
                      variant="default"
                      size="sm"
                      onClick={() => {
                        localStorage.removeItem("jobrunner-tour-completed");
                        localStorage.removeItem("jobrunner-tour-completed-date");
                        localStorage.removeItem("jobrunner-tour-skipped");
                        window.dispatchEvent(new CustomEvent("start-guided-tour"));
                      }}
                      data-testid="button-start-tour"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Start App Tour
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        localStorage.removeItem("jobrunner_walkthrough_seen");
                        window.location.reload();
                      }}
                      data-testid="button-replay-walkthrough"
                    >
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Replay Welcome Tour
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Reset Demo Data */}
          <ResetDemoDataSection />

          <Separator />

          {/* About JobRunner */}
          <div className="text-center space-y-2 py-4">
            <p className="text-sm text-muted-foreground">
              JobRunner is built by AV Web Innovation
            </p>
            <p className="text-xs text-muted-foreground">
              Made in Australia for Australian trade professionals
            </p>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}

// Data Export Tab Component
function DataExportTab() {
  return (
    <TabsContent value="data" className="space-y-6">
      {/* Task #303: entry point to the bring-your-business migration wizard.
          This tab is already gated to owners via canAccessBusinessSettings. */}
      <Card data-testid="card-bring-your-business">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Briefcase className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
            Bring Your Business Across
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            One guided place to move everything over — spreadsheets, licences &amp; insurance documents,
            paper checklists, or a direct Xero / QuickBooks connection. Everything's optional, in any order.
          </p>
          <Link href="/bring-your-business">
            <Button size="sm" data-testid="button-open-bring-your-business">
              Open migration wizard
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Export Your Data</CardTitle>
          <CardDescription>
            Download your business data as CSV files. We recommend exporting your data regularly as a backup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'clients', label: 'Clients', description: 'Names, contact details, addresses, and notes', icon: Users },
            { key: 'jobs', label: 'Jobs', description: 'Job titles, statuses, addresses, and dates', icon: Briefcase },
            { key: 'quotes', label: 'Quotes', description: 'Quote numbers, amounts, GST, and statuses', icon: FileText },
            { key: 'invoices', label: 'Invoices', description: 'Invoice numbers, amounts, GST, payment status', icon: Receipt },
            { key: 'time-entries', label: 'Time Entries', description: 'Hours, rates, jobs, and billing status', icon: Clock },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between p-3 rounded-md border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.open(`/api/export/${item.key}`, '_blank');
                }}
                data-testid={`button-export-${item.key}`}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                CSV
              </Button>
            </div>
          ))}
          
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Export All Data</p>
                <p className="text-xs text-muted-foreground">Download all categories above in one go</p>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  ['clients', 'jobs', 'quotes', 'invoices', 'time-entries'].forEach((key, i) => {
                    setTimeout(() => {
                      window.open(`/api/export/${key}`, '_blank');
                    }, i * 500);
                  });
                }}
                data-testid="button-export-all"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <SheetSyncCard />
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Data Responsibility</CardTitle>
          <CardDescription>
            Important information about your data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>You are responsible for maintaining independent backups of your critical business data. We recommend exporting your data at least monthly.</p>
            <p>Exported CSV files can be opened in Microsoft Excel, Google Sheets, or any spreadsheet application.</p>
            <p>For accounting purposes, exported data should be verified by a qualified accountant before use in tax returns or BAS statements.</p>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}

// Reset Demo Data Section Component - Only visible for demo account
function ResetDemoDataSection() {
  const { toast } = useToast();
  const [isResetting, setIsResetting] = useState(false);
  
  // Check if this is the demo user
  const { data: profile } = useQuery<ProfileData>({
    queryKey: ['/api/profile'],
  });
  
  // Only show for demo account
  const isDemoUser = profile?.user?.email === 'demo@jobrunner.com.au';
  if (!isDemoUser) {
    return null;
  }

  const handleResetDemoData = async () => {
    if (!confirm('This will delete all demo data and recreate it with fresh IDs. Continue?')) {
      return;
    }
    
    setIsResetting(true);
    try {
      const response = await fetch('/api/admin/reset-demo-data', {
        method: 'POST',
        credentials: 'include'
      });
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Demo Data Reset",
          description: result.message || "All demo data has been recreated",
        });
        // Invalidate all queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
        queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
        queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
        queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
        queryClient.invalidateQueries({ queryKey: ['/api/team'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      } else {
        toast({
          title: "Reset Failed",
          description: result.message || "Could not reset demo data",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reset demo data",
        variant: "destructive"
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        Demo Data Management
      </h3>
      <div className="p-4 rounded-lg border-2 border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-orange-100 dark:bg-orange-900/50">
            <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="space-y-2 flex-1">
            <h4 className="font-semibold">Reset Demo Data</h4>
            <p className="text-sm text-muted-foreground">
              If your demo data appears different between environments (dev vs production), 
              use this button to reset all demo clients, jobs, quotes, invoices, and receipts 
              to match across both environments.
            </p>
            <Button 
              variant="outline"
              size="sm"
              onClick={handleResetDemoData}
              disabled={isResetting}
              className="border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-400"
              data-testid="button-reset-demo-data"
            >
              {isResetting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Reset Demo Data
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Developer Tab Component
function DeveloperTab() {
  const { toast } = useToast();
  const [isSeeding, setIsSeeding] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      const response = await apiRequest('POST', '/api/dev/seed-mock-data', { force: true });
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Mock Data Created",
          description: `Created ${result.results?.clients || 0} clients, ${result.results?.jobs || 0} jobs, ${result.results?.quotes || 0} quotes, ${result.results?.invoices || 0} invoices, ${result.results?.receipts || 0} receipts`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
        queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
        queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
        queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
        queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      } else {
        toast({
          title: "Already Seeded",
          description: result.message || "Mock data already exists",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to seed mock data",
        variant: "destructive"
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleClearData = async () => {
    if (!confirm('Are you sure you want to delete ALL your data? This cannot be undone!')) {
      return;
    }
    
    setIsClearing(true);
    try {
      const response = await apiRequest('POST', '/api/dev/clear-data');
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Data Cleared",
          description: "All clients, jobs, quotes, and invoices have been deleted",
        });
        queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
        queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
        queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
        queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to clear data",
        variant: "destructive"
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Test Data
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Generate realistic Australian test data to explore all features
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <h4 className="font-medium">Generate Mock Data</h4>
            <p className="text-sm text-muted-foreground">
              Creates realistic test data including 15 clients, 20 jobs, 8 quotes, and 12 invoices 
              with Australian addresses and phone numbers. Great for testing the full workflow!
            </p>
            <Button
              onClick={handleSeedData}
              disabled={isSeeding}
              style={{ backgroundColor: 'hsl(var(--trade))', borderColor: 'hsl(var(--trade-border))' }}
              data-testid="button-seed-data"
            >
              {isSeeding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Generate Test Data
                </>
              )}
            </Button>
          </div>

          <Separator />

          <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg space-y-3">
            <h4 className="font-medium text-red-700 dark:text-red-400">Danger Zone</h4>
            <p className="text-sm text-muted-foreground">
              Delete ALL clients, jobs, quotes, and invoices. This action cannot be undone!
            </p>
            <Button
              variant="destructive"
              onClick={handleClearData}
              disabled={isClearing}
              data-testid="button-clear-data"
            >
              {isClearing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Delete All Data
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// Payment Methods Settings Component
function PaymentMethodsSettings() {
  const { toast } = useToast();
  
  // Fetch payment settings
  const { data: paymentSettings, isLoading } = useQuery<{
    bankBsb: string | null;
    bankAccountNumber: string | null;
    bankAccountName: string | null;
    acceptCardPayments: boolean;
    acceptBankTransfer: boolean;
    acceptBecsDebit: boolean;
    acceptPayto: boolean;
    defaultPaymentMethod: string;
    enableCardSurcharge: boolean;
    cardSurchargePercent: number;
    cardSurchargeFixedCents: number;
    surchargeDisclaimer: string;
    enableEarlyPaymentDiscount: boolean;
    earlyPaymentDiscountPercent: number;
    earlyPaymentDiscountDays: number;
    feeInfo: {
      card: { percent: number; fixed: number; description: string };
      becs: { flat: number; description: string };
      bankTransfer: { flat: number; description: string };
    };
  }>({
    queryKey: ['/api/payment-settings'],
  });
  
  const [localSettings, setLocalSettings] = useState({
    bankBsb: '',
    bankAccountNumber: '',
    bankAccountName: '',
    acceptCardPayments: true,
    acceptBankTransfer: true,
    acceptBecsDebit: false,
    acceptPayto: false,
    enableCardSurcharge: false,
    cardSurchargePercent: 1.95,
    cardSurchargeFixedCents: 30,
    surchargeDisclaimer: 'A surcharge applies to credit/debit card payments to cover processing fees.',
    enableEarlyPaymentDiscount: false,
    earlyPaymentDiscountPercent: 2.00,
    earlyPaymentDiscountDays: 7,
  });
  
  // Sync local state with fetched data
  useEffect(() => {
    if (paymentSettings) {
      setLocalSettings({
        bankBsb: paymentSettings.bankBsb || '',
        bankAccountNumber: paymentSettings.bankAccountNumber || '',
        bankAccountName: paymentSettings.bankAccountName || '',
        acceptCardPayments: paymentSettings.acceptCardPayments,
        acceptBankTransfer: paymentSettings.acceptBankTransfer,
        acceptBecsDebit: paymentSettings.acceptBecsDebit,
        acceptPayto: paymentSettings.acceptPayto,
        enableCardSurcharge: paymentSettings.enableCardSurcharge,
        cardSurchargePercent: paymentSettings.cardSurchargePercent,
        cardSurchargeFixedCents: paymentSettings.cardSurchargeFixedCents,
        surchargeDisclaimer: paymentSettings.surchargeDisclaimer,
        enableEarlyPaymentDiscount: paymentSettings.enableEarlyPaymentDiscount,
        earlyPaymentDiscountPercent: paymentSettings.earlyPaymentDiscountPercent,
        earlyPaymentDiscountDays: paymentSettings.earlyPaymentDiscountDays,
      });
    }
  }, [paymentSettings]);
  
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<typeof localSettings>) => {
      return apiRequest('PATCH', '/api/payment-settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment-settings'] });
      toast({
        title: "Payment settings saved",
        description: "Your payment method preferences have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save",
        description: error.message || "Could not update payment settings.",
        variant: "destructive",
      });
    },
  });
  
  const handleSave = () => {
    // Validate numeric fields before saving
    const validatedSettings = {
      ...localSettings,
      cardSurchargePercent: isNaN(localSettings.cardSurchargePercent) ? 1.95 : Math.max(0, Math.min(10, localSettings.cardSurchargePercent)),
      cardSurchargeFixedCents: isNaN(localSettings.cardSurchargeFixedCents) ? 30 : Math.max(0, Math.min(500, localSettings.cardSurchargeFixedCents)),
      earlyPaymentDiscountPercent: isNaN(localSettings.earlyPaymentDiscountPercent) ? 2.0 : Math.max(0, Math.min(20, localSettings.earlyPaymentDiscountPercent)),
      earlyPaymentDiscountDays: isNaN(localSettings.earlyPaymentDiscountDays) ? 7 : Math.max(1, Math.min(60, localSettings.earlyPaymentDiscountDays)),
    };
    updateMutation.mutate(validatedSettings);
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Bank & Payment Methods
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bank Transfer Details */}
        <div className="space-y-4">
          <Label className="text-base font-semibold flex items-center gap-2">
            <Banknote className="h-4 w-4" />
            Bank Transfer Details
          </Label>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bank-bsb">BSB</Label>
              <Input
                id="bank-bsb"
                value={localSettings.bankBsb}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, bankBsb: e.target.value }))}
                placeholder="000-000"
                maxLength={7}
                data-testid="input-bank-bsb"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank-account-number">Account Number</Label>
              <Input
                id="bank-account-number"
                value={localSettings.bankAccountNumber}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, bankAccountNumber: e.target.value }))}
                placeholder="12345678"
                data-testid="input-bank-account-number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank-account-name">Account Name</Label>
              <Input
                id="bank-account-name"
                value={localSettings.bankAccountName}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, bankAccountName: e.target.value }))}
                placeholder="Your Business Name"
                data-testid="input-bank-account-name"
              />
            </div>
          </div>
        </div>
        
        <Separator />
        
        {/* Payment Methods Toggle */}
        <div className="space-y-4">
          <Label className="text-base font-semibold">Accepted Payment Methods</Label>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <div>
                  <Label className="font-medium">Card Payments</Label>
                  <p className="text-xs text-muted-foreground">
                    Visa, Mastercard via Stripe (~{paymentSettings?.feeInfo?.card?.percent || 1.95}% + ${paymentSettings?.feeInfo?.card?.fixed || 0.30})
                  </p>
                </div>
              </div>
              <Switch
                checked={localSettings.acceptCardPayments}
                onCheckedChange={(checked) => setLocalSettings(prev => ({ ...prev, acceptCardPayments: checked }))}
                data-testid="switch-accept-card"
              />
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <Banknote className="h-5 w-5 text-green-600" />
                <div>
                  <Label className="font-medium">Bank Transfer</Label>
                  <p className="text-xs text-muted-foreground">
                    Direct deposit to your bank account (FREE)
                  </p>
                </div>
              </div>
              <Switch
                checked={localSettings.acceptBankTransfer}
                onCheckedChange={(checked) => setLocalSettings(prev => ({ ...prev, acceptBankTransfer: checked }))}
                data-testid="switch-accept-bank-transfer"
              />
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-purple-600" />
                <div>
                  <Label className="font-medium">BECS Direct Debit</Label>
                  <p className="text-xs text-muted-foreground">
                    Debit from customer's bank account (~${paymentSettings?.feeInfo?.becs?.flat || 0.50} flat fee)
                  </p>
                </div>
              </div>
              <Switch
                checked={localSettings.acceptBecsDebit}
                onCheckedChange={(checked) => setLocalSettings(prev => ({ ...prev, acceptBecsDebit: checked }))}
                data-testid="switch-accept-becs"
              />
            </div>
          </div>
        </div>
        
        <Separator />
        
        {/* Card Surcharge Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-semibold flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Card Payment Surcharge
              </Label>
              <p className="text-sm text-muted-foreground">
                Pass card processing fees to customers who pay by card
              </p>
            </div>
            <Switch
              checked={localSettings.enableCardSurcharge}
              onCheckedChange={(checked) => setLocalSettings(prev => ({ ...prev, enableCardSurcharge: checked }))}
              data-testid="switch-card-surcharge"
            />
          </div>
          
          {localSettings.enableCardSurcharge && (
            <div className="pl-4 border-l-2 border-primary/20 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="surcharge-percent">Surcharge Percentage (%)</Label>
                  <Input
                    id="surcharge-percent"
                    type="number"
                    step="0.01"
                    value={localSettings.cardSurchargePercent}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, cardSurchargePercent: parseFloat(e.target.value) || 0 }))}
                    data-testid="input-surcharge-percent"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="surcharge-fixed">Fixed Fee (cents)</Label>
                  <Input
                    id="surcharge-fixed"
                    type="number"
                    value={localSettings.cardSurchargeFixedCents}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, cardSurchargeFixedCents: parseInt(e.target.value) || 0 }))}
                    data-testid="input-surcharge-fixed"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="surcharge-disclaimer">Surcharge Disclaimer</Label>
                <Input
                  id="surcharge-disclaimer"
                  value={localSettings.surchargeDisclaimer}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, surchargeDisclaimer: e.target.value }))}
                  placeholder="A surcharge applies to credit/debit card payments..."
                  data-testid="input-surcharge-disclaimer"
                />
                <p className="text-xs text-muted-foreground">
                  This message is shown to customers before they pay
                </p>
              </div>
              
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Australian Law:</strong> You can only surcharge up to the actual cost of accepting card payments. 
                    Make sure your surcharge does not exceed your actual processing fees.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <Separator />
        
        {/* Early Payment Discount */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Early Payment Discount
              </Label>
              <p className="text-sm text-muted-foreground">
                Encourage faster payments by offering a discount for paying early (e.g., via bank transfer)
              </p>
            </div>
            <Switch
              checked={localSettings.enableEarlyPaymentDiscount}
              onCheckedChange={(checked) => setLocalSettings(prev => ({ ...prev, enableEarlyPaymentDiscount: checked }))}
              data-testid="switch-early-payment-discount"
            />
          </div>
          
          {localSettings.enableEarlyPaymentDiscount && (
            <div className="pl-4 border-l-2 border-primary/20 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discount-percent">Discount Percentage (%)</Label>
                  <Input
                    id="discount-percent"
                    type="number"
                    step="0.01"
                    value={localSettings.earlyPaymentDiscountPercent}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, earlyPaymentDiscountPercent: parseFloat(e.target.value) || 0 }))}
                    data-testid="input-discount-percent"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount-days">If Paid Within (Days)</Label>
                  <Input
                    id="discount-days"
                    type="number"
                    value={localSettings.earlyPaymentDiscountDays}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, earlyPaymentDiscountDays: parseInt(e.target.value) || 0 }))}
                    data-testid="input-discount-days"
                  />
                </div>
              </div>
              
              <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <div className="text-sm text-green-800 dark:text-green-200">
                    <strong>Example:</strong> "{localSettings.earlyPaymentDiscountPercent}% discount if paid within {localSettings.earlyPaymentDiscountDays} days" will be shown on invoices.
                    This encourages bank transfers (free) over card payments (1.95%+ fee).
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            data-testid="button-save-payment-settings"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Payment Settings
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Usage Bar Component
function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const isNearLimit = !isUnlimited && percentage >= 80;
  const isAtLimit = !isUnlimited && used >= limit;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className={isAtLimit ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
          {used} / {isUnlimited ? '∞' : limit}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all ${
            isAtLimit 
              ? 'bg-red-500' 
              : isNearLimit 
                ? 'bg-yellow-500' 
                : 'bg-green-500'
          }`}
          style={{ width: isUnlimited ? '0%' : `${percentage}%` }}
        />
      </div>
    </div>
  );
}
