-- Migration: project document register (drawings, specs, RFIs with revision tracking)
-- Safe to run multiple times (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "project_documents" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "job_id" varchar NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "doc_number" varchar(20) NOT NULL,
  "title" text NOT NULL,
  "category" text NOT NULL DEFAULT 'Other',
  "current_revision" varchar(10) NOT NULL DEFAULT 'A',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_project_documents_job_id" ON "project_documents" ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_documents_user_id" ON "project_documents" ("user_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "project_document_revisions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "document_id" varchar NOT NULL REFERENCES "project_documents"("id") ON DELETE CASCADE,
  "revision" varchar(10) NOT NULL,
  "file_name" text NOT NULL,
  "object_storage_key" text NOT NULL,
  "file_size" integer,
  "mime_type" text,
  "notes" text,
  "uploaded_by" varchar REFERENCES "users"("id"),
  "uploaded_at" timestamp DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_project_document_revisions_document_id" ON "project_document_revisions" ("document_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "project_rfis" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "job_id" varchar NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "rfi_number" varchar(20) NOT NULL,
  "question" text NOT NULL,
  "description" text,
  "assigned_to" varchar,
  "assigned_to_name" text,
  "status" text NOT NULL DEFAULT 'open',
  "answered_at" timestamp,
  "answer_text" text,
  "answer_file_url" text,
  "answer_object_storage_key" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_project_rfis_job_id" ON "project_rfis" ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_rfis_user_id" ON "project_rfis" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_rfis_status" ON "project_rfis" ("status");--> statement-breakpoint
