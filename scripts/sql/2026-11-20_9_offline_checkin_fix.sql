-- 2026-11-20_9_offline_checkin_fix.sql
-- Offline check-ins were rejected as "too_old" whenever the database session
-- runs in UTC (the Supabase default). The function stored Singapore wall-clock
-- time in a timestamptz, which UTC reads as 8 hours ahead, so every queued
-- check-in looked older than 4 hours and the app dropped it silently.
-- This keeps the same rules (same day in Singapore, not older than 4 hours,
-- not more than 5 minutes ahead) but compares real instants.
-- Safe to run more than once. Undo: 2026-11-20_9b_offline_checkin_fix_rollback.sql
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('app_private._orig_log_phase_offline(text,date,text,double precision,boolean)') IS NULL THEN
    RAISE EXCEPTION 'Run 2026-11-20_3_migration.sql first.';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION app_private._orig_log_phase_offline(p_phase text, p_date date, p_time text, p_dist double precision DEFAULT NULL::double precision, p_bypassed boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_pid       UUID        := _auth_pid();
  v_now_sg    TIMESTAMPTZ := NOW();  -- a real instant, so the 4h / 5min checks work in any session time zone
  v_submitted TIMESTAMPTZ;
  v_time_col  TEXT;
  v_existing  UUID;
BEGIN
  IF v_pid IS NULL                          THEN RETURN 'rejected:unauthenticated'; END IF;
  IF p_phase NOT IN ('p1','p2','p3','p4')   THEN RETURN 'rejected:invalid_phase';   END IF;
  IF p_time !~ '^\d{2}:\d{2}$'             THEN RETURN 'rejected:invalid_time';     END IF;
  IF p_date != (NOW() AT TIME ZONE 'Asia/Singapore')::DATE THEN RETURN 'rejected:wrong_date'; END IF;

  v_submitted := (p_date::TEXT || ' ' || p_time)::TIMESTAMP AT TIME ZONE 'Asia/Singapore';

  IF v_submitted < v_now_sg - INTERVAL '4 hours' THEN RETURN 'rejected:too_old'; END IF;
  IF v_submitted > v_now_sg + INTERVAL '5 minutes' THEN RETURN 'rejected:future'; END IF;

  v_time_col := CASE p_phase
    WHEN 'p1' THEN 'check_in_time'    WHEN 'p2' THEN 'lunch_out_time'
    WHEN 'p3' THEN 'work_return_time' ELSE            'work_end_time'
  END;

  SELECT id INTO v_existing FROM attendance
  WHERE personnel_id = v_pid AND date = p_date LIMIT 1;

  IF p_phase = 'p1' THEN
    IF v_existing IS NOT NULL THEN
      EXECUTE format(
        'UPDATE attendance
            SET status = ''present'', %I = $1, gps_distance_m = $2, gps_bypassed = (gps_bypassed OR $3)
          WHERE id = $4 AND %I IS NULL AND status != ''mc''',
        v_time_col, v_time_col
      ) USING (p_time || ':00')::TIME, p_dist, p_bypassed, v_existing;
    ELSE
      EXECUTE format(
        'INSERT INTO attendance (personnel_id, date, status, %I, gps_distance_m, gps_bypassed)
         VALUES ($1, $2, ''present'', $3, $4, $5)
         ON CONFLICT (personnel_id, date) DO NOTHING',
        v_time_col
      ) USING v_pid, p_date, (p_time || ':00')::TIME, p_dist, p_bypassed;
    END IF;
  ELSE
    IF v_existing IS NOT NULL THEN
      EXECUTE format(
        'UPDATE attendance
            SET status = ''present'', %I = $1, gps_bypassed = (gps_bypassed OR $2)
          WHERE id = $3 AND %I IS NULL AND status != ''mc''',
        v_time_col, v_time_col
      ) USING (p_time || ':00')::TIME, p_bypassed, v_existing;
    ELSE
      EXECUTE format(
        'INSERT INTO attendance (personnel_id, date, status, %I, gps_bypassed)
         VALUES ($1, $2, ''present'', $3, $4)
         ON CONFLICT (personnel_id, date) DO NOTHING',
        v_time_col
      ) USING v_pid, p_date, (p_time || ':00')::TIME, p_bypassed;
    END IF;
  END IF;

  RETURN 'ok';
END;
$function$;

-- Postflight: the check must now accept "now" and refuse 5 hours ago, whatever the session time zone
DO $$
DECLARE f text := pg_get_functiondef('app_private._orig_log_phase_offline(text,date,text,double precision,boolean)'::regprocedure);
BEGIN
  IF f ~ 'v_now_sg\s+TIMESTAMPTZ := NOW\(\) AT TIME ZONE' THEN RAISE EXCEPTION 'fix not applied'; END IF;
END $$;
COMMIT;
