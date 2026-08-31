ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS patients_deleted_at_idx ON public.patients (user_id, deleted_at);

-- Hide soft-deleted patients from all normal reads
CREATE POLICY "Hide trashed patients"
ON public.patients
AS RESTRICTIVE
FOR SELECT
USING (deleted_at IS NULL);

-- Hide sessions of trashed patients
CREATE POLICY "Hide sessions of trashed patients"
ON public.sessions
AS RESTRICTIVE
FOR SELECT
USING (
  patient_id IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = sessions.patient_id AND p.deleted_at IS NOT NULL
  )
);

-- Soft delete
CREATE OR REPLACE FUNCTION public.trash_patient(_patient_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.patients
  SET deleted_at = now(), updated_at = now()
  WHERE id = _patient_id AND user_id = auth.uid() AND deleted_at IS NULL;
$$;

-- List trashed patients (bypasses the restrictive select policy)
CREATE OR REPLACE FUNCTION public.list_trashed_patients()
RETURNS TABLE(id uuid, full_name text, phone text, email text, deleted_at timestamptz, sessions_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.phone, p.email, p.deleted_at,
         (SELECT count(*) FROM public.sessions s WHERE s.patient_id = p.id)
  FROM public.patients p
  WHERE p.user_id = auth.uid() AND p.deleted_at IS NOT NULL
  ORDER BY p.deleted_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.restore_patient(_patient_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.patients
  SET deleted_at = NULL, updated_at = now()
  WHERE id = _patient_id AND user_id = auth.uid() AND deleted_at IS NOT NULL;
$$;

-- Permanent delete (only for trashed patients)
CREATE OR REPLACE FUNCTION public.purge_patient(_patient_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.patients
  WHERE id = _patient_id AND user_id = auth.uid() AND deleted_at IS NOT NULL;
$$;

-- Auto purge after 30 days
CREATE OR REPLACE FUNCTION public.purge_expired_trashed_patients()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  WITH del AS (
    DELETE FROM public.patients
    WHERE user_id = auth.uid()
      AND deleted_at IS NOT NULL
      AND deleted_at < now() - interval '30 days'
    RETURNING 1
  )
  SELECT count(*) INTO n FROM del;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trash_patient(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_trashed_patients() TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_patient(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_patient(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_trashed_patients() TO authenticated;