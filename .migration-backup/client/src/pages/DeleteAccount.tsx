import { ArrowLeft, AlertTriangle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";

export default function DeleteAccount() {
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
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-8 h-8 text-destructive" />
              <h1 className="text-3xl font-bold" data-testid="heading-delete-account">Delete Your Account</h1>
            </div>
            <p className="text-sm text-muted-foreground mb-8">JobRunner is a product of LinkUp2Care Pty Ltd (ABN 34 692 409 448)</p>

            <div className="space-y-6">
              <section>
                <h2 className="text-xl font-semibold mb-3">How to Delete Your Account</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  You can delete your JobRunner account and all associated data using one of the following methods:
                </p>

                <div className="space-y-4">
                  <div className="p-4 rounded-md border">
                    <h3 className="font-semibold mb-2">Option 1: Delete from the App</h3>
                    <ol className="list-decimal pl-6 text-muted-foreground space-y-2">
                      <li>Open the JobRunner app on your device</li>
                      <li>Navigate to <strong>More</strong> (bottom tab) then <strong>Settings</strong></li>
                      <li>Scroll down and tap <strong>Delete Account</strong></li>
                      <li>Confirm your decision by typing "DELETE" when prompted</li>
                      <li>Your account and all data will be permanently removed</li>
                    </ol>
                  </div>

                  <div className="p-4 rounded-md border">
                    <h3 className="font-semibold mb-2">Option 2: Request Deletion via Email</h3>
                    <p className="text-muted-foreground mb-3">
                      Send an email to our support team requesting account deletion:
                    </p>
                    <a 
                      href="mailto:admin@avwebinnovation.com?subject=Account%20Deletion%20Request" 
                      className="inline-flex items-center gap-2 text-primary hover:underline"
                    >
                      <Mail className="w-4 h-4" />
                      admin@avwebinnovation.com
                    </a>
                    <p className="text-sm text-muted-foreground mt-2">
                      Please include the email address associated with your account. We will process your request within 5 business days.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">What Data is Deleted</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  When you delete your account, the following data is permanently removed:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Your personal profile information (name, email, phone number)</li>
                  <li>All jobs, quotes, and invoices you created</li>
                  <li>Client records and contact information</li>
                  <li>Photos and documents uploaded to jobs</li>
                  <li>Team memberships and chat messages</li>
                  <li>Business settings and preferences</li>
                  <li>Location tracking history</li>
                  <li>SMS and communication history</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">Data Retention</h2>
                <p className="text-muted-foreground leading-relaxed">
                  After account deletion, all your data is permanently removed from our systems. We may retain 
                  anonymised, aggregated data that cannot be used to identify you for analytics purposes. Any 
                  financial records required to be kept for tax or legal compliance (such as payment transaction 
                  records) will be retained as required by Australian law, but all personally identifying 
                  information will be removed from these records.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">Important Notes</h2>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Account deletion is <strong>permanent and cannot be undone</strong></li>
                  <li>If you are a team owner, all team members will lose access to the team workspace</li>
                  <li>Any active subscriptions will be cancelled</li>
                  <li>Outstanding invoices or payments will not be affected by account deletion</li>
                </ul>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
