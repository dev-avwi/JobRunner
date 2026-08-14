-- Migration: project templates — per-business reusable project structure (phases + settings)
-- Safe to run multiple times (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "project_templates" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "template_data" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_project_templates_user_id" ON "project_templates" ("user_id");--> statement-breakpoint
