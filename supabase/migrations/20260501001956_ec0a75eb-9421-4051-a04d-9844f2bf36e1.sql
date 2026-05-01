CREATE TABLE public.patient_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  session_id uuid,
  mood_score integer,
  note text,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT mood_score_range CHECK (mood_score IS NULL OR (mood_score BETWEEN 1 AND 10))
);

CREATE INDEX idx_patient_progress_patient ON public.patient_progress(patient_id, recorded_at DESC);
CREATE INDEX idx_patient_progress_user ON public.patient_progress(user_id);

ALTER TABLE public.patient_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress"
  ON public.patient_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Supervisors can view supervisee progress"
  ON public.patient_progress FOR SELECT
  USING (public.is_supervisor_of(user_id));

CREATE POLICY "Users can create own progress"
  ON public.patient_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON public.patient_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own progress"
  ON public.patient_progress FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER set_patient_progress_updated_at
  BEFORE UPDATE ON public.patient_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();