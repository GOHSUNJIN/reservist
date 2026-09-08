-- Scope no_report_days per department.
-- Run once in Supabase SQL editor.

-- 1. Add department column (nullable so existing rows survive)
ALTER TABLE no_report_days ADD COLUMN IF NOT EXISTS department department_type;

-- 2. Duplicate each existing row for every department so stand-downs
--    previously set without a dept are preserved for all three departments.
INSERT INTO no_report_days (date, department)
SELECT date, d.dept
FROM no_report_days AS nrd
CROSS JOIN (VALUES ('ops_security'::department_type), ('cas'::department_type), ('lnf'::department_type)) AS d(dept)
WHERE nrd.department IS NULL
ON CONFLICT DO NOTHING;

-- 3. Remove the old unscoped rows.
DELETE FROM no_report_days WHERE department IS NULL;

-- 4. Make department NOT NULL now that all rows are scoped.
ALTER TABLE no_report_days ALTER COLUMN department SET NOT NULL;

-- 5. Replace the single-column primary key with a composite key.
ALTER TABLE no_report_days DROP CONSTRAINT IF EXISTS no_report_days_pkey;
ALTER TABLE no_report_days ADD PRIMARY KEY (date, department);

-- 6. Tighten RLS: admins can only insert/delete rows for their own department.
DROP POLICY IF EXISTS "Admins can insert no_report_days" ON no_report_days;
DROP POLICY IF EXISTS "Admins can delete no_report_days" ON no_report_days;

CREATE POLICY "Admins can insert no_report_days" ON no_report_days
  FOR INSERT TO authenticated
  WITH CHECK (
    department = (
      SELECT department FROM personnel WHERE auth_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "Admins can delete no_report_days" ON no_report_days
  FOR DELETE TO authenticated
  USING (
    department = (
      SELECT department FROM personnel WHERE auth_id = auth.uid() LIMIT 1
    )
  );
