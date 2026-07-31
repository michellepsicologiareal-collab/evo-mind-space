CREATE POLICY "Supervisors can view shared patients"
ON public.patients FOR SELECT TO authenticated
USING (public.can_supervisor_see_patient(id));

CREATE POLICY "Supervisors can view sessions of shared patients"
ON public.sessions FOR SELECT TO authenticated
USING (patient_id IS NOT NULL AND public.can_supervisor_see_patient(patient_id));

CREATE POLICY "Supervisors can view progress of shared patients"
ON public.patient_progress FOR SELECT TO authenticated
USING (public.can_supervisor_see_patient(patient_id));

CREATE POLICY "Supervisors can view session records of shared patients"
ON public.session_records FOR SELECT TO authenticated
USING (public.can_supervisor_see_patient(patient_id));

CREATE POLICY "Supervisors can view formulations of shared patients"
ON public.case_formulations FOR SELECT TO authenticated
USING (public.can_supervisor_see_patient(patient_id));