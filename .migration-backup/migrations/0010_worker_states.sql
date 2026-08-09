CREATE TABLE IF NOT EXISTS "worker_states" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "business_owner_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "state" text NOT NULL DEFAULT 'available',
  "job_id" varchar,
  "note" text,
  "updated_at" timestamp DEFAULT now(),
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "uq_worker_states_biz_user" UNIQUE("business_owner_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "idx_worker_states_user" ON "worker_states" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_worker_states_business" ON "worker_states" ("business_owner_id");
