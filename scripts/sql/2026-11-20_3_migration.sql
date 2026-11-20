-- ============================================================================
-- ReservistGO: security hardening + declined sign-up re-application (step 3 of 4)
-- ----------------------------------------------------------------------------
-- Run AFTER step 2 (backup). Runs in one transaction: if any check fails,
-- nothing is changed. Deploy the matching app code right after this runs.
--
-- Fixes
--   #1 log_phase_now only accepts the caller's own id and today's date
--   #2 accounts with no personnel row (unapproved/declined) can read only
--      their own sign-up requests and the open-intake list; nothing else
--   #3 reservists can only create pending leave and only cancel it
--   #4 reservists can no longer write attendance directly (RPCs only)
--   #5 admins: own department only; cannot touch admin/master rows or roles
--   #6 reservists can only change their own name / deactivate themselves
--   #7 audit_log actor, role, department and time are filled in by the server
--   +  delete_auth_user / admin_reset_password check the caller's role
--   +  every SECURITY DEFINER function has a fixed search_path
--   +  no-report days: reservists can no longer add/remove them
--   +  avatar bucket listing limited to enrolled users
-- New
--   signup_open_batches()   open intakes for the sign-up form (replaces public batch reads)
--   reapply_signup()        declined applicant applies again (3 per day)
--   move_signup_request()   admin moves a pending/declined request to another department
--   approve_signup()        approval runs server-side (handles cross-department returns)
--   set_dinner_mode(), save_attendance_note()   replace reservists' direct attendance writes
--   signup_requests: rejection_reason, previous_request_id, superseded_by, superseded_at
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '15s';

-- ---------------------------------------------------------------------------
-- 0. Preflight: stop before changing anything if the database isn't as expected
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  missing text;
  sig text;
BEGIN
  IF to_regnamespace('backup_20261120') IS NULL OR to_regclass('backup_20261120.policies') IS NULL THEN
    RAISE EXCEPTION 'Run 2026-11-20_2_backup.sql first (backup_20261120 not found).';
  END IF;
  IF to_regnamespace('app_private') IS NOT NULL THEN
    RAISE EXCEPTION 'app_private already exists: this migration has already been applied. Run the rollback first if you need to re-apply.';
  END IF;
  IF to_regtype('public.department_type') IS NULL THEN
    RAISE EXCEPTION 'Enum public.department_type not found.';
  END IF;

  SELECT string_agg(r.t || '.' || r.c, ', ') INTO missing
  FROM (VALUES
    ('personnel','id'),('personnel','auth_id'),('personnel','name'),('personnel','contact'),('personnel','batch_id'),
    ('personnel','role'),('personnel','is_active'),('personnel','department'),('personnel','created_at'),('personnel','deactivated_at'),
    ('batches','id'),('batches','label'),('batches','start_date'),('batches','end_date'),('batches','dekit_date'),('batches','is_live'),('batches','department'),
    ('attendance','id'),('attendance','personnel_id'),('attendance','date'),('attendance','status'),('attendance','check_in_time'),
    ('attendance','welfare_note'),('attendance','dinner_mode'),
    ('leave_requests','id'),('leave_requests','personnel_id'),('leave_requests','status'),
    ('signup_requests','id'),('signup_requests','auth_id'),('signup_requests','name'),('signup_requests','contact'),
    ('signup_requests','batch_id'),('signup_requests','status'),('signup_requests','department'),
    ('signup_requests','reviewed_by'),('signup_requests','reviewed_at'),('signup_requests','created_at'),
    ('no_report_days','date'),('no_report_days','department'),
    ('audit_log','actor_id'),('audit_log','actor_name'),('audit_log','actor_role'),('audit_log','department'),
    ('audit_log','category'),('audit_log','action'),('audit_log','target_id'),('audit_log','target_name'),
    ('audit_log','meta'),('audit_log','created_at')
  ) r(t, c)
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns ic
                    WHERE ic.table_schema = 'public' AND ic.table_name = r.t AND ic.column_name = r.c);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Columns not found: %. Send the inspection output before running this.', missing;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = 'public.attendance'::regclass AND i.indisunique
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
           FROM pg_attribute a WHERE a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey))
          = ARRAY['date','personnel_id']) THEN
    RAISE EXCEPTION 'attendance needs a unique key on (personnel_id, date).';
  END IF;

  -- The four RPCs we wrap must have the signatures the app calls
  FOR sig IN
    SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') -> ' || pg_get_function_result(p.oid)
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('log_phase_now','log_phase_offline','delete_auth_user','admin_reset_password')
  LOOP
    IF sig NOT IN (
      'log_phase_now(p_personnel_id uuid, p_date date, p_phase text, p_dist double precision, p_bypassed boolean) -> text',
      'log_phase_offline(p_phase text, p_date date, p_time text, p_dist double precision, p_bypassed boolean) -> text',
      'delete_auth_user(p_user_id uuid) -> void',
      'admin_reset_password(p_user_id uuid, p_new_password text) -> void'
    ) THEN
      RAISE EXCEPTION 'Unexpected function signature: %. Send the inspection output; the wrapper needs adjusting.', sig;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace
        AND proname IN ('log_phase_now','log_phase_offline','delete_auth_user','admin_reset_password'))
     <> (SELECT count(DISTINCT proname) FROM pg_proc WHERE pronamespace = 'public'::regnamespace
        AND proname IN ('log_phase_now','log_phase_offline','delete_auth_user','admin_reset_password')) THEN
    RAISE EXCEPTION 'More than one overload of a wrapped RPC exists. Send the inspection output.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Private schema for helpers (not exposed through the API)
-- ---------------------------------------------------------------------------
CREATE SCHEMA app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

DO $$
BEGIN
  IF to_regclass('public.personnel_auth_id_idx') IS NULL THEN
    CREATE INDEX personnel_auth_id_idx ON public.personnel (auth_id);
    INSERT INTO backup_20261120.migration_log (kind, object) VALUES ('created_index', 'personnel_auth_id_idx');
  END IF;
  IF to_regclass('public.signup_requests_auth_id_idx') IS NULL THEN
    CREATE INDEX signup_requests_auth_id_idx ON public.signup_requests (auth_id);
    INSERT INTO backup_20261120.migration_log (kind, object) VALUES ('created_index', 'signup_requests_auth_id_idx');
  END IF;
