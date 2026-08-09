# JobRunner - App Store Submission Guide

## App Information

**App Name:** JobRunner  
**Subtitle:** Business Management for Tradies  
**Bundle ID:** com.jobrunner.app  
**Version:** 1.1.0  
**Category:** Business  
**Secondary Category:** Productivity  
**Age Rating:** 4+  

---

## App Description (4000 characters max)

JobRunner is the complete business management platform designed specifically for Australian trade businesses. Whether you're a solo sparky running your own ABN, a plumber managing a small team, or running a growing electrical contracting business, JobRunner helps your business manage jobs, send quotes, create invoices, and get paid faster.

**JOB MANAGEMENT**
Create and track jobs from first contact to completion. Add job photos, notes, and checklists. Track job status through a simple 5-stage workflow: Pending, Scheduled, In Progress, Done, and Invoiced. Access job details even when you're offline.

**PROFESSIONAL QUOTES & INVOICES**
Send professional quotes and invoices that represent your business well. Choose from templates or upload your own design. Include your logo, ABN, and business details. Automatic GST calculation built in.

**GET PAID FASTER**
Accept card payments on-site with Tap to Pay. Generate QR codes for quick payments. Send payment links via SMS. Track what's been paid and chase overdue invoices with automated reminders.

**TEAM MANAGEMENT**
Add team members and assign jobs. Track where your crew is with real-time location. Automatic clock-in when tradies arrive at job sites using geofence technology. Review timesheets and manage payroll data.

**SMART SCHEDULING**
View all your jobs on a calendar. Optimise your route for the day. Sync with Google Calendar so you never miss an appointment.

**REPORTS & INSIGHTS**
Track your business performance with easy-to-read reports. See revenue, outstanding invoices, and job completion rates. Export data for your accountant or BAS reporting.

**INTEGRATIONS**
Connect to Xero for seamless accounting. Sync contacts and push invoices automatically.

**BUILT FOR AUSSIE TRADE BUSINESSES**
- Australian dollar (AUD) support
- GST included on all invoices
- ABN display on documents
- Australian address format

**BUSINESS PLANS**
Starter: Core business features for getting started
Pro: Unlimited jobs, payments, and reporting for growing businesses
Team: Everything in Pro plus team management for trade businesses with employees

Subscriptions are purchased by the business via jobrunner.com.au.

---

## Keywords (100 characters max, comma-separated)

tradies,job management,invoicing,quotes,plumber,electrician,tradie,ABN,GST,payments,aussie business

---

## What's New in This Version

Welcome to JobRunner 1.1! Everything your trade business needs:

- Create and manage jobs with photos and notes
- Send professional quotes and invoices
- Accept payments with Tap to Pay, QR codes, and payment links
- Track your team's location and work hours
- Automatic clock-in at job sites with geofence
- Business reports and insights
- Xero integration for seamless accounting
- Works offline - sync when you're back online

---

## Support URL

https://jobrunner.com.au/support

## Marketing URL

https://jobrunner.com.au

## Privacy Policy URL

https://jobrunner.com.au/privacy

## Terms of Service URL

https://jobrunner.com.au/terms

---

## App Review Notes

**Demo Account:**
- Email: demo@jobrunner.com.au
- Password: demo123456

This demo account has pre-populated data including sample jobs, clients, quotes, and invoices for testing all features.

**IMPORTANT: Enterprise Services — Guideline 3.1.3(c)**

JobRunner is an enterprise field service management platform sold exclusively to Australian trade businesses (electrical contractors, plumbing businesses, building companies, etc.). It is NOT a consumer application.

Key points for review:
- All accounts represent registered Australian businesses (ABN required during onboarding)
- Business subscriptions are purchased by the trade business entity directly via our website (jobrunner.com.au), not by individual consumers
- The app does not sell digital content, digital goods, or in-app consumables
- The app manages physical-world trade services: job site management, on-site payments, team dispatch, physical labour and materials invoicing
- No subscription purchase, upgrade prompts, or external payment links exist within the iOS app
- The app only displays the business's current plan status and usage
- This is comparable to other enterprise field service apps such as ServiceM8, Tradify, and Fergus which operate under the same enterprise services model

**NFC / Tap to Pay:**
The app includes Stripe Terminal SDK for accepting contactless card payments from clients at job sites. This is a standard Stripe Tap to Pay integration for processing real-world payments for physical trade services (not NFC tag reading). The NFC capability is used solely for reading payment cards via Stripe Terminal when a client taps their card to pay for a completed job. No NFC tags are read or written by this app.

**Payment Testing:**
Stripe test mode is enabled for the demo account. Use test card 4242 4242 4242 4242 with any future expiry and CVC to test on-site payment collection.

