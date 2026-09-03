CREATE OR REPLACE FUNCTION public.list_rpd_by_token(_token uuid, _password text)
RETURNS TABLE(
  id uuid,
  created_at timestamptz,
  situation text,
  automatic_thought text,
  emotion text,
  behavior text,
  cognitive_distortion text,
  rational_response text,
  crenca_pensamento_inicial integer,
  crenca_pensamento_final integer,
  intensidade_emocao_inicial jsonb,
  intensidade_emocao_final jsonb,
  filled_by text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.rpd_invites%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM public.rpd_invites WHERE token = _token;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF inv.revoked_at IS NOT NULL OR inv.expires_at <= now() THEN RAISE EXCEPTION 'expired_token'; END IF;
  IF inv.password IS NOT NULL AND length(inv.password) > 0
     AND COALESCE(_password, '') <> inv.password THEN
    RAISE EXCEPTION 'invalid_password';
  END IF;

  RETURN QUERY
  SELECT r.id, r.created_at, r.situation, r.automatic_thought, r.emotion,
         r.behavior, r.cognitive_distortion, r.rational_response,
         r.crenca_pensamento_inicial, r.crenca_pensamento_final,
         r.intensidade_emocao_inicial, r.intensidade_emocao_final, r.filled_by
  FROM public.tcc_records r
  WHERE r.patient_id = inv.patient_id
    AND r.user_id = inv.user_id
    AND r.filled_by = 'patient'
  ORDER BY r.created_at DESC
  LIMIT 100;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_rpd_by_token(uuid, text) TO anon, authenticated;