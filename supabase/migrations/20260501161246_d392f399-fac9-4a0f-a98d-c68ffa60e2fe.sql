-- Enums for audit logging
CREATE TYPE public.audit_access_type AS ENUM ('own', 'supervision');
CREATE TYPE public.audit_result AS ENUM ('success', 'blocked');

-- Audit logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  access_type audit_access_type NOT NULL DEFAULT 'own',
  result audit_result NOT NULL DEFAULT 'success',
  block_reason text,
  supervisor_id uuid,
  supervisee_id uuid,
  patient_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can view own audit logs
CREATE POLICY "Users can view own audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Users can insert own audit logs (via RPC)
CREATE POLICY "Users can insert own audit logs"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can view all audit logs
CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_supervisor ON public.audit_logs(supervisor_id) WHERE supervisor_id IS NOT NULL;

-- ═══ RPC: Log clinical data access ═══
CREATE OR REPLACE FUNCTION public.log_clinical_access(
  _resource_type text,
  _resource_id uuid,
  _access_type audit_access_type DEFAULT 'own',
  _result audit_result DEFAULT 'success',
  _block_reason text DEFAULT NULL,
  _patient_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  INSERT INTO public.audit_logs (user_id, resource_type, resource_id, access_type, result, block_reason, patient_id)
  VALUES (auth.uid(), _resource_type, _resource_id, _access_type, _result, _block_reason, _patient_id);
END;
$$;

-- ═══ RPC: Log supervision access with validation ═══
CREATE OR REPLACE FUNCTION public.log_supervision_access(
  _resource_type text,
  _resource_id uuid,
  _supervisee_id uuid,
  _patient_id uuid,
  _result audit_result DEFAULT 'success',
  _block_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  INSERT INTO public.audit_logs (
    user_id, resource_type, resource_id, access_type, result,
    block_reason, supervisor_id, supervisee_id, patient_id
  )
  VALUES (
    auth.uid(), _resource_type, _resource_id, 'supervision', _result,
    _block_reason, auth.uid(), _supervisee_id, _patient_id
  );
END;
$$;

-- Revoke anon access to audit RPCs
REVOKE EXECUTE ON FUNCTION public.log_clinical_access(text, uuid, audit_access_type, audit_result, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_supervision_access(text, uuid, uuid, uuid, audit_result, text) FROM anon;