-- 1) Campos de rascunho pendente (protege o conteúdo aprovado)
ALTER TABLE public.patient_ai_summaries
  ADD COLUMN IF NOT EXISTS pending_draft_data jsonb,
  ADD COLUMN IF NOT EXISTS pending_draft_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_draft_source_records jsonb,
  ADD COLUMN IF NOT EXISTS pending_draft_model text,
  ADD COLUMN IF NOT EXISTS pending_draft_tokens integer;

-- 2) Tabela de eventos / trilha de auditoria
CREATE TABLE IF NOT EXISTS public.patient_ai_summary_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_id uuid REFERENCES public.patient_ai_summaries(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  user_id uuid NOT NULL,        -- dono do resumo (profissional)
  actor_id uuid NOT NULL,       -- quem executou (sempre = user_id, mantido para clareza/auditoria)
  event_type text NOT NULL CHECK (event_type IN (
    'generated','regenerated','edited',
    'approved','discarded',
    'pending_created','pending_promoted','pending_discarded'
  )),
  from_status text,
  to_status text,
  snapshot jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.patient_ai_summary_events TO authenticated;
GRANT ALL ON public.patient_ai_summary_events TO service_role;

ALTER TABLE public.patient_ai_summary_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_summary_events_select_own" ON public.patient_ai_summary_events;
CREATE POLICY "ai_summary_events_select_own"
  ON public.patient_ai_summary_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ai_summary_events_insert_own" ON public.patient_ai_summary_events;
CREATE POLICY "ai_summary_events_insert_own"
  ON public.patient_ai_summary_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND actor_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ai_summary_events_summary ON public.patient_ai_summary_events(summary_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_summary_events_patient ON public.patient_ai_summary_events(patient_id, created_at DESC);

-- 3) Trigger: registra eventos automaticamente em mudanças relevantes
CREATE OR REPLACE FUNCTION public.log_ai_summary_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := COALESCE(auth.uid(), NEW.user_id);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.patient_ai_summary_events(summary_id, patient_id, user_id, actor_id, event_type, from_status, to_status, snapshot)
    VALUES (NEW.id, NEW.patient_id, NEW.user_id, _actor, 'generated', NULL, NEW.status, to_jsonb(NEW.summary_data));
    IF NEW.status = 'approved' THEN
      INSERT INTO public.patient_ai_summary_events(summary_id, patient_id, user_id, actor_id, event_type, from_status, to_status, snapshot)
      VALUES (NEW.id, NEW.patient_id, NEW.user_id, _actor, 'approved', NULL, 'approved', to_jsonb(COALESCE(NEW.edited_content, NEW.summary_data)));
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO public.patient_ai_summary_events(summary_id, patient_id, user_id, actor_id, event_type, from_status, to_status, snapshot)
      VALUES (NEW.id, NEW.patient_id, NEW.user_id, _actor, 'approved', OLD.status, NEW.status, to_jsonb(COALESCE(NEW.edited_content, NEW.summary_data)));
    ELSIF NEW.status = 'discarded' THEN
      INSERT INTO public.patient_ai_summary_events(summary_id, patient_id, user_id, actor_id, event_type, from_status, to_status)
      VALUES (NEW.id, NEW.patient_id, NEW.user_id, _actor, 'discarded', OLD.status, NEW.status);
    END IF;
  END IF;

  IF NEW.edited_content IS DISTINCT FROM OLD.edited_content
     AND NEW.summary_data::text = OLD.summary_data::text THEN
    INSERT INTO public.patient_ai_summary_events(summary_id, patient_id, user_id, actor_id, event_type, from_status, to_status)
    VALUES (NEW.id, NEW.patient_id, NEW.user_id, _actor, 'edited', OLD.status, NEW.status);
  END IF;

  -- Regeneração: summary_data mudou e status voltou pra draft (fluxo drafts-só)
  IF NEW.summary_data::text IS DISTINCT FROM OLD.summary_data::text
     AND OLD.status <> 'approved' THEN
    INSERT INTO public.patient_ai_summary_events(summary_id, patient_id, user_id, actor_id, event_type, from_status, to_status, snapshot)
    VALUES (NEW.id, NEW.patient_id, NEW.user_id, _actor, 'regenerated', OLD.status, NEW.status, to_jsonb(NEW.summary_data));
  END IF;

  -- Rascunho pendente criado
  IF NEW.pending_draft_data IS NOT NULL
     AND (OLD.pending_draft_data IS NULL
          OR NEW.pending_draft_generated_at IS DISTINCT FROM OLD.pending_draft_generated_at) THEN
    INSERT INTO public.patient_ai_summary_events(summary_id, patient_id, user_id, actor_id, event_type, from_status, to_status, snapshot)
    VALUES (NEW.id, NEW.patient_id, NEW.user_id, _actor, 'pending_created', OLD.status, NEW.status, to_jsonb(NEW.pending_draft_data));
  END IF;

  -- Rascunho pendente descartado (limpo sem promover)
  IF OLD.pending_draft_data IS NOT NULL AND NEW.pending_draft_data IS NULL
     AND NEW.summary_data::text = OLD.summary_data::text THEN
    INSERT INTO public.patient_ai_summary_events(summary_id, patient_id, user_id, actor_id, event_type, from_status, to_status)
    VALUES (NEW.id, NEW.patient_id, NEW.user_id, _actor, 'pending_discarded', OLD.status, NEW.status);
  END IF;

  -- Rascunho pendente promovido (foi para summary_data e pending zerou)
  IF OLD.pending_draft_data IS NOT NULL AND NEW.pending_draft_data IS NULL
     AND NEW.summary_data::text IS DISTINCT FROM OLD.summary_data::text THEN
    INSERT INTO public.patient_ai_summary_events(summary_id, patient_id, user_id, actor_id, event_type, from_status, to_status, snapshot)
    VALUES (NEW.id, NEW.patient_id, NEW.user_id, _actor, 'pending_promoted', OLD.status, NEW.status, to_jsonb(NEW.summary_data));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_ai_summary_event ON public.patient_ai_summaries;
CREATE TRIGGER trg_log_ai_summary_event
AFTER INSERT OR UPDATE ON public.patient_ai_summaries
FOR EACH ROW EXECUTE FUNCTION public.log_ai_summary_event();