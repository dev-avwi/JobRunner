# JobRunner App Store Submission Guide

## Pre-Submission Checklist

### 1. Apple Developer Account Setup (DONE)
- [x] Apple Developer Program enrolled ($99/year)
- [x] App Store Connect app created (ID: 6756844699)
- [x] Bundle ID registered: `com.jobrunner.app`

### 2. Production Environment
- [ ] **CRITICAL**: Ensure `https://jobrunner.com` is pointing to your production server
- [ ] Verify the API is responding (no 503 errors)
- [ ] Test login flow works end-to-end

### 3. Demo Account for Apple Review
Create a demo account Apple's reviewers can use to test the app:

**Demo Credentials (add these to App Store Connect):**
- Email: `demo@jobrunner.com.au`
- Password: `demo123`

**Note**: This is the existing demo account with pre-populated sample data.

### 4. App Store Connect Metadata

#### App Information
- **App Name**: JobRunner
- **Subtitle**: Job Management for Tradies (30 chars max)
- **Category**: Business
- **Secondary Category**: Productivity

#### Description (4000 chars max)
```
JobRunner is the all-in-one business management app built specifically for Australian tradespeople.

Whether you're a sparkie, plumber, chippy, or any other tradie, JobRunner helps you run your business from your pocket.

KEY FEATURES:

Job Management
- Track jobs from quote to completion
- 5-stage workflow: Scheduled → In Progress → Completed → Invoiced → Paid
- Add photos, notes, and time tracking to every job
- Assign jobs to team members

Professional Quotes & Invoices
- Create professional quotes in minutes
- Convert quotes to invoices with one tap
- GST-compliant Australian tax calculations
- Send via email or SMS directly to clients

Get Paid Faster
- Accept card payments via Stripe
- Generate QR codes for instant payment
- Track overdue invoices
- Automated payment reminders

Team Management
- Add unlimited team members
- Role-based permissions (Owner, Manager, Worker)
- Real-time location tracking
- Time tracking and timesheets

Smart Scheduling
- Daily schedule dashboard
- Google Calendar integration
- AI-powered scheduling suggestions
- Job reminders and notifications

Works Offline
- Full offline support for job sites with poor signal
- Automatic sync when back online
- Never lose your work

PRICING:
- Free: Up to 3 active jobs
- Pro: Unlimited jobs, quotes, invoices ($29/month)
- Team: All Pro features + team management ($49/month)

Built in Australia, for Australians. All prices in AUD with GST included.

Download JobRunner today and take control of your trades business!
```

#### Keywords (100 chars max, comma-separated)
```
tradie,tradesman,job management,invoice,quote,plumber,electrician,carpenter,contractor,field service
```

#### Privacy Policy URL
You need a hosted privacy policy. Options:
1. Add to your website: `https://jobrunner.com/privacy`
2. Use a service like Termly or iubenda

#### Support URL
`https://jobrunner.com/support` or your email

### 5. Screenshots Required

**iPhone 6.7" Display (1290 x 2796 pixels)**
Required screens:
1. Dashboard / Today's Schedule
2. Job list or job detail view
3. Create/edit quote
4. Invoice with payment options
5. Team map or team list
6. Client list

**iPhone 6.5" Display (1284 x 2778 pixels)**
Same screens as above

**iPad Pro 12.9" (2048 x 2732 pixels)**
Same screens (if supporting iPad)

### 6. App Icon
- 1024 x 1024 pixels PNG (no alpha/transparency)
- Already configured in `mobile/assets/icon.png`

### 7. App Review Information

**Contact Information:**
- First Name: [Your first name]
- Last Name: [Your last name]
- Phone: [Your phone]
- Email: [Your email]

**Demo Account:**
- Username: `demo@jobrunner.com.au`
- Password: `demo123`

**Notes for Reviewer:**
```
JobRunner is a business management app for Australian tradespeople (electricians, plumbers, builders, etc.).

To test the full functionality:
1. Log in with the demo account provided
2. View the dashboard to see today's scheduled jobs
3. Tap a job to see job details, add photos, or update status
4. Go to Quotes to create a new quote
5. Go to Invoices to see invoice management
6. The app requires internet connection for full functionality

The app uses:
- Camera: To take photos of job sites
- Location: To track team member locations (optional)
- Notifications: For job reminders and updates

All features work with the demo account. No real payments will be processed.
```

### 8. Privacy Declarations (App Privacy)

**Data Collected:**
- Contact Info (name, email, phone) - for account creation
- Location - for team tracking (optional)
- Photos - for job documentation
- Payment Info - processed by Stripe (not stored)

**Data Usage:**
- App Functionality
- Analytics (optional)

**Data Linked to User:**
- Contact Info
- User Content (photos, job data)

### 9. Build & Submit Commands

From the `mobile` directory:

```bash
# Install EAS CLI if not installed
npm install -g eas-cli

# Login to Expo
eas login

# Build for iOS production
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios --latest
```

### 10. Common Rejection Reasons to Avoid

1. **Crasher/Server Error** (PREVIOUS ISSUE - FIXED)
   - Ensure production API is running 24/7
   - Test login flow before submission

2. **Login Required but No Demo Account**
   - Always provide demo credentials in App Review Information

3. **Incomplete Functionality**
   - All features shown must work
   - No placeholder text or "Coming Soon" features

4. **Missing Privacy Policy**
   - Must have accessible privacy policy URL

5. **Inaccurate Screenshots**
   - Screenshots must match actual app UI

6. **Missing Purpose Strings**
   - All permission requests must explain why (already configured)

## Beta Launch: First 10 Lifetime Free Users

### How to Track Beta Users
1. Create a `betaUsers` field in the users table
2. First 10 users who sign up get `isBetaUser: true`
3. Beta users bypass subscription checks

### Promotional Plan
1. Launch in App Store with standard pricing visible
2. Promote "First 10 users get LIFETIME FREE access"
3. Collect testimonials from beta users for marketing

## Post-Submission Checklist

- [ ] Monitor App Store Connect for review status
- [ ] Respond promptly to any reviewer questions
- [ ] Prepare press release / social media announcements
- [ ] Set up analytics to track downloads
- [ ] Prepare onboarding emails for new users

---

**Estimated Review Time**: 24-48 hours (can be longer for first submission)

**Good luck with your submission!**
