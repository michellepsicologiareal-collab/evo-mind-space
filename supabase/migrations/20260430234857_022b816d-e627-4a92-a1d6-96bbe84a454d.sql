ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_window_hours integer NOT NULL DEFAULT 24;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_reminder_window_hours_check
  CHECK (reminder_window_hours BETWEEN 1 AND 168);