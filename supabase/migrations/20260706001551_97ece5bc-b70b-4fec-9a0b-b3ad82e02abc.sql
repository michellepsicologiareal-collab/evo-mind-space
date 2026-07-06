
-- ============== adult_anamneses ==============
CREATE TABLE public.adult_anamneses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  invite_id uuid,

  -- 1. Dados pessoais
  full_name text NOT NULL,
  birth_date date,
  phone text,
  email text,
  profession text,
  marital_status text,
  emergency_contact_name text,
  emergency_contact_phone text,

  -- 2/3/4
  reason_for_seeking text,
  problem_duration text,        -- '<1m' | '1_6m' | '6_12m' | '>1y'
  impact_level int CHECK (impact_level IS NULL OR (impact_level BETWEEN 0 AND 10)),

  -- 5 sintomas
  symptoms jsonb NOT NULL DEFAULT '[]'::jsonb,
  symptom_other text,

  -- 6 tratamentos anteriores
  uses_medication text,          -- 'no' | 'yes'
  medication_name text,
  had_psychotherapy text,        -- 'never' | 'yes'
  had_psychiatrist text,         -- 'never' | 'yes'

  -- 7 escalas de vida
  scale_sleep int CHECK (scale_sleep IS NULL OR (scale_sleep BETWEEN 0 AND 10)),
  scale_feeding int CHECK (scale_feeding IS NULL OR (scale_feeding BETWEEN 0 AND 10)),
  scale_work int CHECK (scale_work IS NULL OR (scale_work BETWEEN 0 AND 10)),
  scale_relationships int CHECK (scale_relationships IS NULL OR (scale_relationships BETWEEN 0 AND 10)),
  scale_leisure int CHECK (scale_leisure IS NULL OR (scale_leisure BETWEEN 0 AND 10)),
  scale_physical_health int CHECK (scale_physical_health IS NULL OR (scale_physical_health BETWEEN 0 AND 10)),

  -- 8 rede de apoio
  support_network text,          -- 'yes' | 'no' | 'sometimes'
  support_network_details text,

  -- 9/10/11
  important_events text,
  therapy_goals text,
  additional_info text,

  -- 12 segurança
  risk_ideation text NOT NULL DEFAULT 'none' CHECK (risk_ideation IN ('none','sometimes','frequent')),
  risk_flag boolean GENERATED ALWAYS AS (risk_ideation IN ('sometimes','frequent')) STORED,

  authorized_lgpd boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'recebida',
  submitted_at timestamptz NOT NULL DEFAULT now(),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_adult_anamneses_user ON public.adult_anamneses(user_id);
