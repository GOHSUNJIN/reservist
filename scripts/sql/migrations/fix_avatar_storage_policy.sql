-- Fix: Allow all authenticated users (admins and reservists) to upload
-- and view profile photos.
--
-- Background: avatars are stored by personnel.id (not auth.uid()), so the
-- default "users can manage files matching their own auth UUID" policy does
-- not work. These policies resolve the personnel ID from the auth session
-- and allow each user to INSERT/UPDATE only their own file.
-- The SELECT policy lets the app list bucket contents to discover which
-- members have photos (used by loadRosterAvatars on every tab).
--
-- Run this once in the Supabase SQL Editor.

-- Drop old versions if rerunning
DROP POLICY IF EXISTS "Users can view all avatars"    ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar"   ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar"   ON storage.objects;
DROP POLICY IF EXISTS "Reservists can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Reservists can update own avatar" ON storage.objects;

-- SELECT: lets any authenticated user list and read all avatar files
-- (needed so loadRosterAvatars can discover which members have photos)
CREATE POLICY "Users can view all avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

-- INSERT: lets any authenticated user upload their own avatar file
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND name = (SELECT id::text FROM public.personnel WHERE auth_id = auth.uid())
);

-- UPDATE: lets any authenticated user overwrite their own avatar file (needed for upsert)
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND name = (SELECT id::text FROM public.personnel WHERE auth_id = auth.uid())
);
