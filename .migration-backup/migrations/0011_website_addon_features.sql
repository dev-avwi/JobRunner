ALTER TABLE website_addons ADD COLUMN IF NOT EXISTS website_click_to_call boolean DEFAULT false NOT NULL;
ALTER TABLE website_addons ADD COLUMN IF NOT EXISTS website_chat_widget boolean DEFAULT false NOT NULL;
ALTER TABLE website_addons ADD COLUMN IF NOT EXISTS website_booking_form boolean DEFAULT false NOT NULL;
