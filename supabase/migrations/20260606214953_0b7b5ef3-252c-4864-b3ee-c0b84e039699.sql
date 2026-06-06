INSERT INTO public.treatment_plans (user_id, patient_id, status)
SELECT DISTINCT p.user_id, p.id, 'ativo'
FROM public.patients p
WHERE NOT EXISTS (SELECT 1 FROM public.treatment_plans tp WHERE tp.patient_id = p.id)
  AND (
    EXISTS (SELECT 1 FROM public.treatment_goals g WHERE g.patient_id = p.id)
    OR EXISTS (SELECT 1 FROM public.treatment_techniques t WHERE t.patient_id = p.id)
    OR EXISTS (SELECT 1 FROM public.session_plans s WHERE s.patient_id = p.id)
  );