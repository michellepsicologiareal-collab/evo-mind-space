
CREATE TABLE public.supervision_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supervisor_id UUID NOT NULL,
  supervisee_id UUID NOT NULL,
  supervision_date DATE NOT NULL DEFAULT CURRENT_DATE,
  patient_name TEXT NOT NULL DEFAULT '',
  chief_complaint TEXT NOT NULL DEFAULT '',
  problem_list TEXT NOT NULL DEFAULT '',
  identified_beliefs TEXT NOT NULL DEFAULT '',
  planned_interventions TEXT NOT NULL DEFAULT '',
  general_observations TEXT NOT NULL DEFAULT '',
  shared_fields TEXT[] NOT NULL DEFAULT '{}',
  shared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supervision_records ENABLE ROW LEVEL SECURITY;

-- Supervisor can do everything with own records
CREATE POLICY "Supervisors can view own records"
ON public.supervision_records FOR SELECT
TO authenticated
USING (auth.uid() = supervisor_id);

CREATE POLICY "Supervisors can insert own records"
ON public.supervision_records FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = supervisor_id);

CREATE POLICY "Supervisors can update own records"
ON public.supervision_records FOR UPDATE
TO authenticated
USING (auth.uid() = supervisor_id);

CREATE POLICY "Supervisors can delete own records"
ON public.supervision_records FOR DELETE
TO authenticated
USING (auth.uid() = supervisor_id);

-- Supervisee can only view shared records
CREATE POLICY "Supervisees can view shared records"
ON public.supervision_records FOR SELECT
TO authenticated
USING (auth.uid() = supervisee_id AND cardinality(shared_fields) > 0);

-- Timestamp trigger
CREATE TRIGGER update_supervision_records_updated_at
BEFORE UPDATE ON public.supervision_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
