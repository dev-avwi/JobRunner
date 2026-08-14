---
name: Avoid em dashes in copy
description: User preference — never use em dashes (—) in hard-coded UI copy strings
---

# Avoid em dashes in UI copy

**Rule:** Do not use em dashes (—) or `&mdash;` in any hard-coded UI strings: descriptions, empty states, subtitles, tooltips, or button labels.

**Why:** The user flagged this as an obvious AI writing habit that looks unnatural in product copy. All three descriptions on the job type picker screen had em dashes, which the user called out directly (August 2026).

**How to apply:**
- Replace " — " with a comma, colon, "and", "or", or rewrite the sentence so a connector is not needed.
- Before: "Simple single-visit jobs — fault finding, repairs, and quick call-outs."
- After: "Simple single-visit jobs: fault finding, repairs, and quick call-outs."
- This applies to all platforms: mobile (React Native), web (React/Vite), and email templates.
- User-entered content (quotes, job notes) is not affected — only hard-coded strings.
