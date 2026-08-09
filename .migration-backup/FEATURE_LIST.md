# JobRunner - Comprehensive Feature List

## Overview
JobRunner is a mobile-first web application for Australian tradespeople, designed to streamline business operations from job creation and management to quoting, invoicing, and payment collection.

---

## Feature Categories

### 1. Authentication & User Management
| Feature | Status | Description |
|---------|--------|-------------|
| Email/Password Registration | ✅ Implemented | Standard registration with email verification |
| Email Verification | ✅ Implemented | Token-based email verification flow |
| Login/Logout | ✅ Implemented | Session-based authentication |
| Password Reset | ✅ Implemented | Secure token-based password reset via email |
| Google OAuth 2.0 | ✅ Implemented | Sign in with Google for web and mobile |
| Session Management | ✅ Implemented | Secure session handling with express-session |
| Mobile Auth | ✅ Implemented | Native mobile authentication with offline fallback |

### 2. Client Management
| Feature | Status | Description |
|---------|--------|-------------|
| Client CRUD | ✅ Implemented | Create, read, update, delete clients |
| Client Search | ✅ Implemented | Search clients by name, email, phone, company |
| Client Details View | ✅ Implemented | Full client profile with job history |
| Quick Add Client | ✅ Implemented | Streamlined client creation from job forms |
| Smart Address Auto-fill | ✅ Implemented | Auto-complete addresses for clients |
| Client Asset Library | ✅ Implemented | View photos, signatures, and docs per client |

### 3. Job Management
| Feature | Status | Description |
|---------|--------|-------------|
| Job CRUD | ✅ Implemented | Full job lifecycle management |
| 5-Stage Job Workflow | ✅ Implemented | pending → scheduled → in_progress → done → invoiced |
| Job Status Validation | ✅ Implemented | Jobs can't be "invoiced" without linked invoice |
| Today's Schedule Dashboard | ✅ Implemented | View and manage today's jobs |
| Job Search & Filtering | ✅ Implemented | Filter by status, date, client |
| Job Assignment | ✅ Implemented | Assign jobs to team members |
| Job Checklists | ✅ Implemented | Create and track task checklists per job |
| Job Photos | ✅ Implemented | Upload and manage job photos |
| Job Voice Notes | ✅ Implemented | Record voice memos for jobs |
| Job Completion Flow | ✅ Implemented | Complete jobs with photos and signatures |
| Job Chat | ✅ Implemented | Real-time chat per job |
| Contextual Job Creation | ✅ Implemented | Create jobs from quotes or client context |
| Instant Job Parser | ✅ Implemented | Create jobs from pasted text (SMS, email) |
| Next-Action Indicators | ✅ Implemented | Smart suggestions for next job actions |
| Linked Documents | ✅ Implemented | View linked quotes/invoices per job |

### 4. Quote Management
| Feature | Status | Description |
|---------|--------|-------------|
| Quote CRUD | ✅ Implemented | Create, read, update, delete quotes |
| Live Quote Editor | ✅ Implemented | Real-time preview with templates and catalog items |
| Quote Templates | ✅ Implemented | Customizable quote templates |
| Quote Line Items | ✅ Implemented | Add/edit line items with catalog support |
| Quote PDF Generation | ✅ Implemented | Server-side PDF via Puppeteer |
| Quote Sending | ✅ Implemented | Send quotes via email with PDF attachment |
| Public Quote Acceptance | ✅ Implemented | Client-facing quote view and accept/decline |
| Quote Deposits | ✅ Implemented | Configure and collect deposits on quotes |
| Digital Signatures | ✅ Implemented | Capture client signatures on accepted quotes |
| Quote-to-Invoice Conversion | ✅ Implemented | One-click conversion of accepted quotes |
| AI Quote Generator | ✅ Implemented | Generate line items from photos/voice/description |

### 5. Invoice Management
| Feature | Status | Description |
|---------|--------|-------------|
| Invoice CRUD | ✅ Implemented | Full invoice lifecycle management |
| Live Invoice Editor | ✅ Implemented | Real-time preview with templates |
| Invoice Templates | ✅ Implemented | Customizable invoice templates |
| Invoice PDF Generation | ✅ Implemented | Server-side PDF via Puppeteer |
| Invoice Sending | ✅ Implemented | Send invoices via email with PDF attachment |
| Mark as Paid | ✅ Implemented | Manual payment recording |
| Partial Payments | ✅ Implemented | Record partial payments |
| Online Payment | ✅ Implemented | Stripe payment integration |
| Overdue Tracking | ✅ Implemented | Automatic overdue status and notifications |
| Payment Links | ✅ Implemented | Shareable payment URLs |

