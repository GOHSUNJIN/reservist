-- Fix: Allow all authenticated users (admins and reservists) to upload
-- their own profile photo.
--
-- Background: avatars are stored by personnel.id (not auth.uid()), so the
-- default "users can manage files matching their own auth UUID" policy does
-- not work. These policies resolve the personnel ID from the auth session
-- and allow each user to INSERT/UPDATE only their own file.
--
-- Run this once in the Supabase SQL Editor.

-- Drop old versions if rerunning
DROP POLICY IF EXISTS "Users can upload own avatar"  ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar"  ON storage.objects;
DROP POLICY IF EXISTS "Reservists can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Reservists can update own avatar" ON storage.objects;

-- INSERT: lets any authenticated user create their avatar file
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND name = (SELECT id::text FROM public.personnel WHERE auth_id = auth.uid())
);

-- UPDATE: lets any authenticated user overwrite their avatar file (needed for upsert)
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND name = (SELECT id::text FROM public.personnel WHERE auth_id = auth.uid())
);
