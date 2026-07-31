CREATE TABLE public.homework_share_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.homework_tasks(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('link','password','link_copied','password_copied')),
  channel text NOT NULL DEFAULT 'whatsapp',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.homework_share_events TO authenticated;
GRANT ALL ON public.homework_share_events TO service_role;

ALTER TABLE public.homework_share_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own homework share events"
ON public.homework_share_events FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_homework_share_events_patient ON public.homework_share_events (patient_id, created_at DESC);