---
name: Stripe Terminal simulator abort
description: Real Tap to Pay reader discovery on iOS simulator kills the whole app with a native abort
---

Calling the Stripe Terminal RN SDK `discoverReaders({ discoveryMethod: 'localMobile', simulated: false })` on the iOS **simulator** makes Stripe's native SDK `abort()` the entire process (SIGABRT on `com.meta.react.turbomodulemanager.queue`). No JS error, no red box — the app just closes. Users describe it as "kicked out / app silently closed".

**Why:** Simulators have no NFC hardware; Stripe treats a real-reader request there as a fatal integration error. This was masked while the app fell back to a JS mock terminal on simulator; once the real SDK provider was always mounted, the real discovery path ran and crashed.

**How to apply:** Any `discoverReaders` call must pass `simulated: !Device.isDevice` (expo-device). If a "silent app close" is reported around Tap to Pay coming online, get the `.ips` crash file — on simulator it's on the Mac at `~/Library/Logs/DiagnosticReports/JobRunner-*.ips` (device Analytics Data may be empty if sharing is off). The faulting-thread frames name the exact native call.
