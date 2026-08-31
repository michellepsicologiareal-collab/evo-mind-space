ALTER TABLE public.tcc_records
  ADD COLUMN IF NOT EXISTS crenca_pensamento_inicial integer,
  ADD COLUMN IF NOT EXISTS crenca_pensamento_final integer,
  ADD COLUMN IF NOT EXISTS intensidade_emocao_inicial jsonb,
  ADD COLUMN IF NOT EXISTS intensidade_emocao_final jsonb;

CREATE OR REPLACE FUNCTION public.submit_rpd_by_token(_token uuid, _password text, _payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inv public.rpd_invites%ROWTYPE;
  new_id uuid;
BEGIN
  SELECT * INTO inv FROM public.rpd_invites WHERE token = _token;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF inv.revoked_at IS NOT NULL OR inv.expires_at <= now() THEN RAISE EXCEPTION 'expired_token'; END IF;
  IF inv.password IS NOT NULL AND length(inv.password) > 0
     AND COALESCE(_password, '') <> inv.password THEN
    RAISE EXCEPTION 'invalid_password';
  END IF;

  INSERT INTO public.tcc_records (
    user_id, patient_id, situation, automatic_thought, emotion,
    behavior, cognitive_distortion, rational_response, filled_by,
    crenca_pensamento_inicial, crenca_pensamento_final,
    intensidade_emocao_inicial, intensidade_emocao_final
  ) VALUES (
    inv.user_id, inv.patient_id,
    NULLIF(_payload->>'situation',''),
    NULLIF(_payload->>'automatic_thought',''),
    NULLIF(_payload->>'emotion',''),
    NULLIF(_payload->>'behavior',''),
    NULLIF(_payload->>'cognitive_distortion',''),
    NULLIF(_payload->>'rational_response',''),
    'patient',
    NULLIF(_payload->>'crenca_pensamento_inicial','')::int,
    NULLIF(_payload->>'crenca_pensamento_final','')::int,
    CASE WHEN jsonb_typeof(_payload->'intensidade_emocao_inicial') = 'array' THEN _payload->'intensidade_emocao_inicial' ELSE NULL END,
    CASE WHEN jsonb_typeof(_payload->'intensidade_emocao_final') = 'array' THEN _payload->'intensidade_emocao_final' ELSE NULL END
  ) RETURNING id INTO new_id;

  UPDATE public.rpd_invites SET submissions_count = submissions_count + 1 WHERE id = inv.id;
  RETURN new_id;
END;
$function$;