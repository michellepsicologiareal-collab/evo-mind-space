
-- FASE 1 HOTFIX: Revogar acesso de supervisoras às tabelas clínicas originais.
-- Nenhuma tabela, coluna, função, dado ou policy da proprietária é alterada.
-- Apenas as 10 policies de SELECT baseadas em is_supervisor_of/can_supervisor_see_patient são removidas.

DROP POLICY IF EXISTS "Supervisors can view shared supervisee patients" ON public.patients;
DROP POLICY IF EXISTS "Supervisors can view shared supervisee progress"  ON public.patient_progress;
DROP POLICY IF EXISTS "Supervisors can view shared supervisee sessions"  ON public.sessions;
DROP POLICY IF EXISTS "Supervisors can view shared session_records"      ON public.session_records;
DROP POLICY IF EXISTS "Supervisors can view shared evolutions"           ON public.session_evolutions;
DROP POLICY IF EXISTS "Supervisors can view shared formulations"         ON public.case_formulations;
DROP POLICY IF EXISTS "Supervisors can view shared tcc_records"          ON public.tcc_records;
DROP POLICY IF EXISTS "Supervisor can view ACT formulations of shared patients"    ON public.act_formulations;
DROP POLICY IF EXISTS "Supervisor can view Schema formulations of shared patients" ON public.schema_formulations;
DROP POLICY IF EXISTS "Supervisors can view shared child anamneses"      ON public.child_anamneses;
