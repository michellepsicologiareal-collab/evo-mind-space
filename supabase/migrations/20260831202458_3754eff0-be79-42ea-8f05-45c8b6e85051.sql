CREATE TABLE public.billing_reminder_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  plan_key text NOT NULL,
  plan_label text,
  status text NOT NULL,
  due_date date,
  days_ahead integer,
  pending_value numeric,
  channel text NOT NULL DEFAULT 'auto',
  notified_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_reminder_logs TO authenticated;
GRANT ALL ON public.billing_reminder_logs TO service_role;

ALTER TABLE public.billing_reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own billing reminder logs"
ON public.billing_reminder_logs FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX billing_reminder_logs_user_plan_idx ON public.billing_reminder_logs (user_id, plan_key, notified_at DESC);