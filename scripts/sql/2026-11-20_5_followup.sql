-- ============================================================================
-- ReservistGO: follow-up fixes and clean-up (run after 2026-11-20_3_migration.sql)
-- ----------------------------------------------------------------------------
-- One transaction. Takes its own snapshot into backup_20261120_f first, so
-- 2026-11-20_6_followup_rollback.sql can undo exactly this file.
--
-- Errors fixed
--   E1 personnel live updates (deactivation logout / admin toast) now fire
--   E2 removing a profile photo deletes the file (own photo; admins for
--      reservists in their department)
--   E3 nightly auto-absent: per department, its own report days (L&F incl.
--      Saturday), its own no-report days, public holidays, only inside the
--      person's cycle, skips days with pending/approved leave
--   E4 nightly deactivation uses the Singapore date
--   E5 10-pending-leave limit enforced by the database
-- Loopholes closed
--   L1 offline check-ins record when they actually reached the server
--      (shown to admins as "Offline" on the log)
--   L2 accounts created or reset by a supervisor must set a new password
--      at next login
--   L4 every direct data change (attendance, leave, personnel) and every
--      password reset / account deletion is written to the audit log
--      (category "data"), and admins can no longer relink a reservist's
--      record to a different login
-- Clean-up
--   duplicate indexes/constraints, unused helper functions, unused empty
--   columns
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '15s';

-- ---------------------------------------------------------------------------
-- 0. Preflight + snapshot
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regnamespace('app_private') IS NULL THEN
    RAISE EXCEPTION 'Run 2026-11-20_3_migration.sql first.';
  END IF;
  IF to_regnamespace('backup_20261120_f') IS NOT NULL OR to_regprocedure('app_private.auto_mark_absent(date)') IS NOT NULL THEN
    RAISE EXCEPTION 'This follow-up has already been applied (backup_20261120_f exists). Run its rollback first to re-apply.';
  END IF;
END $$;

CREATE SCHEMA backup_20261120_f;
REVOKE ALL ON SCHEMA backup_20261120_f FROM PUBLIC;
DO $$ BEGIN EXECUTE 'REVOKE ALL ON SCHEMA backup_20261120_f FROM anon, authenticated';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE TABLE backup_20261120_f.log (
  id serial PRIMARY KEY, kind text NOT NULL, object text NOT NULL, detail text, logged_at timestamptz DEFAULT now()
);
-- functions this file replaces or drops: exact source + grants
CREATE TABLE backup_20261120_f.functions AS
SELECT n.nspname AS schema, p.proname::text AS name, oidvectortypes(p.proargtypes) AS arg_types,
       pg_get_functiondef(p.oid) AS definition, p.proacl AS acl
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE (n.nspname = 'public' AND p.proname IN ('log_phase_offline','admin_reset_password','delete_auth_user',
                                              '_auth_role','_auth_dept','_auth_batch_id','_sg_today'))
   OR (n.nspname = 'app_private' AND p.proname IN ('personnel_guard'));
CREATE TABLE backup_20261120_f.storage_policies AS
SELECT policyname, permissive, roles, cmd, qual, with_check FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';
DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE 'CREATE TABLE backup_20261120_f.cron_jobs AS SELECT jobname, schedule, command FROM cron.job';
  END IF;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA backup_20261120_f FROM PUBLIC;
DO $$ BEGIN EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA backup_20261120_f FROM anon, authenticated';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- E1. Live updates for personnel (RLS decides who receives which rows)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'personnel') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.personnel;
    INSERT INTO backup_20261120_f.log (kind, object) VALUES ('publication_added', 'personnel');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- E2. Deleting avatar files
-- ---------------------------------------------------------------------------
CREATE FUNCTION app_private.can_delete_avatar(p_name text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF p_name IS NULL OR p_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  v_id := p_name::uuid;
  RETURN v_id = app_private.me_pid() OR app_private.can_manage_person(v_id);
END $$;

CREATE POLICY "Delete own avatar or as supervisor" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND app_private.can_delete_avatar(name));

