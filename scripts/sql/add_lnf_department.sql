-- Add Lost & Found (lnf) as a new department type.
-- Run this in the Supabase SQL editor before activating L&F in the app.
-- After running, uncomment the <option value="lnf"> in index.html.

ALTER TYPE department_type ADD VALUE 'lnf';
