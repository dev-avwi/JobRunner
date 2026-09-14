-- Create a durable queue for outbound Google review requests.
-- Requests are inserted when payment is confirmed and processed by the
-- scheduler when scheduledFor <= now. Atomic status transitions prevent
-- double-sends even across multiple server instances.
-- The two ALTER TABLEs add columns that were backfilled in dev; they are
-- idempotent so existing databases are unaffected.

CREATE TABLE IF NOT EXISTS review_request_queue (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_id      VARCHAR,
  job_id          VARCHAR,
  client_id       VARCHAR,
  scheduled_for   TIMESTAMP NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  sent_at         TIMESTAMP,
  error_message   TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_request_queue_status_scheduled
  ON review_request_queue (status, scheduled_for);

ALTER TABLE automation_settings
  ADD COLUMN IF NOT EXISTS review_request_delay_hours INTEGER DEFAULT 24;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS review_request_sent_at TIMESTAMP;
