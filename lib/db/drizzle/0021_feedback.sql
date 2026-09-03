-- Feedback submissions from web and mobile.
-- Users can report bugs, request features, or leave general feedback
-- with optional star rating and up to 3 photo attachments.

CREATE TABLE IF NOT EXISTS feedback (
  id            VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  business_id   VARCHAR,
  feedback_type TEXT NOT NULL DEFAULT 'general',
  message       TEXT NOT NULL,
  rating        INTEGER,
  photo_urls    JSONB DEFAULT '[]',
  platform      TEXT,
  app_version   TEXT,
  current_route TEXT,
  device_info   JSONB,
  created_at    TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id    ON feedback (user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_type       ON feedback (feedback_type);
