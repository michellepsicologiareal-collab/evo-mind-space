CREATE TYPE public.patient_category AS ENUM ('individual', 'crianca', 'grupo', 'casal');

ALTER TABLE public.patients
ADD COLUMN category public.patient_category NOT NULL DEFAULT 'individual';