ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS clinic_address text,
  ADD COLUMN IF NOT EXISTS presencial_message text;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS clinic_address text;