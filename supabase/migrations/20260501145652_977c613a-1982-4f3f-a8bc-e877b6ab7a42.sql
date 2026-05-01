-- Case Formulations (Padesky model)
CREATE TABLE public.case_formulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  user_id uuid NOT NULL,
  environment text DEFAULT '',
  thoughts text DEFAULT '',
  emotions text DEFAULT '',
  behaviors text DEFAULT '',
  physical_reactions text DEFAULT '',
  core_beliefs text DEFAULT '',
  treatment_goals jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, user_id)
);

ALTER TABLE public.case_formulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own formulations"
ON public.case_formulations FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own formulations"
ON public.case_formulations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own formulations"
ON public.case_formulations FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own formulations"
ON public.case_formulations FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Supervisors can view shared formulations"
ON public.case_formulations FOR SELECT TO authenticated
USING (can_supervisor_see_patient(patient_id));

CREATE TRIGGER update_case_formulations_updated_at
BEFORE UPDATE ON public.case_formulations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Session Evolutions
CREATE TABLE public.session_evolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  user_id uuid NOT NULL,
  session_id uuid DEFAULT NULL,
  session_summary text DEFAULT '',
  homework text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.session_evolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own evolutions"
ON public.session_evolutions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own evolutions"
ON public.session_evolutions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own evolutions"
ON public.session_evolutions FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own evolutions"
ON public.session_evolutions FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Supervisors can view shared evolutions"
ON public.session_evolutions FOR SELECT TO authenticated
USING (can_supervisor_see_patient(patient_id));

CREATE TRIGGER update_session_evolutions_updated_at
BEFORE UPDATE ON public.session_evolutions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();