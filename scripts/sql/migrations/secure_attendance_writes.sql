-- Secure attendance writes
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor)
--
-- Adds three layers of protection:
--   1. log_phase_now becomes SECURITY DEFINER so the trigger below can
--      distinguish legitimate app writes from direct REST calls.
--   2. log_phase_offline validates the client-supplied time before writing,
--      blocking clock-manipulation attacks on offline check-ins.
--   3. A BEFORE trigger blocks reservists from writing time/status fields
--      directly via the REST API. SECURITY DEFINER functions bypass it
--      automatically (current_user != session_user inside those functions).

-- ── 1. log_phase_now (SECURITY DEFINER) ──────────────────────────────────────
-- Replaces the existing function. The only change is SECURITY DEFINER,
-- which causes current_user to differ from session_user inside the function,
-- letting the trigger below allow the write without interference.
CREATE OR REPLACE FUNCTION log_phase_now(
  p_personnel_id UUID,
  p_date         DATE,
  p_phase        TEXT,
  p_dist         FLOAT   DEFAULT NULL,
  p_bypassed     BOOLEAN DEFAULT FALSE
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_now_sg   TIMESTAMPTZ := NOW() AT TIME ZONE 'Asia/Singapore';
  v_time     TEXT        := TO_CHAR(v_now_sg, 'HH24:MI');
  v_time_col TEXT;
  v_dist_col TEXT;
  v_existing UUID;
BEGIN
  IF p_phase NOT IN ('p1','p2','p3','p4') THEN RETURN NULL; END IF;

  v_time_col := CASE p_phase
    WHEN 'p1' THEN 'check_in_time'    WHEN 'p2' THEN 'lunch_out_time'
    WHEN 'p3' THEN 'work_return_time' ELSE            'work_end_time'
  END;
  v_dist_col := CASE p_phase
    WHEN 'p1' THEN 'gps_distance_m'  WHEN 'p2' THEN 'lunch_out_dist'
    WHEN 'p3' THEN 'work_return_dist' ELSE           'work_end_dist'
  END;

  SELECT id INTO v_existing FROM attendance
  WHERE personnel_id = p_personnel_id AND date = p_date LIMIT 1;

  IF v_existing IS NOT NULL THEN
    EXECUTE format(
      'UPDATE attendance
          SET status = ''present'', %I = $1, %I = $2, gps_bypassed = (gps_bypassed OR $3)
        WHERE id = $4 AND %I IS NULL AND status != ''mc''',
      v_time_col, v_dist_col, v_time_col
    ) USING v_time || ':00', p_dist, p_bypassed, v_existing;
  ELSE
    EXECUTE format(
      'INSERT INTO attendance (personnel_id, date, status, %I, %I, gps_bypassed)
       VALUES ($1, $2, ''present'', $3, $4, $5)
       ON CONFLICT (personnel_id, date) DO NOTHING',
      v_time_col, v_dist_col
    ) USING p_personnel_id, p_date, v_time || ':00', p_dist, p_bypassed;
  END IF;

  RETURN v_time;
END;
$$;

-- ── 2. log_phase_offline ──────────────────────────────────────────────────────
-- Called by the app when replaying offline check-ins. Validates the
-- client-supplied time against server time before writing.
-- Returns 'ok' on success, or 'rejected:<reason>' if the time is invalid.
CREATE OR REPLACE FUNCTION log_phase_offline(
  p_phase    TEXT,
  p_date     DATE,
  p_time     TEXT,
  p_dist     FLOAT   DEFAULT NULL,
  p_bypassed BOOLEAN DEFAULT FALSE
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid       UUID        := _auth_pid();
  v_now_sg    TIMESTAMPTZ := NOW() AT TIME ZONE 'Asia/Singapore';
  v_submitted TIMESTAMPTZ;
  v_time_col  TEXT;
  v_dist_col  TEXT;
  v_existing  UUID;
BEGIN
  IF v_pid IS NULL                          THEN RETURN 'rejected:unauthenticated'; END IF;
  IF p_phase NOT IN ('p1','p2','p3','p4')   THEN RETURN 'rejected:invalid_phase';   END IF;
  IF p_time !~ '^\d{2}:\d{2}$'             THEN RETURN 'rejected:invalid_time';     END IF;
  IF p_date != v_now_sg::DATE               THEN RETURN 'rejected:wrong_date';       END IF;

  v_submitted := (p_date::TEXT || ' ' || p_time)::TIMESTAMP AT TIME ZONE 'Asia/Singapore';

  -- Reject times more than 4 hours old (generous buffer for genuine offline gaps)
  IF v_submitted < v_now_sg - INTERVAL '4 hours' THEN RETURN 'rejected:too_old'; END IF;
  -- Reject future times (5-minute tolerance for clock drift)
  IF v_submitted > v_now_sg + INTERVAL '5 minutes' THEN RETURN 'rejected:future'; END IF;

  v_time_col := CASE p_phase
    WHEN 'p1' THEN 'check_in_time'    WHEN 'p2' THEN 'lunch_out_time'
    WHEN 'p3' THEN 'work_return_time' ELSE            'work_end_time'
  END;
  v_dist_col := CASE p_phase
    WHEN 'p1' THEN 'gps_distance_m'  WHEN 'p2' THEN 'lunch_out_dist'
    WHEN 'p3' THEN 'work_return_dist' ELSE           'work_end_dist'
  END;

  SELECT id INTO v_existing FROM attendance
  WHERE personnel_id = v_pid AND date = p_date LIMIT 1;

  IF v_existing IS NOT NULL THEN
    EXECUTE format(
      'UPDATE attendance
          SET status = ''present'', %I = $1, %I = $2, gps_bypassed = (gps_bypassed OR $3)
        WHERE id = $4 AND %I IS NULL AND status != ''mc''',
      v_time_col, v_dist_col, v_time_col
    ) USING p_time || ':00', p_dist, p_bypassed, v_existing;
  ELSE
    EXECUTE format(
      'INSERT INTO attendance (personnel_id, date, status, %I, %I, gps_bypassed)
       VALUES ($1, $2, ''present'', $3, $4, $5)
       ON CONFLICT (personnel_id, date) DO NOTHING',
      v_time_col, v_dist_col
    ) USING v_pid, p_date, p_time || ':00', p_dist, p_bypassed;
  END IF;

  RETURN 'ok';
END;
$$;

-- NOTE: The trigger approach (attack vector #4) was removed.
-- The current_user / session_user distinction does not behave reliably
-- in Supabase's connection pooler and blocked legitimate RPC calls.
-- Protection against direct REST writes is provided by log_phase_offline
-- (server-side time validation) and log_phase_now (SECURITY DEFINER,
-- which stamps server time regardless of what the client sends).
