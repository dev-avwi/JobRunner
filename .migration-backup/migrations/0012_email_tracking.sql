-- Email delivery tracking — open/click/bounce events from the SendGrid Event Webhook.
ALTER TABLE "email_delivery_logs"
  ADD COLUMN IF NOT EXISTS "clicked_at" timestamp,
  ADD COLUMN IF NOT EXISTS "bounced_at" timestamp,
  ADD COLUMN IF NOT EXISTS "bounce_reason" text,
  ADD COLUMN IF NOT EXISTS "last_event_type" text,
  ADD COLUMN IF NOT EXISTS "last_event_at" timestamp,
  ADD COLUMN IF NOT EXISTS "open_count" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "click_count" integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS "email_delivery_logs_message_id_idx"
  ON "email_delivery_logs" ("message_id");
CREATE INDEX IF NOT EXISTS "email_delivery_logs_related_idx"
  ON "email_delivery_logs" ("type", "related_id");
