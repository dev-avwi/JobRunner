ALTER TABLE ai_receptionist_config ADD COLUMN IF NOT EXISTS auto_reply_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE ai_receptionist_config ADD COLUMN IF NOT EXISTS auto_reply_message text DEFAULT 'Thanks for calling {{business_name}}. We got your message and will get back to you shortly. — Sent via JobRunner';
