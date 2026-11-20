-- ============================================================================
-- ReservistGO: UNDO the data clean-up (attendance rows only)
-- ============================================================================
BEGIN;
DO $$
BEGIN
  IF to_regclass('backup_20261120_cleanup.removed_attendance') IS NULL THEN
    RAISE EXCEPTION 'backup_20261120_cleanup.removed_attendance not found.';
  END IF;
END $$;
DO $$
DECLARE cols text;
BEGIN
  -- only the columns attendance still has (the follow-up may have dropped unused ones)
  SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position) INTO cols
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'attendance'
    AND EXISTS (SELECT 1 FROM information_schema.columns b WHERE b.table_schema = 'backup_20261120_cleanup'
                AND b.table_name = 'removed_attendance' AND b.column_name = c.column_name);
  EXECUTE format('INSERT INTO public.attendance (%s) SELECT %s FROM backup_20261120_cleanup.removed_attendance ON CONFLICT DO NOTHING', cols, cols);
END $$;
INSERT INTO public.audit_log (actor_name, actor_role, category, action, meta)
VALUES ('Database clean-up', 'system', 'data', 'data.cleanup.undone', NULL);
COMMIT;
SELECT count(*) AS attendance_rows_now FROM public.attendance;
