-- Notification type enum
CREATE TYPE public.notification_type AS ENUM ('confirmation', 'cancellation', 'general');

-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type public.notification_type NOT NULL DEFAULT 'general',
  read boolean NOT NULL DEFAULT false,
  session_id uuid DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- System can insert notifications (via security definer functions)
CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Update respond_to_confirmation to create a notification
CREATE OR REPLACE FUNCTION public.respond_to_confirmation(_token uuid, _confirm boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _session_id uuid;
  _current_status text;
  _owner_id uuid;
  _patient_name text;
  _scheduled_at timestamptz;
BEGIN
  SELECT s.id, s.status::text, s.user_id, p.full_name, s.scheduled_at
  INTO _session_id, _current_status, _owner_id, _patient_name, _scheduled_at
  FROM public.sessions s
  JOIN public.patients p ON p.id = s.patient_id
  WHERE s.confirmation_token = _token;

  IF _session_id IS NULL THEN
    RAISE EXCEPTION 'Sessao nao encontrada';
  END IF;

  IF _current_status NOT IN ('scheduled') THEN
    RETURN 'already_responded';
  END IF;

  IF _confirm THEN
    UPDATE public.sessions SET status = 'confirmed' WHERE id = _session_id;
    INSERT INTO public.notifications (user_id, title, message, type, session_id)
    VALUES (
      _owner_id,
      'Sessao Confirmada',
      _patient_name || ' confirmou a sessao de ' || to_char(_scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM as HH24:MI') || '.',
      'confirmation',
      _session_id
    );
    RETURN 'confirmed';
  ELSE
    UPDATE public.sessions SET status = 'cancelled' WHERE id = _session_id;
    INSERT INTO public.notifications (user_id, title, message, type, session_id)
    VALUES (
      _owner_id,
      'Sessao Cancelada',
      _patient_name || ' cancelou a sessao de ' || to_char(_scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM as HH24:MI') || '.',
      'cancellation',
      _session_id
    );
    RETURN 'cancelled';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_to_confirmation(uuid, boolean) TO anon;