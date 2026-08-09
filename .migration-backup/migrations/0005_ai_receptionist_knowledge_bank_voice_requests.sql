ALTER TABLE ai_receptionist_config ADD COLUMN IF NOT EXISTS knowledge_bank json;

CREATE TABLE IF NOT EXISTS voice_change_requests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_description text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  created_at timestamp DEFAULT now(),
  resolved_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_vcr_user ON voice_change_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_vcr_status ON voice_change_requests(status);
