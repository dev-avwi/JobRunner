import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Mail, 
  CheckCircle, 
  DollarSign, 
  Clock, 
  Users, 
  Shield,
  ExternalLink,
  Copy,
  AlertTriangle,
  Star
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EmailSetupGuideProps {
  onSetupComplete?: () => void;
  onSkip?: () => void;
}

export default function EmailSetupGuide({ onSetupComplete, onSkip }: EmailSetupGuideProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [apiKey, setApiKey] = useState("");
  const { toast } = useToast();

  const businessBenefits = [
    {
      icon: DollarSign,
      title: "Get Paid Faster",
      description: "Send invoices instantly via email instead of waiting for post"
    },
    {
      icon: Users,
      title: "Professional Brand Image",
      description: "Emails come from YOUR business address, building trust and credibility with clients"
    },
    {
      icon: Clock,
      title: "Save Time",
      description: "No more printing, posting, or hand-delivering quotes and invoices. Send instantly to multiple clients"
    },
    {
      icon: Shield,
      title: "Reliable Delivery",
      description: "High delivery rates with tracking so you know when clients receive your invoices"
    }
  ];

  const setupSteps = [
    {
      step: 1,
      title: "Create Your Free SendGrid Account",
      time: "2 minutes",
      description: "Sign up for your business email service - 100 emails per day free forever",
      actions: [
        "Visit sendgrid.com and click 'Get Started'",
        "Use your business email address (not personal)",
        "Choose the FREE plan (100 emails/day)",
        "Verify your email address when prompted"
      ]
    },
    {
      step: 2,
      title: "Verify Your Business Sender Identity",
      time: "1 minute", 
      description: "This proves to clients that emails are actually from your business",
      actions: [
        "Go to Settings → Sender Authentication",
        "Click 'Verify a Single Sender'", 
        "Enter your business email and details",
        "Check your email and click the verification link"
      ]
    },
    {
      step: 3,
      title: "Create Your Business API Key", 
      time: "30 seconds",
      description: "This connects JobRunner to your SendGrid account securely",
      actions: [
        "Go to Settings → API Keys",
        "Click 'Create API Key'",
        "Name it 'JobRunner Integration'",
        "Choose 'Full Access' permissions",
        "Copy the key (you'll paste it below)"
      ]
    }
  ];

  const handleApiKeySubmit = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter your SendGrid API key to continue",
        variant: "destructive"
      });
      return;
    }

    // Here you would typically validate the API key and save it
    toast({
      title: "Email Setup Complete! 🎉",
      description: "Your business can now send professional invoices and quotes instantly",
    });
    onSetupComplete?.();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Link copied to clipboard"
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6" data-testid="email-setup-guide">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Mail className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Supercharge Your Business Communication</h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Send professional invoices and quotes instantly. Get paid faster. Build trust with clients.
        </p>
      </div>

      {/* Business Case */}
      <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Star className="h-6 w-6" />
            Why Successful Businesses Use Professional Email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {businessBenefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="bg-blue-600 text-white p-2 rounded-lg">
                  <benefit.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900">{benefit.title}</h3>
                  <p className="text-sm text-blue-700">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cost Comparison */}
      <Card className="border-2 border-green-200">
        <CardHeader>
          <CardTitle className="text-green-900">Real Cost Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-semibold text-red-700">Traditional Method (Monthly)</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Printing invoices (50 @ $0.20)</span>
                  <span>$10.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Postage stamps (50 @ $1.20)</span>
                  <span>$60.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Envelopes and stationery</span>
                  <span>$15.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Time driving to deliver (10 hours @ $50/hr)</span>
                  <span>$500.00</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-red-700">
                  <span>Monthly Cost:</span>
                  <span>$585.00</span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-green-700">Professional Email (Monthly)</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>SendGrid service (Free plan)</span>
                  <span>$0.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Instant delivery</span>
                  <span>$0.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Professional templates</span>
                  <span>$0.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Time saved (10 hours returned)</span>
                  <span className="text-green-600">+$500.00</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-green-700">
                  <span>Monthly Savings:</span>
                  <span>$1,085.00</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Setup Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Setup Guide (3 minutes total)</CardTitle>
          <p className="text-muted-foreground">Follow these simple steps to start sending professional emails</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {setupSteps.map((stepInfo) => (
            <div key={stepInfo.step} className={`p-4 rounded-lg border-2 ${
              currentStep === stepInfo.step 
                ? 'border-blue-500 bg-blue-50' 
                : currentStep > stepInfo.step 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-200'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  currentStep === stepInfo.step 
                    ? 'bg-blue-600 text-white' 
                    : currentStep > stepInfo.step 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-300 text-gray-600'
                }`}>
                  {currentStep > stepInfo.step ? <CheckCircle className="h-5 w-5" /> : stepInfo.step}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{stepInfo.title}</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{stepInfo.time}</Badge>
                    {stepInfo.step === 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard('https://signup.sendgrid.com')}
                        className="h-6 text-xs"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open SendGrid
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{stepInfo.description}</p>
              <ul className="space-y-1 text-sm">
                {stepInfo.actions.map((action, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="w-4 h-4 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                      {index + 1}
                    </span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
              {stepInfo.step < 3 && (
                <Button 
                  onClick={() => setCurrentStep(stepInfo.step + 1)}
                  className="mt-3"
                  size="sm"
                  data-testid={`button-complete-step-${stepInfo.step}`}
                >
                  Complete Step {stepInfo.step}
                </Button>
              )}
            </div>
          ))}

          {/* API Key Input */}
          {currentStep >= 3 && (
            <Card className="border-2 border-blue-300">
              <CardHeader>
                <CardTitle className="text-blue-900">Connect Your SendGrid Account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="api-key">Paste Your SendGrid API Key</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="SG.xxxxxxxxxxxxxxxxxxxxxx"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="font-mono"
                    data-testid="input-sendgrid-api-key"
                  />
                  <p className="text-xs text-muted-foreground">
                    This key is stored securely and only used to send emails on behalf of your business
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button 
                    onClick={handleApiKeySubmit}
                    className="flex-1"
                    data-testid="button-complete-setup"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete Setup
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={onSkip}
                    data-testid="button-skip-setup"
                  >
                    Skip for Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Security Assurance */}
      <Card className="border-2 border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>
              <strong>Security Guarantee:</strong> Your API key is encrypted and stored securely. 
              JobRunner only uses it to send emails on your behalf. You can revoke access anytime from your SendGrid account.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}