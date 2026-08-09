import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Mail,
  CheckCircle,
  AlertCircle,
  Loader2,
  Send,
  Link2Off,
  Settings,
  Sparkles,
} from "lucide-react";
import { SiGmail } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface EmailIntegrationData {
  hasIntegration: boolean;
  gmailConnected: boolean;
  gmailEmail?: string;
  integration: {
    id: string;
    provider: string;
    emailAddress: string;
    displayName: string;
    status: string;
    lastUsedAt: string | null;
    lastError: string | null;
  } | null;
}

export function EmailIntegration() {
  const { toast } = useToast();
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [smtpConfig, setSmtpConfig] = useState({
    host: "",
    port: "587",
    user: "",
    password: "",
    emailAddress: "",
    displayName: "",
    secure: true,
  });

  const { data: emailIntegration, isLoading } = useQuery<EmailIntegrationData>({
    queryKey: ["/api/email-integration"],
  });

  const connectSMTP = useMutation({
    mutationFn: async (config: typeof smtpConfig) => {
      return apiRequest("POST", "/api/email-integration/connect-smtp", config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-integration"] });
      setShowConnectDialog(false);
      setSmtpConfig({
        host: "",
        port: "587",
        user: "",
        password: "",
        emailAddress: "",
        displayName: "",
        secure: true,
      });
      toast({
        title: "Email Connected",
        description: "Your business email has been connected successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect your email. Please check your settings.",
        variant: "destructive",
      });
    },
  });

  const disconnectEmail = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/email-integration/disconnect", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-integration"] });
      toast({
        title: "Email Disconnected",
        description: "Your business email has been disconnected.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Disconnect Failed",
        description: error.message || "Failed to disconnect email.",
        variant: "destructive",
      });
    },
  });

  const testConnection = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/email-integration/test", {});
    },
    onSuccess: (data: any) => {
      toast({
        title: data.success ? "Connection Verified" : "Connection Issue",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to test email connection.",
        variant: "destructive",
      });
    },
  });

  const isConnected = emailIntegration?.hasIntegration;
  const gmailConnected = emailIntegration?.gmailConnected;
  const gmailEmail = emailIntegration?.gmailEmail;
  const integration = emailIntegration?.integration;
  
  // Determine overall email status
  const hasAnyConnection = isConnected || gmailConnected;

  const handleConnect = () => {
    if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.password || !smtpConfig.emailAddress) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    connectSMTP.mutate(smtpConfig);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Email Delivery</CardTitle>
          </div>
          {hasAnyConnection ? (
            <Badge variant="outline" className="text-success border-success">
              <CheckCircle className="w-3 h-3 mr-1" />
              Your Email Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-success border-success">
              <CheckCircle className="w-3 h-3 mr-1" />
              Ready to Send
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gmail Connected via Replit Managed Connector */}
        {gmailConnected && (
          <div className="bg-success/10 p-4 rounded-lg border border-success/20">
            <div className="flex items-start gap-3">
              <SiGmail className="w-5 h-5 text-red-500 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                  <span>Gmail Connected</span>
                  <Badge variant="outline" className="text-xs">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Automatic
                  </Badge>
                </div>
                {gmailEmail ? (
                  <p className="text-sm text-muted-foreground mt-1">
                    Sending emails as: <span className="text-success font-medium">{gmailEmail}</span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    Emails will be sent via your connected Gmail account.
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Quotes and invoices will be sent from your Gmail. Replies go directly to your inbox.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SMTP Connected */}
        {isConnected && integration ? (
          <>
            <div className="bg-success/10 p-4 rounded-lg border border-success/20">
              <div className="flex items-start gap-3">
                {integration.provider === 'smtp' && integration.emailAddress?.includes('outlook') ? (
                  <Mail className="w-5 h-5 text-blue-500 mt-0.5" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-success mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">
                    Sending emails as: <span className="text-success">{integration.emailAddress}</span>
                  </p>
                  {integration.displayName && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Display name: {integration.displayName}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Connection: {integration.provider === 'smtp' ? 'SMTP Server' : integration.provider.toUpperCase()}
                  </p>
                  {integration.lastUsedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Last used: {new Date(integration.lastUsedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {integration.lastError && (
              <div className="bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <p className="text-xs text-destructive">{integration.lastError}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => testConnection.mutate()}
                disabled={testConnection.isPending}
                data-testid="button-test-email-connection"
              >
                {testConnection.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => disconnectEmail.mutate()}
                disabled={disconnectEmail.isPending}
                className="text-muted-foreground hover:text-destructive"
                data-testid="button-disconnect-email"
              >
                {disconnectEmail.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Link2Off className="w-4 h-4 mr-2" />
                    Disconnect
                  </>
                )}
              </Button>
            </div>
          </>
        ) : !gmailConnected && (
          <>
            {/* Platform Email - Always Working */}
            <div className="bg-success/10 p-4 rounded-lg border border-success/20">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-success mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-success">Emails are ready to send</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Quotes and invoices will be delivered via JobRunner. Your clients will receive professional emails with your business name.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Optional: Connect Your Own Email */}
            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>Optional: Connect your own email so replies go straight to your inbox</span>
              </p>
              
              <div className="grid grid-cols-1 gap-3">

              {/* SMTP/Outlook Option */}
              <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
                <DialogTrigger asChild>
                  <div className="p-4 border rounded-lg hover-elevate cursor-pointer" data-testid="button-connect-email">
                    <div className="flex items-center gap-3">
                      <Mail className="w-6 h-6 text-blue-500" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">Outlook / Other Email</p>
                        <p className="text-xs text-muted-foreground">Connect via SMTP settings</p>
                      </div>
                      <Settings className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Connect Your Business Email</DialogTitle>
                    <DialogDescription>
                      Enter your email server settings. Works with Gmail, Outlook, Yahoo, and other providers.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="emailAddress">Your Email Address *</Label>
                      <Input
                        id="emailAddress"
                        placeholder="you@yourbusiness.com"
                        value={smtpConfig.emailAddress}
                        onChange={(e) =>
                          setSmtpConfig((prev) => ({ ...prev, emailAddress: e.target.value }))
                        }
                        data-testid="input-email-address"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="displayName">Display Name</Label>
                      <Input
                        id="displayName"
                        placeholder="Your Business Name"
                        value={smtpConfig.displayName}
                        onChange={(e) =>
                          setSmtpConfig((prev) => ({ ...prev, displayName: e.target.value }))
                        }
                        data-testid="input-display-name"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="host">SMTP Server *</Label>
                        <Input
                          id="host"
                          placeholder="smtp.gmail.com"
                          value={smtpConfig.host}
                          onChange={(e) =>
                            setSmtpConfig((prev) => ({ ...prev, host: e.target.value }))
                          }
                          data-testid="input-smtp-host"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="port">Port *</Label>
                        <Input
                          id="port"
                          placeholder="587"
                          value={smtpConfig.port}
                          onChange={(e) =>
                            setSmtpConfig((prev) => ({ ...prev, port: e.target.value }))
                          }
                          data-testid="input-smtp-port"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="user">Username/Email *</Label>
                      <Input
                        id="user"
                        placeholder="you@yourbusiness.com"
                        value={smtpConfig.user}
                        onChange={(e) =>
                          setSmtpConfig((prev) => ({ ...prev, user: e.target.value }))
                        }
                        data-testid="input-smtp-user"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="password">Password / App Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={smtpConfig.password}
                        onChange={(e) =>
                          setSmtpConfig((prev) => ({ ...prev, password: e.target.value }))
                        }
                        data-testid="input-smtp-password"
                      />
                      <p className="text-xs text-muted-foreground">
                        For Gmail, create an App Password in your Google Account settings.
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="secure">Use TLS/SSL</Label>
                      <Switch
                        id="secure"
                        checked={smtpConfig.secure}
                        onCheckedChange={(checked) =>
                          setSmtpConfig((prev) => ({ ...prev, secure: checked }))
                        }
                        data-testid="switch-smtp-secure"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setShowConnectDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleConnect}
                      disabled={connectSMTP.isPending}
                      data-testid="button-save-email-config"
                    >
                      {connectSMTP.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        "Connect Email"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
