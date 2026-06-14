---
name: mobile node_modules can't reinstall in Replit (shell-quote firewall block)
description: Why mobile/node_modules cannot be npm-installed inside the Replit container, and what to do instead.
---

Replit's package firewall (`package-firewall.replit.local`, Socket Security) blocks **`shell-quote` at EVERY version** (1.7.3, 1.7.4, 1.8.0, 1.8.1, 1.8.3 all return E403 "Access denied … Socket Security Policy. Reason: Critical CVE"). Proven via `npm pack shell-quote@<v>` per version.

`shell-quote` is a TRANSITIVE dependency of the Expo/Metro CLI toolchain (not a direct dep in `mobile/package.json`). Because npm rolls back the ENTIRE reify when any one package fails to fetch, the whole `npm install` for `mobile/` fails and leaves a partial/garbage `node_modules` (react-native appears then gets deleted during rollback).

**Consequences / rules:**
- An npm `overrides` pin to a different shell-quote version does NOT help — every version is blocked. Don't bother editing `mobile/package.json` for this.
- There is no vendorable copy in the workspace (root `node_modules` doesn't have it either).
- **`mobile/node_modules` therefore cannot be (re)created inside the Replit container.** NEVER run `npm ci` / `npm install` for `mobile/` here expecting success — `npm ci` wipes node_modules first and you cannot restore it.

**Why:** Socket flagged a critical CVE in shell-quote; this is a Replit-side security policy, not something an agent can override from code.

**How to apply / what to do instead:** The user's real mobile dev environment is their Mac, where `mobile/node_modules` is intact and shell-quote is not blocked. Mobile commands (`eas update`, `eas build`, `expo start`) must be run from the Mac, not the Replit shell. If they truly need it working in Replit, that's a security-policy allowlist decision for them to take up with Replit — not an agent workaround.
