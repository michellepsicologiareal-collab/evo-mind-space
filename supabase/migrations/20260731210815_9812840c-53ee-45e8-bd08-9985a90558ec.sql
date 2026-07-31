DROP POLICY IF EXISTS "Supervisors can view shared patients" ON public.patients;

CREATE OR REPLACE FUNCTION public.list_supervised_patients()
RETURNS TABLE(id uuid, user_id uuid, code text, is_active boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id,
         p.user_id,
         CASE
           WHEN coalesce(trim(p.full_name), '') = '' THEN 'Paciente ?'
           ELSE 'Paciente ' || upper(
             left(split_part(trim(p.full_name), ' ', 1), 1) ||
             CASE
               WHEN array_length(regexp_split_to_array(trim(p.full_name), '\s+'), 1) > 1
                 THEN left((regexp_split_to_array(trim(p.full_name), '\s+'))[array_length(regexp_split_to_array(trim(p.full_name), '\s+'), 1)], 1)
               ELSE ''
             END)
         END AS code,
         p.is_active
  FROM public.patients p
  WHERE auth.uid() IS NOT NULL
    AND public.can_supervisor_see_patient(p.id)
  ORDER BY p.created_at;
$$;

CREATE OR REPLACE FUNCTION public.get_supervised_patient_overview(_patient_id uuid)
RETURNS TABLE(id uuid, user_id uuid, code text, is_active boolean, notes text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT l.id, l.user_id, l.code, l.is_active, p.notes
  FROM public.list_supervised_patients() l
  JOIN public.patients p ON p.id = l.id
  WHERE l.id = _patient_id;
$$;

REVOKE ALL ON FUNCTION public.list_supervised_patients() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_supervised_patient_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_supervised_patients() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_supervised_patient_overview(uuid) TO authenticated;