-- Table for therapist emotional trigger check-ins
CREATE TABLE public.therapist_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  mood_emoji text NOT NULL DEFAULT '😐',
  triggers text[] NOT NULL DEFAULT '{}',
  reflective_note text DEFAULT '',
  checked_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.therapist_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own triggers"
  ON public.therapist_triggers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own triggers"
  ON public.therapist_triggers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own triggers"
  ON public.therapist_triggers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own triggers"
  ON public.therapist_triggers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER set_therapist_triggers_updated_at
  BEFORE UPDATE ON public.therapist_triggers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();