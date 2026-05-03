ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS has_financial_responsible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS financial_responsible_name text,
  ADD COLUMN IF NOT EXISTS financial_responsible_phone text;