CREATE TABLE public.therapist_rpd_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  situation text,
  automatic_thought text,
  emotion text,
  behavior text,
  cognitive_distortion text,
  rational_response text,
  crenca_pensamento_inicial integer CHECK (crenca_pensamento_inicial BETWEEN 0 AND 100),
  crenca_pensamento_final integer CHECK (crenca_pensamento_final BETWEEN 0 AND 100),
  intensidade_emocao_inicial jsonb,
  intensidade_emocao_final jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapist_rpd_records TO authenticated;
GRANT ALL ON public.therapist_rpd_records TO service_role;
ALTER TABLE public.therapist_rpd_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Therapists can read own RPD" ON public.therapist_rpd_records FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Therapists can insert own RPD" ON public.therapist_rpd_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Therapists can update own RPD" ON public.therapist_rpd_records FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Therapists can delete own RPD" ON public.therapist_rpd_records FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX therapist_rpd_records_user_created_idx ON public.therapist_rpd_records (user_id, created_at DESC);