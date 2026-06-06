---
name: Logger wrong-signature bypasses alert suppression
description: Why misusing logger.error(message, error) floods admin inboxes with transient DB-timeout alerts
---

The `logger` (server/logger.ts) signature is `error(category, message, { error })` (and same shape for info/warn/fatal). `logger.error`/`fatal` send an admin alert email, but first call `isTransientInfraError(entry)` to suppress routine Neon connection drops ("Connection terminated due to connection timeout" / "...unexpectedly", etc. — these self-heal on the next scheduler tick).

**The trap:** calling `logger.error('some message', errorObj)` (2-arg, no category) puts the Error in the `message` slot and leaves `opts.error` undefined. The old `isTransientInfraError` only inspected `typeof message === 'string'` and `entry.error`, so a connection-timeout Error in the message slot produced an empty haystack → returned false → suppression bypassed → alert email fired every interval. That is what flooded the admin inbox with "[Lifecycle] Error processing lifecycle emails" emails (the lifecycle scheduler was the only caller using the wrong signature).

**Why:** the timeout itself is benign infra noise the codebase deliberately suppresses; only the wrong logger call made it look unsuppressed.

**How to apply:**
- Always call `logger.error('<category>', '<message>', { error })`. Categories are a fixed union (sms/email/billing/webhook/auth/api/background/system/frontend). Never pass an Error as the 2nd (message) arg.
- `isTransientInfraError` is now hardened to coerce an Error-in-message-slot to text as defense-in-depth, but that's a backstop, not a license to misuse the signature.
- If admin alert emails for DB timeouts ever return, first check for a new mis-signatured logger call (`rg "logger\.(error|warn|fatal|info)\("` and eyeball the first arg — it must be a bare category string), not a pool/Neon problem.
- The underlying timeouts are infra (Neon serverless severs idle pooled connections); they hit ALL schedulers at once in deployment logs. That's expected and suppressed — don't chase it as a code bug.
