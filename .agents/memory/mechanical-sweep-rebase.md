---
name: Mechanical sweeps vs rebase conflicts
description: How to resolve rebase conflicts when a task is a scripted codemod over hot files
---

Rule: when a codemod-style task (token sweeps, renames) hits rebase conflicts on hot screens, resolve by keeping **main's** side of each conflict block, then re-run the idempotent transform script over the whole file.

**Why:** During a task rebase onto main, `ours` = main and `theirs` = the task commit (opposite of merge). Keeping "theirs" silently discards other merged tasks' work in the same regions. Hand-merging 1000+-line createStyles blocks is hopeless; re-applying the scripted transform to main's version keeps both sides perfectly.

**How to apply:** Keep the transform as a script (regex map) rather than one-off edits; after `git checkout -m -- <file>` you can regenerate markers if you picked the wrong side. Mobile type scale now has `fontWeights` in `design-tokens.ts`; 12/14px map to `typography.captionSmall.fontSize` / `typography.button.fontSize` (exact), others to `typography.sizes.*`.
