
-- Add supervisor read access for ACT formulations
CREATE POLICY "Supervisor can view ACT formulations of shared patients"
  ON public.act_formulations
  FOR SELECT
  TO authenticated
  USING (public.can_supervisor_see_patient(patient_id));

-- Add supervisor read access for Schema formulations
CREATE POLICY "Supervisor can view Schema formulations of shared patients"
  ON public.schema_formulations
  FOR SELECT
  TO authenticated
  USING (public.can_supervisor_see_patient(patient_id));

-- Scope contract_templates policies to authenticated role only (least privilege)
DROP POLICY IF EXISTS "Users can view own template" ON public.contract_templates;
DROP POLICY IF EXISTS "Users can insert own template" ON public.contract_templates;
DROP POLICY IF EXISTS "Users can update own template" ON public.contract_templates;
DROP POLICY IF EXISTS "Users can delete own template" ON public.contract_templates;

CREATE POLICY "Users can view own template"
  ON public.contract_templates
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own template"
  ON public.contract_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own template"
  ON public.contract_templates
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own template"
  ON public.contract_templates
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
