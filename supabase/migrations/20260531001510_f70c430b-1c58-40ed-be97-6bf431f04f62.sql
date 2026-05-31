REVOKE EXECUTE ON FUNCTION public.log_clinical_access(text, uuid, public.audit_access_type, public.audit_result, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_supervision_access(text, uuid, uuid, uuid, public.audit_result, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_clinical_access(text, uuid, public.audit_access_type, public.audit_result, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_supervision_access(text, uuid, uuid, uuid, public.audit_result, text) TO authenticated;