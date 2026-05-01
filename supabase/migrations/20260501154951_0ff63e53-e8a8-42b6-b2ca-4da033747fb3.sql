-- Remove stale permissive policy
DROP POLICY IF EXISTS "Authenticated users can view library materials" ON public.library_materials;

-- Ensure free materials policy exists
CREATE POLICY "Anyone can view free materials"
ON public.library_materials
FOR SELECT
TO authenticated
USING (is_premium = false);