END $$;

-- Caller's own personnel row (prefers the active one if there are several)
CREATE FUNCTION app_private.me_pid() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id FROM public.personnel p
  WHERE p.auth_id = auth.uid() AND auth.uid() IS NOT NULL
  ORDER BY p.is_active DESC NULLS LAST, p.created_at DESC NULLS LAST LIMIT 1
$$;

-- Caller's role, only while their account is active
CREATE FUNCTION app_private.me_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN p.is_active THEN coalesce(p.role::text, 'reservist') END
  FROM public.personnel p
  WHERE p.auth_id = auth.uid() AND auth.uid() IS NOT NULL
  ORDER BY p.is_active DESC NULLS LAST, p.created_at DESC NULLS LAST LIMIT 1
$$;

CREATE FUNCTION app_private.me_dept() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.department::text FROM public.personnel p
  WHERE p.auth_id = auth.uid() AND auth.uid() IS NOT NULL
  ORDER BY p.is_active DESC NULLS LAST, p.created_at DESC NULLS LAST LIMIT 1
$$;

CREATE FUNCTION app_private.me_batch() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.batch_id FROM public.personnel p
  WHERE p.auth_id = auth.uid() AND auth.uid() IS NOT NULL
  ORDER BY p.is_active DESC NULLS LAST, p.created_at DESC NULLS LAST LIMIT 1
$$;

CREATE FUNCTION app_private.is_master() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(app_private.me_role() = 'master', false)
$$;

CREATE FUNCTION app_private.can_manage_dept(p_dept text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(app_private.me_role() = 'master'
                  OR (app_private.me_role() = 'admin' AND p_dept = app_private.me_dept()), false)
$$;

CREATE FUNCTION app_private.can_manage_person(p_personnel_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
    app_private.me_role() = 'master'
    OR (app_private.me_role() = 'admin' AND EXISTS (
          SELECT 1 FROM public.personnel x
          WHERE x.id = p_personnel_id AND x.department::text = app_private.me_dept())),
    false)
$$;

CREATE FUNCTION app_private.sg_today() RETURNS date
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT (now() AT TIME ZONE 'Asia/Singapore')::date
$$;

-- Same rule as the sign-up form: the live intake, or the next one from its last day
CREATE FUNCTION app_private.signup_target_batch(p_dept text) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_today date := app_private.sg_today();
  v_live public.batches%ROWTYPE;
  v_next uuid;
BEGIN
  SELECT * INTO v_live FROM public.batches b
  WHERE b.department::text = p_dept AND b.is_live
  ORDER BY b.start_date LIMIT 1;
  IF NOT FOUND THEN
    SELECT * INTO v_live FROM public.batches b
    WHERE b.department::text = p_dept AND v_today BETWEEN b.start_date AND b.end_date
    ORDER BY b.start_date LIMIT 1;
  END IF;
  IF v_live.id IS NULL THEN RETURN NULL; END IF;
  IF v_live.end_date IS NOT NULL AND v_today >= v_live.end_date THEN
    SELECT b.id INTO v_next FROM public.batches b
    WHERE b.department::text = p_dept AND b.start_date > v_live.end_date
    ORDER BY b.start_date LIMIT 1;
    RETURN v_next;
  END IF;
  RETURN v_live.id;
END $$;

CREATE FUNCTION app_private.is_valid_dept(p_dept text) RETURNS boolean
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_enum e
                 WHERE e.enumtypid = 'public.department_type'::regtype AND e.enumlabel = p_dept)
$$;

