-- Drop columns that are defined in the schema but never read or written by the app.
--
-- batches.meal_active: setMealActive() was never called from any handler.
-- leave_requests.requested_shift: request() caller never passed requestedShift.

ALTER TABLE batches DROP COLUMN IF EXISTS meal_active;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS requested_shift;
