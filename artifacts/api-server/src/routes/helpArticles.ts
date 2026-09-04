/**
 * Help centre article seed data.
 * Articles are served by the /api/help/articles endpoint and can be updated
 * here without touching the database or shipping an app release.
 */

export interface HelpArticle {
  id: string;
  category: string;
  title: string;
  /** Markdown body */
  body: string;
  /** Optional web route to deep-link into */
  deeplink?: string;
  /** Optional mobile Expo-Router path */
  mobileDeeplink?: string;
  /** Short summary for list views */
  summary: string;
}

export const HELP_CATEGORIES: { id: string; label: string; icon: string }[] = [
  { id: 'getting-started', label: 'Getting Started', icon: 'play-circle' },
  { id: 'jobs', label: 'Jobs', icon: 'briefcase' },
  { id: 'quotes-invoices', label: 'Quotes & Invoices', icon: 'file-text' },
  { id: 'team', label: 'Team', icon: 'users' },
  { id: 'payments', label: 'Payments', icon: 'dollar-sign' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export const HELP_ARTICLES: HelpArticle[] = [
  // ─── Getting Started ─────────────────────────────────────────────────────────
  {
    id: 'gs-05',
    category: 'getting-started',
    title: 'How do I log in or reset my password?',
    summary: 'Sign in to your account or recover access if you forgot your password.',
    body: `## Logging In

Open the JobRunner app and enter your email address and password. Tap **Sign In**.

If you were invited by your business owner you would have set your password through the email link; use those same credentials here.

## Resetting Your Password

1. On the login screen tap **Forgot password?**
2. Enter your email address and tap **Send reset link**.
3. Check your inbox for an email from JobRunner and tap the link inside.
4. Enter and confirm a new password.

The link expires after 24 hours. If you do not see the email, check your spam folder.

## Switching Accounts

If you work for more than one business, each business sends its own invitation. Log out first (More > Settings > Log Out), then sign in with the credentials for the other account.`,
    deeplink: '/settings',
    mobileDeeplink: '/more/settings',
  },
  {
    id: 'gs-06',
    category: 'getting-started',
    title: 'How do I contact support?',
    summary: 'Get help from the JobRunner team via email or the in-app support page.',
    body: `## Contacting Support

**On the web:** Click the help icon in the top navigation bar to open the Help Centre. Use the search bar to find articles, or switch to the **Ask AI** tab for instant answers. For direct support, scroll to the bottom of the Help Centre and click **Email Support**.

**On mobile:** Go to **More > Help & Support** and scroll down to **Contact Us**. Tap **Email Support** to open a pre-addressed email, or tap **Report a Bug** to send a detailed bug report with device information automatically included.

**By email:** Send a message to admin@avwebinnovation.com. Include a description of what you were doing, what you expected to happen, and what actually happened.

**Response times:** Most queries are answered within one business day (Monday to Friday, Australian Eastern Time).

## Before You Contact Support

Check the help articles first: search for your question using the search bar at the top of the Help Centre. The Help Assistant can answer most common how-to questions instantly without waiting for a reply.`,
    deeplink: '/settings',
    mobileDeeplink: '/more/support',
  },
  {
    id: 'gs-01',
    category: 'getting-started',
    title: 'How do I create my first job?',
    summary: 'Step-by-step guide to creating your first job in JobRunner.',
    body: `## Creating Your First Job

Go to the **Jobs** page and click the **New Job** button (or tap the + button on mobile).

Fill in the required details:
- **Client** – select an existing client or type a name to create one on the fly
- **Address** – the job site location
- **Description** – a brief summary of the work

You can also add photos, notes, and schedule the job straight from the creation form.

Once saved the job appears in your Jobs list with a **Pending** status and is ready for scheduling.`,
    deeplink: '/jobs',
    mobileDeeplink: '/more/create-job',
  },
  {
    id: 'gs-02',
    category: 'getting-started',
    title: 'How do I add my first client?',
    summary: 'Add a client manually or let JobRunner create one when you make a job.',
    body: `## Adding a Client

**Option 1 – From the Clients page**\nGo to **Clients** and click **New Client**. Enter their name, phone, email, and address.

**Option 2 – During job creation**\nWhen you start a new job and type a name in the Client field, JobRunner will offer to create a new client record automatically. This is the fastest way when you are on site.

Client records store contact details, job history, notes, and assets so you can quickly reference them next time.`,
    deeplink: '/clients',
    mobileDeeplink: '/more/clients',
  },
  {
    id: 'gs-03',
    category: 'getting-started',
    title: 'How do I set up my business details?',
    summary: 'Configure your business name, ABN, and contact info that appears on documents.',
    body: `## Business Settings

Your business details appear on every quote, invoice, and receipt you send.

1. Go to **Settings** and open the **Business** tab.
2. Fill in your business name, ABN, phone, email, and address.
3. Upload your logo (PNG or JPG, minimum 200 px wide).
4. Save changes.

Your details will be reflected immediately on any new documents you generate.`,
    deeplink: '/settings',
    mobileDeeplink: '/more/settings',
  },
  {
    id: 'gs-04',
    category: 'getting-started',
    title: 'Can I customise my branding?',
    summary: 'Set a primary colour, logo, and document style for a professional look.',
    body: `## Branding Your Documents

Go to **Settings** and select the **Branding** tab.

You can customise:
- **Primary colour** – used as the accent colour on PDFs and the client portal
- **Logo** – appears in the header of all documents
- **Document style** – choose between classic, modern, and minimal layouts

Changes apply to all future documents. Already-sent PDFs are not changed.`,
    deeplink: '/settings',
    mobileDeeplink: '/more/settings',
  },

  // ─── Jobs ────────────────────────────────────────────────────────────────────
  {
    id: 'job-07',
    category: 'jobs',
    title: 'What is the difference between a Service Call and a Project?',
    summary: 'Choose the right job type for simple one-off visits vs multi-phase projects.',
    body: `## Service Call vs Project

**Service Call** is for simple, one-off jobs: a single visit, a fixed scope, one invoice. Use it for routine maintenance, emergency repairs, or any work that is done and dusted in a single trip.

**Project** is for larger jobs that span multiple visits or phases. Projects let you:
- Break work into phases (e.g. Rough-in, Fit-off, Commissioning)
- Schedule different team members for each phase
- Track costs and progress per phase
- Send progress invoices or a final invoice when everything is complete

## How to choose

When creating a job, tap **Job Type** and select either **Service Call** or **Project**.

If you start a Service Call and it grows into a multi-phase project, you can convert it from the job detail screen by tapping **...** > **Convert to Project**.`,
    deeplink: '/jobs',
    mobileDeeplink: '/jobs',
  },
  {
    id: 'job-08',
    category: 'jobs',
    title: 'How do I track materials and expenses on a job?',
    summary: 'Record parts, materials, and out-of-pocket costs against a job for accurate costing.',
    body: `## Tracking Materials and Expenses

Open a job and go to the **Costs** tab.

### Adding a material or part
Tap **Add Cost** and choose **Material**. Enter the item name, quantity, unit cost, and whether it is billable to the client.

### Adding an expense
Tap **Add Cost** and choose **Expense**. Enter a description, amount, and attach a photo of the receipt.

### Adding from your price list
If you have set up a price list (Settings > Price List), tap **Add from Price List** to pick items with pre-filled quantities and prices.

### Using costs on invoices
When you create an invoice from the job, all billable costs are automatically included as line items. You can remove or adjust any item before sending.

### Reports
Job costs appear in the **Job Report** and in the **Expenses** section of your financial reports.`,
    deeplink: '/jobs',
    mobileDeeplink: '/jobs',
  },
  {
    id: 'job-01',
    category: 'jobs',
    title: 'What do the job statuses mean?',
    summary: 'Learn what Pending, Scheduled, In Progress, Done, and Invoiced mean.',
    body: `## Job Status Reference

| Status | Meaning |
|---|---|
| **Pending** | Job created but not yet scheduled |
| **Scheduled** | Date and time confirmed |
| **In Progress** | Work has started |
| **Done** | Work completed, not yet invoiced |
| **Invoiced** | Invoice sent to the client |
| **Paid** | Payment received in full |

You can move a job to any status by opening it and tapping the status badge, or by swiping left on the job card in the list view.`,
    deeplink: '/jobs',
    mobileDeeplink: '/jobs',
  },
  {
    id: 'job-02',
    category: 'jobs',
    title: 'How do I schedule a job?',
    summary: 'Set a date and time for a job, or drag it on the calendar.',
    body: `## Scheduling a Job

**From the job detail:**\nOpen a job and tap **Schedule**. Pick a date, start time, and estimated duration.

**From the calendar:**\nSwitch to the **Calendar** view and drag an unscheduled job from the side panel onto a time slot.

**From Dispatch:**\nUse the **Dispatch Board** for team-wide scheduling. You can assign the job to a team member and set the time in one step.

Once scheduled, the assigned worker receives a push notification.`,
    deeplink: '/calendar',
    mobileDeeplink: '/more/schedule',
  },
  {
    id: 'job-03',
    category: 'jobs',
    title: 'How do I add photos to a job?',
    summary: 'Attach before and after photos to document your work.',
    body: `## Adding Job Photos

Open the job and tap the **Photos** tab (or camera icon).

You can:
- Take a new photo using your camera
- Choose from your gallery
- Label photos as **Before**, **After**, or **Progress**

Photos are stored securely and can be shared with clients via the client portal or included in completion reports.

**Tip:** Before-and-after pairs are automatically grouped together in reports.`,
    deeplink: '/jobs',
    mobileDeeplink: '/jobs',
  },
  {
    id: 'job-04',
    category: 'jobs',
    title: 'How do I mark a job as complete?',
    summary: 'Complete a job and optionally collect a client signature.',
    body: `## Completing a Job

Open the job and tap **Mark Complete**.

You can add:
- Completion notes describing the work done
- Final photos
- Client signature (drawn on-screen, saved as an image)

Once complete the job status changes to **Done** and you are prompted to create an invoice if one does not already exist.`,
    deeplink: '/jobs',
    mobileDeeplink: '/jobs',
  },
  {
    id: 'job-05',
    category: 'jobs',
    title: 'How do I assign a job to a team member?',
    summary: 'Assign workers to jobs so they see the work in their own dashboard.',
    body: `## Assigning Jobs

When creating or editing a job, open the **Assign to** field and select one or more team members.

The assigned workers will:
- Receive a push notification
- See the job in their **My Work** view
- Be able to update job status, add photos, and log time

You can also bulk-assign jobs from the **Dispatch Board** by dragging job cards onto a team member's column.`,
    deeplink: '/dispatch',
    mobileDeeplink: '/jobs',
  },
  {
    id: 'job-06',
    category: 'jobs',
    title: 'How do I track time on a job?',
    summary: 'Log hours for payroll and billing directly from the job.',
    body: `## Time Tracking

Open a job and go to the **Time** tab.

Tap **Start Timer** to begin tracking live, or tap **Add Entry** to log time manually with a start time, end time, and notes.

Time entries are used:
- In **Payroll Reports** to calculate wages
- In **Job Reports** to show labour costs
- Optionally on invoices as billable hours

Workers can also start and stop the timer from their mobile app when on site.`,
    deeplink: '/jobs',
    mobileDeeplink: '/jobs',
  },

  // ─── Quotes & Invoices ───────────────────────────────────────────────────────
  {
    id: 'qi-06',
    category: 'quotes-invoices',
    title: 'How do I add a variation to a quote or job?',
    summary: 'Capture extra scope or change orders and get client approval before doing the work.',
    body: `## Raising a Variation

A variation covers work that was not in the original quote: extra scope, change of materials, unforeseen conditions, or client-requested additions.

### From a job
1. Open the job and tap the **Docs** tab.
2. Tap **New Variation**.
3. Describe the change and add any line items with quantities and prices.
4. Send it to the client for approval, or mark it as verbally approved if they agreed on site.

### From a quote
1. Open the quote and tap **Add Variation**.
2. Enter the variation details and send for review.

### After approval
Once the client approves the variation (online or manually), the amounts are added to the job total and will appear on the final invoice automatically.

### Tracking variations
All variations appear under the **Docs** tab of the job so you always have a clear change-order trail.`,
    deeplink: '/jobs',
    mobileDeeplink: '/jobs',
  },
  {
    id: 'qi-01',
    category: 'quotes-invoices',
    title: 'How do I create and send a quote?',
    summary: 'Build a professional quote with line items and send it to your client.',
    body: `## Creating a Quote

1. Go to **Quotes** and click **New Quote**.
2. Select the client (or create one inline).
3. Add line items: description, quantity, unit price, and tax setting.
4. Set an expiry date and any deposit requirement.
5. Preview the PDF to check how it looks.
6. Click **Send** to email the quote directly to the client.

The client receives a branded PDF with a link to view and accept or decline online.`,
    deeplink: '/quotes',
    mobileDeeplink: '/more/quote/new',
  },
  {
    id: 'qi-02',
    category: 'quotes-invoices',
    title: 'How do I convert a quote to an invoice?',
    summary: 'Turn an accepted quote into a ready-to-send invoice with one tap.',
    body: `## Converting a Quote

Once a quote is accepted (by the client online or manually marked as accepted), open the quote and click **Convert to Invoice**.

All line items, client details, and totals are copied over. You can adjust the invoice before sending.

If the quote had a deposit, the deposit amount is automatically shown as a credit on the invoice.`,
    deeplink: '/quotes',
    mobileDeeplink: '/more/quote/new',
  },
  {
    id: 'qi-03',
    category: 'quotes-invoices',
    title: 'How do I create and send an invoice?',
    summary: 'Generate a professional invoice and email it to your client.',
    body: `## Creating an Invoice

1. Go to **Invoices** and click **New Invoice**.
2. Select the client and optionally link to a job.
3. Add line items with descriptions, quantities, and prices.
4. Set payment terms (e.g. 14 days, 30 days, or a specific due date).
5. Click **Send** to email the invoice.

The client receives a branded PDF with online payment options if Stripe is connected.`,
    deeplink: '/invoices',
    mobileDeeplink: '/more/invoice/new',
  },
  {
    id: 'qi-04',
    category: 'quotes-invoices',
    title: 'How do I handle overdue invoices?',
    summary: 'Send manual reminders or set up automated overdue notifications.',
    body: `## Managing Overdue Invoices

**Manual reminder:**\nOpen the invoice and click **Send Reminder**. A follow-up email is sent to the client with the invoice attached.

**Automatic reminders:**\nGo to **Settings > Automations** and enable **Overdue Invoice Reminders**. You can set how many days after the due date the first reminder fires, and whether a follow-up is sent.

**Filtering overdue invoices:**\nOn the Invoices page, use the **Overdue** filter to see all invoices past their due date.`,
    deeplink: '/invoices',
    mobileDeeplink: '/more/invoice/new',
  },
  {
    id: 'qi-05',
    category: 'quotes-invoices',
    title: 'Can I request a deposit on a quote?',
    summary: 'Collect a deposit when a client accepts a quote.',
    body: `## Quote Deposits

When creating a quote, scroll to the **Deposit** section and enter either a percentage (e.g. 20%) or a fixed dollar amount.

When the client accepts the quote online they are prompted to pay the deposit immediately (if Stripe is connected). The deposit appears as a credit when you convert to an invoice.

If you collect the deposit offline, record it manually on the converted invoice using **Record Payment**.`,
    deeplink: '/quotes',
    mobileDeeplink: '/more/quote/new',
  },

  // ─── Team ────────────────────────────────────────────────────────────────────
  {
    id: 'team-05',
    category: 'team',
    title: 'How do I view and run payroll?',
    summary: 'See labour hours and costs per team member, then export for your payroll system.',
    body: `## Payroll Reports

Go to **Reports > Payroll**.

The payroll report shows, for each team member:
- Total hours worked in the selected period
- Hours by job or phase
- Calculated pay (if you have set hourly rates in their profile)
- Any allowances or penalties

### Setting hourly rates
Go to **Settings > Team**, open a team member's profile, and enter their hourly rate. You can set a standard rate and a separate overtime rate.

### Exporting for payroll
Click **Export CSV** to download a spreadsheet formatted for most payroll providers. You can also export a summary PDF to keep on file.

### Filtering
Use the date range picker to select the pay period (weekly, fortnightly, or custom). Filter by team member or job type.

### Time entry approval
Admins and managers can review and approve time entries before running payroll from the **Time Entries** section.`,
    deeplink: '/reports',
    mobileDeeplink: '/more/reports',
  },
  {
    id: 'team-06',
    category: 'team',
    title: 'How do I manage subcontractors?',
    summary: 'Invite subbies, assign them to jobs, and track their invoices in one place.',
    body: `## Working with Subcontractors

### Inviting a subcontractor
Go to **Settings > Team** and invite them with the **Subcontractor** role. They get their own login and can view their assigned jobs, upload photos, and log time, but cannot see your other business data.

### Assigning a subcontractor to a job
Open the job and add them in the **Assign to** field just like a regular team member. They will receive a push notification.

### Tracking subcontractor invoices
Open a job and go to the **Costs** tab. Tap **Add Subcontractor Invoice** to record what you owe them. These costs appear in job costing reports so you can see your margin.

### Compliance and documents
You can store subcontractor licences, insurance certificates, and SWMS documents in their team profile under **Documents**. JobRunner can alert you when a document is close to expiry.`,
    deeplink: '/settings',
    mobileDeeplink: '/more/team-management',
  },
  {
    id: 'team-01',
    category: 'team',
    title: 'How do I invite a team member?',
    summary: 'Send an invitation to a worker, office admin, or subcontractor.',
    body: `## Inviting Team Members

1. Go to **Settings > Team** (or **Team Management** on mobile).
2. Click **Invite Member**.
3. Enter their email address and select their role.
4. Click **Send Invite**.

They will receive an email with a link to create their account and join your team. Once they accept, they appear in your team list and can log in on the mobile app.`,
    deeplink: '/settings',
    mobileDeeplink: '/more/team-management',
  },
  {
    id: 'team-02',
    category: 'team',
    title: 'What are the different team roles?',
    summary: 'Understand the access levels for Admin, Tradesperson, and Office Staff.',
    body: `## Team Roles

| Role | Access |
|---|---|
| **Admin** | Full access to all features, settings, and billing |
| **Manager** | Manage jobs, team, quotes, and invoices but not billing |
| **Tradesperson** | View and update their assigned jobs, log time and photos |
| **Office Staff** | Create quotes and invoices, view reports, manage clients |

You can customise individual permissions on any role from **Settings > Team > Roles**.`,
    deeplink: '/settings',
    mobileDeeplink: '/more/team-management',
  },
  {
    id: 'team-03',
    category: 'team',
    title: 'How do I track where my team is?',
    summary: 'See your workers live on the map and monitor their check-ins.',
    body: `## Team Location Tracking

Open the **Job Map** from the header. You will see:
- Live location pins for all workers who have location sharing enabled
- Job site pins colour-coded by status
- A worker list on the left with their current status

Workers must enable location sharing in their app settings. Tracking only runs during scheduled work hours unless the worker is actively on a job.

You can also see arrival and departure events in the **Activity Feed**.`,
    deeplink: '/map',
    mobileDeeplink: '/map',
  },
  {
    id: 'team-04',
    category: 'team',
    title: 'How does the dispatch board work?',
    summary: 'Schedule and assign multiple jobs across your team in a drag-and-drop view.',
    body: `## Dispatch Board

Go to **Dispatch** from the main navigation.

The board shows:
- Your team members as columns
- Unassigned jobs in a panel on the left
- Scheduled jobs as cards in each person's column

**To assign a job:** Drag it from the unassigned panel onto a team member's column.

**To reschedule:** Drag the card to a different time slot or a different day.

**To view job detail:** Click any job card.`,
    deeplink: '/dispatch',
    mobileDeeplink: '/more/dispatch-board',
  },

  // ─── Payments ────────────────────────────────────────────────────────────────
  {
    id: 'pay-06',
    category: 'payments',
    title: 'How do I issue a refund to a client?',
    summary: 'Refund all or part of a payment made through Stripe or recorded manually.',
    body: `## Issuing a Refund

### Stripe payments (online)
1. Open the paid invoice.
2. Tap **...** > **Issue Refund**.
3. Enter the amount to refund (full or partial) and an optional reason.
4. Tap **Confirm Refund**.

The refund is processed through Stripe and typically reaches the client's card within 5 to 10 business days. A refund record is added to the invoice automatically.

### Manually recorded payments
For cash, bank transfer, or cheque payments you recorded manually, you cannot process a refund through JobRunner. You will need to return the money directly to the client and then:
1. Open the invoice.
2. Tap **Record Refund** to log the amount and method.
3. The invoice balance is updated accordingly.

### Partial refunds
Both Stripe and manual refunds support partial amounts. The invoice status changes to **Partially Refunded** and the remaining balance is shown.`,
    deeplink: '/invoices',
    mobileDeeplink: '/more/invoice/new',
  },
  {
    id: 'pay-01',
    category: 'payments',
    title: 'How do I connect Stripe for online payments?',
    summary: 'Accept credit card payments from clients by connecting a Stripe account.',
    body: `## Setting Up Stripe

1. Go to **Settings > Payments**.
2. Click **Connect Stripe**.
3. You will be redirected to Stripe to create or connect an existing account.
4. Complete the Stripe onboarding (takes about 5 minutes).
5. Return to JobRunner; your account will be linked automatically.

Once connected, clients can pay invoices and quote deposits online with any major credit card.

**Note:** Stripe charges a processing fee (typically 1.7% + 30c for Australian cards). This fee is taken from the payment before it reaches your bank.`,
    deeplink: '/settings',
    mobileDeeplink: '/more/settings',
  },
  {
    id: 'pay-02',
    category: 'payments',
    title: 'How do I record a cash or bank transfer payment?',
    summary: 'Mark an invoice as paid when the client pays outside the app.',
    body: `## Recording a Manual Payment

Open the invoice and click **Record Payment**.

Enter:
- Amount received
- Date of payment
- Payment method (cash, bank transfer, cheque, other)
- Reference number (optional)

The invoice status updates to **Paid** (or **Partially Paid** if the amount is less than the total).

The payment appears in your financial reports automatically.`,
    deeplink: '/invoices',
    mobileDeeplink: '/more/invoice/new',
  },
  {
    id: 'pay-03',
    category: 'payments',
    title: 'How do I send a payment link to a client?',
    summary: 'Share a secure payment link so clients can pay any time.',
    body: `## Payment Links

Open a sent invoice and click **Copy Payment Link** or **Send Payment Link**.

The link takes the client to a secure page where they can pay by card using Stripe. No login required.

Payment links are valid until the invoice is paid or cancelled. You can resend the link any time from the invoice detail page.

**Requires:** Stripe must be connected (Settings > Payments).`,
    deeplink: '/invoices',
    mobileDeeplink: '/more/invoice/new',
  },
  {
    id: 'pay-04',
    category: 'payments',
    title: 'How do I view my revenue and payment reports?',
    summary: 'See revenue trends, outstanding balances, and payment history.',
    body: `## Financial Reports

Go to **Reports** from the main navigation.

Available reports:
- **Revenue Overview** – monthly and yearly totals with charts
- **Outstanding Invoices** – all unpaid and overdue amounts
- **Payment History** – all received payments with dates and methods
- **Expenses** – costs recorded against jobs and categories
- **Payroll** – labour costs by team member

You can filter all reports by date range and export to CSV for your accountant.`,
    deeplink: '/reports',
    mobileDeeplink: '/more/reports',
  },

  // ─── Settings ────────────────────────────────────────────────────────────────
  {
    id: 'set-06',
    category: 'settings',
    title: 'How do I manage my subscription and billing?',
    summary: 'View your plan, update payment details, or cancel your subscription.',
    body: `## Subscription and Billing

Go to **Settings > Subscription** (web) or **More > Settings > Subscription** (mobile).

### Viewing your plan
The subscription page shows your current plan, next billing date, and the features included.

### Upgrading or downgrading
Tap **Change Plan** to see available plans. Upgrades take effect immediately and you are charged a prorated amount. Downgrades take effect at the end of your current billing period.

### Updating payment details
Tap **Update Payment Method** to change the card on file. JobRunner uses Stripe for secure payment processing; your card details are never stored on our servers.

### Cancelling
Tap **Cancel Subscription** at the bottom of the subscription page. Your account remains active until the end of the paid period, after which it switches to read-only mode. Your data is retained for 90 days.

### Receipts and invoices
Billing receipts are emailed to your account email address after each charge. You can also download past receipts from the subscription page.`,
    deeplink: '/settings',
    mobileDeeplink: '/more/settings',
  },
  {
    id: 'set-01',
    category: 'settings',
    title: 'How do I connect my accounting software?',
    summary: 'Sync invoices and payments with Xero or QuickBooks.',
    body: `## Accounting Integrations

Go to **Settings > Integrations**.

JobRunner supports:
- **Xero** – two-way sync of invoices, contacts, and payments
- **QuickBooks** – push invoices and record payments automatically

**To connect:**
1. Click **Connect** next to your accounting software.
2. Log in with your Xero or QuickBooks credentials.
3. Authorise the connection.

Once connected, invoices you mark as sent are automatically pushed. You can also sync historical invoices from the integration settings.`,
    deeplink: '/integrations',
    mobileDeeplink: '/more/settings',
  },
  {
    id: 'set-02',
    category: 'settings',
    title: 'How do I set up email notifications?',
    summary: 'Control which email notifications go to you and your team.',
    body: `## Notification Settings

Go to **Settings > Notifications**.

You can control when emails are sent for:
- New job assignments
- Quote accepted or declined
- Invoice paid
- Overdue invoice reminders
- New client message
- Team member activity

Each notification can be enabled or disabled independently. Workers can also manage their own notification preferences from the mobile app.`,
    deeplink: '/settings',
    mobileDeeplink: '/more/settings',
  },
  {
    id: 'set-03',
    category: 'settings',
    title: 'How do I set up automated reminders?',
    summary: 'Automate follow-up emails for quotes, invoices, and job reminders.',
    body: `## Automations

Go to **Settings > Automations**.

Available automations:
- **Quote expiry reminders** – remind clients before a quote expires
- **Overdue invoice reminders** – follow up on unpaid invoices automatically
- **Job confirmation** – send clients a confirmation when a job is scheduled
- **Completion follow-up** – ask for a review after a job is marked complete

Each automation lets you customise the timing (e.g. "3 days before due date") and the email template.`,
    deeplink: '/settings',
    mobileDeeplink: '/more/settings',
  },
  {
    id: 'pay-05',
    category: 'payments',
    title: 'How do I use Tap to Pay on iPhone?',
    summary: 'Accept contactless cards and Apple Pay without any extra hardware.',
    body: `## Tap to Pay on iPhone

Tap to Pay on iPhone lets you accept contactless payments (credit cards, debit cards, and Apple Pay) right on your iPhone. No card reader or extra hardware needed.

### How to set it up
1. Open **More > Help & Support** and scroll to the **Tap to Pay on iPhone** section.
2. Tap **Set Up Tap to Pay on iPhone** and follow the prompts to accept the terms.
3. Your Stripe account is linked automatically.

### How to accept a payment
1. Open a job or invoice.
2. Tap **Collect Payment** and choose **Tap to Pay**.
3. Ask the customer to hold their card or device near the top of your iPhone.
4. The payment processes instantly and the invoice is marked paid.

### Requirements
- iPhone XS or later running iOS 16 or later
- A Stripe account connected in Settings > Payments
- The customer's card must support contactless payments

### Troubleshooting
If Tap to Pay is not working, tap **Reset Tap to Pay Setup** in More > Help & Support to clear the terms and run the setup again.`,
    mobileDeeplink: '/more/tap-to-pay-setup',
  },
  // ─── Client Portal ───────────────────────────────────────────────────────────
  {
    id: 'qi-07',
    category: 'quotes-invoices',
    title: 'How does the client portal work?',
    summary: 'Clients can view, accept, decline, and pay quotes and invoices online without creating an account.',
    body: `## The Client Portal

When you send a quote or invoice, your client receives an email with a secure link. Clicking it opens the client portal: a branded page where they can review the document, ask questions, and take action.

No login or account is required for your client.

## What clients can do

**On quotes:**
- Review line items, totals, and your terms and conditions
- Accept or decline with a single click
- Add a comment or question back to you
- Pay a deposit online (if you have Stripe connected and a deposit is set)

**On invoices:**
- View the full invoice and any attached job photos
- Pay by credit card or direct payment link
- Download a PDF copy

## Accepting a quote

When the client clicks **Accept Quote**, the quote status in JobRunner updates to **Accepted** automatically and you receive a notification. If a deposit is required, they are taken to payment before acceptance is confirmed.

## Branding the portal

The portal uses your business name, logo, and primary colour from **Settings > Branding**. A professional branded experience builds trust and improves acceptance rates.

## Resending the link

If your client loses the email, open the quote or invoice in JobRunner and click **Resend** or **Copy Link** to share it again. Each link is unique and secure.`,
    deeplink: '/quotes',
    mobileDeeplink: '/more/quote/new',
  },
  // ─── Price List ───────────────────────────────────────────────────────────────
  {
    id: 'set-05',
    category: 'settings',
    title: 'How do I set up and use the price list?',
    summary: 'Create a catalogue of services and materials with preset prices to speed up quoting.',
    body: `## Setting Up the Price List

Go to **Settings > Price List**.

Click **Add Item** and enter:
- **Name** – what you call the item or service
- **Description** – optional detail that appears on quotes and invoices
- **Unit** – each, hour, m, m2, kg, etc.
- **Unit price** – your standard charge
- **Cost price** – optional, used to calculate your margin
- **Tax** – whether this item includes GST

Save the item. You can add as many items as you like, and group them into categories (e.g. Labour, Materials, Call-out Fees).

## Using the Price List on a Quote or Job

When adding a line item to a quote or job cost, click **Add from Price List** and search or browse your catalogue. Select an item and it fills in with the preset name, description, and price. You can override the quantity and price before saving.

## Keeping It Up to Date

Update prices from **Settings > Price List** at any time. Changes apply to new quotes only; existing quotes are not affected.

**Tip:** Regular reviews of your price list keep your quoting accurate and ensure you are not underselling labour or materials.`,
    deeplink: '/settings',
    mobileDeeplink: '/more/settings',
  },
  {
    id: 'set-04',
    category: 'settings',
    title: 'How do I back up or export my data?',
    summary: 'Export your jobs, clients, invoices, and reports as CSV files.',
    body: `## Exporting Data

Go to **Reports** and click **Export** on any report to download a CSV file.

For a full data export:
1. Go to **Settings > Data**.
2. Click **Export All Data**.
3. JobRunner will prepare a ZIP file with CSVs for all major data types.
4. You will receive an email with a download link when it is ready.

Your data is yours: exports include clients, jobs, quotes, invoices, time entries, and expenses.`,
    deeplink: '/reports',
    mobileDeeplink: '/more/reports',
  },
];