-- Lookups used inside the guard triggers. The triggers run with the caller's
-- rights (so they can tell API users apart), so anything they must see beyond
-- the caller's own rows is read through these.
CREATE FUNCTION app_private.batch_dept(p_batch_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT b.department::text FROM public.batches b WHERE b.id = p_batch_id
$$;

CREATE FUNCTION app_private.has_pending_signup(p_auth_id uuid, p_except uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.signup_requests s
                 WHERE s.auth_id = p_auth_id AND s.status::text = 'pending'
                   AND (p_except IS NULL OR s.id <> p_except))
$$;

CREATE FUNCTION app_private.signups_today(p_auth_id uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT count(*)::int FROM public.signup_requests s
  WHERE s.auth_id = p_auth_id
    AND s.created_at >= (app_private.sg_today()::timestamp AT TIME ZONE 'Asia/Singapore')
$$;

CREATE FUNCTION app_private.me_identity(OUT id uuid, OUT name text, OUT role text, OUT department text, OUT is_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id, p.name, coalesce(p.role::text, 'reservist'), p.department::text, coalesce(p.is_active, false)
  FROM public.personnel p
  WHERE p.auth_id = auth.uid() AND auth.uid() IS NOT NULL
  ORDER BY p.is_active DESC NULLS LAST, p.created_at DESC NULLS LAST LIMIT 1
$$;

CREATE FUNCTION app_private.my_latest_signup(OUT name text, OUT department text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.name, s.department::text FROM public.signup_requests s
  WHERE s.auth_id = auth.uid() AND auth.uid() IS NOT NULL
  ORDER BY s.created_at DESC LIMIT 1
$$;

-- True when the statement comes from an API user (PostgREST runs as
-- anon/authenticated). SECURITY DEFINER functions run as their owner, and
-- cron/SQL editor as postgres, so they are not restricted by the guards.
CREATE FUNCTION app_private.is_api_caller() RETURNS boolean
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT current_user IN ('authenticated', 'anon')
$$;

-- ---------------------------------------------------------------------------
-- 2. signup_requests: keep declined requests as history
-- ---------------------------------------------------------------------------
ALTER TABLE public.signup_requests
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS previous_request_id uuid REFERENCES public.signup_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.signup_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz;

-- A single-column UNIQUE rule on auth_id or contact would block a second
-- request from the same person. Drop it (recorded for the rollback).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    WHERE con.conrelid = 'public.signup_requests'::regclass AND con.contype = 'u'
      AND array_length(con.conkey, 1) = 1
      AND (SELECT a.attname FROM pg_attribute a WHERE a.attrelid = con.conrelid AND a.attnum = con.conkey[1])
          IN ('auth_id', 'contact')
  LOOP
    EXECUTE format('ALTER TABLE public.signup_requests DROP CONSTRAINT %I', r.conname);
    INSERT INTO backup_20261120.migration_log (kind, object, detail) VALUES ('dropped_constraint', r.conname, r.def);
  END LOOP;
  FOR r IN
    SELECT ic.relname AS idx, pg_get_indexdef(i.indexrelid) AS def
    FROM pg_index i JOIN pg_class ic ON ic.oid = i.indexrelid
    WHERE i.indrelid = 'public.signup_requests'::regclass AND i.indisunique AND NOT i.indisprimary
      AND i.indnatts = 1 AND i.indpred IS NULL
      AND (SELECT a.attname FROM pg_attribute a WHERE a.attrelid = i.indrelid AND a.attnum = i.indkey[0])
          IN ('auth_id', 'contact')
      AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid)
  LOOP
    EXECUTE format('DROP INDEX public.%I', r.idx);
    INSERT INTO backup_20261120.migration_log (kind, object, detail) VALUES ('dropped_index', r.idx, r.def);
  END LOOP;
END $$;

-- One pending request per account (only if current data allows it)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.signup_requests WHERE status::text = 'pending' AND auth_id IS NOT NULL
                 GROUP BY auth_id HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX signup_requests_one_pending_per_user
      ON public.signup_requests (auth_id) WHERE status::text = 'pending';
    INSERT INTO backup_20261120.migration_log (kind, object) VALUES ('created_index', 'signup_requests_one_pending_per_user');
  ELSE
    RAISE NOTICE 'Some accounts have 2+ pending sign-ups; skipped the one-pending index (the trigger still enforces it for new rows).';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Replace every policy on the app tables
--    (drops ALL existing ones, including any not in the repo, because extra
--    permissive policies would silently re-open what this migration closes)
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN
      ('personnel','batches','attendance','leave_requests','signup_requests','no_report_days','audit_log')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

ALTER TABLE public.personnel       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.no_report_days  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log       ENABLE ROW LEVEL SECURITY;

-- personnel -------------------------------------------------------------------
-- Own row; master all; admin own department; active reservist sees batchmates.
CREATE POLICY personnel_select ON public.personnel FOR SELECT TO authenticated USING (
  auth_id = (SELECT auth.uid())
  OR (SELECT app_private.is_master())
  OR ((SELECT app_private.me_role()) = 'admin' AND department::text = (SELECT app_private.me_dept()))
  OR ((SELECT app_private.me_role()) = 'reservist'
      AND batch_id IS NOT NULL AND batch_id = (SELECT app_private.me_batch())
      AND coalesce(role::text, 'reservist') = 'reservist')
);
CREATE POLICY personnel_insert ON public.personnel FOR INSERT TO authenticated WITH CHECK (
  (SELECT app_private.is_master())
  OR ((SELECT app_private.me_role()) = 'admin' AND department::text = (SELECT app_private.me_dept())
      AND coalesce(role::text, 'reservist') = 'reservist')
);
-- Column-level limits (role, department, what reservists may change) are in
-- the personnel_guard trigger below.
CREATE POLICY personnel_update ON public.personnel FOR UPDATE TO authenticated
USING (
  (SELECT app_private.is_master())
  OR auth_id = (SELECT auth.uid())
  OR ((SELECT app_private.me_role()) = 'admin' AND department::text = (SELECT app_private.me_dept())
      AND coalesce(role::text, 'reservist') = 'reservist')
)
WITH CHECK (
  (SELECT app_private.is_master())
  OR auth_id = (SELECT auth.uid())
  OR ((SELECT app_private.me_role()) = 'admin' AND department::text = (SELECT app_private.me_dept())
      AND coalesce(role::text, 'reservist') = 'reservist')
);
CREATE POLICY personnel_delete ON public.personnel FOR DELETE TO authenticated USING (
  (SELECT app_private.is_master())
  OR ((SELECT app_private.me_role()) = 'admin' AND department::text = (SELECT app_private.me_dept())
      AND coalesce(role::text, 'reservist') = 'reservist')
);

-- batches ---------------------------------------------------------------------
-- Any enrolled account may read (cycle numbering spans departments);
-- applicants and anon use signup_open_batches() instead.
CREATE POLICY batches_select ON public.batches FOR SELECT TO authenticated
  USING ((SELECT app_private.me_pid()) IS NOT NULL);
CREATE POLICY batches_insert ON public.batches FOR INSERT TO authenticated
  WITH CHECK (app_private.can_manage_dept(department::text));
CREATE POLICY batches_update ON public.batches FOR UPDATE TO authenticated
  USING (app_private.can_manage_dept(department::text))
  WITH CHECK (app_private.can_manage_dept(department::text));
CREATE POLICY batches_delete ON public.batches FOR DELETE TO authenticated
  USING (app_private.can_manage_dept(department::text));

-- no_report_days --------------------------------------------------------------
CREATE POLICY nrd_select ON public.no_report_days FOR SELECT TO authenticated
  USING ((SELECT app_private.me_pid()) IS NOT NULL);
CREATE POLICY nrd_insert ON public.no_report_days FOR INSERT TO authenticated
  WITH CHECK (app_private.can_manage_dept(department::text));
CREATE POLICY nrd_update ON public.no_report_days FOR UPDATE TO authenticated
  USING (app_private.can_manage_dept(department::text))
  WITH CHECK (app_private.can_manage_dept(department::text));
CREATE POLICY nrd_delete ON public.no_report_days FOR DELETE TO authenticated
  USING (app_private.can_manage_dept(department::text));

-- attendance ------------------------------------------------------------------
-- Reservists read their own rows; all their writes go through
-- log_phase_now / log_phase_offline / set_dinner_mode / save_attendance_note.
CREATE POLICY attendance_select ON public.attendance FOR SELECT TO authenticated USING (
  personnel_id = (SELECT app_private.me_pid()) OR app_private.can_manage_person(personnel_id)
);
CREATE POLICY attendance_insert ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (app_private.can_manage_person(personnel_id));
CREATE POLICY attendance_update ON public.attendance FOR UPDATE TO authenticated
  USING (app_private.can_manage_person(personnel_id))
  WITH CHECK (app_private.can_manage_person(personnel_id));
CREATE POLICY attendance_delete ON public.attendance FOR DELETE TO authenticated
  USING (app_private.can_manage_person(personnel_id));

-- leave_requests --------------------------------------------------------------
CREATE POLICY leave_select ON public.leave_requests FOR SELECT TO authenticated USING (
  personnel_id = (SELECT app_private.me_pid()) OR app_private.can_manage_person(personnel_id)
);
CREATE POLICY leave_insert ON public.leave_requests FOR INSERT TO authenticated WITH CHECK (
  (personnel_id = (SELECT app_private.me_pid()) AND (SELECT app_private.me_role()) IS NOT NULL
   AND coalesce(status::text, 'pending') = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
  OR app_private.can_manage_person(personnel_id)
);
CREATE POLICY leave_update ON public.leave_requests FOR UPDATE TO authenticated
USING (
  (personnel_id = (SELECT app_private.me_pid()) AND status::text = 'pending')
  OR app_private.can_manage_person(personnel_id)
)
WITH CHECK (
  (personnel_id = (SELECT app_private.me_pid()) AND status::text IN ('pending', 'cancelled')
   AND reviewed_by IS NULL AND reviewed_at IS NULL)
  OR app_private.can_manage_person(personnel_id)
);
CREATE POLICY leave_delete ON public.leave_requests FOR DELETE TO authenticated
  USING (app_private.can_manage_person(personnel_id));

-- signup_requests -------------------------------------------------------------
-- Applicants see only their own requests (this is all an unapproved or
-- declined account can read). They can submit a pending request and
-- withdraw a pending one; re-applying after a decline is reapply_signup().
CREATE POLICY signup_select ON public.signup_requests FOR SELECT TO authenticated USING (
  auth_id = (SELECT auth.uid()) OR app_private.can_manage_dept(department::text)
);
CREATE POLICY signup_insert ON public.signup_requests FOR INSERT TO authenticated WITH CHECK (
  auth_id = (SELECT auth.uid())
  AND coalesce(status::text, 'pending') = 'pending'
  AND reviewed_by IS NULL AND reviewed_at IS NULL AND rejection_reason IS NULL
  AND previous_request_id IS NULL AND superseded_by IS NULL AND superseded_at IS NULL
);
CREATE POLICY signup_update ON public.signup_requests FOR UPDATE TO authenticated
  USING (app_private.can_manage_dept(department::text))
  WITH CHECK (app_private.can_manage_dept(department::text));
CREATE POLICY signup_delete ON public.signup_requests FOR DELETE TO authenticated USING (
  app_private.can_manage_dept(department::text)
  OR (auth_id = (SELECT auth.uid()) AND status::text = 'pending')
);

-- audit_log -------------------------------------------------------------------
-- Read: master everything, admin own department (the Monitor). Insert: any
-- logged-in user; the audit_guard trigger overwrites who/when/department.
-- No update or delete policy: entries are append-only.
CREATE POLICY audit_log_select ON public.audit_log FOR SELECT TO authenticated USING (
  (SELECT app_private.is_master())
  OR ((SELECT app_private.me_role()) = 'admin' AND department = (SELECT app_private.me_dept()))
);
CREATE POLICY audit_log_insert ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (category NOT IN ('auth', 'session'));

-- ---------------------------------------------------------------------------
-- 4. Guard triggers (column rules a policy can't express)
-- ---------------------------------------------------------------------------
CREATE FUNCTION app_private.personnel_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_role text;
  v_free text[] := ARRAY['name', 'is_active', 'deactivated_at', 'updated_at'];
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
    -- Reservist (or inactive account) editing their own row: name and self-deactivation only
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
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER personnel_guard BEFORE UPDATE ON public.personnel
  FOR EACH ROW EXECUTE FUNCTION app_private.personnel_guard();

CREATE FUNCTION app_private.leave_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT app_private.is_api_caller() THEN RETURN NEW; END IF;
  IF NEW.status::text IN ('approved', 'rejected')
     AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status)
     AND NEW.personnel_id = app_private.me_pid()
     AND NOT app_private.is_master() THEN
    RAISE EXCEPTION 'You cannot review your own leave request.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER leave_guard BEFORE INSERT OR UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION app_private.leave_guard();

CREATE FUNCTION app_private.signup_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  -- Applies to every writer, including the RPCs
  IF NEW.status::text = 'pending' THEN
    NEW.rejection_reason := NULL;
  END IF;
  IF NEW.batch_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.batch_id IS DISTINCT FROM OLD.batch_id OR NEW.department IS DISTINCT FROM OLD.department)
     AND app_private.batch_dept(NEW.batch_id) IS DISTINCT FROM NEW.department::text THEN
    RAISE EXCEPTION 'The intake does not belong to the selected department.' USING ERRCODE = '22023';
  END IF;

  IF NOT app_private.is_api_caller() THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF app_private.has_pending_signup(NEW.auth_id, NULL) THEN
      RAISE EXCEPTION 'A request for this account is already pending approval.'
        USING ERRCODE = '23505', HINT = 'already_pending';
    END IF;
    IF app_private.signups_today(NEW.auth_id) >= 4 THEN
      RAISE EXCEPTION 'Too many sign-up attempts today. Please try again tomorrow.'
        USING ERRCODE = '54000', HINT = 'rate_limited';
    END IF;
    NEW.created_at := now();
  ELSE
    IF NEW.status::text = 'pending' AND OLD.status::text IS DISTINCT FROM 'pending' THEN
      IF OLD.superseded_by IS NOT NULL THEN
        RAISE EXCEPTION 'This request was replaced by a newer application, so it cannot be re-opened.'
          USING ERRCODE = '22023', HINT = 'superseded';
      END IF;
      IF app_private.has_pending_signup(NEW.auth_id, NEW.id) THEN
        RAISE EXCEPTION 'This person already has a pending request.' USING ERRCODE = '23505', HINT = 'already_pending';
      END IF;
    END IF;
    IF NEW.auth_id IS DISTINCT FROM OLD.auth_id
       OR NEW.previous_request_id IS DISTINCT FROM OLD.previous_request_id
       OR NEW.superseded_by IS DISTINCT FROM OLD.superseded_by THEN
      RAISE EXCEPTION 'These fields are managed by the server.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER signup_guard BEFORE INSERT OR UPDATE ON public.signup_requests
  FOR EACH ROW EXECUTE FUNCTION app_private.signup_guard();

-- Server decides who wrote an audit entry and when.
CREATE FUNCTION app_private.audit_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_me record;
  v_req record;
BEGIN
  IF NOT app_private.is_api_caller() THEN RETURN NEW; END IF;
  NEW.created_at := now();
  SELECT * INTO v_me FROM app_private.me_identity();
  IF v_me.id IS NOT NULL THEN
    NEW.actor_id := v_me.id;
    NEW.actor_name := v_me.name;
    NEW.actor_role := v_me.role;
    -- Masters switch departments in the app, so their entry keeps the
    -- department they were viewing; everyone else is pinned to their own.
    IF NOT (v_me.is_active AND v_me.role = 'master' AND NEW.department IS NOT NULL) THEN
      NEW.department := v_me.department;
    END IF;
    IF NOT (v_me.is_active AND v_me.role IN ('admin', 'master')) THEN
      IF NEW.action !~ '^(checkin\.(p[1-4]|late_reason)|roster\.(welfare_note_saved|missed_note_saved)|leave\.(submitted|cancelled)|signup\.request_submitted|account\.[a-z_]+)$' THEN
        RAISE EXCEPTION 'Not allowed to record "%".', NEW.action USING ERRCODE = '42501';
      END IF;
    END IF;
  ELSE
    SELECT * INTO v_req FROM app_private.my_latest_signup();
    IF v_req.name IS NULL OR NEW.action <> 'signup.request_submitted' THEN
      RAISE EXCEPTION 'Not allowed to record "%".', NEW.action USING ERRCODE = '42501';
    END IF;
    NEW.actor_id := NULL;
    NEW.actor_name := v_req.name;
    NEW.actor_role := 'applicant';
    NEW.department := v_req.department;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER audit_guard BEFORE INSERT ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION app_private.audit_guard();

-- ---------------------------------------------------------------------------
-- 5. Wrap the existing RPCs: same name and arguments (no app change needed),
--    original body kept untouched in app_private and called after the check.
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('log_phase_now','log_phase_offline','delete_auth_user','admin_reset_password')
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc x, unnest(coalesce(x.proconfig, '{}')) c
                   WHERE x.oid = r.oid AND c LIKE 'search_path=%') THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_temp', r.oid::regprocedure);
    END IF;
    EXECUTE format('ALTER FUNCTION %s RENAME TO %I', r.oid::regprocedure, '_orig_' || r.proname);
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET SCHEMA app_private',
                   '_orig_' || r.proname, pg_get_function_identity_arguments(r.oid));
    EXECUTE format('REVOKE ALL ON FUNCTION app_private.%I(%s) FROM PUBLIC',
                   '_orig_' || r.proname, pg_get_function_identity_arguments(r.oid));
    INSERT INTO backup_20261120.migration_log (kind, object) VALUES ('wrapped', r.proname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regprocedure('app_private._orig_log_phase_now(uuid,date,text,double precision,boolean)') IS NOT NULL THEN
    EXECUTE $f$
    CREATE FUNCTION public.log_phase_now(
      p_personnel_id uuid, p_date date, p_phase text,
      p_dist double precision DEFAULT NULL, p_bypassed boolean DEFAULT false
    ) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $b$
    DECLARE v_pid uuid := app_private.me_pid();
    BEGIN
      IF v_pid IS NULL OR app_private.me_role() IS NULL THEN
        RAISE EXCEPTION 'Your account is not active.' USING ERRCODE = '42501';
      END IF;
      IF p_personnel_id IS DISTINCT FROM v_pid THEN
        RAISE EXCEPTION 'You can only check in for yourself.' USING ERRCODE = '42501';
      END IF;
      IF p_date IS DISTINCT FROM app_private.sg_today() THEN
        RAISE EXCEPTION 'Check-in date must be today (Singapore time).' USING ERRCODE = '22023';
      END IF;
      RETURN app_private._orig_log_phase_now(v_pid, p_date, p_phase, p_dist, p_bypassed);
    END $b$;
    $f$;
  END IF;

  IF to_regprocedure('app_private._orig_log_phase_offline(text,date,text,double precision,boolean)') IS NOT NULL THEN
    EXECUTE $f$
    CREATE FUNCTION public.log_phase_offline(
      p_phase text, p_date date, p_time text,
      p_dist double precision DEFAULT NULL, p_bypassed boolean DEFAULT false
    ) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $b$
    BEGIN
      IF app_private.me_pid() IS NULL THEN RETURN 'rejected:unauthenticated'; END IF;
      IF app_private.me_role() IS NULL THEN RETURN 'rejected:inactive'; END IF;
      RETURN app_private._orig_log_phase_offline(p_phase, p_date, p_time, p_dist, p_bypassed);
    END $b$;
    $f$;
  END IF;

  IF to_regprocedure('app_private._orig_delete_auth_user(uuid)') IS NOT NULL THEN
    EXECUTE $f$
    CREATE FUNCTION public.delete_auth_user(p_user_id uuid)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $b$
    DECLARE v_role text := app_private.me_role(); v_dept text := app_private.me_dept();
    BEGIN
      IF v_role IS NULL OR v_role NOT IN ('admin', 'master') THEN
        RAISE EXCEPTION 'Only supervisors can delete accounts.' USING ERRCODE = '42501';
      END IF;
      IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'You cannot delete your own account here.' USING ERRCODE = '42501';
      END IF;
      IF v_role = 'admin' THEN
        -- Linked to someone outside the admin's remit?
        IF EXISTS (SELECT 1 FROM public.personnel x WHERE x.auth_id = p_user_id
                   AND NOT (coalesce(x.role::text, 'reservist') = 'reservist' AND x.department::text = v_dept)) THEN
          RAISE EXCEPTION 'That account is outside your department.' USING ERRCODE = '42501';
        END IF;
        -- Not linked to anyone: only allowed if it is tied to this department
        -- (or to nothing at all, e.g. a half-created account)
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
      PERFORM app_private._orig_delete_auth_user(p_user_id);
    END $b$;
    $f$;
  END IF;

  IF to_regprocedure('app_private._orig_admin_reset_password(uuid,text)') IS NOT NULL THEN
    EXECUTE $f$
    CREATE FUNCTION public.admin_reset_password(p_user_id uuid, p_new_password text)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $b$
    DECLARE v_role text := app_private.me_role();
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
    END $b$;
    $f$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. New RPCs
-- ---------------------------------------------------------------------------

-- Open intakes for the sign-up / apply-again form (safe columns only).
CREATE FUNCTION public.signup_open_batches(p_department text DEFAULT NULL)
RETURNS TABLE (id uuid, label text, start_date date, end_date date, dekit_date date, is_live boolean, department text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT b.id, b.label, b.start_date, b.end_date, b.dekit_date, b.is_live, b.department::text
  FROM public.batches b
  WHERE (p_department IS NULL OR b.department::text = p_department)
    AND (b.is_live OR b.end_date >= app_private.sg_today())
  ORDER BY b.start_date
$$;

-- A declined (or never-linked) account applies again, to any department.
CREATE FUNCTION public.reapply_signup(p_department text, p_batch_id uuid DEFAULT NULL, p_name text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_person public.personnel%ROWTYPE;
  v_prev public.signup_requests%ROWTYPE;
  v_new public.signup_requests%ROWTYPE;
  v_batch uuid;
  v_name text;
  v_contact text;
  v_email text;
  v_meta jsonb;
  v_today_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Please log in again.' USING ERRCODE = '42501', HINT = 'not_logged_in';
  END IF;
  -- Serialise re-applications per account
  PERFORM pg_advisory_xact_lock(hashtext('reapply:' || v_uid::text));

  SELECT * INTO v_person FROM public.personnel p WHERE p.auth_id = v_uid
  ORDER BY p.is_active DESC NULLS LAST, p.created_at DESC NULLS LAST LIMIT 1;
  IF FOUND AND coalesce(v_person.is_active, false) THEN
    RAISE EXCEPTION 'You are already enrolled. Please log in.' USING ERRCODE = '22023', HINT = 'already_enrolled';
  END IF;

  IF p_department IS NULL OR NOT app_private.is_valid_dept(p_department) THEN
    RAISE EXCEPTION 'Please select a department.' USING ERRCODE = '22023', HINT = 'invalid_department';
  END IF;

  IF EXISTS (SELECT 1 FROM public.signup_requests s WHERE s.auth_id = v_uid AND s.status::text = 'pending') THEN
    RAISE EXCEPTION 'You already have a request waiting for approval.' USING ERRCODE = '23505', HINT = 'already_pending';
  END IF;

  SELECT * INTO v_prev FROM public.signup_requests s WHERE s.auth_id = v_uid
  ORDER BY s.created_at DESC LIMIT 1;

  SELECT count(*) INTO v_today_count FROM public.signup_requests s
  WHERE s.auth_id = v_uid AND s.previous_request_id IS NOT NULL
    AND s.created_at >= (app_private.sg_today()::timestamp AT TIME ZONE 'Asia/Singapore');
  IF v_today_count >= 3 THEN
    RAISE EXCEPTION 'You can apply again up to 3 times a day. Please try again tomorrow or contact your supervisor.'
      USING ERRCODE = '54000', HINT = 'rate_limited';
  END IF;

  IF p_batch_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.batches b WHERE b.id = p_batch_id
                   AND b.department::text = p_department
                   AND (b.is_live OR b.end_date >= app_private.sg_today())) THEN
      RAISE EXCEPTION 'That intake is not open. Please refresh and try again.' USING ERRCODE = '22023', HINT = 'invalid_batch';
    END IF;
    v_batch := p_batch_id;
  ELSE
    v_batch := app_private.signup_target_batch(p_department);
  END IF;
  IF v_batch IS NULL THEN
    RAISE EXCEPTION 'No intake is open for sign-up in that department right now.' USING ERRCODE = '22023', HINT = 'no_open_batch';
  END IF;

  SELECT u.email, u.raw_user_meta_data INTO v_email, v_meta FROM auth.users u WHERE u.id = v_uid;
  v_name := coalesce(nullif(btrim(p_name), ''), v_prev.name, v_person.name, v_meta ->> 'display_name');
  IF v_name IS NULL OR length(v_name) > 100 THEN
    RAISE EXCEPTION 'Please enter your full name (up to 100 characters).' USING ERRCODE = '22023', HINT = 'invalid_name';
  END IF;
  v_contact := coalesce(v_prev.contact, v_person.contact, split_part(v_email, '@', 1));

  INSERT INTO public.signup_requests (auth_id, name, contact, batch_id, status, department, previous_request_id)
  VALUES (v_uid, v_name, v_contact, v_batch, 'pending', p_department::public.department_type, v_prev.id)
  RETURNING * INTO v_new;

  IF v_prev.id IS NOT NULL AND v_prev.status::text = 'rejected' THEN
    UPDATE public.signup_requests SET superseded_by = v_new.id, superseded_at = now() WHERE id = v_prev.id;
  END IF;

  INSERT INTO public.audit_log (actor_id, actor_name, actor_role, department, category, action, target_id, target_name, meta)
  VALUES (v_person.id, v_name, CASE WHEN v_person.id IS NULL THEN 'applicant' ELSE coalesce(v_person.role::text, 'reservist') END,
          p_department, 'signup', 'signup.reapplied', v_new.id::text, v_name,
          jsonb_build_object('from_department', v_prev.department::text, 'to_department', p_department,
                             'previous_request_id', v_prev.id, 'previous_status', v_prev.status::text,
                             'batch_id', v_batch));

  RETURN to_jsonb(v_new);
END $$;

-- Admin (of the request's current department) or master moves a pending or
-- declined request to another department. Pending: moved in place.
-- Declined: kept as history, a new pending request is created.
CREATE FUNCTION public.move_signup_request(p_request_id uuid, p_department text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.signup_requests%ROWTYPE;
  v_new public.signup_requests%ROWTYPE;
  v_actor public.personnel%ROWTYPE;
  v_batch uuid;
BEGIN
  SELECT * INTO r FROM public.signup_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR NOT app_private.can_manage_dept(r.department::text) THEN
    RAISE EXCEPTION 'Request not found in your department.' USING ERRCODE = '42501', HINT = 'not_found';
  END IF;
  IF r.status::text NOT IN ('pending', 'rejected') THEN
    RAISE EXCEPTION 'Only pending or declined requests can be moved.' USING ERRCODE = '22023', HINT = 'bad_status';
  END IF;
  IF r.superseded_by IS NOT NULL THEN
    RAISE EXCEPTION 'This person has already applied again.' USING ERRCODE = '22023', HINT = 'superseded';
  END IF;
  IF p_department IS NULL OR NOT app_private.is_valid_dept(p_department) THEN
    RAISE EXCEPTION 'Unknown department.' USING ERRCODE = '22023', HINT = 'invalid_department';
  END IF;
  IF p_department = r.department::text THEN
    RAISE EXCEPTION 'The request is already in that department.' USING ERRCODE = '22023', HINT = 'same_department';
  END IF;
  v_batch := app_private.signup_target_batch(p_department);
  IF v_batch IS NULL THEN
    RAISE EXCEPTION 'No intake is open in that department right now.' USING ERRCODE = '22023', HINT = 'no_open_batch';
  END IF;

  IF r.status::text = 'pending' THEN
    UPDATE public.signup_requests
       SET department = p_department::public.department_type, batch_id = v_batch
     WHERE id = r.id RETURNING * INTO v_new;
  ELSE
    IF EXISTS (SELECT 1 FROM public.signup_requests s WHERE s.auth_id = r.auth_id AND s.status::text = 'pending') THEN
      RAISE EXCEPTION 'This person already has a pending request.' USING ERRCODE = '23505', HINT = 'already_pending';
    END IF;
    INSERT INTO public.signup_requests (auth_id, name, contact, batch_id, status, department, previous_request_id)
    VALUES (r.auth_id, r.name, r.contact, v_batch, 'pending', p_department::public.department_type, r.id)
    RETURNING * INTO v_new;
    UPDATE public.signup_requests SET superseded_by = v_new.id, superseded_at = now() WHERE id = r.id;
  END IF;

  SELECT * INTO v_actor FROM public.personnel WHERE id = app_private.me_pid();
  INSERT INTO public.audit_log (actor_id, actor_name, actor_role, department, category, action, target_id, target_name, meta)
  VALUES (v_actor.id, v_actor.name, v_actor.role::text, r.department::text, 'signup', 'signup.moved',
          v_new.id::text, r.name,
          jsonb_build_object('from_department', r.department::text, 'to_department', p_department,
                             'previous_status', r.status::text, 'request_id', r.id));
  RETURN to_jsonb(v_new);
END $$;

-- Approve a pending request: links or creates the personnel row server-side,
-- including returning reservists whose row is in another department.
CREATE FUNCTION public.approve_signup(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.signup_requests%ROWTYPE;
  e public.personnel%ROWTYPE;
  p public.personnel%ROWTYPE;
  v_reviewer text;
  v_existed boolean := false;
  v_was_inactive boolean := false;
BEGIN
  SELECT * INTO r FROM public.signup_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR NOT app_private.can_manage_dept(r.department::text) THEN
    RAISE EXCEPTION 'Request not found in your department.' USING ERRCODE = '42501', HINT = 'not_found';
  END IF;
  IF r.status::text <> 'pending' THEN
    RAISE EXCEPTION 'Already processed by another admin.' USING ERRCODE = '22023', HINT = 'already_processed';
  END IF;
  SELECT x.name INTO v_reviewer FROM public.personnel x WHERE x.id = app_private.me_pid();

  SELECT * INTO e FROM public.personnel x WHERE x.auth_id = r.auth_id
  ORDER BY x.is_active DESC NULLS LAST, x.created_at DESC NULLS LAST LIMIT 1;
  IF NOT FOUND AND r.contact IS NOT NULL THEN
    SELECT * INTO e FROM public.personnel x
    WHERE regexp_replace(coalesce(x.contact, ''), '[\s-]', '', 'g') = regexp_replace(r.contact, '[\s-]', '', 'g')
    ORDER BY (coalesce(x.is_active, false) AND x.department = r.department) DESC,
             (x.department = r.department) DESC, x.is_active DESC NULLS LAST, x.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF e.id IS NOT NULL THEN
    IF coalesce(e.role::text, 'reservist') IN ('admin', 'master') THEN
      RAISE EXCEPTION 'This contact belongs to a supervisor account and cannot be enrolled as a reservist. Please contact your system administrator.'
        USING ERRCODE = '22023', HINT = 'supervisor_contact';
    END IF;
    v_existed := true;
    v_was_inactive := NOT coalesce(e.is_active, false);
    IF NOT coalesce(e.is_active, false) OR e.department <> r.department THEN
      UPDATE public.personnel
         SET is_active = true, deactivated_at = NULL, batch_id = r.batch_id,
             auth_id = r.auth_id, department = r.department
       WHERE id = e.id RETURNING * INTO p;
    ELSE
      UPDATE public.personnel SET auth_id = r.auth_id WHERE id = e.id RETURNING * INTO p;
    END IF;
  ELSE
    INSERT INTO public.personnel (auth_id, name, contact, batch_id, role, is_active, department)
    VALUES (r.auth_id, r.name, r.contact, r.batch_id, 'reservist', true, r.department)
    RETURNING * INTO p;
  END IF;

  UPDATE public.signup_requests
     SET status = 'approved', reviewed_by = v_reviewer, reviewed_at = now()
   WHERE id = r.id;

  RETURN jsonb_build_object('personnel', to_jsonb(p), 'existed', v_existed, 'was_inactive', v_was_inactive);
END $$;

-- Dinner/lunch label for a check-in (reservist: own row today, after P1).
CREATE FUNCTION public.set_dinner_mode(p_personnel_id uuid, p_date date, p_is_dinner boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_personnel_id = app_private.me_pid() AND app_private.me_role() IS NOT NULL THEN
    IF p_date IS DISTINCT FROM app_private.sg_today() THEN
      RAISE EXCEPTION 'Only today''s record can be changed.' USING ERRCODE = '22023';
    END IF;
    UPDATE public.attendance SET dinner_mode = p_is_dinner
     WHERE personnel_id = p_personnel_id AND date = p_date AND check_in_time IS NOT NULL;
  ELSIF app_private.can_manage_person(p_personnel_id) THEN
    UPDATE public.attendance SET dinner_mode = p_is_dinner
     WHERE personnel_id = p_personnel_id AND date = p_date;
  ELSE
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
END $$;

-- Welfare note (today) or missed-day note (past day in the current cycle).
-- Reservists can only add a note; they cannot change a day's status.
CREATE FUNCTION public.save_attendance_note(p_personnel_id uuid, p_date date, p_note text, p_missed boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_start date;
BEGIN
  IF p_note IS NOT NULL AND length(p_note) > 1000 THEN
    RAISE EXCEPTION 'Note is too long (max 1000 characters).' USING ERRCODE = '22023';
  END IF;
  IF p_personnel_id = app_private.me_pid() AND app_private.me_role() IS NOT NULL THEN
    IF p_date > app_private.sg_today() THEN
      RAISE EXCEPTION 'Notes cannot be added for future days.' USING ERRCODE = '22023';
    END IF;
    IF p_date < app_private.sg_today() THEN
      SELECT b.start_date INTO v_start FROM public.batches b WHERE b.id = app_private.me_batch();
      IF v_start IS NULL OR p_date < v_start THEN
        RAISE EXCEPTION 'That day is outside your current cycle.' USING ERRCODE = '22023';
      END IF;
    END IF;
  ELSIF NOT app_private.can_manage_person(p_personnel_id) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.attendance (personnel_id, date, status, welfare_note)
  VALUES (p_personnel_id, p_date, CASE WHEN p_missed THEN 'missed' ELSE 'absent' END, p_note)
  ON CONFLICT (personnel_id, date) DO UPDATE SET welfare_note = EXCLUDED.welfare_note;
END $$;

-- ---------------------------------------------------------------------------
-- 7. search_path on the remaining SECURITY DEFINER functions, and grants
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f' AND p.prosecdef
      AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_temp', r.oid::regprocedure);
    INSERT INTO backup_20261120.migration_log (kind, object) VALUES ('search_path', r.oid::regprocedure::text);
  END LOOP;
END $$;

-- Private helpers: callable only by logged-in users (needed by RLS checks)
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  app_private.me_pid(), app_private.me_role(), app_private.me_dept(), app_private.me_batch(),
  app_private.is_master(), app_private.can_manage_dept(text), app_private.can_manage_person(uuid),
  app_private.sg_today(), app_private.is_api_caller(), app_private.is_valid_dept(text),
  app_private.signup_target_batch(text), app_private.batch_dept(uuid),
  app_private.has_pending_signup(uuid, uuid), app_private.signups_today(uuid),
  app_private.me_identity(), app_private.my_latest_signup()
TO authenticated, service_role;

-- Public RPCs: logged-in users only (sign-up intake list also for anon)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('log_phase_now','log_phase_offline','delete_auth_user','admin_reset_password',
                        'reapply_signup','move_signup_request','approve_signup','set_dinner_mode',
                        'save_attendance_note','signup_open_batches',
                        '_auth_role','_auth_dept','_auth_pid','_auth_batch_id','_sg_today')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.oid::regprocedure);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.oid::regprocedure);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.oid::regprocedure);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.signup_open_batches(text) TO anon;

-- ---------------------------------------------------------------------------
-- 8. Storage: only enrolled users can list the avatar bucket
--    (files stay viewable by public URL as before)
-- ---------------------------------------------------------------------------
-- All four avatar read policies on the live project (each lets any logged-in
-- account, approved or not, list the bucket):
DROP POLICY IF EXISTS "Users can view all avatars" ON storage.objects;
DROP POLICY IF EXISTS "read all avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view all avatars" ON storage.objects;
-- Older write policies keyed on the login id. The app names avatar files by
-- personnel id ("Users can upload own avatar" / "Users can update own avatar",
-- kept), so these only let unapproved accounts put files in the public bucket.
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "upload own avatar" ON storage.objects;
CREATE POLICY "Enrolled users can list avatars" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (SELECT app_private.me_pid()) IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 9. Postflight checks
-- ---------------------------------------------------------------------------
DO $$
DECLARE extra text;
BEGIN
  SELECT string_agg(tablename || '.' || policyname, ', ') INTO extra
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('personnel','batches','attendance','leave_requests','signup_requests','no_report_days','audit_log')
    AND policyname NOT IN ('personnel_select','personnel_insert','personnel_update','personnel_delete',
      'batches_select','batches_insert','batches_update','batches_delete',
      'nrd_select','nrd_insert','nrd_update','nrd_delete',
      'attendance_select','attendance_insert','attendance_update','attendance_delete',
      'leave_select','leave_insert','leave_update','leave_delete',
      'signup_select','signup_insert','signup_update','signup_delete',
      'audit_log_select','audit_log_insert');
  IF extra IS NOT NULL THEN RAISE EXCEPTION 'Unexpected policies remain: %', extra; END IF;

  IF EXISTS (SELECT 1 FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace
             AND c.relname IN ('personnel','batches','attendance','leave_requests','signup_requests','no_report_days','audit_log')
             AND NOT c.relrowsecurity) THEN
    RAISE EXCEPTION 'RLS is not enabled on every app table.';
  END IF;

  SELECT string_agg(policyname, ', ') INTO extra FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects' AND cmd IN ('SELECT', 'ALL')
    AND policyname <> 'Enrolled users can list avatars' AND coalesce(qual, '') ILIKE '%avatars%';
  IF extra IS NOT NULL THEN
    RAISE EXCEPTION 'Other storage policies still allow reading the avatars bucket: %. Nothing was changed; send this message.', extra;
  END IF;
END $$;

INSERT INTO backup_20261120.migration_log (kind, object) VALUES ('applied', '2026-11-20_3_migration');

-- Tell the Supabase API to pick up the changed functions (sent on commit)
NOTIFY pgrst, 'reload schema';

COMMIT;
