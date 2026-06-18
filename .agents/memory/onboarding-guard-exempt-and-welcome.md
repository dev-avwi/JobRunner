---
name: Onboarding guard exempt list + welcome email timing
description: Why invite-code VALIDATE and /api/profile must be onboarding-exempt, and the owner-only welcome-email-on-completion policy.
---

# Onboarding guard exempt list

A brand-new signup is classified server-side as an **owner** with
`businessSettings.onboardingCompleted=false`. The global onboarding guard
(`onboardingExemptPrefixes` in `server/routes/middleware.ts` +
`requireOnboarding` in `server/permissions.ts`) 403s such owners on most `/api`
routes with **"Please complete your business setup before using this feature"**.

**Gotcha:** a person *joining* a team (worker/subcontractor) is still an "owner"
in this sense until they redeem a code, so EVERY endpoint their join flow touches
must be in the exempt list — not just the redeem endpoint.

**Rule:** when the onboarding/join flow calls a new endpoint, add its prefix to
`onboardingExemptPrefixes`. The list must include the invite-code **validate**
route (`/api/team/invite-code/validate`), the magic-link validate
(`/api/team/invite/validate`), and `/api/profile` (joiner flows PATCH
`/api/profile/me` mid-onboarding). The redeem route was already exempt; validate
being missing was the cause of the red "complete business setup" error when a
subcontractor typed an invite code.

**Why safe:** the onboarding guard is NOT an auth boundary. Exempting a prefix
only skips the incomplete-onboarding check; the route's own `requireAuth` /
route-level auth still applies.

# Welcome email timing (owner-only, on first completion)

`sendWelcomeEmail` is sent **once, on the first** `POST /api/onboarding/complete`
(guard the transition with `wasAlreadyCompleted = !!settings?.onboardingCompleted`
BEFORE the update). It is deliberately NOT sent at signup or email verification.

**Owner-only is intentional.** `/api/onboarding/complete` is `requireAuth +
ownerOnly()`, so the welcome only reaches business owners. That matches the email
content, which is entirely owner-centric (set up business, add a client, create a
quote, invoice & get paid). Invited workers/subcontractors call this route too
but get 403'd (swallowed client-side) and correctly receive no owner welcome.

**Do NOT** re-add `sendWelcomeEmail` to the OAuth user creators
(`server/auth.ts` Google/Apple/Xero) or to `/api/auth/verify-email` — that
re-introduces the "email arrives before onboarding" bug the user reported.
