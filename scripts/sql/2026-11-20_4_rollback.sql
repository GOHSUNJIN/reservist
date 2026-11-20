-- ============================================================================
-- ReservistGO: ROLLBACK of 2026-11-20_3_migration.sql (only if needed)
-- ----------------------------------------------------------------------------
-- Puts back the exact policies, functions, grants and constraints recorded
-- by 2026-11-20_2_backup.sql. Runs in one transaction.
--
-- Also redeploy the previous app version (the new app calls RPCs this removes).
--
-- Kept on purpose (harmless to the old app):
--   * the 4 new signup_requests columns and any rows created since the
--     migration (re-applications, moved requests). Drop lines are at the end,
--     commented out.
--   * table data is NOT restored (that would erase real work done since).
--     backup_20261120.* holds the pre-migration copies if you need a row.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '15s';

DO $$
BEGIN
  IF to_regclass('backup_20261120.policies') IS NULL OR to_regclass('backup_20261120.functions') IS NULL THEN
    RAISE EXCEPTION 'backup_20261120 is missing; cannot roll back automatically.';
  END IF;
  IF to_regnamespace('app_private') IS NULL THEN
    RAISE EXCEPTION 'app_private not found: the migration does not appear to be applied.';
  END IF;
END $$;

-- 1. Remove the new policies
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
DROP POLICY IF EXISTS "Enrolled users can list avatars" ON storage.objects;

-- 2. Remove the guard triggers
DROP TRIGGER IF EXISTS personnel_guard ON public.personnel;
DROP TRIGGER IF EXISTS leave_guard     ON public.leave_requests;
DROP TRIGGER IF EXISTS signup_guard    ON public.signup_requests;
DROP TRIGGER IF EXISTS audit_guard     ON public.audit_log;

-- 3. Remove the new RPCs
DROP FUNCTION IF EXISTS public.signup_open_batches(text);
DROP FUNCTION IF EXISTS public.reapply_signup(text, uuid, text);
DROP FUNCTION IF EXISTS public.move_signup_request(uuid, text);
DROP FUNCTION IF EXISTS public.approve_signup(uuid);
DROP FUNCTION IF EXISTS public.set_dinner_mode(uuid, date, boolean);
DROP FUNCTION IF EXISTS public.save_attendance_note(uuid, date, text, boolean);

-- 4. Put the original RPC bodies back under their own names
DO $$
DECLARE r record; w record;
BEGIN
  FOR r IN SELECT DISTINCT object AS name FROM backup_20261120.migration_log WHERE kind = 'wrapped' LOOP
    FOR w IN SELECT p.oid FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = r.name LOOP
      EXECUTE format('DROP FUNCTION %s', w.oid::regprocedure);
    END LOOP;
    FOR w IN SELECT p.oid FROM pg_proc p
             WHERE p.pronamespace = 'app_private'::regnamespace AND p.proname = '_orig_' || r.name LOOP
      EXECUTE format('ALTER FUNCTION %s SET SCHEMA public', w.oid::regprocedure);
      EXECUTE format('ALTER FUNCTION public.%I(%s) RENAME TO %I',
                     '_orig_' || r.name, pg_get_function_identity_arguments(w.oid), r.name);
    END LOOP;
  END LOOP;
END $$;

