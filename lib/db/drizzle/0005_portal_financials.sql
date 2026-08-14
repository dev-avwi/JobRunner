-- Migration: add show_financials_on_portal toggle to job_portal_tokens
-- Safe to run multiple times (IF NOT EXISTS / IF NOT EXISTS semantics via ADD COLUMN IF NOT EXISTS).

ALTER TABLE "job_portal_tokens" ADD COLUMN IF NOT EXISTS "show_financials_on_portal" boolean NOT NULL DEFAULT false;
