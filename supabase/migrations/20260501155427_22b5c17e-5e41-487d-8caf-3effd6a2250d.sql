-- ═══════════════════════════════════════════════════════════════
-- 1. Harden is_supervisor_of — add auth.uid() null guard
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.is_supervisor_of(_supervisee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = _supervisee_id
        AND supervisor_id = auth.uid()
        AND profile_type = 'supervisee'
    )
  END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 2. Harden can_supervisor_see_patient — add auth.uid() null guard
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.can_supervisor_see_patient(_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.patients p
      JOIN public.profiles pr ON pr.id = p.user_id
      WHERE p.id = _patient_id
        AND p.shared_with_supervisor = true
        AND pr.supervisor_id = auth.uid()
        AND pr.profile_type = 'supervisee'
    )
  END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 3. Harden has_role — add null guard + validate _user_id matches caller
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    )
  END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 4. Revoke EXECUTE from anon on functions that require authentication
-- ═══════════════════════════════════════════════════════════════
REVOKE EXECUTE ON FUNCTION public.is_supervisor_of(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_supervisor_see_patient(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.link_supervisee_by_email(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.unlink_supervisee(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_profile_id_by_email(text) FROM anon;