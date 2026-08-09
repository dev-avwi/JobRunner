---
name: Simulator default GPS = Mountain View, California
description: A worker "missing" from an AU map but sending fresh pings is likely on a simulator reporting the default California coords.
---

# Simulator/emulator default GPS

iOS Simulator and Android Emulator, with no custom location set, report
**latitude 37.4219983, longitude -122.0840000** (Mountain View, CA — Googleplex).
The pings are fresh (every ~30–60s), so the worker looks "online/recent" but the
pin lands in California, off the edge of any Australian (Cairns/Sydney) map view.

**Symptom:** owner team map shows no worker pins (or "0 active") even though a
worker is actively testing and `location_tracking` has fresh rows. Check the
lat/lng — if it's `37.4219983, -122.084`, the device is a simulator without a
custom location.

**Why it hid the worker (this incident):** the map dedups by name and keeps the
highest-priority status (busy > online). The Busy account was on a simulator
(California), the real-Cairns account was only Available — so dedup kept the
busy California pin and dropped the visible Cairns one → map looked empty.

**How to apply:** when a tradie reports "my worker disappeared from the map"
right after a status/map change but pings are fresh, query the latest
`location_tracking` lat/lng before touching code. If it's the simulator default,
the fix is the test setup (real device, or Simulator → Features → Location →
Custom Location), not the map code. Compounded by duplicate same-name accounts
where status and location live on different accounts.
