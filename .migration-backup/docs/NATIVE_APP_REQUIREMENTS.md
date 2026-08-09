# JobRunner Native App Requirements

## Overview

This document outlines the technical requirements and architecture for converting JobRunner from a Progressive Web App (PWA) to a React Native mobile application. The primary driver for this conversion is enabling **phone-to-phone NFC Tap to Pay** using Stripe Terminal SDK, which requires native device access not available in web browsers.

## Target Platforms

- **iOS**: iOS 15.4+ (required for Tap to Pay on iPhone)
- **Android**: Android 9+ with NFC support

## Core Technology Stack

### Framework
- **React Native** with **Expo SDK 53+**
- **Expo Dev Client** for native module access
- **TypeScript** for type safety

### Navigation
- Replace `wouter` with `@react-navigation/native`
- Stack navigator for main flows
- Tab navigator for bottom navigation (Dashboard, Jobs, Calendar, More)

### State Management
- **TanStack Query** (React Query) - already in use, compatible with React Native
- Keep existing query patterns and cache invalidation

### UI Components
- Replace shadcn/ui + Tailwind with:
  - **React Native Paper** (Material Design components)
  - **NativeWind** (Tailwind CSS for React Native)
- Preserve design tokens from `design_guidelines.md`

## Stripe Terminal Integration (Tap to Pay)

### Requirements

1. **Stripe Terminal React Native SDK**
   ```
   @stripe/stripe-terminal-react-native
   ```

2. **Apple Pay Entitlements** (iOS)
   - Apple Developer Program membership ($99/year)
   - Tap to Pay on iPhone entitlement (requires application to Apple)
   - com.apple.developer.proximity-reader.payment.acceptance entitlement

3. **Stripe Terminal Location**
   - Create location for each business in Stripe Terminal API
   - Required for Tap to Pay reader registration

### Implementation Flow

```typescript
// 1. Initialize Terminal SDK
import { StripeTerminalProvider } from '@stripe/stripe-terminal-react-native';

// 2. Connect to Tap to Pay Reader
const { reader } = await discoverReaders({
  discoveryMethod: 'localMobile',
  simulated: false
});

// 3. Collect Payment
const { paymentIntent } = await collectPaymentMethod({
  paymentIntentId: 'pi_xxx'
});

// 4. Confirm Payment
await confirmPaymentIntent({ paymentIntentId: 'pi_xxx' });
```

### Pricing
- **$0.10 per authorization** + Stripe's standard processing fee
- No hardware costs (uses iPhone/Android NFC)

## Code Sharing Strategy

### Shared Packages (/shared)

Keep existing shared code unchanged:
- `shared/schema.ts` - Drizzle schemas, types, Zod validators
- `shared/dateUtils.ts` - Date formatting utilities
- All insert/select types

### Backend (Unchanged)

The Express.js backend remains unchanged:
- All `/api/*` routes continue to work
- Authentication (Google OAuth, session management)
- Stripe Connect integration
- PDF generation (Puppeteer)
- Email integration (SendGrid, Gmail)

### New Endpoints for Terminal

```typescript
// POST /api/terminal/connection-token
// Returns connection token for Stripe Terminal SDK

// POST /api/terminal/create-location
// Creates a Terminal location for the business

// POST /api/terminal/create-payment-intent
// Creates PaymentIntent for in-person payment
```

## Feature Parity Checklist

### Core Features
- [ ] Authentication (Google OAuth, session persistence)
- [ ] Dashboard with role-based views
- [ ] Clients CRUD
- [ ] Jobs with 5-stage pipeline
- [ ] Quotes with PDF generation
- [ ] Invoices with Stripe Connect payments
- [ ] Calendar views (week/month)
- [ ] Time tracking

### Enhanced for Native
- [ ] Push notifications (replace web notifications)
- [ ] Offline support with local SQLite cache
- [ ] Background location tracking (team mode)
- [ ] Camera integration for job photos
- [ ] NFC Tap to Pay (new capability)

### Not Ported (Web-Only)
- PWA service worker
- Web-based print functionality

