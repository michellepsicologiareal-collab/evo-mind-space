-- RPC: link a supervisee to the calling supervisor by email
CREATE OR REPLACE FUNCTION public.link_supervisee_by_email(_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _target_id uuid;
  _target_type public.profile_type;
  _target_supervisor uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT id INTO _target_id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF _target_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  IF _target_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode vincular a si mesmo';
  END IF;

  SELECT profile_type, supervisor_id INTO _target_type, _target_supervisor
  FROM public.profiles WHERE id = _target_id;

  IF _target_type IS DISTINCT FROM 'supervisee'::public.profile_type THEN
    RAISE EXCEPTION 'O usuário precisa ter o perfil de Supervisionando';
  END IF;

  IF _target_supervisor IS NOT NULL AND _target_supervisor <> auth.uid() THEN
    RAISE EXCEPTION 'Este supervisionando já possui outro supervisor vinculado';
  END IF;

  UPDATE public.profiles SET supervisor_id = auth.uid() WHERE id = _target_id;
  RETURN _target_id;
END;
$$;

-- RPC: unlink a supervisee from the calling supervisor
CREATE OR REPLACE FUNCTION public.unlink_supervisee(_supervisee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  UPDATE public.profiles
  SET supervisor_id = NULL
  WHERE id = _supervisee_id AND supervisor_id = auth.uid();
END;
$$;