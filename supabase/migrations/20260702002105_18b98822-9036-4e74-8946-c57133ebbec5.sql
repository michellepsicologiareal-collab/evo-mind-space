
CREATE TABLE public.patient_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_data jsonb NOT NULL,
  edited_content jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','discarded')),
  source_records jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_used text,
  tokens_used integer,
  generated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id)
);

CREATE INDEX idx_patient_ai_summaries_user ON public.patient_ai_summaries(user_id);
CREATE INDEX idx_patient_ai_summaries_patient ON public.patient_ai_summaries(patient_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_ai_summaries TO authenticated;
GRANT ALL ON public.patient_ai_summaries TO service_role;

ALTER TABLE public.patient_ai_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their patient AI summaries"
  ON public.patient_ai_summaries
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid())
  );

CREATE TRIGGER trg_patient_ai_summaries_updated_at
  BEFORE UPDATE ON public.patient_ai_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
