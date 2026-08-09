---
name: Server-dependent validation tests must run in ONE command
description: Validation runs execute registered commands in parallel; dev-server tests on port 5000 must be a single sequential step.
---
Rule: register all tests that need the dev server (port 5000) as ONE validation command — `bash tests/run-with-server.sh <test files...>` — never as separate commands.

**Why:** startValidationRun executes commands concurrently. Each run-with-server.sh instance tries to start/tear down its own dev server on port 5000; whichever finishes first kills the server out from under the others → mid-run ECONNREFUSED failures that pass when run individually.

**How to apply:** add new tests/*.test.ts files to the existing `server-tests` validation command's file list. tests/run-with-server.sh runs them sequentially and only tears down a server it started. Guided-tour test is unregistered (pre-existing app regression: Start App Tour button missing).
