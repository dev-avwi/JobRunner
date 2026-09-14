-- Add bounded retry support to review_request_queue.
-- attempt_count tracks how many send attempts have been made.
-- The processor re-queues failed rows with exponential back-off until
-- attempt_count reaches the configured maximum (3), after which the row is
-- permanently marked failed.

ALTER TABLE review_request_queue
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;
