CREATE TABLE public.schema_formulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL,
  historia_origem text,
  ambiente_familiar text,
  figuras_vinculacao text,
  eventos_marcantes text,
  padrao_identificado text,
  necessidades jsonb NOT NULL DEFAULT '[]'::jsonb,
  outras_necessidades text,
  esquemas jsonb NOT NULL DEFAULT '[]'::jsonb,
  modos jsonb NOT NULL DEFAULT '{}'::jsonb,
  adulto_saudavel_forca int,
  conexao_gerada text,
  foco_terapeutico text,
  observacoes_terapeuta text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, therapist_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schema_formulations TO authenticated;
GRANT ALL ON public.schema_formulations TO service_role;

ALTER TABLE public.schema_formulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapist can select own schema formulations"
ON public.schema_formulations FOR SELECT TO authenticated
USING (therapist_id = auth.uid());

CREATE POLICY "Therapist can insert own schema formulations"
ON public.schema_formulations FOR INSERT TO authenticated
WITH CHECK (therapist_id = auth.uid());

CREATE POLICY "Therapist can update own schema formulations"
ON public.schema_formulations FOR UPDATE TO authenticated
USING (therapist_id = auth.uid())
WITH CHECK (therapist_id = auth.uid());

CREATE POLICY "Therapist can delete own schema formulations"
ON public.schema_formulations FOR DELETE TO authenticated
USING (therapist_id = auth.uid());

CREATE TRIGGER set_schema_formulations_updated_at
BEFORE UPDATE ON public.schema_formulations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_schema_formulations_patient ON public.schema_formulations(patient_id);
CREATE INDEX idx_schema_formulations_therapist ON public.schema_formulations(therapist_id);