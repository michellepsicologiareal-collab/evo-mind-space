REVOKE EXECUTE ON FUNCTION public.is_supervisor_of(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_supervisor_see_patient(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_clinical_access(text, uuid, audit_access_type, audit_result, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_supervision_access(text, uuid, uuid, uuid, audit_result, text) FROM anon;