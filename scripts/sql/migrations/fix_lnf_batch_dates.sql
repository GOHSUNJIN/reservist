-- Fix LNF batch dates from OPS schedule (Tue→Mon) to LNF schedule (Mon→Sat).
-- All expressions reference the OLD start_date (PostgreSQL evaluates SET clauses against
-- the original row, not the partially-updated one).
--
-- Before: start=Tue, end=Tue+13(Mon), dekit=Tue+15(Wed)
-- After:  start=Mon, end=Mon+12(Sat), dekit unchanged (still Wed)

-- Preview first:
SELECT id, label, department, start_date, end_date, dekit_date,
  (start_date::date - 1)       AS new_start,
  (start_date::date + 11)      AS new_end,
  dekit_date                   AS new_dekit
FROM batches
WHERE department = 'lnf'
ORDER BY start_date;

-- Apply the fix:
UPDATE batches
SET
  start_date = (start_date::date - 1)::text,
  end_date   = (start_date::date + 11)::text
WHERE department = 'lnf';
