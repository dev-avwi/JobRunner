import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Eye, EyeOff, CheckCircle2, AlertCircle, Lock, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import appIconUrl from '@assets/jobrunner-logo-cropped.png';

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [mode, setMode] = useState<'request' | 'reset' | 'success'>('request');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [requestSuccess, setRequestSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setToken(urlToken);
      setMode('reset');
    }
  }, []);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await apiRequest('POST', '/api/auth/forgot-password', { email });
      const result = await response.json();

      if (result.success) {
        setRequestSuccess(true);
        toast({
          title: "Check your email",
          description: "If an account exists, you'll receive password reset instructions."
        });
      } else {
        setError(result.error || 'Failed to send reset email');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setError('Password must be at least 8 characters with one uppercase letter and one special character');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await apiRequest('POST', '/api/auth/reset-password', {
        token,
        password
      });
      const result = await response.json();

      if (result.success) {
        setMode('success');
        toast({
          title: "Password reset successful!",
          description: "You can now log in with your new password."
        });
      } else {
        setError(result.error || 'Failed to reset password');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src={appIconUrl} alt="JobRunner" className="h-8 w-auto" />
          <span className="text-xl font-bold">
            <span className="text-foreground">JobRunner</span>
          </span>
        </div>

        <Card>
          <CardHeader className="space-y-1 text-center">
            {mode === 'request' && !requestSuccess && (
              <>
                <CardTitle className="text-xl">Reset your password</CardTitle>
                <CardDescription>
                  Enter your email address and we'll send you a link to reset your password.
                </CardDescription>
              </>
            )}
            {mode === 'request' && requestSuccess && (
              <>
                <div className="mx-auto w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mb-2">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                </div>
                <CardTitle className="text-xl">Check your email</CardTitle>
                <CardDescription>
                  If an account exists with <strong>{email}</strong>, you'll receive password reset instructions.
                </CardDescription>
              </>
            )}
            {mode === 'reset' && (
              <>
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Create new password</CardTitle>
                <CardDescription>
                  Enter your new password below.
                </CardDescription>
              </>
            )}
            {mode === 'success' && (
              <>
                <div className="mx-auto w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mb-2">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                </div>
                <CardTitle className="text-xl">Password reset!</CardTitle>
                <CardDescription>
                  Your password has been successfully reset. You can now log in with your new password.
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {mode === 'request' && !requestSuccess && (
              <form onSubmit={handleRequestReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    data-testid="input-reset-email"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                  data-testid="button-send-reset"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send reset link'
                  )}
                </Button>
              </form>
            )}

            {mode === 'request' && requestSuccess && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Didn't receive the email? Check your spam folder or try again.
                </p>
                <Button 
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setRequestSuccess(false);
                    setError('');
                  }}
                  data-testid="button-try-again"
                >
                  Try again
                </Button>
              </div>
            )}

            {mode === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      data-testid="input-new-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm new password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                      data-testid="input-confirm-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                  data-testid="button-reset-password"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    'Reset password'
                  )}
                </Button>
              </form>
            )}

            {mode === 'success' && (
              <Button 
                className="w-full"
                onClick={() => setLocation('/')}
                data-testid="button-go-to-login"
              >
                Go to login
              </Button>
            )}

            <div className="mt-4 text-center">
              <Button 
                variant="ghost" 
                onClick={() => setLocation('/')}
                className="text-sm text-muted-foreground"
                data-testid="button-back-to-login"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
