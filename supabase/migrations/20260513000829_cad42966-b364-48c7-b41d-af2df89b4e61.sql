CREATE TABLE public.child_anamneses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  email text DEFAULT '',
  child_name text DEFAULT '',
  child_birth_date date,
  schooling text DEFAULT '',
  sleep text DEFAULT '',
  feeding text DEFAULT '',
  sexual_curiosity text DEFAULT '',
  relationship_father text DEFAULT '',
  relationship_mother text DEFAULT '',
  social_relationship text DEFAULT '',
  school_relationship text DEFAULT '',
  chief_complaint text DEFAULT '',
  was_desired text DEFAULT '',
  parents_kinship text DEFAULT '',
  pregnancy_health_issue text DEFAULT '',
  pregnancy_health_which text DEFAULT '',
  mother_name text DEFAULT '',
  mother_schooling text DEFAULT '',
  mother_profession text DEFAULT '',
  father_name text DEFAULT '',
  father_schooling text DEFAULT '',
  father_profession text DEFAULT '',
  weeks_at_birth text DEFAULT '',
  delivery_type text DEFAULT '',
  has_disease text DEFAULT '',
  parents_living_together text DEFAULT '',
  parents_relationship text DEFAULT '',
  parents_disorder text DEFAULT '',
  parents_disorder_which text DEFAULT '',
  authorized_lgpd boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.child_anamneses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own child anamneses"
ON public.child_anamneses FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own child anamneses"
ON public.child_anamneses FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own child anamneses"
ON public.child_anamneses FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own child anamneses"
ON public.child_anamneses FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Supervisors can view shared child anamneses"
ON public.child_anamneses FOR SELECT TO authenticated
USING (public.can_supervisor_see_patient(patient_id));

CREATE TRIGGER update_child_anamneses_updated_at
BEFORE UPDATE ON public.child_anamneses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_child_anamneses_user_id ON public.child_anamneses(user_id);
CREATE INDEX idx_child_anamneses_patient_id ON public.child_anamneses(patient_id);