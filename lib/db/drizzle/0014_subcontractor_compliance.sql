-- Compliance records are stored on subcontractor user profiles so the same
-- licence and insurance status is available on assignments and payments.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "license_type" text,
  ADD COLUMN IF NOT EXISTS "license_number" text,
  ADD COLUMN IF NOT EXISTS "license_expiry" date,
  ADD COLUMN IF NOT EXISTS "insurance_policy_number" text,
  ADD COLUMN IF NOT EXISTS "insurance_expiry" date;