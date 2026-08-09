# JobRunner Mobile App — Complete UI/UX Design Document
**Platform:** iOS & Android (React Native / Expo)
**Company:** LinkUp2Care Pty Ltd (ABN 34 692 409 448)
**Target Users:** Australian tradespeople (plumbers, electricians, carpenters, HVAC, etc.)
**Date:** April 2026

---

## Table of Contents
1. [Design System & Foundations](#1-design-system--foundations)
2. [Navigation Architecture](#2-navigation-architecture)
3. [Authentication Screens](#3-authentication-screens)
4. [Onboarding Flow](#4-onboarding-flow)
5. [Main Tab Screens](#5-main-tab-screens)
6. [Job Management](#6-job-management)
7. [Client Management](#7-client-management)
8. [Quoting System](#8-quoting-system)
9. [Invoicing System](#9-invoicing-system)
10. [Payment Collection](#10-payment-collection)
11. [Communication Hub](#11-communication-hub)
12. [Team Management](#12-team-management)
13. [AI Features](#13-ai-features)
14. [Scheduling & Dispatch](#14-scheduling--dispatch)
15. [Financial Tools](#15-financial-tools)
16. [Safety & Compliance](#16-safety--compliance)
17. [Settings & Configuration](#17-settings--configuration)
18. [Utility Screens](#18-utility-screens)
19. [Design Patterns & Conventions](#19-design-patterns--conventions)

---

## 1. Design System & Foundations

### Color Palette

#### Light Mode
| Token | Hex | Usage |
|-------|-----|-------|
| Background | `#fafafa` | App background |
| Card | `#f5f5f5` | Card surfaces |
| Foreground | `#1f2733` | Primary text |
| Muted | `#ededed` | Disabled/muted surfaces |
| Muted Foreground | `#6b7280` | Secondary/tertiary text |
| Border | `#e5e7eb` | Borders, dividers |
| Success | `#26a556` | Positive actions, completed |
| Warning | `#f29d0a` | Caution, pending |
| Destructive | `#e94444` | Errors, overdue, delete |
| Info | `#2196f3` | Informational badges |

#### Dark Mode
| Token | Hex | Usage |
|-------|-----|-------|
| Background | `#121417` | App background |
| Card | `#181b20` | Card surfaces |
| Foreground | `#eef2f5` | Primary text |
| Muted | `#1e2228` | Disabled/muted surfaces |
| Muted Foreground | `#9aa0a8` | Secondary/tertiary text |
| Border | `#22262e` | Borders, dividers |
| Success | `#3dc875` | Positive actions |
| Warning | `#f5b019` | Caution, pending |
| Destructive | `#e94444` | Errors, overdue |
| Info | `#4aa8f5` | Informational badges |

#### Brand Colors
| Color | Hex | Usage |
|-------|-----|-------|
| Brand Blue | `#2563EB` | Default primary (customizable per-business) |
| Brand Orange | `#E8862E` | Accent, branding, onboarding gradients |

#### Job Status Colors (dedicated tokens)
| Status | Purpose |
|--------|---------|
| Pending | Yellow/amber tones |
| Scheduled | Blue tones |
| In Progress | Orange/active tones |
| Done | Green/success tones |
| Invoiced | Purple/completion tones |

#### Dynamic Brand Theming
The primary color is customizable per-business. A `generateBrandPalette()` function derives primary, primaryDark, primaryLight, and primaryForeground from the business's chosen hex color. This ensures every user's app feels personalized while maintaining contrast and accessibility.

### Typography (System Fonts)
| Style | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| Large Title | 32px | Bold (700) | 38px | Screen titles |
| Section Title | 22px | Semibold (600) | 28px | Section headers |
| Headline | 20px | Bold (700) | 26px | Card headers |
| Card Title | 17px | Semibold (600) | 23px | Card titles |
| Body | 15px | Regular (400) | 22px | Body text |
| Caption | 13px | Regular (400) | 18px | Timestamps, metadata |
| Label | 11px | Medium (500) | Uppercase | Category labels |
| Button | 14px | Semibold (600) | - | Button text |

### Spacing Scale (Tailwind-aligned)
| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Tight spacing |
| sm | 8px | Small gaps |
| md | 12px | Medium gaps |
| lg | 16px | Primary spacing (padding, margins) |
| xl | 20px | Section spacing |
| 2xl | 24px | Large section gaps |
| 3xl | 32px | Major section dividers |
| 4xl | 40px | Full-screen spacing |

### Border Radius
| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Small badges |
| sm | 6px | Chips, tags |
| md | 8px | Buttons |
| lg | 10px | Input fields |
| xl | 14px | Cards (primary radius) |
| 2xl | 16px | Modals, large cards |

### Shadows (Platform-Specific)
| Level | Android Elevation | iOS Opacity | Usage |
|-------|-------------------|-------------|-------|
| xs | 1 | 0.05 | Subtle depth |
| sm | 2 | 0.07 | Cards at rest |
| md | 4 | 0.09 | Elevated cards |
| lg | 6 | 0.10 | Floating elements |
| xl | 10 | 0.12 | Modals, FABs |

### Key Component Dimensions
| Element | Size |
|---------|------|
| Input Height | 44px (minimum touch target) |
| FAB Size | 56px |
| Avatar (medium) | 40px |
| Tab Bar Height | 64px + safe area (80px on iPad) |

---

## 2. Navigation Architecture

### Bottom Tab Bar (Phone Layout)
The app uses a custom bottom navigation bar with role-based tab visibility.

**Owner/Staff Tabs:**
| Tab | Icon | Label |
|-----|------|-------|
| 1 | `home` (Feather) | Dashboard |
| 2 | `briefcase` (Feather) | Work |
| 3 | `message-circle` (Feather) | Chat |
| 4 | `more-horizontal` (Feather) | More |

**Subcontractor Tabs:**
| Tab | Icon | Label |
|-----|------|-------|
| 1 | `home` | Dashboard |
| 2 | `briefcase` | My Jobs |
| 3 | `map-pin` | Map |
| 4 | `message-circle` | Chat |
| 5 | `more-horizontal` | More |

**Tab Bar Styling:**
- Background: `colors.background` (light/dark adaptive)
- Active tab: Icon and label in `colors.primary`, with a rounded pill background in `colors.primaryLight`
- Inactive tab: Icon and label in `colors.mutedForeground`
- Unread badge: Red circle (`colors.destructive`) with white count text on the Chat tab
- Height: 64px + safe area inset on phones, 80px on iPad

### Tablet/iPad Layout
On tablets, the bottom tab bar is replaced with a sidebar navigation for better use of horizontal space.

### Stack Navigation
All "More" section screens use stack navigation with:
- Default headers hidden (custom headers per screen)
- iOS-style back gesture support
- Custom `IOSBackButton` component for consistent back navigation

---

## 3. Authentication Screens

### 3.1 Login Screen
**Layout:** Full-screen scrollable view with `KeyboardAvoidingView`

**Visual Structure (top to bottom):**
1. **Logo Container:** Orange gradient background (`#E8862E`) with a blue-bordered (`#2563eb`) icon area. Below it, "JobRunner" text split into blue "Job" + orange "Runner" (32px, bold).
2. **Welcome Section:** "Welcome back!" (22px semibold) + "Sign in to manage your trade business" (15px, muted).
3. **Form Card:** Elevated card (shadow elevation 8) containing:
   - Email field: Standard text input, 52px height, 12px border radius
   - Password field: Same styling with an eye icon toggle for show/hide password
4. **Error Display:** Red-tinted container with left red border (4px) and error text. For unverified accounts, includes a "Resend" verification button.
5. **Forgot Password Link:** Right-aligned muted text link
6. **Sign In Button:** Full-width primary button with `ActivityIndicator` during loading
7. **Social Login Section:**
   - "Or continue with" divider
   - "Continue with Google" button (white bg, border, Google logo)
   - "Sign in with Apple" button (black, iOS only)
8. **Register Link:** "Don't have an account? Sign Up" at the bottom

**Interactions:** Keyboard dismiss on scroll, `returnKeyType="done"` triggers login on Enter.

### 3.2 Register Screen
**Layout:** Mirrors login screen structure

**Visual Structure:**
1. **Logo + "Get Started Free"** heading
2. **Trial Info Card:** Highlighted card showing "Start Your Free Trial" with "No credit card required. Full access for 14 days."
3. **Social Sign-up Buttons:** Google and Apple (positioned above the form, unlike login)
4. **Form Fields:**
   - Two-column row: First Name + Last Name
   - Full-width: Business Name, Email, Password (with eye toggle)
5. **Terms Notice:** "By creating an account, you agree to our Terms of Service and Privacy Policy" with tappable links
6. **Create Account Button:** Full-width primary action

### 3.3 Forgot Password Screen
**Layout:** Simple single-field form

**States:**
- **Initial:** Title "Forgot Password", email input, "Send Reset Link" button, "Back to Sign In" link with arrow-back icon
- **Success:** Swaps content to show a `mail-outline` icon, confirmation text, and "Try Another Email" button

### 3.4 Reset Password Screen
**Layout:** Dual password fields with real-time validation

**Components:**
- New Password + Confirm Password fields (both with eye toggles)
- **Live Requirements Checklist:**
  - At least 8 characters
  - Contains a number
  - Contains uppercase letter
  - Contains lowercase letter
  - Each shows green checkmark when met, grey circle when not
- **Match Indicator:** Real-time "Passwords match" / "Passwords do not match"
- **Success State:** Large green checkmark + "Go to Sign In" button

### 3.5 Email Verification Screens
**Verify Email Pending:**
- Large central `Mail` icon in a circular container
- Shows the specific email address the verification was sent to
- "Resend verification email" button + "Back to sign in" link

**Verify Email (link landing):**
- **Verifying state:** Large `ActivityIndicator` + "Verifying your email..."
- **Success state:** `CheckCircle` icon, "Email Verified!", auto-redirect
- **Failure state:** `XCircle` in destructive red, error message, "Try Again" button

### 3.6 Accept Invite Screen
**Layout:** Role-specific join flow

**Components:**
- "You're Invited!" header with `users` icon and inviter's name
- Business card showing business name + role badge (e.g., "Technician" with shield icon)
- Mode toggle: "Create Account" vs "I Have an Account" (segmented control)
- Form adapts: New users see Name/Email/Password; existing users see Email/Password only
- Action: "Create Account & Join" or "Login & Join" button with arrow-right icon

---

## 4. Onboarding Flow

**Visual Design:** Wrapped in a `LinearGradient` (blue to orange). A white/dark content card slides up from the bottom, creating a layered look.

**Progress Indicator:** White bar with orange fill (`#E8862E`), showing "Step X/Y"

**Header:** JobRunner logo + back button

### Role Selection (Step 1 — All Users)
Three large vertical cards:
- **Owner** (Blue icon): "I run my own business"
- **Worker** (Orange icon): "I work for a business"
- **Subcontractor** (Green icon): "I'm an independent contractor"

### Owner Path
| Step | Title | Inputs | Visual Notes |
|------|-------|--------|--------------|
| 2 | Business Details | Business Name (required), Owner Name, Phone, ABN | ABN has real-time validation with green/red feedback |
| 3 | Trade Selection | Grid of trade options (Electrical, Plumbing, Carpentry, etc.) | Trade-specific icons, selected chip highlighted in primary blue |
| 4 | Team Size | Solo, Small (2-5), Medium (6-10), Large (10+) | 2x2 grid of cards with descriptive icons |
| 5 | Plan Selection | Free, Solo, Team | Vertical pricing cards with feature lists; auto-recommends based on team size |
| 6 | Complete | - | Large green checkmark, "Start Using JobRunner" button |

### Worker Path
| Step | Inputs | Visual Notes |
|------|--------|--------------|
| 2 | 6-character invite code | Large letter-spaced input, auto-validates via API, shows business name on success |
| 3 | First Name, Last Name, Phone | Pre-fills from auth context if available |
| 4 | Complete | Green checkmark, "View My Jobs" button |

### Subcontractor Path
| Step | Inputs | Visual Notes |
|------|--------|--------------|
| 2 | First Name, Last Name, Phone, Trade Type, ABN | Similar to worker but with trade/ABN |
| 3 | Invite Code (optional) | Can skip to connect later |
| 4 | Privacy Acknowledgment | Three bullet points: "GPS only when on site", "Tracking stops automatically", "Not tracked between jobs" |
| 5 | Complete | Green checkmark confirmation |

---

## 5. Main Tab Screens

### 5.1 Dashboard (Home)
**Header Area:**
- Large profile section: `TeamAvatar` (initials or image), user name, email, business name
- `NotificationBell` icon (top right) with unread count badge
- Optional banners: `TrustBanner` or `UsageLimitBanner`

**Scrollable Content Sections:**
1. **Weather Widget:** Card showing current temperature, conditions icon, "feels like" temp, humidity, wind speed. Settings modal for location preferences.
2. **KPI Stats:** Summary boxes (jobs today, revenue this week, overdue invoices, etc.)
3. **Active Timer Widget:** If a timer is running — card showing elapsed time (HH:MM:SS), current job title, Stop/Pause/Resume controls
4. **Recent Activity Feed:** Last 5 activities with category-specific icons (briefcase for jobs, dollar-sign for payments, user for clients) and relative timestamps ("5m ago")
5. **Quick Actions:** Large pressable cards in a grid: "New Job", "Invoice", "Time", "Team Ops"

**No FAB on dashboard** — quick actions are inline.

### 5.2 Jobs List (Work Tab)
**Header Area:**
- Search bar: `TextInput` with search icon, filters jobs by title or address
- Status filter tabs: Horizontal scroll of chips — All, Recurring, Pending, Scheduled, In Progress, Done, Invoiced (each with an icon)
- View toggle: Grid vs List mode buttons

**Main Content:**
- **Grid Mode:** Elevated cards showing: StatusBadge, "Recurring" badge, JobUrgency indicator (e.g., "Overdue"), Job Title, Client Name, Address, Scheduled Date, three-dot "More" menu
- **List Mode:** Compact horizontal rows emphasizing Title, Status, Date
- **Batch Mode:** Multi-select for bulk invoicing when toggled
- Cards use `AnimatedCardPressable` with `shadows.sm`, `radius.xl`, subtle borders

**FAB:** Primary `+` button (bottom right) for "Create Job"

**Empty State:** Illustration with "No jobs yet" message and "Create your first job" CTA button

### 5.3 Money Tab
This tab renders the `PaymentHubScreen` component, serving as the financial command center.

**Sections:**
- Financial summary KPIs: Total Revenue, Outstanding Invoices, Quotes Pending
- Recent transactions list
- Quick action buttons: "Create Quote", "Create Invoice", "Record Payment"

### 5.4 Profile / More Tab
**Header:**
- Profile card: Large `TeamAvatar`, name, email, role badge ("Owner" / "Subcontractor")
- Workspace Switcher: Prominent card for switching between business entities or viewing pending invites

**Main Content:**
- **Category Filter Tabs:** Horizontal chips — All, Work, Money, Team, Settings
- **Categorized Menu Sections:** Grouped into cards (e.g., "Work", "Money", "Add-ons")
- **Menu Items:** Each row has:
  - Tinted icon background (e.g., `successLight` green for money items)
  - Title + subtitle description
  - `chevron-right` arrow, or `lock` icon for premium-gated features
- **Typography:** Section headers use `typography.label` (uppercase, letter-spaced)

### 5.5 Map Tab
**Full-screen interactive map** using `react-native-maps`

**Overlay Elements:**
- **Header Card (absolute positioned):** Summary stats (e.g., "4 Jobs Today") with filter toggles for "Show Jobs" and "Show Team"
- **Job Pins:** Custom markers color-coded by status (Pending=yellow, In Progress=orange, etc.) with `Callout` bubbles showing job details on tap
- **Team Locations:** "Life360-style" circular markers showing worker initials, status dot (Online green / Driving blue / Offline grey), and compact name label below
- **Floating Buttons:**
  - Locate Me (GPS centering)
  - Map Layers toggle (Standard / Satellite / Dark)
  - Legend button (opens card explaining marker colors)
- **Dark Map Style:** Custom dark map theme automatically applied in dark mode
- **Error Boundary:** Dedicated crash boundary to prevent map rendering errors from breaking the app

---

## 6. Job Management

### 6.1 Create Job Screen
**Layout:** Scrollable form with `KeyboardAvoidingView`

**Form Sections:**
1. **Title** (required — only required field)
2. **Client Picker** (searchable dropdown, optional)
3. **Address** (with autocomplete suggestions)
4. **Description** (multiline text area)
5. **Scheduled Date/Time** (date picker)
6. **Priority Level** (Low/Medium/High/Urgent)
7. **Recurring Toggle** (if enabled, shows frequency options)

**AI Feature:** "Past Job Suggestions" — when a client is selected, fetches AI-suggested titles and descriptions from similar past jobs for that client.

**Offline Support:** Falls back to `offlineStorage.saveJobOffline()` when network unavailable

**Submit Button:** Shows `ActivityIndicator` while saving. Success offers "View Job" or "Back to Jobs" navigation.

### 6.2 Job Detail Screen
**Extremely comprehensive screen** (12,000+ lines)

**Header:** Job title, status badge, back button, three-dot menu

**Tab Navigation:**
| Tab | Content |
|-----|---------|
| Overview (Info) | Core job details, client card, address, timer, notes |
| Documents | Photos, SWMS documents, uploaded files |
| Chat | Internal team communication for this specific job |
| Manage (More) | Variations, materials/costing, subcontractor magic links |

**Overview Tab Components:**
- **Client Card:** Name, email, quick-action buttons (call, message)
- **Address Card:** Tappable — opens Google/Apple Maps for navigation
- **Scheduled Date Card:** Tappable to reschedule
- **Timer Widget:** Start/Stop/Pause with elapsed time display (includes logic to stop timers on other jobs first)
- **Notes Card:** View/edit notes via modal
- **Photos Card:** Horizontal scroll preview with "View All" gallery
- **Job Progress Bar:** Visual workflow representation (Pending > Scheduled > In Progress > Done > Invoiced)
- **Status Machine Actions:** Context-sensitive buttons for status transitions
- **Next Action Card:** Smart suggestion (e.g., "Create Invoice" after completion) with pre-filled navigation

**Permission Gating:**
- `isOwnerOrManager`: Full access
- Workers: Limited to status updates, photos, timer
- Subcontractors: Restricted from financial cards, invoice creation

**Loading State:** Centered `ActivityIndicator`
**Error State:** Error message with "Retry" and "Go back" buttons

---

## 7. Client Management

### 7.1 Client List
**Search:** Full-text search across name, email, phone, address, tags (case-insensitive)

**Filter Segments:** Horizontal scroll chips — Residential, Commercial, VIP, Outstanding, Inactive 6mo+, and tag-based filters

**Client Cards:** Name, client type badge, contact info preview, tag pills

**Empty State:** "No clients found" with "Add your first client" CTA

### 7.2 Client Detail
**Profile Header:** Large avatar area with name, client type badge, tags

**Contact Info Section:** Phone (tap to call), email (tap to email), address (with map pin icon)

**Tabbed Content:**
| Tab | Content |
|-----|---------|
| Overview | Contact info, notes, signature, recent activity timeline (last 10 items) |
| Jobs | Filtered job list for this client with empty state + "Create Job" CTA |
| Quotes | Filtered quote list with empty state + "Create Quote" CTA |
| Invoices | Filtered invoice list with empty state + "Create Invoice" CTA |

### 7.3 Create/Edit Client
**Fields:** Name (required), Phone, Email, Address, Client Type (Residential/Commercial/Strata/Government), Referral Source, Tags (comma-separated), Notes

---

## 8. Quoting System

### 8.1 Quote List
**Status Filter Tabs:** All, Draft, Sent, Accepted, Rejected, Archived

**Quote Cards:** StatusBadge, title, client name, total amount, date

**Quick Actions:** Convert-to-invoice button on accepted quotes

### 8.2 Quote Detail
**Summary Section:** Client info, status badge, quote number, dates

**Line Items Table:** Description, quantity, unit price, line total for each item

**Financial Summary:**
- Subtotal
- GST (10%)
- Total (incl. GST)

**Actions:**
- Send (via JobRunner API, email compose, or manual share)
- PDF preview/download (using `expo-file-system` and `expo-sharing`, 15-second timeout)
- Share payment/acceptance link
- Client signature capture for acceptance

**Live Document Preview:** In-app rendered preview before downloading PDF

### 8.3 Create/Edit Quote
**Validation:** Requires Client, Title, and at least one Line Item

**Form Sections:** Client picker, title, line items (add/remove/reorder), notes, terms, validity period

**AI Features:** Voice note and photo-based quote generation — capture a voice description or photo and AI generates line items

**Pre-population:** Auto-fills client if created from a job context

---

## 9. Invoicing System

### 9.1 Invoice List
**KPI Cards:** Total invoiced, total paid, total overdue (overdue uses `colors.destructive` red)

**Status Filter Tabs:** All, Draft, Sent, Paid, Overdue

**Invoice Cards:** Status badge, invoice number, client name, total amount, due date
- **Overdue highlighting:** Due date text switches to `colors.destructive` (red) when overdue

### 9.2 Invoice Detail
**Components identical pattern to Quote Detail, plus:**
- **Payment Recording:** "Mark as Paid" button with options for on-site recording or Payment Hub (Stripe/Card)
- **Milestone Payments:** Support for partial payments with balance tracking
- **Receipt Generation:** Auto-generates receipt after payment

### 9.3 Create/Edit Invoice
**Validation:** Requires Client, Title, and at least one Line Item

**Smart Pre-fill (from Job context):**
- Auto-fetches job details and client info
- Pre-fills line items from the most recent accepted/sent quote for that job
- Fetches and offers job-related expenses as line items

**Offline Support:** Falls back to offline storage on network failure

---

## 10. Payment Collection

### 10.1 Collect Payment Screen
**Amount Input:** Large, centered currency input (32px font)

**Payment Method Cards:**
| Method | Icon | Notes |
|--------|------|-------|
| Tap to Pay on iPhone | NFC icon | "PROMO" / "NEW" badge, uses Stripe Terminal |
| Send Payment Link | Link icon | Share URL via SMS/Email or show QR Code |
| Record Manual Payment | - | Sub-options: Cash, Card (External), Bank Transfer |

**Invoice Picker:** Search and select existing unpaid invoices to link payment

**Status Modals:** Large success/error icons (96x96) with clear result text

### 10.2 Tap to Pay Setup Wizard
Multi-step onboarding:
1. **Splash:** Feature list (Accept Apple Pay, No extra hardware)
2. **Terms & Conditions:** Scrollable with checkbox
3. **Tutorial Slides:** Carousel showing how to position the card
4. **Configuration:** Animated progress (Initializing > Registering > Ready)
5. **Device Check:** Platform-specific alerts (requires iOS 16.4+, iPhone XS+)

### 10.3 Receipt Detail
**Header:** Large amount display with "PAID" badge

**Actions:** Share via PDF, send via email/SMS, print preview

**Relationships:** Deep links back to the associated Invoice and Job

---

## 11. Communication Hub

### 11.1 Chat Hub
**Layout:** List of all conversation types — Team Chat, Direct Messages, SMS Conversations, Job Chats

**Each Entry Shows:** Avatar/icon, conversation name, last message preview, unread count badge, timestamp

### 11.2 Direct Messages
**Chat Interface:**
- Message bubbles: Own messages right-aligned in primary color, others left-aligned in card color
- Timestamps: Australian locale (`en-AU`), 12-hour format with AM/PM
- Date separators: "Yesterday", "Tue", or full dates when day changes
- **Read Receipts:** "Sent" or "Read" with check/check-circle icon
- Auto-scroll to bottom on new messages (100ms delay for layout)

**Empty State:** Relevant icon + "Start a conversation" text

### 11.3 SMS Conversations
**Two-Way Display:**
- **Inbound (from client):** Left-aligned, muted background
- **Outbound (from user):** Right-aligned, themed background
- **Delivery Indicators:** "Sent", "Delivered", or "Failed" with status icons
- **Quick Replies ("ZAP"):** Pre-built reply templates
- **Attachment placeholders** for future media support

### 11.4 Team Chat
**Group Chat Interface:**
- Message bubbles with sender name labels
- Team member avatars beside messages
- Mentions `readBy` interface (tracking exists, visual rendering limited)

### 11.5 Job Chat
**Context-Specific Chat:**
- Tied to a specific job
- Same bubble styling as other chats
- All team members assigned to the job can participate

### 11.6 Communications Log
**Stats Row:** Cards showing Total, Emails, and SMS counts

**Tabs:** Segmented control — All, Email, SMS

**Activity Feed:** Cards showing recipient, subject, body snippet, status badge (Delivered/Sent/Failed), source indicator (Mobile/Web)

**Detail Modal:** Full message body with links to related entities

---

## 12. Team Management

### 12.1 Team Member List
**Member Cards:** Avatar, name, role badge, email, phone, status indicator

**Invite Methods:**
- **Email Invite:** Direct invite with name and email validation
- **Invite Code:** Generate shareable codes for Worker, Manager, or Subcontractor roles

**Active Codes Section:** Shows code, role, usage count, expiry, with "Revoke" option

**Permission Gating:** Only owners see management actions (invite, revoke, role change)

**Empty State:** Icon + "No team members yet" + "Invite Member" button

### 12.2 Member Detail / Edit
**Editable Fields:** First name, last name, phone, hourly rate

**Custom Permissions:** Granular per-member overrides beyond base role (e.g., `create_invoices`, `create_quotes`, `view_financials`)

**Role Presets:**
- Owner: Full access
- Manager: Most access except billing
- Worker: Limited to assigned work

### 12.3 Team Groups
**Card List:** Color-coded group dots, member counts, expandable member lists

**Management:** Add/remove members from groups via modal

### 12.4 Team Operations
**Tabs:**
| Tab | Content |
|-----|---------|
| Live Ops | Live status list, activity feed, map view (react-native-maps) showing member locations |
| Scheduling | Day-by-day availability, time-off requests |
| Performance | Job completion rates, team stats visualization |

---

## 13. AI Features

### 13.1 AI Receptionist
**Settings Dashboard (scrollable):**
- **Enable Switch:** Top-level toggle
- **Mode Selection:** Cards for Off, After Hours, Always On + Transfer, Always On + Message, Selective
- **Voice Config:** Australian voice selection (Jess, Harry, Chris)
- **Custom Content:** Greeting text area, Knowledge Bank (FAQs/Services)
- **Business Hours:** Day-of-week selector with time inputs
- **Phone Number:** Warning card if no dedicated number assigned

**Call Logs Section:** Recent calls showing caller name/phone, status, duration. Expandable for transcripts and audio recordings.

### 13.2 AI Assistant (Chat)
**Interface:** Modern chat UI with `KeyboardAvoidingView`

**Components:**
- **User Bubbles:** Right-aligned, primary color
- **Assistant Bubbles:** Left-aligned, card color
- **Rich Content:** `EntityLink` mini-cards linking to jobs, quotes, invoices with status badges
- **Proactive Section:** "Needs Attention" alerts with priority-colored left borders
- **Animations:** "Thinking Dots" animation while processing
- **Suggested Follow-ups:** Chips for quick responses
- **Action Confirmations:** "Yes, do it" / "Cancel" buttons for destructive actions

---

## 14. Scheduling & Dispatch

### 14.1 Calendar
**View Modes:** Tabs for Week, Month, Today

**Navigation:** Chevron buttons for date navigation + "New Job" primary button

**Month Grid:** Day cells with dot indicators for jobs

**List View:** Job cards with clock icon, time, title, client name, conflict badge (red) for overlapping jobs

**Today View:** Large date/weekday header with task count

### 14.2 Dispatch Board
**Three View Modes:**
| Mode | Description |
|------|-------------|
| Schedule | Grouped by team member with `TeamAvatar`; unassigned jobs at top |
| Kanban | Horizontal scroll columns: Unassigned, Assigned, En Route, In Progress, Complete |
| Map | Full-screen map with job and team location markers |

**Ops Health Dashboard:** Grid showing Conflicts, Overdue, Unassigned, Today's Total counts

**Job Cards:** Color-coded status strip on left, time/address details, assignment button

**Tablet Support:** Responsive layout using `isTablet()` and `useContentWidth()`

### 14.3 Recurring Jobs
**Stat Cards:** Active, Paused, Overdue counts

**Status Badges:** Success (Active), Warning (Paused), Destructive (Cancelled)

**Actions:** Pause/Resume, Generate Job Now, Edit

**FAB Menu:** Expandable for multiple creation options

### 14.4 Service Reminders
**Filter Chips:** Upcoming, All, Completed (with counts)

**Tags:** "Due Soon" and "Overdue" high-visibility tags

**Actions:** Complete, Edit, Schedule Job

---

## 15. Financial Tools

### 15.1 Reports
**Period Selector:** Week, Month, Quarter, Year

**Chart Types:** Custom SVG bar charts and donut charts

**Tabs:** Overview, Clients, Profitability (each with tab-specific empty states)

**Formatting:** Australian locale currency formatting (`formatCurrency`, `formatCurrencyShort`)

### 15.2 Insights
**Data:** Profit snapshot, cashflow, KPIs (fetched in parallel)

**Chart Types:** `SimpleBarChart` and `DonutIndicator` (View-based, not SVG)

**Pull-to-Refresh:** Enabled

### 15.3 Time Tracking
**Timer Implementation:** 1-second `useEffect` interval, persists across app backgrounding (calculates from `startTime` vs `Date.now()`)

**Tabs:**
- **Timer:** Start/stop/pause interface per job
- **Sheet:** Day-by-day time entry log

**Weekly Bar Chart:** Visual breakdown of hours worked

### 15.4 Expenses
**AI Scanner Card:** Camera icon CTA for receipt scanning (auto-extracts amount, vendor, GST, date)

**KPI Cards:** Total Expenses, Categories, Linked Jobs

**Expense Cards:** Vertical accent bar (destructive color), vendor/job icons, trash icon

**Filter System:** Horizontal category chips with count badges

**Manual Entry:** Category picker, job linking, amount, notes

### 15.5 Rebates
**Summary Card:** Pending vs received totals

**Filter Chips:** All, Pending, Submitted, Received

**Rebate Cards:** Amount (prominent), type icon (Manufacturer/Government), status badge, client/job association

---

## 16. Safety & Compliance

### 16.1 WHS Hub
**Tabbed Dashboard:**
| Tab | Content |
|-----|---------|
| Incidents | Severity badges (Minor to Critical), status indicators |
| JSA/SWMS | Safety analyses with Active/Draft status |
| PPE/Training | Safety gear checklists, certification records (White Card, First Aid) with expiry dates |
| Emergency | Site-specific assembly points, emergency contacts (000) |

### 16.2 Compliance
**Stats Row:** Active, Expiring, Expired document counts

**Filter Tabs:** All, Active, Expiring, Expired

**Document Cards:** Expandable cards with document type (Licence, Insurance), status badge, issuer, document number, expiry date

**Document Capture:** Camera/library via `expo-image-picker`

### 16.3 Form Builder
**Sections:** "My Forms" and "Templates"

**Field Editor:** Drag-and-drop field list with type icons (Signature, Photo, Text Area)

**Conditional Logic:** If/Then rules for field visibility

**Templates:** Presets like "Site Safety Checklist" and "Electrical Compliance"

---

## 17. Settings & Configuration

### 17.1 Settings (Main)
**Tab System:** Horizontal scrollable tabs — Account, Business, Payment, etc.

**Plan Management:** Subscription section with feature comparisons

### 17.2 Business Settings
**Fields:** Business Name, Trade Type, ABN (with real-time validation), Contact Info, Address (with autocomplete suggestions)

**Digital Signature:** Full `SignaturePad` integration — draw and save signatures for quotes/invoices

### 17.3 Branding
**Logo Uploader:** Camera/gallery with preview and removal

**Theme Controls:** Appearance mode (Light/Dark/System), primary color grid, custom hex input

**Live Preview Card:** Shows how buttons and badges look with current settings in real-time

### 17.4 Subscription
**Current Plan:** Highlighted with success-colored border

**Trial Display:** 14-day trial badge and info cards

**Upgrade Flow:** Stripe Checkout for new subscriptions, Stripe Customer Portal for management

**Team Seats:** Adjustable seat counter for Team plan

### 17.5 Notification Preferences
**Toggle Switches:** Per-category notification controls

**Push Permission:** System permission request flow

### 17.6 Booking Settings
**Live Link Card:** Booking URL with Copy/Open actions

**Page Editor:** Slug, title, description

**Day Picker:** Horizontal weekday buttons (Mon-Sun)

**Service Builder:** Add/edit/delete services (name, duration, price)

**Feature Toggles:** Auto-confirm, require phone, require address

### 17.7 Phone Numbers
**Current Number Card:** Active status dot, quick actions (Open Chat Hub, Revert to Shared)

**Search:** Two-column area code + city filter

**Number List:** Capability badges (SMS, Voice, MMS) with Select button

**Pricing:** "$5/month per number" header subtitle

### 17.8 Integrations
**Integration Cards (uniform layout):**
| Integration | Status |
|-------------|--------|
| Stripe | Connected/Not Connected |
| Xero | Connected/Not Connected |
| MYOB | Connected/Not Connected |
| QuickBooks | Connected/Not Connected |
| Google Calendar | Connected/Not Connected |

Each card: Branded icon/logo, title + subtitle, status badge, Connect/Manage button, feature sync list

### 17.9 Document Templates
**Layout:** Modern/Minimal/Professional style selection

**Preview:** Live document preview with brand color picker

### 17.10 Business Templates
**Categories:** Communications, Financial, Jobs & Safety

**Types:** Email, SMS, Terms & Conditions, Warranties

**Health Cards:** Warnings if email (SendGrid) or SMS (Twilio) need configuration

---

## 18. Utility Screens

### 18.1 Search (Global)
**Interface:** Full-screen with large auto-focused search bar

**Results:** Categorized — Job, Client, Quote, Invoice — with distinct icons and colors

**Behavior:** Debounced (300ms) with "no results" empty state

### 18.2 Action Center
**KPI Cards:** "Fix Now" (red), "This Week" (orange), "Tips" (green)

**Priority Sections:** FIX NOW, THIS WEEK, SUGGESTIONS

**Action Cards:** Vertical accent bar (priority-colored), category icon, priority badge, title, description, metric text

**Batch Invoicing Modal:** Bulk invoice creation for uninvoiced jobs

### 18.3 Autopilot (Automations)
**Tabs:** Automations, Templates, Activity

**Stats:** Active Automations, Total Created, Available Templates

**Automation Editor:** 4-step wizard — Details, Trigger, Actions, Review

**Triggers:** Status changes, time delays, no response, payment received

**Actions:** Send email/SMS, create jobs/invoices, update statuses, push notifications

**Quick Toggles:** "Smart Running Late", auto-email for quote acceptance/invoice payment

### 18.4 Inventory
**Tabs:** Items, Categories, Low Stock, Orders

**Stock Indicators:** Color-coded (Red=zero, Orange=reorder level)

**Item Detail Modal:** Transaction history (Stock In/Out), adjustment logs

### 18.5 Equipment
**Filter Tabs:** All, Active, Maintenance, Retired

**Cards:** Status dot, name, model, category, location, purchase price, status badge (Available=green, In Use=blue, Maintenance=orange)

### 18.6 Leads
**Pipeline Filters:** Active, All, New, Contacted, Quoted, Won, Lost

**Lead Cards:** Name + status badge, phone/email/source icons, estimated value in green

**Actions:** "Convert" to client/job, delete

### 18.7 Custom Website
**Marketing Layout:** Pricing card ($499), feature grid, multi-step process indicator

**Lead Capture:** Comprehensive form for requesting a custom website

### 18.8 Admin Panel (Internal)
**Tabs:** Overview, Users, Health, Activity

**KPIs:** Total users, active users, onboarding rate, Pro user counts

**System Health:** API/DB latency, background job status, storage usage

**User Management:** Full list with subscription tiers, verification status, "Onboarded" badges

**Demo Tools:** "Refresh for Screenshots" button for App Store marketing

### 18.9 Support & Bug Report
**Support:** App Tour CTA, accordion FAQ by topic, direct contact options

**Bug Report:**
- Category grid: Crash, UI, Performance, etc.
- Severity toggle: Low, Medium, High
- Auto-diagnostics: Captures device platform, OS version, app build, network status

### 18.10 Legal Screens
- **Privacy Policy:** Scrollable text
- **Terms of Service:** Scrollable text
- **Delete Account:** Confirmation flow with consequences warning

---

## 19. Design Patterns & Conventions

### Consistent Patterns Across All Screens
1. **Dark Mode:** Every screen uses `useTheme()` hook with `createStyles(colors)` factory pattern. All colors are semantic tokens, not hardcoded (except brand colors in auth headers and social buttons, which is acceptable).
2. **Loading States:** `isLoading` flag with centered `ActivityIndicator` on every data-fetching screen.
3. **Error States:** Error containers with retry buttons on data load failures.
4. **Empty States:** Every list view has a `ListEmptyComponent` with relevant icon, message, and CTA button.
5. **Null Safety:** Optional chaining (`client?.name`) and fallback values (`|| 'Draft'`, `|| 0`) throughout.
6. **Keyboard Handling:** `KeyboardAvoidingView` with platform-specific behavior (`padding` on iOS, `height` on Android) and `ScrollView` with `keyboardShouldPersistTaps="handled"`.
7. **Pull-to-Refresh:** `RefreshControl` on all scrollable list screens.
8. **Offline-First:** Job, quote, and invoice creation fall back to `offlineStorage` when network is unavailable. `SyncStatusIndicator` component shows sync state.

### Typography Hierarchy
- **Three text color levels** for information hierarchy:
  - Primary: `colors.foreground` (important text)
  - Secondary: `colors.mutedForeground` (supporting details)
  - Tertiary: Lighter muted for timestamps, metadata

### Card Usage
- **Variants used:** default (border + shadow), elevated (shadow only), outlined (border only), ghost (transparent)
- Cards are never nested inside other cards
- Consistent padding and radius (`xl` = 14px) across all card instances

### Icon System
- **Feather Icons** (via `react-native-vector-icons` or `@expo/vector-icons`): Primary icon set for navigation, actions
- **Ionicons:** Used in auth/onboarding screens and specific UI elements (eye toggle, checkmarks)
- Icons are always tinted via theme colors, never hardcoded black/white

### Status Badge System
Unified `StatusBadge` component with consistent color mapping:
| Status | Color Token |
|--------|-------------|
| Draft | `muted` (grey) |
| Pending | `warning` (amber) |
| Sent | `info` (blue) |
| Scheduled | `info` (blue) |
| In Progress | `warning` (orange) |
| Accepted | `success` (green) |
| Completed/Done | `success` (green) |
| Paid | `success` (green) |
| Overdue | `destructive` (red) |
| Rejected | `destructive` (red) |
| Cancelled | `destructive` (red) |

### Interaction Patterns
- Haptic feedback on button presses
- `AnimatedPressable` / `AnimatedCardPressable` for touch feedback on cards
- Touch targets minimum 44px (iOS HIG compliant)
- Swipeable actions on list items where contextual actions needed

### Responsive Design
- Tablet detection via `isTablet()` utility
- Sidebar navigation on tablets vs bottom tabs on phones
- `useContentWidth()` hook for responsive layouts
- iPad-specific tab bar height (80px vs 64px)

### Accessibility
- `testID` props on key interactive elements for automated testing
- Semantic color tokens ensuring sufficient contrast in both light and dark modes
- `getSafeForegroundColor()` helper for ensuring readability on dynamic brand color backgrounds

---

## Total Screen Count

| Category | Count |
|----------|-------|
| Auth Screens | 7 |
| Onboarding | 1 (multi-step) |
| Main Tabs | 5 |
| Job Screens | 2 |
| More Section | 67 |
| Nested Entities | 7 |
| Root/Utility | 2 |
| **Total** | **91 screens** |

---

*Document generated from codebase analysis of the JobRunner mobile application (React Native / Expo). All color values, spacing tokens, typography scales, and component descriptions are derived directly from the source code.*
