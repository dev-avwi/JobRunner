import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Briefcase,
  Users,
  Hammer,
  Wrench,
  Zap,
  Droplets,
  Building2,
  Paintbrush,
  Wind,
  Home,
  Trees,
  Fence,
  Sprout,
  LayoutGrid,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Smartphone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { trackEvent } from "@/lib/analytics";
import { tradeCatalog } from "@shared/tradeCatalog";
import logoWhite from "@assets/jobrunner-logo-white-mark.png";
import AddressAutocomplete from "@/components/ui/address-autocomplete";

interface SimpleOnboardingProps {
  onComplete: () => void;
  onSkip?: () => void;
}

const BRAND_BLUE = "#2B7DE9";
const BRAND_BLUE_TINT = "#EEF5FF";
const BRAND_ORANGE = "#F28C28";

type OnboardingRole = "owner" | "worker" | "subcontractor" | null;

const ROLES: {
  id: Exclude<OnboardingRole, null>;
  title: string;
  description: string;
  icon: typeof Briefcase;
  badge?: string;
}[] = [
  {
    id: "owner",
    title: "I run my own business",
    description: "Quotes, jobs and getting paid",
    icon: Briefcase,
    badge: "Most popular",
  },
  {
    id: "worker",
    title: "I'm on a team",
    description: "I have an invite code from my boss",
    icon: Users,
  },
  {
    id: "subcontractor",
    title: "I'm a subbie",
    description: "I have an invite code to join a team",
    icon: Hammer,
  },
];

const TRADE_OPTIONS = Object.entries(tradeCatalog).map(([id, trade]) => ({
  id,
  name: trade.name,
}));

const TRADE_ICONS: Record<string, typeof Wrench> = {
  electrical: Zap,
  plumbing: Droplets,
  building: Building2,
  landscaping: Trees,
  painting: Paintbrush,
  hvac: Wind,
  roofing: Home,
  tiling: LayoutGrid,
  concreting: Hammer,
  fencing: Fence,
  cleaning: ShieldCheck,
  handyman: Wrench,
  grounds_maintenance: Sprout,
};

const FREE_PLAN_FEATURES = [
  "Unlimited jobs and clients",
  "Quotes and invoices with GST",
  "Photo records on every job",
  "Get paid online with Stripe",
];

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

function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <div className="text-3xl font-black tracking-tighter">
      <span style={{ color: light ? "#FFFFFF" : "#0F172A" }}>Job</span>
      <span style={{ color: light ? "#FFFFFF" : BRAND_ORANGE }}>Runner</span>
    </div>
  );
}

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-2" data-testid="onboarding-step-dots">
      {Array.from({ length: total }).map((_, i) => {
        const isActive = i === current;
        const isComplete = i < current;
        return (
          <span
            key={i}
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: isActive ? 28 : 8,
              backgroundColor: isActive || isComplete ? BRAND_BLUE : "#D8DEE8",
            }}
          />
        );
      })}
    </div>
  );
}

