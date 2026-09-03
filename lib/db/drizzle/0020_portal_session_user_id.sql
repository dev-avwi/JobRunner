-- Scope portal sessions created from document bearer tokens to the business
-- that issued the document, preventing cross-tenant data exposure.
-- NULL means the session was established via phone-OTP (phone-global scope).

ALTER TABLE portal_sessions ADD COLUMN IF NOT EXISTS user_id VARCHAR;

CREATE INDEX IF NOT EXISTS idx_portal_sessions_user_id ON portal_sessions (user_id)
  WHERE user_id IS NOT NULL;
