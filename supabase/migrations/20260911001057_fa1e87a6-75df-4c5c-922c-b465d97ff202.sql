ALTER TABLE public.billing_reminder_logs
  ADD COLUMN IF NOT EXISTS is_resend boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS session_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sessions_label text;