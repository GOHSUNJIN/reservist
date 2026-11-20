-- ============================================================================
-- ReservistGO: read-only inspection of the live database (step 1 of 4)
-- ----------------------------------------------------------------------------
-- Changes nothing. It is a single SELECT so the Supabase SQL editor shows the
-- whole report as one table. Export it (Results > Download CSV) and send it
-- back before running the migration.
--
-- What it shows:
--   table        RLS on/forced for every public table
--   policy       every policy on public tables and storage.objects
--   trigger      user triggers on public tables
--   function     every public function: SECURITY DEFINER?, search_path, who can execute
--   role_check   for delete_auth_user / admin_reset_password: does the body check the caller?
--   function_def full source of the security-relevant functions
--   column       columns, types, defaults of the app tables
--   constraint   / index   keys and unique rules (signup_requests matters most)
--   enum         department_type values
--   grant        table privileges held by anon / authenticated
--   data         counts and duplicate checks the migration relies on
--   realtime     tables in the supabase_realtime publication
--   bucket       storage buckets
--   cron         pg_cron jobs (if pg_cron is installed)
--   migration    whether this migration (app_private / backup schema) already exists
-- ============================================================================
WITH app_tables(t) AS (
  VALUES ('personnel'),('batches'),('attendance'),('leave_requests'),
         ('signup_requests'),('no_report_days'),('audit_log')
),
fn AS (
  SELECT p.oid, p.proname, p.oid::regprocedure::text AS sig, p.prosecdef,
         coalesce(array_to_string(p.proconfig, ', '), '') AS cfg,
         pg_get_userbyid(p.proowner) AS owner,
         coalesce(p.proacl::text, '(default: PUBLIC can execute)') AS acl
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
),
report(section, sort_key, object, detail) AS (
  SELECT 'table', 1, c.relname::text,
         'rls=' || c.relrowsecurity || ' forced=' || c.relforcerowsecurity || ' owner=' || pg_get_userbyid(c.relowner)
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'

  UNION ALL
  SELECT 'policy', 2, p.schemaname || '.' || p.tablename || ' :: ' || p.policyname,
         'cmd=' || p.cmd || ' | ' || p.permissive || ' | roles=' || array_to_string(p.roles, ',')
         || ' | USING: ' || coalesce(p.qual, '-') || ' | CHECK: ' || coalesce(p.with_check, '-')
  FROM pg_policies p
  WHERE p.schemaname = 'public' OR (p.schemaname = 'storage' AND p.tablename = 'objects')

  UNION ALL
  SELECT 'trigger', 3, c.relname || ' :: ' || tg.tgname, pg_get_triggerdef(tg.oid)
  FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
  WHERE c.relnamespace = 'public'::regnamespace AND NOT tg.tgisinternal

  UNION ALL
  SELECT 'function', 4, fn.sig,
         'security_definer=' || fn.prosecdef || ' | config=' || CASE WHEN fn.cfg = '' THEN '(no search_path set)' ELSE fn.cfg END
         || ' | owner=' || fn.owner || ' | execute=' || fn.acl
  FROM fn

  UNION ALL
  SELECT 'role_check', 5, fn.sig,
         CASE WHEN pg_get_functiondef(fn.oid) ~* '(_auth_role|role\s*(=|in)|auth\.uid\(\)|raise\s+exception)'
              THEN 'body references caller role/identity - read function_def to confirm it blocks non-admins'
              ELSE 'NO CALLER CHECK FOUND - any logged-in user (and anon, if granted) can run this' END
  FROM fn WHERE fn.proname IN ('delete_auth_user', 'admin_reset_password')

  UNION ALL
  SELECT 'role_check', 5, name, 'MISSING - function not found (the app calls it)'
  FROM (VALUES ('delete_auth_user'), ('admin_reset_password'), ('log_phase_now'), ('log_phase_offline')) m(name)
  WHERE NOT EXISTS (SELECT 1 FROM fn WHERE fn.proname = m.name)

  UNION ALL
  SELECT 'function_def', 6, fn.sig, pg_get_functiondef(fn.oid)
  FROM fn
  WHERE fn.proname IN ('delete_auth_user','admin_reset_password','log_phase_now','log_phase_offline',
                       '_auth_role','_auth_dept','_auth_pid','_auth_batch_id','_sg_today')
     OR fn.proname ~* '(signup|approve|reset|delete|reject|personnel|attendance|leave|audit)'

  UNION ALL
  SELECT 'column', 7, c.table_name || '.' || c.column_name,
         c.data_type || CASE WHEN c.data_type = 'USER-DEFINED' THEN ' (' || c.udt_name || ')' ELSE '' END
         || ' | nullable=' || c.is_nullable || ' | default=' || coalesce(c.column_default, '-')
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name IN (SELECT t FROM app_tables)

  UNION ALL
  SELECT 'constraint', 8, rel.relname || ' :: ' || con.conname, pg_get_constraintdef(con.oid)
  FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relnamespace = 'public'::regnamespace AND rel.relname IN (SELECT t FROM app_tables)

  UNION ALL
  SELECT 'index', 9, i.tablename || ' :: ' || i.indexname, i.indexdef
  FROM pg_indexes i
  WHERE i.schemaname = 'public' AND i.tablename IN (SELECT t FROM app_tables)

  UNION ALL
  SELECT 'enum', 10, t.typname::text, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder)
  FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE t.typnamespace = 'public'::regnamespace
  GROUP BY t.typname

  UNION ALL
  SELECT 'grant', 11, g.table_name || ' -> ' || g.grantee, string_agg(g.privilege_type, ', ' ORDER BY g.privilege_type)
  FROM information_schema.role_table_grants g
  WHERE g.table_schema = 'public' AND g.grantee IN ('anon', 'authenticated')
  GROUP BY g.table_name, g.grantee

  UNION ALL
  SELECT 'data', 12, 'personnel by role/active',
         coalesce((SELECT string_agg(role || '/' || CASE WHEN is_active THEN 'active' ELSE 'inactive' END || '=' || n, ', ')
                   FROM (SELECT coalesce(role, 'null') AS role, is_active, count(*) n FROM public.personnel GROUP BY 1, 2) x), '-')
  UNION ALL
  SELECT 'data', 12, 'personnel rows sharing one auth_id (should be 0)',
         (SELECT count(*)::text FROM (SELECT auth_id FROM public.personnel WHERE auth_id IS NOT NULL GROUP BY auth_id HAVING count(*) > 1) d)
  UNION ALL
  SELECT 'data', 12, 'signup_requests by status',
         coalesce((SELECT string_agg(coalesce(status, 'null') || '=' || n, ', ') FROM (SELECT status, count(*) n FROM public.signup_requests GROUP BY 1) x), '-')
  UNION ALL
  SELECT 'data', 12, 'auth users with 2+ pending signups (should be 0)',
         (SELECT count(*)::text FROM (SELECT auth_id FROM public.signup_requests WHERE status = 'pending' GROUP BY auth_id HAVING count(*) > 1) d)
  UNION ALL
  SELECT 'data', 12, 'auth users with 2+ signup rows of any status',
         (SELECT count(*)::text FROM (SELECT auth_id FROM public.signup_requests GROUP BY auth_id HAVING count(*) > 1) d)
  UNION ALL
  SELECT 'data', 12, 'leave_requests by status',
         coalesce((SELECT string_agg(coalesce(status, 'null') || '=' || n, ', ') FROM (SELECT status, count(*) n FROM public.leave_requests GROUP BY 1) x), '-')
  UNION ALL
  SELECT 'data', 12, 'row counts',
         'personnel=' || (SELECT count(*) FROM public.personnel) || ' attendance=' || (SELECT count(*) FROM public.attendance)
         || ' leave=' || (SELECT count(*) FROM public.leave_requests) || ' signups=' || (SELECT count(*) FROM public.signup_requests)
         || ' batches=' || (SELECT count(*) FROM public.batches) || ' audit=' || (SELECT count(*) FROM public.audit_log)

  UNION ALL
  SELECT 'realtime', 13, pt.schemaname || '.' || pt.tablename, pt.pubname
  FROM pg_publication_tables pt WHERE pt.pubname = 'supabase_realtime'

  UNION ALL
  SELECT 'bucket', 14, b.id::text, 'public=' || b.public FROM storage.buckets b

  UNION ALL
  SELECT 'cron', 15, 'pg_cron jobs',
         CASE WHEN to_regclass('cron.job') IS NULL THEN 'pg_cron not installed'
              ELSE query_to_xml('select jobname, schedule, username, command from cron.job', true, false, '')::text END

  UNION ALL
  SELECT 'migration', 16, n.nspname::text, 'schema exists (this migration may already have been run)'
  FROM pg_namespace n WHERE n.nspname IN ('app_private', 'backup_20261120')
)
SELECT section, object, detail FROM report ORDER BY sort_key, object;
