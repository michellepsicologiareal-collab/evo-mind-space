-- Add snapshot of last approved version for diff view
ALTER TABLE public.patient_ai_summaries
  ADD COLUMN IF NOT EXISTS last_approved_data jsonb,
  ADD COLUMN IF NOT EXISTS last_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_approved_by uuid;

-- Trigger: whenever status transitions to 'approved', snapshot the current effective content
CREATE OR REPLACE FUNCTION public.snapshot_approved_summary()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    NEW.last_approved_data := COALESCE(NEW.edited_content, NEW.summary_data);
    NEW.last_approved_at := COALESCE(NEW.approved_at, now());
    NEW.last_approved_by := COALESCE(NEW.approved_by, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_approved_summary ON public.patient_ai_summaries;
CREATE TRIGGER trg_snapshot_approved_summary
BEFORE INSERT OR UPDATE ON public.patient_ai_summaries
FOR EACH ROW EXECUTE FUNCTION public.snapshot_approved_summary();

-- Backfill: any row currently approved gets its snapshot populated
UPDATE public.patient_ai_summaries
   SET last_approved_data = COALESCE(edited_content, summary_data),
       last_approved_at = COALESCE(approved_at, updated_at, now()),
       last_approved_by = approved_by
 WHERE status = 'approved'
   AND last_approved_data IS NULL;