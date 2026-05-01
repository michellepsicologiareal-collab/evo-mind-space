-- Create session_type enum
CREATE TYPE public.session_type AS ENUM ('clinical', 'supervision');

-- Add type column with default 'clinical'
ALTER TABLE public.sessions
  ADD COLUMN session_type public.session_type NOT NULL DEFAULT 'clinical';

-- Add discussed_patient_id for supervision sessions (which patient is being discussed)
ALTER TABLE public.sessions
  ADD COLUMN discussed_patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL;

-- Add is_expense flag (true for supervision = cost, false for clinical = revenue)
ALTER TABLE public.sessions
  ADD COLUMN is_expense BOOLEAN NOT NULL DEFAULT false;

-- Make patient_id nullable so supervision sessions don't require a patient
ALTER TABLE public.sessions
  ALTER COLUMN patient_id DROP NOT NULL;