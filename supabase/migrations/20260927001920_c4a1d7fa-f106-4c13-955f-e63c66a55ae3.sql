CREATE TABLE public.session_status_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  from_status text,
  to_status text NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.session_status_logs TO authenticated;
GRANT ALL ON public.session_status_logs TO service_role;
ALTER TABLE public.session_status_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own session status logs" ON public.session_status_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own session status logs" ON public.session_status_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_session_status_logs_session ON public.session_status_logs(session_id, changed_at DESC);