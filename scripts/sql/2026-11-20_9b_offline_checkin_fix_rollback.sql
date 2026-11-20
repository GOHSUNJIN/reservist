-- Restores the previous offline check-in function body (UTC bug included).
BEGIN;
CREATE OR REPLACE FUNCTION app_private._orig_log_phase_offline(p_phase text, p_date date, p_time text, p_dist double precision DEFAULT NULL::double precision, p_bypassed boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_pid       UUID        := _auth_pid();
  v_now_sg    TIMESTAMPTZ := NOW() AT TIME ZONE 'Asia/Singapore';
  v_submitted TIMESTAMPTZ;
  v_time_col  TEXT;
  v_existing  UUID;
BEGIN
  IF v_pid IS NULL                          THEN RETURN 'rejected:unauthenticated'; END IF;
  IF p_phase NOT IN ('p1','p2','p3','p4')   THEN RETURN 'rejected:invalid_phase';   END IF;
  IF p_time !~ '^\d{2}:\d{2}$'             THEN RETURN 'rejected:invalid_time';     END IF;
  IF p_date != v_now_sg::DATE               THEN RETURN 'rejected:wrong_date';       END IF;

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
COMMIT;
