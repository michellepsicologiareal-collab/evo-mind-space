
-- 1. Add 'supervisor' to profile_type enum
ALTER TYPE public.profile_type ADD VALUE IF NOT EXISTS 'supervisor';

-- 2. Add sharing toggle to patients (default OFF = private)
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS shared_with_supervisor boolean NOT NULL DEFAULT false;

-- 3. Create helper function: can supervisor see this patient?
CREATE OR REPLACE FUNCTION public.can_supervisor_see_patient(_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.patients p
    JOIN public.profiles pr ON pr.id = p.user_id
    WHERE p.id = _patient_id
      AND p.shared_with_supervisor = true
      AND pr.supervisor_id = auth.uid()
      AND pr.profile_type = 'supervisee'
  );
$$;

-- Restrict helper from anon/public
REVOKE ALL ON FUNCTION public.can_supervisor_see_patient(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_supervisor_see_patient(uuid) TO authenticated;

-- 4. Drop old supervisor SELECT policies
DROP POLICY IF EXISTS "Supervisors can view supervisee patients" ON public.patients;
DROP POLICY IF EXISTS "Supervisors can view supervisee sessions" ON public.sessions;
DROP POLICY IF EXISTS "Supervisors can view supervisee progress" ON public.patient_progress;

-- 5. Recreate supervisor SELECT policies with sharing check

-- Patients: supervisor sees only shared patients of their supervisee
CREATE POLICY "Supervisors can view shared supervisee patients"
ON public.patients
FOR SELECT
TO authenticated
USING (
  shared_with_supervisor = true
  AND is_supervisor_of(user_id)
);

-- Sessions: supervisor sees sessions of shared patients only
CREATE POLICY "Supervisors can view shared supervisee sessions"
ON public.sessions
FOR SELECT
TO authenticated
USING (
  can_supervisor_see_patient(patient_id)
);

-- Progress: supervisor sees progress of shared patients only
CREATE POLICY "Supervisors can view shared supervisee progress"
ON public.patient_progress
FOR SELECT
TO authenticated
USING (
  can_supervisor_see_patient(patient_id)
);
