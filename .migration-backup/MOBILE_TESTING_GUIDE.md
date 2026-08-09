# JobRunner Mobile Testing Guide

This guide provides step-by-step instructions for manually testing JobRunner on your mobile phone.

## Getting Started

### Access the App
1. Open your mobile browser (Safari on iPhone, Chrome on Android)
2. Navigate to your JobRunner URL
3. For the best experience, add the app to your home screen:
   - **iPhone**: Tap Share > Add to Home Screen
   - **Android**: Tap the menu (3 dots) > Add to Home Screen

### Demo Account (Pre-configured)
- **Email**: demo@jobrunner.com.au
- **Password**: demo123456
- **Plan**: Team (full access)

---

## Test 1: Landing Page & Sign Up

### Steps
1. Open the app URL in your mobile browser
2. Verify the landing page displays correctly:
   - Hero section with business tagline
   - Feature highlights
   - Pricing section with 3 tiers (Free, Pro, Team)
3. Tap "Get Started Free" or similar CTA
4. Verify the signup page loads

### Expected Results
- Page is mobile-responsive (no horizontal scrolling)
- Buttons are touch-friendly (large enough to tap)
- Pricing cards display correctly on mobile

---

## Test 2: Login & Dashboard

### Steps
1. Navigate to login page
2. Enter demo credentials:
   - Email: demo@jobrunner.com.au
   - Password: demo123456
3. Tap Sign In
4. Verify dashboard loads

### Expected Results
- Form fields are easy to use on mobile keyboard
- Dashboard shows:
  - Today's Schedule (if available)
  - Quick stats (jobs, invoices, etc.)
  - Navigation sidebar (accessible via hamburger menu)

---

## Test 3: Navigation

### Steps
1. Tap the hamburger menu (3 lines) or sidebar toggle
2. Verify all menu items are visible:
   - Dashboard
   - Work (Jobs)
   - Clients
   - Quotes
   - Invoices
   - Payment Hub
   - Schedule
   - Time Tracking
   - Team
   - Chat
   - Map
   - Templates
3. Tap each menu item and verify page loads

### Expected Results
- Menu slides in/out smoothly
- All pages are mobile-responsive
- Touch targets are appropriately sized

---

## Test 4: Create a Job

### Steps
1. Navigate to Work or tap the + button
2. Tap "New Job"
3. Fill in job details:
   - Title: "Test Mobile Job"
   - Client: Select from dropdown
   - Description: "Created from mobile"
   - Address: Enter any address
4. Tap "Create Job"

### Expected Results
- Form scrolls smoothly
- Dropdowns work on mobile
- Keyboard doesn't block inputs
- Success message appears
- Job appears in list

---

## Test 5: Create a Quote

### Steps
1. Navigate to Quotes
2. Tap "New Quote"
3. Fill in:
   - Client: Select from dropdown
   - Title: "Mobile Test Quote"
   - Add line item:
     - Description: "Labour"
     - Quantity: 2
     - Unit Price: 85
4. Verify live preview updates
5. Tap "Create Quote"

### Expected Results
- Live preview shows on mobile (may be below form)
- GST calculates correctly (10%)
- Total displays correctly
- Quote saves successfully

---

## Test 6: Create an Invoice

### Steps
1. Navigate to Invoices
2. Tap "New Invoice"
3. Fill in:
   - Client: Select from dropdown
   - Title: "Mobile Test Invoice"
   - Add line item
4. Tap "Create Invoice"

### Expected Results
- Invoice editor works on mobile
- Calculations display correctly
- Invoice saves successfully

---

## Test 7: Client Management

### Steps
1. Navigate to Clients
2. Tap "Add Client" or "+"
3. Fill in:
   - Name: "Mobile Test Client"
   - Email: test@example.com
   - Phone: 0412 345 678
4. Tap Save
5. Verify client appears in list
6. Tap on client to view details

### Expected Results
- Client form is mobile-friendly
- Client list displays correctly
- Client detail shows contact info

---

## Test 8: Team Management

### Steps
1. Navigate to Team
2. View existing team members
3. Tap "Invite Team Member"
4. Fill in:
   - First Name: Test
   - Last Name: Member
   - Email: unique@example.com
   - Role: Select Technician
5. Tap "Send Invite"

### Expected Results
- Team list displays correctly on mobile
- Invite modal is mobile-friendly
- Success toast appears

---

## Test 9: Map View

### Steps
1. Navigate to Map
2. Allow location permissions if prompted
3. Verify map loads with job pins
4. Tap on a job pin
5. View job popup info

### Expected Results
- Map is interactive (pan, zoom with gestures)
- Job pins are visible and tappable
- Popup shows job info

---

## Test 10: Chat

### Steps
1. Navigate to Chat
2. Open Team Chat
3. Type a message
4. Send message

### Expected Results
- Chat loads quickly
- Message input works with mobile keyboard
- Messages appear in real-time

---

## Test 11: Templates Hub

### Steps
1. Navigate to Templates
2. View template categories
3. Tap on a template (e.g., Email Templates)
4. View or edit template

### Expected Results
- Templates list displays correctly
- Template editor is usable on mobile
- Preview shows formatted content

---

## Test 12: Payment Collection

### Steps
1. Navigate to Collect Payment
2. Select an invoice or enter amount
3. View payment options

### Expected Results
- Payment methods display correctly
- Amount input works on mobile
- All options are accessible

---

## Test 13: Offline Capability (PWA)

### Steps
1. Add app to home screen (if not already)
2. Turn on Airplane mode
3. Open the app
4. Try to view previously loaded data

### Expected Results
- App opens without internet (cached)
- Cached pages/data are viewable
- Offline indicator appears

---

## Test 14: Responsive Design Check

### Tests to Perform
1. **Rotate device** - Verify layout adjusts for landscape/portrait
2. **Different screen sizes** - Test on phone and tablet if available
3. **Zoom** - Verify text is readable without zooming
4. **Touch targets** - All buttons are at least 44x44px

### Expected Results
- No horizontal scrolling in portrait mode
- Layout adapts to different orientations
- All interactive elements are easily tappable

---

## Known Issues & Workarounds

1. **Keyboard covering inputs**: Scroll up if keyboard covers a field
2. **Map gestures**: Two-finger pinch for zoom works best
3. **File uploads**: Use camera or photo library when prompted

---

## Reporting Bugs

When reporting issues, please include:
1. Device model (e.g., iPhone 14, Samsung Galaxy S23)
2. OS version (e.g., iOS 17.2, Android 14)
3. Browser (Safari, Chrome, etc.)
4. Steps to reproduce
5. Screenshots if possible

---

## Quick Reference

| Feature | Mobile Status |
|---------|--------------|
| Landing Page | Responsive |
| Login/Signup | Optimized |
| Dashboard | Mobile-first |
| Jobs | Full support |
| Quotes | Live preview |
| Invoices | Full support |
| Clients | Full support |
| Team | Full support |
| Map | Touch gestures |
| Chat | Real-time |
| Templates | Full support |
| Payments | Full support |
| PWA | Offline ready |

---

**Last Updated**: December 28, 2025
