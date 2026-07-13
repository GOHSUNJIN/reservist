-- Run this in your Supabase SQL editor (Dashboard → SQL Editor)
-- Requires pg_cron extension (enabled by default on Supabase Pro)

-- Enable extension if not already on
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily at 18:00 UTC (02:00 SGT) to deactivate expired personnel
SELECT cron.schedule(
  'deactivate-expired-personnel',
  '0 18 * * *',
  $$
    UPDATE personnel
    SET
      is_active = false,
      deactivated_at = NOW()
    WHERE
      is_active = true
      AND batch_id IN (
        SELECT id FROM batches
        WHERE dekit_date < CURRENT_DATE
      );
  $$
);

-- To remove the job later:
-- SELECT cron.unschedule('deactivate-expired-personnel');


-- Schedule daily at 16:05 UTC (00:05 SGT) to auto-mark absent
-- any active personnel with no attendance record for the day that just ended
SELECT cron.schedule(
  'auto-mark-absent',
  '5 16 * * *',
  $$
    WITH yesterday AS (
      SELECT ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Singapore')::date - 1) AS d
    ),
    report_day AS (
      SELECT d FROM yesterday
      WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 5  -- Mon-Fri only
        AND NOT EXISTS (SELECT 1 FROM no_report_days WHERE date = d)
    )
    INSERT INTO attendance (personnel_id, date, status)
    SELECT p.id, r.d, 'absent'
    FROM personnel p
    CROSS JOIN report_day r
    WHERE p.is_active = true
      AND p.role = 'reservist'
      AND NOT EXISTS (
        SELECT 1 FROM attendance a
        WHERE a.personnel_id = p.id AND a.date = r.d
      )
    ON CONFLICT (personnel_id, date) DO NOTHING;
  $$
);

-- To remove the job later:
-- SELECT cron.unschedule('auto-mark-absent');

-- To check scheduled jobs:
-- SELECT * FROM cron.job;
