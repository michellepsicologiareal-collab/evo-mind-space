ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reminder_group_by_patient boolean NOT NULL DEFAULT false;