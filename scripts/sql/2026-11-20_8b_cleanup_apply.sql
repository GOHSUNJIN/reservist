-- ============================================================================
-- ALREADY APPLIED on 2026-11-20. The reservist's name was removed afterwards because this repo is public; re-running now deactivates nobody. The record is in backup_20261120_cleanup.deactivated_personnel.
-- ReservistGO: data clean-up APPLY
-- ----------------------------------------------------------------------------
-- Removes the rows shown by 2026-11-20_8a_cleanup_preview_READ_ONLY.sql.
-- Copies every removed attendance row into backup_20261120_cleanup first
-- (2026-11-20_8c_cleanup_undo.sql puts them back). Also deactivated one named reservist (name removed from this public file)
-- (active, no cycle; reversible). Removed test logins are
-- listed there too but cannot be restored (they had no data).
-- One transaction; ends by showing what it did.
-- ============================================================================
BEGIN;

DO $$
BEGIN
  IF to_regnamespace('backup_20261120_cleanup') IS NOT NULL THEN
    RAISE EXCEPTION 'backup_20261120_cleanup already exists: the clean-up has already been applied.';
  END IF;
END $$;

CREATE SCHEMA backup_20261120_cleanup;
REVOKE ALL ON SCHEMA backup_20261120_cleanup FROM PUBLIC;
DO $$ BEGIN EXECUTE 'REVOKE ALL ON SCHEMA backup_20261120_cleanup FROM anon, authenticated';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE TABLE backup_20261120_cleanup.removed_attendance AS
WITH 
today AS (SELECT (now() AT TIME ZONE 'Asia/Singapore')::date AS d),
holidays(d) AS (VALUES
  ('2025-01-01'::date),('2025-01-29'),('2025-01-30'),('2025-03-31'),('2025-04-18'),('2025-05-01'),
  ('2025-05-03'),('2025-05-12'),('2025-06-07'),('2025-08-09'),('2025-10-20'),('2025-12-25'),
  ('2026-01-01'),('2026-02-17'),('2026-02-18'),('2026-03-21'),('2026-04-03'),('2026-05-01'),
  ('2026-05-27'),('2026-05-31'),('2026-06-01'),('2026-08-09'),('2026-08-10'),('2026-11-08'),
  ('2026-11-09'),('2026-12-25')),
-- absent rows nobody typed anything into, and not tied to approved leave
empty_absent AS (
  SELECT a.id, a.personnel_id, a.date, p.name, p.department, p.batch_id
  FROM public.attendance a JOIN public.personnel p ON p.id = a.personnel_id
  WHERE a.status = 'absent' AND a.check_in_time IS NULL AND a.lunch_out_time IS NULL
    AND a.work_return_time IS NULL AND a.work_end_time IS NULL
    AND coalesce(a.welfare_note, '') = '' AND coalesce(a.edit_log, '[]'::jsonb) = '[]'::jsonb
    AND NOT EXISTS (SELECT 1 FROM public.leave_requests l
                    WHERE l.personnel_id = a.personnel_id AND l.date = a.date AND l.status = 'approved')
),
-- holiday dates on which nobody in that department checked in
dept_day_present AS (
  SELECT a.date, p.department, count(*) AS n
  FROM public.attendance a JOIN public.personnel p ON p.id = a.personnel_id
  WHERE a.status = 'present' GROUP BY 1, 2
),
sel_holiday AS (
  SELECT e.id, 'absent_on_public_holiday'::text AS reason FROM empty_absent e
  JOIN holidays h ON h.d = e.date
  WHERE NOT EXISTS (SELECT 1 FROM dept_day_present x WHERE x.date = e.date AND x.department = e.department)
),
sel_after AS (
  SELECT e.id, 'after_cycle_end'::text FROM empty_absent e JOIN public.batches b ON b.id = e.batch_id
  WHERE e.date > b.end_date
),
-- before the current cycle: kept when the person really did an earlier cycle covering that date
sel_before AS (
  SELECT e.id, 'before_cycle_start'::text FROM empty_absent e JOIN public.batches b ON b.id = e.batch_id
  WHERE e.date < b.start_date
    AND NOT EXISTS (
      SELECT 1 FROM public.batches eb
      WHERE e.date BETWEEN eb.start_date AND eb.end_date AND eb.id <> b.id
        AND (EXISTS (SELECT 1 FROM public.attendance a2 WHERE a2.personnel_id = e.personnel_id
                     AND a2.status IN ('present', 'mc') AND a2.date BETWEEN eb.start_date AND eb.end_date)
             OR EXISTS (SELECT 1 FROM public.signup_requests s WHERE s.batch_id = eb.id AND s.status = 'approved'
                        AND (s.auth_id = (SELECT pp.auth_id FROM public.personnel pp WHERE pp.id = e.personnel_id)))))
),
sel_rows AS (
  SELECT DISTINCT ON (id) id, reason FROM (
    SELECT * FROM sel_holiday UNION ALL SELECT * FROM sel_after UNION ALL SELECT * FROM sel_before) u
  ORDER BY id, reason
),
sel_logins AS (
  SELECT u.id, u.email, u.created_at FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.personnel p WHERE p.auth_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.signup_requests s WHERE s.auth_id = u.id)
    AND u.created_at < now() - interval '3 days'
),
sel_deactivate AS (   -- asked for by the owner on 20 Nov: active, no cycle
  SELECT p.id, p.name FROM public.personnel p
  WHERE lower(btrim(p.name)) = '(name removed)' AND p.is_active AND p.role = 'reservist' AND p.batch_id IS NULL
),
kept_holiday AS (   -- holiday absences kept because colleagues worked that day
  SELECT e.date, e.department, count(*) AS n FROM empty_absent e JOIN holidays h ON h.d = e.date
  WHERE EXISTS (SELECT 1 FROM dept_day_present x WHERE x.date = e.date AND x.department = e.department)
  GROUP BY 1, 2
)
SELECT a.*, r.reason AS cleanup_reason FROM public.attendance a JOIN sel_rows r ON r.id = a.id;