### 6. Payment Hub (New)
| Feature | Status | Description |
|---------|--------|-------------|
| KPI Dashboard | ✅ Implemented | Outstanding, Overdue, Paid 30d, Pending Quotes |
| Invoice Overview | ✅ Implemented | Unified view of all invoices |
| Quote Overview | ✅ Implemented | Unified view of all quotes |
| Payment Tracking | ✅ Implemented | View payment history |
| Stripe Connect Status | ✅ Implemented | View connection status and balance |
| Recent Payouts | ✅ Implemented | View Stripe payout history |
| Quick Actions | ✅ Implemented | Create invoice, create quote shortcuts |

### 7. Collect Payment (Payment Requests)
| Feature | Status | Description |
|---------|--------|-------------|
| Create Payment Request | ✅ Implemented | Generate ad-hoc payment requests |
| QR Code Generation | ✅ Implemented | Scannable payment QR codes |
| Payment Link Sharing | ✅ Implemented | Copy/share payment URLs |
| SMS Payment Request | ✅ Implemented | Send payment links via SMS |
| Email Payment Request | ✅ Implemented | Send payment links via email |
| Request Status Tracking | ✅ Implemented | Track pending/paid/cancelled |
| Public Payment Page | ✅ Implemented | Client-facing payment portal |
| Invoice-Linked Requests | ✅ Implemented | Create requests from invoices |

### 8. Stripe Integration
| Feature | Status | Description |
|---------|--------|-------------|
| Stripe Connect Onboarding | ✅ Implemented | Connect Express account setup |
| Account Status | ✅ Implemented | View charges/payouts enabled status |
| Balance View | ✅ Implemented | View available and pending balance |
| Payout History | ✅ Implemented | View payout list with status |
| Stripe Dashboard Link | ✅ Implemented | Quick access to Stripe dashboard |
| Payment Processing | ✅ Implemented | Accept payments on invoices |
| Quote Deposits | ✅ Implemented | Collect deposits via Stripe |
| Tap to Pay | ✅ Implemented | Stripe Terminal for in-person payments |

### 8. Calendar & Scheduling
| Feature | Status | Description |
|---------|--------|-------------|
| Calendar View | ✅ Implemented | Month/week/day calendar views |
| Job Scheduling | ✅ Implemented | Schedule jobs with date/time |
| Dispatch Board | ✅ Implemented | Visual job scheduling grid |
| Drag-Drop Scheduling | ✅ Implemented | Gesture-based dispatch board |
| Google Calendar Sync | 🔜 Planned | Two-way sync with Google Calendar |
| Route Optimization | 🔜 Planned | Optimize daily job routes |

### 9. Team Management
| Feature | Status | Description |
|---------|--------|-------------|
| Team Member Invites | ✅ Implemented | Invite team members via email |
| Role Management | ✅ Implemented | Owner, Admin, Supervisor, Staff roles |
| Role Templates | ✅ Implemented | Pre-configured permission sets |
| Custom Permissions | ✅ Implemented | Granular permission control |
| Permission Middleware | ✅ Implemented | Server-side permission enforcement |
| Adaptive Solo/Team Mode | ✅ Implemented | UI adjusts based on team size |

### 10. Time Tracking
| Feature | Status | Description |
|---------|--------|-------------|
| Timer Widget | ✅ Implemented | Start/stop timer for jobs |
| Time Entries | ✅ Implemented | Manual time entry creation |
| Timesheets | ✅ Implemented | View aggregated time by day/week |
| GPS Check-in | ✅ Implemented | Location-based check-in/out |
| Geofencing | ✅ Implemented | Automatic check-in at job sites |
| Payroll Reports | ✅ Implemented | Time tracking for payroll |

### 11. Communication
| Feature | Status | Description |
|---------|--------|-------------|
| Team Chat | ✅ Implemented | Real-time team messaging |
| Direct Messages | ✅ Implemented | 1:1 messaging between team members |
| Chat Hub | ✅ Implemented | Unified chat interface |
| Job Chat | ✅ Implemented | Context-specific job discussions |
| File Attachments | ✅ Implemented | Share files in chat |
| Email Templates | ✅ Implemented | Customizable email content |
| AI Email Suggestions | ✅ Implemented | AI-powered email content |

### 12. AI Features
| Feature | Status | Description |
|---------|--------|-------------|
| AI Chat Assistant | ✅ Implemented | GPT-4o-mini powered business assistant |
| Smart Suggestions | ✅ Implemented | AI scheduling and action suggestions |
| AI Quote Generator | ✅ Implemented | Generate quotes from photos/voice |
| Instant Job Parser | ✅ Implemented | Parse jobs from text messages |
| Email Generation | ✅ Implemented | AI-written professional emails |
| Proactive Notifications | ✅ Implemented | AI-driven action reminders |
| Australian English | ✅ Implemented | Localized language and phrasing |

### 13. Maps & Location
| Feature | Status | Description |
|---------|--------|-------------|
| Job Map View | ✅ Implemented | Interactive map with job pins |
| Team Location Tracking | ✅ Implemented | Real-time team member locations |
| Activity Status | ✅ Implemented | Speed, battery, last activity |
| Geofence Alerts | ✅ Implemented | Notifications for site entry/exit |

