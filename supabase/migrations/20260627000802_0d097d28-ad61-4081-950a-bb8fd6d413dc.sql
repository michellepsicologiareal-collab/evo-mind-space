
-- Add structured session plan fields to homework_tasks
ALTER TABLE public.homework_tasks
  ADD COLUMN IF NOT EXISTS session_points text,
  ADD COLUMN IF NOT EXISTS actions jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS weekly_observations text;

-- Drop and recreate the public RPC with the new return signature
DROP FUNCTION IF EXISTS public.get_homework_by_token(uuid);

CREATE OR REPLACE FUNCTION public.get_homework_by_token(_token uuid)
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
  sent_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
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
  ORDER BY h.sent_at DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_homework_by_token(uuid) TO anon, authenticated;