CREATE TABLE backup_20261120_cleanup.removed_logins AS
WITH 
today AS (SELECT (now() AT TIME ZONE 'Asia/Singapore')::date AS d),
holidays(d) AS (VALUES
  ('2025-01-01'::date),('2025-01-29'),('2025-01-30'),('2025-03-31'),('2025-04-18'),('2025-05-01'),
  ('2025-05-03'),('2025-05-12'),('2025-06-07'),('2025-08-09'),('2025-10-20'),('2025-12-25'),
  ('2026-01-01'),('2026-02-17'),('2026-02-18'),('2026-03-21'),('2026-04-03'),('2026-05-01'),
  ('2026-05-27'),('2026-05-31'),('2026-06-01'),('2026-08-09'),('2026-08-10'),('2026-11-08'),
  ('2026-11-09'),('2026-12-25')),
-- absent rows nobody typed anything into, and not tied to approved leave
empty_absent AS (
  SELECT a.id, a.personnel_id, a.date, p.name, p.department, p.batch_id
  FROM public.attendance a JOIN public.personnel p ON p.id = a.personnel_id
  WHERE a.status = 'absent' AND a.check_in_time IS NULL AND a.lunch_out_time IS NULL
    AND a.work_return_time IS NULL AND a.work_end_time IS NULL
    AND coalesce(a.welfare_note, '') = '' AND coalesce(a.edit_log, '[]'::jsonb) = '[]'::jsonb
    AND NOT EXISTS (SELECT 1 FROM public.leave_requests l
                    WHERE l.personnel_id = a.personnel_id AND l.date = a.date AND l.status = 'approved')
),
-- holiday dates on which nobody in that department checked in
dept_day_present AS (
  SELECT a.date, p.department, count(*) AS n
  FROM public.attendance a JOIN public.personnel p ON p.id = a.personnel_id
  WHERE a.status = 'present' GROUP BY 1, 2
),
sel_holiday AS (
  SELECT e.id, 'absent_on_public_holiday'::text AS reason FROM empty_absent e
  JOIN holidays h ON h.d = e.date
  WHERE NOT EXISTS (SELECT 1 FROM dept_day_present x WHERE x.date = e.date AND x.department = e.department)
),
sel_after AS (
  SELECT e.id, 'after_cycle_end'::text FROM empty_absent e JOIN public.batches b ON b.id = e.batch_id
  WHERE e.date > b.end_date
),
-- before the current cycle: kept when the person really did an earlier cycle covering that date
sel_before AS (
  SELECT e.id, 'before_cycle_start'::text FROM empty_absent e JOIN public.batches b ON b.id = e.batch_id
  WHERE e.date < b.start_date
    AND NOT EXISTS (
      SELECT 1 FROM public.batches eb
      WHERE e.date BETWEEN eb.start_date AND eb.end_date AND eb.id <> b.id
        AND (EXISTS (SELECT 1 FROM public.attendance a2 WHERE a2.personnel_id = e.personnel_id
                     AND a2.status IN ('present', 'mc') AND a2.date BETWEEN eb.start_date AND eb.end_date)
             OR EXISTS (SELECT 1 FROM public.signup_requests s WHERE s.batch_id = eb.id AND s.status = 'approved'
                        AND (s.auth_id = (SELECT pp.auth_id FROM public.personnel pp WHERE pp.id = e.personnel_id)))))
),
sel_rows AS (
  SELECT DISTINCT ON (id) id, reason FROM (
    SELECT * FROM sel_holiday UNION ALL SELECT * FROM sel_after UNION ALL SELECT * FROM sel_before) u
  ORDER BY id, reason
),
sel_logins AS (
  SELECT u.id, u.email, u.created_at FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.personnel p WHERE p.auth_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.signup_requests s WHERE s.auth_id = u.id)
    AND u.created_at < now() - interval '3 days'
),
sel_deactivate AS (   -- asked for by the owner on 20 Nov: active, no cycle
  SELECT p.id, p.name FROM public.personnel p
  WHERE lower(btrim(p.name)) = '(name removed)' AND p.is_active AND p.role = 'reservist' AND p.batch_id IS NULL
),
kept_holiday AS (   -- holiday absences kept because colleagues worked that day
  SELECT e.date, e.department, count(*) AS n FROM empty_absent e JOIN holidays h ON h.d = e.date
  WHERE EXISTS (SELECT 1 FROM dept_day_present x WHERE x.date = e.date AND x.department = e.department)
  GROUP BY 1, 2
)
SELECT id, email, created_at FROM sel_logins;