CREATE INDEX idx_adult_anamneses_patient ON public.adult_anamneses(patient_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.adult_anamneses TO authenticated;
GRANT ALL ON public.adult_anamneses TO service_role;

ALTER TABLE public.adult_anamneses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adult_anamneses_owner_all" ON public.adult_anamneses
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_adult_anamneses_updated_at
  BEFORE UPDATE ON public.adult_anamneses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== adult_anamnesis_invites ==============
CREATE TABLE public.adult_anamnesis_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  used_at timestamptz,
  revoked_at timestamptz,
  signed_anamnesis_id uuid REFERENCES public.adult_anamneses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_adult_anamnesis_invites_user ON public.adult_anamnesis_invites(user_id);
CREATE INDEX idx_adult_anamnesis_invites_token ON public.adult_anamnesis_invites(token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.adult_anamnesis_invites TO authenticated;
GRANT ALL ON public.adult_anamnesis_invites TO service_role;

ALTER TABLE public.adult_anamnesis_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adult_anamnesis_invites_owner_all" ON public.adult_anamnesis_invites
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_adult_anamnesis_invites_updated_at
  BEFORE UPDATE ON public.adult_anamnesis_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== RPCs ==============
CREATE OR REPLACE FUNCTION public.get_adult_anamnesis_by_invite_token(_token uuid)
RETURNS TABLE(invite_id uuid, patient_name text, professional_name text, professional_crp text, expires_at timestamptz, status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE _inv RECORD;
BEGIN
  SELECT ai.*, p.full_name AS patient_name, pr.full_name AS prof_name, pr.crp AS prof_crp
    INTO _inv
  FROM public.adult_anamnesis_invites ai
  LEFT JOIN public.patients p ON p.id = ai.patient_id
  JOIN public.profiles pr ON pr.id = ai.user_id
  WHERE ai.token = _token;

  IF NOT FOUND THEN RETURN; END IF;

  RETURN QUERY SELECT
    _inv.id,
    COALESCE(_inv.patient_name, '')::text,
    COALESCE(_inv.prof_name, '')::text,
    COALESCE(_inv.prof_crp, '')::text,
    _inv.expires_at,
    CASE
      WHEN _inv.revoked_at IS NOT NULL THEN 'revoked'
      WHEN _inv.used_at IS NOT NULL THEN 'used'
      WHEN _inv.expires_at < now() THEN 'expired'
      ELSE 'active'
    END::text;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.submit_adult_anamnesis(_token uuid, _payload jsonb, _ip text, _ua text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  _inv RECORD;
  _patient_id uuid;
  _anamnesis_id uuid;
  _full_name text;
  _risk text;
BEGIN
  UPDATE public.adult_anamnesis_invites
     SET used_at = now()
   WHERE token = _token AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
   RETURNING id, user_id, patient_id INTO _inv;

  IF NOT FOUND THEN
    SELECT * INTO _inv FROM public.adult_anamnesis_invites WHERE token = _token;
    IF NOT FOUND THEN RAISE EXCEPTION 'invite_not_found' USING ERRCODE='P0002';
    ELSIF _inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'invite_revoked' USING ERRCODE='P0001';
    ELSIF _inv.used_at IS NOT NULL THEN RAISE EXCEPTION 'invite_already_used' USING ERRCODE='P0001';
    ELSE RAISE EXCEPTION 'invite_expired' USING ERRCODE='P0001';
    END IF;
  END IF;

  IF NOT COALESCE((_payload->>'authorized_lgpd')::boolean, false) THEN
    RAISE EXCEPTION 'lgpd_required' USING ERRCODE='P0001';
  END IF;

  _full_name := NULLIF(trim(COALESCE(_payload->>'full_name','')), '');
  IF _full_name IS NULL THEN
    RAISE EXCEPTION 'missing_full_name' USING ERRCODE='P0001';
  END IF;

  _risk := COALESCE(_payload->>'risk_ideation','none');
  IF _risk NOT IN ('none','sometimes','frequent') THEN _risk := 'none'; END IF;

  _patient_id := _inv.patient_id;
  IF _patient_id IS NULL THEN
    INSERT INTO public.patients (user_id, full_name, email, phone, birth_date, is_active, category)
    VALUES (
      _inv.user_id,
      left(_full_name, 200),
      NULLIF(left(COALESCE(_payload->>'email',''),200),''),
      NULLIF(left(COALESCE(_payload->>'phone',''),50),''),
      CASE WHEN _payload->>'birth_date' ~ '^\d{4}-\d{2}-\d{2}$' THEN (_payload->>'birth_date')::date ELSE NULL END,
      true,
      'adult'
    )
    RETURNING id INTO _patient_id;

    UPDATE public.adult_anamnesis_invites SET patient_id = _patient_id WHERE id = _inv.id;
  END IF;

  INSERT INTO public.adult_anamneses (
    user_id, patient_id, invite_id, authorized_lgpd,
    full_name, birth_date, phone, email, profession, marital_status,
    emergency_contact_name, emergency_contact_phone,
    reason_for_seeking, problem_duration, impact_level,
    symptoms, symptom_other,
    uses_medication, medication_name, had_psychotherapy, had_psychiatrist,
    scale_sleep, scale_feeding, scale_work, scale_relationships, scale_leisure, scale_physical_health,
    support_network, support_network_details,
    important_events, therapy_goals, additional_info,
    risk_ideation
  ) VALUES (
    _inv.user_id, _patient_id, _inv.id, true,
    left(_full_name, 200),
    CASE WHEN _payload->>'birth_date' ~ '^\d{4}-\d{2}-\d{2}$' THEN (_payload->>'birth_date')::date ELSE NULL END,
    left(COALESCE(_payload->>'phone',''), 50),
    left(COALESCE(_payload->>'email',''), 200),
    left(COALESCE(_payload->>'profession',''), 200),
    left(COALESCE(_payload->>'marital_status',''), 100),
    left(COALESCE(_payload->>'emergency_contact_name',''), 200),
    left(COALESCE(_payload->>'emergency_contact_phone',''), 50),
    left(COALESCE(_payload->>'reason_for_seeking',''), 5000),
    left(COALESCE(_payload->>'problem_duration',''), 20),
    NULLIF(_payload->>'impact_level','')::int,
    COALESCE(_payload->'symptoms','[]'::jsonb),
    left(COALESCE(_payload->>'symptom_other',''), 500),
    left(COALESCE(_payload->>'uses_medication',''), 10),
    left(COALESCE(_payload->>'medication_name',''), 500),
    left(COALESCE(_payload->>'had_psychotherapy',''), 10),
    left(COALESCE(_payload->>'had_psychiatrist',''), 10),
    NULLIF(_payload->>'scale_sleep','')::int,
    NULLIF(_payload->>'scale_feeding','')::int,
    NULLIF(_payload->>'scale_work','')::int,
    NULLIF(_payload->>'scale_relationships','')::int,
    NULLIF(_payload->>'scale_leisure','')::int,
    NULLIF(_payload->>'scale_physical_health','')::int,
    left(COALESCE(_payload->>'support_network',''), 20),
    left(COALESCE(_payload->>'support_network_details',''), 2000),
    left(COALESCE(_payload->>'important_events',''), 5000),
    left(COALESCE(_payload->>'therapy_goals',''), 2000),
    left(COALESCE(_payload->>'additional_info',''), 2000),
    _risk
  ) RETURNING id INTO _anamnesis_id;

  UPDATE public.adult_anamnesis_invites SET signed_anamnesis_id = _anamnesis_id WHERE id = _inv.id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    _inv.user_id,
    CASE WHEN _risk IN ('sometimes','frequent') THEN '⚠️ Nova anamnese adulto (atenção)' ELSE 'Nova anamnese adulto recebida' END,
    _full_name || ' preencheu a anamnese inicial.',
    'general'
  );

  RETURN _anamnesis_id;
END;
$fn$;
