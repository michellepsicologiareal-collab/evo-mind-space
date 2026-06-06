CREATE TABLE public.act_formulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  apresentacao_problema jsonb NOT NULL DEFAULT '{}'::jsonb,
  hexaflex jsonb NOT NULL DEFAULT '{}'::jsonb,
  valores jsonb NOT NULL DEFAULT '[]'::jsonb,
  matriz_act jsonb NOT NULL DEFAULT '{}'::jsonb,
  barreiras_geradas text DEFAULT '',
  direcionamento_gerado text DEFAULT '',
  observacoes_terapeuta text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, therapist_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.act_formulations TO authenticated;
GRANT ALL ON public.act_formulations TO service_role;

ALTER TABLE public.act_formulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapists manage their own ACT formulations"
ON public.act_formulations
FOR ALL
TO authenticated
USING (auth.uid() = therapist_id)
WITH CHECK (auth.uid() = therapist_id);

CREATE TRIGGER act_formulations_set_updated_at
BEFORE UPDATE ON public.act_formulations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();