CREATE TABLE backup_20261120_cleanup.deactivated_personnel AS
WITH 
today AS (SELECT (now() AT TIME ZONE 'Asia/Singapore')::date AS d),
holidays(d) AS (VALUES
  ('2025-01-01'::date),('2025-01-29'),('2025-01-30'),('2025-03-31'),('2025-04-18'),('2025-05-01'),
  ('2025-05-03'),('2025-05-12'),('2025-06-07'),('2025-08-09'),('2025-10-20'),('2025-12-25'),
  ('2026-01-01'),('2026-02-17'),('2026-02-18'),('2026-03-21'),('2026-04-03'),('2026-05-01'),
  ('2026-05-27'),('2026-05-31'),('2026-06-01'),('2026-08-09'),('2026-08-10'),('2026-11-08'),
  ('2026-11-09'),('2026-12-25')),
-- absent rows nobody typed anything into, and not tied to approved leave
empty_absent AS (
  SELECT a.id, a.personnel_id, a.date, p.name, p.department, p.batch_id
  FROM public.attendance a JOIN public.personnel p ON p.id = a.personnel_id
  WHERE a.status = 'absent' AND a.check_in_time IS NULL AND a.lunch_out_time IS NULL
    AND a.work_return_time IS NULL AND a.work_end_time IS NULL
    AND coalesce(a.welfare_note, '') = '' AND coalesce(a.edit_log, '[]'::jsonb) = '[]'::jsonb
    AND NOT EXISTS (SELECT 1 FROM public.leave_requests l
                    WHERE l.personnel_id = a.personnel_id AND l.date = a.date AND l.status = 'approved')
),
-- holiday dates on which nobody in that department checked in
dept_day_present AS (
  SELECT a.date, p.department, count(*) AS n
  FROM public.attendance a JOIN public.personnel p ON p.id = a.personnel_id
  WHERE a.status = 'present' GROUP BY 1, 2
),
sel_holiday AS (
  SELECT e.id, 'absent_on_public_holiday'::text AS reason FROM empty_absent e
  JOIN holidays h ON h.d = e.date
  WHERE NOT EXISTS (SELECT 1 FROM dept_day_present x WHERE x.date = e.date AND x.department = e.department)
),
sel_after AS (
  SELECT e.id, 'after_cycle_end'::text FROM empty_absent e JOIN public.batches b ON b.id = e.batch_id
  WHERE e.date > b.end_date
),
-- before the current cycle: kept when the person really did an earlier cycle covering that date
sel_before AS (
  SELECT e.id, 'before_cycle_start'::text FROM empty_absent e JOIN public.batches b ON b.id = e.batch_id
  WHERE e.date < b.start_date
    AND NOT EXISTS (
      SELECT 1 FROM public.batches eb
      WHERE e.date BETWEEN eb.start_date AND eb.end_date AND eb.id <> b.id
        AND (EXISTS (SELECT 1 FROM public.attendance a2 WHERE a2.personnel_id = e.personnel_id
                     AND a2.status IN ('present', 'mc') AND a2.date BETWEEN eb.start_date AND eb.end_date)
             OR EXISTS (SELECT 1 FROM public.signup_requests s WHERE s.batch_id = eb.id AND s.status = 'approved'
                        AND (s.auth_id = (SELECT pp.auth_id FROM public.personnel pp WHERE pp.id = e.personnel_id)))))
),
sel_rows AS (
  SELECT DISTINCT ON (id) id, reason FROM (
    SELECT * FROM sel_holiday UNION ALL SELECT * FROM sel_after UNION ALL SELECT * FROM sel_before) u
  ORDER BY id, reason
),
sel_logins AS (
  SELECT u.id, u.email, u.created_at FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.personnel p WHERE p.auth_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.signup_requests s WHERE s.auth_id = u.id)
    AND u.created_at < now() - interval '3 days'
),
sel_deactivate AS (   -- asked for by the owner on 20 Nov: active, no cycle
  SELECT p.id, p.name FROM public.personnel p
  WHERE lower(btrim(p.name)) = '(name removed)' AND p.is_active AND p.role = 'reservist' AND p.batch_id IS NULL
),
kept_holiday AS (   -- holiday absences kept because colleagues worked that day
  SELECT e.date, e.department, count(*) AS n FROM empty_absent e JOIN holidays h ON h.d = e.date
  WHERE EXISTS (SELECT 1 FROM dept_day_present x WHERE x.date = e.date AND x.department = e.department)
  GROUP BY 1, 2
)
SELECT p.id, p.name, p.is_active, p.deactivated_at FROM public.personnel p JOIN sel_deactivate d ON d.id = p.id;

