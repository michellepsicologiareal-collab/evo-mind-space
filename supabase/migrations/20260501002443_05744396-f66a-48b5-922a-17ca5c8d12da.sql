-- Trigger / internal-only functions: revoke ALL execute privileges
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_self_supervisor() FROM PUBLIC, anon, authenticated;

-- RLS helper used inside policies only — must not be callable via API
REVOKE ALL ON FUNCTION public.is_supervisor_of(uuid) FROM PUBLIC, anon, authenticated;

-- RPCs used by the app: keep for authenticated users, revoke from anon/public
REVOKE ALL ON FUNCTION public.get_profile_id_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_id_by_email(text) TO authenticated;

REVOKE ALL ON FUNCTION public.link_supervisee_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_supervisee_by_email(text) TO authenticated;

REVOKE ALL ON FUNCTION public.unlink_supervisee(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlink_supervisee(uuid) TO authenticated;