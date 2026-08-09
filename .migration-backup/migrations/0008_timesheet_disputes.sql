ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS is_disputed BOOLEAN DEFAULT FALSE;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS dispute_reason TEXT;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMP;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMP;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS dispute_resolution TEXT;

CREATE TABLE IF NOT EXISTS time_entry_dispute_events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id VARCHAR NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
