CREATE OR REPLACE FUNCTION public.submit_mood_by_token(_token uuid, _password text, _score integer, _emotions text[], _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE inv public.rpd_invites%ROWTYPE; new_id uuid;
BEGIN
  SELECT * INTO inv FROM public.rpd_invites WHERE token = _token;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF inv.revoked_at IS NOT NULL OR inv.expires_at <= now() THEN RAISE EXCEPTION 'expired_token'; END IF;
  IF inv.password IS NOT NULL AND length(inv.password) > 0 AND COALESCE(_password,'') <> inv.password THEN
    RAISE EXCEPTION 'invalid_password';
  END IF;
  IF _score IS NULL OR _score < 0 OR _score > 10 THEN RAISE EXCEPTION 'invalid_score'; END IF;
  INSERT INTO public.patient_progress (user_id, patient_id, recorded_at, wellbeing_score, wellbeing_source, emotions, patient_context, data_model)
  VALUES (inv.user_id, inv.patient_id, now(), _score, 'patient_self_report',
    to_jsonb(COALESCE(_emotions, ARRAY[]::text[])), NULLIF(left(COALESCE(_note,''), 2000), ''), 'v2_structured')
  RETURNING id INTO new_id;
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.list_mood_by_token(_token uuid, _password text)
RETURNS TABLE(id uuid, recorded_at timestamptz, wellbeing_score smallint, emotions jsonb, patient_context text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE inv public.rpd_invites%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM public.rpd_invites WHERE token = _token;
  IF inv.id IS NULL OR inv.revoked_at IS NOT NULL OR inv.expires_at <= now() THEN RETURN; END IF;
  IF inv.password IS NOT NULL AND length(inv.password) > 0 AND COALESCE(_password,'') <> inv.password THEN RETURN; END IF;
  RETURN QUERY SELECT p.id, p.recorded_at, p.wellbeing_score, p.emotions, p.patient_context
    FROM public.patient_progress p
    WHERE p.patient_id = inv.patient_id AND p.user_id = inv.user_id AND p.wellbeing_source = 'patient_self_report'
    ORDER BY p.recorded_at DESC LIMIT 100;
END; $$;

GRANT EXECUTE ON FUNCTION public.submit_mood_by_token(uuid, text, integer, text[], text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_mood_by_token(uuid, text) TO anon, authenticated;