DO $$
BEGIN
  IF (SELECT count(*) FROM backup_20261120_cleanup.deactivated_personnel) > 1 THEN
    RAISE EXCEPTION 'More than one matching active reservist without a cycle; nothing was changed. Send this message.';
  END IF;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA backup_20261120_cleanup FROM PUBLIC;
DO $$ BEGIN EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA backup_20261120_cleanup FROM anon, authenticated';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DELETE FROM public.attendance a USING backup_20261120_cleanup.removed_attendance r WHERE a.id = r.id;
DELETE FROM auth.users u USING backup_20261120_cleanup.removed_logins r WHERE u.id = r.id;
UPDATE public.personnel p SET is_active = false, deactivated_at = now()
FROM backup_20261120_cleanup.deactivated_personnel d WHERE p.id = d.id;
UPDATE public.leave_requests l SET status = 'cancelled'
FROM backup_20261120_cleanup.deactivated_personnel d WHERE l.personnel_id = d.id AND l.status = 'pending';

INSERT INTO public.audit_log (actor_name, actor_role, department, category, action, meta)
SELECT 'Database clean-up', 'system', NULL, 'data', 'data.cleanup.applied',
       jsonb_build_object('attendance_removed', (SELECT count(*) FROM backup_20261120_cleanup.removed_attendance),
                          'by_reason', (SELECT jsonb_object_agg(cleanup_reason, n) FROM
                                         (SELECT cleanup_reason, count(*) n FROM backup_20261120_cleanup.removed_attendance GROUP BY 1) x),
                          'logins_removed', (SELECT count(*) FROM backup_20261120_cleanup.removed_logins),
                          'deactivated', (SELECT jsonb_agg(name) FROM backup_20261120_cleanup.deactivated_personnel));

COMMIT;

SELECT 'attendance removed: ' || cleanup_reason AS item, count(*) AS count FROM backup_20261120_cleanup.removed_attendance GROUP BY 1
UNION ALL SELECT 'logins removed', count(*) FROM backup_20261120_cleanup.removed_logins
UNION ALL SELECT 'deactivated: ' || name, 1 FROM backup_20261120_cleanup.deactivated_personnel
UNION ALL SELECT 'attendance rows now', count(*) FROM public.attendance
ORDER BY 1;
