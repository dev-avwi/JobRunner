import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";

export default function TermsOfService() {
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
            <h1 className="text-3xl font-bold mb-2" data-testid="heading-terms-of-service">Terms of Service</h1>
            <p className="text-muted-foreground mb-2">Last updated: April 2026</p>
            <p className="text-sm text-muted-foreground mb-8">JobRunner is a product of LinkUp2Care Pty Ltd (ABN 34 692 409 448)</p>

            <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
              <section>
                <h2 className="text-xl font-semibold mb-3">1. Agreement to Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  By accessing or using JobRunner ("the Service"), operated by LinkUp2Care Pty Ltd 
                  (ABN 34 692 409 448) trading as JobRunner, you agree to be bound by these Terms of Service 
                  and all applicable laws and regulations. If you do not agree with any of these terms, you are 
                  prohibited from using or accessing this Service. These Terms of Service apply to all users of 
                  the Service, including tradespeople, their employees, and their clients.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
                <p className="text-muted-foreground leading-relaxed">
                  JobRunner is a business management platform designed for Australian tradespeople. The Service 
                  provides tools for managing jobs, quotes, invoices, clients, and payments. We offer both free 
                  and paid subscription plans with varying features.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">3. Account Registration</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">To use the Service, you must:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Be at least 18 years of age</li>
                  <li>Provide accurate and complete registration information</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Promptly update any information that changes</li>
                  <li>Accept responsibility for all activities under your account</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  You are responsible for maintaining the confidentiality of your account and password and for 
                  restricting access to your computer or device.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">4. Subscription and Payments</h2>
                <p className="text-muted-foreground leading-relaxed mb-3"><strong>Free Plan:</strong></p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Unlimited quotes</li>
                  <li>25 jobs per month</li>
                  <li>25 invoices per month</li>
                  <li>50 clients</li>
                  <li>Basic features included at no cost</li>
                </ul>
                
                <p className="text-muted-foreground leading-relaxed mt-4 mb-3"><strong>Pro Plan ($49.99/month AUD):</strong></p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Unlimited jobs, quotes, and invoices</li>
                  <li>Custom branding and theming</li>
                  <li>AI-powered quote assistance and AI Assistant</li>
                  <li>Advanced reporting, insights, and analytics</li>
                  <li>Autopilot automations</li>
                </ul>

                <p className="text-muted-foreground leading-relaxed mt-4 mb-3"><strong>Team Plan ($99.99/month AUD):</strong></p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Everything in Pro, plus team management for up to 5 workers</li>
                  <li>Team member accounts with role-based permissions</li>
                  <li>Visual dispatch board and schedule management</li>
                  <li>Live GPS location tracking for field workers</li>
                  <li>Team chat and team operations centre</li>
                </ul>

                <p className="text-muted-foreground leading-relaxed mt-4 mb-3"><strong>Business Plan ($199.99/month AUD):</strong></p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Everything in Team, plus support for up to 15 workers</li>
                  <li>Priority support and advanced features</li>
                </ul>

                <p className="text-muted-foreground leading-relaxed mt-4 mb-3"><strong>Add-Ons (available on any paid plan):</strong></p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>AI Receptionist: $30/month AUD — AI-powered phone answering with dedicated Australian number</li>
                  <li>Dedicated Phone Number: $10/month AUD — Dedicated Australian SMS and voice number for your business</li>
                </ul>

                <p className="text-muted-foreground leading-relaxed mt-4">
                  <strong>Billing:</strong> Subscriptions are billed monthly in advance. All fees are quoted in 
                  Australian Dollars (AUD) and include GST where applicable. You authorize us to charge your 
                  payment method automatically each billing cycle.
                </p>

                <p className="text-muted-foreground leading-relaxed mt-3">
                  <strong>Pausing Your Subscription:</strong> You may pause your subscription at any time through 
                  your account settings. While paused, no billing occurs and your account reverts to the free plan 
                  with its associated limits. All your data is preserved and you can resume your subscription at 
                  any time to restore full access. There is no limit on how long a subscription can remain paused.
                </p>

                <p className="text-muted-foreground leading-relaxed mt-3">
                  <strong>Cancellation:</strong> You may cancel your subscription at any time through your account 
                  settings. Cancellation takes effect at the end of the current billing period. No refunds are 
                  provided for partial months. Upon cancellation, your account reverts to the free plan.
                </p>

                <p className="text-muted-foreground leading-relaxed mt-3">
                  <strong>Data Retention After Cancellation:</strong> If you cancel your subscription, all your 
                  business data (jobs, quotes, invoices, clients, team records) is retained for 12 months from the 
                  date of cancellation. During this period, you can resubscribe at any time to regain full access 
                  to your data. After 12 months, your data may be permanently deleted. Financial records required 
                  under Australian tax law are retained for the legally mandated period (5-7 years) regardless of 
                  account status. We will send you a reminder email before any data deletion occurs.
                </p>

                <p className="text-muted-foreground leading-relaxed mt-3">
                  <strong>Failed Payments:</strong> If a payment fails, we will attempt to collect payment according 
                  to Stripe's retry schedule. During this period, your account features may be restricted to free 
                  plan limits. We will send you SMS and email notifications at escalating intervals to remind you to 
                  update your payment method. If payment remains unresolved after 21 days, your subscription may be 
                  canceled automatically.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">5. Payment Processing</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  <strong>Invoice Payments:</strong> When your clients pay invoices through JobRunner, payments 
                  are processed by Stripe. A platform fee of 2.5% applies to all invoice payments, in addition to 
                  standard Stripe processing fees.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  <strong>Payouts:</strong> Funds from client payments are transferred to your connected bank 
                  account according to Stripe's standard payout schedule (typically 2-3 business days in Australia).
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">6. Invoice & Document Accuracy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  You are responsible for reviewing all quotes, invoices, and other documents generated through the platform before sending them to clients. JobRunner provides calculation tools as a convenience but does not guarantee the accuracy of rates, quantities, totals, or GST calculations. You acknowledge that all financial documents should be verified before distribution.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">7. Time Tracking Disclaimer</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Time tracking data may be affected by device performance, background app restrictions, GPS availability, battery life, and network connectivity. Recorded hours are provided as a guide and may not reflect exact working times. You are responsible for verifying all tracked time before submitting timesheets or generating invoices from time data.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">8. GPS & Location Data</h2>
                <p className="text-muted-foreground leading-relaxed">
                  GPS location data may be inaccurate or temporarily unavailable due to signal interference, indoor environments, weather conditions, or device limitations. The platform logs GPS accuracy metrics where available but does not guarantee location precision. JobRunner is not liable for disputes arising from GPS location discrepancies. Users should verify location records where accuracy is critical.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">9. Edited Records & Audit Trail</h2>
                <p className="text-muted-foreground leading-relaxed">
                  When time entries or other records are manually edited, the original values and the identity of the person who made the change are logged within the system. Users acknowledge that manual adjustments override originally tracked data and that these edit logs may be used for audit and dispute resolution purposes. Employers and employees should review edit histories when verifying timesheets.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">10. No Escrow / Payment Intermediary</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  JobRunner does not act as an escrow service, financial intermediary, or payment guarantor between you and your clients. All payment processing is handled by Stripe, a PCI-DSS compliant third-party payment processor. JobRunner does not store credit card information directly. You are responsible for following up on unpaid invoices and managing payment disputes directly with your clients.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  <strong>Stripe Connected Account Agreement:</strong> Payment processing services for users on JobRunner are provided by Stripe and are subject to the <a href="https://stripe.com/au/connect-account/legal" className="underline" target="_blank" rel="noopener noreferrer">Stripe Connected Account Agreement</a>, which includes the Stripe Terms of Service (collectively, the "Stripe Services Agreement"). By agreeing to these terms or continuing to operate as a user on JobRunner, you agree to be bound by the Stripe Services Agreement, as the same may be modified by Stripe from time to time. As a condition of JobRunner enabling payment processing services through Stripe, you agree to provide JobRunner accurate and complete information about you and your business, and you authorise JobRunner to share it and transaction information related to your use of the payment processing services provided by Stripe.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">11. User Responsibilities</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">You agree to:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Use the Service only for lawful purposes</li>
                  <li>Ensure all information you provide is accurate and current</li>
                  <li>Comply with all applicable Australian tax laws, including GST obligations</li>
                  <li>Maintain valid Australian Business Number (ABN) registration if required</li>
                  <li>Not misrepresent your qualifications, licenses, or business details</li>
                  <li>Protect confidential information of your clients</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">12. Prohibited Uses</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">You may not:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Use the Service for any illegal or unauthorized purpose</li>
                  <li>Violate any laws in your jurisdiction</li>
                  <li>Transmit viruses, malware, or other harmful code</li>
                  <li>Attempt to gain unauthorized access to the Service or its systems</li>
                  <li>Interfere with or disrupt the Service or servers</li>
                  <li>Use the Service to send spam or unsolicited communications</li>
                  <li>Impersonate another person or entity</li>
                  <li>Resell or redistribute the Service without permission</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">13. Intellectual Property</h2>
                <p className="text-muted-foreground leading-relaxed">
                  The Service and its original content, features, and functionality are owned by JobRunner and 
                  are protected by international copyright, trademark, and other intellectual property laws. You 
                  retain ownership of all content you upload to the Service, but grant us a license to use, 
                  store, and display that content for the purpose of providing the Service.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  <strong>Feedback:</strong> If you provide feedback, suggestions, or ideas about the Service, 
                  you grant LinkUp2Care Pty Ltd a perpetual, royalty-free, worldwide licence to use and implement 
                  that feedback without compensation. This does not affect your ownership of any intellectual 
                  property in your own business content.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">14. Limitation of Liability</h2>
                <p className="text-muted-foreground leading-relaxed">
                  To the maximum extent permitted by Australian Consumer Law, JobRunner shall not be liable 
                  for any indirect, incidental, special, consequential, or punitive damages, or any loss of 
                  profits or revenues, whether incurred directly or indirectly, or any loss of data, use, 
                  goodwill, or other intangible losses.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  Our total liability for any claims arising out of or relating to these terms or the Service 
                  shall not exceed the amount you paid us in the 12 months preceding the claim.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  JobRunner is not responsible for data loss resulting from user device failure, improper use, third-party service outages, or events beyond reasonable control. While we maintain regular backups and data redundancy measures, we recommend you export critical business data periodically.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  This limitation does not exclude or limit your rights under the Australian Consumer Law, 
                  including any statutory consumer guarantees that cannot be excluded by law.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">15. Disclaimer of Warranties</h2>
                <p className="text-muted-foreground leading-relaxed">
                  The Service is provided "as is" and "as available" without any warranties of any kind, either 
                  express or implied. We do not warrant that the Service will be uninterrupted, timely, secure, 
                  or error-free. You are responsible for ensuring that your use of the Service complies with 
                  all applicable laws, including tax and licensing requirements.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">16. Indemnification</h2>
                <p className="text-muted-foreground leading-relaxed">
                  You agree to indemnify, defend, and hold harmless JobRunner and its officers, directors, 
                  employees, and agents from any claims, damages, losses, liabilities, and expenses (including 
                  legal fees) arising from your use of the Service, your violation of these Terms, or your 
                  violation of any rights of another party.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">17. Termination</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may terminate or suspend your account and access to the Service immediately, without prior 
                  notice, for any reason, including breach of these Terms. Upon termination, your right to use 
                  the Service will cease immediately. All provisions of these Terms which by their nature should 
                  survive termination shall survive, including your liability for any outstanding fees owed at 
                  the time of termination.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">18. Changes to Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We reserve the right to modify these Terms at any time. We will notify you of material changes 
                  by posting the new Terms on this page and updating the "Last updated" date. Your continued use 
                  of the Service after such modifications constitutes your acceptance of the new Terms.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">19. Governing Law</h2>
                <p className="text-muted-foreground leading-relaxed">
                  These Terms shall be governed by and construed in accordance with the laws of Australia, 
                  specifically the State of Queensland. Any disputes arising from these Terms or the 
                  Service shall be subject to the exclusive jurisdiction of the courts of Queensland.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">20. Australian Consumer Law</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Nothing in these Terms excludes, restricts, or modifies any rights or remedies, or any 
                  guarantee, warranty, or other term or condition, implied or imposed by the Australian 
                  Consumer Law or any other applicable law that cannot be excluded, restricted, or modified.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  <strong>Consumer Guarantees:</strong> The Australian Consumer Law provides consumers with 
                  statutory guarantees. Our services come with guarantees that cannot be excluded under 
                  Australian Consumer Law. You are entitled to:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Services provided with due care and skill</li>
                  <li>Services fit for any specified purpose</li>
                  <li>Services provided within a reasonable time if no time is specified</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  <strong>Remedies:</strong> If we fail to comply with a consumer guarantee, you may be 
                  entitled to a remedy including having the service provided again at no cost, or a refund 
                  for services not yet provided.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  <strong>Dispute Resolution:</strong> If you have a complaint about our services, please 
                  contact us first at admin@avwebinnovation.com. We aim to resolve disputes within 14 days. 
                  If we cannot resolve the matter, you may lodge a complaint with the Australian Competition 
                  and Consumer Commission (ACCC) or your state/territory consumer protection agency.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">21. Service Availability & Disclaimers</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  <strong>Uptime:</strong> We strive to maintain 99.9% service availability but do not 
                  guarantee uninterrupted access. Scheduled maintenance will be announced in advance where 
                  possible. We are not liable for any losses arising from service unavailability.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  <strong>Third-Party Services:</strong> Our platform integrates with third-party services 
                  (Stripe, SendGrid, Twilio). We are not responsible for the availability, performance, or 
                  policies of these services. Payment processing is provided by Stripe and subject to Stripe's 
                  terms of service.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  <strong>Licensing & Insurance:</strong> You are responsible for maintaining appropriate 
                  trade licenses, certifications, and business insurance as required by Australian law. 
                  JobRunner does not verify your qualifications or provide insurance coverage.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">22. Price and Plan Changes</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may change our pricing or plan features by giving you 30 days notice via email. Continued 
                  use of the Service after the notice period constitutes acceptance of the new pricing. If you do 
                  not agree to the new pricing, you may cancel your subscription before the end of the notice period.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">23. Service Modification</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may modify, suspend, or discontinue any feature or part of the Service with reasonable notice 
                  to users. Where practicable, we will provide at least 14 days notice of material changes to 
                  Service features. This does not affect your rights under the Australian Consumer Law.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">24. AI-Generated Content Disclaimer</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  JobRunner uses artificial intelligence (including GPT-4o-mini and GPT-4o) to provide suggestions, generate quote descriptions and job summaries, analyse and categorise photos, scan receipts, detect potential safety hazards, and assist with business operations.
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>AI-generated content (including quotes, hazard detection, receipt scanning, and job summaries) is provided as a suggestion only and may contain errors, omissions, or inaccuracies. It should not be relied upon as professional, legal, financial, trade, or safety advice</li>
                  <li>Users are solely responsible for reviewing, verifying, and approving all AI-generated content before relying on or acting upon it</li>
                  <li>JobRunner does not guarantee the accuracy, completeness, or appropriateness of AI-generated content</li>
                  <li>AI features may use anonymised and aggregated data to improve service quality, but individual business data is not shared with third parties for AI training purposes</li>
                  <li>JobRunner accepts no liability for any loss, cost, or damage arising from decisions made in reliance on AI-generated content</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">24A. AI Receptionist Service</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  JobRunner offers an AI Receptionist feature that can handle incoming SMS messages on behalf 
                  of your business. By enabling this feature, you acknowledge and agree to the following:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>The AI Receptionist is designed for information collection and initial customer enquiry handling only. It does not confirm jobs, provide quotes, or make commitments on behalf of your business</li>
                  <li>All job details, quotes, and scheduling communicated by the AI Receptionist must be confirmed by you, the business owner, before any work is undertaken</li>
                  <li>The AI Receptionist may misinterpret customer messages or provide incomplete responses. You are responsible for reviewing all AI-handled conversations and following up with customers as needed</li>
                  <li>The AI Receptionist records and transcribes incoming calls. It plays an automated greeting at the start of each call informing callers that they are interacting with an AI system and that the call is being recorded and transcribed for quality and business purposes. As the subscriber, you are responsible for ensuring your callers are informed of, and where required consent to, the recording of calls, in compliance with the Telecommunications (Interception and Access) Act 1979 (Cth) and applicable Australian state and territory surveillance devices legislation</li>
                  <li>SMS messages sent and received through the AI Receptionist are stored in accordance with our Privacy Policy and may be retained for quality assurance and dispute resolution purposes</li>
                  <li>JobRunner is not liable for any miscommunication, missed enquiries, lost business, or customer disputes arising from the AI Receptionist's responses</li>
                  <li>You are responsible for ensuring that any information the AI Receptionist provides to your customers is accurate and up-to-date by maintaining current business details in your settings</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">24B. SMS & Email Communications</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  JobRunner sends automated SMS and email communications on your behalf for various purposes including 
                  booking and quote notifications, invoice and payment reminders, job updates, review requests, 
                  customer follow-ups, and subscription billing notifications. By using the Service:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>You confirm that you have obtained appropriate consent from your customers before sending them commercial electronic messages through the platform, as required by the Spam Act 2003 (Cth)</li>
                  <li>All marketing and commercial messages sent through the platform include a functional unsubscribe or opt-out mechanism, and you must honour any opt-out requests promptly</li>
                  <li>Platform billing and subscription-related messages will be sent from the "JobRunner" sender name. These are service messages and not marketing communications</li>
                  <li>Standard SMS rates from your carrier may apply to messages received from JobRunner</li>
                  <li>You agree to comply with the Spam Act 2003 (Cth) and the Do Not Call Register Act 2006 (Cth) when using SMS and email features to contact your customers</li>
                  <li>JobRunner reserves the right to suspend SMS or email functionality if we detect misuse, including sending unsolicited commercial messages</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">25. Early Access Program</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  JobRunner is currently in Early Access and features may change, be modified, or be discontinued without notice. Early Access users acknowledge that the platform may contain bugs, errors, or incomplete features.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We appreciate feedback during the Early Access period and will make reasonable efforts to address issues.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Pricing and feature access are subject to change. Founding members who are granted free or discounted access will be given reasonable notice before any pricing changes affect them.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">26. No Professional Advice</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  JobRunner is a business management tool only. Nothing in the platform — including compliance tracking, licence expiry alerts, financial reports, profitability calculations, scheduling suggestions, or any other feature — constitutes professional, legal, financial, accounting, tax, or trade advice.
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Compliance and licensing status indicators (e.g. "valid," "expiring," "expired") are based solely on the dates and information you enter. JobRunner does not independently verify the validity of any licence, certification, or insurance policy</li>
                  <li>Financial reports, profitability figures, payroll calculations, and aged receivables data are generated from the information you provide and should be verified by a qualified accountant or bookkeeper before being relied upon for business decisions or tax reporting</li>
                  <li>You should seek independent professional advice from qualified practitioners (accountants, lawyers, licensed trade advisors) for matters relating to your business, tax obligations, workplace health and safety, and regulatory compliance</li>
                  <li>JobRunner is not liable for any loss, penalty, fine, or damage arising from decisions made based on information displayed in the platform</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">26A. Safety & WHS Tools Disclaimer</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  JobRunner provides work health and safety (WHS) tools, including Safe Work Method Statement (SWMS) templates, risk matrices, worker sign-off, and AI-assisted hazard detection. These features are provided as tools only.
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>You remain solely responsible for compliance with all applicable Work Health and Safety legislation, regulations, codes of practice, and standards in your state or territory</li>
                  <li>JobRunner does not provide WHS advice and makes no warranty that any document generated using these tools meets any specific legal, regulatory, or industry standard, or is suitable for your particular work, site, or circumstances</li>
                  <li>You are responsible for reviewing, completing, and verifying all safety documents before relying on them, and for ensuring hazards are properly identified and controlled on site</li>
                  <li>AI-assisted hazard detection may miss hazards or identify them incorrectly and must not be relied upon as a substitute for a competent person's safety assessment</li>
                  <li>JobRunner is not liable for any injury, loss, penalty, or damage arising from your use of, or reliance on, the safety and WHS tools</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">27. Force Majeure</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  JobRunner shall not be liable for any failure or delay in performing its obligations under these Terms where such failure or delay results from circumstances beyond our reasonable control, including but not limited to:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Natural disasters, floods, bushfires, earthquakes, storms, or other acts of nature</li>
                  <li>Epidemics, pandemics, or public health emergencies</li>
                  <li>Cyber attacks, distributed denial-of-service (DDoS) attacks, ransomware, or other malicious activity targeting our infrastructure or third-party providers</li>
                  <li>Failures or outages of third-party services we depend on, including cloud hosting, payment processors (Stripe), email providers (SendGrid), and SMS providers (Twilio)</li>
                  <li>Government actions, sanctions, embargoes, or regulatory changes</li>
                  <li>Internet or telecommunications infrastructure failures</li>
                  <li>Power outages or utility failures</li>
                  <li>War, terrorism, civil unrest, or industrial action</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  In such events, our obligations will be suspended for the duration of the force majeure event. We will make reasonable efforts to notify affected users and restore service as soon as practicable.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">28. Data Export & Backup Responsibility</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  You are solely responsible for maintaining independent backups of your critical business data. While JobRunner implements industry-standard data redundancy and backup measures, no system is immune to data loss.
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>You should regularly export and back up your client records, quotes, invoices, job history, time tracking data, and any other business-critical information stored on the platform</li>
                  <li>JobRunner provides data export functionality to assist with this obligation. It is your responsibility to use it</li>
                  <li>In the event of data loss — whether caused by system failure, account termination, security incident, or any other reason — JobRunner's liability is limited to making reasonable efforts to restore data from our most recent available backup</li>
                  <li>JobRunner does not guarantee that all data can be recovered in every circumstance and shall not be liable for any business losses, missed deadlines, or regulatory penalties resulting from data that cannot be restored</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">29. Contact Information</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have any questions about these Terms of Service, please contact us at:
                </p>
                <div className="mt-3 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>LinkUp2Care Pty Ltd trading as JobRunner</strong><br />
                    ABN: 34 692 409 448<br />
                    Email: admin@avwebinnovation.com<br />
                    Phone: 0458 300 051
                  </p>
                </div>
              </section>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            By using JobRunner, you agree to these Terms of Service and our{" "}
            <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
