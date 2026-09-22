CREATE TABLE public.payment_change_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_name text,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  action text NOT NULL,
  sessions_count integer NOT NULL DEFAULT 1,
  amount numeric,
  label text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_change_logs TO authenticated;
GRANT ALL ON public.payment_change_logs TO service_role;

ALTER TABLE public.payment_change_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own payment change logs"
ON public.payment_change_logs
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_payment_change_logs_user ON public.payment_change_logs (user_id, created_at DESC);
CREATE INDEX idx_payment_change_logs_patient ON public.payment_change_logs (patient_id, created_at DESC);