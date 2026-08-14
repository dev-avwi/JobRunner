-- Migration: add is_client_visible flag to project_documents
-- Safe to run multiple times (IF NOT EXISTS column check via DO block).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_documents' AND column_name = 'is_client_visible'
  ) THEN
    ALTER TABLE "project_documents" ADD COLUMN "is_client_visible" boolean NOT NULL DEFAULT false;
  END IF;
END;
$$;
