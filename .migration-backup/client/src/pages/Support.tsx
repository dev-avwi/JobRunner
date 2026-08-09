import { ArrowLeft, Mail, Phone, MessageCircle, Clock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";

export default function Support() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-8">
            <h1 className="text-3xl font-bold mb-2" data-testid="heading-support">Support</h1>
            <p className="text-sm text-muted-foreground mb-8">JobRunner is a product of LinkUp2Care Pty Ltd (ABN 34 692 409 448)</p>

            <div className="space-y-6">
              <section>
                <h2 className="text-xl font-semibold mb-4">Get Help</h2>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  Our support team is here to help you get the most out of JobRunner. 
                  Reach out using any of the methods below.
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <a 
                    href="mailto:admin@avwebinnovation.com" 
                    className="flex items-start gap-3 p-4 rounded-md border hover-elevate"
                  >
                    <Mail className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <h3 className="font-semibold mb-1">Email Support</h3>
                      <p className="text-sm text-muted-foreground">admin@avwebinnovation.com</p>
                      <p className="text-xs text-muted-foreground mt-1">We aim to respond within 24 hours</p>
                    </div>
                  </a>

                  <a 
                    href="tel:+61458300051" 
                    className="flex items-start gap-3 p-4 rounded-md border hover-elevate"
                  >
                    <Phone className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <h3 className="font-semibold mb-1">Phone Support</h3>
                      <p className="text-sm text-muted-foreground">0458 300 051</p>
                      <p className="text-xs text-muted-foreground mt-1">Give us a call during business hours</p>
                    </div>
                  </a>

                  <a 
                    href="sms:+61458300051" 
                    className="flex items-start gap-3 p-4 rounded-md border hover-elevate"
                  >
                    <MessageCircle className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <h3 className="font-semibold mb-1">SMS Support</h3>
                      <p className="text-sm text-muted-foreground">0458 300 051</p>
                      <p className="text-xs text-muted-foreground mt-1">Text us your question anytime</p>
                    </div>
                  </a>

                  <div className="flex items-start gap-3 p-4 rounded-md border">
                    <Clock className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <h3 className="font-semibold mb-1">Business Hours</h3>
                      <p className="text-sm text-muted-foreground">Mon - Fri: 8am - 6pm AEST</p>
                      <p className="text-xs text-muted-foreground mt-1">AI support available 24/7</p>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">Common Topics</h2>
                <div className="space-y-3">
                  <div className="p-4 rounded-md border">
                    <h3 className="font-semibold mb-1">Getting Started</h3>
                    <p className="text-sm text-muted-foreground">
                      New to JobRunner? After signing up, start by adding your first client and creating a job. 
                      The app will guide you through setting up your business profile, team, and integrations.
                    </p>
                  </div>
                  <div className="p-4 rounded-md border">
                    <h3 className="font-semibold mb-1">Billing and Subscriptions</h3>
                    <p className="text-sm text-muted-foreground">
                      Manage your subscription from the app under More then Subscription. You can upgrade, 
                      downgrade, or cancel your plan at any time. Payment is processed securely through Stripe.
                    </p>
                  </div>
                  <div className="p-4 rounded-md border">
                    <h3 className="font-semibold mb-1">Team Management</h3>
                    <p className="text-sm text-muted-foreground">
                      Invite team members from Team Management. Each member gets their own login and can be 
                      assigned jobs, tracked on the dispatch map, and communicate via team chat.
                    </p>
                  </div>
                  <div className="p-4 rounded-md border">
                    <h3 className="font-semibold mb-1">Account Deletion</h3>
                    <p className="text-sm text-muted-foreground">
                      To delete your account and all associated data, go to Settings in the app and tap Delete Account, 
                      or visit our <a href="/delete-account" className="text-primary hover:underline">account deletion page</a>.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">Legal</h2>
                <div className="flex flex-wrap gap-4">
                  <Link href="/privacy">
                    <Button variant="outline" size="sm" className="gap-2">
                      <ExternalLink className="w-3 h-3" />
                      Privacy Policy
                    </Button>
                  </Link>
                  <Link href="/terms">
                    <Button variant="outline" size="sm" className="gap-2">
                      <ExternalLink className="w-3 h-3" />
                      Terms of Service
                    </Button>
                  </Link>
                </div>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
