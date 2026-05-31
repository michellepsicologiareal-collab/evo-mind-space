-- Internal-only: used solely inside RLS policies and triggers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_supervisor_of(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_supervisor_see_patient(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_assign_admin_role() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_access_fields() FROM anon, authenticated;

-- Authenticated-only: remove anon
REVOKE EXECUTE ON FUNCTION public.ensure_current_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_clinical_access(text, uuid, public.audit_access_type, public.audit_result, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_supervision_access(text, uuid, uuid, uuid, public.audit_result, text) FROM anon;