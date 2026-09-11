-- Add optional rich-text description to checklist items so workers can write
-- step-by-step instructions with headings, bullets, and numbered lists.
-- Column is nullable so existing items are unaffected.

ALTER TABLE checklist_items
  ADD COLUMN IF NOT EXISTS description TEXT;
