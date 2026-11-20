-- ============================================================================
-- ReservistGO: data clean-up PREVIEW (READ-ONLY, changes nothing)
-- ----------------------------------------------------------------------------
-- Shows exactly what 2026-11-20_8b_cleanup_apply.sql would remove. Same rules.
-- ============================================================================
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
),
out(sort, item, n, detail) AS (
  SELECT 1, 'remove: absent on a public holiday nobody in the department worked', count(*),
         coalesce(string_agg(DISTINCT a.date || ' ' || p.department, ', '), '')
  FROM sel_rows r JOIN public.attendance a ON a.id = r.id JOIN public.personnel p ON p.id = a.personnel_id
  WHERE r.reason = 'absent_on_public_holiday'
  UNION ALL
  SELECT 2, 'keep: absent on a public holiday the department worked', coalesce(sum(n), 0)::bigint,
         coalesce(string_agg(date || ' ' || department || ' (' || n || ')', ', '), '')
  FROM kept_holiday
  UNION ALL
  SELECT 3, 'remove: auto-absent after the person''s cycle ended', count(*),
         coalesce(string_agg(DISTINCT p.name, ', '), '')
  FROM sel_rows r JOIN public.attendance a ON a.id = r.id JOIN public.personnel p ON p.id = a.personnel_id
  WHERE r.reason = 'after_cycle_end'
  UNION ALL
  SELECT 4, 'remove: auto-absent before the cycle started, no earlier cycle', count(*),
         coalesce(string_agg(DISTINCT p.name, ', '), '')
  FROM sel_rows r JOIN public.attendance a ON a.id = r.id JOIN public.personnel p ON p.id = a.personnel_id
  WHERE r.reason = 'before_cycle_start'
  UNION ALL
  SELECT 5, 'keep: absent before the cycle, inside an earlier cycle they did', count(*),
         coalesce(string_agg(DISTINCT e.name, ', '), '')
  FROM empty_absent e JOIN public.batches b ON b.id = e.batch_id
  WHERE e.date < b.start_date AND e.id NOT IN (SELECT id FROM sel_rows)
  UNION ALL
  SELECT 6, 'remove: logins with nothing attached (over 3 days old)', count(*),
         coalesce(string_agg(split_part(email, '@', 1), ', '), '')
  FROM sel_logins
  UNION ALL
  SELECT 7, 'deactivate (remove from roster): active reservist with no cycle', count(*),
         coalesce(string_agg(name, ', '), '')
  FROM sel_deactivate
  UNION ALL
  SELECT 8, 'total attendance rows to remove', count(*), '' FROM sel_rows
  UNION ALL
  SELECT 9, 'attendance rows after clean-up', (SELECT count(*) FROM public.attendance) - (SELECT count(*) FROM sel_rows), ''
)
SELECT item, n AS count, detail FROM out ORDER BY sort;
