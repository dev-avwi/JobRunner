---
name: iOS IAP purchase outcome is async via global listeners
description: Why purchaseSubscription must bridge a deferred to the global listeners, and how cancel must be handled per screen
---

On iOS, `react-native-iap`'s `requestSubscription()` does NOT reliably reject when the
user cancels (or completes) the Apple sheet. The real outcome arrives asynchronously
through the GLOBAL `purchaseUpdatedListener` / `purchaseErrorListener` (set up once in
`iap-global.ts`). Awaiting `requestSubscription` therefore resolves on "sheet opened",
not "purchase done".

**Bugs this caused:** subscription upgrade button spun forever on cancel; dedicated-number
screen showed "Finishing Up" and acted purchased on cancel (cancel treated as success).

**Rule:** `purchaseSubscription()` must return a module-level deferred that the global
listeners settle — resolve ONLY on a receipt-bearing `purchaseUpdatedListener` event,
reject on EVERY `purchaseErrorListener` event (incl `E_USER_CANCELLED`). Extras that
proved necessary:
- Correlate the deferred to the requested `productId` (`activePurchaseProductId`) so a
  stale/queued/restored transaction for another product can't resolve the wrong purchase.
- Settle-on-`finishTransaction`-throw so callers don't hang to the timeout.
- 120s timeout safety net + supersede-guard (reject prior deferred when a new purchase starts).
- Single in-flight purchase assumed (buttons disabled during purchase).

**Per-screen contract:** a resolve = genuine purchase (show success / "Finishing Up");
catch must SILENTLY swallow `E_USER_CANCELLED` and `E_PURCHASE_SUPERSEDED` (no error toast)
and clear any stashed context (e.g. `setPendingDedicatedNumber(null)`). Resolve happens
BEFORE backend verify/`refreshUser` (global verify is fire-and-forget), so resolve ≠
verified entitlement — optimistic "activating, pull to refresh" copy is correct for add-ons;
subscription screen relies on the auth tier-change effect for final confirmation.

**Why:** screens previously assumed `await purchaseSubscription()` returned the outcome.
**How to apply:** any new IAP-buying screen must follow the catch contract above; never
add success UI on the bare resolve path without the cancel-swallow in catch.
