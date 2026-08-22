---
name: Compliance payment holds
description: Durable payment-flow rule for subcontractor compliance enforcement and recovery.
---

Compliance holds on subcontractor payments must be checked by the server across every payment path, including immediately before any irreversible card capture. Card authorization alone is not a payment approval.

**Why:** A profile can expire after a browser authorizes a card but before funds are captured. Payment flows can also be interrupted after a capture, so a hold must prevent bypasses without creating duplicate or unreconciled payments.

**How to apply:** Use a server-controlled capture step, atomically reserve the payment request while it is being finalized, and reconcile a bounded stale reservation against the provider before allowing a manual payment or retry.