-- ---------------------------------------------------------------------------
-- E3/E4. Nightly jobs as tested functions
-- ---------------------------------------------------------------------------
CREATE TABLE app_private.public_holidays (
  date date PRIMARY KEY,
  name text NOT NULL
);
-- MOM gazetted holidays incl. the Monday after a Sunday holiday.
-- Add next year's dates when MOM publishes them (usually June).
INSERT INTO app_private.public_holidays (date, name) VALUES
  ('2025-01-01','New Year''s Day'),('2025-01-29','Chinese New Year'),('2025-01-30','Chinese New Year'),
  ('2025-03-31','Hari Raya Puasa'),('2025-04-18','Good Friday'),('2025-05-01','Labour Day'),
  ('2025-05-03','Polling Day'),('2025-05-12','Vesak Day'),('2025-06-07','Hari Raya Haji'),
  ('2025-08-09','National Day'),('2025-10-20','Deepavali'),('2025-12-25','Christmas Day'),
  ('2026-01-01','New Year''s Day'),('2026-02-17','Chinese New Year'),('2026-02-18','Chinese New Year'),
  ('2026-03-21','Hari Raya Puasa'),('2026-04-03','Good Friday'),('2026-05-01','Labour Day'),
  ('2026-05-27','Hari Raya Haji'),('2026-05-31','Vesak Day'),('2026-06-01','Vesak Day (observed)'),
  ('2026-08-09','National Day'),('2026-08-10','National Day (observed)'),
  ('2026-11-08','Deepavali'),('2026-11-09','Deepavali (observed)'),('2026-12-25','Christmas Day'),
  ('2027-01-01','New Year''s Day'),('2027-02-06','Chinese New Year'),('2027-02-07','Chinese New Year'),
  ('2027-02-08','Chinese New Year (observed)'),('2027-03-10','Hari Raya Puasa'),('2027-03-26','Good Friday'),
  ('2027-05-01','Labour Day'),('2027-05-17','Hari Raya Haji'),('2027-05-20','Vesak Day'),
  ('2027-08-09','National Day'),('2027-10-28','Deepavali'),('2027-12-25','Christmas Day');
REVOKE ALL ON app_private.public_holidays FROM PUBLIC;

-- Same rule as Utils.isReportDay: L&F Mon-Sat, others Mon-Fri
CREATE FUNCTION app_private.is_report_day(p_dept text, p_day date) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_dept = 'lnf' THEN EXTRACT(ISODOW FROM p_day) BETWEEN 1 AND 6
              ELSE EXTRACT(ISODOW FROM p_day) BETWEEN 1 AND 5 END
$$;

