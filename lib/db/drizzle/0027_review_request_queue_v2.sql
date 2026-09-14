-- Improvements to review_request_queue for correctness and durability.
--
-- claimed_at: records when a row was atomically claimed for processing.
--   Used to detect genuinely stuck rows (claim time > 30 min ago) rather
--   than misusing scheduledFor, which reflects the intended send time.
--
-- status 'skipped': explicit outcome for rows where no channel was usable
--   or settings changed during the delay. Skipped rows are excluded from the
--   90-day dedup window so correcting a client's contact details re-enables
--   the review request flow.
--
-- Partial unique index: prevents concurrent payment webhooks from inserting
--   duplicate pending/processing rows for the same (user, client) pair.
--   INSERT ... ON CONFLICT DO NOTHING is used at the application level.

ALTER TABLE review_request_queue
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rrq_active_unique
  ON review_request_queue (user_id, client_id)
  WHERE status IN ('pending', 'processing');
