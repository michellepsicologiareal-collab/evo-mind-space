DROP FUNCTION IF EXISTS public.get_session_by_token(uuid);

CREATE OR REPLACE FUNCTION public.get_session_by_token(_token uuid)
 RETURNS TABLE(id uuid, scheduled_at timestamp with time zone, duration_minutes integer, status text, patient_name text, modality text, therapist_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT s.id, s.scheduled_at, s.duration_minutes, s.status::text, p.full_name, s.modality, pr.full_name
  FROM public.sessions s
  JOIN public.patients p ON p.id = s.patient_id
  JOIN public.profiles pr ON pr.id = s.user_id
  WHERE s.confirmation_token = _token
  LIMIT 1;
$$;