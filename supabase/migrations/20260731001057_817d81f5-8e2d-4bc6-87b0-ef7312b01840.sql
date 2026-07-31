ALTER TABLE public.tcc_records ADD COLUMN IF NOT EXISTS filled_by text NOT NULL DEFAULT 'therapist';

CREATE TABLE public.rpd_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  password text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  revoked_at timestamptz,
  submissions_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rpd_invites TO authenticated;
GRANT ALL ON public.rpd_invites TO service_role;

ALTER TABLE public.rpd_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their rpd invites"
ON public.rpd_invites FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_rpd_invites_updated_at
BEFORE UPDATE ON public.rpd_invites
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_rpd_invite_info(_token uuid)
RETURNS TABLE(patient_name text, therapist_name text, therapist_crp text, password_required boolean, valid boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.full_name,
         COALESCE(pr.full_name, 'Psicóloga'),
         pr.crp,
         (i.password IS NOT NULL AND length(i.password) > 0),
         (i.revoked_at IS NULL AND i.expires_at > now())
  FROM public.rpd_invites i
  JOIN public.patients p ON p.id = i.patient_id
  LEFT JOIN public.profiles pr ON pr.id = i.user_id
  WHERE i.token = _token
$$;

CREATE OR REPLACE FUNCTION public.submit_rpd_by_token(_token uuid, _password text, _payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    behavior, cognitive_distortion, rational_response, filled_by
  ) VALUES (
    inv.user_id, inv.patient_id,
    NULLIF(_payload->>'situation',''),
    NULLIF(_payload->>'automatic_thought',''),
    NULLIF(_payload->>'emotion',''),
    NULLIF(_payload->>'behavior',''),
    NULLIF(_payload->>'cognitive_distortion',''),
    NULLIF(_payload->>'rational_response',''),
    'patient'
  ) RETURNING id INTO new_id;

  UPDATE public.rpd_invites SET submissions_count = submissions_count + 1 WHERE id = inv.id;
  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_rpd_invite_info(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_rpd_by_token(uuid, text, jsonb) TO anon, authenticated;