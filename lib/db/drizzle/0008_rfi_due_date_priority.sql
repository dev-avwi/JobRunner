-- Migration: add due_date and priority columns to project_rfis
-- Safe to run multiple times (IF NOT EXISTS guard via DO block).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_rfis' AND column_name = 'due_date'
  ) THEN
    ALTER TABLE "project_rfis" ADD COLUMN "due_date" timestamp;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_rfis' AND column_name = 'priority'
  ) THEN
    ALTER TABLE "project_rfis" ADD COLUMN "priority" text;
  END IF;
END;
$$;
