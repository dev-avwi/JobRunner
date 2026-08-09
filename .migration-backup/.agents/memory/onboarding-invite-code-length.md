---
name: Onboarding invite-code length mismatch
description: Why the worker/subcontractor "Connect & Continue" button stays disabled in mobile onboarding.
---

# Invite codes are 6 chars, not 8

In `mobile/app/(onboarding)/setup.tsx`, the shared `validateInviteCode(code)`
must guard on `code.length !== 6`, NOT 8. Invite codes are 6 characters
throughout the stack:
- TextInput `maxLength={6}`, input normalizer `slice(0,6)`, debounce fires at
  `clean.length === 6`.
- Server is authoritative: `server/routes.ts` `INVITE_CODE_LENGTH = 6`;
  `/api/team/invite-code/validate/:code` and `/redeem` enforce it.

**Symptom of the bug:** entering a valid code never validated, so
`subInviteValidation`/`inviteValidation` stayed null. The "Connect & Continue"
button's disabled condition (`!validation?.valid && code.length > 0`) then kept
it permanently disabled — button looked dead. Affected BOTH the worker invite
step and the subcontractor connect step (they share `validateInviteCode`).

**Note:** the DB column comment/docs say `invite_codes.code` varchar length 8 —
that's stale; runtime constant 6 is authoritative. Don't "fix" the client back
to 8 to match the column.

## Skip-button count
The onboarding screen had three skip affordances on one step. Two were
identical (`handleSkipOnboarding`): a header "Skip" chip AND a global footer
"Skip setup for now". Removed the footer; kept the header chip plus any
step-local skip (e.g. subcontractor "Skip for now" = `handleSubConnect(true)`,
which skips only that step, not the whole wizard). If asked to reduce skip
clutter again, look for duplicate `handleSkipOnboarding` calls first.

Mobile JS change → Ayden must `git pull` + rebuild on his Mac; no server deploy.
