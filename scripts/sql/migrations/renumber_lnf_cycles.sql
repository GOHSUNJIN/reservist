-- Renumber LNF batches to their own independent sequence starting at Cycle 1.
-- Labels each batch Cycle N/YYYY ordered by start_date within each year.

-- Preview:
SELECT id, label AS old_label,
  'Cycle ' || ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM start_date) ORDER BY start_date)
  || '/' || EXTRACT(YEAR FROM start_date)::int AS new_label
FROM batches
WHERE department = 'lnf'
ORDER BY start_date;

-- Apply:
WITH ranked AS (
  SELECT id,
    'Cycle ' || ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM start_date) ORDER BY start_date)
    || '/' || EXTRACT(YEAR FROM start_date)::int AS new_label
  FROM batches
  WHERE department = 'lnf'
)
UPDATE batches
SET label = ranked.new_label
FROM ranked
WHERE batches.id = ranked.id;
