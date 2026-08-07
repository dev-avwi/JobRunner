---
name: LLM structured-output echoes prompt formatting
description: gpt-5-mini returns field ids in the same decorated format the prompt listed them in
---

When a prompt lists allowed values with labels (e.g. `name (Name)`), gpt-5-mini echoes the whole decorated string back as the value (`"field": "name (Name)"`), silently failing strict parsers.

**Why:** hit in the smart-import column-mapping feature — every AI mapping came back null despite high confidence.

**How to apply:** when parsing LLM-chosen enum/field values, normalise defensively (strip parentheticals, lowercase, match against the canonical set) AND tell the prompt explicitly to return the bare id, never the label.
