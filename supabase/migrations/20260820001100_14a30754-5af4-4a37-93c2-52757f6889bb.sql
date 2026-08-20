ALTER TABLE public.supervision_feedbacks
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE OR REPLACE FUNCTION public.mark_supervision_feedback_read(_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _read_at timestamptz;
BEGIN
  UPDATE public.supervision_feedbacks
     SET read_at = COALESCE(read_at, now())
   WHERE id = _id
     AND supervisee_id = auth.uid()
     AND shared_with_supervisee = true
  RETURNING read_at INTO _read_at;

  RETURN _read_at;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_supervision_feedback_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_supervision_feedback_read(uuid) TO authenticated;