import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest, setSessionToken } from "@/lib/queryClient";
import { 
  Loader2, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Check, 
  X, 
  ArrowRight,
  Sparkles,
  Clock,
  FileText,
  CreditCard,
  Users,
  ChevronLeft,
  ChevronRight,
  Shield,
  Lock,
  Mail
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { trackEvent } from "@/lib/analytics";
import appIconUrl from '@assets/jobrunner-logo-cropped.png';

// App screenshots for carousel
import dashboardScreenshot from "@assets/appstore_screenshots/01_dashboard.png";
import jobsListScreenshot from "@assets/appstore_screenshots/02_jobs_list.png";
import scheduleScreenshot from "@assets/appstore_screenshots/04_schedule.png";
import quotePreviewScreenshot from "@assets/appstore_screenshots/07_quote_preview.png";

interface AuthFlowProps {
  onLoginSuccess: () => void;
  onNeedOnboarding: () => void;
}

const screenshots = [
  { src: dashboardScreenshot, title: "Your Dashboard", desc: "See your day at a glance" },
  { src: jobsListScreenshot, title: "Manage Jobs", desc: "Track every job easily" },
  { src: scheduleScreenshot, title: "Your Schedule", desc: "Know where you need to be" },
  { src: quotePreviewScreenshot, title: "Professional Quotes", desc: "Clear records, no disputes" },
];

const features = [
  { icon: FileText, text: "Keep clear records of every job" },
  { icon: Clock, text: "Track time and changes as they happen" },
  { icon: CreditCard, text: "Quote, invoice, and get paid on-site" },
  { icon: Users, text: "Know what was agreed, and when" },
];

export default function AuthFlow({ onLoginSuccess, onNeedOnboarding }: AuthFlowProps) {
  const [, setLocation] = useLocation();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [currentScreenshot, setCurrentScreenshot] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const autoRotateRef = useRef<NodeJS.Timeout | null>(null);
  const [betaStatus, setBetaStatus] = useState<{ spotsRemaining: number; businessSignups: number; maxLifetimeSpots: number } | null>(null);

  useEffect(() => {
    fetch('/api/early-access/status')
      .then(res => res.json())
      .then(data => setBetaStatus(data))
      .catch(() => {});
  }, []);
  
  // Preload all screenshot images to prevent flash/glitch during transitions
  useEffect(() => {
    screenshots.forEach(({ src }) => {
      const img = new Image();
      img.src = src;
    });
  }, []);
  
  // Check URL for mode parameter to set initial auth mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (mode === 'signup' || mode === 'register') {
      setAuthMode('register');
    } else if (mode === 'login') {
      setAuthMode('login');
    }
    // Clear any error query params on initial load
    if (params.has('error')) {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // Update URL when switching between login/register modes
  const handleModeChange = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setError('');
    setDuplicateEmail(false);
    // Update URL without page reload
    const newUrl = mode === 'login' ? '/auth' : '/auth?mode=signup';
    window.history.replaceState({}, '', newUrl);
    
    // Track signup tab click
    if (mode === 'register') {
      trackEvent('signup_started');
      trackEvent('signup_clicked', { source: 'auth_tab' });
    }
  };

  // Start/restart auto-rotate timer
  const startAutoRotate = useCallback(() => {
    if (autoRotateRef.current) {
      clearInterval(autoRotateRef.current);
    }
    autoRotateRef.current = setInterval(() => {
      setCurrentScreenshot((prev) => (prev + 1) % screenshots.length);
    }, 5000); // Slightly longer interval for smoother experience
  }, []);

  // Auto-rotate screenshots with proper cleanup
  useEffect(() => {
    startAutoRotate();
    return () => {
      if (autoRotateRef.current) {
        clearInterval(autoRotateRef.current);
      }
    };
  }, [startAutoRotate]);

  // Handle manual screenshot change - reset timer to prevent race condition
  const handleScreenshotChange = useCallback((index: number) => {
    if (isTransitioning || index === currentScreenshot) return;
    setIsTransitioning(true);
    setCurrentScreenshot(index);
    startAutoRotate(); // Reset timer on manual interaction
    // Allow next transition after animation completes
    setTimeout(() => setIsTransitioning(false), 400);
  }, [currentScreenshot, isTransitioning, startAutoRotate]);

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [appleAuthEnabled, setAppleAuthEnabled] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [duplicateEmail, setDuplicateEmail] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkAppleAuth = async () => {
      try {
        const res = await fetch('/api/auth/config');
        if (res.ok) {
          const config = await res.json();
          setAppleAuthEnabled(config.apple?.enabled === true);
        }
      } catch (err) {
        // Apple auth not available
      }
    };
    checkAppleAuth();
  }, []);

  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    username: ''
  });

  const getPasswordRequirements = (password: string) => {
    return [
      { label: 'At least 8 characters', met: password.length >= 8 },
      { label: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
      { label: 'Contains special character', met: /[^A-Za-z0-9]/.test(password) },
    ];
  };

  const passwordRequirements = getPasswordRequirements(registerData.password);
  const allRequirementsMet = passwordRequirements.every(r => r.met);
  const passwordsMatch = registerData.password === registerData.confirmPassword && registerData.confirmPassword.length > 0;

  const handleGoogleSignIn = () => {
    setIsGoogleLoading(true);
    setError('');
    trackEvent('signup_clicked', { source: 'google_oauth' });
    sessionStorage.setItem('oauth-in-progress', 'true');
    window.location.href = '/api/auth/google';
  };


  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    try {
      const configRes = await fetch('/api/auth/config');
      const config = await configRes.json();

      if (!config.apple?.enabled) {
        toast({
          variant: "destructive",
          title: "Apple Sign-In Not Available",
          description: "Apple Sign-In requires additional configuration. Please use Google or email/password instead."
        });
        return;
      }

      window.location.href = '/api/auth/apple/web';
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not connect to authentication service."
      });
    } finally {
      setAppleLoading(false);
    }
  };

  const [needsVerification, setNeedsVerification] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleResendVerification = async () => {
    setIsResending(true);
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginData.email }),
      });
      const result = await response.json();
      if (result.success) {
        toast({
          title: "Verification email sent",
          description: `Check your inbox at ${loginData.email}`
        });
      } else {
        toast({
          title: "Could not resend",
          description: result.error || "Please try again in a few minutes.",
          variant: "destructive"
        });
      }
    } catch {
      toast({
        title: "Could not resend",
        description: "Please check your connection and try again.",
        variant: "destructive"
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginData.email || !loginData.password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError('');
    setNeedsVerification(false);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData),
        credentials: 'include',
      });
      const result = await response.json();

      if (response.ok && result.success) {
        trackEvent('login_completed', { method: 'email' });
        if (result.sessionToken) {
          setSessionToken(result.sessionToken);
        }
        toast({
          title: "Welcome back!",
          description: `Signed in as ${result.user.firstName || result.user.username || result.user.email || 'your account'}`
        });
        onLoginSuccess();
        // Send the user back to wherever they were headed before being asked to
        // log in (deep link), falling back to the dashboard.
        let postLoginDest = '/';
        try {
          const saved = sessionStorage.getItem('postLoginRedirect');
          const authEntryRoutes = ['/auth', '/login', '/register', '/forgot-password'];
          if (saved && saved.startsWith('/') && !authEntryRoutes.some(r => saved.startsWith(r))) {
            postLoginDest = saved;
          }
          sessionStorage.removeItem('postLoginRedirect');
        } catch {}
        setLocation(postLoginDest);
      } else {
        const errorMsg = result.error || 'Invalid email or password.';
        if (errorMsg.toLowerCase().includes('verify') || errorMsg.toLowerCase().includes('verification')) {
          setNeedsVerification(true);
          setError('');
        } else {
          setError(errorMsg);
        }
      }
    } catch (error: any) {
      setError('Unable to sign in. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!registerData.email || !registerData.password || !registerData.firstName) {
      setError('Please fill in all required fields');
      return;
    }

    if (registerData.password !== registerData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!allRequirementsMet) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!termsAccepted) {
      setError('Please accept the Terms of Service and Privacy Policy to continue');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const username = registerData.username || registerData.email.split('@')[0];
      
      const response = await apiRequest('POST', '/api/auth/register', {
        ...registerData,
        username,
        platform: 'web'
      });
      const result = await response.json();

      if (result.success) {
        // Track successful signup
        trackEvent('signup_completed', { method: 'email' });
        trackEvent('form_submit', { form: 'signup', method: 'email' });
        
        // Registration successful - redirect to verify email pending page
        // (Session is NOT created until email is verified)
        toast({
          title: "Registration Successful",
          description: "Please check your email to verify your account."
        });
        // Redirect to verify email pending page
        const emailParam = encodeURIComponent(registerData.email);
        setLocation(`/verify-email-pending?email=${emailParam}`);
      } else {
        if (result.error?.toLowerCase().includes('already exists') ||
            result.error?.toLowerCase().includes('already registered')) {
          setDuplicateEmail(true);
          setLoginData(prev => ({ ...prev, email: registerData.email }));
          setError('');
          return;
        }
        setError(result.error || 'Registration failed');
      }
    } catch (error: any) {
      // Don't show "session_expired" error on registration page
      const errorMsg = error.message || 'Registration failed. Please try again.';
      if (!errorMsg.includes('session_expired')) {
        if (errorMsg.toLowerCase().includes('already exists') ||
            errorMsg.toLowerCase().includes('already registered')) {
          setDuplicateEmail(true);
          setLoginData(prev => ({ ...prev, email: registerData.email }));
          setError('');
          return;
        }
        setError(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex">
      {/* Left Panel - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 py-12 lg:px-16 xl:px-24">
        <div className="w-full max-w-md mx-auto">
          {/* Logo & Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <a href="/" className="inline-flex items-center gap-3 mb-8 hover:opacity-80 transition-opacity" data-testid="link-home">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center">
                <div className="w-full h-full flex items-center justify-center">
                  <img src={appIconUrl} alt="JobRunner" className="w-12 h-12 object-contain" />
                </div>
              </div>
              <span className="text-2xl font-bold">
                <span className="text-brand">Job</span>
                <span className="text-brand-accent">Runner</span>
              </span>
            </a>

            <AnimatePresence mode="wait">
              <motion.div
                key={authMode}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                  {authMode === 'login' ? 'Welcome back!' : 'Get started free'}
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  {authMode === 'login' 
                    ? 'Sign in to manage your trade business' 
                    : 'Free plan available — no credit card required.'}
                </p>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Auth Form Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="border-0 shadow-xl bg-white dark:bg-gray-900">
              <CardContent className="p-6 lg:p-8">
                {/* Mode Toggle */}
                <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-6">
                  <button
                    onClick={() => handleModeChange('login')}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-all ${
                      authMode === 'login'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                    data-testid="tab-login"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => handleModeChange('register')}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-all ${
                      authMode === 'register'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                    data-testid="tab-register"
                  >
                    Sign Up
                  </button>
                </div>

                {/* Error Alert */}
                {/* Duplicate Account Prompt */}
                <AnimatePresence>
                  {duplicateEmail && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3 mb-4">
                        <div className="flex items-start gap-3">
                          <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Account found</p>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                              <span className="font-medium">{registerData.email}</span> is already registered. Sign in to continue, or use a different email.
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => {
                              setLoginData(prev => ({ ...prev, email: registerData.email }));
                              setDuplicateEmail(false);
                              setError('');
                              handleModeChange('login');
                            }}
                            size="sm"
                            className="flex-1"
                          >
                            Sign In
                            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                          </Button>
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={handleGoogleSignIn}
                            className="flex-1"
                          >
                            <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Google
                          </Button>
                          <Button 
                            variant="ghost"
                            size="sm"
                            onClick={() => setLocation('/reset-password')}
                          >
                            Reset
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Google Sign-In Button */}
                <div className="space-y-3">
                  <Button 
                    onClick={handleGoogleSignIn}
                    disabled={isLoading || isGoogleLoading}
                    variant="outline"
                    className="w-full h-12 text-base font-medium border-2"
                    data-testid="button-google-signin"
                  >
                  {isGoogleLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                      Connecting to Google...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Continue with Google
                    </>
                  )}
                </Button>

                  {appleAuthEnabled && (
                    <Button 
                      onClick={handleAppleSignIn}
                      disabled={isLoading || appleLoading}
                      variant="outline"
                      className="w-full h-12 text-base font-medium border-2 bg-black text-white border-black dark:border-gray-700"
                      data-testid="button-apple-signin"
                    >
                      {appleLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                          Connecting to Apple...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                          </svg>
                          Continue with Apple
                        </>
                      )}
                    </Button>
                  )}

                </div>

                <p className="text-[11px] text-gray-500 dark:text-gray-500 text-center mt-2 leading-relaxed">
                  By continuing, you agree to our{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Terms of Service</a>
                  {' '}and{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Privacy Policy</a>
                </p>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-200 dark:border-gray-700" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white dark:bg-gray-900 px-3 text-gray-500 font-medium">
                      Or continue with email
                    </span>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {authMode === 'login' ? (
                    <motion.form
                      key="login-form"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                      onSubmit={handleLogin}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-gray-700 dark:text-gray-300">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={loginData.email}
                          onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="tradie@example.com"
                          disabled={isLoading}
                          className="h-11"
                          data-testid="input-login-email"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="password" className="text-gray-700 dark:text-gray-300">Password</Label>
                          <a 
                            href="/reset-password" 
                            className="text-sm text-brand-accent hover:text-brand-accent/80 font-medium"
                            data-testid="link-forgot-password"
                          >
                            Forgot password?
                          </a>
                        </div>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={loginData.password}
                            onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                            placeholder="Enter your password"
                            disabled={isLoading}
                            className="h-11 pr-10"
                            data-testid="input-login-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowPassword(!showPassword)}
                            tabIndex={-1}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-gray-400" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-400" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {needsVerification && authMode === 'login' && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <Mail className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Email not verified yet</p>
                              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                We sent a verification link to <span className="font-medium">{loginData.email}</span>. Check your inbox (and spam folder) then click the link to activate your account.
                              </p>
                            </div>
                          </div>
                          <Button 
                            type="button"
                            onClick={handleResendVerification}
                            disabled={isResending}
                            size="sm"
                            variant="outline"
                            className="w-full"
                            data-testid="button-resend-verification"
                          >
                            {isResending ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <Mail className="w-3.5 h-3.5 mr-1.5" />
                                Resend Verification Email
                              </>
                            )}
                          </Button>
                        </div>
                      )}

                      {error && authMode === 'login' && !needsVerification && (
                        <div className="flex items-center gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          <span>{error}</span>
                        </div>
                      )}

                      <Button 
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-12 text-base font-semibold bg-brand-accent text-white shadow-lg shadow-brand-accent/25"
                        data-testid="button-login"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          <>
                            Sign In
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                    </motion.form>
                  ) : (
                    <motion.form
                      key="register-form"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      onSubmit={handleRegister}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName" className="text-gray-700 dark:text-gray-300">First Name *</Label>
                          <Input
                            id="firstName"
                            value={registerData.firstName}
                            onChange={(e) => setRegisterData(prev => ({ ...prev, firstName: e.target.value }))}
                            placeholder="John"
                            disabled={isLoading}
                            className="h-11"
                            data-testid="input-first-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName" className="text-gray-700 dark:text-gray-300">Last Name</Label>
                          <Input
                            id="lastName"
                            value={registerData.lastName}
                            onChange={(e) => setRegisterData(prev => ({ ...prev, lastName: e.target.value }))}
                            placeholder="Smith"
                            disabled={isLoading}
                            className="h-11"
                            data-testid="input-last-name"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="registerEmail" className="text-gray-700 dark:text-gray-300">Email *</Label>
                        <Input
                          id="registerEmail"
                          type="email"
                          value={registerData.email}
                          onChange={(e) => setRegisterData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="tradie@example.com"
                          disabled={isLoading}
                          className="h-11"
                          data-testid="input-register-email"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="registerPassword" className="text-gray-700 dark:text-gray-300">Password *</Label>
                        <div className="relative">
                          <Input
                            id="registerPassword"
                            type={showPassword ? "text" : "password"}
                            value={registerData.password}
                            onChange={(e) => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                            placeholder="Create a strong password"
                            disabled={isLoading}
                            className="h-11 pr-10"
                            data-testid="input-register-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowPassword(!showPassword)}
                            tabIndex={-1}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-gray-400" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-400" />
                            )}
                          </Button>
                        </div>
                        {registerData.password.length > 0 && (
                          <div className="flex flex-col gap-1 pt-1" data-testid="password-requirements">
                            {passwordRequirements.map((req, index) => (
                              <div 
                                key={index} 
                                className={`flex items-center gap-1.5 text-xs ${req.met ? 'text-green-600' : 'text-gray-400'}`}
                              >
                                {req.met ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <X className="h-3 w-3" />
                                )}
                                <span>{req.label}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword" className="text-gray-700 dark:text-gray-300">Confirm Password *</Label>
                        <div className="relative">
                          <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            value={registerData.confirmPassword}
                            onChange={(e) => setRegisterData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            placeholder="Confirm your password"
                            disabled={isLoading}
                            className="h-11 pr-10"
                            data-testid="input-confirm-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            tabIndex={-1}
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4 text-gray-400" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-400" />
                            )}
                          </Button>
                        </div>
                        {registerData.confirmPassword.length > 0 && (
                          <div className={`flex items-center gap-1.5 text-xs pt-1 ${passwordsMatch ? 'text-green-600' : 'text-red-500'}`}>
                            {passwordsMatch ? (
                              <>
                                <Check className="h-3 w-3" />
                                <span>Passwords match</span>
                              </>
                            ) : (
                              <>
                                <X className="h-3 w-3" />
                                <span>Passwords don't match</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-start gap-2 mt-2">
                        <input 
                          type="checkbox" 
                          id="terms-accept"
                          checked={termsAccepted} 
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 accent-primary"
                          data-testid="checkbox-terms"
                        />
                        <label htmlFor="terms-accept" className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                          I agree to the{' '}
                          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">Terms of Service</a>
                          {' '}and{' '}
                          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">Privacy Policy</a>
                        </label>
                      </div>

                      {error && authMode === 'register' && (
                        <div className="flex items-center gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          <span>{error}</span>
                        </div>
                      )}

                      <Button 
                        type="submit"
                        disabled={isLoading || !termsAccepted}
                        className="w-full h-12 text-base font-semibold bg-brand-accent text-white shadow-lg shadow-brand-accent/25"
                        data-testid="button-register"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creating account...
                          </>
                        ) : (
                          <>
                            Create Free Account
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                    </motion.form>
                  )}
                </AnimatePresence>

                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      <span>256-bit encrypted</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      <span>SOC 2 compliant</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Footer */}
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center text-sm text-gray-500 mt-8"
          >
            Professional business management for Australian trade professionals
          </motion.p>
        </div>
      </div>

      {/* Right Panel - App Showcase (Hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-brand via-brand-dark to-brand-accent relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12">
          {/* Badge */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6"
          >
            <Sparkles className="w-4 h-4 text-yellow-300" />
            <span className="text-sm font-semibold text-white">Free for early users</span>
          </motion.div>

          {/* Title */}
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl xl:text-4xl font-bold text-white text-center mb-4"
          >
            Run your trade business
            <br />smarter, not harder.
          </motion.h2>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-white/80 text-center text-lg mb-8 max-w-md"
          >
            Join Australian trade professionals who save hours every week with JobRunner
          </motion.p>

          {/* Phone Mockup with Screenshot Carousel */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="relative"
          >
            {/* Phone Frame */}
            <div className="relative w-[260px] xl:w-[280px]">
              <div className="relative bg-gray-900 rounded-[2.5rem] p-[6px] shadow-2xl">
                {/* Dynamic Island */}
                <div className="absolute top-3 left-1/2 transform -translate-x-1/2 w-20 h-5 bg-black rounded-full z-20"></div>
                
                {/* Screen with Carousel - fixed height to prevent layout shifts */}
                <div className="relative bg-white rounded-[2.25rem] overflow-hidden" style={{ aspectRatio: '9/19.5' }}>
                  {/* Render all images, only show current one with crossfade */}
                  {screenshots.map((screenshot, index) => (
                    <img
                      key={index}
                      src={screenshot.src}
                      alt={screenshot.title}
                      className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out"
                      style={{ opacity: index === currentScreenshot ? 1 : 0 }}
                    />
                  ))}
                </div>
              </div>

              {/* Screenshot Navigation Dots */}
              <div className="flex justify-center gap-2 mt-4">
                {screenshots.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => handleScreenshotChange(index)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === currentScreenshot 
                        ? 'bg-white w-6' 
                        : 'bg-white/40 hover:bg-white/60 w-2'
                    }`}
                    data-testid={`carousel-dot-${index}`}
                    disabled={isTransitioning}
                  />
                ))}
              </div>

              {/* Screenshot Label */}
              <motion.div 
                key={currentScreenshot}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mt-4"
              >
                <p className="text-white font-semibold">{screenshots[currentScreenshot].title}</p>
                <p className="text-white/70 text-sm">{screenshots[currentScreenshot].desc}</p>
              </motion.div>
            </div>

            {/* Decorative gradient blob */}
            <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-to-br from-orange-400/30 via-transparent to-blue-400/30 rounded-full blur-3xl"></div>
          </motion.div>

          {/* Features List */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-8 grid grid-cols-2 gap-3 max-w-md"
          >
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2 text-white/90 text-sm">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-3.5 h-3.5" />
                </div>
                <span>{feature.text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
