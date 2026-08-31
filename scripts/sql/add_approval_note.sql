-- Add approval_note column to leave_requests
-- Stores an optional note left by the admin when approving a request.
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS approval_note text;
