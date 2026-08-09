import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, setSessionToken } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, User, Mail, AlertCircle, CheckCircle, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AuthFormProps {
  onLogin: () => void;
}

export default function AuthForm({ onLogin }: AuthFormProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { toast } = useToast();

  // Email code authentication state
  const [loginMode, setLoginMode] = useState<'password' | 'emailCode'>('password');
  const [emailCodeStep, setEmailCodeStep] = useState<'email' | 'code'>('email');
  const [emailForCode, setEmailForCode] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [codeRetryAfter, setCodeRetryAfter] = useState(0);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup countdown interval on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Clear interval when loginMode changes away from emailCode, countdown reaches zero, or step changes
  useEffect(() => {
    if (loginMode !== 'emailCode' || codeRetryAfter === 0) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (loginMode !== 'emailCode') {
        setCodeRetryAfter(0);
      }
    }
  }, [loginMode, codeRetryAfter]);

  // Login form state
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  // Registration form state
  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    tradeType: ''
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const tradeTypes = [
    { value: 'plumbing', label: 'Plumbing' },
    { value: 'electrical', label: 'Electrical' },
    { value: 'carpentry', label: 'Carpentry' },
    { value: 'painting', label: 'Painting' },
    { value: 'roofing', label: 'Roofing' },
    { value: 'landscaping', label: 'Landscaping' },
    { value: 'tiling', label: 'Tiling' },
    { value: 'aircon', label: 'Air Conditioning' },
    { value: 'gas_fitting', label: 'Gas Fitting' },
    { value: 'building', label: 'Building/Construction' },
    { value: 'handyman', label: 'Handyman Services' },
    { value: 'other', label: 'Other' }
  ];

  const getPasswordRequirements = (password: string) => {
    return [
      { label: 'At least 8 characters', met: password.length >= 8 },
      { label: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
      { label: 'Contains special character', met: /[^A-Za-z0-9]/.test(password) },
    ];
  };

  const passwordRequirements = getPasswordRequirements(registerData.password);
  const passwordsMatch = registerData.password === registerData.confirmPassword && registerData.confirmPassword.length > 0;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await apiRequest("POST", "/api/auth/login", loginData);
      const result = await response.json();

      if (response.ok && result.success) {
        // Save session token for iOS/Safari fallback where cookies may not work
        if (result.sessionToken) {
          setSessionToken(result.sessionToken);
        }
        toast({
          title: "Login Successful",
          description: `Welcome back, ${result.user.firstName || result.user.username}!`,
        });
        onLogin();
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (error) {
      setError('Something went wrong. Check your internet connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await apiRequest("POST", "/api/auth/request-code", { email: emailForCode });
      const result = await response.json();

      if (response.status === 429) {
        // Rate limited - clear any existing interval first
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
        
        setCodeRetryAfter(result.retryAfter || 60);
        setError(result.error || 'Too many attempts. Please wait before trying again.');
        
        // Countdown timer
        countdownIntervalRef.current = setInterval(() => {
          setCodeRetryAfter((prev) => {
            if (prev <= 1) {
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else if (response.ok && result.success) {
        setSuccess('Login code sent to your email!');
        setEmailCodeStep('code');
        toast({
          title: "Code Sent",
          description: "Check your email for the 6-digit login code",
        });
      } else {
        setError(result.error || "Couldn't send the code. Check your email address and try again.");
      }
    } catch (error) {
      setError('Something went wrong. Check your internet connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await apiRequest("POST", "/api/auth/verify-code", {
        email: emailForCode,
        code: loginCode
      });
      const result = await response.json();

      if (response.ok && result.success) {
        // Save session token for iOS/Safari fallback where cookies may not work
        if (result.sessionToken) {
          setSessionToken(result.sessionToken);
        }
        
        // Reset all email code state before calling onLogin
        setLoginMode('password');
        setEmailCodeStep('email');
        setEmailForCode('');
        setLoginCode('');
        setCodeRetryAfter(0);
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        
        toast({
          title: "Login Successful",
          description: `Welcome back!`,
        });
        onLogin();
      } else {
        setError(result.error || 'That code is incorrect or expired. Check your email and try again, or request a new code.');
      }
    } catch (error) {
      setError('Something went wrong. Check your internet connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    // Validate names
    if (!registerData.firstName.trim()) {
      setError('First name is required');
      setIsLoading(false);
      return;
    }
    if (!registerData.lastName.trim()) {
      setError('Last name is required');
      setIsLoading(false);
      return;
    }

    // Validate passwords match
    if (registerData.password !== registerData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    // Terms must be accepted (AU consumer-law requirement)
    if (!acceptedTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy');
      setIsLoading(false);
      return;
    }

    // Validate password strength - all requirements must be met
    const requirements = getPasswordRequirements(registerData.password);
    const allMet = requirements.every(r => r.met);
    if (!allMet) {
      setError('Please meet all password requirements');
      setIsLoading(false);
      return;
    }

    try {
      const { confirmPassword, ...dataToSend } = registerData;
      const response = await apiRequest("POST", "/api/auth/register", dataToSend);
      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: "Registration Successful",
          description: "Please check your email to verify your account.",
        });
        
        // Redirect to verify email pending page
        const emailParam = encodeURIComponent(registerData.email);
        setLocation(`/verify-email-pending?email=${emailParam}`);
      } else {
        // If the email collides with an existing identity (account, team
        // invite, client, etc.) the server returns HTTP 409 + a stable
        // `code`. Auto-switch to the Login tab and prefill the email so the
        // user has a one-click path to sign in instead.
        const code: string | undefined = result?.code;
        if (typeof code === 'string' && code.startsWith('email_in_use_')) {
          setError(result.error);
          if (code === 'email_in_use_account') {
            setLoginData((prev) => ({ ...prev, email: registerData.email }));
            setActiveTab('login');
          }
        } else {
          setError(result.error || "Couldn't create your account. Try a different email or check your details.");
        }
      }
    } catch (error) {
      setError('Something went wrong. Check your internet connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
            <User className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">JobRunner</CardTitle>
          <CardDescription>
            Manage your tradie business with ease
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'login' | 'register')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" data-testid="tab-login">Login</TabsTrigger>
              <TabsTrigger value="register" data-testid="tab-register">Register</TabsTrigger>
            </TabsList>
            
            {/* Error/Success Messages - using min-height to prevent layout shifts */}
            <div className="min-h-[1rem] mt-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {success && (
                <Alert className="border-green-200 bg-green-50 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}
            </div>

            {/* Login Tab */}
            <TabsContent value="login" className="space-y-4 mt-4 min-h-[280px]">
              {/* Toggle between password and email code login */}
              <div className="flex items-center justify-center gap-2 text-sm">
                <Button
                  type="button"
                  variant={loginMode === 'password' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setLoginMode('password');
                    setError('');
                    setSuccess('');
                  }}
                  data-testid="button-mode-password"
                >
                  Password
                </Button>
                <Button
                  type="button"
                  variant={loginMode === 'emailCode' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setLoginMode('emailCode');
                    setEmailCodeStep('email');
                    setError('');
                    setSuccess('');
                  }}
                  data-testid="button-mode-emailcode"
                >
                  Email Code
                </Button>
              </div>

              {/* Password Login Form */}
              {loginMode === 'password' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="Enter your email"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      required
                      data-testid="input-login-email"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Enter your password"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      required
                      data-testid="input-login-password"
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                    data-testid="button-login"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Logging in...
                      </>
                    ) : (
                      <>
                        <User className="mr-2 h-4 w-4" />
                        Login
                      </>
                    )}
                  </Button>
                </form>
              )}

              {/* Email Code Login Form */}
              {loginMode === 'emailCode' && (
                <div className="space-y-4">
                  {emailCodeStep === 'email' && (
                    <form onSubmit={handleRequestCode} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email-for-code">Email Address</Label>
                        <Input
                          id="email-for-code"
                          type="email"
                          placeholder="Enter your email"
                          value={emailForCode}
                          onChange={(e) => setEmailForCode(e.target.value)}
                          required
                          data-testid="input-email-for-code"
                        />
                      </div>
                      
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={isLoading || codeRetryAfter > 0}
                        data-testid="button-request-code"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending Code...
                          </>
                        ) : codeRetryAfter > 0 ? (
                          <>
                            Wait {codeRetryAfter}s
                          </>
                        ) : (
                          <>
                            <Mail className="mr-2 h-4 w-4" />
                            Send Login Code
                          </>
                        )}
                      </Button>
                    </form>
                  )}

                  {emailCodeStep === 'code' && (
                    <div className="space-y-4">
                      <div className="text-sm text-muted-foreground text-center">
                        We sent a 6-digit code to <strong>{emailForCode}</strong>
                      </div>
                      
                      <form onSubmit={handleVerifyCode} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="login-code">6-Digit Code</Label>
                          <Input
                            id="login-code"
                            type="text"
                            placeholder="000000"
                            value={loginCode}
                            onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            required
                            maxLength={6}
                            className="text-center text-2xl tracking-widest"
                            data-testid="input-login-code"
                          />
                        </div>
                        
                        <Button 
                          type="submit" 
                          className="w-full" 
                          disabled={isLoading || loginCode.length !== 6}
                          data-testid="button-verify-code"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Verifying...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Verify & Login
                            </>
                          )}
                        </Button>
                        
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setEmailCodeStep('email');
                            setLoginCode('');
                            setError('');
                          }}
                          data-testid="button-back-to-email"
                        >
                          Use different email
                        </Button>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register" className="space-y-4 mt-4 min-h-[280px]">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-firstName">First Name</Label>
                    <Input
                      id="register-firstName"
                      placeholder="John"
                      value={registerData.firstName}
                      onChange={(e) => setRegisterData({ ...registerData, firstName: e.target.value })}
                      data-testid="input-register-firstName"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="register-lastName">Last Name</Label>
                    <Input
                      id="register-lastName"
                      placeholder="Smith"
                      value={registerData.lastName}
                      onChange={(e) => setRegisterData({ ...registerData, lastName: e.target.value })}
                      data-testid="input-register-lastName"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email *</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="john@example.com"
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    required
                    data-testid="input-register-email"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="register-tradeType">Trade Type</Label>
                  <Select onValueChange={(value) => setRegisterData({ ...registerData, tradeType: value })}>
                    <SelectTrigger data-testid="select-register-tradeType">
                      <SelectValue placeholder="Select your trade" />
                    </SelectTrigger>
                    <SelectContent>
                      {tradeTypes.map((trade) => (
                        <SelectItem key={trade.value} value={trade.value}>
                          {trade.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password *</Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="Create a strong password"
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    required
                    data-testid="input-register-password"
                  />
                  {registerData.password.length > 0 && (
                    <div className="space-y-1.5 pt-1" data-testid="password-requirements">
                      {passwordRequirements.map((req, index) => (
                        <div 
                          key={index} 
                          className={`flex items-center gap-2 text-xs ${req.met ? 'text-green-600' : 'text-muted-foreground'}`}
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
                  <Label htmlFor="register-confirmPassword">Confirm Password *</Label>
                  <Input
                    id="register-confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    value={registerData.confirmPassword}
                    onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                    required
                    data-testid="input-register-confirmPassword"
                  />
                  {registerData.confirmPassword.length > 0 && (
                    <div className={`flex items-center gap-2 text-xs pt-1 ${passwordsMatch ? 'text-green-600' : 'text-destructive'}`}>
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
                
                <div className="flex items-start gap-2 pt-1">
                  <Checkbox
                    id="register-terms"
                    checked={acceptedTerms}
                    onCheckedChange={(v) => setAcceptedTerms(v === true)}
                    data-testid="checkbox-register-terms"
                    className="mt-0.5"
                  />
                  <Label htmlFor="register-terms" className="text-xs text-muted-foreground font-normal leading-relaxed cursor-pointer">
                    I agree to the{' '}
                    <a href="/terms" className="underline text-foreground" target="_blank" rel="noopener noreferrer">Terms of Service</a>
                    {' '}and{' '}
                    <a href="/privacy" className="underline text-foreground" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
                  </Label>
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading || !acceptedTerms}
                  data-testid="button-register"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Create Account
                    </>
                  )}
                </Button>
              </form>
              
              <div className="text-center text-xs text-muted-foreground">
                By registering, you agree to receive email notifications for account verification and important updates.
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}