### 14. Forms & Automation
| Feature | Status | Description |
|---------|--------|-------------|
| Custom Form Builder | ✅ Implemented | Create custom job forms |
| Form Templates | ✅ Implemented | Browse and install form templates |
| Form Store | ✅ Implemented | Trade-specific form marketplace |
| Automation Rules | ✅ Implemented | Workflow automation triggers |
| Automation Templates | ✅ Implemented | Pre-built automation sequences |
| Smart Actions | ✅ Implemented | Context-aware action suggestions |

### 15. Reports & Analytics
| Feature | Status | Description |
|---------|--------|-------------|
| Revenue Reports | ✅ Implemented | Income tracking and trends |
| Client Reports | ✅ Implemented | Client activity analysis |
| Team Performance | ✅ Implemented | Staff productivity metrics |
| Job Profitability | ✅ Implemented | Profit margins per job |
| Stripe Payment Reports | ✅ Implemented | Payment analytics |
| CSV Export | ✅ Implemented | Export data for external use |

### 16. Expense Tracking
| Feature | Status | Description |
|---------|--------|-------------|
| Expense CRUD | ✅ Implemented | Create, read, update, delete expenses |
| Expense Categories | ✅ Implemented | Organize expenses by category |
| Job-Linked Expenses | ✅ Implemented | Associate expenses with jobs |
| Receipt Upload | ✅ Implemented | Attach receipt images |

### 17. Settings & Customization
| Feature | Status | Description |
|---------|--------|-------------|
| Business Settings | ✅ Implemented | Company name, logo, contact info |
| Branding Colors | ✅ Implemented | Custom theme colors |
| Trade Type Selection | ✅ Implemented | Industry-specific defaults |
| Email Settings | ✅ Implemented | SMTP/Gmail configuration |
| Advanced Theming | ✅ Implemented | Typography, radius, animations |
| Integration Settings | ✅ Implemented | Configure third-party services |

### 18. Mobile App Features
| Feature | Status | Description |
|---------|--------|-------------|
| React Native App | ✅ Implemented | Full mobile app (Expo SDK 52) |
| Offline Mode | ✅ Implemented | SQLite-based offline storage |
| Background Sync | ✅ Implemented | Automatic data synchronization |
| Conflict Resolution | ✅ Implemented | Handle sync conflicts gracefully |
| Push Notifications | ✅ Implemented | Mobile push notification support |
| Photo Upload | ✅ Implemented | Camera and gallery photo capture |
| Voice Recording | ✅ Implemented | Native voice memo recording |
| Location Tracking | ✅ Implemented | Background location for geofencing |

### 19. PWA & Offline
| Feature | Status | Description |
|---------|--------|-------------|
| Web Manifest | ✅ Implemented | Installable PWA |
| Service Worker | ✅ Implemented | Offline capability basics |
| Offline Indicator | ✅ Implemented | Connection status display |

### 20. Help & Support
| Feature | Status | Description |
|---------|--------|-------------|
| FAQ System | ✅ Implemented | 6 categorized FAQ sections |
| App Walkthrough | ✅ Implemented | Guided 5-step onboarding tour |
| Support Tab | ✅ Implemented | Centralized help resources |

---

## Technical Stack

### Frontend (Web)
- React 18 with TypeScript
- Vite for build tooling
- TailwindCSS + shadcn/ui (Radix UI)
- TanStack Query for state management
- Wouter for routing
- Framer Motion for animations
- Leaflet for maps

### Frontend (Mobile)
- React Native with Expo SDK 52
- Zustand for state management
- SQLite for offline storage
- expo-location, expo-camera, expo-audio

### Backend
- Express.js with TypeScript
- PostgreSQL (Neon serverless)
- Drizzle ORM
- Zod for validation
- Puppeteer for PDF generation

### Integrations
- Stripe (Connect, Elements, Terminal)
- SendGrid / Gmail
- Google OAuth 2.0
- Google Maps API
- OpenAI GPT-4o-mini
- Twilio (SMS)
- Google Cloud Storage

---

## Feature Count Summary

| Category | Features |
|----------|----------|
| Authentication | 7 |
| Client Management | 6 |
| Job Management | 15 |
| Quotes | 11 |
| Invoices | 10 |
| Payment Hub | 7 |
| Collect Payment | 8 |
| Stripe | 8 |
| Calendar | 4 (+ 2 planned) |
| Team | 6 |
| Time Tracking | 6 |
| Communication | 7 |
| AI Features | 7 |
| Maps & Location | 4 |
| Forms & Automation | 6 |
| Reports | 6 |
| Expenses | 4 |
| Settings | 6 |
| Mobile | 8 |
| PWA | 3 |
| Help | 3 |
| **Total Implemented** | **142** |
| **Total Planned** | **2** |

---

*Last Updated: December 2025*
