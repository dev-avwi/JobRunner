---
name: No left-border colour tags on cards
description: User strongly dislikes coloured left-border accent bars on cards throughout the app.
---

# No left-border colour tags on cards

The user has explicitly stated they hate the coloured left-border (`border-l-[3px]`) accent bar pattern used on job/event cards throughout the web app.

**Why:** It is a visual pattern the user finds ugly and unnecessary. They called it out on the Dispatch Job view cards (orange/blue left-border stripes) and asked for an audit of the whole app.

**How to apply:**
- Default: do NOT add `border-l-[3px]` colour accents to cards.
- Use badges, icons, or background tints to distinguish types/statuses instead.
- Exception: only keep a left-border accent if there is genuinely no other way to convey the information (e.g., inside a very compact calendar chip where a badge wouldn't fit).
- When auditing or touching existing cards, remove `border-l-[3px]` + `border-xxx-500` patterns and replace with a small badge, coloured dot, or subtle background tint.
