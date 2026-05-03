
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.supervisee_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supervisor_id UUID NOT NULL,
  supervisee_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supervisee_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supervisors can manage goals of their supervisees"
ON public.supervisee_goals FOR ALL
TO authenticated
USING (auth.uid() = supervisor_id)
WITH CHECK (auth.uid() = supervisor_id);

CREATE POLICY "Supervisees can view own goals"
ON public.supervisee_goals FOR SELECT
TO authenticated
USING (auth.uid() = supervisee_id);

CREATE TRIGGER update_supervisee_goals_updated_at
BEFORE UPDATE ON public.supervisee_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
