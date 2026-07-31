ALTER TABLE public.supervisee_goals
  ADD COLUMN IF NOT EXISTS skill text,
  ADD COLUMN IF NOT EXISTS evidence text,
  ADD COLUMN IF NOT EXISTS objective text,
  ADD COLUMN IF NOT EXISTS activities jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS materials text,
  ADD COLUMN IF NOT EXISTS supervisor_feedback text,
  ADD COLUMN IF NOT EXISTS supervisee_reflection text,
  ADD COLUMN IF NOT EXISTS supervisee_feedback text,
  ADD COLUMN IF NOT EXISTS supervisee_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS share_token uuid,
  ADD COLUMN IF NOT EXISTS share_password text,
  ADD COLUMN IF NOT EXISTS share_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS share_revoked_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS supervisee_goals_share_token_key
  ON public.supervisee_goals (share_token) WHERE share_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_dev_plan_link_info(_token uuid)
RETURNS TABLE(exists_flag boolean, password_required boolean, supervisor_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT true,
         (g.share_password IS NOT NULL AND length(trim(g.share_password)) > 0),
         COALESCE(pr.full_name, 'Supervisor(a)')
  FROM public.supervisee_goals g
  LEFT JOIN public.profiles pr ON pr.id = g.supervisor_id
  WHERE g.share_token = _token
    AND g.share_revoked_at IS NULL
    AND (g.share_expires_at IS NULL OR g.share_expires_at > now())
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_dev_plan_by_token(_token uuid, _password text)
RETURNS TABLE(
  id uuid, title text, skill text, evidence text, objective text,
  activities jsonb, materials text, supervisor_feedback text,
  supervisee_reflection text, supervisee_feedback text,
  status text, due_date date, supervisor_name text, updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT g.id, g.title, g.skill, g.evidence, g.objective, g.activities, g.materials,
         g.supervisor_feedback, g.supervisee_reflection, g.supervisee_feedback,
         g.status, g.due_date, COALESCE(pr.full_name, 'Supervisor(a)'), g.updated_at
  FROM public.supervisee_goals g
  LEFT JOIN public.profiles pr ON pr.id = g.supervisor_id
  WHERE g.share_token = _token
    AND g.share_revoked_at IS NULL
    AND (g.share_expires_at IS NULL OR g.share_expires_at > now())
    AND (
      g.share_password IS NULL
      OR length(trim(g.share_password)) = 0
      OR g.share_password = _password
    )
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.submit_dev_plan_response(
  _token uuid, _password text, _activities jsonb,
  _reflection text, _feedback text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _g public.supervisee_goals%ROWTYPE;
BEGIN
  SELECT * INTO _g FROM public.supervisee_goals WHERE share_token = _token;
  IF _g.id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF _g.share_revoked_at IS NOT NULL
     OR (_g.share_expires_at IS NOT NULL AND _g.share_expires_at <= now()) THEN
    RAISE EXCEPTION 'expired_token';
  END IF;
  IF _g.share_password IS NOT NULL AND length(trim(_g.share_password)) > 0
     AND COALESCE(_password, '') <> _g.share_password THEN
    RAISE EXCEPTION 'invalid_password';
  END IF;

  UPDATE public.supervisee_goals
     SET activities = COALESCE(_activities, activities),
         supervisee_reflection = left(COALESCE(_reflection, ''), 5000),
         supervisee_feedback = left(COALESCE(_feedback, ''), 5000),
         supervisee_updated_at = now()
   WHERE id = _g.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dev_plan_link_info(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dev_plan_by_token(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_dev_plan_response(uuid, text, jsonb, text, text) TO anon, authenticated;