CREATE TABLE public.session_confirmation_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  modality text NOT NULL,
  content_type text NOT NULL,
  content text,
  channel text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_confirmation_events TO authenticated;
GRANT ALL ON public.session_confirmation_events TO service_role;

ALTER TABLE public.session_confirmation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own session confirmation events"
ON public.session_confirmation_events
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_session_confirmation_events_patient
ON public.session_confirmation_events (patient_id, created_at DESC);