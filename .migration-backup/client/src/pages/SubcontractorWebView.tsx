import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Phone, MapPin, Calendar, Shield, CheckCircle2, XCircle,
  LogOut, ArrowLeft, Car, Play, Square, StickyNote, Camera,
  Clock, AlertCircle, Briefcase
} from "lucide-react";
import jobrunnerLogo from "@assets/jobrunner-logo-cropped.png";
import SaveAccountSheet from "@/components/subs/SaveAccountSheet";

interface SubcontractorWebViewProps {
  token: string;
}

const EVENT_LABELS: Record<string, string> = {
  'SUBBIE_VERIFIED': 'Identity Verified',
  'SUBBIE_ACCEPTED': 'Job Accepted',
  'SUBBIE_DECLINED': 'Job Declined',
  'SUBBIE_EN_ROUTE': 'On My Way',
  'SUBBIE_ARRIVED': 'Arrived on Site',
  'SUBBIE_STARTED': 'Work Started',
  'SUBBIE_FINISHED': 'Work Completed',
  'SUBBIE_NOTE_ADDED': 'Note Added',
  'SUBBIE_PHOTO_UPLOADED': 'Photo Uploaded',
};

const STATUS_STEPS = [
  { key: 'accepted', label: 'Accepted' },
  { key: 'en_route', label: 'On My Way' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'working', label: 'Working' },
  { key: 'done', label: 'Done' },
];

