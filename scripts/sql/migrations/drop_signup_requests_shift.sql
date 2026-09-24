-- Drop signup_requests.shift — was only used to carry shift into personnel,
-- but personnel.shift has been removed. No longer written or read by the app.

ALTER TABLE signup_requests DROP COLUMN IF EXISTS shift;
