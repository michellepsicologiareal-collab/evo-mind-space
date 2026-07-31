CREATE OR REPLACE FUNCTION public.profile_privileged_fields_unchanged(
  _id uuid,
  _is_approved boolean,
  _profile_type public.profile_type,
  _supervisor_id uuid,
  _subscription_status public.subscription_status,
  _trial_ends_at timestamptz,
  _subscription_ends_at timestamptz,
  _rejected_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _id
      AND p.is_approved IS NOT DISTINCT FROM _is_approved
      AND p.profile_type IS NOT DISTINCT FROM _profile_type
      AND p.supervisor_id IS NOT DISTINCT FROM _supervisor_id
      AND p.subscription_status IS NOT DISTINCT FROM _subscription_status
      AND p.trial_ends_at IS NOT DISTINCT FROM _trial_ends_at
      AND p.subscription_ends_at IS NOT DISTINCT FROM _subscription_ends_at
      AND p.rejected_at IS NOT DISTINCT FROM _rejected_at
  );
$$;

REVOKE ALL ON FUNCTION public.profile_privileged_fields_unchanged(uuid, boolean, public.profile_type, uuid, public.subscription_status, timestamptz, timestamptz, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.profile_privileged_fields_unchanged(uuid, boolean, public.profile_type, uuid, public.subscription_status, timestamptz, timestamptz, timestamptz) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.profile_privileged_fields_unchanged(
      id, is_approved, profile_type, supervisor_id,
      subscription_status, trial_ends_at, subscription_ends_at, rejected_at
    )
  )
);

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));