# Mobile smoke tests

Two layers of regression coverage for App Store / Play submission-blocker
flows. Both are exercised by reviewers on every binary upload, so failures
here directly translate into store rejections.

## Unit — Jest

Covers `src/lib/store-review.ts` (per-version AsyncStorage gate, `hasAction:
false`, `isAvailableAsync: false`, platform skips, error swallowing,
version-bump re-fires).

```bash
cd mobile
npm install     # one-time: pulls jest + jest-expo + react-test-renderer
npm test        # runs jest
```

Config: `jest.config.js`, `jest.setup.js`. Add more unit tests under
`src/**/__tests__/*.test.ts(x)`.

## E2E — Maestro

YAML flows live in this directory. They drive a real build on a real
device or simulator, so they need:

- macOS + Xcode + an iOS simulator (or a connected iPhone) for iOS
- Any host with `adb` and an Android emulator (or a connected phone)

Install Maestro once:

```bash
curl -fsSL "https://get.maestro.mobile.dev" | bash
```

Build a preview binary and install it on the target:

```bash
# iOS
cd mobile
eas build --profile preview --platform ios --local
xcrun simctl install booted ./build-*.app

# Android
cd mobile
eas build --profile preview --platform android --local
adb install build-*.apk
```

Then run each flow on each platform you care about:

```bash
# Apple guideline 3.1.1
maestro test mobile/.maestro/restore-purchases.yaml

# Apple 3.1.2 + Play subscription policy — strengthens the cross-app
# assertion using Maestro `when: platform:` blocks (App Store on iOS,
# Play Store surface on Android).
maestro test mobile/.maestro/manage-subscription.yaml

# Terms / Privacy reachability from subscription (external URL),
# delete-account (in-app), and register (in-app)
maestro test mobile/.maestro/terms-privacy-links.yaml
```

Each flow targets the testIDs already on the production buttons
(`button-restore-purchases`, `button-manage-subscription`, `link-terms`,
`link-privacy`) so the tests stay green as long as those affordances
exist. The Terms/Privacy flow taps **both** links on **every** entry
point and asserts the canonical `jobrunner.com.au` URL/host text on the
destination, so a misconfigured route is caught immediately.
