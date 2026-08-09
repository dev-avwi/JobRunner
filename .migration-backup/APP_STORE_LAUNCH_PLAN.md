# JobRunner App Store Launch Plan

## Current Status: READY TO BUILD

Your mobile app is configured and ready for app store submission. Here's your complete launch checklist.

---

## Prerequisites (You Need These)

### 1. Apple Developer Account ($99/year)
- Sign up at [developer.apple.com](https://developer.apple.com/programs/)
- Takes 24-48 hours for approval
- Required for iOS App Store

### 2. Google Play Developer Account ($25 one-time)
- Sign up at [play.google.com/console](https://play.google.com/console/signup)
- Approved within hours
- Required for Android Play Store

### 3. Expo Account (Free)
- Already configured: Project ID `78e88ca7-014e-438b-8170-1ccae4cd9386`
- Install EAS CLI: `npm install -g eas-cli`
- Login: `eas login`

---

## App Configuration (Already Done)

| Setting | iOS | Android |
|---------|-----|---------|
| App Name | JobRunner | JobRunner |
| Bundle ID | com.jobrunner.app | com.jobrunner.app |
| Version | 1.0.0 | 1.0.0 |
| Icon | Configured | Configured |
| Splash Screen | Configured | Configured |
| Permissions | Camera, Photos, Location, NFC | Camera, Storage, Location, NFC |

---

## Phase 1: Build Production Apps

### Step 1: Navigate to Mobile Directory
```bash
cd mobile
```

### Step 2: Login to EAS
```bash
eas login
```

### Step 3: Build for iOS
```bash
eas build --platform ios --profile production
```
This creates an `.ipa` file uploaded to Expo's servers.

### Step 4: Build for Android
```bash
eas build --platform android --profile production
```
This creates an `.aab` file (Android App Bundle).

**Build Time:** ~15-30 minutes per platform

---

## Phase 2: Prepare Store Assets

### iOS App Store Requirements

| Asset | Size | Status |
|-------|------|--------|
| App Icon | 1024x1024px (no transparency) | NEEDED |
| iPhone Screenshots (6.7") | 1290x2796px | NEEDED |
| iPhone Screenshots (6.5") | 1284x2778px | NEEDED |
| iPhone Screenshots (5.5") | 1242x2208px | NEEDED |
| iPad Screenshots (12.9") | 2048x2732px | NEEDED |
| Privacy Policy URL | Web page | HAVE (jobrunner.com.au/privacy) |
| Support URL | Web page | NEEDED |

### Google Play Store Requirements

| Asset | Size | Status |
|-------|------|--------|
| App Icon | 512x512px | HAVE |
| Feature Graphic | 1024x500px | NEEDED |
| Phone Screenshots | At least 2 | NEEDED |
| Privacy Policy URL | Web page | HAVE |
| Content Rating | Complete questionnaire | NEEDED |

### Recommended Screenshots (5-8 per store)
1. **Today's Schedule** - Show daily job overview
2. **Job Management** - Create/edit job screen
3. **Quote Builder** - Professional quote creation
4. **Invoice & Payments** - Send invoice, Stripe payment
5. **Live Map** - Team tracking feature
6. **AI Assistant** - Smart suggestions in action
7. **Offline Mode** - Works without internet
8. **Client Management** - Client details screen

---

## Phase 3: Submit to App Stores

### iOS Submission

1. **Submit Build to App Store Connect:**
```bash
eas submit --platform ios
```

2. **Complete App Store Connect Setup:**
   - Log into [App Store Connect](https://appstoreconnect.apple.com)
   - Go to your app → App Information
   - Add: App description, keywords, screenshots, privacy policy URL
   - Set pricing (Free with in-app subscription)
   - Answer export compliance questions
   - Submit for Review

3. **Review Timeline:** 24-48 hours typically

### Android Submission

1. **First Submission (Manual Upload Required):**
   - Download `.aab` from Expo dashboard
   - Upload directly to [Google Play Console](https://play.google.com/console)
   - Complete store listing (description, screenshots, feature graphic)
   - Complete content rating questionnaire
   - Set up pricing & distribution

2. **Subsequent Updates (Automated):**
```bash
eas submit --platform android
```

3. **Review Timeline:** ~24 hours typically

---

## Phase 4: Post-Launch

### Monitor & Update

1. **EAS Update (OTA Updates):**
   - Push JavaScript changes without re-submission
   ```bash
   eas update --branch production
   ```

2. **Monitor Crashes:**
   - Use Expo's error tracking
   - Monitor App Store/Play Console crash reports

3. **Respond to Reviews:**
   - Answer user reviews promptly
   - Address issues in updates

---

## App Store Listing Copy

### Short Description (80 chars)
```
Job management for Aussie tradies. Quotes, invoices, payments - all in one.
```

### Full Description
```
JobRunner is the complete job management app built for Australian tradespeople.

MANAGE JOBS
• Create and track jobs from quote to completion
• 5-stage workflow: Lead → Quote Sent → Accepted → In Progress → Complete
• Take before/after photos with markup tools
• Digital signatures for job sign-off
• Offline mode - works without internet

QUOTES & INVOICES
• Professional PDF quotes and invoices
• GST automatically calculated
• Quick templates for common jobs
• Convert quotes to invoices instantly

GET PAID FASTER
• Stripe payment links on every invoice
• Accept card payments on-site (Tap to Pay)
• Payment reminders and tracking
• Sync with Xero accounting

TEAM FEATURES
• Live map showing team locations
• Assign jobs to team members
• Team chat and job notes
• Time tracking and GPS check-in

AI-POWERED
• Smart job suggestions from SMS
• AI-generated quote descriptions
• Contextual next-action prompts

Built in Australia, for Australian tradies. Prices in AUD with GST support.

Free to start • No lock-in contracts • Australian support
```

### Keywords (iOS, 100 char max)
```
tradie,job management,invoice,quote,plumber,electrician,trade,field service,australia,gst
```

---

## Pricing Strategy

### Free Tier
- 5 jobs/month
- 5 invoices/month
- 10 quotes/month
- 10 clients max
- Basic features

### Pro Tier ($29/month or $290/year)
- Unlimited everything
- Team management
- AI assistant
- Priority support
- Advanced reports

---

## Timeline Estimate

| Phase | Duration |
|-------|----------|
| Developer Account Setup | 1-2 days |
| Create Screenshots & Assets | 1-2 days |
| Build Production Apps | 1 day |
| Submit & Complete Listings | 1 day |
| App Review | 1-3 days |
| **Total** | **5-10 days** |

---

## Quick Start Commands

```bash
# 1. Go to mobile directory
cd mobile

# 2. Login to Expo/EAS
eas login

# 3. Build both platforms
eas build --platform all --profile production

# 4. Submit iOS
eas submit --platform ios

# 5. Submit Android (after first manual upload)
eas submit --platform android
```

---

## Support & Resources

- **Expo EAS Docs:** https://docs.expo.dev/build/introduction/
- **iOS Submission Guide:** https://docs.expo.dev/submit/ios/
- **Android Submission Guide:** https://docs.expo.dev/submit/android/
- **App Store Guidelines:** https://developer.apple.com/app-store/review/guidelines/
- **Google Play Policies:** https://play.google.com/about/developer-content-policy/

---

## Next Steps for You

1. **Sign up for Apple Developer Account** ($99/year) - [Link](https://developer.apple.com/programs/)
2. **Sign up for Google Play Console** ($25 one-time) - [Link](https://play.google.com/console/signup)
3. **Create app screenshots** (use iPhone/Android emulator or real device)
4. **Create feature graphic** for Google Play (1024x500px)
5. **Run the build commands** listed above
6. **Complete store listings** and submit for review

---

*Last Updated: December 17, 2025*