-- 5. Restore each function's original settings (search_path) and grants
DO $$
DECLARE f record; cur oid; cfg text; g record;
BEGIN
  FOR f IN SELECT * FROM backup_20261120.functions LOOP
    cur := to_regprocedure('public.' || quote_ident(f.name) || '(' || f.arg_types || ')');
    IF cur IS NULL THEN
      RAISE NOTICE 'Function % from the backup no longer exists; skipped.', f.signature;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER FUNCTION %s RESET ALL', cur::regprocedure);
    IF f.config IS NOT NULL THEN
      FOREACH cfg IN ARRAY f.config LOOP
        -- search_path is a list ("extensions, public, auth"): pass it unquoted,
        -- otherwise it would become one schema name. Other settings are quoted.
        IF split_part(cfg, '=', 1) = 'search_path' THEN
          EXECUTE format('ALTER FUNCTION %s SET search_path = %s', cur::regprocedure, substr(cfg, strpos(cfg, '=') + 1));
        ELSE
          EXECUTE format('ALTER FUNCTION %s SET %s = %s', cur::regprocedure,
                         split_part(cfg, '=', 1), quote_literal(substr(cfg, strpos(cfg, '=') + 1)));
        END IF;
      END LOOP;
    END IF;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', cur::regprocedure);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated, service_role', cur::regprocedure);
    IF f.acl IS NULL THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', cur::regprocedure);
    ELSE
      FOR g IN SELECT a.grantee FROM aclexplode(f.acl) a WHERE a.privilege_type = 'EXECUTE' LOOP
        IF g.grantee = 0 THEN
          EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', cur::regprocedure);
        ELSE
          EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I', cur::regprocedure, pg_get_userbyid(g.grantee));
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- 6. Recreate the original policies exactly as recorded
DO $$
DECLARE p record; roles text; sql text;
BEGIN
  FOR p IN SELECT * FROM backup_20261120.policies LOOP
    IF EXISTS (SELECT 1 FROM pg_policies x WHERE x.schemaname = p.schemaname
               AND x.tablename = p.tablename AND x.policyname = p.policyname) THEN
      CONTINUE;  -- untouched storage policies are still there
    END IF;
    SELECT string_agg(CASE WHEN r = 'public' THEN 'public' ELSE quote_ident(r) END, ', ')
      INTO roles FROM unnest(p.roles) r;
    sql := format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
                  p.policyname, p.schemaname, p.tablename, p.permissive, p.cmd, roles);
    IF p.qual IS NOT NULL THEN sql := sql || ' USING (' || p.qual || ')'; END IF;
    IF p.with_check IS NOT NULL THEN sql := sql || ' WITH CHECK (' || p.with_check || ')'; END IF;
    EXECUTE sql;
  END LOOP;
END $$;

-- 7. RLS flags as they were
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT * FROM backup_20261120.table_rls
           WHERE tablename IN ('personnel','batches','attendance','leave_requests','signup_requests','no_report_days','audit_log') LOOP
    EXECUTE format('ALTER TABLE public.%I %s ROW LEVEL SECURITY', t.tablename, CASE WHEN t.rls THEN 'ENABLE' ELSE 'DISABLE' END);
  END LOOP;
END $$;

-- 8. Indexes / constraints on signup_requests
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT object FROM backup_20261120.migration_log WHERE kind = 'created_index' LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', r.object);
  END LOOP;
  FOR r IN SELECT object, detail, kind FROM backup_20261120.migration_log WHERE kind IN ('dropped_constraint', 'dropped_index') LOOP
    BEGIN
      IF r.kind = 'dropped_constraint' THEN
        EXECUTE format('ALTER TABLE public.signup_requests ADD CONSTRAINT %I %s', r.object, r.detail);
      ELSE
        EXECUTE r.detail;
      END IF;
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'Could not restore % (people have re-applied since, so rows now repeat). Left off.', r.object;
    END;
  END LOOP;
END $$;

-- 9. Remove the private schema (helpers only remain at this point)
DROP SCHEMA app_private CASCADE;

INSERT INTO backup_20261120.migration_log (kind, object) VALUES ('rolled_back', '2026-11-20_3_migration');

-- Tell the Supabase API to pick up the changed functions (sent on commit)
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Optional, after the old app is redeployed and you are sure:
-- ALTER TABLE public.signup_requests
--   DROP COLUMN IF EXISTS superseded_at, DROP COLUMN IF EXISTS superseded_by,
--   DROP COLUMN IF EXISTS previous_request_id, DROP COLUMN IF EXISTS rejection_reason;
-- And once everything is confirmed good (it holds personal data):
-- DROP SCHEMA backup_20261120 CASCADE;
