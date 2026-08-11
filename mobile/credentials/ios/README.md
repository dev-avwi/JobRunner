# iOS Credential Files

These files are required for local EAS builds and are excluded from version control.

## Files needed

| File | Description |
|------|-------------|
| `dist-cert.p12` | Apple distribution certificate (exported from EAS or Keychain) |
| `profile.mobileprovision` | Main app provisioning profile — `com.jobrunner.app` |
| `liveactivity.mobileprovision` | Live Activity extension profile — `com.jobrunner.app.liveactivity` (Apple UUID: `4d0adfd9-5d43-4f12-b960-706900d9e541`) |

## How to get the Live Activity profile

1. Download it from [Apple Developer Portal → Certificates, Identifiers & Profiles → Profiles](https://developer.apple.com/account/resources/profiles/list)
2. Search for the profile with UUID `4d0adfd9-5d43-4f12-b960-706900d9e541`
3. Place the downloaded `.mobileprovision` file here as `liveactivity.mobileprovision`

## How to get the main app profile + cert

Run `eas credentials --platform ios` and choose to download/export the credentials for `com.jobrunner.app`.
