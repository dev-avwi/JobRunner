import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CheckCircle2, AlertCircle, Loader2, UserPlus, Shield, LogIn, ArrowRight, Lock, ChevronDown, ChevronUp, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface PermissionItem {
  id: string;
  label: string;
  granted: boolean;
}

interface PermissionCategory {
  key: string;
  label: string;
  description: string;
  permissions: PermissionItem[];
}

interface AvailablePermission {
  id: string;
  label: string;
}

interface InviteDetails {
  valid: boolean;
  error?: string;
  invite?: {
    businessName: string;
    roleName: string;
    roleDescription?: string;
    email: string;
    inviterName: string;
    firstName?: string;
    lastName?: string;
    ownerId: string;
    teamMemberId: string;
    permissions: string[];
    permissionsByCategory: PermissionCategory[];
    availableToRequest: AvailablePermission[];
  };
}

// Branded page shell — gradient backdrop, JobRunner wordmark, footer.
// Matches the premium header used across JobRunner emails and magic-link pages.
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <img src="/favicon-192.png" alt="JobRunner" className="h-9 w-9 rounded-lg" />
          <span className="text-2xl font-extrabold tracking-tight leading-none">
            <span style={{ color: "#2563EB" }}>Job</span>
            <span style={{ color: "#F59E0B" }}>Runner</span>
          </span>
        </div>
        {children}
        <p className="text-[11px] text-muted-foreground text-center mt-6">
          Powered by JobRunner &middot; Built for Australian tradies
        </p>
      </div>
    </div>
  );
}

