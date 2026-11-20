-- ============================================================================
-- ReservistGO: backup before the security migration (step 2 of 4)
-- ----------------------------------------------------------------------------
-- Copies the affected tables and records the current policies, functions,
-- grants, triggers and constraints into schema backup_20261120.
-- The rollback script restores the old rules from these records.
--
-- Safe to run: it only reads public.* and writes into backup_20261120.
-- It refuses to run twice (so a second run can't overwrite a good backup).
--
-- Also recommended: Supabase Dashboard > Database > Backups, and confirm a
-- recent daily backup exists (or download one) before step 3.
-- ============================================================================
BEGIN;

DO $$
BEGIN
  IF to_regnamespace('backup_20261120') IS NOT NULL THEN
    RAISE EXCEPTION 'backup_20261120 already exists. Not overwriting it. If you really want a fresh backup, rename or drop that schema first.';
  END IF;
END $$;

CREATE SCHEMA backup_20261120;
-- Keep the backup away from the API roles (it contains personal data).
REVOKE ALL ON SCHEMA backup_20261120 FROM PUBLIC;
DO $$ BEGIN
  EXECUTE 'REVOKE ALL ON SCHEMA backup_20261120 FROM anon, authenticated';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- 1. Table data
CREATE TABLE backup_20261120.personnel       AS TABLE public.personnel;
CREATE TABLE backup_20261120.batches         AS TABLE public.batches;
CREATE TABLE backup_20261120.attendance      AS TABLE public.attendance;
CREATE TABLE backup_20261120.leave_requests  AS TABLE public.leave_requests;
CREATE TABLE backup_20261120.signup_requests AS TABLE public.signup_requests;
CREATE TABLE backup_20261120.no_report_days  AS TABLE public.no_report_days;
CREATE TABLE backup_20261120.audit_log       AS TABLE public.audit_log;

-- 2. Policies on the app tables and storage.objects (exact definitions)
CREATE TABLE backup_20261120.policies AS
SELECT p.schemaname, p.tablename, p.policyname, p.permissive, p.roles, p.cmd, p.qual, p.with_check
FROM pg_policies p
WHERE (p.schemaname = 'public' AND p.tablename IN
        ('personnel','batches','attendance','leave_requests','signup_requests','no_report_days','audit_log'))
   OR (p.schemaname = 'storage' AND p.tablename = 'objects');

-- 3. RLS flags
CREATE TABLE backup_20261120.table_rls AS
SELECT c.relname AS tablename, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r';

-- 4. Every public function: source, SECURITY DEFINER flag, config, grants
CREATE TABLE backup_20261120.functions AS
SELECT p.proname::text AS name,
       p.oid::regprocedure::text AS signature,
       pg_get_function_identity_arguments(p.oid) AS identity_args,
       oidvectortypes(p.proargtypes) AS arg_types,
       pg_get_function_result(p.oid) AS result_type,
       p.prosecdef AS security_definer,
       p.proconfig AS config,
       p.proacl AS acl,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f';

-- 5. Triggers on public tables
CREATE TABLE backup_20261120.triggers AS
SELECT c.relname AS tablename, t.tgname AS trigger_name, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal;

-- 6. Constraints and indexes on signup_requests (the migration may relax a
--    one-row-per-user rule so declined requests can stay as history)
CREATE TABLE backup_20261120.signup_constraints AS
SELECT con.conname AS name, 'constraint' AS kind, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
WHERE con.conrelid = 'public.signup_requests'::regclass
UNION ALL
SELECT i.indexname, 'index', i.indexdef
FROM pg_indexes i
WHERE i.schemaname = 'public' AND i.tablename = 'signup_requests';

-- 7. Log the migration writes into (what it changed, for the rollback)
CREATE TABLE backup_20261120.migration_log (
  id serial PRIMARY KEY, kind text NOT NULL, object text NOT NULL, detail text,
  logged_at timestamptz DEFAULT now()
);

CREATE TABLE backup_20261120.meta AS
SELECT now() AS taken_at, current_user AS taken_by,
       (SELECT count(*) FROM backup_20261120.policies) AS policies,
       (SELECT count(*) FROM backup_20261120.functions) AS functions,
       (SELECT count(*) FROM backup_20261120.personnel) AS personnel_rows,
       (SELECT count(*) FROM backup_20261120.attendance) AS attendance_rows;

REVOKE ALL ON ALL TABLES IN SCHEMA backup_20261120 FROM PUBLIC;
DO $$ BEGIN
  EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA backup_20261120 FROM anon, authenticated';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

COMMIT;

-- Shows what was saved:
SELECT * FROM backup_20261120.meta;
