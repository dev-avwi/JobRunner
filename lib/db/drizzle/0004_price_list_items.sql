-- Migration: price list items (user-owned pricebook of saved services, materials, and equipment)
-- Safe to run multiple times (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "price_list_items" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "unit_price" decimal(10,2) NOT NULL DEFAULT '0.00',
  "category" text DEFAULT 'General',
  "unit" text DEFAULT 'each',
  "item_type" text NOT NULL DEFAULT 'service',
  "trade_type" text,
  "default_quantity" decimal(10,2) DEFAULT '1.00',
  "gst_included" boolean DEFAULT true,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_price_list_items_user_id" ON "price_list_items" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_price_list_items_item_type" ON "price_list_items" ("item_type");--> statement-breakpoint
