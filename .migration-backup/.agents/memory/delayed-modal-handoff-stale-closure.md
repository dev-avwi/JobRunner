---
name: Delayed modal handoff runs a stale closure
description: setTimeout chains between bottom sheets (iOS modal-collision delay) execute the pre-update render's closure, reading stale state.
---

Rule: any setTimeout used to sequence one modal closing and the next opening (the ~400ms iOS modal-collision delay) must NOT call a plain component function — that closure was captured before the setState calls in the same handler committed, so it reads stale state (empty amount, null selectedInvoice) and misbehaves silently.

**Why:** bit the Tap to Pay picker in collect-payment: selecting a job set the amount, then the delayed proceed handler saw amount='' (<50c) and silently re-opened the picker — "tapped a job, nothing happened, second try works".

**How to apply:** either snapshot the needed values into locals before the timeout (custom-amount flow does this), or use the latest-ref pattern: `const fnRef = useRef(fn); fnRef.current = fn;` and call `fnRef.current(...)` in the timeout. Standard for all delayed callbacks in collect-payment.
