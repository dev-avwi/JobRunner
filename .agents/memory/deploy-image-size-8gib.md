---
name: Deploy publish fails — image over 8 GiB
description: Autoscale/Reserved-VM publish fails at "Created Repl layer" with "image size is over the limit of 8 GiB"; how to slim the deploy image safely.
---

# Deploy publish fails: image over 8 GiB

**Symptom:** `npm run build` succeeds, then publish fails at the "Created Repl layer" step with `error: image size is over the limit of 8 GiB`. This appears in the **publish/build log the user sees in the UI**, NOT in `fetchDeploymentLogs()` (that returns "No deployment logs found" because it never reached runtime). So if you only check `fetchDeploymentLogs()` you'll see nothing — you must get the build-log text from the user.

**Limits:** Autoscale & Reserved-VM images cap at 8 GiB; Static caps at 1 GiB. The image is the post-build repl filesystem snapshot, so it grows over time as assets/history accumulate even if the deploy config never changed.

**Fix:** delete build-ephemeral / non-runtime directories. The documented levers (per Replit docs) are: delete unnecessary files, avoid committing generated output, move large assets to external/object storage. `.replitignore` is NOT a documented deploy-image mechanism — don't rely on it.

**The safe place to delete is the BUILD command, scoped:**
```
build = ["bash","-c","npm run build && rm -rf attached_assets mobile .git docs tests exports artifacts"]
```
**Why the build command (not deleting from the repl):** the deploy build runs on an ephemeral copy, so it slims the image without touching the user's real source. Critically, some dirs are needed at BUILD time but not RUNTIME — e.g. `attached_assets` is resolved by the vite `@assets` alias during `npm run build`, so it must be deleted AFTER the build, never removed from the source.

**The landmine:** an earlier version of this cleanup also deleted `.cache` and `.local`, which hold the files the deploy runtime layer needs to put the node module on the PATH — that made BOTH `node` and `npm` vanish at startup ("executable file not found in $PATH", crash loop). **Never put `.cache`, `.local`, `node_modules`, `dist`, `package.json`, `.puppeteerrc.cjs`, or `.npmrc` in the `rm -rf` list.** `bash -c` is fine for the BUILD command; it is NOT safe for the RUN command (the spawned shell loses the module PATH).

**Verify before adding a dir to the delete list:** confirm it has no runtime reads (`rg <dir> server/`) and no build-time imports from client/server (`rg "from ['\"].*<dir>/"`). If still over 8 GiB after this, next lever is object storage for `attached_assets` (rewrites `@assets` imports) — do not start deleting runtime dirs.
