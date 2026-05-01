DROP POLICY IF EXISTS "Public can view session by confirmation token" ON public.sessions;
DROP POLICY IF EXISTS "Public can confirm or cancel session by token" ON public.sessions;

CREATE OR REPLACE FUNCTION public.get_session_by_token(_token uuid)
RETURNS TABLE (
  id uuid,
  scheduled_at timestamptz,
  duration_minutes int,
  status text,
  patient_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.scheduled_at, s.duration_minutes, s.status::text, p.full_name
  FROM public.sessions s
  JOIN public.patients p ON p.id = s.patient_id
  WHERE s.confirmation_token = _token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_confirmation(_token uuid, _confirm boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _session_id uuid;
  _current_status text;
BEGIN
  SELECT id, status::text INTO _session_id, _current_status
  FROM public.sessions
  WHERE confirmation_token = _token;

  IF _session_id IS NULL THEN
    RAISE EXCEPTION 'Sessao nao encontrada';
  END IF;

  IF _current_status NOT IN ('scheduled') THEN
    RETURN 'already_responded';
  END IF;

  IF _confirm THEN
    UPDATE public.sessions SET status = 'confirmed' WHERE id = _session_id;
    RETURN 'confirmed';
  ELSE
    UPDATE public.sessions SET status = 'cancelled' WHERE id = _session_id;
    RETURN 'cancelled';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_session_by_token(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.respond_to_confirmation(uuid, boolean) TO anon;