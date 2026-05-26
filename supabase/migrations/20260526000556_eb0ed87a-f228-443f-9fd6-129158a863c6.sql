
-- Treatment Plan feature tables

CREATE TABLE public.treatment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  patient_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'ativo',
  cid text DEFAULT '',
  abordagem text[] NOT NULL DEFAULT '{}',
  conceitualizacao text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tp_select_own" ON public.treatment_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tp_insert_own" ON public.treatment_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tp_update_own" ON public.treatment_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tp_delete_own" ON public.treatment_plans FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER tp_updated_at BEFORE UPDATE ON public.treatment_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.treatment_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'geral',
  descricao text NOT NULL DEFAULT '',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.treatment_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tg_select_own" ON public.treatment_goals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tg_insert_own" ON public.treatment_goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tg_update_own" ON public.treatment_goals FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tg_delete_own" ON public.treatment_goals FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER tg_updated_at BEFORE UPDATE ON public.treatment_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_treatment_goals_patient ON public.treatment_goals(patient_id);

CREATE TABLE public.treatment_techniques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.treatment_techniques ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tt_select_own" ON public.treatment_techniques FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tt_insert_own" ON public.treatment_techniques FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tt_update_own" ON public.treatment_techniques FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tt_delete_own" ON public.treatment_techniques FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_treatment_techniques_patient ON public.treatment_techniques(patient_id);

CREATE TABLE public.session_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  session_id uuid,
  objetivo text DEFAULT '',
  meta_id uuid,
  retomar text DEFAULT '',
  tecnicas text[] NOT NULL DEFAULT '{}',
  observacoes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.session_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sp_select_own" ON public.session_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sp_insert_own" ON public.session_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sp_update_own" ON public.session_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sp_delete_own" ON public.session_plans FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER sp_updated_at BEFORE UPDATE ON public.session_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_session_plans_patient ON public.session_plans(patient_id);
CREATE UNIQUE INDEX idx_session_plans_session ON public.session_plans(session_id) WHERE session_id IS NOT NULL;

CREATE TABLE public.treatment_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  data timestamptz NOT NULL DEFAULT now(),
  sessao_ref text DEFAULT '',
  descricao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.treatment_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tr_select_own" ON public.treatment_revisions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tr_insert_own" ON public.treatment_revisions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tr_update_own" ON public.treatment_revisions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tr_delete_own" ON public.treatment_revisions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_treatment_revisions_patient ON public.treatment_revisions(patient_id);
