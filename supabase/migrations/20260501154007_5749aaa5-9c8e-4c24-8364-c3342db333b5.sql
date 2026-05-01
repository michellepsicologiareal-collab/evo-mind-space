-- Remove failed policy if it exists
DROP POLICY IF EXISTS "Premium users can view premium materials" ON public.library_materials;

-- Create correct policy using 'active' enum value
CREATE POLICY "Premium users can view premium materials"
ON public.library_materials
FOR SELECT
TO authenticated
USING (
  is_premium = true
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND subscription_status = 'active'
  )
);