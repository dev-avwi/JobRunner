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
    id: 'pay-01',
    category: 'payments',
    title: 'How do I connect Stripe for online payments?',
    summary: 'Accept credit card payments from clients by connecting a Stripe account.',
    body: `## Setting Up Stripe

1. Go to **Settings > Payments**.
2. Click **Connect Stripe**.
3. You will be redirected to Stripe to create or connect an existing account.
4. Complete the Stripe onboarding (takes about 5 minutes).
5. Return to JobRunner — your account will be linked automatically.

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

Your data is yours — exports include clients, jobs, quotes, invoices, time entries, and expenses.`,
    deeplink: '/reports',
    mobileDeeplink: '/more/reports',
  },
];
