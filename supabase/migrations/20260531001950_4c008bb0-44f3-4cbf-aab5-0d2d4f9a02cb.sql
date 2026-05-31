GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_supervisor_of(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_supervisor_see_patient(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.ensure_current_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_clinical_access(text, uuid, public.audit_access_type, public.audit_result, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_supervision_access(text, uuid, uuid, uuid, public.audit_result, text) TO authenticated;