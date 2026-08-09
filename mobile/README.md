# JobRunner Mobile App

React Native mobile app for JobRunner - built with Expo SDK 52.

## TypeScript Check

CI runs `mobile/scripts/typecheck.sh` automatically on every push and PR that
touches `mobile/**` (see `.github/workflows/mobile-typecheck.yml`). The script
runs `tsc --noEmit` and fails the build if any TypeScript error appears that
is not already catalogued in `mobile/scripts/typecheck-baseline.txt`. The diff
of new errors is printed in the failure log.

Local usage:

```bash
# Verify no regressions vs. the committed baseline
bash mobile/scripts/typecheck.sh

# After intentionally fixing baseline errors, re-record the baseline and
# commit the updated file
bash mobile/scripts/typecheck.sh --update
```


## Features

### Core Screens
- **Dashboard** - Today's jobs, KPIs, greeting, quick actions
- **Jobs** - View, filter, and manage jobs with 5-stage status workflow
- **Collect Payment** - Tap to Pay, QR codes, payment links
- **Profile** - Account settings, business settings, team management

### Native Features
- **Tap to Pay** - NFC contactless payments via Stripe Terminal SDK (requires native build)
- **Push Notifications** - Real-time job updates, payment alerts, team messages
- **Offline Mode** - SQLite caching for jobs and clients, sync queue for poor connectivity
- **Background Location** - Life360-style team tracking with geofence alerts

## Tech Stack

- **Framework**: React Native with Expo SDK 52
- **Navigation**: Expo Router (file-based routing)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **Backend**: Connects to existing JobRunner Express API

## Getting Started

### Prerequisites

1. Install Node.js 18+
2. Install Expo CLI: `npm install -g expo-cli`
3. Download **Expo Go** app on your phone (iOS App Store / Google Play)

### Development (Expo Go)

```bash
# Navigate to mobile directory
cd mobile

# Install dependencies
npm install

# Start development server
npm start

# Scan QR code with Expo Go app to preview on your phone
```

**Note**: Some features require a native build:
- Tap to Pay (NFC) - requires EAS Build
- Background location - requires native permissions
- Push notifications - work in Expo Go but need native build for production

### Native Build (EAS)

For Tap to Pay and production:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure

# Build for iOS (requires Apple Developer account)
eas build --platform ios

# Build for Android
eas build --platform android
```

## Project Structure

```
mobile/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Auth screens (login, register)
│   ├── (tabs)/            # Main tab screens
│   │   ├── index.tsx      # Dashboard
│   │   ├── jobs.tsx       # Jobs list
│   │   ├── collect.tsx    # Collect payment
│   │   └── profile.tsx    # Profile & settings
│   └── job/               # Job detail screens
├── src/
│   ├── components/        # Reusable UI components
│   ├── hooks/             # Custom React hooks
│   │   └── useServices.ts # Stripe Terminal, Notifications, Offline, Location
│   └── lib/               # Core services
│       ├── api.ts         # API client with Bearer auth
│       ├── store.ts       # Zustand stores
│       ├── stripe-terminal.ts    # NFC Tap to Pay
│       ├── notifications.ts      # Push notifications
│       ├── offline-storage.ts    # SQLite caching
│       └── location-tracking.ts  # GPS/geofence
├── assets/                # Images, icons
└── app.config.ts          # Expo configuration
```

## Environment Variables

Create a `.env` file in the mobile directory:

```
EXPO_PUBLIC_API_URL=https://jobrunner.com
```

## Feature Details

### Tap to Pay (Stripe Terminal)
- Uses phone's NFC chip for contactless payments
- Customer taps card/phone on back of device
- Supports Apple Pay, Google Pay, contactless cards
- Minimum $5 payment, 2.9% + $0.30 per transaction
- **Requires**: Native build + Apple Tap to Pay entitlement

### Push Notifications
- Job assignment alerts
- Payment received notifications
- Quote accepted/rejected alerts
- Team messages
- Android notification channels for different types

### Offline Mode
- SQLite database for local caching
- Jobs and clients cached for offline access
- Sync queue for pending changes
- Automatic sync when connection restored
- Network state monitoring

### Background Location
- 30-second update interval
- Battery-efficient tracking
- Geofence alerts (100m radius) for job site arrivals/departures
- Activity detection (stationary, walking, driving, working)
- Data sent to backend for team visibility map

## API Endpoints

The mobile app uses these backend endpoints:

**Authentication**
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/me` - Get current user

**Jobs**
- `GET /api/jobs` - All jobs
- `GET /api/jobs/today` - Today's scheduled jobs
- `GET /api/jobs/:id` - Job details
- `PATCH /api/jobs/:id` - Update job status

**Payments (Stripe Terminal)**
- `POST /api/stripe/terminal-connection-token` - Get connection token
- `POST /api/stripe/create-terminal-payment-intent` - Create payment intent

**Location**
- `POST /api/team-locations` - Send location update
- `POST /api/geofence-events` - Report job site arrival/departure

**Notifications**
- `POST /api/push-tokens` - Register push token

## Test Accounts

Use these accounts to test:
- `luke@harriselectrical.com.au` (solo owner) - Password: `Test123!`
- `mike@northqldplumbing.com.au` (team owner) - Password: `Test123!`
- `tom@northqldplumbing.com.au` (staff) - Password: `Test123!`

## App Store Requirements

### iOS
1. Apple Developer Program ($99/year)
2. Tap to Pay entitlement (apply through Apple)
3. App Store review for NFC usage

### Android
1. Google Play Developer account ($25 one-time)
2. NFC permission in manifest

## License

Proprietary - JobRunner
