-- Add optional photo attachment support to job_notes.
-- photo_object_key stores the object-storage key (bucketId/path) for the
-- photo; the API signs fresh read URLs at query time so stored keys never expire.

ALTER TABLE job_notes
  ADD COLUMN IF NOT EXISTS photo_object_key TEXT;
