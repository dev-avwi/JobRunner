-- Migration: add job_type column to jobs table
-- Distinguishes simple service calls from multi-phase projects.
-- Controls which detail tabs are shown (phases, claims, POs for projects only).
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS).

ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "job_type" text DEFAULT 'service';
