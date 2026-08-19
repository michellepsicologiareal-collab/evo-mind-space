CREATE TABLE public.supervision_feedbacks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supervisor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supervisee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  supervision_date date NOT NULL DEFAULT CURRENT_DATE,
  case_synthesis text NOT NULL DEFAULT '',
  conceptualization text NOT NULL DEFAULT '',
  maintenance_cycle text NOT NULL DEFAULT '',
  clinical_hypotheses text NOT NULL DEFAULT '',
  therapeutic_direction text NOT NULL DEFAULT '',
  suggested_interventions text[] NOT NULL DEFAULT '{}',
  next_session_points text[] NOT NULL DEFAULT '{}',
  reflection_questions text[] NOT NULL DEFAULT '{}',
  next_supervision_attention text NOT NULL DEFAULT '',
  shared_with_supervisee boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_supervision_feedbacks_patient ON public.supervision_feedbacks (patient_id, supervision_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supervision_feedbacks TO authenticated;
GRANT ALL ON public.supervision_feedbacks TO service_role;

ALTER TABLE public.supervision_feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supervisor manages own feedbacks"
ON public.supervision_feedbacks FOR ALL TO authenticated
USING (supervisor_id = auth.uid())
WITH CHECK (supervisor_id = auth.uid() AND public.is_supervisor_of(supervisee_id));

CREATE POLICY "Supervisee reads shared feedbacks"
ON public.supervision_feedbacks FOR SELECT TO authenticated
USING (supervisee_id = auth.uid() AND shared_with_supervisee = true);

CREATE TRIGGER trg_supervision_feedbacks_updated_at
BEFORE UPDATE ON public.supervision_feedbacks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();