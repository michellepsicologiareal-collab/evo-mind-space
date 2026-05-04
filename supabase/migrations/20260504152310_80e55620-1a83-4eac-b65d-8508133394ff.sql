
ALTER TABLE public.patients
  ADD COLUMN treatment_start_date DATE,
  ADD COLUMN treatment_end_date DATE,
  ADD COLUMN has_psychiatrist BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN psychiatrist_name TEXT DEFAULT '',
  ADD COLUMN psychiatrist_phone TEXT DEFAULT '',
  ADD COLUMN medications TEXT DEFAULT '';
