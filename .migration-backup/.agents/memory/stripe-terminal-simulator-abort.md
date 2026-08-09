---
name: Stripe Terminal Tap to Pay aborts
description: Two abort() crashes around Tap to Pay — real-reader discovery on simulator, and the renamed 'localMobile' discovery method
---

Two distinct hard-crashes (SIGABRT on `com.meta.react.turbomodulemanager.queue`, no JS error, app just closes) come from Stripe Terminal RN SDK `discoverReaders`:

**1. Real-reader discovery on iOS simulator.** `simulated: false` on a simulator makes the native SDK `abort()` — no NFC hardware, Stripe treats it as fatal.
**How to apply:** every `discoverReaders` call passes `simulated: !Device.isDevice` (expo-device).

**2. Stale discovery method name (crashed REAL devices too).** RN wrapper beta.29 / iOS SDK 5.x renamed `'localMobile'` → `'tapToPay'`. Passing `'localMobile'` hits the wrapper's `@unknown default`, which **silently falls back to Bluetooth scan discovery** — and StripeTerminal abort()s because the app ships no Bluetooth permissions. Same crash signature on simulator and device (StripeTerminalReactNative.discoverReaders → StripeTerminal → abort).
**Why:** the wrapper never rejects unknown methods; it defaults to Bluetooth, so a rename becomes a native crash, not an error.
**How to apply:** use `discoveryMethod: 'tapToPay'` and `connectReader({discoveryMethod:'tapToPay', reader, locationId})` (`connectLocalMobileReader` was removed). After any @stripe/stripe-terminal-react-native version change, re-verify the method strings against `lib/typescript/src/types/index.d.ts` in node_modules — a mismatch aborts the whole app.

**3. "No Tap to Pay reader found" despite clean discovery.** Reading `sdkHook.discoveredReaders` inside an async callback is a stale closure snapshot from render time (always []).
**How to apply:** capture readers via `useStripeTerminal({ onUpdateDiscoveredReaders })` into a ref, clear the ref before discovery, then poll the ref (250ms, generous window — first-run Apple ToS sheet can hold the user 60s+) instead of a fixed 1s sleep.

**4. "SDK is busy with another command: discoverReaders".** A timed-out/abandoned attempt (e.g. user sat on Apple's first-run ToS sheet) leaves a native discovery running; every later attempt fails busy until app restart.
**How to apply:** connectReader must (a) dedupe concurrent calls by sharing one in-flight promise (ref holding the promise, cleared in finally), (b) on a busy error call `cancelDiscovering()` and retry once, (c) `cancelDiscovering()` before throwing on empty-readers timeout, (d) reuse `connectedReader` when already connected instead of re-discovering.

**Crash-log recipe:** get the `.ips` file — simulator: Mac `~/Library/Logs/DiagnosticReports/JobRunner-*.ips`; device: Settings → Privacy & Security → Analytics Data → AirDrop. Faulting-thread frames name the exact native call.
