
-- 1. Add stable public token to patients
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS homework_token uuid UNIQUE DEFAULT gen_random_uuid();
UPDATE public.patients SET homework_token = gen_random_uuid() WHERE homework_token IS NULL;

-- 2. Homework tasks table
CREATE TABLE IF NOT EXISTS public.homework_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  session_record_id uuid REFERENCES public.session_records(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.homework_tasks TO authenticated;
GRANT ALL ON public.homework_tasks TO service_role;

ALTER TABLE public.homework_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages homework" ON public.homework_tasks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER homework_tasks_set_updated_at
  BEFORE UPDATE ON public.homework_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_homework_tasks_patient ON public.homework_tasks(patient_id, created_at DESC);

-- 3. Public RPC to fetch tasks by patient homework token
CREATE OR REPLACE FUNCTION public.get_homework_by_token(_token uuid)
RETURNS TABLE(
  patient_name text,
  therapist_name text,
  therapist_crp text,
  task_id uuid,
  title text,
  content text,
  sent_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.full_name,
    pr.full_name,
    pr.crp,
    h.id,
    h.title,
    h.content,
    h.sent_at,
    h.created_at
  FROM public.patients p
  JOIN public.profiles pr ON pr.id = p.user_id
  LEFT JOIN public.homework_tasks h
    ON h.patient_id = p.id AND h.sent_at IS NOT NULL
  WHERE p.homework_token = _token
  ORDER BY h.sent_at DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_homework_by_token(uuid) TO anon, authenticated;
