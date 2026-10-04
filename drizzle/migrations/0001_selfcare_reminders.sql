CREATE TABLE public.selfcare_reminders (
  user_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  frequency text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekly')),
  weekday integer NOT NULL DEFAULT 1 CHECK (weekday BETWEEN 0 AND 6),
  remind_time text NOT NULL DEFAULT '20:00',
  include_checkin boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.selfcare_reminders TO authenticated;
GRANT ALL ON public.selfcare_reminders TO service_role;
ALTER TABLE public.selfcare_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own reminders" ON public.selfcare_reminders FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER selfcare_reminders_updated BEFORE UPDATE ON public.selfcare_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();