export default function AcceptInvite() {
  const [, params] = useRoute("/accept-invite/:token");
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const token = params?.token || '';
  
  const [acceptStatus, setAcceptStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState(3);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [requestAccessOpen, setRequestAccessOpen] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [requestReason, setRequestReason] = useState('');
  const [requestingPermissions, setRequestingPermissions] = useState(false);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
  });

  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
  });

  const { data: inviteData, isLoading: validating, error: validateError } = useQuery<InviteDetails>({
    queryKey: ['/api/team/invite/validate', token],
    enabled: !!token,
  });

  useEffect(() => {
    if (inviteData?.invite) {
      setFormData(prev => ({
        ...prev,
        firstName: inviteData.invite?.firstName || '',
        lastName: inviteData.invite?.lastName || '',
      }));
    }
  }, [inviteData]);

  useEffect(() => {
    if (acceptStatus === 'success') {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            // Hard navigation so every gate (auth, business settings, active
            // workspace) re-resolves cleanly from the server after joining.
            window.location.assign('/');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [acceptStatus]);

  const handlePermissionToggle = (permissionId: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permissionId)
        ? prev.filter(id => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleRequestPermissions = async () => {
    if (selectedPermissions.length === 0 || !inviteData?.invite) return;
    
    setRequestingPermissions(true);
    try {
      const response = await apiRequest("POST", `/api/team/permission-requests`, {
        teamMemberId: inviteData.invite.teamMemberId,
        businessOwnerId: inviteData.invite.ownerId,
        requestedPermissions: selectedPermissions,
        reason: requestReason || undefined,
      });
      
      if (response.ok) {
        toast({
          title: "Request Sent",
          description: "Your permission request has been sent to the team owner for review.",
        });
        setSelectedPermissions([]);
        setRequestReason('');
        setRequestAccessOpen(false);
      } else {
        const data = await response.json();
        toast({
          title: "Request Failed",
          description: data.error || "Failed to send permission request.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Request Failed",
        description: "Failed to send permission request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRequestingPermissions(false);
    }
  };

  const handleAcceptAsExistingUser = async () => {
    setErrorMessage('');
    setAcceptStatus('loading');
    try {
      const response = await apiRequest("POST", `/api/team/invite/accept/${token}`, {});
      const data = await response.json();
      
      if (response.ok) {
        setAcceptStatus('success');
        queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
        toast({
          title: "Welcome to the team!",
          description: `You've joined ${inviteData?.invite?.businessName}`,
        });
      } else {
        setAcceptStatus('error');
        setErrorMessage(data.error || 'Failed to accept invitation');
      }
    } catch (error: any) {
      setAcceptStatus('error');
      const raw = error?.message || '';
      if (raw.startsWith('team_plan_required:')) {
        setErrorMessage(raw.replace(/^team_plan_required:\s*/, ''));
      } else {
        setErrorMessage('Failed to accept invitation. Please try again.');
      }
    }
  };

  const handleAcceptAsNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match",
        variant: "destructive",
      });
      return;
    }
    
    if (formData.password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters with one uppercase letter and one special character",
        variant: "destructive",
      });
      return;
    }
    if (!/[A-Z]/.test(formData.password) || !/[^A-Za-z0-9]/.test(formData.password)) {
      toast({
        title: "Weak password",
        description: "Password must include at least one uppercase letter and one special character",
        variant: "destructive",
      });
      return;
    }

    setErrorMessage('');
    setAcceptStatus('loading');
    try {
      const response = await apiRequest("POST", `/api/team/invite/accept/${token}`, {
        email: inviteData?.invite?.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        username: inviteData?.invite?.email?.split('@')[0] + Math.random().toString(36).substring(2, 6),
      });
      const data = await response.json();
      
      if (response.ok) {
        setAcceptStatus('success');
        queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
        toast({
          title: "Account created!",
          description: `You've joined ${inviteData?.invite?.businessName}`,
        });
      } else {
        setAcceptStatus('error');
        setErrorMessage(data.error || 'Failed to accept invitation');
      }
    } catch (error: any) {
      setAcceptStatus('error');
      const raw = error?.message || '';
      if (raw.startsWith('team_plan_required:')) {
        setErrorMessage(raw.replace(/^team_plan_required:\s*/, ''));
      } else {
        setErrorMessage('Failed to create account. Please try again.');
      }
    }
  };

  if (!token) {
    return (
      <PageShell>
        <Card>
          <CardContent className="py-10 flex flex-col items-center gap-4 text-center">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Invalid link</h1>
              <p className="text-sm text-muted-foreground mt-1">
                This invitation link is invalid or expired. Please request a new invitation from your team leader.
              </p>
            </div>
            <Button
              onClick={() => setLocation('/login')}
              className="w-full"
              data-testid="button-go-to-login"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (validating) {
    return (
      <PageShell>
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-3">
              <Loader2 className="h-7 w-7 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Verifying invitation&hellip;</p>
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (!inviteData?.valid || inviteData?.error) {
    return (
      <PageShell>
        <Card>
          <CardContent className="py-10 flex flex-col items-center gap-4 text-center">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Invitation not valid</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {inviteData?.error || 'This invitation is no longer valid. It may have already been used or expired.'}
              </p>
            </div>
            <Button
              onClick={() => setLocation('/login')}
              className="w-full"
              data-testid="button-go-to-login"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (acceptStatus === 'success') {
    return (
      <PageShell>
        <Card className="overflow-hidden">
          <div className="relative bg-gradient-to-br from-[#16a34a] to-[#15803d] px-6 pt-8 pb-7 text-center">
            <div className="pointer-events-none absolute -top-10 -left-8 h-32 w-32 rounded-full bg-white/15 blur-3xl" />
            <div className="relative">
              <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center">
                <CheckCircle2 className="h-9 w-9 text-white" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/75">You're in</p>
              <h1 className="text-2xl font-bold text-white mt-1.5 leading-tight">Welcome to the team!</h1>
              <p className="text-sm text-white/85 mt-1.5">
                You've joined {inviteData?.invite?.businessName}
              </p>
            </div>
          </div>

          <CardContent className="p-6 space-y-5">
            <div className="rounded-lg border bg-muted/40 p-4 text-center space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">What happens next</p>
              <p className="font-medium">Access to jobs, schedules, and team features</p>
              <p className="text-sm text-muted-foreground">based on your role as <span className="font-medium text-foreground">{inviteData?.invite?.roleName}</span></p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => window.location.assign('/')}
                className="w-full"
                size="lg"
                data-testid="button-go-to-dashboard"
              >
                Go to Dashboard Now
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Redirecting in {countdown}&hellip;</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const invite = inviteData.invite!;
  const isLoggedIn = !!currentUser;
  const currentEmail = (currentUser as any)?.email as string | undefined;
  const emailMismatch = isLoggedIn && !!currentEmail && !!invite.email &&
    currentEmail.toLowerCase() !== invite.email.toLowerCase();
  const hasPermissions = invite.permissionsByCategory && invite.permissionsByCategory.length > 0;
  const hasAvailableToRequest = invite.availableToRequest && invite.availableToRequest.length > 0;

  const businessInitial = (invite.businessName?.trim()?.[0] || 'J').toUpperCase();

  return (
    <PageShell>
      <Card className="overflow-hidden">
        <div className="relative bg-gradient-to-br from-[#2563EB] to-[#1E3A8A] px-6 pt-8 pb-7 text-center">
          <div className="pointer-events-none absolute -top-10 -right-8 h-32 w-32 rounded-full bg-[#F59E0B]/30 blur-3xl" />
          <div className="relative">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center">
              <span className="text-2xl font-bold text-white" data-testid="text-business-initial">{businessInitial}</span>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/75">You're invited</p>
            <h1 className="text-2xl font-bold text-white mt-1.5 leading-tight">Join {invite.businessName}</h1>
            <p className="text-sm text-white/85 mt-1.5">
              {invite.inviterName} has invited you to join the team
            </p>
          </div>
        </div>

        <CardContent className="p-6 space-y-5">
          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Your role</p>
                <p className="font-semibold">{invite.roleName}</p>
              </div>
            </div>
            {invite.roleDescription && (
              <p className="text-sm text-muted-foreground mt-3">{invite.roleDescription}</p>
            )}
          </div>

          {hasPermissions && (
            <Collapsible open={permissionsOpen} onOpenChange={setPermissionsOpen}>
              <div className="rounded-lg border">
                <CollapsibleTrigger asChild>
                  <button className="w-full p-4 flex items-center justify-between gap-3 text-left hover-elevate rounded-lg">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-primary flex-shrink-0" />
                      <div>
                        <p className="font-medium">Your Permissions</p>
                        <p className="text-xs text-muted-foreground">
                          {invite.permissions?.length || 0} permissions included with this role
                        </p>
                      </div>
                    </div>
                    {permissionsOpen ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-4">
                    <Separator />
                    {invite.permissionsByCategory.map((category) => (
                      <div key={category.key} className="space-y-2">
                        <div>
                          <p className="text-sm font-medium">{category.label}</p>
                          <p className="text-xs text-muted-foreground">{category.description}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {category.permissions.map((permission) => (
                            <Badge 
                              key={permission.id}
                              variant={permission.granted ? "default" : "secondary"}
                              className={`flex items-center gap-1.5 ${
                                permission.granted 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800' 
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {permission.granted ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <Lock className="h-3 w-3" />
                              )}
                              {permission.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {hasAvailableToRequest && (
            <Collapsible open={requestAccessOpen} onOpenChange={setRequestAccessOpen}>
              <div className="rounded-lg border">
                <CollapsibleTrigger asChild>
                  <button className="w-full p-4 flex items-center justify-between gap-3 text-left hover-elevate rounded-lg">
                    <div className="flex items-center gap-3">
                      <Send className="h-5 w-5 text-primary flex-shrink-0" />
                      <div>
                        <p className="font-medium">Request Additional Access</p>
                        <p className="text-xs text-muted-foreground">
                          Ask for more permissions if needed
                        </p>
                      </div>
                    </div>
                    {requestAccessOpen ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-4">
                    <Separator />
                    <p className="text-sm text-muted-foreground">
                      Select permissions you'd like to request. The team owner will review your request.
                    </p>
                    <div className="space-y-3">
                      {invite.availableToRequest.map((permission) => (
                        <div 
                          key={permission.id} 
                          className="flex items-center space-x-3 p-2 rounded-md hover-elevate"
                        >
                          <Checkbox
                            id={`request-${permission.id}`}
                            checked={selectedPermissions.includes(permission.id)}
                            onCheckedChange={() => handlePermissionToggle(permission.id)}
                          />
                          <Label 
                            htmlFor={`request-${permission.id}`}
                            className="flex-1 cursor-pointer text-sm"
                          >
                            {permission.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="request-reason" className="text-sm">
                        Reason (optional)
                      </Label>
                      <Textarea
                        id="request-reason"
                        placeholder="Explain why you need these permissions..."
                        value={requestReason}
                        onChange={(e) => setRequestReason(e.target.value)}
                        className="resize-none"
                        rows={3}
                      />
                    </div>
                    <Button
                      onClick={handleRequestPermissions}
                      disabled={selectedPermissions.length === 0 || requestingPermissions}
                      className="w-full"
                      size="sm"
                    >
                      {requestingPermissions ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending Request...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Send Request
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      You can still accept the invitation with your current permissions
                    </p>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {isLoggedIn ? (
            <div className="space-y-4">
              {emailMismatch && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This invite was sent to <span className="font-medium">{invite.email}</span>, but you're signed in as <span className="font-medium">{currentEmail}</span>. If you accept now, you'll join with your current account. Log out and sign in with {invite.email} if that's the account you meant to use.
                  </AlertDescription>
                </Alert>
              )}
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-2" />
                <p className="text-sm font-medium">You're signed in{currentEmail ? ` as ${currentEmail}` : ''}</p>
                <p className="text-xs text-muted-foreground">Click below to accept and join the team</p>
              </div>
              
              <Button
                onClick={handleAcceptAsExistingUser}
                disabled={acceptStatus === 'loading'}
                className="w-full"
                size="lg"
                data-testid="button-accept-invite"
              >
                {acceptStatus === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Joining team...
                  </>
                ) : (
                  <>
                    Accept Invitation &amp; Join
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Create Account &amp; Join</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Create your JobRunner account to join the team
                </p>
              </div>
              
              <form onSubmit={handleAcceptAsNewUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={invite.email}
                    disabled
                    className="bg-muted"
                    data-testid="input-email"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                      placeholder="First name"
                      required
                      data-testid="input-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                      placeholder="Last name"
                      required
                      data-testid="input-last-name"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Create a password (min 8 characters)"
                    required
                    minLength={8}
                    data-testid="input-password"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Confirm your password"
                    required
                    data-testid="input-confirm-password"
                  />
                </div>
                
                <Button
                  type="submit"
                  disabled={acceptStatus === 'loading'}
                  className="w-full"
                  size="lg"
                  data-testid="button-create-account-and-join"
                >
                  {acceptStatus === 'loading' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    <>
                      Create Account &amp; Join Team
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
              
              <div className="relative">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                  OR
                </span>
              </div>
              
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <LogIn className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Already have an account?</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sign in with your existing JobRunner account to accept this invitation
                </p>
                <Button
                  variant="outline"
                  onClick={() => setLocation(`/login?redirect=/accept-invite/${token}`)}
                  className="w-full"
                  data-testid="button-sign-in-to-accept"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In to Accept
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
