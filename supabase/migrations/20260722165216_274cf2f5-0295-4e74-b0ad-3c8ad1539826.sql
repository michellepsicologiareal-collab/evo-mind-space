-- Etapa 1: extensão do modelo clínico v2 em patient_progress
ALTER TABLE public.patient_progress
  ADD COLUMN IF NOT EXISTS themes        text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS engagement    integer,
  ADD COLUMN IF NOT EXISTS private_notes text;

COMMENT ON COLUMN public.patient_progress.themes
  IS 'Temas clínicos observados na sessão (chips). Migrado conceitualmente de session_records.themes.';
COMMENT ON COLUMN public.patient_progress.engagement
  IS 'Engajamento do paciente na sessão (1=Muito baixo … 5=Muito alto). NULL = não avaliado.';
COMMENT ON COLUMN public.patient_progress.private_notes
  IS 'Notas privadas da psicóloga sobre a sessão. Não sai em relatórios enviados ao paciente.';

-- Validação: engagement entre 1 e 5 (NULL permitido = "não avaliado")
ALTER TABLE public.patient_progress
  ADD CONSTRAINT patient_progress_engagement_range
  CHECK (engagement IS NULL OR (engagement BETWEEN 1 AND 5));

-- Proteção contra duplicidade: um único registro clínico por (psicóloga, sessão).
-- Postgres permite múltiplos NULL em UNIQUE, então registros sem session_id não são bloqueados.
ALTER TABLE public.patient_progress
  ADD CONSTRAINT patient_progress_user_session_unique
  UNIQUE (user_id, session_id);