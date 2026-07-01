-- ============================================================
-- P1 SECURITY FIX: public-contract via single-use invite token
-- ============================================================
-- Reversão (DOWN):
--   DROP FUNCTION IF EXISTS public.submit_signed_contract(uuid, jsonb, text, text);
--   DROP FUNCTION IF EXISTS public.get_contract_by_invite_token(uuid);
--   ALTER TABLE public.signed_contracts DROP COLUMN IF EXISTS invite_id;
--   ALTER TABLE public.signed_contracts DROP COLUMN IF EXISTS user_agent;
--   DROP TABLE IF EXISTS public.contract_invites;
-- ============================================================

-- 1) Tabela de convites (1 link = 1 assinatura pretendida)
CREATE TABLE public.contract_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.contract_templates(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  patient_label text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  used_at timestamptz,
  revoked_at timestamptz,
  signed_contract_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contract_invites_user_id_idx ON public.contract_invites(user_id);
CREATE INDEX contract_invites_template_id_idx ON public.contract_invites(template_id);
CREATE INDEX contract_invites_token_idx ON public.contract_invites(token);

-- 2) Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_invites TO authenticated;
GRANT ALL ON public.contract_invites TO service_role;

-- 3) RLS: dono controla convites; consumo passa pelas funções SECURITY DEFINER
ALTER TABLE public.contract_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner selects own invites"
  ON public.contract_invites FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owner inserts own invites"
  ON public.contract_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.contract_templates t
      WHERE t.id = template_id AND t.user_id = auth.uid()
    )
  );

-- Dono pode revogar (setar revoked_at) mas não forjar used_at / signed_contract_id
CREATE POLICY "Owner updates own invites (revoke only)"
  ON public.contract_invites FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner deletes own invites"
  ON public.contract_invites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger para impedir que cliente marque used_at diretamente
CREATE OR REPLACE FUNCTION public.protect_contract_invite_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só service_role pode alterar used_at / signed_contract_id
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.used_at := OLD.used_at;
    NEW.signed_contract_id := OLD.signed_contract_id;
    NEW.token := OLD.token;
    NEW.template_id := OLD.template_id;
    NEW.user_id := OLD.user_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_contract_invite_fields
  BEFORE UPDATE ON public.contract_invites
  FOR EACH ROW EXECUTE FUNCTION public.protect_contract_invite_fields();

-- 4) Colunas adicionais em signed_contracts (não destrutivo; histórico preservado)
ALTER TABLE public.signed_contracts
  ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.contract_invites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_agent text;

CREATE INDEX IF NOT EXISTS signed_contracts_invite_id_idx ON public.signed_contracts(invite_id);

-- FK reversa (agora que existe): invite -> signed_contract
ALTER TABLE public.contract_invites
  ADD CONSTRAINT contract_invites_signed_contract_fk
  FOREIGN KEY (signed_contract_id) REFERENCES public.signed_contracts(id) ON DELETE SET NULL;

-- 5) SECURITY DEFINER: leitura pelo token
CREATE OR REPLACE FUNCTION public.get_contract_by_invite_token(_token uuid)
RETURNS TABLE (
  invite_id uuid,
  template_id uuid,
  professional_name text,
  professional_crp text,
  clauses jsonb,
  lgpd_clause text,
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
  SELECT ci.*, t.professional_name, t.professional_crp, t.clauses, t.lgpd_clause
    INTO _inv
  FROM public.contract_invites ci
  JOIN public.contract_templates t ON t.id = ci.template_id
  WHERE ci.token = _token;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT
    _inv.id,
    _inv.template_id,
    _inv.professional_name,
    _inv.professional_crp,
    _inv.clauses,
    _inv.lgpd_clause,
    _inv.expires_at,
    CASE
      WHEN _inv.revoked_at IS NOT NULL THEN 'revoked'
      WHEN _inv.used_at IS NOT NULL THEN 'used'
      WHEN _inv.expires_at < now() THEN 'expired'
      ELSE 'active'
    END::text;
END;
$$;

-- Só o service_role (edge function) chama. Revogar de anon/authenticated.
REVOKE ALL ON FUNCTION public.get_contract_by_invite_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_contract_by_invite_token(uuid) TO service_role;

-- 6) SECURITY DEFINER: submissão atômica (one-shot, à prova de reuso)
CREATE OR REPLACE FUNCTION public.submit_signed_contract(
  _token uuid,
  _payload jsonb,
  _ip text,
  _ua text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv RECORD;
  _signed_id uuid;
  _patient_name text;
  _patient_cpf text;
BEGIN
  -- Trava atômica: marca used_at só se ainda estiver ativo, não expirado, não revogado
  UPDATE public.contract_invites
    SET used_at = now()
  WHERE token = _token
    AND used_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now()
  RETURNING id, user_id, template_id INTO _inv;

  IF NOT FOUND THEN
    -- Descobrir motivo para mensagem clara
    SELECT * INTO _inv FROM public.contract_invites WHERE token = _token;
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

  -- Validações mínimas
  IF NOT COALESCE((_payload->>'accepted_lgpd')::boolean, false) THEN
    -- rollback do used_at para permitir nova tentativa? Não — invalidar é aceitável.
    RAISE EXCEPTION 'lgpd_required' USING ERRCODE = 'P0001';
  END IF;

  _patient_name := NULLIF(trim(COALESCE(_payload->>'patient_name','')), '');
  _patient_cpf  := NULLIF(trim(COALESCE(_payload->>'patient_cpf','')), '');
  IF _patient_name IS NULL OR _patient_cpf IS NULL THEN
    RAISE EXCEPTION 'missing_patient_fields' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.signed_contracts (
    template_id, user_id, invite_id,
    patient_name, patient_whatsapp, patient_birth_date, patient_cpf, patient_address,
    emergency_contact_name, emergency_contact_relationship, emergency_contact_phone,
    clause_responses, accepted_lgpd, ip_address, user_agent
  )
  VALUES (
    _inv.template_id, _inv.user_id, _inv.id,
    left(_patient_name, 200),
    left(COALESCE(_payload->>'patient_whatsapp',''), 50),
    NULLIF(_payload->>'patient_birth_date','')::date,
    left(_patient_cpf, 50),
    left(COALESCE(_payload->>'patient_address',''), 500),
    left(COALESCE(_payload->>'emergency_contact_name',''), 200),
    left(COALESCE(_payload->>'emergency_contact_relationship',''), 100),
    left(COALESCE(_payload->>'emergency_contact_phone',''), 100),
    COALESCE(_payload->'clause_responses', '{}'::jsonb),
    true,
    left(COALESCE(_ip,''), 100),
    left(COALESCE(_ua,''), 500)
  )
  RETURNING id INTO _signed_id;

  UPDATE public.contract_invites
    SET signed_contract_id = _signed_id
  WHERE id = _inv.id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    _inv.user_id,
    'Novo termo assinado',
    _patient_name || ' assinou o termo de adesão.',
    'general'
  );

  RETURN _signed_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_signed_contract(uuid, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_signed_contract(uuid, jsonb, text, text) TO service_role;

-- 7) Trigger de updated_at
CREATE TRIGGER trg_contract_invites_updated_at
  BEFORE UPDATE ON public.contract_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
