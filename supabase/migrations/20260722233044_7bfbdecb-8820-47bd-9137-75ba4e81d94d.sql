
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS homework_password text;

CREATE OR REPLACE FUNCTION public.get_homework_link_info(_token uuid)
RETURNS TABLE(patient_name text, password_required boolean, exists_flag boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.full_name,
         (p.homework_password IS NOT NULL AND length(trim(p.homework_password)) > 0) AS password_required,
         true AS exists_flag
  FROM public.patients p
  WHERE p.homework_token = _token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_homework_by_token(_token uuid, _password text)
RETURNS TABLE(patient_name text, therapist_name text, therapist_crp text, task_id uuid, title text, content text, session_points text, actions jsonb, weekly_observations text, sent_at timestamp with time zone, created_at timestamp with time zone)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    p.full_name,
    pr.full_name,
    pr.crp,
    h.id,
    h.title,
    h.content,
    h.session_points,
    h.actions,
    h.weekly_observations,
    h.sent_at,
    h.created_at
  FROM public.patients p
  JOIN public.profiles pr ON pr.id = p.user_id
  LEFT JOIN public.homework_tasks h
    ON h.patient_id = p.id AND h.sent_at IS NOT NULL
  WHERE p.homework_token = _token
    AND (
      p.homework_password IS NULL
      OR length(trim(p.homework_password)) = 0
      OR p.homework_password = _password
    )
  ORDER BY h.sent_at DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_homework_link_info(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_homework_by_token(uuid, text) TO anon, authenticated;
