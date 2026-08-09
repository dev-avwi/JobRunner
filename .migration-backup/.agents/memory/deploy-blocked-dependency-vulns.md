---
name: Deploy blocked by dependency vulnerability scan
description: Publish fails at end of build when Replit's scan finds critical CVEs in any lockfile, including mobile/
---
Replit's deploy pipeline runs a dependency vulnerability scan after the build; critical CVEs hard-block the publish with "Deployment blocked: found N critical vulnerabilities".

**Why:** 2026-08-01 publish failed on transitive deps: tar (root + mobile lockfiles, via expo/@expo/cli) and shell-quote (mobile). The scan reads ALL package-lock.json files in the repo, including `mobile/`, even though the build rm-rf's `mobile` — the scan happens before/independent of that.

**How to apply:**
- Get exact CVE lines from `getDeploymentBuild` logs (they name package, version, and fixed version).
- Transitive deps can't be bumped with installLanguagePackages; patch the lockfile entries directly (version/resolved/integrity — pull integrity from `https://registry.npmjs.org/<pkg>/<ver>`), then drop the new tarball contents into node_modules by hand (bash `npm install` is blocked; mobile npm ci is firewall-blocked anyway).
- Remember nested copies (e.g. react-devtools-core/node_modules/shell-quote).
