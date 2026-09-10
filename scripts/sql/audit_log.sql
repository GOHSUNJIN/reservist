-- Audit log table: captures all user actions across reservists, admins, and masters
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  actor_id UUID,
  actor_name TEXT,
  actor_role TEXT,
  department TEXT,
  category TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  target_name TEXT,
  meta JSONB
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_department_idx ON audit_log (department);
CREATE INDEX IF NOT EXISTS audit_log_category_idx ON audit_log (category);
CREATE INDEX IF NOT EXISTS audit_log_actor_id_idx ON audit_log (actor_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log (action);

-- RLS policies
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can insert, except auth/session category rows (no longer logged by app)
-- Run this in Supabase SQL editor to replace the old policy:
--   DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;
--   CREATE POLICY "audit_log_insert" ON audit_log
--     FOR INSERT TO authenticated WITH CHECK (category NOT IN ('auth', 'session'));
CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT TO authenticated WITH CHECK (category NOT IN ('auth', 'session'));

-- Only authenticated users can select (app layer enforces admin-only access)
CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT TO authenticated USING (true);
