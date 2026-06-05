
-- 1. Audit logs: remove client INSERT policy (writes must go through SECURITY DEFINER RPCs)
DROP POLICY IF EXISTS "Users can insert own audit logs" ON public.audit_logs;

-- 2. Storage: add write policies for backups bucket scoped to user's folder
CREATE POLICY "Users can upload own backup files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'backups' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own backup files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'backups' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'backups' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own backup files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'backups' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 3. Profiles: restrict supervisor access to only safe columns via RPC
DROP POLICY IF EXISTS "Supervisors can view supervisees" ON public.profiles;

CREATE OR REPLACE FUNCTION public.list_my_supervisees()
RETURNS TABLE (
  id uuid,
  full_name text,
  crp text,
  phone text,
  specialty text,
  avatar_url text,
  profile_type public.profile_type
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.crp, p.phone, p.specialty, p.avatar_url, p.profile_type
  FROM public.profiles p
  WHERE p.supervisor_id = auth.uid()
    AND p.profile_type = 'supervisee'
    AND auth.uid() IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.list_my_supervisees() TO authenticated;
