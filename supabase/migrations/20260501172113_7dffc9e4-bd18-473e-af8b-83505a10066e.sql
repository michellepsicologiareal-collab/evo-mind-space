
CREATE TABLE public.selfcare_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  checked_at date NOT NULL DEFAULT CURRENT_DATE,
  stress_level integer NOT NULL DEFAULT 0,
  sleep boolean,
  food boolean,
  movement boolean,
  health boolean,
  balance boolean,
  sessions_count integer NOT NULL DEFAULT 0,
  pauses_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, checked_at)
);

ALTER TABLE public.selfcare_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checkins"
  ON public.selfcare_checkins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own checkins"
  ON public.selfcare_checkins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own checkins"
  ON public.selfcare_checkins FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own checkins"
  ON public.selfcare_checkins FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_selfcare_checkins_updated_at
  BEFORE UPDATE ON public.selfcare_checkins
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
