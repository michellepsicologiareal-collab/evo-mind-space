
-- 1. Tabela de convites de anamnese
CREATE TABLE public.anamnesis_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  used_at timestamptz,
  revoked_at timestamptz,
  signed_anamnesis_id uuid REFERENCES public.child_anamneses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_anamnesis_invites_token ON public.anamnesis_invites(token);
CREATE INDEX idx_anamnesis_invites_user ON public.anamnesis_invites(user_id);
CREATE INDEX idx_anamnesis_invites_patient ON public.anamnesis_invites(patient_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.anamnesis_invites TO authenticated;
GRANT ALL ON public.anamnesis_invites TO service_role;

ALTER TABLE public.anamnesis_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner select anamnesis invites" ON public.anamnesis_invites
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owner insert anamnesis invites" ON public.anamnesis_invites
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner update anamnesis invites" ON public.anamnesis_invites
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner delete anamnesis invites" ON public.anamnesis_invites
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Trigger: proteger campos sensíveis contra alteração via JWT (authenticated/anon)
CREATE OR REPLACE FUNCTION public.protect_anamnesis_invite_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text := auth.role();
BEGIN
  IF _role IN ('authenticated', 'anon') THEN
    NEW.used_at := OLD.used_at;
    NEW.signed_anamnesis_id := OLD.signed_anamnesis_id;
    NEW.token := OLD.token;
    NEW.patient_id := OLD.patient_id;
    NEW.user_id := OLD.user_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_anamnesis_invite_fields
  BEFORE UPDATE ON public.anamnesis_invites
  FOR EACH ROW EXECUTE FUNCTION public.protect_anamnesis_invite_fields();

-- 2. Coluna invite_id em child_anamneses (nullable, preserva histórico)
ALTER TABLE public.child_anamneses
  ADD COLUMN invite_id uuid REFERENCES public.anamnesis_invites(id) ON DELETE SET NULL;

-- 3. Função pública: retorna só o mínimo necessário para renderizar o formulário
CREATE OR REPLACE FUNCTION public.get_child_anamnesis_by_invite_token(_token uuid)
RETURNS TABLE(
  invite_id uuid,
  child_name text,
  professional_name text,
  professional_crp text,
  expires_at timestamptz,
  status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv RECORD;
BEGIN
  SELECT ai.*, p.full_name AS patient_name, pr.full_name AS prof_name, pr.crp AS prof_crp
    INTO _inv
  FROM public.anamnesis_invites ai
  JOIN public.patients p ON p.id = ai.patient_id
  JOIN public.profiles pr ON pr.id = ai.user_id
  WHERE ai.token = _token;

  IF NOT FOUND THEN
    RETURN;
  END IF;

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
$$;

-- 4. Função pública: envio atômico da anamnese
CREATE OR REPLACE FUNCTION public.submit_child_anamnesis(_token uuid, _payload jsonb, _ip text, _ua text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv RECORD;
  _anamnesis_id uuid;
  _child_name text;
BEGIN
  -- Trava atômica: só marca used_at se ainda ativo
  UPDATE public.anamnesis_invites
     SET used_at = now()
   WHERE token = _token
     AND used_at IS NULL
     AND revoked_at IS NULL
     AND expires_at > now()
  RETURNING id, user_id, patient_id INTO _inv;

  IF NOT FOUND THEN
    SELECT * INTO _inv FROM public.anamnesis_invites WHERE token = _token;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'invite_not_found' USING ERRCODE = 'P0002';
    ELSIF _inv.revoked_at IS NOT NULL THEN
      RAISE EXCEPTION 'invite_revoked' USING ERRCODE = 'P0001';
    ELSIF _inv.used_at IS NOT NULL THEN
      RAISE EXCEPTION 'invite_already_used' USING ERRCODE = 'P0001';
    ELSE
      RAISE EXCEPTION 'invite_expired' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NOT COALESCE((_payload->>'authorized_lgpd')::boolean, false) THEN
    RAISE EXCEPTION 'lgpd_required' USING ERRCODE = 'P0001';
  END IF;

  _child_name := NULLIF(trim(COALESCE(_payload->>'child_name','')), '');
  IF _child_name IS NULL THEN
    RAISE EXCEPTION 'missing_child_name' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.child_anamneses (
    user_id, patient_id, invite_id, authorized_lgpd,
    email, child_name, child_birth_date, schooling, sleep, feeding,
    sexual_curiosity, relationship_father, relationship_mother,
    social_relationship, school_relationship, chief_complaint,
    was_desired, parents_kinship, pregnancy_health_issue,
    pregnancy_health_which, mother_name, mother_schooling,
    mother_profession, father_name, father_schooling, father_profession,
    weeks_at_birth, delivery_type, has_disease,
    parents_living_together, parents_relationship, parents_disorder,
    parents_disorder_which
  ) VALUES (
    _inv.user_id, _inv.patient_id, _inv.id, true,
    left(COALESCE(_payload->>'email',''), 200),
    left(_child_name, 200),
    CASE WHEN _payload->>'child_birth_date' ~ '^\d{4}-\d{2}-\d{2}$' THEN (_payload->>'child_birth_date')::date ELSE NULL END,
    left(COALESCE(_payload->>'schooling',''), 500),
    left(COALESCE(_payload->>'sleep',''), 5000),
    left(COALESCE(_payload->>'feeding',''), 5000),
    left(COALESCE(_payload->>'sexual_curiosity',''), 5000),
    left(COALESCE(_payload->>'relationship_father',''), 5000),
    left(COALESCE(_payload->>'relationship_mother',''), 5000),
    left(COALESCE(_payload->>'social_relationship',''), 5000),
    left(COALESCE(_payload->>'school_relationship',''), 5000),
    left(COALESCE(_payload->>'chief_complaint',''), 5000),
    left(COALESCE(_payload->>'was_desired',''), 5000),
    left(COALESCE(_payload->>'parents_kinship',''), 5000),
    left(COALESCE(_payload->>'pregnancy_health_issue',''), 5000),
    left(COALESCE(_payload->>'pregnancy_health_which',''), 5000),
    left(COALESCE(_payload->>'mother_name',''), 200),
    left(COALESCE(_payload->>'mother_schooling',''), 500),
    left(COALESCE(_payload->>'mother_profession',''), 500),
    left(COALESCE(_payload->>'father_name',''), 200),
    left(COALESCE(_payload->>'father_schooling',''), 500),
    left(COALESCE(_payload->>'father_profession',''), 500),
    left(COALESCE(_payload->>'weeks_at_birth',''), 100),
    left(COALESCE(_payload->>'delivery_type',''), 100),
    left(COALESCE(_payload->>'has_disease',''), 5000),
    left(COALESCE(_payload->>'parents_living_together',''), 100),
    left(COALESCE(_payload->>'parents_relationship',''), 5000),
    left(COALESCE(_payload->>'parents_disorder',''), 5000),
    left(COALESCE(_payload->>'parents_disorder_which',''), 5000)
  ) RETURNING id INTO _anamnesis_id;

  UPDATE public.anamnesis_invites
     SET signed_anamnesis_id = _anamnesis_id
   WHERE id = _inv.id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    _inv.user_id,
    'Nova anamnese recebida',
    _child_name || ' teve a anamnese preenchida.',
    'general'
  );

  RETURN _anamnesis_id;
END;
$$;

-- 5. Limpar dados E2E do contrato (mantendo os 2 contratos históricos intactos)
DELETE FROM public.signed_contracts
 WHERE invite_id IN (SELECT id FROM public.contract_invites WHERE id::text LIKE 'e2e%');

DELETE FROM public.contract_invites WHERE id::text LIKE 'e2e%';
