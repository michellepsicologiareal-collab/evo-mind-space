REVOKE ALL ON FUNCTION public.ensure_current_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_current_profile() TO authenticated;

REVOKE ALL ON FUNCTION public.protect_profile_access_fields() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_profile_access_fields() FROM authenticated;