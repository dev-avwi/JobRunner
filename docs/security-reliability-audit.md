# Security Reliability Audit

Date: 19 August 2026  
Scope: Task 663 follow-up, development and test environments only

## Release readiness summary

The web and API authorization and redirect changes are release-ready based on authenticated API checks, browser checks, regression tests, production builds, and clean workflow startup.

The mobile source and Android JavaScript bundle pass the available privacy and permission checks. A physical-device pass and Google Cloud restriction confirmation remain external release conditions because this environment has no Android SDK, emulator, iOS build host, or Google Cloud console access.

## Authorization evidence

An isolated fixture was created for the checks and removed afterward. No test job, assignment, or document was retained.

| Authenticated action | Owner | Worker | Subcontractor |
| --- | ---: | ---: | ---: |
| Owner-only Sheet Sync status | `200` | `403` | `403` |
| Open assigned job | Allowed | `200` | `200` |
| Open unassigned job | Allowed | `403` | `403` |
| List assigned job documents | Allowed | `200` | `403` |
| List unassigned job documents | Allowed | `403` | `403` |

The assigned subcontractor document denial is expected. The seeded subcontractor role can open its assigned job but does not have the required media/document permission.

Project-document routes now apply both the requested action permission and the established job-media policy:

- Owners and true managers may access documents across their business.
- Workers and subcontractors must be assigned to the specific job.
- Assigned staff must also have the applicable media/document permission.
- Document and revision queries remain scoped by business owner, job ID, and document ID.

Cross-job URL regression:

| Request | Result |
| --- | ---: |
| Read Job A revision through Job A | `200` |
| Read Job A document ID through Job B | `404` |
| Delete Job A document ID through Job B | `404` |
| Read the original Job A document after mismatched delete | `200` |

The API regression suite passes with 8 files and 146 tests.

## Redirect boundaries

- Web auth handoff ignores all `next` input and redirects only to the literal `/bring-your-business` path after successful nonce redemption.
- Browser testing with `next=https://evil.example/...` remained on the JobRunner origin and displayed a controlled invalid-token state.
- Sheet Sync state remains random, expiring, and single-use.
- Every Sheet Sync callback outcome now redirects to a literal local `/settings` URL. Provider errors are logged server-side and are not reflected into redirect URLs.
- The final SAST scan has no active auth-handoff or Sheet Sync redirect finding.

## Dependency and static scan triage

### Dependency scan

The final dependency scan reports 31 high findings:

- 2 active `xlsx@0.18.5` findings, CVE-2023-30533 and CVE-2024-22363. No patched npm release is listed.
- 21 findings in `mobile/package-lock.json`, duplicated by the migration backup. These paths are Expo CLI, Metro, React Native codegen, configuration, and Jest build/test dependencies. They do not parse application user input at runtime.
- 8 findings exist only in `.migration-backup` lockfiles.

Untrusted XLS, XLSX, and CSV parsing is now isolated from the API process:

- The child process receives no application secrets.
- Its Node heap is capped at 192 MB.
- Parsing is terminated after 10 seconds.
- Input, output, row count, sheet count, and extracted-text sizes are bounded.
- Parser failure returns a controlled import error while the API process remains isolated.
- Tests cover successful smart import, successful form extraction, and row-limit rejection.
- Sheet Sync continues to use `xlsx` only to generate workbooks from trusted application data.

The residual `xlsx` advisory remains documented because process isolation reduces impact but does not make the vulnerable package itself patched. The mobile lockfile findings are limited to trusted build and test inputs. A controlled Expo-compatible lock refresh should apply the available compatible transitive fixes without forcing unverified overrides, while retaining the separate no-fix `image-size` mitigation.

### Static analysis

The final SAST scan reports 12 medium findings and no high or critical findings:

- 6 are archive-only copies under `.migration-backup`.
- 4 are the same public Android Google client configuration represented in the app config, Firebase config, and generated native Android files.
- 2 duplicate findings flag the production smoke scheduler's bcrypt call. The password material is HMAC-derived at runtime from `SESSION_SECRET`; there is no hard-coded password or hash.

The Google Android configuration is required at build and runtime. Source validation confirms package ID `com.jobrunner.app` across Expo and Firebase configuration. Before mobile release, Google Cloud must confirm that the key is restricted to that Android package, the production signing certificate fingerprints, and only the required APIs. Rotate the key if those restrictions are absent.

### Privacy scan

The final privacy scan reports zero findings.

## Native privacy and permission evidence

A repeatable 29-assertion mobile check verifies:

- Receipt camera and photo-library actions request their corresponding permissions before use.
- Document picker paths use the native picker and do not require legacy broad storage permission.
- Video recording requests microphone permission from Expo Camera.
- Foreground map permission and background location tracking permission paths are present.
- Sentry crash screenshots are disabled.
- Sentry user context contains only the opaque user ID, not email or name.
- iOS camera, photo-library, microphone, and location usage descriptions are present.
- The unused iOS photo-library-add declaration is absent.
- Android legacy read/write external-storage permissions are blocked in Expo config and absent from the tracked manifest.

Resolved Expo config confirms modern camera, audio, image/video media, foreground location, and background location permissions. Android JavaScript export completed successfully.

## Validation results

Passed:

- API tests: 8 files, 146 tests.
- API production build.
- JobRunner typecheck.
- JobRunner production build.
- Authenticated owner, worker, and subcontractor API matrix.
- Cross-job read and delete URL checks.
- Hostile auth-handoff browser check and authenticated owner browser session.
- Final hostile handoff and Sheet Sync callback browser regression, with no external navigation or uncaught runtime error.
- Mobile privacy/permission regression: 29 assertions.
- Expo Android JavaScript export.
- Dependency, SAST, and privacy scan rerun.
- API, web, and Expo workflow restarts.

Known pre-existing or external limitations:

- API typecheck still reports 8 unrelated existing errors in cost-report, job-phase, and storage code.
- Mobile typecheck still reports 4 unrelated existing errors in the job material form and new invoice screen.
- Expo Doctor reports the local Expo-module native-directory check and a minor NetInfo version mismatch.
- Android Gradle validation cannot complete because `ANDROID_HOME` and an Android SDK are unavailable.
- No Android or iOS device/emulator is available for interactive camera, microphone, picker, location, map, and native Sentry checks.
- Google Cloud key restrictions and signing-certificate bindings cannot be inspected from this workspace.
- `.migration-backup` remains tracked and intentionally unchanged; it contributes archive-only scanner noise.

No production deployment or production database migration was performed.