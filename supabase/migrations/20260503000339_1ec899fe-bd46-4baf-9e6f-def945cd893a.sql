
-- Google Calendar OAuth tokens per user
CREATE TABLE public.google_calendar_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tokens" ON public.google_calendar_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tokens" ON public.google_calendar_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tokens" ON public.google_calendar_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tokens" ON public.google_calendar_tokens FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_gcal_tokens_updated_at BEFORE UPDATE ON public.google_calendar_tokens
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Map sessions to Google Calendar events
CREATE TABLE public.session_gcal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  gcal_event_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id)
);

ALTER TABLE public.session_gcal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gcal events" ON public.session_gcal_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own gcal events" ON public.session_gcal_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own gcal events" ON public.session_gcal_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own gcal events" ON public.session_gcal_events FOR DELETE USING (auth.uid() = user_id);
