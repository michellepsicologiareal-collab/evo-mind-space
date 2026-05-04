
CREATE TABLE public.session_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  session_id UUID,
  session_number INTEGER,
  modality TEXT NOT NULL DEFAULT 'presencial',
  duration_minutes INTEGER NOT NULL DEFAULT 50,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  chief_complaint TEXT DEFAULT '',
  themes TEXT[] NOT NULL DEFAULT '{}',
  clinical_observations TEXT DEFAULT '',
  next_session_plan TEXT DEFAULT '',
  engagement INTEGER CHECK (engagement >= 1 AND engagement <= 5),
  risk_indicator TEXT NOT NULL DEFAULT 'none',
  private_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.session_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session_records"
  ON public.session_records FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own session_records"
  ON public.session_records FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own session_records"
  ON public.session_records FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own session_records"
  ON public.session_records FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Supervisors can view shared session_records"
  ON public.session_records FOR SELECT
  TO authenticated
  USING (can_supervisor_see_patient(patient_id));

CREATE TRIGGER set_session_records_updated_at
  BEFORE UPDATE ON public.session_records
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