-- Marks absent every active reservist who had nothing recorded on a report
-- day inside their cycle. Returns the number of rows written.
CREATE FUNCTION app_private.auto_mark_absent(p_day date DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_day date := coalesce(p_day, app_private.sg_today() - 1); v_n integer;
BEGIN
  IF EXISTS (SELECT 1 FROM app_private.public_holidays h WHERE h.date = v_day) THEN RETURN 0; END IF;
  INSERT INTO public.attendance (personnel_id, date, status)
  SELECT p.id, v_day, 'absent'
  FROM public.personnel p
  JOIN public.batches b ON b.id = p.batch_id
  WHERE p.is_active AND p.role = 'reservist'
    AND v_day BETWEEN b.start_date AND b.end_date
    AND app_private.is_report_day(p.department::text, v_day)
    AND NOT EXISTS (SELECT 1 FROM public.no_report_days n WHERE n.date = v_day AND n.department = p.department)
    AND NOT EXISTS (SELECT 1 FROM public.leave_requests l
                    WHERE l.personnel_id = p.id AND l.date = v_day AND l.status IN ('pending', 'approved'))
    AND NOT EXISTS (SELECT 1 FROM public.attendance a WHERE a.personnel_id = p.id AND a.date = v_day)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

-- Deactivates reservists whose cycle's dekit date (Singapore date) has passed
CREATE FUNCTION app_private.deactivate_expired() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_today date := app_private.sg_today(); v_n integer;
BEGIN
  UPDATE public.personnel p SET is_active = false, deactivated_at = now()
  WHERE p.is_active AND p.role = 'reservist'
    AND p.batch_id IN (SELECT b.id FROM public.batches b WHERE b.dekit_date < v_today);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  UPDATE public.leave_requests l SET status = 'cancelled'
  WHERE l.status = 'pending'
    AND EXISTS (SELECT 1 FROM public.personnel p JOIN public.batches b ON b.id = p.batch_id
                WHERE p.id = l.personnel_id AND NOT p.is_active AND b.dekit_date < v_today);
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION app_private.auto_mark_absent(date), app_private.deactivate_expired() FROM PUBLIC;

-- Point the two pg_cron jobs at the functions (same names and times)
DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.schedule('auto-mark-absent', '5 16 * * *', 'SELECT app_private.auto_mark_absent();');
    PERFORM cron.schedule('deactivate-expired-personnel', '0 18 * * *', 'SELECT app_private.deactivate_expired();');
    INSERT INTO backup_20261120_f.log (kind, object) VALUES ('cron_updated', 'auto-mark-absent, deactivate-expired-personnel');
  ELSE
    RAISE NOTICE 'pg_cron not installed: nightly jobs not scheduled.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- New columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.attendance ADD COLUMN offline_log jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.personnel  ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;

-- Accounts that a supervisor created (they set or know the password) change
-- it at their next login. Self sign-ups chose their own password.
UPDATE public.personnel SET must_change_password = true
WHERE is_active AND role = 'reservist' AND created_by IS NOT NULL AND auth_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- L4. Data-change trail (written to audit_log, category 'data')
-- ---------------------------------------------------------------------------
CREATE FUNCTION app_private.write_change(p_table text, p_op text, p_target text, p_person uuid,
                                         p_changes jsonb, p_row jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_me record; v_name text; v_dept text;
BEGIN
  SELECT * INTO v_me FROM app_private.me_identity();
  SELECT x.name, x.department::text INTO v_name, v_dept FROM public.personnel x WHERE x.id = p_person;
  INSERT INTO public.audit_log (actor_id, actor_name, actor_role, department, category, action, target_id, target_name, meta)
  VALUES (v_me.id, coalesce(v_me.name, (SELECT s.name FROM public.signup_requests s WHERE s.auth_id = auth.uid() ORDER BY s.created_at DESC LIMIT 1)),
          coalesce(v_me.role, 'applicant'),
          coalesce(v_dept, p_row ->> 'department', v_me.department),
          'data', 'data.' || p_table || '.' || p_op, p_target,
          coalesce(v_name, p_row ->> 'name'),
          jsonb_strip_nulls(jsonb_build_object('changes', p_changes, 'row', p_row)));
END $$;

-- Fires only for direct API writes; RPC paths (check-in, approval, re-apply)
-- are already server-controlled and logged.
CREATE FUNCTION app_private.track_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_old jsonb; v_new jsonb; v_changes jsonb; v_id text; v_person uuid;
BEGIN
  IF NOT app_private.is_api_caller() THEN RETURN NULL; END IF;
  IF TG_OP <> 'INSERT' THEN v_old := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN v_new := to_jsonb(NEW); END IF;
  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(n.key, jsonb_build_object('from', o.value, 'to', n.value)) INTO v_changes
    FROM jsonb_each(v_new) n JOIN jsonb_each(v_old) o ON o.key = n.key
    WHERE n.value IS DISTINCT FROM o.value;
    IF v_changes IS NULL THEN RETURN NULL; END IF;
  END IF;
  v_id := coalesce(v_new ->> 'id', v_old ->> 'id');
  v_person := CASE WHEN TG_TABLE_NAME = 'personnel' THEN v_id::uuid
                   ELSE coalesce(v_new ->> 'personnel_id', v_old ->> 'personnel_id')::uuid END;
  PERFORM app_private.write_change(TG_TABLE_NAME, lower(TG_OP), v_id, v_person, v_changes,
                                   CASE WHEN TG_OP = 'UPDATE' THEN NULL ELSE coalesce(v_new, v_old) END);
  RETURN NULL;
END $$;
CREATE TRIGGER track_change AFTER INSERT OR UPDATE OR DELETE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION app_private.track_change();
CREATE TRIGGER track_change AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION app_private.track_change();
CREATE TRIGGER track_change AFTER INSERT OR UPDATE OR DELETE ON public.personnel
  FOR EACH ROW EXECUTE FUNCTION app_private.track_change();

-- ---------------------------------------------------------------------------
-- L2/L4. personnel rules: forced password change, no relinking by admins
-- ---------------------------------------------------------------------------
-- Supervisor-created or supervisor-linked logins must change password
CREATE FUNCTION app_private.personnel_defaults() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT app_private.is_api_caller() THEN RETURN NEW; END IF;
  IF app_private.me_role() IN ('admin', 'master') THEN
    IF TG_OP = 'INSERT' AND NEW.auth_id IS NOT NULL AND NEW.auth_id IS DISTINCT FROM auth.uid() THEN
      NEW.must_change_password := true;
    ELSIF TG_OP = 'UPDATE' AND OLD.auth_id IS NULL AND NEW.auth_id IS NOT NULL AND NEW.auth_id IS DISTINCT FROM auth.uid() THEN
      NEW.must_change_password := true;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER personnel_defaults BEFORE INSERT OR UPDATE ON public.personnel
  FOR EACH ROW EXECUTE FUNCTION app_private.personnel_defaults();

CREATE OR REPLACE FUNCTION app_private.personnel_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_role text;
  v_free text[] := ARRAY['name', 'is_active', 'deactivated_at', 'updated_at', 'must_change_password'];
  v_changed text;
BEGIN
  IF NOT app_private.is_api_caller() THEN RETURN NEW; END IF;
  v_role := app_private.me_role();
  IF v_role = 'master' THEN RETURN NEW; END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Only a master account can change roles.' USING ERRCODE = '42501';
  END IF;
  IF NEW.department IS DISTINCT FROM OLD.department THEN
    RAISE EXCEPTION 'Department changes go through sign-up approval or a master account.' USING ERRCODE = '42501';
  END IF;

  IF OLD.auth_id = auth.uid() THEN
    IF v_role = 'admin' THEN
      IF NEW.auth_id IS DISTINCT FROM OLD.auth_id THEN
        RAISE EXCEPTION 'You cannot relink your own account.' USING ERRCODE = '42501';
      END IF;
      RETURN NEW;
    END IF;
    -- Reservist (or inactive account) on their own row: name, self-deactivation,
    -- and clearing the "must change password" flag after changing it
    SELECT string_agg(n.key, ', ') INTO v_changed
    FROM jsonb_each(to_jsonb(NEW)) n
    JOIN jsonb_each(to_jsonb(OLD)) o ON o.key = n.key
    WHERE n.value IS DISTINCT FROM o.value AND NOT (n.key = ANY (v_free));
    IF v_changed IS NOT NULL THEN
      RAISE EXCEPTION 'You can only change your name or deactivate your account (tried: %).', v_changed USING ERRCODE = '42501';
    END IF;
    IF coalesce(NEW.is_active, false) AND NOT coalesce(OLD.is_active, false) THEN
      RAISE EXCEPTION 'Ask your supervisor to re-activate your account.' USING ERRCODE = '42501';
    END IF;
    IF NEW.must_change_password AND NOT OLD.must_change_password THEN
      RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
    END IF;
  ELSE
    -- Admin on a reservist in their department: may link a login to a record
    -- that has none, but not swap the login of a linked record
    IF OLD.auth_id IS NOT NULL AND NEW.auth_id IS DISTINCT FROM OLD.auth_id THEN
      RAISE EXCEPTION 'Only a master account can relink a record to a different login.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- E5. 10 pending leave requests per reservist
-- ---------------------------------------------------------------------------
CREATE FUNCTION app_private.pending_leave_count(p_personnel_id uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT count(*)::int FROM public.leave_requests l WHERE l.personnel_id = p_personnel_id AND l.status = 'pending'
$$;
CREATE FUNCTION app_private.leave_cap() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT app_private.is_api_caller() OR app_private.me_role() IN ('admin', 'master') THEN RETURN NEW; END IF;
  IF coalesce(NEW.status, 'pending') = 'pending' AND app_private.pending_leave_count(NEW.personnel_id) >= 10 THEN
    RAISE EXCEPTION 'You have too many pending requests. Please wait for them to be reviewed.'
      USING ERRCODE = '54000', HINT = 'leave_cap';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER leave_cap BEFORE INSERT ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION app_private.leave_cap();

-- ---------------------------------------------------------------------------
-- L1/L4. RPC wrappers: record offline arrival; log password resets/deletions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_phase_offline(
  p_phase text, p_date date, p_time text,
  p_dist double precision DEFAULT NULL, p_bypassed boolean DEFAULT false
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_pid uuid := app_private.me_pid(); v_res text; v_applied boolean;
BEGIN
  IF v_pid IS NULL THEN RETURN 'rejected:unauthenticated'; END IF;
  IF app_private.me_role() IS NULL THEN RETURN 'rejected:inactive'; END IF;
  v_res := app_private._orig_log_phase_offline(p_phase, p_date, p_time, p_dist, p_bypassed);
  IF v_res = 'ok' THEN
    SELECT to_char(CASE p_phase WHEN 'p1' THEN a.check_in_time WHEN 'p2' THEN a.lunch_out_time
                                WHEN 'p3' THEN a.work_return_time ELSE a.work_end_time END, 'HH24:MI') = p_time
      INTO v_applied FROM public.attendance a WHERE a.personnel_id = v_pid AND a.date = p_date;
    IF coalesce(v_applied, false) THEN
      UPDATE public.attendance
         SET offline_log = coalesce(offline_log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
               'phase', p_phase, 'time', p_time, 'bypassed', p_bypassed,
               'received_at', to_char(now() AT TIME ZONE 'Asia/Singapore', 'YYYY-MM-DD"T"HH24:MI:SS')))
       WHERE personnel_id = v_pid AND date = p_date;
    END IF;
  END IF;
  RETURN v_res;
END $$;

CREATE OR REPLACE FUNCTION public.admin_reset_password(p_user_id uuid, p_new_password text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role text := app_private.me_role(); v_person uuid;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin', 'master') THEN
    RAISE EXCEPTION 'Only supervisors can reset passwords.' USING ERRCODE = '42501';
  END IF;
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters.' USING ERRCODE = '22023';
  END IF;
  IF v_role = 'admin' AND NOT EXISTS (
       SELECT 1 FROM public.personnel x WHERE x.auth_id = p_user_id
       AND coalesce(x.role::text, 'reservist') = 'reservist'
       AND x.department::text = app_private.me_dept()) THEN
    RAISE EXCEPTION 'You can only reset passwords for reservists in your department.' USING ERRCODE = '42501';
  END IF;
  PERFORM app_private._orig_admin_reset_password(p_user_id, p_new_password);
  UPDATE public.personnel SET must_change_password = true WHERE auth_id = p_user_id RETURNING id INTO v_person;
  PERFORM app_private.write_change('auth', 'password_reset', p_user_id::text, v_person, NULL, NULL);
END $$;

CREATE OR REPLACE FUNCTION public.delete_auth_user(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role text := app_private.me_role(); v_dept text := app_private.me_dept(); v_name text;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin', 'master') THEN
    RAISE EXCEPTION 'Only supervisors can delete accounts.' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account here.' USING ERRCODE = '42501';
  END IF;
  IF v_role = 'admin' THEN
    IF EXISTS (SELECT 1 FROM public.personnel x WHERE x.auth_id = p_user_id
               AND NOT (coalesce(x.role::text, 'reservist') = 'reservist' AND x.department::text = v_dept)) THEN
      RAISE EXCEPTION 'That account is outside your department.' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.personnel x WHERE x.auth_id = p_user_id) THEN
      IF EXISTS (SELECT 1 FROM public.signup_requests s WHERE s.auth_id = p_user_id
                 AND s.status::text = 'pending' AND s.department::text <> v_dept)
         OR (EXISTS (SELECT 1 FROM public.signup_requests s WHERE s.auth_id = p_user_id)
             AND NOT EXISTS (SELECT 1 FROM public.signup_requests s WHERE s.auth_id = p_user_id
                             AND s.department::text = v_dept)) THEN
        RAISE EXCEPTION 'That account belongs to another department.' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  SELECT coalesce((SELECT x.name FROM public.personnel x WHERE x.auth_id = p_user_id LIMIT 1),
                  (SELECT s.name FROM public.signup_requests s WHERE s.auth_id = p_user_id ORDER BY s.created_at DESC LIMIT 1))
    INTO v_name;
  PERFORM app_private._orig_delete_auth_user(p_user_id);
  PERFORM app_private.write_change('auth', 'account_deleted', p_user_id::text, NULL, NULL,
                                   jsonb_build_object('name', v_name, 'department', v_dept));
END $$;

-- ---------------------------------------------------------------------------
-- Grants for the new helpers
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION app_private.can_delete_avatar(text), app_private.write_change(text, text, text, uuid, jsonb, jsonb),
  app_private.track_change(), app_private.personnel_defaults(), app_private.pending_leave_count(uuid),
  app_private.leave_cap(), app_private.is_report_day(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.can_delete_avatar(text), app_private.write_change(text, text, text, uuid, jsonb, jsonb),
  app_private.pending_leave_count(uuid), app_private.is_report_day(text, date)
TO authenticated, service_role;
-- (CREATE OR REPLACE keeps the existing grants on the replaced RPCs)

-- ---------------------------------------------------------------------------
-- Clean-up
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record; v_used boolean;
BEGIN
  -- Duplicate indexes (the first migration added two that already existed under other names)
  FOR r IN SELECT * FROM (VALUES
      ('personnel_auth_id_idx', 'idx_personnel_auth_id'),
      ('signup_requests_auth_id_idx', 'idx_signup_requests_auth_id'),
      ('idx_attendance_personnel_date', 'attendance_personnel_id_date_key'),
      ('leave_one_active_per_day', 'leave_requests_one_active_per_day')) d(drop_idx, keep_idx)
  LOOP
    IF to_regclass('public.' || r.drop_idx) IS NOT NULL AND to_regclass('public.' || r.keep_idx) IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = ('public.' || r.drop_idx)::regclass) THEN
      INSERT INTO backup_20261120_f.log (kind, object, detail)
      VALUES ('dropped_index', r.drop_idx, pg_get_indexdef(('public.' || r.drop_idx)::regclass));
      EXECUTE format('DROP INDEX public.%I', r.drop_idx);
    END IF;
  END LOOP;

  -- Two identical UNIQUE (personnel_id, date) constraints on attendance: keep one
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.attendance'::regclass AND conname = 'attendance_personnel_date_unique')
     AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.attendance'::regclass AND conname = 'attendance_personnel_id_date_key') THEN
    INSERT INTO backup_20261120_f.log (kind, object, detail) VALUES ('dropped_constraint', 'attendance_personnel_date_unique', 'UNIQUE (personnel_id, date)');
    ALTER TABLE public.attendance DROP CONSTRAINT attendance_personnel_date_unique;
  END IF;

  -- Columns the app never uses: dropped only if every row is empty
  FOR r IN SELECT c FROM unnest(ARRAY['late_reason', 'mc_filename', 'recorded_by']) c LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'attendance' AND column_name = r.c) THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.attendance WHERE %I IS NOT NULL)', r.c) INTO v_used;
      IF NOT v_used THEN
        INSERT INTO backup_20261120_f.log (kind, object, detail) VALUES ('dropped_column', r.c,
          (SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'attendance' AND column_name = r.c));
        EXECUTE format('ALTER TABLE public.attendance DROP COLUMN %I', r.c);
      ELSE
        RAISE NOTICE 'attendance.% has data; kept.', r.c;
      END IF;
    END IF;
  END LOOP;

  -- Old helper functions nothing uses any more (_auth_pid stays: the original
  -- offline check-in code calls it)
  FOR r IN SELECT p.oid, p.proname FROM pg_proc p
           WHERE p.pronamespace = 'public'::regnamespace
             AND p.proname IN ('_auth_role', '_auth_dept', '_auth_batch_id', '_sg_today') LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.refobjid = r.oid AND d.deptype = 'n') THEN
      INSERT INTO backup_20261120_f.log (kind, object) VALUES ('dropped_function', r.proname);
      EXECUTE format('DROP FUNCTION %s', r.oid::regprocedure);
    ELSE
      RAISE NOTICE '% is still referenced; kept.', r.proname;
    END IF;
  END LOOP;
END $$;

INSERT INTO backup_20261120_f.log (kind, object) VALUES ('applied', '2026-11-20_5_followup');
NOTIFY pgrst, 'reload schema';

COMMIT;
