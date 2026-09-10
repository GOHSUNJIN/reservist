-- ── Add department support ────────────────────────────────────────────────
-- Run this in the Supabase SQL Editor once.
-- Existing data (personnel, batches, signup_requests) will default to ops_security.

-- 1. Create the department enum
DO $$ BEGIN
  CREATE TYPE department_type AS ENUM ('ops_security', 'cas');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add department column to personnel (existing rows -> ops_security)
ALTER TABLE personnel
  ADD COLUMN IF NOT EXISTS department department_type NOT NULL DEFAULT 'ops_security';

-- 3. Add department column to batches (existing rows -> ops_security)
ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS department department_type NOT NULL DEFAULT 'ops_security';

-- 4. Add department column to signup_requests (existing rows -> ops_security)
ALTER TABLE signup_requests
  ADD COLUMN IF NOT EXISTS department department_type NOT NULL DEFAULT 'ops_security';

-- 5. Index for common department queries
CREATE INDEX IF NOT EXISTS personnel_department_idx ON personnel(department);
CREATE INDEX IF NOT EXISTS batches_department_idx ON batches(department);
CREATE INDEX IF NOT EXISTS signup_requests_department_idx ON signup_requests(department);
