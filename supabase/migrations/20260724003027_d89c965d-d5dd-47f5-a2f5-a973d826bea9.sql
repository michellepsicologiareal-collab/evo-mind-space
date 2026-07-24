
ALTER TABLE public.homework_tasks
  ADD COLUMN IF NOT EXISTS coping_card_title text NULL,
  ADD COLUMN IF NOT EXISTS coping_card_content text NULL;

DROP FUNCTION IF EXISTS public.get_homework_by_token(uuid, text);

CREATE FUNCTION public.get_homework_by_token(_token uuid, _password text)
RETURNS TABLE(
  patient_name text,
  therapist_name text,
  therapist_crp text,
  task_id uuid,
  title text,
  content text,
  session_points text,
  actions jsonb,
  weekly_observations text,
  coping_card_title text,
  coping_card_content text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone
)
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
    h.coping_card_title,
    h.coping_card_content,
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

GRANT EXECUTE ON FUNCTION public.get_homework_by_token(uuid, text) TO anon, authenticated;
