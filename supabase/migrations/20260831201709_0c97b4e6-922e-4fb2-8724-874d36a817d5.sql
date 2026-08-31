ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS billing_reminder_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS billing_reminder_days integer NOT NULL DEFAULT 3;