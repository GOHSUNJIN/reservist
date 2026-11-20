-- ============================================================================
-- ReservistGO: data clean-up report (READ-ONLY, changes nothing)
-- ----------------------------------------------------------------------------
-- One SELECT so the Supabase SQL editor shows it as one table. Download the
-- result as CSV and send it back; the clean-up script is then written for
-- exactly what this finds. Works before or after the follow-up migration.
--
-- severity: fix = almost certainly wrong data
--           review = probably wrong, needs a human look
--           info = context only
-- ============================================================================
WITH
today AS (SELECT (now() AT TIME ZONE 'Asia/Singapore')::date AS d),
-- MOM gazetted public holidays incl. observed Mondays (2025-2027)
holidays(d) AS (VALUES
  ('2025-01-01'::date),('2025-01-29'),('2025-01-30'),('2025-03-31'),('2025-04-18'),('2025-05-01'),
  ('2025-05-03'),('2025-05-12'),('2025-06-07'),('2025-08-09'),('2025-10-20'),('2025-12-25'),
  ('2026-01-01'),('2026-02-17'),('2026-02-18'),('2026-03-21'),('2026-04-03'),('2026-05-01'),
  ('2026-05-27'),('2026-05-31'),('2026-06-01'),('2026-08-09'),('2026-08-10'),('2026-11-08'),
  ('2026-11-09'),('2026-12-25'),
  ('2027-01-01'),('2027-02-06'),('2027-02-07'),('2027-02-08'),('2027-03-10'),('2027-03-26'),
  ('2027-05-01'),('2027-05-17'),('2027-05-20'),('2027-08-09'),('2027-10-28'),('2027-12-25')),
