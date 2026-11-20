-- ============================================================================
-- ReservistGO: ROLLBACK of 2026-11-20_5_followup.sql (only if needed)
-- ----------------------------------------------------------------------------
-- Restores what the follow-up changed, from backup_20261120_f. One transaction.
-- To undo everything from 20 Nov, run this first, then 2026-11-20_4_rollback.sql.
-- Data written since (offline arrival notes, "must change password" flags,
-- data-change audit entries) is removed with its columns / kept in audit_log.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '15s';

DO $$
BEGIN
  IF to_regclass('backup_20261120_f.log') IS NULL THEN
    RAISE EXCEPTION 'backup_20261120_f not found: the follow-up does not appear to be applied.';
  END IF;
END $$;

-- New triggers and the storage delete rule
DROP TRIGGER IF EXISTS track_change ON public.attendance;
DROP TRIGGER IF EXISTS track_change ON public.leave_requests;
DROP TRIGGER IF EXISTS track_change ON public.personnel;
DROP TRIGGER IF EXISTS personnel_defaults ON public.personnel;
DROP TRIGGER IF EXISTS leave_cap ON public.leave_requests;
DROP POLICY IF EXISTS "Delete own avatar or as supervisor" ON storage.objects;

-- Replaced or dropped functions: original source and grants
DO $$
DECLARE f record; cur oid; g record;
BEGIN
  FOR f IN SELECT * FROM backup_20261120_f.functions LOOP
    EXECUTE f.definition;   -- CREATE OR REPLACE ...
    cur := to_regprocedure(quote_ident(f.schema) || '.' || quote_ident(f.name) || '(' || f.arg_types || ')');
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', cur::regprocedure);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated, service_role', cur::regprocedure);
    IF f.acl IS NULL THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', cur::regprocedure);
    ELSE
      FOR g IN SELECT a.grantee FROM aclexplode(f.acl) a WHERE a.privilege_type = 'EXECUTE' LOOP
        IF g.grantee = 0 THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', cur::regprocedure);
        ELSE EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I', cur::regprocedure, pg_get_userbyid(g.grantee));
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- pg_cron jobs back to their previous commands
DO $$
DECLARE j record;
BEGIN
  IF to_regclass('backup_20261120_f.cron_jobs') IS NOT NULL AND to_regclass('cron.job') IS NOT NULL THEN
    FOR j IN SELECT * FROM backup_20261120_f.cron_jobs
             WHERE jobname IN ('auto-mark-absent', 'deactivate-expired-personnel') LOOP
      PERFORM cron.schedule(j.jobname, j.schedule, j.command);
    END LOOP;
  END IF;
END $$;

-- Realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM backup_20261120_f.log WHERE kind = 'publication_added' AND object = 'personnel') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.personnel;
  END IF;
END $$;

-- Clean-up undone: indexes, constraint, empty columns
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM backup_20261120_f.log WHERE kind IN ('dropped_index', 'dropped_constraint', 'dropped_column') ORDER BY id LOOP
    IF r.kind = 'dropped_index' THEN EXECUTE r.detail;
    ELSIF r.kind = 'dropped_constraint' THEN
      EXECUTE format('ALTER TABLE public.attendance ADD CONSTRAINT %I %s', r.object, r.detail);
    ELSE
      EXECUTE format('ALTER TABLE public.attendance ADD COLUMN %I %s', r.object, r.detail);
    END IF;
  END LOOP;
END $$;

-- New columns and helpers
ALTER TABLE public.attendance DROP COLUMN IF EXISTS offline_log;
ALTER TABLE public.personnel  DROP COLUMN IF EXISTS must_change_password;
DROP FUNCTION IF EXISTS app_private.can_delete_avatar(text);
DROP FUNCTION IF EXISTS app_private.auto_mark_absent(date);
DROP FUNCTION IF EXISTS app_private.deactivate_expired();
DROP FUNCTION IF EXISTS app_private.is_report_day(text, date);
DROP FUNCTION IF EXISTS app_private.write_change(text, text, text, uuid, jsonb, jsonb);
DROP FUNCTION IF EXISTS app_private.track_change();
DROP FUNCTION IF EXISTS app_private.personnel_defaults();
DROP FUNCTION IF EXISTS app_private.pending_leave_count(uuid);
DROP FUNCTION IF EXISTS app_private.leave_cap();
DROP TABLE IF EXISTS app_private.public_holidays;

-- Keep the snapshot for reference, out of the way of a re-run
DO $$ BEGIN
  EXECUTE format('ALTER SCHEMA backup_20261120_f RENAME TO %I', 'backup_20261120_f_undone_' || to_char(now(), 'YYYYMMDDHH24MISS'));
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
