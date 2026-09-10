-- Rename role value: superadmin → master
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor)
--
-- 1. Drop the existing CHECK constraint on the role column.
-- 2. Update all existing rows.
-- 3. Re-add the constraint with 'master' in place of 'superadmin'.
-- 4. Update all RLS policies and helper functions that reference 'superadmin'.

-- ── 1. Drop the existing role CHECK constraint ────────────────────────────────
ALTER TABLE personnel DROP CONSTRAINT IF EXISTS personnel_role_check;

-- ── 2. Update existing rows ───────────────────────────────────────────────────
UPDATE personnel SET role = 'master' WHERE role = 'superadmin';

-- ── 3. Re-add the constraint with the new value ───────────────────────────────
ALTER TABLE personnel ADD CONSTRAINT personnel_role_check
  CHECK (role IN ('reservist', 'admin', 'master'));

-- ── 4. Update RLS policies ────────────────────────────────────────────────────
-- Drop and recreate the policies that referenced 'superadmin'.
-- Copy the updated versions from scripts/sql/rls_policies.sql, or run the
-- full rls_policies.sql file to replace all policies in one step.
--
-- The _auth_role() helper function reads the role column directly, so it
-- will return 'master' automatically once the rows are updated above.
-- No change to the function body is needed.
