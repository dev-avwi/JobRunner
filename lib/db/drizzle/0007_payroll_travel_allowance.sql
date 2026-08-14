-- Migration: persist travel allowance snapshot on payroll payments so that
-- historical payslips cannot change after a rate or time-entry edit.
-- All three columns are nullable so existing payment rows are unaffected.

ALTER TABLE payroll_payments ADD COLUMN IF NOT EXISTS travel_allowance    NUMERIC(10, 2);
ALTER TABLE payroll_payments ADD COLUMN IF NOT EXISTS travel_distance_km  NUMERIC(10, 2);
ALTER TABLE payroll_payments ADD COLUMN IF NOT EXISTS travel_rate_per_km  NUMERIC(10, 4);