norm AS (
  SELECT p.*, regexp_replace(coalesce(p.contact, ''), '[\s-]', '', 'g') AS c FROM public.personnel p
),
empty_absent AS (   -- absent rows with nothing entered by a person
  SELECT a.*, p.name, p.department::text AS dept, p.batch_id
  FROM public.attendance a JOIN public.personnel p ON p.id = a.personnel_id
  WHERE a.status = 'absent' AND a.check_in_time IS NULL AND a.work_end_time IS NULL
    AND coalesce(a.welfare_note, '') = '' AND coalesce(a.edit_log, '[]'::jsonb) = '[]'::jsonb
),
report(sort, check_name, severity, n, sample, meaning) AS (

  SELECT 1, 'orphan_logins', 'review', count(*),
    string_agg(split_part(u.email, '@', 1) || ' (' || to_char(u.created_at AT TIME ZONE 'Asia/Singapore', 'YYYY-MM-DD') || ')', ', ' ORDER BY u.created_at) FILTER (WHERE rn <= 10),
    'Logins with no personnel record and no sign-up request (half-created accounts or leftovers from deletions). They can still log in but see nothing.'
  FROM (SELECT u.*, row_number() OVER (ORDER BY u.created_at) rn FROM auth.users u
        WHERE NOT EXISTS (SELECT 1 FROM public.personnel p WHERE p.auth_id = u.id)
          AND NOT EXISTS (SELECT 1 FROM public.signup_requests s WHERE s.auth_id = u.id)) u

  UNION ALL
  SELECT 2, 'approved_signup_no_record', 'fix', count(*),
    string_agg(s.name || ' / ' || s.contact, ', ') FILTER (WHERE rn <= 10),
    'Sign-up marked approved but no personnel record linked to that login: the person cannot use the app ("setup incomplete").'
  FROM (SELECT s.*, row_number() OVER (ORDER BY s.created_at) rn FROM public.signup_requests s
        WHERE s.status = 'approved'
          AND NOT EXISTS (SELECT 1 FROM public.personnel p WHERE p.auth_id = s.auth_id)
          AND NOT EXISTS (SELECT 1 FROM public.signup_requests s2 WHERE s2.auth_id = s.auth_id AND s2.created_at > s.created_at)) s

  UNION ALL
  SELECT 3, 'stale_pending_signups', 'review', count(*),
    string_agg(s.name || ' (' || s.department::text || ', ' || coalesce(b.label, 'no intake') || ')', ', ') FILTER (WHERE rn <= 10),
    'Pending sign-ups whose intake has already ended or that are over 21 days old.'
  FROM (SELECT s.*, row_number() OVER (ORDER BY s.created_at) rn FROM public.signup_requests s
        LEFT JOIN public.batches b0 ON b0.id = s.batch_id, today
        WHERE s.status = 'pending' AND (b0.end_date < today.d OR s.created_at < now() - interval '21 days')) s
  LEFT JOIN public.batches b ON b.id = s.batch_id

  UNION ALL
  SELECT 4, 'signup_intake_wrong_department', 'fix', count(*),
    string_agg(s.name || ' (' || s.department::text || ' request, ' || b.department::text || ' intake)', ', '),
    'Sign-up whose intake belongs to a different department.'
  FROM public.signup_requests s JOIN public.batches b ON b.id = s.batch_id
  WHERE b.department <> s.department

  UNION ALL
  SELECT 5, 'active_reservist_no_cycle', 'review', count(*),
    string_agg(p.name || ' (' || p.department::text || ')', ', '),
    'Active reservists not assigned to any cycle: they get no auto-absent, no dekit deactivation.'
  FROM public.personnel p WHERE p.is_active AND p.role = 'reservist' AND p.batch_id IS NULL

  UNION ALL
  SELECT 6, 'active_after_dekit', 'fix', count(*),
    string_agg(p.name || ' (dekit ' || b.dekit_date || ')', ', '),
    'Active reservists whose cycle dekit date has passed: should have been deactivated.'
  FROM public.personnel p JOIN public.batches b ON b.id = p.batch_id, today
  WHERE p.is_active AND p.role = 'reservist' AND b.dekit_date < today.d

  UNION ALL
  SELECT 7, 'cycle_wrong_department', 'fix', count(*),
    string_agg(p.name || ' (' || p.department::text || ' person, ' || b.department::text || ' cycle)', ', '),
    'Personnel assigned to a cycle of another department (they show under the wrong roster).'
  FROM public.personnel p JOIN public.batches b ON b.id = p.batch_id
  WHERE b.department <> p.department

  UNION ALL
  SELECT 8, 'active_without_login', 'review', count(*),
    string_agg(p.name || ' (' || p.role || ')', ', '),
    'Active personnel with no linked login: they cannot sign in.'
  FROM public.personnel p WHERE p.is_active AND p.auth_id IS NULL

  UNION ALL
  SELECT 9, 'duplicate_contacts', 'review', count(*),
    string_agg(d.c || ': ' || d.names, ' | '),
    'Same phone number on more than one personnel record.'
  FROM (SELECT c, string_agg(name || CASE WHEN is_active THEN ' (active)' ELSE '' END, ', ') names
        FROM norm WHERE c <> '' GROUP BY c HAVING count(*) > 1) d

  UNION ALL
  SELECT 10, 'contact_format', 'info', count(*),
    string_agg(DISTINCT CASE WHEN contact ~ '^[689][0-9]{7}$' THEN 'clean' WHEN c ~ '^[689][0-9]{7}$' THEN 'has spaces/dashes' ELSE 'not an 8-digit SG number' END, ', '),
    'Personnel contacts not stored as 8 plain digits (the sign-up form stores plain digits).'
  FROM norm WHERE contact !~ '^[689][0-9]{7}$'

  UNION ALL
  SELECT 11, 'absent_on_public_holiday', 'fix', count(*),
    string_agg(DISTINCT e.date::text, ', '),
    'Auto-absent records on a public holiday (the old nightly job did not skip holidays).'
  FROM empty_absent e JOIN holidays h ON h.d = e.date

  UNION ALL
  SELECT 12, 'absent_on_no_report_day', 'fix', count(*),
    string_agg(DISTINCT e.date::text || ' ' || e.dept, ', '),
    'Auto-absent records on a no-report day of that person''s department.'
  FROM empty_absent e JOIN public.no_report_days n ON n.date = e.date AND n.department::text = e.dept

  UNION ALL
  SELECT 13, 'absent_on_non_report_day', 'fix', count(*),
    string_agg(DISTINCT e.date::text || ' ' || e.dept, ', '),
    'Absent records on a day that department does not report (weekend; Sunday for L&F).'
  FROM empty_absent e
  WHERE (e.dept = 'lnf' AND EXTRACT(ISODOW FROM e.date) = 7)
     OR (e.dept <> 'lnf' AND EXTRACT(ISODOW FROM e.date) IN (6, 7))

  UNION ALL
  SELECT 14, 'absent_outside_current_cycle', 'review', count(*),
    string_agg(DISTINCT e.name, ', '),
    'Auto-absent records dated outside the person''s current cycle (before its start or after its end). Some may belong to an earlier cycle; most are leftovers from the old nightly job.'
  FROM empty_absent e JOIN public.batches b ON b.id = e.batch_id
  WHERE e.date < b.start_date OR e.date > b.end_date

  UNION ALL
  SELECT 15, 'future_attendance', 'fix', count(*),
    string_agg(DISTINCT a.date::text || ' ' || a.status, ', '),
    'Attendance records dated after today (other than MC/leave entered in advance).'
  FROM public.attendance a, today WHERE a.date > today.d AND a.status NOT IN ('mc')

  UNION ALL
  SELECT 16, 'present_without_check_in', 'review', count(*),
    string_agg(p.name || ' ' || a.date, ', ') FILTER (WHERE rn <= 10),
    'Marked present but no check-in time (set by a supervisor without times).'
  FROM (SELECT a.*, row_number() OVER (ORDER BY a.date DESC) rn FROM public.attendance a
        WHERE a.status = 'present' AND a.check_in_time IS NULL) a JOIN public.personnel p ON p.id = a.personnel_id

  UNION ALL
  SELECT 17, 'attendance_status_values', 'info', sum(n)::bigint, string_agg(status || '=' || n, ', ' ORDER BY n DESC), 'Status values in use.'
  FROM (SELECT coalesce(status, 'null') status, count(*) n FROM public.attendance GROUP BY 1) x

  UNION ALL
  SELECT 18, 'several_live_cycles', 'fix', count(*), string_agg(department || ': ' || labels, ' | '),
    'More than one cycle marked live in the same department.'
  FROM (SELECT department::text department, string_agg(label, ', ') labels FROM public.batches WHERE is_live GROUP BY 1 HAVING count(*) > 1) x

  UNION ALL
  SELECT 19, 'cycle_dates_invalid', 'fix', count(*), string_agg(label || ' ' || department::text, ', '),
    'Cycles whose end is before their start, or whose dekit is before their end.'
  FROM public.batches WHERE end_date < start_date OR dekit_date < end_date

  UNION ALL
  SELECT 20, 'overlapping_cycles', 'review', count(*), string_agg(a_label || ' / ' || b_label || ' (' || dept || ')', ', '),
    'Cycles in the same department whose dates overlap.'
  FROM (SELECT a.label a_label, b.label b_label, a.department::text dept FROM public.batches a JOIN public.batches b
        ON a.department = b.department AND a.id < b.id AND a.start_date <= b.end_date AND b.start_date <= a.end_date) x

  UNION ALL
  SELECT 21, 'orphan_avatar_files', 'review', count(*), string_agg(o.name, ', ') FILTER (WHERE rn <= 10),
    'Photo files not belonging to any personnel record (old login-id uploads or deleted people). Delete them in Storage > avatars.'
  FROM (SELECT o.*, row_number() OVER (ORDER BY o.created_at) rn FROM storage.objects o
        WHERE o.bucket_id = 'avatars'
          AND NOT EXISTS (SELECT 1 FROM public.personnel p WHERE p.id::text = o.name)) o

  UNION ALL
  SELECT 22, 'signups_without_login', 'review', count(*), string_agg(s.name || ' (' || s.status || ')', ', '),
    'Sign-up requests whose login account no longer exists.'
  FROM public.signup_requests s WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.auth_id)

  UNION ALL
  SELECT 23, 'admin_in_cycle', 'review', count(*), string_agg(p.name, ', '),
    'Supervisors assigned to a cycle (they would appear in rosters and auto-absent lists).'
  FROM public.personnel p WHERE p.role IN ('admin', 'master') AND p.batch_id IS NOT NULL

  UNION ALL
  SELECT 24, 'inactive_supervisors', 'info', count(*), string_agg(p.name || ' (' || p.role || ')', ', '),
    'Supervisor accounts that are deactivated (they have no access).'
  FROM public.personnel p WHERE p.role IN ('admin', 'master') AND NOT p.is_active

  UNION ALL
  SELECT 25, 'audit_log_size', 'info', count(*),
    string_agg(DISTINCT category, ', '),
    'Audit entries in total. Categories auth/session are no longer written by the app.'
  FROM public.audit_log

  UNION ALL
  SELECT 26, 'leftover_backup_schemas', 'info', count(*), string_agg(nspname, ', '),
    'Backup schemas from the 20 Nov changes. Drop them once you are happy (they contain personal data).'
  FROM pg_namespace WHERE nspname LIKE 'backup_2026%'
)
SELECT check_name, severity, n AS count, coalesce(sample, '') AS examples, meaning
FROM report
ORDER BY CASE severity WHEN 'fix' THEN 0 WHEN 'review' THEN 1 ELSE 2 END, sort;