function LeftPanel() {
  const signals = [
    "Free plan, no credit card",
    "iOS app — live on the App Store",
    "Built for Australian tradies",
  ];
  return (
    <div
      className="hidden md:flex md:w-[42%] lg:w-[44%] flex-col justify-between p-10 lg:p-14 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #2E72F0 0%, #1C3F95 48%, #0A1633 100%)" }}
    >
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="onboarding-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#onboarding-grid)" />
        </svg>
      </div>

      <div className="relative z-10 flex items-center gap-3">
        <img
          src={logoWhite}
          alt="JobRunner"
          width="44"
          height="44"
          className="h-11 w-11 object-contain"
        />
        <Wordmark light />
      </div>

      <div className="relative z-10 max-w-md">
        <h1 className="text-4xl lg:text-5xl font-black text-white leading-[1.05] tracking-tight mb-5">
          Built for how jobs actually run.
        </h1>
        <p className="text-blue-100 text-lg leading-relaxed">
          Quotes, jobs, invoices and payments — all in one place. Tradies across
          Australia are saving hours every week.
        </p>
      </div>

      <ul className="relative z-10 space-y-3">
        {signals.map((s) => (
          <li key={s} className="flex items-center gap-3">
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: BRAND_ORANGE }}
            />
            <span className="text-white/90 font-medium">{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SimpleOnboarding({ onComplete }: SimpleOnboardingProps) {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<OnboardingRole>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useSampleData, setUseSampleData] = useState(true);

  const [inviteCode, setInviteCode] = useState("");
  const [inviteValidation, setInviteValidation] = useState<{
    valid: boolean;
    businessName?: string;
    error?: string;
  } | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [workerName, setWorkerName] = useState("");
  const [workerLastName, setWorkerLastName] = useState("");
  const [workerPhone, setWorkerPhone] = useState("");
  const [joinedBusiness, setJoinedBusiness] = useState("");
  const validateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [formData, setFormData] = useState({
    tradeType: "",
    businessName: "",
    abn: "",
    phone: "",
    email: "",
    address: "",
    gstRegistered: true,
    hourlyRate: "85",
  });

  const { data: user } = useQuery<{ id: string; firstName?: string; lastName?: string; email?: string; intendedTier?: string; [key: string]: any }>({
    queryKey: ["/api/auth/me"],
  });

  useEffect(() => {
    if (user) {
      setWorkerName((prev) => prev || user.firstName || "");
      setWorkerLastName((prev) => prev || user.lastName || "");
      if (user.email) {
        setFormData((prev) => (prev.email ? prev : { ...prev, email: user.email! }));
      }
    }
  }, [user]);

  // Force the light brand theme for the whole onboarding flow, regardless of the
  // user's saved dark/light preference. ThemeProvider re-writes the root class +
  // inline CSS vars whenever theme/brand changes, so a one-shot flip isn't enough:
  // snapshot the root, re-assert light via a MutationObserver, restore on unmount.
  useEffect(() => {
    const root = document.documentElement;
    const snapshotClass = root.getAttribute("class");
    const snapshotStyle = root.getAttribute("style");
    const lightVars = ONBOARDING_LIGHT_VARS as Record<string, string>;

    let applying = false;
    const forceLight = () => {
      if (applying) return;
      applying = true;
      try {
        if (root.classList.contains("dark")) root.classList.remove("dark");
        if (!root.classList.contains("light")) root.classList.add("light");
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
    observer.observe(root, { attributes: true, attributeFilter: ["class", "style"] });

    return () => {
      observer.disconnect();
      if (snapshotClass === null) root.removeAttribute("class");
      else root.setAttribute("class", snapshotClass);
      if (snapshotStyle === null) root.removeAttribute("style");
      else root.setAttribute("style", snapshotStyle);
    };
  }, []);

  // Prefill from any partially-saved business settings (resume).
  useEffect(() => {
    const checkExisting = async () => {
      try {
        const res = await apiRequest("GET", "/api/business-settings");
        if (!res.ok) return;
        const s = await res.json();
        if (s.onboardingCompleted) return;
        setFormData((prev) => ({
          ...prev,
          tradeType: s.tradeType || prev.tradeType,
          businessName: s.businessName || prev.businessName,
          abn: s.abn || prev.abn,
          phone: s.phone || prev.phone,
          gstRegistered: s.gstEnabled ?? prev.gstRegistered,
          hourlyRate: s.defaultHourlyRate ? String(s.defaultHourlyRate) : prev.hourlyRate,
        }));
      } catch {
        // No existing settings — start fresh.
      }
    };
    checkExisting();
  }, []);

  const steps = useMemo<string[]>(() => {
    if (selectedRole === "owner") return ["role", "trade", "business", "done"];
    if (selectedRole === "worker" || selectedRole === "subcontractor")
      return ["role", "join", "done"];
    return ["role"];
  }, [selectedRole]);

  const stepId = steps[currentStep] ?? "role";

  useEffect(() => {
    trackEvent("onboarding_step_viewed", { step: stepId });
  }, [stepId]);

  const setField = (field: string, value: string | boolean) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const validateInviteCode = async (code: string) => {
    if (code.length !== 6) {
      setInviteValidation(null);
      return;
    }
    setIsValidatingCode(true);
    try {
      const res = await fetch(`/api/team/invite-code/validate/${code.toUpperCase()}`, {
        credentials: "include",
      });
      setInviteValidation(await res.json());
    } catch {
      setInviteValidation({ valid: false, error: "Failed to validate code" });
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleInviteCodeChange = (text: string) => {
    const clean = text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setInviteCode(clean);
    if (validateTimerRef.current) clearTimeout(validateTimerRef.current);
    if (clean.length === 6) {
      validateTimerRef.current = setTimeout(() => validateInviteCode(clean), 300);
    } else {
      setInviteValidation(null);
    }
  };

  const goNext = () => setCurrentStep((s) => s + 1);
  const goBack = () => {
    if (currentStep === 0) return;
    if (currentStep === 1) setSelectedRole(null);
    setCurrentStep((s) => s - 1);
  };

  const autoSaveTrade = async (tradeType: string) => {
    try {
      await apiRequest("PATCH", "/api/business-settings", {
        tradeType,
        onboardingCompleted: false,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.startsWith("404")) {
        try {
          await apiRequest("POST", "/api/business-settings", {
            tradeType,
            onboardingCompleted: false,
            businessName: formData.businessName || "",
          });
        } catch {
          // Best effort.
        }
      }
    }
  };

  const handleBusinessNext = async () => {
    if (!formData.businessName.trim()) {
      toast({ variant: "destructive", title: "Business name is required" });
      return;
    }
    setIsSubmitting(true);
    const payload = {
      businessName: formData.businessName,
      abn: formData.abn,
      phone: formData.phone,
      email: formData.email,
      address: formData.address,
      tradeType: formData.tradeType,
      gstEnabled: formData.gstRegistered,
      defaultHourlyRate: parseFloat(formData.hourlyRate) || 85,
      calloutFee: 90,
      teamSize: "solo",
      onboardingCompleted: false,
    };
    try {
      // A business_settings row usually already exists by now (created when the
      // trade step auto-saved, or at registration), so update in place. Only
      // create a fresh row on an explicit 404 — the POST path also seeds
      // trade-specific templates because it carries tradeType.
      try {
        await apiRequest("PATCH", "/api/business-settings", payload);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg.startsWith("404")) {
          await apiRequest("POST", "/api/business-settings", payload);
        } else {
          throw e;
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] });
      goNext();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error saving settings",
        description: error instanceof Error ? error.message : "Please try again",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTradeNext = () => {
    if (!formData.tradeType) {
      toast({ variant: "destructive", title: "Please pick your trade" });
      return;
    }
    autoSaveTrade(formData.tradeType);
    goNext();
  };

  const handleWorkerRedeem = async () => {
    if (!inviteValidation?.valid) {
      toast({ variant: "destructive", title: "Enter a valid 6-character invite code" });
      return;
    }
    if (!workerName.trim()) {
      toast({ variant: "destructive", title: "Please enter your first name" });
      return;
    }
    setIsSubmitting(true);
    try {
      const redeemRes = await apiRequest("POST", "/api/team/invite-code/redeem", {
        code: inviteCode,
        phone: workerPhone || undefined,
      });
      const redeemData = await redeemRes.json();
      if (redeemData.error) {
        toast({ variant: "destructive", title: "Error", description: redeemData.error });
        return;
      }
      if (workerName.trim() || workerLastName.trim()) {
        // Non-blocking: the redeem already succeeded, so a profile-name failure
        // must not error the user out of a team they've already joined.
        await apiRequest("PATCH", "/api/profile/me", {
          firstName: workerName.trim(),
          lastName: workerLastName.trim(),
          phone: workerPhone || undefined,
        }).catch(() => {});
      }
      await apiRequest("POST", "/api/onboarding/complete", {}).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] });
      setJoinedBusiness(redeemData.businessName || "the team");
      goNext();
    } catch (error: any) {
      const raw = error?.message || "";
      const friendly = raw.startsWith("team_plan_required:")
        ? raw.replace(/^team_plan_required:\s*/, "")
        : raw || "Failed to join team";
      toast({
        variant: "destructive",
        title: raw.startsWith("team_plan_required:") ? "Owner's plan inactive" : "Error",
        description: friendly,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async (destination?: string) => {
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/onboarding/complete", {});
      // Owners who opted in get a few example records seeded so the app isn't
      // empty on first load. Flagged isSample server-side, removable in one tap.
      // Non-blocking: a seed failure must not trap the user in onboarding.
      if (selectedRole === "owner" && useSampleData) {
        try {
          await apiRequest("POST", "/api/onboarding/seed-sample-data", {
            tradeType: formData.tradeType,
          });
        } catch {
          // Best effort — continue to the dashboard regardless.
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/sample-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/unified"] });
      // Task #303: optionally land on the bring-your-business wizard instead
      // of the dashboard. Set the path before onComplete() re-renders the app
      // shell so the router picks it up immediately.
      if (destination) {
        window.history.pushState(null, "", destination);
      }
      onComplete();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Something went wrong",
        description: error instanceof Error ? error.message : "Please try again",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const primaryBtnStyle = { backgroundColor: BRAND_BLUE, color: "#FFFFFF", borderColor: BRAND_BLUE };

  return (
    <div className="min-h-screen w-full flex bg-white" style={ONBOARDING_LIGHT_VARS}>
      <LeftPanel />

      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="md:hidden px-6 pt-6">
          <Wordmark />
        </div>

        <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-16 py-10">
          <div className="w-full max-w-xl mx-auto">
            <div className="mb-10">
              <StepDots total={steps.length} current={currentStep} />
            </div>

            {/* ---------------- Role ---------------- */}
            {stepId === "role" && (
              <div data-testid="step-role">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
                  Let's get to work.
                </h2>
                <p className="text-slate-500 text-lg mb-8">How will you be using JobRunner?</p>

                <div className="space-y-3">
                  {ROLES.map((role) => {
                    const isSelected = selectedRole === role.id;
                    const Icon = role.icon;
                    return (
                      <button
                        key={role.id}
                        onClick={() => setSelectedRole(role.id)}
                        data-testid={`role-${role.id}`}
                        className="group w-full text-left rounded-xl border-2 p-5 flex items-center gap-4 transition-all duration-200 hover-elevate active-elevate-2"
                        style={{
                          borderColor: isSelected ? BRAND_BLUE : "#E2E8F0",
                          backgroundColor: isSelected ? BRAND_BLUE_TINT : "#FFFFFF",
                          boxShadow: isSelected
                            ? `0 1px 2px rgba(15,23,42,0.04), 0 0 0 4px ${BRAND_BLUE}1A`
                            : "0 1px 2px rgba(15,23,42,0.04)",
                        }}
                      >
                        <div
                          className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-200"
                          style={{
                            backgroundColor: isSelected ? BRAND_BLUE : BRAND_BLUE_TINT,
                            color: isSelected ? "#FFFFFF" : BRAND_BLUE,
                          }}
                        >
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-slate-900">{role.title}</p>
                            {role.badge && (
                              <span
                                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: "#FFF1E2", color: BRAND_ORANGE }}
                              >
                                {role.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">{role.description}</p>
                        </div>
                        <span
                          className="h-6 w-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200"
                          style={{
                            borderColor: isSelected ? BRAND_BLUE : "#CBD5E1",
                            backgroundColor: isSelected ? BRAND_BLUE : "transparent",
                          }}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <Button
                  onClick={goNext}
                  disabled={!selectedRole}
                  data-testid="button-role-continue"
                  className="w-full mt-8 border"
                  size="xl"
                  style={selectedRole ? primaryBtnStyle : undefined}
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* ---------------- Business ---------------- */}
            {stepId === "business" && (
              <div data-testid="step-business">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
                  Your business details
                </h2>
                <p className="text-slate-500 text-lg mb-8">
                  This appears on your quotes and invoices. You can change it later.
                </p>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="businessName">Business name</Label>
                    <Input
                      id="businessName"
                      data-testid="input-business-name"
                      value={formData.businessName}
                      onChange={(e) => setField("businessName", e.target.value)}
                      placeholder="e.g. Coastal Electrical"
                      className="mt-1.5"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="abn">ABN</Label>
                      <Input
                        id="abn"
                        data-testid="input-abn"
                        value={formData.abn}
                        onChange={(e) => setField("abn", e.target.value)}
                        placeholder="12 345 678 901"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <div className="relative mt-1.5">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          id="phone"
                          data-testid="input-phone"
                          value={formData.phone}
                          onChange={(e) => setField("phone", e.target.value)}
                          placeholder="0400 000 000"
                          className="pl-9"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <div className="relative mt-1.5">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="email"
                        data-testid="input-email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setField("email", e.target.value)}
                        placeholder="you@business.com.au"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="address">Business address</Label>
                    <div className="relative mt-1.5">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10 pointer-events-none" />
                      <AddressAutocomplete
                        value={formData.address}
                        onChange={(v) => setField("address", v)}
                        onAddressSelect={(addr) => setField("address", addr)}
                        requireSelection={false}
                        placeholder="Start typing your address..."
                        className="pl-9"
                        data-testid="input-address"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="hourlyRate">Default hourly rate</Label>
                    <div className="relative mt-1.5">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="hourlyRate"
                        data-testid="input-hourly-rate"
                        type="number"
                        value={formData.hourlyRate}
                        onChange={(e) => setField("hourlyRate", e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                    <div>
                      <p className="font-medium text-slate-900">Registered for GST</p>
                      <p className="text-sm text-slate-500">Adds 10% GST to your invoices</p>
                    </div>
                    <Switch
                      data-testid="switch-gst"
                      checked={formData.gstRegistered}
                      onCheckedChange={(v) => setField("gstRegistered", v)}
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  <Button variant="outline" size="xl" onClick={goBack} data-testid="button-back">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button
                    onClick={handleBusinessNext}
                    disabled={isSubmitting}
                    data-testid="button-business-continue"
                    className="flex-1 border"
                    size="xl"
                    style={primaryBtnStyle}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Continue <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* ---------------- Trade ---------------- */}
            {stepId === "trade" && (
              <div data-testid="step-trade">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
                  What's your trade?
                </h2>
                <p className="text-slate-500 text-lg mb-8">
                  We'll set up the app for the way your trade works.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {TRADE_OPTIONS.map((trade) => {
                    const isSelected = formData.tradeType === trade.id;
                    const Icon = TRADE_ICONS[trade.id] || Wrench;
                    return (
                      <button
                        key={trade.id}
                        onClick={() => setField("tradeType", trade.id)}
                        data-testid={`trade-${trade.id}`}
                        className="rounded-xl border-2 p-4 flex flex-col items-center justify-center gap-2 text-center transition-all duration-200"
                        style={{
                          borderColor: isSelected ? BRAND_BLUE : "#E2E8F0",
                          backgroundColor: isSelected ? BRAND_BLUE_TINT : "#FFFFFF",
                          color: isSelected ? BRAND_BLUE : "#475569",
                        }}
                      >
                        <Icon className="h-6 w-6" />
                        <span className="text-sm font-semibold text-slate-900">{trade.name}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-3 mt-8">
                  <Button variant="outline" size="xl" onClick={goBack} data-testid="button-back">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button
                    onClick={handleTradeNext}
                    disabled={!formData.tradeType}
                    data-testid="button-trade-continue"
                    className="flex-1 border"
                    size="xl"
                    style={formData.tradeType ? primaryBtnStyle : undefined}
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ---------------- Join (worker / subbie) ---------------- */}
            {stepId === "join" && (
              <div data-testid="step-join">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
                  Join your team
                </h2>
                <p className="text-slate-500 text-lg mb-8">
                  Enter the 6-character invite code you were given.
                </p>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="inviteCode">Invite code</Label>
                    <Input
                      id="inviteCode"
                      data-testid="input-invite-code"
                      value={inviteCode}
                      onChange={(e) => handleInviteCodeChange(e.target.value)}
                      placeholder="ABC123"
                      className="mt-1.5 uppercase tracking-[0.3em] font-semibold"
                      maxLength={6}
                    />
                    {isValidatingCode && (
                      <p className="text-sm text-slate-500 mt-1.5 flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking code…
                      </p>
                    )}
                    {inviteValidation && !isValidatingCode && (
                      <p
                        className="text-sm mt-1.5 font-medium"
                        style={{ color: inviteValidation.valid ? "#15803D" : "#DC2626" }}
                        data-testid="text-invite-status"
                      >
                        {inviteValidation.valid
                          ? `Joining ${inviteValidation.businessName || "the team"}`
                          : inviteValidation.error || "Invalid code"}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="workerName">First name</Label>
                      <Input
                        id="workerName"
                        data-testid="input-worker-name"
                        value={workerName}
                        onChange={(e) => setWorkerName(e.target.value)}
                        placeholder="First name"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="workerLastName">Last name</Label>
                      <Input
                        id="workerLastName"
                        data-testid="input-worker-lastname"
                        value={workerLastName}
                        onChange={(e) => setWorkerLastName(e.target.value)}
                        placeholder="Last name"
                        className="mt-1.5"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="workerPhone">Phone (optional)</Label>
                    <div className="relative mt-1.5">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="workerPhone"
                        data-testid="input-worker-phone"
                        value={workerPhone}
                        onChange={(e) => setWorkerPhone(e.target.value)}
                        placeholder="0400 000 000"
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  <Button variant="outline" size="xl" onClick={goBack} data-testid="button-back">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button
                    onClick={handleWorkerRedeem}
                    disabled={isSubmitting || !inviteValidation?.valid}
                    data-testid="button-join-team"
                    className="flex-1 border"
                    size="xl"
                    style={inviteValidation?.valid ? primaryBtnStyle : undefined}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Join team <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* ---------------- Done ---------------- */}
            {stepId === "done" && (
              <div data-testid="step-done">
                <div
                  className="h-14 w-14 rounded-2xl flex items-center justify-center mb-6"
                  style={{
                    background: "linear-gradient(135deg, #2E72F0 0%, #1C4FD0 100%)",
                    boxShadow: `0 8px 20px ${BRAND_BLUE}33, 0 0 0 6px ${BRAND_BLUE}14`,
                  }}
                >
                  <Check className="h-8 w-8 text-white" strokeWidth={3} />
                </div>

                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
                  {selectedRole === "owner" ? "You're all set." : `Welcome to ${joinedBusiness}.`}
                </h2>
                <p className="text-slate-500 text-lg mb-8">
                  {selectedRole === "owner"
                    ? "Your free plan is ready. Here's what's included:"
                    : "You've joined the team. Jump in and get started."}
                </p>

                {selectedRole === "owner" && (
                  <>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 mb-6">
                      <ul className="space-y-3.5">
                        {FREE_PLAN_FEATURES.map((f) => (
                          <li key={f} className="flex items-center gap-3">
                            <span
                              className="h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: BRAND_BLUE_TINT, color: BRAND_BLUE }}
                            >
                              <Check className="h-4 w-4" strokeWidth={3} />
                            </span>
                            <span className="text-slate-700 font-medium">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 mb-6">
                      <div className="flex items-start gap-3 min-w-0">
                        <span
                          className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: BRAND_BLUE_TINT, color: BRAND_BLUE }}
                        >
                          <Sparkles className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">Add sample data to explore</p>
                          <p className="text-sm text-slate-500">
                            A few example clients, jobs and invoices so the app isn't empty. Remove them anytime in one tap.
                          </p>
                        </div>
                      </div>
                      <Switch
                        data-testid="switch-sample-data"
                        checked={useSampleData}
                        onCheckedChange={setUseSampleData}
                      />
                    </div>

                    <div
                      className="rounded-xl p-5 flex items-start gap-3 mb-8"
                      style={{ backgroundColor: "#FFF6EC", border: `1px solid ${BRAND_ORANGE}33` }}
                    >
                      <Smartphone className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: BRAND_ORANGE }} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900">Want more grunt?</p>
                          <span
                            className="text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: BRAND_ORANGE, color: "#FFFFFF" }}
                          >
                            PRO
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-0.5">
                          Go Pro for AI quotes, automatic payment reminders and team scheduling — upgrade anytime in Settings.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                <Button
                  onClick={() => handleComplete()}
                  disabled={isSubmitting}
                  data-testid="button-finish"
                  className="w-full border"
                  size="xl"
                  style={primaryBtnStyle}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Go to dashboard <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>

                {/* Task #303: owners can jump straight into the bring-your-business
                    migration wizard instead of landing on an empty dashboard. */}
                {selectedRole === "owner" && (
                  <Button
                    variant="outline"
                    onClick={() => handleComplete("/bring-your-business")}
                    disabled={isSubmitting}
                    data-testid="button-bring-business"
                    className="w-full mt-3"
                    size="xl"
                  >
                    Bring my existing business across
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
