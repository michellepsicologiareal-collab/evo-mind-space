DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (
      is_approved = false
      AND profile_type = 'standard'::profile_type
      AND supervisor_id IS NULL
      AND subscription_status = 'free'::subscription_status
      AND subscription_ends_at IS NULL
      AND rejected_at IS NULL
    )
  )
);