## File Structure

```
/
├── apps/
│   ├── web/              # Existing React web app
│   │   └── (current client/ structure)
│   └── mobile/           # New React Native app
│       ├── src/
│       │   ├── screens/  # Screens (replace pages/)
│       │   ├── components/
│       │   ├── navigation/
│       │   └── hooks/
│       ├── app.json      # Expo config
│       └── App.tsx
├── packages/
│   └── shared/           # Extracted from shared/
│       ├── schema.ts
│       ├── types.ts
│       └── utils/
└── server/               # Unchanged backend
```

## Timeline Estimate

| Phase | Duration | Description |
|-------|----------|-------------|
| 1. Setup | 1 week | Expo project, navigation, auth flow |
| 2. Core UI | 2 weeks | Dashboard, lists, forms with NativeWind |
| 3. Features | 2 weeks | Jobs, Quotes, Invoices, Calendar |
| 4. Payments | 1 week | Stripe Terminal integration |
| 5. Polish | 1 week | Testing, performance, app store prep |
| **Total** | **7 weeks** | |

## Apple Developer Requirements

### For Tap to Pay on iPhone

1. **Apple Developer Program** enrollment
2. **Background Modes** capability:
   - Location updates (for team tracking)
   - Background fetch (for sync)
3. **Tap to Pay entitlement application**:
   - Submit business information to Apple
   - Approval typically takes 1-2 weeks

### App Store Submission

- Privacy policy URL (already exists at /privacy)
- App screenshots for various device sizes
- App Store Connect account setup

## Android Requirements

### NFC Permissions
```xml
<uses-permission android:name="android.permission.NFC" />
<uses-feature android:name="android.hardware.nfc" android:required="true" />
```

### Play Store
- Google Play Developer account ($25 one-time)
- Compliance with payment app policies

## Migration Path for Existing Users

1. **Parallel Deployment**: Web app continues to work alongside mobile
2. **Data Sync**: Same backend, same database - seamless transition
3. **Feature Parity**: Mobile app reaches feature parity before full migration
4. **Gradual Rollout**: Beta test with select businesses first

## Security Considerations

### Stripe Terminal Security
- Connection tokens expire after 24 hours
- Card data never touches your server
- End-to-end encryption for card data
- PCI DSS compliance handled by Stripe

### Local Storage
- Use Expo SecureStore for tokens
- Never store card data locally
- Session tokens with HttpOnly equivalent

## Testing Strategy

### Device Testing
- Physical iOS device required for Tap to Pay
- Android NFC testing on physical device
- Expo Go for development (limited native features)

### Stripe Test Mode
- Use Stripe test mode connection tokens
- Simulated reader for development
- Test card numbers for various scenarios

## Dependencies Overview

```json
{
  "dependencies": {
    "expo": "~53.0.0",
    "@stripe/stripe-terminal-react-native": "^0.0.1",
    "@react-navigation/native": "^6.x",
    "@react-navigation/native-stack": "^6.x",
    "@tanstack/react-query": "^5.x",
    "react-native-paper": "^5.x",
    "nativewind": "^4.x",
    "expo-secure-store": "~13.0.0",
    "expo-location": "~17.0.0",
    "expo-camera": "~15.0.0",
    "expo-notifications": "~0.28.0"
  }
}
```

## Conclusion

Converting JobRunner to React Native enables critical in-person payment capabilities while maintaining the existing backend infrastructure. The shared type system and API patterns ensure consistency between web and mobile experiences. The primary investment is in UI component conversion and native feature integration.

### Key Benefits of Native App
1. **Tap to Pay** - Accept card payments anywhere with just your phone
2. **Push Notifications** - More reliable than web notifications
3. **Offline Mode** - Work in areas with poor connectivity
4. **Better Camera** - Native photo capture for job documentation
5. **Background Location** - Accurate team tracking

### Recommended Next Steps
1. Set up Apple Developer account
2. Apply for Tap to Pay entitlement
3. Create Expo project with dev client
4. Implement authentication flow
5. Port core screens incrementally