function deriveStatus(events: any[], tokenStatus: string): string {
  if (tokenStatus === 'pending') return 'pending';
  const statusEvents = ['SUBBIE_FINISHED', 'SUBBIE_STARTED', 'SUBBIE_ARRIVED', 'SUBBIE_EN_ROUTE', 'SUBBIE_ACCEPTED'];
  const statusMap: Record<string, string> = {
    'SUBBIE_FINISHED': 'done',
    'SUBBIE_STARTED': 'working',
    'SUBBIE_ARRIVED': 'arrived',
    'SUBBIE_EN_ROUTE': 'en_route',
    'SUBBIE_ACCEPTED': 'accepted',
  };
  for (const se of statusEvents) {
    if (events.some((e: any) => e.eventType === se)) return statusMap[se];
  }
  return tokenStatus;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function Footer() {
  return (
    <div className="text-center py-8 flex items-center justify-center gap-2">
      <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 object-contain" />
      <span className="text-sm text-slate-400">Powered by <span className="font-semibold text-slate-500">JobRunner</span></span>
    </div>
  );
}

export default function SubcontractorWebView({ token }: SubcontractorWebViewProps) {
  const { toast } = useToast();
  const [viewState, setViewState] = useState<'loading' | 'error' | 'otp-phone' | 'otp-code' | 'dashboard'>('loading');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [jobData, setJobData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>('pending');
  const [showEtaPicker, setShowEtaPicker] = useState(false);
  const [etaMinutes, setEtaMinutes] = useState<number>(15);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [photoCategory, setPhotoCategory] = useState('general');
  const [photoCaption, setPhotoCaption] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [dismissedAppBanner, setDismissedAppBanner] = useState(false);
  const [showSaveAccount, setShowSaveAccount] = useState(false);
  const [accountSaved, setAccountSaved] = useState<null | "linked" | "created">(null);
  const [accountDismissed, setAccountDismissed] = useState(false);
  const [accountStatusLoaded, setAccountStatusLoaded] = useState(false);
  const [accountStatusInfo, setAccountStatusInfo] = useState<{
    hasAccount: boolean;
    alreadyLinked: boolean;
    firstName?: string | null;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.classList.contains('dark') ? 'dark' : 'light';
    root.classList.remove('dark');
    return () => {
      if (previousTheme === 'dark') {
        root.classList.add('dark');
      }
    };
  }, []);

  useEffect(() => {
    fetchTokenInfo();
  }, [token]);

  useEffect(() => {
    if (viewState === 'dashboard' && sessionToken) {
      startLocationPing();
    }
    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
    };
  }, [viewState, sessionToken]);

  // T008: load account-link status once we hit the dashboard so we know
  // whether to show the "Save your account" CTA.
  useEffect(() => {
    if (viewState !== 'dashboard' || !sessionToken || accountStatusLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/m/${token}/account-status`, {
          headers: { 'Authorization': `Bearer ${sessionToken}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setAccountStatusInfo(data);
        setAccountStatusLoaded(true);
        if (data.alreadyLinked) {
          // Already linked — treat as "saved" so we don't nag with the CTA.
          setAccountSaved('linked');
        }
      } catch {
        // silent
      }
    })();
    return () => { cancelled = true; };
  }, [viewState, sessionToken, token, accountStatusLoaded]);

  const startLocationPing = () => {
    if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);

    let gpsDeniedNotified = false;
    const sendLocation = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetch(`/api/subcontractor/${token}/location`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracyMeters: pos.coords.accuracy,
            }),
          }).catch(() => {});
        },
        (error) => {
          if (error.code === 1 && !gpsDeniedNotified) {
            gpsDeniedNotified = true;
            toast({
              title: "Location access denied",
              description: "Enable location in your browser settings so your location can be shared with the business.",
            });
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    sendLocation();
    locationIntervalRef.current = setInterval(sendLocation, 60000);
  };

  const fetchTokenInfo = async () => {
    try {
      const res = await fetch(`/api/subcontractor/${token}/info`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error || 'This link is not valid or has expired.');
        setViewState('error');
        return;
      }
      const info = await res.json();
      setTokenInfo(info);

      if (info.status === 'expired') {
        setErrorMessage('This link has expired. Please contact the business for a new one.');
        setViewState('error');
        return;
      }
      if (info.status === 'revoked') {
        setErrorMessage('This link has been revoked. Please contact the business.');
        setViewState('error');
        return;
      }

      const savedSession = localStorage.getItem(`subbie_session_${token}`);
      if (savedSession) {
        const ok = await tryLoadData(savedSession);
        if (ok) return;
        localStorage.removeItem(`subbie_session_${token}`);
      }

      if (info.requiresOtp === false) {
        setViewState('dashboard');
      } else {
        setViewState('otp-phone');
      }
    } catch {
      setErrorMessage('Unable to connect. Please check your internet and try again.');
      setViewState('error');
    }
  };

  const tryLoadData = async (sToken: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/subcontractor/${token}/data`, {
        headers: { 'Authorization': `Bearer ${sToken}` },
      });
      if (res.status === 401) return false;
      if (!res.ok) return false;
      const data = await res.json();
      setJobData(data);
      setSessionToken(sToken);
      setCurrentStatus(deriveStatus(data.events || [], data.token?.status || 'pending'));
      setViewState('dashboard');
      return true;
    } catch {
      return false;
    }
  };

  const handleRequestCode = async () => {
    if (!phone.trim()) {
      toast({ title: "Phone Required", description: "Please enter your mobile number", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/subcontractor/${token}/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Code Sent", description: "Check your phone for a verification code" });
        setViewState('otp-code');
      } else {
        throw new Error(data.error || 'Failed to send code');
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to send verification code", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!otpCode.trim() || otpCode.length !== 6) {
      toast({ title: "Invalid Code", description: "Please enter the 6-digit code from your SMS", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/subcontractor/${token}/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), code: otpCode.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.sessionToken) {
        localStorage.setItem(`subbie_session_${token}`, data.sessionToken);
        setSessionToken(data.sessionToken);
        await fetchDashboardData(data.sessionToken);
        toast({ title: "Welcome!", description: "You're now verified" });
      } else {
        throw new Error(data.error || 'Invalid verification code');
      }
    } catch (error: any) {
      toast({ title: "Verification Failed", description: error.message || "Invalid or expired code", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchDashboardData = async (sToken: string) => {
    try {
      const res = await fetch(`/api/subcontractor/${token}/data`, {
        headers: { 'Authorization': `Bearer ${sToken}` },
      });
      if (!res.ok) throw new Error('Failed to load job data');
      const data = await res.json();
      setJobData(data);
      setCurrentStatus(deriveStatus(data.events || [], data.token?.status || 'pending'));
      setViewState('dashboard');
    } catch {
      toast({ title: "Error", description: "Failed to load job data", variant: "destructive" });
    }
  };

  const handleLogout = async () => {
    try {
      if (sessionToken) {
        await fetch(`/api/subcontractor/${token}/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sessionToken}` },
        });
      }
    } catch {} finally {
      localStorage.removeItem(`subbie_session_${token}`);
      setSessionToken(null);
      setJobData(null);
      setPhone('');
      setOtpCode('');
      setViewState('otp-phone');
    }
  };

  const handleAccept = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/subcontractor/${token}/accept`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });
      if (res.ok) {
        toast({ title: "Job Accepted", description: "You've accepted this job" });
        await fetchDashboardData(sessionToken!);
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to accept');
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/subcontractor/${token}/decline`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });
      if (res.ok) {
        toast({ title: "Job Declined", description: "You've declined this job" });
        await fetchDashboardData(sessionToken!);
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to decline');
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  };

  const handleStatusUpdate = async (newStatus: string) => {
    setIsSubmitting(true);
    try {
      const loc = await getLocation();
      const res = await fetch(`/api/subcontractor/${token}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          status: newStatus,
          ...(loc || {}),
        }),
      });
      if (res.ok) {
        await fetchDashboardData(sessionToken!);
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update status');
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOnMyWay = async () => {
    setIsSubmitting(true);
    try {
      const loc = await getLocation();
      const res = await fetch(`/api/subcontractor/${token}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          status: 'en_route',
          etaMinutes,
          ...(loc || {}),
        }),
      });
      if (res.ok) {
        setShowEtaPicker(false);
        await fetchDashboardData(sessionToken!);
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update status');
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/subcontractor/${token}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ content: noteText.trim() }),
      });
      if (res.ok) {
        toast({ title: "Note Added", description: "Your note has been saved" });
        setNoteText('');
        setShowNoteInput(false);
        await fetchDashboardData(sessionToken!);
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add note');
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionToken) return;
    
    setIsUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const res = await fetch(`/api/subcontractor/${token}/photos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            fileName: file.name,
            fileBase64: base64,
            mimeType: file.type,
            category: photoCategory,
            caption: photoCaption || undefined,
          }),
        });
        
        if (res.ok) {
          toast({ title: "Photo uploaded successfully" });
          setShowPhotoUpload(false);
          setPhotoCaption('');
          setPhotoCategory('general');
          await fetchDashboardData(sessionToken!);
        } else {
          const data = await res.json();
          toast({ title: "Upload failed", description: data.error, variant: "destructive" });
        }
        setIsUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast({ title: "Upload failed", variant: "destructive" });
      setIsUploadingPhoto(false);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (viewState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#2563EB]/5 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (viewState === 'error') {
    const isExpired = errorMessage.toLowerCase().includes('expired');
    const isRevoked = errorMessage.toLowerCase().includes('revoked');
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#2563EB]/5 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <Card className="w-full max-w-md rounded-md">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                {isExpired ? (
                  <Clock className="w-8 h-8 text-amber-500" />
                ) : isRevoked ? (
                  <XCircle className="w-8 h-8 text-red-500" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-slate-400" />
                )}
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                {isExpired ? 'Link Expired' : isRevoked ? 'Link Revoked' : 'Link Not Found'}
              </h2>
              <p className="text-sm text-slate-500">{errorMessage}</p>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (viewState === 'otp-phone') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#2563EB]/5 flex flex-col relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2563EB]/[0.03] via-transparent to-transparent pointer-events-none" />
        <div className="py-10 px-4 relative">
          <div className="max-w-md mx-auto text-center">
            <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 mx-auto mb-3 object-contain" />
            <h1 className="text-2xl font-bold text-slate-900">Subcontractor Portal</h1>
            {tokenInfo && (
              <p className="text-sm text-slate-500 mt-1">
                {tokenInfo.job?.title} — {tokenInfo.business?.companyName}
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 flex items-start justify-center px-4 relative">
          <Card className="w-full max-w-md rounded-md shadow-lg border-slate-200/60">
            <CardContent className="p-6 space-y-4">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-[#2563EB]/10 ring-1 ring-[#2563EB]/20 flex items-center justify-center mx-auto mb-3">
                  <Phone className="w-6 h-6 text-[#2563EB]" />
                </div>
                <h2 className="text-lg font-semibold">Verify Your Identity</h2>
                <p className="text-sm text-slate-500 mt-1">Enter the mobile number associated with your account</p>
              </div>
              <Input
                type="tel"
                placeholder="0400 000 000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="text-center text-lg"
              />
              <Button
                onClick={handleRequestCode}
                disabled={isSubmitting || !phone.trim()}
                className="w-full bg-[#2563EB]"
                size="lg"
              >
                {isSubmitting ? 'Sending...' : 'Send Verification Code'}
              </Button>
              <p className="text-xs text-center text-slate-400 flex items-center justify-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                Verify your identity to access job details
              </p>
            </CardContent>
          </Card>
        </div>

        <Footer />
      </div>
    );
  }

  if (viewState === 'otp-code') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#2563EB]/5 flex flex-col relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2563EB]/[0.03] via-transparent to-transparent pointer-events-none" />
        <div className="py-10 px-4 relative">
          <div className="max-w-md mx-auto text-center">
            <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 mx-auto mb-3 object-contain" />
            <h1 className="text-2xl font-bold text-slate-900">Subcontractor Portal</h1>
            {tokenInfo && (
              <p className="text-sm text-slate-500 mt-1">
                {tokenInfo.job?.title} — {tokenInfo.business?.companyName}
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 flex items-start justify-center px-4 relative">
          <Card className="w-full max-w-md rounded-md shadow-lg border-slate-200/60">
            <CardContent className="p-6 space-y-4">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-[#2563EB]/10 ring-1 ring-[#2563EB]/20 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6 text-[#2563EB]" />
                </div>
                <h2 className="text-lg font-semibold">Enter Verification Code</h2>
                <p className="text-sm text-slate-500 mt-1">We sent a 6-digit code to {phone}</p>
              </div>
              <Input
                type="text"
                placeholder="000000"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-widest font-mono"
                maxLength={6}
              />
              <Button
                onClick={handleVerifyCode}
                disabled={isSubmitting || otpCode.length !== 6}
                className="w-full bg-[#2563EB]"
                size="lg"
              >
                {isSubmitting ? 'Verifying...' : 'Verify & Continue'}
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setViewState('otp-phone')}
                  className="flex-1"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleRequestCode}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Resend Code
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Footer />
      </div>
    );
  }

  if (viewState === 'dashboard' && jobData) {
    const { job, business, events, notes, photos } = jobData;
    const statusIndex = STATUS_STEPS.findIndex(s => s.key === currentStatus);

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-[#2563EB] sticky top-0 z-20">
          <div className="px-4 py-4">
            <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {business?.businessLogo ? (
                  <img src={business.businessLogo} alt={business.companyName} className="w-8 h-8 rounded-md object-contain bg-white p-1" />
                ) : (
                  <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 object-contain" />
                )}
                <div className="min-w-0">
                  <h1 className="font-bold text-base text-white truncate">{business?.companyName}</h1>
                  <p className="text-xs text-white/70 truncate">{job?.title}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout} className="text-white border-white/30">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        <div className="bg-gradient-to-r from-[#2563EB]/[0.04] via-[#2563EB]/[0.02] to-transparent border-b border-slate-200 px-4 py-4">
          <div className="max-w-lg mx-auto space-y-2">
            <h2 className="text-lg font-bold text-slate-900">{job?.title}</h2>
            {job?.address && (
              <p className="text-sm text-slate-500 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 flex-shrink-0" /> {job.address}
              </p>
            )}
            {job?.scheduledAt && (
              <p className="text-sm text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 flex-shrink-0" /> {formatDate(job.scheduledAt)}
              </p>
            )}
            {job?.description && (
              <p className="text-sm text-slate-600 mt-2">{job.description}</p>
            )}
          </div>
        </div>

        <div className="flex-1 px-4 py-6">
          <div className="max-w-lg mx-auto space-y-6">
            {currentStatus === 'pending' && (
              <Card className="rounded-md">
                <CardContent className="p-6 space-y-4">
                  <div className="text-center">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-[#2563EB]" />
                    <h3 className="text-lg font-semibold">Accept this job?</h3>
                    <p className="text-sm text-slate-500 mt-1">Review the details above before accepting</p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={handleDecline} disabled={isSubmitting}>
                      <XCircle className="w-4 h-4 mr-2" /> Decline
                    </Button>
                    <Button className="flex-1 bg-[#2563EB]" onClick={handleAccept} disabled={isSubmitting}>
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Accept Job
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStatus !== 'pending' && (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    {STATUS_STEPS.map((step, i) => {
                      const isCurrent = step.key === currentStatus;
                      const isCompleted = i < statusIndex;
                      return (
                        <div key={step.key} className="flex flex-col items-center flex-1 min-w-0">
                          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                            isCompleted ? 'bg-[#2563EB] border-[#2563EB]' :
                            isCurrent ? 'bg-[#2563EB] border-[#2563EB] ring-4 ring-[#2563EB]/20' :
                            'bg-white border-slate-300'
                          }`} />
                          <span className={`text-[10px] mt-1 text-center leading-tight ${
                            isCurrent ? 'font-semibold text-[#2563EB]' :
                            isCompleted ? 'text-slate-600' : 'text-slate-400'
                          }`}>{step.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  {currentStatus === 'accepted' && !showEtaPicker && (
                    <Button className="w-full bg-[#2563EB]" size="lg" onClick={() => setShowEtaPicker(true)} disabled={isSubmitting}>
                      <Car className="w-4 h-4 mr-2" /> I'm On My Way
                    </Button>
                  )}
                  {currentStatus === 'accepted' && showEtaPicker && (
                    <div className="space-y-3 bg-blue-50 border border-blue-200 rounded-md p-4">
                      <h4 className="text-sm font-semibold text-slate-800">What's your estimated arrival time?</h4>
                      <div className="flex items-center gap-2 flex-wrap">
                        {[10, 15, 20, 30, 45, 60, 90].map((mins) => (
                          <Button
                            key={mins}
                            variant={etaMinutes === mins ? "default" : "outline"}
                            size="sm"
                            className={etaMinutes === mins ? "bg-[#2563EB]" : ""}
                            onClick={() => setEtaMinutes(mins)}
                          >
                            {mins < 60 ? `${mins} min` : mins === 60 ? '1 hr' : '1.5 hr'}
                          </Button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="flex-1" onClick={() => setShowEtaPicker(false)}>
                          Cancel
                        </Button>
                        <Button className="flex-1 bg-[#2563EB]" size="sm" onClick={() => handleOnMyWay()} disabled={isSubmitting}>
                          {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Car className="w-4 h-4 mr-2" />}
                          Confirm - {etaMinutes < 60 ? `${etaMinutes} min` : etaMinutes === 60 ? '1 hr' : '1.5 hr'} away
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500 text-center">Location sharing is optional</p>
                    </div>
                  )}
                  {currentStatus === 'en_route' && (
                    <div className="space-y-3">
                      {jobData?.token?.etaMinutes && (
                        <div className="flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 rounded-md p-3">
                          <Clock className="w-4 h-4 text-amber-600" />
                          <span className="text-sm font-medium text-amber-800">ETA: ~{jobData.token.etaMinutes} min</span>
                        </div>
                      )}
                      <Button className="w-full bg-[#2563EB]" size="lg" onClick={() => handleStatusUpdate('arrived')} disabled={isSubmitting}>
                        <MapPin className="w-4 h-4 mr-2" /> I've Arrived
                      </Button>
                    </div>
                  )}
                  {currentStatus === 'arrived' && (
                    <Button className="w-full bg-[#2563EB]" size="lg" onClick={() => handleStatusUpdate('working')} disabled={isSubmitting}>
                      <Play className="w-4 h-4 mr-2" /> Start Work
                    </Button>
                  )}
                  {currentStatus === 'working' && (
                    <Button className="w-full bg-[#2563EB]" size="lg" onClick={() => handleStatusUpdate('done')} disabled={isSubmitting}>
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Finish Work
                    </Button>
                  )}
                  {currentStatus === 'done' && (
                    <div className="bg-green-50 border border-green-200 rounded-md p-4 text-center">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-600" />
                      <h3 className="font-semibold text-green-800">Job Complete</h3>
                      <p className="text-sm text-green-600 mt-1">Great work! This job has been marked as finished.</p>
                    </div>
                  )}

                  {currentStatus === 'done' && accountStatusLoaded && !accountSaved && !accountDismissed && (
                    <div className="rounded-md border border-[#2563EB]/30 bg-gradient-to-br from-[#2563EB]/5 to-[#2563EB]/10 p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-md bg-[#2563EB] flex items-center justify-center flex-shrink-0 shadow-sm">
                          <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-slate-900">
                            {accountStatusInfo?.hasAccount && accountStatusInfo?.firstName
                              ? `Welcome back, ${accountStatusInfo.firstName}`
                              : "Save your spot — 30 seconds"}
                          </h4>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {accountStatusInfo?.hasAccount
                              ? `Link ${jobData.business?.companyName || 'this contractor'} to your account. Future job links from them skip the name confirm.`
                              : "Get a free JobRunner account so the next job link opens instantly — no name confirm, just tap and go."}
                          </p>
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              className="bg-[#2563EB] hover:bg-[#2563EB]"
                              onClick={() => setShowSaveAccount(true)}
                              data-testid="button-open-save-account"
                            >
                              {accountStatusInfo?.hasAccount ? "Link contractor" : "Create free account"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setAccountDismissed(true)}
                              data-testid="button-dismiss-save-account"
                            >
                              Not now
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStatus === 'done' && accountSaved === 'created' && (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-emerald-900">Account ready</h4>
                          <p className="text-xs text-emerald-800/80 mt-1">
                            Next job link from any contractor will open straight to the job.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {jobData.completedJobCount >= 3 && !dismissedAppBanner && (
                    <div className="bg-[#2563EB]/5 border border-[#2563EB]/20 rounded-md p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-md bg-[#2563EB]/10 flex items-center justify-center flex-shrink-0">
                          <Briefcase className="w-5 h-5 text-[#2563EB]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-slate-800">You're a regular!</h4>
                          <p className="text-xs text-slate-500 mt-1">
                            You've completed {jobData.completedJobCount} jobs. Download the JobRunner app for a faster experience with notifications and GPS tracking.
                          </p>
                          <div className="flex gap-2 mt-3">
                            <a
                              href="https://apps.apple.com/au/app/jobrunner-for-tradies/id6760283858"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 bg-[#2563EB] text-white text-xs font-medium px-3 py-1.5 rounded-md"
                            >
                              App Store
                            </a>
                            <a
                              href="https://play.google.com/store/apps/details?id=com.avwebinnovation.tradietrack"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 bg-[#34A853] text-white text-xs font-medium px-3 py-1.5 rounded-md"
                            >
                              Google Play
                            </a>
                            <button
                              onClick={() => setDismissedAppBanner(true)}
                              className="text-xs text-slate-400 px-2 py-1.5"
                            >
                              Maybe later
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {currentStatus !== 'done' && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-700">Actions</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div
                        className="rounded-md border border-slate-200 bg-white p-3 text-center cursor-pointer hover-elevate"
                        onClick={() => setShowNoteInput(!showNoteInput)}
                      >
                        <StickyNote className="w-5 h-5 mx-auto mb-1 text-[#2563EB]" />
                        <span className="text-xs font-medium text-slate-700">Add Note</span>
                      </div>
                      <div
                        className="rounded-md border border-slate-200 bg-white p-3 text-center cursor-pointer hover-elevate"
                        onClick={() => setShowPhotoUpload(!showPhotoUpload)}
                      >
                        <Camera className="w-5 h-5 mx-auto mb-1 text-[#2563EB]" />
                        <span className="text-xs font-medium text-slate-700">Upload Photo</span>
                      </div>
                    </div>

                    {showNoteInput && (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Add a note..."
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          rows={3}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => { setShowNoteInput(false); setNoteText(''); }}>
                            Cancel
                          </Button>
                          <Button size="sm" className="bg-[#2563EB]" onClick={handleAddNote} disabled={isSubmitting || !noteText.trim()}>
                            Save Note
                          </Button>
                        </div>
                      </div>
                    )}

                    {showPhotoUpload && (
                      <div className="space-y-3">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={handlePhotoUpload}
                        />
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-600">Photo Category</label>
                          <select 
                            value={photoCategory} 
                            onChange={(e) => setPhotoCategory(e.target.value)}
                            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                          >
                            <option value="before">Before</option>
                            <option value="during">During</option>
                            <option value="after">After</option>
                            <option value="general">General</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-600">Caption (optional)</label>
                          <input
                            type="text"
                            placeholder="Describe this photo..."
                            value={photoCaption}
                            onChange={(e) => setPhotoCaption(e.target.value)}
                            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => { setShowPhotoUpload(false); setPhotoCaption(''); }}>
                            Cancel
                          </Button>
                          <Button 
                            size="sm" 
                            className="bg-[#2563EB]" 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingPhoto}
                          >
                            {isUploadingPhoto ? 'Uploading...' : 'Choose Photo'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {notes && notes.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">Notes</h3>
                <div className="space-y-2">
                  {notes.map((note: any, i: number) => (
                    <div key={note.id || i} className="bg-white border border-slate-200 rounded-md p-3">
                      <p className="text-sm text-slate-700">{note.content}</p>
                      <p className="text-xs text-slate-400 mt-1">{formatTime(note.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {photos && photos.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">Photos</h3>
                <div className="grid grid-cols-2 gap-2">
                  {photos.map((photo: any, i: number) => (
                    <div key={photo.id || i} className="relative rounded-md overflow-hidden border border-slate-200">
                      <img
                        src={photo.url || photo.fileUrl}
                        alt={photo.caption || 'Job photo'}
                        className="w-full h-32 object-cover"
                        loading="lazy"
                      />
                      {photo.caption && (
                        <p className="text-xs text-slate-500 p-1.5 truncate">{photo.caption}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {events && events.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">Activity</h3>
                <div className="space-y-3">
                  {events.map((event: any, i: number) => (
                    <div key={event.id || i} className="flex gap-3 items-start">
                      <div className="w-2 h-2 rounded-full bg-[#2563EB] mt-2 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{EVENT_LABELS[event.eventType] || event.eventType}</p>
                        {event.eventType === 'SUBBIE_NOTE_ADDED' && event.eventData?.content && (
                          <p className="text-xs text-slate-600 mt-0.5">"{event.eventData.content}"</p>
                        )}
                        <p className="text-xs text-slate-400">{formatTime(event.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {business?.businessPhone && (
              <div className="text-center border-t pt-6">
                <p className="text-sm text-slate-500 mb-2">Need help? Contact dispatch</p>
                <a href={`tel:${business.businessPhone}`}>
                  <Button variant="outline">
                    <Phone className="w-4 h-4 mr-2" /> Call Dispatch
                  </Button>
                </a>
              </div>
            )}
          </div>
        </div>

        <Footer />

        {sessionToken && (
          <SaveAccountSheet
            open={showSaveAccount}
            onOpenChange={setShowSaveAccount}
            token={token}
            sessionToken={sessionToken}
            businessName={jobData?.business?.companyName}
            onSaved={(mode) => {
              setAccountSaved(mode);
              setAccountStatusInfo((prev) =>
                prev ? { ...prev, alreadyLinked: true, hasAccount: true } : prev,
              );
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#2563EB]/5 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