**Location Features:**
Background location is used for:
1. Team Tracking - Business owners/managers can see where their team members are in real-time on the dispatch map
2. Geofence Auto Clock-In - Automatically starts time tracking when employees arrive at job sites
Location tracking is optional and requires explicit user consent. It can be disabled in Settings > App Settings.

---

## Required Permissions Explanation

**Camera (NSCameraUsageDescription):**
"JobRunner uses your camera to take before-and-after photos of job sites, attach photo evidence to quotes and invoices, and scan documents for your records."

**Photo Library (NSPhotoLibraryUsageDescription):**
"JobRunner accesses your photo library so you can attach existing site photos to jobs, quotes, and invoices as visual records for your clients."

**Microphone (NSMicrophoneUsageDescription):**
"JobRunner uses your microphone to record voice notes that are transcribed and attached to jobs, allowing you to dictate site observations hands-free while working."

**Location When In Use (NSLocationWhenInUseUsageDescription):**
"JobRunner uses your location to show your position on the dispatch map, display nearby job sites, calculate travel distance for timesheets, and provide navigation to your next job."

**Location Always (NSLocationAlwaysAndWhenInUseUsageDescription):**
"JobRunner uses your background location so your team's live positions appear on the dispatch map and to automatically clock you in and out when you arrive at or leave a job site using geofence technology. Your location is only shared with your business owner or manager."
- This is OPTIONAL and requires explicit user consent in the app

**NFC (NFCReaderUsageDescription):**
"JobRunner uses NFC to accept contactless card payments from clients on-site via Stripe Terminal Tap to Pay."

**Bluetooth (NSBluetoothAlwaysUsageDescription):**
"JobRunner uses Bluetooth to connect to Stripe card readers for processing on-site client payments."

---

## Screenshot Requirements

### iPhone 6.7" (iPhone 14 Pro Max / 15 Pro Max)
1. Dashboard showing today's jobs
2. Job detail page with photos and notes
3. Quote/Invoice creation screen
4. Tap to Pay collection screen
5. Team management with map view
6. Reports and analytics dashboard

### iPhone 6.5" (iPhone 11 Pro Max / 12 Pro Max)
Same as above

### iPhone 5.5" (iPhone 8 Plus)
Same as above (scaled)

### iPad Pro 12.9"
1. Dashboard with sidebar navigation
2. Job detail with photo gallery
3. Financial overview
4. Team location map

---

## App Privacy Details

**Data Linked to You:**
- Contact Info (name, email, phone)
- Financial Info (payment cards via Stripe)
- Location (precise location for team tracking)
- User Content (photos, documents, notes, voice memos)
- Audio Data (voice notes recorded and transcribed for job records)
- Identifiers (user ID)

**Data Not Linked to You:**
- Usage Data (app analytics)
- Diagnostics (crash logs, performance data)

**Data Used for Tracking:**
None

**Data Collected:**
| Category | Purpose | Linked to Identity |
|----------|---------|-------------------|
| Contact Info | App Functionality | Yes |
| Financial Info | App Functionality | Yes |
| Precise Location | App Functionality | Yes |
| Photos or Videos | App Functionality | Yes |
| Other User Content | App Functionality | Yes |
| Audio Data | App Functionality | Yes |
| User ID | App Functionality | Yes |
| Crash Data | App Functionality | No |
| Performance Data | Analytics | No |

---

## Third-Party Services

1. **Stripe** - Payment processing (Tap to Pay for on-site client payments)
2. **SendGrid** - Email delivery for invoices/quotes
3. **Twilio** - SMS notifications
4. **Google Cloud** - Photo storage
5. **Xero** - Accounting integration (optional)
6. **Google Calendar** - Calendar sync (optional)
7. **OpenAI** - AI assistant features

All services comply with Australian Privacy Principles and GDPR.

---

## Contact Information

**Developer:** LinkUp2Care Pty Ltd  
**Email:** admin@avwebinnovation.com  
**Phone:** +61 485 013 994  
**Address:** Sydney, NSW, Australia  

---

## Checklist Before Submission

- [ ] TestFlight build tested on real device
- [ ] All permissions work correctly
- [ ] Demo account accessible and has data (password: demo123456)
- [ ] Privacy Policy URL is live
- [ ] Terms of Service URL is live
- [ ] Support URL is live
- [ ] App icon meets guidelines (1024x1024, no alpha)
- [ ] Screenshots prepared for all device sizes
- [ ] All text is spelled correctly (Australian English)
- [ ] No placeholder or Lorem Ipsum text
- [ ] Stripe test mode works in TestFlight
- [ ] Account deletion works (Settings > Delete Account)
- [ ] Background location indicator shows when tracking
- [ ] Offline mode works correctly
- [ ] No external upgrade/billing links in the app (enterprise exemption)
- [ ] Subscription page only shows plan status, no purchase CTAs
- [ ] NFC note provided in App Review Information
- [ ] Enterprise services exemption (3.1.3c) clearly stated in review notes
