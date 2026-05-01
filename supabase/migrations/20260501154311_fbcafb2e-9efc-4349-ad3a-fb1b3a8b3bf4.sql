-- Make library bucket private
UPDATE storage.buckets SET public = false WHERE id = 'library';

-- Remove the overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can read library files" ON storage.objects;

-- Authenticated users can read library files (RLS on library_materials table controls premium access)
CREATE POLICY "Authenticated users can read library files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'library');