-- Vapi webhook deduplication table.
-- dedup_key is a SHA-256 hex digest of the raw request body.
-- Vapi always retries with a byte-identical payload, so true duplicates hash
-- identically. Distinct events (different status value, different tool calls)
-- produce different bodies and therefore different hashes.

CREATE TABLE IF NOT EXISTS vapi_events (
  id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id     TEXT,           -- audit: the Vapi call ID extracted from the payload
  event_type  TEXT,           -- audit: the event type extracted from the payload
  dedup_key   TEXT NOT NULL,  -- SHA-256 hex of the raw request body
  received_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_vapi_events_dedup UNIQUE (dedup_key)
);

CREATE INDEX IF NOT EXISTS idx_vapi_events_call_id ON vapi_events (call_id);
