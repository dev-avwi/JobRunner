---
name: revoking other sessions must match requireAuth's session-resolution order
description: change-password / any "log out other devices" must compute currentSid the way auth resolves it
---
Bearer tokens in this app ARE rows in the `session` table (requireAuth does
`SELECT sess FROM session WHERE sid = <bearer>`). To "revoke all other sessions"
(e.g. after change-password) use `DELETE FROM session WHERE (sess->>'userId')=<uid> AND sid <> <currentSid>`.

**Rule:** compute currentSid the SAME way requireAuth resolves the active session —
it prefers the COOKIE session (`req.session?.userId` → use `req.sessionID`) and only
falls back to the Bearer token. Do NOT prefer Bearer first.

**Why:** web requests can carry BOTH a cookie and an Authorization header (localStorage
fallback). If you pick the Bearer sid first while requireAuth is actually using the cookie
session, the `sid <> currentSid` delete wipes the real current session and logs the user
out of their own device. (resetPassword deletes ALL sessions — that's fine because that
flow isn't logged in; change-password IS logged in, so it must spare the current sid.)
