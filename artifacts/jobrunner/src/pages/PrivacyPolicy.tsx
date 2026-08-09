import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
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
            <h1 className="text-3xl font-bold mb-2" data-testid="heading-privacy-policy">Privacy Policy</h1>
            <p className="text-muted-foreground mb-2">Last updated: April 2026</p>
            <p className="text-sm text-muted-foreground mb-8">JobRunner is a product of LinkUp2Care Pty Ltd (ABN 34 692 409 448)</p>

            <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
              <section>
                <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
                <p className="text-muted-foreground leading-relaxed">
                  LinkUp2Care Pty Ltd (ABN 34 692 409 448) trading as JobRunner ("we", "our", or "us") is 
                  committed to protecting the privacy of Australian tradespeople and their clients. This Privacy 
                  Policy explains how we collect, use, disclose, and safeguard your information when you use our 
                  platform. We comply with the Australian Privacy Principles (APPs) contained in the Privacy Act 
                  1988 (Cth).
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">We collect information that you provide directly to us:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li><strong>Account Information:</strong> Name, email address, phone number, business name, ABN, and address when you register</li>
                  <li><strong>Business Data:</strong> Quotes, invoices, jobs, client information, and financial data you enter into the platform</li>
                  <li><strong>Payment Information:</strong> Credit card details (processed securely by Stripe), bank account details for receiving payments</li>
                  <li><strong>Communications:</strong> Messages, emails, and SMS sent through our platform, including AI Receptionist conversations</li>
                  <li><strong>Phone Numbers:</strong> Customer phone numbers provided for SMS communications and AI Receptionist interactions</li>
                  <li><strong>Usage Data:</strong> How you interact with our services, including log data and device information</li>
                  <li><strong>GPS & Location Data:</strong> When enabled, we collect GPS coordinates, accuracy metrics, speed, heading, altitude, and reverse-geocoded addresses during work hours for time tracking, geofencing, and job site verification purposes</li>
                  <li><strong>Time Tracking Data:</strong> Clock in/out times, break durations, pause events, hourly rates, and a full audit trail of any manual edits made to time entries including who made the change and when</li>
                  <li><strong>Device Information:</strong> Battery level, charging status, device type, and operating system version to support offline sync and location tracking features</li>
                  <li><strong>Photos & Images:</strong> Job site photos (including before and after images), site inspection photos, receipt scans, and signed documents you capture or upload for job documentation</li>
                  <li><strong>Audio Recordings:</strong> Voice notes you record for transcription, and AI Receptionist call recordings (when the feature is enabled)</li>
                  <li><strong>Photo Metadata:</strong> GPS location and timestamp information embedded in photos for job site and worker-presence verification</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">We use the information we collect to:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Provide, maintain, and improve our services</li>
                  <li>Process transactions and send related information (invoices, payment confirmations)</li>
                  <li>Send you technical notices, updates, and support messages</li>
                  <li>Respond to your comments, questions, and customer service requests</li>
                  <li>Generate business insights and analytics for your dashboard</li>
                  <li>Comply with Australian tax and legal obligations</li>
                  <li>Provide GPS-based geofencing for automatic job site check-in and check-out</li>
                  <li>Maintain audit trails for time entry edits to support dispute resolution and fair work compliance</li>
                  <li>Generate job profitability reports combining time tracking, material costs, and invoice data</li>
                  <li>Process and respond to incoming customer SMS enquiries through the AI Receptionist (when enabled)</li>
                  <li>Send subscription billing notifications and overdue payment reminders via SMS</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">4. Information Sharing</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">We share your information only in the following circumstances:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li><strong>With Your Clients:</strong> When you send quotes or invoices, your business details are shared with your clients</li>
                  <li><strong>Service Providers:</strong> With trusted third parties who assist in operating our platform (Stripe for payments, SendGrid for emails, Twilio for SMS, Google Cloud for data storage)</li>
                  <li><strong>Legal Requirements:</strong> If required by law, regulation, or legal process</li>
                  <li><strong>Business Transfers:</strong> In connection with any merger, sale of company assets, or acquisition</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  We do not sell your personal information to third parties.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">5. Data Security</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We implement appropriate technical and organizational measures to protect your personal 
                  information against unauthorized access, alteration, disclosure, or destruction. This includes:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                  <li>Encryption of data in transit and at rest</li>
                  <li>Secure authentication and session management</li>
                  <li>Regular security assessments and updates</li>
                  <li>Restricted access to personal information on a need-to-know basis</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">5A. Location & Time Tracking Data</h2>
                <p className="text-muted-foreground leading-relaxed">
                  GPS data is collected to enable core platform features including job scheduling, dispatch 
                  mapping, and automated timesheet verification, which reduces administrative work for users.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  We collect location data only when time tracking or geofencing features are actively enabled by you or your employer. Location tracking can be disabled at any time through your device settings or within the app. Location data is stored securely and is only accessible to the business owner and authorised managers within your organisation. We retain location tracking data for 12 months, after which it is automatically archived. Time entry edit histories are retained for the duration of your account plus 7 years to comply with Australian record-keeping requirements under the Fair Work Act 2009.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">6. Data Retention</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We retain your personal information for as long as your account is active or as needed to 
                  provide you services.
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li><strong>Active Accounts:</strong> All data is retained for the duration of your account</li>
                  <li><strong>Paused Subscriptions:</strong> All data is retained indefinitely while your subscription is paused. You can resume at any time</li>
                  <li><strong>Canceled Subscriptions:</strong> All business data (jobs, quotes, invoices, clients, team records) is retained for 12 months after cancellation. During this period, you can resubscribe to regain access. After 12 months, non-financial data may be permanently deleted</li>
                  <li><strong>Financial Records:</strong> Invoices, payment records, and related financial data are retained for 5-7 years as required by Australian tax law (Income Tax Assessment Act 1997), regardless of account status</li>
                  <li><strong>SMS and Communication Logs:</strong> SMS message logs, including AI Receptionist conversations, are retained for 24 months for quality assurance and dispute resolution</li>
                  <li><strong>Location Tracking Data:</strong> GPS data is retained for 12 months, then automatically archived</li>
                  <li><strong>Audit Trails:</strong> Time entry edit histories are retained for the duration of your account plus 7 years to comply with Fair Work Act 2009 record-keeping requirements</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  You may request deletion of your account and associated data at any time, subject to the legal 
                  retention requirements listed above. We will send you a reminder before any scheduled data deletion.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">6A. Notifiable Data Breaches</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  In accordance with the Notifiable Data Breaches (NDB) scheme under the Privacy Act 1988, 
                  if we become aware of a data breach that is likely to result in serious harm to you, we will:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Notify affected individuals as soon as practicable</li>
                  <li>Notify the Office of the Australian Information Commissioner (OAIC)</li>
                  <li>Provide recommendations about steps you can take to protect yourself</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  If you believe your data may have been compromised, please contact us immediately at 
                  admin@avwebinnovation.com.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">6B. Overseas Disclosure</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Some of our third-party service providers may process your data outside of Australia. 
                  This includes cloud infrastructure providers and payment processors. Before disclosing 
                  your personal information overseas, we take reasonable steps to ensure the overseas 
                  recipient handles your information in accordance with Australian Privacy Principles. 
                  Countries where your data may be processed include the United States (for Stripe, SendGrid, 
                  and cloud services).
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">Under Australian privacy law, you have the right to:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Access the personal information we hold about you</li>
                  <li>Request correction of inaccurate information</li>
                  <li>Request deletion of your information (subject to legal requirements)</li>
                  <li>Withdraw consent for marketing communications</li>
                  <li>Lodge a complaint with the Office of the Australian Information Commissioner (OAIC)</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  <strong>Exercising Your Rights:</strong> You can access and update most of your personal 
                  information directly through the Settings section of your JobRunner account. For any 
                  information you cannot access yourself, or to request deletion of your data, please contact 
                  our Privacy Officer at admin@avwebinnovation.com.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">7A. Employee Records Exemption</h2>
                <p className="text-muted-foreground leading-relaxed">
                  The employee records exemption under the Privacy Act 1988 does not apply to the data of our 
                  customers' employees, subcontractors, and independent contractors that we handle as part of providing our Service. This Privacy Policy 
                  applies to all personal information processed by the JobRunner platform, including the personal 
                  information of team members, employees, subcontractors, and independent contractors added to the platform by our customers.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">7B. Data of Our Customers' Clients</h2>
                <p className="text-muted-foreground leading-relaxed">
                  JobRunner processes the personal information of our customers' clients (e.g., homeowners, tenants, property managers) solely on behalf of our customers. If you are a client of a business that uses JobRunner and you wish to access, correct, or delete your personal information, please contact that business directly. If we receive such a request, we will forward it to the relevant business for them to action in accordance with their obligations under the Privacy Act 1988 (Cth).
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">8. Cookies and Tracking</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We use cookies and similar technologies to maintain your session, remember your preferences, 
                  and analyze how our services are used. You can control cookie settings through your browser, 
                  but disabling cookies may affect your ability to use some features.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">9. Third-Party Services</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">Our platform integrates with the following third-party services:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li><strong>Stripe:</strong> For secure payment processing (<a href="https://stripe.com/au/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Stripe Privacy Policy</a>)</li>
                  <li><strong>SendGrid:</strong> For email delivery (<a href="https://www.twilio.com/legal/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">SendGrid Privacy Policy</a>)</li>
                  <li><strong>Twilio:</strong> For SMS notifications (<a href="https://www.twilio.com/legal/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Twilio Privacy Policy</a>)</li>
                  <li><strong>Vapi.ai:</strong> For AI Receptionist voice call handling and transcription (<a href="https://vapi.ai/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Vapi Privacy Policy</a>)</li>
                  <li><strong>Sentry:</strong> For error tracking and performance monitoring to improve app stability (<a href="https://sentry.io/privacy/" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Sentry Privacy Policy</a>)</li>
                  <li><strong>Xero / MYOB / QuickBooks:</strong> For accounting integration when you connect your accounting software. Data shared is limited to invoices, payments, and contacts necessary for synchronisation</li>
                  <li><strong>Google Calendar / Outlook:</strong> For calendar synchronisation when you connect your calendar. Only job scheduling data is shared</li>
                  <li><strong>Apple / Google Play:</strong> For in-app purchase processing on iOS and Android devices, subject to Apple's and Google's respective privacy policies</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">9A. AI & Machine Learning</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We use OpenAI's GPT models (accessed through Replit AI Integrations) to power AI features such as quote generation, photo analysis, and business suggestions.
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>When you use AI features, relevant context (such as job descriptions, business details, or uploaded photos) may be sent to AI service providers for processing</li>
                  <li>AI service providers process this data according to their own privacy policies. We use enterprise-grade API access which does not use your data for model training</li>
                  <li>You can choose not to use AI features, and doing so will not affect your access to core platform functionality</li>
                  <li>We do not sell, share, or use your business data to train AI models</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">9B. Analytics & Performance Monitoring</h2>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>We use Google Analytics 4 (GA4) to understand how our platform is used and to improve the user experience</li>
                  <li>Analytics data collected includes page views, feature usage, device type, and general location (country/region level)</li>
                  <li>Analytics data is aggregated and does not identify you personally</li>
                  <li>You can opt out of analytics tracking through your browser settings or by using a browser extension that blocks Google Analytics</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">9C. AI Receptionist Call Recording</h2>
                <p className="text-muted-foreground leading-relaxed">
                  When the AI Receptionist feature is enabled, incoming voice calls are answered by an AI system (powered by Vapi.ai) and are recorded and transcribed for quality assurance and business purposes. An automated greeting informs callers at the start of each call that they are interacting with an AI system and that the call is being recorded. As the business owner (subscriber), you are responsible for ensuring your callers are informed of, and where required consent to, the recording of calls, in compliance with the Telecommunications (Interception and Access) Act 1979 (Cth) and applicable Australian state and territory surveillance devices legislation. Call recordings and transcripts are stored securely and retained in accordance with this Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">10. Changes to This Policy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may update this Privacy Policy from time to time. We will notify you of any material changes 
                  by posting the new policy on this page and updating the "Last updated" date. Your continued use 
                  of our services after such modifications constitutes your acknowledgment of the modified policy.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">11. Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have any questions about this Privacy Policy or our privacy practices, please contact us at:
                </p>
                <div className="mt-3 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>LinkUp2Care Pty Ltd trading as JobRunner</strong><br />
                    ABN: 34 692 409 448<br />
                    Email: admin@avwebinnovation.com<br />
                    Phone: 0458 300 051<br />
                    Website: jobrunner.com.au
                  </p>
                </div>
              </section>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            By using JobRunner, you agree to this Privacy Policy and our{" "}
            <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
