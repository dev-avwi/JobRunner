-- Add availability_status column to team_members table for subcontractor dashboard
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'available';
