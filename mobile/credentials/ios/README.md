# iOS Credential Files

These files are required for local EAS builds and are excluded from version control.

> **Never commit `mobile/credentials.json` or anything in this directory.**
> `credentials.json` contains the `.p12` password in plaintext. If any of these
> files (or the password) ever land in git, treat the certificate as compromised:
> revoke it in the Apple Developer portal, regenerate via `eas credentials`,
> and pick a new export password. History note: the cert, profiles, and password
> were committed prior to Sep 2026 — that certificate must be rotated.

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
