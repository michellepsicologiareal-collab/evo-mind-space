-- 1) Add columns to events table for source records and reason
ALTER TABLE public.patient_ai_summary_events
  ADD COLUMN IF NOT EXISTS source_records jsonb,
  ADD COLUMN IF NOT EXISTS reason text;

-- 2) Update trigger to populate source_records automatically
CREATE OR REPLACE FUNCTION public.log_ai_summary_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid := COALESCE(auth.uid(), NEW.user_id);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.patient_ai_summary_events(summary_id, patient_id, user_id, actor_id, event_type, from_status, to_status, snapshot, source_records)
    VALUES (NEW.id, NEW.patient_id, NEW.user_id, _actor, 'generated', NULL, NEW.status, to_jsonb(NEW.summary_data), NEW.source_records);
    IF NEW.status = 'approved' THEN
      INSERT INTO public.patient_ai_summary_events(summary_id, patient_id, user_id, actor_id, event_type, from_status, to_status, snapshot, source_records)
      VALUES (NEW.id, NEW.patient_id, NEW.user_id, _actor, 'approved', NULL, 'approved', to_jsonb(COALESCE(NEW.edited_content, NEW.summary_data)), NEW.source_records);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO public.patient_ai_summary_events(summary_id, patient_id, user_id, actor_id, event_type, from_status, to_status, snapshot, source_records)
      VALUES (NEW.id, NEW.patient_id, NEW.user_id, _actor, 'approved', OLD.status, NEW.status, to_jsonb(COALESCE(NEW.edited_content, NEW.summary_data)), NEW.source_records);
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

  IF NEW.summary_data::text IS DISTINCT FROM OLD.summary_data::text
     AND OLD.status <> 'approved' THEN
    INSERT INTO public.patient_ai_summary_events(summary_id, patient_id, user_id, actor_id, event_type, from_status, to_status, snapshot, source_records)
    VALUES (NEW.id, NEW.patient_id, NEW.user_id, _actor, 'regenerated', OLD.status, NEW.status, to_jsonb(NEW.summary_data), NEW.source_records);
  END IF;

  IF NEW.pending_draft_data IS NOT NULL
     AND (OLD.pending_draft_data IS NULL
          OR NEW.pending_draft_generated_at IS DISTINCT FROM OLD.pending_draft_generated_at) THEN
    INSERT INTO public.patient_ai_summary_events(summary_id, patient_id, user_id, actor_id, event_type, from_status, to_status, snapshot, source_records)
    VALUES (NEW.id, NEW.patient_id, NEW.user_id, _actor, 'pending_created', OLD.status, NEW.status, to_jsonb(NEW.pending_draft_data), NEW.pending_draft_source_records);
  END IF;

  IF OLD.pending_draft_data IS NOT NULL AND NEW.pending_draft_data IS NULL
     AND NEW.summary_data::text = OLD.summary_data::text THEN
    INSERT INTO public.patient_ai_summary_events(summary_id, patient_id, user_id, actor_id, event_type, from_status, to_status)
    VALUES (NEW.id, NEW.patient_id, NEW.user_id, _actor, 'pending_discarded', OLD.status, NEW.status);
  END IF;

  IF OLD.pending_draft_data IS NOT NULL AND NEW.pending_draft_data IS NULL
     AND NEW.summary_data::text IS DISTINCT FROM OLD.summary_data::text THEN
    INSERT INTO public.patient_ai_summary_events(summary_id, patient_id, user_id, actor_id, event_type, from_status, to_status, snapshot, source_records)
    VALUES (NEW.id, NEW.patient_id, NEW.user_id, _actor, 'pending_promoted', OLD.status, NEW.status, to_jsonb(NEW.summary_data), NEW.source_records);
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) RPC to annotate the most recent event of a summary with a reason
CREATE OR REPLACE FUNCTION public.set_ai_summary_event_reason(_summary_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _owner uuid;
  _event_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT user_id INTO _owner FROM public.patient_ai_summaries WHERE id = _summary_id;
  IF _owner IS NULL OR _owner <> auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT id INTO _event_id
  FROM public.patient_ai_summary_events
  WHERE summary_id = _summary_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF _event_id IS NOT NULL THEN
    UPDATE public.patient_ai_summary_events
      SET reason = left(COALESCE(_reason, ''), 500)
    WHERE id = _event_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_ai_summary_event_reason(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_ai_summary_event_reason(uuid, text) TO service_role;