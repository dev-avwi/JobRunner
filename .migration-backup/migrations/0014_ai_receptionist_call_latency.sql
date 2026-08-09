-- Task #87: persist real measured per-call response latency from Vapi
-- end-of-call reports on each ai_receptionist_calls row so we can show a
-- rolling real-world average alongside the existing client-side estimate.
-- Idempotent ALTER so it's safe to re-run if the column was already added
-- by hand in dev.
ALTER TABLE ai_receptionist_calls
  ADD COLUMN IF NOT EXISTS latency_ms integer;
