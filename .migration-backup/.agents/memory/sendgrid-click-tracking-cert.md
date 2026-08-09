---
name: SendGrid click-tracking causes "not secure" link warnings
description: Why email links threw NET::ERR_CERT_COMMON_NAME_INVALID and the fix that must stay in place
---

# SendGrid click tracking → broken-cert "not secure" links

SendGrid's **click tracking** rewrites every link in an email to route through a
per-account tracking subdomain (e.g. `urlNNNN.jobrunner.com.au`). If that branded
link domain's TLS cert isn't valid for the subdomain, recipients get Chrome
`NET::ERR_CERT_COMMON_NAME_INVALID` / "not secure" when they click — even though
the real destination is fine.

**Fix (in `sendViaSendGrid`, server/emailService.ts):** default
`trackingSettings.clickTracking.enable = false` (and `enableText = false`) while
keeping `openTracking.enable = true`. Links then go straight to the real domain.

**Why:** the broken cert is on the SendGrid tracking subdomain, not our app. Open
tracking uses a transparent pixel, not link rewriting, so it's unaffected and
telemetry is preserved.

**How to apply:** do NOT re-enable click tracking unless SendGrid's branded link /
link-domain cert is provisioned and valid for that subdomain. Re-enabling it
brings back the cert warning on every emailed link.
