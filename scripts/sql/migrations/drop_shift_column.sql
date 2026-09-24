-- Drop personnel.shift — never branched on in the app.
-- Utils.shiftLabel/shiftWindow both ignored their argument (always returned 'Office'/'0900 to 1800 hrs').
-- Exports already used deptLabel(department) as first choice; builders now inline the strings directly.

ALTER TABLE personnel DROP COLUMN IF EXISTS shift;
