-- ============================================================
-- Row Level Security policies for ReservistGO
-- Run this entire file in the Supabase SQL Editor once.
-- ============================================================

-- Helper functions (SECURITY DEFINER lets them read personnel
-- without triggering RLS recursion)
CREATE OR REPLACE FUNCTION _auth_role()
RETURNS TEXT AS $$
  SELECT role FROM personnel WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION _auth_dept()
RETURNS TEXT AS $$
  SELECT department::text FROM personnel WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION _auth_pid()
RETURNS UUID AS $$
  SELECT id FROM personnel WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION _auth_batch_id()
RETURNS UUID AS $$
  SELECT batch_id FROM personnel WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Enable RLS on all tables ─────────────────────────────────
ALTER TABLE personnel       ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance      ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE signup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE no_report_days  ENABLE ROW LEVEL SECURITY;

-- ── Drop old blanket policies ────────────────────────────────
DROP POLICY IF EXISTS "authenticated" ON personnel;
DROP POLICY IF EXISTS "authenticated" ON batches;
DROP POLICY IF EXISTS "authenticated" ON attendance;
DROP POLICY IF EXISTS "authenticated" ON leave_requests;
DROP POLICY IF EXISTS "authenticated" ON signup_requests;
DROP POLICY IF EXISTS "authenticated" ON no_report_days;

-- ── personnel ────────────────────────────────────────────────
-- Reservists see their own row + teammates in the same batch; admins see all
DROP POLICY IF EXISTS "personnel_select" ON personnel;
CREATE POLICY "personnel_select" ON personnel FOR SELECT TO authenticated
  USING (
    auth_id = auth.uid()
    OR _auth_role() IN ('admin','superadmin')
    OR (
      _auth_role() = 'reservist'
      AND batch_id IS NOT NULL
      AND batch_id = _auth_batch_id()
      AND (role IS NULL OR role = 'reservist')
    )
  );

-- Only admins can add people
CREATE POLICY "personnel_insert" ON personnel FOR INSERT TO authenticated
  WITH CHECK (_auth_role() IN ('admin','superadmin'));

-- Admins can update reservist rows; only superadmins can set role to admin or superadmin
CREATE POLICY "personnel_update" ON personnel FOR UPDATE TO authenticated
  USING (_auth_role() IN ('admin','superadmin'))
  WITH CHECK (
    CASE
      WHEN role = 'superadmin' THEN _auth_role() = 'superadmin'
      WHEN role = 'admin'      THEN _auth_role() = 'superadmin'
      ELSE _auth_role() IN ('admin','superadmin')
    END
  );

-- Only superadmins can permanently delete accounts
CREATE POLICY "personnel_delete" ON personnel FOR DELETE TO authenticated
  USING (_auth_role() = 'superadmin');

-- ── batches ──────────────────────────────────────────────────
CREATE POLICY "batches_select" ON batches FOR SELECT TO authenticated USING (true);

CREATE POLICY "batches_insert" ON batches FOR INSERT TO authenticated
  WITH CHECK (_auth_role() IN ('admin','superadmin'));

CREATE POLICY "batches_update" ON batches FOR UPDATE TO authenticated
  USING (_auth_role() IN ('admin','superadmin'));

CREATE POLICY "batches_delete" ON batches FOR DELETE TO authenticated
  USING (_auth_role() IN ('admin','superadmin'));

-- ── attendance ───────────────────────────────────────────────
CREATE POLICY "attendance_select" ON attendance FOR SELECT TO authenticated
  USING (personnel_id = _auth_pid() OR _auth_role() IN ('admin','superadmin'));

CREATE POLICY "attendance_insert" ON attendance FOR INSERT TO authenticated
  WITH CHECK (
    _auth_role() IN ('admin','superadmin')
    OR (personnel_id = _auth_pid() AND date = CURRENT_DATE)
  );

CREATE POLICY "attendance_update" ON attendance FOR UPDATE TO authenticated
  USING (personnel_id = _auth_pid() OR _auth_role() IN ('admin','superadmin'))
  WITH CHECK (
    _auth_role() IN ('admin','superadmin')
    OR (personnel_id = _auth_pid() AND date = CURRENT_DATE)
  );

CREATE POLICY "attendance_delete" ON attendance FOR DELETE TO authenticated
  USING (_auth_role() IN ('admin','superadmin'));

-- ── leave_requests ───────────────────────────────────────────
CREATE POLICY "leave_select" ON leave_requests FOR SELECT TO authenticated
  USING (personnel_id = _auth_pid() OR _auth_role() IN ('admin','superadmin'));

-- Reservists can only submit requests for themselves
CREATE POLICY "leave_insert" ON leave_requests FOR INSERT TO authenticated
  WITH CHECK (personnel_id = _auth_pid());

-- Reservists can cancel their own pending requests; admins can approve/reject any
CREATE POLICY "leave_update" ON leave_requests FOR UPDATE TO authenticated
  USING (personnel_id = _auth_pid() OR _auth_role() IN ('admin','superadmin'));

CREATE POLICY "leave_delete" ON leave_requests FOR DELETE TO authenticated
  USING (personnel_id = _auth_pid() OR _auth_role() IN ('admin','superadmin'));

-- ── signup_requests ──────────────────────────────────────────
CREATE POLICY "signup_select" ON signup_requests FOR SELECT TO authenticated
  USING (auth_id = auth.uid() OR _auth_role() IN ('admin','superadmin'));

CREATE POLICY "signup_insert" ON signup_requests FOR INSERT TO authenticated
  WITH CHECK (auth_id = auth.uid());

CREATE POLICY "signup_update" ON signup_requests FOR UPDATE TO authenticated
  USING (auth_id = auth.uid() OR _auth_role() IN ('admin','superadmin'));

CREATE POLICY "signup_delete" ON signup_requests FOR DELETE TO authenticated
  USING (_auth_role() IN ('admin','superadmin'));

-- ── no_report_days ───────────────────────────────────────────
CREATE POLICY "nrd_select" ON no_report_days FOR SELECT TO authenticated USING (true);

CREATE POLICY "nrd_insert" ON no_report_days FOR INSERT TO authenticated
  WITH CHECK (_auth_role() IN ('admin','superadmin'));

CREATE POLICY "nrd_delete" ON no_report_days FOR DELETE TO authenticated
  USING (_auth_role() IN ('admin','superadmin'));
