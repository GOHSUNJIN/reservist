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

-- ── 3. Trigger: block direct REST time/status writes by reservists ────────────
-- Inside a SECURITY DEFINER function, current_user != session_user, so
-- log_phase_now and log_phase_offline pass through untouched.
-- Direct REST API calls (current_user = session_user = 'authenticated') by
-- reservists are blocked from writing time or status fields.
-- Admins and cron jobs (NULL auth role) are always allowed through.
CREATE OR REPLACE FUNCTION _block_direct_time_writes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- SECURITY DEFINER context: current_user is the function owner, not 'authenticated'
  IF current_user IS DISTINCT FROM session_user THEN RETURN NEW; END IF;

  v_role := _auth_role();

  -- No JWT context (cron jobs, service role) or admins: allow
  IF v_role IS NULL OR v_role IN ('admin', 'superadmin') THEN RETURN NEW; END IF;

  -- Reservists via direct REST: block time and status field writes
  IF TG_OP = 'INSERT' THEN
    IF NEW.check_in_time    IS NOT NULL OR NEW.lunch_out_time   IS NOT NULL OR
       NEW.work_return_time IS NOT NULL OR NEW.work_end_time    IS NOT NULL OR
       NEW.status = 'present' THEN
      RAISE EXCEPTION 'attendance check-in must go through the app';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.check_in_time    IS DISTINCT FROM OLD.check_in_time    OR
       NEW.lunch_out_time   IS DISTINCT FROM OLD.lunch_out_time   OR
       NEW.work_return_time IS DISTINCT FROM OLD.work_return_time OR
       NEW.work_end_time    IS DISTINCT FROM OLD.work_end_time    OR
       NEW.status           IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'attendance time/status cannot be set directly';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_direct_time_writes ON attendance;
CREATE TRIGGER block_direct_time_writes
  BEFORE INSERT OR UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION _block_direct_time_writes();
