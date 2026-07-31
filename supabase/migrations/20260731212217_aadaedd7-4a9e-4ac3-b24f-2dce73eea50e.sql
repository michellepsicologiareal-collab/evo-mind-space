CREATE OR REPLACE FUNCTION public.get_supervised_patient_clinical(_patient_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _code text;
  _is_active boolean;
  _notes text;
  _result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_supervisor_see_patient(_patient_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT l.code, l.is_active, p.notes
    INTO _code, _is_active, _notes
  FROM public.list_supervised_patients() l
  JOIN public.patients p ON p.id = l.id
  WHERE l.id = _patient_id;

  SELECT jsonb_build_object(
    'code', _code,
    'is_active', _is_active,
    'notes', _notes,
    'chief_complaint', (SELECT p.chief_complaint FROM public.patients p WHERE p.id = _patient_id),
    'treatment_plan', (SELECT p.treatment_plan FROM public.patients p WHERE p.id = _patient_id),
    'last_session_at', (
      SELECT max(s.scheduled_at) FROM public.sessions s
      WHERE s.patient_id = _patient_id AND s.scheduled_at <= now()
    ),
    'next_session_at', (
      SELECT min(s.scheduled_at) FROM public.sessions s
      WHERE s.patient_id = _patient_id AND s.scheduled_at > now()
        AND s.status IN ('scheduled','confirmed')
    ),
    'formulation', (
      SELECT to_jsonb(f) - 'id' - 'user_id' - 'patient_id'
      FROM (
        SELECT cf.environment, cf.thoughts, cf.emotions, cf.behaviors,
               cf.physical_reactions, cf.core_beliefs, cf.treatment_goals,
               cf.ai_summary, cf.updated_at
        FROM public.case_formulations cf
        WHERE cf.patient_id = _patient_id
        ORDER BY cf.updated_at DESC LIMIT 1
      ) f
    ),
    'records', COALESCE((
      SELECT jsonb_agg(r ORDER BY r.session_date DESC)
      FROM (
        SELECT sr.session_date, sr.session_number, sr.modality, sr.themes,
               sr.chief_complaint, sr.clinical_observations, sr.next_session_plan,
               sr.engagement, sr.risk_indicator
        FROM public.session_records sr
        WHERE sr.patient_id = _patient_id
        ORDER BY sr.session_date DESC
        LIMIT 5
      ) r
    ), '[]'::jsonb),
    'progress', COALESCE((
      SELECT jsonb_agg(g ORDER BY g.recorded_at DESC)
      FROM (
        SELECT pp.recorded_at, pp.mood_score, pp.wellbeing_score, pp.wellbeing_source,
               pp.patient_context, pp.clinical_observation, pp.attention_flag,
               pp.data_model, pp.themes, pp.engagement, pp.note
        FROM public.patient_progress pp
        WHERE pp.patient_id = _patient_id
        ORDER BY pp.recorded_at DESC
        LIMIT 5
      ) g
    ), '[]'::jsonb)
  ) INTO _result;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_supervised_patient_clinical(uuid) TO authenticated;